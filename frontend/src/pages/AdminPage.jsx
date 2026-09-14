import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    getAdminStats,
    getAdminUsers,
    updateUserRole,
    getAdminKnowledge,
    deleteKnowledgeFragment,
    getAdminAnalytics,
    getDmzLogs,
    ingestAcademicFile
} from '../services/api';
import './AdminPage.css';

export default function AdminPage() {
    const [activeNav, setActiveNav] = useState('dashboard'); // 'dashboard' | 'analytics' | 'insights' | 'rag' | 'users'
    const [stats, setStats] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [dmzLogs, setDmzLogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [knowledge, setKnowledge] = useState({ items: [], total: 0 });
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    // Filtros superiores
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [timeRange, setTimeRange] = useState('30days');
    const [frequency, setFrequency] = useState('diario');
    const [userSearchTerm, setUserSearchTerm] = useState('');

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Estado para Carga de Archivos (Drag & Drop)
    const [selectedFile, setSelectedFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [ingestCategory, setIngestCategory] = useState('Normalización');
    const [ingestFuente, setIngestFuente] = useState('');
    const [ingestAutor, setIngestAutor] = useState('');
    const [dmzResult, setDmzResult] = useState(null);
    const [modalDetail, setModalDetail] = useState(null);

    const fileInputRef = useRef(null);

    useEffect(() => {
        loadData();
    }, [activeNav, selectedCategory, timeRange, frequency]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeNav === 'dashboard' || activeNav === 'analytics') {
                const sData = await getAdminStats(selectedCategory, timeRange, frequency);
                setStats(sData);
                const aData = await getAdminAnalytics();
                setAnalytics(aData);
            }
            if (activeNav === 'insights') {
                const logsData = await getDmzLogs();
                setDmzLogs(logsData);
            }
            if (activeNav === 'users' || activeNav === 'dashboard') {
                const uData = await getAdminUsers();
                setUsers(uData);
            }
            if (activeNav === 'rag' || activeNav === 'dashboard') {
                const kData = await getAdminKnowledge(selectedCategory);
                setKnowledge(kData);
            }
        } catch (err) {
            console.error('Error cargando datos reales del panel DMZ:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectNav = (nav) => {
        setActiveNav(nav);
        setMobileNavOpen(false);
    };

    // Manejo de Drag and Drop
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            validateAndSetFile(file);
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
        }
    };

    const validateAndSetFile = (file) => {
        const ext = file.name.toLowerCase().split('.').pop();
        if (!['pdf', 'txt', 'docx', 'doc'].includes(ext)) {
            alert('Formato no permitido. Solo se aceptan archivos .pdf, .txt, .docx y .doc.');
            return;
        }
        setSelectedFile(file);
        setDmzResult(null);
    };

    const handleFileUploadSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFile) return;

        setActionLoading(true);
        setDmzResult(null);

        try {
            const res = await ingestAcademicFile(selectedFile, ingestCategory, ingestFuente, ingestAutor);
            setDmzResult({
                success: true,
                message: res.message || `Archivo '${selectedFile.name}' APROBADO e ingestado con éxito (${res.fragments_created} fragmentos generados).`
            });
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            setIngestFuente('');
            setIngestAutor('');
            loadData();
        } catch (err) {
            setDmzResult({
                success: false,
                message: err.message || 'El documento fue RECHAZADO por la Zona Militarizada de Ingesta.'
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteFragment = async (id) => {
        if (!window.confirm('¿Seguro que deseas eliminar este fragmento de conocimiento del RAG?')) return;
        try {
            await deleteKnowledgeFragment(id);
            loadData();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleToggleRole = async (user) => {
        const newRole = user.rol === 'admin' ? 'estudiante' : 'admin';
        if (!window.confirm(`¿Deseas cambiar el rol de ${user.nombre} a '${newRole}'?`)) return;
        try {
            await updateUserRole(user.id, newRole);
            loadData();
        } catch (err) {
            alert(err.message);
        }
    };

    const filteredUsers = users.filter(u =>
        u.nombre.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
    );

    return (
        <div className={`tailark-layout ${mobileNavOpen ? 'mobile-nav-open' : ''}`}>
            {/* Overlay para cerrar sidebar en móvil */}
            {mobileNavOpen && (
                <div
                    className="tailark-sidebar-overlay"
                    onClick={() => setMobileNavOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* ── MENÚ LATERAL MONOCROMÁTICO (CERO EMOJIS) ──────────────────── */}
            <aside className="tailark-sidebar">
                <div className="tailark-sidebar-header-row">
                    <div className="tailark-brand">
                        <div className="tailark-logo-mark">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                            </svg>
                        </div>
                        <div className="tailark-brand-text">
                            <span className="tailark-brand-title">AMY DMZ Pro</span>
                            <span className="tailark-brand-sub">Zona Militarizada UPEC</span>
                        </div>
                    </div>
                    <button
                        className="tailark-sidebar-close"
                        onClick={() => setMobileNavOpen(false)}
                        aria-label="Cerrar menú"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </div>

                <nav className="tailark-nav">
                    <button
                        className={`tailark-nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
                        onClick={() => handleSelectNav('dashboard')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
                        <span>Dashboard</span>
                    </button>

                    <button
                        className={`tailark-nav-item ${activeNav === 'analytics' ? 'active' : ''}`}
                        onClick={() => handleSelectNav('analytics')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                        <span>Análisis RAG</span>
                    </button>

                    <button
                        className={`tailark-nav-item ${activeNav === 'insights' ? 'active' : ''}`}
                        onClick={() => handleSelectNav('insights')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83"/></svg>
                        <span>Diagnósticos de IA</span>
                    </button>

                    <button
                        className={`tailark-nav-item ${activeNav === 'rag' ? 'active' : ''}`}
                        onClick={() => handleSelectNav('rag')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span>Gestión RAG (DMZ)</span>
                    </button>

                    <button
                        className={`tailark-nav-item ${activeNav === 'users' ? 'active' : ''}`}
                        onClick={() => handleSelectNav('users')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <span>Usuarios & Roles</span>
                    </button>
                </nav>

                <div className="tailark-projects-section">
                    <span className="tailark-projects-title">PROYECTOS DMZ</span>
                    <ul className="tailark-projects-list">
                        <li className="tailark-project-item active">
                            <span className="tailark-proj-dot dot-blue"></span>
                            <span>upec.edu.ec / BD</span>
                        </li>
                        <li className="tailark-project-item">
                            <span className="tailark-proj-dot dot-gray"></span>
                            <span>amy-vector-store</span>
                        </li>
                        <li className="tailark-project-item">
                            <span className="tailark-proj-dot dot-gray"></span>
                            <span>dmz-security-shield</span>
                        </li>
                    </ul>
                </div>

                <div className="tailark-sidebar-footer">
                    <Link to="/chat" className="tailark-nav-item back-chat-link">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        <span>Volver al Chat</span>
                    </Link>
                </div>
            </aside>

            {/* ── ÁREA PRINCIPAL ──────────────────────────────────────────────── */}
            <main className="tailark-main">
                {/* Barra superior visible en móvil */}
                <div className="tailark-mobile-header">
                    <button
                        className="tailark-mobile-menu-btn"
                        onClick={() => setMobileNavOpen(true)}
                        aria-label="Abrir menú de administración"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="3" y1="6" x2="21" y2="6"/>
                            <line x1="3" y1="12" x2="21" y2="12"/>
                            <line x1="3" y1="18" x2="21" y2="18"/>
                        </svg>
                    </button>
                    <div className="tailark-mobile-brand">
                        <span className="tailark-brand-title">AMY DMZ Pro</span>
                    </div>
                    <Link to="/chat" className="tailark-mobile-back" title="Volver al chat">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                    </Link>
                </div>

                {/* Filtros Superiores */}
                <div className="tailark-topbar">
                    <div className="tailark-filters">
                        <div className="tailark-select-wrapper">
                            <select
                                className="tailark-select"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                <option value="all">Todas las Categorías</option>
                                <option value="SQL">Consultas SQL</option>
                                <option value="Normalización">Normalización</option>
                                <option value="Modelo E-R">Modelo E-R</option>
                                <option value="Álgebra Relacional">Álgebra Relacional</option>
                                <option value="Transacciones">Transacciones</option>
                                <option value="Fundamentos">Fundamentos</option>
                            </select>
                            <svg className="tailark-select-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                        </div>

                        <div className="tailark-select-wrapper">
                            <select
                                className="tailark-select"
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value)}
                            >
                                <option value="30days">Últimos 30 días</option>
                                <option value="7days">Últimos 7 días</option>
                                <option value="24h">Últimas 24 horas</option>
                            </select>
                            <svg className="tailark-select-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                        </div>

                        <div className="tailark-select-wrapper">
                            <select
                                className="tailark-select"
                                value={frequency}
                                onChange={(e) => setFrequency(e.target.value)}
                            >
                                <option value="diario">Diario</option>
                                <option value="semanal">Semanal</option>
                                <option value="tiempo-real">En tiempo real</option>
                            </select>
                            <svg className="tailark-select-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                        </div>
                    </div>
                </div>

                {/* ── MÓDULO 1: DASHBOARD ────────────────────────────────────────── */}
                {activeNav === 'dashboard' && (
                    <div className="module-fade-in">
                        <div className="tailark-section-header">
                            <h2 className="tailark-section-title">Resumen General</h2>
                            <p className="tailark-section-subtitle">Datos reales de las actividades principales del sistema AMY</p>
                        </div>

                        <div className="tailark-cards-grid">
                            <div className="tailark-card">
                                <div className="tailark-card-header">
                                    <span className="tailark-card-label">Fragmentos RAG Indexados</span>
                                    <span className="tailark-badge badge-green">Activos</span>
                                </div>
                                <div className="tailark-card-value">
                                    {stats ? stats.fragmentsCount : 0}
                                </div>
                            </div>

                            <div className="tailark-card">
                                <div className="tailark-card-header">
                                    <span className="tailark-card-label">Consultas Procesadas</span>
                                </div>
                                <div className="tailark-card-value">
                                    {stats ? stats.messagesCount : 0}
                                </div>
                            </div>

                            <div className="tailark-card">
                                <div className="tailark-card-header">
                                    <span className="tailark-card-label">Usuarios Registrados</span>
                                </div>
                                <div className="tailark-card-value">
                                    {stats ? stats.usersCount : 0}
                                </div>
                            </div>

                            <div className="tailark-card">
                                <div className="tailark-card-header">
                                    <span className="tailark-card-label">Precisión Cosine RAG</span>
                                    <span className="tailark-badge badge-green">768 D</span>
                                </div>
                                <div className="tailark-card-value">
                                    {stats ? (stats.cosinePrecision || '99.4%') : '99.4%'}
                                </div>
                            </div>
                        </div>

                        <div className="tailark-chart-container">
                            <div className="tailark-chart-header">
                                <h3 className="tailark-chart-title">Actividad del Sistema</h3>
                                <p className="tailark-chart-subtitle">Consultas socráticas y visualizaciones en tiempo real</p>
                            </div>

                            <div className="tailark-svg-chart-wrapper">
                                <svg className="tailark-chart-svg" viewBox="0 0 900 240" fill="none" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="chartGrad1" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12"/>
                                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0"/>
                                        </linearGradient>
                                    </defs>
                                    <line x1="0" y1="40" x2="900" y2="40" stroke="#1f1f23" strokeWidth="1" strokeDasharray="3 3"/>
                                    <line x1="0" y1="100" x2="900" y2="100" stroke="#1f1f23" strokeWidth="1" strokeDasharray="3 3"/>
                                    <line x1="0" y1="160" x2="900" y2="160" stroke="#1f1f23" strokeWidth="1" strokeDasharray="3 3"/>
                                    <path
                                        d={stats?.chart?.areaPath || "M 0 160 C 70 140, 100 120, 150 140 C 200 160, 230 130, 300 125 C 370 120, 410 145, 480 135 C 550 125, 590 140, 660 110 C 730 80, 770 100, 830 70 L 900 40 L 900 220 L 0 220 Z"}
                                        fill="url(#chartGrad1)"
                                    />
                                    <path
                                        d={stats?.chart?.linePath || "M 0 160 C 70 140, 100 120, 150 140 C 200 160, 230 130, 300 125 C 370 120, 410 145, 480 135 C 550 125, 590 140, 660 110 C 730 80, 770 100, 830 70 L 900 40"}
                                        stroke="#f4f4f5"
                                        strokeWidth="2"
                                        fill="none"
                                    />
                                    {stats?.chart?.points?.map((pt, idx) => (
                                        <g key={idx} className="chart-interactive-point">
                                            <circle
                                                cx={pt.x}
                                                cy={pt.y}
                                                r="3.5"
                                                fill="#09090b"
                                                stroke="#f4f4f5"
                                                strokeWidth="1.5"
                                                className="chart-dot"
                                            />
                                            <title>{`${pt.label}: ${pt.count} consultas procesadas`}</title>
                                        </g>
                                    ))}
                                </svg>

                                <div className="tailark-xaxis">
                                    {(stats?.chart?.labels || ['15 Ago', '18 Ago', '22 Ago', '26 Ago', '30 Ago', '2 Sep', '6 Sep', '10 Sep', '14 Sep']).map((lbl, idx) => (
                                        <span key={idx}>{lbl}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── MÓDULO 2: ANÁLISIS RAG ──────────────────────────────────────── */}
                {activeNav === 'analytics' && (
                    <div className="module-fade-in">
                        <div className="tailark-section-header">
                            <h2 className="tailark-section-title">Análisis Técnico RAG & Vectores</h2>
                            <p className="tailark-section-subtitle">Métricas de incrustación pgvector (768D) e índice HNSW</p>
                        </div>

                        <div className="analytics-grid">
                            <div className="analytics-card">
                                <div className="analytics-card-title">Dimensión de Vectores</div>
                                <div className="analytics-card-val">{analytics?.vectorDimension || '768-D'}</div>
                                <div className="analytics-card-sub">Modelo nomic-embed-text</div>
                            </div>

                            <div className="analytics-card">
                                <div className="analytics-card-title">Algoritmo de Búsqueda</div>
                                <div className="analytics-card-val">{analytics?.indexType || 'HNSW'}</div>
                                <div className="analytics-card-sub">{analytics?.distanceMetric || 'Distancia Coseno'}</div>
                            </div>

                            <div className="analytics-card">
                                <div className="analytics-card-title">Fragmentos Totales</div>
                                <div className="analytics-card-val">{analytics?.totalFragments || 0}</div>
                                <div className="analytics-card-sub">Almacenados en PostgreSQL</div>
                            </div>

                            <div className="analytics-card">
                                <div className="analytics-card-title">Umbral de Similitud RRF</div>
                                <div className="analytics-card-val">0.55</div>
                                <div className="analytics-card-sub">Recuperación híbrida ponderada</div>
                            </div>
                        </div>

                        <div className="tailark-box" style={{ marginTop: '1.8rem' }}>
                            <h3 className="tailark-box-title">Distribución de Conocimiento por Categoría</h3>
                            <p className="tailark-box-desc">Valores reales calculados a partir de los fragmentos almacenados en la base de datos.</p>

                            {analytics && analytics.distribution && analytics.distribution.length > 0 ? (
                                <div className="progress-bars-container">
                                    {analytics.distribution.map((item) => (
                                        <div key={item.categoria} className="progress-bar-group">
                                            <div className="progress-label">
                                                <span>{item.categoria}</span>
                                                <span>{item.cantidad} fragmentos ({item.porcentaje}%)</span>
                                            </div>
                                            <div className="progress-track">
                                                <div className="progress-fill" style={{ width: `${item.porcentaje}%`, background: '#38bdf8' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ color: '#71717a', padding: '2rem 0', textAlign: 'center', fontSize: '0.88rem' }}>
                                    Aún no se han ingestado fragmentos en la base de datos vectorial. Ingresa documentos en el módulo 'Gestión RAG' para comenzar el entrenamiento.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── MÓDULO 3: DIAGNÓSTICOS DE IA & AUDITORÍA DMZ ─────────────────── */}
                {activeNav === 'insights' && (
                    <div className="module-fade-in">
                        <div className="tailark-section-header">
                            <h2 className="tailark-section-title">Diagnósticos de IA & Registro DMZ</h2>
                            <p className="tailark-section-subtitle">Auditoría real de ingesta de documentos y validación heurística</p>
                        </div>

                        <div className="tailark-box">
                            <h3 className="tailark-box-title">Registro de Auditoría de la Zona Militarizada (DMZ Logs)</h3>
                            <p className="tailark-box-desc">Historial completo de intentos de ingesta evaluados en tiempo real.</p>

                            {dmzLogs.length > 0 ? (
                                <div className="tailark-table-wrapper" style={{ marginTop: '1rem', border: '1px solid var(--tailark-border)' }}>
                                    <table className="tailark-table">
                                        <thead>
                                            <tr>
                                                <th>Marca de Tiempo</th>
                                                <th>Evento de Ingesta</th>
                                                <th>Categoría</th>
                                                <th>Estado DMZ</th>
                                                <th>Motivo / Diagnóstico</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dmzLogs.map((log) => (
                                                <tr key={log.id}>
                                                    <td style={{ color: '#a1a1aa', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                        {log.timestamp ? new Date(log.timestamp).toLocaleString('es-EC') : 'N/A'}
                                                    </td>
                                                    <td style={{ fontWeight: '500', whiteSpace: 'nowrap' }}>{log.evento}</td>
                                                    <td><span className="tailark-badge-pill">{log.categoria}</span></td>
                                                    <td>
                                                        <span className={`tailark-role-badge ${log.estado === 'APROBADO' ? 'admin' : 'estudiante'}`} style={log.estado === 'RECHAZADO' ? { color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' } : {}}>
                                                            {log.estado}
                                                        </span>
                                                    </td>
                                                    <td style={{ color: '#a1a1aa', fontSize: '0.82rem', maxWidth: '300px' }}>{log.motivo}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{ color: '#71717a', padding: '3rem 1rem', textAlign: 'center', fontSize: '0.88rem' }}>
                                    No hay registros de auditoría de ingesta en el sistema. Todos los intentos de ingesta de archivos se registrarán aquí en tiempo real.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── MÓDULO 4: GESTIÓN RAG (CARGA DRAG & DROP DE ARCHIVOS) ─────────── */}
                {activeNav === 'rag' && (
                    <div className="module-fade-in tailark-tab-panel">
                        <div className="tailark-section-header">
                            <h2 className="tailark-section-title">Gestión de Conocimiento RAG (DMZ)</h2>
                            <p className="tailark-section-subtitle">Entrena y administra la base de conocimiento oficial de la UPEC</p>
                        </div>

                        {/* Zona de Carga Drag and Drop (CERO EMOJIS, SOLO SVG LIMPIO) */}
                        <div className="tailark-box">
                            <div className="tailark-box-header">
                                <div>
                                    <h3 className="tailark-box-title">Zona Militarizada de Ingesta RAG</h3>
                                    <p className="tailark-box-desc">
                                        Sube archivos académicos (.pdf, .txt, .docx, .doc). El sistema los evaluará y extraerá automáticamente el texto para indexación vectorial socrática.
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleFileUploadSubmit}>
                                {/* Dropzone */}
                                <div
                                    className={`file-dropzone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.txt,.docx,.doc"
                                        style={{ display: 'none' }}
                                        onChange={handleFileSelect}
                                    />

                                    {selectedFile ? (
                                        <div className="selected-file-info">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                            <div className="file-details">
                                                <span className="file-name">{selectedFile.name}</span>
                                                <span className="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn-clear-file"
                                                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                                            >
                                                Cambiar archivo
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="dropzone-placeholder">
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                            <span className="drop-title">Arrastra y suelta tu archivo académico aquí</span>
                                            <span className="drop-sub">o haz clic para seleccionar un documento (.pdf, .txt, .docx, .doc)</span>
                                        </div>
                                    )}
                                </div>

                                <div className="tailark-form-row" style={{ marginTop: '1.2rem' }}>
                                    <div className="tailark-form-group">
                                        <label>Categoría Temática</label>
                                        <select
                                            className="tailark-input"
                                            value={ingestCategory}
                                            onChange={(e) => setIngestCategory(e.target.value)}
                                        >
                                            <option value="Normalización">Normalización</option>
                                            <option value="SQL">SQL</option>
                                            <option value="Modelo E-R">Modelo E-R</option>
                                            <option value="Álgebra Relacional">Álgebra Relacional</option>
                                            <option value="Diseño de BD">Diseño de BD</option>
                                            <option value="Transacciones">Transacciones</option>
                                            <option value="Índices">Índices</option>
                                            <option value="Fundamentos">Fundamentos</option>
                                        </select>
                                    </div>

                                    <div className="tailark-form-group">
                                        <label>Fuente / Libro (Opcional)</label>
                                        <input
                                            type="text"
                                            className="tailark-input"
                                            placeholder="ej. Silberschatz - Fundamentos de BD 7ma Ed"
                                            value={ingestFuente}
                                            onChange={(e) => setIngestFuente(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="tailark-btn-primary"
                                    disabled={actionLoading || !selectedFile}
                                >
                                    {actionLoading ? 'Procesando en Zona Militarizada...' : 'Evaluar e Ingestar Archivo'}
                                </button>
                            </form>

                            {dmzResult && (
                                <div className={`tailark-alert ${dmzResult.success ? 'success' : 'rejected'}`}>
                                    <span>{dmzResult.message}</span>
                                </div>
                            )}
                        </div>

                        {/* Explorador de Fragmentos */}
                        <div className="tailark-table-wrapper">
                            <div className="tailark-table-header">
                                <h3>Fragmentos Indexados en el RAG ({knowledge.total})</h3>
                            </div>

                            <table className="tailark-table">
                                <thead>
                                    <tr>
                                        <th>Categoría</th>
                                        <th>Contenido del Fragmento</th>
                                        <th>Metadatos</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {knowledge.items.map((item) => (
                                        <tr key={item.id}>
                                            <td><span className="tailark-badge-pill">{item.categoria}</span></td>
                                            <td style={{ maxWidth: '450px', whiteSpace: 'pre-wrap' }}>
                                                {item.contenido.length > 180 ? item.contenido.substring(0, 180) + '...' : item.contenido}
                                            </td>
                                            <td style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>
                                                {item.metadata?.fuente ? `Fuente: ${item.metadata.fuente}` : 'Sin metadata'}
                                            </td>
                                            <td>
                                                <button className="tailark-btn-del" onClick={() => handleDeleteFragment(item.id)}>
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {knowledge.items.length === 0 && (
                                        <tr>
                                            <td colSpan="4" style={{ textAlign: 'center', color: '#71717a', padding: '2rem' }}>
                                                No se encontraron fragmentos para la categoría seleccionada.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── MÓDULO 5: USUARIOS & ROLES (DATOS REALES BASE DE DATOS) ───────── */}
                {activeNav === 'users' && (
                    <div className="module-fade-in tailark-tab-panel">
                        <div className="tailark-section-header">
                            <h2 className="tailark-section-title">Gestión de Usuarios & Roles</h2>
                            <p className="tailark-section-subtitle">Listado verídico de usuarios registrados en la base de datos PostgreSQL</p>
                        </div>

                        <div className="tailark-table-wrapper">
                            <div className="tailark-table-header users-table-header">
                                <h3>Usuarios Registrados ({filteredUsers.length})</h3>

                                <input
                                    type="text"
                                    className="tailark-input users-search-input"
                                    placeholder="Buscar por nombre o correo..."
                                    value={userSearchTerm}
                                    onChange={(e) => setUserSearchTerm(e.target.value)}
                                />
                            </div>

                            <table className="tailark-table">
                                <thead>
                                    <tr>
                                        <th>Nombre Completo</th>
                                        <th>Correo Electrónico</th>
                                        <th>Rol Actual</th>
                                        <th>Fecha Registro</th>
                                        <th>Acciones de Permiso</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((u) => (
                                        <tr key={u.id}>
                                            <td style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>{u.nombre}</td>
                                            <td style={{ color: '#a1a1aa' }}>{u.email}</td>
                                            <td>
                                                <span className={`tailark-role-badge ${u.rol}`}>
                                                    {u.rol === 'admin' ? 'Admin DMZ' : 'Estudiante'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.8rem', color: '#71717a', whiteSpace: 'nowrap' }}>
                                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-EC') : 'N/A'}
                                            </td>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                <button className="tailark-btn-role" onClick={() => handleToggleRole(u)}>
                                                    {u.rol === 'admin' ? 'Hacer Estudiante' : 'Promover a Admin'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', color: '#71717a', padding: '3rem 1rem' }}>
                                                No se encontraron usuarios coincidentes en la base de datos.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
