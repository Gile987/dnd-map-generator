# Encounter Map Forge — project and implementation brief

## Purpose and working instructions

Build a colorful, attractive 2D encounter-map generator for D&D and other tabletop role-playing games. The product should feel like a creative tool: generate a usable map, adjust its character, keep a layout while changing decoration, and export it for play.

Read this document and the workspace instructions before starting. Inspect existing code and preserve relevant work. Implement the project rather than returning another planning document. Make routine technical decisions independently; ask about actual blockers or material changes to scope. Do not deploy unless requested.

The user's main concern is visual quality. A technically correct map made of flat rectangles is not a successful result. Prioritize one convincing dungeon style over many unfinished generators. The selected direction is battle maps, not regional maps or islands.

## Scope

### First release: dungeon battle maps

- One polished top-down stone-dungeon style.
- Fixed 40 × 30 tile map.
- Connected rooms and corridors, readable walls, door thresholds, entrance and objective areas.
- Deterministic seed, room-count setting, decoration-density setting.
- Generate, New seed, and Shuffle details actions.
- Grid toggle, zoom, pan, fit-to-view, and PNG export.
- Useful initial map loaded immediately.

### Next release: forest clearings

Design the generator/rendering boundary so another map type can be added, but implement only the dungeon in the first release. Do not show an enabled forest option before it works. After the dungeon meets its quality gates, forests can use the same preview/export controls with their own generation rules and assets.

Caves, ruins, and taverns are potential later types. Do not build placeholders or a generalized plugin framework for them now.

## Technology

- Angular: use the latest stable release available when implementation starts. Verify the official release information and package registry; record exact Angular/CLI versions in the README and lockfile. Do not choose Angular 19 based on earlier preferences. Exclude next/RC releases.
- Check compatible Node.js and TypeScript requirements before scaffolding. Sources: https://angular.dev/reference/versions and https://github.com/angular/angular/releases.
- Standalone components, strict TypeScript, strict template checking, Signals, computed state, OnPush, and @if/@for with stable tracking.
- No any, unsafe double assertions, or non-null assertions used to bypass errors.
- Native HTML controls and SCSS for the interface; Canvas 2D for map rendering and PNG output.
- Pure TypeScript generation and validation, independent of Angular and the DOM.
- No code comments unless requested; document decisions in the README.
- No backend, authentication, AI service, external API, database, or persistence in the MVP.
- No physics/game engine or state-management library. Use a library only to solve a concrete problem that native APIs cannot reasonably handle.
- Browser-only application. No SSR required.

## Visual direction: the mosslit stone dungeon

The map should resemble a carefully composed tabletop illustration, not a debugging grid or photorealistic render. Use a consistent top-down view with light from the upper left.

Suggested starting palette, adjustable during visual review:

| Element | Color direction |
| --- | --- |
| Unexplored solid background | Deep blue-charcoal, approximately #18232B |
| Stone floor | Muted blue-gray, approximately #778B91 |
| Wall top surfaces | Cool slate, approximately #40545E |
| Edge highlights | Pale gray-green, approximately #B7C6BE |
| Moss and vegetation | Restrained teal-green, approximately #3E8272 |
| Warm accents | Amber lantern light, approximately #E9B76D |
| Optional fabric details | Muted burgundy, approximately #854E60 |

The strongest contrast must communicate walkable space versus walls. Keep floor details quiet enough for tokens and grid lines to remain visible.

Required visual ingredients:

1. Coherent floor slabs with slight seeded tone variation, restrained seams, and occasional chips or cracks.
2. Continuous wall boundaries with visible thickness, consistent corner joins, highlights, and contact shadows. Internal shared floor edges must not become walls.
3. Doors or thresholds aligned with room entrances, without awkward floating symbols or blocked corridors.
4. A small consistent prop collection: crates, barrels, stone rubble, rugs, wall sconces, and stairs or an entrance marking.
5. Sparse moss near appropriate edges and small warm accents. Lighting is decorative, not a line-of-sight system, and cannot hide terrain.
6. A crisp optional grid with evenly spaced lines across the entire map.

Use reusable Canvas drawing functions for simple vector-like assets. This keeps output deterministic and exportable without an external asset pack. Do not use emoji, unrelated icon sets, or randomly mixed illustration styles. Raster assets may be introduced only if they materially improve the look; bundle them locally and document their licenses. Do not make image generation a runtime dependency.

## Build the appearance before the algorithm

First create a fixed showcase layout with three rooms, two corridors, several turns, a doorway, and a few props. Implement the real renderer against this layout, not a separate mockup that cannot be reused.

Render both the full map and a close-up. Inspect wall joins, shadows, floor variation, prop scale, and readability. Improve this fixture until it looks deliberate before producing many random layouts.

Do not stop after the showcase unless blocked. Continue into generation with the same renderer. If visual inspection tools are unavailable, state that limitation rather than claiming visual quality has been checked.

