-- ============================================================
-- Tutor IA UPEC — Inicialización de Base de Datos Vectorial
-- Script ejecutado automáticamente al crear el contenedor
-- ============================================================

-- Activar la extensión pgvector para almacenamiento vectorial
CREATE EXTENSION IF NOT EXISTS vector;

-- Activar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id VARCHAR(100) PRIMARY KEY,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'estudiante' CHECK (rol IN ('estudiante', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: conversaciones
CREATE TABLE IF NOT EXISTS conversaciones (
    id VARCHAR(100) PRIMARY KEY,
    usuario_id VARCHAR(100) NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL DEFAULT 'Nueva conversación',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: mensajes
CREATE TABLE IF NOT EXISTS mensajes (
    id VARCHAR(100) PRIMARY KEY,
    conversacion_id VARCHAR(100) NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
    sender VARCHAR(50) NOT NULL CHECK (sender IN ('user', 'tutor')),
    content TEXT NOT NULL,
    topic VARCHAR(100),
    source VARCHAR(50),
    rag_used BOOLEAN DEFAULT FALSE,
    live_example TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- Tabla principal: fragmentos_conocimiento

-- Almacena los fragmentos de texto con sus embeddings
-- para la técnica RAG (Retrieval-Augmented Generation)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fragmentos_conocimiento (
    id_fragmento UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Categoría temática del fragmento
    categoria VARCHAR(100) NOT NULL 
        CHECK (categoria IN (
            'Normalización', 'SQL', 'Modelo E-R', 
            'Álgebra Relacional', 'Diseño de BD', 
            'Transacciones', 'Índices', 'Fundamentos'
        )),
    
    -- Contenido técnico del fragmento
    contenido TEXT NOT NULL,
    
    -- Columna generada para Búsqueda de Texto Completo en español (FTS)
    -- Se actualiza automáticamente cada vez que cambia `contenido`
    contenido_fts TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('spanish', coalesce(contenido, ''))
    ) STORED,
    
    -- Metadatos adicionales (fuentes bibliográficas, autor, etc.)
    metadata JSONB DEFAULT '{}',
    
    -- Vector de embedding (768 dimensiones para nomic-embed-text via Ollama)
    embedding vector(768),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- Índice IVFFlat para búsqueda eficiente de vecinos cercanos
-- Usa distancia coseno (<=>)
-- NOTA: El índice se crea después de insertar datos semilla
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- Dataset Semilla: Fundamentos de Bases de Datos
-- Contenido académico representativo para la UPEC
-- Los embeddings se generarán vía el backend al arrancar
-- ────────────────────────────────────────────────────────────

-- ── NORMALIZACIÓN ──────────────────────────────────────────

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('Normalización',
'La Primera Forma Normal (1NF) establece que cada celda de una tabla debe contener un único valor atómico e indivisible. No se permiten grupos repetitivos ni atributos multivaluados. Por ejemplo, si una tabla "Estudiante" tiene un campo "Teléfonos" con valores como "0991234567, 0987654321", viola 1NF. La solución es crear una tabla separada "Telefonos_Estudiante" con una relación uno a muchos. Adicionalmente, la tabla debe tener una clave primaria definida que identifique de manera única cada fila.',
'{"fuente": "Fundamentos de Bases de Datos - Silberschatz, Korth & Sudarshan", "capitulo": "7 - Diseño de Bases de Datos Relacionales", "edicion": "7ma"}'::jsonb);

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('Normalización',
'La Segunda Forma Normal (2NF) requiere que la tabla esté en 1NF y que todos los atributos no clave dependan completamente de la clave primaria completa, no de una parte de ella. Esto aplica especialmente cuando la clave primaria es compuesta. Por ejemplo, en una tabla Inscripcion(id_estudiante, id_materia, nombre_estudiante, calificacion), el atributo "nombre_estudiante" depende solo de "id_estudiante" (dependencia parcial), violando 2NF. La solución es descomponer la tabla para eliminar estas dependencias parciales.',
'{"fuente": "Fundamentos de Bases de Datos - Silberschatz, Korth & Sudarshan", "capitulo": "7 - Diseño de Bases de Datos Relacionales", "edicion": "7ma"}'::jsonb);

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('Normalización',
'La Tercera Forma Normal (3NF) exige que la tabla esté en 2NF y que ningún atributo no clave dependa transitivamente de la clave primaria. Una dependencia transitiva ocurre cuando un atributo no clave depende de otro atributo no clave. Ejemplo: en Empleado(id_empleado, id_departamento, nombre_departamento), el campo "nombre_departamento" depende de "id_departamento", no directamente de "id_empleado". La solución es crear una tabla Departamento separada y referenciarla con una clave foránea.',
'{"fuente": "Fundamentos de Bases de Datos - Silberschatz, Korth & Sudarshan", "capitulo": "7 - Diseño de Bases de Datos Relacionales", "edicion": "7ma"}'::jsonb);

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('Normalización',
'La Forma Normal de Boyce-Codd (BCNF) es una versión más estricta de 3NF. Una tabla está en BCNF si para toda dependencia funcional X → Y, X es una superclave. La diferencia con 3NF se evidencia cuando hay múltiples claves candidatas que se solapan. Ejemplo: una tabla Horario(profesor, materia, aula) donde un profesor imparte una sola materia y cada aula se asigna a una materia. Si profesor → materia es una dependencia funcional pero profesor no es superclave, viola BCNF. Se debe descomponer preservando las dependencias funcionales.',
'{"fuente": "Sistemas de Bases de Datos - Elmasri & Navathe", "capitulo": "15 - Algoritmos de Normalización", "edicion": "6ta"}'::jsonb);

-- ── SQL ────────────────────────────────────────────────────

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('SQL',
'El comando SELECT es la instrucción fundamental del DML (Data Manipulation Language) para consultar datos. Su sintaxis básica es: SELECT columnas FROM tabla WHERE condición. Las cláusulas complementarias incluyen: ORDER BY para ordenamiento, GROUP BY para agrupación, HAVING para filtrar grupos, y LIMIT para restringir resultados. Ejemplo: SELECT nombre, AVG(calificacion) AS promedio FROM estudiantes GROUP BY nombre HAVING AVG(calificacion) >= 7.0 ORDER BY promedio DESC; Esta consulta calcula el promedio de calificaciones por estudiante, filtra aquellos con promedio mayor o igual a 7 y ordena descendentemente.',
'{"fuente": "SQL: The Complete Reference - James Groff", "capitulo": "4 - Consultas SELECT", "edicion": "3ra"}'::jsonb);

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('SQL',
'Los JOIN en SQL permiten combinar filas de dos o más tablas basándose en una columna relacionada. Tipos principales: INNER JOIN retorna solo filas con coincidencias en ambas tablas. LEFT JOIN (o LEFT OUTER JOIN) retorna todas las filas de la tabla izquierda y las coincidencias de la derecha (NULL si no hay coincidencia). RIGHT JOIN es el opuesto. FULL OUTER JOIN retorna todas las filas de ambas tablas. CROSS JOIN genera el producto cartesiano. Ejemplo: SELECT e.nombre, d.nombre_depto FROM empleados e INNER JOIN departamentos d ON e.id_depto = d.id_depto; Retorna solo empleados que tienen un departamento asignado.',
'{"fuente": "SQL: The Complete Reference - James Groff", "capitulo": "7 - Consultas Multi-tabla", "edicion": "3ra"}'::jsonb);

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('SQL',
'Las subconsultas (subqueries) son consultas SELECT anidadas dentro de otra consulta. Se clasifican en: subconsultas escalares (retornan un solo valor), subconsultas de fila (retornan una fila), y subconsultas de tabla (retornan múltiples filas). Los operadores IN, EXISTS, ANY y ALL se usan frecuentemente con subconsultas. Ejemplo: SELECT nombre FROM estudiantes WHERE id_estudiante IN (SELECT id_estudiante FROM inscripciones WHERE id_materia = ''BD101''); Las subconsultas correlacionadas se ejecutan una vez por cada fila de la consulta exterior y pueden referenciar columnas de la consulta exterior.',
'{"fuente": "Fundamentos de Bases de Datos - Silberschatz, Korth & Sudarshan", "capitulo": "3 - SQL Avanzado", "edicion": "7ma"}'::jsonb);

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('SQL',
'El DDL (Data Definition Language) incluye comandos para crear y modificar la estructura de la base de datos. CREATE TABLE define una nueva tabla con sus columnas y restricciones. ALTER TABLE modifica una tabla existente (agregar/eliminar columnas, cambiar tipos). DROP TABLE elimina una tabla permanentemente. Las restricciones principales son: PRIMARY KEY (identificador único), FOREIGN KEY (referencia a otra tabla), NOT NULL, UNIQUE, CHECK (validación de datos) y DEFAULT (valor por defecto). Ejemplo: CREATE TABLE materia (id_materia VARCHAR(10) PRIMARY KEY, nombre VARCHAR(100) NOT NULL, creditos INTEGER CHECK (creditos > 0));',
'{"fuente": "Fundamentos de Bases de Datos - Silberschatz, Korth & Sudarshan", "capitulo": "2 - Modelo Relacional", "edicion": "7ma"}'::jsonb);

-- ── MODELO ENTIDAD-RELACIÓN ────────────────────────────────

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('Modelo E-R',
'El Modelo Entidad-Relación (E-R) es una herramienta de diseño conceptual creada por Peter Chen en 1976. Sus componentes fundamentales son: Entidades (objetos del mundo real, representadas como rectángulos), Atributos (propiedades de las entidades, representados como óvalos) y Relaciones (asociaciones entre entidades, representadas como rombos). Los atributos pueden ser: simples o compuestos, monovalorados o multivalorados, almacenados o derivados. La clave primaria se subraya en el diagrama. Ejemplo: la entidad ESTUDIANTE tiene atributos id_estudiante (clave), nombre, fecha_nacimiento y edad (derivado).',
'{"fuente": "Fundamentos de Bases de Datos - Silberschatz, Korth & Sudarshan", "capitulo": "6 - Modelo E-R", "edicion": "7ma"}'::jsonb);

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('Modelo E-R',
'La cardinalidad en el Modelo E-R define el número máximo de instancias de una entidad que pueden asociarse con instancias de otra entidad a través de una relación. Los tipos son: Uno a Uno (1:1) — cada instancia de A se asocia con máximo una de B y viceversa. Ejemplo: un país tiene una capital. Uno a Muchos (1:N) — una instancia de A puede asociarse con varias de B, pero cada instancia de B se asocia con una sola de A. Ejemplo: un departamento tiene muchos empleados. Muchos a Muchos (M:N) — múltiples instancias de A se asocian con múltiples de B. Ejemplo: estudiantes inscritos en materias. La participación puede ser total (toda instancia participa) o parcial.',
'{"fuente": "Sistemas de Bases de Datos - Elmasri & Navathe", "capitulo": "7 - Modelo ER y EER", "edicion": "6ta"}'::jsonb);

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('Modelo E-R',
'La transformación del Modelo E-R a tablas relacionales sigue reglas sistemáticas: 1) Cada entidad fuerte se convierte en una tabla con sus atributos como columnas. 2) Cada entidad débil se convierte en una tabla que incluye la clave primaria de su entidad propietaria como clave foránea. 3) Las relaciones 1:N se implementan agregando la clave foránea del lado "uno" al lado "muchos". 4) Las relaciones M:N generan una nueva tabla intermedia con las claves primarias de ambas entidades como clave compuesta. 5) Las relaciones 1:1 permiten colocar la clave foránea en cualquiera de las dos tablas, preferiblemente en la de participación total.',
'{"fuente": "Fundamentos de Bases de Datos - Silberschatz, Korth & Sudarshan", "capitulo": "6 - Modelo E-R", "edicion": "7ma"}'::jsonb);

-- ── ÁLGEBRA RELACIONAL ─────────────────────────────────────

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('Álgebra Relacional',
'El Álgebra Relacional es un lenguaje de consulta procedimental que opera sobre relaciones (tablas) y produce nuevas relaciones como resultado. Las operaciones fundamentales son: Selección (σ) — filtra filas que cumplen una condición. Ejemplo: σ(edad > 20)(Estudiantes) retorna estudiantes mayores de 20 años. Proyección (π) — selecciona columnas específicas eliminando duplicados. Ejemplo: π(nombre, carrera)(Estudiantes) retorna solo nombre y carrera. Estas son operaciones unarias porque operan sobre una sola relación.',
'{"fuente": "Fundamentos de Bases de Datos - Silberschatz, Korth & Sudarshan", "capitulo": "2 - Álgebra Relacional", "edicion": "7ma"}'::jsonb);

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('Álgebra Relacional',
'Las operaciones binarias del Álgebra Relacional combinan dos relaciones: Unión (∪) — combina tuplas de dos relaciones compatibles eliminando duplicados. Diferencia (−) — retorna tuplas de la primera relación que no están en la segunda. Producto Cartesiano (×) — combina cada tupla de una relación con cada tupla de la otra. Join Natural (⋈) — combina tuplas de dos relaciones que coinciden en atributos comunes. El Join Natural equivale a un Producto Cartesiano seguido de una Selección por igualdad en atributos compartidos y una Proyección para eliminar columnas duplicadas. Ejemplo: Estudiantes ⋈ Inscripciones retorna datos completos de estudiantes con sus inscripciones.',
'{"fuente": "Fundamentos de Bases de Datos - Silberschatz, Korth & Sudarshan", "capitulo": "2 - Álgebra Relacional", "edicion": "7ma"}'::jsonb);

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('Álgebra Relacional',
'La operación de Renombramiento (ρ) en Álgebra Relacional permite asignar un nuevo nombre a una relación o a sus atributos, es fundamental para realizar auto-joins o para clarificar consultas complejas. La División (÷) es útil para consultas tipo "para todo": por ejemplo, encontrar estudiantes inscritos en TODAS las materias. Si R(A,B) ÷ S(B) = resultado con atributos A, donde cada valor de A en el resultado está asociado con todos los valores de B en S. La Agregación (γ) extiende el álgebra con funciones como SUM, AVG, COUNT, MIN, MAX, agrupando por atributos específicos.',
'{"fuente": "Sistemas de Bases de Datos - Elmasri & Navathe", "capitulo": "8 - Álgebra y Cálculo Relacional", "edicion": "6ta"}'::jsonb);

-- ── FUNDAMENTOS GENERALES ──────────────────────────────────

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('Fundamentos',
'Un Sistema de Gestión de Bases de Datos (SGBD o DBMS) es un software que permite crear, mantener y acceder a bases de datos. Los SGBD proporcionan: independencia de datos (física y lógica), control de redundancia, acceso concurrente, integridad de datos, seguridad, respaldo y recuperación. La arquitectura ANSI/SPARC define tres niveles de abstracción: nivel externo (vistas de usuario), nivel conceptual (estructura lógica global) y nivel interno (almacenamiento físico). Ejemplos de SGBD relacionales incluyen PostgreSQL, MySQL, Oracle Database y SQL Server.',
'{"fuente": "Fundamentos de Bases de Datos - Silberschatz, Korth & Sudarshan", "capitulo": "1 - Introducción", "edicion": "7ma"}'::jsonb);

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('Transacciones',
'Una transacción es una unidad lógica de trabajo que comprende una o más operaciones de base de datos. Las propiedades ACID garantizan la confiabilidad: Atomicidad — la transacción se ejecuta completamente o no se ejecuta en absoluto. Consistencia — la base de datos pasa de un estado válido a otro estado válido. Aislamiento — las transacciones concurrentes no interfieren entre sí (como si se ejecutaran secuencialmente). Durabilidad — una vez confirmada (COMMIT), los cambios son permanentes incluso ante fallos del sistema. Los problemas de concurrencia incluyen: lectura sucia, lectura no repetible y lectura fantasma.',
'{"fuente": "Fundamentos de Bases de Datos - Silberschatz, Korth & Sudarshan", "capitulo": "14 - Transacciones", "edicion": "7ma"}'::jsonb);

INSERT INTO fragmentos_conocimiento (categoria, contenido, metadata) VALUES
('Índices',
'Los índices en bases de datos son estructuras auxiliares que aceleran la búsqueda de datos sin escanear la tabla completa. Los tipos principales son: Índice B-Tree — estructura de árbol balanceado, eficiente para búsquedas de igualdad y rango (usado por defecto en PostgreSQL). Índice Hash — solo para búsquedas de igualdad exacta, más rápido que B-Tree para este caso. Índice GiST — para datos geoespaciales y tipos de datos complejos. La decisión de crear un índice considera el trade-off: mejora las consultas SELECT pero ralentiza INSERT, UPDATE y DELETE porque el índice debe actualizarse. Se recomienda indexar columnas usadas frecuentemente en WHERE, JOIN y ORDER BY.',
'{"fuente": "Sistemas de Bases de Datos - Elmasri & Navathe", "capitulo": "18 - Indexación", "edicion": "6ta"}'::jsonb);

-- ────────────────────────────────────────────────────────────
-- Índices para Búsqueda Híbrida (Vectorial + Full-Text Search)
-- ────────────────────────────────────────────────────────────

-- Índice B-Tree para búsquedas por categoría
CREATE INDEX IF NOT EXISTS idx_categoria ON fragmentos_conocimiento(categoria);

-- Índice para ordenamiento temporal
CREATE INDEX IF NOT EXISTS idx_created_at ON fragmentos_conocimiento(created_at);

-- Índice HNSW para búsqueda vectorial eficiente por similitud coseno
-- HNSW (Hierarchical Navigable Small World) no requiere REINDEX al insertar
-- nuevos vectores, a diferencia de IVFFlat. Parámetros por defecto (m=16, ef=64).
CREATE INDEX IF NOT EXISTS idx_fragmentos_hnsw
    ON fragmentos_conocimiento
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Índice GIN para Full-Text Search en español (columna generada contenido_fts)
-- Permite búsquedas léxicas eficientes como plainto_tsquery('spanish', 'clave foránea')
CREATE INDEX IF NOT EXISTS idx_fragmentos_fts
    ON fragmentos_conocimiento
    USING gin (contenido_fts);

