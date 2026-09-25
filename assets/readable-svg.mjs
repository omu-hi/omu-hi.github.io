// SVG viewBox scaling must not shrink graph labels below 18 screen pixels.
const charts = new Set();
const minimum = () => Math.max(18, parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.125);
let frame = 0;
function update() {
  frame = 0;
  for (const svg of charts) {
    const matrix = svg.getScreenCTM();
    if (!matrix || !svg.getBoundingClientRect().width) continue;
    const scale = Math.min(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
    if (!scale) continue;
    const size = minimum() / scale;
    svg.style.setProperty('--svg-text-size', `${size}px`);
    for (const rect of svg.querySelectorAll('[data-text-background]')) {
      const text = svg.querySelector(`#${rect.dataset.textBackground}`);
      if (!text) continue;
      const box = text.getBBox(), padding = 3 / scale;
      for (const [key, value] of Object.entries({x:box.x-padding,y:box.y-padding,width:box.width+2*padding,height:box.height+2*padding})) rect.setAttribute(key, value);
    }
  }
}
function schedule() { if (!frame) frame = requestAnimationFrame(update); }
const resize = new ResizeObserver(schedule);
function discover() {
  for (const svg of document.querySelectorAll('svg')) {
    if (charts.has(svg) || svg.closest('.katex')) continue;
    charts.add(svg);
    resize.observe(svg);
  }
  schedule();
}
new MutationObserver(discover).observe(document.body, {subtree:true,childList:true,attributes:true,attributeFilter:['viewBox']});
window.addEventListener('resize', schedule);
document.fonts.ready.then(schedule);
discover();
