import { revealPaper } from './role-reveal.js';
import { drinkingPlans, planDescription, formatDrinkServing } from './drinking-plans.js';
import { roles, formatRoleTask } from './roles.js';
import { missions } from './missions.js';
import { partyTasks } from './party-tasks.js';

const discussionPages = {
  'death-report': () => "I've been killed",
  'mission-report': () => "I've completed my secret mission",
  spy: ({ spiesOn }) => `I think I know ${spiesOn}’s secret mission`,
};

function canOpenDiscussionPage(state, page) {
  return state.screen === 'S07' && state.discussion && Object.hasOwn(discussionPages, page)
    && (page !== 'death-report' || state.information.team === 'Townsfolk');
}

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
      option.append(element('span', 'field-description', planDescription(plan, number)));
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

function missionCard(info) {
  const card = assignmentCard('Secret Mission', info.missionConfirmed ? 'Done' : null, info.mission,
    info.missionConfirmed ? null : 'Complete this before the final roundtable to stay alive.');
  card.classList.add('mission-card');
  return card;
}

function taskScreen(content, state, dispatch) {
  const { key, stage, players, placements } = state.task;
  const title = element('h2', 'section-title task-title', 'New Task');
  const prompt = element('p', 'screen-statement', partyTasks[key].prompt);
  prompt.id = 'task-prompt';
  title.setAttribute('aria-describedby', prompt.id);
  content.classList.add('discussion-content');
  content.append(title, prompt);
  const status = element('p');
  status.setAttribute('role', 'status');
  if (stage === 'ready') {
    content.append(button('Done', () => dispatch({ type: 'finish-task', key })));
  } else if (stage === 'partner') {
    const field = element('label', 'game-field', 'Who was your partner?');
    const select = element('select');
    select.append(new Option('Choose your partner', ''));
    for (const player of [...players].sort((a, b) => a.name.localeCompare(b.name))) {
      select.append(new Option(player.name, player.id));
    }
    const confirm = button('Confirm partner', () => dispatch({ type: 'choose-task-partner', key, partnerId: select.value }));
    confirm.disabled = true;
    select.addEventListener('change', () => { confirm.disabled = !select.value; });
    field.append(select);
    content.append(field, confirm);
  } else if (placements) {
    const result = stage === 'result' ? element('dialog', 'game-dialog') : element('section', 'game-panel');
    const heading = element('h2', 'section-title', 'Task results');
    heading.id = 'task-results';
    result.setAttribute('aria-labelledby', heading.id);
    result.append(heading);
    for (const [index, { multiplier, names }] of placements.entries()) {
      const row = element('p', 'task-placement');
      const place = ['Last', 'Second to last', 'Third to last'][index];
      row.append(element('span', '', place + ' · ' + multiplier + '×'), element('strong', '', names.join(' & ')));
      result.append(row);
    }
    if (stage === 'result') {
      const acknowledge = () => dispatch({ type: 'acknowledge-task', key });
      const actions = element('div', 'dialog-actions');
      actions.append(button('Continue', acknowledge));
      result.append(actions);
      result.addEventListener('cancel', event => { event.preventDefault(); acknowledge(); });
    } else {
      status.textContent = 'Waiting for the task to finish.';
    }
    content.append(result);
  } else {
    status.textContent = 'Waiting for everyone to finish.';
  }
  content.append(status);
}

