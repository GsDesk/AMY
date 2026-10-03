import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BackgroundLines } from '../components/ui/background-lines';
import ThemeToggle from '../components/ThemeToggle';
import KnowledgeAnimation from '../components/landing/KnowledgeAnimation';
import { FeatureExplorer, SocraticDemo } from '../components/landing/LandingExplorers';
import PublicArchitecture from '../components/landing/PublicArchitecture';
import CampusTour from '../components/landing/campus/CampusTour';
import './LandingPage.css';


export default function LandingPage() {
    const pageRef = useRef(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const [activeSection, setActiveSection] = useState('hero');

    const scrollToSection = (id, smooth = true) => {
        const target = document.getElementById(id);
        if (!target) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ behavior: smooth && !reduced ? 'smooth' : 'instant', block: 'start' });
    };

    const handleSectionLink = (event, id) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (window.location.hash !== `#${id}`) window.history.pushState(null, '', `#${id}`);
        scrollToSection(id);
    };

    useEffect(() => {
        let frame;
        const update = () => {
            setIsScrolled(window.scrollY > 40);
            const sections = ['hero', 'features', 'socratic', 'architecture', 'campus'];
            const current = sections.filter(id => document.getElementById(id)?.getBoundingClientRect().top <= 190).pop();
            setActiveSection(current || 'hero');
        };
        const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
        const followHash = () => scrollToSection(window.location.hash.slice(1) || 'hero', false);
        update();
        if (window.location.hash) frame = requestAnimationFrame(followHash);
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('hashchange', followHash);
        return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('hashchange', followHash); };
    }, []);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-revealed');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12 });
        const cards = pageRef.current.querySelectorAll('.feature-card, .landing-cta');
        cards.forEach((card, index) => {
            card.classList.add('reveal-ready');
            card.style.setProperty('--reveal-delay', `${index % 4 * 65}ms`);
            observer.observe(card);
        });
        return () => observer.disconnect();
    }, []);

    return (
        <div className="landing" ref={pageRef}>
            <a className="landing-skip-link" href="#features" onClick={event => handleSectionLink(event, 'features')}>Ir al contenido</a>
            {/* Header con animación de píldora flotante reactiva al scroll */}
            <div className={`landing-header-container ${isScrolled ? 'is-scrolled' : ''}`}>
                <header className={`landing-header ${isScrolled ? 'floating-pill' : ''}`}>
                    <div className="landing-logo-group">
                        <div className="landing-logo-mark">
                            <img src="/amy-logo.png" alt="AMY" className="landing-logo-img" />
                        </div>
                        <span className="landing-logo">AMY</span>
                    </div>

                    <nav className="landing-center-nav" aria-label="Navegación principal">
                        {[['hero', 'Inicio'], ['features', 'Funcionalidades'], ['socratic', 'Método Socrático'], ['architecture', 'Arquitectura RAG'], ['campus', 'Campus 3D']].map(([id, label]) => (
                            <a key={id} href={`#${id}`} className="landing-nav-link" aria-current={activeSection === id ? 'location' : undefined} onClick={event => handleSectionLink(event, id)}>{label}</a>
                        ))}
                    </nav>

                    <div className="landing-nav-actions">
                        <ThemeToggle className="landing-theme-toggle" />
                        <Link to="/login" className="btn btn-header-login">Iniciar Sesión</Link>
                        <Link to="/register" className="btn btn-header-register">Comenzar</Link>
                    </div>
                </header>
            </div>

            <main>
            {/* Hero */}
            <BackgroundLines className="hero-background-wrapper">
                <section className="hero" id="hero" tabIndex={-1} aria-labelledby="hero-title">
                    <div className="hero-content">
                        <span className="hero-badge">UPEC / Ingeniería en Computación</span>
                        <h1 className="hero-title" id="hero-title">
                            Aprende Bases de Datos<br/>
                            con <span className="hero-accent">AMY</span>
                        </h1>
                        <p className="hero-subtitle">
                            Asistente inteligente que te guía con el método socrático 
                            para dominar SQL, normalización, modelo E-R y álgebra relacional. 
                            Preguntas y ejemplos que te ayudan a construir tu propia solución.
                        </p>
                        <div className="hero-actions">
                            <Link to="/register" className="btn btn-primary btn-lg">
                                Comenzar ahora
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                            </Link>
                            <a href="#features" className="btn btn-lg btn-outline" onClick={event => handleSectionLink(event, 'features')}>Ver funcionalidades</a>
                        </div>
                    </div>

                    <div className="hero-visual">
                        <KnowledgeAnimation />
                    </div>
                </section>
            </BackgroundLines>

            <section className="features" id="features" tabIndex={-1} aria-labelledby="features-title">
                <span className="section-eyebrow">HERRAMIENTAS PARA ENTENDER, NO SOLO MEMORIZAR</span>
                <h2 className="section-title" id="features-title">Una forma de aprender que conecta todo</h2>
                <p className="section-description">Selecciona una funcionalidad y descubre cómo puede acompañarte.</p>
                <FeatureExplorer />
            </section>

            <section className="features" id="socratic" tabIndex={-1} aria-labelledby="socratic-title">
                <span className="section-eyebrow">EL MÉTODO SOCRÁTICO, EN LA PRÁCTICA</span>
                <h2 className="section-title" id="socratic-title">La respuesta empieza con una buena pregunta</h2>
                <p className="section-description">Observa, contrasta tu idea y descubre la relación. Prueba una conversación de ejemplo.</p>
                <SocraticDemo />
            </section>

            <section className="features" id="architecture" tabIndex={-1} aria-labelledby="architecture-title">
                <span className="section-eyebrow">ASÍ SE CONECTA AMY</span>
                <h2 className="section-title" id="architecture-title">Una arquitectura al servicio del aprendizaje</h2>
                <p className="section-description">Una vista conceptual de cómo tu pregunta se conecta con el conocimiento y la orientación del tutor.</p>
                <PublicArchitecture />
            </section>

            {/* Recorrido 3D por el campus de la UPEC: el lienzo queda fijo y los cortes avanzan con el scroll */}
            <CampusTour />

            <section className="landing-cta" aria-labelledby="cta-title">
                <span className="section-eyebrow">Tu próxima pregunta es un buen comienzo</span>
                <h2 id="cta-title">Comprende. Practica. Descubre.</h2>
                <p>Haz espacio para aprender a tu ritmo, una conversación a la vez.</p>
                <Link to="/register" className="btn btn-primary btn-lg">Comenzar con AMY <span aria-hidden="true">↗</span></Link>
            </section>

            </main>

            {/* Footer */}
            <footer className="landing-footer">
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

