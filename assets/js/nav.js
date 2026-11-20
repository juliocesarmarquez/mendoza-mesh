/* Mendoza Mesh: menú desplegable accesible para pantallas angostas.
   Sin JavaScript, la navegación se muestra siempre (ver base.css). */
(function () {
  "use strict";
  var boton = document.querySelector(".boton-menu");
  var nav = document.getElementById("nav-principal");
  if (!boton || !nav) return;

  boton.hidden = false;

  function estaAbierto() { return boton.getAttribute("aria-expanded") === "true"; }

  function alternar(abrir) {
    boton.setAttribute("aria-expanded", abrir ? "true" : "false");
    nav.classList.toggle("abierto", abrir);
  }

  boton.addEventListener("click", function () { alternar(!estaAbierto()); });

  // Esc cierra el menú y devuelve el foco al botón.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && estaAbierto()) {
      alternar(false);
      boton.focus();
    }
  });

  // Clic fuera del menú lo cierra.
  document.addEventListener("click", function (e) {
    if (estaAbierto() && !nav.contains(e.target) && !boton.contains(e.target)) alternar(false);
  });

  // Al pasar a pantalla ancha, el menú vuelve a su estado normal.
  if (window.matchMedia) {
    var ancho = window.matchMedia("(min-width: 76rem)");
    var alCambiar = function (ev) { if (ev.matches) alternar(false); };
    if (ancho.addEventListener) ancho.addEventListener("change", alCambiar);
    else if (ancho.addListener) ancho.addListener(alCambiar);
  }
})();
