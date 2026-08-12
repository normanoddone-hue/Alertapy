require("dotenv").config();
const cron = require("node-cron");
const { obtenerSensacionTermicaMaxima } = require("./weather");
const { clasificarRiesgoCalor, requiereAlerta } = require("./risk");
const { enviarAlertaCalor, credencialesConfiguradas } = require("./whatsapp");
const { listarUsuariosActivosConAsma, registrarChequeo, registrarEnvio } = require("./db");

const CIUDAD = process.env.PILOT_CITY_NAME || "San Lorenzo";
const LAT = Number(process.env.PILOT_LAT || -25.34);
const LON = Number(process.env.PILOT_LON || -57.5088);

async function ejecutarChequeo() {
  console.log(`\n[chequeo] ${new Date().toISOString()} — consultando clima real para ${CIUDAD}...`);

  let clima;
  try {
    clima = await obtenerSensacionTermicaMaxima(LAT, LON, 24);
  } catch (err) {
    console.error("[chequeo] Error consultando Open-Meteo:", err.message);
    registrarChequeo({
      sensacionTermicaMax: null,
      nivel: "error",
      usuariosObjetivo: 0,
      enviadosOk: 0,
      enviadosError: 0,
      modo: "error-clima",
    });
    return { error: err.message };
  }

  const nivel = clasificarRiesgoCalor(clima.sensacionTermicaMax);
  console.log(
    `[chequeo] Sensación térmica máx. prevista: ${clima.sensacionTermicaMax.toFixed(1)}°C (pico ${clima.horaPico}) -> nivel ${nivel}`
  );

  const modo = credencialesConfiguradas() ? "real" : "simulado";
  const usuarios = requiereAlerta(nivel) ? listarUsuariosActivosConAsma() : [];

  let enviadosOk = 0;
  let enviadosError = 0;

  const chequeoId = registrarChequeo({
    sensacionTermicaMax: clima.sensacionTermicaMax,
    nivel,
    usuariosObjetivo: usuarios.length,
    enviadosOk: 0,
    enviadosError: 0,
    modo,
  });

  if (!requiereAlerta(nivel)) {
    console.log("[chequeo] Riesgo verde: no se envían alertas.");
    return { nivel, clima, usuariosNotificados: 0 };
  }

  console.log(`[chequeo] Riesgo ${nivel}: notificando a ${usuarios.length} usuario(s) con asma registrados...`);

  for (const usuario of usuarios) {
    try {
      const resultado = await enviarAlertaCalor({
        telefono: usuario.telefono,
        ciudad: CIUDAD,
        sensacionTermicaMax: clima.sensacionTermicaMax,
      });
      if (resultado.ok) {
        enviadosOk++;
      } else {
        enviadosError++;
      }
      registrarEnvio({
        chequeoId,
        usuarioId: usuario.id,
        estado: resultado.ok ? "ok" : "error",
        detalle: resultado.detalle,
      });
    } catch (err) {
      enviadosError++;
      registrarEnvio({ chequeoId, usuarioId: usuario.id, estado: "error", detalle: err.message });
    }
  }

  require("./db").db
    .prepare("UPDATE chequeos SET enviados_ok = ?, enviados_error = ? WHERE id = ?")
    .run(enviadosOk, enviadosError, chequeoId);

  console.log(`[chequeo] Listo. Enviados OK: ${enviadosOk} · Errores: ${enviadosError} · Modo: ${modo}`);
  return { nivel, clima, usuariosNotificados: enviadosOk };
}

function iniciarScheduler() {
  // Dos chequeos diarios: temprano a la mañana (para el día) y a media
  // tarde (para cubrir la noche/madrugada siguiente). Hora de Paraguay.
  cron.schedule("0 7,15 * * *", () => {
    ejecutarChequeo().catch((err) => console.error("[scheduler] Error inesperado:", err));
  }, { timezone: "America/Asuncion" });

  console.log("[scheduler] Programado: chequeos diarios a las 07:00 y 15:00 (hora Paraguay).");
}

if (require.main === module) {
  const soloUnaVez = process.argv.includes("--once");
  ejecutarChequeo().then((r) => {
    if (!soloUnaVez) return;
    console.log("[chequeo] Resultado:", r);
    process.exit(0);
  });
}

module.exports = { ejecutarChequeo, iniciarScheduler };
