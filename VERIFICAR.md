# Pendientes de verificar

Todo lo que el sitio marca como `[verificar]` o que todavía no está confirmado, agrupado por tema.
Los números se mantienen entre fases (el 9 ya está resuelto). Cuando resolvamos uno, pasa a «Resueltos» con su fuente.

Para ver los marcadores que quedan en las páginas:
`python3 herramientas/revisar_enlaces.py --verificar` (hoy son 24 marcas para 15 ítems).

## Abiertos

### Decisiones tuyas

| # | Ítem | Dónde aparece | Qué hace falta |
|---|---|---|---|
| 2 | Titular del copyright («Comunidad Mendoza Mesh») | `LICENSE`, `LICENSE-contenido.md` | Confirmar el nombre de la comunidad, la persona o la organización |
| 14 | Dirección de contacto (hoy `mendozamesh@example.org`, un dominio de ejemplo) | `comunidad.html` (formulario y aviso de privacidad) | Una dirección real. Ver «Editar contenido» en el README |
| 15 | Canales propios de Mendoza Mesh | `comunidad.html` («Grupos y sitios») | Enlaces a los grupos de la comunidad (Telegram, WhatsApp, etc.), si existen |
| 16 | Agenda real | `comunidad.html` (las 3 actividades son de EJEMPLO) | Fechas, lugares y tipos de actividad reales |
| 17 | Relación con el canal «MendozaMesh» de la comunidad Meshtastic Argentina | `comunidad.html` («En la malla») | MeshArg publica un canal secundario llamado **MendozaMesh** (Mendoza, Long Fast). ¿Este proyecto es la misma comunidad, una aliada o una distinta? Define cómo presentarlo y si conviene otro nombre para evitar confusiones. El sitio no copia la clave: enlaza a la fuente |

### Normativa

| # | Ítem | Dónde aparece | Por qué está pendiente | Fuente sugerida |
|---|---|---|---|---|
| 5 | Condiciones técnicas de la banda 915–928 MHz (potencia máxima, PIRE, ancho de banda) | `lora.html`, `preguntas.html`, `equipos.html` (alta potencia), `laboratorio.html` (calculadora) | ENACOM confirma que la banda es de uso compartido sin autorización (Res. 581/18) con las condiciones de la Res. 4653/19, pero no pude leer el anexo técnico. Una búsqueda menciona 30 dBm conducidos y 36 dBm PIRE (anexo de la Res. 581/18). La Res. 1132/2023 pide un ancho mínimo de 500 kHz para «modulación digital de banda ancha» en 902–928 MHz, y no está claro cómo aplica a LoRa | https://www.enacom.gob.ar/multimedia/normativas/2019/res4653.pdf y https://www.enacom.gob.ar/multimedia/normativas/2018/res581MM.pdf |
| 6 | Región ANZ para Argentina | `configurar.html` (paso 4) | Lo confirman la tabla oficial de regiones por país y la comunidad MeshArg («ANZ, en todo el país»). Lo dejé marcado porque pediste contrastarlo también con ENACOM | https://meshtastic.org/docs/configuration/region-by-country/ |
| 7 | Si los presets Turbo (500 kHz) están permitidos en Argentina | `meshtastic.html` (presets) | La documentación dice que 500 kHz no es legal en todas las regiones | ENACOM, Res. 4653/19 |

### La red de Cuyo

| # | Ítem | Dónde aparece | Por qué está pendiente | Fuente sugerida |
|---|---|---|---|---|
| 8 | Preset en San Juan y San Luis | `meshtastic.html` (presets) | Para Mendoza, MeshArg indica Long Fast (canal MendozaMesh). Para San Juan y San Luis no encontré datos | Hilos provinciales del Telegram de MeshArg |
| 11 | Raíz MQTT que usa la comunidad de Cuyo | `mapa.html`, `ingesta/config.json` | La ingesta escucha `msh/ANZ/#`. **Ojo:** MeshArg dice que prioriza la malla por radio y no usa MQTT en sus redes, así que el mapa por MQTT puede mostrar pocos nodos. Alternativa a futuro: una ingesta «por radio», con un nodo que solo escucha conectado a una computadora, como los mapas del AMBA | Comunidad local |

