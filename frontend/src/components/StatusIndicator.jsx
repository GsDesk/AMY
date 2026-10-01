import { useState, useEffect } from 'react';
import { checkHealth } from '../services/api';
import RAGWorkflowDiagram from './RAGWorkflowDiagram';
import './StatusIndicator.css';

// Definición de etapas del pipeline RAG
const PIPELINE_STAGES = [
    { id: 'searching',    label: 'Buscando contexto...',       progress: 25 },
    { id: 'guardrails',   label: 'Analizando guardrails...',   progress: 55 },
    { id: 'synthesizing', label: 'Sintetizando respuesta...',   progress: 80 },
    { id: 'done',         label: 'Respuesta generada',           progress: 100 },
];

export default function StatusIndicator({ pipelineStage = null }) {
    const [health, setHealth] = useState(null);

    useEffect(() => {
        const fetchHealth = async () => {
            const data = await checkHealth();
            setHealth(data);
        };
        fetchHealth();
        const interval = setInterval(fetchHealth, 10000);
        return () => clearInterval(interval);
    }, []);

    // Encontrar la info de la etapa actual
    const currentStageInfo = pipelineStage
        ? PIPELINE_STAGES.find(s => s.id === pipelineStage)
        : null;

    const isPipelineActive = pipelineStage && pipelineStage !== 'done';

    // Si se pasa la prop pipelineStage (usado en Header del Chat),
    // renderizar el diagrama animado de flujo de trabajo RAG
    if (pipelineStage !== undefined && pipelineStage !== null) {
        if (!currentStageInfo) return null;
        return (
            <RAGWorkflowDiagram
                stage={pipelineStage}
                progress={currentStageInfo.progress}
            />
        );
    }

    // Modo por defecto (Sidebar): Salud de la infraestructura
    if (!health) return null;

    const ollamaDotClass = health.ollama === 'connected'
        ? 'online'
        : health.ollama === 'downloading'
            ? 'downloading'
            : 'offline';

    return (
        <div className="status-indicator">
            <div className="status-row">
                <span className={`status-dot ${health.database === 'connected' ? 'online' : 'offline'}`} />
                <span className="status-label">PostgreSQL</span>
            </div>
            {health.gemini === 'connected' && (
                <div className="status-row">
                    <span className="status-dot online" />
                    <span className="status-label">Gemini 2.5 Flash</span>
                </div>
            )}
            {health.groq === 'connected' && (
                <div className="status-row">
                    <span className="status-dot online" />
                    <span className="status-label">Groq LPU (Respaldo)</span>
                </div>
            )}
            <div className="status-row">
                <span className={`status-dot ${ollamaDotClass}`} />
                <span className="status-label">
                    Ollama ({health.model || 'mistral'}){' '}
                    {health.ollama === 'downloading' && <span className="status-sub">(descargando...)</span>}
                    {health.ollama === 'connected' && <span className="status-sub ready-text">(listo)</span>}
                    {health.ollama === 'disconnected' && <span className="status-sub offline-text">(sin conexión)</span>}
                </span>
            </div>
            {health.fragments_count > 0 && (
                <div className="status-fragments">
                    {health.fragments_count} fragmentos indexados
                </div>
            )}
        </div>
    );
}

