# Cross Connect Database Schema (Supabase)

This document describes the database structure and policies for the Cross Connect application.

## Tables

### `puzzles`
The core table storing puzzle data, layouts, and metadata.
- `id` (uuid, primary key): Unique identifier for the puzzle.
- `author_id` (uuid): Potential legacy or secondary author reference.
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
- `avg_attempts_to_solve` (float8): Global average of attempts needed.
- `avg_time_to_solve` (float8): Global average time taken to solve.
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
- `status` (text): State of the puzzle for this user (`in_progress`, `solved`, `skipped`).
- `grid_state` (jsonb): The current state of the grid for resuming.
- `attempts` (int4): Number of check/submit attempts.
- `move_count` (int4): Number of moves made.
- `started_at` (timestamp): When the user started the puzzle.
- `solved_at` (timestamp): When the user solved the puzzle.
- `updated_at` (timestamp): Last time any interaction occurred.
- `total_seconds_played` (int4): Time taken to solve.
- **Unique Constraint:** `(user_id, puzzle_id)` ensures one record per player-puzzle pair.

## Row Level Security (RLS)

### `puzzles`
- **Anyone** can view puzzles where `is_published = true`.
- **Authenticated users** can insert their own puzzles (`auth.uid() = created_by`).
- **Owners** can update or delete their own puzzles.

### `profiles`
- **Anyone** can view all public profiles for author mapping.
- **Users** can only insert/update their own profile.

## Syncing Local Documentation with Remote
The best way to sync your remote Supabase schema back to this project is using the **Supabase CLI**.

1. **Initialize Supabase locally (if not done):**
   ```bash
   npx supabase init
   ```
2. **Link to your remote project:**
   ```bash
   npx supabase link --project-ref <your-project-id>
   ```
3. **Pull remote changes into local migrations:**
   ```bash
   npx supabase db pull
   ```
This will generate new migration files in `supabase/migrations` that match your actual remote state.
