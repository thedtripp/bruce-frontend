# bruce (public frontend)

Read `README.md` first for what this repo is. This file is for things worth
knowing *before* touching anything here.

## This repo has no source of truth of its own

Every file here is either mirrored from `bruce-bot`'s `docs/` (code:
`index.html`, `css/style.css`, `js/app.js`, `js/analytics.js`,
`analytics/index.html`, `img/*`) or freshly regenerated each run by
`bruce-bot`'s Python scripts (data: `data/jobs.json`,
`data/posting_time_histogram.json`, `data/postings_raw.jsonl`). Nothing
in this repo is hand-authored *here* -- it's a pure publish target for
GitHub Pages, kept in a separate public repo only because Pages requires
a public repo on the Free plan and `bruce-bot` itself stays private.

**Never edit the mirrored code files in this repo directly.** Edit the
corresponding file in `bruce-bot`'s `docs/` instead; the change ships
here automatically (`publish_frontend.yml`, triggered by any push to
`docs/index.html`/`docs/analytics/**`/`docs/css/**`/`docs/js/**`/
`docs/img/**`). Every mirrored code file has a "generated, do not edit
here" header comment as of 2026-07-11 for exactly this reason --
`img/bruce_logo.png`/`img/favicon.png` are the exception (binary, can't
carry a comment), so replace those at the source too.

**Real incident, not a hypothetical:** on 2026-07-08, a logo/CSS fix was
made directly in this repo instead of in `bruce-bot`'s `docs/`. The next
scheduled `refresh_job_board.yml` run mirrored from `bruce-bot`'s (still
unfixed) `docs/` and silently overwrote it. Fixed same day (commit
`f2d9b8f`) by reapplying the fix *and* back-porting it into `bruce-bot`'s
`docs/` -- but nothing structurally prevents this from happening again
besides the header comments added afterward. If you're about to edit a
file here and it doesn't have one, stop and check `bruce-bot`'s `docs/`
first.

## Two independent publish paths, different files, different triggers

- **`refresh_job_board.yml`** (in `bruce-bot`, cron every 12h): writes
  `data/jobs.json` freshly + mirrors the analytics data files
  (`data/posting_time_histogram.json`, `data/postings_raw.jsonl`).
  Commit message: `"Update job board for <timestamp>"`.
- **`publish_frontend.yml`** (in `bruce-bot`, triggered on push to
  `docs/`): mirrors only the static code files listed above, never
  touches `data/*`. Commit message: `"Publish frontend update from
  bruce-bot@<sha>"`. Exists so a code change ships immediately instead of
  waiting for the next scheduled data refresh.

Both push independently to this repo's `main` via
`bruce-bot/scripts/git_commit_and_push.sh` (fetch + rebase + retry on a
rejected push), since they can run close together.

## Gotcha: a stale local clone looks exactly like a real sync bug

If you're diagnosing "the public site doesn't match `bruce-bot`'s
`docs/`," **`git fetch origin main` here before concluding anything is
actually broken.** This repo gets pushed to by CI multiple times a day;
a local clone that hasn't been fetched in a while will show what looks
like real drift (missing recent CSS, missing whole pages) that's
entirely explained by the clone being behind, not by the publish
pipeline failing. Confirmed this exact false alarm while investigating
the 2026-07-08 incident above (2026-07-11) -- checked
`gh run list --workflow=publish_frontend.yml` and
`gh run list --workflow=refresh_job_board.yml` in `bruce-bot` first if
you want to verify the pipeline itself is actually healthy, rather than
comparing against a local checkout that might just be old.

## Testing

No code to test here. `bruce-bot`'s own test suite covers the generation
logic (`write_web_snapshot()` etc.); this repo is verified by checking
recent workflow runs succeeded and the live site matches, not by running
anything in this repo itself.
