# Incentive × Difficulty in Figural Reasoning — classroom factorial experiment

Web app for a **2 × 2 mixed factorial experiment** (ESIC University · Métodos, Diseño y Técnicas de Investigación en Psicología · Tema 6).

* **IV 1 – Incentive (between subjects):** *incentivo* (a coffee if the score reaches a threshold) vs. *control* (no prize mentioned).
* **IV 2 – Difficulty (within subjects):** easy figural analogies (1 rule) vs. hard ones (3 rules: main-figure rotation + line subtraction + one more).
* **DV:** number of correct answers (plus response time per item).
* Items generated with **IMak** (Blum & Holling, 2018). Students recruit participants on campus with their own phones.

La web tiene dos pestañas: **Experimento** (lo que hace cada participante) y **Resultados** (lo que proyecta el profesor: descriptivos, gráfico de interacción, ANOVA mixto tipo III como JASP, alternativa no paramétrica (Mann-Whitney y Wilcoxon), gráficos de efectos principales, efectos simples, comprobación de la manipulación, tiempos, **matriz Q** y análisis de ítems, calidad de datos y texto APA).

## Puesta en marcha (una vez)

1. **Hoja de datos.** Sube `apps-script/Incentivo_Razonamiento_datos.xlsx` a Google Drive y ábrelo como Hoja de cálculo de Google (Archivo › Guardar como Hojas de cálculo de Google).
2. **Apps Script.** En la hoja: Extensiones › Apps Script. Pega `apps-script/Code.gs`, cambia `CLAVE_RESULTADOS`, ejecuta `preparar` (autoriza) y publica: Implementar › Nueva implementación › Aplicación web · Ejecutar como **yo** · Acceso **cualquier usuario**. Copia la URL `/exec`.
3. **Configuración.** En `js/config.js` pega la URL en `ENDPOINT` y revisa `COHORTE`.
4. **GitHub Pages.** Sube la carpeta a un repositorio (p. ej. `incentive-reasoning-experiment`) › Settings › Pages › *Deploy from branch* `main` / root.
5. Prueba con `?reset=1` al final de la URL para poner a cero el contador del dispositivo. Después de probar, borra las filas de prueba y ejecuta `reiniciarAleatorizacion` en el editor de Apps Script.

## Piloto → experimento

1. `MODO: "piloto"`: cada persona hace los **20 ítems**, sin incentivo. Hazlo con la clase.
2. En Resultados aparece el panel **P**: propone 6 fáciles + 6 difíciles (mejor discriminación dentro de un rango de dificultad) y un **umbral** (percentil 80 del piloto: exigente pero alcanzable).
3. Copia `ITEMS_EXPERIMENTO` y `UMBRAL` en `config.js`, cambia `MODO: "experimento"` y vuelve a subir. Cambia también `COHORTE` para separar piloto y experimento.

> Mientras no haya piloto, `ITEMS_EXPERIMENTO` trae una selección por defecto (F11, F12, F14, F15, F17, F18 · D11, D12, D14, D15, D16, D19) y `UMBRAL: 10`.

## ¿Cómo se protegen los datos si dos personas envían a la vez?

* Todas las escrituras (asignar condición y guardar respuestas) pasan por **`LockService`** de Apps Script: las peticiones simultáneas se ponen en cola y se ejecutan una detrás de otra (espera de hasta 30 s). No se pisan filas ni se descuadra la aleatorización.
* Cada participación lleva un **identificador único** (`id`). Si la misma fila llega dos veces (reintento), el script la reconoce y **no la duplica**.
* El navegador guarda la fila en una **cola local** antes de enviarla y pregunta al servidor si la ha recibido (`accion=confirmar`). Si no hay cobertura, la reenvía sola cada 20 s o al recuperar la conexión, incluso en la siguiente participación del mismo móvil.
* Además, cada móvil guarda una copia local (botón «Datos de este navegador»).

## ¿Cómo se asegura la asignación aleatoria?

* La condición la decide el **servidor**, no el móvil ni el estudiante que recoge datos: **aleatorización por bloques permutados de 4** por cohorte (2 incentivo + 2 control barajados con Fisher-Yates). Nadie puede predecir la siguiente condición y los grupos quedan equilibrados.
* Cada asignación queda registrada en la pestaña **Asignaciones** (auditoría).
* Si no hay conexión al empezar, se asigna al azar en el propio móvil (50/50) y se marca `asignacion = "local"`.
* La persona que recoge los datos es **ciega** a la condición: el mensaje del incentivo lo da la web, no ella.

## Límite por dispositivo y detección de respuestas al azar

* Cada móvil admite **6 participaciones** (`MAX_PARTICIPANTES_DISPOSITIVO`). Se registra el código de recogida, el dispositivo, el nº de participación en él y los segundos desde la anterior.
* Se registra el **tiempo de respuesta** de cada ítem (`<ítem>_tr`, ms, con `performance.now()`; las imágenes se precargan para no mezclar tiempo de carga).
* **Aviso en pantalla** si se responden 2 ítems seguidos en menos de 2,5 s.
* La participación se marca **sospechosa** (`sospechoso = 1` + `motivo_sospecha`) si: ≥ 4 respuestas < 2,5 s, mediana < 4 s, misma opción ≥ 8 veces, duración < 2 min o ≥ 2 salidas de la pestaña. En Resultados se recalcula con los umbrales de `config.js`, se excluye con un filtro y hay una tabla por código de recogida.

## Columnas principales

`condicion`, `aciertos_facil`, `aciertos_dificil`, `aciertos_total`, `tr_mediana_facil`, `tr_mediana_dificil` (ms), `mot_esfuerzo`, `mot_interes`, `mot_importancia`, `motivacion`, `recuerda_premio`, `supera_umbral`, `premio`, `codigo_premio`, `sospechoso`, `motivo_sospecha`, y por ítem `<id>_resp` (1-8 opción, 9 ninguna, 10 no sé, 0 tiempo agotado), `<id>_ok`, `<id>_tr`, `<id>_pos`.

## JASP

Botón «CSV para JASP» (formato ancho). ANOVA de medidas repetidas: factor intra *Dificultad* (Aciertos_facil, Aciertos_dificil), factor entre *Incentivo*. La web usa **SC de tipo III**, como JASP; la pestaña Resumen de la hoja da los mismos valores.

## Ética

Participación anónima y voluntaria, mayores de edad. No se recogen nombres ni correos. El café prometido debe **pagarse siempre** a quien supere el umbral (`codigo_premio`). Debriefing al final de la tarea y en `docs/debriefing.md`.

## Referencias

Blum, D. y Holling, H. (2018). Automatic generation of figural analogies with the IMak package. *Frontiers in Psychology, 9*, 1286. https://doi.org/10.3389/fpsyg.2018.01286
León, O. G. y Montero, I. (2015). *Métodos de investigación en Psicología y Educación* (4.ª ed.). McGraw-Hill.
