import './WorkflowSourceVisualizer.css';

// Flujo RAG del encabezado con el lenguaje visual de la landing (KnowledgeAnimation):
// la consulta viaja del chat a la base de datos y de ahí a los documentos fuente.
const CORE = { x: 182, y: 42 };
const QUERY_EDGE = 82;
const DOC_X = 262;

const DOCS = [
    { key: 'pdf', label: 'PDF', y: 16 },
    { key: 'doc', label: 'DOC', y: 42 },
    { key: 'txt', label: 'TXT', y: 68 },
];

const STARS = Array.from({ length: 12 }, (_, i) => {
    const angle = i * Math.PI * 2 / 12 + 0.3;
    return { x: CORE.x + Math.cos(angle) * (44 + (i % 3) * 7), y: CORE.y + Math.sin(angle) * (30 + (i % 2) * 6), r: i % 3 ? 0.9 : 1.5 };
});

const inPath = `M${QUERY_EDGE} ${CORE.y} Q${(QUERY_EDGE + CORE.x) / 2} ${CORE.y - 14} ${CORE.x - 17} ${CORE.y}`;
const outPath = (y) => `M${CORE.x + 17} ${CORE.y} C${CORE.x + 48} ${CORE.y}, ${CORE.x + 40} ${y}, ${DOC_X} ${y}`;

function matchSources(sources) {
    const src = (s) => (s.metadata?.fuente || '').toLowerCase();
    const hasPdf = sources.some(s => src(s).endsWith('.pdf') || s.categoria === 'SQL');
    const hasDoc = sources.some(s => src(s).endsWith('.doc') || src(s).endsWith('.docx') || s.categoria === 'Normalización' || s.categoria === 'Modelo E-R');
    const hasTxt = sources.some(s => src(s).endsWith('.txt') || ['Álgebra Relacional', 'Diseño de BD', 'Fundamentos', 'Administración de BD'].includes(s.categoria)) || (!hasPdf && !hasDoc);
    return { pdf: hasPdf, doc: hasDoc, txt: hasTxt };
}

export default function WorkflowSourceVisualizer({ isLoading = false, sources = [] }) {
    const sourceCount = sources.length;
    if (!isLoading && sourceCount === 0) return null;

    const matched = matchSources(sources);
    const state = isLoading ? 'loading' : 'done';

    return (
        <div className="header-workflow-visualizer" data-state={state} role="status"
             aria-label={isLoading ? 'Consultando documentos de la base de conocimiento' : `Consulta completada con ${sourceCount} fragmentos`}>
            <div className="hwv-status-line">
                <span className="hwv-dot" />
                <span className="hwv-status-text">
                    {isLoading ? 'Consultando documentos RAG…' : 'Consulta completada'}
                </span>
                {!isLoading && <span className="hwv-pct">{sourceCount} {sourceCount === 1 ? 'fragmento' : 'fragmentos'}</span>}
            </div>

            <svg className="hwv-svg" viewBox="0 0 360 84" fill="none" aria-hidden="true">
                <defs>
                    <radialGradient id="hwv-halo">
                        <stop stopColor="var(--hwv-cyan)" stopOpacity="var(--hwv-halo-opacity)" />
                        <stop offset="1" stopColor="var(--hwv-cyan)" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="hwv-thread" x2="1" y2="1">
                        <stop stopColor="var(--hwv-cyan)" />
                        <stop offset="1" stopColor="var(--hwv-violet)" />
                    </linearGradient>
                </defs>

                <circle cx={CORE.x} cy={CORE.y} r="46" fill="url(#hwv-halo)" className="hwv-halo" />
                <g className="hwv-orbit">
                    <ellipse cx={CORE.x} cy={CORE.y} rx="34" ry="22" transform={`rotate(-20 ${CORE.x} ${CORE.y})`} />
                    <ellipse cx={CORE.x} cy={CORE.y} rx="30" ry="26" transform={`rotate(30 ${CORE.x} ${CORE.y})`} />
                </g>
                {STARS.map((s, i) => (
                    <circle key={i} className="hwv-star" style={{ animationDelay: `${i * -0.35}s` }} cx={s.x} cy={s.y} r={s.r} fill="currentColor" />
                ))}

                {/* Chat -> base de datos */}
                <path d={inPath} className="hwv-thread" stroke="url(#hwv-thread)" />
                <path d={inPath} className="hwv-signal" pathLength="100" stroke="url(#hwv-thread)" />

                {/* Base de datos -> documentos fuente */}
                {DOCS.map((d, i) => (
                    <g key={d.key} className={`hwv-branch ${matched[d.key] ? 'is-match' : ''}`}>
                        <path d={outPath(d.y)} className="hwv-thread" stroke="url(#hwv-thread)" />
                        <path d={outPath(d.y)} className="hwv-signal" pathLength="100" stroke="url(#hwv-thread)"
                              style={{ animationDelay: `${0.45 + i * 0.3}s` }} />
                    </g>
                ))}

                {/* Nodo: pregunta del estudiante */}
                <g className="hwv-node hwv-query">
                    <rect x="6" y="27" width={QUERY_EDGE - 6} height="30" rx="8" />
                    <text x="16" y="40" className="hwv-node-title">Pregunta</text>
                    <text x="16" y="50" className="hwv-node-sub">por similitud</text>
                    <circle cx={QUERY_EDGE} cy={CORE.y} r="2.5" className="hwv-port" />
                </g>

                {/* Núcleo: base de datos vectorial */}
                <g className="hwv-core">
                    <rect x={CORE.x - 17} y={CORE.y - 17} width="34" height="34" rx="11" className="hwv-core-box" />
                    <g transform={`translate(${CORE.x - 8} ${CORE.y - 9})`} className="hwv-core-icon">
                        <ellipse cx="8" cy="3" rx="8" ry="3" />
                        <path d="M0 3v12c0 1.7 3.6 3 8 3s8-1.3 8-3V3" />
                        <path d="M0 9c0 1.7 3.6 3 8 3s8-1.3 8-3" />
                    </g>
                </g>

                {/* Documentos recuperados */}
                {DOCS.map(d => (
                    <g key={d.key} className={`hwv-node hwv-doc hwv-doc-${d.key} ${matched[d.key] ? 'is-match' : ''}`}>
                        <circle cx={DOC_X} cy={d.y} r="2.5" className="hwv-port" />
                        <rect x={DOC_X + 4} y={d.y - 10} width="88" height="20" rx="6" />
                        <rect x={DOC_X + 11} y={d.y - 4} width="8" height="8" rx="2" className="hwv-doc-swatch" />
                        <text x={DOC_X + 25} y={d.y + 3.5} className="hwv-node-title">{d.label}</text>
                        <line x1={DOC_X + 48} y1={d.y} x2={DOC_X + 84} y2={d.y} className="hwv-doc-line" />
                    </g>
                ))}
            </svg>
        </div>
    );
}
