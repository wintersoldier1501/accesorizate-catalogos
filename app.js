// ==========================================================================
// APP LOGIC - ACCESORIZATE INTERACTIVE WEB CATALOG
// ==========================================================================

// Configuration
const CONFIG = {
    whatsappPhone: "", // Optional: Add phone number with country code, e.g. "5216181234567"
    minPurchaseMayoreo: 800,
    itemsPerPage: 24
};

// Application State
let products = [];
let filteredProducts = [];
let cart = {};
let activeCategory = 'all';
let activeMaterial = 'all';
let searchQuery = '';
let renderedCount = 0;
let mode = 'clientes'; // 'clientes' or 'mayoreo'
let lastSubcat = '';

// DOM Elements
const elements = {
    productsGrid: document.getElementById('products-grid'),
    searchInput: document.getElementById('search-input'),
    categoryFilters: document.getElementById('category-filters'),
    materialFilters: document.getElementById('material-filters'),
    cartToggleBtn: document.getElementById('cart-toggle-btn'),
    cartBadge: document.getElementById('cart-badge'),
    cartDrawer: document.getElementById('cart-drawer'),
    cartCloseBtn: document.getElementById('cart-close-btn'),
    cartItems: document.getElementById('cart-items'),
    cartTotalVal: document.getElementById('cart-total-val'),
    checkoutBtn: document.getElementById('checkout-btn'),
    minWarning: document.getElementById('min-warning'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalImage: document.getElementById('modal-image'),
    modalTitle: document.getElementById('modal-title'),
    modalDesc: document.getElementById('modal-desc'),
    modalClose: document.getElementById('modal-close'),
    modalAddToCart: document.getElementById('modal-add-to-cart')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Detect mode from body attribute
    mode = document.body.dataset.mode || 'clientes';
    
    // Initialize Firebase if configured
    if (window.isFirebaseConfigured && window.isFirebaseConfigured()) {
        try {
            firebase.initializeApp(window.firebaseConfig);
            window.db = firebase.firestore();
            console.log("Firebase initialized successfully in Catalog.");
        } catch (e) {
            console.error("Firebase initialization failed:", e);
        }
    }
    
    // Load Cart from localStorage
    loadCart();
    
    // Fetch Products Database
    fetchProducts();
    
    // Setup Event Listeners
    setupEventListeners();
});

