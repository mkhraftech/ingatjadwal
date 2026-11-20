import pg from 'pg';
import { sendPush } from '../src/lib/server/web-push.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString || !process.env.PUBLIC_VAPID_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
	console.error('Konfigurasi DATABASE_URL atau VAPID belum lengkap.');
	process.exit(1);
}

const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 8000 });
let client;
try {
	client = await pool.connect();
	await client.query('begin');
	const { rows: [lock] } = await client.query('select pg_try_advisory_xact_lock(79180367) as acquired');
	if (lock.acquired) {
		const { rows: devices } = await client.query(`
			with clock as (select now() at time zone 'Asia/Jakarta' as local_now)
			select d.id, d.endpoint, d.p256dh, d.auth_key,
				jsonb_agg(jsonb_build_object('id', r.id, 'due_at', r.due_at)) as reminders
			from public.push_devices d
			join public.facility_memberships m on m.facility_id = d.facility_id and m.user_id = d.user_id
			join public.facilities f on f.id = d.facility_id
			join public.reminder_tasks r on r.facility_id = d.facility_id
			join public.appointments a on a.id = r.appointment_id and a.facility_id = d.facility_id
			join public.patients p on p.id = a.patient_id and p.facility_id = d.facility_id
			cross join clock
			where m.active and m.deleted_at is null and f.deleted_at is null
				and r.deleted_at is null and r.status in ('pending', 'opened_whatsapp')
				and a.deleted_at is null and a.status in ('scheduled', 'confirmed')
				and p.deleted_at is null
				and a.starts_at >= now()
				and (a.starts_at at time zone 'Asia/Jakarta')::date = clock.local_now::date +
					case r.stage when 'day_of' then 0 when 'h1' then 1 when 'h2' then 2 end
				and case when r.stage = 'day_of' then clock.local_now::time >= time '07:00'
					else r.due_at <= now() end
				and not exists (
					select from public.push_deliveries sent
					where sent.device_id = d.id and sent.reminder_id = r.id and sent.due_at = r.due_at
				)
			group by d.id
		`);
		for (const device of devices) {
			try {
				await sendPush(device, `${device.reminders.length} pengingat jadwal perlu ditangani.`);
			} catch (error) {
				if ([404, 410].includes(error?.statusCode)) {
					await client.query('delete from public.push_devices where id = $1', [device.id]);
				} else {
					console.error('Pengiriman push gagal untuk satu perangkat.');
					process.exitCode = 1;
				}
				continue;
			}
			await client.query(`
				insert into public.push_deliveries (device_id, reminder_id, due_at)
				select $1, id, due_at from jsonb_to_recordset($2::jsonb) as r(id uuid, due_at timestamptz)
				on conflict do nothing
			`, [device.id, JSON.stringify(device.reminders)]);
		}
	}
	await client.query('commit');
} catch (error) {
	if (client) await client.query('rollback').catch(() => {});
	console.error('Proses pengingat push gagal:', error?.code ?? 'unknown');
	process.exitCode = 1;
} finally {
	client?.release();
	await pool.end();
}
