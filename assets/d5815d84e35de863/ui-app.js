import { renderScreen, formatTime } from './screens.js';
import { act, tick, createScenario, acceptsPassword, remainingSeconds } from './scenario.js';

const app = document.getElementById('app');
const sessionKey = 'suspicion-ui-unlocked';
let unlocked = false;
try { unlocked = sessionStorage.getItem(sessionKey) === 'yes'; } catch {}
let state = unlocked ? createScenario() : { screen: 'S00' };

function render() { app.replaceChildren(renderScreen(state, dispatch, remainingSeconds(state, performance.now()))); }

function dispatch(action) {
  if (state.screen === 'S00') {
    if (action.type !== 'unlock') return;
    if (!acceptsPassword(action.password)) {
      const input = app.querySelector('input');
      input.setAttribute('aria-invalid', 'true');
      input.select();
      return;
    }
    try { sessionStorage.setItem(sessionKey, 'yes'); } catch {}
    state = createScenario();
  } else {
    state = act(state, action, performance.now());
  }
  render();
}

render();
setInterval(() => {
  const now = performance.now();
  const next = tick(state, now);
  if (next !== state) { state = next; render(); }
  const timer = app.querySelector('[role="timer"]');
  if (timer) timer.textContent = formatTime(remainingSeconds(state, now));
}, 100);
