/* FuegoAlerta GT · interfaz "Bento bosque".
   Lee los datos que ya entrega el servidor Flask (no cambia el backend):
     /api/status          progreso de la descarga de NASA POWER
     /api/estado          fecha de hoy, fuentes y departamentos (lat/lon)
     /api/riesgo_diario   riesgo diario por departamento (30 días obs. + 45 pronóstico)
     /api/departamento/x  variables y plan de prevención de un departamento
     /api/rangos          umbrales y pesos del modelo
     /api/contorno        silueta aproximada de Guatemala
*/
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------------------------------------------------------------
   Textos en español e inglés
---------------------------------------------------------------- */
const T = {
  es: {
    loading: "Conectando con los datos satelitales de la NASA…", loadingNote: "La primera carga puede tardar un minuto.",
    loadingProg: (a, b) => `Obteniendo datos de NASA POWER… ${a} de ${b} departamentos`, loadErr: "No se pudieron cargar los datos. Recargue la página.",
    tabMap: "Mapa", tabCal: "Calendario", tabMet: "Método", langBtn: "EN", langLabel: "Switch to English",
    mapTitle: "Mapa de riesgo", viewRisk: "Riesgo", viewSat: "Satélite VIIRS", riskScale: "Riesgo (0–100)",
    interp: "Superficie interpolada entre 22 puntos de NASA POWER.", satNote: (f) => `Imagen VIIRS color real y focos de calor 375 m del ${f} · NASA GIBS`,
    observed: "Observado", forecast: "Pronóstico", obsPred: "Observado · Pronóstico", today: "Hoy",
    kNational: "Nivel nacional", ofHigh: (n) => `${n} de 22 departamentos en riesgo alto`, kPeak: "Día más crítico",
    timelineHelp: "Toque una barra o presione play para recorrer el tiempo", play: "Reproducir línea de tiempo", pause: "Pausar",
    rankTitle: "Más expuestos", actionToday: "Acción de hoy", varsTitle: "Variables", planTitle: "Plan de prevención", close: "Cerrar detalle",
    maintenanceT: "Abrir rondas cortafuego antes de la época seca", maintenanceD: "Las condiciones son estables: es el momento de retirar combustible y capacitar brigadas.",
    calTitle: "Calendario de riesgo", calScopeNat: "Nacional (máximo por día)", calLegend: "Borde punteado = pronóstico · Borde lima = hoy · Número = riesgo (0–100)",
    topDates: "Fechas más críticas", seeOnMap: "Ver en el mapa →", dayTop: (d) => `Más vulnerables el ${d}`,
    metTitle: "¿Cuándo está el ambiente en estado estable?",
    metHelp: "El modelo es un índice de peligro transparente. Cada variable recibe un puntaje de 0 (rango estable) a 1 (nivel crítico); se ponderan y se ajustan por la presión de quemas humanas de cada mes. Los umbrales son valores de partida que deben calibrarse con INSIVUMEH, CONAP e INAB.",
    formulaLabel: "Cómo se calcula", formula: "riesgo = Σ peso × puntaje × (0.85 + 0.15 × factor de ignición del mes)",
    metNote: "La temperatura estable y crítica se ajusta por la altitud de cada departamento.", stable: "Estable", critical: "Crítico",
    footer: "Herramienta de apoyo a la decisión. Las alertas oficiales y las prohibiciones de quemas provienen de CONRED, CONAP, INAB, MARN y las municipalidades.",
    source: (f) => `Datos: NASA POWER (clima diario, último dato ${f}) · NASA GIBS / VIIRS 375 m (imágenes y focos de calor).`,
    simWarn: (n) => `Atención: ${n} de 22 departamentos usan datos SIMULADOS porque no se pudo conectar con NASA POWER. No los use para tomar decisiones.`,
    riskWord: "riesgo", states: { estable: "Estable", vigilancia: "Vigilancia", critico: "Crítico" },
    days: "días", weekdays: ["L", "M", "M", "J", "V", "S", "D"],
    months: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
    monthsL: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    dow: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
  },
  en: {
    loading: "Connecting to NASA satellite data…", loadingNote: "The first load can take a minute.",
    loadingProg: (a, b) => `Fetching NASA POWER data… ${a} of ${b} departments`, loadErr: "Data could not be loaded. Please reload the page.",
    tabMap: "Map", tabCal: "Calendar", tabMet: "Method", langBtn: "ES", langLabel: "Cambiar a español",
    mapTitle: "Risk map", viewRisk: "Risk", viewSat: "VIIRS satellite", riskScale: "Risk (0–100)",
    interp: "Surface interpolated between 22 NASA POWER points.", satNote: (f) => `VIIRS true color and 375 m thermal hotspots for ${f} · NASA GIBS`,
    observed: "Observed", forecast: "Forecast", obsPred: "Observed · Forecast", today: "Today",
    kNational: "National level", ofHigh: (n) => `${n} of 22 departments at high risk`, kPeak: "Peak day",
    timelineHelp: "Tap a bar or press play to move through time", play: "Play timeline", pause: "Pause",
    rankTitle: "Most exposed", actionToday: "Today's action", varsTitle: "Variables", planTitle: "Prevention plan", close: "Close details",
    maintenanceT: "Open firebreaks before the dry season", maintenanceD: "Conditions are stable: now is the time to remove fuel and train fire brigades.",
    calTitle: "Risk calendar", calScopeNat: "National (daily maximum)", calLegend: "Dashed border = forecast · Lime border = today · Number = risk (0–100)",
    topDates: "Most critical dates", seeOnMap: "Show on map →", dayTop: (d) => `Most vulnerable on ${d}`,
    metTitle: "When is the environment stable?",
    metHelp: "The model is a transparent danger index. Each variable scores from 0 (stable range) to 1 (critical level); scores are weighted and adjusted by the monthly pressure of human burning. Thresholds are starting values to be calibrated with INSIVUMEH, CONAP and INAB.",
    formulaLabel: "How it is calculated", formula: "risk = Σ weight × score × (0.85 + 0.15 × monthly ignition factor)",
    metNote: "Stable and critical temperatures are adjusted by each department's elevation.", stable: "Stable", critical: "Critical",
    footer: "Decision-support tool. Official alerts and burning bans come from CONRED, CONAP, INAB, MARN and municipalities.",
    source: (f) => `Data: NASA POWER (daily climate, latest ${f}) · NASA GIBS / VIIRS 375 m (imagery and thermal hotspots).`,
    simWarn: (n) => `Warning: ${n} of 22 departments use SIMULATED data because NASA POWER could not be reached. Do not use them for decisions.`,
    riskWord: "risk", states: { estable: "Stable", vigilancia: "Watch", critico: "Critical" },
    days: "days", weekdays: ["M", "T", "W", "T", "F", "S", "S"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    monthsL: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    dow: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
};
const NIVEL_EN = { "Bajo": "Low", "Moderado": "Moderate", "Alto": "High", "Muy alto": "Very high", "Extremo": "Extreme" };
const VAR_ES = { tmax: "Temperatura máxima", rh: "Humedad del aire", precip15: "Lluvia (15 días)", dias_sin_lluvia: "Días sin lluvia", wind: "Viento", soil: "Humedad del suelo" };
const VAR_EN = {
  tmax: ["Max temperature", "Heat dries out vegetation fuel."],
  rh: ["Relative humidity", "In dry air, vegetation loses moisture and ignites easily."],
  precip15: ["Rainfall (last 15 days)", "Recent rain keeps soil and fuel moist."],
  dias_sin_lluvia: ["Consecutive dry days", "Each dry day adds more fuel ready to burn."],
  wind: ["Wind speed (2 m)", "Wind fans and spreads fire quickly."],
  soil: ["Topsoil moisture", "Dry soil and leaf litter are the main fuel."],
};
const PLAN_EN = {
  "Conservar la humedad del microclima": ["Keep the microclimate moist", "Keep vegetation cover and mulch on the soil, protect riverside vegetation and water the driest areas in the evening."],
  "Posponer actividades que generen chispa o brasa": ["Postpone spark-producing work", "Dry air lets fire start and spread easily: avoid burning, campfires, welding or machinery during the least humid hours (11:00–16:00)."],
  "Recuperar humedad en el suelo": ["Restore soil moisture", "Use mulch, permanent cover, minimum tillage and targeted drip irrigation on high-risk plots and forest edges."],
  "Reducir el combustible fino": ["Reduce fine fuel", "Incorporate or compost crop residue instead of burning it; clear leaf litter and dry grass near homes, crops and forest edges."],
  "Compensar el déficit de lluvia": ["Offset the rainfall deficit", "Use reservoirs, rainwater harvesting and wells so water is available for support irrigation and fire brigades."],
  "Priorizar vigilancia en zonas secas": ["Prioritize patrols in dry areas", "Coordinate patrols with COCODES, the municipality, firefighters and CONRED in the areas that have gone longest without rain."],
  "Abrir y mantener rondas cortafuego": ["Open and maintain firebreaks", "Clear strips at least 3–5 m wide around plots and forests; widen them on slopes or in windy areas."],
  "Reducir el efecto del viento": ["Reduce wind exposure", "Plant or keep windbreaks (tree rows) and make firebreaks wider on the side of the prevailing wind."],
  "No usar fuego con viento": ["No fire when it is windy", "Suspend all burning, even controlled burns, when the wind is strong or shifting."],
  "Aumentar sombra y cobertura": ["Increase shade and cover", "Keep shade trees in agroforestry systems and pastures to lower ground temperature and slow fuel drying."],
  "Trabajar en horas frescas": ["Work in cooler hours", "Schedule field work early in the morning and reinforce patrols around midday."],
  "Vigilancia preventiva": ["Preventive watch", "Check firebreaks, locate water sources and share the risk status with the community."],
  "Restringir el uso del fuego": ["Restrict the use of fire", "Avoid agricultural and pasture burning. If unavoidable, check current regulations and notify the local authority (municipality, INAB or CONAP)."],
  "Activar brigadas y alerta comunitaria": ["Activate brigades and community alert", "Ban burning, activate local brigades and keep in touch with firefighters, CONRED and CONAP/INAB."],
  "Alerta máxima": ["Maximum alert", "Suspend all burning. Keep brigades and equipment ready, watch protected areas and prepare evacuation routes and community warnings."],
  "Mantener el ambiente en equilibrio": ["Keep the environment in balance", "Conditions are stable. Use this time to open firebreaks, remove fuel and train brigades before the dry season (November to May)."],
};

/* ---------------------------------------------------------------
   Estado de la interfaz
---------------------------------------------------------------- */
const S = { lang: "es", tab: "mapa", vista: "hex", di: 0, sel: null, sonando: false };
let ESTADO, DIARIO, RANGOS, CONTORNO;
let HOY = 0, PICO = 0, HEX = [], MARCAS = {};
const DETALLES = {};        // caché de /api/departamento/<id>
let accionHoy = null, reloj = null, mapaSat = null, capaSat = null;
const t = () => T[S.lang];

/* ---------------------------------------------------------------
   Utilidades
---------------------------------------------------------------- */
async function api(url) {
  const r = await fetch(url);
  if (r.status === 503) throw new Error("NO_LISTO");
  if (!r.ok) throw new Error(url + " → " + r.status);
  return r.json();
}
const fecha = (iso) => new Date(iso + "T12:00:00");
function fCorta(i) { const d = fecha(DIARIO.fechas[i]); return S.lang === "es" ? `${d.getDate()} ${t().months[d.getMonth()]}` : `${t().months[d.getMonth()]} ${d.getDate()}`; }
function fLarga(i) { const d = fecha(DIARIO.fechas[i]); return S.lang === "es" ? `${t().dow[d.getDay()]} ${d.getDate()} de ${t().monthsL[d.getMonth()]}` : `${t().dow[d.getDay()]}, ${t().monthsL[d.getMonth()]} ${d.getDate()}`; }
function fIso(iso) { const d = fecha(iso); return S.lang === "es" ? `${d.getDate()} ${t().months[d.getMonth()]}` : `${t().months[d.getMonth()]} ${d.getDate()}`; }
const riesgo = (id, i) => Math.round(DIARIO.departamentos[id][i] * 100);   // 0–100
const nombreNivel = (n) => (S.lang === "es" ? n : NIVEL_EN[n] || n);
function nivel(r100) {
  const r = r100 / 100;
  for (const n of DIARIO.umbrales_nivel) if (r < n.hasta) return n.nombre;
  return DIARIO.umbrales_nivel[DIARIO.umbrales_nivel.length - 1].nombre;
}

/* Escala de 3 colores: bosque (0) → menta (14) → lima (30 o más) */
const RAMPA = [[0, [36, 78, 49]], [14, [155, 227, 174]], [30, [212, 242, 122]]];
function color(v) {
  for (let i = 1; i < RAMPA.length; i++) {
    if (v <= RAMPA[i][0]) {
      const [a, ca] = RAMPA[i - 1], [b, cb] = RAMPA[i], k = (v - a) / (b - a);
      return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * k)).join(",")})`;
    }
  }
  return "rgb(212,242,122)";
}

/* ---------------------------------------------------------------
   Carga inicial
---------------------------------------------------------------- */
async function esperarDatos() {
  for (;;) {
    const s = await (await fetch("/api/status")).json();
    $("#progreso-barra").style.width = Math.max(3, (100 * s.cargados) / s.total) + "%";
    $("#progreso-txt").textContent = t().loadingProg(s.cargados, s.total);
    if (s.listo) return;
    await new Promise((r) => setTimeout(r, 800));
  }
}

async function init() {
  try {
    await esperarDatos();
    [ESTADO, DIARIO, RANGOS, CONTORNO] = await Promise.all([api("/api/estado"), api("/api/riesgo_diario"), api("/api/rangos"), api("/api/contorno")]);
  } catch (e) {
    $("#progreso-txt").textContent = t().loadErr;
    console.error(e);
    return;
  }
  // Índice de "hoy" en la serie y día más crítico de los próximos días
  HOY = DIARIO.fechas.indexOf(ESTADO.hoy);
  if (HOY < 0) HOY = DIARIO.tipos.lastIndexOf("obs");
  PICO = HOY;
  for (let i = HOY; i < DIARIO.fechas.length; i++) if (DIARIO.nacional_maximo[i] > DIARIO.nacional_maximo[PICO]) PICO = i;
  S.di = HOY;

  construirHexagonos();
  conectarEventos();
  cargarAccionHoy();
  $("#cargando").hidden = true;
  pintarTodo();
}

/* ---------------------------------------------------------------
   Mapa de hexágonos
   Cada hexágono toma el riesgo de los departamentos cercanos
   (interpolación IDW: los más cercanos pesan más).
---------------------------------------------------------------- */
const LON0 = -92.35, LON1 = -88.10, LAT0 = 13.60, LAT1 = 17.95, ANCHO = 94.2, ALTO = 100;
const px = (lon) => ((lon - LON0) / (LON1 - LON0)) * ANCHO;
const py = (lat) => ((LAT1 - lat) / (LAT1 - LAT0)) * ALTO;

function dentro(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function construirHexagonos() {
  const poly = CONTORNO.contorno.map(([lat, lon]) => [px(lon), py(lat)]);
  const deps = ESTADO.departamentos.map((d) => ({ id: d.id, x: px(d.lon), y: py(d.lat) }));
  const r = 1.45, w = Math.sqrt(3) * r, h = 1.5 * r, NS = "http://www.w3.org/2000/svg";
  const svg = $("#hex-svg");
  for (let fila = 0, y = 0; y <= ALTO; fila++, y += h) {
    for (let x = fila % 2 ? w / 2 : 0; x <= ANCHO; x += w) {
      if (!dentro(x, y, poly)) continue;
      const pts = [0, 1, 2, 3, 4, 5].map((k) => {
        const a = (Math.PI / 180) * (60 * k - 30);
        return `${(x + r * 0.92 * Math.cos(a)).toFixed(2)},${(y + r * 0.92 * Math.sin(a)).toFixed(2)}`;
      }).join(" ");
      const el = document.createElementNS(NS, "polygon");
      el.setAttribute("points", pts);
      svg.appendChild(el);
      // pesos IDW precalculados: así cambiar de fecha es solo una suma
      let total = 0;
      const pesos = deps.map((d) => { const p = 1 / Math.pow((d.x - x) ** 2 + (d.y - y) ** 2 + 0.5, 1.6); total += p; return [d.id, p]; });
      HEX.push({ el, pesos: pesos.map(([id, p]) => [id, p / total]) });
    }
  }
  // Marcadores de departamento (botones reales: se pueden tocar y usar con teclado)
  const cont = $("#hex-marcadores"), etiquetas = [];
  for (const d of ESTADO.departamentos) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "marcador";
    b.style.left = (px(d.lon) / ANCHO) * 100 + "%"; b.style.top = py(d.lat) + "%";
    b.innerHTML = "<span></span>";
    b.addEventListener("click", () => seleccionar(d.id));
    const e = document.createElement("span");
    e.className = "etiqueta"; e.style.left = b.style.left; e.style.top = b.style.top; e.hidden = true;
    cont.append(b);
    etiquetas.push(e);
    MARCAS[d.id] = { b, e, nombre: d.nombre };
  }
  cont.append(...etiquetas);   // las etiquetas van al final para quedar encima de los puntos
}

function pintarHexagonos() {
  for (const hx of HEX) {
    let v = 0;
    for (const [id, p] of hx.pesos) v += p * riesgo(id, S.di);
    hx.el.setAttribute("fill", color(v));
  }
  const orden = ESTADO.departamentos.map((d) => [riesgo(d.id, S.di), d.id]).sort((a, b) => b[0] - a[0]);
  const top1 = orden[0] && orden[0][0] > 0 ? orden[0][1] : null;   // solo el más expuesto lleva nombre
  for (const d of ESTADO.departamentos) {
    const m = MARCAS[d.id], r = riesgo(d.id, S.di), sel = S.sel === d.id;
    m.b.style.setProperty("--c", color(r + 4));
    m.b.style.setProperty("--t", 12 + Math.round(r * 0.3) + "px");
    m.b.setAttribute("aria-pressed", sel ? "true" : "false");
    m.b.setAttribute("aria-label", `${d.nombre}: ${t().riskWord} ${r} (${nombreNivel(nivel(r))})`);
    m.e.hidden = !(sel || (!S.sel && d.id === top1));
    m.e.innerHTML = `${esc(d.nombre)} <b>${r}</b>`;
  }
}

/* ---------------------------------------------------------------
   Vista satelital (NASA GIBS): se crea solo la primera vez
---------------------------------------------------------------- */
function gibs(capa, f, nivelZoom, ext) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${capa}/default/${f}/GoogleMapsCompatible_Level${nivelZoom}/{z}/{y}/{x}.${ext}`;
}
function pintarSatelite() {
  if (typeof L === "undefined") return;
  if (!mapaSat) {
    const attr = 'Imágenes: <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a> · VIIRS ' + ESTADO.fecha_imagenes;
    mapaSat = L.map("satmapa", { zoomSnap: 0.25, minZoom: 6, attributionControl: true });
    L.tileLayer(gibs("VIIRS_SNPP_CorrectedReflectance_TrueColor", ESTADO.fecha_imagenes, 9, "jpg"), { maxNativeZoom: 9, maxZoom: 12, attribution: attr }).addTo(mapaSat);
    L.tileLayer(gibs("VIIRS_SNPP_Thermal_Anomalies_375m_All", ESTADO.fecha_imagenes, 9, "png"), { maxNativeZoom: 9, maxZoom: 12, opacity: 0.95 }).addTo(mapaSat);
    L.polygon(CONTORNO.contorno, { color: "#D4F27A", weight: 2, fill: false, interactive: false }).addTo(mapaSat);
    capaSat = L.layerGroup().addTo(mapaSat);
    mapaSat.fitBounds([[13.6, -92.4], [17.9, -88.1]]);
  }
  setTimeout(() => mapaSat.invalidateSize(), 50);
  capaSat.clearLayers();
  for (const d of ESTADO.departamentos) {
    const r = riesgo(d.id, S.di);
    L.circleMarker([d.lat, d.lon], { radius: 7 + r * 0.2, color: "#0D1F14", weight: 2, fillColor: color(r + 4), fillOpacity: 1 })
      .bindTooltip(`${esc(d.nombre)} · ${r}`).on("click", () => seleccionar(d.id)).addTo(capaSat);
  }
}

