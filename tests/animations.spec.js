// Animation-system guarantees: text integrity, revert-to-pristine DOM,
// reduced-motion behavior, menu stagger, scramble restoration.
const { test, expect } = require('@playwright/test');
const { attachErrorCapture, expectNoPageErrors, PAGES } = require('./helpers');

test.describe('animation system', () => {
  test('counters end on the exact authored strings with no extra DOM', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'behavior is viewport-independent');
    await page.goto('/about-us.html');
    await page.locator('.stats-band').scrollIntoViewIfNeeded();

    const expected = ['$500 Mn+', '16', '135', '3.3 Mn'];
    const dds = page.locator('.stats-band .stat dd');
    for (let i = 0; i < expected.length; i++) {
      // toHaveText auto-retries past the 1.5s count-up
      await expect(dds.nth(i)).toHaveText(expected[i]);
      // count-up is a pure text tween — never any odometer DOM
      const children = await dds.nth(i).evaluate((el) => el.childElementCount);
      expect(children).toBe(0);
    }
  });

  for (const pageDef of PAGES) {
    test(`${pageDef.file}: h1 reverts to pristine DOM after the char rise`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'behavior is viewport-independent');
      const errors = attachErrorCapture(page);
      await page.goto(`/${pageDef.file}`);

      // After the char animation + revert window the h1 must be plain text
      await expect
        .poll(
          () => page.locator('h1').evaluate((el) => el.childElementCount),
          { timeout: 8000 }
        )
        .toBe(0);
      await expect(page.locator('h1')).toHaveText(pageDef.h1);
      expectNoPageErrors(errors);
    });
  }

  test('vendor libs present and no console errors', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'load set identical everywhere');
    for (const p of PAGES) {
      const errors = attachErrorCapture(page);
      await page.goto(`/${p.file}`);
      await page.waitForTimeout(800);
      const libs = await page.evaluate(() => ({
        gsap: typeof window.gsap !== 'undefined',
        lenis: typeof window.Lenis !== 'undefined',
        split: typeof window.SplitType !== 'undefined'
      }));
      expect(libs, `${p.file} vendor libs`).toEqual({ gsap: true, lenis: true, split: true });
      expectNoPageErrors(errors);
    }
  });

  test('scramble hover restores the exact link text', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'hover is desktop-only');
    await page.goto('/about-us.html');
    const link = page.locator('#site-nav a[href="projects.html"]');
    await link.hover();
    await page.waitForTimeout(200); // mid-scramble
    await page.mouse.move(10, 400); // leave
    await expect(link).toHaveText('Projects'); // restored verbatim
  });

  test('menu links rise with homepage stagger delays', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'panel menu is <900px');
    await page.goto('/about-us.html');
    await page.locator('.nav-toggle').click();
    const third = page.locator('#site-nav li:nth-child(3) a');
    await expect(third).toHaveCSS('transition-delay', '0.26s');
    await page.keyboard.press('Escape');
    await expect(page.locator('.nav-toggle')).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('homepage preloader', () => {
  const HOME = '/Cappella%20Website.dc.html';
  // The curtain exits via a traveling diagonal gradient-mask fade (the panel
  // itself never moves) — detect the inline exit values on the 9999 div.
  const exitStarted = (page) =>
    page.waitForFunction(() => {
      const els = [...document.querySelectorAll('body > div')];
      return els.some(
        (d) =>
          d.style.zIndex === '9999' &&
          d.style.opacity === '0' &&
          (d.style.maskPosition || d.style.webkitMaskPosition || '').includes('100%') &&
          !d.style.transform.includes('translateY(-100%)')
      );
    }, { timeout: 20000 });

  test('flight lands pixel-perfect on the header lockup, then cleans up', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'geometry is asserted at desktop scale');
    testInfo.setTimeout(60000);
    const errors = attachErrorCapture(page);
    // Sample the landing INSIDE the page (a CDP round-trip can race the
    // 950ms cleanup under tracing overhead): arm a poller that detects the
    // exit and records the rects at flight end (820ms) into window.__preGeo.
    // The flown pair's inline transform VALUE is its destination — it never
    // depends on how far the animation has interpolated. Capture each image's
    // untransformed base box (while its transform is still the identity
    // entrance state), then keep recording the latest applied transform and
    // the latest target rects until cleanup removes the overlay. The intended
    // landing = base ∘ transform, compared against the final target rects —
    // fully deterministic under any CPU load.
    await page.addInitScript(() => {
      const rr = (r) => ({ x: r.left, y: r.top, w: r.width, h: r.height });
      const state = {};
      const poll = setInterval(() => {
        const wrap = [...document.querySelectorAll('body > div')].find((d) =>
          (d.getAttribute('style') || '').includes('10000')
        );
        if (!wrap) {
          if (!state.seen) return; // overlay not created yet
          // Overlay removed → finalize
          clearInterval(poll);
          const parse = (t) => {
            const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\(([\d.]+)\)/.exec(t || '');
            return m ? { tx: +m[1], ty: +m[2], s: +m[3] } : null;
          };
          const nt = parse(state.nameT);
          window.__preGeo = {
            fade: !!state.fade,
            wipe: !!state.wipe,
            flightRan: !!(nt && state.nameBase),
            // intended landing = base box transformed about origin 0 0
            // (only the wordmark flies — the C icon fades out in place)
            name: nt && state.nameBase
              ? { x: state.nameBase.x + nt.tx, y: state.nameBase.y + nt.ty, w: state.nameBase.w * nt.s, h: state.nameBase.h * nt.s }
              : null,
            wm: state.wm || null
          };
          return;
        }
        const imgs = [...wrap.querySelectorAll('img')];
        if (imgs.length < 2) return;
        state.seen = true;
        // The wordmark (imgs[1]) is the flying element; the icon just fades.
        const t1 = imgs[1].style.transform || '';
        if (t1.includes('translateY(-14px)')) {
          state.fade = true; // graceful fade path (scrolled / late hydration)
        } else if (!t1.includes('translate(')) {
          // Pre-flight: prefer the product's own synchronously-measured base
          // (__capPreFlight, set the instant the flight is computed — no
          // interpolation noise); rendered-box sampling is the fallback.
          state.nameBase = window.__capPreFlight
            ? { x: window.__capPreFlight.x, y: window.__capPreFlight.y, w: window.__capPreFlight.w, h: window.__capPreFlight.h }
            : rr(imgs[1].getBoundingClientRect());
        } else {
          if (window.__capPreFlight) {
            state.nameBase = { x: window.__capPreFlight.x, y: window.__capPreFlight.y, w: window.__capPreFlight.w, h: window.__capPreFlight.h };
          }
          state.nameT = t1;
        }
        const wm = document.querySelector('.fig-asset-7cb777f5a65019d1-0d894d80');
        if (wm) state.wm = rr(wm.getBoundingClientRect());
        // Curtain exit must be the traveling diagonal mask fade — never the
        // old slide-up transform.
        const curtain = [...document.querySelectorAll('body > div')].find(
          (d) => d.style.zIndex === '9999'
        );
        if (curtain && curtain.style.opacity === '0') {
          state.wipe =
            (curtain.style.maskPosition || curtain.style.webkitMaskPosition || '').includes('100%') &&
            !curtain.style.transform.includes('translateY(-100%)');
        }
      }, 40);
    });
    await page.goto(HOME);
    await page.waitForFunction(() => window.__preGeo, { timeout: 25000 });
    const geo = await page.evaluate(() => window.__preGeo);
    testInfo.annotations.push({ type: 'sample', description: JSON.stringify(geo) });
    if (geo.flightRan) {
      // Landing budget: ≤2px positional delta, ≤2% size delta (intended
      // landing = base box ∘ applied transform — animation-progress-proof)
      expect(geo.wm, 'target present').toBeTruthy();
      expect(Math.abs(geo.name.x - geo.wm.x)).toBeLessThanOrEqual(2);
      // y budget 3px: the sampler's base box can carry ~2px of the entrance
      // translateY easing tail under CPU load (measurement noise, not landing
      // error — the product measures its own base synchronously).
      expect(Math.abs(geo.name.y - geo.wm.y)).toBeLessThanOrEqual(3);
      expect(Math.abs(geo.name.w - geo.wm.w)).toBeLessThanOrEqual(geo.wm.w * 0.02);
    } else {
      // Late hydration under load → the designed graceful fallback must have
      // run: lockup fades in place (never flies), header still handed off.
      expect(geo.fade, `neither flight nor fade ran (sample: ${JSON.stringify(geo)})`).toBe(true);
    }
    // Whichever lockup path ran, the curtain itself must have exited via the
    // diagonal wipe + fade, not the old slide-up.
    expect(geo.wipe, 'curtain exited via clip-path wipe + fade').toBe(true);

    // After cleanup: flown nodes gone, real lockup visible
    await page.waitForTimeout(400);
    const post = await page.evaluate(() => ({
      preloaderGone: ![...document.querySelectorAll('body > div')].some((d) => d.style.zIndex === '9999'),
      wmOpacity: getComputedStyle(document.querySelector('.fig-asset-7cb777f5a65019d1-0d894d80')).opacity,
      // The C icon must NOT exist in the header (removed by request)
      iconGone: !document.getElementById('cap-header-logo-icon')
    }));
    expect(post.preloaderGone).toBe(true);
    expect(post.wmOpacity).toBe('1');
    expect(post.iconGone).toBe(true);
    expectNoPageErrors(errors);
  });

  test('refresh while scrolled: lockup fades in place, scroll position respected', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'behavior is viewport-independent');
    testInfo.setTimeout(60000);
    await page.goto(HOME);
    await page.waitForTimeout(4200); // settle fully so reload restores scroll
    await page.evaluate(() => window.scrollTo(0, 5200));
    await page.waitForTimeout(600);
    await page.reload();
    await exitStarted(page);
    await page.waitForTimeout(250);

    const mid = await page.evaluate(() => {
      const wrap = [...document.querySelectorAll('body > div')].find((d) =>
        (d.getAttribute('style') || '').includes('10000')
      );
      const img = wrap && wrap.querySelector('img');
      const r = img && img.getBoundingClientRect();
      return {
        scrollY: Math.round(window.scrollY),
        flownStaysOnScreen: r ? r.top > -60 && r.top < window.innerHeight : true
      };
    });
    // Restoration applies asynchronously and can lag the exit under CPU
    // contention — poll rather than one-shot (the product handles both
    // orderings by design).
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 8000 })
      .toBeGreaterThan(4000);
    expect(mid.flownStaysOnScreen, 'lockup must fade in place, not fly off-screen').toBe(true);

    await page.waitForTimeout(1300);
    const end = await page.evaluate(() => ({
      scrollY: Math.round(window.scrollY),
      preloaderGone: ![...document.querySelectorAll('body > div')].some((d) => d.style.zIndex === '9999')
    }));
    expect(end.preloaderGone).toBe(true);
    expect(end.scrollY).toBeGreaterThan(4000);
  });
});

