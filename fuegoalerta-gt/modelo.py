"""Modelo de riesgo de incendios forestales y agrícolas para Guatemala.

El modelo es un ÍNDICE DE PELIGRO basado en reglas (transparente y ajustable),
no un modelo de aprendizaje automático. Combina seis condiciones del ambiente.
Cada una se convierte en un puntaje 0-1 según su distancia al "estado estable"
(ambiente poco propenso al fuego) y al "estado crítico".

    puntaje = 0  -> variable dentro del rango estable
    puntaje = 1  -> variable en nivel crítico

    índice  = Σ peso_i · puntaje_i                (peligro del ambiente, 0-1)
    riesgo  = índice · (0.85 + 0.15 · factor_ignición_del_mes)

Los umbrales son valores de partida basados en criterios habituales de
meteorología de incendios. DEBEN calibrarse con INSIVUMEH, CONAP e INAB
usando el historial de incendios reales (ver manual, sección de limitaciones).
"""
import datetime as dt
import math

from departamentos import POR_ID

# --------------------------------------------------------------------------
# Rangos de referencia
# --------------------------------------------------------------------------
UMBRALES = {
    "tmax": {
        "nombre": "Temperatura máxima", "unidad": "°C", "peso": 0.15,
        "estable": 30.0, "critico": 37.0,   # se ajustan por altitud en umbrales()
        "regla": "Más calor reseca el combustible vegetal.",
        "palanca": "Indirecta: la sombra y la cobertura arbórea bajan la temperatura a nivel de suelo.",
    },
    "rh": {
        "nombre": "Humedad relativa del aire", "unidad": "%", "peso": 0.25,
        "estable": 60.0, "critico": 30.0,
        "regla": "Con aire seco, la vegetación pierde humedad y enciende con facilidad.",
        "palanca": "Parcial: cobertura vegetal, riego y conservación de humedales elevan la humedad local.",
    },
    "precip15": {
        "nombre": "Lluvia acumulada (15 días)", "unidad": "mm", "peso": 0.20,
        "estable": 40.0, "critico": 5.0,
        "regla": "La lluvia reciente mantiene húmedos el suelo y el combustible.",
        "palanca": "No controlable: se compensa reteniendo agua (reservorios, cosecha de lluvia, riego de apoyo).",
    },
    "dias_sin_lluvia": {
        "nombre": "Días seguidos sin lluvia útil", "unidad": "días", "peso": 0.10,
        "estable": 3.0, "critico": 20.0,
        "regla": "Cada día seco seguido aumenta la cantidad de combustible listo para quemar.",
        "palanca": "No controlable: se compensa con retención de agua y reducción de combustible.",
    },
    "wind": {
        "nombre": "Velocidad del viento (2 m)", "unidad": "m/s", "peso": 0.10,
        "estable": 2.0, "critico": 5.0,
        "regla": "El viento aviva y propaga el fuego con rapidez.",
        "palanca": "Parcial: cortinas rompevientos y cortafuegos anchos reducen su efecto.",
    },
    "soil": {
        "nombre": "Humedad del suelo superficial (escala 0-1)", "unidad": "", "peso": 0.20,
        "estable": 0.60, "critico": 0.30,
        "regla": "Un suelo seco y su hojarasca son el principal combustible.",
        "palanca": "Alta: mulch, cobertura, labranza mínima y riego de apoyo recuperan la humedad del suelo.",
    },
}

# Presión de ignición (quemas agrícolas, rozas, pastoreo, fogatas) por mes.
# 1 = mes de mayor actividad humana con fuego (marzo-abril, antes de las lluvias).
FACTOR_IGNICION = {1: 0.7, 2: 0.9, 3: 1.0, 4: 1.0, 5: 0.8, 6: 0.3,
                   7: 0.2, 8: 0.2, 9: 0.2, 10: 0.3, 11: 0.4, 12: 0.6}

NIVELES = [  # (límite superior, nombre, color)
    (0.20, "Bajo", "#3b9c5a"),
    (0.35, "Moderado", "#e3c542"),
    (0.50, "Alto", "#f08a24"),
    (0.65, "Muy alto", "#d9412b"),
    (1.01, "Extremo", "#8e1b3a"),
]

_VARS = ["tmax", "rh", "precip", "wind", "soil"]


def nivel(riesgo):
    for tope, nombre, color in NIVELES:
        if riesgo < tope:
            return nombre, color
    return NIVELES[-1][1], NIVELES[-1][2]


