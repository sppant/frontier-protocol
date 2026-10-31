import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useMemo, useRef } from 'react';
import { FACTION_IDS, FACTIONS } from '@/domain/factions';
import { prefersReducedMotion } from '@/render/webgl';
import { score } from '@/sim/victory';
import { useGameStore } from '@/store/gameStore';
import styles from './ScoreChart.module.css';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const MUTED = '#8896a8';
const GRID = '#243040';

/** Standings over time. Loaded lazily so ECharts stays out of the main bundle. */
export default function ScoreChart() {
  const game = useGameStore((s) => s.game);
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  // History snapshots plus the live standing, so the line always reaches "now".
  const points = useMemo(() => {
    const last = game.history.at(-1);
    const live =
      last?.tick === game.tick
        ? []
        : [
            {
              tick: game.tick,
              scores: Object.fromEntries(FACTION_IDS.map((f) => [f, score(game, f)])),
            },
          ];
    return [...game.history, ...live];
  }, [game]);

  useEffect(() => {
    const el = host.current;
    // jsdom and some locked-down browsers have no 2D canvas: fall back to the text summary.
    if (!el || !document.createElement('canvas').getContext('2d')) return;
    const c = echarts.init(el, undefined, { renderer: 'canvas' });
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(
      {
        animation: !prefersReducedMotion(),
        grid: { left: 36, right: 8, top: 24, bottom: 24 },
        textStyle: { color: MUTED, fontSize: 11 },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#121820',
          borderColor: GRID,
          textStyle: { color: '#e8edf3' },
        },
        legend: { top: 0, textStyle: { color: MUTED, fontSize: 10 }, itemWidth: 10, itemHeight: 6 },
        xAxis: {
          type: 'category',
          data: points.map((p) => `D${p.tick}`),
          axisLine: { lineStyle: { color: GRID } },
          axisLabel: { color: MUTED },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: GRID } },
          axisLabel: { color: MUTED },
        },
        series: FACTION_IDS.map((f) => ({
          name: f === game.playerFaction ? `${FACTIONS[f].name} (you)` : FACTIONS[f].name,
          type: 'line',
          showSymbol: false,
          smooth: false,
          lineStyle: { color: FACTIONS[f].color, width: f === game.playerFaction ? 3 : 1.5 },
          itemStyle: { color: FACTIONS[f].color },
          data: points.map((p) => p.scores[f]),
        })),
      },
      { notMerge: true },
    );
  }, [points, game.playerFaction]);

  const now = points.at(-1);
  const summary = now
    ? FACTION_IDS.map((f) => `${FACTIONS[f].name} ${now.scores[f]}`).join(', ')
    : 'No data yet';

  return (
    <div className={styles.wrap}>
      <div
        ref={host}
        className={styles.chart}
        role="img"
        aria-label={`Score over time. Latest: ${summary}.`}
      />
    </div>
  );
}
