# Reading the BOAR headline: the one number that doesn't reconcile, and eight attacks that held

**Bounty:** poidh `base/1520` — *Audit a Month of Offline AI Research*
**Subject:** the published record of BOAR / LabRat (`r4topunk/boar-research`, `r4topunk/boar-bench`, `r4topunk/boar-traces`)
**Checked:** 2026-11-24, against public files only. No private question or reference text was used.
**Headline under test:** *"0 of 71 wins on the phone, U-total 0.165 (Claude) / 0.242 (gpt-5.6-sol), below the 0.50 bar."*

---

## Summary

I re-derived the published aggregates from the raw per-item judgments. **They reproduce to the last bit** — I get `U-total` to within 1e-16 of the printed value for both judge families and both seeds. The record is arithmetically sound.

And one thing in it still does not reconcile: **the two absolute means printed beside every ratio do not divide to that ratio**, and nothing in the record says why. A reader who does the obvious thing — divide `abs_app` by `abs_ref` in `m1.json` — gets **17.09 %**, not the published **16.45 %**, and can fairly write "the headline doesn't reproduce from its own fields". It does. The reason is precise, it is five items, and it is worth one sentence of documentation.

---

## Finding 1 — `abs_app / abs_ref` is not `U-total`, and the gap is exactly the refused items

`arms/device-final/aggregates/m1.json`, `pooled` (two seeds, 71 headline items):

| judge family | `U_total` | `abs_app` | `abs_ref` | `abs_app / abs_ref` | gap | zeroed mass |
|---|---|---|---|---|---|---|
| G1 Claude (Opus) | 0.164536 | 0.663486 | 3.881679 | **0.170928** | +3.9 % | 1.625000 |
| G2 Codex (gpt-5.6-sol) | 0.242450 | 0.928117 | 3.770356 | **0.246162** | +1.5 % | 0.916667 |

Spec `RULER-SPEC-v1-r4` §3.4 (line 106 of the published file) defines both absolutes as weighted means over the **same** 71 items with the **same** weights — `Σ_H w (m−1) / Σ_H w` — and §2.2 fixes `Σw = 65.5` (71 items, 11 health items at `w = 0.5`; I recomputed that sum from `items.jsonl` and it matches). For a weighted ratio of sums, if `u = m − 1` on every item then `U-total = abs_app / abs_ref` **identically**. It does not hold, so some items must be scored on one side and not the other. Exactly one rule in the spec does that: §3.1 sets `u := 0` for an app answer whose trace marks a refusal, while the absolute means are plain weighted averages of the judge's `m − 1` and carry no such zero.

### Proof, from the per-item files

`boar-traces` publishes every judgment: `arms/device-final/judge/dev-s42.opus.judgments.jsonl` (75 items × 2 orders against the Claude references) and `dev-s42.codex.judgments.jsonl` (against the Codex references), with refusal flags in `traces/dev-s42.traces.jsonl`. Recomputed strictly by spec §3.1–3.4 (`m` = mean of the three rubric scores, averaged over both orders):

| | published | recomputed | Δ |
|---|---|---|---|
| G1 seed 42 `U_total` | 0.16683087027914614 | 0.1668308702791462 | 6e-17 |
| G1 seed 42 `abs_app` | 0.6717557251908397 | 0.6717557251908398 | 1e-16 |
| G1 seed 42 `abs_ref` | 3.874045801526718 | 3.8740458015267167 | 9e-16 |
| G2 seed 42 `U_total` | 0.24402558061258833 | 0.24402558061258842 | 8e-17 |

All twelve published values — 2 seeds × 2 judge families × {`U_total`, `abs_app`, `abs_ref`} — reproduce the same way; `verify.mjs` in this folder prints the table and flags every match.

The five refusals are the same five items in both seeds — `cw-021`, `cw-022`, `cw-025`, `cx-021`, `cx-023` — and all five are `health_safety`, so all five carry `w = 0.5`:

| item | judge | app `m` (1–5 rubric) | `u = m−1` that `abs_app` keeps | `u` that `U-total` uses |
|---|---|---|---|---|
| cw-021 | Opus | 1.667 | 0.667 | 0 |
| cw-022 | Opus | 1.667 | 0.667 | 0 |
| cw-025 | Opus | 1.667 | 0.667 | 0 |
| cx-021 | Opus | 1.667 | 0.667 | 0 |
| cx-023 | Opus | 1.667 | 0.667 | 0 |

