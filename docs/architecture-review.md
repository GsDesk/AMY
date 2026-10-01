# Revisión de arquitectura de AMY

## Estructura y conexiones

- `frontend`: React/Vite; Nginx sirve la aplicación y redirige las solicitudes a FastAPI. `services/api.js` concentra el acceso HTTP. Las rutas privadas comprueban la sesión en el cliente; la autorización efectiva corresponde al backend.
- `backend/app`: FastAPI con routers de autenticación, conversaciones y administración. `core/brain.py` coordina el razonamiento y los proveedores; `rag` prepara, evalúa y recupera documentos.
- PostgreSQL/pgvector guarda usuarios, conversaciones y fragmentos. Redis participa en caché y límites de solicitudes. Ollama sirve modelos y embeddings. Gemini y Groq tienen consumidores reales, por lo que se conservan.
- Docker Compose conecta frontend, backend, PostgreSQL, Redis y Ollama. Se corrigió el comentario antiguo que indicaba que Ollama se ejecutaba exclusivamente en el host.

## Limpieza aplicada

- Eliminados `frontend/src/components/HeroAMY.jsx` y `frontend/src/App.css`: sin consumidores en el árbol de componentes; también se retiró la importación de la hoja vacía de uso.
- Eliminado `backend/app/core/db_model_detector.py`: ni el módulo ni sus funciones tenían referencias en el repositorio. El flujo activo de ejemplos se mantiene en `core/examples.py`.
- Eliminada la dependencia directa `@azure/msal-react`: la aplicación utiliza MSAL Browser directamente.
- Retirados estilos de terminal, imagen descompuesta y testimonial que ya no tenían elementos asociados.
- Centralizada la inicialización de Microsoft en `services/sso.js`, con una promesa compartida y reintento tras error; estilos SSO y de contraseñas compartidos en `AuthMotion.css`.
- Chat y administración se cargan bajo demanda para evitar descargar Markdown, resaltado y diagramas al entrar a la landing.

## Interfaz y movimiento

La landing incorpora una sección real de contexto RAG, llamada a la acción y adaptación de las tarjetas socráticas a móvil. Se ajustó el texto para no prometer funcionamiento exclusivamente local cuando existen proveedores externos.

Las animaciones decorativas respetan movimiento reducido y visibilidad de la página. El hero permite pausar y elegir la figura; se cancelan temporizadores y se evita acumular animaciones recursivas. Los cubos usan una cámara más alejada, observan el tamaño del contenedor y suspenden sus temporizadores al ocultarse. WebGL tiene una alternativa decorativa cuando no está disponible. Login y registro comparten entradas progresivas y controles de contraseña accesibles con teclado.

## Pendientes identificados

- `main.py` concentra endpoints de chat, streaming, ingestión y ciclo de vida. Conviene separar routers y servicios con pruebas de contratos antes de mover esta lógica.
- Revisar la propiedad de `conversation_id` antes de consultar el historial en ambos endpoints de chat: comprobar únicamente que existe un usuario autenticado no demuestra que la conversación le pertenezca. La lectura observada filtra por conversación, sin filtrar por propietario.
- Los identificadores OAuth de respaldo siguen codificados en el cliente, ahora en un solo módulo. Conviene que la configuración del servidor determine qué proveedores se muestran.
- La compilación advierte sobre fragmentos grandes: chat incluye resaltado de numerosos lenguajes y Mermaid. La carga diferida reduce su impacto en la entrada, pero todavía conviene restringir los lenguajes y diagramas usados.
- La instalación conectada de npm reportó 13 vulnerabilidades (4 altas). Requieren una auditoría de dependencias y actualización compatible; una operación posterior sin red no constituye una nueva auditoría.

No se eliminaron módulos por no tener una conexión HTTP directa: hooks, componentes, esquemas, archivos de inicialización y utilidades también son dependencias válidas. Los cambios que ya existían en el workspace se conservaron.

## Validación realizada

- `npm run build`: compilación de producción correcta; permanece la advertencia de fragmentos grandes.
- `git diff --check`: sin errores de espacios.
- Análisis sintáctico de los 31 módulos Python restantes: correcto.
- Brave/Playwright: landing, login y registro a 1440, 390 y 320 px, sin errores JavaScript ni desbordamiento horizontal; comprobados selector/pausa del hero, movimiento reducido y rechazo de contraseñas distintas.
- Las pruebas del navegador simulan la configuración HTTP y bloquean el widget externo de Google. No prueban credenciales reales, OAuth, recuperación por correo ni la integración con PostgreSQL, Redis o los modelos.
