// Lógica pura de la página (filtros, alertas, insignias); sin DOM, para poder probarla con Node.
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.Logica = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  const COLORES = { "Strong Fit": "#188038", "Good Fit": "#1a73e8", "Moderate Fit": "#e37400" };
  const GRIS = "#5f6368";

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

  function filtrar(ofertas, filtros, marcas, hoy) {
    const f = { ...FILTROS_DEFECTO, ...filtros };
    const texto = normal(f.texto).trim();
    return ofertas.filter((o) => {
      const marca = marcas[o.key];
      if (f.veredictos.length && !f.veredictos.includes(o.rank_verdict)) return false;
      if ((o.rank_score || 0) < f.minimo) return false;
      if (f.portales.length && !f.portales.includes(o.portal)) return false;
      if (o.location_verdict && !f.ubicacion.includes(o.location_verdict)) return false;
      if (o.language_gate && !f.idioma.includes(o.language_gate)) return false;
      if (f.cierraEn != null) {
        if (!o.deadline) return false;
        const d = dias(hoy, o.deadline);
        if (d < 0 || d > f.cierraEn) return false;
      }
      if (f.ocultarDescartadas && marca === "descartada") return false;
      if (f.ocultarTracker && o.tracker) return false;
      if (f.marca && marca !== f.marca) return false;
      if (texto) {
        const campos = [o.title, o.company, o.location, ...(o.strengths || []), ...(o.gaps || [])];
        if (!campos.some((c) => normal(c).includes(texto))) return false;
      }
      return true;
    });
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

  const color = (veredicto) => COLORES[veredicto] || GRIS;

  return { FILTROS_DEFECTO, filtrar, alertas, esNueva, marcaLocal, clavePendiente, color, dias };
});
