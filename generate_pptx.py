import os
import json
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from PIL import Image

# Directories setup
base_dir = r"c:\Users\Accesorizate1\Downloads\CAT"
data_json_path = os.path.join(base_dir, "public", "data", "products.json")
webp_images_dir = os.path.join(base_dir, "public", "images")
jpg_images_dir = os.path.join(base_dir, "public", "images_jpg")
logo_path = os.path.join(base_dir, "logo", "LOGO.png")

os.makedirs(jpg_images_dir, exist_ok=True)

# Color Constants
COLOR_BG_LIGHT = RGBColor(250, 249, 246)     # Alabaster (warm white)
COLOR_BG_DARK = RGBColor(26, 26, 26)         # Deep Charcoal
COLOR_GOLD = RGBColor(197, 160, 89)          # Muted Gold
COLOR_TEXT_DARK = RGBColor(40, 40, 40)       # Charcoal text
COLOR_TEXT_LIGHT = RGBColor(240, 240, 240)   # Off-white text
COLOR_TEXT_MUTED = RGBColor(120, 120, 120)   # Muted grey text

# Helper: Convert WebP to JPG for PPTX compatibility
def get_image_jpg(code):
    webp_path = os.path.join(webp_images_dir, f"{code}.webp")
    jpg_filename = f"{code}.jpg"
    jpg_path = os.path.join(jpg_images_dir, jpg_filename)
    
    # Check if jpg already exists
    if os.path.exists(jpg_path):
        return jpg_path
        
    # Check if webp source exists
    source_path = webp_path if os.path.exists(webp_path) else os.path.join(webp_images_dir, "placeholder.webp")
    
    if os.path.exists(source_path):
        try:
            img = Image.open(source_path)
            # Convert to RGB and save as JPG
            img.convert("RGB").save(jpg_path, "JPEG", quality=85)
            return jpg_path
        except Exception as e:
            print(f"Error converting {source_path} to JPG: {e}")
            
    return None

# Helper: Add title and headers to slides
def add_slide_header(slide, title_text, is_mayoreo):
    # Slide Title Text Box
    title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.7), Inches(0.6))
    tf = title_box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    
    p = tf.paragraphs[0]
    p.text = title_text.upper()
    p.font.name = "Georgia"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = COLOR_GOLD
    p.alignment = PP_ALIGN.LEFT
    
    # Optional Logo / Branding
    if is_mayoreo and os.path.exists(logo_path):
        logo_w = Inches(1.2)
        logo_h = Inches(0.4)
        slide.shapes.add_picture(logo_path, Inches(13.333 - 0.8 - 1.2), Inches(0.4), width=logo_w, height=logo_h)
        
    # Add a thin separator line below title
    # (Since adding straight shapes programmatically can be verbose, we can use a thin colored rectangle)
    line = slide.shapes.add_shape(1, Inches(0.8), Inches(0.95), Inches(11.733), Inches(0.015))
    line.fill.solid()
    line.fill.fore_color.rgb = COLOR_GOLD
    line.line.fill.background()

# Helper: Add cover page slide
def add_cover_slide(prs, title_text, subtitle_text, is_mayoreo):
    blank_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(blank_layout)
    
    # Set dark background
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = COLOR_BG_DARK
    
    # Add Logo if Mayoreo
    logo_offset_y = Inches(1.2)
    if is_mayoreo and os.path.exists(logo_path):
        logo_w = Inches(2.2)
        logo_h = Inches(0.8)
        slide.shapes.add_picture(logo_path, Inches(13.333/2 - 1.1), Inches(1.8), width=logo_w, height=logo_h)
        logo_offset_y = Inches(2.8)
        
    # Add Title Box
    title_box = slide.shapes.add_textbox(Inches(1.0), logo_offset_y + Inches(0.4), Inches(11.333), Inches(1.2))
    tf = title_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = title_text.upper()
    p.font.name = "Georgia"
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = COLOR_GOLD
    p.alignment = PP_ALIGN.CENTER
    
    # Add Subtitle Box
    subtitle_box = slide.shapes.add_textbox(Inches(1.0), logo_offset_y + Inches(1.6), Inches(11.333), Inches(0.8))
    tf_sub = subtitle_box.text_frame
    tf_sub.word_wrap = True
    p_sub = tf_sub.paragraphs[0]
    p_sub.text = subtitle_text.upper()
    p_sub.font.name = "Calibri"
    p_sub.font.size = Pt(16)
    p_sub.font.color.rgb = COLOR_TEXT_LIGHT
    p_sub.alignment = PP_ALIGN.CENTER

