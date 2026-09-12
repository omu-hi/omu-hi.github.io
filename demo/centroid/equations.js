// KaTeX and its fonts are served locally at a pinned version.
document.querySelectorAll('[data-tex]').forEach(node => {
  katex.render(node.dataset.tex, node, {
    displayMode: node.dataset.display === 'true',
    output: 'htmlAndMathml',
    throwOnError: true,
    strict: 'error',
    trust: false,
  });
});
