import os
import re
import json
import io
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse
from PIL import Image

PORT = 8000

class AccesorizateRequestHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        parsed_url = urlparse(self.path)
        
        if parsed_url.path == "/api/save":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                products_list = json.loads(post_data.decode('utf-8'))
                
                # Write to products.json
                json_path = os.path.join("public", "data", "products.json")
                os.makedirs(os.path.dirname(json_path), exist_ok=True)
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(products_list, f, ensure_ascii=False, indent=2)
                    
                # Write to products_data.js
                js_path = os.path.join("public", "data", "products_data.js")
                with open(js_path, 'w', encoding='utf-8') as f:
                    f.write(f"window.PRODUCTS_DATA = {json.dumps(products_list, ensure_ascii=False, indent=2)};")
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "message": "Catálogo guardado correctamente"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
                
        elif parsed_url.path == "/api/upload":
            try:
                content_type = self.headers.get('Content-Type', '')
                boundary_match = re.search(r'boundary=(.*)', content_type)
                if not boundary_match:
                    raise ValueError("No boundary found in Content-Type")
                
                boundary = boundary_match.group(1).encode('utf-8')
                content_length = int(self.headers.get('Content-Length', 0))
                raw_data = self.rfile.read(content_length)
                
                parts = raw_data.split(b'--' + boundary)
                fields = {}
                uploaded_files = []
                
                for part in parts:
                    if not part or part == b'\r\n' or part == b'--\r\n' or part == b'--':
                        continue
                    # Split headers and body
                    try:
                        head, body = part.split(b'\r\n\r\n', 1)
                    except ValueError:
                        continue
                        
                    if body.endswith(b'\r\n'):
                        body = body[:-2]
                    
                    head_str = head.decode('utf-8', errors='ignore')
                    disp_match = re.search(r'Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?', head_str, re.IGNORECASE)
                    if disp_match:
                        name = disp_match.group(1)
                        filename = disp_match.group(2)
                        if filename:
                            uploaded_files.append(body)
                        else:
                            fields[name] = body.decode('utf-8', errors='ignore').strip()
                
                code = fields.get('code', '').upper().strip()
                if not code:
                    raise ValueError("Falta el código de producto para asociar la imagen")
                
                if not uploaded_files:
                    raise ValueError("No se recibió ningún archivo de imagen válido")
                
                saved_urls = []
                img_dir = os.path.join("public", "images")
                os.makedirs(img_dir, exist_ok=True)
                
                import time
                timestamp = int(time.time() * 1000)
                
                for idx, file_data in enumerate(uploaded_files):
                    if len(file_data) < 10:
                        continue
                    
                    img = Image.open(io.BytesIO(file_data))
                    img.thumbnail((600, 600), Image.Resampling.LANCZOS)
                    
                    img_filename = f"{code}_{timestamp}_{idx}.webp"
                    img_path = os.path.join(img_dir, img_filename)
                    
                    img.save(img_path, "WEBP", quality=80)
                    saved_urls.append(f"public/images/{img_filename}")
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "success",
                    "image_urls": saved_urls
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
        else:
            super().do_POST()
            
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Disable caching completely for localhost development
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == "__main__":
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, AccesorizateRequestHandler)
    print(f"Servidor inteligente de Accesorizate iniciado en http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
