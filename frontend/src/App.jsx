import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated, getUser } from './services/api';
import LandingPage from './pages/LandingPage';
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

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
        </BrowserRouter>
    );
}
