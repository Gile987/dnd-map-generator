# Encounter Map Forge — Feature Ideas

An idea backlog for releases after the dungeon MVP. Created 16 October 2026.

Unfinished entries are candidates for discussion, not committed requirements or authorization to implement them. Finished entries retain their original proposal and include a summary of what shipped. The [original brief](encounter-map-forge-brief.md) remains the description of the first release; features below that expand its scope belong to later releases. Detailed implementation and code-quality work is recorded separately in [IMPROVEMENTS.md](IMPROVEMENTS.md).

## Product direction

Keep Encounter Map Forge focused on making attractive, usable battle maps quickly. Preserve open space for play, clear terrain, reproducible generation, and straightforward exports. Add complete, convincing map styles one at a time.

Prefer browser-local features that do not require an account, backend, subscription, external assets, or runtime AI service. Keep the artwork dominant and show extra controls only when they help the current task.

Scope labels are relative estimates, not delivery commitments:

- **Small:** a focused extension to an existing workflow.
- **Medium:** a new workflow or substantial generator/rendering work.
- **Large:** a new interaction model or a change spanning several systems.

## Suggested next releases

1. **Keep a good map:** add portable map recipes and a reproduction summary (I04, I08).
2. **Control your exports:** add focused export options (I05).

Finished: forest clearing maps (I01), dungeon character presets (I03), the local map library (I02), and forest character presets (I19). Implementation summaries appear under their entries below.

Finish and visually review each selected feature before starting the next map type. A full manual editor is a separate milestone.

## The five original suggestions

### I01 — Forest clearing maps

**Finished 16 October 2026. Original scope: Medium.**

Add a second real map type: a connected forest clearing with a usable path between two edges, clustered trees, sparse rocks, and optional undergrowth. Leave generous encounter space and keep blocking terrain away from the main route.

Create purpose-built tree, ground, and rock artwork that fits the app's illustration style. Reuse grid, zoom, pan, fit, and export controls. Show a map-type selector when both generators work; changing type must not discard the current map unexpectedly.

**A good result:** recognizable woodland, readable paths, varied compositions, safe traversability, deterministic seeds, and exported images that match the preview. Start with a fixed showcase and close-up review, as with the dungeon.

**What we implemented:**

- Added a working Forest map type with deterministic clearings, a stored dirt route connecting two map edges, tree variants, boulders, logs, stumps, bushes, ferns, mushrooms, and flowers.
- Reused grid, zoom, pan, fit, detail shuffling, density controls, and full-resolution PNG export. Switching between Dungeon and Forest restores each type's current map without applying pending drafts.
- Protected the main route from blocking props and checked connectivity and blocking budgets across generation, shuffling, and density changes. Forest path endpoints are unmarked.
- Added model baselines, route and traversability regression tests, renderer determinism tests, and browser coverage. Verified desktop/mobile rendering and that exported artwork matches the preview. Introduced generator version 3.0.0.

### I02 — Save and reopen maps

**Finished 16 October 2026. Original scope: Small–medium.**

Build a browser-local library with a name, thumbnail, map type, seed, and generated settings for each saved map. Support opening, renaming, duplicating, deleting, and marking favorites. Keep saving explicit; optionally restore the last session separately.

Use local browser storage without accounts. Include downloadable backups and explain that local saves belong to that browser. Record the generator and save-format versions so a later release does not silently reinterpret an old map.

**A good result:** a map can be saved, reopened after refresh, and exported with its original generated settings. Unapplied drafts never become its saved identity.

**What we implemented:**

- Added a browser-local map library (section 03) that saves the current map with a name and a rendered thumbnail, and supports open, rename, duplicate, favorite, and delete. Favorites sort first; the library is empty until you save.
- Each save stores the full generated model (seed, map type, room count, density, character, detail revision, generator version) plus a save-format version and a thumbnail. Initially 1.0.0, the save format advanced to 2.0.0 with I19 so older readers reject forest characters they cannot render; existing records remain readable. Saving is explicit and always records the accepted generated map, never unapplied drafts; opening restores the exact saved map and its settings.
- Saves persist to this browser's localStorage only. **Download backup** writes them to a versioned JSON file; **Import backup** validates and restores them, rejecting malformed files and maps from a newer save format without disturbing the current map or existing saves.
- Added save-format unit tests (round-trip, malformed backups, future-version rejection) and browser coverage for saving, reopening after refresh, renaming, duplicating, favoriting, deleting, and backup export/import.

### I03 — Dungeon character presets

