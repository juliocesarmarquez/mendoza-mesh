/* Mendoza Mesh: quiz de la malla.
   Cada pregunta es un <fieldset data-correcta="valor">; la explicación está en
   el HTML y se muestra al responder. Sin JavaScript, el quiz se puede leer igual. */
(function () {
  "use strict";
  var quiz = document.getElementById("quiz");
  if (!quiz) return;
  var preguntas = Array.prototype.slice.call(quiz.querySelectorAll("fieldset[data-correcta]"));
  var puntaje = document.getElementById("quiz-puntaje");
  var otraVez = document.getElementById("quiz-reiniciar");
  var respondidas = {};

  preguntas.forEach(function (p, i) {
    var boton = p.querySelector(".quiz-comprobar");
    var aviso = p.querySelector(".quiz-respuesta");
    boton.hidden = false;
    boton.addEventListener("click", function () {
      var elegida = p.querySelector("input:checked");
      if (!elegida) {
        aviso.className = "quiz-respuesta";
        aviso.textContent = "Elegí una opción antes de comprobar.";
        return;
      }
      var bien = elegida.value === p.getAttribute("data-correcta");
      respondidas[i] = bien;
      aviso.className = "quiz-respuesta quiz-respuesta--" + (bien ? "bien" : "mal");
      aviso.innerHTML = "<strong>" + (bien ? "¡Correcto!" : "No es esa.") + "</strong> " + p.querySelector(".quiz-explicacion").innerHTML;
      p.querySelectorAll("input").forEach(function (r) { r.disabled = true; });
      boton.disabled = true;
      p.querySelectorAll("label").forEach(function (l) {
        var r = l.querySelector("input");
        if (r.value === p.getAttribute("data-correcta")) l.classList.add("quiz-opcion--correcta");
        else if (r === elegida) l.classList.add("quiz-opcion--elegida");
      });
      actualizarPuntaje();
    });
  });

  function actualizarPuntaje() {
    var total = Object.keys(respondidas).length;
    var bien = Object.keys(respondidas).filter(function (k) { return respondidas[k]; }).length;
    if (total < preguntas.length) {
      puntaje.textContent = "Llevás " + bien + " de " + total + " respuestas correctas. Faltan " + (preguntas.length - total) + ".";
      return;
    }
    var mensaje = bien === preguntas.length ? "¡Perfecto! Ya entendés cómo funciona la malla."
      : bien >= 3 ? "¡Bien! Repasá las que fallaste en Meshtastic y la malla."
      : "Repasá la página Meshtastic y la malla y volvé a intentarlo.";
    puntaje.innerHTML = "<strong>Puntaje final: " + bien + " de " + preguntas.length + ".</strong> " + mensaje;
    otraVez.hidden = false;
  }

  otraVez.addEventListener("click", function () {
    respondidas = {};
    preguntas.forEach(function (p) {
      p.querySelectorAll("input").forEach(function (r) { r.disabled = false; r.checked = false; });
      p.querySelectorAll("label").forEach(function (l) { l.classList.remove("quiz-opcion--correcta", "quiz-opcion--elegida"); });
      p.querySelector(".quiz-comprobar").disabled = false;
      var aviso = p.querySelector(".quiz-respuesta");
      aviso.className = "quiz-respuesta";
      aviso.textContent = "";
    });
    puntaje.textContent = "Respondé las 5 preguntas para ver tu puntaje.";
    otraVez.hidden = true;
    preguntas[0].querySelector("input").focus();
  });
})();
