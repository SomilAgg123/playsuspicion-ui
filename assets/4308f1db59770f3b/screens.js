import { revealPaper } from './role-reveal.js';
import { drinkingPlans, planDescription, formatDrinkServing } from './drinking-plans.js';
import { roles, formatRoleTask } from './roles.js';
import { missions } from './missions.js';
import { killPrompts, partyTasks } from './party-tasks.js';

const discussionPages = {
  'death-report': () => "I've been killed",
  'mission-report': () => 'Complete your secret mission',
  spy: ({ spiesOn }) => `I think I know ${spiesOn}’s secret mission`,
};

function canOpenDiscussionPage(state, page) {
  return state.screen === 'S07' && state.discussion && Object.hasOwn(discussionPages, page)
    && (page !== 'death-report' || (state.information.team === 'Townsfolk' && !state.dead));
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

function ballotScreen(content, vote, dispatch) {
  content.classList.add('discussion-content', 'vote-content');
  const circle = vote.kind === 'circle';
  const titleText = circle ? 'Is everyone here Townsfolk?' : vote.kind === 'eliminate' ? 'Who do you vote out?' : 'Town Vote';
  content.append(element('h2', 'screen-statement', titleText));
  if (vote.endsAt != null) {
    const timer = element('span', 'vote-timer');
    timer.setAttribute('role', 'timer');
    const clock = element('p', 'vote-clock', 'Closes in ');
    clock.append(timer);
    content.append(clock);
  }
  const submit = targetId => dispatch({ type: 'cast-vote', voteId: vote.id, targetId });
  const status = element('p');
  status.setAttribute('role', 'status');
  if (vote.returned) {
    status.textContent = 'Your vote is sealed.';
  } else if (vote.canVote) {
    const field = element('label', 'game-field', circle ? 'Your verdict' : 'Who do you suspect?');
    const select = element('select');
    select.required = true;
    const prompt = new Option(circle ? 'Choose a verdict' : 'Choose a player', '');
    prompt.disabled = true;
    select.append(prompt);
    for (const member of vote.candidates) {
      select.append(new Option(member.name, member.id));
    }
    select.value = '';
    field.append(select);
    const seal = button('Seal my vote', () => submit(select.value));
    seal.disabled = true;
    select.addEventListener('change', () => { seal.disabled = !select.value; });
    content.append(field, seal);
  } else {
    status.textContent = 'You’re spectating this vote.';
  }
  const ledger = element('section', 'vote-ledger');
  const title = element('h3', 'section-title', 'Roll call');
  const count = element('span', 'vote-count');
  count.setAttribute('aria-live', 'polite');
  title.append(count);
  const list = element('ul');
  for (const member of vote.roster) {
    const row = element('li');
    const receipt = element('span', 'vote-receipt');
    row.append(element('strong', '', member.name), receipt);
    list.append(row);
  }
  ledger.append(title, list);
  content.append(status, ledger);
}

function voteResultsScreen(content, result, dispatch) {
  content.classList.add('discussion-content', 'vote-content');
  const next = button('Continue', () => dispatch({ type: 'acknowledge-vote-result', voteId: result.id }));
  if (result.kind === 'circle') {
    content.append(element('h2', 'screen-statement', 'The circle has spoken'),
      namedList(result.choices.map(({ name, choice }) => [name, choice])), next);
    return;
  }
  content.append(element('h2', 'screen-statement', result.kind ? 'Elimination vote' : 'Town Vote results'));
  if (result.kind && !result.eliminatedName) content.append(element('p', 'vote-clock', 'No majority. Vote again.'));
  if (result.eliminatedName) {
    const verdict = element('p', 'vote-verdict');
    verdict.append(element('strong', '', result.eliminatedName), ' has been voted out.');
    content.append(verdict);
  }
  if (result.standings.length) {
    const table = element('table', 'vote-standings');
    const header = table.createTHead().insertRow();
    for (const label of ['Rank', 'Player', 'Votes']) {
      const th = element('th', '', label);
      th.scope = 'col';
      header.append(th);
    }
    const body = table.createTBody();
    let rank = 0;
    result.standings.forEach(({ name, votes }, index) => {
      if (votes !== result.standings[index - 1]?.votes) rank = index + 1;
      const row = body.insertRow();
      const player = element('th', '', name);
      player.scope = 'row';
      row.append(element('td', '', rank), player, element('td', '', votes));
    });
    content.append(table);
  } else {
    content.append(element('p', '', 'No votes were cast.'));
  }
  content.append(next);
}

function namedList(entries) {
  const list = element('ul', 'showdown-list');
  for (const [name, value] of entries) {
    const row = element('li');
    row.append(element('strong', '', name), element('span', '', value));
    list.append(row);
  }
  return list;
}

function showdownScreen(content, state, dispatch) {
  content.classList.add('discussion-content', 'showdown-content');
  const heading = text => element('h2', 'screen-statement', text);
  const advance = step => button('Continue', () => dispatch({ type: 'showdown-continue', step }));
  if (state.screen === 'showdown-announcement') {
    content.append(heading('It’s time for the Saloon Showdown.'), advance('announcement'));
  } else if (state.screen === 'showdown-instructions') {
    const rules = element('ol', 'showdown-rules');
    for (const rule of [
      'Finalists vote on whether everyone in the circle is Townsfolk. Then everyone sees each verdict.',
      'One Outlaw call opens an elimination vote. Vote again until someone gets more than half the votes.',
      'The remaining circle votes again. Unanimous Townsfolk or two remaining finalists ends the game.',
      'If any Outlaw remains, the Outlaws win. Otherwise the Townsfolk win.',
    ]) rules.append(element('li', '', rule));
    content.append(heading('How it works'), rules, advance('instructions'));
  } else if (state.screen === 'showdown-eligibility') {
    const reasons = { killed: 'You were killed.', 'voted-out': 'You were voted out.',
      mission: 'Your secret mission wasn’t confirmed.', spy: 'Your spy guessed your secret mission.' };
    content.append(heading(state.reasons.length ? 'You’re out.' : 'You’re in.'));
    for (const reason of state.reasons) content.append(element('p', '', reasons[reason]));
    if (state.spyResult) {
      const { target, correct } = state.spyResult;
      content.append(element('p', '', correct ? `You guessed ${target}’s mission correctly.` : `Your guess for ${target} was incorrect.`));
    }
    content.append(advance('eligibility'));
  } else if (state.screen === 'showdown-team') {
    content.append(heading(state.canChoose ? 'Choose your final team' : 'The circle is gathering.'));
    if (state.canChoose) {
      for (const team of ['Outlaws', 'Townsfolk']) content.append(button(team, () => dispatch({ type: 'choose-final-team', team })));
    }
  } else if (state.screen === 'showdown-end') {
    content.dataset.winner = state.outcome.winner;
    content.append(heading(`${state.outcome.winner} win!`), element('h3', 'section-title', 'The final circle'));
    if (state.outcome.circle.length) content.append(namedList(state.outcome.circle.map(p => [p.name, p.team])));
    else content.append(element('p', '', 'No one made it to the final circle.'));
  }
}

function updateRollCall(shell, roster) {
  const receipts = shell.querySelectorAll('.vote-receipt');
  roster.forEach(({ returned }, index) => {
    const receipt = receipts[index];
    if (receipt.dataset.returned === String(returned)) return;
    receipt.dataset.returned = String(returned);
    receipt.textContent = returned ? 'Voted' : 'Waiting';
  });
  const count = shell.querySelector('.vote-count');
  const total = roster.filter(member => member.returned).length;
  const label = total + ' / ' + roster.length;
  if (count.textContent !== label) count.textContent = label;
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
    if (state.dead) status.textContent = state.votedOut ? 'You were voted out.' : "You've been killed.";
    else content.append(button('Confirm', () => dispatch({ type: 'report-death' }), { variant: 'destructive' }));
  }
  if (state.page === 'mission-report') {
    content.append(missionCard(state.information));
    if (details.missionObserver) {
      status.textContent = `Go to ${details.missionObserver} to verify your secret mission.`;
    } else if (!state.information.missionConfirmed) {
      content.append(button('The deed is done', () => dispatch({ type: 'report-mission' })));
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

function renderKillTask(shell, task, dispatch, seconds) {
  const previous = shell.querySelector('[data-kill-task]');
  if (previous && previous.dataset.killTask === task?.id) return;
  previous?.remove();
  if (!task) return;
  const card = element('section', 'game-panel kill-task');
  card.dataset.killTask = task.id;
  const title = element('h2', 'section-title', "It's time to kill");
  title.id = 'kill-task-title';
  card.setAttribute('aria-labelledby', title.id);
  const timer = element('span', 'kill-timer', formatTime(seconds));
  timer.setAttribute('role', 'timer');
  timer.setAttribute('aria-label', 'Time left for kill task');
  const done = button("I've killed them.", () => dispatch({ type: 'finish-kill', taskId: task.id }));
  done.dataset.action = 'finish-kill';
  done.disabled = seconds === 0;
  const prompt = killPrompts[task.promptKey];
  const instruction = prompt
    ? `${prompt(task.target)} Once they do, privately tell them they've been killed.`
    : `Privately tell ${task.target} they've been killed.`;
  card.append(title, timer, element('p', '', `${instruction} They must tap "I've been killed".`), done);
  const resultDialog = shell.dataset.screen === 'task-event' && shell.querySelector('dialog[open]');
  if (resultDialog) resultDialog.append(card);
  else shell.querySelector('.game-header').after(card);
}

const roleActionLabels = {
  'send-dispatch': 'Send a message',
  investigate: 'Investigate a player',
  'sheriff-kill': 'Choose a suspect',
  'report-toast': 'Report a shared toast',
};

function roleDialog(title) {
  const dialog = element('dialog', 'game-dialog');
  dialog.setAttribute('aria-label', title);
  dialog.append(element('h2', 'section-title', title));
  const actions = element('div', 'dialog-actions');
  dialog.append(actions);
  return { dialog, actions };
}

function openRoleAction(app, controls, dispatch, role) {
  const { type, slotId, sequence } = controls;
  const label = roleActionLabels[type];
  const { dialog, actions } = roleDialog(label);
  const cancel = button('Back', () => dialog.close(), { variant: 'secondary' });
  const status = element('p');
  status.setAttribute('role', 'status');
  dialog.insertBefore(status, actions);
  const submit = async action => {
    const buttons = [...actions.querySelectorAll('button')];
    for (const control of buttons) control.disabled = true;
    const ok = await dispatch(action);
    for (const control of buttons) control.disabled = false;
    if (!dialog.open) return;
    if (!ok) {
      status.textContent = 'Couldn’t complete that action. Check the selection and try again.';
      return;
    }
    if (type !== 'investigate') return dialog.close();
    const result = ok.information.roleProgress;
    dialog.replaceChildren(element('h2', 'section-title', 'Investigation result'), element('p', '', result), actions);
    actions.replaceChildren(button('Done', () => dialog.close()));
    actions.firstChild.focus();
  };
  if (type === 'send-dispatch') {
    const audience = role === 'Gang Boss' ? 'Message to the other Outlaws' : 'Message to the town';
    const { wrapper, input } = field(audience, 'message', 'text', '');
    input.maxLength = 280;
    const send = button('Send', () => submit({ type, slotId, message: input.value }));
    send.disabled = true;
    input.addEventListener('input', () => { send.disabled = !input.value.trim(); });
    dialog.insertBefore(wrapper, status);
    actions.append(send, cancel);
  } else {
    const { wrapper, input } = field('Find a player', 'search', 'search', '');
    const selection = element('label', 'game-field', 'Player');
    const select = element('select');
    selection.append(select);
    const choose = button(type === 'sheriff-kill' ? 'Review choice' : label, () => {
      const targetId = select.value;
      if (type !== 'sheriff-kill') return submit({ type, targetId, sequence });
      const name = select.selectedOptions[0].textContent;
      const confirm = button('Eliminate player', () => submit({ type, targetId }), { variant: 'destructive' });
      dialog.replaceChildren(element('h2', 'section-title', `Eliminate ${name}?`),
        element('p', '', 'This uses your only elimination.'), status, actions);
      actions.replaceChildren(confirm, cancel);
      cancel.focus();
    });
    const candidates = [...controls.candidates].sort((a, b) => a.name.localeCompare(b.name));
    function filter() {
      const matches = candidates.filter(p => p.name.toLowerCase().includes(input.value.trim().toLowerCase()));
      select.replaceChildren(new Option('Choose a player', ''), ...matches.map(p => new Option(p.name, p.id)));
      if (matches.length === 1) select.value = matches[0].id;
      choose.disabled = !select.value;
    }
    filter();
    select.addEventListener('change', () => { choose.disabled = !select.value; });
    input.addEventListener('input', filter);
    dialog.insertBefore(wrapper, status);
    dialog.insertBefore(selection, status);
    actions.append(choose, cancel);
  }
  dialog.dataset.roleAction = type;
  dialog.addEventListener('close', () => {
    dialog.remove();
    app.querySelector('[data-role-opener]')?.focus();
  });
  app.after(dialog);
  dialog.showModal();
}

function renderMessage(app, message, dispatch) {
  const previous = document.querySelector('dialog[data-message-id]');
  if (previous && previous.dataset.messageId === message?.id) return;
  previous?.remove();
  if (!message) return;
  const { dialog, actions } = roleDialog(`Message from ${message.from}`);
  dialog.dataset.messageId = message.id;
  dialog.insertBefore(element('p', 'dispatch-text', message.message), actions);
  const dismiss = () => dispatch({ type: 'dismiss-dispatch', messageId: message.id });
  actions.append(button('Dismiss', dismiss));
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
  app.after(dialog);
  dialog.showModal();
}

// Retain the originating controls so a check can return to an unsubmitted selection.
export function createScreenRenderer(app, dispatch) {
  let pageSignature;
  let returnScreen;
  let displayedCheck;
  const checksButton = button('', () => dispatch({ type: 'observer-checks' }), { variant: 'secondary' });
  checksButton.dataset.observerChecks = '';

  return (state, seconds, force = false) => {
    const { observerChecks, openObserverCheck, killTask, dispatchMessage, ...page } = state;
    const openAction = document.querySelector('dialog[data-role-action]');
    if (openAction && openAction.dataset.roleAction !== state.roleControls?.type) openAction.close();
    renderMessage(app, dispatchMessage, dispatch);
    if (openObserverCheck) {
      if (!displayedCheck) returnScreen = app.firstElementChild;
      const checkSignature = JSON.stringify(openObserverCheck);
      if (checkSignature !== displayedCheck || force) {
        const checkPage = openObserverCheck.kind === 'drink'
          ? { screen: 'drink', drink: openObserverCheck }
          : { screen: openObserverCheck.kind === 'toast' ? 'toast-check' : 'mission-check', check: openObserverCheck };
        renderScreen(app, { ...page, ...checkPage, page: 'observer-checks' }, dispatch);
      }
      renderKillTask(app.firstElementChild, killTask, dispatch, seconds);
      displayedCheck = checkSignature;
      return;
    }

    // Ledger updates must leave an open candidate picker and its keyboard focus intact.
    if (state.screen === 'night-vote') {
      const { roster, selfId } = state.vote;
      page.vote = { ...state.vote, returned: roster.some(member => member.id === selfId && member.returned),
        roster: roster.map(({ id, name }) => ({ id, name })) };
    }
    const signature = JSON.stringify(page);
    if (returnScreen) app.replaceChildren(returnScreen);
    if (signature !== pageSignature || force) renderScreen(app, page, dispatch);
    pageSignature = signature;
    const shell = app.firstElementChild;
    if (state.screen === 'night-vote') {
      updateRollCall(shell, state.vote.roster);
      const timer = shell.querySelector('.vote-timer');
      if (timer) timer.textContent = formatTime(seconds);
    }
    renderKillTask(shell, killTask, dispatch, seconds);
    if (observerChecks) {
      checksButton.textContent = `Observations (${observerChecks.count})`;
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

  if (state.screen === 'vote-results') voteResultsScreen(content, state.voteResult, dispatch);
  if (state.screen === 'night-vote') ballotScreen(content, state.vote, dispatch);
  if (state.screen === 'task-event') taskScreen(content, state, dispatch);
  if (state.screen === 'S07') {
    content.classList.add('discussion-content');
    content.append(element('h2', 'screen-statement', 'Discuss your suspicions'));
    if (state.dead) content.append(element('p', '', state.votedOut ? 'You were voted out.' : "You've been killed."));
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
  if (['S02', 'S07'].includes(state.screen)) {
    if (state.information.roleProgress) {
      const progress = element('p', 'game-panel', state.information.roleProgress);
      progress.dataset.roleProgress = '';
      content.append(progress);
    }
    if (state.roleControls) {
      const label = roleActionLabels[state.roleControls.type];
      const opener = button(label, () => openRoleAction(app, state.roleControls, dispatch, state.information.role), { variant: 'secondary' });
      opener.dataset.roleOpener = '';
      content.append(opener);
    }
  }

  if (state.screen === 'S02' || state.screen === 'S06') {
    const advance = state.screen === 'S02' ? 'next' : 'finish-missions';
    const next = button(state.page ? 'Back' : 'Next', () => dispatch({ type: state.page ? 'back' : advance }));
    next.classList.add('screen-action');
    if (state.page) next.dataset.navigation = 'return';
    content.append(next);
  }

  if (Object.hasOwn(discussionPages, state.screen)) discussionForm(app, content, state, dispatch);
  if (state.screen.startsWith('showdown-')) showdownScreen(content, state, dispatch);
  if (state.pendingDrink && !state.page) content.append(button('View my drink', () => dispatch({ type: 'open-drink' }), { variant: 'secondary' }));

  if (['mission-check', 'toast-check'].includes(state.screen)) {
    const { id, playerName, mission } = state.check;
    const title = element('h2', 'screen-statement', state.screen === 'toast-check'
      ? `Did you and ${playerName} finish a full drink together?` : `Did ${playerName} complete their secret mission?`);
    title.tabIndex = -1;
    content.classList.add('discussion-content');
    content.append(title);
    if (mission) content.append(element('p', 'game-panel', mission));
    content.append(
      button('Yes', () => dispatch({ type: 'verify-check', checkId: id })),
      button('No', () => dispatch({ type: 'reject-check', checkId: id }), { variant: 'secondary' }),
      button('Back', () => dispatch({ type: 'back' }), { variant: 'secondary' }));
  }

  if (state.screen === 'drink') {
    if (state.votedOut) content.append(element('p', '', 'You were voted out.'));
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
    if (state.page === 'observer-checks' || state.page === 'open-drink') {
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
  let lastVoteId;
  let lastShowdownScreen = null;
  return {
    view(state) {
      const step = state.task && [state.task.key, state.task.stage].join('/');
      const voteId = state.vote?.id ?? (state.voteResult && state.voteResult.id + '/results');
      const showdownScreen = state.screen.startsWith('showdown-') ? state.screen : null;
      if (showdownScreen !== lastShowdownScreen) {
        page = null;
        checkId = null;
        lastShowdownScreen = showdownScreen;
      }
      if (voteId !== lastVoteId) {
        page = null;
        checkId = null;
        lastVoteId = voteId;
      }
      const drinkId = state.drink?.id;
      if ((drinkId && drinkId !== lastDrinkId) || state.task?.stage === 'result') checkId = null;
      if (step !== lastTaskStep || (drinkId && drinkId !== lastDrinkId)) page = null;
      lastDrinkId = drinkId;
      lastTaskStep = step;
      if (checkId && state.observerChecks?.next.id === checkId) return { ...state, openObserverCheck: state.observerChecks.next };
      checkId = null;
      if (page === 'open-drink' && state.pendingDrink) return { ...state, screen: 'drink', drink: state.pendingDrink, page };
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
      else if (action === 'open-drink' && state.pendingDrink) page = action;
      else if (action === 'role' && state.canViewRole) page = page === action ? null : action;
      else if (action === 'missions' && state.missions) page = page === action || state.screen === 'S06' ? null : action;
      else if (canOpenDiscussionPage(state, action)) page = action;
      else return;
      checkId = null;
      return page ? '.brand' : `[data-navigation="${action === 'back' ? previous : action}"]`;
    },
  };
}

export function formatTime(seconds) {
  return [Math.floor(seconds / 60), seconds % 60].map(part => String(part).padStart(2, '0')).join(':');
}

export function applyTheme() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',
    getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim());
}
