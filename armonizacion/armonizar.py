
from pathlib import Path
import pandas as pd

# Carpeta donde guardamos los archivos de NASA
carpeta_datos = Path(__file__).parent / "datos"

# Archivos originales
archivo_modis = carpeta_datos / "fire_archive_M-C61_845901.csv"
archivo_viirs = carpeta_datos / "fire_archive_SV-C2_845902.csv"

# Leer los archivos CSV
modis = pd.read_csv(archivo_modis)
viirs = pd.read_csv(archivo_viirs)

# Mostrar información general
print("===== DATOS MODIS =====")
print("Total de detecciones:", len(modis))
print("Columnas:", list(modis.columns))
print(modis.head())

print("\n===== DATOS VIIRS =====")
print("Total de detecciones:", len(viirs))
print("Columnas:", list(viirs.columns))
print(viirs.head())



# ==========================================
# ESTANDARIZACION DE MODIS Y VIIRS
# ==========================================

# Identificar el sensor de origen
modis["sensor"] = "MODIS"
viirs["sensor"] = "VIIRS"

# Convertir las fechas al formato datetime
modis["fecha"] = pd.to_datetime(modis["acq_date"])
viirs["fecha"] = pd.to_datetime(viirs["acq_date"])

# Seleccionar columnas comunes
columnas = [
    "latitude",
    "longitude",
    "fecha",
    "acq_time",
    "sensor",
    "satellite",
    "confidence",
    "frp",
    "daynight",
    "type"
]

modis_limpio = modis[columnas].copy()
viirs_limpio = viirs[columnas].copy()

# Conservar la confianza original como texto
# porque MODIS y VIIRS utilizan escalas diferentes
modis_limpio["confidence"] = modis_limpio["confidence"].astype(str)
viirs_limpio["confidence"] = viirs_limpio["confidence"].astype(str)

# Unir las detecciones en una tabla común
datos_unificados = pd.concat(
    [modis_limpio, viirs_limpio],
    ignore_index=True
)


# ==========================================
# FILTRADO GEOGRAFICO DE GUATEMALA
# ==========================================

import json
from shapely.geometry import Point, shape

# Abrir el archivo con el contorno de Guatemala
archivo_geojson = carpeta_datos / "guatemala.geojson"

with open(archivo_geojson, "r", encoding="utf-8") as archivo:
    geojson = json.load(archivo)

# Obtener la geometria del pais
if geojson["type"] == "FeatureCollection":
    geometria = shape(geojson["features"][0]["geometry"])
elif geojson["type"] == "Feature":
    geometria = shape(geojson["geometry"])
else:
    geometria = shape(geojson)

# Comprobar si cada deteccion pertenece a Guatemala
dentro_guatemala = datos_unificados.apply(
    lambda fila: geometria.covers(
        Point(fila["longitude"], fila["latitude"])
    ),
    axis=1
)

# Guardar cantidad de registros antes del filtro
total_antes = len(datos_unificados)

# Conservar solamente los registros dentro del pais
datos_unificados = datos_unificados[
    dentro_guatemala
].copy()

# Mostrar resultados
print("\n===== FILTRADO GEOGRAFICO =====")
print("Registros originales:", total_antes)
print("Registros dentro de Guatemala:", len(datos_unificados))
print("Registros excluidos:", total_antes - len(datos_unificados))

print("\nRegistros por sensor despues del filtro:")
print(datos_unificados["sensor"].value_counts())


# Ordenar por fecha
datos_unificados = datos_unificados.sort_values(
    by="fecha"
).reset_index(drop=True)

# Mostrar resultados
print("\n===== DATOS ESTANDARIZADOS =====")
print("Total de registros:", len(datos_unificados))
print("\nRegistros por sensor:")
print(datos_unificados["sensor"].value_counts())

print("\nPrimeras filas:")
print(datos_unificados.head())

