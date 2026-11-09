import './style.css'

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel))
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const desktop = window.matchMedia('(min-width: 961px)')

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

/* ---------------------------------------------------------------- Helpers */
function tween(from: number, to: number, dur: number, onStep: (v: number) => void) {
  if (reduced || dur <= 0) {
    onStep(to)
    return
  }
  const start = performance.now()
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / dur)
    onStep(from + (to - from) * (1 - Math.pow(1 - p, 3)))
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
const onceVisible = (el: Element, cb: () => void, threshold = 0.3) => {
  new IntersectionObserver(
    (entries, io) => {
      if (!entries[0].isIntersecting) return
      io.disconnect()
      cb()
    },
    { threshold },
  ).observe(el)
}

/* ---------------------------------------------------------------- Reveal */
const hero = $('.hero')!
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
    const sibs = Array.from(el.parentElement?.children ?? []).filter((c) => c.classList.contains('reveal'))
    el.style.setProperty('--d', `${Math.min(sibs.indexOf(el), 6) * 0.07}s`)
    revealIO.observe(el)
  })

Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]).then(() => {
  $$('.reveal', hero).forEach((el, i) => {
    el.style.setProperty('--d', `${i * 0.08}s`)
    el.classList.add('is-in')
  })
  requestAnimationFrame(() => hero.classList.add('is-ready'))
})

/* ---------------------------------------------------------------- Console: the hour, visualized */
const consoleEl = $('#console')!
const passes = $$<HTMLLIElement>('#passes li')
const passList = $('#passes')!
const clock = $('#consoleClock')!
const status = $('#consoleStatus')!
const resultScore = $('#resultScore')!
const replay = $<HTMLButtonElement>('#consoleReplay')!
const STATUS = [
  'Reading your script',
  'Mapping story & structure',
  'Reading characters & dialogue',
  'Assessing tone & visuals',
  'Pulling market comparables',
  'Checking production reality',
  'Coverage ready',
]
const minutes = passes.map((li) => {
  const [, m] = (li.querySelector('time')?.textContent ?? '00:00').split(':').map(Number)
  return m
})
const fmt = (m: number) => `00:${String(Math.round(m)).padStart(2, '0')}`
let runId = 0

function finishConsole() {
  passes.forEach((li) => {
    li.classList.remove('is-active')
    li.classList.add('is-done')
  })
  passList.style.setProperty('--progress', '100')
  clock.textContent = fmt(minutes[minutes.length - 1])
  status.textContent = STATUS[STATUS.length - 1]
  consoleEl.classList.add('is-complete')
  resultScore.textContent = '0'
  setTimeout(() => tween(0, 87, 1200, (v) => (resultScore.textContent = String(Math.round(v)))), 150)
}

function runConsole() {
  const id = ++runId
  consoleEl.classList.remove('is-complete')
  passes.forEach((li) => li.classList.remove('is-active', 'is-done'))
  passList.style.setProperty('--progress', '0')
  clock.textContent = fmt(0)
  resultScore.textContent = '0'
  if (reduced) return finishConsole()

  const STEP = 820
  passes.forEach((li, i) => {
    setTimeout(() => {
      if (id !== runId) return
      if (i > 0) {
        passes[i - 1].classList.remove('is-active')
        passes[i - 1].classList.add('is-done')
      }
      status.textContent = STATUS[i]
      passList.style.setProperty('--progress', String((i / (passes.length - 1)) * 100))
      if (i === passes.length - 1) {
        finishConsole()
        return
      }
      li.classList.add('is-active')
      tween(minutes[i], minutes[i + 1], STEP, (v) => id === runId && (clock.textContent = fmt(v)))
    }, 500 + i * STEP)
  })
}
onceVisible(consoleEl, runConsole, 0.35)
replay.addEventListener('click', runConsole)

