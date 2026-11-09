/* Audience-journey sample chart for the "Full analysis" tile.
   Illustrative, deterministic data; sized to its container so labels stay legible. */

const NS = 'http://www.w3.org/2000/svg'
const SCENES = 60
type Pt = [number, number]

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function keyed(keys: Pt[], t: number) {
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i]
    const [t1, v1] = keys[i + 1]
    if (t >= t0 && t <= t1) {
      const s = (1 - Math.cos(((t - t0) / (t1 - t0)) * Math.PI)) / 2
      return v0 + (v1 - v0) * s
    }
  }
  return keys[keys.length - 1][1]
}

function series(keys: Pt[], noise: number, seed: number, smooth: number) {
  const rnd = seeded(seed)
  const raw = Array.from({ length: SCENES }, (_, i) => keyed(keys, i / (SCENES - 1)) + (rnd() - 0.5) * 2 * noise)
  const half = Math.floor(smooth / 2)
  return raw.map((_, i) => {
    let sum = 0
    let n = 0
    for (let k = i - half; k <= i + half; k++) {
      if (k >= 0 && k < SCENES) {
        sum += raw[k]
        n++
      }
    }
    return sum / n
  })
}

function smoothPath(pts: Pt[]) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const k = 0.15
    d += ` C${(p1[0] + (p2[0] - p0[0]) * k).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) * k).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * k).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) * k).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  return e
}

const tension = (() => {
  const t = series(
    [
      [0, 0.28],
      [0.14, 0.48],
      [0.26, 0.34],
      [0.4, 0.58],
      [0.5, 0.44],
      [0.62, 0.66],
      [0.74, 0.86],
      [0.84, 0.6],
      [0.94, 0.7],
      [1, 0.44],
    ],
    0.08,
    5,
    3,
  ).map((v) => clamp(v, 0.08, 0.84))
  t[44] = 0.94
  t[43] = Math.max(t[43], 0.8)
  t[45] = Math.max(t[45], 0.78)
  return t
})()
const surprise = series(
  [
    [0, 0.22],
    [0.5, 0.34],
    [1, 0.42],
  ],
  0.23,
  17,
  2,
).map((v) => clamp(v, 0.04, 0.82))

export function renderJourney(host: HTMLElement) {
  const W = Math.round(clamp(host.clientWidth || 600, 280, 720))
  const H = W < 480 ? 230 : 250
  const ticks = W < 480 ? [1, 20, 40, 60] : [1, 10, 20, 30, 40, 50, 60]
  const m = { l: 34, r: 10, t: 24, b: 26 }
  const pw = W - m.l - m.r
  const ph = H - m.t - m.b
  const x = (i: number) => m.l + (i / (SCENES - 1)) * pw
  const y = (v: number) => m.t + (1 - v) * ph

  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    'aria-label': 'Line chart of tension and surprise across 60 scenes of a sample script. Tension peaks at scene 45.',
  })
  const clipId = `clip3-${Math.random().toString(36).slice(2, 7)}`
  const defs = el('defs')
  defs.innerHTML = `
    <linearGradient id="gradTension3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c8102e" stop-opacity=".14"/>
      <stop offset="1" stop-color="#c8102e" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="${clipId}"><rect class="clip-rect" x="${m.l - 4}" y="0" width="${pw + 8}" height="${H}"/></clipPath>`
  svg.appendChild(defs)

  const grid = el('g', { class: 'grid' })
  const axis = el('g', { class: 'axis' })
  ;[0, 0.25, 0.5, 0.75, 1].forEach((v) => {
    grid.appendChild(el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }))
    const t = el('text', { x: m.l - 8, y: y(v) + 3.5, 'text-anchor': 'end' })
    t.textContent = `${Math.round(v * 100)}%`
    axis.appendChild(t)
  })
  ticks.forEach((s) => {
    const t = el('text', { x: x(s - 1), y: H - 6, 'text-anchor': s === 1 ? 'start' : s === 60 ? 'end' : 'middle' })
    t.textContent = s === 1 ? 'Scene 1' : String(s)
    axis.appendChild(t)
  })
  svg.append(grid, axis)

  const pts = (arr: number[]) => arr.map((v, i) => [x(i), y(v)] as Pt)
  const tPath = smoothPath(pts(tension))
  const plot = el('g', { 'clip-path': `url(#${clipId})` })
  plot.appendChild(el('path', { class: 'area', d: `${tPath} L${x(SCENES - 1)},${y(0)} L${x(0)},${y(0)} Z` }))
  plot.appendChild(el('path', { class: 'series s-surprise', d: smoothPath(pts(surprise)) }))
  plot.appendChild(el('path', { class: 'series s-tension', d: tPath }))
  svg.appendChild(plot)

  // Direct label on the one point the story is about
  const peak = el('g', { class: 'peak' })
  const px = x(44)
  const py = y(tension[44])
  peak.appendChild(el('line', { x1: px, x2: px, y1: py - 6, y2: m.t - 8 }))
  peak.appendChild(el('circle', { cx: px, cy: py, r: 4.5 }))
  const flip = px + 140 > W - m.r
  const label = el('text', { x: flip ? px - 6 : px + 6, y: m.t - 10, 'text-anchor': flip ? 'end' : 'start' })
  label.textContent = 'Peak tension · Scene 45'
  peak.appendChild(label)
  svg.appendChild(peak)

  // Hover layer: crosshair + tooltip
  const hLine = el('line', { class: 'hover-line', y1: m.t, y2: m.t + ph })
  const dotT = el('circle', { class: 'hover-dot', r: 4.5, fill: '#c8102e' })
  const dotS = el('circle', { class: 'hover-dot', r: 4.5, fill: '#00877e' })
  const hit = el('rect', { x: m.l, y: 0, width: pw, height: H, fill: 'transparent' })
  svg.append(hLine, dotT, dotS, hit)

  host.innerHTML = ''
  host.appendChild(svg)
  const tip = document.createElement('div')
  tip.className = 'chart-tip'
  host.appendChild(tip)

  const show = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect()
    const vx = ((e.clientX - r.left) / r.width) * W
    const i = clamp(Math.round(((vx - m.l) / pw) * (SCENES - 1)), 0, SCENES - 1)
    const cx = x(i)
    hLine.setAttribute('x1', String(cx))
    hLine.setAttribute('x2', String(cx))
    dotT.setAttribute('cx', String(cx))
    dotT.setAttribute('cy', String(y(tension[i])))
    dotS.setAttribute('cx', String(cx))
    dotS.setAttribute('cy', String(y(surprise[i])))
    const pct = (v: number) => `${Math.round(v * 100)}%`
    tip.innerHTML = `<b>Scene ${i + 1}</b>
      <div><span><i class="lg-red"></i>Tension</span><strong>${pct(tension[i])}</strong></div>
      <div><span><i class="lg-teal"></i>Surprise</span><strong>${pct(surprise[i])}</strong></div>`
    const s = r.width / W
    const tw = tip.offsetWidth
    const left = cx * s + 14 + tw > r.width ? cx * s - 14 - tw : cx * s + 14
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(Math.max(0, y(Math.max(tension[i], surprise[i])) * s - 26))}px)`
    host.classList.add('is-hover')
  }
  hit.addEventListener('pointermove', show)
  hit.addEventListener('pointerdown', show)
  hit.addEventListener('pointerleave', () => host.classList.remove('is-hover'))
}
