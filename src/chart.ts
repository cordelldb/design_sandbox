// Hero chart: an animated candlestick chart that plays out a five-wave advance,
// a three-wave correction into the golden zone, then continues ticking live.

export type Bar = { o: number; h: number; l: number; c: number; v: number; t: number }

export interface HeroChartOptions {
  canvas: HTMLCanvasElement
  onPrice?: (price: number, prev: number) => void
  onHover?: (bar: Bar | null) => void
}

const COLORS = {
  up: '#22C3A0',
  down: '#F0604D',
  gold: '#E9B55C',
  blue: '#7AA7FF',
  ink: '#ECEFF4',
  ink2: '#A3ABB8',
  ink3: '#6B7380',
  grid: 'rgba(255,255,255,0.045)',
  axis: 'rgba(255,255,255,0.08)',
  bg: '#0B0E13',
}

const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]

// Seeded RNG so the composition is identical on every load.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Structural pivots in abstract price units: origin, 1, 2, 3, 4, 5, A, B, C
const PIVOTS: Array<[number, number, string]> = [
  [0, 100, ''],
  [18, 118, '1'],
  [29, 107.2, '2'],
  [58, 145, '3'],
  [71, 131.5, '4'],
  [92, 152, '5'],
  [105, 137.5, 'A'],
  [113, 144.2, 'B'],
  [128, 122.4, 'C'],
]

const toFx = (p: number) => 1.07 + (p - 100) * 0.0011
const START = Date.UTC(2026, 9, 5, 0, 0) // hourly bars
const HOUR = 3_600_000

function generate(): Bar[] {
  const rnd = mulberry32(1618)
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.15
  const bars: Bar[] = []
  let prevClose = PIVOTS[0][1]
  for (let s = 0; s < PIVOTS.length - 1; s++) {
    const [i0, p0] = PIVOTS[s]
    const [i1, p1] = PIVOTS[s + 1]
    const up = p1 > p0
    const len = i1 - i0
    for (let i = i0 + (s === 0 ? 0 : 1); i <= i1; i++) {
      const t = (i - i0) / len
      const ease = t * t * (3 - 2 * t) * 0.35 + t * 0.65
      const wiggle = Math.sin(i * 0.9 + s) * 1.1 * Math.sin(Math.PI * t)
      let c = p0 + (p1 - p0) * ease + wiggle + gauss() * 0.9
      const o = prevClose
      if (i === i1) c = p1 + (up ? -0.9 : 0.9) * rnd()
      let h = Math.max(o, c) + rnd() * 0.9
      let l = Math.min(o, c) - rnd() * 0.9
      if (i === i1) {
        if (up) h = p1
        else l = p1
      }
      const body = Math.abs(c - o)
      const v = 0.35 + body * 0.35 + rnd() * 0.5 + (Math.abs(p1 - p0) / len) * 0.3
      bars.push({ o, h, l, c, v, t: START + i * HOUR })
      prevClose = c
    }
  }
  return bars
}

function ema(values: number[], period: number) {
  const k = 2 / (period + 1)
  const out: number[] = []
  let prev = values[0]
  values.forEach((v, i) => {
    prev = i === 0 ? v : v * k + prev * (1 - k)
    out.push(prev)
  })
  return out
}

