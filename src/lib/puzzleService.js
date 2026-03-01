import { supabase } from './supabase';

/**
 * Updates user progress and increments global puzzle stats.
 */
export const recordPuzzleSolve = async (userId, puzzleId, stats) => {
  const { attempts, moves, seconds } = stats;

  // 1. Update/Upsert the user's personal progress
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
    });

  if (progressError) throw progressError;

  // 2. Increment global puzzle aggregates (RPC call)
  // We use an RPC (Remote Procedure Call) to ensure atomic increments in Postgres
  const { error: statsError } = await supabase.rpc('increment_puzzle_stats', {
    p_id: puzzleId,
    p_attempts: attempts,
    p_seconds: seconds
  });

  return { success: !statsError, error: statsError };
};