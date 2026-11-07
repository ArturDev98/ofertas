// three.js de la web: la zaranda de la pantalla de clave y el emblema del puntaje. Solo se carga con WebGL y sin movimiento reducido.
import * as THREE from "./vendor/three.module.min.js";

const MADERA = 0xa9804e;
const CHAPA = 0x8f978d;
const VERDES = [0x9fae74, 0x8c9b62, 0xb2b981, 0x7f8f57, 0xc9b56a];

function texturaPerforada(huecos, borde = 0.36) {
  const lado = 256;
  const c = document.createElement("canvas");
  c.width = c.height = lado;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, lado, lado);
  g.fillStyle = "#000";
  const paso = lado / huecos;
  for (let y = 0; y < huecos; y++) {
    for (let x = 0; x < huecos; x++) {
      // Tresbolillo, como la chapa de una zaranda real.
      const dx = (y % 2) * paso / 2;
      g.beginPath();
      g.arc(x * paso + paso / 2 + dx, y * paso + paso / 2, paso * borde, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function zaranda(radio, repeticion) {
  const grupo = new THREE.Group();
  const alfa = texturaPerforada(8);
  alfa.repeat.set(repeticion, repeticion);
  const chapa = new THREE.Mesh(
    new THREE.CircleGeometry(radio, 96),
    new THREE.MeshStandardMaterial({ color: CHAPA, metalness: 0.7, roughness: 0.4, alphaMap: alfa, alphaTest: 0.5, side: THREE.DoubleSide }),
  );
  chapa.rotation.x = -Math.PI / 2;
  const aro = new THREE.Mesh(
    new THREE.TorusGeometry(radio, radio * 0.055, 18, 140),
    new THREE.MeshStandardMaterial({ color: MADERA, roughness: 0.72, metalness: 0.05 }),
  );
  aro.rotation.x = Math.PI / 2;
  grupo.add(chapa, aro);
  return grupo;
}

function luces(escena) {
  escena.add(new THREE.HemisphereLight(0xe3ecdc, 0x0f2418, 1.25));
  const sol = new THREE.DirectionalLight(0xffffff, 1.7);
  sol.position.set(4, 9, 5);
  escena.add(sol);
}

function granosInstanciados(n, radioGrano) {
  const geo = new THREE.SphereGeometry(radioGrano, 14, 10);
  geo.scale(1, 0.62, 0.78);
  const malla = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.02 }), n);
  malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return malla;
}

function ajustar(renderer, camara, canvas) {
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  renderer.setSize(w, h, false);
  camara.aspect = w / h;
  camara.updateProjectionMatrix();
}

const nuevoRenderer = (canvas) => {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
};

export function iniciarFondo(canvas) {
  const renderer = nuevoRenderer(canvas);
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camara.position.set(0, 8.6, 8.2);
  camara.lookAt(0, -1.2, 0);
  luces(escena);

  const plato = new THREE.Group();
  plato.add(zaranda(6.4, 9));
  plato.position.y = -1.6;
  escena.add(plato);

  const N = 170;
  const granos = granosInstanciados(N, 0.17);
  const color = new THREE.Color();
  const datos = [];
  for (let i = 0; i < N; i++) {
    const r = 5.6 * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    datos.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, fase: Math.random() * 6.3, giro: Math.random() * 6.3, y: 0.11, vy: 0 });
    granos.setColorAt(i, color.setHex(VERDES[i % VERDES.length]));
  }
  plato.add(granos);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  let agitar = 1;
  let cayendo = false;
  let objetivo = { x: 0, z: 0 };
  let vivo = true;
  let anterior = performance.now();

  const alMover = (ev) => {
    objetivo = { x: (ev.clientY / innerHeight - 0.5) * 0.22, z: (ev.clientX / innerWidth - 0.5) * -0.22 };
    agitar = Math.min(1.6, agitar + 0.05);
  };
  const alRedimensionar = () => ajustar(renderer, camara, canvas);
  addEventListener("pointermove", alMover);
  addEventListener("resize", alRedimensionar);
  alRedimensionar();

  function cuadro(ahora) {
    if (!vivo) return;
    const dt = Math.min(0.05, (ahora - anterior) / 1000);
    anterior = ahora;
    const t = ahora / 1000;
    plato.rotation.x += (objetivo.x - plato.rotation.x) * 0.05;
    plato.rotation.z += (objetivo.z - plato.rotation.z) * 0.05;
    agitar = Math.max(0.35, agitar * 0.985);
    datos.forEach((d, i) => {
      if (cayendo) {
        d.vy -= 22 * dt;
        d.y += d.vy * dt;
      } else {
        d.y = 0.11 + Math.abs(Math.sin(t * 5.2 + d.fase)) * 0.06 * agitar;
      }
      e.set(0, d.giro + t * 0.15, Math.sin(t * 3 + d.fase) * 0.12 * agitar);
      m.compose(v.set(d.x, d.y, d.z), q.setFromEuler(e), s);
      granos.setMatrixAt(i, m);
    });
    granos.instanceMatrix.needsUpdate = true;
    renderer.render(escena, camara);
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);

  const alOcultar = () => {
    if (document.hidden) vivo = false;
    else if (!vivo && canvas.isConnected) { vivo = true; anterior = performance.now(); requestAnimationFrame(cuadro); }
  };
  document.addEventListener("visibilitychange", alOcultar);

  function detener() {
    vivo = false;
    removeEventListener("pointermove", alMover);
    removeEventListener("resize", alRedimensionar);
    document.removeEventListener("visibilitychange", alOcultar);
    renderer.dispose();
  }

  // Al abrir, el grano cae por la malla: cada uno con un pequeño retraso para que no caiga en bloque.
  function soltar() {
    datos.forEach((d) => { d.vy = Math.random() * 1.5; });
    cayendo = true;
    return new Promise((listo) => setTimeout(listo, 650));
  }

  return { soltar, detener };
}

