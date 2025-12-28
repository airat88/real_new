/**
 * ComplexInfoHelper - Вспомогательный модуль для работы с информацией о комплексах
 * 
 * Этот модуль можно подключить на любой странице для работы с данными о комплексах
 * 
 * Использование:
 * <script src="../assets/js/complex-info-helper.js"></script>
 * 
 * const info = await ComplexInfoHelper.getByCode('BB-6122');
 * const html = ComplexInfoHelper.renderCard(info);
 */

const ComplexInfoHelper = {
    /**
     * Извлечь Object Code из объекта property
     * @param {Object} property - Объект недвижимости с полем Object
     * @returns {string|null} - Object code или null
     */
    extractObjectCode(property) {
        // Если передана строка (старый API) - пробуем извлечь из неё
        if (typeof property === 'string') {
            const patterns = [
                /([A-Z]+-\d+)/,  // BB-6122
                /([A-Z]+\d+)/    // A100, K48
            ];
            
            for (const pattern of patterns) {
                const match = property.match(pattern);
                if (match) return match[1];
            }
            return null;
        }
        
        // Если объект - используем поле Object
        const objectField = property?.Object;
        if (!objectField) return null;
        
        const patterns = [
            /([A-Z]+-\d+)/,  // BB-6122
            /([A-Z]+\d+)/    // A100, K48
        ];
        
        for (const pattern of patterns) {
            const match = objectField.match(pattern);
            if (match) return match[1];
        }
        
        return null;
    },

    /**
     * Получить информацию о комплексе по коду
     * @param {string} objectCode - Код комплекса
     * @returns {Promise<Object|null>} - Данные комплекса или null
     */
    async getByCode(objectCode) {
        if (!objectCode) return null;
        if (!SupabaseClient || !SupabaseClient.client) {
            console.error('SupabaseClient not initialized');
            return null;
        }

        try {
            const { data, error } = await SupabaseClient.client
                .from('complex_info')
                .select('*')
                .eq('object_code', objectCode)
                .single();

            if (error) {
                if (error.code !== 'PGRST116') { // Not found is OK
                    console.error('Error loading complex info:', error);
                }
                return null;
            }

            return data;
        } catch (e) {
            console.error('Exception loading complex info:', e);
            return null;
        }
    },

    /**
     * Получить все комплексы
     * @returns {Promise<Array>} - Массив комплексов
     */
    async getAll() {
        if (!SupabaseClient || !SupabaseClient.client) {
            console.error('SupabaseClient not initialized');
            return [];
        }

        try {
            const { data, error } = await SupabaseClient.client
                .from('complex_info')
                .select('*')
                .order('complex_name');

            if (error) {
                console.error('Error loading complexes:', error);
                return [];
            }

            return data || [];
        } catch (e) {
            console.error('Exception loading complexes:', e);
            return [];
        }
    },

    /**
     * Получить все уникальные застройщики
     * @returns {Promise<Array>} - Массив названий застройщиков
     */
    async getAllDevelopers() {
        const complexes = await this.getAll();
        const developers = [...new Set(complexes.map(c => c.developer_name).filter(Boolean))];
        return developers.sort();
    },

    /**
     * Найти комплексы по застройщику
     * @param {string} developerName - Название застройщика
     * @returns {Promise<Array>} - Массив комплексов
     */
    async getByDeveloper(developerName) {
        if (!developerName) return [];
        if (!SupabaseClient || !SupabaseClient.client) {
            console.error('SupabaseClient not initialized');
            return [];
        }

        try {
            const { data, error } = await SupabaseClient.client
                .from('complex_info')
                .select('*')
                .eq('developer_name', developerName)
                .order('complex_name');

            if (error) {
                console.error('Error loading complexes by developer:', error);
                return [];
            }

            return data || [];
        } catch (e) {
            console.error('Exception loading complexes by developer:', e);
            return [];
        }
    },

    /**
     * Проверить, есть ли информация о комплексе
     * @param {string} objectCode - Код комплекса
     * @returns {Promise<boolean>} - true если есть
     */
    async hasInfo(objectCode) {
        const info = await this.getByCode(objectCode);
        return !!info;
    },

    /**
     * Отрендерить компактную карточку с информацией
     * @param {Object} complexInfo - Данные комплекса
     * @param {string} style - Стиль карточки: 'compact', 'detailed', 'inline'
     * @returns {string} - HTML код
     */
    renderCard(complexInfo, style = 'compact') {
        if (!complexInfo) return '';

        const styles = {
            compact: `
                <div class="complex-info-card compact">
                    <div class="complex-code">${complexInfo.object_code}</div>
                    <div class="complex-name">${complexInfo.complex_name || 'Без названия'}</div>
                    <div class="complex-developer">🏢 ${complexInfo.developer_name || 'Не указан'}</div>
                    ${complexInfo.phone ? `
                        <a href="tel:${complexInfo.phone}" class="complex-phone">
                            📞 ${complexInfo.phone}
                        </a>
                    ` : ''}
                </div>
            `,
            
            detailed: `
                <div class="complex-info-card detailed">
                    <div class="complex-header">
                        <span class="complex-code">${complexInfo.object_code}</span>
                        <h3>${complexInfo.complex_name || 'Без названия'}</h3>
                    </div>
                    <div class="complex-body">
                        <p><strong>🏢 Застройщик:</strong> ${complexInfo.developer_name || 'Не указан'}</p>
                        ${complexInfo.phone ? `<p><strong>📞 Телефон:</strong> <a href="tel:${complexInfo.phone}">${complexInfo.phone}</a></p>` : ''}
                        ${complexInfo.email ? `<p><strong>📧 Email:</strong> <a href="mailto:${complexInfo.email}">${complexInfo.email}</a></p>` : ''}
                        ${complexInfo.website ? `<p><strong>🌐 Сайт:</strong> <a href="${complexInfo.website}" target="_blank">Открыть</a></p>` : ''}
                        ${complexInfo.address ? `<p><strong>📍 Адрес:</strong> ${complexInfo.address}</p>` : ''}
                        ${complexInfo.notes ? `<p><strong>📝 Заметки:</strong> ${complexInfo.notes}</p>` : ''}
                    </div>
                </div>
            `,
            
            inline: `
                <span class="complex-info-inline">
                    <span class="complex-code-badge">${complexInfo.object_code}</span>
                    ${complexInfo.complex_name || 'Комплекс'}
                    ${complexInfo.phone ? `| 📞 <a href="tel:${complexInfo.phone}">${complexInfo.phone}</a>` : ''}
                </span>
            `
        };

        return styles[style] || styles.compact;
    },

    /**
     * Добавить информацию о комплексе к объекту недвижимости
     * @param {Object} property - Объект недвижимости
     * @returns {Promise<Object>} - Объект с добавленной информацией
     */
    async enrichProperty(property) {
        if (!property) return property;
        
        const objectCode = this.extractObjectCode(property.PhotoPaths);
        if (!objectCode) return property;

        const complexInfo = await this.getByCode(objectCode);
        
        return {
            ...property,
            _complexInfo: complexInfo,
            _objectCode: objectCode
        };
    },

    /**
     * Добавить информацию о комплексах ко всем объектам в массиве
     * @param {Array} properties - Массив объектов
     * @returns {Promise<Array>} - Массив обогащенных объектов
     */
    async enrichProperties(properties) {
        if (!Array.isArray(properties)) return properties;

        const enrichedPromises = properties.map(prop => this.enrichProperty(prop));
        return await Promise.all(enrichedPromises);
    },

    /**
     * Создать кнопку быстрого звонка
     * @param {Object} complexInfo - Данные комплекса
     * @returns {string} - HTML кнопки
     */
    createCallButton(complexInfo) {
        if (!complexInfo || !complexInfo.phone) return '';
        
        return `
            <a href="tel:${complexInfo.phone}" 
               class="btn-quick-call" 
               title="Позвонить: ${complexInfo.developer_name || complexInfo.complex_name}">
                📞 ${complexInfo.developer_name || 'Позвонить'}
            </a>
        `;
    },

    /**
     * Получить статистику по комплексам
     * @returns {Promise<Object>} - Статистика
     */
    async getStats() {
        const complexes = await this.getAll();
        
        const now = new Date();
        const thisMonth = complexes.filter(c => {
            const created = new Date(c.created_at);
            return created.getMonth() === now.getMonth() && 
                   created.getFullYear() === now.getFullYear();
        });

        return {
            total: complexes.length,
            developers: [...new Set(complexes.map(c => c.developer_name).filter(Boolean))].length,
            thisMonth: thisMonth.length,
            withPhone: complexes.filter(c => c.phone).length,
            withEmail: complexes.filter(c => c.email).length,
            withWebsite: complexes.filter(c => c.website).length
        };
    },

    /**
     * Получить все Object Codes из массива объектов недвижимости
     * @param {Array} properties - Массив объектов
     * @returns {Array} - Уникальные коды
     */
    extractAllCodes(properties) {
        if (!Array.isArray(properties)) return [];
        
        const codes = new Set();
        properties.forEach(prop => {
            const code = this.extractObjectCode(prop.PhotoPaths);
            if (code) codes.add(code);
        });
        
        return Array.from(codes).sort();
    },

    /**
     * Сгруппировать объекты по комплексам
     * @param {Array} properties - Массив объектов
     * @returns {Object} - Объект {objectCode: [properties]}
     */
    groupByComplex(properties) {
        if (!Array.isArray(properties)) return {};
        
        const grouped = {};
        properties.forEach(prop => {
            const code = this.extractObjectCode(prop.PhotoPaths);
            if (code) {
                if (!grouped[code]) grouped[code] = [];
                grouped[code].push(prop);
            } else {
                if (!grouped['_unknown']) grouped['_unknown'] = [];
                grouped['_unknown'].push(prop);
            }
        });
        
        return grouped;
    },

    /**
     * Создать фильтр по застройщикам
     * @param {string} selectId - ID элемента select
     * @param {Function} onChange - Callback при изменении
     */
    async createDeveloperFilter(selectId, onChange) {
        const developers = await this.getAllDevelopers();
        const select = document.getElementById(selectId);
        
        if (!select) {
            console.error('Select element not found:', selectId);
            return;
        }

        select.innerHTML = '<option value="">Все застройщики</option>';
        developers.forEach(dev => {
            const option = document.createElement('option');
            option.value = dev;
            option.textContent = dev;
            select.appendChild(option);
        });

        if (onChange) {
            select.addEventListener('change', onChange);
        }
    },

    /**
     * Поиск комплексов
     * @param {string} query - Поисковый запрос
     * @returns {Promise<Array>} - Найденные комплексы
     */
    async search(query) {
        if (!query) return this.getAll();
        
        const all = await this.getAll();
        const lowerQuery = query.toLowerCase();
        
        return all.filter(c => {
            return (
                c.object_code?.toLowerCase().includes(lowerQuery) ||
                c.complex_name?.toLowerCase().includes(lowerQuery) ||
                c.developer_name?.toLowerCase().includes(lowerQuery) ||
                c.phone?.includes(query) ||
                c.email?.toLowerCase().includes(lowerQuery)
            );
        });
    }
};