// Fetch products from JSON database or local JS variable
async function fetchProducts() {
    // 1. Fetch from Firebase Firestore if available
    if (window.db) {
        console.log("Fetching products database from Firebase Firestore...");
        try {
            const querySnapshot = await window.db.collection("products").get();
            let fbProducts = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Filter active status in code to be consistent with admin panel controls
                if (data.active !== false) {
                    fbProducts.push(data);
                }
            });
            
            if (fbProducts.length > 0) {
                products = fbProducts;
                console.log(`Loaded ${products.length} products from Firebase.`);
                applyFilters();
                return;
            } else {
                console.warn("Firebase collection 'products' is empty. Falling back to local files.");
            }
        } catch (error) {
            console.error("Firebase fetch failed, falling back to local files:", error);
        }
    }

    // 2. Fallback to local productsData global variable
    if (window.productsData) {
        console.log("Loaded products database from local productsData variable.");
        products = window.productsData;
        applyFilters();
        return;
    }

    // 3. Fallback to PRODUCTS_DATA
    if (window.PRODUCTS_DATA) {
        console.log("Loaded products database from local PRODUCTS_DATA script tag.");
        products = window.PRODUCTS_DATA;
        applyFilters();
        return;
    }

    // 4. Fallback to local fetch of products.json
    try {
        const response = await fetch('public/data/products.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        products = await response.json();
        applyFilters();
    } catch (error) {
        console.error("Could not fetch products database:", error);
        elements.productsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #ff5555;">
                <h3>Error al cargar los catálogos</h3>
                <p>Por favor asegúrate de haber ejecutado el script de extracción de datos (extract_data.py) o de cargar la página mediante un servidor web local.</p>
            </div>
        `;
    }
}

// Setup all UI Event Listeners
function setupEventListeners() {
    // Search
    elements.searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        applyFilters();
    });
    
    // Category Filtering
    if (elements.categoryFilters) {
        elements.categoryFilters.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            
            elements.categoryFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = btn.dataset.category;
            applyFilters();
        });
    }
    
    // Material Filtering
    if (elements.materialFilters) {
        elements.materialFilters.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            
            elements.materialFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeMaterial = btn.dataset.material;
            applyFilters();
        });
    }
    
    // Cart Drawer Toggle
    elements.cartToggleBtn.addEventListener('click', toggleCartDrawer);
    elements.cartCloseBtn.addEventListener('click', toggleCartDrawer);
    
    // Checkout Button
    elements.checkoutBtn.addEventListener('click', handleCheckout);
    
    // Image Modal Close
    elements.modalClose.addEventListener('click', closeModal);
    elements.modalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) closeModal();
    });
    
    // Infinite Scroll
    window.addEventListener('scroll', () => {
        if (renderedCount >= filteredProducts.length) return;
        
        const threshold = 300; // px from bottom
        const distanceToBottom = document.documentElement.offsetHeight - (window.innerHeight + window.scrollY);
        
        if (distanceToBottom < threshold) {
            renderNextPage();
        }
    });
    
    // Print events to handle full product rendering
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
}

// Filter products based on search query, category, and material
function applyFilters() {
    // Helper to extract numeric part of product code
    const getCodeNumber = (code) => {
        const match = code.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    };

    if (activeCategory === 'all' && searchQuery === '') {
        // Homepage Browse View (Todos / no search)
        // 1. Get all active standard products (excluding Personalized and Niñas)
        const standardProducts = products.filter(p => {
            if (p.active === false) return false;
            
            const isPersonalized = p.is_personalized === true || (['Collares', 'Llaveros'].includes(p.category) && p.subcategory === 'Personalizados') ||
                                   (p.details && p.details.toLowerCase().includes('graba'));
            const isNiña = p.category === 'Accesorios para Niña';
            
            return !isPersonalized && !isNiña;
        });

        // 2. Sort the entire list by newness (manually created first, then by code number descending)
        standardProducts.sort((a, b) => {
            const timeA = a.created_at || 0;
            const timeB = b.created_at || 0;
            if (timeA > 0 && timeB > 0) return timeB - timeA;
            if (timeA > 0) return -1;
            if (timeB > 0) return 1;
            return getCodeNumber(b.code) - getCodeNumber(a.code);
        });

        // 3. Mark all of them with displaySubcategory = 'NUEVO' so they display under a single 'NUEVO' header
        filteredProducts = standardProducts.map(p => ({
            ...p,
            displaySubcategory: 'NUEVO'
        }));

        // Apply Material filter if active
        if (activeMaterial !== 'all') {
            filteredProducts = filteredProducts.filter(p => {
                return (p.material && p.material.toLowerCase().includes(activeMaterial.toLowerCase())) ||
                       (activeMaterial === 'Otros' && p.material && !['Acero Inoxidable', 'Chapa de Oro'].some(m => p.material.includes(m)));
            });
        }
    } else {
        // Standard category view or search view
        filteredProducts = products.filter(p => {
            if (p.active === false) return false;

            const isPersonalized = p.is_personalized === true || (['Collares', 'Llaveros'].includes(p.category) && p.subcategory === 'Personalizados') ||
                                   (p.details && p.details.toLowerCase().includes('graba'));

            // Search match (code or details)
            const matchesSearch = searchQuery === '' || 
                                  p.code.toLowerCase().includes(searchQuery) || 
                                  (p.details && p.details.toLowerCase().includes(searchQuery));
                                  
            // Category match
            const matchesCategory = activeCategory === 'all' || 
                                    (activeCategory.toLowerCase() === 'personalizados' ? 
                                        isPersonalized : 
                                        (activeCategory.toLowerCase() === 'hombre' ? 
                                            (p.is_mens === true || p.subcategory === 'Accesorios Hombre' || p.subcategory === 'Hombre') : 
                                            p.category.toLowerCase() === activeCategory.toLowerCase()));
                                    
            // Material match
            const matchesMaterial = activeMaterial === 'all' || 
                                    (p.material && p.material.toLowerCase().includes(activeMaterial.toLowerCase())) ||
                                    (activeMaterial === 'Otros' && p.material && !['Acero Inoxidable', 'Chapa de Oro'].some(m => p.material.includes(m)));
                                    
            return matchesSearch && matchesCategory && matchesMaterial;
        });

        // Remove displaySubcategory to use original PowerPoint subcategory grouping
        filteredProducts = filteredProducts.map(p => {
            const { displaySubcategory, ...rest } = p;
            return rest;
        });
    }
    
    // Reset Grid
    elements.productsGrid.innerHTML = '';
    renderedCount = 0;
    lastSubcat = ''; // Reset global subcategory tracking on filter change
    
    // Render first page
    renderNextPage();
}

// Render the next page of products (for lazy loading)
function renderNextPage() {
    const startIdx = renderedCount;
    const endIdx = Math.min(startIdx + CONFIG.itemsPerPage, filteredProducts.length);
    
    if (startIdx >= filteredProducts.length) {
        if (filteredProducts.length === 0) {
            elements.productsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
                    <p>No se encontraron productos que coincidan con los filtros seleccionados.</p>
                </div>
            `;
        }
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    // We group items under subcategory sections if rendering general view without search
    
    for (let i = startIdx; i < endIdx; i++) {
        const prod = filteredProducts[i];
        
        // Only use displaySubcategory (like 'NUEVO') for headers, ignore raw subcategory
        const displaySubcat = prod.displaySubcategory;
        // Render header if it changes and it exists (only when not searching)
        if (searchQuery === '' && displaySubcat && displaySubcat !== lastSubcat) {
            lastSubcat = displaySubcat;
            
            // To prevent creating separate section divs inside the grid, we can insert a full-width header
            const headerDiv = document.createElement('div');
            headerDiv.className = 'section-header';
            headerDiv.style.gridColumn = '1 / -1';
            headerDiv.innerHTML = `<h2 class="section-title">${displaySubcat}</h2>`;
            fragment.appendChild(headerDiv);
        }
        
        const card = createProductCard(prod);
        fragment.appendChild(card);
    }
    
    elements.productsGrid.appendChild(fragment);
    renderedCount = endIdx;
}

