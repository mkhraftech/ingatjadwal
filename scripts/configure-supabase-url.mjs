import { appendFile, readFile } from 'node:fs/promises';
import { parse } from 'pg-connection-string';

function encodeUserInfo(value) {
	let encoded = '';
	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (character === '%' && /^[\da-f]{2}$/i.test(value.slice(index + 1, index + 3))) {
			encoded += value.slice(index, index + 3).toUpperCase();
			index += 2;
		} else if (/^[a-z\d._~-]$/i.test(character)) encoded += character;
		else encoded += encodeURIComponent(character);
	}
	return encoded;
}

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error('DATABASE_URL is missing.');
const match = raw.match(/^(postgres(?:ql)?:\/\/)([^@]+)@(.+)$/i);
if (!match) throw new Error('DATABASE_URL is not a PostgreSQL URL.');
const separator = match[2].indexOf(':');
if (separator < 1) throw new Error('DATABASE_URL must include username and password.');
const connectionString = `${match[1]}${encodeUserInfo(match[2].slice(0, separator))}:${encodeUserInfo(match[2].slice(separator + 1))}@${match[3]}`;
const connection = parse(connectionString);
let projectRef = connection.host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)?.[1];
if (!projectRef && /\.pooler\.supabase\.com$/i.test(connection.host)) {
	projectRef = connection.user.match(/^postgres\.([a-z0-9]+)$/i)?.[1];
}
if (!projectRef) {
	console.log('Project URL tidak dapat diturunkan dari host DATABASE_URL ini.');
	process.exit(0);
}

const envPath = '.env';
const existing = await readFile(envPath, 'utf8');
if (/^\s*PUBLIC_SUPABASE_URL=/m.test(existing)) {
	console.log('PUBLIC_SUPABASE_URL sudah ada; tidak diubah.');
	process.exit(0);
}
const projectUrl = `https://${projectRef}.supabase.co`;
await appendFile(envPath, `${existing.endsWith('\n') ? '' : '\n'}PUBLIC_SUPABASE_URL=${projectUrl}\n`, 'utf8');
console.log('PUBLIC_SUPABASE_URL ditambahkan ke .env dari host DATABASE_URL.');

