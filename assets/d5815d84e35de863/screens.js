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

function infoRow(label, value, className = '') {
  const row = element('div', `info-row ${className}`);
  row.append(element('dt', '', `${label}:`), element('dd', '', value));
  return row;
}

export function renderScreen(state, dispatch, seconds) {
  const shell = element('section', 'game-shell');
  shell.dataset.screen = state.screen;
  shell.setAttribute('aria-label', 'Game screen');
  shell.append(element('h1', 'brand', 'Suspicion'));
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
    const list = element('dl', 'info-list');
    list.append(infoRow('Team', info.team), infoRow('Role', info.role));
    if (info.otherMafia) list.append(infoRow('Other mafia', info.otherMafia.join(', ')));
    list.append(infoRow('Secret mission', info.mission, 'info-row--mission'),
      infoRow('Observer', info.observer), infoRow('You observe', info.observes), infoRow('You spy on', info.spiesOn));
    const next = button('Next', () => dispatch({ type: 'next' }));
    next.classList.add('screen-action');
    content.append(list, next);
  }

  if (state.screen === 'S03') {
    content.classList.add('arrival-content');
    const arrived = button('Arrived', () => dispatch({ type: 'arrive' }));
    arrived.disabled = state.arrived;
    arrived.setAttribute('aria-pressed', String(state.arrived));
    content.append(arrived);
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

export function formatTime(seconds) { return `00:${String(seconds).padStart(2, '0')}`; }
