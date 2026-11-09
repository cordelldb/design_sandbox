import './style.css'
import { renderJourney, renderShape } from './charts.ts'

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel))
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const SVG_NS = 'http://www.w3.org/2000/svg'

/* ---------------------------------------------------------------- Nav */
const nav = $('#nav')!
const toggle = $<HTMLButtonElement>('#navToggle')!
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8)
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

const setMenu = (open: boolean) => {
  nav.classList.toggle('is-open', open)
  toggle.setAttribute('aria-expanded', String(open))
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
}
toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')))
$$('#navMobile a').forEach((a) => a.addEventListener('click', () => setMenu(false)))
window.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false))

const menu = $('.nav-menu')
const menuBtn = $<HTMLButtonElement>('.nav-menu-btn')
if (menu && menuBtn) {
  menu.addEventListener('focusin', () => menuBtn.setAttribute('aria-expanded', 'true'))
  menu.addEventListener('focusout', (e) => {
    if (!menu.contains((e as FocusEvent).relatedTarget as Node)) menuBtn.setAttribute('aria-expanded', 'false')
  })
}

/* ---------------------------------------------------------------- Count-up */
function countUp(el: HTMLElement, to: number, from = 0, dur = 1300) {
  if (reduced) {
    el.textContent = String(to)
    return
  }
  const start = performance.now()
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / dur)
    const eased = 1 - Math.pow(1 - p, 3)
    el.textContent = String(Math.round(from + (to - from) * eased))
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/* ---------------------------------------------------------------- Hero entrance */
const hero = $('.hero')!
const startHero = () => {
  $$('.reveal', hero).forEach((el, i) => {
    el.style.setProperty('--d', `${i * 0.07}s`)
    el.classList.add('is-in')
  })
  requestAnimationFrame(() => {
    hero.classList.add('is-ready')
    $$('[data-count]', hero).forEach((el) => {
      const to = Number(el.dataset.count)
      el.textContent = '0'
      setTimeout(() => countUp(el, to), 500)
    })
  })
}
// Wait for webfonts so the pen underline measures against the final glyphs
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]).then(startHero)

/* ---------------------------------------------------------------- Scroll reveal */
const revealIO = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return
      e.target.classList.add('is-in')
      revealIO.unobserve(e.target)
    })
  },
  { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
)
$$('.reveal')
  .filter((el) => !hero.contains(el))
  .forEach((el) => {
    // Stagger siblings that enter together
    const sibs = Array.from(el.parentElement?.children ?? []).filter((c) => c.classList.contains('reveal'))
    const idx = Math.min(sibs.indexOf(el), 6)
    el.style.setProperty('--d', `${idx * 0.06}s`)
    revealIO.observe(el)
  })

/* ---------------------------------------------------------------- Full analysis demo */
const renderers: Record<string, (host: HTMLElement) => void> = {
  chartJourney: renderJourney,
  chartShape: renderShape,
}
/** Render (or re-render) a panel's chart at its current width. Hidden panels render on first show. */
const renderChart = (panel: HTMLElement) => {
  const host = $('.chart', panel)
  if (!host || panel.hidden) return
  const w = String(host.clientWidth)
  if (host.dataset.w === w) return
  host.dataset.w = w
  renderers[host.id]?.(host)
}

const tabs = $$<HTMLButtonElement>('.tabs [role="tab"]')
const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')!)!)
let demoVisible = false

const drawPanel = (panel: HTMLElement) => {
  renderChart(panel)
  const chart = $('.chart', panel)
  panel.classList.remove('is-drawn')
  chart?.classList.remove('is-drawn')
  // Two frames so the reset state paints before the transition starts
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      panel.classList.add('is-drawn')
      chart?.classList.add('is-drawn')
    }),
  )
}

const selectTab = (i: number, focus = false) => {
  tabs.forEach((t, k) => {
    const on = k === i
    t.setAttribute('aria-selected', String(on))
    t.tabIndex = on ? 0 : -1
    panels[k].hidden = !on
  })
  if (focus) tabs[i].focus()
  if (demoVisible) drawPanel(panels[i])
  else renderChart(panels[i])
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(i))
  t.addEventListener('keydown', (e) => {
    const k = e.key
    let n = -1
    if (k === 'ArrowRight') n = (i + 1) % tabs.length
    if (k === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length
    if (k === 'Home') n = 0
    if (k === 'End') n = tabs.length - 1
    if (n >= 0) {
      e.preventDefault()
      selectTab(n, true)
    }
  })
})

panels.forEach(renderChart)
let resizeTimer = 0
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => panels.forEach(renderChart), 150)
})

const demo = $('.analysis-demo')!
new IntersectionObserver(
  (entries, io) => {
    if (!entries[0].isIntersecting) return
    demoVisible = true
    drawPanel(panels.find((p) => !p.hidden)!)
    io.disconnect()
  },
  { threshold: 0.35 },
).observe(demo)

