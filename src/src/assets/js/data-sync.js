/* ============================================
   DATA SYNC - Load from CSV file
   ============================================ */

const DataSync = {
    // Configuration
    config: {
        CSV_PATH: '../base.csv',  // Path relative to HTML files in subdirectories
        CSV_PATH_ROOT: 'base.csv', // Path from root
    },

    // In-memory cache (no localStorage to avoid quota issues)
    _cache: null,
    _lastSync: null,

    // Parse CSV string to array of objects
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        if (lines.length < 2) return [];

        // Parse header row
        const headers = this.parseCSVLine(lines[0]);
        console.log('CSV Headers:', headers);

        const properties = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = this.parseCSVLine(line);
            const obj = {};

            headers.forEach((header, idx) => {
                obj[header.trim()] = values[idx] ? values[idx].trim() : '';
            });

            // Transform to our Property format
            const property = this.transformProperty(obj, i);
            if (property) {
                properties.push(property);
            }
        }

        return properties;
    },

    // Parse single CSV line (handling quoted fields with commas)
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);

        return result.map(val => val.replace(/^"|"$/g, '').trim());
    },

    // Transform CSV row to Property object
    transformProperty(obj, index) {
        // Try different column name variations
        const getString = (...keys) => {
            for (const key of keys) {
                if (obj[key]) return obj[key];
            }
            return '';
        };

        const getNumber = (...keys) => {
            for (const key of keys) {
                if (obj[key]) {
                    const cleaned = String(obj[key]).replace(/[€$£\s,]/g, '');
                    const num = parseFloat(cleaned);
                    if (!isNaN(num)) return num;
                }
            }
            return 0;
        };

        // Generate stable ID from URL + ApartmentNo (to make unique per unit)
        const url = getString('URL', 'url', 'Link');
        const apartmentNo = getString('ApartmentNo', 'Unit', 'UnitNo');
        const uniqueKey = url + '_' + apartmentNo + '_' + index;
        const stableId = 'prop_' + this.hashCode(uniqueKey);

        // Parse values
        const title = getString('ProjectTitle', 'Title', 'Name', 'Property');
        const cleanPrice = getNumber('CleanPrice', 'Price', 'price');

        // Skip invalid entries
        if (!title && cleanPrice === 0) {
            return null;
        }

        const totalArea = getNumber('TotalArea', 'Area', 'area', 'Size');

        // Parse photos
        const photosStr = getString('PhotoURLs', 'PhotoPaths', 'Photos', 'Images');
        const photos = this.parsePhotos(photosStr);

        // Debug first few properties
        if (index <= 3) {
            console.log(`DEBUG Property #${index}:`);
            console.log('  - PhotoURLs raw (first 300 chars):', photosStr?.substring(0, 300));
            console.log('  - Photos parsed:', photos.length, photos);
        }

        return {
            id: stableId,
            externalId: getString('ID', 'ExternalID', 'id'),
            apartmentNo: apartmentNo,
            source: 'csv',

            // Main fields
            title: title || 'Untitled Property',
            type: getString('ApartmentType', 'Type', 'PropertyType', 'type'),
            status: getString('PropertyStatus', 'Status', 'status'),
            location: getString('Location', 'City', 'Address', 'location'),
            district: getString('District', 'district'),

            // Rooms
            bedrooms: getNumber('Bedrooms', 'bedrooms', 'Beds'),
            bathrooms: getNumber('Bathrooms', 'bathrooms', 'Baths'),

            // Areas
            area: totalArea,
            insideArea: getNumber('InsideArea', 'insideArea'),
            coveredVeranda: getNumber('CoveredVeranda', 'coveredVeranda'),
            uncoveredVeranda: getNumber('Uncovered Veranda', 'UncoveredVeranda'),
            basement: getNumber('Basement', 'basement'),

            // Price
            price: getString('Price', 'price') || `€${cleanPrice.toLocaleString()}`,
            cleanPrice: cleanPrice,
            priceSqm: getNumber('Pricepersqm', 'PricePerSqm') || (totalArea > 0 ? Math.round(cleanPrice / totalArea) : 0),
            currency: getString('CurrencyType', 'Currency') || 'EUR',

            // Media
            photos: photos.length > 0 ? photos : [
                'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'
            ],
            url: url,

            // Description
            features: getString('Features', 'Amenities', 'features'),
            description: getString('Description', 'description'),
            additionalInfo: getString('AdditionalInformation', 'AdditionalInfo', 'Notes'),

            // Meta
            syncedAt: new Date().toISOString()
        };
    },

    // Parse photo URLs from string
    parsePhotos(photosStr) {
        if (!photosStr) return [];
        if (Array.isArray(photosStr)) return photosStr;

        const str = String(photosStr);

        // Try multiple separators - the CSV might use different formats
        // Common patterns: comma, semicolon, newline, pipe, or space between URLs
        let urls = [];

        // Check if it's a JSON array
        if (str.startsWith('[')) {
            try {
                urls = JSON.parse(str);
            } catch (e) {
                // Not valid JSON, continue with string parsing
            }
        }

        if (urls.length === 0) {
            // Split by common separators, but be careful with URLs that contain commas
            // Google Drive URLs typically don't have commas, so split on comma is safe
            urls = str
                .split(/[\n|;]+|(?:,\s*(?=https?:))/)  // Split on newline, pipe, semicolon, or comma followed by http
                .map(url => url.trim())
                .filter(url => url);
        }

        // Extract URLs from text (in case mixed with other content)
        const extractedUrls = [];
        urls.forEach(text => {
            // Match full URLs including Google Drive
            const urlMatches = text.match(/https?:\/\/[^\s,;|"'<>]+/g);
            if (urlMatches) {
                extractedUrls.push(...urlMatches);
            }
        });

        return extractedUrls
            .map(url => this.convertToDirectUrl(url.trim()))
            .filter(url => url) // Remove nulls
            .slice(0, 10); // Limit to 10 photos
    },

    // Convert Google Drive URLs to direct image URLs
    convertToDirectUrl(url) {
        if (!url) return null;

        // Clean URL from any trailing characters
        url = url.replace(/[\s"'<>]+$/, '');

        // Google Drive file link: https://drive.google.com/file/d/FILE_ID/view
        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) {
            const fileId = driveMatch[1];
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
        }

        // Google Drive open link: https://drive.google.com/open?id=FILE_ID
        const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
        if (openMatch) {
            const fileId = openMatch[1];
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
        }

        // Google Drive sharing link: https://drive.google.com/drive/folders/xxx or /u/0/drive/
        // These are folders, not images, skip them
        if (url.includes('/drive/folders/') || url.includes('/u/0/drive/')) {
            return null;
        }

        // Google Photos link - extract if possible
        const photosMatch = url.match(/photos\.google\.com.*\/([a-zA-Z0-9_-]{20,})/);
        if (photosMatch) {
            // Google Photos direct embedding is complex, return as-is
            return url;
        }

        // Google Drive uc link (already direct) or thumbnail link
        if (url.includes('drive.google.com/uc') || url.includes('drive.google.com/thumbnail')) {
            // Ensure it has size parameter for better quality
            if (!url.includes('sz=')) {
                url = url + (url.includes('?') ? '&' : '?') + 'sz=w800';
            }
            return url;
        }

        // Return as-is for other URLs (Unsplash, direct image links, etc.)
        return url;
    },

    // Generate hash code for stable IDs
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    },

    // Main sync function - load from CSV
    async syncProperties() {
        console.log('🔄 Loading properties from CSV...');

        try {
            // Try different paths
            let response;
            const paths = [this.config.CSV_PATH, this.config.CSV_PATH_ROOT, '/base.csv', '/src/base.csv'];

            for (const path of paths) {
                try {
                    response = await fetch(path);
                    if (response.ok) {
                        console.log(`📁 Found CSV at: ${path}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!response || !response.ok) {
                throw new Error('CSV file not found. Please place base.csv in the project root.');
            }

            const csvText = await response.text();
            const properties = this.parseCSV(csvText);

            if (properties.length === 0) {
                throw new Error('No valid properties found in CSV');
            }

            // Save to memory cache (not localStorage - too large)
            this._cache = properties;
            this._lastSync = new Date().toISOString();

            console.log(`✅ Loaded ${properties.length} properties from CSV`);

            return {
                success: true,
                count: properties.length,
                properties: properties
            };

        } catch (error) {
            console.error('❌ CSV load failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // Get properties from memory cache
    getProperties() {
        return this._cache || [];
    },

    // Get last sync time
    getLastSyncTime() {
        return this._lastSync;
    },

    // Check if data is loaded
    isLoaded() {
        return this._cache !== null && this._cache.length > 0;
    },

    // Auto-sync - always load if not in memory
    async autoSync() {
        if (!this.isLoaded()) {
            return await this.syncProperties();
        }
        return {
            success: true,
            count: this._cache.length,
            cached: true
        };
    }
};

// Export for use in other files
if (typeof window !== 'undefined') {
    window.DataSync = DataSync;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataSync;
}
