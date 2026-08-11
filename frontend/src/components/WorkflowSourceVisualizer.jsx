import React from 'react';
import './WorkflowSourceVisualizer.css';

export default function WorkflowSourceVisualizer({ isLoading = false, sources = [] }) {
    const sourceCount = sources.length;
    const isDone = !isLoading && sourceCount > 0;

    if (!isLoading && sourceCount === 0) {
        return null;
    }

    const hasPdf = sources.some(s => s.metadata?.fuente?.toLowerCase().endsWith('.pdf') || s.categoria === 'SQL');
    const hasDoc = sources.some(s => s.metadata?.fuente?.toLowerCase().endsWith('.doc') || s.metadata?.fuente?.toLowerCase().endsWith('.docx') || s.categoria === 'Normalización' || s.categoria === 'Modelo E-R');
    const hasTxt = sources.some(s => s.metadata?.fuente?.toLowerCase().endsWith('.txt') || s.categoria === 'Álgebra Relacional' || s.categoria === 'Diseño de BD' || s.categoria === 'Fundamentos') || (!hasPdf && !hasDoc);

    return (
        <div className="header-workflow-visualizer">
            {/* Estado Superior Minimalista (Sin Emojis) */}
            <div className="hwv-status-line">
                <span className={`hwv-dot ${isLoading ? 'loading' : 'done'}`} />
                <span className="hwv-status-text">
                    {isLoading ? 'Consultando documentos RAG...' : 'Consulta a documentos completada'}
                </span>
                {isDone && <span className="hwv-pct">100%</span>}
            </div>

            {/* Grafo de Nodos SVG — Normalización con pathLength="100" */}
            <div className="hwv-graph-wrap">
                <svg className="hwv-svg" viewBox="0 0 380 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <filter id="hwv-glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>

                    {/* Trazos Base Neutros */}
                    <path d="M 95 45 L 160 45" className="hwv-path-base" />
                    <path d="M 192 45 C 230 45, 230 20, 275 20" className="hwv-path-base" />
                    <path d="M 192 45 L 275 45" className="hwv-path-base" />
                    <path d="M 192 45 C 230 45, 230 70, 275 70" className="hwv-path-base" />

                    {/* Trazos Láser Animados con pathLength="100" */}
                    {isLoading && (
                        <g className="hwv-lasers-container">
                            {/* TRAMO 1: Desde el borde de FUENTE (x: 95) hasta el borde de la BDD (x: 160) */}
                            <path
                                d="M 95 45 L 160 45"
                                pathLength="100"
                                className="hwv-laser hwv-p1"
                                filter="url(#hwv-glow)"
                            />

                            {/* TRAMO 2A: Desde la BDD (x: 192) hacia PDF */}
                            <path
                                d="M 192 45 C 230 45, 230 20, 275 20"
                                pathLength="100"
                                className="hwv-laser hwv-p2 hwv-p2-pdf"
                                filter="url(#hwv-glow)"
                            />

                            {/* TRAMO 2B: Desde la BDD (x: 192) hacia DOC */}
                            <path
                                d="M 192 45 L 275 45"
                                pathLength="100"
                                className="hwv-laser hwv-p2 hwv-p2-doc"
                                filter="url(#hwv-glow)"
                            />

                            {/* TRAMO 2C: Desde la BDD (x: 192) hacia TXT */}
                            <path
                                d="M 192 45 C 230 45, 230 70, 275 70"
                                pathLength="100"
                                className="hwv-laser hwv-p2 hwv-p2-txt"
                                filter="url(#hwv-glow)"
                            />
                        </g>
                    )}

                    {/* Nodo 1: FUENTE */}
                    <g>
                        <rect x="10" y="24" width="85" height="42" rx="8" fill="#141414" stroke="#2a2a2a" strokeWidth="1.2" />
                        <text x="22" y="44" fill="#ffffff" fontSize="10" fontWeight="800" fontFamily="Outfit, sans-serif" letterSpacing="0.8">FUENTE</text>
                        <text x="22" y="56" fill="#38bdf8" fontSize="8" fontFamily="JetBrains Mono, monospace">Consulta RAG</text>
                    </g>

                    {/* Nodo Central: Ícono de Base de Datos (Cilindro BDD) */}
                    <g transform="translate(160, 27)">
                        <rect x="0" y="0" width="32" height="36" rx="6" fill="#080812" stroke={isLoading ? '#38bdf8' : 'rgba(56, 189, 248, 0.4)'} strokeWidth="1.2" filter="url(#hwv-glow)" />
                        <path d="M 8 11 C 8 7, 24 7, 24 11 C 24 15, 8 15, 8 11 Z" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                        <path d="M 8 11 L 8 25 C 8 29, 24 29, 24 25 L 24 11" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                        <path d="M 8 18 C 8 22, 24 22, 24 18" fill="none" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="2 2" />
                    </g>

                    {/* Nodo 3a: PDF Card (Rojo Original #FF2A55) */}
                    <g opacity={isLoading || hasPdf ? 1 : 0.35}>
                        <rect x="275" y="8" width="85" height="24" rx="6" fill="#141414" stroke={hasPdf ? '#FF2A55' : '#2a2a2a'} strokeWidth="1" />
                        <line x1="284" y1="20" x2="320" y2="20" stroke="#404040" strokeWidth="1.5" strokeLinecap="round" />
                        <rect x="332" y="12" width="22" height="14" rx="3" fill="#FF2A55" />
                        <text x="336" y="22" fill="#ffffff" fontSize="7" fontWeight="800" fontFamily="JetBrains Mono, monospace">PDF</text>
                    </g>

                    {/* Nodo 3b: DOC Card (Azul Original #2A85FF) */}
                    <g opacity={isLoading || hasDoc ? 1 : 0.35}>
                        <rect x="275" y="33" width="85" height="24" rx="6" fill="#141414" stroke={hasDoc ? '#2A85FF' : '#2a2a2a'} strokeWidth="1" />
                        <line x1="284" y1="45" x2="320" y2="45" stroke="#404040" strokeWidth="1.5" strokeLinecap="round" />
                        <rect x="332" y="37" width="22" height="14" rx="3" fill="#2A85FF" />
                        <text x="335" y="47" fill="#ffffff" fontSize="7" fontWeight="800" fontFamily="JetBrains Mono, monospace">DOC</text>
                    </g>

                    {/* Nodo 3c: TXT Card (Naranja Original #FF7000) */}
                    <g opacity={isLoading || hasTxt ? 1 : 0.35}>
                        <rect x="275" y="58" width="85" height="24" rx="6" fill="#141414" stroke={hasTxt ? '#FF7000' : '#2a2a2a'} strokeWidth="1" />
                        <line x1="284" y1="70" x2="320" y2="70" stroke="#404040" strokeWidth="1.5" strokeLinecap="round" />
                        <rect x="332" y="62" width="22" height="14" rx="3" fill="#FF7000" />
                        <text x="336" y="72" fill="#ffffff" fontSize="7" fontWeight="800" fontFamily="JetBrains Mono, monospace">TXT</text>
                    </g>
                </svg>
            </div>
        </div>
    );
}
