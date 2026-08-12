# AlertaPy — piloto real (San Lorenzo)

Sitio de AlertaPy + el backend del piloto real: registro de vecinos de San
Lorenzo, consulta de clima real (Open-Meteo) dos veces al día, y envío de
alertas de calor por WhatsApp a las personas asmáticas registradas cuando
la sensación térmica prevista supera un umbral de riesgo.

## Qué es real y qué no, hoy

- **Clima: real.** Se consulta [Open-Meteo](https://open-meteo.com) (API
  pública, gratuita, sin API key) para San Lorenzo. DINAC no publica una
  API pública propia, así que este es el reemplazo real más directo.
- **Registro de usuarios: real.** Base de datos SQLite local
  (`data/alertapy.db`), se llena desde `public/registro.html`.
- **Motor de riesgo: real**, con umbrales configurables en `.env`
  (ver más abajo — son un punto de partida, no una recomendación médica).
- **Envío por WhatsApp: listo para ser real, pendiente de credenciales.**
  Sin `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` configurados, el sistema
  corre en **modo simulado**: hace todo el cálculo real y deja constancia
  en la base de datos y la consola de a quién le hubiera mandado el
  mensaje, pero no llama a la API de Meta.

## 1. Instalación

```bash
npm install
cp .env.example .env
```

Editá `.env` si querés cambiar la ciudad piloto, los umbrales de riesgo,
o el puerto.

## 2. Correrlo en modo simulado (sin WhatsApp real)

```bash
npm start
```

- El sitio queda en `http://localhost:3000` (landing, dashboard demo y
  `/registro.html`).
- Los chequeos de clima corren automáticamente a las 07:00 y 15:00
  (hora de Paraguay). Para probarlo ya mismo sin esperar:

```bash
npm run check-now
```

Esto consulta el clima real de San Lorenzo, calcula el riesgo, y si hay
usuarios asmáticos registrados con riesgo amarillo/rojo, "envía" (en modo
simulado) las alertas y lo deja registrado en `data/alertapy.db`
(tablas `chequeos` y `envios`).

También podés disparar un chequeo por HTTP (útil si lo tenés desplegado):

```bash
curl -X POST http://localhost:3000/api/admin/chequear-ahora \
  -H "x-admin-key: TU_ADMIN_KEY"
```

Y ver el estado general:

```bash
curl http://localhost:3000/api/estado
```

## 3. Activar el envío real por WhatsApp (Meta Cloud API)

1. Entrá a [developers.facebook.com/apps](https://developers.facebook.com/apps)
   y creá una app de tipo **Business**.
2. Agregá el producto **WhatsApp** a la app.
3. En el panel de WhatsApp → **API Setup** vas a ver:
   - Un **número de prueba** (test number) ya activo, con su
     **Phone number ID** (copialo a `WHATSAPP_PHONE_NUMBER_ID`).
   - Un **token de acceso temporal** (24hs, para probar ya) — copialo a
     `WHATSAPP_TOKEN`. Para algo que dure más, creá un **System User**
     en Meta Business Suite y generale un token permanente con permiso
     `whatsapp_business_messaging`.
4. En la misma pantalla, agregá tu propio celular como **destinatario de
   prueba** (podés agregar hasta 5 sin verificar el negocio). Así podés
   recibir mensajes reales hoy mismo mientras se tramita la verificación.
5. Creá una **plantilla de mensaje** (WhatsApp Manager → Message
   Templates) — es obligatorio: WhatsApp no deja que un negocio le
   escriba primero a alguien fuera de una plantilla aprobada. Ejemplo,
   categoría **Utility**, nombre `alerta_calor_asma`, en español:

   > AlertaPy: mañana la sensación térmica en {{1}} llega a {{2}}°C. Si
   > sos asmático o tenés a alguien vulnerable en casa, evitá salir entre
   > las horas de más calor y mantené la medicación a mano.

   La aprobación suele tardar minutos, a veces hasta un par de días.
6. Completá `.env`:

   ```
   WHATSAPP_TOKEN=el_token_que_copiaste
   WHATSAPP_PHONE_NUMBER_ID=el_id_que_copiaste
   WHATSAPP_TEMPLATE_NAME=alerta_calor_asma
   WHATSAPP_TEMPLATE_LANG=es
   ```

7. Reiniciá el servidor. El log al arrancar te confirma el modo:
   `Modo WhatsApp: REAL (Meta Cloud API)`.

Para pasar del número de prueba a un número propio verificado (para
abrirlo al público del barrio, no solo a los 5 números de prueba), Meta
pide verificar el negocio — es un trámite aparte, no bloquea nada de lo
construido acá.

## 4. Umbrales de riesgo

En `.env`:

```
RISK_THRESHOLD_AMARILLO=34   # sensación térmica °C
RISK_THRESHOLD_ROJO=40
```

Son un punto de partida razonable, no una recomendación médica. Antes de
escalar el piloto más allá de un grupo chico, valdría la pena revisarlos
con alguien de salud pública o neumología.

## 5. Desplegarlo

Esto necesita un proceso corriendo permanentemente (no es un sitio
estático): server.js sirve el sitio y expone la API, y `node-cron` corre
los chequeos programados dentro del mismo proceso. Cualquier hosting que
soporte una app Node de larga duración sirve: Render, Railway, Fly.io, un
VPS chico, etc.

- Variables de entorno: cargá las mismas de `.env` en el panel del
  hosting elegido.
- `data/alertapy.db` es un archivo SQLite local — si el hosting usa
  discos efímeros (algunos planes free de Render, por ejemplo), la base
  se resetea en cada deploy. Para el piloto con pocos usuarios puede
  alcanzar, pero para producción conviene un disco persistente o migrar
  a una base gestionada (Postgres) más adelante.
- Nunca subas `.env` (con tokens reales) a git — ya está en
  `.gitignore`.

## Estructura

```
server.js              Express: sirve el sitio + API de registro/estado/admin
src/db.js              SQLite (usuarios, chequeos, envíos)
src/weather.js         Cliente real de Open-Meteo
src/risk.js            Clasificación de riesgo por umbrales
src/whatsapp.js        Envío real (Meta Cloud API) o simulado
src/scheduler.js       Job programado + lógica del chequeo completo
public/index.html      Landing de AlertaPy
public/registro.html   Alta real de usuarios del piloto
public/dashboard.html  Demo de dashboard municipal (datos simulados, para venta a municipios)
```

## Qué falta para que esto sea el piloto completo descripto en el roadmap

- [x] Registro de usuarios (nombre, teléfono, barrio, asma)
- [x] Consulta de clima real dos veces al día
- [x] Motor de riesgo por sensación térmica
- [x] Envío por WhatsApp (real si hay credenciales, simulado si no)
- [ ] Credenciales reales de Meta cargadas (paso manual, ver sección 3)
- [ ] Verificación del negocio en Meta para pasar del número de prueba a
      uno propio abierto al público
- [ ] Opt-out real (hoy no hay endpoint para que un usuario se dé de baja
      solo; hay que sacarlo a mano de la base o agregar un comando de
      WhatsApp entrante — no incluido en este primer corte)
- [ ] Revisión de los umbrales de riesgo con criterio médico/de salud
      pública antes de escalar a más gente
