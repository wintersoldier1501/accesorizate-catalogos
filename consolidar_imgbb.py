import os
import re
import io
import sys
import json
import time
import shutil
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

PROJECT_ID = "catalogos-accesorizate"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(BASE_DIR, "public", "images")
DATA_DIR = os.path.join(BASE_DIR, "public", "data")
BACKUP_DIR = os.path.join(BASE_DIR, "scratch", "backups")
PENDING_FIRESTORE_FILE = os.path.join(BASE_DIR, "scratch", "pending_firestore_updates.json")


def parse_firestore_value(val):
    if not val:
        return None
    if "stringValue" in val:
        return val["stringValue"]
    if "integerValue" in val:
        return int(val["integerValue"])
    if "doubleValue" in val:
        return float(val["doubleValue"])
    if "booleanValue" in val:
        return bool(val["booleanValue"])
    if "nullValue" in val:
        return None
    if "arrayValue" in val:
        return [parse_firestore_value(v) for v in val["arrayValue"].get("values", [])]
    if "mapValue" in val:
        fields = val["mapValue"].get("fields", {})
        return {k: parse_firestore_value(v) for k, v in fields.items()}
    return None


def to_firestore_value(val):
    if val is None:
        return {"nullValue": None}
    if isinstance(val, bool):
        return {"booleanValue": val}
    if isinstance(val, int):
        return {"integerValue": str(val)}
    if isinstance(val, float):
        return {"doubleValue": val}
    if isinstance(val, str):
        return {"stringValue": val}
    if isinstance(val, list):
        return {"arrayValue": {"values": [to_firestore_value(v) for v in val]}}
    if isinstance(val, dict):
        return {"mapValue": {"fields": {k: to_firestore_value(v) for k, v in val.items()}}}
    return {"stringValue": str(val)}


def fetch_all_products():
    all_products = []
    page_token = ""
    while True:
        url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/products?pageSize=300"
        if page_token:
            url += f"&pageToken={urllib.parse.quote(page_token)}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        for doc in data.get("documents", []):
            fields = doc.get("fields", {})
            obj = {k: parse_firestore_value(v) for k, v in fields.items()}
            all_products.append(obj)
        page_token = data.get("nextPageToken", "")
        if not page_token:
            break
    return all_products


def download_and_convert_to_webp(url, dest_filename):
    os.makedirs(IMAGES_DIR, exist_ok=True)
    dest_path = os.path.join(IMAGES_DIR, dest_filename)
    # If already downloaded and valid, reuse it immediately
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 100:
        return f"public/images/{dest_filename}"

    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw_bytes = resp.read()
    img = Image.open(io.BytesIO(raw_bytes))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGBA")
    else:
        img = img.convert("RGB")
    img.thumbnail((800, 800), Image.Resampling.LANCZOS)
    img.save(dest_path, "WEBP", quality=82)
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 100:
        return f"public/images/{dest_filename}"
    raise RuntimeError(f"Archivo WebP inválido: {dest_path}")


