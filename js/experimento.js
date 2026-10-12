/* =====================================================================
   LÓGICA DEL EXPERIMENTO (pestaña «Experimento»)
   Flujo: código de recogida -> consentimiento -> asignación aleatoria
          (bloques permutados en el servidor) -> instrucciones (+ incentivo)
          -> 2 ítems de práctica con corrección -> ítems de prueba
          -> preguntas finales -> codificación, control de calidad y envío
   ===================================================================== */
(function () {
  "use strict";
  const C = window.CONFIG;
  const $ = (s) => document.querySelector(s);
  const K = { disp: "fx_dispositivo", n: "fx_n_" + C.COHORTE, recl: "fx_reclutador", fin: "fx_ultima_fin",
              cola: "fx_pendientes", local: "fx_datos_local" };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } }
  };
  const azar = (n) => Math.random().toString(36).slice(2, 2 + n).toUpperCase();
  const barajar = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const ITEM = Object.fromEntries(C.ITEMS.map((it) => [it.id, it]));
  const PRUEBA = C.MODO === "piloto" ? C.ITEMS.filter((it) => it.dificultad !== "practica").map((it) => it.id) : C.ITEMS_EXPERIMENTO.slice();

  $("#asig").textContent = C.ASIGNATURA; $("#tema").textContent = C.TEMA; $("#pie-asig").textContent = C.ASIGNATURA;

  /* ---------- pestañas ---------- */
  function irPestana(destino) {
    document.querySelectorAll("#pestanas button").forEach((b) => {
      const on = b.dataset.destino === destino; b.classList.toggle("activa", on); b.setAttribute("aria-selected", on);
    });
    $("#vista-exp").classList.toggle("oculto", destino !== "vista-exp");
    $("#vista-res").classList.toggle("oculto", destino !== "vista-res");
    if (destino === "vista-res") document.dispatchEvent(new Event("abrir-resultados"));
  }
  document.querySelectorAll("#pestanas button").forEach((b) => b.addEventListener("click", () => irPestana(b.dataset.destino)));
  if (location.hash === "#resultados") irPestana("vista-res");
  window.addEventListener("hashchange", () => { if (location.hash === "#resultados") irPestana("vista-res"); });

  function mostrar(id) {
    document.querySelectorAll("#vista-exp > section").forEach((s) => s.classList.add("oculto"));
    $(id).classList.remove("oculto"); window.scrollTo(0, 0);
  }

  /* ---------- dispositivo y contador ---------- */
  const params = new URLSearchParams(location.search);
  if (params.get("reset") === "1") { store.del(K.n); store.del(K.fin); }
  let dispositivo = store.get(K.disp);
  if (!dispositivo) { dispositivo = "D-" + azar(6); store.set(K.disp, dispositivo); }
  const nHechas = () => Number(store.get(K.n) || 0);

  const D = {
    id: "P-" + Date.now().toString(36).toUpperCase().slice(-5) + "-" + azar(4),
    cohorte: C.COHORTE, modo: C.MODO, dispositivo,
    movil: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 1 : 0,
    pantalla: window.innerWidth + "x" + window.innerHeight,
    cambios_pestana: 0, avisos_rapidez: 0, respuestas: [], practica: []
  };

  let enviando = false;
  /* Reenviar respuestas pendientes de sesiones anteriores (por si falló la conexión) */
  enviarPendientes();
  window.addEventListener("online", enviarPendientes);
  setInterval(enviarPendientes, 20000);

  /* ================== 0. CÓDIGO DE RECOGIDA ================== */
  const inpR = $("#cod-reclutador");
  inpR.value = store.get(K.recl) || "";
  const actR = () => { $("#btn-reclutador").disabled = inpR.value.trim().length < 2; };
  inpR.addEventListener("input", actR); actR();
  $("#contador-disp").textContent = `Participaciones completadas en este dispositivo: ${nHechas()} de ${C.MAX_PARTICIPANTES_DISPOSITIVO}.`;
  if (nHechas() >= C.MAX_PARTICIPANTES_DISPOSITIVO) { $("#lim-n").textContent = nHechas(); mostrar("#p-limite"); }
  $("#btn-reclutador").addEventListener("click", () => {
    D.reclutador = inpR.value.trim().toUpperCase(); store.set(K.recl, D.reclutador);
    mostrar("#p-consentimiento");
  });
  document.querySelectorAll(".btn-nuevo").forEach((b) => b.addEventListener("click", () => { location.href = location.pathname; }));

  /* ================== 1. CONSENTIMIENTO Y ASIGNACIÓN ================== */
  $("#chk-edad").addEventListener("change", (e) => { $("#btn-acepto").disabled = !e.target.checked; });
  $("#btn-rechazo").addEventListener("click", () => mostrar("#p-rechazo"));
  $("#btn-acepto").addEventListener("click", async () => {
    $("#btn-acepto").disabled = true;
    D.fecha_inicio = new Date().toISOString(); D.t0 = Date.now();
    const ult = Number(store.get(K.fin) || 0);
    D.seg_desde_anterior = ult ? Math.round((Date.now() - ult) / 1000) : "";
    D.n_en_dispositivo = nHechas() + 1;
    $("#pestanas").classList.add("oculto");
    history.pushState({}, "", location.href);
    window.addEventListener("popstate", () => history.pushState({}, "", location.href));
    precargar();
    await asignar();
    prepararInstrucciones();
    mostrar("#p-instr");
  });

  async function asignar() {
    if (C.MODO === "piloto") { D.condicion = "piloto"; D.asignacion = "piloto"; return; }
    if (C.ENDPOINT) {
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch(`${C.ENDPOINT}?accion=asignar&cohorte=${encodeURIComponent(C.COHORTE)}&id=${D.id}&bloque=${C.TAMANO_BLOQUE}`, { signal: ctrl.signal });
        clearTimeout(t);
        const j = await r.json();
        if (j.condicion === "incentivo" || j.condicion === "control") { D.condicion = j.condicion; D.asignacion = "bloques"; D.bloque = j.bloque; return; }
      } catch (e) { }
    }
    D.condicion = Math.random() < 0.5 ? "incentivo" : "control";   // sin conexión: aleatoria simple
    D.asignacion = "local";
  }

  const textoIncentivo = () => C.INCENTIVO.MENSAJE.replace("{UMBRAL}", C.INCENTIVO.UMBRAL).replace("{N}", PRUEBA.length).replace("{PREMIO}", C.INCENTIVO.PREMIO);
  function prepararInstrucciones() {
    if (D.condicion !== "incentivo") return;
    ["#caja-incentivo", "#caja-incentivo2"].forEach((s) => { $(s).innerHTML = textoIncentivo(); $(s).classList.remove("oculto"); });
    $("#it-recordatorio").textContent = `Premio: ${C.INCENTIVO.UMBRAL} o más aciertos = ${C.INCENTIVO.PREMIO}`;
  }

  /* precarga de todas las imágenes: así el tiempo de carga no se mezcla con el de respuesta */
  const partes = ["a", "b", "c", "op1", "op2", "op3", "op4", "op5", "op6", "op7", "op8"];
  const ruta = (id, p) => `items/${id}/${p}.png`;
  function precargar() { C.PRACTICA.concat(PRUEBA).forEach((id) => partes.forEach((p) => { const im = new Image(); im.src = ruta(id, p); })); }

  /* ================== 2. PRÁCTICA Y TAREA ================== */
  document.addEventListener("visibilitychange", () => { if (document.hidden && D.enTarea) D.cambios_pestana++; });
  window.addEventListener("beforeunload", (e) => { if (D.fecha_inicio && !D.enviado) { e.preventDefault(); e.returnValue = ""; } });

  let cola = [], fase = "", actual = null, tPres = 0, rapidasSeguidas = 0, timer = null, bloqueado = true;

  $("#btn-practica").addEventListener("click", () => { fase = "practica"; cola = C.PRACTICA.slice(); siguiente(); });
  $("#btn-tarea").addEventListener("click", () => {
    fase = "tarea"; D.enTarea = true;
    // Orden: bloques de 2 (un fácil + un difícil, en orden aleatorio). La dificultad no se confunde con la posición.
    const F = barajar(PRUEBA.filter((id) => ITEM[id].dificultad === "facil"));
    const Df = barajar(PRUEBA.filter((id) => ITEM[id].dificultad === "dificil"));
    cola = [];
    for (let i = 0; i < Math.max(F.length, Df.length); i++) cola.push(...barajar([F[i], Df[i]].filter(Boolean)));
    D.orden = cola.join("|");
    siguiente();
  });

  async function siguiente() {
    clearTimeout(timer);
    const lista = fase === "practica" ? D.practica : D.respuestas;
    const total = fase === "practica" ? C.PRACTICA.length : PRUEBA.length;
    if (!cola.length) {
      if (fase === "practica") { $("#tr-n").textContent = PRUEBA.length; mostrar("#p-transicion"); }
      else { D.enTarea = false; construirFinales(); mostrar("#p-finales"); }
      return;
    }
    actual = cola.shift();
    mostrar("#p-item");
    $("#feedback").classList.add("oculto");
    $("#it-recordatorio").classList.toggle("oculto", !(fase === "tarea" && D.condicion === "incentivo"));
    $("#it-contador").textContent = fase === "practica" ? `Práctica ${lista.length + 1} de ${total}` : `Figura ${lista.length + 1} de ${total}`;
    $("#it-barra").style.width = (100 * lista.length / total) + "%";
    ["a", "b", "c"].forEach((p) => { $("#img-" + p).src = ruta(actual, p); });
    const op = $("#opciones"); op.innerHTML = ""; op.classList.remove("bloqueado");
    $(".opciones-texto").classList.remove("bloqueado");
    for (let i = 1; i <= 8; i++) {
      const b = document.createElement("button"); b.type = "button"; b.dataset.op = i;
      b.innerHTML = `<span>${i}</span><img src="${ruta(actual, "op" + i)}" alt="Opción ${i}">`;
      b.addEventListener("click", () => responder(i, b));
      op.appendChild(b);
    }
    await esperar(150);
    tPres = performance.now(); bloqueado = false;
    if (C.TIEMPO_MAX_ITEM_S > 0 && fase === "tarea") timer = setTimeout(() => responder(0, null), C.TIEMPO_MAX_ITEM_S * 1000);
  }
  document.querySelectorAll(".opciones-texto button").forEach((b) => b.addEventListener("click", () => responder(Number(b.dataset.op), b)));

  async function responder(op, boton) {
    if (bloqueado) return; bloqueado = true; clearTimeout(timer);
    const it = ITEM[actual], tr = Math.round(performance.now() - tPres), ok = op === it.correcta ? 1 : 0;
    if (boton) boton.classList.add("elegida");
    $("#opciones").classList.add("bloqueado"); $(".opciones-texto").classList.add("bloqueado");
    if (fase === "practica") {
      D.practica.push({ id: actual, resp: op, ok, tr });
      const fb = $("#feedback");
      if (it.correcta <= 8) $(`#opciones button[data-op="${it.correcta}"]`).classList.add("correcta");
      fb.className = "feedback " + (ok ? "ok" : "mal");
      fb.innerHTML = (ok ? "<b>¡Correcto!</b> " : `<b>No es correcta.</b> La respuesta era la opción <b>${it.correcta}</b> (marcada en verde). `) +
        `La regla de este ejemplo: <i>${it.reglas.map((r) => C.REGLAS[r].toLowerCase()).join(", ")}</i>.` +
        `<div class="botones"><button id="btn-sig-prac">Siguiente</button></div>`;
      $("#btn-sig-prac").addEventListener("click", siguiente);
      return;
    }
    D.respuestas.push({ id: actual, dif: it.dificultad, resp: op, ok, tr, pos: D.respuestas.length + 1 });
    // aviso de rapidez
    if (op !== 0 && tr < C.RAPIDA_MS) rapidasSeguidas++; else rapidasSeguidas = 0;
    await esperar(250);
    if (rapidasSeguidas >= C.AVISO_TRAS_RAPIDAS) {
      rapidasSeguidas = 0; D.avisos_rapidez++;
      $("#modal-rapidez").classList.remove("oculto");
      return;   // el botón del aviso continúa
    }
    siguiente();
  }
  $("#btn-modal").addEventListener("click", () => { $("#modal-rapidez").classList.add("oculto"); siguiente(); });

  /* ================== 3. PREGUNTAS FINALES ================== */
  function htmlOpciones(nombre, valores, fila) {
    return `<div class="opciones ${fila ? "fila" : ""}">` + valores.map((v) =>
      `<label class="opcion"><input type="radio" name="${nombre}" value="${String(v).replace(/"/g, "&quot;")}"><span>${v}</span></label>`).join("") + "</div>";
  }
  function construirFinales() {
    $("#form-finales").innerHTML = C.PREGUNTAS_FINALES.map((p, i) => {
      let campo = "";
      if (p.tipo === "numero") campo = `<input type="number" name="${p.id}" inputmode="numeric" min="${p.min}" max="${p.max}" step="1">`;
      else if (p.tipo === "opcion") campo = htmlOpciones(p.id, p.opciones, true);
      else if (p.tipo === "sino") campo = htmlOpciones(p.id, ["Sí", "No"], true);
      else if (p.tipo === "escala") {
        const v = []; for (let k = p.min; k <= p.max; k++) v.push(k);
        campo = htmlOpciones(p.id, v, true) + `<div class="escala-etq"><span>${p.min} = ${p.etiquetas[0]}</span><span>${p.max} = ${p.etiquetas[1]}</span></div>`;
      }
      const aviso = p.tipo === "numero" ? `Escribe un número entre ${p.min} y ${p.max}.` : "Esta pregunta es obligatoria.";
      return `<div class="pregunta" data-id="${p.id}"><div class="enunciado"><span class="num">${i + 1}.</span> ${p.texto}</div>${campo}<div class="aviso">${aviso}</div></div>`;
    }).join("");
  }
  function leerFinales() {
    const f = $("#form-finales"), res = {}; let primero = null;
    C.PREGUNTAS_FINALES.forEach((p) => {
      const bloque = f.querySelector(`[data-id="${p.id}"]`); let v = null, ok = true;
      if (p.tipo === "numero") { const n = parseInt(f.querySelector(`[name="${p.id}"]`).value, 10); if (isNaN(n) || n < p.min || n > p.max) ok = false; else v = n; }
      else { const r = f.querySelector(`[name="${p.id}"]:checked`); if (!r) ok = false; else v = p.tipo === "escala" ? Number(r.value) : r.value; }
      bloque.classList.toggle("falta", !ok); if (!ok && !primero) primero = bloque; res[p.id] = v;
    });
    if (primero) { primero.scrollIntoView({ behavior: "smooth", block: "center" }); return null; }
    return res;
  }

  /* ================== 4. CODIFICACIÓN Y CONTROL DE CALIDAD ================== */
  const med = (x) => { if (!x.length) return ""; const s = [...x].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  function codificar() {
    const R = D.respuestas, S = C.SOSPECHA;
    const fila = {
      id: D.id, cohorte: D.cohorte, modo: D.modo, condicion: D.condicion, asignacion: D.asignacion, bloque: D.bloque ?? "",
      reclutador: D.reclutador, dispositivo: D.dispositivo, n_en_dispositivo: D.n_en_dispositivo, seg_desde_anterior: D.seg_desde_anterior,
      fecha_inicio: D.fecha_inicio, fecha_fin: new Date().toISOString(), duracion_s: Math.round((Date.now() - D.t0) / 1000),
      movil: D.movil, pantalla: D.pantalla, cambios_pestana: D.cambios_pestana, avisos_rapidez: D.avisos_rapidez,
      orden_items: D.orden, practica_aciertos: D.practica.reduce((a, r) => a + r.ok, 0)
    };
    ["facil", "dificil"].forEach((dif) => {
      const r = R.filter((x) => x.dif === dif);
      fila["aciertos_" + dif] = r.reduce((a, x) => a + x.ok, 0);
      fila["n_" + dif] = r.length;
      fila["tr_mediana_" + dif] = med(r.map((x) => x.tr));
    });
    fila.aciertos_total = fila.aciertos_facil + fila.aciertos_dificil;
    fila.n_items = R.length;
    fila.n_nose = R.filter((x) => x.resp === 10).length;
    fila.n_ninguna = R.filter((x) => x.resp === 9).length;
    fila.n_tiempo_agotado = R.filter((x) => x.resp === 0).length;
    fila.n_rapidas = R.filter((x) => x.resp !== 0 && x.tr < C.RAPIDA_MS).length;
    fila.tr_mediana = med(R.map((x) => x.tr));
    const cuenta = {}; R.forEach((x) => { cuenta[x.resp] = (cuenta[x.resp] || 0) + 1; });
    fila.max_misma_opcion = Math.max(0, ...Object.values(cuenta));
    const motivos = [];
    if (fila.n_rapidas >= S.MIN_RAPIDAS) motivos.push(`${fila.n_rapidas} respuestas muy rápidas`);
    if (fila.tr_mediana !== "" && fila.tr_mediana < S.MEDIANA_MIN_MS) motivos.push("mediana de tiempo muy baja");
    if (fila.max_misma_opcion >= S.MISMA_OPCION) motivos.push("misma opción repetida");
    if (fila.duracion_s < S.DURACION_MIN_S) motivos.push("duración muy corta");
    if (fila.cambios_pestana >= S.CAMBIOS_PESTANA) motivos.push("salidas de la pestaña");
    fila.sospechoso = motivos.length ? 1 : 0;
    fila.motivo_sospecha = motivos.join("; ");
    fila.umbral = C.INCENTIVO.UMBRAL;
    fila.supera_umbral = fila.aciertos_total >= C.INCENTIVO.UMBRAL ? 1 : 0;
    fila.premio = D.condicion === "incentivo" && fila.supera_umbral ? 1 : 0;
    fila.codigo_premio = fila.premio ? "CAFE-" + D.id.slice(-4) : "";
    Object.assign(fila, D.finales);
    fila.motivacion = ["mot_esfuerzo", "mot_interes", "mot_importancia"].map((k) => Number(D.finales[k])).reduce((a, b) => a + b, 0) / 3;
    // ítem a ítem (columnas <id>_resp, <id>_ok, <id>_tr, <id>_pos)
    R.forEach((x) => { fila[x.id + "_resp"] = x.resp; fila[x.id + "_ok"] = x.ok; fila[x.id + "_tr"] = x.tr; fila[x.id + "_pos"] = x.pos; });
    return fila;
  }

  /* ================== 5. FIN Y ENVÍO (con cola de reintentos) ================== */
  $("#btn-enviar").addEventListener("click", () => {
    const r = leerFinales(); if (!r) return;
    D.finales = r; $("#btn-enviar").disabled = true;
    const fila = codificar();
    D.enviado = true;
    store.set(K.n, nHechas() + 1); store.set(K.fin, Date.now());
    try { const prev = JSON.parse(store.get(K.local) || "[]"); prev.push(fila); store.set(K.local, JSON.stringify(prev)); } catch (e) { }
    pantallaFin(fila);
    if (C.ENDPOINT) { encolar(fila); enviarPendientes(); }
    else $("#estado-envio").textContent = "modo de prueba (sin hoja de datos): guardado solo en este navegador.";
  });

  function pantallaFin(f) {
    mostrar("#p-fin");
    $("#codigo").textContent = f.id;
    $("#fin-resultado").innerHTML = `Has acertado <b>${f.aciertos_total}</b> de ${f.n_items} figuras.`;
    const pr = $("#fin-premio");
    if (D.condicion === "incentivo") {
      pr.classList.remove("oculto");
      if (f.premio) { pr.classList.remove("no"); pr.innerHTML = `<h2>¡Has conseguido ${C.INCENTIVO.PREMIO}!</h2><p>Enseña esta pantalla a la persona que te ha pasado el dispositivo.</p><div class="cod">${f.codigo_premio}</div>`; }
      else { pr.classList.add("no"); pr.innerHTML = `<h2>Esta vez no has llegado al premio</h2><p>Hacían falta ${C.INCENTIVO.UMBRAL} aciertos. ¡Gracias igualmente por tu esfuerzo!</p>`; }
    }
    if (nHechas() >= C.MAX_PARTICIPANTES_DISPOSITIVO) $("#fin-botones").innerHTML = `<p class="nota">Este dispositivo ha alcanzado el máximo de ${C.MAX_PARTICIPANTES_DISPOSITIVO} participaciones.</p>`;
  }

  function encolar(fila) {
    try { const q = JSON.parse(store.get(K.cola) || "[]"); q.push(fila); store.set(K.cola, JSON.stringify(q)); } catch (e) { }
  }
  async function enviarPendientes() {
    if (!C.ENDPOINT || enviando) return;
    let q; try { q = JSON.parse(store.get(K.cola) || "[]"); } catch (e) { q = []; }
    if (!q.length) return;
    enviando = true;
    for (const fila of q) {
      try {
        await fetch(C.ENDPOINT, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ accion: "guardar", fila }) });
        await esperar(1500);
        const r = await fetch(`${C.ENDPOINT}?accion=confirmar&id=${encodeURIComponent(fila.id)}`);
        const j = await r.json();
        if (j.existe) {
          const q2 = JSON.parse(store.get(K.cola) || "[]").filter((x) => x.id !== fila.id);
          store.set(K.cola, JSON.stringify(q2));
          if (fila.id === D.id) $("#estado-envio").textContent = "respuestas guardadas correctamente.";
        } else if (fila.id === D.id) $("#estado-envio").textContent = "aún no confirmado; se reintentará automáticamente.";
      } catch (e) {
        if (fila.id === D.id) $("#estado-envio").textContent = "sin conexión: las respuestas se enviarán solas al recuperar la conexión (no cierres el navegador).";
      }
    }
    enviando = false;
  }
})();
