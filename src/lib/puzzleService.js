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