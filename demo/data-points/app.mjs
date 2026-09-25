import { INITIAL_RECORDS, clampScore, distance, rankByDistance, nearestIds } from './model.mjs';

const $ = id => document.getElementById(id);
const svg = $('plot');
const namespace = 'http://www.w3.org/2000/svg';
const records = INITIAL_RECORDS.map(record => ({ ...record }));
const pointNodes = new Map();
const rowNodes = new Map();
const rankNodes = new Map();
const state = { stage: 1, revealed: 1, selected: 'A', compared: 'B' };
const position = record => ({ x: 64 + record.x * 40, y: 430 - record.y * 40 });
const descriptions = [
  { title: '2つの数値が、1つの点の位置になる', instruction: 'Aの甘さを変えると左右に、酸っぱさを変えると上下に動きます。まずはスライダーを動かしてみましょう。', plot: 'ジュースAを点にする' },
  { title: 'データを集めると、点の集まりになる', instruction: '「1件追加」で、表のデータを順に点にしてみましょう。表の1行と図の1点は、同じジュースを表しています。', plot: 'データセットを点群で見る' },
  { title: '距離を測ると、似ている度合いを比べられる', instruction: '青いAと他のジュースを比べます。Aを動かして、いちばん近い点がどう変わるか確かめましょう。', plot: 'Aと他のデータを比べる' },
];

