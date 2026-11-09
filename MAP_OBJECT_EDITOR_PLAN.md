# Map object editor: feasibility and delivery plan

Status: All four map types support editing, including whole-addition movement and supported quarter-turn rotation. Cross-floor transfers, independent object rotation and group insertion/removal remain planned. Reviewed 5 November 2026.

This develops F24 / I29 in [Feature ideas next](FEATURE_IDEAS_NEXT.md) into a
larger authoring feature. Compare map coverage in the
[map feature inventory](MAP_FEATURE_INVENTORY.md). Product and compatibility
rules remain in [README.md](README.md) and [AGENTS.md](AGENTS.md).

Sections 1–9 retain the original design and staged scope. Delivery records in
sections 10–21 document the implementation and subsequent corrections. The final
generated-anchor correction supersedes both earlier editor-specific wall-fitting
attempts.

## 1. Feasibility verdict

**Feasible, with substantial work across the model, interaction, validation,
history, and persistence boundaries.** The existing generators and Canvas artwork
can remain. There is no demonstrated need for a new rendering library, backend,
framework upgrade, or generator rewrite.

The drag gesture is the small part. The difficult part is making a manually
changed map valid, recoverable, savable, and consistent with every other action.
The architecture has useful boundaries, but it was designed around generated
snapshots, not arbitrary authored arrangements. It is not already an editor.

We can preserve the generator workflow by introducing a separate, explicit
authored-document contract. We cannot promise zero regressions. Compatibility
baselines, narrow releases, and refusal paths are how we control that risk.

Plan this as a sequence of feature branches with review and testing between
them, not one large patch. The phases below are milestones, not necessarily one
commit each. A credible calendar estimate needs the first vertical slice and
agreement on group editing, mobile support, and placement restrictions. This is
materially larger than adding another map type or addition.

## 2. Baseline before editor implementation

These were observations from the planning review before implementation. The implications are design conclusions,
not demonstrated application bugs.

| Existing evidence                                                                                                                                                                                                             | Benefit or constraint for editing                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [model.ts](src/app/engine/model.ts): immutable `Prop` records with kind, position, blocking, variation, optional footprint/rotation                                                                                           | Reuse object geometry and artwork. Props have no stable instance IDs or group ownership. Kind is not identity: several crates can exist.       |
| [prop-footprint.ts](src/app/engine/prop-footprint.ts): bounds and occupied cells, top-left rotated anchors                                                                                                                    | Reuse for occupancy and placement. Movement footprints are not always visible sprite bounds or click targets.                                  |
| [preview.ts](src/app/preview/preview.ts) and [preview.html](src/app/preview/preview.html): cached full-map Canvas, fit/zoom/pan, pointer capture, keyboard panning                                                            | Keep the viewport. It currently pans on primary drag and has no object selection, inverse coordinate transform, or editing transaction.        |
| [props.ts](src/app/rendering/props.ts): shared artwork dispatch; [render-map.ts](src/app/rendering/render-map.ts): map-type render dispatch                                                                                   | Reuse sprites in maps and object choices. Drawers are not a user-facing item catalog.                                                          |
| [forest-renderer.ts](src/app/rendering/forest-renderer.ts), [dungeon-renderer.ts](src/app/rendering/dungeon-renderer.ts), [tower-renderer.ts](src/app/rendering/tower-renderer.ts): different drawing orders and architecture | Hit testing must follow actual visibility/layer order. Walls, doors, stairs, portals, labels, and surface details are not all props.           |
| [forest-validation.ts](src/app/engine/forest-validation.ts), [courtyard-validation.ts](src/app/engine/courtyard-validation.ts), [tower.ts](src/app/engine/tower.ts): canonical addition checks                                | Moving an addition component can make a currently valid save unreadable. A safe new position is not necessarily a valid generated arrangement. |
| [workbench-session.ts](src/app/workbench/workbench-session.ts): accepted snapshots, per-type drafts, pins, bounded shuffle history                                                                                            | Good state ownership. History currently means shuffle, and Generate resets it. Editing needs an explicit broader action contract.              |
| [map-schema.ts](src/app/save/map-schema.ts), [save-format.ts](src/app/save/save-format.ts), [save-store.ts](src/app/save/save-store.ts): bounded parsing, frozen format vocabularies, recovery, locked writes                 | Keep these guarantees. Saving, sharing, thumbnails, deduplication, and opening all currently expect generated maps.                            |
| [forest-surface.ts](src/app/rendering/forest-surface.ts), [study-surface.ts](src/app/rendering/study-surface.ts), [ritual-props.ts](src/app/rendering/ritual-props.ts): details derived from positions/scene membership       | Moving an object can change its surrounding artwork. A floating sprite overlay alone will leave stale ash, papers, markings, or shadows.       |

The source review is sufficient to identify the architectural changes. At that planning stage, no editor prototype or performance measurements had been made. The delivery record below describes subsequent implementation.

## 3. Proposed user experience

Keep generating maps as today. Add an explicit **Edit objects** mode alongside
Explore. Editing affects Current; a pinned comparison remains read-only.

In Edit mode, users can:

1. Click an eligible object to select it. Show its name, occupied squares, and
   available actions. Locked objects explain why they cannot be changed yet.
2. Drag the object to a grid-snapped position. Retain the grab offset so large
   objects do not jump beneath the pointer. Show a ghost and a placement reason.
3. Drop to commit one valid move. An invalid drop retains the original object;
   Escape or pointer cancellation cancels the gesture. Never delete other items
   automatically to make a manual move fit.
4. Open **Add object**, choose an item belonging to this map type, and drag it to
   the map. Also support choosing an item and clicking/tapping a destination.
5. Use Undo/Redo for committed changes, then save or export the visible accepted
   result. Leaving Edit mode keeps committed changes; it does not silently save
   them to the library.

A dropdown can open the catalog, but a plain native select cannot itself provide
draggable item cards. Recommend a compact searchable popover/panel with names,
small artwork, size, blocking/passable status, and supported actions. The list
stays closed while unused. Distinguish **Add object** (available kinds) from
**Objects on this map** (instances, including multiple crates and their locations).
The latter also supplies an accessible selection route through a Canvas image.

Use a mode switch and explicit pan tool, with a temporary pan gesture if useful.
Do not leave the same drag ambiguous between moving an object and moving the map.
In Explore, preserve current navigation. In Edit, arrow keys operate on the
selected object through a documented placement gesture; Enter commits and Escape
cancels. Offer labeled move controls so drag is never the only input method.
Resolve Escape priority with the existing export dialog and Focus map behavior.

Edits are immediate accepted commands, not another settings draft with another
Generate button. During a drag, the ghost is temporary and Save/Export still
refer to the last committed document. The interface must make that distinction
clear; it must not export a ghost or write storage on every pointer move.

## 4. Scope: items are not all the same thing

| Category                                                                                              | Recommended handling                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary independent props, initially dungeon crates/barrels                                          | First supported moves and palette placements. Preserve existing variation when moving.                                                                                                          |
| Multi-square furniture                                                                                | Later footprint-aware movement and rotation, after basic editing works through saves and exports.                                                                                               |
| Scene components: camp, study, ritual site, wagon, fallen tree, laboratory, observatory, stone circle | Initially selectable but locked with a reason. Later support moving complete groups with their empty-space/circulation reserves. Do not let moving one candle silently dismantle a ritual site. |
| Forest boundary trees and attachment-dependent items such as sconces/vines                            | Need dedicated terrain/attachment rules. A forest tree currently belongs on non-walkable ground; a universal “floor only” rule is wrong. Audit before enabling.                                 |
| Dungeon doors, entrance/objective; tower stairs/portals; walls, routes, floor plans and headings      | Protected architecture, outside this object editor. Editing these would change topology and belongs to a separate feature.                                                                      |
| Leaf drifts, papers, ink, ash, glow and ritual floor markings                                         | Derived artwork, not separate selectable props in the initial editor. Resolve from the committed arrangement under an explicit artwork rule.                                                    |

The eventual catalog should account for every supported map item, but should not
pretend every item is freely placeable. Unavailable entries need an explanation
or a clearly labeled later group tool. A technical `PropKind` union is not the
release promise. The first release intentionally covers a small subset; full
map coverage is a later milestone, not something to mark done after crate drag.

Arbitrary resizing, pixel positioning, unrestricted overlap, custom collision,
freehand walls, multiple selection, external assets, lighting, and collaboration
are outside this proposal. Deletion/duplication can follow movement and insertion;
they need their own accepted commands and group rules.

## 5. Recommended architecture

### Document and identity

Keep `GeneratedMap` as an unchanged valid generated snapshot. Introduce a typed
document union: an unedited generated document, or an edited document containing
an immutable generated **base snapshot** and versioned customization state.
Names and shapes here are design sketches, not agreed public APIs.

Use the stored base, not regeneration from the seed: historical snapshots and
mixed-version appearance changes cannot reliably be reconstructed from settings.
Store current overrides and added instances, not an ever-growing command log.
Resolve the visible arrangement as a derived value; do not persist another
independently editable resolved copy. Undo history remains session-only.

