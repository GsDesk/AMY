# Ollama: Motor de IA Local
FROM ollama/ollama:latest

# Script de arranque que descarga Mistral automáticamente
COPY entrypoint.sh /entrypoint.sh
# Garantizar line endings Unix (LF) independientemente del SO del host
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 11434

ENTRYPOINT ["/entrypoint.sh"]
