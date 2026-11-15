"""Obtención de variables climáticas desde NASA POWER (con respaldo simulado).

Fuente real: API NASA POWER, endpoint diario por punto, comunidad AG
(agroclimatología). No requiere clave.
    https://power.larc.nasa.gov/api/temporal/daily/point

Variables solicitadas:
    T2M_MAX      temperatura máxima a 2 m (°C)
    RH2M         humedad relativa a 2 m (%)
    PRECTOTCORR  precipitación corregida (mm/día)
    WS2M         velocidad del viento a 2 m (m/s)
    GWETTOP      humedad del suelo superficial (fracción 0-1)

Si la API no responde (sin internet, bloqueo de red, etc.) la aplicación NO se
detiene: usa la última copia REAL guardada en cache/ y lo avisa; si no hay ninguna,
muestra el error (los datos SIMULADOS solo existen con MODO_DEMO=1).
"""
import datetime as dt
import json
import math
import os
import random
import threading
from concurrent.futures import ThreadPoolExecutor

import requests

from departamentos import DEPARTAMENTOS

POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMETROS = ["T2M_MAX", "RH2M", "PRECTOTCORR", "WS2M", "GWETTOP"]
ANIOS_HISTORIA = 6          # años de historia para calcular la climatología
TTL_HORAS = 6               # cada cuánto se refrescan los datos
CARPETA_CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
MODO_DEMO = os.environ.get("MODO_DEMO", "0") == "1"   # fuerza datos simulados

_CLAVES = ["tmax", "rh", "precip", "wind", "soil"]


# --------------------------------------------------------------------------
# Descarga desde NASA POWER
# --------------------------------------------------------------------------
def _pedir_power(dep, inicio, fin, parametros):
    consulta = {
        "parameters": ",".join(parametros),
        "community": "AG",
        "longitude": dep["lon"],
        "latitude": dep["lat"],
        "start": inicio.strftime("%Y%m%d"),
        "end": fin.strftime("%Y%m%d"),
        "format": "JSON",
    }
    r = requests.get(POWER_URL, params=consulta, timeout=(6, 90),
                     headers={"User-Agent": "FuegoAlertaGT/1.0"})
    r.raise_for_status()
    return r.json()["properties"]["parameter"]


def _limpiar(valor):
    """NASA POWER marca los datos faltantes con -999."""
    if valor is None or valor <= -900:
        return None
    return float(valor)


def _parsear(par):
    """Convierte la respuesta de POWER en una lista de filas diarias."""
    fechas = sorted(par["T2M_MAX"].keys())
    filas = []
    for f in fechas:
        filas.append({
            "fecha": dt.datetime.strptime(f, "%Y%m%d").date(),
            "tmax": _limpiar(par["T2M_MAX"].get(f)),
            "rh": _limpiar(par.get("RH2M", {}).get(f)),
            "precip": _limpiar(par.get("PRECTOTCORR", {}).get(f)),
            "wind": _limpiar(par.get("WS2M", {}).get(f)),
            "soil": _limpiar(par.get("GWETTOP", {}).get(f)),
        })
    # Quitar los últimos días sin dato (POWER publica con 2-3 días de retraso)
    while filas and filas[-1]["tmax"] is None:
        filas.pop()
    # Quitar los primeros días incompletos (no hay valor previo con qué rellenar).
    # La humedad del suelo puede faltar por completo y el modelo lo tolera.
    while filas and any(filas[0][k] is None for k in ("tmax", "rh", "wind")):
        filas.pop(0)
    # Rellenar huecos internos con el último valor conocido
    previo = {k: None for k in _CLAVES}
    for fila in filas:
        for k in _CLAVES:
            if fila[k] is None:
                fila[k] = 0.0 if (k == "precip") else previo[k]
            else:
                previo[k] = fila[k]
    return filas


def _descargar(dep, inicio, fin):
    try:
        par = _pedir_power(dep, inicio, fin, PARAMETROS)
    except requests.HTTPError as e:
        # Si GWETTOP no está disponible, reintentar sin esa variable.
        if e.response is not None and e.response.status_code in (400, 422):
            par = _pedir_power(dep, inicio, fin, PARAMETROS[:-1])
        else:
            raise
    filas = _parsear(par)
    if len(filas) < 60:
        raise ValueError("NASA POWER devolvió muy pocos datos")
    return filas


# --------------------------------------------------------------------------
# Caché en disco (evita descargar 22 series largas en cada arranque)
# --------------------------------------------------------------------------
def _ruta_cache(dep):
    return os.path.join(CARPETA_CACHE, f"power_{dep['id']}.json")


