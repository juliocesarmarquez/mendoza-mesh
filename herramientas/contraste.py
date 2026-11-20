#!/usr/bin/env python3
"""Verifica el contraste WCAG 2.x de la paleta de Mendoza Mesh.

Lee assets/css/tokens.css, extrae los colores de los modos claro y oscuro
y comprueba cada combinación de texto y fondo que usa el sitio:

  * texto normal: mínimo 4,5:1 (WCAG AA, criterio 1.4.3)
  * bordes, foco y componentes no textuales: mínimo 3:1 (criterio 1.4.11)

También verifica que los dos bloques del modo oscuro (preferencia del
sistema y botón) tengan exactamente los mismos valores.

Uso:
    python3 herramientas/contraste.py          # informe en texto
    python3 herramientas/contraste.py --md     # tabla Markdown para el README

Sale con código 1 si alguna combinación no alcanza el mínimo.
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
TOKENS = RAIZ / "assets" / "css" / "tokens.css"

FONDOS = ["fondo", "superficie", "superficie-2", "cielo-alto"]
TEXTOS = ["texto", "texto-suave", "vino", "vino-hover", "ocre", "verde", "azul"]

# (primer plano, fondo, mínimo, uso)
PARES = [(t, f, 4.5, "texto") for t in TEXTOS for f in FONDOS] + [
    ("sobre-vino", "vino", 4.5, "botón primario"),
    ("sobre-vino", "vino-hover", 4.5, "botón primario (hover)"),
    ("sobre-ocre", "ocre-fondo", 4.5, "marcador [verificar]"),
    ("sobre-banda", "banda", 4.5, "texto de la banda"),
    ("banda", "sobre-banda", 4.5, "texto del botón de la banda"),
    ("sobre-banda", "banda", 3.0, "botón de la banda sobre la banda"),
    ("sobre-banda", "banda", 3.0, "foco dentro de la banda"),
    ("borde", "fondo", 3.0, "borde de control"),
    ("borde", "superficie", 3.0, "borde de control"),
    ("borde", "superficie-2", 3.0, "borde de control"),
    ("foco", "fondo", 3.0, "anillo de foco"),
    ("foco", "superficie", 3.0, "anillo de foco"),
    ("foco", "superficie-2", 3.0, "anillo de foco"),
]


def bloque(css: str, selector_regex: str) -> dict:
    m = re.search(selector_regex + r"\s*\{(.*?)\n\s*\}", css, re.S)
    if not m:
        sys.exit(f"No encontré el bloque {selector_regex!r} en {TOKENS}")
    return {k: v.upper() for k, v in re.findall(r"--([\w-]+):\s*(#[0-9A-Fa-f]{6})\b", m.group(1))}


def luminancia(hexa: str) -> float:
    r, g, b = (int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5))

    def canal(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)


def contraste(a: str, b: str) -> float:
    la, lb = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def main() -> int:
    css = TOKENS.read_text(encoding="utf-8")
    claro = bloque(css, r"(?m)^:root")
    oscuro_media = bloque(css, r':root:not\(\[data-tema="claro"\]\)')
    oscuro_boton = bloque(css, r':root\[data-tema="oscuro"\]')

    errores = 0
    if oscuro_media != oscuro_boton:
        diferentes = sorted(set(oscuro_media.items()) ^ set(oscuro_boton.items()))
        print("ERROR: los dos bloques del modo oscuro no coinciden:", diferentes)
        errores += 1

    oscuro = {**claro, **oscuro_boton}
    md = "--md" in sys.argv
    if md:
        print("| Texto / elemento | Fondo | Uso | Claro | Oscuro | Mínimo |")
        print("|---|---|---|---|---|---|")

    for fg, bg, minimo, uso in PARES:
        fila = []
        for nombre, paleta in (("claro", claro), ("oscuro", oscuro)):
            try:
                valor = contraste(paleta[fg], paleta[bg])
            except KeyError as e:
                print(f"ERROR: falta el token {e} en el modo {nombre}")
                errores += 1
                continue
            ok = valor >= minimo
            errores += 0 if ok else 1
            fila.append((valor, ok))
        if len(fila) < 2:
            continue
        if md:
            celdas = [f"{v:.2f}:1 {'✅' if ok else '❌'}" for v, ok in fila]
            print(f"| `--{fg}` | `--{bg}` | {uso} | {celdas[0]} | {celdas[1]} | {minimo:g}:1 |")
        else:
            estado = "OK " if all(ok for _, ok in fila) else "FALLA"
            print(f"{estado} {fg:>12} / {bg:<13} claro {fila[0][0]:5.2f}  oscuro {fila[1][0]:5.2f}  (mín. {minimo:g}; {uso})")

    if not md:
        print(f"\n{len(PARES)} combinaciones revisadas en cada modo; {errores} con problemas.")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
