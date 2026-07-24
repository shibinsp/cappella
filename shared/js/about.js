/* SKOLEN pinned mask-reveal (About page).
   Desktop + no-reduced-motion only: a sticky aerial that clip-wipes
   1-Acre -> 2-Acre -> 3-Acre as the module blocks scroll past it. Mirrors the
   homepage journey's scroll-fraction -> clip-path idiom (index.html
   _setupJourneyPinned) — vanilla, no ScrollTrigger. Otherwise the CSS
   single-column fallback (each aerial inline under its module) stands. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mqDesktop = window.matchMedia('(min-width: 901px)');

  function init() {
    var reveal = document.querySelector('[data-skolen-reveal]');
    if (!reveal) return;
    var imgs = Array.prototype.slice.call(reveal.querySelectorAll('.skolen-reveal__img'));
    var modules = Array.prototype.slice.call(reveal.querySelectorAll('.skolen-module'));
    if (imgs.length < 2) return;
    var n = imgs.length;

    var pinned = false;
    var raf = 0;
    var inView = false;
    var io = null;

    function clearInline() {
      imgs.forEach(function (im) {
        im.style.clipPath = '';
        im.style.objectPosition = '';
      });
      modules.forEach(function (m) { m.classList.remove('is-dim'); });
    }

    function update() {
      raf = 0;
      if (!pinned) return;
      var rect = reveal.getBoundingClientRect();
      var denom = reveal.offsetHeight - window.innerHeight;
      var p = denom > 0 ? Math.min(1, Math.max(0, -rect.top / denom)) : 0;

      // Each aerial holds while its module is centred, then wipes to the next
      // between modules. Boundary j (between image j and j+1) sits at p=(j+1)/n
      // and wipes over a window of +/- HW; the last image never wipes (nothing
      // beneath it). Images stack with 0 on top, wiped from the bottom up.
      var HW = 0.11;                         // half-width of each wipe window
      for (var i = 0; i < n; i++) {
        var clip = 0;
        if (i < n - 1) {
          var c = (i + 1) / n;
          var r = (p - c) / (2 * HW) + 0.5;
          r = r < 0 ? 0 : (r > 1 ? 1 : r);
          r = r * r * (3 - 2 * r);           // smoothstep
          clip = r * 100;
        }
        imgs[i].style.clipPath = 'inset(0 0 ' + clip.toFixed(2) + '% 0)';
      }

      // Active module = number of boundaries already crossed; parallax + dim.
      var active = 0;
      for (var j = 0; j < n - 1; j++) { if (p > (j + 1) / n) active = j + 1; }
      imgs[active].style.objectPosition = '50% ' + (50 + (p - active / n) * 24).toFixed(1) + '%';
      for (var m = 0; m < modules.length; m++) {
        modules[m].classList.toggle('is-dim', m !== active);
      }
    }

    function onScroll() {
      if (!inView || raf) return;
      raf = window.requestAnimationFrame(update);
    }

    function enablePinned() {
      if (pinned) return;
      pinned = true;
      reveal.classList.add('is-pinned');
      window.addEventListener('scroll', onScroll, { passive: true });
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (entries) {
          inView = entries[0].isIntersecting;
          if (inView) onScroll();
        }, { rootMargin: '300px 0px 300px 0px' });
        io.observe(reveal);
      }
      inView = true;   // paint once now regardless of the observer's first tick
      update();
    }

    function disablePinned() {
      if (!pinned) return;
      pinned = false;
      reveal.classList.remove('is-pinned');
      window.removeEventListener('scroll', onScroll);
      if (io) { io.disconnect(); io = null; }
      if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
      clearInline();
    }

    function evaluate() {
      if (!reduced && mqDesktop.matches) enablePinned();
      else disablePinned();
    }

    evaluate();

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(evaluate, 150);
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