**Finished 16 October 2026. Original scope: Medium.**

Give dungeons distinct identities through coordinated props, materials, and restrained accents. Start with a few well-developed presets:

- **Ancient crypt:** stone sarcophagi, memorial slabs, subdued lighting.
- **Abandoned storehouse:** crates, barrels, storage clusters, worn runners.
- **Overgrown sanctuary:** moss, vines, broken architecture, a prominent stone dais.

Separate decoration presets from layout presets. A decoration change should preserve the layout; a layout change should clearly require generation. Avoid offering many presets that only recolor the same objects.

**A good result:** each preset is recognizable at fit-to-view, remains readable under tokens, and obeys the same blocking-prop and doorway rules.

**What we implemented:**

- Added four selectable characters: Mosslit, Crypt, Storehouse, and Sanctuary, with distinct prop palettes, floor colors, backgrounds, and lighting treatments.
- Added sarcophagi, vines, and broken columns alongside the existing dungeon props. Presets share the same blocking classification and placement safeguards.
- Applying only preset and density changes with Generate preserves the layout, surface seed, and detail revision. All settings remain drafts until Generate is clicked. The map summary and PNG filename identify the selected character.
- Added preset generation and layout-preservation tests, golden model baselines, renderer checks, and browser coverage for preset selection, pending drafts, shuffling, density changes, and export. Introduced generator version 2.0.0; the later forest release advanced the shared version to 3.0.0.

### I04 — Shareable map recipes

**Scope: Small–medium. Recommended first supporting feature.**

Download/import a versioned JSON recipe and optionally copy a link containing the recipe settings. Include map type, generated seed, room count or terrain settings, density, detail revision, generator version, and export/view options where relevant.

Validate imports before replacing the current map. Explain incompatible generator versions rather than quietly generating a different layout. A recipe alone cannot reproduce an older algorithm unless that algorithm is still available; choose an explicit compatibility policy. Keep recipes separate from full saved-model files if both formats are introduced.

**A good result:** supported recipes reproduce the same map, malformed imports leave the current map intact, and links/files use accepted settings rather than drafts. No hosting service is needed for a self-contained recipe link.

### I05 — Export options

**Scope: Small for individual options; medium for a complete export panel.**

Add a compact export panel with individually selectable features:

- Grid color and opacity, with a few readable presets.
- Optional coordinate labels around the map edges.
- Landscape or portrait output, with portrait rotating the complete map.
- A paired download of grid-on and grid-off images of the same map.
- An optional seed/settings caption outside the playable map area.

Keep the current 2560 × 1920 export as the default. Make any changed image dimensions clear, especially if labels or captions add margins. Preview export-specific options before downloading and keep viewport zoom/pan out of the result. Do not imply VTT metadata or integration.

## More ideas for keeping and exploring maps

| ID  | Idea                          | Player or game-master benefit                                                                           | Scope and dependencies                                                                 |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| I06 | Recent generations            | Browse a bounded session history and return to a layout that looked promising.                          | Small–medium; decide whether history survives refresh.                                 |
| I07 | Compare map variants          | Compare two seeds or detail revisions side by side before choosing one.                                 | Medium; use explicit snapshots so generating one side does not replace the other.      |
| I08 | Copy reproduction details     | Copy a compact text summary with all settings and versions needed to recreate the generated map.        | Small; useful alongside I04.                                                           |
| I09 | Map names and private notes   | Give saved maps memorable names and short preparation notes.                                            | Small after I02; notes stay out of ordinary image exports.                             |
| I10 | A curated inspiration gallery | Offer a small set of verified maps with clear seed/settings attribution and a one-click opening action. | Small–medium; label these as curated choices, never substitutes for failed generation. |
| I11 | Restore the last session      | Reopen the last valid map and its view state after an accidental refresh.                               | Small–medium; keep this distinct from saving a named favorite.                         |

## More visual and generation ideas