// Helper to get singular uppercase label for a product (e.g. COLLAR - AX2482-G)
function getProductLabel(product) {
    const cat = (product.category || '').toLowerCase();
    
    // For kid's accessories, it's not necessary to prepend a label, just show the code
    if (cat.includes('niña') || cat.includes('niña')) {
        return product.code;
    }
    
    let label = '';
    if (cat.includes('collar')) label = 'COLLAR';
    else if (cat.includes('arete')) label = 'ARETE';
    else if (cat.includes('piercing')) label = 'PIERCING';
    else if (cat.includes('anillo')) label = 'ANILLO';
    else if (cat.includes('pulsera')) label = 'PULSERA';
    
    if (label) {
        return `${label} - ${product.code}`;
    }
    
    return product.code;
}

// Create a Product Card HTML element
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.code = product.code;
    
    const price = mode === 'mayoreo' ? product.price_mayoreo : product.price_cliente;
    const imageSrc = product.has_image ? product.image : 'public/images/placeholder.webp';
    
    card.innerHTML = `
        <div class="image-container">
            <img class="product-image" src="${imageSrc}" alt="${product.code}" loading="lazy">
            <span class="material-tag">${product.material}</span>
        </div>
        <div class="product-info">
            <div class="product-header">
                <span class="product-code">${getProductLabel(product)}</span>
                <span class="product-price">$${price}</span>
            </div>
            ${product.details && product.details.trim() ? `<div class="product-details">${product.details}</div>` : ''}
            <button class="add-to-cart-btn">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1zm3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4h-3.5zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5z"/>
                </svg>
                Agregar al Pedido
            </button>
        </div>
    `;
    
    // Add Click Listeners
    const imgContainer = card.querySelector('.image-container');
    imgContainer.addEventListener('click', () => openModal(product));
    
    const addToCartBtn = card.querySelector('.add-to-cart-btn');
    addToCartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isPersonalized = product.is_personalized === true || (['Collares', 'Llaveros'].includes(product.category) && product.subcategory === 'Personalizados') ||
                               (product.details && product.details.toLowerCase().includes('graba')) ||
                               product.multi_aritos === true || product.requires_initial === true;
        
        if (isPersonalized) {
            openModal(product);
            return;
        }
        
        addToCart(product.code);
        
        // Add visual success feedback
        const prevText = addToCartBtn.innerHTML;
        addToCartBtn.style.backgroundColor = '#4caf50';
        addToCartBtn.style.color = '#ffffff';
        addToCartBtn.innerHTML = '¡Agregado!';
        setTimeout(() => {
            addToCartBtn.style.backgroundColor = '';
            addToCartBtn.style.color = '';
            addToCartBtn.innerHTML = prevText;
        }, 1000);
    });
    
    return card;
}

