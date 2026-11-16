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
    mapTitle: "Focos de calor", viewRisk: "Riesgo", viewSat: "Satélite", riskScale: "Riesgo (0–100)",
    interp: "Interpolado de 22 puntos", satNote: (f) => `VIIRS · ${f}`,
    observed: "Observado", forecast: "Pronóstico", obsPred: "Observado · Pronóstico", today: "Hoy",
    kNational: "Nivel nacional", ofHigh: (n) => `${n}/22 en riesgo alto`, kPeak: "Día más crítico",
    timelineHelp: "Toque una barra o presione play para recorrer el tiempo", play: "Reproducir línea de tiempo", pause: "Pausar",
    rankTitle: "Más expuestos", actionToday: "Acción de hoy", varsTitle: "Variables", planTitle: "Plan de prevención", close: "Cerrar detalle",
    maintenanceT: "Abrir rondas cortafuego antes de la época seca", maintenanceD: "Las condiciones son estables: es el momento de retirar combustible y capacitar brigadas.",
    searchLabel: "Buscar departamento o municipio", searchBtn: "Buscar",
    searchPh: "Buscar lugar",
    calTitle: "Calendario de riesgo", calScopeNat: "Nacional (máximo por día)", calLegend: "Borde punteado = pronóstico · Borde blanco = hoy · Número = riesgo (0–100)",
    topDates: "Fechas más críticas", seeOnMap: "Ver en el mapa →", dayTop: (d) => `Más vulnerables el ${d}`,
    metTitle: "¿Cuándo está el ambiente en estado estable?",
    metHelp: "El modelo es un índice de peligro transparente. Cada variable recibe un puntaje de 0 (rango estable) a 1 (nivel crítico); se ponderan y se ajustan por la presión de quemas humanas de cada mes. Los umbrales son valores de partida que deben calibrarse con INSIVUMEH, CONAP e INAB.",
    formulaLabel: "Cómo se calcula", formula: "riesgo = Σ peso × puntaje × (0.85 + 0.15 × factor de ignición del mes)",
    metNote: "La temperatura estable y crítica se ajusta por la altitud de cada departamento.", stable: "Estable", critical: "Crítico",
    footer: "Herramienta de apoyo a la decisión. Las alertas oficiales y las prohibiciones de quemas provienen de CONRED, CONAP, INAB, MARN y las municipalidades.",
    source: (f) => `Datos: NASA POWER (clima diario, último dato ${f}; NASA lo publica con 2–3 días de retraso y el modelo estima los días siguientes) · NASA FIRMS (focos MODIS y VIIRS de las últimas 24 h) · NASA GIBS (imágenes).`,
    staleWarn: (f) => `Clima sin actualizar · último dato ${f}`,
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
    mapTitle: "Hotspots", viewRisk: "Risk", viewSat: "Satellite", riskScale: "Risk (0–100)",
    interp: "Interpolated from 22 points", satNote: (f) => `VIIRS · ${f}`,
    observed: "Observed", forecast: "Forecast", obsPred: "Observed · Forecast", today: "Today",
    kNational: "National level", ofHigh: (n) => `${n}/22 at high risk`, kPeak: "Peak day",
    timelineHelp: "Tap a bar or press play to move through time", play: "Play timeline", pause: "Pause",
    rankTitle: "Most exposed", actionToday: "Today's action", varsTitle: "Variables", planTitle: "Prevention plan", close: "Close details",
    maintenanceT: "Open firebreaks before the dry season", maintenanceD: "Conditions are stable: now is the time to remove fuel and train fire brigades.",
    searchLabel: "Search department or municipality", searchBtn: "Search",
    searchPh: "Search place",
    calTitle: "Risk calendar", calScopeNat: "National (daily maximum)", calLegend: "Dashed border = forecast · White border = today · Number = risk (0–100)",
    topDates: "Most critical dates", seeOnMap: "Show on map →", dayTop: (d) => `Most vulnerable on ${d}`,
    metTitle: "When is the environment stable?",
    metHelp: "The model is a transparent danger index. Each variable scores from 0 (stable range) to 1 (critical level); scores are weighted and adjusted by the monthly pressure of human burning. Thresholds are starting values to be calibrated with INSIVUMEH, CONAP and INAB.",
    formulaLabel: "How it is calculated", formula: "risk = Σ weight × score × (0.85 + 0.15 × monthly ignition factor)",
    metNote: "Stable and critical temperatures are adjusted by each department's elevation.", stable: "Stable", critical: "Critical",
    footer: "Decision-support tool. Official alerts and burning bans come from CONRED, CONAP, INAB, MARN and municipalities.",
    source: (f) => `Data: NASA POWER (daily climate, latest ${f}; NASA publishes it with a 2–3 day lag and the model estimates the following days) · NASA FIRMS (MODIS and VIIRS hotspots of the last 24 h) · NASA GIBS (imagery).`,
    staleWarn: (f) => `Climate not updated · latest ${f}`,
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
const S = { lang: "es", tab: "mapa", vista: "sat", di: 0, sel: null, sonando: false, mes: null };
let ESTADO, DIARIO, RANGOS, CONTORNO;
let HOY = 0, PICO = 0, HEX = [], MARCAS = {};
const DETALLES = {};        // caché de /api/departamento/<id>
let accionHoy = null, reloj = null, mapaSat = null, capaSat = null;
let mapaHistorico = null;
let capaHistorica = null;
let deteccionesHistoricas = [];
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

/* Escala de riesgo: verde (0) → amarillo (25) → rojo (50 o más). Coincide con los niveles del modelo:
   Bajo < 20, Moderado < 35, Alto < 50, Muy alto y Extremo en rojo. */
