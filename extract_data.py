import os
import re
import json
import io
from pptx import Presentation
from PIL import Image

# Setup directories
base_dir = r"c:\Users\Accesorizate1\Downloads\CAT"
output_images_dir = os.path.join(base_dir, "public", "images")
output_data_dir = os.path.join(base_dir, "public", "data")

os.makedirs(output_images_dir, exist_ok=True)
os.makedirs(output_data_dir, exist_ok=True)

# Regex patterns
code_pattern = re.compile(r'\b(AX|CH|XC|LM|LA|DM|MY|RT|PS|HR|DK|ER|NS)\d+(?:-[A-Za-z0-9]+)?\b', re.IGNORECASE)
price_pattern = re.compile(r'\$\s*(\d+)')

def clean_text(text):
    return re.sub(r'\s+', ' ', text).strip()

def get_material_from_text(text):
    text_upper = text.upper()
    if "ACERO" in text_upper:
        return "Acero Inoxidable"
    elif "CHAPA" in text_upper:
        return "Chapa de Oro"
    elif "ALUMINIO" in text_upper or "LM" in text_upper:
        return "Aluminio"
    elif "LATON" in text_upper or "LATÓN" in text_upper or "LA" in text_upper:
        return "Latón"
    elif "ALEACION" in text_upper or "ALEACIÓN" in text_upper:
        return "Aleación de Metales"
    return None

def get_material_from_code(code):
    code_upper = code.upper()
    if code_upper.startswith("AX"):
        return "Acero Inoxidable"
    elif code_upper.startswith("CH"):
        return "Chapa de Oro"
    elif code_upper.startswith("XC"):
        return "Chapa con Acero"
    elif code_upper.startswith("RT") or code_upper.startswith("DM"):
        return "Aleación de Metales"
    elif code_upper.startswith("LM"):
        return "Aluminio"
    elif code_upper.startswith("LA"):
        return "Latón"
    return None

def get_category_for_varios(slide_num, is_mayoreo=True):
    # Slide boundaries for the updated presentations:
    if is_mayoreo:
        # Wholesale presentation (CATALOGO VARIOS MAYOREO 7.pptx)
        if 4 <= slide_num <= 104:
            return "Aretes"
        elif 105 <= slide_num <= 219:
            return "Piercings"
        elif 220 <= slide_num <= 279:
            return "Anillos"
        elif 280 <= slide_num <= 385:
            return "Pulseras"
        elif slide_num >= 386:
            return "Accesorios para Niña"
    else:
        # Retail presentation (CATALOGO VARIOS CLIENTES.pptx)
        if 4 <= slide_num <= 101:
            return "Aretes"
        elif 102 <= slide_num <= 216:
            return "Piercings"
        elif 217 <= slide_num <= 277:
            return "Anillos"
        elif 278 <= slide_num <= 382:
            return "Pulseras"
        elif slide_num >= 383:
            return "Accesorios para Niña"
    return "Varios"