### Contenido técnico y créditos

| # | Ítem | Dónde aparece | Por qué está pendiente | Fuente sugerida |
|---|---|---|---|---|
| 3 | Si alcanza con la declaración de marca en castellano | Pie de todas las páginas | La política de Meshtastic pide la declaración y un aviso de no afiliación «prominente». Hoy va en castellano, y el aviso de no afiliación también en inglés | https://meshtastic.org/docs/legal/licensing-and-trademark/ o trademark@meshtastic.org |
| 4 | Relación entre mapa.meshtastic.es y el mapa de Liam Cottle | Pie («Créditos del mapa») | El repositorio de mapa.meshtastic.es no figura como fork y usa licencia **CC BY-NC-ND 4.0**. Por eso se lo cita solo como referencia y no se copia su código | https://github.com/EmilioAL-Git/Meshtastic-es-map |
| 10 | Versión actual de cada placa de la comparativa (9 modelos) | `equipos.html` | Los fabricantes cambian de versión seguido. Los datos salen de las fichas oficiales (documentación 2.8) | https://meshtastic.org/docs/hardware/devices/ |
| 12 | Licencia de los límites provinciales del IGN | `mapa.html` (créditos), `data/provincias-cuyo.geojson` | El IGN pide atribución, pero no encontré la licencia exacta de la capa `ign:provincia` | Metadatos de la capa en https://www.ign.gob.ar/ o en datos.gob.ar |
| 13 | Carga de baterías de litio por debajo de 0 °C | `equipos.html` (accesorios) | Es una recomendación general: depende de la química y de la hoja de datos de cada batería | Hoja de datos del fabricante |

## Resueltos

