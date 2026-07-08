import os
import re
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# Directories setup
base_dir = r"c:\Users\Accesorizate1\Downloads\CAT"

# Color Constants
COLOR_BG_PINK = RGBColor(249, 241, 239)      # Soft luxury rose alabaster
COLOR_BG_DARK = RGBColor(26, 26, 26)         # Deep Charcoal for portadas/section dividers
COLOR_GOLD = RGBColor(197, 160, 89)          # Gold accent
COLOR_TEXT_DARK = RGBColor(40, 40, 40)       # Dark charcoal text
COLOR_TEXT_MUTED = RGBColor(110, 110, 110)   # Muted grey
COLOR_CARD_WHITE = RGBColor(255, 255, 255)   # Pure white for product cards

code_pattern = re.compile(r'\b(AX|CH|LM|LA|DM|MY|RT|PS|HR|DK|ER|NS)\d+(?:-[A-Za-z0-9]+)?\b', re.IGNORECASE)

# Helper: Add brand header and gold line to slides
def apply_slide_branding(slide, title_text, is_mayoreo, logo_path, slide_width):
    # Slide Title Text Box
    title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(8.0), Inches(0.6))
    tf = title_box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    
    p = tf.paragraphs[0]
    p.text = title_text.upper()
    p.font.name = "Georgia"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = COLOR_GOLD
    p.alignment = PP_ALIGN.LEFT
    
    # Optional Brand Logo in header (Mayoreo only)
    if is_mayoreo and os.path.exists(logo_path):
        logo_w = Inches(1.2)
        logo_h = Inches(0.4)
        slide.shapes.add_picture(logo_path, Inches(13.333 - 0.8 - 1.2), Inches(0.4), width=logo_w, height=logo_h)
        
    # Gold separator line below header
    line = slide.shapes.add_shape(1, Inches(0.8), Inches(0.95), Inches(11.733), Inches(0.015))
    line.fill.solid()
    line.fill.fore_color.rgb = COLOR_GOLD
    line.line.fill.background()

# Helper: Redesign Cover Slides
def redesign_cover_slide(slide, is_mayoreo, logo_path, title_text, subtitle_text):
    # Set dark background
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = COLOR_BG_DARK
    
    # Clear all shapes
    for s in list(slide.shapes):
        slide.shapes._spTree.remove(s._element)
        
    # Logo
    offset_y = Inches(1.8)
    if is_mayoreo and os.path.exists(logo_path):
        slide.shapes.add_picture(logo_path, Inches(13.333/2 - 1.2), Inches(1.8), width=Inches(2.4), height=Inches(0.8))
        offset_y = Inches(2.9)
        
    # Add Title Box
    title_box = slide.shapes.add_textbox(Inches(1.0), offset_y, Inches(11.333), Inches(1.2))
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
    sub_box = slide.shapes.add_textbox(Inches(1.0), offset_y + Inches(1.3), Inches(11.333), Inches(0.8))
    tf_sub = sub_box.text_frame
    tf_sub.word_wrap = True
    p_sub = tf_sub.paragraphs[0]
    p_sub.text = subtitle_text.upper()
    p_sub.font.name = "Calibri"
    p_sub.font.size = Pt(15)
    p_sub.font.color.rgb = COLOR_TEXT_LIGHT = RGBColor(240, 240, 240)
    p_sub.alignment = PP_ALIGN.CENTER

# Helper: Redesign divider slides (section titles)
def redesign_divider_slide(slide, title_text, subtitle_text):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = COLOR_BG_DARK
    
    # Clear all shapes except title
    texts_found = []
    for s in list(slide.shapes):
        if s.has_text_frame:
            t = s.text_frame.text.strip()
            if t:
                texts_found.append(t)
        slide.shapes._spTree.remove(s._element)
        
    main_text = title_text if title_text else (" | ".join(texts_found) if texts_found else "Colección")
    
    # Add Section Title
    title_box = slide.shapes.add_textbox(Inches(1.0), Inches(2.8), Inches(11.333), Inches(1.2))
    tf = title_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = main_text.upper()
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

