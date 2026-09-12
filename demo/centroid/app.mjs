import { createDataset, centroid, objective, squaredDistance, INITIAL_POINT, clamp, toScreen, fromScreen } from './math.mjs';
import { LossHistory } from './history.mjs';

const $ = id => document.getElementById(id);
const svg = $('plot');
const NS = 'http://www.w3.org/2000/svg';
const format = value => value.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let seed = 20260912;
let points = createDataset(seed);
let mean = centroid(points);
let minimum = objective(points, mean);
let prototype = { ...INITIAL_POINT };
let lines = [];
let dragId = null;
let animation = null;
const history = new LossHistory(objective(points, prototype));

function element(name, attributes, text) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildGrid() {
  for (let i = 0; i <= 10; i++) {
    const x = 50 + i * 52;
    const y = 550 - i * 52;
    $('grid').append(element('line', { x1: x, y1: 30, x2: x, y2: 550, class: 'grid-line' }));
    $('grid').append(element('line', { x1: 50, y1: y, x2: 570, y2: y, class: 'grid-line' }));
    if (i % 2 === 0) {
      $('grid').append(element('text', { x, y: 575, 'text-anchor': 'middle', class: 'grid-label' }, i));
      $('grid').append(element('text', { x: 35, y: y + 5, 'text-anchor': 'end', class: 'grid-label' }, i));
    }
  }
  $('grid').append(element('text', { x: 590, y: 554, class: 'axis-label', 'text-anchor': 'middle' }, 'x'));
  $('grid').append(element('text', { x: 50, y: 18, class: 'axis-label', 'text-anchor': 'middle' }, 'y'));
}

function buildData() {
  $('connections').replaceChildren();
  $('data-points').replaceChildren();
  lines = points.map(point => {
    const screen = toScreen(point);
    const line = element('line', { x1: screen.x, y1: screen.y, class: 'connection' });
    $('connections').append(line);
    $('data-points').append(element('circle', { cx: screen.x, cy: screen.y, r: 4.7, class: 'data-point' }));
    return line;
  });
  $('point-count').textContent = points.length;
  const m = toScreen(mean);
  $('mean-horizontal').setAttribute('x1', 50);
  $('mean-horizontal').setAttribute('y1', m.y);
  $('mean-horizontal').setAttribute('x2', 570);
  $('mean-horizontal').setAttribute('y2', m.y);
  $('mean-vertical').setAttribute('x1', m.x);
  $('mean-vertical').setAttribute('y1', 30);
  $('mean-vertical').setAttribute('x2', m.x);
  $('mean-vertical').setAttribute('y2', 550);
  $('mean-diamond').setAttribute('d', `M ${m.x} ${m.y - 10} L ${m.x + 10} ${m.y} L ${m.x} ${m.y + 10} L ${m.x - 10} ${m.y} Z`);
  $('mean-label').setAttribute('x', m.x - 18);
  $('mean-label').setAttribute('y', m.y + 30);
  $('mean-label').setAttribute('text-anchor', 'end');
}

function setVisibility(id, visible) {
  // SVG does not implement HTMLElement.hidden; use the attribute for both.
  $(id).toggleAttribute('hidden', !visible);
}

function renderHistory() {
  const { samples, first, last, ceiling } = history.view;
  const x = index => 64 + (index - first) / (last - first) * 314;
  const y = loss => 174 - loss / ceiling * 148;
  const current = samples[samples.length - 1];
  const path = samples.map((sample, index) => `${index ? 'L' : 'M'} ${x(sample.index).toFixed(2)} ${y(sample.loss).toFixed(2)}`).join(' ');
  $('history-line').setAttribute('d', path);
  $('history-area').setAttribute('d', samples.length < 2 ? '' : `${path} L ${x(current.index)} 174 L ${x(first)} 174 Z`);
  $('history-current').setAttribute('cx', x(current.index));
  $('history-current').setAttribute('cy', y(current.loss));
  $('history-minimum').setAttribute('y1', y(minimum));
  $('history-minimum').setAttribute('y2', y(minimum));
  // After clearing at a near-minimum point the minimum still lies in the scale.
  setVisibility('history-minimum', $('show-mean').checked);
  setVisibility('history-minimum-legend', $('show-mean').checked);
  $('history-y-top').textContent = Math.round(ceiling).toLocaleString('ja-JP');
  $('history-y-mid').textContent = (ceiling / 2).toLocaleString('ja-JP');
  $('history-x-start').textContent = first;
  $('history-x-mid').textContent = Math.round((first + last) / 2);
  $('history-x-end').textContent = last;
  $('history-count').textContent = `${history.index.toLocaleString('ja-JP')} 回の位置更新`;
  $('history-chart-desc').textContent = `縦軸は距離の2乗和、横軸は位置の更新順。最新値は ${format(current.loss)}。${first} 回目から ${current.index} 回目までの記録。`;
  $('history-empty').toggleAttribute('hidden', samples.length > 1);
}

