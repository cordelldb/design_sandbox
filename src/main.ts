import './style.css'
import { createHeroChart, type Bar } from './chart.ts'

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel))
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const SVG_NS = 'http://www.w3.org/2000/svg'

function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------------------------------------------------------------- Nav */
const nav = $('#nav')!
const toggle = $<HTMLButtonElement>('#navToggle')!
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8)
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open')
  toggle.setAttribute('aria-expanded', String(open))
})
$$('#navMobile a').forEach((a) =>
  a.addEventListener('click', () => {
    nav.classList.remove('is-open')
    toggle.setAttribute('aria-expanded', 'false')
  }),
)

/* ---------------------------------------------------------------- Reveal */
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in')
        io.unobserve(e.target)
      }
    })
  },
  { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
)
$$('.reveal').forEach((el) => io.observe(el))

/* ---------------------------------------------------------------- Hero chart + ticket */
const ticket = $('.ticket')!
const bidEl = $('#tkBid')!
const askEl = $('#tkAsk')!
const goBtn = $<HTMLButtonElement>('#tkGo')!
let side: 'buy' | 'sell' = 'buy'

const chart = createHeroChart({
  canvas: $<HTMLCanvasElement>('#heroChart')!,
  onPrice(price, prev) {
    const spread = 0.00006
    bidEl.textContent = price.toFixed(5)
    askEl.textContent = (price + spread).toFixed(5)
    const cls = price >= prev ? 'flash-up' : 'flash-down'
    for (const el of [bidEl, askEl]) {
      el.classList.remove('flash-up', 'flash-down')
      el.classList.add(cls)
    }
    window.clearTimeout((bidEl as any)._t)
    ;(bidEl as any)._t = window.setTimeout(() => {
      bidEl.classList.remove('flash-up', 'flash-down')
      askEl.classList.remove('flash-up', 'flash-down')
    }, 450)
  },
  onHover(bar: Bar | null) {
    if (!bar) return
    const f = (p: number) => chart.levels.toFx(p).toFixed(5)
    $('#lgO')!.textContent = f(bar.o)
    $('#lgH')!.textContent = f(bar.h)
    $('#lgL')!.textContent = f(bar.l)
    const c = $('#lgC')!
    c.textContent = f(bar.c)
    c.className = bar.c >= bar.o ? 'up' : 'down'
  },
})

const L = chart.levels
const setTicket = () => {
  const buy = side === 'buy'
  $('#tkLimit')!.textContent = (buy ? L.fib618 : L.toFx(140)).toFixed(5)
  const tp = $('.field-row .field:first-child span')!
  const sl = $('.field-row .field:last-child span')!
  tp.textContent = (buy ? L.high + 0.0042 : L.fib786 - 0.0021).toFixed(5)
  sl.textContent = (buy ? L.fib786 - 0.0018 : L.high + 0.0018).toFixed(5)
  goBtn.textContent = `${buy ? 'Buy' : 'Sell'} 100,000 EUR/USD`
  ticket.classList.toggle('is-sell', !buy)
}
setTicket()

$$<HTMLButtonElement>('.ticket__side button').forEach((b) =>
  b.addEventListener('click', () => {
    side = b.dataset.side as 'buy' | 'sell'
    $$('.ticket__side button').forEach((x) => x.classList.toggle('is-on', x === b))
    setTicket()
  }),
)
goBtn.addEventListener('click', () => {
  goBtn.textContent = 'Routed to Meridian FX · 18 ms ✓'
  goBtn.disabled = true
  window.setTimeout(() => {
    goBtn.disabled = false
    setTicket()
  }, 1800)
})

const chartIO = new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) {
    window.setTimeout(() => chart.start(), reduced ? 0 : 500)
    chartIO.disconnect()
  }
})
chartIO.observe($('#heroChart')!)

