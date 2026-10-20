/* =====================================================================
   CONTROL DE CALIDAD DE CADA PARTICIPACIÓN (lo usan la tarea y los resultados)
   Separa dos problemas distintos:
     · AZAR        respuestas dadas sin mirar (rapidez, misma opción…).
                   Son datos no válidos: se excluyen.
     · INTERRUPCIÓN la persona salió de la pestaña o dejó la tarea parada.
                   Los datos pueden ser válidos, pero conviene revisarlos.
   Y un tercer indicador, añadido tras el piloto:
     · FÁCILES AL AZAR  ≤ 1 acierto de 6 en los ítems fáciles (lo esperable
                   respondiendo al azar es 0,75). Indica que no se entendió la
                   tarea o no hubo implicación.
   Se calcula siempre a partir de las columnas guardadas, de modo que cambiar
   los umbrales de config.js reclasifica también los datos ya recogidos.
   ===================================================================== */
(function () {
  "use strict";
  const C = window.CONFIG;
  const num = (v) => (v === "" || v === null || v === undefined) ? NaN : Number(String(v).replace(",", "."));
  const med = (x) => { if (!x.length) return NaN; const s = [...x].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const IDS = C.ITEMS.filter((it) => it.dificultad !== "practica").map((it) => it.id);
  const DIF = Object.fromEntries(C.ITEMS.map((it) => [it.id, it.dificultad]));

  /* Respuestas ítem a ítem en el orden de presentación */
  function items(f) {
    return IDS.filter((id) => isFinite(num(f[id + "_resp"])))
      .map((id) => ({ id, dif: DIF[id], resp: num(f[id + "_resp"]), ok: num(f[id + "_ok"]), tr: num(f[id + "_tr"]),
                      pos: num(f[id + "_pos"]), oculto: num(f[id + "_oculto"]) }))
      .sort((a, b) => (a.pos || 0) - (b.pos || 0));
  }

  function clasificar(f) {
    // valores por defecto por si config.js es de una versión anterior
    const S = Object.assign({ MIN_RAPIDAS: 4, MEDIANA_MIN_MS: 4000, MISMA_OPCION: 8, NOSE_RAPIDOS: 5, DURACION_MIN_S: 120,
      CAMBIOS_PESTANA: 2, OCULTO_MAX_S: 60, ITEM_LARGO_S: 150, DURACION_MAX_MIN: 30, FACILES_MAX_AZAR: 1 }, C.SOSPECHA || {});
    const R = items(f);
    const tr = R.map((x) => x.tr).filter(isFinite);
    const rapidas = R.filter((x) => x.resp !== 0 && x.tr < C.RAPIDA_MS).length;
    const mediana = tr.length ? med(tr) : num(f.tr_mediana);
    const cuenta = {}; R.forEach((x) => { cuenta[x.resp] = (cuenta[x.resp] || 0) + 1; });
    const maxMisma = R.length ? Math.max(...Object.values(cuenta)) : num(f.max_misma_opcion);
    const nose = R.filter((x) => x.resp === 10).length;
    const noseRap = R.filter((x) => x.resp === 10 && x.tr < 5000).length;
    const agotados = R.filter((x) => x.resp === 0).length;
    const largos = R.filter((x) => x.tr > S.ITEM_LARGO_S * 1000).length;
    const oculto = R.some((x) => isFinite(x.oculto)) ? R.reduce((a, x) => a + (x.oculto || 0), 0) / 1000 : num(f.oculto_total_s);
    const facilOk = R.length ? R.filter((x) => x.dif === "facil" && x.ok === 1).length : num(f.aciertos_facil);
    const nFacil = R.length ? R.filter((x) => x.dif === "facil").length : num(f.n_facil) || 6;
    const dur = num(f.duracion_s), pest = num(f.cambios_pestana) || 0;

    const azar = [], inter = [], facil = [];
    if (rapidas >= S.MIN_RAPIDAS) azar.push(`${rapidas} respuestas en menos de ${C.RAPIDA_MS / 1000} s`);
    if (mediana < S.MEDIANA_MIN_MS) azar.push(`mediana de ${(mediana / 1000).toFixed(1)} s por ítem`);
    if (maxMisma >= S.MISMA_OPCION) azar.push(`la misma opción ${maxMisma} veces`);
    if (noseRap >= S.NOSE_RAPIDOS) azar.push(`${noseRap} «No sé» en menos de 5 s`);
    if (dur < S.DURACION_MIN_S) azar.push(`duración de ${dur} s`);
    if (pest >= S.CAMBIOS_PESTANA) inter.push(`${pest} salidas de la pestaña`);
    if (oculto >= S.OCULTO_MAX_S) inter.push(`${Math.round(oculto)} s con la tarea oculta`);
    if (largos) inter.push(`${largos} ítem${largos > 1 ? "s" : ""} de más de ${S.ITEM_LARGO_S} s`);
    if (dur > S.DURACION_MAX_MIN * 60) inter.push(`duración de ${Math.round(dur / 60)} min`);
    if (facilOk <= S.FACILES_MAX_AZAR && nFacil >= 4) facil.push(`${facilOk} de ${nFacil} fáciles (al azar se esperan ${(nFacil / 8).toFixed(2)})`);

    return { azar, inter, facil, esAzar: azar.length > 0, esInter: inter.length > 0, esFacil: facil.length > 0,
             datos: { rapidas, mediana, maxMisma, nose, noseRap, agotados, largos, oculto, facilOk, nFacil, dur, pest }, R };
  }

  window.CALIDAD = { clasificar, items };
})();
