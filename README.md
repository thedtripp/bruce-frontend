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
- ~~**Document the freshness window, and note room to expand it.**~~ Done
  (2026-07-09): the header now states the 72h rolling window explicitly.
  Still open: expanding to a 7-day or 30-day window is a reasonable
  future step, but do it carefully -- more days means a lot more data per
  refresh, so check that the static `jobs.json` fetch + client-side
  filtering approach (and GitHub Pages hosting) still holds up before
  widening the window, rather than assuming it scales for free.