def umbrales(dep):
    """Umbrales por departamento. La temperatura se ajusta por altitud:
    lo "normal" baja ~6.5 °C por cada 1000 m, así que 30 °C no significa lo
    mismo en Petén (120 m) que en Totonicapán (2500 m)."""
    u = {k: dict(v) for k, v in UMBRALES.items()}
    normal = 34.0 - 0.0065 * dep["elev"]
    u["tmax"]["estable"] = round(normal + 1.0, 1)
    u["tmax"]["critico"] = round(normal + 7.0, 1)
    return u


def _lin(x, estable, critico):
    """0 en el lado estable, 1 en el crítico, lineal en medio (sirve en ambos sentidos)."""
    if x is None or estable == critico:
        return 0.0
    return max(0.0, min(1.0, (x - estable) / (critico - estable)))


def _media(valores):
    v = [x for x in valores if x is not None]
    return sum(v) / len(v) if v else None


# --------------------------------------------------------------------------
# Climatología y pronóstico por persistencia de anomalías
# --------------------------------------------------------------------------
def _climatologia(obs):
    """Promedio por día del año (ventana ±7 días) usando todos los años disponibles."""
    suma = {v: [0.0] * 367 for v in _VARS}
    cuenta = {v: [0] * 367 for v in _VARS}
    for r in obs:
        doy = min(r["fecha"].timetuple().tm_yday, 366)
        for v in _VARS:
            if r[v] is not None:
                suma[v][doy] += r[v]
                cuenta[v][doy] += 1
    clim = {v: [None] * 367 for v in _VARS}
    for v in _VARS:
        for d in range(1, 367):
            s = c = 0
            for k in range(-7, 8):
                dd = (d - 1 + k) % 366 + 1
                s += suma[v][dd]
                c += cuenta[v][dd]
            clim[v][d] = s / c if c else None
    return clim


def _doy(fecha):
    return min(fecha.timetuple().tm_yday, 366)


def _anomalias(obs, clim):
    """Diferencia entre los últimos 15 días observados y lo normal para esas fechas."""
    anom = {}
    for v in ("tmax", "rh", "wind", "soil"):
        difs = []
        for r in obs[-15:]:
            c = clim[v][_doy(r["fecha"])]
            if r[v] is not None and c is not None:
                difs.append(r[v] - c)
        anom[v] = _media(difs) or 0.0
    return anom


def _predecir_dia(fecha, k, clim, anom):
    """Valor esperado = climatología + anomalía actual que se desvanece con el tiempo.
    k = días hacia el futuro desde el último dato observado."""
    d = {"fecha": fecha}
    doy = _doy(fecha)
    for v in _VARS:
        c = clim[v][doy]
        if c is None:
            d[v] = None
        elif v == "precip":
            d[v] = c
        else:
            tau = 20.0 if v == "soil" else 12.0
            d[v] = c + anom.get(v, 0.0) * math.exp(-k / tau)
    if d["rh"] is not None:
        d["rh"] = max(5.0, min(100.0, d["rh"]))
    if d["soil"] is not None:
        d["soil"] = max(0.0, min(1.0, d["soil"]))
    if d["wind"] is not None:
        d["wind"] = max(0.2, d["wind"])
    return d


# --------------------------------------------------------------------------
# Cálculo de rasgos y riesgo
# --------------------------------------------------------------------------
def _riesgo(rasgos, u, fecha):
    comp = {k: _lin(rasgos[k], u[k]["estable"], u[k]["critico"]) for k in u}
    indice = sum(u[k]["peso"] * comp[k] for k in u)
    riesgo = indice * (0.85 + 0.15 * FACTOR_IGNICION[fecha.month])
    return comp, indice, riesgo


