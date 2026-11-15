"""Búsqueda de departamentos y municipios de Guatemala y riesgo de incendio para un punto exacto.

- Departamentos: lista local (departamentos.py), sin conexión.
- Municipios y otros lugares: geocodificador Nominatim de OpenStreetMap (limitado a Guatemala).
  Se respeta su política de uso: máximo 1 consulta por segundo, caché y User-Agent propio.
  Opcional: variable NOMINATIM_EMAIL con un correo de contacto.
- Para un municipio se descarga la serie de NASA POWER de SU punto (no la del departamento) y se
  calcula el riesgo con el mismo modelo, usando la ALTITUD del municipio (Open-Meteo Elevation;
  si falla, la del departamento más cercano, y se avisa).
Nada se inventa: si un servicio no responde se devuelve el error.
"""
import datetime as dt
import math
import os
import threading
import time
import unicodedata

import requests

import modelo
import nasa_data
from departamentos import CONTORNO, DEPARTAMENTOS

NOMINATIM = "https://nominatim.openstreetmap.org/search"
ELEVACION = "https://api.open-meteo.com/v1/elevation"
EMAIL = os.environ.get("NOMINATIM_EMAIL", "").strip()
UA = "FuegoAlertaGT/3.2" + (f" ({EMAIL})" if EMAIL else "")
TTL_BUSQUEDA = 24 * 3600
TTL_PUNTO = 6 * 3600
LIM = (-92.4, 13.6, -88.1, 17.9)

_candado_nom = threading.Lock()
_ultimo_nom = [0.0]
_cache_busq, _cache_punto = {}, {}
_candado_punto = threading.Lock()


def norm(t):
    t = unicodedata.normalize("NFD", t or "")
    return "".join(c for c in t if unicodedata.category(c) != "Mn").lower().strip()


def km(lat1, lon1, lat2, lon2):
    dy = (lat1 - lat2) * 111.2
    dx = (lon1 - lon2) * 111.2 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(dx, dy)


