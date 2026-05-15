alter table public.pending_admin_emails
  add column if not exists role public.app_role not null default 'viewer';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _email text := lower(coalesce(new.email, ''));
  _pending_role public.app_role;
  _initial_role public.app_role := 'viewer';
begin
  if _email <> '' then
    select role into _pending_role
    from public.pending_admin_emails
    where lower(email) = _email
    limit 1;

    if found then
      _initial_role := _pending_role;
      delete from public.pending_admin_emails where lower(email) = _email;
    end if;
  end if;

  insert into public.user_roles (user_id, role, is_active)
  values (new.id, _initial_role, true)
  on conflict (user_id) do update
    set role = excluded.role,
        is_active = true,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.admin_invite_user(
  _email text,
  _role public.app_role default 'viewer'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
    and role = 'admin'
    and is_active = true
  ) then
    raise exception 'Only admins can invite users';
  end if;

  insert into public.pending_admin_emails (email, role)
  values (lower(trim(_email)), _role)
  on conflict (email) do update set role = excluded.role;
end;
$$;

grant execute on function public.admin_invite_user(text, public.app_role) to authenticated;