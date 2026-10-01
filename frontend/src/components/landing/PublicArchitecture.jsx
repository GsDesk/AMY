import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import useAnimationActivity from '../../hooks/useAnimationActivity';
import './PublicArchitecture.css';

// Public educational content only. Never populate this diagram from service configuration.
const stages = [
    { id: 'question', title: 'Tu consulta', subtitle: 'Todo empieza con una duda', icon: 'question', label: 'PREGUNTAR', detail: 'Tu pregunta es el punto de partida. Define qué concepto quieres comprender y da dirección a la conversación.' },
    { id: 'knowledge', title: 'Conocimiento académico', subtitle: 'Conceptos que dan soporte', icon: 'book', label: 'CONECTAR', detail: 'El material de estudio aporta conceptos y ejemplos. Es la base de conocimiento que puede apoyar al tutor según el tema disponible.' },
    { id: 'context', title: 'Contexto relevante', subtitle: 'La conexión RAG', icon: 'search', label: 'RELACIONAR', detail: 'La recuperación de información relaciona tu consulta con fragmentos útiles. RAG combina ese contexto con la generación de una respuesta.' },
    { id: 'tutor', title: 'Tutor AMY', subtitle: 'Una guía para tu razonamiento', icon: 'spark', label: 'RAZONAR', detail: 'AMY combina la pregunta, el contexto y la conversación para orientarte con preguntas y ejemplos que te ayuden a construir tu respuesta.' },
    { id: 'response', title: 'Aprendizaje guiado', subtitle: 'Una idea abre la siguiente', icon: 'response', label: 'DESCUBRIR', detail: 'La orientación te invita a comprobar lo aprendido. Puedes continuar la conversación, revisar una idea o plantear una nueva pregunta.' },
];
const examples = [
    { name: 'Claves', query: '¿Por qué necesito una clave primaria?', snippets: ['¿Cómo distingo dos estudiantes con el mismo nombre?', 'Identidad de registros · unicidad · claves', 'Relacionamos tu duda con el concepto de identificación única.', 'Si ambos se llaman Ana, ¿qué dato te permitiría distinguirlos?', 'Un identificador único evita confundir registros. ¿Qué pasaría si se repite?'] },
    { name: 'Consultas SQL', query: '¿Cómo encuentro cursos sin estudiantes?', snippets: ['Quiero ver también los cursos sin inscripciones.', 'Relaciones · JOIN · valores nulos', 'Conectamos la consulta con la conservación de filas al combinar tablas.', '¿Qué ocurre con un curso sin coincidencias cuando usas un INNER JOIN?', 'Piensa qué tabla debes conservar y qué indica la ausencia de una coincidencia.'] },
    { name: 'Relaciones', query: '¿Cómo relaciono estudiantes y cursos?', snippets: ['Un estudiante puede tomar varios cursos, y viceversa.', 'Cardinalidad · entidades · relaciones', 'Vinculamos el caso con una relación de muchos a muchos.', '¿Dónde guardarías la fecha de inscripción de cada estudiante a un curso?', 'Una inscripción representa esa relación. ¿Qué referencias necesita?'] },
];
const links = [['question', 'context'], ['knowledge', 'context'], ['context', 'tutor'], ['tutor', 'response']];