function element(name, attributes = {}, text) {
  const node = document.createElementNS(namespace, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
for (let i = 0; i <= 10; i++) {
  $('grid').append(element('line', { x1: 64 + i * 40, y1: 30, x2: 64 + i * 40, y2: 430, class: 'grid-line' }), element('line', { x1: 64, y1: 30 + i * 40, x2: 464, y2: 30 + i * 40, class: 'grid-line' }));
  if (i % 2 === 0) $('grid').append(element('text', { x: 64 + i * 40, y: 452, 'text-anchor': 'middle', class: 'tick' }, i), element('text', { x: 50, y: 435 - i * 40, 'text-anchor': 'end', class: 'tick' }, i));
}
for (const record of records) {
  const group = element('g', { class: `point${record.id === 'A' ? ' point-a' : ''}`, 'data-id': record.id, role: 'button', tabindex: 0 });
  group.append(element('circle', { r: 23, class: 'point-hit' }), element('circle', { r: 15, class: 'point-halo' }), element('circle', { r: record.id === 'A' ? 9 : 7, class: 'point-dot' }), element('text', { x: 15, y: -12, class: 'point-label' }, record.id));
  $('points').append(group);
  pointNodes.set(record.id, group);

  const row = document.createElement('tr');
  row.innerHTML = `<th scope="row"><button type="button" data-record="${record.id}">${record.id}</button></th><td></td><td></td>`;
  row.querySelector('button').addEventListener('click', () => {
    state.selected = record.id;
    state.revealed = Math.max(state.revealed, records.indexOf(record) + 1);
    render();
  });
  $('dataset-rows').append(row);
  rowNodes.set(record.id, row);

  if (record.id !== 'A') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rank-button';
    button.dataset.compare = record.id;
    button.innerHTML = `<span class="rank-id">${record.id}</span><span class="rank-features"></span><span class="rank-distance"></span>`;
    button.addEventListener('click', () => { state.compared = record.id; render(); });
    $('distance-ranking').append(button);
    rankNodes.set(record.id, button);
  }
}

function render() {
  const a = records[0];
  const ranked = rankByDistance(records);
  const nearest = nearestIds(ranked);
  const visible = state.stage === 1 ? 1 : state.stage === 2 ? state.revealed : records.length;
  $('point-count').textContent = state.stage === 1 ? '1件 = 1点' : `${visible}件のデータ`;
  $('sweetness').value = a.x;
  $('sourness').value = a.y;
  $('sweetness-value').textContent = a.x;
  $('sourness-value').textContent = a.y;
  $('single-x').textContent = a.x;
  $('single-y').textContent = a.y;
  $('coordinate').textContent = `(${a.x}, ${a.y})`;
  $('reveal-count').textContent = `${state.revealed} / ${records.length}件を表示`;
  $('add-point').disabled = state.revealed === records.length;
  $('show-all').disabled = state.revealed === records.length;

  records.forEach((record, index) => {
    const point = pointNodes.get(record.id);
    const pos = position(record);
    const shown = index < visible;
    point.style.display = shown ? '' : 'none';
    point.setAttribute('tabindex', shown ? '0' : '-1');
    point.setAttribute('transform', `translate(${pos.x} ${pos.y})`);
    point.setAttribute('aria-label', `${record.id}：甘さ${record.x}、酸っぱさ${record.y}${record.id === 'A' && state.stage !== 2 ? '。矢印キーで動かせます' : ''}`);
    point.setAttribute('aria-pressed', String(state.stage === 2 && record.id === state.selected || state.stage === 3 && record.id === state.compared));
    point.classList.toggle('can-drag', record.id === 'A' && state.stage !== 2);
    point.classList.toggle('is-nearest', state.stage === 3 && nearest.includes(record.id));
    point.classList.toggle('is-compared', state.stage === 3 && record.id === state.compared);
    const label = point.querySelector('text');
    const overlaps = records.slice(0, visible).filter(other => other.x === record.x && other.y === record.y);
    const overlapIndex = overlaps.findIndex(other => other.id === record.id);
    label.setAttribute('x', record.x >= 8 ? -16 : 15);
    label.setAttribute('text-anchor', record.x >= 8 ? 'end' : 'start');
    label.setAttribute('y', (record.y >= 9 ? 24 : -13) + overlapIndex * 19);
    label.textContent = state.stage === 1 ? `A (${a.x}, ${a.y})` : record.id;

    const row = rowNodes.get(record.id);
    row.children[1].textContent = record.x;
    row.children[2].textContent = record.y;
    row.classList.toggle('is-selected', record.id === state.selected);
    row.classList.toggle('is-unshown', index >= state.revealed);
    row.querySelector('button').setAttribute('aria-pressed', String(record.id === state.selected));
  });
  // Keep A above coincident points so it remains draggable; the table/list selects every record.
  if ($('points').lastChild !== pointNodes.get('A')) $('points').append(pointNodes.get('A'));
  const selected = records.find(record => record.id === state.selected);
  $('selected-record').textContent = `${selected.id}：甘さ${selected.x}、酸っぱさ${selected.y} → 点 (${selected.x}, ${selected.y})`;
  const guideRecord = state.stage === 2 ? selected : a;
  const guide = position(guideRecord);
  $('guides').style.display = state.stage === 3 ? 'none' : '';
  $('coordinate-guide').setAttribute('d', `M64 ${guide.y}H${guide.x}V430`);
  $('x-badge').setAttribute('x', guide.x - 13); $('x-badge').setAttribute('y', 436);
  $('x-value').setAttribute('x', guide.x); $('x-value').setAttribute('y', 447); $('x-value').textContent = guideRecord.x;
  $('y-badge').setAttribute('x', 33); $('y-badge').setAttribute('y', guide.y - 11);
  $('y-value').setAttribute('x', 46); $('y-value').setAttribute('y', guide.y); $('y-value').textContent = guideRecord.y;

  const focused = document.activeElement?.dataset.compare;
  ranked.forEach((record, index) => {
    const button = rankNodes.get(record.id);
    button.querySelector('.rank-features').textContent = `甘さ ${record.x}・酸っぱさ ${record.y}`;
    button.querySelector('.rank-distance').textContent = record.distance.toFixed(2);
    button.setAttribute('aria-label', `${record.id}と比べる。距離${record.distance.toFixed(2)}${nearest.includes(record.id) ? '、最も近い' : ''}`);
    button.setAttribute('aria-pressed', String(record.id === state.compared));
    button.classList.toggle('is-nearest', nearest.includes(record.id));
    if ($('distance-ranking').children[index] !== button) $('distance-ranking').insertBefore(button, $('distance-ranking').children[index]);
  });
  if (focused) rankNodes.get(focused).focus({ preventScroll: true });
  $('nearest-heading').textContent = `Aにいちばん近いのは ${nearest.join('・')}${nearest.length > 1 ? '（同じ距離）' : ''}`;
  const compared = records.find(record => record.id === state.compared);
  const dx = Math.abs(a.x - compared.x), dy = Math.abs(a.y - compared.y);
  const d = distance(a, compared);
  $('pair-label').textContent = `Aと${compared.id}の距離`;
  $('pair-distance').textContent = d.toFixed(2);
  $('pair-summary').textContent = d === 0 ? '甘さと酸っぱさが、どちらも同じ値です。' : `甘さの差 ${dx}・酸っぱさの差 ${dy}`;
  $('distance-calculation').textContent = `√(${dx}² + ${dy}²) ${Number.isInteger(d) ? '=' : '≈'} ${d.toFixed(2)}`;
  $('distance-lines').replaceChildren();
  if (state.stage === 3) {
    const pa = position(a), pb = position(compared);
    $('distance-lines').append(element('line', { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, class: 'comparison-line' }));
    $('difference-lines').setAttribute('d', `M${pa.x} ${pa.y}H${pb.x}V${pb.y}`);
  }
  $('difference-lines').style.display = state.stage === 3 && $('distance-details').open ? '' : 'none';
  $('difference-lines').removeAttribute('hidden');
}

function setStage(stage) {
  state.stage = stage;
  const description = descriptions[stage - 1];
  $('stage-number').textContent = `STEP 0${stage}`;
  $('stage-title').textContent = description.title;
  $('stage-instruction').textContent = description.instruction;
  $('plot-heading').textContent = description.plot;
  document.querySelectorAll('[data-stage]').forEach(button => {
    if (Number(button.dataset.stage) === stage) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  $('single-panel').hidden = stage !== 1;
  $('dataset-panel').hidden = stage !== 2;
  $('distance-panel').hidden = stage !== 3;
  $('a-controls').hidden = stage === 2;
  $('similarity-note').hidden = stage !== 3;
  $('plot-help').textContent = stage === 2 ? '図の点や表の文字を選んで、1件のデータがどの点に対応するか確かめましょう。' : '青いAをドラッグするか、図の中をタップして動かせます。Aにフォーカスすると矢印キーでも操作できます。';
  $('previous').disabled = stage === 1;
  $('next').hidden = stage === 3;
  $('next-lesson').hidden = stage !== 3;
  $('next').textContent = stage === 1 ? '次へ：点を集める →' : '次へ：距離で比べる →';
  $('stage-status').textContent = `${stage} / 3`;
  render();
}
function moveA(x, y) {
  records[0].x = clampScore(x);
  records[0].y = clampScore(y);
  render();
}
function selectPoint(id) {
  if (state.stage === 2) state.selected = id;
  else if (state.stage === 3 && id !== 'A') state.compared = id;
  render();
}
function moveFromEvent(event) {
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
  moveA((point.x - 64) / 40, (430 - point.y) / 40);
}
let dragging = false, suppressClick = false;
svg.addEventListener('pointerdown', event => {
  if (state.stage === 2 || event.target.closest('[data-id]')?.dataset.id !== 'A') return;
  event.preventDefault();
  dragging = true; suppressClick = true;
  svg.setPointerCapture(event.pointerId);
  pointNodes.get('A').focus({ preventScroll: true });
});
svg.addEventListener('pointermove', event => { if (dragging) moveFromEvent(event); });
function endDrag(event) {
  if (!dragging) return;
  dragging = false;
  if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
  setTimeout(() => { suppressClick = false; }, 0);
}
svg.addEventListener('pointerup', endDrag);
svg.addEventListener('pointercancel', endDrag);
svg.addEventListener('click', event => {
  if (suppressClick) return;
  const id = event.target.closest('[data-id]')?.dataset.id;
  if (id) selectPoint(id);
  else if (state.stage !== 2) {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    if (point.x >= 64 && point.x <= 464 && point.y >= 30 && point.y <= 430) moveFromEvent(event);
  }
});
svg.addEventListener('keydown', event => {
  const id = event.target.closest('[data-id]')?.dataset.id;
  if (!id) return;
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPoint(id); return; }
  if (id !== 'A' || state.stage === 2) return;
  const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
  if (delta) { event.preventDefault(); moveA(records[0].x + delta[0], records[0].y + delta[1]); pointNodes.get('A').focus({ preventScroll: true }); }
});
$('sweetness').addEventListener('input', event => moveA(Number(event.target.value), records[0].y));
$('sourness').addEventListener('input', event => moveA(records[0].x, Number(event.target.value)));
$('reset-a').addEventListener('click', () => moveA(INITIAL_RECORDS[0].x, INITIAL_RECORDS[0].y));
$('add-point').addEventListener('click', () => { state.revealed = Math.min(records.length, state.revealed + 1); state.selected = records[state.revealed - 1].id; render(); });
$('show-all').addEventListener('click', () => { state.revealed = records.length; render(); });
$('restart-reveal').addEventListener('click', () => { state.revealed = 1; state.selected = 'A'; render(); });
$('distance-details').addEventListener('toggle', render);
document.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => setStage(Number(button.dataset.stage))));
$('previous').addEventListener('click', () => { setStage(Math.max(1, state.stage - 1)); document.querySelector(`[data-stage="${state.stage}"]`).focus(); });
$('next').addEventListener('click', () => { setStage(Math.min(3, state.stage + 1)); document.querySelector(`[data-stage="${state.stage}"]`).focus(); });
setStage(1);
