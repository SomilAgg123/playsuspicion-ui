import { missions } from './missions.js';
import { canBeEnabler } from './roles.js';

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
  if (state.screen === 'S07' && state.sampleDrink && now >= state.drinkAt) {
    const drink = state.sampleDrink;
    return { ...state, screen: 'drink', drink, sampleDrink: null };
  }
  return state;
}

export function act(current, action, now) {
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
    const participates = state.player.drunkNumber > 0 && ['buzz', 'good-time', 'all-out'].includes(state.player.drinkingPlan);
    const sampleDrink = participates ? { id: 'sample-own', amount: 0.25 } : sampleVerification(state);
    return { ...state, screen: 'S07', sampleDrink, drinkAt: now + 4000, discussion: {
      observedMission: 'Give Sam a hug', observationConfirmed: false, spyGuess: null,
    } };
  }
  if (state.screen === 'drink' && action.drinkId === state.drink.id) {
    if (action.type === 'report-drink' && !state.drink.playerName) {
      return { ...state, screen: 'S07', drink: null, sampleDrink: sampleVerification(state), drinkAt: now + 4000 };
    }
    if (action.type === 'verify-drink' && state.drink.playerName) return { ...state, screen: 'S07', drink: null };
  }
  if (state.screen === 'S07' && state.discussion) {
    const details = state.discussion;
    if (action.type === 'report-death' && state.information.team === 'Community') return { ...state, dead: true };
    if (action.type === 'confirm-observation') return { ...state, discussion: { ...details, observationConfirmed: true } };
    if (action.type === 'guess-mission' && !state.dead && details.spyGuess === (action.previousGuess ?? null) &&
        Number.isInteger(action.missionIndex) && action.missionIndex >= 0 && action.missionIndex < missions.length) {
      return { ...state, discussion: { ...details, spyGuess: action.missionIndex } };
    }
  }
  if (action.type === 'skip' && state.screen === 'S05') return finishMic(state);
  if (action.type === 'done' && state.screen === 'S05' && state.mic.canFinish && action.turnId === state.mic.turnId) {
    return withTurn(state, state.turnIndex + 1, now);
  }
  return state;
}

function sampleVerification(state) {
  return { id: 'sample-observed', playerName: state.missions.observes, amount: 0.5 };
}

export function remainingSeconds(state, now) {
  return state.mic?.endsAt == null ? 0 : Math.max(0, Math.ceil((state.mic.endsAt - now) / 1000));
}
