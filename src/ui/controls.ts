/**
 * UI: スライダー・トグル・seed・Run/Export/スクショ（サイドバー禁止＝インライン）
 */

import type { RunConfig } from '../types';
import type { TraitDistribution } from './trait-pie';
import { createTraitPie } from './trait-pie';

export interface ControlValues {
  diffuse_threshold: number;
  level_sigma: number;
  reinterpret_alpha: number;
  ai_delegate_threshold_default: number;
  ai_reply_beta: number;
  ai_strength_offset: number;
  seed: number;
  steps: number;
  messages_per_step_mean: number;
  traitDistribution: TraitDistribution;
}

export interface ControlsCallbacks {
  onRun: () => void;
  onExport: () => void;
  onScreenshot: () => void;
  onModeToggle: (showOverlay: boolean) => void;
}

const SLIDER_SPEC: { key: keyof ControlValues; label: string; min: number; max: number; step: number }[] = [
  { key: 'diffuse_threshold', label: 'diffuse_threshold', min: 0.3, max: 0.9, step: 0.05 },
  { key: 'level_sigma', label: 'σ (レベル分布)', min: 0.2, max: 1.5, step: 0.1 },
  { key: 'reinterpret_alpha', label: 'α (再解釈)', min: 0.2, max: 2, step: 0.1 },
  { key: 'ai_delegate_threshold_default', label: 'AI委譲閾値', min: 0, max: 5, step: 1 },
  { key: 'ai_reply_beta', label: 'β (AI返信)', min: 0.2, max: 0.9, step: 0.1 },
  { key: 'seed', label: 'seed', min: 1, max: 999999, step: 1 },
  { key: 'steps', label: 'ステップ数', min: 50, max: 500, step: 50 },
  { key: 'messages_per_step_mean', label: '発信頻度', min: 0.5, max: 3, step: 0.1 },
];

export function createControls(
  container: HTMLElement,
  initial: Partial<ControlValues>,
  callbacks: ControlsCallbacks
): () => ControlValues {
  container.innerHTML = '';
  container.className = 'controls-bar';

  const values: ControlValues = {
    diffuse_threshold: 0.6,
    level_sigma: 0.8,
    reinterpret_alpha: 1.0,
    ai_delegate_threshold_default: 2,
    ai_reply_beta: 0.5,
    ai_strength_offset: 0,
    seed: Math.floor(Math.random() * 900000) + 10000,
    steps: 300,
    messages_per_step_mean: 1.2,
    traitDistribution: initial.traitDistribution ?? [1 / 3, 1 / 3, 1 / 3],
    ...initial,
  };

  const top = document.createElement('div');
  top.className = 'controls-top';
  const left = document.createElement('div');
  left.className = 'controls-sliders';
  const slidersWrap = document.createElement('div');
  slidersWrap.className = 'controls-sliders-wrap';

  for (const spec of SLIDER_SPEC) {
    const row = document.createElement('div');
    row.className = 'control-row';
    const label = document.createElement('label');
    label.textContent = spec.label;
    const input = document.createElement('input');
    input.type = spec.key === 'seed' ? 'number' : 'range';
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    const v = values[spec.key] as number;
    input.value = String(v);
    const valSpan = document.createElement('span');
    valSpan.className = 'control-value';
    valSpan.textContent = String(v);
    input.addEventListener('input', () => {
      const num = spec.key === 'seed' ? parseInt(input.value, 10) : parseFloat(input.value);
      (values as any)[spec.key] = num;
      valSpan.textContent = String(num);
    });
    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(valSpan);
    slidersWrap.appendChild(row);
  }
  left.appendChild(slidersWrap);

  const pieWrap = document.createElement('div');
  pieWrap.className = 'trait-pie-section';
  const getTraitPieValues = createTraitPie(
    pieWrap,
    values.traitDistribution,
    (p) => { values.traitDistribution = p; }
  );
  left.appendChild(pieWrap);

  const actions = document.createElement('div');
  actions.className = 'controls-actions';
  const runBtn = document.createElement('button');
  runBtn.className = 'btn btn-run';
  runBtn.textContent = 'Run';
  runBtn.addEventListener('click', callbacks.onRun);
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn-export';
  exportBtn.textContent = 'Export JSON';
  exportBtn.addEventListener('click', callbacks.onExport);
  const screenBtn = document.createElement('button');
  screenBtn.className = 'btn btn-screenshot';
  screenBtn.textContent = 'Screenshot';
  screenBtn.addEventListener('click', callbacks.onScreenshot);
  actions.appendChild(runBtn);
  actions.appendChild(exportBtn);
  actions.appendChild(screenBtn);

  const modeWrap = document.createElement('div');
  modeWrap.className = 'controls-mode';
  const modeLabel = document.createElement('span');
  modeLabel.textContent = '表示: ';
  const modeToggle = document.createElement('button');
  modeToggle.className = 'btn btn-toggle';
  modeToggle.textContent = '表面';
  let showOverlay = false;
  modeToggle.addEventListener('click', () => {
    showOverlay = !showOverlay;
    modeToggle.textContent = showOverlay ? '裏側（AI/人間の区別）' : '表面';
    callbacks.onModeToggle(showOverlay);
  });
  modeWrap.appendChild(modeLabel);
  modeWrap.appendChild(modeToggle);

  top.appendChild(left);
  top.appendChild(actions);
  top.appendChild(modeWrap);
  container.appendChild(top);

  return () => ({ ...values, traitDistribution: getTraitPieValues() });
}
