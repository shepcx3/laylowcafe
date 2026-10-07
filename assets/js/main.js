// Lay Low Cafe — small progressive enhancements. The site works without JS.
document.documentElement.classList.add("js");

// Opening hours in 24h time, Kingston local time. Index 0 = Sunday.
// Keep in sync with the hours shown in the HTML and the JSON-LD in each page.
const HOURS = [
  [7, 17], // Sun
  [7, 17], // Mon
  [7, 17], // Tue
  [7, 17], // Wed
  [7, 17], // Thu
  [7, 17], // Fri
  [7, 17], // Sat
];

function kingstonNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function fmt(hour) {
  const h = hour % 12 || 12;
  return `${h}${hour < 12 ? "am" : "pm"}`;
}

function openStatus() {
  const { day, minutes } = kingstonNow();
  const [open, close] = HOURS[day];
  if (minutes >= open * 60 && minutes < close * 60) {
    return { open: true, label: `Open now · until ${fmt(close)}` };
  }
  if (minutes < open * 60) {
    return { open: false, label: `Opens today at ${fmt(open)}` };
  }
  const [nextOpen] = HOURS[(day + 1) % 7];
  return { open: false, label: `Closed · opens ${fmt(nextOpen)} tomorrow` };
}

// Live open/closed pills
const status = openStatus();
document.querySelectorAll("[data-open-status]").forEach((el) => {
  el.classList.add(status.open ? "is-open" : "is-closed");
  const label = el.querySelector(".label");
  if (label) label.textContent = status.label;
});

// Highlight today in hours tables
const today = kingstonNow().day;
document.querySelectorAll("[data-day]").forEach((row) => {
  if (Number(row.dataset.day) === today) row.classList.add("is-today");
});

// Mobile nav
const toggle = document.querySelector(".menu-toggle");
const nav = document.getElementById("site-nav");
if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    nav.classList.toggle("is-open", !open);
  });
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      toggle.setAttribute("aria-expanded", "false");
      nav.classList.remove("is-open");
    }
  });
}

// Header border once scrolled
const header = document.querySelector(".site-header");
if (header) {
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

// Reveal on scroll
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
} else {
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
}

// Menu page: highlight the category chip for the section in view
const menuLinks = document.querySelectorAll(".menu-nav a");
if (menuLinks.length && "IntersectionObserver" in window) {
  const byId = new Map([...menuLinks].map((a) => [a.hash.slice(1), a]));
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        menuLinks.forEach((a) => a.classList.remove("is-active"));
        const link = byId.get(entry.target.id);
        if (link) {
          link.classList.add("is-active");
          link.scrollIntoView({ block: "nearest", inline: "center" });
        }
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  document.querySelectorAll(".menu-section").forEach((s) => spy.observe(s));
}

// Footer year
document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
