import { useEffect, useState, useRef, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './LiveExamplePanel.css';

/* ── Helpers ─────────────────────────────────────────── */

/**
 * Normaliza cualquier formato de ejemplo (nuevo diagrama E-R dinámico
 * o formato estático legado) a la forma interna del panel.
 */
function normalizeExample(example) {
    if (!example) return null;

    // Formato nuevo: diagrama E-R dinámico generado por el LLM
    if (example.type === 'er_diagram') {
        return {
            _isErDiagram: true,
            title: example.title || 'Diagrama Entidad-Relacion',
            description: example.description || '',
            cardinality: example.cardinality || '',
            mermaid_code: example.mermaid_code || '',
            tables: (example.tables || []).map(t => ({
                name: t.name,
                columns: (t.columns || []).map(c => ({
                    name: c.name,
                    type: c.type || '',
                    constraint: c.isPk ? 'PK' : c.isFk ? 'FK' : null,
                    references: c.references || null
                }))
            })),
            relationships: [],
            sql: null
        };
    }

    // Formato legado estático
    return {
        _isErDiagram: false,
        title: example.title || 'Ejemplo Interactivo',
        description: example.description || '',
        cardinality: '',
        mermaid_code: '',
        tables: example.tables || [],
        relationships: example.relationships || [],
        sql: example.sql || null
    };
}

/* ── Mermaid Renderer ─────────────────────────────────── */
function MermaidDiagram({ code }) {
    const ref = useRef(null);
    const [error, setError] = useState(null);
    const [svg, setSvg] = useState(null);

    useEffect(() => {
        if (!code || !ref.current) return;
        setError(null);
        setSvg(null);

        import('mermaid').then(({ default: mermaid }) => {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                themeVariables: {
                    background: '#0d0d10',
                    primaryColor: '#18181b',
                    primaryTextColor: '#f4f4f5',
                    primaryBorderColor: '#3f3f46',
                    lineColor: '#52525b',
                    secondaryColor: '#27272a',
                    tertiaryColor: '#1c1c1f',
                    fontFamily: 'JetBrains Mono, monospace'
                }
            });
            const id = `mermaid-er-${Date.now()}`;
            mermaid.render(id, code).then(({ svg: rendered }) => {
                setSvg(rendered);
            }).catch(err => {
                setError('No se pudo renderizar el diagrama: ' + err.message);
            });
        }).catch(() => {
            setError('La libreria mermaid no esta disponible.');
        });
    }, [code]);

    if (error) return <div className="mermaid-error">{error}</div>;
    if (!svg) return <div className="mermaid-loading">Renderizando diagrama...</div>;
    return (
        <div
            ref={ref}
            className="mermaid-output"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}

