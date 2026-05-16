
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text not null,
  real_name text not null,
  year_level text not null,
  avatar_url text,
  background_url text,
  numeric_id text unique,
  role text not null default 'user' check (role in ('owner','admin','user')),
  blocked boolean not null default false,
  extra_comments int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  target text,
  body text not null,
  anonymous boolean not null default true,
  status text not null default 'pending' check (status in ('pending','approved','deleted')),
  public_author_name text,
  public_author_avatar text,
  image_url text,
  likes int not null default 0,
  share_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.friendships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, friend_id)
);

create table if not exists public.private_messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  group_id uuid,
  body text,
  shared_post_id uuid references public.posts(id) on delete set null,
  shared_profile_id uuid references public.profiles(id) on delete set null,
  game_invite text check (game_invite in ('gomoku','chess') or game_invite is null),
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(group_id, user_id)
);

create table if not exists public.post_likes (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create or replace function public.is_owner(uid uuid)
returns boolean language sql security definer stable as $$
  select exists(select 1 from public.profiles where id = uid and role = 'owner');
$$;

create or replace function public.is_manager(uid uuid)
returns boolean language sql security definer stable as $$
  select exists(select 1 from public.profiles where id = uid and role in ('owner','admin'));
$$;

create or replace function public.next_numeric_id()
returns text language plpgsql security definer as $$
declare
  c int;
  digits int;
  base bigint;
begin
  select count(*) into c from public.profiles;
  if c = 0 then
    return '111111';
  end if;
  digits := 6 + floor(greatest(c - 10, 0)::numeric / 20)::int;
  base := power(10, digits - 1)::bigint;
  return (base + c)::text;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, real_name, year_level, numeric_id, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1), 'User'),
    coalesce(nullif(new.raw_user_meta_data->>'real_name', ''), '未填写'),
    coalesce(nullif(new.raw_user_meta_data->>'year_level', ''), '未填写'),
    public.next_numeric_id(),
    'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.friendships enable row level security;
alter table public.private_messages enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.post_likes enable row level security;

drop policy if exists "profiles_select_logged_in" on public.profiles;
create policy "profiles_select_logged_in" on public.profiles for select using (auth.uid() is not null);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert with check (auth.uid() = id and role = 'user');

drop policy if exists "profiles_update_self_or_owner" on public.profiles;
create policy "profiles_update_self_or_owner" on public.profiles for update
using (auth.uid() = id or public.is_owner(auth.uid()))
with check (auth.uid() = id or public.is_owner(auth.uid()));

drop policy if exists "posts_select_visible" on public.posts;
create policy "posts_select_visible" on public.posts for select
using (status = 'approved' or public.is_manager(auth.uid()) or author_id = auth.uid());

drop policy if exists "posts_insert_self" on public.posts;
create policy "posts_insert_self" on public.posts for insert
with check (auth.uid() = author_id and exists(select 1 from public.profiles p where p.id = auth.uid() and p.blocked = false));

drop policy if exists "posts_update_manager_or_like" on public.posts;
create policy "posts_update_manager_or_like" on public.posts for update
using (public.is_manager(auth.uid()) or status = 'approved')
with check (public.is_manager(auth.uid()) or status = 'approved');

drop policy if exists "comments_select_visible" on public.comments;
create policy "comments_select_visible" on public.comments for select
using (public.is_manager(auth.uid()) or exists(select 1 from public.posts p where p.id = post_id and p.status = 'approved'));

drop policy if exists "comments_insert_self" on public.comments;
create policy "comments_insert_self" on public.comments for insert with check (auth.uid() = author_id);

drop policy if exists "comments_delete_manager_or_own" on public.comments;
create policy "comments_delete_manager_or_own" on public.comments for delete using (public.is_manager(auth.uid()) or author_id = auth.uid());

drop policy if exists "friends_select_own" on public.friendships;
create policy "friends_select_own" on public.friendships for select using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists "friends_insert_own" on public.friendships;
create policy "friends_insert_own" on public.friendships for insert with check (user_id = auth.uid());

drop policy if exists "messages_select_participant" on public.private_messages;
create policy "messages_select_participant" on public.private_messages for select
using (
  sender_id = auth.uid()
  or receiver_id = auth.uid()
  or exists(select 1 from public.group_members gm where gm.group_id = private_messages.group_id and gm.user_id = auth.uid())
);

drop policy if exists "messages_insert_sender" on public.private_messages;
create policy "messages_insert_sender" on public.private_messages for insert with check (sender_id = auth.uid());

drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member" on public.groups for select
using (owner_id = auth.uid() or exists(select 1 from public.group_members gm where gm.group_id = groups.id and gm.user_id = auth.uid()));

drop policy if exists "groups_insert_owner" on public.groups;
create policy "groups_insert_owner" on public.groups for insert with check (owner_id = auth.uid());

drop policy if exists "group_members_select_member" on public.group_members;
create policy "group_members_select_member" on public.group_members for select
using (user_id = auth.uid() or exists(select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()));

drop policy if exists "group_members_insert_owner" on public.group_members;
create policy "group_members_insert_owner" on public.group_members for insert
with check (exists(select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()) or user_id = auth.uid());

drop policy if exists "likes_select_all" on public.post_likes;
create policy "likes_select_all" on public.post_likes for select using (auth.uid() is not null);

drop policy if exists "likes_insert_self" on public.post_likes;
create policy "likes_insert_self" on public.post_likes for insert with check (user_id = auth.uid());

drop policy if exists "likes_delete_self" on public.post_likes;
create policy "likes_delete_self" on public.post_likes for delete using (user_id = auth.uid());

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('backgrounds', 'backgrounds', true) on conflict (id) do nothing;

drop policy if exists "public_storage_read" on storage.objects;
create policy "public_storage_read" on storage.objects for select using (bucket_id in ('avatars','post-images','backgrounds'));

drop policy if exists "storage_upload_own" on storage.objects;
create policy "storage_upload_own" on storage.objects for insert
with check (bucket_id in ('avatars','post-images','backgrounds') and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "storage_update_own" on storage.objects;
create policy "storage_update_own" on storage.objects for update
using (bucket_id in ('avatars','post-images','backgrounds') and auth.uid()::text = (storage.foldername(name))[1]);
