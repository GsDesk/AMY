import { useState, useCallback, useRef, useEffect, Component } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import LiveExamplePanel from '../components/LiveExamplePanel';
import { getUser } from '../services/api';
import './ChatPage.css';

class PanelErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, info) {
        console.error('Error en PanelErrorBoundary:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <aside className="live-panel panel" style={{ width: '380px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#0d0d10' }}>
                    <div style={{ color: '#f87171', fontWeight: 600, fontSize: '0.9rem' }}>Aviso del Visor de Diagramas</div>
                    <p style={{ color: '#a1a1aa', fontSize: '0.8rem', lineHeight: 1.5, margin: 0 }}>
                        Ocurrió una inconsistencia en los datos del esquema. Se evitó la caída de la pantalla.
                    </p>
                    <button
                        onClick={() => {
                            this.setState({ hasError: false });
                            if (this.props.onClose) this.props.onClose();
                        }}
                        style={{ padding: '0.4rem 0.8rem', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                        Cerrar panel
                    </button>
                </aside>
            );
        }
        return this.props.children;
    }
}

export default function ChatPage() {
    const user = getUser();
    const storageKey = user?.email ? `amy_active_conv_${user.email}` : 'amy_active_conv_guest';

    const [activeExample, setActiveExample] = useState(null);
    const [currentConversationId, setCurrentConversationId] = useState(() => {
        try {
            return localStorage.getItem(storageKey) || null;
        } catch {
            return null;
        }
    });
    const [conversationKey, setConversationKey] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const lastActiveExample = useRef(null);

    const updateCurrentConversationId = useCallback((id) => {
        setCurrentConversationId(id);
        try {
            if (id) {
                localStorage.setItem(storageKey, id);
            } else {
                localStorage.removeItem(storageKey);
            }
        } catch (err) {
            console.error('Error guardando conversacion activa:', err);
        }
    }, [storageKey]);

    const handleExampleReceived = useCallback((example) => {
        if (example) {
            lastActiveExample.current = example;
            setActiveExample(example);
        }
    }, []);

    const handleSelectConversation = useCallback((id) => {
        updateCurrentConversationId(id);
        setActiveExample(null);
        lastActiveExample.current = null;
        setSidebarOpen(false);
    }, [updateCurrentConversationId]);

    const handleNewConversation = useCallback(() => {
        updateCurrentConversationId(null);
        setActiveExample(null);
        lastActiveExample.current = null;
        setConversationKey(prev => prev + 1);
        setSidebarOpen(false);
    }, [updateCurrentConversationId]);

    const handleTogglePanel = useCallback(() => {
        setActiveExample(prev => {
            if (prev) return null;
            return lastActiveExample.current || null;
        });
    }, []);

    return (
        <div className={`chat-page ${activeExample ? 'with-panel' : ''} ${sidebarOpen ? 'sidebar-open' : ''}`}>
            {sidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            <Sidebar
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
                activeConversationId={currentConversationId}
                onClose={() => setSidebarOpen(false)}
            />
            <ChatWindow
                key={conversationKey}
                conversationId={currentConversationId}
                onExampleReceived={handleExampleReceived}
                onConversationCreated={updateCurrentConversationId}
                isPanelOpen={!!activeExample}
                onTogglePanel={handleTogglePanel}
                onToggleSidebar={() => setSidebarOpen(o => !o)}
            />
            {activeExample && (
                <PanelErrorBoundary onClose={() => setActiveExample(null)}>
                    <LiveExamplePanel
                        example={activeExample}
                        onClose={() => setActiveExample(null)}
                    />
                </PanelErrorBoundary>
            )}
        </div>
    );
}
