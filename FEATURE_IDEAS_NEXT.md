# Encounter Map Forge — Next feature ideas

Prepared **23 October 2026**, after completion of the application quality review.

These are proposals for discussion, not committed requirements or authorization to
implement the whole list. Scope estimates describe relative effort, not delivery
dates. The original [IDEAS.md](IDEAS.md) remains intact; references to its identifiers
show where a proposal develops an existing idea rather than claiming it is new.
Implementation notes below record subsequently completed slices; unselected ideas
remain proposals.

## Starting point

The completed [quality review](APPLICATION_QUALITY_REVIEW.md) and
[architecture review](ARCHITECTURE_REVIEW.md) support moving toward features without
another broad refactor. This is a product planning exercise, not a fresh technical
audit or a claim that no bugs remain.

Reviewed the [README](README.md), [original brief](encounter-map-forge-brief.md),
[improvement history](IMPROVEMENTS.md), existing ideas, project instructions, and the
current component templates. Also opened the local app in an isolated Chromium
session: inspected Dungeon and Forest at desktop size, a populated library, and
Forest at 390 px width. This was a sampled visual inspection, not usability research
or a touch-device test.

The current app already has two map types, dungeon and forest characters, separate
pending settings, detail shuffling, viewport controls, PNG export, named local
saves, favorites, and backup/recovery. Those are foundations to extend, not features
to propose again. The interface has a coherent visual identity worth retaining.

Three opportunities stand out:

- **More places to play:** distinct terrain and architecture, rather than many color
  variants of the same layout.
- **More intentional scenes:** recognizable focal objects and coherent arrangements
  that suggest how a location was used while leaving room for tokens.
- **Less work around a good map:** recover a previous version, find a saved map, and
  export the right image with fewer repeated steps.

Keep the browser-local, account-free direction. A useful new release should not
depend on a backend, subscription, runtime AI generation, or third-party asset
service.

## Recommended shortlist

| Order | Candidate                           | Why choose it                                                             | Relative scope |
| ----- | ----------------------------------- | ------------------------------------------------------------------------- | -------------- |
| 1     | F09 — Scene prop packs              | Makes existing maps feel more purposeful before adding another generator. | Medium         |
| 2     | F13 — Recent maps and undo shuffle  | Lets users explore without losing a result they liked.                    | Medium         |
| 3     | F15 — Search and filter the library | Keeps the existing save workflow useful as the collection grows.          | Small–medium   |
| 4     | F01 — Ruined courtyards             | Adds a visibly different encounter space between dungeon and wilderness.  | Large          |
| 5     | F18 — Export panel                  | Makes maps easier to use with different table setups.                     | Medium         |
| 6     | F19 — Mobile preview access         | Shortens the trip between changing settings and inspecting the result.    | Small–medium   |

If the next release should be primarily visual, start with F09 and F01. If the
priority is everyday usefulness, start with F13 and F15. Finish and review one
coherent slice before moving through the list.

## New map types and locations

Keep the current 40 × 30 size for the first additional type. Distinguish a **map
type**, which changes terrain or architecture, from a **character**, which changes
an existing type's decoration and appearance, and a **scene**, which arranges props
around a purpose. This avoids presenting every new theme as a separate generator.

| ID  | Candidate                     | What makes it useful and distinct                                                                                                           | First useful release                                                                                                 | Scope / relationship                                                               |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| F01 | Ruined courtyard              | Open fighting space, broken perimeter walls, several approaches, and isolated structures create encounters between indoor and outdoor play. | One courtyard, visible wall gaps, a few wall remnants, one focal feature, and overgrown stone artwork.               | Large; develops I27.                                                               |
| F02 | Natural caverns               | Organic chambers and tunnels support underground scenes with a different silhouette from rectangular dungeons.                              | Dry caves with connected chambers, readable rock edges, stalagmites, and generous tunnel clearance. Add water later. | Large; develops I26.                                                               |
| F03 | Roadside crossing             | Roads, hedges, carts, and stone boundaries support ambushes and checkpoints without needing a settlement generator.                         | A road between two edges with a junction or bend, clear verges, and an optional abandoned cart.                      | Medium–large; new.                                                                 |
| F04 | River ford and bridge         | A crossing provides a natural focal point and contrasting approaches on each bank.                                                          | Two usable banks, one crossing, explicit water boundaries, and safe access at both ends.                             | Large; new. Needs terrain and crossing semantics, not blue-painted floor.          |
| F05 | Tavern and small interiors    | Furniture, doors, and rooms support social scenes and close encounters.                                                                     | One floor of a tavern: common room, kitchen, store, and clear circulation around tables.                             | Large; develops I28. Multi-tile furniture should precede it.                       |
| F06 | Graveyard and memorial garden | Paths, grave clusters, and a small mausoleum create a recognizable outdoor location.                                                        | A connected path network, readable grave rows, one landmark, and open gathering space.                               | Medium–large; new. Could begin as a ruin scene before becoming its own type.       |
| F07 | Marsh boardwalk               | Dry islands and wooden walkways create constrained movement and a strong visual identity.                                                   | A connected dry route, small platforms, reeds, and clearly distinct water.                                           | Large; new. Follow F04's terrain work and retain sufficient encounter space.       |
| F08 | Encampment                    | Tents, supply areas, fire circles, and perimeter gaps turn wilderness into an inhabited place.                                              | A scene on a forest clearing, with a small tent group and a clear central area.                                      | Medium as a scene; new. Promote to a type only if it gains different layout rules. |

### Suggested next map type: ruined courtyard

**F01 — first slice complete and verified 26 October 2026.** Courtyard is now a
third map type at 40 × 30 tiles, with weathered paving, walkable grass outside,
four broad wall openings, additional breaches, detached wall remnants, and
scattered columns. Standing masonry and columns block movement; flat rubble and
vegetation are passable. A protected 6 × 6 gathering space and three-tile approach
lanes stay clear. **Dry fountain** uses the existing searchable additions picker:
its basin blocks 3 × 3 tiles and keeps a clear tile on every side.

Courtyards retain their own accepted map, pending settings, and Undo/Redo history.
Applying density or fountain changes preserves layout, surface texture, and detail
revision. Saves, library summaries, thumbnails, backups, and full PNG exports
support the type. Generator version 4.0.0 remains unchanged through independent
courtyard streams; save format 9.0.0 explicitly adds the new model and objects.
Formats 1–8 retain their frozen vocabularies and original saved artwork.

Verified across full and focused unit runs covering **550 distinct cases**, and
**all 83 Chromium browser cases across split runs**, including six new courtyard
cases. Coverage includes 60 seed/density/fountain combinations and their shuffled
snapshots, independent connectivity checks, rejected commands/imports and recovery,
exact saved models and PNG round trips, and historical model/pixel baselines.
Test type checking, production build, and formatting pass. Inspected full maps,
fountain close-ups, desktop/tablet/mobile layouts, keyboard focus, and disabled
states; other browser engines and physical touch devices were not checked. Review
artifacts are in `artifacts/courtyard/`. This slice has one overgrown character;
elevation, roofs, locked doors, and destructible terrain remain outside its scope.

The original proposal follows for context.

This is the strongest bridge between the two existing visual families: weathered
stone and woodland. Its value comes from broken architecture and multiple
approaches, not simply adding moss to a dungeon.

Start with **one readable courtyard composition**. Give it an outer approach, open
interior space, broken wall segments, and a focal feature such as a dry fountain or
shrine. Establish how passable gaps, standing walls, and low rubble look before
offering multiple ruin characters. Avoid elevation, roofs, locked doors, and
destructible terrain in the first slice.

**A good result:** it reads as an outdoor ruin at fit-to-view; wall gaps match actual
passability; tokens have room to gather; several representative seeds produce
different compositions; saves reopen the exact scene and exports match the preview.

## New objects and more purposeful decoration

**Interface update implemented and verified 26 October 2026.** The additions from
F09–F11 share one **Choose additions** picker: Forgotten study, Weathered statue,
and Dining table for Dungeon; Abandoned camp and Standing-stone circle for Forest.
Searchable cards show the app’s actual prop artwork, descriptions, and native
checkboxes. Selections remain in the draft through filtering, empty results,
closing, and switching map types. The settings panel shows a compact summary with
removal buttons; Generate applies the choices. Scene, landmark, and furniture
remain internal placement/save concepts. Generation, historical artwork, and
save-format compatibility are unchanged. Future additions should follow this
interaction model and support the independent selection it promises.

The native modal keeps the background inert and restores focus on closing. It
opens with its title focused, and clearing search or removing a summary item keeps
keyboard focus on a usable control. Only the catalog scrolls; search and Done stay
visible on narrow and short screens. Illustrations reuse the existing prop renderer
without generating or mutating a map.

Verified: **302 relevant unit tests** for accepted maps, drafts, and persistence,
and **all 72 Chromium browser cases across split runs**. Picker/contrast cases
were rechecked after the focus refinements, including search recovery. Test type
checking, production build, and formatting pass. Inspected desktop, tablet, mobile,
keyboard-focus, empty-result, and disabled states; responsive checks reach 320 px
and a short 800 × 420 viewport. Review images are in `artifacts/picker/` and
`artifacts/additions/`. Earlier slice notes below describe the controls and save
versions at the time each feature was introduced.