print("\nRango de fechas:")
print("Inicio:", datos_unificados["fecha"].min())
print("Final:", datos_unificados["fecha"].max())



# ==========================================
# AGRUPACION ESPACIAL Y TEMPORAL
# ==========================================

import numpy as np

# Usaremos una cuadrícula de 5 km como aproximación inicial.
# Convertimos las coordenadas geográficas a kilómetros
# mediante una proyección local sencilla.


from pyproj import Transformer

# ==========================================
# CUADRICULA ESPACIAL EN METROS
# ==========================================

# WGS84: coordenadas originales de NASA
# UTM zona 15N: proyeccion para el analisis
transformador = Transformer.from_crs(
    "EPSG:4326",
    "EPSG:32615",
    always_xy=True
)

# Convertir longitud y latitud a coordenadas UTM
x_metros, y_metros = transformador.transform(
    datos_unificados["longitude"].to_numpy(),
    datos_unificados["latitude"].to_numpy()
)

datos_unificados["x_metros"] = x_metros
datos_unificados["y_metros"] = y_metros

# Definir celdas de 5 km
tamano_celda_metros = 5000

datos_unificados["celda_x"] = np.floor(
    datos_unificados["x_metros"] / tamano_celda_metros
).astype(int)

datos_unificados["celda_y"] = np.floor(
    datos_unificados["y_metros"] / tamano_celda_metros
).astype(int)


# ==========================================
# FILTRO DE INCENDIOS DE VEGETACION
# ==========================================

# Conservar solamente detecciones tipo 0
datos_vegetacion = datos_unificados[
    datos_unificados["type"] == 0
].copy()


# ==========================================
# PREPARACION TEMPORAL
# ==========================================

# Convertir HHMM a cuatro digitos
hora_texto = (
    datos_vegetacion["acq_time"]
    .astype(str)
    .str.zfill(4)
)

# Construir fecha y hora completa en UTC
datos_vegetacion["fecha_hora_utc"] = pd.to_datetime(
    datos_vegetacion["fecha"].dt.strftime("%Y-%m-%d")
    + " "
    + hora_texto.str[:2]
    + ":"
    + hora_texto.str[2:],
    format="%Y-%m-%d %H:%M",
    utc=True
)

# Convertir a horario de Guatemala (UTC-6)
datos_vegetacion["fecha_hora_gt"] = (
    datos_vegetacion["fecha_hora_utc"]
    .dt.tz_convert("America/Guatemala")
)

# Obtener la fecha local
datos_vegetacion["fecha_gt"] = (
    datos_vegetacion["fecha_hora_gt"].dt.date
)

print("\n===== PREPARACION TEMPORAL =====")

print(
    datos_vegetacion[
        [
            "sensor",
            "fecha",
            "acq_time",
            "fecha_hora_utc",
            "fecha_hora_gt",
            "fecha_gt"
        ]
    ].head(10).to_string(index=False)
)

print("\nRegistros con hora invalida:")
print(datos_vegetacion["fecha_hora_utc"].isna().sum())



# Contar detecciones por fecha, celda y sensor
agrupados = (
    datos_vegetacion
    .groupby(
        ["fecha", "celda_x", "celda_y", "sensor"]
    )
    .size()
    .reset_index(name="detecciones")
)

# Convertir MODIS y VIIRS en columnas separadas
comparacion = agrupados.pivot_table(
    index=["fecha", "celda_x", "celda_y"],
    columns="sensor",
    values="detecciones",
    fill_value=0,
    aggfunc="sum"
).reset_index()

# Asegurar que existan ambas columnas
for sensor in ["MODIS", "VIIRS"]:
    if sensor not in comparacion.columns:
        comparacion[sensor] = 0

comparacion.columns.name = None

# Identificar coincidencias espaciales y temporales
comparacion["ambos_sensores"] = (
    (comparacion["MODIS"] > 0) &
    (comparacion["VIIRS"] > 0)
)

