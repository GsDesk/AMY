#!/bin/bash
# ============================================================
# Ollama Entrypoint - Auto-descarga de Mistral
# ============================================================

echo "[INFO] Iniciando servidor Ollama..."
ollama serve &
SERVER_PID=$!

# Esperar a que el servidor este listo usando el CLI de ollama (no curl)
echo "[INFO] Esperando a que Ollama este disponible..."
MAX_RETRIES=60
RETRY=0
until ollama list > /dev/null 2>&1; do
    RETRY=$((RETRY + 1))
    if [ $RETRY -ge $MAX_RETRIES ]; then
        echo "[ERROR] Ollama no respondio despues de $MAX_RETRIES intentos"
        exit 1
    fi
    sleep 5
done

echo "[OK] Servidor Ollama activo"

# Verificar si Mistral ya esta descargado
if ollama list | grep -q "mistral"; then
    echo "[OK] Modelo Mistral ya esta disponible"
else
    echo "[DESCARGA] Descargando modelo Mistral (esto puede tardar varios minutos)..."
    ollama pull mistral
    echo "[OK] Modelo Mistral descargado correctamente"
fi

# Verificar si nomic-embed-text ya esta descargado (para embeddings 768-dim en RAG)
if ollama list | grep -q "nomic-embed-text"; then
    echo "[OK] Modelo nomic-embed-text ya esta disponible"
else
    echo "[DESCARGA] Descargando modelo nomic-embed-text..."
    ollama pull nomic-embed-text
    echo "[OK] Modelo nomic-embed-text descargado correctamente"
fi

echo "[LISTO] Ollama + Mistral + nomic-embed-text listos para el Tutor IA UPEC"

# Mantener el servidor corriendo
wait $SERVER_PID
