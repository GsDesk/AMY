import { useState, useRef, useCallback, useEffect } from 'react';
import useSpeechInput from '../hooks/useSpeechInput';
import './ChatInput.css';

const MODEL_OPTIONS = [
    {
        key: 'auto',
        label: 'Automatico (Recomendado)',
        badge: 'Auto',
        desc: 'Usa Gemini ultrarapido, luego Groq, luego Ollama local si es necesario'
    },
    {
        key: 'gemini',
        label: 'Google Gemini 2.5 Flash (Nube)',
        badge: 'Gemini',
        desc: 'Motor ultrarapido de Google con streaming en tiempo real y soporte multimodal.'
    },
    {
        key: 'groq',
        label: 'Groq Llama 3.3 70B (Nube)',
        badge: 'Groq',
        desc: 'Respuestas rapidas procesadas en la nube Groq'
    },
    {
        key: 'ollama',
        label: 'Ollama Mistral 7B (Local)',
        badge: 'Local',
        desc: 'Inferencia local sin depender de cuotas externas'
    }
];

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);
    });
}

export default function ChatInput({ onSend, disabled, selectedModel = 'auto', onModelChange }) {
    const [text, setText] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [showModelMenu, setShowModelMenu] = useState(false);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const micRef = useRef(null);

    const autoResize = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 150) + 'px';
    }, []);

    // Dictado: el texto aparece en el cuadro mientras el usuario habla
    const speech = useSpeechInput({
        onText: (value) => {
            setText(value);
            requestAnimationFrame(() => {
                autoResize();
                const el = textareaRef.current;
                if (el) el.scrollTop = el.scrollHeight;
            });
        },
        levelTargetRef: micRef,
    });

    // El aviso de error del micrófono desaparece solo
    useEffect(() => {
        if (!speech.error) return undefined;
        const t = setTimeout(speech.clearError, 5000);
        return () => clearTimeout(t);
    }, [speech.error, speech.clearError]);

    const processFile = useCallback(async (file) => {
        if (!file) return;
        // Limitar tamaño a 20MB
        if (file.size > 20 * 1024 * 1024) {
            alert('El archivo supera el límite de 20MB.');
            return;
        }

        try {
            const base64Data = await fileToBase64(file);
            const isImage = file.type.startsWith('image/');
            setAttachment({
                file,
                filename: file.name,
                mimeType: file.type || (file.name.endsWith('.sql') ? 'text/plain' : 'application/octet-stream'),
                base64Data,
                sizeBytes: file.size,
                isImage,
                previewUrl: isImage ? base64Data : null
            });
        } catch (err) {
            console.error('Error al leer el archivo:', err);
        }
    }, []);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
        e.target.value = '';
    };

    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file') {
                    const file = items[i].getAsFile();
                    if (file) {
                        processFile(file);
                        break;
                    }
                }
            }
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleSend = () => {
        if ((text.trim() || attachment) && !disabled) {
            if (speech.listening) speech.stop(true);
            onSend(text, attachment);
            setText('');
            setAttachment(null);
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInput = (e) => {
        setText(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
    };

    const removeAttachment = () => {
        setAttachment(null);
    };

    const currentOption = MODEL_OPTIONS.find(o => o.key === selectedModel) || MODEL_OPTIONS[0];

    return (
        <div className="chat-input-area">
            <div
                className={`input-wrapper ${disabled ? 'input-disabled' : ''} ${isDragging ? 'input-dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Previsualización del archivo adjunto */}
                {attachment && (
                    <div className="attachment-preview-chip">
                        <div className="attachment-preview-thumb">
                            {attachment.isImage ? (
                                <img src={attachment.previewUrl} alt={attachment.filename} className="preview-img-mini" />
                            ) : (
                                <div className="preview-doc-badge">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                    </svg>
                                    <span>{attachment.filename.split('.').pop()?.toUpperCase() || 'DOC'}</span>
                                </div>
                            )}
                        </div>
                        <div className="attachment-info-group">
                            <span className="attachment-name" title={attachment.filename}>{attachment.filename}</span>
                            <span className="attachment-size">{formatBytes(attachment.sizeBytes)}</span>
                        </div>
                        <button
                            type="button"
                            className="attachment-remove-btn"
                            onClick={removeAttachment}
                            title="Quitar archivo"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                )}

                {/* Input de archivo oculto */}
                <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    accept="image/png,image/jpeg,image/webp,image/jpg,application/pdf,text/plain,text/csv,.sql,.md,.doc,.docx"
                />

                <div className="input-row-main">
                    {/* Botón de adjuntar */}
                    <button
                        type="button"
                        className="attach-clip-btn"
                        onClick={() => fileInputRef.current?.click()}
                        title="Adjuntar imagen, captura o documento (PDF, SQL, TXT, DOCX)"
                        disabled={disabled}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                    </button>

                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder={attachment ? "Añade una indicación o pregunta sobre el archivo (o presiona Enter)..." : "Pregunta sobre SQL, normalización, diagramas E-R, o adjunta un archivo..."}
                        rows={1}
                        disabled={disabled}
                        id="chat-input"
                    />

                    <div className="input-controls">
                        {speech.supported && (
                            <div className="mic-wrapper">
                                <button
                                    ref={micRef}
                                    type="button"
                                    className={`mic-btn ${speech.listening ? 'is-listening' : ''} ${speech.transcribing ? 'is-transcribing' : ''}`}
                                    onClick={() => speech.toggle(text)}
                                    disabled={disabled}
                                    title={speech.listening ? 'Detener dictado' : 'Dictar por voz'}
                                    aria-label={speech.listening ? 'Detener dictado por voz' : 'Dictar mensaje por voz'}
                                    aria-pressed={speech.listening}
                                >
                                    {/* Ondas de agua que se expanden con el volumen de la voz */}
                                    <span className="mic-ripple" aria-hidden="true"></span>
                                    <span className="mic-ripple" aria-hidden="true"></span>
                                    <span className="mic-ripple" aria-hidden="true"></span>
                                    <svg className="mic-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <rect x="9" y="2" width="6" height="12" rx="3"/>
                                        <path d="M5 10v1a7 7 0 0 0 14 0v-1"/>
                                        <line x1="12" y1="18" x2="12" y2="22"/>
                                    </svg>
                                </button>
                                {speech.error && <div className="mic-error" role="alert">{speech.error}</div>}
                                {(speech.listening || speech.transcribing) && <span className="mic-status" aria-live="polite">{speech.listening ? 'Escuchando…' : 'Transcribiendo…'}</span>}
                            </div>
                        )}
                        <div className="model-selector-wrapper">
                            <button
                                type="button"
                                className="model-toggle-btn"
                                onClick={() => setShowModelMenu(!showModelMenu)}
                                title="Cambiar motor de IA"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="3"/>
                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                                </svg>
                                <span>{currentOption.badge}</span>
                            </button>

                            {showModelMenu && (
                                <div className="model-dropdown-menu">
                                    <div className="menu-header">Motor de IA / Límite de Tokens</div>
                                    {MODEL_OPTIONS.map(opt => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            className={`menu-item ${selectedModel === opt.key ? 'active' : ''}`}
                                            onClick={() => { onModelChange?.(opt.key); setShowModelMenu(false); }}
                                        >
                                            <span className="item-title">{opt.label}</span>
                                            <span className="item-desc">{opt.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            className="send-btn"
                            onClick={handleSend}
                            disabled={disabled || (!text.trim() && !attachment)}
                            title="Enviar mensaje"
                            id="send-button"
                        >
                            {disabled ? (
                                <span className="loading-spinner"></span>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 2L11 13" />
                                    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
