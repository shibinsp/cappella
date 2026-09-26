// Animation-system guarantees: text integrity, revert-to-pristine DOM,
// reduced-motion behavior, menu stagger, scramble restoration.
const { test, expect } = require('./fixtures');
const { attachErrorCapture, expectNoPageErrors, PAGES } = require('./helpers');

test.describe('animation system', () => {
  test('counters end on the exact authored strings with no extra DOM', async ({ page }, testInfo) => {
    await page.goto('/about-us.html');
    await page.locator('.stats-band').scrollIntoViewIfNeeded();

    // Client 2026-08-09 p10: the figures carry their units now. This list is a
    // second copy of the one in about.spec.js — the two must move together.
    const expected = ['$500 Mn+', '16 Assets', '135 Acres', '3.3 Mn SFT'];
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
  const HOME = '/index.html';
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
  const HOME = '/index.html';

  test('pin sticks and folds progress with scroll', async ({ page }, testInfo) => {
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

    // Client 2026-09-25 (Cappella_Website_Journey_Folds.pptx): one fold per
    // third of the track, the rail's fold label and dot following along.
    const TITLES = ['The Foundation', 'Building the Ecosystem', 'Scaling the Asset Class'];
    for (let i = 0; i < 3; i++) {
      const y = geom.top + ((i + 0.5) / 3) * geom.total;
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await expect
        .poll(
          () => page.evaluate((i) => +getComputedStyle(document.querySelectorAll('.cap-jf-fold')[i]).opacity, i),
          { timeout: 8000 }
        )
        .toBeGreaterThan(0.99);
      const st = await page.evaluate((i) => {
        const r = document.querySelector('.cap-j-pin').getBoundingClientRect();
        const fold = document.querySelectorAll('.cap-jf-fold')[i];
        const card = fold.querySelector('.cap-jf-card').getBoundingClientRect();
        return {
          top: Math.round(r.top), h: Math.round(r.height),
          on: [...document.querySelectorAll('.cap-jf-fold')].map((f) => f.classList.contains('is-on')),
          dot: [...document.querySelectorAll('.cap-jf-dot')].findIndex((d) => d.classList.contains('is-on')),
          label: document.querySelector('.cap-jf-fold-label').textContent,
          title: fold.querySelector('.cap-jf-title').textContent,
          cardInside: card.bottom <= r.bottom && card.right <= r.right
        };
      }, i);
      // The pin must be filling the viewport
      expect(st.top).toBe(0);
      expect(st.h).toBe(await page.evaluate(() => window.innerHeight));
      expect(st.on).toEqual([0, 1, 2].map((k) => k === i));
      expect(st.dot).toBe(i);
      expect(st.label).toBe('Fold ' + (i + 1));
      expect(st.title).toBe(TITLES[i]);
      expect(st.cardInside, 'the highlight card fits inside the pin').toBe(true);
    }

    // The rail dots are controls: clicking the first scrolls back to fold 1.
    await page.locator('.cap-jf-dot').first().click();
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll('.cap-jf-fold')[0].classList.contains('is-on')),
        { timeout: 8000 })
      .toBe(true);

    // Old journey band content must be hidden
    const hidden = await page.evaluate(
      () => document.querySelectorAll('#cap-scaler [data-jhidden]').length
    );
    expect(hidden).toBeGreaterThan(5);
    expectNoPageErrors(errors);
  });

  test.describe('wheel stepping', () => {
  // The synthetic stream below is paced by in-page timers, which a fully
  // loaded 4-worker run can starve past the 240ms gesture gap — splitting one
  // fling into two. Real input is immune (the handler times gestures by the
  // event's own timeStamp), so a retry here absorbs machine load only.
  test.describe.configure({ retries: 2 });
  test('a hard fling moves exactly one fold, and leaves at the ends', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'wheel stepping asserted at desktop scale');
    testInfo.setTimeout(90000);
    const errors = attachErrorCapture(page);
    await page.goto(HOME, { waitUntil: 'networkidle' });
    await page.waitForSelector('#cap-journey', { timeout: 20000 });
    await page.waitForTimeout(1500);

    const top = await page.evaluate(() =>
      window.scrollY + document.getElementById('cap-journey').getBoundingClientRect().top);
    await page.evaluate((y) => window.scrollTo(0, y), top - 700);
    await page.waitForTimeout(800);

    // Client 2026-09-25: "sometime it is scrolling fast". A spun wheel plus a
    // trackpad-style inertia tail, dispatched in-page at 16ms so the stream is
    // one continuous gesture (Playwright's mouse.wheel spaces events too far
    // apart to read as one).
    const fling = (dir) => page.evaluate((dir) => new Promise((res) => {
      const deltas = [...Array(30).fill(120), ...Array.from({ length: 60 }, (_, i) => 60 * Math.pow(0.93, i))];
      let i = 0;
      const fire = () => {
        if (i >= deltas.length) return setTimeout(res, 1400);
        const t = document.elementFromPoint(innerWidth / 2, innerHeight / 2) || document.body;
        t.dispatchEvent(new WheelEvent('wheel', { deltaY: dir * deltas[i++], bubbles: true, cancelable: true }));
        setTimeout(fire, 16);
      };
      fire();
    }), dir);
    const state = () => page.evaluate(() => {
      const h = document.getElementById('cap-journey').getBoundingClientRect();
      return {
        fold: [...document.querySelectorAll('.cap-jf-fold')].findIndex((f) => f.classList.contains('is-on')),
        pinned: h.top <= 1 && h.bottom >= innerHeight - 1
      };
    });

    // Arriving at speed lands on the first fold rather than coasting past it…
    await fling(1);
    expect(await state()).toEqual({ fold: 0, pinned: true });
    // …each fling after that is one fold…
    await fling(1);
    expect(await state()).toEqual({ fold: 1, pinned: true });
    await fling(1);
    expect(await state()).toEqual({ fold: 2, pinned: true });
    // …and one more leaves the section instead of trapping the page.
    await fling(1);
    expect((await state()).pinned).toBe(false);
    // Back up from below lands on the last fold.
    await fling(-1);
    expect(await state()).toEqual({ fold: 2, pinned: true });
    expectNoPageErrors(errors);
  });

  test('touchpad: a swipe inside the last swipe\'s inertia still moves on', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'wheel stepping asserted at desktop scale');
    testInfo.setTimeout(90000);
    const errors = attachErrorCapture(page);
    await page.goto(HOME, { waitUntil: 'networkidle' });
    await page.waitForSelector('#cap-journey', { timeout: 20000 });
    await page.waitForTimeout(1500);

    const park = (sixth) => page.evaluate((sixth) => {
      const host = document.getElementById('cap-journey');
      window.scrollTo(0, window.scrollY + host.getBoundingClientRect().top + (host.offsetHeight - innerHeight) * sixth / 6);
    }, sixth);
    const fold = () => page.evaluate(() =>
      [...document.querySelectorAll('.cap-jf-fold')].findIndex((f) => f.classList.contains('is-on')));
    // Client 2026-09-26 (laptop touchpad): "feels stuck". A touchpad swipe
    // accelerates, holds, then trails ~1.5s of fading inertia; a second swipe
    // cuts that tail short. Replayed on rAF from a timeline, so late frames
    // batch events instead of stretching the gaps between them.
    const swipes = (starts) => page.evaluate((starts) => new Promise((res) => {
      const one = [2, 4, 7, 11, 16, 22, 28, 34, 38, 40, 44, 37, 42, 39, 45, 36, 41, 40,
        ...Array.from({ length: 95 }, (_, k) => 40 * Math.pow(0.955, k))];
      const events = [];
      starts.forEach((t0, si) => {
        const until = starts[si + 1] ?? Infinity;
        one.forEach((d, k) => { const t = t0 + k * 16; if (t < until) events.push([t, d]); });
      });
      const t0 = performance.now();
      let i = 0;
      const tick = () => {
        const el = performance.now() - t0;
        while (i < events.length && events[i][0] <= el) {
          const t = document.elementFromPoint(innerWidth / 2, innerHeight / 2) || document.body;
          t.dispatchEvent(new WheelEvent('wheel', { deltaY: events[i][1], bubbles: true, cancelable: true }));
          i++;
        }
        if (i < events.length) requestAnimationFrame(tick); else setTimeout(res, 1300);
      };
      tick();
    }), starts);

    // One swipe, jitter and inertia included, is one fold…
    await park(1);
    await page.waitForTimeout(1200);
    await swipes([0]);
    expect(await fold()).toBe(1);
    // …and a second swipe made during the first one's inertia is a second
    // fold, whether it lands mid-animation or in the inertia tail.
    for (const second of [450, 900]) {
      await park(1);
      await page.waitForTimeout(1200);
      await swipes([0, second]);
      expect(await fold(), 'second swipe at ' + second + 'ms').toBe(2);
    }
    expectNoPageErrors(errors);
  });
  });

  // REMOVED 2026-07-28 — 'portrait phones get the pinned scene fitted to the
  // device resolution'. Phones (<=767px) no longer render the scaled frame at
  // all: they get #cap-mobile, whose Our Journey is a vertical timeline
  // (home-mobile.spec.js asserts it). _setupJourneyPinned's PORTRAIT branch
  // needs width < 720, which is now below the breakpoint, so the composition
  // this test covered is unreachable. The PORTRAIT code itself is left in
  // place pending a decision to remove it.

  test('content below the pin is shifted and reachable', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'no pinned journey below 768px — phones render #cap-mobile');
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

