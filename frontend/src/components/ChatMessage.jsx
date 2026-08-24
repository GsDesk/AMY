import { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './ChatMessage.css';

// ── Helper: Desenvolver texto si viene envuelto en JSON crudo ─────────────────
function unwrapText(text) {
    if (!text) return '';
    let str = text.trim();

    // 1. Despojar de bloques markdown ```json ... ``` exteriores si existen
    if (str.startsWith('```')) {
        str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    // 2. Si el texto es una estructura JSON { ... }
    if (str.startsWith('{') && str.includes('}')) {
        try {
            const obj = JSON.parse(str);
            if (obj?.assistant?.message?.text) return unwrapText(obj.assistant.message.text);
            if (obj?.message?.text) return unwrapText(obj.message.text);
            if (obj?.feedback) return unwrapText(obj.feedback);
            if (obj?.text) return unwrapText(obj.text);
        } catch {
            const match = str.match(/"feedback"\s*:\s*"([\s\S]*?)"(?:\s*,\s*"[a-z_]+"|\s*\})/) ||
                          str.match(/"text"\s*:\s*"([\s\S]*?)"/);
            if (match && match[1]) {
                str = match[1];
            }
        }
    }

    // Convertir saltos de línea literales escapados (\n) a saltos de línea reales
    return str.replace(/\\n/g, '\n').replace(/\\"/g, '"');
}


// ── Helper: detectar CREATE TABLE en texto ────────────────────────────────────

function extractSQLTables(text) {
    if (!text) return [];
    const tables = [];
    // Regex para CREATE TABLE con columnas
    const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?\s*\(([\s\S]*?)\);?/gi;
    let match;
    while ((match = tableRegex.exec(text)) !== null) {
        const tableName = match[1];
        const columnsBlock = match[2];
        const columns = [];
        // Parsear columnas
        const colLines = columnsBlock.split(',').map(l => l.trim()).filter(Boolean);
        for (const line of colLines) {
            // Saltar constraints de tabla
            if (/^\s*(PRIMARY|FOREIGN|UNIQUE|INDEX|KEY|CONSTRAINT|CHECK)/i.test(line)) {
                // Extraer FK references para marcarlas
                const fkMatch = line.match(/FOREIGN\s+KEY\s*\(["'`]?(\w+)["'`]?\)\s+REFERENCES\s+["'`]?(\w+)["'`]?\s*\(["'`]?(\w+)["'`]?\)/i);
                if (fkMatch) {
                    // Marcar la columna FK
                    const fkCol = columns.find(c => c.name === fkMatch[1]);
                    if (fkCol) {
                        fkCol.isFk = true;
                        fkCol.references = `${fkMatch[2]}(${fkMatch[3]})`;
                    }
                }
                continue;
            }
            const colMatch = line.match(/^["'`]?(\w+)["'`]?\s+([\w()]+(?:\s+\w+)*?)(?:\s+(PRIMARY\s+KEY|NOT\s+NULL|UNIQUE|DEFAULT.*|REFERENCES.*))?$/i);
            if (colMatch) {
                const isPk = line.toUpperCase().includes('PRIMARY KEY') ||
                             line.toUpperCase().includes('SERIAL') ||
                             colMatch[1].toLowerCase().startsWith('id');
                columns.push({
                    name: colMatch[1],
                    type: colMatch[2].toUpperCase().trim(),
                    isPk,
                    isFk: false,
                    constraint: isPk ? 'PK' : null,
                    references: null
                });
            }
        }
        if (tableName && columns.length > 0) {
            tables.push({ name: tableName, columns });
        }
    }
    return tables;
}

function hasSQLModel(text) {
    return /CREATE\s+TABLE/i.test(text);
}

// ── Componente: Toolbar de Código SQL ────────────────────────────────────────
function CodeToolbar({ code, language, onExplain }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
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
                >
                    {copied ? 'Copiado' : 'Copiar'}
                </button>
                {(language === 'sql' || language === 'SQL') && onExplain && (
                    <button
                        className="code-btn code-btn--explain"
                        onClick={handleExplain}
                        title="Explicar esta consulta"
                    >
                        Explicar
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Componente: Panel de Fuentes ──────────────────────────────────────────────
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
                <span className="sources-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                </span>
                <span>{open ? 'Ocultar fuentes' : `Fuentes RAG (${sources.length})`}</span>
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
                            <p className="source-ref">{src.metadata.fuente}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Componente principal: ChatMessage ─────────────────────────────────────────
export default function ChatMessage({ message, onExplainCode, onOpenDiagram }) {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const isTutor = message.sender === 'tutor';
    const isError = message.source === 'error';
    const isStreaming = message.streaming === true;

    // Desenvolver texto despojándolo de JSON crudo o markdown fences ```json
    const cleanText = useMemo(() => unwrapText(message.text || ''), [message.text]);

    // Detectar diagrama E-R desde live_example
    const erDiagram = isTutor && message.liveExample && message.liveExample.type === 'er_diagram'
        ? message.liveExample : null;

    // Detectar modelo SQL en el texto (CREATE TABLE) para mostrar botón del panel
    const sqlTables = useMemo(() => {
        if (!isTutor || isStreaming || erDiagram) return [];
        return extractSQLTables(cleanText);
    }, [isTutor, isStreaming, erDiagram, cleanText]);

    const hasSqlTables = sqlTables.length >= 1 && hasSQLModel(cleanText);

    // Construir live_example desde SQL si no viene del backend
    const handleOpenSQLModel = useCallback(() => {
        if (!onOpenDiagram || !hasSqlTables) return;
        const mermaidLines = ['erDiagram'];
        for (let i = 0; i < sqlTables.length - 1; i++) {
            const tableA = sqlTables[i];
            const tableB = sqlTables[i + 1];
            const hasFk = tableB.columns.some(c => c.isFk && c.references?.startsWith(tableA.name));
            if (hasFk) {
                mermaidLines.push(`  ${tableA.name} ||--o{ ${tableB.name} : "tiene"`);
            } else {
                mermaidLines.push(`  ${tableA.name} ||--o{ ${tableB.name} : "relaciona"`);
            }
        }
        for (const table of sqlTables) {
            mermaidLines.push(`  ${table.name} {`);
            for (const col of table.columns) {
                const constraint = col.isPk ? 'PK' : col.isFk ? 'FK' : '';
                mermaidLines.push(`    ${col.type} ${col.name}${constraint ? ' ' + constraint : ''}`);
            }
            mermaidLines.push('  }');
        }

        const syntheticExample = {
            type: 'er_diagram',
            title: `Modelo: ${sqlTables.map(t => t.name).join(' — ')}`,
            cardinality: sqlTables.length > 1 ? '1:N' : '',
            description: `Estructura de tablas extraída del código SQL`,
            mermaid_code: mermaidLines.join('\n'),
            tables: sqlTables.map(t => ({
                name: t.name,
                columns: t.columns.map(c => ({
                    name: c.name,
                    type: c.type,
                    isPk: c.isPk,
                    isFk: c.isFk,
                    references: c.references
                }))
            }))
        };
        onOpenDiagram(syntheticExample);
    }, [hasSqlTables, sqlTables, onOpenDiagram]);

    return (
        <div className={`chat-message ${isTutor ? 'tutor-msg' : 'user-msg'} ${isError ? 'error-msg' : ''}`}>
            {isTutor && (
                <div className="msg-avatar tutor-avatar">
                    <img src="/amy-logo.png" alt="AMY" className="msg-avatar-logo-img" />
                </div>
            )}

            <div className="msg-content">
                <div className={`msg-bubble ${isStreaming ? 'msg-bubble--streaming' : ''}`}>
                    {isTutor ? (
                        cleanText ? (
                            <>
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
                                    {cleanText}
                                </ReactMarkdown>
                                {isStreaming && <span className="streaming-cursor" />}
                            </>
                        ) : (
                            <div className="astronaut-thinking-card">
                                <img src="/astronaut-walking.png" alt="AMY Pensando..." className="astronaut-walking-img" />
                                <div className="astronaut-thinking-text">
                                    <span className="astronaut-thinking-title">AMY está pensando...</span>
                                    <span className="astronaut-thinking-sub">Analizando esquemas y bases de datos</span>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="user-msg-content-wrapper">
                            {message.attachment && (
                                <div className="msg-attachment-render">
                                    {(message.attachment.mimeType?.startsWith('image/') || message.attachment.mime_type?.startsWith('image/') || (message.attachment.base64Data || message.attachment.base64_data)) ? (
                                        <div className="msg-img-container" onClick={() => setLightboxOpen(true)}>
                                            <img
                                                src={message.attachment.base64Data || message.attachment.base64_data || message.attachment.previewUrl}
                                                alt={message.attachment.filename}
                                                className="msg-attached-img"
                                            />
                                            <div className="img-hover-overlay">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                                                </svg>
                                                <span>Ver imagen</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="msg-attached-doc-card">
                                            <div className="doc-card-icon">
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                    <polyline points="14 2 14 8 20 8"/>
                                                </svg>
                                            </div>
                                            <div className="doc-card-info">
                                                <span className="doc-card-name" title={message.attachment.filename}>{message.attachment.filename}</span>
                                                <span className="doc-card-ext">{message.attachment.filename?.split('.').pop()?.toUpperCase() || 'DOCUMENTO'}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {message.text && <p className="user-text-body">{message.text}</p>}
                        </div>
                    )}
                </div>

                {/* Modal Lightbox para ampliar capturas */}
                {lightboxOpen && message.attachment && (
                    <div className="lightbox-overlay" onClick={() => setLightboxOpen(false)}>
                        <div className="lightbox-content" onClick={e => e.stopPropagation()}>
                            <div className="lightbox-header">
                                <span>{message.attachment.filename}</span>
                                <button className="lightbox-close-btn" onClick={() => setLightboxOpen(false)}>✕</button>
                            </div>
                            <img
                                src={message.attachment.base64Data || message.attachment.base64_data || message.attachment.previewUrl}
                                alt={message.attachment.filename}
                                className="lightbox-full-img"
                            />
                        </div>
                    </div>
                )}

                {isTutor && message.source && message.source !== 'system' && (
                    <div className="msg-meta">
                        <span className={`source-badge ${isError ? 'badge-error' : 'badge-default'}`}>
                            {isError ? 'Error'
                                : message.source === 'gemini' ? 'Gemini 2.5 Flash'
                                : message.source === 'groq-llama3' ? 'Groq / Llama3'
                                : message.source === 'ollama-mistral' ? 'Mistral Local'
                                : message.source}
                        </span>
                        {message.topic && message.topic !== 'Error' && message.topic !== 'Procesando...' && (
                            <span className="topic-badge">{message.topic}</span>
                        )}
                        {message.ragUsed && (
                            <span className="rag-badge">RAG</span>
                        )}
                        {message.ragLearned && (
                            <span className="rag-learned-badge" title="Este documento aportó contenido conceptual y fue indexado en la base vectorial RAG">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                Conocimiento RAG Indexado
                            </span>
                        )}
                        {isStreaming && (
                            <span className="streaming-badge">
                                <span className="streaming-pulse-dot" />
                                Pensando...
                            </span>
                        )}
                    </div>
                )}

                {/* Botón para abrir pestaña de Normalización cuando el mensaje habla de normalización */}
                {isTutor && message.id !== 'welcome' && !isStreaming && onOpenDiagram && (
                    cleanText.toLowerCase().includes('normaliz') ||
                    cleanText.toLowerCase().includes('1fn') ||
                    cleanText.toLowerCase().includes('2fn') ||
                    cleanText.toLowerCase().includes('3fn') ||
                    cleanText.toLowerCase().includes('forma normal') ||
                    message.topic?.toLowerCase().includes('normaliz')
                ) && (
                    <button
                        className="er-reopen-btn norm-reopen-btn"
                        onClick={() => {
                            onOpenDiagram({
                                type: 'er_diagram',
                                title: 'Ejemplo Práctico: Proceso de Normalización (1FN a 3FN)',
                                defaultTab: 'normalization',
                                cardinality: '3FN',
                                description: 'Evolución de esquemas relacionales: eliminación de redundancias y dependencias funcionales.',
                                tables: [
                                    {
                                        name: 'alumnos',
                                        columns: [
                                            { name: 'matricula', type: 'INT', isPk: true, constraint: 'PK' },
                                            { name: 'nombre', type: 'VARCHAR(50)' },
                                            { name: 'dirección', type: 'VARCHAR(100)' },
                                            { name: 'telefono', type: 'VARCHAR(15)' },
                                            { name: 'id_carrera', type: 'VARCHAR(10)', isFk: true, references: 'carreras(id_carrera)' }
                                        ]
                                    },
                                    {
                                        name: 'carreras',
                                        columns: [
                                            { name: 'id_carrera', type: 'VARCHAR(10)', isPk: true, constraint: 'PK' },
                                            { name: 'carrera', type: 'VARCHAR(80)' }
                                        ]
                                    },
                                    {
                                        name: 'cursos',
                                        columns: [
                                            { name: 'código', type: 'VARCHAR(10)', isPk: true, constraint: 'PK' },
                                            { name: 'curso', type: 'VARCHAR(60)' }
                                        ]
                                    },
                                    {
                                        name: 'alumno_curso',
                                        columns: [
                                            { name: 'matricula', type: 'INT', isFk: true, references: 'alumnos(matricula)' },
                                            { name: 'código', type: 'VARCHAR(10)', isFk: true, references: 'cursos(código)' }
                                        ]
                                    }
                                ]
                            });
                        }}
                        title="Abrir panel interactivo con tablas de normalización 1FN, 2FN y 3FN"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18"/>
                        </svg>
                        Ver Tablas de Normalización (1FN, 2FN, 3FN)
                        <span className="er-btn-badge">1FN-3FN</span>
                    </button>
                )}

                {/* Botón para abrir diagrama E-R (excluyendo el mensaje de bienvenida inicial) */}
                {isTutor && message.id !== 'welcome' && !isStreaming && onOpenDiagram && (erDiagram || hasSqlTables || cleanText.toLowerCase().includes('cliente') || cleanText.toLowerCase().includes('empleado') || cleanText.toLowerCase().includes('factura') || cleanText.toLowerCase().includes('tabla') || cleanText.toLowerCase().includes('relación')) && (

                    <button
                        className="er-reopen-btn"
                        onClick={() => {
                            if (erDiagram) {
                                onOpenDiagram(erDiagram);
                            } else if (hasSqlTables) {
                                handleOpenSQLModel();
                            } else {
                                // Síntesis dinámica de modelo multitabla con completitud estricta de atributos reales
                                const ENTITY_SCHEMA_MAP = {
                                    cliente: {
                                        name: 'Cliente',
                                        columns: [
                                            { name: 'id_cliente', type: 'INT', isPk: true },
                                            { name: 'ci_ruc', type: 'VARCHAR(13)' },
                                            { name: 'nombres', type: 'VARCHAR(50)' },
                                            { name: 'apellidos', type: 'VARCHAR(50)' },
                                            { name: 'telefono', type: 'VARCHAR(15)' },
                                            { name: 'correo_electronico', type: 'VARCHAR(100)' },
                                            { name: 'direccion', type: 'VARCHAR(150)' }
                                        ]
                                    },
                                    empleado: {
                                        name: 'Empleado',
                                        columns: [
                                            { name: 'id_empleado', type: 'INT', isPk: true },
                                            { name: 'ci', type: 'VARCHAR(10)' },
                                            { name: 'nombres', type: 'VARCHAR(50)' },
                                            { name: 'apellidos', type: 'VARCHAR(50)' },
                                            { name: 'cargo', type: 'VARCHAR(60)' },
                                            { name: 'salario', type: 'DECIMAL(10,2)' },
                                            { name: 'fecha_ingreso', type: 'DATE' }
                                        ]
                                    },
                                    factura: {
                                        name: 'Factura',
                                        columns: [
                                            { name: 'id_factura', type: 'INT', isPk: true },
                                            { name: 'numero_factura', type: 'VARCHAR(20)' },
                                            { name: 'fecha_emision', type: 'DATE' },
                                            { name: 'subtotal', type: 'DECIMAL(10,2)' },
                                            { name: 'iva', type: 'DECIMAL(10,2)' },
                                            { name: 'total', type: 'DECIMAL(10,2)' },
                                            { name: 'estado', type: 'VARCHAR(20)' },
                                            { name: 'id_cliente', type: 'INT', isFk: true, references: 'Cliente(id_cliente)' },
                                            { name: 'id_empleado', type: 'INT', isFk: true, references: 'Empleado(id_empleado)' }
                                        ]
                                    },
                                    detalle_factura: {
                                        name: 'Detalle_Factura',
                                        columns: [
                                            { name: 'id_detalle', type: 'INT', isPk: true },
                                            { name: 'id_factura', type: 'INT', isFk: true, references: 'Factura(id_factura)' },
                                            { name: 'id_producto', type: 'INT', isFk: true, references: 'Producto(id_producto)' },
                                            { name: 'cantidad', type: 'INT' },
                                            { name: 'precio_unitario', type: 'DECIMAL(10,2)' },
                                            { name: 'subtotal_linea', type: 'DECIMAL(10,2)' }
                                        ]
                                    },
                                    producto: {
                                        name: 'Producto',
                                        columns: [
                                            { name: 'id_producto', type: 'INT', isPk: true },
                                            { name: 'codigo_producto', type: 'VARCHAR(30)' },
                                            { name: 'nombre', type: 'VARCHAR(100)' },
                                            { name: 'descripcion', type: 'TEXT' },
                                            { name: 'precio_unitario', type: 'DECIMAL(10,2)' },
                                            { name: 'stock', type: 'INT' },
                                            { name: 'categoria', type: 'VARCHAR(50)' }
                                        ]
                                    },
                                    pago: {
                                        name: 'Pago',
                                        columns: [
                                            { name: 'id_pago', type: 'INT', isPk: true },
                                            { name: 'id_factura', type: 'INT', isFk: true, references: 'Factura(id_factura)' },
                                            { name: 'fecha_pago', type: 'TIMESTAMP' },
                                            { name: 'monto', type: 'DECIMAL(10,2)' },
                                            { name: 'metodo_pago', type: 'VARCHAR(40)' },
                                            { name: 'numero_transaccion', type: 'VARCHAR(50)' }
                                        ]
                                    }
                                };

                                const detectedKeys = [];
                                Object.keys(ENTITY_SCHEMA_MAP).forEach(k => {
                                    if (cleanText.toLowerCase().includes(k) || cleanText.toLowerCase().includes(k.replace('_', ' '))) {
                                        detectedKeys.push(k);
                                    }
                                });

                                const selectedKeys = detectedKeys.length >= 2 ? detectedKeys : ['cliente', 'factura', 'empleado', 'pago'];
                                const finalTables = selectedKeys.map(k => ENTITY_SCHEMA_MAP[k]);

                                const mermaidLines = ['erDiagram'];
                                mermaidLines.push('  CLIENTE ||--o{ FACTURA : "1:N emite"');
                                mermaidLines.push('  CLIENTE ||--o{ PAGO : "1:N efectua"');
                                mermaidLines.push('  EMPLEADO ||--o{ FACTURA : "1:N procesa"');
                                mermaidLines.push('  FACTURA ||--|{ DETALLE_FACTURA : "1:N contiene"');
                                mermaidLines.push('  PRODUCTO ||--o{ DETALLE_FACTURA : "1:N pertenece"');

                                finalTables.forEach(t => {
                                    mermaidLines.push(`  ${t.name.toUpperCase()} {`);
                                    t.columns.forEach(c => {
                                        const typeStr = c.type.includes('VARCHAR') || c.type === 'TEXT' ? 'string' : c.type.includes('DECIMAL') ? 'decimal' : c.type.includes('DATE') ? 'date' : 'int';
                                        const badge = c.isPk ? ' PK' : c.isFk ? ' FK' : '';
                                        mermaidLines.push(`    ${typeStr} ${c.name}${badge}`);
                                    });
                                    mermaidLines.push('  }');
                                });

                                onOpenDiagram({
                                    type: 'er_diagram',
                                    title: `Modelo: ${finalTables.map(t => t.name).join(' — ')}`,
                                    cardinality: '1:N',
                                    description: 'Esquema relacional normalizado con completitud de atributos del mundo real',
                                    mermaid_code: mermaidLines.join('\n'),
                                    tables: finalTables
                                });
                            }
                        }}
                        title="Abrir panel interactivo de diagrama E-R y tablas"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" rx="1"/>
                            <rect x="14" y="3" width="7" height="7" rx="1"/>
                            <rect x="3" y="14" width="7" height="7" rx="1"/>
                            <path d="M14 17.5h7M17.5 14v7"/>
                        </svg>
                        Ver Diagrama E-R
                        <span className="er-btn-badge">1:N</span>
                    </button>
                )}

                {isTutor && message.modelSwitched && (
                    <div className="model-switch-alert">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                        <span>{message.switchReason || 'Se conmuto automaticamente de modelo.'}</span>
                    </div>
                )}

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

