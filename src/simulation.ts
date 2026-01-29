/**
 * シミュレーションエンジン v1.2
 * メッセージ生成・受信者再解釈・AI/人間処理・重要度更新
 */

import {
  type RunConfig,
  type HumanAgent,
  type MessageData,
  type ProcessData,
  type TimelineEvent,
  type ImportanceDelta,
  type RunSummary,
  type ImportanceEdge,
  type NodeBehaviorState,
  HUMAN_REPLY_PROB,
  type SenderInternal,
} from './types';
import { createRng, clamp, normal } from './rng';

export interface SimState {
  config: RunConfig;
  humans: Map<string, HumanAgent>;
  /** I[from][to] = importance (0..1) */
  I: Map<string, Map<string, number>>;
  /** bond[from][to] = 親密さ (0..1) */
  bond: Map<string, Map<string, number>>;
  /** ノード行動状態 v2.0 */
  behavior: Map<string, NodeBehaviorState>;
  /** prune_flag[h][x] = true なら送信候補から除外 */
  prune_flag: Map<string, Set<string>>;
  /** ignore_history[a][b] = 直近の無視発生ステップ t のリスト（prune判定用） */
  ignore_history: Map<string, Map<string, number[]>>;
  rng: () => number;
  t: number;
  messageCounter: number;
  timeline: { t: number; events: TimelineEvent[] }[];
  summary: RunSummary;
}

function getI(state: SimState, from: string, to: string): number {
  return state.I.get(from)?.get(to) ?? 0;
}

function setI(state: SimState, from: string, to: string, v: number): void {
  let row = state.I.get(from);
  if (!row) {
    row = new Map();
    state.I.set(from, row);
  }
  row.set(to, clamp(v, 0, 1));
}

function getBond(state: SimState, from: string, to: string): number {
  return state.bond.get(from)?.get(to) ?? 0;
}

function setBond(state: SimState, from: string, to: string, v: number): void {
  let row = state.bond.get(from);
  if (!row) {
    row = new Map();
    state.bond.set(from, row);
  }
  row.set(to, clamp(v, 0, 1));
}

function getBehavior(state: SimState, id: string): NodeBehaviorState {
  return state.behavior.get(id)!;
}

function isPruned(state: SimState, from: string, to: string): boolean {
  return state.prune_flag.get(from)?.has(to) ?? false;
}

function recordIgnore(state: SimState, from: string, to: string): void {
  let row = state.ignore_history.get(from);
  if (!row) {
    row = new Map();
    state.ignore_history.set(from, row);
  }
  let list = row.get(to);
  if (!list) {
    list = [];
    row.set(to, list);
  }
  list.push(state.t);
  const cutoff = state.t - state.config.prune_window_steps;
  while (list.length > 0 && list[0] < cutoff) list.shift();
}

const defaultBehavior = (): NodeBehaviorState => ({
  perceived_social_health: 0.5,
  real_social_health: 0.5,
  broadcast_tendency: 0.5,
  direct_tendency: 0.5,
  prune_tendency: 0.5,
});

export function createInitialState(
  config: RunConfig,
  humans: HumanAgent[],
  initialEdges: ImportanceEdge[],
  seed: number
): SimState {
  const humanMap = new Map(humans.map((h) => [h.id, h]));
  const I = new Map<string, Map<string, number>>();
  const bond = new Map<string, Map<string, number>>();
  const behavior = new Map<string, NodeBehaviorState>();
  const prune_flag = new Map<string, Set<string>>();
  const ignore_history = new Map<string, Map<string, number[]>>();
  const stub = {
    config,
    humans: humanMap,
    I,
    bond,
    behavior,
    prune_flag,
    ignore_history,
    rng: () => 0,
    t: 0,
    messageCounter: 0,
    timeline: [],
    summary: createEmptySummary(config.steps),
  };
  for (const h of humans) {
    I.set(h.id, new Map());
    bond.set(h.id, new Map());
    behavior.set(h.id, defaultBehavior());
    prune_flag.set(h.id, new Set());
    ignore_history.set(h.id, new Map());
  }
  for (const e of initialEdges) {
    setI(stub as SimState, e.from, e.to, e.value);
    setBond(stub as SimState, e.from, e.to, e.value * 0.5 + 0.2);
  }
  const state: SimState = {
    ...stub,
    rng: createRng(seed),
  };
  return state;
}

function createEmptySummary(steps: number): RunSummary {
  return {
    steps,
    messages_total: 0,
    replies_total: 0,
    replies_by_human: 0,
    replies_by_ai: 0,
    ignores_by_human: 0,
    direct_human_human_replies: 0,
    ai_processed_ratio: 0,
    weak_ties_count: 0,
    weak_ties_pruned: 0,
    bond_mean: 0,
  };
}

