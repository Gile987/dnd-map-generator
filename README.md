# Encounter Map Forge

A browser-only Angular workbench for making dungeon, forest-clearing, ruined-courtyard, and multi-floor tower battle maps with distinct character. It opens with a complete map. Generate connected dungeon rooms, a woodland clearing with a path between two edges, an open stone ruin with broken walls, or connected tower floors; shuffle decoration while preserving the layout; then export a full-resolution PNG.

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

- **Map type:** choose Dungeon, Forest, Courtyard, or Tower. Each type retains its own map — switching restores the last map you generated for that type (with its current density, revision, and character). Each type also retains its own pending settings when you switch away and back.
- **Configure, then generate:** seed, rooms, character, additions, and decoration are pending settings. The displayed map stays unchanged until you choose **Generate dungeon**, **Generate forest**, **Generate courtyard**, or **Generate tower**. The **Pending changes** summary and **Reset changes** action identify pending edits. Generate is disabled when settings match the displayed map. When Generate is clicked, pending seed or room changes create a new layout at detail revision 0; pending appearance-only changes preserve the layout, surface texture, and revision.
- **Pending changes:** the settings panel compares accepted and draft values for the seed, room count, character, additions, and decoration, showing only fields that changed. It explains whether Generate creates a new layout or updates appearance while keeping the layout; invalid drafts ask for correction instead. Seed whitespace and equivalent valid room counts do not create false differences. Save and Export continue to use the displayed map. The summary updates independently for each map type and disappears after applying, resetting, correcting back to accepted values, or opening a save. Generate includes the impact as its accessible description; existing field validation and error associations remain in place.
- **Focus map:** expands the existing map preview into a screen-sized workspace with Grid, pan/zoom, Fit, Quick export PNG, and Export options. Settings and the library are hidden while their drafts, unfinished inputs, and filters remain in memory. **Back to workbench** or Escape returns to the previous workbench scroll position and focuses Focus map. An open export dialog handles Escape first; a second Escape returns to the workbench. Switching views retains the same canvas, zoom, pan, map, and accepted export settings. Back remains available during PNG preparation and after errors. Focus view needs no browser fullscreen permission; short screens can scroll to reach controls, and refreshing starts in the normal workbench.
- **World seed:** a trimmed string of 1–64 characters. The same generated settings and generator version reproduce the same map. Editing the seed changes only the draft.
- **Rooms:** (dungeon only) choose an integer from 4–8. The map always contains 40 columns × 30 rows. The stepper normalizes the draft first — blank or non-numeric becomes 6, a fraction rounds down — then clamps to 4–8, so its buttons always agree with the value they set.
- **Randomize seed:** fills the draft with a new seed using browser cryptographic randomness. Choose Generate to apply it; randomizing alone never changes the map.
- **Decoration:** Sparse, Balanced and Cluttered apply when you choose Generate, with conservative blocking-prop budgets of 5%, 10% and 15% of room floor area (dungeon) or walkable area (forest and courtyard). The engine may place fewer props to protect access.
- **Character:** **Choose character** opens an illustrated picker for Dungeon, Forest, or Courtyard. The sidebar shows the selected character’s artwork and name, with a Pending badge when it differs from Current. Cards show fixed examples rendered by the app, with names, descriptions, and native radio buttons. Choose a look, then Done, Close, or Escape to return; all three retain the draft and restore focus to the opener. Arrow keys select within the radio group, and focused cards scroll into view. Generate applies the choice. The catalog scrolls while its heading and Done action remain available on mobile and short screens. Mosslit stone, Ancient crypt, Abandoned storehouse and Overgrown sanctuary give dungeons their identity; Verdant woodland, Autumn grove, Ancient pines and Fey glade do the same for forests. Overgrown ruin, Sunbleached ruin, Frostbound ruin and Desecrated ruin do the same for courtyards. A character change applies when you choose Generate and preserves the layout, carved route, path endpoints, court walls and approaches, surface texture, and detail revision. Each preset uses its own deterministic decoration stream, its own prop mix, and — for forests — its own trees, ground cover, and atmosphere, and — for courtyards — its own ground, masonry, and vegetation palettes.
- **Add to this map:** **Choose additions** opens a searchable visual catalog for the active map type. Cards show the app’s actual object artwork, a description, and a checkbox. Choose any combination; Done, Close, or Escape keeps the selections pending. Selected additions appear in the settings panel with removal buttons; Generate applies additions and removals together. Search filters names and descriptions without clearing selections, and reopening shows the whole catalog. The catalog scrolls within the picker while its search and Done action stay visible, including on small screens. Each map type retains its own selections and pending edits. Applying or removing additions preserves the layout, surface texture, and detail revision; Shuffle keeps the accepted choices and may move their objects. If a combination cannot fit, the accepted map and pending draft remain available for correction.
- **Forgotten study** (Dungeon): a writing desk with a tucked-in stool, a bookshelf, scroll cases, and a rug in one suitable room. Newly generated studies also have a few loose papers, a small ink spill, and faint doorway wear on exposed floor; these marks never block movement or change the layout. Older saved studies retain their original artwork when opened, saved, or exported. Generating appearance changes or shuffling a study adopts the new details; Undo shuffle restores its exact previous artwork. Doors, architectural landmarks, per-room blocking budgets, and clear 2 × 2 spaces remain protected.
- **Ritual site** (Dungeon): a carved stone altar, two clusters of lit candles, offering bowls, and faded floor markings in a protected 5 × 5 area. Only the altar blocks movement, occupying one tile; the center, markings, candles, and offerings are passable. The site stays outside the entrance, objective, study rooms, statue reserves, and dining-table circulation. Select it independently through Choose additions; it can accompany the other dungeon additions when space allows. Applying or removing it preserves the layout, floor texture, and detail revision. If it cannot fit, the accepted map and draft remain available for correction.
- **Weathered statue** (Dungeon): a stone figure on a plinth occupies one blocking tile in a clear 5 × 5 area. It stays out of the entrance, objective, and study rooms and protects door clearance, connectivity, per-room budgets, and clear 2 × 2 encounter space.
- **Dining table** (Dungeon): a wooden table occupies and blocks two tiles (2 × 1, or 1 × 2 when rotated), with one clear tile of circulation on every side. Placement protects doors, architectural landmarks, study rooms, and statue reserves. Both occupied tiles count toward the room's density budget.
- **Abandoned camp** (Forest): two small tents, two bedrolls, an unlit fire ring, and a supply bundle beside the path. The arrangement stays outside the route and shares the forest blocking budget.
- **Forest floor details:** new forests automatically include muted leaf drifts for Verdant, warm fallen leaves for Autumn, pine-needle clusters for Pines, and pale petals for Fey. Small ash spills accompany abandoned camp hearths. The marks are flat and non-blocking, stay off the carved path and standing-stone encounter area, and draw beneath objects and grid lines. Older saved forests retain their original artwork through opening, saving, sharing, and export. Generate appearance changes or Shuffle to adopt the new details; Undo restores the original snapshot exactly. No additional controls are needed.
- **Standing-stone circle** (Forest): six standing stones reserve a clear 7 × 7 area with a 3 × 3 center for an encounter. Each stone blocks one tile; gaps and the path stay open. It works with every forest character and can accompany a camp when both fit.
- **Fallen ancient tree** (Forest): choose it independently through **Choose additions**. A substantial fallen trunk blocks four squares (**4 × 1**, or **1 × 4** when rotated), and an exposed root mass blocks one more. The splintered branch and mushroom cluster are passable. Bark, foliage, and fungi match Verdant, Autumn, Pines, or Fey. The scene stays off the entire carved path and outside camp and standing-stone reserves; all three additions can coexist when space and the shared blocking budget allow. Generate applies/removes the tree without rebuilding the accepted layout or changing its surface seed/revision. Shuffle retains the choice and may relocate the scene, like the other Forest additions. Refused requests preserve accepted maps and pending settings.
- **Ruined courtyard:** an overgrown stone enclosure with four three-tile-wide openings, additional breaches, detached wall remnants, scattered columns, and a clear 6 × 6 gathering space. Grass outside and paving inside are walkable. Standing walls and columns block movement; flat rubble, cracks, and vegetation are decorative. Four visual characters — Overgrown (the default look), Sunbleached, Frostbound and Desecrated — reweight the accent mix and change the atmosphere palettes while keeping the same walls, approaches, and gathering space. **Dry fountain** is available through Choose additions: a 3 × 3 blocking basin with one clear tile on every side, placed beside the gathering space. Applying it preserves the walls, approaches, paving, and revision.
  Spawned **abandoned braziers** appear beside ruined masonry like ordinary objects: each blocks one square with its finish following the selected courtyard character. Edit objects can move, add or remove them individually, and accepted changes carry through Undo/Redo, saves, backups, and PNG exports.
