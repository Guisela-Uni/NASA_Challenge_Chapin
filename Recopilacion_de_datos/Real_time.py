
import requests
import pandas as pd
import os

# ==========================================
# CONFIGURACION
# ==========================================

MAP_KEY = "4fcc0a244d012c65229e85cd76dc5bf8"

BASE_URL = (
    "https://firms.modaps.eosdis.nasa.gov/"
    "mapserver/wfs/Central_America/"
    f"{MAP_KEY}/"
)

# Limites geograficos de Guatemala
# WFS 2.0 / EPSG:4326 utiliza orden latitud, longitud
BBOX = "13.7,-92.3,17.9,-88.2,urn:ogc:def:crs:EPSG::4326"

CAPAS = {
    "MODIS": "ms:fires_modis_24hrs",
    "VIIRS_NOAA20": "ms:fires_noaa20_24hrs",
    "VIIRS_NOAA21": "ms:fires_noaa21_24hrs"
}


# ==========================================
# CONSULTAR UNA CAPA
# ==========================================

def consultar_capa(nombre, capa):

    parametros = {
        "SERVICE": "WFS",
        "VERSION": "2.0.0",
        "REQUEST": "GetFeature",
        "TYPENAME": capa,
        "OUTPUTFORMAT": "csv",
        "SRSNAME": "urn:ogc:def:crs:EPSG::4326",
        "BBOX": BBOX,
        "COUNT": 1000,
        "STARTINDEX": 0
    }

    try:
        respuesta = requests.get(
            BASE_URL,
            params=parametros,
            timeout=60
        )

        respuesta.raise_for_status()

        from io import StringIO

        datos = pd.read_csv(StringIO(respuesta.text))

        datos["instrumento"] = nombre

        print(f"{nombre}: {len(datos)} detecciones")

        return datos

    except requests.RequestException as error:
        print(f"Error consultando {nombre}: {error}")
        return pd.DataFrame()

    except Exception as error:
        print(f"Error procesando {nombre}: {error}")
        return pd.DataFrame()


# ==========================================
# CONSULTAR TODAS LAS CAPAS
# ==========================================

def consultar_todos():

    if not MAP_KEY:
        raise ValueError(
            "No se encontro FIRMS_MAP_KEY"
        )

    resultados = []

    for nombre, capa in CAPAS.items():

        datos = consultar_capa(nombre, capa)

        if not datos.empty:
            resultados.append(datos)

    if not resultados:
        print("No se encontraron detecciones.")
        return pd.DataFrame()

    df = pd.concat(resultados, ignore_index=True)

    df.to_csv(
        "detecciones_guatemala.csv",
        index=False
    )

    print("\nConsulta finalizada")
    print(f"Total de detecciones: {len(df)}")

    return df


if __name__ == "__main__":
    df = consultar_todos()

    print(df.head())
