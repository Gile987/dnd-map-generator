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

- **Map type:** choose Dungeon or Forest. Each type retains its own map — switching restores the last map you generated for that type (with its current density, revision, and preset for dungeons). The seed is shared between types.
- **World seed:** a trimmed string of 1–64 characters. Edit the seed or room count, then choose **Generate dungeon** (or **Generate forest**) to apply the layout settings and reset the detail revision. A pending-settings message distinguishes the draft from the generated map.
- **Rooms:** (dungeon only) choose an integer from 4–8. The map always contains 40 columns × 30 rows. The stepper normalizes the draft first — blank or non-numeric becomes 6, a fraction rounds down — then clamps to 4–8, so its buttons always agree with the value they set.
- **New seed:** uses browser cryptographic randomness and generates immediately using the draft room count.
- **Decoration:** Sparse, Balanced and Cluttered apply immediately to the current layout, with conservative blocking-prop budgets of 5%, 10% and 15% of room floor area (dungeon) or walkable area (forest). The engine may place fewer props to protect access.
- **Character:** (dungeon only) Mosslit, Crypt, Storehouse and Sanctuary change the prop palette and floor/wall palette immediately, without rebuilding the layout. Each preset uses its own deterministic decoration stream.
- **Shuffle details:** advances the displayed detail revision, changing props and accents while preserving every tile, dungeon connection and landmark, and forest path.
- **Grid:** controls both the preview and export. It starts enabled.
- **Explore:** drag with a pointer, or focus the canvas and use arrow keys to pan. Use the zoom buttons, `+` / `-`, or Ctrl/Command + wheel over the preview to zoom. **Fit** or `Home` recenters the whole map. Ordinary wheel scrolling remains page scrolling. Zoom is relative to fit and ranges from 50% to 400%.
- **Export PNG:** downloads the entire 2560 × 1920 image, at 64 pixels per tile, using the current grid toggle. Preview zoom and pan never affect the export. Filenames include the map type, generated seed, density, detail revision and generator version; unapplied drafts are excluded and unsafe filename characters are removed.
- **Map library:** save the current generated map with a name and thumbnail, then reopen, rename, duplicate, favorite, or delete it. Saving is explicit and always records the accepted generated map — its seed, type, settings, and revision — never unapplied drafts. Saves live in this browser's local storage only. **Download backup** writes them to a JSON file and **Import backup** restores them; the backup records the save-format version (1.0.0) and each map's generator version, so a later release never silently reinterprets an older map.

Dungeons use stairs for the entrance and a circular stone dais for the objective. These are architectural landmarks, with no encounters, hidden information or game mechanics. Forest paths continue off two map edges; their endpoints are unmarked. A suggested scale is 5 feet per square; the exported image has no VTT metadata.

For reproduction, record the **generated seed, map type, room count (dungeon only), density, preset (dungeon only), detail revision and generator version (3.0.0)**. Start at revision 0 with Generate, then Shuffle details the recorded number of times. Set the density and preset to the recorded values. The summary always describes the current generated map, even while draft settings are being edited.

## Engine and model

`src/app/engine` is pure TypeScript, with no Angular or DOM dependency. `generateDungeon(settings)` and `generateForestClearing(settings)` each return a discriminated success/failure result. Generation and rendering never use `Math.random()` or `Date.now()`.

The `GeneratedMap` discriminated union carries a `type: 'dungeon' | 'forest'` tag. Both map types share `version`, `seed`, `layout`, `decoration` and `surfaceSeed` fields. The layout and decoration shapes differ: dungeon layouts have rooms, connections, thresholds and landmarks; forest layouts have walkable tiles, path start and end points, and a stored route (the tiles visited during path carving, deduplicated). The renderer and exporter dispatch on the type tag.

Coordinates use **x = column, y = row**, with zero-based tile indices and half-open room bounds: `[x, x + width)` and `[y, y + height)`. Tiles are stored row-major at `y * 40 + x`. Thresholds are explicit two-tile grid edges; horizontal edges span increasing x and vertical edges span increasing y. Doors are passable.

The seeded engine uses unsigned 32-bit **FNV-1a over UTF-16 code units** for stable string hashing and **Mulberry32** for pseudorandom values. Versioned, separately derived streams govern layout, decoration (keyed by preset, density and revision for dungeons; density and revision for forests) and surface texture. Surface samples are also keyed by tile coordinates. Map data are deterministic for the same reproduction settings; browser rasterization can differ slightly between browsers.

**Version history.** Version 3.0.0 added the forest clearing map type. A `type: 'dungeon' | 'forest'` discriminator is now part of every `GeneratedMap`. The `GENERATOR_VERSION` constant is the authoritative compatibility marker; all stream keys include it. Version 2.0.0 added decoration presets to dungeons; the decoration stream key includes the preset name. A v1.0.0 map with the same seed produces different output under 2.0.0 or 3.0.0.

**Dungeon generation.** Room placement has at most **16 deterministic retries × 320 attempts**. Each room is 5–9 tiles wide and 4–7 tiles high, with two solid tiles of separation before corridors are carved and an intact outer border. A deterministic minimum spanning tree connects room centers, using squared distance and stable room-ID tie-breaking. Orthogonal corridors carve two-tile clearance. At most one extra connection is added when final-tile shortest paths show a useful short alternative. Corridors may merge and enter other rooms.

Actual floor topology determines connectivity, visible walls, and unambiguous corridor-to-room thresholds. Broad openings and ambiguous intersections have no decorative door. Landmark selection maximizes traversable center-to-center distance between different rooms using breadth-first search. The final floor field must form one component.