| ID  | Idea                           | Player or game-master benefit                                                                                     | Scope and dependencies                                                                    |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| I12 | Atmosphere palettes            | Choose mosslit, dry sandstone, or cold slate color treatments while keeping terrain contrast strong.              | Small–medium; palette-only changes preserve topology and decoration placement.            |
| I13 | Prop categories                | Adjust storage, rubble, fabric, vegetation, and sconces independently instead of relying only on overall density. | Medium; define deterministic settings and retain conservative blocking budgets.           |
| I14 | Room purpose                   | Give rooms a visual role such as storage, shrine, or sleeping chamber through deliberate prop arrangements.       | Medium; complements I03 and requires new coherent assets.                                 |
| I15 | Dungeon layout character       | Choose compact chambers, a branching complex, or a longer expedition route.                                       | Medium–large; each choice needs visible differences and connectivity validation.          |
| I16 | Open-space preference          | Bias generation toward a larger central encounter room or several smaller spaces.                                 | Medium; retain honest requested-room counts and bounded failure.                          |
| I17 | Shuffle one room's details     | Keep most of the map while refreshing decoration in a selected room.                                              | Medium; needs room selection, stable per-room random streams, and reproducible revisions. |
| I18 | Entrance and objective choices | Select another valid entrance/objective room without rebuilding the layout.                                       | Medium; update architecture and reserved space, then safely redecorate affected areas.    |
| I19 | Forest character presets       | Give a clearing a distinct woodland identity through coordinated trees, ground cover, props, and atmosphere.      | Medium; extends I01 using the character workflow from I03; detailed proposal below.       |

### I19 — Forest character presets

**Finished 19 October 2026. Original scope: Medium. Builds on the completed forest generator (I01) and dungeon character presets (I03).**

Add a Character control for Forest, just as Dungeon offers Mosslit, Crypt, Storehouse, and Sanctuary. Give each forest preset its own coherent artwork and prop combinations, rather than offering only different colors. Start with a few distinct characters:

- **Verdant woodland:** broadleaf canopies, lush grass, ferns, mushrooms, and mossy fallen logs; retain the familiar green forest as the default.
- **Autumn grove:** gold and russet broadleaf trees, fallen-leaf patches, exposed branches, and scattered woodland mushrooms.
- **Ancient pines:** clustered evergreen canopies, needle-covered ground, weathered stumps, deadwood, and mossy boulders.
- **Fey glade:** unusual tree forms, flowering ground cover, distinctive mushroom clusters, and restrained magical accents that leave the terrain readable.

Follow the configure-then-generate workflow: selecting a character changes only the pending settings until Generate is clicked. Applying only character or density changes must preserve the clearing layout, carved route, path endpoints, surface seed, and detail revision. Shuffling uses the accepted character and leaves pending choices untouched. Keep path endpoints unmarked and blocking props away from the route.

Record the accepted forest character in saved maps, backups, reproduction details, map summaries, and PNG filenames. Restore it when reopening a map or switching map types. Define compatibility for existing forest saves that predate the character setting, preserving their original artwork rather than silently assigning a different look.

**A good result:** each preset is recognizable at fit-to-view through its trees and props, leaves generous encounter space, and remains readable under tokens. All presets preserve route connectivity and blocking budgets, reproduce deterministically, and export artwork matching the preview. Review representative seeds and close-ups for every character, alongside tests for pending settings, layout preservation, shuffling, saving, and reopening.

**What we implemented:**

- Added a Character control for Forest with four selectable characters: Verdant woodland (the familiar green forest, default), Autumn grove, Ancient pines, and Fey glade. Each has its own prop mix (placement probabilities and undergrowth counts), tree shapes and colors, ground cover, and atmosphere.
- Verdant keeps the previous broadleaf/pine mix, bushes, ferns, mushrooms, and mossy logs. Autumn favors gold and russet broadleaf canopies, extra mushrooms, and leaf-toned undergrowth over a bronze floor with fallen-leaf patches. Pines places clustered evergreens, weathered stumps, deadwood logs, and mossy boulders over a needle-toned floor. Fey grows curved three-lobe trees, flowering ground cover, extra mushrooms with a faint glow halo, and a teal-tinted glade.
- Follows configure-then-generate: selecting a character is a pending draft until Generate is clicked. Applying only character or density changes preserves the clearing layout, carved route, path endpoints, surface seed, and detail revision. Shuffle uses the accepted character and leaves pending choices untouched. Path endpoints stay unmarked; blocking props stay off the route under the shared budgets.
- The accepted forest character is recorded in the map summary, save records, backups, the map library, and the PNG filename (`encounter-{seed}-forest-{character}-{density}-r{revision}-v{version}.png`), and restored when reopening a map or switching map types.
- Forest decoration stream keys now include the character, so `GENERATOR_VERSION` advanced from 3.0.0 to 4.0.0. Forest saves from before characters load with their original artwork, treated as Verdant; unknown characters in records are rejected.
- New records and backups use save-format 2.0.0; format-1 saves migrate without regeneration, including records from the initial I19 implementation. Three frozen v3 saves and independent pixel baselines protect legacy artwork. Re-decorating an older map uses current streams on its retained layout and surface; keep the full saved snapshot for exact reproduction.
- Added per-character golden model baselines, connectivity and blocking-budget batches across all characters, character-change preservation and round-trip tests, per-character renderer determinism and difference tests, save-format legacy/unknown-character tests, and browser coverage for character drafts, generation, shuffling, and export filenames. Reviewed full maps, close-ups, and a contact sheet for every character (`artifacts/forest-*.png`) plus browser previews of pending and applied changes.

