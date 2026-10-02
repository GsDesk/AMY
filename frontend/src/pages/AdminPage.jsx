import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    getAdminStats,
    getAdminUsers,
    updateUserRole,
    getAdminKnowledge,
    deleteKnowledgeFragment,
    getAdminAnalytics,
    getDmzLogs,
    ingestAcademicFile,
    getIngestJob,
    getApiKeys,
    updateApiKey,
    testApiKey,
    resetApiKey
} from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import IngestReview from '../components/IngestReview';
import './AdminPage.css';
import './AdminDashboard.css';

// Intervalo de refresco en vivo de las métricas (ms)
const LIVE_REFRESH_MS = 5000;
// Módulos cuyos datos se refrescan automáticamente
const LIVE_MODULES = ['dashboard', 'analytics', 'insights', 'users'];

const RANGE_LABELS = {
    '24h': 'últimas 24 horas',
    '7days': 'últimos 7 días',
    '30days': 'últimos 30 días'
};

const KEY_HELP = {
    groq: { url: 'https://console.groq.com/keys', prefix: 'gsk_', role: 'Motor de respaldo (respuestas rápidas)' },
    gemini: { url: 'https://aistudio.google.com/apikey', prefix: 'AIza / AQ.', role: 'Motor principal (streaming y adjuntos)' }
};

// Áreas temáticas que admite la base de conocimiento (mismas que la restricción de la BD)
const KNOWLEDGE_CATEGORIES = [
    'Normalización', 'SQL', 'Modelo E-R', 'Álgebra Relacional', 'Diseño de BD',
    'Transacciones', 'Índices', 'Administración de BD', 'Fundamentos'
];

function formatNumber(n) {
    return new Intl.NumberFormat('es-EC').format(n ?? 0);
}

// Nombre legible y color de cada motor según el campo `source` de las respuestas del tutor
function engineInfo(source = '') {
    const s = source.toLowerCase();
    if (s.startsWith('groq')) return { label: 'Groq', cls: 'adm-engine-groq' };
    if (s.startsWith('gemini')) return { label: 'Google Gemini', cls: 'adm-engine-gemini' };
    if (s.startsWith('ollama')) return { label: 'Ollama (local)', cls: 'adm-engine-ollama' };
    if (s.includes('cache') || s.includes('caché')) return { label: 'Caché', cls: 'adm-engine-cache' };
    return { label: source || 'Otro', cls: 'adm-engine-other' };
}

// Franjas horarias (hora local de Ecuador) para resumir el uso
const DAY_SLOTS = [
    { label: 'Madrugada', from: 0, to: 6 },
    { label: 'Mañana', from: 6, to: 12 },
    { label: 'Tarde', from: 12, to: 18 },
    { label: 'Noche', from: 18, to: 24 }
];

