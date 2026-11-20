import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

const migrationsDirectory = new URL('../supabase/migrations/', import.meta.url);

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

function normalizeConnectionString(raw) {
	const match = raw.match(/^(postgres(?:ql)?:\/\/)([^@]+)@(.+)$/i);
	if (!match) throw new Error('DATABASE_URL must be a PostgreSQL URL.');
	const separator = match[2].indexOf(':');
	if (separator < 1) throw new Error('DATABASE_URL must contain username and password.');
	const username = encodeUserInfo(match[2].slice(0, separator));
	const password = encodeUserInfo(match[2].slice(separator + 1));
	return `${match[1]}${username}:${password}@${match[3]}`;
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error('DATABASE_URL is missing.');
const pool = new pg.Pool({ connectionString: normalizeConnectionString(rawUrl), connectionTimeoutMillis: 8000 });

try {
	const client = await pool.connect();
	try {
		const prerequisites = await client.query(`
			select to_regclass('auth.users') is not null as has_auth_users,
			       to_regclass('supabase_migrations.schema_migrations') is not null as has_migration_ledger
		`);
		if (!prerequisites.rows[0].has_auth_users) throw new Error('This database does not have Supabase Auth.');
		await client.query('create schema if not exists supabase_migrations');
		await client.query(`
			create table if not exists supabase_migrations.schema_migrations (
				version text primary key,
				statements text[] not null,
				name text
			)
		`);
		const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();
		for (const file of files) {
			const match = file.match(/^(\d+)_(.+)\.sql$/);
			if (!match) throw new Error(`Nama migration tidak valid: ${file}`);
			const [, version, name] = match;
			const applied = await client.query('select 1 from supabase_migrations.schema_migrations where version=$1', [version]);
			if (applied.rowCount) {
				console.log(`Migration ${version} sudah tercatat.`);
				continue;
			}
			if (version === '202611190001') {
				const state = await client.query(`
					select
						(select count(*) from pg_catalog.pg_tables where schemaname='public')::int as table_count,
						(select count(*) from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e')::int as enum_count
				`);
				if (state.rows[0].table_count !== 0 || state.rows[0].enum_count !== 0) {
					throw new Error('Public schema is not empty. Refusing to apply the initial migration over existing application objects.');
				}
			}
			const sql = await readFile(new URL(file, migrationsDirectory), 'utf8');
			await client.query('begin');
			try {
				await client.query(sql);
				await client.query(
					'insert into supabase_migrations.schema_migrations(version, statements, name) values($1,$2,$3)',
					[version, [sql], name]
				);
				await client.query('commit');
				console.log(`Migration ${version} berhasil diterapkan.`);
			} catch (error) {
				await client.query('rollback');
				throw error;
			}
		}
	} catch (error) {
		throw error;
	} finally {
		client.release();
	}
} catch (error) {
	const safeError = error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[redacted]') : 'Unknown database error';
	console.error(`Gagal menerapkan migration: ${safeError}`);
	process.exitCode = 1;
} finally {
	await pool.end();
}

