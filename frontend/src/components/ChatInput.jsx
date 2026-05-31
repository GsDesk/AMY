import { useState, useRef } from 'react';
import './ChatInput.css';

export default function ChatInput({ onSend, disabled }) {
    const [text, setText] = useState('');
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
        // Auto-resize textarea
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
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
    );
}
