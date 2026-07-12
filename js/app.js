// GENERATED/MIRRORED FILE -- do not edit in the public `bruce` repo.
// This is the source; publish_frontend.yml copies it there verbatim on
// every push. Edit here (bruce-bot/docs/js/app.js) instead -- see
// bruce/CLAUDE.md for why.

const PAGE_SIZE = 100;
const DEBOUNCE_MS = 400;

let allJobs = [];
let filteredJobs = [];
let currentPage = 1;

const searchInput = document.getElementById("search");
const sourceFilter = document.getElementById("source-filter");
const sortBy = document.getElementById("sort-by");
const tbody = document.getElementById("jobs-body");
const statusEl = document.getElementById("status");
const lastUpdatedEl = document.getElementById("last-updated");
const pageInfo = document.getElementById("page-info");
const prevBtn = document.getElementById("prev-page");
const nextBtn = document.getElementById("next-page");

const publicKeywordDefinitions = new Map();

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

function loadPublicKeywordDefinitions() {
  return fetch("data/public_keywords_metadata.jsonl")
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to load public keyword metadata: ${res.status}`);
      }
      return res.text();
    })
    .then((text) => {
      publicKeywordDefinitions.clear();
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const record = JSON.parse(trimmed);
        if (record.term) {
          publicKeywordDefinitions.set(record.term, record.definition || "");
        }
      }
    })
    .catch((err) => {
      console.warn(err);
      publicKeywordDefinitions.clear();
    });
}

// data-tooltip (read by the .keyword-pill::after CSS rule below), not the
// native title attribute -- title tooltips are OS-rendered and can't be
// restyled at all (no font-size/color/layout control), which is exactly
// why the definition text was small and plain before. tabindex/aria-label
// give keyboard/screen-reader users an equivalent, since the generated
// ::after content itself isn't reliably exposed to assistive tech.
function formatMatchedKeywords(keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) return "—";
  return keywords
    .map((keyword) => {
      const definition = publicKeywordDefinitions.get(keyword);
      if (!definition) {
        return `<span class="keyword-pill">${escapeHtml(keyword)}</span>`;
      }
      const label = escapeHtml(`${keyword}: ${definition}`);
      return `<span class="keyword-pill" tabindex="0" aria-label="${label}" data-tooltip="${escapeHtml(definition)}">${escapeHtml(keyword)}</span>`;
    })
    .join("");
}

// job.time_since_posted is a string baked in at snapshot-generation time
// ("2h ago") -- accurate then, but never recomputed, so it silently goes
// stale the longer it's been since the last refresh or since this tab was
// loaded. Compute it live from posted_at (a raw timestamp) against the
// browser's actual clock instead. Mirrors common/job_board_common.py's
// time_since_posted() formatting for consistency with the email/issue
// reports.
function formatTimeAgo(isoString) {
  if (!isoString) return "unknown";
  const posted = new Date(isoString);
  if (Number.isNaN(posted.getTime())) return "unknown";
  const totalMinutes = Math.max(0, Math.floor((Date.now() - posted.getTime()) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ago`;
  if (hours > 0) return `${hours}h ${minutes}m ago`;
  return `${minutes}m ago`;
}

// Jobs arrive from jobs.json in a deliberately neutral order (not ranked
// by anyone's resume/location preferences -- see write_web_snapshot()'s
// docstring in the bruce-bot repo). Recency is the default sort (newest
// first) rather than that raw fetch order, since posted date is an
// objective fact about the data, not a personal preference. Score-based
// sorting was removed entirely (not just as a non-default option) --
// score comes from this user's personal resume-keyword config, so
// "relevance" here would always mean relevance to one specific person,
// not to whoever's actually looking at the board (2026-07-09).
function applySort(jobs, sortKey) {
  const sorted = jobs.slice();
  if (sortKey === "company") {
    sorted.sort((a, b) => a.company.localeCompare(b.company));
  } else {
    sorted.sort((a, b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0));
  }
  return sorted;
}

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const source = sourceFilter.value;

  // No location/bucket filter here -- location_tier()'s Bay-Area-or-
  // US-remote split is this user's personal target metro, not a
  // generalizable category, so it's been pulled entirely rather than
  // just hidden. See write_web_snapshot()'s docstring in the bruce-bot
  // repo (2026-07-09) for the reasoning; a location filter based on more
  // generalized principles is future work, not a restoration of this one.
  const matched = allJobs.filter((job) => {
    if (source !== "all" && job.source !== source) return false;
    if (query) {
      const haystack = `${job.company} ${job.title}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
  filteredJobs = applySort(matched, sortBy.value);

  currentPage = 1;
  renderPage();
}

function renderPage() {
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageJobs = filteredJobs.slice(start, start + PAGE_SIZE);

  const rows = pageJobs
    .map(
      (job) => `
    <tr>
      <td>${escapeHtml(job.company)}</td>
      <td>${escapeHtml(job.title)}</td>
      <td class="job-keywords">${formatMatchedKeywords(job.matched_public_keywords)}</td>
      <td>${escapeHtml(job.location)}</td>
      <td>${escapeHtml(job.source)}</td>
      <td>${escapeHtml(formatTimeAgo(job.posted_at))}</td>
      <td><a href="${escapeHtml(job.url)}" target="_blank" rel="noopener noreferrer">View</a></td>
    </tr>`
    )
    .join("");

  tbody.innerHTML = rows || '<tr><td colspan="7">No matching jobs.</td></tr>';
  statusEl.textContent = `${filteredJobs.length} matching job(s) of ${allJobs.length} total`;
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}

let debounceTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyFilters, DEBOUNCE_MS);
});

sourceFilter.addEventListener("change", applyFilters);
sortBy.addEventListener("change", applyFilters);

prevBtn.addEventListener("click", () => {
  currentPage -= 1;
  renderPage();
});
nextBtn.addEventListener("click", () => {
  currentPage += 1;
  renderPage();
});

// Re-render every minute so "posted X ago" keeps counting forward for a
// tab left open, instead of freezing at whatever it said on page load --
// re-filtering/re-sorting isn't needed, just refreshing the displayed age.
setInterval(renderPage, 60000);

// jobs.json and the keyword-metadata file used to be fetched sequentially
// (keyword metadata only starting *after* jobs.json fully resolved),
// which meant the page's first render waited for both fetches' full
// duration added together. loadPublicKeywordDefinitions() already
// swallows its own errors (falls back to no definitions rather than
// rejecting), so running both in parallel here can't change what happens
// on a keyword-metadata failure -- only jobs.json failing still fails
// the whole load, same as before.
Promise.all([
  fetch("data/jobs.json").then((res) => {
    if (!res.ok) {
      throw new Error(`Failed to load jobs.json: ${res.status}`);
    }
    return res.json();
  }),
  loadPublicKeywordDefinitions(),
])
  .then(([data]) => {
    allJobs = data.jobs;
    if (data.generated_at) {
      const generated = new Date(data.generated_at);
      lastUpdatedEl.textContent = `Data last updated: ${generated.toLocaleString()}`;
    }
    applyFilters();
  })
  .catch((err) => {
    statusEl.textContent = "Failed to load job data.";
    console.error(err);
  });
