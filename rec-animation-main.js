/* Script for the live Product Overview page. That page has no
   shelf/dialog markup — just the "Our Offerings" intro followed by
   the "Content Description Cards". So this script adds the shelf
   artwork (bundled in imgs/) above the first card, builds the tape
   hotspots over it and the dialog, then runs the open/close
   animation. Styles live in rec-animation-main.css, enqueued
   alongside this file.

   Without JS the page is unchanged: just the intro and the cards. */
(() => {
  'use strict';

  /* Captured now: document.currentScript is null once this has run. */
  const SCRIPT_URL = (document.currentScript && document.currentScript.src) || location.href;

  /* Shelf artwork shipped with the plugin. If an Elementor image
     widget with the same artwork is ever put back on the page, that
     image is used in place instead. */
  const SHELF_ART_SRC = 'imgs/Untitled_Artwork 6 (2).png';
  const SHELF_ART_SELECTOR = 'img[src*="Untitled_Artwork-6"]';
  const SHELF_ART_ALT = 'A shelf of Reclaim Hosting products: four VHS tapes, a record and a VHS tape lying flat';

  /* Every card is the top-level column holding an <h1 aria-label>
     tape image. */
  const CARD_HEADING_SELECTOR = '.elementor-top-column h1[aria-label]';

  /* Hotspot positions are percentages of the artwork (same as the
     prototype). `img` is only for a tape with no card on the page;
     relative paths resolve against this script's own folder. */
  const TAPES = [
    { product: 'shared',  shape: 'spine', l: 23.28, t: 2.04,  w: 6.16,  h: 86.41, href: 'https://www.reclaimhosting.com/shared-hosting/',      label: 'Shared Hosting' },
    { product: 'vip',     shape: 'spine', l: 29.81, t: 2.04,  w: 6.11,  h: 86.41, href: 'https://www.reclaimhosting.com/vip-hosting/',         label: 'VIP Shared Hosting' },
    { product: 'managed', shape: 'spine', l: 36.39, t: 2.04,  w: 6.16,  h: 86.41, href: 'https://www.reclaimhosting.com/managed-hosting/',     label: 'Managed Hosting' },
    { product: 'dooo',    shape: 'spine', l: 43.02, t: 2.04,  w: 6.16,  h: 86.41, href: 'https://www.reclaimhosting.com/domain-of-ones-own/',  label: 'Domain of One’s Own' },
    { product: 'cloud',   shape: 'disc',  l: 50.03, t: 14.72, w: 31.81, h: 61.30, href: 'https://reclaim.cloud/',                             label: 'Reclaim Cloud' },
    { product: 'edu',     shape: 'flat',  l: 49.45, t: 76.28, w: 44.44, h: 12.17, href: 'https://www.reclaimhosting.com/edu/',                label: 'ReclaimEDU', img: 'imgs/reclaimEdu.jpg' },
  ];

  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const normUrl = (u) => {
    try { return new URL(u, location.href).href.replace(/\/+$/, ''); }
    catch (e) { return u; }
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Puts the shelf artwork in the shelf block and lays the tape
     buttons over it. The dialog goes in its own .rh-shelf-block
     on <body>: out of Elementor's transformed/animated columns, while
     still inheriting the block's color and timing variables. */
  const buildShelf = (pageArt, firstCard) => {
    const block = document.createElement('div');
    block.className = 'rh-shelf-block';
    const shelf = document.createElement('div');
    shelf.className = 'rh-shelf';

    /* Use the page's own shelf image if there is one; otherwise add
       the bundled artwork as its own block just above the first card. */
    let art = pageArt;
    if (art) {
      art.replaceWith(block);
    } else {
      art = document.createElement('img');
      art.src = new URL(SHELF_ART_SRC, SCRIPT_URL).href;
      art.alt = SHELF_ART_ALT;
      art.decoding = 'async';
      const section = firstCard.closest('.elementor-top-section') || firstCard;
      section.before(block);
    }
    shelf.style.setProperty('--rh-art', `url("${art.src}")`);
    art.classList.add('rh-shelf__art');
    shelf.appendChild(art);

    const list = document.createElement('ul');
    list.className = 'rh-shelf__list';
    TAPES.forEach((t) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rh-tape';
      btn.dataset.product = t.product;
      btn.dataset.shape = t.shape;
      btn.dataset.href = t.href;
      if (t.img) btn.dataset.img = new URL(t.img, SCRIPT_URL).href;
      btn.setAttribute('style', `--l:${t.l};--t:${t.t};--w:${t.w};--h:${t.h}`);
      btn.innerHTML = `<span class="rh-tape__art"></span><span class="rh-tape__label">${esc(t.label)}</span>`;
      li.appendChild(btn);
      list.appendChild(li);
    });
    shelf.appendChild(list);
    block.appendChild(shelf);

    const host = document.createElement('div');
    host.className = 'rh-shelf-block';
    host.innerHTML =
      '<dialog class="rh-dialog" aria-labelledby="rh-default-dialog-title">' +
        '<div class="rh-dialog__card">' +
          '<button type="button" class="rh-dialog__close" aria-label="Close">&#10005;</button>' +
          '<h2 class="rh-dialog__title" id="rh-default-dialog-title"></h2>' +
          '<div class="rh-dialog__grid"></div>' +
          '<div class="rh-dialog__actions"></div>' +
        '</div>' +
      '</dialog>';
    document.body.appendChild(host);

    return shelf;
  };

  /* Product data is read from the Elementor "Content Description
     Cards" already on the page, so editing a card in Elementor
     updates the shelf dialog too. Each card is matched to a shelf
     tape by its "Learn more" link, which is the same URL the tape
     links to. */
  const readProducts = (tapes, cardHeadings) => {
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

    const keyByUrl = new Map(tapes.map((t) => [normUrl(t.dataset.href), t.dataset.product]));

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

      /* The first real link is "Learn more"; the other button is
         "Not Quite the Right Fit?", which is either an in-page
         #anchor or (on most cards) a plain button with no link. */
      card.querySelectorAll('.elementor-widget-button a.elementor-button').forEach((a) => {
        const href = a.getAttribute('href') || '';
        const label = clean(a.textContent);
        if (!href || href.startsWith('#')) {
          if (!p.nextLabel) { p.hasNext = true; p.nextHref = href; p.nextLabel = label; }
        } else if (!p.url) { p.url = href; p.cta = label; }
      });
      return p;
    };

    const products = {};
    const keyByCard = new Map();
    const cardOrder = [];
    cardHeadings.forEach((h1) => {
      const card = h1.closest('.elementor-top-column');
      const p = readCard(card);
      const key = keyByUrl.get(normUrl(p.url));
      if (!key || products[key]) return;
      products[key] = p;
      keyByCard.set(card, key);
      cardOrder.push(key);
    });

    /* "Not Quite the Right Fit?" either jumps to another card's
       anchor (resolved to the product it belongs to) or has no link
       yet, in which case it goes to the next card down the page,
       wrapping from the last back to the first. */
    cardOrder.forEach((key, i) => {
      const p = products[key];
      let target = null;
      if (p.nextHref.length > 1) {
        try { target = document.querySelector(p.nextHref); } catch (e) { /* bad selector */ }
      }
      const card = target && (target.closest('.elementor-top-column') || target);
      const fallback = cardOrder.length > 1 ? cardOrder[(i + 1) % cardOrder.length] : null;
      p.next = (card && keyByCard.get(card)) || (p.hasNext ? fallback : null);
      delete p.nextHref;
      delete p.hasNext;
    });

    /* A tape with no card on the page (e.g. ReclaimEDU) still opens,
       with just its name, optional img art and link. */
    tapes.forEach((t) => {
      const key = t.dataset.product;
      if (products[key]) return;
      const label = t.querySelector('.rh-tape__label');
      products[key] = {
        name: clean(label ? label.textContent : t.textContent),
        img: t.dataset.img || '',
        summary: '', pricing: '', level: '',
        idealFor: [], notFor: [], useCases: [], features: [],
        url: t.dataset.href || '', cta: '', next: null, nextLabel: '',
      };
    });

    return products;
  };

  const init = () => {
    const probe = document.createElement('dialog');
    const cardHeadings = [...document.querySelectorAll(CARD_HEADING_SELECTOR)];
    if (!cardHeadings.length || document.querySelector('.rh-shelf') ||
        typeof probe.showModal !== 'function') return;

    const shelf = buildShelf(document.querySelector(SHELF_ART_SELECTOR), cardHeadings[0]);
    const PRODUCTS = readProducts([...shelf.querySelectorAll('.rh-tape')], cardHeadings);

    /* Starting tilt for the hero image, per tape shape — a spine reads
       sideways on the shelf so it turns upright like the mockup's tape;
       a disc/flat product is already right-side-up, so it only grows. */
    const HERO_START_ROTATE = { spine: -90, disc: 0, flat: 0 };

    const dialog    = document.querySelector('.rh-dialog[aria-labelledby="rh-default-dialog-title"]');
    const titleEl   = dialog.querySelector('.rh-dialog__title');
    const gridEl    = dialog.querySelector('.rh-dialog__grid');
    const actionsEl = dialog.querySelector('.rh-dialog__actions');
    const closeBtn  = dialog.querySelector('.rh-dialog__close');

    let activeTape = null;
    let pendingTape = null;
    let busy = false;

    /* Resolves once every transition on `el` finishes. A timeout is a
       backstop, not the plan: the reveal must never stay gated on a
       decorative transition that stalls or never starts (this also
       covers reduced motion, where no transition ever runs and this
       resolves on the next microtask). */
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

    /* Mirrors .click-DoOO / .DoOODescription, just inside the dialog
       instead of inline on the page: the hero image starts turned and
       small, straightens to full size in place over 1s, then the
       fields/buttons fade in below it. */
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

    /* Reverse: fields/buttons fade out, the dialog surface hides, then
       the hero flies back onto its tape and the dialog closes. */
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

      if (!heroImg || !tape) { finish(); return; }

      await wait(200); // let the fields/buttons fade out first
      dialog.classList.add('rh-bg-hidden'); // background/close button/scrollbar hide next
      await afterTransition(dialog);

      /* Fly the hero back to the exact tape it came from. It stays a
         child of the still-open dialog the whole way, so it's still in
         the browser's top layer and never hidden behind the shelf. */
      const tapeRect = tape.getBoundingClientRect();
      const fromRect = heroImg.getBoundingClientRect();
      const rotateDeg = HERO_START_ROTATE[tape.dataset.shape] ?? -90;
      const rotated90 = Math.abs(rotateDeg % 180) === 90;
      /* scale() applies before rotate() (transform functions compose
         right-to-left), so scaleX/scaleY act on the element's own
         pre-rotation axes; a 90deg turn swaps which one lands as the
         on-screen width vs height, hence the crossed match. */
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
       block that so the reverse flight can run first. */
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      close();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
