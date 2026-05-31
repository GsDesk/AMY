import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import './LoginPage.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const emailTrimmed = email.trim().toLowerCase();

        if (!emailTrimmed) {
            setError('Ingresa tu correo electronico.');
            return;
        }

        if (!password) {
            setError('Ingresa tu contrasena.');
            return;
        }

        setLoading(true);

        try {
            await login(emailTrimmed, password);
            navigate('/chat');
        } catch (err) {
            setError(err.message || 'Error al iniciar sesion.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card panel">
                <div className="login-header">
                    <Link to="/" className="login-back">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    </Link>
                    <div className="login-brand">AMY</div>
                    <p className="login-subtitle">Iniciar sesion</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="email">Correo electronico</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@correo.com"
                            autoComplete="email"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Contrasena</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Tu contrasena"
                            autoComplete="current-password"
                        />
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg login-btn"
                        disabled={loading}
                    >
                        {loading ? 'Ingresando...' : 'Iniciar sesion'}
                    </button>
                </form>

                <div className="login-footer">
                    <span>No tienes cuenta? <Link to="/register" className="login-link">Registrate</Link></span>
                </div>
            </div>
        </div>
    );
}
