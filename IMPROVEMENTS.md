# Encounter Map Forge — Improvement Backlog

An evidence-based review of the codebase with concrete, independently actionable
improvements. Nothing here is required to make the app work; the app is already in a
healthy state. Items are ordered by impact so they can be cherry-picked.

This document was reconciled on 15 October 2026 against an independent review. Where the
two disagreed, the disagreement and its resolution are recorded inline, including items
that were deliberately **closed with no change**.

Priority scale:

- **P1** — observable bug or user-facing inconsistency.
- **P2** — maintainability work that will ease future changes.
- **P3** — style, template, or ergonomics preference.
- **P4** — test coverage gap.
- **Closed** — reviewed and intentionally left as-is.
- **Optional** — tooling that may or may not be worth adopting.

## Scope and method

Reviewed: `src/app/engine/**`, `src/app/rendering/**`, `src/app/preview/**`,
`src/app/app.*`, `src/app/icon.ts`, `src/main.ts`, `src/styles.scss`, `tests/**`,
`scripts/**`, and all config.

Verified locally on 15 October 2026 with the pinned toolchain (Angular 22.2.3,
TypeScript 6.0.3, Vitest 4.0.18):

- `npm run build` — passes, no budget warnings.
- `npm run typecheck:tests` — passes.
- `npm test` — 7 unit/render tests pass.

Stepper edge cases were confirmed in Chromium. Each finding states the file reference,
the evidence, a proposed change, the reason, and an **acceptance** condition that can be
checked to confirm the fix.

## Recommended order of work

1. **P1.1 + its regression tests** — fix the room-stepper normalization and pin the
   empty/fractional drafts in the same change (the only confirmed user-facing bug).
2. **P4.1, P4.3, P4.2** — focused filename and threshold tests, then representative golden
   model fixtures (a couple of seeds per room count and density).
3. **P2.1** — move export/preview resolution into shared rendering constants.

Everything else is optional cleanup or a recorded "no change".

## What is already good (do not regress)

These are deliberate strengths; the backlog below should preserve them.

- `src/app/engine/**` is pure TypeScript with no Angular or DOM imports, so it is
  independently testable (`src/app/engine/generate.spec.ts`).
- `generateDungeon` returns a discriminated `GenerationResult` instead of throwing.
- Strict TypeScript is on, including `noUncheckedIndexedAccess`,
  `noImplicitReturns`, and strict templates (`tsconfig.json`).
- Generation and rendering never call `Math.random()` or `Date.now()`; state is
  derived from seeded streams.
- Angular 22 is zoneless by default (since v21); the app has no `zone.js` dependency
  or polyfill and is driven by signals, which is correct — no provider is needed.
- Accessibility is handled: canvas label + `aria-describedby`, keyboard pan/zoom,
  `role="alert"` errors, `aria-busy`, `sr-only` legends, visible focus.
- Coverage in `tests/forge.spec.ts` is strong (draft isolation, export dimensions,
  viewport-independent export bytes, failure recovery).

---

## P1 — Correctness and user-facing issues

### P1.1 — Room stepper normalization is implicit and inconsistent

**File:** `src/app/app.html:62,82`, `src/app/app.ts:63-73`

**Evidence:** the template disables the buttons using the raw field value, while
`stepRooms` floors the input and falls back to a base of `6`:

```html
<button ... (click)="stepRooms(-1)" [disabled]="+rooms() <= 4"></button>
<button ... (click)="stepRooms(1)" [disabled]="+rooms() >= 8"></button>
```

```ts
const current = Number(this.rooms());
this.rooms.set(
  String(
    Math.max(
      4,
      Math.min(8, (Number.isFinite(current) && current >= 4 ? Math.floor(current) : 6) + delta),
    ),
  ),
);
```

Confirmed behaviors in Chromium:

- Empty field: **minus is disabled**, but **plus jumps to 7** (the `6` fallback + 1).
- `4.5`: steps down to `4`, up to `5`.

Non-numeric text such as `abc` could not be verified through the UI: `type="number"`
inputs sanitize invalid text, typically leaving the value empty, so the empty-field case
above is the reachable path. The policy (how to normalize an empty or fractional draft)
is still implicit and is applied differently by the action and by the disabled states.

**Proposed change:** Introduce one explicit normalization rule, e.g. a computed
`roomDraft` that returns a valid integer (blank or non-numeric → a documented base such
as `6`, fractions floor), and derive both the disabled states and `stepRooms` from it.
Document the choice.

**Reason:** A control whose enabled state disagrees with what clicking it does is a
user-facing bug, even though it cannot corrupt any data.

**Acceptance:** For `""`, `"4.5"`, `"4"`, and `"8"` (the UI-reachable cases), the button's
enabled state matches the result of clicking it, pinned by a unit/e2e case. Non-numeric
text is sanitized by the native number input, so it can be covered by a direct unit test
if defensive handling is wanted.

**Status:** implemented — `src/app/room-count.ts` holds `normalizeRoomCount` /
`stepRoomCount`; `App` derives `roomDraft` / `atMinRooms` / `atMaxRooms` from it;
covered by `src/app/room-count.spec.ts` and a Playwright stepper case in
`tests/forge.spec.ts`.

---

## P2 — Maintainability

### P2.1 — Export/preview dimensions are magic numbers

