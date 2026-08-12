import { useState, useRef } from 'react';
import './ChatInput.css';

const MODEL_OPTIONS = [
    {
        key: 'auto',
        label: 'Automatico (Recomendado)',
        badge: 'Auto',
        desc: 'Usa Groq ultrarapido y cambia a Ollama local si se agotan los tokens'
    },
    {
        key: 'groq',
        label: 'Groq Llama 3.3 70B (Nube)',
        badge: 'Groq',
        desc: 'Respuestas rapidas procesadas en la nube'
    },
    {
        key: 'ollama',
        label: 'Ollama Mistral 7B (Local)',
        badge: 'Local',
        desc: 'Inferencia local sin depender de cuotas externas'
    }
];

export default function ChatInput({ onSend, disabled, selectedModel = 'auto', onModelChange }) {
    const [text, setText] = useState('');
    const [showModelMenu, setShowModelMenu] = useState(false);
    const textareaRef = useRef(null);

    const handleSend = () => {
        if (text.trim() && !disabled) {
            onSend(text);
            setText('');
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

    const currentOption = MODEL_OPTIONS.find(o => o.key === selectedModel) || MODEL_OPTIONS[0];

    return (
        <div className="chat-input-area">
            <div className={`input-wrapper ${disabled ? 'input-disabled' : ''}`}>
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Pregunta sobre SQL, normalizacion, diagramas E-R..."
                    rows={1}
                    disabled={disabled}
                    id="chat-input"
                />

                <div className="input-controls">
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
                                <div className="menu-header">Motor de IA / Limite de Tokens</div>
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
                        disabled={disabled || !text.trim()}
                        title="Enviar mensaje"
                        id="send-button"
                    >
                        {disabled ? (
                            <span className="loading-spinner"></span>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 2L11 13" />
                                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
