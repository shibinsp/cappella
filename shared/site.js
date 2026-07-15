/* Cappella subpages — enhancement-only JS.
   Core content and navigation work with this file absent (see html:not(.js)
   CSS fallbacks). Adds: Lenis smooth scroll, page-enter choreography, the
   variant scroll-reveal engine, SplitType hero text (split → animate →
   revert), the About stat count-up, the nav scramble hover, and the mobile
   slide-in menu. Every system honours prefers-reduced-motion; every vendor
   lib is optional (typeof-guarded) so a failed load degrades gracefully. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var lenis = null;

  /* =====================================================================
     1. Lenis smooth scrolling (homepage recipe: duration 1.2, expo easing)
     ===================================================================== */
  function initLenis() {
    if (reduced || typeof Lenis === 'undefined') return;
    lenis = new Lenis({
      duration: 1.2,
      easing: function (t) {
        return Math.min(1, 1.001 - Math.pow(2, -10 * t));
      }
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Skip-link / hash anchors: jump immediately rather than fighting the
    // smooth scroller (keeps keyboard users snappy).
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var el = document.querySelector(a.getAttribute('href'));
      if (el) lenis.scrollTo(el, { immediate: true });
    });
  }

  /* =====================================================================
     2. Mobile menu (behavior API unchanged; + lenis stop/start)
     ===================================================================== */
  function initMenu() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    var backdrop = document.querySelector('.menu-backdrop');

    if (!toggle || !nav) return;

    toggle.hidden = false; // JS present → the panel pattern is available

    var lastFocused = null;

    var isOpen = function () {
      return nav.classList.contains('is-open');
    };

    var openMenu = function () {
      lastFocused = document.activeElement;
      nav.classList.add('is-open');
      if (backdrop) backdrop.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
      if (lenis) lenis.stop();
      var first = nav.querySelector('a');
      if (first) first.focus();
    };

    var closeMenu = function (restoreFocus) {
      nav.classList.remove('is-open');
      if (backdrop) backdrop.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
      if (lenis) lenis.start();
      if (restoreFocus !== false && lastFocused && lastFocused.focus) {
        lastFocused.focus();
      }
    };

    toggle.addEventListener('click', function () {
      if (isOpen()) closeMenu();
      else openMenu();
    });

    if (backdrop) {
      backdrop.addEventListener('click', function () {
        closeMenu();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;

      if (e.key === 'Escape') {
        closeMenu();
        return;
      }

      // Keep Tab cycling inside the open panel (toggle button + panel links)
      if (e.key === 'Tab') {
        var focusables = [toggle].concat(
          Array.prototype.slice.call(nav.querySelectorAll('a'))
        );
        var idx = focusables.indexOf(document.activeElement);
        if (e.shiftKey && (idx === 0 || idx === -1)) {
          e.preventDefault();
          focusables[focusables.length - 1].focus();
        } else if (!e.shiftKey && idx === focusables.length - 1) {
          e.preventDefault();
          focusables[0].focus();
        }
      }
    });

    // Leaving the mobile breakpoint resets the panel state
    var mq = window.matchMedia('(min-width: 900px)');
    var onChange = function () {
      if (mq.matches) closeMenu(false);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* =====================================================================
     3. Page enter — header fades down once, gated on classes this script
        sets itself (a failed site.js can never hide the header).
     ===================================================================== */
  function initEnter() {
    if (reduced) return;
    var root = document.documentElement;
    root.classList.add('cap-enter');
    // Double rAF: let the hidden state paint once, then transition in.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.classList.add('cap-ready');
      });
    });
  }

  /* =====================================================================
     4. Stat count-up (About) — pure rAF text tween. The final frame writes
        the VERBATIM original string, so exact-text assertions always hold
        and no odometer DOM ever exists.
     ===================================================================== */
  function runCountUp(dd) {
    if (reduced || !dd || dd._capCounted) return;
    dd._capCounted = true;
    var orig = dd.textContent;
    var m = orig.match(/^([^0-9]*)([0-9]+(?:\.[0-9]+)?)(.*)$/);
    if (!m) return;
    var prefix = m[1];
    var target = parseFloat(m[2]);
    var suffix = m[3];
    var decimals = (m[2].split('.')[1] || '').length;
    var DUR = 1500;
    var t0 = performance.now();
    function tick(now) {
      var p = Math.min((now - t0) / DUR, 1);
      if (p >= 1) {
        dd.textContent = orig; // always end on the exact authored string
        return;
      }
      var e = 1 - Math.pow(2, -10 * p); // expo-out (homepage counter ease)
      dd.textContent = prefix + (target * e).toFixed(decimals) + suffix;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* =====================================================================
     5. Variant dispatch helpers (inline stagger delays, footer formula)
     ===================================================================== */
  function staggerRows(wrapper) {
    var rows = wrapper.querySelectorAll('tbody tr');
    rows.forEach(function (tr, i) {
      tr.style.transitionDelay = (0.25 + Math.min(i, 12) * 0.06).toFixed(2) + 's';
    });
  }

  // Homepage footer formula (delay = 0.15 + left-fraction*0.4 + top-fraction
  // *0.15) normalized to the footer grid, so it sweeps left→right on the
  // desktop 3-column layout and top→down when stacked on mobile.
  function staggerFooter(container) {
    var cr = container.getBoundingClientRect();
    container.querySelectorAll('.cap-footer-item').forEach(function (el) {
      var r = el.getBoundingClientRect();
      var delay =
        0.15 +
        ((r.left - cr.left) / Math.max(cr.width, 1)) * 0.4 +
        ((r.top - cr.top) / Math.max(cr.height, 1)) * 0.15;
      el.style.transitionDelay = delay.toFixed(2) + 's';
    });
  }

  /* =====================================================================
     6. Reveal engine — one IO at homepage thresholds; a second, earlier IO
        for the footer (threshold 0.01, homepage recipe: the footer can be
        taller than the viewport at scale, so fire on the first pixel).
     ===================================================================== */
  function initReveals() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!els.length) return;

    var show = function (el) {
      el.classList.add('is-in');
    };

    if (reduced || !hasIO) {
      els.forEach(show); // counters stay static under reduce by design
      return;
    }

    var fire = function (el) {
      var kind = el.getAttribute('data-reveal');
      if (kind === 'table') staggerRows(el);
      if (kind === 'footer') staggerFooter(el);
      show(el);
      if (el.hasAttribute('data-counter')) {
        var dd = el.querySelector('.stat-number') || el;
        runCountUp(dd);
      }
    };

    var makeIO = function (opts) {
      return new IntersectionObserver(function (entries, io) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          fire(entry.target);
          io.unobserve(entry.target);
        });
      }, opts);
    };

    var mainIO = makeIO({ threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    var footIO = makeIO({ threshold: 0.01 });

    els.forEach(function (el) {
      if (el._capOwned) return; // hero text: initHeroText drives these
      (el.getAttribute('data-reveal') === 'footer' ? footIO : mainIO).observe(el);
    });
  }

  /* =====================================================================
     7. Hero text — SplitType masked rises, then revert() so the DOM
        returns byte-identical to the authored HTML.
     ===================================================================== */
  function whenFontsSettled(cb) {
    var done = false;
    var go = function () {
      if (!done) {
        done = true;
        cb();
      }
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(go);
    }
    setTimeout(go, 600); // don't block the intro on a slow font CDN
  }

  function initHeroText() {
    if (reduced || typeof SplitType === 'undefined' || !hasIO) return;

    // Claim ownership SYNCHRONOUSLY (before the reveal engine runs) so the
    // main IO doesn't fade these in while we're still waiting on fonts —
    // otherwise in-viewport heroes would always take the fallback path.
    var ownedChars = Array.prototype.slice.call(
      document.querySelectorAll('[data-reveal="chars"]')
    );
    var ownedLines = typeof gsap === 'undefined'
      ? []
      : Array.prototype.slice.call(document.querySelectorAll('[data-reveal="lines"]'));
    ownedChars.concat(ownedLines).forEach(function (el) {
      el._capOwned = true;
    });

    whenFontsSettled(function () {
      /* --- H1: per-line masks, char rise (homepage hero recipe) --- */
      ownedChars.forEach(function (h1) {
        if (h1.classList.contains('is-in')) return; // already revealed by fallback
        var split;
        try {
          split = new SplitType(h1, {
            types: 'lines,words,chars',
            lineClass: 'cap-line',
            wordClass: 'cap-word',
            charClass: 'cap-char'
          });
        } catch (e) {
          h1._capOwned = false;
          h1.classList.add('is-in'); // hand back: plain fade-in state
          return;
        }
        if (!split.chars || !split.chars.length) {
          h1._capOwned = false;
          h1.classList.add('is-in');
          return;
        }

        var maxDelay = 0;
        (split.lines || []).forEach(function (line, li) {
          // Keep textContent lossless while split (see the lines variant):
          // SplitType drops the space at line boundaries.
          line.appendChild(document.createTextNode(' '));
          line.querySelectorAll('.cap-char').forEach(function (ch, ci) {
            var d = 0.15 + li * 0.14 + Math.min(ci, 25) * 0.02;
            ch.style.transitionDelay = d.toFixed(2) + 's';
            if (d > maxDelay) maxDelay = d;
          });
        });
        h1.classList.add('cap-split'); // switch CSS from block-fade to char mode

        var played = false;
        var play = function () {
          if (played) return;
          played = true;
          // .is-in (added by the reveal engine or directly) sends chars home;
          // after the last char settles, revert to pristine DOM.
          setTimeout(function () {
            try {
              split.revert();
            } catch (e) { /* revert is best-effort */ }
            h1.classList.remove('cap-split');
          }, (maxDelay + 1.05) * 1000 + 200);
        };

        // Re-split on width change while still unplayed (line boxes move)
        var lastW = window.innerWidth;
        var onResize = function () {
          if (played || window.innerWidth === lastW) return;
          lastW = window.innerWidth;
          try {
            split.revert();
            split = new SplitType(h1, {
              types: 'lines,words,chars',
              lineClass: 'cap-line',
              wordClass: 'cap-word',
              charClass: 'cap-char'
            });
          } catch (e) { /* keep whatever we have */ }
        };
        window.addEventListener('resize', onResize);

        // The hero is in-viewport on load; observe to catch both cases.
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            io.disconnect();
            window.removeEventListener('resize', onResize);
            h1.classList.add('is-in');
            play();
          });
        }, { threshold: 0.1 });
        io.observe(h1);
      });

      /* --- Paragraph line masks (homepage body-copy recipe) --- */
      ownedLines.forEach(function (p) {
        if (p.classList.contains('is-in')) return;
        var split;
        try {
          split = new SplitType(p, { types: 'lines', lineClass: 'cap-line-inner' });
        } catch (e) {
          p._capOwned = false;
          p.classList.add('is-in');
          return;
        }
        if (!split.lines || !split.lines.length) {
          p._capOwned = false;
          p.classList.add('is-in');
          return;
        }

        split.lines.forEach(function (line) {
          // SplitType drops the inter-line space from the DOM (layout makes
          // it invisible, but textContent loses it — breaking exact-text
          // assertions and copy/paste). Restore it as a trailing text node;
          // a space at the end of a block never renders.
          line.appendChild(document.createTextNode(' '));
          var mask = document.createElement('div');
          mask.className = 'cap-line-mask';
          line.parentNode.insertBefore(mask, line);
          mask.appendChild(line);
        });
        gsap.set(split.lines, { yPercent: 100 });
        p.classList.add('cap-split');

        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            io.disconnect();
            p.classList.add('is-in');
            gsap.to(split.lines, {
              yPercent: 0,
              duration: 1.2,
              ease: 'power4.out',
              stagger: 0.08,
              onComplete: function () {
                try {
                  split.revert(); // removes our masks too (SplitType caches
                } catch (e) { /* original innerHTML) */ }
                p.classList.remove('cap-split');
              }
            });
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
        io.observe(p);
      });
    });
  }

  /* =====================================================================
     8. Nav scramble hover (homepage signature) — desktop pointers only;
        always settles back to the cached original text.
     ===================================================================== */
  function initScramble() {
    if (reduced) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*<>/';

    var restore = function (a) {
      if (a._scr) {
        clearInterval(a._scr);
        a._scr = null;
      }
      if (a.dataset.text) a.textContent = a.dataset.text;
    };

    var links = document.querySelectorAll('#site-nav a');
    links.forEach(function (a) {
      a.addEventListener('mouseenter', function () {
        var orig = a.dataset.text || (a.dataset.text = a.textContent);
        var frame = 0;
        if (a._scr) clearInterval(a._scr);
        a._scr = setInterval(function () {
          a.textContent = orig
            .split('')
            .map(function (ch, i) {
              if (ch === ' ') return ' ';
              return i < frame / 2.4
                ? orig[i]
                : CHARS[(Math.random() * CHARS.length) | 0];
            })
            .join('');
          frame++;
          if (frame / 2.4 >= orig.length) restore(a);
        }, 32);
      });
      a.addEventListener('mouseleave', function () {
        restore(a);
      });
    });

    window.addEventListener('pagehide', function () {
      links.forEach(restore);
    });
  }

  /* ===================================================================== */
  initLenis();
  initMenu();
  initEnter();
  initHeroText(); // before initReveals so char mode is set when .is-in lands
  initReveals();
  initScramble();
})();
