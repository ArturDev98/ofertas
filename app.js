// Vista de Criba. El texto de las ofertas entra solo con textContent: es de terceros.
(function () {
  const subtle = window.crypto && window.crypto.subtle;
  const L = window.Logica;
  const C = window.Cripto;
  const G = window.gsap;
  const $ = (id) => document.getElementById(id);
  const MARCAS = [["interesa", "Star", "Me interesa", "S"], ["descartada", "X", "Descartar", "X"], ["aplique", "Check", "Apliqué", "A"]];
  const SELLOS = { interesa: "Me interesa", aplique: "Apliqué", descartada: "Descartada" };
  const ESTADOS = [["PASS", "Cumple"], ["FLAG", "Revisar"], ["FAIL", "Veto"]];
  const TRACKER = {
    drafted: "borrador", applied: "aplicada", interview: "entrevista", offer: "oferta recibida",
    hired: "contratado", rejected: "rechazada", no_response: "sin respuesta", withdrawn: "retirada",
  };
  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const angosto = matchMedia("(max-width: 860px)");
  const medio = matchMedia("(max-width: 1240px)");

  const leer = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const borrar = (k) => { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } };
  // Cada enlace guarda clave, marcas y filtros aparte: dos personas pueden usar el mismo navegador.
  const TOK = L.token(location.hash);
  const K = L.claves(TOK);
  const esTop = () => Boolean(datos && datos.modo === "top");

  let archivo = null;
  let datos = null;
  let marcas = leer(K.marcas) || {};
  let filtros = { ...L.FILTROS_DEFECTO, ...(leer(K.filtros) || {}) };
  let visitaAnterior = null;
  let seleccion = null;
  let respaldo = [];
  let visibles = [];
  let escena = null;
  let fondo = null;
  let emblema = null;
  let lienzoEmblema = null;
  let primeraVez = true;
  let previos = null;
  const contadores = {};

  function el(tag, props, ...hijos) {
    const n = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null) return;
      if (k === "texto") n.textContent = v;
      else if (k === "clase") n.className = v;
      else if (k === "estilo") Object.entries(v).forEach(([p, x]) => n.style.setProperty(p, x));
      else n.setAttribute(k, v);
    });
    hijos.flat().filter((h) => h != null && h !== false).forEach((h) => n.append(h));
    return n;
  }

  function icono(nombre) {
    const nodo = window.lucide && window.lucide[nombre];
    if (!nodo) return el("span", { clase: "icono", "aria-hidden": "true" });
    const svg = window.lucide.createElement(nodo);
    svg.setAttribute("class", "icono");
    svg.setAttribute("aria-hidden", "true");
    return svg;
  }

  function hidratarIconos(raiz = document) {
    raiz.querySelectorAll("i[data-icono]").forEach((i) => i.replaceWith(icono(i.dataset.icono)));
  }

  const url = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : null);
  const portal = (p) => String(p || "").replace(/-search$/, "");
  const hoy = () => L.marcaLocal(new Date()).slice(0, 10);
  const estado = (v) => (ESTADOS.find(([k]) => k === v) || [v, v || "Sin dato"])[1];

  const FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
  function fecha(iso) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(iso || "")) return null;
    return FECHA.format(new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)))).replace(".", "");
  }

  // three.js solo con WebGL y sin movimiento reducido; si algo falla, la página sigue con su versión plana.
  async function cargarEscena() {
    if (quieto) return null;
    if (!escena) {
      try {
        const m = await import("./escena.js");
        escena = m.hayWebGL() ? m : false;
      } catch (e) {
        escena = false;
      }
    }
    return escena || null;
  }

  async function inicio() {
    if (!subtle) return pedir("Este navegador no puede descifrar las ofertas. Abra la página con HTTPS.");
    if (L.hashMalo(location.hash)) return pedir("Este enlace no es válido. Pídale el suyo a quien lo invitó.");
    pedir("Cargando ofertas…", true);
    try {
      const r = await fetch(L.rutaDatos(TOK), { cache: "no-store" });
      if (TOK && r.status === 404) return pedir("Este enlace no es válido. Pídale el suyo a quien lo invitó.");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      archivo = await r.json();
    } catch (e) {
      return pedir(`No se pudieron cargar las ofertas (${e.message}). Recargue la página en unos minutos.`);
    }
    const guardada = leer(K.clave);
    if (L.clavePendiente(guardada, archivo) === "usar") {
      try {
        return mostrar(await C.abrir(archivo, await C.importar(guardada.raw, subtle), subtle), false);
      } catch (e) {
        borrar(K.clave);
      }
    } else if (guardada) {
      borrar(K.clave);
    }
    pedir("");
  }

  async function pedir(mensaje, informativo = false) {
    $("app").hidden = true;
    $("desbloqueo").hidden = false;
    $("error").textContent = mensaje;
    $("error").classList.toggle("info", informativo);
    $("frase").focus();
    if (!fondo) {
      const m = await cargarEscena();
      if (m && !fondo && !$("desbloqueo").hidden) {
        try {
          fondo = m.iniciarFondo($("fondo"));
          $("desbloqueo").classList.add("con-3d");
        } catch (e) { fondo = null; }
      }
    }
  }

  function avisarClave(mensaje) {
    $("error").classList.remove("info");
    $("error").textContent = mensaje;
    $("frase").setAttribute("aria-invalid", "true");
    $("frase").focus();
    if (G && !quieto) G.fromTo(".caja-clave", { x: -8 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" });
  }

  async function desbloquear(evento) {
    evento.preventDefault();
    if (!archivo) return;
    if (!$("frase").value) return avisarClave("Escriba la clave para abrir las ofertas.");
    $("abrir").disabled = true;
    $("error").textContent = "Abriendo…";
    $("error").classList.add("info");
    try {
      const clave = await C.derivar($("frase").value, archivo.sal, archivo.iter, subtle);
      const claro = await C.abrir(archivo, clave, subtle);
      if ($("recordar").checked) guardar(K.clave, { sal: archivo.sal, raw: await C.exportar(clave, subtle) });
      $("frase").value = "";
      $("error").textContent = "";
      await mostrar(claro, true);
    } catch (e) {
      avisarClave("La clave no es correcta. Revísela e intente de nuevo.");
    } finally {
      $("abrir").disabled = false;
    }
  }

  async function mostrar(claro, conEntrada) {
    datos = claro;
    visitaAnterior = leer(K.visita);
    guardar(K.visita, L.marcaLocal(new Date()));
    if (conEntrada && G && !quieto) {
      const caida = fondo ? fondo.soltar() : Promise.resolve();
      G.to(".caja-clave", { y: 24, opacity: 0, scale: 0.97, duration: 0.45, ease: "power3.in" });
      await caida;
    }
    if (fondo) { fondo.detener(); fondo = null; $("desbloqueo").classList.remove("con-3d"); }
    $("desbloqueo").hidden = true;
    G && G.set(".caja-clave", { clearProps: "all" });
    $("app").hidden = false;
    // Un top ya viene recortado: sin malla ni bandeja, y con todos los filtros abiertos.
    if (esTop()) filtros = { ...L.FILTROS_TODAS };
    $("titulo-lista").textContent = esTop() ? "Su top 10" : "Ordenadas por puntaje";
    $("campo-minimo").hidden = esTop();
    const generado = String(datos.generado || "");
    $("generado").textContent = generado ? `Actualizado el ${fecha(generado) || generado.slice(0, 10)} a las ${generado.slice(11, 16)}` : "";
    primeraVez = true;
    armarFiltros();
    pintar();
    if (conEntrada && G && !quieto) {
      G.from(".barra", { y: -16, opacity: 0, duration: 0.5, ease: "power3.out", clearProps: "transform,opacity" });
      G.from(".detalle", { x: 36, opacity: 0, duration: 0.6, delay: 0.08, ease: "power3.out", clearProps: "transform,opacity" });
    }
    if (!angosto.matches) $("lista").focus({ preventScroll: true });
  }

  function chips(contenedor, valores, elegidos, etiqueta, alCambiar, clase) {
    contenedor.replaceChildren(...valores.map((v) => {
      const b = el("button", { type: "button", clase: `chip ${clase(v)}`, "aria-pressed": String(elegidos.includes(v)), texto: etiqueta(v) });
      b.addEventListener("click", () => {
        const activo = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", String(activo));
        alCambiar(v, activo);
      });
      return b;
    }));
  }

  function chipsUnico(contenedor, opciones, actual, alCambiar) {
    contenedor.setAttribute("role", "radiogroup");
    contenedor.replaceChildren(...opciones.map(([valor, texto, clase]) => {
      const b = el("button", { type: "button", role: "radio", clase: `chip sin-grano ${clase || ""}`, "aria-checked": String(valor === actual), texto });
      b.addEventListener("click", () => {
        contenedor.querySelectorAll("[role=radio]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        alCambiar(valor);
      });
      return b;
    }));
  }

  const alternar = (lista, valor, activo) => (activo ? [...new Set([...lista, valor])] : lista.filter((x) => x !== valor));

  function armarFiltros() {
    const ofertas = datos.ofertas || [];
    const orden = ["Strong Fit", "Good Fit", "Moderate Fit"];
    const veredictos = [...new Set(ofertas.map((o) => o.rank_verdict).filter(Boolean))]
      .sort((a, b) => (orden.indexOf(a) + 1 || 9) - (orden.indexOf(b) + 1 || 9));
    const portales = [...new Set(ofertas.map((o) => o.portal).filter(Boolean))].sort();
    const cambiar = (campo) => (v, activo) => { filtros[campo] = alternar(filtros[campo], v, activo); aplicar(); };
    const claseEstado = (v) => String(v).toLowerCase();
    chips($("f-veredictos"), veredictos, filtros.veredictos, (v) => v.replace(" Fit", ""), cambiar("veredictos"), L.tono);
    chips($("f-portales"), portales, filtros.portales, portal, cambiar("portales"), (v) => `sin-grano portal portal-${portal(v)}`);
    // Un top ya viene sin vetadas, y el tracker es solo de Arturo: ninguno de los dos aplica ahí.
    const estados = ESTADOS.map(([k]) => k).filter((k) => !esTop() || k !== "FAIL");
    chips($("f-ubicacion"), estados, filtros.ubicacion, estado, cambiar("ubicacion"), claseEstado);
    chips($("f-idioma"), estados, filtros.idioma, estado, cambiar("idioma"), claseEstado);
    $("f-texto").value = filtros.texto;
    ponerMinimo(filtros.minimo);
    chipsUnico($("f-cierra"), [[null, "Cualquier fecha"], [3, "3 días"], [7, "7 días"], [14, "14 días"], [30, "30 días"]],
      filtros.cierraEn ?? null, (v) => { filtros.cierraEn = v; aplicar(); });
    chipsUnico($("f-marca"), [[null, "Todas"], ["interesa", "Me interesa", "m-interesa"], ["aplique", "Apliqué", "m-aplique"],
      ["descartada", "Descartadas", "m-descartada"]], filtros.marca || null, (v) => { filtros.marca = v; aplicar(); });
    $("f-ocultar-descartadas").checked = filtros.ocultarDescartadas;
    $("f-ocultar-tracker").checked = filtros.ocultarTracker;
    $("f-ocultar-tracker").closest("label").hidden = esTop();
  }

  function ponerMinimo(valor) {
    $("f-minimo").value = valor;
    $("f-minimo").style.setProperty("--v", `${valor}%`);
    $("f-minimo-valor").textContent = valor;
  }

  function aplicar() {
    previos = null;
    guardar(K.filtros, filtros);
    pintar();
  }

  function contar(id, n) {
    const nodo = $(id);
    const desde = contadores[id] ?? 0;
    contadores[id] = n;
    if (!G || quieto || desde === n) { nodo.textContent = n; return; }
    const o = { v: desde };
    G.to(o, { v: n, duration: 0.7, ease: "power3.out", overwrite: true, onUpdate: () => { nodo.textContent = Math.round(o.v); } });
  }

  function pintarBarra(todas) {
    const reparto = L.reparto(visibles);
    $("reparto-barra").replaceChildren(...reparto.map(([t, , n]) => el("b", { clase: t, estilo: { "flex-grow": String(n) } })));
    $("reparto-leyenda").replaceChildren(...reparto.map(([t, v, n]) => el("span", { clase: t }, el("b", { texto: String(n) }), v)));
    const c = L.cifras(visibles, hoy(), visitaAnterior);
    contar("c-visibles", visibles.length);
    $("c-total").textContent = `de ${todas.length}`;
    contar("c-cierran", c.cierran);
    contar("c-nuevas", c.nuevas);
  }

  function pintar() {
    const todas = datos.ofertas || [];
    visibles = L.filtrar(todas, filtros, marcas, hoy());
    pintarBarra(todas);
    const fuera = L.ocultas(todas, filtros, marcas, hoy());
    const nFuera = fuera.reduce((s, [, n]) => s + n, 0);
    pintarBandeja(todas, fuera, nFuera);
    $("umbral").hidden = esTop() || !visibles.length || !filtros.minimo;
    $("umbral").textContent = `Malla en ${filtros.minimo} · lo de abajo cae a la bandeja`;
    $("vacio").hidden = visibles.length > 0;
    $("lista").hidden = visibles.length === 0;
    if (!visibles.some((o) => o.key === seleccion)) {
      const vecina = respaldo.find((k) => visibles.some((o) => o.key === k));
      seleccion = vecina || (visibles.length ? visibles[0].key : null);
    }
    respaldo = [];
    $("lista").replaceChildren(...visibles.map((o, i) => fila(o, i)));
    $("lista").setAttribute("aria-activedescendant", seleccion ? idFila(seleccion) : "");
    detalle();
    if (primeraVez && G && !quieto) {
      G.from("#lista .fila:nth-child(-n+14)", { y: 10, opacity: 0, duration: 0.45, stagger: 0.025, ease: "power3.out", clearProps: "transform,opacity" });
    }
    primeraVez = false;
  }

  // Con todo a la vista, la bandeja ofrece volver a los filtros de antes (o a los de defecto tras recargar).
  function pintarBandeja(todas, fuera, nFuera) {
    const base = previos || L.FILTROS_DEFECTO;
    const nBase = nFuera ? 0 : L.ocultas(todas, base, marcas, hoy()).reduce((s, [, n]) => s + n, 0);
    const abierta = nFuera === 0 && nBase > 0;
    $("bandeja").hidden = esTop() || (nFuera === 0 && !abierta);
    $("bandeja").classList.toggle("abierta", abierta);
    const boton = $("mostrar-todas");
    boton.dataset.modo = abierta ? "ocultar" : "mostrar";
    if (abierta) {
      $("bandeja-total").textContent = "Está viendo todas las ofertas.";
      $("bandeja-motivos").textContent = `Con ${previos ? "sus filtros" : "los filtros por defecto"}, ${nBase} ${nBase === 1 ? "caería" : "caerían"} a la bandeja.`;
      boton.replaceChildren(icono("EyeOff"), el("span", { texto: "Ocultar las que caen" }));
    } else {
      $("bandeja-total").textContent = `${nFuera} ${nFuera === 1 ? "cayó" : "cayeron"} por la criba:`;
      $("bandeja-motivos").textContent = fuera.map(([m, n]) => `${n} ${m}`).join(" · ");
      boton.replaceChildren(icono("Eye"), el("span", { texto: "Mostrar todas" }));
    }
  }

  const idFila = (clave) => `o-${visibles.findIndex((o) => o.key === clave)}`;

  function datosFila(o) {
    const partes = [];
    if (L.esNueva(o, visitaAnterior)) partes.push(el("span", { clase: "nueva", texto: "Nueva" }));
    if (o.company) partes.push(el("span", { texto: o.company }));
    partes.push(el("span", { texto: o.location || "Sin ubicación" }));
    const alertas = L.alertas(o, hoy());
    const cierre = alertas.find((a) => a.startsWith("🔥"));
    if (cierre) partes.push(el("span", { clase: "pronto", texto: cierre.replace(/^🔥\s*/u, "") }));
    alertas.filter((a) => a.startsWith("⛔")).forEach((a) => partes.push(el("span", { clase: "vetado", texto: a.replace(/^⛔\s*/u, "") })));
    if (o.tracker) partes.push(el("span", { texto: `En el tracker: ${TRACKER[o.tracker] || o.tracker}` }));
    return partes;
  }

  function perforado(puntaje) {
    const llenos = L.granos(puntaje);
    return el("span", { clase: "perforado", "aria-hidden": "true" },
      Array.from({ length: 10 }, (_, i) => el("i", { clase: i < llenos ? "lleno" : null })));
  }

  function fila(o, i) {
    const marca = marcas[o.key];
    const li = el("li", {
      id: `o-${i}`, role: "option", "aria-selected": String(o.key === seleccion),
      clase: `fila ${L.tono(o.rank_verdict)}${marca === "descartada" ? " descartada" : ""}`,
    },
    el("span", { clase: "puntos", texto: String(o.rank_score ?? "–") }),
    perforado(o.rank_score),
    el("span", { clase: "fila-texto" },
      el("span", { clase: "fila-titulo", texto: o.title || "(sin título)" }),
      el("span", { clase: "fila-datos" }, datosFila(o))),
    marca ? el("span", { clase: `sello ${marca}`, texto: SELLOS[marca] }) : el("span"));
    li.addEventListener("click", () => {
      elegir(o.key);
      if (angosto.matches) abrirDetalle();
    });
    return li;
  }

  function elegir(clave, desplazar = false) {
    if (!clave || clave === seleccion) return;
    seleccion = clave;
    $("lista").querySelectorAll(".fila").forEach((f, i) => f.setAttribute("aria-selected", String(visibles[i].key === clave)));
    $("lista").setAttribute("aria-activedescendant", idFila(clave));
    if (desplazar) $(idFila(clave))?.scrollIntoView({ block: "nearest" });
    detalle();
  }

  function hecho(etiqueta, valor, clase, ico) {
    return el("div", {}, el("dt", { texto: etiqueta }), el("dd", { clase }, ico ? icono(ico) : null, el("span", { texto: valor })));
  }

  function hechos(o) {
    const h = hoy();
    let cierre = "Sin fecha límite";
    let claseCierre = null;
    if (o.deadline) {
      const d = L.dias(h, o.deadline);
      cierre = d < 0 ? `Cerró el ${fecha(o.deadline)}` : d === 0 ? "Cierra hoy" : `${fecha(o.deadline)} · en ${d} día${d === 1 ? "" : "s"}`;
      if (d >= 0 && d <= 7) claseCierre = "pronto";
    }
    let publicada = "Sin fecha";
    if (o.posted_date) {
      const d = L.dias(o.posted_date, h);
      publicada = `${fecha(o.posted_date)}${d > 0 ? ` · hace ${d} día${d === 1 ? "" : "s"}` : ""}`;
    }
    const icoEstado = { PASS: "CircleCheck", FLAG: "TriangleAlert", FAIL: "Ban" };
    const claseEstado = (v) => (v ? v.toLowerCase() : null);
    return el("dl", { clase: "hechos" },
      hecho("Cierre", cierre, claseCierre, "Calendar"),
      hecho("Publicada", publicada, null, "Clock"),
      hecho("Portal", portal(o.portal) || "Sin dato", null, "Globe"),
      hecho("Ubicación", estado(o.location_verdict), claseEstado(o.location_verdict), icoEstado[o.location_verdict] || "MapPin"),
      hecho("Idioma", estado(o.language_gate), claseEstado(o.language_gate), icoEstado[o.language_gate] || "Languages"),
      esTop() ? null : hecho("Tracker", o.tracker ? TRACKER[o.tracker] || o.tracker : "No está", null, "Inbox"));
  }

  function avisos(o) {
    const lista = L.alertas(o, hoy()).filter((a) => !a.startsWith("🔥"));
    if (!lista.length) return null;
    // Los textos de logica.js traen un símbolo inicial; aquí lo reemplaza un ícono de lucide.
    return el("ul", { clase: "avisos" }, lista.map((a) => {
      const veto = a.startsWith("⛔");
      const texto = a.replace(/^[⛔⚠]️?\s*/u, "");
      return el("li", { clase: veto ? "veto" : null }, icono(veto ? "Ban" : "TriangleAlert"),
        el("span", { texto: texto.charAt(0).toUpperCase() + texto.slice(1) }));
    }));
  }

  function granos(clase, titulo, items) {
    if (!items || !items.length) return null;
    return el("section", { clase: `granos ${clase}` },
      el("h3", {}, titulo, el("span", { texto: String(items.length) })),
      el("ul", {}, items.map((t) => el("li", { texto: t }))));
  }

  // El dato no trae la web de la empresa: se ofrece buscarla. noreferrer no deja ver de dónde viene.
  function enlacesEmpresa(nombre) {
    if (!nombre) return null;
    const enlace = (href, ico, texto, tip) => el("a", { clase: "enlace-empresa", href, target: "_blank", rel: "noopener noreferrer", "data-tip": tip },
      icono(ico), el("span", { texto }), icono("ArrowUpRight"));
    return el("div", { clase: "enlaces-empresa" },
      enlace(`https://duckduckgo.com/?q=${encodeURIComponent(`!ducky ${nombre}`)}`, "Building2", "Web de la empresa",
        `Abre el primer resultado al buscar «${nombre}»`),
      enlace(`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(nombre)}`, "Linkedin", "En LinkedIn",
        "Busca la página de la empresa en LinkedIn"));
  }

  function botonesMarca(o) {
    return MARCAS.map(([valor, ico, titulo, tecla]) => {
      const b = el("button", { type: "button", clase: "marca-boton", "data-marca": valor, "data-tip": titulo, "data-tecla": tecla,
        "aria-keyshortcuts": tecla, "aria-pressed": String(marcas[o.key] === valor) }, icono(ico), el("span", { texto: titulo }));
      b.addEventListener("click", () => marcar(o.key, valor));
      return b;
    });
  }

  function detalle() {
    const panel = $("detalle");
    const o = visibles.find((x) => x.key === seleccion);
    if (!o) {
      panel.className = "detalle otro";
      panel.replaceChildren(el("div", { clase: "detalle-vacio" },
        el("svg"), el("p", { texto: "Nada que revisar con estos filtros." }),
        el("p", { texto: "Cuando una oferta pase la malla, aquí verá por qué quedó arriba." })));
      panel.querySelector(".detalle-vacio svg").replaceWith(document.querySelector(".marca .sello-criba").cloneNode(true));
      cerrarDetalle();
      return;
    }
    const tono = L.tono(o.rank_verdict);
    const puesto = visibles.indexOf(o) + 1;
    panel.className = `detalle ${tono}${panel.classList.contains("abierto") ? " abierto" : ""}`;
    const caja = el("div", { clase: "emblema" }, el("div", { clase: "emblema-plano" }));
    const enlace = url(o.url)
      ? el("a", { clase: "boton-oro", href: url(o.url), target: "_blank", rel: "noopener noreferrer" }, "Ver oferta", icono("ExternalLink"))
      : null;
    const cerrar = el("button", { type: "button", clase: "boton-marco detalle-cerrar", "aria-label": "Cerrar detalle" }, icono("X"));
    cerrar.addEventListener("click", cerrarDetalle);
    const lugar = [o.company ? el("strong", { texto: o.company }) : null, o.location ? ` · ${o.location}` : null];
    const scroll = el("div", { clase: "detalle-scroll" },
      el("div", { clase: "cabeza-detalle" },
        caja,
        el("div", {},
          el("div", { clase: "marcador-grande", texto: String(o.rank_score ?? "–") }),
          el("div", { clase: "veredicto-grande" },
            el("strong", { texto: o.rank_verdict || "Sin veredicto" }),
            el("span", { texto: `Puesto ${puesto} de ${visibles.length}` })))),
      el("div", { clase: "titulo-detalle" }, el("h2", { texto: o.title || "(sin título)" }), el("p", {}, lugar), enlacesEmpresa(o.company)),
      hechos(o),
      avisos(o),
      granos("fortalezas", "Fortalezas", o.strengths),
      granos("brechas", "Brechas", o.gaps));
    panel.replaceChildren(cerrar, conIndicador(scroll), el("div", { clase: "detalle-pie" }, botonesMarca(o), enlace));
    pintarEmblema(caja, o, tono);
    if (G && !quieto && !primeraVez) {
      G.from(scroll.children, { y: 8, opacity: 0, duration: 0.35, stagger: 0.035, ease: "power3.out", clearProps: "transform,opacity" });
    }
  }

  // En pantallas bajas el scroll del detalle pasa inadvertido: un "Ver más" avisa que hay contenido abajo.
  let observador = null;
  function conIndicador(scroll) {
    const boton = el("button", { type: "button", clase: "ver-mas", "aria-label": "Ver más del detalle" },
      el("span", { texto: "Ver más" }), icono("ChevronDown"));
    const cuerpo = el("div", { clase: "detalle-cuerpo" }, scroll, boton);
    const revisar = () => cuerpo.classList.toggle("hay-mas", scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop > 24);
    boton.addEventListener("click", () => scroll.scrollBy({ top: scroll.clientHeight * 0.75, behavior: quieto ? "auto" : "smooth" }));
    scroll.addEventListener("scroll", revisar, { passive: true });
    if (observador) observador.disconnect();
    observador = new ResizeObserver(revisar);
    observador.observe(scroll);
    requestAnimationFrame(revisar);
    return cuerpo;
  }

  async function pintarEmblema(caja, o) {
    const m = await cargarEscena();
    if (!m || !caja.isConnected) return;
    try {
      if (!emblema) {
        lienzoEmblema = el("canvas", { "aria-hidden": "true" });
        caja.append(lienzoEmblema);
        emblema = m.emblema(lienzoEmblema);
      } else {
        caja.append(lienzoEmblema);
      }
      caja.classList.add("con-3d");
      emblema.mostrar(o.rank_score, getComputedStyle($("detalle")).getPropertyValue("--c").trim());
    } catch (e) {
      emblema = null;
    }
  }

  function marcar(clave, valor) {
    if (marcas[clave] === valor) delete marcas[clave];
    else marcas[clave] = valor;
    guardar(K.marcas, marcas);
    const antes = seleccion;
    // Si la marca saca la oferta de la lista, la selección pasa a la vecina y no salta al inicio.
    const claves = visibles.map((o) => o.key);
    respaldo = [L.vecino(claves, clave, 1), L.vecino(claves, clave, -1)];
    pintar();
    const sello = $("lista").querySelector(`[aria-selected=true] .sello`);
    if (sello && G && !quieto && seleccion === antes) {
      G.from(sello, { scale: 1.8, opacity: 0, rotation: -14, duration: 0.42, ease: "back.out(2.2)" });
    }
  }

  function restablecer(base = L.FILTROS_DEFECTO, antes = null) {
    filtros = { ...base };
    armarFiltros();
    aplicar();
    previos = antes;
    if (antes) pintar();
  }

  function abrirDetalle() {
    $("detalle").classList.add("abierto");
  }

  function cerrarDetalle() {
    if (!$("detalle").classList.contains("abierto")) return;
    $("detalle").classList.remove("abierto");
    $("lista").focus({ preventScroll: true });
  }

  function abrirFiltros(abrir) {
    $("filtros").classList.toggle("abierto", abrir);
    $("velo").hidden = !abrir;
    $("ver-filtros").setAttribute("aria-expanded", String(abrir));
    if (abrir) $("f-texto").focus({ preventScroll: true });
  }

  function temaActual() {
    const fijo = document.documentElement.dataset.theme;
    if (fijo) return fijo;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function pintarBotonTema() {
    const oscuro = temaActual() === "dark";
    $("tema").replaceChildren(icono(oscuro ? "Sun" : "Moon"));
    $("tema").setAttribute("aria-label", oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
    $("tema").dataset.tip = oscuro ? "Pasar a tema claro" : "Pasar a tema oscuro";
  }

  function teclado(ev) {
    if ($("app").hidden || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const escribiendo = /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName);
    if (ev.key === "Escape") {
      ocultarTip();
      if ($("filtros").classList.contains("abierto")) abrirFiltros(false);
      else if ($("detalle").classList.contains("abierto")) cerrarDetalle();
      else if (escribiendo) ev.target.blur();
      return;
    }
    if (escribiendo || ev.target.closest?.("a, button")) {
      if (!(ev.target.closest?.("button") && /^[sxa]$/i.test(ev.key))) return;
    }
    const claves = visibles.map((o) => o.key);
    const tecla = ev.key.toLowerCase();
    if (tecla === "arrowdown" || tecla === "j") elegir(L.vecino(claves, seleccion, 1), true);
    else if (tecla === "arrowup" || tecla === "k") elegir(L.vecino(claves, seleccion, -1), true);
    else if (tecla === "home") elegir(claves[0], true);
    else if (tecla === "end") elegir(claves[claves.length - 1], true);
    else if (tecla === "enter" && angosto.matches && seleccion) abrirDetalle();
    else if (tecla === "s" && seleccion) marcar(seleccion, "interesa");
    else if (tecla === "x" && seleccion) marcar(seleccion, "descartada");
    else if (tecla === "a" && seleccion) marcar(seleccion, "aplique");
    else return;
    ev.preventDefault();
  }

  // Tooltip propio: el title del navegador no se puede estilizar y no sale con el teclado.
  let tipActual = null;
  function mostrarTip(b) {
    const tip = $("tip");
    tipActual = b;
    tip.replaceChildren(b.dataset.tip, b.dataset.tecla ? el("kbd", { texto: b.dataset.tecla }) : "");
    tip.hidden = false;
    const r = b.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const arriba = r.top - t.height - 10 > 6;
    const x = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), innerWidth - t.width - 8);
    tip.style.left = `${x}px`;
    tip.style.top = `${arriba ? r.top - t.height - 10 : r.bottom + 10}px`;
    tip.style.setProperty("--x", `${r.left + r.width / 2 - x}px`);
    tip.dataset.lado = arriba ? "arriba" : "abajo";
  }
  function ocultarTip() {
    $("tip").hidden = true;
    tipActual = null;
  }
  function conectarTips() {
    document.addEventListener("pointerover", (e) => {
      if (e.pointerType === "touch") return;
      const b = e.target.closest?.("[data-tip]");
      if (b && b !== tipActual) mostrarTip(b);
      else if (!b && tipActual) ocultarTip();
    });
    document.addEventListener("focusin", (e) => {
      const b = e.target.closest?.("[data-tip]");
      if (b && b.matches(":focus-visible")) mostrarTip(b);
      else if (tipActual) ocultarTip();
    });
    document.addEventListener("focusout", ocultarTip);
    document.addEventListener("click", ocultarTip);
    document.addEventListener("scroll", ocultarTip, true);
    addEventListener("resize", ocultarTip);
  }

  function conectar() {
    hidratarIconos();
    pintarBotonTema();
    $("form-clave").addEventListener("submit", desbloquear);
    $("f-texto").addEventListener("input", (e) => { filtros.texto = e.target.value; aplicar(); });
    $("f-minimo").addEventListener("input", (e) => {
      filtros.minimo = Number(e.target.value);
      ponerMinimo(filtros.minimo);
      aplicar();
    });
    // La zaranda se sacude al soltar la malla: el movimiento dice que el filtro ya se aplicó.
    $("f-minimo").addEventListener("change", () => {
      if (G && !quieto) G.fromTo(["#umbral", "#bandeja"], { x: -5 }, { x: 0, duration: 0.6, ease: "elastic.out(1.1, 0.25)" });
    });
    $("f-ocultar-descartadas").addEventListener("change", (e) => { filtros.ocultarDescartadas = e.target.checked; aplicar(); });
    $("f-ocultar-tracker").addEventListener("change", (e) => { filtros.ocultarTracker = e.target.checked; aplicar(); });
    $("restablecer").addEventListener("click", () => restablecer());
    $("vacio-restablecer").addEventListener("click", () => restablecer());
    $("mostrar-todas").addEventListener("click", (e) => {
      if (e.currentTarget.dataset.modo === "ocultar") restablecer(previos || L.FILTROS_DEFECTO);
      else restablecer(L.FILTROS_TODAS, { ...filtros });
    });
    $("frase").addEventListener("input", () => $("frase").removeAttribute("aria-invalid"));
    $("bloquear").addEventListener("click", () => {
      const habiaClave = leer(K.clave) != null;
      borrar(K.clave);
      datos = null;
      seleccion = null;
      Object.keys(contadores).forEach((k) => delete contadores[k]);
      cerrarDetalle();
      abrirFiltros(false);
      pedir(habiaClave
        ? "Bloqueó la página y borró la clave guardada en este navegador. La próxima vez se la pediremos."
        : "Bloqueó la página. Escriba su clave para volver a abrirla.", true);
    });
    $("ver-filtros").addEventListener("click", () => abrirFiltros(!$("filtros").classList.contains("abierto")));
    $("cerrar-filtros").addEventListener("click", () => abrirFiltros(false));
    $("velo").addEventListener("click", () => abrirFiltros(false));
    medio.addEventListener("change", () => abrirFiltros(false));
    $("tema").addEventListener("click", () => {
      const nuevo = temaActual() === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = nuevo;
      guardar("criba.tema", nuevo === "dark" ? "oscuro" : "claro");
      pintarBotonTema();
      if (G && !quieto) G.from("#tema .icono", { rotation: -120, scale: 0.4, duration: 0.5, ease: "back.out(2)" });
    });
    conectarTips();
    document.addEventListener("keydown", teclado);
  }

  conectar();
  // Otro token en la misma pestaña es otra persona: se recarga para no mezclar su estado.
  window.addEventListener("hashchange", () => location.reload());
  inicio();
})();
