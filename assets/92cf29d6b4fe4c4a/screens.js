import { roles, formatRoleTask } from './roles.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, action, { variant = 'primary', submit = false } = {}) {
  const node = element('button', `game-button game-button--${variant}`, text);
  node.type = submit ? 'submit' : 'button';
  if (action) node.addEventListener('click', action);
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

function assignmentCard(label, value, ...lines) {
  const instructions = lines.filter(Boolean);
  const card = element(instructions.length ? 'details' : 'div', 'assignment-card');
  const heading = element(instructions.length ? 'summary' : 'div', 'assignment-heading');
  heading.append(element('span', 'assignment-label', label));
  if (value != null) heading.append(element('strong', 'assignment-value', value));
  card.append(heading);
  if (instructions.length) {
    card.name = 'assignments';
    card.dataset.assignment = label;
    const body = element('div', 'assignment-instructions');
    for (const line of instructions) body.append(element('p', '', line));
    card.append(body);
  }
  return card;
}

function missionCard(mission) {
  const card = assignmentCard('Secret Mission', null, mission, 'Complete this before the final roundtable to stay alive.');
  card.classList.add('mission-card');
  return card;
}

// The intro belongs to the joining browser. The server still controls the player's game screen.
export function createIntro() {
  let screen = 'welcome';
  return {
    view(state) {
      return state.screen === 'S01' && screen ? { screen } : state;
    },
    advance(action) {
      if (action === 'play' && screen === 'welcome') screen = 'game-info';
      else if (action === 'continue' && screen === 'game-info') screen = null;
      else return false;
      return true;
    },
  };
}