Give objects stable IDs scoped to that base. Existing array indices can seed
sidecar identities only if the base stays immutable and ordered; never use an
index in the changing visible array or kind/coordinates as the identity. Added
objects need persistent unique IDs and explicit stable artwork variation. Do not
consume generator RNG draws or alter old prop JSON to manufacture IDs. Validate
duplicate IDs, invalid references, and unsupported edits on import.

The resolver produces an explicitly typed renderable/editable view. Do not cast
it back to a canonical `GeneratedMap` to bypass validation. Rendering, preview,
export, thumbnails, summaries, comparisons, and persistence need deliberate
document support. Keep unchanged documents on the old rendering path and prove
their models/pixels remain exact.

### Validation and placement

Use pure commands such as move/add, returning success with a new document or a
typed refusal. Preview and final commit use the same placement rules; recheck
against the current document at commit so a stale drag cannot overwrite a change.
No caller-owned mutation, silent correction, or collateral object removal.

Validate the base with the existing frozen generated-map rules. Validate edits
against a versioned capability catalog and validate the complete resolved
arrangement against authored spatial rules. This is a distinct contract, not a
switch that disables validation. Initially permit overrides only for explicitly
eligible ordinary objects; all canonical addition records and reservations remain
protected. Later group support needs its own explicit schema and rules.

Preserve full rotated occupancy, valid terrain/attachments, walls and exposed
floor clearance, door and route access, entrance/objective space, addition
circulation, encounter areas, full free-floor connectivity, and per-room or
per-floor budgets. Keep current blocking budgets for the first release, including
manual insertions, and explain “blocking limit reached.” Relaxing them would be a
separate product decision. Do not silently change density to accommodate edits.

Define overlap policy explicitly. Initially refuse new occupied-cell overlaps,
including passable decorations, while preserving untouched historical overlaps.
Later controlled ground/object stacking requires both placement and selection
rules. Hit areas may exceed occupied cells for legacy sprites; do not change old
movement footprints just to make them easier to click.

Imports must validate all edits together, not merely each move against the base.
Bound bytes, object counts, coordinates, footprints, references, and parsing work
before allocating or traversing. Measure realistic limits rather than treating
“unlimited items” as a requirement.

### Browser and rendering boundaries

Extract one viewport transform for painting and inverse hit testing: account for
fit margins, pan, zoom, resize, CSS coordinates, and device pixel ratio. Tower
uses sheet dimensions and separated floor origins, not a 40 × 30 assumption.
Selection follows drawing order and excludes objects hidden in player view.
Provide instance-list selection for covered/small items.

Keep pointer capture, drag thresholds, lost-capture/cancel cleanup, and rendering
scheduling in browser/UI code. Keep positions, geometry, capability checks,
commands, and spatial validation in pure TypeScript. `WorkbenchSession` remains
the owner of accepted documents; do not add a competing editor store containing
another authoritative map.

Use a temporary interaction overlay for selection, handles, and ghosts. Cache
stable map artwork; do not regenerate the map, rebuild the full-resolution export,
or run storage writes per pointer event. Start with existing Canvas facilities.
Benchmark before adding a scene graph, spatial index, worker, or library.

Commit must rerender affected derived artwork from the resolved document, not
paint a second sprite over an unchanged base. Define whether marks follow a
moved group and how occupancy suppresses surface details. New authored artwork
semantics must be versioned; unedited historical images stay unchanged. Editor
outlines, invalid-state colors, and ghosts never enter thumbnails or PNGs.

### Persistence and compatibility

Introduce an explicit save-format extension for edited documents, with frozen
vocabulary for supported capabilities and authored rules. Choose the next unused
version when implementing; current format 18 is context, not a reservation for
this plan. Old formats must not claim editing fields. Unknown future edited data
must be rejected/recoverable, never stripped and saved as an unedited map.

Validate the embedded base under its declared supported format and preserve
legacy normalization without changing source object order/identity. Loading or
saving an old map must not opt it into editing or new artwork. Merely selecting
an object creates no persistent edits. A true no-op returns the original document.

Roundtrip edited state through library save/open, backups, individual JSON sharing,
thumbnails, duplicate handling, and export. Deduplication must include authored
state: two different arrangements of the same seed are different maps. Preserve
the shared Web Lock read-modify-write flow, failed-write atomicity, unreadable
storage recovery, and stale-record behavior. Account for document size and bounded
history memory; share immutable bases in memory rather than cloning them per move.

## 6. Actions that could otherwise destroy user work

These are recommended initial product decisions, to agree before implementation.

| Action                                                              | Proposed behavior                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid move/add                                                      | One accepted command and one Undo entry; settings drafts remain untouched.                                                                                                                                                                                             |
| Invalid drop, pointer cancel, lost capture, stale source            | No accepted change or history entry; explain refusal where appropriate.                                                                                                                                                                                                |
| Undo/Redo                                                           | One chronological per-type history for shuffles and edits. New committed action clears redo; failed/no-op actions do not. Rename the controls beyond “Undo shuffle.”                                                                                                   |
| Change type, Current/Pinned, open save, leave editing, hide secrets | Cancel temporary interaction first. Retain committed per-type documents. Never apply a drop to a different candidate or hidden floor.                                                                                                                                  |
| Pin, compare, Save, Quick export, Export options                    | Consume the displayed committed document. Pinned documents are immutable; keep present Current-only settings behavior. Capture export state consistently.                                                                                                              |
| Pending settings                                                    | Remain pending during editing. Do not implicitly apply or reset them.                                                                                                                                                                                                  |
| Generate with customizations                                        | Explicitly offer replacing the customized candidate with a generated one; retain the old candidate through a defined recoverable replacement action/history boundary. No silent rebase or disappearing edits. Define this recovery before shipping.                    |
| Shuffle with customizations                                         | Initially unavailable with a clear explanation. Ordinary shuffle currently replaces props and cannot preserve custom placements by accident. Preserve shuffle behavior for unedited maps. A later “shuffle unedited details” needs stable identity and conflict rules. |
| Reset customizations                                                | Explicit command restoring the exact stored base, undoable as one action. Distinguish it from Reset pending settings.                                                                                                                                                  |
| Refresh                                                             | Existing session history clears. Saved edited documents survive; do not imply unsaved work is automatically persistent.                                                                                                                                                |
| Secret tower floor                                                  | Editable only when visible in GM view; player hit tests, object lists, summaries, thumbnails and PNGs must not expose hidden objects. JSON still contains full GM data, as today.                                                                                      |

There is deliberately no promise to automatically carry edits across a new seed,
layout, character, density, or changed addition. A correct rebase is another
substantial feature. Disabling shuffle on customized maps is a real initial
limitation, not a completed solution to preserving edits through shuffle.

## 7. Delivery phases and review gates

Do not enable unfinished editing in the normal UI. Internal prototypes can be
isolated, but a public move tool must ship with Undo, save/reopen, and export.

| Phase                                         | Work and scope                                                                                                                                                                                                   | Exit gate                                                                                                                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E00 — agree the contract                      | Approve eligibility, snapping, collision/budget rules, immediate commits, history, Generate replacement/recovery, and shuffle restriction. Sketch desktop/mobile tools and audit props/groups for all four maps. | Decision table agreed; every prop classified as independent, group member, attached, or protected. No ambiguous behavior for losing edits.                                                                      |
| E01 — prove document/compatibility boundaries | Pure edited-document model, immutable IDs, resolver, initial capability catalog, move validation, draft save-format/parser roundtrip. Exercise a dungeon crate without UI.                                       | Valid authored move survives serialization; invalid/duplicate/stale references fail; combined edits validated; original generated and historical baselines exact. No public editor yet.                         |
| E02 — first complete vertical slice           | Dungeon crate selection and move; inverse transform; ghost/valid drop/cancel; keyboard alternative; session history; save/open/backup/share/thumbnail/PNG support; pin/drafts and busy-state behavior.           | One crate can move, Undo/Redo, save/reopen and export exactly. Invalid move and failed save recover. Explore remains unchanged. Can release as a clearly limited preview.                                       |
| E03 — add objects                             | Searchable map-scoped catalog, drag from catalog plus click/tap placement; crates/barrels first, then audited independent dungeon items. Stable artwork/IDs, count limits and no-fit recovery.                   | Repeated placements have distinct identity; cancel inserts nothing; density limit explained; moves/additions share history and survive all persistence paths. This is the first practical move-and-add release. |
| E04 — footprint and artwork support           | Audited multi-square objects and supported quarter turns; larger click targets, wall clearance and derived surface rendering; optional deletion/duplication as distinct commands.                                | Every occupied square checked in each orientation; invalid rotation leaves state intact; sprite/selection/PNG agree; no clipping regression or stale marks.                                                     |
| E05 — expand across map types                 | Forest/Courtyard independent props, terrain/attachment policies; Tower sheet/floor mapping, same-floor moves first, GM/player filtering and single-floor exports.                                                | Capability coverage documented by map; all navigation/visibility, per-floor budgets and player secrecy tested. Cross-floor transfers remain explicit later scope unless separately approved.                    |
| E06 — complete addition groups                | Persistent group identity and transform, internal geometry, group reservations/artwork, complete-group placement and optional catalog insertion. Begin with one group before generalizing.                       | A moved group roundtrips without pretending it is the old canonical site. Complete geometry, empty space, circulation, labels and derived artwork stay valid. Untouched additions retain frozen validation.     |
| E07 — harden and broaden                      | Responsive catalog and inspector; real touch review; memory/performance measurements; expand eligible catalog from the audit; optionally design shuffle around preserved customizations.                         | Review exact supported coverage, documented limits and measured behavior. Broader capabilities get their own gates; no claim that protected architecture is editable.                                           |

