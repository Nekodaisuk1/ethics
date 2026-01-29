/**
 * 情報交換＝人間関係 シミュレーター v1.2
 * 単一画面・サイドバーなし・レトログラフィック
 */

import './style.css';
import { DEFAULT_CONFIG } from './config';
import type { RunConfig, HumanAgent, ImportanceEdge, TimelineEvent, MessageData, ProcessData } from './types';
import { createInitialState, step, getImportanceEdges } from './simulation';
import { generateAgents, generateImportanceEdges } from './initialState';
import { buildRunExport, downloadRunJson } from './exportRun';
import { NetworkViz } from './viz/network';
import { renderDashboard } from './viz/dashboard';
import { renderLineChart, type TimeSeriesPoint } from './viz/chart';
import { createControls, type ControlValues } from './ui/controls';

const N = 30;
const K = 4;

function buildConfig(cv: ControlValues): RunConfig {
  return {
    ...DEFAULT_CONFIG,
    N,
    K,
    diffuse_threshold: cv.diffuse_threshold,
    level_sigma: cv.level_sigma,
    reinterpret_alpha: cv.reinterpret_alpha,
    ai_delegate_threshold_default: cv.ai_delegate_threshold_default,
    ai_reply_beta: cv.ai_reply_beta,
    delta_reply_human: 0.03,
    delta_reply_ai: 0.01,
    delta_ignore_human: 0.04,
    delta_spam: 0.01,
    steps: cv.steps,
    messages_per_step_mean: cv.messages_per_step_mean,
  };
}

function main(): void {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = '';
  app.className = 'app';

  const header = document.createElement('header');
  header.className = 'header';
  const title = document.createElement('h1');
  title.className = 'title';
  title.textContent = '情報交換＝人間関係';
  const subtitle = document.createElement('p');
  subtitle.className = 'subtitle';
  subtitle.textContent =
    '「受信・無視・処理」をAIに委譲できる社会で、関係はどう変質するか。';
  header.appendChild(title);
  header.appendChild(subtitle);
  app.appendChild(header);

  const controlsEl = document.createElement('div');
  controlsEl.className = 'controls-container';
  app.appendChild(controlsEl);

  const mainArea = document.createElement('div');
  mainArea.className = 'main-area';
  const networkContainer = document.createElement('div');
  networkContainer.className = 'network-container';
  const dashboardContainer = document.createElement('div');
  dashboardContainer.className = 'dashboard-container';
  const chartContainer = document.createElement('div');
  chartContainer.className = 'chart-container';
  mainArea.appendChild(networkContainer);
  mainArea.appendChild(dashboardContainer);
  mainArea.appendChild(chartContainer);
  app.appendChild(mainArea);

  let state: ReturnType<typeof createInitialState> | null = null;
  let networkViz: NetworkViz | null = null;
  let timeSeries: TimeSeriesPoint[] = [];
  let runId = '';
  let seed = 0;
  let intervalId = 0;
  let initialEdgesForExport: ImportanceEdge[] = [];

  const getControlValues = createControls(
    controlsEl,
    {},
    {
      onRun() {
        if (intervalId) clearInterval(intervalId);
        const cv = getControlValues();
        seed = cv.seed;
        const config = buildConfig(cv);
        const humans = generateAgents(config, seed);
        const initialEdges = generateImportanceEdges(humans, config, seed);
        initialEdgesForExport = initialEdges;
        state = createInitialState(config, humans, initialEdges, seed);
        runId = `${new Date().toISOString()}__seed_${seed}`;
        timeSeries = [];

        const nodes: { id: string; agent?: HumanAgent }[] = humans.map((h) => ({ id: h.id, agent: h }));
        const links: { source: string; target: string; value: number }[] = initialEdges.map((e) => ({
          source: e.from,
          target: e.to,
          value: e.value,
        }));

        const width = networkContainer.clientWidth || 900;
        const height = Math.min(500, window.innerHeight - 320);
        if (!networkViz) {
          networkViz = new NetworkViz({
            width,
            height,
            container: networkContainer,
          });
          networkViz.init(nodes as any, links as any);
        } else {
          networkViz.setDimensions(width, height);
          networkViz.updateLinks(initialEdges);
        }

        let stepIndex = 0;
        const stepsPerFrame = 2;
        const tick = () => {
          for (let i = 0; i < stepsPerFrame && state!.t < state!.config.steps; i++) {
            step(state!);
            const frame = state!.timeline[state!.timeline.length - 1];
            if (frame) {
              for (const ev of frame.events) {
                if (ev.kind === 'message') {
                  const m = ev.data as MessageData;
                  const to = m.targets[0];
                  if (to && networkViz) {
                    networkViz.addParticle(
                      m.sender_display,
                      to,
                      m.kind_lo,
                      'HUMAN',
                      false
                    );
                  }
                } else if (ev.kind === 'process') {
                  const p = ev.data as ProcessData;
                  if (p.action === 'REPLY' && p.reply && networkViz) {
                    networkViz.addParticle(
                      p.receiver,
                      p.reply.targets[0],
                      p.reply.kind_lo,
                      p.processed_by,
                      true
                    );
                  }
                }
              }
            }
            timeSeries.push({
              t: state!.t,
              humanHuman: state!.summary.direct_human_human_replies,
              aiReply: state!.summary.replies_by_ai,
            });
          }

          if (state!.t >= state!.config.steps) {
            clearInterval(intervalId);
            intervalId = 0;
          }

          const edges = getImportanceEdges(state!);
          if (networkViz) {
            networkViz.updateLinks(edges);
            networkViz.updateNodeBehaviors(state!.behavior);
          }
          renderDashboard(dashboardContainer, state!.summary);
          if (timeSeries.length >= 2) {
            renderLineChart(chartContainer, timeSeries, {
              width: chartContainer.clientWidth || 400,
              height: 180,
            });
          }
        };

        intervalId = window.setInterval(tick, 50);
        let particleRunning = true;
        const particleLoop = () => {
          if (networkViz) networkViz.tickParticles(0.016);
          if (particleRunning) requestAnimationFrame(particleLoop);
        };
        requestAnimationFrame(particleLoop);
        const stopParticles = () => {
          particleRunning = false;
        };
        setTimeout(stopParticles, (state!.config.steps / stepsPerFrame) * 50 + 2000);
      },
      onExport() {
        if (!state) return;
        const cv = getControlValues();
        const config = buildConfig(cv);
        const agents = { humans: Array.from(state.humans.values()) };
        const exportData = buildRunExport(
          runId || `run_${Date.now()}`,
          seed || cv.seed,
          config,
          agents,
          initialEdgesForExport,
          state
        );
        downloadRunJson(exportData);
      },
      onScreenshot() {
        const wrap = document.querySelector('.network-wrap');
        const canvasEl = wrap?.querySelector('canvas') as HTMLCanvasElement;
        if (canvasEl) {
          const a = document.createElement('a');
          a.download = `screenshot_${Date.now()}.png`;
          a.href = canvasEl.toDataURL('image/png');
          a.click();
        } else {
          document.body.style.background = '#1a1810';
          setTimeout(() => {
            (window as any).__screenshotHint = true;
            alert('ネットワーク領域のキャプチャは Run 実行後に Canvas を右クリックで保存できます。');
          }, 0);
        }
      },
      onModeToggle(showOverlay: boolean) {
        if (networkViz) networkViz.setShowOverlay(showOverlay);
      },
    }
  );

  renderDashboard(dashboardContainer, {
    steps: 0,
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
  });
}

main();
