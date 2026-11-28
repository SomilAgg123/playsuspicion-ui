import { missions } from './missions.js';
import { killPrompts, KILL_WINDOW_MS, defaultTaskTriggerBudget, taskTriggerMilestone, needsTaskPartner, taskPlacements, publicTaskPlacements } from './party-tasks.js';
import { canBeEnabler } from './roles.js';
import { drawEventDrinks, taskDrinkAssignments } from './drinking-plans.js';

const names = ['Priya', 'Sam', 'Chad', 'Maya', 'Jordan', 'Bea'];

export function createScenario(team = 'outlaws') {
  return {
    screen: 'S01', canJoin: true, canViewRole: false, player: { name: '', drunkNumber: null },
    information: {
      ...(team === 'townsfolk' ? { team: 'Townsfolk', role: 'Socrates' } :
        { team: 'Outlaws', role: 'Hired Gun', otherOutlaws: ['Priya (Mastermind)', 'Sam'] }),
      mission: 'Get Chad to say "monster mash"',
    },
    otherPlayers: names.map((name, index) => ({ id: `sample-${index}`, name })),
    arrived: false,
  };
}

export function acceptsPassword(value) { return typeof value === 'string' && value.trim().toLowerCase() === 'outlaws'; }

export function tick(state, now) {
  if (state.killTask && now >= state.killTask.endsAt) state = { ...state, killTask: undefined };
  if (state.screen === 'mission-briefing' && !state.canRevealMissions && now >= state.transitionAt) {
    return { ...state, canRevealMissions: true };
  }
  if (state.screen === 'S07' && state.taskDueAt != null && now >= state.taskDueAt) {
    return { ...state, screen: 'task-event', taskDueAt: undefined, taskStartedAt: now, finishOrder: [],
      task: { key: 'birthday', stage: 'ready' } };
  }
  if (state.screen === 'task-event') {
    if (state.task.stage === 'waiting-drinks' && now >= state.transitionAt) {
      if (state.sampleChecks?.some(check => check.id === 'task-observed')) return state;
      return { ...state, screen: 'S07', task: undefined, transitionAt: undefined };
    }
    if (['ready', 'waiting'].includes(state.task.stage)) {
      const bots = [...state.otherPlayers].sort((a, b) => Number(a.name === state.missions.observes) - Number(b.name === state.missions.observes));
      const due = bots.filter((bot, index) => now >= state.taskStartedAt + (index + 1) * 400 && !state.finishOrder.includes(bot.id));
      if (due.length) return sampleFinish(state, due.map(bot => bot.id));
    }
  }
  return state;
}

export function act(current, action, now, randomInt = max => Math.floor(Math.random() * max)) {
  const state = tick(current, now);
  if (action.type === 'finish-kill' && state.killTask && action.taskId === state.killTask.id) {
    return { ...state, killTask: undefined };
  }
  if (action.type === 'join' && state.screen === 'S01') {
    const name = typeof action.name === 'string' ? action.name.trim() : '';
    if (!name || name.length > 120 || !Number.isFinite(action.drunkNumber) || action.drunkNumber < 0) return state;
    const information = canBeEnabler(state.information.team, action.drinkingPlan)
      ? { ...state.information, role: 'The Enabler' } : state.information;
    return { ...state, screen: 'game-info', information, player: { name, drunkNumber: action.drunkNumber, drinkingPlan: action.drinkingPlan ?? null } };
  }
  if (action.type === 'continue' && state.screen === 'game-info') return { ...state, screen: 'role-briefing' };
  if (action.type === 'reveal-role' && state.screen === 'role-briefing') return { ...state, screen: 'S02' };
  if (action.type === 'next' && state.screen === 'S02') return { ...state, screen: 'S03', canViewRole: true };
  if (action.type === 'arrive' && state.screen === 'S03' && !state.arrived) {
    return { ...state, screen: 'mission-briefing', arrived: true, canRevealMissions: false, transitionAt: now + 600 };
  }
  if (action.type === 'reveal-missions' && state.screen === 'mission-briefing' && state.canRevealMissions) {
    return { ...state, screen: 'S06', missions: { observer: 'Maya', observes: 'Jordan', spiesOn: 'Bea' } };
  }
  if (action.type === 'finish-missions' && state.screen === 'S06') {
    return { ...state, screen: 'S07', discussion: {
      observedMission: 'Give Sam a hug', observationConfirmed: false, spyGuess: null,
    } };
  }
  if (action.type === 'verify-drink' && state.drinkChecks?.next.id === action.drinkId) {
    return withChecks(state, state.sampleChecks.slice(1));
  }
  if (state.screen === 'drink' && action.type === 'report-drink' && action.drinkId === state.drink.id) {
    if (state.task) return { ...state, screen: 'task-event', drink: null, transitionAt: now + 500 };
    return { ...state, screen: 'S07', drink: null };
  }
  if (state.screen === 'task-event' && action.key === state.task.key) {
    if (action.type === 'finish-task' && state.task.stage === 'ready') return sampleFinish(state, ['self']);
    if (action.type === 'choose-task-partner' && state.task.stage === 'partner' &&
        state.task.players.some(player => player.id === action.partnerId)) return sampleResults(state, action.partnerId);
    if (action.type === 'acknowledge-task' && state.task.stage === 'result') {
      return deliverDrinks({ ...state, task: { ...state.task, stage: 'waiting-drinks' }, transitionAt: now }, state.taskQueue);
    }
  }
  if (state.screen === 'S07' && state.discussion) {
    const details = state.discussion;
    if (action.type === 'report-death' && state.information.team === 'Townsfolk' && !state.dead) {
      return sampleTrigger({ ...state, dead: true }, now, randomInt);
    }
    if (action.type === 'confirm-observation' && !details.observationConfirmed) {
      return sampleTrigger({ ...state, discussion: { ...details, observationConfirmed: true } }, now, randomInt);
    }
    if (action.type === 'guess-mission' && !state.dead && details.spyGuess === (action.previousGuess ?? null) &&
        Number.isInteger(action.missionIndex) && action.missionIndex >= 0 && action.missionIndex < missions.length) {
      const next = { ...state, discussion: { ...details, spyGuess: action.missionIndex } };
      return details.spyGuess == null ? sampleTrigger(next, now, randomInt) : next;
    }
  }
  return state;
}

