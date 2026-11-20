/* Mendoza Mesh: mapa de nodos de Cuyo.
   Lee data/nodes.json (generado por ingesta/ingesta.py) y lo dibuja con Leaflet
   sobre teselas de OpenStreetMap, sin claves de API.
   Modelo funcional: Meshtastic Map de Liam Cottle (MIT). Implementación propia. */
(function () {
  "use strict";

  var contenedor = document.getElementById("mapa");
  if (!contenedor || typeof L === "undefined") return;

  // ---- Configuración --------------------------------------------------------
  var VISTA_INICIAL = { centro: [-33.0, -68.5], zoom: 7 };
  var URL_DATOS = "data/nodes.json";
  var URL_PROVINCIAS = "data/provincias-cuyo.geojson";
  var CLAVE_AJUSTES = "mm-mapa-ajustes";

  var GRUPOS = {
    cliente: { nombre: "Cliente", forma: "circulo" },
    router: { nombre: "Router o repetidor", forma: "triangulo" },
    sensor: { nombre: "Sensor o rastreador", forma: "cuadrado" },
    otro: { nombre: "Otro o desconocido", forma: "rombo" }
  };
  var ROLES = {
    CLIENT: ["Cliente", "cliente"],
    CLIENT_MUTE: ["Cliente silencioso", "cliente"],
    CLIENT_HIDDEN: ["Cliente oculto", "cliente"],
    CLIENT_BASE: ["Base personal", "cliente"],
    TAK: ["TAK", "cliente"],
    ROUTER: ["Router", "router"],
    ROUTER_LATE: ["Router tardío", "router"],
    REPEATER: ["Repetidor (obsoleto)", "router"],
    ROUTER_CLIENT: ["Router cliente (obsoleto)", "router"],
    SENSOR: ["Sensor", "sensor"],
    TRACKER: ["Rastreador", "sensor"],
    TAK_TRACKER: ["Rastreador TAK", "sensor"],
    LOST_AND_FOUND: ["Objetos perdidos", "sensor"]
  };

  // ---- Estado ---------------------------------------------------------------
  var datos = null;
  var nodos = [];             // nodos del archivo, con campos calculados
  var porId = {};
  var marcadores = {};
  var seleccionado = null;
  var ajustes = leerAjustes();

  // En pantallas angostas, los filtros y la leyenda arrancan plegados para que el mapa quede cerca.
  var opciones = document.getElementById("mapa-opciones");
  if (opciones && window.matchMedia && window.matchMedia("(max-width: 61.99rem)").matches) opciones.open = false;

  var el = function (id) { return document.getElementById(id); };
  var campoBuscar = el("mapa-buscar");
  var resultados = el("mapa-resultados");
  var estadoBusqueda = el("mapa-estado-busqueda");
  var filtroProvincia = el("mapa-provincia");
  var verInactivos = el("mapa-inactivos");
  var capaVecinosCheck = el("mapa-capa-vecinos");
  var capaWaypointsCheck = el("mapa-capa-waypoints");
  var capaLimitesCheck = el("mapa-capa-limites");
  var panelDetalle = el("mapa-detalle");
  var contenidoDetalle = el("mapa-detalle-contenido");
  var estadoDatos = el("mapa-estado-datos");
  var cuerpoLista = el("mapa-lista-cuerpo");
  var resumenLista = el("mapa-lista-resumen");

  // ---- Utilidades -------------------------------------------------------------
  function leerAjustes() {
    var base = { inactivos: true, vecinos: true, waypoints: true, limites: true };
    try {
      var guardado = JSON.parse(window.localStorage.getItem(CLAVE_AJUSTES) || "{}");
      Object.keys(base).forEach(function (k) { if (typeof guardado[k] === "boolean") base[k] = guardado[k]; });
    } catch (e) { /* sin almacenamiento: se usan los valores de base */ }
    return base;
  }
  function guardarAjustes() {
    try { window.localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes)); } catch (e) { /* nada */ }
  }
  function normalizar(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  }
  function escapar(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fecha(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    return isNaN(d) ? null : d;
  }
  function haceCuanto(desde, referencia) {
    if (!desde) return "sin datos";
    var min = Math.round((referencia - desde) / 60000);
    if (min < 1) return "hace menos de un minuto";
    if (min < 60) return "hace " + min + (min === 1 ? " minuto" : " minutos");
    var h = Math.round(min / 60);
    if (h < 48) return "hace " + h + (h === 1 ? " hora" : " horas");
    var d = Math.round(h / 24);
    return "hace " + d + " días";
  }
  function fechaLegible(d) {
    return d ? d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "sin datos";
  }
  function numero(n, dec) {
    return Number(n).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function rolDe(nodo) {
    var r = ROLES[nodo.rol];
    return r ? { nombre: r[0], grupo: r[1] } : { nombre: "Rol desconocido", grupo: "otro" };
  }
  function nombreDe(nodo) {
    return nodo.nombre_largo || nodo.nombre_corto || nodo.id;
  }
  function etiquetaId(id) {
    if (!id) return "nodo oculto a pedido";
    var n = porId[id];
    return n ? nombreDe(n) + " (" + id + ")" : id;
  }

  // Ícono SVG: la forma indica el tipo de rol y el relleno indica el estado.
  function svgIcono(grupo, inactivo, tamano) {
    var t = tamano || 26;
    var formas = {
      circulo: '<circle cx="12" cy="12" r="8.5"/>',
      triangulo: '<path d="M12 3 21.5 20h-19z"/>',
      cuadrado: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
      rombo: '<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/>'
    };
    return '<svg class="icono-nodo icono-nodo--' + grupo + (inactivo ? " icono-nodo--inactivo" : "") +
      '" viewBox="0 0 24 24" width="' + t + '" height="' + t + '" aria-hidden="true" focusable="false">' +
      formas[GRUPOS[grupo].forma] + "</svg>";
  }

  // ---- Mapa base ----------------------------------------------------------------
  var mapa = L.map(contenedor, {
    center: VISTA_INICIAL.centro,
    zoom: VISTA_INICIAL.zoom,
    minZoom: 6,
    maxZoom: 14,          // no tiene sentido acercarse más: las posiciones están redondeadas
    keyboard: true,
    zoomControl: true
  });
  mapa.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mapa);

  var capaNodos = L.layerGroup().addTo(mapa);
  var capaVecinos = L.layerGroup();
  var capaWaypoints = L.layerGroup();
  var capaLimites = L.layerGroup();
  var capaRuta = L.layerGroup().addTo(mapa);

  // ---- Carga de datos ---------------------------------------------------------------
  fetch(URL_DATOS, { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(iniciar)
    .catch(function (error) {
      estadoDatos.className = "mapa-estado mapa-estado--error";
      estadoDatos.textContent = "No se pudieron cargar los datos del mapa (" + error.message + "). Probá recargar la página más tarde.";
    });

  fetch(URL_PROVINCIAS)
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (geo) {
      if (!geo) return;
      L.geoJSON(geo, { interactive: false, style: { className: "limite-provincia", weight: 2, fill: false } }).addTo(capaLimites);
    })
    .catch(function () { /* los límites son opcionales */ });

  function iniciar(json) {
    datos = json;
    var referencia = fecha(datos.generado) || new Date();
    var horas = Number(datos.inactivo_tras_horas) || 24;
    var r = datos.recorte;
    if (r) {
      mapa.setMaxBounds(L.latLngBounds([r.lat_min - 1, r.lon_min - 1], [r.lat_max + 1, r.lon_max + 1]));
    }

    nodos = (datos.nodos || []).filter(function (n) {
      return typeof n.lat === "number" && typeof n.lon === "number";
    }).map(function (n) {
      var contacto = fecha(n.ultimo_contacto);
      n._contacto = contacto;
      n._inactivo = !contacto || (referencia - contacto) > horas * 3600000;
      n._rol = rolDe(n);
      n._busqueda = normalizar([n.id, n.id.replace("!", ""), n.nombre_largo, n.nombre_corto].join(" "));
      porId[n.id] = n;
      return n;
    });

    mostrarEstadoDatos(referencia);
    crearMarcadores();
    crearVecinos();
    crearWaypoints();
    aplicarAjustes();
    actualizar();
    seleccionarDesdeEnlace();
  }

  function mostrarEstadoDatos(referencia) {
    var partes = [];
    if (datos.ejemplo) {
      estadoDatos.className = "mapa-estado mapa-estado--ejemplo";
      partes.push("<strong>Datos de EJEMPLO:</strong> los " + nodos.length + " nodos que ves son ficticios y sirven para mostrar cómo funciona el mapa.");
    } else {
      estadoDatos.className = "mapa-estado";
      var antig = Date.now() - referencia;
      partes.push("Datos actualizados " + haceCuanto(referencia, Date.now()) + " (" + fechaLegible(referencia) + ").");
      if (antig > 2 * 3600000) {
        estadoDatos.className = "mapa-estado mapa-estado--error";
        partes.push("Los datos tienen más de dos horas: puede que la actualización automática esté detenida.");
      }
      if (!nodos.length) partes.push("Todavía no hay nodos de Cuyo con posición en el MQTT.");
    }
    estadoDatos.innerHTML = partes.join(" ");
  }

  // ---- Capas ------------------------------------------------------------------------
  function crearMarcadores() {
    nodos.forEach(function (n) {
      var icono = L.divIcon({
        className: "marcador-nodo",
        html: svgIcono(n._rol.grupo, n._inactivo),
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        tooltipAnchor: [0, -14]
      });
      var m = L.marker([n.lat, n.lon], { icon: icono, keyboard: true, riseOnHover: true });
      m.bindTooltip(
        "<strong>" + escapar(nombreDe(n)) + "</strong><br>" + escapar(n._rol.nombre) + " · " +
        (n._inactivo ? "inactivo" : "activo") + "<br>Último contacto: " +
        escapar(haceCuanto(n._contacto, fecha(datos.generado) || new Date())),
        { direction: "top", className: "tooltip-nodo" }
      );
      m.on("click", function () { seleccionar(n.id, true); });
      m.on("add", function () {
        var e = m.getElement();
        if (!e) return;
        e.setAttribute("role", "button");
        e.setAttribute("aria-label", nombreDe(n) + ", " + n._rol.nombre + ", " + (n._inactivo ? "inactivo" : "activo") + ". Ver detalle.");
        e.addEventListener("focus", function () { m.openTooltip(); });
        e.addEventListener("blur", function () { m.closeTooltip(); });
      });
      marcadores[n.id] = m;
    });
  }

  function crearVecinos() {
    var hechos = {};
    nodos.forEach(function (n) {
      (n.vecinos || []).forEach(function (v) {
        var otro = v.id && porId[v.id];
        if (!otro) return;
        var clave = [n.id, otro.id].sort().join("|");
        if (hechos[clave]) return;
        hechos[clave] = true;
        L.polyline([[n.lat, n.lon], [otro.lat, otro.lon]], { className: "linea-vecino", weight: 2.5, interactive: true })
          .bindTooltip(escapar(nombreDe(n)) + " ↔ " + escapar(nombreDe(otro)) + "<br>SNR " + numero(v.snr, 1) + " dB", { sticky: true })
          .addTo(capaVecinos);
      });
    });
  }

  function crearWaypoints() {
    (datos.waypoints || []).forEach(function (w) {
      var icono = L.divIcon({
        className: "marcador-waypoint",
        html: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path class="banderin" d="M6 21V3.5l12 4.5-12 5"/></svg>',
        iconSize: [24, 24],
        iconAnchor: [6, 22]
      });
      L.marker([w.lat, w.lon], { icon: icono, keyboard: true, alt: "Waypoint " + w.nombre })
        .bindPopup("<strong>" + escapar(w.nombre) + "</strong>" + (w.descripcion ? "<br>" + escapar(w.descripcion) : "") +
          (w.vence ? "<br>Vence: " + escapar(fechaLegible(fecha(w.vence))) : ""))
        .on("add", function (ev) {
          var e = ev.target.getElement();
          if (e) { e.setAttribute("role", "button"); e.setAttribute("aria-label", "Waypoint: " + w.nombre); }
        })
        .addTo(capaWaypoints);
    });
  }

  // ---- Filtros y ajustes ------------------------------------------------------------
  function aplicarAjustes() {
    verInactivos.checked = ajustes.inactivos;
    capaVecinosCheck.checked = ajustes.vecinos;
    capaWaypointsCheck.checked = ajustes.waypoints;
    capaLimitesCheck.checked = ajustes.limites;
    alternarCapa(capaVecinos, ajustes.vecinos);
    alternarCapa(capaWaypoints, ajustes.waypoints);
    alternarCapa(capaLimites, ajustes.limites);
  }
  function alternarCapa(capa, visible) {
    if (visible) capa.addTo(mapa); else mapa.removeLayer(capa);
  }
  function visible(n) {
    if (!ajustes.inactivos && n._inactivo) return false;
    var prov = filtroProvincia.value;
    return !prov || n.provincia === prov;
  }

  function actualizar() {
    var visibles = 0;
    nodos.forEach(function (n) {
      var m = marcadores[n.id];
      if (visible(n)) { visibles++; if (!capaNodos.hasLayer(m)) capaNodos.addLayer(m); }
      else if (capaNodos.hasLayer(m)) capaNodos.removeLayer(m);
    });
    dibujarLista();
    buscar();
    resumenLista.textContent = "Se muestran " + visibles + " de " + nodos.length + " nodos.";
  }

  [filtroProvincia, verInactivos].forEach(function (c) {
    c.addEventListener("change", function () { ajustes.inactivos = verInactivos.checked; guardarAjustes(); actualizar(); });
  });
  [[capaVecinosCheck, "vecinos", capaVecinos], [capaWaypointsCheck, "waypoints", capaWaypoints], [capaLimitesCheck, "limites", capaLimites]]
    .forEach(function (par) {
      par[0].addEventListener("change", function () {
        ajustes[par[1]] = par[0].checked; guardarAjustes(); alternarCapa(par[2], par[0].checked);
      });
    });

  // ---- Búsqueda -------------------------------------------------------------------
  function buscar() {
    var q = normalizar(campoBuscar.value);
    resultados.innerHTML = "";
    if (!q) { estadoBusqueda.textContent = ""; return; }
    var encontrados = nodos.filter(function (n) { return visible(n) && n._busqueda.indexOf(q.replace(/^!/, "")) !== -1; });
    var ocultos = nodos.filter(function (n) { return !visible(n) && n._busqueda.indexOf(q.replace(/^!/, "")) !== -1; }).length;
    encontrados.slice(0, 8).forEach(function (n) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mapa-resultado";
      b.innerHTML = svgIcono(n._rol.grupo, n._inactivo, 18) + "<span><strong>" + escapar(nombreDe(n)) + "</strong> <small>" + escapar(n.id) + "</small></span>";
      b.addEventListener("click", function () { seleccionar(n.id, true); });
      li.appendChild(b);
      resultados.appendChild(li);
    });
    var texto = encontrados.length === 0 ? "No se encontró ningún nodo." :
      encontrados.length === 1 ? "1 nodo encontrado." : encontrados.length + " nodos encontrados.";
    if (encontrados.length > 8) texto += " Se muestran los primeros 8.";
    if (ocultos) texto += " " + ocultos + (ocultos === 1 ? " coincide pero está oculto" : " coinciden pero están ocultos") + " por los filtros.";
    estadoBusqueda.textContent = texto;
  }
  campoBuscar.addEventListener("input", buscar);
  campoBuscar.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      var primero = resultados.querySelector("button");
      if (primero) primero.click();
    } else if (e.key === "Escape") {
      campoBuscar.value = ""; buscar();
    }
  });

  // ---- Detalle del nodo ------------------------------------------------------------
  function seleccionar(id, enfocar) {
    var n = porId[id];
    if (!n) return;
    seleccionado = id;
    capaRuta.clearLayers();
    mapa.setView([n.lat, n.lon], Math.max(mapa.getZoom(), 10));
    contenidoDetalle.innerHTML = htmlDetalle(n);
    panelDetalle.hidden = false;
    try { history.replaceState(null, "", "#nodo=" + encodeURIComponent(id)); } catch (e) { /* nada */ }
    contenidoDetalle.querySelectorAll("[data-nodo]").forEach(function (b) {
      b.addEventListener("click", function () { seleccionar(b.getAttribute("data-nodo"), true); });
    });
    contenidoDetalle.querySelectorAll("[data-ruta]").forEach(function (b) {
      b.addEventListener("click", function () { dibujarRuta(datos.traceroutes[Number(b.getAttribute("data-ruta"))]); });
    });
    if (enfocar) {
      var titulo = el("mapa-detalle-titulo");
      if (titulo) titulo.focus();
    }
  }

  function fila(dt, dd) {
    return dd == null || dd === "" ? "" : "<dt>" + dt + "</dt><dd>" + dd + "</dd>";
  }

  function htmlDetalle(n) {
    var ref = fecha(datos.generado) || new Date();
    var t = n.telemetria || {};
    var h = [];
    h.push('<h2 id="mapa-detalle-titulo" tabindex="-1">' + escapar(nombreDe(n)) + "</h2>");
    h.push('<p class="detalle-etiquetas">' + svgIcono(n._rol.grupo, n._inactivo, 18) + " " + escapar(n._rol.nombre) +
      ' · <span class="estado estado--' + (n._inactivo ? "inactivo" : "activo") + '">' + (n._inactivo ? "Inactivo" : "Activo") + "</span>" +
      (n.ejemplo ? ' · <span class="etiqueta">EJEMPLO</span>' : "") + "</p>");
    h.push("<dl class=\"detalle-datos\">" +
      fila("ID", "<code>" + escapar(n.id) + "</code>") +
      fila("Nombre corto", escapar(n.nombre_corto)) +
      fila("Hardware", escapar(n.hardware)) +
      fila("Provincia", escapar(n.provincia)) +
      fila("Posición aproximada", numero(n.lat, 2) + ", " + numero(n.lon, 2) + " <small>(±1 km)</small>") +
      fila("Altitud", n.altitud != null ? numero(n.altitud, 0) + " m" : null) +
      fila("Último contacto", escapar(haceCuanto(n._contacto, ref)) + " <small>(" + escapar(fechaLegible(n._contacto)) + ")</small>") +
      fila("Firmware", escapar(n.firmware)) +
      fila("Región y preset", n.region ? escapar(n.region + (n.preset ? " · " + n.preset : "")) : null) +
      "</dl>");

    h.push("<h3>Telemetría</h3>");
    if (n.telemetria) {
      var bateria = t.bateria == null ? null : (t.bateria > 100 ? "Con alimentación externa" : t.bateria + " %");
      h.push("<dl class=\"detalle-datos\">" +
        fila("Batería", bateria) +
        fila("Voltaje", t.voltaje != null ? numero(t.voltaje, 2) + " V" : null) +
        fila("Uso del canal", t.uso_canal != null ? numero(t.uso_canal, 1) + " %" : null) +
        fila("Uso del aire (transmisión)", t.uso_aire_tx != null ? numero(t.uso_aire_tx, 1) + " %" : null) +
        fila("Fecha", escapar(fechaLegible(fecha(t.fecha)))) + "</dl>");
    } else {
      h.push("<p>Este nodo no envió telemetría por MQTT.</p>");
    }

    h.push("<h3>Vecinos</h3>");
    if (n.vecinos && n.vecinos.length) {
      h.push("<ul class=\"detalle-lista\">" + n.vecinos.map(function (v) {
        var conocido = v.id && porId[v.id];
        var nombre = conocido
          ? '<button type="button" class="enlace-boton" data-nodo="' + escapar(v.id) + '">' + escapar(etiquetaId(v.id)) + "</button>"
          : escapar(etiquetaId(v.id));
        return "<li>" + nombre + " · SNR " + numero(v.snr, 1) + " dB</li>";
      }).join("") + "</ul>");
    } else {
      h.push("<p>Sin datos de vecinos.</p>");
    }

    h.push("<h3>Traceroute</h3>");
    var rutas = (datos.traceroutes || []).map(function (r, i) { return [r, i]; })
      .filter(function (par) { return par[0].origen === n.id || par[0].destino === n.id; });
    if (rutas.length) {
      h.push("<ul class=\"detalle-lista\">" + rutas.map(function (par) {
        var r = par[0];
        var camino = [r.origen].concat(r.ruta || [], [r.destino]).map(etiquetaId).map(escapar).join(" → ");
        var snr = (r.snr_ida || []).map(function (s) { return s == null ? "?" : numero(s, 1); }).join(" · ");
        var saltos = (r.ruta || []).length;
        return "<li><p>" + camino + "</p><p><small>" + (saltos === 0 ? "Directo" : saltos + (saltos === 1 ? " salto" : " saltos")) +
          (snr ? " · SNR por tramo (dB): " + snr : "") + " · " + escapar(fechaLegible(fecha(r.fecha))) + "</small></p>" +
          '<button type="button" class="boton-chico" data-ruta="' + par[1] + '">Mostrar en el mapa</button></li>';
      }).join("") + "</ul>");
    } else {
      h.push("<p>Sin traceroutes registrados para este nodo.</p>");
    }
    return h.join("");
  }

  function dibujarRuta(r) {
    capaRuta.clearLayers();
    var puntos = [r.origen].concat(r.ruta || [], [r.destino])
      .map(function (id) { return id && porId[id]; })
      .filter(Boolean)
      .map(function (n) { return [n.lat, n.lon]; });
    if (puntos.length < 2) return;
    L.polyline(puntos, { className: "linea-ruta", weight: 4 }).addTo(capaRuta);
    mapa.fitBounds(L.latLngBounds(puntos).pad(0.3));
  }

  el("mapa-detalle-cerrar").addEventListener("click", cerrarDetalle);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panelDetalle.hidden && panelDetalle.contains(document.activeElement)) cerrarDetalle();
  });
  function cerrarDetalle() {
    var id = seleccionado;
    panelDetalle.hidden = true;
    capaRuta.clearLayers();
    seleccionado = null;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* nada */ }
    var m = id && marcadores[id];
    if (m && m.getElement()) m.getElement().focus();
  }

  function seleccionarDesdeEnlace() {
    var coincide = /#nodo=([^&]+)/.exec(location.hash);
    if (coincide) seleccionar(decodeURIComponent(coincide[1]), false);
  }

  // ---- Lista accesible ----------------------------------------------------------------
  function dibujarLista() {
    var ref = fecha(datos.generado) || new Date();
    var filas = nodos.filter(visible).sort(function (a, b) { return nombreDe(a).localeCompare(nombreDe(b), "es"); });
    cuerpoLista.innerHTML = filas.map(function (n) {
      return "<tr><th scope=\"row\">" + escapar(nombreDe(n)) + "</th><td><code>" + escapar(n.id) + "</code></td><td>" +
        svgIcono(n._rol.grupo, n._inactivo, 16) + " " + escapar(n._rol.nombre) + "</td><td>" + escapar(n.provincia || "") +
        "</td><td>" + (n._inactivo ? "Inactivo" : "Activo") + "</td><td>" + escapar(haceCuanto(n._contacto, ref)) +
        '</td><td><button type="button" class="boton-chico" data-nodo="' + escapar(n.id) + '">Ver en el mapa</button></td></tr>';
    }).join("") || '<tr><td colspan="7">No hay nodos para mostrar con estos filtros.</td></tr>';
    cuerpoLista.querySelectorAll("[data-nodo]").forEach(function (b) {
      b.addEventListener("click", function () {
        seleccionar(b.getAttribute("data-nodo"), true);
        contenedor.scrollIntoView({ block: "center" });
      });
    });
  }

  // El tema oscuro oscurece las teselas con un filtro CSS (ver mapa.css).
  document.addEventListener("mm:tema", function () { mapa.invalidateSize(); });
})();
