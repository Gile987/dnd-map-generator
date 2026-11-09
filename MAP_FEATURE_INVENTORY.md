# Map feature inventory

Reviewed against the application source on **9 November 2026**. Dungeon door states updated **3 November 2026**. Forest and Tower editing updated **5 November 2026**.

This document records what each map type currently offers so we can identify
underdeveloped areas before choosing another feature. Use
[FEATURE_IDEAS_NEXT.md](FEATURE_IDEAS_NEXT.md) for proposals and implementation
history, and [README.md](README.md) for detailed usage and compatibility rules.

## At a glance

| Map type  | Visual characters                  | Selectable additions                                                | Layout controls beyond the seed                                 | Map size                                                     |
| --------- | ---------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| Dungeon   | **4 selectable**                   | **4:** Forgotten study, Weathered statue, Dining table, Ritual site | 4–8 rooms                                                       | 40 × 30 squares                                              |
| Forest    | **4 selectable**                   | **3:** Abandoned camp, Standing-stone circle, Fallen ancient tree   | No separate layout controls                                     | 40 × 30 squares                                              |
| Courtyard | **4 selectable**                   | **2:** Dry fountain, Collapsed wagon                                | No separate layout controls                                     | 40 × 30 squares                                              |
| Tower     | **1 fixed:** Ruined wizard’s tower | **2:** Alchemist’s laboratory, Tower observatory                    | 3–8 floors, two staircase styles, optional secret portal source | Variable sheet; individual floor exports are 16 × 18 squares |

Manual object editing is available for all four map types; it is separate from the addition counts.

Counts refer to named choices available in the UI. Turning an addition off does
not count as another addition. Fixed looks are not character-picker options.
Automatically generated props, surface marks, and floor-purpose labels are listed
separately below. A larger number of settings does not by itself mean a map is
better; useful variety and playable results matter more than matching counts.

## Dungeon

### Settings and characters

- World seed and Randomize seed.
- Room count: **4–8** connected chambers.
- Decoration density: **Sparse, Balanced, Cluttered**.
- Illustrated character picker: **Mosslit stone, Ancient crypt, Abandoned
  storehouse, Overgrown sanctuary**.

### Additions: 4

| Addition         | What it adds                                                               | Placement and movement                                                               |
| ---------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Forgotten study  | Writing desk with stool, bookshelf, scroll cases, and rug                  | Occupies a suitable room; protects doors, access, and encounter space                |
| Weathered statue | Stone figure on a plinth                                                   | One blocking square within a protected 5 × 5 area                                    |
| Dining table     | Wooden table                                                               | Blocks 2 × 1 squares, or 1 × 2 when rotated; retains circulation space on every side |
| Ritual site      | Stone altar, two candle clusters, offering bowls, and faded floor markings | Protected 5 × 5 area; only the one-square altar blocks movement                      |

The additions can be selected together, subject to placement constraints. The
ritual site stays out of entrance, objective, study, and statue areas and respects
dining-table circulation. If a requested combination cannot fit, the accepted map
and editable draft remain available for correction.

### Automatic content

- Connected rooms and corridors, entrance and objective markers.
- Character-dependent props and accents, such as crates, barrels, rubble,
  sconces, sarcophagi, broken columns, moss, and vines. These are examples of the
  supported vocabulary. The object editor individually exposes the seven independent kinds listed below; attached items remain protected and addition components move together.
- Forgotten-study floor details: loose papers, ink spills, and doorway wear.
- Ritual floor markings accompany the Ritual site addition.

### Object editor

Dungeon is the first editable map type. **Edit objects** supports moving, adding,
and removing **crates, barrels, rubble, sarcophagi, broken columns, moss, and rugs**.
Choose an instance from Objects on this map or use the searchable illustrated
Add object catalog. Pointer drag, click/tap placement, coordinates, keyboard and
directional controls share grid-snapped validation. History, pins, save/open,
JSON backup/sharing, thumbnails, and PNGs preserve the accepted arrangement.
Reset customizations restores the generated objects and retains independent door states. Generate explicitly replaces
customizations and remains undoable; Shuffle is unavailable while customized.

