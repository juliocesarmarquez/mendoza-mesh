"""Pruebas de la ingesta, sin conexión a internet.

Se arman paquetes reales con los protobufs oficiales de Meshtastic, se cifran
con la clave pública predeterminada (o con otra) y se pasan por la ingesta.

    python3 -m unittest discover -s ingesta/pruebas -v
"""
import json
import shutil
import struct
import sys
import tempfile
import unittest
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from meshtastic.protobuf import config_pb2, mesh_pb2, mqtt_pb2, portnums_pb2, telemetry_pb2

RAIZ_REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ_REPO / "ingesta"))
import ingesta  # noqa: E402

P = portnums_pb2.PortNum
AHORA = 1_790_000_000.0  # hora fija para que las pruebas sean reproducibles
PASARELA = 0xA0A0A0A0
MENDOZA = (-32.8895, -68.8458)    # ciudad de Mendoza
SAN_JUAN = (-31.5375, -68.5364)   # ciudad de San Juan
SAN_LUIS = (-33.2950, -66.3356)   # ciudad de San Luis
SANTIAGO = (-33.4489, -70.6693)   # Santiago de Chile: dentro del recorte, fuera de Cuyo
BUENOS_AIRES = (-34.6037, -58.3816)


def cifrar(datos: bytes, id_paquete: int, remitente: int, clave: bytes) -> bytes:
    nonce = struct.pack("<QI", id_paquete, remitente) + b"\x00" * 4
    cifrador = Cipher(algorithms.AES(clave), modes.CTR(nonce)).encryptor()
    return cifrador.update(datos) + cifrador.finalize()


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        (self.dir / "data").mkdir()
        shutil.copy(RAIZ_REPO / "data" / "provincias-cuyo.geojson", self.dir / "data" / "provincias-cuyo.geojson")
        (self.dir / "data" / "excluidos.json").write_text(json.dumps({"nodos": [{"id": "!0bad0bad"}]}))
        self.config = json.loads((RAIZ_REPO / "ingesta" / "config.json").read_text(encoding="utf-8"))
        self.almacen = ingesta.Almacen(self.config, raiz=self.dir)
        self.contador = 1000

    def tearDown(self):
        shutil.rmtree(self.dir)

    def enviar(self, remitente, puerto, mensaje, *, clave=ingesta.CLAVE_PREDETERMINADA, ok_mqtt=True,
               destino=0xFFFFFFFF, request_id=0, tema="msh/ANZ/2/e/LongFast/!a0a0a0a0", ahora=AHORA):
        self.contador += 1
        datos = mesh_pb2.Data(portnum=puerto, payload=mensaje.SerializeToString(), request_id=request_id)
        if ok_mqtt:
            datos.bitfield = ingesta.BIT_OK_TO_MQTT
        paquete = mesh_pb2.MeshPacket(to=destino, id=self.contador, hop_limit=3, hop_start=3)
        setattr(paquete, "from", remitente)
        if clave is None:
            paquete.decoded.CopyFrom(datos)
        else:
            paquete.encrypted = cifrar(datos.SerializeToString(), self.contador, remitente, clave)
        sobre = mqtt_pb2.ServiceEnvelope(packet=paquete, channel_id="LongFast", gateway_id=ingesta.id_de_nodo(PASARELA))
        self.almacen.procesar(tema, sobre.SerializeToString(), ahora)

    def posicion(self, remitente, lat, lon, **kw):
        pos = mesh_pb2.Position(latitude_i=int(lat * 1e7), longitude_i=int(lon * 1e7), altitude=747)
        self.enviar(remitente, P.POSITION_APP, pos, **kw)

    def salida(self, ahora=AHORA):
        return {n["id"]: n for n in self.almacen.exportar(ahora)["nodos"]}


