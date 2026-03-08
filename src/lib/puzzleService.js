import { supabase } from './supabase';

export async function recordPuzzleSolve(userId, puzzleId, stats) {
  const { attempts, moves, seconds } = stats;

  // 1. Save the individual user's performance
  const { error: progressError } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      is_solved: true,
      attempts: attempts,
      move_count: moves,
      total_seconds_played: seconds,
      solved_at: new Date().toISOString()
    }, { onConflict: 'user_id, puzzle_id' });

  if (progressError) throw progressError;

  // 2. Update global puzzle averages via RPC
  const { error: rpcError } = await supabase.rpc('increment_puzzle_stats', {
    p_id: puzzleId,
    p_attempts: attempts,
    p_seconds: seconds,
    p_moves: moves
  });

  return { error: rpcError };
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
  if (current?.status === 'solved') return { error: null };

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
  if (!userId || !puzzleId) return { error: 'Missing IDs' };
  
  // 1. Check if user already has progress for this puzzle
  const { data: existing } = await getPuzzleProgress(userId, puzzleId);
  
  if (!existing) {
    // 2. Initialize progress (Trigger will handle global play_count automatically)
    const { error: progressError } = await supabase
      .from('user_progress')
      .insert({
        user_id: userId,
        puzzle_id: puzzleId
      });
      
    return { error: progressError };
  }
  
  return { data: existing, error: null };
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
