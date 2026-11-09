# Encounter Map Forge — Architecture review

Originally reviewed 19 October 2026 against commit `049374c` and the working-tree documentation. **Completion audit: 21 October 2026 — AR01–AR12 are implemented.** Original findings, proposals, line references, and per-item verification records are retained as historical context; they are not an outstanding backlog. Current status and future maintenance guidance are identified separately.

## Overall assessment

The project retains a clear separation between Angular UI, procedural generation, rendering, and persistence. The completed work gives maps and drafts one scoped state owner, separates the settings and map panels, and divides the forest engine, artwork, and save validation by responsibility. Shared algorithms and browser helpers now have explicit owners without introducing a generic framework.

All twelve review items are complete, including AR08's workbench presentation catalog. The user confirmed that the hosted GitHub Actions workflow succeeds on 21 October 2026; this confirmation is user-provided, not an independent remote inspection.

Future shared controls, additional services, and ESLint rules remain conditional choices for demonstrated needs. They are not unfinished acceptance criteria for this review.

## Scope and evidence

The original review covered all 22 production TypeScript files, their component templates and styles, engine/rendering/save tests, Playwright suites, render-review scripts, bootstrap/build/test configuration, the brief, README, and existing improvement/idea documents. Generated artifacts and dependency internals are not part of the source architecture assessment.

Original baseline, checked on 19 October 2026:

- `npm test`: **89/89 passed**.
- `npm run test:e2e`: **21/21 passed**, Chromium.
- `npm run build`: passed; initial bundle approximately **250.52 kB raw**, within the configured budget.
- `npm run typecheck:tests`: passed.
- A static scan of local imports found **no cycles** among the production TypeScript modules. Engine modules have no external imports, including Angular imports.

### Completion verification — 21 October 2026

After completing the presentation extraction:

- `npm test -- --maxWorkers=1`: **212/212 passed** across 20 files, including unchanged model and pixel baselines.
- `npm run test:e2e`: **27/27 passed**, Chromium.
- `npm run typecheck:tests`: passed.
- `npm run build`: passed; initial bundle **255.68 kB raw**, within budget.
- `npm run format:check`, the separate Prettier check for this document, and `git diff --check`: passed.
- A source comparison confirmed all **19 extracted labels/descriptions** match the original component.
- All twelve AR sections and local document links were checked for completeness and valid targets.

Earlier per-item counts refer to their implementation dates, not the current suite. The conflicting historical AR08 unit totals have been removed rather than treated as a current result. This final extraction changes no templates, styles, or artwork; no separate screenshot comparison was performed.

Passing checks establish a useful starting point; they do not prove that every error path, accessibility concern, or performance scenario has been exercised. The original assessment did not establish a new visual baseline or profile browser performance; later implementation records below describe their own visual checks.

### Original file-size snapshot — 19 October 2026

Counts include blank lines and formatting. These are pre-refactor sizes, not current sizes or proposed limits.

| Area                                                    |           Original size | Assessment                                                                          |
| ------------------------------------------------------- | ----------------------: | ----------------------------------------------------------------------------------- |
| `app.ts` / `app.html` / `app.scss`                      | 419 / 287 / 1,118 lines | Several UI and workflow responsibilities combined; highest-value extraction.        |
| `preview.ts` / template / styles                        |          192 / 41 / 136 | Cohesive viewport behavior; keep together.                                          |
| `save/library.ts` / template / styles                   |         173 / 121 / 345 | Cohesive library UI; extract browser download mechanics, not every row/button.      |
| `save/save-store.ts`                                    |                     100 | Already an appropriately sized service with clear ownership.                        |
| `save/save-format.ts`                                   |                     378 | Related format/validation/migration logic; manageable, but watch further growth.    |
| `engine/forest-generate.ts`                             |                     744 | Layout, decoration profiles/placement, validation, and commands share one file.     |
| `rendering/props.ts`                                    |                     962 | Drawing contract, primitives, palettes, and two families of artwork share one file. |
| Dungeon / forest renderers                              |               373 / 426 | Mostly coherent composition; some duplicated infrastructure.                        |
| Dungeon generation / decoration / validation / topology |   143 / 220 / 144 / 141 | Better separated already; a useful pattern for the forest engine.                   |

## Architectural strengths retained

- Angular components use `OnPush`, signal inputs/outputs where applicable, computed values, protected template members, and stable `@for` tracking. There are no manual subscriptions to clean up or effects copying ordinary derived state.
- `Preview` uses an effect for imperative Canvas drawing, which is a suitable boundary for an effect. It owns pan/zoom and disconnects its `ResizeObserver` through `DestroyRef`.
- The configure-then-generate distinction is explicit. Drafts and accepted map models are separate, and saving/exporting uses the accepted map.
- The engine uses plain functions, explicit seeded randomness, readonly model contracts, bounded work, and discriminated results. Mutating locally constructed arrays and RNG instances does not violate the immutable public model contract.
- Rendering does not generate maps, and the same map-type renderers produce previews, thumbnails, and exports. The restricted `DrawingContext` contract permits native Canvas testing without pretending the test canvas implements the entire browser API.
- `SaveStore` owns persistence and exposes readonly signal access. Writes happen before its state signal changes, preserving state on storage failures.
- Save parsing treats input as unknown, migrates legacy data before the current model guard, and then performs semantic validation. These checks should survive any file moves.
- Model goldens, legacy pixel baselines, independent traversal/budget assertions, and browser workflow tests provide substantially better protection than run-to-run determinism alone.

