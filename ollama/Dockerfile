# Ollama: Motor de IA Local
FROM ollama/ollama:latest

# Script de arranque que descarga Mistral automáticamente
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 11434

ENTRYPOINT ["/entrypoint.sh"]
