// Merch carousel: the centre item is a 3D model made from the real photos. Each photo is "inflated"
// like a pillow from its depth map (NAME-depth.png), front photo on the front and back photo on the back,
// and lit so it reads as a solid object (three.js, loaded on demand). Until that loads, or without WebGL,
// it falls back to a thin CSS cutout: front and back faces plus a few edge slices for thickness.
// It turns slowly counter-clockwise by itself. Drag it to spin it any direction; it coasts, then settles
// back into the slow turn. Swipe the white backdrop, use the arrows, or click a neighbouring item to move
// along. Without JS the page shows a plain grid of photos.
const MERCH_SCRIPT = document.currentScript.src;
const root = document.querySelector("[data-merch]");
if (root) {
  const items = [...root.querySelectorAll(".merch-item")];
  const n = items.length;
  const prev = root.querySelector(".merch-prev");
  const next = root.querySelector(".merch-next");
  const hint = document.querySelector(".merch-hint");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const DRIFT = reduce ? 0 : 0.006; // degrees per ms: one slow turn every 60 seconds
  const SLICES = 10;
  const THICK = 14; // px between the front and back faces
  const TILT_MAX = 22;

  let active = 0;
  let angle = 0, tilt = 0, vel = 0; // vel: extra spin from a fling, degrees per ms
  let drag = null;
  let swiped = false;
  let visible = false;
  let last = 0;
  let gl = null; // the three.js renderer, once loaded

  const spinOf = (li) => li.querySelector(".merch-spin");
  const spin = () => spinOf(items[active]);

  items.forEach((li, i) => {
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "merch-pick";
    pick.setAttribute("aria-label", `Show ${li.dataset.name}`);
    pick.addEventListener("click", () => { if (!swiped) go(i); });
    li.append(pick);
    li.querySelectorAll(".merch-face").forEach((img) => img.style.setProperty("--t", `${THICK / 2 + 0.5}px`));
  });
  prev.hidden = next.hidden = hint.hidden = false;

  function addSlices(li) {
    const sp = spinOf(li);
    const mask = `url("${li.querySelector(".merch-front").src.replace("-front", "-edge")}")`; // absolute: a url() in a custom property resolves against the stylesheet
    for (let k = 0; k < SLICES; k++) {
      const s = document.createElement("i");
      s.className = "merch-slice";
      s.style.cssText = `--m:${mask};background:${li.dataset.edge};transform:translateZ(${(k / (SLICES - 1) - 0.5) * THICK}px) scale(.99)`;
      sp.prepend(s);
    }
  }

  function apply() {
    if (gl && items[active].classList.contains("is-3d")) {
      spin().style.transform = "";
      gl.group.rotation.set((-tilt * Math.PI) / 180, (angle * Math.PI) / 180, 0);
      gl.renderer.render(gl.scene, gl.camera);
    } else {
      spin().style.transform = `rotateX(${tilt}deg) rotateY(${angle}deg)`;
    }
  }

  // ---- 3D: one WebGL canvas that moves to whichever item is in the middle ----
  async function start3d() {
    try {
      const THREE = await import(new URL("vendor/three.module.min.js", MERCH_SCRIPT));
      const canvas = document.createElement("canvas");
      canvas.className = "merch-gl";
      canvas.setAttribute("aria-hidden", "true");
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d0bf, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(-1.4, 1.8, 2.6);
      scene.add(key);
      // The canvas is 120% x 116% of the item, so 1 unit = the item's height and the model has room to turn.
      const camera = new THREE.PerspectiveCamera((2 * Math.atan(0.58 / 4) * 180) / Math.PI, 1.08 / 1.16, 0.1, 10);
      camera.position.z = 4;
      const group = new THREE.Group();
      scene.add(group);
      gl = { THREE, renderer, canvas, scene, camera, group, models: new Map() };
      new ResizeObserver(() => { size(); apply(); }).observe(root);
      show3d(items[active]);
    } catch (err) {
      console.warn("3D merch view unavailable, using the flat version.", err);
    }
  }

  function size() {
    const { canvas, renderer } = gl;
    if (canvas.clientWidth) renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  }

  async function show3d(li) {
    const model = await modelFor(li).catch((err) => console.warn("Couldn't build 3D model", err));
    if (!model || li !== items[active]) return; // moved on while it loaded
    gl.group.clear();
    gl.group.add(model);
    spinOf(li).append(gl.canvas);
    size();
    li.classList.add("is-3d");
    apply();
  }

  function modelFor(li) {
    if (!gl.models.has(li)) gl.models.set(li, buildModel(li));
    return gl.models.get(li);
  }

  async function buildModel(li) {
    const { THREE } = gl;
    const base = li.querySelector(".merch-front").src.replace("-front.webp", "");
    const loader = new THREE.TextureLoader();
    const tex = async (url) => {
      const t = await loader.loadAsync(url);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = gl.renderer.capabilities.getMaxAnisotropy();
      return t;
    };
    const depthImg = new Image();
    depthImg.src = `${base}-depth.png`;
    const [front, back] = await Promise.all([tex(`${base}-front.webp`), tex(`${base}-back.webp`), depthImg.decode()]);
    const c = document.createElement("canvas");
    c.width = depthImg.naturalWidth;
    c.height = depthImg.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(depthImg, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    // Depth is 16-bit, high byte in red and low byte in green (an 8-bit grey PNG reads the same way):
    // 0 = outside the item, 257 = its flat outline band (front and back meet there), above that = how puffy.
    const W = c.width, H = c.height;
    const raw = (x, y) => { const k = (y * W + x) * 4; return px[k] * 256 + px[k + 1]; };
    const inside = (u, v) => raw(Math.round(u * (W - 1)), Math.round(v * (H - 1))) > 0;
    const height = (u, v) => { // bilinear, so the surface is smooth rather than stepped
      const x = u * (W - 1), y = v * (H - 1), x0 = Math.floor(x), y0 = Math.floor(y);
      const x1 = Math.min(x0 + 1, W - 1), y1 = Math.min(y0 + 1, H - 1), fx = x - x0, fy = y - y0;
      const h = (xx, yy) => Math.max(0, raw(xx, yy) - 257) / (65535 - 257);
      return (h(x0, y0) * (1 - fx) + h(x1, y0) * fx) * (1 - fy) + (h(x0, y1) * (1 - fx) + h(x1, y1) * fx) * fy;
    };
    const puff = Number(li.dataset.puff) || 0.08; // half-thickness at the fullest point, as a share of the height
    // One mesh cell per depth pixel up to 300 across: the detailed (16-bit) items get a finer mesh.
    const GW = Math.min(W - 1, 300), GH = Math.round((GW * 10) / 9);

    const model = new THREE.Group();
    for (const side of [1, -1]) {
      const pos = [], uv = [], idx = [], isIn = [];
      for (let j = 0; j <= GH; j++) {
        for (let i = 0; i <= GW; i++) {
          const u = i / GW, v = j / GH;
          pos.push((u - 0.5) * 0.9, 0.5 - v, side * height(u, v) * puff);
          uv.push(side > 0 ? u : 1 - u, 1 - v); // the back photo is shot from behind, so mirror it
          isIn.push(inside(u, v));
        }
      }
      for (let j = 0; j < GH; j++) {
        for (let i = 0; i < GW; i++) {
          const a = j * (GW + 1) + i, b = a + 1, cc = a + GW + 1, d = cc + 1;
          if (!(isIn[a] || isIn[b] || isIn[cc] || isIn[d])) continue;
          if (side > 0) idx.push(a, cc, b, b, cc, d);
          else idx.push(a, b, cc, b, d, cc);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      // Matte like cotton. DoubleSide: any hairline gap at the outline shows the inside of the fabric, not the page.
      // alphaToCoverage: smooth, anti-aliased cut-out edges instead of stair steps.
      const mat = new THREE.MeshLambertMaterial({ map: side > 0 ? front : back, alphaTest: 0.2, alphaToCoverage: true, side: THREE.DoubleSide });
      model.add(new THREE.Mesh(geo, mat));
    }
    return model;
  }

  function layout() {
    items.forEach((li, i) => {
      let o = (((i - active) % n) + n) % n;
      if (o > n / 2) o -= n;
      li.style.setProperty("--o", o);
      li.style.setProperty("--a", Math.min(Math.abs(o), 2));
      li.classList.toggle("is-active", o === 0);
      li.classList.toggle("is-far", Math.abs(o) > 1);
      li.setAttribute("aria-hidden", Math.abs(o) > 1 ? "true" : "false");
      li.querySelector(".merch-pick").tabIndex = Math.abs(o) === 1 ? 0 : -1;
      li.querySelector(".merch-pick").hidden = o === 0;
    });
    const li = items[active];
    const sp = spin();
    sp.tabIndex = 0;
    sp.setAttribute("role", "group");
    sp.setAttribute("aria-label", `${li.dataset.name}. Drag to spin it, or hold Shift and press the arrow keys.`);
    hint.textContent = `${active + 1} of ${n} · Drag to spin it. Swipe or use the arrows for the next one.`;
  }

  function go(i) {
    const to = ((i % n) + n) % n;
    if (to === active) return;
    const old = items[active];
    old.classList.remove("is-3d");
    // Turn the old item back to face front by the short way, then drop its edge slices.
    angle = ((((angle + 180) % 360) + 360) % 360) - 180;
    spinOf(old).style.transform = `rotateY(${angle}deg)`;
    spinOf(old).tabIndex = -1;
    spinOf(old).removeAttribute("role");
    spinOf(old).removeAttribute("aria-label");
    requestAnimationFrame(() => (spinOf(old).style.transform = "rotateY(0deg)"));
    setTimeout(() => old.querySelectorAll(".merch-slice").forEach((s) => s.remove()), 600);
    active = to;
    angle = tilt = vel = 0;
    addSlices(items[active]);
    layout();
    apply();
    if (gl) show3d(items[active]);
  }

  // Spin: pointer drag on the centre item.
  root.addEventListener("pointerdown", (e) => {
    if (e.button || e.target.closest(".merch-arrow")) return;
    const onItem = !!e.target.closest(".is-active .merch-spin");
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: e.timeStamp, v: 0, onItem };
    swiped = false;
    if (onItem) { vel = 0; spin().setPointerCapture(e.pointerId); }
  });
  root.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id || !drag.onItem) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y, dt = Math.max(e.timeStamp - drag.t, 1);
    angle += dx * 0.6;
    tilt = Math.max(-TILT_MAX, Math.min(TILT_MAX, tilt - dy * 0.3));
    drag.v = 0.6 * dx / dt * 0.5 + drag.v * 0.5; // smoothed degrees per ms
    drag.x = e.clientX; drag.y = e.clientY; drag.t = e.timeStamp;
    apply();
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (d.onItem) {
      vel = Math.max(-1.5, Math.min(1.5, e.timeStamp - d.t < 80 ? d.v : 0));
      return;
    }
    // Swipe on the backdrop or a neighbouring item moves the carousel.
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      swiped = true;
      setTimeout(() => (swiped = false), 50);
      go(active + (dx < 0 ? 1 : -1));
    }
  };
  root.addEventListener("pointerup", release);
  root.addEventListener("pointercancel", () => (drag = null));

  prev.addEventListener("click", () => go(active - 1));
  next.addEventListener("click", () => go(active + 1));

  root.addEventListener("keydown", (e) => {
    if (e.shiftKey && e.target === spin()) {
      if (e.key === "ArrowLeft") angle -= 30;
      else if (e.key === "ArrowRight") angle += 30;
      else if (e.key === "ArrowUp") tilt = Math.min(TILT_MAX, tilt + 8);
      else if (e.key === "ArrowDown") tilt = Math.max(-TILT_MAX, tilt - 8);
      else return;
      e.preventDefault();
      apply();
    } else if (e.key === "ArrowLeft") { go(active - 1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { go(active + 1); e.preventDefault(); }
  });

  // Animate only while the carousel is on screen.
  function tick(t) {
    if (!visible) return;
    const dt = Math.min(t - last, 50);
    last = t;
    if (!drag || !drag.onItem) {
      angle += (DRIFT + vel) * dt;
      vel *= Math.exp(-dt / 500);
      tilt *= Math.exp(-dt / 900);
      apply();
    }
    requestAnimationFrame(tick);
  }
  new IntersectionObserver(([entry]) => {
    const was = visible;
    visible = entry.isIntersecting;
    if (visible && !was) { last = performance.now(); requestAnimationFrame(tick); }
    if (visible && !start3d.called) { start3d.called = true; start3d(); }
  }).observe(root);

  addSlices(items[active]);
  layout();
  apply();
}