- **Collapsed wagon** (Courtyard): select it independently through **Choose additions**, with or without Dry fountain. A broken wooden wagon blocks **3 × 2 squares**, or **2 × 3** when rotated, and a spilled crate blocks one square; the detached wheel and loose goods are passable. Placement keeps a clear tile around the wagon body and stays outside the approaches, 6 × 6 gathering space, walls, and fountain circulation. Generate applies or removes it while retaining the accepted layout, surface texture, and detail revision. The wagon scene stays fixed when ordinary details shuffle. Reset, type switching, Undo/Redo, saves, backups, and exports retain the accepted choice. A request that cannot fit retains the accepted map and editable draft.
- **Stone well** (Courtyard): select it independently through **Choose additions**, with or without the other additions. The **2 × 2** well body blocks movement and a clear circulation tile surrounds its rim; the rim uses the same stone artwork across courtyard characters, and its site stays seeded and clear of approaches, gathering space, walls, fountain circulation and wagon objects. Generate applies or removes it while retaining the accepted layout, surface texture, and detail revision; Edit objects translates it as one complete 2 × 2 group and it has no rotation control. The well scene stays fixed when ordinary details shuffle and survives Reset, type switching, Undo/Redo, saves, backups, and exports. Removing it recreates the original decoration byte-identically. A request that cannot fit retains the accepted map and editable draft.
- **Wizard’s tower:** choose **3–8 floors**, arranged side by side in rows on one sheet. Numbered floor headings and matching stair letters identify both ends of every connection; arrows point up/down and show the destination floor number. **Staircase style** offers **Separate stairs** (distinct up/down flights) and **Shared spiral** (one aligned stairwell with both routes at a shared landing). Both styles use seeded positions. The choice stays pending until Generate, appears in the pending summary, and is retained in saves, previews, PNG filenames, and shuffle history. Changing it creates a new layout at revision 0; Shuffle keeps the accepted style. One optional **Secret portal** selector chooses the source floor, including the top floor. The seed chooses the secret destination floor (excluding the entrance and portal source) and both portal positions. This hidden sanctum counts toward the total and has no staircase access; stairs skip it. Reducing the floor count clears a portal source only if its number exceeds the new total. Floor count and portal changes stay pending until Generate; decoration-only changes preserve floors, connections, surface texture, and detail revision. Tower has one ruined wizard’s tower character, with purpose-specific furnishings and a clear central encounter space. Shuffle moves details while preserving the floor plans and connections; Undo, Redo, pins, local saves, and backups work as usual.
- **Alchemist’s laboratory** (Tower): select it through **Choose additions**, then choose its **Laboratory floor**. One fixed arrangement adds a bubbling cauldron, workbench, bookshelf, scrolls, and candles; the cauldron, desk, and bookshelf each block one square. It supports both staircase styles and any floor, including a secret floor. Generate applies or removes the laboratory as an appearance change, retaining the accepted floor plans, connections, surface texture, and detail revision. Placement protects stairs, portal landings, caption space, movement across the floor, and a clear 2 × 2 space. Ordinary details on that floor may be removed to keep access and blocking budgets safe; other floors keep their exact decoration. The laboratory stays fixed when details shuffle. Undo, Reset, type switching, saved maps, backups, and exports retain the accepted choice. A requested arrangement that cannot fit is rejected with the accepted map and draft intact.
- **Tower observatory:** choose it through **Choose additions**, then assign its **Observatory floor**. A brass telescope, star-chart table, instrument cabinet, and scattered charts form a fixed arrangement. Telescope, table, and cabinet each block one square; charts are passable. It supports both staircase styles and any floor, including a secret floor. It can accompany the laboratory on a different floor; each selector disables the other addition’s chosen floor. Generate applies it without rebuilding the layout or changing surface texture/detail revision, and Shuffle keeps the instruments fixed. Placement preserves connections, movement, blocking budgets, and a clear 2 × 2 encounter space. Unrelated floors keep their exact objects. The default is the highest floor not selected for the laboratory. Reset, type switching, undo, saves, backups, and whole/single-floor exports retain the accepted choice. Secret-floor observatories are omitted from player artwork, accessible descriptions, and PNG filenames.
- **Tower secrets:** **Show secrets** starts off. Player view omits the entire hidden chamber, its heading, and both portal markers from the image while keeping the other floors in place. Turning it on shows the GM view in the preview and Quick export. Export options captures that choice when opened and lets you change it independently for the prepared image. Secret-tower filenames end in `-player` or `-gm-secrets` before any export preset/grid suffix. Library thumbnails always hide secrets. **JSON saves, backups, and shared map files always contain the complete tower**; use the player PNG when sharing with players. This is image preparation, not fog of war or a secrecy mechanism for JSON files. Refresh starts with secrets hidden.
- **Shuffle details:** immediately advances the displayed detail revision, changing props and accents while preserving every tile, dungeon connection, entrance/objective, forest path, and courtyard walls/approaches. Selected additions retain their identity but may move. It uses the displayed map’s accepted settings and leaves pending edits untouched. A refused shuffle leaves the map and history unchanged and reports the problem.
- **Undo / Redo:** the arrow buttons beside Shuffle restore exact accepted snapshots, including object positions, orientation, artwork, and detail revision. Each map type retains up to 20 recent successful changes during the current session. Pending settings stay untouched; Save and Export use the restored map. Switching types, editing/resetting drafts, saving, and exporting retain history. A new successful Shuffle or object edit after Undo replaces the redo branch. Applying settings with Generate or opening a saved map starts a fresh history only for that type (replacing object customizations or open-door states instead retains a recoverable history entry); rejected actions and unchanged-settings submissions retain it. Refresh starts a new session and clears all histories. The limit is shown beside the controls, and unavailable actions are announced as disabled while remaining keyboard-focusable.
- **Pin and compare:** **Pin** in the map header keeps an exact snapshot while you explore another candidate. Switch **Current / Pinned** above the preview; Save, Quick export PNG, and Export options use the displayed candidate and its accepted settings/artwork. Settings, pending changes, and shuffle history always belong to Current, with an explanation shown while viewing Pinned. Successful Generate, Shuffle, Undo/Redo, and opening a save bring Current into view without replacing the pin; failures and unchanged Generate submissions retain the selection. Switching candidates retains drafts, unfinished library inputs, grid, zoom, and pan. Each map type keeps one pin and its own selection through type switches for this page session. **Replace pin** explicitly replaces the pin with Current; it is unavailable while viewing Pinned. **Clear pin** returns to Current and focuses Pin without changing maps or library records. Pins are kept in memory until cleared/replaced or the page refreshes; save a candidate to keep it permanently. Comparison remains available in Focus map and is guarded during generation/export.
- **Grid:** controls the workbench preview and Quick export PNG action. It starts enabled.
- **Keyboard controls:** focus the map with a click or Tab. In Edit objects, **[ / ]** selects the previous/next editable object on the current floor; **Arrow keys** stage movement, **Q / E** stage rotation, **Enter** places and **Escape** cancels. **Delete** removes an eligible selected object immediately. **Ctrl/Cmd + Z** and **Ctrl/Cmd + Shift + Z** undo/redo accepted map changes. Protected objects and whole additions keep their restrictions. In Explore, arrows pan; **+ / −** zoom and **Home** fits the map in either mode. **Keyboard shortcuts** in the map footer (Shortcuts on narrow screens), or **?** while the map has focus, opens scrollable help. Escape or Close dismisses help and returns focus without discarding a staged edit. A selection-specific hint reuses the existing inspector area. Text fields keep normal typing and text undo; map shortcuts ignore composition and unrelated system modifiers.
- **Compact map controls:** Grid, Pin and Focus map share the header. Pin's explanation appears on hover or keyboard focus; Escape dismisses it before leaving the focused workspace when Pin has focus. Current / Pinned comparison controls appear only after pinning. Explore / Edit objects share a segmented control, and object tools appear while editing. Add object, the object selector and Reset customizations align on one row; narrow screens show the shorter Reset label while preserving the full accessible name. Narrow Focus views scroll naturally, keeping zoom and other controls reachable.
- **Edit objects (Dungeon):** switch from Explore to Edit objects to move or remove independent crates, barrels, rubble, sarcophagi, broken columns, moss, rugs, and the shared props listed below. Click an object or choose an instance from **Objects on this map**. Forgotten study, Weathered statue, Dining table, and Ritual site move as complete additions: their components and relative positions stay together. Choose **Rotate left** or **Rotate right** to stage a quarter-turn of a complete addition, then **Place object** to apply it. Column and Row keep the top-left reserved-area anchor fixed; rectangular reserves swap width and height. Components, footprints, artwork and scene markings turn together. Invalid turns stay staged for a corrected position or Escape to cancel. Individual components cannot be moved, rotated or removed separately. **Add object** opens a searchable illustrated catalog: drag a card onto the map, or choose it and click/tap a destination. Placements snap to squares; Column and Row use one-based coordinates (the top-left reserved area for additions). Arrow keys on the focused canvas stage a position, Enter places it, and Escape cancels; labeled directional buttons and Place object provide another route. Invalid destinations explain the obstruction over the preview and retain accepted objects. Objects can sit beside walls and on open passage floor. Checks protect actual walls, doors, entrance/objective space, physical object collisions, usable approaches to additions, access to every free floor tile, a clear 2 × 2 area in each room, and the overall blocking budget. Objects can sit on rugs, moss, ferns, and empty addition floor, including ritual markings. Physical objects cannot cover each other, candles, or offerings. Rugs, moss and ferns can overlap different surface kinds; duplicate surfaces of the same kind cannot overlap. Moving a surface or complete addition leaves independent objects in place. Click selects the visible top object; the dropdown also selects underlying surfaces and additions. Moved and added objects use the same artwork and grid anchor as generated objects; drawing order starts with the generated defaults. Ordinary objects remain centered on their chosen square, including the generated artwork’s overlap with the painted wall edge; the editor adds no shrinking or inward offset. Moss and rugs are passable; rugs use a full 3 × 3 surface area that can lie under objects. Remove an eligible blocker to make room when necessary; the editor never removes another item automatically.
- **Edit objects (Courtyard):** use the same Explore/Edit objects workspace to move, add or remove broken columns, abandoned braziers, low rubble, moss and ferns. The illustrated catalog contains Courtyard objects and the shared props listed below. Grass outside the ruin and paving inside are both usable ground. Move **Dry fountain** as one complete 3 × 3 object with its positioning outline; it has no rotation control. Move **Stone well** as one complete 2 × 2 group with its positioning outline; it has no rotation control either. Move or quarter-turn **Collapsed wagon** as a complete arrangement, including its crate, detached wheel and goods. Column and Row anchor the top-left complete-group outline. Manual placement checks actual object footprints against standing walls, other physical objects, map boundaries, full free-ground reachability and the density budget. The generator’s gathering space, broad approach reservations and empty margins around additions do not forbid manual placement. Empty space inside a group’s outline does not reserve tiles. Physical objects remain separate. Moss, low rubble, ferns and vines are ground cover and can share a tile with objects or other kinds of cover. Duplicate cover of the same kind cannot overlap. Detached wheels and loose goods remain physical even though tokens can walk over them. A rejected collision names both objects and the overlapping grid position. New surfaces start below existing plants and blockers; moving an existing object retains its drawing priority. Vines stay protected. Groups cannot be added, removed or dismantled individually. Placements, invalid previews, keyboard/touch controls, Undo/Redo, read-only pins, accepted-map saving and exports use the shared editor.
- **Edit objects (Forest):** move, add and remove boulders, logs, stumps, bushes, ferns, mushrooms, flowers, and the shared props listed below in the Explore/Edit objects workspace. The illustrated catalog and placement previews use the accepted Forest character’s palette. Trees remain fixed as part of the forest boundary. Move and quarter-turn **Abandoned camp**, **Standing-stone circle** and **Fallen ancient tree** as complete groups; their components, footprints, orientations and camp ash follow together without shrinking or changing their stored artwork variation. Column and Row anchor the top-left occupied group bounds. Empty space inside an addition outline is usable ground. Decorative moss, bushes, ferns, mushrooms, flowers and fallen-tree fungi can share tiles with objects and other kinds of cover; duplicate cover of the same kind cannot overlap. Ground cover may grow outside the clearing, including beneath fixed trees. Physical objects must fit on walkable ground without overlapping another physical object. The generator’s reserved path tiles and encounter space do not forbid manual placement; both map-edge path entrances must stay open and connected, all remaining walkable ground must stay reachable, and blocking must stay within the accepted density budget. Refusals name physical obstructions and their grid positions. Trees and individual addition components cannot be moved or removed separately. Shared layers, named covered objects, keyboard/touch placement, Undo/Redo, pins, saving, backups and PNG export retain accepted edits.
- **Edit objects (Tower):** use the shared Explore/Edit objects workspace for crates, barrels, bookshelves, desks, scroll cases, altars, candles, offerings, bedrolls, moss, and the shared props listed below. Choose **Editing floor** for the object list and new insertions; **Focus floor** zooms to that chamber, while Fit returns to the sheet. The blue outline identifies the active floor. Column and Row use the whole sheet’s coordinates, including columns beyond 40 and rows beyond 30 on larger towers. Existing objects stay on their current floor; cross-floor moves are refused. The laboratory and observatory move and quarter-turn as complete groups, preserving their components and artwork. Both staircase styles are selectable on the map or in the object list. Move a landing on its own floor with its route letters, arrows and destination labels; a shared up/down staircase moves as one object. Its partner landing retains its own position. Walls, floor-purpose headings and portals remain fixed. Staircases and their captions must fit inside the circular walls and stay clear of furniture and other connections; vacated landings become usable ground. Actual object cells must fit on walkable floor without physical collisions, and each floor retains connected free ground and its own density budget. The generator’s empty encounter reserve does not forbid manual placement. Moss, ferns and bedrolls can share floor with objects or different surface kinds; duplicate surfaces of the same kind cannot overlap. Ordinary desks and shelves remain independent even when an addition contains the same kind.
- **Tower editing and secrets:** when a tower has a hidden floor, enable **Show secrets** to edit with all connections visible. The disabled **Edit objects** button displays this requirement beside it and includes it in its accessible description. Turning it off cancels placement and removes hidden-floor objects, group choices, layer badges, inspection details and selection messages. Player previews, thumbnails and PNGs omit secret-floor artwork and its annotations; GM exports retain them. Individual-floor export keeps the original grid scale and independently applies the player/GM choice. JSON always retains the complete tower.
- **Drawing order (all map types):** select an object or complete addition in Edit objects, then use **Bring forward** or **Send backward** to step past an overlapping object. For example, a rug can cover two boxes; each step passes one overlapping object or complete addition. Components of an addition keep their internal drawing order. Changes are accepted immediately and can be undone, saved, pinned and reopened. Drawing order never changes movement blocking: the boxes still occupy their squares. Surfaces and collision rules retain their normal defaults when objects are inserted.
- **Covered objects:** all four workspaces show **named badges such as “Barrel underneath” or “Crate + Barrel underneath”** for overlapping object areas, in Explore and Edit objects. Nearby badges avoid each other and use a line to identify their objects; **Layers** below the map also lists overlaps when their badges cannot fit or are outside the current view. Select a badge to open and focus a top-to-bottom list below the preview; select an item to show its outline, including when it is hidden by the artwork. Complete-addition components select their owning addition for editing. Repeated kinds combine as “Barrel × 2”; larger or longer stacks show a compact “+ N more” summary, with every name available in the tooltip, accessible label, Layers list and inspection list. Names and counts exclude internal overlaps within the same addition and describe authored object areas, including partial overlaps, rather than pixel opacity or cloth simulation. In **Export options**, **Show layer indicators** includes the same named summaries and outlines of covered areas in the prepared preview and downloaded PNG. It starts off each time the dialog opens. Quick export and library thumbnails contain the artwork with its accepted order and no annotations. JSON always retains the complete arrangement, regardless of this export choice.
- **Customized maps:** each committed move, rotation, insertion, removal, or Reset customizations is one undoable accepted change. Temporary ghosts never enter saves or PNGs; Quick export preparation and map/candidate changes cancel temporary placement. Save explicitly to retain customizations after refresh. Map Undo/Redo change includes both object edits and shuffles, retaining the same session limit; the editor toolbar also provides Undo/Redo in Focus map. Shuffle is unavailable on customized maps. Pending settings remain separate: **Replace customizations and generate** applies them and replaces customizations, with Undo available to restore the customized candidate. Reset customizations restores the original generated objects and artwork, keeps independent door states, and is itself undoable; it differs from Reset pending changes. Pins remain read-only. Attached sconces and vines remain protected. Dungeon, Forest and Tower additions and the Courtyard wagon support translation and quarter-turn rotation; the Courtyard fountain and well support translation. Insertion and removal of complete additions are not available. Cross-floor transfers remain future work.
- **Explore:** drag with a pointer, or focus the canvas and use arrow keys to pan. Use the zoom buttons, `+` / `-`, or Ctrl/Command + wheel over the preview to zoom. **Fit** or `Home` recenters the whole map. Ordinary wheel scrolling remains page scrolling. Zoom is relative to fit and ranges from 50% to 400%.
- **Dungeon doors:** in Explore, click or tap a doorway to open or close it. Hover highlights the opening and shows the action; dragging pans without toggling, and canceled gestures do not change doors. **Doors** below the map expands a keyboard-accessible selector and Open/Close button, with one-based grid coordinates and the current state. Toggles join the accepted-map Undo/Redo history and are retained by Save, backups, thumbnails and PNGs. Door states are independent of object customizations: decoration shuffles and appearance changes keep them, while a new layout starts with the original closed doors. Replacing an open-door map with a new layout remains undoable. Object-editing mode, Pinned and busy states cannot toggle doors. Closed doors remain openable connections, not wall tiles; layout/movement validation is unchanged. A PNG captures their appearance but does not provide interactive doors in another application.
- **Mobile navigation:** at widths up to 800 pixels, **Settings / Map / Library** shortcuts stay at the top while you scroll through the workbench. Each jumps to and focuses its section heading; Tab continues into that section's controls. A dot beside Settings and its accessible label indicate pending changes for the active map type. Section jumps retain drafts, map zoom/pan, library filters, and unfinished save or rename inputs. The shortcuts remain available during generation and export.
- **Quick export PNG:** downloads the entire image (2560 × 1920 for Dungeon, Forest, and Courtyard; Tower uses its sheet dimensions), at 64 pixels per tile, using the current grid toggle. Preview zoom and pan never affect the export. Filenames include the map type, generated seed, character where applicable (dungeon preset, forest character, or courtyard character except when it is the default Overgrown), density, accepted additions when present, detail revision and generator version; unapplied drafts are excluded and unsafe filename characters are removed.
- **Export options:** opens a dialog with the actual full-map PNG preview and final pixel dimensions. **Include grid** and **Grid opacity** (0–100%) belong to this dialog, independently of the workbench Grid toggle. The dialog starts with Standard PNG, grid enabled, and 15% opacity. The preset, grid, and opacity choices persist through closing/reopening and map-type switches in the current page session; refresh restores the defaults. Selecting a different preset resets Include grid to that preset’s default while retaining opacity. **Download PNG** downloads the same prepared PNG shown in the preview, with `-grid-Npct` or `-grid-off` added to its filename. Zero opacity produces the same artwork as grid off. The dialog uses the accepted map captured when opened, including its original saved artwork; pending settings and viewport pan/zoom do not affect it. Changing options prepares a new preview before Download becomes available. Failed previews offer Retry preview, and failed downloads retain the prepared image for retry. Close, Done, and Escape return focus to Export options.
- **Export one Tower floor:** in Export options, **Tower floors** offers **Whole tower** or one numbered floor. Each floor image is 16 × 18 squares, retaining its heading, walls, furnishings, and stair/destination labels at the selected preset’s grid scale. The preview, dimensions, setup guidance, and filename describe that floor. Secret floors are offered only with **Show secrets** enabled; switching it off while a secret floor is selected returns to Whole tower. Player images omit portal markers, including on an individually exported source floor. Opening the dialog always starts with Whole tower; preset/grid/opacity choices retain their usual behavior. Quick export still downloads the whole sheet.
- **Map library:** save the displayed accepted map with a name and thumbnail, then reopen, rename, duplicate, favorite, or delete it. Saving is explicit and always records the accepted map document — its seed, type, settings, revision, and any object customizations — never unapplied drafts. Opening a save restores its accepted controls and clears pending edits for that map type. Saves live in this browser's local storage only. **Download backup** writes them to a JSON file and **Import backup** restores them; new records and backups use save-format version 31.0.0, which older app versions reject. Format-1 through format-30 records remain readable and are upgraded on import or load without regenerating their maps.
- **Export this map:** each saved card downloads a JSON snapshot containing only that saved map. Share the file and use **Import backup** in Encounter Map Forge to bring it into another browser's library, then choose Open. The file retains the saved name, favorite status, ID, timestamp, thumbnail, settings, full model, and original artwork; it excludes the displayed map's unapplied drafts and unfinished rename/save inputs. Importing an ID already present skips it without overwriting that save. **Download backup** still exports the whole readable library; use PNG export and its VTT presets for images in Owlbear Rodeo, Roll20, or Foundry.
- **Undo delete:** the library keeps this tab's last successfully deleted save in memory and shows **Undo delete** above the filters. Undo restores its original map, name, favorite status, thumbnail, save time, and ID. It remains available until another successful deletion in this tab or page refresh; unrelated library actions and map-type switches retain it. A failed deletion retains the previous Undo, and a failed restore keeps its snapshot for retry. If the same ID is already present, Undo leaves that existing save untouched and explains the conflict. Undo keeps current filters, reports when they hide the restored map, and returns focus to search. It changes the saved library while retaining the displayed map, pending settings, and viewport. Each tab has its own Undo; refresh ends that opportunity, and backups contain the live library rather than deleted snapshots.

