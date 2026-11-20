import pg from 'pg';

if (!process.env.DATABASE_URL) {
	console.error('DATABASE_URL is missing.');
	process.exit(1);
}

function encodeUserInfo(value) {
	let encoded = '';
	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (character === '%' && /^[\da-f]{2}$/i.test(value.slice(index + 1, index + 3))) {
			encoded += value.slice(index, index + 3).toUpperCase();
			index += 2;
		} else if (/^[a-z\d._~-]$/i.test(character)) {
			encoded += character;
		} else {
			encoded += encodeURIComponent(character);
		}
	}
	return encoded;
}

const rawUrl = process.env.DATABASE_URL;
const match = rawUrl.match(/^(postgres(?:ql)?:\/\/)([^@]+)@(.+)$/i);
if (!match) {
	console.error('DATABASE_URL must be a PostgreSQL URL.');
	process.exit(1);
}
const separator = match[2].indexOf(':');
if (separator < 1) {
	console.error('DATABASE_URL must include a username and password.');
	process.exit(1);
}
const connectionString = `${match[1]}${encodeUserInfo(match[2].slice(0, separator))}:${encodeUserInfo(match[2].slice(separator + 1))}@${match[3]}`;
const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 8000 });

try {
	const identity = await pool.query('select current_database() as database_name');
	const tables = await pool.query(
		"select tablename from pg_catalog.pg_tables where schemaname = 'public' order by tablename"
	);
	const types = await pool.query(`
		select t.typname from pg_catalog.pg_type t
		join pg_catalog.pg_namespace n on n.oid=t.typnamespace
		where n.nspname='public' and t.typtype='e' order by t.typname
	`);
	const security = await pool.query(`
		select count(*)::int as tables,
		       count(*) filter (where c.relrowsecurity)::int as rls_enabled
		from pg_catalog.pg_class c
		join pg_catalog.pg_namespace n on n.oid=c.relnamespace
		where n.nspname='public' and c.relkind='r'
	`);
	const softDeleteColumns = await pool.query(`
		select table_name, column_name
		from information_schema.columns
		where table_schema='public' and table_name in ('facilities','facility_memberships','patients','therapy_programs','appointments','message_templates','reminder_tasks')
		  and column_name in ('deleted_at','deleted_by')
		order by table_name, column_name
	`);
	const prerequisites = await pool.query(`
		select
			to_regclass('auth.users') is not null as has_auth_users,
			to_regclass('supabase_migrations.schema_migrations') is not null as has_migration_ledger
	`);
	const history = prerequisites.rows[0].has_migration_ledger
		? await pool.query('select version, name from supabase_migrations.schema_migrations order by version')
		: { rows: [] };
	console.log(JSON.stringify({
		connected: true,
		database: identity.rows[0].database_name,
		publicTables: tables.rows.map((row) => row.tablename),
		publicEnums: types.rows.map((row) => row.typname),
		publicTableSecurity: security.rows[0],
		softDeleteColumns: softDeleteColumns.rows,
		...prerequisites.rows[0],
		appliedMigrations: history.rows
	}));
} catch (error) {
	console.error(JSON.stringify({ connected: false, code: error.code ?? null, name: error.name ?? null }));
	process.exitCode = 1;
} finally {
	await pool.end();
}
