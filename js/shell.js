// Shared page frame: renders the nav and footer from one page list, so
// adding a new page means adding one entry here instead of editing every
// HTML file's nav. Each page opts in with `<nav id="site-nav">` and
// `<footer id="site-footer">` placeholders, plus two data attributes on
// <body>: data-page (this page's id, for the active nav link) and
// data-base (the relative path back to the site root, e.g. "" at the root
// or "../" from inside projects/).
//
// Every visible string is tagged with data-i18n so js/i18n.js (loaded
// first) can swap it when the language button is toggled.
(() => {
  const PAGES = [
    { id: 'resume', title: 'Resume', href: 'index.html' },
    { id: 'snake', title: 'Snake', href: 'projects/snake.html' },
    { id: 'camera', title: 'Camera', href: 'projects/camera.html' },
    { id: 'astar', title: 'A*', href: 'projects/astar.html' },
    { id: 'bezier', title: 'Bezier', href: 'projects/bezier.html' },
    { id: 'green', title: 'Green Energy', href: 'projects/green-energy.html' },
  ];

  const base = document.body.dataset.base || '';
  const currentPage = document.body.dataset.page || '';

  function renderNav() {
    const nav = document.getElementById('site-nav');
    if (!nav) return;

    const brand = document.createElement('a');
    brand.href = base + 'index.html';
    brand.className = 'brand';
    brand.textContent = 'EJ';
    nav.appendChild(brand);

    const links = document.createElement('div');
    links.className = 'nav-links';
    for (const page of PAGES) {
      const a = document.createElement('a');
      a.href = base + page.href;
      a.textContent = page.title;
      a.dataset.i18n = 'nav.' + page.id;
      if (page.id === currentPage) a.classList.add('active');
      links.appendChild(a);
    }

    // Language toggle. The label names the language you'd switch *to*
    // ("中文" while in English, "EN" while in Chinese).
    const langBtn = document.createElement('button');
    langBtn.type = 'button';
    langBtn.className = 'lang-btn';
    langBtn.addEventListener('click', () => {
      I18N.toggle();
      refreshLangBtn();
    });
    function refreshLangBtn() {
      langBtn.textContent = I18N.t('lang.switch');
      langBtn.setAttribute('aria-label', I18N.t('lang.switchLabel'));
    }
    refreshLangBtn();
    links.appendChild(langBtn);

    nav.appendChild(links);
  }

  function renderFooter() {
    const footer = document.getElementById('site-footer');
    if (!footer) return;

    const rev = document.createElement('span');
    rev.textContent = 'REV. 2026-08 · BUILT AS A STATIC PAGE';
    rev.dataset.i18n = 'footer.rev';
    footer.appendChild(rev);

    // Opt-in extra footer content per page, e.g. <footer id="site-footer"
    // data-extra="print">. Add more cases here if a future page needs its
    // own footer button.
    if (footer.dataset.extra === 'print') {
      const btn = document.createElement('button');
      btn.className = 'print-btn';
      btn.textContent = 'Download as PDF';
      btn.dataset.i18n = 'footer.print';
      btn.addEventListener('click', () => window.print());
      footer.appendChild(btn);
    }
  }

  renderNav();
  renderFooter();
  // Translate the nav/footer we just rendered if Chinese is selected.
  I18N.apply();
})();
