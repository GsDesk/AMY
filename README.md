# 🎓 Tutor IA — Fundamentos de Base de Datos | UPEC

Sistema de tutoría inteligente para la materia de **Fundamentos de Bases de Datos** de la Universidad Politécnica Estatal del Carchi (UPEC). Utiliza **RAG (Retrieval-Augmented Generation)** con Ollama/Mistral para proveer asistencia pedagógica basada en el método socrático.

## 🏗️ Arquitectura

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

## 📋 Prerrequisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+)
- [Docker Compose](https://docs.docker.com/compose/) (incluido en Docker Desktop)
- **~8GB de RAM** disponibles (Mistral requiere ~4GB)
- **~6GB de disco** para la imagen de Mistral

## 🚀 Inicio Rápido

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

> ⏳ **Primera ejecución**: Ollama descargará el modelo Mistral (~4GB).
> Los embeddings del dataset semilla se generarán automáticamente.

### 3. Acceder

| Servicio  | URL                        |
|-----------|----------------------------|
| Frontend  | http://localhost:5173       |
| Backend   | http://localhost:8000       |
| API Docs  | http://localhost:8000/docs  |
| Health    | http://localhost:8000/health|

## 📚 Cargar Nuevos Documentos (Open Data)

El sistema permite ingestar documentos de texto al sistema de vectores vía la API REST:

### Vía cURL

```bash
curl -X POST http://localhost:8000/api/rag/ingest \
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

### Vía Swagger UI

1. Abre http://localhost:8000/docs
2. Busca el endpoint `POST /api/rag/ingest`
3. Completa el formulario con el contenido, categoría y metadata

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
curl -X POST http://localhost:8000/api/rag/generate-embeddings
```

## 🛠️ Estructura del Proyecto

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

## ⚙️ Variables de Entorno

| Variable            | Descripción                        | Default                    |
|--------------------|------------------------------------|----------------------------|
| `POSTGRES_USER`    | Usuario de PostgreSQL              | `tutor_user`               |
| `POSTGRES_PASSWORD`| Contraseña de PostgreSQL           | `tutor_secure_password_2024`|
| `POSTGRES_DB`      | Nombre de la base de datos         | `tutor_bd_upec`            |
| `OLLAMA_HOST`      | URL del servicio Ollama            | `http://ollama:11434`      |
| `OLLAMA_MODEL`     | Modelo de IA a utilizar            | `mistral`                  |

## 📖 Tecnologías

- **PostgreSQL + pgvector** — Almacenamiento vectorial para RAG
- **Ollama + Mistral** — Motor de IA local (sin dependencias en la nube)
- **FastAPI** — Backend asíncrono de alto rendimiento
- **React + Vite** — Frontend moderno con hot-reload
- **Docker Compose** — Orquestación completa de servicios

---

**Universidad Politécnica Estatal del Carchi (UPEC)**
Ingeniería en Ciencias de la Computación — Fundamentos de Bases de Datos
