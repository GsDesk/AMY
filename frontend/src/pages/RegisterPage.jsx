import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, googleLogin, loginWithMicrosoft, getAuthConfig } from '../services/api';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { PublicClientApplication } from '@azure/msal-browser';
import './RegisterPage.css';

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

    useEffect(() => {
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

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
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

    const [activeTab, setActiveTab] = useState('sql');

    const CODE_SNIPPETS = {
        sql: `1  -- Esquema Relacional de Gestión Académica UPEC
2  CREATE TABLE Estudiantes (
3      id_estudiante UUID PRIMARY KEY DEFAULT gen_random_uuid(),
4      nombre_completo VARCHAR(120) NOT NULL,
5      correo_institucional VARCHAR(100) UNIQUE NOT NULL,
6      semestre INT CHECK (semestre BETWEEN 1 AND 10),
7      promedio_acumulado NUMERIC(4,2) DEFAULT 0.00
8  );
9  
10 CREATE TABLE Asignaturas (
11     codigo_materia VARCHAR(10) PRIMARY KEY,
12     nombre_asignatura VARCHAR(100) NOT NULL,
13     creditos_academicos INT NOT NULL
14 );
15 
16 CREATE TABLE Matriculas (
17     id_matricula UUID PRIMARY KEY DEFAULT gen_random_uuid(),
18     id_estudiante UUID REFERENCES Estudiantes(id_estudiante),
19     codigo_materia VARCHAR(10) REFERENCES Asignaturas(codigo_materia),
20     fecha_inscripcion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
21 );
22 
23 -- Consulta con JOIN optimizado por índice B-Tree
24 SELECT e.nombre_completo, a.nombre_asignatura 
25 FROM Estudiantes e
26 INNER JOIN Matriculas m ON e.id_estudiante = m.id_estudiante
27 INNER JOIN Asignaturas a ON m.codigo_materia = a.codigo_materia;`,
        algebra: `1  -- Operaciones de Álgebra Relacional Socráticas
2  -- 1. Proyección (π): Seleccionar atributos específicos
3  π_{nombre_completo, correo_institucional}(Estudiantes)
4  
5  -- 2. Selección (σ): Filtrar tuplas con condición booleana
6  σ_{semestre >= 5 ∧ promedio_acumulado >= 8.5}(Estudiantes)
7  
8  -- 3. Reunión Natural (⨝): Cruce de relaciones por clave foránea
9  Estudiantes ⨝_{Estudiantes.id_estudiante = Matriculas.id_estudiante} Matriculas
10 
11 -- 4. División Relacional (÷): Estudiantes matriculados en TODAS las materias
12 (π_{id_estudiante, codigo_materia}(Matriculas)) ÷ (π_{codigo_materia}(Asignaturas))`,
        rag: `1  # AMY Core — Pipeline RAG Pedagógico UPEC
2  from fastapi import FastAPI, Depends
3  from app.rag.embeddings import generate_embedding
4  from app.rag.vector_store import query_academic_fragments
5  
6  @app.post("/api/chat/socratic")
7  async def socratic_guidance(query: str, db=Depends(get_db)):
8      query_vector = await generate_embedding(query)
9      fragments = await query_academic_fragments(query_vector, k=5)
10     
11     # Generación reflexiva sin entregar solución directa
12     prompt = build_socratic_prompt(query, fragments)
13     return stream_mistral_response(prompt)`
    };

    return (
        <div className="register-split-layout">
            <div className="register-workspace-wrapper">
                {/* Lado Izquierdo: Editor de Código Mockup */}
                <div className="register-code-window">
                    <div className="code-window-header">
                        <div className="code-tabs-list">
                            <button
                                type="button"
                                className={`code-tab-btn ${activeTab === 'sql' ? 'active' : ''}`}
                                onClick={() => setActiveTab('sql')}
                            >
                                <span className="tab-dot sql"></span>
                                <span>SQL Schema DDL</span>
                            </button>
                            <button
                                type="button"
                                className={`code-tab-btn ${activeTab === 'algebra' ? 'active' : ''}`}
                                onClick={() => setActiveTab('algebra')}
                            >
                                <span className="tab-dot algebra"></span>
                                <span>Álgebra Relacional</span>
                            </button>
                            <button
                                type="button"
                                className={`code-tab-btn ${activeTab === 'rag' ? 'active' : ''}`}
                                onClick={() => setActiveTab('rag')}
                            >
                                <span className="tab-dot rag"></span>
                                <span>FastAPI RAG</span>
                            </button>
                        </div>
                    </div>

                    <div className="code-window-body">
                        <pre className="code-pre">
                            <code>{CODE_SNIPPETS[activeTab]}</code>
                        </pre>
                    </div>
                </div>

                {/* Lado Derecho: Tarjeta de Registro */}
                <div className="register-card-container">
                    <div className="register-floating-card">
                        <div className="card-window-dots">
                            <span className="dot red"></span>
                            <span className="dot yellow"></span>
                            <span className="dot green"></span>
                        </div>

                        <div className="register-card-header">
                            <Link to="/" className="register-card-logo" title="Volver al inicio">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                </svg>
                            </Link>
                            <h2>Bienvenido a AMY</h2>
                            <p>Crea tu cuenta institucional o personal</p>
                        </div>

                        {/* Botones SSO */}
                        <div className="register-sso-group">
                            <button
                                type="button"
                                className="sso-pill-btn"
                                onClick={handleMicrosoftLogin}
                                disabled={loading}
                            >
                                <svg className="sso-icon" viewBox="0 0 23 23" fill="none">
                                    <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
                                    <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
                                    <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
                                    <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
                                </svg>
                                <span>Microsoft UPEC</span>
                            </button>

                            {authConfig?.googleClientId && (
                                <GoogleOAuthProvider clientId={authConfig.googleClientId}>
                                    <div className="google-sso-container">
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

                        <div className="register-divider">
                            <span>o completa tus datos</span>
                        </div>

                        <form className="register-fields-form" onSubmit={handleSubmit}>
                            <div className="register-input-row">
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

                            <div className="register-input-row">
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

                            <div className="register-input-row">
                                <label htmlFor="reg-password">Contraseña</label>
                                <div className="password-input-wrapper">
                                    <input
                                        id="reg-password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Mínimo 6 caracteres"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        className="toggle-password-btn"
                                        onClick={() => setShowPassword(!showPassword)}
                                        title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        tabIndex="-1"
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

                            <div className="register-input-row">
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
                                        tabIndex="-1"
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

                            {error && <div className="register-error-banner">{error}</div>}

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
            </div>
        </div>
    );
}
