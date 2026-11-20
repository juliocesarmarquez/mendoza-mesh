/* Mendoza Mesh: tema claro/oscuro.
   Se carga en <head> (sin defer) para aplicar el tema antes de pintar y
   evitar el parpadeo. Respeta la preferencia del sistema hasta que la
   persona elige un tema con el botón; esa elección se recuerda en este
   navegador (si el almacenamiento está disponible). */
(function () {
  "use strict";
  var CLAVE = "mm-tema";
  var raiz = document.documentElement;
  raiz.classList.add("js");

  var guardado = null;
  try { guardado = window.localStorage.getItem(CLAVE); } catch (e) { /* almacenamiento bloqueado */ }
  if (guardado === "claro" || guardado === "oscuro") {
    raiz.setAttribute("data-tema", guardado);
  }

  var consulta = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function temaEfectivo() {
    var elegido = raiz.getAttribute("data-tema");
    if (elegido) return elegido;
    return consulta && consulta.matches ? "oscuro" : "claro";
  }

  function sincronizar() {
    var oscuro = temaEfectivo() === "oscuro";
    var botones = document.querySelectorAll('[data-accion="tema"]');
    for (var i = 0; i < botones.length; i++) {
      botones[i].setAttribute("aria-pressed", oscuro ? "true" : "false");
    }
    try {
      document.dispatchEvent(new CustomEvent("mm:tema", { detail: { tema: temaEfectivo() } }));
    } catch (e) { /* navegadores muy antiguos */ }
  }

  function fijar(tema) {
    raiz.setAttribute("data-tema", tema);
    try { window.localStorage.setItem(CLAVE, tema); } catch (e) { /* sin persistencia */ }
    sincronizar();
  }

  // API mínima para otras páginas (por ejemplo, los ajustes del mapa).
  window.MendozaMesh = window.MendozaMesh || {};
  window.MendozaMesh.tema = { efectivo: temaEfectivo, fijar: fijar };

  document.addEventListener("DOMContentLoaded", function () {
    var botones = document.querySelectorAll('[data-accion="tema"]');
    for (var i = 0; i < botones.length; i++) {
      botones[i].hidden = false;
      botones[i].addEventListener("click", function () {
        fijar(temaEfectivo() === "oscuro" ? "claro" : "oscuro");
      });
    }
    sincronizar();
  });

  if (consulta) {
    var alCambiar = function () { if (!raiz.getAttribute("data-tema")) sincronizar(); };
    if (consulta.addEventListener) consulta.addEventListener("change", alCambiar);
    else if (consulta.addListener) consulta.addListener(alCambiar);
  }
})();
