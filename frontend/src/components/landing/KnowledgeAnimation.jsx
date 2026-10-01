import { useRef, useState } from 'react';
import useAnimationActivity from '../../hooks/useAnimationActivity';
import './KnowledgeAnimation.css';

const nodes = [
    { x: 108, y: 142, label: 'SQL', color: 'cyan' },
    { x: 385, y: 104, label: 'Modelo E-R', color: 'violet' },
    { x: 436, y: 318, label: 'Normalización', color: 'cyan' },
    { x: 132, y: 380, label: 'Tu siguiente idea', color: 'violet' },
];

export default function KnowledgeAnimation() {
    const ref = useRef(null);
    const active = useAnimationActivity(ref);
    const [paused, setPaused] = useState(false);
    return (
        <figure ref={ref} className="knowledge-visual" data-running={active && !paused} aria-label="AMY conecta preguntas, conceptos y aprendizaje">
            <div className="knowledge-scene" aria-hidden="true">
                <svg viewBox="0 0 540 500" className="knowledge-map" fill="none">
                    <defs>
                        <radialGradient id="knowledge-halo"><stop stopColor="var(--knowledge-halo-color)" stopOpacity="var(--knowledge-halo-opacity)"/><stop offset="1" stopColor="var(--knowledge-halo-color)" stopOpacity="0"/></radialGradient>
                        <linearGradient id="knowledge-thread" x2="1" y2="1"><stop stopColor="var(--knowledge-cyan)"/><stop offset="1" stopColor="var(--knowledge-violet)"/></linearGradient>
                    </defs>
                    <circle cx="270" cy="250" r="232" fill="url(#knowledge-halo)"/>
                    <g className="knowledge-orbit"><ellipse cx="270" cy="250" rx="205" ry="155" transform="rotate(-28 270 250)"/><ellipse cx="270" cy="250" rx="192" ry="170" transform="rotate(35 270 250)"/></g>
                    {nodes.map((node, i) => (
                        <g key={node.label}>
                            <path className="knowledge-thread" d={`M${node.x} ${node.y} Q270 ${node.y} 270 250`} stroke="url(#knowledge-thread)"/>
                            <path className="knowledge-signal" style={{ animationDelay: `${i * -1.6}s` }} d={`M${node.x} ${node.y} Q270 ${node.y} 270 250`} pathLength="100" stroke="url(#knowledge-thread)" strokeWidth="2"/>
                            <circle cx={node.x} cy={node.y} r="5" fill={`var(--knowledge-${node.color})`}/>
                        </g>
                    ))}
                    {Array.from({ length: 22 }, (_, i) => {
                        const angle = i * Math.PI * 2 / 22;
                        return <circle key={i} className="knowledge-star" style={{ animationDelay: `${i * -.4}s` }} cx={270 + Math.cos(angle) * (210 + i % 3 * 12)} cy={250 + Math.sin(angle) * (175 + i % 4 * 10)} r={i % 3 ? 1.5 : 2.5} fill="currentColor"/>;
                    })}
                </svg>
                <div className="knowledge-core"><div className="knowledge-core-inner"><span className="knowledge-spark">✳</span><strong>AMY</strong><span>Conecta tus ideas</span></div></div>
                {nodes.map((node, i) => <span key={node.label} className={`knowledge-label knowledge-label-${node.color}`} style={{ left: `${node.x / 540 * 100}%`, top: `${node.y / 500 * 100}%`, '--float-delay': `${i * -1.2}s` }}>{node.label}</span>)}
                <div className="knowledge-question"><span>Una buena pregunta cambia todo</span><code>¿Por qué funciona?</code></div>
            </div>
            <figcaption className="knowledge-caption"><span><i aria-hidden="true"/> El conocimiento toma forma</span><button type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused} aria-label={paused ? 'Reanudar animación' : 'Pausar animación'}>{paused ? 'Reanudar' : 'Pausar'} <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span></button></figcaption>
        </figure>
    );
}