/* ---------------------------------------------------------------- Quilty Score dial */
const dial = $('#dial')!
const dialSvg = $<SVGSVGElement>('#dialSvg')!
const dialValue = $('#dialValue')!
const dialLabel = $('#dialLabel')!
const dialSub = $('#dialSub')!
const pillarEls = $$<HTMLLIElement>('#pillars li')
const pillars = pillarEls.map((li) => ({
  v: Number(li.dataset.v),
  name: li.querySelector('h3')!.textContent!.trim(),
}))
const overall = Math.round(pillars.reduce((s, p) => s + p.v, 0) / pillars.length)

const C = 160
const R = 124
const GAP = 15 // degrees between segments (room for round caps)
const rad = (deg: number) => (deg * Math.PI) / 180
const polar = (r: number, deg: number) => [C + r * Math.cos(rad(deg)), C + r * Math.sin(rad(deg))]

function buildDial() {
  const mk = (tag: string, attrs: Record<string, string | number>) => {
    const el = document.createElementNS(SVG_NS, tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
    return el
  }
  // Instrument ticks
  const ticks = mk('g', {})
  for (let i = 0; i < 100; i++) {
    const deg = 180 + i * 3.6
    const major = i % 25 === 0
    const [x1, y1] = polar(major ? 139 : 142, deg)
    const [x2, y2] = polar(major ? 150 : 146, deg)
    ticks.appendChild(mk('line', { x1, y1, x2, y2, class: major ? 'tick tick-major' : 'tick' }))
  }
  dialSvg.appendChild(ticks)

  // Four pillar segments, starting at 9 o'clock and running clockwise (TL, TR, BR, BL)
  pillars.forEach((p, i) => {
    const a0 = 180 + i * 90 + GAP / 2
    const a1 = 180 + (i + 1) * 90 - GAP / 2
    const [x0, y0] = polar(R, a0)
    const [x1, y1] = polar(R, a1)
    const d = `M${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`
    const g = mk('g', { class: 'seg', 'data-i': i })
    g.appendChild(mk('path', { d, class: 'seg-track' }))
    const fill = mk('path', { d, class: 'seg-fill', pathLength: 100 })
    fill.setAttribute('style', `--v:${p.v}; transition-delay:${i * 0.12}s, 0s, 0s`)
    g.appendChild(fill)
    const [lx, ly] = polar(162, 180 + i * 90 + 45)
    const label = mk('text', { x: lx, y: ly + 4, 'text-anchor': 'middle', class: 'seg-label' })
    label.textContent = String(i + 1).padStart(2, '0')
    g.appendChild(label)
    dialSvg.appendChild(g)
  })
}
buildDial()
dialValue.textContent = String(overall)

let shown = overall
let tweenId = 0
function showValue(to: number) {
  const from = shown
  shown = to
  const id = ++tweenId
  if (reduced) {
    dialValue.textContent = String(to)
    return
  }
  const start = performance.now()
  const step = (now: number) => {
    if (id !== tweenId) return
    const p = Math.min(1, (now - start) / 380)
    dialValue.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))))
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

const segs = $$<SVGGElement>('.seg', dialSvg)
function setActive(i: number | null) {
  segs.forEach((s, k) => s.classList.toggle('is-active', k === i))
  pillarEls.forEach((li, k) => li.classList.toggle('is-active', k === i))
  if (i === null) {
    dial.removeAttribute('data-active')
    dialLabel.textContent = 'Quilty Score'
    dialSub.innerHTML = 'Sample &middot; out of 100'
    showValue(overall)
  } else {
    dial.setAttribute('data-active', String(i))
    dialLabel.textContent = pillars[i].name
    dialSub.innerHTML = `Pillar ${String(i + 1).padStart(2, '0')} &middot; out of 100`
    showValue(pillars[i].v)
  }
}
pillarEls.forEach((li, i) => {
  li.addEventListener('pointerenter', () => setActive(i))
  li.addEventListener('pointerleave', () => setActive(null))
  li.addEventListener('focus', () => setActive(i))
  li.addEventListener('blur', () => setActive(null))
})

new IntersectionObserver(
  (entries, io) => {
    if (!entries[0].isIntersecting) return
    dial.classList.add('is-drawn')
    dialValue.textContent = '0'
    shown = 0
    setTimeout(() => showValue(overall), 150)
    io.disconnect()
  },
  { threshold: 0.4 },
).observe(dial)

/* ---------------------------------------------------------------- FAQ: one open at a time */
const faqItems = $$<HTMLDetailsElement>('.faq details')
faqItems.forEach((d) =>
  d.addEventListener('toggle', () => {
    if (d.open) faqItems.forEach((o) => o !== d && (o.open = false))
  }),
)
