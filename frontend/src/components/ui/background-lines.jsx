import React from 'react';
import './background-lines.css';

export function BackgroundLines({ children, className = '' }) {
    return (
        <div className={`bg-lines-container ${className}`}>
            <div className="bg-lines-gradient" />
            <svg
                className="bg-lines-svg"
                viewBox="0 0 1440 900"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <linearGradient id="purple-line" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#c084fc" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
                    </linearGradient>
                    <linearGradient id="cyan-line" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.1" />
                    </linearGradient>
                </defs>

                {/* Grid Lines */}
                <path d="M-100 150 Q 360 400 720 150 T 1540 150" stroke="url(#purple-line)" strokeWidth="1.5" className="animated-path" />
                <path d="M-100 300 Q 400 100 720 300 T 1540 300" stroke="url(#purple-line)" strokeWidth="1" className="animated-path-reverse" />
                <path d="M-100 450 Q 300 650 720 450 T 1540 450" stroke="url(#cyan-line)" strokeWidth="1.5" className="animated-path" />
                <path d="M-100 600 Q 500 350 720 600 T 1540 600" stroke="url(#purple-line)" strokeWidth="1" className="animated-path-reverse" />

                <path d="M-100 750 Q 250 500 720 750 T 1540 750" stroke="url(#purple-line)" strokeWidth="1.2" className="animated-path" />
                <path d="M-100 50 Q 600 250 720 50 T 1540 50" stroke="url(#cyan-line)" strokeWidth="1" className="animated-path-reverse" />

                {/* Additional ambient curved lines */}
                <path d="M100 -100 Q 400 450 100 1000" stroke="url(#purple-line)" strokeWidth="1" opacity="0.3" className="animated-path" />
                <path d="M1340 -100 Q 1040 450 1340 1000" stroke="url(#purple-line)" strokeWidth="1" opacity="0.3" className="animated-path-reverse" />
            </svg>
            <div style={{ position: 'relative', zIndex: 20, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {children}
            </div>
        </div>
    );
}
