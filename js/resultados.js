/* =====================================================================
   PESTAÑA «RESULTADOS» (lo que proyecta el profesor)
   Diseño mixto 2 x 2: Incentivo (entre) x Dificultad (intra).
   Descriptivos, gráfico de interacción, ANOVA mixto (SC tipo III, como
   JASP), efectos simples, comprobación de la manipulación, umbral,
   tiempos de respuesta, análisis de ítems con MATRIZ Q, calidad de los
   datos (sospechosos y códigos de recogida), modo piloto y texto APA.
   ===================================================================== */
(function () {
  "use strict";
  const C = window.CONFIG, E = window.EST;
  const $ = (s) => document.querySelector(s);
  const COL = { incentivo: "#FF9606", control: "#0047E8" };
  const GR = ["incentivo", "control"], NOM_GR = { incentivo: "Incentivo", control: "Control" };
  const DIF = ["facil", "dificil"], NOM_DIF = { facil: "Fácil (1 regla)", dificil: "Difícil (3 reglas)" };
  const ITEM = Object.fromEntries(C.ITEMS.map((it) => [it.id, it]));
  const REGLAS = Object.keys(C.REGLAS);
  let FILAS = [], timer = null, cargado = false;

  $("#cohorte").value = C.COHORTE;
  try { $("#clave").value = sessionStorage.getItem("clave_res") || ""; } catch (e) { }

  const fmt = (x, d = 2) => (x === null || x === undefined || !isFinite(x)) ? "–" : Number(x).toFixed(d);
  const fmtP = (p) => !isFinite(p) ? "–" : p < 0.001 ? "< .001" : fmt(p, 3);
  const apaD = (x, d = 3) => Number(x).toFixed(d).replace(/^(-?)0\./, "$1.");
  const apaP = (p) => p < 0.001 ? "< .001" : "= " + apaD(p, 3);
  const num = (v) => (v === "" || v === null || v === undefined) ? NaN : Number(String(v).replace(",", "."));
  const estado = (t) => { $("#estado").textContent = t; };
  const sig = (p) => p < .05 ? '<span class="sig">significativo</span>' : '<span class="nosig">no significativo</span>';
  const pct = (x) => isFinite(x) ? Math.round(100 * x) + " %" : "–";

  /* ---------------- fuentes de datos ---------------- */
  async function cargarServidor() {
    if (!C.ENDPOINT) { estado("No hay ENDPOINT en js/config.js: usa «Datos simulados» o «Datos de este navegador»."); return; }
    const clave = $("#clave").value.trim();
    try { sessionStorage.setItem("clave_res", clave); } catch (e) { }
    estado("Cargando…");
    try {
      const r = await fetch(`${C.ENDPOINT}?accion=datos&clave=${encodeURIComponent(clave)}&cohorte=${encodeURIComponent($("#cohorte").value.trim())}`);
      const j = await r.json();
      if (j.error) { estado("Error: " + j.error); return; }
      FILAS = j.filas; estado(`Datos de la hoja · ${FILAS.length} filas · ${new Date().toLocaleTimeString()}`); pintar();
    } catch (e) { estado("No se pudo conectar con la hoja de datos."); }
  }
  function cargarLocal() {
    try { FILAS = JSON.parse(localStorage.getItem("fx_datos_local") || "[]"); } catch (e) { FILAS = []; }
    estado(`${FILAS.length} participaciones guardadas en este navegador (modo prueba).`); pintar();
  }

  /* Datos ficticios: el incentivo mejora algo más en los difíciles (interacción pequeña) */
  function simular() {
    const filas = [], piloto = C.MODO === "piloto";
    const items = piloto ? C.ITEMS.filter((i) => i.dificultad !== "practica").map((i) => i.id) : C.ITEMS_EXPERIMENTO;
    const recl = ["AB-01", "CD-02", "EF-03", "GH-04", "IJ-05", "KL-06", "MN-07", "OP-08"];
    const logit = (x) => 1 / (1 + Math.exp(-x));
    const facItem = Object.fromEntries(items.map((id) => [id, (ITEM[id].dificultad === "facil" ? 1.3 : -0.5) + (Math.random() - 0.5) * 1.2]));
    for (let i = 0; i < 64; i++) {
      const cond = piloto ? "piloto" : (i % 2 ? "incentivo" : "control");
      const hab = (Math.random() + Math.random() + Math.random() - 1.5) * 1.6;
      const tramposo = Math.random() < 0.06;
      const f = { id: "SIM-" + (i + 1), cohorte: "simulado", modo: piloto ? "piloto" : "experimento", condicion: cond,
        reclutador: recl[Math.floor(i / 8) % recl.length], dispositivo: "D-" + (i % 12), sexo: Math.random() < 0.6 ? "Mujer" : "Hombre",
        edad: 18 + Math.floor(Math.random() * 10), psicologia: Math.random() < 0.15 ? "Sí" : "No",
        ya_participo: Math.random() < 0.03 ? "Sí" : "No", condiciones: Math.random() < 0.05 ? "No" : "Sí",
        cambios_pestana: Math.random() < 0.05 ? 2 : 0 };
      const R = [];
      items.forEach((id, k) => {
        const dif = ITEM[id].dificultad;
        const extra = cond === "incentivo" ? (dif === "dificil" ? 1.0 : 0.35) : 0;
        const ok = tramposo ? (Math.random() < 0.11 ? 1 : 0) : (Math.random() < logit(hab + facItem[id] + extra) ? 1 : 0);
        const tr = tramposo ? 900 + Math.random() * 1500 :
          Math.round(Math.exp(Math.log(dif === "facil" ? 9000 : 17000) + (cond === "incentivo" ? 0.15 : 0) + (Math.random() - 0.5) * 0.9));
        const resp = ok ? ITEM[id].correcta : (Math.random() < 0.1 ? 10 : 1 + Math.floor(Math.random() * 8));
        R.push({ id, dif, ok, tr, resp });
        f[id + "_resp"] = resp; f[id + "_ok"] = ok; f[id + "_tr"] = tr; f[id + "_pos"] = k + 1;
      });
      const med = (x) => E.mediana(x);
      DIF.forEach((d) => { const r = R.filter((x) => x.dif === d); f["aciertos_" + d] = r.reduce((a, x) => a + x.ok, 0); f["n_" + d] = r.length; f["tr_mediana_" + d] = med(r.map((x) => x.tr)); });
      f.aciertos_total = f.aciertos_facil + f.aciertos_dificil; f.n_items = R.length;
      f.n_rapidas = R.filter((x) => x.tr < C.RAPIDA_MS).length; f.tr_mediana = med(R.map((x) => x.tr));
      const cuenta = {}; R.forEach((x) => { cuenta[x.resp] = (cuenta[x.resp] || 0) + 1; }); f.max_misma_opcion = Math.max(...Object.values(cuenta));
      f.duracion_s = Math.round(R.reduce((a, x) => a + x.tr, 0) / 1000 + 60);
      const m = cond === "incentivo" ? 0.6 : 0;
      ["mot_esfuerzo", "mot_interes", "mot_importancia"].forEach((k) => { f[k] = Math.max(1, Math.min(5, Math.round(3.2 + m + (Math.random() - 0.5) * 2.4))); });
      f.motivacion = (f.mot_esfuerzo + f.mot_interes + f.mot_importancia) / 3;
      f.recuerda_premio = cond === "incentivo" ? (Math.random() < 0.9 ? "Sí" : "No") : (Math.random() < 0.05 ? "Sí" : "No");
      f.umbral = C.INCENTIVO.UMBRAL; f.supera_umbral = f.aciertos_total >= C.INCENTIVO.UMBRAL ? 1 : 0;
      f.premio = cond === "incentivo" && f.supera_umbral ? 1 : 0;
      filas.push(f);
    }
    FILAS = filas; estado("Datos SIMULADOS (no son reales)."); pintar();
  }

  /* ---------------- control de calidad (se recalcula con los umbrales actuales de config.js) ---------------- */
  function motivos(f) {
    const S = C.SOSPECHA, m = [];
    if (num(f.n_rapidas) >= S.MIN_RAPIDAS) m.push(`${f.n_rapidas} respuestas < ${C.RAPIDA_MS / 1000} s`);
    if (num(f.tr_mediana) < S.MEDIANA_MIN_MS) m.push(`mediana ${fmt(num(f.tr_mediana) / 1000, 1)} s`);
    if (num(f.max_misma_opcion) >= S.MISMA_OPCION) m.push(`misma opción ${f.max_misma_opcion} veces`);
    if (num(f.duracion_s) < S.DURACION_MIN_S) m.push(`duración ${f.duracion_s} s`);
    if (num(f.cambios_pestana) >= S.CAMBIOS_PESTANA) m.push(`${f.cambios_pestana} salidas de pestaña`);
    return m;
  }
  const esSosp = (f) => motivos(f).length > 0 || String(f.sospechoso) === "1";
  function filtrar() {
    return FILAS.filter((f) => {
      if (!isFinite(num(f.aciertos_facil)) || !isFinite(num(f.aciertos_dificil))) return false;
      if ($("#f-sospecha").checked && esSosp(f)) return false;
      if ($("#f-ya").checked && f.ya_participo === "Sí") return false;
      if ($("#f-condiciones").checked && f.condiciones === "No") return false;
      if ($("#f-psico").checked && f.psicologia === "Sí") return false;
      return true;
    });
  }

  /* ---------------- SVG ---------------- */
  const tip = $("#tip");
  function conTip(e, html) {
    e.addEventListener("mousemove", (ev) => { tip.innerHTML = html; tip.style.display = "block"; tip.style.left = (ev.clientX + 14) + "px"; tip.style.top = (ev.clientY + 14) + "px"; });
    e.addEventListener("mouseleave", () => { tip.style.display = "none"; });
  }
  const NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, padre) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (padre) padre.appendChild(e); return e; }
  function texto(padre, x, y, t, extra = {}) { const e = el("text", Object.assign({ x, y }, extra), padre); e.textContent = t; return e; }
  function ejeY(svg, x0, x1, y, min, max, paso, titulo, H, dec = 0) {
    for (let v = min; v <= max + 1e-9; v += paso) {
      el("line", { x1: x0, x2: x1, y1: y(v), y2: y(v), stroke: "#E3E8F4", "stroke-width": 1 }, svg);
      texto(svg, x0 - 6, y(v) + 4, fmt(v, dec), { "text-anchor": "end" });
    }
    if (titulo) texto(svg, 14, H / 2, titulo, { transform: `rotate(-90 14 ${H / 2})`, "text-anchor": "middle" });
  }
  const jit = (i) => (((i * 7919) % 97) / 97 - 0.5);
  const vacio = (msg) => `<p class="nota">${msg}</p>`;

  /* Gráfico de interacción: X = dificultad, una línea por grupo */
  function graficoInter(G, campo, titulo, escala = 1, dec = 0) {
    const W = 560, H = 320, m = { l: 62, r: 24, t: 18, b: 44 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Gráfico de interacción" });
    const d = {}; GR.forEach((g) => { d[g] = DIF.map((df) => E.descriptivos(G[g].map((f) => num(f[campo(df)]) / escala))); });
    const vals = GR.flatMap((g) => d[g].flatMap((x) => [x.li, x.ls])).filter(isFinite);
    let lo = Math.floor(Math.min(...vals)), hi = Math.ceil(Math.max(...vals));
    lo = Math.max(0, lo - 1); hi = hi + 1; if (hi - lo < 2) hi = lo + 2;
    const paso = Math.max(1, Math.ceil((hi - lo) / 6));
    const y = (v) => m.t + (H - m.t - m.b) * (1 - (v - lo) / (hi - lo));
    const x = (j, g) => m.l + (W - m.l - m.r) * (j + 0.5) / 2 + (g === "incentivo" ? -8 : 8);
    ejeY(svg, m.l, W - m.r, y, lo, hi, paso, titulo, H, dec);
    DIF.forEach((df, j) => texto(svg, x(j, "") , H - 16, NOM_DIF[df], { "text-anchor": "middle", "font-weight": 700 }));
    GR.forEach((g) => {
      const p = d[g]; if (!p[0].n) return;
      el("polyline", { points: p.map((s, j) => `${x(j, g)},${y(s.media)}`).join(" "), fill: "none", stroke: COL[g], "stroke-width": 3 }, svg);
      p.forEach((s, j) => {
        if (isFinite(s.li)) el("line", { x1: x(j, g), x2: x(j, g), y1: y(s.li), y2: y(s.ls), stroke: COL[g], "stroke-width": 2 }, svg);
        const c = el("circle", { cx: x(j, g), cy: y(s.media), r: 7, fill: COL[g], stroke: "#fff", "stroke-width": 2 }, svg);
        conTip(c, `<b>${NOM_GR[g]} · ${NOM_DIF[DIF[j]]}</b><br>M = ${fmt(s.media)} · IC95 [${fmt(s.li)}, ${fmt(s.ls)}] · n = ${s.n}`);
      });
    });
    return svg;
  }

  /* Efecto principal: medias marginales (proporción de aciertos) unidas por una línea */
  function graficoMarginal(etiquetas, datos, colores) {
    const W = 420, H = 280, m = { l: 58, r: 24, t: 18, b: 40 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Medias marginales" });
    const d = datos.map((v) => E.descriptivos(v.filter(isFinite)));
    const vals = d.flatMap((x) => [x.li, x.ls]).filter(isFinite);
    const lo = Math.max(0, Math.floor((Math.min(...vals) - 0.05) * 10) / 10), hi = Math.min(1, Math.ceil((Math.max(...vals) + 0.05) * 10) / 10);
    const y = (v) => m.t + (H - m.t - m.b) * (1 - (v - lo) / (hi - lo));
    const x = (j) => m.l + (W - m.l - m.r) * (j + 0.5) / d.length;
    for (let v = lo; v <= hi + 1e-9; v += 0.1) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: "#E3E8F4" }, svg);
      texto(svg, m.l - 6, y(v) + 4, fmt(v, 1), { "text-anchor": "end" });
    }
    texto(svg, 14, H / 2, "Proporción de aciertos", { transform: `rotate(-90 14 ${H / 2})`, "text-anchor": "middle" });
    el("polyline", { points: d.map((s, j) => `${x(j)},${y(s.media)}`).join(" "), fill: "none", stroke: "#001447", "stroke-width": 2.5, "stroke-dasharray": "6 4" }, svg);
    d.forEach((s, j) => {
      texto(svg, x(j), H - 14, etiquetas[j], { "text-anchor": "middle", "font-weight": 700 });
      if (isFinite(s.li)) el("line", { x1: x(j), x2: x(j), y1: y(s.li), y2: y(s.ls), stroke: colores[j], "stroke-width": 2.5 }, svg);
      const c = el("circle", { cx: x(j), cy: y(s.media), r: 8, fill: colores[j], stroke: "#fff", "stroke-width": 2 }, svg);
      conTip(c, `<b>${etiquetas[j]}</b><br>M = ${fmt(s.media)} · IC95 [${fmt(s.li)}, ${fmt(s.ls)}] · n = ${s.n}`);
    });
    return svg;
  }

  /* Cajas + puntos individuales (4 celdas) */
  function graficoDist(G) {
    const W = 560, H = 320, m = { l: 52, r: 16, t: 14, b: 50 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Distribución de aciertos" });
    const maxN = Math.max(...DIF.map((df) => C.MODO === "piloto" ? 10 : C.ITEMS_EXPERIMENTO.filter((id) => ITEM[id].dificultad === df).length), 1);
    const y = (v) => m.t + (H - m.t - m.b) * (1 - v / maxN);
    ejeY(svg, m.l, W - m.r, y, 0, maxN, 1, "Aciertos", H);
    const banda = (W - m.l - m.r) / 4;
    DIF.forEach((df, j) => {
      texto(svg, m.l + banda * (2 * j + 1), H - 14, NOM_DIF[df], { "text-anchor": "middle", "font-weight": 700 });
      GR.forEach((g, k) => {
        const xc = m.l + banda * (2 * j + k + 0.5), v = G[g].map((f) => num(f["aciertos_" + df]));
        if (!v.length) return;
        const s = E.descriptivos(v);
        el("rect", { x: xc - 22, width: 44, y: y(s.q3), height: Math.max(1, y(s.q1) - y(s.q3)), fill: COL[g], "fill-opacity": .14, stroke: COL[g] }, svg);
        el("line", { x1: xc - 22, x2: xc + 22, y1: y(s.mediana), y2: y(s.mediana), stroke: COL[g], "stroke-width": 3 }, svg);
        v.forEach((vi, i) => el("circle", { cx: xc + jit(i + 3 * j + k) * 56, cy: y(vi) + jit(i * 3 + 1) * 6, r: 3.2, fill: COL[g], "fill-opacity": .55 }, svg));
        const r = el("rect", { x: xc - 7, y: y(s.media) - 7, width: 14, height: 14, fill: "#fff", stroke: "#001447", "stroke-width": 2, transform: `rotate(45 ${xc} ${y(s.media)})` }, svg);
        conTip(r, `<b>${NOM_GR[g]} · ${NOM_DIF[df]}</b><br>M = ${fmt(s.media)} · Mdn = ${fmt(s.mediana, 1)} · DE = ${fmt(s.de)}`);
        texto(svg, xc, H - 32, NOM_GR[g], { "text-anchor": "middle", fill: COL[g], "font-size": 12 });
      });
    });
    return svg;
  }

  /* ---------------- tablas ---------------- */
  function tablaDesc(G, campo, escala = 1) {
    const filas = [];
    DIF.concat(["total"]).forEach((df) => {
      GR.concat(["ambos"]).forEach((g) => {
        const lista = g === "ambos" ? G.incentivo.concat(G.control) : G[g];
        const v = lista.map((f) => df === "total" ? (num(f[campo("facil")]) + num(f[campo("dificil")])) / (escala === 1 ? 1 : 2) / escala : num(f[campo(df)]) / escala).filter(isFinite);
        const s = E.descriptivos(v);
        filas.push(`<tr class="${g === "ambos" ? "marginal" : ""}"><td>${df === "total" ? (escala === 1 ? "Total" : "Media") : NOM_DIF[df]}</td><td>${g === "ambos" ? "Ambos grupos" : NOM_GR[g]}</td>
          <td>${s.n}</td><td>${fmt(s.media)}</td><td>${fmt(s.de)}</td><td>${fmt(s.se)}</td><td>[${fmt(s.li)}, ${fmt(s.ls)}]</td><td>${fmt(s.mediana, 1)}</td><td>${fmt(s.min, 0)}–${fmt(s.max, 0)}</td></tr>`);
      });
    });
    return `<tr><th>Dificultad</th><th>Grupo</th><th>N</th><th>Media</th><th>DE</th><th>EE</th><th>IC 95 %</th><th>Mediana</th><th>Rango</th></tr>` + filas.join("");
  }
  function tablasAnova(a, nomB, nomAB, nomA) {
    const f = (n, r, err) => `<tr><td>${n}</td><td>${fmt(r.ss, 3)}</td><td>${r.gl}</td><td>${fmt(r.ms, 3)}</td><td>${err ? "" : fmt(r.F, 3)}</td><td>${err ? "" : fmtP(r.p)}</td><td>${err ? "" : fmt(r.eta2p, 3)}</td></tr>`;
    const cab = `<tr><th>Fuente</th><th>Suma de cuadrados</th><th>gl</th><th>Media cuadrática</th><th>F</th><th>p</th><th>η²p</th></tr>`;
    return {
      intra: cab + f(nomB, a.intra.B) + f(nomAB, a.intra.AB) + f("Residuo", a.intra.res, true),
      entre: cab + f(nomA, a.entre.A) + f("Residuo", a.entre.res, true)
    };
  }

  /* ---------------- análisis de ítems + matriz Q ---------------- */
  function analisisItems(F) {
    const ids = C.ITEMS.filter((it) => it.dificultad !== "practica" && F.some((f) => isFinite(num(f[it.id + "_ok"])))).map((it) => it.id);
    return ids.map((id) => {
      const R = F.filter((f) => isFinite(num(f[id + "_ok"])));
      const ok = R.map((f) => num(f[id + "_ok"]));
      const resto = R.map((f) => {
        let s = 0; ids.forEach((j) => { if (j !== id) { const v = num(f[j + "_ok"]); if (isFinite(v)) s += v; } }); return s;
      });
      const pg = (g) => { const v = R.filter((f) => f.condicion === g).map((f) => num(f[id + "_ok"])); return v.length ? E.media(v) : NaN; };
      const tr = R.map((f) => num(f[id + "_tr"])).filter(isFinite);
      const resp = {}; R.forEach((f) => { const r = String(f[id + "_resp"]); resp[r] = (resp[r] || 0) + 1; });
      const distr = Object.entries(resp).filter(([r]) => Number(r) !== ITEM[id].correcta && r !== "10" && r !== "0").sort((a, b) => b[1] - a[1])[0];
      return { id, it: ITEM[id], n: R.length, p: ok.length ? E.media(ok) : NaN, pInc: pg("incentivo"), pCon: pg("control"),
               r: E.pearson(ok, resto), trMed: tr.length ? E.mediana(tr) / 1000 : NaN,
               nose: (resp["10"] || 0) / (R.length || 1), distr: distr ? `${distr[0] === "9" ? "Ninguna" : distr[0]} (${Math.round(100 * distr[1] / R.length)} %)` : "–" };
    });
  }
  function tablaItems(A) {
    const exp = new Set(C.ITEMS_EXPERIMENTO);
    const cab = `<tr><th>Ítem</th><th>Dificultad</th>${REGLAS.map((r) => `<th class="q-col" title="${C.REGLAS[r]}">${C.REGLAS[r].replace("Rotación", "Rot.").replace("Movimiento del", "Mov.").replace("Sustracción de líneas", "Sustracción")}</th>`).join("")}
      <th>Nº reglas</th><th>Clave</th><th>N</th><th>p</th><th>p incentivo</th><th>p control</th><th>r ítem-resto</th><th>Mdn TR (s)</th><th>«No sé»</th><th>Distractor más elegido</th></tr>`;
    return cab + A.map((x) => {
      const aviso = x.r < 0.15 ? ' class="aviso-celda" title="Discriminación baja"' : "";
      return `<tr${exp.has(x.id) ? ' class="en-prueba"' : ""}><td><b>${x.id}</b>${exp.has(x.id) ? " ●" : ""}</td><td>${x.it.dificultad === "facil" ? "Fácil" : "Difícil"}</td>
        ${REGLAS.map((r) => x.it.reglas.includes(r) ? '<td class="q-si">✓</td>' : '<td class="q-no">·</td>').join("")}
        <td>${x.it.reglas.length}</td><td>${x.it.correcta}</td><td>${x.n}</td><td><b>${fmt(x.p)}</b></td><td>${fmt(x.pInc)}</td><td>${fmt(x.pCon)}</td>
        <td${aviso}>${fmt(x.r)}</td><td>${fmt(x.trMed, 1)}</td><td>${pct(x.nose)}</td><td>${x.distr}</td></tr>`;
    }).join("") + `<tr class="nota-tabla"><td colspan="${REGLAS.length + 12}">● = ítem usado en el experimento. Matriz Q: filas = ítems, columnas = reglas (1 = ✓, 0 = ·).
      Un ítem difícil combina rotación de la figura principal + sustracción de líneas + una tercera regla. r ítem-resto &lt; .15 indica que el ítem discrimina poco.</td></tr>`;
  }
  function tablaReglas(A) {
    const cab = `<tr><th>Regla</th><th>Ítems que la contienen</th><th>p media (fáciles)</th><th>p media (difíciles)</th><th>p media (todos)</th><th>Mdn TR (s)</th></tr>`;
    const m = (v) => v.length ? E.media(v) : NaN;
    return cab + REGLAS.map((r) => {
      const con = A.filter((x) => x.it.reglas.includes(r) && isFinite(x.p));
      return `<tr><td>${C.REGLAS[r]}</td><td>${con.map((x) => x.id).join(", ") || "–"}</td><td>${fmt(m(con.filter((x) => x.it.dificultad === "facil").map((x) => x.p)))}</td>
        <td>${fmt(m(con.filter((x) => x.it.dificultad === "dificil").map((x) => x.p)))}</td><td>${fmt(m(con.map((x) => x.p)))}</td><td>${fmt(m(con.map((x) => x.trMed).filter(isFinite)), 1)}</td></tr>`;
    }).join("");
  }

  /* Modo piloto: propone 6 fáciles + 6 difíciles y un umbral */
  function panelPiloto(F, A) {
    const elegir = (df, lo, hi) => A.filter((x) => x.it.dificultad === df && x.p >= lo && x.p <= hi && isFinite(x.r))
      .sort((a, b) => b.r - a.r).slice(0, 6).map((x) => x.id);
    const fac = elegir("facil", .40, .95), dif = elegir("dificil", .15, .80);
    const sel = fac.concat(dif);
    const tot = F.map((f) => sel.reduce((s, id) => s + (num(f[id + "_ok"]) || 0), 0));
    const p80 = tot.length ? Math.ceil(E.cuantil(tot, 0.8)) : NaN;
    const pctSup = tot.length ? tot.filter((t) => t >= p80).length / tot.length : NaN;
    $("#piloto-txt").innerHTML = `<p>Con <b>${F.length}</b> participantes de prueba se proponen los ítems con mejor discriminación dentro de un rango de dificultad adecuado
      (fáciles: p entre .40 y .95; difíciles: p entre .15 y .80).</p>
      <p><b>Fáciles:</b> ${fac.join(", ") || "–"} · <b>Difíciles:</b> ${dif.join(", ") || "–"}</p>
      <p><b>Umbral sugerido:</b> ${isFinite(p80) ? p80 : "–"} aciertos de ${sel.length} (percentil 80 del piloto: lo superaría ≈ ${pct(pctSup)} de las personas sin incentivo).
      Es exigente pero alcanzable, que es lo que necesita un incentivo para motivar.</p>
      <p>Copia en <code>js/config.js</code> y cambia <code>MODO</code> a <code>"experimento"</code>:</p>
      <pre>ITEMS_EXPERIMENTO: ${JSON.stringify(sel)},\nUMBRAL: ${isFinite(p80) ? p80 : 10},</pre>`;
  }

  /* ================== PINTAR TODO ================== */
  function pintar() {
    const F = filtrar();
    const exp = F.filter((f) => f.condicion === "incentivo" || f.condicion === "control");
    const pil = F.filter((f) => f.condicion === "piloto" || f.modo === "piloto");
    const G = { incentivo: exp.filter((f) => f.condicion === "incentivo"), control: exp.filter((f) => f.condicion === "control") };
    $("#t-n").textContent = F.length; $("#t-inc").textContent = G.incentivo.length; $("#t-con").textContent = G.control.length;
    $("#t-exc").textContent = FILAS.length - F.length;

    // análisis de ítems (sirve en piloto y en experimento)
    const A = analisisItems(F);
    $("#tab-items").innerHTML = A.length ? tablaItems(A) : `<tr><td>${vacio("Sin datos ítem a ítem.")}</td></tr>`;
    $("#tab-reglas").innerHTML = A.length ? tablaReglas(A) : "";
    $("#panel-piloto").style.display = (pil.length || C.MODO === "piloto") ? "" : "none";
    if (pil.length || C.MODO === "piloto") panelPiloto(pil.length ? pil : F, A);

    calidad();
    crudos();

    const hay = G.incentivo.length >= 2 && G.control.length >= 2;
    ["#tab-desc", "#tab-intra", "#tab-entre", "#tab-simples", "#tab-nopar", "#tab-manip", "#tab-umbral", "#tab-tr"].forEach((s) => { $(s).innerHTML = ""; });
    ["#g-inter", "#g-dist", "#g-tr", "#g-ef-inc", "#g-ef-dif"].forEach((s) => { $(s).innerHTML = ""; });
    if (!hay) {
      const msg = vacio("Hacen falta al menos 2 personas en cada grupo (incentivo y control). Prueba «Datos simulados».");
      $("#sub-desc").innerHTML = msg; $("#interp").innerHTML = ""; $("#interp-nopar").innerHTML = ""; $("#apa").innerHTML = msg; $("#interp-umbral").innerHTML = ""; $("#sub-umbral").innerHTML = "";
      return;
    }
    const aciertos = (df) => "aciertos_" + df;
    $("#sub-desc").textContent = `Aciertos en ${C.ITEMS_EXPERIMENTO.filter((i) => ITEM[i].dificultad === "facil").length} ítems fáciles y ${C.ITEMS_EXPERIMENTO.filter((i) => ITEM[i].dificultad === "dificil").length} difíciles`;
    $("#tab-desc").innerHTML = tablaDesc(G, aciertos);
    $("#g-inter").appendChild(graficoInter(G, aciertos, "Aciertos (media)"));
    $("#g-dist").appendChild(graficoDist(G));

    // ANOVA mixto
    const pares = (g, campo, esc = 1) => G[g].map((f) => [num(f[campo("facil")]) / esc, num(f[campo("dificil")]) / esc]).filter((r) => r.every(isFinite));
    const a = E.anovaMixta([pares("incentivo", aciertos), pares("control", aciertos)]);
    const T = tablasAnova(a, "Dificultad", "Dificultad × Incentivo", "Incentivo");
    $("#tab-intra").innerHTML = T.intra; $("#tab-entre").innerHTML = T.entre;

    // efectos simples
    const v = (g, df) => G[g].map((f) => num(f["aciertos_" + df]));
    const simp = [];
    DIF.forEach((df) => { const w = E.welch(v("incentivo", df), v("control", df)); simp.push({ txt: `Incentivo vs. control en ítems ${df === "facil" ? "fáciles" : "difíciles"}`, est: `t(${fmt(w.gl, 1)}) = ${fmt(w.t)}`, dif: w.m1 - w.m2, d: w.d, p: w.p, tipo: "Welch" }); });
    GR.forEach((g) => { const t = E.tRelacionadas(v(g, "facil"), v(g, "dificil")); simp.push({ txt: `Fácil vs. difícil en el grupo ${NOM_GR[g].toLowerCase()}`, est: `t(${t.gl}) = ${fmt(t.t)}`, dif: t.md, d: t.dz, p: t.p, tipo: "relacionadas" }); });
    const pb = E.bonf(simp.slice(0, 2).map((s) => s.p)).concat(E.bonf(simp.slice(2).map((s) => s.p)));
    simp.forEach((s, i) => { s.pb = pb[i]; });
    $("#tab-simples").innerHTML = `<tr><th>Comparación</th><th>Prueba</th><th>Diferencia de medias</th><th>Estadístico</th><th>d</th><th>p</th><th>p Bonferroni</th></tr>` +
      simp.map((s) => `<tr><td>${s.txt}</td><td>t ${s.tipo}</td><td>${fmt(s.dif)}</td><td>${s.est}</td><td>${fmt(s.d)}</td><td>${fmtP(s.p)}</td><td>${fmtP(s.pb)}</td></tr>`).join("");

    const mInc = E.media(G.incentivo.map((f) => num(f.aciertos_total) || num(f.aciertos_facil) + num(f.aciertos_dificil)));
    const mCon = E.media(G.control.map((f) => num(f.aciertos_total) || num(f.aciertos_facil) + num(f.aciertos_dificil)));
    $("#interp").innerHTML = `<p><b>Efecto principal de la dificultad</b>: ${sig(a.intra.B.p)} (η²p = ${fmt(a.intra.B.eta2p)}). Comprobación de que la manipulación de la dificultad funciona.</p>
      <p><b>Efecto principal del incentivo</b>: ${sig(a.entre.A.p)} (η²p = ${fmt(a.entre.A.eta2p)}). Aciertos totales: incentivo M = ${fmt(mInc)}, control M = ${fmt(mCon)}.</p>
      <p><b>Interacción</b>: ${sig(a.intra.AB.p)} (η²p = ${fmt(a.intra.AB.eta2p)}). ${a.intra.AB.p < .05 ? "El efecto del incentivo depende de la dificultad: mira los efectos simples para ver dónde aparece." : "No hay evidencia de que el efecto del incentivo sea distinto en ítems fáciles y difíciles (las líneas son aproximadamente paralelas)."}</p>
      <p class="nota">SC de tipo III, como en JASP (ANOVA de medidas repetidas con «Incentivo» como factor entre sujetos). Con 2 niveles intrasujeto no hace falta corregir la esfericidad.</p>`;

    // ---------- alternativa no paramétrica ----------
    const tot = (g) => G[g].map((f) => num(f.aciertos_facil) + num(f.aciertos_dificil));
    const dif = (g) => G[g].map((f) => num(f.aciertos_facil) - num(f.aciertos_dificil));
    const todos = (df) => GR.flatMap((g) => v(g, df));
    const mw = (a, b) => { const r = E.mannWhitney(a, b); if (r) r.rrb = 2 * r.U1 / (a.length * b.length) - 1; return r; };
    const NP = [
      { ef: "Incentivo (efecto principal)", txt: "Aciertos totales: incentivo vs. control", r: mw(tot("incentivo"), tot("control")), t: "mw" },
      { ef: "Dificultad (efecto principal)", txt: "Fácil vs. difícil (todos)", r: E.wilcoxon(todos("facil"), todos("dificil")), t: "w" },
      { ef: "Interacción", txt: "Diferencia fácil − difícil: incentivo vs. control", r: mw(dif("incentivo"), dif("control")), t: "mw" },
      { ef: "Efecto simple", txt: "Incentivo vs. control en fáciles", r: mw(v("incentivo", "facil"), v("control", "facil")), t: "mw", b: 1 },
      { ef: "Efecto simple", txt: "Incentivo vs. control en difíciles", r: mw(v("incentivo", "dificil"), v("control", "dificil")), t: "mw", b: 1 },
      { ef: "Efecto simple", txt: "Fácil vs. difícil en el grupo incentivo", r: E.wilcoxon(v("incentivo", "facil"), v("incentivo", "dificil")), t: "w", b: 2 },
      { ef: "Efecto simple", txt: "Fácil vs. difícil en el grupo control", r: E.wilcoxon(v("control", "facil"), v("control", "dificil")), t: "w", b: 2 }
    ];
    [1, 2].forEach((b) => { const fs = NP.filter((x) => x.b === b && x.r); const pb = E.bonf(fs.map((x) => x.r.p)); fs.forEach((x, i) => { x.pb = pb[i]; }); });
    const medG = (g) => `Mdn = ${fmt(E.mediana(tot(g)), 1)}`;
    $("#tab-nopar").innerHTML = `<tr><th>Efecto</th><th>Comparación</th><th>Prueba</th><th>Estadístico</th><th>z</th><th>p</th><th>p Bonferroni</th><th>r biserial de rangos</th></tr>` +
      NP.map((x) => !x.r ? `<tr><td>${x.ef}</td><td>${x.txt}</td><td colspan="6">–</td></tr>` :
        `<tr><td>${x.ef}</td><td>${x.txt}</td><td>${x.t === "mw" ? "U de Mann-Whitney" : "Wilcoxon (rangos con signo)"}</td>
         <td>${x.t === "mw" ? `U = ${fmt(x.r.U1, 1)}` : `W = ${fmt(x.r.W, 1)} (n = ${x.r.n})`}</td><td>${fmt(x.r.z)}</td><td>${fmtP(x.r.p)}</td>
         <td>${x.pb !== undefined ? fmtP(x.pb) : ""}</td><td>${fmt(x.r.rrb)}</td></tr>`).join("") +
      `<tr class="nota-tabla"><td colspan="8">U se refiere al primer grupo (incentivo); r biserial &gt; 0 indica valores mayores en el primer grupo o en «fácil».
        Wilcoxon descarta las diferencias nulas. Aproximación normal con corrección por empates y continuidad (JASP da la p exacta con n pequeños sin empates).
        La interacción se contrasta comparando entre grupos la diferencia fácil − difícil de cada persona.</td></tr>`;
    const [npI, npD, npX] = NP;
    $("#interp-nopar").innerHTML = `<p>Incentivo: ${npI.r ? sig(npI.r.p) : "–"} (${medG("incentivo")} frente a ${medG("control")} aciertos totales).
      Dificultad: ${npD.r ? sig(npD.r.p) : "–"}. Interacción: ${npX.r ? sig(npX.r.p) : "–"}.
      ${npX.r && (npX.r.p < .05) === (a.intra.AB.p < .05) && (npI.r.p < .05) === (a.entre.A.p < .05) ? "Las conclusiones coinciden con las del ANOVA: los resultados no dependen del supuesto de normalidad." : "Alguna conclusión difiere del ANOVA: comenta en clase qué supuesto puede estar fallando (normalidad, efecto techo, valores atípicos)."}</p>`;

    // ---------- efectos principales (medias marginales, proporción de aciertos) ----------
    const nIt = (df) => C.ITEMS_EXPERIMENTO.filter((id) => ITEM[id].dificultad === df).length || 1;
    const prop = (f, df) => num(f["aciertos_" + df]) / (num(f["n_" + df]) || nIt(df));
    $("#g-ef-inc").appendChild(graficoMarginal(["Incentivo", "Control"],
      GR.map((g) => G[g].map((f) => (prop(f, "facil") + prop(f, "dificil")) / 2)), [COL.incentivo, COL.control]));
    $("#g-ef-dif").appendChild(graficoMarginal(["Fácil", "Difícil"],
      DIF.map((df) => GR.flatMap((g) => G[g].map((f) => prop(f, df)))), ["#0A8F7B", "#001447"]));

    // manipulación
    const manip = [["mot_esfuerzo", "Esfuerzo"], ["mot_interes", "Interés"], ["mot_importancia", "Importancia de hacerlo bien"], ["motivacion", "Motivación (media de los 3)"]];
    let tm = `<tr><th>Medida</th><th>Incentivo M (DE)</th><th>Control M (DE)</th><th>t Welch</th><th>p</th><th>d</th></tr>`;
    manip.forEach(([k, n]) => {
      const x = G.incentivo.map((f) => num(f[k])).filter(isFinite), y = G.control.map((f) => num(f[k])).filter(isFinite);
      const w = E.welch(x, y);
      tm += `<tr><td>${n}</td><td>${fmt(E.media(x))} (${fmt(E.de(x))})</td><td>${fmt(E.media(y))} (${fmt(E.de(y))})</td><td>${w ? `t(${fmt(w.gl, 1)}) = ${fmt(w.t)}` : "–"}</td><td>${w ? fmtP(w.p) : "–"}</td><td>${w ? fmt(w.d) : "–"}</td></tr>`;
    });
    const rec = (g) => { const s = G[g].filter((f) => f.recuerda_premio === "Sí").length; return [s, G[g].length - s]; };
    const [ri, rni] = rec("incentivo"), [rc, rnc] = rec("control");
    tm += `<tr><td>Dice que se le ofreció premio</td><td>${pct(ri / (ri + rni))} (${ri}/${ri + rni})</td><td>${pct(rc / (rc + rnc))} (${rc}/${rc + rnc})</td><td>Fisher</td><td>${fmtP(E.fisher(ri, rni, rc, rnc))}</td><td></td></tr>`;
    $("#tab-manip").innerHTML = tm;

    // umbral
    const U = C.INCENTIVO.UMBRAL, sup = (g) => G[g].filter((f) => (num(f.aciertos_facil) + num(f.aciertos_dificil)) >= U).length;
    const si = sup("incentivo"), sc = sup("control"), ni = G.incentivo.length, nc = G.control.length;
    $("#sub-umbral").textContent = `Proporción que alcanza ${U} o más aciertos de ${C.ITEMS_EXPERIMENTO.length}. En el grupo control indica lo exigente que es el umbral sin incentivo.`;
    $("#tab-umbral").innerHTML = `<tr><th>Grupo</th><th>Superan el umbral</th><th>%</th><th>Cafés a pagar</th></tr>
      <tr><td>Incentivo</td><td>${si} de ${ni}</td><td>${pct(si / ni)}</td><td><b>${si}</b></td></tr>
      <tr><td>Control</td><td>${sc} de ${nc}</td><td>${pct(sc / nc)}</td><td>0</td></tr>
      <tr class="nota-tabla"><td colspan="4">Prueba exacta de Fisher: p = ${fmtP(E.fisher(si, ni - si, sc, nc - sc))}</td></tr>`;
    $("#interp-umbral").innerHTML = sc / nc > .5 ? "<p>Más de la mitad del grupo control supera el umbral: probablemente es <b>demasiado fácil</b> para motivar.</p>" :
      sc / nc < .1 ? "<p>Casi nadie del grupo control supera el umbral: podría ser <b>demasiado difícil</b> (si parece inalcanzable, el incentivo deja de motivar).</p>" :
      "<p>El umbral es exigente pero alcanzable en el grupo control: adecuado para un incentivo.</p>";

    // tiempos de respuesta
    const trc = (df) => "tr_mediana_" + df;
    const at = E.anovaMixta([pares("incentivo", trc, 1000), pares("control", trc, 1000)]);
    $("#g-tr").appendChild(graficoInter(G, trc, "Mediana TR (s)", 1000));
    const Tt = tablasAnova(at, "Dificultad", "Dificultad × Incentivo", "Incentivo");
    $("#tab-tr").innerHTML = tablaDesc(G, trc, 1000).replace(/<tr class="marginal">[\s\S]*?<\/tr>/g, "") +
      `<tr><th colspan="9">ANOVA mixto sobre la mediana del tiempo (s)</th></tr>` + Tt.intra.replace(/<tr><th>Fuente[\s\S]*?<\/tr>/, "") + Tt.entre.replace(/<tr><th>Fuente[\s\S]*?<\/tr>/, "").replace(/<tr><td>Residuo[\s\S]*?<\/tr>$/, "");

    // APA
    const di = E.descriptivos(G.incentivo.map((f) => num(f.aciertos_dificil))), dc = E.descriptivos(G.control.map((f) => num(f.aciertos_dificil)));
    const fi = E.descriptivos(G.incentivo.map((f) => num(f.aciertos_facil))), fc = E.descriptivos(G.control.map((f) => num(f.aciertos_facil)));
    const glE = a.entre.res.gl, F_ = (r) => `<i>F</i>(${r.gl}, ${glE}) = ${fmt(r.F)}, <i>p</i> ${apaP(r.p)}, η²<sub>p</sub> = ${apaD(r.eta2p)}`;
    $("#apa").innerHTML = `<p>Se realizó un ANOVA mixto 2 (incentivo: sí, no) × 2 (dificultad: fácil, difícil) sobre el número de aciertos, con
      ${a.N} participantes (incentivo <i>n</i> = ${a.ns[0]}; control <i>n</i> = ${a.ns[1]}) tras excluir ${FILAS.length - F.length} participaciones según los criterios fijados de antemano.
      El efecto principal de la dificultad fue ${a.intra.B.p < .05 ? "significativo" : "no significativo"}, ${F_(a.intra.B)}.
      El efecto principal del incentivo fue ${a.entre.A.p < .05 ? "significativo" : "no significativo"}, ${F_(a.entre.A)}.
      La interacción incentivo × dificultad fue ${a.intra.AB.p < .05 ? "significativa" : "no significativa"}, ${F_(a.intra.AB)}.
      En los ítems fáciles, el grupo con incentivo obtuvo <i>M</i> = ${fmt(fi.media)} (<i>DE</i> = ${fmt(fi.de)}) y el grupo control <i>M</i> = ${fmt(fc.media)} (<i>DE</i> = ${fmt(fc.de)});
      en los difíciles, <i>M</i> = ${fmt(di.media)} (<i>DE</i> = ${fmt(di.de)}) frente a <i>M</i> = ${fmt(dc.media)} (<i>DE</i> = ${fmt(dc.de)}).
      ${npI.r && npX.r ? `Como análisis de robustez, las pruebas no paramétricas ${(npX.r.p < .05) === (a.intra.AB.p < .05) && (npI.r.p < .05) === (a.entre.A.p < .05) ? "llevaron a las mismas conclusiones" : "no coincidieron en todo"}:
      incentivo, <i>U</i> = ${fmt(npI.r.U1, 1)}, <i>p</i> ${apaP(npI.r.p)}, <i>r</i><sub>rb</sub> = ${apaD(npI.r.rrb, 2)};
      interacción (diferencia fácil − difícil), <i>U</i> = ${fmt(npX.r.U1, 1)}, <i>p</i> ${apaP(npX.r.p)}, <i>r</i><sub>rb</sub> = ${apaD(npX.r.rrb, 2)}.` : ""}</p>`;
  }

  /* ---------------- calidad de los datos ---------------- */
  function calidad() {
    const por = {};
    FILAS.forEach((f) => {
      const k = f.reclutador || "(sin código)";
      por[k] = por[k] || { n: 0, s: 0, inc: 0, con: 0, disp: new Set(), dur: [], rap: 0 };
      const p = por[k]; p.n++; if (esSosp(f)) p.s++; if (f.condicion === "incentivo") p.inc++; if (f.condicion === "control") p.con++;
      p.disp.add(f.dispositivo); p.dur.push(num(f.duracion_s)); p.rap += num(f.n_rapidas) || 0;
    });
    const filas = Object.entries(por).sort((a, b) => b[1].n - a[1].n);
    $("#tab-reclut").innerHTML = `<tr><th>Código de recogida</th><th>Participaciones</th><th>Incentivo / control</th><th>Dispositivos</th><th>Mdn duración (min)</th><th>Respuestas rápidas (total)</th><th>Sospechosas</th></tr>` +
      (filas.length ? filas.map(([k, p]) => `<tr${p.s / p.n >= .34 ? ' class="aviso-fila"' : ""}><td>${k}</td><td>${p.n}</td><td>${p.inc} / ${p.con}</td><td>${p.disp.size}</td>
        <td>${fmt(E.mediana(p.dur.filter(isFinite)) / 60, 1)}</td><td>${p.rap}</td><td>${p.s} (${pct(p.s / p.n)})</td></tr>`).join("") : `<tr><td colspan="7">Sin datos.</td></tr>`) +
      `<tr class="nota-tabla"><td colspan="7">Sospechosa = cumple algún criterio: ≥ ${C.SOSPECHA.MIN_RAPIDAS} respuestas en menos de ${C.RAPIDA_MS / 1000} s, mediana &lt; ${C.SOSPECHA.MEDIANA_MIN_MS / 1000} s,
        la misma opción ≥ ${C.SOSPECHA.MISMA_OPCION} veces, duración &lt; ${C.SOSPECHA.DURACION_MIN_S} s o ≥ ${C.SOSPECHA.CAMBIOS_PESTANA} salidas de la pestaña. En naranja, códigos con un tercio o más de entradas sospechosas.</td></tr>`;
    const S = FILAS.filter(esSosp);
    $("#sospechosos").innerHTML = S.length ? `<table class="tabla"><tr><th>id</th><th>Código</th><th>Condición</th><th>Aciertos</th><th>Mdn TR (s)</th><th>Motivos</th></tr>` +
      S.map((f) => `<tr><td>${f.id}</td><td>${f.reclutador || ""}</td><td>${f.condicion}</td><td>${num(f.aciertos_facil) + num(f.aciertos_dificil)}</td><td>${fmt(num(f.tr_mediana) / 1000, 1)}</td><td>${motivos(f).join("; ") || f.motivo_sospecha || ""}</td></tr>`).join("") + "</table>" : vacio("Ninguna participación sospechosa.");
  }

  function crudos() {
    const cols = [...new Set(FILAS.flatMap((f) => Object.keys(f)))];
    $("#crudos").innerHTML = FILAS.length ? `<table class="tabla"><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>${FILAS.map((f) => `<tr>${cols.map((c) => `<td>${f[c] ?? ""}</td>`).join("")}</tr>`).join("")}</table>` : vacio("Sin datos.");
  }

  /* CSV ancho para JASP: una fila por persona, una columna por condición intrasujeto */
  function csv() {
    const F = filtrar().filter((f) => f.condicion === "incentivo" || f.condicion === "control");
    if (!F.length) { estado("No hay datos que exportar."); return; }
    const cols = ["id", "Incentivo", "reclutador", "sexo", "edad", "Aciertos_facil", "Aciertos_dificil", "TR_facil_s", "TR_dificil_s",
      "mot_esfuerzo", "mot_interes", "mot_importancia", "motivacion", "recuerda_premio", "supera_umbral"];
    const q = (v) => { const s = v === undefined || v === null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const txt = [cols.join(",")].concat(F.map((f) => [f.id, f.condicion, f.reclutador, f.sexo, f.edad, num(f.aciertos_facil), num(f.aciertos_dificil),
      fmt(num(f.tr_mediana_facil) / 1000, 3), fmt(num(f.tr_mediana_dificil) / 1000, 3), f.mot_esfuerzo, f.mot_interes, f.mot_importancia,
      fmt(num(f.motivacion), 3), f.recuerda_premio, (num(f.aciertos_facil) + num(f.aciertos_dificil)) >= C.INCENTIVO.UMBRAL ? 1 : 0].map(q).join(","))).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
    a.download = `incentivo_razonamiento_${$("#cohorte").value || "datos"}.csv`; a.click();
  }

  $("#btn-cargar").addEventListener("click", cargarServidor);
  $("#btn-demo").addEventListener("click", simular);
  $("#btn-local").addEventListener("click", cargarLocal);
  $("#btn-csv").addEventListener("click", csv);
  ["#f-sospecha", "#f-ya", "#f-condiciones", "#f-psico"].forEach((s) => $(s).addEventListener("change", pintar));
  $("#auto").addEventListener("change", (e) => { clearInterval(timer); if (e.target.checked) { cargarServidor(); timer = setInterval(cargarServidor, 15000); } });
  document.addEventListener("abrir-resultados", () => { if (!cargado) { cargado = true; pintar(); } });
  pintar();
})();