| Ítem | Resolución | Fuente |
|---|---|---|
| Licencia del mapa de Liam Cottle | MIT (confirmada en la API de GitHub) | https://github.com/liamcottle/meshtastic-map |
| Texto de marca de Meshtastic | Se usa la declaración oficial: «Meshtastic® is a registered trademark of Meshtastic LLC…» y el aviso de no afiliación pedido para sitios comunitarios | https://meshtastic.org/docs/legal/licensing-and-trademark/ |
| Licencia del sitio | Textos bajo CC BY-SA 4.0 y código bajo MIT (decisión del 20/11/2026) | Vos |
| Mecanismo del formulario de Comunidad | Correo prellenado (`mailto:`); falta la dirección (se agrega como ítem en la fase 4) | Vos |
| Banda de 915–928 MHz en Argentina | Es de uso compartido sin autorización (Res. MM 581/18), con las condiciones de la Res. ENACOM 4653/19 | https://www.enacom.gob.ar/bandas-de-uso-compartido-sin-autorizacion_p680 |
| Presets, velocidades y presupuesto de enlace | Tabla oficial de presets (firmware 2.8) | https://meshtastic.org/docs/overview/radio-settings/ |
| Roles de los nodos | Lista oficial (2.8). REPEATER, obsoleto desde 2.7.11; ROUTER_CLIENT, desde 2.3.15 | https://meshtastic.org/docs/configuration/radio/device/ |
| Límite de saltos | Predeterminado 3, máximo 7; un salto = una retransmisión | https://meshtastic.org/docs/configuration/radio/lora/ y https://meshtastic.org/docs/terms/ |
| Canales y clave predeterminada | Hasta 8 canales (0 a 7); clave pública AQ==; AES-128 o AES-256 | https://meshtastic.org/docs/configuration/radio/channels/ |
| PIN de Bluetooth | Con pantalla, PIN aleatorio; sin pantalla, PIN fijo 123456 (se recomienda cambiarlo) | https://meshtastic.org/docs/configuration/radio/bluetooth/ |
| Largo de los nombres | Largo: 39 bytes; corto: 4 bytes (`max_size` 40 y 5, con el terminador) | https://github.com/meshtastic/protobufs/blob/master/meshtastic/mesh.options |
| No encender sin antena | Advertencia literal de la documentación oficial | https://meshtastic.org/docs/getting-started/ |
| Web Flasher | Requiere Chrome o Edge; nRF52 también por arrastre de UF2 | https://meshtastic.org/docs/getting-started/flashing-firmware/ |
| «OK to MQTT» desde el firmware 2.5 | El campo `Data.bitfield` (bit 0 = ok_to_mqtt) existe desde la 2.5.0, según los comentarios del protobuf oficial. Además, el firmware no sube a un broker público paquetes de otros nodos sin ese bit | https://github.com/meshtastic/protobufs/blob/master/meshtastic/mesh.proto y src/mqtt/MQTT.cpp del firmware |
| Recorte geográfico (lat −37,7 a −28,0; lon −70,7 a −64,3) | Contiene las tres provincias con margen: los límites del IGN van de lat −37,58 a −28,39 y de lon −70,58 a −64,88. Incluye partes de Chile y de provincias vecinas, que el mapa marca como «Fuera de Cuyo» | Capa `ign:provincia` del IGN |
| Temas MQTT y clave predeterminada | Temas `msh/REGIÓN/2/e/CANAL/!pasarela` y `msh/REGIÓN/2/map/`; clave `d4f1bb3a…6901` (AQ==); nonce = id del paquete + nodo emisor | Documentación MQTT, `src/mesh/Channels.h` y `src/mesh/CryptoEngine.cpp` del firmware |
| Qué deja pasar el broker público | En el canal predeterminado: NodeInfo, mensajes, posición, telemetría, reportes de mapa y enrutamiento; posiciones solo con 10 a 16 bits de precisión. Vecinos, traceroutes y waypoints pueden no llegar | https://meshtastic.org/docs/software/integrations/mqtt/ |
| Límites de GitHub Actions | Intervalo mínimo de 5 minutos, demoras o descartes en horas pico, desactivación tras 60 días sin actividad en repositorios públicos | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows |
| Versiones de las acciones de GitHub | checkout v7, setup-python v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5 (últimas versiones al 20/11/2026) | API de GitHub |
| Leaflet | 1.9.4 es la última versión estable; la 2.0 sigue en beta | https://github.com/Leaflet/Leaflet/releases |
| Fórmulas de la calculadora | Horizonte con k = 4/3 (4,12·√h km), radio de Fresnel 8,66·√(D/f) m, pérdida en espacio libre; sensibilidad = 22 dBm − presupuesto oficial de cada preset | Fórmulas estándar de radioenlaces y https://meshtastic.org/docs/overview/radio-settings/ |
| Región ANZ según la comunidad | MeshArg: «Región: ANZ, en todo el país». Sigue abierta en el ítem 6 por tu pedido de verificar con ENACOM | https://github.com/Meshtastic-Argentina/docu |
| Versiones del firmware | «Beta» son las versiones recomendadas (hoy 2.7.26) y «Alpha», las de prueba (2.8.x). El preset Medium Turbo existe solo desde la 2.8: la tabla lo aclara, y Configurar recomienda la última Beta | https://github.com/meshtastic/firmware/releases y la documentación 2.7 |
| Grupo de Argentina en el directorio oficial | El directorio de grupos locales de Meshtastic enlaza a «Meshtastic Argentina Community» (MeshArg) | https://meshtastic.org/docs/community/local-groups/ |
| URL definitiva del sitio | https://juliocesarmarquez.github.io/mendoza-mesh/ (repositorio público juliocesarmarquez/mendoza-mesh), aplicada con `herramientas/cambiar_url.py` | Decisión tuya, 20/11/2026 |
