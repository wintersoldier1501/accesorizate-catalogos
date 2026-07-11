






        // Global error handler to show JavaScript exceptions on screen
        window.onerror = function(message, source, lineno, colno, error) {
            showToast(`Error de script: ${message} (Línea ${lineno})`, 'error');
            console.error(error);
            return false;
        };

        // Initialize Firebase if configured
        if (window.isFirebaseConfigured && window.isFirebaseConfigured()) {
            try {
                firebase.initializeApp(window.firebaseConfig);
                window.db = firebase.firestore();
                window.storage = firebase.storage();
                console.log("Firebase initialized successfully in Admin.");
            } catch (e) {
                console.error("Firebase initialization failed in Admin:", e);
            }
        }

        // Ensure database exists
        let products = window.PRODUCTS_DATA || (typeof productsData !== 'undefined' ? productsData : []);
        let isEditing = false;
        let currentEditCode = '';
        let selectedImages = [];

        // Check if user is already logged in for this session
        if (sessionStorage.getItem('adminAuthorized') === 'true') {
            document.getElementById('login-overlay').style.display = 'none';
        }

        // SHA-256 Hashing helper
        async function sha256(message) {
            const msgBuffer = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        }

        // Handle Login Submission
        async function handleLogin() {
            const userVal = document.getElementById('login-username').value.trim();
            const passVal = document.getElementById('login-password').value;
            const errorDiv = document.getElementById('login-error');

            const userHash = await sha256(userVal);
            const passHash = await sha256(passVal);

            // Stored hashes
            const expectedUserHash = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"; // 'admin'
            const expectedPassHash = "5918d4b9a705be235db1b59861ed42f7e42e97da6435dcff7d9336fb1626bc08"; // 'accesorizate2026'

            if (userHash === expectedUserHash && passHash === expectedPassHash) {
                sessionStorage.setItem('adminAuthorized', 'true');
                // Smooth fade out
                const overlay = document.getElementById('login-overlay');
                overlay.style.transition = 'opacity 0.4s ease';
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.style.display = 'none';
                }, 400);
            } else {
                // Show error and shake the login container
                errorDiv.style.display = 'block';
                const formContainer = errorDiv.parentElement.parentElement;
                formContainer.style.animation = 'none';
                formContainer.offsetHeight; // trigger reflow
                formContainer.style.animation = 'shake 0.4s ease';
            }
        }

        // Dom Elements
        const tableBody = document.getElementById('admin-table-body');
        const searchInput = document.getElementById('admin-search');
        const filterCategory = document.getElementById('admin-filter-category');
        const filterMaterial = document.getElementById('admin-filter-material');
        const filterStatus = document.getElementById('admin-filter-status');
        const addProductBtn = document.getElementById('add-product-btn');
        const modal = document.getElementById('product-modal');
        const modalClose = document.getElementById('product-modal-close');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const saveForm = document.getElementById('product-form');
        
        const formCode = document.getElementById('p-code');
        const formMaterial = document.getElementById('p-material');
        const formCategory = document.getElementById('p-category');
        const formIsPersonalized = document.getElementById('p-is-personalized');
        const formIsMens = document.getElementById('p-is-mens');
        const formPriceMayoreo = document.getElementById('p-price-mayoreo');
        const formPriceCliente = document.getElementById('p-price-cliente');
        const formDetails = document.getElementById('p-details');
        const formMultiAritos = document.getElementById('p-multi-aritos');
        const formRequiresInitial = document.getElementById('p-requires-initial');
        const fileInput = document.getElementById('p-image-file');
        const dropzone = document.getElementById('image-dropzone');
        const previewContainer = document.getElementById('image-preview-container');
        const toast = document.getElementById('admin-toast');

        // Initial Setup
        async function init() {
            if (window.db) {
                try {
                    showToast('Cargando base de datos de la nube...', 'success');
                    const snapshot = await window.db.collection('products').get();
                    if (snapshot.empty) {
                        // Show migration banner
                        document.getElementById('migration-banner').style.display = 'flex';
                        setupMigrationListener();
                    } else {
                        // Load products from Firestore
                        const fbProducts = [];
                        snapshot.forEach(doc => {
                            fbProducts.push(doc.data());
                        });
                        products = fbProducts;
                        console.log(`Loaded ${products.length} products from Cloud Firestore.`);
                    }
                } catch (e) {
                    console.error("Error loading from Firestore, using local fallback:", e);
                    showToast('Error cargando de la nube. Usando datos locales.', 'error');
                }
            }
            populateFilters();
            renderTable();
            updateStats();
            setupEventListeners();
        }

        // Setup the One-Click Migration Button
        function setupMigrationListener() {
            const migrateBtn = document.getElementById('migrate-btn');
            migrateBtn.onclick = async () => {
                migrateBtn.disabled = true;
                migrateBtn.innerText = 'Migrando...';
                showToast('Iniciando migración masiva a la nube...', 'success');
                
                // Get all local products from local PRODUCTS_DATA script tag or local productsData
                const localProducts = window.PRODUCTS_DATA || (typeof productsData !== 'undefined' ? productsData : []);
                if (localProducts.length === 0) {
                    showToast('Error: No hay productos locales para migrar.', 'error');
                    migrateBtn.disabled = false;
                    migrateBtn.innerText = 'Migrar a Firebase';
                    return;
                }
                
                try {
                    // Firestore limit for single batch is 500 documents.
                    // We will upload in batches of 400 documents for safety.
                    const batchSize = 400;
                    for (let i = 0; i < localProducts.length; i += batchSize) {
                        const batch = window.db.batch();
                        const chunk = localProducts.slice(i, i + batchSize);
                        
                        chunk.forEach(prod => {
                            const docRef = window.db.collection('products').doc(prod.code);
                            batch.set(docRef, prod);
                        });
                        
                        await batch.commit();
                        showToast(`Migrados ${Math.min(i + batchSize, localProducts.length)} de ${localProducts.length} productos...`, 'success');
                    }
                    
                    showToast('¡Migración completada con éxito! Recargando...', 'success');
                    document.getElementById('migration-banner').style.display = 'none';
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                    
                } catch (err) {
                    console.error("Migration failed:", err);
                    showToast(`Error durante la migración: ${err.message}`, 'error');
                    migrateBtn.disabled = false;
                    migrateBtn.innerText = 'Migrar a Firebase';
                }
            };
        }

        // Stats calculation
        function updateStats() {
            document.getElementById('stat-total').innerText = products.length;
            document.getElementById('stat-active').innerText = products.filter(p => p.active !== false).length;
            document.getElementById('stat-inactive').innerText = products.filter(p => p.active === false).length;
            document.getElementById('stat-images').innerText = products.filter(p => p.has_image).length;
        }

        // Fill filter dropdowns dynamically
        function populateFilters() {
            const categories = new Set();
            const materials = new Set();
            products.forEach(p => {
                if (p.category) categories.add(p.category);
                if (p.material) materials.add(p.material);
            });

            // Populate category select
            categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.innerText = cat;
                filterCategory.appendChild(opt);
            });

            // Populate material select
            materials.forEach(mat => {
                const opt = document.createElement('option');
                opt.value = mat;
                opt.innerText = mat;
                filterMaterial.appendChild(opt);
            });
        }

        // Display toast message
        function showToast(message, type = 'success') {
            toast.innerText = message;
            toast.className = `toast ${type}`;
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }

        // Render products table
        function renderTable() {
            const query = searchInput.value.toLowerCase().trim();
            const catFilter = filterCategory.value;
            const matFilter = filterMaterial.value;
            const statusFilter = filterStatus.value;

            tableBody.innerHTML = '';

            const filtered = products.filter(p => {
                const matchesSearch = p.code.toLowerCase().includes(query) || 
                                      (p.details && p.details.toLowerCase().includes(query)) ||
                                      p.category.toLowerCase().includes(query);
                const matchesCategory = catFilter === 'all' || p.category === catFilter;
                const matchesMaterial = matFilter === 'all' || p.material === matFilter;
                const matchesStatus = statusFilter === 'all' || 
                                      (statusFilter === 'active' && p.active !== false) ||
                                      (statusFilter === 'inactive' && p.active === false);

                return matchesSearch && matchesCategory && matchesMaterial && matchesStatus;
            });

            // Sort products by code
            filtered.sort((a, b) => a.code.localeCompare(b.code));

            // Paginate table to show only first 150 matching products for performance, let user use search for more
            const itemsToShow = filtered.slice(0, 150);

            if (itemsToShow.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No se encontraron productos.</td></tr>`;
                return;
            }

            itemsToShow.forEach(p => {
                const tr = document.createElement('tr');
                
                // Image column
                const tdImg = document.createElement('td');
                if (p.has_image && p.image) {
                    const img = document.createElement('img');
                    img.className = 'admin-thumbnail';
                    img.src = p.image;
                    img.alt = p.code;
                    img.onerror = () => {
                        tdImg.innerHTML = `<div class="admin-thumbnail-fallback">♦</div>`;
                    };
                    tdImg.appendChild(img);
                } else {
                    tdImg.innerHTML = `<div class="admin-thumbnail-fallback">♦</div>`;
                }
                tr.appendChild(tdImg);

                // Code column
                const tdCode = document.createElement('td');
                tdCode.style.fontWeight = '600';
                tdCode.innerText = p.code;
                tr.appendChild(tdCode);

                // Category & subcategory column
                const tdCat = document.createElement('td');
                tdCat.innerHTML = `${p.category} <br> <span style="font-size:0.75rem; color:var(--text-muted);">${(p.is_personalized || p.subcategory === 'Personalizados') ? 'Personalizado ' : ''}${(p.is_mens || p.subcategory === 'Hombre') ? 'Hombre' : ''}</span>`;
                tr.appendChild(tdCat);

                // Material column
                const tdMat = document.createElement('td');
                tdMat.innerText = p.material;
                tr.appendChild(tdMat);

                // Prices columns
                const tdMayoreo = document.createElement('td');
                tdMayoreo.innerText = `$${p.price_mayoreo}`;
                tr.appendChild(tdMayoreo);

                const tdCliente = document.createElement('td');
                tdCliente.innerText = `$${p.price_cliente}`;
                tr.appendChild(tdCliente);

                // Active toggle switch
                const tdStatus = document.createElement('td');
                const switchLabel = document.createElement('label');
                switchLabel.className = 'switch';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = p.active !== false;
                checkbox.addEventListener('change', () => toggleProductActive(p.code, checkbox.checked));
                
                const slider = document.createElement('span');
                slider.className = 'slider';
                
                switchLabel.appendChild(checkbox);
                switchLabel.appendChild(slider);
                tdStatus.appendChild(switchLabel);
                
                // Active Badge text
                const statusSpan = document.createElement('span');
                statusSpan.style.marginLeft = '0.5rem';
                statusSpan.className = (p.active !== false) ? 'badge-active' : 'badge-inactive';
                statusSpan.innerText = (p.active !== false) ? 'Activo' : 'Pausado';
                tdStatus.appendChild(statusSpan);
                
                tr.appendChild(tdStatus);

                // Action buttons
                const tdActions = document.createElement('td');
                const editBtn = document.createElement('button');
                editBtn.className = 'action-btn';
                editBtn.innerText = 'Editar';
                editBtn.addEventListener('click', () => openEditModal(p.code));
                tdActions.appendChild(editBtn);
                tr.appendChild(tdActions);

                tableBody.appendChild(tr);
            });

            if (filtered.length > 150) {
                const trMore = document.createElement('tr');
                trMore.innerHTML = `<td colspan="8" style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">Mostrando los primeros 150 de ${filtered.length} productos. Usa el buscador para filtrar más específicamente.</td>`;
                tableBody.appendChild(trMore);
            }
        }

        // Setup events
        function setupEventListeners() {
            searchInput.addEventListener('input', renderTable);
            filterCategory.addEventListener('change', renderTable);
            filterMaterial.addEventListener('change', renderTable);
            filterStatus.addEventListener('change', renderTable);

            addProductBtn.addEventListener('click', openAddModal);
            modalClose.addEventListener('click', closeModal);
            cancelBtn.addEventListener('click', closeModal);

            // Drag & Drop
            dropzone.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', handleFileSelect);

            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.style.borderColor = 'var(--gold-primary)';
            });

            dropzone.addEventListener('dragleave', () => {
                dropzone.style.borderColor = 'var(--border-color)';
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.style.borderColor = 'var(--border-color)';
                if (e.dataTransfer.files.length > 0) {
                    addFiles(e.dataTransfer.files);
                }
            });

            // Form Submit
            saveForm.addEventListener('submit', handleFormSubmit);

            // Helper to automatically fill pricing: Público = 2x Mayoreo
            formPriceMayoreo.addEventListener('input', () => {
                if (!formPriceCliente.value) {
                    formPriceCliente.placeholder = formPriceMayoreo.value * 2;
                }
            });
        }

        // Toggle active status
        async function toggleProductActive(code, isChecked) {
            const index = products.findIndex(p => p.code === code);
            if (index !== -1) {
                products[index].active = isChecked;
                
                if (window.db) {
                    try {
                        await window.db.collection('products').doc(code).update({ active: isChecked });
                        showToast(isChecked ? 'Producto activado en la nube' : 'Producto pausado en la nube', 'success');
                    } catch (err) {
                        console.error("Firestore toggle failed:", err);
                        showToast(`Error en la nube: ${err.message}`, 'error');
                    }
                } else {
                    saveDatabase();
                }
                
                updateStats();
                renderTable();
            }
        }

        // Open modal to add product
        function openAddModal() {
            isEditing = false;
            currentEditCode = '';
            selectedImages = [];
            saveForm.reset();
            formCode.disabled = false;
            formMultiAritos.checked = false;
            formRequiresInitial.checked = false;
            document.getElementById('p-allows-extra-kids').checked = false;
            document.getElementById('p-extra-kid-price').value = '';
            document.getElementById('extra-kid-price-container').style.display = 'none';
            document.getElementById('modal-heading').innerText = 'Agregar Nuevo Producto';
            renderImagePreviews();
            modal.classList.add('active');
        }

        // Open modal to edit product
        function openEditModal(code) {
            isEditing = true;
            currentEditCode = code;
            selectedImages = [];
            saveForm.reset();

            const prod = products.find(p => p.code === code);
            if (!prod) return;

            formCode.value = prod.code;
            formCode.disabled = true; // Code cannot be modified when editing
            formCategory.value = prod.category || 'Collares';
            formIsPersonalized.checked = prod.is_personalized === true || prod.subcategory === 'Personalizados';
            formIsMens.checked = prod.is_mens === true || prod.subcategory === 'Hombre' || prod.subcategory === 'Accesorios Hombre';
            formMaterial.value = prod.material || 'Acero Inoxidable';
            formPriceMayoreo.value = prod.price_mayoreo || 0;
            formPriceCliente.value = prod.price_cliente || '';
            formPriceCliente.placeholder = (prod.price_mayoreo || 0) * 2;
            formDetails.value = prod.details || '';
            formMultiAritos.checked = prod.multi_aritos === true;
            formRequiresInitial.checked = prod.requires_initial === true;
            document.getElementById('p-allows-extra-kids').checked = prod.allows_extra_kids === true;
            document.getElementById('p-extra-kid-price').value = prod.extra_kid_price || '';
            document.getElementById('extra-kid-price-container').style.display = prod.allows_extra_kids ? 'block' : 'none';

            document.getElementById('modal-heading').innerText = `Editar Producto: ${code}`;

            if (prod.images && prod.images.length > 0) {
                prod.images.forEach(img => {
                    selectedImages.push({ type: 'existing', url: img });
                });
            } else if (prod.has_image && prod.image) {
                selectedImages.push({ type: 'existing', url: prod.image });
            }

            renderImagePreviews();
            modal.classList.add('active');
        }

        // Close modal
        function closeModal() {
            modal.classList.remove('active');
        }

        // Handle file selection
        function handleFileSelect(e) {
            addFiles(e.target.files);
        }

        // Add files to selectedImages list
        function addFiles(files) {
            Array.from(files).forEach(file => {
                if (!file.type.startsWith('image/')) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    selectedImages.push({
                        type: 'new',
                        file: file,
                        dataUrl: ev.target.result
                    });
                    renderImagePreviews();
                };
                reader.readAsDataURL(file);
            });
        }

        // Render preview cards for both new and existing images
        function renderImagePreviews() {
            previewContainer.innerHTML = '';
            if (selectedImages.length === 0) {
                previewContainer.style.display = 'none';
                document.getElementById('dropzone-text').style.display = 'block';
                return;
            }
            
            document.getElementById('dropzone-text').style.display = 'none';
            previewContainer.style.display = 'flex';
            
            selectedImages.forEach((img, idx) => {
                const card = document.createElement('div');
                card.className = 'preview-card';
                card.style.position = 'relative';
                card.style.width = '100px';
                card.style.height = '100px';
                card.style.border = '1px solid var(--border-color)';
                card.style.borderRadius = '6px';
                card.style.overflow = 'hidden';
                card.style.backgroundColor = '#f9f9f9';
                
                const image = document.createElement('img');
                image.src = img.type === 'existing' ? img.url : img.dataUrl;
                image.style.width = '100%';
                image.style.height = '100%';
                image.style.objectFit = 'cover';
                image.style.transition = 'object-fit 0.2s';
                
                // Hover effect to preview vertical photo aspect ratio
                image.addEventListener('mouseenter', () => {
                    image.style.objectFit = 'contain';
                });
                image.addEventListener('mouseleave', () => {
                    image.style.objectFit = 'cover';
                });
                
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.innerHTML = '&times;';
                delBtn.style.position = 'absolute';
                delBtn.style.top = '4px';
                delBtn.style.right = '4px';
                delBtn.style.backgroundColor = 'rgba(244, 67, 54, 0.85)';
                delBtn.style.color = 'white';
                delBtn.style.border = 'none';
                delBtn.style.borderRadius = '50%';
                delBtn.style.width = '20px';
                delBtn.style.height = '20px';
                delBtn.style.fontSize = '12px';
                delBtn.style.fontWeight = 'bold';
                delBtn.style.cursor = 'pointer';
                delBtn.style.display = 'flex';
                delBtn.style.alignItems = 'center';
                delBtn.style.justifyContent = 'center';
                
                delBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation(); // Avoid triggering dropzone click
                    selectedImages.splice(idx, 1);
                    renderImagePreviews();
                });
                
                card.appendChild(image);
                card.appendChild(delBtn);
                previewContainer.appendChild(card);
            });
        }

        // Handle form submission (add/edit)
        async function handleFormSubmit(e) {
            if (e) e.preventDefault();
            const code = formCode.value.toUpperCase().trim();
            const material = formMaterial.value;
            const category = formCategory.value;
            const is_personalized = formIsPersonalized.checked;
            const is_mens = formIsMens.checked;
            const priceMayoreo = parseInt(formPriceMayoreo.value);
            let priceCliente = parseInt(formPriceCliente.value);
            const multiAritos = formMultiAritos.checked;
            const requiresInitial = formRequiresInitial.checked;
            const allowsExtraKids = document.getElementById('p-allows-extra-kids').checked;
            const extraKidPrice = parseInt(document.getElementById('p-extra-kid-price').value) || 0;

            if (isNaN(priceCliente)) {
                priceCliente = priceMayoreo * 2; // Auto double if empty
            }

            const details = formDetails.value.trim();

            if (!isEditing) {
                // Check duplicate code
                if (products.some(p => p.code === code)) {
                    showToast('Error: El código de producto ya existe.', 'error');
                    return;
                }
            }

            let imageUrls = selectedImages.filter(img => img.type === 'existing').map(img => img.url);
            const newFiles = selectedImages.filter(img => img.type === 'new');

            // Handle Image Upload if files selected
            if (newFiles.length > 0) {
                if (window.imgbbApiKey) {
                    showToast('Subiendo fotos a la nube (Imgbb)...', 'success');
                    try {
                        const uploadPromises = newFiles.map(async (img) => {
                            const formData = new FormData();
                            formData.append('key', window.imgbbApiKey);
                            formData.append('image', img.file);
                            
                            const response = await fetch('https://api.imgbb.com/1/upload', {
                                method: 'POST',
                                body: formData
                            });
                            
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            
                            const resData = await response.json();
                            if (resData.success) {
                                return resData.data.url;
                            } else {
                                throw new Error(resData.error.message || 'Error al subir a Imgbb');
                            }
                        });
                        
                        const uploadedUrls = await Promise.all(uploadPromises);
                        imageUrls = imageUrls.concat(uploadedUrls);
                        showToast('Fotos subidas a la nube con éxito.', 'success');
                    } catch (uploadErr) {
                        console.error("Imgbb upload failed:", uploadErr);
                        showToast(`Error al subir fotos a Imgbb: ${uploadErr.message}`, 'error');
                        return; // Stop execution if upload fails
                    }
                } else if (window.storage) {
                    showToast('Subiendo fotos a Firebase Storage...', 'success');
                    try {
                        const uploadPromises = newFiles.map(async (img, idx) => {
                            const timestamp = Date.now();
                            const ext = img.file.name.split('.').pop() || 'webp';
                            const storageRef = window.storage.ref().child(`products/${code}/${code}_${timestamp}_${idx}.${ext}`);
                            
                            const snapshot = await storageRef.put(img.file);
                            const downloadUrl = await snapshot.ref.getDownloadURL();
                            return downloadUrl;
                        });
                        
                        const uploadedUrls = await Promise.all(uploadPromises);
                        imageUrls = imageUrls.concat(uploadedUrls);
                        showToast('Fotos subidas a Firebase con éxito.', 'success');
                    } catch (uploadErr) {
                        console.error("Firebase Storage upload failed:", uploadErr);
                        showToast(`Error al subir fotos a Firebase: ${uploadErr.message}`, 'error');
                        return; // Stop execution if upload fails
                    }
                } else {
                    // Fallback to local server upload
                    const formData = new FormData();
                    formData.append('code', code);
                    newFiles.forEach(img => {
                        formData.append('images', img.file);
                    });

                    try {
                        const response = await fetch('http://localhost:8000/api/upload', {
                            method: 'POST',
                            body: formData
                        });
                        const resData = await response.json();
                        if (resData.status === 'success') {
                            imageUrls = imageUrls.concat(resData.image_urls);
                        } else {
                            throw new Error(resData.message || 'Error al subir fotos');
                        }
                    } catch (err) {
                        showToast(`Error al subir imágenes locales: ${err.message}. Se guardarán los demás cambios.`, 'error');
                    }
                }
            }

            const hasImage = imageUrls.length > 0;
            const mainImage = imageUrls[0] || '';
            let targetProductObj = null;

            if (isEditing) {
                // Update product in list
                const index = products.findIndex(p => p.code === currentEditCode);
                if (index !== -1) {
                    const existingProd = products[index];
                    products[index] = {
                        ...existingProd,
                        category,
                        is_personalized,
                        is_mens,
                        material,
                        price_mayoreo: priceMayoreo,
                        price_cliente: priceCliente,
                        details,
                        multi_aritos: multiAritos,
                        requires_initial: requiresInitial,
                        allows_extra_kids: allowsExtraKids,
                        extra_kid_price: extraKidPrice,
                        updated_at: Date.now(),
                        active: existingProd.active !== false,
                        created_at: existingProd.created_at || Date.now(),
                        has_image: hasImage,
                        image: mainImage,
                        images: imageUrls
                    };
                    targetProductObj = products[index];
                }
            } else {
                // Add new product
                const newProduct = {
                    code,
                    category,
                    is_personalized,
                    is_mens,
                    material,
                    price_mayoreo: priceMayoreo,
                    price_cliente: priceCliente,
                    details,
                    multi_aritos: multiAritos,
                    requires_initial: requiresInitial,
                    allows_extra_kids: allowsExtraKids,
                    extra_kid_price: extraKidPrice,
                    has_image: hasImage,
                    image: mainImage,
                    images: imageUrls,
                    active: true,
                    created_at: Date.now()
                };
                products.push(newProduct);
                targetProductObj = newProduct;
            }

            // Save changes (Cloud Firestore or Local Database)
            let saved = false;
            if (window.db && targetProductObj) {
                try {
                    showToast('Guardando en la nube...', 'success');
                    await window.db.collection('products').doc(targetProductObj.code).set(targetProductObj);
                    saved = true;
                    showToast(isEditing ? 'Producto actualizado en la nube' : 'Producto agregado en la nube', 'success');
                } catch (dbErr) {
                    console.error("Firestore save failed:", dbErr);
                    showToast(`Error al guardar en Firebase: ${dbErr.message}`, 'error');
                }
            } else {
                saved = await saveDatabase();
            }

            if (saved) {
                closeModal();
                renderTable();
                updateStats();
            }
        }

        // Save complete products list to backend server
        async function saveDatabase() {
            try {
                const response = await fetch('http://localhost:8000/api/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(products)
                });
                const resData = await response.json();
                if (resData.status === 'success') {
                    window.PRODUCTS_DATA = products; // Sync in memory
                    return true;
                } else {
                    showToast(`Error al guardar: ${resData.message}`, 'error');
                    return false;
                }
            } catch (e) {
                showToast(`Error de conexión con el servidor: ${e.message}. Asegúrate de estar ejecutando server.py`, 'error');
                return false;
            }
        }

        // Run setup
        init();
    