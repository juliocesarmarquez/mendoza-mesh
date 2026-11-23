// Mendoza Mesh: terreno de la escena 3D (valle, precordillera y cordillera).
// Todo es determinista: el mismo paisaje en cada visita, sin Math.random.
import * as THREE from "../../../vendor/three/three.min.js";

// Medidas del terreno en unidades de la escena. La cámara mira hacia -z
// (el oeste, donde está la cordillera vista desde Mendoza).
export const TERRENO = { ancho: 340, frente: 30, fondo: -70 };

const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Generador pseudoaleatorio con semilla (mulberry32).
export function aleatorio(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ruido de valores en 2D, interpolado con suavidad.
function azar2(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function ruido(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = azar2(ix, iz), b = azar2(ix + 1, iz), c = azar2(ix, iz + 1), d = azar2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, octavas) {
  let suma = 0, amp = 0.5, frec = 1, norma = 0;
  for (let i = 0; i < octavas; i++) {
    suma += amp * ruido(x * frec, z * frec);
    norma += amp;
    amp *= 0.5;
    frec *= 2.03;
  }
  return suma / norma;
}
// Ruido de crestas: aristas filosas, como una cordillera.
function crestas(x, z, octavas) {
  let suma = 0, amp = 0.5, frec = 1, norma = 0;
  for (let i = 0; i < octavas; i++) {
    const n = 1 - Math.abs(2 * ruido(x * frec + 17.3, z * frec - 9.1) - 1);
    suma += amp * n * n;
    norma += amp;
    amp *= 0.5;
    frec *= 2.07;
  }
  return suma / norma;
}

// Altura del terreno en (x, z).
export function alturaEn(x, z) {
  const d = Math.min(1, Math.max(0, (TERRENO.frente - z) / (TERRENO.frente - TERRENO.fondo)));
  // Tres franjas, de adelante hacia atrás: valle llano con parcelas y viñedos,
  // precordillera y cordillera.
  const valle = 0.4 * fbm(x * 0.07, z * 0.07, 3);
  const lomas = suave(0.26, 0.5, d) * 6 * fbm(x * 0.045 + 31, z * 0.05, 3);
  const montes = suave(0.45, 0.78, d) * 21 * crestas(x * 0.026, z * 0.038, 4);
  // Un pico más alto que el resto, como el Aconcagua en el horizonte.
  const pico = suave(0.5, 0.78, d) * 10 * Math.exp(-((x - 16) ** 2 + (z + 50) ** 2) / 110);
  return valle + lomas + montes + pico;
}

// Crea la malla del terreno: facetada (low poly) y con colores por vértice.
export function crearTerreno(segX, segZ, ancho = TERRENO.ancho) {
  const profundidad = TERRENO.frente - TERRENO.fondo;
  const plano = new THREE.PlaneGeometry(ancho, profundidad, segX, segZ);
  plano.rotateX(-Math.PI / 2);
  plano.translate(0, 0, (TERRENO.frente + TERRENO.fondo) / 2);
  const pos = plano.attributes.position;
  // Pequeño desorden horizontal para que la grilla no se note.
  const azar = aleatorio(1810);
  const celdaX = ancho / segX, celdaZ = profundidad / segZ;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (azar() - 0.5) * celdaX * 0.45;
    const z = pos.getZ(i) + (azar() - 0.5) * celdaZ * 0.45;
    pos.setXYZ(i, x, alturaEn(x, z), z);
  }
  // Puntos de la grilla (sin repetir): sirven para encuadrar la cámara.
  const grilla = Float32Array.from(pos.array);
  const geometria = plano.toNonIndexed();
  plano.dispose();
  geometria.computeVertexNormals();
  geometria.setAttribute("color", new THREE.BufferAttribute(new Float32Array(geometria.attributes.position.count * 3), 3));
  const material = new THREE.MeshBasicMaterial({ vertexColors: true });
  const malla = new THREE.Mesh(geometria, material);
  malla.matrixAutoUpdate = false;
  malla.updateMatrix();
  return { malla, grilla };
}

// Pinta el terreno con los colores del tema: por altura, con sombreado plano
// calculado una sola vez (luz desde arriba y a la derecha).
const LUZ = new THREE.Vector3(0.55, 0.75, 0.35).normalize();
const _n = new THREE.Vector3();
const _a = new THREE.Color();
const _b = new THREE.Color();
export function colorearTerreno(malla, c, oscuro) {
  const pos = malla.geometry.attributes.position;
  const nor = malla.geometry.attributes.normal;
  const col = malla.geometry.attributes.color;
  const ambiente = oscuro ? 0.62 : 0.74;
  const difusa = oscuro ? 0.5 : 0.36;
  for (let i = 0; i < pos.count; i += 3) {
    // Un color por triángulo, según la altura de su centro.
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    if (y < 1.1) {
      // Valle: parcelas de tierra y viñedo.
      _a.copy(fbm(x * 0.18, z * 0.18, 2) > 0.52 ? c.vinedoClaro : c.tierra);
    } else if (y < 4.5) {
      _a.copy(c.cerroCerca).lerp(c.cerroMedio, suave(1.1, 4.5, y) * 0.35);
    } else if (y < 11) {
      _a.copy(c.cerroMedio).lerp(c.cerroLejano, suave(4.5, 11, y) * 0.5);
    } else {
      _a.copy(c.cerroLejano);
    }
    // Nieve en las cumbres, con borde irregular.
    if (y > 15.5 + fbm(x * 0.3, z * 0.3, 2) * 3) _a.copy(c.nieve);
    _n.set(nor.getX(i), nor.getY(i), nor.getZ(i));
    const luz = ambiente + difusa * Math.max(0, _n.dot(LUZ));
    _b.copy(_a).multiplyScalar(luz);
    for (let k = 0; k < 3; k++) col.setXYZ(i + k, _b.r, _b.g, _b.b);
  }
  col.needsUpdate = true;
}

// Hileras de viñedo en el valle: segmentos cortos que siguen el terreno.
export function crearVinedo() {
  const puntos = [];
  const colores = [];
  for (let fila = 0; fila < 9; fila++) {
    const z = 13 - fila * 1.3;
    const largo = 1.5, hueco = 0.8;
    for (let x = -70 + (fila % 2) * 0.9; x < 70; x += largo + hueco) {
      puntos.push(x, alturaEn(x, z) + 0.35, z, x + largo, alturaEn(x + largo, z) + 0.35, z);
      colores.push(fila % 2, 0, 0, fila % 2, 0, 0); // se reemplaza al colorear
    }
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(new Float32Array(puntos), 3));
  geometria.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colores), 3));
  const hileras = new THREE.LineSegments(geometria, new THREE.LineBasicMaterial({ vertexColors: true }));
  hileras.matrixAutoUpdate = false;
  hileras.updateMatrix();
  return hileras;
}
export function colorearVinedo(hileras, c) {
  const col = hileras.geometry.attributes.color;
  const pos = hileras.geometry.attributes.position;
  for (let i = 0; i < col.count; i++) {
    const fila = Math.round((13 - pos.getZ(i)) / 1.3);
    const color = fila % 2 ? c.vinedoClaro : c.vinedoOscuro;
    col.setXYZ(i, color.r, color.g, color.b);
  }
  col.needsUpdate = true;
}