class Posiciones(Base):
    def test_dentro_del_recorte_se_guarda_redondeada(self):
        self.posicion(0x11111111, *MENDOZA)
        nodo = self.salida()["!11111111"]
        self.assertEqual((nodo["lat"], nodo["lon"]), (-32.89, -68.85))
        self.assertEqual(nodo["provincia"], "Mendoza")
        self.assertEqual(nodo["altitud"], 750)

    def test_provincias(self):
        for num, punto, esperada in ((1, SAN_JUAN, "San Juan"), (2, SAN_LUIS, "San Luis"), (3, SANTIAGO, "Fuera de Cuyo")):
            self.posicion(num, *punto)
            self.assertEqual(self.salida()[ingesta.id_de_nodo(num)]["provincia"], esperada)

    def test_fuera_del_recorte_se_descarta(self):
        self.posicion(0x22222222, *BUENOS_AIRES)
        self.assertNotIn("!22222222", self.salida())
        self.assertEqual(self.almacen.estadisticas["fuera_de_recorte"], 1)

    def test_nodo_que_sale_del_recorte_se_quita(self):
        self.posicion(0x33333333, *MENDOZA)
        self.posicion(0x33333333, *BUENOS_AIRES)
        self.assertNotIn("!33333333", self.salida())

    def test_paquete_sin_cifrar_tambien_se_procesa(self):
        self.posicion(0x44444444, *MENDOZA, clave=None)
        self.assertIn("!44444444", self.salida())


class Privacidad(Base):
    def test_clave_distinta_se_descarta(self):
        otra_clave = bytes(range(16))
        for i in range(20):
            self.posicion(0x50000000 + i, *MENDOZA, clave=otra_clave)
        self.assertEqual(self.salida(), {})
        self.assertGreaterEqual(self.almacen.estadisticas["cifrado_ajeno"] + self.almacen.estadisticas["no_decodificable"], 20)

    def test_nodo_excluido_no_aparece(self):
        self.posicion(0x0BAD0BAD, *MENDOZA)
        self.assertNotIn("!0bad0bad", self.salida())
        self.assertEqual(self.almacen.estadisticas["excluido"], 1)

    def test_sin_ok_to_mqtt_se_descarta(self):
        self.posicion(0x66666666, *MENDOZA, ok_mqtt=False)
        self.assertNotIn("!66666666", self.salida())
        self.assertEqual(self.almacen.estadisticas["sin_ok_to_mqtt"], 1)

    def test_la_pasarela_puede_subir_sus_propios_paquetes(self):
        self.posicion(PASARELA, *MENDOZA, ok_mqtt=False)
        self.assertIn(ingesta.id_de_nodo(PASARELA), self.salida())

    def test_excluido_se_oculta_en_vecinos_y_traceroute(self):
        self.posicion(0x77777777, *MENDOZA)
        info = mesh_pb2.NeighborInfo(node_id=0x77777777, neighbors=[
            mesh_pb2.Neighbor(node_id=0x0BAD0BAD, snr=5.0), mesh_pb2.Neighbor(node_id=0x88888888, snr=-3.25)])
        self.enviar(0x77777777, P.NEIGHBORINFO_APP, info)
        self.assertEqual(self.salida()["!77777777"]["vecinos"], [{"id": "!88888888", "snr": -3.2}])
        ruta = mesh_pb2.RouteDiscovery(route=[0x0BAD0BAD], snr_towards=[20, -128])
        self.enviar(0x88888888, P.TRACEROUTE_APP, ruta, destino=0x77777777, request_id=99)
        tr = self.almacen.exportar(AHORA)["traceroutes"][0]
        self.assertEqual(tr["ruta"], [None])
        self.assertEqual(tr["snr_ida"], [5.0, None])
        self.assertEqual((tr["origen"], tr["destino"]), ("!77777777", "!88888888"))

    def test_reporte_de_mapa_respeta_la_decision_del_titular(self):
        rep = mqtt_pb2.MapReport(long_name="Sin permiso", latitude_i=int(MENDOZA[0] * 1e7),
                                 longitude_i=int(MENDOZA[1] * 1e7), has_opted_report_location=False)
        self.enviar(PASARELA, P.MAP_REPORT_APP, rep, tema="msh/ANZ/2/map/")
        self.assertEqual(self.salida(), {})
        rep.has_opted_report_location = True
        rep.role = config_pb2.Config.DeviceConfig.Role.ROUTER
        self.enviar(PASARELA, P.MAP_REPORT_APP, rep, tema="msh/ANZ/2/map/")
        nodo = self.salida()[ingesta.id_de_nodo(PASARELA)]
        self.assertEqual((nodo["nombre_largo"], nodo["rol"], nodo["lat"]), ("Sin permiso", "ROUTER", -32.89))


