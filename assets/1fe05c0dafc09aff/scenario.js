import { missions } from './missions.js';
import { defaultTaskTriggerBudget, taskTriggerMilestone, needsTaskPartner, taskPlacements, publicTaskPlacements } from './party-tasks.js';
import { canBeEnabler } from './roles.js';
import { drawEventDrinks, taskDrinkAssignments } from './drinking-plans.js';

export const TURN_MS = 15_000;
const names = ['Priya', 'Sam', 'Chad', 'Maya', 'Jordan', 'Bea'];

export function createScenario(team = 'mafia') {
  return {
    screen: 'S01', canJoin: true, canViewRole: false, player: { name: '', drunkNumber: null },
    information: {
      ...(team === 'community' ? { team: 'Community', role: 'Socrates' } :
        { team: 'Mafia', role: 'Hired Gun', otherMafia: ['Priya (Mastermind)', 'Sam'] }),
      mission: 'Get Chad to say "monster mash"',
    },
    buddies: names.map((name, index) => ({ id: `sample-${index}`, name })),
    arrived: false, selectedBuddyId: null, turnIndex: 0,
  };
}

export function acceptsPassword(value) { return typeof value === 'string' && value.trim().toLowerCase() === 'mafia'; }

function finishMic(state) { return { ...state, screen: 'mission-briefing', mic: null }; }

function withTurn(state, index, startsAt) {
  if (index >= state.turns.length) return finishMic(state);
  const turn = state.turns[index];
  return {
    ...state, screen: 'S05', turnIndex: index,
    mic: { ...turn, turnId: `sample-turn-${index}`, canFinish: index === 0, endsAt: startsAt + TURN_MS },
  };
}

export function tick(state, now) {
  if (state.screen === 'S03' && state.arrived && now >= state.transitionAt) return { ...state, screen: 'S04' };
  while (state.screen === 'S05' && now >= state.mic.endsAt) {
    state = withTurn(state, state.turnIndex + 1, state.mic.endsAt);
  }
  if (state.screen === 'S07' && state.sampleQueue?.length) {
    const [drink, ...sampleQueue] = state.sampleQueue;
    return { ...state, screen: 'drink', drink, sampleQueue };
  }
  if (state.screen === 'S07' && state.taskDueAt != null && now >= state.taskDueAt) {
    return { ...state, screen: 'task-event', taskDueAt: undefined, taskStartedAt: now, finishOrder: [],
      task: { key: 'birthday', stage: 'ready' } };
  }
  if (state.screen === 'task-event') {
    if (state.task.stage === 'waiting-drinks' && now >= state.transitionAt) {
      const [drink, ...taskQueue] = state.taskQueue;
      if (drink) return { ...state, screen: 'drink', drink, taskQueue };
      return { ...state, screen: 'S07', task: undefined, transitionAt: undefined };
    }
    if (['ready', 'waiting'].includes(state.task.stage)) {
      const bots = [...state.buddies].sort((a, b) => Number(a.name === state.missions.observes) - Number(b.name === state.missions.observes));
      const due = bots.filter((bot, index) => now >= state.taskStartedAt + (index + 1) * 400 && !state.finishOrder.includes(bot.id));
      if (due.length) return sampleFinish(state, due.map(bot => bot.id));
    }
  }
  return state;
}

