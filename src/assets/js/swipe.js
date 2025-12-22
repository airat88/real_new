/* ============================================
   SWIPE PAGE - Tinder-like Card Swiping
   ============================================ */

class SwipeApp {
    constructor(containerId = null, options = {}) {
        this.containerId = containerId;
        this.properties = options.properties || [];
        this.selectionName = options.selectionName || 'Property Selection';
        this.currentIndex = 0;
        this.reactions = [];
        this.currentPhotoIndex = 0;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;

        // Supabase integration
        this.selectionId = options.selectionId || null;
        this.selectionToken = options.selectionToken || null;
        this.selectionData = options.selectionData || null;

        // If properties were provided directly, skip loading and init immediately
        if (options.properties && options.properties.length > 0) {
            console.log(`📦 Using provided properties: ${this.properties.length}`);
            this.init();
        } else {
            this.loadProperties().then(() => this.init());
        }
    }

    // Format price
    formatPrice(price) {
        if (typeof price === 'number' && price > 0) {
            return '€' + price.toLocaleString();
        }
        if (typeof price === 'string') {
            if (price.includes('€')) return price;
            const num = parseInt(price.replace(/[^\d]/g, ''));
            if (!isNaN(num) && num > 0) {
                return '€' + num.toLocaleString();
            }
        }
        return price || 'Price on request';
    }

    async loadProperties() {
        const params = new URLSearchParams(window.location.search);

        // Priority 0: Check for preview mode (broker preview - no saving)
        const isPreview = params.get('preview') === 'true';
        const previewIds = params.get('ids');

        if (isPreview && previewIds) {
            console.log('👁️ Preview mode - reactions will not be saved');
            this.isPreviewMode = true;
            this.selectionName = 'Preview Mode';

            // First sync data if needed
            if (typeof DataSync !== 'undefined' && !DataSync.isLoaded()) {
                await DataSync.loadFromCSV();
            }

            // Get all properties
            const allProperties = typeof DataSync !== 'undefined' && DataSync.isLoaded()
                ? DataSync.getProperties()
                : (typeof PropertyData !== 'undefined'
                    ? PropertyData.getAll()
                    : (typeof MOCK_PROPERTIES !== 'undefined' ? MOCK_PROPERTIES : []));

            // Filter by preview IDs with order preservation
            const ids = previewIds.split(',').map(id => String(id.trim()));
            
            // Create Map for fast lookup
            const allPropertiesMap = new Map(
                allProperties.map(p => [String(p.id), p])
            );
            
            // Preserve order from URL params
            this.properties = ids
                .map(id => allPropertiesMap.get(id))
                .filter(p => p !== undefined);

            console.log(`📦 Preview: ${this.properties.length} properties out of ${allProperties.length} total`);
            console.log(`📦 Preview IDs:`, ids);
            return;
        }

        // Priority 1: Check for token in URL (Supabase selection)
        const token = params.get('t');

        if (token && typeof SupabaseClient !== 'undefined') {
            console.log('🔗 Loading selection by token:', token);

            try {
                const selection = await SupabaseClient.getSelectionByToken(token);

                if (!selection) {
                    this.showError('Selection not found', 'This link may be invalid or the selection was deleted.');
                    return;
                }

                if (selection.expired) {
                    this.showError('Selection expired', 'This selection link has expired. Please ask your broker for a new link.');
                    return;
                }

                this.selectionId = selection.id;
                this.selectionToken = token;
                this.selectionData = selection;
                this.selectionName = selection.name || 'Property Selection';

                // Load CSV data if not already loaded
                if (typeof DataSync !== 'undefined' && !DataSync.isLoaded()) {
                    await DataSync.loadFromCSV();
                }

                // Get property data
                const allProperties = typeof DataSync !== 'undefined' && DataSync.isLoaded()
                    ? DataSync.getProperties()
                    : (typeof PropertyData !== 'undefined'
                        ? PropertyData.getAll()
                        : (typeof MOCK_PROPERTIES !== 'undefined' ? MOCK_PROPERTIES : []));

                // Filter properties by IDs in selection
                const propertyIds = selection.property_ids || [];
                console.log('📦 Selection property_ids:', propertyIds);
                console.log('📦 Property IDs type:', typeof propertyIds, Array.isArray(propertyIds));
                console.log('📦 Total properties available:', allProperties.length);
                
                // CRITICAL FIX: Ensure property_ids is an array
                if (!Array.isArray(propertyIds)) {
                    console.error('⚠️ property_ids is not an array!', typeof propertyIds);
                    this.showError(
                        'Ошибка подборки',
                        'Неверный формат данных подборки. Пожалуйста, создайте новую подборку.'
                    );
                    return;
                }
                
                // CRITICAL FIX: If property_ids is empty, show error
                if (propertyIds.length === 0) {
                    console.error('⚠️ property_ids is empty!');
                    this.showError(
                        'Пустая подборка',
                        'В этой подборке нет объектов. Пожалуйста, создайте новую подборку с объектами.'
                    );
                    return;
                }
                
                // Debug: show first few property IDs
                if (allProperties.length > 0) {
                    console.log('📦 Sample property IDs from data:', allProperties.slice(0, 3).map(p => ({id: p.id, type: typeof p.id})));
                }
                
                // ✅ FIXED: Preserve order from property_ids while filtering
                console.log('🔍 Starting property filtering with order preservation...');
                
                // Strategy 1: Create Map for fast lookup + preserve order
                const allPropertiesMap = new Map(
                    allProperties.map(p => [String(p.id).trim().toLowerCase(), p])
                );
                
                // Filter with order from property_ids
                this.properties = propertyIds
                    .map(id => {
                        const normalizedId = String(id).trim().toLowerCase();
                        const property = allPropertiesMap.get(normalizedId);
                        if (!property) {
                            console.warn(`⚠️ Property not found: ${id}`);
                        }
                        return property;
                    })
                    .filter(p => p !== undefined);
                
                console.log('✅ Filtered to selection properties (Strategy 1):', this.properties.length);
                console.log('📊 Expected:', propertyIds.length, 'Got:', this.properties.length);
                console.log('✅ Order preserved from broker selection');
                
                // Strategy 2: If Strategy 1 failed, try without toLowerCase
                if (this.properties.length === 0 && propertyIds.length > 0) {
                    console.warn('⚠️ Strategy 1 failed, trying Strategy 2 (case-sensitive)...');
                    
                    const allPropertiesMap2 = new Map(
                        allProperties.map(p => [String(p.id).trim(), p])
                    );
                    
                    this.properties = propertyIds
                        .map(id => allPropertiesMap2.get(String(id).trim()))
                        .filter(p => p !== undefined);
                    
                    console.log('Strategy 2 result:', this.properties.length);
                }
                
                // Strategy 3: If still failed, try direct comparison
                if (this.properties.length === 0 && propertyIds.length > 0) {
                    console.warn('⚠️ Strategy 2 failed, trying Strategy 3 (direct)...');
                    
                    const allPropertiesMap3 = new Map(
                        allProperties.map(p => [p.id, p])
                    );
                    
                    this.properties = propertyIds
                        .map(id => allPropertiesMap3.get(id))
                        .filter(p => p !== undefined);
                    
                    console.log('Strategy 3 result:', this.properties.length);
                }
                
                // CRITICAL: If no properties after all strategies, show detailed error
                if (this.properties.length === 0 && propertyIds.length > 0) {
                    console.error('⚠️ FILTERING PROBLEM DETECTED - All strategies failed!');
                    console.error('propertyIds from selection:', propertyIds);
                    console.error('propertyIds types:', propertyIds.map(id => typeof id));
                    console.error('Available property IDs (first 10):', allProperties.slice(0, 10).map(p => ({
                        id: p.id,
                        type: typeof p.id,
                        title: p.title
                    })));
                    
                    // Show detailed error with debugging info
                    this.showError(
                        'Ошибка фильтрации объектов',
                        `Не удалось найти объекты из подборки.<br><br>
                        <b>Отладочная информация:</b><br>
                        • ID в подборке: ${propertyIds.slice(0, 3).join(', ')}${propertyIds.length > 3 ? '...' : ''}<br>
                        • Всего ID в подборке: ${propertyIds.length}<br>
                        • Всего доступных объектов: ${allProperties.length}<br>
                        <br>
                        Откройте консоль (F12) для подробностей.<br>
                        Возможно, база данных не синхронизирована с CSV.`
                    );
                    return;
                }

                // Add broker_phone from selection to each property
                if (selection.broker_phone) {
                    this.properties = this.properties.map(p => ({
                        ...p,
                        broker_phone: selection.broker_phone,
                        brokerPhone: selection.broker_phone  // Support both naming conventions
                    }));
                    console.log('📞 Broker phone added to properties:', selection.broker_phone);
                }

                // Load existing reactions to skip already-reviewed properties
                const existingReactions = await SupabaseClient.getSelectionReactions(selection.id);
                const reviewedIds = new Set(existingReactions.map(r => r.property_id));

                // Filter out already reviewed properties
                this.properties = this.properties.filter(p => !reviewedIds.has(p.id));

                // Load existing reactions into our reactions array
                existingReactions.forEach(r => {
                    this.reactions.push({
                        propertyId: r.property_id,
                        propertyTitle: r.property_title,
                        reaction: r.reaction,
                        timestamp: r.created_at,
                        synced: true
                    });
                });

                console.log(`📦 Loaded ${this.properties.length} remaining properties from selection (${existingReactions.length} already reviewed)`);

                // If all properties already reviewed, show completion
                if (this.properties.length === 0 && existingReactions.length > 0) {
                    this.showCompletion();
                }

                return;
            } catch (error) {
                console.error('Failed to load selection from Supabase:', error);
                // Fall through to localStorage/mock data
            }
        }

        // Priority 2: Check for broker's selection in localStorage
        const currentSelection = localStorage.getItem('current_selection');
        if (currentSelection) {
            try {
                const parsed = JSON.parse(currentSelection);
                if (parsed && parsed.length > 0) {
                    this.properties = parsed;
                    this.selectionName = 'Your Property Selection';
                    this.selectionId = localStorage.getItem('current_selection_id');
                    console.log(`📦 Loaded ${this.properties.length} properties from broker selection`);
                    return;
                }
            } catch (e) {
                console.warn('Failed to parse current selection');
            }
        }

        // Priority 3: Use synced/mock data
        if (typeof PropertyData !== 'undefined') {
            this.properties = PropertyData.getAll();
        } else if (typeof MOCK_PROPERTIES !== 'undefined') {
            this.properties = MOCK_PROPERTIES;
        } else {
            this.properties = [];
        }

        if (typeof MOCK_SELECTION !== 'undefined' && MOCK_SELECTION.name) {
            this.selectionName = MOCK_SELECTION.name;
        }

        console.log(`📦 Loaded ${this.properties.length} properties`);
    }