export function emblema(canvas) {
  const renderer = nuevoRenderer(canvas);
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camara.position.set(0, 4.3, 3.1);
  camara.lookAt(0, 0, 0);
  luces(escena);
  const plato = zaranda(1.05, 2.4);
  plato.rotation.y = 0.4;
  escena.add(plato);

  const MAX = 46;
  const granos = granosInstanciados(MAX, 0.105);
  granos.count = 0;
  plato.add(granos);
  const color = new THREE.Color();
  const base = new THREE.Color();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  let caidas = [];
  let corriendo = false;
  let inicio = 0;

  function posiciones(n) {
    // Montón en espiral: los primeros al centro y más alto, como se apila el grano retenido.
    return Array.from({ length: n }, (_, i) => {
      const r = 0.82 * Math.sqrt((i + 0.5) / MAX);
      const a = i * 2.39996;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.07 + (1 - r / 0.82) * 0.16 };
    });
  }

  function cuadro(ahora) {
    const t = (ahora - inicio) / 1000;
    let pendientes = 0;
    caidas.forEach((c, i) => {
      const local = Math.max(0, Math.min(1, (t - c.retraso) / 0.5));
      if (local < 1) pendientes++;
      // Rebote corto al tocar la malla.
      const rebote = local < 1 ? Math.abs(Math.sin(local * Math.PI * 1.6)) * (1 - local) * 0.35 : 0;
      const y = local < 0.62 ? c.alto - (c.alto - c.y) * (local / 0.62) ** 2 : c.y + rebote;
      e.set(c.giro, c.giro * 2, 0);
      m.compose(v.set(c.x, y, c.z), q.setFromEuler(e), s);
      granos.setMatrixAt(i, m);
    });
    granos.instanceMatrix.needsUpdate = true;
    plato.rotation.y = 0.4 + Math.min(1, t / 1.2) * 0.35;
    renderer.render(escena, camara);
    if (pendientes || t < 1.2) requestAnimationFrame(cuadro);
    else corriendo = false;
  }

  function mostrar(puntaje, tono) {
    ajustar(renderer, camara, canvas);
    const n = Math.round(Math.max(0, Math.min(100, Number(puntaje) || 0)) / 100 * MAX);
    base.setStyle(tono || "#b9c6ba");
    granos.count = n;
    caidas = posiciones(n).map((p, i) => ({ ...p, alto: 1.6 + Math.random() * 0.8, retraso: i * 0.014, giro: Math.random() * 6.3 }));
    for (let i = 0; i < n; i++) {
      granos.setColorAt(i, color.copy(base).offsetHSL(0, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.12));
    }
    if (granos.instanceColor) granos.instanceColor.needsUpdate = true;
    inicio = performance.now();
    if (!corriendo) { corriendo = true; requestAnimationFrame(cuadro); }
  }

  return { mostrar, detener: () => renderer.dispose() };
}

export function hayWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) {
    return false;
  }
}