/* ---------------------------------------------------------------
   Bloques del bento
---------------------------------------------------------------- */
function pintarNacional() {
  const media = Math.round(DIARIO.nacional_media[S.di] * 100);
  const altos = ESTADO.departamentos.filter((d) => riesgo(d.id, S.di) >= 35).length;
  $("#nac-etq").textContent = `${t().kNational} · ${fCorta(S.di)}`;
  $("#nac-nivel").textContent = nombreNivel(nivel(media));
  $("#nac-sub").textContent = t().ofHigh(altos);
  // Día más crítico de los próximos 45 días
  const max = DIARIO.nacional_maximo[PICO];
  const dep = ESTADO.departamentos.find((d) => DIARIO.departamentos[d.id][PICO] === max);
  $("#pico-fecha").textContent = fCorta(PICO);
  $("#btn-pico").textContent = `${dep ? dep.nombre : ""} · ${Math.round(max * 100)} →`;
}

function pintarLineaTiempo() {
  const cont = $("#barras");
  if (!cont.children.length) {
    DIARIO.fechas.forEach((f, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.innerHTML = "<span></span>";
      if (i === HOY) b.classList.add("hoy");
      b.addEventListener("click", () => irA(i));
      cont.appendChild(b);
    });
  }
  [...cont.children].forEach((b, i) => {
    const v = Math.round(DIARIO.nacional_maximo[i] * 100), sel = i === S.di;
    const s = b.firstChild;
    s.style.height = Math.max(6, Math.min(100, 8 + v * 2.6)) + "%";
    s.style.background = color(v + 4);
    s.style.opacity = sel ? 1 : DIARIO.tipos[i] === "pred" ? 0.45 : 0.8;
    s.style.outline = sel ? "2px solid #EAF5EC" : "none";
    b.setAttribute("aria-label", `${fCorta(i)}: ${t().riskWord} ${v}`);
    b.setAttribute("aria-pressed", sel ? "true" : "false");
  });
  const tipo = DIARIO.tipos[S.di] === "pred" ? t().forecast : t().observed;
  $("#tl-fecha").textContent = `${fLarga(S.di)} · ${tipo}`;
  $("#mapa-fecha").textContent = `${tipo} · ${fCorta(S.di)}`;
  $("#tl-ini").textContent = fCorta(0);
  $("#tl-fin").textContent = fCorta(DIARIO.fechas.length - 1);
}

