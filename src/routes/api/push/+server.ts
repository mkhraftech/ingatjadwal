import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFacility } from '#lib/server/db';
import { sendPush, validPushEndpoint } from '#lib/server/web-push.js';

const unavailable = () => json({ error: 'Notifikasi perangkat belum dikonfigurasi.' }, { status: 503 });

export const GET: RequestHandler = () => {
	const key = process.env.PUBLIC_VAPID_KEY;
	return key && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT
		? json({ key })
		: unavailable();
};

export const POST: RequestHandler = async ({ request, url, locals }) => {
	if (request.headers.get('origin') !== url.origin) return json({ error: 'Asal permintaan tidak valid.' }, { status: 403 });
	const { user } = await locals.safeGetSession();
	const db = locals.supabase;
	if (!user || !db) return json({ error: 'Silakan masuk kembali.' }, { status: 401 });
	const facility = await getFacility(db);
	if (!facility) return json({ error: 'Unit tidak ditemukan.' }, { status: 403 });
	const input = await request.json().catch(() => null);
	if (!input || !validPushEndpoint(input.endpoint)) return json({ error: 'Layanan push browser ini tidak didukung.' }, { status: 400 });
	const { endpoint, action } = input;
	if (action === 'disable') {
		const { error } = await db.from('push_devices').delete().eq('endpoint', endpoint).eq('user_id', user.id);
		return error ? json({ error: 'Notifikasi gagal dinonaktifkan.' }, { status: 500 }) : json({ ok: true });
	}
	if (!process.env.PUBLIC_VAPID_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return unavailable();
	if (action === 'enable') {
		const { p256dh, auth } = input.keys ?? {};
		if (typeof p256dh !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(p256dh) || typeof auth !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(auth)) {
			return json({ error: 'Kunci perangkat tidak valid.' }, { status: 400 });
		}
		const { error } = await db.from('push_devices').upsert({
			endpoint, user_id: user.id, facility_id: facility.id, p256dh, auth_key: auth
		}, { onConflict: 'endpoint' });
		return error ? json({ error: 'Perangkat gagal didaftarkan.' }, { status: 400 }) : json({ ok: true });
	}
	if (action === 'status') {
		const { data, error } = await db.from('push_devices').select('id').eq('endpoint', endpoint)
			.eq('user_id', user.id).eq('facility_id', facility.id).maybeSingle();
		return error ? json({ error: 'Status notifikasi gagal dimuat.' }, { status: 500 }) : json({ enabled: Boolean(data) });
	}
	if (action !== 'test') return json({ error: 'Aksi tidak valid.' }, { status: 400 });
	const { data, error } = await db.from('push_devices').update({ last_test_at: new Date().toISOString() })
		.eq('endpoint', endpoint).eq('user_id', user.id).eq('facility_id', facility.id)
		.or('last_test_at.is.null,last_test_at.lt.' + new Date(Date.now() - 30_000).toISOString())
		.select('endpoint, p256dh, auth_key').maybeSingle();
	if (error || !data) return json({ error: 'Aktifkan notifikasi atau tunggu 30 detik sebelum tes ulang.' }, { status: 429 });
	try {
		await sendPush(data, 'Notifikasi perangkat IngatJadwal sudah aktif.', true);
		return json({ ok: true });
	} catch (error) {
		const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : null;
		if (status === 404 || status === 410) {
			return json({ error: 'Langganan perangkat sudah kedaluwarsa. Nonaktifkan lalu aktifkan kembali.' }, { status: 410 });
		}
		if (status === 401 || status === 403) {
			return json({ error: 'Layanan push menolak autentikasi. Periksa pasangan kunci VAPID dan aktifkan ulang jika kuncinya berubah.' }, { status: 502 });
		}
		console.error('Gagal mengirim notifikasi tes. Status layanan push:', typeof status === 'number' ? status : 'tidak tersedia');
		return json({ error: 'Notifikasi tes gagal dikirim. Periksa log server.' }, { status: 502 });
	}
};