// Render dynamic customization fields based on product settings
function renderCustomizationFields(product, price, customSection) {
    const isMultiAritos = product.multi_aritos === true;
    
    if (isMultiAritos) {
        customSection.innerHTML = `
            <div class="custom-field">
                <label for="aritos-count" style="font-weight: 600; color: var(--gold-primary);">Cantidad de Aros:</label>
                <select id="aritos-count" style="padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 1rem; width: 100%; cursor: pointer;">
                    <option value="2">2 Aros (Incluidos en la compra)</option>
                    <option value="3">3 Aros (1 Aro Extra +$49)</option>
                    <option value="4">4 Aros (2 Aros Extras +$98)</option>
                    <option value="5">5 Aros (3 Aros Extras +$147)</option>
                </select>
            </div>
            <div id="aritos-inputs-container" style="display: flex; flex-direction: column; gap: 0.8rem; margin: 0.8rem 0;"></div>
            <div class="custom-field">
                <label style="font-weight: 600; color: var(--gold-primary);">Tipografía (Estilo de letra):</label>
                <div id="custom-font" class="font-dropdown-container">
                    <div class="font-dropdown-trigger font-basica">
                        <span class="font-dropdown-text">1. Básica</span>
                        <span class="font-dropdown-arrow">&#9662;</span>
                    </div>
                    <div class="font-radio-group" style="display: none;">
                        <label class="font-radio-option font-basica"><input type="radio" name="font-pick" value="1. Básica" checked> 1. Básica</label>
                        <label class="font-radio-option font-moderna"><input type="radio" name="font-pick" value="2. Moderna"> 2. Moderna</label>
                        <label class="font-radio-option font-cursiva"><input type="radio" name="font-pick" value="3. Cursiva"> 3. Cursiva</label>
                        <label class="font-radio-option font-manuscrita"><input type="radio" name="font-pick" value="4. Manuscrita"> 4. Manuscrita</label>
                        <label class="font-radio-option font-mayuscula"><input type="radio" name="font-pick" value="5. MAYÚSCULA"> 5. MAYÚSCULA</label>
                        <label class="font-radio-option font-romantica"><input type="radio" name="font-pick" value="6. Romantica"> 6. Romántica</label>
                        <label class="font-radio-option font-maquina"><input type="radio" name="font-pick" value="7. Máquina de escribir"> 7. Máquina de escribir</label>
                        <label class="font-radio-option font-italica"><input type="radio" name="font-pick" value="8. Itálica"> 8. Itálica</label>
                    </div>
                </div>
            </div>
        `;
        
        const aritosCountSelect = customSection.querySelector('#aritos-count');
        const aritosInputsContainer = customSection.querySelector('#aritos-inputs-container');
        
        function updateAritosInputs() {
            const count = parseInt(aritosCountSelect.value);
            
            // Capture existing input values to avoid losing what the user typed
            const existingValues = [];
            const inputElements = aritosInputsContainer.querySelectorAll('input');
            inputElements.forEach(inp => {
                existingValues.push(inp.value);
            });
            
            aritosInputsContainer.innerHTML = '';
            for (let i = 1; i <= count; i++) {
                const isExtra = i > 2;
                const labelText = isExtra ? `Texto Grabado Aro ${i} (Aro Extra +$49):` : `Texto Grabado Aro ${i} (Incluido):`;
                const placeholder = `Nombre o iniciales para el aro ${i}...`;
                const val = existingValues[i - 1] || '';
                
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'custom-field';
                fieldDiv.style.margin = '0';
                fieldDiv.innerHTML = `
                    <label for="arito-text-${i}" style="font-size: 0.75rem; color: #ffffff; font-weight: normal;">${labelText}</label>
                    <input type="text" id="arito-text-${i}" placeholder="${placeholder}" value="${val}" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background-color: var(--bg-card); color: var(--text-primary); font-size: 0.85rem; width: 100%;">
                `;
                aritosInputsContainer.appendChild(fieldDiv);
            }
            
            // Update dynamic price display in modal title
            const extraPrice = (count - 2) * 49;
            elements.modalTitle.textContent = `${getProductLabel(product)} - $${price + extraPrice}`;
        }
        
        aritosCountSelect.addEventListener('change', updateAritosInputs);
        updateAritosInputs(); // Initial build
        
    } else {
        // Standard personalization
        customSection.innerHTML = `
            <div class="custom-field">
                <label for="custom-text">Texto para Grabado (nombres, fechas, iniciales):</label>
                <input type="text" id="custom-text" placeholder="Escribe el nombre o texto a grabar...">
            </div>
            <div class="custom-field">
                <label style="font-weight: 600; color: var(--gold-primary);">Tipografía (Estilo de letra):</label>
                <div id="custom-font" class="font-dropdown-container">
                    <div class="font-dropdown-trigger font-basica">
                        <span class="font-dropdown-text">1. Básica</span>
                        <span class="font-dropdown-arrow">&#9662;</span>
                    </div>
                    <div class="font-radio-group" style="display: none;">
                        <label class="font-radio-option font-basica"><input type="radio" name="font-pick" value="1. Básica" checked> 1. Básica</label>
                        <label class="font-radio-option font-moderna"><input type="radio" name="font-pick" value="2. Moderna"> 2. Moderna</label>
                        <label class="font-radio-option font-cursiva"><input type="radio" name="font-pick" value="3. Cursiva"> 3. Cursiva</label>
                        <label class="font-radio-option font-manuscrita"><input type="radio" name="font-pick" value="4. Manuscrita"> 4. Manuscrita</label>
                        <label class="font-radio-option font-mayuscula"><input type="radio" name="font-pick" value="5. MAYÚSCULA"> 5. MAYÚSCULA</label>
                        <label class="font-radio-option font-romantica"><input type="radio" name="font-pick" value="6. Romantica"> 6. Romántica</label>
                        <label class="font-radio-option font-maquina"><input type="radio" name="font-pick" value="7. Máquina de escribir"> 7. Máquina de escribir</label>
                        <label class="font-radio-option font-italica"><input type="radio" name="font-pick" value="8. Itálica"> 8. Itálica</label>
                    </div>
                </div>
            </div>
        `;
        // Make sure it resets to base price
        elements.modalTitle.textContent = `${getProductLabel(product)} - $${price}`;
    }
    
    // Setup radio typography styling bindings
    const fontContainer = customSection.querySelector('#custom-font');
    if (fontContainer) {
        const fontGroup = fontContainer.querySelector('.font-radio-group');
        const trigger = fontContainer.querySelector('.font-dropdown-trigger');
        const triggerText = trigger.querySelector('.font-dropdown-text');
        const radios = fontContainer.querySelectorAll('input[type=radio]');
        
        // Initialize the selected class for the initially checked radio
        const checkedRadio = fontGroup.querySelector('input[type=radio]:checked');
        if (checkedRadio) {
            checkedRadio.parentElement.classList.add('font-radio-selected');
            triggerText.textContent = checkedRadio.parentElement.textContent.trim();
            trigger.className = `font-dropdown-trigger ${checkedRadio.parentElement.classList[1]}`;
        }
        
        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = fontGroup.style.display === 'flex' || fontGroup.style.display === 'block';
            fontGroup.style.display = isVisible ? 'none' : 'flex';
            trigger.classList.toggle('open', !isVisible);
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!fontContainer.contains(e.target)) {
                fontGroup.style.display = 'none';
                trigger.classList.remove('open');
            }
        });
        
        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                fontGroup.querySelectorAll('.font-radio-option').forEach(l => l.classList.remove('font-radio-selected'));
                radio.parentElement.classList.add('font-radio-selected');
                
                // Update trigger text and font class
                triggerText.textContent = radio.parentElement.textContent.trim();
                trigger.className = `font-dropdown-trigger ${radio.parentElement.classList[1]}`;
                
                // Close dropdown
                fontGroup.style.display = 'none';
                trigger.classList.remove('open');
            });
        });
    }
}

