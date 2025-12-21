/**
 * Property Manager - Модуль для управления объектами недвижимости
 * Интеграция с Supabase для CRUD операций
 */

class PropertyManager {
    constructor() {
        this.properties = [];
        this.currentFilter = 'all';
        this.userId = localStorage.getItem('userId');
    }

    /**
     * Загрузка объектов из Supabase
     */
    async loadProperties() {
        try {
            const { data, error } = await window.SupabaseClient.client
                .from('properties')
                .select('*')
                .eq('broker_id', this.userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.properties = data || [];
            return this.properties;
        } catch (error) {
            console.error('Error loading properties:', error);
            return [];
        }
    }

    /**
     * Получение одного объекта по ID
     */
    async getProperty(id) {
        try {
            const { data, error } = await window.SupabaseClient.client
                .from('properties')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting property:', error);
            return null;
        }
    }

    /**
     * Удаление объекта
     */
    async deleteProperty(id) {
        try {
            const { error } = await window.SupabaseClient.client
                .from('properties')
                .delete()
                .eq('id', id)
                .eq('broker_id', this.userId);

            if (error) throw error;

            // Удалить из локального массива
            this.properties = this.properties.filter(p => p.id !== id);
            return true;
        } catch (error) {
            console.error('Error deleting property:', error);
            return false;
        }
    }

    /**
     * Обновление объекта
     */
    async updateProperty(id, updates) {
        try {
            const { data, error } = await window.SupabaseClient.client
                .from('properties')
                .update(updates)
                .eq('id', id)
                .eq('broker_id', this.userId)
                .select();

            if (error) throw error;

            // Обновить в локальном массиве
            const index = this.properties.findIndex(p => p.id === id);
            if (index !== -1) {
                this.properties[index] = data[0];
            }

            return data[0];
        } catch (error) {
            console.error('Error updating property:', error);
            return null;
        }
    }

    /**
     * Фильтрация объектов
     */
    filterProperties(filter) {
        this.currentFilter = filter;
        
        if (filter === 'all') {
            return this.properties;
        }
        
        return this.properties.filter(p => {
            switch(filter) {
                case 'available':
                    return p.property_status === 'Available';
                case 'reserved':
                    return p.property_status === 'Reserved';
                case 'sold':
                    return p.property_status === 'Sold';
                default:
                    return true;
            }
        });
    }

    /**
     * Поиск объектов
     */
    searchProperties(query) {
        const lowerQuery = query.toLowerCase();
        
        return this.properties.filter(p => {
            return (
                p.project_title?.toLowerCase().includes(lowerQuery) ||
                p.apartment_no?.toLowerCase().includes(lowerQuery) ||
                p.location?.toLowerCase().includes(lowerQuery) ||
                p.object_id?.toLowerCase().includes(lowerQuery)
            );
        });
    }

    /**
     * Получение статистики
     */
    getStats() {
        return {
            total: this.properties.length,
            available: this.properties.filter(p => p.property_status === 'Available').length,
            reserved: this.properties.filter(p => p.property_status === 'Reserved').length,
            sold: this.properties.filter(p => p.property_status === 'Sold').length,
            totalValue: this.properties.reduce((sum, p) => sum + (p.clean_price || 0), 0)
        };
    }

    /**
     * Генерация HTML карточки объекта
     */
    renderPropertyCard(property) {
        const firstPhoto = property.photo_urls && property.photo_urls.length > 0 
            ? property.photo_urls[0] 
            : 'https://via.placeholder.com/400x300?text=No+Image';

        const statusColors = {
            'Available': '#10b981',
            'Reserved': '#f59e0b',
            'Sold': '#ef4444',
            'Project delivered': '#6366f1',
            'Under construction': '#8b5cf6'
        };

        const statusColor = statusColors[property.property_status] || '#6b7280';

        return `
            <div class="property-card-broker" data-property-id="${property.id}">
                <div class="property-image-broker" style="background-image: url('${firstPhoto}')">
                    <div class="property-status-badge" style="background: ${statusColor}">
                        ${property.property_status}
                    </div>
                    <div class="property-actions">
                        <button class="action-btn" onclick="propertyManager.editProperty('${property.id}')" title="Редактировать">
                            ✏️
                        </button>
                        <button class="action-btn" onclick="propertyManager.confirmDelete('${property.id}')" title="Удалить">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="property-content-broker">
                    <div class="property-header">
                        <h3>${property.project_title}</h3>
                        <span class="property-code">${property.object_id}</span>
                    </div>
                    <p class="property-type">${property.apartment_type}</p>
                    <div class="property-details">
                        <span>🛏️ ${property.bedrooms} ${property.bedrooms === 1 ? 'спальня' : 'спален'}</span>
                        <span>📍 ${property.location}</span>
                        ${property.total_area ? `<span>📐 ${property.total_area} м²</span>` : ''}
                    </div>
                    <div class="property-price-broker">
                        ${property.price}
                    </div>
                    <div class="property-footer">
                        <small>Добавлено: ${new Date(property.created_at).toLocaleDateString('ru-RU')}</small>
                        <button class="btn-view-details" onclick="propertyManager.viewProperty('${property.id}')">
                            Подробнее →
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Отображение списка объектов
     */
    renderProperties(properties, containerId = 'propertyGrid') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (properties.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                    <p style="font-size: 3rem; margin: 0;">🏠</p>
                    <h3 style="margin: 20px 0 10px 0; color: #333;">Нет объектов</h3>
                    <p style="color: #666; margin-bottom: 30px;">Добавьте ваш первый объект недвижимости</p>
                    <a href="add-property.html" class="btn btn-primary">
                        ➕ Добавить объект
                    </a>
                </div>
            `;
            return;
        }

        container.innerHTML = properties.map(p => this.renderPropertyCard(p)).join('');
    }

