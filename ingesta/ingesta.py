#!/usr/bin/env python3
"""Ingesta MQTT del mapa de nodos de Cuyo (Mendoza Mesh).

Se suscribe a un broker MQTT de Meshtastic (el público o uno propio), se queda
con los nodos que reportan su posición dentro del recorte de Cuyo y guarda
data/nodes.json para que lo lea el mapa del sitio.

Privacidad por defecto:
  * Las posiciones se redondean (2 decimales, unos 1 km) ANTES de guardarse.
  * Los nodos de data/excluidos.json no se guardan ni aparecen en vecinos o
    traceroutes.
  * Solo se aceptan paquetes de otros nodos que tengan activado «OK to MQTT»
    (el mismo criterio que aplica el firmware oficial con el broker público).
  * Los paquetes cifrados con una clave distinta de la predeterminada se
    descartan: solo se lee lo que ya es público.

Modos de uso (desde la raíz del repositorio):
  python3 ingesta/ingesta.py --daemon            # escucha y escribe cada N minutos
  python3 ingesta/ingesta.py --duracion 480      # escucha 8 minutos, escribe y termina
  python3 ingesta/ingesta.py --reproducir x.jsonl  # procesa mensajes grabados (sin red)
  python3 ingesta/ingesta.py --duracion 300 --grabar x.jsonl  # además graba lo recibido

Modelo funcional: Meshtastic Map de Liam Cottle (MIT),
https://github.com/liamcottle/meshtastic-map. Este código es una implementación
propia en Python.
"""
from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import random
import signal
import struct
import sys
import tempfile
import threading
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from google.protobuf.message import DecodeError
from meshtastic.protobuf import config_pb2, mesh_pb2, mqtt_pb2, portnums_pb2, telemetry_pb2

RAIZ = Path(__file__).resolve().parent.parent
CONFIG_PREDETERMINADA = Path(__file__).resolve().parent / "config.json"

# Clave del canal predeterminado (PSK «AQ==»), tal como la define el firmware
# en src/mesh/Channels.h (defaultpsk). Es pública por diseño.
CLAVE_PREDETERMINADA = bytes([0xD4, 0xF1, 0xBB, 0x3A, 0x20, 0x29, 0x07, 0x59,
                              0xF0, 0xBC, 0xFF, 0xAB, 0xCF, 0x4E, 0x69, 0x01])
BIT_OK_TO_MQTT = 0x01  # Data.bitfield, bit 0 (firmware 2.5.0 o superior)
DIFUSION = 0xFFFFFFFF
SNR_DESCONOCIDO = -128  # valor que usa RouteDiscovery cuando no hay dato

Puerto = portnums_pb2.PortNum
PUERTOS_CONOCIDOS = set(Puerto.values())

log = logging.getLogger("ingesta")


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------
def id_de_nodo(num: int) -> str:
    return f"!{num & 0xFFFFFFFF:08x}"


def num_de_id(texto: str) -> int | None:
    texto = (texto or "").strip().lower()
    if texto.startswith("!"):
        texto = texto[1:]
    try:
        return int(texto, 16) & 0xFFFFFFFF
    except ValueError:
        return None