function pintarPanel() {
  const a = $("#tile-a"), b = $("#tile-b");
  if (!S.sel) {
    a.classList.remove("desplazable"); b.classList.remove("desplazable");
    const orden = ESTADO.departamentos.map((d) => [riesgo(d.id, S.di), d]).sort((x, y) => y[0] - x[0]).slice(0, 5);
    a.innerHTML = `<span class="etq suave">${t().rankTitle} · ${fCorta(S.di)}</span>
      <ol class="lista">${orden.map(([r, d]) => `<li><button type="button" class="fila" data-dep="${d.id}"><span>${esc(d.nombre)}</span><b>${r}</b></button></li>`).join("")}</ol>`;
    const acc = traducirPlan(accionHoy) || { t: t().maintenanceT, d: t().maintenanceD };
    b.innerHTML = `<span class="etq">${t().actionToday}</span><span class="accion-titulo">${esc(acc.t)}</span><span>${esc(acc.d)}</span>`;
    return;
  }
  const d = ESTADO.departamentos.find((x) => x.id === S.sel), det = DETALLES[S.sel], r = riesgo(S.sel, S.di);
  a.classList.add("desplazable"); b.classList.add("desplazable");
  a.innerHTML = `<div class="cab-detalle"><div><h2>${esc(d.nombre)}</h2><p class="sub">${nombreNivel(nivel(r))} · <b class="lima">${r}</b> · ${d.elev} m</p></div>
      <button type="button" class="btn-cerrar" id="btn-cerrar" aria-label="${t().close}"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="#EAF5EC" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>
    ${det ? `<span class="nota">${t().varsTitle} · ${fIso(det.fecha_dato)}</span>
      <ul class="lista">${det.variables.map(filaVariable).join("")}</ul>` : `<p class="sub">…</p>`}`;
  b.innerHTML = `<span class="etq">${t().planTitle}</span>${det ? det.plan.map((p) => { const x = traducirPlan(p); return `<div class="plan-item"><h3>${esc(x.t)}</h3><p>${esc(x.d)}</p></div>`; }).join("") : "<p>…</p>"}`;
  $("#btn-cerrar").addEventListener("click", () => seleccionar(null));
}

