# Encounter Map Forge

A browser-only Angular workbench for making dungeon and forest-clearing battle maps with distinct character. It opens with a complete map, generates connected rooms and corridors (dungeon) or a woodland clearing with a path between two edges (forest), shuffles decoration without changing the layout, and exports a full-resolution PNG. The implementation follows [the project brief](encounter-map-forge-brief.md).

## Run locally

```sh
npm ci
npm start
```

Open `http://127.0.0.1:4200`. Build the static application with `npm run build`; output is in `dist/encounter-map-forge/browser`. There is no backend, account, cloud sync, or deployment configuration. The initial map loads on a fresh browser; maps you save to the library persist in that browser's local storage and survive a refresh.

## Verified tooling

Stable versions were checked on **15 October 2026**, using the [official Angular releases](https://github.com/angular/angular/releases), [Angular compatibility table](https://angular.dev/reference/versions), and npm's `latest` tags for [Angular core](https://registry.npmjs.org/@angular/core/latest) and [CLI](https://registry.npmjs.org/@angular/cli/latest). Prereleases were excluded.

| Tool                                | Version |
| ----------------------------------- | ------- |
| Angular framework and compiler      | 22.2.3  |
| Angular CLI and application builder | 22.2.2  |
| TypeScript                          | 6.0.3   |
| Node used for verification          | 22.23.3 |
| npm used for verification           | 10.9.9  |
| Vitest                              | 4.0.18  |

Angular 22 requires Node `^22.22.3`, `^24.15.0`, or `>=26.0.0` and TypeScript `>=6.0.0 <6.1.0`. The framework, CLI, builder, compiler and TypeScript versions are pinned in `package.json`; the entire dependency tree is recorded in `package-lock.json`. Vitest is pinned to avoid an npm 10 optional-peer resolution crash observed with the newer 4.1 release.

## Using the workbench

- **Map type:** choose Dungeon or Forest. Each type retains its own map — switching restores the last map you generated for that type (with its current density, revision, and character). Each type also retains its own pending settings when you switch away and back.
- **Configure, then generate:** seed, rooms, character, and decoration are pending settings. The displayed map stays unchanged until you choose **Generate dungeon** or **Generate forest**. A settings-changed message and **Reset changes** action identify pending edits. Generate is disabled when settings match the displayed map. When Generate is clicked, pending seed or room changes create a new layout at detail revision 0; pending appearance-only changes preserve the layout, surface texture, and revision.
- **World seed:** a trimmed string of 1–64 characters. The same generated settings and generator version reproduce the same map. Editing the seed changes only the draft.
- **Rooms:** (dungeon only) choose an integer from 4–8. The map always contains 40 columns × 30 rows. The stepper normalizes the draft first — blank or non-numeric becomes 6, a fraction rounds down — then clamps to 4–8, so its buttons always agree with the value they set.
- **Randomize seed:** fills the draft with a new seed using browser cryptographic randomness. Choose Generate to apply it; randomizing alone never changes the map.
- **Decoration:** Sparse, Balanced and Cluttered apply when you choose Generate, with conservative blocking-prop budgets of 5%, 10% and 15% of room floor area (dungeon) or walkable area (forest). The engine may place fewer props to protect access.
- **Character:** Mosslit, Crypt, Storehouse and Sanctuary give dungeons their identity; Verdant woodland, Autumn grove, Ancient pines and Fey glade do the same for forests. A character change applies when you choose Generate and preserves the layout, carved route, path endpoints, surface texture, and detail revision. Each preset uses its own deterministic decoration stream, its own prop mix, and — for forests — its own trees, ground cover, and atmosphere.
- **Shuffle details:** immediately advances the displayed detail revision, changing props and accents while preserving every tile, dungeon connection and landmark, and forest path. It uses the displayed map’s accepted settings and leaves pending edits untouched.
- **Grid:** controls both the preview and export. It starts enabled.
- **Explore:** drag with a pointer, or focus the canvas and use arrow keys to pan. Use the zoom buttons, `+` / `-`, or Ctrl/Command + wheel over the preview to zoom. **Fit** or `Home` recenters the whole map. Ordinary wheel scrolling remains page scrolling. Zoom is relative to fit and ranges from 50% to 400%.
- **Export PNG:** downloads the entire 2560 × 1920 image, at 64 pixels per tile, using the current grid toggle. Preview zoom and pan never affect the export. Filenames include the map type, generated seed, character (preset for dungeons, forest character for forests), density, detail revision and generator version; unapplied drafts are excluded and unsafe filename characters are removed.
- **Map library:** save the current generated map with a name and thumbnail, then reopen, rename, duplicate, favorite, or delete it. Saving is explicit and always records the accepted generated map — its seed, type, settings, and revision — never unapplied drafts. Opening a save restores its accepted controls and clears pending edits for that map type. Saves live in this browser's local storage only. **Download backup** writes them to a JSON file and **Import backup** restores them; new records and backups use save-format version 2.0.0, which older app versions reject. Format-1 records remain readable and are upgraded on import or load without regenerating their maps.

Dungeons use stairs for the entrance and a circular stone dais for the objective. These are architectural landmarks, with no encounters, hidden information or game mechanics. Forest paths continue off two map edges; their endpoints are unmarked. A suggested scale is 5 feet per square; the exported image has no VTT metadata.

For reproduction, record the **generated seed, map type, room count (dungeon only), density, character (Mosslit/Crypt/Storehouse/Sanctuary for dungeons, Verdant/Autumn/Pines/Fey for forests), detail revision and generator version (4.0.0)**. For manual reproduction, start from a freshly loaded page, select the map type and recorded settings, and choose Generate if settings are pending. The map starts at revision 0; Shuffle details the recorded number of times. Use the matching generator version. Appearance-only changes to an existing map preserve its current revision. The summary always describes the current generated map, even while draft settings are being edited.

## Engine and model

`src/app/engine` is pure TypeScript, with no Angular or DOM dependency. `generateDungeon(settings)` and `generateForestClearing(settings)` each return a discriminated success/failure result. Generation and rendering never use `Math.random()` or `Date.now()`.

The `GeneratedMap` discriminated union carries a `type: 'dungeon' | 'forest'` tag. Both map types share `version`, `seed`, `layout`, `decoration` and `surfaceSeed` fields. The layout and decoration shapes differ: dungeon layouts have rooms, connections, thresholds and landmarks; forest layouts have walkable tiles, path start and end points, and a stored route (the tiles visited during path carving, deduplicated). The renderer and exporter dispatch on the type tag.

Coordinates use **x = column, y = row**, with zero-based tile indices and half-open room bounds: `[x, x + width)` and `[y, y + height)`. Tiles are stored row-major at `y * 40 + x`. Thresholds are explicit two-tile grid edges; horizontal edges span increasing x and vertical edges span increasing y. Doors are passable.

The seeded engine uses unsigned 32-bit **FNV-1a over UTF-16 code units** for stable string hashing and **Mulberry32** for pseudorandom values. Versioned, separately derived streams govern layout, decoration (keyed by preset, density and revision for dungeons; character, density and revision for forests) and surface texture. Surface samples are also keyed by tile coordinates. Map data are deterministic for the same reproduction settings; browser rasterization can differ slightly between browsers.

Both map types use `gridDistances` in `engine/grid-traversal.ts` for four-neighbor shortest paths, preserving left/right/up/down discovery order. The existing `distances` and `forestDistances` names are aliases to that function. Dungeon thresholds/landmarks and forest route rules remain in their domain modules. `shuffleInPlace` in `engine/random.ts` implements Fisher–Yates for locally owned candidate arrays of non-null values; it consumes one inclusive `int(0, i)` draw per descending index, including self-swaps, and none for empty or singleton arrays. Generated maps and caller-owned layouts remain immutable. Connectivity tests retain separate test-only searches, and shuffled-order/next-draw fixtures pin RNG consumption independently of production constants.

**Version history.** Version 4.0.0 added forest character presets (Verdant, Autumn, Pines, Fey); the forest decoration stream key now includes the character name, which changes every seed's forest decoration output (including Verdant). Forest maps saved before 4.0.0 carry no character; the library keeps their original artwork and treats them as Verdant, which reproduces the familiar green forest. Version 3.0.0 added the forest clearing map type. A `type: 'dungeon' | 'forest'` discriminator is now part of every `GeneratedMap`. Version 2.0.0 added decoration presets to dungeons; the decoration stream key includes the preset name. The `GENERATOR_VERSION` constant is the authoritative compatibility marker; all stream keys include it, so a map from an older version with the same seed produces different output under a newer version.

**Save compatibility.** Save-format 2.0.0 records the forest character explicitly. Loading or importing format-1 records upgrades their record version in memory; the next library write persists the upgrade, and backup exports use format 2.0.0. This also upgrades records from the initial I19 implementation that already stored a character under format 1.0.0. A v3 forest without a character is normalized to Verdant before validation, preserving its original layout, surface seed, props, and generator version. Current v4 forests must include a known character. Default save names remain seed-based (for example, `woodland-glade clearing`); the character appears in the map and library summaries and PNG filename.

Schema vocabulary is checked against the record's own save-format version, not the live engine lists. A new density, preset, character, or prop kind added to the engine after a format release does not automatically become readable in backups from earlier format versions; adding it requires an explicit decision to bump `SAVE_FORMAT_VERSION` or to provide a migration. This prevents a newer app from silently producing backups that older versions accept as their own format.

Opening a legacy save preserves its exact artwork. Later shuffling, density changes, or character changes use the current v4 decoration streams on the retained legacy layout and surface. Those edited maps keep their original generator-version field as layout provenance; seed/settings/version alone cannot reproduce that mixed-version snapshot. Keep a library backup to preserve it exactly.

**Dungeon generation.** Room placement has at most **16 deterministic retries × 320 attempts**. Each room is 5–9 tiles wide and 4–7 tiles high, with two solid tiles of separation before corridors are carved and an intact outer border. A deterministic minimum spanning tree connects room centers, using squared distance and stable room-ID tie-breaking. Orthogonal corridors carve two-tile clearance. At most one extra connection is added when final-tile shortest paths show a useful short alternative. Corridors may merge and enter other rooms.

Actual floor topology determines connectivity, visible walls, and unambiguous corridor-to-room thresholds. Broad openings and ambiguous intersections have no decorative door. Landmark selection maximizes traversable center-to-center distance between different rooms using breadth-first search. The final floor field must form one component.

**Forest clearing generation.** The clearing is an irregular blob of walkable tiles built from 4–5 overlapping circles. A 2-tile-wide orthogonal path connects two map edges through the clearing, with 1–2 bends. The carved route is stored explicitly in the layout (all tiles visited during carving, deduplicated) and used for both rendering and prop exclusion. The path start and end are on the map edges. At least 200 walkable tiles are required. Trees are placed on non-walkable tiles near the clearing edge. Blocking props (boulders, logs, stumps) are placed on walkable tiles; breadth-first search confirms all remaining walkable tiles stay connected after each placement.

Forest characters shape decoration and artwork together. Verdant keeps the familiar mix of broadleaf and pine canopies, bushes, ferns, mushrooms and mossy logs. Autumn favors gold and russet broadleaf canopies, leaf-toned undergrowth and extra mushrooms on a bronze floor with fallen-leaf patches. Pines places clustered evergreens, weathered stumps, deadwood and mossy boulders over a needle-covered floor. Fey grows unusual curved trees, flowering ground cover and faintly glowing mushroom clusters on a teal-tinted glade. Character changes only the prop selection probabilities, undergrowth counts, and rendering palette; placement budgets, route exclusion and connectivity validation are shared.

Dungeon decoration follows validation. Crates, barrels, rubble, sarcophagi and broken columns block their tile; rugs, moss, vines and sconces are decorative. Forest decoration places trees in the forest floor, boulders/ferns/bushes at clearing edges, flowers and mushrooms in the clearing interior, and logs along the clearing edge. Corridor tiles and neighboring room-entry space, thresholds, landmarks and their adjacent tiles are reserved. After every proposed blocking placement, breadth-first search confirms all remaining walkable tiles are connected and every room still has a clear 2 × 2 area (dungeon only). Placement is bounded by a finite candidate list. Changing density, preset or shuffling creates new decoration without mutating an existing map.

## Rendering and interface

PNG exports and JSON backups share `browser/download.ts` for temporary links and object URLs. The helper removes the link after activation or failure and schedules URL revocation after 30 seconds, preserving the existing download lifetime. Each caller retains file preparation and user feedback. Backup failures show a retry message; a successful retry clears the previous library error.

The root component provides one `WorkbenchSession` for its workbench. That service owns the accepted dungeon and forest maps, the active map type, and each type's pending settings. The displayed map is computed from the accepted map collection; switching, opening, generating, resetting, and shuffling use session commands rather than maintaining a separate current-map copy. Each initial map is generated once per session. Grid state, the busy lock, UI yielding, messages, and download coordination remain in the root component; pan/zoom stay in `Preview`, and saved-map persistence stays in `SaveStore`. Session transitions are tested without rendering a page. Drafts have separate dungeon and forest types: room text and dungeon presets exist only on dungeon drafts, and forest characters exist only on forest drafts. Pure conversion functions validate a draft into its map-specific generator settings without changing raw inputs. Draft edits identify their map type; edits for an inactive type are ignored. Failed validation or generation leaves the accepted map and pending input available for correction or retry.

`SettingsPanel` owns the settings form, detail action, accepted-style note, and their responsive styles. `MapPanel` owns the map header, grid control, generated-map summary, and its embedded `Preview`. Both receive readonly signal inputs and emit typed user actions to `App`; neither keeps a second settings state or accesses persistence. They use [native-element component selectors](https://angular.dev/guide/components/selectors#when-to-use-an-attribute-selector) on the existing `<aside>` and `<section>`, preserving landmarks and grid layout without extra wrappers. Page composition, export/message rows, and library integration stay in `App`.

`renderMap(context, map, options)` is the shared drawing entry point for preview, PNG export, and library thumbnails. Its exhaustive map-type dispatch calls `renderDungeon` or `renderForest` through one `RenderOptions` contract. The renderers share tile-boundary tracing and the grid path while retaining their own floor textures, wall/clearing-edge styles, palettes, and layer order. Preview and export retain 64 pixels per tile and the selected grid setting; thumbnails use 8 pixels per tile with no grid. Canvas creation, viewport handling, and image encoding remain with their consumers. Visual-review fixtures can still call the concrete renderers directly. Dungeons draw seeded slab fills and chips, continuous topology-derived wall contours, contact shadows, masonry joints, thresholds, architectural landmarks, props, restrained light, and the optional whole-map grid. Forests draw textured ground, a dirt path, clearing edges, trees, rocks, and undergrowth, with per-character ground tones, tree shapes, and prop palettes. All artwork is original Canvas vector drawing; there are no external images, fonts, asset licenses or runtime fetches.

The showcase in `src/app/engine/showcase.ts` supplied the first renderer fixture: three rooms, two bent corridors, thresholds, and the prop collection. Its full export and close-up were inspected before implementing random generation.

The Angular app uses standalone OnPush components, Signals and computed state, strict TypeScript with unchecked-index checking, strict templates, built-in control flow, and native form controls. A map-type selector switches between Dungeon and Forest. `WorkbenchSession` owns draft/accepted settings; `App` coordinates actions and recoverable errors; `Preview` owns canvas lifecycle, resize observation and viewport state. Preview artwork is cached independently of viewport movement, drawn at device pixel ratio, and regenerated only when map data or grid visibility change. Export uses a separate canvas and asynchronous Blob creation. Conflicting controls are disabled during operations and restored after failures. Before a heavy action runs, the app yields two animation frames so the disabled state can paint first.

Canvas has a descriptive accessible label, an adjacent generated-map summary, keyboard controls, and visible focus feedback. It does not expose individual map tiles as accessible interactive elements. The workbench stacks above the preview on narrow screens.

Generation remains separate from rendering. Supporting another map type requires an explicit drawing branch in `renderMap`, without a plugin framework.

## Checks and visual review

```sh
npm test
npm run typecheck:tests
npm run build
npm run format:check
npx playwright install chromium
npm run test:e2e
```

The Playwright browser download is needed once. The browser suite starts and stops a local dev server, or reuses an existing server on port 4200. Tests generate ignored review artifacts in `artifacts/`, including desktop/mobile screenshots and a browser-exported PNG. `npm test` also renders the showcase, six full maps, close-ups, a contact sheet, and the four forest characters using the development-only `@napi-rs/canvas` package. Use `npm run format` to format source, tests and configuration.

Engine tests cover deterministic equality, immutable inputs/previous maps, a batch of **45 successful seeds** spanning 4–8 rooms and all densities (dungeon), explicit bounded failure, invalid settings, border integrity, room count, topology, reachable landmarks, safe decoration, independent detail shuffling, and view-independent generation. Forest tests cover **30 successful seeds** across all densities, connectivity, tree placement on non-walkable tiles, blocking prop validation, open-space minimums, per-character generation invariants across all four characters, and character changes that preserve layout, route, endpoints, surface seed and revision. Browser tests cover initial rendering, distinct actions, draft isolation, input correction, revision summaries, zoom/pan/fit/grid, responsive resizing, exact export dimensions, viewport-independent export bytes, recovery after a simulated Blob failure, map-type switching between dungeon and forest (including forest character selection, pending drafts, and export filenames), and saving, reopening, renaming, duplicating, favoriting, deleting, and backing up maps. The save format is unit-tested against generated dungeon and forest models, including malformed backups, future-version rejection, legacy forest records without a character, and unknown characters. Test sources and review scripts are type-checked separately from the application build.

The frozen backup `src/app/save/fixtures/forest-v3.json` was captured from the pre-I19 generator and renderer at commit `b8aa51bc02b92ccd3c18232ef02e3d505b4285af` (generator 3.0.0). It contains emerald-path/Sparse/r0, woodland-glade/Balanced/r1, and ancient-grove/Cluttered/r2. Renderer tests pin SHA-256 hashes of their raw RGBA pixels at 2560 × 1920 with grid on and off, captured using the previous renderer and `@napi-rs/canvas` 0.1.100. These sampled baselines are independent of the current generator; review rendering changes and rasterizer upgrades before replacing them.

Six curated review cases were inspected at fit-to-view and close-up, alongside the original showcase and a browser-exported PNG:

| Seed              | Rooms | Density   |
| ----------------- | ----- | --------- |
| mosslit-sanctum   | 6     | Balanced  |
| amber-vault       | 4     | Sparse    |
| forgotten-library | 8     | Cluttered |
| lantern-watch     | 7     | Sparse    |
| moss-and-memory   | 5     | Cluttered |
| silver-crypt      | 8     | Balanced  |

These cases are review fixtures, not replacements for failed generation. Visual checks looked at corners, thresholds, corridor clearance, prop scale, open play space, grid alignment and legibility. The four forest characters were reviewed the same way from `artifacts/forest-*.png` and `artifacts/forest-characters.png` (full maps, close-ups and a contact sheet for one shared seed, plus browser previews of a pending and an applied character change). Desktop and mobile Chromium previews were inspected. Other browser engines and touch hardware have not been manually verified. Procedural composition varies: low room counts can leave large solid areas, corridors can cross or merge, and doors are intentionally omitted at ambiguous openings. The renderer prioritizes clear, stylized stonework over photorealism. There is no guarantee that every seed has equally strong composition.

Caves, taverns, manual editing, cloud accounts and sync, encounters, fog of war, dynamic lighting and VTT integrations remain outside this release. Browser-local saving is included (see the map library above).
