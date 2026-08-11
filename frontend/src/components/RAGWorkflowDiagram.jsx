import React from 'react';
import './RAGWorkflowDiagram.css';

export default function RAGWorkflowDiagram({ stage = 'searching', progress = 50 }) {
    const isDone = stage === 'done';

    const stageLabels = {
        'searching': '🔍 Consultando documentos RAG...',
        'guardrails': '🛡️ Verificando guardrails...',
        'synthesizing': '⚡ Sintetizando respuesta...',
        'done': '✓ Consulta a documentos completada'
    };

    return (
        <div className="rag-workflow-container">
            {/* Header del Flujo de Trabajo */}
            <div className="rag-workflow-header">
                <div className="rag-workflow-status-label">
                    <span className={`rag-pulse-dot ${isDone ? 'done' : ''}`} />
                    <span>{stageLabels[stage] || '🔍 Procesando consulta...'}</span>
                </div>
                <span className="rag-workflow-pct">{progress}%</span>
            </div>

            {/* Canvas del Diagrama de Flujo RAG */}
            <div className="rag-workflow-svg-wrap">
                <svg
                    className="rag-workflow-svg"
                    viewBox="0 0 420 200"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        {/* Gradientes para los rayos láser según tipo de documento */}
                        <linearGradient id="grad-pdf" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#38bdf8" />
                            <stop offset="100%" stopColor="#ff2a6d" />
                        </linearGradient>

                        <linearGradient id="grad-doc" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#38bdf8" />
                            <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>

                        <linearGradient id="grad-txt" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#ff7000" />
                        </linearGradient>

                        {/* Sombra de Resplandor Neón */}
                        <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>

                    {/* ── Trazos Base ────────────────────────────────────────────── */}
                    <path d="M 125 100 L 178 100" className="path-base" />
                    <path d="M 222 100 C 260 100, 260 42, 300 42" className="path-base" />
                    <path d="M 222 100 L 300 100" className="path-base" />
                    <path d="M 222 100 C 260 100, 260 158, 300 158" className="path-base" />

                    {/* ── Trazos Láser Animados (Flujo de Consulta RAG) ──────────── */}
                    {!isDone && (
                        <>
                            <path d="M 125 100 L 178 100" className="path-pulse path-pulse-doc" filter="url(#glow-filter)" />
                            <path d="M 222 100 C 260 100, 260 42, 300 42" className="path-pulse path-pulse-pdf" filter="url(#glow-filter)" />
                            <path d="M 222 100 L 300 100" className="path-pulse path-pulse-doc" filter="url(#glow-filter)" />
                            <path d="M 222 100 C 260 100, 260 158, 300 158" className="path-pulse path-pulse-txt" filter="url(#glow-filter)" />
                        </>
                    )}

                    {/* ── Nodo Izquierdo: FUENTE ─────────────────────────────────── */}
                    <g className="node-card node-card-active">
                        <rect x="15" y="60" width="110" height="80" rx="14" fill="#0f0f1c" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5" />
                        <text x="32" y="88" fill="#ffffff" fontSize="13" fontWeight="800" fontFamily="Outfit, sans-serif" letterSpacing="1">FUENTE</text>
                        {/* Líneas skeleton */}
                        <rect x="32" y="98" width="76" height="4" rx="2" fill="rgba(255, 255, 255, 0.15)" />
                        <rect x="32" y="108" width="52" height="4" rx="2" fill="rgba(255, 255, 255, 0.1)" />
                    </g>

                    {/* ── Nodo Central: Conector RAG ─────────────────────────────── */}
                    <g>
                        <circle cx="200" cy="100" r="22" fill="#0c0c18" stroke="rgba(56, 189, 248, 0.5)" strokeWidth="1.5" filter="url(#glow-filter)" />
                        {/* Ícono doble bucle en gradiente */}
                        <path
                            d="M 193 100 C 193 94, 200 94, 200 100 C 200 106, 207 106, 207 100 C 207 94, 200 94, 200 100 C 200 106, 193 106, 193 100"
                            stroke="#38bdf8"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            fill="none"
                            className="center-node-spinner"
                        />
                    </g>

                    {/* ── Nodo Derecho 1: PDF Document ──────────────────────────── */}
                    <g className={`node-card ${!isDone ? 'node-card-active' : ''}`}>
                        <rect x="300" y="18" width="105" height="48" rx="10" fill="#0f0f1e" stroke="rgba(255, 42, 109, 0.35)" strokeWidth="1.2" />
                        {/* Líneas de texto skeleton */}
                        <line x1="312" y1="28" x2="360" y2="28" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" strokeLinecap="round" />
                        <line x1="312" y1="35" x2="350" y2="35" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2" strokeLinecap="round" />
                        <line x1="312" y1="42" x2="340" y2="42" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2" strokeLinecap="round" />
                        {/* Badge PDF */}
                        <rect x="368" y="32" width="30" height="18" rx="4" fill="#ff2a6d" />
                        <text x="373" y="44" fill="#ffffff" fontSize="9" fontWeight="800" fontFamily="JetBrains Mono, monospace">PDF</text>
                    </g>

                    {/* ── Nodo Derecho 2: DOC Document ──────────────────────────── */}
                    <g className={`node-card ${!isDone ? 'node-card-active' : ''}`}>
                        <rect x="300" y="76" width="105" height="48" rx="10" fill="#0f0f1e" stroke="rgba(59, 130, 246, 0.35)" strokeWidth="1.2" />
                        {/* Líneas de texto skeleton */}
                        <line x1="312" y1="86" x2="360" y2="86" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" strokeLinecap="round" />
                        <line x1="312" y1="93" x2="350" y2="93" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2" strokeLinecap="round" />
                        <line x1="312" y1="100" x2="340" y2="100" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2" strokeLinecap="round" />
                        {/* Badge DOC */}
                        <rect x="368" y="90" width="30" height="18" rx="4" fill="#3b82f6" />
                        <text x="372" y="102" fill="#ffffff" fontSize="9" fontWeight="800" fontFamily="JetBrains Mono, monospace">DOC</text>
                    </g>

                    {/* ── Nodo Derecho 3: TXT Document ──────────────────────────── */}
                    <g className={`node-card ${!isDone ? 'node-card-active' : ''}`}>
                        <rect x="300" y="134" width="105" height="48" rx="10" fill="#0f0f1e" stroke="rgba(255, 112, 0, 0.35)" strokeWidth="1.2" />
                        {/* Líneas de texto skeleton */}
                        <line x1="312" y1="144" x2="360" y2="144" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" strokeLinecap="round" />
                        <line x1="312" y1="151" x2="350" y2="151" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2" strokeLinecap="round" />
                        <line x1="312" y1="158" x2="340" y2="158" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2" strokeLinecap="round" />
                        {/* Badge TXT */}
                        <rect x="368" y="148" width="30" height="18" rx="4" fill="#ff7000" />
                        <text x="373" y="160" fill="#ffffff" fontSize="9" fontWeight="800" fontFamily="JetBrains Mono, monospace">TXT</text>
                    </g>
                </svg>
            </div>
        </div>
    );
}