// Open Lightbox Modal for a product
function openModal(product) {
    const price = mode === 'mayoreo' ? product.price_mayoreo : product.price_cliente;
    const imageSrc = product.has_image ? product.image : 'public/images/placeholder.webp';
    
    // Clean up any existing carousel container
    const existingCarousel = elements.modalOverlay.querySelector('.modal-carousel-container');
    if (existingCarousel) {
        existingCarousel.remove();
    }
    
    const modalLeft = elements.modalOverlay.querySelector('.modal-left');
    
    // Setup carousel or single image inside modal-left
    const images = product.images || [];
    if (images.length > 1) {
        elements.modalImage.style.display = 'none';
        
        let currentImgIdx = 0;
        
        const carouselContainer = document.createElement('div');
        carouselContainer.className = 'modal-carousel-container';
        carouselContainer.style.position = 'relative';
        carouselContainer.style.width = '100%';
        carouselContainer.style.display = 'flex';
        carouselContainer.style.alignItems = 'center';
        carouselContainer.style.justifyContent = 'center';
        carouselContainer.style.overflow = 'hidden';
        carouselContainer.style.maxHeight = '55vh';
        
        const carouselImg = document.createElement('img');
        carouselImg.className = 'modal-image';
        carouselImg.src = images[currentImgIdx];
        carouselImg.style.maxWidth = '100%';
        carouselImg.style.maxHeight = '55vh';
        carouselImg.style.objectFit = 'contain';
        carouselImg.style.borderRadius = '8px';
        carouselImg.style.boxShadow = '0 10px 40px rgba(0,0,0,0.8)';
        carouselImg.style.border = '1px solid var(--border-color)';
        
        function showImage(idx) {
            currentImgIdx = (idx + images.length) % images.length;
            carouselImg.src = images[currentImgIdx];
            dots.forEach((dot, dIdx) => {
                dot.style.background = dIdx === currentImgIdx ? 'var(--gold-primary)' : 'rgba(255,255,255,0.5)';
            });
        }
        
        // Left Arrow
        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.innerHTML = '&#10094;';
        prevBtn.style.position = 'absolute';
        prevBtn.style.left = '15px';
        prevBtn.style.background = 'rgba(0,0,0,0.6)';
        prevBtn.style.color = '#fff';
        prevBtn.style.border = 'none';
        prevBtn.style.width = '40px';
        prevBtn.style.height = '40px';
        prevBtn.style.borderRadius = '50%';
        prevBtn.style.cursor = 'pointer';
        prevBtn.style.fontSize = '1.2rem';
        prevBtn.style.display = 'flex';
        prevBtn.style.alignItems = 'center';
        prevBtn.style.justifyContent = 'center';
        prevBtn.style.zIndex = '5';
        prevBtn.style.transition = 'background 0.2s';
        prevBtn.onmouseover = () => prevBtn.style.background = 'rgba(0,0,0,0.8)';
        prevBtn.onmouseout = () => prevBtn.style.background = 'rgba(0,0,0,0.6)';
        prevBtn.addEventListener('click', () => showImage(currentImgIdx - 1));
        
        // Right Arrow
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.innerHTML = '&#10095;';
        nextBtn.style.position = 'absolute';
        nextBtn.style.right = '15px';
        nextBtn.style.background = 'rgba(0,0,0,0.6)';
        nextBtn.style.color = '#fff';
        nextBtn.style.border = 'none';
        nextBtn.style.width = '40px';
        nextBtn.style.height = '40px';
        nextBtn.style.borderRadius = '50%';
        nextBtn.style.cursor = 'pointer';
        nextBtn.style.fontSize = '1.2rem';
        nextBtn.style.display = 'flex';
        nextBtn.style.alignItems = 'center';
        nextBtn.style.justifyContent = 'center';
        nextBtn.style.zIndex = '5';
        nextBtn.style.transition = 'background 0.2s';
        nextBtn.onmouseover = () => nextBtn.style.background = 'rgba(0,0,0,0.8)';
        nextBtn.onmouseout = () => nextBtn.style.background = 'rgba(0,0,0,0.6)';
        nextBtn.addEventListener('click', () => showImage(currentImgIdx + 1));
        
        // Dots
        const dotsContainer = document.createElement('div');
        dotsContainer.style.position = 'absolute';
        dotsContainer.style.bottom = '15px';
        dotsContainer.style.display = 'flex';
        dotsContainer.style.gap = '8px';
        dotsContainer.style.zIndex = '5';
        
        const dots = [];
        images.forEach((_, idx) => {
            const dot = document.createElement('div');
            dot.style.width = '8px';
            dot.style.height = '8px';
            dot.style.borderRadius = '50%';
            dot.style.background = idx === 0 ? 'var(--gold-primary)' : 'rgba(255,255,255,0.5)';
            dot.style.cursor = 'pointer';
            dot.style.transition = 'background 0.2s';
            dot.addEventListener('click', () => showImage(idx));
            dotsContainer.appendChild(dot);
            dots.push(dot);
        });
        
        carouselContainer.appendChild(prevBtn);
        carouselContainer.appendChild(carouselImg);
        carouselContainer.appendChild(nextBtn);
        carouselContainer.appendChild(dotsContainer);
        
        modalLeft.insertBefore(carouselContainer, elements.modalImage);
    } else {
        elements.modalImage.style.display = 'block';
        elements.modalImage.src = imageSrc;
    }
    
    elements.modalTitle.textContent = `${getProductLabel(product)} - $${price}`;
    elements.modalDesc.textContent = product.details && product.details.trim() ? `${product.material} | ${product.details}` : product.material;
    
    // Setup Customization inputs dynamically
    const isPersonalized = product.is_personalized === true || (['Collares', 'Llaveros'].includes(product.category) && product.subcategory === 'Personalizados') ||
                           (product.details && product.details.toLowerCase().includes('graba')) ||
                           product.multi_aritos === true || product.requires_initial === true;
    
    const modalRight = elements.modalOverlay.querySelector('.modal-right');
    let customSection = modalRight.querySelector('.customization-section');
    if (!customSection) {
        customSection = document.createElement('div');
        customSection.className = 'customization-section';
        modalRight.insertBefore(customSection, elements.modalAddToCart);
    }
    
    if (product.requires_initial) {
        customSection.style.display = 'block';
        let options = '';
        for (let i = 0; i < 26; i++) {
            const letter = String.fromCharCode(65 + i);
            options += `<option value="${letter}">${letter}</option>`;
        }
        customSection.innerHTML = `
            <div class="custom-field">
                <label for="custom-initial" style="font-weight: 600; color: var(--gold-primary);">Elige la Inicial:</label>
                <select id="custom-initial" style="padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 1rem; width: 100%; cursor: pointer; background: var(--bg-card); color: var(--text-primary);">
                    ${options}
                </select>
            </div>
        `;
        elements.modalTitle.textContent = `${getProductLabel(product)} - $${price}`;
    } else if (isPersonalized) {
        customSection.style.display = 'block';
        renderCustomizationFields(product, price, customSection);
    } else {
        customSection.style.display = 'none';
        elements.modalTitle.textContent = `${getProductLabel(product)} - $${price}`;
    }
    
    // Setup Add to Cart button inside modal
    elements.modalAddToCart.onclick = () => {
        let customText = '';
        let customFont = '';
        let aritosCount = 2;
        
        if (isPersonalized && customSection) {
            if (product.requires_initial === true) {
                const initSelect = customSection.querySelector('#custom-initial');
                customText = initSelect ? `Inicial elegida: ${initSelect.value}` : '';
                customFont = 'N/A';
            } else if (product.multi_aritos === true) {
                const fontGroupEl = customSection.querySelector('#custom-font');
                const checkedRadio = fontGroupEl ? fontGroupEl.querySelector('input[type=radio]:checked') : null;
                customFont = checkedRadio ? checkedRadio.value : '1. Básica';
                
                const countSelect = customSection.querySelector('#aritos-count');
                aritosCount = parseInt(countSelect.value);
                
                const texts = [];
                for (let i = 1; i <= aritosCount; i++) {
                    const inp = customSection.querySelector(`#arito-text-${i}`);
                    const val = inp ? inp.value.trim() : '';
                    texts.push(val || '(Sin grabar)');
                }
                customText = texts.join(' | ');
            } else {
                const fontGroupEl = customSection.querySelector('#custom-font');
                const checkedRadio = fontGroupEl ? fontGroupEl.querySelector('input[type=radio]:checked') : null;
                customFont = checkedRadio ? checkedRadio.value : '1. Básica';
                
                const textInp = customSection.querySelector('#custom-text');
                customText = textInp ? textInp.value.trim() : '';
            }
        }
        
        addToCart(product.code, customText, customFont, aritosCount);
        closeModal();
    };
    
    elements.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock scrolling
}

