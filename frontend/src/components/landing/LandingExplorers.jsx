import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingExplorers.css';

const features = [
    { tag: 'RAG', title: 'Conocimiento con contexto', description: 'Relaciona tu pregunta con el material académico disponible.', example: '¿Por qué una clave foránea puede repetirse?', detail: 'AMY busca conceptos relacionados en su base de conocimiento para acompañar tu razonamiento sobre relaciones y claves.' },
    { tag: 'SQL', title: 'De la teoría a la consulta', description: 'Practica consultas, relaciones y normalización paso a paso.', example: '¿Cómo encuentro los cursos sin estudiantes?', detail: 'Explora la diferencia entre JOIN y LEFT JOIN, identifica qué filas necesitas conservar y construye tu consulta.' },
    { tag: 'E-R', title: 'Piensa en relaciones', description: 'Comprende entidades, atributos y decisiones de diseño.', example: '¿Un estudiante puede inscribirse en varios cursos?', detail: 'Reconoce una relación de muchos a muchos y razona cuándo necesitas una entidad intermedia.' },
    { tag: '</>', title: 'Ejemplos que se entienden', description: 'Lee código SQL y explicaciones con un formato claro.', example: '¿Qué cambia al usar GROUP BY?', detail: 'Examina consultas de ejemplo y conecta cada cláusula con el resultado que quieres obtener.' },
];

export function FeatureExplorer() {
    const [selected, setSelected] = useState(0);
    const feature = features[selected];
    return <>
        <div className="features-grid feature-selector" role="group" aria-label="Explorar funcionalidades">
            {features.map((item, index) => <button key={item.tag} type="button" className={`feature-card ${selected === index ? 'is-selected' : ''}`} aria-pressed={selected === index} aria-controls="feature-example" onClick={() => setSelected(index)}>
                <span className="feature-icon">{item.tag}</span><span className="feature-card-title">{item.title}</span><span className="feature-card-description">{item.description}</span><span className="feature-card-action">Explorar ejemplo <span aria-hidden="true">↗</span></span>
            </button>)}
        </div>
        <div id="feature-example" className="feature-example" aria-live="polite" aria-atomic="true">
            <div><span className="demo-label">Una pregunta para empezar</span><h3>{feature.example}</h3></div><p>{feature.detail}</p><Link to="/register" className="explorer-link">Practicar con AMY <span aria-hidden="true">→</span></Link>
        </div>
    </>;
}

const steps = [
    { title: 'Observa el problema', question: 'Tienes una tabla de estudiantes. ¿Qué dato usarías para distinguir a dos personas con el mismo nombre?', choices: ['Su nombre', 'Un identificador único'], feedback: ['Piensa en dos estudiantes llamados Ana. ¿Cómo sabrías a cuál pertenece una inscripción?', 'Exacto: un identificador único permite distinguir cada registro. Ahora piensa qué regla debería cumplir.'] },
    { title: 'Pon a prueba tu idea', question: 'Si ese identificador es la clave primaria, ¿podrían dos estudiantes compartir el mismo valor?', choices: ['Sí, si tienen nombres distintos', 'No, debe ser único'], feedback: ['Si el valor se repite, una referencia a ese identificador podría apuntar a dos personas. ¿Qué ambigüedad produciría?', 'Bien razonado. La unicidad evita ambigüedades; además, una clave primaria no admite valores nulos.'] },
    { title: 'Conecta lo aprendido', question: 'Ahora una tabla de inscripciones necesita referirse a un estudiante. ¿Qué guardarías en ella?', choices: ['El nombre del estudiante', 'Una referencia a su identificador'], feedback: ['El nombre puede cambiar o repetirse. ¿Qué dato mantendría la relación sin depender del nombre?', 'Así conectas ambas tablas: una clave foránea hace referencia al identificador del estudiante. Has construido la idea paso a paso.'] },
];