    /**
     * Просмотр деталей объекта
     */
    viewProperty(id) {
        const property = this.properties.find(p => p.id === id);
        if (!property) return;

        // Создать модальное окно с деталями
        const modal = document.createElement('div');
        modal.className = 'property-modal';
        modal.innerHTML = `
            <div class="property-modal-content">
                <div class="modal-header">
                    <h2>${property.project_title}</h2>
                    <button onclick="this.closest('.property-modal').remove()" class="close-modal">×</button>
                </div>
                <div class="modal-body">
                    ${this.renderPropertyDetails(property)}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.property-modal').remove()">
                        Закрыть
                    </button>
                    <button class="btn btn-primary" onclick="propertyManager.editProperty('${id}')">
                        ✏️ Редактировать
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    }

    /**
     * Генерация HTML деталей объекта
     */
    renderPropertyDetails(property) {
        const photos = property.photo_urls || [];
        
        return `
            <div class="property-details-grid">
                ${photos.length > 0 ? `
                    <div class="property-gallery">
                        <img src="${photos[0]}" alt="${property.project_title}">
                        ${photos.length > 1 ? `
                            <div class="gallery-thumbnails">
                                ${photos.slice(1, 5).map(url => `
                                    <img src="${url}" alt="Thumbnail" onclick="event.target.closest('.property-gallery').querySelector('img').src = '${url}'">
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                
                <div class="property-info">
                    <div class="info-section">
                        <h3>Основная информация</h3>
                        <table>
                            <tr><td>Тип:</td><td>${property.apartment_type}</td></tr>
                            <tr><td>Спальни:</td><td>${property.bedrooms}</td></tr>
                            <tr><td>Статус:</td><td>${property.property_status}</td></tr>
                            <tr><td>Локация:</td><td>${property.location}</td></tr>
                        </table>
                    </div>

                    ${property.total_area || property.inside_area ? `
                        <div class="info-section">
                            <h3>Площади</h3>
                            <table>
                                ${property.total_area ? `<tr><td>Общая:</td><td>${property.total_area} м²</td></tr>` : ''}
                                ${property.inside_area ? `<tr><td>Внутренняя:</td><td>${property.inside_area}</td></tr>` : ''}
                                ${property.covered_veranda ? `<tr><td>Крытая веранда:</td><td>${property.covered_veranda}</td></tr>` : ''}
                                ${property.uncovered_veranda ? `<tr><td>Открытая веранда:</td><td>${property.uncovered_veranda}</td></tr>` : ''}
                            </table>
                        </div>
                    ` : ''}

                    <div class="info-section">
                        <h3>Цена</h3>
                        <div class="price-display">${property.price}</div>
                        ${property.price_per_sqm ? `<p>Цена за м²: ${property.price_per_sqm}</p>` : ''}
                    </div>

                    ${property.features ? `
                        <div class="info-section">
                            <h3>Особенности</h3>
                            <p>${property.features}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Редактирование объекта
     */
    editProperty(id) {
        window.location.href = `edit-property.html?id=${id}`;
    }

    /**
     * Подтверждение удаления
     */
    confirmDelete(id) {
        const property = this.properties.find(p => p.id === id);
        if (!property) return;

        if (confirm(`Вы уверены, что хотите удалить объект "${property.project_title}"?`)) {
            this.deletePropertyAndRefresh(id);
        }
    }

    /**
     * Удаление объекта с обновлением интерфейса
     */
    async deletePropertyAndRefresh(id) {
        const success = await this.deleteProperty(id);
        
        if (success) {
            this.showNotification('Объект успешно удален', 'success');
            this.renderProperties(this.filterProperties(this.currentFilter));
            this.updateStats();
        } else {
            this.showNotification('Ошибка при удалении объекта', 'error');
        }
    }

    /**
     * Обновление статистики на странице
     */
    updateStats() {
        const stats = this.getStats();
        
        const statsContainer = document.getElementById('statsContainer');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${stats.total}</div>
                    <div class="stat-label">Всего объектов</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.available}</div>
                    <div class="stat-label">Доступно</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.reserved}</div>
                    <div class="stat-label">Забронировано</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.sold}</div>
                    <div class="stat-label">Продано</div>
                </div>
            `;
        }
    }

    /**
     * Показ уведомления
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Инициализация менеджера
     */
    async init() {
        await this.loadProperties();
        this.renderProperties(this.properties);
        this.updateStats();
        this.setupEventListeners();
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Фильтры
        document.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                const filtered = this.filterProperties(filter);
                this.renderProperties(filtered);
                
                // Обновить активную кнопку
                document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // Поиск
        const searchInput = document.getElementById('propertySearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const results = this.searchProperties(e.target.value);
                this.renderProperties(results);
            });
        }
    }
}

// Создать глобальный экземпляр
window.propertyManager = new PropertyManager();

// Автоматическая инициализация при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.propertyManager.init();
    });
} else {
    window.propertyManager.init();
}
