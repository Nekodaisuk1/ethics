/**
 * run.json スキーマ v1.2.0 で1実行分をエクスポート
 */

import { SCHEMA_VERSION, type RunExport, type RunConfig, type RunAgents, type ImportanceEdge } from './types';
import type { SimState } from './simulation';

export function buildRunExport(
  runId: string,
  seed: number,
  config: RunConfig,
  agents: RunAgents,
  initialEdges: ImportanceEdge[],
  state: SimState
): RunExport {
  const totalProcessed =
    state.summary.replies_by_ai + state.summary.replies_by_human + state.summary.ignores_by_human;
  const aiRatio = totalProcessed > 0 ? state.summary.replies_by_ai / totalProcessed : 0;

  return {
    schema_version: SCHEMA_VERSION,
    run_id: runId,
    seed,
    config: { ...config },
    agents: { humans: [...agents.humans] },
    initial_state: { importance_edges: [...initialEdges] },
    timeline: state.timeline.map((f) => ({
      t: f.t,
      events: f.events.map((e) => ({ ...e })),
    })),
    summary: {
      ...state.summary,
      ai_processed_ratio: aiRatio,
    },
  };
}

export function downloadRunJson(data: RunExport, filename?: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `run_${data.run_id.replace(/[:+]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
