# bruce-frontend

A static, read-only job board showing postings fetched daily from
Greenhouse, Lever, and Ashby job boards -- data pulled by
[bruce](https://github.com/thedtripp/bruce), a private job-search
automation project. This repo holds nothing but the published site:
plain HTML/CSS/JS, no build step, no backend.

`jobs.json` is regenerated and pushed here automatically once a day by
bruce's scheduled workflow. `index.html`/`style.css`/`app.js` are
mirrored from bruce's `docs/` folder whenever they change there.

Live site: served via GitHub Pages from this repo's `main` branch.

## TODO

- **Remove scoring from the public board.** `jobs.json`'s `score` field
  and the "Matched Keywords" column (`js/app.js`) are both derived from
  the site owner's personal resume keyword profile
  (`SKILL_KEYWORDS` in bruce-bot's `daily_report.py`) -- they rank/annotate
  jobs by fit to one specific person, which doesn't make sense on a
  public-facing board. Drop the "Matched Keywords" column and stop
  surfacing `score` in the UI (and ideally stop shipping those fields in
  `jobs.json` at all, once bruce-bot's report email no longer needs them
  rendered the same way).
- **Add job-category filtering.** A user should be able to search e.g.
  "doctor" and get roles like "Physician." Plain substring match on
  `company`/`title` (today's `applyFilters()` in `js/app.js`) won't catch
  that -- needs a small keyword/synonym dictionary mapping search terms to
  related job-title terms (e.g. doctor -> physician, MD, medical
  officer), checked in addition to the literal substring match.
- **Document the freshness window, and note room to expand it.**
  Currently only the freshest jobs show up (bruce-bot's `HOURS_LOOKBACK`,
  72h). Call this out clearly in the UI/docs so it's not mistaken for a
  complete listing. Expanding to a 7-day or 30-day window is a reasonable
  future step, but do it carefully -- more days means a lot more data per
  refresh, so check that the static `jobs.json` fetch + client-side
  filtering approach (and GitHub Pages hosting) still holds up before
  widening the window, rather than assuming it scales for free.
