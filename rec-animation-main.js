/* Product data is read from the Elementor "Content Description Cards"
   already on the page, so editing a card in Elementor updates the
   shelf dialog too — there's no second copy to keep in sync. Each
   card is the top-level column holding an <h1 aria-label> tape image;
   it's matched to a shelf tape by its "Learn more" link, which is the
   same URL the tape links to. */
window.RH_PRODUCTS = (() => {
  const FIELD_KEYS = {
    'short description':       'summary',
    'pricing':                 'pricing',
    'technical comfort level': 'level',
    'ideal for':               'idealFor',
    'not recommended for':     'notFor',
    'popular use cases':       'useCases',
    'key features':            'features',
  };
  const LIST_KEYS = ['idealFor', 'notFor', 'useCases', 'features'];

  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const normUrl = (u) => {
    try { return new URL(u, location.href).href.replace(/\/+$/, ''); }
    catch (e) { return u; }
  };

  const tapes = [...document.querySelectorAll('#rh-shelf .rh-tape')];
  const keyByUrl = new Map(tapes.map((t) => [normUrl(t.getAttribute('href')), t.dataset.product]));

  const readCard = (card) => {
    const h1 = card.querySelector('h1[aria-label]');
    const img = h1.querySelector('img');
    const p = {
      name: clean(h1.getAttribute('aria-label')),
      img: img ? img.getAttribute('src') : '',
      summary: '', pricing: '', level: '',
      idealFor: [], notFor: [], useCases: [], features: [],
      url: '', cta: '', next: null, nextHref: '', nextLabel: '',
    };

    /* Each heading is an icon-list widget; its value is the
       text-editor widget that follows it in the same column. */
    card.querySelectorAll('.elementor-widget-icon-list').forEach((head) => {
      const key = FIELD_KEYS[clean(head.textContent).replace(/:$/, '').toLowerCase()];
      let body = head.nextElementSibling;
      while (body && !body.matches('.elementor-widget-text-editor')) body = body.nextElementSibling;
      if (!key || !body) return;
      const items = [...body.querySelectorAll('li')].map((li) => clean(li.textContent)).filter(Boolean);
      p[key] = LIST_KEYS.includes(key)
        ? (items.length ? items : [clean(body.textContent)].filter(Boolean))
        : clean(body.textContent);
    });

    card.querySelectorAll('.elementor-widget-button a.elementor-button').forEach((a) => {
      const href = a.getAttribute('href') || '';
      const label = clean(a.textContent);
      if (href.startsWith('#')) { p.nextHref = href; p.nextLabel = label; }
      else if (!p.url) { p.url = href; p.cta = label; }
    });
    return p;
  };

  const products = {};
  const keyByCard = new Map();
  document.querySelectorAll('.elementor-top-column h1[aria-label]').forEach((h1) => {
    const card = h1.closest('.elementor-top-column');
    const p = readCard(card);
    const key = keyByUrl.get(normUrl(p.url));
    if (!key || products[key]) return;
    products[key] = p;
    keyByCard.set(card, key);
  });

  /* "Not Quite the Right Fit?" jumps to another card's anchor on the
     page; resolve that anchor to the product it belongs to. */
  Object.values(products).forEach((p) => {
    let target = null;
    try { target = p.nextHref && document.querySelector(p.nextHref); } catch (e) { /* bad selector */ }
    const card = target && (target.closest('.elementor-top-column') || target);
    p.next = (card && keyByCard.get(card)) || null;
    delete p.nextHref;
  });

  /* A tape with no card on the page (e.g. ReclaimEDU) still opens,
     with just its name, optional data-img art and link. */
  tapes.forEach((t) => {
    const key = t.dataset.product;
    if (products[key]) return;
    const label = t.querySelector('.rh-tape__label');
    products[key] = {
      name: clean(label ? label.textContent : t.textContent),
      img: t.dataset.img || '',
      summary: '', pricing: '', level: '',
      idealFor: [], notFor: [], useCases: [], features: [],
      url: t.getAttribute('href') || '', cta: '', next: null, nextLabel: '',
    };
  });

  return products;
})();