    showError(title, message) {
        document.querySelector('.cards-stack').innerHTML = `
            <div class="empty-state">
                <div class="empty-state__icon">⚠️</div>
                <div class="empty-state__title" style="color: var(--danger); font-weight: 600; margin-bottom: var(--space-sm);">${title}</div>
                <div class="empty-state__text">${message}</div>
            </div>
        `;
        document.querySelector('.swipe-actions').style.display = 'none';
    }

    init() {
        if (this.properties.length === 0) {
            this.showEmptyState();
            return;
        }

        // Create structure if container ID was provided
        if (this.containerId) {
            this.createStructure();
        }

        this.renderHeader();
        this.renderCards();
        this.renderActions();
        this.bindEvents();
        this.updateProgress();
    }

    createStructure() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('Container not found:', this.containerId);
            return;
        }

        container.innerHTML = `
            <div class="swipe-container">
                <div class="swipe-header"></div>
                <div class="cards-stack"></div>
                <div class="swipe-actions"></div>
            </div>

            <!-- Details Modal -->
            <div class="details-modal">
                <div class="details-modal__overlay"></div>
                <div class="details-modal__content">
                    <button class="details-modal__close">✕</button>
                    <div class="details-modal__body"></div>
                </div>
            </div>
        `;
    }

    showEmptyState() {
        document.querySelector('.cards-stack').innerHTML = `
            <div class="empty-state">
                <div class="empty-state__icon">📭</div>
                <div class="empty-state__text">No properties in this selection</div>
            </div>
        `;
    }

    renderHeader() {
        const header = document.querySelector('.swipe-header');
        const previewBadge = this.isPreviewMode
            ? '<span style="background: var(--warning); color: var(--dark); padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; margin-left: 8px;">PREVIEW</span>'
            : '';
        header.innerHTML = `
            <button class="swipe-header__back" onclick="window.close()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
            </button>
            <div class="swipe-header__title">${this.selectionName}${previewBadge}</div>
            <div class="swipe-header__progress">
                <span class="progress-text">1/${this.properties.length}</span>
                <div class="progress-bar">
                    <div class="progress-bar__fill" style="width: 0%"></div>
                </div>
            </div>
        `;
    }

    renderCards() {
        const container = document.querySelector('.cards-stack');
        container.innerHTML = '';

        // Render up to 3 cards (current + 2 behind)
        const cardsToRender = Math.min(3, this.properties.length - this.currentIndex);

        for (let i = cardsToRender - 1; i >= 0; i--) {
            const property = this.properties[this.currentIndex + i];
            const card = this.createCard(property, i);
            container.appendChild(card);
        }
    }

    createCard(property, stackIndex) {
        const card = document.createElement('div');
        card.className = 'property-card';
        card.dataset.id = property.id;

        if (stackIndex === 1) card.classList.add('property-card--behind');
        if (stackIndex === 2) card.classList.add('property-card--far-behind');

        const bedroomText = property.bedrooms === 0 ? 'Studio' : `${property.bedrooms} bed`;
        const photo = (property.photos && property.photos[0]) || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800';
        
        // Get price from source
        const price = property.price || 'Price on request';
        
        const photos = property.photos || [photo];

        // Store photos as data attribute for gallery
        card.dataset.photos = JSON.stringify(photos);

        card.innerHTML = `
            <div class="property-card__image" style="background-image: url('${photo}')"
                 onerror="this.style.backgroundImage='url(https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800)'"></div>

            <div class="property-card__gallery">
                ${photos.slice(0, 5).map((_, idx) => `
                    <div class="gallery-dot ${idx === 0 ? 'gallery-dot--active' : ''}" data-index="${idx}"></div>
                `).join('')}
            </div>

            ${photos.length > 1 ? `<button class="property-card__photo-expand" title="View all photos">📷 ${photos.length}</button>` : ''}

            <div class="swipe-indicator swipe-indicator--like">LIKE</div>
            <div class="swipe-indicator swipe-indicator--nope">NOPE</div>

            <div class="property-card__tap-hint">Tap for details</div>

            <div class="property-card__actions">
                <button class="card-action-btn card-action-btn--dislike" data-action="dislike" title="Not interested">
                    ✕
                </button>
                <button class="card-action-btn card-action-btn--info" data-action="info" title="More details">
                    ℹ️
                </button>
                <button class="card-action-btn card-action-btn--like" data-action="like" title="Like it!">
                    ♥
                </button>
            </div>

            <div class="property-card__content">
                <div class="property-card__price">
                    <div>${price}</div>
                </div>
                ${property.projectTitle ? `<div class="property-card__object">${property.projectTitle}</div>` : ''}
                <div class="property-card__title">${property.title || 'Property'}</div>
                <div class="property-card__location">
                    <span>📍</span>
                    <span>${property.location || 'Cyprus'}</span>
                </div>
                <div class="property-card__tags">
                    <span class="property-tag">🛏️ ${bedroomText}</span>
                    <span class="property-tag">📐 ${property.area || 0} m²</span>
                    ${property.status ? `<span class="property-tag">🏷️ ${property.status}</span>` : ''}
                </div>
            </div>
        `;

        return card;
    }

    renderActions() {
        const actions = document.querySelector('.swipe-actions');
        // Hide bottom actions since we now have them on the card
        actions.style.display = 'none';
        actions.innerHTML = `
            <button class="action-btn action-btn--dislike" data-action="dislike" title="Not interested">
                ✕
            </button>
            <button class="action-btn action-btn--info" data-action="info" title="More details">
                ℹ️
            </button>
            <button class="action-btn action-btn--like" data-action="like" title="Like it!">
                ♥
            </button>
        `;
    }

    bindEvents() {
        // Action buttons (bottom - keep for backward compatibility)
        const bottomActions = document.querySelector('.swipe-actions');
        if (bottomActions) {
            bottomActions.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;

                const action = btn.dataset.action;
                if (action === 'like') this.swipe('like');
                else if (action === 'dislike') this.swipe('dislike');
                else if (action === 'info') this.showDetails();
            });
        }

        // Card touch/mouse events
        this.bindCardEvents();

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') this.swipe('like');
            else if (e.key === 'ArrowLeft') this.swipe('dislike');
            else if (e.key === ' ' || e.key === 'Enter') this.showDetails();
        });

        // Card click handler
        document.querySelector('.cards-stack').addEventListener('click', (e) => {
            const card = e.target.closest('.property-card');
            if (!card || card.classList.contains('property-card--behind')) return;

            // If clicking card action buttons - handle action
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                e.stopPropagation(); // Prevent opening details
                const action = actionBtn.dataset.action;
                if (action === 'like') this.swipe('like');
                else if (action === 'dislike') this.swipe('dislike');
                else if (action === 'info') this.showDetails();
                return;
            }

            // If clicking the gallery dots - navigate photos
            if (e.target.classList.contains('gallery-dot')) {
                const index = parseInt(e.target.dataset.index);
                this.currentPhotoIndex = index;
                this.updateCardPhoto();
                return;
            }

            // If clicking photo expand button - open fullscreen gallery
            if (e.target.classList.contains('property-card__photo-expand')) {
                this.openFullscreenGallery();
                return;
            }

            // Default action: open details/info modal
            this.showDetails();
        });

        // Fullscreen gallery swipe
        this.bindGallerySwipe();

        // Close fullscreen gallery on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeFullscreenGallery();
            }
        });
    }

    bindCardEvents() {
        const container = document.querySelector('.cards-stack');

        // Touch events
        container.addEventListener('touchstart', (e) => this.onDragStart(e), { passive: true });
        container.addEventListener('touchmove', (e) => this.onDragMove(e), { passive: false });
        container.addEventListener('touchend', (e) => this.onDragEnd(e));

        // Mouse events
        container.addEventListener('mousedown', (e) => this.onDragStart(e));
        document.addEventListener('mousemove', (e) => this.onDragMove(e));
        document.addEventListener('mouseup', (e) => this.onDragEnd(e));
    }

    onDragStart(e) {
        const card = document.querySelector('.property-card:not(.property-card--behind):not(.property-card--far-behind)');
        if (!card) return;

        this.isDragging = true;
        this.startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        this.startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        this.currentX = 0;

        card.style.transition = 'none';
    }

    onDragMove(e) {
        if (!this.isDragging) return;

        const card = document.querySelector('.property-card:not(.property-card--behind):not(.property-card--far-behind)');
        if (!card) return;

        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

        this.currentX = clientX - this.startX;
        const currentY = clientY - this.startY;

        // Prevent vertical scroll when swiping horizontally
        if (Math.abs(this.currentX) > Math.abs(currentY) && e.type === 'touchmove') {
            e.preventDefault();
        }

        const rotate = this.currentX * 0.1;
        card.style.transform = `translateX(${this.currentX}px) rotate(${rotate}deg)`;

        // Show indicators
        card.classList.remove('property-card--dragging-right', 'property-card--dragging-left');
        if (this.currentX > 50) {
            card.classList.add('property-card--dragging-right');
        } else if (this.currentX < -50) {
            card.classList.add('property-card--dragging-left');
        }
    }

    onDragEnd(e) {
        if (!this.isDragging) return;
        this.isDragging = false;

        const card = document.querySelector('.property-card:not(.property-card--behind):not(.property-card--far-behind)');
        if (!card) return;

        card.style.transition = '';
        card.classList.remove('property-card--dragging-right', 'property-card--dragging-left');

        const threshold = 100;

        if (this.currentX > threshold) {
            this.swipe('like');
        } else if (this.currentX < -threshold) {
            this.swipe('dislike');
        } else {
            card.style.transform = '';
        }
    }

    async swipe(direction) {
        if (this.currentIndex >= this.properties.length) return;

        const card = document.querySelector('.property-card:not(.property-card--behind):not(.property-card--far-behind)');
        if (!card) return;

        const property = this.properties[this.currentIndex];

        // Save reaction locally
        const reaction = {
            propertyId: property.id,
            propertyTitle: property.title,
            reaction: direction,
            timestamp: new Date().toISOString(),
            synced: false
        };
        this.reactions.push(reaction);

        // Save to Supabase if we have a selection ID (not in preview mode)
        if (this.selectionId && !this.isPreviewMode && typeof SupabaseClient !== 'undefined') {
            try {
                await SupabaseClient.saveReaction(
                    this.selectionId,
                    property.id,
                    property.title,
                    direction
                );
                reaction.synced = true;
                console.log(`✅ Reaction saved: ${direction} for "${property.title}"`);
            } catch (error) {
                console.error('Failed to save reaction to Supabase:', error);
                // Continue anyway - reaction is saved locally
            }
        }

        // Animate card out
        card.classList.add(direction === 'like' ? 'property-card--swiping-right' : 'property-card--swiping-left');

        // Add haptic feedback on mobile
        if (navigator.vibrate) {
            navigator.vibrate(direction === 'like' ? [50] : [30, 30]);
        }

        setTimeout(() => {
            this.currentIndex++;
            this.currentPhotoIndex = 0;
            this.updateProgress();

            if (this.currentIndex >= this.properties.length) {
                this.showCompletion();
            } else {
                this.renderCards();
            }
        }, 300);
    }

    nextPhoto() {
        const property = this.properties[this.currentIndex];
        if (!property || !property.photos) return;

        this.currentPhotoIndex = (this.currentPhotoIndex + 1) % property.photos.length;
        this.updateCardPhoto();
    }

    prevPhoto() {
        const property = this.properties[this.currentIndex];
        if (!property || !property.photos) return;

        this.currentPhotoIndex = (this.currentPhotoIndex - 1 + property.photos.length) % property.photos.length;
        this.updateCardPhoto();
    }

    updateCardPhoto() {
        const card = document.querySelector('.property-card:not(.property-card--behind)');
        if (!card) return;

        const property = this.properties[this.currentIndex];
        if (!property.photos || property.photos.length === 0) return;

        const imageEl = card.querySelector('.property-card__image');
        const dots = card.querySelectorAll('.gallery-dot');

        imageEl.style.backgroundImage = `url('${property.photos[this.currentPhotoIndex]}')`;

        dots.forEach((dot, idx) => {
            dot.classList.toggle('gallery-dot--active', idx === this.currentPhotoIndex);
        });
    }

    updateProgress() {
        const total = this.properties.length;
        const current = Math.min(this.currentIndex + 1, total);
        const percentage = (this.currentIndex / total) * 100;

        const progressText = document.querySelector('.progress-text');
        const progressFill = document.querySelector('.progress-bar__fill');

        if (progressText) progressText.textContent = `${current}/${total}`;
        if (progressFill) progressFill.style.width = `${percentage}%`;
    }

    showDetails() {
        const property = this.properties[this.currentIndex];
        if (!property) return;

        const modal = document.querySelector('.details-modal');
        const bedroomText = property.bedrooms === 0 ? 'Studio' : property.bedrooms;
        const photos = property.photos || ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'];
        
        // Get price from source
        const price = property.price || 'Price on request';

        modal.querySelector('.details-modal__body').innerHTML = `
            <div class="details-gallery">
                <div class="details-gallery__main">
                    <img src="${photos[0]}" alt="${property.title}" id="mainPhoto"
                         onerror="this.src='https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'">
                    ${photos.length > 1 ? `<button class="details-gallery__expand" id="viewAllPhotosBtn">📷 View all ${photos.length} photos</button>` : ''}
                </div>
                ${photos.slice(0, 6).map((photo, idx) => `
                    <div class="details-gallery__thumb ${idx === 0 ? 'details-gallery__thumb--active' : ''}" data-photo="${photo}">
                        <img src="${photo}" alt="Photo ${idx + 1}"
                             onerror="this.src='https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'">
                    </div>
                `).join('')}
            </div>

            <div class="details-info">
                <div class="details-price">
                    <div>${price}</div>
                </div>
                <div class="details-title">${property.title || 'Property'}</div>
                <div class="details-location">
                    <span>📍</span>
                    <span>${property.location || 'Cyprus'}</span>
                </div>
                
                ${property.broker_phone || property.brokerPhone ? `
                <div style="margin-top: 20px;">
                    <a href="tel:${property.broker_phone || property.brokerPhone}" class="btn btn-primary" style="text-decoration: none; display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; font-weight: 600; border: none; box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4); transition: all 0.3s; text-align: center; width: 100%; font-size: 1rem;">
                        📞 Позвонить брокеру
                    </a>
                </div>
                ` : ''}

                <div class="details-stats">
                    <div class="details-stat">
                        <div class="details-stat__value">${bedroomText}</div>
                        <div class="details-stat__label">Bedrooms</div>
                    </div>
                    <div class="details-stat">
                        <div class="details-stat__value">${property.bathrooms || '-'}</div>
                        <div class="details-stat__label">Bathrooms</div>
                    </div>
                    <div class="details-stat">
                        <div class="details-stat__value">${property.area || '-'}</div>
                        <div class="details-stat__label">m²</div>
                    </div>
                </div>

                ${property.description ? `
                    <div class="details-description">
                        ${property.description}
                    </div>
                ` : ''}

                ${property.features ? `
                    <div class="details-features">
                        ${property.features.split(/[,;]/).map(f => f.trim()).filter(f => f).map(f => `
                            <span class="details-feature">${f}</span>
                        `).join('')}
                    </div>
                ` : ''}

                <div class="details-price-info" style="margin-top: var(--space-md); padding: var(--space-md); background: var(--gray-100); border-radius: var(--radius-lg);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-sm);">
                        <span style="color: var(--gray-600);">Price per m²</span>
                        <span style="font-weight: 600;">€${(property.priceSqm || 0).toLocaleString()}</span>
                    </div>
                    ${property.status ? `
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--gray-600);">Status</span>
                            <span class="badge badge-primary">${property.status}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Thumbnail click handler
        modal.querySelectorAll('.details-gallery__thumb').forEach(thumb => {
            thumb.addEventListener('click', () => {
                const photo = thumb.dataset.photo;
                modal.querySelector('#mainPhoto').src = photo;
                modal.querySelectorAll('.details-gallery__thumb').forEach(t => t.classList.remove('details-gallery__thumb--active'));
                thumb.classList.add('details-gallery__thumb--active');
            });
        });

        // View all photos button
        const viewPhotosBtn = modal.querySelector('#viewAllPhotosBtn');
        if (viewPhotosBtn) {
            viewPhotosBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                modal.classList.remove('details-modal--open');
                setTimeout(() => this.openFullscreenGallery(), 100);
            });
        }

        modal.classList.add('details-modal--open');

        // Close button - use addEventListener for reliable binding
        const closeBtn = modal.querySelector('.details-modal__close');
        if (closeBtn) {
            // Remove old handlers by cloning
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                modal.classList.remove('details-modal--open');
            });
        }

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('details-modal__content')) {
                modal.classList.remove('details-modal--open');
            }
        });
    }

    async showCompletion() {
        const likes = this.reactions.filter(r => r.reaction === 'like');
        const dislikes = this.reactions.filter(r => r.reaction === 'dislike');

        // Save results to localStorage
        const results = {
            completedAt: new Date().toISOString(),
            selectionId: this.selectionId,
            totalProperties: this.selectionData ? this.selectionData.total_properties : this.properties.length,
            reactions: this.reactions,
            liked: likes.map(r => ({
                id: r.propertyId,
                title: r.propertyTitle
            }))
        };
        localStorage.setItem('swipe_results', JSON.stringify(results));

        // Update selection status in Supabase if completed
        if (this.selectionId && typeof SupabaseClient !== 'undefined') {
            try {
                await SupabaseClient.updateSelectionStatus(this.selectionId, 'completed');
                console.log('✅ Selection marked as completed');
            } catch (error) {
                console.error('Failed to update selection status:', error);
            }
        }

        const screen = document.querySelector('.completion-screen');
        
        // Get broker info from selection data
        const brokerName = this.selectionData?.brokers?.name || 
                          this.selectionData?.broker_name || 
                          'Брокер';
        const brokerPhone = this.selectionData?.broker_phone || 
                           this.selectionData?.brokers?.phone || 
                           null;
        const brokerEmail = this.selectionData?.broker_email || 
                           this.selectionData?.brokers?.email || 
                           null;
        const brokerWhatsApp = this.selectionData?.broker_whatsapp || 
                              brokerPhone; // Default to phone if whatsapp not set
        const brokerTelegram = this.selectionData?.broker_telegram || null;
        const brokerViber = this.selectionData?.broker_viber || brokerPhone;

        // Store broker info for modal
        this.brokerContacts = {
            name: brokerName,
            phone: brokerPhone,
            email: brokerEmail,
            whatsapp: brokerWhatsApp,
            telegram: brokerTelegram,
            viber: brokerViber
        };

        // Generate liked properties message for messengers
        const likedPropertiesText = likes.length > 0 
            ? `Мне понравились объекты: ${likes.map(l => l.propertyId || l.propertyTitle).join(', ')}`
            : 'Здравствуйте! Я просмотрел подборку недвижимости.';

        this.messageText = encodeURIComponent(likedPropertiesText);

        screen.innerHTML = `
            <div class="completion-icon">🎉</div>
            <h2 class="completion-title">Готово!</h2>
            <p class="completion-text">
                Вы просмотрели всю подборку!
            </p>
            <div class="completion-stats">
                <div class="completion-stat">
                    <div class="completion-stat__value completion-stat__value--like">${likes.length}</div>
                    <div class="completion-stat__label">Понравилось</div>
                </div>
                <div class="completion-stat">
                    <div class="completion-stat__value completion-stat__value--dislike">${dislikes.length}</div>
                    <div class="completion-stat__label">Пропущено</div>
                </div>
            </div>
            
            ${likes.length > 0 ? `
                <div style="text-align: left; width: 100%; max-width: 300px; margin-bottom: var(--space-lg);">
                    <p style="font-size: 0.875rem; opacity: 0.7; margin-bottom: var(--space-sm);">Понравившиеся объекты:</p>
                    ${likes.map(l => `
                        <div style="padding: var(--space-sm); background: rgba(255,255,255,0.1); border-radius: var(--radius); margin-bottom: var(--space-xs); font-size: 0.875rem;">
                            ❤️ ${l.propertyId || l.propertyTitle}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <div class="completion-actions" style="display: flex; flex-direction: column; gap: var(--space-md); width: 100%; max-width: 300px;">
                
                <!-- 1. Позвонить брокеру -->
                ${brokerPhone ? `
                    <a href="tel:${brokerPhone}" class="btn btn-primary btn-lg completion-btn" style="text-decoration: none;">
                        <span class="completion-btn__icon">📞</span>
                        <span class="completion-btn__text">
                            <span class="completion-btn__title">Позвонить брокеру</span>
                            <span class="completion-btn__subtitle">${this.formatPhone(brokerPhone)}</span>
                        </span>
                    </a>
                ` : ''}
                
                <!-- 2. Написать брокеру -->
                <button class="btn btn-secondary btn-lg completion-btn" onclick="window.swipeAppInstance && window.swipeAppInstance.showContactModal()">
                    <span class="completion-btn__icon">💬</span>
                    <span class="completion-btn__text">
                        <span class="completion-btn__title">Написать брокеру</span>
                        <span class="completion-btn__subtitle">WhatsApp, Telegram, Email</span>
                    </span>
                </button>
                
                <!-- 3. Пока не подошли -->
                ${dislikes.length > 0 ? `
                    <button class="btn btn-outline btn-lg completion-btn" onclick="window.swipeAppInstance && window.swipeAppInstance.reviewDisliked()">
                        <span class="completion-btn__icon">🔄</span>
                        <span class="completion-btn__text">
                            <span class="completion-btn__title">Пока не подошли</span>
                            <span class="completion-btn__subtitle">Посмотреть ещё раз (${dislikes.length})</span>
                        </span>
                    </button>
                ` : ''}
                
                <!-- 4. Поделиться подборкой -->
                <button class="btn btn-outline btn-lg completion-btn" onclick="window.swipeAppInstance && window.swipeAppInstance.shareSelection()" style="border-color: rgba(255,255,255,0.3);">
                    <span class="completion-btn__icon">📤</span>
                    <span class="completion-btn__text">
                        <span class="completion-btn__title">Поделиться подборкой</span>
                        <span class="completion-btn__subtitle">Отправить друзьям</span>
                    </span>
                </button>
            </div>
            
            <!-- Contact Modal -->
            <div id="contactModal" class="contact-modal">
                <div class="contact-modal__content">
                    <div class="contact-modal__header">
                        <h3>Написать брокеру</h3>
                        <button class="contact-modal__close" onclick="window.swipeAppInstance && window.swipeAppInstance.hideContactModal()">✕</button>
                    </div>
                    <div class="contact-modal__body">
                        <p style="margin-bottom: var(--space-md); opacity: 0.8; font-size: 0.875rem;">Выберите удобный способ связи:</p>
                        
                        ${brokerWhatsApp ? `
                            <a href="https://wa.me/${this.cleanPhone(brokerWhatsApp)}?text=${this.messageText}" 
                               target="_blank" class="contact-option contact-option--whatsapp">
                                <span class="contact-option__icon">
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                </span>
                                <span class="contact-option__text">WhatsApp</span>
                            </a>
                        ` : ''}
                        
                        ${brokerTelegram ? `
                            <a href="https://t.me/${brokerTelegram.replace('@', '')}?text=${this.messageText}" 
                               target="_blank" class="contact-option contact-option--telegram">
                                <span class="contact-option__icon">
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                                    </svg>
                                </span>
                                <span class="contact-option__text">Telegram</span>
                            </a>
                        ` : ''}
                        
                        ${brokerViber ? `
                            <a href="viber://chat?number=${this.cleanPhone(brokerViber)}" 
                               target="_blank" class="contact-option contact-option--viber">
                                <span class="contact-option__icon">
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                        <path d="M11.4 0C9.473.028 5.333.344 3.02 2.467 1.302 4.187.614 6.77.535 9.97c-.08 3.203-.166 9.212 5.64 10.878h.004l-.003 2.46s-.037.996.62 1.198c.792.245 1.258-.51 2.016-1.327.418-.449.992-1.107 1.426-1.612 3.937.332 6.962-.426 7.307-.538.8-.26 5.32-.84 6.053-6.853.757-6.2-.36-10.112-2.363-11.874C19.08.95 15.95.027 11.4 0zm.33 1.9c3.996.027 6.783.705 8.404 2.205 1.766 1.553 2.479 4.818 1.868 9.86-.607 4.96-4.063 5.56-4.705 5.768-.282.09-2.912.747-6.218.535 0 0-2.463 2.97-3.232 3.74-.12.12-.262.168-.356.144-.132-.033-.168-.187-.165-.412l.02-4.058c-4.79-1.393-4.51-6.27-4.447-8.99.064-2.72.607-4.899 2.022-6.297 1.796-1.754 5.467-2.5 6.81-2.495zM12.4 4.9c-.14 0-.254.113-.254.253 0 .14.114.252.254.252.702.007 1.46.18 1.935.39.378.168.678.39.886.64.21.253.34.527.405.824.076.35.11.638.11 1.466-.008.142.104.26.247.268h.006c.136 0 .25-.106.257-.244.002-.85-.034-1.21-.13-1.652-.09-.41-.265-.78-.55-1.123-.286-.342-.662-.617-1.125-.823-.576-.257-1.41-.444-2.208-.452l.167.2zm-1.22.903c-.584 0-1.208.166-1.584.498l-.003.003c-.396.332-.678.71-.83 1.203-.152.49-.162.992-.162 1.498 0 .19-.032.383.02.573.1.368.5.644.748.646.37.003.563-.304.578-.63.01-.21-.02-.413-.013-.624.01-.266-.004-.502.05-.716.05-.206.146-.35.326-.49.168-.133.503-.262.87-.262.19 0 .403.064.59.11.178.045.34.09.494.166.314.156.508.378.65.667.103.21.064.48.078.732.004.07.007.14.012.21a.263.263 0 0 0 .507.09l.003-.01c.093-.337.085-.69.033-1.012-.052-.32-.155-.632-.36-.936-.218-.324-.54-.582-.95-.774-.253-.12-.574-.224-.877-.286-.303-.063-.614-.103-.907-.106h-.02l-.253-.15zm5.03.994c-.14 0-.254.113-.254.253s.114.253.254.253c.64.02.927.263 1.043.857.058.29.053.682.052 1.123-.002.142.11.258.253.26h.003c.14 0 .254-.112.256-.252.002-.44.008-.87-.066-1.243-.148-.753-.64-1.19-1.542-1.25zm-5.038.51c-.324 0-.706.097-.99.3-.28.203-.488.497-.564.92-.037.2-.034.42-.017.63l.012.155c.025.285.1.643.16.893.123.497.3.993.593 1.428.43.64 1.058 1.2 1.844 1.596.39.196.858.37 1.318.447.248.042.492.055.72.02.34-.053.633-.192.885-.442.26-.256.368-.565.327-.944-.034-.312-.21-.49-.44-.625-.132-.076-.273-.147-.414-.22l-.446-.23c-.197-.094-.39-.21-.603-.268-.317-.085-.647.09-.848.324l-.254.303c-.12.145-.28.117-.28.117s-.693-.19-1.248-.61c-.314-.24-.535-.496-.758-.842 0 0-.072-.148.062-.28l.264-.29c.17-.188.28-.48.222-.775-.044-.22-.142-.418-.24-.618l-.242-.478c-.086-.167-.174-.333-.284-.48-.152-.206-.38-.32-.628-.32l-.107-.01zm4.327.396c-.14 0-.254.113-.254.253s.113.253.253.253c.31 0 .494.073.614.182.12.11.2.27.234.52.04.248.038.552.036.89-.002.142.11.258.252.26h.003c.14 0 .254-.112.256-.252.003-.34.005-.668-.045-.98-.05-.31-.166-.596-.402-.815-.236-.22-.575-.31-.946-.31z"/>
                                    </svg>
                                </span>
                                <span class="contact-option__text">Viber</span>
                            </a>
                        ` : ''}
                        
                        ${brokerEmail ? `
                            <a href="mailto:${brokerEmail}?subject=Подборка недвижимости&body=${this.messageText}" 
                               class="contact-option contact-option--email">
                                <span class="contact-option__icon">📧</span>
                                <span class="contact-option__text">Email</span>
                            </a>
                        ` : ''}
                        
                        ${!brokerWhatsApp && !brokerTelegram && !brokerViber && !brokerEmail ? `
                            <p style="text-align: center; opacity: 0.6;">Контакты брокера не указаны</p>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <style>
                .completion-btn {
                    display: flex !important;
                    align-items: center;
                    gap: var(--space-md);
                    padding: var(--space-md) var(--space-lg) !important;
                    text-align: left;
                    width: 100%;
                }
                .completion-btn__icon {
                    font-size: 1.5rem;
                    flex-shrink: 0;
                }
                .completion-btn__text {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .completion-btn__title {
                    font-weight: 600;
                    font-size: 1rem;
                }
                .completion-btn__subtitle {
                    font-size: 0.75rem;
                    opacity: 0.7;
                }
                
                .contact-modal {
                    display: none;
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: 1000;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-md);
                }
                .contact-modal--open {
                    display: flex;
                }
                .contact-modal__content {
                    background: var(--bg-primary);
                    border-radius: var(--radius-lg);
                    max-width: 320px;
                    width: 100%;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                }
                .contact-modal__header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--space-md) var(--space-lg);
                    border-bottom: 1px solid var(--border-color);
                }
                .contact-modal__header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                }
                .contact-modal__close {
                    background: none;
                    border: none;
                    font-size: 1.25rem;
                    cursor: pointer;
                    opacity: 0.6;
                    padding: var(--space-xs);
                }
                .contact-modal__close:hover {
                    opacity: 1;
                }
                .contact-modal__body {
                    padding: var(--space-lg);
                }
                
                .contact-option {
                    display: flex;
                    align-items: center;
                    gap: var(--space-md);
                    padding: var(--space-md);
                    border-radius: var(--radius);
                    margin-bottom: var(--space-sm);
                    text-decoration: none;
                    color: white;
                    font-weight: 500;
                    transition: transform 0.2s, opacity 0.2s;
                }
                .contact-option:hover {
                    transform: scale(1.02);
                    opacity: 0.9;
                }
                .contact-option__icon {
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.2);
                    border-radius: 50%;
                    font-size: 1.25rem;
                }
                .contact-option__icon svg {
                    width: 24px;
                    height: 24px;
                }
                .contact-option--whatsapp {
                    background: linear-gradient(135deg, #25D366, #128C7E);
                }
                .contact-option--telegram {
                    background: linear-gradient(135deg, #2AABEE, #229ED9);
                }
                .contact-option--viber {
                    background: linear-gradient(135deg, #7360F2, #59267C);
                }
                .contact-option--email {
                    background: linear-gradient(135deg, #EA4335, #C5221F);
                }
            </style>
        `;

        screen.classList.add('completion-screen--visible');

        // Store instance globally for button callbacks
        window.swipeAppInstance = this;

        console.log('✅ Selection completed:', results);
    }

    // Format phone for display
    formatPhone(phone) {
        if (!phone) return '';
        // Remove all non-digits except +
        const cleaned = phone.replace(/[^\d+]/g, '');
        // Format: +357 99 123456
        if (cleaned.startsWith('+357')) {
            return cleaned.replace(/(\+357)(\d{2})(\d+)/, '$1 $2 $3');
        }
        return cleaned;
    }

    // Clean phone for links (remove everything except digits)
    cleanPhone(phone) {
        if (!phone) return '';
        return phone.replace(/[^\d]/g, '');
    }

    // Show contact modal
    showContactModal() {
        const modal = document.getElementById('contactModal');
        if (modal) {
            modal.classList.add('contact-modal--open');
        }
    }

    // Hide contact modal
    hideContactModal() {
        const modal = document.getElementById('contactModal');
        if (modal) {
            modal.classList.remove('contact-modal--open');
        }
    }

    // Fullscreen Gallery Methods
    openFullscreenGallery() {
        const card = document.querySelector('.property-card:not(.property-card--behind):not(.property-card--far-behind)');
        if (!card) return;

        const photos = JSON.parse(card.dataset.photos || '[]');
        if (photos.length === 0) return;

        this.galleryPhotos = photos;
        this.galleryIndex = this.currentPhotoIndex || 0;

        const gallery = document.getElementById('fullscreenGallery');
        const mainImage = document.getElementById('galleryMainImage');
        const counter = document.getElementById('galleryCounter');
        const thumbsContainer = document.getElementById('galleryThumbs');

        mainImage.src = photos[this.galleryIndex];
        counter.textContent = `${this.galleryIndex + 1} / ${photos.length}`;

        // Render thumbnails
        thumbsContainer.innerHTML = photos.map((photo, idx) => `
            <img src="${photo}" class="fullscreen-gallery__thumb ${idx === this.galleryIndex ? 'active' : ''}"
                 onclick="SwipeApp.galleryGoTo(${idx})"
                 onerror="this.style.display='none'">
        `).join('');

        gallery.classList.add('fullscreen-gallery--open');
        document.body.style.overflow = 'hidden';
    }

    closeFullscreenGallery() {
        const gallery = document.getElementById('fullscreenGallery');
        if (gallery) {
            gallery.classList.remove('fullscreen-gallery--open');
            document.body.style.overflow = '';
        }
    }

    galleryNav(direction) {
        if (!this.galleryPhotos || this.galleryPhotos.length === 0) return;

        this.galleryIndex = (this.galleryIndex + direction + this.galleryPhotos.length) % this.galleryPhotos.length;
        this.updateGalleryView();
    }

    galleryGoTo(index) {
        this.galleryIndex = index;
        this.updateGalleryView();
    }

    updateGalleryView() {
        const mainImage = document.getElementById('galleryMainImage');
        const counter = document.getElementById('galleryCounter');
        const thumbs = document.querySelectorAll('.fullscreen-gallery__thumb');

        mainImage.src = this.galleryPhotos[this.galleryIndex];
        counter.textContent = `${this.galleryIndex + 1} / ${this.galleryPhotos.length}`;

        thumbs.forEach((thumb, idx) => {
            thumb.classList.toggle('active', idx === this.galleryIndex);
        });
    }

    bindGallerySwipe() {
        const gallery = document.getElementById('fullscreenGallery');
        if (!gallery) return;

        let startX = 0;
        let startY = 0;

        const main = gallery.querySelector('.fullscreen-gallery__main');

        main.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });

        main.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = endX - startX;
            const diffY = endY - startY;

            // Only swipe if horizontal movement is greater than vertical
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    this.galleryNav(-1);
                } else {
                    this.galleryNav(1);
                }
            }
        }, { passive: true });
    }

    // Share selection method
    shareSelection() {
        const likes = this.reactions.filter(r => r.reaction === 'like');
        const url = window.location.href;
        const text = `Check out this property selection! I liked ${likes.length} properties.`;
        
        if (navigator.share) {
            navigator.share({
                title: this.selectionName,
                text: text,
                url: url
            }).then(() => {
                console.log('Shared successfully');
            }).catch((error) => {
                console.log('Error sharing:', error);
                this.fallbackShare(url);
            });
        } else {
            this.fallbackShare(url);
        }
    }

    // Fallback share method
    fallbackShare(url) {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            alert('Link copied to clipboard!');
        } catch (err) {
            alert('Link: ' + url);
        }
        
        document.body.removeChild(textArea);
    }

    // Review disliked properties method
    reviewDisliked() {
        const dislikes = this.reactions.filter(r => r.reaction === 'dislike');
        
        if (dislikes.length === 0) {
            return;
        }

        // Get disliked property IDs
        const dislikedIds = dislikes.map(r => r.propertyId);
        
        // Filter properties to only show disliked ones
        const dislikedProperties = this.properties.filter(p => dislikedIds.includes(p.id));
        
        if (dislikedProperties.length === 0) {
            return;
        }

        // Reset state for review
        this.properties = dislikedProperties;
        this.currentIndex = 0;
        this.currentPhotoIndex = 0;
        
        // Remove old reactions for these properties to allow re-rating
        this.reactions = this.reactions.filter(r => !dislikedIds.includes(r.propertyId));
        
        // Hide completion screen
        const screen = document.querySelector('.completion-screen');
        screen.classList.remove('completion-screen--visible');
        
        // Re-render cards
        this.renderCards();
        
        console.log(`Reviewing ${dislikedProperties.length} disliked properties`);
    }

    // Share selection
    async shareSelection() {
        // Generate clean selection URL (without reactions)
        const baseUrl = window.location.origin + window.location.pathname;
        const token = this.selectionData?.token || new URLSearchParams(window.location.search).get('t');
        const selectionUrl = token ? `${baseUrl}?t=${token}` : window.location.href.split('?')[0];
        
        const selectionName = this.selectionData?.name || 'Подборка недвижимости';
        const likes = this.reactions.filter(r => r.reaction === 'like');
        
        const shareText = `Посмотрите подборку недвижимости на Кипре: ${selectionName}`;

        // Try Web Share API first (works on mobile)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: selectionName,
                    text: shareText,
                    url: selectionUrl
                });
                console.log('Shared successfully');
                return;
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Share failed:', error);
                }
            }
        }

        // Fallback: show share modal
        this.showShareModal(selectionUrl, shareText);
    }

    // Show share modal (fallback for desktop)
    showShareModal(url, text) {
        const encodedUrl = encodeURIComponent(url);
        const encodedText = encodeURIComponent(text);

        const modal = document.createElement('div');
        modal.className = 'share-modal';
        modal.innerHTML = `
            <div class="share-modal__overlay" onclick="this.parentElement.remove()"></div>
            <div class="share-modal__content">
                <div class="share-modal__header">
                    <h3>Поделиться подборкой</h3>
                    <button class="share-modal__close" onclick="this.closest('.share-modal').remove()">✕</button>
                </div>
                <div class="share-modal__options">
                    <a href="https://wa.me/?text=${encodedText}%20${encodedUrl}" target="_blank" class="share-option share-option--whatsapp">
                        <span class="share-option__icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                        </span>
                        <span>WhatsApp</span>
                    </a>
                    <a href="https://t.me/share/url?url=${encodedUrl}&text=${encodedText}" target="_blank" class="share-option share-option--telegram">
                        <span class="share-option__icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                            </svg>
                        </span>
                        <span>Telegram</span>
                    </a>
                    <a href="mailto:?subject=${encodeURIComponent('Подборка недвижимости на Кипре')}&body=${encodedText}%0A%0A${encodedUrl}" class="share-option share-option--email">
                        <span class="share-option__icon">📧</span>
                        <span>Email</span>
                    </a>
                    <button class="share-option share-option--copy" onclick="navigator.clipboard.writeText('${url}').then(() => { this.innerHTML = '<span class=\\'share-option__icon\\'>✓</span><span>Скопировано!</span>'; setTimeout(() => { this.innerHTML = '<span class=\\'share-option__icon\\'>📋</span><span>Копировать ссылку</span>'; }, 2000); })">
                        <span class="share-option__icon">📋</span>
                        <span>Копировать ссылку</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add styles if not already added
        if (!document.getElementById('share-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'share-modal-styles';
            style.textContent = `
                .share-modal {
                    position: fixed;
                    inset: 0;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .share-modal__overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(4px);
                }
                .share-modal__content {
                    position: relative;
                    background: white;
                    border-radius: 20px;
                    padding: 24px;
                    max-width: 320px;
                    width: 90%;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                .share-modal__header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .share-modal__header h3 {
                    margin: 0;
                    font-size: 1.125rem;
                    color: #1e1b4b;
                }
                .share-modal__close {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #6b7280;
                    padding: 0;
                    line-height: 1;
                }
                .share-modal__options {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .share-option {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 16px;
                    border-radius: 12px;
                    text-decoration: none;
                    color: white;
                    font-weight: 500;
                    transition: transform 0.2s, box-shadow 0.2s;
                    border: none;
                    cursor: pointer;
                    font-size: 1rem;
                }
                .share-option:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                .share-option__icon {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .share-option--whatsapp { background: linear-gradient(135deg, #25D366, #128C7E); }
                .share-option--telegram { background: linear-gradient(135deg, #0088cc, #0066aa); }
                .share-option--email { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
                .share-option--copy { background: linear-gradient(135deg, #374151, #1f2937); }
            `;
            document.head.appendChild(style);
        }
    }
}

// Global reference for onclick handlers
let SwipeAppInstance;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    SwipeAppInstance = new SwipeApp();
});

// Global functions for HTML onclick handlers
const SwipeAppGlobal = {
    closeFullscreenGallery: () => SwipeAppInstance?.closeFullscreenGallery(),
    galleryNav: (dir) => SwipeAppInstance?.galleryNav(dir),
    galleryGoTo: (idx) => SwipeAppInstance?.galleryGoTo(idx)
};

// Expose to window for onclick handlers
window.SwipeApp = SwipeAppGlobal;
