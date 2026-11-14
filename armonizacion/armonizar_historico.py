
from pathlib import Path
import pandas as pd

# Carpeta principal del modulo
carpeta_modulo = Path(__file__).parent

# Carpeta con archivos originales y contorno de Guatemala
carpeta_datos = carpeta_modulo / "datos"

# Archivos historicos de prueba (2024)
carpeta_pruebas = carpeta_datos / "pruebas_historicas"

# Carpeta principal del proyecto
carpeta_proyecto = carpeta_modulo.parent

# Archivos historicos completos
carpeta_historicos = carpeta_proyecto / "Recopilacion_de_datos"

archivo_modis = carpeta_historicos / "modis_historico.csv"
archivo_viirs = carpeta_historicos / "viirs_historico.csv"

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
from shapely.geometry import shape
from shapely import points, covers

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

# Comprobar de forma vectorizada si las detecciones
# se encuentran dentro del territorio de Guatemala

puntos = points(
    datos_unificados["longitude"].to_numpy(),
    datos_unificados["latitude"].to_numpy()
)

dentro_guatemala = covers(geometria, puntos)
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
# Proyeccion azimutal equidistante centrada en Guatemala
proyeccion_guatemala = (
    "+proj=aeqd "
    "+lat_0=15.7 "
    "+lon_0=-90.3 "
    "+datum=WGS84 "
    "+units=m "
    "+no_defs"
)

