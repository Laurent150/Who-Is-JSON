-- Run the ENTIRE block once as the SQL console administrator.
-- Tests the deployed function under the authenticated database role.
-- Synthetic subjects only. All test writes and role/claim changes are rolled back
-- by the inner exception block, including when an assertion fails.
-- This checks stale-version handling, not simultaneous network requests.
DO $acceptance$
DECLARE
  test_subject text := '__fimi_check_' || md5(random()::text || clock_timestamp()::text);
  first_payload jsonb := '{"knowledge":[],"cards":[],"test_marker":"first"}'::jsonb;
  second_payload jsonb := '{"knowledge":[],"cards":[],"test_marker":"second"}'::jsonb;
  answer jsonb;
  stored_payload jsonb;
  stored_revision bigint;
BEGIN
  -- Refuse to touch a pre-existing row even in the unlikely event of a collision.
  IF EXISTS (SELECT 1 FROM public.fimi_libraries WHERE user_id = test_subject) THEN
    RAISE EXCEPTION 'Test identity collision; no test performed';
  END IF;

  BEGIN
    PERFORM set_config('request.jwt.claim.sub', test_subject, true);
    PERFORM set_config('request.jwt.claims', '{}', true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    IF current_user <> 'authenticated' OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = current_user AND (rolsuper OR rolbypassrls)
    ) THEN
      RAISE EXCEPTION 'Test must run as authenticated without RLS bypass';
    END IF;
    IF auth.uid() IS DISTINCT FROM test_subject THEN
      RAISE EXCEPTION 'Identity setup failed';
    END IF;
    IF has_table_privilege(current_user, 'public.fimi_libraries', 'INSERT')
       OR has_table_privilege(current_user, 'public.fimi_libraries', 'UPDATE')
       OR has_table_privilege(current_user, 'public.fimi_libraries', 'DELETE') THEN
      RAISE EXCEPTION 'Direct table writes must not be granted';
    END IF;

    answer := public.fimi_save_library(0, first_payload);
    IF answer IS DISTINCT FROM '{"revision":1}'::jsonb THEN
      RAISE EXCEPTION 'First save failed: %', answer;
    END IF;

    -- A second window still holding revision 0 must not overwrite revision 1.
    answer := public.fimi_save_library(0, second_payload);
    IF answer IS DISTINCT FROM '{"conflict":true}'::jsonb THEN
      RAISE EXCEPTION 'Stale save was not rejected: %', answer;
    END IF;
    SELECT revision, payload INTO stored_revision, stored_payload
      FROM public.fimi_libraries WHERE user_id = test_subject;
    IF stored_revision IS DISTINCT FROM 1::bigint
       OR stored_payload IS DISTINCT FROM first_payload THEN
      RAISE EXCEPTION 'Stale save altered the stored item';
    END IF;

    answer := public.fimi_save_library(1, second_payload);
    IF answer IS DISTINCT FROM '{"revision":2}'::jsonb THEN
      RAISE EXCEPTION 'Save with current revision failed: %', answer;
    END IF;
    SELECT revision, payload INTO stored_revision, stored_payload
      FROM public.fimi_libraries WHERE user_id = test_subject;
    IF stored_revision IS DISTINCT FROM 2::bigint
       OR stored_payload IS DISTINCT FROM second_payload THEN
      RAISE EXCEPTION 'Updated item could not be read back';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', test_subject || '_other', true);
    IF EXISTS (SELECT 1 FROM public.fimi_libraries WHERE user_id = test_subject) THEN
      RAISE EXCEPTION 'Another subject could read the test item';
    END IF;

    -- Deliberately roll back this subtransaction; catch only this success marker.
    RAISE SQLSTATE 'ZC001' USING MESSAGE = 'FIMI acceptance rollback';
  EXCEPTION WHEN SQLSTATE 'ZC001' THEN
    NULL;
  END;

  IF EXISTS (SELECT 1 FROM public.fimi_libraries WHERE user_id = test_subject) THEN
    RAISE EXCEPTION 'Test rollback left an item behind';
  END IF;
  RAISE NOTICE 'PASS: initial save, stale conflict, unchanged content, current-version save, subject isolation, rollback';
END
$acceptance$;
