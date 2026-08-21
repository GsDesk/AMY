import { useEffect, useCallback } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import WorkflowSourceVisualizer from './WorkflowSourceVisualizer';
import { useChat } from '../hooks/useChat';
import './ChatWindow.css';

export default function ChatWindow({ conversationId, onExampleReceived, onConversationCreated, isPanelOpen, onTogglePanel, onToggleSidebar }) {
    const {
        messages,
        isLoading,
        sendMessage,
        stopGeneration,
        clearChat,
        messagesEndRef,
        lastExample,
        currentConversationId,
        loadConversation,
        selectedModel,
        setSelectedModel
    } = useChat();

    // Cuando llega un conversationId externo (del sidebar), cargar esa conversación
    useEffect(() => {
        if (conversationId && conversationId !== currentConversationId) {
            loadConversation(conversationId);
        }
    }, [conversationId, currentConversationId, loadConversation]);

    // Notificar al padre cuando se crea una conversación nueva internamente
    useEffect(() => {
        if (currentConversationId && onConversationCreated) {
            onConversationCreated(currentConversationId);
        }
    }, [currentConversationId, onConversationCreated]);

    // Cuando llega un ejemplo, notificar al padre (ChatPage)
    useEffect(() => {
        if (lastExample && onExampleReceived) {
            onExampleReceived(lastExample);
        }
    }, [lastExample, onExampleReceived]);

    const handleExplainAndFocus = useCallback((text) => {
        sendMessage(text);
    }, [sendMessage]);

    // Cuando el usuario pulsa "Ver Diagrama E-R" en un mensaje anterior
    const handleOpenDiagram = useCallback((example) => {
        if (onExampleReceived && example) {
            onExampleReceived(example);
        }
    }, [onExampleReceived]);

    // Extraer las fuentes RAG del último mensaje del tutor
    const lastTutorMsg = [...messages].reverse().find(m => m.sender === 'tutor' && m.ragSources && m.ragSources.length > 0);
    const currentSources = lastTutorMsg ? lastTutorMsg.ragSources : [];

    return (
        <main className="chat-window panel">
            <div className="chat-header">
                {/* Botón hamburger — solo visible en móvil via CSS */}
                <button
                    className="menu-toggle-btn icon-btn"
                    onClick={onToggleSidebar}
                    title="Abrir menú"
                    aria-label="Abrir menú lateral"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="3" y1="6" x2="21" y2="6"/>
                        <line x1="3" y1="12" x2="21" y2="12"/>
                        <line x1="3" y1="18" x2="21" y2="18"/>
                    </svg>
                </button>
                <h2>Sesión Educativa</h2>

                {/* CONTENEDOR DERECHO (Extremo derecho del header) */}
                <div className="header-right-controls">
                    <WorkflowSourceVisualizer isLoading={isLoading} sources={currentSources} />

                    <button
                        className={`icon-btn ${isPanelOpen ? 'active' : ''}`}
                        onClick={onTogglePanel}
                        title={isPanelOpen ? "Ocultar panel de diagramas" : "Mostrar panel de diagramas"}
                        id="toggle-panel-btn"
                        style={{ border: isPanelOpen ? '1px solid #38bdf8' : '1px solid transparent', background: isPanelOpen ? '#0369a133' : 'transparent' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="18" rx="1"/>
                            <rect x="14" y="3" width="7" height="18" rx="1"/>
                        </svg>
                    </button>

                    {isLoading && (
                        <button
                            className="btn-stop-generation"
                            onClick={stopGeneration}
                            title="Detener generación de respuesta"
                        >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="4" y="4" width="16" height="16" rx="2"/>
                            </svg>
                            <span>Detener</span>
                        </button>
                    )}

                    <button className="icon-btn" onClick={clearChat} title="Limpiar conversación" id="clear-chat-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
                    </button>
                </div>
            </div>


            <div className="chat-messages" id="chat-messages">
                {messages.map(msg => (
                    <ChatMessage
                        key={msg.id}
                        message={msg}
                        onExplainCode={handleExplainAndFocus}
                        onOpenDiagram={handleOpenDiagram}
                    />
                ))}

                {isLoading && (
                    <div className="chat-message tutor-msg typing-msg">
                        <div className="msg-avatar tutor-avatar"><span>A</span></div>
                        <div className="msg-content">
                            <div className="msg-bubble typing-bubble">
                                <div className="typing-dots">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <ChatInput
                onSend={sendMessage}
                disabled={isLoading}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
            />
        </main>
    );
}
