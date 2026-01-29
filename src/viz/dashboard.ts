/**
 * G2: 処理の委譲率ダッシュボード
 * Total Messages, Replies, Human/AI Reply, Ignores, Direct Human↔Human, AI processed %
 */

import type { RunSummary } from '../types';

export function renderDashboard(container: HTMLElement, summary: RunSummary): void {
  const totalProcessed = summary.replies_by_ai + summary.replies_by_human + summary.ignores_by_human;
  const aiRatio = totalProcessed > 0 ? (summary.replies_by_ai / totalProcessed) * 100 : 0;

  container.innerHTML = '';
  container.className = 'dashboard-panel';

  const grid = document.createElement('div');
  grid.className = 'dashboard-grid';

  const items: { label: string; value: string | number; highlight?: boolean }[] = [
    { label: 'Total Messages', value: summary.messages_total },
    { label: 'Replies (Total)', value: summary.replies_total },
    { label: 'Replies by Human', value: summary.replies_by_human },
    { label: 'Replies by AI', value: summary.replies_by_ai, highlight: true },
    { label: 'Human Ignores', value: summary.ignores_by_human },
    { label: 'Direct Human↔Human', value: summary.direct_human_human_replies, highlight: true },
    { label: 'AI Processed %', value: `${aiRatio.toFixed(1)}%`, highlight: true },
    { label: 'Weak Ties Count', value: summary.weak_ties_count ?? 0, highlight: true },
    { label: 'Weak Ties Pruned', value: summary.weak_ties_pruned ?? 0, highlight: true },
    { label: 'Bond Mean', value: ((summary.bond_mean ?? 0) * 100).toFixed(1) + '%', highlight: true },
  ];

  for (const it of items) {
    const cell = document.createElement('div');
    cell.className = 'dashboard-cell' + (it.highlight ? ' dashboard-cell--highlight' : '');
    const label = document.createElement('div');
    label.className = 'dashboard-label';
    label.textContent = it.label;
    const value = document.createElement('div');
    value.className = 'dashboard-value';
    value.textContent = String(it.value);
    cell.appendChild(label);
    cell.appendChild(value);
    grid.appendChild(cell);
  }

  container.appendChild(grid);
}
