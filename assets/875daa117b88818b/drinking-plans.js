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
  { id: 'none', label: 'Not drinking', amount: () => '0 drinks' },
  { id: 'buzz', label: 'Buzz', amount: n => n == null ? 'Half your drunk number' : drinks(n / 2) },
  { id: 'good-time', label: 'A good time', amount: n => n == null ? 'Your drunk number' : drinks(n) },
  { id: 'all-out', label: 'All out', amount: n => n == null ? 'More than your drunk number' : `More than ${drinks(n)}` },
];

export function validDrinkingPlan(id) {
  return drinkingPlans.some(plan => plan.id === id);
}
