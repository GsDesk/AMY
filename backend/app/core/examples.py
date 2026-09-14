"""
AMY -- Ejemplos Interactivos de Relaciones entre Tablas
Contiene ejemplos predefinidos de relaciones (1:N, N:M, 1:1)
que se muestran en el panel de ejemplo en vivo.
"""

RELATIONSHIP_EXAMPLES = {
    "one_to_many": {
        "title": "Relacion Uno a Muchos (1:N)",
        "description": "Un departamento tiene muchos empleados, pero cada empleado pertenece a un solo departamento.",
        "tables": [
            {
                "name": "departamentos",
                "columns": [
                    {"name": "id", "type": "INT", "constraint": "PK"},
                    {"name": "nombre", "type": "VARCHAR(100)", "constraint": None},
                    {"name": "ubicacion", "type": "VARCHAR(50)", "constraint": None}
                ]
            },
            {
                "name": "empleados",
                "columns": [
                    {"name": "id", "type": "INT", "constraint": "PK"},
                    {"name": "nombre", "type": "VARCHAR(100)", "constraint": None},
                    {"name": "salario", "type": "DECIMAL(10,2)", "constraint": None},
                    {"name": "id_departamento", "type": "INT", "constraint": "FK"}
                ]
            }
        ],
        "relationships": [
            {
                "from_table": "empleados",
                "from_column": "id_departamento",
                "to_table": "departamentos",
                "to_column": "id",
                "type": "N:1",
                "label": "Muchos empleados -> Un departamento"
            }
        ],
        "sql": "-- Listar empleados con su departamento\nSELECT \n    e.nombre AS empleado,\n    e.salario,\n    d.nombre AS departamento,\n    d.ubicacion\nFROM empleados e\nINNER JOIN departamentos d\n    ON e.id_departamento = d.id\nORDER BY d.nombre, e.nombre;"
    },

    "many_to_many": {
        "title": "Relacion Muchos a Muchos (N:M)",
        "description": "Un estudiante puede estar matriculado en muchas materias, y una materia puede tener muchos estudiantes. Se necesita una tabla intermedia.",
        "tables": [
            {
                "name": "estudiantes",
                "columns": [
                    {"name": "id", "type": "INT", "constraint": "PK"},
                    {"name": "nombre", "type": "VARCHAR(100)", "constraint": None},
                    {"name": "carrera", "type": "VARCHAR(80)", "constraint": None}
                ]
            },
            {
                "name": "matriculas",
                "columns": [
                    {"name": "id_estudiante", "type": "INT", "constraint": "FK"},
                    {"name": "id_materia", "type": "INT", "constraint": "FK"},
                    {"name": "semestre", "type": "VARCHAR(10)", "constraint": None},
                    {"name": "nota", "type": "DECIMAL(4,2)", "constraint": None}
                ]
            },
            {
                "name": "materias",
                "columns": [
                    {"name": "id", "type": "INT", "constraint": "PK"},
                    {"name": "nombre", "type": "VARCHAR(100)", "constraint": None},
                    {"name": "creditos", "type": "INT", "constraint": None}
                ]
            }
        ],
        "relationships": [
            {
                "from_table": "matriculas",
                "from_column": "id_estudiante",
                "to_table": "estudiantes",
                "to_column": "id",
                "type": "N:1",
                "label": "FK hacia estudiantes"
            },
            {
                "from_table": "matriculas",
                "from_column": "id_materia",
                "to_table": "materias",
                "to_column": "id",
                "type": "N:1",
                "label": "FK hacia materias"
            }
        ],
        "sql": "-- Listar estudiantes con sus materias\nSELECT \n    e.nombre AS estudiante,\n    m.nombre AS materia,\n    mt.semestre,\n    mt.nota\nFROM estudiantes e\nINNER JOIN matriculas mt\n    ON e.id = mt.id_estudiante\nINNER JOIN materias m\n    ON mt.id_materia = m.id\nORDER BY e.nombre;"
    },

    "one_to_one": {
        "title": "Relacion Uno a Uno (1:1)",
        "description": "Cada usuario tiene exactamente un perfil, y cada perfil pertenece a exactamente un usuario.",
        "tables": [
            {
                "name": "usuarios",
                "columns": [
                    {"name": "id", "type": "INT", "constraint": "PK"},
                    {"name": "email", "type": "VARCHAR(150)", "constraint": None},
                    {"name": "password_hash", "type": "VARCHAR(255)", "constraint": None}
                ]
            },
            {
                "name": "perfiles",
                "columns": [
                    {"name": "id", "type": "INT", "constraint": "PK"},
                    {"name": "nombre_completo", "type": "VARCHAR(200)", "constraint": None},
                    {"name": "telefono", "type": "VARCHAR(15)", "constraint": None},
                    {"name": "id_usuario", "type": "INT", "constraint": "FK/UNIQUE"}
                ]
            }
        ],
        "relationships": [
            {
                "from_table": "perfiles",
                "from_column": "id_usuario",
                "to_table": "usuarios",
                "to_column": "id",
                "type": "1:1",
                "label": "Un perfil -> Un usuario"
            }
        ],
        "sql": "-- Obtener datos completos de usuario\nSELECT \n    u.email,\n    p.nombre_completo,\n    p.telefono\nFROM usuarios u\nINNER JOIN perfiles p\n    ON u.id = p.id_usuario;"
    },

    "self_referencing": {
        "title": "Relacion Auto-referencial",
        "description": "Un empleado puede tener un jefe, que tambien es un empleado. La tabla se relaciona consigo misma.",
        "tables": [
            {
                "name": "empleados",
                "columns": [
                    {"name": "id", "type": "INT", "constraint": "PK"},
                    {"name": "nombre", "type": "VARCHAR(100)", "constraint": None},
                    {"name": "cargo", "type": "VARCHAR(80)", "constraint": None},
                    {"name": "id_jefe", "type": "INT", "constraint": "FK/SELF"}
                ]
            }
        ],
        "relationships": [
            {
                "from_table": "empleados",
                "from_column": "id_jefe",
                "to_table": "empleados",
                "to_column": "id",
                "type": "N:1",
                "label": "Empleado -> Su jefe (misma tabla)"
            }
        ],
        "sql": "-- Listar empleados con el nombre de su jefe\nSELECT \n    e.nombre AS empleado,\n    e.cargo,\n    j.nombre AS jefe\nFROM empleados e\nLEFT JOIN empleados j\n    ON e.id_jefe = j.id\nORDER BY j.nombre, e.nombre;"
    },

    "join_types": {
        "title": "Tipos de JOIN",
        "description": "Comparacion visual de INNER JOIN, LEFT JOIN, RIGHT JOIN y FULL JOIN entre clientes y pedidos.",
        "tables": [
            {
                "name": "clientes",
                "columns": [
                    {"name": "id", "type": "INT", "constraint": "PK"},
                    {"name": "nombre", "type": "VARCHAR(100)", "constraint": None},
                    {"name": "ciudad", "type": "VARCHAR(50)", "constraint": None}
                ]
            },
            {
                "name": "pedidos",
                "columns": [
                    {"name": "id", "type": "INT", "constraint": "PK"},
                    {"name": "fecha", "type": "DATE", "constraint": None},
                    {"name": "total", "type": "DECIMAL(10,2)", "constraint": None},
                    {"name": "id_cliente", "type": "INT", "constraint": "FK"}
                ]
            }
        ],
        "relationships": [
            {
                "from_table": "pedidos",
                "from_column": "id_cliente",
                "to_table": "clientes",
                "to_column": "id",
                "type": "N:1",
                "label": "Muchos pedidos -> Un cliente"
            }
        ],
        "sql": "-- INNER JOIN: Solo clientes CON pedidos\nSELECT c.nombre, p.fecha, p.total\nFROM clientes c\nINNER JOIN pedidos p ON c.id = p.id_cliente;\n\n-- LEFT JOIN: TODOS los clientes (con o sin pedidos)\nSELECT c.nombre, p.fecha, p.total\nFROM clientes c\nLEFT JOIN pedidos p ON c.id = p.id_cliente;"
    }
}


