/* =====================================================================
   BASE DE DATOS DEL EXPERIMENTO — Google Apps Script + Google Sheets
   Experimento factorial: Incentivo (entre grupos) x Dificultad (intrasujeto)

   Cómo instalar (detalle en README.md, paso 3):
     1. Abre la hoja «Incentivo_Razonamiento_datos» en Google Sheets.
     2. Extensiones > Apps Script. Borra el contenido y pega este archivo.
     3. Cambia CLAVE_RESULTADOS por una palabra que solo sepas tú.
     4. Ejecuta una vez la función «preparar» (autoriza los permisos).
     5. Implementar > Nueva implementación > Aplicación web
          - Ejecutar como: Yo
          - Quién tiene acceso: Cualquier usuario
        Copia la URL que termina en /exec y pégala en js/config.js (ENDPOINT).

   ¿Qué pasa si dos personas envían a la vez?
     Todas las escrituras (asignar condición y guardar respuestas) pasan por
     LockService: Google ejecuta una petición detrás de otra, nunca dos a la vez,
     así que no se pisan filas ni se descuadra la aleatorización. Además, cada
     participación lleva un identificador único: si la web reenvía la misma fila
     (por ejemplo, porque falló la conexión), el script la reconoce y no la duplica.
   ===================================================================== */

const CLAVE_RESULTADOS = "cambia-esta-clave";   // <-- ¡CÁMBIALA!
const HOJA_RESP = "Respuestas";
const HOJA_ASIG = "Asignaciones";
const CONDICIONES = ["incentivo", "control"];