Dependencies: E00 → E01 → E02 → E03. E04–E06 build on that stable foundation;
their order can follow user value. UX and performance checks belong in every
phase, not only E07. Update this document with evidence after each completed
slice, retaining IDs. Do not mark the whole F24 goal complete after E02.

## 8. Verification strategy

For pure commands, test independent occupancy/connectivity searches, immutable
inputs, bounds, rejection and successful retry, source identity, combined edits,
full footprints, budgets, groups and protected areas. Keep test matrices small
per case so they do not repeat the previous large-matrix timeout problem.

Protect unchanged generator RNG consumption, frozen historical JSON, literal
model/pixel baselines and no-edit rendering. Add edited fixtures and independent
expected arrangements; do not regenerate old baselines to accommodate the editor.
Test unsupported formats/capabilities, malformed references and oversized input,
backup partial rejection, storage failure and cross-tab recovery.

Use focused browser flows for coordinate transforms at several zoom/pan sizes,
high-DPI behavior, pointer cancellation, invalid drop/retry, overlapping selection,
keyboard placement, undo/redo branching, type/candidate changes, pending settings,
busy export, save/reopen and exact PNGs. Include all map types as they become
eligible and Tower player/GM whole/single-floor paths. Inspect desktop, narrow
mobile and short landscape layouts, focus, disabled states and error recovery.
Do real touch testing before promising drag parity on mobile.

For each implementation slice, follow [project verification](AGENTS.md): relevant
unit tests with one worker, test typechecking, build and formatting, plus relevant
Playwright and rendered inspection. Keep browser testing focused; this plan does
not propose restoring a slow full browser suite to every push. Broader runs
belong at integration milestones, with actual coverage reported.

Measure drag responsiveness on a densely decorated map and an eight-floor Tower,
at multiple zoom levels. Record repaint/validation costs and history memory on
representative hardware before setting release performance budgets. Avoid a
hardware-independent “smooth” claim without measurements.

## 9. Original recommendation and agreed starting point

Approve or revise E00 first. The key compromises are grid snapping, protected
architecture, initial group locks, conservative blocking limits, immediate
accepted moves, and restricted shuffle while customizations exist.

Then implement E01 and E02: **move one dungeon crate, undo it, save/reopen it, and
export it correctly**. That small proof touches the hard boundaries. If it needs
unsafe casts, relaxed old validation, regenerated historical baselines, or lost
work to fit the app, stop and revise the document model before expanding the UI.
Once that is sound, the palette and wider catalog become controlled extensions.

The initial planning pass changed documentation only. The implementation below follows the approved plan; it does not mark the remaining editor milestones complete.

## 10. Delivery record: first Dungeon release

Implementation and verification date: 2 November 2026.

The approved E00 decisions are implemented: integer grid snapping, immediate
accepted commands, protected architecture/addition groups, conservative budgets,
Current-only edits, chronological per-type Undo/Redo, explicit recoverable Generate
replacement, and disabled Shuffle while customizations exist. Dungeon is the
first map adapter. Forest, Courtyard and Tower retain their existing workflows.

E01–E03 are implemented for six independent kinds: crate, barrel, rubble,
sarcophagus, broken column, and moss. The illustrated searchable catalog supports
pointer drag and click/tap placement. Existing instances can be selected on the
canvas or from a labeled dropdown, dragged, or positioned through Column/Row,
arrow controls and canvas keyboard commands. Locked objects explain their reason.
Removal is also included: generated rooms often already use their blocking budget,
so replacing blockers requires an explicit reversible removal. No other object
is removed automatically. Deleting the last authored addition/override returns
to an unedited document when no removed base IDs remain.

The immutable base is stored in the existing map fields, rather than duplicated
inside a nested base object. An optional `objectEdits` sidecar stores version 1,
position overrides, removed base IDs, added objects with stored IDs/variation,
and an ID counter. Generated types exclude this sidecar as input; renderable
views are resolved separately. This preserves the planned base-plus-state
contract with less serialization duplication. Generator versions, RNG streams,
original prop order, and unedited artwork are unchanged.

Engine responsibilities live in `src/app/engine/object-editor`: document and
instance resolution, a complete Dungeon capability audit, placement/source rules,
immutable commands, and a separate bounded authored-v1 parser. Every canonical
addition remains fixed, and its full reserve stays protected. Rug artwork has
its own protected margin. Target placement includes a conservative square of
clearance from solid walls. Added objects are capped at 120; existing import
shape bounds continue to protect the base. Eligibility is a deliberate authored
vocabulary, not inferred from which sprites happen to render.

`WorkbenchSession` remains the accepted-document owner and checks source snapshot
identity on every edit. The browser editor owns temporary interaction only.
Painting and hit testing share an inverse viewport transform and Dungeon prop
layer classification. The inspector is below the preview, and Focus editing
uses natural page height, preventing selection/tool feedback from moving the
map during dragging or covering controls on short screens. The preview reuses
its image cache and Canvas bitmap while pointer positions change.

Save format 19 freezes authored-v1 support; formats 1–18 reject edit metadata.
Library records, backup/import, individual JSON sharing, thumbnails, pinned
snapshots and PNGs carry the accepted document. SaveStore retains its existing
Web Lock, latest-read, atomic publish and recovery flow. Reset restores the exact
generated base. Generate replacement is one recoverable history boundary;
rejected/no-op actions retain history and drafts. Customized filenames and
summaries distinguish edited maps without implying that a seed can recreate them.

E04 is only partially covered by reversible removal. Rotation and multi-square
editing remain pending. E05 map expansion and E06 complete group transforms are
pending. Responsive/keyboard/touch-emulation and failure checks apply to this
Dungeon release, but E07 is not a claim of physical-touch or all-map performance
validation. The next map should receive its own capability/placement adapter,
not a copy of browser drag logic or relaxed generated-map validators.

### Verification of the Dungeon release

All **1,127 distinct unit/review cases across 87 files pass** across the full
run and focused follow-up. The full run passed 1,126 cases; one new removal test
incorrectly expected the ID counter to roll back. The corrected test independently
checks the restored visible arrangement, retained counter, parser roundtrip and
non-reuse of the next added ID. All 15 cases in that file then pass. No production
change or baseline regeneration was used for that correction. Historical model,
vector/text and pixel baselines pass, and frozen fixtures remain untouched.

All **57 distinct focused Chromium cases pass**. The complete affected set passed,
and the six editor cases were rerun after the final typed-view and accessibility
changes; two cases were rerun to capture keyboard/disabled artifacts. Coverage
includes high-DPI panned/zoomed dragging, cancellation and correction, catalog
pointer/click placement, coordinate/keyboard placement, explicit remove/replace,
inline Focus Undo/Redo, pending drafts, pins, type switching, Generate recovery,
accepted PNGs versus ghosts, save/reopen, backup re-import, Foundry-sized PNGs,
and existing generation, comparison, focus, save and Dungeon addition workflows.

A browser roundtrip exposed an actual inspector-move bug: structurally richer
coordinate targets leaked kind/variation/blocking fields into position overrides,
which the strict reader correctly rejected. A unit regression demonstrated the
failure before the command boundary was corrected to copy coordinates explicitly.
The regression and browser reopen/export flow now pass. Mobile review also exposed
controls overlapping the canvas in constrained Focus layout; natural page height
and an inspector below the map fixed the interaction instead of bypassing pointer
checks in tests.

Test typechecking, production build, application formatting, explicit formatting
of all four edited Markdown documents, local Markdown links, and whitespace
validation pass. Reviewed desktop catalog/workbench, 320 px mobile, 800 × 420
landscape, keyboard focus and disabled controls in `artifacts/object-editor/`.
The native review records local mean command-validation times of roughly
0.21–0.25 ms over 30 repetitions per catalog kind; these are sample timings with
test overhead, not browser frame-rate or low-end-device guarantees.

The full browser suite, other browser engines, physical touch hardware, live VTT
imports and all-map editor stress benchmarks were not run. These results complete
the bounded first Dungeon release, not the deferred group/multi-square/map-type
milestones.

## 11. Dungeon placement and complete additions follow-up

The first release applied generator placement heuristics too strictly to manual
editing: room-only destinations, oversized corridor reservations, a blanket
one-square wall margin, per-room distribution limits, and locked additions. Those
restrictions prevented useful moves, including a barrel onto open passage floor.
This follow-up supersedes those first-release restrictions without changing the
canonical generator or the frozen authored-v1 contract.

