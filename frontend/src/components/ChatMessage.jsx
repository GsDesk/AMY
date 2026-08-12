import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './ChatMessage.css';

// ── Componente: Toolbar de Código SQL ────────────────────────────────────────
function CodeToolbar({ code, language, onExplain }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback para navegadores sin soporte Clipboard API
            const el = document.createElement('textarea');
            el.value = code;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [code]);

    const handleExplain = useCallback(() => {
        if (onExplain) {
            onExplain(`Explica esta consulta SQL paso a paso:\n\`\`\`sql\n${code}\n\`\`\``);
        }
    }, [code, onExplain]);

    return (
        <div className="code-toolbar">
            <span className="code-lang-badge">{language?.toUpperCase() || 'CODE'}</span>
            <div className="code-toolbar-actions">
                <button
                    className={`code-btn ${copied ? 'code-btn--copied' : ''}`}
                    onClick={handleCopy}
                    title="Copiar código"
                    id={`copy-btn-${Math.random().toString(36).slice(2)}`}
                >
                    {copied ? '✓ Copiado' : '📋 Copiar'}
                </button>
                {(language === 'sql' || language === 'SQL') && onExplain && (
                    <button
                        className="code-btn code-btn--explain"
                        onClick={handleExplain}
                        title="Explicar esta consulta"
                    >
                        💡 Explicar
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Componente: Panel de Fuentes Glassmórfico ─────────────────────────────────
function SourcesPanel({ sources }) {
    const [open, setOpen] = useState(false);

    if (!sources || sources.length === 0) return null;

    const categoryColors = {
        'SQL': '#3b82f6',
        'Normalización': '#8b5cf6',
        'Modelo E-R': '#06b6d4',
        'Álgebra Relacional': '#f59e0b',
        'Diseño de BD': '#10b981',
        'Transacciones': '#ef4444',
        'Índices': '#f97316',
        'Fundamentos': '#6366f1',
    };

    return (
        <div className="sources-panel-wrapper">
            <button
                className="sources-toggle-btn"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
            >
                <span className="sources-icon">📚</span>
                <span>{open ? 'Ocultar fuentes' : `Ver fuentes (${sources.length})`}</span>
                <span className={`sources-chevron ${open ? 'sources-chevron--open' : ''}`}>›</span>
            </button>

            <div className={`sources-panel ${open ? 'sources-panel--open' : ''}`}>
                {sources.map((src, idx) => (
                    <div key={src.id || idx} className="source-card">
                        <div className="source-card-header">
                            <span
                                className="source-category-badge"
                                style={{ '--cat-color': categoryColors[src.categoria] || '#6b7280' }}
                            >
                                {src.categoria}
                            </span>
                            <span className="source-score">
                                {src.rrf_score > 0
                                    ? `RRF: ${src.rrf_score.toFixed(4)}`
                                    : `sim: ${(src.similarity * 100).toFixed(1)}%`}
                            </span>
                        </div>
                        <p className="source-excerpt">
                            {src.contenido?.slice(0, 220)}{src.contenido?.length > 220 ? '…' : ''}
                        </p>
                        {src.metadata?.fuente && (
                            <p className="source-ref">📖 {src.metadata.fuente}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Componente principal: ChatMessage ─────────────────────────────────────────
export default function ChatMessage({ message, onExplainCode }) {
    const isTutor = message.sender === 'tutor';
    const isError = message.source === 'error';

    return (
        <div className={`chat-message ${isTutor ? 'tutor-msg' : 'user-msg'} ${isError ? 'error-msg' : ''}`}>
            {isTutor && (
                <div className="msg-avatar tutor-avatar">
                    <span>A</span>
                </div>
            )}

            <div className="msg-content">
                <div className="msg-bubble">
                    {isTutor ? (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const language = match ? match[1] : null;
                                    const codeString = String(children).replace(/\n$/, '');

                                    return !inline && match ? (
                                        <div className="code-block-wrapper">
                                            <CodeToolbar
                                                code={codeString}
                                                language={language}
                                                onExplain={onExplainCode}
                                            />
                                            <SyntaxHighlighter
                                                style={vscDarkPlus}
                                                language={language}
                                                showLineNumbers={true}
                                                PreTag="div"
                                                customStyle={{
                                                    borderRadius: '0 0 8px 8px',
                                                    fontSize: '0.82rem',
                                                    margin: '0',
                                                    background: '#0d0d1a',
                                                    borderTop: 'none',
                                                }}
                                                {...props}
                                            >
                                                {codeString}
                                            </SyntaxHighlighter>
                                        </div>
                                    ) : (
                                        <code className="inline-code" {...props}>
                                            {children}
                                        </code>
                                    );
                                }
                            }}
                        >
                            {message.text}
                        </ReactMarkdown>
                    ) : (
                        <p>{message.text}</p>
                    )}
                </div>

                {isTutor && message.source && message.source !== 'system' && (
                    <div className="msg-meta">
                        <span className={`source-badge ${isError ? 'badge-error' : 'badge-default'}`}>
                            {isError ? 'Error' : message.source === 'groq-llama3' ? 'Groq/Llama3' : 'Mistral'}
                        </span>
                        {message.topic && message.topic !== 'Error' && (
                            <span className="topic-badge">{message.topic}</span>
                        )}
                        {message.ragUsed && (
                            <span className="rag-badge">RAG</span>
                        )}
                        {message.hasExample && (
                            <span className="example-badge">Panel Abierto</span>
                        )}
                    </div>
                )}

                {isTutor && message.modelSwitched && (
                    <div className="model-switch-alert">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                        <span>{message.switchReason || "Se conmutó automáticamente de modelo por límite de tokens."}</span>
                    </div>
                )}

                {/* Panel de fuentes RAG (glassmorphism) */}
                {isTutor && message.ragSources && message.ragSources.length > 0 && (
                    <SourcesPanel sources={message.ragSources} />
                )}
            </div>

            {!isTutor && (
                <div className="msg-avatar user-avatar">
                    <span>E</span>
                </div>
            )}
        </div>
    );
}


