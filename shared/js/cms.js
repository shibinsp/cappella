/* ==========================================================================
   Cappella — CMS hydration (Sanity)
   [SECTION]  Projects, Team, Contact
   [BEHAVIOR] Fetches published content from Sanity and rewrites the static
              markup in place, using the exact card markup the pages ship with.
   [PURPOSE]  Progressive enhancement — every page is complete static HTML.
              If the fetch fails, times out or returns nothing, the static
              content stays untouched. Each hydrate*() returns a promise that
              always resolves, so scripts that bind to the cards can wait on it.
   Read-only: the dataset is public, so no token ships with the site.
   ========================================================================== */
(function () {
  var PROJECT = 'xkccdy4d', DATASET = 'production', API_VERSION = 'v2025-08-15';
  var ENDPOINT = 'https://' + PROJECT + '.apicdn.sanity.io/' + API_VERSION + '/data/query/' + DATASET;
  var TIMEOUT_MS = 3000;

  // Resolves { result } on success (result may be null: "no such document"), or
  // null when the request itself failed — callers that must tell those apart
  // (page.html) use request(); the rest use query().
  function request(groq, params, timeoutMs) {
    if (!window.fetch) return Promise.resolve(null);
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, timeoutMs || TIMEOUT_MS);
    var url = ENDPOINT + '?query=' + encodeURIComponent(groq);
    Object.keys(params || {}).forEach(function (k) {
      url += '&%24' + k + '=' + encodeURIComponent(JSON.stringify(params[k]));
    });
    return fetch(url, ctl ? { signal: ctl.signal } : {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return j && 'result' in j ? { result: j.result } : null; })
      .catch(function () { return null; })
      .then(function (res) { clearTimeout(timer); return res; });
  }

  function query(groq) {
    return request(groq).then(function (r) { return r && r.result != null ? r.result : null; });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function sized(url, w) { return url ? url + '?w=' + w + '&auto=format&q=85' : ''; }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }

  /* ---------- Team ---------- */
  var LINKEDIN_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.76V21h-4v-5.6c0-1.34-.02-3.07-1.9-3.07-1.9 0-2.2 1.46-2.2 2.97V21H9z"/></svg>';
  var CHEVRON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3.5 1.5 8 6l-4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function teamCard(m) {
    var paras = (m.fullBio && m.fullBio.length ? m.fullBio : [m.shortBio]).filter(Boolean);
    var li = safeUrl(m.linkedin);
    return '<article class="leader-card' + (m.lead ? ' leader-card--lead' : '') + '">' +
      '<h2>' + esc(m.name) + '</h2>' +
      '<p class="leader-role">' + esc(m.role) + '</p>' +
      '<p class="leader-bio">' + esc(m.shortBio) + '</p>' +
      '<button class="leader-more" type="button">Read More ' + CHEVRON + '</button>' +
      (li ? '<div class="leader-social"><a href="' + esc(li) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(m.name) + ' on LinkedIn">' + LINKEDIN_ICON + '</a></div>' : '') +
      '<img class="leader-portrait" src="' + esc(sized(m.portrait, 900)) + '" alt="Portrait of ' + esc(m.name) + '" loading="lazy">' +
      '<div class="leader-bio-full">' + paras.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>' +
      '</article>';
  }

  function hydrateTeam() {
    return query('*[_type=="teamMember"]|order(order asc){name,role,lead,shortBio,fullBio,linkedin,"portrait":portrait.asset->url}')
      .then(function (list) {
        var grid = document.querySelector('.leader-grid');
        if (!grid || !list || !list.length) return;
        grid.innerHTML = list.filter(function (m) { return m.name && m.portrait; }).map(teamCard).join('');
      });
  }

  /* ---------- Projects ---------- */
  var ICON = {
    acres: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20h-4M20 20v-4"/></svg>',
    bua: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V7l7-4 7 4v14M4 21h14M9 21v-5h4v5M8 9h0M12 9h0M8 12h0M12 12h0"/></svg>',
    students: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M16 6a3 3 0 0 1 0 5M17 15c2 .4 4 2 4 5"/></svg>',
    established: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>'
  };
  var STATS = [['acres', 'Acres'], ['bua', 'BUA (sf)'], ['students', 'Students'], ['established', 'Established']];

  function projectCard(p) {
    var stats = STATS.filter(function (s) { return p[s[0]]; }).map(function (s) {
      return '<div class="proj-stat">' + ICON[s[0]] + '<div><b>' + esc(p[s[0]]) + '</b><span>' + s[1] + '</span></div></div>';
    }).join('');
    return '<article class="proj-card" data-region="' + esc(p.region) + '" aria-label="' + esc(p.name + ' — ' + p.location) + '">' +
      '<div class="proj-card__media"><img class="proj-card__img" src="' + esc(sized(p.image, 1200)) + '" alt="' + esc(p.imageAlt || p.name + ' campus') + '" loading="lazy"></div>' +
      '<div class="proj-card__scrim"></div>' +
      '<div class="proj-card__head"><h3 class="proj-card__name">' + esc(p.name) + '</h3><p class="proj-card__loc">' + esc(p.location) + '</p></div>' +
      '<div class="proj-card__stats">' + stats + '</div>' +
      '</article>';
  }

  function hydrateProjects() {
    return query('*[_type=="project"]|order(order asc){name,location,region,imageAlt,acres,bua,students,established,"image":image.asset->url}')
      .then(function (list) {
        var grid = document.getElementById('proj-grid');
        if (!grid || !list || !list.length) return;
        list = list.filter(function (p) { return p.name && p.region && p.image; });
        if (!list.length) return;
        grid.innerHTML = list.map(projectCard).join('');
        var counts = {};
        list.forEach(function (p) { counts[p.region] = (counts[p.region] || 0) + 1; });
        document.querySelectorAll('.proj-filter').forEach(function (btn) {
          var key = btn.getAttribute('data-filter');
          var n = key === 'all' ? list.length : (counts[key] || 0);
          var span = btn.querySelector('.count');
          if (span) span.textContent = '(' + n + ')';
        });
      });
  }

  /* ---------- Contact ---------- */
  function hydrateContact() {
    return query('*[_id=="contactSettings"][0]{address,email,directionsUrl}')
      .then(function (c) {
        if (!c) return;
        var addr = document.querySelector('address.address-block');
        if (addr && c.address) addr.innerHTML = esc(c.address).replace(/\n/g, '<br>');
        var mail = document.querySelector('a.contact-cta');
        if (mail && c.email) { mail.href = 'mailto:' + c.email; mail.textContent = c.email; }
        var dir = document.querySelector('a.map-cta');
        if (dir && safeUrl(c.directionsUrl)) dir.href = c.directionsUrl;
      });
  }

  /* ---------- Pages (page.html, served at /p/<slug>) ---------- */
  // http(s), mailto, or a path on this site. Anything else (javascript:, data:)
  // is dropped, so an editor can never ship a script URL.
  function safeHref(u) { return /^(https?:\/\/|mailto:|\/(?!\/))/i.test(u || '') ? u : ''; }
  function isExternal(u) { return /^https?:\/\//i.test(u) && u.indexOf(location.origin) !== 0; }
  function linkAttrs(u) { return ' href="' + esc(u) + '"' + (isExternal(u) ? ' target="_blank" rel="noopener noreferrer"' : ''); }

  function spans(block) {
    var defs = {};
    (block.markDefs || []).forEach(function (d) { defs[d._key] = d; });
    return (block.children || []).map(function (c) {
      var t = esc(c.text).replace(/\n/g, '<br>');
      (c.marks || []).forEach(function (m) {
        if (m === 'strong') t = '<strong>' + t + '</strong>';
        else if (m === 'em') t = '<em>' + t + '</em>';
        else if (defs[m] && safeHref(defs[m].href)) t = '<a' + linkAttrs(defs[m].href) + '>' + t + '</a>';
      });
      return t;
    }).join('');
  }

  function richText(blocks) {
    var out = [], open = null;
    function close() { if (open) { out.push('</' + open + '>'); open = null; } }
    (blocks || []).forEach(function (b) {
      if (b._type !== 'block') return;
      if (b.listItem) {
        var tag = b.listItem === 'number' ? 'ol' : 'ul';
        if (open !== tag) { close(); out.push('<' + tag + '>'); open = tag; }
        out.push('<li>' + spans(b) + '</li>');
        return;
      }
      close();
      var h = spans(b);
      if (!h) return;
      out.push(b.style === 'h3' ? '<h3>' + h + '</h3>' : b.style === 'blockquote' ? '<blockquote>' + h + '</blockquote>' : '<p>' + h + '</p>');
    });
    close();
    return out.join('');
  }

  function section(inner, label) {
    return '<section class="section"' + (label ? ' aria-label="' + esc(label) + '"' : '') + '><div class="container">' + inner + '</div></section>';
  }
  function sectionTitle(t) { return t ? '<h2 class="section-title">' + esc(t) + '</h2>' : ''; }

  var BLOCKS = {
    heroBlock: function (b, first) {
      return '<section class="page-hero"><div class="container"><h1 class="hero-title">' + esc(b.heading) + '</h1>' +
        (b.intro ? '<p class="hero-intro body-copy">' + esc(b.intro).replace(/\n/g, '<br>') + '</p>' : '') + '</div></section>';
    },
    textBlock: function (b) {
      var body = richText(b.body);
      return body || b.heading ? section(sectionTitle(b.heading) + '<div class="pb-prose">' + body + '</div>', b.heading) : '';
    },
    imageBlock: function (b) {
      if (!b.url) return '';
      return section('<figure class="pb-image' + (b.size === 'wide' ? ' pb-image--wide' : '') + '"><img src="' +
        esc(sized(b.url, b.size === 'wide' ? 1800 : 1200)) + '" alt="' + esc(b.alt || '') + '" loading="lazy">' +
        (b.caption ? '<figcaption>' + esc(b.caption) + '</figcaption>' : '') + '</figure>');
    },
    galleryBlock: function (b) {
      var imgs = (b.images || []).filter(function (i) { return i && i.url; });
      if (!imgs.length) return '';
      return section(sectionTitle(b.heading) + '<div class="pb-gallery">' + imgs.map(function (i) {
        return '<img src="' + esc(sized(i.url, 900)) + '" alt="' + esc(i.alt || '') + '" loading="lazy">';
      }).join('') + '</div>', b.heading);
    },
    cardsBlock: function (b) {
      var cards = (b.cards || []).filter(function (c) { return c && c.title; });
      if (!cards.length) return '';
      return section(sectionTitle(b.heading) + '<div class="pb-cards">' + cards.map(function (c) {
        var href = safeHref(c.link);
        var inner = (c.url ? '<img src="' + esc(sized(c.url, 900)) + '" alt="' + esc(c.alt || '') + '" loading="lazy">' : '') +
          '<div class="pb-card__body"><h3 class="pb-card__title">' + esc(c.title) + '</h3>' +
          (c.text ? '<p class="pb-card__text">' + esc(c.text).replace(/\n/g, '<br>') + '</p>' : '') + '</div>';
        return href ? '<a class="pb-card"' + linkAttrs(href) + '>' + inner + '</a>' : '<div class="pb-card">' + inner + '</div>';
      }).join('') + '</div>', b.heading);
    },
    buttonBlock: function (b) {
      var href = safeHref(b.url);
      return href && b.label ? section('<a class="pb-btn"' + linkAttrs(href) + '>' + esc(b.label) + '</a>') : '';
    }
  };

  function slugFromLocation() {
    var m = location.pathname.match(/^\/p\/([^\/]+)\/?$/);
    var s = m ? decodeURIComponent(m[1]) : new URLSearchParams(location.search).get('slug');
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s || '') ? s : '';
  }

  function setMeta(name, content) {
    var el = document.head.querySelector('meta[name="' + name + '"]');
    if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
    el.content = content;
  }

  function showMessage(root, heading, intro, noindex) {
    root.innerHTML = '<section class="page-hero"><div class="container"><h1 class="hero-title">' + esc(heading) +
      '</h1><p class="hero-intro body-copy">' + esc(intro) + '</p></div></section>' +
      section('<a class="pb-btn" href="index.html">Back to home</a>');
    document.title = heading + ' — Cappella';
    if (noindex) setMeta('robots', 'noindex');
  }

  var PAGE_QUERY = '*[_type=="page" && slug.current==$slug][0]{title,description,blocks[]{_type,_key,' +
    '_type=="heroBlock" => {heading,intro},' +
    '_type=="textBlock" => {heading,body},' +
    '_type=="imageBlock" => {alt,caption,size,"url":image.asset->url},' +
    '_type=="galleryBlock" => {heading,"images":images[]{alt,"url":asset->url}},' +
    '_type=="cardsBlock" => {heading,"cards":cards[]{title,text,link,alt,"url":image.asset->url}},' +
    '_type=="buttonBlock" => {label,url}}}';

  function hydratePage() {
    var root = document.getElementById('page-root');
    if (!root) return Promise.resolve();
    var slug = slugFromLocation();
    if (!slug) { showMessage(root, 'Page not found', 'We could not find the page you were looking for.', true); return Promise.resolve(); }
    // One retry: a dropped request must not read as "this page is broken".
    return request(PAGE_QUERY, { slug: slug }, 8000).then(function (res) {
      return res || new Promise(function (r) { setTimeout(r, 800); }).then(function () { return request(PAGE_QUERY, { slug: slug }, 8000); });
    }).then(function (res) {
      if (!res) return showMessage(root, 'This page could not be loaded', 'Please check your connection and refresh.', false);
      var page = res.result;
      if (!page) return showMessage(root, 'Page not found', 'We could not find the page you were looking for.', true);
      var blocks = page.blocks || [];
      var html = '';
      if (!blocks.length || blocks[0]._type !== 'heroBlock') {
        html += BLOCKS.heroBlock({ heading: page.title });
      }
      blocks.forEach(function (b) { if (BLOCKS[b._type]) html += BLOCKS[b._type](b); });
      root.innerHTML = html;
      document.title = page.title + ' — Cappella';
      if (page.description) setMeta('description', page.description);
    });
  }

  window.cappellaCMS = { hydrateTeam: hydrateTeam, hydrateProjects: hydrateProjects, hydrateContact: hydrateContact, hydratePage: hydratePage };
})();
