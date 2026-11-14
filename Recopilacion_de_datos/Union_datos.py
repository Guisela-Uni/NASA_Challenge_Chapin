
# In this program, we join multiple CSV sources from MODIS and VIIRS.
# En este programa unimos múltiples fuentes CSV de MODIS y VIIRS.

from pathlib import Path
import pandas as pd

# Carpetas donde están los archivos CSV
carpeta_base = Path(__file__).parent

archivos_modis = carpeta_base / "Modis"
archivos_viirs = carpeta_base / "VIIR S"

# Buscar todos los archivos CSV
lista_modis = list(archivos_modis.glob("*.csv"))
lista_viirs = list(archivos_viirs.glob("*.csv"))

# Leer y unir todos los archivos MODIS
datos_modis = pd.concat(
    [pd.read_csv(archivo) for archivo in lista_modis],
    ignore_index=True
)

# Leer y unir todos los archivos VIIRS
datos_viirs = pd.concat(
    [pd.read_csv(archivo) for archivo in lista_viirs],
    ignore_index=True
)

datos_viirs.to_csv(
    carpeta_base / "viirs_historico.csv",
    index=False
)

datos_modis.to_csv(
    carpeta_base / "modis_historico.csv",
    index=False
)



# Mostrar resultados
print(f"Archivos MODIS: {len(lista_modis)}")
print(f"Archivos VIIRS: {len(lista_viirs)}")
print(f"Registros MODIS: {len(datos_modis)}")
print(f"Registros VIIRS: {len(datos_viirs)}")