"""Focos de calor de las últimas 24 horas (MODIS + VIIRS) de NASA FIRMS, casi en tiempo real.

FIRMS publica cada detección entre ~1 y 3 horas después de que el satélite pasa
(procesamiento "NRT"). Este módulo pide esos datos al servidor de la NASA y los entrega a
la página; NO inventa ni rellena datos: si no hay conexión, devuelve el error.

Dos formas de obtenerlos (se usa la primera disponible):
  1. API de FIRMS (si existe la variable de entorno FIRMS_MAP_KEY; clave gratuita en
     https://firms.modaps.eosdis.nasa.gov/api/map_key/):
       /api/area/csv/{MAP_KEY}/{FUENTE}/{oeste,sur,este,norte}/{días}
  2. CSV públicos "Active Fire Data" de las últimas 24 h (sin clave):
       https://firms.modaps.eosdis.nasa.gov/data/active_fire/<sensor>/csv/<archivo>_24h.csv
     (primero el archivo regional de Centroamérica; si no existe, el global).

Limpieza: se descartan detecciones de baja confianza, fuentes no vegetales de MODIS
(type != 0), los volcanes activos (radio 4 km) y lo que cae fuera de Guatemala.
"""
import csv
import datetime as dt
import io
import math
import os
import threading
import time

import requests

from departamentos import CONTORNO

MAP_KEY = os.environ.get("FIRMS_MAP_KEY", "").strip()
LIM = (-92.4, 13.6, -88.1, 17.9)          # oeste, sur, este, norte
TTL_SEG = 600                              # no consultar a la NASA más de una vez cada 10 min
UTC_LOCAL = dt.timedelta(hours=-6)         # Guatemala: UTC-6 todo el año
URL_PUBLICA = "https://firms.modaps.eosdis.nasa.gov/data/active_fire"
URL_API = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

# sensor -> (fuente API, carpeta pública, prefijo de archivo público)
FUENTES = {
    "MODIS": ("MODIS_NRT", "modis-c6.1", "MODIS_C6_1"),
    "VIIRS-SNPP": ("VIIRS_SNPP_NRT", "suomi-npp-viirs-c2", "SUOMI_VIIRS_C2"),
    "VIIRS-NOAA20": ("VIIRS_NOAA20_NRT", "noaa-20-viirs-c2", "J1_VIIRS_C2"),
    "VIIRS-NOAA21": ("VIIRS_NOAA21_NRT", "noaa-21-viirs-c2", "J2_VIIRS_C2"),
}
VOLCANES = [(14.473, -90.880), (14.501, -90.876), (14.381, -90.601), (14.756, -91.552), (15.132, -92.109)]
SAT_MODIS = {"T": "Terra", "TERRA": "Terra", "A": "Aqua", "AQUA": "Aqua"}
SAT_VIIRS = {"N": "SNPP", "NPP": "SNPP", "N20": "NOAA-20", "N21": "NOAA-21"}

_candado = threading.Lock()
_cache = {"t": 0.0, "datos": None}


