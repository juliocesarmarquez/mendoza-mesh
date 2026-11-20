#!/usr/bin/env python3
"""Copia la cabecera y el pie de index.html a todas las páginas del sitio.

El sitio no tiene paso de compilación: cada página HTML lleva su propia
copia de la cabecera y del pie, entre estos marcadores:

    <!-- cabecera:inicio --> ... <!-- cabecera:fin -->
    <!-- pie:inicio --> ... <!-- pie:fin -->

Si cambiás el menú o el pie, editalo en index.html y corré:

    python3 herramientas/sincronizar_plantilla.py

El script marca con aria-current="page" el enlace del menú que corresponde
a cada página. Las páginas sin marcadores se informan y no se tocan.
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "index.html"
BLOQUES = ("cabecera", "pie")


def extraer(html: str, nombre: str) -> str:
    patron = re.compile(rf"<!-- {nombre}:inicio -->.*?<!-- {nombre}:fin -->", re.S)
    m = patron.search(html)
    if not m:
        raise ValueError(f"falta el bloque {nombre}")
    return m.group(0)


def marcar_actual(cabecera: str, archivo: str) -> str:
    # Quita cualquier aria-current del menú y lo agrega al enlace de esta página.
    cabecera = cabecera.replace(' aria-current="page"', "")
    nav_ini = cabecera.find('id="nav-principal"')
    if nav_ini < 0:
        return cabecera
    antes, despues = cabecera[:nav_ini], cabecera[nav_ini:]
    despues = despues.replace(f'<a href="{archivo}">', f'<a href="{archivo}" aria-current="page">', 1)
    return antes + despues


def main() -> int:
    fuente = ORIGEN.read_text(encoding="utf-8")
    plantilla = {n: extraer(fuente, n) for n in BLOQUES}
    cambiadas = 0
    for pagina in sorted(RAIZ.glob("*.html")):
        if pagina == ORIGEN:
            continue
        html = pagina.read_text(encoding="utf-8")
        nuevo = html
        for nombre in BLOQUES:
            try:
                extraer(nuevo, nombre)
            except ValueError:
                print(f"AVISO: {pagina.name} no tiene el bloque {nombre}; no se modifica.")
                continue
            bloque = plantilla[nombre]
            if nombre == "cabecera":
                bloque = marcar_actual(bloque, pagina.name)
            nuevo = re.sub(rf"<!-- {nombre}:inicio -->.*?<!-- {nombre}:fin -->",
                           lambda _m, b=bloque: b, nuevo, count=1, flags=re.S)
        if nuevo != html:
            pagina.write_text(nuevo, encoding="utf-8")
            cambiadas += 1
            print(f"Actualizada: {pagina.name}")
    print(f"{cambiadas} página(s) actualizada(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