### F09 — Scene prop packs

**First slice implemented and verified 23 October 2026: Abandoned camp for Forest.**
The Scene control offers None and Abandoned camp through configure-then-generate.
The camp groups two small ridge tents, two bedrolls, a cold fire ring, and a supply
bundle in a clear area outside the route. Each object fits within one tile; tents
and supplies share the forest blocking budget. Appearance-only changes preserve
layout, surface texture, and revision. Shuffle retains the scene; saves, reopening,
backups, summaries, accessible preview text, and PNG filenames preserve its identity.
A rejected camp leaves the previous map and editable draft available for recovery.

New records/backups use format 3.0.0 with explicit camp vocabulary; formats 1 and 2
remain readable without changing historical artwork. The additive camp stream is
versioned independently; generator 4.0.0 and existing scene-free model/pixel
baselines remain unchanged. Cooking pots and the other scene packs below remain
future proposals, outside this first slice.

Verified: **338/338 unit tests**, the **55/55-test Chromium suite**, then **3/3 final
camp browser cases**, including the added no-space/retry case. Test type checking,
production build (269.45 kB initial bundle, within budget), and formatting passed.
Tests cover 96 seed/character/density combinations and their shuffles, independent
connectivity/budget checks, malformed saves, draft transitions, backup portability,
and PNG export. Inspected the fixed showcase, generated camp close-ups, and desktop
and mobile UI; no horizontal overflow at 768, 390, or 320 px. Visual artifacts live
under `artifacts/f09/`. Browser verification remains Chromium-only.

**Second slice implemented and verified 23 October 2026: Forgotten study for Dungeon.**
The shared Scene control now shows the choices for the active map type. The study
places a bookshelf against a solid room boundary, with a writing desk and tucked-in
stool, scroll cases, and a rug arranged inward. It replaces ordinary decoration in
one suitable room while protecting doors, landmarks, per-room blocking budgets, and
clear 2 × 2 spaces. Applying/removing the study or changing its character/density
preserves the layout, surface seed, and revision; shuffle retains the scene.
Failed scene or preset changes preserve the accepted map and pending draft for retry.

New furniture and dungeon scene metadata use save format 4.0.0; formats 1–3 remain
readable, including forest camps. Existing scene-free models and pixel baselines
remain unchanged. The README now distinguishes app, generator, and save-format
versions. Cooking pots and roadside shrines remain future proposals.

Verified: **358/358 unit tests** and **59/59 Chromium browser tests**, test type
checking, formatting, and the production build (275.69 kB initial bundle, within
budget). Study checks cover 108 seed/preset/density/room-count combinations and their
shuffles, rejected changes and recovery, malformed/older-format records, exact
save/import round trips, pending settings, and PNG exports. A rejected preset
regression failed before its acceptance check was corrected. Inspected artwork
close-ups and desktop/mobile UI, with no horizontal overflow at 1440, 768, 390, or
320 px. Review artifacts live under `artifacts/study/`; browser verification remains
Chromium-only.

**Third slice implemented and verified 28 October 2026: Ritual site for Dungeon.**
The illustrated Choose additions picker now offers a Ritual site independently of
Forgotten study, Weathered statue, and Dining table. A carved stone altar, two
clusters of upright lit candles, and two offering bowls surround faded floor rings
and a clear center. The altar blocks one tile; candles, offerings, and markings
are passable. Static warm light, carved slab details, wax pools, and cloth beneath
the offerings use the existing Canvas artwork style and export consistently.

The separate `dungeon-ritual` stream composes the site after existing additions,
with a protected 5 × 5 area outside entrance/objective rooms and their reserves.
It preserves study rooms, statue reserves, and table circulation, and shares the
room blocking budget. Every free floor tile remains reachable, and rooms retain
clear 2 × 2 spaces. Applying/removing the site preserves layout, floor texture,
and detail revision; refused placement preserves the accepted map and draft.
Shuffle retains the accepted option, and Undo/Redo and pins restore exact models.

Save format 11.0.0 freezes the optional boolean selection and three new object
kinds. Formats 1–10 retain their vocabularies and reject ritual metadata/objects;
missing selections retain old models and artwork. Generator version stays 4.0.0,
with existing streams, RNG consumption, and historical pixel baselines unchanged.
Individual object artwork fits its own tile at every rotation, and floor markings
and candlelight remain inside the protected reserve without crossing walls.

Verified: 419 focused unit/review tests, including 30 new ritual cases, and all 27
Chromium cases across focused ritual, picker/panel, historical study, save/backup,
and mobile contrast runs. Coverage includes characters/densities/room counts,
rotations, deterministic and immutable models, existing-addition combinations,
unchanged protected objects, clearance/budgets/connectivity, rejected saves and
placement/recovery, exact refresh/share/import PNGs, 4000 × 3000 Foundry export,
drafts, shuffle history, pins, accessible picker controls, and disabled states.
Test typechecking, production build, and formatting pass. Inspected all four
characters at 64/100 pixels per tile, plus desktop/tablet/mobile picker and map
layouts down to 320 px; short-picker regression coverage reaches 800 × 420.
Text contrast passes at 320 px. Artifacts are under `artifacts/ritual/`. Coverage
remains Chromium-only; the full browser suite and physical touch devices were
not checked. Cooking pots, roadside shrines, and other arrangements remain future
slices.

**Original proposal:**

**Medium. Develops I13 and I14.** Add a few deliberate arrangements to existing map
types, with newly drawn objects where needed:

- **Abandoned camp:** tents, bedrolls, fire ring, cooking pot, and supply bundles.
- **Ritual site:** a focal altar or carved slab, floor markings, candle clusters,
  and a few standing stones.
- **Forgotten study:** bookshelves, reading desk, chair, scroll cases, and a worn rug.
- **Roadside shrine:** a small shrine, offering bowls, stone markers, and restrained
  vegetation.

Start each pack with a coherent scene. Scene objects should share
orientation and spacing: a chair belongs near a desk, and supplies belong near a
tent. These are optional visual arrangements, without built-in encounters or
game-system rules.

**A good result:** the scene is recognizable without its label, leaves generous
usable floor, survives save/reopen, and does not place objects across the main path.

### F10 — Focal landmarks

**First slice implemented and verified 23 October 2026: standing-stone circle for Forest.**
A separate Landmark control offers None / Standing-stone circle through configure-then-generate.
The circle works across all four characters and can accompany an Abandoned camp.
Its six stones each block one tile; a reserved 7 × 7 area leaves the 3 × 3 center
and circulation margin clear. Stones stay off the stored path, camp and circle
reserves cannot overlap, and completed-map connectivity and density budgets are checked.
Applying or removing it preserves layout, surface seed, and revision; Shuffle
retains the accepted landmark. Rejected placement preserves the map and draft for retry.
Library saves, reopening, backup import, accessible descriptions, and PNG export
include the accepted landmark. New backups use format 5.0.0; formats 1–4 remain
readable. Existing generator streams and model/pixel baselines remain unchanged.

Verification: **387 unit tests**, all **59 existing browser cases**, and the **2 new
landmark browser cases** pass (the new cases were rerun after correcting their
accessible-label selector). Test type checking, production build, and formatting
pass. Inspected generated full maps and close-ups plus desktop, narrow mobile,
keyboard focus, and disabled controls; responsive checks cover 768, 390, and 320 px.
Dungeon focal features and the larger catalog below remain future work.

**Architecture follow-up, 26 October 2026.** A shared catalog now owns stable
landmark IDs, labels, descriptions, and map support, with forest placement and
validation kept in an explicit rule registry. Scene reservations describe protected
areas and props, replacing the circle's knowledge of camp-specific geometry.
New saves use format 6.0.0; format-5 `Suggested landmark` values normalize to
`standing-stone-circle` without regenerating their maps. Historical vocabularies
stay frozen. Pre-refactor placement baselines cover every character and density,
with and without camp, before and after shuffling. No new landmark or map type
is introduced by this preparation.

Verification: **403 unit tests** pass, including the new placement baselines,
arbitrary feature reservations, catalog filtering, and save migration. The **59
existing browser cases** and **4 landmark cases** pass across the full and targeted
runs; the targeted rerun verifies the corrected selection of dynamically rendered
options when opening a forest save. Build, test type checking, formatting, and
Markdown checks pass. Desktop, mobile, keyboard focus, and disabled export states
were inspected.

**Dungeon slice implemented and verified 26 October 2026: Weathered statue.**
The shared Landmark control now offers the statue for dungeons and the stone
circle for forests. The statue and plinth fit one blocking tile within a clear
5 × 5 reserve in a suitable room. Entrance, objective, and study rooms are excluded;
door/corridor clearance, per-room budgets, connectivity, and clear 2 × 2 spaces
remain protected. Study reservations retain the entire study room and its furniture.
Applying/removing the statue preserves layout, surface seed, and revision; Shuffle
retains the accepted choice. A rejected placement keeps the accepted map and draft
available for retry. Saves, reopening, backup import, accessible descriptions, and
PNG filenames include the accepted statue. New backups use format 7.0.0; formats
1–6 remain readable. The additive `dungeon-landmark` stream leaves existing
no-landmark models, forest placements, and pixel baselines unchanged.

