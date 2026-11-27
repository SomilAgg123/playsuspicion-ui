export const partyTasks = {
  'red-item': { prompt: 'Grab the nearest red item and hold it up.' },
  'swap-drinks': { prompt: 'Swap drinks with someone (you can give it back after).' },
  youngest: { prompt: 'Point to the youngest person in the room.' },
  seven: { prompt: 'Find the number 7 and point to it.' },
  'show-name': { prompt: 'Write or type your name and show it to everyone.' },
  'first-letter': { prompt: 'Grab something that starts with the same first letter as your first name.' },
  birthday: {
    prompt: 'Pair up with the person who has the closest birthday to you. (Last person or pair drink for this one).',
    pairing: true,
  },
  'point-up': { prompt: 'Point up as quickly as you can.' },
  scolding: { prompt: "Pretend you're scolding your child for getting pregnant or getting someone pregnant." },
  phone: { prompt: "Pretend you're calling someone with something that isn't a phone" },
  'eye-contact': { prompt: 'Make eye contact with someone and hold it. (Last people or pair drink)', pairing: true },
  'raise-drink': { prompt: 'Hold your drink up with your non dominant hand.' },
};

export function taskBallotSize(key, participants) {
  return partyTasks[key].pairing && participants % 2 === 0 ? 2 : 1;
}
