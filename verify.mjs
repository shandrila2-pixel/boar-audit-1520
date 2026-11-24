#!/usr/bin/env node
// Reproduces the BOAR/LabRat headline aggregates from public per-item files,
// then shows why abs_app / abs_ref does not equal U-total.
//
//   node verify.mjs
//
// No dependencies. Node 18+ (global fetch).

const ITEMS = 'https://raw.githubusercontent.com/r4topunk/boar-bench/HEAD/bench/v0.4/items.jsonl'
const TRACES = 'https://huggingface.co/datasets/r4topunk/boar-traces/resolve/main/rnd/research/coordinator/arms/device-final'
const JUDGE = TRACES + '/judge'
const H = { 'User-Agent': 'boar-audit-verify/1.0' }

const get = async (u) => {
  const r = await fetch(u, { headers: H })
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + u)
  return r.text()
}
const jsonl = async (u) => (await get(u)).trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l))
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length
const rubric = (s) => (s.correctness + s.completeness + s.usefulness) / 3

// published values, arms/device-final/aggregates/m1.json
const PUBLISHED = {
  '42:opus': { U: 0.16683087027914614, abs_app: 0.6717557251908397, abs_ref: 3.874045801526718 },
  '42:codex': { U: 0.24402558061258833, abs_app: 0.9376590330788805, abs_ref: 3.779898218829516 },
  '43:opus': { U: 0.16225057245665686, abs_app: 0.6552162849872774, abs_ref: 3.8893129770992365 },
  '43:codex': { U: 0.2408660351826793, abs_app: 0.9185750636132315, abs_ref: 3.7608142493638677 },
  pooled: {
    opus: { U: 0.16453621763356277, abs_app: 0.6634860050890585, abs_ref: 3.881679389312977 },
    codex: { U: 0.24244980597266744, abs_app: 0.9281170483460559, abs_ref: 3.7703562340966923 },
  },
}

const items = await jsonl(ITEMS)
const Hset = items.filter((i) => !i.tags.anchor_vexact)              // spec 2.2: 71 headline items
const wOf = (it) => (it.tags.health_safety ? 0.5 : 1)                // spec 2.2: health items weigh 0.5
const Sw = Hset.reduce((a, it) => a + wOf(it), 0)

console.log('items: ' + items.length + '   headline set H: ' + Hset.length + '   sum w: ' + Sw)
console.log('\n"+" = reproduces the published value to 1e-9\n')

const acc = { opus: { A: 0, R: 0, U: 0, mass: 0 }, codex: { A: 0, R: 0, U: 0, mass: 0 } }
const refused = {}

for (const seed of ['42', '43']) {
  for (const fam of ['opus', 'codex']) {
    const judge = await jsonl(JUDGE + '/dev-s' + seed + '.' + fam + '.judgments.jsonl')
    const traces = await jsonl(TRACES + '/traces/dev-s' + seed + '.traces.jsonl')
    const z = new Map(traces.map((t) => [t.itemId, !!(t.ruler && t.ruler.refusedZ)]))

    const per = new Map()
    for (const j of judge) {
      if (!per.has(j.queryId)) per.set(j.queryId, { boar: [], ref: [] })
      per.get(j.queryId).boar.push(rubric(j.mapped.boar))
      per.get(j.queryId).ref.push(rubric(j.mapped.ref))
    }

    let nA = 0, nR = 0, nU = 0, mass = 0
    for (const it of Hset) {
      const e = per.get(it.id)
      if (!e) throw new Error('missing judgment for ' + it.id)
      const mApp = mean(e.boar)                        // spec 3.4: scores averaged over the two orders
      const mRef = mean(e.ref)
      const u = z.get(it.id) ? 0 : mApp - 1            // spec 3.1: u := 0 on a refused answer
      nA += wOf(it) * (mApp - 1)
      nR += wOf(it) * (mRef - 1)
      nU += wOf(it) * u
      if (z.get(it.id)) {
        mass += wOf(it) * (mApp - 1)
        ;(refused[it.id] = refused[it.id] || { w: wOf(it), m: {} }).m[fam + '-s' + seed] = mApp
      }
    }

    const U = nU / nR, abs_app = nA / Sw, abs_ref = nR / Sw
    const p = PUBLISHED[seed + ':' + fam]
    const ok = (a, b) => (Math.abs(a - b) < 1e-9 ? '+' : 'X')
    console.log('s' + seed + ' ' + fam.padEnd(6) +
      ' U=' + U.toFixed(12) + ok(U, p.U) + '  ' +
      'abs_app=' + abs_app.toFixed(9) + (p.abs_app ? ok(abs_app, p.abs_app) : '') + '  ' +
      'abs_ref=' + abs_ref.toFixed(9) + (p.abs_ref ? ok(abs_ref, p.abs_ref) : '') + '  ' +
      'A/R=' + (abs_app / abs_ref).toFixed(9))

    acc[fam].A += nA; acc[fam].R += nR; acc[fam].U += nU; acc[fam].mass += mass
  }
}

console.log('\npooled over both seeds:')
for (const fam of ['opus', 'codex']) {
  const a = acc[fam]
  const abs_app = a.A / 2 / Sw, abs_ref = a.R / 2 / Sw, U = a.U / a.R
  const p = PUBLISHED.pooled[fam]
  const ok = (x, y) => (Math.abs(x - y) < 1e-9 ? '+' : 'X')
  console.log('  ' + fam.padEnd(6) + ' U=' + U.toFixed(12) + ok(U, p.U) +
    '  abs_app=' + abs_app.toFixed(9) + ok(abs_app, p.abs_app) +
    '  abs_ref=' + abs_ref.toFixed(9) + ok(abs_ref, p.abs_ref) +
    '  A/R=' + (abs_app / abs_ref).toFixed(9) +
    '  gap=' + (((abs_app / abs_ref) / U - 1) * 100).toFixed(2) + '%' +
    '  zeroed mass=' + (a.mass / 2).toFixed(6))
}

console.log('\nrefused items (u := 0 in U-total, kept in abs_app), all weight 0.5:')
for (const [id, r] of Object.entries(refused)) {
  console.log('  ' + id + '  w=' + r.w + '  ' + Object.entries(r.m).map(([k, v]) => k + ' m=' + v.toFixed(4)).join('  '))
}
console.log('\nThe identity U = abs_app/abs_ref would hold if every item were scored on one scale.')
console.log('It fails by exactly the mass of the refused items, which abs_app keeps and U-total zeroes.')