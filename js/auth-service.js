import { CONFIG } from './config.js';

export const AuthService = {
    /**
     * Sends a request to the Auth Lambda.
     */
    _request: async (body) => {
        try {
            const response = await fetch(CONFIG.api.authUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            // Handle API-level errors (assuming your API returns 'error' or 'message' on failure)
            if (!response.ok || data.errorMessage || (data.status && data.status === 'ERROR')) {
                throw new Error(data.errorMessage || data.message || "An unknown error occurred");
            }

            return data;
        } catch (error) {
            console.error("Auth API Error:", error);
            throw error;
        }
    },

    login: async (email, password) => {
        // Postman: { "action": "login", "email": "...", "password": "..." }
        return await AuthService._request({
            action: 'login',
            email: email,
            password: password
        });
    },

    completeNewPassword: async (email, newPassword, session) => {
        // Postman: { "action": "force_password_change", "email": "...", "new_password": "...", "session": "..." }
        return await AuthService._request({
            action: 'force_password_change',
            email: email,
            new_password: newPassword,
            session: session
        });
    },

    forgotPassword: async (email) => {
        // Postman: { "action": "forgot_password", "email": "..." }
        return await AuthService._request({
            action: 'forgot_password',
            email: email
        });
    },

    confirmPassword: async (email, code, newPassword) => {
        // Postman: { "action": "confirm_reset", "email": "...", "code": "...", "new_password": "..." }
        return await AuthService._request({
            action: 'confirm_reset',
            email: email,
            code: code,
            new_password: newPassword
        });
    },

    /**
     * Saves the session data returned by the backend.
     * Postman 'Login - Success' shows response has:
     * { tokens: { access_token: ... }, user_profile: { id: ... } }
     */
    // --- UPDATED METHOD ---
    saveSession: (data) => {
        // 1. Save Tokens
        if (data.tokens) {
            if (data.tokens.access_token) localStorage.setItem("authToken", data.tokens.access_token);
            if (data.tokens.id_token) localStorage.setItem("idToken", data.tokens.id_token);
        }

        // 2. Save User Profile
        if (data.user_profile) {
            // Save ID specifically for easy access
            if (data.user_profile.id) localStorage.setItem("accountId", data.user_profile.id);

            // Save the full object for Profile Page usage
            localStorage.setItem("userProfile", JSON.stringify(data.user_profile));
        }
    },

    isAuthenticated: () => {
        return !!localStorage.getItem("authToken");
    },

    logout: () => {
        localStorage.clear();
        window.location.href = CONFIG.routes.login;
    }
};