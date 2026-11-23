// Mendoza Mesh: escena 3D decorativa (cordillera low poly con una malla de nodos).
//
// La carga assets/js/interfaz.js, solo si el navegador soporta módulos y WebGL 2,
// si no pediste reducir el movimiento y cuando el contenedor está a la vista.
// Mientras tanto (y si algo falla) se ve la ilustración de respaldo.
// Sigue las prácticas de three.js r186: setAnimationLoop, Timer, sin crear
// objetos dentro del bucle, una sola llamada de dibujo por tipo de objeto.
import * as THREE from "../../../vendor/three/three.min.js";
import { crearTerreno, colorearTerreno, crearVinedo, colorearVinedo, aleatorio } from "./terreno.js";
import { crearMalla } from "./malla.js";

const PRESETS = {
  portada: { ancho: 360, segX: 84, segZ: 28, nodos: 14, saltos: 3, estrellas: 180, dpr: 2, fps: 60, puntero: true, scroll: true, vinedo: true },
  movil: { ancho: 300, segX: 52, segZ: 18, nodos: 9, saltos: 3, estrellas: 100, dpr: 1.5, fps: 30, puntero: false, scroll: true, vinedo: true },
  cabecera: { ancho: 620, segX: 76, segZ: 14, nodos: 7, saltos: 2, estrellas: 60, dpr: 1.5, fps: 30, puntero: false, scroll: false, vinedo: false },
};

const raiz = document.documentElement;
// Cede el hilo principal entre etapas: la página sigue respondiendo mientras arranca la escena.
const ceder = () => new Promise((listo) => setTimeout(listo, 0));
const consultaReducir = window.matchMedia("(prefers-reduced-motion: reduce)");

function leerColores() {
  const estilo = getComputedStyle(raiz);
  const c = (nombre) => new THREE.Color(estilo.getPropertyValue(nombre).trim() || "#888888");
  return {
    cielo: c("--cielo-bajo"),
    tierra: c("--tierra"),
    vinedoClaro: c("--vinedo-claro"),
    vinedoOscuro: c("--vinedo-oscuro"),
    cerroCerca: c("--cerro-cerca"),
    cerroMedio: c("--cerro-medio"),
    cerroLejano: c("--cerro-lejano"),
    nieve: c("--nieve"),
    nodo: c("--nodo"),
    nodoBorde: c("--nodo-borde"),
    enlace: c("--enlace-radio"),
    pulso: c("--ocre-fondo"),
    astro: c("--astro"),
  };
}

