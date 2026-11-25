// Merch carousel. The item in the middle floats on a studio backdrop and shows its real photos: it
// sways gently while it faces you, and turns around by itself every few seconds (counter-clockwise),
// sweeping quickly past the edge so it never sits side-on. Drag it to turn it; let go and it settles
// on whichever side it's nearest. Light sweeps across the fabric and the shadow narrows as it turns.
// Swipe the backdrop, use the arrows or the thumbnails, or click a neighbouring item to move along.
// Without JS the page shows a plain grid of photos.
const root = document.querySelector("[data-merch]");
if (root) {
  const items = [...root.querySelectorAll(".merch-item")];
  const n = items.length;
  const prev = root.querySelector(".merch-prev");
  const next = root.querySelector(".merch-next");
  const hint = document.querySelector(".merch-hint");
  const rail = document.querySelector(".merch-rail");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TURN_EVERY = 7000; // ms between automatic turns while nobody is touching it
  const SWAY = reduce ? 0 : 9; // degrees either side while it faces you
  // Spring towards the side it's settling on: critically damped, about a second for a half turn.
  const K = 26e-6, C = 2 * Math.sqrt(K);

  let active = 0;
  let angle = 0, vel = 0, rest = 0; // degrees, degrees per ms, the face it's settling on (0, 180, 360...)
  let tilt = 0;
  let drag = null;
  let swiped = false;
  let visible = false;
  let last = 0, clock = 0, idleSince = 0;

  const spinOf = (li) => li.querySelector(".merch-spin");
  const spin = () => spinOf(items[active]);

  // Each face gets a shade (darkens as it turns away) and a sheen (a band of light that sweeps
  // across). Both are masked to the item's outline and only move/fade, so they're cheap to animate.
  items.forEach((li, i) => {
    li.querySelectorAll(".merch-face").forEach((img) => {
      const face = document.createElement("div");
      face.className = `merch-side ${img.classList.contains("merch-back") ? "is-back" : "is-front"}`;
      face.style.setProperty("--mask", `url("${img.src}")`); // absolute: a url() in a custom property resolves against the stylesheet
      img.replaceWith(face);
      face.append(img, Object.assign(document.createElement("i"), { className: "merch-shade" }),
        Object.assign(document.createElement("i"), { className: "merch-sheen" }));
    });
    const shadow = document.createElement("i");
    shadow.className = "merch-shadow";
    spinOf(li).before(shadow);
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "merch-pick";
    pick.setAttribute("aria-label", `Show ${li.dataset.name}`);
    pick.addEventListener("click", () => { if (!swiped) go(i); });
    li.append(pick);
    if (rail) {
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "merch-thumb";
      thumb.setAttribute("aria-label", `Show ${li.dataset.name}`);
      thumb.innerHTML = `<img src="${li.querySelector(".merch-front").src}" alt="" width="90" height="100" loading="lazy" decoding="async">`;
      thumb.addEventListener("click", () => go(i));
      rail.append(thumb);
    }
  });
  prev.hidden = next.hidden = hint.hidden = false;
  if (rail) rail.hidden = false;

  function apply(t = clock) {
    const li = items[active];
    const bob = reduce ? 0 : Math.sin(t / 900) * 5;
    spin().style.transform = `translateY(${bob}px) rotateX(${tilt}deg) rotateY(${angle}deg)`;
    const r = (angle * Math.PI) / 180;
    const facing = Math.abs(Math.cos(r)); // 1 facing you, 0 side-on
    li.style.setProperty("--shade", (0.42 * (1 - facing)).toFixed(3));
    li.style.setProperty("--sheen-x", `${(Math.sin(r) * 140).toFixed(1)}%`);
    li.style.setProperty("--sheen", (0.55 * Math.min(1, Math.abs(Math.sin(r)) * 1.6)).toFixed(3));
    li.style.setProperty("--shadow", (0.45 + 0.55 * facing).toFixed(3));
    li.style.setProperty("--lift", bob.toFixed(2));
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
      if (rail) rail.children[i].setAttribute("aria-current", o === 0 ? "true" : "false");
    });
    const li = items[active];
    const sp = spin();
    sp.tabIndex = 0;
    sp.setAttribute("role", "group");
    sp.setAttribute("aria-label", `${li.dataset.name}. Drag to turn it around, or press Enter.`);
    hint.textContent = `${String(active + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")} · Drag to turn it around. Swipe or use the arrows for the next one.`;
  }

  function go(i) {
    const to = ((i % n) + n) % n;
    if (to === active) return;
    const old = items[active];
    spinOf(old).tabIndex = -1;
    spinOf(old).removeAttribute("role");
    spinOf(old).removeAttribute("aria-label");
    spinOf(old).style.transform = "";
    ["--shade", "--sheen", "--sheen-x", "--shadow", "--lift"].forEach((p) => old.style.removeProperty(p));
    const dir = (((to - active) % n) + n) % n > n / 2 ? -1 : 1;
    active = to;
    // The new item swings in from the side it's arriving from, then settles facing you.
    angle = reduce ? 0 : -28 * dir;
    vel = tilt = rest = 0;
    idleSince = clock;
    layout();
    apply();
  }

  const turn = (by) => { rest = Math.round(angle / 180) * 180 + by; idleSince = clock; };

  // Drag the centre item to turn it.
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
    angle += dx * 0.55;
    tilt = Math.max(-10, Math.min(10, tilt - dy * 0.12));
    drag.v = 0.55 * dx / dt * 0.5 + drag.v * 0.5;
    drag.x = e.clientX; drag.y = e.clientY; drag.t = e.timeStamp;
    apply();
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (d.onItem) {
      // Settle on the side it's heading for: a flick carries it round, a slow drag settles nearby.
      vel = e.timeStamp - d.t < 80 ? Math.max(-2, Math.min(2, d.v)) : 0;
      rest = Math.round((angle + vel * 160) / 180) * 180;
      idleSince = clock;
      return;
    }
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      swiped = true;
      setTimeout(() => (swiped = false), 50);
      go(active + (dx < 0 ? 1 : -1));
    }
  };
  root.addEventListener("pointerup", release);
  root.addEventListener("pointercancel", () => { drag = null; turn(0); });

  prev.addEventListener("click", () => go(active - 1));
  next.addEventListener("click", () => go(active + 1));

  root.addEventListener("keydown", (e) => {
    if (e.target === spin() && (e.key === "Enter" || e.key === " ")) { turn(180); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { go(active - 1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { go(active + 1); e.preventDefault(); }
  });

  function tick(t) {
    if (!visible) return;
    const dt = Math.min(t - last, 40);
    last = t;
    clock += dt;
    if (!drag || !drag.onItem) {
      if (!reduce && clock - idleSince > TURN_EVERY) turn(180); // counter-clockwise: the angle grows
      const sway = SWAY * Math.sin(clock / 1500);
      vel += (K * (rest + sway - angle) - C * vel) * dt;
      angle += vel * dt;
      tilt *= Math.exp(-dt / 400);
    }
    apply(clock);
    requestAnimationFrame(tick);
  }
  new IntersectionObserver(([entry]) => {
    const was = visible;
    visible = entry.isIntersecting;
    if (visible && !was) { last = performance.now(); requestAnimationFrame(tick); }
  }).observe(root);

  layout();
  apply();
}