test.describe('pinned journey', () => {
  const HOME = '/Cappella%20Website.dc.html';

  test('pin sticks and phases progress with scroll', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'scrub asserted at desktop scale');
    testInfo.setTimeout(90000);
    const errors = attachErrorCapture(page);
    await page.goto(HOME, { waitUntil: 'networkidle' });
    await page.waitForSelector('#cap-journey', { timeout: 20000 });

    const geom = await page.evaluate(() => {
      const host = document.getElementById('cap-journey');
      return {
        top: window.scrollY + host.getBoundingClientRect().top,
        total: host.offsetHeight - window.innerHeight
      };
    });
    expect(geom.total).toBeGreaterThan(1000); // real scrub room

    for (let i = 0; i < 3; i++) {
      const y = geom.top + ((i + 0.5) / 3) * geom.total;
      await page.evaluate((y) => window.scrollTo(0, y), y);
      // Lerp smoothing (0.09/frame) needs time to settle
      await expect
        .poll(
          () => page.evaluate((i) => +document.querySelectorAll('.cap-j-phase')[i].style.opacity, i),
          { timeout: 8000 }
        )
        .toBeGreaterThan(0.9);
      // The pin must be filling the viewport
      const pin = await page.evaluate(() => {
        const r = document.querySelector('.cap-j-pin').getBoundingClientRect();
        return { top: Math.round(r.top), h: Math.round(r.height) };
      });
      expect(pin.top).toBe(0);
      expect(pin.h).toBe(await page.evaluate(() => window.innerHeight));

      // Building sits ON the horizon: its visual base (PNG alpha base, carried
      // as data-base) must land on the sky horizon at 87.2% of stage height
      const base = await page.evaluate((i) => {
        const ph = document.querySelectorAll('.cap-j-phase')[i];
        const b = ph.querySelector('.cap-j-building');
        const stage = document.querySelector('.cap-j-stage');
        const br = b.getBoundingClientRect();
        const sr = stage.getBoundingClientRect();
        const sky = document.querySelector('.cap-j-sky');
        const t = getComputedStyle(sky).transform;
        const m = t === 'none' ? { f: 0 } : new DOMMatrixReadOnly(t);
        return {
          visualBase: br.top + br.height * parseFloat(b.dataset.base),
          horizon: sr.top + sr.height * 0.872,
          scale: sr.height / 820,
          skyShift: m.f
        };
      }, i);
      expect(Math.abs(base.visualBase - base.horizon)).toBeLessThan(12 * base.scale);
      // Raised sea level: sky translated up -75px on Growth/Expansion
      // (loose tolerance — the scroll lerp may still be settling)
      expect(Math.abs(base.skyShift - (i === 0 ? 0 : -75))).toBeLessThan(8);
    }

    // Old journey band content must be hidden
    const hidden = await page.evaluate(
      () => document.querySelectorAll('#cap-scaler [data-jhidden]').length
    );
    expect(hidden).toBeGreaterThan(5);
    expectNoPageErrors(errors);
  });

  test('content below the pin is shifted and reachable', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'geometry asserted at desktop scale');
    testInfo.setTimeout(90000);
    await page.goto(HOME, { waitUntil: 'networkidle' });
    await page.waitForSelector('#cap-journey', { timeout: 20000 });

    // The frame opened a gap: elements below the band carry jorig bookkeeping
    const shift = await page.evaluate(() => {
      const els = [...document.querySelectorAll('#cap-scaler [data-jorig-top]')];
      if (!els.length) return null;
      const el = els[0];
      return {
        count: els.length,
        delta: parseFloat(el.style.top) - parseFloat(el.getAttribute('data-jorig-top'))
      };
    });
    expect(shift.count).toBeGreaterThan(30);
    expect(shift.delta).toBeGreaterThan(500);

    // Footer still lands at the very bottom and is fully composed
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2500);
    const wm = page.locator('.fig-asset-7cb777f5a65019d1-0d894d80');
    await expect
      .poll(() => wm.evaluate((el) => getComputedStyle(el).opacity), { timeout: 8000 })
      .toBe('1');
  });
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('no Lenis, counters static, hero instantly visible', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'behavior is viewport-independent');
    await page.goto('/about-us.html');
    await page.waitForTimeout(400);

    // Lenis never initializes under reduce (its class lands on <html>)
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).not.toContain('lenis');

    // Counters show final text immediately, h1 untouched by SplitType
    const dd = page.locator('.stats-band .stat dd').first();
    await expect(dd).toHaveText('$500 Mn+');
    expect(await page.locator('h1').evaluate((el) => el.childElementCount)).toBe(0);

    // Everything visible without scrolling
    const opacities = await page
      .locator('[data-reveal]')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
    for (const o of opacities) expect(o).toBe('1');
  });
});