test.describe('portfolio city filter', () => {
  const HOME = '/index.html';

  test('the red mark follows the active city through real clicks', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'hover/click flow asserted at desktop scale');
    testInfo.setTimeout(90000);
    await page.goto(HOME, { waitUntil: 'networkidle' });
    await page.waitForSelector('#cap-journey', { timeout: 20000 });
    await page.evaluate(() => {
      const scaler = document.getElementById('cap-scaler');
      const el = [...scaler.querySelectorAll('span')].find(
        (e) => (e.textContent || '').trim() === 'Andhra Pradesh' && e.style.cursor === 'pointer'
      );
      el.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(1000);

    // Client 2026-08-09: the column groups by state now. Telangana is last so
    // the run ends on the city whose tiles are the baked photo cards.
    for (const city of ['Andhra Pradesh', 'Tamil Nadu', 'Dubai, UAE', 'Telangana']) {
      const target = await page.evaluate((name) => {
        const scaler = document.getElementById('cap-scaler');
        const el = [...scaler.querySelectorAll('span')].find(
          (e) => (e.textContent || '').trim() === name && e.style.cursor === 'pointer'
        );
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, city);
      // Real mouse click: exercises the hover-scramble + tile re-render path
      // that used to strand the logo on the previous city
      await page.mouse.click(target.x, target.y);
      await page.mouse.move(700, 120);
      await page.waitForTimeout(1100); // scramble + tile entrance + settle pass

      const m = await page.evaluate((name) => {
        const scaler = document.getElementById('cap-scaler');
        const el = [...scaler.querySelectorAll('span')].find(
          (e) => (e.textContent || '').trim() === name && e.style.cursor === 'pointer'
        );
        const spans = [...el.querySelectorAll('.cap-char')].filter((s) => /\S/.test(s.textContent || ''));
        const last = spans[spans.length - 1].getBoundingClientRect();
        const logo = scaler
          .querySelector('.fig-asset-eae7f9bdb03982f5-132fb376')
          .getBoundingClientRect();
        return {
          gapX: logo.left - last.right,
          rowOverlap: logo.top < last.bottom && logo.bottom > last.top,
          visible: logo.width > 0
        };
      }, city);
      expect(m.visible, city).toBe(true);
      expect(m.rowOverlap, city + ' row').toBe(true);
      expect(m.gapX, city + ' gap').toBeGreaterThan(2);
      expect(m.gapX, city + ' gap').toBeLessThan(40);
    }
  });
});

test.describe('portfolio counter-scroll columns', () => {
  const HOME = '/index.html';
  const CARD_L = '.fig-asset-3f58066ce9ef777c-b69ac725'; // left column
  const CARD_R = '.fig-asset-016a31a2601bd9e3'; // right column

  test('columns move oppositely and the motion reverses across centre', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'frame-bound portfolio columns; phones use the #cap-mobile tile grid');
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

test.describe('footer reveal replays', () => {
  const HOME = '/index.html';

  // The two-way retract/replay this file used to assert belonged to the baked
  // frame footer, which no longer exists: since 2026-08-14 the homepage shares
  // the same <footer class="site-footer"> as every other page, and the shared
  // reveal is one-way (shared/site.js initReveals adds .is-in and unobserves).
  // So the assertion is now the shared behaviour — it arms hidden, reveals on
  // approach, and staggers its items — which is what the subpages do too.
  test('footer arms hidden, reveals on scroll, and staggers its items', async ({ page }, testInfo) => {
    testInfo.setTimeout(90000);
    const errors = attachErrorCapture(page);
    await page.goto(HOME, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const reveal = page.locator('.site-footer [data-reveal="footer"]');
    await expect(reveal).toHaveCount(1);

    // Armed: the wiring script has run and set per-item delays, but the footer
    // is still far below the fold so .is-in has not landed.
    await expect
      .poll(
        () => page.evaluate(() => {
          const el = document.querySelector('.site-footer .cap-footer-item');
          return el ? el.style.transitionDelay : '';
        }),
        { timeout: 20000 }
      )
      .not.toBe('');
    await expect(reveal).not.toHaveClass(/is-in/);

    // Reveals once scrolled to. Lenis hijacks scrollTo on the homepage, so
    // drive it with the wheel the way a visitor would.
    await expect
      .poll(async () => {
        await page.mouse.wheel(0, 4000);
        return reveal.evaluate((el) => el.classList.contains('is-in'));
      }, { timeout: 30000 })
      .toBe(true);

    // Delays sweep left→right / top→down rather than all firing together.
    const delays = await page.evaluate(() =>
      [...document.querySelectorAll('.site-footer .cap-footer-item')]
        .map((el) => parseFloat(el.style.transitionDelay)));
    expect(delays.length).toBeGreaterThan(3);
    expect(Math.max(...delays)).toBeGreaterThan(Math.min(...delays));

    expectNoPageErrors(errors);
  });
});
