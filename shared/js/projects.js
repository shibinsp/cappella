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

  update();
})();