function temaOscuro() {
  const tema = window.MendozaMesh && window.MendozaMesh.tema;
  if (tema) return tema.efectivo() === "oscuro";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

async function iniciar(contenedor) {
  const tipo = contenedor.dataset.escena;
  const angosto = window.matchMedia("(pointer: coarse), (max-width: 40rem)").matches;
  const cfg = tipo === "cabecera" ? PRESETS.cabecera : angosto ? PRESETS.movil : PRESETS.portada;

  const lienzo = document.createElement("canvas");
  lienzo.className = "escena__lienzo";
  lienzo.setAttribute("aria-hidden", "true");
  contenedor.appendChild(lienzo);

  // Se pide el contexto WebGL 2 antes de crear el renderer: si no hay, se sale
  // en silencio y queda la ilustración de respaldo.
  const atributos = {
    alpha: true, // deja ver el cielo, que es un degradé de CSS
    antialias: (window.devicePixelRatio || 1) < 2,
    powerPreference: "low-power",
    depth: true,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  };
  const contexto = lienzo.getContext("webgl2", atributos);
  if (!contexto) {
    lienzo.remove();
    throw new Error("WebGL 2 no está disponible");
  }
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, context: contexto, ...atributos });
  await ceder();
  renderer.setClearColor(0x000000, 0);
  const pixeles = Math.min(window.devicePixelRatio || 1, cfg.dpr);
  renderer.setPixelRatio(pixeles);

  const escena = new THREE.Scene();
  escena.fog = new THREE.Fog(0xffffff, 62, 185);
  const camara = new THREE.PerspectiveCamera(32, 2, 0.5, 420);
  const base = new THREE.Vector3(0, 15, 56);
  const mira = new THREE.Vector3(0, 6, -30);
  let miraBaseY = 6;
  let objetivo = 0.32;

  // --- Contenido --------------------------------------------------------------
  const { malla: terreno, grilla } = crearTerreno(cfg.segX, cfg.segZ, cfg.ancho);
  escena.add(terreno);
  const vinedo = cfg.vinedo ? crearVinedo() : null;
  if (vinedo) escena.add(vinedo);

  // Sol (o luna) que se esconde detrás de la cordillera, como al atardecer en Mendoza.
  const disco = new THREE.CircleGeometry(1, 56);
  const matAstro = new THREE.MeshBasicMaterial({ fog: false });
  const matResplandor = new THREE.MeshBasicMaterial({ fog: false, transparent: true, opacity: 0.16, depthWrite: false });
  const astro = new THREE.Mesh(disco, matAstro);
  const resplandor = new THREE.Mesh(disco, matResplandor);
  astro.renderOrder = resplandor.renderOrder = -1;
  escena.add(resplandor, astro);

  // Estrellas (solo en modo oscuro)
  const geoEstrellas = new THREE.BufferGeometry();
  geoEstrellas.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cfg.estrellas * 3), 3));
  const matEstrellas = new THREE.PointsMaterial({ size: 1.7 * pixeles, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7, depthWrite: false });
  const estrellas = new THREE.Points(geoEstrellas, matEstrellas);
  estrellas.frustumCulled = false;
  estrellas.renderOrder = -2;
  escena.add(estrellas);

  let malla = null;
  let aspectoMalla = 0;

  // --- Encuadre: el texto de la página queda siempre sobre el cielo ------------
  const _p = new THREE.Vector3();
  const _q = new THREE.Vector3();
  function techo() {
    camara.updateMatrixWorld();
    let max = -Infinity;
    const revisar = () => {
      _p.project(camara);
      if (_p.z < 1 && _p.x > -1.25 && _p.x < 1.25 && _p.y > max) max = _p.y;
    };
    for (let i = 0; i < grilla.length; i += 3) {
      _p.set(grilla[i], grilla[i + 1], grilla[i + 2]);
      revisar();
    }
    if (malla) for (const punta of malla.puntas) { _p.copy(punta); revisar(); }
    return (1 - max) / 2; // fracción de la altura del lienzo, desde arriba
  }

  function calcularObjetivo() {
    const referencia = tipo === "portada"
      ? contenedor.parentElement.querySelector(".portada__rejilla")
      : contenedor.parentElement.querySelector(".banda-pagina__texto");
    if (!referencia) return 0.32;
    const rLienzo = lienzo.getBoundingClientRect();
    const rTexto = referencia.getBoundingClientRect();
    const margen = 16;
    return Math.min(0.62, Math.max(0.22, (rTexto.bottom - rLienzo.top + margen) / rLienzo.height));
  }

  function encuadrar() {
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    objetivo = calcularObjetivo();
    camara.position.copy(base);
    // Búsqueda binaria: a qué altura mira la cámara para que la cumbre más alta
    // quede justo debajo del texto.
    let bajo = -40, alto_ = 40;
    for (let i = 0; i < 18; i++) {
      const medio = (bajo + alto_) / 2;
      mira.set(0, medio, -30);
      camara.lookAt(mira);
      if (techo() < objetivo) bajo = medio;
      else alto_ = medio;
    }
    miraBaseY = alto_;
    mira.set(0, miraBaseY, -30);
    camara.lookAt(mira);
    camara.updateMatrixWorld();
    ubicarCielo();
  }

  function direccionEnPantalla(x, y, distancia, destino) {
    destino.set(x, y, 0.5).unproject(camara).sub(camara.position).normalize();
    return destino.multiplyScalar(distancia).add(camara.position);
  }

  // Rectángulos (en coordenadas de pantalla normalizadas) del texto sobre el lienzo.
  function zonasOcupadas() {
    const selector = tipo === "portada" ? ".portada__texto > *, .pantalla" : ".banda-pagina__texto > *";
    const rL = lienzo.getBoundingClientRect();
    const margen = 18;
    const zonas = [];
    for (const el of contenedor.parentElement.querySelectorAll(selector)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      zonas.push([
        ((r.left - margen - rL.left) / rL.width) * 2 - 1,
        1 - ((r.bottom + margen - rL.top) / rL.height) * 2,
        ((r.right + margen - rL.left) / rL.width) * 2 - 1,
        1 - ((r.top - margen - rL.top) / rL.height) * 2,
      ]);
    }
    return zonas;
  }

  function ubicarCielo() {
    const horizonte = 1 - 2 * objetivo; // y (NDC) de la cumbre más alta
    direccionEnPantalla(0.56, horizonte - 0.16, 300, astro.position);
    resplandor.position.copy(astro.position);
    const radio = 300 * Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)) * 0.2;
    astro.scale.setScalar(radio);
    resplandor.scale.setScalar(radio * 1.9);
    astro.lookAt(camara.position);
    resplandor.lookAt(camara.position);
    // Las estrellas evitan el texto y la ilustración del equipo, para no
    // ensuciar la lectura: las que caerían encima se descartan.
    const ocupadas = zonasOcupadas();
    const azar = aleatorio(4653);
    const arr = geoEstrellas.attributes.position.array;
    let puestas = 0;
    for (let intento = 0; intento < cfg.estrellas * 6 && puestas < cfg.estrellas; intento++) {
      const x = azar() * 2.4 - 1.2, y = horizonte - 0.1 + azar() * (1.1 - horizonte);
      if (ocupadas.some((z) => x > z[0] && x < z[2] && y > z[1] && y < z[3])) continue;
      direccionEnPantalla(x, y, 360, _q);
      arr[puestas * 3] = _q.x;
      arr[puestas * 3 + 1] = _q.y;
      arr[puestas * 3 + 2] = _q.z;
      puestas++;
    }
    geoEstrellas.setDrawRange(0, puestas);
    geoEstrellas.attributes.position.needsUpdate = true;
  }

  function construirMalla() {
    if (malla) {
      escena.remove(malla.grupo);
      liberar(malla.grupo);
    }
    const mitad = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)) * camara.aspect;
    malla = crearMalla(cfg, (z) => (base.z - z) * mitad, camara);
    aspectoMalla = camara.aspect;
    escena.add(malla.grupo);
    if (colores) malla.colorear(colores);
  }

  // --- Colores del tema ------------------------------------------------------------
  let colores = null;
  function aplicarColores() {
    colores = leerColores();
    const oscuro = temaOscuro();
    escena.fog.color.copy(colores.cielo);
    colorearTerreno(terreno, colores, oscuro);
    if (vinedo) colorearVinedo(vinedo, colores);
    if (malla) malla.colorear(colores);
    matAstro.color.copy(colores.astro);
    matResplandor.color.copy(colores.astro);
    matEstrellas.color.copy(colores.astro);
    estrellas.visible = oscuro;
    if (!enMarcha && !destruida) renderer.render(escena, camara);
  }

  await ceder();

  // --- Tamaño ---------------------------------------------------------------------
  let ancho = lienzo.clientWidth || 1;
  let alto = lienzo.clientHeight || 1;
  renderer.setSize(ancho, alto, false);
  encuadrar();
  construirMalla();
  encuadrar(); // otra vez, ahora contando la punta de los nodos

  const observadorTamano = new ResizeObserver(() => {
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    if (!w || !h || (w === ancho && h === alto)) return;
    ancho = w;
    alto = h;
    renderer.setSize(w, h, false);
    encuadrar();
    if (Math.abs(camara.aspect / aspectoMalla - 1) > 0.2) {
      construirMalla();
      encuadrar();
    }
    if (!enMarcha) renderer.render(escena, camara);
  });
  observadorTamano.observe(lienzo);

  // --- Puntero y scroll ------------------------------------------------------------
  const puntero = { nx: 0, ny: 0, x: 0, y: 0, reciente: false, ultimo: -10 };
  let progreso = 0;
  function alMoverPuntero(e) {
    if (e.pointerType === "touch") return;
    puntero.nx = (e.clientX / window.innerWidth) * 2 - 1;
    puntero.ny = (e.clientY / window.innerHeight) * 2 - 1;
    const r = lienzo.getBoundingClientRect();
    puntero.x = e.clientX - r.left;
    puntero.y = e.clientY - r.top;
    const rc = contenedor.getBoundingClientRect();
    if (e.clientY >= rc.top && e.clientY <= rc.bottom) puntero.ultimo = tiempo;
  }
  function alHacerScroll() {
    const r = contenedor.getBoundingClientRect();
    progreso = Math.min(1, Math.max(0, -r.top / r.height));
  }
  if (cfg.puntero) window.addEventListener("pointermove", alMoverPuntero, { passive: true });
  if (cfg.scroll) {
    window.addEventListener("scroll", alHacerScroll, { passive: true });
    alHacerScroll();
  }

  // --- Bucle ------------------------------------------------------------------------
  const timer = new THREE.Timer();
  timer.connect(document); // congela el tiempo mientras la pestaña está oculta
  const paso = 1 / cfg.fps;
  const suavizado = { x: 0, y: 0 };
  let acumulado = 0;
  let tiempo = 0;

  function animar() {
    timer.update();
    acumulado += Math.min(timer.getDelta(), 0.1);
    if (acumulado < paso * 0.9) return; // limita los cuadros por segundo en equipos modestos
    const dt = Math.min(acumulado, 0.1);
    acumulado = 0;
    tiempo += dt;

    // La cámara sigue al puntero con suavidad (o se balancea sola) y, al bajar
    // por la página, sube un poco y mira hacia el valle: un «sobrevuelo».
    // Solo sube: así la cordillera nunca tapa el texto.
    const objetivoX = cfg.puntero ? puntero.nx : Math.sin(tiempo * 0.12) * 0.7;
    const objetivoY = cfg.puntero ? Math.max(0, puntero.ny) : 0;
    const k = 1 - Math.exp(-dt * 2.2);
    suavizado.x += (objetivoX - suavizado.x) * k;
    suavizado.y += (objetivoY - suavizado.y) * k;
    camara.position.set(base.x + suavizado.x * 3.4, base.y + suavizado.y * 1.4 + progreso * 5, base.z);
    mira.set(suavizado.x * 1.2, miraBaseY - progreso * 2.5, -30);
    camara.lookAt(mira);

    puntero.reciente = tiempo - puntero.ultimo < 4;
    malla.actualizar(tiempo, dt, puntero, ancho, alto);
    renderer.render(escena, camara);
  }

  // Solo anima cuando se ve: fuera de pantalla o con la pestaña oculta, se detiene.
  let visible = true;
  let enMarcha = false;
  let destruida = false;
  function revisarBucle() {
    const debe = visible && !document.hidden && !destruida;
    if (debe === enMarcha) return;
    enMarcha = debe;
    renderer.setAnimationLoop(debe ? animar : null);
  }
  const observadorVista = new IntersectionObserver((entradas) => {
    visible = entradas[entradas.length - 1].isIntersecting;
    revisarBucle();
  });

  // --- Limpieza ------------------------------------------------------------------------
  function liberar(objeto) {
    objeto.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const materiales = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of materiales) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
      if (o.isInstancedMesh) o.dispose();
    });
  }
  function alCambiarMovimiento() { if (consultaReducir.matches) destruir(); }
  function destruir() {
    if (destruida) return;
    destruida = true;
    renderer.setAnimationLoop(null);
    enMarcha = false;
    observadorTamano.disconnect();
    observadorVista.disconnect();
    window.removeEventListener("pointermove", alMoverPuntero);
    window.removeEventListener("scroll", alHacerScroll);
    document.removeEventListener("visibilitychange", revisarBucle);
    document.removeEventListener("mm:tema", aplicarColores);
    consultaReducir.removeEventListener("change", alCambiarMovimiento);
    timer.dispose();
    contenedor.classList.remove("escena-lista"); // vuelve la ilustración de respaldo
    liberar(escena);
    renderer.dispose();
    lienzo.remove();
  }

  lienzo.addEventListener("webglcontextlost", destruir);
  consultaReducir.addEventListener("change", alCambiarMovimiento);
  document.addEventListener("mm:tema", aplicarColores);
  document.addEventListener("visibilitychange", revisarBucle);

  // --- Primer cuadro ---------------------------------------------------------------------
  aplicarColores();
  await renderer.compileAsync(escena, camara); // compila los shaders sin trabar la página
  if (consultaReducir.matches) destruir(); // por si se pidió reducir el movimiento mientras cargaba
  if (destruida) return;
  malla.actualizar(0, 0, puntero, ancho, alto);
  renderer.render(escena, camara);
  observadorVista.observe(contenedor);
  window.requestAnimationFrame(() => {
    if (!destruida) contenedor.classList.add("escena-lista");
  });
}

for (const contenedor of document.querySelectorAll("[data-escena]")) {
  if (contenedor.dataset.escenaIniciada) continue;
  contenedor.dataset.escenaIniciada = "si";
  iniciar(contenedor).catch((error) => {
    // Sin WebGL o con un error: queda la ilustración de respaldo.
    contenedor.classList.remove("escena-lista");
    const lienzo = contenedor.querySelector(".escena__lienzo");
    if (lienzo) lienzo.remove();
    console.info("Mendoza Mesh: la escena 3D no está disponible.", error && error.message);
  });
}
