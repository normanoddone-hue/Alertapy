require("dotenv").config();
const path = require("path");
const express = require("express");

const {
  crearUsuario,
  buscarPorTelefono,
  contarUsuarios,
  ultimosChequeos,
} = require("./src/db");
const { iniciarScheduler, ejecutarChequeo } = require("./src/scheduler");
const { credencialesConfiguradas } = require("./src/whatsapp");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "cambiame";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/** Normaliza un teléfono paraguayo a dígitos puros con código de país 595. */
function normalizarTelefonoPY(input) {
  if (!input) return null;
  let d = String(input).replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "595" + d.slice(1); // 0981... -> 595981...
  if (!d.startsWith("595")) d = "595" + d;
  // Paraguay: 595 + 9 dígitos (celular) = 12 dígitos totales.
  if (!/^595\d{9}$/.test(d)) return null;
  return d;
}

app.post("/api/registro", (req, res) => {
  const { nombre, telefono, barrio, asma } = req.body || {};

  if (!nombre || String(nombre).trim().length < 2) {
    return res.status(400).json({ ok: false, error: "Nombre inválido." });
  }
  const telefonoNormalizado = normalizarTelefonoPY(telefono);
  if (!telefonoNormalizado) {
    return res.status(400).json({
      ok: false,
      error: "Teléfono inválido. Usá un celular paraguayo, ej: 0981 234 567 o +595981234567.",
    });
  }

  const existente = buscarPorTelefono(telefonoNormalizado);
  if (existente) {
    return res.status(409).json({ ok: false, error: "Ese número ya está registrado en el piloto." });
  }

  try {
    crearUsuario({
      nombre: String(nombre).trim(),
      telefono: telefonoNormalizado,
      barrio: barrio ? String(barrio).trim() : null,
      asma: Boolean(asma),
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Error creando usuario:", err);
    return res.status(500).json({ ok: false, error: "Error interno registrando el usuario." });
  }
});

app.get("/api/estado", (req, res) => {
  res.json({
    ok: true,
    piloto: process.env.PILOT_CITY_NAME || "San Lorenzo",
    usuariosRegistrados: contarUsuarios(),
    whatsappModo: credencialesConfiguradas() ? "real" : "simulado",
    ultimosChequeos: ultimosChequeos(5),
  });
});

function requiereAdmin(req, res, next) {
  const key = req.headers["x-admin-key"] || req.query.key;
  if (key !== ADMIN_KEY) return res.status(401).json({ ok: false, error: "No autorizado." });
  next();
}

app.post("/api/admin/chequear-ahora", requiereAdmin, async (req, res) => {
  try {
    const resultado = await ejecutarChequeo();
    res.json({ ok: true, resultado });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`AlertaPy corriendo en http://localhost:${PORT}`);
  console.log(`Modo WhatsApp: ${credencialesConfiguradas() ? "REAL (Meta Cloud API)" : "SIMULADO (sin credenciales)"}`);
  iniciarScheduler();
});