def dentro_de_guatemala(lat, lon):
    if not (LIM[0] <= lon <= LIM[2] and LIM[1] <= lat <= LIM[3]):
        return False
    c, j = False, len(CONTORNO) - 1
    for i in range(len(CONTORNO)):
        yi, xi = CONTORNO[i]; yj, xj = CONTORNO[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


def dep_mas_cercano(lat, lon):
    d = min(DEPARTAMENTOS, key=lambda x: km(lat, lon, x["lat"], x["lon"]))
    return d, km(lat, lon, d["lat"], d["lon"])


def _departamentos_locales(q):
    n = norm(q)
    return [{"tipo": "departamento", "id": d["id"], "nombre": d["nombre"], "departamento": d["nombre"],
             "etiqueta": f"{d['nombre']} (departamento)", "lat": d["lat"], "lon": d["lon"]}
            for d in DEPARTAMENTOS if n in norm(d["nombre"])]


def _nominatim(q):
    """Consulta a Nominatim (1 por segundo como máximo)."""
    with _candado_nom:
        espera = 1.1 - (time.monotonic() - _ultimo_nom[0])
        if espera > 0:
            time.sleep(espera)
        _ultimo_nom[0] = time.monotonic()
        params = {"q": f"{q}, Guatemala", "countrycodes": "gt", "format": "jsonv2", "addressdetails": 1,
                  "limit": 8, "accept-language": "es"}
        if EMAIL:
            params["email"] = EMAIL
        r = requests.get(NOMINATIM, params=params, timeout=(6, 20), headers={"User-Agent": UA})
        r.raise_for_status()
        return r.json()


def _desde_nominatim(item):
    a = item.get("address", {})
    nombre = item.get("name") or item.get("display_name", "").split(",")[0]
    muni = a.get("municipality") or a.get("county") or a.get("city") or a.get("town")
    depto = a.get("state") or ""
    depto = depto.replace("Departamento de ", "").replace("Departamento del ", "")
    try:
        lat, lon = float(item["lat"]), float(item["lon"])
    except (KeyError, ValueError):
        return None
    if not dentro_de_guatemala(lat, lon):
        return None
    tipo = "municipio" if item.get("addresstype") in ("municipality", "county", "city", "town") or item.get("type") == "administrative" else "lugar"
    partes = [p for p in (nombre, muni if muni and muni != nombre else None, depto or None) if p]
    return {"tipo": tipo, "nombre": nombre, "municipio": muni or nombre, "departamento": depto,
            "etiqueta": ", ".join(partes), "lat": round(lat, 5), "lon": round(lon, 5)}


def buscar(q):
    """Devuelve (resultados, aviso). Los departamentos salen aunque falle el geocodificador."""
    q = (q or "").strip()[:80]
    if len(q) < 2:
        return [], None
    res = _departamentos_locales(q)
    aviso = None
    clave = norm(q)
    ahora = time.time()
    hit = _cache_busq.get(clave)
    if hit and ahora - hit[0] < TTL_BUSQUEDA:
        remotos = hit[1]
    else:
        try:
            remotos = [x for x in (_desde_nominatim(i) for i in _nominatim(q)) if x]
            if len(_cache_busq) > 500:
                _cache_busq.clear()
            _cache_busq[clave] = (ahora, remotos)
        except Exception as e:  # noqa: BLE001
            remotos, aviso = [], f"No se pudo consultar el buscador de municipios (OpenStreetMap): {type(e).__name__}"
    vistos = {(r["etiqueta"]) for r in res}
    for r in remotos:
        if r["etiqueta"] not in vistos:
            vistos.add(r["etiqueta"]); res.append(r)
    return res[:10], aviso


def _elevacion(lat, lon):
    r = requests.get(ELEVACION, params={"latitude": lat, "longitude": lon}, timeout=(5, 10), headers={"User-Agent": UA})
    r.raise_for_status()
    return float(r.json()["elevation"][0])


def analizar_punto(lat, lon, nombre="Punto seleccionado", hoy=None, descargar=None, elevacion=None):
    """Riesgo de incendio hoy para un punto exacto (series de NASA POWER de ese punto)."""
    if not dentro_de_guatemala(lat, lon):
        raise ValueError("El punto está fuera de Guatemala.")
    hoy = hoy or dt.date.today()
    descargar = descargar or nasa_data._descargar
    elevacion = elevacion or _elevacion
    cercano, dist = dep_mas_cercano(lat, lon)
    try:
        elev, elev_fuente = round(elevacion(lat, lon)), "Open-Meteo (modelo digital de elevación)"
    except Exception:  # noqa: BLE001
        elev, elev_fuente = cercano["elev"], f"estimada con la del departamento más cercano ({cercano['nombre']})"
    clave = (round(lat, 2), round(lon, 2))
    with _candado_punto:
        hit = _cache_punto.get(clave)
        if hit and time.time() - hit[0] < TTL_PUNTO:
            filas = hit[1]
        else:
            filas = descargar({"lat": lat, "lon": lon}, dt.date(hoy.year - nasa_data.ANIOS_HISTORIA, 1, 1), hoy)
            if len(_cache_punto) > 40:
                _cache_punto.clear()
            _cache_punto[clave] = (time.time(), filas)
    dep = {"id": "punto", "nombre": nombre, "lat": lat, "lon": lon, "elev": elev}
    serie = modelo.serie_de_riesgo(dep, filas, hoy)
    actual = modelo.dia_actual(serie)
    de_hoy = next((d for d in serie["dias"] if d["fecha"] == hoy.isoformat()), actual)
    limite = (hoy + dt.timedelta(days=14)).isoformat()
    futuros = [d for d in serie["dias"] if hoy.isoformat() <= d["fecha"] <= limite]
    pico = max(futuros, key=lambda d: d["riesgo"]) if futuros else de_hoy
    return {
        "nombre": nombre, "lat": lat, "lon": lon, "elev": elev, "elev_fuente": elev_fuente,
        "dep_cercano": {"id": cercano["id"], "nombre": cercano["nombre"], "km": round(dist)},
        "fecha_dato": actual["fecha"], "riesgo_hoy": de_hoy["riesgo"], "nivel_hoy": de_hoy["nivel"], "color_hoy": de_hoy["color"],
        "riesgo": actual["riesgo"], "nivel": actual["nivel"], "color": actual["color"], "equilibrio": modelo.equilibrio(de_hoy),
        "variables": modelo.tabla_variables(dep, actual), "plan": modelo.plan_prevencion(dep, de_hoy),
        "pico": {"fecha": pico["fecha"], "riesgo": pico["riesgo"], "nivel": pico["nivel"], "color": pico["color"]},
        "resolucion_clima_km": 50,
    }
