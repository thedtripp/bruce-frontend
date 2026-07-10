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

function renderHeatmap() {
  const totals = aggregateHistogram(heatmapSourceFilter.value);
  const max = Math.max(1, ...DAYS.flatMap((day) => totals[day.key]));

  const cells = ['<div class="hm-corner"></div>'];
  HOURS.forEach((hour) => {
    cells.push(`<div class="hm-hour-label">${hour % 3 === 0 ? hour : ""}</div>`);
  });
  DAYS.forEach((day) => {
    cells.push(`<div class="hm-label">${day.label}</div>`);
    HOURS.forEach((hour) => {
      const count = totals[day.key][hour];
      const intensity = count / max;
      const alpha = count === 0 ? 0.08 : 0.15 + intensity * 0.75;
      const title = `${day.label} ${String(hour).padStart(2, "0")}:00 UTC -- ${count} posting(s)`;
      cells.push(
        `<div class="hm-cell" style="background: rgba(9,105,218,${alpha.toFixed(2)})" title="${escapeHtml(title)}"></div>`
      );
    });
  });
  heatmapEl.innerHTML = cells.join("");
}

heatmapSourceFilter.addEventListener("change", renderHeatmap);

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

let map, markerLayer;
let postings = [];
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

function renderMapAt(currentTime) {
  markerLayer.clearLayers();
  const visible = postings.filter((p) => p.time <= currentTime);
  visible.forEach((p) => {
    const marker = L.circleMarker([p.lat, p.lng], {
      radius: 5,
      color: "#0969da",
      fillColor: "#0969da",
      fillOpacity: 0.7,
      weight: 1,
    });
    marker.bindPopup(
      `<strong>${escapeHtml(p.company)}</strong><br>${escapeHtml(p.location)}<br>` +
        `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">View posting</a>`
    );
    marker.addTo(markerLayer);
  });
  timeReadout.textContent = `${new Date(currentTime).toLocaleString()} -- ${visible.length} posting(s)`;
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

    mapStatusEl.textContent = "";
    initMap();
    timeSlider.value = SLIDER_MAX;
    renderMapAt(maxTime);
  })
  .catch(() => {
    mapStatusEl.textContent = "No geocoded posting data yet -- check back after the next refresh.";
  });