class Datos(Base):
    def test_nombre_antes_que_posicion(self):
        usuario = mesh_pb2.User(id="!12121212", long_name="Cerro Arco", short_name="ARCO",
                                hw_model=mesh_pb2.HardwareModel.HELTEC_V3,
                                role=config_pb2.Config.DeviceConfig.Role.ROUTER)
        self.enviar(0x12121212, P.NODEINFO_APP, usuario)
        self.assertEqual(self.salida(), {})  # sin posición todavía no se publica
        self.posicion(0x12121212, *MENDOZA)
        nodo = self.salida()["!12121212"]
        self.assertEqual((nodo["nombre_corto"], nodo["hardware"], nodo["rol"]), ("ARCO", "HELTEC_V3", "ROUTER"))

    def test_telemetria(self):
        self.posicion(0x13131313, *MENDOZA)
        tel = telemetry_pb2.Telemetry(device_metrics=telemetry_pb2.DeviceMetrics(battery_level=87, voltage=4.0512))
        self.enviar(0x13131313, P.TELEMETRY_APP, tel)
        t = self.salida()["!13131313"]["telemetria"]
        self.assertEqual((t["bateria"], t["voltaje"]), (87, 4.05))

    def test_waypoint(self):
        wp = mesh_pb2.Waypoint(id=7, name="Refugio", latitude_i=int(-32.9 * 1e7), longitude_i=int(-69.1 * 1e7))
        self.enviar(0x14141414, P.WAYPOINT_APP, wp)
        waypoints = self.almacen.exportar(AHORA)["waypoints"]
        self.assertEqual((waypoints[0]["nombre"], waypoints[0]["lon"]), ("Refugio", -69.1))

    def test_json_y_basura_no_rompen(self):
        self.almacen.procesar("msh/ANZ/2/json/LongFast/!a0a0a0a0", b'{"hola": 1}', AHORA)
        self.almacen.procesar("msh/ANZ/2/e/LongFast/!a0a0a0a0", b"\xff\xfe basura", AHORA)
        self.assertEqual(self.salida(), {})


class Archivo(Base):
    def test_guardar_retomar_y_olvidar(self):
        self.posicion(0x15151515, *MENDOZA)
        ruta = self.almacen.guardar(AHORA)
        datos = json.loads(ruta.read_text(encoding="utf-8"))
        self.assertEqual(datos["nodos"][0]["id"], "!15151515")
        self.assertEqual(datos["decimales"], 2)
        nuevo = ingesta.Almacen(self.config, raiz=self.dir)
        nuevo.cargar_previo()
        self.assertIn(0x15151515, nuevo.nodos)
        # Ocho días después, el nodo se olvida.
        self.assertEqual(nuevo.exportar(AHORA + 8 * 86400)["nodos"], [])

    def test_los_ejemplos_se_descartan_en_la_primera_ingesta(self):
        ejemplo = json.loads((RAIZ_REPO / "data" / "nodes.json").read_text(encoding="utf-8"))
        (self.dir / "data" / "nodes.json").write_text(json.dumps(ejemplo), encoding="utf-8")
        self.almacen.cargar_previo()
        self.assertEqual(self.almacen.nodos, {})


if __name__ == "__main__":
    unittest.main()
