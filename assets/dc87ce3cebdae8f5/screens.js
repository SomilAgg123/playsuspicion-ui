import { revealPaper } from './role-reveal.js';
import { drinkingPlans } from './drinking-plans.js';
import { roles, formatRoleTask } from './roles.js';
import { missions, spyGuessLimit } from './missions.js';

const discussionPages = {
  'death-report': "I've been killed",
  observation: "I've observed a secret mission",
  spy: 'I spy a secret mission',
};

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

function drinkingPlanField(numberInput, initialPlan, update) {
  const question = 'How much are you drinking tonight?';
  const wrapper = element('div', 'game-field');
  const label = element('label', '', question);
  label.htmlFor = 'drinking-plan';
  const dialog = element('dialog', 'game-dialog');
  dialog.id = 'drinking-plan-dialog';
  dialog.setAttribute('closedby', 'any');
  const title = element('h2', 'section-title', question);
  title.id = 'drinking-plan-title';
  dialog.setAttribute('aria-labelledby', title.id);
  const actions = element('div', 'dialog-actions drinking-options');
  const current = drinkingPlans.find(plan => plan.id === initialPlan);
  const opener = button(current?.label ?? 'Choose an option', () => {
    const number = numberInput.validity.valid ? numberInput.valueAsNumber : null;
    actions.replaceChildren();
    for (const plan of drinkingPlans) {
      const option = button(plan.label, () => {
        opener.value = plan.id;
        opener.textContent = plan.label;
        update();
        dialog.close();
      }, { variant: 'secondary' });
      option.setAttribute('aria-pressed', String(opener.value === plan.id));
      option.autofocus = opener.value === plan.id;
      option.append(element('span', 'field-description', plan.amount(number)));
      actions.append(option);
    }
    dialog.showModal();
  }, { variant: 'secondary' });
  opener.id = label.htmlFor;
  opener.value = current?.id ?? '';
  opener.classList.add('plan-picker');
  opener.setAttribute('aria-haspopup', 'dialog');
  opener.setAttribute('aria-controls', dialog.id);
  label.id = 'drinking-plan-label';
  opener.setAttribute('aria-labelledby', label.id + ' ' + opener.id);

  dialog.append(title, actions);
  dialog.addEventListener('close', () => opener.focus());
  wrapper.append(label, opener);
  return { wrapper, opener, dialog };
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

function discussionForm(content, state, dispatch) {
  const details = state.discussion;
  const status = element('p');
  status.setAttribute('role', 'status');
  status.tabIndex = -1;
  const back = button('Back', () => dispatch({ type: 'back' }), { variant: 'secondary' });
  back.dataset.navigation = 'return';
  content.classList.add('discussion-content');
  content.append(element('h2', 'screen-statement', discussionPages[state.page]));
  if (state.page === 'death-report') {
    if (state.dead) status.textContent = "You've been killed.";
    else content.append(button('Confirm', () => dispatch({ type: 'report-death' }), { variant: 'destructive' }));
  }
  if (state.page === 'observation') {
    content.append(assignmentCard('You observe', state.missions.observes), element('p', '', details.observedMission));
    if (details.observationConfirmed) status.textContent = 'Mission confirmed.';
    else content.append(button('Confirm', () => dispatch({ type: 'confirm-observation' })));
  }
  if (state.page === 'spy') {
    content.append(assignmentCard('You spy on', state.missions.spiesOn));
    const remaining = spyGuessLimit - details.guesses.length;
    if (details.spyCorrect) status.textContent = 'Correct guess. Your target has been killed.';
    else if (state.dead) status.textContent = 'Dead players cannot spy.';
    else {
      const count = remaining === 1 ? '1 guess left.' : `${remaining} guesses left.`;
      status.textContent = details.guesses.length ? `Incorrect guess. ${count}` : count;
      if (remaining > 0) {
        const field = element('label', 'game-field');
        const label = element('span', '', 'Secret Mission');
        label.id = 'spy-mission-label';
        const select = element('select');
        select.setAttribute('aria-labelledby', label.id);
        const empty = element('option', '', 'Choose a mission');
        empty.value = '';
        empty.disabled = true;
        empty.selected = true;
        select.append(empty);
        missions.forEach((mission, index) => {
          const option = element('option', '', mission('someone'));
          option.value = String(index);
          option.disabled = details.guesses.includes(index);
          select.append(option);
        });
        field.append(label, select);
        const submit = button('Submit guess', () => dispatch({
          type: 'guess-mission', missionIndex: Number(select.value), attempt: details.guesses.length + 1,
        }));
        submit.disabled = true;
        select.addEventListener('change', () => { submit.disabled = select.value === ''; });
        content.append(field, submit);
      }
    }
  }
  content.append(status, back);
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
  for (const [page, label, available] of [['missions', 'Missions', state.missions], ['role', 'Role', state.canViewRole]]) {
    if (!available) continue;
    const link = button(label, () => dispatch({ type: page }), { variant: 'secondary' });
    link.dataset.navigation = page;
    link.setAttribute('aria-pressed', String(state.page === page || (page === 'missions' && state.screen === 'S06')));
    header.append(link);
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
    const plan = drinkingPlanField(number.input, state.player.drinkingPlan, update);
    shell.append(plan.dialog);
    const next = button('Next', null, { submit: true });
    next.classList.add('screen-action');
    function update() {
      next.disabled = !state.canJoin || !plan.opener.value || !name.input.value.trim() || !number.input.validity.valid;
    }
    content.addEventListener('input', update);
    content.addEventListener('submit', event => {
      event.preventDefault();
      if (!next.disabled) dispatch({ type: 'join', name: name.input.value.trim(), drunkNumber: Number(number.input.value), drinkingPlan: plan.opener.value });
    });
    const fields = element('div', 'form-fields');
    fields.append(name.wrapper, number.wrapper, plan.wrapper);
    content.append(fields, next);
    update();
  }

  if (state.screen === 'role-briefing') {
    const brief = element('div', 'game-brief role-briefing');
    const heading = element('h2', 'screen-statement matchup');
    heading.tabIndex = -1;
    heading.append('Mafia ', element('span', 'matchup-versus', 'vs.'), ' Community');
    const list = element('ol', 'briefing-goals');
    list.append(
      element('li', '', 'Help your team win by getting your team members to the end'),
      element('li', '', 'Complete your secret mission before the final roundtable'));
    const goals = element('div');
    goals.append(element('p', '', 'You have two goals tonight:'), list);
    brief.append(heading,
      element('p', '', 'Everyone has a part to play. In the next screen, you’ll discover yours.'),
      goals,
      element('p', '', 'If you are voted out, there is a way to return for the final roundtable...stay tuned...'));
    const reveal = button('Reveal my role', () => revealPaper(app, () => dispatch({ type: 'reveal-role' }), 'S02'));
    reveal.classList.add('screen-action');
    content.append(brief, reveal);
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
    content.append(list);
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

  if (state.screen === 'mission-briefing') {
    const brief = element('div', 'game-brief mission-briefing');
    const heading = element('h2', 'screen-statement', 'Let the suspicion commence.');
    heading.tabIndex = -1;
    brief.append(heading,
      element('p', '', 'Tonight, you’ll observe another player. They’ll ask you to confirm when they’ve completed their secret mission. You have an observer of your own.'),
      element('p', '', state.information.team === 'Community'
        ? 'You’re also spying on someone. Watch what they do. You can guess their secret mission during discussion or at the final roundtable. You have two guesses for the whole night. A correct guess kills your target.'
        : 'You’re also spying on someone. Watch what they do. At the final roundtable, you’ll choose from a list and guess their secret mission. If you guess correctly, your target is killed before they can take a seat.'));
    const reveal = button('Reveal my missions', () => revealPaper(app, () => dispatch({ type: 'reveal-missions' }), 'S06'));
    reveal.classList.add('screen-action');
    content.append(brief, reveal);
  }

  if (state.screen === 'S06') {
    content.classList.add('missions-content');
    content.append(missionCard(state.information.mission),
      assignmentCard('Observer', state.missions.observer, "This person confirms when you complete your mission. You can tell them when you're about to do it so they know."),
      assignmentCard('You observe', state.missions.observes, 'Confirm when this person completes their mission. They are allowed to tell you and communicate with you about it.'),
      assignmentCard('You spy on', state.missions.spiesOn, 'Guess this person’s secret mission to eliminate them. You have two guesses for the whole night.'));
  }

  if (state.screen === 'S02' || state.screen === 'S06') {
    const advance = state.screen === 'S02' ? 'next' : 'finish-missions';
    const next = button(state.page ? 'Back' : 'Next', () => dispatch({ type: state.page ? 'back' : advance }));
    next.classList.add('screen-action');
    if (state.page) next.dataset.navigation = 'return';
    content.append(next);
  }

  if (state.screen === 'S07') {
    content.classList.add('discussion-content');
    content.append(element('h2', 'screen-statement', 'Discuss your suspicions'));
    if (state.dead) content.append(element('p', '', "You've been killed."));
    if (state.discussion) {
      for (const [page, label] of Object.entries(discussionPages)) {
        const action = button(label, () => dispatch({ type: page }), { variant: 'secondary' });
        action.dataset.navigation = page;
        content.append(action);
      }
    }
  }
  if (Object.hasOwn(discussionPages, state.screen)) discussionForm(content, state, dispatch);

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
  if (previousScreen === state.screen && Object.hasOwn(discussionPages, state.screen)) {
    content.querySelector('[role="status"]')?.focus();
  }
  if ((previousScreen === 'welcome' && state.screen === 'game-info') ||
      (previousScreen === 'S01' && state.screen === 'role-briefing')) content.querySelector('h2').focus();
  if (previousScreen !== state.screen && state.screen === 'mission-briefing') content.querySelector('h2').focus();
  if ((previousScreen === 'role-briefing' && state.screen === 'S02') ||
      (previousScreen === 'mission-briefing' && state.screen === 'S06') ||
      (previousScreen === 'S06' && state.screen === 'S07')) brand.focus();
  if (previousScreen === 'game-info' && state.screen === 'S01') brand.focus();
  if (roleScroll && state.screen === 'S02') shell.querySelector('.role-details').scrollTop = roleScroll;
}

export function createNavigation() {
  let page = null;
  return {
    view(state) {
      if (page === 'role' && state.canViewRole) return { ...state, screen: 'S02', page };
      if (page === 'missions' && state.missions && state.screen !== 'S06') return { ...state, screen: 'S06', page };
      if (state.screen === 'S07' && state.discussion && Object.hasOwn(discussionPages, page)) return { ...state, screen: page, page };
      page = null;
      return state;
    },
    navigate(action, state) {
      const previous = page;
      if (action === 'back' && page) page = null;
      else if (action === 'role' && state.canViewRole) page = page === action ? null : action;
      else if (action === 'missions' && state.missions) page = page === action || state.screen === 'S06' ? null : action;
      else if (state.screen === 'S07' && state.discussion && Object.hasOwn(discussionPages, action)) page = action;
      else return;
      return page ? '.brand' : `[data-navigation="${action === 'back' ? previous : action}"]`;
    },
  };
}

export function formatTime(seconds) { return `00:${String(seconds).padStart(2, '0')}`; }

export function applyTheme() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',
    getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim());
}
