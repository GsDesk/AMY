import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, googleLogin, getAuthConfig } from '../services/api';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { DEFAULT_GOOGLE_CLIENT_ID } from '../services/sso';
import './AuthMotion.css';
import ThemeToggle from '../components/ThemeToggle';
import CubeLatticeAnimation from '../components/CubeLatticeAnimation';
import './RegisterPage.css';

export default function RegisterPage() {
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [authConfig, setAuthConfig] = useState(null);
    const navigate = useNavigate();

    const googleClientId = authConfig?.googleClientId || DEFAULT_GOOGLE_CLIENT_ID;

    useEffect(() => {
        getAuthConfig()
            .then(setAuthConfig)
            .catch((err) => console.error("Error al cargar la configuración de autenticación:", err));
    }, []);

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        setError('');
        try {
            const data = await googleLogin(credentialResponse.credential);
            if (data.user?.rol === 'admin') {
                navigate('/admin');
            } else {
                navigate('/chat');
            }
        } catch (err) {
            setError(err.message || 'Error al registrarse con Google.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Falló el registro con Google.');
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
            setError('Ingresa tu correo electrónico.');
            return;
        }

        if (!password) {
            setError('Ingresa una contraseña.');
            return;
        }

        if (password.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);

        try {
            const data = await register(emailTrimmed, password, nombreTrimmed);
            if (data.user?.rol === 'admin') {
                navigate('/admin');
            } else {
                navigate('/chat');
            }
        } catch (err) {
            setError(err.message || 'Error al registrarse.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="register-page-split">
            {/* Columna Izquierda: Formulario de Registro */}
            <div className="register-form-pane">
                <div className="register-form-container">
                    <div className="register-pane-header">
                        <div className="register-header-top-bar">
                            <Link to="/" className="register-geometric-logo" title="Volver al inicio">
                                <img src="/amy-logo.png" alt="AMY Logo" className="register-logo-img" />
                            </Link>
                            <ThemeToggle className="auth-theme-toggle" />
                        </div>
                        <h1 className="register-main-title">Bienvenido a AMY</h1>
                        <p className="register-main-subtitle">Crea tu cuenta para empezar a aprender con AMY</p>
                    </div>

                    {/* Botones SSO */}
                    <div className="register-sso-stack">
                        {googleClientId && (
                            <GoogleOAuthProvider clientId={googleClientId}>
                                <div className="google-sso-wrapper">
                                    <GoogleLogin
                                        onSuccess={handleGoogleSuccess}
                                        onError={handleGoogleError}
                                        theme="filled_dark"
                                        size="large"
                                        width="100%"
                                        text="signup_with"
                                        shape="rectangular"
                                    />
                                </div>
                            </GoogleOAuthProvider>
                        )}
                    </div>

                    <div className="register-divider-line">
                        <span>o completa tus datos</span>
                    </div>

                    <form className="register-fields-form" onSubmit={handleSubmit}>
                        <div className="register-input-group">
                            <label htmlFor="reg-nombre">Nombre Completo</label>
                            <input
                                id="reg-nombre"
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                placeholder="Tu nombre completo"
                                autoComplete="name"
                                autoFocus
                            />
                        </div>

                        <div className="register-input-group">
                            <label htmlFor="reg-email">Correo Electrónico</label>
                            <input
                                id="reg-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu.correo@upec.edu.ec"
                                autoComplete="email"
                            />
                        </div>

                        <div className="register-input-group">
                            <label htmlFor="reg-password">Contraseña</label>
                            <div className="password-input-wrapper">
                                <input
                                    id="reg-password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Mínimo 8 caracteres"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="toggle-password-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                >
                                    {showPassword ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="register-input-group">
                            <label htmlFor="reg-confirm">Confirmar Contraseña</label>
                            <div className="password-input-wrapper">
                                <input
                                    id="reg-confirm"
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Repite tu contraseña"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="toggle-password-btn"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    title={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                >
                                    {showConfirmPassword ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && <div className="register-error-banner" role="alert">{error}</div>}

                        <button
                            type="submit"
                            className="btn-register-submit"
                            disabled={loading}
                        >
                            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                        </button>
                    </form>

                    <div className="register-switch-link">
                        <span>¿Ya tienes una cuenta? <Link to="/login" className="link-signin">Iniciar Sesión</Link></span>
                    </div>
                </div>
            </div>

            {/* Columna Derecha: Showcase Visual con Animación 3D Anime.js */}
            <div className="register-showcase-pane">
                <CubeLatticeAnimation className="register-showcase-lattice" interactive={true} />
            </div>
        </div>
    );
}
