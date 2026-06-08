import re
import logging
logger = logging.getLogger(__name__)

MODEL_TRIGGERS = ["modela","modelo","diseña","diseño","crea la base","estructura de la base","base de datos para","bd para","sistema de","crear las tablas","generar el script","normaliz","diagrama","esquema"]

def detect_db_model(query, feedback):
    if not any(t in query.lower() for t in MODEL_TRIGGERS): return None
    tables = extract_tables_from_sql(feedback)
    if not tables or len(tables) < 2: return None
    relationships = extract_relationships(feedback, tables)
    sql = extract_sql_script(feedback)
    return {"title": "Modelo de Base de Datos", "description": f"Esquema con {len(tables)} tablas", "tables": tables, "relationships": relationships, "sql": sql or "-- Script generado por AMY"}

def extract_tables_from_sql(text):
    tables = []
    pattern = r"CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)\s*\(([^;]+?)\)\s*;"
    for m in re.finditer(pattern, text, re.IGNORECASE|re.DOTALL):
        cols = parse_columns(m.group(2))
        if cols:
            tables.append({"name": m.group(1), "columns": cols})
    return tables

def parse_columns(text):
    cols = []
    lines = []
    depth = 0
    current = ""
    for char in text:
        if char == "(":
            depth += 1
            current += char
        elif char == ")":
            depth -= 1
            current += char
        elif char == "," and depth == 0:
            lines.append(current.strip())
            current = ""
        else:
            current += char
    if current.strip():
        lines.append(current.strip())
    for line in lines:
        line = line.strip()
        if not line: continue
        u = line.upper()
        if any(u.startswith(k) for k in ["PRIMARY KEY","FOREIGN KEY","UNIQUE","INDEX","CHECK","CONSTRAINT"]): continue
        parts = line.split()
        if len(parts) < 2: continue
        name = parts[0].strip("`\'\"`")
        # Tipo completo incluyendo VARCHAR(100)
        typ = parts[1]
        if "(" in parts[1] and ")" not in parts[1]:
            for i in range(2, len(parts)):
                typ += parts[i]
                if ")" in parts[i]: break
        # Detectar constraint
        constraint = None
        if "PRIMARY KEY" in u:
            constraint = "PK"
        elif "REFERENCES" in u:
            constraint = "FK"
        elif name.lower().startswith("id_") or name.lower().endswith("_id"):
            constraint = "FK"
        elif name.lower() == "id":
            constraint = "PK"
        cols.append({"name": name, "type": typ, "constraint": constraint})
    return cols

def extract_relationships(text, tables):
    rels = []
    cp = r"CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)\s*\(([^;]+?)\)\s*;"
    fp = r"FOREIGN KEY\s*\((\w+)\)\s*REFERENCES\s*(\w+)\s*\((\w+)\)"
    for tm in re.finditer(cp, text, re.IGNORECASE|re.DOTALL):
        for fm in re.finditer(fp, tm.group(2), re.IGNORECASE):
            rels.append({"from_table": tm.group(1), "from_column": fm.group(1), "to_table": fm.group(2), "to_column": fm.group(3), "type": "N:1", "label": f"{tm.group(1)} -> {fm.group(2)}"})
    return rels

def extract_sql_script(text):
    m = re.findall(r"```(?:sql)?\n?(.*?)```", text, re.DOTALL|re.IGNORECASE)
    return "\n\n".join(m).strip() if m else ""