Forgotten study, Weathered statue, Dining table, and Ritual site can each be
selected, moved and rotated by quarter turns as one complete addition, retaining
component identity and original artwork choices. Rotation stages a preview with
the top-left Column/Row anchor fixed; Place object commits it after validation.
Independent components and attached sconces/vines remain protected.
Objects may move beside walls and onto open passage floor; real architectural
clearance, physical object collisions and full access remain protected. Rugs
occupy a passable 3 × 3 surface area; rugs and moss can sit beneath objects. Empty
addition floor, including ritual markings, accepts objects while physical
components stay separate and solid addition objects retain an approach. Surfaces
and additions move independently of overlapping loose objects. Whole-addition
insertion/removal and independent object rotation remain future work. Walls,
routes and architectural connections are outside the editor. All four map types now offer object editing under their own geometry and visibility rules. See [the editor delivery plan](MAP_OBJECT_EDITOR_PLAN.md).

### Drawing order and covered objects

Dungeon objects and whole additions support Bring forward / Send backward across
other overlapping objects. Rugs can cover physical objects while those objects
retain their movement blocking. Internal addition order stays fixed; the complete
arrangement remains undoable and survives saves, pins, thumbnails and PNGs.
Workbench badges name underlying objects in Explore and Edit objects, with a
selectable top-to-bottom list and outlines for underlying objects. Nearby badges
avoid one another; a compact Layers list also covers crowded or offscreen
overlaps. Repeated kinds are counted together; larger stacks use “+ N more” with
full names in tooltips and the Layers list. Counts exclude internal overlaps within one addition and include partial artwork-area overlaps.
Export options offers Show layer indicators, off whenever opened, with an exact
prepared preview. Quick exports and thumbnails omit annotations; JSON always
contains every object and the accepted order. These controls support all four map types; Tower player views omit hidden-floor overlaps.

### Door interaction

Explore supports click/tap to open or close Dungeon doors, with hover highlighting
and a compact keyboard-accessible Doors selector below the preview. Dragging pans;
object-editing mode, Pinned and busy states cannot toggle doors. Door changes join
Undo/Redo and survive saved reopen, backups and PNG exports. Decoration shuffles
and appearance changes retain them; new layouts start closed and remain undoable
when replacing an open-door map. Closed doors remain openable connections without
changing floor topology or object placement. PNGs contain static door artwork.

### Current gaps

Dungeon has the broadest addition catalog. It can still gain more furniture or
room themes, but addition variety is less limited here than in the other types.
There is no general room-purpose picker or manual prop editor.

## Forest

### Settings and characters

- World seed and Randomize seed.
- Decoration density: **Sparse, Balanced, Cluttered**.
- Illustrated character picker: **Verdant woodland, Autumn grove, Ancient pines,
  Fey glade**.
- The clearing and its path are generated from the seed. There are no controls
  for clearing size, path width, or path endpoints.

### Additions: 3

| Addition              | What it adds                                                               | Placement and movement                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abandoned camp        | Two tents, two bedrolls, cold fire ring, and supplies                      | Beside the path, outside the protected route; shares the blocking budget                                                                           |
| Standing-stone circle | Six standing stones around an open center                                  | Protected 7 × 7 area with a clear 3 × 3 center; each stone blocks one square                                                                       |
| Fallen ancient tree   | Large broken trunk, exposed roots, splintered branch, and mushroom cluster | Trunk blocks 4 × 1 squares (1 × 4 when rotated), roots block one; branch and fungi are passable; stays off the path and existing addition reserves |

All three additions work with all four characters and can coexist when they fit
within the shared blocking budget. The fallen tree artwork matches the selected
character; Shuffle may move its scene while retaining the selection.

