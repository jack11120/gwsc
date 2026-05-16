-- GWSC V4 frontend support patch
-- Run this after the base V3/V3.1 schema.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Public-safe views used by the V4 frontend
-- ---------------------------------------------------------------------------

create or replace view public.public_profiles_view as
select
  id,
  numeric_id,
  display_name,
  avatar_url,
  background_url,
  role,
  created_at
from public.profiles
where blocked = false;

create or replace view public.public_posts_view as
select
  p.id,
  case when p.anonymous then null else p.author_id end as public_author_id,
  p.target,
  p.body,
  p.anonymous,
  p.status,
  p.public_author_name,
  p.public_author_avatar,
  p.image_url,
  p.likes,
  p.share_count,
  p.created_at
from public.posts p
where p.status = 'approved';

create or replace view public.admin_posts_view as
select
  p.id,
  case when p.anonymous then null else p.author_id end as public_author_id,
  p.target,
  p.body,
  p.anonymous,
  p.status,
  p.public_author_name,
  p.public_author_avatar,
  p.image_url,
  p.likes,
  p.share_count,
  p.created_at
from public.posts p
where p.status <> 'deleted'
  and public.is_manager(auth.uid());

create or replace view public.owner_posts_view as
select
  p.*,
  pr.email as author_email,
  pr.real_name as author_real_name,
  pr.year_level as author_year_level,
  pr.display_name as author_display_name,
  pr.numeric_id as author_numeric_id
from public.posts p
join public.profiles pr on pr.id = p.author_id
where p.status <> 'deleted'
  and public.is_owner(auth.uid());

grant select on public.public_profiles_view to authenticated;
grant select on public.public_posts_view to authenticated;
grant select on public.admin_posts_view to authenticated;
grant select on public.owner_posts_view to authenticated;