/* ── Table Cards (vista alternativa) ─────────────────── */
function TableCard({ table, pos, onMouseDown, step, idx, dragging }) {
    const isVisible = step > idx;
    const isDragging = dragging === table.name;
    return (
        <div
            className={`table-card draggable${isVisible ? ' visible' : ''}${isDragging ? ' is-dragging' : ''}`}
            style={{ left: pos.x, top: pos.y, position: 'absolute', zIndex: 2, width: '230px' }}
            onMouseDown={(e) => onMouseDown(e, table.name)}
        >
            <div className="table-name">
                <span className="drag-handle">&#8286;</span>
                {table.name}
            </div>
            <div className="table-columns">
                {table.columns.map(col => (
                    <div key={col.name} className={`table-col${col.constraint ? ' has-constraint' : ''}`}>
                        <span className="col-name">{col.name}</span>
                        <span className="col-type">{col.type}</span>
                        {col.constraint && (
                            <span className={`col-constraint constraint-${col.constraint.split('/')[0].toLowerCase()}`}>
                                {col.constraint}
                            </span>
                        )}
                        {col.references && (
                            <span className="col-ref" title={col.references}>→ {col.references}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Main Panel ───────────────────────────────────────── */
export default function LiveExamplePanel({ example, onClose }) {
    const normalized = normalizeExample(example);
    const [step, setStep] = useState(0);
    const [copied, setCopied] = useState(false);
    const [positions, setPositions] = useState({});
    const [dragging, setDragging] = useState(null);
    // For ER diagrams default to 'mermaid', for legacy default to 'diagram'
    const [activeTab, setActiveTab] = useState(normalized?._isErDiagram ? 'mermaid' : 'diagram');
    const [panelWidth, setPanelWidth] = useState(750);
    const [zoom, setZoom] = useState(0.85);
    const dragOffset = useRef({});
    const isResizing = useRef(false);
    const panelRef = useRef();

    useEffect(() => {
        if (!normalized) return;
        setStep(0);
        setActiveTab(normalized._isErDiagram ? 'mermaid' : 'diagram');
        setZoom(0.85);
        const totalSteps = (normalized.tables?.length || 0) + 2;
        let current = 0;
        const timer = setInterval(() => {
            current++;
            setStep(current);
            if (current >= totalSteps) clearInterval(timer);
        }, 400);
        const cols = Math.min((normalized.tables?.length || 1), 3);
        const initialPositions = {};
        (normalized.tables || []).forEach((table, idx) => {
            initialPositions[table.name] = {
                x: (idx % cols) * 270 + 20,
                y: Math.floor(idx / cols) * 200 + 20
            };
        });
        setPositions(initialPositions);
        return () => clearInterval(timer);
    }, [example]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleMouseDown = useCallback((e, tableName) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = positions[tableName] || { x: 0, y: 0 };
        dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        setDragging(tableName);
    }, [positions]);

    useEffect(() => {
        if (!dragging) return;
        const handleMove = (e) => {
            setPositions(prev => ({
                ...prev,
                [dragging]: {
                    x: Math.max(0, e.clientX - dragOffset.current.x),
                    y: Math.max(0, e.clientY - dragOffset.current.y)
                }
            }));
        };
        const handleUp = () => setDragging(null);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [dragging]);

    const startResize = useCallback((e) => {
        e.preventDefault();
        isResizing.current = true;
        const startX = e.clientX;
        const startW = panelWidth;
        const onMove = (ev) => {
            if (!isResizing.current) return;
            setPanelWidth(Math.max(380, Math.min(1200, startW - (ev.clientX - startX))));
        };
        const onUp = () => {
            isResizing.current = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [panelWidth]);

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        setZoom(prev => Math.min(2, Math.max(0.2, prev - e.deltaY * 0.001)));
    }, []);

    const handleCopy = () => {
        const content = normalized?._isErDiagram
            ? normalized.mermaid_code
            : normalized?.sql || '';
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getCenter = (tableName) => {
        const pos = positions[tableName];
        if (!pos) return null;
        return { x: pos.x + 115, y: pos.y + 25 };
    };

    if (!normalized) return null;

    const hasMermaid = normalized._isErDiagram && normalized.mermaid_code;
    const hasSql = !normalized._isErDiagram && normalized.sql;
    const hasTables = normalized.tables && normalized.tables.length > 0;
    const hasRelations = !normalized._isErDiagram && normalized.relationships?.length > 0;

    return (
        <aside className="live-panel panel" ref={panelRef} style={{ width: panelWidth + 'px' }}>
            <div className="resize-handle" onMouseDown={startResize} />

            {/* Header */}
            <div className="live-header">
                <div>
                    <div className="live-header-top">
                        <h3 className="live-title">{normalized.title}</h3>
                        {normalized.cardinality && (
                            <span className="cardinality-badge">{normalized.cardinality}</span>
                        )}
                    </div>
                    <p className="live-desc">{normalized.description}</p>
                </div>
                <button className="close-btn" onClick={onClose}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Tabs */}
            <div className="live-tabs">
                {hasMermaid && (
                    <button
                        className={`live-tab${activeTab === 'mermaid' ? ' active' : ''}`}
                        onClick={() => setActiveTab('mermaid')}
                    >
                        Diagrama E-R
                    </button>
                )}
                {hasTables && (
                    <button
                        className={`live-tab${activeTab === 'diagram' ? ' active' : ''}`}
                        onClick={() => setActiveTab('diagram')}
                    >
                        {hasMermaid ? 'Tablas' : 'Diagrama'}
                    </button>
                )}
                {hasRelations && (
                    <button
                        className={`live-tab${activeTab === 'relations' ? ' active' : ''}`}
                        onClick={() => setActiveTab('relations')}
                    >
                        Relaciones
                    </button>
                )}
                {(hasSql || hasMermaid) && (
                    <button
                        className={`live-tab${activeTab === 'sql' ? ' active' : ''}`}
                        onClick={() => setActiveTab('sql')}
                    >
                        {hasMermaid ? 'Codigo Mermaid' : 'Codigo SQL'}
                    </button>
                )}

                {activeTab === 'diagram' && (
                    <div className="zoom-controls">
                        <button onClick={() => setZoom(z => Math.min(2, z + 0.1))}>+</button>
                        <span>{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}>-</button>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="live-body">

                {/* Mermaid E-R Diagram */}
                {activeTab === 'mermaid' && hasMermaid && (
                    <div className="mermaid-wrapper">
                        <MermaidDiagram code={normalized.mermaid_code} />
                    </div>
                )}

                {/* Table cards (draggable) */}
                {activeTab === 'diagram' && hasTables && (
                    <div className="diagram-canvas" onWheel={handleWheel}>
                        <div style={{
                            transform: `scale(${zoom})`,
                            transformOrigin: 'top left',
                            position: 'absolute',
                            width: `${100 / zoom}%`,
                            height: `${100 / zoom}%`
                        }}>
                            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                                {(normalized.relationships || []).map((rel, idx) => {
                                    const from = getCenter(rel.from_table);
                                    const to = getCenter(rel.to_table);
                                    if (!from || !to) return null;
                                    const mx = (from.x + to.x) / 2;
                                    const my = (from.y + to.y) / 2;
                                    return (
                                        <g key={idx}>
                                            <path d={`M${from.x},${from.y} C${mx},${from.y} ${mx},${to.y} ${to.x},${to.y}`} fill="none" stroke="#52525b" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.8" />
                                            <circle cx={from.x} cy={from.y} r="4" fill="#52525b" opacity="0.8" />
                                            <circle cx={to.x} cy={to.y} r="4" fill="#71717a" opacity="0.8" />
                                            <rect x={mx - 16} y={my - 9} width="32" height="18" rx="4" fill="#18181b" stroke="#3f3f46" strokeWidth="1" opacity="0.9" />
                                            <text x={mx} y={my + 4} fill="#a1a1aa" fontSize="9" textAnchor="middle" fontWeight="bold">{rel.type}</text>
                                        </g>
                                    );
                                })}
                            </svg>
                            {normalized.tables.map((table, idx) => {
                                const pos = positions[table.name] || { x: idx * 270 + 20, y: 20 };
                                return (
                                    <TableCard
                                        key={table.name}
                                        table={table}
                                        pos={pos}
                                        onMouseDown={handleMouseDown}
                                        step={step}
                                        idx={idx}
                                        dragging={dragging}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Relations tab (legacy) */}
                {activeTab === 'relations' && hasRelations && (
                    <div className="relations-tab">
                        <div className="rel-label">Relaciones entre tablas</div>
                        {normalized.relationships.map((rel, idx) => (
                            <div key={idx} className="rel-row">
                                <span className="rel-from">{rel.from_table}.{rel.from_column}</span>
                                <span className="rel-arrow">
                                    <svg width="24" height="12" viewBox="0 0 24 12">
                                        <line x1="0" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="1.5" />
                                        <polygon points="18,2 24,6 18,10" fill="currentColor" />
                                    </svg>
                                </span>
                                <span className="rel-to">{rel.to_table}.{rel.to_column}</span>
                                <span className="rel-type">{rel.type}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* SQL / Mermaid code tab */}
                {activeTab === 'sql' && (
                    <div className="sql-tab">
                        <div className="sql-header">
                            <span className="sql-label">
                                {hasMermaid ? 'Sintaxis Mermaid (erDiagram)' : 'Script SQL completo'}
                            </span>
                            <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={handleCopy}>
                                {copied ? 'Copiado' : 'Copiar'}
                            </button>
                        </div>
                        <SyntaxHighlighter
                            language={hasMermaid ? 'text' : 'sql'}
                            style={oneDark}
                            customStyle={{
                                borderRadius: '8px',
                                fontSize: '0.78rem',
                                margin: 0,
                                background: '#111111',
                                border: '1px solid #2a2a2a',
                                height: 'calc(100vh - 200px)',
                                overflow: 'auto'
                            }}
                        >
                            {hasMermaid ? normalized.mermaid_code : (normalized.sql || '-- Sin script disponible')}
                        </SyntaxHighlighter>
                    </div>
                )}
            </div>
        </aside>
    );
}