Verification: **438 unit tests** and **66 browser tests** pass. Statue generation
covers all four characters, all densities, 4/6/8 rooms, and scenes with and without
the study, with independent flood-fill and clear-square checks. Browser coverage
includes draft isolation, keyboard selection, shuffle/reset, type switching,
removal/reopening, refresh, backup import, PNG export, and no-space recovery.
Test types, production build, formatting, and Markdown checks pass. Inspected
full-map and close-up artwork, desktop, mobile, focus, and disabled controls;
responsive checks cover 768, 390, and 320 px. Other focal features remain proposals.

**Medium. New; complements I18.** Offer one optional focal feature suited to the map:
a dry fountain, ancient tree, standing-stone circle, statue base, or fallen monument.
Provide a simple choice such as **None / Suggested landmark** before exposing a
catalog. Reserve space around it so it helps composition rather than filling the
largest open area indiscriminately.

**A good result:** a landmark gives the scene a clear identity and leaves enough
space for an encounter. Its footprint and movement classification are explicit.

### F11 — Furniture and structural prop families

**First slice implemented and verified 26 October 2026: multi-tile Dining table.**
The optional dungeon Furniture control offers None / Dining table through
configure-then-generate. One wooden table occupies and blocks a true 2 × 1 footprint,
rotating to 1 × 2 as needed. Its stored local dimensions and clockwise quarter-turn
rotation drive shared world bounds, occupied cells, rendering, clearance, overlap
checks, and per-room blocking budgets. The whole drawing, including its shadow and
small tabletop objects, stays inside the occupied cells. Placement leaves one clear
tile on every side and protects doors, architectural landmarks, study rooms, and
statue reserves; completed-map checks retain connectivity and clear 2 × 2 space.

Applying/removing furniture preserves layout, surface, and detail revision; Shuffle
retains the accepted option and may change placement/orientation. Rejected placement
keeps the accepted map and draft for retry. Saves, reopening, backup import, accessible
descriptions, and PNG export use accepted settings and preserve the exact footprint
and orientation. New backups use format 8.0.0 with frozen footprint/rotation rules;
formats 1–7 remain readable. The additive `dungeon-furniture` stream and None default
preserve existing model and pixel baselines. Legacy props retain their original
implicit one-tile movement classification and artwork.

Verification: **494 unit tests** and **69 browser tests** pass. Engine cases cover all
four characters, all densities, 4/6/8 rooms, study/statue combinations, all rotations,
independent flood-fill and clear-square checks, and rejection of a two-tile table in
a one-tile budget. Save tests reject missing, malformed, overlapping, and unsupported
footprints/rotations. Native pixel checks verify that every rotation paints both
occupied cells and no pixels outside them. Browser cases cover draft isolation,
keyboard operation, shuffle/reset, type switching, removal/reopening, refresh,
backup import, export, and no-space recovery. Build, test types, formatting, and
Markdown checks pass. Inspected generated artwork, desktop, mobile, focus, and
disabled controls; responsive checks cover 768, 390, and 320 px. Other furniture
families, nonrectangular footprints, and manual object editing remain future work.

**Medium–large. New detail supporting I14 and I28.** Add tables, benches, shelving,
beds, counters, empty braziers, short fences, and freestanding columns. Prioritize
objects needed by the next selected scene, rather than a large disconnected catalog.

Multi-tile objects need an actual occupied footprint, rotation, consistent scale,
and placement clearance. A long table must not look four squares wide while blocking
only its center. Fences and low walls need an explicit movement policy; appearance
alone should not imply cover or line-of-sight rules the app does not model.

**A good result:** objects are readable under the grid, have consistent scale, and
leave usable circulation through the whole footprint of the scene.

### F12 — Surface storytelling

**First slice implemented and verified 28 October 2026: Forgotten study.**
New dungeon studies have a few loose papers and a small ink spill near the desk
and shelves, with softly faded stone and fine scuffs inside doorways. These are
flat renderer details, with no new picker entries, props, blocking tiles, or
changes to placement, circulation, layouts, or existing random streams. They
avoid objects, the rug’s visible area, and architectural landmarks; papers also
stay outside door and corridor reserves. The grid remains above the marks.

Save format 10.0.0 records the optional `studySurface: 1` artwork marker. Historical
studies without it retain their exact original pixels through opening, saving,
refresh, sharing, and PNG export. Generating appearance changes or shuffling
adopts the new details; Undo restores the previous model and artwork exactly.
Generator version remains 4.0.0. Formats 1–9 keep their frozen vocabularies and
reject the marker; unsupported markers and markers on other scenes/types are
rejected rather than discarded. A pre-change format-9 study fixture and literal
grid-on/off pixel hashes protect historical artwork independently of generation.

Verification: 361 focused unit/review tests and 10 focused Chromium tests passed,
plus test typechecking, production build, and formatting. Coverage includes all
four dungeon characters and study rotations, density variations, immutable inputs,
unchanged placement versus the captured old model, rejection of unsupported save
data, artwork changes confined to study-object and marked floor tiles at 64/70/100 pixels per tile,
and exact PNG restoration through shuffle Undo/Redo and sharing/reimport. Browser
coverage also includes study drafts, removal, refresh, failed placement/recovery,
and responsive layouts at 1440/768/390/320 px. Visual review compared old/new room
artwork for every character at 64 and 100 pixels per tile; artifacts are under
`artifacts/f12/`. The full browser suite was not run. Other surface-storytelling
themes remain future slices.

**Wall-clearance follow-up verified 28 October 2026.** Study furniture previously
used a whole floor tile even where solid wall strokes occupied its edge. New
study artwork now centers each desk, bookshelf, and scroll case in the exposed
part of its own tile, scaling uniformly when needed; paper and wear centers use
the same wall clearance. Complete sprites stay visible without crossing the
solid wall. Logical positions, blocking, placement streams, save vocabulary, and
unmarked historical artwork stay unchanged. Pixel regressions first reproduced
the overlap at 64/70/100 pixels per tile and now pass. Verification: 36 focused
unit/review tests, four study Chromium tests, test typechecking, production build,
and formatting; sprite coverage includes all rotations, variation extremes, wall
sides and corners, intact interior artwork, and immutable inputs. Visual review
checked all four characters at 64/100 pixels per tile. The full browser suite was
not run.

**Second slice implemented and verified 29 October 2026: Forest floor details.**
New forests automatically receive muted leaf drifts for Verdant, warm fallen leaves
for Autumn, pine-needle clusters for Pines, and pale petals for Fey. A small uneven
spill of cold ash accompanies abandoned camp hearths. The artwork stays flat and
non-blocking, with no new picker entries or settings. Drifts concentrate near trees,
stumps, and logs, with sparse accents deeper in the clearing. Paths, object cells,
camp reserves, clearing contours, and standing-stone encounter areas stay clear;
ash beneath the hearth itself is intentional. The layer draws beneath contours,
ground props, objects, and grid lines, with every stroke confined to its tile.

Save format 12.0.0 supports the optional `forestSurface: 1` marker. Old snapshots
without it retain their exact artwork through loading, normalization, saving,
sharing, and PNG export; Generate appearance changes or Shuffle adopts the new
details. Undo/Redo and pinned snapshots retain the original model and pixels.
Formats 1–11 keep their frozen vocabularies and reject the marker. Unknown values
and metadata on other map types are rejected rather than silently dropped.
Generator version stays 4.0.0: layout, path, object placement, blocking, and engine
RNG consumption remain unchanged. A separate per-tile `forest-surface` seed drives
the details, with an independent `camp-ash` direction for an uneven spill.

Captured all four pre-change forest characters with camp and circle in the frozen
`save/fixtures/forest-v4-surfaces.json` before editing generation/rendering. Eight
literal grid-on/off pixel hashes protect those original images. Existing forest-v3
fixtures and historical model/pixel hashes remain unchanged; tests omit only the
new artwork marker when checking the original generated model shape.

Verified: the full unit/review suite passes all 806 cases across 57 files, including
33 new surface cases. All 20 focused Chromium cases pass, covering historical
characters, exact PNGs after shuffle Undo/Redo and pin selection, drafts, camp
removal, type retention, refresh, sharing/import, legacy v3/v5 imports, and native
Roll20/Foundry exports matching their prepared image bytes. New tests cover all
characters/densities, camp/circle combinations, deterministic immutable inputs,
rejected metadata and recovery, and pixel changes confined to marked ground tiles
at 64/70/100 pixels per tile. Typechecking, production build, formatting, and edited
Markdown checks pass. Inspected old/new artwork and camp close-ups for every
character at 64/100 pixels per tile, plus normal/focused browser previews down to
320 px. Artifacts are under `artifacts/forest-surface/`. Browser coverage remains
Chromium-only; the full browser suite and physical touch devices were not checked.

**Small–medium. Extends I12 beyond recoloring.** Add restrained non-blocking details:
leaf drifts, scattered papers, worn paths, ash, cracks, footprints, and patches of
fallen petals. Coordinate them with a scene: papers near a desk, ash near a fire,
and heavier wear through a doorway.

**A good result:** the map looks less uniformly decorated at close range while
remaining clean at fit-to-view. Flat markings do not become movement obstacles.

## Quality of life and keeping good results

### F13 — Recent maps and undo shuffle

