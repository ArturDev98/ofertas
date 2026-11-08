// Lógica pura de la página (filtros, alertas, insignias); sin DOM, para poder probarla con Node.
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.Logica = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  const TONOS = [["strong", "Strong Fit"], ["good", "Good Fit"], ["moderate", "Moderate Fit"]];

  const FILTROS_DEFECTO = Object.freeze({
    veredictos: [], minimo: 45, portales: [], ubicacion: ["PASS", "FLAG"], idioma: ["PASS", "FLAG"],
    cierraEn: null, texto: "", ocultarDescartadas: true, ocultarTracker: false, marca: null,
  });

  const normal = (texto) =>
    String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  // Días entre dos fechas AAAA-MM-DD, en UTC para que el horario de verano no corra un día.
  function dias(desde, hasta) {
    const utc = (f) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
    return Math.round((utc(hasta) - utc(desde)) / 86400000);
  }

  const FILTROS_TODAS = Object.freeze({
    ...FILTROS_DEFECTO, minimo: 0, ubicacion: ["PASS", "FLAG", "FAIL"], idioma: ["PASS", "FLAG", "FAIL"],
    ocultarDescartadas: false,
  });
  const NOMBRE_ESTADO = { PASS: "cumple", FLAG: "a revisar", FAIL: "veto" };

  // Primera razón por la que la oferta queda fuera, o null si se ve; los vetos van antes.
  function motivo(o, f, marca, hoy, texto) {
    if (o.language_gate && !f.idioma.includes(o.language_gate)) {
      return o.language_gate === "FAIL" ? "veto de idioma" : `idioma ${NOMBRE_ESTADO[o.language_gate] || o.language_gate}`;
    }
    if (o.location_verdict && !f.ubicacion.includes(o.location_verdict)) {
      return o.location_verdict === "FAIL" ? "veto de ubicación"
        : `ubicación ${NOMBRE_ESTADO[o.location_verdict] || o.location_verdict}`;
    }
    if ((o.rank_score || 0) < f.minimo) return `puntaje bajo ${f.minimo}`;
    if (f.veredictos.length && !f.veredictos.includes(o.rank_verdict)) return "veredicto";
    if (f.portales.length && !f.portales.includes(o.portal)) return "portal";
    if (f.cierraEn != null) {
      if (!o.deadline) return "sin fecha de cierre";
      const d = dias(hoy, o.deadline);
      if (d < 0 || d > f.cierraEn) return "fecha de cierre";
    }
    if (f.ocultarDescartadas && marca === "descartada") return "descartada";
    if (f.ocultarTracker && o.tracker) return "en el tracker";
    if (f.marca && marca !== f.marca) return "marca";
    if (texto) {
      const campos = [o.title, o.company, o.location, ...(o.strengths || []), ...(o.gaps || [])];
      if (!campos.some((c) => normal(c).includes(texto))) return "búsqueda";
    }
    return null;
  }

  function evaluar(ofertas, filtros, marcas, hoy) {
    const f = { ...FILTROS_DEFECTO, ...filtros };
    const texto = normal(f.texto).trim();
    return ofertas.map((o) => [o, motivo(o, f, marcas[o.key], hoy, texto)]);
  }

  const filtrar = (ofertas, filtros, marcas, hoy) =>
    evaluar(ofertas, filtros, marcas, hoy).filter(([, m]) => !m).map(([o]) => o);

  // [[razón, cuántas]] de las que no se ven, de más a menos.
  function ocultas(ofertas, filtros, marcas, hoy) {
    const cuenta = new Map();
    evaluar(ofertas, filtros, marcas, hoy).forEach(([, m]) => { if (m) cuenta.set(m, (cuenta.get(m) || 0) + 1); });
    return [...cuenta].sort((a, b) => b[1] - a[1]);
  }

  function alertas(o, hoy) {
    const lista = [];
    if (o.deadline) {
      const d = dias(hoy, o.deadline);
      if (d === 0) lista.push("🔥 cierra hoy");
      else if (d > 0 && d <= 7) lista.push(`🔥 cierra en ${d} día${d === 1 ? "" : "s"}`);
    }
    if (o.location_verdict === "FAIL") lista.push("⛔ veto de ubicación");
    if (o.language_gate === "FAIL") lista.push("⛔ veto de idioma");
    if (o.language_gate === "FLAG") lista.push(`⚠ idioma: ${o.language_note || "nivel a revisar"}`);
    if (o.location_verdict === "FLAG") lista.push("⚠ ubicación a revisar");
    if (o.posted_date) {
      const d = dias(o.posted_date, hoy);
      if (d > 30) {
        const meses = Math.max(1, Math.floor(d / 30));
        lista.push(`⚠ publicada hace ${meses} mes${meses === 1 ? "" : "es"}`);
      }
    }
    if (o.guard && o.guard !== "clean") lista.push(`⚠ guard: ${o.guard}`);
    return lista;
  }

  const esNueva = (o, visitaAnterior) => Boolean(visitaAnterior && o.publicada && o.publicada > visitaAnterior);

  // Mismo formato que `publicada` (hora local, sin zona), para comparar como texto.
  function marcaLocal(fecha) {
    const dos = (n) => String(n).padStart(2, "0");
    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
      `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
  }

  const clavePendiente = (guardada, archivo) =>
    guardada && guardada.raw && guardada.sal === archivo.sal ? "usar" : "pedir";

  const tono = (veredicto) => (TONOS.find(([, v]) => v === veredicto) || ["otro"])[0];

  // Perforaciones llenas de la malla de 10: una por cada 10 puntos.
  const granos = (puntaje) => Math.min(10, Math.max(0, Math.round((Number(puntaje) || 0) / 10)));

  function vecino(claves, actual, paso) {
    if (!claves.length) return null;
    const i = claves.indexOf(actual);
    if (i < 0) return claves[0];
    return claves[Math.min(claves.length - 1, Math.max(0, i + paso))];
  }

  // [[tono, etiqueta, cuántas]] en orden Strong, Good, Moderate, otros; sin los que no tienen ofertas.
  function reparto(ofertas) {
    const filas = [...TONOS, ["otro", "Otros"]].map(([t, v]) => [t, v, 0]);
    ofertas.forEach((o) => { filas.find(([t]) => t === tono(o.rank_verdict))[2] += 1; });
    return filas.filter(([, , n]) => n > 0);
  }

  function cifras(ofertas, hoy, visitaAnterior) {
    const cierran = ofertas.filter((o) => {
      if (!o.deadline) return false;
      const d = dias(hoy, o.deadline);
      return d >= 0 && d <= 7;
    }).length;
    return { cierran, nuevas: ofertas.filter((o) => esNueva(o, visitaAnterior)).length };
  }

  // Solo letras, dígitos, _ y -: el token arma una ruta y no debe poder salir de datos/.
  function token(hash) {
    const t = String(hash || "").replace(/^#/, "");
    return /^[A-Za-z0-9_-]{20,64}$/.test(t) ? t : null;
  }

  // Un hash que no es token (cortado al copiarlo) no debe abrir la página de Arturo.
  function hashMalo(hash) {
    return String(hash || "").replace(/^#/, "") !== "" && token(hash) === null;
  }

  function rutaDatos(tok) {
    return tok ? `datos/${tok}.json` : "datos.json";
  }

  function claves(tok) {
    const pre = tok ? `criba.${tok}.` : "ofertas.";
    return { clave: `${pre}clave`, marcas: `${pre}marcas`, filtros: `${pre}filtros`, visita: `${pre}visita` };
  }

  return { FILTROS_DEFECTO, FILTROS_TODAS, filtrar, ocultas, alertas, esNueva, marcaLocal, clavePendiente, tono,
    granos, vecino, reparto, cifras, dias, token, hashMalo, rutaDatos, claves };
});