function sampleRoster(state) {
  return [
    { ...state.player, id: 'self', joined: true },
    ...state.otherPlayers.map(player => ({ ...player, joined: true, drunkNumber: 4, drinkingPlan: 'buzz' })),
  ];
}

function sampleFinish(state, ids) {
  const finishOrder = [...state.finishOrder, ...ids];
  const next = { ...state, finishOrder, task: { ...state.task, stage: finishOrder.includes('self') ? 'waiting' : 'ready' } };
  if (finishOrder.length < state.otherPlayers.length + 1) return next;
  if (needsTaskPartner(state.task.key, finishOrder.length)) {
    if (finishOrder.at(-1) === 'self') return { ...next, task: { ...next.task, stage: 'partner', players: state.otherPlayers } };
    return sampleResults(next, finishOrder[0]);
  }
  return sampleResults(next);
}

function sampleResults(state, partnerId) {
  const players = sampleRoster(state);
  const placements = taskPlacements(state.finishOrder, partnerId);
  const taskQueue = [];
  for (const { playerId, amount } of taskDrinkAssignments(placements, players)) {
    const recipient = players.find(player => player.id === playerId);
    if (playerId === 'self') taskQueue.unshift({ id: 'task-own', amount });
    else if (recipient.name === state.missions.observes) taskQueue.push({ id: 'task-observed', playerName: recipient.name, amount });
  }
  return { ...state, task: { key: state.task.key, stage: 'result', placements: publicTaskPlacements(placements, players) }, taskQueue };
}

function withChecks(state, sampleChecks) {
  const drinkChecks = sampleChecks.length ? { count: sampleChecks.length, next: sampleChecks[0] } : undefined;
  return { ...state, sampleChecks, drinkChecks };
}

function deliverDrinks(state, drinks) {
  const checks = drinks.filter(drink => drink.playerName);
  const next = withChecks(state, [...(state.sampleChecks ?? []), ...checks]);
  const drink = drinks.find(item => !item.playerName);
  return drink ? { ...next, screen: 'drink', drink } : next;
}

function sampleTrigger(state, now, randomInt) {
  const players = sampleRoster(state);
  const observed = state.otherPlayers.find(player => player.name === state.missions.observes);
  const triggerCount = (state.triggerCount ?? 0) + 1;
  const sampleQueue = drawEventDrinks(players, randomInt).flatMap(({ playerId, amount }) => {
    if (playerId === 'self') return [{ id: `sample-own-${triggerCount}`, amount }];
    // The simulated observed player reports their own assignment.
    if (playerId === observed.id) return [{ id: `sample-observed-${triggerCount}`, playerName: observed.name, amount }];
    return [];
  });
  // The seven-person preview demonstrates the first of the twelve milestones.
  const taskDueAt = triggerCount === taskTriggerMilestone(1, defaultTaskTriggerBudget(players.length)) ? now + 1500 : state.taskDueAt;
  let killTask = state.killTask;
  if (triggerCount === 1 && state.information.team === 'Outlaws' && !state.dead) {
    const keys = Object.keys(killPrompts);
    killTask = { id: 'sample-kill', promptKey: keys[randomInt(keys.length)], target: 'Chad', endsAt: now + KILL_WINDOW_MS };
  }
  return deliverDrinks({ ...state, triggerCount, taskDueAt, killTask }, sampleQueue);
}

export function remainingSeconds(state, now) {
  const endsAt = state.killTask?.endsAt;
  return endsAt == null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));
}
