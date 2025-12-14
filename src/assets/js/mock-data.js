/* ============================================
   DATA LOADER - Uses synced data or fallback to mock
   ============================================ */

// Fallback mock data (used if no synced data available)
const FALLBACK_PROPERTIES = [
    {
        id: 'prop_001',
        title: 'Emerald Bay Residences',
        type: 'Apartment',
        mainType: 'Residence',
        status: 'New',
        location: 'Limassol, Cyprus',
        bedrooms: 3,
        bathrooms: 2,
        area: 145,
        price: '€285,000',
        cleanPrice: 285000,
        currency: 'EUR',
        priceSqm: 1966,
        photos: [
            'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800',
            'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
            'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'
        ],
        features: 'Sea View, Pool, Gym, Parking',
        description: 'Luxury apartment with panoramic sea views.'
    },
    {
        id: 'prop_002',
        title: 'Marina Heights Tower',
        type: 'Apartment',
        mainType: 'Apartment',
        status: 'Under Construction',
        location: 'Larnaca, Cyprus',
        bedrooms: 2,
        bathrooms: 1,
        area: 95,
        price: '€175,000',
        cleanPrice: 175000,
        currency: 'EUR',
        priceSqm: 1842,
        photos: [
            'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
            'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800'
        ],
        features: 'Marina View, Balcony, New Building',
        description: 'Brand new apartment in marina district.'
    },
    {
        id: 'prop_003',
        title: 'Olive Grove Villa',
        type: 'Villa',
        mainType: 'Villa',
        status: 'Resale',
        location: 'Paphos, Cyprus',
        bedrooms: 4,
        bathrooms: 3,
        area: 280,
        price: '€495,000',
        cleanPrice: 495000,
        currency: 'EUR',
        priceSqm: 1768,
        photos: [
            'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800',
            'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'
        ],
        features: 'Private Pool, Garden, Mountain View',
        description: 'Stunning villa surrounded by olive trees.'
    }
];

// Data manager
const PropertyData = {
    // Get all properties (synced or fallback)
    getAll() {
        // Try to get synced data first
        if (typeof DataSync !== 'undefined') {
            const synced = DataSync.getProperties();
            if (synced && synced.length > 0) {
                console.log(`📦 Using ${synced.length} synced properties`);
                return synced;
            }
        }

        // Try localStorage directly
        const stored = localStorage.getItem('real_estate_properties');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.length > 0) {
                    console.log(`📦 Using ${parsed.length} stored properties`);
                    return parsed;
                }
            } catch (e) {
                console.warn('Failed to parse stored properties');
            }
        }

        // Fallback to mock data
        console.log('📦 Using fallback mock data');
        return FALLBACK_PROPERTIES;
    },

    // Get property by ID
    getById(id) {
        return this.getAll().find(p => p.id === id);
    },

    // Get properties by filter
    filter(filters = {}) {
        let properties = this.getAll();

        if (filters.location) {
            properties = properties.filter(p =>
                p.location && p.location.toLowerCase().includes(filters.location.toLowerCase())
            );
        }

        if (filters.type) {
            properties = properties.filter(p =>
                p.type && p.type.toLowerCase() === filters.type.toLowerCase()
            );
        }

        if (filters.minPrice) {
            properties = properties.filter(p => p.cleanPrice >= filters.minPrice);
        }

        if (filters.maxPrice) {
            properties = properties.filter(p => p.cleanPrice <= filters.maxPrice);
        }

        if (filters.bedrooms) {
            properties = properties.filter(p => p.bedrooms >= filters.bedrooms);
        }

        if (filters.search) {
            const search = filters.search.toLowerCase();
            properties = properties.filter(p =>
                (p.title && p.title.toLowerCase().includes(search)) ||
                (p.location && p.location.toLowerCase().includes(search)) ||
                (p.features && p.features.toLowerCase().includes(search))
            );
        }

        return properties;
    },

    // Get unique values for filters
    getFilterOptions() {
        const properties = this.getAll();

        return {
            locations: [...new Set(properties.map(p => p.location).filter(Boolean))].sort(),
            types: [...new Set(properties.map(p => p.type).filter(Boolean))].sort(),
            statuses: [...new Set(properties.map(p => p.status).filter(Boolean))].sort(),
            mainTypes: [...new Set(properties.map(p => p.mainType).filter(Boolean))].sort(),
            bedroomOptions: [...new Set(properties.map(p => p.bedrooms).filter(b => b !== undefined))].sort((a, b) => a - b)
        };
    },

    // Get statistics
    getStats() {
        const properties = this.getAll();
        const prices = properties.map(p => p.cleanPrice).filter(p => p > 0);

        return {
            total: properties.length,
            avgPrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
            minPrice: prices.length > 0 ? Math.min(...prices) : 0,
            maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
            byType: this.countBy(properties, 'type'),
            byLocation: this.countBy(properties, 'location'),
            byStatus: this.countBy(properties, 'status')
        };
    },

    // Helper: count by field
    countBy(arr, field) {
        return arr.reduce((acc, item) => {
            const key = item[field] || 'Unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
    }
};

// For backward compatibility with existing code
const MOCK_PROPERTIES = PropertyData.getAll();

const MOCK_SELECTION = {
    id: 'sel_demo_001',
    name: 'Property Selection',
    brokerName: 'Maria Konstantinou',
    brokerCompany: 'Cyprus Prime Realty',
    description: 'Selected properties matching your preferences',
    createdAt: new Date().toISOString().split('T')[0],
    get properties() {
        return PropertyData.getAll();
    }
};

// Export
if (typeof window !== 'undefined') {
    window.PropertyData = PropertyData;
    window.MOCK_PROPERTIES = MOCK_PROPERTIES;
    window.MOCK_SELECTION = MOCK_SELECTION;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PropertyData, MOCK_PROPERTIES, MOCK_SELECTION, FALLBACK_PROPERTIES };
}
