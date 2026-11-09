/* Sample-report charts for the "Full analysis" demo.
   Data is illustrative and generated deterministically so the page renders the same every load. */

const NS = 'http://www.w3.org/2000/svg'
const SCENES = 60

type Pt = [number, number]

function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Cosine-interpolate between [t, value] keyframes. */
function keyed(keys: Pt[], t: number) {
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i]
    const [t1, v1] = keys[i + 1]
    if (t >= t0 && t <= t1) {
      const u = (t - t0) / (t1 - t0)
      const s = (1 - Math.cos(u * Math.PI)) / 2
      return v0 + (v1 - v0) * s
    }
  }
  return keys[keys.length - 1][1]
}

function makeSeries(keys: Pt[], noise: number, seed: number, smooth = 1) {
  const rnd = seeded(seed)
  const raw = Array.from({ length: SCENES }, (_, i) => keyed(keys, i / (SCENES - 1)) + (rnd() - 0.5) * 2 * noise)
  if (smooth <= 1) return raw
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

/** Catmull-Rom spline through points → cubic Bézier path. */
function smoothPath(pts: Pt[], tension = 0.5) {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension * 2
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension * 2
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension * 2
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension * 2
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const el = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  return el
}

/** Shared tooltip + pointer plumbing. Returns a positioner. */
function attachTip(host: HTMLElement, svg: SVGSVGElement, W: number) {
  const tip = document.createElement('div')
  tip.className = 'chart-tip'
  tip.setAttribute('role', 'presentation')
  host.appendChild(tip)
  return {
    tip,
    /** Convert a pointer event to viewBox x. */
    toX(e: PointerEvent) {
      const r = svg.getBoundingClientRect()
      return ((e.clientX - r.left) / r.width) * W
    },
    place(vbX: number, vbY: number, html: string) {
      tip.innerHTML = html
      const r = svg.getBoundingClientRect()
      const s = r.width / W
      const px = vbX * s
      const py = vbY * s
      const tw = tip.offsetWidth
      const left = px + 14 + tw > r.width ? px - 14 - tw : px + 14
      tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(Math.max(0, py - 24))}px)`
    },
  }
}

/* ======================================================================
   Audience journey — tension / surprise / satisfaction per scene
   ====================================================================== */
/** Chart width follows its container so text stays legible at phone widths. */
const sizeFor = (host: HTMLElement) => {
  const W = Math.round(clamp(host.clientWidth || 640, 280, 720))
  return { W, H: W < 480 ? 230 : 250, ticks: W < 480 ? [1, 20, 40, 60] : [1, 10, 20, 30, 40, 50, 60] }
}

export function renderJourney(host: HTMLElement) {
  const { W, H, ticks } = sizeFor(host)
  const m = { l: 36, r: 12, t: 26, b: 28 }
  const pw = W - m.l - m.r
  const ph = H - m.t - m.b
  const x = (i: number) => m.l + (i / (SCENES - 1)) * pw
  const y = (v: number) => m.t + (1 - v) * ph

  const tension = makeSeries(
    [
      [0, 0.3],
      [0.12, 0.5],
      [0.22, 0.36],
      [0.36, 0.56],
      [0.46, 0.4],
      [0.58, 0.62],
      [0.68, 0.86],
      [0.78, 0.58],
      [0.9, 0.7],
      [1, 0.42],
    ],
    0.09,
    7,
    3,
  ).map((v) => clamp(v, 0.08, 0.84))
  tension[40] = 0.93
  tension[39] = Math.max(tension[39], 0.8)
  tension[41] = Math.max(tension[41], 0.78)

  const surprise = makeSeries(
    [
      [0, 0.25],
      [0.5, 0.32],
      [1, 0.4],
    ],
    0.24,
    21,
    2,
  ).map((v) => clamp(v, 0.04, 0.82))

  const satisfaction = makeSeries(
    [
      [0, 0.06],
      [0.3, 0.14],
      [0.5, 0.3],
      [0.7, 0.32],
      [0.86, 0.56],
      [1, 0.78],
    ],
    0.07,
    3,
    3,
  ).map((v) => clamp(v, 0.02, 0.9))
  satisfaction[SCENES - 1] = 0.78

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Line chart of tension, surprise and satisfaction across 60 scenes. Tension peaks at scene 41; satisfaction ends at 78%.' })

  const defs = svgEl('defs')
  const clipId = `clip-j-${Math.random().toString(36).slice(2, 7)}`
  defs.innerHTML = `
    <linearGradient id="gradTension" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c8102e" stop-opacity=".14"/>
      <stop offset="1" stop-color="#c8102e" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="${clipId}"><rect class="clip-rect" x="${m.l - 4}" y="0" width="${pw + 8}" height="${H}"/></clipPath>`
  svg.appendChild(defs)

  // Grid + y labels
  const grid = svgEl('g', { class: 'grid' })
  const axis = svgEl('g', { class: 'axis' })
  ;[0, 0.25, 0.5, 0.75, 1].forEach((v) => {
    grid.appendChild(svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }))
    const t = svgEl('text', { x: m.l - 8, y: y(v) + 3.5, 'text-anchor': 'end' })
    t.textContent = `${Math.round(v * 100)}%`
    axis.appendChild(t)
  })
  ticks.forEach((s) => {
    const t = svgEl('text', { x: x(s - 1), y: H - 8, 'text-anchor': s === 1 ? 'start' : s === 60 ? 'end' : 'middle' })
    t.textContent = s === 1 ? 'Scene 1' : String(s)
    axis.appendChild(t)
  })
  svg.append(grid, axis)

  const plot = svgEl('g', { 'clip-path': `url(#${clipId})` })
  const toPts = (arr: number[]) => arr.map((v, i) => [x(i), y(v)] as Pt)
  const tPath = smoothPath(toPts(tension), 0.45)
  plot.appendChild(svgEl('path', { class: 'area-tension', d: `${tPath} L${x(SCENES - 1)},${y(0)} L${x(0)},${y(0)} Z` }))
  plot.appendChild(svgEl('path', { class: 'series s-satisfaction', d: smoothPath(toPts(satisfaction), 0.45) }))
  plot.appendChild(svgEl('path', { class: 'series s-surprise', d: smoothPath(toPts(surprise), 0.45) }))
  plot.appendChild(svgEl('path', { class: 'series s-tension', d: tPath }))
  svg.appendChild(plot)

  // Peak annotation (direct label on the one point the story is about)
  const peak = svgEl('g', { class: 'peak fade' })
  const px = x(40)
  const py = y(tension[40])
  peak.appendChild(svgEl('line', { x1: px, x2: px, y1: py - 6, y2: m.t - 10 }))
  peak.appendChild(svgEl('circle', { cx: px, cy: py, r: 4.5 }))
  const flip = px + 150 > W - m.r
  const pl = svgEl('text', { x: flip ? px - 6 : px + 6, y: m.t - 12, 'text-anchor': flip ? 'end' : 'start' })
  pl.textContent = 'Peak tension · Scene 41'
  peak.appendChild(pl)
  svg.appendChild(peak)

  // Hover layer
  const hLine = svgEl('line', { class: 'hover-line', y1: m.t, y2: m.t + ph })
  const dots = [
    svgEl('circle', { class: 'hover-dot', r: 4.5, fill: '#c8102e' }),
    svgEl('circle', { class: 'hover-dot', r: 4.5, fill: '#1b365d' }),
    svgEl('circle', { class: 'hover-dot', r: 4.5, fill: '#7186a6' }),
  ]
  const hit = svgEl('rect', { x: m.l, y: 0, width: pw, height: H, fill: 'transparent' })
  svg.append(hLine, ...dots, hit)

  host.innerHTML = ''
  host.appendChild(svg)
  const tip = attachTip(host, svg, W)

  const show = (e: PointerEvent) => {
    const i = clamp(Math.round(((tip.toX(e) - m.l) / pw) * (SCENES - 1)), 0, SCENES - 1)
    const cx = x(i)
    hLine.setAttribute('x1', String(cx))
    hLine.setAttribute('x2', String(cx))
    ;[tension, surprise, satisfaction].forEach((arr, k) => {
      dots[k].setAttribute('cx', String(cx))
      dots[k].setAttribute('cy', String(y(arr[i])))
    })
    const pct = (v: number) => `${Math.round(v * 100)}%`
    tip.place(
      cx,
      y(Math.max(tension[i], surprise[i], satisfaction[i])),
      `<b>Scene ${i + 1}</b>
       <div><span><i class="lg-red"></i>Tension</span><strong>${pct(tension[i])}</strong></div>
       <div><span><i class="lg-navy"></i>Surprise</span><strong>${pct(surprise[i])}</strong></div>
       <div><span><i class="lg-soft"></i>Satisfaction</span><strong>${pct(satisfaction[i])}</strong></div>`,
    )
    host.classList.add('is-hover')
  }
  hit.addEventListener('pointermove', show)
  hit.addEventListener('pointerdown', show)
  hit.addEventListener('pointerleave', () => host.classList.remove('is-hover'))
}

/* ======================================================================
   Emotional shape — per-scene tone as diverging bars + trend
   ====================================================================== */
export function renderShape(host: HTMLElement) {
  const { W, H, ticks } = sizeFor(host)
  const m = { l: 36, r: 12, t: 26, b: 28 }
  const pw = W - m.l - m.r
  const ph = H - m.t - m.b
  const slot = pw / SCENES
  const bw = Math.max(2, slot - 2) // 2px surface gap between adjacent bars
  const x = (i: number) => m.l + i * slot + (slot - bw) / 2
  const cx = (i: number) => m.l + i * slot + slot / 2
  const y = (v: number) => m.t + ((1 - v) / 2) * ph
  const zy = y(0)

  const keys: Pt[] = [
    [0, 0.2],
    [0.15, 0.55],
    [0.3, 0.12],
    [0.44, -0.68],
    [0.6, -0.3],
    [0.75, 0.2],
    [0.9, 0.55],
    [1, 0.7],
  ]
  const tone = makeSeries(keys, 0.3, 11).map((v) => clamp(v, -0.82, 0.92))
  tone[26] = -0.9
  const trend = Array.from({ length: SCENES }, (_, i) => keyed(keys, i / (SCENES - 1)))

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Bar chart of emotional tone for each of 60 scenes, from somber to uplifting, with a rise, fall, rise trend. Lowest point at scene 27; the ending is uplifting.' })

  const grid = svgEl('g', { class: 'grid' })
  const axis = svgEl('g', { class: 'axis' })
  ;[1, 0.5, -0.5, -1].forEach((v) => grid.appendChild(svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) })))
  ;[
    [1, 'Up'],
    [0, '0'],
    [-1, 'Down'],
  ].forEach(([v, label]) => {
    const t = svgEl('text', { x: m.l - 8, y: y(v as number) + 3.5, 'text-anchor': 'end' })
    t.textContent = String(label)
    axis.appendChild(t)
  })
  ticks.forEach((s) => {
    const t = svgEl('text', { x: cx(s - 1), y: H - 8, 'text-anchor': s === 1 ? 'start' : s === 60 ? 'end' : 'middle' })
    t.textContent = s === 1 ? 'Scene 1' : String(s)
    axis.appendChild(t)
  })
  svg.append(grid, axis)

  const bars = svgEl('g', { class: 'bars-g' })
  const r = 2
  tone.forEach((v, i) => {
    const top = y(Math.max(v, 0))
    const bot = y(Math.min(v, 0))
    const h = Math.max(1, bot - top)
    const x0 = x(i)
    // Rounded at the data end, square at the baseline
    const d =
      v >= 0
        ? `M${x0},${zy} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${zy} Z`
        : `M${x0},${zy} V${bot - r} Q${x0},${bot} ${x0 + r},${bot} H${x0 + bw - r} Q${x0 + bw},${bot} ${x0 + bw},${bot - r} V${zy} Z`
    const p = svgEl('path', { d, class: `grow ${v >= 0 ? 'bar-pos' : 'bar-neg'}` })
    p.setAttribute('style', `--i:${i}; transform-origin: 0 ${zy}px`)
    if (h < 1.5) p.setAttribute('opacity', '0.5')
    bars.appendChild(p)
  })
  svg.appendChild(bars)
  svg.appendChild(svgEl('line', { class: 'zero', x1: m.l, x2: W - m.r, y1: zy, y2: zy }))
  svg.appendChild(svgEl('path', { class: 'trend fade', d: smoothPath(trend.map((v, i) => [cx(i), y(v)] as Pt), 0.5) }))

  // Annotate the lowest point
  const note = svgEl('g', { class: 'note fade' })
  const lx = cx(26)
  const ly = y(tone[26])
  const lt = svgEl('text', { x: lx + 10, y: ly + 4 })
  lt.textContent = 'Lowest point · Scene 27'
  note.appendChild(lt)
  svg.appendChild(note)

  // Hover: one hit column per scene
  const hits = svgEl('g')
  tone.forEach((_, i) => {
    hits.appendChild(svgEl('rect', { x: m.l + i * slot, y: m.t, width: slot, height: ph, fill: 'transparent', 'data-i': i }))
  })
  svg.appendChild(hits)

  host.innerHTML = ''
  host.appendChild(svg)
  const tip = attachTip(host, svg, W)
  const paths = Array.from(bars.children) as SVGPathElement[]

  const show = (e: PointerEvent) => {
    const i = clamp(Math.floor((tip.toX(e) - m.l) / slot), 0, SCENES - 1)
    paths.forEach((p, k) => p.classList.toggle('is-hot', k === i))
    bars.classList.add('has-hot')
    const v = tone[i]
    const label = v > 0.15 ? 'Uplifting' : v < -0.15 ? 'Somber' : 'Neutral'
    tip.place(
      cx(i),
      y(Math.max(v, 0)),
      `<b>Scene ${i + 1}</b>
       <div><span><i class="${v >= 0 ? 'lg-red' : 'lg-navy'}" style="height:8px;width:8px;border:0;border-radius:2px;background:${v >= 0 ? '#c8102e' : '#1b365d'}"></i>${label}</span><strong>${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}</strong></div>`,
    )
    host.classList.add('is-hover')
  }
  hits.addEventListener('pointermove', show as EventListener)
  hits.addEventListener('pointerdown', show as EventListener)
  hits.addEventListener('pointerleave', () => {
    host.classList.remove('is-hover')
    bars.classList.remove('has-hot')
    paths.forEach((p) => p.classList.remove('is-hot'))
  })
}
