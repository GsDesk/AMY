import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, googleLogin, loginWithMicrosoft, getAuthConfig } from '../services/api';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { PublicClientApplication } from '@azure/msal-browser';
import './LoginPage.css';

let msalInstance = null;

async function getMsal(azureClientId, azureTenantId) {
    if (!msalInstance) {
        msalInstance = new PublicClientApplication({
            auth: {
                clientId: azureClientId || 'b70d884c-ba19-48f3-ac91-a1e24f14e544',
                authority: `https://login.microsoftonline.com/${azureTenantId || '0a42bec9-732b-45d1-977d-3b8d3ac98c2b'}`,
                redirectUri: window.location.origin
            },
            cache: {
                cacheLocation: 'sessionStorage'
            }
        });
        await msalInstance.initialize();
    }
    return msalInstance;
}

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [authConfig, setAuthConfig] = useState(null);
    const navigate = useNavigate();

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
            console.error("Fallo la autenticación con Microsoft:", err);
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

    return (
        <div className="login-page-split">
            {/* Columna Izquierda: Formulario de Autenticación */}
            <div className="login-form-pane">
                <div className="login-form-container">
                    <div className="login-pane-header">
                        <Link to="/" className="login-geometric-logo" title="Volver al inicio">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                            </svg>
                        </Link>
                        <h1 className="login-main-title">Welcome Back</h1>
                        <p className="login-main-subtitle">Ingresa a tu cuenta para continuar con tu tutor socrático</p>
                    </div>

                    {/* Botones SSO */}
                    <div className="login-sso-stack">
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
                            <span>Continue with Microsoft (UPEC)</span>
                        </button>

                        {authConfig?.googleClientId && (
                            <GoogleOAuthProvider clientId={authConfig.googleClientId}>
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
                        <span>or</span>
                    </div>

                    <form className="login-fields-form" onSubmit={handleSubmit}>
                        <div className="login-input-group">
                            <label htmlFor="email">Email</label>
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
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Ingresa tu contraseña"
                                autoComplete="current-password"
                            />
                        </div>

                        {error && <div className="login-error-alert">{error}</div>}

                        <button
                            type="submit"
                            className="btn-login-submit"
                            disabled={loading}
                        >
                            {loading ? 'Verificando...' : 'Continue with Email'}
                        </button>
                    </form>

                    <div className="login-switch-footer">
                        <span>Don't have an account? <Link to="/register" className="login-link-highlight">Sign up</Link></span>
                    </div>

                    <div className="login-legal-footer">
                        <a href="#privacy">Privacy</a>
                        <a href="#terms">Terms</a>
                        <a href="#cookies">Cookies</a>
                        <span>UPEC</span>
                    </div>
                </div>
            </div>

            {/* Columna Derecha: Showcase Visual & Testimonial Académico */}
            <div className="login-showcase-pane">
                <div className="showcase-atmosphere"></div>
                <div className="showcase-content-box">
                    <div className="showcase-quote-wrapper">
                        <p className="showcase-quote">
                            "El método socrático transforma la intuición en maestría técnica de Bases de Datos."
                        </p>
                        <div className="showcase-author-card">
                            <div className="showcase-avatar">A</div>
                            <div className="showcase-author-info">
                                <span className="showcase-name">AMY Socrático</span>
                                <span className="showcase-role">Tutor IA · Universidad Politécnica Estatal del Carchi</span>
                            </div>
                        </div>
                    </div>

                    <div className="showcase-tech-cloud">
                        <span className="tech-badge">PostgreSQL</span>
                        <span className="tech-badge">pgvector</span>
                        <span className="tech-badge">Redis</span>
                        <span className="tech-badge">Mistral 7B</span>
                        <span className="tech-badge">FastAPI</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
