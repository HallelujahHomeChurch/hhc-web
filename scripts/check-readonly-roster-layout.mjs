// Synthetic browser acceptance test; component permission selection is covered
// by OrganizationUnitPage.test.tsx. Uses the real frame and organization CSS.
// PLAYWRIGHT_MODULE selects an external test tool; CHROMIUM_PATH is optional.
import assert from 'node:assert/strict'
import {mkdtemp, readFile, rm} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createElement as h} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {DataTableFrame} from '@hallelujahhomechurch/ui'

const require = createRequire(import.meta.url)
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const root = await mkdtemp(join(tmpdir(), 'readonly-roster-browser-'))
const css = await readFile(new URL('../src/features/organizations/organizations.css', import.meta.url), 'utf8')
const ui = await readFile(require.resolve('@hallelujahhomechurch/ui/styles.css'), 'utf8')
const names = ['陳小明', '陳'+('合成長姓名測試'.repeat(12)), 'Alexandria'+('SyntheticUnbrokenName'.repeat(7)), '王👩🏽‍💻'+('林🧑‍🤝‍🧑'.repeat(10)), 'Alexandria Catherine Montgomery Example']
function fixture({manager, locale, kind, empty}) {
  const english = locale === 'en'
  const headers = [h('th', {key:'name'}, english ? 'Name' : '名稱'), ...(manager ? [h('th', {key:'email'}, 'Email')] : []), h('th', {key:'type', className:'organization-type-cell'}, english ? 'Type' : '類型'), ...(kind==='family' ? [h('th', {key:'kind'}, '單位種類')] : []), ...(manager ? [h('th', {key:'edit', className:'organization-row-action'}, '設定')] : [])]
  const rows = empty ? [h('tr', {key:'empty'}, h('td', {className:'organization-empty', colSpan:2}, '目前沒有會員。'))] : names.map((name, i) => h('tr', {key:i},
    h('td', null, manager ? h('a', {href:'#', className:'organization-row-link'}, h('span', null, name)) : h('span', null, name)),
    manager && h('td', {className:'organization-email'}, 'synthetic-'+i+'@example.test'),
    h('td', {className:'organization-type-cell'}, i%2 ? (english ? 'Responsible person' : '負責人') : (english ? 'Member' : '會員')),
    kind==='family' && h('td', {className:'organization-unit-kind-cell'}),
    manager && h('td', {className:'organization-row-action'}, h('a', {href:'#', className:'organization-icon-action', 'aria-label':'編輯'}, '✎'))))
  const table = h('table', {className:'organization-table'+(!manager && kind==='small_group' ? ' organization-table--readonly' : ''), 'aria-label':'Synthetic member directory'}, h('thead', null, h('tr', null, headers)), h('tbody', null, rows))
  return renderToStaticMarkup(h('main', {className:'organizations', lang:locale}, h('div', {className:'organizations-main'}, h('section', {className:'organization-document organization-page organization-folder-page'}, h('div', {className:'organization-directory'}, h(DataTableFrame, null, table))))))
}
let browser
try {
  browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH, headless:true, timeout:15_000,
    args:['--no-sandbox','--disable-crashpad-for-testing','--disable-dev-shm-usage'],
    env:{...process.env,XDG_CONFIG_HOME:join(root,'config'),XDG_CACHE_HOME:join(root,'cache')}})
  const page = await browser.newPage()
  page.setDefaultTimeout(10_000)
  const table = page.locator('.organization-table')
  const configure = async (config, scale=1) => {
    await page.setContent('<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+ui+'*{box-sizing:border-box}html{font-size:'+16*scale+'px}body{margin:0;font-family:Arial,"Noto Sans CJK TC",sans-serif}'+css+'</style></head><body>'+fixture(config)+'</body></html>')
    await page.evaluate(()=>document.fonts.ready)
  }
  const measure = () => page.evaluate(() => {
    const table = document.querySelector('.organization-table')
    const body = table.closest('.hhc-data-table-frame__body')
    const rows = [...table.tBodies[0].rows]
    const names = rows.map(row => {
      const cell = row.cells[0], span = cell.querySelector('span')
      const range = document.createRange()
      if (span) range.selectNodeContents(span)
      return {text:span?.textContent, height:cell.getBoundingClientRect().height,
        rects:[...range.getClientRects()].map(r=>({left:r.left,right:r.right})),
        left:cell.getBoundingClientRect().left,right:cell.getBoundingClientRect().right,
        fontSize:getComputedStyle(cell).fontSize,textOverflow:getComputedStyle(cell).textOverflow}
    })
    return {viewport:innerWidth, bodyWidth:body.clientWidth, bodyScroll:body.scrollWidth,
      tableWidth:table.getBoundingClientRect().width, pageOverflow:document.documentElement.scrollWidth-innerWidth,
      typeWidth:rows[0].cells[1]?.getBoundingClientRect().width, names,
      minWidth:getComputedStyle(table).minWidth, typeWhitespace:getComputedStyle(rows[0].cells[1]).whiteSpace,
      typeLines:rows.map(row=>{const range=document.createRange();range.selectNodeContents(row.cells[1]);return range.getClientRects().length})}
  })
  const results = []
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({width, height: 800})
    for (const locale of ['zh-Hant', 'en']) for (const scale of [1, 2]) {
      await configure({manager:false, locale, kind:'small_group', empty:false}, scale)
      const metrics = await measure()
      assert.ok(metrics.bodyScroll <= metrics.bodyWidth + 1, JSON.stringify({locale, scale, metrics}))
      assert.ok(metrics.pageOverflow <= 1, 'page must not scroll horizontally')
      assert.equal(await table.locator('thead th').count(), 2)
      assert.equal(await table.locator('.organization-email').count(), 0)
      assert.equal(await table.locator('a').count(), 0)
      if (locale === 'zh-Hant') assert.ok(metrics.typeLines.every(n=>n===1), 'short Chinese types stay on one line')
      if (locale === 'en' && scale === 1) assert.equal(metrics.typeLines[0], 1, 'Member should fit without breaking the word')
      assert.deepEqual(metrics.names.map(n=>n.text), names)
      for (const name of metrics.names) {
        assert.equal(name.fontSize, `${14 * scale}px`, 'text must not shrink')
        assert.notEqual(name.textOverflow, 'ellipsis')
        assert.ok(name.rects.every(r=>r.left>=name.left-1 && r.right<=name.right+1), 'complete text must wrap within its cell')
      }
      assert.ok(metrics.names[1].height > metrics.names[0].height, 'long CJK names must grow the row')
      assert.ok(metrics.names[2].height > metrics.names[0].height, 'unbroken English names must grow the row')
      results.push({width, locale, scale, bodyWidth:metrics.bodyWidth, tableWidth:metrics.tableWidth, typeWidth:metrics.typeWidth, nameHeight:metrics.names[1].height})
    }
    await configure({manager:true, locale:'zh-Hant', kind:'small_group', empty:false})
    const managed = await measure()
    assert.equal(managed.minWidth, '480px')
    assert.equal(await table.locator('.organization-email').count(), 5)
    assert.equal(await table.locator('thead th').count(), 4)
    assert.equal(await table.locator('tbody a').count(), 10)
    assert.ok(managed.bodyScroll > managed.bodyWidth, 'manager columns retain their existing scroll behavior')
    await configure({manager:false, locale:'zh-Hant', kind:'small_group', empty:false})
    assert.equal(await table.locator('.organization-email').count(), 0, 'permission downgrade removes email')
    await configure({manager:false, locale:'zh-Hant', kind:'small_group', empty:true})
    assert.equal(await table.locator('.organization-empty').getAttribute('colspan'), '2')
    await configure({manager:false, locale:'zh-Hant', kind:'family', empty:false})
    assert.equal((await measure()).minWidth, '480px', 'extra-column directories keep their existing layout')
  }
  await configure({manager:false, locale:'zh-Hant', kind:'small_group', empty:false})
  await page.locator('.hhc-data-table-frame__body').focus()
  assert.equal(await page.evaluate(()=>document.activeElement.className), 'hhc-data-table-frame__body')
  assert.ok(await table.getAttribute('aria-label'), 'table keeps its accessible name')
  console.log(JSON.stringify({browser:await browser.version(), cases:results.length, results}, null, 2))
} finally {
  await browser?.close()
  await rm(root, {recursive:true,force:true})
}
