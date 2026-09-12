import { toScreen, fromScreen, clamp, assignToPrototypes } from './math.mjs';
import { LossHistory } from './history.mjs';

const NS = 'http://www.w3.org/2000/svg';
export const format = value => value.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function svgElement(name, attrs = {}, text) {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

export class PrototypePlot {
  constructor(svg, { points, centers, colored = false, onChange, onSelect, onFinish }) {
    this.svg = svg;
    this.points = points;
    this.centers = centers.map(p => ({ ...p }));
    this.colored = colored;
    this.onChange = onChange;
    this.onSelect = onSelect;
    this.onFinish = onFinish;
    this.selected = 0;
    this.dragId = null;
    this.animation = null;
    this.scene = svgElement('g');
    this.grid = svgElement('g', { 'aria-hidden': true });
    this.gap = svgElement('g', { hidden: '', 'aria-hidden': true });
    this.gap.append(svgElement('rect', { x: toScreen({ x: 3.6, y: 0 }).x, y: 30, width: 2.8 * 52, height: 520, class: 'empty-gap' }));
    this.gap.append(svgElement('text', { x: 310, y: 53, 'text-anchor': 'middle', class: 'gap-caption' }, 'データのない間'));
    this.connections = svgElement('g', { 'aria-hidden': true });
    this.dots = svgElement('g', { 'aria-hidden': true });
    this.meanMark = svgElement('g', { hidden: '', 'aria-hidden': true });
    this.meanDiamond = svgElement('path', { class: 'mean-diamond' });
    this.meanLabel = svgElement('text', { class: 'mean-label', 'text-anchor': 'middle' }, '全体の重心');
    this.meanMark.append(this.meanDiamond, this.meanLabel);
    this.scene.append(svgElement('rect', { x: 50, y: 30, width: 520, height: 520, class: 'plot-background' }), this.gap, this.grid, this.connections, this.dots, this.meanMark);
    svg.append(this.scene);
    for (let i = 0; i <= 10; i++) {
      const p = toScreen({ x: i, y: i });
      this.grid.append(svgElement('line', { x1: p.x, x2: p.x, y1: 30, y2: 550, class: 'grid-line' }), svgElement('line', { x1: 50, x2: 570, y1: p.y, y2: p.y, class: 'grid-line' }));
      if (i % 2 === 0) this.grid.append(svgElement('text', { x: p.x, y: 575, 'text-anchor': 'middle', class: 'grid-label' }, i), svgElement('text', { x: 35, y: p.y + 5, 'text-anchor': 'end', class: 'grid-label' }, i));
    }
    this.grid.append(svgElement('text', { x: 590, y: 554, class: 'axis-label', 'text-anchor': 'middle' }, 'x'), svgElement('text', { x: 50, y: 18, class: 'axis-label', 'text-anchor': 'middle' }, 'y'));
    this.handles = centers.map((_, j) => {
      const handle = svgElement('g', { tabindex: 0, role: 'button', class: `lesson-handle representative-${j + 1}`, 'aria-describedby': svg.getAttribute('aria-describedby') || '' });
      handle.append(svgElement('circle', { r: 25, class: 'prototype-hit' }), svgElement('circle', { r: 18, class: 'prototype-halo' }));
      handle.append(j === 0 ? svgElement('circle', { r: 11, class: 'prototype-core' }) : svgElement('rect', { x: -10, y: -10, width: 20, height: 20, rx: 2, transform: 'rotate(45)', class: 'prototype-core' }));
      handle.append(svgElement('text', { x: 0, y: 5, 'text-anchor': 'middle', class: 'handle-number', 'aria-hidden': true }, centers.length > 1 ? j + 1 : 'p'));
      handle.addEventListener('focus', () => this.select(j));
      handle.addEventListener('keydown', event => {
        const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
        if (!directions[event.key]) return;
        event.preventDefault();
        this.cancelMotion();
        this.select(j);
        const [dx, dy] = directions[event.key];
        const step = event.shiftKey ? 0.01 : 0.1;
        this.move(j, { x: this.centers[j].x + dx * step, y: this.centers[j].y + dy * step });
      });
      handle.addEventListener('keyup', event => { if (event.key.startsWith('Arrow')) this.onFinish?.(); });
      this.scene.append(handle);
      return handle;
    });
    svg.addEventListener('pointerdown', event => {
      if (this.dragId !== null || !event.isPrimary || event.button !== 0) return;
      const point = this.eventPoint(event);
      if (!point) return;
      const target = this.handles.findIndex(handle => handle.contains(event.target));
      if (target < 0 && (point.x < 50 || point.x > 570 || point.y < 30 || point.y > 550)) return;
      event.preventDefault();
      this.cancelMotion();
      this.select(target < 0 ? this.selected : target);
      this.dragId = event.pointerId;
      svg.setPointerCapture(this.dragId);
      svg.classList.add('is-dragging');
      this.handles[this.selected].focus({ preventScroll: true });
      this.move(this.selected, fromScreen(point));
    });
    svg.addEventListener('pointermove', event => {
      if (event.pointerId !== this.dragId) return;
      const point = this.eventPoint(event);
      if (point) this.move(this.selected, fromScreen(point));
    });
    const finish = event => {
      if (event.pointerId !== this.dragId) return;
      this.dragId = null;
      svg.classList.remove('is-dragging');
      if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
      this.onFinish?.();
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => svg.addEventListener(name, finish));
    this.buildData();
    this.draw();
  }

  eventPoint(event) {
    const matrix = this.svg.getScreenCTM();
    if (!matrix) return null;
    const p = this.svg.createSVGPoint();
    p.x = event.clientX; p.y = event.clientY;
    return p.matrixTransform(matrix.inverse());
  }
  buildData() {
    this.connections.replaceChildren();
    this.dots.replaceChildren();
    this.lines = this.points.map(point => {
      const p = toScreen(point);
      const line = svgElement('line', { x1: p.x, y1: p.y, class: 'connection' });
      this.connections.append(line);
      this.dots.append(svgElement('path', { transform: `translate(${p.x} ${p.y})`, class: 'data-point' }));
      return line;
    });
  }
  draw() {
    const result = assignToPrototypes(this.points, this.centers);
    this.points.forEach((_, i) => {
      const j = result.assignments[i];
      const screen = toScreen(this.centers[j]);
      this.lines[i].setAttribute('x2', screen.x);
      this.lines[i].setAttribute('y2', screen.y);
      this.lines[i].setAttribute('class', this.colored ? `connection assigned-${j + 1}` : 'connection');
      const dot = this.dots.children[i];
      dot.setAttribute('class', this.colored ? `data-point assigned-${j + 1}` : 'data-point');
      dot.setAttribute('d', this.colored && j === 1 ? 'M-4.5 -4.5H4.5V4.5H-4.5Z' : 'M-4.5 0a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0');
    });
    this.handles.forEach((handle, j) => {
      const p = toScreen(this.centers[j]);
      handle.setAttribute('transform', `translate(${p.x} ${p.y})`);
      handle.setAttribute('aria-label', `代表点${this.centers.length > 1 ? j + 1 : ''}。横 ${format(this.centers[j].x)}、縦 ${format(this.centers[j].y)}。矢印キーで移動、Shiftで微調整。`);
      handle.classList.toggle('is-selected', j === this.selected && this.centers.length > 1);
    });
    return result;
  }
  select(index) { this.selected = index; this.onSelect?.(index); this.draw(); }
  move(index, point) {
    const next = this.centers.map(p => ({ ...p }));
    next[index] = { x: clamp(point.x), y: clamp(point.y) };
    this.setCenters(next);
  }
  setCenters(centers, record = true) {
    const next = centers.map(point => ({ x: clamp(point.x), y: clamp(point.y) }));
    const moved = next.some((p, j) => p.x !== this.centers[j].x || p.y !== this.centers[j].y);
    this.centers = next;
    const result = this.draw();
    this.onChange?.(result, record && moved);
  }
  replaceData(points, centers) {
    this.cancelMotion();
    this.points = points;
    this.centers = centers.map(p => ({ ...p }));
    this.buildData();
    this.setCenters(centers, false);
  }
  showMean(mean, visible) {
    this.gap.toggleAttribute('hidden', !visible);
    this.meanMark.toggleAttribute('hidden', !visible);
    const p = toScreen(mean);
    this.meanDiamond.setAttribute('d', `M${p.x} ${p.y - 10}L${p.x + 10} ${p.y}L${p.x} ${p.y + 10}L${p.x - 10} ${p.y}Z`);
    this.meanLabel.setAttribute('x', p.x);
    this.meanLabel.setAttribute('y', p.y + 35);
  }
  cancelMotion() {
    if (this.animation !== null) cancelAnimationFrame(this.animation);
    this.animation = null;
  }
  animateTo(targets, done) {
    this.cancelMotion();
    const starts = this.centers.map(p => ({ ...p }));
    const beginning = performance.now();
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
    const tick = now => {
      const t = duration === 0 ? 1 : Math.max(0, Math.min(1, (now - beginning) / duration));
      const ease = 1 - (1 - t) ** 3;
      this.setCenters(t === 1 ? targets : starts.map((p, j) => ({ x: p.x + (targets[j].x - p.x) * ease, y: p.y + (targets[j].y - p.y) * ease })));
      if (t < 1) this.animation = requestAnimationFrame(tick);
      else { this.animation = null; done?.(); }
    };
    this.animation = requestAnimationFrame(tick);
  }
}

export class MiniHistory {
  constructor(root, initialLoss) {
    this.root = root;
    this.history = new LossHistory(initialLoss);
    const svg = svgElement('svg', { viewBox: '0 0 400 200', role: 'img', class: 'mini-history-chart', 'aria-label': '距離の2乗和の推移' });
    this.svg = svg;
    this.top = svgElement('text', { x: 54, y: 25, 'text-anchor': 'end', class: 'grid-label' });
    this.middle = svgElement('text', { x: 54, y: 91, 'text-anchor': 'end', class: 'grid-label' });
    this.first = svgElement('text', { x: 66, y: 180, 'text-anchor': 'start', class: 'grid-label' });
    this.last = svgElement('text', { x: 378, y: 180, 'text-anchor': 'end', class: 'grid-label' });
    this.line = svgElement('path', { class: 'mini-history-line' });
    this.dot = svgElement('circle', { r: 4, class: 'mini-history-dot' });
    this.reference = svgElement('line', { x1: 66, x2: 378, class: 'mini-history-reference', hidden: '' });
    const grid = svgElement('g', { class: 'history-grid' });
    [20, 86, 152].forEach(y => grid.append(svgElement('line', { x1: 66, x2: 378, y1: y, y2: y })));
    svg.append(grid, this.top, this.middle, svgElement('text', { x: 54, y: 157, 'text-anchor': 'end', class: 'grid-label' }, '0'), this.first, this.last, this.reference, this.line, this.dot);
    root.append(svg);
    this.draw();
  }
  reset(loss) { this.history.reset(loss); this.draw(); }
  record(loss) { this.history.record(loss); this.draw(); }
  draw(reference = null) {
    const { first, last, samples } = this.history.view;
    const ceiling = Math.max(this.history.ceiling, reference === null ? 0 : reference * 1.1);
    const x = index => 66 + (index - first) / (last - first) * 312;
    const y = value => 152 - value / ceiling * 132;
    const latest = samples[samples.length - 1];
    this.line.setAttribute('d', samples.map((sample, i) => `${i ? 'L' : 'M'}${x(sample.index).toFixed(2)} ${y(sample.loss).toFixed(2)}`).join(' '));
    this.dot.setAttribute('cx', x(latest.index));
    this.dot.setAttribute('cy', y(latest.loss));
    this.reference.toggleAttribute('hidden', reference === null);
    if (reference !== null) { this.reference.setAttribute('y1', y(reference)); this.reference.setAttribute('y2', y(reference)); }
    this.top.textContent = Math.ceil(ceiling).toLocaleString('ja-JP');
    this.middle.textContent = Math.round(ceiling / 2).toLocaleString('ja-JP');
    this.first.textContent = first;
    this.last.textContent = last;
    this.svg.setAttribute('aria-label', `2乗誤差の推移。横軸は位置の更新順。${first}回目から${latest.index}回目。最新値 ${format(latest.loss)}。`);
  }
}
