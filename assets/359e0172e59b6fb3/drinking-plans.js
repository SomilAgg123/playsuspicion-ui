import { defaultTaskTriggerBudget, partyTasks, taskBallotSize } from './party-tasks.js';

function drinks(number) {
  return `${number} ${number === 1 ? 'drink' : 'drinks'}`;
}

const fractions = new Map([
  [1 / 8, '⅛'], [1 / 6, '⅙'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'],
  [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [5 / 6, '⅚'], [7 / 8, '⅞'],
]);
const sipsPerDrink = 16;

export function formatSipEstimate(amount) {
  const estimate = amount * sipsPerDrink;
  if (estimate < 1) return 'Less than 1 sip';
  if (!Number.isFinite(estimate)) return '';
  const count = Math.round(estimate);
  return `${count} ${count === 1 ? 'sip' : 'sips'}`;
}

export function formatDrinkAmount(amount) {
  if (Number.isInteger(amount)) return drinks(amount);
  const whole = Math.floor(amount);
  for (let denominator = 2; denominator <= 32; denominator++) {
    const numerator = Math.round((amount - whole) * denominator);
    const candidate = whole + numerator / denominator;
    if (numerator === 0 || numerator === denominator || Math.abs(candidate - amount) > Number.EPSILON * amount) continue;
    const glyph = fractions.get(numerator / denominator);
    const fraction = glyph ?? `${numerator}/${denominator}`;
    if (!whole) return `${fraction} of a drink`;
    return `${whole}${glyph ? '' : ' '}${fraction} drinks`;
  }
  return drinks(Number(amount.toPrecision(5)));
}

export const drinkingPlans = [
  { id: 'none', label: 'Not drinking', multiplier: 0, hint: '0 drinks' },
  { id: 'buzz', label: 'Buzz', multiplier: 1 / 6, hint: 'One sixth of your drunk number' },
  { id: 'good-time', label: 'A good time', multiplier: 1 / 3, hint: 'One third of your drunk number' },
  { id: 'all-out', label: 'All out', multiplier: 1 / 2, hint: 'Half your drunk number' },
];

const multiplierByPlan = new Map(drinkingPlans.map(plan => [plan.id, plan.multiplier]));

export function planDescription(plan, drunkNumber) {
  const total = drunkNumber * plan.multiplier;
  return drunkNumber == null || !Number.isFinite(total) ? plan.hint : formatDrinkAmount(total);
}

export function eventDrinkAmount(player, rosterSize, expectedTriggers = defaultTaskTriggerBudget(rosterSize)) {
  const multiplier = multiplierByPlan.get(player.drinkingPlan);
  if (!player.joined || !(player.drunkNumber > 0 && multiplier > 0)) return 0;
  const taskLosers = Object.keys(partyTasks).reduce((sum, key) => sum + taskBallotSize(key, rosterSize), 0);
  const expectedPrompts = expectedTriggers / 2 + taskLosers / rosterSize;
  return player.drunkNumber * multiplier / expectedPrompts;
}

export function drawEventDrinks(players, randomInt, expectedTriggers) {
  const eligible = players.map(player => ({
    playerId: player.id, amount: eventDrinkAmount(player, players.length, expectedTriggers),
  })).filter(assignment => assignment.amount > 0);
  let needed = Math.floor(eligible.length / 2);
  if (eligible.length % 2) needed += randomInt(2);
  const assignments = [];
  for (const [index, assignment] of eligible.entries()) {
    // Taking k of the remaining n with probability k/n samples uniformly without replacement.
    if (needed === 0) break;
    if (randomInt(eligible.length - index) >= needed) continue;
    assignments.push(assignment);
    needed--;
  }
  return assignments;
}

export function validDrinkingPlan(id) {
  return drinkingPlans.some(plan => plan.id === id);
}
