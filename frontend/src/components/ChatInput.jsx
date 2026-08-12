import { useState, useRef } from 'react';
import './ChatInput.css';

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

    const getModelBadgeText = () => {
        if (selectedModel === 'groq') return '⚡ Groq 70B';
        if (selectedModel === 'ollama') return '🛡️ Ollama Local';
        return '🔄 Auto (Tokens)';
    };

    return (
        <div className="chat-input-area">
            <div className={`input-wrapper ${disabled ? 'input-disabled' : ''}`}>
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Pregunta sobre SQL, normalización, diagramas E-R..."
                    rows={1}
                    disabled={disabled}
                    id="chat-input"
                />

                <div className="input-controls">
                    {/* Botón selector de modelo / Conmutador por Tokens */}
                    <div className="model-selector-wrapper">
                        <button
                            type="button"
                            className="model-toggle-btn"
                            onClick={() => setShowModelMenu(!showModelMenu)}
                            title="Cambiar motor de IA o conmutación por límite de tokens"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 6v6l4 2"/>
                            </svg>
                            <span>{getModelBadgeText()}</span>
                        </button>

                        {showModelMenu && (
                            <div className="model-dropdown-menu">
                                <div className="menu-header">Motor de IA / Límite de Tokens</div>
                                <button
                                    type="button"
                                    className={`menu-item ${selectedModel === 'auto' ? 'active' : ''}`}
                                    onClick={() => { onModelChange?.('auto'); setShowModelMenu(false); }}
                                >
                                    <span className="item-title">🔄 Modo Automático (Recomendado)</span>
                                    <span className="item-desc">Prueba Groq ultrarrápido y cambia solo a Ollama local si se agotan los tokens</span>
                                </button>
                                <button
                                    type="button"
                                    className={`menu-item ${selectedModel === 'groq' ? 'active' : ''}`}
                                    onClick={() => { onModelChange?.('groq'); setShowModelMenu(false); }}
                                >
                                    <span className="item-title">⚡ Groq Llama 3.3 70B (Ultrarrápido - Nube)</span>
                                    <span className="item-desc">Respuestas en 0.8s en la nube</span>
                                </button>
                                <button
                                    type="button"
                                    className={`menu-item ${selectedModel === 'ollama' ? 'active' : ''}`}
                                    onClick={() => { onModelChange?.('ollama'); setShowModelMenu(false); }}
                                >
                                    <span className="item-title">🛡️ Ollama Mistral 7B (Local CPU)</span>
                                    <span className="item-desc">Sin depender de límites de cuota externa</span>
                                </button>
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
