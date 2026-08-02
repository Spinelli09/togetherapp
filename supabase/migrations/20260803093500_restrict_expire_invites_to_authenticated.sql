-- Flagged by the security advisor: unlike get_invite_preview, there's no
-- reason for anon to call this — only ever invoked by a signed-in owner.
revoke execute on function public.expire_stale_household_invites(uuid) from anon;
