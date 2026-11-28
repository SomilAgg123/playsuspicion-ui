export const KILL_WINDOW_MS = 120_000;

export const partyTasks = {
  'red-item': { prompt: 'Grab the nearest red item and hold it up.' },
  'swap-drinks': { prompt: 'Swap drinks with someone (you can give it back after).' },
  youngest: { prompt: 'Point to the youngest person in the room.' },
  seven: { prompt: 'Find the number 7 and point to it.' },
  'show-name': { prompt: 'Write or type your name and show it to everyone.' },
  'first-letter': { prompt: 'Grab something that starts with the same first letter as your first name.' },
  birthday: {
    prompt: 'Pair up with the person who has the closest birthday to you.',
    pairing: true,
  },
  'point-up': { prompt: 'Point up as quickly as you can.' },
  scolding: { prompt: "Pretend you're scolding your child for getting pregnant or getting someone pregnant." },
  phone: { prompt: "Pretend you're calling someone with something that isn't a phone" },
  'eye-contact': { prompt: 'Make eye contact with someone and hold it.', pairing: true },
  'raise-drink': { prompt: 'Hold your drink up with your non dominant hand.' },
};

export function needsTaskPartner(key, count) {
  return partyTasks[key].pairing === true && count > 0 && count % 2 === 0;
}

const placementMultipliers = [3, 2, 1];

function placementSlots(count, hasPartner) {
  const lastPlaces = hasPartner ? 2 : 1;
  return placementMultipliers.slice(0, count - lastPlaces + 1).map((multiplier, index) => ({
    multiplier, size: index === 0 ? lastPlaces : 1,
  }));
}

export function taskPlacements(finishOrder, partnerId) {
  const ranked = finishOrder.filter(id => id !== partnerId).reverse();
  if (partnerId) ranked.splice(1, 0, partnerId);
  return placementSlots(finishOrder.length, Boolean(partnerId)).map(({ multiplier, size }) => ({
    multiplier, playerIds: ranked.splice(0, size),
  }));
}

export function expectedTaskPortions(rosterSize) {
  let total = 0;
  for (const key of Object.keys(partyTasks)) {
    for (const { multiplier, size } of placementSlots(rosterSize, needsTaskPartner(key, rosterSize))) {
      total += multiplier * size;
    }
  }
  return total / rosterSize;
}

export function publicTaskPlacements(placements, players) {
  return placements.map(({ multiplier, playerIds }) => ({
    multiplier, names: playerIds.map(id => players.find(player => player.id === id).name),
  }));
}

export function defaultTaskTriggerBudget(rosterSize) {
  // One confirmed mission and first guess each, plus a recorded death for half the roster.
  return 2 * rosterSize + Math.round(rosterSize / 2);
}

export function taskTriggerMilestone(taskNumber, budget) {
  return Math.ceil(taskNumber * budget / Object.keys(partyTasks).length);
}
