# bruce

A static, read-only job board showing postings fetched from Greenhouse,
Lever, and Ashby job boards -- data pulled by
[bruce-bot](https://github.com/thedtripp/bruce-bot), a private job-search
automation project. This repo holds nothing but the published site:
plain HTML/CSS/JS, no build step, no backend.

`jobs.json` is regenerated and pushed here automatically 4x/day by
bruce-bot's `refresh_job_board.yml` workflow. `index.html`/`style.css`/
`app.js` are mirrored from bruce-bot's `docs/` folder immediately on any
change there (`publish_frontend.yml`), independent of that data-refresh
cadence.

**Every mirrored file (`index.html`, `css/style.css`, `js/app.js`,
`js/analytics.js`, `analytics/index.html`) has a "generated, do not edit
here" header comment for exactly this reason: a manual edit made directly
in this repo instead of in bruce-bot's `docs/` will silently get
overwritten by the next publish run.** This happened for real on
2026-07-08 (a logo/CSS fix); see this repo's `CLAUDE.md` for the
incident and how to avoid it. `img/bruce_logo.png`/`img/favicon.png` are
mirrored the same way but can't carry a text header (binary) -- replace
them at the source (bruce-bot's `docs/img/`) too.

Live site: served via GitHub Pages from this repo's `main` branch.

## TODO

- ~~**Remove scoring from the public board.**~~ Partially done
  (2026-07-11): the "Matched Keywords" column and `jobs.json`'s
  `matched_keywords` field are both gone (both were derived from the
  site owner's personal `config/skill_keywords.txt`, which doesn't mean
  anything to a visitor). `jobs.json`'s `score` field still ships,
  deliberately deferred -- nothing in the frontend renders it today, so
  there's no active bug, just unused data.
- **Add job-category filtering.** A user should be able to search e.g.
  "doctor" and get roles like "Physician." Plain substring match on
  `company`/`title` (today's `applyFilters()` in `js/app.js`) won't catch
  that -- needs a small keyword/synonym dictionary mapping search terms to
  related job-title terms (e.g. doctor -> physician, MD, medical
  officer), checked in addition to the literal substring match.
- **TODO (not started, 2026-07-11): an onboarding flow that asks a
  first-time visitor what kind of job/career they're going into, then
  tailors which postings get shown.** Aimed at making this a better demo
  project in its own right, not just a personal data mirror -- a visitor
  picking "nursing" or "software engineering" up front and seeing a
  filtered board is a much stronger portfolio showcase than the current
  one-size-fits-all list. Related to, but distinct from, the
  job-category-filtering item above: that one improves the search box for
  a visitor who already knows what to type; this is an upfront choice
  that reshapes the default view before they search at all. How the
  chosen career maps to which postings get included/excluded is
  undecided -- could be rule-based (keyword/title matching per career,
  same spirit as the synonym dictionary above), AI-based, or a set of
  predefined profiles -- needs real design before starting. Also
  undecided: where the choice lives (a URL param, so a filtered view is
  shareable/bookmarkable? `localStorage`, so it persists across visits?),
  and whether it reshapes what's fetched from `jobs.json` or stays a
  purely client-side filter over the same unfiltered data every visitor
  already gets today.
- ~~**Document the freshness window, and note room to expand it.**~~ Done
  (2026-07-09): the header now states the 72h rolling window explicitly.
  Still open: expanding to a 7-day or 30-day window is a reasonable
  future step, but do it carefully -- more days means a lot more data per
  refresh, so check that the static `jobs.json` fetch + client-side
  filtering approach (and GitHub Pages hosting) still holds up before
  widening the window, rather than assuming it scales for free.
- **TODO (not started, 2026-07-11): review for dead code in `js/app.js`/
  `css/style.css`, and confirm the current flat structure
  (`css/`/`js/`/`img/`/`data/`/`analytics/`) still makes sense.** No
  Python/build step here, so this is scoped to the frontend files
  themselves -- worth a pass given how much has landed this session
  (matched-keywords column removal, the analytics page, the two filtering
  TODOs above) without a cleanup pass in between.
- ~~**Hover tooltip showing a keyword's definition, once keyword
  matching/highlighting ships on this board.**~~ Shipped: matched
  keywords render per job (`job.matched_public_keywords`), each as a
  `.keyword-pill` with a native `title` attribute sourced from
  `data/public_keywords_metadata.jsonl`. In progress (2026-07-12):
  restyling the pill (was a fully bordered/circled shape, moving to a
  softer tag look with no border), replacing the native tooltip with a
  styled custom one (native `title` tooltips can't be restyled -- no
  font-size/color/layout control at all), and investigating load-time
  (the sequential `jobs.json` -> keyword-metadata fetch chain in
  `js/app.js` looks like the main cost, not the render-time page size,
  which is already capped at `PAGE_SIZE = 100`).
- **TODO (not started, 2026-07-12): consider a link to each company's
  website or Wikipedia page, alongside the existing per-posting link.**
  Possibly redundant -- every job row already links out to the real
  posting, which itself links to the company -- so worth confirming this
  adds real value (e.g. a quick "who is this company" check without
  leaving the board) before building it, not just adding a link because
  it's easy to add.
