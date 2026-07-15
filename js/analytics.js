// GENERATED/MIRRORED FILE -- do not edit in the public `bruce` repo.
// This is the source; publish_frontend.yml copies it there verbatim on
// every push. Edit here (bruce-bot/docs/js/analytics.js) instead -- see
// bruce/CLAUDE.md for why.

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

// -------------------- Heatmap: postings by day/hour --------------------

const heatmapEl = document.getElementById("heatmap");
const heatmapStatusEl = document.getElementById("heatmap-status");
const heatmapSourceFilter = document.getElementById("heatmap-source-filter");
const heatmapTooltipEl = document.getElementById("hm-tooltip");
const legendEl = document.getElementById("hm-legend");

let histogram = {};

// company_key is "<source>:<token>" (see common/posting_analytics.py) --
// the prefix before the colon is the source.
function sourceOf(companyKey) {
  return companyKey.split(":")[0];
}

function aggregateHistogram(source) {
  const totals = {};
  DAYS.forEach((day) => {
    totals[day.key] = new Array(24).fill(0);
  });
  for (const [companyKey, byDay] of Object.entries(histogram)) {
    if (source !== "all" && sourceOf(companyKey) !== source) continue;
    DAYS.forEach((day) => {
      const hours = byDay[day.key] || [];
      hours.forEach((count, hour) => {
        totals[day.key][hour] += count;
      });
    });
  }
  return totals;
}

// Server-side buckets are stored in UTC (see common/posting_analytics.py --
// deliberately not pre-localized, so the same data works for any viewer).
// Rotate the whole day/hour grid into the viewer's own timezone here, at
// render time, rather than shipping per-viewer buckets from the server.
// Treats the week as a circular 168-hour timeline so a shift can carry a
// bucket into the adjacent day. Offset is rounded to the nearest whole
// hour -- exact for the US, an approximation for the handful of timezones
// with a 30/45-minute offset, which is an acceptable tradeoff for a
// day/hour heatmap.
function localOffsetHours() {
  return Math.round(-new Date().getTimezoneOffset() / 60);
}

function toLocalTime(totalsUtc) {
  const offset = localOffsetHours();
  const local = {};
  DAYS.forEach((day) => {
    local[day.key] = new Array(24).fill(0);
  });
  DAYS.forEach((day, dayIndex) => {
    totalsUtc[day.key].forEach((count, hour) => {
      const flat = (((dayIndex * 24 + hour + offset) % 168) + 168) % 168;
      local[DAYS[Math.floor(flat / 24)].key][flat % 24] += count;
    });
  });
  return local;
}

// Shared by both cell shading and the legend gradient, so the legend's
// endpoints always mean exactly what the cells are showing.
function alphaForCount(count, max) {
  if (count === 0) return 0.08;
  return 0.15 + (count / max) * 0.75;
}

function renderLegend(max) {
  const minColor = `rgba(9,105,218,${alphaForCount(0, max)})`;
  const maxColor = `rgba(9,105,218,${alphaForCount(max, max)})`;
  legendEl.innerHTML = `
    <span>0</span>
    <span class="hm-legend-bar" style="background: linear-gradient(to right, ${minColor}, ${maxColor})"></span>
    <span>${max}</span>
    <span class="hm-legend-caption">postings</span>
  `;
}

function renderHeatmap() {
  const totals = toLocalTime(aggregateHistogram(heatmapSourceFilter.value));
  const max = Math.max(1, ...DAYS.flatMap((day) => totals[day.key]));
  renderLegend(max);

  const cells = ['<div class="hm-corner"></div>'];
  HOURS.forEach((hour) => {
    cells.push(`<div class="hm-hour-label">${hour}</div>`);
  });
  DAYS.forEach((day) => {
    cells.push(`<div class="hm-label">${day.label}</div>`);
    HOURS.forEach((hour) => {
      const count = totals[day.key][hour];
      const alpha = alphaForCount(count, max);
      const tooltip = `${day.label} ${String(hour).padStart(2, "0")}:00 (your local time) -- ${count} posting(s)`;
      cells.push(
        `<div class="hm-cell" style="background: rgba(9,105,218,${alpha.toFixed(2)})" data-tooltip="${escapeHtml(tooltip)}"></div>`
      );
    });
  });
  heatmapEl.innerHTML = cells.join("");
}

heatmapSourceFilter.addEventListener("change", renderHeatmap);

heatmapEl.addEventListener("mousemove", (e) => {
  const cell = e.target.closest(".hm-cell");
  if (!cell) {
    heatmapTooltipEl.hidden = true;
    return;
  }
  heatmapTooltipEl.hidden = false;
  heatmapTooltipEl.textContent = cell.dataset.tooltip;
  heatmapTooltipEl.style.left = `${e.clientX + 12}px`;
  heatmapTooltipEl.style.top = `${e.clientY + 12}px`;
});
heatmapEl.addEventListener("mouseleave", () => {
  heatmapTooltipEl.hidden = true;
});

fetch("../data/posting_time_histogram.json")
  .then((res) => {
    if (!res.ok) throw new Error("histogram not found");
    return res.json();
  })
  .then((data) => {
    histogram = data;
    if (Object.keys(histogram).length === 0) {
      heatmapStatusEl.textContent = "No posting-time data yet -- check back after the next refresh.";
      return;
    }
    heatmapStatusEl.textContent = "";
    renderHeatmap();
  })
  .catch(() => {
    heatmapStatusEl.textContent = "No posting-time data yet -- check back after the next refresh.";
  });

// -------------------- Animated map: postings by location/time --------------------

const mapStatusEl = document.getElementById("map-status");
const playBtn = document.getElementById("play-btn");
const timeSlider = document.getElementById("time-slider");
const timeReadout = document.getElementById("time-readout");

