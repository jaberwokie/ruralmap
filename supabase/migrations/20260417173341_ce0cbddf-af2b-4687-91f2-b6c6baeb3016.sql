INSERT INTO public.pending_admin_emails (email)
VALUES ('jangel@nvbhs.com')
ON CONFLICT (email) DO NOTHING;