/* Mendoza Mesh: formularios que preparan un correo (mailto:).
   No envían nada a ningún servidor: arman un correo que la persona manda desde
   su propio programa de correo. Sin JavaScript, el formulario usa
   action="mailto:" con enctype="text/plain" y la validación del navegador.

   Se activa en cada <form data-formulario="correo"> y se configura con atributos:
     data-correo    dirección de destino.
     data-asunto    plantilla del asunto; {nombre} se reemplaza por el valor del
                    campo con ese name (por ejemplo, "Mendoza Mesh: {motivo}").
     data-listo     id del panel que aparece con el correo armado.
   En cada campo:
     data-etiqueta         nombre del dato en el cuerpo del correo (en un
                           fieldset de radios, va en el fieldset).
     data-error-requerido  mensaje si falta el dato.
     data-error-formato    mensaje si el formato no es válido (por ejemplo, correo).
     data-limite           cantidad máxima de caracteres (muestra un contador
                           en el elemento #<id>-contador).
   En los radios:
     data-clave   valor corto para preseleccionarlo con ?motivo=<clave>.
     data-ayuda   texto que se muestra en [data-rol="ayuda-motivo"] al elegirlo. */
(function () {
  "use strict";

  var formularios = document.querySelectorAll('form[data-formulario="correo"]');
  for (var i = 0; i < formularios.length; i++) preparar(formularios[i]);

  function preparar(form) {
    var correo = form.getAttribute("data-correo");
    var plantilla = form.getAttribute("data-asunto") || "Mendoza Mesh";
    var resumen = form.querySelector('[data-rol="errores"]');
    var listo = document.getElementById(form.getAttribute("data-listo"));
    var ayudaMotivo = form.querySelector('[data-rol="ayuda-motivo"]');
    form.noValidate = true; // con JavaScript, valida este script, con mensajes en castellano

    var campos = [];
    var candidatos = form.querySelectorAll("input, select, textarea");
    for (var i = 0; i < candidatos.length; i++) {
      var c = candidatos[i];
      if (c.type !== "radio" && (c.required || c.type === "email" || c.hasAttribute("data-limite"))) campos.push(c);
    }

    function mensajePara(campo) {
      var v = campo.type === "checkbox" ? "" : String(campo.value || "").trim();
      if (campo.type === "checkbox" ? (campo.required && !campo.checked) : (campo.required && !v)) {
        return campo.getAttribute("data-error-requerido") || "Completá este dato.";
      }
      if (v && campo.validity && campo.validity.typeMismatch) {
        return campo.getAttribute("data-error-formato") || "Revisá el formato de este dato.";
      }
      var limite = parseInt(campo.getAttribute("data-limite"), 10);
      if (limite && campo.value.length > limite) {
        return "Tiene " + campo.value.length + " caracteres y el máximo es " + limite +
          ": acortalo un poco, o copiá el texto y mandalo desde tu correo.";
      }
      return "";
    }

    function marcar(campo, mensaje) {
      var error = document.getElementById(campo.id + "-error");
      if (mensaje) campo.setAttribute("aria-invalid", "true");
      else campo.removeAttribute("aria-invalid");
      if (!error) return;
      error.textContent = mensaje;
      error.hidden = !mensaje;
    }

    function validar() {
      var errores = [];
      for (var i = 0; i < campos.length; i++) {
        var mensaje = mensajePara(campos[i]);
        marcar(campos[i], mensaje);
        if (mensaje) errores.push({ id: campos[i].id, mensaje: mensaje });
      }
      return errores;
    }

    // Al corregir un campo, el error desaparece sin esperar al próximo envío.
    campos.forEach(function (campo) {
      campo.addEventListener(campo.type === "checkbox" ? "change" : "blur", function () {
        if (campo.getAttribute("aria-invalid")) marcar(campo, mensajePara(campo));
      });
    });

    // Contadores de caracteres.
    campos.forEach(function (campo) {
      var limite = parseInt(campo.getAttribute("data-limite"), 10);
      var contador = document.getElementById(campo.id + "-contador");
      if (!limite || !contador) return;
      function actualizar() {
        var n = campo.value.length;
        contador.textContent = n + " de " + limite + " caracteres";
        contador.classList.toggle("campo__contador--excedido", n > limite);
      }
      campo.addEventListener("input", actualizar);
      actualizar();
    });

    // Motivo: preselección con ?motivo=<clave> y ayuda que cambia según la opción.
    var radios = form.querySelectorAll('input[type="radio"][data-clave]');
    var pedido = /[?&]motivo=([^&#]+)/.exec(window.location.search);
    if (pedido) {
      for (var r = 0; r < radios.length; r++) {
        if (radios[r].getAttribute("data-clave") === decodeURIComponent(pedido[1])) radios[r].checked = true;
      }
    }
    function mostrarAyuda() {
      if (!ayudaMotivo) return;
      for (var r = 0; r < radios.length; r++) {
        if (radios[r].checked && radios[r].getAttribute("data-ayuda")) {
          ayudaMotivo.textContent = radios[r].getAttribute("data-ayuda");
        }
      }
    }
    for (var k = 0; k < radios.length; k++) radios[k].addEventListener("change", mostrarAyuda);
    mostrarAyuda();

    function valorDe(elemento) {
      if (elemento.tagName === "FIELDSET") {
        var elegido = elemento.querySelector("input:checked");
        return elegido ? elegido.value : "";
      }
      if (elemento.type === "checkbox") return elemento.checked ? "sí" : "no";
      return String(elemento.value || "").trim();
    }

    function valorPorNombre(nombre) {
      var elegido = form.querySelector('[name="' + nombre + '"]:checked');
      if (elegido) return elegido.value;
      var c = form.elements[nombre];
      return c && c.value !== undefined ? String(c.value).trim() : "";
    }

    function armarCorreo() {
      var lineas = [];
      var datos = form.querySelectorAll("[data-etiqueta]");
      for (var i = 0; i < datos.length; i++) {
        var etiqueta = datos[i].getAttribute("data-etiqueta");
        var v = valorDe(datos[i]) || "-";
        if (v.indexOf("\n") !== -1) lineas.push("", etiqueta + ":", v, "");
        else lineas.push(etiqueta + ": " + v);
      }
      var asunto = plantilla.replace(/\{([a-z_]+)\}/g, function (_, nombre) { return valorPorNombre(nombre); });
      return { asunto: asunto, cuerpo: lineas.join("\n").replace(/\s+$/, "") };
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var errores = validar();
      if (errores.length) {
        resumen.innerHTML = "<h2>Revisá " + (errores.length === 1 ? "este dato" : "estos " + errores.length + " datos") + ":</h2><ul>" +
          errores.map(function (er) { return '<li><a href="#' + er.id + '">' + er.mensaje + "</a></li>"; }).join("") + "</ul>";
        resumen.hidden = false;
        resumen.focus();
        return;
      }
      resumen.hidden = true;

      var mensaje = armarCorreo();
      var url = "mailto:" + correo + "?subject=" + encodeURIComponent(mensaje.asunto) + "&body=" + encodeURIComponent(mensaje.cuerpo);
      if (listo) {
        var vista = listo.querySelector('[data-rol="vista"]');
        var abrir = listo.querySelector('[data-rol="abrir"]');
        if (vista) vista.value = "Para: " + correo + "\nAsunto: " + mensaje.asunto + "\n\n" + mensaje.cuerpo;
        if (abrir) abrir.href = url;
        listo.hidden = false;
        listo.focus();
      }
      window.location.href = url;
    });

    if (!listo) return;
    function copiarTexto(texto, estado, alFallar) {
      function hecho() { estado.textContent = "Copiado."; }
      function fallo() { alFallar(); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(hecho, fallo);
      else fallo();
    }
    var estado = listo.querySelector('[data-rol="copiado"]');
    var vista = listo.querySelector('[data-rol="vista"]');
    var botonTexto = listo.querySelector('[data-rol="copiar"]');
    var botonCorreo = listo.querySelector('[data-rol="copiar-correo"]');
    if (botonTexto) botonTexto.addEventListener("click", function () {
      copiarTexto(vista.value, estado, function () {
        vista.select();
        estado.textContent = "Seleccioné el texto: copialo con Ctrl+C (o Cmd+C).";
      });
    });
    if (botonCorreo) botonCorreo.addEventListener("click", function () {
      copiarTexto(correo, estado, function () {
        estado.textContent = "No pude copiarla: la dirección es " + correo + ".";
      });
    });
  }
})();