- **Find saved maps:** the library toolbar searches saved names and seeds with a case-insensitive, trimmed substring. Combine it with map-type and Favorites only filters. Favorites first preserves the original default order, newest within each group; Newest first uses save time regardless of favorite status, and Name A–Z sorts case-insensitively with numbered names in natural order. The result count shows matching and total readable saves. **Clear filters** clears search/type/favorites, keeps the selected sort, and returns keyboard focus to search. No matching maps is distinct from an empty or unreadable library.

Browsing choices stay in the current page session through map-type switches, opening maps, and library changes; refreshing restores the default view. Renames, favorite changes, imports, deletions, and other tabs update the current results. If a local rename, unfavorite, or deletion removes its result, focus returns to search. Saving a map outside the current filters retains the filters and reports success; clear or adjust them to reveal it. **Download backup** always includes the entire readable library, even when no maps match the current view. Browsing remains available for readable maps during library recovery and never writes search/sort preferences or changes saved models.

Detail revisions are nonnegative safe integers, up to **9,007,199,254,740,991**. A map at that limit can still be opened, saved, exported, or given different appearance settings. Shuffle reports the limit and preserves the map and pending settings; change the seed and choose Generate to start a new layout at revision 0.

Library changes use an exclusive [Web Lock](https://www.w3.org/TR/web-locks/) shared by tabs of the same origin. Each mutation reads the latest stored library inside that lock before changing it, so another tab's saves and unrelated edits are retained. Storage events refresh other open tabs. Changes to the same field apply in lock order; edits to a deleted map fail rather than restoring it. Reload tabs running an older app build before editing the same library: older builds do not participate in this coordination. Saving requires Web Locks on a secure connection (HTTPS or localhost); when that API is unavailable, existing maps can still be opened and backed up, and library writes are disabled.

`SaveStore` captures the complete record returned by a successful deletion inside that same write lock. Its readonly `lastDeleted` signal is separate from persisted records; deleting and undoing update it only after storage succeeds. Undo reads the current snapshot and latest library inside the lock and refuses an occupied ID before writing. Concurrent Undo requests can restore only once. Reloading library data preserves the in-memory snapshot, including through storage recovery; a new page session starts without one. The library's Undo button uses a guarded `aria-disabled` state to retain focus while a write waits or fails, with restore errors displayed beside the action. Generator and save-format versions are unchanged.

If stored entries cannot be read, IDs repeat, or storage access fails, the library pauses changes and explains the problem. Readable maps can still be opened and exported. **Download recovery data** preserves the exact original stored text, including unsupported, malformed, or repeated entries; its `.txt` file is recovery material, not a normal backup bundle for Import backup. **Download backup** exports only the readable maps in the usual supported JSON format. After browser access or the stored data has been repaired, **Retry library** checks it again. Recovery does not clear or automatically rewrite the stored library.

Dungeons use stairs for the entrance and a circular stone dais for the objective. These are architectural landmarks, with no encounters, hidden information or game mechanics. Forest paths continue off two map edges; their endpoints are unmarked. A suggested scale is 5 feet per square; the exported image has no VTT metadata.

For reproduction, record the **generated seed, map type, room count (dungeon only), density, character (Mosslit/Crypt/Storehouse/Sanctuary for dungeons, Verdant/Autumn/Pines/Fey for forests; Overgrown/Sunbleached/Frostbound/Desecrated for courtyards), selected additions (Forgotten study, Weathered statue, Dining table, and Ritual site for dungeons; Abandoned camp, Standing-stone circle, and Fallen ancient tree for forests; Dry fountain, Collapsed wagon, and Stone well for courtyards), detail revision and generator version (4.0.0 for dungeons and forests; 5.0.0 for courtyards; 3.0.0 for new Towers; older Towers retain 1.0.0 or 2.0.0). For Tower, also record floor count, staircase style, portal source, and laboratory/observatory floors when selected**. For manual reproduction, start from a freshly loaded page, select the map type and recorded settings, and choose Generate if settings are pending. The map starts at revision 0; Shuffle details the recorded number of times. Use the matching generator version. Appearance-only changes to an existing map preserve its current revision. The summary always describes the displayed accepted map, even while draft settings are being edited.

## Object list

Availability below includes both **Add object** choices and objects used in
generated maps or complete additions. An object being available on a map does
not mean it spawns automatically. Objects inside an addition stay part of that
group; sharing their kind does not make those instances independently editable.

### Available on all four map types

All ten objects can be placed individually through **Edit objects → Add object**
in Dungeon, Forest, Courtyard and Tower maps.

| Objects                                   | Availability                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| Treasure chest, Supply sacks, Weapon rack | Manual placement only; do not spawn automatically                                 |
| Small table                               | Manual placement only; blocks one square                                          |
| Wooden bench                              | Manual placement only; blocks 2 × 1 squares, or 1 × 2 when rotated                |
| Crate, Barrel                             | Manual placement; also used by existing generators and additions where applicable |
| Bedroll, Moss, Fern                       | Manual placement; also used by existing generators and additions where applicable |

### Shared by some map types

| Objects                               | Maps               | How they are available                                                                                                            |
| ------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Log, Stump                            | Forest, Courtyard  | Individually placeable on both; also generated in Forest                                                                          |
| Desk, Bookshelf                       | Dungeon, Tower     | Individually placeable on both; also used in generated additions and Tower furnishings                                            |
| Wooden bed                            | Dungeon, Tower     | Individually placeable; manual-only, blocks 2 × 1 squares (1 × 2 when rotated)                                                    |
| Broken column                         | Dungeon, Courtyard | Individually placeable and generated on both                                                                                      |
| Vine                                  | Dungeon, Courtyard | Generated decoration; protected from individual editing                                                                           |
| Scroll case, Altar, Candles, Offering | Dungeon, Tower     | Dungeon: components of Forgotten study or Ritual site. Tower: independently placeable and used in generated furnishings/additions |

### Specific to one map type

| Map       | Objects                                                       | How they are available                                                       |
| --------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Dungeon   | Rubble, Sarcophagus, Rug                                      | Individually placeable; also used in generated decoration or Forgotten study |
| Dungeon   | Wall sconce                                                   | Generated wall attachment; protected from individual editing                 |
| Dungeon   | Weathered statue                                              | Part of the complete Weathered statue addition                               |
| Dungeon   | Dining table                                                  | Part of the complete Dining table addition                                   |
| Forest    | Boulder, Bush, Mushrooms, Flowers                             | Individually placeable and generated                                         |
| Forest    | Tree                                                          | Generated fixed forest boundary                                              |
| Forest    | Tent, Fire ring, Supply bundle                                | Components of Abandoned camp                                                 |
| Forest    | Standing stone                                                | Component of Standing-stone circle                                           |
| Forest    | Fallen trunk, Exposed roots, Fallen branch, Fallen-tree fungi | Components of Fallen ancient tree                                            |
| Courtyard | Low rubble, Abandoned brazier                                 | Individually placeable and generated                                         |
| Courtyard | Dry fountain                                                  | Part of the complete Dry fountain addition                                   |
| Courtyard | Stone well                                                    | Part of the complete Stone well addition                                     |
| Courtyard | Collapsed wagon, Detached wheel, Spilled crate, Loose goods   | Components of Collapsed wagon                                                |
| Tower     | Cauldron                                                      | Component of Alchemist’s laboratory                                          |
| Tower     | Telescope, Star-chart table, Instrument cabinet, Star charts  | Components of Tower observatory                                              |

Complete additions are selected through **Choose additions** before Generate.
The editor moves them as groups, with rotation where supported; their components
cannot be inserted or dismantled individually. A loose crate is distinct from a
wagon's spilled crate, and a loose log is distinct from a fallen-tree component.

This list covers all current prop kinds. Walls, doors, stairs, portals,
entrance/objective markers and floor labels are architectural features; painted
leaves, ash, cracks and similar surface marks are renderer details. Their behavior
is described in [Using the workbench](#using-the-workbench).

## Wooden bench

**Edit objects → Add object → Wooden bench** places a backless wooden bench on
Dungeon, Forest, Courtyard or Tower maps. It is manual-only and does not appear
in Choose additions or automatic generation. Its two occupied squares both block
movement and count toward the map's blocking budget. Rotate left/right or Q/E
turns the complete footprint between **2 × 1** and **1 × 2**, keeping Column/Row
at the top-left occupied square. Either square must stay clear of walls, other
physical objects and protected routes/connections; Tower benches stay on one floor.

The catalog image, placement ghost and accepted bench share the original Canvas
artwork and accepted character palette. Invalid placements stay staged for
correction. Movement, removal, Undo/Redo, current-format saves/backups, thumbnails
and PNG exports preserve its footprint and facing. Save format **37.0.0** records
the expanded authored vocabulary; earlier formats are unsupported under the
current-only policy. Generator versions and ordinary generated maps are unchanged.

## Wooden bed

**Edit objects → Add object → Wooden bed** places a bed in Dungeon or Tower
maps. The original Canvas artwork has a wooden frame, pillow and blanket, with
colors following the accepted character. It is manual-only, is separate from the
one-square bedroll and does not spawn through generation or Choose additions.

Like the bench, it blocks **2 × 1** squares and turns to **1 × 2** through Rotate
left/right or Q/E. Column/Row anchors the top-left occupied square. Both cells
must fit on valid floor without covering physical objects or protected
architecture, and both count toward the blocking budget. Tower beds remain on
one floor. Invalid placement stays staged for correction; movement, removal,
Undo/Redo, current saves/backups and PNG exports preserve its footprint and facing.

## Small table

**Edit objects → Add object → Small table** places a square wooden table on
Dungeon, Forest, Courtyard or Tower maps. It is manual-only, blocks **one square**
and follows the accepted map's character palette. Rotate left/right or Q/E turns
the artwork without changing its one-square footprint. Placement, movement,
removal, Undo/Redo, current saves/backups, thumbnails and PNG exports use the
existing shared-object path. Save format **37.0.0** adds its authored vocabulary;
format 36 and earlier are unsupported under the current-only policy. Generator
versions and automatic generation are unchanged.

## Rotating individual objects

All independently editable objects in the [object list](#object-list) support
quarter-turn rotation on every map where they are available. Select an existing
object in **Edit objects**, or choose a new item through **Add object**, then use
**Rotate left** or **Rotate right**. The preview shows 0°, 90°, 180° or 270° relative
to the object's original artwork. Choose **Place object** to commit the position
and orientation together; Escape cancels the preview. Keyboard users can focus
either rotation button and activate it with Enter or Space.

Rotation keeps the object's anchor. The wooden bench and bed turn their occupied area
from 2 × 1 to 1 × 2; other independent objects retain their existing movement
footprint, including the rug's 3 × 3 surface area. Placement, collision, access and density
checks still apply. Invalid placement stays staged so coordinates can be corrected
without losing the chosen angle. Moving an already rotated object retains its
orientation. Generated artwork variation stays unchanged; the editor adds the
chosen turn to that original facing.

A committed rotation is one Undo/Redo step and survives pins, saved reopening,
backups, thumbnails and PNG exports. Temporary previews do not enter saves or
exports. Returning to the original position and orientation clears a generated
object's move record; four turns alone restore its original document and artwork.

Complete additions retain their existing rotation rules. Individual addition
components, attached sconces/vines, stairs, portals and other architecture cannot
be rotated independently. Chosen artwork orientations use the optional
`artRotation` field in authored move records and added props; the bench and bed instead
store their defined footprint and quarter-turn `rotation`; generated bases,
generator versions, RNG streams and existing addition footprints are unchanged.
Save format **37.0.0** records this authored extension; earlier formats are
unsupported under the current-only policy.

## Shared placeable props

Open **Edit objects → Add object** to place these independent objects. Search by
name, drag a card onto the map, or choose it and use the existing pointer, touch,
coordinate, or keyboard placement controls.

See the [object list](#object-list) for the full availability of shared and
map-specific objects, including components of generated additions.

Chests, sacks, racks, crates, barrels, logs, stumps, desks, bookshelves and small tables each
block one square. Bedrolls, moss and ferns are passable; their overlap rules still
depend on the map type.

The independent catalogs contain **17 Dungeon**, **16 Forest**, **15 Courtyard**,
and **17 Tower** kinds. Sharing adds manual choices; the generators and **Choose
additions** selections are unchanged. Chests, sacks and weapon racks do not spawn
automatically. Their drawings fit one square and follow the accepted map's
character colors; pending character settings do not recolor the catalog or map.

Generated camp, study, laboratory and other addition components retain their
group identity. A separately placed bedroll, desk or bookshelf stays independent
when an addition moves. Physical collision, ground-cover layering, stairs, access,
and density checks still follow each map's rules. Passable does not automatically
mean an object may overlap other objects: for example, a Forest bedroll remains
physical, while Tower bedrolls retain their existing surface behavior. Ferns and
moss are ground cover; Tower stairs continue to require clearance from ferns.
Insertion of complete additions remains future work.

Shared names, categories, blocking and map availability live in
`engine/shared-props.ts`; map-specific editor catalogs consume that metadata.
`rendering/portable-props.ts` draws portable storage and furniture through the existing
shared prop dispatch, which keeps maps, placement previews, catalog illustrations,
thumbnails and PNG exports consistent. Editing, undo, saves and backup imports
use the existing per-map document adapters. Save format **37.0.0** records the
expanded authored vocabulary; format 36 and earlier are unsupported. Generator
versions and canonical generated model/pixel baselines remain unchanged.

## Export presets and VTT setup

Choose an **Export preset** inside Export options. Every preset exports the same
accepted map, with one square representing 5 feet. Dungeon, Forest, and Courtyard
use 40 × 30 squares; Tower uses the floor sheet dimensions below, or 16 × 18 for an individual floor. The resolution
changes the PNG’s pixel dimensions, while generation, saves, and the workbench
viewport remain unchanged. Larger exports are rendered directly at their selected
resolution. These are ordinary PNG files usable in other apps too.

| Preset        | Pixels per square | PNG dimensions | Starting drawn grid | Setup                                                                                                         |
| ------------- | ----------------- | -------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Standard PNG  | 64                | 2560 × 1920    | On                  | Original export resolution and filename behavior.                                                             |
| Owlbear Rodeo | 64                | 2560 × 1920    | Off                 | Keep `40x30` in the filename for automatic alignment; if needed, use Align Image with 40 columns and 30 rows. |
| Roll20        | 70                | 2800 × 2100    | Off                 | Set the image to 40 × 30 grid units, using a 70 px grid and 5 feet per square.                                |
| Foundry VTT   | 100               | 4000 × 3000    | Off                 | Use the PNG as the scene background with a 100 px grid and 5 feet per square.                                 |

VTT preset filenames include the platform, actual tile dimensions (`40x30` for the original map types), pixels per square, and chosen
grid appearance, for example `...-owlbear-40x30-64px-grid-off.png`. Include grid and
Grid opacity remain editable. Standard PNG and Quick export keep their previous
filenames for whole maps; individual-floor filenames additionally identify the floor and `16x18` dimensions, including Standard PNG. Quick export always uses 64 px/square and the workbench Grid toggle.
The dialog downloads the exact prepared PNG shown in its preview. Changing the
preset disables Download until the matching preview is ready, and failed previews
retain the selected preset for retry.

Tower plans keep the same playable scale at every floor count; they are never squeezed into 40 × 30. Each chamber has roughly 100 walkable squares inside a shared circular stone footprint. The last unused sheet slots remain blank. The export table above describes Dungeon, Forest, and Courtyard. For Tower, the dialog displays the actual tile/pixel dimensions and adjusts VTT setup guidance and filenames to match.

| Tower floors | Sheet squares | Standard / Owlbear PNG | Roll20 PNG  | Foundry PNG |
| ------------ | ------------- | ---------------------- | ----------- | ----------- |
| 3–4          | 32 × 36       | 2048 × 2304            | 2240 × 2520 | 3200 × 3600 |
| 5–6          | 48 × 36       | 3072 × 2304            | 3360 × 2520 | 4800 × 3600 |
| 7–8          | 48 × 54       | 3072 × 3456            | 3360 × 3780 | 4800 × 5400 |
| One floor    | 16 × 18       | 1024 × 1152            | 1120 × 1260 | 1600 × 1800 |

Individual-floor PNGs crop the rendered accepted sheet at integer tile boundaries without resampling. This preserves the exact original pixels and grid alignment. Selecting an export floor changes neither the model nor its generator/save version, and the choice is not saved with the map. No model or save-vocabulary migration is needed.

Setup guidance was checked against the official [Owlbear alignment guide](https://docs.owlbear.rodeo/docs/aligning-a-map/), [Roll20 grid setup](https://blog.roll20.net/posts/align-to-grid-new/), and [Foundry scene configuration](https://foundryvtt.com/article/scenes/)
on 28 October 2026. Export dimensions, filenames, and PNG bytes are tested locally;
imports into live VTT accounts have not been verified.

## Engine and model

`src/app/engine` is pure TypeScript, with no Angular or DOM dependency. `generateDungeon(settings)`, `generateForestClearing(settings)`, `generateCourtyard(settings)`, and `generateTower(settings)` each return a discriminated success/failure result. Generation and rendering never use `Math.random()` or `Date.now()`.

The `GeneratedMap` discriminated union carries a `type: 'dungeon' | 'forest' | 'courtyard' | 'tower'` tag. All map types share `version`, `seed`, `layout`, `decoration` and `surfaceSeed` fields. The layout and decoration shapes differ: dungeon layouts have rooms, connections, thresholds and landmarks; forest layouts have walkable tiles, path start and end points, and a stored route (the tiles visited during path carving, deduplicated). Courtyard layouts store walkable tiles, the enclosure bounds, four approach centers, and a protected encounter area; the tile field alone determines standing walls. The renderer and exporter dispatch on the type tag.

Coordinates use **x = column, y = row**, with zero-based tile indices and half-open room bounds: `[x, x + width)` and `[y, y + height)`. Tiles are stored row-major at `y * width + x`; width remains 40 for Dungeon, Forest, and Courtyard. `mapDimensions(map)` supplies the dimensions to preview, export, and thumbnails. Thresholds are explicit two-tile grid edges; horizontal edges span increasing x and vertical edges span increasing y. Doors are passable.

The seeded engine uses unsigned 32-bit **FNV-1a over UTF-16 code units** for stable string hashing and **Mulberry32** for pseudorandom values. Versioned, separately derived streams govern layout, decoration (keyed by preset, density and revision for dungeons; character, density and revision for forests; character, density, fountain choice and revision for courtyards) and surface texture. Surface samples are also keyed by tile coordinates. Map data are deterministic for the same reproduction settings; browser rasterization can differ slightly between browsers.

Dungeon, Forest, and Courtyard use `gridDistances` in `engine/grid-traversal.ts` for four-neighbor shortest paths, preserving left/right/up/down discovery order. The existing `distances` and `forestDistances` names are aliases to that function. Dungeon thresholds/landmarks and forest route rules remain in their domain modules. `shuffleInPlace` in `engine/random.ts` implements Fisher–Yates for locally owned candidate arrays of non-null values; it consumes one inclusive `int(0, i)` draw per descending index, including self-swaps, and none for empty or singleton arrays. Generated maps and caller-owned layouts remain immutable. Connectivity tests retain separate test-only searches, and shuffled-order/next-draw fixtures pin RNG consumption independently of production constants.

**Supported saves and generator versions.** The app supports only the current
save format, **37.0.0**, and the current generator for each map type. This is an
intentional development-time break: formats 1–36, older generator snapshots,
and Dungeon editing versions 1–3 are unsupported. There are no migrations,
character defaults for imported maps, or landmark alias conversions. Regenerate
maps with this build and save them again; changing an old file's version number
does not convert its contents.

| Version                              | Purpose                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| App/package version                  | Software release, declared in `package.json`.            |
| Dungeon and Forest generator `4.0.0` | Current layout and decoration rules for these map types. |
| Courtyard generator `5.0.0`          | Current rules, including spawned ordinary braziers.      |
| Tower generator `3.0.0`              | Current separate and spiral staircase rules.             |
| Save format `37.0.0`                 | Current record, backup, and editing vocabulary.          |

Backup headers and records must contain the exact current save-format string.
Unsupported headers reject the file; unsupported records inside a current bundle
are skipped and counted. Unknown or malformed data is rejected, never normalized
into a valid map. Forest and Courtyard snapshots require their accepted character;
Forests require `forestSurface: 1`, and studies require `studySurface: 1`.
The retired `decoration.brazier` selection is rejected: braziers are ordinary props.

`save/save-format.ts` defines one explicit vocabulary, independent of live engine
lists, so a new engine feature does not silently extend the persisted contract.
`save/map-schema.ts` bounds imported arrays and coordinates before semantic engine
validation, checks the current generator, then validates optional editing and door
sidecars. Canonical bases and resolved arrangements are validated separately.
Current snapshots preserve their stored model and artwork through save/load and
backup round trips. Future schema changes need a deliberate version decision;
this project does not promise historical compatibility while under private development.

Unsupported browser-library entries follow the existing recovery path. Readable
maps remain available, writes pause, and **Download recovery data** exports the
original stored bytes. The app does not delete, migrate, or overwrite unreadable
entries. Import rejection leaves the existing library and accepted map unchanged.
Library changes still run under the shared Web Lock, reading the latest storage,
persisting successfully, and only then publishing state.

**Tower generation.** Tower layouts always store `layout.stairStyle` as `separate`
or `spiral`. Spiral is the default; separate stairs have distinct up/down flights
on intermediate floors. `towerStairLandings` groups shared routes. A connection
stream keyed by generator version, seed, floor count, and portal source chooses
stair sites, the secret floor, and both portal endpoints. The entrance and portal
source remain regular floors; stairs skip the secret floor, which is reached only
by the portal pair. Circular interiors, connection artwork, captions, movement,
and furniture clearance are validated. Style changes generate a new layout;
density changes and shuffles retain the accepted connections.

A laboratory uses `decoration.laboratoryFloor` and five canonical one-tile props,
including a cauldron. An observatory uses `decoration.observatoryFloor` and a fixed
instrument arrangement. The additions occupy distinct floors and run outside the
ordinary details RNG. Only the target floor's colliding, excessive, or obstructing
ordinary props are removed. Import checks canonical positions, complete membership,
variations, blocking budgets, all free-floor access, and a clear 2 × 2 space.
Player PNGs omit secret floors and their addition labels; JSON contains the full map.

**Courtyard generation.** Courtyards use separate layout, decoration, and surface
streams. Overgrown, Sunbleached, Frostbound, and Desecrated select prop mixes and
artwork palettes. Ordinary blocking braziers spawn beside ruined masonry, with
counts scaled by density, and remain editable. The optional wagon uses a 3 × 2
body plus three companion objects; the well uses a 2 × 2 body with rotation 0;
the dry fountain uses a 3 × 3 body. Independent site streams protect their complete
arrangements and circulation space without consuming ordinary decoration draws.
Removing an addition regenerates ordinary decoration at the accepted settings and
revision. Validation checks approaches, protected encounter space, exact footprints,
blocking budgets, and whole-map movement.

**Forest additions and surface artwork.** A camp reserves 7 × 5 walkable tiles
outside the route; tents and supplies block, while bedrolls and the cold fire ring
are passable. A standing-stone circle has six blocking stones and a protected
7 × 7 area with a clear center. A fallen tree combines a 4 × 1 trunk and three
companion objects, with its full rotated footprint checked. These independently
seeded additions preserve each other's reserves and share the density budget.
The surface renderer derives leaves, needles, petals, and camp ash independently
of engine randomness, avoiding routes, props, and protected encounter space.

**Dungeon additions and surface artwork.** Studies, statues, dining tables, and
ritual sites use separate deterministic placement streams and explicit reservations.
Tables store a 2 × 1 unrotated footprint and a quarter-turn rotation; shared footprint
helpers expand all occupied cells for drawing, movement, and budgets. Studies fit
furniture within exposed floor near walls and derive paper, ink, and doorway wear
from the saved arrangement. Ritual markings follow the altar and complete group
transform. Additions protect architecture, movement, and usable adjacent floor.
`landmark-catalog.ts` supplies stable IDs independently of display labels;
`feature-reservation.ts` defines half-open rectangular reservation geometry.

**Object editing.** Canonical generated fields remain immutable. Optional sidecars
store stable `base-N` and `added-N` identities, bounded counters, removals, position
overrides, whole-group transforms, and drawing order. Dungeon placement uses edit
version 4; reordering uses version 5 and retains that version on subsequent edits.
Both are current outputs. Older Dungeon edit schemas and placement rules are removed.
Dungeon edits support rugs beneath objects, whole-addition rotation, strict physical
collisions, free-floor access, and usable additions. Added objects are capped at 120.

Courtyard edits use version 1, or version 2 when a well is present. Forest edits use
version 1. Tower furniture edits use version 1; moving stairs uses version 2, and
removing the final stair override returns to furniture-only state. These versions
remain supported because current commands emit them. Shared arrangement, group,
selection, geometry, command, and drawing-order helpers provide the common contract;
map adapters supply catalogs, locks, placement validation, and drawing resolution.
Parsers reject unsupported versions, spoofed IDs, duplicates, forbidden component
overrides, malformed transforms, incomplete orders, and invalid resolved geometry.

Tower stair edits retain original floor/route identity without changing the base
layout. Furniture commands preserve moved landings; Reset removes both kinds of
edits. Connection footprints distinguish the body from the route caption, so empty
space within their combined bounds stays usable. Moss can sit beneath connections;
physical props require clearance. Wall checks use the continuous circular interior.
Moves retain their source floor, and insertion-floor command fields never enter saves.

The Angular editor owns temporary selection and placement previews; the session
commits only validated commands and rejects stale or pinned edits. Invalid and no-op
commands preserve history. Renderers derive the resolved drawing once for previews,
thumbnails, and PNGs; ghosts and controls never enter saved models or exports.
Reset restores the generated objects and pixels while preserving independent doors.

**Dungeon doors.** `dungeon-doors.ts` stores sparse version-1 open-door IDs based on
threshold geometry. Coincident thresholds share one identity. Closing the last door
removes the sidecar; door state coexists with object edits and does not disable
Shuffle. Unknown IDs, duplicates, extra fields, empty markers, and oversized lists
are rejected. `dungeonBase` removes sidecars for canonical validation; object Reset
retains door state. Door artwork keeps the jambs and swings leaves toward the room.

**Dungeon generation.** Room placement has at most **16 deterministic retries × 320 attempts**. Each room is 5–9 tiles wide and 4–7 tiles high, with two solid tiles of separation before corridors are carved and an intact outer border. A deterministic minimum spanning tree connects room centers, using squared distance and stable room-ID tie-breaking. Orthogonal corridors carve two-tile clearance. At most one extra connection is added when final-tile shortest paths show a useful short alternative. Corridors may merge and enter other rooms.

Actual floor topology determines connectivity, visible walls, and unambiguous corridor-to-room thresholds. Broad openings and ambiguous intersections have no decorative door. Landmark selection maximizes traversable center-to-center distance between different rooms using breadth-first search. The final floor field must form one component.

**Forest clearing generation.** The clearing is an irregular blob of walkable tiles built from four overlapping circles: one base circle and three offset circles. A 2-tile-wide orthogonal path connects two map edges through the clearing, with 1–2 bends. The carved route is stored explicitly in the layout (all tiles visited during carving, deduplicated) and used for both rendering and prop exclusion. The path start and end are on the map edges. At least 200 walkable tiles are required. Trees are placed on non-walkable tiles near the clearing edge. Blocking props (boulders, logs, stumps) are placed on walkable tiles outside the route. Each proposed blocking placement uses breadth-first search to check that the path end remains reachable from the path start.

After decoration, `validateForest` checks the completed map, including connectivity of all remaining walkable tiles. Initial generation makes up to 16 deterministic attempts, retrying when layout or completed-map validation fails and returning an error if the limit is exhausted. Forest shuffles, density changes, and character changes also validate the completed candidate; if validation fails, they return the previous map unchanged.

Forest characters shape decoration and artwork together. Verdant keeps the familiar mix of broadleaf and pine canopies, bushes, ferns, mushrooms and mossy logs. Autumn favors gold and russet broadleaf canopies, leaf-toned undergrowth and extra mushrooms on a bronze floor with fallen-leaf patches. Pines places clustered evergreens, weathered stumps, deadwood and mossy boulders over a needle-covered floor. Fey grows unusual curved trees, flowering ground cover and faintly glowing mushroom clusters on a teal-tinted glade. Character changes only the prop selection probabilities, undergrowth counts, and rendering palette; placement budgets, route exclusion and connectivity validation are shared.

Dungeon decoration follows validation. Crates, barrels, rubble, sarcophagi and broken columns block their tile; rugs, moss, vines and sconces are decorative. Forest decoration places trees in the forest floor, boulders/ferns/bushes at clearing edges, flowers and mushrooms in the clearing interior, and logs along the clearing edge. For dungeons, corridor tiles and neighboring room-entry space, thresholds, landmarks and their adjacent tiles are reserved. Each proposed dungeon blocking placement checks that all remaining walkable tiles are connected and every room still has a clear 2 × 2 area. All map types use finite candidate lists for placement. Changing density, character or shuffling creates new decoration without mutating an existing map.

## Rendering and interface

PNG exports and JSON backups share `browser/download.ts` for temporary links and object URLs. The helper removes the link after activation or failure and schedules URL revocation after 30 seconds, preserving the existing download lifetime. Each caller retains file preparation and user feedback. Backup failures show a retry message; a successful retry clears the previous library error.

The root component provides one `WorkbenchSession` for its workbench. That service owns the accepted dungeon, forest, courtyard, and tower maps, the active map type, and each type's pending settings. It also owns bounded past/future stacks of immutable accepted-map references for each type. Undo and Redo move those snapshots atomically with the displayed map, without invoking generation or changing drafts. Only a successful shuffle records a step; settings commits and opening a save clear the affected stack. History stays in memory, separate from `SaveStore`, and changes neither generator nor save-format versions. The displayed map is computed from the accepted map collection; switching, opening, generating, resetting, and shuffling use session commands rather than maintaining a separate current-map copy. The session also retains one optional immutable pinned snapshot and a selected candidate per map type. `currentMap` exposes the editable accepted result; `map` derives the displayed candidate for preview, library saves, and both export paths. Comparing never invokes generation or persistence. Successful map transitions return the affected type to Current while retaining its pin. Each initial map is generated once per session. Grid state, the busy lock, UI yielding, messages, and download coordination remain in the root component; pan/zoom stay in `Preview`, and saved-map persistence stays in `SaveStore`. Session transitions are tested without rendering a page. Drafts have separate dungeon, forest, and courtyard types: room text and dungeon presets exist only on dungeon drafts, forest characters exist only on forest drafts, and the fountain, collapsed wagon, and stone well selections belong to courtyard drafts. Pure conversion functions validate a draft into its map-specific generator settings without changing raw inputs. Draft edits identify their map type; edits for an inactive type are ignored. Failed validation or generation leaves the accepted map and pending input available for correction or retry.

`Library` owns its browsing preferences as signal state and derives visible records from the live `SaveStore.saved` collection. The plain `save/library-view.ts` function filters and sorts a copied array while retaining record/model references. Newest sorting compares timestamps, puts records with unusable timestamps after dated records, and uses deterministic name/ID tie-breakers; name sorting breaks equivalent names by newest date, then ID. No filtered collection is written back to storage or used as the source of backups. Generator and save-format versions are unchanged.

`SettingsPanel` owns the settings form, detail action, accepted-style note, and their responsive styles.

Its **Add to this map** summary derives selected additions and typed draft commands from the existing scene, landmark, and furniture fields; these remain internal placement/save concepts. `AdditionPicker` owns the native modal dialog, search, and illustrated checkbox catalog. It receives those same readonly choices and emits draft commands, with no second selection state. The picker opens with its title focused, allowing browsing without immediately activating a mobile keyboard. Native dialog behavior makes the background inert and restores focus on closing; removing a summary item returns focus to Choose additions. The catalog has its own scroll area, and CSS prevents background-page scrolling while a dialog is open. `AdditionPreview` draws small, fixed illustrations with the existing prop renderer into offscreen canvases, then displays them as decorative images beside the text descriptions. These illustrations never generate or mutate a map. Generator and save-format versions are unchanged.

The typed `workbench/presentation.ts` catalog owns its preset/character labels and descriptions and density descriptions; domain options and rendering palettes stay in their respective layers. `MapPanel` owns the compact map header, grid/pin controls, contextual comparison row, generated-map summary, and its embedded `Preview`. Both receive readonly signal inputs and emit typed user actions to `App`; neither keeps a second settings state or accesses persistence. They use [native-element component selectors](https://angular.dev/guide/components/selectors#when-to-use-an-attribute-selector) on the existing `<aside>` and `<section>`, preserving landmarks and grid layout without extra wrappers. Page composition, export/message rows, and library integration stay in `App`.

Mobile section navigation uses native fragment links to focusable headings, with CSS scroll padding below the sticky row. All sections stay mounted, so navigating requires no second section state or viewport restoration. The pending indicator reads the existing session state; navigation changes no generated models or saved data. Native fragment history supports Back and Forward, and jumps use the browser's default instant scrolling.

Settings radio groups share their container, selection, focus, and input styles through grouped SCSS selectors. Their flex/grid layouts and icon spacing remain local, and the controls remain native radios. Two root CSS properties share focus colors across the workbench and map controls while preserving each control's outline offset. Room-stepper helpers and tests live in `workbench/`; the existing `Icon` remains shared at the app level.

The root `--text-muted` and `--text-accent` colors support secondary copy and warm text accents on the light page, panel, card, and option backgrounds. Browser contrast checks measure computed foregrounds against inherited, composited solid backgrounds and require an unrounded ratio of at least 4.5:1 for sampled enabled text, following [WCAG text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). These cover all three map types, normal/selected/hover/keyboard-focus states, placeholders, settings hints, pending/status/error messages, library metadata/actions, and footer copy at 1440, 768, and 320 CSS pixels. Measurements and review screenshots are saved under `artifacts/qr05/`. The checks reject unexpected gradients or ancestor opacity instead of reporting a guessed contrast; they cover solid interface surfaces rather than Canvas artwork or a full accessibility certification.

Contrast scenarios wait for the requested map-type heading and completed busy state before measuring the settings form. Generation and library commands also wait for their accepted result and completed busy state. A controlled regression delays the map-type change event while the old form remains enabled, ensuring that an enabled control alone cannot satisfy readiness.

The library component loads through an immediate deferred block after the first render, keeping the initial bundle within the existing budget as editing support grows. Its placeholder retains the library heading and loading announcement; a failed chunk offers a refresh instruction while the accepted map remains available for PNG export. Loading does not rewrite saved data. Keyboard navigation, save/import and failed-load recovery are covered by browser checks.

`renderMap(context, map, options)` is the shared drawing entry point for preview, PNG export, and library thumbnails. Its exhaustive map-type dispatch calls `renderDungeon`, `renderForest`, `renderCourtyard`, or `renderTower` through one `RenderOptions` contract. The original renderers share tile-boundary tracing and the grid path while retaining their own floor textures, wall/clearing-edge styles, palettes, and layer order. Optional `gridOpacity` (0–1) overrides only the grid alpha; omitting it preserves each renderer's original grid. Courtyards draw daylight grass, weathered paving, solid masonry caps and contact shadows, passable stone chips, columns, an optional empty fountain, an optional 2 × 2 stone well with a dark mouth, bucket on a rope, and shared stone rim artwork, and spawned abandoned braziers with per-character metal finishes, with per-character atmosphere palettes for ground, masonry, vegetation and accents that keep Overgrown's ground, masonry, and vegetation identical to the original artwork. Preview and Quick export retain 64 pixels per tile; thumbnails use 8 pixels per tile with no grid. Canvas creation, viewport handling, and image encoding remain with their consumers. Visual-review fixtures can still call the concrete renderers directly. Dungeons draw seeded slab fills and chips, continuous topology-derived wall contours, contact shadows, masonry joints, thresholds, architectural landmarks, props, restrained light, and the optional whole-map grid. Forests draw textured ground, a dirt path, clearing edges, trees, rocks, and undergrowth, with per-character ground tones, tree shapes, and prop palettes. All artwork is original Canvas vector drawing; there are no external images, fonts, asset licenses or runtime fetches.

`ExportOptions` owns the native export dialog, its appearance controls, and preview/download feedback. It prepares a full-resolution Blob through `createPng`, displays it with an object URL, and downloads that same Blob. Effect cleanup cancels scheduled frames, ignores obsolete encoding results, and releases preview URLs on option changes, closing, and destruction. The modal keeps the background inert while the controls remain available for correction; closing during preparation leaves no accepted-map or persistence changes. A successful download updates the root status. Export choices, including Show secrets, are not saved into map records.

The fixed courtyard composition and four generated examples in `scripts/courtyard-review.spec.ts` write full maps and fountain close-ups to `artifacts/courtyard/`, and `scripts/well-review.spec.ts` writes well maps and close-ups to `artifacts/well/`.

The showcase in `src/app/engine/showcase.ts` supplied the first renderer fixture: three rooms, two bent corridors, thresholds, and the prop collection. Its full export and close-up were inspected before implementing random generation.

Character illustrations are separate fixed-seed examples from the existing generators and Canvas renderer, cropped at the same aspect ratio to show recognizable room or woodland detail. They do not use or mutate the accepted map, draft seed, viewport, library, or export image. The sidebar renders only its chosen illustration; gallery images load when the dialog opens. Small data URLs are cached by map type and character, while full-size canvases and generated example maps are released. The native modal lives outside the generation form so Enter on a radio cannot submit Generate. Queued close events cannot clear a gallery already reopened. The picker changes only the existing preset/character draft fields; generator output, save-format version, and persisted vocabulary remain unchanged.

The Angular app uses standalone OnPush components, Signals and computed state, strict TypeScript with unchecked-index checking, strict templates, built-in control flow, and native form controls. A map-type selector switches between Dungeon, Forest, Courtyard, and Tower. `WorkbenchSession` owns draft/accepted settings; `App` coordinates actions and recoverable errors; `Preview` owns canvas lifecycle, resize observation and viewport state. Preview artwork is cached independently of viewport movement, drawn at device pixel ratio, and regenerated only when map data, grid visibility, or Tower secret visibility change. Export uses a separate canvas and asynchronous Blob creation. Conflicting controls are disabled during operations and restored after failures. Before a heavy action runs, the app yields two animation frames so the disabled state can paint first.

Canvas has a descriptive accessible label, an adjacent generated-map summary, keyboard controls, and visible focus feedback. It does not expose individual map tiles as accessible interactive elements. The workbench stacks above the preview on narrow screens.

Generation remains separate from rendering. Supporting another map type requires an explicit drawing branch in `renderMap`, without a plugin framework.

## Checks and visual review

```sh
npm test -- --maxWorkers=1
npm run typecheck:tests
npm run build
npm run format:check
npx playwright install chromium
npm run test:e2e
```

The Playwright browser download is needed once. The browser suite starts and stops its own fresh server on port 4307, leaving the normal development server on port 4200 alone. Hot module replacement is disabled for tests so deferred loading and failure states can be exercised as real chunks; your normal development setup is unchanged. Tests generate ignored review artifacts in `artifacts/`, including desktop/mobile screenshots and a browser-exported PNG. `npm test` also renders the showcase, six full maps, close-ups, a contact sheet, and the four forest characters using the development-only `@napi-rs/canvas` package. Use `npm run format` to format source, tests and configuration.

`typecheck:tests` includes TypeScript sources recursively under `src/`, alongside browser tests, review scripts, and tool configurations, so specs in new feature folders are checked automatically. `WorkbenchSession` tests cover accepted maps, independent drafts, per-type retention, and failure recovery. `SaveStore` tests use a narrow in-memory storage fake to verify persistence before signal updates, unchanged disk and signal state after failed writes, successful retries for every library mutation, import deduplication, safe loading, and export without writes. Browser tests retain coverage of native controls, Canvas, downloads, and component interactions. Library safety tests also queue two tabs behind a held write lock, check cross-tab edits and stale deleted-map commands, preserve unreadable storage through recovery downloads, and verify retries after read and import-write failures.

TypeScript also checks unused locals and parameters in the application and test sources. Formatting includes `.github/`. The [Checks workflow](.github/workflows/checks.yml) runs on pushes and pull requests using Node 22.23.3 on Ubuntu 24.04. It installs locked dependencies, checks formatting/types, runs unit tests with one worker to avoid competing native rendering workloads, and builds the app. Automatic checks do not install or run browsers.

The full Chromium suite is available locally through `npm run test:e2e` and on demand through the separate [Browser tests workflow](.github/workflows/browser-tests.yml). In GitHub, choose **Actions → Browser tests → Run workflow**, then select the branch to test. The workflow must first exist on the repository's default branch for manual runs to become available, as described in [GitHub's manual workflow instructions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow). Browser checks are useful for changes to interaction, exports, storage, and accessibility, and before releases; they do not run on pushes or pull requests. If branch protection previously required `Browser tests`, remove that requirement and keep `verify` required so manual browser runs do not block merges.

The manual browser job uses Node 22.23.3 and the official Playwright Noble container with browsers and their system dependencies preinstalled, following the [Playwright container CI setup](https://playwright.dev/docs/ci#via-containers). Its `playwright-version` matrix value pins the container to Playwright 1.64.1, matching `package-lock.json`; a guard fails with an update instruction if they diverge. When upgrading Playwright, update that value alongside the lockfile. The suite retains its single worker, and failed browser-test traces are retained for seven days. A separate ESLint configuration can be added when specific rules beyond the compiler and formatter justify it.

Engine checks cover deterministic models, immutable inputs, bounded generation,
connectivity, footprints, density budgets, protected areas, and every current map
type, character, addition, and editing mode. Independent model and pixel baselines
remain for current output. Save checks cover exact current round trips, strict
metadata and editing validation, every retired save-format rejection, retired
generators under a current wrapper, future data, and non-mutating rejection.

Browser tests cover drafts versus accepted maps, save/open and refresh, backups and
sharing, library locking and recovery, undo/redo, pins, editing, keyboard/mobile
controls, preview navigation, and PNG export. Current test snapshots live in
`src/app/save/fixtures/*-current.json`; obsolete historical snapshots are removed.
`tests/current-save-format.spec.ts` checks rejected older imports and preserved
recovery data for stored unsupported records.

Visual review scripts write maps and close-ups under `artifacts/` using the actual
Canvas renderer. Run the relevant feature specs through `npm run test:e2e -- <paths>`;
Playwright uses Chromium and the configured port 4307. Other browser engines and
physical touch devices need separate verification. Test sources and review scripts
are type-checked separately from the production build.

Shared-prop checks cover all 40 supported map/object combinations, unsupported
map kinds, strict blocking validation, immutable editing and save/backup round
trips. `scripts/shared-props-review.spec.ts` checks deterministic artwork and
single-square drawing bounds and writes `artifacts/shared-props/catalog.png`.
`tests/shared-props.spec.ts` checks all four catalogs, independent placement and
movement, undo, save/reopen, fresh-browser backup import, exact PNG parity, and
search/keyboard placement with invalid-destination recovery at 320 px width.

Individual-rotation checks cover every catalog entry on all four map types,
generated-object restoration after four turns, strict malformed-angle and
canonical-base rejection, placement, save/backup round trips and immutable inputs.
`scripts/object-rotation-review.spec.ts` renders all four orientations into
`artifacts/object-rotation/` contact sheets. `tests/object-rotation.spec.ts` covers
staging/cancellation, retaining a staged turn while dragging, keyboard insertion,
invalid-position recovery, Undo/Redo,
saved reopening and exact PNG parity, including a 320 px Tower workspace.

Compact map controls are covered by `tests/compact-map-controls.spec.ts` on all
four map types at 1440, 800, 768 and 320 px, including touch emulation. Checks
measure button/select alignment and control heights, exercise pin help by hover
and keyboard, dismiss it with Escape, and verify comparison, disabled/read-only
states, focus restoration, usable pinned-view zoom and horizontal overflow.
Review screenshots are in `artifacts/compact-map-controls/`. Desktop controls use
compact spacing; touch controls retain a minimum 44 px height and Back to
workbench retains its existing 44 px minimum. Narrow Focus views use the existing
natural-height workbench layout with a definite, viewport-relative canvas frame,
avoiding overlapping controls and canvas resize feedback. This presentation
change does not change generated maps, saved documents or their format.

`keyboard-shortcuts/shortcuts.ts` owns the new key bindings and the corresponding
help rows. `Preview` handles shortcuts only on its focused canvas and delegates
editing actions to the existing `ObjectEditor` commands and history. The native
keyboard-help dialog keeps its background inert, provides a focusable scroll
region and persistent Close action, and restores its opener. Help does not cancel
staged movement or rotation. `tests/keyboard-shortcuts.spec.ts` covers all four
map types, keyboard selection/movement/rotation/removal/history, help and focus
restoration, scrollable mobile/short-screen content, input/composition/modifier
safety and protected/pinned maps. Artifacts are in `artifacts/keyboard-shortcuts/`.
The optional guided app tutorial remains a future feature; it is not implemented.

Bench verification uses focused placement/save checks on all four map types,
including the second occupied square, wall-side rendering, refused turns, malformed footprint/angle
imports, removal/reset and unchanged inputs. `scripts/bench-review.spec.ts`
checks drawing bounds and renders `artifacts/wooden-bench/rotations.png`.
`tests/wooden-bench.spec.ts` checks catalog artwork/labels, placement, keyboard
rotation, Undo/Redo, saved reopen and exact PNG parity on each map type.

Bed checks extend the existing two-square furniture placement/save cases for
Dungeon and Tower and explicitly reject bed insertion in Forest/Courtyard.
The wall-side rendering regression derives its target from the full footprint.
`scripts/bed-review.spec.ts` checks artwork bounds and writes
`artifacts/wooden-bed/rotations.png`. `tests/wooden-bed.spec.ts` covers insertion,
keyboard rotation, Undo/Redo, saved reopen and exact PNG parity on both supported
maps, including a narrow Tower layout.

Small-table coverage uses the shared rotation/save cases on all four map types.
`scripts/small-table-review.spec.ts` checks drawing bounds at every quarter turn
and writes `artifacts/small-table/rotations.png`. `tests/small-table.spec.ts`
checks catalog labels, placement, keyboard rotation, Undo/Redo, saved reopen and
exact PNG parity on all four map types, including a narrow Tower layout.