/** Gráfico de área con tooltip: consultas por hora/día. */
function ActivityChart({ labels = [], counts = [] }) {
    const [hover, setHover] = useState(null);
    const svgRef = useRef(null);

    const W = 900, H = 240, PAD_TOP = 16, PAD_BOTTOM = 8;
    const n = counts.length;
    const max = Math.max(1, ...counts);
    // Escala "redonda" para las líneas guía
    const step = Math.max(1, Math.ceil(max / 4));
    const top = step * 4;

    const pts = counts.map((c, i) => ({
        x: n > 1 ? (i * W) / (n - 1) : W / 2,
        y: PAD_TOP + (1 - c / top) * (H - PAD_TOP - PAD_BOTTOM)
    }));

    let line = '';
    if (pts.length) {
        line = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i - 1] || pts[i];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[i + 2] || p2;
            // Catmull-Rom -> Bezier, con la tangente limitada para no bajar de cero
            const c1y = Math.min(H - PAD_BOTTOM, p1.y + (p2.y - p0.y) / 6);
            const c2y = Math.min(H - PAD_BOTTOM, p2.y - (p3.y - p1.y) / 6);
            line += ` C ${p1.x + (p2.x - p0.x) / 6} ${c1y}, ${p2.x - (p3.x - p1.x) / 6} ${c2y}, ${p2.x} ${p2.y}`;
        }
    }
    const area = line ? `${line} L ${W} ${H} L 0 ${H} Z` : '';

    // Mostrar como máximo ~8 etiquetas en el eje X
    const labelEvery = Math.max(1, Math.ceil(n / 8));

    const handleMove = (e) => {
        if (!svgRef.current || n === 0) return;
        const rect = svgRef.current.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        setHover(Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1)))));
    };

    const total = counts.reduce((a, b) => a + b, 0);

    return (
        <div className="adm-chart">
            <div className="adm-chart-plot">
                <div className="adm-chart-yaxis">
                    {[4, 3, 2, 1, 0].map((k) => <span key={k}>{step * k}</span>)}
                </div>
                <div className="adm-chart-canvas" onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
                    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="adm-chart-svg">
                        {[0, 1, 2, 3, 4].map((k) => {
                            const y = PAD_TOP + (k / 4) * (H - PAD_TOP - PAD_BOTTOM);
                            return <line key={k} x1="0" x2={W} y1={y} y2={y} className="adm-chart-grid" />;
                        })}
                        {area && <path d={area} className="adm-chart-area" />}
                        {line && <path d={line} className="adm-chart-line" vectorEffect="non-scaling-stroke" />}
                        {hover !== null && pts[hover] && (
                            <line x1={pts[hover].x} x2={pts[hover].x} y1={0} y2={H} className="adm-chart-cursor" vectorEffect="non-scaling-stroke" />
                        )}
                    </svg>
                    {hover !== null && pts[hover] && (
                        <>
                            <span
                                className="adm-chart-dot"
                                style={{ left: `${(pts[hover].x / W) * 100}%`, top: `${(pts[hover].y / H) * 100}%` }}
                            />
                            <div
                                className={`adm-chart-tooltip ${pts[hover].x > W * 0.75 ? 'left' : ''}`}
                                style={{ left: `${(pts[hover].x / W) * 100}%` }}
                            >
                                <div><strong>{formatNumber(counts[hover])}</strong> {counts[hover] === 1 ? 'consulta' : 'consultas'}</div>
                                <span>{labels[hover]}</span>
                            </div>
                        </>
                    )}
                    {total === 0 && <div className="adm-chart-empty">Sin consultas en este periodo</div>}
                </div>
            </div>
            <div className="adm-chart-xaxis">
                {labels.map((lbl, i) => {
                    const shown = (i % labelEvery === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= labelEvery / 2);
                    // En pantallas estrechas se ocultan las etiquetas "menores" (una de cada dos)
                    const minor = i !== 0 && i !== n - 1 &&
                        (Math.floor(i / labelEvery) % 2 === 1 || n - 1 - i < labelEvery * 2);
                    return (
                        <span key={i} className={minor ? 'minor' : ''} style={{ left: `${n > 1 ? (i / (n - 1)) * 100 : 50}%` }}>
                            {shown ? lbl : ''}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

export default function AdminPage() {
    const [activeNav, setActiveNav] = useState('dashboard'); // 'dashboard' | 'analytics' | 'insights' | 'rag' | 'users' | 'keys'
    const [stats, setStats] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [dmzLogs, setDmzLogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [knowledge, setKnowledge] = useState({ items: [], total: 0 });
    const [knowledgeSearch, setKnowledgeSearch] = useState('');
    const visibleKnowledge = useMemo(() => {
        const q = knowledgeSearch.trim().toLowerCase();
        if (!q) return knowledge.items;
        return knowledge.items.filter(i =>
            i.contenido.toLowerCase().includes(q) || (i.metadata?.fuente || '').toLowerCase().includes(q));
    }, [knowledge.items, knowledgeSearch]);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    // Filtros superiores
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [timeRange, setTimeRange] = useState('30days');
    const [userSearchTerm, setUserSearchTerm] = useState('');

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Actualización en vivo
    const [liveEnabled, setLiveEnabled] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [now, setNow] = useState(Date.now());
    const requestIdRef = useRef(0);

    // Claves de API
    const [apiKeys, setApiKeys] = useState([]);
    const [keyInputs, setKeyInputs] = useState({});
    const [keyVisible, setKeyVisible] = useState({});
    const [keyBusy, setKeyBusy] = useState({});
    const [keyFeedback, setKeyFeedback] = useState({});

    // Estado para Carga de Archivos (Drag & Drop)
    const [selectedFile, setSelectedFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [ingestCategory, setIngestCategory] = useState('Normalización');
    const [ingestFuente, setIngestFuente] = useState('');
    const [ingestAutor, setIngestAutor] = useState('');
    const [ingestUrl, setIngestUrl] = useState('');
    const [ingestReview, setIngestReview] = useState(null); // proceso «Enseñar a AMY» en curso

    const fileInputRef = useRef(null);

    const loadData = useCallback(async (silent = false) => {
        const requestId = ++requestIdRef.current;
        if (!silent) setLoading(true);
        try {
            if (activeNav === 'dashboard') {
                const sData = await getAdminStats(selectedCategory, timeRange);
                if (requestId !== requestIdRef.current) return;
                setStats(sData);
            }
            if (activeNav === 'analytics') {
                const aData = await getAdminAnalytics();
                if (requestId !== requestIdRef.current) return;
                setAnalytics(aData);
            }
            if (activeNav === 'insights') {
                const logsData = await getDmzLogs();
                if (requestId !== requestIdRef.current) return;
                setDmzLogs(logsData);
            }
            if (activeNav === 'users') {
                const uData = await getAdminUsers();
                if (requestId !== requestIdRef.current) return;
                setUsers(uData);
            }
            if (activeNav === 'rag') {
                const kData = await getAdminKnowledge(selectedCategory);
                if (requestId !== requestIdRef.current) return;
                setKnowledge(kData);
            }
            if (activeNav === 'keys') {
                const kData = await getApiKeys();
                if (requestId !== requestIdRef.current) return;
                setApiKeys(kData);
            }
            setLastUpdated(Date.now());
            setLoadError(null);
        } catch (err) {
            console.error('Error cargando datos del panel admin:', err);
            if (requestId === requestIdRef.current) setLoadError(err.message);
        } finally {
            if (!silent && requestId === requestIdRef.current) setLoading(false);
        }
    }, [activeNav, selectedCategory, timeRange]);

    // Carga inicial y al cambiar de módulo o filtros
    useEffect(() => {
        loadData(false);
    }, [loadData]);

    // Refresco en vivo (se pausa si la pestaña del navegador no está visible)
    useEffect(() => {
        if (!liveEnabled || !LIVE_MODULES.includes(activeNav)) return undefined;
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible') loadData(true);
        }, LIVE_REFRESH_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible') loadData(true);
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [liveEnabled, activeNav, loadData]);

    // Reloj para los textos relativos ("hace 3 s")
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

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
        // Al elegir otro archivo se cierra el resultado anterior, salvo si aún se está aprendiendo
        setIngestReview(prev => (prev?.phase === "indexing" ? prev : null));
    };

    const handleFileUploadSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFile) return;

        setActionLoading(true);
        const fileName = selectedFile.name;
        setIngestReview({ phase: 'reviewing', fileName });

        try {
            const res = await ingestAcademicFile(selectedFile, ingestCategory, ingestFuente, ingestAutor, ingestUrl);
            if (!res.approved) {
                setIngestReview({ phase: 'rejected', fileName, message: res.message, report: res.report });
                return;
            }
            setIngestReview({
                phase: 'indexing', fileName, message: res.message, category: res.category,
                report: res.report, jobId: res.job_id, job: { done: 0, total: 0 }
            });
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            setIngestFuente('');
            setIngestAutor('');
            setIngestUrl('');
        } catch (err) {
            setIngestReview({ phase: 'error', fileName, message: err.message || 'No se pudo procesar el documento.' });
        } finally {
            setActionLoading(false);
        }
    };

    // Seguimiento del aprendizaje (indexación) del documento aprobado
    useEffect(() => {
        if (ingestReview?.phase !== 'indexing' || !ingestReview.jobId) return undefined;
        let cancelled = false;
        const timer = setInterval(async () => {
            try {
                const job = await getIngestJob(ingestReview.jobId);
                if (cancelled) return;
                if (job.status === 'done') {
                    setIngestReview(prev => ({ ...prev, phase: 'done', job }));
                    loadData();
                } else if (job.status === 'error') {
                    setIngestReview(prev => ({ ...prev, phase: 'error', job, message: job.error }));
                } else {
                    setIngestReview(prev => ({ ...prev, job }));
                }
            } catch { /* se reintenta en el siguiente ciclo */ }
        }, 1000);
        return () => { cancelled = true; clearInterval(timer); };
    }, [ingestReview?.phase, ingestReview?.jobId]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // ── Claves de API ─────────────────────────────────────────
    const runKeyAction = async (provider, action) => {
        setKeyBusy((b) => ({ ...b, [provider]: action }));
        setKeyFeedback((f) => ({ ...f, [provider]: null }));
        try {
            if (action === 'save') {
                const res = await updateApiKey(provider, keyInputs[provider] || '');
                setKeyInputs((k) => ({ ...k, [provider]: '' }));
                setKeyFeedback((f) => ({ ...f, [provider]: { ok: true, message: res.message } }));
            } else if (action === 'test') {
                const res = await testApiKey(provider);
                setKeyFeedback((f) => ({ ...f, [provider]: { ok: res.valid, message: res.message } }));
            } else if (action === 'reset') {
                const res = await resetApiKey(provider);
                setKeyFeedback((f) => ({ ...f, [provider]: { ok: true, message: res.message } }));
            }
            const kData = await getApiKeys();
            setApiKeys(kData);
        } catch (err) {
            setKeyFeedback((f) => ({ ...f, [provider]: { ok: false, message: err.message } }));
        } finally {
            setKeyBusy((b) => ({ ...b, [provider]: null }));
        }
    };

    const filteredUsers = users.filter(u =>
        u.nombre.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
    );

    // En «Cerebro de AMY» el filtro por área se hace con los chips de la biblioteca
    const showFilters = activeNav === 'dashboard';
    const isLiveModule = LIVE_MODULES.includes(activeNav);
    const secondsAgo = lastUpdated ? Math.max(0, Math.round((now - lastUpdated) / 1000)) : null;
    const rangeLabel = RANGE_LABELS[timeRange];
    const health = stats?.health || {};
    const topTopicsMax = Math.max(1, ...(stats?.topTopics || []).map((t) => t.count));

    const services = [
        { key: 'database', name: 'PostgreSQL + pgvector', desc: 'Datos y vectores RAG', ok: health.database === 'connected', okText: 'Conectado', badText: 'Sin conexión' },
        { key: 'redis', name: 'Redis', desc: 'Caché de respuestas', ok: health.redis === 'connected', okText: 'Conectado', badText: 'Sin conexión' },
        { key: 'ollama', name: 'Ollama', desc: 'Embeddings locales', ok: health.ollama === 'connected', okText: 'Activo', badText: 'Inaccesible' },
        { key: 'gemini', name: 'Google Gemini', desc: 'Motor principal', ok: health.gemini === 'configured', okText: 'Clave configurada', badText: 'Sin clave', manage: true },
        { key: 'groq', name: 'Groq', desc: 'Motor de respaldo', ok: health.groq === 'configured', okText: 'Clave configurada', badText: 'Sin clave', manage: true }
    ];

    const trend = stats?.queriesTrend;
    const servicesUp = services.filter((s) => s.ok).length;

    const hourly = stats?.hourlyUsage || Array(24).fill(0);
    const hourlyMax = Math.max(...hourly);
    const peakHour = hourlyMax > 0 ? hourly.indexOf(hourlyMax) : null;
    const slotTotals = DAY_SLOTS.map((slot) => ({
        ...slot,
        total: hourly.slice(slot.from, slot.to).reduce((a, b) => a + b, 0)
    }));

    // Se listan siempre los motores conocidos (también con 0) para ver cuáles no se están usando
    const engineTotals = {};
    (stats?.engines || []).forEach((e) => {
        const info = engineInfo(e.source);
        engineTotals[info.cls] = engineTotals[info.cls] || { ...info, source: info.cls, count: 0 };
        engineTotals[info.cls].count += e.count;
    });
    ['groq', 'gemini', 'ollama', 'cache'].forEach((k) => {
        const info = engineInfo(k);
        if (!engineTotals[info.cls]) engineTotals[info.cls] = { ...info, source: info.cls, count: 0 };
    });
    const engines = Object.values(engineTotals).sort((a, b) => b.count - a.count);
    const enginesTotal = engines.reduce((a, e) => a + e.count, 0);

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

            {/* ── MENÚ LATERAL ──────────────────────────────────────────────── */}
            <aside className="tailark-sidebar">
                <div className="tailark-sidebar-header-row">
                    <div className="tailark-brand">
                        <div className="tailark-logo-mark">
                            <img src="/amy-logo.png" alt="AMY" className="tailark-logo-img" />
                        </div>
                        <div className="tailark-brand-text">
                            <span className="tailark-brand-title">Panel Admin</span>
                            <span className="tailark-brand-sub">AMY · Tutor de Bases de Datos</span>
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

                <span className="adm-nav-group-title">General</span>
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
                </nav>

                <span className="adm-nav-group-title">Gestión</span>
                <nav className="tailark-nav">
                    <button
                        className={`tailark-nav-item ${activeNav === 'rag' ? 'active' : ''}`}
                        onClick={() => handleSelectNav('rag')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span>Cerebro de AMY</span>
                    </button>

                    <button
                        className={`tailark-nav-item ${activeNav === 'users' ? 'active' : ''}`}
                        onClick={() => handleSelectNav('users')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <span>Usuarios & Roles</span>
                    </button>

                    <button
                        className={`tailark-nav-item ${activeNav === 'keys' ? 'active' : ''}`}
                        onClick={() => handleSelectNav('keys')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M17 6l3 3M14.5 8.5l2 2"/></svg>
                        <span>Claves de API</span>
                    </button>
                </nav>

                <div className="tailark-sidebar-footer">
                    <div className="adm-sidebar-theme">
                        <span>Tema</span>
                        <ThemeToggle />
                    </div>
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
                        <span className="tailark-brand-title">Panel Admin</span>
                    </div>
                    <Link to="/chat" className="tailark-mobile-back" title="Volver al chat">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                    </Link>
                </div>

                {/* Barra superior: filtros + indicador en vivo */}
                {(showFilters || isLiveModule) && (
                <div className="tailark-topbar adm-topbar">
                    <div className="tailark-filters">
                        {showFilters && (
                            <div className="tailark-select-wrapper">
                                <select
                                    className="tailark-select"
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                >
                                    <option value="all">Todas las categorías</option>
                                    <option value="SQL">Consultas SQL</option>
                                    <option value="Normalización">Normalización</option>
                                    <option value="Modelo E-R">Modelo E-R</option>
                                    <option value="Álgebra Relacional">Álgebra Relacional</option>
                                    <option value="Transacciones">Transacciones</option>
                                    <option value="Índices">Índices</option>
                                    <option value="Administración de BD">Administración de BD</option>
                                    <option value="Fundamentos">Fundamentos</option>
                                </select>
                                <svg className="tailark-select-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                            </div>
                        )}

                        {activeNav === 'dashboard' && (
                            <div className="adm-segmented" role="tablist" aria-label="Periodo">
                                {Object.keys(RANGE_LABELS).map((r) => (
                                    <button
                                        key={r}
                                        role="tab"
                                        aria-selected={timeRange === r}
                                        className={timeRange === r ? 'active' : ''}
                                        onClick={() => setTimeRange(r)}
                                    >
                                        {r === '24h' ? '24 h' : r === '7days' ? '7 días' : '30 días'}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {isLiveModule && (
                        <button
                            className={`adm-live-pill ${liveEnabled ? 'on' : 'off'} ${loadError ? 'error' : ''}`}
                            onClick={() => setLiveEnabled((v) => !v)}
                            title={liveEnabled ? 'Pausar actualización automática' : 'Reanudar actualización automática'}
                        >
                            <span className="adm-live-dot" />
                            {loadError
                                ? 'Error de conexión'
                                : liveEnabled ? 'En vivo' : 'En pausa'}
                            {secondsAgo !== null && !loadError && (
                                <span className="adm-live-ago">· {secondsAgo < 2 ? 'ahora' : `hace ${secondsAgo} s`}</span>
                            )}
                        </button>
                    )}
                </div>
                )}

                {/* ── MÓDULO 1: DASHBOARD ────────────────────────────────────────── */}
                {activeNav === 'dashboard' && (
                    <div className="module-fade-in">
                        <div className="tailark-section-header">
                            <h2 className="tailark-section-title">Resumen general</h2>
                            <p className="tailark-section-subtitle">
                                Actividad real de AMY en los {rangeLabel}
                                {selectedCategory !== 'all' && <> · categoría <strong>{selectedCategory}</strong></>}
                            </p>
                        </div>

                        <div className="adm-kpi-grid">
                            <div className={`adm-kpi ${loading && !stats ? 'is-loading' : ''}`}>
                                <div className="adm-kpi-head">
                                    <span className="adm-kpi-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                    </span>
                                    <span className="adm-kpi-label">Consultas de estudiantes</span>
                                    {trend !== null && trend !== undefined && (
                                        <span className={`adm-trend ${trend >= 0 ? 'up' : 'down'}`} title="Comparado con el periodo anterior">
                                            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
                                        </span>
                                    )}
                                </div>
                                <div className="adm-kpi-value">{formatNumber(stats?.queriesInRange)}</div>
                                <div className="adm-kpi-sub">
                                    {formatNumber(stats?.queriesToday)} hoy · {formatNumber(stats?.queriesCount)} en total
                                </div>
                            </div>

                            <div className={`adm-kpi ${loading && !stats ? 'is-loading' : ''}`}>
                                <div className="adm-kpi-head">
                                    <span className="adm-kpi-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                    </span>
                                    <span className="adm-kpi-label">Usuarios activos</span>
                                </div>
                                <div className="adm-kpi-value">
                                    {formatNumber(stats?.activeUsers)}
                                    <span className="adm-kpi-of"> / {formatNumber(stats?.usersCount)}</span>
                                </div>
                                <div className="adm-kpi-sub">
                                    {formatNumber(stats?.newUsers)} {stats?.newUsers === 1 ? 'registro nuevo' : 'registros nuevos'} · {formatNumber(stats?.conversationsInRange)} conversaciones
                                </div>
                            </div>

                            <div className={`adm-kpi ${loading && !stats ? 'is-loading' : ''}`}>
                                <div className="adm-kpi-head">
                                    <span className="adm-kpi-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
                                    </span>
                                    <span className="adm-kpi-label">Respuestas con RAG</span>
                                </div>
                                <div className="adm-kpi-value">{stats ? `${stats.ragUsageRate}%` : '0%'}</div>
                                <div className="adm-kpi-meter">
                                    <span style={{ width: `${Math.min(100, stats?.ragUsageRate || 0)}%` }} />
                                </div>
                                <div className="adm-kpi-sub">
                                    {formatNumber(stats?.ragUsedCount)} de {formatNumber(stats?.repliesInRange)} respuestas usaron la base de conocimiento
                                </div>
                            </div>

                            <div className={`adm-kpi ${loading && !stats ? 'is-loading' : ''}`}>
                                <div className="adm-kpi-head">
                                    <span className="adm-kpi-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/></svg>
                                    </span>
                                    <span className="adm-kpi-label">Base de conocimiento</span>
                                </div>
                                <div className="adm-kpi-value">{formatNumber(stats?.fragmentsCount)}</div>
                                <div className="adm-kpi-sub">
                                    fragmentos indexados · +{formatNumber(stats?.newFragments)} en el periodo
                                </div>
                            </div>
                        </div>

                        <div className="adm-grid-main">
                            <div className="adm-panel">
                                <div className="adm-panel-head">
                                    <div>
                                        <h3 className="adm-panel-title">Actividad de consultas</h3>
                                        <p className="adm-panel-sub">
                                            Preguntas enviadas por estudiantes {stats?.chart?.unit === 'hour' ? 'por hora' : 'por día'} · {rangeLabel}
                                        </p>
                                    </div>
                                    <div className="adm-panel-stat">
                                        <strong>{formatNumber(stats?.queriesInRange)}</strong>
                                        <span>en el periodo</span>
                                    </div>
                                </div>
                                <ActivityChart labels={stats?.chart?.labels} counts={stats?.chart?.counts} />
                            </div>

                            <div className="adm-panel">
                                <div className="adm-panel-head">
                                    <div>
                                        <h3 className="adm-panel-title">Estado de servicios</h3>
                                        <p className="adm-panel-sub">Comprobado en cada actualización</p>
                                    </div>
                                    {stats && (
                                        <span className={`adm-services-summary ${servicesUp === services.length ? 'ok' : 'bad'}`}>
                                            {servicesUp}/{services.length} operativos
                                        </span>
                                    )}
                                </div>
                                <ul className="adm-services">
                                    {services.map((s) => (
                                        <li key={s.key}>
                                            <span className={`adm-status-dot ${stats ? (s.ok ? 'ok' : 'bad') : ''}`} />
                                            <span className="adm-services-name">
                                                {s.name}
                                                <small>{s.desc}</small>
                                            </span>
                                            {s.manage && !s.ok && stats ? (
                                                <button className="adm-link-btn" onClick={() => handleSelectNav('keys')}>Configurar</button>
                                            ) : (
                                                <span className={`adm-services-state ${s.ok ? 'ok' : 'bad'}`}>
                                                    {stats ? (s.ok ? s.okText : s.badText) : '—'}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="adm-grid-3">
                            <div className="adm-panel">
                                <div className="adm-panel-head">
                                    <div>
                                        <h3 className="adm-panel-title">Temas más consultados</h3>
                                        <p className="adm-panel-sub">Clasificación automática de las preguntas</p>
                                    </div>
                                </div>
                                <div className="adm-panel-body">
                                    {stats?.topTopics?.length ? (
                                        <ul className="adm-bars">
                                            {stats.topTopics.map((t) => (
                                                <li key={t.topic}>
                                                    <div className="adm-bars-label">
                                                        <span>{t.topic}</span>
                                                        <span>{formatNumber(t.count)}</span>
                                                    </div>
                                                    <div className="adm-bars-track">
                                                        <span style={{ width: `${(t.count / topTopicsMax) * 100}%` }} />
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="adm-empty">Aún no hay consultas en este periodo.</div>
                                    )}
                                </div>
                            </div>

                            <div className="adm-panel">
                                <div className="adm-panel-head">
                                    <div>
                                        <h3 className="adm-panel-title">Horario de uso</h3>
                                        <p className="adm-panel-sub">Consultas por hora del día (hora de Ecuador)</p>
                                    </div>
                                    <span className="adm-privacy-tag" title="Solo se muestran totales: no se identifica a ningún estudiante ni el contenido de sus preguntas">
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                                        Anónimo
                                    </span>
                                </div>
                                <div className="adm-panel-body">
                                    <div className="adm-hours">
                                        <div className="adm-hours-bars">
                                            {hourly.map((v, h) => (
                                                <span
                                                    key={h}
                                                    className={h === peakHour ? 'peak' : ''}
                                                    style={{ height: hourlyMax ? `${(v / hourlyMax) * 100}%` : 0 }}
                                                    title={`${String(h).padStart(2, '0')}:00 — ${v} ${v === 1 ? 'consulta' : 'consultas'}`}
                                                />
                                            ))}
                                        </div>
                                        <div className="adm-hours-axis">
                                            <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
                                        </div>
                                    </div>
                                    <div className="adm-hours-slots">
                                        {slotTotals.map((slot) => (
                                            <div key={slot.label}>
                                                <span>{slot.label}</span>
                                                <strong>{formatNumber(slot.total)}</strong>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="adm-panel-foot">
                                        <span>Hora pico</span>
                                        <strong>
                                            {peakHour !== null
                                                ? `${String(peakHour).padStart(2, '0')}:00 – ${String((peakHour + 1) % 24).padStart(2, '0')}:00 · ${formatNumber(hourlyMax)} consultas`
                                                : 'Sin actividad'}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            <div className="adm-panel">
                                <div className="adm-panel-head">
                                    <div>
                                        <h3 className="adm-panel-title">Motores de IA</h3>
                                        <p className="adm-panel-sub">Qué motor generó cada respuesta del tutor</p>
                                    </div>
                                </div>
                                <div className="adm-panel-body">
                                    {enginesTotal > 0 ? (
                                        <>
                                            <div className="adm-stack" aria-hidden="true">
                                                {engines.map((e) => (
                                                    <span key={e.source} className={e.cls} style={{ width: `${(e.count / enginesTotal) * 100}%` }} />
                                                ))}
                                            </div>
                                            <ul className="adm-bars">
                                                {engines.map((e) => (
                                                    <li key={e.source}>
                                                        <div className="adm-bars-label">
                                                            <span><i className={`adm-engine-dot ${e.cls}`} />{e.label}</span>
                                                            <span>{formatNumber(e.count)} · {Math.round((e.count / enginesTotal) * 100)}%</span>
                                                        </div>
                                                        <div className="adm-bars-track">
                                                            <span className={e.cls} style={{ width: `${(e.count / enginesTotal) * 100}%` }} />
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </>
                                    ) : (
                                        <div className="adm-empty">Aún no hay respuestas en este periodo.</div>
                                    )}
                                    <div className="adm-panel-foot">
                                        <span>Respuestas del tutor</span>
                                        <strong>{formatNumber(enginesTotal)}</strong>
                                    </div>
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
                                <div className="analytics-card-sub">Modelo {analytics?.embedModel || 'nomic-embed-text'}</div>
                            </div>

                            <div className="analytics-card">
                                <div className="analytics-card-title">Algoritmo de Búsqueda</div>
                                <div className="analytics-card-val">{analytics?.indexType || 'HNSW'}</div>
                                <div className="analytics-card-sub">{analytics?.distanceMetric || 'Distancia Coseno'}</div>
                            </div>

                            <div className="analytics-card">
                                <div className="analytics-card-title">Fragmentos Totales</div>
                                <div className="analytics-card-val">{formatNumber(analytics?.totalFragments)}</div>
                                <div className="analytics-card-sub">Almacenados en PostgreSQL</div>
                            </div>

                            <div className="analytics-card">
                                <div className="analytics-card-title">Umbral de Similitud</div>
                                <div className="analytics-card-val">{analytics?.similarityThreshold ?? '—'}</div>
                                <div className="analytics-card-sub">Recuperación híbrida (vector + texto)</div>
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
                                                <div className="progress-fill" style={{ width: `${item.porcentaje}%`, background: 'var(--tailark-cyan)' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ color: 'var(--tailark-text-dim)', padding: '2rem 0', textAlign: 'center', fontSize: '0.88rem' }}>
                                    Aún no se han ingestado fragmentos en la base de datos vectorial. Sube documentos en «Cerebro de AMY» para empezar.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── MÓDULO 3: DIAGNÓSTICOS DE IA & AUDITORÍA DMZ ─────────────────── */}
                {activeNav === 'insights' && (
                    <div className="module-fade-in">
                        <div className="tailark-section-header">
                            <h2 className="tailark-section-title">Diagnósticos de IA & Historial de revisiones</h2>
                            <p className="tailark-section-subtitle">Auditoría real de ingesta de documentos y validación heurística</p>
                        </div>

                        <div className="tailark-box">
                            <h3 className="tailark-box-title">Historial de revisiones de documentos</h3>
                            <p className="tailark-box-desc">Historial completo de intentos de ingesta evaluados en tiempo real.</p>

                            {dmzLogs.length > 0 ? (
                                <div className="tailark-table-wrapper" style={{ marginTop: '1rem', border: '1px solid var(--tailark-border)' }}>
                                    <table className="tailark-table">
                                        <thead>
                                            <tr>
                                                <th>Marca de Tiempo</th>
                                                <th>Evento de Ingesta</th>
                                                <th>Categoría</th>
                                                <th>Resultado</th>
                                                <th>Motivo / Diagnóstico</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dmzLogs.map((log) => (
                                                <tr key={log.id}>
                                                    <td style={{ color: 'var(--tailark-text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                        {log.timestamp ? new Date(log.timestamp).toLocaleString('es-EC') : 'N/A'}
                                                    </td>
                                                    <td style={{ fontWeight: '500', maxWidth: '340px', overflowWrap: 'anywhere' }}>{log.evento}</td>
                                                    <td><span className="tailark-badge-pill">{log.categoria}</span></td>
                                                    <td>
                                                        <span className={`tailark-role-badge ${log.estado === 'APROBADO' ? 'admin' : 'estudiante'}`} style={log.estado === 'RECHAZADO' ? { color: 'var(--tailark-red)', borderColor: 'var(--tailark-red)', background: 'var(--tailark-red-soft)' } : {}}>
                                                            {log.estado}
                                                        </span>
                                                    </td>
                                                    <td style={{ color: 'var(--tailark-text-muted)', fontSize: '0.82rem', minWidth: '280px', maxWidth: '460px', lineHeight: 1.45 }}>{log.motivo}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{ color: 'var(--tailark-text-dim)', padding: '3rem 1rem', textAlign: 'center', fontSize: '0.88rem' }}>
                                    No hay registros de auditoría de ingesta en el sistema. Todos los intentos de ingesta de archivos se registrarán aquí en tiempo real.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── MÓDULO 4: CEREBRO DE AMY (BASE DE CONOCIMIENTO RAG) ─────────── */}
                {activeNav === 'rag' && (
                    <div className="module-fade-in tailark-tab-panel">
                        <div className="tailark-section-header brain-hero">
                            <span className="brain-hero-eyebrow">Base de conocimiento · RAG</span>
                            <h2 className="tailark-section-title">Cerebro de AMY</h2>
                            <p className="tailark-section-subtitle">
                                Cada libro o apunte que apruebes se convierte en conocimiento que AMY usa para guiar a tus estudiantes, con la fuente siempre a la vista.
                            </p>
                        </div>

                        {/* Métricas de la base de conocimiento */}
                        <div className="brain-stats">
                            <div className="brain-stat">
                                <span className="brain-stat-value">{formatNumber(knowledge.summary?.total ?? knowledge.total)}</span>
                                <span className="brain-stat-label">Fragmentos de conocimiento</span>
                            </div>
                            <div className="brain-stat">
                                <span className="brain-stat-value">{formatNumber(knowledge.summary?.sources ?? 0)}</span>
                                <span className="brain-stat-label">Documentos fuente</span>
                            </div>
                            <div className="brain-stat">
                                <span className="brain-stat-value">{formatNumber(knowledge.summary?.categories?.length ?? 0)}</span>
                                <span className="brain-stat-label">Áreas temáticas</span>
                            </div>
                            <div className="brain-stat">
                                <span className="brain-stat-value">
                                    {formatNumber(knowledge.summary?.categories?.find(c => c.categoria === 'Administración de BD')?.count ?? 0)}
                                </span>
                                <span className="brain-stat-label">Fragmentos de Administración de BD</span>
                            </div>
                        </div>

                        {/* Carga de documentos */}
                        <div className="tailark-box">
                            <div className="tailark-box-header">
                                <div>
                                    <h3 className="tailark-box-title">Alimentar a AMY</h3>
                                    <p className="tailark-box-desc">
                                        Sube libros, artículos o apuntes (.pdf, .txt, .docx, .doc). Antes de aprenderlos, la IA lee las primeras páginas y otras repartidas por todo el documento, y rechaza los que no traten de bases de datos.
                                    </p>
                                </div>
                                <span className="brain-shield">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
                                    Revisión automática de contenido
                                </span>
                            </div>

                            <form onSubmit={handleFileUploadSubmit}>
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
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--tailark-cyan)' }} strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
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
                                            <span className="brain-drop-icon">
                                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                            </span>
                                            <span className="drop-title">Suelta aquí un libro o apunte</span>
                                            <span className="drop-sub">o haz clic para elegirlo · .pdf, .txt, .docx, .doc</span>
                                        </div>
                                    )}
                                </div>

                                <div className="tailark-form-row" style={{ marginTop: '1.2rem' }}>
                                    <div className="tailark-form-group">
                                        <label>Área temática</label>
                                        <select
                                            className="tailark-input"
                                            value={ingestCategory}
                                            onChange={(e) => setIngestCategory(e.target.value)}
                                        >
                                            {KNOWLEDGE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    <div className="tailark-form-group">
                                        <label>Fuente / Libro (opcional)</label>
                                        <input
                                            type="text"
                                            className="tailark-input"
                                            placeholder="ej. Silberschatz - Fundamentos de BD 7ma Ed"
                                            value={ingestFuente}
                                            onChange={(e) => setIngestFuente(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="tailark-form-row">
                                    <div className="tailark-form-group">
                                        <label>Autor (opcional)</label>
                                        <input
                                            type="text"
                                            className="tailark-input"
                                            placeholder="ej. Elmasri y Navathe"
                                            value={ingestAutor}
                                            onChange={(e) => setIngestAutor(e.target.value)}
                                        />
                                    </div>

                                    <div className="tailark-form-group">
                                        <label>Enlace o DOI (opcional)</label>
                                        <input
                                            type="text"
                                            className="tailark-input"
                                            placeholder="ej. https://doi.org/10.1109/... (IEEE Xplore, Scopus)"
                                            value={ingestUrl}
                                            onChange={(e) => setIngestUrl(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="tailark-btn-primary"
                                    disabled={actionLoading || !selectedFile || ingestReview?.phase === 'indexing'}
                                >
                                    {actionLoading ? 'Revisando el documento…'
                                        : ingestReview?.phase === 'indexing' ? 'AMY está aprendiendo…'
                                        : 'Enseñar a AMY'}
                                </button>
                            </form>

                            <IngestReview
                                review={ingestReview}
                                onClose={() => setIngestReview(null)}
                                onShowCategory={(cat) => {
                                    setSelectedCategory(cat);
                                    document.querySelector('.brain-library-header')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                            />
                        </div>

                        {/* Biblioteca de conocimiento */}
                        <div className="tailark-table-wrapper">
                            <div className="tailark-table-header brain-library-header">
                                <h3>Biblioteca de conocimiento ({formatNumber(knowledge.total)})</h3>
                                <input
                                    type="search"
                                    className="tailark-input brain-search"
                                    placeholder="Buscar en los fragmentos o fuentes..."
                                    value={knowledgeSearch}
                                    onChange={(e) => setKnowledgeSearch(e.target.value)}
                                    aria-label="Buscar fragmentos"
                                />
                            </div>

                            <div className="brain-chips" role="tablist" aria-label="Filtrar por área temática">
                                <button
                                    role="tab"
                                    aria-selected={selectedCategory === 'all'}
                                    className={`brain-chip ${selectedCategory === 'all' ? 'active' : ''}`}
                                    onClick={() => setSelectedCategory('all')}
                                >
                                    Todas <span>{formatNumber(knowledge.summary?.total ?? knowledge.total)}</span>
                                </button>
                                {(knowledge.summary?.categories || []).map(c => (
                                    <button
                                        key={c.categoria}
                                        role="tab"
                                        aria-selected={selectedCategory === c.categoria}
                                        className={`brain-chip ${selectedCategory === c.categoria ? 'active' : ''}`}
                                        onClick={() => setSelectedCategory(c.categoria)}
                                    >
                                        {c.categoria} <span>{formatNumber(c.count)}</span>
                                    </button>
                                ))}
                            </div>

                            <table className="tailark-table">
                                <thead>
                                    <tr>
                                        <th>Área</th>
                                        <th>Contenido del fragmento</th>
                                        <th>Fuente</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleKnowledge.map((item) => (
                                        <tr key={item.id}>
                                            <td><span className="tailark-badge-pill">{item.categoria}</span></td>
                                            <td style={{ maxWidth: '450px', whiteSpace: 'pre-wrap' }}>
                                                {item.contenido.length > 180 ? item.contenido.substring(0, 180) + '...' : item.contenido}
                                            </td>
                                            <td style={{ color: 'var(--tailark-text-muted)', fontSize: '0.8rem' }}>
                                                {item.metadata?.url ? (
                                                    <a href={item.metadata.url} target="_blank" rel="noopener noreferrer" className="brain-source-link">{item.metadata.fuente}</a>
                                                ) : (item.metadata?.fuente || 'Sin fuente')}
                                                {item.metadata?.licencia && <span className="brain-license">{item.metadata.licencia}</span>}
                                            </td>
                                            <td>
                                                <button className="tailark-btn-del" onClick={() => handleDeleteFragment(item.id)}>
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {visibleKnowledge.length === 0 && (
                                        <tr>
                                            <td colSpan="4" style={{ textAlign: 'center', color: 'var(--tailark-text-dim)', padding: '2rem' }}>
                                                {knowledgeSearch ? 'Ningún fragmento coincide con la búsqueda.' : 'Aún no hay conocimiento en esta área. Súbelo desde "Alimentar a AMY".'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── MÓDULO 5: USUARIOS & ROLES ───────────────────────────────────── */}
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
                                            <td style={{ color: 'var(--tailark-text-muted)' }}>{u.email}</td>
                                            <td>
                                                <span className={`tailark-role-badge ${u.rol}`}>
                                                    {u.rol === 'admin' ? 'Administrador' : 'Estudiante'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--tailark-text-dim)', whiteSpace: 'nowrap' }}>
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
                                            <td colSpan="5" style={{ textAlign: 'center', color: 'var(--tailark-text-dim)', padding: '3rem 1rem' }}>
                                                No se encontraron usuarios coincidentes en la base de datos.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── MÓDULO 6: CLAVES DE API (GROQ / GEMINI) ─────────────────────── */}
                {activeNav === 'keys' && (
                    <div className="module-fade-in">
                        <div className="tailark-section-header">
                            <h2 className="tailark-section-title">Claves de API</h2>
                            <p className="tailark-section-subtitle">
                                Renueva las claves de los motores de IA sin reiniciar el sistema. Cada clave se valida con el proveedor antes de guardarse y se almacena cifrada.
                            </p>
                        </div>

                        <div className="adm-keys-grid">
                            {apiKeys.map((k) => {
                                const help = KEY_HELP[k.provider] || {};
                                const busy = keyBusy[k.provider];
                                const fb = keyFeedback[k.provider];
                                const input = keyInputs[k.provider] || '';
                                return (
                                    <div key={k.provider} className="adm-panel adm-key-card">
                                        <div className="adm-panel-head">
                                            <div>
                                                <h3 className="adm-panel-title">{k.label}</h3>
                                                <p className="adm-panel-sub">{help.role}</p>
                                            </div>
                                            <span className={`adm-key-source ${k.source}`}>
                                                {k.source === 'panel' ? 'Desde el panel' : k.source === 'env' ? 'Desde .env' : 'Sin configurar'}
                                            </span>
                                        </div>

                                        <dl className="adm-key-meta">
                                            <div>
                                                <dt>Clave activa</dt>
                                                <dd className="adm-mono">{k.masked || '—'}</dd>
                                            </div>
                                            <div>
                                                <dt>Última renovación</dt>
                                                <dd>
                                                    {k.updatedAt
                                                        ? `${new Date(k.updatedAt).toLocaleString('es-EC')} · ${k.updatedBy}`
                                                        : 'Nunca desde el panel'}
                                                </dd>
                                            </div>
                                        </dl>

                                        <div className="adm-key-actions">
                                            <button
                                                className="adm-btn-ghost"
                                                onClick={() => runKeyAction(k.provider, 'test')}
                                                disabled={!!busy || !k.configured}
                                            >
                                                {busy === 'test' ? 'Probando…' : 'Probar conexión'}
                                            </button>
                                            {k.source === 'panel' && (
                                                <button
                                                    className="adm-btn-ghost"
                                                    onClick={() => runKeyAction(k.provider, 'reset')}
                                                    disabled={!!busy}
                                                    title={k.hasEnvFallback ? 'Volver a usar la clave del archivo .env' : 'No hay clave en .env: el proveedor quedará sin clave'}
                                                >
                                                    {busy === 'reset' ? 'Restableciendo…' : 'Restablecer a .env'}
                                                </button>
                                            )}
                                        </div>

                                        <form
                                            className="adm-key-form"
                                            onSubmit={(e) => { e.preventDefault(); runKeyAction(k.provider, 'save'); }}
                                        >
                                            <label htmlFor={`key-${k.provider}`}>Nueva clave</label>
                                            <div className="adm-key-input-row">
                                                <div className="adm-key-input-wrap">
                                                    <input
                                                        id={`key-${k.provider}`}
                                                        type={keyVisible[k.provider] ? 'text' : 'password'}
                                                        className="tailark-input adm-mono"
                                                        placeholder={`Pega aquí la clave (${help.prefix}…)`}
                                                        autoComplete="off"
                                                        spellCheck="false"
                                                        value={input}
                                                        onChange={(e) => setKeyInputs((s) => ({ ...s, [k.provider]: e.target.value }))}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="adm-key-eye"
                                                        onClick={() => setKeyVisible((v) => ({ ...v, [k.provider]: !v[k.provider] }))}
                                                        aria-label={keyVisible[k.provider] ? 'Ocultar clave' : 'Mostrar clave'}
                                                    >
                                                        {keyVisible[k.provider] ? (
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/></svg>
                                                        ) : (
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                        )}
                                                    </button>
                                                </div>
                                                <button
                                                    type="submit"
                                                    className="tailark-btn-primary adm-key-save"
                                                    disabled={!!busy || input.trim().length < 20}
                                                >
                                                    {busy === 'save' ? 'Validando…' : 'Validar y guardar'}
                                                </button>
                                            </div>
                                            <p className="adm-key-hint">
                                                Obtén una clave nueva en{' '}
                                                <a href={help.url} target="_blank" rel="noopener noreferrer">{help.url.replace('https://', '')}</a>.
                                                Si la clave no es válida, no se guarda y se mantiene la actual.
                                            </p>
                                        </form>

                                        {fb && (
                                            <div className={`tailark-alert ${fb.ok ? 'success' : 'rejected'}`}>
                                                <span>{fb.message}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {apiKeys.length === 0 && (
                                <div className="adm-empty">{loading ? 'Cargando claves…' : 'No se pudo cargar el estado de las claves.'}</div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