const RAMPA = [[0, [36, 78, 49]], [15, [155, 227, 174]], [30, [212, 242, 122]]];   // bosque → menta → lima
function colorRGB(v) {
  for (let i = 1; i < RAMPA.length; i++) {
    if (v <= RAMPA[i][0]) {
      const [a, ca] = RAMPA[i - 1], [b, cb] = RAMPA[i], k = Math.max(0, (v - a) / (b - a));
      return ca.map((c, j) => Math.round(c + (cb[j] - c) * k));
    }
  }
  return RAMPA[RAMPA.length - 1][1];
}
function color(v) { return `rgb(${colorRGB(v).join(",")})`; }
/* Escala de calor para la línea de tiempo: ámbar (bajo) → naranja → rojo (alto).
   Mismos umbrales que los niveles del modelo: 35 = alto, 50+ = muy alto. */
const CALOR = [[0, [251, 191, 36]], [20, [249, 115, 22]], [35, [234, 88, 12]], [50, [220, 38, 38]]];
function colorCalor(v) {
  for (let i = 1; i < CALOR.length; i++) {
    if (v <= CALOR[i][0]) {
      const [a, ca] = CALOR[i - 1], [b, cb] = CALOR[i], k = Math.max(0, (v - a) / (b - a));
      return `rgb(${ca.map((c, n) => Math.round(c + (cb[n] - c) * k)).join(",")})`;
    }
  }
  return "rgb(220,38,38)";
}
/* texto oscuro o blanco, según el brillo del fondo */
function textoSobre(v) {
  const [r, g, b] = colorRGB(v);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#11240F" : "#EAF5EC";
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
    if (s.error && !s.cargando) {
      $("#progreso-txt").innerHTML = `<strong>No se pudieron obtener datos reales de la NASA.</strong><br>${esc(s.error)}<br>` +
        `<small>La aplicación no inventa datos. Revise su conexión a internet; se reintenta automáticamente.</small>`;
    }
    await new Promise((r) => setTimeout(r, s.error ? 5000 : 800));
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
  cargarFocos();
  setInterval(() => cargarFocos(true), 10 * 60 * 1000);   // se actualiza solo cada 10 min
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
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${capa}/default/${f || "default"}/GoogleMapsCompatible_Level${nivelZoom}/{z}/{y}/{x}.${ext}`;
}
let capaFocosViirs = null, capaFocosModis = null, FOCOS = null, focosError = null;

function pintarSatelite() {
  if (typeof L === "undefined") {
    $("#satmapa").innerHTML = '<p class="sub" style="padding:16px">No se pudo cargar el mapa (Leaflet). Revise su conexión a internet.</p>';
    return;
  }
  if (!mapaSat) {
    const f = ESTADO.fecha_imagenes;
    const attr = 'Imágenes: <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a> · Focos: <a href="https://firms.modaps.eosdis.nasa.gov/">NASA FIRMS</a>';
    mapaSat = L.map("satmapa", { zoomSnap: 0.25, minZoom: 6, attributionControl: true });
    // Redibuja el mapa cuando su bloque cambia de tamaño (evita franjas negras)
    if (window.ResizeObserver) new ResizeObserver(() => mapaSat.invalidateSize()).observe($("#satmapa"));
    mapaSat.createPane("deps"); mapaSat.getPane("deps").style.zIndex = 450;
    mapaSat.createPane("focos"); mapaSat.getPane("focos").style.zIndex = 460;
    // Capas base de NASA GIBS (+ calles). Inicia con MODIS Terra color real.
    const terra = L.tileLayer(gibs("MODIS_Terra_CorrectedReflectance_TrueColor", f, 9, "jpg"), { maxNativeZoom: 9, maxZoom: 12, attribution: attr + " · MODIS Terra " + f });
    const viirs = L.tileLayer(gibs("VIIRS_SNPP_CorrectedReflectance_TrueColor", f, 9, "jpg"), { maxNativeZoom: 9, maxZoom: 12, attribution: attr + " · VIIRS " + f });
    const relieve = L.tileLayer(gibs("BlueMarble_ShadedRelief_Bathymetry", null, 8, "jpeg"), { maxNativeZoom: 8, maxZoom: 12, attribution: attr });
    const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" });
    viirs.addTo(mapaSat);   // VIIRS por defecto: cubre todo el país sin franjas negras (MODIS deja huecos entre pasadas)
    capaFocosViirs = L.layerGroup().addTo(mapaSat);
    capaFocosModis = L.layerGroup().addTo(mapaSat);
    capaSat = L.layerGroup();                       // riesgo por departamento (opcional)
    L.control.layers(
      { "Satélite VIIRS (color real)": viirs, "Satélite MODIS Terra (color real)": terra, "Relieve (NASA Blue Marble)": relieve, "Calles (OpenStreetMap)": osm },
      { "Focos VIIRS · últimas 24 h": capaFocosViirs, "Focos MODIS · últimas 24 h": capaFocosModis, "Riesgo por departamento": capaSat },
      { collapsed: true }
    ).addTo(mapaSat);
    mapaSat.fitBounds([[13.6, -92.4], [17.9, -88.1]]);
    pintarFocos();
  }
  setTimeout(() => mapaSat.invalidateSize(), 50);
  capaSat.clearLayers();
  for (const d of ESTADO.departamentos) {
    const r = riesgo(d.id, S.di);
    L.circleMarker([d.lat, d.lon], { pane: "deps", radius: 7 + r * 0.12, color: "#0D1F14", weight: 2, fillColor: color(r + 2), fillOpacity: 1 })
      .bindTooltip(`${esc(d.nombre)} · ${t().riskWord} ${r}`).on("click", () => seleccionar(d.id)).addTo(capaSat);
  }
}

/* Focos de calor de las últimas 24 h (NASA FIRMS, MODIS + VIIRS) */
async function cargarFocos(forzar) {
  try {
    const r = await fetch("/api/focos_hoy" + (forzar ? "?forzar=1" : ""));
    const d = await r.json();
    if (!r.ok) {
      if (d.detalle) console.warn("FIRMS:", d.detalle);   // el detalle técnico va a la consola, no a la pantalla
      throw new Error(d.error || String(r.status));
    }
    FOCOS = d; focosError = null;
  } catch (e) { focosError = String(e.message || e); }
  pintarFocos();
}

const hhmm = (iso) => (iso ? iso.slice(11, 16) : "—");
function pintarFocos() {
  const el = $("#focos-estado");
  if (!el) return;
  if (focosError && !FOCOS) {
    el.className = "focos-estado mal";
    el.textContent = S.lang === "es" ? "Focos no disponibles" : "Hotspots unavailable";
  } else if (FOCOS) {
    const fallan = Object.entries(FOCOS.sensores).filter(([, v]) => !v.ok).map(([k]) => k);
    el.className = "focos-estado" + (FOCOS.desactualizado || fallan.length ? " aviso-leve" : "");
    el.textContent = `${FOCOS.total} ${S.lang === "es" ? "focos" : "hotspots"} · 24 h` + (FOCOS.desactualizado ? (S.lang === "es" ? " · sin actualizar" : " · not updated") : "");
  }
  if (!mapaSat || !FOCOS) return;
  capaFocosViirs.clearLayers(); capaFocosModis.clearLayers();
  const render = L.canvas({ pane: "focos", padding: 0.5 });
  for (const f of FOCOS.focos) {
    const viirs = f.sensor === "VIIRS", col = viirs ? "#FF6A00" : "#C026D3";   // alerta: VIIRS naranja, MODIS magenta
    L.circleMarker([f.lat, f.lon], { renderer: render, radius: viirs ? 4.5 : 6, color: "#FFFFFF", weight: 1, fillColor: col, fillOpacity: f.hoy ? 0.95 : 0.55 })
      .bindTooltip(`<b>${f.sensor} · ${esc(f.sat)}</b><br>${f.local.slice(0, 10)} ${hhmm(f.local)} (hora GT)${f.frp != null ? `<br>FRP ${f.frp} MW` : ""}${f.conf ? `<br>confianza ${esc(f.conf)}` : ""}`)
      .addTo(viirs ? capaFocosViirs : capaFocosModis);
  }
}

/* ---------------------------------------------------------------
   Bloques del bento
---------------------------------------------------------------- */
function pintarNacional() {
  const media = Math.round(DIARIO.nacional_media[S.di] * 100);
  const altos = ESTADO.departamentos.filter((d) => riesgo(d.id, S.di) >= 35).length;
  $("#nac-etq").textContent = t().kNational;
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
    s.style.background = colorCalor(v);
    s.style.opacity = sel ? 1 : DIARIO.tipos[i] === "pred" ? 0.7 : 0.95;
    s.style.outline = sel ? "2px solid #EAF5EC" : "none";
    b.setAttribute("aria-label", `${fCorta(i)}: ${t().riskWord} ${v}`);
    b.setAttribute("aria-pressed", sel ? "true" : "false");
  });
  const tipo = DIARIO.tipos[S.di] === "pred" ? t().forecast : t().observed;
  $("#tl-fecha").textContent = `${fCorta(S.di)} · ${tipo}`;
  $("#mapa-fecha").textContent = `${tipo} · ${fCorta(S.di)}`;
  $("#tl-ini").textContent = fCorta(0);
  $("#tl-fin").textContent = fCorta(DIARIO.fechas.length - 1);
}

function pintarPanel() {
  const a = $("#tile-a"), b = $("#tile-b");
  if (!S.sel) {
    a.classList.remove("desplazable"); b.classList.remove("desplazable");
    const orden = ESTADO.departamentos.map((d) => [riesgo(d.id, S.di), d]).sort((x, y) => y[0] - x[0]).slice(0, 3);
    a.innerHTML = `<span class="etq-rank">${t().rankTitle}</span>
      <ol class="lista ranking">${orden.map(([r, d], i) => `<li><button type="button" class="fila fila-rank" data-dep="${d.id}"><span>${esc(d.nombre)}</span><b class="rk rk-${Math.min(i, 2)}">${r}</b></button></li>`).join("")}</ol>`;
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
  // estable = verde · vigilancia = amarillo · crítico = rojo
  const punto = v.estado === "estable" ? "background:#2E9E4F" : v.estado === "vigilancia" ? "background:#FACC15" : "background:#DC2626";
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
const mesDe = (i) => { const d = fecha(DIARIO.fechas[i]); return { y: d.getFullYear(), m: d.getMonth() }; };
let IDX_FECHA = null;

function pintarCalendario() {
  const serie = S.sel ? DIARIO.departamentos[S.sel] : DIARIO.nacional_maximo;
  const nombre = S.sel ? ESTADO.departamentos.find((d) => d.id === S.sel).nombre : t().calScopeNat;
  $("#cal-alcance").textContent = nombre;
  $("#cal-semana").innerHTML = t().weekdays.map((d) => `<span>${d}</span>`).join("");
  if (!IDX_FECHA) { IDX_FECHA = {}; DIARIO.fechas.forEach((f, i) => { IDX_FECHA[f] = i; }); }
  if (!S.mes) S.mes = mesDe(S.di);
  const { y, m } = S.mes, ini = mesDe(0), fin = mesDe(DIARIO.fechas.length - 1);
  const n = y * 12 + m;
  const nombreMes = t().monthsL[m];
  $("#cal-mes").textContent = (S.lang === "es" ? `${nombreMes} de ${y}` : `${nombreMes} ${y}`).replace(/^./, (c) => c.toUpperCase());
  $("#cal-prev").disabled = n <= ini.y * 12 + ini.m;
  $("#cal-next").disabled = n >= fin.y * 12 + fin.m;
  const vacios = (new Date(y, m, 1).getDay() + 6) % 7;           // la semana empieza el lunes
  const ndias = new Date(y, m + 1, 0).getDate();
  let html = "<span></span>".repeat(vacios);
  for (let dia = 1; dia <= ndias; dia++) {
    const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`, i = IDX_FECHA[iso];
    if (i === undefined) { html += `<span class="cal-celda vacia"><small>${dia}</small></span>`; continue; }
    const v = Math.round(serie[i] * 100);
    const cls = ["cal-celda", DIARIO.tipos[i] === "pred" ? "pred" : "", i === HOY ? "hoy" : "", i === S.di ? "sel" : ""].join(" ");
    html += `<button type="button" class="${cls}" style="background:${color(v + 2)};color:${textoSobre(v + 2)}" data-dia="${i}" aria-label="${esc(fLarga(i))}: ${t().riskWord} ${v}"><small>${dia}</small><strong>${v}</strong></button>`;
  }
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
      <div class="chips"><span class="chip chip-verde">${t().stable} ${esc(est)}</span><span class="chip chip-rojo">${t().critical} ${esc(cri)}</span></div><p>${esc(porque)}</p></section>`;
  }).join("");
}

/* ---------------------------------------------------------------
   Acciones del usuario
---------------------------------------------------------------- */
function irA(i) { S.di = Math.max(0, Math.min(DIARIO.fechas.length - 1, i)); S.mes = mesDe(S.di); pintarTodo(); }

async function seleccionar(id) {
  S.sel = id;
  if (id && S.tab !== "mapa") cambiarPestana("mapa");
  pintarTodo();
  if (id && !DETALLES[id]) {
    try { DETALLES[id] = await api("/api/departamento/" + id); } catch (e) { console.error(e); }
    if (S.sel === id) pintarPanel();
  }
}


function actualizarEstadisticasHistoricas() {
  const datos = deteccionesHistoricas;

  const total = datos.length;
  const modis = datos.filter(d => d.modis > 0).length;
  const viirs = datos.filter(d => d.viirs > 0).length;
  const ambos = datos.filter(d => d.modis > 0 && d.viirs > 0).length;

  $("#hist-total").textContent = total;
  $("#hist-modis").textContent = modis;
  $("#hist-viirs").textContent = viirs;
  $("#hist-ambos").textContent = ambos;
}


function filtrarHistorico() {
  const sensor = $("#sensor-historico").value;

  const filtradas = deteccionesHistoricas.filter((d) => {
    if (sensor === "modis") return d.modis > 0;
    if (sensor === "viirs") return d.viirs > 0;
    if (sensor === "ambos") return d.modis > 0 && d.viirs > 0;
    return true;
  });

  pintarMapaHistorico(filtradas);

  const periodo = $("#tipo-periodo-historico").value;

let descripcionPeriodo;

if (periodo === "dia") {
  descripcionPeriodo = `el ${$("#fecha-historico").value}`;
} else if (periodo === "mes") {
  const selectorMes = $("#mes-historico");
  const nombreMes = selectorMes.options[selectorMes.selectedIndex].textContent;
  const anio = $("#anio-mes-historico").value;

  descripcionPeriodo = `durante ${nombreMes.toLowerCase()} de ${anio}`;
} else {
  descripcionPeriodo = `durante el año ${$("#anio-historico").value}`;
}
  $("#resumen-historico").textContent =
  `${filtradas.length} de ${deteccionesHistoricas.length} celdas con actividad térmica ${descripcionPeriodo}.`;
}


let graficaEvolucionHistorica = null;


let calendarioHistoricoCargado = false;

async function pintarCalendarioHistorico() {
  const contenedor = document.querySelector("#calendario-historico");

  if (!contenedor) return;

  try {
    const respuesta = await fetch("/api/historico/calendario");
    const datos = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(datos.error || "No se pudo cargar el calendario.");
    }

    const registros = datos.calendario;
    const meses = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    ];

    // Usamos una escala relativa para visualizar la distribución.
    // Los valores exactos se mostrarán al pasar el mouse.
    const maximo = Math.max(...registros.map(r => r.total), 1);

    contenedor.innerHTML = "";

    const esquina = document.createElement("div");
    esquina.className = "cal-hist-encabezado";
    esquina.textContent = "Año";
    contenedor.appendChild(esquina);

    meses.forEach(mes => {
      const encabezado = document.createElement("div");
      encabezado.className = "cal-hist-encabezado";
      encabezado.textContent = mes;
      contenedor.appendChild(encabezado);
    });

    for (let anio = 2000; anio <= 2025; anio++) {
      const etiquetaAnio = document.createElement("div");
      etiquetaAnio.className = "cal-hist-anio";
      etiquetaAnio.textContent = anio;
      contenedor.appendChild(etiquetaAnio);

      for (let mes = 1; mes <= 12; mes++) {
        const registro = registros.find(
          r => r.anio === anio && r.mes === mes
        );

        const total = registro ? registro.total : 0;

        const nivel = total === 0
          ? 1
          : Math.min(5, Math.ceil((total / maximo) * 5));

        const celda = document.createElement("button");
        celda.type = "button";
        celda.className = `cal-hist-celda nivel-${nivel}`;

        const nombreMes = meses[mes - 1];

        celda.title =
          `${nombreMes} de ${anio}: ${total.toLocaleString()} registros`;

        celda.setAttribute(
          "aria-label",
          `${nombreMes} de ${anio}: ${total} registros de actividad`
        );

celda.addEventListener("click", async () => {

// Quitar el resaltado de cualquier mes seleccionado anteriormente.
document.querySelectorAll(".cal-hist-celda.seleccionada")
  .forEach(c => c.classList.remove("seleccionada"));

// Resaltar el mes seleccionado.
celda.classList.add("seleccionada");

  // Cambiar los controles de consulta al período mensual.
  const tipoPeriodo = document.querySelector("#tipo-periodo-historico");
  const selectorAnio = document.querySelector("#anio-mes-historico");
  const selectorMes = document.querySelector("#mes-historico");

  tipoPeriodo.value = "mes";
  cambiarPeriodoHistorico();

  selectorAnio.value = String(anio);
  selectorMes.value = String(mes).padStart(2, "0");

  // Consultar las detecciones del mes seleccionado.
  await consultarHistorico();

  // Desplazarse hasta el mapa histórico.
  const mapa = document.querySelector("#mapa-historico");

  if (mapa) {
    mapa.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
});

        contenedor.appendChild(celda);
      }
    }

    calendarioHistoricoCargado = true;

  } catch (error) {
    console.error("Error al cargar el calendario histórico:", error);
    contenedor.textContent = "No se pudo cargar el calendario histórico.";
  }
}


function prepararSelectorGraficaMensual() {
  const selector = document.querySelector("#anio-grafica-mensual");

  if (!selector) return;

  selector.innerHTML = "";

  for (let anio = 2025; anio >= 2000; anio--) {
    const opcion = document.createElement("option");

    opcion.value = anio;
    opcion.textContent = anio;

    selector.appendChild(opcion);
  }

  selector.value = "2022";
  selector.addEventListener("change", pintarEvolucionMensual);
}


let graficaEvolucionMensual = null;

async function pintarEvolucionMensual() {
  const selector = document.querySelector("#anio-grafica-mensual");
  const canvas = document.querySelector("#grafica-evolucion-mensual");

  if (!selector || !canvas || typeof Chart === "undefined") return;

  const anio = selector.value;

  try {
    const respuesta = await fetch(
      `/api/historico/mensual?anio=${anio}`
    );

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(datos.error || "Error al cargar los datos mensuales.");
    }

    // Evitar mostrar datos de un año anterior si el usuario cambió de selección
    if (selector.value !== anio) return;

    const nombresMeses = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    ];


const mesMayorActividad = datos.meses.reduce(
  (mayor, mes) => mes.total > mayor.total ? mes : mayor
);

const resumenMensual = document.querySelector(
  "#resumen-grafica-mensual"
);

if (resumenMensual) {
  const nombreMes = new Intl.DateTimeFormat("es-GT", {
    month: "long",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(anio, mesMayorActividad.mes - 1, 1)));

  resumenMensual.textContent =
    `El mes con mayor actividad térmica en ${anio} fue ` +
    `${nombreMes}, con ${mesMayorActividad.total.toLocaleString()} ` +
    `registros de actividad por celda y día.`;
}


    if (graficaEvolucionMensual) {
      graficaEvolucionMensual.destroy();
    }

    graficaEvolucionMensual = new Chart(canvas, {
      type: "bar",
      data: {
        labels: nombresMeses,
        datasets: [
          {
            label: "Solo MODIS",
            data: datos.meses.map(m => m.modis),
            backgroundColor: "#9BE3AE",
            stack: "actividad"
          },
          {
            label: "Solo VIIRS",
            data: datos.meses.map(m => m.viirs),
            backgroundColor: "#D4F27A",
            stack: "actividad"
          },
          {
            label: "MODIS y VIIRS",
            data: datos.meses.map(m => m.ambos),
            backgroundColor: "#EAF5EC",
            stack: "actividad"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,

        interaction: {
          mode: "index",
          intersect: false
        },

        plugins: {
          legend: {
            labels: { color: "#EAF5EC" }
          },
          tooltip: {
            callbacks: {
              title: function(elementos) {
                return `${elementos[0].label} de ${anio}`;
              },

              label: function(contexto) {
                const valor = contexto.parsed.y || 0;

                return `${contexto.dataset.label}: ${valor.toLocaleString()}`;
              },

              footer: function(elementos) {
                const total = elementos.reduce(
                  (suma, elemento) => suma + (elemento.parsed.y || 0),
                  0
                );

                return `Total del mes: ${total.toLocaleString()}`;
              }
            }
          }
        },

        scales: {
          x: {
            stacked: true,
            ticks: { color: "#9BE3AE" },
            grid: { display: false }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { color: "#9BE3AE" },
            grid: { color: "rgba(255,255,255,0.1)" }
          }
        }
      }
    });

  } catch (error) {
    console.error("Error al cargar la gráfica mensual:", error);
  }
}


async function pintarEvolucionHistorica() {
  const canvas = document.querySelector("#grafica-evolucion-historica");

  if (!canvas || typeof Chart === "undefined") {
    console.error("No se encontró Chart.js o el canvas.");
    return;
  }

  try {
    const respuesta = await fetch("/api/historico/evolucion");
    const datos = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(datos.error || "No se pudieron cargar los datos.");
    }


    const anios = datos.anios.map(d => d.anio);

    const soloModis = datos.anios.map(d => d.modis - d.ambos);
    const soloViirs = datos.anios.map(d => d.viirs - d.ambos);
    const ambos = datos.anios.map(d => d.ambos);


    if (graficaEvolucionHistorica) {
      graficaEvolucionHistorica.destroy();
    }

    graficaEvolucionHistorica = new Chart(canvas, {
      type: "bar",
      data: {
        labels: anios,

datasets: [
  {
    label: "Solo MODIS",
    data: soloModis,
    backgroundColor: "#9BE3AE",
    stack: "actividad"
  },
  {
    label: "Solo VIIRS",
    data: soloViirs,
    backgroundColor: "#D4F27A",
    stack: "actividad"
  },
  {
    label: "MODIS y VIIRS",
    data: ambos,
    backgroundColor: "#EAF5EC",
    stack: "actividad"
  }
]

      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
        mode: "index",
        intersect: false
      },
        plugins: {
          legend: {
            labels: { color: "#EAF5EC" }
          },

tooltip: {
  mode: "index",
  intersect: false,

  callbacks: {
    label: function(contexto) {
      const valor = contexto.parsed.y || 0;

      return `${contexto.dataset.label}: ${valor.toLocaleString()}`;
    },

    footer: function(elementos) {
      const total = elementos.reduce(
        (suma, elemento) => suma + (elemento.parsed.y || 0),
        0
      );

      return `Total del año: ${total.toLocaleString()}`;
    }
  }
}

        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: "#9BE3AE" },
            grid: { display: false }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { color: "#9BE3AE" },
            grid: { color: "rgba(255,255,255,0.1)" }
          }
        }
      }
    });

  } catch (error) {
    console.error("Error al cargar la evolución histórica:", error);
  }
}


/* ---------------------------------------------------------------
   Mapa histórico de detecciones MODIS y VIIRS
---------------------------------------------------------------- */
function pintarMapaHistorico(detecciones) {
  if (typeof L === "undefined") {
    console.error("Leaflet no está disponible.");
    return;
  }

  // Crear el mapa solamente la primera vez
  if (!mapaHistorico) {
    mapaHistorico = L.map("mapa-historico", {
      zoomSnap: 0.25,
      minZoom: 6
    });

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors"
      }
    ).addTo(mapaHistorico);

    mapaHistorico.fitBounds([
      [13.6, -92.4],
      [17.9, -88.1]
    ]);

    capaHistorica = L.layerGroup().addTo(mapaHistorico);
  }

  // Limpiar los puntos de la consulta anterior
  capaHistorica.clearLayers();

  // Dibujar las celdas con actividad térmica
  detecciones.forEach((d) => {
    let colorPunto;

    if (d.ambos_sensores) {
      colorPunto = "#DC2626";
    } else if (d.modis > 0) {
      colorPunto = "#C026D3";
    } else {
      colorPunto = "#FF6A00";
    }

    L.circleMarker([d.lat, d.lon], {
      radius: 5,
      color: colorPunto,
      fillColor: colorPunto,
      fillOpacity: 0.8,
      weight: 1
    })
      .bindPopup(`
        <strong>${d.fuente}</strong>
        <p>MODIS: ${d.modis}</p>
        <p>VIIRS: ${d.viirs}</p>
        <p>Detecciones asociadas: ${d.detecciones_asociadas}</p>
      `)
      .addTo(capaHistorica);
  });

  // Ajustar el tamaño cuando el mapa esté visible
  setTimeout(() => mapaHistorico.invalidateSize(), 100);
}


/* ---------------------------------------------------------------
   Consulta de detecciones históricas MODIS y VIIRS
---------------------------------------------------------------- */
async function consultarHistorico() {
  
  const periodo = $("#tipo-periodo-historico").value;

  let parametro;
  let valor;

  if (periodo === "dia") {
    parametro = "fecha";
    valor = $("#fecha-historico").value;
  } else if (periodo === "mes") {
    parametro = "mes";
    valor = `${$("#anio-mes-historico").value}-${$("#mes-historico").value}`;
  } else {
    parametro = "anio";
    valor = $("#anio-historico").value;
  }

  const resumen = $("#resumen-historico");
  const boton = $("#btn-consultar-historico");

    if (!valor) {
    resumen.textContent = "Selecciona un período para consultar.";
    return;
  }

  boton.disabled = true;
  resumen.textContent = "Consultando detecciones históricas...";

  try {
  const respuesta = await fetch(
    `/api/historico?${parametro}=${encodeURIComponent(valor)}`
  );

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(datos.error || "No se pudo consultar la información.");
  }

  deteccionesHistoricas = datos.detecciones;
  actualizarEstadisticasHistoricas();
  filtrarHistorico();

} catch (error) {
  resumen.textContent = `Error: ${error.message}`;
  console.error("Error al consultar el histórico:", error);

} finally {
  boton.disabled = false;
}
}


function cambiarPestana(tab) {
  S.tab = tab;
  $$(".pestanas button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tab === tab ? "true" : "false"));
  $("#vista-mapa").hidden = tab !== "mapa";
  $("#vista-cal").hidden = tab !== "cal";
  $("#vista-met").hidden = tab !== "met";
  $("#vista-hist").hidden = tab !== "hist";

if (tab === "hist") {
  if (!calendarioHistoricoCargado) {
  pintarCalendarioHistorico();
}
  const selectorMensual = document.querySelector("#anio-grafica-mensual");

  if (selectorMensual && selectorMensual.options.length === 0) {
    prepararSelectorGraficaMensual();
  }

  if (!graficaEvolucionMensual) {
  pintarEvolucionMensual();
}

  if (!graficaEvolucionHistorica) {
    pintarEvolucionHistorica();
  }
}

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
  $("#buscador").addEventListener("submit", (e) => { e.preventDefault(); buscarLugar($("#q-buscar").value); });
  const moverMes = (d) => { const n = S.mes.y * 12 + S.mes.m + d; S.mes = { y: Math.floor(n / 12), m: n % 12 }; pintarCalendario(); };
  $("#cal-prev").addEventListener("click", () => moverMes(-1));
  $("#cal-next").addEventListener("click", () => moverMes(1));
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
  $$("[data-i18n-ph]").forEach((el) => { const v = t()[el.dataset.i18nPh]; if (typeof v === "string") el.placeholder = v; });
  const bi = $("#btn-idioma");
  bi.textContent = t().langBtn; bi.setAttribute("aria-label", t().langLabel);
  $("#btn-play").setAttribute("aria-label", reloj ? t().pause : t().play);
  $("#nota-mapa").textContent = S.vista === "hex" ? t().interp : t().satNote(fIso(ESTADO.fecha_imagenes));
}

function pintarTodo() {
  // Pie con la fuente de los datos y aviso si hay datos simulados
  $("#nota-mapa").textContent = S.vista === "hex" ? t().interp : t().satNote(fIso(ESTADO.fecha_imagenes));
  const rezago = Math.round((fecha(ESTADO.hoy) - fecha(ESTADO.ultimo_dato)) / 86400000);
  const sim = (ESTADO.fuentes && ESTADO.fuentes.SIMULADO) || 0;
  const viejo = !sim && ESTADO.errores && ESTADO.errores.length;
  $("#aviso").hidden = !(sim || viejo);
  if (sim) $("#aviso").textContent = t().simWarn(sim);
  else if (viejo) $("#aviso").textContent = t().staleWarn(fIso(ESTADO.ultimo_dato));

  if (S.tab === "mapa") {
    if (S.vista === "hex") pintarHexagonos(); else pintarSatelite();
    pintarNacional(); pintarLineaTiempo(); pintarPanel();
  } else if (S.tab === "cal") {
    pintarCalendario();
  } else if (S.tab === "met") {
    pintarMetodo();
  }
}

traducir.inicial = () => $$("[data-i18n]").forEach((el) => { const v = T.es[el.dataset.i18n]; if (typeof v === "string" && !el.textContent.trim()) el.textContent = v; });
traducir.inicial();
init();


function cambiarPeriodoHistorico() {
  const periodo = $("#tipo-periodo-historico").value;

  const esDia = periodo === "dia";
  const esMes = periodo === "mes";
  const esAnio = periodo === "anio";

  $("#fecha-historico").hidden = !esDia;
  $("#mes-historico").hidden = !esMes;
  $("#anio-historico").hidden = !esAnio;
  $("#anio-mes-historico").hidden = !esMes;
  $("#label-anio-mes-historico").hidden = !esMes;

  document.querySelector('label[for="fecha-historico"]').hidden = !esDia;
  $("#label-mes-historico").hidden = !esMes;
  $("#label-anio-historico").hidden = !esAnio;
}

const selectorAnioMes = $("#anio-mes-historico");

for (let anio = 2000; anio <= 2025; anio++) {
  const opcion = document.createElement("option");
  opcion.value = String(anio);
  opcion.textContent = String(anio);

  if (anio === 2022) {
    opcion.selected = true;
  }

  selectorAnioMes.appendChild(opcion);
}

document.querySelector("#tipo-periodo-historico").addEventListener(
  "change",
  cambiarPeriodoHistorico
);


document.querySelector("#btn-consultar-historico")
  .addEventListener("click", consultarHistorico);
  document.querySelector("#sensor-historico")
  .addEventListener("change", () => {
    if (deteccionesHistoricas.length > 0) {
      filtrarHistorico();
    }
  });


/* ---------------------------------------------------------------
   Buscador de departamentos y municipios
---------------------------------------------------------------- */
let capaBusqueda = null;
const msgBusqueda = (txt, mal) => { const m = $("#buscar-msg"); m.hidden = !txt; m.textContent = txt || ""; m.className = "focos-estado" + (mal ? " mal" : ""); };

async function buscarLugar(q) {
  q = q.trim();
  const lista = $("#buscar-lista");
  lista.hidden = true; $("#buscar-card").hidden = true;
  if (q.length < 2) { msgBusqueda("Escriba al menos 2 letras.", false); return; }
  msgBusqueda("Buscando…");
  try {
    const d = await (await fetch("/api/buscar?q=" + encodeURIComponent(q))).json();
    const r = d.resultados || [];
    if (!r.length) { msgBusqueda(d.aviso || `No se encontró «${q}» en Guatemala. Pruebe con el nombre del municipio sin abreviaturas.`, !!d.aviso); return; }
    msgBusqueda(d.aviso || "", true);
    if (r.length === 1) { elegirLugar(r[0]); return; }
    lista.innerHTML = r.map((x, i) => `<li><button type="button" data-lugar="${i}"><span>${esc(x.etiqueta)}</span><small>${esc(x.tipo)}</small></button></li>`).join("");
    lista.hidden = false;
    lista.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => elegirLugar(r[+b.dataset.lugar])));
  } catch (e) { msgBusqueda("No se pudo realizar la búsqueda. Revise su conexión.", true); }
}

function focosCerca(lat, lon, radio) {
  if (!FOCOS) return null;
  const rad = Math.PI / 180;
  let n = 0, min = Infinity;
  for (const f of FOCOS.focos) {
    const dy = (f.lat - lat) * 111.2, dx = (f.lon - lon) * 111.2 * Math.cos(lat * rad), k = Math.hypot(dx, dy);
    if (k <= radio) n++;
    if (k < min) min = k;
  }
  return { n, min };
}

async function elegirLugar(x) {
  $("#buscar-lista").hidden = true;
  $("#buscar-card").hidden = true;
  msgBusqueda(x.tipo === "departamento" ? "" : `Calculando el riesgo de ${x.etiqueta} con datos de NASA POWER de ese punto… (puede tardar unos segundos)`);
  try {
    let d;
    if (x.tipo === "departamento") {
      d = await api("/api/departamento/" + x.id);
      const dep = ESTADO.departamentos.find((z) => z.id === x.id);
      d = { ...d, nombre: x.nombre, lat: dep.lat, lon: dep.lon, riesgo_hoy: dep.riesgo, nivel_hoy: dep.nivel, color_hoy: dep.color, esDepto: true };
      seleccionar(x.id);
    } else {
      const r = await fetch(`/api/punto?lat=${x.lat}&lon=${x.lon}&nombre=${encodeURIComponent(x.nombre)}`);
      d = await r.json();
      if (!r.ok) {
        if (d.detalle) console.warn("Punto:", d.detalle);
        throw new Error(d.error || r.status);
      }
      d.etiqueta = x.etiqueta;
    }
    msgBusqueda("");
    pintarTarjetaLugar(d, x);
    marcarLugar(d.lat, d.lon, d.nombre);
  } catch (e) { msgBusqueda("No se pudo obtener el riesgo de ese lugar: " + String(e.message || e), true); }
}

function marcarLugar(lat, lon, nombre) {
  if (S.vista !== "sat") cambiarVista("sat");
  pintarSatelite();
  if (!capaBusqueda) capaBusqueda = L.layerGroup().addTo(mapaSat);
  capaBusqueda.clearLayers();
  L.circleMarker([lat, lon], { pane: "focos", radius: 11, color: "#0D1F14", weight: 3, fillColor: "#EAF5EC", fillOpacity: 1 })
    .bindTooltip(esc(nombre), { permanent: true, direction: "top", offset: [0, -8] }).addTo(capaBusqueda);
  mapaSat.flyTo([lat, lon], 10, { duration: 1 });
}

function pintarTarjetaLugar(d, x) {
  const riesgoHoy = Math.round(d.riesgo_hoy * 100);
  const nivelTxt = nombreNivel(d.nivel_hoy), col = color(riesgoHoy + 2);
  const c10 = focosCerca(d.lat, d.lon, 10), c25 = focosCerca(d.lat, d.lon, 25);
  const cerca = !FOCOS ? "Focos de calor: sin datos de FIRMS en este momento."
    : c10.n > 0 ? `<b>${c10.n} foco(s) de calor a menos de 10 km</b> en las últimas 24 h (el más cercano a ${c10.min.toFixed(1)} km).`
    : `Sin focos de calor a menos de 10 km en las últimas 24 h${c25.n ? ` (${c25.n} a menos de 25 km; el más cercano a ${c25.min.toFixed(1)} km)` : ""}.`;
  const vars = d.variables.map(filaVariable).join("");
  const plan = d.plan.slice(0, 3).map((p) => { const y = traducirPlan(p); return `<div class="plan-item"><h3>${esc(y.t)}</h3><p>${esc(y.d)}</p></div>`; }).join("");
  const lugar = d.esDepto ? `Departamento · ${Math.round(d.elev)} m` : `${esc(x.tipo === "municipio" ? "Municipio" : "Lugar")}${x.departamento ? " de " + esc(x.departamento) : ""} · ${Math.round(d.elev)} m`;
  const pico = d.pico ? `<p class="sub">Peor día de los próximos 14: ${esc(fIso(d.pico.fecha))} · riesgo ${Math.round(d.pico.riesgo * 100)} (${esc(nombreNivel(d.pico.nivel))})</p>` : "";
  const prec = d.esDepto
    ? "Resultado del departamento completo (punto central). Busque un municipio para un cálculo más local."
    : `Clima: serie de NASA POWER de este punto (resolución de la malla ≈ ${d.resolucion_clima_km} km: municipios vecinos pueden compartir el mismo clima). Altitud: ${esc(d.elev_fuente)}. Departamento más cercano: ${esc(d.dep_cercano.nombre)} (${d.dep_cercano.km} km). Último dato de clima: ${esc(fIso(d.fecha_dato))}; el riesgo de hoy es una estimación del modelo desde ese dato.`;
  const card = $("#buscar-card");
  card.innerHTML = `<div class="cab"><div><h2>${esc(d.etiqueta || d.nombre)}</h2><p class="sub">${lugar}</p></div>
      <span class="nivel-chip" style="background:${col};color:${textoSobre(riesgoHoy + 2)}">${esc(nivelTxt)} <b>${riesgoHoy}</b>/100</span></div>
    <p>Equilibrio ambiental: <b>${d.equilibrio}</b>/100 (100 = sin condiciones para fuego).</p>
    ${pico}
    <div class="cerca${c10 && c10.n > 0 ? " rojo" : ""}">${cerca}</div>
    <div class="cols"><div><span class="nota">${t().varsTitle}</span><ul class="lista">${vars}</ul></div>
      <div><span class="nota">${t().planTitle}</span>${plan}</div></div>
    <p class="nota-prec">${prec}</p>`;
  card.hidden = false;
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