def iso(ts: float | None) -> str | None:
    if not ts:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def desde_iso(texto: str | None) -> float | None:
    if not texto:
        return None
    try:
        return datetime.strptime(texto, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()
    except ValueError:
        return None


def nombre_enum(enum, valor) -> str | None:
    try:
        return enum.Name(valor)
    except ValueError:
        return None


def descifrar(paquete: mesh_pb2.MeshPacket, clave: bytes) -> bytes:
    """AES-CTR con el nonce del firmware (CryptoEngine::initNonce):
    id del paquete (8 bytes, little endian) + nodo emisor (4 bytes) + 4 bytes en cero."""
    nonce = struct.pack("<QI", paquete.id, getattr(paquete, "from")) + b"\x00" * 4
    descifrador = Cipher(algorithms.AES(clave), modes.CTR(nonce)).decryptor()
    return descifrador.update(paquete.encrypted) + descifrador.finalize()


def punto_en_anillo(lon: float, lat: float, anillo: list) -> bool:
    dentro = False
    j = len(anillo) - 1
    for i in range(len(anillo)):
        xi, yi = anillo[i]
        xj, yj = anillo[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            dentro = not dentro
        j = i
    return dentro


class Provincias:
    """Asigna provincia por punto en polígono (límites simplificados del IGN)."""

    def __init__(self, ruta: Path):
        self.zonas = []
        if ruta.exists():
            datos = json.loads(ruta.read_text(encoding="utf-8"))
            for f in datos.get("features", []):
                geom = f["geometry"]
                poligonos = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
                self.zonas.append((f["properties"]["nombre"], poligonos))
        else:
            log.warning("No encontré %s: los nodos quedan sin provincia.", ruta)

    def de(self, lat: float, lon: float) -> str:
        for nombre, poligonos in self.zonas:
            for poligono in poligonos:
                exterior, *huecos = poligono
                if punto_en_anillo(lon, lat, exterior) and not any(punto_en_anillo(lon, lat, h) for h in huecos):
                    return nombre
        return "Fuera de Cuyo"


# --------------------------------------------------------------------------
# Almacén de nodos
# --------------------------------------------------------------------------
class Almacen:
    def __init__(self, config: dict, raiz: Path = RAIZ):
        self.config = config
        archivos = config["archivos"]
        self.ruta_nodos = raiz / archivos["nodos"]
        self.ruta_excluidos = raiz / archivos["excluidos"]
        self.provincias = Provincias(raiz / archivos["provincias"])
        self.recorte = config["recorte"]
        self.decimales = int(config.get("decimales", 2))
        self.nodos: dict[int, dict] = {}
        self.pendientes: dict[int, dict] = {}  # datos de nodos sin posición todavía
        self.waypoints: dict[int, dict] = {}
        self.traceroutes: list[dict] = []
        self.excluidos: set[int] = set()
        self.estadisticas: Counter = Counter()
        self.cerrojo = threading.Lock()
        self.cargar_excluidos()

    # ---- carga -----------------------------------------------------------
    def cargar_excluidos(self) -> None:
        self.excluidos = set()
        if not self.ruta_excluidos.exists():
            return
        datos = json.loads(self.ruta_excluidos.read_text(encoding="utf-8"))
        for entrada in datos.get("nodos", []):
            num = num_de_id(entrada.get("id", "") if isinstance(entrada, dict) else str(entrada))
            if num is not None:
                self.excluidos.add(num)
        log.info("Nodos excluidos a pedido: %d", len(self.excluidos))

    def cargar_previo(self) -> None:
        """Retoma el nodes.json anterior para no perder lo que se escuchó antes."""
        if not self.ruta_nodos.exists():
            return
        try:
            datos = json.loads(self.ruta_nodos.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            log.warning("No pude leer el nodes.json anterior (%s); empiezo de cero.", error)
            return
        conservar_ejemplos = self.config.get("conservar_ejemplos", False)
        for nodo in datos.get("nodos", []):
            if nodo.get("ejemplo") and not conservar_ejemplos:
                continue
            num = num_de_id(nodo.get("id", ""))
            if num is None or num in self.excluidos:
                continue
            nodo["_contacto"] = desde_iso(nodo.get("ultimo_contacto")) or 0
            self.nodos[num] = nodo
        for wp in datos.get("waypoints", []):
            if wp.get("ejemplo") and not conservar_ejemplos:
                continue
            self.waypoints[wp["id"]] = wp
        self.traceroutes = [t for t in datos.get("traceroutes", []) if conservar_ejemplos or not t.get("ejemplo")]
        log.info("Retomé %d nodos del archivo anterior.", len(self.nodos))

    # ---- utilidades ------------------------------------------------------
    def en_recorte(self, lat: float, lon: float) -> bool:
        r = self.recorte
        return r["lat_min"] <= lat <= r["lat_max"] and r["lon_min"] <= lon <= r["lon_max"]

    def redondear(self, valor: float) -> float:
        return round(valor, self.decimales)

    def ficha(self, num: int) -> dict:
        """Devuelve el nodo si ya tiene posición; si no, su ficha pendiente."""
        if num in self.nodos:
            return self.nodos[num]
        ficha = self.pendientes.setdefault(num, {"id": id_de_nodo(num)})
        ficha["_visto"] = time.time()
        return ficha

    def oculto(self, num: int) -> str | None:
        """ID para mostrar en vecinos y rutas; None si el nodo pidió no aparecer."""
        return None if num in self.excluidos else id_de_nodo(num)

    # ---- procesamiento de mensajes -----------------------------------------
    def procesar(self, tema: str, carga: bytes, ahora: float | None = None) -> None:
        ahora = ahora or time.time()
        with self.cerrojo:
            self.estadisticas["mensajes"] += 1
            if "/json/" in tema:
                self.estadisticas["json_ignorado"] += 1
                return
            sobre = mqtt_pb2.ServiceEnvelope()
            try:
                sobre.ParseFromString(carga)
            except DecodeError:
                self.estadisticas["no_decodificable"] += 1
                return
            if not sobre.HasField("packet"):
                self.estadisticas["no_decodificable"] += 1
                return
            paquete = sobre.packet
            datos = self.obtener_datos(paquete, sobre)
            if datos is None:
                return

            remitente = getattr(paquete, "from")
            pasarela = num_de_id(sobre.gateway_id)
            if remitente in self.excluidos:
                self.estadisticas["excluido"] += 1
                return
            if self.config.get("respetar_ok_to_mqtt", True) and remitente != pasarela:
                if not (datos.HasField("bitfield") and datos.bitfield & BIT_OK_TO_MQTT):
                    self.estadisticas["sin_ok_to_mqtt"] += 1
                    return

            manejador = {
                Puerto.POSITION_APP: self.posicion,
                Puerto.MAP_REPORT_APP: self.reporte_mapa,
                Puerto.NODEINFO_APP: self.info_nodo,
                Puerto.TELEMETRY_APP: self.telemetria,
                Puerto.NEIGHBORINFO_APP: self.vecinos,
                Puerto.TRACEROUTE_APP: self.traceroute,
                Puerto.WAYPOINT_APP: self.waypoint,
            }.get(datos.portnum)
            if manejador is None:
                self.estadisticas["otro_tipo"] += 1
            else:
                try:
                    manejador(paquete, datos, ahora)
                except DecodeError:
                    self.estadisticas["no_decodificable"] += 1
                    return
            if remitente in self.nodos:
                self.nodos[remitente]["_contacto"] = max(self.nodos[remitente].get("_contacto", 0), ahora)

    def obtener_datos(self, paquete, sobre) -> mesh_pb2.Data | None:
        if paquete.HasField("decoded"):
            return paquete.decoded
        if not paquete.encrypted:
            self.estadisticas["no_decodificable"] += 1
            return None
        if paquete.pki_encrypted or sobre.channel_id == "PKI":
            self.estadisticas["cifrado_ajeno"] += 1
            return None
        datos = mesh_pb2.Data()
        try:
            datos.ParseFromString(descifrar(paquete, CLAVE_PREDETERMINADA))
        except DecodeError:
            self.estadisticas["cifrado_ajeno"] += 1
            return None
        # Con otra clave, el resultado suele «decodificar» igual pero con basura:
        # un puerto desconocido o en cero delata que la clave no era la pública.
        if datos.portnum == 0 or datos.portnum not in PUERTOS_CONOCIDOS:
            self.estadisticas["cifrado_ajeno"] += 1
            return None
        return datos

    def posicion(self, paquete, datos, ahora) -> None:
        pos = mesh_pb2.Position()
        pos.ParseFromString(datos.payload)
        if not (pos.HasField("latitude_i") and pos.HasField("longitude_i")) or (pos.latitude_i == 0 and pos.longitude_i == 0):
            self.estadisticas["sin_posicion"] += 1
            return
        self.ubicar(getattr(paquete, "from"), pos.latitude_i * 1e-7, pos.longitude_i * 1e-7,
                    pos.altitude if pos.HasField("altitude") else None, ahora)

    def ubicar(self, num: int, lat: float, lon: float, altitud: int | None, ahora: float) -> None:
        if not self.en_recorte(lat, lon):
            self.estadisticas["fuera_de_recorte"] += 1
            if self.nodos.pop(num, None) is not None:
                log.info("%s salió del recorte; lo quito del mapa.", id_de_nodo(num))
            return
        nodo = self.nodos.get(num)
        if nodo is None:
            nodo = self.pendientes.pop(num, {"id": id_de_nodo(num)})
            self.nodos[num] = nodo
            self.estadisticas["nodos_nuevos"] += 1
        # El redondeo ocurre acá, antes de guardar cualquier coordenada.
        nodo["lat"] = self.redondear(lat)
        nodo["lon"] = self.redondear(lon)
        nodo["altitud"] = int(round(altitud, -1)) if altitud else None
        nodo["provincia"] = self.provincias.de(nodo["lat"], nodo["lon"])
        nodo["posicion_actualizada"] = iso(ahora)
        nodo["_contacto"] = ahora
        self.estadisticas["posiciones"] += 1

    def reporte_mapa(self, paquete, datos, ahora) -> None:
        rep = mqtt_pb2.MapReport()
        rep.ParseFromString(datos.payload)
        num = getattr(paquete, "from")
        # Solo se usa la ubicación si el titular aceptó compartirla en el reporte.
        if rep.has_opted_report_location and (rep.latitude_i or rep.longitude_i):
            self.ubicar(num, rep.latitude_i * 1e-7, rep.longitude_i * 1e-7, rep.altitude or None, ahora)
        ficha = self.ficha(num)
        ficha.update({
            "nombre_largo": rep.long_name or ficha.get("nombre_largo"),
            "nombre_corto": rep.short_name or ficha.get("nombre_corto"),
            "rol": nombre_enum(config_pb2.Config.DeviceConfig.Role, rep.role),
            "hardware": nombre_enum(mesh_pb2.HardwareModel, rep.hw_model),
            "firmware": rep.firmware_version or None,
            "region": nombre_enum(config_pb2.Config.LoRaConfig.RegionCode, rep.region),
            "preset": nombre_enum(config_pb2.Config.LoRaConfig.ModemPreset, rep.modem_preset),
            "nodos_cerca": rep.num_online_local_nodes,
        })
        self.estadisticas["reportes_mapa"] += 1

    def info_nodo(self, paquete, datos, ahora) -> None:
        usuario = mesh_pb2.User()
        usuario.ParseFromString(datos.payload)
        ficha = self.ficha(getattr(paquete, "from"))
        ficha.update({
            "nombre_largo": usuario.long_name or ficha.get("nombre_largo"),
            "nombre_corto": usuario.short_name or ficha.get("nombre_corto"),
            "hardware": nombre_enum(mesh_pb2.HardwareModel, usuario.hw_model) or ficha.get("hardware"),
            "rol": nombre_enum(config_pb2.Config.DeviceConfig.Role, usuario.role) or ficha.get("rol"),
        })
        self.estadisticas["info_nodos"] += 1

    def telemetria(self, paquete, datos, ahora) -> None:
        tel = telemetry_pb2.Telemetry()
        tel.ParseFromString(datos.payload)
        if not tel.HasField("device_metrics"):
            self.estadisticas["otra_telemetria"] += 1
            return
        m = tel.device_metrics
        ficha = self.ficha(getattr(paquete, "from"))
        ficha["telemetria"] = {
            "bateria": m.battery_level if m.HasField("battery_level") else None,  # 101 = alimentado por cable
            "voltaje": round(m.voltage, 2) if m.HasField("voltage") else None,
            "uso_canal": round(m.channel_utilization, 1) if m.HasField("channel_utilization") else None,
            "uso_aire_tx": round(m.air_util_tx, 1) if m.HasField("air_util_tx") else None,
            "fecha": iso(ahora),
        }
        self.estadisticas["telemetrias"] += 1

    def vecinos(self, paquete, datos, ahora) -> None:
        info = mesh_pb2.NeighborInfo()
        info.ParseFromString(datos.payload)
        ficha = self.ficha(getattr(paquete, "from"))
        ficha["vecinos"] = [
            {"id": self.oculto(v.node_id), "snr": round(v.snr, 1)}
            for v in info.neighbors if v.node_id not in self.excluidos
        ]
        ficha["vecinos_fecha"] = iso(ahora)
        self.estadisticas["vecinos"] += 1

    def traceroute(self, paquete, datos, ahora) -> None:
        if not datos.request_id:  # solo las respuestas traen el camino completo
            self.estadisticas["traceroute_pedido"] += 1
            return
        ruta = mesh_pb2.RouteDiscovery()
        ruta.ParseFromString(datos.payload)
        snr = lambda lista: [None if s == SNR_DESCONOCIDO else s / 4 for s in lista]
        origen, destino = paquete.to, getattr(paquete, "from")
        if origen == DIFUSION:
            return
        registro = {
            "origen": self.oculto(origen),
            "destino": self.oculto(destino),
            "ruta": [self.oculto(n) for n in ruta.route],
            "snr_ida": snr(ruta.snr_towards),
            "ruta_vuelta": [self.oculto(n) for n in ruta.route_back],
            "snr_vuelta": snr(ruta.snr_back),
            "fecha": iso(ahora),
        }
        self.traceroutes = [t for t in self.traceroutes
                            if not (t["origen"] == registro["origen"] and t["destino"] == registro["destino"])]
        self.traceroutes.append(registro)
        self.traceroutes = self.traceroutes[-int(self.config.get("max_traceroutes", 100)):]
        self.estadisticas["traceroutes"] += 1

    def waypoint(self, paquete, datos, ahora) -> None:
        wp = mesh_pb2.Waypoint()
        wp.ParseFromString(datos.payload)
        if not (wp.HasField("latitude_i") and wp.HasField("longitude_i")):
            return
        lat, lon = wp.latitude_i * 1e-7, wp.longitude_i * 1e-7
        if not self.en_recorte(lat, lon):
            self.estadisticas["fuera_de_recorte"] += 1
            return
        if wp.expire and wp.expire < ahora:
            self.waypoints.pop(wp.id, None)
            return
        self.waypoints[wp.id] = {
            "id": wp.id,
            "nombre": wp.name or "Waypoint",
            "descripcion": wp.description or None,
            "lat": self.redondear(lat),
            "lon": self.redondear(lon),
            "vence": iso(wp.expire) if wp.expire else None,
            "creado_por": self.oculto(getattr(paquete, "from")),
            "fecha": iso(ahora),
        }
        self.estadisticas["waypoints"] += 1

    # ---- exportación -------------------------------------------------------
    def exportar(self, ahora: float | None = None) -> dict:
        ahora = ahora or time.time()
        limite = ahora - float(self.config.get("olvidar_tras_dias", 7)) * 86400
        with self.cerrojo:
            for num in [n for n, d in self.nodos.items() if d.get("_contacto", 0) < limite or n in self.excluidos]:
                del self.nodos[num]
            # Fichas de nodos que nunca reportaron posición en el recorte: se olvidan al día.
            for num in [n for n, d in self.pendientes.items() if d.get("_visto", 0) < ahora - 86400]:
                del self.pendientes[num]
            for wid in [w for w, d in self.waypoints.items() if d.get("vence") and desde_iso(d["vence"]) < ahora]:
                del self.waypoints[wid]
            nodos = []
            for num, nodo in sorted(self.nodos.items()):
                salida = {k: v for k, v in nodo.items() if not k.startswith("_")}
                salida["id"] = id_de_nodo(num)
                salida["ultimo_contacto"] = iso(nodo.get("_contacto"))
                nodos.append(salida)
            return {
                "generado": iso(ahora),
                "fuente": "MQTT de Meshtastic, procesado por ingesta/ingesta.py de Mendoza Mesh",
                "aviso": "Solo aparecen nodos que reportan su posición al MQTT. Ubicaciones redondeadas.",
                "decimales": self.decimales,
                "inactivo_tras_horas": self.config.get("inactivo_tras_horas", 24),
                "recorte": self.recorte,
                "nodos": nodos,
                "waypoints": sorted(self.waypoints.values(), key=lambda w: w["id"]),
                "traceroutes": list(self.traceroutes),
            }

    def guardar(self, ahora: float | None = None) -> Path:
        datos = self.exportar(ahora)
        self.ruta_nodos.parent.mkdir(parents=True, exist_ok=True)
        # Escritura atómica: el mapa nunca lee un archivo a medio escribir.
        fd, temporal = tempfile.mkstemp(dir=self.ruta_nodos.parent, prefix=".nodes-", suffix=".json")
        with os.fdopen(fd, "w", encoding="utf-8") as archivo:
            json.dump(datos, archivo, ensure_ascii=False, indent=1)
            archivo.write("\n")
        os.replace(temporal, self.ruta_nodos)
        resumen = ", ".join(f"{k}={v}" for k, v in sorted(self.estadisticas.items()))
        log.info("Guardé %d nodos en %s. %s", len(datos["nodos"]), self.ruta_nodos, resumen)
        return self.ruta_nodos


# --------------------------------------------------------------------------
# Conexión MQTT y modos de ejecución
# --------------------------------------------------------------------------
def leer_config(ruta: Path) -> dict:
    config = json.loads(ruta.read_text(encoding="utf-8"))
    broker = config.setdefault("broker", {})
    # Las variables de entorno permiten usar un broker propio sin publicar la clave.
    for clave, variable in (("host", "MQTT_HOST"), ("usuario", "MQTT_USUARIO"), ("clave", "MQTT_CLAVE")):
        if os.environ.get(variable):
            broker[clave] = os.environ[variable]
    if os.environ.get("MQTT_PUERTO"):
        broker["puerto"] = int(os.environ["MQTT_PUERTO"])
    if os.environ.get("MQTT_TEMAS"):
        config["temas"] = [t.strip() for t in os.environ["MQTT_TEMAS"].split(",") if t.strip()]
    return config


def conectar(config: dict, almacen: Almacen, grabador=None):
    import paho.mqtt.client as mqtt

    broker = config["broker"]
    cliente = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2,
                          client_id=f"mendoza-mesh-ingesta-{random.randrange(16**6):06x}")
    if broker.get("usuario"):
        cliente.username_pw_set(broker["usuario"], broker.get("clave"))
    if broker.get("tls"):
        cliente.tls_set()

    def al_conectar(c, _datos, _banderas, codigo, _props):
        if codigo.is_failure:
            log.error("El broker rechazó la conexión: %s", codigo)
            return
        for tema in config["temas"]:
            c.subscribe(tema)
        log.info("Conectado a %s, suscripto a %s", broker["host"], ", ".join(config["temas"]))

    def al_recibir(_c, _datos, mensaje):
        if grabador:
            grabador.write(json.dumps({"tema": mensaje.topic,
                                       "carga_b64": base64.b64encode(mensaje.payload).decode()}) + "\n")
        almacen.procesar(mensaje.topic, mensaje.payload)

    cliente.on_connect = al_conectar
    cliente.on_message = al_recibir
    cliente.reconnect_delay_set(min_delay=2, max_delay=60)
    cliente.connect(broker["host"], int(broker.get("puerto", 1883)), keepalive=60)
    cliente.loop_start()
    return cliente


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Ingesta MQTT del mapa de nodos de Cuyo.")
    modo = parser.add_mutually_exclusive_group(required=True)
    modo.add_argument("--daemon", action="store_true", help="escuchar sin parar y escribir cada intervalo")
    modo.add_argument("--duracion", type=int, metavar="SEGUNDOS", help="escuchar un tiempo, escribir y terminar")
    modo.add_argument("--reproducir", type=Path, metavar="ARCHIVO", help="procesar mensajes grabados (JSON Lines)")
    parser.add_argument("--config", type=Path, default=CONFIG_PREDETERMINADA)
    parser.add_argument("--grabar", type=Path, metavar="ARCHIVO", help="guardar los mensajes recibidos (para depurar)")
    parser.add_argument("-v", "--detalle", action="store_true", help="mostrar más información")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.DEBUG if args.detalle else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    config = leer_config(args.config)
    almacen = Almacen(config)
    almacen.cargar_previo()

    if args.reproducir:
        with args.reproducir.open(encoding="utf-8") as archivo:
            for linea in archivo:
                if linea.strip():
                    registro = json.loads(linea)
                    almacen.procesar(registro["tema"], base64.b64decode(registro["carga_b64"]),
                                     registro.get("hora"))
        almacen.guardar()
        return 0

    grabador = args.grabar.open("a", encoding="utf-8") if args.grabar else None
    terminar = threading.Event()
    for senal in (signal.SIGINT, signal.SIGTERM):
        signal.signal(senal, lambda *_: terminar.set())

    cliente = conectar(config, almacen, grabador)
    try:
        if args.duracion:
            terminar.wait(args.duracion)
        else:
            intervalo = float(config.get("intervalo_escritura_min", 10)) * 60
            while not terminar.wait(intervalo):
                almacen.guardar()
    finally:
        cliente.loop_stop()
        cliente.disconnect()
        if grabador:
            grabador.close()
        almacen.guardar()
    return 0


if __name__ == "__main__":
    sys.exit(main())
