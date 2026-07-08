const PAGE_SIZE = 100;
const DEBOUNCE_MS = 400;

let allJobs = [];
let filteredJobs = [];
let currentPage = 1;

const searchInput = document.getElementById("search");
const bucketFilter = document.getElementById("bucket-filter");
const sourceFilter = document.getElementById("source-filter");
const tbody = document.getElementById("jobs-body");
const statusEl = document.getElementById("status");
const lastUpdatedEl = document.getElementById("last-updated");
const pageInfo = document.getElementById("page-info");
const prevBtn = document.getElementById("prev-page");
const nextBtn = document.getElementById("next-page");

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const bucket = bucketFilter.value;
  const source = sourceFilter.value;

  filteredJobs = allJobs.filter((job) => {
    if (bucket !== "all" && job.bucket !== bucket) return false;
    if (source !== "all" && job.source !== source) return false;
    if (query) {
      const haystack = `${job.company} ${job.title}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

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
      <td>${escapeHtml(job.location)}</td>
      <td>${escapeHtml(job.source)}</td>
      <td>${escapeHtml(job.time_since_posted)}</td>
      <td>${escapeHtml((job.matched_keywords || []).join(", "))}</td>
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

bucketFilter.addEventListener("change", applyFilters);
sourceFilter.addEventListener("change", applyFilters);

prevBtn.addEventListener("click", () => {
  currentPage -= 1;
  renderPage();
});
nextBtn.addEventListener("click", () => {
  currentPage += 1;
  renderPage();
});

fetch("data/jobs.json")
  .then((res) => res.json())
  .then((data) => {
    allJobs = data.jobs;
    filteredJobs = data.jobs;
    if (data.generated_at) {
      const generated = new Date(data.generated_at);
      lastUpdatedEl.textContent = `Data last updated: ${generated.toLocaleString()}`;
    }
    renderPage();
  })
  .catch((err) => {
    statusEl.textContent = "Failed to load job data.";
    console.error(err);
  });