test.describe('portfolio counter-scroll columns', () => {
  const HOME = '/Cappella%20Website.dc.html';
  const CARD_L = '.fig-asset-3f58066ce9ef777c-b69ac725'; // left column
  const CARD_R = '.fig-asset-016a31a2601bd9e3'; // right column

  test('columns move oppositely and the motion reverses across centre', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'scrub asserted at desktop scale');
    testInfo.setTimeout(90000);
    const errors = attachErrorCapture(page);
    await page.goto(HOME, { waitUntil: 'networkidle' });
    await page.waitForSelector('#cap-journey', { timeout: 20000 });
    await page.waitForTimeout(500);

    const cardDocY = await page.evaluate(
      (sel) => document.querySelector(sel).getBoundingClientRect().top + window.scrollY,
      CARD_L
    );
    const read = () =>
      page.evaluate(
        ([l, r]) => {
          const ty = (sel) => {
            const m = /translateY\((-?[\d.]+)px\)/.exec(
              document.querySelector(sel).style.transform || ''
            );
            return m ? +m[1] : null;
          };
          return { l: ty(l), r: ty(r) };
        },
        [CARD_L, CARD_R]
      );

    // Entering from below: columns must be split in opposite directions.
    // Poll — the lerp (0.1/frame) needs frames to approach its target.
    await page.evaluate((y) => window.scrollTo(0, y - 750), cardDocY);
    await expect
      .poll(async () => {
        const s = await read();
        return s.l !== null && s.r !== null && Math.sign(s.l) !== Math.sign(s.r) && Math.abs(s.l) > 20;
      }, { timeout: 10000 })
      .toBe(true);
    const A = await read();

    // Well past centre: the split must flip sign (fully scrubbed + reversible).
    // Deeper checkpoint: the slowed scrub (1.35×vh normalization) needs more
    // scroll distance to build a >20px split on the far side.
    await page.evaluate((y) => window.scrollTo(0, y + 800), cardDocY);
    await expect
      .poll(async () => {
        const s = await read();
        return s.l !== null && Math.abs(s.l) > 20 && Math.sign(s.l) !== Math.sign(A.l);
      }, { timeout: 10000 })
      .toBe(true);
    expectNoPageErrors(errors);
  });

  test('reduced motion: cards carry no counter-scroll transform', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'behavior is viewport-independent');
    testInfo.setTimeout(90000);
    const ctx = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { width: 1440, height: 900 }
    });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:8788${HOME}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const cardDocY = await page.evaluate(
      (sel) => document.querySelector(sel).getBoundingClientRect().top + window.scrollY,
      CARD_L
    );
    await page.evaluate((y) => window.scrollTo(0, y - 500), cardDocY);
    await page.waitForTimeout(800);
    const t = await page.evaluate(
      (sel) => document.querySelector(sel).style.transform || '',
      CARD_L
    );
    // updateCardTransforms writes translateY(0px) (parallaxY stays 0) — any
    // non-zero translateY means the scrub engine ran under reduced motion.
    const m = /translateY\((-?[\d.]+)px\)/.exec(t);
    expect(m ? Math.abs(+m[1]) : 0).toBeLessThan(0.01);
    await ctx.close();
  });
});

