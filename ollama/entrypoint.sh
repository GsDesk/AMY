#!/bin/bash
# ============================================================
# Ollama Entrypoint — Auto-descarga de Mistral
# ============================================================

echo "🚀 Iniciando servidor Ollama..."
ollama serve &
SERVER_PID=$!

# Esperar a que el servidor esté listo usando el CLI de ollama (no curl)
echo "⏳ Esperando a que Ollama esté disponible..."
MAX_RETRIES=60
RETRY=0
until ollama list > /dev/null 2>&1; do
    RETRY=$((RETRY + 1))
    if [ $RETRY -ge $MAX_RETRIES ]; then
        echo "❌ Ollama no respondió después de $MAX_RETRIES intentos"
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

echo "🎓 Ollama + Mistral listos para el Tutor IA UPEC"

# Mantener el servidor corriendo
wait $SERVER_PID
