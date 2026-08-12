const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "alertapy.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL UNIQUE,
    barrio TEXT,
    asma INTEGER NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chequeos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL DEFAULT (datetime('now')),
    sensacion_termica_max REAL,
    nivel TEXT,
    usuarios_objetivo INTEGER,
    enviados_ok INTEGER,
    enviados_error INTEGER,
    modo TEXT
  );

  CREATE TABLE IF NOT EXISTS envios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chequeo_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    estado TEXT NOT NULL,
    detalle TEXT,
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (chequeo_id) REFERENCES chequeos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );
`);

function crearUsuario({ nombre, telefono, barrio, asma }) {
  const stmt = db.prepare(`
    INSERT INTO usuarios (nombre, telefono, barrio, asma)
    VALUES (@nombre, @telefono, @barrio, @asma)
  `);
  return stmt.run({ nombre, telefono, barrio: barrio || null, asma: asma ? 1 : 0 });
}

function buscarPorTelefono(telefono) {
  return db.prepare("SELECT * FROM usuarios WHERE telefono = ?").get(telefono);
}

function listarUsuariosActivosConAsma() {
  return db.prepare("SELECT * FROM usuarios WHERE activo = 1 AND asma = 1").all();
}

function contarUsuarios() {
  return db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE activo = 1").get().n;
}

function registrarChequeo({ sensacionTermicaMax, nivel, usuariosObjetivo, enviadosOk, enviadosError, modo }) {
  const stmt = db.prepare(`
    INSERT INTO chequeos (sensacion_termica_max, nivel, usuarios_objetivo, enviados_ok, enviados_error, modo)
    VALUES (@sensacionTermicaMax, @nivel, @usuariosObjetivo, @enviadosOk, @enviadosError, @modo)
  `);
  const info = stmt.run({ sensacionTermicaMax, nivel, usuariosObjetivo, enviadosOk, enviadosError, modo });
  return info.lastInsertRowid;
}

function registrarEnvio({ chequeoId, usuarioId, estado, detalle }) {
  db.prepare(`
    INSERT INTO envios (chequeo_id, usuario_id, estado, detalle)
    VALUES (@chequeoId, @usuarioId, @estado, @detalle)
  `).run({ chequeoId, usuarioId, estado, detalle: detalle || null });
}

function ultimosChequeos(limit = 20) {
  return db.prepare("SELECT * FROM chequeos ORDER BY id DESC LIMIT ?").all(limit);
}

module.exports = {
  db,
  crearUsuario,
  buscarPorTelefono,
  listarUsuariosActivosConAsma,
  contarUsuarios,
  registrarChequeo,
  registrarEnvio,
  ultimosChequeos,
};
