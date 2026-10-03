import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './CampusTour.css';

// Cada capítulo es un corte del recorrido 3D. El orden coincide con CHAPTER_NAMES y con el guion de cámara de campusScene.js.
const CHAPTERS = [
    {
        id: 'portada', intro: true, eyebrow: 'AMY nace en la UPEC · Tulcán', title: 'Recorre tu campus en 3D',
        body: 'AMY es el tutor de Fundamentos de Bases de Datos de la Universidad Politécnica Estatal del Carchi. Párate frente a la portada, entra por la puerta principal y gira hacia Aulas 4 para recorrerlo planta por planta.',
        note: 'Modelo aproximado hecho a partir de fotografías y de la vista satelital. Las proporciones y distancias son estimadas.',
    },
    {
        id: 'fachada', part: 'Parte 1 · Edificio central', eyebrow: 'Corte 01 · Fachada', title: 'Pórtico, frontón y torres',
        body: 'Un frontón con medallón corona el acceso, sostenido por dos pares de columnas. A cada lado, un pórtico de seis columnas lleva el nombre en letras doradas. Dos torres de pizarra cierran los extremos y sobre las alas ondean las banderas.',
        facts: [['Columnas', '16'], ['Torres', '2'], ['Frente', '≈ 60 m']],
    },
    { id: 'puerta', eyebrow: 'Corte 02 · Puerta principal', title: 'La reja se abre', body: 'En el eje del frontón, la reja de barrotes con puntas doradas se abre hacia la mampara de vidrio del vestíbulo.' },
    { id: 'vestibulo', eyebrow: 'Corte 03 · Vestíbulo', title: 'A través del edificio', body: 'El vestíbulo atraviesa todo el edificio central. A un lado queda un patio interior y, al fondo, la salida hacia la plaza posterior.' },
    {
        id: 'patio-posterior', eyebrow: 'Corte 04 · Patio posterior', title: 'La plaza de la estrella',
        body: 'Unas gradas suben a la plaza elevada con la estrella naranja en el piso, rodeada de barandales. Una escalinata baja a las canchas; a la derecha está el altar donde se izan las banderas y a la izquierda, el anfiteatro.',
        facts: [['Plaza', '≈ 28 × 21 m'], ['Cancha', '≈ 35 × 19 m'], ['Altar', 'Ø ≈ 13 m']],
    },
    {
        id: 'aulas-4', part: 'Parte 2 · Aulas 4', eyebrow: 'Corte 05 · Llegada', title: 'A la derecha, Aulas 4',
        body: 'Desde la plaza, el recorrido gira a la derecha y llega al conjunto de aulas: dos bloques en espejo, Aulas 2 y Aulas 4. Aulas 4 es el que queda hacia la calle Sumaco.',
    },
    {
        id: 'conjunto', eyebrow: 'Corte 06 · Conjunto', title: 'Aulas 2 y Aulas 4',
        body: 'Los dos bloques romboidales se enfrentan alrededor de un patio octogonal. Entre ellos y el coliseo hay jardineras amplias atravesadas por senderos con gradas y barandales; hacia la avenida Antisana está el Parqueadero UPEC 1.',
        facts: [['Plantas', '3'], ['Altura', '≈ 12 m'], ['Separación', '≈ 14 m']],
    },
    {
        id: 'cubierta', eyebrow: 'Corte 07 · Aulas 4 · Cubierta', title: 'La cubierta se levanta',
        body: 'La losa plana sube junto con su antepecho, los dos lucernarios piramidales y el tanque de agua. Debajo queda el segundo piso.',
        facts: [['Lucernarios', '2'], ['Forma', 'Pirámide'], ['Nivel', 'N +10.80']],
    },
    {
        id: 'piso-2', eyebrow: 'Corte 08 · Aulas 4 · Segundo piso', title: 'Segundo piso',
        body: 'Sin la cubierta se lee la planta: aulas a lo largo de las fachadas, un pasillo perimetral y las escaleras junto a los parasoles. Bajo cada lucernario se abre un vacío que lleva luz a los pisos inferiores.',
        amy: 'Como en un modelo E-R: cada espacio es una entidad y los pasillos son las relaciones que los conectan.',
        facts: [['Nivel', 'N +7.20'], ['Vacíos', '2'], ['Escaleras', '1']],
        note: 'La distribución interior es una estimación a partir de la forma del edificio, no un plano oficial.',
    },
    {
        id: 'piso-1', eyebrow: 'Corte 09 · Aulas 4 · Primer piso', title: 'Primer piso',
        body: 'El segundo piso se retira. El primer piso repite el esquema: aulas en el perímetro, pasillo continuo y un núcleo de servicios en la parte más profunda del bloque.',
        amy: 'Igual que en una tabla bien normalizada, cada zona cumple una sola función: aulas, circulación o servicios.',
        facts: [['Nivel', 'N +3.60'], ['Franja de aulas', '≈ 7 m'], ['Pasillo', '≈ 2.5 m']],
    },
    {
        id: 'planta-baja', eyebrow: 'Corte 10 · Aulas 4 · Planta baja', title: 'Planta baja',
        body: 'En la planta baja están los dos accesos desde el patio, uno a cada lado del bloque de parasoles. Desde ellos se llega al pasillo y a las escaleras.',
        amy: 'Cada acceso funciona como una clave: una entrada única e inequívoca a cada tramo del edificio.',
        facts: [['Nivel', 'N +0.00'], ['Accesos', '2'], ['Altura de piso', '3.60 m']],
    },
    {
        id: 'fachada-patio', eyebrow: 'Corte 11 · Aulas 4 · Fachada al patio', title: 'Torres y parasoles',
        body: 'Los pisos vuelven a su lugar. Seis parasoles verticales marcan la esquina donde la fachada se quiebra: un tramo recto llega a una torre de pizarra y un tramo diagonal baja hasta otra torre y la esquina curva.',
    },
    {
        id: 'patio-aulas', eyebrow: 'Corte 12 · Patio y fuente', title: 'Patio octogonal y fuente',
        body: 'La fuente de mosaico azul ocupa el centro de un círculo adoquinado. Dos caminos en cruz lo atraviesan y dejan cuatro jardines con borde de flores amarillas.',
    },
    {
        id: 'visita', final: true, eyebrow: 'Corte 13 · Del campus a tu pantalla', title: 'Tu campus, tu tutor',
        body: 'AMY te acompaña dentro y fuera del aula, con preguntas que te ayudan a razonar SQL, el modelo E-R y la normalización a tu ritmo.',
    },
];