**First slice implemented and verified 26 October 2026: Undo / Redo shuffle.**
Compact arrow buttons beside Shuffle restore exact accepted snapshots, including
object positions, orientation, artwork, and detail revision. Dungeon and Forest
each retain the latest 20 successful shuffles during the current session. Drafts
stay untouched, and Save/Export use the restored accepted map. Switching types,
editing/resetting drafts, saving, and exporting retain each history position.

A successful settings application or opening a saved map starts a fresh history
only for the affected type. Rejected actions and unchanged-settings submissions
retain history. A successful new Shuffle after Undo replaces the redo branch;
refresh clears both histories. Refused shuffles now report that the displayed map
is unchanged. The limit is visible beside the controls. Undo/Redo remain focusable
with guarded `aria-disabled` states, preserving keyboard focus through busy states
and history boundaries, with status announcements after restoration.

History lives in `WorkbenchSession`, separate from named saves. It holds bounded,
immutable snapshot references and restores them without invoking the generator.
There are no new persisted fields or vocabulary changes; generator and save-format
versions remain unchanged. Recent-result strips and undoing Generate remain future
work, outside this first slice.

Verified: **321 relevant unit tests**, including **19 new history cases**, and all
**77 Chromium browser cases across three groups**. Checks cover exact restoration
without engine calls, the history limit, branching, type/session isolation,
appearance/layout/open boundaries, failures and retry, and revision exhaustion.
Browser cases verify identical restored preview pixels and PNG bytes for Dungeon
and Forest, exact historical forest models and exports, accepted-map saves, draft
retention, keyboard operation, disabled-action guards, export failure/recovery,
and refresh.
Test type checking, build, formatting, and Markdown checks pass. Inspected desktop,
tablet, and 320 px controls, keyboard focus, history boundaries, and disabled states.
Review images are in `artifacts/f13/`. Browser coverage remains Chromium-only.

**Medium. Develops I06 and complements I07.** Keep a bounded session history of
accepted map snapshots, starting with **Undo shuffle** and a small recent-results
strip. Store the full accepted result so returning to it restores the exact artwork,
not an approximation generated from its seed. History is separate from named saves.

**A good result:** Generate or Shuffle can be reversed without losing the previous
map. Pending edits, per-type restoration, and the difference between session history
and permanent saves have an explicit policy. Handle history limits visibly.

### F14 — Pin and compare variants

**First slice implemented and verified 28 October 2026: Pin and switch candidates.**
**Pin this map** retains the exact accepted Current snapshot while the user
explores. Current / Pinned buttons above the existing preview identify the
displayed candidate; Save, Quick export PNG, and Export options use that snapshot,
including its accepted settings and historical artwork. Each map type retains one
pin and its own selection until refresh, explicit replacement, or clearing.

Settings, pending changes, and shuffle history belong to Current. A note explains
this while viewing Pinned. Successful Generate, Shuffle, Undo/Redo, and Open bring
Current into view without changing the pin. Failed actions and unchanged Generate
submissions retain selection; comparing retains drafts, validation feedback,
unfinished library inputs, grid, zoom, and pan. Replace pinned map explicitly
replaces the pin with Current and is unavailable while viewing Pinned. Clear pin
returns to Current and focuses Pin this map; it does not delete a library record.
Pins remain separate from shuffle history and persistent saves.

`WorkbenchSession` owns the bounded per-type comparison state: immutable map
references and a selected candidate, with `currentMap` for generation/settings
and `map` deriving the displayed snapshot for consumers. Pinning and comparing
invoke neither the engine nor persistence. No generator, save-format, historical
vocabulary, or storage coordination changes were needed. The controls also work
in Focus map and retain guarded keyboard-focusable disabled states during work.

Verified: 62 focused unit tests, including 13 new comparison cases, and all 29
Chromium cases across focused comparison, focus-view, and pending-settings runs.
Checks cover all map types, exact saved models and Quick/configured PNG bytes,
historical study pixels, generation/open/history behavior, replacement/clearing,
type/session isolation, unchanged drafts/inputs, validation and export failures,
retry, busy guards, keyboard focus, and refresh. Typechecking, production build,
and formatting pass. Inspected normal and focused comparison layouts at
1440/768/390/320 px; regression checks also cover 320 × 568 and 800 × 420 focus
layouts. Artifacts are under `artifacts/f14/`. Coverage is Chromium-only; the full
browser suite and physical touch devices were not checked. Side-by-side previews,
promoting Pinned to editable Current, and selective room/object locks remain future
slices.

**Medium. Develops I07 and I17.** Let a user pin one candidate, explore another, and
switch between A and B. On desktop, offer a side-by-side comparison; on narrow
screens, use labeled switching. Start with whole-map snapshots. Locking individual
rooms or editing selected objects can follow later.

**A good result:** generating B cannot overwrite A, the selected candidate is clear,
and Save/Export use that candidate's accepted settings and artwork.

### F15 — Library search, filters, and sorting

**Implemented and verified 27 October 2026.** A compact library toolbar searches
saved names and seeds and combines map-type and Favorites only filters. Favorites
first retains the existing default order; Newest first and Name A–Z are explicit
alternatives. Names use case-insensitive, natural number ordering. The result count
shows matches and the total readable collection. Clear filters restores all maps,
keeps the selected sort, and returns focus to search. No matching results has its
own explanation, separate from an empty library or storage recovery.

Browsing preferences stay in the page session through map switches, opens, and
library mutations; refresh resets them. Local and cross-tab changes update the
same filtered view. A local rename, unfavorite, or deletion that removes a result
returns keyboard focus to search. Failed writes retain the visible records and
filters and allow retry. Readable maps remain searchable during recovery, and
backups include the whole readable library, including filtered-out maps. Filtering
and sorting do not write preferences or alter saved models, storage coordination,
generator output, or save-format vocabulary.

Verified: **285 relevant unit tests**, including **14 new browsing cases**, and
**all 98 Chromium browser cases across split runs**, including **15 new library
browsing cases**. Checks cover a 36-map collection, combined filters, sorting,
empty/first-save/last-delete states, cross-tab updates, write/export failure and
retry, exact saved models in full backups, recovery data, keyboard focus, and busy
controls. Inspected responsive layouts at 320, 768, 801, 900, 1024, and 1440 px;
text contrast checks pass at 320, 768, and 1440 px. Test type checking, production
build, and formatting pass. Review images are in `artifacts/f15/`. Other browser
engines and physical touch devices were not checked. Tags and campaign folders
remain future work.

The original proposal follows for context.

**Small–medium. New extension of I02.** Search by name and seed; filter by map type
and favorites; sort by newest or name. Keep a visible result count and a clear way
to reset filters. Introduce tags or campaign folders only after basic search is useful.

**A good result:** a collection of dozens of maps stays easy to browse; renamed maps
update correctly; external-tab changes remain visible; an empty search explains
that results are filtered rather than implying the library was lost.

### F16 — Safer library actions

**First slice implemented and verified 27 October 2026: Undo delete.** A compact
row above the library filters names the last deleted map and offers Undo delete.
Each tab retains one complete deleted save until its next successful deletion or
page refresh. Other library actions and map-type switches retain it. Restoration
keeps the original model, artwork, name, favorite status, thumbnail, timestamp, and
ID, while preserving the accepted map, pending settings, viewport, and filters.
The restored map stays subject to those filters; a notice explains if they hide it.
Successful Undo returns focus to search. Deleting a card also ends its unfinished
rename, so restoring it shows the saved name.

`SaveStore` captures the latest record inside the shared write lock and publishes
the snapshot only after deletion succeeds. Undo reads the current snapshot and
latest library inside that same lock, refuses an occupied ID, and clears the
snapshot only after a successful write. Failed deletions retain the previous Undo;
failed restores and unreadable-storage recovery retain it for retry. Concurrent
Undo commands cannot duplicate a record or overwrite another tab's changes. Undo
remains focusable with guarded `aria-disabled` states while writes wait or fail;
errors appear beside the action. The deletion announcement remains available to
assistive technology without repeating its visible message. Long names wrap in
the Undo row and library notices. No persisted fields or format versions changed.

Verified: **70 relevant unit tests**, including **14 new store cases**, and
**89 relevant Chromium browser cases across split runs**, including **17 new Undo
cases**. Checks cover exact records and PNGs for all three map types, historical
forest artwork after restore/refresh/reopen, latest cross-tab metadata, occupied-ID
conflicts, queued writes and repeat activation, quota failures and retry, storage
recovery, filters, keyboard focus, expiration, rename drafts, and busy exports.
Inspected 1440, 768, 390, and 320 px layouts plus an 800 × 420 short viewport,
including focus, disabled, and error states. Text contrast passes at 1440, 768, and
320 px. Test type checking, production build, formatting, and Markdown checks pass.
Review images are in `artifacts/f16/`. Other browser engines and physical touch
devices were not checked. Bulk export remains a future slice.

The original proposal follows for context.

**Small–medium. New.** Offer a brief, explicit way to undo deletion. Add bulk export
of selected maps before considering bulk deletion. A restore must preserve the saved
model and avoid overwriting another tab's newer work or duplicating its identifier.

**A good result:** an accidental deletion is recoverable through a keyboard-accessible
action, and cross-tab conflicts have a clear outcome. Define undo lifetime and what
happens after refresh; do not imply a permanent recycle bin unless one exists.