const fmt = (p: number) => toFx(p).toFixed(5)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function createHeroChart({ canvas, onPrice, onHover }: HeroChartOptions) {
  const ctx = canvas.getContext('2d')!
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const bars = generate()
  const BASE_N = bars.length
  const SLOTS = BASE_N + 16 // reserve room on the right for live bars
  const rnd = mulberry32(89)

  const swingLow = PIVOTS[0][1]
  const swingHigh = PIVOTS[5][1]
  const fibPrice = (r: number) => swingHigh - (swingHigh - swingLow) * r
  const yMin = swingLow - 4
  const yMax = swingHigh + 5

  let W = 0
  let H = 0
  let dpr = 1
  let revealed = reduced ? BASE_N : 0
  let fibAlpha = reduced ? 1 : 0
  let hoverIdx: number | null = null
  let hoverY: number | null = null
  let started = false
  let lastFrame = 0
  let emaLine = ema(
    bars.map((b) => b.c),
    21,
  )

  const pad = { t: 40, r: 74, b: 26, l: 0 }

  function resize() {
    const rect = canvas.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    W = rect.width
    H = rect.height
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    draw()
  }

  const plotW = () => W - pad.l - pad.r
  const plotH = () => H - pad.t - pad.b
  const step = () => plotW() / SLOTS
  const xAt = (i: number) => pad.l + step() * (i + 0.5)
  const yAt = (p: number) => pad.t + (1 - (p - yMin) / (yMax - yMin)) * plotH()
  const pAt = (y: number) => yMin + (1 - (y - pad.t) / plotH()) * (yMax - yMin)

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  function axisTag(y: number, text: string, bg: string, fg: string) {
    ctx.font = '500 11px "Geist Mono", ui-monospace, monospace'
    const x = W - pad.r + 6
    const w = pad.r - 12
    roundRect(x, y - 10, w, 20, 5)
    ctx.fillStyle = bg
    ctx.fill()
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x + w / 2, y + 0.5)
  }

  function draw() {
    if (!W || !H) return
    ctx.clearRect(0, 0, W, H)
    const n = Math.min(Math.floor(revealed), bars.length)
    const sw = step()
    const bodyW = Math.max(1, Math.min(9, sw * 0.62))

    // grid + price axis labels
    ctx.font = '400 10.5px "Geist Mono", ui-monospace, monospace'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const rows = H < 360 ? 4 : 6
    for (let r = 0; r <= rows; r++) {
      const y = pad.t + (plotH() / rows) * r
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(pad.l, Math.round(y) + 0.5)
      ctx.lineTo(W - pad.r, Math.round(y) + 0.5)
      ctx.stroke()
      ctx.fillStyle = COLORS.ink3
      ctx.fillText(fmt(pAt(y)), W - pad.r + 10, y)
    }
    // axis border
    ctx.strokeStyle = COLORS.axis
    ctx.beginPath()
    ctx.moveTo(W - pad.r + 0.5, pad.t - 10)
    ctx.lineTo(W - pad.r + 0.5, H - pad.b)
    ctx.lineTo(0, H - pad.b + 0.5)
    ctx.stroke()

    // time labels (daily)
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.ink3
    const every = sw * 24 < 60 ? 48 : 24
    for (let i = 0; i < SLOTS; i += every) {
      const d = new Date(START + i * HOUR)
      ctx.fillText(`${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`, xAt(i), H - pad.b / 2 + 1)
    }

    // Fibonacci retracement (anchored origin -> wave 5)
    if (fibAlpha > 0) {
      ctx.save()
      ctx.globalAlpha = fibAlpha
      const x0 = xAt(PIVOTS[0][0])
      const x1 = W - pad.r
      // golden zone
      const gzTop = yAt(fibPrice(0.5))
      const gzBot = yAt(fibPrice(0.618))
      const grad = ctx.createLinearGradient(x0, 0, x1, 0)
      grad.addColorStop(0, 'rgba(233,181,92,0.015)')
      grad.addColorStop(1, 'rgba(233,181,92,0.09)')
      ctx.fillStyle = grad
      ctx.fillRect(x0, gzTop, x1 - x0, gzBot - gzTop)

      ctx.font = '400 10px "Geist Mono", ui-monospace, monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      FIB.forEach((r) => {
        const y = Math.round(yAt(fibPrice(r))) + 0.5
        const golden = r === 0.618
        ctx.strokeStyle = golden ? 'rgba(233,181,92,0.85)' : 'rgba(255,255,255,0.16)'
        ctx.setLineDash(golden ? [] : [3, 4])
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x0, y)
        ctx.lineTo(x1, y)
        ctx.stroke()
        ctx.fillStyle = golden ? COLORS.gold : COLORS.ink3
        ctx.fillText(`${r === 0 || r === 1 ? r.toFixed(0) : r.toFixed(3).replace(/^0/, '')}  ${fmt(fibPrice(r))}`, x0 + 6, y - 3)
      })
      ctx.setLineDash([])
      // anchor trend line
      ctx.strokeStyle = 'rgba(233,181,92,0.35)'
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(xAt(PIVOTS[0][0]), yAt(swingLow))
      ctx.lineTo(xAt(PIVOTS[5][0]), yAt(swingHigh))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }

    // volume
    const volMax = 2.2
    const volH = plotH() * 0.14
    for (let i = 0; i < n; i++) {
      const b = bars[i]
      const h = Math.min(1, b.v / volMax) * volH
      ctx.fillStyle = b.c >= b.o ? 'rgba(34,195,160,0.16)' : 'rgba(240,96,77,0.16)'
      ctx.fillRect(xAt(i) - bodyW / 2, H - pad.b - h, bodyW, h)
    }

    // EMA
    if (n > 1) {
      ctx.strokeStyle = COLORS.blue
      ctx.globalAlpha = 0.75
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const x = xAt(i)
        const y = yAt(emaLine[i])
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // candles
    for (let i = 0; i < n; i++) {
      const b = bars[i]
      const up = b.c >= b.o
      const x = Math.round(xAt(i)) + 0.5
      ctx.strokeStyle = ctx.fillStyle = up ? COLORS.up : COLORS.down
      ctx.globalAlpha = hoverIdx !== null && hoverIdx !== i ? 0.85 : 1
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, yAt(b.h))
      ctx.lineTo(x, yAt(b.l))
      ctx.stroke()
      const yTop = yAt(Math.max(b.o, b.c))
      const yBot = yAt(Math.min(b.o, b.c))
      ctx.fillRect(x - bodyW / 2, yTop, bodyW, Math.max(1, yBot - yTop))
    }
    ctx.globalAlpha = 1

    // wave labels
    ctx.font = '500 10.5px "Geist Mono", ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    PIVOTS.forEach(([idx, price, label], k) => {
      if (!label || idx >= n) return
      const prevP = PIVOTS[k - 1][1]
      const peak = price > prevP
      const x = xAt(idx)
      const y = yAt(price) + (peak ? -16 : 16)
      const corrective = /[ABC]/.test(label)
      ctx.beginPath()
      ctx.arc(x, y, 9, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.bg
      ctx.fill()
      ctx.strokeStyle = corrective ? 'rgba(255,255,255,0.18)' : 'rgba(233,181,92,0.55)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = corrective ? COLORS.ink2 : COLORS.gold
      ctx.fillText(label, x, y + 0.5)
    })

    // last price line
    if (n > 0) {
      const last = bars[n - 1]
      const up = last.c >= last.o
      const y = Math.round(yAt(last.c)) + 0.5
      ctx.strokeStyle = up ? COLORS.up : COLORS.down
      ctx.globalAlpha = 0.6
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(xAt(n - 1), y)
      ctx.lineTo(W - pad.r, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      axisTag(y, fmt(last.c), up ? COLORS.up : COLORS.down, up ? '#04140F' : '#1D0703')
    }

    // crosshair
    if (hoverIdx !== null && hoverY !== null) {
      const x = Math.round(xAt(hoverIdx)) + 0.5
      const y = Math.round(hoverY) + 0.5
      ctx.strokeStyle = 'rgba(255,255,255,0.32)'
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, pad.t - 10)
      ctx.lineTo(x, H - pad.b)
      ctx.moveTo(0, y)
      ctx.lineTo(W - pad.r, y)
      ctx.stroke()
      ctx.setLineDash([])
      axisTag(y, fmt(pAt(hoverY)), '#2A303B', COLORS.ink)
      // time tag
      const d = new Date(bars[hoverIdx].t)
      const label = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:00`
      ctx.font = '500 10.5px "Geist Mono", ui-monospace, monospace'
      const tw = ctx.measureText(label).width + 14
      const tx = Math.max(2, Math.min(W - pad.r - tw - 2, x - tw / 2))
      roundRect(tx, H - pad.b + 3, tw, 19, 5)
      ctx.fillStyle = '#2A303B'
      ctx.fill()
      ctx.fillStyle = COLORS.ink
      ctx.textAlign = 'center'
      ctx.fillText(label, tx + tw / 2, H - pad.b + 13)
    }
  }

  // --- animation -----------------------------------------------------------
  const REVEAL_MS = 3400
  let revealStart = 0
  function frame(now: number) {
    if (!revealStart) revealStart = now
    const t = Math.min(1, (now - revealStart) / REVEAL_MS)
    const eased = 1 - Math.pow(1 - t, 2.2)
    revealed = eased * BASE_N
    if (revealed > PIVOTS[5][0] + 2) fibAlpha = Math.min(1, fibAlpha + 0.035)
    draw()
    emitLast()
    if (t < 1 || fibAlpha < 1) requestAnimationFrame(frame)
    else startLive()
    lastFrame = now
  }

  let lastEmitted = bars[0].c
  function emitLast() {
    const n = Math.min(Math.floor(revealed), bars.length)
    if (n < 1) return
    const c = bars[n - 1].c
    if (c !== lastEmitted) {
      onPrice?.(toFx(c), toFx(lastEmitted))
      lastEmitted = c
    }
    if (hoverIdx === null) onHover?.(bars[n - 1])
  }

  let tickCount = 0
  function startLive() {
    revealed = bars.length
    if (reduced) return
    window.setInterval(() => {
      if (document.hidden) return
      const last = bars[bars.length - 1]
      tickCount++
      // a new bar every ~10 ticks while slots remain, with gentle upward drift
      if (tickCount % 10 === 0 && bars.length < SLOTS - 2) {
        const o = last.c
        bars.push({ o, h: o, l: o, c: o, v: 0.3, t: last.t + HOUR })
      } else {
        const cur = bars[bars.length - 1]
        const drift = cur.c < fibPrice(0.382) ? 0.06 : -0.02
        cur.c = Math.max(fibPrice(0.786), Math.min(fibPrice(0.236), cur.c + (rnd() - 0.47) * 0.55 + drift))
        cur.h = Math.max(cur.h, cur.c)
        cur.l = Math.min(cur.l, cur.c)
        cur.v += rnd() * 0.12
      }
      emaLine = ema(
        bars.map((b) => b.c),
        21,
      )
      revealed = bars.length
      draw()
      emitLast()
    }, 650)
  }

  function start() {
    if (started) return
    started = true
    if (reduced) {
      draw()
      emitLast()
      return
    }
    requestAnimationFrame(frame)
  }

  // --- interaction ---------------------------------------------------------
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const n = Math.min(Math.floor(revealed), bars.length)
    if (x > W - pad.r || y < pad.t - 10 || y > H - pad.b || n === 0) {
      hoverIdx = hoverY = null
    } else {
      hoverIdx = Math.max(0, Math.min(n - 1, Math.floor((x - pad.l) / step())))
      hoverY = y
    }
    onHover?.(hoverIdx !== null ? bars[hoverIdx] : bars[n - 1])
    draw()
  })
  canvas.addEventListener('pointerleave', () => {
    hoverIdx = hoverY = null
    const n = Math.min(Math.floor(revealed), bars.length)
    if (n) onHover?.(bars[n - 1])
    draw()
  })

  new ResizeObserver(resize).observe(canvas)
  document.fonts?.ready.then(draw)
  void lastFrame

  return {
    start,
    format: (p: number) => p.toFixed(5),
    levels: {
      fib618: toFx(fibPrice(0.618)),
      fib786: toFx(fibPrice(0.786)),
      high: toFx(swingHigh),
      toFx,
    },
  }
}
