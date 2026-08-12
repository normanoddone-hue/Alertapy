const UMBRAL_AMARILLO = Number(process.env.RISK_THRESHOLD_AMARILLO || 34);
const UMBRAL_ROJO = Number(process.env.RISK_THRESHOLD_ROJO || 40);

/**
 * Clasifica el riesgo de calor para personas asmáticas a partir de la
 * sensación térmica máxima pronosticada (°C).
 *
 * Referencia general (no clínica): a partir de ~34°C de sensación térmica
 * el esfuerzo respiratorio y la carga cardiovascular aumentan de forma
 * relevante para personas con asma; por encima de ~40°C el riesgo es alto
 * para cualquier actividad al aire libre. Estos umbrales son un punto de
 * partida razonable para el piloto y deberían ajustarse con guía médica
 * local antes de escalar el producto.
 */
function clasificarRiesgoCalor(sensacionTermicaMax) {
  if (sensacionTermicaMax >= UMBRAL_ROJO) return "rojo";
  if (sensacionTermicaMax >= UMBRAL_AMARILLO) return "amarillo";
  return "verde";
}

function requiereAlerta(nivel) {
  return nivel === "amarillo" || nivel === "rojo";
}

module.exports = { clasificarRiesgoCalor, requiereAlerta, UMBRAL_AMARILLO, UMBRAL_ROJO };
