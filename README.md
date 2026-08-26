# EJ — Resume

A small multi-page static site styled like a hardware datasheet / rating
plate — a nod to working with battery storage rack products. Plain HTML,
CSS, and JS (no build step, no framework), so it's easy to host anywhere
and easy to edit.

```
ej-resume/
├── index.html      Resume page
├── snake.html       Snake game page ("Self-Test")
├── camera.html       Live camera preview page ("Optical Sensor")
├── css/
│   ├── style.css    Shared styles: nameplate, sections, nav, panel/overlay, tokens
│   ├── snake.css     Snake-only styles
│   └── camera.css    Camera-only styles
└── js/
    ├── main.js       Shared behavior (scroll reveal)
    ├── snake.js       Game logic
    └── camera.js      Camera permission + live preview + capture
```

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

To add another page later: copy `index.html` as a starting template,
keep the `<link>`/`<script>` tags to `css/style.css` and `js/main.js`,
and add a nav link to it in both existing pages' `.nav-links`.

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
