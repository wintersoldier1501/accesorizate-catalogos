// ==========================================================================
// APP LOGIC - ACCESORIZATE INTERACTIVE WEB CATALOG
// ==========================================================================

// Configuration
const CONFIG = {
    whatsappPhoneMayoreo: "5216181071740", // Número de Accesorízate Mayoreo
    whatsappPhoneClientes: "", // Vacío para que el cliente elija a quién enviarlo
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
    productsGrid: document.getElementById('products-grid'),
    modalAddToCart: document.getElementById('modal-add-to-cart'),
    modalShareBtn: document.getElementById('modal-share-btn')
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
        initDynamicCategories();
        applyFilters();
        return;
    }

    // 3. Fallback to PRODUCTS_DATA
    if (window.PRODUCTS_DATA) {
        console.log("Loaded products database from local PRODUCTS_DATA script tag.");
        products = window.PRODUCTS_DATA;
        initDynamicCategories();
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
        initDynamicCategories();
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

// Dynamically add category buttons for new custom categories found in DB
function initDynamicCategories() {
    if (!elements.categoryFilters) return;
    
    const existingBtns = Array.from(elements.categoryFilters.querySelectorAll('.filter-btn')).map(b => b.dataset.category);
    const uniqueCategories = new Set();
    
    products.forEach(p => {
        if (p.category && p.active !== false) {
            uniqueCategories.add(p.category);
        }
    });
    
    const personalBtn = elements.categoryFilters.querySelector('[data-category="Personalizados"]');
    
    uniqueCategories.forEach(cat => {
        if (!existingBtns.includes(cat) && cat !== 'Accesorios para Niña') {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.dataset.category = cat;
            btn.textContent = cat;
            if (personalBtn) {
                elements.categoryFilters.insertBefore(btn, personalBtn);
            } else {
                elements.categoryFilters.appendChild(btn);
            }
        }
    });
}

// Setup all UI Event Listeners
function setupEventListeners() {
    // Search
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', (e) => {
            window.showingSeasonalOnly = false;
            searchQuery = e.target.value.toLowerCase().trim();
            applyFilters();
        });
    }
    
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
                
                const isLegacyPersonalized = p.is_personalized === undefined && (['Collares', 'Llaveros'].includes(p.category) && p.subcategory === 'Personalizados');
                const isCategoryPersonalized = p.show_in_personalized === true || p.is_personalized === true || isLegacyPersonalized ||
                                       (p.details && p.details.toLowerCase().includes('graba')) || p.allows_photo_engraving === true;
                
                return !isCategoryPersonalized;
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
        const allActiveProducts = products.filter(p => p.active !== false);
        
        // Extract top 20 newest for Recién Llegados carousel
        const sortedByNewness = [...allActiveProducts].filter(p => p.exclude_new_arrivals !== true).sort((a, b) => {
            const timeA = a.created_at || 0;
            const timeB = b.created_at || 0;
            if (timeA > 0 && timeB > 0) return timeB - timeA;
            if (timeA > 0) return -1;
            if (timeB > 0) return 1;
            return getCodeNumber(b.code) - getCodeNumber(a.code);
        });
        window.homepageNewest = sortedByNewness.slice(0, 40);
        
        // (Seasonal extraction logic moved to dedicated view)
        
        // Extract top 20 for Restock carousel
        const restockProducts = allActiveProducts
            .filter(p => p.restocked_at)
            .sort((a, b) => b.restocked_at - a.restocked_at);
        window.homepageTrending = restockProducts.slice(0, 20);

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

            const isLegacyPersonalized = p.is_personalized === undefined && (['Collares', 'Llaveros'].includes(p.category) && p.subcategory === 'Personalizados');
            const isCategoryPersonalized = p.show_in_personalized === true || p.is_personalized === true || isLegacyPersonalized ||
                                   (p.details && p.details.toLowerCase().includes('graba')) || p.allows_photo_engraving === true;

            // Search match (code or details)
            const matchesSearch = searchQuery === '' || 
                                  p.code.toLowerCase().includes(searchQuery) || 
                                  (p.details && p.details.toLowerCase().includes(searchQuery));
                                  
            // Category match
            const matchesCategory = activeCategory === 'all' || 
                                    (activeCategory.toLowerCase() === 'personalizados' ? 
                                        isCategoryPersonalized : 
                                        (activeCategory.toLowerCase() === 'hombre' ? 
                                            (p.is_mens === true || (p.is_mens !== false && (p.subcategory === 'Accesorios Hombre' || p.subcategory === 'Hombre'))) : 
                                            p.category.toLowerCase() === activeCategory.toLowerCase()));
                                    
            // Material match
            const matchesMaterial = activeMaterial === 'all' || 
                                    (p.material && p.material.toLowerCase().includes(activeMaterial.toLowerCase())) ||
                                    (activeMaterial === 'Otros' && p.material && !['Acero Inoxidable', 'Chapa de Oro'].some(m => p.material.includes(m)));
                                    
            return matchesSearch && matchesCategory && matchesMaterial;
        });

        if (activeCategory === 'Piercings') {
            const piercingOrder = { 'Stud': 1, 'Huggie': 2, 'Earcuff': 3 };
            
            // Sort by subcategory order
            filteredProducts.sort((a, b) => {
                const subA = a.subcategory || 'Otros';
                const subB = b.subcategory || 'Otros';
                const orderA = piercingOrder[subA] || 99;
                const orderB = piercingOrder[subB] || 99;
                return orderA - orderB;
            });
            
            // Assign displaySubcategory for grouping headers
            filteredProducts = filteredProducts.map(p => ({
                ...p,
                displaySubcategory: (p.subcategory === 'Stud' || p.subcategory === 'Huggie' || p.subcategory === 'Earcuff') 
                                    ? p.subcategory.toUpperCase() 
                                    : 'OTROS'
            }));
        } else {
            // Remove displaySubcategory for other categories so they don't show headers
            filteredProducts = filteredProducts.map(p => {
                const { displaySubcategory, ...rest } = p;
                return rest;
            });
        }
    }
    
    // Apply global sort by code number (oldest first)
    filteredProducts.sort((a, b) => {
        // If sorting Piercings, preserve the subcategory grouping
        if (activeCategory === 'Piercings') {
            const piercingOrder = { 'Stud': 1, 'Huggie': 2, 'Earcuff': 3 };
            const subA = a.subcategory || 'Otros';
            const subB = b.subcategory || 'Otros';
            const orderA = piercingOrder[subA] || 99;
            const orderB = piercingOrder[subB] || 99;
            if (orderA !== orderB) return 0; 
        }
        
        return getCodeNumber(a.code) - getCodeNumber(b.code);
    });
    
    // Reset Grid
    elements.productsGrid.innerHTML = '';
    renderedCount = 0;
    lastSubcat = ''; // Reset global subcategory tracking on filter change
    
    // Render first page
    renderNextPage();
    
    // Handle deep linking on first load
    if (!window.deepLinkHandled) {
        window.deepLinkHandled = true;
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('producto');
        if (productId) {
            const prod = products.find(p => p.code === productId);
            if (prod) {
                // Short delay to ensure rendering completes
                setTimeout(() => openModal(prod), 300);
            }
        }
    }
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

        // Tendencias / Restock Carousel
        if (window.homepageTrending && window.homepageTrending.length > 0) {
            const trendHeaderDiv = document.createElement('div');
            trendHeaderDiv.className = 'section-header';
            trendHeaderDiv.style.gridColumn = '1 / -1';
            trendHeaderDiv.innerHTML = `<h2 class="section-title">RESTOCK</h2>`;
            fragment.appendChild(trendHeaderDiv);

            const trendCarouselWrap = document.createElement('div');
            trendCarouselWrap.style.gridColumn = '1 / -1';
            const trendCarousel = document.createElement('div');
            trendCarousel.className = 'horizontal-carousel';
            window.homepageTrending.forEach(prod => {
                trendCarousel.appendChild(createProductCard(prod));
            });
            trendCarouselWrap.appendChild(trendCarousel);
            fragment.appendChild(trendCarouselWrap);
        }
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
    if (product.display_name) {
        return `${product.display_name.toUpperCase()} - ${product.code}`;
    }

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
    else if (cat.includes('llavero')) label = 'LLAVERO';
    
    if (label) {
        return `${label} - ${product.code}`;
    }
    
    // Fallback: Try to singularize any unknown category by removing trailing 's' if it exists
    let singularCat = product.category ? product.category.toUpperCase() : '';
    if (singularCat && singularCat.endsWith('S') && singularCat !== 'PIERCINGS') {
        singularCat = singularCat.slice(0, -1);
    }
    if (singularCat === 'PIERCINGS') singularCat = 'PIERCING';
    if (singularCat === 'ARETES') singularCat = 'ARETE';
    
    if (singularCat && singularCat !== 'HOMBRE' && singularCat !== 'PERSONALIZADO') {
        return `${singularCat} - ${product.code}`;
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
    const displayMaterial = product.material === 'Aleación de Metales' ? 'Aleaciones' : product.material;
    
    card.innerHTML = `
        <div class="image-container">
            <img class="product-image" src="${imageSrc}" alt="${product.code}" loading="lazy" style="object-position: center ${product.image_offset_y !== undefined ? product.image_offset_y : 50}%;">
            <span class="material-tag">${displayMaterial}</span>
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
        const isLegacyPersonalized = product.is_personalized === undefined && (['Collares', 'Llaveros'].includes(product.category) && product.subcategory === 'Personalizados');
        const isCategoryPersonalized = product.show_in_personalized === true || product.is_personalized === true || isLegacyPersonalized ||
                               (product.details && product.details.toLowerCase().includes('graba')) || product.allows_photo_engraving === true ||
                               product.multi_aritos === true || product.multi_plaquitas === true || product.requires_initial === true ||
                               product.requires_base_kid === true || product.allows_extra_kids === true || hasVariants ||
                               (product.dynamic_options && product.dynamic_options.length > 0);
        
        if (isCategoryPersonalized) {
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
    let photoHtml = '';
    if (product.allows_photo_engraving === true) {
        photoHtml = `
            <div class="custom-field" style="margin-bottom: 1.5rem; background-color: rgba(197, 160, 89, 0.05); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
                <label style="font-weight: 600; color: var(--gold-primary); display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin: 0;">
                    <input type="checkbox" id="custom-photo-check" style="width: 18px; height: 18px; cursor: pointer;">
                    <span>¿Quieres grabar una foto o dibujo?</span>
                </label>
                <div style="font-size: 0.85rem; color: #aaaaaa; margin-top: 0.4rem; margin-left: 1.8rem; line-height: 1.3;">
                    (Envíala por WhatsApp al momento de hacer tu pedido)
                </div>
            </div>
        `;
    }

    const isMultiAritos = product.multi_aritos === true;
    const isMultiPlaquitas = product.multi_plaquitas === true;
    
    if (isMultiAritos || isMultiPlaquitas) {
        const itemType = isMultiAritos ? 'Aros' : 'Plaquitas';
        const itemTypeSingular = isMultiAritos ? 'Aro' : 'Plaquita';
        const maxItems = 5;
        const baseItems = isMultiAritos ? (parseInt(product.aritos_base_count) || 2) : (parseInt(product.plaquitas_base_count) || 1);
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
            ${photoHtml}
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
            ${photoHtml}
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
    
    // 2. Live Preview Box
    if (product.requires_initial !== true) {
        const livePreviewDiv = document.createElement('div');
        livePreviewDiv.id = "live-preview-box";
        livePreviewDiv.style.marginTop = "1.5rem";
        livePreviewDiv.style.padding = "1.5rem 1rem";
        livePreviewDiv.style.border = "1px dashed rgba(212, 175, 55, 0.5)";
        livePreviewDiv.style.borderRadius = "8px";
        livePreviewDiv.style.textAlign = "center";
        livePreviewDiv.style.background = "rgba(0,0,0,0.3)";
        livePreviewDiv.style.minHeight = "80px";
        livePreviewDiv.style.display = "flex";
        livePreviewDiv.style.alignItems = "center";
        livePreviewDiv.style.justifyContent = "center";
        livePreviewDiv.style.flexDirection = "column";
        livePreviewDiv.innerHTML = `
            <span style="font-size: 0.75rem; color: var(--gold-primary); margin-bottom: 0.8rem; display: block; text-transform: uppercase; letter-spacing: 1px;">Previsualización de Grabado</span>
            <span id="live-preview-text" class="font-basica" style="font-size: 2.5rem; color: #fff; word-break: break-word; line-height: 1.2;">Tu Nombre</span>
        `;
        customSection.appendChild(livePreviewDiv);
        
        const previewText = livePreviewDiv.querySelector('#live-preview-text');
        const radios = customSection.querySelectorAll('input[type=radio]');
        
        const updatePreview = () => {
            const allInputs = customSection.querySelectorAll('input[type="text"]');
            let vals = [];
            allInputs.forEach(inp => { if(inp.value.trim()) vals.push(inp.value.trim()); });
            previewText.innerHTML = vals.length ? vals.join('<br>') : 'Tu Nombre';
        };
        
        customSection.addEventListener('input', (e) => {
            if (e.target.tagName.toLowerCase() === 'input' && e.target.type === 'text') {
                updatePreview();
            }
        });
        
        if (radios) {
            radios.forEach(r => {
                r.addEventListener('change', () => {
                    if(r.checked) previewText.className = r.parentElement.classList[1];
                });
            });
        }
    }
}

function renderDynamicOptionsFields(product, price, customSection) {
    if (!product.dynamic_options || product.dynamic_options.length === 0) return;
    
    const container = document.createElement('div');
    container.style.marginTop = '1rem';
    container.style.paddingTop = '1rem';
    container.style.borderTop = '1px solid var(--border-color)';
    container.className = 'dynamic-options-wrapper';

    const updatePrice = () => {
        let totalExtraPrice = 0;
        const selects = container.querySelectorAll('.dynamic-select');
        selects.forEach(select => {
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption) {
                const text = selectedOption.text;
                const dualMatch = text.match(/\(\+?\$?(\d+)\s*M\s*(?:\/|,|-)\s*\+?\$?(\d+)\s*C\)/i);
                if (dualMatch) {
                    totalExtraPrice += mode === 'mayoreo' ? parseInt(dualMatch[1]) : parseInt(dualMatch[2]);
                } else {
                    const match = text.match(/\(\+\$?(\d+)\)/) || text.match(/\(\$?(\d+)\)/);
                    if (match) {
                        totalExtraPrice += parseInt(match[1]);
                    }
                }
            }
        });
        // Retrieve base extra price from kids/aritos if they exist (hacky but works)
        const currentTitle = elements.modalTitle.textContent;
        // Since other functions might have updated the title, we just append or manage our own.
        // For simplicity, we just add to the base price. If mixed with kids, it might override.
        // It is recommended to use either dynamic options or fixed options.
        elements.modalTitle.textContent = `${getProductLabel(product)} - $${price + totalExtraPrice}`;
    };

    product.dynamic_options.forEach((opt, idx) => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'custom-field';
        fieldDiv.style.marginBottom = '1rem';
        
        let label = `<label for="dyn-opt-${idx}" style="font-weight: 600; color: var(--gold-primary); margin-bottom: 0.5rem; display: block;">${opt.title}</label>`;
        let inputHtml = '';
        
        if (opt.type === 'text') {
            inputHtml = `<input type="text" id="dyn-opt-${idx}" class="dynamic-input" data-title="${opt.title}" placeholder="Escribe aquí..." ${opt.required ? 'required' : ''} style="padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.9rem; width: 100%; background: var(--bg-card); color: var(--text-primary);">`;
        } else if (opt.type === 'select') {
            const optionsHtml = (opt.choices || []).map(c => {
                let displayLabel = c;
                const dualMatch = c.match(/\(\+?\$?(\d+)\s*M\s*(?:\/|,|-)\s*\+?\$?(\d+)\s*C\)/i);
                if (dualMatch) {
                    const priceToShow = mode === 'mayoreo' ? dualMatch[1] : dualMatch[2];
                    displayLabel = c.replace(dualMatch[0], `(+$${priceToShow})`);
                }
                return `<option value="${c}">${displayLabel}</option>`;
            }).join('');
            inputHtml = `<select id="dyn-opt-${idx}" class="dynamic-select" data-title="${opt.title}" ${opt.required ? 'required' : ''} style="padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.9rem; width: 100%; cursor: pointer; background: var(--bg-card); color: var(--text-primary);">
                <option value="">Selecciona una opción...</option>
                ${optionsHtml}
            </select>`;
        }
        
        fieldDiv.innerHTML = label + inputHtml;
        container.appendChild(fieldDiv);
    });

    customSection.appendChild(container);

    const selects = container.querySelectorAll('.dynamic-select');
    selects.forEach(select => {
        select.addEventListener('change', updatePrice);
    });
}

function renderExtraKidsFields(product, price, customSection, isPersonalized) {
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
        ${product.requires_base_kid ? `
        <div style="margin-bottom: 1rem;">
            <label for="base-kid" style="font-size: 0.8rem; color: #ccc;">Dije incluido:</label>
            <select id="base-kid" style="padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.9rem; width: 100%; cursor: pointer; background: var(--bg-card); color: var(--text-primary); margin-top: 0.2rem;" required>
                <option value="">Selecciona uno...</option>
                <option value="Niño">Niño</option>
                <option value="Niña">Niña</option>
            </select>
        </div>` : ''}
        ${product.allows_extra_kids ? `
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
        <div id="extra-kids-inputs-container" style="display: flex; flex-direction: column; gap: 0.8rem;"></div>
        ` : ''}
    `;
    
    customSection.appendChild(extraDiv);
    
    const boysSelect = extraDiv.querySelector('#extra-boys');
    const girlsSelect = extraDiv.querySelector('#extra-girls');
    const kidsInputsContainer = extraDiv.querySelector('#extra-kids-inputs-container');
    
    const updateTitlePrice = () => {
        const extraB = boysSelect ? parseInt(boysSelect.value) || 0 : 0;
        const extraG = girlsSelect ? parseInt(girlsSelect.value) || 0 : 0;
        let baseExtra = 0;
        const baseItems = product.multi_aritos === true ? (parseInt(product.aritos_base_count) || 2) : (parseInt(product.plaquitas_base_count) || 1);
        const count = parseInt(document.getElementById('aritos-count')?.value || baseItems);
        if (product.multi_aritos === true) {
            const unit = mode === 'mayoreo' ? (product.aritos_price_mayoreo||0) : (product.aritos_price_cliente||0);
            baseExtra = (count - baseItems) * unit;
        } else if (product.multi_plaquitas === true) {
            const unit = mode === 'mayoreo' ? (product.plaquitas_price_mayoreo||0) : (product.plaquitas_price_cliente||0);
            baseExtra = (count - baseItems) * unit;
        }
        const total = price + baseExtra + ((extraB + extraG) * extraPrice);
        elements.modalTitle.textContent = `${getProductLabel(product)} - $${total}`;
        
        if (!kidsInputsContainer) return;

        // Preserve inputs
        const existingBoys = [];
        const existingGirls = [];
        const currentInputs = kidsInputsContainer.querySelectorAll('input');
        currentInputs.forEach(inp => {
            if (inp.id.includes('boy')) existingBoys.push(inp.value);
            if (inp.id.includes('girl')) existingGirls.push(inp.value);
        });
        
        kidsInputsContainer.innerHTML = '';
        
        if (isPersonalized) {
            for (let i = 1; i <= extraB; i++) {
                const val = existingBoys[i - 1] || '';
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'custom-field';
                fieldDiv.style.margin = '0';
                fieldDiv.innerHTML = `
                    <label for="extra-boy-text-${i}" style="font-size: 0.75rem; color: #ffffff; font-weight: normal;">Texto Grabado para Niño Extra ${i}:</label>
                    <input type="text" id="extra-boy-text-${i}" placeholder="Nombre o texto para el niño..." value="${val}" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background-color: var(--bg-card); color: var(--text-primary); font-size: 0.85rem; width: 100%;">
                `;
                kidsInputsContainer.appendChild(fieldDiv);
            }
            
            for (let i = 1; i <= extraG; i++) {
                const val = existingGirls[i - 1] || '';
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'custom-field';
                fieldDiv.style.margin = '0';
                fieldDiv.innerHTML = `
                    <label for="extra-girl-text-${i}" style="font-size: 0.75rem; color: #ffffff; font-weight: normal;">Texto Grabado para Niña Extra ${i}:</label>
                    <input type="text" id="extra-girl-text-${i}" placeholder="Nombre o texto para la niña..." value="${val}" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background-color: var(--bg-card); color: var(--text-primary); font-size: 0.85rem; width: 100%;">
                `;
                kidsInputsContainer.appendChild(fieldDiv);
            }
        }
    };
    
    if (boysSelect) boysSelect.addEventListener('change', updateTitlePrice);
    if (girlsSelect) girlsSelect.addEventListener('change', updateTitlePrice);
    
    updateTitlePrice(); // Initial render
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
        prevBtn.className = 'modal-carousel-nav-btn';
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
        nextBtn.className = 'modal-carousel-nav-btn';
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
        
        // Mobile Swipe Gestures
        let touchStartX = 0;
        let touchEndX = 0;
        carouselContainer.addEventListener('touchstart', e => {
            if (e.touches.length > 1) {
                touchStartX = null;
                return;
            }
            touchStartX = e.changedTouches[0].screenX;
        }, {passive: true});
        carouselContainer.addEventListener('touchend', e => {
            if (touchStartX === null) return;
            touchEndX = e.changedTouches[0].screenX;
            if (touchEndX < touchStartX - 40) showImage(currentImgIdx + 1); // Swipe left
            if (touchEndX > touchStartX + 40) showImage(currentImgIdx - 1); // Swipe right
        }, {passive: true});
        
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
    const displayMaterial = product.material === 'Aleación de Metales' ? 'Aleaciones' : product.material;
    elements.modalDesc.textContent = product.details && product.details.trim() ? `${displayMaterial} | ${product.details}` : displayMaterial;

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
                if (imgEl) {
                    if (variant.image) {
                        imgEl.src = variant.image;
                    } else if (product.image) {
                        imgEl.src = product.image;
                    }
                }
            });
        });
    }
    
    // Setup Customization inputs dynamically
    const isLegacyPersonalized = product.is_personalized === undefined && (['Collares', 'Llaveros'].includes(product.category) && product.subcategory === 'Personalizados');
    const isPersonalized = product.is_personalized === true || isLegacyPersonalized ||
                           (product.details && product.details.toLowerCase().includes('graba')) ||
                           product.multi_aritos === true || product.multi_plaquitas === true || product.requires_initial === true || product.allows_photo_engraving === true;
    
    const hasCustomization = isPersonalized || product.allows_extra_kids === true || product.requires_base_kid === true || (product.dynamic_options && product.dynamic_options.length > 0);
    
    let customSection = modalRight.querySelector('.customization-section');
    if (!customSection) {
        customSection = document.createElement('div');
        customSection.className = 'customization-section';
        modalRight.insertBefore(customSection, elements.modalAddToCart.parentElement);
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
        
        if (product.allows_extra_kids === true || product.requires_base_kid === true) {
            renderExtraKidsFields(product, price, customSection, isPersonalized);
        }

        renderDynamicOptionsFields(product, price, customSection);
    } else {
        customSection.style.display = 'none';
        elements.modalTitle.textContent = `${getProductLabel(product)} - $${price}`;
    }
    
    // Mutual exclusivity for photo vs text engraving
    setTimeout(() => {
        const photoCheck = customSection.querySelector('#custom-photo-check');
        if (photoCheck) {
            const photoContainer = photoCheck.closest('.custom-field');
            
            function updateVisibility() {
                const textFields = Array.from(customSection.querySelectorAll('.custom-field')).filter(el => el !== photoContainer);
                const aritosContainer = customSection.querySelector('#aritos-inputs-container');
                const isPhotoChecked = photoCheck.checked;
                
                let hasText = false;
                const allTextInputs = customSection.querySelectorAll('input[type="text"]');
                allTextInputs.forEach(inp => { if (inp.value.trim() !== '') hasText = true; });
                
                if (isPhotoChecked) {
                    textFields.forEach(el => el.style.display = 'none');
                    if (aritosContainer) aritosContainer.style.display = 'none';
                } else if (hasText) {
                    photoContainer.style.display = 'none';
                    textFields.forEach(el => el.style.display = '');
                    if (aritosContainer) aritosContainer.style.display = 'flex';
                } else {
                    photoContainer.style.display = '';
                    textFields.forEach(el => el.style.display = '');
                    if (aritosContainer) aritosContainer.style.display = 'flex';
                }
            }
            
            photoCheck.addEventListener('change', updateVisibility);
            customSection.addEventListener('input', (e) => {
                if (e.target.type === 'text') {
                    updateVisibility();
                }
            });
            
            // Also listen to select changes (like "Cantidad de Aros") to ensure UI updates if fields are re-rendered
            customSection.addEventListener('change', (e) => {
                if (e.target.tagName.toLowerCase() === 'select') {
                    setTimeout(updateVisibility, 50); // wait for re-render
                }
            });
            
            updateVisibility();
        }
    }, 50);

    // Setup Share button
    if (elements.modalShareBtn) {
        elements.modalShareBtn.onclick = () => {
            const shareUrl = window.location.origin + window.location.pathname + '?producto=' + product.code;
            navigator.clipboard.writeText(shareUrl).then(() => {
                const originalHtml = elements.modalShareBtn.innerHTML;
                elements.modalShareBtn.innerHTML = '<span style="font-size: 12px; font-weight: bold;">¡Copiado!</span>';
                setTimeout(() => {
                    elements.modalShareBtn.innerHTML = originalHtml;
                }, 2000);
            }).catch(err => console.error("Error al copiar:", err));
        };
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
            
            if (product.requires_base_kid === true) {
                const baseKidSelect = customSection.querySelector('#base-kid');
                if (baseKidSelect) {
                    if (!baseKidSelect.value) {
                        alert("Por favor selecciona el dije incluido (Niño o Niña) antes de agregar al pedido.");
                        return; // Prevent add to cart
                    }
                    customText = `[Incluye: ${baseKidSelect.value}]`;
                }
            }
        }
        
        if (isPersonalized && customSection) {
            if (product.requires_initial === true) {
                const initSelect = customSection.querySelector('#custom-initial');
                const t = initSelect ? `Inicial elegida: ${initSelect.value}` : '';
                customText = customText ? `${customText} | ${t}` : t;
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
                const t = texts.join(' | ');
                customText = customText ? `${customText} | ${t}` : t;
            } else {
                const fontGroupEl = customSection.querySelector('#custom-font');
                const checkedRadio = fontGroupEl ? fontGroupEl.querySelector('input[type=radio]:checked') : null;
                customFont = checkedRadio ? checkedRadio.value : '1. Básica';
                
                const textInp = customSection.querySelector('#custom-text');
                const t = textInp ? textInp.value.trim() : '';
                customText = customText ? `${customText} | ${t}` : t;
            }
        }
        
        if (product.allows_photo_engraving === true && customSection) {
            const photoCheck = customSection.querySelector('#custom-photo-check');
            if (photoCheck && photoCheck.checked) {
                customText = `[REQUIERE GRABAR FOTO]` + (customText ? ` | ${customText}` : '');
            }
        }
        
        if (product.allows_extra_kids === true && customSection && (extraBoys > 0 || extraGirls > 0)) {
            const kidTexts = [];
            for (let i = 1; i <= extraBoys; i++) {
                const inp = customSection.querySelector(`#extra-boy-text-${i}`);
                if (inp) kidTexts.push(`Niño Extra ${i}: ${inp.value.trim() || '(Sin grabar)'}`);
            }
            for (let i = 1; i <= extraGirls; i++) {
                const inp = customSection.querySelector(`#extra-girl-text-${i}`);
                if (inp) kidTexts.push(`Niña Extra ${i}: ${inp.value.trim() || '(Sin grabar)'}`);
            }
            if (kidTexts.length > 0) {
                customText = customText ? customText + ' | ' + kidTexts.join(' | ') : kidTexts.join(' | ');
            }
        }
        
        if (window.currentSelectedVariant) {
            customText = `[Color: ${window.currentSelectedVariant}] ` + customText;
        }

        // --- Dynamic Options Extraction ---
        let dynamicExtraPrice = 0;
        if (product.dynamic_options && product.dynamic_options.length > 0 && customSection) {
            const wrapper = customSection.querySelector('.dynamic-options-wrapper');
            if (wrapper) {
                const dynTexts = [];
                // Check all inputs
                const inputs = wrapper.querySelectorAll('.dynamic-input, .dynamic-select');
                for (let i = 0; i < inputs.length; i++) {
                    const inp = inputs[i];
                    if (inp.required && !inp.value.trim()) {
                        alert(`Por favor completa el campo: ${inp.getAttribute('data-title')}`);
                        return; // Prevent add to cart
                    }
                    if (inp.value.trim()) {
                        dynTexts.push(`${inp.getAttribute('data-title')}: ${inp.value.trim()}`);
                        
                        // Check if it's a select and has extra price
                        if (inp.tagName.toLowerCase() === 'select') {
                            const selectedOption = inp.options[inp.selectedIndex];
                            if (selectedOption) {
                                const dualMatch = selectedOption.text.match(/\(\+?\$?(\d+)\s*M\s*(?:\/|,|-)\s*\+?\$?(\d+)\s*C\)/i);
                                if (dualMatch) {
                                    dynamicExtraPrice += mode === 'mayoreo' ? parseInt(dualMatch[1]) : parseInt(dualMatch[2]);
                                } else {
                                    const match = selectedOption.text.match(/\(\+\$?(\d+)\)/) || selectedOption.text.match(/\(\$?(\d+)\)/);
                                    if (match) {
                                        dynamicExtraPrice += parseInt(match[1]);
                                    }
                                }
                            }
                        }
                    }
                }
                if (dynTexts.length > 0) {
                    const t = dynTexts.join(' | ');
                    customText = customText ? customText + ' | ' + t : t;
                }
            }
        }
        
        addToCart(product.code, customText, customFont, aritosCount, extraBoys, extraGirls, dynamicExtraPrice);
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
function addToCart(code, customText = '', customFont = '', aritosCount = 2, extraBoys = 0, extraGirls = 0, dynamicExtraPrice = 0) {
    const cleanText = customText.trim();
    const key = cleanText ? `${code}__${cleanText}__${customFont}__${aritosCount}__${extraBoys}__${extraGirls}__${dynamicExtraPrice}` : `${code}__${extraBoys}__${extraGirls}__${dynamicExtraPrice}`;
    
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
            extraGirls: extraGirls,
            dynamicExtraPrice: dynamicExtraPrice
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
            const baseItems = product.multi_aritos === true ? (parseInt(product.aritos_base_count) || 2) : (parseInt(product.plaquitas_base_count) || 1);
            let extraPrice = 0;
            if (product.multi_aritos === true) {
                const unit = mode === 'mayoreo' ? (product.aritos_price_mayoreo||0) : (product.aritos_price_cliente||0);
                extraPrice += (item.aritosCount - baseItems) * unit;
            } else if (product.multi_plaquitas === true) {
                const unit = mode === 'mayoreo' ? (product.plaquitas_price_mayoreo||0) : (product.plaquitas_price_cliente||0);
                extraPrice += (item.aritosCount - baseItems) * unit;
            }
            
            if (product.allows_extra_kids === true) {
                const kidUnit = mode === 'mayoreo' ? (product.extra_kid_price_mayoreo||0) : (product.extra_kid_price_cliente||0);
                extraPrice += ((item.extraBoys || 0) + (item.extraGirls || 0)) * kidUnit;
            }
            
            if (item.dynamicExtraPrice) {
                extraPrice += item.dynamicExtraPrice;
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
                    if (!item.customFont || item.customFont === 'N/A') {
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
        if (totalPrice > 0 && totalPrice < 2200) {
            shipping = 238;
        } else if (totalPrice >= 2200 && totalPrice < 3000) {
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
    if (mode === 'mayoreo') {
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
    } else {
        // If it's clientes, ensure the label is "Total" and hide the shipping/final rows if they somehow exist
        const originalTotalLabel = document.querySelector('.cart-total-row .cart-total-label');
        if (originalTotalLabel) originalTotalLabel.textContent = 'Total:';
        if (shippingRow) shippingRow.style.display = 'none';
        if (finalTotalRow) finalTotalRow.style.display = 'none';
    }
    
    // Check Wholesale Rules and Gamified Progress Bar
    if (mode === 'mayoreo') {
        let progressBarRow = document.getElementById('cart-progress-row');
        if (!progressBarRow) {
            progressBarRow = document.createElement('div');
            progressBarRow.id = 'cart-progress-row';
            progressBarRow.style.cssText = 'margin: 1rem 0; text-align: center;';
            const cartFooter = document.querySelector('.cart-footer');
            if (cartFooter) {
                cartFooter.insertBefore(progressBarRow, elements.minWarning);
            }
        }
        
        if (progressBarRow) {
            const freeShippingThreshold = 3000;
            const progress = Math.min(100, (totalPrice / freeShippingThreshold) * 100);
            
            let progressMsg = '';
            let progressColor = 'var(--gold-primary)';
            
            if (totalPrice >= 3000) {
                progressMsg = `🎉 ¡Felicidades! Tienes <strong>Envío Gratis</strong>.`;
                progressColor = '#4CAF50';
            } else if (totalPrice >= 2200) {
                progressMsg = `¡Envío de $119 MXN! Agrega <strong>$${3000 - totalPrice}</strong> para Envío Gratis.`;
            } else if (totalPrice > 0) {
                progressMsg = `Agrega <strong>$${3000 - totalPrice}</strong> para Envío Gratis.`;
            } else {
                progressMsg = `Agrega $3000 para Envío Gratis.`;
            }
            
            progressBarRow.innerHTML = `
                <div style="font-size: 0.85rem; color: #ddd; margin-bottom: 0.4rem;">${progressMsg}</div>
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${progress}%; height: 100%; background: ${progressColor}; transition: width 0.3s ease;"></div>
                </div>
            `;
            progressBarRow.style.display = totalPrice > 0 ? 'block' : 'none';
        }
        
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
        const baseItems = product.multi_aritos === true ? (parseInt(product.aritos_base_count) || 2) : (parseInt(product.plaquitas_base_count) || 1);
        const aritosCount = parseInt(item.aritosCount) || baseItems;
        let aritosPrice = 0;
        
        if (product.multi_aritos === true) {
            const unit = mode === 'mayoreo' ? (product.aritos_price_mayoreo || 0) : (product.aritos_price_cliente || 0);
            aritosPrice = (aritosCount - baseItems) * unit;
        } else if (product.multi_plaquitas === true) {
            const unit = mode === 'mayoreo' ? (product.plaquitas_price_mayoreo || 0) : (product.plaquitas_price_cliente || 0);
            aritosPrice = (aritosCount - baseItems) * unit;
        }
        const extraKidUnit = mode === 'mayoreo' ? (product.extra_kid_price_mayoreo || 0) : (product.extra_kid_price_cliente || 0);
        const extraKidsPrice = product.allows_extra_kids === true ? ((item.extraBoys||0) + (item.extraGirls||0)) * extraKidUnit : 0;
        const dynExtraPrice = item.dynamicExtraPrice || 0;
        const price = basePrice + aritosPrice + extraKidsPrice + dynExtraPrice;
        const subtotal = price * qty;
        total += subtotal;
        
        let customInfo = '';
        if (item.customText) {
            if (product.multi_aritos === true || product.multi_plaquitas === true) {
                const itemType = product.multi_aritos ? 'Aros' : 'Plaquitas';
                customInfo += ` [💍 ${itemType}: ${item.aritosCount} | Grabados: '${item.customText}' | Letra: ${item.customFont}]`;
            } else {
                if (!item.customFont || item.customFont === 'N/A') {
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
        
        let singularCatStr = product.category ? product.category : '';
        const catMap = { 'collares': 'Collar', 'aretes': 'Arete', 'piercings': 'Piercing', 'llaveros': 'Llavero', 'pulseras': 'Pulsera', 'anillos': 'Anillo', 'relojes': 'Reloj' };
        if (singularCatStr && catMap[singularCatStr.toLowerCase()]) {
            singularCatStr = catMap[singularCatStr.toLowerCase()];
        } else if (singularCatStr && singularCatStr.toLowerCase().endsWith('s')) {
            singularCatStr = singularCatStr.slice(0, -1);
        }
        
        const categoryText = singularCatStr ? `(${singularCatStr})` : '';
        message += `• *${qty}x* ${product.code}${customInfo} ${categoryText} - $${price} c/u (Sub: $${subtotal})\n`;
    });
    
    let shipping = 0;
    if (mode === 'mayoreo') {
        if (total > 0 && total < 2200) shipping = 238;
        else if (total >= 2200 && total < 3000) shipping = 119;
        
        message += `\n*Subtotal estimado: $${total} MXN*\n`;
        message += `*Envío Estándar: ${shipping === 0 ? '¡GRATIS!' : '$' + shipping + ' MXN'}*\n`;
        message += `*TOTAL A PAGAR: $${total + shipping} MXN*\n`;
        
        message += `\n_Pedido mayorista para Accesorizate. Agradezco me confirmen stock._`;
    } else {
        message += `\n*Total estimado: $${total} MXN*\n`;
    }
    
    const encodedMessage = encodeURIComponent(message);
    const phone = mode === 'mayoreo' ? CONFIG.whatsappPhoneMayoreo : CONFIG.whatsappPhoneClientes;
    
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
