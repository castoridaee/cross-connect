import { 
  RegExpMatcher, 
  englishDataset, 
  englishRecommendedTransformers,
  DataSet,
  pattern as obscenityPattern
} from 'obscenity';

// Logic from puzzleService.js
const dataset = new DataSet().addAll(englishDataset);
const allowedTerms = [
  'boob', 'boobs', 'butt', 'booty', 'chest', 'nipple', 'nipples', 
  'crotch', 'rear', 'anus', 'pubic', 'ass', 'tit', 'hell', 
  'damn', 'darn', 'crap', 'piss'
];

dataset.removePhrasesIf(phrase => {
  const word = phrase.metadata?.originalWord?.toLowerCase();
  return allowedTerms.includes(word);
});

const matcher = new RegExpMatcher({
  ...dataset.build(),
  ...englishRecommendedTransformers,
});

const directedInsultPatterns = [
  /(yo?u['’]?(re|r|ar)?|yo?ur|ur|this(\s+puzzle)?)\s+(are|r|is|s|an?)?\s*(ga+y|idiot|dumb|dummy|stupid|trash|garbage|terrible|awful|cr+ap|shit)/i,
  /(yo?u['’]?(re|r|ar)?|yo?ur|ur|this(\s+puzzle)?)\s+su+cks?/i,
  /(yo?u['’]?(re|r|ar)?|ur|yo?ur)\s+ga+y/i
];

function checkProfanity(text, isComment = false) {
  if (!text) return false;
  const trimmed = text.trim();
  if (isComment && !trimmed.includes(' ')) {
    // Single word matcher would go here, but let's test the basics first
    // (singleWordMatcher logic omitted for brevity in this specific diagnostic)
  }
  if (matcher.hasMatch(text)) return true;
  if (directedInsultPatterns.some(pattern => pattern.test(text))) return true;
  return false;
}

console.log("Check 'fuck' (Slur):", checkProfanity("fuck"));
console.log("Check 'boob' (Whitelisted):", checkProfanity("boob"));
console.log("Check 'you are gay' (Directed):", checkProfanity("you are gay"));
console.log("Check 'this puzzle sucks' (Directed):", checkProfanity("this puzzle sucks"));