## Map model and determinism

Separate three concerns:

- Layout: tile topology, room bounds, connections, door thresholds, entrance, and objective.
- Decoration: seeded floor variation and visual props.
- View: grid visibility, zoom, pan, and preview dimensions.

Use strict types for positions, room IDs, tiles, connections, props, settings, and generation results. Coordinates must have an explicit convention: x is column, y is row, and tile bounds are consistent throughout. Represent door thresholds as edges or another explicit structure that the renderer and validator both understand.

Use a documented seeded pseudorandom generator and stable string-to-seed hashing. Never call Math.random() or Date.now() inside generation or rendering. Randomness for New seed may use crypto.getRandomValues outside the deterministic engine.

Use separate derived random streams for layout, decoration, and surface texture. Same seed, settings, detail revision, and generator version must reproduce the same model. Changing grid, zoom, pan, or export resolution must not change the map. Pixel-perfect cross-browser raster output is not required.

Shuffle details increments a detail revision and changes props/accents while preserving every layout tile, connection, entrance, and objective. Display the revision so an exported map can be reproduced. Changing decoration density also preserves layout. Keep floor texture stable during zoom and ordinary redraws.

## Dungeon generation rules

Use a simple bounded room-placement algorithm suitable for this grid:

1. Keep at least a one-tile solid border around the map.
2. Place rectangular rooms with interiors roughly 5–9 tiles wide and 4–7 tiles high. Reject overlap and retain a solid separation margin before corridors are carved.
3. Accept a requested room count between 4 and 8. Bound placement attempts and deterministic retries; never loop indefinitely.
4. Connect room centers with a deterministic minimum-spanning tree using distance and stable room-ID tie-breaking.
5. Carve orthogonal corridors with consistent two-tile clearance. Select each bend orientation deterministically. Corridors may merge or enter other rooms; compute connectivity from the actual carved tiles rather than assuming the abstract connection graph matches the final map.
6. Add at most one optional extra connection if it improves route choice without excessive corridor clutter. Do not implement complex route optimization.
7. Derive visible boundaries from the final floor topology. Detect valid corridor-to-room thresholds from actual tile geometry, rather than drawing a door at every planned connection endpoint.
8. Choose an entrance area in one room and an objective area in a different room, favoring long traversable distance using the final map. Render these as stairs/architecture, without revealing hidden information or adding encounter mechanics.
9. Decorate only after topology passes validation.

Door thresholds must span their intended opening. For connectivity purposes they are passable; there are no locked-door mechanics. Skip decorative door symbols at ambiguous intersections instead of rendering broken geometry.

If retries cannot meet the requested room count, return a typed generation failure and keep the last valid preview. Do not silently claim the requested layout was produced. Use a small set of verified seeds for curated presets, not as an undisclosed replacement for failed generation.

## Traversability and decoration

Validate that all floor tiles form one connected component using four-directional movement. Entrance and objective must be on floor in different rooms and have a route between them.

Mark props explicitly as blocking or decorative. Wall sconces, moss, rugs, and flat floor markings do not block movement. Crates, barrels, and large rubble do.

- Keep doorways and corridors free of blocking props.
- Reserve entrance/objective tiles and adjacent space.
- Keep blocking props inside rooms and avoid overlaps.
- Use density presets Sparse, Balanced, and Cluttered, with conservative occupancy budgets, such as 5%, 10%, and 15% of room floor tiles.
- After each proposed blocking placement, confirm all remaining walkable tiles stay connected and each room retains a clear 2 × 2 area.
- Bound placement attempts; accept fewer props if necessary rather than breaking access.

Decoration should have intent: barrels near walls, rubble near corners, rugs in room interiors. Do not uniformly scatter objects across every tile. The map should retain open space for play.

## Interface and interactions

Use a compact control panel beside a large map preview, stacking controls above the preview on narrow screens. Let the artwork dominate. Include a brief instruction: “Generate a dungeon, shuffle its details, and export a battle map.”

Controls:

- Seed: trimmed string, 1–64 characters.
- Rooms: integer 4–8.
- Decoration: Sparse / Balanced / Cluttered.
- Generate: applies layout settings and resets detail revision.
- New seed: creates a fresh seed and generates immediately.
- Shuffle details: preserves layout and changes decoration.
- Grid: on/off; default on.
- Zoom in/out and Fit buttons; pointer drag to pan.
- Export PNG.

Keep draft layout settings separate from the generated map. If seed or room count is edited, show that Generate is needed. Export and Shuffle details operate on the currently generated map; do not accidentally label the export with unapplied settings. Decoration changes may apply immediately to the current layout.

Provide a visible generated-map summary: seed, room count, density, detail revision, and 40 × 30 tiles. Display validation/generation errors clearly without removing the previous valid map. Disable conflicting actions during generation/export and restore controls on failure.

