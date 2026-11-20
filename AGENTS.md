# Project instructions

## Scope and references

- Read [README.md](README.md) for product behavior, architecture, save compatibility,
  and verification details. Inspect `package.json` and the lockfile for the current
  toolchain; keep version numbers and test counts out of these instructions.
- When assigned a review item, read its evidence and acceptance criteria in the
  relevant review document. Implement the selected item without treating the rest
  of the backlog as authorized work. Mark it complete only after verification,
  retaining its identifier and adding a short verification note.
- Keep dependency upgrades and unrelated refactors separate from focused fixes.
- Whenever adding an object, update the [README object list](README.md#object-list)
  in the same change. Record its map availability and whether it is independently
  placeable, generated, or part of a complete addition. Keep existing entries
  accurate when objects are removed or their availability or editing support changes.

## Behavior and architecture

- Preserve the configure-then-generate workflow, retained maps and drafts per map
  type, and the separation between editable drafts and accepted settings. Saves,
  exports, and immediate detail shuffles use the accepted map and settings.
- Keep `src/app/engine` pure TypeScript without Angular or browser dependencies.
  `WorkbenchSession` owns accepted maps and drafts; `SaveStore` owns persistence;
  preview and browser utilities own their browser interactions. Keep domain
  operations as plain functions where no service lifecycle is needed.
- Preserve deterministic models, artwork, RNG consumption, and caller-owned inputs
  during refactors. Changes to generator behavior or supported save vocabularies
  require an explicit compatibility decision, documented and tested.
- Support only the current save format and current generator versions. Reject
  unsupported records explicitly; do not migrate or normalize historical maps.
  Retain current-version validation, deterministic model/pixel baselines, and
  save/load round-trip tests. Investigate failures before changing expectations.
- Preserve library mutations under the shared cross-tab Web Lock: read the latest
  storage inside the lock, apply the command, persist, then publish state. Failed
  writes must leave stored and visible maps unchanged. Unreadable stored data must
  remain recoverable rather than being silently discarded by a later mutation.

## Verification

- Use npm and the existing lockfile, test runners, and scripts. For application
  changes, run relevant tests, `npm run typecheck:tests`, `npm run build`, and
  `npm run format:check`. Run unit tests with `--maxWorkers=1` to avoid competing
  native canvas workloads, for example `npm test -- --maxWorkers=1`.
- Add focused regression tests for behavioral fixes, including rejection and
  recovery where relevant. Where practical, demonstrate failure before the fix.
  Use relevant Playwright tests through `npm run test:e2e` for browser behavior.
- For UI changes, inspect the rendered result and relevant responsive, keyboard
  focus, and disabled states. Report browser coverage and any checks not performed.
- Documentation-only changes need documentation validation, not an application
  rebuild. Explicitly check edited Markdown files outside the format script's
  scope. Report only checks actually run; repeat checks only when new changes or
  unresolved concerns warrant it.

## Final response and Git

After every completed solution, include the following in the final chat response:

- A suggested Git branch name.
- A suggested commit message.
- A ready-to-paste PR title and description. Describe the concrete problem, resulting
  behavior, relevant validation, and any material limitations. Report only checks
  actually run, distinguishing failures or skipped checks from passes.

Write these suggestions out for the user; do not run Git commands to create the
branch or commit unless the user explicitly requests it. Never create or submit
pull requests; the user handles PR creation.
