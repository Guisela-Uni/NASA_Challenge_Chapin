"""Archivo histórico armonizado MODIS + VIIRS (NASA FIRMS, 2000–2025).

El CSV (~24 MB, ~370 mil filas) se lee UNA sola vez y se guarda en memoria en
formato compacto (arreglos de números en lugar de diccionarios), así:
  - cada consulta responde en milisegundos en lugar de releer el archivo;
  - cabe holgado en los 512 MB del plan gratuito de Render (~20 MB).
Como el archivo viene ordenado por fecha, una consulta por día, mes o año es
solo buscar el rango de filas con bisect (búsqueda binaria).
"""
import bisect
import csv
import threading
from array import array
from pathlib import Path

RUTA = Path(__file__).resolve().parent.parent / "armonizacion" / "resultados_historicos" / "calendario_armonizado.csv"
ANIOS = range(2000, 2026)

_candado = threading.Lock()
_datos = None          # se llena con cargar()


def disponible():
    return RUTA.is_file()


def cargar():
    """Lee el CSV una vez (seguro aunque lo llamen varios hilos a la vez)."""
    global _datos
    if _datos is not None:
        return _datos
    with _candado:
        if _datos is not None:
            return _datos
        fechas, cx, cy = [], array("i"), array("i")
        modis, viirs, asoc = array("i"), array("i"), array("i")
        lat, lon = array("d"), array("d")
        internas = {}
        with RUTA.open("r", encoding="utf-8-sig", newline="") as archivo:
            for fila in csv.DictReader(archivo):
                f = fila["fecha_gt"]
                fechas.append(internas.setdefault(f, f))     # una sola copia de cada fecha
                cx.append(int(fila["celda_x"]))
                cy.append(int(fila["celda_y"]))
                modis.append(int(fila["MODIS"]))
                viirs.append(int(fila["VIIRS"]))
                asoc.append(int(fila["detecciones_asociadas"]))
                lat.append(float(fila["latitude"]))
                lon.append(float(fila["longitude"]))
        if fechas != sorted(fechas):                       # bisect necesita orden por fecha
            orden = sorted(range(len(fechas)), key=fechas.__getitem__)
            fechas = [fechas[i] for i in orden]
            cx, cy = array("i", (cx[i] for i in orden)), array("i", (cy[i] for i in orden))
            modis, viirs = array("i", (modis[i] for i in orden)), array("i", (viirs[i] for i in orden))
            asoc = array("i", (asoc[i] for i in orden))
            lat, lon = array("d", (lat[i] for i in orden)), array("d", (lon[i] for i in orden))

        # Resúmenes que no dependen de la consulta: se calculan una vez
        evol = {a: {"anio": a, "modis": 0, "viirs": 0, "ambos": 0, "total": 0} for a in ANIOS}
        cal = {(a, m): {"anio": a, "mes": m, "modis": 0, "viirs": 0, "ambos": 0, "total": 0} for a in ANIOS for m in range(1, 13)}
        for i, f in enumerate(fechas):
            a, m = int(f[:4]), int(f[5:7])
            hay_m, hay_v = modis[i] > 0, viirs[i] > 0
            e = evol.get(a)
            if e is not None:                  # evolución: MODIS y VIIRS incluyen los "ambos"
                e["total"] += 1
                e["modis"] += hay_m
                e["viirs"] += hay_v
                e["ambos"] += hay_m and hay_v
            c = cal.get((a, m))
            if c is not None:                  # calendario/mensual: categorías excluyentes
                c["total"] += 1
                if hay_m and hay_v:
                    c["ambos"] += 1
                elif hay_m:
                    c["modis"] += 1
                elif hay_v:
                    c["viirs"] += 1
        _datos = {"fechas": fechas, "cx": cx, "cy": cy, "modis": modis, "viirs": viirs, "asoc": asoc,
                  "lat": lat, "lon": lon, "evolucion": list(evol.values()), "calendario": cal}
        return _datos


def precargar_en_segundo_plano():
    """Carga el archivo al arrancar el servidor, sin bloquear las primeras visitas."""
    if disponible():
        threading.Thread(target=cargar, daemon=True).start()


def _rango(d, periodo, valor):
    f = d["fechas"]
    if periodo == "dia":
        return bisect.bisect_left(f, valor), bisect.bisect_right(f, valor)
    prefijo = valor + "-"                               # "2024-03-" o "2024-"
    return bisect.bisect_left(f, prefijo), bisect.bisect_left(f, prefijo + "￿")


def detecciones(periodo, valor):
    """Celdas con actividad térmica en un día, mes o año (mismo formato que antes)."""
    d = cargar()
    ini, fin = _rango(d, periodo, valor)
    celdas = {}
    for i in range(ini, fin):
        clave = (d["cx"][i], d["cy"][i])
        c = celdas.get(clave)
        if c is None:
            c = celdas[clave] = {"lat": d["lat"][i], "lon": d["lon"][i], "modis": 0, "viirs": 0,
                                 "ambos_sensores": False, "detecciones_asociadas": 0, "dias_activos": 0}
        c["modis"] += d["modis"][i]
        c["viirs"] += d["viirs"][i]
        c["detecciones_asociadas"] += d["asoc"][i]
        c["dias_activos"] += 1
    lista = list(celdas.values())
    for c in lista:
        c["ambos_sensores"] = c["modis"] > 0 and c["viirs"] > 0
        c["fuente"] = "MODIS y VIIRS" if c["ambos_sensores"] else ("MODIS" if c["modis"] > 0 else "VIIRS")
    return lista, fin - ini


def evolucion():
    return [dict(x) for x in cargar()["evolucion"]]


def calendario():
    return [dict(x) for x in cargar()["calendario"].values()]


def mensual(anio):
    cal = cargar()["calendario"]
    return [{k: v for k, v in cal[(anio, m)].items() if k != "anio"} for m in range(1, 13)]