def redesign_catalog(src_path, dest_path, is_mayoreo, catalog_name):
    print(f"\nRedesigning {catalog_name} in-place...")
    if not os.path.exists(src_path):
        print(f"Source file not found: {src_path}")
        return
        
    prs = Presentation(src_path)
    slide_width = prs.slide_width
    slide_height = prs.slide_height
    logo_path = os.path.join(os.path.dirname(src_path), "..", "..", "logo", "LOGO.png")
    
    slides = list(prs.slides)
    total_slides = len(slides)
    
    for slide_idx, slide in enumerate(slides):
        slide_num = slide_idx + 1
        
        # 1. Identify and categorize shapes
        pictures = []
        text_boxes_code = []
        category_texts = []
        shapes_to_delete = []
        
        def traverse(shape, group_left=0, group_top=0):
            left = shape.left + group_left if hasattr(shape, 'left') and shape.left else group_left
            top = shape.top + group_top if hasattr(shape, 'top') and shape.top else group_top
            
            # Delete headers/footers in margins
            if top < Inches(1.1) or top > slide_height - Inches(0.8):
                shapes_to_delete.append(shape)
                return
                
            if shape.shape_type == 6: # Group
                for sub in shape.shapes:
                    traverse(sub, left, top)
            elif shape.shape_type == 13: # Picture
                w, h = shape.width, shape.height
                # Background templates
                if w > slide_width * 0.8 or h > slide_height * 0.8:
                    shapes_to_delete.append(shape)
                    return
                pictures.append({
                    'shape': shape,
                    'left': left,
                    'top': top,
                    'width': w,
                    'height': h,
                    'cx': left + w / 2,
                    'cy': top + h / 2
                })
            elif shape.has_text_frame:
                txt = shape.text_frame.text.strip()
                if not txt:
                    shapes_to_delete.append(shape)
                    return
                # Check for code matching
                if code_pattern.search(txt):
                    text_boxes_code.append({
                        'shape': shape,
                        'text': txt,
                        'left': left,
                        'top': top,
                        'width': shape.width,
                        'height': shape.height,
                        'cx': left + shape.width / 2,
                        'cy': top + shape.height / 2
                    })
                else:
                    category_texts.append(txt)
                    shapes_to_delete.append(shape) # We will replace category labels
            elif shape.shape_type == 1: # AutoShape (rectangles)
                shapes_to_delete.append(shape)

        for shape in list(slide.shapes):
            traverse(shape)
            
        # Delete elements
        for shape in shapes_to_delete:
            try:
                slide.shapes._spTree.remove(shape._element)
            except Exception:
                pass
                
        is_product_slide = len(text_boxes_code) > 0
        
        # Determine category title
        category_title = "Colección"
        for ct in category_texts:
            ct_upper = ct.upper()
            if "ACERO" in ct_upper or "CHAPA" in ct_upper or "ALEACION" in ct_upper or "PULSERA" in ct_upper or "ANILLO" in ct_upper or "ARETE" in ct_upper:
                category_title = ct
                break
                
        # 2. Redesign slide
        if slide_num == 1:
            # Title slide
            sub_title = "Mayoreo 2026" if is_mayoreo else "Colección Joyería Fina"
            redesign_cover_slide(slide, is_mayoreo, logo_path, catalog_name, sub_title)
            
        elif is_mayoreo and (slide_num == 2 or slide_num == 3):
            # Mechanics and Shipping slides (we clear them and re-insert them cleanly)
            slide.background.fill.solid()
            slide.background.fill.fore_color.rgb = COLOR_BG_PINK
            
            # The original content is already parsed and written by generate_pptx.py in new files.
            # For in-place, we just re-layout these two slides cleanly.
            slide.background.fill.solid()
            slide.background.fill.fore_color.rgb = COLOR_BG_PINK
            apply_slide_branding(slide, "Mecánica de Compra" if slide_num == 2 else "Envíos e Información", is_mayoreo, logo_path, slide_width)
            
            # We add a clean text box with stylized bullets
            tb = slide.shapes.add_textbox(Inches(1.0), Inches(1.5), Inches(11.333), Inches(4.8))
            tf = tb.text_frame
            tf.word_wrap = True
            
            def add_bullet(tf, title, desc):
                p = tf.add_paragraph() if len(tf.paragraphs[0].text) > 0 else tf.paragraphs[0]
                p.space_after = Pt(10)
                run_t = p.add_run()
                run_t.text = "•  " + title + ": "
                run_t.font.bold = True
                run_t.font.size = Pt(13)
                run_t.font.name = "Georgia"
                run_t.font.color.rgb = COLOR_GOLD
                
                run_d = p.add_run()
                run_d.text = desc
                run_d.font.size = Pt(11)
                run_d.font.name = "Calibri"
                run_d.font.color.rgb = COLOR_TEXT_DARK
                
            if slide_num == 2:
                add_bullet(tf, "Mínimo de Compra", "El monto mínimo es de $800 MXN para aplicar precios de mayoreo.")
                add_bullet(tf, "Métodos de Pago", "Depósitos en Banorte, Sam's Club, OXXO, Seven Eleven, Farmacias Guadalajara, Soriana y Chedraui.")
                add_bullet(tf, "Proceso de Pedido", "Envía foto de tu ticket de depósito y tu domicilio completo a nuestro WhatsApp.")
                add_bullet(tf, "Guía de Envío", "Se te comparte tu guía al tercer día de acreditado tu depósito.")
            else:
                add_bullet(tf, "Medio Envío Estafeta", "En compras mayores a $2200 MXN, solo pagas la mitad del costo de envío.")
                add_bullet(tf, "Envío Gratis", "¡Envío GRATIS por Estafeta en compras mayores a $3000 MXN!")
                add_bullet(tf, "DHL Express", "Envío exprés por DHL disponible por $238 MXN.")
                add_bullet(tf, "Entregas en Durango", "Entregas físicas en Durango en Teotihuacan #108 Vista Hermosa, o a domicilio por $50 MXN.")
                
        elif not is_product_slide:
            # Section divider slide
            redesign_divider_slide(slide, category_title, catalog_name)
            
        else:
            # Product slide
            slide.background.fill.solid()
            slide.background.fill.fore_color.rgb = COLOR_BG_PINK
            
            # Header
            apply_slide_branding(slide, category_title, is_mayoreo, logo_path, slide_width)
            
            # Arrange items
            if len(text_boxes_code) == 1:
                # 1 Product slide (could have 1 or 2 pictures)
                tb_info = text_boxes_code[0]
                tb = tb_info['shape']
                
                # Format text box
                for paragraph in tb.text_frame.paragraphs:
                    paragraph.font.name = "Calibri"
                    paragraph.font.size = Pt(12)
                    paragraph.font.bold = True
                    paragraph.font.color.rgb = COLOR_TEXT_DARK
                    paragraph.alignment = PP_ALIGN.CENTER
                    
                if len(pictures) == 1:
                    pic_info = pictures[0]
                    pic = pic_info['shape']
                    
                    # Aspect-ratio scaling
                    max_w = Inches(4.5)
                    max_h = Inches(4.2)
                    orig_w = pic_info['width']
                    orig_h = pic_info['height']
                    scale = min(max_w / orig_w, max_h / orig_h)
                    new_w = orig_w * scale
                    new_h = orig_h * scale
                    
                    pic.left = int(slide_width / 2 - new_w / 2)
                    pic.top = int(Inches(1.3) + (max_h - new_h) / 2)
                    pic.width = int(new_w)
                    pic.height = int(new_h)
                    
                    tb.left = int(Inches(3.0))
                    tb.top = int(Inches(5.6))
                    tb.width = int(Inches(7.33))
                    tb.height = int(Inches(0.8))
                    
                elif len(pictures) >= 2:
                    # Place side-by-side
                    max_w = Inches(4.0)
                    max_h = Inches(3.8)
                    for i, pic_info in enumerate(pictures[:2]):
                        pic = pic_info['shape']
                        orig_w = pic_info['width']
                        orig_h = pic_info['height']
                        scale = min(max_w / orig_w, max_h / orig_h)
                        new_w = orig_w * scale
                        new_h = orig_h * scale
                        
                        if i == 0:
                            pic.left = int(Inches(2.2) + (max_w - new_w) / 2)
                        else:
                            pic.left = int(Inches(7.0) + (max_w - new_w) / 2)
                            
                        pic.top = int(Inches(1.4) + (max_h - new_h) / 2)
                        pic.width = int(new_w)
                        pic.height = int(new_h)
                        
                    tb.left = int(Inches(3.0))
                    tb.top = int(Inches(5.6))
                    tb.width = int(Inches(7.33))
                    tb.height = int(Inches(0.8))
                    
            elif len(text_boxes_code) > 1:
                # Multiple products (Grid layout)
                used_pics = set()
                num_prods = len(text_boxes_code)
                cols = 2
                rows = (num_prods + 1) // 2
                
                cell_w = Inches(11.73) / cols
                cell_h = Inches(5.5) / rows
                
                for idx, tb_info in enumerate(text_boxes_code):
                    tb = tb_info['shape']
                    
                    # Format text
                    for paragraph in tb.text_frame.paragraphs:
                        paragraph.font.name = "Calibri"
                        paragraph.font.size = Pt(11)
                        paragraph.font.bold = True
                        paragraph.font.color.rgb = COLOR_TEXT_DARK
                        paragraph.alignment = PP_ALIGN.CENTER
                        
                    # Find closest picture
                    best_pic_idx = -1
                    min_dist = float('inf')
                    for p_idx, pic_info in enumerate(pictures):
                        if p_idx in used_pics:
                            continue
                        dist = ((tb_info['cx'] - pic_info['cx'])**2 + (tb_info['cy'] - pic_info['cy'])**2)**0.5
                        if dist < min_dist:
                            min_dist = dist
                            best_pic_idx = p_idx
                            
                    grid_r = idx // cols
                    grid_c = idx % cols
                    cell_left = Inches(0.8) + grid_c * cell_w
                    cell_top = Inches(1.3) + grid_r * cell_h
                    
                    # Draw a nice clean white card behind the product!
                    card = slide.shapes.add_shape(5, int(cell_left + Inches(0.1)), int(cell_top + Inches(0.1)), int(cell_w - Inches(0.2)), int(cell_h - Inches(0.2)))
                    card.fill.solid()
                    card.fill.fore_color.rgb = COLOR_CARD_WHITE
                    card.line.color.rgb = COLOR_GOLD
                    card.line.width = Pt(1)
                    
                    # Send card behind text/image
                    slide.shapes._spTree.remove(card._element)
                    slide.shapes._spTree.insert(2, card._element)
                    
                    if best_pic_idx != -1:
                        used_pics.add(best_pic_idx)
                        pic_info = pictures[best_pic_idx]
                        pic = pic_info['shape']
                        
                        max_w = cell_w - Inches(2.2) # Reserve space for text on the right
                        max_h = cell_h - Inches(0.4)
                        orig_w = pic_info['width']
                        orig_h = pic_info['height']
                        scale = min(max_w / orig_w, max_h / orig_h)
                        new_w = orig_w * scale
                        new_h = orig_h * scale
                        
                        pic.left = int(cell_left + Inches(0.3) + (max_w - new_w)/2)
                        pic.top = int(cell_top + Inches(0.2) + (max_h - new_h)/2)
                        pic.width = int(new_w)
                        pic.height = int(new_h)
                        
                        tb.left = int(cell_left + cell_w - Inches(2.2))
                        tb.top = int(cell_top + cell_h/2 - Inches(0.6))
                        tb.width = int(Inches(2.0))
                        tb.height = int(Inches(1.2))
                        
        if slide_num % 50 == 0 or slide_num == total_slides:
            print(f"  Processed {slide_num}/{total_slides} slides...")
            
    # Save redesigned PowerPoint
    prs.save(dest_path)
    print(f"Successfully saved redesigned file to: {dest_path}")

