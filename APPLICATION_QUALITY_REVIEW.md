# Encounter Map Forge — Application quality review

Reviewed **22 October 2026** against commit `86d46c51efef674804f57caac17de543c82df83f` and the accompanying working-tree documentation. This is a fresh review after AR01–AR12, not a replacement for their implementation history in [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md).

The original review changed documentation only. Dated implementation notes below record subsequently authorized work; original findings and verification remain historical evidence. The original brief is historical product context; subsequent decisions about configure-then-generate, forests, presets, and local saving take precedence over its initial MVP restrictions.

## Overall assessment

**The Angular architecture and general code organization are in good shape. All QR01–QR10 findings are now addressed through implementation, verification, or documentation corrections recorded below.** A second broad structural refactor is not warranted.

The strongest original finding was a reproduced local-library data-loss path: two open tabs could overwrite each other's saves. QR01 and QR02 now protect cross-tab mutations and unreadable stored data. QR03 closes the demonstrated map-acceptance gaps while preserving valid saved models and artwork. QR04 makes the import control's keyboard focus visible. QR05 improves text contrast while retaining the palette, typography, and responsive layout.

The original passing suite did not exercise the additional failures reproduced during this review. Subsequent targeted regressions now cover the completed items. The findings were concentrated at persistence, untrusted-input, and UI boundaries; they do not undo the state ownership and module separation achieved by the architecture work.

## Original review scope and verification

Inspected all **41 production TypeScript files under `src/`**, including the bootstrap and six Angular components, their templates/styles, domain and rendering modules, browser utilities, persistence, build/test configuration, CI, and product documentation. Reviewed test coverage and relevant assertions across the 20 unit-test files, four Playwright suites, and visual-review scripts.

Installed versions inspected locally: Angular **22.2.3**, CLI/build **22.2.2**, TypeScript **6.0.3**, Node **22.23.3**, Vitest **4.0.18**, Playwright **1.64.1**, and `@napi-rs/canvas` **0.1.100**. The installed package metadata supports the running Node version. Official Angular guidance was consulted for organization, signals, and render lifecycle; no upgrade or forms migration was undertaken.

