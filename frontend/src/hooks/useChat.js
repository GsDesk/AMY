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
    const abortControllerRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    /**
     * Cancela la petición HTTP en curso si existe
     */
    const stopGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    }, []);

    const sendMessage = useCallback(async (text) => {
        if (!text.trim() || isLoading) return;

        // Cancelar petición anterior si estuviese activa
        stopGeneration();

        // Crear una nueva instancia de AbortController para esta petición
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const userMsg = {
            id: `user-${Date.now()}`,
            sender: 'user',
            text: text.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            // Si es el primer mensaje, crear la conversación en el backend
            let convId = currentConversationId;
            if (!convId) {
                const firstWords = text.trim().substring(0, 60);
                const conv = await createConversation(firstWords, controller.signal);
                convId = conv.id;
                setCurrentConversationId(convId);
            }

            const response = await sendChatMessage(text.trim(), convId, controller.signal);

            const tutorMsg = {
                id: `tutor-${Date.now()}`,
                sender: 'tutor',
                text: response.feedback || 'No pude generar una respuesta.',
                analysis: response.analysis,
                source: response.source || 'ollama-mistral',
                topic: response.topic || 'General',
                ragUsed: response.rag_context_used || false,
                ragSources: response.rag_sources || [],
                hasExample: !!response.live_example,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, tutorMsg]);

            if (response.live_example) {
                setLastExample(response.live_example);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                // Actualizar estado de carga silenciosamente sin error fatal ni romper el flujo
                return;
            }
            const errorMsg = {
                id: `error-${Date.now()}`,
                sender: 'tutor',
                text: `Error: ${error.message || 'Sin conexión con el servidor.'}`,
                source: 'error',
                topic: 'Error',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    }, [isLoading, currentConversationId, stopGeneration]);

    const loadConversation = useCallback(async (id) => {
        // Cancelar petición en curso antes de cambiar de conversación
        stopGeneration();
        setIsLoading(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const data = await getMessages(id, controller.signal);
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
            if (error.name !== 'AbortError') {
                console.error('Error cargando conversación:', error);
            }
        } finally {
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    }, [stopGeneration]);

    const clearChat = useCallback(() => {
        stopGeneration();
        setMessages([WELCOME_MESSAGE]);
        setLastExample(null);
        setCurrentConversationId(null);
    }, [stopGeneration]);

    return {
        messages,
        isLoading,
        sendMessage,
        stopGeneration,
        clearChat,
        messagesEndRef,
        lastExample,
        currentConversationId,
        loadConversation
    };
}