### Automatic content

- A clearing with a connected path between two map edges.
- Character-dependent trees, vegetation, and atmosphere; supported objects include
  boulders, ferns, mushrooms, bushes, logs, stumps, and flowers.
- Surface storytelling: leaves for Verdant and Autumn, needles for Pines, pale
  petals for Fey, and ash near camp hearths. These marks are passable and do not
  require separate controls.

### Object editing

The shared Explore/Edit objects workspace supports independent boulders, logs,
stumps, bushes, ferns, mushrooms and flowers. Trees form the fixed boundary.
Abandoned camp, Standing-stone circle and Fallen ancient tree move and quarter-turn
as complete groups with their original artwork; camp ash follows its hearth and
facing. Addition components cannot be dismantled or inserted independently.

Bushes, ferns, mushrooms, flowers and fallen-tree fungi are ground cover. They can
share tiles with objects or different kinds of cover, and can grow outside the
clearing. Duplicate cover of the same kind cannot overlap. Physical objects need
walkable ground and cannot overlap one another. Both map-edge path entrances stay
open and connected, all free ground stays reachable and the accepted density
budget applies. The generator's reserved route tiles and empty encounter/addition
areas do not restrict manual editing. Genuine collisions name the objects and
grid position.

Layers and named covered-object inspection, Undo/Redo, read-only pins, accepted
saves, backups, JSON and optional annotated PNGs share the existing editor.
Customized maps require Reset customizations or an explicit, undoable Generate
replacement before shuffling. Catalog/ghost artwork follows the accepted Forest
character; draft changes remain separate.

### Current gaps

Fallen ancient tree expanded Forest to three additions on 2 November 2026, keeping
its catalog larger than Courtyard’s now that both offer four characters.
Further terrain or path controls remain a separate, larger area of work.

## Courtyard

### Settings and characters

- World seed and Randomize seed.
- Decoration density: **Sparse, Balanced, Cluttered**.
- Illustrated character picker: **Overgrown ruin, Sunbleached ruin, Frostbound
  ruin, Desecrated ruin**.
- Walls, breaches, approaches, and gathering space are generated from the seed.
  There are no controls for enclosure dimensions or opening placement; ruin
  condition expresses itself through the character and decoration draws.

### Additions: 2

| Addition        | What it adds                                                        | Placement and movement                                                                                                                   |
| --------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Dry fountain    | Empty stone basin                                                   | Blocks 3 × 3 squares with one clear tile on every side; placed beside the gathering space                                                |
| Collapsed wagon | Broken wooden wagon, detached wheel, spilled crate, and loose goods | Wagon blocks 3 × 2 squares (2 × 3 when rotated), crate blocks one; wheel and goods are passable; clear circulation around the wagon body |

Both additions are independent choices through Choose additions and can coexist.
The wagon stays outside protected approaches, gathering space, and fountain
circulation; its fixed scene stays in place while ordinary details shuffle.

### Automatic content

- Broken perimeter walls, four three-square-wide approaches, extra breaches, and
  detached wall remnants.
- Protected 6 × 6 gathering space.
- Columns, low rubble, vegetation, weathered paving, and cracks.
- Standing walls and columns block movement; flat rubble and surface details are
  passable. Grass outside and paving inside are walkable.
- Character-dependent accent mixes and atmosphere palettes: moss, ferns and
  weathered paving for Overgrown; stony rubble with sandy grass for Sunbleached;
  fern and rubble over frosted stone for Frostbound; creeping dead vines over
  ashen ground for Desecrated.

### Object editing