def _dentro(lat, lon):
    c = False
    p = CONTORNO
    j = len(p) - 1
    for i in range(len(p)):
        yi, xi = p[i]
        yj, xj = p[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


def _cerca_de_volcan(lat, lon):
    for vlat, vlon in VOLCANES:
        dy = (lat - vlat) * 111.2
        dx = (lon - vlon) * 111.2 * math.cos(math.radians(vlat))
        if dx * dx + dy * dy < 16.0:
            return True
    return False


def _pedir(url):
    r = requests.get(url, timeout=(8, 90), headers={"User-Agent": "FuegoAlertaGT/3.1"})
    return r


def _descargar_sensor(sensor):
    """Devuelve el texto CSV de las últimas 24 h de un sensor (o lanza RuntimeError)."""
    api, carpeta, prefijo = FUENTES[sensor]
    if MAP_KEY:
        caja = ",".join(str(v) for v in LIM)
        # 2 días UTC cubren las últimas 24 h; luego se filtra por hora exacta.
        r = _pedir(f"{URL_API}/{MAP_KEY}/{api}/{caja}/2")
        r.raise_for_status()
        if not r.text.lower().startswith("latitude"):
            raise RuntimeError(f"respuesta inesperada de la API ({r.text[:60]!r})")
        return r.text
    ultimo = None
    for region in ("Central_America", "Global"):
        r = _pedir(f"{URL_PUBLICA}/{carpeta}/csv/{prefijo}_{region}_24h.csv")
        if r.status_code == 404:
            ultimo = f"{region}: no existe"
            continue
        r.raise_for_status()
        if r.text.lower().startswith("latitude"):
            return r.text
        ultimo = f"{region}: contenido inesperado"
    raise RuntimeError(ultimo or "sin respuesta")


def _filtrar(texto, sensor, desde_utc):
    """Convierte un CSV de FIRMS en una lista de focos limpios dentro de Guatemala."""
    salida = []
    for f in csv.DictReader(io.StringIO(texto)):
        f = {(k or "").strip().lower(): (v or "").strip() for k, v in f.items()}
        try:
            lat, lon = float(f["latitude"]), float(f["longitude"])
            hhmm = f.get("acq_time", "0").zfill(4)
            utc = dt.datetime.strptime(f["acq_date"][:10], "%Y-%m-%d") + dt.timedelta(hours=int(hhmm[:2]), minutes=int(hhmm[2:4]))
        except (KeyError, ValueError):
            continue
        if utc < desde_utc or not (LIM[0] <= lon <= LIM[2] and LIM[1] <= lat <= LIM[3]):
            continue
        conf = f.get("confidence", "").lower()
        if conf in ("l", "low") or (conf.isdigit() and int(conf) < 30):
            continue
        if sensor == "MODIS" and f.get("type", "0") not in ("", "0"):
            continue
        if not _dentro(lat, lon) or _cerca_de_volcan(lat, lon):
            continue
        sat = f.get("satellite", "").upper()
        sat = SAT_MODIS.get(sat, sat) if sensor == "MODIS" else SAT_VIIRS.get(sat, sensor.split("-", 1)[1])
        try:
            frp = round(float(f.get("frp", "")), 1)
        except ValueError:
            frp = None
        local = utc + UTC_LOCAL
        salida.append({"lat": round(lat, 4), "lon": round(lon, 4), "sensor": sensor.split("-")[0], "sat": sat,
                       "frp": frp, "utc": utc.isoformat(timespec="minutes") + "Z", "local": local.isoformat(timespec="minutes"),
                       "conf": conf or None, "noche": f.get("daynight", "") == "N"})
    return salida


def obtener(forzar=False, descargar=_descargar_sensor, ahora=None):
    """Focos de las últimas 24 h. Devuelve un dict con 'focos', conteos y estado por sensor."""
    with _candado:
        t = time.monotonic()
        if not forzar and _cache["datos"] and t - _cache["t"] < TTL_SEG:
            return _cache["datos"]
        utc_ahora = ahora or dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
        desde = utc_ahora - dt.timedelta(hours=24)
        focos, sensores = [], {}
        for sensor in FUENTES:
            try:
                f = _filtrar(descargar(sensor), sensor, desde)
                focos += f
                sensores[sensor] = {"ok": True, "n": len(f)}
            except Exception as e:  # noqa: BLE001 - se informa tal cual en la página
                sensores[sensor] = {"ok": False, "n": 0, "error": f"{type(e).__name__}: {str(e)[:100]}"}
        if not any(s["ok"] for s in sensores.values()):
            if _cache["datos"]:      # sirve lo último real, avisando su antigüedad
                viejo = dict(_cache["datos"]); viejo["desactualizado"] = True; viejo["sensores"] = sensores
                return viejo
            raise RuntimeError("; ".join(f"{k}: {v['error']}" for k, v in sensores.items()))
        # duplicados (el mismo punto lo puede traer la lista regional y la global)
        vistos, unicos = set(), []
        for f in focos:
            k = (f["lat"], f["lon"], f["utc"], f["sat"])
            if k not in vistos:
                vistos.add(k); unicos.append(f)
        inicio_hoy_utc = dt.datetime.combine((utc_ahora + UTC_LOCAL).date(), dt.time()) - UTC_LOCAL
        for f in unicos:
            f["hoy"] = f["utc"] >= inicio_hoy_utc.isoformat(timespec="minutes") + "Z"
        ultimo = max((f["local"] for f in unicos), default=None)
        datos = {
            "focos": unicos, "total": len(unicos), "hoy": sum(1 for f in unicos if f["hoy"]),
            "modis": sum(1 for f in unicos if f["sensor"] == "MODIS"), "viirs": sum(1 for f in unicos if f["sensor"] == "VIIRS"),
            "sensores": sensores, "ultima_deteccion_local": ultimo,
            "actualizado_utc": utc_ahora.isoformat(timespec="seconds") + "Z",
            "actualizado_local": (utc_ahora + UTC_LOCAL).isoformat(timespec="seconds"),
            "fuente": "API de FIRMS (MAP_KEY)" if MAP_KEY else "CSV públicos de FIRMS (24 h)", "desactualizado": False,
        }
        _cache["t"], _cache["datos"] = t, datos
        return datos
