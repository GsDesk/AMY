import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, googleLogin, getAuthConfig } from '../services/api';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import './RegisterPage.css';

export default function RegisterPage() {
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleClientId, setGoogleClientId] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        getAuthConfig()
            .then((data) => {
                if (data.googleClientId) {
                    setGoogleClientId(data.googleClientId);
                }
            })
            .catch((err) => {
                console.error("Error al obtener la configuracion de auth:", err);
            });
    }, []);

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        setError('');
        try {
            await googleLogin(credentialResponse.credential);
            navigate('/chat');
        } catch (err) {
            setError(err.message || 'Error al registrarse con Google.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Fallo el registro con Google.');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const nombreTrimmed = nombre.trim();
        const emailTrimmed = email.trim().toLowerCase();

        if (!nombreTrimmed) {
            setError('Ingresa tu nombre.');
            return;
        }

        if (!emailTrimmed) {
            setError('Ingresa tu correo electronico.');
            return;
        }

        if (!password) {
            setError('Ingresa una contrasena.');
            return;
        }

        if (password.length < 6) {
            setError('La contrasena debe tener al menos 6 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contrasenas no coinciden.');
            return;
        }

        setLoading(true);

        try {
            await register(emailTrimmed, password, nombreTrimmed);
            navigate('/chat');
        } catch (err) {
            setError(err.message || 'Error al registrarse.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card panel">
                <div className="login-header">
                    <Link to="/login" className="login-back">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    </Link>
                    <div className="login-brand">AMY</div>
                    <p className="login-subtitle">Crear cuenta</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="nombre">Nombre</label>
                        <input
                            id="nombre"
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Tu nombre completo"
                            autoComplete="name"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Correo electronico</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@correo.com"
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Contrasena</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimo 6 caracteres"
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirmar contrasena</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repite tu contrasena"
                            autoComplete="new-password"
                        />
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg login-btn"
                        disabled={loading}
                    >
                        {loading ? 'Registrando...' : 'Crear cuenta'}
                    </button>
                </form>

                {googleClientId && (
                    <GoogleOAuthProvider clientId={googleClientId}>
                        <div className="login-separator">
                            <span>o continuar con</span>
                        </div>
                        <div className="google-btn-container">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={handleGoogleError}
                                theme="filled_dark"
                                size="large"
                                width="320"
                                text="signup_with"
                                shape="rectangular"
                            />
                        </div>
                    </GoogleOAuthProvider>
                )}

                <div className="login-footer">
                    <span>Ya tienes cuenta? <Link to="/login" className="login-link">Inicia sesion</Link></span>
                </div>
            </div>
        </div>
    );
}