function Icon({ name, ...props }) {
    const paths = {
        question: <><path d="M5 4h14v12H9l-4 4V4Z"/><path d="M10 8a2 2 0 0 1 4 0c0 2-2 1-2 3M12 13h.01"/></>,
        book: <><path d="M12 5v15M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a5 5 0 0 0-4 2 5 5 0 0 0-4-2H3Z"/></>,
        search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M7 10h6M10 7v6"/></>,
        spark: <><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z"/></>,
        response: <><path d="M4 4h16v12H9l-5 4V4Z"/><path d="m8 10 3 3 5-6"/></>,
        play: <path d="m8 5 11 7-11 7V5Z"/>, pause: <><path d="M8 5v14M16 5v14"/></>,
    };
    return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export default function PublicArchitecture() {
    const rootRef = useRef(null);
    const boardRef = useRef(null);
    const active = useAnimationActivity(rootRef);
    const [step, setStep] = useState(0);
    const [example, setExample] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const [paths, setPaths] = useState([]);
    const current = stages[step];
    const scenario = examples[example];
    const running = playing && active;

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => { setReducedMotion(media.matches); if (media.matches) setPlaying(false); };
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        if (!running) return;
        const timer = window.setTimeout(() => {
            if (step === stages.length - 1) setPlaying(false);
            else setStep(value => value + 1);
        }, 4200);
        return () => window.clearTimeout(timer);
    }, [running, step]);

    // Measure the real button edges so connections stay aligned on every layout.
    useLayoutEffect(() => {
        const board = boardRef.current;
        const measure = () => {
            const bounds = board.getBoundingClientRect();
            const vertical = bounds.width <= 520;
            setPaths(links.map(([from, to]) => {
                const source = board.querySelector(`[data-node="${from}"]`).getBoundingClientRect();
                const target = board.querySelector(`[data-node="${to}"]`).getBoundingClientRect();
                const down = vertical || from === 'tutor';
                const start = down ? [source.left + source.width / 2 - bounds.left, source.bottom - bounds.top] : [source.right - bounds.left, source.top + source.height / 2 - bounds.top];
                const end = down ? [target.left + target.width / 2 - bounds.left, target.top - bounds.top] : [target.left - bounds.left, target.top + target.height / 2 - bounds.top];
                const mid = down ? (start[1] + end[1]) / 2 : (start[0] + end[0]) / 2;
                return { from, to, d: down ? `M${start} C${start[0]},${mid} ${end[0]},${mid} ${end}` : `M${start} C${mid},${start[1]} ${mid},${end[1]} ${end}` };
            }));
        };
        const observer = new ResizeObserver(measure);
        observer.observe(board);
        board.querySelectorAll('[data-node]').forEach(node => observer.observe(node));
        measure();
        return () => observer.disconnect();
    }, []);

    const selectStep = index => { setPlaying(false); setStep(index); };
    const togglePlayback = () => {
        if (playing) setPlaying(false);
        else { if (step === stages.length - 1) setStep(0); setPlaying(true); }
    };

    return <div ref={rootRef} className="rag-explorer" data-running={running} data-motion={active}>
        <div className="rag-toolbar">
            <div className="rag-heading"><span className="rag-brand"><Icon name="spark"/></span><div><span className="demo-label">AMY / ARQUITECTURA RAG</span><h3>El viaje de una pregunta</h3></div></div>
            <button type="button" className="rag-play" onClick={togglePlayback} disabled={reducedMotion} aria-pressed={playing} title={reducedMotion ? 'Movimiento reducido activado: utiliza los controles de pasos.' : undefined}><Icon name={playing ? 'pause' : 'play'} width="16" height="16"/>{reducedMotion ? 'Recorrido manual' : playing ? 'Pausar recorrido' : step === 4 ? 'Repetir recorrido' : step === 0 ? 'Ver recorrido' : 'Continuar recorrido'}</button>
        </div>
        <div className="rag-scenario">
            <div className="rag-scenario-options" role="group" aria-label="Elegir ejemplo del recorrido">{examples.map((item, index) => <button type="button" key={item.name} aria-pressed={example === index} onClick={() => { setExample(index); selectStep(0); }}>{item.name}</button>)}</div>
            <p><span aria-hidden="true">↳</span> {scenario.query}</p>
        </div>
        <div className="rag-workspace">
            <div className="rag-map">
                <div className="rag-map-caption"><span>EXPLORA LAS CONEXIONES</span><span><i/> Etapa seleccionada</span></div>
                <div className="rag-board" ref={boardRef} role="group" aria-label="La consulta y el conocimiento aportan contexto al tutor, que ofrece aprendizaje guiado">
                    <svg className="rag-connections" aria-hidden="true">{paths.map(path => <g key={path.from} data-active={path.to === current.id || path.from === current.id}><path d={path.d} className="rag-wire"/><path d={path.d} className="rag-packet" pathLength="100"/></g>)}</svg>
                    {stages.map((item, index) => <button type="button" key={item.id} data-node={item.id} className={`rag-node rag-node-${item.id}`} aria-pressed={index === step} aria-controls="architecture-detail" onClick={() => selectStep(index)}>
                        <span className="rag-node-top"><span className="rag-node-icon"><Icon name={item.icon}/></span><span className="rag-node-number">0{index + 1}</span></span><strong>{item.title}</strong><span className="rag-node-subtitle">{item.subtitle}</span><span className="rag-node-indicator" aria-hidden="true"/>
                    </button>)}
                </div>
                <div className="rag-map-footer"><span aria-hidden="true">↶</span> Cada respuesta puede abrir una nueva pregunta.</div>
            </div>
            <div className="rag-detail" id="architecture-detail">
                <div className="rag-detail-top"><span className="demo-label">PASO 0{step + 1} / 05</span><span className="rag-stage-label">{current.label}</span></div>
                <div className="rag-step-track" role="group" aria-label="Etapas del recorrido">{stages.map((item, index) => <button type="button" key={item.id} aria-label={`Paso ${index + 1}: ${item.title}`} aria-pressed={index === step} onClick={() => selectStep(index)} data-complete={index < step}><span/></button>)}</div>
                <div aria-live={playing ? 'off' : 'polite'} aria-atomic="true">
                    <div className="rag-detail-copy" key={`${step}-${example}`}><span className="rag-detail-icon"><Icon name={current.icon} width="28" height="28"/></span><h4>{current.title}</h4><p>{current.detail}</p><div className="rag-example"><span className="demo-label">EN ESTE EJEMPLO</span><p>{scenario.snippets[step]}</p></div></div>
                </div>
                <div className="rag-step-controls"><button type="button" disabled={step === 0} onClick={() => selectStep(step - 1)} aria-label="Paso anterior">← Anterior</button><span>{step + 1} de 5</span><button type="button" disabled={step === 4} onClick={() => selectStep(step + 1)} aria-label="Paso siguiente">Siguiente →</button></div>
            </div>
        </div>
        <div className="rag-footnote"><span><span className="rag-footnote-dot"/> Vista conceptual interactiva</span><span>Ejemplo ilustrativo, sin enviar consultas.</span></div>
    </div>;
}