def serie_de_riesgo(dep, filas, hoy=None, atras=30, adelante=45):
    """Devuelve la lista diaria (observada + pronosticada) con variables y riesgo."""
    hoy = hoy or dt.date.today()
    obs = [r for r in filas if r["fecha"] <= hoy]
    ultimo = obs[-1]["fecha"]
    clim = _climatologia(obs)
    anom = _anomalias(obs, clim)
    u = umbrales(dep)

    ext = [dict(r, tipo="obs") for r in obs[-90:]]
    f, k = ultimo, 0
    while f < hoy + dt.timedelta(days=adelante):
        f += dt.timedelta(days=1)
        k += 1
        d = _predecir_dia(f, k, clim, anom)
        d["tipo"] = "pred"
        ext.append(d)

    salida = []
    sin_lluvia = 0
    for i, d in enumerate(ext):
        umbral_lluvia = 2.0 if d["tipo"] == "obs" else 1.0
        sin_lluvia = 0 if (d["precip"] or 0.0) >= umbral_lluvia else sin_lluvia + 1
        if i < 14 or d["fecha"] < hoy - dt.timedelta(days=atras):
            continue
        precip15 = sum((x["precip"] or 0.0) for x in ext[i - 14:i + 1])
        soil = _media([x["soil"] for x in ext[i - 2:i + 1]])
        soil_estimado = soil is None
        if soil_estimado:   # respaldo si POWER no entregó humedad del suelo
            soil = max(0.1, min(1.0, 0.15 + precip15 / 100.0))
        rasgos = {
            "tmax": _media([x["tmax"] for x in ext[i - 2:i + 1]]),
            "rh": _media([x["rh"] for x in ext[i - 2:i + 1]]),
            "precip15": precip15,
            "dias_sin_lluvia": float(min(sin_lluvia, 60)),
            "wind": _media([x["wind"] for x in ext[i - 2:i + 1]]),
            "soil": soil,
        }
        comp, indice, riesgo = _riesgo(rasgos, u, d["fecha"])
        nom, color = nivel(riesgo)
        salida.append({
            "fecha": d["fecha"].isoformat(), "tipo": d["tipo"], "rasgos": rasgos,
            "puntajes": comp, "indice": indice, "riesgo": round(riesgo, 3),
            "nivel": nom, "color": color, "suelo_estimado": soil_estimado,
        })
    return {"dias": salida, "ultimo_dato": ultimo.isoformat()}


# --------------------------------------------------------------------------
# Plan de prevención
# --------------------------------------------------------------------------
ACCIONES = {
    "rh": [
        ("Conservar la humedad del microclima",
         "Mantenga cobertura vegetal y mulch (rastrojo triturado) sobre el suelo, proteja la vegetación "
         "de ribera y riegue por la tarde o noche las áreas más secas."),
        ("Posponer actividades que generen chispa o brasa",
         "Con aire seco el fuego prende y se propaga con facilidad: evite quemas, fogatas y trabajos con "
         "soldadura o maquinaria en horas de menor humedad (11:00 a 16:00)."),
    ],
    "soil": [
        ("Recuperar humedad en el suelo",
         "Use mulch, cobertura permanente, labranza mínima y riego de apoyo localizado (goteo) en parcelas "
         "y bordes de bosque con mayor riesgo."),
        ("Reducir el combustible fino",
         "Incorpore o composte el rastrojo en lugar de quemarlo; retire hojarasca y pasto seco cerca de "
         "viviendas, cultivos y límites con bosque."),
    ],
    "precip15": [
        ("Compensar el déficit de lluvia",
         "Aproveche reservorios, cosecha de agua de lluvia y pozos para tener agua disponible para riego "
         "de apoyo y para las brigadas."),
        ("Priorizar vigilancia en zonas secas",
         "Coordine rondas de vigilancia con COCODES, municipalidad, bomberos y CONRED en las áreas con más "
         "tiempo sin lluvia."),
    ],
    "dias_sin_lluvia": [
        ("Abrir y mantener rondas cortafuego",
         "Limpie franjas de al menos 3 a 5 metros de ancho alrededor de parcelas y bosques; en pendientes "
         "o con viento, amplíelas."),
    ],
    "wind": [
        ("Reducir el efecto del viento",
         "Establezca o conserve cortinas rompevientos (hileras de árboles) y haga cortafuegos más anchos "
         "en el lado por donde sopla el viento dominante."),
        ("No usar fuego con viento",
         "Suspenda toda quema, aun controlada, cuando el viento sea fuerte o cambiante."),
    ],
    "tmax": [
        ("Aumentar sombra y cobertura",
         "Mantenga árboles de sombra en sistemas agroforestales y pastizales para bajar la temperatura a "
         "nivel de suelo y retrasar el secado del combustible."),
        ("Trabajar en horas frescas",
         "Programe labores de campo temprano en la mañana y mantenga vigilancia reforzada al mediodía."),
    ],
}

ACCIONES_NIVEL = {
    "Moderado": ("Vigilancia preventiva", "Revise los cortafuegos, ubique las fuentes de agua y comparta con la comunidad el estado del riesgo."),
    "Alto": ("Restringir el uso del fuego", "Evite quemas agrícolas y de pastos. Si son indispensables, consulte antes la normativa vigente y dé aviso a la autoridad local (municipalidad, INAB o CONAP)."),
    "Muy alto": ("Activar brigadas y alerta comunitaria", "Prohíba quemas, active brigadas locales y mantenga comunicación con bomberos, CONRED y CONAP/INAB."),
    "Extremo": ("Alerta máxima", "Suspenda toda quema. Mantenga brigadas y equipo listos, vigile las áreas protegidas y prepare rutas de evacuación y aviso a las comunidades."),
}


