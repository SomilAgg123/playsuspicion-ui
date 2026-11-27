function drinks(number) {
  return `${number} ${number === 1 ? 'drink' : 'drinks'}`;
}

const fractions = new Map([[0.25, '¼'], [0.5, '½'], [0.75, '¾']]);

export function formatDrinkAmount(amount) {
  const whole = Math.floor(amount);
  const fraction = fractions.get(amount - whole);
  if (!fraction) return drinks(amount);
  return `${whole || ''}${fraction} ${whole ? 'drinks' : 'drink'}`;
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