def _leer_cache(dep, permitir_viejo=False):
    """Lee la caché en disco. Con permitir_viejo=True la devuelve aunque tenga
    más de TTL_HORAS: sirve para arrancar al instante mientras se actualiza."""
    ruta = _ruta_cache(dep)
    try:
        if not permitir_viejo and (dt.datetime.now().timestamp() - os.path.getmtime(ruta)) > TTL_HORAS * 3600:
            return None
        with open(ruta, encoding="utf-8") as fh:
            crudo = json.load(fh)
        filas = [{"fecha": dt.date.fromisoformat(r[0]), "tmax": r[1], "rh": r[2],
                  "precip": r[3], "wind": r[4], "soil": r[5]} for r in crudo["filas"]]
        return {"filas": filas, "fuente": "NASA POWER", "actualizado": crudo["actualizado"], "error": None}
    except Exception:
        return None


def _guardar_cache(dep, filas, actualizado):
    try:
        os.makedirs(CARPETA_CACHE, exist_ok=True)
        with open(_ruta_cache(dep), "w", encoding="utf-8") as fh:
            json.dump({"actualizado": actualizado,
                       "filas": [[f["fecha"].isoformat(), f["tmax"], f["rh"], f["precip"],
                                  f["wind"], f["soil"]] for f in filas]}, fh)
    except OSError:
        pass  # la caché es opcional


# --------------------------------------------------------------------------
# Modo demostración: datos SIMULADOS (no son mediciones reales)
# --------------------------------------------------------------------------
_PERFIL = {
    # lluvia_pico (mm/día en temporada lluviosa), rh_seca, rh_lluvia, viento_seco, viento_lluvia, amplitud estacional
    "humedo":        dict(lluvia=14, rh_seca=72, rh_ll=88, v_seca=1.6, v_ll=1.2, amp=0.6),
    "selva":         dict(lluvia=9,  rh_seca=62, rh_ll=85, v_seca=1.5, v_ll=1.1, amp=0.9),
    "costa":         dict(lluvia=13, rh_seca=64, rh_ll=86, v_seca=2.2, v_ll=1.6, amp=1.0),
    "altiplano":     dict(lluvia=8,  rh_seca=52, rh_ll=82, v_seca=2.4, v_ll=1.7, amp=1.0),
    "corredor_seco": dict(lluvia=6,  rh_seca=42, rh_ll=76, v_seca=3.0, v_ll=1.8, amp=1.2),
}


def simular(dep, inicio, fin):
    """Serie diaria simulada y reproducible (misma semilla => mismos datos)."""
    p = _PERFIL[dep["clima"]]
    filas = []
    suelo = 0.35
    dia = inicio
    while dia <= fin:
        rng = random.Random(f"{dep['id']}-{dia.isoformat()}")
        doy = dia.timetuple().tm_yday
        # w ~ 1 en la época lluviosa (mediados de mayo a octubre), ~ 0 en la seca
        # (noviembre a abril), con un leve descenso por la canícula de julio.
        sig = lambda x: 1.0 / (1.0 + math.exp(-x))   # noqa: E731
        w = sig((doy - 135) / 10.0) - sig((doy - 305) / 10.0)
        w = max(0.0, w * (1 - 0.15 * math.exp(-((doy - 200) / 10.0) ** 2)))
        prob_lluvia = 0.05 + 0.85 * w
        lluvia = 0.0
        if rng.random() < prob_lluvia:
            lluvia = rng.expovariate(1.0 / max(1.0, p["lluvia"] * (0.25 + 0.75 * w)))
        tmax_base = 34.0 - 0.0065 * dep["elev"]
        tmax = tmax_base + p["amp"] * 2.8 * (1 - w) - 1.0 * w + rng.gauss(0, 1.2) - (1.5 if lluvia > 5 else 0)
        rh = p["rh_seca"] + (p["rh_ll"] - p["rh_seca"]) * w + rng.gauss(0, 5) + (4 if lluvia > 1 else 0)
        rh = max(15.0, min(99.0, rh))
        viento = max(0.3, p["v_seca"] + (p["v_ll"] - p["v_seca"]) * w + rng.gauss(0, 0.5))
        suelo = suelo * 0.93 + lluvia * 0.012 + 0.012 * w
        suelo = max(0.08, min(0.95, suelo))
        filas.append({"fecha": dia, "tmax": round(tmax, 1), "rh": round(rh, 1),
                      "precip": round(lluvia, 2), "wind": round(viento, 2), "soil": round(suelo, 3)})
        dia += dt.timedelta(days=1)
    return filas


