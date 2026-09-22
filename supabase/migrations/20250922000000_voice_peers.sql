-- Peer registry for gather-room mesh discovery (anon clients, Realtime postgres_changes).
create table if not exists public.voice_peers (
  room_id text not null,
  session_id text not null,
  peer_id text not null,
  name text not null default '???',
  color text not null default '#5865f2',
  is_sharing_screen boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (room_id, session_id, peer_id)
);

create index if not exists voice_peers_room_session_updated_idx
  on public.voice_peers (room_id, session_id, updated_at desc);

alter table public.voice_peers enable row level security;

drop policy if exists voice_peers_anon_all on public.voice_peers;
create policy voice_peers_anon_all on public.voice_peers
  for all to anon using (true) with check (true);

alter publication supabase_realtime add table public.voice_peers;
