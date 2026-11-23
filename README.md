<img src="assets/img/logo.svg" alt="" width="64" height="64">

# Mendoza Mesh

Sitio didáctico en castellano sobre **LoRa** y **Meshtastic®** para principiantes, makers y
radioaficionados de Cuyo (Mendoza, San Juan y San Luis), Argentina.

Es un sitio estático (HTML, CSS y JavaScript sin frameworks) publicado en GitHub Pages:
**https://juliocesarmarquez.github.io/mendoza-mesh/**

> **Estado:** las cuatro fases están terminadas. Antes de publicar, revisá la lista de
> [pendientes](#antes-de-publicar) y [`VERIFICAR.md`](VERIFICAR.md).

## Estructura

```
index.html            Inicio
lora.html             ¿Qué es LoRa?
meshtastic.html       Meshtastic y la malla (con diagrama SVG)
configurar.html       Cómo configurar un nodo (6 pasos)
glosario.html         Glosario (48 términos, con buscador)
equipos.html          Equipos recomendados
laboratorio.html      Simulador, calculadora, quiz
preguntas.html        Preguntas frecuentes (8, desplegables)
comunidad.html        Agenda y canales de la comunidad
contacto.html         Formulario de contacto (arma un correo, no envía datos a ningún servidor)
404.html              Página no encontrada
robots.txt · sitemap.xml · .nojekyll
assets/css/tokens.css Paleta, tipografías y variables (modo claro y oscuro)
assets/css/base.css   Estilos y componentes
assets/js/tema.js     Tema claro/oscuro (se carga en <head>)
assets/js/nav.js      Menú desplegable para pantallas angostas
assets/js/glosario.js Buscador del glosario (ignora tildes y mayúsculas)
assets/js/{simulador,calculadora,quiz}.js  Elementos del laboratorio
assets/js/formulario.js  Formularios que arman un correo (mailto:), con validación accesible
assets/css/laboratorio.css  Estilos del laboratorio
.github/workflows/publicar.yml  Revisa el sitio y lo publica con cada push a main
assets/img/           Logo, favicon, imagen Open Graph, curvas de nivel decorativas
assets/fonts/         Atkinson Hyperlegible y Fraunces (woff2) con sus licencias OFL
herramientas/         Scripts de mantenimiento (ver abajo)
VERIFICAR.md          Todo lo que falta confirmar
```

## Ver el sitio en tu computadora

```sh
python3 -m http.server 8000
# abrí http://localhost:8000
```

## Publicar en GitHub Pages

1. Creá un repositorio **público** en GitHub (por ejemplo, `mendoza-mesh`) y subí esta carpeta:
   ```sh
   git init && git add . && git commit -m "Primera versión de Mendoza Mesh"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/mendoza-mesh.git
   git push -u origin main
   ```
2. En *Settings → Pages → Build and deployment*, elegí **Source: GitHub Actions**. El workflow
   `.github/workflows/publicar.yml` publica el sitio con cada push a `main`. Antes de publicar
   corre `revisar_enlaces.py` y `contraste.py`: si alguno falla, queda publicada la versión anterior.
3. Reemplazá la URL provisoria por la definitiva y subí el cambio:
   ```sh
   python3 herramientas/cambiar_url.py https://<tu-usuario>.github.io/mendoza-mesh/
   ```
4. ¿Dominio propio? Creá un archivo `CNAME` con el dominio (por ejemplo, `www.tu-dominio.org`),
   configuralo en *Settings → Pages → Custom domain* y usá esa dirección en el paso 3.

El sitio usa rutas relativas, así que funciona igual en `usuario.github.io/mendoza-mesh/` que en un dominio propio.

## Antes de publicar

- [ ] Resolver los pendientes de [`VERIFICAR.md`](VERIFICAR.md): normativa de ENACOM, versiones de las placas, presets de la región, etc.
- [ ] Poner la dirección de contacto real (ver [Editar contenido](#editar-contenido)).
- [ ] Reemplazar la agenda de ejemplo y completar los canales de la comunidad.
- [ ] Reemplazar la URL provisoria con `herramientas/cambiar_url.py`.
- [ ] Correr `python3 herramientas/revisar_enlaces.py --externos --verificar` y que no queden problemas.

## Editar contenido

- **Cabecera y pie:** editalos solo en `index.html` y corré `python3 herramientas/sincronizar_plantilla.py`.
- **Dirección de contacto del formulario:** en `contacto.html`, cambiá `mendozamesh@example.org` en
  el atributo `data-correo` y en el `action="mailto:…"` del formulario, en el enlace «Abrir el
  correo de nuevo» y en los dos textos `<span class="correo-contacto">`.
- **Campos del formulario:** `assets/js/formulario.js` se configura con atributos, sin tocar el
  JavaScript. Cada campo que va al correo lleva `data-etiqueta`; los obligatorios, `required` y
  `data-error-requerido`; el mensaje, `data-limite` y un `#<id>-contador`. Los motivos se
  preseleccionan con `contacto.html?motivo=<data-clave>` (por ejemplo, `?motivo=nodo`).
- **Agenda:** en `comunidad.html`, cada actividad es un `<article class="evento">` dentro de la lista
  `.agenda`. Copiá uno, cambiá la fecha (también en `<time datetime="…">`), el tipo
  (`evento__tipo--encuentro`, `--instalacion` o `--taller`), el título y la descripción. Borrá el
  aviso de «Agenda de ejemplo» cuando cargues fechas reales.
- **Preguntas frecuentes:** en `preguntas.html`, cada pregunta es un `<details>` con su `<summary>`.
- **Marcadores `[verificar]`:** son `<span class="verificar">[…]</span>`. Cuando resuelvas uno, borrá
  el span, corregí el texto si hace falta y pasá el ítem a «Resueltos» en `VERIFICAR.md`.

## Herramientas de mantenimiento

| Script | Para qué sirve |
|---|---|
| `python3 herramientas/revisar_enlaces.py` | Revisa enlaces internos y anclas, metadatos (title, description, canonical, Open Graph), títulos, `alt` e ids duplicados. Con `--externos` consulta también los enlaces externos y con `--verificar` lista los marcadores pendientes. |
| `python3 herramientas/cambiar_url.py <url>` | Reemplaza la URL provisoria en las metaetiquetas, `robots.txt` y `sitemap.xml`. Con `--probar` solo muestra qué cambiaría. |
| `python3 herramientas/contraste.py` | Comprueba el contraste WCAG de cada par de colores en modo claro y oscuro. `--md` imprime la tabla de abajo. |
| `python3 herramientas/sincronizar_plantilla.py` | Copia la cabecera y el pie de `index.html` a todas las páginas y marca la página actual en el menú. Usalo cada vez que cambies el menú o el pie. |
| `python3 herramientas/generar_imagenes.py` | Regenera la imagen Open Graph (1200×630) y el ícono de iOS con Chrome sin interfaz. |

La cabecera y el pie están repetidos en cada HTML a propósito: así el sitio funciona sin
JavaScript y sin paso de compilación. **Editalos solo en `index.html`** y después corré el
script de sincronización.

## Recuperar el mapa

La sección Mapa (mapa de nodos de Cuyo con Leaflet, ingesta MQTT y su workflow) se retiró el
23/11/2026 para rehacerla más adelante. Su último estado quedó en la etiqueta git `mapa-v1`:

```sh
git checkout mapa-v1 -- mapa.html assets/js/mapa.js assets/css/mapa.css vendor/leaflet data ingesta .github/workflows/actualizar-mapa.yml
```

Ese workflow también publicaba el sitio: si lo recuperás, borrá `publicar.yml` para que no haya dos
publicaciones a la vez, y volvé a agregar el ítem «Mapa» en la navegación de `index.html`.

## Cómo agregar un término al glosario

Cada término de `glosario.html` es un bloque como este, dentro de la sección de su letra y en orden alfabético:

```html
<div class="termino">
  <dt id="mi-termino"><dfn>Mi término</dfn> <span class="original">(<span lang="en">original en inglés</span>)</span></dt>
  <dd>
    <p>Explicación simple primero.</p>
    <p>Detalle técnico después.</p>
    <p class="relacionados">Relacionado: <a href="#otro-termino">Otro término</a>.</p>
  </dd>
</div>
```

El `id` es el ancla que usan las otras páginas (`glosario.html#mi-termino`): en minúsculas, sin tildes y con guiones.
El buscador lo encuentra solo, sin tocar el JavaScript.

## Diseño

- **Paleta** inspirada en el paisaje de Cuyo: vino (Malbec), ocre, verde viñedo y azul cordillera,
  sobre arena (modo claro) o noche andina (modo oscuro). Todos los colores son variables CSS en
  `assets/css/tokens.css`.
- **Tipografía:** Atkinson Hyperlegible para el texto (diseñada por el Braille Institute para
  máxima legibilidad) y Fraunces para los títulos. Las dos están alojadas en el sitio, sin pedidos
  a servidores externos.
- **Tema:** respeta la preferencia del sistema; el botón de la cabecera la cambia y la elección se
  recuerda en ese navegador.
- **Accesibilidad:**
  - Enlace «Saltar al contenido», foco visible, menú con `aria-expanded` y cierre con Esc.
  - Un solo `h1` por página y títulos sin saltos de nivel.
  - Formularios con etiquetas, ayudas y un resumen de errores que recibe el foco.
  - Animaciones desactivadas con `prefers-reduced-motion`.
- **Sin dependencias externas en tiempo de ejecución:** las tipografías y todo el código están en
  el repositorio. El sitio no hace pedidos a otros servidores.

<details>
<summary><strong>Tabla de contraste (WCAG 2.x, generada con <code>contraste.py --md</code>)</strong></summary>

| Texto / elemento | Fondo | Uso | Claro | Oscuro | Mínimo |
|---|---|---|---|---|---|
| `--texto` | `--fondo` | texto | 14.89:1 ✅ | 15.33:1 ✅ | 4.5:1 |
| `--texto` | `--superficie` | texto | 16.04:1 ✅ | 13.65:1 ✅ | 4.5:1 |
| `--texto` | `--superficie-2` | texto | 13.21:1 ✅ | 12.03:1 ✅ | 4.5:1 |
| `--texto` | `--cielo-alto` | texto | 13.18:1 ✅ | 16.26:1 ✅ | 4.5:1 |
| `--texto-suave` | `--fondo` | texto | 7.69:1 ✅ | 9.53:1 ✅ | 4.5:1 |
| `--texto-suave` | `--superficie` | texto | 8.29:1 ✅ | 8.49:1 ✅ | 4.5:1 |
| `--texto-suave` | `--superficie-2` | texto | 6.83:1 ✅ | 7.48:1 ✅ | 4.5:1 |
| `--texto-suave` | `--cielo-alto` | texto | 6.81:1 ✅ | 10.11:1 ✅ | 4.5:1 |
| `--vino` | `--fondo` | texto | 9.32:1 ✅ | 9.46:1 ✅ | 4.5:1 |
| `--vino` | `--superficie` | texto | 10.04:1 ✅ | 8.42:1 ✅ | 4.5:1 |
| `--vino` | `--superficie-2` | texto | 8.27:1 ✅ | 7.42:1 ✅ | 4.5:1 |
| `--vino` | `--cielo-alto` | texto | 8.25:1 ✅ | 10.03:1 ✅ | 4.5:1 |
| `--vino-hover` | `--fondo` | texto | 11.82:1 ✅ | 12.01:1 ✅ | 4.5:1 |
| `--vino-hover` | `--superficie` | texto | 12.73:1 ✅ | 10.70:1 ✅ | 4.5:1 |
| `--vino-hover` | `--superficie-2` | texto | 10.49:1 ✅ | 9.42:1 ✅ | 4.5:1 |
| `--vino-hover` | `--cielo-alto` | texto | 10.46:1 ✅ | 12.74:1 ✅ | 4.5:1 |
| `--ocre` | `--fondo` | texto | 5.91:1 ✅ | 9.10:1 ✅ | 4.5:1 |
| `--ocre` | `--superficie` | texto | 6.37:1 ✅ | 8.10:1 ✅ | 4.5:1 |
| `--ocre` | `--superficie-2` | texto | 5.25:1 ✅ | 7.14:1 ✅ | 4.5:1 |
| `--ocre` | `--cielo-alto` | texto | 5.24:1 ✅ | 9.65:1 ✅ | 4.5:1 |
| `--verde` | `--fondo` | texto | 5.91:1 ✅ | 10.04:1 ✅ | 4.5:1 |
| `--verde` | `--superficie` | texto | 6.37:1 ✅ | 8.94:1 ✅ | 4.5:1 |
| `--verde` | `--superficie-2` | texto | 5.25:1 ✅ | 7.88:1 ✅ | 4.5:1 |
| `--verde` | `--cielo-alto` | texto | 5.24:1 ✅ | 10.65:1 ✅ | 4.5:1 |
| `--azul` | `--fondo` | texto | 7.22:1 ✅ | 9.68:1 ✅ | 4.5:1 |
| `--azul` | `--superficie` | texto | 7.78:1 ✅ | 8.62:1 ✅ | 4.5:1 |
| `--azul` | `--superficie-2` | texto | 6.41:1 ✅ | 7.59:1 ✅ | 4.5:1 |
| `--azul` | `--cielo-alto` | texto | 6.39:1 ✅ | 10.26:1 ✅ | 4.5:1 |
| `--sobre-vino` | `--vino` | botón primario | 10.04:1 ✅ | 9.46:1 ✅ | 4.5:1 |
| `--sobre-vino` | `--vino-hover` | botón primario (hover) | 12.73:1 ✅ | 12.01:1 ✅ | 4.5:1 |
| `--sobre-ocre` | `--ocre-fondo` | marcador [verificar] | 7.64:1 ✅ | 9.10:1 ✅ | 4.5:1 |
| `--sobre-banda` | `--banda` | texto de la banda | 10.04:1 ✅ | 12.62:1 ✅ | 4.5:1 |
| `--banda` | `--sobre-banda` | texto del botón de la banda | 10.04:1 ✅ | 12.62:1 ✅ | 4.5:1 |
| `--sobre-banda` | `--banda` | botón de la banda sobre la banda | 10.04:1 ✅ | 12.62:1 ✅ | 3:1 |
| `--sobre-banda` | `--banda` | foco dentro de la banda | 10.04:1 ✅ | 12.62:1 ✅ | 3:1 |
| `--borde` | `--fondo` | borde de control | 3.82:1 ✅ | 4.10:1 ✅ | 3:1 |
| `--borde` | `--superficie` | borde de control | 4.12:1 ✅ | 3.65:1 ✅ | 3:1 |
| `--borde` | `--superficie-2` | borde de control | 3.39:1 ✅ | 3.22:1 ✅ | 3:1 |
| `--foco` | `--fondo` | anillo de foco | 5.98:1 ✅ | 12.63:1 ✅ | 3:1 |
| `--foco` | `--superficie` | anillo de foco | 6.44:1 ✅ | 11.25:1 ✅ | 3:1 |
| `--foco` | `--superficie-2` | anillo de foco | 5.30:1 ✅ | 9.91:1 ✅ | 3:1 |

</details>

## Créditos y licencias

- **Textos:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es) (ver `LICENSE-contenido.md`).
- **Código:** MIT (ver `LICENSE`).
- **Tipografías:** Atkinson Hyperlegible (Braille Institute) y Fraunces (The Fraunces Project Authors), SIL OFL 1.1.
- **Marcas:** LoRa® es una marca registrada de Semtech Corporation. Meshtastic® es una marca registrada de Meshtastic LLC. Los componentes de software de
  Meshtastic se publican bajo diversas licencias; consultá GitHub para más detalles. No se ofrece
  ninguna garantía: el uso es bajo tu propio riesgo. Este sitio no está afiliado ni respaldado por el
  proyecto Meshtastic.
