import { useState, useEffect } from 'react';
import { checkHealth } from '../services/api';
import './StatusIndicator.css';

export default function StatusIndicator() {
    const [health, setHealth] = useState(null);

    useEffect(() => {
        const fetchHealth = async () => {
            const data = await checkHealth();
            setHealth(data);
        };
        fetchHealth();
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    if (!health) return null;

    return (
        <div className="status-indicator">
            <div className="status-row">
                <span className={`status-dot ${health.database === 'connected' ? 'online' : 'offline'}`} />
                <span className="status-label">PostgreSQL</span>
            </div>
            <div className="status-row">
                <span className={`status-dot ${health.ollama === 'connected' ? 'online' : 'offline'}`} />
                <span className="status-label">Ollama ({health.model})</span>
            </div>
            {health.fragments_count > 0 && (
                <div className="status-fragments">
                    {health.fragments_count} fragmentos indexados
                </div>
            )}
        </div>
    );
}
