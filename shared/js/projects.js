/* ==========================================================================
   Cappella — Projects page behavior (extracted from projects.html)
   [SECTION]  Projects (projects.html)
   [BEHAVIOR] Region filtering (show/hide) and grid/list toggle over the
              static card DOM; rewrites the Showing-N count line
   [PURPOSE]  Progressive enhancement — the 15 cards are static HTML,
              visible with JS off; this only wires the controls.
   ========================================================================== */

/* Progressive enhancement: the 15 cards are static HTML above (visible with
   JS off and to crawlers). This only wires up region filtering (show/hide)
   and the grid/list toggle over that existing DOM. */
(function () {
  var grid = document.getElementById('proj-grid');
  if (!grid) return;
  var cards = [].slice.call(grid.querySelectorAll('.proj-card'));
  var countEl = document.querySelector('.proj-count');
  var filter = 'all', view = 'grid';

  function update() {
    // Client 2026-07-23: the "N actual campus photos, M representative"
    // breakdown is dropped from this line (the per-card REPRESENTATIVE
    // tags remain the disclosure).
    var shown = 0;
    cards.forEach(function (c) {
      var match = filter === 'all' || c.dataset.region === filter;
      c.hidden = !match;
      if (match) shown++;
    });
    grid.classList.toggle('is-list', view === 'list');
    countEl.textContent = 'Showing ' + shown + ' ' + (shown === 1 ? 'project' : 'projects');
  }

  document.querySelectorAll('.proj-filter').forEach(function (btn) {
    btn.addEventListener('click', function () {
      filter = btn.dataset.filter;
      document.querySelectorAll('.proj-filter').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      update();
    });
  });
  document.querySelectorAll('.proj-view-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      view = btn.dataset.view;
      document.querySelectorAll('.proj-view-btn').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      update();
    });
  });

  /* Client 2026-08-09 (p34): tap a card to flip it and read the details.
     Phones only — the CSS that builds the back face is inside the 860px query,
     so above it a click must do nothing at all rather than rotate a card whose
     stats are still painted on the front.
     Matched with the same 860px breakpoint the CSS uses, read live rather than
     captured, so rotating the device does not leave a card stuck mid-flip. */
  var flipMQ = window.matchMedia('(max-width: 860px)');
  cards.forEach(function (card) {
    card.addEventListener('click', function () {
      if (!flipMQ.matches || view === 'list') return;
      card.classList.toggle('is-flipped');
    });
  });
  // Leaving phone width or switching to list view: drop any flipped state, or
  // a card stays mirrored in a layout that has no back face.
  var unflip = function () {
    cards.forEach(function (c) { c.classList.remove('is-flipped'); });
  };
  if (flipMQ.addEventListener) flipMQ.addEventListener('change', unflip);
  document.querySelectorAll('.proj-view-btn').forEach(function (btn) {
    btn.addEventListener('click', unflip);
  });

  update();
})();