function filaVariable(v) {
  let val;
  if (v.clave === "soil") val = v.actual.toFixed(2);
  else if (v.clave === "dias_sin_lluvia") val = `${Math.round(v.actual)} ${t().days}`;
  else if (v.clave === "precip15") val = `${Math.round(v.actual)} mm`;
  else val = `${v.actual.toFixed(1)} ${v.unidad}`;
  // estable = menta · vigilancia = lima con borde · crítico = lima sólido
  const punto = v.estado === "estable" ? "background:#9BE3AE" : v.estado === "vigilancia" ? "border:2px solid #D4F27A" : "background:#D4F27A";
  const nombre = S.lang === "es" ? VAR_ES[v.clave] || v.nombre : (VAR_EN[v.clave] || [v.nombre])[0];
  return `<li class="fila-var"><span>${esc(nombre)}</span><span class="val"><span>${esc(val)}</span><span class="punto" style="${punto}" aria-hidden="true"></span><span class="estado">${t().states[v.estado] || v.estado}</span></span></li>`;
}

function traducirPlan(p) {
  if (!p) return null;
  if (S.lang === "es" || !PLAN_EN[p.titulo]) return { t: p.titulo, d: p.detalle };
  return { t: PLAN_EN[p.titulo][0], d: PLAN_EN[p.titulo][1] };
}

