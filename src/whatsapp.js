/**
 * Envío de mensajes por WhatsApp Cloud API (Meta).
 *
 * Si WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID no están configurados,
 * el sistema opera en "modo simulado": no llama a la API real, solo
 * registra qué se hubiera enviado. Esto permite probar todo el flujo
 * (clima real -> riesgo -> selección de usuarios) sin tener credenciales
 * todavía.
 */

const GRAPH_VERSION = "v20.0";

function credencialesConfiguradas() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Envía la plantilla de alerta de calor a un número de teléfono.
 * `telefono` debe estar en formato E.164 sin "+" (ej: 595981234567),
 * que es lo que exige la Graph API.
 */
async function enviarAlertaCalor({ telefono, ciudad, sensacionTermicaMax }) {
  const modoSimulado = !credencialesConfiguradas();
  const temperaturaRedondeada = Math.round(sensacionTermicaMax);

  if (modoSimulado) {
    console.log(
      `[WhatsApp SIMULADO] A +${telefono}: alerta de calor en ${ciudad}, sensación térmica ${temperaturaRedondeada}°C`
    );
    return { ok: true, modo: "simulado", detalle: "WHATSAPP_TOKEN/PHONE_NUMBER_ID no configurados" };
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "alerta_calor_asma";
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || "es";

  const body = {
    messaging_product: "whatsapp",
    to: telefono,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: ciudad },
            { type: "text", text: String(temperaturaRedondeada) },
          ],
        },
      ],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { ok: false, modo: "real", detalle: JSON.stringify(data) };
  }
  return { ok: true, modo: "real", detalle: JSON.stringify(data) };
}

module.exports = { enviarAlertaCalor, credencialesConfiguradas };