def extract_from_presentation(filepath, is_mayoreo=True, is_collares=True, existing_products=None):
    if existing_products is None:
        existing_products = {}
        
    print(f"\nProcessing {os.path.basename(filepath)}...")
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return existing_products
        
    prs = Presentation(filepath)
    slide_width = prs.slide_width
    slide_height = prs.slide_height
    
    total_slides = len(prs.slides)
    
    for slide_idx, slide in enumerate(prs.slides):
        slide_num = slide_idx + 1
        
        # 1. Extract slide-level context (material, specific headers)
        slide_texts = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                txt = clean_text(shape.text_frame.text)
                if txt:
                    slide_texts.append(txt)
        
        full_slide_text = " ".join(slide_texts)
        detected_material = get_material_from_text(full_slide_text)
        
        # Determine category
        if is_collares:
            category = "Collares"
            # Subcategories based on Collares index:
            # 1. Personalizados: Slide 4 to 60
            # 2. Collares Acero: Slide 61 to 186
            # 3. Collares Chapa: Slide 187 to 258
            # 4. Collares Aleación: Slide 259 to 266
            # 5. Accesorios Hombre: Slide 267+
            if 4 <= slide_num <= 60:
                subcategory = "Personalizados"
            elif 61 <= slide_num <= 186:
                subcategory = "Acero Inoxidable"
            elif 187 <= slide_num <= 258:
                subcategory = "Chapa de Oro"
            elif 259 <= slide_num <= 266:
                subcategory = "Aleación y Aluminio"
            elif slide_num >= 267:
                subcategory = "Accesorios Hombre"
            else:
                subcategory = "General"
        else:
            category = get_category_for_varios(slide_num, is_mayoreo=is_mayoreo)
            subcategory = category
            
        # 2. Traverse shapes to find images and text blocks containing codes
        pictures = []
        text_blocks = []
        
        def traverse_shapes(shape, group_left=0, group_top=0):
            left = shape.left + group_left if hasattr(shape, 'left') and shape.left else group_left
            top = shape.top + group_top if hasattr(shape, 'top') and shape.top else group_top
            
            if shape.shape_type == 6: # Group
                for sub_shape in shape.shapes:
                    traverse_shapes(sub_shape, left, top)
            elif shape.shape_type == 13: # Picture
                w, h = shape.width, shape.height
                # Skip backgrounds / templates
                is_background = (w > slide_width * 0.95) or (h > slide_height * 0.95) or (w > slide_width * 0.8 and h > slide_height * 0.8)
                if is_background:
                    return
                # Skip tiny icons
                if w < slide_width * 0.02 or h < slide_height * 0.02:
                    return
                pictures.append({
                    'shape': shape,
                    'cx': left + w / 2,
                    'cy': top + h / 2
                })
            elif shape.has_text_frame:
                txt = clean_text(shape.text_frame.text)
                if not txt:
                    return
                code_match = code_pattern.search(txt)
                if code_match:
                    code = code_match.group(0).upper()
                    price_match = price_pattern.search(txt)
                    price = int(price_match.group(1)) if price_match else None
                    
                    # Clean the detail text (remove the code and price to get only descriptive text)
                    detail_lines = []
                    for line in shape.text_frame.text.split('\n'):
                        line_clean = clean_text(line)
                        if not line_clean:
                            continue
                        if code_pattern.search(line_clean) or price_pattern.search(line_clean):
                            continue
                        detail_lines.append(line_clean)
                    details = " | ".join(detail_lines)
                    
                    text_blocks.append({
                        'code': code,
                        'price': price,
                        'details': details,
                        'cx': left + shape.width / 2,
                        'cy': top + shape.height / 2
                    })
                    
        for shape in slide.shapes:
            traverse_shapes(shape)
            
        # 3. Match codes/prices to closest pictures on the slide
        used_pics = set()
        for tb in text_blocks:
            code = tb['code']
            price = tb['price']
            details = tb['details']
            
            # Find closest unused picture
            best_pic_idx = -1
            min_dist = float('inf')
            for idx, p in enumerate(pictures):
                if idx in used_pics:
                    continue
                dist = ((tb['cx'] - p['cx'])**2 + (tb['cy'] - p['cy'])**2)**0.5
                if dist < min_dist:
                    min_dist = dist
                    best_pic_idx = idx
            
            # Save product data
            if code not in existing_products:
                existing_products[code] = {
                    'code': code,
                    'category': category,
                    'subcategory': subcategory,
                    'material': detected_material or get_material_from_code(code) or get_material_from_text(code) or "Otros",
                    'details': details,
                    'price_mayoreo': None,
                    'price_cliente': None,
                    'has_image': False
                }
                
            prod = existing_products[code]
            
            # Set price
            if is_mayoreo:
                prod['price_mayoreo'] = price
            else:
                prod['price_cliente'] = price
                
            # If details is longer, update it
            if details and len(details) > len(prod['details']):
                prod['details'] = details
                
            # Extract and save image if it matched and we don't have it yet
            if best_pic_idx != -1 and not prod['has_image']:
                used_pics.add(best_pic_idx)
                pic = pictures[best_pic_idx]
                try:
                    image_blob = pic['shape'].image.blob
                    image_ext = pic['shape'].image.ext
                    
                    # Convert to WebP and compress
                    img = Image.open(io.BytesIO(image_blob))
                    img.thumbnail((600, 600), Image.Resampling.LANCZOS)
                    
                    # Target filename
                    img_filename = f"{code}.webp"
                    img_path = os.path.join(output_images_dir, img_filename)
                    
                    img.save(img_path, "WEBP", quality=80)
                    prod['has_image'] = True
                    prod['image'] = f"public/images/{img_filename}"
                except Exception as e:
                    print(f"Error saving image for {code} on slide {slide_num}: {e}")
                    
        if slide_num % 50 == 0 or slide_num == total_slides:
            print(f"  Processed {slide_num}/{total_slides} slides...")
            
    return existing_products

