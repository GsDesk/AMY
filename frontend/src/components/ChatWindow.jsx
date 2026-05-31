import { useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { useChat } from '../hooks/useChat';
import './ChatWindow.css';

export default function ChatWindow({ conversationId, onExampleReceived, onConversationCreated }) {
    const {
        messages,
        isLoading,
        sendMessage,
        clearChat,
        messagesEndRef,
        lastExample,
        currentConversationId,
        loadConversation
    } = useChat();

    // Cuando llega un conversationId externo (del sidebar), cargar esa conversacion
    useEffect(() => {
        if (conversationId && conversationId !== currentConversationId) {
            loadConversation(conversationId);
        }
    }, [conversationId, currentConversationId, loadConversation]);

    // Notificar al padre cuando se crea una conversacion nueva internamente
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

    return (
        <main className="chat-window panel">
            <div className="chat-header">
                <h2>Sesion Educativa</h2>
                <div className="header-controls">
                    {isLoading && <span className="thinking-indicator">Procesando...</span>}
                    <button className="icon-btn" onClick={clearChat} title="Limpiar conversacion" id="clear-chat-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
                    </button>
                </div>
            </div>

            <div className="chat-messages" id="chat-messages">
                {messages.map(msg => (
                    <ChatMessage key={msg.id} message={msg} />
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

            <ChatInput onSend={sendMessage} disabled={isLoading} />
        </main>
    );
}
