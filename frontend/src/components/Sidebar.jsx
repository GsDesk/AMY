import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusIndicator from './StatusIndicator';
import { getConversations, deleteConversation, getUser, logout, getSavedAccounts, removeSavedAccount, switchAccountSession } from '../services/api';
import './Sidebar.css';

export default function Sidebar({ onSelectConversation, onNewConversation, activeConversationId, onClose }) {
    const navigate = useNavigate();
    const user = getUser();
    const userCacheKey = user?.email ? `amy_conversations_cache_${user.email}` : 'amy_conversations_cache_guest';

    // Inicializar estado con caché local del usuario activo para carga instantánea
    const [conversations, setConversations] = useState(() => {
        try {
            const cached = localStorage.getItem(userCacheKey);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });

    // Estados para el Modal de Gestión de Sesión y Cuentas
    const [showSessionModal, setShowSessionModal] = useState(false);
    const [showAccountsCard, setShowAccountsCard] = useState(false);
    const [savedAccounts, setSavedAccounts] = useState([]);

    // Obtener conversaciones desde la API de FastAPI y sincronizar con localStorage del usuario
    const fetchConversations = useCallback(async () => {
        try {
            const data = await getConversations();
            const list = data || [];
            setConversations(list);
            localStorage.setItem(userCacheKey, JSON.stringify(list));
        } catch (err) {
            console.error('Error cargando conversaciones desde API:', err);
        }
    }, [userCacheKey]);

    useEffect(() => {
        setConversations(() => {
            try {
                const cached = localStorage.getItem(userCacheKey);
                return cached ? JSON.parse(cached) : [];
            } catch {
                return [];
            }
        });
        fetchConversations();

        const handleUpdate = () => fetchConversations();
        window.addEventListener('amy_conv_updated', handleUpdate);
        return () => window.removeEventListener('amy_conv_updated', handleUpdate);
    }, [fetchConversations, activeConversationId, userCacheKey]);

    const handleSelectConversation = (id) => {
        if (onSelectConversation) {
            onSelectConversation(id);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        try {
            await deleteConversation(id);
            setConversations(prev => {
                const updated = prev.filter(c => c.id !== id);
                localStorage.setItem(userCacheKey, JSON.stringify(updated));
                return updated;
            });
            if (activeConversationId === id && onNewConversation) {
                onNewConversation();
            }
        } catch (err) {
            console.error('Error eliminando conversación:', err);
        }
    };

    const handleOpenSessionModal = () => {
        setSavedAccounts(getSavedAccounts());
        setShowAccountsCard(false);
        setShowSessionModal(true);
    };

    const handleLogout = () => {
        logout();
        setShowSessionModal(false);
        navigate('/');
    };

    const handleSwitchAccount = (acc) => {
        if (acc.email === user?.email) {
            setShowSessionModal(false);
            return;
        }
        switchAccountSession(acc);
        setShowSessionModal(false);
        window.location.reload();
    };

    const handleRemoveAccount = (e, email) => {
        e.stopPropagation();
        const updated = removeSavedAccount(email);
        setSavedAccounts(updated);
    };

    const handleAddNewAccount = () => {
        logout();
        setShowSessionModal(false);
        navigate('/login');
    };

    const handleNewConversation = () => {
        if (onNewConversation) {
            onNewConversation();
        }
        fetchConversations();
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);

        if (diffSecs < 60) {
            return 'Hace un momento';
        } else if (diffMins < 60) {
            return `Hace ${diffMins} min`;
        } else if (diffHours < 24) {
            return `Hace ${diffHours} h`;
        } else {
            return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
        }
    };

    return (
        <>
            <aside className="sidebar panel">
                {/* Botón cerrar drawer — solo visible en móvil via CSS */}
                {onClose && (
                    <button className="sidebar-close-btn" onClick={onClose} aria-label="Cerrar menú">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                )}
                <div className="brand">
                    <div className="amy-mark">A</div>
                    <h1>AMY</h1>
                    <span className="subtitle">Fundamentos de BD / UPEC</span>
                </div>

                {user && (
                    <div className="user-info">
                        <span className="user-name">{user.nombre || user.email}</span>
                        <span className="user-email">{user.email}</span>
                        {user.rol === 'admin' && (
                            <button
                                className="admin-link-btn"
                                onClick={() => navigate('/admin')}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                <span>Panel Admin (DMZ)</span>
                            </button>
                        )}
                    </div>
                )}

                <StatusIndicator />

                <div className="conversations">
                    <div className="conversations-header">
                        <h3>Conversaciones</h3>
                        <button className="new-conv-btn" onClick={handleNewConversation} title="Nueva conversación">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                        </button>
                    </div>

                    {conversations.length === 0 && (
                        <p className="conv-empty">Sin conversaciones previas</p>
                    )}

                    <ul className="conv-list">
                        {conversations.map(conv => (
                            <li
                                key={conv.id}
                                className={`conv-item ${activeConversationId === conv.id ? 'active' : ''}`}
                                onClick={() => handleSelectConversation(conv.id)}
                            >
                                <div className="conv-info">
                                    <span className="conv-title">{conv.titulo || 'Sin título'}</span>
                                    <span className="conv-date">{formatDate(conv.created_at)}</span>
                                </div>
                                <button
                                    className="conv-delete"
                                    onClick={(e) => handleDelete(e, conv.id)}
                                    title="Eliminar conversación"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="instructions">
                    <h3>Temas disponibles:</h3>
                    <ul>
                        <li>SQL (SELECT, JOIN, DDL, DML)</li>
                        <li>Normalización (1NF-BCNF)</li>
                        <li>Modelo Entidad-Relación</li>
                        <li>Álgebra Relacional</li>
                        <li>Transacciones (ACID)</li>
                        <li>Índices y Optimización</li>
                    </ul>
                </div>

                <div className="sidebar-footer">
                    <button
                        className="btn logout-trigger-btn"
                        onClick={handleOpenSessionModal}
                        title="Opciones de cuenta y sesión"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        <span>Cerrar sesión</span>
                    </button>
                </div>
            </aside>

            {/* Modal de Opciones de Sesión y Cambio de Cuenta */}
            {showSessionModal && (
                <div className="session-modal-overlay" onClick={() => setShowSessionModal(false)}>
                    <div className="session-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="session-modal-header">
                            <div className="session-modal-user">
                                <div className="session-modal-avatar">
                                    {(user?.nombre || user?.email || 'U')[0].toUpperCase()}
                                </div>
                                <div className="session-modal-user-details">
                                    <span className="session-modal-name">{user?.nombre || 'Usuario'}</span>
                                    <span className="session-modal-email">{user?.email || 'sin correo'}</span>
                                </div>
                            </div>
                            <button
                                className="session-modal-close-btn"
                                onClick={() => setShowSessionModal(false)}
                                aria-label="Cerrar modal"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>

                        <div className="session-modal-body">
                            {/* Botón para desplegar cambio de cuentas */}
                            <button
                                className={`session-action-btn ${showAccountsCard ? 'active' : ''}`}
                                onClick={() => setShowAccountsCard(!showAccountsCard)}
                            >
                                <div className="session-action-left">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                        <circle cx="8.5" cy="7" r="4"/>
                                        <path d="M20 8v6M23 11h-6"/>
                                    </svg>
                                    <div className="session-action-text">
                                        <span className="session-action-title">Cambiar de cuenta</span>
                                        <span className="session-action-subtitle">Administra o accede con otras cuentas</span>
                                    </div>
                                </div>
                                <svg
                                    className={`session-chevron ${showAccountsCard ? 'expanded' : ''}`}
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <polyline points="6 9 12 15 18 9"/>
                                </svg>
                            </button>

                            {/* Tarjeta de cuentas desplegable */}
                            {showAccountsCard && (
                                <div className="session-accounts-subcard">
                                    <div className="session-accounts-list">
                                        {savedAccounts.map((acc) => {
                                            const isActive = acc.email === user?.email;
                                            return (
                                                <div
                                                    key={acc.email}
                                                    className={`session-account-item ${isActive ? 'current-active' : ''}`}
                                                    onClick={() => handleSwitchAccount(acc)}
                                                >
                                                    <div className="account-item-avatar">
                                                        {(acc.nombre || acc.email)[0].toUpperCase()}
                                                    </div>
                                                    <div className="account-item-info">
                                                        <span className="account-item-name">{acc.nombre}</span>
                                                        <span className="account-item-email">{acc.email}</span>
                                                    </div>
                                                    {isActive ? (
                                                        <span className="account-active-tag">Activa</span>
                                                    ) : (
                                                        <button
                                                            className="account-remove-btn"
                                                            onClick={(e) => handleRemoveAccount(e, acc.email)}
                                                            title="Quitar cuenta del dispositivo"
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M18 6L6 18M6 6l12 12"/>
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <button className="add-account-btn" onClick={handleAddNewAccount}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 5v14M5 12h14"/>
                                        </svg>
                                        <span>Iniciar sesión con otra cuenta</span>
                                    </button>
                                </div>
                            )}

                            {/* Botón para cerrar sesión */}
                            <button
                                className="session-action-btn logout-action-btn"
                                onClick={handleLogout}
                            >
                                <div className="session-action-left">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                        <polyline points="16 17 21 12 16 7"/>
                                        <line x1="21" y1="12" x2="9" y2="12"/>
                                    </svg>
                                    <div className="session-action-text">
                                        <span className="session-action-title">Cerrar sesión actual</span>
                                        <span className="session-action-subtitle">Salir de esta cuenta en este navegador</span>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