### F17 — Exact single-map sharing and preparation notes

**First slice implemented and verified 28 October 2026: Export this map.** Each
saved card downloads one saved snapshot as JSON, using the existing backup bundle
format with exactly one record. Import backup accepts the file in another browser;
Open restores its exact model and original artwork. The saved name, ID, favorite
status, timestamp, thumbnail, settings, and detail revision remain intact. Existing
IDs are skipped without overwriting their records. No generator or save-format
change was needed.

The library explains the distinction between one-map JSON sharing, whole-library
backup, and PNG images for VTTs. Filenames use a bounded, safe form of the saved
name. Export refreshes the readable library before resolving the selected ID, picks
up cross-tab edits, and rejects a deleted record rather than exporting stale data.
Readable cached maps remain exportable during recovery or unavailable storage,
matching the existing backup policy. The action performs no storage writes and
does not require a write lock. Read failures and unreadable data stay recoverable;
download failures show a retry message, and sharing does not consume Undo delete.

Verified 203 relevant unit tests and 21 distinct Chromium cases across focused
runs. New checks cover one-record selection, safe filenames, latest/stale records,
recovery, missing Web Locks, preserved Undo, exact fresh-library round trips and
PNG equality for Dungeon, Courtyard, and historical Forest artwork, duplicate
imports, rejected-file preservation, download failure/retry, disabled states, and
responsive keyboard access. Existing backup, library layout, and contrast checks
pass, alongside test type checking, build, formatting, and Markdown validation.
Desktop, tablet, and 320 px screenshots were inspected; other browser engines and
physical touch were not checked. Copy map details, preparation notes, and URL
sharing remain future slices.

Original proposal:

**Small–medium. Develops I04, I08, I09, and I31.** Add **Export this map** as a full
model snapshot and **Copy map details** as plain text. Let a named save carry private
preparation notes. Make snapshot sharing the first step; settings-only recipes and
URLs need a separate compatibility decision, especially for edited legacy maps.

**A good result:** the receiver can import and export the same saved artwork; the
current map survives a rejected import. Notes stay out of player-facing PNGs and
are excluded from shared files by default, with explicit opt-in when useful.

### F18 — Export panel

**First slice implemented and verified 27 October 2026.** Export options opens a
compact native dialog with the actual full-resolution PNG preview and final
2560 × 1920 dimensions. Include grid and a 0–100% opacity slider are independent
of the workbench Grid toggle. They start at grid on / 15% and retain their choices
through closing, reopening, and map-type switches in the page session; refresh
restores those defaults. The Quick export PNG action remains the quick route
using the workbench's grid and original renderer opacity.

The dialog captures the accepted map when opened and downloads the same prepared
PNG Blob shown in its preview. Pending settings and viewport pan/zoom remain
untouched. Configured filenames add `-grid-Npct` or `-grid-off`. A failed preview
can be retried; a failed download retains the image for retry. Scheduled frames are
cancelled, obsolete encoding results ignored, and preview URLs released when
options change or the dialog closes. Closing during preparation and switching
maps cannot display the older job's result. Native modal behavior keeps background
controls inert and restores focus; retrying a preview focuses its stable heading.
No generator or save-format changes were needed; the optional renderer opacity
changes only the grid, and omitted opacity preserves original artwork.

Verified: **90 relevant unit tests across split runs**, including **16 new cases**,
and **all 121 Chromium browser cases across split runs**, including **14 new export
cases**. Checks cover exact preview/download bytes for all three map types,
opacity boundaries and an independent overlay oracle, unchanged historical pixel
baselines, accepted maps and drafts, retained viewport state, stale jobs, URL
cleanup, preview/download failure and retry, quick export, and keyboard focus.
Inspected desktop, tablet, 390/320 px mobile layouts, and an 800 × 420 short
landscape viewport, including focus, disabled, and error states. Contrast checks
pass at 1440, 768, and 320 px; test type checking, production build, and formatting
pass. Review images are in `artifacts/f18/`. Other browser engines and physical
touch devices were not checked. Grid colors, paired downloads, coordinate margins,
captions, and print tiling remain future slices.

**Second slice implemented and verified 28 October 2026: VTT export presets.**
Export options now offers Standard PNG (64 px/square, 2560 × 1920), Owlbear Rodeo
(64 px/square, 2560 × 1920), Roll20 (70 px/square, 2800 × 2100), and Foundry VTT
(100 px/square, 4000 × 3000). Each exports the same accepted 40 × 30-square map;
larger images are rendered directly at their selected resolution. VTT presets
start without a drawn grid, with grid/opacity controls available for overrides.
Preset changes reset the grid to that preset's default and retain opacity. The
selected preset and grid choices persist across closing/reopening and map types;
refresh restores Standard, grid on, and 15% opacity.

Setup text explains square count, pixels per square, and 5-foot scale, with links
to the official platform guides. VTT filenames include the platform, `40x30`, and
pixels per square; Owlbear documents using filename dimensions for alignment.
Standard and Quick export retain their previous filenames, dimensions, and
artwork. These are PNG presets with setup guidance, not native VTT scene files.
No generator, model, or save-format changes were made.

Verified 78 relevant unit tests, including independent historical pixel baselines,
and 26 distinct Chromium cases across focused runs. Checks cover all map types,
native dimensions, identical preview/download bytes, optional grids, preserved
drafts and Quick export, legacy forest exports, preset retention, delayed results,
preview/download recovery, responsive scrolling, keyboard focus, and contrast.
The reopening test exposed a native select initially showing Standard despite the
retained preset; binding selected options fixes the mismatch. Test type checking,
production build, formatting, and Markdown checks pass. Desktop, tablet, 320 px,
short-landscape, focus, and error screenshots were inspected. Other browser engines,
physical touch, and imports into live VTT accounts were not verified.

**Third slice implemented and verified 30 October 2026: Individual Tower floor exports.**
Export options now offers Whole tower or one numbered floor. A floor PNG is
16 × 18 squares, including its heading, original walls and furnishings, and stair
and destination labels. Standard and Owlbear images are 1024 × 1152 pixels;
Roll20 uses 1120 × 1260 and Foundry uses 1600 × 1800. The actual preview, dimensions,
VTT setup guidance, and filename follow the chosen floor. Whole-sheet and Quick
export behavior remains intact, and each dialog opening starts with Whole tower.

Secret floors appear in the selector only with Show secrets enabled. Disabling it
while a secret floor is selected returns to Whole tower and invalidates the secret
preview. Player exports omit portal markers even on the individual source floor.
The export boundary also rejects hidden, invalid, and non-Tower floor requests.
Floor selection participates in preview identity checks, so stale jobs cannot
replace a newer choice or enable a mismatched download. Retry retains the choice.

The PNG is an integer-pixel crop of the rendered accepted sheet without resampling.
An initial translated-vector approach showed small antialiasing differences in
independent pixel comparisons; cropping preserves the exact original artwork and
grid phase instead. The preview respects the image's actual aspect ratio. Models,
generator versions, save vocabularies, drafts, pins, and workbench viewport state
are unchanged; the export choice is not saved with the map.

Verified: 54 focused unit/review checks across runs and 30 distinct Chromium cases
across runs, covering exact sheet-crop pixels for both stair styles at all three
resolutions with/without grids, unchanged historical baselines, hidden and invalid
floor rejection, drawing-surface failure, preview/download byte equality, accepted
settings and viewport preservation, unchanged Quick export, secret-floor reset and
URL cleanup, stale jobs, failed preview/retry, native keyboard focus, and mobile,
tablet, and short-window access. The separate-stairs browser case initially read
the summary before generation committed; it now waits for the accepted style.
Typechecking, production build, formatting, and explicit Markdown validation pass.
Inspected desktop and 320 px mobile selection/preview/focus/loading views, tablet,
and short landscape exports in `artifacts/tower-floor-export/`. Full suites,
other browser engines, physical touch, and live VTT imports were not run for this slice.

The original proposal follows for context.

**Medium. Develops I05 and I24.** Keep today's PNG default and progressively add
grid opacity/color, a grid-on/grid-off pair, an optional margin with coordinates,
and a reproduction caption. Show the final dimensions and a preview before download.
Treat print tiling with overlap and physical square sizes as a later independent
slice requiring actual print verification.

**A good result:** paired exports contain the same scene, labels never cover playable
tiles, and viewport pan/zoom has no effect on the downloaded image. Make any partial
failure during multiple downloads recoverable. Do not advertise VTT metadata merely
because an image has a grid.

## UI and UX improvements

### F19 — Faster access to the map on mobile

**Implemented and verified 27 October 2026.** At widths up to 800 px, a compact
**Settings / Map / Library** row sticks to the top while browsing the workbench.
Native links jump to and focus each section heading; Tab continues into its
controls. A dot and accessible pending-changes label on Settings follow the active
map type's draft. The row remains usable during generation and export, while
conflicting editing controls retain their existing disabled behavior.

Sections stay mounted, preserving independent drafts, accepted maps, exact canvas
pixels and zoom/pan, library filters, and unfinished save/rename inputs. Native
fragment history supports Back and Forward. Scroll padding keeps destinations
below the sticky row, including keyboard focus and error messages brought into
view. Jumps use instant scrolling and respect reduced-motion preferences. No
generator, save-format, persistence, or compatibility changes were needed.

