
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

latitud_referencia = 15.5

km_por_grado_latitud = 111.32
km_por_grado_longitud = (
    111.32 * np.cos(np.radians(latitud_referencia))
)

tamano_celda_km = 5

# Coordenadas aproximadas en kilómetros
datos_unificados["x_km"] = (
    datos_unificados["longitude"] * km_por_grado_longitud
)

datos_unificados["y_km"] = (
    datos_unificados["latitude"] * km_por_grado_latitud
)

# Asignar cada detección a una celda
datos_unificados["celda_x"] = np.floor(
    datos_unificados["x_km"] / tamano_celda_km
).astype(int)

datos_unificados["celda_y"] = np.floor(
    datos_unificados["y_km"] / tamano_celda_km
).astype(int)

# Contar detecciones por fecha, celda y sensor
agrupados = (
    datos_unificados
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
