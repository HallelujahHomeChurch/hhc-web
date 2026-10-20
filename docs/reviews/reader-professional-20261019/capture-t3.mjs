// Synthetic loopback UI evidence; run with ego-browser nodejs < this file.
const fs = await import('node:fs/promises');
const assert = (await import('node:assert/strict')).default;
const page = (await taskSpace(362)).page('p2');
const dir = '/Users/rayselfs/Projects/hhc/website/.worktrees/reader-professional-experience-impl-20261019/docs/reviews/reader-professional-20261019';
const geometry = [];
async function settled() {
  await page.evaluate(async () => {document.getAnimations().forEach(a => a.finish()); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));});
}
async function capture(kind, width, theme) {
  await settled();
  const info = await page.evaluate(kind => {
    const frame = kind.startsWith('search') ? document.querySelector('.reader-search-panel') : document.querySelector('.hhc-modal') ?? document.querySelector('.reader-navigation-panel:not([hidden])');
    const header = frame.querySelector('header');
    return {kind, viewport: [innerWidth, innerHeight], frame: frame.getBoundingClientRect().toJSON(), header: header.getBoundingClientRect().toJSON(), background: getComputedStyle(frame).backgroundColor, blur: getComputedStyle(document.querySelector('.hhc-modal-overlay') ?? document.querySelector('.reader-panel-backdrop')).backdropFilter, focused: document.activeElement?.tagName};
  }, kind);
  geometry.push({...info, theme});
  assert(info.frame.width > 0 && info.frame.height > 0);
  await page.screenshot({path: `${dir}/T3-${kind}-${width}-${theme}.png`, raw: true});
}
async function close() {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.hhc-modal-overlay') && !document.querySelector('[data-panel-open]'));
}
for (const [width, theme] of [[390, 'light'], [390, 'dark'], [768, 'light'], [1440, 'light'], [1440, 'dark']]) {
  await page.cdp('Emulation.setDeviceMetricsOverride', {width, height: 844, deviceScaleFactor: 1, mobile: false});
  const actualWidth = await page.evaluate(() => innerWidth);
  assert.equal(actualWidth, width, 'capture CSS viewport must match the declared width');
  await page.goto(`http://127.0.0.1:7152/?t3=matrix&theme=${theme}`);
  await page.waitForSelector('loc=css:[data-sentence-id="s0"]', {state: 'visible'});
  await page.click(`loc=role:button[name="${width < 768 ? '目錄' : '縮圖'}"]`);
  await capture('contents', width, theme); await close();
  await page.click('loc=role:button[name="字級與行距"]');
  await capture('settings', width, theme); await close();
  if (width === 390) {
    await page.click('loc=role:button[name="搜尋本期週報"]');
    assert.equal(await page.evaluate(() => document.activeElement?.type), 'search');
    await page.fill('loc=role:searchbox[name="搜尋本期週報"]', '內容');
    await page.press('loc=role:searchbox[name="搜尋本期週報"]', 'Enter');
    await page.waitForSelector('loc=css:[data-reader-search-target="s2"]', {state: 'visible'});
    await capture('search', width, theme);
    if (theme === 'light') {
      await page.evaluate(() => {Object.defineProperty(visualViewport, 'height', {configurable: true, value: 400}); Object.defineProperty(visualViewport, 'offsetTop', {configurable: true, value: 20}); visualViewport.dispatchEvent(new Event('resize'));});
      await capture('search-viewport-400', width, theme);
      await page.evaluate(() => {delete visualViewport.height; delete visualViewport.offsetTop; visualViewport.dispatchEvent(new Event('resize'));});
      await page.click('loc=css:[data-reader-search-target="s2"]');
      await page.waitForFunction(() => !document.querySelector('[data-panel-open]'));
      await settled();
      geometry.push(await page.evaluate(() => ({kind: 'source-jump', active: document.activeElement?.outerHTML, source: document.querySelector('[data-reader-source-focus]')?.textContent, readerScroll: document.querySelector('.reader-viewport').scrollTop})));
      await page.click('loc=role:button[name="搜尋本期週報"]');
      assert.equal(await page.evaluate(() => document.querySelector('.reader-search input').value), '內容');
    }
    await close();
  }
}
await fs.writeFile(`${dir}/T3-geometry.json`, JSON.stringify({synthetic: true, physicalIME: false, geometry}, null, 2));
console.log({captures: geometry.length, geometry});