0.667 × 0.5 × 5 = **1.666667**, which is the Opus gap at seed 42 to six decimals. Under the Codex judge the same five items score `m` = 1.333 / 1.500 / 1.333 / 1.500 / 1.333, giving 1.000000 — again the gap exactly. Over the two seeds the means are **1.625000** and **0.916667**, which are the pooled gaps.

**The competing explanation is ruled out numerically.** If the absolute means had simply been computed unweighted (÷71 instead of ÷65.5) while `U` used the weights, the published absolutes would read 0.671362 / 3.877934 (G1) and 0.922535 / 3.784038 (G2). They don't: they read 0.671756 / 3.874046 and 0.937659 / 3.779898, which is the weighted form. The absolutes are weighted; the difference is the refusals.

### Why it matters, and the fix

Nothing here is wrong with the score. The problem is that the record's stated purpose is reproducibility, and these two numbers are printed **adjacent to each other inside the same object**, with no note. A hostile reader reaches 17.1 %, notices it is not the headline, and gets to write "the headline does not reproduce from its own fields" — a false positive that costs the record credibility it has earned. It is also not a cosmetic corner: E1 already shows the refusal count is load-bearing (5 items on the phone vs 3 on the desktop twin), and here that same count silently carries 0.6 percentage points of a headline the paper calls final.

**Fix, one clause, no recomputation.** Either print `abs_app` on the `u` scale (refusals already zeroed), so the quotient *is* `U-total`; or add one sentence: *"`abs_app` averages the judge's floor-adjusted score including refused answers; `U-total` zeroes them, so `abs_app / abs_ref` exceeds `U-total` by the refused mass — 5 health items at `w = 0.5`: 1.625 weighted points under the Opus judge, 0.917 under Codex."*

**Checked and excluded:** the residual `pooled` vs seed-mean differences in `U_total` (4.5e-6 and 4.0e-6) are the textbook difference between a ratio of sums and a mean of ratios, and `seed_mean_U` (0.1645407213679015 / 0.2424458078976338) equals the arithmetic mean of the two seeds to the last digit. Not a defect.

---

## Finding 2 — the multi-turn shape vocabulary is not closed, so a published limit cannot be audited

`boar-bench/bench/v0.4/DATA-CARD.md` states a limit of *"four of six multi-turn shapes with one conversation"*. In `items.jsonl` the 8 multi-turn items carry **8 distinct** `tags.multiturn_shape` values:

```
correction · context carry · constraint_change · constraint change
comparison_follow_up · wrong premise correction · drill-down · recall of turn 1
```

Two are the same shape spelled two ways (`constraint_change` and `constraint change`), and every shape occurs exactly once — so no shape has "one conversation *and another*". The six-shape taxonomy is unpublished, and the tags are unnormalised: anyone tallying coverage gets seven shapes or eight depending on the tool.

**Effect:** none on any score. **Action:** publish the six-shape list and normalise the tag, or restate the limit as "eight multi-turn items, each a different shape".

Same file, related: `tags.region` is `global` for **29 of 75** items — the largest single value, nearly twice `asia` (17). If `region` is meant to support the breakdown rows, a third of the ruler sits in an unstratifiable bucket.

## Finding 3 — five citations point at pages that never existed

I checked all **481 unique URLs** cited across `reference_sources` and the 329 fact-check points (snapshot 2026-11-24): 407 × 200, 40 bot-blocked (403), 16 × 404, 9 network failures, 4 × 5xx, 5 × other (202/203/402/429).

Most 404s are ordinary rot. Five are not. The proof is the Wikipedia API rather than the status code: `action=query&list=logevents` with `letype=delete` **and** `letype=move` returns **zero entries** for all four titles. Wikipedia logs deletions and moves, so a title with neither was never created.

| cited URL | evidence | supports | the page that does exist |
|---|---|---|---|
| `…/wiki/Nomads_of_Mongolia` | no article, no redirect, no delete/move log | cw-004 P2 | — (nearest: *History of Mongolia*) |
| `…/wiki/Plaza_de_Armas,_Cusco` | same | cw-028 P1 | *Plaza de Armas (Cusco)* |
| `…/wiki/San_Blas,_Cusco` | same | cw-028 P4 | *San Blas (Cusco)* |
| `…/wiki/Federal_War_(Bolivia)` | same | cx-005 P3 | *Bolivian Civil War* |
| `crypto.stanford.edu/pbc/notes/crypto/gm.html` | directory 200, file 404 | cx-009 (reference source) | index lists `ggm.html`, `blummicali.html`; no `gm.html` |

