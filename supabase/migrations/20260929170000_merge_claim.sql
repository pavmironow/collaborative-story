-- The chapter merge runs inside a normal request that a client makes from the "weaving" screen
-- (serverless hosts may freeze work started after a response). This claim lets exactly one
-- request run it per round, and lets a later request take over if that one died.
alter table public.rooms add column merge_started_at timestamptz;
