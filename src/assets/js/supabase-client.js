/* ============================================
   SUPABASE CLIENT - Database Integration
   ============================================ */

const SupabaseClient = {
    // Configuration
    config: {
        url: 'https://ymizsgrtfkezzsichfwy.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltaXpzZ3J0ZmtlenpzaWNoZnd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzQ5NjIsImV4cCI6MjA4MTMxMDk2Mn0.2XJd1cc_IODicg7ElBGmcVp9Z5RrNccEWm2flV_nrqs'
    },

    // Default broker ID for MVP (no auth)
    DEFAULT_BROKER_ID: '00000000-0000-0000-0000-000000000001',

    client: null,
    initialized: false,

    // Initialize Supabase client
    init() {
        if (this.initialized) return true;

        if (typeof supabase === 'undefined') {
            console.error('Supabase JS library not loaded. Add the CDN script first.');
            return false;
        }

        this.client = supabase.createClient(this.config.url, this.config.anonKey);
        this.initialized = true;
        console.log('Supabase client initialized');
        return true;
    },

    // ============================================
    // SELECTIONS
    // ============================================

    // Create a new selection
    async createSelection(name, propertyIds, description = '', clientId = null) {
        if (!this.init()) throw new Error('Supabase not initialized');

        const token = this.generateToken();

        const insertData = {
            broker_id: this.DEFAULT_BROKER_ID,
            name: name,
            description: description,
            token: token,
            property_ids: propertyIds,
            total_properties: propertyIds.length,
            status: 'pending'
        };

        // Add client_id if provided
        if (clientId) {
            insertData.client_id = clientId;
        }

        const { data, error } = await this.client
            .from('selections')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error('Error creating selection:', error);
            throw error;
        }

        console.log('Selection created:', data);
        return {
            ...data,
            link: this.buildSelectionLink(token)
        };
    },

    // Get selection by token (for client swipe page)
    async getSelectionByToken(token) {
        if (!this.init()) return null;

        const { data, error } = await this.client
            .from('selections')
            .select('*, brokers(*)')
            .eq('token', token)
            .single();

        if (error) {
            console.error('Error fetching selection:', error);
            return null;
        }

        // Check if expired
        if (data && new Date(data.expires_at) < new Date()) {
            return { ...data, expired: true };
        }

        return data;
    },

    // Get all selections for broker
    async getBrokerSelections() {
        if (!this.init()) return [];

        const { data, error } = await this.client
            .from('selections')
            .select('*')
            .eq('broker_id', this.DEFAULT_BROKER_ID)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching selections:', error);
            return [];
        }

        return data || [];
    },

    // Update selection status
    async updateSelectionStatus(selectionId, status) {
        if (!this.init()) return null;

        const updateData = { status };
        if (status === 'completed') {
            updateData.completed_at = new Date().toISOString();
        }

        const { data, error } = await this.client
            .from('selections')
            .update(updateData)
            .eq('id', selectionId)
            .select()
            .single();

        if (error) {
            console.error('Error updating selection:', error);
            return null;
        }

        return data;
    },

    // Delete selection
    async deleteSelection(selectionId) {
        if (!this.init()) return false;

        const { error } = await this.client
            .from('selections')
            .delete()
            .eq('id', selectionId);

        if (error) {
            console.error('Error deleting selection:', error);
            return false;
        }

        return true;
    },

    // ============================================
    // REACTIONS
    // ============================================

    // Save a reaction (like/dislike)
    async saveReaction(selectionId, propertyId, propertyTitle, reaction) {
        if (!this.init()) throw new Error('Supabase not initialized');

        const { data, error } = await this.client
            .from('reactions')
            .upsert({
                selection_id: selectionId,
                property_id: propertyId,
                property_title: propertyTitle,
                reaction: reaction
            }, {
                onConflict: 'selection_id,property_id'
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving reaction:', error);
            throw error;
        }

        console.log('Reaction saved:', reaction, propertyTitle);
        return data;
    },

    // Get all reactions for a selection
    async getSelectionReactions(selectionId) {
        if (!this.init()) return [];

        const { data, error } = await this.client
            .from('reactions')
            .select('*')
            .eq('selection_id', selectionId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching reactions:', error);
            return [];
        }

        return data || [];
    },

    // ============================================
    // CLIENTS
    // ============================================

    // Get all clients for this broker
    async getClients() {
        if (!this.init()) return [];

        try {
            const { data, error } = await this.client
                .from('clients')
                .select('*')
                .eq('broker_id', this.DEFAULT_BROKER_ID)
                .order('name', { ascending: true });

            if (error) {
                // Table might not exist yet
                console.warn('Clients table not available:', error.message);
                return [];
            }

            return data || [];
        } catch (e) {
            console.warn('Failed to fetch clients:', e);
            return [];
        }
    },

    // Create a new client
    async createClient(name, email = null, phone = null) {
        if (!this.init()) throw new Error('Supabase not initialized');

        const insertData = {
            broker_id: this.DEFAULT_BROKER_ID,
            name: name
        };

        if (email) insertData.email = email;
        if (phone) insertData.phone = phone;

        try {
            const { data, error } = await this.client
                .from('clients')
                .insert(insertData)
                .select()
                .single();

            if (error) {
                console.error('Error creating client:', error);
                throw error;
            }

            console.log('Client created:', data);
            return data;
        } catch (e) {
            console.error('Failed to create client:', e);
            // Return a mock client if table doesn't exist
            return { id: null, name: name };
        }
    },

    // ============================================
    // HELPERS
    // ============================================

    // Generate random token for selection link
    generateToken() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 12; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
    },

    // Build shareable link
    buildSelectionLink(token) {
        const baseUrl = window.location.origin;
        // Handle both local development and production
        const path = window.location.pathname.includes('/src/')
            ? '/src/client/swipe.html'
            : '/client/swipe.html';
        return `${baseUrl}${path}?t=${token}`;
    },

    // Parse token from URL
    getTokenFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('t');
    },

    // Format date for display
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    },

    // Get status badge class
    getStatusClass(status) {
        const classes = {
            'pending': 'status-pending',
            'active': 'status-active',
            'completed': 'status-completed',
            'expired': 'status-expired'
        };
        return classes[status] || 'status-pending';
    }
};

// Export
if (typeof window !== 'undefined') {
    window.SupabaseClient = SupabaseClient;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseClient;
}
