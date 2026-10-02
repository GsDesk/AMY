import { lazy, Suspense, Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated, getUser } from './services/api';
import { loadChatPage, loadAdminPage } from './services/preload';
import LandingPage from './pages/LandingPage';

// En redes móviles la descarga de un chunk puede fallar: se reintenta antes de rendirse
function lazyWithRetry(loader, retries = 2) {
    return lazy(async () => {
        for (let attempt = 0; ; attempt++) {
            try {
                return await loader();
            } catch (err) {
                if (attempt >= retries) throw err;
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
        }
    });
}

const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'));
const RegisterPage = lazyWithRetry(() => import('./pages/RegisterPage'));
const ChatPage = lazyWithRetry(loadChatPage);
const AdminPage = lazyWithRetry(loadAdminPage);

// Si una pantalla no se pudo descargar, ofrecer reintentar en vez de quedarse cargando
class ChunkErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch(error) {
        console.error('No se pudo cargar la pantalla:', error);
    }
    render() {
        if (this.state.failed) {
            return (
                <div role="alert" className="route-loading route-error">
                    <p>No se pudo cargar AMY. Revisa tu conexión a internet.</p>
                    <button type="button" onClick={() => window.location.reload()}>Reintentar</button>
                </div>
            );
        }
        return this.props.children;
    }
}

function ProtectedRoute({ children }) {
    if (!isAuthenticated()) return <Navigate to="/login" replace />;
    return children;
}

function AdminProtectedRoute({ children }) {
    if (!isAuthenticated()) return <Navigate to="/login" replace />;
    const user = getUser();
    if (!user || user.rol !== 'admin') return <Navigate to="/chat" replace />;
    return children;
}

export default function App() {
    return (
        <BrowserRouter>
            <ChunkErrorBoundary>
            <Suspense fallback={<div role="status" className="route-loading">Cargando AMY…</div>}>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/chat" element={
                    <ProtectedRoute>
                        <ChatPage />
                    </ProtectedRoute>
                } />
                <Route path="/admin" element={
                    <AdminProtectedRoute>
                        <AdminPage />
                    </AdminProtectedRoute>
                } />
            </Routes>
            </Suspense>
            </ChunkErrorBoundary>
        </BrowserRouter>
    );
}