async function cargarAccionHoy() {
  // Acción sugerida: la de mayor prioridad del departamento más expuesto hoy
  const top = ESTADO.departamentos.slice().sort((a, b) => b.riesgo - a.riesgo)[0];
  try {
    const det = await api("/api/departamento/" + top.id);
    DETALLES[top.id] = det;
    accionHoy = det.plan.find((p) => p.prioridad !== "Nivel de alerta") || det.plan[0] || null;
  } catch (e) { accionHoy = null; }
  if (!S.sel && S.tab === "mapa") pintarPanel();
}

/* ---------------------------------------------------------------
   Calendario
---------------------------------------------------------------- */
function pintarCalendario() {
  const serie = S.sel ? DIARIO.departamentos[S.sel] : DIARIO.nacional_maximo;
  const nombre = S.sel ? ESTADO.departamentos.find((d) => d.id === S.sel).nombre : t().calScopeNat;
  $("#cal-alcance").textContent = nombre;
  $("#cal-semana").innerHTML = t().weekdays.map((d) => `<span>${d}</span>`).join("");
  const vacios = (fecha(DIARIO.fechas[0]).getDay() + 6) % 7;     // la semana empieza el lunes
  let html = "<span></span>".repeat(vacios);
  DIARIO.fechas.forEach((f, i) => {
    const v = Math.round(serie[i] * 100), d = fecha(f);
    const cls = ["cal-celda", DIARIO.tipos[i] === "pred" ? "pred" : "", i === HOY ? "hoy" : "", i === S.di ? "sel" : ""].join(" ");
    const lab = d.getDate() === 1 || i === 0 ? fCorta(i) : d.getDate();
    html += `<button type="button" class="${cls}" style="background:${color(v + 2)}" data-dia="${i}" aria-label="${esc(fLarga(i))}: ${t().riskWord} ${v}"><small>${lab}</small><strong>${v}</strong></button>`;
  });
  $("#cal-grid").innerHTML = html;
  const futuros = [];
  for (let i = HOY; i < DIARIO.fechas.length; i++) futuros.push(i);
  futuros.sort((a, b) => serie[b] - serie[a]);
  $("#cal-top").innerHTML = futuros.slice(0, 5).map((i) => `<li><button type="button" class="fila" data-dia="${i}"><span>${esc(fLarga(i))}</span><b>${Math.round(serie[i] * 100)}</b></button></li>`).join("");
  $("#cal-dia-etq").textContent = t().dayTop(fCorta(S.di));
  const orden = ESTADO.departamentos.map((d) => [riesgo(d.id, S.di), d.nombre]).sort((a, b) => b[0] - a[0]).slice(0, 5);
  $("#cal-dia").innerHTML = orden.map(([r, n]) => `<li><span class="fila"><span>${esc(n)}</span><b>${r}</b></span></li>`).join("");
}