// CSS стили для карточек (можно добавить в global.css)
const complexInfoStyles = `
<style>
.complex-info-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    margin: 0.5rem 0;
}

.complex-info-card.compact {
    padding: 0.75rem;
}

.complex-info-card .complex-code {
    background: #6366f1;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.875rem;
    display: inline-block;
    margin-bottom: 0.5rem;
}

.complex-info-card .complex-name {
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.25rem;
}

.complex-info-card .complex-developer {
    color: #6b7280;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
}

.complex-info-card .complex-phone {
    color: #6366f1;
    text-decoration: none;
    font-weight: 500;
}

.complex-info-card .complex-phone:hover {
    text-decoration: underline;
}

.complex-info-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
}

.complex-code-badge {
    background: #6366f1;
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.75rem;
}

.btn-quick-call {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    background: #10b981;
    color: white;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 500;
    transition: all 0.3s;
}

.btn-quick-call:hover {
    background: #059669;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}
</style>
`;

// Автоматически добавить стили при загрузке
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('complex-info-styles')) {
            const styleEl = document.createElement('div');
            styleEl.id = 'complex-info-styles';
            styleEl.innerHTML = complexInfoStyles;
            document.head.appendChild(styleEl.firstChild);
        }
    });
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComplexInfoHelper;
}