| Check                                 | Result on 22 October 2026                                                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test -- --maxWorkers=1`          | **212/212 passed**, 20 files                                                                                                                                                 |
| `npm run test:e2e`                    | **27/27 passed**, Chromium                                                                                                                                                   |
| `npm run typecheck:tests`             | Passed                                                                                                                                                                       |
| `npm run build`                       | Passed; **255.68 kB** raw initial bundle, within budget                                                                                                                      |
| `npm run format:check`                | Passed                                                                                                                                                                       |
| Static relative import/re-export scan | No cycles among the 41 production modules; no external imports in the engine                                                                                                 |
| Additional forest exercise            | 400 seeds, Cluttered density, characters rotated across the four options, ten shuffles each: **4,000 transitions**, no rejected initial generation or unchanged-map fallback |
| Additional browser inspection         | Reproduced storage, focus, import-error, and disabled-state cases described below; no page errors in the probe                                                               |

The additional probes ran from temporary scripts using the current modules and an isolated browser context. They did not touch the user's actual browser library. Desktop dungeon and mobile forest screenshots, plus the focused import control, were visually inspected. Additional populated-library checks found no horizontal page overflow at **1440, 768, 390, and 320 CSS pixels**. Existing browser tests also cover both map types across responsive widths.

These are sampled checks, not an exhaustive accessibility certification, a performance profile, or proof for every seed. Firefox, WebKit, assistive technology, and touch hardware were not exercised. No remote CI run was initiated or independently checked; the earlier user-confirmed CI result remains separate from this review's local evidence.

## Angular and engineering assessment

### Component and state boundaries

The six components have sensible responsibilities. The size figures below describe the original reviewed snapshot, before the QR implementation notes:

| Area                           | Current responsibility                                                    | Assessment                                                                      |
| ------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `App` — 152 TypeScript lines   | Page composition, operation lock, status/error messages, exports          | Appropriate container; another orchestration service is not currently necessary |
| `WorkbenchSession` — 200 lines | Accepted maps, active type, raw per-type drafts, atomic transitions       | Appropriate component-scoped state service                                      |
| `SettingsPanel` — 119 lines    | Native settings controls and typed user events                            | Cohesive presentation component                                                 |
| `MapPanel` — 40 lines          | Map heading, summary, grid control, preview composition                   | Focused and small                                                               |
| `Preview` — 185 lines          | Canvas cache, drawing, pan/zoom, resize lifecycle                         | Cohesive imperative browser boundary                                            |
| `Library` — 171 lines          | Save/import/export commands, list presentation, rename state and feedback | Still cohesive; fix its individual interaction gaps before splitting it         |

Counts include formatting and are observations, not suggested limits. `Icon` is an appropriately small shared component. Keeping it directly under `app/` is reasonable. The workbench presentation catalog owns UI descriptions; engine options and rendering palettes retain separate ownership.

The project follows the useful parts of the [Angular style guide](https://angular.dev/style-guide): related files and tests are colocated, organization follows features and substantive domains, dependency injection uses `inject`, and template-only members are generally protected. Existing short component filenames are consistent and do not need a `.component.ts` suffix migration.

Components consistently use OnPush, signal inputs/outputs, built-in control flow, and stable list keys. The session owns one writable state object and exposes computed views. Drafts remain separate from accepted settings. Children emit actions instead of maintaining competing map state. Pure generation, validation, rendering, and download functions do not need Angular service wrappers.

The Canvas effect is doing imperative drawing, not copying derived application state. Observer teardown is registered through `DestroyRef`. The project is explicitly browser-only, so its deliberate use of browser globals is not an SSR defect. There is a small render-phase organization opportunity noted under deferred items below.

### SOLID, DRY, and related principles

| Principle             | Assessment                                                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single responsibility | State, settings UI, viewport behavior, persistence, format/schema handling, generation, and artwork have distinct owners. Long artwork functions remain related drawing logic, not evidence that more services are needed. |
| Open/closed           | Profiles and palettes are data-driven; map rendering has exhaustive typed dispatch. A new map type still requires deliberate work across the app, which is appropriate.                                                    |
| Liskov substitution   | There is no problematic inheritance hierarchy. Dungeon and forest models keep their different contracts through discriminated unions.                                                                                      |
| Interface segregation | Panels accept focused inputs and emit typed commands. The restricted drawing context makes native renderer testing possible without pretending to implement an entire browser canvas.                                      |
| Dependency inversion  | Domain code does not depend on Angular or persistence. Concrete browser APIs are confined to application boundaries. Additional adapters should follow an actual replacement or lifecycle need.                            |
| DRY                   | Shared traversal, shuffling, boundaries, dispatch, constraints, downloads, and UI descriptions have owners. Independent test expectations and fixed historical vocabularies are intentional duplication worth retaining.   |
| Encapsulation         | Session transitions and write-before-publication persistence are strengths. The original saved-array typing gap is now addressed; see QR08.                                                                                |
| KISS / YAGNI          | Native controls, plain functions, and two purposeful state services suit the app. No state-management framework, generic repository hierarchy, or internal design system is justified by the current code.                 |

### Tests and tooling

The suite combines model goldens, pixel baselines, determinism checks with difference assertions, independent traversal/budget expectations, state transitions, persistence failures, and real browser workflows. This is substantially stronger than simply calling production validators from every test. Keep the independently encoded expectations and the frozen legacy forest fixture.

Strict TypeScript, unchecked-index checking, unused-symbol diagnostics, strict templates, recursive test-source discovery, formatting, and CI are already in place. Unit tests are colocated; browser scenarios appropriately live under `tests/`. CI uses the lockfile, serializes native rendering workloads, and retains browser failure traces.

The original test gaps included concurrent library instances, writes after a partially readable load, malformed imports, keyboard-visible file-input focus, text contrast, and import storage failures. QR01/QR02 now cover the persistence and import-failure gaps; QR03 adds record/bundle rejection cases and revision-limit recovery; QR04 covers keyboard file-picker activation and visible label focus; QR05 measures rendered interface contrast across three viewport widths and interactive states. Add regressions for the remaining findings as they are addressed; there is no need to add one test per component method or assert every presentation constant.

## Findings and recommended work

**Status updated 23 October 2026:** QR01–QR05 and QR07 are implemented. QR06 and QR08 are addressed with QR01/QR02 and independently verified against their acceptance criteria. The persistence/UI changes also address QR09 as noted below; QR10's documentation correction is complete. Identifiers are independent of AR01–AR12. **P1** means a demonstrated data-loss issue to address first; **P2** means a concrete correctness or accessibility issue; **P3** means a lower-impact contract, policy, or documentation improvement.

| ID   | Priority | Finding                                                             | Evidence                                                  | Status                     |
| ---- | -------- | ------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------- |
| QR01 | P1       | Stale tabs overwrite other tabs' saved maps                         | Reproduced in Chromium                                    | **Implemented**            |
| QR02 | P2       | A write after a partially readable load discards unreadable records | Reproduced against `SaveStore`                            | **Implemented**            |
| QR03 | P2       | Saved-map acceptance does not enforce all downstream map contracts  | Reproduced with parser and renderer probes                | **Implemented**            |
| QR04 | P2       | Import backup has no visible keyboard focus indicator               | Keyboard traversal and screenshot inspection              | **Implemented**            |
| QR05 | P2       | Several normal-text colors fall below 4.5:1 contrast                | Browser-computed styles and contrast calculation          | **Implemented**            |
| QR06 | P2       | Import reports storage failure as an unreadable file                | Reproduced with a valid backup and injected quota failure | **Addressed and verified** |
| QR07 | P3       | Bundle headers accept unsupported version shapes/values             | Reproduced parser cases                                   | **Implemented**            |
| QR08 | P3       | Readonly save signal exposes a mutable array type                   | Static TypeScript contract finding                        | **Addressed and verified** |
| QR09 | P3       | Active rename controls ignore the library's disabled input          | Reproduced during a held PNG export                       | Addressed with QR01/QR02   |
| QR10 | P3       | Forest algorithm documentation overstates per-placement checks      | Source/document comparison                                | **Implemented**            |

### QR01 — Prevent saved-library loss across open tabs

**Implemented 22 October 2026.** Every `SaveStore` mutation now acquires the same origin-scoped exclusive Web Lock, reads the latest stored library inside it, applies a command to that state, persists, and then publishes the new readonly snapshot. Storage events refresh other tabs; their listener is removed through `DestroyRef`. Commands use IDs against the latest collection, so a stale rename/duplicate/favorite/delete cannot restore a removed map. Blank renames retain the latest saved name, and rename/favorite feedback uses the accepted result. Mutations are asynchronous and the library disables conflicting commands while they are pending. Browsers without Web Locks keep read/open/backup access and refuse writes; older app builds must be reloaded to participate in the protocol. The storage key and saved format are unchanged.

Regression evidence: the original stale-save and deleted-map duplication probes failed before the fix. A further browser regression exposed the blank-rename fallback during self-review, failed before its correction, and passes afterward. The queued-save browser test holds the named lock in a third page, observes both pending write requests, releases it, and verifies both maps in both tabs and after refresh. Other checks cover concurrent field changes, external synchronization, duplicate/import behavior, write failures, retry, and listener teardown.

**Original evidence:** [save-store.ts](src/app/save/save-store.ts), lines 16–17 and 75–98. The store reads local storage once. Every mutation constructs a replacement collection from its own cached signal and writes that entire collection. There is no external-change detection or coordination between tabs.

**Original reproduction:** open two tabs with an empty library before saving anything. Save “Tab A” in the first tab. The second tab still displays an empty library. Save “Tab B” there. Persistent storage now contains only “Tab B”; the first tab continues showing “Tab A” until refresh, after which it also shows only “Tab B”. No error is reported.

This is ordinary sequential use of two tabs, not a contrived simultaneous timing race. The existing write-before-signal ordering protects a single operation against a failed storage write; it does not protect other writers' data.

**Original proposed change:** make library mutations account for the latest persisted state and define cross-tab conflict behavior. Synchronize external changes for display, and coordinate mutations or reject stale writes with a recoverable conflict message. A `storage` listener alone is not a complete atomicity solution. A naive union of cached arrays can also resurrect deleted records. The [HTML Web Storage specification](https://html.spec.whatwg.org/multipage/webstorage.html) explicitly cautions against assuming locking between windows.

Keep this responsibility in the persistence boundary. Decide whether coordinated browser-local writes are sufficient or transactional storage is warranted before changing storage technology; no backend is required.

**Acceptance criteria:** two open pages can save distinct maps without losing either one after reload. Cross-tab rename, favorite, duplicate, import, and delete operations preserve unrelated records. Stale edits cannot silently undo a deletion. Include both sequential stale-tab scenarios and an explicitly coordinated concurrent-write test, plus the existing storage-failure cases.

### QR02 — Preserve unreadable stored data before allowing replacement writes

**Implemented 22 October 2026.** The store distinguishes ready, partially readable, invalid, and unavailable libraries. It exposes readable records while retaining the original text of partial/invalid data; repeated readable IDs show their first record once. Partial, malformed, duplicate-ID, or inaccessible storage pauses mutations, including when the problem is discovered after a command was queued. A failed read retains previously displayed maps. The library shows persistent diagnostics, an exact original-text recovery download, and a retry action; opening readable maps and ordinary backups remain available. Recovery never clears or repairs stored data automatically, and ordinary backups contain only readable maps. The original unrelated-rename regression demonstrated data loss before the fix.

Verified the combined QR01/QR02 change with **238/238 unit tests** (including 41 store tests), **37/37 Chromium browser tests**, test type checking, production build (**260.30 kB raw**, within budget), formatting, and whitespace checks. Existing model/pixel baselines pass unchanged. New browser cases cover partial/duplicate/malformed recovery downloads, blocked reads, import quota failure and same-file retry, stale edits, and concurrent writes. Inspected the recovery library at desktop and mobile widths and the recovered mobile state; no horizontal overflow at 1440, 390, or 320 CSS pixels. Browser verification remains Chromium-only. No dependency, engine, renderer, generator-version, or save-format changes were needed.

**Original evidence:** [save-store.ts](src/app/save/save-store.ts), lines 75–98. Loading filters rejected records out of memory and treats malformed or inaccessible storage as an empty library. It retains neither a load diagnostic nor the rejected entries. The next successful mutation writes only the accepted subset.

**Original reproduction:** initialize storage with one readable record and one synthetic record with `saveFormatVersion: '99.0.0'`. Construction leaves both records on disk and exposes only the readable one. Renaming that readable map rewrites storage with just the renamed record, permanently dropping the unsupported record.

Rejecting a future record for use is correct. Discarding its only stored copy as a side effect of an unrelated rename is a different policy. The current tests check that loading itself does not overwrite malformed data, but do not follow that load with a mutation.

**Original proposed change:** represent absent, fully readable, partially readable, and failed loads distinctly. Preserve raw/rejected data for recovery, or prevent destructive replacement until the user has a clear recovery path. Report skipped local records instead of silently presenting a complete-looking library. Deduplicate accepted IDs at this boundary as well: a stored array containing the same valid record twice currently loads both entries despite the template tracking by ID.

This protection is particularly useful **before tightening validators in QR03**: stronger acceptance rules should not turn a later unrelated save into implicit deletion of previously stored data.

**Acceptance criteria:** unsupported or malformed local records survive unrelated mutations, or those mutations fail safely with an actionable explanation. Valid records remain usable where possible. Absent storage still behaves as a normal empty library. Duplicate stored IDs have a deterministic policy and cannot produce duplicate tracked rows. Add tests that continue beyond construction through a successful write and reload.

### QR03 — Make accepted map bodies satisfy rendering and operation invariants

**Implemented 22 October 2026.** Map-family prop tuples now define the supported dungeon/forest kinds and their union. Both domain validators reject foreign props and noninteger positions. Forest rendering has a compiler-checked layer assignment for every forest prop kind, retaining its existing draw order. Shape checks bound collection sizes, enforce the supported room range and canonical seed identity, and require nonnegative safe revisions before semantic validation and historical vocabulary checks. Historical format vocabularies remain independent of the engine lists.

Forest generation and save acceptance now share layout validation: the 200-tile minimum, connected floor, integer endpoints on different edges, and a connected, deduplicated route containing both endpoints. Forest decoration rejects trees on walkable tiles and blocking props on the route, and checks the global density budget; dungeon validation checks each room's blocking budget. Existing reserved-space, clear-square, and remaining-floor connectivity checks remain in place.

Both shuffle entry points use a shared checked revision increment. The maximum safe revision remains readable/exportable, but another shuffle throws an actionable limit error before decoration or state publication. The existing application error boundary restores controls and preserves accepted maps and drafts; generating with a different seed resets the revision to zero. No generator/save-format version or baseline changes were needed. Previously stored invalid records enter QR02's recovery flow without being overwritten; backups skip invalid bodies and report the count.

Regression evidence: all **32 initial record/bundle rejection tests failed before the fix** and passed afterward. The completed acceptance suite has 39 tests, including exact bounds and positive controls; it also accepts 288 generated/shuffled snapshots across six seeds, all densities, all dungeon presets, and all forest characters without replacing their models. Four engine tests cover the final safe increment, invalid inputs, exhaustion, and input immutability; two session tests cover unchanged accepted maps/drafts and recovery. Four new browser cases exercise mixed imports, exact local-data recovery downloads, and successful export/new-layout generation after revision exhaustion for both map types.

Verified with **283/283 unit tests** (22 files), **41/41 Chromium browser tests**, test type checking, production build (**262.15 kB raw**, within budget), formatting, and whitespace checks. Existing model, pixel, and frozen-v3 baselines pass unchanged. Browser verification remains Chromium-only; this correction does not change artwork or page styling.

**Original evidence:** [map-schema.ts](src/app/save/map-schema.ts), particularly lines 71–91, 159–179, and 217–245; [forest-validation.ts](src/app/engine/forest-validation.ts), lines 13–66; [forest-renderer.ts](src/app/rendering/forest-renderer.ts), lines 234–250.

The original parser already did useful shape checks, bounded prop variation, and performed semantic validation. These checks did not cover every assumption of the consumers.

| Probe                                                                                                                          | Result before QR03                                             | Consequence                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Generate the default Verdant forest, then change its 12 boulders to `crate` while retaining their blocking flags               | `isUsableMap` and `parseSavedMap` accept it                    | Forest rendering draws none of those crates. Its raw pixels match rendering with the crates removed, although the saved model still marks their tiles as blocking. |
| Use a 1,200-entry tile field with only tiles 41 and 42 walkable, route `[41, 42]`, endpoints `(1,1)` and `(2,1)`, and no props | Accepted by `parseSavedMap`; `validateForestLayout` rejects it | Import bypasses the 200-tile clearing minimum and accepts interior endpoints.                                                                                      |
| Replace both endpoints of an otherwise valid forest with the same interior route tile                                          | Accepted                                                       | The purported edge-to-edge path contract is no longer represented.                                                                                                 |
| Give a forest tree fractional coordinates such as `(2.5,2.5)`                                                                  | Accepted                                                       | The schema admits positions outside the documented integer tile-coordinate model.                                                                                  |
| Set a valid dungeon's detail revision to `1e100`                                                                               | Accepted                                                       | JavaScript represents it as an integer, but adding one leaves it unchanged; detail revisions can no longer advance correctly.                                      |

These probes used altered import data. No claim is made that the current generators emit these malformed maps. The finite generator/shuffle batch passed. The forest renderer's explicit layers are also reasonable; the wrong map-family prop should be rejected before it reaches them.

**Original proposed change:** establish a complete, bounded acceptance contract at the schema/domain boundary. Enforce integer tile coordinates, map-specific prop support, the forest's required layout properties, and safe revision arithmetic. Share the common forest layout invariants between generation and imported-map validation instead of maintaining a weaker parallel check. Keep historical format vocabulary independent of current engine additions; a format-wide list of known props does not by itself establish which map type supports each prop.

A safe-integer revision check is necessary but needs an explicit upper-bound/exhaustion policy too: accepting the maximum safe integer and then incrementing it unchecked only postpones the problem. Review route exclusion and density budgets as part of the accepted-map contract rather than assuming generated-output tests validate arbitrary imported maps.

**Acceptance criteria:** the concrete invalid bodies above are rejected without throwing, and supported generated maps plus the actual v3 fixture still load unchanged. Every prop accepted for a given map type has a rendering path. Accepted revisions either increment safely or produce a clear recoverable limit result. Exercise the cases through `parseSavedMap`/`parseBundle`, not only private guards. Preserve existing generator and artwork goldens; do not regenerate or silently repair saved layouts to make them pass.

### QR04 — Give Import backup visible keyboard focus

**Implemented 22 October 2026.** The visible import label now uses the existing focus-color token for a 2px outline with a 2px offset when its native input matches `:focus-visible`. The label also reflects the input's disabled state with the library's existing opacity and a default cursor; disabled text actions no longer show active hover styling. The native file input, associated label, tab order, and keyboard activation remain the interaction contract.

The new desktop regression failed before the correction: Tab focused the input and it matched `:focus-visible`, while the label's computed outline remained `none`. Two browser tests now exercise Tab from Download backup, the rendered outline, Enter and Space file-picker activation, an empty selection followed by a successful fixture import, unchanged displayed-map state, and imported maps surviving refresh at 1440px and 320px. The held-export regression additionally checks disabled input/label presentation and recovery. Visually inspected `artifacts/qr04/focused-1440.png`, `focused-320.png`, and `disabled-desktop.png`; the outline is visible and unclipped, and the disabled label matches the adjacent action.

Verified **43/43 Chromium browser tests**, test type checking, production build (**262.47 kB raw**, within budget), formatting, and whitespace checks. The production change is confined to component SCSS. Playwright supplies an empty file selection to simulate dismissal; a separate probe confirmed that this produces synthetic input/change events rather than the native `cancel` event. The operating system file dialog's Cancel button was not manually exercised. Browser verification remains Chromium-only.

**Original evidence:** [library.html](src/app/save/library.html), lines 41–49; [library.scss](src/app/save/library.scss), lines 128–137. The native file input is focusable but occupies one pixel and has `opacity: 0`. Its visible label does not reflect focus.

**Original reproduction:** after saving a map, focus Download backup and press Tab. Chromium focuses the file input and matches `:focus-visible`, but the label has no outline and the input's outline is transparent with the input. The screenshot shows no visible indication that Import backup is selected.

The input is not absent from keyboard navigation; the defect is the missing visible focus state. [WCAG 2.2 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) requires keyboard users to be able to identify the focused control.

**Original proposed change:** retain the native input and apply a visible focus indicator to its label, following the existing radio/grid control pattern. Check disabled presentation at the same time. No custom upload component is needed.

**Acceptance criteria:** Tab reaches a visibly outlined Import backup control; keyboard activation opens the file chooser; cancellation and a subsequent successful import work. The indication remains visible at desktop and mobile widths. Verify browser focus behavior and inspect the focused result rather than only checking a CSS declaration.

### QR05 — Improve contrast of small informational and option text

**Implemented 22 October 2026.** Shared root colors `--text-muted: #5f6b59` and `--text-accent: #846735` now serve secondary copy and warm numbered/pending accents on the existing light backgrounds. This corrects settings hints, unselected options, captions, style descriptions, empty-library copy, library metadata/notices, page status, export details, legends, and footer copy. Targeted changes also correct the style-note heading, Delete action, map-summary labels, and save-name placeholder; its explicit opacity avoids relying on the browser's placeholder treatment. Font sizes, layout, selected-option styling, disabled-control opacity, and map artwork remain intact.