def batch_commit_firestore(updated_products):
    commit_url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents:commit"
    batch_size = 400
    for i in range(0, len(updated_products), batch_size):
        chunk = updated_products[i : i + batch_size]
        writes = []
        for p in chunk:
            code = p["code"]
            doc_name = f"projects/{PROJECT_ID}/databases/(default)/documents/products/{code}"
            writes.append({
                "update": {
                    "name": doc_name,
                    "fields": {k: to_firestore_value(v) for k, v in p.items()}
                }
            })
        body = json.dumps({"writes": writes}).encode("utf-8")
        req = urllib.request.Request(
            commit_url,
            data=body,
            method="POST",
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Batch commit failed with HTTP {resp.status}")
        print(f"   -> Actualizados {min(i + batch_size, len(updated_products))} / {len(updated_products)} productos en Firestore...")


def update_catalog_meta():
    now_ms = int(time.time() * 1000)
    doc_url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/settings/catalog_meta"
    body = json.dumps({"fields": {"lastUpdated": {"integerValue": str(now_ms)}}}).encode("utf-8")
    req = urllib.request.Request(
        doc_url,
        data=body,
        method="PATCH",
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status == 200


def phase_download():
    print("1. Descargando lista de productos desde Firebase Firestore...")
    products = fetch_all_products()
    print(f"   -> Total de productos en la nube: {len(products)}")

    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts_str = time.strftime("%Y%m%d_%H%M%S")
    for fname in ("products.json", "products_data.js"):
        src = os.path.join(DATA_DIR, fname)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(BACKUP_DIR, f"{ts_str}_{fname}"))
    print(f"   -> Respaldo previo guardado en scratch/backups/{ts_str}_*")

    # Collect all unique ImgBB tasks: url -> dest_filename
    tasks = {}
    for p in products:
        code = str(p.get("code", "ITEM")).strip()
        safe_code = re.sub(r"[^A-Za-z0-9_-]", "_", code)

        main_img = p.get("image") or ""
        if isinstance(main_img, str) and "ibb.co" in main_img:
            tasks[main_img] = f"{safe_code}_main.webp"

        if isinstance(p.get("images"), list):
            for idx, img_url in enumerate(p["images"]):
                if isinstance(img_url, str) and "ibb.co" in img_url and img_url not in tasks:
                    tasks[img_url] = f"{safe_code}_gal_{idx}.webp"

        if isinstance(p.get("color_variants"), list):
            for v_idx, var in enumerate(p["color_variants"]):
                if isinstance(var, dict) and isinstance(var.get("image"), str) and "ibb.co" in var["image"]:
                    v_url = var["image"]
                    if v_url not in tasks:
                        tasks[v_url] = f"{safe_code}_var_{v_idx}.webp"

    print(f"2. Descargando y convirtiendo {len(tasks)} imágenes únicas de ImgBB a WebP (en paralelo)...")
    url_to_local = {}
    failed_urls = 0

    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_url = {
            executor.submit(download_and_convert_to_webp, url, fname): url
            for url, fname in tasks.items()
        }
        done_count = 0
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            done_count += 1
            try:
                local_rel = future.result()
                url_to_local[url] = local_rel
            except Exception as e:
                failed_urls += 1
                print(f"   [AVISO] Se conserva link original ({url}): {e}")
            if done_count % 50 == 0 or done_count == len(tasks):
                print(f"   -> Progreso: {done_count} / {len(tasks)} imágenes procesadas...")

    # Update product objects in memory for those that succeeded
    updated_products = []
    for p in products:
        changed = False
        main_img = p.get("image") or ""
        if main_img in url_to_local:
            p["image"] = url_to_local[main_img]
            changed = True

        if isinstance(p.get("images"), list):
            new_gal = []
            for img_url in p["images"]:
                if img_url in url_to_local:
                    new_gal.append(url_to_local[img_url])
                    changed = True
                else:
                    new_gal.append(img_url)
            p["images"] = new_gal

        if isinstance(p.get("color_variants"), list):
            for var in p["color_variants"]:
                if isinstance(var, dict) and var.get("image") in url_to_local:
                    var["image"] = url_to_local[var["image"]]
                    changed = True

        if changed:
            updated_products.append(p)

    # Save local master files (products.json and products_data.js)
    os.makedirs(DATA_DIR, exist_ok=True)
    json_path = os.path.join(DATA_DIR, "products.json")
    js_path = os.path.join(DATA_DIR, "products_data.js")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    with open(js_path, "w", encoding="utf-8") as f:
        f.write(f"window.PRODUCTS_DATA = {json.dumps(products, ensure_ascii=False, indent=2)};\n")

    # Save pending Firestore updates so we can commit AFTER firebase hosting deploy
    os.makedirs(os.path.dirname(PENDING_FIRESTORE_FILE), exist_ok=True)
    with open(PENDING_FIRESTORE_FILE, "w", encoding="utf-8") as f:
        json.dump(updated_products, f, ensure_ascii=False, indent=2)

    print("\n====================================================")
    print("FASE 1 (DESCARGA Y RESPALDO LOCAL) COMPLETADA:")
    print(f"- Productos totales respaldados: {len(products)}")
    print(f"- Imágenes WebP listas en public/images: {len(url_to_local)} (Fallidas: {failed_urls})")
    print(f"- Productos listos para actualizar link en Firestore: {len(updated_products)}")
    print("====================================================")


def phase_commit():
    if not os.path.exists(PENDING_FIRESTORE_FILE):
        print("No hay actualizaciones pendientes para Firestore.")
        return
    with open(PENDING_FIRESTORE_FILE, "r", encoding="utf-8") as f:
        updated_products = json.load(f)
    if not updated_products:
        print("0 productos pendientes por actualizar.")
        return
    print(f"Actualizando enlaces de {len(updated_products)} productos en Firestore en lotes...")
    batch_commit_firestore(updated_products)
    update_catalog_meta()
    os.remove(PENDING_FIRESTORE_FILE)
    print("¡FASE 2 COMPLETADA! Todos los productos en Firestore ahora apuntan a tu servidor.")


if __name__ == "__main__":
    mode_arg = sys.argv[1] if len(sys.argv) > 1 else "download"
    if mode_arg == "commit":
        phase_commit()
    else:
        phase_download()
