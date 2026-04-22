/*
  DATASCOPE CLOUD SETUP
  =====================
  1. Create a free project at https://supabase.com
  2. Go to Settings > API and copy your Project URL + anon/public key
  3. Paste them into the two variables below
  4. Open the SQL Editor in Supabase and run:

     create table user_data (
       id uuid default gen_random_uuid() primary key,
       user_id uuid references auth.users(id) on delete cascade not null,
       data_key text not null,
       data jsonb not null default '[]'::jsonb,
       updated_at timestamptz default now(),
       unique(user_id, data_key)
     );

     alter table user_data enable row level security;

     create policy "Users manage own data" on user_data
       for all using (auth.uid() = user_id)
       with check (auth.uid() = user_id);

  5. (Optional) To skip email confirmation for dev/testing:
     Authentication > Settings > uncheck "Enable email confirmations"

  If the values below are left as placeholders, DataScope runs in
  local-only mode — no login required, data stays in the browser.
*/

const DATASCOPE_SUPABASE_URL = 'YOUR_SUPABASE_URL';
const DATASCOPE_SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

window.datascope = window.datascope || {};

if (
  DATASCOPE_SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
  DATASCOPE_SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
  window.supabase
) {
  window.datascope.sb = window.supabase.createClient(
    DATASCOPE_SUPABASE_URL,
    DATASCOPE_SUPABASE_ANON_KEY
  );
}
