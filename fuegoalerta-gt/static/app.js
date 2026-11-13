/* FuegoAlerta GT - interfaz. Sin dependencias salvo Leaflet. */
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => Math.round(x * 100);

let ESTADO, DIARIO, RANGOS, CONTORNO;
let mapa, capaRiesgo, marcadores = {};
let depSel = null;
let calMes = null, calScope = "media", calDiaSel = null;

/* ---------- utilidades ---------- */
async function api(url) {
  const r = await fetch(url);
  if (r.status === 503) throw new Error("NO_LISTO");
  if (!r.ok) throw new Error(url + " → " + r.status);
  return r.json();
}
const fechaLarga = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fechaCorta = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("es-GT", { day: "numeric", month: "short" });
const isoDe = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const RAMPA = [[0, [59, 156, 90]], [0.2, [227, 197, 66]], [0.35, [240, 138, 36]], [0.5, [217, 65, 43]], [0.7, [142, 27, 58]]];
function colorRiesgoRGB(r) {
  for (let i = 1; i < RAMPA.length; i++) {
    if (r <= RAMPA[i][0]) {
      const [a, ca] = RAMPA[i - 1], [b, cb] = RAMPA[i];
      const t = (r - a) / (b - a);
      return ca.map((c, k) => Math.round(c + (cb[k] - c) * t));
    }
  }
  return RAMPA[RAMPA.length - 1][1];
}
function nivelDe(r) {
  for (const n of DIARIO.umbrales_nivel) if (r < n.hasta) return n;
  return DIARIO.umbrales_nivel[DIARIO.umbrales_nivel.length - 1];
}
const claro = (nombre) => nombre === "Moderado";   // texto oscuro sobre amarillo

/* ---------- carga ---------- */
async function esperarDatos() {
  for (;;) {
    const s = await (await fetch("/api/status")).json();
    $("#progreso-barra").style.width = Math.max(3, (100 * s.cargados) / s.total) + "%";
    $("#progreso-txt").textContent = `Obteniendo datos satelitales… ${s.cargados} de ${s.total} departamentos`;
    if (s.listo) return s;
    await new Promise((r) => setTimeout(r, 800));
  }
}

async function init() {
  try {
    await esperarDatos();
    [ESTADO, DIARIO, RANGOS, CONTORNO] = await Promise.all([
      api("/api/estado"), api("/api/riesgo_diario"), api("/api/rangos"), api("/api/contorno"),
    ]);
  } catch (e) {
    $("#progreso-txt").textContent = "No se pudieron cargar los datos. Recargue la página.";
    console.error(e);
    return;
  }
  $("#cargando").hidden = true;
  pintarBadge(); pintarKPIs(); initMapa(); pintarRanking();
  initCalendario(); initDetalle(); pintarMetodo();
}

/* ---------- cabecera y KPIs ---------- */
function pintarBadge() {
  const f = ESTADO.fuentes, real = f["NASA POWER"] || 0, sim = f["SIMULADO"] || 0;
  const b = $("#badge-fuente"), aviso = $("#aviso-demo");
  if (sim === 0) {
    b.className = "badge real";
    b.textContent = `Datos NASA POWER · último dato: ${fechaCorta(ESTADO.ultimo_dato)}`;
    aviso.hidden = true;
  } else {
    b.className = "badge demo";
    b.textContent = sim === 22 ? "MODO DEMOSTRACIÓN · datos simulados" : `Datos mixtos: ${sim} departamentos simulados`;
    aviso.hidden = false;
    aviso.innerHTML = `<strong>Atención:</strong> ${sim === 22 ? "no se pudo conectar con NASA POWER y todos los valores que ve son <u>simulados</u>" : `${sim} de 22 departamentos usan valores <u>simulados</u>`}. Sirven para probar la aplicación, <strong>no para tomar decisiones</strong>. Ejecute la aplicación en un equipo con acceso a internet para usar datos reales. ${ESTADO.errores.length ? "<br><small>Detalle: " + esc(ESTADO.errores[0]) + "</small>" : ""}`;
  }
}

