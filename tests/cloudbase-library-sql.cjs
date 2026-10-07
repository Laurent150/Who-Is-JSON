// Optional local PostgreSQL/WASM acceptance. Never connects to a cloud database.
// Set FIMI_PGLITE_PATH to an unpacked PGlite package directory if needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const packageDir = process.env.FIMI_PGLITE_PATH || path.join(root, '.runtime/sql-acceptance/package');
const { PGlite } = require(path.join(packageDir, 'dist/index.cjs'));
const migration = fs.readFileSync(path.join(root, 'cloudbase/migrations/202610020001_library.sql'), 'utf8');
const check = fs.readFileSync(path.join(root, 'cloudbase/check-library-conflict.sql'), 'utf8');

(async () => {
  const db = new PGlite();
  const passed = [];
  try {
    // Reproduce the catalog/function evidence supplied by the user, not a claim
    // that this fixture implements the real CloudBase HTTP authentication layer.
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA public, auth TO authenticated;
      CREATE TABLE auth.users(id bigint PRIMARY KEY, sub varchar(255));
      CREATE FUNCTION auth.uid() RETURNS text LANGUAGE sql STABLE AS $$
        SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::text
      $$;
    `);
    await db.exec(migration);
    await db.exec(`INSERT INTO public.fimi_libraries(user_id, payload)
      VALUES ('existing-fixture', '{"knowledge":[],"cards":[],"marker":"keep"}');`);
    const baseline = (await db.query('SELECT * FROM public.fimi_libraries')).rows;
    const initialRole = (await db.query('SELECT current_user AS role')).rows[0].role;
    async function unchanged() {
      assert.deepEqual((await db.query('SELECT * FROM public.fimi_libraries')).rows, baseline);
      assert.equal((await db.query('SELECT current_user AS role')).rows[0].role, initialRole);
      const claims = (await db.query(`SELECT nullif(current_setting('request.jwt.claim.sub', true), '') AS sub`)).rows[0];
      assert.equal(claims.sub, null);
    }
    await db.exec(check);
    await unchanged();
    passed.push('deployed SQL candidate compiles and stale-version acceptance passes');
    passed.push('success rolls back test rows, role and claims; existing fixture unchanged');

    const definition = migration.match(/create function public\.fimi_save_library[\s\S]*?end \$\$;/i)[0]
      .replace(/^create function/i, 'create or replace function');
    // Prove the checker detects the defect it is intended to catch.
    await db.exec(definition.replace('and revision = expected_revision', ''));
    await assert.rejects(db.exec(check), /Stale save was not rejected/);
    await unchanged();
    await db.exec(definition);
    passed.push('missing version check is detected and failed check also rolls back');

    await db.exec('ALTER TABLE public.fimi_libraries DISABLE ROW LEVEL SECURITY');
    await assert.rejects(db.exec(check), /Another subject could read/);
    await unchanged();
    await db.exec('ALTER TABLE public.fimi_libraries ENABLE ROW LEVEL SECURITY');
    passed.push('disabled RLS is detected without leaving test data');

    await db.exec('GRANT UPDATE ON public.fimi_libraries TO authenticated');
    await assert.rejects(db.exec(check), /Direct table writes must not be granted/);
    await unchanged();
    await db.exec('REVOKE UPDATE ON public.fimi_libraries FROM authenticated');
    passed.push('unexpected direct-write grant is detected');
    await db.exec(check);
    await unchanged();
    const report = { pass: true, engine: 'PGlite', realCloud: false,
      simultaneousConnectionsTested: false, checks: passed };
    const output = path.join(root, '.browser-artifacts/cloudbase-live');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'sql-local-acceptance.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await db.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
