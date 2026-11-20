#!/usr/bin/env python3
"""Reemplaza la URL provisoria del sitio por la definitiva.

Las metaetiquetas canonical y Open Graph, robots.txt y sitemap.xml necesitan
la dirección completa del sitio. Mientras no esté definida, usan
https://USUARIO.github.io/mendoza-mesh/. Cuando la tengas:

    python3 herramientas/cambiar_url.py https://tu-usuario.github.io/mendoza-mesh/
    python3 herramientas/cambiar_url.py https://www.tu-dominio.org/

Con --probar muestra qué archivos cambiarían, sin modificarlos.
"""
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PROVISORIA = "https://USUARIO.github.io/mendoza-mesh/"
ARCHIVOS = sorted(RAIZ.glob("*.html")) + [RAIZ / "robots.txt", RAIZ / "sitemap.xml"]


def main() -> int:
    argumentos = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(argumentos) != 1 or not argumentos[0].startswith("https://"):
        print(__doc__)
        return 2
    nueva = argumentos[0] if argumentos[0].endswith("/") else argumentos[0] + "/"
    probar = "--probar" in sys.argv
    cambios = 0
    for archivo in ARCHIVOS:
        if not archivo.exists():
            continue
        texto = archivo.read_text(encoding="utf-8")
        n = texto.count(PROVISORIA)
        if n:
            cambios += n
            print(f"{archivo.name}: {n} reemplazo(s)")
            if not probar:
                archivo.write_text(texto.replace(PROVISORIA, nueva), encoding="utf-8")
    print(f"{'Se reemplazarían' if probar else 'Reemplazadas'} {cambios} apariciones por {nueva}")
    if not probar and cambios:
        print("Recordá marcar el ítem 1 de VERIFICAR.md como resuelto.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
