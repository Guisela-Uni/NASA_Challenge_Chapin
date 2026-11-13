"""Datos geográficos básicos de Guatemala usados por la aplicación.

Cada departamento se representa con un punto (aprox. su centro) donde se
consultan las variables climáticas de NASA POWER. La malla de NASA POWER tiene
~55 km de resolución, por lo que un punto por departamento es una
representación razonable para un análisis nacional.

`clima` se usa únicamente en el MODO DEMOSTRACIÓN (cuando no hay conexión a la
NASA) para generar datos simulados con un comportamiento estacional plausible.
"""

DEPARTAMENTOS = [
    {"id": "alta_verapaz",   "nombre": "Alta Verapaz",   "lat": 15.47, "lon": -90.37, "elev": 1300, "clima": "humedo"},
    {"id": "baja_verapaz",   "nombre": "Baja Verapaz",   "lat": 15.10, "lon": -90.20, "elev": 1000, "clima": "corredor_seco"},
    {"id": "chimaltenango",  "nombre": "Chimaltenango",  "lat": 14.66, "lon": -90.82, "elev": 1800, "clima": "altiplano"},
    {"id": "chiquimula",     "nombre": "Chiquimula",     "lat": 14.80, "lon": -89.54, "elev": 400,  "clima": "corredor_seco"},
    {"id": "el_progreso",    "nombre": "El Progreso",    "lat": 14.85, "lon": -89.99, "elev": 300,  "clima": "corredor_seco"},
    {"id": "escuintla",      "nombre": "Escuintla",      "lat": 14.30, "lon": -90.78, "elev": 350,  "clima": "costa"},
    {"id": "guatemala",      "nombre": "Guatemala",      "lat": 14.63, "lon": -90.51, "elev": 1500, "clima": "altiplano"},
    {"id": "huehuetenango",  "nombre": "Huehuetenango",  "lat": 15.32, "lon": -91.47, "elev": 1900, "clima": "altiplano"},
    {"id": "izabal",         "nombre": "Izabal",         "lat": 15.60, "lon": -88.80, "elev": 50,   "clima": "humedo"},
    {"id": "jalapa",         "nombre": "Jalapa",         "lat": 14.63, "lon": -89.99, "elev": 1400, "clima": "corredor_seco"},
    {"id": "jutiapa",        "nombre": "Jutiapa",        "lat": 14.28, "lon": -89.89, "elev": 900,  "clima": "corredor_seco"},
    {"id": "peten",          "nombre": "Petén",          "lat": 16.90, "lon": -89.90, "elev": 120,  "clima": "selva"},
    {"id": "quetzaltenango", "nombre": "Quetzaltenango", "lat": 14.83, "lon": -91.52, "elev": 2300, "clima": "altiplano"},
    {"id": "quiche",         "nombre": "Quiché",         "lat": 15.30, "lon": -91.15, "elev": 2000, "clima": "altiplano"},
    {"id": "retalhuleu",     "nombre": "Retalhuleu",     "lat": 14.54, "lon": -91.68, "elev": 240,  "clima": "costa"},
    {"id": "sacatepequez",   "nombre": "Sacatepéquez",   "lat": 14.56, "lon": -90.73, "elev": 1500, "clima": "altiplano"},
    {"id": "san_marcos",     "nombre": "San Marcos",     "lat": 14.96, "lon": -91.80, "elev": 2400, "clima": "altiplano"},
    {"id": "santa_rosa",     "nombre": "Santa Rosa",     "lat": 14.17, "lon": -90.30, "elev": 1000, "clima": "costa"},
    {"id": "solola",         "nombre": "Sololá",         "lat": 14.77, "lon": -91.18, "elev": 2100, "clima": "altiplano"},
    {"id": "suchitepequez",  "nombre": "Suchitepéquez",  "lat": 14.40, "lon": -91.50, "elev": 350,  "clima": "costa"},
    {"id": "totonicapan",    "nombre": "Totonicapán",    "lat": 14.91, "lon": -91.36, "elev": 2500, "clima": "altiplano"},
    {"id": "zacapa",         "nombre": "Zacapa",         "lat": 14.97, "lon": -89.53, "elev": 200,  "clima": "corredor_seco"},
]

POR_ID = {d["id"]: d for d in DEPARTAMENTOS}

# Contorno APROXIMADO de Guatemala (lat, lon). Solo sirve para recortar la
# superficie interpolada del mapa; no es un límite oficial.
CONTORNO = [
    (14.53, -92.23), (14.80, -92.20), (15.10, -92.12), (15.50, -91.95),
    (15.95, -91.60), (16.10, -91.35), (16.10, -90.99), (17.82, -90.99),
    (17.82, -89.15), (16.10, -89.15), (15.90, -88.95), (15.89, -88.28),
    (15.72, -88.22), (15.40, -88.60), (15.10, -88.95), (14.95, -89.12),
    (14.72, -89.15), (14.43, -89.35), (14.33, -89.52), (14.15, -89.75),
    (13.95, -89.85), (13.74, -90.10), (13.80, -90.50), (13.93, -90.83),
    (14.05, -91.40), (14.30, -91.90),
]