-- ---------------------------------------------------------------------------
-- Game tables used by the V4 frontend
-- ---------------------------------------------------------------------------

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  game_type text not null check (game_type in ('gomoku','chess')),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid not null references public.profiles(id) on delete cascade,
  board_state jsonb not null default '{}'::jsonb,
  current_turn uuid references public.profiles(id) on delete set null,
  winner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active','finished','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_moves (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.game_sessions(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  move_no int not null,
  move jsonb not null,
  created_at timestamptz not null default now(),
  unique(game_id, move_no)
);

create index if not exists game_sessions_inviter_id_idx on public.game_sessions(inviter_id);
create index if not exists game_sessions_opponent_id_idx on public.game_sessions(opponent_id);
create index if not exists game_sessions_updated_at_idx on public.game_sessions(updated_at desc);
create index if not exists game_moves_game_id_idx on public.game_moves(game_id);

alter table public.game_sessions enable row level security;
alter table public.game_moves enable row level security;

drop policy if exists "game_sessions_select_participant" on public.game_sessions;
create policy "game_sessions_select_participant" on public.game_sessions
for select using (inviter_id = auth.uid() or opponent_id = auth.uid());

drop policy if exists "game_sessions_insert_inviter" on public.game_sessions;
create policy "game_sessions_insert_inviter" on public.game_sessions
for insert with check (inviter_id = auth.uid());

drop policy if exists "game_sessions_update_participant" on public.game_sessions;
create policy "game_sessions_update_participant" on public.game_sessions
for update
using (inviter_id = auth.uid() or opponent_id = auth.uid())
with check (inviter_id = auth.uid() or opponent_id = auth.uid());

drop policy if exists "game_moves_select_participant" on public.game_moves;
create policy "game_moves_select_participant" on public.game_moves
for select using (
  exists (
    select 1
    from public.game_sessions g
    where g.id = game_moves.game_id
      and (g.inviter_id = auth.uid() or g.opponent_id = auth.uid())
  )
);

drop policy if exists "game_moves_insert_player" on public.game_moves;
create policy "game_moves_insert_player" on public.game_moves
for insert with check (player_id = auth.uid());

grant select, insert, update, delete on public.game_sessions to authenticated;
grant select, insert, update, delete on public.game_moves to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs used by app/page.js
-- ---------------------------------------------------------------------------

create or replace function public.create_comment(p_post_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '请先登录。';
  end if;

  if nullif(trim(coalesce(p_body, '')), '') is null then
    raise exception '评论不能为空。';
  end if;

  if not exists (select 1 from public.posts where id = p_post_id and status = 'approved') then
    raise exception '帖子不存在或还未通过审核。';
  end if;

  insert into public.comments (post_id, author_id, body)
  values (p_post_id, auth.uid(), trim(p_body));

  return jsonb_build_object(
    'ok', true,
    'message', '评论成功。'
  );
end;
$$;

create or replace function public.toggle_like(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '请先登录。';
  end if;

  if exists (select 1 from public.post_likes where post_id = p_post_id and user_id = auth.uid()) then
    delete from public.post_likes
    where post_id = p_post_id and user_id = auth.uid();

    update public.posts
    set likes = greatest(likes - 1, 0)
    where id = p_post_id;

    return jsonb_build_object('liked', false);
  end if;

  insert into public.post_likes (post_id, user_id)
  values (p_post_id, auth.uid());

  update public.posts
  set likes = likes + 1
  where id = p_post_id;

  return jsonb_build_object('liked', true);
end;
$$;

create or replace function public.share_post(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '请先登录。';
  end if;

  update public.posts
  set share_count = share_count + 1
  where id = p_post_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.add_friend_by_numeric_id(p_numeric_id text)
returns public.public_profiles_view
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.profiles;
  public_target public.public_profiles_view;
begin
  if auth.uid() is null then
    raise exception '请先登录。';
  end if;

  select *
  into target
  from public.profiles
  where numeric_id = trim(p_numeric_id)
    and blocked = false;

  if target.id is null or target.id = auth.uid() then
    raise exception '没有找到这个数字 ID。';
  end if;

  insert into public.friendships (user_id, friend_id)
  values (auth.uid(), target.id)
  on conflict (user_id, friend_id) do nothing;

  select *
  into public_target
  from public.public_profiles_view
  where id = target.id;

  return public_target;
end;
$$;

create or replace function public.send_private_message(
  p_receiver_id uuid,
  p_body text,
  p_shared_post_id uuid default null,
  p_shared_profile_id uuid default null,
  p_game_invite text default null,
  p_group_id uuid default null
)
returns public.private_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_profile public.profiles;
  created_message public.private_messages;
begin
  if auth.uid() is null then
    raise exception '请先登录。';
  end if;

  select *
  into sender_profile
  from public.profiles
  where id = auth.uid();

  if sender_profile.id is null then
    raise exception '用户资料不存在，请重新登录。';
  end if;

  if sender_profile.blocked then
    raise exception '你已被限制发送私信。';
  end if;

  if p_group_id is null and p_receiver_id is null then
    raise exception '请选择聊天对象。';
  end if;

  if p_receiver_id is not null and not exists (select 1 from public.profiles where id = p_receiver_id and blocked = false) then
    raise exception '聊天对象不存在。';
  end if;

  if p_group_id is not null and not exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = sender_profile.id
  ) then
    raise exception '你不是这个群聊成员。';
  end if;

  if nullif(trim(coalesce(p_body, '')), '') is null
    and p_shared_post_id is null
    and p_shared_profile_id is null
    and p_game_invite is null then
    raise exception '消息内容不能为空。';
  end if;

  insert into public.private_messages (
    sender_id,
    receiver_id,
    group_id,
    body,
    shared_post_id,
    shared_profile_id,
    game_invite
  )
  values (
    sender_profile.id,
    case when p_group_id is null then p_receiver_id else null end,
    p_group_id,
    coalesce(p_body, ''),
    p_shared_post_id,
    p_shared_profile_id,
    p_game_invite
  )
  returning * into created_message;

  return created_message;
end;
$$;

create or replace function public.owner_set_role(p_user_id uuid, p_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if not public.is_owner(auth.uid()) then
    raise exception '只有群主可以修改角色。';
  end if;

  if p_role not in ('owner','admin','user') then
    raise exception '角色无效。';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id
  returning * into updated_profile;

  return updated_profile;
end;
$$;

create or replace function public.manager_block_user(p_user_id uuid, p_blocked boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if not public.is_manager(auth.uid()) then
    raise exception '只有管理员可以拉黑用户。';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id and role = 'owner') then
    raise exception '不能拉黑群主。';
  end if;

  update public.profiles
  set blocked = p_blocked
  where id = p_user_id
  returning * into updated_profile;

  return updated_profile;
end;
$$;

drop function if exists public.owner_add_comment_bonus(uuid, int);

create or replace function public.create_group_chat(p_name text, p_member_ids uuid[])
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  created_group public.groups;
  member_id uuid;
begin
  if auth.uid() is null then
    raise exception '请先登录。';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception '群聊名称不能为空。';
  end if;

  insert into public.groups (name, owner_id)
  values (trim(p_name), auth.uid())
  returning * into created_group;

  insert into public.group_members (group_id, user_id)
  values (created_group.id, auth.uid())
  on conflict (group_id, user_id) do nothing;

  foreach member_id in array coalesce(p_member_ids, array[]::uuid[]) loop
    insert into public.group_members (group_id, user_id)
    values (created_group.id, member_id)
    on conflict (group_id, user_id) do nothing;
  end loop;

  return created_group;
end;
$$;

create or replace function public.invite_game(p_receiver_id uuid, p_game_type text)
returns public.game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  created_game public.game_sessions;
  initial_board jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception '请先登录。';
  end if;

  if p_game_type not in ('gomoku','chess') then
    raise exception '游戏类型无效。';
  end if;

  if p_receiver_id is null or p_receiver_id = auth.uid() then
    raise exception '请选择有效的好友。';
  end if;

  insert into public.game_sessions (game_type, inviter_id, opponent_id, board_state, current_turn)
  values (p_game_type, auth.uid(), p_receiver_id, initial_board, auth.uid())
  returning * into created_game;

  perform public.send_private_message(
    p_receiver_id,
    case when p_game_type = 'gomoku' then '邀请你玩五子棋' else '邀请你玩 Chess' end,
    null,
    null,
    p_game_type,
    null
  );

  return created_game;
end;
$$;

create or replace function public.create_game_move(p_game_id uuid, p_move jsonb)
returns public.game_moves
language plpgsql
security definer
set search_path = public
as $$
declare
  game public.game_sessions;
  next_no int;
  created_move public.game_moves;
begin
  if auth.uid() is null then
    raise exception '请先登录。';
  end if;

  select *
  into game
  from public.game_sessions
  where id = p_game_id
    and (inviter_id = auth.uid() or opponent_id = auth.uid());

  if game.id is null then
    raise exception '游戏不存在。';
  end if;

  select coalesce(max(move_no), 0) + 1
  into next_no
  from public.game_moves
  where game_id = p_game_id;

  insert into public.game_moves (game_id, player_id, move_no, move)
  values (p_game_id, auth.uid(), next_no, coalesce(p_move, '{}'::jsonb))
  returning * into created_move;

  return created_move;
end;
$$;

grant execute on function public.create_comment(uuid, text) to authenticated;
grant execute on function public.toggle_like(uuid) to authenticated;
grant execute on function public.share_post(uuid) to authenticated;
grant execute on function public.add_friend_by_numeric_id(text) to authenticated;
grant execute on function public.send_private_message(uuid, text, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.owner_set_role(uuid, text) to authenticated;
grant execute on function public.manager_block_user(uuid, boolean) to authenticated;
grant execute on function public.create_group_chat(text, uuid[]) to authenticated;
grant execute on function public.invite_game(uuid, text) to authenticated;
grant execute on function public.create_game_move(uuid, jsonb) to authenticated;

-- Make sure private message reads work through the REST API.
grant select, insert, update, delete on public.private_messages to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, update, delete on public.game_sessions to authenticated;
grant select, insert, update, delete on public.game_moves to authenticated;

-- Realtime support for V4 tables.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'private_messages') then
      alter publication supabase_realtime add table public.private_messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_sessions') then
      alter publication supabase_realtime add table public.game_sessions;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_moves') then
      alter publication supabase_realtime add table public.game_moves;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
