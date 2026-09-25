// KaTeX and its fonts are served locally at a pinned version.
document.querySelectorAll('[data-tex]').forEach(node => {
  katex.render(node.dataset.tex, node, {
    displayMode: node.dataset.display === 'true',
    output: 'htmlAndMathml',
    throwOnError: true,
    strict: 'error',
    trust: false,
  });
  // Enlarge the whole formula so even its smallest subscript stays at 18px.
  const math = node.querySelector('.katex');
  const glyphs = [...node.querySelectorAll('.katex-html span')].filter(span =>
    [...span.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.replace(/[\s\u200b]/g, '')));
  const smallest = Math.min(...glyphs.map(span => parseFloat(getComputedStyle(span).fontSize)));
  const minimum = Math.max(18, parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.125);
  if (smallest < minimum) math.style.fontSize = `${parseFloat(getComputedStyle(math).fontSize) * minimum / smallest}px`;
});
