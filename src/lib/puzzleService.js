import { supabase } from './supabase';
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
  DataSet,
  pattern as obscenityPattern
} from 'obscenity';
import { logger } from '../utils/logger';

// 1. Configure the dataset with our custom whitelist
const dataset = new DataSet().addAll(englishDataset);

// Terms to allow (remove from profanity list)
const allowedTerms = [
  'boob', 'boobs', 'butt', 'booty', 'chest', 'nipple', 'nipples',
  'crotch', 'rear', 'anus', 'pubic', 'ass', 'tit', 'hell',
  'damn', 'darn', 'crap', 'piss'
];

dataset.removePhrasesIf(phrase => {
  const word = phrase.metadata?.originalWord?.toLowerCase();
  return allowedTerms.includes(word);
});

// 2. Supplement with missing serious slurs that should ALWAYS be blocked
const extraSlurs = [
  'wetback'
];

extraSlurs.forEach(word => {
  dataset.addPhrase(phrase =>
    phrase.setMetadata({ originalWord: word }).addPattern(obscenityPattern`|${word}|`)
  );
});

// Add Scunthorpe protection (e.g., "a bit")
dataset.addPhrase(phrase => phrase.addWhitelistedTerm('a bit'));

const matcher = new RegExpMatcher({
  ...dataset.build(),
  ...englishRecommendedTransformers,
});

