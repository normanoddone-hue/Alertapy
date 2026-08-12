/**
 * Cliente de clima real contra Open-Meteo (https://open-meteo.com), una API
 * pública, gratuita y sin API key, que agrega modelos meteorológicos
 * oficiales (incluye cobertura de Paraguay). No es DINAC directamente
 * -DINAC no publica una API pública-, pero es dato real de pronóstico,
 * no simulado.
 */

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

/**
 * Devuelve la sensación térmica máxima pronosticada para las próximas
 * `horas` horas en el punto (lat, lon) dado.
 */
async function obtenerSensacionTermicaMaxima(lat, lon, horas = 24) {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lon);
  url.searchParams.set("hourly", "apparent_temperature,temperature_2m,relative_humidity_2m");
  // Pedimos las horas en UTC (explícito, sin depender del default de la API)
  // para poder parsear cada timestamp sin ambigüedad con `new Date(t + "Z")`,
  // sin importar en qué zona horaria corra el servidor. Si pidiéramos
  // "America/Asuncion" acá, Open-Meteo devuelve horas locales *sin* offset
  // (ej: "2026-08-11T07:00"), y `new Date(...)` las interpretaría con la
  // zona horaria del proceso Node, no la de Paraguay -> desfasaje de horas
  // si el servidor corre en UTC (lo más común en hosting).
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("forecast_days", "2");

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`Open-Meteo respondió ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();

  const ahora = Date.now();
  const limite = ahora + horas * 60 * 60 * 1000;

  const horasFuturas = data.hourly.time
    .map((t, i) => ({
      time: new Date(t + "Z").getTime(),
      apparentTemp: data.hourly.apparent_temperature[i],
      temp: data.hourly.temperature_2m[i],
      humidity: data.hourly.relative_humidity_2m[i],
    }))
    .filter((h) => h.time >= ahora && h.time <= limite);

  if (horasFuturas.length === 0) {
    throw new Error("Open-Meteo no devolvió horas de pronóstico dentro de la ventana pedida");
  }

  const pico = horasFuturas.reduce((max, h) => (h.apparentTemp > max.apparentTemp ? h : max));

  return {
    sensacionTermicaMax: pico.apparentTemp,
    temperaturaMax: pico.temp,
    humedadEnPico: pico.humidity,
    horaPico: new Date(pico.time).toISOString(),
    fuente: "open-meteo.com (modelos meteorológicos agregados, pronóstico)",
    consultadoEn: new Date().toISOString(),
  };
}

module.exports = { obtenerSensacionTermicaMaxima };