transformador = Transformer.from_crs(
    "EPSG:4326",
    proyeccion_guatemala,
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

# Identificar el dia UTC para organizar las comparaciones
datos_vegetacion["dia_utc"] = (
    datos_vegetacion["fecha_hora_utc"]
    .dt.date
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

# ==========================================
# PREPARACION DE DETECCIONES POR SENSOR
# ==========================================

print("\n===== PREPARACION DE ASOCIACIONES =====")

# Separar las detecciones de vegetacion por sensor
modis_unicos = datos_vegetacion[
    datos_vegetacion["sensor"] == "MODIS"
].copy().reset_index(drop=True)

viirs_unicos = datos_vegetacion[
    datos_vegetacion["sensor"] == "VIIRS"
].copy().reset_index(drop=True)

# Asignar identificadores individuales
modis_unicos["id_modis"] = modis_unicos.index
viirs_unicos["id_viirs"] = viirs_unicos.index

print("Detecciones MODIS:", len(modis_unicos))
print("Detecciones VIIRS:", len(viirs_unicos))

# ==========================================
# BUSQUEDA ESPACIAL Y TEMPORAL OPTIMIZADA
# ==========================================

from scipy.spatial import cKDTree

print("\n===== BUSQUEDA ESPACIO-TEMPORAL =====")

# Criterios de asociacion
distancia_maxima = 2000  # metros
ventana_horas = 3

# Guardar las asociaciones encontradas
asociaciones_encontradas = []

# Organizar VIIRS por dia UTC
viirs_por_dia = {
    dia: grupo
    for dia, grupo in viirs_unicos.groupby("dia_utc")
}

# Mostrar el progreso de la armonizacion por año
anio_actual = None

# Procesar MODIS por dia UTC
for dia, grupo_modis in modis_unicos.groupby("dia_utc"):

    # Avisar cuando comienza un nuevo año
    if dia.year != anio_actual:
        anio_actual = dia.year
        print(f"Procesando asociaciones del año {anio_actual}...", flush=True)

    # Considerar el dia anterior, actual y siguiente
    dias_busqueda = [
        dia - pd.Timedelta(days=1),
        dia,
        dia + pd.Timedelta(days=1)
    ]

    grupos_viirs = [
        viirs_por_dia[d]
        for d in dias_busqueda
        if d in viirs_por_dia
    ]

    if not grupos_viirs:
        continue

    # Reunir candidatos VIIRS de los tres dias
    candidatos_viirs = pd.concat(
        grupos_viirs,
        ignore_index=True
    )

    # Coordenadas de ambos sensores
    coords_modis = grupo_modis[
        ["x_metros", "y_metros"]
    ].to_numpy()

    coords_viirs = candidatos_viirs[
        ["x_metros", "y_metros"]
    ].to_numpy()

    # Crear arbol espacial de VIIRS
    arbol_viirs = cKDTree(coords_viirs)

    # Buscar detecciones dentro de 2 km
    # Margen adicional para evitar excluir parejas
    # por pequenas distorsiones de la proyeccion
    margen_busqueda = 100

    vecinos = arbol_viirs.query_ball_point(
        coords_modis,
        r=distancia_maxima + margen_busqueda
    )

    # Preparar arreglos para consultar los datos rapidamente
    horas_modis = grupo_modis["fecha_hora_utc"].to_numpy()
    horas_viirs = candidatos_viirs["fecha_hora_utc"].to_numpy()
    ids_modis = grupo_modis["id_modis"].to_numpy()
    ids_viirs = candidatos_viirs["id_viirs"].to_numpy()

    # Evaluar cada pareja candidata
    for i, lista_vecinos in enumerate(vecinos):

        for j in lista_vecinos:

            # Diferencia temporal en horas utilizando NumPy
            diferencia_horas = abs(
                (horas_modis[i] - horas_viirs[j])
                / np.timedelta64(1, "h")
            )

            if diferencia_horas > ventana_horas:
                continue

            # Distancia espacial utilizando arreglos NumPy
            diferencia_x = coords_modis[i, 0] - coords_viirs[j, 0]
            diferencia_y = coords_modis[i, 1] - coords_viirs[j, 1]

            distancia = np.hypot(diferencia_x, diferencia_y)

            asociaciones_encontradas.append({
                "id_modis": int(ids_modis[i]),
                "id_viirs": int(ids_viirs[j]),
                "distancia_metros": distancia,
                "diferencia_horas": diferencia_horas
            })

# ==========================================
# VALIDACION DE DISTANCIAS GEODESICAS
# ==========================================

from pyproj import Geod

geod = Geod(ellps="WGS84")

if asociaciones_encontradas:

    # Convertir asociaciones a una tabla temporal
    asociaciones_temp = pd.DataFrame(asociaciones_encontradas)

    # Obtener identificadores de cada pareja
    indices_modis = asociaciones_temp["id_modis"].to_numpy(dtype=int)
    indices_viirs = asociaciones_temp["id_viirs"].to_numpy(dtype=int)

    # Recuperar coordenadas originales
    longitudes_modis = modis_unicos["longitude"].to_numpy()[indices_modis]
    latitudes_modis = modis_unicos["latitude"].to_numpy()[indices_modis]

    longitudes_viirs = viirs_unicos["longitude"].to_numpy()[indices_viirs]
    latitudes_viirs = viirs_unicos["latitude"].to_numpy()[indices_viirs]

    # Calcular distancias geodesicas para todas las parejas
    _, _, distancias_reales = geod.inv(
        longitudes_modis,
        latitudes_modis,
        longitudes_viirs,
        latitudes_viirs
    )

    # Actualizar las distancias
    asociaciones_temp["distancia_metros"] = distancias_reales

    # Conservar solamente parejas dentro de 2 km reales
    asociaciones_temp = asociaciones_temp[
        asociaciones_temp["distancia_metros"] <= distancia_maxima
    ]

    asociaciones_encontradas = asociaciones_temp.to_dict("records")

# Construir tabla final de asociaciones
pares_vecinos = pd.DataFrame(
    asociaciones_encontradas,
    columns=[
        "id_modis",
        "id_viirs",
        "distancia_metros",
        "diferencia_horas"
    ]
)

print("Parejas MODIS-VIIRS encontradas:", len(pares_vecinos))

print(
    "Detecciones MODIS asociadas:",
    pares_vecinos["id_modis"].nunique()
)

print(
    "Detecciones VIIRS asociadas:",
    pares_vecinos["id_viirs"].nunique()
)

# ==========================================
# GENERACION DEL CALENDARIO ARMONIZADO
# ==========================================

from pathlib import Path

print("\n===== CALENDARIO ARMONIZADO =====")

# Agrupar por fecha local, celda geografica y sensor
conteos_calendario = (
    datos_vegetacion
    .groupby(
        ["fecha_gt", "celda_x", "celda_y", "sensor"]
    )
    .size()
    .unstack("sensor", fill_value=0)
    .reindex(columns=["MODIS", "VIIRS"], fill_value=0)
    .reset_index()
)

# Identificar sensores presentes
conteos_calendario["ambos_sensores"] = (
    (conteos_calendario["MODIS"] > 0)
    & (conteos_calendario["VIIRS"] > 0)
)

def clasificar_fuente(fila):
    if fila["ambos_sensores"]:
        return "MODIS y VIIRS"
    elif fila["MODIS"] > 0:
        return "Solo MODIS"
    else:
        return "Solo VIIRS"

conteos_calendario["fuente"] = (
    conteos_calendario.apply(
        clasificar_fuente, axis=1
    )
)

# Asociaciones espacio-temporales de 2 km y 3 horas
asociaciones_validas = pares_vecinos[
    (pares_vecinos["distancia_metros"] <= 2000)
    & (pares_vecinos["diferencia_horas"] <= 3)
]

# Identificar las detecciones que tienen asociacion
ids_modis = set(asociaciones_validas["id_modis"])
ids_viirs = set(asociaciones_validas["id_viirs"])

modis_unicos["asociado"] = (
    modis_unicos["id_modis"].isin(ids_modis)
)

viirs_unicos["asociado"] = (
    viirs_unicos["id_viirs"].isin(ids_viirs)
)

# Reunir los datos con el indicador de asociacion
datos_asociados = pd.concat(
    [modis_unicos, viirs_unicos],
    ignore_index=True
)

# Contar observaciones asociadas por celda y fecha local
conteos_asociados = (
    datos_asociados
    .groupby(["fecha_gt", "celda_x", "celda_y"])
    ["asociado"]
    .sum()
    .reset_index(name="detecciones_asociadas")
)

# Incorporar asociaciones al calendario
calendario = conteos_calendario.merge(
    conteos_asociados,
    on=["fecha_gt", "celda_x", "celda_y"],
    how="left"
)

calendario["detecciones_asociadas"] = (
    calendario["detecciones_asociadas"]
    .fillna(0)
    .astype(int)
)

# Indicador de presencia de actividad termica
calendario["actividad_detectada"] = True

# Preparar la carpeta y ruta del archivo de salida
carpeta_salida = carpeta_modulo / "resultados_historicos"
carpeta_salida.mkdir(parents=True, exist_ok=True)

ruta_salida = carpeta_salida / "calendario_armonizado.csv"

print("Total de celdas-dia:", len(calendario))

print("\nRegistros por fuente:")
print(calendario["fuente"].value_counts())

print("\nPrimeras filas:")
print(calendario.head().to_string(index=False))

print("\nArchivo generado en:")
print(ruta_salida)


# ==========================================
# VALIDACION DEL CALENDARIO
# ==========================================

print("\n===== VALIDACION DEL CALENDARIO =====")

total_original = len(datos_vegetacion)

total_calendario = (
    calendario["MODIS"].sum()
    + calendario["VIIRS"].sum()
)

print("Detecciones originales:", total_original)
print("Detecciones en calendario:", total_calendario)

assert total_original == total_calendario, (
    "ERROR: No coinciden las detecciones"
)

# Comprobar que no existan celdas-dia repetidas
duplicados = calendario.duplicated(
    subset=["fecha_gt", "celda_x", "celda_y"]
).sum()

print("Celdas-dia duplicadas:", duplicados)

assert duplicados == 0, (
    "ERROR: Existen celdas-dia duplicadas"
)

# Verificar asociaciones
total_asociadas = calendario[
    "detecciones_asociadas"
].sum()

print("Detecciones asociadas:", total_asociadas)

assert total_asociadas <= total_original, (
    "ERROR: Asociaciones inconsistentes"
)

# Verificar valores faltantes
faltantes = calendario.isna().sum().sum()

print("Valores faltantes:", faltantes)

assert faltantes == 0, (
    "ERROR: Existen valores faltantes"
)

print("\nVALIDACION COMPLETADA CORRECTAMENTE")


# ==========================================
# COORDENADAS PARA VISUALIZACION
# ==========================================

print("\n===== COORDENADAS DEL CALENDARIO =====")

# Ubicacion promedio de las detecciones por celda y fecha
ubicaciones = (
    datos_vegetacion
    .groupby(["fecha_gt", "celda_x", "celda_y"])
    .agg(
        latitude=("latitude", "mean"),
        longitude=("longitude", "mean")
    )
    .reset_index()
)

# Incorporar coordenadas al calendario
calendario = calendario.merge(
    ubicaciones,
    on=["fecha_gt", "celda_x", "celda_y"],
    how="left",
    validate="one_to_one"
)

# Comprobar que todas las celdas tengan coordenadas
assert calendario[["latitude", "longitude"]].notna().all().all(), (
    "ERROR: Existen celdas sin coordenadas"
)

# Actualizar el archivo CSV
calendario.to_csv(
    ruta_salida,
    index=False,
    encoding="utf-8-sig"
)

print("Total de celdas-dia:", len(calendario))

print("\nPrimeras filas con coordenadas:")
print(
    calendario[
        ["fecha_gt", "latitude", "longitude",
         "MODIS", "VIIRS", "fuente"]
    ].head().to_string(index=False)
)

print("\nCSV actualizado correctamente")



# ==========================================
# RESUMEN DIARIO DE ACTIVIDAD TERMICA
# ==========================================

print("\n===== RESUMEN DIARIO =====")

resumen_diario = (
    calendario
    .groupby("fecha_gt")
    .agg(
        celdas_activas=("actividad_detectada", "sum"),
        detecciones_modis=("MODIS", "sum"),
        detecciones_viirs=("VIIRS", "sum"),
        celdas_ambos=("ambos_sensores", "sum"),
        detecciones_asociadas=("detecciones_asociadas", "sum")
    )
    .reset_index()
)

# Total de observaciones satelitales por fecha
resumen_diario["total_detecciones"] = (
    resumen_diario["detecciones_modis"]
    + resumen_diario["detecciones_viirs"]
)

# Ordenar cronologicamente
resumen_diario = resumen_diario.sort_values(
    "fecha_gt"
)

# Guardar resumen
ruta_resumen = (
    carpeta_salida / "resumen_diario.csv"
)

resumen_diario.to_csv(
    ruta_resumen,
    index=False,
    encoding="utf-8-sig"
)

print("Dias registrados:", len(resumen_diario))

print("\nPrimeros dias:")
print(resumen_diario.head(10).to_string(index=False))

print("\nTotal de detecciones:")
print(resumen_diario["total_detecciones"].sum())

print("\nArchivo generado:")
print(ruta_resumen)