Current names such as `app.ts`, `preview.ts`, and `library.ts` are valid modern Angular naming. The project does not need `.component.ts` suffixes or NgModules to become idiomatic. The [Angular style guide](https://angular.dev/style-guide) supports descriptive matching filenames, related files kept together, feature-oriented organization, and focused components.

## Completed review items

The identifiers below belong to this review and are separate from the historical `P…` improvement identifiers. **P2** means worthwhile corrective or structural work; **P3** means lower-priority cleanup or a future growth trigger. All listed items are now implemented. Original proposals are retained below each implementation record to explain the scope and acceptance criteria.

| ID   | Priority | Recommendation                                                                     | Main benefit                                                                    |
| ---- | -------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| AR01 | P2       | Give the workbench one state owner — **implemented**                               | Remove synchronized copies and isolate workflow transitions.                    |
| AR02 | P2       | Extract settings and map-panel components with their styles — **implemented**      | Separate UI responsibilities and reduce root styling scope.                     |
| AR03 | P2       | Model drafts and settings by map type — **implemented**                            | Preserve raw input while removing irrelevant settings from each branch.         |
| AR04 | P2       | Split forest generation into domain modules — **implemented**                      | Separate layout, decoration, and validation changes.                            |
| AR05 | P2       | Split prop artwork and rendering palettes — **implemented**                        | Reduce coupling between dungeon and forest artwork.                             |
| AR06 | P2       | Share render dispatch and boundary tracing — **implemented**                       | Keep rendering infrastructure consistent across consumers.                      |
| AR07 | P3       | Share production grid traversal and seeded shuffling — **implemented**             | Remove substantial algorithm duplication without weakening tests.               |
| AR08 | P2       | Consolidate production option/constraint definitions selectively — **implemented** | Prevent parser, form, and engine rules from drifting.                           |
| AR09 | P2       | Share Blob download mechanics and complete library feedback — **implemented**      | Remove duplicated browser I/O and cover an error-handling gap.                  |
| AR10 | P2       | Add focused state/store tests and broaden test-source discovery — **implemented**  | Make extraction failures easier to locate and prevent new folders being missed. |
| AR11 | P3       | Keep save-format decomposition proportional — **implemented**                      | Preserve a clear validation boundary without scattering it prematurely.         |
| AR12 | P3       | Keep shared UI and tooling additions small and justified — **implemented**         | Improve consistency without creating an internal framework.                     |

### AR01 — Give the workbench one state owner

**Implemented 19 October 2026.** [WorkbenchSession](src/app/workbench/workbench-session.ts) is provided by `App` and owns one private session state containing accepted maps, active type, and per-type drafts. Its public signals are computed and readonly. Opening, generating, resetting, switching, and shuffling use session commands; successful generation commits its map and draft together, while rejected or throwing operations leave the accepted state available for retry. Each initial map is generated once per session. `App` retains the grid, busy lock, attempted/error/status presentation, UI yielding, and export coordination. Its source shrank from 419 to 281 lines; templates, styles, engine algorithms, rendering, and save formats are unchanged.

Added [14 focused transition tests](src/app/workbench/workbench-session.spec.ts), covering initialization counts, independent injector instances, raw/independent drafts, reset, generation, appearance changes, shuffle, retained maps, opening saves, failed generation, rejected combined appearance changes, and retry after exceptions. Added the new workbench folder explicitly to `tsconfig.tests.json` so these tests are type-checked. AR03 subsequently completed the draft-type redesign, and AR10 added the store tests and replaced the explicit source-folder entries with recursive discovery.

Verified: `npm test` **103/103**, `npm run test:e2e` **21/21**, production build, test type checking, and formatting. Existing model goldens and legacy rendering baselines pass without changes.

**Original evidence (19 October 2026):** [app.ts](src/app/app.ts), especially lines 112–151 and 237–419. `mapType`, `map`, `lastDungeon`, `lastForest`, and per-type drafts are owned together, but the current accepted map is also stored in the retained-map fields. Switching, opening, generating, and shuffling must keep those values synchronized. Initialization even generates the initial dungeon twice.

This is currently working. The risk is the growing number of transition paths that must remember the same bookkeeping.

**Original proposal:** introduce a `WorkbenchSession` service provided at the workbench/root component, rather than as a global singleton. Let it own the active type, accepted map per type, per-type drafts, and the commands that change those values. Compute the displayed map from the accepted-map collection and active type. Expose readonly state and named commands; do not expose writable maps to every child.

Keep grid and viewport state in the UI unless another actual consumer needs them. The existing operation lock/status/error handling can remain in the container initially. Do not create a second service containing duplicate busy or draft state. If operation coordination later moves, move ownership completely and preserve the existing yield/error/finally behavior.

**Acceptance criteria:** one accepted-map source per type; one initial generation per type; switching/opening/generation/shuffling cannot leave stale retained maps. Independent drafts, raw room input, reset, accepted-setting exports, and error recovery retain their current behavior. Transition tests should exercise commands without requiring a rendered page.

Component-level service scope follows Angular's [hierarchical injection model](https://angular.dev/guide/di/hierarchical-dependency-injection). `SaveStore` can remain root-scoped because the library is application-wide persistence.

### AR02 — Extract two meaningful UI components and move their styles

**Implemented 20 October 2026.** Added [SettingsPanel](src/app/workbench/settings-panel/settings-panel.ts) and [MapPanel](src/app/workbench/map-panel/map-panel.ts), with their own templates and responsive styles. Settings inputs cover the accepted map, raw draft, pending state, and UI operation/validation flags; typed outputs request draft edits, map-type changes, generation, randomization, reset, and shuffle. The map panel receives the accepted map, grid, and disabled state, emits grid changes, and owns the existing `Preview` integration and generated-map summary. Neither component injects the session/store or creates another writable settings state.

The components use native `<aside forge-settings-panel>` and `<section forge-map-panel>` hosts, preserving landmarks, DOM layout, label/description IDs, and the tablet grid's direct children. Panel rules, including their media queries, moved into component styles using `:host`. Shell layout, export/message rows, and library integration remain in `App`; no global style overrides or `::ng-deep` were introduced. Root TypeScript/template/styles shrank from 281/287/1,118 to 149/85/399 lines. AR03 and AR12 subsequently completed the draft redesign and settings style consolidation.

Added [three browser regressions](tests/panels.spec.ts) for landmark/description links and native keyboard submission/grid control, disabled controls during deferred PNG encoding and draft-preserving recovery, and desktop/tablet/mobile panel flow for both map types. Verified **103/103 unit tests**, **24/24 browser tests**, production build, test type checking, and formatting. No engine, renderer, session, persistence, or saved-format code changed.

Visual verification in Chromium: **27 full-page before/after captures were pixel-identical**, with identical panel bounds for dungeon and forest views at widths 1500, 1440, 1101, 1100, 801, 800, 768, 651, 650, 481, 480, 390, and 320 px, plus an invalid draft at 800 px. Tablet and mobile captures were inspected visually. Ignored review artifacts are in `artifacts/ar02/before`, `artifacts/ar02/after`, and `artifacts/ar02/comparison.json`. These sampled checks do not establish equivalence in other browser engines or every possible UI state.

**Original evidence (19 October 2026):** [app.html](src/app/app.html) contains settings, a generation form, detail actions, accepted-style information, the preview frame/header/summary, export controls, feedback, and the library. [app.scss](src/app/app.scss) styles all those areas plus the site shell and their responsive variants.

**Original proposal:** extract a `SettingsPanel` containing the map-type selector, generation form, detail action, and accepted-style note. Extract a `MapPanel` containing the map header, grid control, existing `Preview`, and generated-map summary. Keep page composition, library integration, and initially the export/message rows in `App`.

Children should receive readonly, coherent view data and emit typed user intentions. They should not each recreate drafts or directly change persistence. Keep separate dungeon/forest branches inside `SettingsPanel` until their unique controls become substantial enough to justify further components. Avoid a long chain of one-field wrappers.

Move component-owned styles with the markup. Retain the page grid, header/intro/footer, and shell breakpoints in the container. Merely moving SCSS into partials would shorten a file without fixing ownership.

**Acceptance criteria:** settings changes still wait for Generate; native form submission and validation associations survive. Check the new component hosts against the 800 px settings grid and direct-child selectors. Preserve desktop/mobile layout, keyboard focus, disabled controls, and summary IDs used by Canvas accessibility. Use component styles and explicit host layout, rather than `::ng-deep` to reach into children.

### AR03 — Use map-specific drafts and pure settings conversion

**Implemented 20 October 2026.** Added [map-specific draft types and pure conversion functions](src/app/workbench/settings-draft.ts). `SettingsDrafts` stores a `DungeonDraft` and a `ForestDraft`; the active draft is a discriminated union. Dungeon drafts contain seed, raw room text, density, and preset; forest drafts contain seed, density, and character. Accepted-map factories restore only the relevant fields. `parseDraft` delegates domain validation to the existing validators and retains the room-text syntax check; its result narrows to the appropriate generator settings without an intersection or casts. Raw input is preserved on rejection; seed trimming remains the generator's responsibility.

`WorkbenchSession` derives validation from the parsed draft and applies each settings branch to its corresponding accepted map. Settings-panel inputs and edit outputs use the same draft contracts, with `@let` and discriminator checks providing template narrowing. Edits identify their map type, and the session ignores edits for an inactive type. Reset, save opening, shuffle, appearance-only changes, layout generation, failure recovery, and independent per-type retention preserve their existing behavior.

Added [20 pure conversion tests](src/app/workbench/settings-draft.spec.ts) covering exact settings shapes, raw room syntax/bounds, seed validation/correction, error precedence, immutable inputs, and accepted-map restoration. Updated the existing session tests without weakening their transition assertions, added two inactive-type edit tests, and strengthened generation tests to verify exact arguments and that the other generator is not called. Verified **125/125 unit tests**, **24/24 browser tests**, production build, test type checking, and formatting. Existing browser tests for blank/fractional rooms, stepping, correction, configure-then-generate, save/open, and export passed unchanged.

Visual verification in Chromium: **27 full-page captures were pixel-identical to the completed AR02 baseline**, with identical panel bounds at its 13 sampled widths (320–1500 px), covering dungeon/forest views and an invalid draft. Inspected the forest tablet capture. Ignored artifacts are in `artifacts/ar03/after` and `artifacts/ar03/comparison.json`; the comparison uses `artifacts/ar02/after` as the baseline. These checks cover sampled states in Chromium only. No engine, renderer, saved-format, dependency, or style changes were needed.

**Original evidence (19 October 2026):** [app.ts](src/app/app.ts), lines 38–44, 67–74, and 344–365. Every draft carries rooms, a dungeon preset, and a forest character. Generation constructs `DungeonSettings & ForestSettings`, even though a map uses only one settings shape. [model.ts](src/app/engine/model.ts) already defines a discriminated `MapSettings` union, currently unused.

**Original proposal:** when extracting state, use distinct dungeon and forest draft shapes, stored in a typed per-map-type collection. Convert and validate the active draft into the appropriate settings branch using plain functions. Keep `rooms` as raw text until submission so blanks and fractions continue to behave as designed.

This improves the interface contract; the existing intersection is not itself a runtime bug. Do not introduce casts to make a generic settings object fit every generator, and do not collapse draft values into the accepted map model.

**Acceptance criteria:** forest drafts do not require irrelevant room/preset fields, dungeon drafts do not require a forest character, and each generator receives its correct settings type. Existing stepper and invalid/corrected draft tests pass unchanged in meaning.

### AR04 — Split the forest engine along existing responsibilities

**Implemented 20 October 2026.** [forest-generate.ts](src/app/engine/forest-generate.ts) is now the composition entry point (117 lines), keeping `ForestLimits`, `generateForestClearing`, and the shuffle/density/character operations. Clearing/path construction and BFS connectivity moved to [forest-layout.ts](src/app/engine/forest-layout.ts) (`createClearing`, `pointOnEdge`, `oppositeEdge`, `carvePath`, `forestDistances`, `isConnected`, the `Edge` type, and `NEIGHBORS_4`). Character profiles, density budgets, and the three placement routines moved to [forest-decoration.ts](src/app/engine/forest-decoration.ts) behind one exported `decorateForest`. `validateForestLayout`, `validateForest`, `validateForestSettings`, and route checking moved to [forest-validation.ts](src/app/engine/forest-validation.ts). Function bodies were moved unchanged; `NEIGHBORS_8` moved with tree placement, its only consumer.

The dependency graph is one-way: layout depends only on `model`/`random`; decoration and validation depend only on `model`/`random`/`forest-layout`; the entry point composes all three. [save-format.ts](src/app/save/save-format.ts) and [settings-draft.ts](src/app/workbench/settings-draft.ts) now import `validateForest`/`validateForestSettings` from `forest-validation` instead of the generation module, so import validation no longer pulls in orchestration. No `ForestService`, class hierarchy, or algorithm change was introduced, and `GENERATOR_VERSION` and every recorded golden value are untouched.

Verified: **125/125 unit tests** — including the full-model golden hashes for six seeds, every character for one seed, and the 30-seed invariant batches — **24/24 browser tests**, production build, test type checking, and formatting. No generator-version bump or replacement golden values were needed.

**Original evidence (19 October 2026):** [forest-generate.ts](src/app/engine/forest-generate.ts) contains clearing/path construction, BFS connectivity, character profiles, three placement routines, validation, and the public generate/change/shuffle operations. [save-format.ts](src/app/save/save-format.ts) imports that generation module simply to validate imported forests.

**Original proposal:** use plain TypeScript modules such as `forest-layout.ts`, `forest-decoration.ts`, and `forest-validation.ts`, leaving `forest-generate.ts` as the composition entry point. Initially keep character profiles with forest decoration; extract a profile file only if that improves navigation. Preserve a one-way dependency graph: validation and decoration must not import the public generation entry point.

These responsibilities already exist in the file. This is a module extraction, not a reason to make an Angular `ForestService`, introduce an engine class hierarchy, or redesign generation.

**Acceptance criteria:** import validation depends on validation, not orchestration. Existing public behavior and all current model hashes remain unchanged. Preserve candidate iteration, random draws, retries, route exclusion, blocking budgets, and connectivity checks exactly. A structural move should not require a generator-version bump or replacement golden values.

### AR05 — Separate prop drawing, forest palettes, and drawing contracts

**Implemented 20 October 2026.** [props.ts](src/app/rendering/props.ts) is now a 59-line `drawProp` entry point: it keeps the shared save/translate/line-width framing and dispatches through a typed function table, `Readonly<Record<PropKind, PropDrawer>>`, so a future `PropKind` cannot compile without an explicit drawing choice. The previous final `else` is now an explicit `drawSconce`. Drawing code moved unchanged into [drawing-context.ts](src/app/rendering/drawing-context.ts) (the restricted canvas contract), [drawing-primitives.ts](src/app/rendering/drawing-primitives.ts) (`path`), [dungeon-props.ts](src/app/rendering/dungeon-props.ts) (nine dungeon drawers), and [forest-props.ts](src/app/rendering/forest-props.ts) (eight forest drawers). All four character palettes and the tree themes now live in [forest-palette.ts](src/app/rendering/forest-palette.ts); the Autumn/Pines/Fey palettes moved out of [forest-renderer.ts](src/app/rendering/forest-renderer.ts) behind one exported `FOREST_PALETTES` record, so palette ownership is no longer split between the renderer and the shared prop implementation, and the renderer keeps only its atmospheres. The dependency graph stays one-way: context ← primitives/prop/palette modules ← dispatch ← renderers; leaf modules import no renderer.

Before the move, [render-baseline.spec.ts](src/app/rendering/render-baseline.spec.ts) recorded 15 representative pixel baselines: the showcase and an all-prop-kinds synthetic dungeon under every preset, and per-character generated plus all-prop-kinds synthetic forests, with grid-on and grid-off variants. The synthetic maps list every prop kind explicitly because generated maps do not deterministically place each kind for a given seed or preset. Verified after the move: **140/140 unit tests** — including these baselines and the unchanged legacy v3 hashes — **24/24 browser tests**, production build, test type checking, and formatting. Transforms, layer order, palette values, and engine/generator code are unchanged.

**Original evidence (19 October 2026):** [props.ts](src/app/rendering/props.ts) contains `DrawingContext`, the polygon primitive, tree themes, a default forest palette, the dungeon prop branches, and forest prop routines. [forest-renderer.ts](src/app/rendering/forest-renderer.ts) holds the other character palettes and atmospheres. Palette ownership is therefore split between the renderer and the shared prop implementation.

**Original proposal:** extract a small drawing-contract/primitives module, dungeon-prop drawing, forest-prop drawing, and forest rendering palette definitions. Keep a small `drawProp` entry point if retaining that API makes the move safer. Leaf palette/type modules should not import the renderer that consumes them.

The current final `else` in `drawProp` draws a sconce. Make that prop explicit and make the dispatch exhaustive, so adding a future `PropKind` cannot silently inherit sconce artwork. An exhaustive switch or typed function table is enough; a class per prop is unnecessary.

**Acceptance criteria:** unchanged transforms, layer order, palette values, and pixels. Before the move, record representative current dungeon/forest render baselines as well as keeping the existing legacy ones. Current determinism tests alone would also pass if every render changed identically.

### AR06 — Share rendering infrastructure at the rendering boundary

**Implemented 20 October 2026.** Added [render-map.ts](src/app/rendering/render-map.ts) as the single map-type drawing dispatch for preview, PNG export, and thumbnails. Its exhaustive switch narrows `GeneratedMap` to the concrete renderer without casts, and the `never` branch makes a future map type a compile-time decision. Both renderers now accept the shared [RenderOptions](src/app/rendering/render-options.ts) contract. Consumers keep Canvas creation, encoding, and their existing resolution/grid policy: preview/export use 64 pixels per tile with the chosen grid state; thumbnails use 8 pixels per tile without a grid. Preview caching, device-pixel-ratio painting, pan/zoom, Blob handling, and download behavior are unchanged.

Added [boundaries.ts](src/app/rendering/boundaries.ts) for edge construction, turn selection, contour grouping, and Canvas path tracing over the common readonly tile-field shape. The existing order and algorithm were preserved, including turn selection at diagonal contacts. Both renderers use it while keeping their own masonry/clearing-edge strokes and transforms. The identical grid path moved to `drawGrid` in [drawing-primitives.ts](src/app/rendering/drawing-primitives.ts), parameterized by the existing grid color. Floor texture algorithms, palettes, prop drawing, layer order, and generation remain unchanged. A static local-import scan found no cycles across the 36 production TypeScript modules.

Added [11 contour tests](src/app/rendering/boundaries.spec.ts) for empty fields, all four map corners, concave corners/shared floor edges, holes and opposite winding, both diagonal contact orientations, a fully walkable map, immutable input, and separate Canvas subpaths. Added [six dispatch tests](src/app/rendering/render-map.spec.ts) comparing actual pixels with each concrete renderer at export resolution with grid on/off and at thumbnail resolution. Existing independent baselines were not rewritten: all **15 AR05 pixel hashes** and the legacy forest hashes pass unchanged. Verified **157/157 unit tests**, **24/24 Chromium browser tests**, production build, test type checking, formatting, and whitespace checks.

Visual verification: **six full-page before/after Chromium captures were pixel-identical**, covering default dungeon and applied Fey forest views at 1440, 800, and 390 px. The desktop forest capture was inspected visually, and the capture run reported no browser errors. Ignored artifacts are in `artifacts/ar06/before`, `artifacts/ar06/after`, and `artifacts/ar06/comparison.json`. These checks establish preservation for sampled states in Chromium and the recorded native-Canvas fixtures, rather than every possible map/browser combination.

**Original evidence (19 October 2026):** map-type dispatch is repeated in [preview.ts](src/app/preview/preview.ts), [export.ts](src/app/rendering/export.ts), and [thumbnail.ts](src/app/rendering/thumbnail.ts). Dungeon and forest renderers separately implement the same boundary-edge construction, turn selection, loop tracing, and an equivalent grid path. Their render-option interfaces also match.

**Original proposal:** add one `renderMap(context, map, options)` function using `GeneratedMap` and the restricted drawing contract. All three consumers should use it while keeping their own resolution and grid choices. Extract shared boundary tracing into a rendering module accepting the common tile-field shape. Keep dungeon masonry and forest edge styling separate.

An exhaustive branch for the two known map types is clearer than a registration system. Keep Canvas creation/Blob conversion outside the pure drawing function.

**Acceptance criteria:** preview/export/thumbnail dispatch has one owner; consumers keep their existing resolution and grid policy. Boundary tests include corners, holes, and diagonal contacts. Both renderer baselines remain unchanged. Do not merge the distinct floor texture algorithms merely because both visit tiles.

### AR07 — Share substantial production algorithms, preserving independent test oracles

**Implemented 20 October 2026.** Added [grid-traversal.ts](src/app/engine/grid-traversal.ts) as the single production four-neighbor breadth-first distance search. The forest search body and its neighbor offsets moved unchanged; both original searches used left/right/up/down discovery order. [topology.ts](src/app/engine/topology.ts) and [forest-layout.ts](src/app/engine/forest-layout.ts) retain their `distances` and `forestDistances` names as aliases to the shared function, and the existing forest neighbor-offset export remains available. Threshold/landmark selection and forest route/connectivity rules retain their domain ownership.

Added `shuffleInPlace` in [random.ts](src/app/engine/random.ts), replacing one dungeon and five forest Fisher–Yates loops at their original call sites. The helper accepts locally owned arrays of non-null values, preserves element identity, and consumes the same inclusive `random.int(0, i)` calls in descending index order, including self-swaps. Empty/singleton arrays consume no draws. Defined falsy values are supported; current production candidate arrays contain point objects. RNG algorithms, stream keys, generator version, candidate construction/iteration, budgets, placement, and retries are unchanged.

Added [eight traversal tests](src/app/engine/grid-traversal.spec.ts) for exact shortest distances and discovery order, disconnected/diagonal-only floor, blocked and solid starts, a blocked corridor, detours, row boundaries, full-field corner distances, and unchanged inputs. Added [eight shuffle tests](src/app/engine/random.spec.ts): three shuffled-order/next-draw fixtures captured from the original loops before extraction, empty/singleton behavior, descending draw bounds, self-swaps/identity, and falsy values. [Dungeon connectivity and shortcut tests](src/app/engine/generate.spec.ts) now use an independent test-only search rather than the production search they were checking. The forest spec's existing independent BFS and both specs' budget expectations remain intact.

Verified **173/173 unit tests**, **24/24 Chromium browser tests**, production build, test type checking, formatting, and whitespace checks. All model goldens, the 15 AR05 artwork baselines, and legacy forest pixel hashes pass without replacement values. An additional comparison against the saved pre-extraction implementations matched ordered distance results for **120 tile/blocked/start cases against both original searches**, plus **96 full models** (24 generated and 72 subsequent shuffles) spanning map types, styles, densities, and room counts. A local import/re-export scan found no cycles across 37 production modules. These comparisons cover sampled inputs, and browser verification remains Chromium-only.

**Original evidence (19 October 2026):** [topology.ts](src/app/engine/topology.ts), line 43, and [forest-generate.ts](src/app/engine/forest-generate.ts), line 157, implement equivalent four-neighbor distance searches. Fisher–Yates loops also repeat across dungeon and forest decoration.

**Original proposal:** extract a neutral engine grid-traversal function and a seeded shuffle helper when working on these files. Keep dungeon threshold/landmark rules and forest route rules in their respective modules. Preserve existing semantic names as small wrappers if they help readers.

The independent traversal implementation in [forest-generate.spec.ts](src/app/engine/forest-generate.spec.ts) is valuable verification, not production duplication to eliminate. The same applies to independently encoded budget expectations in tests; retain the earlier C.1 decision to keep independent test oracles. The historical `IMPROVEMENTS.md` document has since been removed.

**Acceptance criteria:** identical distance results, neighbor order, shuffled order, model hashes, and RNG consumption. Include a disconnected floor and blocked start in the shared algorithm's focused tests. Tests that validate connectivity must not simply call the same production traversal they are checking.

### AR08 — Centralize production knowledge selectively

**Implemented 20 October 2026.** Added domain-owned production constants in [model.ts](src/app/engine/model.ts): `ALL_DENSITIES`, `ALL_PRESETS`, `ALL_FOREST_CHARACTERS`, `ALL_PROP_KINDS`, `DENSITY_BUDGETS`, and room bounds `ROOM_MIN`/`ROOM_MAX`. Engine validators now use these arrays for membership checks, both decoration modules consume the single density-budget table, and dungeon validation/tests pull room bounds from the engine model. The workbench stepper helpers consume the engine bounds rather than owning them.

[save-format.ts](src/app/save/save-format.ts) now enforces version-aware vocabulary with fixed, format-owned lists: `saveVocabulary(version)` returns the explicit schema lists for each supported save-format version, and `parseSavedMap` validates the map against that version's vocabulary before accepting it. The vocabularies are literal arrays, not aliases to the live engine lists, so adding an engine option does not automatically make it readable in older format versions; adding it requires an explicit `SAVE_FORMAT_VERSION` bump or migration. Version lookup matches exact `major.minor.patch` strings and rejects extra components. The policy is documented in [README.md](README.md). Legacy exceptions are preserved: v3 forests without a character are normalized to Verdant, and format-1 records with known vocabulary remain readable and are upgraded to format 2.

Completed the presentation extraction on 21 October 2026: [presentation.ts](src/app/workbench/presentation.ts) owns typed preset/character labels and descriptions plus density descriptions, consumed by `SettingsPanel`. All text is preserved. Type-only engine imports make the supported keys exhaustive without moving presentation into the engine. Rendering palettes retain their separate rendering ownership.

The original AR08 implementation added [five focused constant tests](src/app/engine/model.spec.ts) and [four save-format vocabulary tests](src/app/save/save-format.spec.ts) that pin the supported vocabulary, shared budget values, version-aware rejection of future options, and a regression that extends the live engine lists in memory, confirms `isUsableMap` accepts the extended map, and confirms `parseSavedMap` rejects it under both historical formats. The regression fails if the parser's vocabulary check is removed.

Historical verification: unit tests, **24/24 browser tests**, production build, test type checking, and formatting passed. The earlier notes disagreed on the unit-test total; the completion verification above supersedes those totals. No generator version, golden hashes, pixel baselines, or saved-format behavior changed.

**Original evidence (19 October 2026):** allowable presets/characters/densities appear in [model.ts](src/app/engine/model.ts), engine validation, [save-format.ts](src/app/save/save-format.ts), and [app.ts](src/app/app.ts). Room bounds appear as exported stepper constants and as literals in validation/template rules. UI character labels/descriptions are separate from accepted-style labels. Density budget tables repeat in both production decoration modules.

**Original proposal:** establish domain-owned option/constraint definitions used by production validators, controls, and schema membership checks. Keep UI labels/descriptions in a small workbench presentation catalog, and keep colors/artwork in rendering. If the equal density budgets represent one shared product policy, share their production table while preserving independent expected values in tests.

Save schemas need an explicit historical compatibility policy: do not automatically let every future engine option into every old format merely because one production list grew. Share known vocabulary deliberately, with malformed/unknown/version tests guarding the parser.

**Acceptance criteria:** adding a supported character or changing a room bound does not require manually synchronizing several unrelated current-production lists. Presentation text and rendering data do not become engine dependencies. Runtime membership guards continue to narrow unknown values safely.

### AR09 — Share Blob downloads and complete library operation feedback

**Implemented 21 October 2026.** Added [download.ts](src/app/browser/download.ts), a browser-only `downloadBlob(blob, filename)` helper shared by PNG export and library backups. It owns temporary anchor removal and the existing 30-second object-URL lifetime. Cleanup runs after successful activation and after failures during link creation, append, or click; URL revocation is still scheduled if anchor removal throws. URL-creation failures propagate without creating a link. File preparation and user feedback remain with the callers, without an injectable service or engine dependency.

The library catches backup preparation/download failures, clears stale success notices on failure, and clears stale errors on successful backup preparation. Seven focused helper tests cover resource lifetime and failure paths. Three browser regressions cover failed import followed by successful backup, backup object-URL failure followed by retry, and PNG object-URL failure followed by retry while preserving pending settings. The two new library regressions were confirmed to fail before the fix. The new browser helper folder was explicitly included in test type checking at this stage; AR10 subsequently replaced those folder entries with recursive source discovery.

Verified: **190/190 unit tests** with one worker, **27/27 Chromium browser tests**, production build, test type checking, formatting, and diff whitespace checks. Existing model and pixel baselines remain unchanged. Inspected the library error and recovery screenshots at `artifacts/ar09/backup-error.png` and `artifacts/ar09/backup-recovered.png`; both use the existing layout and readable feedback styles.

**Original evidence (19 October 2026):** [export.ts](src/app/rendering/export.ts), line 48, and [library.ts](src/app/save/library.ts), line 116, duplicate object-URL creation, temporary anchor creation/click/removal, and delayed URL revocation.

There is also a concrete feedback gap visible in the code: `downloadBackup()` does not clear an earlier library error, while [library.html](src/app/save/library.html), line 119, hides notices whenever an error exists. A successful backup after a failed import therefore leaves the old error displayed and hides “Backup downloaded.” Exceptions from the backup download path are not caught and reported by the library. These paths were identified by inspection; the existing browser tests do not reproduce them.

**Original proposal:** a small browser-only `downloadBlob(blob, filename)` function should own resource lifetime for both callers. Callers should own user feedback and catch failures. Clear stale library errors on successful backup preparation, and do not announce success when preparation throws. Keep this helper outside engine code; it does not need injectable state.

**Acceptance criteria:** a failed import followed by a successful backup shows the success message; an injected object-URL failure produces a visible error and permits retry; temporary anchors and URLs are cleaned up on the relevant success/failure paths. Keep both the PNG and JSON download behaviors.

### AR10 — Add tests at the extracted seams and fix future folder discovery

**Implemented 21 October 2026.** [tsconfig.tests.json](tsconfig.tests.json) now includes `src/**/*.ts`, preserving the existing browser-test, script, and configuration entries. Verified discovery with a temporary spec in a new nested source folder: the previous include list excluded it, while `npm run typecheck:tests` reported its deliberate number-to-string assignment as TS2322. Removed the probe and verified a clean type check afterward.

Added [15 focused store tests](src/app/save/save-store.spec.ts) using the existing Vitest runner and a narrow in-memory storage fake. Each mutating operation (add, remove, rename, duplicate, favorite, and import) is exercised through a failed write and successful retry, checking both persisted records and signal state, unchanged previous snapshots, and reload behavior. Further tests verify successful write-before-publication ordering, deduplication against existing IDs and within one import batch, no writes for empty/duplicate-only imports, safe handling of absent/malformed/blocked storage, filtering invalid stored records, and export without persistence changes.

The [16 workbench transition tests](src/app/workbench/workbench-session.spec.ts) added during AR01/AR03 already cover independent drafts, accepted maps, per-type retention, opening saves, reset, appearance changes, shuffling, failed generation, and recovery. Existing panel/browser tests retain native input/output and interaction coverage. No additional component abstraction or production-code change was needed.

Verified **205/205 unit tests** with one worker, **27/27 Chromium browser tests**, production build, test type checking, formatting, and whitespace checks. Model goldens, artwork baselines, and legacy-import coverage pass unchanged. Isolated mutation checks confirmed the new store tests fail when signal state is published before persistence, within-batch deduplication is removed, or failed writes are silently swallowed. Browser coverage remains Chromium-only; this change affects tests, configuration, and documentation, with no visual behavior change.

**Original evidence (19 October 2026):** workflow behavior is primarily covered in [configuration.spec.ts](tests/configuration.spec.ts) and [forge.spec.ts](tests/forge.spec.ts). Persistence operations are browser-tested, but there is no `save-store.spec.ts`. [tsconfig.tests.json](tsconfig.tests.json) explicitly lists root-app, engine, rendering, and save folders.

That include list currently works: imported preview production code is checked transitively. However, a future `preview.spec.ts` or `workbench/*.spec.ts` can run in Vitest without being included in the separate TypeScript check, repeating the previously fixed save-test discovery problem.

**Original proposal:** include application test sources recursively, with the existing tests/scripts/configuration entries retained. Add targeted workbench transition tests alongside AR01, plus store tests for write-before-state behavior and import deduplication. Retain browser tests for native form submission, Canvas, downloads, and interaction; unit tests do not replace them.

Use the current testing tools. Introduce only the narrow fake dependencies needed to exercise failures; an abstract repository hierarchy or a new test framework is unnecessary. Add component-level tests where extracted input/output behavior is otherwise hard to exercise, not one test per method.

**Acceptance criteria:** a deliberate type error in a newly nested spec fails `typecheck:tests`. Failed storage writes leave both stored and in-memory maps unchanged. Workbench commands preserve drafts, accepted maps, and per-type retention. The existing goldens, legacy imports, 21 browser scenarios, and native-control semantics remain covered.

### AR11 — Keep save-format decomposition proportional

**Implemented 21 October 2026.** Multiple future map types are now a confirmed product direction, so their save validation has a dedicated boundary. [map-schema.ts](src/app/save/map-schema.ts) owns map shape checks, engine semantic validation dispatch, the vocabulary contract/check, and legacy normalization through `parseSavedMapBody(map, vocabulary)`. [save-format.ts](src/app/save/save-format.ts) retains fixed historical vocabulary values, record metadata, version policy, backup parsing/serialization, names, deduplication, and library summaries. The dependency is one-way: format → schema → engine models/validators. Individual guards remain together; storage stays in `SaveStore`, and neither parser module depends on Angular or browser I/O.

Historical vocabularies now explicitly list their supported map types as well as densities, presets, characters, and prop kinds. Adding support for another type in the schema therefore requires a separate format-compatibility decision. Format 1 and 2 still accept dungeon and forest records under the existing rules. No generator/save-format version bump, new map type, migration behavior change, or baseline replacement was needed. The library summary still has one production consumer, so it remains in `save-format.ts`; AR08's workbench presentation catalog has a separate UI purpose.

Added [seven schema tests](src/app/save/map-schema.spec.ts) covering accepted-map identity, exclusion of otherwise valid map types by a record's vocabulary, legacy normalization without rebuilding or mutating layout/props, idempotence, and rejection of explicitly invalid legacy characters. Existing save-format tests continue exercising record/bundle integration and now also pin historical map-type lists. All 20 moved guard/validation functions retain identical source; the vocabulary check additionally enforces map-type membership.

Verified **212/212 unit tests** with one worker, **27/27 Chromium browser tests**, production build, test type checking, formatting, and whitespace checks. A separate comparison with the saved pre-extraction implementation matched acceptance and normalized output for **158 record/bundle cases**, including malformed data, frozen legacy saves, and version edge cases. Isolated mutations removing the historical map-type gate, disabling legacy normalization, or bypassing shape/semantic validation all failed the focused tests. An import/re-export scan found no cycles across 39 production modules. Existing model and pixel baselines pass unchanged; browser verification remains Chromium-only, with no separate visual comparison for this nonvisual change.

**Original evidence (19 October 2026):** [save-format.ts](src/app/save/save-format.ts) combines shape checks, semantic validation dispatch, version handling/migration, bundle parsing/serialization, name policy, and summaries. These currently form an understandable feature boundary with tested public entry points.

**Original proposal:** do not split every guard into its own file. If more migrations or map types arrive, extract generated-map schema/migration handling from record/bundle handling. A small presentation module may also own library summaries if those begin to be shared with the workbench. Keep storage I/O in `SaveStore` and parsing/validation pure.

**Acceptance criteria (growth trigger met):** clear one-way dependencies, preserved `unknown` boundaries, unchanged name/deduplication rules and save-format behavior, and no regeneration during migration. File moves must not silently broaden accepted input or replace semantic validation with shape checks alone.

### AR12 — Be selective about shared UI, folder changes, and tooling

**Implemented 21 October 2026.** Grouped the shared radio container, label, selection, focus, and input rules inside [settings-panel.scss](src/app/workbench/settings-panel/settings-panel.scss), removing 67 net lines while retaining distinct flex/grid layouts and map-type icon spacing. Added two root focus-color properties used by native controls, radio labels, the grid toggle, and preview canvas; each keeps its existing outline offset. Native radios and buttons remain the component contracts. No shared form-control component, button wrapper, or general shared folder was introduced.

Moved the room-stepper helper and its existing tests into `workbench/`, alongside the settings behavior, and updated imports. `Icon` remains at the app level. Removed the unused library version field/import, unused `ROOM_DEFAULT`, unused Sass color import, and four model exports with no consumers (`isForestProp`, `isDungeon`, `isForest`, and `mapDensity`). The previously noted unused `PropKind` import had already been resolved by earlier work.

Enabled TypeScript's `noUnusedLocals` and `noUnusedParameters` in the shared compiler configuration. A temporary probe confirmed both diagnostics, and was removed before the clean type check. Added [checks.yml](.github/workflows/checks.yml) for pushes and pull requests: locked dependency installation, formatting, type checking, serial unit tests, production build, Chromium installation/tests, and seven-day retention of failure traces. Formatting now includes `.github/`. Workflow YAML, triggers, commands, and failure-artifact conditions were checked locally. No new package dependency or ESLint rule set was needed; additional lint rules remain a future decision when there is a specific gap beyond the compiler and formatter.

Verified **212/212 unit tests**, **27/27 Chromium browser tests**, production build, test type checking, formatting, and whitespace checks. Captured 14 before/after visual states in `artifacts/ar12/`: both map types at desktop/tablet/mobile widths, keyboard-focused radio groups, and disabled settings. Twelve comparisons matched exactly; the two disabled views each differed by six pixels at one rounded input corner, with no visible layout/state difference on inspection. Inspected the disabled pair, focused forest settings, and mobile dungeon page. Existing model and artwork baselines pass unchanged. On 21 October 2026 the user confirmed that the hosted GitHub Actions workflow succeeds. This remote result is user-confirmed; the checks listed above were run locally. Browser verification remains Chromium-only.

**Original evidence (19 October 2026):** `Icon` is already shared by three components. Settings radio groups repeat selection/focus/input CSS. Panel headings and text buttons have similar, but not identical, styling in the root and library.

**Original proposal:** initially share radio-option styles inside the extracted settings component using SCSS grouping or a mixin. Small common color/spacing/focus tokens can help across features. Keep purposeful differences, such as grid versus flex layouts and different heading sizes.

A shared radio-choice component becomes worthwhile if multiple independent features need the same behavior. Until then, preserve native fieldsets/radios rather than adding a configurable form-control framework. Likewise, ordinary buttons do not need an Angular wrapper merely to share colors.

Keep `icon.ts` where it is unless moving reusable UI into `ui/` improves navigation during AR02. Keep `room-count.ts` near settings once that feature exists. Use feature names such as `workbench/`, `preview/`, and `save/`; avoid a catch-all directory containing every service or component. Removing the unused `PropKind` import, unused library version member, and unused exported model helpers is optional cleanup, not a required architecture project.

At the original review, the repo had formatting/build/type/test commands but no lint script or checked-in CI workflow. AR12 now supplies CI and compiler checks for unused code. Additional lint rules remain conditional on a concrete gap. Do not promise a specific Angular lint rule without checking its support, enforce arbitrary file-length limits, or require a coverage percentage as a substitute for meaningful tests.

## SOLID, DRY, and related principles applied to this code

| Principle             | Current assessment                                                                                                  | Future guidance                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Single responsibility | Session state, UI panels, forest layout/decoration/validation, artwork, and save schema have distinct owners.       | Split further only when responsibilities diverge. Pure functions do not need services.                   |
| Open/closed           | Character profiles and palettes are data-driven; map types have explicit dispatch and historical save vocabularies. | Add each future type deliberately across generation, rendering, UI, and compatibility boundaries.        |
| Liskov substitution   | Dungeon and forest contracts remain distinct discriminated unions.                                                  | Avoid a misleading common base class or dungeon-only requirements on forests.                            |
| Interface segregation | Panels expose focused inputs/outputs; map-specific drafts contain only applicable settings.                         | Keep new component contracts tied to their actual consumers.                                             |
| Dependency inversion  | The engine has no Angular dependency; browser I/O stays at application boundaries.                                  | Introduce injectable adapters only for concrete lifecycle or replacement needs.                          |
| DRY                   | Boundary tracing, traversal, shuffling, downloads, production constraints, and workbench text have defined owners.  | Preserve independent test oracles, historical format vocabularies, and map-specific artwork.             |
| KISS / YAGNI          | Plain functions, native controls, and a scoped session service suit the current app.                                | Require a demonstrated need for state frameworks, generic repositories, or configurable form components. |
| Encapsulation         | Session commands own map/draft transitions; computed signals expose accepted state.                                 | Preserve write-before-publication persistence and command-based state changes.                           |

Computed signals derive state; Canvas effects synchronize with an external drawing surface. Keep those roles distinct as features grow.

## Implemented structure

This summarizes the implemented ownership boundaries. Tests remain alongside their source modules; unchanged supporting files are abbreviated.

```text
src/app/
  app.{ts,html,scss}                 page shell and integration
  workbench/
    workbench-session.ts             scoped maps/drafts/transitions
    settings-draft.ts                draft types and pure conversion
    room-count.ts                    room-stepper normalization
    presentation.ts                  workbench labels/descriptions
    settings-panel/
      settings-panel.{ts,html,scss}
    map-panel/
      map-panel.{ts,html,scss}
  preview/                           existing viewport component
  save/
    map-schema.ts                    map validation and legacy normalization
    save-format.ts                   records, backups, historical vocabularies
    ...                             existing library, store, fixtures
  browser/
    download.ts                      shared browser resource lifetime
  engine/
    forest-generate.ts               composition entry point
    forest-layout.ts
    forest-decoration.ts
    forest-validation.ts
    grid-traversal.ts                shared four-neighbor distances
    ...                             existing dungeon/domain modules
  rendering/
    render-map.ts                    map-type drawing dispatch
    render-options.ts                shared renderer options
    props.ts                         drawProp dispatch entry
    drawing-context.ts
    drawing-primitives.ts
    boundaries.ts                    tile contours and path tracing
    forest-palette.ts
    forest-props.ts
    dungeon-props.ts
    ...                             existing renderers/export/thumbnail
```

The engine and rendering directories describe substantive non-Angular concerns and do not need to be moved into a generic `shared/` folder. A future shared-UI folder should contain genuinely reusable UI, not application state or domain algorithms.

## Future maintenance safeguards

No required AR01–AR12 work remains. Revisit shared UI components when multiple independent features repeat behavior; add lint rules when compiler/formatter checks leave a specific gap. More map types are planned, but implementing them belongs to the feature backlog.

Keep changes reviewable by responsibility. Preserve the configure-then-generate workflow, per-type drafts and retained maps, accepted-setting saves/exports, and recovery after failures. Continue recursive test discovery and the automated check pipeline. Review responsive/focus/disabled states when UI behavior or styling changes.

Keep independent traversal/budget assertions and representative model/pixel baselines. Do not replace golden expectations merely to make a structural refactor pass. Preserve saved metadata and mixed-version legacy behavior; additional map types require an explicit compatibility decision.

## Direct answers

**Should we create services?** `WorkbenchSession` now owns scoped state and `SaveStore` owns persistence. No additional service is required by this review. Generation, rendering, validation, and downloads remain functions.

**Should we split components?** `SettingsPanel` and `MapPanel` have been extracted. `Preview` and `Library` remain cohesive; further splits should follow new responsibilities or reuse.

**Should we create shared components?** `Icon` is already shared, and common settings styles and browser/domain helpers have been consolidated. Another shared component should solve repeated behavior with a clear contract.

**Is the project still idiomatic Angular?** Yes. The completed work strengthens state ownership, component contracts, and module boundaries within the existing Angular approach. A framework migration, wholesale rewrite, or filename-suffix change is unnecessary.
