import { supabase } from './supabase';

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
  const { data, error } = await supabase
    .from('puzzles')
    .insert([puzzleData])
    .select()
    .single();

  return { data, error };
}

export async function updatePuzzle(id, data) {
  const { error } = await supabase
    .from('puzzles')
    .update(data)
    .eq('id', id);
  return { error };
}

export async function getPuzzlesByAuthor(authorId) {
  const { data, error } = await supabase
    .from('puzzles')
    .select('*, author:profiles!created_by(nickname)')
    .eq('created_by', authorId)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function getProfile(id) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();
  return { data, error };
}

export async function getPuzzle(id) {
  const { data, error } = await supabase
    .from('puzzles')
    .select('*, author:profiles!created_by(nickname)')
    .eq('id', id)
    .single();
  return { data, error };
}

export async function recordPuzzleSkip(userId, puzzleId) {
  console.log("DB: Recording skip for", { userId, puzzleId });
  const { data: current } = await getPuzzleProgress(userId, puzzleId);
  if (current?.is_solved || current?.status === 'solved') {
    console.log("[recordPuzzleSkip] Ignoring skip: Puzzle already solved.");
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
  
  if (error) console.error(`[savePuzzleProgress] DB Error:`, error.message);
  else console.log(`[savePuzzleProgress] Auto-saved progress for ${puzzleId}`);
  
  return { error };
}

export async function getPuzzleProgress(userId, puzzleId) {
  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('puzzle_id', puzzleId)
    .maybeSingle();
  return { data, error };
}
export async function getUserProgressForPuzzles(userId, puzzleIds) {
  if (!userId || !puzzleIds || puzzleIds.length === 0) return { data: [], error: null };
  const { data, error } = await supabase
    .from('user_progress')
    .select('puzzle_id, status, is_liked')
    .eq('user_id', userId)
    .in('puzzle_id', puzzleIds);
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
  
  console.log(`[recordPuzzlePlay] Start: user=${userId}, puzzle=${puzzleId}`);
  
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
    console.log(`[recordPuzzlePlay] Success: Row ${data.id} is present. Status: ${data.status}`);
  }
  
  return { data, error };
}

export async function togglePuzzleLike(puzzleId, userId) {
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