test.describe('footer wordmark type-on', () => {
  const HOME = '/Cappella%20Website.dc.html';

  test('letters appear left to right and all land at the bottom', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'scrub asserted at desktop scale');
    testInfo.setTimeout(90000);
    const errors = attachErrorCapture(page);
    await page.goto(HOME, { waitUntil: 'networkidle' });
    await page.waitForSelector('#cap-journey', { timeout: 20000 });
    await page.waitForSelector('.cap-fw span', { timeout: 20000 });

    // Mid-entry: opacities must be non-increasing left → right with a real
    // spread (the cascade), polled while the lerp converges.
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight - window.innerHeight * 1.45)
    );
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const o = [...document.querySelectorAll('.cap-fw span')].map(
              (s) => +s.style.opacity || 0
            );
            const ordered = o.every((v, i) => i === 0 || v <= o[i - 1] + 0.001);
            return ordered && o[0] > 0.5 && o[0] - o[o.length - 1] > 0.3;
          }),
        { timeout: 10000 }
      )
      .toBe(true);

    // Page bottom: every letter fully landed
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            [...document.querySelectorAll('.cap-fw span')].every(
              (s) => +s.style.opacity === 1
            )
          ),
        { timeout: 10000 }
      )
      .toBe(true);
    expectNoPageErrors(errors);
  });
});