Authored v2 permits placement on any walkable floor, including beside walls and
inside passages. Actual doorway tiles, entrance/objective space, visual object
and rug collisions, complete-addition circulation, overall blocking limits,
full free-floor reachability, and a clear 2 × 2 area per room remain protected.
Empty circulation areas may overlap, but blocking objects cannot occupy another
addition's circulation area. No other object is removed automatically.

E06 now includes translation of Forgotten study, Weathered statue, Dining table
and Ritual site in Dungeon. Each group derives immutable base membership and a
complete reserve; saved transforms only store its stable ID and new reserve
origin. Clicking any member selects the complete addition. Dragging or inspector/
keyboard positioning moves every component with exact relative offsets and
original orientation/artwork. Independent member edits/removals are refused.
Ritual markings follow the altar; moved study surface marks use its translated
area. Standalone rugs are also movable, removable and available in the catalog,
with their full passable 3 × 3 visual footprint. Whole-addition insertion/removal,
rotation and other map adapters remain separate milestones.

Save format 20 supports authored v1 and v2; format 19 remains frozen to v1.
A new command only adopts v2 when it changes the document. No-ops/refusals retain
v1; simply opening/resaving/exporting v1 preserves old models and pixels. A new
frozen pre-change fixture, `src/app/save/fixtures/dungeon-editor-v1.json`, and four
literal pixel hashes protect old edited maps independently of the new resolver.
Only moved/added v2 objects and moved group members receive floor-fitted artwork;
untouched objects, canonical maps and v1 edits retain their original rendering.
Reset restores the original base. Existing historical baselines were not updated.

The preview announces concrete placement errors over the canvas; invalid moves
remain staged for correction without affecting accepted maps, saves or exports.
Selection distinguishes ordinary objects from complete additions. The editor is
loaded through an immediate deferred Angular block to retain the existing initial
bundle budget, with a normal-preview fallback if loading fails.

### Follow-up verification — 2 November 2026

All **1,190 distinct unit/review cases across 90 files pass** across completed
batches. The initial single run was terminated before completion. The subsequent
source batch had one existing Courtyard wagon matrix exceed its five-second
timeout during concurrent browser work; it passed in 4.43 seconds on an isolated
rerun, with no source, expectation or timeout change. Every test file is accounted
for across the completed batches. Historical fixtures and literal baselines pass.

All **55 distinct focused Chromium cases pass**: 12 editor/placement cases and
43 existing configuration, comparison, save, history and Dungeon-addition cases.
The four complete-addition tests use actual member-to-target pointer drags, then
compare accepted models, undo/redo, save/reopen and exact PNG bytes. Additional
checks cover the reported barrel passage, opposite walls, concrete refusal and
correction, standalone rugs, group identity/spoofing, overlapping empty circulation,
cross-room budget redistribution, v1 preservation/upgrades, pending settings and
stale commands. Native pixel tests bound sprites/shadows at walls and corners.

Browser checks exposed a required-input read during initialization after deferring
the editor; checking its default inactive mode before reading required inputs
fixed startup. Initial group-drag tests also reused viewport coordinates after
scrolling to inspector controls; recomputing the drag start after returning to
the canvas corrected the test gesture. All four then passed without a production
drag workaround.

Test typechecking, production build (existing bundle budget), application
formatting, explicit formatting of the four edited Markdown documents, local
Markdown links and whitespace validation pass. Reviewed wall placement, all four
moved additions, rug catalog, and 375 px mobile group controls with keyboard focus
and disabled placement in `artifacts/editor-movement/`. Other browser engines,
physical touch hardware, live VTT imports and the full browser suite were not run.

### Wall-side sprite size correction — 2 November 2026

The wall-fit checks originally proved containment but missed unwanted resizing.
New regressions compare the rendered width, height and painted area against the
ordinary sprite for nine kinds across variations, walls and corners; all nine
failed before the correction. Authored rendering now prefers full-size artwork
and the smallest inward translation onto neighboring walkable floor. It checks
whole floor rectangles, so diagonal masonry cannot become an accidental fitting
area. Only genuinely confined geometry, such as a one-square passage between
opposing walls, retains reduced fitting when the normal sprite cannot fit.

This deliberately corrects v2 artwork in previews, thumbnails and PNGs, including
existing customized maps. Coordinates, selection, movement rules, save schema
and generator versions are unchanged. Canonical/unedited and v1 rendering remain
unchanged; historical baselines were not updated.

All 54 distinct focused unit/review checks and 14 focused Chromium cases pass.
Coverage includes size plus wall containment, concave corners, confined passages,
historical model/pixel baselines, group movements, exact reset, and crate/barrel
movement between opposite walls through undo/redo, saved reopen and exact PNGs.
Reviewed the exported preview screenshots in `artifacts/editor-movement/`, along
with mobile group, keyboard and disabled states covered by the browser checks.
Test typechecking, production build and formatting pass. The full suites, other
browser engines and physical touch hardware were not rerun for this correction.

### Generated grid-anchor correction — 2 November 2026

The requested behavior is generated-style anchoring, including the existing
sprite overlap with painted wall edges. Both earlier wall-fitting attempts
misapplied a containment requirement: scaling made sprites small, and shifting
made them appear to occupy a neighboring square. Those rendering requirements
and their containment tests are superseded by this correction.

Generated props, accepted edits and placement ghosts now share `drawDungeonProp`
and the same layering. Ordinary objects draw at the center of the selected tile,
with their normal size and existing shadow/wall overlap. Existing generated
study-surface rules still apply equally to studies. The separate authored fitter,
rectangle-search helper and resolved fitted-object tracking have been removed.
Physical wall tiles, collisions, door clearance and route checks are unchanged.

This intentionally changes existing v2 preview, thumbnail and PNG artwork to
match generated anchoring. Saved coordinates/schema, generator streams and
versions are unchanged. Unedited maps and v1 saved artwork remain protected by
existing independent baselines; no baseline was regenerated. New full-map pixel
comparisons require each of the seven editable kinds to match the unedited
renderer at identical resolved wall-side coordinates, including after save/reopen.

Verification: all 49 focused unit/review checks and 14 Chromium editor cases pass,
including opposite-wall crate/barrel movement, placement previews, group moves,
undo/redo, saved reopen, exact PNG restoration, keyboard and mobile/disabled
controls. Reviewed the new crate/barrel wall-position screenshots and mobile
group controls. Build, test typechecking, application/explicit Markdown formatting,
local links and whitespace checks pass. The full suites, other browser engines
and physical touch hardware were not rerun for this correction.

## 12. Dungeon floor layering and usable additions

Authored version 3 allows physical objects on rugs, moss and empty addition floor,
including ritual markings. An explicit surface classification is shared by
occupancy, painting and hit testing; movement-passable candles, scroll cases and
offerings remain physical objects. Physical objects cannot overlap each other.
Different surface kinds may overlap, while duplicate rug/rug or moss/moss areas
are rejected. There is no height stacking or automatic attachment/grouping.

Actual architecture, floor access, a clear 2 × 2 space per room and the overall
blocking limit remain protected. Each solid object belonging to an addition must
retain an adjacent free floor tile as a usable approach. Generation-time empty
reserves no longer forbid manual objects, but moving an addition still requires
its complete reserve on walkable floor and checks every component for collisions.
The same symmetric occupancy rules apply when moving either the foreground object
or the underlying rug/addition. Loose objects never join a group by overlap.
Clicking selects the visible top object; the existing dropdown selects surfaces
or complete additions beneath it. The catalog explains the supported layering.

Save format 21 supports editing versions 1, 2 and 3. Format 20 remains frozen to
versions 1/2; their readers reject v3 rather than partially accepting layered
arrangements. Opening old documents preserves their version/rules; only a real
successful edit adopts v3. New records/backups use format 21. Generator versions,
RNG consumption, canonical models and stored artwork are unchanged. Placement
logic lives in the pure engine; persistence retains its existing Web Lock and
atomic/recoverable mutation flow.

The initial three regression cases failed before implementation: barrel-on-rug,
rug-under-barrel, and empty ritual-floor placement. Coverage now also checks old
v2 preservation/upgrade, physical-component collision, independent group/surface
movement in both directions, and approach refusal with removal/retry recovery.

Verification: all 817 focused unit/review checks across 29 files and all 16
Chromium editor cases pass. The ritual case was then rerun with the barrel
directly on the central markings. Checks include topmost selection, underlying
selection through the dropdown, exact PNG undo/reopen, explicit refusal/retry,
old-format rejection and frozen v2 preservation, generic session guards and
atomic storage/recovery. Historical model/pixel baselines pass without updates.
Reviewed barrel-on-rug and barrel-on-ritual previews plus mobile catalog,
keyboard/disabled controls. Build, test typechecking, application/explicit
Markdown formatting, local links and whitespace checks pass. The full suites,
other browser engines, physical touch hardware and live VTT imports were not run.

## 13. E04/E06: Dungeon addition rotation — 3 November 2026

