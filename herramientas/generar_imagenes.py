#!/usr/bin/env python3
"""Genera la imagen Open Graph y el ícono de iOS con Chrome sin interfaz.

    python3 herramientas/generar_imagenes.py

Requiere Google Chrome o Chromium instalado. Variable CHROME para indicar otra ruta.
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CANDIDATOS = [
    os.environ.get("CHROME", ""),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    shutil.which("google-chrome") or "",
    shutil.which("chromium") or "",
    shutil.which("chromium-browser") or "",
]
chrome = next((c for c in CANDIDATOS if c and Path(c).exists()), None)
if not chrome:
    sys.exit("No encontré Chrome/Chromium. Definí la variable CHROME con su ruta.")

TRABAJOS = [
    ("herramientas/og-imagen.html", "assets/img/og-mendoza-mesh.png", "1200,630"),
    ("herramientas/icono-apple.html", "assets/img/apple-touch-icon.png", "180,180"),
]
for origen, destino, tam in TRABAJOS:
    subprocess.run([
        chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", f"--window-size={tam}",
        f"--screenshot={RAIZ / destino}", (RAIZ / origen).as_uri(),
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"Generada: {destino}")
