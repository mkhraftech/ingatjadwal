import type { SupabaseClient } from '@supabase/supabase-js';

export async function getFacility(supabase: SupabaseClient) {
	const { data: membership, error } = await supabase
		.from('facility_memberships')
		.select('role, facility:facilities!inner(id, uid, name, timezone, contact_phone, deleted_at)')
		.eq('active', true)
		.is('deleted_at', null)
		.is('facility.deleted_at', null)
		.order('created_at')
		.limit(1)
		.maybeSingle();
	if (error) throw new Error(error.message);
	if (!membership) return null;
	const facility = Array.isArray(membership.facility) ? membership.facility[0] : membership.facility;
	if (!facility) return null;
	return { ...facility, role: membership.role };
}

export async function dashboardData(supabase: SupabaseClient, facilityId: string) {
	const [patientsResult, appointmentsResult, remindersResult] = await Promise.all([
		supabase.from('patients').select('uid', { count: 'exact', head: true }).eq('facility_id', facilityId).eq('active', true).is('deleted_at', null),
		supabase
			.from('appointments')
			.select('uid, starts_at, duration_minutes, location, service_label, status, patient:patients!inner(uid,display_name,phone_e164)')
			.eq('facility_id', facilityId)
			.in('status', ['scheduled', 'confirmed'])
			.is('deleted_at', null)
			.is('patient.deleted_at', null)
			.gte('starts_at', new Date(Date.now() - 86_400_000).toISOString())
			.order('starts_at')
			.limit(100),
    supabase.from('reminder_tasks').select('uid, appointment_id, stage, due_at, status, appointments!inner(uid)').eq('facility_id', facilityId).is('deleted_at', null).neq('status', 'cancelled').gte('due_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
	]);
	if (patientsResult.error) throw new Error(patientsResult.error.message);
	if (appointmentsResult.error) throw new Error(appointmentsResult.error.message);
	if (remindersResult.error) throw new Error(remindersResult.error.message);
	return {
		patientCount: patientsResult.count ?? 0,
		appointments: appointmentsResult.data ?? [],
		reminders: remindersResult.data ?? []
	};
}

export async function calendarAppointments(supabase: SupabaseClient, facilityId: string, monthStart: string, monthEnd: string) {
	const { data, error } = await supabase
		.from('appointments')
		.select('uid, starts_at, duration_minutes, location, service_label, status, patient:patients!inner(uid,display_name,phone_e164)')
		.eq('facility_id', facilityId)
		.in('status', ['scheduled', 'confirmed'])
		.is('deleted_at', null)
		.is('patient.deleted_at', null)
		.gte('starts_at', monthStart)
		.lt('starts_at', monthEnd)
		.order('starts_at');
	if (error) throw new Error(error.message);
	return data ?? [];
}

export async function scheduleAppointments(supabase: SupabaseClient, facilityId: string) {
	const { data, error } = await supabase
		.from('appointments')
		.select('uid, starts_at, duration_minutes, location, service_label, status, patient:patients!inner(uid,display_name,phone_e164)')
		.eq('facility_id', facilityId)
		.in('status', ['scheduled', 'confirmed'])
		.is('deleted_at', null)
		.is('patient.deleted_at', null)
		.gte('starts_at', new Date(Date.now() - 86_400_000).toISOString())
		.order('starts_at')
		.limit(100);
	if (error) throw new Error(error.message);
	return data ?? [];
}

export async function patientList(supabase: SupabaseClient, facilityId: string) {
	const { data, error } = await supabase
		.from('patients')
		.select('uid, display_name, phone_e164, medical_record_ref, appointments(count)')
		.eq('facility_id', facilityId)
		.eq('active', true)
		.is('deleted_at', null)
		.is('appointments.deleted_at', null)
		.order('display_name');
	if (error) throw new Error(error.message);
	return data ?? [];
}

export async function patientOptions(supabase: SupabaseClient, facilityId: string) {
	const { data, error } = await supabase
		.from('patients')
		.select('uid, display_name, phone_e164')
		.eq('facility_id', facilityId)
		.eq('active', true)
		.is('deleted_at', null)
		.order('display_name');
	if (error) throw new Error(error.message);
	return data ?? [];
}

export async function facilitySettingsData(supabase: SupabaseClient, facilityId: string) {
	const [templatesResult, locationsResult, scheduleSlotsResult] = await Promise.all([
		supabase.from('message_templates').select('stage, body, active').eq('facility_id', facilityId).is('deleted_at', null).order('stage'),
		supabase.from('facility_locations').select('uid, name').eq('facility_id', facilityId).eq('active', true).is('deleted_at', null).order('name'),
		supabase.from('facility_schedule_slots').select('uid, weekday, slot_time').eq('facility_id', facilityId).is('deleted_at', null).order('weekday').order('slot_time')
	]);
	if (templatesResult.error) throw new Error(templatesResult.error.message);
	if (locationsResult.error) throw new Error(locationsResult.error.message);
	if (scheduleSlotsResult.error) throw new Error(scheduleSlotsResult.error.message);
	return { templates: templatesResult.data ?? [], locations: locationsResult.data ?? [], scheduleSlots: scheduleSlotsResult.data ?? [] };
}

export async function addScheduleSlot(supabase: SupabaseClient, facilityId: string, userId: string, form: FormData) {
	const weekday = Number(form.get('weekday'));
	const slotTime = String(form.get('slot_time') ?? '');
	if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slotTime)) {
		throw new Error('Pilih hari dan jam slot yang valid.');
	}
	const { error } = await supabase.from('facility_schedule_slots').insert({
		facility_id: facilityId,
		weekday,
		slot_time: `${slotTime}:00`,
		created_by: userId,
		updated_by: userId
	});
	if (error?.code === '23505') throw new Error('Slot pada hari dan jam tersebut sudah terdaftar.');
	if (error) throw new Error(error.message);
}

