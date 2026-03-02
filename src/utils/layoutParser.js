export const getPuzzleStructure = (layout) => {
  const hGroups = [];
  const vGroups = [];
  const rows = layout.length;
  const cols = layout[0].length;

  // Horizontal scan
  for (let r = 0; r < rows; r++) {
    let current = [];
    for (let c = 0; c <= cols; c++) {
      if (c < cols && layout[r][c] === 1) {
        current.push(`${r}-${c}`);
      } else {
        if (current.length > 1) hGroups.push(current);
        current = [];
      }
    }
  }

  // Vertical scan
  for (let c = 0; c < cols; c++) {
    let current = [];
    for (let r = 0; r <= rows; r++) {
      if (r < rows && layout[r][c] === 1) {
        current.push(`${r}-${c}`);
      } else {
        if (current.length > 1) vGroups.push(current);
        current = [];
      }
    }
  }

  // Identify Intersections
  const hSet = new Set(hGroups.flat());
  const intersections = vGroups.flat().filter(coord => hSet.has(coord));

  return { hGroups, vGroups, intersections, allGroups: [...hGroups, ...vGroups] };
};