# Palabras clave para detectar cuando mostrar un ejemplo
_EXAMPLE_KEYWORDS = {
    "one_to_many": [
        "uno a muchos", "1:n", "1 a n", "one to many",
        "departamento", "empleado", "un registro tiene muchos",
        "clave foranea", "foreign key", "fk"
    ],
    "many_to_many": [
        "muchos a muchos", "n:m", "n a m", "many to many",
        "tabla intermedia", "tabla puente", "pivot",
        "estudiante", "materia", "matricula", "inscripcion"
    ],
    "one_to_one": [
        "uno a uno", "1:1", "one to one",
        "perfil", "usuario", "una a una"
    ],
    "self_referencing": [
        "auto referencia", "autoreferencia", "self",
        "misma tabla", "consigo misma", "jefe", "jerarquia",
        "recursiva", "padre hijo"
    ],
    "join_types": [
        "tipos de join", "inner join", "left join", "right join",
        "full join", "diferencia entre join", "cuando usar join",
        "que join"
    ]
}

# Palabras que activan el panel de ejemplo (deben estar presentes)
_TRIGGER_WORDS = [
    "ejemplo", "muestra", "como se relaciona", "como relaciono",
    "como hago", "ensename", "practico", "visual",
    "como unir", "como uno", "como junto", "relacion entre",
    "relacionar tabla", "join", "unir tabla", "conectar tabla",
    "como conecto", "como enlazo", "diagrama"
]


def detect_example(query: str, topic: str = "") -> dict | None:
    """
    Detecta si la consulta del estudiante requiere un ejemplo
    interactivo de relaciones entre tablas.
    Retorna el ejemplo apropiado o None.
    """
    from app.core.guardrails import is_example_or_problem_requested
    if not is_example_or_problem_requested(query):
        return None

    text = (query + " " + topic).lower().strip()

    # Primero verificar si hay una palabra de activacion
    has_trigger = any(trigger in text for trigger in _TRIGGER_WORDS)
    if not has_trigger:
        return None

    # Buscar el ejemplo mas relevante
    best_match = None
    best_score = 0

    for example_key, keywords in _EXAMPLE_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best_score = score
            best_match = example_key

    # Si no hay match especifico pero hay trigger, usar one_to_many como default
    if best_match is None and has_trigger:
        # Solo si mencionan tablas/relaciones explicitamente
        relation_words = ["tabla", "relacion", "relacionar", "join", "unir", "conectar"]
        if any(w in text for w in relation_words):
            best_match = "one_to_many"

    if best_match:
        return RELATIONSHIP_EXAMPLES[best_match]

    return None
