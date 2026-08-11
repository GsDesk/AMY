import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated, getUser } from './services/api';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import './App.css';

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
        </BrowserRouter>
    );
}