Verified: **127 relevant unit tests** and **all 107 Chromium browser cases across
split runs**, including **9 new navigation cases**. Checks cover all three map
types, pending/reset/generated states, repeated jumps, keyboard focus, modal
isolation, exact viewport retention, history, desktop/mobile resizing, and export
failure and retry. Inspected 320, 390, and 768 px layouts and an 800 × 420 short
landscape viewport, plus desktop. Normal, pending, keyboard-focus, disabled, and
error states were reviewed. Text contrast passes at 320, 768, and 1440 px; test
type checking, production build, and formatting pass. Review images are in
`artifacts/f19/`. Other browser engines and physical touch devices were not checked.

The original proposal follows for context.

**Small–medium. New.** The inspected mobile layout puts the complete settings panel
before the preview. Add a **View map** shortcut and a compact accepted-map summary,
or offer clearly labeled **Map / Settings / Library** sections that preserve state.
Keep the changed-settings indicator and Generate action easy to find.

**A good result:** users can inspect the generated map without repeatedly scrolling
past every control. Switching sections preserves drafts, viewport, and keyboard
focus; sticky controls do not obscure content or error messages.

### F20 — Visual choices as the catalog grows

**First slice implemented and verified 29 October 2026: Illustrated character picker.**
Dungeon and Forest now have a compact selected-character preview and Choose
character action. The native modal offers four illustrated radio cards for the
active type, using the existing names and descriptions. Choices update only the
existing preset/character draft; Done, Close, and Escape retain that choice and
return focus to the opener. A Pending badge distinguishes it from Current, and
Generate remains the action that applies it. Reset, Open, and per-type draft
retention restore the matching illustration and selection. Courtyard joined
the picker on 9 November 2026 with four characters of its own (see I20).

Illustrations are actual Canvas-rendered crops of independent fixed-seed examples,
with an undistorted common aspect ratio. Dungeon samples show representative
rooms, while forest samples show woodland edges and ground detail. They never
use or modify the accepted map or draft seed. Gallery images load when opened;
small data URLs are cached by type and character, while full-size canvases and
example maps are released. No engine behavior, save vocabulary, generator/save
version, persistent state, or historical artwork changes were needed.

Native radio arrows/Space select a look, focus scrolls the entire card into view,
and the heading/footer stay available while the catalog scrolls. Narrow and short
screens use compact illustrated rows. The modal lives outside the generation form
so radio Enter cannot submit Generate. The opener is disabled during work, and
queued close events cannot empty a gallery already reopened.

Verified: 91 focused unit/review checks, including eight deterministic valid-sample
cases and two illustration reviews, plus all 48 Chromium cases across focused
picker, settings, contrast, save, and existing dungeon/forest addition runs.
Checks cover distinct real illustrations, cached reopening, exact accepted saves
and PNGs while choices remain pending, Reset/Open/type retention, native keyboard
and focus restoration, invalid drafts, rapid reopening, busy export/failure
recovery, and unchanged configure-then-generate behavior. Test typechecking,
production build, formatting, and Markdown checks pass. Inspected normal, selected,
focused, and disabled states, all eight samples, and layouts at 1440/768/390/320 px
and 800 × 420. Text contrast passes at desktop, tablet, and mobile widths.
Artifacts are under `artifacts/characters/`. The full unit and browser suites,
other browser engines, and physical touch devices were not checked. Illustrated
map-type choices and a curated starting gallery remain future slices.

**Medium. New; complements I10.** Keep the two current map-type controls simple.
When a third type ships, consider a compact chooser with illustrated examples.
Character options could use small artwork samples rather than only names. An
optional curated starting gallery can offer **Explore ruins** or **Build a camp**.

**A good result:** previews represent the actual available generators, names remain
accessible, selected/pending state is clear, and no disabled placeholder promises
a type that does not exist. Curated examples remain distinct from seeded generation.

### F21 — Clearer previews of pending changes

**Implemented and verified 28 October 2026.** The existing settings flow now shows
only changed fields with accepted → draft values for seed, rooms, character,
additions, and decoration. Character and addition names match the picker. Generate
describes a new layout, an appearance update that keeps the layout, or the need to
correct invalid settings. Its accessible description uses that same explanation.
The summary reminds users that Save and Export use the displayed map; applying,
resetting, correcting back to accepted values, and opening a save clear it.

`WorkbenchSession.generationEffect` derives the prediction from the existing
validation and layout decision. A plain presentation function builds comparison
rows without changing drafts, maps, generation, or save compatibility. Seed
whitespace, equivalent valid room counts, and omitted optional additions do not
create false differences. Draft comparisons stay independent per map type and
survive focus view and failed export. Existing field error associations remain.

Verified 68 relevant unit tests and 15 distinct Chromium cases across focused
runs, including all three map types, generation/reset, invalid input and recovery,
save/export preservation, focus view, 64-character values with every addition,
keyboard reset, disabled states, and measured text contrast at 1440, 768, and
320 px. Test type checking, build, formatting, and Markdown checks pass. Desktop,
tablet, narrow, keyboard-focus, and disabled screenshots were inspected; other
browser engines and physical touch were not checked. The full browser suite was
not rerun for this focused change.

Original proposal:

**Small–medium. New extension of the current draft workflow.** Replace a generic
changed-settings notice with a concise summary such as **Character: Crypt →
Sanctuary; density: Balanced → Sparse**. Explain whether Generate will rebuild the
layout or only replace decoration, and emphasize that the displayed map remains
the one used by Save and Export.

**A good result:** users can predict what Generate changes without learning internal
terminology. Corrected or reset drafts remove the summary, and invalid values still
have associated field errors.

### F22 — Focus view and discoverable controls

**First slice implemented and verified 27 October 2026: Focus map.** The map toolbar
opens a screen-sized layout with the existing Grid, pan/zoom, Fit, Quick export PNG,
and Export options controls. Settings and library components remain mounted but
hidden, preserving drafts and unfinished inputs. The same canvas and cached artwork
remain mounted; resize limits the visible pan without discarding the stored offset.
Back to workbench and Escape restore the previous scroll position and focus the
entry button. An open export dialog handles Escape first. Returning remains possible
during an export, and failures retain their visible message and recovery path.

Verification covers all three map types, unchanged PNG bytes and accepted settings,
canvas identity, drafts/library inputs, moderate and boundary pan restoration,
keyboard controls, nested-dialog Escape, export failure/retry, and five responsive
sizes from 320 px to desktop, including short landscape. The boundary-pan regression
failed before preserving the offset. Relevant existing viewport/mobile navigation
checks, session unit tests, test type checking, build, and formatting pass. Chromium
screenshots were inspected; other browser engines and physical touch were not
checked. Keyboard help and compact Shuffle/Save actions remain future slices.

Original proposal:

**Small–medium. New focus-view proposal; develops I23.** Offer a map-focused view with compact Grid,
Fit, Shuffle, Save, and Export actions. Include a short keyboard-help panel using
the existing pan/zoom controls plus carefully selected new shortcuts. Preserve a
clear route back to settings and avoid intercepting text entry.

**A good result:** artwork gets more screen space, Escape returns predictably, and
all actions remain usable without fullscreen browser support or keyboard shortcuts.

### F23 — Simple distance measurement

**Medium. Develops I21.** Add an optional ruler that reports squares and an editable
distance-per-square label. Start with straight-line measurement and name that rule
explicitly; routed movement and game-specific diagonal rules can be separate choices.

**A good result:** users can measure without accidentally panning, clear the ruler
easily, and export a clean map without temporary measurement marks. Keyboard access
needs a deliberate design rather than assuming pointer-only operation is enough.

## Additional selected feature — multi-floor tower

**Implemented scope — 29 October 2026:** Tower is a fourth map type, selected in discussion after F20. It has 3–8 numbered circular floor plans on one sheet, matched stair letters and destination markers, and one optional portal pair from a chosen regular floor to the final secret floor. The destination counts toward the total and has no staircase access. Each floor retains a playable scale; sheet dimensions vary with the count rather than squeezing eight chambers into 40 × 30. This is a focused use of variable dimensions and connected locations; F25 and F26 remain broader proposals.

The initial character is a ruined wizard’s tower, with floor purposes, stonework, and furnishings. In the initial v1 implementation, seeds varied texture and decoration while the footprint and stair arrangement were fixed; the connection follow-up below supersedes that arrangement for new towers. Configure-then-Generate, independent drafts, density changes, shuffle history, pins, saves, backups, thumbnails, and VTT export presets include Tower. Show secrets controls the preview/Quick export; Export options can override it for the prepared PNG. Player images omit the hidden chamber and both portal markers without moving the other floors. JSON saves and shared files retain the complete tower; thumbnails hide secrets and show the whole sheet.

Tower uses its own generation version, preserving existing generators, streams, and historical artwork. Save format 13 adds the new map vocabulary; formats 1–12 remain readable with their frozen vocabularies. See [README.md](README.md) for reproduction settings, sheet dimensions, compatibility, and player/GM export behavior. More tower characters, room partitions, alternative normal-floor connection types, and editable floor purposes remain future work.