function pintarKPIs() {
  const n = ESTADO.nacional;
  $("#kpi-nivel").innerHTML = `<span style="color:${n.color}">${esc(n.nivel)}</span>`;
  $("#kpi-nivel-sub").textContent = `Riesgo medio ${pct(n.riesgo_medio)}/100`;
  $("#kpi-alto").textContent = n.en_alto_o_mas;
  $("#kpi-eq").textContent = n.equilibrio_medio + "/100";
  const futuro = futuros("maximo");
  if (futuro.length) {
    const mejor = futuro.slice().sort((a, b) => b.valor - a.valor)[0];
    $("#kpi-pico").textContent = fechaCorta(mejor.fecha);
    $("#kpi-pico-sub").textContent = `Riesgo del departamento más crítico: ${pct(mejor.valor)}/100 (${nivelDe(mejor.valor).nombre})`;
  }
}

/* ---------- mapa ---------- */
function gibs(capa, fecha, nivel, ext) {
  const t = fecha ? `/default/${fecha}` : "/default";
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${capa}${t}/GoogleMapsCompatible_Level${nivel}/{z}/{y}/{x}.${ext}`;
}
function dentro(lat, lon, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function riesgoIDW(lat, lon) {
  let num = 0, den = 0;
  for (const d of ESTADO.departamentos) {
    const dx = (lon - d.lon) * Math.cos((lat * Math.PI) / 180), dy = lat - d.lat;
    const w = 1 / (dx * dx + dy * dy + 1e-4);
    num += w * d.riesgo; den += w;
  }
  return num / den;
}

/* Superficie continua de riesgo: interpolación IDW recortada al contorno del país,
   dibujada una sola vez en un canvas y mostrada como imagen sobre el mapa. */
function superficieRiesgo(lim) {
  const W = 360, H = 360;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(W, H);
  for (let j = 0; j < H; j++) {
    const lat = lim.n - ((j + 0.5) / H) * (lim.n - lim.s);
    for (let i = 0; i < W; i++) {
      const lon = lim.w + ((i + 0.5) / W) * (lim.e - lim.w);
      if (!dentro(lat, lon, CONTORNO.contorno)) continue;
      const c = colorRiesgoRGB(riesgoIDW(lat, lon)), k = 4 * (j * W + i);
      img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL("image/png");
}

function initMapa() {
  const attrNasa = 'Imágenes: <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>';
  const relieve = L.tileLayer(gibs("BlueMarble_ShadedRelief_Bathymetry", null, 8, "jpeg"), { maxNativeZoom: 8, maxZoom: 12, attribution: attrNasa });
  const satelite = L.tileLayer(gibs("VIIRS_SNPP_CorrectedReflectance_TrueColor", ESTADO.fecha_imagenes, 9, "jpg"), { maxNativeZoom: 9, maxZoom: 12, attribution: attrNasa + " · VIIRS " + ESTADO.fecha_imagenes });
  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" });
  const focos = L.tileLayer(gibs("VIIRS_SNPP_Thermal_Anomalies_375m_All", ESTADO.fecha_imagenes, 9, "png"), { maxNativeZoom: 9, maxZoom: 12, opacity: 0.95, attribution: attrNasa + " · focos " + ESTADO.fecha_imagenes });

  mapa = L.map("mapa", { layers: [relieve], zoomSnap: 0.25, minZoom: 6 });
  mapa.fitBounds([[13.6, -92.4], [17.9, -88.1]]);
  mapa.setMaxBounds([[11.5, -95], [19.5, -85.5]]);

  capaRiesgo = L.layerGroup();
  const lim = { s: 13.6, n: 17.9, w: -92.4, e: -88.1 };
  L.imageOverlay(superficieRiesgo(lim), [[lim.s, lim.w], [lim.n, lim.e]], { opacity: 0.62, interactive: false }).addTo(capaRiesgo);
  L.polygon(CONTORNO.contorno, { color: "#17382a", weight: 2, fill: false, interactive: false }).addTo(capaRiesgo);
  capaRiesgo.addTo(mapa);

  const capaDeps = L.layerGroup();
  for (const d of ESTADO.departamentos) {
    const m = L.circleMarker([d.lat, d.lon], { radius: 8, color: "#fff", weight: 2, fillColor: d.color, fillOpacity: 1 });
    m.bindTooltip(`<strong>${esc(d.nombre)}</strong><br>${esc(d.nivel)} · riesgo ${pct(d.riesgo)}/100<br>Equilibrio ${d.equilibrio}/100`, { direction: "top" });
    m.on("click", () => seleccionarDep(d.id, true));
    m.addTo(capaDeps);
    marcadores[d.id] = m;
  }
  capaDeps.addTo(mapa);

  L.control.layers(
    { "Relieve (NASA Blue Marble)": relieve, "Satélite VIIRS (color real)": satelite, "Calles (OpenStreetMap)": osm },
    { "Riesgo de incendio (interpolado)": capaRiesgo, "Departamentos": capaDeps, "Focos de calor VIIRS 375 m (NASA)": focos },
    { collapsed: false }
  ).addTo(mapa);

  $("#leyenda-niveles").innerHTML = DIARIO.umbrales_nivel.map((n, i) => {
    const desde = i === 0 ? 0 : DIARIO.umbrales_nivel[i - 1].hasta;
    return `<span><i class="punto" style="background:${n.color}"></i>${esc(n.nombre)} (${pct(desde)}–${n.hasta > 1 ? 100 : pct(n.hasta)})</span>`;
  }).join("");
}

/* ---------- ranking ---------- */
function pintarRanking() {
  $("#ranking").innerHTML = ESTADO.departamentos.map((d, i) => `
    <li><button type="button" data-id="${d.id}" aria-label="${esc(d.nombre)}, riesgo ${esc(d.nivel)}">
      <span class="pos">${i + 1}</span>
      <span><span class="nom">${esc(d.nombre)}</span>${d.fuente === "SIMULADO" ? '<span class="sim">simulado</span>' : ""}</span>
      <span class="niv ${claro(d.nivel) ? "claro" : ""}" style="background:${d.color};${claro(d.nivel) ? "color:#2b2b2b" : ""}">${esc(d.nivel)} · ${pct(d.riesgo)}</span>
      <span class="barra-r"><i style="width:${Math.min(100, pct(d.riesgo) * 1.4)}%;background:${d.color}"></i></span>
    </button></li>`).join("");
  $("#ranking").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]");
    if (b) seleccionarDep(b.dataset.id, true);
  });
}

/* ---------- calendario ---------- */
function valoresScope(scope) {
  if (scope === "media") return DIARIO.nacional_media;
  if (scope === "maximo") return DIARIO.nacional_maximo;
  return DIARIO.departamentos[scope];
}
function futuros(scope) {
  const hoy = ESTADO.hoy, v = valoresScope(scope);
  return DIARIO.fechas.map((f, i) => ({ fecha: f, valor: v[i], tipo: DIARIO.tipos[i] })).filter((x) => x.fecha >= hoy);
}

function initCalendario() {
  const sel = $("#cal-scope");
  const opciones = [["media", "Todo el país (promedio)"], ["maximo", "Todo el país (departamento más crítico)"]]
    .concat(Object.entries(DIARIO.nombres).sort((a, b) => a[1].localeCompare(b[1], "es")).map(([id, n]) => [id, n]));
  sel.innerHTML = opciones.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("");
  sel.addEventListener("change", () => { calScope = sel.value; calDiaSel = null; pintarCalendario(); pintarTop(); pintarDiaSel(); });
  const hoy = ESTADO.hoy;
  calMes = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1];
  $("#cal-prev").addEventListener("click", () => cambiarMes(-1));
  $("#cal-next").addEventListener("click", () => cambiarMes(1));
  $("#cal-grid").addEventListener("click", (e) => {
    const c = e.target.closest("[data-fecha]");
    if (c && !c.classList.contains("fuera")) { calDiaSel = c.dataset.fecha; pintarCalendario(); pintarDiaSel(); }
  });
  $("#cal-top").addEventListener("click", (e) => {
    const li = e.target.closest("[data-fecha]");
    if (li) { calDiaSel = li.dataset.fecha; calMes = [Number(calDiaSel.slice(0, 4)), Number(calDiaSel.slice(5, 7)) - 1]; pintarCalendario(); pintarDiaSel(); }
  });
  pintarCalendario(); pintarTop(); pintarDiaSel();
}

function cambiarMes(delta) {
  let [y, m] = calMes; m += delta;
  if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
  calMes = [y, m]; pintarCalendario();
}

function pintarCalendario() {
  const [y, m] = calMes;
  const v = valoresScope(calScope);
  const idx = Object.fromEntries(DIARIO.fechas.map((f, i) => [f, i]));
  const primero = DIARIO.fechas[0], ultimo = DIARIO.fechas[DIARIO.fechas.length - 1];
  $("#cal-mes").textContent = new Date(y, m, 1).toLocaleDateString("es-GT", { month: "long", year: "numeric" });
  $("#cal-prev").disabled = `${y}-${String(m + 1).padStart(2, "0")}` <= primero.slice(0, 7);
  $("#cal-next").disabled = `${y}-${String(m + 1).padStart(2, "0")}` >= ultimo.slice(0, 7);
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const ndias = new Date(y, m + 1, 0).getDate();
  let html = "";
  for (let i = 0; i < offset; i++) html += '<span class="cal-vacio"></span>';
  for (let d = 1; d <= ndias; d++) {
    const iso = isoDe(y, m, d), i = idx[iso];
    if (i === undefined) { html += `<div class="cal-dia-celda fuera" aria-hidden="true"><span class="n">${d}</span></div>`; continue; }
    const r = v[i], n = nivelDe(r);
    const clases = ["cal-dia-celda", DIARIO.tipos[i], iso === ESTADO.hoy ? "hoy" : "", iso === calDiaSel ? "sel" : "", claro(n.nombre) ? "claro" : ""].join(" ");
    html += `<button type="button" class="${clases}" data-fecha="${iso}" style="background:${n.color}" title="${fechaLarga(iso)} · ${n.nombre} (${pct(r)}/100) · ${DIARIO.tipos[i] === "obs" ? "observado" : "pronóstico"}" aria-label="${fechaLarga(iso)}, riesgo ${n.nombre}">
      <span class="n">${d}</span><span class="v">${pct(r)}</span></button>`;
  }
  $("#cal-grid").innerHTML = html;
}

function pintarTop() {
  const top = futuros(calScope).filter((x) => x.fecha > ESTADO.hoy).sort((a, b) => b.valor - a.valor).slice(0, 5)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  $("#cal-top").innerHTML = top.map((x) => {
    const n = nivelDe(x.valor);
    return `<li data-fecha="${x.fecha}"><span>${fechaCorta(x.fecha)}</span><span class="chip ${claro(n.nombre) ? "claro" : ""}" style="background:${n.color}">${esc(n.nombre)} · ${pct(x.valor)}</span></li>`;
  }).join("") || "<li>Sin datos</li>";
}

function pintarDiaSel() {
  const t = $("#cal-dia-titulo"), cont = $("#cal-dia");
  if (!calDiaSel) { t.textContent = "Seleccione un día"; cont.innerHTML = '<p class="ayuda">Haga clic en un día del calendario para ver qué departamentos serían más vulnerables ese día.</p>'; return; }
  const i = DIARIO.fechas.indexOf(calDiaSel);
  t.textContent = fechaLarga(calDiaSel);
  const lista = Object.entries(DIARIO.departamentos).map(([id, arr]) => ({ id, nombre: DIARIO.nombres[id], r: arr[i] })).sort((a, b) => b.r - a.r).slice(0, 6);
  cont.innerHTML = `<p class="ayuda">${DIARIO.tipos[i] === "obs" ? "Día observado." : "Día pronosticado."} Departamentos más vulnerables:</p><ol>` +
    lista.map((x) => { const n = nivelDe(x.r); return `<li><a href="#detalle-sec" data-id="${x.id}">${esc(x.nombre)}</a> — ${esc(n.nombre)} (${pct(x.r)})</li>`; }).join("") + "</ol>";
  cont.querySelectorAll("a[data-id]").forEach((a) => a.addEventListener("click", () => seleccionarDep(a.dataset.id, false)));
}

/* ---------- detalle del departamento ---------- */
function initDetalle() {
  const sel = $("#sel-dep");
  const ordenados = ESTADO.departamentos.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  sel.innerHTML = ordenados.map((d) => `<option value="${d.id}">${esc(d.nombre)}</option>`).join("");
  sel.addEventListener("change", () => seleccionarDep(sel.value, false));
  seleccionarDep(ESTADO.departamentos[0].id, false);
}

async function seleccionarDep(id, desplazar) {
  depSel = id;
  $("#sel-dep").value = id;
  if (marcadores[id]) { marcadores[id].openTooltip(); }
  let d;
  try { d = await api("/api/departamento/" + id); } catch (e) { $("#detalle").innerHTML = "<p>No se pudo cargar el detalle.</p>"; return; }
  if (depSel !== id) return;
  const nClaro = claro(d.nivel);
  const circ = 2 * Math.PI * 42, dash = (d.equilibrio / 100) * circ;
  const colorEq = d.equilibrio >= 80 ? "#3b9c5a" : d.equilibrio >= 60 ? "#e3c542" : d.equilibrio >= 40 ? "#f08a24" : "#d9412b";
  const vars = d.variables.map((v) => `
    <tr>
      <td><strong>${esc(v.nombre)}</strong><br><small>${esc(v.regla)}</small></td>
      <td class="num"><strong>${v.actual}</strong> ${esc(v.unidad)}${v.estimado ? "<br><small>(estimado)</small>" : ""}
        <div class="medidor" title="Cercanía al nivel crítico"><i style="width:${Math.max(4, pct(v.puntaje))}%;background:${v.estado === "estable" ? "#3b9c5a" : v.estado === "vigilancia" ? "#e3a42a" : "#d9412b"}"></i></div></td>
      <td class="num">${esc(v.estable_txt)} ${esc(v.unidad)}</td>
      <td class="num">${esc(v.critico_txt)} ${esc(v.unidad)}</td>
      <td><span class="estado ${v.estado}">${v.estado === "estable" ? "Estable" : v.estado === "vigilancia" ? "Vigilancia" : "Crítico"}</span></td>
      <td>${esc(v.brecha)}<br><small>${esc(v.palanca)}</small></td>
    </tr>`).join("");
  const plan = d.plan.map((a) => `
    <article class="accion ${a.prioridad.split(" ")[0]}">
      <span class="et">${esc(a.prioridad)}${a.variable ? " · " + esc(a.variable) : ""}</span>
      <h4>${esc(a.titulo)}</h4><p>${esc(a.detalle)}</p>
    </article>`).join("");
  $("#detalle").innerHTML = `
    <div class="res-dep">
      <svg class="donut" viewBox="0 0 100 100" role="img" aria-label="Equilibrio ambiental ${d.equilibrio} de 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#eee8d8" stroke-width="10"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="${colorEq}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash} ${circ}" transform="rotate(-90 50 50)"/>
        <text x="50" y="48" text-anchor="middle" font-size="22" font-weight="700" font-family="Georgia,serif" fill="#1d2a21">${d.equilibrio}</text>
        <text x="50" y="64" text-anchor="middle" font-size="9" fill="#5d6b60">equilibrio</text>
      </svg>
      <div>
        <h3>${esc(d.nombre)} <span class="chip ${nClaro ? "claro" : ""}" style="background:${d.color}">${esc(d.nivel)} · ${pct(d.riesgo)}/100</span></h3>
        <p class="ayuda" style="margin:0">Altitud de referencia: ${d.elev} m · Último dato observado: ${fechaCorta(d.fecha_dato)} · Fuente: ${d.fuente === "SIMULADO" ? "<strong>simulada (demostración)</strong>" : "NASA POWER"}.<br>
        Un equilibrio de 100 significa que todas las variables están en el rango estable.</p>
      </div>
    </div>
    <h3>Variables actuales frente al rango estable</h3>
    <div class="tabla-scroll"><table>
      <thead><tr><th>Variable</th><th>Valor actual</th><th>Rango estable</th><th>Nivel crítico</th><th>Estado</th><th>Brecha y cómo equilibrarla</th></tr></thead>
      <tbody>${vars}</tbody></table></div>
    <h3>Riesgo: últimos 30 días y próximos 45 días</h3>
    ${grafica(d.serie)}
    <h3>Plan de prevención recomendado</h3>
    <div class="plan">${plan}</div>`;
  if (desplazar) $("#detalle-sec").scrollIntoView({ behavior: "smooth", block: "start" });
}

function grafica(serie) {
  const W = 760, H = 250, ml = 44, mr = 14, mt = 14, mb = 30;
  const maxY = Math.max(0.7, ...serie.map((s) => s.riesgo)) * 1.08;
  const x = (i) => ml + (i / (serie.length - 1)) * (W - ml - mr);
  const y = (v) => mt + (1 - v / maxY) * (H - mt - mb);
  const iHoy = serie.findIndex((s) => s.fecha >= ESTADO.hoy);
  let bandas = "", prev = 0;
  for (const n of DIARIO.umbrales_nivel) {
    const tope = Math.min(n.hasta, maxY);
    if (prev < maxY) bandas += `<rect x="${ml}" y="${y(tope)}" width="${W - ml - mr}" height="${y(prev) - y(tope)}" fill="${n.color}" opacity="0.13"/>`;
    prev = n.hasta;
  }
  const ticks = [0, 0.2, 0.35, 0.5, 0.65].filter((t) => t < maxY).map((t) => `<line x1="${ml}" x2="${W - mr}" y1="${y(t)}" y2="${y(t)}" stroke="#d8d2c0" stroke-width="0.7"/><text x="${ml - 6}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="#5d6b60">${pct(t)}</text>`).join("");
  const pts = (arr) => arr.map((s) => `${x(serie.indexOf(s)).toFixed(1)},${y(s.riesgo).toFixed(1)}`).join(" ");
  const obs = serie.filter((s) => s.tipo === "obs"), pred = serie.filter((s) => s.tipo === "pred");
  const unir = obs.length ? [obs[obs.length - 1]].concat(pred) : pred;
  const marcasX = serie.map((s, i) => ({ s, i })).filter(({ s, i }) => i % 10 === 0 || i === serie.length - 1)
    .map(({ s, i }) => `<text x="${x(i)}" y="${H - 8}" text-anchor="${i === serie.length - 1 ? "end" : "middle"}" font-size="11" fill="#5d6b60">${fechaCorta(s.fecha)}</text>`).join("");
  const puntos = serie.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.riesgo)}" r="5" fill="transparent"><title>${fechaCorta(s.fecha)} · ${s.nivel} (${pct(s.riesgo)}/100) · ${s.tipo === "obs" ? "observado" : "pronóstico"}</title></circle>`).join("");
  return `<svg class="grafica" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica del riesgo de incendio por día">
    ${bandas}${ticks}
    <line x1="${x(iHoy)}" x2="${x(iHoy)}" y1="${mt}" y2="${H - mb}" stroke="#1b6fd6" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text x="${x(iHoy) + 4}" y="${mt + 10}" font-size="11" fill="#1b6fd6">hoy</text>
    <polyline points="${pts(obs)}" fill="none" stroke="#1d2a21" stroke-width="2.4"/>
    <polyline points="${pts(unir)}" fill="none" stroke="#d9531e" stroke-width="2.4" stroke-dasharray="6 4"/>
    ${marcasX}${puntos}
    <text x="${ml}" y="${H - 8}" font-size="0"> </text>
  </svg>
  <p class="chico">Línea negra: observado · Línea naranja punteada: pronóstico · Franjas: niveles de riesgo (0-100).</p>`;
}

