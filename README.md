# EJ — Resume

A small multi-page static site styled like a hardware datasheet / rating
plate — a nod to working with battery storage rack products. Plain HTML,
CSS, and JS (no build step, no framework), so it's easy to host anywhere
and easy to edit.

```
ej-resume/
├── index.html            Resume page (must stay at the root)
├── projects/
│   ├── snake.html         Snake game page ("Self-Test")
│   ├── camera.html        Live camera preview page ("Optical Sensor")
│   ├── astar.html         A* pathfinding visualizer
│   └── bezier.html        Bezier curve / De Casteljau visualizer
├── css/
│   ├── style.css          Shared styles: nameplate, sections, nav, panel/overlay, tokens
│   ├── snake.css          Snake-only styles
│   ├── camera.css         Camera-only styles
│   ├── astar.css          A*-only styles
│   └── bezier.css         Bezier-only styles
└── js/
    ├── shell.js            Renders the shared nav + footer from one page list
    ├── main.js             Shared behavior (scroll reveal)
    ├── snake.js            Game logic
    ├── camera.js            Camera permission + live preview + capture
    ├── astar.js            A* search logic
    └── bezier.js           Bezier curve / De Casteljau logic
```

The nav and footer aren't hand-written on every page — `js/shell.js` renders
them from one `PAGES` list into `<nav id="site-nav">` / `<footer
id="site-footer">` placeholders, based on two `data-*` attributes each page
sets on `<body>`: `data-page` (its id, so shell.js knows which nav link is
"active") and `data-base` (the relative path back to the site root — `""`
for `index.html`, `"../"` for anything in `projects/`).

The camera page asks for permission only when the visitor clicks **Enable
Camera** — nothing is requested automatically, and nothing is uploaded
anywhere. The stream stops automatically if the visitor switches tabs or
leaves the page. Note: camera access requires a secure context, so it
works over HTTPS (GitHub Pages) or on `localhost`, but **not** if someone
opens `camera.html` directly as a local `file://` path.

## 1. Preview it locally

Just open `index.html` in a browser, or serve it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## 2. Personalize it

Open `index.html` and search for these placeholders, replacing each:

- `EJ` in the `<h1 class="name">` — your full name
- `Software Engineer — Full-Stack & Applied Systems` — your headline
- `you@email.com`, `City, Country`, GitHub/LinkedIn links
- The Experience section — real company name, dates, and 2–3 bullets
  with concrete outcomes
- The Projects section — Flux is filled in; add or edit others
- The Education section

`snake.html` needs no editing to work, but the high score, speed, and
colors are all adjustable in `js/snake.js` if you want to tune it.

To add another page later:

1. Copy an existing `projects/*.html` page as a starting template — keep
   the `<link>` tags to `../css/style.css`, the `<nav id="site-nav">` /
   `<footer id="site-footer">` placeholders, the `data-page` /
   `data-base="../"` attributes on `<body>`, and the `<script>` tags to
   `../js/shell.js` and `../js/main.js`.
2. Add one entry for it to the `PAGES` array at the top of `js/shell.js`.

That's it — every page's nav updates automatically, since they all render
from that one list.

## 3. Publish it so it's browsable anywhere (GitHub Pages)

This folder is already a git repo with an initial commit. To put it online:

```bash
# 1. Create an empty repository on GitHub first (no README/license), e.g. "ej-resume"

# 2. Point this local repo at it
git remote add origin https://github.com/<your-username>/ej-resume.git

# 3. Push
git push -u origin main
```

Then on GitHub: **Settings → Pages → Source → Deploy from a branch →
Branch: `main`, folder: `/ (root)` → Save.**

After a minute or two your resume is live at:

```
https://<your-username>.github.io/ej-resume/
```

That URL is the "browsable anywhere" link — share it directly, or link to
it from LinkedIn/your GitHub profile.

### Updating it later

```bash
git add -A
git commit -m "Update resume"
git push
```

GitHub Pages redeploys automatically on every push to `main`.

### Alternatives to GitHub Pages

- **Netlify / Vercel** — drag-and-drop this folder in their dashboard, or
  connect the GitHub repo for auto-deploys on push.
- **GitLab Pages** — same idea as GitHub Pages if you push to GitLab instead.
- A **custom domain** can be pointed at any of the above later, if you want
  something nicer than the default `github.io` URL.