/* ---------------------------------------------------------------
   Método
---------------------------------------------------------------- */
function pintarMetodo() {
  $("#met-vars").innerHTML = RANGOS.variables.map((v) => {
    const bajoMalo = v.estable > v.critico;     // p. ej. humedad: menos es peor
    const u = v.unidad ? " " + (v.unidad === "días" ? t().days : v.unidad) : "";
    const est = `${bajoMalo ? "≥" : "≤"} ${v.estable}${u}${v.clave === "tmax" ? "*" : ""}`;
    const cri = `${bajoMalo ? "≤" : "≥"} ${v.critico}${u}${v.clave === "tmax" ? "*" : ""}`;
    const en = VAR_EN[v.clave];
    const nombre = S.lang === "es" || !en ? v.nombre : en[0];
    const porque = S.lang === "es" || !en ? v.regla : en[1];
    return `<section class="tile met-var"><div class="cab"><span>${esc(nombre)}</span><span class="peso">${Math.round(v.peso * 100)}%</span></div>
      <div class="chips"><span class="chip chip-menta">${t().stable} ${esc(est)}</span><span class="chip chip-lima">${t().critical} ${esc(cri)}</span></div><p>${esc(porque)}</p></section>`;
  }).join("");
}

/* ---------------------------------------------------------------
   Acciones del usuario
---------------------------------------------------------------- */
function irA(i) { S.di = Math.max(0, Math.min(DIARIO.fechas.length - 1, i)); pintarTodo(); }