## More ways to prepare a map for play

| ID  | Idea                         | Player or game-master benefit                                                                                 | Scope and dependencies                                                                     |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| I20 | Temporary token-size preview | Overlay a few simple 1 × 1 or 2 × 2 markers to judge room scale and free space.                               | Small–medium; preview aid only, with no combat system.                                     |
| I21 | Distance ruler               | Measure a route or straight-line distance in squares, optionally showing a user-chosen feet-per-square value. | Medium; choose the measurement rule explicitly without claiming a particular game's rules. |
| I22 | Touch exploration            | Make map navigation comfortable on tablets, including pinch zoom and reliable drag behavior.                  | Medium; verify on touch hardware and preserve page scrolling outside the preview.          |
| I23 | Keyboard shortcuts           | Add discoverable shortcuts for Generate, Shuffle, Grid, Fit, and Export.                                      | Small; do not intercept typing in inputs, and keep buttons fully usable.                   |
| I24 | Print-friendly sheets        | Add page-sized exports with overlap, alignment marks, and an explicit printed square size.                    | Medium–large; account for printer scaling and verify physical output.                      |
| I25 | Optional room-number overlay | Add unobtrusive room numbers for preparation and a separate clean player export.                              | Medium; distinguish annotations from permanent map artwork.                                |

## Larger ideas to consider separately

These expand the original MVP substantially. Select and scope them explicitly rather than treating them as follow-on cleanup.

| ID  | Idea                        | Why it could be useful                                                                     | Main scope consideration                                                                                     |
| --- | --------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| I26 | Caves                       | Organic chambers and natural routes for underground adventures.                            | A separate generator and rock-rendering style; validate corridor clearance on irregular terrain.             |
| I27 | Ruins                       | Broken walls, courtyards, and multiple approaches.                                         | Define passable gaps and wall remnants clearly; a recolored dungeon is not enough.                           |
| I28 | Taverns and small interiors | Rooms suited to social scenes and close encounters.                                        | Purpose-built architecture and furniture placement; keep furniture scale consistent.                         |
| I29 | Limited prop editing        | Move, remove, or replace individual props after generation.                                | Requires selection, collision feedback, undo/redo, validation, and a saved edit format.                      |
| I30 | Full map editing            | Draw rooms, corridors, walls, and terrain manually.                                        | A separate editor milestone with its own tools and geometry rules.                                           |
| I31 | Encounter annotations       | Maintain game-master notes or simple markers alongside a map.                              | Keep information layers separate from terrain and clean player exports; do not quietly add combat mechanics. |
| I32 | Larger or custom map sizes  | Support different tables, encounter scales, and compositions.                              | Revisit placement budgets, performance, export resolution, and every generator's validation.                 |
| I33 | Connected map sets          | Create related floors or adjacent locations with consistent entrances and visual identity. | Needs explicit links between maps and a versioned multi-map save format.                                     |

Accounts, cloud synchronization, collaboration, fog of war, line of sight, dynamic lighting, regional/world maps, and VTT-specific integrations remain separate product decisions. They are not prerequisites for the features above.

## Decisions to settle when selecting a feature

- **Reproduction:** distinguish generator settings, decoration revisions, visual treatments, saved edits, and view/export state. Record every value that affects the result.
- **Compatibility:** choose what happens when a recipe or saved model belongs to an older version. Never silently promise exact reproduction across changed algorithms.
- **Playability:** revalidate connectivity, doorway clearance, reserved areas, and room space whenever terrain or blocking props change.
- **Visual quality:** inspect a fixed showcase, representative generated maps, close-ups, and actual exports for every new style. Matching dimensions or passing tests does not establish visual quality.
- **Scope:** identify one reviewable outcome and its acceptance conditions before implementation. An idea's presence in this file does not make the entire backlog part of that task.

There is no need to implement every idea. Favor the additions that make it easier to create a convincing map, keep a good result, and use it at the table.
