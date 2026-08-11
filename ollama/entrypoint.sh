#!/bin/bash
# ============================================================
# Ollama Entrypoint â€” Auto-descarga de Mistral
# ============================================================

echo "ðŸš€ Iniciando servidor Ollama..."
ollama serve &
SERVER_PID=$!

# Esperar a que el servidor estÃ© listo usando el CLI de ollama (no curl)
echo "â³ Esperando a que Ollama estÃ© disponible..."
MAX_RETRIES=60
RETRY=0
until ollama list > /dev/null 2>&1; do
    RETRY=$((RETRY + 1))
    if [ $RETRY -ge $MAX_RETRIES ]; then
        echo "âŒ Ollama no respondiÃ³ despuÃ©s de $MAX_RETRIES intentos"
        exit 1
    fi
    sleep 5
done

echo "✅ Servidor Ollama activo"

# Verificar si Mistral ya está descargado
if ollama list | grep -q "mistral"; then
    echo "✅ Modelo Mistral ya está disponible"
else
    echo "📥 Descargando modelo Mistral (esto puede tardar varios minutos)..."
    ollama pull mistral
    echo "✅ Modelo Mistral descargado correctamente"
fi

# Verificar si nomic-embed-text ya está descargado (para embeddings 768-dim en RAG)
if ollama list | grep -q "nomic-embed-text"; then
    echo "✅ Modelo nomic-embed-text ya está disponible"
else
    echo "📥 Descargando modelo nomic-embed-text..."
    ollama pull nomic-embed-text
    echo "✅ Modelo nomic-embed-text descargado correctamente"
fi

echo "🎓 Ollama + Mistral + nomic-embed-text listos para el Tutor IA UPEC"

# Mantener el servidor corriendo
wait $SERVER_PID
