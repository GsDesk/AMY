import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import mermaid from 'mermaid';
import './LiveExamplePanel.css';

/* ── Generador y Sanitizador de Código Mermaid erDiagram ────────── */
function generateCleanMermaid(tables, relationships, rawCode) {
    if (tables && tables.length > 0) {
        const lines = ['erDiagram'];
        if (relationships && relationships.length > 0) {
            for (const r of relationships) {
                const card = r.type === '1:1' ? '||--||' : r.type === 'N:M' ? '}o--o{' : '||--o{';
                const from = r.fromTable || tables[0]?.name;
                const to = r.toTable || tables[1]?.name;
                if (from && to) {
                    lines.push(`    ${from} ${card} ${to} : "relaciona"`);
                }
            }
        } else if (tables.length > 1) {
            for (let i = 0; i < tables.length - 1; i++) {
                lines.push(`    ${tables[i].name} ||--o{ ${tables[i + 1].name} : "relaciona"`);
            }
        }
        for (const t of tables) {
            lines.push(`    ${t.name} {`);
            for (const c of t.columns) {
                const cleanType = String(c.type || 'varchar').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '') || 'varchar';
                const constr = c.isPk ? 'PK' : c.isFk ? 'FK' : '';
                lines.push(`        ${cleanType} ${c.name}${constr ? ' ' + constr : ''}`);
            }
            lines.push(`    }`);
        }
        return lines.join('\n');
    }
    if (rawCode) {
        return rawCode
            .replace(/\r/g, '')
            .replace(/}\s*([A-Za-z0-9_]+)\s*{/g, '}\n$1 {')
            .replace(/(\w+)\s*\((.*?)\)/g, '$1');
    }
    return '';
}

/* ── Normalizador de Datos E-R ─────────────────────────────────── */
function normalizeExample(example) {
    if (!example) return null;

    const rawTables = example.tables || [];
    const tables = rawTables.map(t => {
        const tableName = String(t.name || 'Tabla');
        const columns = (t.columns || []).map(c => {
            const colName = String(c.name || 'columna');
            const isPk = !!c.isPk || (typeof c.constraint === 'string' && c.constraint.toUpperCase().includes('PK')) || colName === `id_${tableName.toLowerCase()}` || colName === 'id';
            const isFk = !!c.isFk || (typeof c.constraint === 'string' && c.constraint.toUpperCase().includes('FK')) || (typeof c.references === 'string' && c.references.length > 0);
            
            let refTarget = null;
            if (typeof c.references === 'string' && c.references) {
                refTarget = c.references;
            } else if (isFk) {
                const match = colName.match(/^id_(\w+)/);
                if (match) refTarget = `${match[1]}(id_${match[1]})`;
            }

            return {
                name: colName,
                type: String(c.type || (isPk ? 'INT' : 'VARCHAR(100)')).toUpperCase(),
                isPk,
                isFk,
                constraint: isPk ? 'PK' : isFk ? 'FK' : null,
                references: refTarget
            };
        });

        if (columns.length > 0 && !columns.some(c => c.isPk)) {
            columns[0].isPk = true;
            columns[0].constraint = 'PK';
        }

        return {
            name: tableName,
            columns
        };
    });

    const relationships = example.relationships || [];

    return {
        _isErDiagram: example.type === 'er_diagram' || tables.length > 0,
        title: example.title || (tables.length > 0 ? `Esquema: ${tables.map(t => t.name).join(' — ')}` : 'Diagrama Entidad-Relación'),
        description: example.description || 'Modelo relacional interactivo con entidades, atributos y cardinalidades.',
        cardinality: example.cardinality || '1:N',
        mermaid_code: generateCleanMermaid(tables, relationships, example.mermaid_code),
        tables,
        relationships,
        sql: example.sql || null
    };
}