# Mostrar resultados
print("\n===== COMPARACION ESPACIAL Y TEMPORAL =====")
print("Celdas-día con actividad:", len(comparacion))

print(
    "Celdas-día detectadas por ambos sensores:",
    comparacion["ambos_sensores"].sum()
)

print(
    "Celdas-día solo MODIS:",
    (
        (comparacion["MODIS"] > 0) &
        (comparacion["VIIRS"] == 0)
    ).sum()
)

print(
    "Celdas-día solo VIIRS:",
    (
        (comparacion["MODIS"] == 0) &
        (comparacion["VIIRS"] > 0)
    ).sum()
)

print("\nPrimeras filas:")
print(comparacion.head())


# ==========================================
# ANALISIS DE CALIDAD DE LAS DETECCIONES
# ==========================================

print("\n===== CALIDAD DE LOS DATOS =====")

# Separar las detecciones por sensor
modis_calidad = datos_unificados[
    datos_unificados["sensor"] == "MODIS"
].copy()

viirs_calidad = datos_unificados[
    datos_unificados["sensor"] == "VIIRS"
].copy()

# Convertir confianza MODIS a numero
modis_calidad["confidence"] = pd.to_numeric(
    modis_calidad["confidence"],
    errors="coerce"
)

print("\nMODIS - Estadisticas de confianza:")
print(modis_calidad["confidence"].describe())

print("\nVIIRS - Categorias de confianza:")
print(viirs_calidad["confidence"].value_counts(dropna=False))

# Revisar valores faltantes
print("\nValores faltantes MODIS:")
print(modis_calidad.isnull().sum())

print("\nValores faltantes VIIRS:")
print(viirs_calidad.isnull().sum())

# Revisar detecciones diurnas y nocturnas
print("\nMODIS - Dia y noche:")
print(modis_calidad["daynight"].value_counts())

print("\nVIIRS - Dia y noche:")
print(viirs_calidad["daynight"].value_counts())

# Revisar tipos de deteccion
print("\nMODIS - Tipos:")
print(modis_calidad["type"].value_counts(dropna=False))

print("\nVIIRS - Tipos:")
print(viirs_calidad["type"].value_counts(dropna=False))


# ==========================================
# SELECCION DE INCENDIOS DE VEGETACION
# ==========================================

print("\n===== INCENDIOS DE VEGETACION =====")

print("Detecciones originales:", len(datos_unificados))
print("Detecciones tipo 0:", len(datos_vegetacion))

print("\nDetecciones por sensor:")
print(datos_vegetacion["sensor"].value_counts())

# Revisar la distribucion de confianza
print("\nConfianza MODIS:")
print(
    datos_vegetacion[
        datos_vegetacion["sensor"] == "MODIS"
    ]["confidence"].value_counts().head()
)

print("\nConfianza VIIRS:")
print(
    datos_vegetacion[
        datos_vegetacion["sensor"] == "VIIRS"
    ]["confidence"].value_counts()
)



# ==========================================
# COMPARACION DE HORARIOS ENTRE SENSORES
# ==========================================

print("\n===== HORARIOS DE OBSERVACION =====")

# Extraer hora local de cada deteccion
datos_vegetacion["hora_gt"] = (
    datos_vegetacion["fecha_hora_gt"].dt.hour
)

# Contar detecciones por hora y sensor
horarios = pd.crosstab(
    datos_vegetacion["hora_gt"],
    datos_vegetacion["sensor"]
)

print("\nDetecciones por hora local:")
print(horarios.to_string())

# Identificar horas mas frecuentes
print("\nHoras con mayor cantidad de detecciones:")

for sensor in ["MODIS", "VIIRS"]:
    datos_sensor = datos_vegetacion[
        datos_vegetacion["sensor"] == sensor
    ]

    print(f"\n{sensor}:")
    print(
        datos_sensor["hora_gt"]
        .value_counts()
        .head(5)
        .sort_values(ascending=False)
    )
