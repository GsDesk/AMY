/**
 * Tutor IA UPEC — API Service Layer
 * Abstrae las llamadas HTTP al backend FastAPI.
 * Incluye gestion de JWT y endpoints de autenticacion.
 */

const API_BASE = '';

/* ── Token helpers & Ngrok / Auth handler ─────────────────────────── */

export function getToken() {
    return localStorage.getItem('amy_token');
}

export function handleUnauthorized() {
    localStorage.removeItem('amy_token');
    localStorage.removeItem('amy_user');
    window.dispatchEvent(new CustomEvent('amy_auth_expired'));
    // Si no estamos en páginas públicas, redirigir a login
    const path = window.location.pathname;
    if (path !== '/login' && path !== '/register' && path !== '/') {
        window.location.href = '/login?expired=1';
    }
}

export function isTokenValid() {
    const token = getToken();
    if (!token) return false;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        const payload = JSON.parse(atob(parts[1]));
        if (!payload || !payload.exp) return true;
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
            handleUnauthorized();
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

export function authHeaders(extraHeaders = {}) {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders
    };
}

/* ── Auth ───────────────────────────────────────────── */

export async function login(email, password) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Error de autenticación: ${response.status}`);
    }

    const data = await response.json();
    localStorage.setItem('amy_token', data.token);
    localStorage.setItem('amy_user', JSON.stringify(data.user));
    saveAccountSession(data.user, data.token);
    return data;
}

export async function getAuthConfig() {
    const response = await fetch(`${API_BASE}/api/auth/config`, {
        headers: { 'ngrok-skip-browser-warning': '69420' }
    });
    if (!response.ok) {
        throw new Error(`Error al obtener configuración: ${response.status}`);
    }
    return await response.json();
}

export async function loginWithMicrosoft(accessToken) {
    const response = await fetch(`${API_BASE}/api/auth/microsoft-login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({ accessToken })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Error de autenticación institucional: ${response.status}`);
    }

    const data = await response.json();
    localStorage.setItem('amy_token', data.token);
    localStorage.setItem('amy_user', JSON.stringify(data.user));
    saveAccountSession(data.user, data.token);
    return data;
}

export async function googleLogin(credential) {
    const response = await fetch(`${API_BASE}/api/auth/google-login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({ credential })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Error de autenticación con Google: ${response.status}`);
    }

    const data = await response.json();
    localStorage.setItem('amy_token', data.token);
    localStorage.setItem('amy_user', JSON.stringify(data.user));
    saveAccountSession(data.user, data.token);
    return data;
}

export async function register(email, password, nombre) {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({ email, password, nombre })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Error de registro: ${response.status}`);
    }

    const data = await response.json();
    localStorage.setItem('amy_token', data.token);
    localStorage.setItem('amy_user', JSON.stringify(data.user));
    saveAccountSession(data.user, data.token);
    return data;
}

export async function forgotPassword(email) {
    const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({ email })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Error al solicitar código: ${response.status}`);
    }

    return await response.json();
}

export async function resetPassword(email, code, newPassword) {
    const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({ email, code, new_password: newPassword })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Error al restablecer contraseña: ${response.status}`);
    }

    return await response.json();
}

export function saveAccountSession(user, token) {
    if (!user || !user.email) return;
    try {
        const raw = localStorage.getItem('amy_saved_accounts');
        let accounts = raw ? JSON.parse(raw) : [];
        accounts = accounts.filter(a => a.email !== user.email);
        accounts.unshift({
            id: user.id || user.email,
            email: user.email,
            nombre: user.nombre || user.email.split('@')[0],
            rol: user.rol || 'estudiante',
            token: token || null,
            lastLogin: new Date().toISOString()
        });
        localStorage.setItem('amy_saved_accounts', JSON.stringify(accounts));
    } catch (err) {
        console.error('Error guardando cuenta en localStorage:', err);
    }
}

export function getSavedAccounts() {
    try {
        const raw = localStorage.getItem('amy_saved_accounts');
        let accounts = raw ? JSON.parse(raw) : [];
        const currentUser = getUser();
        // Si no hay cuentas guardadas pero el usuario actual está logueado, agregarlo
        if (accounts.length === 0 && currentUser) {
            const token = getToken();
            saveAccountSession(currentUser, token);
            return [{
                id: currentUser.id || currentUser.email,
                email: currentUser.email,
                nombre: currentUser.nombre || currentUser.email.split('@')[0],
                rol: currentUser.rol || 'estudiante',
                token: token,
                lastLogin: new Date().toISOString()
            }];
        }
        return accounts;
    } catch {
        return [];
    }
}

export function removeSavedAccount(email) {
    try {
        const raw = localStorage.getItem('amy_saved_accounts');
        let accounts = raw ? JSON.parse(raw) : [];
        accounts = accounts.filter(a => a.email !== email);
        localStorage.setItem('amy_saved_accounts', JSON.stringify(accounts));
        return accounts;
    } catch {
        return [];
    }
}

export function switchAccountSession(account) {
    if (!account) return;
    if (account.token) {
        localStorage.setItem('amy_token', account.token);
    } else {
        localStorage.removeItem('amy_token');
    }
    localStorage.setItem('amy_user', JSON.stringify({
        id: account.id,
        email: account.email,
        nombre: account.nombre,
        rol: account.rol
    }));
    // Limpiar id de conversación activa para cargar las del nuevo usuario
    localStorage.removeItem('amy_active_conversation_id');
}

export function logout() {
    localStorage.removeItem('amy_token');
    localStorage.removeItem('amy_user');
    localStorage.removeItem('amy_active_conversation_id');
}