# Helper: Add Divider slide between sections
def add_divider_slide(prs, title_text, subtitle_text):
    blank_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(blank_layout)
    
    # Set dark background
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = COLOR_BG_DARK
    
    # Add Section Title
    title_box = slide.shapes.add_textbox(Inches(1.0), Inches(2.8), Inches(11.333), Inches(1.2))
    tf = title_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = title_text.upper()
    p.font.name = "Georgia"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = COLOR_GOLD
    p.alignment = PP_ALIGN.CENTER
    
    # Subtitle
    if subtitle_text:
        sub_box = slide.shapes.add_textbox(Inches(1.0), Inches(4.0), Inches(11.333), Inches(0.8))
        tf_sub = sub_box.text_frame
        tf_sub.word_wrap = True
        p_sub = tf_sub.paragraphs[0]
        p_sub.text = subtitle_text.upper()
        p_sub.font.name = "Calibri"
        p_sub.font.size = Pt(13)
        p_sub.font.color.rgb = COLOR_TEXT_MUTED
        p_sub.alignment = PP_ALIGN.CENTER

# Helper: Add Wholesale terms slides
def add_terms_slides(prs):
    blank_layout = prs.slide_layouts[6]
    
    # Slide 1: Mecánica de Compra
    slide1 = prs.slides.add_slide(blank_layout)
    slide1.background.fill.solid()
    slide1.background.fill.fore_color.rgb = COLOR_BG_LIGHT
    add_slide_header(slide1, "Mecánica de Compra", is_mayoreo=True)
    
    tb = slide1.shapes.add_textbox(Inches(1.0), Inches(1.5), Inches(11.333), Inches(4.8))
    tf = tb.text_frame
    tf.word_wrap = True
    
    def add_bullet(tf, title, desc):
        p = tf.add_paragraph() if len(tf.paragraphs[0].text) > 0 else tf.paragraphs[0]
        p.space_after = Pt(14)
        run_title = p.add_run()
        run_title.text = "•  " + title + ": "
        run_title.font.bold = True
        run_title.font.size = Pt(14)
        run_title.font.name = "Georgia"
        run_title.font.color.rgb = COLOR_GOLD
        
        run_desc = p.add_run()
        run_desc.text = desc
        run_desc.font.size = Pt(12)
        run_desc.font.name = "Calibri"
        run_desc.font.color.rgb = COLOR_TEXT_DARK
        
    add_bullet(tf, "Selecciona tus Modelos", "Elige las piezas de tu preferencia. En el catálogo verás los códigos de producto (ej: AX2286, CH1436).")
    add_bullet(tf, "Mínimo de Compra", "El monto mínimo de compra es de $800 pesos mexicanos para aplicar precio de mayoreo.")
    add_bullet(tf, "Realiza tu Pago", "Aceptamos transferencia electrónica o depósitos en Banorte, Wal-Mart, Sam's Club, Bodega Aurrera, OXXO, 7-Eleven, Farmacias Guadalajara, Chedraui y Soriana.")
    add_bullet(tf, "Envía tu Comprobante", "Envíanos foto legible de tu comprobante de pago por WhatsApp, junto con tu nombre y dirección completa de envío.")
    add_bullet(tf, "Recibe tu Guía de Rastreo", "Se te proporcionará tu número de guía al tercer día hábil de haberse acreditado tu depósito.")

    # Slide 2: Envíos e Información
    slide2 = prs.slides.add_slide(blank_layout)
    slide2.background.fill.solid()
    slide2.background.fill.fore_color.rgb = COLOR_BG_LIGHT
    add_slide_header(slide2, "Información de Envíos", is_mayoreo=True)
    
    tb2 = slide2.shapes.add_textbox(Inches(1.0), Inches(1.5), Inches(11.333), Inches(4.8))
    tf2 = tb2.text_frame
    tf2.word_wrap = True
    
    add_bullet(tf2, "Medio Envío Estafeta", "En compras mayores a $2200 MXN, solo pagas la mitad del costo de envío por Estafeta (entrega de 1 a 2 días hábiles).")
    add_bullet(tf2, "Envío Gratis Estafeta", "En compras mayores a $3000 MXN, ¡tu envío es gratis! (entrega estándar de 1 a 2 días hábiles).")
    add_bullet(tf2, "DHL Express Aéreo", "Servicio exprés por DHL Express con un costo fijo de $238 MXN (entrega garantizada de 1 a 2 días hábiles en zonas de cobertura normal).")
    add_bullet(tf2, "Entregas en Tienda Física (Sin Costo)", "Puedes recoger tu pedido en Durango, Dgo., en Teotihuacan #108 int. 1, Col. Vista Hermosa del Guadiana.")
    add_bullet(tf2, "Entregas a Domicilio en Durango", "Servicio a domicilio disponible en la ciudad de Durango por solo $50 MXN.")

