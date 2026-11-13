// Lay Low Cafe — small progressive enhancements. The page works without JS.
document.documentElement.classList.add("js");

// Opening hours in 24h time, Kingston local time. Index 0 = Sunday.
// Keep in sync with the hours text and the JSON-LD in index.html.
const HOURS = [
  [7, 16], // Sun
  [7, 16], // Mon
  [7, 16], // Tue
  [7, 16], // Wed
  [7, 16], // Thu
  [7, 16], // Fri
  [7, 16], // Sat
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
  return { open: false, label: `Closed · opens ${fmt(nextOpen)}` };
}

// Live open/closed pill
const status = openStatus();
document.querySelectorAll("[data-open-status]").forEach((el) => {
  el.classList.add(status.open ? "is-open" : "is-closed");
  el.querySelector(".label").textContent = status.label;
});

// Header border once scrolled
const header = document.querySelector(".site-header");
const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

// Menu tabs. Without JS every category simply shows, one after another.
const tablist = document.querySelector('[role="tablist"]');
if (tablist) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
  };
  tablist.hidden = false;
  select(tabs[0]);
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      const next = tabs[(i + step + tabs.length) % tabs.length];
      select(next);
      next.focus();
    });
  });
}

// Contact form: opens from the "Send us a message" button, sends to Formspree
// in the background and shows the result inline.
const form = document.querySelector("[data-contact-form]");
if (form) {
  const toggle = document.querySelector("[data-message-toggle]");
  toggle.addEventListener("click", () => {
    const open = !form.classList.contains("is-open");
    form.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    if (open) form.querySelector("input[name=name]").focus();
  });
  const status = form.querySelector("[data-form-status]");
  const button = form.querySelector("button[type=submit]");
  const fallback = 'Please call us at <a href="tel:+16135469080">(613) 546-9080</a> or DM <a href="https://www.instagram.com/laylowcafe/">@laylowcafe</a>.';
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (form.action.includes("YOUR_FORM_ID")) {
      status.innerHTML = "Our message form isn't connected yet. " + fallback;
      return;
    }
    button.disabled = true;
    button.textContent = "Sending…";
    try {
      const res = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      status.textContent = "Thanks, we got it! We'll get back to you soon.";
    } catch {
      status.innerHTML = "Sorry, that didn't send. " + fallback;
    } finally {
      button.disabled = false;
      button.textContent = "Send";
    }
  });
}

