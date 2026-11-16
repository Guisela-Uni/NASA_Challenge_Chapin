/* FuegoAlerta GT · portada.
   - Imagen Blue Marble de Guatemala (NASA GIBS) con puntos de calor simulados (decorativos).
   - Cifras en vivo desde la propia API (/api/estado y /api/focos_hoy).
   - Botón ES/EN. */
(() => {
  const $ = (s) => document.querySelector(s);

  // Recuadro de Guatemala (lon/lat). La imagen y los puntos usan exactamente el mismo.
  const BBOX = { oeste: -92.4, sur: 13.6, este: -88.1, norte: 18.0 };

  const TXT = {
    es: {
      ctaShort: "Prueba la demo", cta: "Prueba la demo", cta2: "Cómo funciona",
      h1a: "Vigila el clima.", h1b: "Cuida tu tierra.",
      sub: "Riesgo de incendio forestal para los 22 departamentos, con datos satelitales de la NASA cada día.",
      kNivel: "Nivel nacional hoy", kFocos: "Focos de calor · 24 h", kDeps: "Departamentos",
      f1t: "Clima diario", f1d: "Temperatura, humedad, lluvia y viento de NASA POWER para cada departamento.",
      f2t: "Focos de calor", f2d: "Detecciones MODIS y VIIRS de NASA FIRMS en las últimas 24 horas.",
      f3t: "Riesgo y pronóstico", f3d: "Nivel de riesgo diario, días críticos y una acción concreta para prevenir.",
      endA: "Del satélite", endB: "a tu parcela.", btn: "EN", btnLabel: "Switch to English",
      title: "FuegoAlerta GT · Vigila el clima, cuida tu tierra",
    },
    en: {
      ctaShort: "Try the demo", cta: "Try the demo", cta2: "How it works",
      h1a: "Track the weather.", h1b: "Track your land.",
      sub: "Wildfire risk for all 22 departments, powered by daily NASA satellite data.",
      kNivel: "National level today", kFocos: "Hotspots · 24 h", kDeps: "Departments",
      f1t: "Daily weather", f1d: "Temperature, humidity, rain and wind from NASA POWER for every department.",
      f2t: "Hotspots", f2d: "MODIS and VIIRS detections from NASA FIRMS over the last 24 hours.",
      f3t: "Risk & forecast", f3d: "Daily risk level, critical days and one concrete action to prevent fires.",
      endA: "From satellite", endB: "to your land.", btn: "ES", btnLabel: "Cambiar a español",
      title: "FuegoAlerta GT · Track the weather, track your land",
    },
  };
  const NIVEL_EN = { "Bajo": "Low", "Moderado": "Moderate", "Alto": "High", "Muy alto": "Very high", "Extremo": "Extreme" };
  let lang = "es", nivel = null;

  function aplicarIdioma() {
    const t = TXT[lang];
    document.documentElement.lang = lang;
    document.title = t.title;
    document.querySelectorAll("[data-t]").forEach((el) => { if (t[el.dataset.t]) el.textContent = t[el.dataset.t]; });
    $("#idioma").textContent = t.btn;
    $("#idioma").setAttribute("aria-label", t.btnLabel);
    if (nivel) $("#k-nivel").textContent = lang === "es" ? nivel : NIVEL_EN[nivel] || nivel;
  }
  $("#idioma").addEventListener("click", () => { lang = lang === "es" ? "en" : "es"; aplicarIdioma(); });

  // ---------- imagen de fondo: NASA Blue Marble (mosaico sin nubes ni franjas) ----------
  // La imagen diaria MODIS a veces llega con franjas negras entre pasadas del satélite
  // o cubierta de nubes; para la portada usamos el mosaico Blue Marble, siempre completo.
  const CAPAS = ["BlueMarble_NextGeneration", "BlueMarble_ShadedRelief_Bathymetry"];
  function imagen(n) {
    const url = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1" +
      `&LAYERS=${CAPAS[n]}&STYLES=&FORMAT=image/jpeg&SRS=EPSG:4326` +
      `&BBOX=${BBOX.oeste},${BBOX.sur},${BBOX.este},${BBOX.norte}&WIDTH=860&HEIGHT=880`;
    const img = $("#sat");
    img.onload = () => img.classList.add("ok");
    img.onerror = () => { if (n + 1 < CAPAS.length) imagen(n + 1); };
    img.src = url;
  }
  imagen(0);

  // ---------- contorno de Guatemala: oscurece lo de afuera y marca el borde con línea blanca fina ----------
  // Frontera de Guatemala (Natural Earth 1:10m, simplificada). [lat, lon]
  const CONTORNO = [[14.416,-89.362],[14.436,-89.391],[14.426,-89.398],[14.445,-89.398],[14.419,-89.43],[14.428,-89.484],[14.382,-89.542],[14.411,-89.556],[14.402,-89.585],[14.386,-89.592],[14.353,-89.574],[14.328,-89.599],[14.299,-89.556],[14.232,-89.524],[14.2,-89.639],[14.169,-89.689],[14.075,-89.754],[14.038,-89.747],[14.029,-89.761],[14.056,-89.805],[14.06,-89.837],[14.036,-89.891],[13.95,-90.01],[13.894,-90.046],[13.844,-90.107],[13.796,-90.114],[13.732,-90.1],[13.859,-90.402],[13.913,-90.579],[13.93,-90.708],[13.911,-90.91],[13.913,-91.043],[13.955,-91.317],[14.058,-91.551],[14.18,-91.763],[14.546,-92.246],[14.571,-92.21],[14.683,-92.159],[14.835,-92.192],[14.901,-92.156],[14.995,-92.156],[15.017,-92.105],[15.074,-92.073],[15.237,-92.202],[15.289,-92.206],[16.061,-91.742],[16.069,-91.724],[16.071,-90.485],[16.079,-90.449],[16.108,-90.435],[16.099,-90.456],[16.116,-90.46],[16.137,-90.435],[16.155,-90.449],[16.164,-90.428],[16.189,-90.464],[16.221,-90.46],[16.236,-90.435],[16.26,-90.46],[16.272,-90.449],[16.263,-90.428],[16.285,-90.442],[16.292,-90.435],[16.289,-90.413],[16.299,-90.413],[16.309,-90.446],[16.331,-90.406],[16.348,-90.399],[16.361,-90.406],[16.353,-90.42],[16.368,-90.417],[16.368,-90.381],[16.419,-90.395],[16.43,-90.474],[16.456,-90.482],[16.468,-90.5],[16.459,-90.532],[16.49,-90.543],[16.483,-90.633],[16.518,-90.611],[16.53,-90.647],[16.593,-90.633],[16.599,-90.647],[16.587,-90.669],[16.616,-90.654],[16.653,-90.669],[16.746,-90.737],[16.787,-90.802],[16.805,-90.798],[16.836,-90.921],[16.875,-90.968],[16.898,-90.957],[16.902,-90.986],[16.878,-90.982],[16.875,-90.993],[16.908,-91.054],[17.025,-91.126],[17.028,-91.173],[17.114,-91.23],[17.124,-91.259],[17.18,-91.281],[17.19,-91.364],[17.214,-91.374],[17.238,-91.443],[17.254,-91.439],[17.253,-90.993],[17.81,-90.982],[17.815,-89.16],[17.037,-89.149],[15.893,-89.236],[15.882,-89.229],[15.9,-89.178],[15.902,-89.041],[15.88,-88.951],[15.893,-88.915],[15.86,-88.865],[15.868,-88.833],[15.86,-88.786],[15.839,-88.753],[15.819,-88.75],[15.753,-88.627],[15.709,-88.638],[15.703,-88.609],[15.714,-88.595],[15.743,-88.606],[15.745,-88.581],[15.799,-88.552],[15.853,-88.559],[15.839,-88.552],[15.846,-88.487],[15.953,-88.62],[15.969,-88.606],[15.942,-88.552],[15.858,-88.447],[15.812,-88.343],[15.74,-88.257],[15.726,-88.221],[15.687,-88.242],[15.696,-88.249],[15.674,-88.318],[15.617,-88.354],[15.573,-88.401],[15.14,-88.973],[15.091,-89.11],[15.061,-89.16],[14.997,-89.189],[14.978,-89.167],[14.951,-89.167],[14.867,-89.232],[14.835,-89.229],[14.711,-89.146],[14.691,-89.142],[14.666,-89.16],[14.581,-89.16],[14.57,-89.171],[14.573,-89.247],[14.487,-89.322],[14.475,-89.355]];
  const px = ([lat, lon]) => `${(((lon - BBOX.oeste) / (BBOX.este - BBOX.oeste)) * 1000).toFixed(1)},${(((BBOX.norte - lat) / (BBOX.norte - BBOX.sur)) * 1000).toFixed(1)}`;
  const forma = "M" + CONTORNO.map(px).join(" L") + " Z";
  $("#lienzo").insertAdjacentHTML("beforeend",
    `<svg class="contorno" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
       <path class="fuera" fill-rule="evenodd" d="M0,0 H1000 V1000 H0 Z ${forma}"/>
       <path class="borde" d="${forma}"/>
     </svg>`);
  // Los puntos van encima del contorno
  $("#lienzo").appendChild($("#puntos"));

  // ---------- puntos de calor (SIMULADOS, solo decorativos para la portada) ----------
  // Ubicados en zonas donde suelen aparecer incendios: Petén, costa sur y oriente.
  // [lat, lon, intensidad 0-1]
  const CALOR = [
    [17.40, -90.90, 1], [17.25, -90.55, .9], [17.10, -90.20, .75], [16.90, -89.75, .85], [17.55, -89.95, .6],
    [16.60, -90.35, .7], [16.95, -90.80, .55], [16.40, -89.60, .5], [17.70, -90.40, .65],
    [14.25, -90.85, .8], [14.10, -91.25, .9], [14.35, -91.65, .6], [14.05, -90.50, .55], [14.50, -91.85, .5],
    [14.90, -89.60, .7], [15.05, -89.30, .6], [14.70, -89.95, .45], [15.60, -90.10, .5], [15.40, -91.60, .4],
  ];
  const capa = $("#puntos");
  CALOR.forEach(([lat, lon, k], i) => {
    const x = ((lon - BBOX.oeste) / (BBOX.este - BBOX.oeste)) * 100;
    const y = ((BBOX.norte - lat) / (BBOX.norte - BBOX.sur)) * 100;
    const p = document.createElement("span");
    p.className = "calor";
    p.style.left = x + "%"; p.style.top = y + "%";
    p.style.setProperty("--t", (30 + k * 50).toFixed(0) + "px");
    p.style.animationDelay = (i * 120) + "ms, " + ((i % 5) * 0.5) + "s";
    capa.appendChild(p);
  });

  // ---------- cifra de focos (real, NASA FIRMS) ----------
  async function focos() {
    try {
      const r = await fetch("/api/focos_hoy");
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      $("#k-focos").textContent = d.total ?? "—";
    } catch { /* se queda en "—" */ }
  }
  focos();

  // ---------- nivel nacional (la API puede tardar si los datos se están cargando) ----------
  async function estado(intento = 0) {
    try {
      const r = await fetch("/api/estado");
      if (r.status === 503 && intento < 20) return setTimeout(() => estado(intento + 1), 3000);
      if (!r.ok) return;
      const d = await r.json();
      nivel = d.nacional.nivel;
      const el = $("#k-nivel");
      el.textContent = lang === "es" ? nivel : NIVEL_EN[nivel] || nivel;
      el.classList.add("lima");
    } catch { /* se queda en "—" */ }
  }
  estado();
})();
