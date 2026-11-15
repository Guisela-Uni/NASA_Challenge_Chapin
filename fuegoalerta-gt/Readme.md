# FuegoAlerta GT

## Cómo ejecutarla

**Linux / Mac**
```bash
cd fuegoalerta-gt
python3 -m venv .venv            # si falla: sudo apt install python3-venv
source .venv/bin/activate
pip install -r requirements.txt
export FIRMS_MAP_KEY="su_clave"  # opcional, ver abajo
python app.py
```

**Windows**
```
cd fuegoalerta-gt
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set FIRMS_MAP_KEY=su_clave
python app.py
```
Abrir http://127.0.0.1:5000

## Datos en tiempo real
- **Mapa (pestaña Mapa):** focos de calor MODIS y VIIRS (SNPP, NOAA-20, NOAA-21) de las últimas 24 h, de NASA FIRMS
  (`/api/focos_hoy`, módulo `focos_hoy.py`). FIRMS publica cada detección 1–3 h después de la pasada del satélite.
  Se actualiza solo cada 10 minutos. Sin clave usa los CSV públicos de FIRMS; con `FIRMS_MAP_KEY`
  (gratis en https://firms.modaps.eosdis.nasa.gov/api/map_key/) usa la API.
- **Clima:** NASA POWER. NASA lo publica con 2–3 días de retraso; la página lo indica y el modelo estima los días siguientes.
- **Sin conexión:** la aplicación NO inventa datos. Usa la última copia real guardada en `cache/` y lo avisa; si no hay, muestra el error.
  Los datos simulados solo existen con `MODO_DEMO=1`.
- **Pestaña Histórico:** archivo de FIRMS 2000–2025 (estático, no es tiempo real).

## Buscador de departamentos y municipios
La barra del mapa busca departamentos (lista local) y municipios u otros lugares (OpenStreetMap/Nominatim, limitado a Guatemala;
opcional: `NOMINATIM_EMAIL` con un correo de contacto, como pide su política de uso). Para un municipio se descarga la serie de
NASA POWER de ese punto y se calcula el riesgo con el mismo modelo usando la altitud del lugar (Open-Meteo), más los focos de
calor a menos de 10 km. La malla de clima de NASA POWER es de ~50 km, así que municipios vecinos pueden compartir el mismo clima.