/* ---------------------------------------------------------------- Ticker */
type Quote = { s: string; p: number; d: number; dp: number }
const quotes: Quote[] = [
  { s: 'EUR/USD', p: 1.09862, d: 5 },
  { s: 'GBP/USD', p: 1.29418, d: 5 },
  { s: 'USD/JPY', p: 151.284, d: 3 },
  { s: 'AUD/USD', p: 0.66172, d: 5 },
  { s: 'USD/CHF', p: 0.87731, d: 5 },
  { s: 'US500', p: 6184.25, d: 2 },
  { s: 'NAS100', p: 22041.5, d: 1 },
  { s: 'XAU/USD', p: 2741.38, d: 2 },
  { s: 'WTI', p: 71.84, d: 2 },
  { s: 'GER40', p: 21388.0, d: 1 },
  { s: 'UST10Y', p: 4.182, d: 3 },
  { s: 'BTC/USD', p: 89144, d: 0 },
].map((q, i) => ({ ...q, dp: [0.42, -0.18, 0.31, 0.62, -0.09, 0.84, 1.13, 0.27, -0.71, 0.38, -0.05, 2.16][i] }))

const track = $('#tickerTrack')!
const renderTicker = () => {
  const html = quotes
    .map(
      (q) =>
        `<span class="ticker__item"><b>${q.s}</b>${q.p.toLocaleString('en-US', {
          minimumFractionDigits: q.d,
          maximumFractionDigits: q.d,
        })}<span class="chg ${q.dp < 0 ? 'down' : 'up'}">${q.dp > 0 ? '+' : ''}${q.dp.toFixed(2)}%</span></span>`,
    )
    .join('')
  track.innerHTML = html + html
}
renderTicker()
if (!reduced) {
  const r = seeded(21)
  window.setInterval(() => {
    if (document.hidden) return
    quotes.forEach((q) => {
      const m = (r() - 0.5) * 0.0006
      q.p *= 1 + m
      q.dp += m * 100
    })
    renderTicker()
  }, 2600)
}

/* ---------------------------------------------------------------- Brokers (illustrative names) */
const glyphs = [
  '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="10" r="2.6" fill="currentColor"/></svg>',
  '<svg viewBox="0 0 20 20"><path d="M3 16L10 3l7 13z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="6" height="6" rx="1.2" fill="currentColor"/><rect x="11" y="11" width="6" height="6" rx="1.2" fill="currentColor"/><rect x="11" y="3" width="6" height="6" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  '<svg viewBox="0 0 20 20"><path d="M2 14c3-8 5-8 8 0s5 8 8 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 20 20"><path d="M10 2l8 8-8 8-8-8z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 6l4 4-4 4-4-4z" fill="currentColor"/></svg>',
  '<svg viewBox="0 0 20 20"><path d="M4 16V8M8 16V4M12 16v-6M16 16V6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
]
const brokers: Array<[string, string]> = [
  ['Meridian FX', 'wm-sans'],
  ['Northgate Securities', 'wm-serif'],
  ['HALCYON', 'wm-mono'],
  ['bluewater', 'wm-light'],
  ['Kestrel Prime', 'wm-sans'],
  ['Arbor & Finch', 'wm-serif'],
  ['TESSELLATE', 'wm-mono'],
  ['lumen securities', 'wm-light'],
  ['Pinnacle Clearing', 'wm-sans'],
  ['Ostrava Capital', 'wm-serif'],
  ['CORVID MARKETS', 'wm-mono'],
  ['atlas funds', 'wm-light'],
]
const wm = (i: number) =>
  `<span class="wordmark ${brokers[i][1]}">${glyphs[i % glyphs.length]}${brokers[i][0]}</span>`
const row1 = [0, 1, 2, 3, 4, 5].map(wm).join('')
const row2 = [6, 7, 8, 9, 10, 11].map(wm).join('')
$('#brokerRow1')!.innerHTML = row1 + row1 + row1 + row1
$('#brokerRow2')!.innerHTML = row2 + row2 + row2 + row2

/* ---------------------------------------------------------------- Stat counters */
const countIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return
    const el = e.target as HTMLElement
    const target = Number(el.dataset.count)
    countIO.unobserve(el)
    if (reduced) {
      el.textContent = String(target)
      return
    }
    const t0 = performance.now()
    const dur = 1600
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur)
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
})
$$('[data-count]').forEach((el) => countIO.observe(el))

