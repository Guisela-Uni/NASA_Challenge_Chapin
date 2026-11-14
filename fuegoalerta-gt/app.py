"""FuegoAlerta GT - aplicación web para predecir y prevenir incendios en Guatemala.

Ejecutar:
    pip install -r requirements.txt
    python app.py
y abrir http://127.0.0.1:5000
"""
import datetime as dt
import os

from flask import Flask, abort, jsonify, render_template

import modelo
from departamentos import CONTORNO, DEPARTAMENTOS, POR_ID
from nasa_data import almacen

app = Flask(__name__)
app.json.ensure_ascii = False      # tildes legibles en el JSON

almacen.iniciar()


def _requiere_datos():
    almacen.iniciar()              # refresca en segundo plano si los datos son viejos
    if not almacen.listo:
        abort(503)


@app.errorhandler(503)
def _no_listo(_):
    return jsonify({"listo": False, **almacen.resumen()}), 503


def _serie(dep_id):
    return modelo.analizar(dep_id, almacen.datos[dep_id], almacen.version)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/status")
def status():
    return jsonify(almacen.resumen())


@app.route("/api/contorno")
def contorno():
    return jsonify({"contorno": CONTORNO,
                    "nota": "Contorno aproximado, solo para visualización."})


@app.route("/api/rangos")
def rangos():
    return jsonify({
        "variables": [{"clave": k, "nombre": v["nombre"], "unidad": v["unidad"], "peso": v["peso"],
                       "estable": v["estable"], "critico": v["critico"], "regla": v["regla"],
                       "palanca": v["palanca"]} for k, v in modelo.UMBRALES.items()],
        "niveles": [{"nombre": n, "hasta": t, "color": c} for t, n, c in modelo.NIVELES],
        "nota_temperatura": "La temperatura estable/crítica se ajusta por altitud de cada departamento.",
    })


@app.route("/api/estado")
def estado():
    _requiere_datos()
    hoy = dt.date.today().isoformat()
    deps, fuentes = [], {}
    for dep in DEPARTAMENTOS:
        datos = almacen.datos[dep["id"]]
        serie = _serie(dep["id"])
        actual = modelo.dia_actual(serie)
        de_hoy = next((d for d in serie["dias"] if d["fecha"] == hoy), actual)
        fuentes[datos["fuente"]] = fuentes.get(datos["fuente"], 0) + 1
        deps.append({
            "id": dep["id"], "nombre": dep["nombre"], "lat": dep["lat"], "lon": dep["lon"],
            "elev": dep["elev"], "fuente": datos["fuente"],
            "fecha_dato": actual["fecha"], "riesgo": de_hoy["riesgo"], "nivel": de_hoy["nivel"],
            "color": de_hoy["color"], "equilibrio": modelo.equilibrio(de_hoy),
            "rasgos": {k: round(v, 2) for k, v in actual["rasgos"].items()},
        })
    deps.sort(key=lambda d: d["riesgo"], reverse=True)
    media = sum(d["riesgo"] for d in deps) / len(deps)
    nom, color = modelo.nivel(media)
    return jsonify({
        "hoy": hoy, "fuentes": fuentes, "errores": almacen.resumen()["errores"],
        "ultimo_dato": max(d["fecha_dato"] for d in deps),
        "fecha_imagenes": (dt.date.today() - dt.timedelta(days=1)).isoformat(),
        "nacional": {"riesgo_medio": round(media, 3), "nivel": nom, "color": color,
                     "en_alto_o_mas": sum(1 for d in deps if d["riesgo"] >= 0.35),
                     "equilibrio_medio": round(sum(d["equilibrio"] for d in deps) / len(deps))},
        "departamentos": deps,
    })


@app.route("/api/riesgo_diario")
def riesgo_diario():
    """Riesgo día a día (30 días observados + 45 pronosticados) para el calendario."""
    _requiere_datos()
    fechas, tipos, por_dep = None, None, {}
    for dep in DEPARTAMENTOS:
        dias = _serie(dep["id"])["dias"]
        if fechas is None:
            fechas = [d["fecha"] for d in dias]
            tipos = [d["tipo"] for d in dias]
        por_dep[dep["id"]] = [d["riesgo"] for d in dias]
    n = len(fechas)
    ids = list(por_dep)
    media = [round(sum(por_dep[i][k] for i in ids) / len(ids), 3) for k in range(n)]
    maximo = [round(max(por_dep[i][k] for i in ids), 3) for k in range(n)]
    niveles = [{"nombre": nm, "color": c} for nm, c in (modelo.nivel(m) for m in media)]
    return jsonify({
        "fechas": fechas, "tipos": tipos, "departamentos": por_dep,
        "nombres": {d["id"]: d["nombre"] for d in DEPARTAMENTOS},
        "nacional_media": media, "nacional_maximo": maximo, "niveles_media": niveles,
        "umbrales_nivel": [{"hasta": t, "nombre": n, "color": c} for t, n, c in modelo.NIVELES],
    })


@app.route("/api/departamento/<dep_id>")
def departamento(dep_id):
    _requiere_datos()
    if dep_id not in POR_ID:
        abort(404)
    dep = POR_ID[dep_id]
    serie = _serie(dep_id)
    actual = modelo.dia_actual(serie)
    datos = almacen.datos[dep_id]
    return jsonify({
        "id": dep_id, "nombre": dep["nombre"], "elev": dep["elev"], "fuente": datos["fuente"],
        "fecha_dato": actual["fecha"], "riesgo": actual["riesgo"], "nivel": actual["nivel"],
        "color": actual["color"], "equilibrio": modelo.equilibrio(actual),
        "variables": modelo.tabla_variables(dep, actual),
        "plan": modelo.plan_prevencion(dep, actual),
        "serie": [{"fecha": d["fecha"], "tipo": d["tipo"], "riesgo": d["riesgo"],
                   "nivel": d["nivel"], "color": d["color"]} for d in serie["dias"]],
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
