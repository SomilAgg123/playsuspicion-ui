import { applyTheme, createIntro, renderScreen, formatTime, createNavigation } from './screens.js';
import { act, tick, createScenario, acceptsPassword, remainingSeconds } from './scenario.js';

applyTheme();
const app = document.getElementById('app');
const intro = createIntro();
const sessionKey = 'suspicion-ui-unlocked';
let savedEntry;
try { savedEntry = sessionStorage.getItem(sessionKey); } catch {}
const requestedTeam = new URLSearchParams(location.search).get('team');
const initialTeam = requestedTeam ?? savedEntry;
let state = {
  screen: 'S00', sampleTeam: initialTeam === 'community' ? 'community' : 'mafia',
  unlocked: ['yes', 'mafia', 'community'].includes(savedEntry),
};
const navigation = createNavigation();

function render() { renderScreen(app, intro.view(navigation.view(state)), dispatch, remainingSeconds(state, performance.now())); }

function dispatch(action) {
  if (state.screen === 'S01' && intro.advance(action.type)) {
    render();
    return;
  }
  const focus = navigation.navigate(action.type, state);
  if (focus) {
    state = tick(state, performance.now());
    render();
    window.scrollTo(0, 0);
    app.querySelector(focus)?.focus();
    return;
  }
  if (state.screen === 'S00') {
    if (action.type !== 'unlock') return;
    if (!state.unlocked && !acceptsPassword(action.password)) {
      const input = app.querySelector('input[name="password"]');
      input.setAttribute('aria-invalid', 'true');
      app.querySelector('.game-dialog').showModal();
      return;
    }
    try { sessionStorage.setItem(sessionKey, action.team); } catch {}
    state = createScenario(action.team);
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
