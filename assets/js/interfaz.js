/* Mendoza Mesh: mejoras de la interfaz (se carga con defer en todas las páginas).
   Todo es mejora progresiva: sin JavaScript el sitio se ve y funciona completo.
   - Cabecera con sombra al hacer scroll.
   - Índice «En esta página» que marca la sección que estás leyendo.
   - Aparición suave de los bloques al hacer scroll (solo si no pediste reducir
     el movimiento). */
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