Explore/Edit objects shares the Dungeon workspace. Move, add and remove broken
columns, low rubble, moss and ferns on open grass or paving. Vines remain fixed.
Move the complete fountain without rotation; move and quarter-turn the complete
wagon, retaining its crate, wheel and goods. Actual object footprints must fit
inside the map, avoid standing walls and physical collisions, and preserve
movement access and density budgets. The generator's gathering space, broad
approach lanes and empty addition margins do not restrict manual placement.
Moss, low rubble, ferns and vines are ground cover and can share ground with
objects. Wheels and loose goods remain physical despite being passable. Genuine
collision errors identify the objects and the overlapping grid position.
Shared drawing order and named hidden-object indicators, Undo/Redo, pins,
accepted saves, JSON and PNGs retain the arrangement. Shuffle is unavailable while
customized; replacing customizations with Generate is explicit and recoverable
through Undo. Whole-addition insertion/removal is not available.

### Current gaps

Collapsed wagon expanded the catalog from one to two additions on 2 November 2026, and
four selectable characters arrived on 9 November 2026. Courtyard now matches Tower
in addition count and Dungeon/Forest in character count. A further distinct
encounter feature — such as terrain or wall controls — would still enrich it.

## Tower

### Settings and character

- World seed and Randomize seed.
- Floor count: **3–8**, arranged on one sheet with numbered headings.
- Staircase style: **Separate stairs** or **Shared spiral**, with seeded positions
  and matching route letters/destination numbers.
- Secret portal: **None** or a chosen source floor. At most one portal pair leads
  to one seed-selected secret floor. The destination counts toward the total,
  excludes the entrance and source, and has no staircase access.
- Decoration density: **Sparse, Balanced, Cluttered**.
- One fixed visual character: **Ruined wizard’s tower**. There is no character
  picker or general per-floor purpose picker.

### Additions: 2

| Addition               | What it adds                                                                | Placement and movement                                                                     |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Alchemist’s laboratory | Cauldron, workbench, bookshelf, scrolls, and candles                        | Assign one floor; cauldron, desk, and bookshelf each block one square                      |
| Tower observatory      | Brass telescope, star-chart table, instrument cabinet, and scattered charts | Assign one floor; telescope, table, and cabinet each block one square; charts are passable |

Both packs can coexist on **different floors**, including a secret floor. Each
selector disables the other pack’s chosen floor. There is one instance of each
pack per tower. Both preserve movement, connection/caption clearance, blocking
budgets, and a clear 2 × 2 encounter space.

The laboratory initially selects floor 2 unless the observatory already occupies
it. The observatory initially selects the highest floor not chosen for the
laboratory. Both fixed arrangements stay in place when ordinary details shuffle.

### Automatic content and special tools

- Circular stone chambers, masonry, compass-rose floor artwork, and ordinary
  purpose-dependent furnishings.
- Floor-purpose labels, such as Library or Archive, are automatic. They are not
  extra selectable prop packs.
- **Show secrets** switches between player and GM artwork. Player PNGs omit the
  secret chamber and portal markers, including any additions on the hidden floor.
- Export options offers **Whole tower** or a numbered floor. Individual exports
  retain headings, connection labels, and grid scale. Secret floors require Show
  secrets. Quick export continues to export the whole sheet.
- Library thumbnails hide secrets. JSON saves and backups retain the complete
  tower, including secret information.

### Object editing

The shared editor exposes ten ordinary kinds: crates, barrels, bookshelves, desks,
scroll cases, altars, candles, offerings, bedrolls and moss. Laboratory and
observatory components move and quarter-turn together; ordinary props of the same
kind remain independent. Components cannot be dismantled or inserted separately.

Choose Editing floor for the object list and new objects. Focus floor frames that
chamber; Fit restores the sheet. A blue outline marks the current floor and the
inspector uses sheet coordinates. Existing objects stay on their own floor. Actual
walls, portals and connection labels stay clear, with connected free
ground and a separate blocking budget per floor. Empty generation-time encounter
reserves do not restrict manual placement. Moss/bedroll surfaces can overlap
objects and one another; same-kind surfaces cannot overlap.