def find_file(folder, pattern_keywords):
    if not os.path.exists(folder):
        return None
    for name in os.listdir(folder):
        if name.startswith("~$") or not name.endswith(".pptx"):
            continue
        name_upper = name.upper()
        if all(kw.upper() in name_upper for kw in pattern_keywords):
            return os.path.join(folder, name)
    return None

if __name__ == "__main__":
    products = {}
    
    dir_mayoreo = os.path.join(base_dir, "catalogos", "CATALOGOS MAYOREO")
    dir_publico = os.path.join(base_dir, "catalogos", "CATALOGOS PUBLICO")
    
    # 1. Parse Mayoreo Catalogs (First Source of truth and Image extraction)
    collares_mayoreo = find_file(dir_mayoreo, ["collares", "mayoreo"]) or os.path.join(dir_mayoreo, "CATALOGO COLLARES MAYOREO.pptx")
    varios_mayoreo = find_file(dir_mayoreo, ["varios", "mayoreo"]) or os.path.join(dir_mayoreo, "CATALOGO VARIOS MAYOREO 7.pptx")
    
    products = extract_from_presentation(collares_mayoreo, is_mayoreo=True, is_collares=True, existing_products=products)
    products = extract_from_presentation(varios_mayoreo, is_mayoreo=True, is_collares=False, existing_products=products)
    
    # 2. Parse Clientes Catalogs (Retail price mapping)
    collares_clientes = find_file(dir_publico, ["collares", "cliente"]) or find_file(dir_publico, ["collares", "publico"]) or os.path.join(dir_publico, "CATALOGO COLLARES CLIENTES.pptx")
    varios_clientes = find_file(dir_publico, ["varios", "cliente"]) or find_file(dir_publico, ["varios", "publico"]) or os.path.join(dir_publico, "CATALOGO VARIOS CLIENTES.pptx")
    
    products = extract_from_presentation(collares_clientes, is_mayoreo=False, is_collares=True, existing_products=products)
    products = extract_from_presentation(varios_clientes, is_mayoreo=False, is_collares=False, existing_products=products)
    
    # 3. Post-process: handle missing client prices or wholesale prices (estimate/double/etc.)
    # In general, retail price = 2x wholesale price, or wholesale price = 0.5x retail price if one is missing.
    for code, p in products.items():
        if p['price_mayoreo'] is None and p['price_cliente'] is not None:
            p['price_mayoreo'] = round(p['price_cliente'] / 2)
        elif p['price_cliente'] is None and p['price_mayoreo'] is not None:
            p['price_cliente'] = p['price_mayoreo'] * 2
            
        # Clean up material representation
        if not p['material'] or p['material'] == "Otros":
            p['material'] = get_material_from_text(p['details']) or get_material_from_code(code) or "Aleación de Metales"
            
    # Save products list (JSON)
    products_list = list(products.values())
    output_json_path = os.path.join(output_data_dir, "products.json")
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(products_list, f, ensure_ascii=False, indent=2)
        
    # Save products list (JS variable for local file:// access)
    output_js_path = os.path.join(output_data_dir, "products_data.js")
    with open(output_js_path, 'w', encoding='utf-8') as f:
        f.write(f"window.PRODUCTS_DATA = {json.dumps(products_list, ensure_ascii=False, indent=2)};")
        
    print(f"\nCompleted! Total products extracted: {len(products_list)}")
    print(f"Products with images: {sum(1 for p in products_list if p['has_image'])}")
    print(f"JSON Database saved to: {output_json_path}")
    print(f"JS Database saved to: {output_js_path}")