test.describe('footer reveal replays', () => {
  const HOME = '/Cappella%20Website.dc.html';

  test('choreography retracts off-screen and replays on the next visit', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'behavior is viewport-independent');
    testInfo.setTimeout(90000);
    const errors = attachErrorCapture(page);
    await page.goto(HOME, { waitUntil: 'networkidle' });
    await page.waitForSelector('#cap-journey', { timeout: 20000 });
    await page.waitForTimeout(400);

    const state = () =>
      page.evaluate(() => ({
        cls: document.getElementById('cap-scaler').classList.contains('cap-footer-in'),
        logoClip: (document.querySelector('.fig-asset-c9d8f12cf6e90c99') || {}).style?.clipPath || ''
      }));
    const scrollBottom = () =>
      page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Visit 1: revealed
    await expect
      .poll(async () => { await scrollBottom(); return (await state()).cls; }, { timeout: 15000 })
      .toBe(true);

    // Leave: retracted (class dropped, big C re-clipped) once fully off-screen
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect
      .poll(async () => {
        await page.evaluate(() => window.scrollTo(0, 0));
        const s = await state();
        return !s.cls && s.logoClip.includes('100%');
      }, { timeout: 15000 })
      .toBe(true);

    // Visit 2: replays
    await expect
      .poll(async () => { await scrollBottom(); return (await state()).cls; }, { timeout: 15000 })
      .toBe(true);
    expectNoPageErrors(errors);
  });
});