**Verification:** all 849 unit/review checks pass, including deterministic generation across every floor count, density, and portal source; independent movement traversal; malformed-save rejection; exact format-13 round trips; and historical model/pixel baselines. An independent player-image reference removes all secret data before drawing and matches the hidden-secrets render exactly. Across focused runs, 39 Chromium cases pass, including Tower draft retention, resets, reopening, pins, shuffle history, player/GM PNGs, VTT sizes, export recovery, keyboard operation, responsive dialogs, and existing configuration/save/export/courtyard/contrast behavior. Typechecking, production build, formatting, and Markdown checks pass. Reviewed full sheets, desktop/mobile workbenches, disabled controls, and mobile/short export dialogs. The full browser suite, other browser engines, physical touch hardware, and live VTT imports were not checked for this feature.

**Connection follow-up — 29 October 2026:** Tower v2 randomizes the aligned stairwell, both portal endpoints, and which floor is secret. The entrance and selected source stay regular; all other floors, including the top floor, can be a portal source. Each regular floor has one physical spiral stairwell, with shared up/down route labels on intermediate floors. Stairs skip the secret floor. Connection art and caption rectangles stay inside the chamber and clear of furniture. Seed/count/source changes create the new layout; appearance and shuffle preserve it. Tower-v1 saved models, original two-stair artwork, and random streams remain intact, protected by a frozen fixture and six vector-pixel baselines and separate text-command hashes, keeping the checks independent of installed system fonts. Save format stays 13 because fields and object vocabulary are unchanged; the Tower generation version identifies the changed rules.

**Follow-up verification:** 100 focused unit/review checks and all six Tower Chromium cases pass. The new seed-variation and shared-stair tests failed against v1 before the changes. Coverage includes every floor count/density/source choice, independent reachability, paired-route grouping, safe caption bounds, top-floor sources, pending settings, reset/open synchronization, hidden/player images, native PNGs, export recovery, responsive/keyboard controls, and v1 save/shuffle/undo behavior. The original full pixel captures were first confirmed unchanged; portable vector/text baselines also pass with system-font loading disabled. Typechecking, production build, formatting, and explicit Markdown validation pass. Reviewed updated full sheets and desktop/mobile/disabled/export states. Full suites, other browser engines, physical touch hardware, and live VTT imports were not rerun for this follow-up.

**Staircase-choice follow-up — 29 October 2026:** Restored separate up/down flights as a selectable option alongside Shared spiral. Both styles use seeded positions and retain the optional portal and seed-selected secret floor. Staircase style is a configure-then-Generate choice with a pending summary, reset, independent draft retention, saved restoration, accepted-style filenames, and shuffle/undo consistency. Style changes create a new layout; density and shuffle retain it. New Tower generation v3 stores the explicit selection, and save format 14 freezes its two supported IDs. Older v1 and v2 models retain their original connections, metadata, random streams, and artwork, protected by frozen fixtures and ten portable vector baselines plus text-command hashes. The previous v2-only default is superseded by the user-facing choice; Shared spiral remains initially selected.

**Choice verification:** all 884 unit/review checks and 19 focused Chromium cases pass. The separate-stairs regression failed before implementation. Coverage includes both styles across floor counts, densities, and portal sources; deterministic reachable connections; caption/furniture clearance; draft/reset/type retention; pending saves/exports; native keyboard selection; saved-style restoration; shuffle undo; format-14 rejection/recovery; and ten frozen v1/v2 vector baselines with text-command hashes. Typechecking, production build, formatting, and explicit Markdown checks pass. Reviewed both styles and desktop/mobile/focus/disabled states. Full browser coverage, other engines, physical touch hardware, and live VTT imports were not rerun for this choice.

**Alchemist’s laboratory follow-up — 29 October 2026:** Recovered the interrupted implementation and completed the Tower addition. Choose the illustrated laboratory through Choose additions and assign any floor, including a secret floor. The fixed arrangement contains a cauldron, workbench, bookshelf, scrolls, and candles. Generate applies it as an appearance change; floors, connections, surface seed, and revision stay intact. Shuffle retains the laboratory while ordinary details vary. Layout-only placement protects links and captions; target-floor detail props are trimmed to preserve full movement, blocking budgets, and a clear 2 × 2 space. Other floors keep their exact props. Failed requests retain the accepted map and draft. Save format 15 freezes laboratory metadata and the cauldron kind, with old vocabularies and historical artwork retained; Tower generation remains v3 because no-laboratory streams and models are unchanged. Player exports hide secret-floor laboratories, including their filename marker, while JSON preserves them. Broader floor prop packs and editable laboratory arrangements remain future ideas.

**Laboratory verification and quality review — 29 October 2026:** All 925 unit/review tests across 68 files and 22 focused Chromium cases pass. Coverage includes placement and refusal, all-free-tile reachability, shared blocking budgets, preserved encounter space, exact unrelated-floor props, removal and undo, malformed-save rejection, old Tower compatibility, no-addition model hashes captured from the committed generator, and existing forest/dungeon pixel baselines. The review fixed a misleading density error when laboratory placement and density changes are refused together; a regression first demonstrated the failure, then verified the laboratory-specific message, unchanged accepted map, draft, pin and history, and successful retry. Placement coverage requires successful examples on every floor with both staircase styles, checks explicit refusals, and verifies fixed laboratory objects survive shuffling. Browser coverage includes appearance-only commits, illustrated selection, native floor controls, shuffle/undo, saved restoration, backup/import, hidden/GM PNGs and filenames, mobile keyboard/focus/disabled states, and export recovery. Typechecking, production build, formatting, and explicit Markdown validation pass. Inspected laboratory close-ups for both staircase styles and desktop/mobile/picker/disabled views; the native review also checks the cauldron’s tile bounds. The full browser suite, other browser engines, physical touch hardware, and live VTT imports were not rerun.

**F09 follow-up — Tower observatory, 30 October 2026:** Added a second illustrated Tower addition with a brass telescope, star-chart table, instrument cabinet, and scattered charts. The first three objects each block one square; charts are passable. Choose an Observatory floor, initially the highest floor not selected for the laboratory. Both additions can coexist on different floors, including a secret floor. Each floor selector disables the other addition’s choice, and engine/import validation independently rejects conflicts. Generate applies or removes the pack without rebuilding floors or changing surface texture/revision. Shuffle retains the instruments; other floors keep their exact objects. Existing movement, link/caption clearance, blocking budgets, and 2 × 2 encounter-space checks apply to both packs.

Shared pure placement and traversal helpers retain the laboratory’s frozen geometry and order. Pre-change model hashes (including shuffle and density changes), vector pixels, and text commands were captured before extraction and remain unchanged for both stair styles. New independent observatory artwork uses the shared Canvas renderer for maps, picker illustrations, thumbnails, and exports. Player images omit a secret-floor observatory and its filename/accessible-description marker. Whole-sheet and individual-floor exports use the accepted choice; JSON retains the full model. Save format 16 freezes the optional observatory floor and four new object kinds; formats 1–15 retain their vocabularies and old models acquire no addition until explicitly requested. Tower generation remains v3.

**Observatory verification:** All 974 unit/review tests across 73 files pass. Across focused runs, all 31 distinct Chromium cases pass, including the three new observatory cases, existing laboratory/Tower behavior, individual-floor exports, and library save recovery. Tests cover independent traversal and blocking budgets on both addition floors across styles/counts/densities/portals, exact unrelated-floor props and removal, fixed instruments on shuffle, conflicting/invalid requests, refused appearance commits and recovery without losing accepted state/pins/history, canonical save rejection, format-15 laboratory readability, and explicit old-Tower opt-in. Historical forest/dungeon/Tower baselines and the new independent pre-observatory laboratory model/vector/text baselines pass unchanged. Native review checks complete sprite bounds and writes both stair-style sheets/close-ups. Inspected those images plus desktop, 320 px mobile picker/focus, and disabled workbenches. Browser cases verify pending versus accepted maps, PNGs, backup/import and saved restoration, undo, distinct defaults, disabled conflicting options, secret-floor whole/single-floor exports and filenames/descriptions, floor-count reduction/reset, keyboard use, and export failure/retry. Two mobile image checks initially used an incorrectly scoped card selector; corrected selectors pass for both additions. Typechecking, production build, formatting, and explicit Markdown validation pass. The full browser suite, other browser engines, physical touch hardware, and live VTT imports were not run for this slice.

**F09 follow-up — Courtyard Collapsed wagon, 2 November 2026:** Courtyard now has two independent illustrated additions: Dry fountain and Collapsed wagon. The new scene contains a broken wooden wagon occupying six blocking squares (3 × 2 or 2 × 3), one blocking spilled crate, a passable detached wheel, and loose passable goods. Its seeded horizontal/vertical site stays outside walls, protected approaches, the 6 × 6 gathering area, and fountain circulation, with one clear tile around the wagon body. Both additions can coexist. Applying/removing the wagon preserves the accepted layout, surface seed, and detail revision; Shuffle retains the fixed wagon scene while ordinary details vary.

The existing decoration stream runs unchanged before the optional wagon is overlaid. A separate versioned stream selects its site, reserving the fountain area even when the fountain is off. Ordinary props in the scene reserve are removed, and ordinary blocking columns may be removed when needed for full movement access. Refused placement retains accepted maps, drafts, pins, and history for recovery. Removing the wagon restores the exact no-wagon decoration at the accepted settings/revision. Native pre-change model and pixel hashes across seeds, densities, fountain choices, and shuffled snapshots remain independent compatibility baselines.

