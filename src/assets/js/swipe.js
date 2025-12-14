/* ============================================
   SWIPE PAGE - Tinder-like Card Swiping
   ============================================ */

class SwipeApp {
    constructor() {
        this.properties = [];
        this.selectionName = 'Property Selection';
        this.currentIndex = 0;
        this.reactions = [];
        this.currentPhotoIndex = 0;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;

        // VAT rate for Cyprus
        this.VAT_RATE = 0.19;

        // Supabase integration
        this.selectionId = null;
        this.selectionToken = null;
        this.selectionData = null;

        this.loadProperties().then(() => this.init());
    }

    // Calculate price with VAT
    calculateWithVAT(price) {
        const numPrice = typeof price === 'number' ? price : parseInt((price || '').toString().replace(/[^\d]/g, ''));
        if (isNaN(numPrice)) return null;
        return Math.round(numPrice * (1 + this.VAT_RATE));
    }

    // Format price
    formatPrice(price, includeVAT = false) {
        if (typeof price === 'number') {
            const amount = includeVAT ? this.calculateWithVAT(price) : price;
            return '€' + amount.toLocaleString();
        }
        if (typeof price === 'string') {
            if (price.includes('€')) return price;
            const num = parseInt(price.replace(/[^\d]/g, ''));
            if (!isNaN(num)) {
                const amount = includeVAT ? this.calculateWithVAT(num) : num;
                return '€' + amount.toLocaleString();
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
                await DataSync.syncProperties();
            }

            // Get all properties
            const allProperties = typeof PropertyData !== 'undefined'
                ? PropertyData.getAll()
                : (typeof MOCK_PROPERTIES !== 'undefined' ? MOCK_PROPERTIES : []);

            // Filter by preview IDs
            const ids = previewIds.split(',');
            this.properties = allProperties.filter(p => ids.includes(p.id));

            console.log(`📦 Preview: ${this.properties.length} properties`);
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

                // Get property data from localStorage (synced from Google Sheets)
                const allProperties = typeof PropertyData !== 'undefined'
                    ? PropertyData.getAll()
                    : (typeof MOCK_PROPERTIES !== 'undefined' ? MOCK_PROPERTIES : []);

                // Filter properties by IDs in selection
                const propertyIds = selection.property_ids || [];
                this.properties = allProperties.filter(p => propertyIds.includes(p.id));

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

        this.renderHeader();
        this.renderCards();
        this.renderActions();
        this.bindEvents();
        this.updateProgress();
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
        
        // Calculate prices
        const basePrice = property.cleanPrice || parseInt((property.price || '').toString().replace(/[^\d]/g, '')) || 0;
        const priceWithoutVAT = this.formatPrice(basePrice);
        const priceWithVAT = this.formatPrice(basePrice, true);
        
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

            <div class="property-card__content">
                <div class="property-card__price">
                    <div>${priceWithoutVAT}</div>
                    <div style="font-size: 0.85em; color: #10b981; margin-top: 4px;">${priceWithVAT} incl. VAT</div>
                </div>
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
        // Action buttons
        document.querySelector('.swipe-actions').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            if (action === 'like') this.swipe('like');
            else if (action === 'dislike') this.swipe('dislike');
            else if (action === 'info') this.showDetails();
        });

        // Card touch/mouse events
        this.bindCardEvents();

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') this.swipe('like');
            else if (e.key === 'ArrowLeft') this.swipe('dislike');
            else if (e.key === ' ' || e.key === 'Enter') this.showDetails();
        });

        // Card click handler - click anywhere opens info/details
        document.querySelector('.cards-stack').addEventListener('click', (e) => {
            const card = e.target.closest('.property-card');
            if (!card || card.classList.contains('property-card--behind')) return;

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
        
        // Calculate prices
        const basePrice = property.cleanPrice || parseInt((property.price || '').toString().replace(/[^\d]/g, '')) || 0;
        const priceWithoutVAT = this.formatPrice(basePrice);
        const priceWithVAT = this.formatPrice(basePrice, true);

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
                    <div>${priceWithoutVAT}</div>
                    <div style="font-size: 0.85em; color: #10b981; margin-top: 4px;">${priceWithVAT} incl. VAT</div>
                </div>
                <div class="details-title">${property.title || 'Property'}</div>
                <div class="details-location">
                    <span>📍</span>
                    <span>${property.location || 'Cyprus'}</span>
                </div>

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
        const brokerName = this.selectionData?.brokers?.name || 'your broker';

        screen.innerHTML = `
            <div class="completion-icon">🎉</div>
            <h2 class="completion-title">All Done!</h2>
            <p class="completion-text">
                Thank you for reviewing the selection. ${brokerName} will contact you soon about the properties you liked.
            </p>
            <div class="completion-stats">
                <div class="completion-stat">
                    <div class="completion-stat__value completion-stat__value--like">${likes.length}</div>
                    <div class="completion-stat__label">Liked</div>
                </div>
                <div class="completion-stat">
                    <div class="completion-stat__value completion-stat__value--dislike">${dislikes.length}</div>
                    <div class="completion-stat__label">Passed</div>
                </div>
            </div>
            ${likes.length > 0 ? `
                <div style="text-align: left; width: 100%; max-width: 300px; margin-bottom: var(--space-xl);">
                    <p style="font-size: 0.875rem; opacity: 0.7; margin-bottom: var(--space-sm);">Properties you liked:</p>
                    ${likes.map(l => `
                        <div style="padding: var(--space-sm); background: rgba(255,255,255,0.1); border-radius: var(--radius); margin-bottom: var(--space-xs); font-size: 0.875rem;">
                            ${l.propertyTitle || l.propertyId}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            <button class="btn btn-secondary btn-lg" onclick="window.close()" style="margin-bottom: var(--space-md);">
                Close
            </button>
        `;

        screen.classList.add('completion-screen--visible');

        console.log('Selection completed:', results);
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