# --------------------------------------------------------------------------
# Almacén en memoria con carga en segundo plano
# --------------------------------------------------------------------------
class Almacen:
    def __init__(self):
        self.datos = {}          # id -> {"filas", "fuente", "actualizado", "error"}
        self.cargados = 0
        self.total = len(DEPARTAMENTOS)
        self.cargando = False
        self.version = 0
        self._candado = threading.Lock()
        self._fallos_red = 0
        self.error = None
        self._ultimo_intento = None   # evita reintentar la descarga en cada visita

    # -- estado ---------------------------------------------------------
    @property
    def listo(self):
        # Mientras se refresca se siguen usando los datos anteriores.
        return len(self.datos) == self.total

    def resumen(self):
        fuentes = {}
        errores = []
        for d in self.datos.values():
            fuentes[d["fuente"]] = fuentes.get(d["fuente"], 0) + 1
            if d.get("error") and d["error"] not in errores:
                errores.append(d["error"])
        return {"listo": self.listo, "cargando": self.cargando, "cargados": self.cargados,
                "total": self.total, "fuentes": fuentes, "errores": errores[:3], "error": self.error}

    # -- carga ----------------------------------------------------------
    def _cargar_uno(self, dep):
        hoy = dt.date.today()
        inicio = dt.date(hoy.year - ANIOS_HISTORIA, 1, 1)
        error = None
        if not MODO_DEMO:
            cache = _leer_cache(dep)
            if cache:
                return cache
            if self._fallos_red < 2:   # "cortacircuito": si no hay red, no insistir 22 veces
                try:
                    filas = _descargar(dep, inicio, hoy)
                    ahora = dt.datetime.now().isoformat(timespec="seconds")
                    _guardar_cache(dep, filas, ahora)
                    return {"filas": filas, "fuente": "NASA POWER", "actualizado": ahora, "error": None}
                except (requests.ConnectionError, requests.Timeout) as e:
                    self._fallos_red += 1
                    error = f"Sin conexión con NASA POWER ({type(e).__name__})"
                except Exception as e:  # noqa: BLE001 - se informa en la interfaz
                    error = f"NASA POWER respondió con error: {str(e)[:120]}"
            else:
                error = "Sin conexión con NASA POWER"
        else:
            error = "MODO_DEMO=1 activado manualmente"
        if not MODO_DEMO:
            viejo = _leer_cache(dep, permitir_viejo=True)
            if viejo:                 # datos reales aunque no sean de hoy
                viejo["error"] = error
                return viejo
        if MODO_DEMO:
            filas = simular(dep, inicio, hoy)
            return {"filas": filas, "fuente": "SIMULADO",
                    "actualizado": dt.datetime.now().isoformat(timespec="seconds"), "error": error}
        # Sin datos reales (ni nuevos ni en caché) NO se inventan valores: se informa el error.
        return {"filas": None, "fuente": "ERROR", "actualizado": None, "error": error}

    def _trabajo(self):
        self._fallos_red = 0
        nuevos = {}

        def tarea(dep):
            res = self._cargar_uno(dep)
            with self._candado:
                nuevos[dep["id"]] = res
                self.cargados = len(nuevos)
            return res

        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(tarea, DEPARTAMENTOS))
        fallidos = [d["error"] for d in nuevos.values() if d["filas"] is None]
        with self._candado:
            if fallidos:
                self.error = fallidos[0]          # se conservan los datos anteriores, si los hay
            else:
                self.error = None
                self.datos = nuevos
                self.version += 1
            self.cargando = False

    def _precargar_cache_vieja(self):
        """Arranque instantáneo ("stale-while-revalidate"): si hay caché en disco,
        aunque tenga más de TTL_HORAS, se usa ya; la descarga nueva corre en
        segundo plano y reemplaza los datos cuando termina."""
        if MODO_DEMO or self.datos:
            return
        previos = {}
        for dep in DEPARTAMENTOS:
            c = _leer_cache(dep, permitir_viejo=True)
            if not c:
                return                # falta alguno: mejor esperar la descarga completa
            previos[dep["id"]] = c
        self.datos = previos
        self.cargados = len(previos)
        self.version += 1

    def iniciar(self, forzar=False):
        with self._candado:
            self._precargar_cache_vieja()
            if self.cargando:
                return
            ahora = dt.datetime.now()
            if self.error and not self.datos and self._ultimo_intento and (ahora - self._ultimo_intento).total_seconds() < 30:
                return                         # tras un fallo sin datos se espera 30 s para reintentar
            if self.datos and not forzar:
                antiguo = min(dt.datetime.fromisoformat(d["actualizado"]) for d in self.datos.values())
                if (ahora - antiguo).total_seconds() < TTL_HORAS * 3600:
                    return
                # datos viejos: reintentar como máximo cada 30 minutos
                if self._ultimo_intento and (ahora - self._ultimo_intento).total_seconds() < 1800:
                    return
            self._ultimo_intento = ahora
            self.cargando = True
            self.cargados = 0
        threading.Thread(target=self._trabajo, daemon=True).start()


almacen = Almacen()
