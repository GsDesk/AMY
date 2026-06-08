import { useEffect, useState, useRef, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './LiveExamplePanel.css';

export default function LiveExamplePanel({ example, onClose }) {
    const [step, setStep] = useState(0);
    const [copied, setCopied] = useState(false);
    const [positions, setPositions] = useState({});
    const [dragging, setDragging] = useState(null);
    const [activeTab, setActiveTab] = useState('diagram');
    const [panelWidth, setPanelWidth] = useState(750);
    const [zoom, setZoom] = useState(0.85);
    const dragOffset = useRef({});
    const isResizing = useRef(false);
    const panelRef = useRef();

    useEffect(() => {
        setStep(0);
        setActiveTab('diagram');
        setZoom(0.85);
        const totalSteps = (example?.tables?.length || 0) + 2;
        let current = 0;
        const timer = setInterval(() => {
            current++;
            setStep(current);
            if (current >= totalSteps) clearInterval(timer);
        }, 400);
        const cols = Math.min((example?.tables?.length || 1), 3);
        const initialPositions = {};
        (example?.tables || []).forEach((table, idx) => {
            initialPositions[table.name] = {
                x: (idx % cols) * 270 + 20,
                y: Math.floor(idx / cols) * 200 + 20
            };
        });
        setPositions(initialPositions);
        return () => clearInterval(timer);
    }, [example]);

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
        navigator.clipboard.writeText(example.sql || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getCenter = (tableName) => {
        const pos = positions[tableName];
        if (!pos) return null;
        return { x: pos.x + 115, y: pos.y + 25 };
    };

    if (!example) return null;

    return (
        <aside className="live-panel panel" ref={panelRef} style={{ width: panelWidth + 'px' }}>
            <div className="resize-handle" onMouseDown={startResize} />
            <div className="live-header">
                <div>
                    <h3 className="live-title">{example.title}</h3>
                    <p className="live-desc">{example.description}</p>
                </div>
                <button className="close-btn" onClick={onClose}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="live-tabs">
                <button className={"live-tab" + (activeTab==="diagram" ? " active" : "")} onClick={() => setActiveTab("diagram")}>Diagrama</button>
                <button className={"live-tab" + (activeTab==="relations" ? " active" : "")} onClick={() => setActiveTab("relations")}>Relaciones</button>
                <button className={"live-tab" + (activeTab==="sql" ? " active" : "")} onClick={() => setActiveTab("sql")}>Código SQL</button>
                {activeTab === "diagram" && (
                    <div className="zoom-controls">
                        <button onClick={() => setZoom(z => Math.min(2, z + 0.1))}>+</button>
                        <span>{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}>-</button>
                    </div>
                )}
            </div>

            <div className="live-body">
                {activeTab === "diagram" && (
                    <div className="diagram-canvas" onWheel={handleWheel}>
                        <div style={{ transform: "scale(" + zoom + ")", transformOrigin: "top left", position: "absolute", width: (100/zoom) + "%", height: (100/zoom) + "%" }}>
                            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                                {(example.relationships || []).map((rel, idx) => {
                                    const from = getCenter(rel.from_table);
                                    const to = getCenter(rel.to_table);
                                    if (!from || !to) return null;
                                    const mx = (from.x + to.x) / 2;
                                    const my = (from.y + to.y) / 2;
                                    return (
                                        <g key={idx}>
                                            <path d={"M"+from.x+","+from.y+" C"+mx+","+from.y+" "+mx+","+to.y+" "+to.x+","+to.y} fill="none" stroke="#4a9eff" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.8"/>
                                            <circle cx={from.x} cy={from.y} r="4" fill="#4a9eff" opacity="0.8"/>
                                            <circle cx={to.x} cy={to.y} r="4" fill="#ff6b6b" opacity="0.8"/>
                                            <rect x={mx-16} y={my-9} width="32" height="18" rx="4" fill="#1a1a2e" stroke="#4a9eff" strokeWidth="1" opacity="0.9"/>
                                            <text x={mx} y={my+4} fill="#4a9eff" fontSize="9" textAnchor="middle" fontWeight="bold">{rel.type}</text>
                                        </g>
                                    );
                                })}
                            </svg>
                            {example.tables.map((table, idx) => {
                                const pos = positions[table.name] || { x: idx * 270 + 20, y: 20 };
                                return (
                                    <div key={table.name}
                                        className={"table-card draggable" + (step > idx ? " visible" : "") + (dragging === table.name ? " is-dragging" : "")}
                                        style={{ left: pos.x, top: pos.y, position: 'absolute', zIndex: 2, width: '230px' }}
                                        onMouseDown={(e) => handleMouseDown(e, table.name)}
                                    >
                                        <div className="table-name"><span className="drag-handle">⠿</span>{table.name}</div>
                                        <div className="table-columns">
                                            {table.columns.map(col => (
                                                <div key={col.name} className={"table-col" + (col.constraint ? " has-constraint" : "")}>
                                                    <span className="col-name">{col.name}</span>
                                                    <span className="col-type">{col.type}</span>
                                                    {col.constraint && <span className={"col-constraint constraint-" + col.constraint.split('/')[0].toLowerCase()}>{col.constraint}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === "relations" && (
                    <div className="relations-tab">
                        <div className="rel-label">Relaciones entre tablas</div>
                        {(example.relationships || []).map((rel, idx) => (
                            <div key={idx} className="rel-row">
                                <span className="rel-from">{rel.from_table}.{rel.from_column}</span>
                                <span className="rel-arrow">
                                    <svg width="24" height="12" viewBox="0 0 24 12">
                                        <line x1="0" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="1.5"/>
                                        <polygon points="18,2 24,6 18,10" fill="currentColor"/>
                                    </svg>
                                </span>
                                <span className="rel-to">{rel.to_table}.{rel.to_column}</span>
                                <span className="rel-type">{rel.type}</span>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === "sql" && (
                    <div className="sql-tab">
                        <div className="sql-header">
                            <span className="sql-label">Script SQL completo</span>
                            <button className={"copy-btn" + (copied ? " copied" : "")} onClick={handleCopy}>
                                {copied ? '✓ Copiado' : '⧉ Copiar'}
                            </button>
                        </div>
                        <SyntaxHighlighter language="sql" style={oneDark} customStyle={{ borderRadius: '8px', fontSize: '0.78rem', margin: 0, background: '#111111', border: '1px solid #2a2a2a', height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                            {example.sql || '-- Sin script disponible'}
                        </SyntaxHighlighter>
                    </div>
                )}
            </div>
        </aside>
    );
}
