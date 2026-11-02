// Descifrado de datos.json (AES-256-GCM, clave PBKDF2-SHA256); mismo formato que publicar_web.py.
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.Cripto = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  const deB64 = (texto) =>
    typeof atob === "function"
      ? Uint8Array.from(atob(texto), (c) => c.charCodeAt(0))
      : new Uint8Array(Buffer.from(texto, "base64"));

  const aB64 = (bytes) => {
    const arr = new Uint8Array(bytes);
    if (typeof btoa !== "function") return Buffer.from(arr).toString("base64");
    let s = "";
    arr.forEach((b) => (s += String.fromCharCode(b)));
    return btoa(s);
  };

  async function derivar(frase, salB64, iter, subtle) {
    const base = await subtle.importKey("raw", new TextEncoder().encode(frase), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: deB64(salB64), iterations: iter },
      base,
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"]
    );
  }

  async function abrir(archivo, clave, subtle) {
    const claro = await subtle.decrypt({ name: "AES-GCM", iv: deB64(archivo.iv) }, clave, deB64(archivo.datos));
    return JSON.parse(new TextDecoder().decode(claro));
  }

  async function exportar(clave, subtle) {
    return aB64(await subtle.exportKey("raw", clave));
  }

  function importar(rawB64, subtle) {
    return subtle.importKey("raw", deB64(rawB64), { name: "AES-GCM" }, true, ["decrypt"]);
  }

  return { derivar, abrir, exportar, importar };
});
