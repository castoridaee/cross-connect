
const adjectives = [
  'Swift', 'Quiet', 'Bright', 'Bold', 'Clever', 'Kind', 'Witty', 'Calm', 'Fierce', 'Grand',
  'Mystic', 'Sunny', 'Silver', 'Golden', 'Ancient', 'Nimble', 'Vibrant', 'Mighty', 'Gentle', 'Epic'
];

const nouns = [
  'Fox', 'Owl', 'Wolf', 'Bear', 'Lion', 'Eagle', 'Lynx', 'Shark', 'Deer', 'Hawk',
  'Tiger', 'Panda', 'Falcon', 'Panther', 'Raven', 'Dolphin', 'Stag', 'Badger', 'Coyote', 'Otter'
];

/**
 * Generates a stable "anonymous-adj-noun-number" name based on a string seed (like a UUID).
 * If no seed is provided, it returns a random one.
 */
export function generateAnonymousName(seed) {
  let index1, index2, num;

  if (seed) {
    // Simple hash to get stable indices from seed
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const safeHash = Math.abs(hash);
    index1 = safeHash % adjectives.length;
    index2 = (safeHash >> 4) % nouns.length;
    num = (safeHash % 899) + 100; // 100-999
  } else {
    index1 = Math.floor(Math.random() * adjectives.length);
    index2 = Math.floor(Math.random() * nouns.length);
    num = Math.floor(Math.random() * 899) + 100;
  }

  return `Anonymous-${adjectives[index1]}-${nouns[index2]}-${num}`;
}
