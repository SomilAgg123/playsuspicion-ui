function drinks(number) {
  return `${number} ${number === 1 ? 'drink' : 'drinks'}`;
}

const fractions = new Map([
  [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'],
  [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'],
]);
const sipsPerDrink = 16;

export function formatSipEstimate(amount) {
  const estimate = amount * sipsPerDrink;
  if (estimate < 1) return 'Less than 1 sip';
  if (!Number.isFinite(estimate)) return '';
  const count = Math.round(estimate);
  return `About ${count} ${count === 1 ? 'sip' : 'sips'}`;
}

export function formatDrinkAmount(amount) {
  if (Number.isInteger(amount)) return drinks(amount);
  const whole = Math.floor(amount);
  for (let denominator = 2; denominator <= 32; denominator++) {
    const numerator = Math.round((amount - whole) * denominator);
    if (whole + numerator / denominator !== amount) continue;
    const glyph = fractions.get(numerator / denominator);
    const fraction = glyph ?? `${numerator}/${denominator}`;
    if (!whole) return `${fraction} of a drink`;
    return `${whole}${glyph ? '' : ' '}${fraction} drinks`;
  }
  return drinks(amount);
}

export const drinkingPlans = [
  { id: 'none', label: 'Not drinking', multiplier: 0, hint: '0 drinks' },
  { id: 'buzz', label: 'Buzz', multiplier: 0.5, hint: 'Half your drunk number' },
  { id: 'good-time', label: 'A good time', multiplier: 1, hint: 'Your drunk number' },
  { id: 'all-out', label: 'All out', multiplier: 1.5, hint: '1.5 times your drunk number' },
];

const multiplierByPlan = new Map(drinkingPlans.map(plan => [plan.id, plan.multiplier]));

export function planDescription(plan, drunkNumber) {
  const total = drunkNumber * plan.multiplier;
  return drunkNumber == null || !Number.isFinite(total) ? plan.hint : drinks(total);
}

export function drawEventDrinks(players, randomInt) {
  const expectedPrompts = players.length / 2;
  const eligible = players.filter(player => player.joined && player.drunkNumber > 0 && multiplierByPlan.get(player.drinkingPlan) > 0);
  let needed = Math.floor(eligible.length / 2);
  if (eligible.length % 2) needed += randomInt(2);
  const assignments = [];
  for (const [index, player] of eligible.entries()) {
    // Taking k of the remaining n with probability k/n samples uniformly without replacement.
    if (needed === 0) break;
    if (randomInt(eligible.length - index) >= needed) continue;
    const amount = (player.drunkNumber / expectedPrompts) * multiplierByPlan.get(player.drinkingPlan);
    assignments.push({ playerId: player.id, amount: Math.max(1 / sipsPerDrink, amount) });
    needed--;
  }
  return assignments;
}

export function validDrinkingPlan(id) {
  return drinkingPlans.some(plan => plan.id === id);
}
