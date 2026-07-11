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
        // Fetch Banner Settings first
        try {
            const bannerDoc = await window.db.collection("settings").doc("banner").get();
            if (bannerDoc.exists) {
                window.bannerSettings = bannerDoc.data();
            }
        } catch (error) {
            console.error("Error fetching banner settings:", error);
        }

        // Fetch Seasonal Settings
        try {
            const seasonalDoc = await window.db.collection("settings").doc("seasonal").get();
            if (seasonalDoc.exists) {
                window.seasonalSettings = seasonalDoc.data();
            }
        } catch (error) {
            console.error("Error fetching seasonal settings:", error);
        }

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
        window.showingSeasonalOnly = false;
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
            window.showingSeasonalOnly = false;
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
            window.showingSeasonalOnly = false;
            activeMaterial = btn.dataset.material;
            applyFilters();
        });
    }
    
    // Cart Drawer Toggle
    elements.cartToggleBtn.addEventListener('click', toggleCartDrawer);
    elements.cartCloseBtn.addEventListener('click', toggleCartDrawer);
    
    // Checkout Button
    if (elements.checkoutBtn) elements.checkoutBtn.addEventListener('click', handleCheckout);
    
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

    if (window.showingSeasonalOnly) {
        window.showCarousels = false;
        filteredProducts = products.filter(p => p.isSeasonal === true && p.active !== false).map(p => ({
            ...p,
            displaySubcategory: window.seasonalSettings?.title || 'Colección de Temporada'
        }));
    } else if (activeCategory === 'all' && searchQuery === '') {
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

        // Extract top 20 newest for Recién Llegados carousel (strictly highest code numbers)
        const sortedByCode = [...standardProducts].sort((a, b) => getCodeNumber(b.code) - getCodeNumber(a.code));
        window.homepageNewest = sortedByCode.slice(0, 20);
        
        // (Seasonal extraction logic moved to dedicated view)
        
        // Extract top 20 most viewed for Tendencias carousel
        const trending = [...standardProducts].sort((a, b) => (b.views || 0) - (a.views || 0));
        window.homepageTrending = trending.slice(0, 20);

        // 3. Mark all of them with displaySubcategory = 'CATÁLOGO COMPLETO'
        filteredProducts = standardProducts.map(p => ({
            ...p,
            displaySubcategory: 'CATÁLOGO COMPLETO'
        }));

        // Apply Material filter if active
        // Apply Material filter if active
        if (activeMaterial !== 'all') {
            filteredProducts = filteredProducts.filter(p => {
                return (p.material && p.material.toLowerCase().includes(activeMaterial.toLowerCase())) ||
                       (activeMaterial === 'Otros' && p.material && !['Acero Inoxidable', 'Chapa de Oro'].some(m => p.material.includes(m)));
            });
            window.showCarousels = false;
        } else {
            window.showCarousels = true;
        }
    } else {
        window.showCarousels = false;
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
    
    // Inject Carousels on Homepage
    if (startIdx === 0 && window.showCarousels) {
        
        // Hero Banner
        if (window.bannerSettings && window.bannerSettings.active && window.bannerSettings.image) {
            const heroWrap = document.createElement('div');
            heroWrap.style.gridColumn = '1 / -1';
            
            let btnHtml = '';
            if (window.bannerSettings.showBtn) {
                btnHtml = `<button class="hero-btn" onclick="window.showingSeasonalOnly = true; applyFilters(); document.getElementById('products-grid').scrollIntoView({behavior: 'smooth'})">Ver Colección</button>`;
            } else if (window.bannerSettings.link) {
                btnHtml = `<button class="hero-btn" onclick="document.getElementById('search-input').value='${window.bannerSettings.link}'; document.getElementById('search-input').dispatchEvent(new Event('input'))">Ver Colección</button>`;
            }

            let titleHtml = '';
            if (window.bannerSettings.title) {
                titleHtml = `<h2 class="hero-title">${window.bannerSettings.title}</h2>`;
            }

            const posnY = window.bannerSettings.positionY !== undefined ? window.bannerSettings.positionY : 50;
            heroWrap.innerHTML = `
                <div class="hero-banner ${titleHtml ? 'has-overlay' : ''}" style="background-image: url('${window.bannerSettings.image}'); background-position: center ${posnY}%;">
                    <div class="hero-content">
                        ${titleHtml}
                        ${btnHtml}
                    </div>
                </div>
            `;
            fragment.appendChild(heroWrap);
        }

        // Seasonal Carousel removed per request, now in dedicated view

        // Recién Llegados Carousel
        const newHeaderDiv = document.createElement('div');
        newHeaderDiv.className = 'section-header';
        newHeaderDiv.style.gridColumn = '1 / -1';
        newHeaderDiv.style.marginTop = '0';
        newHeaderDiv.innerHTML = `<h2 class="section-title">Recién Llegados</h2>`;
        fragment.appendChild(newHeaderDiv);

        const newCarouselWrap = document.createElement('div');
        newCarouselWrap.style.gridColumn = '1 / -1';
        const newCarousel = document.createElement('div');
        newCarousel.className = 'horizontal-carousel';
        if (window.homepageNewest) {
            window.homepageNewest.forEach(prod => {
                newCarousel.appendChild(createProductCard(prod));
            });
        }
        newCarouselWrap.appendChild(newCarousel);
        fragment.appendChild(newCarouselWrap);

        // Tendencias Carousel
        const trendHeaderDiv = document.createElement('div');
        trendHeaderDiv.className = 'section-header';
        trendHeaderDiv.style.gridColumn = '1 / -1';
        trendHeaderDiv.innerHTML = `<h2 class="section-title">Más Vistos</h2>`;
        fragment.appendChild(trendHeaderDiv);

        const trendCarouselWrap = document.createElement('div');
        trendCarouselWrap.style.gridColumn = '1 / -1';
        const trendCarousel = document.createElement('div');
        trendCarousel.className = 'horizontal-carousel';
        if (window.homepageTrending) {
            window.homepageTrending.forEach(prod => {
                trendCarousel.appendChild(createProductCard(prod));
            });
        }
        trendCarouselWrap.appendChild(trendCarousel);
        fragment.appendChild(trendCarouselWrap);
    }

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
    const mainImg = card.querySelector('.product-image');
    
    const activeVariants = (product.color_variants || []).filter(v => v.in_stock !== false);
    if (activeVariants.length > 1) {
        // Find a different active variant image to use for hover
        const hoverVar = activeVariants.find(v => v.image && v.image !== imageSrc) || activeVariants[1];
        if (hoverVar && hoverVar.image) {
            const hoverSrc = hoverVar.image;
            imgContainer.addEventListener('mouseenter', () => { mainImg.src = hoverSrc; });
            imgContainer.addEventListener('mouseleave', () => { mainImg.src = imageSrc; });
        }
    }
    
    imgContainer.addEventListener('click', () => openModal(product));
    
    const addToCartBtn = card.querySelector('.add-to-cart-btn');
    addToCartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const hasVariants = product.color_variants && product.color_variants.length > 0;
        const isPersonalized = product.is_personalized === true || (['Collares', 'Llaveros'].includes(product.category) && product.subcategory === 'Personalizados') ||
                               (product.details && product.details.toLowerCase().includes('graba')) ||
                               product.multi_aritos === true || product.multi_plaquitas === true || product.requires_initial === true || hasVariants;
        
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
    const isMultiPlaquitas = product.multi_plaquitas === true;
    
    if (isMultiAritos || isMultiPlaquitas) {
        const itemType = isMultiAritos ? 'Aros' : 'Plaquitas';
        const itemTypeSingular = isMultiAritos ? 'Aro' : 'Plaquita';
        const maxItems = 5;
        const baseItems = isMultiAritos ? 2 : 1;
        const extraPriceMayoreo = isMultiAritos ? (product.aritos_price_mayoreo || 0) : (product.plaquitas_price_mayoreo || 0);
        const extraPriceCliente = isMultiAritos ? (product.aritos_price_cliente || 0) : (product.plaquitas_price_cliente || 0);
        const unitExtraPrice = mode === 'mayoreo' ? extraPriceMayoreo : extraPriceCliente;

        let optionsHtml = '';
        for (let i = baseItems; i <= maxItems; i++) {
            if (i === baseItems) {
                optionsHtml += `<option value="${i}">${i} ${itemType} (Incluidos en la compra)</option>`;
            } else {
                const extraCount = i - baseItems;
                optionsHtml += `<option value="${i}">${i} ${itemType} (${extraCount} ${itemTypeSingular} Extra +$${extraCount * unitExtraPrice})</option>`;
            }
        }
        
        customSection.innerHTML = `
            <div class="custom-field">
                <label for="aritos-count" style="font-weight: 600; color: var(--gold-primary);">Cantidad de ${itemType}:</label>
                <select id="aritos-count" style="padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 1rem; width: 100%; cursor: pointer;">
                    ${optionsHtml}
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
            
            const existingValues = [];
            const inputElements = aritosInputsContainer.querySelectorAll('input');
            inputElements.forEach(inp => {
                existingValues.push(inp.value);
            });
            
            aritosInputsContainer.innerHTML = '';
            for (let i = 1; i <= count; i++) {
                const isExtra = i > baseItems;
                const labelText = isExtra ? `Texto Grabado ${itemTypeSingular} ${i} (${itemTypeSingular} Extra +$${unitExtraPrice}):` : `Texto Grabado ${itemTypeSingular} ${i} (Incluido):`;
                const placeholder = `Nombre o iniciales para ${itemTypeSingular.toLowerCase()} ${i}...`;
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
            
            const extraPriceTotal = (count - baseItems) * unitExtraPrice;
            elements.modalTitle.textContent = `${getProductLabel(product)} - $${price + extraPriceTotal}`;
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

function renderExtraKidsFields(product, price, customSection) {
    const extraPriceMayoreo = product.extra_kid_price_mayoreo || 0;
    const extraPriceCliente = product.extra_kid_price_cliente || 0;
    const extraPrice = mode === 'mayoreo' ? extraPriceMayoreo : extraPriceCliente;
    
    const extraDiv = document.createElement('div');
    extraDiv.style.marginTop = '1rem';
    extraDiv.style.paddingTop = '1rem';
    extraDiv.style.borderTop = '1px solid var(--border-color)';
    
    const optionsBoys = Array.from({length: 6}, (_, i) => `<option value="${i}">${i} niño${i!==1?'s':''} ${i>0 ? '(+$' + (i*extraPrice) + ')' : ''}</option>`).join('');
    const optionsGirls = Array.from({length: 6}, (_, i) => `<option value="${i}">${i} niña${i!==1?'s':''} ${i>0 ? '(+$' + (i*extraPrice) + ')' : ''}</option>`).join('');
    
    extraDiv.innerHTML = `
        <div style="font-weight: 600; color: var(--gold-primary); margin-bottom: 0.8rem; font-size: 0.95rem;">
            Agregar Dijes Extra (+$${extraPrice} c/u):
        </div>
        <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
            <div style="flex: 1;">
                <label for="extra-boys" style="font-size: 0.8rem; color: #ccc;">Niños extra:</label>
                <select id="extra-boys" style="padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.9rem; width: 100%; cursor: pointer; background: var(--bg-card); color: var(--text-primary);">
                    ${optionsBoys}
                </select>
            </div>
            <div style="flex: 1;">
                <label for="extra-girls" style="font-size: 0.8rem; color: #ccc;">Niñas extra:</label>
                <select id="extra-girls" style="padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.9rem; width: 100%; cursor: pointer; background: var(--bg-card); color: var(--text-primary);">
                    ${optionsGirls}
                </select>
            </div>
        </div>
    `;
    
    customSection.appendChild(extraDiv);
    
    const boysSelect = extraDiv.querySelector('#extra-boys');
    const girlsSelect = extraDiv.querySelector('#extra-girls');
    
    const updateTitlePrice = () => {
        const extraB = parseInt(boysSelect.value) || 0;
        const extraG = parseInt(girlsSelect.value) || 0;
        let baseExtra = 0;
        const count = parseInt(document.getElementById('aritos-count')?.value || (product.multi_aritos ? 2 : 1));
        if (product.multi_aritos === true) {
            const unit = mode === 'mayoreo' ? (product.aritos_price_mayoreo||0) : (product.aritos_price_cliente||0);
            baseExtra = (count - 2) * unit;
        } else if (product.multi_plaquitas === true) {
            const unit = mode === 'mayoreo' ? (product.plaquitas_price_mayoreo||0) : (product.plaquitas_price_cliente||0);
            baseExtra = (count - 1) * unit;
        }
        const total = price + baseExtra + ((extraB + extraG) * extraPrice);
        elements.modalTitle.textContent = `${getProductLabel(product)} - $${total}`;
    };
    
    boysSelect.addEventListener('change', updateTitlePrice);
    girlsSelect.addEventListener('change', updateTitlePrice);
}

// Open Lightbox Modal for a product
function openModal(product) {
    // Increment views in Firebase silently
    if (window.db && product && product.code) {
        window.db.collection('products').doc(product.code).set(
            { views: firebase.firestore.FieldValue.increment(1) },
            { merge: true }
        ).catch(err => console.error("Error incrementing views:", err));
    }

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
        carouselImg.id = 'dynamic-modal-img';
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
        elements.modalImage.id = 'dynamic-modal-img';
        elements.modalImage.src = imageSrc;
    }
    
    elements.modalTitle.textContent = `${getProductLabel(product)} - $${price}`;
    elements.modalDesc.textContent = product.details && product.details.trim() ? `${product.material} | ${product.details}` : product.material;

    const modalRight = elements.modalOverlay.querySelector('.modal-right');
    
    // Setup color variants
    let variantSection = modalRight.querySelector('.variant-section');
    if (variantSection) variantSection.remove();
    
    window.currentSelectedVariant = null;

    if (product.color_variants && product.color_variants.length > 0) {
        variantSection = document.createElement('div');
        variantSection.className = 'variant-section';
        variantSection.style.marginBottom = '1.5rem';
        
        let swatchesHTML = '';
        let firstAvailableIdx = -1;
        
        product.color_variants.forEach((v, idx) => {
            const isStock = v.in_stock !== false;
            if (isStock && firstAvailableIdx === -1) firstAvailableIdx = idx;
        });
        
        if (firstAvailableIdx === -1) firstAvailableIdx = 0; // fallback if all are out of stock
        
        product.color_variants.forEach((v, idx) => {
            const isStock = v.in_stock !== false;
            const isActive = idx === firstAvailableIdx;
            
            let btnStyle = `padding: 0.4rem 0.8rem; margin-right: 0.5rem; margin-bottom: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; transition: all 0.2s; `;
            
            if (isStock) {
                btnStyle += `cursor: pointer; background: ${isActive?'var(--gold-primary)':'var(--bg-card)'}; color: ${isActive?'#fff':'var(--text-primary)'};`;
            } else {
                btnStyle += `cursor: not-allowed; background: var(--bg-card); color: #999; text-decoration: line-through; opacity: 0.6;`;
            }
            
            swatchesHTML += `<button type="button" class="variant-swatch" data-idx="${idx}" data-stock="${isStock}" style="${btnStyle}">${v.name}</button>`;
        });
        
        const initialVariant = product.color_variants[firstAvailableIdx];
        
        variantSection.innerHTML = `
            <div style="font-weight: 600; color: var(--gold-primary); margin-bottom: 0.5rem;">Color: <span id="variant-label" style="color: var(--text-primary); font-weight: 400;">${initialVariant.name}${initialVariant.in_stock === false ? ' (Agotado)' : ''}</span></div>
            <div style="display: flex; flex-wrap: wrap;">${swatchesHTML}</div>
        `;
        
        window.currentSelectedVariant = initialVariant.name;
        
        // If variants exist and have images, we make sure the first available variant image is shown
        if (initialVariant.image) {
            setTimeout(() => {
                const imgEl = document.getElementById('dynamic-modal-img');
                if (imgEl) imgEl.src = initialVariant.image;
            }, 10);
        }
        
        modalRight.insertBefore(variantSection, modalRight.firstChild); // Insert at the top of modal right
        
        const swatches = variantSection.querySelectorAll('.variant-swatch');
        swatches.forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.stock === 'false') return; // Do nothing if out of stock
                
                swatches.forEach(b => {
                    if (b.dataset.stock === 'true') {
                        b.style.background = 'var(--bg-card)';
                        b.style.color = 'var(--text-primary)';
                    }
                });
                btn.style.background = 'var(--gold-primary)';
                btn.style.color = '#fff';
                
                const idx = parseInt(btn.dataset.idx);
                const variant = product.color_variants[idx];
                document.getElementById('variant-label').textContent = variant.name;
                window.currentSelectedVariant = variant.name;
                
                const imgEl = document.getElementById('dynamic-modal-img');
                if (imgEl && variant.image) {
                    imgEl.src = variant.image;
                }
            });
        });
    }
    
    // Setup Customization inputs dynamically
    const isPersonalized = product.is_personalized === true || (['Collares', 'Llaveros'].includes(product.category) && product.subcategory === 'Personalizados') ||
                           (product.details && product.details.toLowerCase().includes('graba')) ||
                           product.multi_aritos === true || product.multi_plaquitas === true || product.requires_initial === true;
    
    const hasCustomization = isPersonalized || product.allows_extra_kids === true;
    
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
    } else if (hasCustomization) {
        customSection.style.display = 'block';
        customSection.innerHTML = '';
        
        if (isPersonalized) {
            renderCustomizationFields(product, price, customSection);
        } else {
            elements.modalTitle.textContent = `${getProductLabel(product)} - $${price}`;
        }
        
        if (product.allows_extra_kids === true) {
            renderExtraKidsFields(product, price, customSection);
        }
    } else {
        customSection.style.display = 'none';
        elements.modalTitle.textContent = `${getProductLabel(product)} - $${price}`;
    }
    
    // Setup Add to Cart button inside modal
    elements.modalAddToCart.onclick = () => {
        let customText = '';
        let customFont = '';
        let aritosCount = 2;
        let extraBoys = 0;
        let extraGirls = 0;
        
        if (product.allows_extra_kids === true && customSection) {
            const boysSelect = customSection.querySelector('#extra-boys');
            const girlsSelect = customSection.querySelector('#extra-girls');
            extraBoys = boysSelect ? parseInt(boysSelect.value) || 0 : 0;
            extraGirls = girlsSelect ? parseInt(girlsSelect.value) || 0 : 0;
        }
        
        if (isPersonalized && customSection) {
            if (product.requires_initial === true) {
                const initSelect = customSection.querySelector('#custom-initial');
                customText = initSelect ? `Inicial elegida: ${initSelect.value}` : '';
                customFont = 'N/A';
            } else if (product.multi_aritos === true || product.multi_plaquitas === true) {
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
        
        if (window.currentSelectedVariant) {
            customText = `[Color: ${window.currentSelectedVariant}] ` + customText;
        }
        
        addToCart(product.code, customText, customFont, aritosCount, extraBoys, extraGirls);
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
function addToCart(code, customText = '', customFont = '', aritosCount = 2, extraBoys = 0, extraGirls = 0) {
    const cleanText = customText.trim();
    const key = cleanText ? `${code}__${cleanText}__${customFont}__${aritosCount}__${extraBoys}__${extraGirls}` : `${code}__${extraBoys}__${extraGirls}`;
    
    if (cart[key]) {
        cart[key].qty++;
    } else {
        cart[key] = {
            code: code,
            qty: 1,
            customText: cleanText,
            customFont: customFont,
            aritosCount: aritosCount,
            extraBoys: extraBoys,
            extraGirls: extraGirls
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
            let extraPrice = 0;
            if (product.multi_aritos === true) {
                const unit = mode === 'mayoreo' ? (product.aritos_price_mayoreo||0) : (product.aritos_price_cliente||0);
                extraPrice = (item.aritosCount - 2) * unit;
            } else if (product.multi_plaquitas === true) {
                const unit = mode === 'mayoreo' ? (product.plaquitas_price_mayoreo||0) : (product.plaquitas_price_cliente||0);
                extraPrice = (item.aritosCount - 1) * unit;
            }
            const price = basePrice + extraPrice;
            const itemTotal = price * qty;
            
            totalItems += qty;
            totalPrice += itemTotal;
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            
            const imageSrc = product.has_image ? product.image : 'public/images/placeholder.webp';
            
            let customDetailsHTML = '';
            if (item.customText) {
                if (product.multi_aritos === true || product.multi_plaquitas === true) {
                    const itemTypeSing = product.multi_aritos ? 'Aro' : 'Plaquita';
                    const itemTypePlu = product.multi_aritos ? 'Aros' : 'Plaquitas';
                    const arosList = item.customText.split(' | ').map((text, idx) => `<span>${itemTypeSing} ${idx+1}: "${text}"</span>`).join('');
                    customDetailsHTML = `
                        <div class="cart-item-custom-info">
                            <span style="font-weight: bold;">💍 ${itemTypePlu}: ${item.aritosCount}</span>
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
    
    // Check Shipping Rules
    let shipping = 0;
    if (mode === 'mayoreo') {
        if (totalPrice > 0 && totalPrice < 2000) {
            shipping = 238;
        } else if (totalPrice >= 2000 && totalPrice < 3000) {
            shipping = 119;
        } else {
            shipping = 0; // Gratis
        }
    }
    
    let shippingRow = document.getElementById('cart-shipping-row');
    let shippingVal = document.getElementById('cart-shipping-val');
    let finalTotalRow = document.getElementById('cart-final-total-row');
    let finalTotalVal = document.getElementById('cart-final-total-val');
    
    // Dynamically inject if missing (to bypass cached HTML)
    if (!shippingRow) {
        const cartFooter = document.querySelector('.cart-footer');
        if (cartFooter) {
            const minWarning = document.getElementById('min-warning');
            
            shippingRow = document.createElement('div');
            shippingRow.id = 'cart-shipping-row';
            shippingRow.className = 'cart-total-row';
            shippingRow.style.cssText = 'display: none; font-size: 0.95rem; margin-top: 0.5rem; color: #555;';
            shippingRow.innerHTML = '<span class="cart-total-label">Envío:</span><span class="cart-total-val" id="cart-shipping-val">$0</span>';
            cartFooter.insertBefore(shippingRow, minWarning);
            
            finalTotalRow = document.createElement('div');
            finalTotalRow.id = 'cart-final-total-row';
            finalTotalRow.className = 'cart-total-row';
            finalTotalRow.style.cssText = 'display: none; margin-top: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 0.5rem;';
            finalTotalRow.innerHTML = '<span class="cart-total-label">Total:</span><span class="cart-total-val" id="cart-final-total-val">$0</span>';
            cartFooter.insertBefore(finalTotalRow, minWarning);
            
            shippingVal = document.getElementById('cart-shipping-val');
            finalTotalVal = document.getElementById('cart-final-total-val');
            
            // Rename the original total to Subtotal just in case
            const originalTotalLabel = document.querySelector('.cart-total-row .cart-total-label');
            if (originalTotalLabel) originalTotalLabel.textContent = 'Subtotal:';
        }
    }
    
    if (shippingRow && finalTotalRow) {
        if (totalPrice > 0) {
            shippingRow.style.display = 'flex';
            finalTotalRow.style.display = 'flex';
            shippingVal.textContent = shipping === 0 ? '¡Gratis!' : `$${shipping}`;
            finalTotalVal.textContent = `$${totalPrice + shipping}`;
            if (shipping === 0) {
                shippingVal.style.color = '#4CAF50';
                shippingVal.style.fontWeight = 'bold';
            } else {
                shippingVal.style.color = '';
                shippingVal.style.fontWeight = '';
            }
        } else {
            shippingRow.style.display = 'none';
            finalTotalRow.style.display = 'none';
        }
    }
    
    // Check Wholesale Rules
    if (mode === 'mayoreo') {
        if (totalPrice < CONFIG.minPurchaseMayoreo) {
            elements.minWarning.style.display = 'block';
            elements.minWarning.textContent = `Mínimo de compra para mayoreo: $${CONFIG.minPurchaseMayoreo} MXN (Faltan $${CONFIG.minPurchaseMayoreo - totalPrice})`;
            if (elements.checkoutBtn) {
                elements.checkoutBtn.disabled = true;
                elements.checkoutBtn.style.opacity = '0.5';
            }
        } else {
            elements.minWarning.style.display = 'none';
            if (elements.checkoutBtn) {
                elements.checkoutBtn.disabled = false;
                elements.checkoutBtn.style.opacity = '1';
            }
        }
    } else {
        elements.minWarning.style.display = 'none';
        if (elements.checkoutBtn) {
            elements.checkoutBtn.disabled = false;
            elements.checkoutBtn.style.opacity = '1';
        }
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
        let extraAritosPrice = 0;
        if (product.multi_aritos === true) {
            const unit = mode === 'mayoreo' ? (product.aritos_price_mayoreo||0) : (product.aritos_price_cliente||0);
            extraAritosPrice = (item.aritosCount - 2) * unit;
        } else if (product.multi_plaquitas === true) {
            const unit = mode === 'mayoreo' ? (product.plaquitas_price_mayoreo||0) : (product.plaquitas_price_cliente||0);
            extraAritosPrice = (item.aritosCount - 1) * unit;
        }
        const extraKidUnit = mode === 'mayoreo' ? (product.extra_kid_price_mayoreo || 0) : (product.extra_kid_price_cliente || 0);
        const extraKidsPrice = product.allows_extra_kids === true ? (item.extraBoys + item.extraGirls) * extraKidUnit : 0;
        const price = basePrice + extraAritosPrice + extraKidsPrice;
        const subtotal = price * qty;
        total += subtotal;
        
        let customInfo = '';
        if (item.customText) {
            if (product.multi_aritos === true || product.multi_plaquitas === true) {
                const itemType = product.multi_aritos ? 'Aros' : 'Plaquitas';
                customInfo += ` [💍 ${itemType}: ${item.aritosCount} | Grabados: '${item.customText}' | Letra: ${item.customFont}]`;
            } else {
                if (item.customFont === 'N/A') {
                    customInfo += ` [${item.customText}]`;
                } else {
                    customInfo += ` [Grabado: '${item.customText}' / Letra: ${item.customFont}]`;
                }
            }
        }
        
        if (item.extraBoys > 0 || item.extraGirls > 0) {
            let kidsArr = [];
            if (item.extraBoys > 0) kidsArr.push(`${item.extraBoys} Niño${item.extraBoys > 1 ? 's' : ''}`);
            if (item.extraGirls > 0) kidsArr.push(`${item.extraGirls} Niña${item.extraGirls > 1 ? 's' : ''}`);
            customInfo += ` [Extra: ${kidsArr.join(', ')}]`;
        }
        
        message += `• *${qty}x* ${product.code}${customInfo} (${product.material}) - $${price} c/u (Sub: $${subtotal})\n`;
    });
    
    let shipping = 0;
    if (mode === 'mayoreo') {
        if (total > 0 && total < 2000) shipping = 238;
        else if (total >= 2000 && total < 3000) shipping = 119;
        
        message += `\n*Subtotal estimado: $${total} MXN*\n`;
        message += `*Envío Estándar: ${shipping === 0 ? '¡GRATIS!' : '$' + shipping + ' MXN'}*\n`;
        message += `*TOTAL A PAGAR: $${total + shipping} MXN*\n`;
        
        message += `\n_Pedido mayorista para Accesorizate. Agradezco me confirmen stock._`;
    } else {
        message += `\n*Total estimado: $${total} MXN*\n`;
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