async function seleccionar(id) {
  S.sel = id;
  if (id && S.tab !== "mapa") cambiarPestana("mapa");
  pintarTodo();
  if (id && !DETALLES[id]) {
    try { DETALLES[id] = await api("/api/departamento/" + id); } catch (e) { console.error(e); }
    if (S.sel === id) pintarPanel();
  }
}

function cambiarPestana(tab) {
  S.tab = tab;
  $$(".pestanas button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tab === tab ? "true" : "false"));
  $("#vista-mapa").hidden = tab !== "mapa";
  $("#vista-cal").hidden = tab !== "cal";
  $("#vista-met").hidden = tab !== "met";
  pintarTodo();
}

function cambiarVista(v) {
  S.vista = v;
  $$(".segmento button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.vista === v ? "true" : "false"));
  $("#hexmapa").hidden = v !== "hex";
  $("#satmapa").hidden = v !== "sat";
  $("#nota-mapa").textContent = v === "hex" ? t().interp : t().satNote(fIso(ESTADO.fecha_imagenes));
  pintarTodo();
}

function alternarPlay() {
  const btn = $("#btn-play");
  if (reloj) { clearInterval(reloj); reloj = null; btn.classList.remove("sonando"); btn.setAttribute("aria-label", t().play); return; }
  if (S.di >= DIARIO.fechas.length - 1) S.di = 0;
  btn.classList.add("sonando"); btn.setAttribute("aria-label", t().pause);
  reloj = setInterval(() => {
    if (S.di >= DIARIO.fechas.length - 1) { alternarPlay(); return; }
    irA(S.di + 1);
  }, 220);
}

function conectarEventos() {
  $$(".pestanas button").forEach((b) => b.addEventListener("click", () => cambiarPestana(b.dataset.tab)));
  $$(".segmento button").forEach((b) => b.addEventListener("click", () => cambiarVista(b.dataset.vista)));
  $("#btn-play").addEventListener("click", alternarPlay);
  $("#btn-hoy").addEventListener("click", () => irA(HOY));
  $("#btn-pico").addEventListener("click", () => { S.sel = null; irA(PICO); });
  $("#btn-ver-mapa").addEventListener("click", () => cambiarPestana("mapa"));
  $("#btn-idioma").addEventListener("click", () => { S.lang = S.lang === "es" ? "en" : "es"; traducir(); pintarTodo(); });
  // Delegación: un solo "escuchador" para botones creados dinámicamente
  document.addEventListener("click", (e) => {
    const dep = e.target.closest("[data-dep]");
    if (dep) seleccionar(dep.dataset.dep);
    const dia = e.target.closest("[data-dia]");
    if (dia && dia.tagName === "BUTTON") irA(+dia.dataset.dia);
  });
}

/* ---------------------------------------------------------------
   Traducción de textos fijos y pintado general
---------------------------------------------------------------- */
function traducir() {
  document.documentElement.lang = S.lang;
  $$("[data-i18n]").forEach((el) => { const v = t()[el.dataset.i18n]; if (typeof v === "string") el.textContent = v; });
  const bi = $("#btn-idioma");
  bi.textContent = t().langBtn; bi.setAttribute("aria-label", t().langLabel);
  $("#btn-play").setAttribute("aria-label", reloj ? t().pause : t().play);
  $("#nota-mapa").textContent = S.vista === "hex" ? t().interp : t().satNote(fIso(ESTADO.fecha_imagenes));
}

function pintarTodo() {
  // Pie con la fuente de los datos y aviso si hay datos simulados
  $("#pie-fuente").textContent = t().source(fIso(ESTADO.ultimo_dato));
  const sim = (ESTADO.fuentes && ESTADO.fuentes.SIMULADO) || 0;
  $("#aviso").hidden = !sim;
  if (sim) $("#aviso").textContent = t().simWarn(sim);

  if (S.tab === "mapa") {
    if (S.vista === "hex") pintarHexagonos(); else pintarSatelite();
    pintarNacional(); pintarLineaTiempo(); pintarPanel();
  } else if (S.tab === "cal") {
    pintarCalendario();
  } else {
    pintarMetodo();
  }
}

traducir.inicial = () => $$("[data-i18n]").forEach((el) => { const v = T.es[el.dataset.i18n]; if (typeof v === "string" && !el.textContent.trim()) el.textContent = v; });
traducir.inicial();
init();