Forgotten study, Weathered statue, Dining table and Ritual site support clockwise
and counterclockwise quarter-turn previews. Column and Row retain the top-left
reserved-area anchor; rectangular areas swap dimensions. Component rectangles
and every occupied tile turn together, with the table's actual two-tile footprint
following its orientation. Base prop order, variation, colours and weathering are
preserved. Four turns restore the original arrangement; Reset restores the exact
immutable base. Whole-addition insertion/removal and independent object rotation
remain outside this delivery.

`group-rotation.ts` owns the pure geometry. Proposals share that geometry with the
accepted command boundary and rendering: staged invalid turns remain visible,
can be repositioned through coordinates/arrows or a drag from the accepted group,
and never enter saves or exports. Rotate controls are native buttons, with an
announced relative angle, explicit anchor explanation and Place/Cancel controls.
Busy export cancels staging while retaining selection so disabled controls stay
visible and recover correctly. Map/read-only transitions clear selection.

The resolved drawing view carries transient artwork turns and original scene
transforms; none are serialized as canonical props. Study furniture turns without
changing palette/weathering. In-bounds papers/ink turn from their stored base
positions, while doorway wear stays architectural; covered marks are suppressed.
Ritual floor marks use the transformed centre/orientation. Candle clusters turn
while flames remain upright. Placement ghosts and accepted PNG/thumbnail/preview
painting use the same transformation and scene metadata.

Save format 22 supports authored versions 1–4. V4 group entries require a bounded
quarter-turn value even for zero-turn translations. Earlier formats retain their
frozen vocabularies and reject v4; earlier editing versions reject rotation fields.
Opening old documents retains their artwork and translation semantics; only a
real successful command adopts v4, including its study-surface transform policy.
No-op/rejected commands retain the original version and history. Canonical
validators, generator versions, RNG streams, existing fixtures and independent
historical baselines remain unchanged.

E04 now covers rotation of the existing additions, including multi-square tables,
and E06 covers complete group translation/rotation. General object rotation,
other map adapters and group insertion/removal remain separate milestones.

### Rotation verification

All **877 distinct focused unit/review cases across 31 files pass**, including
independent occupied-cell rotation, every addition/orientation, exact four-turn
and reset restoration, source immutability, preserved colours, composed study
fitting, rotated ritual centre/marks, upright candle flames, translated/rotated
layering, physical collision refusal/recovery and malformed/legacy save data.
Session cases protect pending drafts, pinned artwork, stale-source and read-only
guards, accepted history and saved reopen. Historical model/pixel baselines pass
without regeneration.

All **21 distinct focused Chromium cases pass** across the affected editor suite
and final rotation runs. Rotation checks cover staging, left/right/four-turn
cancellation, position correction, staged rotation followed by dragging, exact
undo/redo and saved PNGs, refresh/reopen, 375 px mobile controls, focus, disabled
export and failure recovery. The final visual review corrected rotation-label
contrast and distinguishes Place object instructions from drag-release feedback.
Reviewed all four native contact sheets, desktop previews and mobile controls in
`artifacts/addition-rotation/`.

Test typechecking, production build within the existing bundle budget,
application formatting, explicit formatting of the four edited Markdown files,
local Markdown links and whitespace validation pass. Full suites, other browser
engines, physical touch hardware and live VTT imports were not rerun.

## 14. Dungeon doors: independent architectural state — 3 November 2026

Doorways remain fixed architecture. Explore supports click/tap opening/closing,
hover highlighting and action titles, plus a compact Doors disclosure with a
keyboard-accessible selector and Open/Close button. Five-pixel click-versus-pan
recognition, pointer cancellation, source identity and mode/busy/read-only guards
prevent incidental toggles. Hit testing uses inverse viewport coordinates and a
minimum screen-sized tolerance, including high-DPI touch emulation. Dragging in
Explore still pans; object-editing mode cannot toggle doors.

`engine/dungeon-doors.ts` owns pure immutable state and validation. Geometry-based
IDs coalesce coincident thresholds and remain stable on retained layouts. Sparse
version-1 metadata stores only opened IDs; closing the last removes the sidecar.
Door state is independent of object edits: it does not mark a dungeon object-
customized, inhibit Shuffle or upgrade old object-edit versions. Object reset
keeps door state. The session owns accepted changes and chronological Undo/Redo;
pending drafts and pins remain separate. Shuffles and appearance generation keep
states; a new layout clears them, with history recovery when replacing open doors.

Save format 23 supports door-state version 1; formats 1–22 reject the field.
Combined door/object customizations roundtrip without losing or upgrading either
sidecar. Unknown IDs, duplicates, empty/extra/future metadata and oversized arrays
are refused. Unreadable future door data retains the existing recoverable library
write lockout. Canonical generator input excludes both sidecars. Generator rules,
RNG consumption, topology and movement validation are unchanged: closed doors are
openable connections rather than permanently blocked floor tiles.

Missing metadata uses the literal original closed-door drawing commands. Open
leaves swing into the associated room while preserving jambs and a clear central
opening. Preview, thumbnails and every PNG path use the accepted state; hover
outlines and unfinished gestures are never exported. PNG doors remain static in
other applications. The preview UI now loads with an immediate deferred block,
as the editor already did, keeping the original initial-bundle budget without
raising limits. Loading/error messages preserve Save/Export access.

### Door verification

All **977 distinct focused unit/review cases across 36 files pass** across the
complete affected run and targeted final checks. Coverage includes geometry-based
identity and coincident thresholds, bounded/future state rejection and recovery,
legacy and rotated object-edit coexistence, topology/source immutability, exact
closed/open/closed pixels, saved/backup roundtrips, pending drafts, pins, stale
commands, shuffles, appearance preservation, new-layout clearing and history.
Historical fixtures and independent pixel/model baselines pass without updates.
A final regression exposed a redundant object Reset creating a fresh door-only
snapshot; returning the original reference now preserves no-op history and door
state. The regression failed before that correction and passes afterwards.

All **51 distinct focused Chromium cases pass**, including four door cases and
existing preview, focus, comparison, settings, history, object-edit and rotation
workflows. Door cases cover opening/closing, immediate hover-action updates,
pan/cancel/edit-mode refusal, zoom/pan inverse coordinates, high-DPI touch taps,
keyboard access, readonly pins, busy/export failure recovery, pending settings,
shuffling, exact Undo/Redo PNGs and saved refresh/reopen. The initial browser
checks needed corrected existing-control locators and the camera's negative pan
direction; no production gesture workaround was used. Reviewed horizontal and
vertical native closed/open comparisons, desktop controls, zoomed artwork and
mobile/touch states in `artifacts/dungeon-doors/`.

Test typechecking, production build under the unchanged initial-bundle budget,
application/explicit Markdown formatting, local links and whitespace checks pass.
The initial build exceeded the warning budget by 913 bytes; loading Preview through
immediate deferred blocks reduced the initial bundle to about 489 kB. The affected
map-switching/focus browser cases pass after that change. The full suites, other
browser engines, physical touch hardware and live VTT imports were not run.

## 15. Explicit Dungeon drawing order — 3 November 2026

Bring forward / Send backward changes the accepted visual order across an
intersecting object or complete addition. Groups keep component identity and
internal order. Geometry, movement blocking, physical collisions, circulation,
architecture and generator streams remain unchanged. A rug can cover two boxes;
the boxes still occupy their squares. Default insertion places surfaces beneath
physical objects. Moves preserve saved priority and removal cleans references.
Reset customizations restores generated objects/order and keeps door state.

The pure drawing-order module shares ordering, overlap analysis and unit steps
across commands, drawing, picking and annotations. Existing ground/architecture/
physical-object drawing remains pixel-identical without an override. Authored v5
stores a complete instance-ID permutation or an empty default order. Save format
24 explicitly supports v5; formats 1–23 retain their frozen vocabularies. Parsing
rejects missing, duplicate, unknown, removed and oversized order references, and
permutations that rearrange protected internal addition order.
Loading older documents adds no order and preserves historical transforms and
artwork. Only an actual reorder adopts v5; ordinary placement keeps v4 unless v5
is already present. No-op and rejected commands retain their source reference.

Workbench badges always disclose overlapping authored object areas in Explore
and Edit objects. Nearby labels avoid each other and use leader lines; a Layers
disclosure provides access to crowded or offscreen overlaps. Badge activation
focuses its details region; labels include coordinates for keyboard and screen
reader users. They omit internal group overlaps; they do not imply exact
opaque-pixel coverage or cloth deformation. The badge opens a list below the
preview, with selectable underlying outlines and owning-group selection. Export
options adds Show layer indicators with counts and covered-area outlines. The
checkbox starts off on every opening; stale or failed previews cannot download.
PNG filenames distinguish annotated images. Quick PNGs and thumbnails retain the
accepted order without annotations; JSON always keeps complete object data.

### Drawing-order verification

All 1,006 distinct focused unit/native review cases across 40 files pass across
the affected runs and final targeted checks. Coverage includes rugs above two
physical objects without changed blocking, no-op source identity, removal and
insertion order, movement persistence, rotated group order, protected internal
order, strict/future save vocabularies, recovery, accepted history, stale/pinned
guards, exact saved reopen pixels and historical independent baselines. Original
fixtures and baseline hashes were not changed.

