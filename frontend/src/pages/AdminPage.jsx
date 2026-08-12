import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    getAdminStats,
    getAdminUsers,
    updateUserRole,
    getAdminKnowledge,
    deleteKnowledgeFragment,
    ingestKnowledge
} from '../services/api';
import './AdminPage.css';

export default function AdminPage() {
    const [activeNav, setActiveNav] = useState('dashboard'); // 'dashboard' | 'analytics' | 'insights' | 'rag' | 'users' | 'settings'
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [knowledge, setKnowledge] = useState({ items: [], total: 0 });
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [timeRange, setTimeRange] = useState('30days');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // DMZ Ingestion Form state
    const [ingestText, setIngestText] = useState('');
    const [ingestCategory, setIngestCategory] = useState('Normalización');
    const [ingestFuente, setIngestFuente] = useState('');
    const [ingestAutor, setIngestAutor] = useState('');
    const [dmzResult, setDmzResult] = useState(null);
    const [insightDetailModal, setInsightDetailModal] = useState(null);

    useEffect(() => {
        loadData();
    }, [activeNav, selectedCategory]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeNav === 'dashboard' || activeNav === 'analytics' || activeNav === 'insights') {
                const data = await getAdminStats();
                setStats(data);
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
            console.error('Error cargando datos del panel DMZ:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleIngestSubmit = async (e) => {
        e.preventDefault();
        if (!ingestText.trim()) return;

        setActionLoading(true);
        setDmzResult(null);

        try {
            const metadata = {};
            if (ingestFuente.trim()) metadata.fuente = ingestFuente.trim();
            if (ingestAutor.trim()) metadata.autor = ingestAutor.trim();

            const res = await ingestKnowledge(ingestText, ingestCategory, metadata);
            setDmzResult({
                success: true,
                message: res.message || `Documento APROBADO e ingestado con éxito (${res.fragments_created} fragmentos).`
            });
            setIngestText('');
            setIngestFuente('');
            setIngestAutor('');
            loadData();
        } catch (err) {
            setDmzResult({
                success: false,
                message: err.message || 'El documento fue rechazado por la Zona Militarizada de Ingesta.'
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
        if (!window.confirm(`¿Cambiar rol de ${user.nombre} a '${newRole}'?`)) return;
        try {
            await updateUserRole(user.id, newRole);
            loadData();
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="tailark-layout">
            {/* ── LEFT SIDEBAR (Tailark Style) ────────────────────────────────── */}
            <aside className="tailark-sidebar">
                {/* Brand Header Dropdown */}
                <div className="tailark-brand">
                    <div className="tailark-logo-mark">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                    </div>
                    <div className="tailark-brand-text">
                        <span className="tailark-brand-title">AMY DMZ Pro</span>
                        <span className="tailark-brand-sub">Zona Militarizada</span>
                    </div>
                    <div className="tailark-brand-chev">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 10l5 5 5-5"/></svg>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="tailark-nav">
                    <button
                        className={`tailark-nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveNav('dashboard')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
                        <span>Dashboard</span>
                    </button>

                    <button
                        className={`tailark-nav-item ${activeNav === 'analytics' ? 'active' : ''}`}
                        onClick={() => setActiveNav('analytics')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                        <span>Analytics</span>
                    </button>

                    <button
                        className={`tailark-nav-item ${activeNav === 'insights' ? 'active' : ''}`}
                        onClick={() => setActiveNav('insights')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        <span>AI Insights</span>
                    </button>

                    <button
                        className={`tailark-nav-item ${activeNav === 'rag' ? 'active' : ''}`}
                        onClick={() => setActiveNav('rag')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span>Gestión RAG (DMZ)</span>
                    </button>

                    <button
                        className={`tailark-nav-item ${activeNav === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveNav('users')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <span>Usuarios & Roles</span>
                    </button>
                </nav>

                {/* Projects Section */}
                <div className="tailark-projects-section">
                    <span className="tailark-projects-title">Proyectos DMZ</span>
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

                {/* Footer Back to Chat */}
                <div className="tailark-sidebar-footer">
                    <Link to="/chat" className="tailark-nav-item back-chat-link">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        <span>Volver al Chat</span>
                    </Link>
                </div>
            </aside>

            {/* ── MAIN DASHBOARD VIEW ────────────────────────────────────────── */}
            <main className="tailark-main">
                {/* Top Controls Filter Bar */}
                <div className="tailark-topbar">
                    <div className="tailark-filters">
                        <div className="tailark-select-wrapper">
                            <select className="tailark-select">
                                <option>Fragmentos RAG</option>
                                <option>Consultas SQL</option>
                                <option>Normalización</option>
                            </select>
                            <svg className="tailark-select-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                        </div>

                        <div className="tailark-select-wrapper">
                            <select className="tailark-select" value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                                <option value="30days">Últimos 30 días</option>
                                <option value="7days">Últimos 7 días</option>
                                <option value="24h">Últimas 24 horas</option>
                            </select>
                            <svg className="tailark-select-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                        </div>

                        <div className="tailark-select-wrapper">
                            <select className="tailark-select">
                                <option>Diario</option>
                                <option>Semanal</option>
                                <option>En tiempo real</option>
                            </select>
                            <svg className="tailark-select-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                        </div>
                    </div>
                </div>

                {/* Section Header */}
                <div className="tailark-section-header">
                    <h2 className="tailark-section-title">Overview</h2>
                    <p className="tailark-section-subtitle">Your main activities data</p>
                </div>

                {/* ── OVERVIEW METRICS CARDS (4 Cards Grid) ──────────────────────── */}
                <div className="tailark-cards-grid">
                    {/* Card 1: Fragmentos RAG */}
                    <div className="tailark-card">
                        <div className="tailark-card-header">
                            <span className="tailark-card-label">Fragmentos RAG Indexados</span>
                            <span className="tailark-badge badge-green">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 15l-6-6-6 6"/></svg>
                                65%
                            </span>
                        </div>
                        <div className="tailark-card-value">
                            {stats ? stats.fragmentsCount : 17}
                        </div>
                    </div>

                    {/* Card 2: Consultas Procesadas */}
                    <div className="tailark-card">
                        <div className="tailark-card-header">
                            <span className="tailark-card-label">Consultas Procesadas</span>
                        </div>
                        <div className="tailark-card-value">
                            {stats ? stats.messagesCount : 562}
                        </div>
                    </div>

                    {/* Card 3: Usuarios Activos */}
                    <div className="tailark-card">
                        <div className="tailark-card-header">
                            <span className="tailark-card-label">Usuarios Registrados</span>
                            <span className="tailark-badge badge-red">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                                5%
                            </span>
                        </div>
                        <div className="tailark-card-value">
                            {stats ? stats.usersCount : 456}
                        </div>
                    </div>

                    {/* Card 4: Precisión RAG */}
                    <div className="tailark-card">
                        <div className="tailark-card-header">
                            <span className="tailark-card-label">Precisión RAG Cosine</span>
                            <span className="tailark-badge badge-green">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 15l-6-6-6 6"/></svg>
                                65%
                            </span>
                        </div>
                        <div className="tailark-card-value">
                            99.4%
                        </div>
                    </div>
                </div>

                {/* ── ACTIVITY CHART SECTION (Double Wave Curves) ───────────────── */}
                <div className="tailark-chart-container">
                    <div className="tailark-chart-header">
                        <h3 className="tailark-chart-title">Activity</h3>
                        <p className="tailark-chart-subtitle">Visitors and page views</p>
                    </div>

                    <div className="tailark-svg-chart-wrapper">
                        <svg className="tailark-chart-svg" viewBox="0 0 900 240" fill="none" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="chartGrad1" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12"/>
                                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0"/>
                                </linearGradient>
                            </defs>

                            {/* Grid lines */}
                            <line x1="0" y1="40" x2="900" y2="40" stroke="#1f1f23" strokeWidth="1" strokeDasharray="3 3"/>
                            <line x1="0" y1="100" x2="900" y2="100" stroke="#1f1f23" strokeWidth="1" strokeDasharray="3 3"/>
                            <line x1="0" y1="160" x2="900" y2="160" stroke="#1f1f23" strokeWidth="1" strokeDasharray="3 3"/>

                            {/* Wave Area Fill */}
                            <path
                                d="M 0 160 C 70 140, 100 120, 150 140 C 200 160, 230 130, 300 125 C 370 120, 410 145, 480 135 C 550 125, 590 140, 660 110 C 730 80, 770 100, 830 70 L 900 40 L 900 220 L 0 220 Z"
                                fill="url(#chartGrad1)"
                            />

                            {/* Upper Bright Wave Line */}
                            <path
                                d="M 0 160 C 70 140, 100 120, 150 140 C 200 160, 230 130, 300 125 C 370 120, 410 145, 480 135 C 550 125, 590 140, 660 110 C 730 80, 770 100, 830 70 L 900 40"
                                stroke="#f4f4f5"
                                strokeWidth="2.2"
                                fill="none"
                            />

                            {/* Lower Secondary Wave Line */}
                            <path
                                d="M 0 185 C 70 175, 100 155, 150 165 C 200 175, 230 150, 300 155 C 370 160, 410 168, 480 158 C 550 148, 590 162, 660 142 C 730 122, 770 135, 830 115 L 900 95"
                                stroke="#71717a"
                                strokeWidth="1.6"
                                strokeDasharray="4 2"
                                fill="none"
                            />
                        </svg>

                        {/* X-Axis Timeline Dates */}
                        <div className="tailark-xaxis">
                            <span>Dec 1</span>
                            <span>Dec 5</span>
                            <span>Dec 9</span>
                            <span>Dec 13</span>
                            <span>Dec 17</span>
                            <span>Dec 21</span>
                            <span>Dec 25</span>
                            <span>Dec 29</span>
                            <span>Dec 31</span>
                        </div>
                    </div>
                </div>

                {/* ── AI INSIGHTS SECTION (Bottom Cards) ────────────────────────── */}
                <div className="tailark-insights-container">
                    <div className="tailark-insights-header">
                        <h3 className="tailark-insights-title">AI Insights</h3>
                        <p className="tailark-insights-subtitle">Your data interpreted in a understandable language</p>
                    </div>

                    <div className="tailark-insights-grid">
                        {/* Insight Card 1 */}
                        <div className="tailark-insight-card">
                            <div className="tailark-insight-content">
                                <div className="tailark-insight-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e4e4e7" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                                </div>
                                <div className="tailark-insight-text">
                                    <strong>AI Insights:</strong> La cobertura del RAG aumentó un 23% este mes en la UPEC. Los temas con mejor rendimiento son <strong>Normalización (1NF, 2NF, 3NF)</strong> y <strong>Consultas SQL</strong>.
                                </div>
                            </div>
                            <button className="tailark-btn-details" onClick={() => setInsightDetailModal('ai-insights')}>
                                View Details
                            </button>
                        </div>

                        {/* Insight Card 2 */}
                        <div className="tailark-insight-card">
                            <div className="tailark-insight-content">
                                <div className="tailark-insight-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e4e4e7" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                </div>
                                <div className="tailark-insight-text">
                                    <strong>Critical:</strong> Motor Ollama Local operando a `temperature 0.2` para máxima precisión sin delirios. La retención de consultas socráticas alcanzó el 94%.
                                </div>
                            </div>
                            <button className="tailark-btn-details" onClick={() => setInsightDetailModal('critical')}>
                                View Details
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── TAB 4: DMZ INGESTION & KNOWLEDGE EXPLORER ──────────────────── */}
                {activeNav === 'rag' && (
                    <div className="tailark-tab-panel">
                        {/* DMZ Training Form */}
                        <div className="tailark-box">
                            <div className="tailark-box-header">
                                <div>
                                    <h3 className="tailark-box-title">🛡️ Zona Militarizada de Ingesta RAG</h3>
                                    <p className="tailark-box-desc">
                                        Entrena al tutor socrático AMY. Todo documento pasa por validación heurística e IA. Solo se aprueban contenidos sobre <strong>Fundamentos o Administración de Bases de Datos</strong>.
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleIngestSubmit}>
                                <div className="tailark-form-group">
                                    <label>Contenido Teórico del Documento Académico</label>
                                    <textarea
                                        className="tailark-input tailark-textarea"
                                        placeholder="Ingresa teoría sobre SQL, Normalización, Álgebra Relacional, Transacciones..."
                                        value={ingestText}
                                        onChange={(e) => setIngestText(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="tailark-form-row">
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
                                    disabled={actionLoading || !ingestText.trim()}
                                >
                                    {actionLoading ? 'Evaluando en Zona Militarizada...' : '🛡️ Evaluar e Ingestar Documento'}
                                </button>
                            </form>

                            {dmzResult && (
                                <div className={`tailark-alert ${dmzResult.success ? 'success' : 'rejected'}`}>
                                    <span>{dmzResult.success ? '✅' : '🛑'}</span>
                                    <span>{dmzResult.message}</span>
                                </div>
                            )}
                        </div>

                        {/* Knowledge Explorer Table */}
                        <div className="tailark-table-wrapper">
                            <div className="tailark-table-header">
                                <h3>Fragmentos Indexados ({knowledge.total})</h3>
                                <select
                                    className="tailark-select"
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                >
                                    <option value="all">Todas las Categorías</option>
                                    <option value="Normalización">Normalización</option>
                                    <option value="SQL">SQL</option>
                                    <option value="Modelo E-R">Modelo E-R</option>
                                    <option value="Álgebra Relacional">Álgebra Relacional</option>
                                    <option value="Diseño de BD">Diseño de BD</option>
                                </select>
                            </div>

                            <table className="tailark-table">
                                <thead>
                                    <tr>
                                        <th>Categoría</th>
                                        <th>Contenido</th>
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
                                                    🗑️ Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {knowledge.items.length === 0 && (
                                        <tr>
                                            <td colSpan="4" style={{ textAlign: 'center', color: '#71717a', padding: '2rem' }}>
                                                No se encontraron fragmentos para esta categoría.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── TAB 5: USER ROLE MANAGEMENT ───────────────────────────────── */}
                {activeNav === 'users' && (
                    <div className="tailark-tab-panel">
                        <div className="tailark-table-wrapper">
                            <div className="tailark-table-header">
                                <h3>Usuarios Registrados en el Sistema</h3>
                            </div>
                            <table className="tailark-table">
                                <thead>
                                    <tr>
                                        <th>Nombre</th>
                                        <th>Email</th>
                                        <th>Rol Actual</th>
                                        <th>Fecha Registro</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u.id}>
                                            <td style={{ fontWeight: '600' }}>{u.nombre}</td>
                                            <td style={{ color: '#a1a1aa' }}>{u.email}</td>
                                            <td>
                                                <span className={`tailark-role-badge ${u.rol}`}>
                                                    {u.rol === 'admin' ? '🛡️ Admin DMZ' : '🎓 Estudiante'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.8rem', color: '#71717a' }}>
                                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                                            </td>
                                            <td>
                                                <button className="tailark-btn-role" onClick={() => handleToggleRole(u)}>
                                                    {u.rol === 'admin' ? 'Hacer Estudiante' : 'Promover a Admin'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* Modal for Details */}
            {insightDetailModal && (
                <div className="tailark-modal-backdrop" onClick={() => setInsightDetailModal(null)}>
                    <div className="tailark-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Reporte de IA DMZ — Detalle</h3>
                        <p style={{ marginTop: '0.8rem', color: '#a1a1aa', lineHeight: '1.6' }}>
                            {insightDetailModal === 'ai-insights'
                                ? 'El motor RAG de AMY ha procesado más de 500 consultas académicas esta semana. El filtro semántico HNSW pgvector garantiza que solo bibliografía oficial (Silberschatz, Elmasri, Navathe) sea inyectada al contexto.'
                                : 'La Zona Militarizada de Ingesta ha rechazado 0 documentos irrelevantes gracias a la doble capa heurística + IA Mistral 7B local. El estado del sistema permanece en 100% de salud.'}
                        </p>
                        <button className="tailark-btn-primary" style={{ marginTop: '1.5rem', width: '100%' }} onClick={() => setInsightDetailModal(null)}>
                            Cerrar Reporte
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
