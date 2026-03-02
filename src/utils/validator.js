import { getPuzzleStructure } from './layoutParser';

export const validatePuzzle = (grid, puzzle) => {
  const { categories, layout } = puzzle;
  const { hGroups, vGroups, intersections, allGroups } = getPuzzleStructure(layout);

  const errors = new Set();
  const messages = [];

  // 1. Check for total completion
  const filledCoords = Object.keys(grid).filter(k => grid[k]);
  const totalActiveCells = layout.flat().filter(v => v === 1).length;
  const isFullyFilled = filledCoords.length === totalActiveCells;

  // Helper: check if a list of words matches ANY category exactly
  const findMatchingCategory = (words) => {
    return categories.find(cat =>
      cat.words.length === words.length && words.every(w => cat.words.includes(w))
    );
  };

  // Helper: check if words are a subset of ANY category
  const isSubsetOfAny = (words) => {
    return categories.some(cat => words.every(w => cat.words.includes(w)));
  };

  // 2. Validate all groups (Rows and Columns)
  allGroups.forEach(group => {
    const wordsInGroup = group.map(coord => grid[coord]).filter(Boolean);

    // Only validate if the group is physically full on the grid
    if (wordsInGroup.length === group.length) {
      const match = findMatchingCategory(wordsInGroup);

      if (!match) {
        if (isSubsetOfAny(wordsInGroup)) {
          messages.push(`${wordsInGroup.join(", ")} is incomplete.`);
        } else {
          messages.push(`${wordsInGroup.join(", ")} is not a group.`);
        }
        group.forEach(coord => errors.add(coord));
      }
    }
  });

  // 3. Validate Intersections (Crosspoints)
  intersections.forEach(coord => {
    const word = grid[coord];
    if (word) {
      // A crosspoint word MUST belong to at least two categories
      const matchingCats = categories.filter(cat => cat.words.includes(word));
      if (matchingCats.length < 2) {
        messages.push(`${word} is not at a crosspoint.`);
        errors.add(coord);
      }
    }
  });

  // 4. Win Condition
  const solved = isFullyFilled && errors.size === 0 && messages.length === 0;

  return { solved, errors: Array.from(errors), messages };
};