**File:** `src/app/rendering/export.ts:15-21`, `src/app/preview/preview.ts:42-45`,
`src/app/rendering/dungeon-renderer.ts:268-270`, `src/app/app.html:182`

**Evidence:** `2560`/`1920` are `WIDTH * 64`/`HEIGHT * 64` written by hand, and `64`
(pixels per tile) is repeated in three files; the UI text repeats the pixel dimensions.

**Note on severity:** this is not a bug — the export already matches the fixed
specification, so the review downgraded it from the earlier P1. It is a maintenance risk
only if the map size or resolution ever changes.

**Proposed change:** Add a single `PIXELS_PER_TILE = 64` plus derived
`EXPORT_WIDTH`/`EXPORT_HEIGHT` **in the rendering layer**, not in `engine/model.ts` —
the engine must stay independent of presentation concerns. Reference it from the export,
preview, renderer, and UI label.

**Reason:** One source of truth; removes silent-drift risk if the spec changes.

**Acceptance:** `grep -rn "2560\|1920\|pixelsPerTile: 64" src` returns only the constant
definition; `npm test` / `npm run test:e2e` still assert a 2560 × 1920 PNG.

**Status:** implemented — `src/app/rendering/resolution.ts` defines `PIXELS_PER_TILE`,
`EXPORT_WIDTH`, and `EXPORT_HEIGHT`; `export.ts`, `preview.ts`, `app.ts`, and `app.html`
consume them. The acceptance grep on `src` now returns no matches. `tests/forge.spec.ts`
keeps its explicit `2560 × 1920` assertion as an independent oracle (see C.1).

### P2.2 — Busy-state yield uses a fixed `setTimeout(16)`

**File:** `src/app/app.ts:143-162` (helper at `src/app/app.ts:18-22`)

**Evidence:**

```ts
this.busy.set(kind);
this.error.set('');
await new Promise<void>((resolve) => setTimeout(resolve, 16));
```

**Correction to the earlier draft:** replacing this with a single
`requestAnimationFrame` or `afterNextRender` does **not** guarantee the busy state was
painted first — rAF callbacks run _before_ the browser's repaint for that frame, and
Angular's render completion is not the same event as browser paint. The original fixed
delay was also only probabilistically sufficient.

**Proposed change:** Pick an explicit mechanism and say why:

- **double `requestAnimationFrame`** — the conventional "after paint" idiom. Treat it as
  a heuristic, not a guarantee: it is not specified to run after paint, only
  conventionally expected to.
- move generation **off-thread** into a Web Worker — the engine has no DOM dependency,
  so it is a clean candidate, and the main thread then genuinely stays responsive, or
- keep the delay but extract it as a named constant, documenting the intent in the README
  (the brief forbids code comments — `encounter-map-forge-brief.md:37`).

**Reason:** Makes the "show busy, then work" intent explicit and removes a bare magic
number. No option gives a formal guarantee that the busy state was painted first.

**Acceptance:** No unnamed `setTimeout(..., 16)` remains. Note the existing test
(`tests/forge.spec.ts:178-179`) asserts the buttons are _disabled in the DOM_ during
export; it does not verify the disabled state appeared on screen before work started, so
it cannot confirm this fix.

**Status:** implemented — `run` now awaits a module-scope `yieldForUi()` helper that
resolves after two animation frames (the double-rAF idiom), replacing the fixed 16 ms
delay. The helper is deliberately named for the rendering _opportunity_ it provides, not
a guaranteed paint. The decision is documented in the README. Caveat: rAF is paused or
throttled in a hidden tab, so a backgrounded tab could delay the operation until it is
visible again; operations are user-initiated while the workbench is on screen, so this is
acceptable.

### P2.3 — Operation union type is repeated

**File:** `src/app/app.ts:12,38,145`

**Evidence:** `'generation' | 'details' | 'export'` appeared twice.

**Proposed change:** `type Operation = 'generation' | 'details' | 'export';` used in both
places.

**Reason:** One source of truth. Small, low-risk.

**Acceptance:** The union literal appears once.

**Status:** implemented — `type Operation` is defined at `src/app/app.ts:12` and used by
the `busy` signal and the `run` signature; the union literal now appears once.

### P2.4 — Seeded stream keys are assembled ad hoc

**File:** `src/app/engine/generate.ts:94,134`, `src/app/engine/decoration.ts:15`,
`src/app/rendering/dungeon-renderer.ts:71`, `src/app/engine/showcase.ts:19`

**Evidence:** keys such as
`` `${GENERATOR_VERSION}:${seed}:layout:${roomCount}:${retry}` `` and
`` `${GENERATOR_VERSION}:${seed}:decoration:${density}:${revision}` `` are hand-written
across modules.

**Proposed change:** Centralize a `streamSeed(seed, kind, ...parts)` helper so the set of
streams and their versioning live in one place. **Prerequisite:** land P4.2 (golden
snapshot) first — the current determinism tests would still pass even if every seed's
output changed, so without a fixed baseline a refactor could silently alter results.

**Reason:** Makes the stream set explicit and prevents typo-induced collisions, while the
golden snapshot checks that the sampled outputs are preserved (see the P4.2 limitation).

**Acceptance:** All stream keys come from one helper, and the golden snapshot from P4.2
is unchanged.

