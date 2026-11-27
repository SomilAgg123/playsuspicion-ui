import { roles, formatRoleTask } from './roles.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, action) {
  const node = element('button', 'game-button', text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

function field(label, name, type, value) {
  const wrapper = element('label', 'game-field', label);
  const input = element('input');
  Object.assign(input, { name, type, value: value ?? '', required: true });
  if (type === 'number') Object.assign(input, { min: '0', step: 'any', inputMode: 'decimal' });
  if (name === 'name') Object.assign(input, { autocomplete: 'given-name', maxLength: 120 });
  wrapper.append(input);
  return { wrapper, input };
}

function infoRow(label, value, description) {
  const row = element('div', 'info-row');
  row.append(element('dt', '', `${label}:`), element('dd', '', value));
  if (description) row.append(element('dd', 'info-description', description));
  return row;
}

export function renderScreen(state, dispatch, seconds) {
  const shell = element('section', 'game-shell');
  shell.dataset.screen = state.screen;
  shell.setAttribute('aria-label', 'Game screen');
  const header = element('header', 'game-header');
  const brand = element('h1', 'brand', 'Suspicion');
  brand.tabIndex = -1;
  header.append(brand);
  if (state.canViewRole) {
    const role = button('My Role', () => dispatch({ type: 'role' }));
    role.classList.add('role-button');
    role.dataset.navigation = 'role';
    role.setAttribute('aria-pressed', String(Boolean(state.viewingRole)));
    header.append(role);
  }
  shell.append(header);
  const content = element(['S00', 'S01'].includes(state.screen) ? 'form' : 'div', 'screen-content');

  if (state.screen === 'S00') {
    const password = field('Password', 'password', 'password', '');
    password.input.autocomplete = 'current-password';
    const enter = element('button', 'game-button screen-action', 'Enter');
    enter.type = 'submit';
    enter.disabled = true;
    password.input.addEventListener('input', () => {
      password.input.removeAttribute('aria-invalid');
      enter.disabled = password.input.value.length === 0;
    });
    content.addEventListener('submit', event => {
      event.preventDefault();
      if (!enter.disabled) dispatch({ type: 'unlock', password: password.input.value });
    });
    content.append(password.wrapper, enter);
  }

  if (state.screen === 'S01') {
    const name = field('Name', 'name', 'text', state.player.name);
    const number = field('Drunk number', 'drunkNumber', 'number', state.player.drunkNumber);
    const hint = element('span', 'field-description', 'Type the number of drinks it takes to get drunk.');
    hint.id = 'drunk-number-description';
    number.input.setAttribute('aria-describedby', hint.id);
    number.wrapper.append(hint);
    const next = element('button', 'game-button screen-action', 'Next');
    next.type = 'submit';
    const update = () => {
      const value = number.input.value;
      next.disabled = !state.canJoin || !name.input.value.trim() || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0;
    };
    content.addEventListener('input', update);
    content.addEventListener('submit', event => {
      event.preventDefault();
      if (!next.disabled) dispatch({ type: 'join', name: name.input.value.trim(), drunkNumber: Number(number.input.value) });
    });
    content.append(name.wrapper, number.wrapper, next);
    update();
  }

  if (state.screen === 'S02') {
    const info = state.information;
    const list = element('div', 'info-list');
    const identity = element('dl', 'info-group');
    const teamGoal = info.team === 'Mafia'
      ? 'Keep at least one mafia member alive when the final roundtable ends.'
      : 'Eliminate every mafia member before ending the final roundtable.';
    const role = roles[info.role];
    const roleRow = infoRow('Role', info.role, role?.character);
    const task = info.roleTask ?? formatRoleTask(info.role);
    if (task) roleRow.append(element('dd', 'role-task', task));
    identity.append(infoRow('Team', info.team, teamGoal), roleRow);
    if (info.otherMafia) identity.append(infoRow('Other mafia', info.otherMafia.join(', ')));
    const mission = element('dl', 'info-group');
    mission.append(infoRow('Secret mission', info.mission, 'Complete this before the final roundtable to stay alive.'));
    const observation = element('dl', 'info-group');
    observation.append(
      infoRow('Observer', info.observer, "This person confirms when you complete your mission. You can tell them when you're about to do it so they know."),
      infoRow('You observe', info.observes, 'Confirm when this person completes their mission. They are allowed to tell you and communicate with you about it.'));
    const spy = element('dl', 'info-group');
    spy.append(infoRow('You spy on', info.spiesOn, 'Guess this person’s secret mission to eliminate them. You have two guesses for the whole night.'));
    list.append(identity, mission, observation, spy);
    const next = button('Next', () => dispatch({ type: 'next' }));
    next.classList.add('screen-action');
    if (state.viewingRole) next.dataset.navigation = 'return';
    content.append(list, next);
  }

  if (state.screen === 'S03') {
    content.classList.add('arrival-content');
    const arrived = button("I've arrived", () => dispatch({ type: 'arrive' }));
    arrived.disabled = state.arrived;
    arrived.setAttribute('aria-pressed', String(state.arrived));
    content.append(element('p', 'arrival-description', 'Press this button once you’ve arrived at the rendezvous point.'), arrived);
  }

  if (state.screen === 'S04') {
    const list = element('fieldset', 'buddy-list');
    list.append(element('legend', '', 'Buddy'));
    state.buddies.forEach(buddy => {
      const choice = element('label', 'buddy-choice');
      const input = element('input');
      Object.assign(input, { type: 'radio', name: 'buddy', value: buddy.id, checked: state.selectedBuddyId === buddy.id, disabled: Boolean(state.selectedBuddyId) });
      input.addEventListener('change', () => dispatch({ type: 'buddy', playerId: buddy.id }));
      choice.append(input, document.createTextNode(buddy.name));
      list.append(choice);
    });
    content.append(list);
  }

  if (state.screen === 'S05') {
    content.classList.add('mic-content');
    const details = element('div', 'mic-details');
    const mic = element('span', 'mic-icon');
    mic.setAttribute('aria-hidden', 'true');
    const speaker = element('p', 'mic-name', state.mic.speaker);
    speaker.setAttribute('aria-live', 'polite');
    const timer = element('p', 'mic-timer', formatTime(seconds));
    timer.setAttribute('role', 'timer');
    timer.setAttribute('aria-label', 'Time remaining');
    details.append(mic, speaker, element('p', 'mic-selected', 'selected'), element('p', 'mic-name', state.mic.buddy), timer);
    content.append(details);
    if (state.mic.canFinish) {
      const done = button('Done', () => dispatch({ type: 'done', turnId: state.mic.turnId }));
      done.dataset.action = 'done';
      done.disabled = seconds === 0;
      content.append(done);
    }
  }

  shell.append(content);
  return shell;
}

// The server/scenario screen keeps advancing while the player reads their role.
export function roleView(state, open) {
  return open && state.canViewRole && state.information
    ? { ...state, screen: 'S02', viewingRole: true }
    : state;
}

export function formatTime(seconds) { return `00:${String(seconds).padStart(2, '0')}`; }
