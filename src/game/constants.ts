export const characterNames: string[] = [
  'teemo',
  'alistar',
  'blitzcrank',
  'darius',
  'nautilus',
  'rammus',
  'thresh',
  'veigar',
  'yasuo',
  'zilean',
]

export const smallAbilities: { name: string; speed: number }[] = [
  { name: 'ezrealQ', speed: 3 },
  { name: 'corkiRocket', speed: 3.5 },
  { name: 'luxQ', speed: 2 },
]
export const bigAbilities: { name: string; speed: number }[] = [
  { name: 'ezrealUlt', speed: 3 },
  { name: 'jinxUlt', speed: 4.5 },
]

export const bigAccumulator = 4000
export const smallAccumulator = 500

export const difficulties = ['easy', 'normal', 'hard']

// easy, normal, hard
export const bigCooldown = [650, 500, 450]
export const smallCooldown = [200, 150, 100]