/* ---------------------------------------------------------------- Anatomy (scroll-synced) */
const docParts = $$<HTMLElement>('#doc .doc-part')
const anatomyItems = $$<HTMLLIElement>('#anatomyList li')
function setPart(i: number) {
  docParts.forEach((p) => p.classList.toggle('is-active', Number(p.dataset.part) === i))
  anatomyItems.forEach((li) => li.classList.toggle('is-active', Number(li.dataset.part) === i))
}
setPart(0)
const anatomyIO = new IntersectionObserver(
  (entries) => {
    if (!desktop.matches) return
    entries.forEach((e) => e.isIntersecting && setPart(Number((e.target as HTMLElement).dataset.part)))
  },
  { rootMargin: '-46% 0px -46% 0px' },
)
anatomyItems.forEach((li) => {
  anatomyIO.observe(li)
  li.addEventListener('click', () => setPart(Number(li.dataset.part)))
  li.addEventListener('mouseenter', () => !desktop.matches || setPart(Number(li.dataset.part)))
})

/* ---------------------------------------------------------------- Score lab */
const SCRIPTS = [
  { values: [91, 68, 88, 81] }, // The Quiet Year — drama
  { values: [77, 92, 70, 89] }, // Double Booked — comedy
]
const PILLARS = ['Story & Craft', 'Commercial Viability', 'Cultural Resonance', 'Production Reality']
const labTabs = $$<HTMLButtonElement>('#lab [role="tab"]')
const labRows = $$<HTMLLIElement>('#labPillars li')
const labFix = $('#labFix')!
const labTotal = $('#labTotal')!
let labShown = false
let current = 0

function showScript(i: number, animate = true) {
  current = i
  const vals = SCRIPTS[i].values
  const low = vals.indexOf(Math.min(...vals))
  labTabs.forEach((t, k) => {
    t.setAttribute('aria-selected', String(k === i))
    t.tabIndex = k === i ? 0 : -1
  })
  labRows.forEach((row, k) => {
    const out = row.querySelector('b')!
    const bar = row.querySelector<HTMLElement>('.lab-bar i')!
    const from = Number(out.textContent) || 0
    bar.style.setProperty('--v', String(vals[k]))
    row.classList.toggle('is-low', k === low)
    tween(from, vals[k], animate ? 800 : 0, (v) => (out.textContent = String(Math.round(v))))
  })
  labFix.textContent = `Fix first · ${PILLARS[low]}`
  labTotal.textContent = String(Math.round(vals.reduce((a, b) => a + b, 0) / vals.length))
}
labTabs.forEach((t, i) => {
  t.addEventListener('click', () => showScript(i))
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const n = (i + 1) % labTabs.length
    showScript(n)
    labTabs[n].focus()
  })
})
onceVisible($('#lab')!, () => {
  labShown = true
  showScript(current)
})
// Render values without motion if the lab is never scrolled into view (e.g. print)
window.addEventListener('beforeprint', () => labShown || showScript(current, false))

/* ---------------------------------------------------------------- FAQ: master–detail on desktop, accordion on mobile */
const faqQs = $$<HTMLButtonElement>('.faq-q')
const faqAs = faqQs.map((q) => document.getElementById(q.getAttribute('aria-controls')!)!)
function openFaq(i: number | null) {
  faqQs.forEach((q, k) => {
    const on = k === i
    q.setAttribute('aria-expanded', String(on))
    faqAs[k].classList.toggle('is-open', on)
  })
}
openFaq(0)
faqQs.forEach((q, i) =>
  q.addEventListener('click', () => {
    const isOpen = q.getAttribute('aria-expanded') === 'true'
    // Desktop always shows one answer; mobile behaves as an accordion
    openFaq(isOpen && !desktop.matches ? null : i)
  }),
)
desktop.addEventListener('change', (e) => {
  if (e.matches && !faqQs.some((q) => q.getAttribute('aria-expanded') === 'true')) openFaq(0)
})
