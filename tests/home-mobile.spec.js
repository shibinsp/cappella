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

    // Client 2026-08-09 (p22): "REMOVE CTA". This used to assert the Explore
    // Our Assets button pointed at projects.html; now it must not be here at
    // all. Kept as an absence check rather than deleted so the button cannot
    // reappear unnoticed.
    await expect(page.locator('#cap-mobile .cm-cta')).toHaveCount(0);
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

    // Client 2026-08-09 (p22): "THERE ARE SUPPOSED TO BE 4 STATS" — Frame 6 had
    // dropped the desktop band's 75 Years+; it is back, so mobile matches
    // desktop. All four are named, and none may be clipped by the band, which
    // is overflow:hidden — that is how the first attempt failed silently.
    const stats = page.locator('#cap-mobile .cm-stat');
    await expect(stats).toHaveCount(4);
    const band = page.locator('#cap-mobile .cm-stats');
    for (const fig of ['$500 Mn+', '16 Assets', '135 Acres', '75 Years+']) {
      await expect(band).toContainText(fig);
    }
    await band.scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => {
      const b = document.querySelector('#cap-mobile .cm-stats').getBoundingClientRect();
      return [...document.querySelectorAll('#cap-mobile .cm-stat')]
        .filter((e) => e.getBoundingClientRect().bottom > b.bottom + 0.5)
        .map((e) => e.textContent.trim().slice(0, 20));
    });
    expect(overflow, 'no stat may spill the band').toEqual([]);

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

    // Regression: ISSUE-001 — the mailto in the footer rendered 19px tall,
    // under the 24px minimum a touch target needs; the city buttons and the
    // LinkedIn badge sat at 30px, under platform guidance.
    // Found by /qa on 2026-07-29
    // Report: .gstack/qa-reports/qa-report-cappella-2026-07-29.md
    //
    // Scoped to EVERY interactive element, not a hand-picked three: the old
    // assertion listed .cm-acc-btn/.cm-city/.cm-fnav and floored at 30px, so
    // the 19px mailto was outside the selector AND under the bar.
    const short = await page.evaluate(() =>
      [...document.querySelectorAll('#cap-mobile a, #cap-mobile button, #cap-mobile input')]
        .map((el) => ({
          t: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 28),
          h: Math.round(el.getBoundingClientRect().height)
        }))
        // height 0 = inside a collapsed accordion panel, not on screen to tap
        .filter((r) => r.h > 0 && r.h < 44)
    );
    expect(short, 'every tappable element should be at least 44px tall').toEqual([]);

    // Growing the city buttons must not make their hit areas overlap.
    const overlaps = await page.evaluate(() => {
      const r = [...document.querySelectorAll('#cap-mobile .cm-city')].map((c) => c.getBoundingClientRect());
      let n = 0;
      for (let i = 1; i < r.length; i++) if (r[i].top < r[i - 1].bottom - 0.5) n++;
      return n;
    });
    expect(overlaps, 'adjacent city hit areas must not overlap').toBe(0);
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

    // The open row's copy sits INSIDE its card, not edge-to-edge. This used to
    // measure the row's photo; client 2026-08-09 (p24) removed those, so the
    // body copy is what carries the inset now — and it carries it as PADDING
    // (0 14px 14px), where the image used margin. Its border box is therefore
    // flush with the card by design, so measure the content edge.
    const inset = await page.evaluate(() => {
      const body = document.querySelector('#cap-mobile .cm-acc-item.is-open .cm-acc-body');
      const cs = getComputedStyle(body);
      const card = body.closest('.cm-acc-item').getBoundingClientRect();
      const r = body.getBoundingClientRect();
      return {
        left: r.left + parseFloat(cs.paddingLeft) - card.left,
        right: card.right - (r.right - parseFloat(cs.paddingRight))
      };
    });
    expect(inset.left).toBeGreaterThan(0);
    expect(inset.right).toBeGreaterThan(0);
  });

  test('dropdowns are text-only — no photos', async ({ page }) => {
    // Client 2026-08-09 (p24): "REMOVE ALL IMAGES". This test previously
    // asserted the opposite — that every row carried a photo and only the open
    // one was fetched — so it is inverted rather than deleted. The deferred-
    // loading machinery it guarded (~765KB held back from collapsed panels)
    // went with the images, so there is nothing left to defer.
    await gotoMobileHome(page);

    const rows = page.locator('#cap-mobile .cm-acc-item');
    await expect(rows).toHaveCount(4);
    await expect(page.locator('#cap-mobile .cm-acc-img')).toHaveCount(0);
    await expect(page.locator('#cap-mobile .cm-acc-panel img')).toHaveCount(0);

    // Every row still has its copy, and toggling still works without the
    // promote-on-open step that used to run alongside it.
    for (let i = 0; i < 4; i++) {
      await expect(rows.nth(i).locator('.cm-acc-body')).not.toBeEmpty();
    }
    const first = rows.first();
    await first.locator('.cm-acc-btn').click();
    await expect(first.locator('.cm-acc-btn')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#cap-mobile .cm-acc-img')).toHaveCount(0);
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

  test('Our Journey arrows step phases without replacing the scroll model', async ({ page }) => {
    // Client 2026-08-09 (p25): "just add the arrows, keep the scroll". The
    // arrows do not own the phase — they scroll to the middle of the target
    // phase's band, and update() still derives the phase from track progress.
    // So the check that matters is that tapping actually MOVES THE PAGE: if a
    // future change made them set the phase directly, the two controls could
    // disagree and this would catch it.
    await gotoMobileHome(page);
    await page.evaluate(() => {
      const t = document.querySelector('#cap-mobile .cm-j-track');
      window.scrollTo(0, window.scrollY + t.getBoundingClientRect().top + 10);
    });
    await page.waitForTimeout(600);

    const phase = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#cap-mobile .cm-j-phase')].findIndex((e) =>
          e.classList.contains('is-on')
        )
      );
    const scrollY = () => page.evaluate(() => Math.round(window.scrollY));

    expect(await phase()).toBe(0);
    await expect(page.locator('#cap-mobile .cm-j-arrow--prev')).toBeDisabled();
    await expect(page.locator('#cap-mobile .cm-j-arrow--next')).toBeEnabled();

    const y0 = await scrollY();
    await page.locator('#cap-mobile .cm-j-arrow--next').click();
    await expect.poll(phase, { timeout: 6000 }).toBe(1);
    expect(await scrollY(), 'the arrow scrolls the page, it does not just set a class')
      .toBeGreaterThan(y0);

    await page.locator('#cap-mobile .cm-j-arrow--next').click();
    await expect.poll(phase, { timeout: 6000 }).toBe(2);
    // Chronology, not a carousel: it must not wrap back to Foundation.
    await expect(page.locator('#cap-mobile .cm-j-arrow--next')).toBeDisabled();

    await page.locator('#cap-mobile .cm-j-arrow--prev').click();
    await expect.poll(phase, { timeout: 6000 }).toBe(1);

    // They sit over the artwork, so they need a real target and must not collide
    // with the dots that already own the right edge.
    const geo = await page.evaluate(() => {
      const n = document.querySelector('#cap-mobile .cm-j-arrow--next').getBoundingClientRect();
      const p = document.querySelector('#cap-mobile .cm-j-arrow--prev').getBoundingClientRect();
      const d = document.querySelector('#cap-mobile .cm-j-dots').getBoundingClientRect();
      const s = document.querySelector('#cap-mobile .cm-j-stage').getBoundingClientRect();
      // Every phase's artwork, not just the one showing: the arrows are pinned
      // to the stage, the images are not the same height, and the shortest one
      // is what decides whether the band is safe.
      const imgs = [...document.querySelectorAll('#cap-mobile .cm-j-phase .cm-journey-img')]
        .map((e) => e.getBoundingClientRect());
      return {
        w: n.width,
        h: n.height,
        // Symmetric insets, as in the client's reference layout (p25).
        leftInset: Math.round(p.left - s.left),
        rightInset: Math.round(s.right - n.right),
        overlaps: !(n.right < d.left || n.left > d.right || n.bottom < d.top || n.top > d.bottom),
        offImage: imgs.filter((i) => n.bottom > i.bottom || n.top < i.top).length
      };
    });
    expect(geo.w).toBeGreaterThanOrEqual(24);
    expect(geo.h).toBeGreaterThanOrEqual(24);
    expect(geo.overlaps, 'arrows must clear the phase dots').toBe(false);
    expect(geo.leftInset, 'prev/next sit at matching insets').toBe(geo.rightInset);
    // The artwork's foot moves with the list length below it (45.5% of the
    // stage at 320x568 up to 79.4% at 430x932), which is why the band is at
    // 30% and not the reference's 50% — at 50% these fall onto white.
    expect(geo.offImage, 'arrows stay on the artwork for every phase').toBe(0);
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

    // Client 2026-08-09: the rail groups by state; Telangana is the default,
    // matching the desktop frame, and carries the four Hyderabad schools.
    await expect(page.locator('#cap-mobile .cm-city.is-active')).toHaveText('Telangana');
    await expect(page.locator('#cap-mobile .cm-tile')).toHaveCount(4);
    // Real school names and real localities — never the mockup's garbled
    // "Spruha Mata" / "Bowrampet" / "Sainikpuri".
    await expect(page.locator('#cap-mobile .cm-tiles')).toContainText('Sancta Maria International School');
    await expect(page.locator('#cap-mobile .cm-tiles')).toContainText('St. Andrews High School');
    await expect(page.locator('#cap-mobile .cm-tiles')).toContainText('Hyderabad, Telangana');
    await expect(page.locator('#cap-mobile .cm-tiles')).not.toContainText('Spruha');
    await expect(page.locator('#cap-mobile .cm-tiles')).not.toContainText('Bowrampet');

    await page.locator('#cap-mobile .cm-city', { hasText: 'Dubai' }).click();
    await expect(page.locator('#cap-mobile .cm-city.is-active')).toHaveText('Dubai, UAE');
    await expect(page.locator('#cap-mobile .cm-tile')).toHaveCount(2);
    await expect(page.locator('#cap-mobile .cm-tiles')).toContainText('Hartland International School');
    // The locality is subsumed by the group name here ("Dubai" inside "Dubai,
    // UAE"), so it must not be printed twice.
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
    await page.locator('#cap-mobile .cm-city', { hasText: 'Karnataka' }).click();
    const loadingAttrs = await page.evaluate(() =>
      [...document.querySelectorAll('#cap-mobile .cm-tile-img')].map((i) => i.getAttribute('loading')));
    expect(loadingAttrs.every((v) => v === 'eager'), 'switched-in tiles should not lazy-load').toBe(true);
  });

  test('the journey rail runs unbroken into Our Portfolio\'s rule', async ({ page }) => {
    await gotoMobileHome(page);

    // Park past the pin so the stage has released and the two sections are
    // adjacent — that is the only point where the join is visible.
    const g = await page.evaluate(() => {
      const t = document.querySelector('#cap-mobile .cm-j-track');
      const s = document.querySelector('#cap-mobile .cm-j-stage');
      return {
        top: window.scrollY + t.getBoundingClientRect().top,
        travel: t.offsetHeight - Math.min(s.offsetHeight, window.innerHeight)
      };
    });
    await page.evaluate((y) => window.scrollTo(0, y), g.top + g.travel + 160);
    await page.waitForTimeout(600);

    const joint = await page.evaluate(() => {
      const j = document.querySelector('#cap-mobile .cm-journey');
      const pf = document.querySelector('#cap-mobile .cm-pf');
      const on = document.querySelector('#cap-mobile .cm-j-phase.is-on')
        || document.querySelector('#cap-mobile .cm-j-phase');
      const last = [...on.querySelectorAll('.cm-tl-item')].pop();
      const rule = pf.querySelector('.cm-rule');
      const R = (n) => n.getBoundingClientRect();
      return {
        lastBottom: R(last).bottom,
        journeyBottom: R(j).bottom,
        pfTop: R(pf).top,
        ruleTop: R(rule).top,
        jPad: parseFloat(getComputedStyle(j).paddingBottom),
        pfPad: parseFloat(getComputedStyle(pf).paddingTop),
        jStub: parseFloat(getComputedStyle(j, '::after').height),
        pfStub: parseFloat(getComputedStyle(pf, '::before').height)
      };
    });

    // The stubs must equal the padding they sit in. If padding grows past the
    // stub the line stops short of the rule; if it shrinks the line overshoots
    // past it. Both are driven by --cm-joint precisely so this cannot drift.
    expect(joint.jStub).toBeCloseTo(joint.jPad, 0);
    expect(joint.pfStub).toBeCloseTo(joint.pfPad, 0);

    // …and the run is continuous: last record → journey edge → portfolio edge → rule.
    expect(joint.journeyBottom).toBeCloseTo(joint.lastBottom + joint.jPad, 0);
    expect(joint.pfTop).toBeCloseTo(joint.journeyBottom, 0);
    expect(joint.ruleTop).toBeCloseTo(joint.pfTop + joint.pfPad, 0);

    // Tighter than a normal 44+44 section break — the rail makes these read as
    // one run, so a full break either side left ~88px of bare white.
    expect(joint.ruleTop - joint.lastBottom).toBeLessThanOrEqual(60);
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
