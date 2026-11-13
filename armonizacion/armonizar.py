
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