export function renderScreen(app, state, dispatch, seconds) {
  const shell = element('section', 'game-shell');
  shell.dataset.screen = state.screen;
  shell.setAttribute('aria-label', 'Game screen');
  const header = element('header', 'game-header');
  const brand = element('h1', 'brand', 'Suspicion');
  brand.tabIndex = -1;
  header.append(brand);
  if (state.canViewRole) {
    const role = button('My Role', () => dispatch({ type: 'role' }), { variant: 'secondary' });
    role.classList.add('role-button');
    role.dataset.navigation = 'role';
    role.setAttribute('aria-pressed', String(Boolean(state.viewingRole)));
    header.append(role);
  }
  if (state.screen !== 'welcome') shell.append(header);
  const content = element(['S00', 'S01'].includes(state.screen) ? 'form' : 'div', 'screen-content');

  if (state.screen === 'welcome') {
    content.classList.add('welcome-poster');
    const title = element('h1', 'poster-title');
    title.setAttribute('aria-label', 'Welcome to Suspicion');
    for (const word of ['Welcome', 'to', 'Suspicion']) {
      const stamp = element('span', `poster-word poster-${word.toLowerCase()}`);
      stamp.append(element('span', 'poster-ink', word));
      stamp.setAttribute('aria-hidden', 'true');
      title.append(stamp);
    }
    const play = button('Play', () => dispatch({ type: 'play' }));
    play.classList.add('poster-play');
    content.append(title, play);
  }

  if (state.screen === 'game-info') {
    const brief = element('div', 'game-brief');
    const heading = element('h2', 'screen-statement', 'A game of deception, trials, and secret missions.');
    heading.tabIndex = -1;
    const twist = element('p', 'brief-aside', 'And most importantly, drinking.');
    const objective = element('div', 'brief-objective');
    objective.append(
      element('h3', 'section-title', 'Your objective'),
      element('p', '', 'Reach the final roundtable alive. Make sure only your team is left for the final vote.')
    );
    brief.append(heading, twist, objective);
    const proceed = button('Continue', () => dispatch({ type: 'continue' }));
    proceed.classList.add('screen-action');
    content.append(brief, proceed);
  }

  if (state.screen === 'S00') {
    const password = field('Password', 'password', 'password', '');
    password.input.autocomplete = 'current-password';
    const dialog = element('dialog', 'game-dialog');
    const title = element('h2', 'section-title', 'Wrong password');
    title.id = 'wrong-password-title';
    dialog.setAttribute('aria-labelledby', title.id);
    const actions = element('div', 'dialog-actions');
    actions.append(button('Try again', () => dialog.close()));
    dialog.append(title, actions);
    dialog.addEventListener('close', () => {
      password.input.focus();
      password.input.select();
    });
    shell.append(dialog);
    const enter = button('Enter', null, { submit: true });
    enter.classList.add('screen-action');
    enter.disabled = true;
    password.input.addEventListener('input', () => {
      password.input.removeAttribute('aria-invalid');
      enter.disabled = password.input.value.length === 0;
    });
    content.addEventListener('submit', event => {
      event.preventDefault();
      if (!enter.disabled) dispatch({ type: 'unlock', password: password.input.value });
    });
    const fields = element('div', 'form-fields');
    fields.append(password.wrapper);
    content.append(fields, enter);
  }

  if (state.screen === 'S01') {
    const name = field('Name', 'name', 'text', state.player.name);
    const number = field('Drunk number', 'drunkNumber', 'number', state.player.drunkNumber);
    const hint = element('span', 'field-description', 'Type the number of drinks it takes to get drunk.');
    hint.id = 'drunk-number-description';
    number.input.setAttribute('aria-describedby', hint.id);
    number.wrapper.append(hint);
    const next = button('Next', null, { submit: true });
    next.classList.add('screen-action');
    const update = () => {
      const value = number.input.value;
      next.disabled = !state.canJoin || !name.input.value.trim() || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0;
    };
    content.addEventListener('input', update);
    content.addEventListener('submit', event => {
      event.preventDefault();
      if (!next.disabled) dispatch({ type: 'join', name: name.input.value.trim(), drunkNumber: Number(number.input.value) });
    });
    const fields = element('div', 'form-fields');
    fields.append(name.wrapper, number.wrapper);
    content.append(fields, next);
    update();
  }

  if (state.screen === 'S02') {
    const info = state.information;
    const list = element('div', 'role-details');
    list.tabIndex = 0;
    list.setAttribute('role', 'region');
    list.setAttribute('aria-label', 'Role information');
    const teamGoal = info.team === 'Mafia'
      ? 'Keep at least one mafia member alive when the final roundtable ends.'
      : 'Eliminate every mafia member before ending the final roundtable.';
    const role = roles[info.role];
    list.append(assignmentCard('Team', info.team, teamGoal),
      assignmentCard('Role', info.role, role?.character, info.roleTask ?? formatRoleTask(info.role)));
    if (info.otherMafia) list.append(assignmentCard('Other mafia', String(info.otherMafia.length), ...info.otherMafia));
    list.append(missionCard(info.mission));
    const next = button(state.viewingRole ? 'Back' : 'Next', () => dispatch({ type: state.viewingRole ? 'back' : 'next' }));
    next.classList.add('screen-action');
    if (state.viewingRole) next.dataset.navigation = 'return';
    content.append(list, next);
  }

  if (state.screen === 'S03') {
    content.classList.add('arrival-content');
    const arrived = button("I've arrived", () => dispatch({ type: 'arrive' }));
    arrived.disabled = state.arrived;
    arrived.setAttribute('aria-pressed', String(state.arrived));
    arrived.setAttribute('aria-busy', String(state.arrived));
    content.append(element('p', 'arrival-description screen-statement', 'Press this button once you’ve arrived at the rendezvous point.'), arrived);
  }

  if (state.screen === 'S04') {
    const list = element('fieldset', 'buddy-list');
    list.setAttribute('aria-busy', String(Boolean(state.selectedBuddyId)));
    list.append(element('legend', state.selectedBuddyId ? 'waiting-indicator' : '', 'Buddy'));
    const players = element('div', 'player-list');
    state.buddies.forEach(buddy => {
      const choice = element('label', 'buddy-choice');
      const input = element('input');
      Object.assign(input, { type: 'radio', name: 'buddy', value: buddy.id, checked: state.selectedBuddyId === buddy.id, disabled: Boolean(state.selectedBuddyId) });
      input.addEventListener('change', () => dispatch({ type: 'buddy', playerId: buddy.id }));
      choice.append(input, element('span', 'player-name', buddy.name));
      players.append(choice);
    });
    list.append(players);
    content.append(list);
  }

  if (state.screen === 'S05') {
    content.classList.add('mic-content');
    const details = element('div', 'mic-details');
    const mic = element('span', 'mic-icon');
    mic.setAttribute('aria-hidden', 'true');
    const emblem = element('span', 'mic-emblem');
    emblem.setAttribute('aria-hidden', 'true');
    emblem.append(mic);
    const speaker = element('p', 'mic-name', state.mic.speaker);
    speaker.setAttribute('aria-live', 'polite');
    const timer = element('p', 'mic-timer', formatTime(seconds));
    timer.setAttribute('role', 'timer');
    timer.setAttribute('aria-label', 'Time remaining');
    const pair = element('div', 'mic-pair');
    pair.append(speaker, element('p', 'mic-selected', 'selected'), element('p', 'mic-name', state.mic.buddy));
    details.append(emblem, pair, timer);
    content.append(details);
    const actions = element('div', 'mic-actions');
    if (state.mic.canFinish) {
      const done = button('Done', () => dispatch({ type: 'done', turnId: state.mic.turnId }));
      done.dataset.action = 'done';
      done.disabled = seconds === 0;
      actions.append(done);
    }
    actions.append(button('Skip', () => dispatch({ type: 'skip' }), { variant: 'secondary' }));
    content.append(actions);
  }

  if (state.screen === 'S06') {
    content.classList.add('holding-content');
    content.append(missionCard(state.information.mission),
      assignmentCard('Observer', state.holding.observer, "This person confirms when you complete your mission. You can tell them when you're about to do it so they know."),
      assignmentCard('You observe', state.holding.observes, 'Confirm when this person completes their mission. They are allowed to tell you and communicate with you about it.'),
      assignmentCard('You spy on', state.holding.spiesOn, 'Guess this person’s secret mission to eliminate them. You have two guesses for the whole night.'));
  }

  shell.append(content);
  // A background game transition can redraw the role the player is reading.
  const roleScroll = app.querySelector('.role-details')?.scrollTop;
  const openAssignment = app.firstElementChild?.dataset.screen === state.screen
    && app.querySelector('details[open]')?.dataset.assignment;
  if (openAssignment) {
    const matchingCard = [...shell.querySelectorAll('details')].find(card => card.dataset.assignment === openAssignment);
    if (matchingCard) matchingCard.open = true;
  }
  const previousScreen = app.firstElementChild?.dataset.screen;
  app.replaceChildren(shell);
  if (previousScreen === 'welcome' && state.screen === 'game-info') content.querySelector('h2').focus();
  if (previousScreen === 'game-info' && state.screen === 'S01') brand.focus();
  if (roleScroll && state.screen === 'S02') shell.querySelector('.role-details').scrollTop = roleScroll;
}

export function roleView(state, open) {
  return open && state.canViewRole && state.information
    ? { ...state, screen: 'S02', viewingRole: true }
    : state;
}

export function formatTime(seconds) { return `00:${String(seconds).padStart(2, '0')}`; }

export function applyTheme() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',
    getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim());
}
