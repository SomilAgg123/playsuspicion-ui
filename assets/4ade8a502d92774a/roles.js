export const roles = {
  Mastermind: {
    team: 'Outlaws',
    character: 'The leader of the Outlaws.',
    task: 'At key moments, give orders to the Outlaws to steer to victory.',
  },
  'Hired Gun': {
    team: 'Outlaws',
    character: 'A ruthless operator who is a master at assassination.',
    task: 'Carry out many of the Outlaws’ kills.',
  },
  Traitor: {
    team: 'Outlaws',
    targetTeam: 'Outlaws',
    character: 'A disloyal insider with a personal agenda.',
    task: 'Betray [OUTLAW] and get them voted out.',
  },
  Shitposter: {
    team: 'Outlaws',
    character: 'A troublemaker who thrives on distraction.',
    task: 'Send distracting messages to the Townsfolk throughout the night.',
  },
  Mussolini: {
    team: 'Outlaws',
    character: 'A powerful ally with a trick up your sleeve.',
    task: 'Reach the final roundtable, then choose once whether to remain an Outlaw or join the Townsfolk.',
  },
  Juliet: {
    team: 'Outlaws',
    targetTeam: 'Townsfolk',
    character: 'Have a forbidden love for someone on the other side.',
    task: 'Get [TOWNSPERSON] to the roundtable with you',
  },
  Socrates: {
    team: 'Townsfolk',
    character: 'A wise and respected elder of the Townsfolk.',
    task: 'Share messages of wisdom throughout the night.',
  },
  Trump: {
    team: 'Townsfolk',
    character: 'A loud provocateur who always wants the spotlight.',
    task: 'Stir confusion and controversy throughout the night.',
  },
  Karen: {
    team: 'Townsfolk',
    targetTeam: 'Any',
    character: 'A fierce critic who can go after someone with a vengeance.',
    task: 'Get [PERSON] voted out.',
  },
  Detective: {
    team: 'Townsfolk',
    targetTeam: 'Any',
    character: 'A hired mind with the power to seek truth.',
    task: 'Question [PERSON] throughout the night to uncover the truth of who they are.',
  },
  'Lord Varys': {
    team: 'Townsfolk',
    character: 'A skilled diplomat with a penchant for people skills',
    task: 'Go the entire night without receiving more than [LIMIT] votes in any single voting round.',
  },
  'The Lover': {
    team: 'Townsfolk',
    targetTeam: 'Any',
    character: 'Be inseparably bound to another person',
    task: 'Get [PERSON] to the roundtable with you',
  },
  'The Enabler': {
    team: 'Townsfolk',
    character: 'You win when others drink.',
    task: 'Get other players to finish their drinks with you. The drinks must be full.',
    drinkingPlans: ['good-time', 'all-out'],
  },
};

export const outlawRoles = Object.keys(roles).filter(name => roles[name].team === 'Outlaws');
export const townsfolkRoles = Object.keys(roles).filter(name => roles[name].team === 'Townsfolk');

export function canBeEnabler(team, drinkingPlan) {
  const enabler = roles['The Enabler'];
  return team === enabler.team && enabler.drinkingPlans.includes(drinkingPlan);
}

export function formatRoleTask(name, { playerCount, targetName } = {}) {
  const role = roles[name];
  if (!role || (role.targetTeam && !targetName)) return null;
  if (role.task.includes('[LIMIT]') && !Number.isInteger(playerCount)) return null;
  return role.task.replace(/\[(?:PERSON|TOWNSPERSON|OUTLAW|LIMIT)\]/g,
    token => token === '[LIMIT]' ? String(Math.floor(playerCount / 3)) : targetName);
}