export async function softDeleteScheduleSlot(supabase: SupabaseClient, facilityId: string, userId: string, form: FormData) {
	const uid = String(form.get('schedule_slot_uid') ?? '');
	if (!uid) throw new Error('Slot jadwal tidak valid.');
	const deletedAt = new Date().toISOString();
	const { data, error } = await supabase
		.from('facility_schedule_slots')
		.update({ deleted_at: deletedAt, deleted_by: userId, updated_by: userId, updated_at: deletedAt })
		.eq('uid', uid)
		.eq('facility_id', facilityId)
		.is('deleted_at', null)
		.select('uid')
		.maybeSingle();
	if (error) throw new Error(error.message);
	if (!data) throw new Error('Slot jadwal tidak ditemukan.');
}

export async function savePatient(supabase: SupabaseClient, facilityId: string, form: FormData) {
	const name = String(form.get('name') ?? '').trim();
	let phone = String(form.get('phone') ?? '').replace(/\D/g, '');
	const mrn = String(form.get('medical_record_ref') ?? '').trim();
	if (phone.startsWith('0')) phone = `62${phone.slice(1)}`;
	if (name.length < 2 || name.length > 120 || phone.length < 8 || phone.length > 15) throw new Error('Isi nama dan nomor WhatsApp yang valid.');
	const { error } = await supabase.from('patients').insert({ facility_id: facilityId, display_name: name, phone_e164: phone, medical_record_ref: mrn || null });
	if (error) throw new Error(error.message);
}

export async function saveAppointment(supabase: SupabaseClient, facilityId: string, userId: string, form: FormData) {
	const patientUid = String(form.get('patient_uid') ?? '');
	const date = String(form.get('date') ?? '');
	const time = String(form.get('time') ?? '');
	const duration = Number(form.get('duration'));
	const locationUid = String(form.get('location_uid') ?? '');
	const location = String(form.get('location') ?? 'Unit Rehabilitasi').trim();
	if (!patientUid || !locationUid || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !Number.isInteger(duration) || duration < 15 || duration > 240) throw new Error('Periksa pasien, lokasi, tanggal, waktu, dan durasi sesi.');
	const { data: patient, error: patientError } = await supabase.from('patients').select('id').eq('uid', patientUid).eq('facility_id', facilityId).eq('active', true).is('deleted_at', null).single();
	if (patientError || !patient) throw new Error('Pasien tidak ditemukan pada fasilitas ini.');
	const { data: selectedLocation, error: locationError } = await supabase.from('facility_locations').select('id, name').eq('uid', locationUid).eq('facility_id', facilityId).eq('active', true).is('deleted_at', null).single();
	if (locationError || !selectedLocation) throw new Error('Lokasi tidak ditemukan atau sudah dinonaktifkan.');
	const startsAt = new Date(`${date}T${time}:00+07:00`).toISOString();
	const { error } = await supabase.from('appointments').insert({ facility_id: facilityId, patient_id: patient.id, location_id: selectedLocation.id, starts_at: startsAt, duration_minutes: duration, location: selectedLocation.name, created_by: userId, updated_by: userId });
	if (error) throw new Error(error.message);
}

