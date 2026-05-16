-- GWSC V4 frontend support + view safety patch
-- 运行时机：先运行 V3.1 安全版完整 SQL，再运行本 patch
-- 用途：
-- 1. 确保游戏表和实时功能可用
-- 2. 收紧 admin/owner views，避免普通登录用户读到不该看的数据

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

-- 确保游戏表实时同步
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_sessions') then
      alter publication supabase_realtime add table public.game_sessions;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_moves') then
      alter publication supabase_realtime add table public.game_moves;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