function spyForm(app, content, details, dispatch) {
  const field = element('label', 'game-field', 'Secret Mission');
  const select = element('select');
  const empty = element('option', '', 'Choose a mission');
  empty.value = '';
  empty.disabled = true;
  select.append(empty);
  missions.forEach((mission, index) => {
    const option = element('option', '', mission('someone'));
    option.value = String(index);
    select.append(option);
  });
  const saved = details.spyGuess;
  select.dataset.savedGuess = saved ?? '';
  select.value = saved === null ? '' : String(saved);
  field.append(select);

  const dialog = element('dialog', 'game-dialog');
  dialog.id = 'spy-logged';
  const title = element('h2', 'section-title', 'Guess logged');
  title.id = 'spy-logged-title';
  dialog.setAttribute('aria-labelledby', title.id);
  const message = element('p', '', 'You’ll find out at the final roundtable if you were correct. You can change your guess until then.');
  message.id = 'spy-logged-message';
  dialog.setAttribute('aria-describedby', message.id);
  const actions = element('div', 'dialog-actions');
  actions.append(button('OK', () => dialog.close()));
  dialog.append(title, message, actions);
  dialog.addEventListener('close', () => select.focus());

  const submit = button(saved === null ? 'Log guess' : 'Update guess', async () => {
    const logged = await dispatch({ type: 'guess-mission', missionIndex: Number(select.value), previousGuess: saved });
    if (logged) app.querySelector('#spy-logged')?.showModal();
  });
  submit.disabled = true;
  select.addEventListener('change', () => { submit.disabled = !select.value || Number(select.value) === saved; });
  content.append(field, submit, dialog);
}

function discussionForm(app, content, state, dispatch) {
  const details = state.discussion;
  const status = element('p');
  status.setAttribute('role', 'status');
  status.tabIndex = -1;
  const back = button('Back', () => dispatch({ type: 'back' }), { variant: 'secondary' });
  back.dataset.navigation = 'return';
  content.classList.add('discussion-content');
  content.append(element('h2', 'screen-statement', discussionPages[state.page](state.missions)));
  if (state.page === 'death-report') {
    if (state.dead) status.textContent = "You've been killed.";
    else content.append(button('Confirm', () => dispatch({ type: 'report-death' }), { variant: 'destructive' }));
  }
  if (state.page === 'mission-report') {
    content.append(element('p', '', state.information.mission));
    if (state.information.missionConfirmed) {
      status.textContent = details.missionObserver ? `Confirmed by ${details.missionObserver}.` : 'Mission confirmed.';
    } else if (details.missionObserver) {
      status.textContent = `Check with ${details.missionObserver}. They’ve been asked to verify your mission.`;
    } else {
      content.append(button('Report completion', () => dispatch({ type: 'report-mission' })));
    }
  }
  if (state.page === 'spy') {
    if (state.dead) {
      if (details.spyGuess !== null) content.append(element('p', '', missions[details.spyGuess]('someone')));
      status.textContent = 'Dead players cannot spy.';
    } else {
      spyForm(app, content, details, dispatch);
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
      if (action !== 'play' || screen !== 'welcome') return false;
      screen = null;
      return true;
    },
  };
}

// Retain the originating controls so a check can return to an unsubmitted selection.
export function createScreenRenderer(app, dispatch) {
  let pageSignature;
  let returnScreen;
  let displayedCheck;
  const checksButton = button('', () => dispatch({ type: 'observer-checks' }), { variant: 'secondary' });
  checksButton.dataset.observerChecks = '';

  return (state, force = false) => {
    const { observerChecks, openObserverCheck, ...page } = state;
    if (openObserverCheck) {
      if (!displayedCheck) returnScreen = app.firstElementChild;
      const checkSignature = JSON.stringify(openObserverCheck);
      if (checkSignature !== displayedCheck || force) {
        const checkPage = openObserverCheck.kind === 'drink'
          ? { screen: 'drink', drink: openObserverCheck }
          : { screen: 'mission-check', check: openObserverCheck };
        renderScreen(app, { ...page, ...checkPage, page: 'observer-checks' }, dispatch);
      }
      displayedCheck = checkSignature;
      return;
    }

    const signature = JSON.stringify(page);
    if (returnScreen) app.replaceChildren(returnScreen);
    if (signature !== pageSignature || force) renderScreen(app, page, dispatch);
    pageSignature = signature;
    const shell = app.firstElementChild;
    if (observerChecks) {
      checksButton.textContent = `Observer checks (${observerChecks.count})`;
      if (checksButton.parentNode !== shell) shell.append(checksButton);
    } else {
      checksButton.remove();
    }
    if (displayedCheck && shell.dataset.screen === returnScreen?.dataset.screen && !shell.querySelector('dialog[open]')) {
      (observerChecks ? checksButton : shell.querySelector('.brand'))?.focus();
    }
    returnScreen = null;
    displayedCheck = null;
  };
}