(() => {
  'use strict';

  const PRODUCTS = window.RH_PRODUCTS;
  /* Starting tilt for the hero image, per tape shape — a spine reads
     sideways on the shelf so it turns upright like the mockup's tape;
     a disc/flat product is already right-side-up, so it only grows. */
  const HERO_START_ROTATE = { spine: -90, disc: 0, flat: 0 };

  const shelf   = document.getElementById('rh-shelf');
  const dialog  = document.getElementById('rh-dialog');
  const titleEl   = document.getElementById('rh-dialog-title');
  const gridEl    = document.getElementById('rh-dialog-grid');
  const actionsEl = document.getElementById('rh-dialog-actions');
  const closeBtn = document.getElementById('rh-dialog-close');

  if (!shelf || !dialog || typeof dialog.showModal !== 'function') return;

  let activeTape = null;
  let pendingTape = null;
  let busy = false;

  /* Resolves once every transition on `el` finishes. A timeout is a
     backstop, not the plan: the reveal must never stay gated on a
     decorative transition that stalls or never starts (this also
     covers reduced-motion / any-motion CSS override, where no
     transition ever runs and this resolves on the next microtask). */
  const afterTransition = (el) => new Promise((resolve) => {
    const anims = el.getAnimations();
    if (!anims.length) { resolve(); return; }
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };
    Promise.all(anims.map((a) => a.finished)).then(finish, finish);
    setTimeout(finish, 1400);
  });

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  /* Two frames: the first commits the "start" pose as an actually
     rendered frame, the second is where adding .active is allowed to
     be observed as a change rather than coalesced away. */
  const nextFrame = () =>
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  /* Links are correct without JS; buttons are correct with it. */
  const upgradeToButtons = () => {
    shelf.querySelectorAll('a.rh-tape').forEach((link) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = link.className;
      btn.innerHTML = link.innerHTML;
      btn.setAttribute('style', link.getAttribute('style'));
      Object.entries(link.dataset).forEach(([k, v]) => { btn.dataset[k] = v; });
      link.replaceWith(btn);
    });
  };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const field = (label, value, full) => {
    if (!value || (Array.isArray(value) && !value.length)) return '';
    const inner = Array.isArray(value)
      ? `<ul>${value.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
      : `<p>${esc(value)}</p>`;
    return `<div class="rh-field${full ? ' rh-field--full' : ''}">` +
           `<h3>${esc(label)}</h3><div class="rh-field__body">${inner}</div></div>`;
  };

  const fillDialog = (p, tape) => {
    /* The tape art carries the product name as its alt text, so the
       heading reads correctly without a visible duplicate title. */
    titleEl.className = 'rh-dialog__title' + (p.img ? '' : ' rh-dialog__title--text');
    titleEl.innerHTML = p.img
      ? `<img src="${esc(p.img)}" alt="${esc(p.name)}">`
      : esc(p.name);

    const heroImg = titleEl.querySelector('img');
    if (heroImg) {
      heroImg.style.setProperty(
        '--rh-hero-start-rotate',
        `${HERO_START_ROTATE[tape.dataset.shape] ?? -90}deg`
      );
    }

    gridEl.innerHTML =
      field('Short Description:', p.summary, true) +
      field('Pricing:', p.pricing) +
      field('Technical Comfort Level:', p.level) +
      field('Ideal for:', p.idealFor) +
      field('Not recommended for:', p.notFor) +
      field('Popular Use Cases:', p.useCases) +
      field('Key Features:', p.features);

    const next = p.next && PRODUCTS[p.next];
    actionsEl.innerHTML =
      `<a class="rh-btn rh-btn--primary" href="${esc(p.url)}">${esc(p.cta || `Learn more about ${p.name}`)}</a>` +
      (next ? `<button type="button" class="rh-btn rh-btn--secondary" data-next="${esc(p.next)}">` +
              `${esc(p.nextLabel || 'Not Quite the Right Fit?')}</button>` : '');

    return heroImg;
  };

  /* Mirrors .click-DoOO / .DoOODescription exactly, just inside the
     dialog instead of inline on the page: the hero image starts
     turned and small, straightens to full size in place over 1s,
     then the fields/buttons fade in below it. Nothing leaves the
     dialog's own box, so there's nothing for the modal to cover. */
  const open = async (tape) => {
    if (busy) return;
    busy = true;
    activeTape = tape;
    const product = PRODUCTS[tape.dataset.product];
    if (!product) { busy = false; return; }

    shelf.classList.add('is-open');
    const heroImg = fillDialog(product, tape);
    if (heroImg) dialog.classList.add('rh-no-transition');
    dialog.classList.toggle('rh-bg-hidden', !!heroImg);
    dialog.showModal();

    if (!heroImg) {
      gridEl.classList.add('show');
      actionsEl.classList.add('show');
      closeBtn.focus();
      busy = false;
      return;
    }

    void dialog.offsetWidth; // commit the instantly-transparent start frame
    dialog.classList.remove('rh-no-transition'); // later reveal transitions normally

    void heroImg.offsetWidth; // commit the turned/small start pose
    await nextFrame();
    heroImg.classList.add('active'); // -> straightens + grows over 1s

    await afterTransition(heroImg);
    dialog.classList.remove('rh-bg-hidden'); // background fades in now that it's settled
    gridEl.classList.add('show');
    actionsEl.classList.add('show');
    closeBtn.focus();
    busy = false;
  };

  /* Exact reverse: fields/buttons fade out, then the hero turns back
     down to its start pose, then the dialog actually closes. */
  const close = async () => {
    if (busy || !dialog.open) return;
    busy = true;
    const tape = activeTape;
    activeTape = null;
    shelf.classList.remove('is-open');

    const heroImg = titleEl.querySelector('img');
    gridEl.classList.remove('show');
    actionsEl.classList.remove('show');

    const finish = () => {
      /* dialog.close() restores focus to whatever was active when
         showModal() was called, overriding any focus() set before
         it — so this has to run after close(), not before. */
      dialog.close();
      if (tape) tape.focus();
      busy = false;
      if (pendingTape) { const t = pendingTape; pendingTape = null; open(t); }
    };

    if (!heroImg) { finish(); return; }

    await wait(200); // let the fields/buttons fade out first
    dialog.classList.add('rh-bg-hidden'); // background/close button/scrollbar hide next
    await afterTransition(dialog);

    /* Fly the hero back to the exact tape it came from — its real
       on-shelf position and size — rather than just shrinking in
       place. It stays a child of the still-open dialog the whole
       way, so it's still promoted to the browser's top layer and
       is never hidden behind the shelf the way a separate clone
       outside the dialog was. */
    const tapeRect = tape.getBoundingClientRect();
    const fromRect = heroImg.getBoundingClientRect();
    const rotateDeg = HERO_START_ROTATE[tape.dataset.shape] ?? -90;
    const rotated90 = Math.abs(rotateDeg % 180) === 90;
    /* scale() applies before rotate() in the transform (functions
       compose right-to-left), so scaleX/scaleY act on the element's
       own pre-rotation width/height axes. A 90deg turn then swaps
       which axis lands as the on-screen width vs height — matching
       against the tape's width/height crossed, not straight, is
       what makes the landing size exact on both dimensions rather
       than just the one a uniform scale was picked to match. */
    const scaleX = Math.max((rotated90 ? tapeRect.height : tapeRect.width) / fromRect.width, 0.01);
    const scaleY = Math.max((rotated90 ? tapeRect.width : tapeRect.height) / fromRect.height, 0.01);
    const dx = (tapeRect.left + tapeRect.width / 2) - (fromRect.left + fromRect.width / 2);
    const dy = (tapeRect.top + tapeRect.height / 2) - (fromRect.top + fromRect.height / 2);

    dialog.style.overflow = 'visible'; // let the image travel outside the dialog's own box
    heroImg.style.position = 'fixed';
    heroImg.style.left = `${fromRect.left}px`;
    heroImg.style.top = `${fromRect.top}px`;
    heroImg.style.width = `${fromRect.width}px`;
    heroImg.style.height = `${fromRect.height}px`;
    heroImg.style.margin = '0';
    heroImg.style.transformOrigin = '50% 50%';
    heroImg.style.transform = 'none'; // same visual spot as a moment ago, just fixed now
    void heroImg.offsetWidth; // commit that frame before animating

    heroImg.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotateDeg}deg) scale(${scaleX}, ${scaleY})`;
    await afterTransition(heroImg);

    dialog.style.removeProperty('overflow'); // hand overflow back to the stylesheet
    finish();
  };

  shelf.addEventListener('click', (e) => {
    const tape = e.target.closest('.rh-tape');
    if (tape) { e.preventDefault(); open(tape); }
  });

  closeBtn.addEventListener('click', close);

  /* On the page this button links to the next product's section.
     Inside a dialog the equivalent is: close this one, open that one. */
  actionsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-next]');
    if (!btn) return;
    const nextTape = shelf.querySelector(`.rh-tape[data-product="${btn.dataset.next}"]`);
    if (!nextTape) return;
    pendingTape = nextTape;
    close();
  });

  /* Clicking the backdrop closes. The dialog element itself fills the
     backdrop area, so compare against the target directly. */
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  /* 'cancel' fires for Escape before the native close would happen;
     block that so the reverse flight can run first, same as any
     other close path. */
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });

  upgradeToButtons();
})();