// Patterns for directed insults (stealth shadowblock)
const directedInsultPatterns = [
  /(yo?u['’]?(re|r|ar)?|yo?ur|ur|this(\s+puzzle)?)\s+(are|r|is|s|an?)?\s*(ga+y|idiot|dumb|dummy|stupid|trash|garbage|terrible|awful|cr+ap|shit)/i,
  /(yo?u['’]?(re|r|ar)?|yo?ur|ur|this(\s+puzzle)?)\s+su+cks?/i,
  /(yo?u['’]?(re|r|ar)?|ur|yo?ur)\s+ga+y/i
];

// 3. Advanced standalone word filter for comments
// Uses obscenity engine to catch variations (leet-speak) of mildly toxic standalone words.
const singleWordDataset = new DataSet();
[
  'sucks', 'gay', 'damn', 'crap', 'stupid', 'idiot', 'dumb',
  'trash', 'garbage', 'awful', 'terrible', 'bad', 'worst', 'lame', 'boring', 'sux'
].forEach(word => {
  singleWordDataset.addPhrase(phrase =>
    phrase.setMetadata({ originalWord: word }).addPattern(obscenityPattern`|${word}|`)
  );
});

const singleWordMatcher = new RegExpMatcher({
  ...singleWordDataset.build(),
  ...englishRecommendedTransformers,
});

function checkProfanity(text, isComment = false) {
  if (!text) return false;

  const trimmed = text.trim();

  // 1. Aggressive single-word check (only for standalone comments)
  // Uses obscenity engine to catch "suuuucks", "sux", etc.
  if (isComment && !trimmed.includes(' ')) {
    if (singleWordMatcher.hasMatch(trimmed)) return true;
  }

  // 2. Standard profanity (respecting our modified dataset)
  if (matcher.hasMatch(text)) return true;

  // 3. Directed insults
  if (directedInsultPatterns.some(pattern => pattern.test(text))) return true;

  return false;
}

function checkPuzzleContent(puzzleData) {
  // 1. Check Title
  if (checkProfanity(puzzleData.title)) return true;

  // 2. Check Categories JSONB
  if (puzzleData.categories && Array.isArray(puzzleData.categories)) {
    for (const cat of puzzleData.categories) {
      // Descriptions get full check
      if (checkProfanity(cat.description)) return true;

      // Individual words only get slurry check (allow "sux", "lame", etc. on tiles)
      if (cat.words && Array.isArray(cat.words)) {
        for (const word of cat.words) {
          if (matcher.hasMatch(word)) return true;
        }
      }
    }
  }
  return false;
}

function detectSwastikaPattern(grid, rows, cols) {
  if (!grid || rows < 5 || cols < 5) return false;

  const pattern = [
    [1, 0, 1, 1, 1],
    [1, 0, 1, 0, 0],
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 1],
    [1, 1, 1, 0, 1]
  ];

  // Inverse pattern (1s and 0s flipped - check if empty space forms it)
  const inversePattern = pattern.map(row => row.map(cell => cell === 1 ? 0 : 1));

  const checkAt = (startR, startC, targetPattern) => {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const cellValue = grid[`${startR + r}-${startC + c}`] ? 1 : 0;
        if (cellValue !== targetPattern[r][c]) return false;
      }
    }
    return true;
  };

  // Scan all 5x5 windows
  for (let r = 0; r <= rows - 5; r++) {
    for (let c = 0; c <= cols - 5; c++) {
      if (checkAt(r, c, pattern) || checkAt(r, c, inversePattern)) return true;
    }
  }

  return false;
}

async function recordShadowban(userId, severity = 'content') {
  if (!userId) return;

  const updates = {
    shadowban_total: supabase.rpc('increment', { row_id: userId, table_name: 'profiles', column_name: 'shadowban_total' })
  };

  if (severity === 'hard') {
    updates.is_hard_shadowbanned = true;
  }

  // Increment shadowban count and potentially set hard shadowban
  const { data: profile } = await getProfile(userId);
  const newCount = (profile?.shadowban_total || 0) + 1;
  const isHard = profile?.is_hard_shadowbanned || severity === 'hard';

  await supabase
    .from('profiles')
    .update({
      shadowban_total: newCount,
      is_hard_shadowbanned: isHard
    })
    .eq('id', userId);
}

// Helper to retry transient Safari/Networking errors (Load failed)
const withRetry = async (fn, retries = 1) => {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0 && err.message === 'Load failed') {
      console.warn(`Retrying fetch after transient Safari error...`);
      await new Promise(r => setTimeout(r, 500));
      return withRetry(fn, retries - 1);
    }
    throw err;
  }
};

export async function recordPuzzleSolve(userId, puzzleId, stats) {
  const { attempts, moves, seconds, grid, hints, history } = stats;

  // 1. Save the individual user's performance including final state
  const { error: progressError } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      is_solved: true,
      grid_state: grid || {},
      attempts: attempts,
      move_count: moves,
      total_seconds_played: seconds,
      hints_revealed: hints || [],
      guess_history: history || [],
      solved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, puzzle_id' });

  if (progressError) throw progressError;

  return { error: null };
}

export async function createPuzzle(puzzleData) {
  const { data: profile } = await getProfile(puzzleData.created_by);
  let shouldShadowban = profile?.is_hard_shadowbanned || false;
  let isHard = false;

  // Check content deeply
  if (checkPuzzleContent(puzzleData)) {
    shouldShadowban = true;
  }

  // Check grid pattern
  if (detectSwastikaPattern(puzzleData.grid_state, puzzleData.rows, puzzleData.cols)) {
    shouldShadowban = true;
    isHard = true;
  }

  const finalPuzzleData = {
    ...puzzleData,
    is_shadowbanned: shouldShadowban
  };

  const { data, error } = await supabase
    .from('puzzles')
    .insert([finalPuzzleData])
    .select()
    .single();

  if (!error && shouldShadowban) {
    await recordShadowban(puzzleData.created_by, isHard ? 'hard' : 'content');
  }

  return { data, error };
}

export async function updatePuzzle(id, data) {
  const { data: profile } = await getProfile(data.created_by);
  let shouldShadowban = profile?.is_hard_shadowbanned || false;
  let isHard = false;

  if (checkPuzzleContent(data)) {
    shouldShadowban = true;
  }

  if (data.grid_state && detectSwastikaPattern(data.grid_state, data.rows, data.cols)) {
    shouldShadowban = true;
    isHard = true;
  }

  const finalData = {
    ...data,
    is_shadowbanned: shouldShadowban
  };

  const { data: updatedData, error } = await supabase
    .from('puzzles')
    .update(finalData)
    .eq('id', id)
    .select()
    .single();

  if (!error && shouldShadowban) {
    await recordShadowban(data.created_by, isHard ? 'hard' : 'content');
  }

  return { data: updatedData, error };
}

export async function deletePuzzle(id) {
  const { error } = await supabase
    .from('puzzles')
    .delete()
    .eq('id', id);
  return { error };
}

export async function unpublishPuzzle(id) {
  return await updatePuzzle(id, { is_published: false });
}

export async function clearPuzzleProgress(puzzleId) {
  const { error } = await supabase
    .from('user_progress')
    .delete()
    .eq('puzzle_id', puzzleId);
  return { error };
}

export async function getPuzzlesByAuthor(authorId) {
  const { data, error } = await supabase
    .from('puzzles')
    .select('*, author:profiles!created_by(username, is_anonymous)')
    .eq('created_by', authorId)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function getProfile(id) {
  if (!id) return { data: null, error: null };
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();
  return { data, error };
}

export async function updateProfile(id, data) {
  // 1. Update the profiles table
  const { data: updatedData, error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  // 2. If username changed, sync with auth metadata so head/nav updates
  if (!error && data.username) {
    try {
      await supabase.auth.updateUser({
        data: { username: data.username }
      });
    } catch (authErr) {
      console.warn("Failed to sync auth metadata:", authErr);
    }
  }

  return { data: updatedData, error };
}

export async function getPuzzle(id) {
  const { data, error } = await supabase
    .from('puzzles')
    .select('*, author:profiles!created_by(username, is_anonymous)')
    .eq('id', id)
    .single();
  return { data, error };
}

export async function recordPuzzleSkip(userId, puzzleId) {
    logger.log("DB: Recording skip for", { userId, puzzleId });
  const { data: current } = await getPuzzleProgress(userId, puzzleId);
  if (current?.is_solved || current?.status === 'solved') {
    logger.log("[recordPuzzleSkip] Ignoring skip: Puzzle already solved.");
    return { error: null };
  }

  const { error } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      is_skipped: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, puzzle_id' });

  if (error) console.error("DB Error in recordPuzzleSkip:", error);
  return { error };
}

export async function savePuzzleProgress(userId, puzzleId, progress) {
  const { data: current } = await getPuzzleProgress(userId, puzzleId);
  if (current?.status === 'solved') return { error: null };

  const { error } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      grid_state: progress.grid,
      attempts: progress.attempts,
      move_count: progress.moves,
      total_seconds_played: progress.seconds,
      hints_revealed: progress.hints || [],
      guess_history: progress.history || [],
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, puzzle_id' });

  if (error && error.message === 'Load failed') {
    // Retry once for Safari transient issues
    const { error: retryError } = await supabase.from('user_progress').upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      grid_state: progress.grid,
      attempts: progress.attempts,
      move_count: progress.moves,
      total_seconds_played: progress.seconds,
      hints_revealed: progress.hints || [],
      guess_history: progress.history || [],
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, puzzle_id' });
    if (retryError) console.error(`[savePuzzleProgress] Persistent DB Error:`, retryError.message);
    return { error: retryError };
  }

  if (error) console.error(`[savePuzzleProgress] DB Error:`, error.message);
  else logger.log(`[savePuzzleProgress] Auto-saved progress for ${puzzleId}`);

  return { error };
}

export async function getPuzzleProgress(userId, puzzleId) {
  const fetchFn = () => supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('puzzle_id', puzzleId)
    .maybeSingle();

  let { data, error } = await fetchFn();

  if (error && error.message === 'Load failed') {
    await new Promise(r => setTimeout(r, 500));
    const result = await fetchFn();
    data = result.data;
    error = result.error;
  }

  return { data, error };
}
export async function getUserProgressForPuzzles(userId, puzzleIds) {
  if (!userId || !puzzleIds || puzzleIds.length === 0) return { data: [], error: null };
  const fetchFn = () => supabase
    .from('user_progress')
    .select('puzzle_id, status, is_liked')
    .eq('user_id', userId)
    .in('puzzle_id', puzzleIds);

  let { data, error } = await fetchFn();

  if (error && error.message === 'Load failed') {
    await new Promise(r => setTimeout(r, 500));
    const result = await fetchFn();
    data = result.data;
    error = result.error;
  }

  return { data, error };
}

export async function recordPuzzleEngagement(puzzleId, userId, metric) {
  if (!userId) return { error: 'Not signed in' };
  const { error } = await supabase.rpc('record_puzzle_engagement', {
    p_id: puzzleId,
    u_id: userId,
    metric: metric
  });
  return { error };
}

export async function recordPuzzlePlay(userId, puzzleId) {
  if (!userId || !puzzleId) {
    console.warn(`[recordPuzzlePlay] Missing IDs: userId=${userId}, puzzleId=${puzzleId}`);
    return { error: 'Missing IDs' };
  }

  logger.log(`[recordPuzzlePlay] Start: user=${userId}, puzzle=${puzzleId}`);

  // 1. Upsert to ensure the row exists. This will trigger the global play_count increment.
  const { data, error } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, puzzle_id' })
    .select()
    .single();

  if (error) {
    console.error(`[recordPuzzlePlay] DB Error:`, error.message, error.details);
  } else {
    logger.log(`[recordPuzzlePlay] Success: Row ${data.id} is present. Status: ${data.status}`);
  }

  return { data, error };
}

export async function togglePuzzleLike(puzzleId, userId) {
  if (!userId) return { error: 'Not signed in' };

  // Safety check: Don't allow creators to like their own puzzles
  const { data: puzzle } = await getPuzzle(puzzleId);
  if (puzzle && puzzle.created_by === userId) {
    return { data: null, error: 'Cannot like your own puzzle' };
  }

  const { data, error } = await supabase.rpc('toggle_puzzle_like', {
    p_id: puzzleId,
    u_id: userId
  });
  return { data, error };
}

export async function getLikedPuzzles(userId) {
  if (!userId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('puzzles')
    .select('*, user_progress!inner(is_liked)')
    .eq('user_progress.user_id', userId)
    .eq('user_progress.is_liked', true)
    .order('created_at', { ascending: false });
  return { data, error };
}

import dailyPuzzlesCsv from '../data/daily_puzzles.csv?raw';

function parseDailyPuzzles(csv) {
  if (!csv) return {};
  const lines = csv.trim().split('\n');
  const mapping = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(s => s.trim());
    if (parts.length >= 2) {
      const [date, puzzleId] = parts;
      if (date && puzzleId) mapping[date] = puzzleId;
    }
  }
  return mapping;
}

const dailyPuzzlesMapping = parseDailyPuzzles(dailyPuzzlesCsv);

export async function getRecommendedPuzzle(userId) {
  const TUTORIAL_PUZZLE_ID = '1834b762-a70b-4dcc-9403-e40d55f5ab07';
  const TUTORIAL_PUZZLE_2_ID = '1d8fc212-534a-4fe0-8e40-f7471b752bc7';
  let skipToStandard = false;

  // --- STAGE 1: TUTORIAL ---
  if (userId) {
    // 0. Experience Check: If the user has solved *any* puzzle beside the tutorials, skip Stage 1
    const { data: history } = await supabase
      .from('user_progress')
      .select('puzzle_id')
      .eq('user_id', userId)
      .eq('status', 'solved')
      .not('puzzle_id', 'in', `(${TUTORIAL_PUZZLE_ID},${TUTORIAL_PUZZLE_2_ID})`)
      .limit(1);

    if (!history || history.length === 0) {
      const { data: prog1 } = await getPuzzleProgress(userId, TUTORIAL_PUZZLE_ID);

      // 1. If T1 is not solved AND not skipped -> Show T1
      if (prog1?.status !== 'solved' && !prog1?.is_skipped) {
        const res = await getPuzzle(TUTORIAL_PUZZLE_ID);
        if (res.data) return res;
      }

      // 2. If T1 is solved/skipped, move to T2
      const { data: prog2 } = await getPuzzleProgress(userId, TUTORIAL_PUZZLE_2_ID);
      if (prog2?.is_skipped) {
        skipToStandard = true;
      } else if (prog2?.status !== 'solved') {
        const res = await getPuzzle(TUTORIAL_PUZZLE_2_ID);
        if (res.data) return res;
      }
    }
  } else {
    // Guest: Always show tutorial first
    const res = await getPuzzle(TUTORIAL_PUZZLE_ID);
    if (res.data) return res;
  }

  // --- STAGE 2: CALENDAR ---
  if (!skipToStandard) {
    const today = new Date().toISOString().split('T')[0];
    const calendarId = dailyPuzzlesMapping[today];

    if (calendarId) {
      if (userId) {
        const { data: prog } = await getPuzzleProgress(userId, calendarId);
        if (prog?.is_skipped) {
          skipToStandard = true;
        } else if (prog?.status !== 'solved') {
          const res = await getPuzzle(calendarId);
          if (res.data) return res;
        }
      } else {
        // Guest: show calendar if tutorial solved (not possible for guest without persistence, but for consistency)
        const res = await getPuzzle(calendarId);
        if (res.data) return res;
      }
    }
  }

  // --- STAGE 3: STANDARD SELECTION ---
  const isLowPlay = Math.random() < 0.25;
  const rpcName = isLowPlay ? 'get_low_play_puzzle' : 'get_recommended_puzzle';

  const fetchFn = () => supabase.rpc(rpcName, {
    p_user_id: userId || null
  }).select('*, author:profiles!created_by(username, is_anonymous)');

  let { data, error } = await fetchFn();

  // Safari "Load failed" retry
  if (error && error.message === 'Load failed') {
    console.warn(`Safari Load failed for ${rpcName}, retrying...`);
    await new Promise(r => setTimeout(r, 500));
    const result = await fetchFn();
    data = result.data;
    error = result.error;
  }

  if (error) {
    console.warn(`RPC ${rpcName} with join failed, retrying without join...`, error);
    const { data: fallbackData, error: fallbackError } = await supabase.rpc(rpcName, {
      p_user_id: userId || null
    });
    if (fallbackError) return { data: null, error: fallbackError };
    return { data: fallbackData?.[0] || null, error: null };
  }

  return { data: data?.[0] || null, error: null };
}

export async function getComments(puzzleId, sortBy = 'newest', page = 1, pageSize = 20, mentionUser = null) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('comments')
    .select('*, author:profiles!user_id(id, username, is_anonymous)', { count: 'exact' })
    .eq('puzzle_id', puzzleId);

  if (sortBy === 'liked') {
    query = query.order('likes_count', { ascending: false });
  } else if (sortBy === 'mentions' && mentionUser) {
    query = query.ilike('content', `%@${mentionUser}%`).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);
  return { data, error, count };
}

export async function getPaginatedProfilePuzzles({ userId, visitorId, type, page = 1, pageSize = 10, sortBy = 'newest' }) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query;
  const commonSelect = '*, author:profiles!created_by(username, is_anonymous)';

  // 1. Initialize query based on type
  if (type === 'author_published') {
    query = supabase
      .from('puzzles')
      .select(`${commonSelect}, user_progress!left(*)`, { count: 'exact' })
      .eq('created_by', userId)
      .eq('is_published', true);
    if (visitorId) query = query.eq('user_progress.user_id', visitorId);
  } 
  else if (type === 'author_unpublished') {
    query = supabase
      .from('puzzles')
      .select(`${commonSelect}, user_progress!left(*)`, { count: 'exact' })
      .eq('created_by', userId)
      .eq('is_published', false);
    if (visitorId) query = query.eq('user_progress.user_id', visitorId);
  } 
  else if (type === 'liked') {
    query = supabase
      .from('puzzles')
      .select(`${commonSelect}, user_progress!inner(*)`, { count: 'exact' })
      .eq('user_progress.user_id', userId)
      .eq('user_progress.is_liked', true)
      .eq('is_published', true);
  } 
  else if (type === 'solved') {
    query = supabase
      .from('puzzles')
      .select(`${commonSelect}, user_progress!inner(*)`, { count: 'exact' })
      .eq('user_progress.user_id', userId)
      .eq('user_progress.status', 'solved')
      .eq('is_published', true);
  } 
  else if (type === 'skipped') {
    query = supabase
      .from('puzzles')
      .select(`${commonSelect}, user_progress!inner(*)`, { count: 'exact' })
      .eq('user_progress.user_id', userId)
      .eq('user_progress.status', 'skipped')
      .eq('is_published', true);
  } 
  else if (type === 'in_progress') {
    query = supabase
      .from('puzzles')
      .select(`${commonSelect}, user_progress!inner(*)`, { count: 'exact' })
      .eq('user_progress.user_id', userId)
      .neq('user_progress.status', 'solved')
      .neq('user_progress.status', 'skipped')
      .not('user_progress.grid_state', 'is', null)
      .neq('user_progress.grid_state', '{}')
      .eq('is_published', true);
  } 
  else {
    // Fallback
    query = supabase.from('puzzles').select(`${commonSelect}, user_progress!left(*)`, { count: 'exact' });
    if (visitorId) query = query.eq('user_progress.user_id', visitorId);
  }

  // 2. Apply Sorting
  if (sortBy === 'likes') {
    query = query.order('likes_count', { ascending: false });
  } else if (sortBy === 'solves') {
    query = query.order('play_count', { ascending: false });
  } else if (sortBy === 'difficulty_desc') {
    query = query.order('difficulty_score', { ascending: false, nullsFirst: false });
  } else if (sortBy === 'difficulty_asc') {
    query = query.order('difficulty_score', { ascending: true, nullsFirst: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) return { data: null, count: 0, error };

  // 3. Handle secondary visitor status for activity tabs
  const isActivityTab = ['liked', 'solved', 'skipped', 'in_progress'].includes(type);
  let visitorProgressMap = {};
  if (isActivityTab && visitorId && visitorId !== userId && data?.length > 0) {
    const { data: vProgress } = await supabase
      .from('user_progress')
      .select('puzzle_id, status, is_liked')
      .eq('user_id', visitorId)
      .in('puzzle_id', data.map(p => p.id));
    
    if (vProgress) {
      vProgress.forEach(vp => {
        visitorProgressMap[vp.puzzle_id] = vp;
      });
    }
  }

  // 4. Map data for PuzzleCard
  const mappedData = data?.map(p => {
    const ownerProgress = p.user_progress?.[0] || null;
    const progressToUse = (isActivityTab && visitorId && visitorId !== userId)
      ? visitorProgressMap[p.id] || null
      : ownerProgress;

    return {
      ...p,
      user_progress: progressToUse
    };
  });

  return { data: mappedData, count, error };
}

export async function addComment(puzzleId, userId, content) {

  const { data: profile } = await getProfile(userId);
  const shouldShadowban = profile?.is_hard_shadowbanned || checkProfanity(content, true);

  const { data, error } = await supabase
    .from('comments')
    .insert([{
      puzzle_id: puzzleId,
      user_id: userId,
      content: content,
      is_shadowbanned: shouldShadowban
    }])
    .select('*, author:profiles!user_id(id, username)')
    .single();

  if (!error && shouldShadowban) {
    await recordShadowban(userId, 'content');
  }

  return { data, error };
}

export async function toggleCommentLike(commentId, userId) {
  const { data, error } = await supabase.rpc('toggle_comment_like', {
    p_comment_id: commentId,
    p_user_id: userId
  });
  return { data, error };
}

export async function getUserComments(userId) {
  const { data, error } = await supabase
    .from('comments')
    .select('*, puzzle:puzzles(id, title, categories, created_by)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function getUserMentions(userId, page = 1, pageSize = 10) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('comment_mentions')
    .select('id, is_read, comment:comments(*, author:profiles!user_id(username, is_anonymous), puzzle:puzzles(*, author:profiles!created_by(username, is_anonymous)))', { count: 'exact' })
    .eq('mentioned_user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (data) {
    const mapped = data
      .filter(m => m.comment !== null)
      .map(m => ({
        ...m.comment,
        is_read: m.is_read,
        mention_id: m.id
      }));
    return { data: mapped, error, count };
  }
  return { data: null, error, count: 0 };
}

export async function getPuzzleUnreadMentions(userId, puzzleId) {
  const { data, error } = await supabase
    .from('comment_mentions')
    .select('id, comment_id')
    .eq('mentioned_user_id', userId)
    .eq('puzzle_id', puzzleId)
    .eq('is_read', false);
  return { data, error };
}

export async function getUserUnreadMentionsCount(userId) {
  if (!userId) return { count: 0, error: null };
  const { count, error } = await supabase
    .from('comment_mentions')
    .select('*', { count: 'exact', head: true })
    .eq('mentioned_user_id', userId)
    .eq('is_read', false);
  return { count: count || 0, error };
}

export async function markMentionsRead(userId, puzzleId) {
  const { error } = await supabase.rpc('mark_mentions_read', {
    p_user_id: userId,
    p_puzzle_id: puzzleId
  });
  return { error };
}

export async function markSpecificMentionsRead(mentionIds) {
  if (!mentionIds || mentionIds.length === 0) return { error: null };
  const { error } = await supabase.rpc('mark_specific_mentions_read', {
    p_mention_ids: mentionIds
  });
  return { error };
}

export async function recordPuzzleShare(userId, puzzleId) {
  if (!userId) return { error: 'Not signed in' };

  // 1. Update user progress to mark as shared
  const { error: progError } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      has_shared: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, puzzle_id' });

  if (progError) return { error: progError };

  // 2. Increment global share count on puzzle
  const { error: puzzleError } = await supabase.rpc('record_puzzle_engagement', {
    p_id: puzzleId,
    u_id: userId,
    metric: 'share'
  });

  return { error: puzzleError };
}

export async function validateUsername(username) {
  if (!username || username.length < 3 || username.length > 30) {
    return { valid: false, error: 'Username must be between 3 and 30 characters.' };
  }

  if (/\s/.test(username)) {
    return { valid: false, error: 'Username cannot contain spaces.' };
  }

  // Obscenity check
  if (matcher.hasMatch(username)) {
    // Return generic error to obfuscate
    return { valid: false, error: 'This username is unavailable.' };
  }

  // Uniqueness check
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    console.error('Error checking username uniqueness:', error.message);
    // On DB error, we stay safe and block just in case
    return { valid: false, error: 'Could not verify username at this time.' };
  }

  if (data) {
    return { valid: false, error: 'This username is unavailable.' };
  }

  return { valid: true };
}

export async function getCommentLikes(userId, commentIds) {
  if (!userId || !commentIds || commentIds.length === 0) return { data: [], error: null };
  const { data, error } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('user_id', userId)
    .in('comment_id', commentIds);
  return { data, error };
}