/* ---------- GET ---------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.accion === "asignar") return json_(asignar_(p.cohorte || "", p.id || "", Number(p.bloque) || 4));
  if (p.accion === "confirmar") return json_({ existe: existeId_(p.id || "") });
  if (p.accion === "datos") {
    if (p.clave !== CLAVE_RESULTADOS) return json_({ error: "clave incorrecta" });
    return json_({ filas: leerFilas_(p.cohorte || "") });
  }
  return json_({ ok: true, info: "Servicio del experimento activo" });
}

/* ---------- POST: guardar una fila ---------- */
function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return json_({ error: "servidor ocupado, reintentar" });
  try {
    const cuerpo = JSON.parse(e.postData.contents);
    if (cuerpo.accion !== "guardar" || !cuerpo.fila || !cuerpo.fila.id) return json_({ error: "petición no válida" });
    const fila = cuerpo.fila;
    if (existeId_(fila.id)) return json_({ ok: true, duplicado: true });   // reenvío: no se duplica
    fila.recibido = new Date().toISOString();
    const hoja = hoja_(HOJA_RESP);
    let cab = hoja.getLastColumn() > 0 ? hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0] : [];
    if (!cab.length || cab[0] === "") { cab = COLUMNAS.slice(); hoja.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight("bold"); }
    const nuevas = Object.keys(fila).filter(k => cab.indexOf(k) === -1);
    if (nuevas.length) {
      hoja.getRange(1, cab.length + 1, 1, nuevas.length).setValues([nuevas]).setFontWeight("bold");
      cab = cab.concat(nuevas);
    }
    hoja.appendRow(cab.map(k => (fila[k] === undefined || fila[k] === null) ? "" : fila[k]));
    SpreadsheetApp.flush();
    return json_({ ok: true });
  } catch (err) {
    return json_({ error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Aleatorización por bloques permutados ----------
   Para cada cohorte se genera un bloque con el mismo número de «incentivo» y
   «control» (p. ej. I, I, C, C) y se baraja al azar. Cada participante recibe
   la siguiente condición del bloque; cuando se agota, se baraja uno nuevo.
   Así la asignación es aleatoria (nadie puede predecirla) y los grupos quedan
   equilibrados: tras cada bloque completo hay exactamente los mismos en cada uno. */
function asignar_(cohorte, id, tamano) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { error: "servidor ocupado" };
  try {
    tamano = Math.max(2, Math.round(tamano / 2) * 2);
    const props = PropertiesService.getScriptProperties();
    const clave = "bloque_" + cohorte;
    let pendiente = JSON.parse(props.getProperty(clave) || "[]");
    let nBloque = Number(props.getProperty(clave + "_n") || 0);
    if (!pendiente.length) {
      pendiente = [];
      for (let i = 0; i < tamano / 2; i++) pendiente.push(CONDICIONES[0], CONDICIONES[1]);
      for (let i = pendiente.length - 1; i > 0; i--) {              // Fisher-Yates
        const j = Math.floor(Math.random() * (i + 1));
        const t = pendiente[i]; pendiente[i] = pendiente[j]; pendiente[j] = t;
      }
      nBloque++;
    }
    const cond = pendiente.shift();
    props.setProperty(clave, JSON.stringify(pendiente));
    props.setProperty(clave + "_n", String(nBloque));
    const h = hoja_(HOJA_ASIG);
    if (h.getLastRow() === 0) h.appendRow(["fecha", "cohorte", "id", "condicion", "bloque", "quedan_en_bloque"]);
    h.appendRow([new Date(), cohorte, id, cond, nBloque, pendiente.length]);
    return { condicion: cond, bloque: nBloque };
  } finally {
    lock.releaseLock();
  }
}

function existeId_(id) {
  if (!id) return false;
  const h = hoja_(HOJA_RESP);
  if (h.getLastRow() < 2) return false;
  return !!h.getRange(2, 1, h.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
}

function leerFilas_(cohorte) {
  const h = hoja_(HOJA_RESP);
  if (h.getLastRow() < 2) return [];
  const v = h.getRange(1, 1, h.getLastRow(), h.getLastColumn()).getValues();
  const cab = v[0];
  return v.slice(1).map(r => { const o = {}; cab.forEach((k, i) => o[k] = r[i]); return o; })
          .filter(o => !cohorte || String(o.cohorte) === cohorte);
}

function hoja_(nombre) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(nombre) || ss.insertSheet(nombre);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* Reinicia la aleatorización de una cohorte (por ejemplo, después de las pruebas).
   Escribe la cohorte entre comillas y ejecuta la función desde el editor. */
function reiniciarAleatorizacion() {
  const cohorte = "MDTI-2026-G1";
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty("bloque_" + cohorte); props.deleteProperty("bloque_" + cohorte + "_n");
  SpreadsheetApp.getActiveSpreadsheet().toast("Aleatorización reiniciada para " + cohorte);
}

/* Columnas de la pestaña Respuestas (mismo orden que la plantilla) */
const COLUMNAS = [
  "id", "cohorte", "modo", "condicion", "asignacion", "bloque", "reclutador", "dispositivo",
  "n_en_dispositivo", "seg_desde_anterior", "fecha_inicio", "fecha_fin", "recibido", "duracion_s", "movil", "pantalla",
  "cambios_pestana", "avisos_rapidez", "orden_items", "practica_aciertos", "aciertos_facil", "n_facil", "tr_mediana_facil", "aciertos_dificil",
  "n_dificil", "tr_mediana_dificil", "aciertos_total", "n_items", "n_nose", "n_ninguna", "n_tiempo_agotado", "n_rapidas",
  "tr_mediana", "max_misma_opcion", "sospechoso", "motivo_sospecha", "umbral", "supera_umbral", "premio", "codigo_premio",
  "mot_esfuerzo", "mot_interes", "mot_importancia", "recuerda_premio", "sexo", "edad", "psicologia", "ya_participo",
  "condiciones", "motivacion", "F11_resp", "F11_ok", "F11_tr", "F11_pos", "F12_resp", "F12_ok",
  "F12_tr", "F12_pos", "F13_resp", "F13_ok", "F13_tr", "F13_pos", "F14_resp", "F14_ok",
  "F14_tr", "F14_pos", "F15_resp", "F15_ok", "F15_tr", "F15_pos", "F16_resp", "F16_ok",
  "F16_tr", "F16_pos", "F17_resp", "F17_ok", "F17_tr", "F17_pos", "F18_resp", "F18_ok",
  "F18_tr", "F18_pos", "F19_resp", "F19_ok", "F19_tr", "F19_pos", "F20_resp", "F20_ok",
  "F20_tr", "F20_pos", "D11_resp", "D11_ok", "D11_tr", "D11_pos", "D12_resp", "D12_ok",
  "D12_tr", "D12_pos", "D13_resp", "D13_ok", "D13_tr", "D13_pos", "D14_resp", "D14_ok",
  "D14_tr", "D14_pos", "D15_resp", "D15_ok", "D15_tr", "D15_pos", "D16_resp", "D16_ok",
  "D16_tr", "D16_pos", "D17_resp", "D17_ok", "D17_tr", "D17_pos", "D18_resp", "D18_ok",
  "D18_tr", "D18_pos", "D19_resp", "D19_ok", "D19_tr", "D19_pos", "D20_resp", "D20_ok",
  "D20_tr", "D20_pos"
];

/* Ejecutar UNA vez desde el editor para autorizar permisos. */
function preparar() {
  const r = hoja_(HOJA_RESP);
  if (r.getLastRow() === 0) {
    r.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS])
     .setFontWeight("bold").setFontColor("#FFFFFF").setBackground("#0047E8");
    r.setFrozenRows(1);
  }
  const a = hoja_(HOJA_ASIG);
  if (a.getLastRow() === 0) a.appendRow(["fecha", "cohorte", "id", "condicion", "bloque", "quedan_en_bloque"]);
  SpreadsheetApp.getActiveSpreadsheet().toast("Hoja preparada. Ahora: Implementar > Nueva implementación > Aplicación web.");
}
