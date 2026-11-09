import './style.css'
import { renderJourney } from './chart.ts'

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel))
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
const wide = window.matchMedia('(min-width: 1021px)')
const SVG_NS = 'http://www.w3.org/2000/svg'

/* ---------------------------------------------------------------- Helpers */
function tween(from: number, to: number, dur: number, onStep: (v: number) => void) {
  if (reduced || dur <= 0) return onStep(to)
  const start = performance.now()
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / dur)
    onStep(from + (to - from) * (1 - Math.pow(1 - p, 3)))
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
function onceVisible(target: Element, cb: () => void, threshold = 0.3) {
  new IntersectionObserver(
    (entries, io) => {
      if (!entries[0].isIntersecting) return
      io.disconnect()
      cb()
    },
    { threshold },
  ).observe(target)
}

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

/* ---------------------------------------------------------------- Reveal */
const hero = $('.hero')!
const revealIO = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (!e.isIntersecting) return
      e.target.classList.add('is-in')
      revealIO.unobserve(e.target)
    }),
  { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
)
$$('.reveal')
  .filter((r) => !hero.contains(r))
  .forEach((r) => {
    const sibs = Array.from(r.parentElement?.children ?? []).filter((c) => c.classList.contains('reveal'))
    r.style.setProperty('--d', `${Math.min(sibs.indexOf(r), 6) * 0.07}s`)
    revealIO.observe(r)
  })

Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]).then(() => {
  $$('.reveal', hero).forEach((r, i) => {
    r.style.setProperty('--d', `${i * 0.08}s`)
    r.classList.add('is-in')
  })
  const score = $('.tk-hero [data-count]')
  if (score) {
    score.textContent = '0'
    setTimeout(() => tween(0, Number(score.dataset.count), 1300, (v) => (score.textContent = String(Math.round(v)))), 650)
  }
})

/* ---------------------------------------------------------------- Hero ticket tilt + glare */
const stage = $('#stage')!
const tilt = $('#stageTilt')!
const heroTicket = $('.tk-hero')!
if (finePointer && !reduced) {
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    tilt.style.setProperty('--ry', `${(px * 14).toFixed(2)}deg`)
    tilt.style.setProperty('--rx', `${(-py * 10).toFixed(2)}deg`)
    const tr = heroTicket.getBoundingClientRect()
    heroTicket.style.setProperty('--gx', `${(((e.clientX - tr.left) / tr.width) * 100).toFixed(1)}%`)
    heroTicket.style.setProperty('--gy', `${(((e.clientY - tr.top) / tr.height) * 100).toFixed(1)}%`)
  })
  stage.addEventListener('pointerleave', () => {
    tilt.style.setProperty('--ry', '0deg')
    tilt.style.setProperty('--rx', '0deg')
  })
}

/* ---------------------------------------------------------------- Race */
const race = $('#race')!
const raceDay = $('#raceDay')!
onceVisible(
  race,
  () => {
    race.classList.add('is-run')
    setTimeout(() => {
      if (reduced) return void (raceDay.textContent = '14')
      const start = performance.now()
      const DUR = 3300
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / DUR)
        raceDay.textContent = String(Math.round(p * 14))
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, 150)
  },
  0.45,
)

/* ---------------------------------------------------------------- Audience chart */
const chartHost = $('#chartJourney')!
const drawChart = () => {
  const w = String(chartHost.clientWidth)
  if (chartHost.dataset.w === w) return
  chartHost.dataset.w = w
  renderJourney(chartHost)
}
drawChart()
let resizeTimer = 0
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(drawChart, 150)
})
onceVisible(chartHost, () => requestAnimationFrame(() => chartHost.classList.add('is-drawn')), 0.4)

/* ---------------------------------------------------------------- Film strip parallax */
const strip = $('#strip')!
const stripWrap = $('.strip-wrap')!
if (!reduced) {
  const onStrip = () => {
    if (!wide.matches) return strip.style.setProperty('--sx', '0px')
    const r = stripWrap.getBoundingClientRect()
    const p = (window.innerHeight - r.top) / (window.innerHeight + r.height) // 0 → 1 across the viewport
    if (p < -0.2 || p > 1.2) return
    strip.style.setProperty('--sx', `${((0.5 - p) * 90).toFixed(1)}px`)
  }
  window.addEventListener('scroll', onStrip, { passive: true })
  onStrip()
}

/* ---------------------------------------------------------------- Story rotator */
const storiesEl = $('#stories')!
const stories = $$<HTMLElement>('.story', storiesEl)
const bars = $$<HTMLButtonElement>('.story-bars button', storiesEl)
const STORY_MS = 7500
let current = 0
let elapsed = 0
let last = 0
let paused = false
let rafId = 0

