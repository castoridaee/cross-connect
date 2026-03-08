import { supabase } from './supabase';

export async function recordPuzzleSolve(userId, puzzleId, stats) {
  const { attempts, moves, seconds } = stats;

  // 1. Save the individual user's performance
  const { error: progressError } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      status: 'solved',
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
    p_seconds: seconds
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
  const { error } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      status: 'skipped',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, puzzle_id' });
  
  if (error) console.error("DB Error in recordPuzzleSkip:", error);
  return { error };
}

export async function savePuzzleProgress(userId, puzzleId, progress) {
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
    .select('puzzle_id, status')
    .eq('user_id', userId)
    .in('puzzle_id', puzzleIds);
  return { data, error };
}
