import { createSeparatedDataset, centroid, objective, squaredDistance, assignToPrototypes, assignedCentroids } from './math.mjs';
import { PrototypePlot, MiniHistory, format } from './learning-plots.mjs';

const $ = id => document.getElementById(id);
const initialSingle = { x: 2.6, y: 5.7 };
let seed = 20260930;
let points = createSeparatedDataset(seed);
let mean = centroid(points);
let baseline = objective(points, mean);
const initialPair = () => [{ x: mean.x - 0.45, y: mean.y + 0.3 }, { x: mean.x + 0.45, y: mean.y - 0.3 }];
let initialCenters = initialPair();
const gapHistory = new MiniHistory($('gap-history'), objective(points, initialSingle));
const pairHistory = new MiniHistory($('pair-history'), assignToPrototypes(points, initialCenters).loss);
let updateCount = 0;
const announce = message => { $('separated-announcement').textContent = message; };

function syncCoordinates(prefix, point) {
  for (const axis of ['x', 'y']) {
    $(prefix + '-' + axis).value = point[axis];
    $(prefix + '-' + axis + '-value').textContent = format(point[axis]);
    $(prefix + '-' + axis).setAttribute('aria-valuetext', format(point[axis]));
  }
}
function renderGap(result, moved) {
  $('gap-loss').textContent = format(result.loss);
  syncCoordinates('gap', gapPlot.centers[0]);
  if (moved) gapHistory.record(result.loss);
  const revealed = $('gap-show-mean').checked;
  gapPlot.showMean(mean, revealed);
  gapHistory.draw(revealed ? baseline : null);
  $('gap-result').toggleAttribute('hidden', !revealed);
  $('gap-history-key').toggleAttribute('hidden', !revealed);
  $('gap-mean-position').textContent = `(${format(mean.x)}, ${format(mean.y)})`;
  $('gap-minimum').textContent = format(baseline);
  $('gap-nearest').textContent = format(Math.sqrt(Math.min(...points.map(p => squaredDistance(p, mean)))));
  const atMean = squaredDistance(gapPlot.centers[0], mean) < 1e-20;
  $('gap-status').textContent = atMean
    ? '誤差は最小になりました。でも、この点は左右のデータのない間にあります。'
    : revealed ? 'ピンクのひし形が全体の重心。どちらのまとまりの中にもありません。' : '左右のまとまりの間にも、置いてみよう。';
}
function syncPairSelection() {
  syncCoordinates('pair', pairPlot.centers[pairPlot.selected]);
  [0, 1].forEach(j => $('pair-select-' + (j + 1)).setAttribute('aria-pressed', String(j === pairPlot.selected)));
}
function renderPair(result, moved) {
  $('pair-loss').textContent = format(result.loss);
  $('pair-baseline').textContent = format(baseline);
  const percent = 100 * (baseline - result.loss) / baseline;
  $('pair-improvement').textContent = Math.abs(percent) < 0.05 ? '1個の最小値とほぼ同じ' : `1個の最小値より ${Math.abs(percent).toFixed(1)}% ${percent >= 0 ? '小さい' : '大きい'}`;
  $('pair-improvement').setAttribute('data-lower', String(percent >= 0));
  [0, 1].forEach(j => $('pair-count-' + (j + 1)).textContent = result.counts[j]);
  syncPairSelection();
  if (moved) pairHistory.record(result.loss);
  pairHistory.draw(baseline);
  const empty = result.counts.findIndex(count => count === 0);
  $('pair-status').textContent = empty >= 0
    ? `代表点${empty + 1}の担当は0個です。別のまとまりへ動かしてみよう。重心更新では、この点はその位置に残ります。`
    : updateCount > 0 ? `${updateCount} 回の重心更新。データの担当が変わったら、もう一度更新してみよう。` : '1個ずつ、左右のまとまりへ動かしてみよう。';
}

const gapPlot = new PrototypePlot($('gap-plot'), {
  points, centers: [initialSingle], onChange: renderGap,
  onFinish: () => announce(`1個の代表点の2乗誤差は ${$('gap-loss').textContent}。`),
});
const pairPlot = new PrototypePlot($('pair-plot'), {
  points, centers: initialCenters, colored: true, onChange: renderPair, onSelect: syncPairSelection,
  onFinish: () => announce(`2個の代表点の2乗誤差は ${$('pair-loss').textContent}。`),
});
renderGap(gapPlot.draw(), false);
renderPair(pairPlot.draw(), false);

for (const [prefix, plot] of [['gap', gapPlot], ['pair', pairPlot]]) {
  for (const axis of ['x', 'y']) {
    $(prefix + '-' + axis).addEventListener('input', event => {
      plot.cancelMotion();
      plot.move(plot.selected, { ...plot.centers[plot.selected], [axis]: Number(event.target.value) });
    });
    $(prefix + '-' + axis).addEventListener('change', () => plot.onFinish());
  }
}
$('gap-show-mean').addEventListener('change', () => renderGap(gapPlot.draw(), false));
$('gap-to-mean').addEventListener('click', () => {
  $('gap-show-mean').checked = true;
  gapPlot.animateTo([mean], () => announce('誤差が最小になる全体の重心へ移動しました。左右の分布の間にあり、ここにデータはありません。'));
});
$('gap-reset').addEventListener('click', () => { gapPlot.cancelMotion(); gapPlot.setCenters([initialSingle]); });
$('gap-clear-history').addEventListener('click', () => { gapPlot.cancelMotion(); gapHistory.reset(objective(points, gapPlot.centers[0])); renderGap(gapPlot.draw(), false); });
$('pair-clear-history').addEventListener('click', () => { pairPlot.cancelMotion(); pairHistory.reset(assignToPrototypes(points, pairPlot.centers).loss); renderPair(pairPlot.draw(), false); });
[0, 1].forEach(j => $('pair-select-' + (j + 1)).addEventListener('click', () => pairPlot.select(j)));
$('pair-reset').addEventListener('click', () => { pairPlot.cancelMotion(); updateCount = 0; pairPlot.setCenters(initialCenters); });
$('pair-update').addEventListener('click', () => {
  const { centers, counts } = assignedCentroids(points, pairPlot.centers);
  updateCount++;
  pairPlot.animateTo(centers, () => announce(counts.some(count => count === 0)
    ? '担当データのある代表点を重心へ動かしました。担当が0個の代表点はその位置に残しました。'
    : '各代表点を、担当するデータの重心へ動かしました。'));
});
$('separated-new-data').addEventListener('click', () => {
  gapPlot.cancelMotion(); pairPlot.cancelMotion();
  points = createSeparatedDataset(++seed);
  mean = centroid(points);
  baseline = objective(points, mean);
  initialCenters = initialPair();
  updateCount = 0;
  $('gap-show-mean').checked = false;
  gapHistory.reset(objective(points, initialSingle));
  pairHistory.reset(assignToPrototypes(points, initialCenters).loss);
  gapPlot.replaceData(points, [initialSingle]);
  pairPlot.replaceData(points, initialCenters);
  announce('この先2つの実験を、同じ新しい60個のデータに更新しました。');
});