Save format 17 freezes the optional true-only wagon marker, four object kinds, and the wagon's footprint/orientations. Formats 1–16 retain their original vocabularies and reject the new data; older courtyard models keep absent metadata and original artwork until explicitly changed. Generator 4.0.0 stays unchanged. Canonical validation rejects missing, duplicate, moved, oversized, misclassified, or cross-map components and checks circulation, footprint occupancy, budgets, and full-map connectivity. PNG filenames, preview descriptions, map/library summaries, saved restoration, and backup/import reflect the accepted wagon choice. The map feature inventory now records Courtyard's expanded catalog.

**Wagon verification:** All 1,017 unit/review tests across 77 files pass. Across focused runs, all 31 distinct Chromium cases pass, including four new wagon cases and existing courtyard, save, and VTT preset workflows. Coverage includes seeded horizontal/vertical placement across densities and fountain choices; independent expanded-footprint traversal; clear approaches, gathering space, and wagon/fountain circulation; blocking budgets; immutable inputs; fixed scene objects through shuffle; exact removal; refused placement and retry without losing maps/drafts/pins/history; malformed or cross-map save rejection; and exact no-wagon model/pixel baselines captured before implementation. Browser checks verify pending versus accepted maps and PNGs, fountain coexistence, undo, backup/import, old-format courtyard artwork, VTT sizes, keyboard operation, 320 px mobile and short landscape layouts, disabled controls, and export failure/recovery. Browser testing caught a missing wagon filename marker; a focused regression reproduced the failure before the fix, and ordinary filenames remain unchanged. Typechecking, production build, formatting, explicit Markdown validation, and local documentation links pass. Inspected full maps and close-ups for both orientations and fountain choices, desktop/mobile workbenches, keyboard-focused pickers, and disabled states in `artifacts/wagon/`. The first full unit process was terminated before results; its logged retry completed successfully. The full browser suite, other browser engines, physical touch hardware, and live VTT imports were not run for this slice.

**F09 follow-up — Forest Fallen ancient tree, 2 November 2026:** Forest now has three independent illustrated additions. Fallen ancient tree adds a four-square blocking trunk (4 × 1 or 1 × 4), a one-square blocking root mass, a passable splintered branch, and passable mushrooms. Original Canvas artwork uses Verdant, Autumn, Pines, and Fey palettes for bark, foliage, and fungi. The whole scene stays on clear ground near the carved route without overlapping it or the existing camp/circle reserves. Camp and standing-stone objects remain exact; all three additions can coexist when space and the shared blocking budget allow. Appearance changes preserve layout, route, endpoints, surface seed, and detail revision. Shuffle retains the choice and may relocate the scene, matching the other Forest additions.

The original decoration/camp/landmark streams run unchanged before the optional tree overlay. A separate versioned stream uses the accepted seed/density/revision and existing reservations. Ordinary props in the scene reserve, or blocking props exceeding the budget or obstructing movement, may be removed; existing additions are never removed to fit the tree. Forest validation expands the entire rotated trunk footprint, and surface marks avoid every occupied square. Failed requests preserve accepted maps, editable drafts, pins, and history for correction/retry. Removal recreates ordinary decoration at the accepted settings/revision; historical maps adopt current surface details only after an explicit appearance action or shuffle under the existing rule.

Save format 18 freezes the optional true-only fallen-tree marker, four new Forest object kinds, and the trunk footprint/orientations. Formats 1–17 retain their vocabularies and reject the new data. Old maps acquire neither the marker nor new artwork during opening, normalization, saving, or export. Canonical import checks reject missing, duplicate, moved, oversized, misclassified, and cross-map tree data. Generator 4.0.0 remains unchanged: independent model/shuffle and pixel hashes captured before implementation cover all four characters with/without camp and circle, and historical fixtures stay untouched. PNG filenames, map/library summaries, preview descriptions, saved controls, and backup/import reflect the accepted choice. The feature inventory now records Forest's three additions.

**Fallen-tree verification:** All 1,066 unit/review cases across 82 files pass across the full run and focused follow-up. The first full run passed 1,062 cases but timed out in the new combined 192-case placement matrix; splitting that matrix by character preserved its coverage, and all five tests in the affected file then passed. The 29 focused Chromium cases pass, covering the new addition, camp/circle coexistence, surface details, and saves. Checks cover whole-footprint movement and blocking budgets, deterministic horizontal/vertical placements, all characters/densities and addition combinations, immutable inputs, exact removal, shuffle/undo, pending versus accepted PNGs/saves, old-format import, backup/reopen, malformed and cross-map save rejection, failure/retry, and independent historical model/pixel baselines. A malformed direct appearance setting reproduced a failure before a guard was added; the regression now confirms unchanged accepted state. Test typechecking, production build, formatting, explicit Markdown checks, and local documentation links pass. Reviewed all four character close-ups and desktop, 320 px mobile, short landscape, keyboard-focus, and disabled states in `artifacts/fallen-tree/`; native sprite bounds pass for all renderer rotations. The full browser suite, other browser engines, physical touch hardware, and live VTT imports were not run for this slice.

## Later milestones worth preserving

| ID  | Candidate                          | Useful direction                                                                                             | Why it should follow the smaller features                                                                                                                                 |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F24 | Limited prop editing               | Select, move, rotate, or remove an object while retaining the generated layout.                              | Develops I29. Requires footprints, selection, undo/redo, validation feedback, and a saved edit format. Start with one object action rather than a full editor.            |
| F25 | Connected location sets            | A ruin entrance, underground chambers, and an outdoor camp share a visual identity and explicit connections. | Develops I33. Requires a versioned collection model and matching exits; separately generated maps should not be presented as seamlessly connected.                        |
| F26 | Map dimensions and terrain options | Compact encounters, long roads, or larger spaces with controllable open areas.                               | Develops I15, I16, and I32. Changes fixed-size assumptions throughout generation, validation, rendering, and exports. A single larger PNG resolution is not a larger map. |

F24 now has a dedicated [map object editor feasibility and delivery plan](MAP_OBJECT_EDITOR_PLAN.md).
Dungeon editing now supports seven independent object kinds with movement,
catalog placement, removal, authored saves and history. All four Dungeon additions
support rigid translation and quarter-turn rotation. Objects can move beside walls,
onto open passage floor, over rugs/moss and onto empty addition floor, with physical
components and usable approaches protected. Overlapping surfaces and loose objects
move independently. Other map types, independent object rotation, arbitrary
multi-square editing and whole-addition insertion/removal remain later milestones;
F24 as a whole is not complete. See the plan's delivery record for verification.

**F24 first Dungeon release verification — 2 November 2026:** All 1,127 distinct
unit/review cases across 87 files pass across the full run and focused follow-up;
57 distinct focused Chromium cases pass, with editor workflows rerun after final
accessibility/view-boundary changes. Build, test typechecking, application and
explicit Markdown formatting, local links, and whitespace checks pass. Historical
fixtures/baselines remain unchanged. Reviewed desktop/mobile/short-screen,
keyboard-focus and disabled UI. The delivery record documents the reproduced
inspector save/reopen regression and its fix, conservative placement/removal,
ID-counter test correction, exact persistence/export checks, and coverage limits.
Other browser engines, physical touch hardware, the full browser suite and live
VTT imports were not verified for this slice.

Touch exploration (I22) also remains useful, but pinch behavior needs testing on
touch hardware. A full editor (I30), fog of war, dynamic lighting, combat tracking,
cloud accounts, and collaboration are separate product decisions. They are not
prerequisites for a better encounter-map generator.

## A practical release sequence

1. **Enrich the existing maps:** ship one scene prop pack, undo shuffle, and basic
   library search. These can be independent changes with visible benefits.
2. **Add one convincing new location:** build and visually review the ruin courtyard
   showcase, then its generator, settings, persistence, and export behavior. Ship a
   complete type before starting caverns or interiors.
3. **Improve table preparation:** add a focused export panel, private saved notes,
   and exact single-map sharing. Add mobile preview access alongside these workflows.
4. **Give users selective control:** evaluate comparison, focal landmarks, and
   limited prop editing based on what feels restrictive in the preceding releases.

Each selected feature should have a small, observable acceptance condition. Preserve
determinism, accepted-setting saves/exports, historical artwork, recovery, and open
space for play. New terrain, object vocabularies, footprints, or saved metadata need
an explicit format/migration decision. Extra palettes and surface marks should not
silently change what existing saves look like.

The next step is to select one feature, not to reopen completed technical reviews
or implement every proposal in this document.

**Dungeon door interaction — 3 November 2026:** Explore now toggles doorway artwork
between open and closed with click/tap, with hover feedback and compact keyboard
controls. Door states are separate from object customizations, share accepted-map
history, and persist through saves, backups, thumbnails and PNGs. Shuffles and
appearance changes retain them; new layouts start closed. Closing a door does not
rewrite floor topology. Editing, pinned and busy guards prevent accidental
changes. Save format 23 adds bounded version-1 door state; older saved models and
closed-door artwork remain unchanged. See the door delivery record in the
[editor plan](MAP_OBJECT_EDITOR_PLAN.md) for verification and scope.
