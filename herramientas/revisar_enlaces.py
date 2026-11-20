#!/usr/bin/env python3
"""Revisión de calidad del sitio Mendoza Mesh.

Revisa en cada página HTML de la raíz:
  * enlaces internos y anclas (#id) que no existen;
  * metadatos obligatorios (title, description, canonical, Open Graph);
  * un solo <h1> y que los títulos no salteen niveles (h2 → h4);
  * imágenes sin texto alternativo e ids duplicados;
  * etiquetas que no cierran bien.

Opciones:
  --externos   además, consulta cada enlace externo (necesita internet)
  --verificar  lista los marcadores [verificar] que quedan en el sitio

Uso:
  python3 herramientas/revisar_enlaces.py
  python3 herramientas/revisar_enlaces.py --externos --verificar

Sale con código 1 si encuentra problemas.
"""
import collections
import html.parser
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
VACIOS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source",
          "track", "wbr", "path", "circle", "rect", "line", "polyline", "polygon", "ellipse", "stop", "use"}
METADATOS = ("description", "og:title", "og:description", "og:url", "og:image", "og:type", "og:locale")
# URLs provisorias que se reemplazan con herramientas/cambiar_url.py (ver VERIFICAR.md).
PROVISORIAS = ("https://USUARIO.github.io/",)


class Pagina(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.enlaces, self.titulos, self.pila, self.errores = [], [], [], []
        self.ids = collections.Counter()
        self.meta = {}
        self.sin_alt = 0
        self.canonical = None
        self.tiene_title = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids[a["id"]] += 1
        if tag in ("a", "link", "script", "img") and (a.get("href") or a.get("src")):
            self.enlaces.append((a.get("href") or a.get("src"), self.getpos()[0]))
        if re.fullmatch(r"h[1-6]", tag):
            self.titulos.append(int(tag[1]))
        if tag == "img" and "alt" not in a:
            self.sin_alt += 1
        if tag == "meta":
            self.meta[a.get("name") or a.get("property")] = a.get("content")
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")
        if tag == "title":
            self.tiene_title = True
        if tag not in VACIOS:
            self.pila.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids[a["id"]] += 1

    def handle_endtag(self, tag):
        if tag in VACIOS:
            return
        if self.pila and self.pila[-1][0] == tag:
            self.pila.pop()
        else:
            abierto = self.pila[-1] if self.pila else None
            self.errores.append(f"línea {self.getpos()[0]}: cierre </{tag}> inesperado (abierta: {abierto})")


def leer_paginas():
    paginas = {}
    for archivo in sorted(RAIZ.glob("*.html")):
        p = Pagina()
        p.feed(archivo.read_text(encoding="utf-8"))
        paginas[archivo.name] = (archivo, p)
    return paginas


def revisar(paginas):
    problemas = []
    externos = set()
    for nombre, (archivo, p) in paginas.items():
        def mal(texto):
            problemas.append(f"{nombre}: {texto}")

        if not p.tiene_title:
            mal("falta <title>")
        for m in METADATOS:
            if not p.meta.get(m):
                mal(f"falta la metaetiqueta {m}")
        if not p.canonical:
            mal("falta <link rel=canonical>")
        if p.titulos.count(1) != 1:
            mal(f"tiene {p.titulos.count(1)} <h1> (debe tener uno)")
        for a, b in zip(p.titulos, p.titulos[1:]):
            if b > a + 1:
                mal(f"saltea niveles de título: h{a} → h{b}")
        if p.sin_alt:
            mal(f"{p.sin_alt} imagen(es) sin alt")
        for id_, n in p.ids.items():
            if n > 1:
                mal(f'id duplicado: "{id_}" ({n} veces)')
        for e in p.errores[:5]:
            mal(e)
        abiertas = [t for t in p.pila if t[0] not in ("html", "head", "body")]
        if abiertas:
            mal(f"etiquetas sin cerrar: {abiertas[:3]}")

        for enlace, linea in p.enlaces:
            if enlace.startswith(("http://", "https://")):
                if not enlace.startswith(PROVISORIAS):
                    externos.add(enlace)
                continue
            if enlace.startswith(("mailto:", "tel:", "data:", "javascript:")):
                continue
            ruta, _, ancla = enlace.partition("#")
            destino = archivo if not ruta else (archivo.parent / ruta)
            if not destino.exists():
                mal(f"línea {linea}: enlace roto → {enlace}")
            elif ancla and destino.suffix == ".html":
                otra = paginas.get(destino.name)
                if otra and ancla not in otra[1].ids:
                    mal(f"línea {linea}: ancla inexistente → {enlace}")
    return problemas, externos


def revisar_externos(urls):
    problemas = []
    for url in sorted(urls):
        pedido = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (revision de enlaces)"})
        try:
            with urllib.request.urlopen(pedido, timeout=20) as r:
                codigo = r.status
        except urllib.error.HTTPError as e:
            codigo = e.code
        except Exception as e:  # sin red, DNS, TLS, etc.
            codigo = f"error ({e.__class__.__name__})"
        estado = "ok " if codigo == 200 else "MAL"
        print(f"  {estado} {codigo} {url}")
        if codigo != 200:
            problemas.append(f"enlace externo con problema ({codigo}): {url}")
    return problemas


def listar_verificar(paginas):
    print("\nMarcadores [verificar] que quedan en el sitio:")
    total = 0
    for nombre, (archivo, _) in paginas.items():
        texto = archivo.read_text(encoding="utf-8")
        marcas = collections.Counter(re.findall(r'class="verificar">(\[[^\]]+\])', texto))
        for marca, n in sorted(marcas.items()):
            total += n
            print(f"  {nombre}: {marca}" + (f" ×{n}" if n > 1 else ""))
    print(f"  Total: {total}. El detalle y las fuentes sugeridas están en VERIFICAR.md.")


def main():
    paginas = leer_paginas()
    problemas, externos = revisar(paginas)
    if "--externos" in sys.argv:
        print(f"Revisando {len(externos)} enlaces externos…")
        problemas += revisar_externos(externos)
    if "--verificar" in sys.argv:
        listar_verificar(paginas)
    print()
    for p in problemas:
        print("PROBLEMA:", p)
    print(f"{len(paginas)} páginas revisadas; {len(problemas)} problema(s).")
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
