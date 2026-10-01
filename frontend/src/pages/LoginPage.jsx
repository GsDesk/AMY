import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, googleLogin, loginWithMicrosoft, getAuthConfig, forgotPassword, resetPassword } from '../services/api';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { DEFAULT_GOOGLE_CLIENT_ID, getMsal } from '../services/sso';
import './AuthMotion.css';
import ThemeToggle from '../components/ThemeToggle';
import CubeLatticeAnimation from '../components/CubeLatticeAnimation';
import './LoginPage.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [authConfig, setAuthConfig] = useState(null);
    const navigate = useNavigate();

    // Estados para el Modal de Recuperación de Contraseña
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotStep, setForgotStep] = useState(1); // 1: Pedir correo, 2: Ingresar código + nueva contraseña
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotCode, setForgotCode] = useState('');
    const [forgotNewPassword, setForgotNewPassword] = useState('');
    const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
    const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
    const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotError, setForgotError] = useState('');
    const [forgotSuccess, setForgotSuccess] = useState('');
    const [devCodePreview, setDevCodePreview] = useState('');

    const googleClientId = authConfig?.googleClientId || DEFAULT_GOOGLE_CLIENT_ID;

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('expired') === '1') {
            setError('Tu sesión anterior ha expirado. Por favor, inicia sesión nuevamente.');
        }

        getAuthConfig()
            .then(setAuthConfig)
            .catch((err) => console.error("Error al cargar la configuración de autenticación:", err));
    }, []);

    const handleMicrosoftLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const msal = await getMsal(authConfig?.azureClientId, authConfig?.azureTenantId);
            const response = await msal.loginPopup({
                scopes: ['User.Read', 'GroupMember.Read.All']
            });

            const data = await loginWithMicrosoft(response.accessToken);
            if (data.user?.rol === 'admin') {
                navigate('/admin');
            } else {
                navigate('/chat');
            }
        } catch (err) {
            console.error("Falló la autenticación con Microsoft:", err);
            setError(err.message || 'Error al autenticar con la cuenta institucional de la UPEC.');
        } finally {
            setLoading(false);
        }
    };

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
            setError(err.message || 'Error al iniciar sesión con Google.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Falló la autenticación con Google.');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const emailTrimmed = email.trim().toLowerCase();
        if (!emailTrimmed) {
            setError('Ingresa tu correo electrónico.');
            return;
        }
        if (!password) {
            setError('Ingresa tu contraseña.');
            return;
        }

        setLoading(true);

        try {
            const data = await login(emailTrimmed, password);
            if (data.user?.rol === 'admin') {
                navigate('/admin');
            } else {
                navigate('/chat');
            }
        } catch (err) {
            setError(err.message || 'Error al iniciar sesión.');
        } finally {
            setLoading(false);
        }
    };

    // Manejo de Solicitud de Código de Recuperación (Paso 1)
    const handleSendForgotCode = async (e) => {
        e.preventDefault();
        setForgotError('');
        setForgotSuccess('');
        const targetEmail = forgotEmail.trim().toLowerCase();

        if (!targetEmail) {
            setForgotError('Ingresa tu correo electrónico.');
            return;
        }

        setForgotLoading(true);
        try {
            const res = await forgotPassword(targetEmail);
            setForgotSuccess('Se ha enviado un código temporal de recuperación a tu correo.');
            if (res.code_preview) {
                setDevCodePreview(res.code_preview);
            }
            setForgotStep(2);
        } catch (err) {
            setForgotError(err.message || 'No se pudo enviar el código de recuperación.');
        } finally {
            setForgotLoading(false);
        }
    };

    // Manejo de Restablecimiento de Contraseña (Paso 2)
    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        setForgotError('');
        setForgotSuccess('');

        const targetEmail = forgotEmail.trim().toLowerCase();
        const codeTrimmed = forgotCode.trim();

        if (!codeTrimmed || codeTrimmed.length !== 6) {
            setForgotError('Ingresa el código numérico de 6 dígitos.');
            return;
        }

        if (!forgotNewPassword || forgotNewPassword.length < 6) {
            setForgotError('La nueva contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (forgotNewPassword !== forgotConfirmPassword) {
            setForgotError('Las contraseñas no coinciden.');
            return;
        }

        setForgotLoading(true);
        try {
            await resetPassword(targetEmail, codeTrimmed, forgotNewPassword);
            setForgotSuccess('Tu contraseña ha sido restablecida exitosamente. Puedes iniciar sesión ahora.');
            setTimeout(() => {
                setShowForgotModal(false);
                setEmail(targetEmail);
                setPassword('');
            }, 1800);
        } catch (err) {
            setForgotError(err.message || 'Error al restablecer la contraseña.');
        } finally {
            setForgotLoading(false);
        }
    };

    return (
        <div className="login-page-split">
            {/* Columna Izquierda: Formulario de Autenticación */}
            <div className="login-form-pane">
                <div className="login-form-container">
                    <div className="login-pane-header">
                        <div className="login-header-top-bar">
                            <Link to="/" className="login-geometric-logo" title="Volver al inicio">
                                <img src="/amy-logo.png" alt="AMY Logo" className="login-logo-img" />
                            </Link>
                            <ThemeToggle className="auth-theme-toggle" />
                        </div>
                        <h1 className="login-main-title">Bienvenido de Nuevo</h1>
                        <p className="login-main-subtitle">Ingresa a tu cuenta para continuar con tu tutor socrático</p>
                    </div>

                    {/* Botones SSO */}
                    <div className="login-sso-stack">
                        <div className="sso-item-wrapper">
                            <button
                                type="button"
                                className="sso-provider-btn"
                                onClick={handleMicrosoftLogin}
                                disabled={loading}
                            >
                                <svg className="sso-icon" viewBox="0 0 23 23" fill="none">
                                    <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
                                    <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
                                    <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
                                    <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
                                </svg>
                                <span>Continuar con Microsoft (UPEC)</span>
                            </button>
                            <div className="sso-note-caption">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                                </svg>
                                <span>Solo para docentes y administradores con acceso</span>
                            </div>
                        </div>

                        {googleClientId && (
                            <GoogleOAuthProvider clientId={googleClientId}>
                                <div className="google-sso-wrapper">
                                    <GoogleLogin
                                        onSuccess={handleGoogleSuccess}
                                        onError={handleGoogleError}
                                        theme="filled_dark"
                                        size="large"
                                        width="100%"
                                        text="continue_with"
                                        shape="rectangular"
                                    />
                                </div>
                            </GoogleOAuthProvider>
                        )}
                    </div>

                    <div className="login-divider-line">
                        <span>o</span>
                    </div>

                    <form className="login-fields-form" onSubmit={handleSubmit}>
                        <div className="login-input-group">
                            <label htmlFor="email">Correo Electrónico</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu.correo@upec.edu.ec"
                                autoComplete="email"
                                autoFocus
                            />
                        </div>

                        <div className="login-input-group">
                            <div className="login-password-header">
                                <label htmlFor="password">Contraseña</label>
                                <button
                                    type="button"
                                    className="login-forgot-pwd-btn"
                                    onClick={() => {
                                        setShowForgotModal(true);
                                        setForgotEmail(email.trim());
                                        setForgotStep(1);
                                        setForgotError('');
                                        setForgotSuccess('');
                                        setDevCodePreview('');
                                    }}
                                >
                                    ¿Olvidaste tu contraseña?
                                </button>
                            </div>
                            <div className="password-input-wrapper">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Ingresa tu contraseña"
                                    autoComplete="current-password"
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

                        {error && <div className="login-error-alert" role="alert">{error}</div>}

                        <button
                            type="submit"
                            className="btn-login-submit"
                            disabled={loading}
                        >
                            {loading ? 'Verificando...' : 'Iniciar Sesión'}
                        </button>
                    </form>

                    <div className="login-switch-footer">
                        <span>¿No tienes una cuenta? <Link to="/register" className="login-link-highlight">Regístrate</Link></span>
                    </div>
                </div>
            </div>

            {/* Modal de Recuperación de Contraseña */}
            {showForgotModal && (
                <div className="forgot-modal-overlay" onClick={() => setShowForgotModal(false)}>
                    <div className="forgot-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="forgot-modal-header">
                            <div className="forgot-modal-badge">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                                <span>Recuperación Segura</span>
                            </div>
                            <button className="forgot-modal-close" onClick={() => setShowForgotModal(false)} aria-label="Cerrar modal">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <h3 className="forgot-modal-title">
                            {forgotStep === 1 ? 'Recuperar Contraseña' : 'Crear Nueva Contraseña'}
                        </h3>
                        <p className="forgot-modal-desc">
                            {forgotStep === 1
                                ? 'Ingresa tu correo registrado para recibir un código temporal de recuperación de 6 dígitos.'
                                : `Ingresa el código de 6 dígitos enviado a ${forgotEmail} y define tu nueva contraseña.`}
                        </p>

                        {/* Banner con código de desarrollo */}
                        {devCodePreview && (
                            <div className="forgot-dev-code-box">
                                <span className="dev-code-label">Código de recuperación:</span>
                                <span className="dev-code-value">{devCodePreview}</span>
                            </div>
                        )}

                        {forgotError && <div className="login-error-alert" role="alert">{forgotError}</div>}
                        {forgotSuccess && <div className="forgot-success-alert">{forgotSuccess}</div>}

                        {forgotStep === 1 ? (
                            <form onSubmit={handleSendForgotCode} className="forgot-modal-form">
                                <div className="login-input-group">
                                    <label>Correo Electrónico</label>
                                    <input
                                        type="email"
                                        value={forgotEmail}
                                        onChange={(e) => setForgotEmail(e.target.value)}
                                        placeholder="tu.correo@upec.edu.ec"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="forgot-actions-row">
                                    <button
                                        type="button"
                                        className="btn-forgot-cancel"
                                        onClick={() => setShowForgotModal(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-forgot-submit"
                                        disabled={forgotLoading}
                                    >
                                        {forgotLoading ? 'Enviando código...' : 'Enviar Código'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleResetPasswordSubmit} className="forgot-modal-form">
                                <div className="login-input-group">
                                    <label>Código de 6 Dígitos</label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        value={forgotCode}
                                        onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ''))}
                                        placeholder="123456"
                                        className="forgot-code-input"
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="login-input-group">
                                    <label>Nueva Contraseña</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showForgotNewPassword ? "text" : "password"}
                                            value={forgotNewPassword}
                                            onChange={(e) => setForgotNewPassword(e.target.value)}
                                            placeholder="Mínimo 6 caracteres"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="toggle-password-btn"
                                            onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                                                >
                                            {showForgotNewPassword ? 'Ocultar' : 'Ver'}
                                        </button>
                                    </div>
                                </div>

                                <div className="login-input-group">
                                    <label>Confirmar Nueva Contraseña</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showForgotConfirmPassword ? "text" : "password"}
                                            value={forgotConfirmPassword}
                                            onChange={(e) => setForgotConfirmPassword(e.target.value)}
                                            placeholder="Repite tu contraseña"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="toggle-password-btn"
                                            onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                                                >
                                            {showForgotConfirmPassword ? 'Ocultar' : 'Ver'}
                                        </button>
                                    </div>
                                </div>

                                <div className="forgot-actions-row">
                                    <button
                                        type="button"
                                        className="btn-forgot-cancel"
                                        onClick={() => setForgotStep(1)}
                                    >
                                        Atrás
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-forgot-submit"
                                        disabled={forgotLoading}
                                    >
                                        {forgotLoading ? 'Restableciendo...' : 'Restablecer Contraseña'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Columna Derecha: Showcase Visual con Animación 3D Anime.js */}
            <div className="login-showcase-pane">
                <CubeLatticeAnimation className="login-showcase-lattice" interactive={true} />
            </div>
        </div>
    );
}
