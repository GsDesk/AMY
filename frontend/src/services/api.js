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

export async function getAuthConfig() {
    const response = await fetch(`${API_BASE}/api/auth/config`);
    if (!response.ok) {
        throw new Error(`Error al obtener configuracion: ${response.status}`);
    }
    return await response.json();
}

export async function loginWithMicrosoft(accessToken) {
    const response = await fetch(`${API_BASE}/api/auth/microsoft-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Error de autenticación institucional: ${response.status}`);
    }

    const data = await response.json();
    localStorage.setItem('amy_token', data.token);
    localStorage.setItem('amy_user', JSON.stringify(data.user));
    return data;
}

export async function googleLogin(credential) {
    const response = await fetch(`${API_BASE}/api/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Error de autenticacion con Google: ${response.status}`);
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

export async function sendChatMessage(studentQuery, conversationId = null, signal = null) {
    const body = { student_query: studentQuery };
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

export async function getConversations(signal = null) {
    const fetchOptions = { headers: authHeaders() };
    if (signal) fetchOptions.signal = signal;

    const response = await fetch(`${API_BASE}/api/conversations`, fetchOptions);

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

    if (!response.ok) {
        throw new Error(`Error al crear conversacion: ${response.status}`);
    }

    return await response.json();
}

export async function getMessages(conversationId, signal = null) {
    const fetchOptions = { headers: authHeaders() };
    if (signal) fetchOptions.signal = signal;

    const response = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages`, fetchOptions);

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

    if (!response.ok) {
        throw new Error(`Error al eliminar conversacion: ${response.status}`);
    }

    if (response.status === 204) {
        return true;
    }
    
    return await response.json().catch(() => true);
}

/* ── Admin & DMZ Ingestion ────────────────────────────── */

export async function getAdminStats() {
    const response = await fetch(`${API_BASE}/api/admin/stats`, {
        headers: authHeaders()
    });
    if (!response.ok) {
        throw new Error(`Error al obtener estadísticas: ${response.status}`);
    }
    return await response.json();
}

export async function getAdminUsers() {
    const response = await fetch(`${API_BASE}/api/admin/users`, {
        headers: authHeaders()
    });
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
    if (!response.ok) {
        throw new Error(`Error al eliminar fragmento RAG: ${response.status}`);
    }
    return await response.json();
}

export async function getAdminAnalytics() {
    const response = await fetch(`${API_BASE}/api/admin/analytics`, {
        headers: authHeaders()
    });
    if (!response.ok) {
        throw new Error(`Error al obtener analíticas RAG: ${response.status}`);
    }
    return await response.json();
}

export async function getDmzLogs() {
    const response = await fetch(`${API_BASE}/api/admin/dmz-logs`, {
        headers: authHeaders()
    });
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
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}/api/admin/ingest-file`, {
        method: 'POST',
        headers,
        body: formData
    });

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

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.detail || `Error de la Zona Militarizada (${response.status})`);
    }

    return data;
}

