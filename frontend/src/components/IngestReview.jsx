import './IngestReview.css';

// Pasos visibles del proceso de "Enseñar a AMY"
const STEPS = [
    { key: 'reading', label: 'Lectura del documento' },
    { key: 'reviewing', label: 'Revisión de contenido' },
    { key: 'indexing', label: 'Aprendizaje (indexación)' },
    { key: 'done', label: 'Listo' },
];

const PHASE_INDEX = { reviewing: 1, rejected: 1, indexing: 2, done: 3, error: 2 };

function stepState(i, phase) {
    const current = PHASE_INDEX[phase] ?? 0;
    if (phase === 'rejected' && i === 1) return 'failed';
    if (phase === 'error' && i === 2) return 'failed';
    if (i < current || (phase === 'done' && i === 3)) return 'done';
    if (i === current && phase !== 'rejected' && phase !== 'error') return 'active';
    // Mientras se espera la revisión, la lectura también está en curso
    if (phase === 'reviewing' && i === 0) return 'done';
    return 'pending';
}

/**
 * Estado del proceso de ingesta:
 * review = { phase, fileName, message, category, report: { total_pages, analyzed[], relevance }, job }
 */
export default function IngestReview({ review, onClose, onShowCategory }) {
    if (!review) return null;
    const { phase, fileName, message, category, report, job } = review;
    const analyzed = report?.analyzed || [];
    const relevance = Math.round((report?.relevance || 0) * 100);
    const total = job?.total || 0;
    const done = job?.done || 0;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const busy = phase === 'reviewing' || phase === 'indexing';

    return (
        <div className={`ingest-review is-${phase}`} role="status" aria-live="polite">
            <div className="ingest-review-head">
                <div className="ingest-review-file">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span title={fileName}>{fileName}</span>
                </div>
                {!busy && (
                    <button type="button" className="ingest-review-close" onClick={onClose} aria-label="Cerrar resultado">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                )}
            </div>

            {/* Pasos del proceso */}
            <ol className="ingest-steps">
                {STEPS.map((s, i) => (
                    <li key={s.key} className={`ingest-step is-${stepState(i, phase)}`}>
                        <span className="ingest-step-dot" aria-hidden="true">
                            {stepState(i, phase) === 'done' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                            {stepState(i, phase) === 'failed' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>}
                        </span>
                        <span className="ingest-step-label">{s.label}</span>
                    </li>
                ))}
            </ol>

            {phase === 'reviewing' && (
                <p className="ingest-hint">
                    La IA está leyendo las primeras páginas y otras repartidas por todo el documento para comprobar que trata de bases de datos…
                </p>
            )}

            {/* Informe de la revisión página a página */}
            {analyzed.length > 0 && (
                <div className="ingest-report">
                    <div className="ingest-report-row">
                        <span className="ingest-report-title">
                            Páginas leídas por la IA: {analyzed.length} de {report.total_pages}
                        </span>
                        <span className={`ingest-relevance ${relevance >= 80 ? 'ok' : 'bad'}`}>{relevance}% sobre bases de datos</span>
                    </div>
                    <div className="ingest-meter" aria-hidden="true">
                        <span className={relevance >= 80 ? 'ok' : 'bad'} style={{ width: `${relevance}%` }} />
                        <i style={{ left: '80%' }} title="Mínimo exigido: 80 %" />
                    </div>
                    <ul className="ingest-pages">
                        {analyzed.map(a => (
                            <li key={a.page} className={a.related ? 'ok' : 'bad'} title={`Página ${a.page}: ${a.topic}`}>
                                <span className="ingest-page-num">Pág. {a.page}</span>
                                <span className="ingest-page-topic">{a.topic || (a.related ? 'Relacionada' : 'No relacionada')}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {(phase === 'rejected' || phase === 'error') && (
                <div className="ingest-verdict bad">
                    <strong>{phase === 'rejected' ? 'Documento rechazado' : 'No se completó'}</strong>
                    <span>{message}</span>
                </div>
            )}

            {(phase === 'indexing' || phase === 'done') && (
                <div className="ingest-verdict ok">
                    <strong>Documento aprobado{category ? ` · ${category}` : ''}</strong>
                    <span>{message}</span>
                </div>
            )}

            {phase === 'indexing' && (
                <div className="ingest-progress">
                    <div className="ingest-progress-row">
                        <span>AMY está aprendiendo el documento…</span>
                        <span>{total ? `${done} de ${total} fragmentos` : 'Preparando fragmentos…'}</span>
                    </div>
                    <div className="ingest-progress-bar"><span style={{ width: `${total ? pct : 4}%` }} /></div>
                </div>
            )}

            {phase === 'done' && (
                <div className="ingest-done">
                    <span>
                        AMY aprendió <strong>{job?.fragments ?? done}</strong> fragmentos nuevos.
                        {job?.pending > 0 && ` ${job.pending} se completarán en segundo plano.`}
                    </span>
                    {category && (
                        <button type="button" className="ingest-link-btn" onClick={() => onShowCategory?.(category)}>
                            Ver en la biblioteca
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