/* ── Renderizador Mermaid (Diagrama Conceptual) ─────────────────── */
function MermaidDiagram({ code }) {
    const [error, setError] = useState(null);
    const [svg, setSvg] = useState(null);

    useEffect(() => {
        if (!code) return;
        let isMounted = true;
        setError(null);
        setSvg(null);

        try {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                themeVariables: {
                    background: '#09090b',
                    primaryColor: '#141417',
                    primaryTextColor: '#f4f4f5',
                    primaryBorderColor: '#3f3f46',
                    lineColor: '#38bdf8',
                    secondaryColor: '#1f1f23',
                    tertiaryColor: '#141417',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '13px'
                }
            });
            const id = `mermaid-er-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            mermaid.render(id, code)
                .then(({ svg: rendered }) => {
                    if (isMounted) setSvg(rendered);
                })
                .catch(err => {
                    if (isMounted) setError('No se pudo renderizar el diagrama Mermaid: ' + err.message);
                });
        } catch (err) {
            if (isMounted) setError('Librería Mermaid no disponible: ' + err.message);
        }

        return () => { isMounted = false; };
    }, [code]);

    return (
        <div className="mermaid-view-container">
            {error && <div className="mermaid-error-box">{error}</div>}
            {!error && !svg && <div className="mermaid-loading-state">Renderizando esquema conceptual...</div>}
            {!error && svg && (
                <div
                    className="mermaid-svg-stage"
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            )}
        </div>
    );
}

/* ── Tarjeta de Entidad / Tabla en el Tablero ───────────────────── */
function TableEntityCard({
    table,
    pos,
    onMouseDown,
    onTouchStart,
    isDragging,
    isSelected,
    onSelect,
    activeHighlight,
    onColumnClick,
    isCollapsed,
    onToggleCollapse
}) {
    const pkCount = table.columns.filter(c => c.isPk).length;
    const fkCount = table.columns.filter(c => c.isFk).length;

    return (
        <div
            className={`er-table-card ${isDragging ? 'is-dragging' : ''} ${isSelected ? 'is-selected' : ''} ${activeHighlight ? 'is-highlighted' : ''}`}
            style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                zIndex: isDragging ? 50 : isSelected ? 40 : activeHighlight ? 30 : 10
            }}
            onMouseDown={(e) => onMouseDown(e, table.name)}
            onTouchStart={(e) => onTouchStart(e, table.name)}
            onClick={(e) => { e.stopPropagation(); onSelect(table.name); }}
        >
            {/* Header de la tarjeta */}
            <div className="er-card-header">
                <div className="er-card-header-left">
                    <span className="er-drag-handle" title="Arrastrar entidad">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                        </svg>
                    </span>
                    <span className="er-table-title" title={table.name}>{table.name}</span>
                </div>
                <div className="er-card-header-right">
                    <span className="er-col-counter" title={`${table.columns.length} atributos`}>
                        {table.columns.length}
                    </span>
                    <button
                        className="er-collapse-btn"
                        onClick={(e) => { e.stopPropagation(); onToggleCollapse(table.name); }}
                        title={isCollapsed ? 'Expandir atributos' : 'Colapsar atributos'}
                    >
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                        >
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Sub-barra de resumen PK / FK */}
            <div className="er-card-subbar">
                <span className="er-subbar-tag pk-tag">{pkCount} PK</span>
                {fkCount > 0 && <span className="er-subbar-tag fk-tag">{fkCount} FK</span>}
                <span className="er-subbar-mode">{isCollapsed ? 'Colapsado' : 'Esquema'}</span>
            </div>

            {/* Listado de Columnas / Atributos con Puertos de Conexión */}
            {!isCollapsed && (
                <div className="er-columns-list">
                    {table.columns.map((col, cIdx) => {
                        const isColHighlighted = activeHighlight && (col.isPk || col.isFk);
                        return (
                            <div
                                key={col.name || cIdx}
                                className={`er-column-row ${col.isPk ? 'is-pk-row' : ''} ${col.isFk ? 'is-fk-row' : ''} ${isColHighlighted ? 'col-active-hl' : ''}`}
                                onClick={(e) => { e.stopPropagation(); onColumnClick(table.name, col); }}
                                title={col.references ? `Clave foránea -> ${col.references}` : col.isPk ? 'Clave Primaria' : `${col.name} (${col.type})`}
                            >
                                {/* Puerto de anclaje izquierdo */}
                                {(col.isPk || col.isFk) && (
                                    <span className={`er-port-dot port-left ${col.isPk ? 'port-pk' : 'port-fk'}`} />
                                )}

                                <div className="er-col-info">
                                    <span className="er-col-name">{col.name}</span>
                                    <span className="er-col-type">{col.type}</span>
                                </div>

                                <div className="er-col-badges">
                                    {col.isPk && <span className="er-badge-constraint badge-pk">PK</span>}
                                    {col.isFk && <span className="er-badge-constraint badge-fk">FK</span>}
                                    {col.references && (
                                        <span className="er-ref-target" title={col.references}>
                                            -> {col.references.split('(')[0]}
                                        </span>
                                    )}
                                </div>

                                {/* Puerto de anclaje derecho */}
                                {(col.isPk || col.isFk) && (
                                    <span className={`er-port-dot port-right ${col.isPk ? 'port-pk' : 'port-fk'}`} />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ── Datos de Referencia Pedagógica de Normalización (1FN, 2FN, 3FN) ── */
const NORMALIZATION_DATA = {
    '0fn': {
        title: '0FN — Tabla No Normalizada (Sin Normalizar)',
        badge: '0FN',
        badgeColor: '#ef4444',
        rule: 'Datos almacenados en una sola estructura con atributos multivaluados y redundancia severa.',
        anomaly: 'Anomalías de inserción, modificación (actualización) y eliminación. Si un estudiante no tiene materia no se puede registrar, y si cambia de dirección hay que actualizar múltiples registros.',
        tables: [
            {
                name: 'Reporte_Matriculas_General',
                description: 'Tabla única con datos desnormalizados de estudiantes, docentes y asignaturas',
                columns: ['Nombre_Estudiante', 'Numero_identificacion', 'Sexo', 'Docente', 'Materias'],
                rows: [
                    ['Melisa Rios Buritica', '1007306575', 'Femenino', 'Daniel Perez', 'Matematicas'],
                    ['Jhon Cuervo Naranjo', '1305879059', 'Masculino', 'Claudia Naranjo', 'Ingles'],
                    ['Maria Angel Bustamante', '1010141526', 'Femenino', 'Esteban Piedrahita', 'Español'],
                    ['Melisa Rios Buritica', '1007306575', 'Femenino', 'Claudia Naranjo', 'Ingles']
                ]
            }
        ]
    },
    '1fn': {
        title: '1FN — Primera Forma Normal (Atomicidad y Claves)',
        badge: '1FN',
        badgeColor: '#f59e0b',
        rule: 'Todos los atributos son atómicos (indivisibles), no existen grupos repetitivos y se define una Clave Primaria (PK) explícita.',
        anomaly: 'Se separan nombres completos en Nombre, Primer Apellido y Segundo Apellido. Se asigna Id_Estudiante como PK.',
        tables: [
            {
                name: 'Estudiante_1FN',
                description: 'Tabla con atributos atómicos y tipo de identificación individual',
                columns: ['Id_Estudiante (PK)', 'Nombre_Est', 'P_Apellido', 'S_Apellido', 'T_Identificacion'],
                pkIndex: 0,
                rows: [
                    ['115', 'Melisa', 'Rios', 'Buritica', 'CC'],
                    ['116', 'Jhon', 'Cuervo', 'Naranjo', 'CC'],
                    ['117', 'Maria Angel', 'Bustamante', 'Yepez', 'T.I'],
                    ['118', 'Melisa', 'Rios', 'Buritica', 'CC']
                ]
            }
        ]
    },
    '2fn': {
        title: '2FN — Segunda Forma Normal (Eliminación de Dependencias Parciales)',
        badge: '2FN',
        badgeColor: '#38bdf8',
        rule: 'Cumple 1FN y todos los atributos no clave dependen funcionalmente de la totalidad de la Clave Primaria (no de una parte de ella).',
        anomaly: 'Se separan las entidades ESTUDIANTE y DOCENTE de la tabla intermedia de asignación de cursos.',
        tables: [
            {
                name: 'ESTUDIANTE',
                description: 'Entidad independiente de alumnos',
                columns: ['Id_Estudiante (PK)', 'Nombre_Est', 'P_Apellido', 'S_Apellido', 'T_Identificacion'],
                pkIndex: 0,
                rows: [
                    ['115', 'Melisa', 'Rios', 'Buritica', 'CC'],
                    ['116', 'Jhon', 'Cuervo', 'Naranjo', 'CC'],
                    ['117', 'Maria Angel', 'Bustamante', 'Yepez', 'T.I']
                ]
            },
            {
                name: 'DOCENTE',
                description: 'Entidad independiente de profesores',
                columns: ['Id_Docente (PK)', 'Nombre_Docent', 'P_Apellido', 'S_Apellido', 'Materias'],
                pkIndex: 0,
                rows: [
                    ['12', 'Daniel', 'Perez', 'Alzate', 'Matematicas'],
                    ['15', 'Claudia', 'Naranjo', 'Estrada', 'Ingles'],
                    ['18', 'Esteban', 'Piedrahita', 'Gomez', 'Español']
                ]
            },
            {
                name: 'DOCENTE_POR_ESTUDIANTE',
                description: 'Tabla de relación intermedia con claves foráneas compuestas',
                columns: ['Id_Docente (FK)', 'Id_Estudiante (FK)', 'Materias', 'Aula'],
                fkIndices: [0, 1],
                rows: [
                    ['12', '115', 'Matematicas', '305'],
                    ['15', '116', 'Ingles', '201'],
                    ['18', '117', 'Español', '508'],
                    ['15', '115', 'Ingles', '201']
                ]
            }
        ]
    },
    '3fn': {
        title: '3FN — Tercera Forma Normal (Eliminación de Dependencias Transitivas)',
        badge: '3FN',
        badgeColor: '#10b981',
        rule: 'Cumple 2FN y ningún atributo no clave depende transitivamente de otro atributo no clave (X -> Y, Y -> Z eliminado mediante nueva tabla).',
        anomaly: 'Esquema relacional óptimo de producción académica (como en el ejemplo de alumnos, cursos, carreras y alumno_curso).',
        tables: [
            {
                name: 'alumnos',
                description: 'Datos atómicos de estudiantes con referencia a su carrera',
                columns: ['matricula (PK)', 'nombre', 'dirección', 'telefono', 'id_carrera (FK)'],
                pkIndex: 0,
                fkIndices: [4],
                rows: [
                    ['100', 'juan', 'ongolmo 340, concepción', '78872890', 'C2100'],
                    ['200', 'ana', 'san martín 840, santiago', '78342367', 'C2020']
                ]
            },
            {
                name: 'carreras',
                description: 'Catálogo normalizado de carreras universitarias',
                columns: ['id_carrera (PK)', 'carrera'],
                pkIndex: 0,
                rows: [
                    ['C2100', 'ingeniería civil informática'],
                    ['C2020', 'ingeniería comercial']
                ]
            },
            {
                name: 'cursos',
                description: 'Catálogo de materias/cursos ofertados',
                columns: ['código (PK)', 'curso'],
                pkIndex: 0,
                rows: [
                    ['bd1', 'base de datos'],
                    ['e2', 'estadística'],
                    ['a5', 'analítica']
                ]
            },
            {
                name: 'alumno_curso',
                description: 'Tabla de relación muchos a muchos (N:M) normalizada',
                columns: ['matricula (FK)', 'código (FK)'],
                fkIndices: [0, 1],
                rows: [
                    ['100', 'bd1'],
                    ['100', 'e2'],
                    ['100', 'a5'],
                    ['200', 'e2'],
                    ['200', 'a5']
                ]
            }
        ]
    }
};

/* ── Esquemas Completos de Normalización para Tablero E-R, Conceptual y SQL ── */
const NORMALIZATION_SCHEMAS = {
    '0fn': {
        title: '0FN — Tabla No Normalizada (Sin Normalizar)',
        cardinality: '0FN',
        description: 'Tabla única desnormalizada con anomalías de redundancia y atributos no atómicos.',
        tables: [
            {
                name: 'Reporte_Matriculas_General',
                columns: [
                    { name: 'Nombre_Estudiante', type: 'VARCHAR(100)', isPk: false },
                    { name: 'Numero_identificacion', type: 'VARCHAR(20)', isPk: false },
                    { name: 'Sexo', type: 'VARCHAR(15)', isPk: false },
                    { name: 'Docente', type: 'VARCHAR(80)', isPk: false },
                    { name: 'Materias', type: 'VARCHAR(100)', isPk: false }
                ]
            }
        ],
        relationships: []
    },
    '1fn': {
        title: '1FN — Primera Forma Normal (Valores Atómicos)',
        cardinality: '1FN',
        description: 'Todos los atributos son atómicos e indivisibles, con clave primaria única Id_Estudiante.',
        tables: [
            {
                name: 'Estudiante_1FN',
                columns: [
                    { name: 'Id_Estudiante', type: 'INT', isPk: true, constraint: 'PK' },
                    { name: 'Nombre_Est', type: 'VARCHAR(50)', isPk: false },
                    { name: 'P_Apellido', type: 'VARCHAR(50)', isPk: false },
                    { name: 'S_Apellido', type: 'VARCHAR(50)', isPk: false },
                    { name: 'T_Identificacion', type: 'VARCHAR(10)', isPk: false }
                ]
            }
        ],
        relationships: []
    },
    '2fn': {
        title: '2FN — Segunda Forma Normal (Eliminación de Dep. Parciales)',
        cardinality: '2FN',
        description: 'Separación en entidades Estudiante y Docente para evitar dependencias funcionales parciales.',
        tables: [
            {
                name: 'ESTUDIANTE',
                columns: [
                    { name: 'Id_Estudiante', type: 'INT', isPk: true, constraint: 'PK' },
                    { name: 'Nombre_Est', type: 'VARCHAR(50)', isPk: false },
                    { name: 'P_Apellido', type: 'VARCHAR(50)', isPk: false },
                    { name: 'S_Apellido', type: 'VARCHAR(50)', isPk: false },
                    { name: 'T_Identificacion', type: 'VARCHAR(10)', isPk: false }
                ]
            },
            {
                name: 'DOCENTE',
                columns: [
                    { name: 'Id_Docente', type: 'INT', isPk: true, constraint: 'PK' },
                    { name: 'Nombre_Docent', type: 'VARCHAR(50)', isPk: false },
                    { name: 'P_Apellido', type: 'VARCHAR(50)', isPk: false },
                    { name: 'S_Apellido', type: 'VARCHAR(50)', isPk: false },
                    { name: 'Materias', type: 'VARCHAR(60)', isPk: false }
                ]
            },
            {
                name: 'DOCENTE_POR_ESTUDIANTE',
                columns: [
                    { name: 'Id_Docente', type: 'INT', isPk: false, isFk: true, references: 'DOCENTE(Id_Docente)' },
                    { name: 'Id_Estudiante', type: 'INT', isPk: false, isFk: true, references: 'ESTUDIANTE(Id_Estudiante)' },
                    { name: 'Materias', type: 'VARCHAR(60)', isPk: false },
                    { name: 'Aula', type: 'VARCHAR(20)', isPk: false }
                ]
            }
        ],
        relationships: [
            { id: 'rel-docente-de', fromTable: 'DOCENTE', fromCol: 'Id_Docente', toTable: 'DOCENTE_POR_ESTUDIANTE', toCol: 'Id_Docente', type: '1:N', label: 'asigna' },
            { id: 'rel-estudiante-de', fromTable: 'ESTUDIANTE', fromCol: 'Id_Estudiante', toTable: 'DOCENTE_POR_ESTUDIANTE', toCol: 'Id_Estudiante', type: '1:N', label: 'inscribe' }
        ]
    },
    '3fn': {
        title: '3FN — Esquema Relacional Normalizado: alumnos — carreras — cursos — alumno_curso',
        cardinality: '3FN',
        description: 'Tercera Forma Normal óptima: eliminación completa de dependencias transitivas con claves foráneas.',
        tables: [
            {
                name: 'alumnos',
                columns: [
                    { name: 'matricula', type: 'INT', isPk: true, constraint: 'PK' },
                    { name: 'nombre', type: 'VARCHAR(50)', isPk: false },
                    { name: 'dirección', type: 'VARCHAR(100)', isPk: false },
                    { name: 'telefono', type: 'VARCHAR(15)', isPk: false },
                    { name: 'id_carrera', type: 'VARCHAR(10)', isPk: false, isFk: true, references: 'carreras(id_carrera)' }
                ]
            },
            {
                name: 'carreras',
                columns: [
                    { name: 'id_carrera', type: 'VARCHAR(10)', isPk: true, constraint: 'PK' },
                    { name: 'carrera', type: 'VARCHAR(80)', isPk: false }
                ]
            },
            {
                name: 'cursos',
                columns: [
                    { name: 'código', type: 'VARCHAR(10)', isPk: true, constraint: 'PK' },
                    { name: 'curso', type: 'VARCHAR(60)', isPk: false }
                ]
            },
            {
                name: 'alumno_curso',
                columns: [
                    { name: 'matricula', type: 'INT', isPk: false, isFk: true, references: 'alumnos(matricula)' },
                    { name: 'código', type: 'VARCHAR(10)', isPk: false, isFk: true, references: 'cursos(código)' }
                ]
            }
        ],
        relationships: [
            { id: 'rel-carreras-alumnos', fromTable: 'carreras', fromCol: 'id_carrera', toTable: 'alumnos', toCol: 'id_carrera', type: '1:N', label: 'pertenece' },
            { id: 'rel-alumnos-ac', fromTable: 'alumnos', fromCol: 'matricula', toTable: 'alumno_curso', toCol: 'matricula', type: '1:N', label: 'inscribe' },
            { id: 'rel-cursos-ac', fromTable: 'cursos', fromCol: 'código', toTable: 'alumno_curso', toCol: 'código', type: '1:N', label: 'cursa' }
        ]
    }
};

/* ── Subcomponente: Vista de Normalización Pedagógica ─────────── */
function NormalizationView({ currentPhase, onSelectPhase }) {
    const PHASES = [
        { id: 'all', label: 'Todas las Fases (Comparativa)' },
        { id: '0fn', label: '0FN (No Normalizada)' },
        { id: '1fn', label: '1FN (Atomicidad)' },
        { id: '2fn', label: '2FN (Dep. Parciales)' },
        { id: '3fn', label: '3FN (Dep. Transitivas)' }
    ];

    const phasesToRender = currentPhase === 'all' ? ['0fn', '1fn', '2fn', '3fn'] : [currentPhase];

    return (
        <div className="norm-container">
            {/* Selector de Fase */}
            <div className="norm-phase-nav">
                <span className="norm-phase-label">Fase de Normalización:</span>
                <div className="norm-phase-buttons">
                    {PHASES.map(p => (
                        <button
                            key={p.id}
                            className={`norm-phase-btn ${currentPhase === p.id ? 'active' : ''}`}
                            onClick={() => onSelectPhase(p.id)}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Contenido de Fases */}
            <div className="norm-content-scroll">
                {phasesToRender.map(key => {
                    const data = NORMALIZATION_DATA[key];
                    if (!data) return null;

                    return (
                        <div key={key} className="norm-phase-card">
                            <div className="norm-phase-header">
                                <div className="norm-header-badge-row">
                                    <span className="norm-phase-badge" style={{ borderColor: data.badgeColor, color: data.badgeColor }}>
                                        {data.badge}
                                    </span>
                                    <h4 className="norm-phase-title">{data.title}</h4>
                                </div>
                                <p className="norm-rule-text"><strong>Regla:</strong> {data.rule}</p>
                                {data.anomaly && (
                                    <p className="norm-anomaly-text"><strong>Diagnóstico:</strong> {data.anomaly}</p>
                                )}
                            </div>

                            <div className="norm-tables-grid">
                                {data.tables.map((table, tIdx) => (
                                    <div key={tIdx} className="norm-table-wrapper">
                                        <div className="norm-table-title-bar">
                                            <span className="norm-table-name">{table.name}</span>
                                            {table.description && (
                                                <span className="norm-table-desc">{table.description}</span>
                                            )}
                                        </div>

                                        <div className="norm-table-scroll">
                                            <table className="norm-table">
                                                <thead>
                                                    <tr>
                                                        {table.columns.map((col, cIdx) => {
                                                            const isPk = table.pkIndex === cIdx || col.includes('(PK)');
                                                            const isFk = table.fkIndices?.includes(cIdx) || col.includes('(FK)');
                                                            return (
                                                                <th key={cIdx} className={isPk ? 'th-pk' : isFk ? 'th-fk' : ''}>
                                                                    <span>{col}</span>
                                                                    {isPk && <span className="norm-key-badge pk">PK</span>}
                                                                    {isFk && <span className="norm-key-badge fk">FK</span>}
                                                                </th>
                                                            );
                                                        })}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {table.rows.map((row, rIdx) => (
                                                        <tr key={rIdx}>
                                                            {row.map((cell, cIdx) => (
                                                                <td key={cIdx}>{cell}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ── Componente Principal: LiveExamplePanel ─────────────────────── */
export default function LiveExamplePanel({ example, onClose }) {
    const isNorm = example?.defaultTab === 'normalization' || example?.title?.toLowerCase().includes('normaliz');
    const [normPhase, setNormPhase] = useState('3fn');
    const [activeTab, setActiveTab] = useState(example?.defaultTab || 'canvas');

    const normalized = useMemo(() => {
        if (isNorm) {
            const key = normPhase === 'all' ? '3fn' : normPhase;
            const schema = NORMALIZATION_SCHEMAS[key] || NORMALIZATION_SCHEMAS['3fn'];
            const tables = schema.tables.map(t => ({
                name: t.name,
                columns: t.columns.map(c => ({
                    name: c.name,
                    type: c.type,
                    isPk: !!c.isPk,
                    isFk: !!c.isFk,
                    constraint: c.isPk ? 'PK' : c.isFk ? 'FK' : null,
                    references: c.references || null
                }))
            }));
            return {
                _isErDiagram: true,
                title: schema.title,
                description: schema.description,
                cardinality: schema.cardinality,
                mermaid_code: generateCleanMermaid(tables, schema.relationships),
                tables,
                relationships: schema.relationships,
                sql: null
            };
        }
        return normalizeExample(example);
    }, [isNorm, normPhase, example]);

    const [panelWidth, setPanelWidth] = useState(780);
    const [zoom, setZoom] = useState(1.0);
    const [positions, setPositions] = useState({});
    const [draggingTable, setDraggingTable] = useState(null);
    const [selectedTable, setSelectedTable] = useState(null);
    const [activeRelationship, setActiveRelationship] = useState(null);
    const [collapsedTables, setCollapsedTables] = useState({});
    const [copied, setCopied] = useState(false);

    const canvasRef = useRef(null);
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
    const isResizing = useRef(false);

    // Derivar relaciones automáticas de claves foráneas
    const relationships = useMemo(() => {
        if (!normalized?.tables) return [];
        if (normalized.relationships && normalized.relationships.length > 0) {
            return normalized.relationships;
        }

        const list = [];
        const tables = normalized.tables;

        tables.forEach((table) => {
            table.columns.forEach((col) => {
                let targetTable = null;
                let targetCol = null;

                if (col.references) {
                    const match = col.references.match(/^(\w+)(?:\((\w+)\))?/);
                    if (match) {
                        targetTable = tables.find(t => t.name.toLowerCase() === match[1].toLowerCase())?.name || match[1];
                        targetCol = match[2] || `id_${targetTable.toLowerCase()}`;
                    }
                } else if (col.isFk || col.name.startsWith('id_')) {
                    const candidateName = col.name.replace(/^id_/, '');
                    const found = tables.find(t =>
                        t.name.toLowerCase() === candidateName.toLowerCase() ||
                        t.name.toLowerCase() === `${candidateName}s`.toLowerCase() ||
                        t.name.toLowerCase() === `${candidateName}es`.toLowerCase()
                    );
                    if (found && found.name !== table.name) {
                        targetTable = found.name;
                        targetCol = found.columns.find(c => c.isPk)?.name || `id_${found.name.toLowerCase()}`;
                    }
                }

                if (targetTable && targetTable !== table.name) {
                    const alreadyExists = list.some(r =>
                        (r.fromTable === targetTable && r.toTable === table.name) ||
                        (r.fromTable === table.name && r.toTable === targetTable)
                    );
                    if (!alreadyExists) {
                        list.push({
                            id: `rel-${targetTable}-${table.name}`,
                            fromTable: targetTable, // Tabla Principal (1)
                            fromCol: targetCol || 'id',
                            toTable: table.name,    // Tabla Foránea (N)
                            toCol: col.name,
                            type: '1:N',
                            label: 'relaciona'
                        });
                    }
                }
            });
        });

        if (list.length === 0 && tables.length >= 2) {
            for (let i = 0; i < tables.length - 1; i++) {
                list.push({
                    id: `rel-${tables[i].name}-${tables[i+1].name}`,
                    fromTable: tables[i].name,
                    fromCol: tables[i].columns[0]?.name || 'id',
                    toTable: tables[i+1].name,
                    toCol: tables[i+1].columns.find(c => c.isFk)?.name || tables[i+1].columns[0]?.name || 'id',
                    type: '1:N',
                    label: 'relaciona'
                });
            }
        }

        return list;
    }, [normalized]);

    // Auto-organizar posiciones en el tablero
    const autoArrangePositions = useCallback(() => {
        if (!normalized?.tables || normalized.tables.length === 0) return;
        const tables = normalized.tables;
        const count = tables.length;
        const newPos = {};

        if (isNorm && (normPhase === '3fn' || normPhase === 'all')) {
            newPos['carreras'] = { x: 40, y: 50 };
            newPos['alumnos'] = { x: 40, y: 240 };
            newPos['cursos'] = { x: 380, y: 50 };
            newPos['alumno_curso'] = { x: 380, y: 240 };
        } else if (isNorm && normPhase === '2fn') {
            newPos['ESTUDIANTE'] = { x: 40, y: 60 };
            newPos['DOCENTE'] = { x: 380, y: 60 };
            newPos['DOCENTE_POR_ESTUDIANTE'] = { x: 210, y: 260 };
        } else if (count === 1) {
            newPos[tables[0].name] = { x: 180, y: 80 };
        } else if (count === 2) {
            newPos[tables[0].name] = { x: 60, y: 80 };
            newPos[tables[1].name] = { x: 380, y: 80 };
        } else if (count === 3) {
            newPos[tables[0].name] = { x: 220, y: 40 };
            newPos[tables[1].name] = { x: 60, y: 260 };
            newPos[tables[2].name] = { x: 380, y: 260 };
        } else {
            const cols = 2;
            const gapX = 320;
            const gapY = 240;
            tables.forEach((t, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                newPos[t.name] = {
                    x: 40 + col * gapX,
                    y: 40 + row * gapY
                };
            });
        }
        setPositions(newPos);
        setZoom(1.0);
    }, [normalized, isNorm, normPhase]);

    useEffect(() => {
        autoArrangePositions();
        setSelectedTable(null);
        setActiveRelationship(null);
    }, [example, normPhase, autoArrangePositions]);

    // Manejo de Arrastre con Mouse
    const handleMouseDown = useCallback((e, tableName) => {
        e.preventDefault();
        e.stopPropagation();
        const currentPos = positions[tableName] || { x: 0, y: 0 };
        dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            posX: currentPos.x,
            posY: currentPos.y
        };
        setDraggingTable(tableName);
        setSelectedTable(tableName);
    }, [positions]);

    // Manejo de Arrastre Touch (móvil)
    const handleTouchStart = useCallback((e, tableName) => {
        if (e.touches && e.touches[0]) {
            const touch = e.touches[0];
            const currentPos = positions[tableName] || { x: 0, y: 0 };
            dragStartRef.current = {
                mouseX: touch.clientX,
                mouseY: touch.clientY,
                posX: currentPos.x,
                posY: currentPos.y
            };
            setDraggingTable(tableName);
            setSelectedTable(tableName);
        }
    }, [positions]);

    useEffect(() => {
        if (!draggingTable) return;

        const handleMouseMove = (e) => {
            const dx = (e.clientX - dragStartRef.current.mouseX) / zoom;
            const dy = (e.clientY - dragStartRef.current.mouseY) / zoom;
            setPositions(prev => ({
                ...prev,
                [draggingTable]: {
                    x: Math.max(10, Math.round(dragStartRef.current.posX + dx)),
                    y: Math.max(10, Math.round(dragStartRef.current.posY + dy))
                }
            }));
        };

        const handleTouchMove = (e) => {
            if (e.touches && e.touches[0]) {
                const touch = e.touches[0];
                const dx = (touch.clientX - dragStartRef.current.mouseX) / zoom;
                const dy = (touch.clientY - dragStartRef.current.mouseY) / zoom;
                setPositions(prev => ({
                    ...prev,
                    [draggingTable]: {
                        x: Math.max(10, Math.round(dragStartRef.current.posX + dx)),
                        y: Math.max(10, Math.round(dragStartRef.current.posY + dy))
                    }
                }));
            }
        };

        const handleEnd = () => setDraggingTable(null);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleEnd);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [draggingTable, zoom]);

    // Redimensionar panel lateral
    const startResize = useCallback((e) => {
        e.preventDefault();
        isResizing.current = true;
        const startX = e.clientX;
        const startW = panelWidth;
        const onMove = (ev) => {
            if (!isResizing.current) return;
            setPanelWidth(Math.max(420, Math.min(1300, startW - (ev.clientX - startX))));
        };
        const onUp = () => {
            isResizing.current = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [panelWidth]);

    const handleCanvasWheel = useCallback((e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom(prev => Math.min(1.8, Math.max(0.4, prev - e.deltaY * 0.0015)));
        }
    }, []);

    // Coordenadas de los puertos para líneas SVG
    const calculatePorts = useCallback((fromTableName, toTableName) => {
        const fromPos = positions[fromTableName];
        const toPos = positions[toTableName];
        if (!fromPos || !toPos) return null;

        const cardWidth = 270;
        const headerHeight = 65;
        const rowHeight = 32;

        const fromIsLeftOfTo = fromPos.x + cardWidth < toPos.x;
        const fromIsRightOfTo = fromPos.x > toPos.x + cardWidth;

        let startX, endX;
        if (fromIsLeftOfTo) {
            startX = fromPos.x + cardWidth;
            endX = toPos.x;
        } else if (fromIsRightOfTo) {
            startX = fromPos.x;
            endX = toPos.x + cardWidth;
        } else {
            startX = fromPos.x + cardWidth / 2;
            endX = toPos.x + cardWidth / 2;
        }

        const startY = fromPos.y + headerHeight + rowHeight * 0.5;
        const endY = toPos.y + headerHeight + rowHeight * 1.2;

        return { startX, startY, endX, endY };
    }, [positions]);

    const handleCopyCode = () => {
        let code = '';
        if (activeTab === 'mermaid') {
            code = normalized.mermaid_code || '';
        } else {
            const lines = [];
            normalized.tables.forEach(t => {
                lines.push(`CREATE TABLE ${t.name} (`);
                const colDefs = t.columns.map(c => {
                    let def = `    ${c.name} ${c.type}`;
                    if (c.isPk) def += ' PRIMARY KEY';
                    return def;
                });
                lines.push(colDefs.join(',\n'));
                lines.push(');');
                lines.push('');
            });
            relationships.forEach(r => {
                lines.push(`ALTER TABLE ${r.toTable} ADD CONSTRAINT fk_${r.toTable}_${r.fromTable}`);
                lines.push(`    FOREIGN KEY (${r.toCol}) REFERENCES ${r.fromTable}(${r.fromCol});`);
                lines.push('');
            });
            code = lines.join('\n');
        }

        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleColumnClick = (tableName, col) => {
        setSelectedTable(tableName);
        const related = relationships.find(r =>
            (r.fromTable === tableName && r.fromCol === col.name) ||
            (r.toTable === tableName && r.toCol === col.name)
        );
        setActiveRelationship(related || null);
    };

    if (!normalized) return null;

    return (
        <aside
            className="er-workbench-panel"
            style={{ width: `${panelWidth}px` }}
        >
            {/* Barra de redimensionamiento izquierda */}
            <div className="er-panel-resizer" onMouseDown={startResize} title="Arrastrar para redimensionar" />

            {/* Cabecera del Panel */}
            <div className="er-panel-header">
                <div className="er-panel-header-info">
                    <div className="er-panel-title-row">
                        <span className="er-panel-kicker">Tablero de Modelado</span>
                        <span className="er-cardinality-badge">{normalized.cardinality || '1:N'}</span>
                    </div>
                    <h3 className="er-panel-title">{normalized.title}</h3>
                    <p className="er-panel-desc">{normalized.description}</p>
                </div>

                <div className="er-panel-actions">
                    <button className="er-icon-button" onClick={onClose} title="Cerrar panel">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Pestañas de Vista */}
            <div className="er-panel-nav">
                <div className="er-nav-tabs">
                    <button
                        className={`er-nav-tab ${activeTab === 'canvas' ? 'active' : ''}`}
                        onClick={() => setActiveTab('canvas')}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                            <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                        </svg>
                        <span>Tablero E-R</span>
                    </button>

                    <button
                        className={`er-nav-tab ${activeTab === 'normalization' ? 'active' : ''}`}
                        onClick={() => setActiveTab('normalization')}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18"/>
                        </svg>
                        <span>Normalización</span>
                    </button>

                    <button
                        className={`er-nav-tab ${activeTab === 'mermaid' ? 'active' : ''}`}
                        onClick={() => setActiveTab('mermaid')}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                        <span>Conceptual</span>
                    </button>

                    <button
                        className={`er-nav-tab ${activeTab === 'sql' ? 'active' : ''}`}
                        onClick={() => setActiveTab('sql')}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="16 18 22 12 16 6"/>
                            <polyline points="8 6 2 12 8 18"/>
                        </svg>
                        <span>Script SQL</span>
                    </button>
                </div>

                {/* Controles de barra de herramientas en modo Tablero */}
                {activeTab === 'canvas' && (
                    <div className="er-toolbar-controls">
                        <button
                            className="er-tool-btn"
                            onClick={() => setZoom(z => Math.min(1.8, Math.round((z + 0.15) * 100) / 100))}
                            title="Aumentar zoom"
                        >
                            +
                        </button>
                        <span className="er-zoom-indicator">{Math.round(zoom * 100)}%</span>
                        <button
                            className="er-tool-btn"
                            onClick={() => setZoom(z => Math.max(0.4, Math.round((z - 0.15) * 100) / 100))}
                            title="Reducir zoom"
                        >
                            -
                        </button>
                        <button
                            className="er-tool-btn er-tool-action"
                            onClick={autoArrangePositions}
                            title="Auto-organizar entidades en el tablero"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                            </svg>
                            <span>Organizar</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Contenido Principal */}
            <div className="er-panel-body">
                {/* ── MODO 1: TABLERO INTERACTIVO E-R ──────────────────────── */}
                {activeTab === 'canvas' && (
                    <div className="er-canvas-container" ref={canvasRef} onWheel={handleCanvasWheel}>
                        {/* Selector rápido móvil de entidades */}
                        <div className="er-mobile-entity-selector">
                            <span className="er-sel-label">Enfocar:</span>
                            <select
                                className="er-entity-dropdown"
                                value={selectedTable || ''}
                                onChange={(e) => setSelectedTable(e.target.value)}
                            >
                                <option value="">Todas las entidades ({normalized.tables.length})</option>
                                {normalized.tables.map(t => (
                                    <option key={t.name} value={t.name}>{t.name} ({t.columns.length} cols)</option>
                                ))}
                            </select>
                        </div>

                        {/* Lienzo con Rejilla Técnica */}
                        <div
                            className="er-canvas-stage"
                            style={{
                                transform: `scale(${zoom})`,
                                transformOrigin: '0 0'
                            }}
                            onClick={() => { setSelectedTable(null); setActiveRelationship(null); }}
                        >
                            {/* Capa SVG de Conexiones Relacionales */}
                            <svg className="er-connections-layer">
                                {relationships.map((rel) => {
                                    const coords = calculatePorts(rel.fromTable, rel.toTable);
                                    if (!coords) return null;

                                    const isRelActive = activeRelationship?.id === rel.id ||
                                        selectedTable === rel.fromTable ||
                                        selectedTable === rel.toTable;

                                    const { startX, startY, endX, endY } = coords;
                                    const midX = (startX + endX) / 2;
                                    const midY = (startY + endY) / 2;

                                    const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

                                    return (
                                        <g
                                            key={rel.id}
                                            className={`er-relation-group ${isRelActive ? 'is-active-rel' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); setActiveRelationship(rel); }}
                                        >
                                            <path
                                                d={pathD}
                                                className="er-rel-path-base"
                                            />
                                            <path
                                                d={pathD}
                                                className="er-rel-path-highlight"
                                            />

                                            {/* Puntos terminales */}
                                            <circle cx={startX} cy={startY} r="4" className="er-rel-terminal" />
                                            <circle cx={endX} cy={endY} r="4" className="er-rel-terminal" />

                                            {/* Pastilla Central de Cardinalidad */}
                                            <g transform={`translate(${midX}, ${midY})`} className="er-cardinality-pill">
                                                <rect
                                                    x="-20"
                                                    y="-10"
                                                    width="40"
                                                    height="20"
                                                    rx="5"
                                                    className="er-cardinality-rect"
                                                />
                                                <text
                                                    x="0"
                                                    y="4"
                                                    textAnchor="middle"
                                                    className="er-cardinality-text"
                                                >
                                                    {rel.type || '1:N'}
                                                </text>
                                            </g>
                                        </g>
                                    );
                                })}
                            </svg>

                            {/* Tarjetas de Tablas Interactivas */}
                            {normalized.tables.map((table) => {
                                const pos = positions[table.name] || { x: 40, y: 40 };
                                const isTableSelected = selectedTable === table.name;
                                const isConnectedToActive = activeRelationship && (
                                    activeRelationship.fromTable === table.name ||
                                    activeRelationship.toTable === table.name
                                );

                                return (
                                    <TableEntityCard
                                        key={table.name}
                                        table={table}
                                        pos={pos}
                                        onMouseDown={handleMouseDown}
                                        onTouchStart={handleTouchStart}
                                        isDragging={draggingTable === table.name}
                                        isSelected={isTableSelected}
                                        onSelect={(name) => setSelectedTable(name)}
                                        activeHighlight={isTableSelected || isConnectedToActive}
                                        onColumnClick={handleColumnClick}
                                        isCollapsed={!!collapsedTables[table.name]}
                                        onToggleCollapse={(name) => setCollapsedTables(prev => ({ ...prev, [name]: !prev[name] }))}
                                    />
                                );
                            })}
                        </div>

                        {/* Banner Informativo de Relación Activa */}
                        {activeRelationship && (
                            <div className="er-active-rel-banner">
                                <div className="er-rel-banner-content">
                                    <span className="er-rel-badge-pill">{activeRelationship.type}</span>
                                    <span className="er-rel-text">
                                        <strong>{activeRelationship.fromTable}</strong>.{activeRelationship.fromCol} (PK)
                                        {' -> '}
                                        <strong>{activeRelationship.toTable}</strong>.{activeRelationship.toCol} (FK)
                                    </span>
                                </div>
                                <button className="er-rel-close" onClick={() => setActiveRelationship(null)}>✕</button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── MODO 2: DIAGRAMA CONCEPTUAL (MERMAID) ────────────────── */}
                {activeTab === 'mermaid' && (
                    <div className="er-conceptual-tab">
                        {normalized.mermaid_code ? (
                            <MermaidDiagram code={normalized.mermaid_code} />
                        ) : (
                            <div className="er-empty-state">
                                No se generó código conceptual Mermaid para este esquema.
                            </div>
                        )}
                    </div>
                )}

                {/* ── MODO 3: SCRIPT SQL DDL ───────────────────────────────── */}
                {activeTab === 'sql' && (
                    <div className="er-sql-tab">
                        <div className="er-sql-topbar">
                            <span className="er-sql-heading">Definición de Tablas Relacionales (DDL)</span>
                            <button
                                className={`er-copy-btn ${copied ? 'copied' : ''}`}
                                onClick={handleCopyCode}
                            >
                                {copied ? 'Copiado al Portapapeles' : 'Copiar Script SQL'}
                            </button>
                        </div>
                        <div className="er-sql-code-wrapper">
                            <SyntaxHighlighter
                                language="sql"
                                style={oneDark}
                                customStyle={{
                                    margin: 0,
                                    padding: '1.2rem',
                                    background: '#09090b',
                                    borderRadius: '10px',
                                    border: '1px solid #27272a',
                                    fontSize: '0.84rem',
                                    fontFamily: 'JetBrains Mono, monospace'
                                }}
                            >
                                {normalized.tables.map(t => {
                                    const colDefs = t.columns.map(c => `    ${c.name} ${c.type}${c.isPk ? ' PRIMARY KEY' : ''}`);
                                    return `CREATE TABLE ${t.name} (\n${colDefs.join(',\n')}\n);`;
                                }).join('\n\n') + '\n\n' +
                                relationships.map(r => `ALTER TABLE ${r.toTable} ADD CONSTRAINT fk_${r.toTable}_${r.fromTable}\n    FOREIGN KEY (${r.toCol}) REFERENCES ${r.fromTable}(${r.fromCol});`).join('\n\n')}
                            </SyntaxHighlighter>
                        </div>
                    </div>
                )}

                {/* ── MODO 4: VISUALIZADOR PRÁCTICO DE NORMALIZACIÓN ───────── */}
                {activeTab === 'normalization' && (
                    <NormalizationView
                        currentPhase={normPhase}
                        onSelectPhase={(p) => setNormPhase(p)}
                    />
                )}
            </div>
        </aside>
    );
}
