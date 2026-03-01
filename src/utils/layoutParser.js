export const parseLayout = (layout) => {
  const groups = [];
  const intersections = [];
  const rows = layout.length;
  const cols = layout[0].length;

  const hCoords = new Set();
  const vCoords = new Set();

  // Process horizontal contiguous cells
  for (let r = 0; r < rows; r++) {
    let currentGroup = [];
    for (let c = 0; c <= cols; c++) {
      if (c < cols && layout[r][c] === 1) {
        currentGroup.push(`${r}-${c}`);
        hCoords.add(`${r}-${c}`);
      } else {
        if (currentGroup.length > 1) groups.push(currentGroup);
        currentGroup = [];
      }
    }
  }

  // Process vertical contiguous cells
  for (let c = 0; c < cols; c++) {
    let currentGroup = [];
    for (let r = 0; r <= rows; r++) {
      if (r < rows && layout[r][c] === 1) {
        currentGroup.push(`${r}-${c}`);
        vCoords.add(`${r}-${c}`);
      } else {
        if (currentGroup.length > 1) groups.push(currentGroup);
        currentGroup = [];
      }
    }
  }

  // Identify crosspoints (cells existing in both horizontal and vertical sets)
  hCoords.forEach(coord => {
    if (vCoords.has(coord)) intersections.push(coord);
  });

  return { groups, intersections };
};