/* ---------- metodología ---------- */
function pintarMetodo() {
  $("#tabla-rangos").innerHTML = `<thead><tr><th>Variable</th><th>Rango estable (neutro)</th><th>Nivel crítico</th><th>Peso</th><th>Por qué importa</th><th>¿Se puede influir?</th></tr></thead><tbody>` +
    RANGOS.variables.map((v) => {
      const bajoMalo = v.estable > v.critico;
      return `<tr><td><strong>${esc(v.nombre)}</strong></td><td class="num">${bajoMalo ? "≥" : "≤"} ${v.estable} ${esc(v.unidad)}${v.clave === "tmax" ? "*" : ""}</td><td class="num">${bajoMalo ? "≤" : "≥"} ${v.critico} ${esc(v.unidad)}${v.clave === "tmax" ? "*" : ""}</td><td class="num">${pct(v.peso)}%</td><td>${esc(v.regla)}</td><td>${esc(v.palanca)}</td></tr>`;
    }).join("") + "</tbody>";
  $("#notas-metodo").innerHTML = `
    <p>* ${esc(RANGOS.nota_temperatura)} Los valores de temperatura de la tabla son solo una referencia general; el detalle de cada departamento muestra los valores ya ajustados.</p>
    <p><strong>Índice de peligro</strong> = suma de (peso × puntaje) de las seis variables, donde cada puntaje va de 0 (estable) a 1 (crítico). El <strong>riesgo</strong> lo ajusta según la presión de ignición del mes (quemas agrícolas y de pastos, más frecuentes entre febrero y mayo).</p>
    <p><strong>Equilibrio ambiental</strong> = 100 × (1 − índice de peligro). Si es 100, todas las variables están dentro del rango estable.</p>`;
}

init();
