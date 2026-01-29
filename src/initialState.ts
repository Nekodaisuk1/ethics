/**
 * 初期状態生成：N人・K分類・重要度行列（分類×特性から生成）
 */

import type { HumanAgent, Traits, RunConfig, ImportanceEdge } from './types';
import { createRng, clamp } from './rng';

export function generateAgents(config: RunConfig, seed: number): HumanAgent[] {
  const rng = createRng(seed);
  const humans: HumanAgent[] = [];
  const N = config.N;
  const K = config.K;
  const defaultThreshold = config.ai_delegate_threshold_default;

  for (let i = 0; i < N; i++) {
    const id = `h${String(i).padStart(2, '0')}`;
    const type = i % K;
    const traits: Traits = {
      sociability: rng(),
      avoidance: rng(),
      curiosity: rng(),
    };
    const ai_delegate_threshold = Math.round(clamp(defaultThreshold + (rng() - 0.5) * 2, 0, 5));
    const ai_strength = 0.3 + rng() * 0.7;
    humans.push({
      id,
      type,
      traits,
      ai_delegate_threshold,
      ai_strength,
    });
  }
  return humans;
}

/** 重要度 I[a][b] を「分類の近さ × 特性の相性」で初期化（疎にするため閾値以上のみ） */
export function generateImportanceEdges(
  humans: HumanAgent[],
  config: RunConfig,
  seed: number
): ImportanceEdge[] {
  const rng = createRng(seed + 1);
  const edges: ImportanceEdge[] = [];
  const K = config.K;

  for (const a of humans) {
    for (const b of humans) {
      if (a.id === b.id) continue;
      const typeAffinity = 1 - Math.abs(a.type - b.type) / K;
      const traitAffinity =
        (1 - Math.abs(a.traits.sociability - b.traits.sociability)) * 0.5 +
        (1 - Math.abs(a.traits.curiosity - b.traits.curiosity)) * 0.5;
      const base = (typeAffinity * 0.4 + traitAffinity * 0.6) * (0.7 + rng() * 0.3);
      const value = clamp(base, 0, 1);
      if (value >= 0.15) edges.push({ from: a.id, to: b.id, value });
    }
  }
  return edges;
}
