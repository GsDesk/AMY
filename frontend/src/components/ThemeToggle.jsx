import { useTheme } from '../context/ThemeContext';
import './ThemeToggle.css';

export default function ThemeToggle({ className = '', showLabel = false, size = 16 }) {
    const { isDark, toggleTheme } = useTheme();

    return (
        <button
            type="button"
            role="switch"
            aria-checked={isDark}
            className={`theme-toggle-switch ${className} ${isDark ? 'is-dark' : 'is-light'}`}
            onClick={toggleTheme}
            title={isDark ? 'Cambiar a modo claro (blanco)' : 'Cambiar a modo oscuro (negro)'}
            aria-label={isDark ? 'Activar tema claro' : 'Activar tema oscuro'}
        >
            <span className="theme-toggle-track">
                {/* Iconos sutiles en los extremos del track */}
                <span className="track-icon track-sun" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                    </svg>
                </span>
                <span className="track-icon track-moon" aria-hidden="true">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                </span>

                {/* Pastilla deslizante (Thumb) interactiva */}
                <span className="theme-toggle-thumb">
                    {isDark ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="thumb-icon moon-icon">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                    ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="thumb-icon sun-icon">
                            <circle cx="12" cy="12" r="4" fill="currentColor" />
                            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                        </svg>
                    )}
                </span>
            </span>
            {showLabel && (
                <span className="theme-toggle-label">
                    {isDark ? 'Modo Oscuro' : 'Modo Claro'}
                </span>
            )}
        </button>
    );
}
