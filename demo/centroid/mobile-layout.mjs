import { compactScreen } from './responsive-mode.mjs';

// Move the existing chart and score, preserving their state and event handlers.
// The placeholders restore the desktop reading order when the screen widens.
const experiments = [...document.querySelectorAll('.experiment')].map(experiment => {
  const history = experiment.querySelector('.history-block');
  const score = experiment.querySelector('.score');
  const historyHome = document.createComment('history desktop position');
  const scoreHome = document.createComment('score desktop position');
  history.before(historyHome);
  score.before(scoreHome);
  const liveView = experiment.querySelector('.live-view');
  const resize = new ResizeObserver(() => {
    experiment.style.setProperty('--live-height', `${liveView.getBoundingClientRect().height}px`);
    liveView.classList.toggle('is-tall', liveView.getBoundingClientRect().height > innerHeight * .6);
  });
  resize.observe(liveView);
  // Keep focused controls below the pinned diagrams, including keyboard use.
  experiment.addEventListener('focusin', event => {
    if (compactScreen.matches && event.target.matches('.readout input, .readout button, .plot-actions button')) {
      event.target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  });
  return { history, score, historyHome, scoreHome,
    slot: experiment.querySelector('.mobile-history-slot'),
    heading: history.querySelector('.history-heading'),
    clear: history.querySelector('button'),
  };
});

function arrange() {
  for (const item of experiments) {
    if (compactScreen.matches) {
      item.slot.append(item.history);
      item.heading.insertBefore(item.score, item.clear);
    } else {
      item.historyHome.after(item.history);
      item.scoreHome.after(item.score);
    }
  }
}
compactScreen.addEventListener('change', arrange);
arrange();