All controls must be keyboard accessible. Provide zoom/fit buttons so mouse gestures are optional. Keep wheel zoom within the preview and do not hijack page scrolling unnecessarily. Canvas should have an accessible descriptive label and a nearby text summary; do not pretend every map tile is independently accessible.

## Rendering and export contract

Use one renderer for preview and export. Render in world coordinates and apply a viewport transform only for the interactive preview. Handle devicePixelRatio for a sharp preview without tying procedural detail to display pixels.

Suggested layer order:

1. Solid background.
2. Floor fills and slab detail.
3. Wall/contact shadows.
4. Wall surfaces and highlights.
5. Door thresholds, stairs, and props.
6. Restrained lighting accents.
7. Optional grid.

Export the entire map at 64 pixels per tile: 2560 × 1920 pixels. Match the current grid toggle and exclude controls, selection indicators, and preview transforms. Use a separate canvas and asynchronous Blob creation; handle export failures. Sanitize filenames and include generated seed/detail revision without trusting raw user text as a path.

Default suggested tabletop scale is 5 feet per square; the output is simply an image and does not implement any game rules. Do not promise VTT-specific metadata or integration. PNG export must work without external image fetches or canvas-tainting dependencies.

## Suggested organization

- Dungeon page: controls, state, error handling, and action orchestration.
- Preview component: canvas lifecycle, resize handling, viewport interactions, renderer invocation.
- Pure generation folder: seeded random, room placement, connections, tile carving, decoration, validation.
- Models: strict generator settings, map data, typed results.
- Rendering folder: world-coordinate renderer, palette, and reusable prop drawing routines.
- Fixtures and tests: showcase map and fixed-seed generation cases.

Keep helpers focused. Do not introduce inheritance hierarchies or generic procedural-generation frameworks. A simple typed generateDungeon(settings) boundary and renderDungeon(context, map, options) boundary are sufficient. Add a discriminated union for forest settings only when that generator is implemented.

## Delivery phases

1. Inspect the workspace, verify stable tooling, and scaffold or reuse the application.
2. Define the model and fixed showcase layout; build and visually inspect the renderer.
3. Implement deterministic dungeon generation and topology validation.
4. Add safe decoration, seed/settings controls, and independent detail shuffling.
5. Add viewport controls and reliable full-map PNG export.
6. Run focused tests, a production build, and representative visual review; improve observed issues.
7. Document setup, controls, seed reproduction, algorithm, visual conventions, and limitations.

Do not automatically start the forest release after finishing the dungeon. Deliver the complete dungeon MVP and report what is ready.

## Acceptance criteria

### Engine tests

- Same seed/settings/revision yields deeply equal map data.
- Across a deterministic batch of at least 30 seeds, successful maps satisfy bounds, requested room count, connected floor topology, valid entrance/objective, and prop-clearance rules.
- Generation attempts are bounded; impossible placement returns an explicit failure.
- Shuffle details changes only decoration fields, not topology or floor texture.
- Empty/invalid settings are rejected before replacing current map data.
- View settings do not affect generation.
- Blocking props never disconnect walkable tiles, block doorways, or occupy reserved areas.
- Input settings and previous map data are not mutated.

### UI/export checks

- Initial map is visible and usable without form entry.
- Generate/New seed/Shuffle details behave distinctly and update the summary correctly.
- Unapplied settings never leak into exported-map metadata or filenames.
- Grid toggle, fit, zoom, pan, and resize work without blurring or regenerating detail.
- Export is exactly 2560 × 1920 and shows the entire map regardless of preview zoom/pan.
- Failed generation/export reports an error and leaves the interface usable.

### Visual review

Inspect at least six representative generated maps, including sparse and cluttered settings, at fit-to-view and close-up. Look for broken wall corners, door misalignment, tiny unreadable details, excessive dark areas, monotonous repeated slabs, blocked-looking passages, clipped props, and poor token readability. Inspect an exported PNG as well as the preview.

The successful result has recognizable stonework, coherent walls, restrained colorful accents, useful open areas, and balanced composition. Report any unverified checks honestly. Do not claim all seeds are aesthetically excellent; procedural layout quality varies.

## Future forest release

After the dungeon is accepted, add a real map-type selector and a separate forest generator: a connected clearing, a usable path between two edges, clustered trees, sparse rocks, and optional undergrowth. Preserve a wide traversable route and open encounter space. Reuse rendering infrastructure and export controls, but use purpose-built terrain rules and forest artwork. Keep forests as a separate implementation milestone rather than reducing dungeon quality to rush both.

## Out of scope

No regional/world maps, 3D, combat rules, encounters, monsters, fog of war, line of sight, multiplayer, manual tile editor, automatic rivers, dynamic lighting, VTT integration, AI-generated runtime imagery, accounts, cloud saves, or deployment. These are future decisions, not hidden requirements.