def _brecha(clave, valor, u):
    est, crit, unidad = u["estable"], u["critico"], u["unidad"]
    bajo_malo = est > crit
    if abs(valor - est) < 0.03 * abs(est - crit):
        return "En el límite del rango estable"
    if (bajo_malo and valor >= est) or (not bajo_malo and valor <= est):
        return "Dentro del rango estable"
    dif = abs(valor - est)
    if clave == "soil":
        dif_txt = f"{dif:.2f}"
    elif clave in ("precip15", "dias_sin_lluvia"):
        dif_txt = f"{dif:.0f} {unidad}"
    else:
        dif_txt = f"{dif:.1f} {unidad}"
    if bajo_malo:
        return f"Faltan {dif_txt} para llegar al rango estable (≥ {est:g})"
    return f"Excede en {dif_txt} el rango estable (≤ {est:g})"


def tabla_variables(dep, dia):
    u = umbrales(dep)
    filas = []
    for clave, info in u.items():
        valor = dia["rasgos"][clave]
        punt = dia["puntajes"][clave]
        # "estable" solo si está dentro del rango (o apenas en su límite); así la
        # etiqueta nunca contradice el texto de la brecha.
        estado = "estable" if punt < 0.03 else ("vigilancia" if punt < 0.60 else "critico")
        bajo_malo = info["estable"] > info["critico"]
        filas.append({
            "clave": clave, "nombre": info["nombre"], "unidad": info["unidad"],
            "actual": round(valor, 2), "puntaje": round(punt, 2), "estado": estado,
            "estable": info["estable"], "critico": info["critico"],
            "estable_txt": f"{'≥' if bajo_malo else '≤'} {info['estable']:g}",
            "critico_txt": f"{'≤' if bajo_malo else '≥'} {info['critico']:g}",
            "brecha": _brecha(clave, valor, info), "palanca": info["palanca"],
            "regla": info["regla"], "peso": info["peso"],
            "estimado": bool(clave == "soil" and dia.get("suelo_estimado")),
        })
    return filas


def plan_prevencion(dep, dia):
    """Acciones ordenadas por cuánto contribuye cada variable al peligro actual."""
    u = umbrales(dep)
    contribucion = sorted(((u[k]["peso"] * dia["puntajes"][k], k) for k in u), reverse=True)
    acciones = []
    if dia["nivel"] in ACCIONES_NIVEL:
        t, d = ACCIONES_NIVEL[dia["nivel"]]
        acciones.append({"prioridad": "Nivel de alerta", "titulo": t, "detalle": d, "variable": None})
    for aporte, clave in contribucion:
        if dia["puntajes"][clave] < 0.25 or aporte < 0.02:
            continue
        for titulo, detalle in ACCIONES[clave]:
            acciones.append({"prioridad": "Alta" if dia["puntajes"][clave] >= 0.6 else "Media",
                             "titulo": titulo, "detalle": detalle, "variable": u[clave]["nombre"]})
    if len(acciones) <= 1 and dia["nivel"] == "Bajo":
        acciones.append({"prioridad": "Mantenimiento", "titulo": "Mantener el ambiente en equilibrio",
                         "detalle": "Las condiciones son estables. Aproveche para abrir cortafuegos, retirar combustible y "
                                    "capacitar brigadas antes de la época seca (noviembre a mayo).",
                         "variable": None})
    return acciones


def equilibrio(dia):
    """Índice 0-100: 100 = todas las variables dentro del rango estable."""
    return round(100 * (1 - dia["indice"]))


# --------------------------------------------------------------------------
# Resumen por departamento (con caché por versión de datos y fecha)
# --------------------------------------------------------------------------
_cache = {}


def analizar(dep_id, datos_dep, version, hoy=None):
    hoy = hoy or dt.date.today()
    clave = (dep_id, version, hoy)
    if clave not in _cache:
        if len(_cache) > 200:
            _cache.clear()
        _cache[clave] = serie_de_riesgo(POR_ID[dep_id], datos_dep["filas"], hoy)
    return _cache[clave]


def dia_actual(serie, hoy=None):
    """Último día OBSERVADO (el dato más reciente que entregó la NASA)."""
    obs = [d for d in serie["dias"] if d["tipo"] == "obs"]
    return obs[-1] if obs else serie["dias"][0]
