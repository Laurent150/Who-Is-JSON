-- Read-only metadata only: no account rows, credentials, or JWT values.
SELECT
  (
    SELECT jsonb_agg(jsonb_build_object(
      'return_type', pg_catalog.pg_get_function_result(p.oid),
      'definition', pg_catalog.pg_get_functiondef(p.oid)
    ))
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid' AND p.pronargs = 0
  ) AS identity_function,
  (
    SELECT jsonb_agg(jsonb_build_object(
      'column', a.attname,
      'type', pg_catalog.format_type(a.atttypid, a.atttypmod)
    ) ORDER BY a.attnum)
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth' AND c.relname = 'users'
      AND a.attnum > 0 AND NOT a.attisdropped
  ) AS user_columns;
