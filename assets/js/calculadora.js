/* Mendoza Mesh: calculadora de alcance orientativo.
   Usa fórmulas estándar de radioenlaces y supone terreno plano y sin obstáculos:
   - Horizonte radioeléctrico con atmósfera estándar (k = 4/3): d ≈ 4,12 · (√h1 + √h2) km
   - Abultamiento de la Tierra en el punto medio: D² / (8 · k · R)
   - Radio de la primera zona de Fresnel en el punto medio: 8,66 · √(D / f) m (D en km, f en GHz)
   - Pérdida en espacio libre: 32,45 + 20·log10(f MHz) + 20·log10(D km) dB
   - Sensibilidad de cada preset = 22 dBm − presupuesto de enlace oficial (que supone 22 dBm y antenas de 0 dBi) */
(function () {
  "use strict";
  var form = document.getElementById("calculadora");
  if (!form) return;

  var F_MHZ = 915;          // banda de uso compartido de 915–928 MHz
  var K = 4 / 3;            // factor de radio terrestre efectivo (atmósfera estándar)
  var R_TIERRA_KM = 6371;
  var PRESUPUESTO = {       // dB, de la tabla oficial de presets de Meshtastic
    SHORT_FAST: 143, MEDIUM_FAST: 148, LONG_FAST: 153, LONG_MODERATE: 156
  };

  var salida = document.getElementById("calc-resultado");
  var errores = document.getElementById("calc-errores");

  function num(id) { return Number(String(document.getElementById(id).value).replace(",", ".")); }
  function f(n, d) { return n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }); }

  function calcular(e) {
    if (e) e.preventDefault();
    var h1 = num("calc-h1"), h2 = num("calc-h2"), d = num("calc-distancia");
    var ptx = num("calc-potencia"), g = num("calc-ganancia");
    var preset = document.getElementById("calc-preset").value;

    var problemas = [];
    if (!(h1 >= 0 && h1 <= 5000)) problemas.push("La altura de la antena A tiene que estar entre 0 y 5000 m.");
    if (!(h2 >= 0 && h2 <= 5000)) problemas.push("La altura de la antena B tiene que estar entre 0 y 5000 m.");
    if (!(d > 0 && d <= 500)) problemas.push("La distancia tiene que ser mayor que 0 y de hasta 500 km.");
    if (!(g >= 0 && g <= 15)) problemas.push("La ganancia tiene que estar entre 0 y 15 dBi.");
    errores.innerHTML = problemas.map(function (p) { return "<li>" + p + "</li>"; }).join("");
    errores.hidden = problemas.length === 0;
    if (problemas.length) { salida.innerHTML = ""; return; }

    var horizonte = 4.12 * (Math.sqrt(h1) + Math.sqrt(h2));
    var hayVista = d <= horizonte;
    var abultamiento = (d * 1000) * (d * 1000) / (8 * K * R_TIERRA_KM * 1000);
    var fresnel = 8.66 * Math.sqrt(d / (F_MHZ / 1000));
    var despeje = (h1 + h2) / 2 - abultamiento;           // terreno plano
    var despejeNecesario = 0.6 * fresnel;
    var perdida = 32.45 + 20 * Math.log10(F_MHZ) + 20 * Math.log10(d);
    var recibida = ptx + 2 * g - perdida;
    var sensibilidad = 22 - PRESUPUESTO[preset];
    var margen = recibida - sensibilidad;

    var veredicto, clase;
    if (!hayVista) { veredicto = "Sin línea de vista: la curvatura de la Tierra tapa el enlace."; clase = "malo"; }
    else if (margen < 0) { veredicto = "Señal insuficiente aun en espacio libre."; clase = "malo"; }
    else if (despeje < despejeNecesario) { veredicto = "Posible, pero la zona de Fresnel queda obstruida: esperá pérdidas extra. Subí las antenas."; clase = "regular"; }
    else if (margen < 10) { veredicto = "Probable en condiciones ideales, con poco margen."; clase = "regular"; }
    else { veredicto = "Probable en condiciones ideales."; clase = "bueno"; }

    salida.innerHTML =
      '<p class="calc-veredicto calc-veredicto--' + clase + '"><strong>' + veredicto + "</strong></p>" +
      '<dl class="calc-datos">' +
      "<dt>Horizonte radioeléctrico</dt><dd>" + f(horizonte, 1) + " km. " +
        (hayVista ? "La distancia (" + f(d, 1) + " km) está dentro: hay línea de vista aproximada, sin contar el relieve."
                  : "La distancia (" + f(d, 1) + " km) lo supera.") + "</dd>" +
      "<dt>Despeje en el punto medio</dt><dd>" + f(Math.max(despeje, 0), 1) + " m sobre el suelo, de " + f(despejeNecesario, 1) +
        " m recomendados (60 % de la zona de Fresnel, que mide " + f(fresnel, 1) + " m). La curvatura de la Tierra se come " + f(abultamiento, 1) + " m.</dd>" +
      "<dt>Pérdida en espacio libre</dt><dd>" + f(perdida, 1) + " dB a " + F_MHZ + " MHz.</dd>" +
      "<dt>Señal estimada</dt><dd>" + f(recibida, 1) + " dBm (sensibilidad del preset: " + f(sensibilidad, 0) + " dBm).</dd>" +
      "<dt>Margen</dt><dd>" + (margen >= 0 ? "+" : "") + f(margen, 1) + " dB. Los árboles, edificios y cerros suelen restar varios dB más.</dd>" +
      "</dl>";
  }

  form.addEventListener("submit", calcular);
  form.addEventListener("input", function () { if (form.checkValidity()) calcular(); });
  calcular();
})();
