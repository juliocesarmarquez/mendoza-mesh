/* Mendoza Mesh: formulario «Sumá tu nodo».
   No envía nada a ningún servidor: arma un correo (mailto:) que la persona manda
   desde su propio programa de correo. Sin JavaScript, el formulario usa
   action="mailto:" con enctype="text/plain" como alternativa.
   La dirección de destino se cambia en el atributo data-correo del formulario. */
(function () {
  "use strict";
  var form = document.getElementById("form-nodo");
  if (!form) return;

  var correo = form.getAttribute("data-correo");
  form.noValidate = true; // con JavaScript, la validación la hace este script, con mensajes en castellano
  var resumen = document.getElementById("form-errores");
  var listo = document.getElementById("form-listo");
  var vista = document.getElementById("f-vista");
  var copiar = document.getElementById("f-copiar");
  var copiado = document.getElementById("f-copiado");

  var reglas = [
    { id: "f-id", mensaje: function (c) {
        if (!c.value.trim()) return "Escribí el ID del nodo.";
        if (!/^!?[0-9a-fA-F]{8}$/.test(c.value.trim())) return "El ID tiene que tener 8 letras (de la a a la f) o números, por ejemplo !a1b2c3d4.";
        return "";
      } },
    { id: "f-provincia", mensaje: function (c) { return c.value ? "" : "Elegí la provincia."; } },
    { id: "f-localidad", mensaje: function (c) { return c.value.trim() ? "" : "Escribí la localidad o el barrio."; } },
    { id: "f-acepto", mensaje: function (c) { return c.checked ? "" : "Para continuar, aceptá el aviso de privacidad."; } }
  ];

  function marcar(campo, mensaje) {
    var error = document.getElementById(campo.id + "-error");
    if (mensaje) {
      campo.setAttribute("aria-invalid", "true");
      error.textContent = mensaje;
      error.hidden = false;
    } else {
      campo.removeAttribute("aria-invalid");
      error.textContent = "";
      error.hidden = true;
    }
  }

  function validar() {
    var errores = [];
    reglas.forEach(function (r) {
      var campo = document.getElementById(r.id);
      var mensaje = r.mensaje(campo);
      marcar(campo, mensaje);
      if (mensaje) errores.push({ id: r.id, mensaje: mensaje });
    });
    return errores;
  }

  // Al corregir un campo, el error desaparece sin esperar al próximo envío.
  reglas.forEach(function (r) {
    var campo = document.getElementById(r.id);
    campo.addEventListener(campo.type === "checkbox" ? "change" : "blur", function () {
      if (campo.getAttribute("aria-invalid")) marcar(campo, r.mensaje(campo));
    });
  });

  function valor(nombre) {
    var c = form.elements[nombre];
    if (!c) return "";
    if (c.length && c[0] && c[0].type === "radio") {
      var elegido = form.querySelector('input[name="' + nombre + '"]:checked');
      return elegido ? elegido.value : "";
    }
    return String(c.value || "").trim();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var errores = validar();
    if (errores.length) {
      resumen.innerHTML = "<h3>Revisá " + (errores.length === 1 ? "este dato" : "estos " + errores.length + " datos") + ":</h3><ul>" +
        errores.map(function (er) { return '<li><a href="#' + er.id + '">' + er.mensaje + "</a></li>"; }).join("") + "</ul>";
      resumen.hidden = false;
      resumen.focus();
      return;
    }
    resumen.hidden = true;

    var id = valor("id").toLowerCase();
    if (id.charAt(0) !== "!") id = "!" + id;
    var motivo = valor("motivo");
    var lineas = [
      "Motivo: " + motivo,
      "ID del nodo: " + id,
      "Nombre largo: " + (valor("nombre_largo") || "-"),
      "Nombre corto: " + (valor("nombre_corto") || "-"),
      "Provincia: " + valor("provincia"),
      "Localidad o barrio: " + valor("localidad"),
      "Rol: " + valor("rol"),
      "Dónde está: " + valor("ubicacion"),
      "Usa MQTT: " + valor("mqtt"),
      "Comentarios: " + (valor("comentarios") || "-"),
      "",
      "Firma: " + (valor("firma") || "-"),
      "Acepto el aviso de privacidad de Mendoza Mesh: sí."
    ];
    var asunto = "Mendoza Mesh: " + motivo + " (" + id + ")";
    var cuerpo = lineas.join("\n");

    vista.value = "Para: " + correo + "\nAsunto: " + asunto + "\n\n" + cuerpo;
    listo.hidden = false;
    listo.focus();
    window.location.href = "mailto:" + correo + "?subject=" + encodeURIComponent(asunto) + "&body=" + encodeURIComponent(cuerpo);
  });

  copiar.addEventListener("click", function () {
    function hecho() { copiado.textContent = "Texto copiado."; }
    function fallo() {
      vista.select();
      copiado.textContent = "Seleccioné el texto: copialo con Ctrl+C (o Cmd+C).";
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(vista.value).then(hecho, fallo);
    } else {
      fallo();
    }
  });
})();