Chromium verification covers desktop and narrow high-DPI touch interaction,
keyboard focus, hidden-object outlines, topmost selection, badges after pan/zoom,
nearby-label collisions and a list fallback, exact Undo/Redo and saved refresh,
read-only pins, disabled/error recovery, prepared PNG/download parity and
obsolete annotation previews. Existing addition rotation, wall placement,
object editing, doors, Focus and export workflows were also exercised. Native
and browser images were inspected in `artifacts/dungeon-layers/`.

The checks exposed and corrected badge interception of object clicks, overlapping
mobile badges, and a native select initially disagreeing with an object selected
in Explore. Existing export tests now identify the grid checkbox by name and
check the additional annotation checkbox in keyboard traversal. An apparent
export-recovery stall was traced to the browser's native encoding schedule:
measurement showed a successful callback after 7.1 seconds, beyond the original
five-second assertion. [Chromium's encoder implementation](https://chromium.googlesource.com/chromium/src/+/lkgr/third_party/blink/renderer/core/html/canvas/canvas_async_blob_creator.cc)
uses idle work with a delayed completion fallback. PNG-readiness assertions allow
ten seconds and finish immediately on readiness; no fixed sleep, broader test
timeout, or speculative production encoder workaround was added.

All 63 distinct focused Chromium cases pass across the affected runs and final
checks, including the final 27 export/layer cases. Test typechecking, production
build within the unchanged bundle budget, application formatting, explicit
formatting of all three edited Markdown files, 43 local Markdown links and
whitespace checks pass. The full suites, other browser engines, physical touch
hardware and live VTT imports were not run.

## 16. Name underlying objects — 3 November 2026

Count-only badges did not tell users what an overlap contained. Workbench badges
now name the accepted underlying objects in the same top-to-bottom order as the
inspection list: Barrel underneath, Crate + Barrel underneath, or Barrel × 2
underneath. Large or long combinations use a compact first kind + N more; their
full named/count summary remains in the tooltip, accessible label and Layers
list. The inspection list still offers each individual object and its outline.

One pure presentation helper supplies both the workbench and opt-in PNG labels.
Label boxes measure their actual text and preserve collision avoidance and leader
lines; the narrow-screen Layers list wraps full descriptions. Only annotation
presentation changes. Saves, order, blocking, generators, and unannotated pixels
retain their previous behavior; no save-format change is needed.

Verification: the existing Chromium regression first failed with “2 underneath”
in place of the required named badge. All seven focused unit/native cases across
four files and five distinct Chromium workflows now pass, including desktop,
375-pixel high-DPI touch, keyboard focus, pan/zoom, hidden-object selection,
read-only pins, disabled/error recovery and preview/download parity. Tests cover
single and mixed kinds, duplicate counts, large/long summaries, accepted-source
immutability, actual PNG label text and original unannotated pixels. Native PNG
labels measure text at output resolution to avoid subpixel-font rounding.

Inspected desktop controls, narrow-screen named badges and wrapped Layers list,
and native annotated artwork. Test typechecking, production build within the
existing budget, formatting, local Markdown links and whitespace checks pass.
Full suites, other browsers, physical touch hardware and live VTT imports were
not rerun for this presentation change.

## 17. E05 Courtyard adapter — 3 November 2026

Courtyard joins the existing editor through shared command, group, selection and
drawing-order contracts, a read-only view dispatcher and a validated command
dispatcher. The Angular controls and viewport are shared rather than copied.
Dungeon compatibility paths and frozen placement versions remain intact.

The first Courtyard vocabulary supports independent broken columns, low rubble,
moss and ferns. Vines stay protected. Fountain translation retains its 3 × 3 body
and 5 × 5 circulation outline; rotation is unavailable. The complete wagon
translates and takes four relative quarter turns, rotating every occupied cell,
implicit sprite and original footprint without changing artwork variation. Its
crate, wheel and goods stay grouped. Neither group can be dismantled, inserted or
removed separately.

Grass and paving are equally walkable. Real walls, broad approaches and the
6 × 6 gathering space remain protected. Complete group outlines stay on open
ground, and external blocking objects cannot occupy the one-tile ring around a
fountain or wagon body. Moss and low rubble can overlap objects, or one another,
without changing blocking. Physical/physical and same-kind surface collisions
remain invalid. Every free tile must remain reachable, and all occupied blocking
cells count toward the current density budget. Traversal starts at a currently
free tile, so the top-left grass tile is not an artificial protected entrance. New surfaces start below existing
passable objects and blockers; moved objects retain their drawing priority.

Accepted edits share each map type’s chronological Undo/Redo, source/candidate
guards, drafts and read-only pins. Generate replacement is explicit and retains
a recovery snapshot; the first regression caught the old Courtyard history
branch clearing that snapshot and now passes after correcting it. Shuffle stays
unavailable until customizations are reset or undone. Saving, sharing, backup,
thumbnail and PNG paths all resolve the accepted document; temporary previews
never enter them. Named underlying-object inspection and opt-in export labels
work for both editable types. Forest and Tower remain outside E05’s completed
scope.

Save format 25 adds Courtyard edit version 1 independently of Dungeon edit
versions. The canonical base remains unchanged and is validated before strict
sidecar parsing. Unknown/future capabilities, invalid references, group component
spoofing, unsafe counters, forbidden rotations, incomplete permutations and
internal group reordering are rejected. Future edited data retains recovery and
library write lockout. Generator versions and RNG streams remain unchanged.
The new frozen courtyard-v24 fixture and independent hashes were captured from
the committed pre-editor renderer; no existing fixture or baseline was updated.

The initial build exceeded the unchanged 500 kB warning budget by 7 kB. The
library component now loads immediately after the initial render through the
existing deferred-loading pattern. A loading heading and failure message preserve
navigation and explain recovery; PNG export stays available if the chunk fails.
This brought the initial bundle below its existing budget without changing it.

Verification: 1,111 affected unit/native cases across 46 files passed, including
the independent historical model/pixel baselines, all Dungeon group rotations,
strict import rejection, failed-write recovery and session history. A focused
regression first demonstrated rejection of the top-left grass tile before the
traversal correction. Courtyard native checks compare accepted and ghost artwork
without fitting or shrinking, all wagon turns, exact saved/reopened pixels and
reset-to-original pixels.

All 61 selected Chromium workflows passed: Courtyard placement and complete
additions, named overlaps and annotated PNG parity, Dungeon editing/rotation/
doors/layers, saved-map operations, library loading/failure recovery and focus
layouts. Courtyard checks include zoom/pan, keyboard controls, 375-pixel high-DPI
touch emulation, read-only pins, drafts, disabled controls and export recovery.
Three release-build workflows also passed for library chunk loading/recovery
and Courtyard annotated export. Inspected desktop/mobile controls and native
four-turn wagon artwork. Browser tests now start an isolated server on port
4307 with HMR disabled, avoiding a stale normal development server and testing
actual deferred chunks.

Test typechecking and the production build passed within the unchanged bundle
budgets. Formatting and local Markdown targets were checked. Full suites, other
browser engines and physical touch hardware were not tested for this delivery.

## 18. Courtyard manual-placement correction — 3 November 2026

This supersedes section 17's manual approach/gathering-space and circulation
restrictions. User screenshots showed open paving rejected for moving the wagon
and fountain. The editor incorrectly reused invisible generator reservations
and required the complete group rectangle, including empty margins, to remain
clear of architecture. These are useful defaults for automatic composition but
unnecessary constraints on manual arrangement.

Manual validation now checks the actual cells occupied by each object, including
every group component. Gathering space and broad approach reservations are usable
ground; empty space inside an addition outline can contain a wall or unrelated
object. Real walls, map boundaries, physical collisions, connected free ground,
and the existing density budget still constrain placement. Surface layering and
group membership are unchanged. Help text distinguishes positioning outlines
from occupied ground.

Compatibility decision: this corrects validation of the initial Courtyard edit
contract, retaining format 25 and edit version 1. No serialized fields, object
vocabulary, transforms, canonical generator rules, RNG streams or artwork change.
Previously valid documents remain valid and load without rewriting positions.
The command and import boundaries share the corrected validator so newly accepted
placements also reopen. Dungeon's frozen editing rules remain unchanged.

Verification: six placement regressions first failed against the previous rules,
then passed after the correction. All 104 selected unit/native cases across nine
files passed, covering both additions, independent objects in approach/gathering
space, empty margins beside walls and columns, real collision/connectivity
rejection, strict imports, failed-write recovery, historical artwork and unchanged
generator composition. The long generator seed batch exceeded its timeout under
concurrent browser load; it passed when rerun alone without changing its timeout
or assertions.

All seven Courtyard Chromium workflows passed, including both additions moved
into gathering space, exact PNG save/reopen parity, invalid placement recovery,
rotation, layering, Undo/Redo, drafts/pins and mobile touch/keyboard controls.
Inspected screenshots of both corrected placements. Test typechecking, production
build, formatting, local Markdown links and whitespace checks passed. Full suites,
other browser engines and physical touch hardware were not rerun.

## 19. Courtyard foliage collision correction — 5 November 2026

The follow-up report identified the collision error, rather than walls or
reachability, as the remaining reason for rejected fountain placements. Small
ferns and fixed vines were classified as physical objects, unlike moss and flat
rubble. Their subtle artwork looked like usable ground, but any intersected
tile could reject the fountain's complete 3 × 3 footprint.

The Courtyard capability module now distinguishes decorative ground cover from
physical objects. Moss, low rubble, ferns and vines can share ground with objects
and other kinds of cover; duplicate cover of the same kind remains invalid.
Passability alone does not determine this policy: detached wagon wheels and
loose goods remain physical. Existing order and named underlying-object inspection
show covered foliage; fixed vines keep their protection against direct movement
or removal. Collision errors now name both objects and the overlapping column
and row. Physical collision, bounds, walking access and density checks remain.

Compatibility decision: this corrects collision validation within the initial
Courtyard edit contract. Format 25/edit version 1, serialized fields and supported
object vocabulary remain unchanged. Existing valid snapshots retain exact models
and artwork; the same corrected validator handles commands and imports. No
generator, RNG, rendering order or Dungeon editing rules change.

Verification: fern and vine placement regressions first reproduced the collision
error under the previous rules, then passed after correction. All 28 selected
unit/native cases across five files passed. Checks cover every tile of the
fountain footprint over a fern, both insertion orders, preserved vine identity,
named overlaps, strict save parsing, historical pixels, physical wagon pieces,
collision details and rejection/recovery.

All nine Courtyard Chromium workflows passed, including actual pointer drags
onto fern and vine tiles, visible named underlying-object badges, exact saved
and reopened documents/PNGs, gathering space, rotation, layering, drafts/pins,
keyboard and mobile touch controls. Inspected the corrected rendered placement.
Test typechecking, production build within existing budgets, formatting, local
Markdown targets and whitespace checks passed. Full suites, other browser engines
and physical touch hardware were not rerun.

## 20. E05 Forest adapter — 5 November 2026

Forest joins Dungeon and Courtyard in the shared object editor. Independent
boulders, logs, stumps, bushes, ferns, mushrooms and flowers support move/add/remove.
Trees remain fixed boundary artwork. Abandoned camp, Standing-stone circle and
Fallen ancient tree support complete-group movement and four relative quarter
turns. Stable base membership, variations, palettes and explicit trunk footprints
remain intact; implicit sprites turn at their original scale. Camp ash follows
the hearth and facing, including when the camp is manually placed on the path.
Group outlines use occupied bounds and impose no empty-space reservation.

Manual rules follow the Courtyard corrections. Ground-cover bushes, ferns,
mushrooms, flowers and fallen-tree fungi can share cells with objects and other
cover kinds; duplicate cover of the same kind remains invalid. Cover may grow
outside the clearing, preserving historical plants there. Physical camp and tree
scene components remain physical even when passable. Physical objects require
walkable ground without physical collisions. Both map-edge path entrances must
remain open and connected; every free walkable tile remains reachable and the
accepted density budget applies. The generated route and encounter reservations
are not forbidden manual space. Refusals identify actual overlapping objects and
coordinates. Empty stone-circle space can hold loose objects, which are not
adopted or dragged by the circle.

Forest and Courtyard now share arrangement sidecar types, immutable command
reduction, bounded strict parsing, instance resolution and transient sprite turns.
Each adapter supplies capabilities, grouping, locks, rotation policy, default order
and placement validation. Dungeon's frozen historical versions retain their
implementation. The common Angular editor, palette artwork directive, viewport,
layer inspection and annotation export handle all three editable types. Forest
accepted/ghost/catalog artwork uses the accepted character palette. New cover
starts below existing objects; explicit saved order remains authoritative.

Accepted-map history, drafts, stale gestures, read-only pins, Generate replacement
and Reset use existing session boundaries. Forest history retains the customized
snapshot when Generate replaces it, with Shuffle unavailable until edits are reset
or undone. Saved records, backups, library summaries, thumbnails and PNGs resolve
the accepted document; transient placements stay out of persistence and exports.
Customized Forest PNG names include the customization marker.

Compatibility decision: save format 26 adds independent Forest edit version 1,
without expanding formats 1–25. The canonical Forest snapshot remains unchanged;
strict import first validates it using the record vocabulary, then checks sidecar
identity, capabilities, complete groups, permutations, geometry and access. Unknown
versions remain recoverable under the existing library write lockout. SaveStore's
cross-tab lock and write-before-publish implementation are unchanged. Authored and
resolved Forest views are excluded from canonical generator inputs. No generator
version, RNG stream or existing fixture/pixel expectation was changed. The new
forest-editor-v25 fixture and literal model/grid-on/grid-off pixel baselines were
captured before Forest model or renderer changes, for all four characters with
all three additions. The temporary capture script was removed after capture.

Verification: all 1,237 selected unit/native cases across 54 files passed. This
includes 1,190 core editor, session, save and compatibility cases, plus native
Forest/Courtyard sprite and historical-renderer checks. Every Forest palette and
addition retains captured canonical models/grid-on/grid-off pixels; edited groups
retain native size, variations and palettes through all turns, saved reopen and
Reset. Camp preview ash matches accepted surface pixels and draws no unrelated
leaf patches. Blocking limits, real disconnected paths and retry after removal
are exercised. Future Forest edits retain recovery and write lockout; failed
writes, retries, cross-store reads and backups retain exact authored documents.

All 43 selected Chromium workflows across seven files passed. Six new Forest
workflows cover the catalog, fixed-tree restrictions, actual group drags at zoom
and pan, all turns/cancellation, drafts/pins, Generate recovery, saved/exported
pixel parity, named layers, annotated preview/download parity and 375-pixel
high-DPI touch/keyboard/disabled/error recovery. Existing Forest additions and
historical imports, Dungeon editing, Courtyard editing and responsive focus views
also pass. The old cross-map test now checks that Forest offers editing and starts
in Explore with no stale placement, replacing its obsolete no-editor assertion.
Inspected the Fey catalog, native rotated scene art, mobile named layers and pins.

Test typechecking, production build within unchanged budgets, formatting, explicit
Markdown formatting, local Markdown targets and whitespace checks passed. Existing
fixtures and dependency files remain unchanged. Full suites, other browser engines
and physical touch hardware were not run for this delivery.
Tower and independent rotation/insertion/removal of group components remain outside
this delivery.

## 21. E05 Tower adapter — 5 November 2026

Tower joins the shared editor with ten independent floor object kinds: crates,
barrels, bookshelves, desks, scroll cases, altars, candles, offerings, bedrolls and
moss. Laboratory and observatory membership is derived from canonical instances,
not kind alone, so ordinary desks and shelves remain independent. Both additions
move and take four relative quarter turns as complete groups with original
variation, size and artwork. Candle clusters turn while their flames stay upright.
Components cannot be moved, inserted or removed independently.

Editing floor scopes the object list and new insertions. A blue outline identifies
that chamber, and Focus floor frames it without changing the model or export.
Fit restores the sheet. Column and Row use whole-sheet coordinates. The shared
arrangement adapter now supports map-specific coordinate bounds; its original
40 × 30 default remains unchanged for the other types. Command-only insertion
floor intent is validated and never copied into saved props. Existing objects
stay on their accepted floor; canonical base/group overrides are also checked
against their original floor during import. Added objects are created on their
stored floor and subsequent move commands compare accepted source/target floors;
import treats their stored position as creation, without inventing command history.

Manual validation uses actual occupied tiles and visible architecture. Solid
objects cannot overlap one another; moss and bedroll surfaces can share floor
with physical objects or each other, while duplicate same-kind surfaces remain
invalid. Objects must fit on a walkable floor, keep stairs/portals and their actual
connection captions clear, retain connected free ground and respect a blocking
budget per floor. The generator's empty central encounter reserve is not forbidden
manual space. Fixed walls, floor numbers/purpose labels and connections never move.

Portal towers require Show secrets for editing so the user can see every fixed
connection. Switching to player view cancels placement and removes hidden-floor
selection choices, groups, badges, layer details, outlines and selection messages.
Common visibility helpers are used for reverse picking, inspection and exported
annotations. Player images and thumbnails omit secret objects and annotations;
GM images retain them. Annotation layout uses the real sheet dimensions. Single
floor PNGs retain the existing integer crop and visibility checks. JSON retains
the complete Tower. Floor-picker titles use the same accepted addition names as
the rendered headings.

Accepted edits use the existing source/pinned guards, independent drafts/types,
chronological Undo/Redo, explicit recoverable Generate replacement and Reset.
Customized Towers cannot shuffle until edits are reset or undone. Library
summaries and PNG names identify customized Towers. All maps now share the editor;
loading failures still retain Save/Export access and the fallback preview receives
the same player/GM visibility choice.

Compatibility decision: save format 27 adds independent Tower edit version 1.
Formats 1–26 retain their original vocabularies. The parser validates the frozen
canonical Tower first, then the bounded arrangement, references, capabilities,
complete group transforms, internal order and resolved per-floor geometry. Future
edits remain recoverable and block library writes under the existing Web Lock
policy. SaveStore mutation/publish behavior is unchanged. Authored and resolved
Towers are excluded from generator inputs, and direct canonical Tower validation
rejects editing sidecars. No generator versions, RNG streams, old fixtures or
existing pixel expectations changed. A new frozen tower-editor-v26 fixture and
independent model/vector/text baselines were captured before model/render edits
for both staircase styles at three and eight floors, with player/GM and grid modes.
The temporary capture script was removed after capture.

Verification: all 1,268 selected unit/native cases across 53 files passed, including
1,265 core editor/save/session/viewport/compatibility cases and three native Tower
review cases. Both staircase styles, three/eight-floor dimensions and all density
settings accept their canonical models. Checks exercise all ten kinds on the last
floor, independent ordinary furniture, same-floor refusals, per-floor blocking
limits, real barriers and recovery, strict references/order/future versions,
failed-write retry and recovery, and recoverable Generate/Reset history. Captured
model/vector/text baselines and existing historical fixtures remain unchanged.
Native tests compare all group turns, candle orientation, exact reopened/reset
pixels and secret-only edits/annotations omitted from player sheets and crops.

All 40 selected Chromium workflows across seven files passed: six new Tower
workflows, thirteen existing Tower/laboratory/observatory workflows and twenty-one
Dungeon/Forest/Courtyard editor regressions. Coverage includes actual zoom/pan
group dragging, turns/cancellation, large coordinates, floor selection/focus,
drafts/pins/history, secret visibility changes during placement, named inspection,
exact saved/reopened PNGs, prepared/downloaded secret-floor annotation parity,
375-pixel high-DPI touch/keyboard controls and disabled/error recovery. Inspected
desktop floor controls, native turns, focused mobile editing and read-only pins.

A local maximum-size probe used 81 generated plus 120 custom objects. It exposed
repeated reconstruction of both canonical additions for each independent selection.
Selections now reuse their already-derived group membership. The sampled median
command/proposal/selection-resolution path fell from about 10.8 ms to 0.8 ms; this
is a local diagnostic, not a device-independent frame-rate guarantee. The temporary
timing script was removed after the check.

Test typechecking, production build within unchanged budgets, formatting, explicit
Markdown formatting, local Markdown targets and whitespace checks passed. Existing
fixtures and dependency files remain unchanged. Full suites, other browser engines
and physical touch hardware were not run for this delivery.
Cross-floor transfers, independent prop rotation and group insertion/removal remain
future scope.

## 22. Tower stair landing editing (follow-up)

User requirement: stairs must be movable. Both existing staircase styles now
participate in the object list and direct selection. A physical landing moves on
its original floor; shared spiral up/down routes move together. Route identity,
letters, arrows and destination floors remain linked, and captions follow the
landing. The corresponding landing on another floor keeps its independently
chosen position. Walls, portal endpoints and floor headings remain architectural.

Sparse Tower edit version 2 records positions using canonical landing identities
(floor and original routes), without rewriting generator connections or consuming
RNG. Furniture-only edits retain version 1. Save format 28 explicitly permits
Tower versions 1 and 2; formats 1–27 retain their frozen vocabularies. Old models,
fixtures and artwork remain unchanged when merely opened, saved or exported.
Furniture commands retain moved stairs; Reset removes all customizations. Import
parses the frozen furniture grammar, then validates combined occupancy against
resolved connections, allowing objects at vacated landing sites.

Validation checks original-floor ownership, visible stair/caption bounds inside
walls, other connections, furniture, and existing per-floor movement/budget rules.
Selection, coordinate/keyboard staging, direct dragging and ghosts share accepted
stair artwork. Removal, layering and group rotation are unavailable for stairs.

Completed and verified 5 November 2026: 1,225 unit/native cases across 42 files
passed, including both staircase styles, shared up/down routes, usable vacated
landings, floor/wall/portal/object rejection and retry, strict bounded imports,
legacy Tower-v1/v2 editing without generator upgrades, failed storage/retry,
source/history/draft protection and exact reopened/Reset pixels. Existing frozen
model/vector/text baselines remain unchanged. All nine Tower Chromium workflows
passed; the three staircase desktop/mobile workflows were rerun after the final
control/copy cleanup. Inspected accepted stairs, drag ghosts, captions and mobile
controls. Test type-checking, production build, formatting and whitespace checks
passed. Full browser suite, other browser engines and physical touch hardware
were not rerun.

Stair placement correction, 6 November 2026: a screenshot showed a clear spiral
landing rejected because the editor reused padded generator clearance. A
one-route spiral reserved an extra whole row below its visible caption. Manual
object/connection checks now share the displayed stair/caption bounds, including
route-count-dependent height and portal bounds. The rule is shared by movement,
furniture insertion and import; returning the last moved stair to furniture-only
version 1 cannot revive the invisible padding. Generation, RNG, saved grammars,
canonical models and historical pixels are unchanged. Regression tests first
reproduced the rejected clear position, then cover both staircase styles,
nearby furniture outside the boundary, actual overlap rejection, return to
original, and import. Verification: 36 focused unit/native checks passed, including
unchanged historical model/pixel baselines. Nine Tower Chromium workflows passed
in the full run, including the new clear-ground regression and mobile controls;
the remaining floor-focus workflow passed on rerun after replacing an immediate
zoom read with a retrying assertion. Inspected the focused, valid placement beside
a barrel. Test type-checking, build and formatting passed. Full browser suite and
other browser engines were not rerun.

Curved-wall correction, 6 November 2026: a second screenshot exposed the stair
wall check requiring every touched tile to belong to the center-sampled walkable
mask. That mask conservatively excludes partial cells near the circular wall,
rejecting an outline entirely inside the room. Stair placement now checks its
full visible outline against the circular inside edge of the wall stroke.
`engine/tower-geometry.ts` shares the circle center, radius and stroke width with
the renderer, so wall validation and drawing cannot drift independently. The
generator tile mask, RNG, saved grammar, canonical models and old artwork remain
unchanged. Regression tests first failed at the reported clear edge position,
then cover left/right edges, single/shared captions, three floor locations and
both stair styles, along with genuine wall-crossing refusal. Verification: 44
focused unit/native tests and all 12 Tower Chromium workflows passed, including
keyboard placement, rejection/recovery, save/reopen and PNG parity, and mobile
placement. Inspected desktop and mobile edge-placement screenshots. Test
type-checking, production build, formatting and whitespace checks passed. The
full browser suite and other browser engines were not rerun.

Ground-moss correction, 6 November 2026: the next reported screenshot exposed
a different rejection: the ground moss clipping the proposed stair outline was
being treated as a physical connection obstacle. Connection clearance now allows
moss below stairs, portals and route captions in either command order, while
retaining clearance for bedrolls and other physical objects. Refusals identify
the object, floor and coordinates. This is a placement-validation relaxation;
the saved vocabulary, canonical generator, RNG, renderer and old artwork are
unchanged. Regression tests reproduce the failure before the fix and cover both
stair styles, moss at the outline edge/body/caption, both command orders, physical
refusal, correction and import. Verification: all 46 focused unit/native tests
passed, including historical model/pixel baselines (the editor suite passed on
rerun after replacing its old moss-refusal expectation). All 12 existing Tower
Chromium workflows passed; both new moss/collision workflows passed after
correcting a test fixture whose crate initially overlapped the original spiral
landing. The new workflows verify keyboard commit, named physical refusal,
correction, unchanged accepted exports, and exact saved/reopened PNGs. Inspected
both staircase screenshots. Test type-checking, production build, application
formatting, Markdown formatting and whitespace checks passed. The full browser
suite and other browser engines were not rerun.

Compound-footprint correction, 6 November 2026: the crate at column 13, row 10
in the next screenshot exposed the structural cause of another false collision.
The caption width was applied to the entire staircase rectangle, reserving
empty space beside the circular body. Reproduced that rejection before fixing it.
Stair/portal clearance now uses separate physical body and caption shapes: a
stroked circle for spirals/portals and a narrow rectangle for separate stairs,
plus their existing caption rectangles. Body geometry and captions are shared
with the renderer. Selection, picking and placement overlays use these same
shapes; broad bounds remain only for extents and coordinate controls. Wall tests
also check each shape independently. Decorative shadows do not reserve space.
This relaxes false-positive placement checks without changing artwork, canonical
generation, RNG, saved vocabularies or sidecar versions. Regressions cover the
reported crate position, both edit orders, caption refusal, compound picking,
curved-wall placement and both stair styles. Verification: all 52 focused
unit/native tests and all 15 Tower Chromium workflows passed. The new browser
regression covers the reported crate cell, accurate pointer selection beside
stairs, caption refusal/recovery, keyboard placement, saved/reopened PNG parity
and mobile layout. Inspected desktop and mobile compound outlines. Historical
model, vector-pixel and text baselines remain unchanged. Test type-checking,
production build, application/Markdown formatting and whitespace checks passed.
The full application browser suite and other browser engines were not rerun.
