// Antes de pintar: el tema guardado evita el destello del tema contrario.
(function () {
  try {
    const t = JSON.parse(localStorage.getItem("criba.tema"));
    if (t === "claro" || t === "oscuro") document.documentElement.dataset.theme = t === "claro" ? "light" : "dark";
  } catch (e) { /* sin almacenamiento */ }
})();