// Late Night events.
// If the list has a data-events-sheet URL (a Google Sheet published as CSV), the events come from
// that sheet, so the cafe can add events without touching the code. If the sheet can't be loaded,
// the events written into the HTML stay as a fallback. Either way, events hide once their day is
// over (Kingston time), so the list never goes stale.
const eventList = document.querySelector("[data-events]");
if (eventList) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date()); // YYYY-MM-DD

  const hidePastEvents = () => {
    eventList.querySelectorAll("[data-date]").forEach((li) => {
      if (li.dataset.date < today) li.remove();
    });
    document.querySelector("[data-events-empty]").hidden = !!eventList.querySelector("[data-date]");
  };

  hidePastEvents();

  const sheetUrl = (eventList.dataset.eventsSheet || "").trim();
  if (sheetUrl) {
    fetch(sheetUrl, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Events sheet returned ${res.status}`);
        return res.text();
      })
      .then((csv) => {
        const events = sheetToEvents(csv).filter((e) => e.date >= today);
        eventList.replaceChildren(...events.map(eventCard));
        document.querySelectorAll("script[data-events-ld]").forEach((s) => s.remove());
        if (events.length) {
          const ld = document.createElement("script");
          ld.type = "application/ld+json";
          ld.dataset.eventsLd = "";
          ld.textContent = JSON.stringify(events.map(eventJsonLd));
          document.head.append(ld);
        }
        hidePastEvents();
      })
      .catch((err) => console.warn("Couldn't load the events sheet; showing the built-in list.", err));
  }

  // Splits CSV text into rows of cells. Handles quoted cells with commas, quotes and line breaks.
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // Turns the sheet into event objects, using the header row to find each column,
  // so columns can be reordered and extra columns are ignored. Rows with no date or name are skipped.
  function sheetToEvents(csv) {
    const [header = [], ...rows] = parseCsv(csv);
    const key = (h) => h.toLowerCase().replace(/[^a-z]/g, "");
    const cols = header.map(key);
    const find = (...names) => cols.findIndex((c) => names.includes(c));
    const at = {
      date: find("date"),
      start: find("starttime", "start", "time"),
      end: find("endtime", "end"),
      name: find("eventname", "event", "name", "title"),
      description: find("description", "details"),
      price: find("price", "cost"),
      host: find("hostedby", "host", "with"),
    };
    const get = (row, i) => (i >= 0 && row[i] ? row[i].trim() : "");

    return rows
      .map((row) => ({
        date: toIsoDate(get(row, at.date)),
        start: get(row, at.start),
        end: get(row, at.end),
        name: get(row, at.name),
        description: get(row, at.description),
        price: get(row, at.price),
        host: get(row, at.host),
      }))
      .filter((e) => e.date && e.name)
      .sort((a, b) => a.date.localeCompare(b.date) || toMinutes(a.start) - toMinutes(b.start));
  }

  // Accepts 2026-11-20, 11/20/2026, "Nov 20, 2026", "Friday, November 20, 2026" and so on. Returns YYYY-MM-DD or "".
  function toIsoDate(value) {
    if (!value) return "";
    let m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    const d = new Date(value.replace(/^[a-z]+,\s*/i, ""));
    if (isNaN(d)) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // "6 PM", "6:30pm", "18:00" → minutes after midnight, or NaN.
  function toMinutes(value) {
    const m = (value || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?$/i);
    if (!m) return NaN;
    let h = Number(m[1]) % 24;
    const ap = (m[3] || "").toLowerCase();
    if (ap === "p" && h < 12) h += 12;
    if (ap === "a" && h === 12) h = 0;
    return h * 60 + Number(m[2] || 0);
  }

  // Builds one event card with the same markup as the hand-written ones. Uses textContent, so
  // whatever is typed into the sheet is shown as plain text, never as HTML.
  function eventCard(e) {
    const el = (tag, cls, text) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text != null) node.textContent = text;
      return node;
    };
    const [y, mo, d] = e.date.split("-").map(Number);
    const day = new Date(y, mo - 1, d);
    const weekday = day.toLocaleDateString("en-CA", { weekday: "short" });
    const month = day.toLocaleDateString("en-CA", { month: "short" }).replace(".", "");

    const li = el("li", "event");
    li.dataset.date = e.date;

    const dateBox = el("div", "event-date");
    dateBox.append(el("span", null, `${weekday} · ${month}`), el("strong", null, String(d)));

    const body = el("div");
    body.append(el("h3", null, e.name));
    const time = [e.start, e.end].filter(Boolean).join("–");
    if (time) body.append(el("p", "event-meta", time));
    if (e.description) body.append(el("p", null, e.description));
    if (e.price || e.host) {
      const chips = el("div", "chips");
      if (e.price) chips.append(el("span", "gold", e.price));
      if (e.host) chips.append(el("span", null, /^(hosted|with|by)\b/i.test(e.host) ? e.host : `Hosted by ${e.host}`));
      body.append(chips);
    }

    li.append(dateBox, body);
    return li;
  }

  // Event details for Google, built from the same sheet rows.
  function eventJsonLd(e) {
    const offset = (iso) => {
      // Kingston is UTC-4 in summer (EDT) and UTC-5 in winter (EST).
      const probe = new Date(`${iso}T12:00:00Z`);
      const tz = probe.toLocaleString("en-US", { timeZone: "America/Toronto", timeZoneName: "short" });
      return tz.includes("EDT") ? "-04:00" : "-05:00";
    };
    const stamp = (time) => {
      const mins = toMinutes(time);
      if (isNaN(mins)) return e.date;
      const hh = String(Math.floor(mins / 60)).padStart(2, "0");
      const mm = String(mins % 60).padStart(2, "0");
      return `${e.date}T${hh}:${mm}:00${offset(e.date)}`;
    };
    const ld = {
      "@context": "https://schema.org",
      "@type": "Event",
      name: e.name,
      startDate: stamp(e.start),
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      location: { "@type": "Place", name: "Lay Low Cafe", address: "241 Princess St, Kingston, ON K7L 1B3" },
    };
    if (e.end && !isNaN(toMinutes(e.end))) ld.endDate = stamp(e.end);
    if (e.description) ld.description = e.description;
    return ld;
  }
}

// Footer year
document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
