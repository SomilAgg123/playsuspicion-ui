import { applyTheme, renderScreen, formatTime, roleView } from './screens.js';
import { act, tick, createScenario, acceptsPassword, remainingSeconds } from './scenario.js';

applyTheme();
const app = document.getElementById('app');
const sessionKey = 'suspicion-ui-unlocked';
let unlocked = false;
try { unlocked = sessionStorage.getItem(sessionKey) === 'yes'; } catch {}
let state = unlocked ? createScenario() : { screen: 'S00' };
let showingRole = false;

function render() { renderScreen(app, roleView(state, showingRole), dispatch, remainingSeconds(state, performance.now())); }

function dispatch(action) {
  if ((action.type === 'role' && state.canViewRole) || (action.type === 'back' && showingRole)) {
    state = tick(state, performance.now());
    showingRole = action.type === 'role' ? !showingRole : false;
    render();
    window.scrollTo(0, 0);
    app.querySelector(showingRole ? '.brand' : '[data-navigation="role"]').focus();
    return;
  }
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