Representative **post-fix Chromium measurements** from the actual rendered backgrounds:

| Text                        | Foreground | Background | Contrast   |
| --------------------------- | ---------- | ---------- | ---------- |
| Settings hints              | `#5f6b59`  | `#fbfaf5`  | **5.38:1** |
| Unselected character option | `#5f6b59`  | `#f0f1e6`  | **4.94:1** |
| Library explanatory note    | `#5f6b59`  | `#fbfaf5`  | **5.38:1** |
| Saved-map metadata          | `#5f6b59`  | `#fffef8`  | **5.57:1** |
| Workbench status            | `#5f6b59`  | `#f5f3ec`  | **5.07:1** |
| Save-name placeholder       | `#5f6b59`  | `#f4f3ea`  | **5.05:1** |
| Map-summary labels          | `#9aaf99`  | `#243934`  | **5.24:1** |
| Pending settings notice     | `#846735`  | `#fbfaf5`  | **5.06:1** |

The desktop regression failed on the original colors before correction. Three new browser scenarios now make **587 text/state measurements** at 1440, 768, and 320 CSS pixels across both map types, including normal, selected, hover, and keyboard-focus states, placeholders, pending/status/error messages, and library/rename actions. They measure computed colors against inherited, composited solid backgrounds and compare the unrounded ratios with 4.5. The lowest sampled ratio is **4.729996:1** (an unchanged text action). The checks require actual text and reject unexpected gradients or ancestor opacity instead of producing an unsupported estimate. They sample interface text rather than Canvas artwork or a full accessibility certification.

