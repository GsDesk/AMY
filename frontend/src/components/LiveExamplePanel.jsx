import { useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './LiveExamplePanel.css';

export default function LiveExamplePanel({ example, onClose }) {
    const [step, setStep] = useState(0);

    // Animacion por pasos: cada 600ms revela un elemento mas
    useEffect(() => {
        setStep(0);
        const totalSteps = (example?.tables?.length || 0) + 2; // tables + relationships + sql
        let current = 0;
        const timer = setInterval(() => {
            current++;
            setStep(current);
            if (current >= totalSteps) clearInterval(timer);
        }, 500);
        return () => clearInterval(timer);
    }, [example]);

    if (!example) return null;

    return (
        <aside className="live-panel panel">
            <div className="live-header">
                <div>
                    <h3 className="live-title">{example.title}</h3>
                    <p className="live-desc">{example.description}</p>
                </div>
                <button className="close-btn" onClick={onClose} title="Cerrar panel">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="live-body">
                {/* Tables */}
                <div className={`tables-container ${example.tables.length === 3 ? 'three-tables' : ''}`}>
                    {example.tables.map((table, idx) => (
                        <div
                            key={table.name}
                            className={`table-card ${step > idx ? 'visible' : ''}`}
                            style={{ animationDelay: `${idx * 0.15}s` }}
                        >
                            <div className="table-name">{table.name}</div>
                            <div className="table-columns">
                                {table.columns.map(col => (
                                    <div key={col.name} className={`table-col ${col.constraint ? 'has-constraint' : ''}`}>
                                        <span className="col-name">{col.name}</span>
                                        <span className="col-type">{col.type}</span>
                                        {col.constraint && (
                                            <span className={`col-constraint constraint-${col.constraint.split('/')[0].toLowerCase()}`}>
                                                {col.constraint}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Relationships */}
                <div className={`relationships ${step > example.tables.length ? 'visible' : ''}`}>
                    <div className="rel-label">Relaciones</div>
                    {example.relationships.map((rel, idx) => (
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

                {/* SQL Example */}
                <div className={`sql-section ${step > example.tables.length + 1 ? 'visible' : ''}`}>
                    <div className="sql-label">SQL</div>
                    <SyntaxHighlighter
                        language="sql"
                        style={oneDark}
                        customStyle={{
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            margin: 0,
                            background: '#111111',
                            border: '1px solid #2a2a2a'
                        }}
                    >
                        {example.sql}
                    </SyntaxHighlighter>
                </div>
            </div>
        </aside>
    );
}