export default function CampusTour() {
    const rootRef = useRef(null);
    const [status, setStatus] = useState('idle');

    // La escena (three.js y la geometría del campus) se descarga solo cuando la sección se acerca a la pantalla.
    useEffect(() => {
        const el = rootRef.current;
        let api = null;
        let cancelled = false;
        const io = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting || api) return;
            io.disconnect();
            setStatus('loading');
            import('./campusScene.js')
                .then(({ createCampusScene }) => {
                    if (cancelled) return;
                    api = createCampusScene(el);
                    setStatus(api.ok ? 'ready' : 'error');
                })
                .catch(err => { console.error('No se pudo cargar el recorrido 3D:', err); if (!cancelled) setStatus('error'); });
        }, { rootMargin: '900px 0px' });
        io.observe(el);
        return () => { cancelled = true; io.disconnect(); if (api) api.dispose(); };
    }, []);

    return (
        <section className="campus" id="campus" ref={rootRef} tabIndex={-1} aria-labelledby="campus-title" data-status={status}>
            <div className="campus-stage">
                <canvas data-campus="canvas" className="campus-canvas" aria-hidden="true" />
                <div data-campus="labels" className="campus-labels" aria-hidden="true" />
                <div className="campus-hud" aria-hidden="true">
                    <span className="campus-hud-rec">● RECORRIDO</span>
                    <span data-campus="hud-alt">ALT 002 m</span>
                    <span data-campus="hud-hdg">RUMBO 000°</span>
                    <span data-campus="hud-sec">CORTE 00/13</span>
                </div>
                <nav className="campus-rail" aria-label="Cortes del recorrido 3D"><ol data-campus="rail" /></nav>
                {status === 'loading' && <p className="campus-loading" role="status">Cargando el campus…</p>}
            </div>

            <div className="campus-chapters">
                {CHAPTERS.map((c, i) => (
                    <div className="campus-chapter" key={c.id} id={i === 0 ? undefined : `campus-${c.id}`}>
                        <article className={`campus-card${c.intro ? ' campus-card-intro' : ''}`}>
                            {c.part && <p className="campus-part">{c.part}</p>}
                            <p className="campus-eyebrow">{c.eyebrow}</p>
                            {c.intro ? <h2 id="campus-title">{c.title}</h2> : <h3>{c.title}</h3>}
                            <p>{c.body}</p>
                            {c.amy && <p className="campus-amy"><span aria-hidden="true">✳</span> {c.amy}</p>}
                            {c.facts && (
                                <dl className="campus-facts">
                                    {c.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                                </dl>
                            )}
                            {c.intro && <p className="campus-hint"><i aria-hidden="true" />Desplázate para avanzar</p>}
                            {c.intro && status === 'error' && <p className="campus-note">Tu navegador no pudo iniciar WebGL, así que el modelo 3D no se muestra. El recorrido en texto sigue disponible.</p>}
                            {c.note && <p className="campus-note">{c.note}</p>}
                            {c.final && (
                                <div className="campus-actions">
                                    <Link to="/register" className="btn btn-primary">Comenzar con AMY <span aria-hidden="true">↗</span></Link>
                                    <button type="button" className="btn btn-outline" data-campus="btn-top">Repetir el recorrido</button>
                                    <button type="button" className="btn btn-outline" data-campus="btn-levels">Ver las plantas de Aulas 4</button>
                                </div>
                            )}
                        </article>
                    </div>
                ))}
            </div>
        </section>
    );
}