export function getUser() {
    try {
        const raw = localStorage.getItem('amy_user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function isAuthenticated() {
    return isTokenValid();
}

/* ── Chat ───────────────────────────────────────────── */

export async function sendChatMessage(studentQuery, conversationId = null, signal = null, modelPreference = 'auto') {
    const body = {
        student_query: studentQuery,
        model_preference: modelPreference
    };
    if (conversationId) {
        body.conversation_id = conversationId;
    }

    const fetchOptions = {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body)
    };
    if (signal) {
        fetchOptions.signal = signal;
    }

    const response = await fetch(`${API_BASE}/api/chat`, fetchOptions);

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }

    if (!response.ok && response.status !== 503) {
        throw new Error(`Error del servidor: ${response.status}`);
    }

    const data = await response.json();
    return data.detail ? data.detail : data;
}

/* ── Health ──────────────────────────────────────────── */

export async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`, {
            headers: { 'ngrok-skip-browser-warning': '69420' }
        });
        if (!response.ok) throw new Error('Health check failed');
        return await response.json();
    } catch {
        return {
            status: 'offline',
            database: 'disconnected',
            ollama: 'disconnected',
            model: 'unknown',
            fragments_count: 0
        };
    }
}

/* ── Conversations ──────────────────────────────────── */

export async function getConversations(signal = null) {
    const fetchOptions = { headers: authHeaders() };
    if (signal) fetchOptions.signal = signal;

    const response = await fetch(`${API_BASE}/api/conversations`, fetchOptions);

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }

    if (!response.ok) {
        throw new Error(`Error al obtener conversaciones: ${response.status}`);
    }

    return await response.json();
}

export async function createConversation(titulo, signal = null) {
    const fetchOptions = {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ titulo })
    };
    if (signal) fetchOptions.signal = signal;

    const response = await fetch(`${API_BASE}/api/conversations`, fetchOptions);

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }

    if (!response.ok) {
        throw new Error(`Error al crear conversacion: ${response.status}`);
    }

    return await response.json();
}

export async function getMessages(conversationId, signal = null) {
    const fetchOptions = { headers: authHeaders() };
    if (signal) fetchOptions.signal = signal;

    const response = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages`, fetchOptions);

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }

    if (!response.ok) {
        throw new Error(`Error al obtener mensajes: ${response.status}`);
    }

    return await response.json();
}

export async function deleteConversation(id, signal = null) {
    const fetchOptions = {
        method: 'DELETE',
        headers: authHeaders()
    };
    if (signal) fetchOptions.signal = signal;

    const response = await fetch(`${API_BASE}/api/conversations/${id}`, fetchOptions);

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }

    if (!response.ok) {
        throw new Error(`Error al eliminar conversacion: ${response.status}`);
    }

    if (response.status === 204) {
        return true;
    }
    
    return await response.json().catch(() => true);
}

/* ── Admin & DMZ Ingestion ────────────────────────────── */

export async function getAdminStats(category = 'all', timeRange = '30days', frequency = 'diario') {
    const params = new URLSearchParams({
        category,
        time_range: timeRange,
        frequency
    });
    const response = await fetch(`${API_BASE}/api/admin/stats?${params.toString()}`, {
        headers: authHeaders()
    });

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }

    if (!response.ok) {
        throw new Error(`Error al obtener estadísticas: ${response.status}`);
    }
    return await response.json();
}

export async function getAdminUsers() {
    const response = await fetch(`${API_BASE}/api/admin/users`, {
        headers: authHeaders()
    });

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }

    if (!response.ok) {
        throw new Error(`Error al obtener usuarios: ${response.status}`);
    }
    return await response.json();
}

export async function updateUserRole(userId, rol) {
    const response = await fetch(`${API_BASE}/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ rol })
    });

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Error al actualizar rol: ${response.status}`);
    }
    return await response.json();
}

export async function getAdminKnowledge(category = 'all', limit = 50, offset = 0) {
    const url = `${API_BASE}/api/admin/knowledge?category=${category}&limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
        headers: authHeaders()
    });

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }

    if (!response.ok) {
        throw new Error(`Error al obtener fragmentos RAG: ${response.status}`);
    }
    return await response.json();
}

export async function deleteKnowledgeFragment(fragmentId) {
    const response = await fetch(`${API_BASE}/api/admin/knowledge/${fragmentId}`, {
        method: 'DELETE',
        headers: authHeaders()
    });

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }

    if (!response.ok) {
        throw new Error(`Error al eliminar fragmento RAG: ${response.status}`);
    }
    return await response.json();
}

export async function getAdminAnalytics() {
    const response = await fetch(`${API_BASE}/api/admin/analytics`, {
        headers: authHeaders()
    });

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }

    if (!response.ok) {
        throw new Error(`Error al obtener analíticas RAG: ${response.status}`);
    }
    return await response.json();
}

export async function getDmzLogs() {
    const response = await fetch(`${API_BASE}/api/admin/dmz-logs`, {
        headers: authHeaders()
    });

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }

    if (!response.ok) {
        throw new Error(`Error al obtener registros DMZ: ${response.status}`);
    }
    return await response.json();
}

export async function ingestAcademicFile(file, categoria, fuente = '', autor = '') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('categoria', categoria);
    if (fuente) formData.append('fuente', fuente);
    if (autor) formData.append('autor', autor);

    const token = getToken();
    const headers = { 'ngrok-skip-browser-warning': '69420' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}/api/admin/ingest-file`, {
        method: 'POST',
        headers,
        body: formData
    });

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.detail || `Error al ingestar archivo (${response.status})`);
    }

    return data;
}

export async function ingestKnowledge(contenido, categoria, metadata = {}) {
    const response = await fetch(`${API_BASE}/api/rag/ingest`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ contenido, categoria, metadata })
    });

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.detail || `Error de la Zona Militarizada (${response.status})`);
    }

    return data;
}

