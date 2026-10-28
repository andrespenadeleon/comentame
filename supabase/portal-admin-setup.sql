-- 1. Apply migrations/202610270003_portal_admin.sql after all earlier migrations.
-- 2. Create your user in Supabase: Authentication > Users > Add user.
--    Use an email/password and mark the email confirmed.
-- 3. Replace the UUID below with that user's ID and run in SQL Editor.
--    Never use user_metadata to assign portal-admin privileges.
insert into private.portal_admins(user_id)
values ('REPLACE_WITH_AUTH_USER_UUID')
on conflict(user_id) do nothing;

-- Sign in at /login with that user's email/password. You will reach /admin.
-- No restaurant profile or onboarding is required for a portal administrator.
-- Membership is checked live on every request, including direct RPC calls.

-- To revoke access, run this separately with the same actual UUID:
-- delete from private.portal_admins where user_id='REPLACE_WITH_AUTH_USER_UUID';
