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
    const [activeTab, setActiveTab] = useState('stats'); // 'stats' | 'dmz' | 'users'
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [knowledge, setKnowledge] = useState({ items: [], total: 0 });
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // DMZ Ingestion Form state
    const [ingestText, setIngestText] = useState('');
    const [ingestCategory, setIngestCategory] = useState('Normalización');
    const [ingestFuente, setIngestFuente] = useState('');
    const [ingestAutor, setIngestAutor] = useState('');
    const [dmzResult, setDmzResult] = useState(null); // { success: bool, message: string }

    useEffect(() => {
        loadData();
    }, [activeTab, selectedCategory]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'stats') {
                const data = await getAdminStats();
                setStats(data);
            } else if (activeTab === 'users') {
                const data = await getAdminUsers();
                setUsers(data);
            } else if (activeTab === 'dmz') {
                const data = await getAdminKnowledge(selectedCategory);
                setKnowledge(data);
            }
        } catch (err) {
            console.error('Error cargando datos del panel admin:', err);
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
            // Recargar fragmentos
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
        <div className="admin-container">
            {/* Header */}
            <header className="admin-header">
                <div className="admin-header-title">
                    <h1>Panel de Administración AMY</h1>
                    <span className="admin-badge-dmz">Zona Militarizada RAG</span>
                </div>
                <Link to="/chat" className="admin-back-btn">
                    ← Volver al Chat
                </Link>
            </header>

            {/* Navigation Tabs */}
            <div className="admin-nav-tabs">
                <button
                    className={`admin-tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stats')}
                >
                    📊 Métricas & Salud
                </button>
                <button
                    className={`admin-tab-btn ${activeTab === 'dmz' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dmz')}
                >
                    🛡️ Entrenamiento RAG (Zona Militarizada)
                </button>
                <button
                    className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 Gestión de Usuarios
                </button>
            </div>

            {/* Main Content */}
            <main className="admin-main-content">
                {loading && <div style={{ color: '#94A3B8', padding: '2rem' }}>Cargando datos...</div>}

                {/* TAB 1: METRICS & HEALTH */}
                {!loading && activeTab === 'stats' && stats && (
                    <div>
                        <div className="metrics-grid">
                            <div className="metric-card">
                                <span className="metric-card-title">Usuarios Registrados</span>
                                <span className="metric-card-value">{stats.usersCount}</span>
                            </div>
                            <div className="metric-card">
                                <span className="metric-card-title">Conversaciones Totales</span>
                                <span className="metric-card-value">{stats.conversationsCount}</span>
                            </div>
                            <div className="metric-card">
                                <span className="metric-card-title">Mensajes Procesados</span>
                                <span className="metric-card-value">{stats.messagesCount}</span>
                            </div>
                            <div className="metric-card">
                                <span className="metric-card-title">Fragmentos RAG Activos</span>
                                <span className="metric-card-value">{stats.fragmentsCount}</span>
                            </div>
                        </div>

                        <h3 style={{ color: '#CBD5E1', marginBottom: '1rem', marginTop: '2rem' }}>
                            Estado de Infraestructura y Servicios
                        </h3>
                        <div className="health-grid">
                            <div className="health-item">
                                <span>Base de Datos PostgreSQL</span>
                                <div className="flex items-center gap-2">
                                    <span className={`status-dot ${stats.health.database}`} />
                                    <span style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                                        {stats.health.database}
                                    </span>
                                </div>
                            </div>
                            <div className="health-item">
                                <span>Motor IA Ollama / Mistral</span>
                                <div className="flex items-center gap-2">
                                    <span className={`status-dot ${stats.health.ollama}`} />
                                    <span style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                                        {stats.health.ollama}
                                    </span>
                                </div>
                            </div>
                            <div className="health-item">
                                <span>Caché Redis 7</span>
                                <div className="flex items-center gap-2">
                                    <span className={`status-dot ${stats.health.redis}`} />
                                    <span style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                                        {stats.health.redis}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: DMZ RAG TRAINING & KNOWLEDGE Explorer */}
                {!loading && activeTab === 'dmz' && (
                    <div>
                        {/* DMZ Training Form */}
                        <div className="dmz-box">
                            <div className="dmz-header">
                                <div>
                                    <div className="dmz-title">
                                        🛡️ Zona Militarizada de Ingesta RAG (Open Data)
                                    </div>
                                    <div className="dmz-desc">
                                        Entrena al tutor socrático. Todo documento pasa por validación heurística e IA.
                                        Solo se aprueban textos sobre <strong>Fundamentos o Administración de BD</strong>.
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={handleIngestSubmit}>
                                <div className="form-group">
                                    <label>Contenido del Documento Académico</label>
                                    <textarea
                                        className="form-control"
                                        placeholder="Ingresa aquí la teoría sobre SQL, Normalización 1NF/2NF/3NF, Transacciones ACID, etc..."
                                        value={ingestText}
                                        onChange={(e) => setIngestText(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Categoría Temática</label>
                                        <select
                                            className="form-control"
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

                                    <div className="form-group">
                                        <label>Fuente / Libro (Opcional)</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="ej. Silberschatz - Fundamentos de BD 7ma Ed"
                                            value={ingestFuente}
                                            onChange={(e) => setIngestFuente(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="btn-dmz-ingest"
                                    disabled={actionLoading || !ingestText.trim()}
                                >
                                    {actionLoading ? 'Verificando con la Zona Militarizada...' : '🛡️ Evaluar e Ingestar Documento'}
                                </button>
                            </form>

                            {/* DMZ Result Banner */}
                            {dmzResult && (
                                <div className={`alert-banner ${dmzResult.success ? 'success' : 'rejected'}`}>
                                    <div>{dmzResult.success ? '✅' : '🛑'}</div>
                                    <div>{dmzResult.message}</div>
                                </div>
                            )}
                        </div>

                        {/* Knowledge Explorer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ color: '#CBD5E1' }}>
                                Fragmentos de Conocimiento RAG Almacenados ({knowledge.total})
                            </h3>

                            <select
                                className="form-control"
                                style={{ width: 'auto' }}
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                <option value="all">Todas las Categorías</option>
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

                        <div className="knowledge-table-container">
                            <table className="admin-table">
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
                                            <td>
                                                <span className="badge-cat">{item.categoria}</span>
                                            </td>
                                            <td style={{ maxWidth: '450px', whiteSpace: 'pre-wrap' }}>
                                                {item.contenido.length > 180 ? item.contenido.substring(0, 180) + '...' : item.contenido}
                                            </td>
                                            <td style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                                                {item.metadata?.fuente ? `Fuente: ${item.metadata.fuente}` : 'Sin meta'}
                                            </td>
                                            <td>
                                                <button
                                                    className="btn-action-del"
                                                    onClick={() => handleDeleteFragment(item.id)}
                                                >
                                                    🗑️ Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {knowledge.items.length === 0 && (
                                        <tr>
                                            <td colSpan="4" style={{ textAlign: 'center', color: '#94A3B8' }}>
                                                No hay fragmentos para esta categoría.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 3: USER MANAGEMENT */}
                {!loading && activeTab === 'users' && (
                    <div className="users-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Correo Electrónico</th>
                                    <th>Rol</th>
                                    <th>Fecha Registro</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id}>
                                        <td style={{ fontWeight: '600' }}>{u.nombre}</td>
                                        <td style={{ color: '#94A3B8' }}>{u.email}</td>
                                        <td>
                                            <span className={`badge-role ${u.rol}`}>
                                                {u.rol === 'admin' ? '🛡️ Administrador' : '🎓 Estudiante'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td>
                                            <button
                                                className="btn-action-role"
                                                onClick={() => handleToggleRole(u)}
                                            >
                                                {u.rol === 'admin' ? 'Hacer Estudiante' : 'Promover a Admin'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}