export function act(current, action, now, randomInt = max => Math.floor(Math.random() * max)) {
  const state = tick(current, now);
  if (action.type === 'join' && state.screen === 'S01') {
    const name = typeof action.name === 'string' ? action.name.trim() : '';
    if (!name || name.length > 120 || !Number.isFinite(action.drunkNumber) || action.drunkNumber < 0) return state;
    const information = canBeEnabler(state.information.team, action.drinkingPlan)
      ? { ...state.information, role: 'The Enabler' } : state.information;
    return { ...state, screen: 'role-briefing', information, player: { name, drunkNumber: action.drunkNumber, drinkingPlan: action.drinkingPlan ?? null } };
  }
  if (action.type === 'reveal-role' && state.screen === 'role-briefing') return { ...state, screen: 'S02' };
  if (action.type === 'next' && state.screen === 'S02') return { ...state, screen: 'S03', canViewRole: true };
  if (action.type === 'arrive' && state.screen === 'S03' && !state.arrived) {
    return { ...state, arrived: true, transitionAt: now + 600 };
  }
  if (action.type === 'buddy' && state.screen === 'S04') {
    const selected = state.buddies.find(buddy => buddy.id === action.playerId);
    if (!selected) return state;
    const turns = [
      { speaker: state.player.name, buddy: selected.name },
      ...state.buddies.map((buddy, index) => ({ speaker: buddy.name, buddy: state.buddies[index + 1]?.name ?? state.player.name })),
    ];
    return withTurn({ ...state, selectedBuddyId: selected.id, turns }, 0, now);
  }
  if (action.type === 'reveal-missions' && state.screen === 'mission-briefing') {
    return { ...state, screen: 'S06', missions: { observer: 'Maya', observes: 'Jordan', spiesOn: 'Bea' } };
  }
  if (action.type === 'finish-missions' && state.screen === 'S06') {
    return { ...state, screen: 'S07', discussion: {
      observedMission: 'Give Sam a hug', observationConfirmed: false, spyGuess: null,
    } };
  }
  if (state.screen === 'drink' && action.drinkId === state.drink.id) {
    const expected = state.drink.playerName ? 'verify-drink' : 'report-drink';
    if (action.type !== expected) return state;
    if (state.task) return { ...state, screen: 'task-event', drink: null, transitionAt: now + 500 };
    return { ...state, screen: 'S07', drink: null };
  }
  if (state.screen === 'task-event' && action.key === state.task.key) {
    if (action.type === 'finish-task' && state.task.stage === 'ready') return sampleFinish(state, ['self']);
    if (action.type === 'choose-task-partner' && state.task.stage === 'partner' &&
        state.task.players.some(player => player.id === action.partnerId)) return sampleResults(state, action.partnerId);
    if (action.type === 'acknowledge-task' && state.task.stage === 'result') {
      return tick({ ...state, task: { ...state.task, stage: 'waiting-drinks' }, transitionAt: now }, now);
    }
  }
  if (state.screen === 'S07' && state.discussion) {
    const details = state.discussion;
    if (action.type === 'report-death' && state.information.team === 'Community' && !state.dead) {
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
  if (action.type === 'skip' && state.screen === 'S05') return finishMic(state);
  if (action.type === 'done' && state.screen === 'S05' && state.mic.canFinish && action.turnId === state.mic.turnId) {
    return withTurn(state, state.turnIndex + 1, now);
  }
  return state;
}

function sampleRoster(state) {
  return [
    { ...state.player, id: 'self', joined: true },
    ...state.buddies.map(buddy => ({ ...buddy, joined: true, drunkNumber: 4, drinkingPlan: 'buzz' })),
  ];
}

function sampleFinish(state, ids) {
  const finishOrder = [...state.finishOrder, ...ids];
  const next = { ...state, finishOrder, task: { ...state.task, stage: finishOrder.includes('self') ? 'waiting' : 'ready' } };
  if (finishOrder.length < state.buddies.length + 1) return next;
  if (needsTaskPartner(state.task.key, finishOrder.length)) {
    if (finishOrder.at(-1) === 'self') return { ...next, task: { ...next.task, stage: 'partner', players: state.buddies } };
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

function sampleTrigger(state, now, randomInt) {
  const players = sampleRoster(state);
  const observed = state.buddies.find(buddy => buddy.name === state.missions.observes);
  const sampleQueue = drawEventDrinks(players, randomInt).flatMap(({ playerId, amount }) => {
    if (playerId === 'self') return [{ id: 'sample-own', amount }];
    // The simulated observed player reports their own assignment.
    if (playerId === observed.id) return [{ id: 'sample-observed', playerName: observed.name, amount }];
    return [];
  });
  const triggerCount = (state.triggerCount ?? 0) + 1;
  // The seven-person preview demonstrates the first of the twelve milestones.
  const taskDueAt = triggerCount === taskTriggerMilestone(1, defaultTaskTriggerBudget(players.length)) ? now + 1500 : state.taskDueAt;
  return tick({ ...state, triggerCount, taskDueAt, sampleQueue }, now);
}

export function remainingSeconds(state, now) {
  return state.mic?.endsAt == null ? 0 : Math.max(0, Math.ceil((state.mic.endsAt - now) / 1000));
}
