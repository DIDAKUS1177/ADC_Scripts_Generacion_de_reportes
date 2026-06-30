"""
ADEMINCOL — Gestión de Supervisores e Inspectores
Servidor local Flask + SQLite
Puerto: 8788

Usuarios por defecto:
  admin    / admin123  → Administrador
  carlos.m / sup123    → Supervisor
  maria.r  / sup123    → Supervisor
  ana.g    / insp123   → Inspector
  luis.t   / insp123   → Inspector
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3, os, json, base64, hashlib, pathlib
from datetime import datetime

app  = Flask(__name__, static_folder='.')
CORS(app)

BASE_DIR  = pathlib.Path(__file__).parent
DB_PATH   = BASE_DIR.parent / 'supervisores.db'
FIRMA_DIR = BASE_DIR / 'firmas'
FIRMA_DIR.mkdir(exist_ok=True)

# ──────────────────────────────────────────────────
# DB
# ──────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    return conn

def init_db():
    with get_db() as conn:
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS usuarios (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre      TEXT NOT NULL,
                certificado TEXT,
                correo      TEXT,
                firma       TEXT,
                cargo       TEXT,
                rol         TEXT NOT NULL,
                usuario     TEXT UNIQUE NOT NULL,
                contrasena  TEXT NOT NULL,
                activo      INTEGER DEFAULT 1,
                created_at  TEXT
            );
            CREATE TABLE IF NOT EXISTS ots (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                num_ot        TEXT NOT NULL,
                contrato      TEXT,
                descripcion   TEXT,
                cliente       TEXT,
                ubicacion     TEXT,
                supervisor_id INTEGER,
                inspector_id  INTEGER,
                fecha_inicio  TEXT,
                fecha_fin     TEXT,
                estado        TEXT DEFAULT 'PENDIENTE',
                observaciones TEXT,
                created_at    TEXT
            );
            CREATE TABLE IF NOT EXISTS reportes (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                ot_id             INTEGER,
                nombre            TEXT,
                generado_por      INTEGER,
                fecha_generacion  TEXT,
                datos_json        TEXT
            );
        ''')
        # Seed si BD vacía
        if conn.execute('SELECT COUNT(*) FROM usuarios').fetchone()[0] == 0:
            ahora = datetime.now().isoformat()
            conn.executemany(
                'INSERT INTO usuarios (nombre,certificado,correo,cargo,rol,usuario,contrasena,created_at) VALUES (?,?,?,?,?,?,?,?)',
                [
                    ('Administrador General','ADM-001','admin@ademincol.com',   'Administrador General',    'ADMINISTRADOR','admin',    'admin123', ahora),
                    ('Carlos Méndez Ruíz',   'CERT-SUP-001','carlos@ademincol.com','Supervisor Senior',   'SUPERVISOR',   'carlos.m', 'sup123',   ahora),
                    ('María Rodríguez V.',   'CERT-SUP-004','maria@ademincol.com', 'Supervisora de Campo','SUPERVISOR',   'maria.r',  'sup123',   ahora),
                    ('Ana García López',     'CERT-INS-002','ana@ademincol.com',   'Inspector de Integridad','INSPECTOR', 'ana.g',    'insp123',  ahora),
                    ('Luis Torres Pérez',    'CERT-INS-003','luis@ademincol.com',  'Inspector END',       'INSPECTOR',    'luis.t',   'insp123',  ahora),
                ]
            )
            conn.executemany(
                'INSERT INTO ots (num_ot,contrato,cliente,ubicacion,supervisor_id,inspector_id,fecha_inicio,fecha_fin,estado,descripcion,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                [
                    ('OT-2025-001','CTR-2025-A','ECOPETROL S.A.',     'Campo Rubiales, Meta',     2,4,'2025-01-15','2025-02-28','COMPLETADA','Inspección de espesores por UT en líneas de producción. Incluye líneas de crudo, gas y agua de producción.',ahora),
                    ('OT-2025-002','CTR-2025-B','FRONTERA ENERGY',    'Campo Quifa, Vichada',     2,5,'2025-03-01','2025-03-30','EN CURSO',  'Inspección visual y END en recipientes a presión. Alcance: 8 recipientes, prueba de hermeticidad.',ahora),
                    ('OT-2025-003','CTR-2025-C','PERENCO COLOMBIA',   'Bloque Capachos, Arauca',  3,4,'2025-04-10','2025-05-15','PENDIENTE', 'Rastreo de línea por PCM y medición de espesores en puntos críticos RBI.',ahora),
                    ('OT-2025-004','CTR-2025-D','AMERISUR RESOURCES', 'Putumayo',                 3,5,'2025-02-01','2025-02-28','COMPLETADA','Inspección VT de tanques de almacenamiento API 653.',ahora),
                ]
            )

init_db()

def row_dict(row):
    return dict(row) if row else None

# ──────────────────────────────────────────────────
# FIRMA — guardar base64 en disco
# ──────────────────────────────────────────────────
def save_firma(data_url):
    if not data_url or not data_url.startswith('data:image'):
        return ''
    try:
        header, b64 = data_url.split(',', 1)
        ext  = 'png' if 'png' in header else 'jpg'
        name = hashlib.md5(b64[:64].encode()).hexdigest()[:12] + '.' + ext
        path = FIRMA_DIR / name
        with open(str(path), 'wb') as f:
            f.write(base64.b64decode(b64 + '=='))
        return 'firmas/' + name
    except Exception:
        return ''

def firma_url(path):
    if not path:
        return ''
    if path.startswith('http') or path.startswith('/'):
        return path
    return '/firmas/' + path.split('firmas/')[-1]

# ──────────────────────────────────────────────────
# ESTÁTICA
# ──────────────────────────────────────────────────
@app.route('/', defaults={'path': 'Index.html'})
@app.route('/<path:path>')
def serve_static(path):
    # Rutas de API y firmas se manejan por separado
    if path.startswith('api/') or path.startswith('reporte') or path.startswith('firmas/'):
        return 'not found', 404
    return send_from_directory(str(BASE_DIR), path)

@app.route('/firmas/<path:filename>')
def serve_firma(filename):
    return send_from_directory(str(FIRMA_DIR), filename)

# ──────────────────────────────────────────────────
# API
# ──────────────────────────────────────────────────
@app.route('/api/<fn>', methods=['POST'])
def api(fn):
    body = request.get_json(force=True, silent=True) or {}
    args = body.get('args', [])

    # ── LOGIN ─────────────────────────────────────
    if fn == 'validarUsuario':
        usuario, contrasena = str(args[0]).strip(), str(args[1])
        with get_db() as conn:
            row = conn.execute(
                'SELECT * FROM usuarios WHERE usuario=? AND activo=1', (usuario,)
            ).fetchone()
            if row and row['contrasena'] == contrasena:
                u = row_dict(row)
                u.pop('contrasena', None)
                u['firma'] = firma_url(u.get('firma',''))
                return jsonify({'ok': True, 'user': u})
        return jsonify({'ok': False})

    # ── USUARIOS ──────────────────────────────────
    if fn == 'getUsuarios':
        with get_db() as conn:
            rows = conn.execute('SELECT * FROM usuarios WHERE activo=1 ORDER BY rol,nombre').fetchall()
            result = []
            for r in rows:
                d = row_dict(r)
                d.pop('contrasena', None)
                d['firma'] = firma_url(d.get('firma',''))
                result.append(d)
        return jsonify(result)

    if fn == 'createUsuario':
        data = args[0]
        firma_path = save_firma(data.get('firma',''))
        with get_db() as conn:
            try:
                conn.execute(
                    'INSERT INTO usuarios (nombre,certificado,correo,firma,cargo,rol,usuario,contrasena,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
                    (data['nombre'], data.get('certificado',''), data.get('correo',''),
                     firma_path, data.get('cargo',''), data['rol'],
                     data['usuario'], data['contrasena'], datetime.now().isoformat())
                )
                return jsonify({'ok': True})
            except sqlite3.IntegrityError:
                return jsonify({'ok': False, 'error': 'El nombre de usuario ya existe'})

    if fn == 'updateUsuario':
        data = args[0]
        uid = data['id']
        firma_path = save_firma(data.get('firma',''))
        with get_db() as conn:
            if firma_path:
                conn.execute(
                    'UPDATE usuarios SET nombre=?,certificado=?,correo=?,firma=?,cargo=?,rol=?,usuario=? WHERE id=?',
                    (data['nombre'],data.get('certificado',''),data.get('correo',''),
                     firma_path,data.get('cargo',''),data['rol'],data['usuario'],uid)
                )
            else:
                conn.execute(
                    'UPDATE usuarios SET nombre=?,certificado=?,correo=?,cargo=?,rol=?,usuario=? WHERE id=?',
                    (data['nombre'],data.get('certificado',''),data.get('correo',''),
                     data.get('cargo',''),data['rol'],data['usuario'],uid)
                )
            if data.get('contrasena'):
                conn.execute('UPDATE usuarios SET contrasena=? WHERE id=?', (data['contrasena'], uid))
        return jsonify({'ok': True})

    if fn == 'deleteUsuario':
        uid = int(args[0])
        with get_db() as conn:
            conn.execute('UPDATE usuarios SET activo=0 WHERE id=?', (uid,))
        return jsonify({'ok': True})

    # ── OTs ───────────────────────────────────────
    if fn == 'getOTs':
        uid, rol = args[0], args[1]
        where = ''
        params = []
        if rol == 'SUPERVISOR':
            where = 'WHERE o.supervisor_id=?'; params = [uid]
        elif rol == 'INSPECTOR':
            where = 'WHERE o.inspector_id=?';  params = [uid]
        with get_db() as conn:
            rows = conn.execute(f'''
                SELECT o.*, s.nombre as supervisor_nombre, i.nombre as inspector_nombre
                FROM ots o
                LEFT JOIN usuarios s ON o.supervisor_id = s.id
                LEFT JOIN usuarios i ON o.inspector_id  = i.id
                {where}
                ORDER BY o.id DESC
            ''', params).fetchall()
        return jsonify([row_dict(r) for r in rows])

    if fn == 'createOT':
        d = args[0]
        with get_db() as conn:
            conn.execute(
                'INSERT INTO ots (num_ot,contrato,descripcion,cliente,ubicacion,supervisor_id,inspector_id,fecha_inicio,fecha_fin,estado,observaciones,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
                (d['num_ot'],d.get('contrato',''),d.get('descripcion',''),
                 d.get('cliente',''),d.get('ubicacion',''),
                 d.get('supervisor_id'),d.get('inspector_id'),
                 d.get('fecha_inicio',''),d.get('fecha_fin',''),
                 d.get('estado','PENDIENTE'),d.get('observaciones',''),
                 datetime.now().isoformat())
            )
        return jsonify({'ok': True})

    if fn == 'updateOT':
        d = args[0]
        with get_db() as conn:
            conn.execute(
                'UPDATE ots SET num_ot=?,contrato=?,descripcion=?,cliente=?,ubicacion=?,supervisor_id=?,inspector_id=?,fecha_inicio=?,fecha_fin=?,estado=?,observaciones=? WHERE id=?',
                (d['num_ot'],d.get('contrato',''),d.get('descripcion',''),
                 d.get('cliente',''),d.get('ubicacion',''),
                 d.get('supervisor_id'),d.get('inspector_id'),
                 d.get('fecha_inicio',''),d.get('fecha_fin',''),
                 d.get('estado','PENDIENTE'),d.get('observaciones',''),
                 d['id'])
            )
        return jsonify({'ok': True})

    # ── REPORTES ──────────────────────────────────
    if fn == 'getReportes':
        uid, rol = args[0], args[1]
        where = ''
        params = []
        if rol == 'SUPERVISOR': where = 'AND o.supervisor_id=?'; params = [uid]
        if rol == 'INSPECTOR':  where = 'AND o.inspector_id=?';  params = [uid]
        with get_db() as conn:
            rows = conn.execute(f'''
                SELECT r.*, o.num_ot, u.nombre as generado_por_nombre
                FROM reportes r
                JOIN ots o ON r.ot_id = o.id
                LEFT JOIN usuarios u ON r.generado_por = u.id
                WHERE 1=1 {where}
                ORDER BY r.id DESC
            ''', params).fetchall()
        return jsonify([row_dict(r) for r in rows])

    if fn == 'generarReporte':
        ot_id, gen_por = int(args[0]), int(args[1])
        with get_db() as conn:
            ot = conn.execute('''
                SELECT o.*,
                       s.nombre as supervisor_nombre, s.cargo as supervisor_cargo,
                       s.certificado as supervisor_cert, s.firma as supervisor_firma,
                       i.nombre as inspector_nombre,  i.cargo as inspector_cargo,
                       i.certificado as inspector_cert, i.firma as inspector_firma
                FROM ots o
                LEFT JOIN usuarios s ON o.supervisor_id = s.id
                LEFT JOIN usuarios i ON o.inspector_id  = i.id
                WHERE o.id=?
            ''', (ot_id,)).fetchone()
            if not ot:
                return jsonify({'ok': False, 'error': 'OT no encontrada'})
            d = row_dict(ot)
            nombre = 'Reporte ' + d['num_ot'] + ' — ' + datetime.now().strftime('%Y-%m-%d')
            conn.execute(
                'INSERT INTO reportes (ot_id,nombre,generado_por,fecha_generacion,datos_json) VALUES (?,?,?,?,?)',
                (ot_id, nombre, gen_por, datetime.now().strftime('%Y-%m-%d %H:%M'), json.dumps(d, default=str))
            )
            rid = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        return jsonify({'ok': True, 'reporte_id': rid})

    if fn == 'cambiarContrasena':
        uid, nueva = int(args[0]), str(args[1])
        if len(nueva) < 4:
            return jsonify({'ok': False, 'error': 'Mínimo 4 caracteres'})
        with get_db() as conn:
            conn.execute('UPDATE usuarios SET contrasena=? WHERE id=?', (nueva, uid))
        return jsonify({'ok': True})

    # ── INDICADORES ───────────────────────────────
    if fn == 'getIndicadores':
        uid, rol = args[0], args[1]
        with get_db() as conn:
            total_sup  = conn.execute("SELECT COUNT(*) FROM usuarios WHERE rol='SUPERVISOR' AND activo=1").fetchone()[0]
            total_insp = conn.execute("SELECT COUNT(*) FROM usuarios WHERE rol='INSPECTOR'  AND activo=1").fetchone()[0]
            total_rep  = conn.execute('SELECT COUNT(*) FROM reportes').fetchone()[0]

            if rol in ('SUPERVISOR', 'INSPECTOR'):
                col = 'supervisor_id' if rol == 'SUPERVISOR' else 'inspector_id'
                mis         = conn.execute(f'SELECT COUNT(*) FROM ots WHERE {col}=?', (uid,)).fetchone()[0]
                en_curso    = conn.execute(f"SELECT COUNT(*) FROM ots WHERE {col}=? AND estado='EN CURSO'",   (uid,)).fetchone()[0]
                completadas = conn.execute(f"SELECT COUNT(*) FROM ots WHERE {col}=? AND estado='COMPLETADA'",(uid,)).fetchone()[0]
                pendientes  = conn.execute(f"SELECT COUNT(*) FROM ots WHERE {col}=? AND estado='PENDIENTE'", (uid,)).fetchone()[0]
                mis_rep     = conn.execute(f'SELECT COUNT(*) FROM reportes r JOIN ots o ON r.ot_id=o.id WHERE o.{col}=?', (uid,)).fetchone()[0]
                recientes   = conn.execute(f'''
                    SELECT o.*, s.nombre as supervisor_nombre, i.nombre as inspector_nombre
                    FROM ots o
                    LEFT JOIN usuarios s ON o.supervisor_id=s.id
                    LEFT JOIN usuarios i ON o.inspector_id=i.id
                    WHERE o.{col}=? ORDER BY o.id DESC LIMIT 6
                ''', (uid,)).fetchall()
            else:  # ADMIN
                mis = en_curso = completadas = pendientes = mis_rep = 0
                recientes = conn.execute('''
                    SELECT o.*, s.nombre as supervisor_nombre, i.nombre as inspector_nombre
                    FROM ots o
                    LEFT JOIN usuarios s ON o.supervisor_id=s.id
                    LEFT JOIN usuarios i ON o.inspector_id=i.id
                    ORDER BY o.id DESC LIMIT 6
                ''').fetchall()

            ots_pend  = conn.execute("SELECT COUNT(*) FROM ots WHERE estado='PENDIENTE'").fetchone()[0]
            ots_curso = conn.execute("SELECT COUNT(*) FROM ots WHERE estado='EN CURSO'").fetchone()[0]
            ots_comp  = conn.execute("SELECT COUNT(*) FROM ots WHERE estado='COMPLETADA'").fetchone()[0]
            ots_canc  = conn.execute("SELECT COUNT(*) FROM ots WHERE estado='CANCELADA'").fetchone()[0]

            sup_data = conn.execute('''
                SELECT s.id, s.nombre,
                       SUM(CASE WHEN o.estado='COMPLETADA' THEN 1 ELSE 0 END) as completadas,
                       SUM(CASE WHEN o.estado='EN CURSO'   THEN 1 ELSE 0 END) as en_curso,
                       SUM(CASE WHEN o.estado='PENDIENTE'  THEN 1 ELSE 0 END) as pendientes
                FROM usuarios s
                LEFT JOIN ots o ON o.supervisor_id=s.id
                WHERE s.rol='SUPERVISOR' AND s.activo=1
                GROUP BY s.id ORDER BY completadas DESC
            ''').fetchall()

            insp_data = conn.execute('''
                SELECT i.id, i.nombre, i.cargo, COUNT(o.id) as total_ots
                FROM usuarios i
                LEFT JOIN ots o ON o.inspector_id=i.id
                WHERE i.rol='INSPECTOR' AND i.activo=1
                GROUP BY i.id ORDER BY total_ots DESC
            ''').fetchall()

        return jsonify({
            'misOTs': mis, 'otsEnCurso': en_curso or ots_curso,
            'otsCompletadas': completadas or ots_comp, 'misReportes': mis_rep,
            'totalSupervisores': total_sup, 'totalInspectores': total_insp,
            'otsActivas': ots_pend + ots_curso, 'totalReportes': total_rep,
            'otsPendientes': ots_pend, 'otsCanceladas': ots_canc,
            'otsRecientes': [row_dict(r) for r in recientes],
            'indicadoresSupervisores': [row_dict(r) for r in sup_data],
            'indicadoresInspectores':  [row_dict(r) for r in insp_data],
        })

    return jsonify({'error': 'Función no encontrada: ' + fn}), 404


# ──────────────────────────────────────────────────
# REPORTE HTML IMPRIMIBLE
# ──────────────────────────────────────────────────
@app.route('/reporte/<int:ot_id>')
def reporte_ot(ot_id):
    with get_db() as conn:
        ot = conn.execute('''
            SELECT o.*,
                   s.nombre as supervisor_nombre, s.cargo as supervisor_cargo,
                   s.certificado as supervisor_cert, s.firma as supervisor_firma,
                   i.nombre as inspector_nombre,  i.cargo as inspector_cargo,
                   i.certificado as inspector_cert, i.firma as inspector_firma
            FROM ots o
            LEFT JOIN usuarios s ON o.supervisor_id = s.id
            LEFT JOIN usuarios i ON o.inspector_id  = i.id
            WHERE o.id=?
        ''', (ot_id,)).fetchone()
    if not ot:
        return 'OT no encontrada', 404
    return render_reporte(row_dict(ot))


@app.route('/reporte-id/<int:rep_id>')
def reporte_por_id(rep_id):
    with get_db() as conn:
        rep = conn.execute('SELECT datos_json FROM reportes WHERE id=?', (rep_id,)).fetchone()
    if not rep:
        return 'Reporte no encontrado', 404
    return render_reporte(json.loads(rep['datos_json']))


def s(d, k):
    v = d.get(k)
    return str(v) if v else '—'


def render_reporte(d):
    # Firmas como tags <img> si existen en disco
    def firma_tag(path_key):
        p = d.get(path_key, '')
        if not p:
            return ''
        if p.startswith('firmas/'):
            full = BASE_DIR / p
            if full.exists():
                return f'<img src="/{p}" style="max-height:64px;max-width:200px;object-fit:contain">'
        return ''

    sup_firma  = firma_tag('supervisor_firma')
    insp_firma = firma_tag('inspector_firma')

    def bloque(label, value):
        if not value or value == '—':
            return ''
        return f'<div><dt class="fl">{label}</dt><dd class="fv">{value}</dd></div>'

    desc_obs = ''
    if d.get('descripcion'):
        desc_obs += f'<div class="col2"><dt class="fl">Descripción del Trabajo</dt><dd class="fv" style="line-height:1.6">{d["descripcion"]}</dd></div>'
    if d.get('observaciones'):
        desc_obs += f'<div class="col2"><dt class="fl">Observaciones</dt><dd class="fv">{d["observaciones"]}</dd></div>'

    html = f'''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte {s(d,"num_ot")}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  *{{font-family:Inter,sans-serif;box-sizing:border-box;}}
  body{{margin:0;padding:20px;background:#f8fafc;color:#1e293b;}}
  .page{{max-width:760px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.1);}}
  .hd{{background:#dc2626;padding:24px 32px;color:#fff;border-bottom:4px solid #991b1b;}}
  .hd-brand{{font-size:20px;font-weight:900;font-style:italic;letter-spacing:-.5px;}}
  .hd-sub{{font-size:11px;opacity:.75;margin-top:1px;}}
  .hd-num{{font-size:26px;font-weight:800;margin-top:10px;font-family:monospace;}}
  .hd-cont{{font-size:13px;opacity:.85;margin-top:2px;}}
  .body{{padding:28px 32px;}}
  .sec{{margin-bottom:24px;}}
  .sec-t{{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#dc2626;border-bottom:2px solid #fee2e2;padding-bottom:5px;margin-bottom:14px;}}
  dl{{display:grid;grid-template-columns:1fr 1fr;gap:10px 28px;margin:0;}}
  .col2{{grid-column:span 2;}}
  .fl{{font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;margin:0 0 2px;}}
  .fv{{font-size:13px;color:#1e293b;font-weight:500;margin:0;}}
  .estado{{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:#dbeafe;color:#1d4ed8;}}
  .sign-row{{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;}}
  .sign-cell{{text-align:center;}}
  .firm-box{{border:1px dashed #e2e8f0;border-radius:8px;min-height:72px;display:flex;align-items:center;justify-content:center;padding:8px;margin-bottom:8px;}}
  .sign-name{{font-size:13px;font-weight:700;color:#1e293b;margin-top:4px;}}
  .sign-role{{font-size:11px;color:#64748b;}}
  .sign-cert{{font-size:10px;color:#94a3b8;font-family:monospace;}}
  .footer{{background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 32px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;}}
  @media print{{body{{background:#fff;padding:0;}}.page{{box-shadow:none;border-radius:0;}}}}
</style>
</head>
<body>
<div class="page">
  <div class="hd">
    <div class="hd-brand">ADEMINCOL</div>
    <div class="hd-sub">Asesorías, Diagnóstico, Evaluación y Mantenimiento Industrial de Colombia</div>
    <div class="hd-num">{s(d,"num_ot")}</div>
    <div class="hd-cont">{s(d,"contrato")}</div>
  </div>
  <div class="body">
    <div class="sec">
      <div class="sec-t">Información de la Orden de Trabajo</div>
      <dl>
        {bloque("N° Orden de Trabajo", s(d,"num_ot"))}
        {bloque("Contrato", s(d,"contrato"))}
        {bloque("Cliente", s(d,"cliente"))}
        {bloque("Ubicación / Sitio", s(d,"ubicacion"))}
        {bloque("Fecha Inicio", s(d,"fecha_inicio"))}
        {bloque("Fecha Fin", s(d,"fecha_fin"))}
        <div><dt class="fl">Estado</dt><dd class="fv"><span class="estado">{s(d,"estado")}</span></dd></div>
        {desc_obs}
      </dl>
    </div>
    <div class="sec">
      <div class="sec-t">Personal Asignado</div>
      <dl>
        <div><dt class="fl">Supervisor</dt><dd class="fv">{s(d,"supervisor_nombre")}</dd></div>
        <div><dt class="fl">Inspector</dt><dd class="fv">{s(d,"inspector_nombre")}</dd></div>
        <div><dt class="fl">Cargo Supervisor</dt><dd class="fv">{s(d,"supervisor_cargo")}</dd></div>
        <div><dt class="fl">Cargo Inspector</dt><dd class="fv">{s(d,"inspector_cargo")}</dd></div>
        <div><dt class="fl">Cert. Supervisor</dt><dd class="fv" style="font-family:monospace">{s(d,"supervisor_cert")}</dd></div>
        <div><dt class="fl">Cert. Inspector</dt><dd class="fv" style="font-family:monospace">{s(d,"inspector_cert")}</dd></div>
      </dl>
    </div>
    <div class="sign-row">
      <div class="sign-cell">
        <div class="firm-box">{sup_firma if sup_firma else '<span style="font-size:11px;color:#cbd5e1">Firma pendiente</span>'}</div>
        <div class="sign-name">{s(d,"supervisor_nombre")}</div>
        <div class="sign-role">{s(d,"supervisor_cargo")}</div>
        <div class="sign-cert">Cert: {s(d,"supervisor_cert")}</div>
      </div>
      <div class="sign-cell">
        <div class="firm-box">{insp_firma if insp_firma else '<span style="font-size:11px;color:#cbd5e1">Firma pendiente</span>'}</div>
        <div class="sign-name">{s(d,"inspector_nombre")}</div>
        <div class="sign-role">{s(d,"inspector_cargo")}</div>
        <div class="sign-cert">Cert: {s(d,"inspector_cert")}</div>
      </div>
    </div>
  </div>
  <div class="footer">
    <span>ADEMINCOL — Documento generado automáticamente</span>
    <span>{datetime.now().strftime("%Y-%m-%d %H:%M")}</span>
  </div>
</div>
<script>window.addEventListener('load', function(){{ window.print(); }})</script>
</body>
</html>'''
    return html


# ──────────────────────────────────────────────────
if __name__ == '__main__':
    print('=' * 52)
    print('  ADEMINCOL — Gestión de Supervisores')
    print('  http://localhost:8788')
    print('=' * 52)
    print('  Usuarios de prueba:')
    print('    admin    / admin123  → Administrador')
    print('    carlos.m / sup123    → Supervisor')
    print('    maria.r  / sup123    → Supervisor')
    print('    ana.g    / insp123   → Inspector')
    print('    luis.t   / insp123   → Inspector')
    print('=' * 52)
    app.run(host='0.0.0.0', port=8788, debug=True)
