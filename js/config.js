/* =====================================================================
   CONFIGURACIÓN DEL EXPERIMENTO
   Diseño factorial mixto 2 x 2:
     VI 1 · Incentivo (ENTRE grupos): «incentivo» (café si se supera el
            umbral) frente a «control» (sin mención de premio).
     VI 2 · Dificultad (INTRAsujeto): ítems fáciles (1 regla) frente a
            difíciles (3 reglas: rotación principal + sustracción + 1).
   Ítems: analogías figurativas generadas con IMak (Blum y Holling, 2018).

   Normalmente solo hay que tocar:
     1. ENDPOINT  -> URL /exec de Google Apps Script.
     2. COHORTE   -> etiqueta del grupo de clase.
     3. MODO      -> "piloto" (todos los ítems, sin incentivo) o "experimento".
     4. ITEMS_EXPERIMENTO y UMBRAL (tras el piloto).
   ===================================================================== */

window.CONFIG = {

  /* ---------- 1) Conexión con la hoja de Google (Apps Script) ---------- */
  ENDPOINT: "https://script.google.com/macros/s/AKfycbzNx32ZU2k_Ae1cjxeswmjCfS9SIsvMPjShDh6zrMPrhxSl23YGvZnn6BtTn3N45-N78g/exec",                       // pega aquí la URL que termina en /exec
  COHORTE: "MDTI-2026-G1",
  ASIGNATURA: "Métodos, Diseño y Técnicas de Investigación en Psicología",
  TEMA: "Tema 6 · Diseños factoriales",

  /* ---------- 2) Modo de funcionamiento ----------
     "piloto":      todos los ítems de ITEMS (20), sin incentivo para nadie.
                    Sirve para calcular la dificultad de cada ítem, elegir
                    los 6 + 6 definitivos y fijar el umbral.
     "experimento": solo ITEMS_EXPERIMENTO, con asignación aleatoria a
                    incentivo o control.                                     */
  MODO: "experimento",

  /* Versión de la presentación de los ítems (se guarda en cada fila para poder comparar):
     "lineal"     = A → B como C → ?   (hasta el 20/10/2026)
     "matriz 2x2" = A B / C ?          (como en IMak; permite usar también la relación A → C) */
  PRESENTACION: "matriz 2x2",

  /* ---------- 3) Incentivo ---------- */
  INCENTIVO: {
    UMBRAL: 10,                       // aciertos necesarios (de los ítems de prueba)
    PREMIO: "un café",
    // Texto que SOLO ve el grupo con incentivo (en las instrucciones y como recordatorio)
    MENSAJE: "Si aciertas <b>{UMBRAL} o más</b> de las {N} figuras, <b>ganas {PREMIO}</b>. Al final verás si lo has conseguido: enseña esa pantalla a la persona que te ha pasado el móvil."
  },
  /* Aleatorización: bloques permutados de este tamaño (debe ser par) */
  TAMANO_BLOQUE: 4,

  /* ---------- 4) Control de calidad de los datos ---------- */
  MAX_PARTICIPANTES_DISPOSITIVO: 6,   // participaciones completas por dispositivo
  RAPIDA_MS: 2500,                    // una respuesta más rápida que esto se considera «muy rápida»
  AVISO_TRAS_RAPIDAS: 2,              // nº de respuestas muy rápidas seguidas que dispara el aviso
  /* Control de calidad (js/calidad.js). Se separan dos problemas:
     AZAR: respuestas sin mirar -> datos no válidos.
     INTERRUPCIÓN: la tarea quedó oculta o parada -> datos dudosos, revisar. */
  SOSPECHA: {
    // --- respuestas al azar ---
    MIN_RAPIDAS: 4,                   //   4 o más respuestas en menos de RAPIDA_MS
    MEDIANA_MIN_MS: 4000,             //   mediana de tiempos por ítem < 4 s
    MISMA_OPCION: 8,                  //   la misma opción 8 o más veces
    NOSE_RAPIDOS: 5,                  //   5 o más «No sé» en menos de 5 s
    DURACION_MIN_S: 120,              //   participación completa en menos de 2 min
    // --- interrupciones ---
    CAMBIOS_PESTANA: 2,               //   2 o más salidas de la pestaña durante los ítems
    OCULTO_MAX_S: 60,                 //   60 s o más con la tarea oculta (desde la versión 2x2)
    ITEM_LARGO_S: 150,                //   algún ítem de más de 150 s (el límite es 120 s visibles)
    DURACION_MAX_MIN: 30,             //   más de 30 min en total
    // --- indicador añadido tras el piloto (no excluye salvo que se active el filtro) ---
    FACILES_MAX_AZAR: 1               //   ≤ 1 acierto en los 6 ítems fáciles
  },
  TIEMPO_MAX_ITEM_S: 120,             // si se agota, se pasa al siguiente (cuenta como fallo)

  /* ---------- 5) Banco de ítems (matriz Q) ----------
     reglas: punto = movimiento del punto · trapecio = rotación del trapecio ·
             reflejo · rot_principal = rotación de la figura principal ·
             sustraccion = sustracción de líneas
     correcta: posición 1-8 de la opción correcta (9 = «Ninguna es correcta») */
  REGLAS: {
    rot_principal: "Rotación de la figura principal",
    sustraccion: "Sustracción de líneas",
    trapecio: "Rotación del trapecio",
    punto: "Movimiento del punto",
    reflejo: "Reflejo"
  },
  ITEMS: [
    { id: "P3", dificultad: "practica", reglas: ["punto"], correcta: 7 },
    { id: "P4", dificultad: "practica", reglas: ["punto"], correcta: 3 },
    { id: "F11", dificultad: "facil", reglas: ["punto"], correcta: 6 },
    { id: "F12", dificultad: "facil", reglas: ["punto"], correcta: 6 },
    { id: "F13", dificultad: "facil", reglas: ["punto"], correcta: 4 },
    { id: "F14", dificultad: "facil", reglas: ["trapecio"], correcta: 2 },
    { id: "F15", dificultad: "facil", reglas: ["trapecio"], correcta: 8 },
    { id: "F16", dificultad: "facil", reglas: ["trapecio"], correcta: 5 },
    { id: "F17", dificultad: "facil", reglas: ["reflejo"], correcta: 6 },
    { id: "F18", dificultad: "facil", reglas: ["reflejo"], correcta: 3 },
    { id: "F19", dificultad: "facil", reglas: ["trapecio"], correcta: 7 },
    { id: "F20", dificultad: "facil", reglas: ["trapecio"], correcta: 7 },
    { id: "D11", dificultad: "dificil", reglas: ["rot_principal", "sustraccion", "trapecio"], correcta: 2 },
    { id: "D12", dificultad: "dificil", reglas: ["rot_principal", "sustraccion", "trapecio"], correcta: 6 },
    { id: "D13", dificultad: "dificil", reglas: ["rot_principal", "sustraccion", "trapecio"], correcta: 3 },
    { id: "D14", dificultad: "dificil", reglas: ["rot_principal", "sustraccion", "punto"], correcta: 3 },
    { id: "D15", dificultad: "dificil", reglas: ["rot_principal", "sustraccion", "punto"], correcta: 4 },
    { id: "D16", dificultad: "dificil", reglas: ["rot_principal", "sustraccion", "punto"], correcta: 3 },
    { id: "D17", dificultad: "dificil", reglas: ["rot_principal", "sustraccion", "punto"], correcta: 7 },
    { id: "D18", dificultad: "dificil", reglas: ["rot_principal", "sustraccion", "punto"], correcta: 1 },
    { id: "D19", dificultad: "dificil", reglas: ["rot_principal", "sustraccion", "trapecio"], correcta: 5 },
    { id: "D20", dificultad: "dificil", reglas: ["rot_principal", "sustraccion", "trapecio"], correcta: 4 },
  ],
  PRACTICA: ["P3", "P4"],
  ITEMS_EXPERIMENTO: ["F11", "F12", "F14", "F15", "F17", "F18",
                      "D11", "D12", "D19", "D14", "D15", "D16"],

  /* ---------- 6) Preguntas finales ---------- */
  PREGUNTAS_FINALES: [
    { id: "mot_esfuerzo", tipo: "escala", min: 1, max: 5, etiquetas: ["Ninguno", "Muchísimo"],
      texto: "¿Cuánto esfuerzo has puesto en resolver las figuras?" },
    { id: "mot_interes", tipo: "escala", min: 1, max: 5, etiquetas: ["Nada", "Muchísimo"],
      texto: "¿Cuánto te ha interesado la tarea?" },
    { id: "mot_importancia", tipo: "escala", min: 1, max: 5, etiquetas: ["Nada", "Muchísimo"],
      texto: "¿Hasta qué punto te importaba hacerlo bien?" },
    { id: "recuerda_premio", tipo: "sino",
      texto: "¿Se te ofreció algún premio según tu resultado?" },
    { id: "sexo", tipo: "opcion", opciones: ["Mujer", "Hombre", "Otro", "Prefiero no decirlo"], texto: "Sexo" },
    { id: "edad", tipo: "numero", min: 18, max: 99, texto: "Edad (en años)" },
    { id: "psicologia", tipo: "sino", texto: "¿Estudias o has estudiado Psicología?" },
    { id: "ya_participo", tipo: "sino", texto: "¿Habías hecho ya esta tarea antes (hoy u otro día)?" },
    { id: "condiciones", tipo: "sino", texto: "¿Has podido hacer la tarea con atención y sin interrupciones?" }
  ]
};
