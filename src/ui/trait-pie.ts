/**
 * 行動特性の分布を円グラフで直接編集するUI
 * sociability / avoidance / curiosity の3分割。境界をドラッグして変更。
 */

const TAU = Math.PI * 2;
const MIN_SEG = 0.05;

export type TraitDistribution = [number, number, number];

const LABELS: [string, string, string] = ['社交性', '回避', '好奇心'];
const COLORS = ['#c4a035', '#8a7040', '#7cb342'];

function clampProportions(p: TraitDistribution): TraitDistribution {
  const q: TraitDistribution = [...p];
  const sum = q[0] + q[1] + q[2];
  if (sum <= 0) return [1 / 3, 1 / 3, 1 / 3];
  q[0] = Math.max(MIN_SEG, Math.min(1 - 2 * MIN_SEG, q[0] / sum));
  q[1] = Math.max(MIN_SEG, Math.min(1 - 2 * MIN_SEG, q[1] / sum));
  q[2] = 1 - q[0] - q[1];
  return q;
}

function angleFromPoint(cx: number, cy: number, x: number, y: number): number {
  let a = Math.atan2(x - cx, cy - y);
  if (a < 0) a += TAU;
  return a;
}

function pointFromAngle(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  return {
    x: cx + r * Math.sin(angle),
    y: cy - r * Math.cos(angle),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = pointFromAngle(cx, cy, r, startAngle);
  const end = pointFromAngle(cx, cy, r, endAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

export function createTraitPie(
  container: HTMLElement,
  initial: TraitDistribution = [1 / 3, 1 / 3, 1 / 3],
  onChange: (p: TraitDistribution) => void
): () => TraitDistribution {
  let p: TraitDistribution = clampProportions(initial);
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 58;
  const handleR = 8;

  const wrap = document.createElement('div');
  wrap.className = 'trait-pie-wrap';
  const labelEl = document.createElement('div');
  labelEl.className = 'trait-pie-label';
  labelEl.textContent = '行動特性の分布（ドラッグで変更）';
  wrap.appendChild(labelEl);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'trait-pie-svg');
  svg.style.width = '140px';
  svg.style.height = '140px';

  const seg0 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  seg0.setAttribute('fill', COLORS[0]);
  seg0.setAttribute('stroke', 'rgba(0,0,0,0.2)');
  seg0.setAttribute('stroke-width', '1');
  const seg1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  seg1.setAttribute('fill', COLORS[1]);
  seg1.setAttribute('stroke', 'rgba(0,0,0,0.2)');
  seg1.setAttribute('stroke-width', '1');
  const seg2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  seg2.setAttribute('fill', COLORS[2]);
  seg2.setAttribute('stroke', 'rgba(0,0,0,0.2)');
  seg2.setAttribute('stroke-width', '1');

  const handle1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  handle1.setAttribute('r', String(handleR));
  handle1.setAttribute('fill', 'var(--text-color, #e8e0c8)');
  handle1.setAttribute('stroke', 'var(--border, #4a4538)');
  handle1.setAttribute('stroke-width', '2');
  handle1.setAttribute('class', 'trait-pie-handle');
  handle1.style.cursor = 'grab';
  const handle2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  handle2.setAttribute('r', String(handleR));
  handle2.setAttribute('fill', 'var(--text-color, #e8e0c8)');
  handle2.setAttribute('stroke', 'var(--border, #4a4538)');
  handle2.setAttribute('stroke-width', '2');
  handle2.setAttribute('class', 'trait-pie-handle');
  handle2.style.cursor = 'grab';

  const legend = document.createElement('div');
  legend.className = 'trait-pie-legend';
  const legendItems: HTMLElement[] = [];
  for (let i = 0; i < 3; i++) {
    const item = document.createElement('div');
    item.className = 'trait-pie-legend-item';
    item.innerHTML = `<span class="trait-pie-dot" style="background:${COLORS[i]}"></span><span class="trait-pie-name">${LABELS[i]}</span><span class="trait-pie-pct">0%</span>`;
    legend.appendChild(item);
    legendItems.push(item);
  }

  function redraw(): void {
    const a0 = p[0] * TAU;
    const a1 = p[1] * TAU;
    seg0.setAttribute('d', describeArc(cx, cy, r, 0, a0));
    seg1.setAttribute('d', describeArc(cx, cy, r, a0, a0 + a1));
    seg2.setAttribute('d', describeArc(cx, cy, r, a0 + a1, TAU));
    const h1 = pointFromAngle(cx, cy, r, a0);
    const h2 = pointFromAngle(cx, cy, r, a0 + a1);
    handle1.setAttribute('cx', String(h1.x));
    handle1.setAttribute('cy', String(h1.y));
    handle2.setAttribute('cx', String(h2.x));
    handle2.setAttribute('cy', String(h2.y));
    for (let i = 0; i < 3; i++) {
      const pct = legendItems[i].querySelector('.trait-pie-pct');
      if (pct) pct.textContent = `${Math.round(p[i] * 100)}%`;
    }
  }

  function setP(newP: TraitDistribution): void {
    p = clampProportions(newP);
    redraw();
    onChange(p);
  }

  svg.appendChild(seg0);
  svg.appendChild(seg1);
  svg.appendChild(seg2);
  svg.appendChild(handle1);
  svg.appendChild(handle2);
  wrap.appendChild(svg);
  wrap.appendChild(legend);
  container.appendChild(wrap);

  redraw();

  let dragging: 1 | 2 | null = null;

  function getAngleFromClient(clientX: number, clientY: number): number {
    const rect = svg.getBoundingClientRect();
    const scale = size / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    return angleFromPoint(cx, cy, x, y);
  }

  function onMove(ev: MouseEvent): void {
    if (dragging === null) return;
    const angle = getAngleFromClient(ev.clientX, ev.clientY);
    const minA = MIN_SEG * TAU;
    if (dragging === 1) {
      const a0 = Math.max(minA, Math.min(TAU - 2 * minA, angle));
      const a1Max = TAU - a0 - minA;
      const a1 = Math.max(minA, Math.min(a1Max, p[1] * TAU));
      p = [a0 / TAU, a1 / TAU, 1 - a0 / TAU - a1 / TAU];
    } else {
      const a0 = p[0] * TAU;
      const a1 = Math.max(minA, Math.min(TAU - a0 - minA, angle - a0));
      if (a1 < 0) return;
      p = [a0 / TAU, a1 / TAU, 1 - a0 / TAU - a1 / TAU];
    }
    p = clampProportions(p);
    redraw();
    onChange(p);
  }

  function onUp(): void {
    dragging = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    handle1.style.cursor = 'grab';
    handle2.style.cursor = 'grab';
  }

  handle1.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    dragging = 1;
    handle1.style.cursor = 'grabbing';
    handle2.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  handle2.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    dragging = 2;
    handle1.style.cursor = 'grabbing';
    handle2.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  svg.addEventListener('touchstart', (ev) => {
    ev.preventDefault();
    if (ev.touches.length !== 1) return;
    const rect = svg.getBoundingClientRect();
    const scale = size / rect.width;
    const x = (ev.touches[0].clientX - rect.left) * scale;
    const y = (ev.touches[0].clientY - rect.top) * scale;
    const angle = angleFromPoint(cx, cy, x, y);
    const a0 = p[0] * TAU;
    const dist1 = Math.abs(angle - a0);
    const dist2 = Math.abs(angle - (a0 + p[1] * TAU));
    if (dist1 < dist2) dragging = 1;
    else dragging = 2;
  }, { passive: false });
  svg.addEventListener('touchmove', (ev) => {
    if (ev.touches.length !== 1 || dragging === null) return;
    const t = ev.touches[0];
    const angle = getAngleFromClient(t.clientX, t.clientY);
    const minA = MIN_SEG * TAU;
    if (dragging === 1) {
      const a0 = Math.max(minA, Math.min(TAU - 2 * minA, angle));
      const a1 = Math.max(minA, Math.min(TAU - a0 - minA, p[1] * TAU));
      p = [a0 / TAU, a1 / TAU, 1 - a0 / TAU - a1 / TAU];
    } else {
      const a0 = p[0] * TAU;
      const a1 = Math.max(minA, Math.min(TAU - a0 - minA, angle - a0));
      p = [a0 / TAU, a1 / TAU, 1 - a0 / TAU - a1 / TAU];
    }
    p = clampProportions(p);
    redraw();
    onChange(p);
  }, { passive: false });
  svg.addEventListener('touchend', () => { dragging = null; });

  return () => [...p];
}