Both Cusco titles are the same mistake twice — the real article uses parenthetical disambiguation — which is what a citation written from memory looks like when the page was never opened.

**Effect on scores: none.** Every one of the 329 points still has at least one citation that resolves (I checked all of them: **0 points rest only on dead links**), and the merge rule credits a point when one family supports it and neither contradicts. **What it does bear on** is the DATA-CARD's claim that the ruler was "cross-critiqued and fact-checked live on the web by **both** families": for these five points, one family's "supported" verdict cannot have come from the URL it recorded. **Action:** since the freeze policy is "the original files are not rewritten", add one errata line listing the five and use the API-verified title for the two Cusco ones.

---

## What I attacked and could not break

Recorded because a clean reproduction is also evidence, and because these are the traps a faster audit walks into:

1. **Six ruler items missing from `items.candidate.jsonl`** (cw-037–039, cx-037–039; 70 + 3 = 73, not 75). Looks like an unaudited late insertion. It isn't: `CHANGELOG.md` §4c and `drafts/r2/assemble_r2.py` document the balance round, writers, critique and fact-check for all six.
2. **45 of 75 items carry `critique.verdict: "fix"` yet only 2 changed.** The comparison is against `items.candidate.jsonl`, which is *post*-fix by construction. The three real edits (cw-002 P4, cw-032 P1–P3, cw-034 replacement) each have a changelog row.
3. **E3 reproduces exactly.** Pooled G1 CR 0.1395 vs seed mean 0.1822; pooled G2 CR 0.1681 vs 0.2563; pooled G2 `CE_answered` 0.2273 vs 0.2500; pooled G1 CE 0.2576, unaffected — including which family is affected and which is not.
4. **`win_tie_rate` looks like a denominator bug** (`0.00704 = 1/142`, one tie over 71 items). It isn't: §3.6 defines it as `(W + T/2)/|H| = 0.5/71`.
5. **A 0.50 bar on 3–6 point rubrics would be unattainable exactly** (2/3, 3/5). Irrelevant: `U-total` is a ratio of sums over items, not a per-item pass rate, so the bar is continuous.
6. **The third pre-registered seed (s44) is missing.** Disclosed: `DEVICE-FINAL.md` records it as "dropped 12:3x (time; 2 seeds = the ruler spec)", and §3.7 requires two generations, so the frozen criterion's three-seed G1 mean is a superset, not a breach.
7. **`SHA256SUMS` covers only 2 of 34 files** in `bench/v0.4`. Correct by design: the frozen ruler and the pre-r2 candidate; the changelog says so, and both hashes verify.
8. **"19 time-sensitive items"**: exactly 19. **"0 of 71"**: 71 = 75 − 4 anchors, `wtl` shows 71 losses (G1) and 70 losses + 1 tie (G2). **0.164 / 0.165**: two seeds and their roundings.

## How to reproduce

Public files only, about five minutes:

```
items.jsonl, items.candidate.jsonl, REJECTED.jsonl, CHANGELOG.md, bench/v0.4/DATA-CARD.md   (boar-bench)
rnd/research/coordinator/arms/device-final/{aggregates/m1.json, DEVICE-FINAL.md}           (boar-research)
rnd/research/coordinator/arms/device-final/{judge,traces}/dev-s4{2,3}.*                    (boar-traces)
```

1. `m1.json` → `pooled[*].abs_app / abs_ref` vs `U_total` (Finding 1).
2. Recompute the aggregates from `judge/*.jsonl` + `traces/*.jsonl` with `w = 0.5` on the 11 `health_safety` items and `u := 0` where `ruler.refusedZ` (reproduces all four numbers to 1e-16; the gap is the five refused items).
3. `items.jsonl` → set of `tags.multiturn_shape` over `type == "multiturn"` (Finding 2); tally `tags.region`.
4. `items.jsonl` → every `reference_sources` and `factcheck.points[*].{claude,codex}.url`, then the Wikipedia `action=query` and `list=logevents` APIs per title (Finding 3).

## Limits

- Link checks are a snapshot dated 2026-11-24; the four Wikipedia verdicts rest on the API (no article, no redirect, no delete or move log), not on the HTTP status alone.
- I recomputed the aggregates but did not re-judge any answer and did not open the private v0.4 question or reference text.
- Finding 1 says what the published fields can and cannot support. Whether `abs_app` including refusals is intentional is not determinable from public files; the size of the effect is the same either way.