/** 1ステップ実行：発信数は Poisson(messages_per_step_mean) で決定 */
export function step(state: SimState): void {
  const { config, humans, rng } = state;
  const humanIds = Array.from(humans.keys());
  const events: TimelineEvent[] = [];
  const deltasThisStep: ImportanceDelta[] = [];

  // bond 減衰（忘却）
  for (const from of state.bond.keys()) {
    const row = state.bond.get(from)!;
    for (const to of row.keys()) {
      row.set(to, clamp((row.get(to) ?? 0) * config.bond_decay, 0, 1));
    }
  }

  const numMessages = poisson(rng, config.messages_per_step_mean);
  for (let i = 0; i < numMessages; i++) {
    const senderId = humanIds[Math.floor(rng() * humanIds.length)];
    const row = state.I.get(senderId);
    const bh = getBehavior(state, senderId);
    const pDiffuse = clamp(0.5 + 0.4 * bh.broadcast_tendency - 0.3 * bh.direct_tendency, 0, 1);
    const kindLo: 'DIRECT' | 'DIFFUSE' = rng() < pDiffuse ? 'DIFFUSE' : 'DIRECT';

    let candidates = humanIds.filter((id) => id !== senderId && !isPruned(state, senderId, id));
    if (candidates.length === 0) candidates = humanIds.filter((id) => id !== senderId);
    if (candidates.length === 0) continue;

    let targets: string[];
    if (kindLo === 'DIRECT') {
      const k = Math.min(config.direct_k, candidates.length);
      const weights = candidates.map(
        (id) => 0.7 * getI(state, senderId, id) + 0.3 * getBond(state, senderId, id) + 0.01
      );
      targets = [];
      const pool = [...candidates];
      const w = [...weights];
      for (let j = 0; j < k; j++) {
        const idx = weightedIndex(rng, w);
        if (idx >= 0) {
          targets.push(pool[idx]);
          pool.splice(idx, 1);
          w.splice(idx, 1);
        }
      }
    } else {
      targets = candidates.filter((id) => (row?.get(id) ?? 0) >= config.diffuse_threshold);
    }
    if (targets.length === 0) targets = [candidates[Math.floor(rng() * candidates.length)]];

    // 各ターゲットごとにメッセージ生成（レベルは I[sender][target] から）
    for (const targetId of targets) {
      const importance = getI(state, senderId, targetId);
      const levelRaw = normal(rng, 5 * Math.max(0.01, importance), config.level_sigma);
      const levelSent = Math.round(clamp(levelRaw, 0, 5));

      const receiver = humans.get(targetId)!;
      const I_receiver_sender = getI(state, targetId, senderId);
      const levelReceived = Math.round(
        clamp(
          levelSent +
            config.reinterpret_alpha * (I_receiver_sender - 0.5) * 2,
          0,
          5
        )
      );

      const msgId = `m_${String(state.t).padStart(6, '0')}_${String(++state.messageCounter).padStart(3, '0')}`;
      const senderInternal: SenderInternal = { actor: 'HUMAN', origin_human: senderId };
      const messageData: MessageData = {
        id: msgId,
        t: state.t,
        sender_display: senderId,
        sender_internal: senderInternal,
        kind_hi: 'HUMAN',
        kind_lo: kindLo,
        targets: [targetId],
        level_sent: levelSent,
        level_received: levelReceived,
      };
      events.push({ kind: 'message', data: messageData });
      state.summary.messages_total++;

      const delegateThreshold = receiver.ai_delegate_threshold;
      const processedBy = levelReceived <= delegateThreshold ? 'AI' : 'HUMAN';

      if (processedBy === 'AI') {
        const beta = config.ai_reply_beta;
        const replyLevel = Math.round(
          clamp(beta * levelReceived + (1 - beta) * 3, 0, 5)
        );
        const replySenderInternal: SenderInternal = {
          actor: 'AI',
          origin_human: targetId,
        };
        const processData: ProcessData = {
          message_id: msgId,
          t: state.t,
          receiver: targetId,
          processed_by: 'AI',
          action: 'REPLY',
          reply: {
            sender_display: targetId,
            sender_internal: replySenderInternal,
            kind_hi: 'AI',
            kind_lo: 'DIRECT',
            targets: [senderId],
            reply_level: replyLevel,
          },
        };
        events.push({ kind: 'process', data: processData });
        state.summary.replies_total++;
        state.summary.replies_by_ai++;

        setI(state, senderId, targetId, getI(state, senderId, targetId) + config.delta_reply_ai);
        deltasThisStep.push({
          from: senderId,
          to: targetId,
          delta: config.delta_reply_ai,
          reason: 'AI_REPLY',
        });
        const wP = config.w_perceived_reply * (1 + replyLevel / 5);
        const wR = config.w_real_reply_ai * (1 + replyLevel / 5);
        const wB = config.w_bond_ai * (replyLevel / 5);
        const ba = getBehavior(state, senderId);
        ba.perceived_social_health = clamp(ba.perceived_social_health + wP, 0, 1);
        ba.real_social_health = clamp(ba.real_social_health + wR, 0, 1);
        setBond(state, senderId, targetId, getBond(state, senderId, targetId) + wB);
        const bb = getBehavior(state, targetId);
        bb.direct_tendency = clamp(bb.direct_tendency + config.w_delegate_direct, 0, 1);
        bb.broadcast_tendency = clamp(bb.broadcast_tendency + config.w_delegate_broadcast, 0, 1);
        bb.prune_tendency = clamp(bb.prune_tendency + config.w_delegate_prune, 0, 1);
        bb.perceived_social_health = clamp(bb.perceived_social_health + config.w_delegate_perceived, 0, 1);
      } else {
        const prob = HUMAN_REPLY_PROB[levelReceived] ?? 0.5;
        const action = rng() < prob ? 'REPLY' : 'IGNORE';
        const processData: ProcessData = {
          message_id: msgId,
          t: state.t,
          receiver: targetId,
          processed_by: 'HUMAN',
          action,
        };
        events.push({ kind: 'process', data: processData });

        if (action === 'REPLY') {
          state.summary.replies_total++;
          state.summary.replies_by_human++;
          state.summary.direct_human_human_replies++;

          setI(state, senderId, targetId, getI(state, senderId, targetId) + config.delta_reply_human);
          deltasThisStep.push({
            from: senderId,
            to: targetId,
            delta: config.delta_reply_human,
            reason: 'HUMAN_REPLY',
          });
          const replyLevel = levelReceived;
          const wP = config.w_perceived_reply * (1 + replyLevel / 5);
          const wR = config.w_real_reply_human * (1 + replyLevel / 5);
          const wB = config.w_bond_human * (replyLevel / 5);
          const ba = getBehavior(state, senderId);
          ba.perceived_social_health = clamp(ba.perceived_social_health + wP, 0, 1);
          ba.real_social_health = clamp(ba.real_social_health + wR, 0, 1);
          setBond(state, senderId, targetId, getBond(state, senderId, targetId) + wB);
        } else {
          state.summary.ignores_by_human++;
          setI(state, senderId, targetId, getI(state, senderId, targetId) - config.delta_ignore_human);
          deltasThisStep.push({
            from: senderId,
            to: targetId,
            delta: -config.delta_ignore_human,
            reason: 'HUMAN_IGNORE',
          });
          const ba = getBehavior(state, senderId);
          ba.perceived_social_health = clamp(ba.perceived_social_health - config.w_ignore, 0, 1);
          ba.real_social_health = clamp(ba.real_social_health - config.w_ignore, 0, 1);
          setBond(state, senderId, targetId, getBond(state, senderId, targetId) - 0.02);
          recordIgnore(state, senderId, targetId);
          const list = state.ignore_history.get(senderId)?.get(targetId) ?? [];
          if (
            getI(state, senderId, targetId) < config.weak_tie_threshold &&
            list.length >= config.prune_ignore_count_threshold
          ) {
            state.prune_flag.get(senderId)!.add(targetId);
          }
        }
      }

      if (kindLo === 'DIFFUSE') {
        setI(state, senderId, targetId, getI(state, senderId, targetId) - config.delta_spam);
        deltasThisStep.push({
          from: senderId,
          to: targetId,
          delta: -config.delta_spam,
          reason: 'DIFFUSE_SPAM',
        });
      }
    }
  }

  const processedCount = state.summary.replies_by_ai + state.summary.replies_by_human + state.summary.ignores_by_human;
  if (processedCount > 0) {
    state.summary.ai_processed_ratio =
      state.summary.replies_by_ai / (state.summary.replies_by_ai + state.summary.replies_by_human + state.summary.ignores_by_human);
  }

  let weakCount = 0;
  let prunedCount = 0;
  let bondSum = 0;
  let bondN = 0;
  const wt = config.weak_tie_threshold;
  for (const from of state.I.keys()) {
    const row = state.I.get(from)!;
    const pruned = state.prune_flag.get(from)!;
    for (const to of row.keys()) {
      const iVal = row.get(to) ?? 0;
      if (iVal > 0.01 && iVal < wt) weakCount++;
      if (pruned.has(to)) prunedCount++;
      const b = getBond(state, from, to);
      if (b > 0.01) {
        bondSum += b;
        bondN++;
      }
    }
  }
  state.summary.weak_ties_count = weakCount;
  state.summary.weak_ties_pruned = prunedCount;
  state.summary.bond_mean = bondN > 0 ? bondSum / bondN : 0;

  events.push({
    kind: 'update_importance',
    data: { t: state.t, deltas: deltasThisStep },
  });
  state.timeline.push({ t: state.t, events });
  state.t++;
}

function poisson(rng: () => number, lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

function weightedIndex(rng: () => number, weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

export function getImportanceEdges(state: SimState): ImportanceEdge[] {
  const out: ImportanceEdge[] = [];
  for (const [from, row] of state.I) {
    for (const [to, value] of row) {
      if (value > 0.01) out.push({ from, to, value });
    }
  }
  return out;
}
