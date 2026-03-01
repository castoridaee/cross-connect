export const validatePuzzle = (grid, config) => {
  const { hCoords, vCoords, catA, catB, intersection } = config;

  const hWords = hCoords.map(c => grid[c]).filter(Boolean);
  const vWords = vCoords.map(c => grid[c]).filter(Boolean);

  const isSubset = (arr, cat) => arr.length > 0 && arr.every(w => cat.includes(w));
  const isExact = (arr, cat) => arr.length === cat.length && isSubset(arr, cat);

  const errors = new Set();
  const messages = [];

  // Logic for Win/Loss
  const winS = isExact(hWords, catA) && isExact(vWords, catB);
  const winF = isExact(hWords, catB) && isExact(vWords, catA);

  if (winS || winF) return { solved: true, errors: [], messages: [] };

  // Logic for Partial Feedback
  const check = (words, coords) => {
    if (words.length === 0) return;
    const matchesA = isSubset(words, catA);
    const matchesB = isSubset(words, catB);

    if ((matchesA && words.length < catA.length) || (matchesB && words.length < catB.length)) {
      messages.push({ type: 'incomplete', text: `${words.join(", ")} is incomplete.` });
    } else if (words.length === coords.length) {
      if (!isExact(words, catA) && !isExact(words, catB)) {
        messages.push({ type: 'invalid', text: `${words.join(", ")} is not a group.` });
        coords.forEach(c => errors.add(c));
      }
    }
  };

  check(hWords, hCoords);
  check(vWords, vCoords);

  const intersectWord = grid[intersection];
  if (intersectWord && !(catA.includes(intersectWord) && catB.includes(intersectWord))) {
    messages.push({ type: 'crosspoint', text: `${intersectWord} is not at a crosspoint.` });
    errors.add(intersection);
  }

  return { solved: false, errors: Array.from(errors), messages };
};