/* Mendoza Mesh: simulador de malla.
   Seis nodos; al elegir uno, el mensaje se propaga ronda por ronda.
   «Salto» = una retransmisión, como en Meshtastic: el límite de saltos
   cuenta cuántas veces puede repetirse el mensaje. */
(function () {
  "use strict";
  var raiz = document.getElementById("simulador");
  if (!raiz) return;

  var svg = raiz.querySelector("svg");
  var limite = document.getElementById("sim-limite");
  var reiniciar = document.getElementById("sim-reiniciar");
  var estado = document.getElementById("sim-estado");
  var registro = document.getElementById("sim-registro");
  var sinMovimiento = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var PAUSA = sinMovimiento ? 0 : 1100;

  // Enlaces de radio posibles (quién escucha a quién). F queda detrás del cerro.
  var ENLACES = [["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"], ["C", "D"], ["D", "E"]];
  var NODOS = ["A", "B", "C", "D", "E", "F"];
  var vecinos = {};
  NODOS.forEach(function (n) { vecinos[n] = []; });
  ENLACES.forEach(function (e) { vecinos[e[0]].push(e[1]); vecinos[e[1]].push(e[0]); });

  var temporizadores = [];
  var elNodo = {};
  NODOS.forEach(function (n) {
    var g = svg.querySelector('[data-nodo="' + n + '"]');
    elNodo[n] = g;
    g.addEventListener("click", function () { simular(n); });
    g.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); simular(n); }
    });
  });

  function lista(nombres) {
    if (nombres.length <= 1) return nombres.join("");
    return nombres.slice(0, -1).join(", ") + " y " + nombres[nombres.length - 1];
  }
  function ponerEstado(n, clase, texto) {
    var g = elNodo[n];
    g.setAttribute("class", "sim-nodo " + clase);
    g.querySelector(".sim-nodo__estado").textContent = texto;
    g.setAttribute("aria-label", "Nodo " + n + (texto ? ": " + texto : "") + ". Enviar un mensaje desde " + n + ".");
  }
  function limpiar() {
    temporizadores.forEach(clearTimeout);
    temporizadores = [];
    NODOS.forEach(function (n) { ponerEstado(n, "", ""); });
    svg.querySelectorAll(".sim-enlace").forEach(function (l) { l.setAttribute("class", "sim-enlace"); });
    svg.querySelectorAll(".sim-onda").forEach(function (o) { o.remove(); });
    registro.innerHTML = "";
  }
  function onda(n) {
    if (sinMovimiento) return;
    var c = elNodo[n].querySelector("circle");
    var o = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    o.setAttribute("cx", c.getAttribute("cx"));
    o.setAttribute("cy", c.getAttribute("cy"));
    o.setAttribute("r", "20");
    o.setAttribute("class", "sim-onda");
    svg.insertBefore(o, svg.querySelector(".sim-nodos"));
    temporizadores.push(setTimeout(function () { o.remove(); }, 1000));
  }
  function marcarEnlace(a, b) {
    var l = svg.querySelector('[data-enlace="' + [a, b].sort().join("") + '"]');
    if (l) l.setAttribute("class", "sim-enlace sim-enlace--activo");
  }
  function anotar(texto) {
    var li = document.createElement("li");
    li.textContent = texto;
    registro.appendChild(li);
  }

  function simular(origen) {
    limpiar();
    var maxSaltos = Number(limite.value);
    var recibido = {}; recibido[origen] = 0;
    var rondas = [];
    var transmiten = [origen];
    var ronda = 0;
    // Búsqueda en anchura: en cada ronda transmiten los que recibieron en la anterior.
    while (transmiten.length) {
      var nuevos = [];
      transmiten.forEach(function (t) {
        vecinos[t].forEach(function (v) {
          if (!(v in recibido) && nuevos.indexOf(v) === -1) nuevos.push(v);
        });
      });
      rondas.push({ transmiten: transmiten.slice(), reciben: nuevos, saltos: ronda });
      nuevos.forEach(function (v) { recibido[v] = ronda; });
      ronda++;
      if (ronda > maxSaltos) break; // ya no quedan saltos para retransmitir
      transmiten = nuevos;
    }
    var faltan = NODOS.filter(function (n) { return !(n in recibido); });
    // ¿Falta porque no hay camino o porque se agotaron los saltos?
    var alcanzables = {}; var cola = [origen]; alcanzables[origen] = true;
    while (cola.length) {
      var x = cola.shift();
      vecinos[x].forEach(function (v) { if (!alcanzables[v]) { alcanzables[v] = true; cola.push(v); } });
    }

    ponerEstado(origen, "es-origen", "origen");
    estado.textContent = "Mensaje enviado desde " + origen + " con un límite de " + maxSaltos + (maxSaltos === 1 ? " salto." : " saltos.");

    rondas.forEach(function (r, i) {
      temporizadores.push(setTimeout(function () {
        r.transmiten.forEach(function (t) {
          onda(t);
          if (t !== origen) ponerEstado(t, "es-retransmite", recibido[t] === 0 ? "directo · retransmite" : textoSaltos(recibido[t]) + " · retransmite");
        });
        r.reciben.forEach(function (v) {
          var desde = r.transmiten.filter(function (t) { return vecinos[t].indexOf(v) !== -1; });
          desde.forEach(function (t) { marcarEnlace(t, v); });
          temporizadores.push(setTimeout(function () {
            ponerEstado(v, "es-recibido", r.saltos === 0 ? "directo" : textoSaltos(r.saltos));
          }, PAUSA / 2));
        });
        var quien = i === 0 ? origen + " transmite" : lista(r.transmiten) + (r.transmiten.length === 1 ? " retransmite" : " retransmiten");
        var cuenta = i === 0 ? "" : " (salto " + i + ")";
        anotar("Ronda " + (i + 1) + ": " + quien + cuenta + ". " +
          (r.reciben.length ? "Lo " + (r.reciben.length === 1 ? "recibe " : "reciben ") + lista(r.reciben) + "." : "Nadie nuevo lo recibe."));
      }, PAUSA * i));
    });

    temporizadores.push(setTimeout(function () {
      var sinCamino = faltan.filter(function (n) { return !alcanzables[n]; });
      var sinSaltos = faltan.filter(function (n) { return alcanzables[n]; });
      sinCamino.forEach(function (n) { ponerEstado(n, "es-fuera", "fuera de alcance"); });
      sinSaltos.forEach(function (n) { ponerEstado(n, "es-sin-saltos", "no llegó: sin saltos"); });
      var llegaron = NODOS.length - 1 - faltan.length;
      var resumen = "Resultado: " + llegaron + " de " + (NODOS.length - 1) + " nodos recibieron el mensaje.";
      if (sinCamino.length) resumen += " Fuera de alcance de radio: " + lista(sinCamino) + ".";
      if (sinSaltos.length) resumen += " No le llegó por el límite de saltos a: " + lista(sinSaltos) + ". Probá subir el límite.";
      anotar(resumen);
      estado.textContent = resumen;
    }, PAUSA * rondas.length + PAUSA / 2));
  }

  function textoSaltos(n) { return n === 1 ? "1 salto" : n + " saltos"; }

  reiniciar.addEventListener("click", function () { limpiar(); estado.textContent = "Elegí un nodo para enviar un mensaje."; });
  limite.addEventListener("change", function () { limpiar(); estado.textContent = "Límite de saltos: " + limite.value + ". Elegí un nodo para enviar un mensaje."; });
  raiz.hidden = false;
  var aviso = document.getElementById("simulador-sin-js");
  if (aviso) aviso.hidden = true;
})();
