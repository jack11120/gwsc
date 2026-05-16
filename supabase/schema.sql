
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text not null,
  real_name text not null,
  year_level text not null,
  avatar_url text,
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
  likes int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.private_messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
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

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.private_messages enable row level security;
alter table public.friendships enable row level security;

create or replace function public.is_manager(uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('owner','admin')
  );
$$;

create or replace function public.is_owner(uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'owner'
  );
$$;

drop policy if exists "profiles_select_self_or_manager" on public.profiles;
create policy "profiles_select_self_or_manager"
on public.profiles for select
using (auth.uid() = id or public.is_manager(auth.uid()));

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles for insert
with check (auth.uid() = id and role = 'user');

drop policy if exists "profiles_update_self_or_manager" on public.profiles;
create policy "profiles_update_self_or_manager"
on public.profiles for update
using (auth.uid() = id or public.is_manager(auth.uid()))
with check (
  auth.uid() = id
  or public.is_owner(auth.uid())
  or (
    public.is_manager(auth.uid())
    and role <> 'owner'
  )
);

drop policy if exists "posts_select_approved_or_manager_or_own" on public.posts;
create policy "posts_select_approved_or_manager_or_own"
on public.posts for select
using (status = 'approved' or public.is_manager(auth.uid()) or author_id = auth.uid());

drop policy if exists "posts_insert_logged_in" on public.posts;
create policy "posts_insert_logged_in"
on public.posts for insert
with check (auth.uid() = author_id and exists(select 1 from public.profiles p where p.id = auth.uid() and p.blocked = false));

drop policy if exists "posts_update_manager_or_like" on public.posts;
create policy "posts_update_manager_or_like"
on public.posts for update
using (public.is_manager(auth.uid()) or status = 'approved')
with check (public.is_manager(auth.uid()) or status = 'approved');

drop policy if exists "posts_delete_manager" on public.posts;
create policy "posts_delete_manager"
on public.posts for delete
using (public.is_manager(auth.uid()));

drop policy if exists "comments_select_approved_posts_or_manager" on public.comments;
create policy "comments_select_approved_posts_or_manager"
on public.comments for select
using (
  public.is_manager(auth.uid())
  or exists(select 1 from public.posts p where p.id = post_id and p.status = 'approved')
);

drop policy if exists "comments_insert_logged_in" on public.comments;
create policy "comments_insert_logged_in"
on public.comments for insert
with check (auth.uid() = author_id and exists(select 1 from public.profiles p where p.id = auth.uid() and p.blocked = false));

drop policy if exists "comments_delete_manager_or_own" on public.comments;
create policy "comments_delete_manager_or_own"
on public.comments for delete
using (public.is_manager(auth.uid()) or author_id = auth.uid());

drop policy if exists "messages_select_participants" on public.private_messages;
create policy "messages_select_participants"
on public.private_messages for select
using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "messages_insert_sender" on public.private_messages;
create policy "messages_insert_sender"
on public.private_messages for insert
with check (sender_id = auth.uid());

drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own"
on public.friendships for select
using (user_id = auth.uid());

drop policy if exists "friendships_insert_own" on public.friendships;
create policy "friendships_insert_own"
on public.friendships for insert
with check (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar_public_read" on storage.objects;
create policy "avatar_public_read"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "avatar_upload_own" on storage.objects;
create policy "avatar_upload_own"
on storage.objects for insert
with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "avatar_update_own" on storage.objects;
create policy "avatar_update_own"
on storage.objects for update
using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
