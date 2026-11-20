/* Mendoza Mesh: buscador del glosario.
   Sin JavaScript, el glosario completo se ve igual y el buscador queda oculto.
   La búsqueda ignora mayúsculas y tildes («linea» encuentra «Línea de vista»). */
(function () {
  "use strict";
  var caja = document.getElementById("buscador-glosario");
  var campo = document.getElementById("buscar-termino");
  var estado = document.getElementById("estado-busqueda");
  var lista = document.getElementById("lista-glosario");
  var vacio = document.getElementById("sin-resultados");
  var indice = document.querySelector(".indice-letras");
  if (!caja || !campo || !lista) return;

  function normalizar(texto) {
    return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  }

  var terminos = Array.prototype.map.call(lista.querySelectorAll(".termino"), function (el) {
    var dt = el.querySelector("dt");
    return {
      el: el,
      nombre: normalizar(dt.textContent),
      texto: normalizar(el.textContent)
    };
  });
  var grupos = lista.querySelectorAll(".glosario__grupo");
  var total = terminos.length;
  var temporizador = null;

  function filtrar() {
    var consulta = normalizar(campo.value);
    var visibles = 0;
    terminos.forEach(function (t) {
      // Primero coincide el nombre; si no, cualquier parte de la definición.
      var coincide = !consulta || t.nombre.indexOf(consulta) !== -1 || t.texto.indexOf(consulta) !== -1;
      t.el.hidden = !coincide;
      if (coincide) visibles++;
    });
    Array.prototype.forEach.call(grupos, function (g) {
      g.hidden = !g.querySelector(".termino:not([hidden])");
    });
    if (vacio) vacio.hidden = visibles !== 0;
    if (indice) indice.hidden = Boolean(consulta);

    clearTimeout(temporizador);
    // Se anuncia con una pequeña demora para no interrumpir mientras se escribe.
    temporizador = setTimeout(function () {
      if (!consulta) estado.textContent = "";
      else if (visibles === 0) estado.textContent = "No se encontró ningún término.";
      else if (visibles === 1) estado.textContent = "Se encontró 1 término de " + total + ".";
      else estado.textContent = "Se encontraron " + visibles + " términos de " + total + ".";
    }, 350);
  }

  caja.hidden = false;
  campo.addEventListener("input", filtrar);
  campo.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && campo.value) {
      campo.value = "";
      filtrar();
    }
  });

  // Si se llega desde un enlace a un término (#sf, por ejemplo), quitar el filtro.
  window.addEventListener("hashchange", function () {
    if (campo.value) {
      campo.value = "";
      filtrar();
      var destino = document.getElementById(location.hash.slice(1));
      if (destino) destino.scrollIntoView();
    }
  });
})();
