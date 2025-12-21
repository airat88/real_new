/* ============================================
   CLIENT AUTH - Авторизация клиентов
   ============================================ */

const ClientAuth = {
    // Регистрация нового клиента
    async register(name, email, password, phone = null) {
        if (!SupabaseClient.init()) {
            throw new Error('Supabase not initialized');
        }

        try {
            const { data, error } = await SupabaseClient.client.rpc('register_client', {
                p_name: name,
                p_email: email,
                p_password: password,
                p_phone: phone || null
            });

            if (error) {
                console.error('Registration error:', error);
                return { success: false, error: 'Ошибка регистрации' };
            }

            return data;
        } catch (error) {
            console.error('Registration failed:', error);
            return { success: false, error: 'Ошибка соединения' };
        }
    },

    // Вход клиента
    async login(email, password) {
        if (!SupabaseClient.init()) {
            throw new Error('Supabase not initialized');
        }

        try {
            const { data, error } = await SupabaseClient.client.rpc('login_client', {
                p_email: email,
                p_password: password
            });

            if (error) {
                console.error('Login error:', error);
                return { success: false, error: 'Неверный email или пароль' };
            }

            return data;
        } catch (error) {
            console.error('Login failed:', error);
            return { success: false, error: 'Ошибка соединения' };
        }
    },

    // Проверка токена
    async verifyToken(token) {
        if (!SupabaseClient.init()) {
            throw new Error('Supabase not initialized');
        }

        if (!token) {
            return { success: false, error: 'No token provided' };
        }

        try {
            const { data, error } = await SupabaseClient.client.rpc('verify_client_token', {
                p_token: token
            });

            if (error) {
                console.error('Token verification error:', error);
                return { success: false, error: 'Invalid token' };
            }

            return data;
        } catch (error) {
            console.error('Token verification failed:', error);
            return { success: false, error: 'Verification failed' };
        }
    },

    // Выход
    async logout() {
        const token = this.getToken();
        
        if (token && SupabaseClient.init()) {
            try {
                await SupabaseClient.client.rpc('logout_client', {
                    p_token: token
                });
            } catch (error) {
                console.error('Logout error:', error);
            }
        }

        // Clear local storage
        localStorage.removeItem('client_auth_token');
        sessionStorage.removeItem('client_auth_token');
        localStorage.removeItem('client_info');
        
        return { success: true };
    },

    // Получить токен
    getToken() {
        return localStorage.getItem('client_auth_token') || 
               sessionStorage.getItem('client_auth_token');
    },

    // Получить информацию о клиенте
    getClientInfo() {
        const info = localStorage.getItem('client_info');
        return info ? JSON.parse(info) : null;
    },

    // Проверить авторизован ли клиент
    isLoggedIn() {
        return !!this.getToken();
    },

    // Требовать авторизацию (редирект на логин если не авторизован)
    async requireAuth() {
        const token = this.getToken();
        
        if (!token) {
            this.redirectToLogin();
            return false;
        }

        const result = await this.verifyToken(token);
        
        if (!result.success) {
            this.logout();
            this.redirectToLogin();
            return false;
        }

        // Update client info if needed
        localStorage.setItem('client_info', JSON.stringify({
            id: result.client_id,
            name: result.name,
            email: result.email,
            phone: result.phone
        }));

        return result;
    },

    // Редирект на страницу логина
    redirectToLogin() {
        const currentUrl = window.location.href;
        window.location.href = `login.html?redirect=${encodeURIComponent(currentUrl)}`;
    },

    // ============================================
    // ПОДБОРКИ КЛИЕНТА
    // ============================================

    // Получить все подборки клиента (ищем по email через client_id)
    async getClientSelections() {
        if (!SupabaseClient.init()) {
            throw new Error('Supabase not initialized');
        }

        const clientInfo = this.getClientInfo();
        if (!clientInfo?.email) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            // Сначала найдём все client_id с таким email
            const { data: clients, error: clientsError } = await SupabaseClient.client
                .from('clients')
                .select('id')
                .eq('email', clientInfo.email);

            if (clientsError) {
                console.error('Error fetching clients:', clientsError);
                return { success: false, error: clientsError.message };
            }

            if (!clients || clients.length === 0) {
                return { success: true, selections: [] };
            }

            // Получаем массив всех client_id с этим email
            const clientIds = clients.map(c => c.id);
            console.log('Found client IDs for email:', clientIds);

            // Теперь ищем подборки по всем этим client_id
            const { data, error } = await SupabaseClient.client
                .from('selections')
                .select('*')
                .in('client_id', clientIds)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching selections:', error);
                return { success: false, error: error.message };
            }

            console.log('Found selections:', data?.length || 0);
            return { success: true, selections: data || [] };
        } catch (error) {
            console.error('Failed to fetch selections:', error);
            return { success: false, error: 'Connection error' };
        }
    },

    // ============================================
    // ИЗБРАННОЕ
    // ============================================

    // Добавить в избранное
    async addToFavorites(propertyId) {
        if (!SupabaseClient.init()) {
            throw new Error('Supabase not initialized');
        }

        const clientInfo = this.getClientInfo();
        if (!clientInfo?.id) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            const { data, error } = await SupabaseClient.client
                .from('client_favorites')
                .insert({
                    client_id: clientInfo.id,
                    property_id: propertyId
                })
                .select()
                .single();

            if (error) {
                // Ignore duplicate error
                if (error.code === '23505') {
                    return { success: true, message: 'Already in favorites' };
                }
                console.error('Error adding to favorites:', error);
                return { success: false, error: error.message };
            }

            return { success: true, favorite: data };
        } catch (error) {
            console.error('Failed to add to favorites:', error);
            return { success: false, error: 'Connection error' };
        }
    },

    // Удалить из избранного
    async removeFromFavorites(propertyId) {
        if (!SupabaseClient.init()) {
            throw new Error('Supabase not initialized');
        }

        const clientInfo = this.getClientInfo();
        if (!clientInfo?.id) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            const { error } = await SupabaseClient.client
                .from('client_favorites')
                .delete()
                .eq('client_id', clientInfo.id)
                .eq('property_id', propertyId);

            if (error) {
                console.error('Error removing from favorites:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            console.error('Failed to remove from favorites:', error);
            return { success: false, error: 'Connection error' };
        }
    },

    // Получить избранное
    async getFavorites() {
        if (!SupabaseClient.init()) {
            throw new Error('Supabase not initialized');
        }

        const clientInfo = this.getClientInfo();
        if (!clientInfo?.id) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            const { data, error } = await SupabaseClient.client
                .from('client_favorites')
                .select('property_id, created_at')
                .eq('client_id', clientInfo.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching favorites:', error);
                return { success: false, error: error.message };
            }

            return { success: true, favorites: data || [] };
        } catch (error) {
            console.error('Failed to fetch favorites:', error);
            return { success: false, error: 'Connection error' };
        }
    },

    // Проверить в избранном ли объект
    async isFavorite(propertyId) {
        if (!SupabaseClient.init()) {
            return false;
        }

        const clientInfo = this.getClientInfo();
        if (!clientInfo?.id) {
            return false;
        }

        try {
            const { data, error } = await SupabaseClient.client
                .from('client_favorites')
                .select('id')
                .eq('client_id', clientInfo.id)
                .eq('property_id', propertyId)
                .single();

            return !error && !!data;
        } catch {
            return false;
        }
    },

    // ============================================
    // ПРОФИЛЬ
    // ============================================

    // Обновить профиль
    async updateProfile(updates) {
        if (!SupabaseClient.init()) {
            throw new Error('Supabase not initialized');
        }

        const clientInfo = this.getClientInfo();
        if (!clientInfo?.id) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            const { data, error } = await SupabaseClient.client
                .from('clients')
                .update({
                    name: updates.name,
                    phone: updates.phone
                })
                .eq('id', clientInfo.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating profile:', error);
                return { success: false, error: error.message };
            }

            // Update local storage
            localStorage.setItem('client_info', JSON.stringify({
                ...clientInfo,
                name: data.name,
                phone: data.phone
            }));

            return { success: true, client: data };
        } catch (error) {
            console.error('Failed to update profile:', error);
            return { success: false, error: 'Connection error' };
        }
    }
};

// Export for use in other files
if (typeof window !== 'undefined') {
    window.ClientAuth = ClientAuth;
}