/* ---------------------------------------------------------------- Feature card: multi-pane chart */
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  return el
}
;(function buildPanes() {
  const svg = $<SVGSVGElement>('#vizPanes')!
  const r = seeded(55)
  const N = 64
  const top = { y0: 26, y1: 186 }
  const bot = { y0: 214, y1: 286 }
  const closes: number[] = []
  let p = 50
  const bars: Array<{ o: number; c: number; h: number; l: number }> = []
  for (let i = 0; i < N; i++) {
    const o = p
    p += Math.sin(i / 7) * 1.6 + (r() - 0.45) * 3.2
    const c = p
    bars.push({ o, c, h: Math.max(o, c) + r() * 1.8, l: Math.min(o, c) - r() * 1.8 })
    closes.push(c)
  }
  const lo = Math.min(...bars.map((b) => b.l))
  const hi = Math.max(...bars.map((b) => b.h))
  const sx = (i: number) => 16 + (i + 0.5) * ((520 - 32) / N)
  const sy = (v: number) => top.y1 - ((v - lo) / (hi - lo)) * (top.y1 - top.y0)
  const bw = ((520 - 32) / N) * 0.56

  // grid
  for (let k = 0; k <= 4; k++) {
    const y = top.y0 + ((top.y1 - top.y0) / 4) * k
    svg.append(svgEl('line', { x1: 0, x2: 520, y1: y, y2: y, stroke: 'rgba(255,255,255,0.04)' }))
  }
  svg.append(svgEl('line', { x1: 0, x2: 520, y1: 200, y2: 200, stroke: 'rgba(255,255,255,0.09)' }))

  const label = (x: number, y: number, t: string, fill = '#6B7380') => {
    const el = svgEl('text', { x, y, fill, 'font-family': 'Geist Mono, monospace', 'font-size': 10 })
    el.textContent = t
    svg.append(el)
  }
  label(16, 16, 'GBP/USD · 4H')
  label(16, 228, 'RSI 14')

  const g = svgEl('g', {})
  bars.forEach((b, i) => {
    const up = b.c >= b.o
    const col = up ? '#22C3A0' : '#F0604D'
    const x = sx(i)
    const wick = svgEl('line', { x1: x, x2: x, y1: sy(b.h), y2: sy(b.l), stroke: col, 'stroke-width': 1 })
    const body = svgEl('rect', {
      x: x - bw / 2,
      y: sy(Math.max(b.o, b.c)),
      width: bw,
      height: Math.max(1, Math.abs(sy(b.o) - sy(b.c))),
      fill: col,
      rx: 0.8,
    })
    wick.style.cssText = body.style.cssText = `opacity:0;transition:opacity .4s ${i * 18}ms`
    g.append(wick, body)
  })
  svg.append(g)

  // EMA
  let e = closes[0]
  const k = 2 / 14
  const pts = closes.map((c, i) => {
    e = i ? c * k + e * (1 - k) : c
    return `${sx(i).toFixed(1)},${sy(e).toFixed(1)}`
  })
  svg.append(svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: '#7AA7FF', 'stroke-width': 1.5, opacity: 0.75 }))

  // RSI
  const rsi: number[] = []
  let ag = 0,
    al = 0
  closes.forEach((c, i) => {
    if (!i) return rsi.push(50)
    const d = c - closes[i - 1]
    ag = (ag * 13 + Math.max(d, 0)) / 14
    al = (al * 13 + Math.max(-d, 0)) / 14
    rsi.push(al === 0 ? 70 : 100 - 100 / (1 + ag / al))
  })
  const ry = (v: number) => bot.y1 - (v / 100) * (bot.y1 - bot.y0)
  svg.append(
    svgEl('rect', { x: 0, y: ry(70), width: 520, height: ry(30) - ry(70), fill: 'rgba(233,181,92,0.05)' }),
    svgEl('line', { x1: 0, x2: 520, y1: ry(70), y2: ry(70), stroke: 'rgba(233,181,92,0.3)', 'stroke-dasharray': '3 4' }),
    svgEl('line', { x1: 0, x2: 520, y1: ry(30), y2: ry(30), stroke: 'rgba(233,181,92,0.3)', 'stroke-dasharray': '3 4' }),
    svgEl('polyline', {
      points: rsi.map((v, i) => `${sx(i).toFixed(1)},${ry(v).toFixed(1)}`).join(' '),
      fill: 'none',
      stroke: '#E9B55C',
      'stroke-width': 1.5,
      'stroke-linejoin': 'round',
    }),
  )

  // synced crosshair
  const xh = svgEl('line', { x1: sx(44), x2: sx(44), y1: 0, y2: 300, stroke: 'rgba(255,255,255,0.28)', 'stroke-dasharray': '3 3' })
  svg.append(xh)
  const panesIO = new IntersectionObserver((en) => {
    if (!en[0].isIntersecting) return
    panesIO.disconnect()
    $$<SVGElement>('#vizPanes g > *').forEach((el) => (el.style.opacity = '1'))
  })
  panesIO.observe(svg)

  svg.addEventListener('pointermove', (ev) => {
    const rect = svg.getBoundingClientRect()
    const x = ((ev.clientX - rect.left) / rect.width) * 520
    const i = Math.max(0, Math.min(N - 1, Math.round((x - 16) / ((520 - 32) / N) - 0.5)))
    xh.setAttribute('x1', String(sx(i)))
    xh.setAttribute('x2', String(sx(i)))
  })
})()