# Main Presentation Creator Function
def generate_pptx_catalog(products_list, catalog_title, subtitle, output_name, is_mayoreo):
    print(f"Generating {output_name}...")
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]
    
    # 1. Add Cover slide
    add_cover_slide(prs, catalog_title, subtitle, is_mayoreo)
    
    # 2. Add Terms slides (Wholesale only)
    if is_mayoreo:
        add_terms_slides(prs)
        
    # 3. Group products by Subcategory
    subcat_map = {}
    for p in products_list:
        subcat = p['subcategory'] or 'General'
        if subcat not in subcat_map:
            subcat_map[subcat] = []
        subcat_map[subcat].append(p)
        
    # Define Grid dimensions for 2x2 layout on Widescreen (13.333" x 7.5")
    # Coordinates mapping
    grid_coords = [
        # (left, top)
        (Inches(0.8), Inches(1.3)),    # Top Left
        (Inches(6.8), Inches(1.3)),    # Top Right
        (Inches(0.8), Inches(4.3)),    # Bottom Left
        (Inches(6.8), Inches(4.3))     # Bottom Right
    ]
    
    img_size = Inches(2.2) # Square image
    
    # 4. Generate slides per Subcategory
    for subcat, prod_list in subcat_map.items():
        # Add section divider
        add_divider_slide(prs, subcat, catalog_title)
        
        # Paginate products (4 per slide)
        for i in range(0, len(prod_list), 4):
            slide = prs.slides.add_slide(blank_layout)
            slide.background.fill.solid()
            slide.background.fill.fore_color.rgb = COLOR_BG_LIGHT
            
            # Slide header
            add_slide_header(slide, subcat, is_mayoreo)
            
            chunk = prod_list[i:i+4]
            for idx, prod in enumerate(chunk):
                coords = grid_coords[idx]
                col_left, row_top = coords
                
                # Image shape position
                img_left = col_left + Inches(0.4)
                img_top = row_top
                
                # Text box position (aligned next to or under the image)
                # To make it look extremely clean, we place image on the left, and text on the right of the cell!
                # Cell size: width = 5.7", height = 2.6"
                # Image on left: 2.2" x 2.2"
                # Text box on right: 2.8" width, 2.2" height, vertically centered!
                text_left = col_left + Inches(2.8)
                text_top = row_top + Inches(0.2)
                
                # 1. Convert WebP image to JPG and insert
                jpg_path = get_image_jpg(prod['code'])
                if jpg_path and os.path.exists(jpg_path):
                    try:
                        slide.shapes.add_picture(jpg_path, img_left, img_top, width=img_size, height=img_size)
                    except Exception as e:
                        print(f"Error inserting image for {prod['code']}: {e}")
                
                # 2. Add editable Text Frame
                tb = slide.shapes.add_textbox(text_left, text_top, Inches(2.7), Inches(1.8))
                tf = tb.text_frame
                tf.word_wrap = True
                tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
                
                # Price depending on Mayoreo/Clientes
                price = prod['price_mayoreo'] if is_mayoreo else prod['price_cliente']
                
                # Code paragraph
                p_code = tf.paragraphs[0]
                p_code.space_after = Pt(2)
                p_code.text = f"Cód. {prod['code']}"
                p_code.font.name = "Calibri"
                p_code.font.size = Pt(12)
                p_code.font.bold = True
                p_code.font.color.rgb = COLOR_TEXT_DARK
                
                # Price paragraph
                p_price = tf.add_paragraph()
                p_price.space_after = Pt(4)
                p_price.text = f"${price} MXN"
                p_price.font.name = "Calibri"
                p_price.font.size = Pt(13)
                p_price.font.bold = True
                p_price.font.color.rgb = COLOR_GOLD
                
                # Details paragraph
                p_details = tf.add_paragraph()
                details_text = prod['details'] or ""
                material_text = prod['material'] or "Joyería"
                
                p_details.text = f"{material_text}\n{details_text[:60]}"
                p_details.font.name = "Calibri"
                p_details.font.size = Pt(9.5)
                p_details.font.color.rgb = COLOR_TEXT_MUTED
                
    # Save PPTX
    output_path = os.path.join(base_dir, output_name)
    prs.save(output_path)
    print(f"Successfully saved: {output_path}")

