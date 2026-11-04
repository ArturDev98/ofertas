// Vista de la web de ofertas. El texto de las ofertas entra solo con textContent: es de terceros.
(function () {
  const subtle = window.crypto && window.crypto.subtle;
  const L = window.Logica;
  const C = window.Cripto;
  const $ = (id) => document.getElementById(id);
  const SVG = "http://www.w3.org/2000/svg";
  const MARCAS = [["interesa", "estrella", "Me interesa"], ["descartada", "x", "Descartada"], ["aplique", "check", "Apliqué"]];
  const ESTADOS = [["PASS", "Cumple"], ["FLAG", "Revisar"], ["FAIL", "Veto"]];
  const TRACKER = {
    drafted: "borrador", applied: "aplicada", interview: "entrevista", offer: "oferta recibida",
    hired: "contratado", rejected: "rechazada", no_response: "sin respuesta", withdrawn: "retirada",
  };
  const VISIBLES = 2;

  // Trazos propios, mismo grosor en todos; se arman con createElementNS, nunca con HTML.
  const ICONOS = {
    lugar: [["path", { d: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" }], ["circle", { cx: 12, cy: 10, r: 2.5 }]],
    fecha: [["rect", { x: 3, y: 5, width: 18, height: 16, rx: 2 }], ["path", { d: "M3 10h18M8 3v4M16 3v4" }]],
    reloj: [["circle", { cx: 12, cy: 12, r: 9 }], ["path", { d: "M12 7v5l3 2" }]],
    alerta: [["path", { d: "M12 3.5 21.5 20h-19z" }], ["path", { d: "M12 10v4M12 17h.01" }]],
    veto: [["circle", { cx: 12, cy: 12, r: 9 }], ["path", { d: "M5.6 5.6l12.8 12.8" }]],
    bien: [["circle", { cx: 12, cy: 12, r: 9 }], ["path", { d: "M8 12.5l2.7 2.7L16 9.5" }]],
    brecha: [["circle", { cx: 12, cy: 12, r: 9 }], ["path", { d: "M8 12h8" }]],
    estrella: [["path", { d: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z" }]],
    x: [["path", { d: "M6 6l12 12M18 6 6 18" }]],
    check: [["path", { d: "M5 12.5l4.5 4.5L19 7" }]],
    externo: [["path", { d: "M14 4h6v6M20 4l-9 9" }], ["path", { d: "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" }]],
  };

  const leer = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const borrar = (k) => { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } };

  let archivo = null;
  let datos = null;
  let marcas = leer("ofertas.marcas") || {};
  let filtros = { ...L.FILTROS_DEFECTO, ...(leer("ofertas.filtros") || {}) };
  let visitaAnterior = null;

  function el(tag, props, ...hijos) {
    const n = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === "texto") n.textContent = v;
      else if (k === "clase") n.className = v;
      else if (k === "estilo") Object.entries(v).forEach(([p, x]) => n.style.setProperty(p, x));
      else n.setAttribute(k, v);
    });
    hijos.flat().filter(Boolean).forEach((h) => n.append(h));
    return n;
  }

  function icono(nombre) {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "icono");
    svg.setAttribute("aria-hidden", "true");
    (ICONOS[nombre] || []).forEach(([tag, attrs]) => {
      const parte = document.createElementNS(SVG, tag);
      Object.entries(attrs).forEach(([k, v]) => parte.setAttribute(k, v));
      svg.append(parte);
    });
    return svg;
  }

  const url = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : null);
  const portal = (p) => String(p || "").replace(/-search$/, "");
  const hoy = () => L.marcaLocal(new Date()).slice(0, 10);

  async function inicio() {
    if (!subtle) return pedir("Este navegador no permite descifrar (se necesita HTTPS).");
    pedir("Cargando…", true);
    try {
      const r = await fetch("datos.json", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      archivo = await r.json();
    } catch (e) {
      return pedir(`No se pudo cargar datos.json (${e.message}).`);
    }
    const guardada = leer("ofertas.clave");
    if (L.clavePendiente(guardada, archivo) === "usar") {
      try {
        return mostrar(await C.abrir(archivo, await C.importar(guardada.raw, subtle), subtle));
      } catch (e) {
        borrar("ofertas.clave");
      }
    } else if (guardada) {
      borrar("ofertas.clave");
    }
    pedir("");
  }

  function pedir(mensaje, informativo = false) {
    $("app").hidden = true;
    $("desbloqueo").hidden = false;
    $("error").textContent = mensaje;
    $("error").classList.toggle("info", informativo);
    $("frase").focus();
  }

  async function desbloquear(evento) {
    evento.preventDefault();
    if (!archivo) return;
    $("abrir").disabled = true;
    $("error").textContent = "Abriendo…";
    $("error").classList.add("info");
    try {
      const clave = await C.derivar($("frase").value, archivo.sal, archivo.iter, subtle);
      const claro = await C.abrir(archivo, clave, subtle);
      if ($("recordar").checked) guardar("ofertas.clave", { sal: archivo.sal, raw: await C.exportar(clave, subtle) });
      $("frase").value = "";
      mostrar(claro);
    } catch (e) {
      $("error").classList.remove("info");
      $("error").textContent = "Clave incorrecta";
    } finally {
      $("abrir").disabled = false;
    }
  }

  function mostrar(claro) {
    datos = claro;
    visitaAnterior = leer("ofertas.visita");
    guardar("ofertas.visita", L.marcaLocal(new Date()));
    $("desbloqueo").hidden = true;
    $("app").hidden = false;
    $("generado").textContent = `Actualizado el ${String(datos.generado || "").replace("T", " a las ")}`;
    armarFiltros();
    pintar();
  }

  function chips(contenedor, valores, elegidos, etiqueta, alCambiar, color) {
    contenedor.replaceChildren(...valores.map((v) => {
      const b = el("button", { type: "button", clase: "chip", "aria-pressed": String(elegidos.includes(v)), texto: etiqueta(v) });
      if (color) b.style.setProperty("--c", color(v));
      b.addEventListener("click", () => {
        const activo = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", String(activo));
        alCambiar(v, activo);
      });
      return b;
    }));
  }

  function alternar(lista, valor, activo) {
    return activo ? [...new Set([...lista, valor])] : lista.filter((x) => x !== valor);
  }

  function armarFiltros() {
    const ofertas = datos.ofertas || [];
    const veredictos = [...new Set(ofertas.map((o) => o.rank_verdict).filter(Boolean))];
    const portales = [...new Set(ofertas.map((o) => o.portal).filter(Boolean))].sort();
    const estado = (v) => (ESTADOS.find(([k]) => k === v) || [v, v])[1];
    const cambiar = (campo) => (v, activo) => { filtros[campo] = alternar(filtros[campo], v, activo); aplicar(); };
    const colorEstado = (v) => ({ PASS: "var(--verde)", FLAG: "var(--ambar)", FAIL: "var(--rojo)" }[v]);
    chips($("f-veredictos"), veredictos, filtros.veredictos, (v) => v, cambiar("veredictos"), L.color);
    chips($("f-portales"), portales, filtros.portales, portal, cambiar("portales"));
    chips($("f-ubicacion"), ESTADOS.map(([k]) => k), filtros.ubicacion, estado, cambiar("ubicacion"), colorEstado);
    chips($("f-idioma"), ESTADOS.map(([k]) => k), filtros.idioma, estado, cambiar("idioma"), colorEstado);
    $("f-texto").value = filtros.texto;
    $("f-minimo").value = filtros.minimo;
    $("f-minimo-valor").textContent = filtros.minimo;
    $("f-cierra").value = filtros.cierraEn == null ? "" : String(filtros.cierraEn);
    $("f-marca").value = filtros.marca || "";
    $("f-ocultar-descartadas").checked = filtros.ocultarDescartadas;
    $("f-ocultar-tracker").checked = filtros.ocultarTracker;
  }

  function aplicar() {
    guardar("ofertas.filtros", filtros);
    pintar();
  }

  function pintar() {
    const todas = datos.ofertas || [];
    const visibles = L.filtrar(todas, filtros, marcas, hoy());
    $("contador").textContent = `${visibles.length} de ${todas.length} ofertas`;
    const porVeredicto = {};
    visibles.forEach((o) => { porVeredicto[o.rank_verdict] = (porVeredicto[o.rank_verdict] || 0) + 1; });
    $("resumen").replaceChildren(...Object.entries(porVeredicto).map(([v, n]) =>
      el("span", { estilo: { "--c": L.color(v) }, texto: `${n} ${v}` })));
    const fuera = L.ocultas(todas, filtros, marcas, hoy());
    const nFuera = fuera.reduce((s, [, n]) => s + n, 0);
    $("ocultas").hidden = nFuera === 0;
    $("ocultas-texto").textContent = `${nFuera} oculta${nFuera === 1 ? "" : "s"} por los filtros: ` +
      fuera.map(([m, n]) => `${n} ${m}`).join(" · ");
    $("vacio").hidden = visibles.length > 0;
    $("lista").replaceChildren(...visibles.map((o) => tarjeta(o, todas.indexOf(o) + 1)));
  }

  function puntos(o) {
    const contenedor = el("div", { clase: "puntos" });
    const seccion = (clase, titulo, ico, items) => {
      if (!items || !items.length) return null;
      return el("div", { clase: `seccion ${clase}` },
        el("h3", {}, icono(ico), titulo),
        el("ul", {}, items.map((t, i) => el("li", { clase: i >= VISIBLES ? "extra" : "", texto: t }))));
    };
    const fortalezas = seccion("fortalezas", "Fortalezas", "bien", o.strengths);
    const brechas = seccion("brechas", "Brechas", "brecha", o.gaps);
    if (!fortalezas && !brechas) return null;
    contenedor.append(...[fortalezas, brechas].filter(Boolean));
    const ocultos = Math.max(0, (o.strengths || []).length - VISIBLES) + Math.max(0, (o.gaps || []).length - VISIBLES);
    if (ocultos) {
      const b = el("button", { type: "button", clase: "ver-mas", "aria-expanded": "false", texto: `Ver ${ocultos} más` });
      b.addEventListener("click", () => {
        const abierto = contenedor.classList.toggle("abierto");
        b.setAttribute("aria-expanded", String(abierto));
        b.textContent = abierto ? "Ver menos" : `Ver ${ocultos} más`;
      });
      contenedor.append(b);
    }
    return contenedor;
  }

  function alertas(o) {
    const lista = L.alertas(o, hoy()).filter((a) => !a.startsWith("🔥"));
    if (!lista.length) return null;
    const veto = lista.some((a) => a.startsWith("⛔"));
    // Los textos de logica.js traen un símbolo inicial; aquí lo reemplaza un ícono dibujado.
    return el("ul", { clase: `alertas${veto ? " con-veto" : ""}` }, lista.map((a) => {
      const esVeto = a.startsWith("⛔");
      return el("li", { clase: esVeto ? "veto" : "" }, icono(esVeto ? "veto" : "alerta"),
        el("span", { texto: a.replace(/^[⛔⚠]️?\s*/u, "") }));
    }));
  }

  function fechas(o) {
    const cierre = L.alertas(o, hoy()).find((a) => a.startsWith("🔥"));
    const partes = [];
    if (cierre) partes.push(el("li", { clase: "cierre-pronto" }, icono("reloj"), el("span", { texto: cierre.replace(/^🔥\s*/u, "") })));
    const texto = [o.deadline ? `cierra ${o.deadline}` : "sin fecha límite", o.posted_date ? `publicada ${o.posted_date}` : null]
      .filter(Boolean).join(" · ");
    partes.push(el("li", {}, icono("fecha"), el("span", { texto })));
    return partes;
  }

  function tarjeta(o, puesto) {
    const color = L.color(o.rank_verdict);
    const marca = marcas[o.key];
    const etiquetas = [
      el("span", { clase: "etiqueta veredicto", texto: o.rank_verdict || "Sin veredicto" }),
      L.esNueva(o, visitaAnterior) ? el("span", { clase: "etiqueta nueva", texto: "Nueva" }) : null,
      o.tracker ? el("span", { clase: "etiqueta tracker" }, icono("check"), `En el tracker: ${TRACKER[o.tracker] || o.tracker}`) : null,
    ];
    const botones = MARCAS.map(([valor, ico, titulo]) => {
      const b = el("button", { type: "button", clase: "marca", "data-marca": valor, title: titulo,
        "aria-label": titulo, "aria-pressed": String(marca === valor) }, icono(ico));
      b.addEventListener("click", () => marcar(o.key, valor));
      return b;
    });
    const enlace = url(o.url)
      ? el("a", { clase: "ver", href: url(o.url), target: "_blank", rel: "noopener noreferrer" }, "Ver oferta", icono("externo"))
      : null;
    const lugar = [o.location || "sin ubicación", portal(o.portal)].filter(Boolean).join(" · ");

    return el("article", { clase: `tarjeta${marca === "descartada" ? " descartada" : ""}`, estilo: { "--color": color } },
      el("div", { clase: "cabeza" },
        el("div", { clase: "marcador" },
          el("div", { clase: "puntaje", title: "Puntaje de /rank", texto: String(o.rank_score ?? "–") }),
          el("span", { clase: "puesto", texto: `#${puesto}` })),
        el("div", { clase: "titulos" },
          el("h2", { texto: o.title || "(sin título)" }),
          el("div", { clase: "empresa", texto: o.company || "" }))),
      el("div", { clase: "etiquetas" }, etiquetas),
      el("ul", { clase: "datos" }, el("li", {}, icono("lugar"), el("span", { texto: lugar })), fechas(o)),
      alertas(o),
      puntos(o),
      el("div", { clase: "pie" }, botones, enlace));
  }

  function marcar(clave, valor) {
    if (marcas[clave] === valor) delete marcas[clave];
    else marcas[clave] = valor;
    guardar("ofertas.marcas", marcas);
    pintar();
  }

  function restablecer(base = L.FILTROS_DEFECTO) {
    filtros = { ...base };
    armarFiltros();
    aplicar();
  }

  function conectar() {
    $("form-clave").addEventListener("submit", desbloquear);
    $("f-texto").addEventListener("input", (e) => { filtros.texto = e.target.value; aplicar(); });
    $("f-minimo").addEventListener("input", (e) => {
      filtros.minimo = Number(e.target.value);
      $("f-minimo-valor").textContent = filtros.minimo;
      aplicar();
    });
    $("f-cierra").addEventListener("change", (e) => { filtros.cierraEn = e.target.value ? Number(e.target.value) : null; aplicar(); });
    $("f-marca").addEventListener("change", (e) => { filtros.marca = e.target.value || null; aplicar(); });
    $("f-ocultar-descartadas").addEventListener("change", (e) => { filtros.ocultarDescartadas = e.target.checked; aplicar(); });
    $("f-ocultar-tracker").addEventListener("change", (e) => { filtros.ocultarTracker = e.target.checked; aplicar(); });
    $("restablecer").addEventListener("click", () => restablecer());
    $("vacio-restablecer").addEventListener("click", () => restablecer());
    $("mostrar-todas").addEventListener("click", () => restablecer(L.FILTROS_TODAS));
    $("bloquear").addEventListener("click", () => { borrar("ofertas.clave"); datos = null; pedir(""); });
    $("ver-filtros").addEventListener("click", (e) => {
      const abierto = $("filtros").classList.toggle("abierto");
      e.currentTarget.setAttribute("aria-expanded", String(abierto));
    });
  }

  conectar();
  inicio();
})();
