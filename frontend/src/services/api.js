/**
 * Tutor IA UPEC — API Service Layer
 * Abstrae las llamadas HTTP al backend FastAPI.
 * Incluye gestion de JWT y endpoints de autenticacion.
 */

const API_BASE = '';

/* ── Token helpers ─────────────────────────────────── */

function getToken() {
    return localStorage.getItem('amy_token');
}

function authHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
}

/* ── Auth ───────────────────────────────────────────── */

export async function login(email, password) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Error de autenticacion: ${response.status}`);
    }

    const data = await response.json();
    localStorage.setItem('amy_token', data.token);
    localStorage.setItem('amy_user', JSON.stringify(data.user));
    return data;
}

export async function register(email, password, nombre) {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nombre })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Error de registro: ${response.status}`);
    }

    const data = await response.json();
    localStorage.setItem('amy_token', data.token);
    localStorage.setItem('amy_user', JSON.stringify(data.user));
    return data;
}

export function logout() {
    localStorage.removeItem('amy_token');
    localStorage.removeItem('amy_user');
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
    return !!getToken();
}

/* ── Chat ───────────────────────────────────────────── */

export async function sendChatMessage(studentQuery, conversationId = null) {
    const body = { student_query: studentQuery };
    if (conversationId) {
        body.conversation_id = conversationId;
    }

    const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body)
    });

    if (!response.ok && response.status !== 503) {
        throw new Error(`Error del servidor: ${response.status}`);
    }

    const data = await response.json();
    return data.detail ? data.detail : data;
}

/* ── Health ──────────────────────────────────────────── */

export async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`);
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

export async function getConversations() {
    const response = await fetch(`${API_BASE}/api/conversations`, {
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error(`Error al obtener conversaciones: ${response.status}`);
    }

    return await response.json();
}

export async function createConversation(titulo) {
    const response = await fetch(`${API_BASE}/api/conversations`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ titulo })
    });

    if (!response.ok) {
        throw new Error(`Error al crear conversacion: ${response.status}`);
    }

    return await response.json();
}

export async function getMessages(conversationId) {
    const response = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages`, {
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error(`Error al obtener mensajes: ${response.status}`);
    }

    return await response.json();
}

export async function deleteConversation(id) {
    const response = await fetch(`${API_BASE}/api/conversations/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error(`Error al eliminar conversacion: ${response.status}`);
    }

    if (response.status === 204) {
        return true;
    }
    
    return await response.json().catch(() => true);
}