/* ---------------------------------------------------------------- Card spotlight */
$$('.card').forEach((card) =>
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect()
    card.style.setProperty('--mx', `${e.clientX - r.left}px`)
    card.style.setProperty('--my', `${e.clientY - r.top}px`)
  }),
)

/* ---------------------------------------------------------------- Router diagram */
;(function buildRouter() {
  const nodes: Array<[string, string, number]> = [
    ['Meridian FX', 'Forex', 18],
    ['Northgate', 'Equities', 23],
    ['Halcyon', 'Futures', 14],
    ['Atlas Funds', 'Mutual funds', 41],
    ['Kestrel Prime', 'ETFs · Options', 21],
    ['Bluewater', 'Bonds', 34],
  ]
  const links = $('#routerLinks')!
  const host = $('#routerNodes')!
  nodes.forEach(([name, market, ms], i) => {
    const a = (-90 + i * 60) * (Math.PI / 180)
    const R = 190
    const x = 240 + Math.cos(a) * R
    const y = 240 + Math.sin(a) * R
    // gently curved link from core to node
    const mx = 240 + Math.cos(a + 0.35) * R * 0.5
    const my = 240 + Math.sin(a + 0.35) * R * 0.5
    const d = `M240 240 Q${mx.toFixed(1)} ${my.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
    links.append(svgEl('path', { d, class: 'router__link' }))
    const pulse = svgEl('path', { d, class: 'router__pulse', pathLength: 1 })
    pulse.style.setProperty('--delay', `${(i * 0.53) % 2.4}s`)
    pulse.style.setProperty('--dur', `${2.2 + (i % 3) * 0.4}s`)
    links.append(pulse)
    const node = document.createElement('div')
    node.className = 'router__node'
    node.style.left = `${(x / 480) * 100}%`
    node.style.top = `${(y / 480) * 100}%`
    node.innerHTML = `<strong>${name}</strong><span>${market} · <b>${ms}ms</b></span>`
    host.append(node)
  })
})()

/* ---------------------------------------------------------------- Markets */
;(function buildMarkets() {
  const markets: Array<[string, string, string, number]> = [
    ['Forex', '70+ pairs', 'Majors, minors and exotics, priced to the fifth decimal.', 0.42],
    ['Stocks', '18,000+', 'US and global equities with full pre and post-market sessions.', 1.18],
    ['ETFs', '3,400+', 'Index, sector, thematic and leveraged funds.', 0.64],
    ['Mutual funds', '9,000+', 'Chart NAV history and place orders through your broker.', 0.21],
    ['Futures', '400+', 'Indices, energy, metals, ags and rates, continuous or by contract.', -0.37],
    ['Options', 'Full chains', 'Greeks, IV surface and multi-leg tickets on any underlying.', 0.93],
    ['Bonds', 'Treasuries & corp', 'Yield curves, spreads and ladder planning.', -0.12],
    ['+ 6 more', 'Indices · CFDs · Metals', 'Plus commodities, crypto and rates where your broker supports them.', 0.58],
  ]
  const grid = $('#marketsGrid')!
  markets.forEach(([name, count, desc, chg], i) => {
    const r = seeded(13 + i * 8)
    const pts: number[] = []
    let v = 0
    for (let k = 0; k < 34; k++) {
      v += (r() - 0.5) * 2 + chg * 0.18
      pts.push(v)
    }
    const lo = Math.min(...pts)
    const hi = Math.max(...pts)
    const xy = pts.map((p, k) => [(k / (pts.length - 1)) * 100, 40 - ((p - lo) / (hi - lo || 1)) * 36])
    const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const col = chg >= 0 ? '#22C3A0' : '#F0604D'
    const el = document.createElement('article')
    el.className = 'market reveal'
    el.style.setProperty('--d', `${(i % 4) * 60}ms`)
    el.innerHTML = `
      <div class="market__top"><h3>${name}</h3><span class="market__count">${count}</span></div>
      <p>${desc}</p>
      <svg viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="mg${i}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
        <polygon class="market__area" fill="url(#mg${i})" points="0,44 ${line} 100,44"/>
        <polyline class="market__line" stroke="${col}" points="${line}" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="market__sym"><span>1M</span><b class="${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '+' : '−'}${Math.abs(chg * 4.2).toFixed(2)}%</b></div>`
    grid.append(el)
    io.observe(el)
  })
})()

