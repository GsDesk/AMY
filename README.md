#  Tutor IA — Fundamentos de Base de Datos | UPEC

Sistema de tutoría inteligente para la materia de **Fundamentos de Bases de Datos** de la Universidad Politécnica Estatal del Carchi (UPEC). Utiliza **RAG (Retrieval-Augmented Generation)** con Ollama/Mistral para proveer asistencia pedagógica basada en el método socrático.

##  Arquitectura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend   │────▶│   Backend   │────▶│   Ollama    │
│  React/Vite  │     │   FastAPI   │     │   Mistral   │
│  :5173       │     │   :8000     │     │   :11434    │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │  PostgreSQL  │
                    │  + pgvector  │
                    │  :5432       │
                    └─────────────┘
```

**4 servicios contenerizados:**
- **db** — PostgreSQL con pgvector para almacenamiento vectorial
- **ollama** — Motor de IA local con modelo Mistral
- **backend** — FastAPI con pipeline RAG completo
- **frontend** — React + Vite con interfaz de chat premium

##  Prerrequisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+)
- [Docker Compose](https://docs.docker.com/compose/) (incluido en Docker Desktop)
- **~8GB de RAM** disponibles (Mistral requiere ~4GB)
- **~6GB de disco** para la imagen de Mistral

##  Inicio Rápido

### 1. Clonar y configurar

```bash
git clone <repositorio>
cd AMY-IA

# Crear archivo de variables de entorno
cp .env.example .env
```

### 2. Levantar todo con un solo comando

```bash
docker compose up --build
```

> **Primera ejecución**: Ollama descargará el modelo Mistral (~4GB).
> Los embeddings del dataset semilla se generarán automáticamente.

### 3. Acceder

| Servicio  | URL                          |
|-----------|------------------------------|
| Aplicación | http://localhost             |
| API        | http://localhost/api/...     |
| Health     | http://localhost/health      |

> Por seguridad el backend no publica el puerto 8000: solo es accesible a través de
> nginx, que añade las cabeceras de seguridad y la IP real del cliente (límite de
> peticiones). La documentación Swagger (`/docs`) solo está disponible dentro de la red
> de Docker, por ejemplo con `docker compose exec backend curl localhost:8000/docs`.

##  Cargar Nuevos Documentos (Open Data)

La forma recomendada es el **Panel Admin → Gestión RAG**, que valida y sube archivos
(.pdf, .txt, .docx). También se puede usar la API REST con el token de un administrador:

### Vía cURL

```bash
curl -X POST http://localhost/api/rag/ingest \
  -H "Authorization: Bearer <TOKEN_DE_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{
    "contenido": "El álgebra relacional define operaciones como selección, proyección y join...",
    "categoria": "Álgebra Relacional",
    "metadata": {
      "fuente": "Manual de BD UPEC",
      "autor": "Prof. García",
      "año": 2024
    }
  }'
```

### Categorías disponibles

| Categoría            | Descripción                                      |
|---------------------|--------------------------------------------------|
| `Normalización`     | 1NF, 2NF, 3NF, BCNF, dependencias funcionales   |
| `SQL`               | DDL, DML, SELECT, JOINs, subconsultas            |
| `Modelo E-R`        | Entidades, atributos, relaciones, cardinalidad   |
| `Álgebra Relacional`| Selección, proyección, join, unión, división     |
| `Diseño de BD`      | Diseño conceptual, lógico y físico               |
| `Transacciones`     | ACID, control de concurrencia                    |
| `Índices`           | B-Tree, Hash, GiST, optimización                |
| `Fundamentos`       | SGBD, arquitectura ANSI/SPARC                   |

### Generar embeddings pendientes

Si ingestaste datos sin conexión a Ollama:

```bash
curl -X POST http://localhost/api/rag/generate-embeddings \
  -H "Authorization: Bearer <TOKEN_DE_ADMIN>"
```

##  Estructura del Proyecto

```
AMY-IA/
├── docker-compose.yaml          # Orquestación de 4 servicios
├── .env.example                 # Variables de entorno
├── database/
│   ├── Dockerfile
│   └── init/
│       └── 01_init_vectors.sql  # Schema + dataset semilla
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI endpoints
│       ├── config.py            # Configuración central
│       ├── core/
│       │   ├── brain.py         # Orquestador RAG
│       │   ├── guardrails.py    # System prompt + validación
│       │   └── prompts.py       # Templates de prompts
│       ├── rag/
│       │   ├── embeddings.py    # Generación de vectores
│       │   ├── chunker.py       # Fragmentación de documentos
│       │   └── retriever.py     # Búsqueda semántica
│       ├── integrations/
│       │   └── ollama_client.py # Cliente Ollama async
│       └── database/
│           └── connection.py    # Pool de conexiones asyncpg
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── index.css            # Design system global
│       ├── components/
│       │   ├── ChatWindow.jsx
│       │   ├── ChatMessage.jsx
│       │   ├── ChatInput.jsx
│       │   ├── Sidebar.jsx
│       │   └── StatusIndicator.jsx
│       ├── hooks/
│       │   └── useChat.js
│       └── services/
│           └── api.js
└── ollama/
    ├── Dockerfile
    └── entrypoint.sh
```

##  Variables de Entorno

| Variable            | Descripción                        | Default                    |
|--------------------|------------------------------------|----------------------------|
| `POSTGRES_USER`    | Usuario de PostgreSQL              | `tutor_user`               |
| `POSTGRES_PASSWORD`| Contraseña de PostgreSQL           | `tutor_secure_password_2024`|
| `POSTGRES_DB`      | Nombre de la base de datos         | `tutor_bd_upec`            |
| `OLLAMA_HOST`      | URL del servicio Ollama            | `http://ollama:11434`      |
| `OLLAMA_MODEL`     | Modelo de IA a utilizar            | `mistral`                  |
| `SMTP_HOST`        | Servidor SMTP para los códigos de recuperación | *(vacío: no se envían)* |
| `SMTP_PORT`        | Puerto SMTP                        | `587`                      |
| `SMTP_USER` / `SMTP_PASSWORD` | Credenciales SMTP       | *(vacío)*                  |
| `SMTP_FROM` / `SMTP_FROM_NAME` | Remitente (si `SMTP_FROM` está vacío se usa `SMTP_USER`) | `AMY Tutor UPEC` |
| `SMTP_SECURITY`    | `starttls` (587), `ssl` (465) o `none` | `starttls`             |

### Correo (recuperación de contraseña)

Con Gmail: activa la verificación en 2 pasos, crea una
[contraseña de aplicación](https://myaccount.google.com/apppasswords) y en `.env` pon
`SMTP_HOST=smtp.gmail.com`, `SMTP_USER=tu_correo@gmail.com` y `SMTP_PASSWORD=<contraseña de aplicación>`.
Tras `docker compose up -d backend`, comprueba la configuración enviando un correo de prueba:

```bash
docker compose exec backend python -m app.core.mailer destinatario@correo.com
```

##  Tecnologías

- **PostgreSQL + pgvector** — Almacenamiento vectorial para RAG
- **Ollama + Mistral** — Motor de IA local (sin dependencias en la nube)
- **FastAPI** — Backend asíncrono de alto rendimiento
- **React + Vite** — Frontend moderno con hot-reload
- **Docker Compose** — Orquestación completa de servicios

---

**Universidad Politécnica Estatal del Carchi (UPEC)**
Ingeniería en Ciencias de la Computación — Fundamentos de Bases de Datos
