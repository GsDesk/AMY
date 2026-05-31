import { useState, useCallback, useRef, useEffect } from 'react';
import { sendChatMessage, createConversation, getMessages } from '../services/api';

const WELCOME_MESSAGE = {
    id: 'welcome',
    sender: 'tutor',
    text: 'Hola. Soy **AMY**, tu asistente de Fundamentos de Bases de Datos de la UPEC.\n\nPuedo ayudarte con:\n- **SQL** (SELECT, JOIN, subconsultas)\n- **Normalizacion** (1NF, 2NF, 3NF, BCNF)\n- **Modelo Entidad-Relacion**\n- **Algebra Relacional**\n\nEscribe tu duda para comenzar.\n\n*Tip: Pide un ejemplo de como relacionar tablas y se abrira un panel interactivo.*',
    source: 'system',
    topic: 'Bienvenida',
    timestamp: new Date()
};

export function useChat() {
    const [messages, setMessages] = useState([WELCOME_MESSAGE]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastExample, setLastExample] = useState(null);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    const sendMessage = useCallback(async (text) => {
        if (!text.trim() || isLoading) return;

        const userMsg = {
            id: `user-${Date.now()}`,
            sender: 'user',
            text: text.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            // Si es el primer mensaje, crear una conversacion en el backend
            let convId = currentConversationId;
            if (!convId) {
                const firstWords = text.trim().substring(0, 60);
                const conv = await createConversation(firstWords);
                convId = conv.id;
                setCurrentConversationId(convId);
            }

            const response = await sendChatMessage(text.trim(), convId);

            const tutorMsg = {
                id: `tutor-${Date.now()}`,
                sender: 'tutor',
                text: response.feedback || 'No pude generar una respuesta.',
                analysis: response.analysis,
                source: response.source || 'ollama-mistral',
                topic: response.topic || 'General',
                ragUsed: response.rag_context_used || false,
                hasExample: !!response.live_example,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, tutorMsg]);

            // Si la respuesta incluye un ejemplo interactivo, guardarlo
            if (response.live_example) {
                setLastExample(response.live_example);
            }
        } catch (error) {
            const errorMsg = {
                id: `error-${Date.now()}`,
                sender: 'tutor',
                text: `Error: ${error.message || 'Sin conexion con el servidor.'}`,
                source: 'error',
                topic: 'Error',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, currentConversationId]);

    const loadConversation = useCallback(async (id) => {
        setIsLoading(true);
        try {
            const data = await getMessages(id);
            const loaded = (data || []).map((msg, idx) => ({
                id: msg.id || `msg-${idx}-${Date.now()}`,
                sender: msg.sender === 'user' ? 'user' : 'tutor',
                text: msg.text || msg.content || '',
                source: msg.source || 'loaded',
                topic: msg.topic || '',
                timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
            }));

            setMessages([WELCOME_MESSAGE, ...loaded]);
            setCurrentConversationId(id);
            setLastExample(null);
        } catch (error) {
            console.error('Error cargando conversacion:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearChat = useCallback(() => {
        setMessages([WELCOME_MESSAGE]);
        setLastExample(null);
        setCurrentConversationId(null);
    }, []);

    return {
        messages,
        isLoading,
        sendMessage,
        clearChat,
        messagesEndRef,
        lastExample,
        currentConversationId,
        loadConversation
    };
}
