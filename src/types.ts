/**
 * 実装要件 v1.2 - 型定義（run.json スキーマ 1.2.0 準拠）
 */

export const SCHEMA_VERSION = '1.2.0';

export type ActorType = 'HUMAN' | 'AI';
export type KindLo = 'DIRECT' | 'DIFFUSE';
export type ActionType = 'REPLY' | 'IGNORE';

/** 人間返信確率（level' → 確率） */
export const HUMAN_REPLY_PROB: Record<number, number> = {
  0: 0.00, 1: 0.10, 2: 0.25, 3: 0.45, 4: 0.70, 5: 0.90,
};

export interface Traits {
  sociability: number;
  avoidance: number;
  curiosity: number;
  [key: string]: number;
}

export interface HumanAgent {
  id: string;
  type: number;
  traits: Traits;
  ai_delegate_threshold: number;
  ai_strength: number;
}

export interface SenderInternal {
  actor: ActorType;
  origin_human?: string;
}

export interface MessageData {
  id: string;
  t: number;
  sender_display: string;
  sender_internal: SenderInternal;
  kind_hi: ActorType;
  kind_lo: KindLo;
  targets: string[];
  level_sent: number;
  level_received: number;
}

export interface ProcessData {
  message_id: string;
  t: number;
  receiver: string;
  processed_by: ActorType;
  action: ActionType | 'REPLY';
  reply?: {
    sender_display: string;
    sender_internal: SenderInternal;
    kind_hi: ActorType;
    kind_lo: KindLo;
    targets: string[];
    reply_level: number;
  };
}

export interface ImportanceDelta {
  from: string;
  to: string;
  delta: number;
  reason: 'HUMAN_REPLY' | 'AI_REPLY' | 'HUMAN_IGNORE' | 'DIFFUSE_SPAM';
}

export interface TimelineEvent {
  kind: 'message' | 'process' | 'update_importance';
  data: MessageData | ProcessData | { t: number; deltas: ImportanceDelta[] };
}

export interface StepFrame {
  t: number;
  events: TimelineEvent[];
}

/** ノード行動変化 v2.0：各ノードが持つ状態 */
export interface NodeBehaviorState {
  perceived_social_health: number;
  real_social_health: number;
  broadcast_tendency: number;
  direct_tendency: number;
  prune_tendency: number;
}

export interface RunConfig {
  N: number;
  K: number;
  diffuse_threshold: number;
  direct_k: number;
  level_sigma: number;
  reinterpret_alpha: number;
  ai_delegate_threshold_mode: string;
  ai_delegate_threshold_default: number;
  ai_reply_beta: number;
  delta_reply_human: number;
  delta_reply_ai: number;
  delta_ignore_human: number;
  delta_spam: number;
  steps: number;
  messages_per_step_mean: number;
  weak_tie_threshold: number;
  prune_ignore_count_threshold: number;
  prune_window_steps: number;
  bond_decay: number;
  w_perceived_reply: number;
  w_real_reply_human: number;
  w_real_reply_ai: number;
  w_bond_human: number;
  w_bond_ai: number;
  w_ignore: number;
  w_delegate_direct: number;
  w_delegate_broadcast: number;
  w_delegate_prune: number;
  w_delegate_perceived: number;
}

export interface RunAgents {
  humans: HumanAgent[];
}

export interface ImportanceEdge {
  from: string;
  to: string;
  value: number;
}

export interface RunSummary {
  steps: number;
  messages_total: number;
  replies_total: number;
  replies_by_human: number;
  replies_by_ai: number;
  ignores_by_human: number;
  direct_human_human_replies: number;
  ai_processed_ratio: number;
  weak_ties_count: number;
  weak_ties_pruned: number;
  bond_mean: number;
}

export interface RunExport {
  schema_version: string;
  run_id: string;
  seed: number;
  config: RunConfig;
  agents: RunAgents;
  initial_state: { importance_edges: ImportanceEdge[] };
  timeline: StepFrame[];
  summary: RunSummary;
}
