export const roles = {
  Mastermind: {
    team: 'Mafia',
    character: 'The leader of the mafia.',
    task: 'At key moments, give orders to the mafia to steer to victory.',
  },
  'Hired Gun': {
    team: 'Mafia',
    character: 'A ruthless operator who is a master at assassination.',
    task: 'Carry out many of the mafia’s kills.',
  },
  Traitor: {
    team: 'Mafia',
    targetTeam: 'Mafia',
    character: 'A disloyal insider with a personal agenda.',
    task: 'Betray [MAFIA PERSON] and get them voted out.',
  },
  Shitposter: {
    team: 'Mafia',
    character: 'A troublemaker who thrives on distraction.',
    task: 'Send distracting messages to the community throughout the night.',
  },
  Mussolini: {
    team: 'Mafia',
    character: 'A powerful ally with a trick up your sleeve.',
    task: 'Reach the final roundtable, then choose once whether to remain mafia or join the community.',
  },
  Juliet: {
    team: 'Mafia',
    targetTeam: 'Community',
    character: 'Have a forbidden love for someone on the other side.',
    task: 'Get [COMMUNITY PERSON] to the roundtable with you',
  },
  Socrates: {
    team: 'Community',
    character: 'A wise and respected elder of the community.',
    task: 'Share messages of wisdom throughout the night.',
  },
  Trump: {
    team: 'Community',
    character: 'A loud provocateur who always wants the spotlight.',
    task: 'Stir confusion and controversy throughout the night.',
  },
  Karen: {
    team: 'Community',
    targetTeam: 'Any',
    character: 'A fierce critic who can go after someone with a vengeance.',
    task: 'Get [PERSON] voted out.',
  },
  Detective: {
    team: 'Community',
    targetTeam: 'Any',
    character: 'A hired mind with the power to seek truth.',
    task: 'Question [PERSON] throughout the night to uncover the truth of who they are.',
  },
  'Lord Varys': {
    team: 'Community',
    character: 'A skilled diplomat with a penchant for people skills',
    task: 'Go the entire night without receiving more than [LIMIT] votes in any single voting round.',
  },
  'The Lover': {
    team: 'Community',
    targetTeam: 'Any',
    character: 'Be inseparably bound to another person',
    task: 'Get [PERSON] to the roundtable with you',
  },
  'The Enabler': {
    team: 'Community',
    character: 'You win when others drink.',
    task: 'Get other players to finish their drinks with you. The drinks must be full.',
    drinkingPlans: ['good-time', 'all-out'],
  },
};

export const mafiaRoles = Object.keys(roles).filter(name => roles[name].team === 'Mafia');
export const communityRoles = Object.keys(roles).filter(name => roles[name].team === 'Community');

export function canBeEnabler(team, drinkingPlan) {
  const enabler = roles['The Enabler'];
  return team === enabler.team && enabler.drinkingPlans.includes(drinkingPlan);
}

export function formatRoleTask(name, { playerCount, targetName } = {}) {
  const role = roles[name];
  if (!role || (role.targetTeam && !targetName)) return null;
  if (role.task.includes('[LIMIT]') && !Number.isInteger(playerCount)) return null;
  return role.task.replace(/\[(?:PERSON|COMMUNITY PERSON|MAFIA PERSON|LIMIT)\]/g,
    token => token === '[LIMIT]' ? String(Math.floor(playerCount / 3)) : targetName);
}
