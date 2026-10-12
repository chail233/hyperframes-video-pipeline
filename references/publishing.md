# Ship it: cleanup, README, publishing

The last 10 % of a project is where an agent does the most damage: deleting the wrong cache,
committing a 120 MB mp4, or pushing someone else's artwork into a public repo.

## 1. Sort the folder before you delete anything

Three buckets — write the list down, don't eyeball it:

| Bucket | Examples | Action |
|---|---|---|
| **Source** | `index.html`, `compositions/` *if hand-authored*, `tools/spec/*`, `BRIEF.md`, `assets/vendor/*`, audio you own | keep, commit |
| **Derived** | generated frame HTML, `.verify/`, `.thumbnails/`, `.media/`, `snapshots/*.png`, `renders/*.mp4`, `node_modules/` | gitignore; delete freely *if a script rebuilds them* |
| **Input from elsewhere** | third-party art, reference screenshots, a fan-made character illustration | check licence before publishing |

Before deleting a "cache", confirm something regenerates it (run the audit that supposedly
rebuilds `.verify/` — a build script that only *reads* the cache makes the folder source, not
cache). Then **re-run the harness after the purge** — one freeze shot, one `check`. A cleanup
that breaks the pipeline is worse than a fat folder.

Duplicate-byte files are the one safe win: hash first (`md5sum`), delete only exact duplicates,
and never delete the *older* audio take silently — rename or document it as provenance.

## 2. What must NOT be pushed

- **Rendered video** (`renders/*.mp4` — tens to hundreds of MB). Point the README at a hosted
  copy instead, or accept it in the repo only with the user's explicit yes.
- **Music and lyrics you don't own.** The audio track, transcription-derived LRC, and cover
  artwork belong out of a public repo unless the user says otherwise. Ask once, in a single
  question, listing each file — then record the decision *and the restore commands* in the
  README so the project stays reproducible locally:
  ```bash
  ffmpeg -i assets/audio.mp3 -af apad -t 220 -c:a libmp3lame -q:a 0 assets/bgm.mp3
  ```
- **Third-party character art / reference images.** Keep the licence-visible chain working
  locally, exclude the files, and **credit the designer by name and source** wherever derived
  art ships. If a build script needs an excluded input, say so next to it.
- Secrets, `.env`, browser profiles, logs.

A README table of *"things deliberately absent from this repo"* (file, why, how to restore)
prevents the next person from calling it a bug.

## 3. Line endings

`core.autocrlf=true` on Windows commits CRLF into shell scripts, and a `*.sh` with `\r` fails
on every Linux clone (it can even land in the *committed blob*). Add:

```gitattributes
* text=auto eol=lf
*.sh text eol=lf
*.mjs *.js *.json *.md text eol=lf
*.png *.jpg *.mp3 *.mp4 *.gif binary
```

…then `git add --renormalize .` and check the blob, not the working file:
`git show HEAD:scripts/x.sh | grep -c $'\r'` must be `0`. Forward slashes in HTML/CSS/JS paths
also keep the composition portable — renders read file bytes.

## 4. README that makes the project runnable

Sections that carry their weight, in order: what it is (one paragraph) → the delivered
parameters as a *table* (duration, fps, resolution, frame count, codec) → **the two things to
read first** (licence/ownership, credit) → environment (Node version, whether `npm install` is
needed — with a vendored GSAP it usually isn't) → **run it** step by step with copy-pasteable
commands (place the audio → preview → edit + gates → render → verify pixels → verify sync) →
directory map marking source vs derived → known trade-offs. Every gotcha you already learned
belongs in "known trade-offs", otherwise the next model rediscovers it.

## 5. Publishing from a locked-down machine

Measured constraints, in the order they save time:

- `curl` to api.github.com and SSH port 22 can both be blocked while **`git` over HTTPS
  works** (Windows credential manager supplies the token). Try `git push` before assuming you
  can't publish, and set `GIT_TERMINAL_PROMPT=0` so a missing credential fails fast instead of
  hanging on a prompt the agent can't answer.
- `gh` is often absent. Use the GitHub MCP tools for repo creation and metadata.
- **MCP `-32602` is a known false positive on both read *and* write** operations. Before
  retrying a `create_repository` that "failed", check whether it actually succeeded
  (`search_repositories`). Blind retries create duplicate repos you then have to delete by hand.
- **Repo slugs must be pure ASCII English.** Non-ASCII or parenthesised names get sanitised into
  mush (中文 + `(me)` → `-3.8-world.execute-me-`), and there is **no rename or delete repository
  MCP tool** — you'd be stuck asking the user to visit Settings → Danger Zone. Translate the
  name to an English slug yourself and put the original title in the description and README.
- **Never `git credential fill`** to "check" auth: it prints the token into the transcript.
  Push, and read the error.

## 6. Commit hygiene for a delivery

Stage by name after a broad `git add` is not enough — run `git status` and *read* it before
pushing: a file that looks innocuous (`desktop.ini`, an exported reference JPG) can carry a path
or a face you didn't mean to publish. Confirm the excluded list is still excluded, then push.
After the push, verify the remote shows what you meant (`get_file_contents` / the repo page),
because a sanitised name or a partial push is invisible from local `git log`.
