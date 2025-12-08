/* ============================================
   SUPABASE CLIENT - Database Integration + Auth
   ============================================ */

const SupabaseClient = {
    // Configuration
    config: {
        url: 'https://prgngcwhnehifzrsiktq.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByZ25nY3dobmVoaWZ6cnNpa3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMjEyODYsImV4cCI6MjA4MDU5NzI4Nn0.4sIeFKd7-r96hD2DzuUydajUktzuUCQcD1NKesbAVC0'
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
        console.log('✅ Supabase client initialized');
        return true;
    },

    // ============================================
    // AUTHENTICATION (NEW!)
    // ============================================

    // Sign up new user
    async signUp(email, password, metadata = {}) {
        if (!this.init()) throw new Error('Supabase not initialized');

        const { data, error } = await this.client.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    user_type: metadata.user_type || 'client',
                    full_name: metadata.full_name || '',
                    ...metadata
                }
            }
        });

        if (error) {
            console.error('❌ Sign up error:', error);
            throw error;
        }

        console.log('✅ User signed up:', data.user?.email);
        return { data, error };
    },

    // Sign in existing user
    async signIn(email, password) {
        if (!this.init()) throw new Error('Supabase not initialized');

        const { data, error } = await this.client.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            console.error('❌ Sign in error:', error);
            throw error;
        }

        console.log('✅ User signed in:', data.user?.email);
        return { data, error };
    },

    // Sign out current user
    async signOut() {
        if (!this.init()) throw new Error('Supabase not initialized');

        const { error } = await this.client.auth.signOut();

        if (error) {
            console.error('❌ Sign out error:', error);
            throw error;
        }

        console.log('✅ User signed out');
        return { error };
    },

    // Get current user
    async getUser() {
        if (!this.init()) return null;

        const { data: { user } } = await this.client.auth.getUser();
        return user;
    },

    // Get current session
    async getSession() {
        if (!this.init()) return null;

        const { data: { session } } = await this.client.auth.getSession();
        return session;
    },

    // Get user profile
    async getUserProfile(userId) {
        if (!this.init()) return null;

        const { data, error } = await this.client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            return null;
        }

        return data;
    },

    // Update user profile
    async updateProfile(userId, updates) {
        if (!this.init()) throw new Error('Supabase not initialized');

        const { data, error } = await this.client
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            console.error('Error updating profile:', error);
            throw error;
        }

        console.log('✅ Profile updated');
        return data;
    },

    // Check if user is authenticated
    async isAuthenticated() {
        const session = await this.getSession();
        return !!session;
    },

    // Listen to auth state changes
    onAuthStateChange(callback) {
        if (!this.init()) return null;

        return this.client.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
            callback(event, session);
        });
    },

    // ============================================
    // PROPERTIES (NEW!)
    // ============================================

    // Get all properties
    async getProperties(filters = {}) {
        if (!this.init()) return [];

        let query = this.client
            .from('properties')
            .select('*');

        // Apply filters
        if (filters.location) {
            query = query.eq('location', filters.location);
        }
        if (filters.bedrooms) {
            query = query.eq('bedrooms', filters.bedrooms);
        }
        if (filters.minPrice) {
            query = query.gte('clean_price', filters.minPrice);
        }
        if (filters.maxPrice) {
            query = query.lte('clean_price', filters.maxPrice);
        }

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching properties:', error);
            return [];
        }

        return data || [];
    },

    // Get property by ID
    async getPropertyById(propertyId) {
        if (!this.init()) return null;

        const { data, error } = await this.client
            .from('properties')
            .select('*')
            .eq('id', propertyId)
            .single();

        if (error) {
            console.error('Error fetching property:', error);
            return null;
        }

        return data;
    },

    // ============================================
    // FAVORITES (NEW!)
    // ============================================

    // Add to favorites
    async addFavorite(propertyId, notes = '') {
        if (!this.init()) throw new Error('Supabase not initialized');

        const user = await this.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await this.client
            .from('favorites')
            .insert({
                user_id: user.id,
                property_id: propertyId,
                notes: notes
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding favorite:', error);
            throw error;
        }

        console.log('✅ Added to favorites:', propertyId);
        return data;
    },

    // Remove from favorites
    async removeFavorite(propertyId) {
        if (!this.init()) throw new Error('Supabase not initialized');

        const user = await this.getUser();
        if (!user) throw new Error('User not authenticated');

        const { error } = await this.client
            .from('favorites')
            .delete()
            .eq('user_id', user.id)
            .eq('property_id', propertyId);

        if (error) {
            console.error('Error removing favorite:', error);
            throw error;
        }

        console.log('✅ Removed from favorites:', propertyId);
        return true;
    },

    // Get user's favorites
    async getFavorites() {
        if (!this.init()) return [];

        const user = await this.getUser();
        if (!user) return [];

        const { data, error } = await this.client
            .from('favorites')
            .select(`
                *,
                properties (*)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching favorites:', error);
            return [];
        }

        return data || [];
    },

    // Check if property is favorited
    async isFavorite(propertyId) {
        if (!this.init()) return false;

        const user = await this.getUser();
        if (!user) return false;

        const { data, error } = await this.client
            .from('favorites')
            .select('id')
            .eq('user_id', user.id)
            .eq('property_id', propertyId)
            .single();

        return !!data && !error;
    },

    // ============================================
    // SELECTIONS (EXISTING)
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
    // REACTIONS (EXISTING)
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
    // CLIENTS (EXISTING)
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
    // HELPERS (EXISTING)
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