export function SocraticDemo() {
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState([null, null, null]);
    const choicesRef = useRef(null);
    const answer = answers[step];
    const current = steps[step];
    const answered = answers.filter(value => value !== null).length;
    const choose = index => setAnswers(values => values.map((value, i) => i === step ? index : value));
    const restart = () => { setStep(0); setAnswers([null, null, null]); };
    const retry = () => { choose(null); choicesRef.current?.querySelector('button')?.focus(); };

    return <div className="socratic-demo">
        <div className="socratic-guide">
            <div className="socratic-guide-heading"><span className="demo-label">APRENDER A RAZONAR</span><h3>Tú pones la idea.<br/>AMY, la siguiente pregunta.</h3><p>Prueba un ejemplo sobre estudiantes e inscripciones. Cada elección abre una oportunidad para comprender.</p></div>
            <div className="socratic-steps" role="group" aria-label="Pasos del ejemplo socrático">
                {steps.map((item, index) => <button type="button" key={item.title} onClick={() => setStep(index)} aria-pressed={step === index} aria-controls="socratic-conversation" data-answered={answers[index] !== null}>
                    <span className="socratic-step-number">{answers[index] !== null ? <span aria-hidden="true">✓</span> : `0${index + 1}`}</span>
                    <span className="socratic-step-copy"><strong>{item.title}</strong><span>{['Encuentra el punto de partida', 'Contrasta lo que estás pensando', 'Lleva la idea a un nuevo caso'][index]}</span></span><span className="socratic-step-arrow" aria-hidden="true">→</span>
                </button>)}
            </div>
            <div className="socratic-progress"><div><span>Preguntas exploradas</span><strong>{answered} de 3</strong></div><div className="socratic-progress-track" role="progressbar" aria-label="Preguntas exploradas" aria-valuemin={0} aria-valuemax={3} aria-valuenow={answered}><span style={{ width: `${answered / 3 * 100}%` }}/></div></div>
            <p className="socratic-guide-note"><span aria-hidden="true">✳</span> Puedes volver a cualquier paso y probar otra idea.</p>
        </div>
        <div className="socratic-conversation" id="socratic-conversation">
            <div className="demo-heading"><span className="socratic-conversation-brand"><span className="tutor-avatar" aria-hidden="true">✳</span><span><strong>AMY</strong><span>Tu guía para pensar</span></span></span><span className="socratic-demo-badge">Ejemplo interactivo</span></div>
            <div className="socratic-question" key={step} aria-live="polite" aria-atomic="true"><span className="demo-label">PREGUNTA 0{step + 1} / 03</span><h3>{current.question}</h3></div>
            <div className="socratic-choices" ref={choicesRef} role="group" aria-label="Elige tu respuesta">
                {current.choices.map((choice, index) => <button type="button" key={choice} onClick={() => choose(index)} aria-pressed={answer === index}><span className="socratic-choice-letter" aria-hidden="true">{index === 0 ? 'A' : 'B'}</span><span>{choice}</span><span className="socratic-choice-mark" aria-hidden="true">{answer === index ? '✓' : '↗'}</span></button>)}
            </div>
            <div className="socratic-feedback-region" aria-live="polite" aria-atomic="true">
                {answer === null ? <div className="socratic-feedback-placeholder"><span aria-hidden="true">↳</span><p>Elige una idea para continuar.<br/><span>No necesitas conocer la respuesta de antemano.</span></p></div> : <div key={`${step}-${answer}`} className={`socratic-feedback ${answer === 1 ? 'is-connected' : 'is-reflecting'}`}><span className="socratic-feedback-label"><span aria-hidden="true">{answer === 1 ? '✧' : '◌'}</span>{answer === 1 ? 'Estás conectando las ideas' : 'Exploremos esa idea'}</span><p>{current.feedback[answer]}</p>{answer === 0 && <button type="button" className="socratic-retry" onClick={retry}>Probar otra respuesta ↺</button>}</div>}
            </div>
            <div className="socratic-demo-footer"><span>Demostración local · sin enviar respuestas</span>{step < steps.length - 1 ? <button type="button" className="socratic-next" disabled={answer === null} onClick={() => setStep(value => value + 1)}>Siguiente pregunta →</button> : <button type="button" className="socratic-next" onClick={restart}>Repetir ejemplo ↺</button>}</div>
        </div>
    </div>;
}
