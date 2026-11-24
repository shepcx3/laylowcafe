// Merch carousel: the centre item is a thin 3D cutout of the real photos (front and back faces plus a
// few edge slices for thickness) that turns slowly counter-clockwise by itself. Drag it to spin it any
// direction; it coasts, then settles back into the slow turn. Swipe the white backdrop, use the arrows,
// or click a neighbouring item to move along. Without JS the page shows a plain grid of photos.
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
    spin().style.transform = `rotateX(${tilt}deg) rotateY(${angle}deg)`;
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
  }).observe(root);

  addSlices(items[active]);
  layout();
  apply();
}