function showStory(i: number) {
  current = (i + stories.length) % stories.length
  elapsed = 0
  stories.forEach((s, k) => s.classList.toggle('is-active', k === current))
  bars.forEach((b, k) => {
    b.setAttribute('aria-selected', String(k === current))
    b.style.setProperty('--p', k < current ? '1' : '0')
  })
  if (reduced) bars[current].style.setProperty('--p', '1')
}
function loop(now: number) {
  if (!last) last = now
  const dt = now - last
  last = now
  if (!paused) {
    elapsed += dt
    bars[current].style.setProperty('--p', String(Math.min(1, elapsed / STORY_MS)))
    if (elapsed >= STORY_MS) showStory(current + 1)
  }
  rafId = requestAnimationFrame(loop)
}
showStory(0)
bars.forEach((b, i) => b.addEventListener('click', () => showStory(i)))
$('#storyPrev')!.addEventListener('click', () => showStory(current - 1))
$('#storyNext')!.addEventListener('click', () => showStory(current + 1))
storiesEl.addEventListener('pointerenter', () => (paused = true))
storiesEl.addEventListener('pointerleave', () => (paused = false))
storiesEl.addEventListener('focusin', () => (paused = true))
storiesEl.addEventListener('focusout', () => (paused = false))
if (!reduced) {
  // Only run while the rotator is on screen
  new IntersectionObserver(([e]) => {
    cancelAnimationFrame(rafId)
    last = 0
    if (e.isIntersecting) rafId = requestAnimationFrame(loop)
  }).observe(storiesEl)
}

/* ---------------------------------------------------------------- Gauges */
const gaugeList = $('#gauges')!
const gauges = $$<HTMLLIElement>('.gauge', gaugeList)
const C = 100
const R = 80
const polar = (r: number, deg: number) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)]
gauges.forEach((g) => {
  const v = Number(g.dataset.v)
  g.style.setProperty('--v', String(v))
  const svg = g.querySelector('svg')!
  const mk = (tag: string, attrs: Record<string, string | number>) => {
    const e = document.createElementNS(SVG_NS, tag)
    for (const [k, val] of Object.entries(attrs)) e.setAttribute(k, String(val))
    return e
  }
  for (let i = 0; i <= 10; i++) {
    const deg = 180 + i * 18
    const major = i % 5 === 0
    const [x1, y1] = polar(major ? 92 : 94, deg)
    const [x2, y2] = polar(major ? 102 : 99, deg)
    svg.appendChild(mk('line', { x1, y1, x2, y2, class: major ? 'g-tick g-tick-major' : 'g-tick' }))
  }
  const arc = `M${C - R},${C} A${R},${R} 0 0 1 ${C + R},${C}`
  svg.appendChild(mk('path', { d: arc, class: 'g-track' }))
  svg.appendChild(mk('path', { d: arc, class: 'g-fill', pathLength: 100 }))
  const needle = mk('g', { class: 'g-needle' })
  needle.appendChild(mk('line', { x1: C, y1: C, x2: C, y2: C - 64 }))
  svg.appendChild(needle)
  svg.appendChild(mk('circle', { cx: C, cy: C, r: 8, class: 'g-hub' }))
  svg.appendChild(mk('circle', { cx: C, cy: C, r: 3.5, class: 'g-hub-in' }))
})
onceVisible(
  gaugeList,
  () => {
    gaugeList.classList.add('is-on')
    gauges.forEach((g, i) => {
      const out = g.querySelector<HTMLElement>('.g-val')!
      const v = Number(g.dataset.v)
      out.textContent = '0'
      setTimeout(() => tween(0, v, 1400, (n) => (out.textContent = String(Math.round(n)))), i * 120)
    })
    const total = $('#scoreTotal')!
    const t = Number(total.textContent)
    total.textContent = '0'
    tween(0, t, 1600, (n) => (total.textContent = String(Math.round(n))))
  },
  0.35,
)

/* ---------------------------------------------------------------- Ticket marquee (seamless loop) */
$$<HTMLUListElement>('.marquee-row').forEach((row) => {
  Array.from(row.children).forEach((li) => {
    const clone = li.cloneNode(true) as HTMLElement
    clone.setAttribute('aria-hidden', 'true')
    row.appendChild(clone)
  })
})

/* ---------------------------------------------------------------- FAQ filter */
const chips = $$<HTMLButtonElement>('.chips button')
const faqs = $$<HTMLDetailsElement>('#faqList details')
chips.forEach((chip) =>
  chip.addEventListener('click', () => {
    const f = chip.dataset.filter
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)))
    let firstShown: HTMLDetailsElement | null = null
    faqs.forEach((d) => {
      const show = f === 'all' || d.dataset.cat === f
      d.hidden = !show
      if (show && !firstShown) firstShown = d
    })
    // Open the first match when filtering to a single topic
    if (f !== 'all' && firstShown) (firstShown as HTMLDetailsElement).open = true
  }),
)
