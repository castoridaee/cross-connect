# Cross Connect Database Schema (Supabase)

This document describes the database structure and policies for the Cross Connect application.

## Tables

### `puzzles`
The core table storing puzzle data, layouts, and metadata.
- `id` (uuid, primary key): Unique identifier for the puzzle.
- `created_by` (uuid, references `auth.users`): The ID of the user who created the puzzle. Nullable for anonymous puzzles.
- `title` (text): The title of the puzzle.
- `categories` (jsonb): A list of category objects, each containing `words` and `description`.
- `layout` (jsonb): A 2D array representing the active grid cells (1 for active, 0 for empty).
- `word_order` (text[]): An array of words in the shuffled order they appear in the bank.
- `grid_data` (jsonb): The mapping of words to grid coordinates (used for editing).
- `is_published` (boolean): Whether the puzzle is visible to everyone. Defaults to `true`.
- `likes_count` (int4): Number of likes.
- `play_count` (int4): Number of times the puzzle was started.
- `solve_count` (int4): Number of times the puzzle was solved.
- `share_count` (int4): Number of times the puzzle was shared.
- `author_profile_clicks` (int4): Number of times users clicked the author's profile.
- `trimmean_attempts_to_solve` (float8): Global 20% trimmed mean of attempts needed.
- `median_time_to_solve` (float8): Global median time taken to solve.
- `median_moves_to_solve` (float8): Global median number of moves.
- `trimmean_hints_used` (float8): Global 20% trimmed mean of hints used.
- `difficulty_score` (float8): Metric = `((MedTime/75 + MedMoves/30 + TrimAttempts-1 + TrimHints) / (SolveRate + 1)) / 5`.
- `locale` (text): The browser locale (e.g., `en-US`) of the creator.
- `created_at` (timestamp with time zone): When the puzzle was created.

### `profiles`
Public user profiles linked to Supabase Auth users.
- `id` (uuid, references `auth.users`): Primary key.
- `nickname` (text): The public display name of the user.
- `updated_at` (timestamp with time zone): Last updated timestamp.
- `locale` (text): The user's preferred browser locale.

### `user_progress`
Tracks user performance and "Skip" status on specific puzzles.
- `id` (uuid, primary key).
- `user_id` (uuid, references `auth.users`): Links to the player.
- `puzzle_id` (uuid, references `puzzles`): Links to the puzzle.
- `is_solved` (boolean): Whether the user has solved the puzzle.
- `is_skipped` (boolean): Whether the user has skipped the puzzle.
- `is_liked` (boolean): Whether the user has liked the puzzle.
- `has_shared` (boolean): Whether the user has shared the puzzle.
- `has_clicked_author` (boolean): Whether the user clicked the author's profile.
- `status` (text, generated): Derived status (`solved` > `skipped` > `in_progress`).
- `grid_state` (jsonb): The current state of the grid for resuming.
- `attempts` (int4): Number of check/submit attempts.
- `move_count` (int4): Number of moves made.
- `hints_revealed` (jsonb): List of hints shown to the user.
- `hints_revealed_count` (int4): Count of hints revealed (kept in sync via trigger).
- `guess_history` (jsonb): History of validation attempts.
- `total_seconds_played` (int4): Cumulative time played.
- `started_at` (timestamp with time zone): When the user started the puzzle.
- `solved_at` (timestamp with time zone): When the user first solved the puzzle.
- `updated_at` (timestamp with time zone): Last time any interaction occurred.
- **Unique Constraint:** `(user_id, puzzle_id)` ensures one record per player-puzzle pair.

## Row Level Security (RLS)

### `puzzles`
- **Anyone** can view puzzles where `is_published = true`.
- **Authenticated users** can insert their own puzzles (`auth.uid() = created_by`).
- **Owners** can update or delete their own puzzles.

### `profiles`
- **Anyone** can view all public profiles for author mapping.
- **Users** can only insert/update their own profile.
