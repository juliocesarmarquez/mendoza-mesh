// Mendoza Mesh: la malla de nodos de la escena 3D.
// Nodos en cerros y en el valle, enlaces de radio punteados y mensajes que
// saltan de nodo en nodo (búsqueda en anchura con límite de saltos, como el
// simulador del Laboratorio). Es decorativa: no representa nodos reales.
import * as THREE from "../../../vendor/three/three.min.js";
import { alturaEn, aleatorio } from "./terreno.js";

const ESPACIO_PUNTOS = 0.95; // distancia entre los puntos de un enlace
const INTERVALO = 3.6;       // segundos entre mensajes
const DEMORA_SALTO = 0.9;    // segundos entre un salto y el siguiente
const DURACION_SALTO = 0.8;  // segundos que tarda un salto
const MAX_PULSOS = 40;

// Textura redonda y suave para los puntos (enlaces y mensajes).
function texturaPunto() {
  const lado = 64;
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = lado;
  const ctx = lienzo.getContext("2d");
  const g = ctx.createRadialGradient(lado / 2, lado / 2, 0, lado / 2, lado / 2, lado / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, lado, lado);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

// Busca el punto más alto cerca de (x, z): los nodos van en las cumbres.
function cumbreCerca(x, z, radio) {
  let mejor = { x, z, y: alturaEn(x, z) };
  for (let i = -3; i <= 3; i++) {
    for (let k = -3; k <= 3; k++) {
      const px = x + (i / 3) * radio, pz = z + (k / 3) * radio;
      const y = alturaEn(px, pz);
      if (y > mejor.y) mejor = { x: px, z: pz, y };
    }
  }
  return mejor;
}

/**
 * Crea la malla.
 * @param cfg      preset (cantidad de nodos y saltos)
 * @param mitadAncho función z → media anchura visible en x a esa profundidad
 * @param camara   cámara (para el tamaño de los nodos según la distancia)
 */
export function crearMalla(cfg, mitadAncho, camara) {
  const grupo = new THREE.Object3D();
  const azar = aleatorio(915);

  // --- Nodos: valle (pueblos), lomas y cumbres -------------------------------
  const reparto = cfg.nodos >= 12 ? [4, 4, 6] : cfg.nodos >= 9 ? [3, 3, 3] : [2, 2, 3];
  const bandas = [
    { z: [3, 10], cumbre: 0 },
    { z: [-18, -8], cumbre: 3 },
    { z: [-44, -28], cumbre: 7 },
  ];
  const nodos = [];
  bandas.forEach((banda, b) => {
    const n = reparto[b];
    for (let i = 0; i < n; i++) {
      const z = banda.z[0] + azar() * (banda.z[1] - banda.z[0]);
      const fraccion = (i + 0.5) / n + (azar() - 0.5) * (0.6 / n);
      const x = (fraccion * 2 - 1) * mitadAncho(z) * 0.86;
      const lugar = banda.cumbre ? cumbreCerca(x, z, banda.cumbre) : { x, z, y: alturaEn(x, z) };
      const distancia = camara.position.distanceTo(new THREE.Vector3(lugar.x, lugar.y, lugar.z));
      const escala = distancia * 0.0125;
      nodos.push({ x: lugar.x, y: lugar.y + escala * 2.4, z: lugar.z, suelo: lugar.y, escala, energia: 0, vecinos: [] });
    }
  });

  // --- Enlaces: vecinos cercanos, con la red siempre conectada ----------------
  const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 0.5, a.z - b.z);
  const pares = [];
  for (let i = 0; i < nodos.length; i++) {
    for (let k = i + 1; k < nodos.length; k++) pares.push({ a: i, b: k, d: dist(nodos[i], nodos[k]) });
  }
  pares.sort((p, q) => p.d - q.d);
  const grupoDe = nodos.map((_, i) => i);
  const raiz = (i) => (grupoDe[i] === i ? i : (grupoDe[i] = raiz(grupoDe[i])));
  const enlaces = [];
  // Primero un árbol con los enlaces más cortos (todos conectados)…
  for (const p of pares) {
    if (raiz(p.a) !== raiz(p.b)) { grupoDe[raiz(p.a)] = raiz(p.b); enlaces.push(p); }
  }
  // …y después algunos enlaces cortos más, para que sea una malla y no un árbol.
  const umbral = pares[Math.floor(pares.length * 0.18)].d;
  for (const p of pares) {
    if (p.d > umbral || enlaces.includes(p)) continue;
    if (nodos[p.a].vecinos.length > 3 || nodos[p.b].vecinos.length > 3) continue;
    enlaces.push(p);
  }
  for (const e of enlaces) { nodos[e.a].vecinos.push(e.b); nodos[e.b].vecinos.push(e.a); }

  // --- Geometrías ---------------------------------------------------------------
  const textura = texturaPunto();
  const octaedro = new THREE.OctahedronGeometry(1, 0);
  const matNodo = new THREE.MeshBasicMaterial();
  const matBorde = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
  const instNodos = new THREE.InstancedMesh(octaedro, matNodo, nodos.length);
  const instBordes = new THREE.InstancedMesh(octaedro, matBorde, nodos.length);
  const auxiliar = new THREE.Object3D();
  function ubicarNodo(i) {
    const n = nodos[i];
    const s = n.escala * (1 + n.energia * 0.7);
    auxiliar.position.set(n.x, n.y, n.z);
    auxiliar.rotation.set(0, Math.PI / 4, 0);
    auxiliar.scale.setScalar(s);
    auxiliar.updateMatrix();
    instNodos.setMatrixAt(i, auxiliar.matrix);
    auxiliar.scale.setScalar(s * 1.45);
    auxiliar.updateMatrix();
    instBordes.setMatrixAt(i, auxiliar.matrix);
  }
  nodos.forEach((_, i) => ubicarNodo(i));
  grupo.add(instBordes, instNodos);

  // Mástiles
  const mastiles = new Float32Array(nodos.length * 6);
  nodos.forEach((n, i) => mastiles.set([n.x, n.suelo, n.z, n.x, n.y, n.z], i * 6));
  const geoMastiles = new THREE.BufferGeometry();
  geoMastiles.setAttribute("position", new THREE.BufferAttribute(mastiles, 3));
  const matMastil = new THREE.LineBasicMaterial();
  grupo.add(new THREE.LineSegments(geoMastiles, matMastil));

  // Enlaces punteados: los puntos avanzan despacio, como el flujo de la ilustración.
  const tramos = enlaces.map((e) => {
    const a = nodos[e.a], b = nodos[e.b];
    const largo = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    return { a, b, largo, cantidad: Math.max(2, Math.floor(largo / ESPACIO_PUNTOS)) };
  });
  const totalPuntos = tramos.reduce((s, t) => s + t.cantidad, 0);
  const geoPuntos = new THREE.BufferGeometry();
  const posPuntos = new THREE.BufferAttribute(new Float32Array(totalPuntos * 3), 3);
  posPuntos.setUsage(THREE.DynamicDrawUsage);
  geoPuntos.setAttribute("position", posPuntos);
  const matPuntos = new THREE.PointsMaterial({ size: 0.62, map: textura, transparent: true, depthWrite: false });
  const puntos = new THREE.Points(geoPuntos, matPuntos);
  puntos.frustumCulled = false;
  grupo.add(puntos);

  // Arco suave entre dos nodos (los enlaces se dibujan como en la ilustración).
  function enArco(a, b, s, largo, destino, desde) {
    destino[desde] = a.x + (b.x - a.x) * s;
    destino[desde + 1] = a.y + (b.y - a.y) * s + Math.sin(Math.PI * s) * largo * 0.07;
    destino[desde + 2] = a.z + (b.z - a.z) * s;
  }
  function moverPuntos(t) {
    const arr = posPuntos.array;
    const fase = (t * 0.55) % 1;
    let j = 0;
    for (const tr of tramos) {
      for (let k = 0; k < tr.cantidad; k++) {
        enArco(tr.a, tr.b, (k + fase) / tr.cantidad, tr.largo, arr, j);
        j += 3;
      }
    }
    posPuntos.needsUpdate = true;
  }

  // Mensajes (pulsos): un punto grande con un halo suave.
  const geoPulsos = new THREE.BufferGeometry();
  const posPulsos = new THREE.BufferAttribute(new Float32Array(MAX_PULSOS * 3), 3);
  posPulsos.setUsage(THREE.DynamicDrawUsage);
  geoPulsos.setAttribute("position", posPulsos);
  geoPulsos.setDrawRange(0, 0);
  const matPulso = new THREE.PointsMaterial({ size: 1.9, map: textura, transparent: true, depthWrite: false });
  const matHalo = new THREE.PointsMaterial({ size: 5, map: textura, transparent: true, depthWrite: false, opacity: 0.28 });
  const halo = new THREE.Points(geoPulsos, matHalo);
  const pulsosVisibles = new THREE.Points(geoPulsos, matPulso);
  halo.frustumCulled = pulsosVisibles.frustumCulled = false;
  grupo.add(halo, pulsosVisibles);

  // Ondas en el nodo que emite.
  const geoOnda = new THREE.RingGeometry(0.86, 1, 48);
  const ondas = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(geoOnda, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
    m.visible = false;
    grupo.add(m);
    return { malla: m, inicio: -10, nodo: null };
  });

  // --- Propagación de mensajes --------------------------------------------------
  const pulsos = [];
  for (let i = 0; i < MAX_PULSOS; i++) pulsos.push({ activo: false, de: null, a: null, inicio: 0, largo: 0 });
  let proximo = 1.2;
  let turno = 0;
  const cola = new Int32Array(nodos.length);
  const nivel = new Int32Array(nodos.length);

  function emitir(origen, t) {
    nivel.fill(-1);
    nivel[origen] = 0;
    let ini = 0, fin = 0;
    cola[fin++] = origen;
    while (ini < fin) {
      const i = cola[ini++];
      if (nivel[i] >= cfg.saltos + 1) continue; // el origen transmite y cada salto retransmite
      for (const v of nodos[i].vecinos) {
        if (nivel[v] !== -1) continue;
        nivel[v] = nivel[i] + 1;
        cola[fin++] = v;
        const libre = pulsos.find((p) => !p.activo);
        if (!libre) continue;
        libre.activo = true;
        libre.de = nodos[i];
        libre.a = nodos[v];
        libre.inicio = t + (nivel[i]) * DEMORA_SALTO;
        libre.largo = Math.hypot(libre.a.x - libre.de.x, libre.a.y - libre.de.y, libre.a.z - libre.de.z);
      }
    }
    const onda = ondas[turno % ondas.length];
    onda.inicio = t;
    onda.nodo = nodos[origen];
    nodos[origen].energia = 1;
    turno++;
  }

  const _v = new THREE.Vector3();
  function elegirOrigen(puntero, ancho, alto) {
    // Con el puntero cerca, emite el nodo más cercano a él; si no, se turnan.
    if (puntero && puntero.reciente) {
      let mejor = -1, mejorD = Infinity;
      for (let i = 0; i < nodos.length; i++) {
        const n = nodos[i];
        _v.set(n.x, n.y, n.z).project(camara);
        const dx = (_v.x * 0.5 + 0.5) * ancho - puntero.x;
        const dy = (-_v.y * 0.5 + 0.5) * alto - puntero.y;
        const d = dx * dx + dy * dy;
        if (d < mejorD) { mejorD = d; mejor = i; }
      }
      if (mejor >= 0 && mejorD < (ancho * 0.25) ** 2) return mejor;
    }
    return (turno * 5) % nodos.length;
  }

  function actualizar(t, dt, puntero, ancho, alto) {
    moverPuntos(t);
    if (t >= proximo) {
      emitir(elegirOrigen(puntero, ancho, alto), t);
      proximo = t + INTERVALO;
    }
    // Pulsos en vuelo
    const arr = posPulsos.array;
    let visibles = 0;
    for (const p of pulsos) {
      if (!p.activo) continue;
      const s = (t - p.inicio) / DURACION_SALTO;
      if (s < 0) continue;
      if (s >= 1) {
        p.activo = false;
        p.a.energia = 1;
        continue;
      }
      const e = s < 0.5 ? 2 * s * s : 1 - (-2 * s + 2) ** 2 / 2; // aceleración suave
      enArco(p.de, p.a, e, p.largo, arr, visibles * 3);
      visibles++;
    }
    posPulsos.needsUpdate = true;
    geoPulsos.setDrawRange(0, visibles);

    // Destello de los nodos que reciben
    let cambio = false;
    for (let i = 0; i < nodos.length; i++) {
      const n = nodos[i];
      if (n.energia <= 0) continue;
      n.energia = Math.max(0, n.energia - dt * 1.6);
      ubicarNodo(i);
      cambio = true;
    }
    if (cambio) { instNodos.instanceMatrix.needsUpdate = true; instBordes.instanceMatrix.needsUpdate = true; }

    // Ondas
    for (const o of ondas) {
      const s = (t - o.inicio) / 2.2;
      if (!o.nodo || s < 0 || s > 1) { o.malla.visible = false; continue; }
      o.malla.visible = true;
      o.malla.position.set(o.nodo.x, o.nodo.y, o.nodo.z);
      o.malla.quaternion.copy(camara.quaternion);
      o.malla.scale.setScalar(o.nodo.escala * (1.5 + s * 7));
      o.malla.material.opacity = 0.75 * (1 - s);
    }
  }

  function colorear(c) {
    matNodo.color.copy(c.nodo);
    matBorde.color.copy(c.nodoBorde);
    matMastil.color.copy(c.nodo);
    matPuntos.color.copy(c.enlace);
    matPulso.color.copy(c.pulso);
    matHalo.color.copy(c.pulso);
    for (const o of ondas) o.malla.material.color.copy(c.enlace);
  }

  // Puntos para el encuadre: la punta de cada nodo.
  const puntas = nodos.map((n) => new THREE.Vector3(n.x, n.y + n.escala * 1.45, n.z));

  return { grupo, actualizar, colorear, puntas };
}