if __name__ == "__main__":
    # Load products database
    if not os.path.exists(data_json_path):
        print(f"Database products.json not found! Please run extract_data.py first.")
        exit(1)
        
    with open(data_json_path, 'r', encoding='utf-8') as f:
        all_products = json.load(f)
        
    print(f"Loaded {len(all_products)} products from database.")
    
    # Split products
    collares_products = [p for p in all_products if p['category'] == 'Collares']
    varios_products = [p for p in all_products if p['category'] != 'Collares']
    
    print(f"Collares: {len(collares_products)} items.")
    print(f"Varios (Aretes, Piercings, etc.): {len(varios_products)} items.")
    
    # Generate Mayoreo Presentations
    generate_pptx_catalog(
        products_list=collares_products,
        catalog_title="Catálogo de Collares",
        subtitle="Mayoreo 2026",
        output_name="CATALOGO COLLARES MAYOREO REDISEÑADO.pptx",
        is_mayoreo=True
    )
    
    generate_pptx_catalog(
        products_list=varios_products,
        catalog_title="Catálogo de Aretes, Piercings, Anillos y Pulseras",
        subtitle="Mayoreo 2026",
        output_name="CATALOGO VARIOS MAYOREO REDISEÑADO.pptx",
        is_mayoreo=True
    )
    
    # Generate Clientes (Retail) Presentations
    generate_pptx_catalog(
        products_list=collares_products,
        catalog_title="Catálogo de Collares",
        subtitle="Colección Joyería Fina",
        output_name="CATALOGO COLLARES CLIENTES REDISEÑADO.pptx",
        is_mayoreo=False
    )
    
    generate_pptx_catalog(
        products_list=varios_products,
        catalog_title="Colección Joyería Fina",
        subtitle="Aretes, Piercings, Anillos y Pulseras",
        output_name="CATALOGO VARIOS CLIENTES REDISEÑADO.pptx",
        is_mayoreo=False
    )
    
    print("\nAll redesigned presentations successfully generated!")
