/**
 * G3: 関係の「実体」が消えていく可視化
 * 直接返信（Human→Human）と AI 代理返信の累積を時間で折れ線
 */

import * as d3 from 'd3';

export interface TimeSeriesPoint {
  t: number;
  humanHuman: number;
  aiReply: number;
}

export interface ChartOptions {
  width: number;
  height: number;
  container: HTMLElement;
}

export function renderLineChart(
  container: HTMLElement,
  data: TimeSeriesPoint[],
  options: { width: number; height: number }
): void {
  container.innerHTML = '';
  const { width, height } = options;
  const margin = { top: 16, right: 24, bottom: 28, left: 44 };

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'chart-svg');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.t) as [number, number])
    .range([0, innerWidth]);

  const maxVal = Math.max(
    ...data.map((d) => d.humanHuman),
    ...data.map((d) => d.aiReply),
    1
  );
  const yScale = d3.scaleLinear().domain([0, maxVal]).range([innerHeight, 0]);

  const lineHuman = d3
    .line<TimeSeriesPoint>()
    .x((d) => xScale(d.t))
    .y((d) => yScale(d.humanHuman));
  const lineAi = d3
    .line<TimeSeriesPoint>()
    .x((d) => xScale(d.t))
    .y((d) => yScale(d.aiReply));

  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', 'var(--chart-human-color, #7cb342)')
    .attr('stroke-width', 2)
    .attr('d', lineHuman);

  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', 'var(--chart-ai-color, #ef5350)')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4,2')
    .attr('d', lineAi);

  const xAxis = d3.axisBottom(xScale).ticks(6);
  const yAxis = d3.axisLeft(yScale).ticks(5);
  g.append('g').attr('transform', `translate(0,${innerHeight})`).call(xAxis).attr('class', 'chart-axis');
  g.append('g').call(yAxis).attr('class', 'chart-axis');

  const legend = svg.append('g').attr('transform', `translate(${margin.left}, 0)`);
  legend.append('line').attr('x1', 0).attr('x2', 16).attr('y1', 6).attr('y2', 6).attr('stroke', 'var(--chart-human-color, #7cb342)').attr('stroke-width', 2);
  legend.append('text').attr('x', 20).attr('y', 9).attr('font-size', '10px').attr('fill', 'var(--text-color)').text('Human↔Human');
  legend.append('line').attr('x1', 100).attr('x2', 116).attr('y1', 6).attr('y2', 6).attr('stroke', 'var(--chart-ai-color, #ef5350)').attr('stroke-width', 2).attr('stroke-dasharray', '4,2');
  legend.append('text').attr('x', 120).attr('y', 9).attr('font-size', '10px').attr('fill', 'var(--text-color)').text('AI Reply');
}
