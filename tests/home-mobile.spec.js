// The phone home page (#cap-mobile). Below 768px index.html hides the scaled
// 1440 Figma frame entirely and renders a purpose-built flow layout instead —
// see the header comment in shared/css/home-mobile.css. These assertions are
// about that layout: that it is the one showing, that its content comes from
// the shared constants, that it is legible and tappable, and that the desktop
// frame is untouched above the breakpoint.
const { test, expect } = require('./fixtures');
const {
  attachErrorCapture,
  expectNoPageErrors,
  assertNoHorizontalOverflow,
  fullPageShot
} = require('./helpers');

const HOME = '/index.html';

/** Waits for _setupMobileHome to have filled the containers. */
async function gotoMobileHome(page) {
  await page.goto(HOME, { waitUntil: 'networkidle' });
  await page.waitForSelector('#cap-mobile .cm-acc-item', { timeout: 20000 });
  await page.waitForTimeout(300);
}

test.describe('mobile home', () => {
  test.describe.configure({ timeout: 90000 });

  // Everything here is about the phone layout; the frame path is covered by
  // regression.spec.js / animations.spec.js at the other two viewports.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the #cap-mobile layout only renders below 768px');
  });

  test('the mobile layout replaces the scaled frame, and nothing overflows', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await gotoMobileHome(page);

    await expect(page.locator('#cap-viewport')).toBeHidden();
    await expect(page.locator('#cap-mobile')).toBeVisible();
    // The frame-bound journey pin must not have been built.
    await expect(page.locator('#cap-journey')).toHaveCount(0);

    // index.html was the one page never covered by this assertion.
    await assertNoHorizontalOverflow(page);
    expectNoPageErrors(errors);
  });

  test('hero renders at a legible size, not the 0.271 scaled-down frame', async ({ page }) => {
    await gotoMobileHome(page);

    const h1 = page.locator('#cap-mobile h1');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Edu-Infra Asset');

    // The scaled frame put the 100px headline at ~27px with 6.5px body copy;
    // this layout must not be anywhere near that.
    const sizes = await page.evaluate(() => {
      const px = (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize);
      return { h1: px('#cap-mobile h1'), sub: px('#cap-mobile .cm-hero-sub'), body: px('#cap-mobile .cm-sub') };
    });
    expect(sizes.h1).toBeGreaterThanOrEqual(24);
    expect(sizes.sub).toBeGreaterThanOrEqual(12);
    expect(sizes.body).toBeGreaterThanOrEqual(12);

    // The CTA is new content from the mockup and must actually go somewhere.
    await expect(page.locator('#cap-mobile .cm-cta')).toHaveAttribute('href', './projects.html');
  });

  test('the hero mark is the real wordmark asset, not text', async ({ page }) => {
    await gotoMobileHome(page);

    // It used to be a <span>Cappella</span> letter-spaced to imitate the logo.
    // A "does a mark exist" check passes on that, so assert the asset itself.
    const mark = await page.evaluate(() => {
      const el = document.querySelector('#cap-mobile .cm-wordmark');
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        bg: cs.backgroundImage,
        text: el.textContent.trim(),
        label: el.getAttribute('aria-label'),
        opacity: parseFloat(cs.opacity),
        aspect: r.width / r.height
      };
    });

    expect(mark.bg).toContain('7cb777f5a65019d1');
    expect(mark.text, 'the mark is artwork, not type').toBe('');
    expect(mark.label).toBeTruthy();
    // _setupPreloader hides the header wordmark by class and restores it the
    // same way. Reusing that class here put this element first in the DOM
    // before the frame hydrated, so it was hidden and never restored.
    expect(mark.opacity, 'the mark must not be left hidden by the preloader').toBe(1);
    // The crop's authored box is 214x37; off-ratio would stretch the letters.
    expect(mark.aspect).toBeGreaterThan(5.5);
    expect(mark.aspect).toBeLessThan(6.1);
  });

  test('content is driven by the shared constants', async ({ page }) => {
    await gotoMobileHome(page);

    // Frame 6 shows three stats (the desktop band's 75 Years+ is dropped).
    await expect(page.locator('#cap-mobile .cm-stat')).toHaveCount(3);
    await expect(page.locator('#cap-mobile .cm-stats')).toContainText('$500 Mn+');
    await expect(page.locator('#cap-mobile .cm-stats')).toContainText('135 Acres');

    // CAP_EDGE — same four rows as the desktop accordion.
    const rows = page.locator('#cap-mobile .cm-acc-item');
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText('Operator-aligned structures');
    await expect(rows.last()).toContainText('Proven, long-term investor value');

    // CAP_JOURNEY — real 2016-2025 records, all three phases.
    await expect(page.locator('#cap-mobile .cm-tl-phase')).toHaveCount(3);
    await expect(page.locator('#cap-mobile .cm-tl-item')).toHaveCount(8);
    await expect(page.locator('#cap-mobile .cm-tl').first()).toContainText('2016');

    // CAP_CITIES / CAP_OPERATORS.
    await expect(page.locator('#cap-mobile .cm-city')).toHaveCount(7);
    await expect(page.locator('#cap-mobile .cm-ops-logo')).toHaveCount(7);
  });

  test('accordion toggles on tap and every row is a real tap target', async ({ page }) => {
    await gotoMobileHome(page);

    const second = page.locator('#cap-mobile .cm-acc-item').nth(1);
    // Row 2 starts open, matching the mockup.
    await expect(second).toHaveClass(/is-open/);

    const first = page.locator('#cap-mobile .cm-acc-item').first();
    await expect(first).not.toHaveClass(/is-open/);
    await first.locator('.cm-acc-btn').click();
    await expect(first).toHaveClass(/is-open/);
    await expect(first.locator('.cm-acc-btn')).toHaveAttribute('aria-expanded', 'true');
    await first.locator('.cm-acc-btn').click();
    await expect(first).not.toHaveClass(/is-open/);

    const short = await page.evaluate(() =>
      [...document.querySelectorAll('#cap-mobile .cm-acc-btn, #cap-mobile .cm-city, #cap-mobile .cm-fnav a')]
        .map((el) => ({ t: el.textContent.trim().slice(0, 28), h: Math.round(el.getBoundingClientRect().height) }))
        .filter((r) => r.h < 30)
    );
    expect(short, 'interactive rows should not be smaller than a fingertip').toEqual([]);
  });

  test('the rows render as separated cards, not a flat divided list', async ({ page }) => {
    await gotoMobileHome(page);

    // Frame 6 renders each row as a raised white card: rounded, soft-shadowed,
    // and clear of its neighbours. A regression to the old hairline list would
    // drop the radius/shadow and close the gaps.
    const cards = await page.evaluate(() => {
      const items = [...document.querySelectorAll('#cap-mobile .cm-acc-item')];
      const gaps = [];
      for (let i = 1; i < items.length; i++) {
        gaps.push(items[i].getBoundingClientRect().top - items[i - 1].getBoundingClientRect().bottom);
      }
      const cs = getComputedStyle(items[0]);
      return {
        radius: parseFloat(cs.borderRadius),
        hasShadow: cs.boxShadow !== 'none' && cs.boxShadow !== '',
        minGap: Math.min(...gaps)
      };
    });
    expect(cards.radius).toBeGreaterThan(0);
    expect(cards.hasShadow, 'cards are separated by a shadow, not a border').toBe(true);
    expect(cards.minGap, 'cards must not touch').toBeGreaterThanOrEqual(6);

    // The open row's photo sits INSIDE its card, not edge-to-edge. Scoped to
    // the OPEN row: every row carries an image now, and the others sit in
    // collapsed panels.
    const inset = await page.evaluate(() => {
      const img = document.querySelector('#cap-mobile .cm-acc-item.is-open .cm-acc-img');
      const card = img.closest('.cm-acc-item').getBoundingClientRect();
      const r = img.getBoundingClientRect();
      return { left: r.left - card.left, right: card.right - r.right };
    });
    expect(inset.left).toBeGreaterThan(0);
    expect(inset.right).toBeGreaterThan(0);
  });

  test('every dropdown carries a photo, and only the open one is fetched', async ({ page }) => {
    await gotoMobileHome(page);

    // The ask: all four rows have an image, not just the default-open one.
    const shape = await page.evaluate(() =>
      [...document.querySelectorAll('#cap-mobile .cm-acc-item')].map((it) => {
        const img = it.querySelector('.cm-acc-img');
        return {
          open: it.classList.contains('is-open'),
          hasImg: !!img,
          src: img ? img.getAttribute('src') : null,
          deferred: img ? img.hasAttribute('data-src') : null,
          alt: img ? img.getAttribute('alt') : null
        };
      })
    );
    expect(shape).toHaveLength(4);
    expect(shape.every((r) => r.hasImg), 'every dropdown should contain a photo').toBe(true);
    expect(shape.every((r) => r.alt && r.alt.length > 3), 'photos should carry real alt text').toBe(true);

    // The open row renders immediately…
    const openRow = shape.find((r) => r.open);
    expect(openRow.src).toBeTruthy();
    expect(openRow.deferred).toBe(false);
    await expect
      .poll(() => page.evaluate(() => {
        const i = document.querySelector('#cap-mobile .cm-acc-item.is-open .cm-acc-img');
        return i.complete && i.naturalWidth;
      }))
      .toBeGreaterThan(0);

    // …and the closed rows are deferred. loading="lazy" would not hold these
    // back (a collapsed panel is still in layout), so this guards ~765KB of
    // photography from being fetched for panels nobody opened.
    const closed = shape.filter((r) => !r.open);
    expect(closed).toHaveLength(3);
    expect(closed.every((r) => r.src === null && r.deferred), 'closed rows must not fetch').toBe(true);

    // Opening one promotes it, and it actually loads.
    await page.locator('#cap-mobile .cm-acc-item').first().locator('.cm-acc-btn').click();
    await expect
      .poll(() => page.evaluate(() => {
        const i = document.querySelector('#cap-mobile .cm-acc-item .cm-acc-img');
        return i.getAttribute('src') && i.complete && i.naturalWidth;
      }))
      .toBeGreaterThan(0);
    // The two still-closed rows stay deferred.
    const stillDeferred = await page.evaluate(
      () => document.querySelectorAll('#cap-mobile .cm-acc-img[data-src]').length
    );
    expect(stillDeferred).toBe(2);
  });

  test('Our Journey carries its blue-grey ground', async ({ page }) => {
    await gotoMobileHome(page);
    // The export washes the top of this section in rgb(214,227,239) and fades
    // it out; flat white means the gradient was lost.
    const cast = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('#cap-mobile .cm-journey'));
      const m = s.backgroundImage.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
    });
    expect(cast, 'journey section should have a gradient background').not.toBeNull();
    expect(cast.b - cast.r, 'the wash should read blue, not neutral grey').toBeGreaterThanOrEqual(15);
  });

  test('Our Journey photo and timeline markers match the export', async ({ page }) => {
    await gotoMobileHome(page);

    const geo = await page.evaluate(() => {
      const img = document.querySelector('#cap-mobile .cm-journey-img');
      const r = img.getBoundingClientRect();
      const rgb = (s) => (s.match(/\d+/g) || []).map(Number);
      return {
        height: r.height,
        radius: parseFloat(getComputedStyle(img).borderRadius),
        marker: (() => {
          const cs = getComputedStyle(document.querySelector('#cap-mobile .cm-tl-item'), '::before');
          return { w: parseFloat(cs.width), bg: rgb(cs.backgroundColor), shadow: cs.boxShadow };
        })(),
        rail: rgb(getComputedStyle(document.querySelector('#cap-mobile .cm-tl'), '::before').backgroundColor)
      };
    });

    // The photo no longer holds the export's 2.73:1 band inside the pin — it
    // flexes to fill the stage, because a fixed ratio left dead space above
    // and below a 100svh pin. It keeps its rounded corners and a sane floor.
    expect(geo.radius, 'the photo has rounded corners in the export').toBeGreaterThan(0);
    expect(geo.height, 'the photo must not collapse to a sliver').toBeGreaterThanOrEqual(130);

    // A target, not a hollow ring — the centre must be filled red. This is the
    // one that would regress silently back to a white-centred circle.
    expect(geo.marker.w).toBeGreaterThanOrEqual(16);
    expect(geo.marker.bg.slice(0, 3)).toEqual([209, 32, 47]);
    expect(geo.marker.shadow, 'the white gap between rim and centre').toContain('inset');

    // The rail is red, not the grey hairline it used to be.
    expect(geo.rail[0]).toBeGreaterThan(geo.rail[1] + 60);
    expect(geo.rail[0]).toBeGreaterThan(geo.rail[2] + 60);
  });

  test('Our Journey pins and advances one phase per scroll', async ({ page }) => {
    await gotoMobileHome(page);

    const setup = await page.evaluate(() => {
      const track = document.querySelector('#cap-mobile .cm-j-track');
      const stage = document.querySelector('#cap-mobile .cm-j-stage');
      return {
        phases: document.querySelectorAll('#cap-mobile .cm-j-phase').length,
        dots: document.querySelectorAll('#cap-mobile .cm-j-dot').length,
        sticky: getComputedStyle(stage).position,
        stageH: stage.offsetHeight,
        vh: window.innerHeight,
        // Measure the ACTIVE phase, not stage.scrollHeight: the inactive
        // phases sit at translateY(10px) as their entry offset, so scrollHeight
        // always reads 10px over and says nothing about whether content fits.
        contentH: (() => {
          const on = stage.querySelector('.cm-j-phase.is-on') || stage.querySelector('.cm-j-phase');
          return on.getBoundingClientRect().bottom - stage.getBoundingClientRect().top;
        })(),
        top: window.scrollY + track.getBoundingClientRect().top,
        travel: track.offsetHeight - Math.min(stage.offsetHeight, window.innerHeight)
      };
    });

    expect(setup.phases).toBe(3);
    expect(setup.dots).toBe(3);
    expect(setup.sticky, 'the stage pins with position:sticky').toBe('sticky');
    // #cap-mobile used to carry overflow-x:hidden, which coerces the other axis
    // to auto and silently kills sticky for everything inside it.
    expect(setup.stageH).toBeLessThanOrEqual(setup.vh);
    expect(setup.contentH, 'stage content must fit the pin').toBeLessThanOrEqual(setup.stageH + 1);
    expect(setup.travel, 'the track must be taller than the stage').toBeGreaterThan(200);

    const activeAt = async (fraction) => {
      await page.evaluate((y) => window.scrollTo(0, y), setup.top + setup.travel * fraction);
      return await expect
        .poll(async () => page.evaluate(() => {
          const ops = [...document.querySelectorAll('#cap-mobile .cm-j-phase')]
            .map((e) => parseFloat(getComputedStyle(e).opacity));
          return ops.indexOf(Math.max(...ops));
        }), { timeout: 5000 });
    };

    // The stage stays pinned to the top of the viewport throughout…
    await (await activeAt(0.05)).toBe(0);
    const pinnedTop = await page.evaluate(() =>
      Math.round(document.querySelector('#cap-mobile .cm-j-stage').getBoundingClientRect().top));
    expect(pinnedTop).toBe(0);

    // …and each phase takes its turn.
    await (await activeAt(0.5)).toBe(1);
    await (await activeAt(0.95)).toBe(2);

    // The dot rail follows.
    const activeDot = await page.evaluate(() =>
      [...document.querySelectorAll('#cap-mobile .cm-j-dot')].findIndex((e) => e.classList.contains('is-on')));
    expect(activeDot).toBe(2);

    // The phase fills the pin. Centring ~400px of content in a 100svh stage
    // left visible dead space above the photo and below the last record; the
    // photo now flexes to take up the slack.
    const slack = await page.evaluate(() => {
      const s = document.querySelector('#cap-mobile .cm-j-stage').getBoundingClientRect();
      const ph = document.querySelector('#cap-mobile .cm-j-phase.is-on').getBoundingClientRect();
      const last = [...document.querySelectorAll('#cap-mobile .cm-j-phase.is-on .cm-tl-item')].pop()
        .getBoundingClientRect();
      return { above: ph.top - s.top, below: s.bottom - last.bottom };
    });
    expect(slack.above, 'dead space above the phase').toBeLessThanOrEqual(30);
    expect(slack.below, 'dead space below the last record').toBeLessThanOrEqual(40);
  });

  test('each Journey phase carries its own photo, fetched on arrival', async ({ page }) => {
    await gotoMobileHome(page);

    const shots = await page.evaluate(() =>
      [...document.querySelectorAll('#cap-mobile .cm-j-phase')].map((ph) => {
        const img = ph.querySelector('.cm-journey-img');
        return {
          has: !!img,
          src: img && img.getAttribute('src'),
          deferred: img && img.getAttribute('data-src'),
          alt: img && img.getAttribute('alt')
        };
      })
    );

    expect(shots).toHaveLength(3);
    expect(shots.every((s) => s.has), 'every phase needs a photo').toBe(true);
    expect(shots.every((s) => s.alt && s.alt.length > 3)).toBe(true);

    // The point of the change: three DIFFERENT photos. A copy-paste slip would
    // otherwise satisfy every other assertion here.
    const sources = shots.map((s) => s.src || s.deferred);
    expect(new Set(sources).size, 'the three phases must not share a photo').toBe(3);

    // Only the first is fetched up front; the rest wait for their phase.
    expect(shots[0].src).toBeTruthy();
    expect(shots[0].deferred).toBeNull();
    expect(shots[1].src).toBeNull();
    expect(shots[2].src).toBeNull();

    // Scrolling to the last phase promotes it, and it really loads.
    const g = await page.evaluate(() => {
      const t = document.querySelector('#cap-mobile .cm-j-track');
      const s = document.querySelector('#cap-mobile .cm-j-stage');
      return {
        top: window.scrollY + t.getBoundingClientRect().top,
        travel: t.offsetHeight - Math.min(s.offsetHeight, window.innerHeight)
      };
    });
    await page.evaluate((y) => window.scrollTo(0, y), g.top + g.travel * 0.95);
    await expect
      .poll(() => page.evaluate(() => {
        const i = document.querySelectorAll('#cap-mobile .cm-j-phase')[2].querySelector('.cm-journey-img');
        return i.getAttribute('src') && i.complete && i.naturalWidth;
      }), { timeout: 8000 })
      .toBeGreaterThan(0);
  });

  test('reduced motion: Our Journey does not pin and shows every record', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await gotoMobileHome(page);

    const r = await page.evaluate(() => ({
      track: document.querySelectorAll('#cap-mobile .cm-j-track').length,
      stage: document.querySelectorAll('#cap-mobile .cm-j-stage').length,
      visiblePhases: [...document.querySelectorAll('#cap-mobile .cm-j-phase')]
        .filter((e) => parseFloat(getComputedStyle(e).opacity) > 0.99).length,
      items: document.querySelectorAll('#cap-mobile .cm-tl-item').length,
      // Nothing promotes data-src on this branch — there is no stage and no
      // scroll driver — so every photo must ship a real src or two phases
      // render broken images.
      deferredPhotos: document.querySelectorAll('#cap-mobile .cm-journey-img[data-src]').length,
      realPhotos: [...document.querySelectorAll('#cap-mobile .cm-journey-img')]
        .filter((i) => i.getAttribute('src')).length
    }));
    expect(r.track, 'no scroll track under reduced motion').toBe(0);
    expect(r.stage).toBe(0);
    expect(r.visiblePhases, 'all three phases readable at once').toBe(3);
    expect(r.items).toBe(8);
    expect(r.deferredPhotos, 'nothing would ever promote these').toBe(0);
    expect(r.realPhotos).toBe(3);
    await ctx.close();
  });

  test('the city rail swaps the portfolio tiles', async ({ page }) => {
    await gotoMobileHome(page);

    // Hyderabad is the default, matching the desktop frame.
    await expect(page.locator('#cap-mobile .cm-city.is-active')).toHaveText('Hyderabad');
    await expect(page.locator('#cap-mobile .cm-tile')).toHaveCount(4);
    // Real school names and real localities — never the mockup's garbled
    // "Spruha Mata" / "Bowrampet" / "Sainikpuri".
    await expect(page.locator('#cap-mobile .cm-tiles')).toContainText('Sancta Maria International School');
    await expect(page.locator('#cap-mobile .cm-tiles')).toContainText('Serilingampally, Hyderabad');
    await expect(page.locator('#cap-mobile .cm-tiles')).toContainText('Suchitra, Hyderabad');
    await expect(page.locator('#cap-mobile .cm-tiles')).not.toContainText('Spruha');
    await expect(page.locator('#cap-mobile .cm-tiles')).not.toContainText('Bowrampet');

    await page.locator('#cap-mobile .cm-city', { hasText: 'Dubai' }).click();
    await expect(page.locator('#cap-mobile .cm-city.is-active')).toHaveText('Dubai');
    await expect(page.locator('#cap-mobile .cm-tile')).toHaveCount(2);
    await expect(page.locator('#cap-mobile .cm-tiles')).toContainText('Hartland International School');
    // Single-campus cities: the locality IS the city, so it must not double up.
    await expect(page.locator('#cap-mobile .cm-tiles')).not.toContainText('Dubai, Dubai');

    // Every tile resolves an image (the Shri Ram stand-in included).
    const broken = await page.evaluate(() =>
      [...document.querySelectorAll('#cap-mobile .cm-tile-img')]
        .filter((i) => i.complete && i.naturalWidth === 0)
        .map((i) => i.getAttribute('src'))
    );
    expect(broken).toEqual([]);
  });

  test('portfolio tiles are decoded before the grid reaches the fold', async ({ page }) => {
    await gotoMobileHome(page);

    // Plain loading="lazy" only starts the fetch once the tiles are nearly on
    // screen, so the #eceded placeholder showed as you arrived. They are
    // warmed ~800px ahead instead — while still not costing ~1MB up front.
    const atLoad = await page.evaluate(() =>
      [...document.querySelectorAll('#cap-mobile .cm-tile-img')].filter((i) => i.complete && i.naturalWidth > 0).length);
    expect(atLoad, 'tiles should not all load before anyone scrolls').toBeLessThan(4);

    // Stop short of the section — the grid must still be below the fold.
    await page.evaluate(() => {
      const pf = document.querySelector('#cap-mobile .cm-pf');
      window.scrollTo(0, window.scrollY + pf.getBoundingClientRect().top - 900);
    });
    const belowFold = await page.evaluate(() =>
      document.querySelector('#cap-mobile .cm-pf').getBoundingClientRect().top > window.innerHeight - 50);
    expect(belowFold, 'the grid should still be off screen at this point').toBe(true);

    await expect
      .poll(() => page.evaluate(() =>
        [...document.querySelectorAll('#cap-mobile .cm-tile-img')].filter((i) => i.complete && i.naturalWidth > 0).length
      ), { timeout: 8000 })
      .toBe(4);

    // A city switch happens with the grid already in view, so its tiles must
    // not be lazy at all.
    await page.evaluate(() => {
      const pf = document.querySelector('#cap-mobile .cm-pf');
      window.scrollTo(0, window.scrollY + pf.getBoundingClientRect().top - 40);
    });
    await page.locator('#cap-mobile .cm-city', { hasText: 'Bangalore' }).click();
    const loadingAttrs = await page.evaluate(() =>
      [...document.querySelectorAll('#cap-mobile .cm-tile-img')].map((i) => i.getAttribute('loading')));
    expect(loadingAttrs.every((v) => v === 'eager'), 'switched-in tiles should not lazy-load').toBe(true);
  });

  test('the operators grid has no empty cells and readable logos', async ({ page }) => {
    await gotoMobileHome(page);

    const grid = await page.evaluate(() => {
      const g = document.querySelector('#cap-mobile .cm-ops-grid').getBoundingClientRect();
      const cells = [...document.querySelectorAll('#cap-mobile .cm-ops-cell')];
      const logos = [...document.querySelectorAll('#cap-mobile .cm-ops-logo')];
      const last = cells[cells.length - 1].getBoundingClientRect();
      return {
        cells: cells.length,
        empty: cells.filter((c) => !c.querySelector('.cm-ops-logo')).length,
        logos: logos.length,
        lastSpans: last.width / g.width,
        minLogoW: Math.min(...logos.map((l) => l.getBoundingClientRect().width)),
        maxLogoW: Math.max(...logos.map((l) => l.getBoundingClientRect().width)),
        // any logo wider than its cell means the box outgrew its track
        overflowing: logos.filter((l) => {
          const c = l.closest('.cm-ops-cell').getBoundingClientRect();
          const r = l.getBoundingClientRect();
          return r.width > c.width || r.height > c.height;
        }).length
      };
    });

    // 7 logos cannot fill a rectangular grid, so the odd one spans the row
    // rather than sitting beside padded blanks — the old 3-up rendered 9 cells,
    // two of them empty.
    expect(grid.cells).toBe(7);
    expect(grid.empty, 'no padded blank cells').toBe(0);
    expect(grid.logos).toBe(7);
    expect(grid.lastSpans, 'the odd logo should span the full row').toBeGreaterThan(0.9);

    // The point of going 2-up: the marks were capped at 76px wide before.
    expect(grid.maxLogoW).toBeGreaterThan(76);
    expect(grid.overflowing, 'no logo may outgrow its cell').toBe(0);
    expect(grid.minLogoW).toBeGreaterThan(0);

    await assertNoHorizontalOverflow(page);
  });

  test('footer links navigate', async ({ page }) => {
    await gotoMobileHome(page);
    await page.locator('#cap-mobile .cm-fnav a[href="./projects.html"]').click();
    await expect(page).toHaveURL(/projects\.html$/);
  });

  test('widening past the breakpoint hands back to the scaled frame', async ({ page }) => {
    const errors = attachErrorCapture(page);
    await gotoMobileHome(page);
    await expect(page.locator('#cap-viewport')).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator('#cap-mobile')).toBeHidden();
    await expect(page.locator('#cap-scaler')).toBeVisible();

    // The deferred one-shot must have run the frame setups and re-fitted:
    // a scale of 0 would leave the frame collapsed.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const m = getComputedStyle(document.getElementById('cap-scaler')).transform;
            const s = m === 'none' ? 1 : parseFloat(m.split('(')[1]);
            return s;
          }),
        { timeout: 15000 }
      )
      .toBeGreaterThan(0.5);
    await page.waitForSelector('#cap-journey', { timeout: 20000 });
    expectNoPageErrors(errors);
  });

  test('mobile home full-page screenshot', async ({ page }, testInfo) => {
    testInfo.setTimeout(150000);
    await gotoMobileHome(page);
    await fullPageShot(page, testInfo, 'home-mobile');
  });
});
