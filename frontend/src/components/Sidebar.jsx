import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusIndicator from './StatusIndicator';
import { getConversations, deleteConversation, getUser, logout } from '../services/api';
import './Sidebar.css';

export default function Sidebar({ onSelectConversation, onNewConversation, activeConversationId }) {
    const [conversations, setConversations] = useState([]);
    const navigate = useNavigate();
    const user = getUser();

    const fetchConversations = async () => {
        try {
            const data = await getConversations();
            setConversations(data || []);
        } catch (err) {
            console.error('Error cargando conversaciones:', err);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        try {
            await deleteConversation(id);
            setConversations(prev => prev.filter(c => c.id !== id));
            if (activeConversationId === id && onNewConversation) {
                onNewConversation();
            }
        } catch (err) {
            console.error('Error eliminando conversacion:', err);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleNewConversation = () => {
        if (onNewConversation) onNewConversation();
        fetchConversations();
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
    };

    return (
        <aside className="sidebar panel">
            <div className="brand">
                <div className="amy-mark">A</div>
                <h1>AMY</h1>
                <span className="subtitle">Fundamentos de BD / UPEC</span>
            </div>

            {user && (
                <div className="user-info">
                    <span className="user-name">{user.nombre || user.email}</span>
                    <span className="user-email">{user.email}</span>
                </div>
            )}

            <StatusIndicator />

            <div className="conversations">
                <div className="conversations-header">
                    <h3>Conversaciones</h3>
                    <button className="new-conv-btn" onClick={handleNewConversation} title="Nueva conversacion">
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
                            onClick={() => onSelectConversation && onSelectConversation(conv.id)}
                        >
                            <div className="conv-info">
                                <span className="conv-title">{conv.titulo || 'Sin titulo'}</span>
                                <span className="conv-date">{formatDate(conv.created_at)}</span>
                            </div>
                            <button
                                className="conv-delete"
                                onClick={(e) => handleDelete(e, conv.id)}
                                title="Eliminar"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="info-box">
                <p><strong>Materia:</strong> Fundamentos de Bases de Datos</p>
                <p><strong>Universidad:</strong> UPEC</p>
                <p><strong>Motor IA:</strong> Mistral (Local)</p>
            </div>

            <div className="instructions">
                <h3>Temas disponibles:</h3>
                <ul>
                    <li>SQL (SELECT, JOIN, DDL, DML)</li>
                    <li>Normalizacion (1NF-BCNF)</li>
                    <li>Modelo Entidad-Relacion</li>
                    <li>Algebra Relacional</li>
                    <li>Transacciones (ACID)</li>
                    <li>Indices y Optimizacion</li>
                </ul>
            </div>

            <div className="sidebar-footer">
                <p>Metodo Socratico: te guiare con preguntas, no con respuestas directas.</p>
                <button className="btn logout-btn" onClick={handleLogout}>Cerrar sesion</button>
            </div>
        </aside>
    );
}