/* ---------------------------------------------------------------- Pricing toggle */
$$<HTMLButtonElement>('.billing button').forEach((btn) =>
  btn.addEventListener('click', () => {
    const mode = btn.dataset.billing as 'monthly' | 'annual'
    $$('.billing button').forEach((b) => b.classList.toggle('is-on', b === btn))
    $$('.plan__amt[data-monthly]').forEach((el) => {
      const to = Number(el.dataset[mode])
      const from = Number(el.textContent)
      if (reduced) return void (el.textContent = String(to))
      const t0 = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / 500)
        el.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3))))
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    $$('[data-note]').forEach((el) => {
      el.textContent = mode === 'annual' ? 'Billed annually' : 'Billed monthly'
    })
  }),
)

/* ---------------------------------------------------------------- Spiral draw on scroll */
const spiral = $<SVGSVGElement>('#spiral')!
const manifesto = $('.manifesto')!
const drawSpiral = () => {
  const r = manifesto.getBoundingClientRect()
  const vh = window.innerHeight
  const prog = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height * 0.4)))
  spiral.style.setProperty('--draw', String(reduced ? 0 : 1 - prog))
}
window.addEventListener('scroll', drawSpiral, { passive: true })
drawSpiral()

/* ---------------------------------------------------------------- CTA waves */
;(function ctaWaves() {
  const canvas = $<HTMLCanvasElement>('#ctaWave')!
  const ctx = canvas.getContext('2d')!
  let w = 0,
    h = 0,
    visible = false,
    raf = 0
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const r = canvas.getBoundingClientRect()
    w = r.width
    h = r.height
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paint(0)
  }
  // Each layer: a damped impulse/correction shape travelling slowly
  const paint = (t: number) => {
    ctx.clearRect(0, 0, w, h)
    for (let layer = 0; layer < 5; layer++) {
      ctx.beginPath()
      const amp = h * (0.06 + layer * 0.025)
      const base = h * (0.62 + layer * 0.06)
      for (let x = 0; x <= w; x += 4) {
        const u = x / w
        const y =
          base -
          Math.sin(u * Math.PI * 2.618 + t * 0.00025 * (1 + layer * 0.2) + layer) * amp -
          Math.sin(u * Math.PI * 6.854 + t * 0.0004 + layer * 1.6) * amp * 0.382
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `rgba(233,181,92,${0.22 - layer * 0.035})`
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
  const loop = (t: number) => {
    paint(t)
    if (visible) raf = requestAnimationFrame(loop)
  }
  new ResizeObserver(resize).observe(canvas)
  if (reduced) return
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    cancelAnimationFrame(raf)
    if (visible) raf = requestAnimationFrame(loop)
  }).observe(canvas)
})()