Visually compared the desktop dungeon before and after correction, and inspected tablet, mobile forest, and populated desktop/mobile library screenshots under `artifacts/qr05/`. The same folder contains `contrast-1440.json`, `contrast-768.json`, and `contrast-320.json` with the individual readings. Verified **46/46 Chromium browser tests**, test type checking, production build (**263.02 kB raw**, within budget), formatting, and whitespace checks. Production edits are confined to SCSS; browser verification remains Chromium-only.

**CI follow-up, 22 October 2026.** The [failed Actions run](https://github.com/Gile987/dnd-map-generator/actions/runs/39771934122) exposed a synchronization race missed by the initial local verification. Its retained trace shows the Shuffle-enabled assertion passing before `aria-busy` changed to `true`; contrast sampling then overlapped the dungeon-to-forest form replacement. A [successful run at the same commit](https://github.com/Gile987/dnd-map-generator/actions/runs/39771976952) confirms that the original failure was intermittent.

The contrast scenarios now wait for the requested map-type heading and `aria-busy="false"` before collecting settings elements. Appearance generation waits for pending settings to disappear and the operation to finish; library save/import sampling also waits for the library's completed busy state. Detached samples and unsupported ancestor styles produce specific diagnostics. The contrast threshold and opacity/gradient guards remain strict, and no sleeps, retries, or timeout increases were added.

A controlled regression holds the map-type change event after the native Forest radio becomes checked, leaving the accepted dungeon form and Shuffle control enabled. The old readiness check incorrectly completed in that state and failed the new test; the corrected check stays pending until the change is released and the forest form is ready. Verified **20/20 repeated contrast scenarios** (all four cases, five times each) and **47/47 full browser tests**, each against a fresh local server with `CI=true`, disabled Angular caching, and server reuse disabled. Test type checking, formatting, and whitespace checks also pass. This follow-up changes test synchronization, diagnostics, and documentation; application styles and behavior are unchanged. Hosted Actions has not run this patch yet.

**Original evidence:** [settings-panel.scss](src/app/workbench/settings-panel/settings-panel.scss), lines 48–60 and 223–225; [library.scss](src/app/save/library.scss), lines 49 and 218; [app.scss](src/app/app.scss), line 263.

The following **original pre-fix values** were taken from Chromium's computed styles in enabled/default states and calculated using relative luminance:

| Text                        | Foreground | Background | Size  | Contrast                 |
| --------------------------- | ---------- | ---------- | ----- | ------------------------ |
| Settings hints              | `#88927e`  | `#fbfaf5`  | 10 px | approximately **3.11:1** |
| Unselected character option | `#7e8973`  | `#f0f1e6`  | 10 px | approximately **3.23:1** |
| Library explanatory note    | `#7d887b`  | `#fbfaf5`  | 12 px | approximately **3.54:1** |
| Saved-map metadata          | `#8b9483`  | `#fffef8`  | 10 px | approximately **3.12:1** |
| Workbench status            | `#7d9074`  | `#f5f3ec`  | 10 px | approximately **3.09:1** |

These communicate instructions, available choices, saved-map details, or operation results. They are not disabled controls or merely decorative lettering. The applicable normal-text threshold is **4.5:1**, rather than the large-text threshold of 3:1. See [WCAG 2.2 Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

**Original proposed change:** darken the affected text colors while retaining the visual hierarchy and palette. Review related hints, legends, footer text, and success messages for the same pattern. Small shared text-color tokens may help where foreground/background requirements actually match; a general styling framework is unnecessary.

**Acceptance criteria:** meaningful enabled text meets the applicable contrast threshold in normal, selected, hover, and focus states on its actual background. Inspect desktop/mobile results and calculate the final colors. Merely increasing 10 px text slightly does not qualify it for the large-text exception. This is a focused accessibility correction, not a request to redesign the artwork.

### QR06 — Preserve the useful storage error during import

**Addressed with QR01/QR02, 22 October 2026.** Asynchronous library commands share an awaited error/finally path. Import distinguishes file-reading errors from parse and store errors, preserves the useful quota/blocked-storage message, resets its file input, and clears errors after success. The new browser regression injects an import write failure, verifies unchanged library state, retries the same fixture, and checks the recovered maps after refresh.

**QR06 acceptance verification, 22 October 2026.** No further application-code change was needed. Expanded [library-safety.spec.ts](tests/library-safety.spec.ts) to cover unreadable files, malformed JSON, foreign backups, future-format backups with valid record bodies, quota failures, and blocked writes. All six Chromium cases verify the specific error, empty success notice, unchanged visible maps and exact stored text, reset/enabled file input, successful retry, cleared error, and persistence after reload. Storage cases retry the same fixture after writes are restored; malformed/unsupported cases retry a corrected backup. Passed: **6/6** targeted browser cases, **66/66** save-format/store unit tests, `npm run typecheck:tests`, and `npm run format:check`. Changes are limited to tests and this review; no production build or visual review was needed.

**Original evidence:** [library.ts](src/app/save/library.ts), lines 130–154. File reading, bundle parsing, and persistence share one catch block that always reports “That backup file could not be read.” `SaveStore` already throws a specific message about local storage being full or blocked.

**Original reproduction:** select the valid v3 backup fixture while `Storage.prototype.setItem` throws a quota exception. The library reports an unreadable backup even though reading and parsing succeeded and the failure was persistence.

The write-before-publication guard preserves the library correctly. The problem is misleading recovery guidance, not a partial commit.

**Original proposed change:** separate file-reading failures from store failures, or preserve the meaningful store error through the existing feedback pattern. Continue to reset the file input so the same file can be retried. Keep the current distinction between invalid JSON, unsupported formats, skipped records, and storage failure.

**Acceptance criteria:** an unreadable file, malformed JSON, unsupported backup, and quota/blocked-storage error produce appropriate messages. A failed import changes neither stored nor visible maps. Retrying the same valid file after storage becomes available succeeds and clears the previous error.

### QR07 — Use an explicit supported-version policy for bundle headers

**Implemented and verified 23 October 2026.** Bundle headers and saved records now use the same explicit vocabulary lookup, accepting only the exact strings `1.0.0` and `2.0.0`. Removed the numeric less-than-or-equal version comparison. Missing/non-string values, unknown versions, shortened/extra-component forms, leading-zero aliases, whitespace, and prerelease/build suffixes are rejected. This deliberately tightens previously accepted leading-zero record versions too; unreadable local records remain protected by the existing recovery flow. Supported header and record versions are checked independently, preserving mixed historical/current imports and format-1 normalization. Unsupported headers reject the whole bundle; unsupported nested records retain the existing skip/error behavior. The [README](README.md) documents the policy. New exports remain format `2.0.0`; generator and save-format versions are unchanged.

Regression evidence: **12 new parser cases failed before the fix**. The final version-policy tests cover all four supported header/record combinations and 29 unsupported values with valid record bodies, including missing headers and distinct header rejection versus record skipping. The browser regression rejects the original reproduced header examples and a leading-zero alias, verifies exact stored data and visible maps are unchanged, then retries a supported legacy backup successfully and reloads. Passed: **315/315 unit tests** (including 57 save-format tests and unchanged model/pixel baselines), **28/28 Chromium save-library browser tests**, `npm run typecheck:tests`, `npm run build` (**262.64 kB** raw initial bundle, within budget), and `npm run format:check`. Browser verification remains Chromium-only; no visual change was made.

**Original evidence:** [save-format.ts](src/app/save/save-format.ts), lines 83–112 and 140–155. Individual records ultimately require a known three-component vocabulary. The bundle header uses the looser numeric comparison alone.

**Original reproduction:** a bundle containing a valid current record is accepted when its header version is `1`, `1.0.0.99`, `1.9.0`, `0.0.0`, or `2.0.0.0`. A record with `1.0.0.99` is rejected. Thus the container and record versions have different acceptance policies without an explanation.

This is lower priority because the nested records still undergo their own validation; it does not bypass the record vocabulary gate.

**Original proposed change:** define the supported bundle versions explicitly, preferably through the same known-version lookup where appropriate. If the container intentionally has a looser compatibility contract, document and test that contract instead. Decide whether noncanonical leading-zero versions are supported rather than calling numeric equivalence exact string matching.

**Acceptance criteria:** supported historical/current bundles continue to import, and tests with valid record bodies distinguish unsupported header versions from unsupported records. Missing, malformed, extra-component, and future headers follow one documented policy.

### QR08 — Expose a readonly saved-record collection

**Addressed with QR01/QR02, 22 October 2026.** The persistence snapshot holds `readonly SavedMap[]`, and the public `saved` computed signal retains that readonly collection type. Consumers still sort copies; all mutation paths use immutable replacements through the guarded command boundary. No runtime freezing or cloning on every read was added.

**QR08 acceptance verification, 23 October 2026.** No further application-code change was needed. Added a compile-time regression assertion in [save-store.spec.ts](src/app/save/save-store.spec.ts) requiring the public `saved` contract to be exactly `Signal<readonly SavedMap[]>`. The assertion is checked by `npm run typecheck:tests` and guards both the readonly signal and its readonly array value. Existing storage tests verify immutable replacement and write-before-publication, including failed writes and recovery. Passed: **42/42 store tests**, `npm run typecheck:tests`, and `npm run format:check`. Only tests and this review changed; no production build or browser run was needed. This protects the TypeScript contract; it does not add runtime or deep freezing.

**Original evidence:** [save-store.ts](src/app/save/save-store.ts), lines 16–17. `signal<SavedMap[]>` followed by `asReadonly()` exposes a `Signal<SavedMap[]>`. It removes `.set()` and `.update()` from the public signal, but the returned array still has mutating methods such as `.splice()` and `.push()` in its TypeScript contract.

No current consumer was found mutating it; `Library` correctly sorts a copy. This is an encapsulation weakness rather than a reproduced user-facing bug. Angular's [signals documentation](https://angular.dev/guide/signals#converting-writable-signals-to-readonly) distinguishes a readonly signal from protection against mutation of its value.

**Original proposed change:** make the signal's value a readonly collection and carry that type through the store's internal contracts where appropriate. Preserve immutable replacement and write-before-publication behavior. Runtime deep freezing or cloning every read is not required for this focused type improvement.

**Acceptance criteria:** ordinary consumers cannot call array mutators without an explicit unsafe escape; existing storage tests and type checks pass. Keep this as a small change alongside persistence work, not another state-management redesign.

### QR09 — Apply the library disabled contract to active rename forms

**Addressed with QR01/QR02, 22 October 2026.** The rename input and Save button now honor both application/library busy state and storage write availability; Cancel remains available in a read-only library but is disabled during an active operation. The shared command guard refuses submissions while busy. The held-export browser regression now starts with an active rename draft and checks that controls disable and recover without losing that draft.

**Original evidence:** [library.html](src/app/save/library.html), lines 69–82, and [library.ts](src/app/save/library.ts), line 87. The list actions and save/import controls honor `disabled()`, but the rename input and its Save/Cancel buttons do not. The submit handler also has no disabled guard.

**Original reproduction:** save a map, enter Rename, hold PNG encoding pending, and start Export PNG. Open/Duplicate and the main workbench controls become disabled; the rename input and submit button remain enabled.

No map corruption was demonstrated, and renaming is independent of PNG pixels. This is a low-impact inconsistency in the component contract and its busy-state presentation.

**Original proposed change:** apply the disabled state consistently to rename controls and prevent blocked submissions. If cancellation should remain available, make that an intentional exception. Keep the user's edit draft through the busy operation.

**Acceptance criteria:** an existing rename form follows the chosen disabled policy during export/generation and becomes usable after success or failure without losing its draft. Extend the existing held-export browser test with a populated library and active rename state.

### QR10 — Align forest algorithm documentation with the implementation

**Implemented and verified 23 October 2026.** Corrected the [README](README.md) to state four clearing circles (one base plus three offsets) and distinguish per-placement endpoint reachability from completed-map validation of all remaining walkable ground. Documented the maximum of 16 deterministic generation attempts, the error after exhaustion, and the previous-map fallback for rejected shuffle, density, and character changes. Scoped the shared decoration paragraph's full-connectivity and clear-square placement checks to dungeons.

Verification: compared the corrected prose with `createClearing`, both blocking-placement checks in `forest-decoration.ts`, `validateForest`, the generation retry loop, and all three forest appearance commands. Markdown formatting checks passed for the README and this review. Only documentation changed; no application build, unit/browser tests, model/pixel baseline updates, or version changes were needed.

**Original evidence:** [README.md](README.md), lines 74–78; [forest-layout.ts](src/app/engine/forest-layout.ts), `createClearing`; [forest-decoration.ts](src/app/engine/forest-decoration.ts), lines 248–253 and 344–349; [forest-generate.ts](src/app/engine/forest-generate.ts), lines 62 and 83.

At the original review, the README described 4–5 clearing circles; `createClearing` constructs one base circle plus three offsets, always four. It also said each forest blocking placement checks connectivity of all remaining walkable tiles. Those placement checks verify only that the endpoint remains reachable. Full remaining-floor connectivity is checked by `validateForest` at the completed-map boundary; generation can retry, and forest appearance commands can return the previous map when validation fails.

The completed-map safeguard exists. The 4,000 additional shuffle transitions did not hit the unchanged-map fallback. There is no evidence here that normal generation publishes disconnected forests.

**Original proposed change:** correct the algorithm description to match the current implementation. Changing per-candidate acceptance instead would be algorithm work that may change deterministic output and needs its own compatibility decision; do not do that merely to make the prose true.

**Acceptance criteria:** documentation accurately distinguishes placement checks, final validation, generation retries, and preserved-map fallback, and states the actual circle count. A documentation-only correction needs no golden or version changes.

## Items reviewed without recommending an immediate refactor

- **More services or component splits:** current boundaries are appropriate. A larger future library UI may justify row/editor components; the current line counts do not establish that need.
- **More map types:** preserve discriminated models, per-type drafts, pure generators, explicit rendering/validation dispatch, and historical save vocabularies. Extend the workbench and labels deliberately when adding a third type. Do not introduce a registration/plugin framework ahead of a concrete feature.
- **Production option arrays and union types:** current values agree and tests pin them. Deriving unions from readonly tuples could remove another manual synchronization point when these definitions next change. Keep historical save-format arrays independent.
- **Legacy normalization:** current v3 artwork is protected by an actual stored fixture and pixel hashes. If the default forest character changes, keep the historical v3-to-Verdant migration explicit rather than letting a new UI default redefine old artwork.
- **Preview lifecycle:** cleanup is sound. Its `afterNextRender` callback is labeled `write` but calls `resize()`, which measures `getBoundingClientRect()` before drawing. On a future viewport change, separate measurement/drawing phases or declare the mixed work accurately. Angular's [render-phase guidance](https://angular.dev/guide/components/lifecycle#aftereveryrender-and-afternextrender) explains this distinction. No current visual failure or measured performance regression was established, so this is not a blocker.
- **Performance:** synchronous generation/rendering and whole-library JSON writes deserve measurement if maps or libraries grow. The fixed grid and current bundle do not justify workers, virtualization, or a storage migration solely on speculation. Two animation frames remain a UI-yield heuristic, not a paint guarantee.
- **Shared styles:** panel headings and buttons still have intentional differences. Share a behavior or a stable visual rule when it actually repeats; avoid universal wrapper components.
- **Forms:** native events and typed drafts correctly support the configured submission workflow. A move to Signal Forms or reactive forms needs a concrete benefit; it is not required to make this app idiomatic.
- **Tooling:** an ESLint configuration may be useful for a specific rule gap, but compiler checks and formatting already enforce substantial policy. Preserve the existing CI checks. Expand browser coverage when support requirements justify it; Chromium-only verification is a stated limitation, not evidence of a failure in another engine.

## Suggested order and safeguards

1. **Completed:** QR01/QR02 now protect persistence across tabs and unreadable local data. Keep these guards and their regressions when tightening acceptance rules.
2. **Completed:** QR03 tightens schema/domain acceptance, preserves historical models and golden baselines, and handles revision exhaustion with recovery.
3. **QR04/QR05 completed:** keyboard focus, disabled import presentation, and text contrast are covered by browser checks, contrast calculation, and visual inspection. **QR06 completed:** all six import failure/recovery cases pass independent acceptance verification.
4. **QR07 completed:** bundle headers and records share an explicit supported-version policy, documented and covered by parser/browser regressions. **QR08 completed:** the readonly collection contract is independently verified and guarded by a compile-time regression. QR09 was addressed alongside the persistence/UI changes. **QR10 completed:** forest algorithm documentation now distinguishes placement checks, final validation, bounded generation attempts, and preserved-map fallback.

Keep new features, dependency upgrades, generator algorithm changes, and artwork redesigns separate from these corrections. The review does not authorize implementing every recommendation, and there is no reason to reopen completed AR items merely to change naming or move files again.
