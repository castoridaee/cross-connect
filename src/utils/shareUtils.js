
export function generateEmojiGrid(puzzle) {
  if (!puzzle || !puzzle.layout) return '';
  
  // puzzle.layout is usually an array of arrays representing the grid
  const rows = puzzle.layout.length;
  const cols = puzzle.layout[0]?.length || 0;
  
  let gridStr = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      gridStr += puzzle.layout[r][c] ? '⬜' : '⬛';
    }
    gridStr += '\n';
  }
  return gridStr.trim();
}

export function generateShareText(puzzle, stats = null) {
  const emojiGrid = generateEmojiGrid(puzzle);
  const baseUrl = window.location.origin + '?p=' + puzzle.id;
  
  let header = `Cross-Connect: ${puzzle.title || 'Untitled'}\n`;
  
  if (stats) {
    if (stats.attempts === 1 && stats.hintsUsed === 0) {
      header += "Perfect solve! ✨\n";
    } else {
      header += `Solved in ${stats.attempts} ${stats.attempts === 1 ? 'attempt' : 'attempts'} • ${stats.hintsUsed} ${stats.hintsUsed === 1 ? 'hint' : 'hints'}\n`;
    }
  }
  
  return `${header}\n${emojiGrid}\n\nPlay here: ${baseUrl}`;
}

export function copyToClipboard(text, onComplete) {
  if (navigator.share) {
    navigator.share({ text }).then(() => onComplete?.()).catch(() => {
        // Fallback to clipboard if share is cancelled or fails
        navigator.clipboard.writeText(text).then(() => onComplete?.());
    });
  } else {
    navigator.clipboard.writeText(text).then(() => onComplete?.());
  }
}