Both staircase styles can move on their original floor, using direct dragging or
object-list selection and coordinates. Shared up/down routes move as one landing;
route letters, arrows and destination captions follow. Other floors retain their
own landing positions. Stairs cannot be removed, re-routed or rotated. Their full
artwork and captions must fit inside the walls, clear of objects and connections.
Vacated landing space becomes usable. Saves, PNGs and Undo/Redo retain moves.

Portal towers require Show secrets for editing so every connection is
visible. Turning it off cancels placement and removes hidden-floor selections,
groups and layer information. Player PNGs/thumbnails omit those objects and their
annotations; GM views and complete JSON retain them. Shared Undo/Redo, pins,
accepted saves, backups, layers and individual-floor exports retain edits.

### Current gaps

Tower has the richest structural controls but only two selectable prop packs and
one visual character. More floor themes remain possible, but the recent Tower
additions make Forest and Courtyard stronger candidates for further content work.

## Shared tools available to all four types

| Area                 | Current support                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuration        | Configure then Generate, pending-change summary, Reset changes, retained accepted map and draft per type                                     |
| Additions UI         | Searchable illustrated Choose additions picker, independent selections, selected-item removal buttons                                        |
| Exploration          | Shuffle details, up to 20 successful shuffles in Undo/Redo history per type, Pin and compare                                                 |
| Preview              | Grid toggle, pan, zoom, Fit, keyboard controls, Focus map, mobile Settings / Map / Library shortcuts                                         |
| Library              | Named saves, thumbnails, reopen, rename, duplicate, favorite, delete/undo deletion, search, type/favorite filters, sorting                   |
| Sharing and recovery | Whole-library JSON backup/import and single-saved-map JSON export                                                                            |
| PNG export           | Quick export, prepared preview/download, Standard PNG, Owlbear Rodeo, Roll20, and Foundry VTT presets, independent grid and opacity controls |

Shared tools should not be counted as exclusive advantages of one map type.
Saves and exports use the displayed accepted map, including a pinned candidate,
rather than unapplied settings. Older saved maps may retain earlier artwork;
this inventory describes the current feature catalog.

## Where to focus next

This is a planning assessment based on the inventory, not a commitment to build
every missing option.

| Priority | Area                          | Reason                                                                                                                        |
| -------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1        | Further Courtyard additions  | Four characters are now available; its two additions remain a small catalog compared with Forest’s three and Dungeon’s four    |
| 2        | Further Forest content        | Three additions now provide distinct encounter content; choose further additions or terrain controls for their actual benefit |
| 3        | Further Dungeon/Tower content | Dungeon already leads on additions, and Tower has two packs, structural choices, and individual-floor export                 |
| 4        | Courtyard terrain controls    | Enclosure dimensions and opening placement remain seed-fixed for all characters                                              |

Counts are a starting point, not a quality score. Choose a feature for its gameplay
and visual benefit, then check placement, readability, and compatibility. Adding a
new map type can remain in the backlog while existing catalogs become richer.

## Keeping this inventory accurate

After a feature changes the available choices, update its map section, the
comparison/counts, and the planning assessment. Keep proposals in
[FEATURE_IDEAS_NEXT.md](FEATURE_IDEAS_NEXT.md) until implemented. Do not count
internal object kinds or automatic decoration as user-selectable additions.

Source references for checking the inventory:

- [Settings panel and addition catalog](src/app/workbench/settings-panel/settings-panel.ts)
  and [settings controls](src/app/workbench/settings-panel/settings-panel.html).
- [Character options](src/app/workbench/character-picker/character-options.ts),
  [display names](src/app/workbench/presentation.ts), and
  [landmark catalog](src/app/engine/landmark-catalog.ts).
- [Map settings and prop vocabulary](src/app/engine/model.ts),
  [Tower settings and floor purposes](src/app/engine/tower.ts), and
  [Courtyard generation](src/app/engine/courtyard-generate.ts).
- [Export presets](src/app/rendering/export-presets.ts) and
  [workbench documentation](README.md).
