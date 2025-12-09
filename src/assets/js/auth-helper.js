/* ============================================
   AUTH HELPER - Session Management & Route Protection
   ============================================ */

const AuthHelper = {
    // Check if user is authenticated and redirect if not
    async requireAuth(redirectTo = '/src/broker/login.html') {
        const session = await SupabaseClient.getSession();
        
        if (!session) {
            console.log('No session found, redirecting to login...');
            window.location.href = redirectTo;
            return false;
        }

        console.log('User authenticated:', session.user.email);
        return true;
    },

    // Check if user is authenticated and redirect to dashboard if yes
    async requireGuest(redirectTo = '/src/broker/dashboard.html') {
        const session = await SupabaseClient.getSession();
        
        if (session) {
            console.log('User already logged in, redirecting to dashboard...');
            window.location.href = redirectTo;
            return false;
        }

        return true;
    },

    // Check if user has specific role
    async requireRole(role, redirectTo = '/src/broker/login.html') {
        const authenticated = await this.requireAuth(redirectTo);
        if (!authenticated) return false;

        const user = await SupabaseClient.getUser();
        const userRole = user?.user_metadata?.role;

        if (userRole !== role) {
            console.error(`Access denied. Required role: ${role}, User role: ${userRole}`);
            window.location.href = redirectTo;
            return false;
        }

        return true;
    },

    // Get current user info for display
    async getCurrentUserInfo() {
        const user = await SupabaseClient.getUser();
        if (!user) return null;

        return {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email,
            role: user.user_metadata?.role || 'user',
            phone: user.user_metadata?.phone || null,
            createdAt: user.created_at
        };
    },

    // Setup auth state listener
    setupAuthListener() {
        SupabaseClient.onAuthStateChange((event, session) => {
            console.log('Auth event:', event);
            
            if (event === 'SIGNED_OUT') {
                // Redirect to login on sign out
                if (!window.location.pathname.includes('login')) {
                    window.location.href = '/src/broker/login.html';
                }
            } else if (event === 'SIGNED_IN') {
                console.log('User signed in:', session?.user?.email);
            } else if (event === 'TOKEN_REFRESHED') {
                console.log('Token refreshed');
            }
        });
    },

    // Display user info in UI
    async displayUserInfo(elementId = 'userInfo') {
        const userInfo = await this.getCurrentUserInfo();
        const element = document.getElementById(elementId);
        
        if (userInfo && element) {
            element.innerHTML = `
                <div class="user-info">
                    <div class="user-email">${userInfo.email}</div>
                    <div class="user-role">${userInfo.role}</div>
                </div>
            `;
        }
    },

    // Logout with confirmation
    async logout(confirmMessage = 'Are you sure you want to sign out?') {
        if (!confirm(confirmMessage)) return false;

        try {
            await SupabaseClient.signOut();
            console.log('Logged out successfully');
            window.location.href = '/src/broker/login.html';
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error signing out. Please try again.');
            return false;
        }
    },

    // Handle login form
    async handleLogin(email, password) {
        try {
            const { session, user } = await SupabaseClient.signIn(email, password);
            
            if (session) {
                console.log('Login successful:', user.email);
                return { success: true, user };
            }
            
            return { success: false, error: 'Login failed' };
        } catch (error) {
            console.error('Login error:', error);
            return { 
                success: false, 
                error: error.message || 'Invalid email or password' 
            };
        }
    },

    // Handle registration form
    async handleSignUp(email, password, metadata = {}) {
        try {
            const { session, user } = await SupabaseClient.signUp(email, password, metadata);
            
            if (user) {
                console.log('Registration successful:', user.email);
                return { 
                    success: true, 
                    user,
                    message: 'Registration successful! Please check your email to verify your account.' 
                };
            }
            
            return { success: false, error: 'Registration failed' };
        } catch (error) {
            console.error('Registration error:', error);
            return { 
                success: false, 
                error: error.message || 'Registration failed' 
            };
        }
    },

    // Format date helper
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};

// Export
if (typeof window !== 'undefined') {
    window.AuthHelper = AuthHelper;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthHelper;
}
