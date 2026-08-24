import { useState, useCallback, useRef, useEffect } from 'react';
import { createConversation, getMessages, sendChatMessage } from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

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
    const [selectedModel, setSelectedModel] = useState('auto');
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    const stopGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    }, []);

    const sendMessage = useCallback(async (text, attachment = null) => {
        if ((!text || !text.trim()) && !attachment) return;
        if (isLoading) return;

        stopGeneration();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const userMsg = {
            id: `user-${Date.now()}`,
            sender: 'user',
            text: (text || '').trim(),
            attachment: attachment ? {
                filename: attachment.filename,
                mimeType: attachment.mimeType,
                sizeBytes: attachment.sizeBytes,
                base64Data: attachment.base64Data
            } : null,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        // ID del mensaje del tutor que vamos a construir progresivamente
        const tutorId = `tutor-${Date.now()}`;

        // Insertar mensaje tutor vacio (se llenara con los tokens)
        setMessages(prev => [...prev, {
            id: tutorId,
            sender: 'tutor',
            text: '',
            source: selectedModel === 'auto' ? 'gemini' : selectedModel,
            topic: 'Procesando...',
            ragUsed: false,
            ragSources: [],
            ragLearned: false,
            ragLearnedReason: null,
            streaming: true,
            timestamp: new Date()
        }]);

        try {
            // Crear conversacion si es la primera
            let convId = currentConversationId;
            if (!convId) {
                const firstWords = (text || '').trim().substring(0, 60) || attachment?.filename || 'Nueva conversación';
                const conv = await createConversation(firstWords, controller.signal);
                convId = conv.id;
                setCurrentConversationId(convId);
            }

            const token = localStorage.getItem('amy_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const body = JSON.stringify({
                student_query: (text || '').trim(),
                conversation_id: convId,
                model_preference: selectedModel,
                attachment: attachment ? {
                    filename: attachment.filename,
                    mime_type: attachment.mimeType,
                    base64_data: attachment.base64Data,
                    size_bytes: attachment.sizeBytes
                } : null
            });

            // Intentar endpoint SSE streaming
            const resp = await fetch(`${API_BASE}/api/chat/stream`, {
                method: 'POST',
                headers,
                body,
                signal: controller.signal
            });

            if (!resp.ok) {
                // Si stream no existe (404) o falla, usar POST /api/chat directamente
                const data = await sendChatMessage((text || '').trim(), convId, null, selectedModel);
                setMessages(prev => prev.map(m =>
                    m.id === tutorId ? {
                        ...m,
                        text: data.feedback || 'No pude generar una respuesta.',
                        analysis: data.analysis,
                        source: data.source || 'gemini',
                        topic: data.topic || 'General',
                        ragUsed: data.rag_context_used || false,
                        ragSources: data.rag_sources || [],
                        ragLearned: data.rag_learned || false,
                        ragLearnedReason: data.rag_learned_reason || null,
                        hasExample: !!data.live_example,
                        liveExample: data.live_example || null,
                        modelSwitched: data.model_switched || false,
                        switchReason: data.switch_reason || null,
                        streaming: false
                    } : m
                ));
                if (data.live_example) setLastExample(data.live_example);
                return;
            }

            const contentType = resp.headers.get('content-type') || '';
            
            if (contentType.includes('text/event-stream')) {
                // --- MODO STREAMING SSE ---
                const reader = resp.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let finalResult = null;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // guardar linea incompleta

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const raw = line.slice(6).trim();
                        if (!raw) continue;
                        try {
                            const event = JSON.parse(raw);
                            if (event.type === 'token') {
                                // Agregar token al mensaje en tiempo real
                                setMessages(prev => prev.map(m =>
                                    m.id === tutorId
                                        ? { ...m, text: m.text + event.text }
                                        : m
                                ));
                            } else if (event.type === 'done' || event.type === 'result') {
                                finalResult = event.data;
                            } else if (event.type === 'error') {
                                throw new Error(event.message);
                            }
                        } catch (parseErr) {
                            // ignorar lineas malformadas
                        }
                    }
                }

                // Actualizar mensaje final con metadata
                if (finalResult) {
                    setMessages(prev => prev.map(m =>
                        m.id === tutorId ? {
                            ...m,
                            text: finalResult.feedback || m.text,
                            analysis: finalResult.analysis,
                            source: finalResult.source || 'gemini',
                            topic: finalResult.topic || 'General',
                            ragUsed: finalResult.rag_context_used || false,
                            ragSources: finalResult.rag_sources || [],
                            ragLearned: finalResult.rag_learned || false,
                            ragLearnedReason: finalResult.rag_learned_reason || null,
                            hasExample: !!finalResult.live_example,
                            liveExample: finalResult.live_example || null,
                            modelSwitched: finalResult.model_switched || false,
                            switchReason: finalResult.switch_reason || null,
                            streaming: false
                        } : m
                    ));
                    if (finalResult.live_example) setLastExample(finalResult.live_example);
                } else {
                    // Stream completo sin resultado final estructurado
                    setMessages(prev => prev.map(m =>
                        m.id === tutorId ? { ...m, streaming: false, topic: 'Respuesta' } : m
                    ));
                }

            } else {
                // --- MODO FALLBACK JSON completo ---
                const data = await resp.json();
                setMessages(prev => prev.map(m =>
                    m.id === tutorId ? {
                        ...m,
                        text: data.feedback || 'No pude generar una respuesta.',
                        analysis: data.analysis,
                        source: data.source || 'ollama-mistral',
                        topic: data.topic || 'General',
                        ragUsed: data.rag_context_used || false,
                        ragSources: data.rag_sources || [],
                        ragLearned: data.rag_learned || false,
                        ragLearnedReason: data.rag_learned_reason || null,
                        hasExample: !!data.live_example,
                        liveExample: data.live_example || null,
                        modelSwitched: data.model_switched || false,
                        switchReason: data.switch_reason || null,
                        streaming: false
                    } : m
                ));
                if (data.live_example) setLastExample(data.live_example);
            }

        } catch (error) {
            if (error.name === 'AbortError') return;

            // Reintentar automáticamente vía POST /api/chat estándar si el stream SSE falla o se corta
            try {
                const data = await sendChatMessage((text || '').trim(), currentConversationId, null, selectedModel);
                setMessages(prev => prev.map(m =>
                    m.id === tutorId ? {
                        ...m,
                        text: data.feedback || 'No pude generar una respuesta.',
                        analysis: data.analysis,
                        source: data.source || 'ollama-mistral',
                        topic: data.topic || 'General',
                        ragUsed: data.rag_context_used || false,
                        ragSources: data.rag_sources || [],
                        ragLearned: data.rag_learned || false,
                        ragLearnedReason: data.rag_learned_reason || null,
                        hasExample: !!data.live_example,
                        liveExample: data.live_example || null,
                        modelSwitched: data.model_switched || false,
                        switchReason: data.switch_reason || null,
                        streaming: false
                    } : m
                ));
                if (data.live_example) setLastExample(data.live_example);
            } catch (retryErr) {
                console.error("Error al reintentar chat:", retryErr);
                setMessages(prev => prev.map(m =>
                    m.id === tutorId ? {
                        ...m,
                        text: 'Lo siento, ocurrió un problema de comunicación con el tutor. Por favor intenta de nuevo.',
                        source: 'error',
                        topic: 'Error',
                        streaming: false
                    } : m
                ));
            }
        } finally {
            setMessages(prev => {
                const finalMsgs = prev.map(m =>
                    m.id === tutorId ? { ...m, streaming: false } : m
                );
                if (currentConversationId) {
                    try {
                        localStorage.setItem(`amy_msgs_cache_${currentConversationId}`, JSON.stringify(finalMsgs));
                    } catch {}
                }
                return finalMsgs;
            });
            abortControllerRef.current = null;
            setIsLoading(false);
            window.dispatchEvent(new CustomEvent('amy_conv_updated'));
        }

    }, [isLoading, currentConversationId, selectedModel, stopGeneration]);

    const loadConversation = useCallback(async (id) => {
        if (!id) return;
        stopGeneration();
        setIsLoading(true);

        // 1. Cargar inmediatamente de caché local si existe para evitar pantallas vacías
        try {
            const cachedMsgs = localStorage.getItem(`amy_msgs_cache_${id}`);
            if (cachedMsgs) {
                const parsed = JSON.parse(cachedMsgs);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setMessages(parsed);
                }
            }
        } catch {}

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const data = await getMessages(id, controller.signal);
            const loaded = (data || []).map((msg, idx) => {
                const rawText = msg.text || msg.content || '';
                // Desenvolver si viene en formato JSON crudo
                let clean = rawText;
                if (rawText.trim().startsWith('{')) {
                    try {
                        const parsed = JSON.parse(rawText.trim());
                        clean = parsed?.assistant?.message?.text || parsed?.message?.text || parsed?.feedback || parsed?.text || rawText;
                    } catch {
                        const match = rawText.match(/"text"\s*:\s*"([\s\S]*?)"\s*\}\s*\}\s*\}?$/) ||
                                      rawText.match(/"feedback"\s*:\s*"([\s\S]*?)"/);
                        if (match && match[1]) {
                            clean = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                        }
                    }
                }

                let parsedAttachment = null;
                if (msg.attachment) {
                    try {
                        parsedAttachment = typeof msg.attachment === 'string' ? JSON.parse(msg.attachment) : msg.attachment;
                    } catch {}
                }

                return {
                    id: msg.id || `msg-${idx}-${Date.now()}`,
                    sender: msg.sender === 'user' ? 'user' : 'tutor',
                    text: clean,
                    attachment: parsedAttachment,
                    source: msg.source || 'loaded',
                    topic: msg.topic || '',
                    ragUsed: msg.rag_used || false,
                    ragLearned: msg.rag_learned || false,
                    liveExample: msg.live_example ? (typeof msg.live_example === 'string' ? JSON.parse(msg.live_example) : msg.live_example) : null,
                    hasExample: !!msg.live_example,
                    timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
                };
            });

            const allMsgs = [WELCOME_MESSAGE, ...loaded];
            setMessages(allMsgs);
            setCurrentConversationId(id);
            setLastExample(null);

            // Actualizar caché local
            try {
                localStorage.setItem(`amy_msgs_cache_${id}`, JSON.stringify(allMsgs));
            } catch {}
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error cargando conversacion:', error);
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
        loadConversation,
        selectedModel,
        setSelectedModel
    };
}

