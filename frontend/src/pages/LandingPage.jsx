import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BackgroundLines } from '../components/ui/background-lines';
import './LandingPage.css';

export default function LandingPage() {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 40) {
                setIsScrolled(true);
            } else {
                setIsScrolled(false);
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="landing">
            {/* Header con animación de píldora flotante reactiva al scroll */}
            <div className={`landing-header-container ${isScrolled ? 'is-scrolled' : ''}`}>
                <header className={`landing-header ${isScrolled ? 'floating-pill' : ''}`}>
                    <div className="landing-logo-group">
                        <div className="landing-logo-mark">
                            <img src="/amy-logo.png" alt="AMY" className="landing-logo-img" />
                        </div>
                        <span className="landing-logo">AMY</span>
                    </div>

                    <nav className="landing-center-nav">
                        <a href="#hero" className="landing-nav-link">Inicio</a>
                        <a href="#features" className="landing-nav-link">Funcionalidades</a>
                        <a href="#socratic" className="landing-nav-link">Método Socrático</a>
                        <a href="#architecture" className="landing-nav-link">Arquitectura RAG</a>
                    </nav>

                    <div className="landing-nav-actions">
                        <Link to="/login" className="btn btn-header-login">Iniciar Sesión</Link>
                        <Link to="/register" className="btn btn-header-register">Comenzar</Link>
                    </div>
                </header>
            </div>

            {/* Hero decorado con BackgroundLines */}
            <BackgroundLines className="hero-background-wrapper">
                <section className="hero" id="hero">
                    <div className="hero-content">
                        <span className="hero-badge">UPEC / Ingeniería en Computación</span>
                        <h1 className="hero-title">
                            Aprende Bases de Datos<br/>
                            con <span className="hero-accent">AMY</span>
                        </h1>
                        <p className="hero-subtitle">
                            Asistente inteligente que te guía con el método socrático 
                            para dominar SQL, normalización, modelo E-R y álgebra relacional. 
                            Sin respuestas directas, solo preguntas que te llevan a la solución.
                        </p>
                        <div className="hero-actions">
                            <Link to="/register" className="btn btn-primary btn-lg">
                                Comenzar ahora
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                            </Link>
                            <a href="#features" className="btn btn-lg btn-outline">Ver funcionalidades</a>
                        </div>
                    </div>

                    <div className="hero-visual">
                        <div className="hero-terminal">
                            <div className="terminal-bar">
                                <span className="terminal-dot red"></span>
                                <span className="terminal-dot yellow"></span>
                                <span className="terminal-dot green"></span>
                                <span className="terminal-title">AMY / Sesión Educativa</span>
                            </div>
                            <div className="terminal-body">
                                <div className="terminal-line">
                                    <span className="t-label">Estudiante:</span>
                                    <span className="t-text">¿Cómo hago un JOIN entre dos tablas?</span>
                                </div>
                                <div className="terminal-line amy-line">
                                    <span className="t-label">AMY:</span>
                                    <span className="t-text">Antes de escribir el JOIN, ¿qué columna tienen en común ambas tablas? Piensa en la relación entre ellas.</span>
                                </div>
                                <div className="terminal-line">
                                    <span className="t-label">Estudiante:</span>
                                    <span className="t-text">El id_departamento está en ambas...</span>
                                </div>
                                <div className="terminal-line amy-line">
                                    <span className="t-label">AMY:</span>
                                    <span className="t-text">Exacto. Ahora, ¿qué tipo de JOIN usarías si quieres ver TODOS los empleados, incluso los que no tienen departamento?</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </BackgroundLines>

            {/* Features */}
            <section className="features" id="features">
                <h2 className="section-title">Funcionalidades Principales</h2>
                <div className="features-grid">
                    <div className="feature-card panel">
                        <div className="feature-icon">RAG</div>
                        <h3>Base de Conocimiento</h3>
                        <p>Dataset académico indexado con vectores de 768 dimensiones. Respuestas fundamentadas en fuentes bibliográficas reales.</p>
                    </div>
                    <div className="feature-card panel">
                        <div className="feature-icon">SQL</div>
                        <h3>Temas Completos</h3>
                        <p>SQL, normalización (1NF-BCNF), modelo entidad-relación, álgebra relacional, transacciones ACID, índices y optimización.</p>
                    </div>
                    <div className="feature-card panel">
                        <div className="feature-icon">IA</div>
                        <h3>Mistral Local</h3>
                        <p>Motor de inteligencia artificial ejecutándose localmente. Sin dependencias en la nube, total privacidad de datos.</p>
                    </div>
                    <div className="feature-card panel">
                        <div className="feature-icon">MD</div>
                        <h3>Código Formateado</h3>
                        <p>Respuestas con Markdown y resaltado de sintaxis SQL. Visualiza consultas con formato profesional.</p>
                    </div>
                </div>
            </section>

            {/* Método Socrático */}
            <section className="features" id="socratic" style={{ paddingTop: '1rem' }}>
                <h2 className="section-title">Metodología Pedagógica Socrática</h2>
                <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <div className="feature-card panel">
                        <div className="feature-icon">01</div>
                        <h3>Inducción Reflexiva</h3>
                        <p>AMY no entrega el código final de inmediato; te ayuda a descomponer el problema en premisas lógicas para que descubras la respuesta.</p>
                    </div>
                    <div className="feature-card panel">
                        <div className="feature-icon">02</div>
                        <h3>Diagnóstico de Errores</h3>
                        <p>Si cometes un error conceptual en una clave foránea o forma normal, AMY te formula contraejemplos para validar tu razonamiento.</p>
                    </div>
                    <div className="feature-card panel">
                        <div className="feature-icon">03</div>
                        <h3>Validación de Esquemas</h3>
                        <p>Visualiza diagramas entidad-relación generados dinámicamente y scripts SQL DDL verificados en tiempo real.</p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer" id="architecture">
                <div className="footer-content">
                    <div className="footer-brand">
                        <span className="footer-logo">AMY</span>
                        <span className="footer-sep">|</span>
                        <span>Fundamentos de Bases de Datos</span>
                    </div>
                    <div className="footer-info">
                        Universidad Politécnica Estatal del Carchi — UPEC
                    </div>
                </div>
            </footer>
        </div>
    );
}