// Close Lightbox Modal
function closeModal() {
    elements.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Shopping Cart Management
function addToCart(code, customText = '', customFont = '', aritosCount = 2) {
    const cleanText = customText.trim();
    const key = cleanText ? `${code}__${cleanText}__${customFont}__${aritosCount}` : code;
    
    if (cart[key]) {
        cart[key].qty++;
    } else {
        cart[key] = {
            code: code,
            qty: 1,
            customText: cleanText,
            customFont: customFont,
            aritosCount: aritosCount
        };
    }
    updateCartUI();
    saveCart();
}

function removeFromCart(key) {
    delete cart[key];
    updateCartUI();
    saveCart();
}

function updateQty(key, qty) {
    if (qty <= 0) {
        removeFromCart(key);
    } else {
        if (cart[key]) {
            cart[key].qty = qty;
            updateCartUI();
            saveCart();
        }
    }
}

function updateCartUI() {
    // Clear current items
    elements.cartItems.innerHTML = '';
    
    let totalItems = 0;
    let totalPrice = 0;
    
    const itemKeys = Object.keys(cart);
    
    if (itemKeys.length === 0) {
        elements.cartItems.innerHTML = '<div class="empty-cart-msg">Tu pedido está vacío. Explora el catálogo y agrega piezas.</div>';
        elements.cartBadge.style.display = 'none';
    } else {
        elements.cartBadge.style.display = 'inline-block';
        
        itemKeys.forEach(key => {
            const item = cart[key];
            const product = products.find(p => p.code === item.code);
            if (!product) return;
            
            const qty = item.qty;
            const basePrice = mode === 'mayoreo' ? product.price_mayoreo : product.price_cliente;
            const extraPrice = product.multi_aritos === true ? (item.aritosCount - 2) * 49 : 0;
            const price = basePrice + extraPrice;
            const itemTotal = price * qty;
            
            totalItems += qty;
            totalPrice += itemTotal;
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            
            const imageSrc = product.has_image ? product.image : 'public/images/placeholder.webp';
            
            let customDetailsHTML = '';
            if (item.customText) {
                if (product.multi_aritos === true) {
                    const arosList = item.customText.split(' | ').map((text, idx) => `<span>Aro ${idx+1}: "${text}"</span>`).join('');
                    customDetailsHTML = `
                        <div class="cart-item-custom-info">
                            <span style="font-weight: bold;">💍 Aros: ${item.aritosCount}</span>
                            ${arosList}
                            <span>🔤 Letra: ${item.customFont}</span>
                        </div>
                    `;
                } else {
                    if (item.customFont === 'N/A') {
                        customDetailsHTML = `
                            <div class="cart-item-custom-info">
                                <span>🏷️ ${item.customText}</span>
                            </div>
                        `;
                    } else {
                        customDetailsHTML = `
                            <div class="cart-item-custom-info">
                                <span>✍️ Grabado: "${item.customText}"</span>
                                <span>🔤 Letra: ${item.customFont}</span>
                            </div>
                        `;
                    }
                }
            }
            
            itemDiv.innerHTML = `
                <img class="cart-item-img" src="${imageSrc}" alt="${product.code}">
                <div class="cart-item-info">
                    <div class="cart-item-code">${product.code}</div>
                    <div class="cart-item-price">$${price} c/u</div>
                    ${customDetailsHTML}
                    <div class="cart-item-qty">
                        <button class="qty-btn minus">-</button>
                        <span class="qty-val">${qty}</span>
                        <button class="qty-btn plus">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" title="Eliminar">×</button>
            `;
            
            // Wire listeners
            itemDiv.querySelector('.qty-btn.minus').onclick = () => updateQty(key, qty - 1);
            itemDiv.querySelector('.qty-btn.plus').onclick = () => updateQty(key, qty + 1);
            itemDiv.querySelector('.cart-item-remove').onclick = () => removeFromCart(key);
            
            elements.cartItems.appendChild(itemDiv);
        });
    }
    
    // Update Badge and Totals
    elements.cartBadge.textContent = totalItems;
    elements.cartTotalVal.textContent = `$${totalPrice}`;
    
    // Check Wholesale Rules
    if (mode === 'mayoreo') {
        if (totalPrice < CONFIG.minPurchaseMayoreo) {
            elements.minWarning.style.display = 'block';
            elements.minWarning.textContent = `Mínimo de compra para mayoreo: $${CONFIG.minPurchaseMayoreo} MXN (Faltan $${CONFIG.minPurchaseMayoreo - totalPrice})`;
            elements.checkoutBtn.disabled = true;
            elements.checkoutBtn.style.opacity = '0.5';
        } else {
            elements.minWarning.style.display = 'none';
            elements.checkoutBtn.disabled = false;
            elements.checkoutBtn.style.opacity = '1';
        }
    } else {
        elements.minWarning.style.display = 'none';
        elements.checkoutBtn.disabled = false;
        elements.checkoutBtn.style.opacity = '1';
    }
}

function toggleCartDrawer() {
    elements.cartDrawer.classList.toggle('active');
}

function saveCart() {
    localStorage.setItem(`cart_${mode}`, JSON.stringify(cart));
}

function loadCart() {
    const saved = localStorage.getItem(`cart_${mode}`);
    if (saved) {
        try {
            cart = JSON.parse(saved);
            // Migrate old cart structure if necessary
            let migrated = false;
            for (const key in cart) {
                if (typeof cart[key] === 'number') {
                    cart[key] = {
                        code: key,
                        qty: cart[key],
                        customText: '',
                        customFont: ''
                    };
                    migrated = true;
                }
            }
            if (migrated) {
                saveCart();
            }
            updateCartUI();
        } catch (e) {
            cart = {};
        }
    }
}

// Generate and open WhatsApp message link
function handleCheckout() {
    const itemKeys = Object.keys(cart);
    if (itemKeys.length === 0) return;
    
    let message = `*Hola! Me interesa cotizar/pedir los siguientes artículos de su catálogo:* \n\n`;
    let total = 0;
    
    itemKeys.forEach(key => {
        const item = cart[key];
        const product = products.find(p => p.code === item.code);
        if (!product) return;
        
        const qty = item.qty;
        const basePrice = mode === 'mayoreo' ? product.price_mayoreo : product.price_cliente;
        const extraPrice = product.multi_aritos === true ? (item.aritosCount - 2) * 49 : 0;
        const price = basePrice + extraPrice;
        const subtotal = price * qty;
        total += subtotal;
        
        let customInfo = '';
        if (item.customText) {
            if (product.multi_aritos === true) {
                customInfo = ` [💍 Aros: ${item.aritosCount} | Grabados: '${item.customText}' | Letra: ${item.customFont}]`;
            } else {
                if (item.customFont === 'N/A') {
                    customInfo = ` [${item.customText}]`;
                } else {
                    customInfo = ` [Grabado: '${item.customText}' / Letra: ${item.customFont}]`;
                }
            }
        }
        
        message += `• *${qty}x* ${product.code}${customInfo} (${product.material}) - $${price} c/u (Sub: $${subtotal})\n`;
    });
    
    message += `\n*Total estimado: $${total} MXN*\n`;
    
    if (mode === 'mayoreo') {
        message += `\n_Pedido mayorista para Accesorizate. Agradezco me confirmen stock._`;
    }
    
    const encodedMessage = encodeURIComponent(message);
    const phone = CONFIG.whatsappPhone;
    
    let waUrl = "";
    if (phone) {
        waUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    } else {
        waUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
    }
    
    window.open(waUrl, '_blank');
}

// PDF Print Handlers
// Before printing, render ALL products currently matching filters (disable page-based lazy loading)
let scrollBackupCount = 0;
function handleBeforePrint() {
    scrollBackupCount = renderedCount;
    elements.productsGrid.innerHTML = '';
    
    // Temporarily render all currently filtered products in one shot
    const fragment = document.createDocumentFragment();
    let lastSubcat = '';
    
    filteredProducts.forEach(prod => {
        const displaySubcat = prod.displaySubcategory || prod.subcategory;
        if (displaySubcat && displaySubcat !== lastSubcat) {
            lastSubcat = displaySubcat;
            const headerDiv = document.createElement('div');
            headerDiv.className = 'section-header';
            headerDiv.style.gridColumn = '1 / -1';
            headerDiv.innerHTML = `<h2 class="section-title">${displaySubcat}</h2>`;
            fragment.appendChild(headerDiv);
        }
        
        const card = createProductCard(prod);
        fragment.appendChild(card);
    });
    
    elements.productsGrid.appendChild(fragment);
}

// Restore lazy loading view after printing finishes
function handleAfterPrint() {
    applyFilters();
}