**Status:** implemented — `streamSeed(seed, kind, ...parts)` and
`deriveSeed(base, ...parts)` live in `src/app/engine/random.ts`. `kind` is typed as
`SeedStream = 'layout' | 'decoration' | 'surface'`, so a misspelled stream name is a
compile error. `generate.ts` (layout/surface), `decoration.ts`, and `dungeon-renderer.ts`
(per-tile) now use them; the keys they emit are byte-identical to before. The P4.2 golden
hashes are unchanged, which is the evidence. `showcase.ts` keeps its one-off
`hashSeed('showcase:surface')` literal intentionally, to preserve its fixture output.

### P2.5 — `Preview` observer lifecycle (optional)

**File:** `src/app/preview/preview.ts:48-62`

**Correction to the earlier draft:** `afterNextRender` does **not** accept a
cleanup-function return — returning a function does not register cleanup. (Render-phase
return values can be passed into subsequent phases, so a returned value is not
necessarily ignored; it is simply not a teardown hook.) It instead returns an
`AfterRenderRef`. However, `AfterRenderRef.destroy()` only cancels the _scheduled_
callback — it does **not** disconnect a `ResizeObserver` that the callback already
created and stored. Replacing the teardown with `.destroy()` would therefore leak the
observer. The existing `ngOnDestroy` field management is **correct** and is not a defect.

**Proposed change (optional, organizational only):** keep `observer.disconnect()` in
`ngOnDestroy`, or capture `DestroyRef` in the constructor and register
`onDestroy(() => observer.disconnect())` inside the callback. Do not rely on
`AfterRenderRef.destroy()` for observer cleanup.

**Acceptance:** If changed, resize behavior is unchanged; if not, this stays a note.

**Status:** implemented — the constructor now captures `DestroyRef` and registers
`onDestroy(() => observer.disconnect())` inside the `afterNextRender` write callback, so
the `ResizeObserver` teardown is co-located with its creation. The now-unused
`private observer` field and `ngOnDestroy` were removed. `AfterRenderRef.destroy()` was
deliberately not used, since it only cancels the scheduled callback and would leave a
created observer connected. Resize behavior is unchanged.

---

## P3 — Style, template, and ergonomics

### P3.1 — `[checked]` binding ignores the event's own value (grid checkbox)

**File:** `src/app/app.html:150-157`

**Evidence:**

```html
<input type="checkbox" [checked]="grid()" (change)="grid.set(!grid())" />
```

The handler toggles the signal rather than reading `event.target.checked`. (The density
radios at `src/app/app.html:93-101` already pass their selected value correctly, so no
change is needed there.)

**Proposed change:** Read the value from the element via a template reference variable:

```html
<input #gridToggle type="checkbox" [checked]="grid()" (change)="grid.set(gridToggle.checked)" />
```

Two caveats, both verified against the Angular 22.2.3 compiler:

- Inline casting like `(change)="grid.set(($event.target as HTMLInputElement).checked)"`
  is **not** valid template syntax — it fails with `NG5002: Parser Error`. Narrow the
  type in a TypeScript handler instead if no reference variable is used.
- Do **not** reach for `model()` here: `model()` defines a two-way binding for a
  _component input_, not a native checkbox, and is not a drop-in replacement for a DOM
  form binding.

**Reason:** Reading the actual DOM value is the more idiomatic pattern and avoids
divergence if the DOM and signal get out of sync. Cosmetic today.

**Acceptance:** Grid toggle behaves identically; e2e assertions pass.

**Status:** implemented — the checkbox now declares `#gridToggle` and reads
`gridToggle.checked` in the `(change)` handler, so the signal follows the actual DOM
value instead of toggling. `model()` was not used (it is for component inputs, not native
checkboxes). The grid/open/close e2e assertions pass. Cosmetic; no behavior change.

### P3.2 — Repeated `map().decoration.density` reads

**File:** `src/app/app.html:93,98,166`

**Proposed change:** Use `@let` to bind it once where it clarifies intent.

**Reason:** Shorter, less repetitive template. Reading a signal multiple times is not a
performance problem, so this is purely cosmetic.

**Acceptance:** Rendered selection/summary unchanged.

**Status:** implemented — `@let selectedDensity` is declared in the density fieldset and
read by both the radio `selected`/`checked` bindings; `@let currentDensity` replaces the
summary read. Verified 16 October 2026: `npm run build` passes, `npm test` 10/10,
`npm run test:e2e` 5/5 (includes the density-selection and `#map-summary` assertions at
`tests/forge.spec.ts:29-31`), `npm run format:check` clean.

### P3.3 — `app.scss` size and three `!important` rules

**File:** `src/app/app.scss` (1012 lines / 17.4 kB source), lines 812, 903, 954

**Evidence:** the three `!important` declarations suggest competing selectors. Note:
`npm run build` does **not** trip the `anyComponentStyle` 16 kB budget
(`angular.json:24`) — component styles are minified into the JS bundle and the build is
warning-free.

**Proposed change:** Where practical, restructure the responsive rules so the
`!important` declarations are unnecessary; otherwise leave as-is. Splitting the
stylesheet is optional.

**Reason:** `!important` often hides a specificity problem, but it is not a defect here.

