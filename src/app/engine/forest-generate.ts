import { GENERATOR_VERSION } from './model';
import { nextDetailRevision } from './decoration-revision';
import type {
  Density,
  ForestCharacter,
  ForestClearing,
  ForestGenerationResult,
  ForestLayout,
  ForestSettings,
} from './model';
import { Random, streamSeed } from './random';
import { carvePath, createClearing, oppositeEdge, pointOnEdge } from './forest-layout';
import type { Edge } from './forest-layout';
import { decorateForest } from './forest-decoration';
import { validateForest, validateForestLayout, validateForestSettings } from './forest-validation';

export interface ForestLimits {
  readonly retries: number;
}

const DEFAULT_LIMITS: ForestLimits = { retries: 16 };

export function generateForestClearing(
  settings: ForestSettings,
  limits: ForestLimits = DEFAULT_LIMITS,
): ForestGenerationResult {
  const settingsError = validateForestSettings(settings);
  if (settingsError) return { ok: false, error: settingsError };
  if (!Number.isInteger(limits.retries) || limits.retries < 1 || limits.retries > 16)
    return { ok: false, error: 'Generation limits must allow 1–16 retries.' };

  const seed = settings.seed.trim();
  for (let retry = 0; retry < limits.retries; retry++) {
    const random = new Random(streamSeed(seed, 'forest-layout', retry));

    const { tiles: clearingTiles, center } = createClearing(random);

    const allEdges: readonly Edge[] = ['north', 'south', 'east', 'west'];
    const startEdge = allEdges[random.int(0, 3)] ?? 'south';
    const endCandidates = allEdges.filter((e) => e !== startEdge);
    const endEdge =
      endCandidates[random.int(0, endCandidates.length - 1)] ?? oppositeEdge(startEdge);

    const pathStart = pointOnEdge(startEdge, random);
    const pathEnd = pointOnEdge(endEdge, random);

    const tiles = clearingTiles;
    const route = carvePath(tiles, pathStart, pathEnd, center, random);

    const layout: ForestLayout = { tiles, route, pathStart, pathEnd };

    if (!validateForestLayout(layout)) continue;

    const map: ForestClearing = {
      type: 'forest',
      version: GENERATOR_VERSION,
      seed,
      layout,
      surfaceSeed: streamSeed(seed, 'surface'),
      decoration: decorateForest(layout, seed, settings.character, settings.density, 0),
    };

    const error = validateForest(map);
    if (!error) return { ok: true, map };
  }

  return {
    ok: false,
    error:
      'Could not generate a connected forest clearing within the generation limit. Try another seed or different density.',
  };
}

export function shuffleForestDetails(map: ForestClearing): ForestClearing {
  const revision = nextDetailRevision(map.decoration.revision);
  const decoration = decorateForest(
    map.layout,
    map.seed,
    map.decoration.character,
    map.decoration.density,
    revision,
  );
  const updated: ForestClearing = { ...map, decoration };
  const error = validateForest(updated);
  if (error) return map;
  return updated;
}

export function changeForestDensity(map: ForestClearing, density: Density): ForestClearing {
  const decoration = decorateForest(
    map.layout,
    map.seed,
    map.decoration.character,
    density,
    map.decoration.revision,
  );
  const updated: ForestClearing = { ...map, decoration };
  const error = validateForest(updated);
  if (error) return map;
  return updated;
}

export function changeForestCharacter(
  map: ForestClearing,
  character: ForestCharacter,
): ForestClearing {
  const decoration = decorateForest(
    map.layout,
    map.seed,
    character,
    map.decoration.density,
    map.decoration.revision,
  );
  const updated: ForestClearing = { ...map, decoration };
  const error = validateForest(updated);
  if (error) return map;
  return updated;
}