if __name__ == "__main__":
    # Base paths
    mayoreo_dir = os.path.join(base_dir, "catalogos", "CATALOGOS MAYOREO")
    publico_dir = os.path.join(base_dir, "catalogos", "CATALOGOS PUBLICO")
    
    # 1. CATALOGO COLLARES MAYOREO
    redesign_catalog(
        src_path=os.path.join(mayoreo_dir, "CATALOGO COLLARES MAYOREO.pptx"),
        dest_path=os.path.join(base_dir, "CATALOGO COLLARES MAYOREO REDISEÑADO.pptx"),
        is_mayoreo=True,
        catalog_name="Catálogo de Collares"
    )
    
    # 2. CATALOGO VARIOS MAYOREO
    redesign_catalog(
        src_path=os.path.join(mayoreo_dir, "CATALOGO VARIOS MAYOREO 7.pptx"),
        dest_path=os.path.join(base_dir, "CATALOGO VARIOS MAYOREO REDISEÑADO.pptx"),
        is_mayoreo=True,
        catalog_name="Catálogo de Accesorios"
    )
    
    # 3. CATALOGO COLLARES PUBLICO
    redesign_catalog(
        src_path=os.path.join(publico_dir, "CATALOGO COLLARES CLIENTES.pptx"),
        dest_path=os.path.join(base_dir, "CATALOGO COLLARES CLIENTES REDISEÑADO.pptx"),
        is_mayoreo=False,
        catalog_name="Catálogo de Collares"
    )
    
    # 4. CATALOGO VARIOS PUBLICO
    redesign_catalog(
        src_path=os.path.join(publico_dir, "CATALOGO VARIOS CLIENTES.pptx"),
        dest_path=os.path.join(base_dir, "CATALOGO VARIOS CLIENTES REDISEÑADO.pptx"),
        is_mayoreo=False,
        catalog_name="Colección Joyería Fina"
    )
    
    print("\nAll 4 catalogs have been redesigned in-place successfully!")
