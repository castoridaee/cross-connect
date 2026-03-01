export const validatePuzzle = (grid, config) => {
  const { hCoords, vCoords, catA, catB, intersection } = config;

  const hWords = hCoords.map(c => grid[c]).filter(Boolean);
  const vWords = vCoords.map(c => grid[c]).filter(Boolean);

  const isSubset = (arr, cat) => arr.length > 0 && arr.every(w => cat.includes(w));
  const isExact = (arr, cat) => arr.length === cat.length && isSubset(arr, cat);

  const errors = new Set();
  const messages = [];

  const winS = isExact(hWords, catA) && isExact(vWords, catB);
  const winF = isExact(hWords, catB) && isExact(vWords, catA);

  if (winS || winF) return { solved: true, errors: [], messages: [] };

  const checkGroup = (words, coords) => {
    if (words.length !== coords.length) return;

    const subsetA = isSubset(words, catA);
    const subsetB = isSubset(words, catB);

    if ((subsetA && words.length < catA.length) || (subsetB && words.length < catB.length)) {
      messages.push(`${words.join(", ")} is incomplete.`);
      coords.forEach(c => errors.add(c));
    } else if (!isExact(words, catA) && !isExact(words, catB)) {
      messages.push(`${words.join(", ")} is not a group.`);
      coords.forEach(c => errors.add(c));
    }
  };

  checkGroup(hWords, hCoords);
  checkGroup(vWords, vCoords);

  const intersectWord = grid[intersection];
  if (intersectWord && !(catA.includes(intersectWord) && catB.includes(intersectWord))) {
    messages.push(`${intersectWord} is not at a crosspoint.`);
    errors.add(intersection);
  }

  return { solved: false, errors: Array.from(errors), messages };
};