function renderScreen(app, state, dispatch) {
  const shell = element('section', 'game-shell');
  shell.dataset.screen = state.screen;
  shell.setAttribute('aria-label', 'Game screen');
  const header = element('header', 'game-header');
  const brand = element('h1', 'brand');
  brand.append(element('span', 'brand-word', 'Suspicion'));
  brand.tabIndex = -1;
  header.append(brand);
  for (const [page, label, available] of [['missions', 'Missions', state.missions], ['role', 'Role', state.canViewRole]]) {
    if (!available) continue;
    const link = button(label, () => dispatch({ type: page }), { variant: 'secondary' });
    link.dataset.navigation = page;
    link.setAttribute('aria-pressed', String(state.page === page || (page === 'missions' && state.screen === 'S06')));
    header.append(link);
  }
  if (state.screen !== 'welcome' && state.screen !== 'game-info') shell.append(header);
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
    const brief = element('div', 'intro-poster');
    const heading = element('h2', 'screen-statement', 'A game of deception, trials, and secret missions.');
    heading.tabIndex = -1;
    const twist = element('p', 'brief-aside', 'And most importantly, drinking.');
    const objective = element('div', 'brief-objective');
    objective.append(
      element('h3', 'section-title', 'Your objective'),
      element('p', '', 'Reach the final roundtable alive. Make sure only your team is left for the final vote.')
    );
    brief.append(brand, heading, twist, objective);
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
    enter.disabled = !state.unlocked;
    password.input.addEventListener('input', () => {
      password.input.removeAttribute('aria-invalid');
      enter.disabled = password.input.value.length === 0;
    });
    content.addEventListener('submit', event => {
      event.preventDefault();
      if (!enter.disabled) dispatch({ type: 'unlock', password: password.input.value, team: content.elements.team.value });
    });
    const fields = element('div', 'form-fields');
    if (!state.unlocked) fields.append(password.wrapper);
    const team = element('fieldset', 'team-fieldset');
    team.append(element('legend', '', 'Enter as'));
    const options = element('div', 'team-options');
    for (const label of ['Outlaws', 'Townsfolk']) {
      const choice = element('label', 'team-choice');
      const input = element('input');
      const value = label.toLowerCase();
      Object.assign(input, { type: 'radio', name: 'team', value, checked: value === state.sampleTeam });
      choice.append(input, label);
      options.append(choice);
    }
    team.append(options);
    fields.append(team);
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
    fields.append(element('p', 'join-intro', 'Before you get to the Saloon, we need to know a few things about you:'), name.wrapper, number.wrapper, plan.wrapper);
    content.append(fields, next);
    update();
  }

  if (state.screen === 'role-briefing') {
    const brief = element('div', 'game-brief role-briefing');
    const heading = element('h2', 'screen-statement matchup');
    heading.tabIndex = -1;
    heading.append('Outlaws ', element('span', 'matchup-versus', 'vs.'), ' Townsfolk');
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
    const teamGoal = info.team === 'Outlaws'
      ? 'Keep at least one Outlaw alive when the final roundtable ends.'
      : 'Eliminate every Outlaw before ending the final roundtable.';
    const role = roles[info.role];
    list.append(assignmentCard('Team', info.team, teamGoal),
      assignmentCard('Role', info.role, role?.character, info.roleTask ?? formatRoleTask(info.role)));
    if (info.otherOutlaws) list.append(assignmentCard('Other Outlaws', String(info.otherOutlaws.length), ...info.otherOutlaws));
    list.append(missionCard(info));
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

  if (state.screen === 'mission-briefing') {
    const brief = element('div', 'game-brief mission-briefing');
    const heading = element('h2', 'screen-statement', 'In the saloon, you have missions:');
    heading.tabIndex = -1;
    const roles = element('ul', 'briefing-goals');
    roles.append(
      element('li', '', 'Observer - you will be pinged throughout the night to observe secret missions, drinks, and other nefarious activities'),
      element('li', '', "Spy - you are spying on your target to figure out what their secret mission is. if you guess it, they don't make it to the roundtable."));
    brief.append(heading, roles);
    const reveal = button('Reveal my missions', () => revealPaper(app, () => dispatch({ type: 'reveal-missions' }), 'S06'));
    reveal.disabled = !state.canRevealMissions;
    reveal.setAttribute('aria-busy', String(!state.canRevealMissions));
    reveal.classList.add('screen-action');
    content.append(brief, reveal);
  }

  if (state.screen === 'S06') {
    content.classList.add('missions-content');
    content.append(missionCard(state.information),
      assignmentCard('You spy on', state.missions.spiesOn, 'Log your guess during discussion. You can change it until the final roundtable, when a correct guess eliminates this person.'));
  }

  if (state.screen === 'S02' || state.screen === 'S06') {
    const advance = state.screen === 'S02' ? 'next' : 'finish-missions';
    const next = button(state.page ? 'Back' : 'Next', () => dispatch({ type: state.page ? 'back' : advance }));
    next.classList.add('screen-action');
    if (state.page) next.dataset.navigation = 'return';
    content.append(next);
  }

  if (state.screen === 'task-event') taskScreen(content, state, dispatch);
  if (state.screen === 'S07') {
    content.classList.add('discussion-content');
    content.append(element('h2', 'screen-statement', 'Discuss your suspicions'));
    if (state.dead) content.append(element('p', '', "You've been killed."));
    for (const [page, labelFor] of Object.entries(discussionPages)) {
      if (!canOpenDiscussionPage(state, page)) continue;
      const action = button(labelFor(state.missions), () => dispatch({ type: page }), { variant: 'secondary' });
      if ((page === 'mission-report' && state.information.missionConfirmed) ||
          (page === 'spy' && state.discussion.spyGuess !== null)) {
        action.classList.add('completed-action');
        action.append(element('span', 'action-status', 'Done'));
      }
      if (page === 'mission-report' && state.discussion.missionObserver && !state.information.missionConfirmed) {
        action.classList.add('completed-action');
        action.append(element('span', 'action-status', 'Awaiting confirmation'));
      }
      action.dataset.navigation = page;
      content.append(action);
    }
  }
  if (Object.hasOwn(discussionPages, state.screen)) discussionForm(app, content, state, dispatch);
  if (state.screen === 'final-roundtable') {
    content.classList.add('discussion-content');
    content.append(element('h2', 'screen-statement', 'Final roundtable'));
    const result = state.spyResult;
    if (result) {
      content.append(assignmentCard(`Your guess for ${result.target}`, missions[result.missionIndex]('someone')),
        element('p', '', result.correct ? `Correct guess. ${result.target} has been eliminated.` : 'Incorrect guess.'));
    } else {
      content.append(element('p', '', 'You didn’t log a spy guess.'));
    }
    if (state.dead) content.append(element('p', '', "You've been killed."));
  }

  if (state.screen === 'mission-check') {
    const { id, kind, playerName, mission } = state.check;
    const receipt = kind === 'receipt';
    const title = element('h2', 'screen-statement', receipt
      ? `${playerName} confirmed your secret mission.`
      : `Did ${playerName} complete their secret mission?`);
    title.tabIndex = -1;
    content.classList.add('discussion-content');
    content.append(title, element('p', 'game-panel', receipt ? state.information.mission : mission),
      button(receipt ? `I checked with ${playerName}` : 'Confirm mission', () => dispatch({ type: 'verify-check', checkId: id })),
      button('Back', () => dispatch({ type: 'back' }), { variant: 'secondary' }));
  }

  if (state.screen === 'drink') {
    const { id, amount, playerName } = state.drink;
    const title = element('h2', 'screen-statement', playerName ? `Did ${playerName} drink?` : 'Did you drink?');
    title.tabIndex = -1;
    const status = element('p');
    status.setAttribute('role', 'status');
    content.classList.add('discussion-content');
    shell.dataset.drinkId = id;
    const card = element('p', 'game-panel drink-amount', formatDrinkServing(amount));
    content.append(title, card,
      button(playerName ? `I saw ${playerName} drink it` : 'I drank this amount',
        () => dispatch(playerName ? { type: 'verify-check', checkId: id } : { type: 'report-drink', drinkId: id })), status);
    if (state.page === 'observer-checks') {
      content.append(button('Back', () => dispatch({ type: 'back' }), { variant: 'secondary' }));
    }
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
  const previousTaskStep = app.firstElementChild?.dataset.taskStep;
  if (state.screen === 'task-event') shell.dataset.taskStep = [state.task.key, state.task.stage].join('/');
  const previousSelect = app.querySelector('select');
  const currentSelect = shell.querySelector('select');
  if (previousSelect && currentSelect && previousScreen === state.screen &&
      ((state.screen === 'spy' && previousSelect.dataset.savedGuess === currentSelect.dataset.savedGuess) ||
       (state.screen === 'task-event' && previousTaskStep === shell.dataset.taskStep))) {
    currentSelect.value = previousSelect.value;
    currentSelect.dispatchEvent(new Event('change'));
  }
  const previousDrink = app.firstElementChild?.dataset.drinkId;
  const keepSpyDialog = state.screen === 'spy' && app.querySelector('#spy-logged[open]');
  app.replaceChildren(shell);
  if (keepSpyDialog) shell.querySelector('#spy-logged')?.showModal();
  if (state.screen === 'drink' && previousDrink !== state.drink.id) content.querySelector('h2').focus();
  if (previousScreen === 'drink' && state.screen === 'S07') brand.focus();
  if (shell.dataset.taskStep && previousTaskStep !== shell.dataset.taskStep) {
    const heading = content.querySelector('h2');
    heading.tabIndex = -1;
    heading.focus();
  }
  if (state.screen === 'task-event' && state.task.stage === 'result') content.querySelector('dialog').showModal();
  if (previousScreen === state.screen && Object.hasOwn(discussionPages, state.screen)) {
    content.querySelector('[role="status"]')?.focus();
  }
  if ((previousScreen === 'S01' && state.screen === 'game-info') ||
      (previousScreen === 'game-info' && state.screen === 'role-briefing')) content.querySelector('h2').focus();
  if (previousScreen !== state.screen && state.screen === 'mission-briefing') content.querySelector('h2').focus();
  if ((previousScreen === 'role-briefing' && state.screen === 'S02') ||
      (previousScreen === 'mission-briefing' && state.screen === 'S06') ||
      (previousScreen === 'S06' && state.screen === 'S07')) brand.focus();
  if (previousScreen === 'welcome' && state.screen === 'S01') brand.focus();
  if (roleScroll && state.screen === 'S02') shell.querySelector('.role-details').scrollTop = roleScroll;
}

export function createNavigation() {
  let page = null;
  let checkId;
  let lastTaskStep;
  let lastDrinkId;
  return {
    view(state) {
      const step = state.task && [state.task.key, state.task.stage].join('/');
      const drinkId = state.drink?.id;
      if ((drinkId && drinkId !== lastDrinkId) || state.task?.stage === 'result') checkId = null;
      if (step !== lastTaskStep || (drinkId && drinkId !== lastDrinkId)) page = null;
      lastDrinkId = drinkId;
      lastTaskStep = step;
      if (checkId && state.observerChecks?.next.id === checkId) return { ...state, openObserverCheck: state.observerChecks.next };
      checkId = null;
      if (page === 'role' && state.canViewRole) return { ...state, screen: 'S02', page };
      if (page === 'missions' && state.missions && state.screen !== 'S06') return { ...state, screen: 'S06', page };
      if (canOpenDiscussionPage(state, page)) return { ...state, screen: page, page };
      page = null;
      return state;
    },
    navigate(action, state) {
      if (action === 'observer-checks' && state.observerChecks) {
        checkId = state.observerChecks.next.id;
        return '.screen-statement';
      }
      if (action === 'back' && checkId) {
        checkId = null;
        return '[data-observer-checks]';
      }
      const previous = page;
      if (action === 'back' && page) page = null;
      else if (action === 'role' && state.canViewRole) page = page === action ? null : action;
      else if (action === 'missions' && state.missions) page = page === action || state.screen === 'S06' ? null : action;
      else if (canOpenDiscussionPage(state, action)) page = action;
      else return;
      checkId = null;
      return page ? '.brand' : `[data-navigation="${action === 'back' ? previous : action}"]`;
    },
  };
}


export function applyTheme() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',
    getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim());
}