**Forest clearing generation.** The clearing is an irregular blob of walkable tiles built from 4–5 overlapping circles. A 2-tile-wide orthogonal path connects two map edges through the clearing, with 1–2 bends. The carved route is stored explicitly in the layout (all tiles visited during carving, deduplicated) and used for both rendering and prop exclusion. The path start and end are on the map edges. At least 200 walkable tiles are required. Trees are placed on non-walkable tiles near the clearing edge. Blocking props (boulders, logs, stumps) are placed on walkable tiles; breadth-first search confirms all remaining walkable tiles stay connected after each placement.

Dungeon decoration follows validation. Crates, barrels, rubble, sarcophagi and broken columns block their tile; rugs, moss, vines and sconces are decorative. Forest decoration places trees in the forest floor, boulders/ferns/bushes at clearing edges, flowers and mushrooms in the clearing interior, and logs along the clearing edge. Corridor tiles and neighboring room-entry space, thresholds, landmarks and their adjacent tiles are reserved. After every proposed blocking placement, breadth-first search confirms all remaining walkable tiles are connected and every room still has a clear 2 × 2 area (dungeon only). Placement is bounded by a finite candidate list. Changing density, preset or shuffling creates new decoration without mutating an existing map.

## Rendering and interface

`renderDungeon(context, map, options)` and `renderForest(context, map, options)` are shared by the preview, export, and visual-review fixtures. Dungeons draw seeded slab fills and chips, continuous topology-derived wall contours, contact shadows, masonry joints, thresholds, architectural landmarks, props, restrained light, and the optional whole-map grid. Forests draw textured grass, a dirt path, clearing edges, tree canopies, rocks, and undergrowth. All artwork is original Canvas vector drawing; there are no external images, fonts, asset licenses or runtime fetches.

The showcase in `src/app/engine/showcase.ts` supplied the first renderer fixture: three rooms, two bent corridors, thresholds, and the prop collection. Its full export and close-up were inspected before implementing random generation.

The Angular app uses standalone OnPush components, Signals and computed state, strict TypeScript with unchecked-index checking, strict templates, built-in control flow, and native form controls. A map-type selector switches between Dungeon and Forest. `App` owns draft/accepted settings, actions and recoverable errors; `Preview` owns canvas lifecycle, resize observation and viewport state. Preview artwork is cached independently of viewport movement, drawn at device pixel ratio, and regenerated only when map data or grid visibility change. Export uses a separate canvas and asynchronous Blob creation. Conflicting controls are disabled during operations and restored after failures. Before a heavy action runs, the app yields two animation frames so the disabled state can paint first.

Canvas has a descriptive accessible label, an adjacent generated-map summary, keyboard controls, and visible focus feedback. It does not expose individual map tiles as accessible interactive elements. The workbench stacks above the preview on narrow screens.

The `generateDungeon` and `renderDungeon` boundaries allow a separate forest generator later, without introducing a plugin framework or displaying an unfinished map type.

## Checks and visual review

```sh
npm test
npm run typecheck:tests
npm run build
npm run format:check
npx playwright install chromium
npm run test:e2e
```

The Playwright browser download is needed once. The browser suite starts and stops a local dev server, or reuses an existing server on port 4200. Tests generate ignored review artifacts in `artifacts/`, including desktop/mobile screenshots and a browser-exported PNG. `npm test` also renders the showcase, six full maps, close-ups, and a contact sheet using the development-only `@napi-rs/canvas` package. Use `npm run format` to format source, tests and configuration.

Engine tests cover deterministic equality, immutable inputs/previous maps, a batch of **45 successful seeds** spanning 4–8 rooms and all densities (dungeon), explicit bounded failure, invalid settings, border integrity, room count, topology, reachable landmarks, safe decoration, independent detail shuffling, and view-independent generation. Forest tests cover **30 successful seeds** across all densities, connectivity, tree placement on non-walkable tiles, blocking prop validation, and open-space minimums. Browser tests cover initial rendering, distinct actions, draft isolation, input correction, revision summaries, zoom/pan/fit/grid, responsive resizing, exact export dimensions, viewport-independent export bytes, recovery after a simulated Blob failure, map-type switching between dungeon and forest, and saving, reopening, renaming, duplicating, favoriting, deleting, and backing up maps. The save format is unit-tested against generated dungeon and forest models, including malformed backups and future-version rejection. Test sources and review scripts are type-checked separately from the application build.

Six curated review cases were inspected at fit-to-view and close-up, alongside the original showcase and a browser-exported PNG:

| Seed              | Rooms | Density   |
| ----------------- | ----- | --------- |
| mosslit-sanctum   | 6     | Balanced  |
| amber-vault       | 4     | Sparse    |
| forgotten-library | 8     | Cluttered |
| lantern-watch     | 7     | Sparse    |
| moss-and-memory   | 5     | Cluttered |
| silver-crypt      | 8     | Balanced  |

These cases are review fixtures, not replacements for failed generation. Visual checks looked at corners, thresholds, corridor clearance, prop scale, open play space, grid alignment and legibility. Desktop and mobile Chromium previews were inspected. Other browser engines and touch hardware have not been manually verified. Procedural composition varies: low room counts can leave large solid areas, corridors can cross or merge, and doors are intentionally omitted at ambiguous openings. The renderer prioritizes clear, stylized stonework over photorealism. There is no guarantee that every seed has equally strong composition.

Caves, taverns, manual editing, cloud accounts and sync, encounters, fog of war, dynamic lighting and VTT integrations remain outside this release. Browser-local saving is included (see the map library above).
