import React, { useEffect, useRef } from 'react';
import { animate, svg, utils } from 'animejs';
import './MorphThinkingAnimation.css';

/**
 * MorphThinkingAnimation
 * Animación de pensamiento para AMY impulsada por svg.morphTo de Anime.js v4.
 * Reemplaza la animación previa del astronauta.
 */
const MorphThinkingAnimation = ({ label = "AMY está pensando" }) => {
    const path1Ref = useRef(null);
    const path2Ref = useRef(null);
    const animRef = useRef(null);

    useEffect(() => {
        let isMounted = true;

        // Generador de coordenadas aleatorias para el polígono morfeante
        function generatePoints() {
            const total = utils.random(4, 64);
            const r1 = utils.random(4, 56);
            const r2 = 56;
            const isOdd = n => n % 2;
            let points = '';
            for (let i = 0, l = isOdd(total) ? total + 1 : total; i < l; i++) {
                const r = isOdd(i) ? r1 : r2;
                const a = (2 * Math.PI * i / l) - Math.PI / 2;
                const x = 152 + utils.round(r * Math.cos(a), 0);
                const y = 56 + utils.round(r * Math.sin(a), 0);
                points += `${x},${y} `;
            }
            return points;
        }

        function animateRandomPoints() {
            if (!isMounted || !path1Ref.current || !path2Ref.current) return;

            try {
                // Actualiza los puntos en path-2
                utils.set(path2Ref.current, { points: generatePoints() });

                // Morfea los puntos de path-1 hacia path-2
                animRef.current = animate(path1Ref.current, {
                    points: svg.morphTo(path2Ref.current),
                    ease: 'inOutCirc',
                    duration: 500,
                    onComplete: () => {
                        if (isMounted) {
                            animateRandomPoints();
                        }
                    }
                });
            } catch (err) {
                console.warn('Anime.js morphTo animation error:', err);
            }
        }

        // Inicia la animación
        animateRandomPoints();

        return () => {
            isMounted = false;
            if (animRef.current) {
                try {
                    animRef.current.pause();
                    animRef.current.cancel();
                } catch (e) {
                    // Limpieza segura
                }
            }
        };
    }, []);

    // Indicador compacto: solo la figura animada y el texto, sin tarjeta alrededor
    return (
        <div className="amy-morph-inline" role="status" aria-label={label}>
            <span className="amy-morph-stage" aria-hidden="true">
                <svg viewBox="96 0 112 112" className="amy-morph-svg" preserveAspectRatio="xMidYMid meet">
                    <g
                        strokeWidth="3"
                        stroke="currentColor"
                        strokeLinejoin="round"
                        fill="none"
                        fillRule="evenodd"
                        className="amy-morph-group"
                    >
                        <polygon
                            ref={path1Ref}
                            points="152,4 170,38 204,56 170,74 152,108 134,74 100,56 134,38"
                        />
                        <polygon
                            ref={path2Ref}
                            style={{ opacity: 0 }}
                            points="152,4 170,38 204,56 170,74 152,108 134,74 100,56 134,38"
                        />
                    </g>
                </svg>
            </span>
            <span className="amy-morph-label">
                {label}
                <span className="amy-morph-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
            </span>
        </div>
    );
};

export default MorphThinkingAnimation;