const SLIDER_MAX = 1000;
const PLAY_DURATION_MS = 20000;
const PLAY_STEP_MS = 200;

// Circle sizing: grows with how many postings have accumulated at a
// location by the current point in the timeline, capped so a single busy
// spot (e.g. "Remote - US") can't dominate the map. sqrt growth means
// radius roughly tracks area, not raw count, so it doesn't runway.
const MIN_RADIUS = 5;
const MAX_RADIUS = 22;
const MAX_FILL_OPACITY = 0.55;
const MIN_FILL_OPACITY = 0.12;

function radiusForCount(count) {
  return Math.min(MAX_RADIUS, MIN_RADIUS + Math.sqrt(Math.max(0, count - 1)) * 4);
}

// Larger circles get more transparent fill so they don't fully occlude
// smaller circles nearby -- only the (always solid) border marks their
// true edge.
function fillOpacityForRadius(radius) {
  const t = (radius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS);
  return MAX_FILL_OPACITY - t * (MAX_FILL_OPACITY - MIN_FILL_OPACITY);
}

function popupContent(location, visiblePostings) {
  const maxLinks = 8;
  const shown = visiblePostings.slice(-maxLinks);
  const items = shown
    .map(
      (p) =>
        `<li>${escapeHtml(p.company)} -- <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">view</a></li>`
    )
    .join("");
  const more =
    visiblePostings.length > maxLinks ? `<li>+${visiblePostings.length - maxLinks} more</li>` : "";
  const count = visiblePostings.length;
  return (
    `<strong>${escapeHtml(location)}</strong> (${count} posting${count === 1 ? "" : "s"})` +
    `<ul class="map-popup-list">${items}${more}</ul>`
  );
}

let map, markerLayer;
let postings = [];
let locationGroups = [];
let minTime, maxTime;
let playTimer = null;

function initMap() {
  map = L.map("map", { scrollWheelZoom: false }).setView([39, -98], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}

function timeAtSlider(value) {
  return minTime + (value / SLIDER_MAX) * (maxTime - minTime);
}

// Postings at (nearly) the same coordinates -- typically the same
// location string, geocoded once and cached -- share one circle whose
// size reflects how many have accumulated there, rather than one circle
// per posting stacking up illegibly.
function groupByLocation(allPostings) {
  const groups = new Map();
  allPostings.forEach((p) => {
    const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
    if (!groups.has(key)) {
      groups.set(key, { lat: p.lat, lng: p.lng, location: p.location, postings: [] });
    }
    groups.get(key).postings.push(p);
  });
  return Array.from(groups.values());
}

function renderMapAt(currentTime) {
  markerLayer.clearLayers();
  let totalVisible = 0;
  locationGroups.forEach((group) => {
    const visiblePostings = group.postings.filter((p) => p.time <= currentTime);
    if (visiblePostings.length === 0) return;
    totalVisible += visiblePostings.length;

    const radius = radiusForCount(visiblePostings.length);
    const marker = L.circleMarker([group.lat, group.lng], {
      radius,
      color: "#0969da",
      weight: 2,
      opacity: 1,
      fillColor: "#0969da",
      fillOpacity: fillOpacityForRadius(radius),
    });
    marker.bindPopup(popupContent(group.location, visiblePostings));
    marker.addTo(markerLayer);
  });
  timeReadout.textContent = `${new Date(currentTime).toLocaleString()} -- ${totalVisible} posting(s)`;
}

function stopPlaying() {
  playBtn.textContent = "Play";
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
}

function startPlaying() {
  if (Number(timeSlider.value) >= SLIDER_MAX) {
    timeSlider.value = 0;
  }
  playBtn.textContent = "Pause";
  const stepAmount = SLIDER_MAX / (PLAY_DURATION_MS / PLAY_STEP_MS);
  playTimer = setInterval(() => {
    const next = Number(timeSlider.value) + stepAmount;
    if (next >= SLIDER_MAX) {
      timeSlider.value = SLIDER_MAX;
      renderMapAt(timeAtSlider(SLIDER_MAX));
      stopPlaying();
      return;
    }
    timeSlider.value = next;
    renderMapAt(timeAtSlider(next));
  }, PLAY_STEP_MS);
}

playBtn.addEventListener("click", () => {
  if (playTimer) {
    stopPlaying();
  } else {
    startPlaying();
  }
});

timeSlider.addEventListener("input", () => {
  stopPlaying();
  renderMapAt(timeAtSlider(Number(timeSlider.value)));
});

function parseJsonl(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

fetch("../data/postings_raw.jsonl")
  .then((res) => {
    if (!res.ok) throw new Error("raw postings not found");
    return res.text();
  })
  .then((text) => {
    const records = parseJsonl(text).filter((r) => r.lat != null && r.lng != null && r.first_published);
    postings = records
      .map((r) => ({
        lat: r.lat,
        lng: r.lng,
        time: new Date(r.first_published).getTime(),
        company: r.company_key,
        location: r.location,
        url: r.url,
      }))
      .filter((p) => Number.isFinite(p.time))
      .sort((a, b) => a.time - b.time);

    if (postings.length === 0) {
      mapStatusEl.textContent = "No geocoded posting data yet -- check back after the next refresh.";
      return;
    }

    minTime = postings[0].time;
    maxTime = postings[postings.length - 1].time;
    if (minTime === maxTime) {
      // Avoid a zero-length timeline when every posting shares one timestamp.
      maxTime = minTime + 1;
    }
    locationGroups = groupByLocation(postings);

    mapStatusEl.textContent = "";
    initMap();
    timeSlider.value = SLIDER_MAX;
    renderMapAt(maxTime);
  })
  .catch(() => {
    mapStatusEl.textContent = "No geocoded posting data yet -- check back after the next refresh.";
  });
