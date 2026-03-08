
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log("Checking puzzles...");
  const { count, error: countError } = await supabase
    .from('puzzles')
    .select('*', { count: 'exact', head: true });
  
  console.log("Count:", count);
  if (countError) console.error("Count Error:", countError);

  if (count > 0) {
    console.log("Fetching one puzzle with explicit join...");
    const { data, error } = await supabase
      .from('puzzles')
      .select('*, author:profiles!created_by(nickname)')
      .limit(1);
    
    if (error) {
      console.error("Fetch Error:", error);
      console.log("Retrying without join...");
      const { data: data2, error: error2 } = await supabase
        .from('puzzles')
        .select('*')
        .limit(1);
      console.log("Retry result:", data2 ? "Success" : "Empty", error2 || "");
    } else {
      console.log("Fetch Success:", data[0]);
    }
  }
}

debug();