function render() {
  const p = toScreen(prototype);
  const loss = objective(points, prototype);
  const extra = points.length * squaredDistance(prototype, mean);
  const atMean = squaredDistance(prototype, mean) < 1e-20;
  const revealed = $('show-mean').checked;
  lines.forEach(line => {
    line.setAttribute('x2', p.x);
    line.setAttribute('y2', p.y);
  });
  $('prototype').setAttribute('transform', `translate(${p.x} ${p.y})`);
  $('prototype').setAttribute('aria-label', `代表点。横 ${format(prototype.x)}、縦 ${format(prototype.y)}。距離の2乗和 ${format(loss)}。矢印キーで移動、Shiftで微調整。`);
  const labelOnLeft = prototype.x > 7.8;
  $('prototype-label').setAttribute('x', p.x + (labelOnLeft ? -20 : 20));
  $('prototype-label').setAttribute('y', p.y + (prototype.y > 9.2 ? 28 : -18));
  $('prototype-label').setAttribute('text-anchor', labelOnLeft ? 'end' : 'start');
  $('loss').textContent = format(loss);
  for (const axis of ['x', 'y']) {
    $('position-' + axis).value = prototype[axis];
    $('position-' + axis + '-value').textContent = format(prototype[axis]);
    $('position-' + axis).setAttribute('aria-valuetext', format(prototype[axis]));
  }
  for (const id of ['mean-legend', 'mean-mark', 'mean-label', 'mean-result']) setVisibility(id, revealed);
  $('mean-position').textContent = `(${format(mean.x)}, ${format(mean.y)})`;
  $('minimum-loss').textContent = format(minimum);
  $('excess-loss').textContent = extra > 0 && extra < 0.005 ? '+ 0.01 未満' : '+ ' + format(extra);
  $('minimum-status').textContent = atMean
    ? '代表点が重心に一致。これが最小値です。'
    : '増加分 = データ数 × 重心までの距離の2乗。';
  $('discovery').textContent = revealed
    ? (atMean ? '少し動かして、値が増えることも確かめよう。' : 'ピンクのひし形が重心です。近づけると、値はどう変わる？')
    : 'まずは自分で、小さくなる場所を探してみよう。';
  renderHistory();
}

function cancelMotion() {
  if (animation !== null) cancelAnimationFrame(animation);
  animation = null;
}

function setPrototype(point, record = true) {
  const next = { x: clamp(point.x), y: clamp(point.y) };
  const moved = next.x !== prototype.x || next.y !== prototype.y;
  prototype = next;
  if (record && moved) history.record(objective(points, prototype));
  render();
}

function announce(message) {
  $('announcement').textContent = message || `代表点は横 ${format(prototype.x)}、縦 ${format(prototype.y)}。距離の2乗和は ${format(objective(points, prototype))}。`;
}

function eventPoint(event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(matrix.inverse());
}

svg.addEventListener('pointerdown', event => {
  if (dragId !== null || !event.isPrimary || event.button !== 0) return;
  const point = eventPoint(event);
  if (!point) return;
  const onHandle = $('prototype').contains(event.target);
  if (!onHandle && (point.x < 50 || point.x > 570 || point.y < 30 || point.y > 550)) return;
  cancelMotion();
  event.preventDefault();
  dragId = event.pointerId;
  svg.setPointerCapture(dragId);
  svg.classList.add('is-dragging');
  $('prototype').focus({ preventScroll: true });
  setPrototype(fromScreen(point));
});

svg.addEventListener('pointermove', event => {
  if (event.pointerId !== dragId) return;
  const point = eventPoint(event);
  if (point) setPrototype(fromScreen(point));
});

function finishDrag(event) {
  if (event.pointerId !== dragId) return;
  dragId = null;
  svg.classList.remove('is-dragging');
  if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
  announce();
}
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) svg.addEventListener(name, finishDrag);

$('prototype').addEventListener('keydown', event => {
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  if (!directions[event.key]) return;
  event.preventDefault();
  cancelMotion();
  const step = event.shiftKey ? 0.01 : 0.1;
  const [dx, dy] = directions[event.key];
  setPrototype({ x: prototype.x + dx * step, y: prototype.y + dy * step });
});
$('prototype').addEventListener('keyup', event => {
  if (event.key.startsWith('Arrow')) announce();
});

for (const axis of ['x', 'y']) {
  $('position-' + axis).addEventListener('input', event => {
    cancelMotion();
    setPrototype({ ...prototype, [axis]: Number(event.target.value) });
  });
  $('position-' + axis).addEventListener('change', () => announce());
}

$('show-mean').addEventListener('change', () => {
  render();
  announce($('show-mean').checked
    ? `重心は横 ${format(mean.x)}、縦 ${format(mean.y)}。距離の2乗和の最小値は ${format(minimum)}。`
    : '重心を非表示にしました。');
});

$('move-to-mean').addEventListener('click', () => {
  cancelMotion();
  $('show-mean').checked = true;
  const start = { ...prototype };
  const startTime = performance.now();
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450;
  const tick = now => {
    const progress = duration === 0 ? 1 : Math.min(1, (now - startTime) / duration);
    const ease = 1 - (1 - progress) ** 3;
    setPrototype(progress === 1 ? mean : { x: start.x + (mean.x - start.x) * ease, y: start.y + (mean.y - start.y) * ease });
    if (progress < 1) animation = requestAnimationFrame(tick);
    else {
      animation = null;
      announce(`重心に移動しました。距離の2乗和は最小値 ${format(minimum)} です。`);
    }
  };
  animation = requestAnimationFrame(tick);
});

$('reset-point').addEventListener('click', () => {
  cancelMotion();
  setPrototype(INITIAL_POINT);
  announce('同じデータのまま、代表点を最初の位置に戻しました。');
});

$('new-data').addEventListener('click', () => {
  cancelMotion();
  seed = (seed + 1) >>> 0;
  points = createDataset(seed);
  mean = centroid(points);
  minimum = objective(points, mean);
  $('show-mean').checked = false;
  history.reset(objective(points, INITIAL_POINT));
  buildData();
  setPrototype(INITIAL_POINT, false);
  announce('新しい40個のデータを作りました。重心は非表示です。代表点を動かして確かめてください。');
});

$('clear-history').addEventListener('click', () => {
  cancelMotion();
  history.reset(objective(points, prototype));
  renderHistory();
  announce('現在の代表点の位置から、誤差の記録をやり直します。');
});

buildGrid();
buildData();
render();