export async function saveMessageTemplate(supabase: SupabaseClient, facilityId: string, userId: string, form: FormData) {
	const stage = String(form.get('stage') ?? '');
	const body = String(form.get('body') ?? '').trim();
	if (!['h2', 'h1', 'day_of'].includes(stage) || body.length < 1 || body.length > 2000) throw new Error('Pilih tahap reminder dan isi template maksimal 2.000 karakter.');
	const now = new Date().toISOString();
	const { error } = await supabase.from('message_templates').upsert({ facility_id: facilityId, stage, body, active: true, deleted_at: null, deleted_by: null, updated_by: userId, updated_at: now }, { onConflict: 'facility_id,stage' });
	if (error) throw new Error(error.message);
}

export async function addFacilityLocation(supabase: SupabaseClient, facilityId: string, userId: string, form: FormData) {
	const name = String(form.get('name') ?? '').trim();
	if (name.length < 2 || name.length > 100) throw new Error('Nama lokasi harus terdiri dari 2–100 karakter.');
	const { error } = await supabase.from('facility_locations').insert({ facility_id: facilityId, name, created_by: userId, updated_by: userId });
	if (error?.code === '23505') throw new Error('Nama lokasi tersebut sudah tersedia.');
	if (error) throw new Error(error.message);
}

export async function softDeleteFacilityLocation(supabase: SupabaseClient, facilityId: string, userId: string, form: FormData) {
	const uid = String(form.get('location_uid') ?? '');
	if (!uid) throw new Error('Lokasi tidak valid.');
	const now = new Date().toISOString();
	const { data, error } = await supabase.from('facility_locations').update({ active: false, deleted_at: now, deleted_by: userId, updated_by: userId, updated_at: now }).eq('uid', uid).eq('facility_id', facilityId).is('deleted_at', null).select('uid').maybeSingle();
	if (error) throw new Error(error.message);
	if (!data) throw new Error('Lokasi tidak ditemukan.');
}

export async function deleteAppointment(supabase: SupabaseClient, facilityId: string, userId: string, form: FormData) {
	const uid = String(form.get('appointment_uid') ?? '');
	if (!uid) throw new Error('Jadwal tidak valid.');
	const { data: appointment, error: findError } = await supabase
		.from('appointments')
		.select('id')
		.eq('uid', uid)
		.eq('facility_id', facilityId)
		.is('deleted_at', null)
		.single();
	if (findError || !appointment) throw new Error('Jadwal tidak ditemukan.');
	const deletedAt = new Date().toISOString();
	const { error } = await supabase.from('appointments').update({ status: 'cancelled', deleted_at: deletedAt, deleted_by: userId, updated_by: userId, updated_at: deletedAt }).eq('id', appointment.id).eq('facility_id', facilityId);
	if (error) throw new Error(error.message);
}

export async function recordReminder(supabase: SupabaseClient, facilityId: string, userId: string, form: FormData) {
	const reminderUid = String(form.get('reminder_uid') ?? '');
	const status = String(form.get('status') ?? 'sent');
	if (!['opened_whatsapp', 'sent', 'confirmed', 'follow_up'].includes(status)) throw new Error('Status tindak lanjut tidak valid.');
	const { data: task, error: findError } = await supabase.from('reminder_tasks').select('id, appointment_id, status').eq('uid', reminderUid).eq('facility_id', facilityId).is('deleted_at', null).single();
	if (findError || !task) throw new Error('Tugas reminder tidak ditemukan.');
	const { error } = await supabase.from('reminder_tasks').update({ status, handled_by: userId, handled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', task.id).eq('facility_id', facilityId);
	if (error) throw new Error(error.message);
	const { data: appointment } = await supabase.from('appointments').select('uid').eq('id', task.appointment_id).is('deleted_at', null).single();
	await supabase.from('audit_events').insert({ facility_id: facilityId, actor_id: userId, entity_type: 'reminder_task', entity_id: reminderUid, action: `reminder_${status}`, before_state: { status: task.status }, after_state: { status, appointment_uid: appointment?.uid } });
}


