/* Mendoza Mesh: mejoras de la interfaz (se carga con defer en todas las páginas).
   Todo es mejora progresiva: sin JavaScript el sitio se ve y funciona completo.
   - Cabecera con sombra al hacer scroll.
   - Índice «En esta página» que marca la sección que estás leyendo.
   - Aparición suave de los bloques al hacer scroll (solo si no pediste reducir
     el movimiento).
   - Carga diferida de la escena 3D (assets/js/escena/escena.js). */
(function () {
  "use strict";

  var consultaMovimiento = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reducirMovimiento() { return !!(consultaMovimiento && consultaMovimiento.matches); }

  /* Agrupa los eventos de scroll en un solo cálculo por cuadro. */
  var tareasScroll = [];
  var pendiente = false;
  function alScroll(tarea) {
    tareasScroll.push(tarea);
    tarea();
  }
  window.addEventListener("scroll", function () {
    if (pendiente) return;
    pendiente = true;
    window.requestAnimationFrame(function () {
      pendiente = false;
      for (var i = 0; i < tareasScroll.length; i++) tareasScroll[i]();
    });
  }, { passive: true });

  /* --- Cabecera elevada -------------------------------------------------------- */
  var cabecera = document.querySelector(".cabecera");
  if (cabecera) {
    var elevada = null;
    alScroll(function () {
      var ahora = window.pageYOffset > 8;
      if (ahora !== elevada) {
        elevada = ahora;
        cabecera.classList.toggle("cabecera--elevada", ahora);
      }
    });
  }

  /* --- Índice con la sección actual -------------------------------------------- */
  var indice = document.querySelector(".indice-pagina");
  if (indice) {
    var enlaces = indice.querySelectorAll('a[href^="#"]');
    var secciones = [];
    for (var i = 0; i < enlaces.length; i++) {
      var destino = document.getElementById(enlaces[i].getAttribute("href").slice(1));
      if (destino) secciones.push({ enlace: enlaces[i], destino: destino });
    }
    var actual = null;
    if (secciones.length) {
      alScroll(function () {
        var limite = (cabecera ? cabecera.offsetHeight : 0) + window.innerHeight * 0.3;
        var elegido = null;
        for (var i = 0; i < secciones.length; i++) {
          if (secciones[i].destino.getBoundingClientRect().top <= limite) elegido = secciones[i];
        }
        // Al llegar al final de la página se marca la última sección.
        if (window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 2) {
          elegido = secciones[secciones.length - 1];
        }
        if (elegido === actual) return;
        if (actual) actual.enlace.removeAttribute("aria-current");
        if (elegido) elegido.enlace.setAttribute("aria-current", "location");
        actual = elegido;
      });
    }
  }

  /* --- Escena 3D ------------------------------------------------------------------
     Se pide solo si: hay un contenedor [data-escena], no se pidió reducir el
     movimiento, el navegador soporta módulos y WebGL 2, no está activado el ahorro
     de datos y (en las cabeceras internas) la pantalla es ancha. Espera a que la
     página termine de cargar, a un momento libre y a que el contenedor se vea:
     así no compite con el texto ni con las tipografías. */
  var RUTA_ESCENA = "assets/js/escena/escena.js";
  var contenedorEscena = document.querySelector("[data-escena]");
  var ahorroDatos = !!(navigator.connection && navigator.connection.saveData);
  var soportaModulos = "noModule" in document.createElement("script");
  var anchaSiCabecera = !contenedorEscena || contenedorEscena.getAttribute("data-escena") !== "cabecera" ||
    (window.matchMedia && window.matchMedia("(min-width: 40rem)").matches);
  if (contenedorEscena && !reducirMovimiento() && soportaModulos && typeof window.WebGL2RenderingContext !== "undefined" &&
      !ahorroDatos && anchaSiCabecera) {
    var cargarEscena = function () {
      var script = document.createElement("script");
      script.type = "module";
      script.src = RUTA_ESCENA;
      document.head.appendChild(script);
    };
    var cuandoSeVea = function () {
      if (!("IntersectionObserver" in window)) { cargarEscena(); return; }
      var vigia = new IntersectionObserver(function (entradas) {
        if (!entradas[entradas.length - 1].isIntersecting) return;
        vigia.disconnect();
        cargarEscena();
      }, { rootMargin: "200px 0px" });
      vigia.observe(contenedorEscena);
    };
    var enUnMomentoLibre = function () {
      if ("requestIdleCallback" in window) window.requestIdleCallback(cuandoSeVea, { timeout: 2000 });
      else window.setTimeout(cuandoSeVea, 300);
    };
    if (document.readyState === "complete") enUnMomentoLibre();
    else window.addEventListener("load", enUnMomentoLibre);
  }

  /* --- Aparición al hacer scroll ------------------------------------------------ */
  var SELECTOR_REVELAR = [
    ".seccion__encabezado", ".tarjeta", ".ruta > li", ".usos > li", ".nota-campo", ".aviso",
    ".evento", ".pasos > li", ".faq details", ".para-saber-mas", ".diagrama", ".lab-bloque",
    ".paginador", ".tabla-caja", ".glosario__grupo", ".contacto__lateral > *"
  ].join(", ");

  if (!reducirMovimiento() && "IntersectionObserver" in window) {
    var altoVentana = window.innerHeight;
    var candidatos = document.querySelectorAll(SELECTOR_REVELAR);
    var observados = [];
    for (var k = 0; k < candidatos.length; k++) {
      var el = candidatos[k];
      // Solo lo que todavía no se ve (así no parpadea lo que ya está en pantalla)
      // y sin anidar animaciones (un aviso dentro de un paso, por ejemplo).
      if (el.getBoundingClientRect().top < altoVentana * 0.95) continue;
      if (el.parentElement && el.parentElement.closest(SELECTOR_REVELAR)) continue;
      el.classList.add("revelar");
      observados.push(el);
    }
    var observador = new IntersectionObserver(function (entradas) {
      var lote = 0;
      for (var i = 0; i < entradas.length; i++) {
        var e = entradas[i];
        if (!e.isIntersecting) continue;
        e.target.style.setProperty("--retraso", Math.min(lote, 5) * 80 + "ms");
        e.target.classList.add("revelado");
        observador.unobserve(e.target);
        lote++;
      }
    }, { rootMargin: "0px 0px -6% 0px" });
    for (var m = 0; m < observados.length; m++) observador.observe(observados[m]);

    // Si la persona activa «reducir movimiento» mientras navega, se muestra todo.
    if (consultaMovimiento && consultaMovimiento.addEventListener) {
      consultaMovimiento.addEventListener("change", function () {
        if (!reducirMovimiento()) return;
        for (var n = 0; n < observados.length; n++) observados[n].classList.add("revelado");
        observador.disconnect();
      });
    }
  }
})();