**Acceptance:** If changed, desktop/mobile screenshots in `artifacts/` are visually
unchanged; if not changed, this stays a note only.

**Status:** implemented — the `!important` existed to beat the base
`.map-meta > div` rule (`app.scss:594`), which outranks a bare `.map-size` selector. The
three responsive display rules are now nested as `.map-meta > .map-size` (specificity
0-2-0), in their original media blocks, so the cascade resolves identically at every
width; all three `!important` declarations are gone and the stylesheet was not split.
Verified 16 October 2026: `npm run build` passes, `npm run test:e2e` 5/5,
`npm run format:check` clean, and full-page screenshots at 1500/1440/1000/700/390 px are
byte-identical before and after (the show/hide bands were confirmed exercised: visible

> 1100 and 481–800, hidden 801–1100 and ≤480).

---

## P4 — Test coverage gaps

### P4.1 — `exportFilename` unsafe/unicode input is untested

**File:** `src/app/rendering/export.ts:4-12`

The README documents that unsafe characters are removed, but no test covers unicode,
slashes, or an all-punctuation seed (the `|| 'dungeon'` fallback). Add a table-driven
case.

**Acceptance:** Cases for unicode, path separators, and empty-after-sanitization pass.

**Status:** implemented — `src/app/rendering/export.spec.ts` pins `exportFilename` with a
table-driven case (safe characters, NFKD-decomposed accents, `/`- and `\`-containing
seeds, punctuation-only and CJK-only seeds hitting the `dungeon` fallback, and the
64-character cap) plus a suffix case for density/revision. Expected filenames are
hand-written strings, not recomputed by the algorithm. Verified 16 October 2026:
`npm test` 19/19 (9 new), `npm run typecheck:tests` passes, Prettier clean.

### P4.2 — No golden regression baseline for generator output

**File:** `src/app/engine/generate.spec.ts:18-27`

**Evidence:** the determinism test asserts `validMap(input).toEqual(first)` — run-to-run
self-consistency only. If a change to `hashSeed`, stream keys (P2.4), or placement logic
altered every seed's output, this test would still pass.

**Proposed change:** Add a test that pins the full model (or a stable hash of it) for a
handful of representative seeds across room counts and densities to a recorded expected
value.

**Reason:** Protects the documented reproducibility contract against accidental change,
and is the prerequisite for safely refactoring P2.4.

**Limitation:** golden fixtures protect only the sampled seeds; they cannot prove that
_every_ seed is unchanged. Use several representative seeds to make an accidental
regression very likely to surface.

**Acceptance:** Changing a stream key or hash seed makes the golden test fail for the
sampled seeds.

**Status:** implemented — `generate.spec.ts` now has a "pins representative generated
models to a recorded baseline" test that SHA-256-hashes the serialized model for six
seeds spanning 4–8 rooms and all densities (`mosslit-sanctum`, `amber-vault`,
`forgotten-library`, `lantern-watch`, `moss-and-memory`, `silver-crypt`). It was landed
before the P2.4 refactor and confirmed unchanged after it.

### P4.3 — Untested boundary branches

**File:** `src/app/app.ts:63-73`, `src/app/engine/validation.ts:5-13`,
`src/app/engine/topology.ts:76-112`, `src/app/engine/generate.ts:100-128`

Add targeted assertions for:

- `stepRooms` clamping at `4`/`8` and invalid drafts (see P1.1).
- `validateSettings` with an invalid density string.
- Ambiguous openings producing no threshold.
- The extra-connection branch in `generate.ts:100-128`.

Note: some of these paths execute inside the 45-seed batch but without targeted
assertions, so failures would be hard to diagnose.

**Acceptance:** Each path has a dedicated assertion, not just incidental coverage.

**Status:** implemented — the `stepRooms` bullet was already satisfied by P1.1's
`src/app/room-count.spec.ts` (clamping at `4`/`8` plus empty/fractional/invalid drafts).
The other three paths now have dedicated assertions: `generate.spec.ts` pins invalid
density strings (`Dense`, `balanced`, `''`) to the exact `Choose a valid decoration
density.` error, and adds a shortcut-branch test asserting `batch-1` (5 rooms) yields
`roomCount` distinct connections while the spanning-tree-only `mosslit-sanctum` yields
`roomCount - 1`; that test also rebuilds the pre-shortcut carve via `carveLayout` and
measures BFS center-to-center distance for the extra pair (rooms 3→4: 25 tiles before,
11 after, a 14-tile gain), asserting the gain meets the generator's 10-tile threshold;
the new `src/app/engine/topology.spec.ts` covers `findThresholds` with a
mid-wall two-tile opening (exact threshold record, north and west), the ambiguous cases
(corner-start `offset - run === 0`, corner-end `offset === length`, one- and three-wide
runs, empty wall), and an opening absorbed into a neighboring room's floor. Verified
16 October 2026: `npm test` 23/23 (4 new), `npm run typecheck:tests` and
`npm run format:check` clean, and each assertion was mutation-checked (loosening
`offset - run > 0`, disabling the extra connection, and accepting `Dense` each fail the
dedicated test).

### P4.4 — Renderer determinism (partially covered)

**File:** `src/app/rendering/dungeon-renderer.ts`, `tests/forge.spec.ts:45-50`

**Correction to the earlier draft:** determinism is **not** absent — the browser suite
renders the same map twice and compares export bytes. A dedicated unit test would
broaden that (grid on/off, additional maps) and localize failures, but this is a
nice-to-have rather than a gap.

**Proposed change:** Optionally render the same `Dungeon` twice via `@napi-rs/canvas`
(already a dev dependency) and compare bytes.

**Acceptance:** A unit test compares two renders of one map; no behavior change.

**Status:** implemented — `src/app/rendering/dungeon-renderer.spec.ts` renders each of
four maps (the showcase fixture plus generated 4/6/8-room maps across all three
densities) twice at export resolution and compares PNG bytes with one test per map, so a
failure localizes; two further tests pin a grid-off double render and assert grid-on
differs from grid-off, guarding the equality assertions against passing vacuously.
Comparisons use `Buffer.equals` rather than `toEqual`: the mutation check showed vitest's
failing-diff path on full-map Buffers stalls for minutes, while `Buffer.equals` fails in
~0.5 s. Mutation-checked: injecting `Math.random()` into a fill color fails all five
equality tests (and the grid test still passes). Verified 16 October 2026: `npm test`
29/29 (6 new), `npm run typecheck:tests` and `npm run format:check` clean; no
application source changed, so no production rebuild was needed.

### P4.5 — No coverage threshold

**File:** `vitest.config.ts`

Consider a `coverage.thresholds` entry once a coverage provider is added, to lock in the
current baseline. Optional.

---

## Closed — reviewed, no change recommended

### C.1 — Keep the density budget table duplicated (do **not** import it into tests)

**File:** `src/app/engine/decoration.ts:6` vs `src/app/engine/generate.spec.ts:48-53`

**Earlier draft:** export `budgets` and import it into the test. **Reversed.**

The `5%/10%/15%` limits are a **specification**. If the test imported the production
constant, an accidental budget change in `decoration.ts` would silently update the test
expectation too, and the test would no longer protect the documented limit. Independent
expected values are the stronger oracle.

**Action:** leave the duplication. If the intent needs recording, note the paired values
in the README rather than in code (the brief forbids code comments —
`encounter-map-forge-brief.md:37`), or give the test's expectation a descriptive name.

### C.2 — Prop filtering in the renderer

**File:** `src/app/rendering/dungeon-renderer.ts:285-294`

The array is filtered three times to express the drawing layers, but this does not run
during ordinary pan/zoom (preview artwork is cached), so there is no demonstrated cost,
and the current form reads clearly. Left as-is.

### C.3 — `Preview` observer teardown is already correct

**File:** `src/app/preview/preview.ts:48-62`

See P2.5. The existing `ngOnDestroy` cleanup is correct. Only an optional `DestroyRef`
reorganization is available — note that `AfterRenderRef.destroy()` cancels the scheduled
callback and would leave an already-created `ResizeObserver` connected, so it is not a
substitute for `observer.disconnect()`.

---

## Optional — Tooling

### O.1 — No linter is configured

Prettier is present, but there is no ESLint. Angular ESLint can catch some template and
TS pitfalls, but adoption should be justified by naming the specific rules that would
have fired — no specific rule has been identified here, including for the P3.1 checkbox
pattern. Adopt only if the team wants another gate; no defect requires it.

---

## I03 — Dungeon character presets

**Implemented 16 October 2026.** Adds four decoration presets — Mosslit, Crypt,
Storehouse, Sanctuary — each with its own prop palette, wall accents, floor/wall colour
tones, and sconce glow. A preset change preserves layout, connections, thresholds,
landmarks and floor texture.

- `GENERATOR_VERSION` bumped from `1.0.0` to `2.0.0` because the decoration stream key
  now includes the preset name, which changes every seed's decoration output (including
  Mosslit). The version is the authoritative compatibility marker.
- New props: `sarcophagus` (blocking), `vine` (non-blocking), `broken_column`
  (blocking). Blocking classification is centralized in `isBlockingProp`.
- `pickProp` uses a nonempty tuple constraint `[PropChoice, ...PropChoice[]]` instead of
  an undefined cast for empty arrays.
- Export filename includes the preset: `encounter-{seed}-{preset}-{density}-r{revision}-v{version}.png`.
- Golden hashes updated for v2.0.0; three new preset entries added to the pin test.
- Playwright test added for preset selection, pending drafts, and export filename.
- Per-preset renderer determinism tests added (four new).
- README updated with preset usage, reproduction instructions (now requires preset),
  version history, and blocking-prop descriptions.

Verified: `npm test` 37/37, `npm run build` clean, `npm run typecheck:tests` passes,
`npm run format:check` clean, `npm run test:e2e` 6/6. Visual review via
`artifacts/contact-sheet.png` and per-seed `artifacts/review-*.png` / `detail-*.png`.

---

## I01 — Forest clearing maps

**Implemented 16 October 2026.** Adds a second real map type: a connected forest clearing
with a usable path between two edges, clustered trees, sparse rocks, and optional
undergrowth.

- `GENERATOR_VERSION` bumped from `2.0.0` to `3.0.0`. A `type: 'dungeon' | 'forest'`
  discriminator is now part of every `GeneratedMap`.
- New `ForestClearing` interface with `ForestLayout` (tiles, route, pathStart, pathEnd) and
  `ForestDecoration` (props, density, revision). No rooms, connections, thresholds, or
  presets for forests.
- New forest prop kinds: `tree`, `boulder`, `fern`, `mushroom`, `bush`, `log`, `stump`,
  `flower`. Trees are placed on non-walkable tiles near the clearing edge; blocking props
  (boulders, logs, stumps) are placed on walkable tiles and validated for connectivity.
- `generateForestClearing` creates an irregular clearing from overlapping circles, carves
  a 2-tile-wide path from one map edge to another through the clearing, and decorates
  with trees, rocks, undergrowth, and flowers. 16 retries, deterministic from seed.
- `renderForest` draws textured grass, a dirt path, clearing-edge contours, tree canopies
  (oak, pine, broad variants), rocks, ferns, mushrooms, bushes, flowers, logs, and stumps.
- Map-type selector in the UI: Dungeon / Forest radio buttons. Switching type restores
  the retained map for that type. The seed draft is shared.
- Dungeon-specific controls (rooms stepper, preset selector) are hidden when Forest is
  selected. Forest uses a simpler control set: seed, density, generate, shuffle.
- Export filename includes map type: `encounter-{seed}-forest-{density}-r{revision}-v{version}.png`
  for forests, existing format for dungeons.
- New seed streams: `forest-layout` and `forest-decoration`.
- `GeneratedMap` discriminated union in `model.ts` with `isDungeon` / `isForest` type
  guards.
- Preview and export dispatch rendering based on `map.type`.
- Preview aria-label adapts to map type.
- New `tree` icon for the forest map type.

Tests added:

- Forest generation: determinism, golden baseline (6 seeds), 30-seed batch with topology
  and decoration invariants, shuffle/density preservation, invalid settings rejection,
  seed trimming, open-space minimums (7 new tests).
- Forest renderer: determinism (3 maps, grid on/off), grid toggle changes bytes, density
  produces different renders (4 new tests).
- E2E: map-type switching between dungeon and forest, seed preservation, export filename
  for forest maps (1 new test).

Golden hashes updated for v3.0.0 (dungeon `type` field changes serialization).

Verified: `npm test` 52/52, `npm run build` clean, `npm run typecheck:tests` passes,
`npm run format:check` clean, `npm run test:e2e` 7/7.

### Bug fixes

**P1 — Forest shuffle/density-change blocking route (fixed).**

- All blocking props (including logs) now go through connectivity checks and respect the shared budget
- `decorateForest` stores the carved route in `ForestLayout.route` and uses it for prop exclusion
- Final validation after decoration ensures connectivity between the path endpoints
- `shuffleForestDetails` and `changeForestDensity` validate the result and revert if connectivity is broken
- Added test: shuffle and density changes maintain connectivity across 20 seeds × 3 densities × 5 revisions

**P1 — Type switching discards current map (fixed).**

- Added `lastDungeon` and `lastForest` signals to store per-type maps
- `selectMapType` now restores the last map for the selected type instead of regenerating
- All generation, shuffle, density, and preset changes save to the per-type storage
- E2E test updated to verify: Crypt dungeon at r1 → Forest → back to Dungeon preserves Crypt r1

**P2 — Failed switches leave contradictory UI state (fixed).**

- `selectMapType` now uses `run()` for operation locking and error handling
- Type and map are committed together after success
- Failures are reported via the error signal

**P2 — Type switching bypasses operation locking (fixed).**

- Map-type fieldset and radio inputs are disabled when `busy() !== null`
- `selectMapType` checks `busy()` and returns early if already busy
- Uses the existing `run()` mechanism for consistent error handling

**P2 — Route needs explicit representation (fixed).**

- `ForestLayout` now includes `route: readonly number[]` storing the carved path tiles
- `carve` records every tile visited during carving (not just newly carved tiles), then deduplicates
- This ensures the route includes both path and clearing tiles for complete path representation
- `carvePath` returns the deduplicated route tiles
- `isPathTile` in the forest renderer uses the route set instead of guessing from neighbors
- Props are excluded from route tiles during decoration
- Added test: route tiles connect the path start to its end (verified via BFS across 20 seeds)

**Strengthened regression assertions.**

- Route connectivity test: BFS between path endpoints through route tiles
- Shuffle/density test: verifies full remaining-floor connectivity, blocking budgets, revision increments, and requested density preserved
- Test coverage: 20 seeds × 3 densities × 5 revisions for shuffle, plus density change verification

All fixes verified with reproduction cases from the bug reports.

Forest path endpoints are now unmarked in previews and exports. The model uses
`pathStart` and `pathEnd`; the forest legend, styling, documentation, and model
baselines match. A renderer regression test checks that reversing the endpoints
preserves the artwork. Verified: 53 unit tests, 7 browser tests, production build,
test type-checking, formatting, and desktop/mobile Chromium inspection.

---

## I02 — Save and reopen maps

**Implemented 16 October 2026.** Adds a browser-local map library with explicit save, open,
rename, duplicate, favorite, and delete, plus versioned JSON backup export/import.

- New `src/app/save/save-format.ts` (pure): `SavedMap` record and `SaveBundle` types,
  `SAVE_FORMAT_VERSION = '1.0.0'`, `parseSavedMap`, `parseBundle`, `serializeBundle`,
  `makeSavedMap`, `defaultMapName`, and `mapSummary`. `isUsableMap` shape-checks an untrusted
  map and dispatches to `validateDungeon` / `validateForest` (the latter newly exported from
  `forest-generate.ts`) inside a defensive try/catch, so malformed imports never crash.
- New `src/app/save/save-store.ts`: an injectable store holding the saved-map signal and
  persisting to `localStorage` (`encounter-map-forge.saves`). Writes happen before the signal
  commits, so a quota failure leaves the list unchanged; invalid/foreign records are dropped
  on load.
- New `src/app/rendering/thumbnail.ts`: renders a map to a 320 × 240 PNG data URL (8 px/tile,
  grid off) reusing the shared renderers.
- New `forge-library` component (`src/app/save/library.{ts,html,scss}`) rendered as section 03.
  It owns the save-name draft, the save/list/backup/import UI, and emits an `open` output that
  `App.openSaved` uses to restore type, map, per-type storage, seed, and room count. Favorites
  sort first, then newest-first. Two new icons (`star`, `upload`) were added to `icon.ts`.
- Saving is explicit and captures the accepted generated map, so unapplied drafts never become
  a save's identity; each record keeps the generator version (`map.version`) and the
  save-format version for forward-compatibility checks (newer-format records are rejected on
  import).

Tests added:

- `src/app/save/save-format.spec.ts`: round-trip through a backup bundle, per-record
  validation (blank/long names, invalid ids, non-data thumbnails, corrupt maps, newer save
  format), and bundle-level malformed/rejection cases.
- `tests/saves.spec.ts`: saving with a pending seed draft (save keeps the generated seed),
  opening restores the saved map and settings, refresh persistence, rename/favorite/duplicate/
  delete, and backup export → re-import round trip. One existing assertion was scoped from
  `p[role="status"]` to `.status` because the library adds a second polite status region.

Verified: `npm test` 64/64, `npm run build` clean, `npm run typecheck:tests` passes,
`npm run format:check` clean, `npm run test:e2e` 15/15. Thumbnails render at 320 × 240 and the
library introduces no horizontal overflow at 320/390/768 px viewports (checked structurally;
screenshots were captured but not manually inspected).

### Bug fixes

A second review pass found and fixed five defects before approval; each has a regression.

**P1 — Rename reloaded the application (fixed).** The rename `<form>` submitted natively.
`commitRename` now takes the `SubmitEvent` and calls `preventDefault()`. Regression:
`tests/saves.spec.ts` renames a map while a forest is open with a pending seed draft and
asserts both the forest map and the draft survive.

**P1 — Long names vanished after refresh (fixed).** `duplicate` appended `" (copy)"` past the
64-character limit, and `defaultMapName` for a long seed did the same; the loader rejected the
oversized record on reload. One name policy now lives in `save-format.ts`:
`normalizeName`, `duplicateName` (reserves room for the suffix), and a seed-length-capped
`defaultMapName`, applied by `makeSavedMap`, `rename`, and `duplicate`. Regressions: unit cases
for all three helpers plus an e2e that duplicates a 64-character name and reloads.

**P1 — Import validation accepted maps that cannot render (fixed).** `isMapShape` checked only
outer structure; the engine validators assume typed data. `isGeneratedMap` now structurally
validates every renderer/generator field (tile field, rooms/connections/thresholds/landmarks,
props with known kinds and finite coordinates/variation, valid density/preset/revision, forest
route, non-empty ≤64 seed, finite surfaceSeed) before semantic validation. Version handling is
explicit: `parseSavedMap` rejects non-numeric record versions and `parseBundle` rejects a
newer or malformed bundle `saveFormatVersion` (e.g. `99.0.0`, `banana`). Regressions: unit
cases for `Unknown` preset, invalid density, empty seed, negative revision, unknown prop kind,
missing forest route, and bundle/record version policies.

**P2 — Duplicate IDs within a backup (fixed).** `importMaps` only checked incoming IDs against
existing records, so two same-id records both landed and deleting one removed both. A pure
`uniqueById` helper dedupes within the batch and against existing ids; `importMaps` returns the
added and skipped counts, which the import notice reports. Regression: unit cases for
`uniqueById`.

**P2 — Incomplete error handling (fixed).** Only `save` caught storage failures; rename,
duplicate, favorite, and delete surfaced console errors with no UI message (though state was
preserved). All mutating actions now go through a `runStore` guard that reports the storage
error; `App.openSaved` also clears any prior generation error. Regressions: e2e cases for a
quota failure on duplicate (reported and library unchanged) and for opening a saved map
clearing a stale generation error.

**Test setup (fixed).** `tsconfig.tests.json` did not include `src/app/save/**`, so
`save-format.spec.ts` was type-checked only indirectly. The glob is now included.

**P1 — Prop variation needed a range check (fixed).** `isProp` accepted any finite `variation`,
so a value like `1e308` reached the fern renderer and multiplied into an infinite loop count.
`isProp` now requires a unit fraction (`0 <= variation < 1`), matching generated values.
Regressions: unit cases for negative, `1`, `1.5`, and `1e308` (rejected) and `0` / `0.999`
(accepted).

**P2 — Forest routes needed semantic validation (fixed).** `isForestLayout` accepted `route: []`
and `route: [0]` (a solid tile), so an imported forest could lose its visible dirt path and its
placement protection. `validateForest` now calls a `routeIsValid` helper that requires a
nonempty route made only of walkable tiles that contains and connects both path endpoints
(BFS restricted to route tiles). Regressions: unit cases for an empty route, an off-path tile,
a route missing an endpoint, and a route with only the two endpoints.

## Configure, then generate — 19 October 2026

Seed, rooms, character, and density now stay pending until Generate is clicked.
Randomize seed only updates the draft. Generate is disabled when there are no
pending settings, and Reset changes restores the displayed map's accepted settings.
Each map type retains its own draft, including invalid room input, when switching.
Opening a saved map resets the controls to that map's accepted settings.

When Generate is clicked, seed or room changes create a new layout at revision 0;
appearance-only changes preserve layout, surface texture, and revision. Shuffle
remains immediate and uses accepted settings without applying pending edits. Saves
and exports continue to use the displayed map.

Verified: 64 unit tests, 19 browser tests, production build, test type-checking,
formatting, and desktop/mobile Chromium inspection. New browser regressions cover
pending settings, combined generation, appearance preservation, reset and validation,
per-type drafts, saved-map restoration, and forest seed randomization. A direct
Chromium check confirmed preview artwork stays byte-identical while editing settings
or randomizing a seed, until Generate is clicked.

---

## I19 — Forest character presets

**Implemented 19 October 2026.** Adds a Character control for Forest — Verdant woodland (default,
the familiar green forest), Autumn grove, Ancient pines, and Fey glade — each with its own prop
mix, tree shapes and colors, ground cover, and atmosphere. A character change preserves the
clearing layout, carved route, path endpoints, surface seed, and detail revision; Shuffle uses
the accepted character and leaves pending drafts untouched.

- `GENERATOR_VERSION` bumped from `3.0.0` to `4.0.0` because the forest decoration stream key now
  includes the character name, changing every seed's forest decoration output (including
  Verdant). The version is the authoritative compatibility marker.
- `ForestCharacter`, `ForestSettings.character`, and `ForestDecoration.character` added;
  `changeForestCharacter` mirrors `changeForestDensity` and reverts on validation failure.
- Character profiles (`src/app/engine/forest-generate.ts`) hold edge/interior prop rolls,
  tree counts, and undergrowth/mushroom/log counts per density. Verdant's rolls reproduce the
  previous probabilities exactly. Blocking budgets, route exclusion, and connectivity checks are
  shared and unchanged.
- Rendering (`src/app/rendering/props.ts`, `src/app/rendering/forest-renderer.ts`): a
  `ForestPalette` per character drives tree themes (variants oak/pine/broad plus a new curved
  three-lobe `fey` variant), ground tones, edge contours, grid tint, boulder/log/stump moss,
  bush/fern/flower tones, and mushroom caps (Fey caps glow faintly). Verdant's palette is the
  previous artwork; the per-tile ground RNG call order is unchanged so Verdant renders byte-
  identically to the pre-character renderer for identical props.
- Save format normalizes v3 forest decorations without a `character` to Verdant before
  validation, preserving their artwork. Current forests require a known character. Forest
  summaries include the character; default names remain seed-based. New records and backups
  use save-format 2.0.0 so older readers reject them rather than misrendering their artwork.
  Format-1 records, including the initial I19 character records, are upgraded on load or import
  without regenerating their models. The next library write persists upgraded record versions.
- Export filename includes the character: `encounter-{seed}-forest-{character}-{density}-r{revision}-v{version}.png`.
- UI: the Character fieldset now shows forest characters with full names (Verdant woodland,
  Autumn grove, Ancient pines, Fey glade) and per-character descriptions; the style note,
  preview aria-label, and map summary reflect the accepted character.
- Tests: per-character golden model pins, an 8-seed × 4-character connectivity/budget batch,
  character-change preservation and round-trip tests, invalid-character rejection, per-character
  renderer determinism and difference tests, legacy/unknown save-format cases, and a browser
  test for character drafts, generation, shuffling, and export filenames.

Verified 19 October 2026: `npm test` 76/76, `npm run build` clean, `npm run typecheck:tests`
passes, `npm run format:check` clean, `npm run test:e2e` 19/19. Visual review via
`artifacts/forest-{Verdant,Autumn,Pines,Fey}.png`, close-ups, `artifacts/forest-characters.png`,
and browser screenshots of a pending and an applied Autumn change (layout confirmed unchanged).

Review follow-up: added three frozen v3 saves from the pre-I19 code and six independent raw-pixel
hash baselines (three densities and revisions, grid on/off) to protect legacy artwork. Save-format
regressions cover version-2 records/backups, format-1 migration, current-character validation,
and the initial I19 records. Browser regressions cover legacy import/reopen/export and a Fey
backup round trip. README now records the fixture provenance and explicitly explains that
redecorating a legacy layout uses current streams; preserve the full snapshot in a backup for
exact reproduction.

Follow-up verified 19 October 2026: `npm test` 89/89, `npm run test:e2e` 21/21,
`npm run build`, `npm run typecheck:tests`, and `npm run format:check` pass. Independent checks
against the pre-I19 code confirm that its reader rejects both new format-2 records and backups,
while nine actual v3 forest snapshots still render to identical PNG bytes after migration.
