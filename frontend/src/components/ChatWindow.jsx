import { useState, useEffect, useCallback, useMemo } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import WorkflowSourceVisualizer from './WorkflowSourceVisualizer';
import { useChat } from '../hooks/useChat';
import './ChatWindow.css';

const SOCRATIC_PHRASES = [
    "¿Qué quieres crear hoy?",
    "¿Qué consulta SQL optimizamos hoy?",
    "¿Cómo modelamos tu base de datos hoy?",
    "¿Normalizamos un esquema relacional?",
    "¿Qué duda tienes sobre álgebra relacional?",
    "¿Qué relación o cardinalidad analizamos hoy?",
    "¿Diseñamos un modelo Entidad-Relación?"
];

const PROMPT_SUGGESTIONS = [
    { label: "JOINs y Subconsultas", prompt: "¿Cómo determino qué tipo de JOIN usar entre dos tablas relacionadas?" },
    { label: "Normalización (1FN a BCNF)", prompt: "¿Cómo sé si una tabla cumple con la 2da y 3ra Forma Normal?" },
    { label: "Modelo Entidad-Relación", prompt: "¿Cómo identifico las cardinalidades 1:N y N:M en un diagrama E-R?" },
    { label: "Transacciones y ACID", prompt: "¿Por qué es crucial la propiedad de Aislamiento en bases de datos concurrentes?" }
];

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

    // Frase aleatoria seleccionada al montar el componente
    const targetPhrase = useMemo(() => {
        const idx = Math.floor(Math.random() * SOCRATIC_PHRASES.length);
        return SOCRATIC_PHRASES[idx];
    }, [currentConversationId]);

    // Construcción progresiva de izquierda a derecha (efecto Typewriter)
    const [animatedPhrase, setAnimatedPhrase] = useState('');
    useEffect(() => {
        let currentIdx = 0;
        setAnimatedPhrase('');
        const interval = setInterval(() => {
            if (currentIdx <= targetPhrase.length) {
                setAnimatedPhrase(targetPhrase.slice(0, currentIdx));
                currentIdx++;
            } else {
                clearInterval(interval);
            }
        }, 40);
        return () => clearInterval(interval);
    }, [targetPhrase]);

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

    const handleOpenDiagram = useCallback((example) => {
        if (onExampleReceived && example) {
            onExampleReceived(example);
        }
    }, [onExampleReceived]);

    // Determinar si es una conversación vacía/inicial (solo tiene bienvenida o ningún mensaje de usuario)
    const hasUserMessages = messages.some(m => m.sender === 'student' || m.sender === 'user');

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

                {/* CONTENEDOR DERECHO */}
                <div className="header-right-controls">
                    <WorkflowSourceVisualizer isLoading={isLoading} sources={currentSources} />

                    <button
                        className={`icon-btn ${isPanelOpen ? 'active' : ''}`}
                        onClick={onTogglePanel}
                        title={isPanelOpen ? "Ocultar Tablero E-R y Esquema BDD" : "Abrir Tablero E-R y Esquema BDD"}
                        id="toggle-panel-btn"
                        style={{ border: isPanelOpen ? '1px solid #38bdf8' : '1px solid transparent', background: isPanelOpen ? '#0369a133' : 'transparent' }}
                    >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <ellipse cx="12" cy="5" rx="9" ry="3"/>
                            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
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

            {/* Si no hay mensajes del usuario, mostrar el Hero Centrado con Frase Animada (Imagen 1) */}
            {!hasUserMessages ? (
                <div className="chat-empty-state">
                    <div className="chat-empty-content">
                        <h1 className="chat-animated-title">
                            {animatedPhrase}
                            <span className="typewriter-cursor">|</span>
                        </h1>

                        <div className="chat-empty-input-container">
                            <ChatInput
                                onSend={sendMessage}
                                disabled={isLoading}
                                selectedModel={selectedModel}
                                onModelChange={setSelectedModel}
                            />
                        </div>

                        <div className="chat-suggestions-grid">
                            {PROMPT_SUGGESTIONS.map((item, idx) => (
                                <button
                                    key={idx}
                                    className="chat-suggestion-chip"
                                    onClick={() => sendMessage(item.prompt)}
                                    disabled={isLoading}
                                >
                                    <span className="chip-indicator"></span>
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <>
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
                </>
            )}
        </main>
    );
}
