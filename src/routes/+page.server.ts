import { fail, redirect } from '@sveltejs/kit';
import { addFacilityLocation, calendarAppointments, dashboardData, deleteAppointment, facilitySettingsData, getFacility, patientList, patientOptions, recordReminder, saveAppointment, saveMessageTemplate, savePatient, scheduleAppointments, softDeleteFacilityLocation } from '#lib/server/db';
import type { Actions, PageServerLoad } from './$types';

function isoDateInJakarta(date: Date) {
	const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${values.year}-${values.month}-${values.day}`;
}

function monthBounds(value: string | null) {
	const current = isoDateInJakarta(new Date()).slice(0, 7);
	const month = value && /^\d{4}-\d{2}$/.test(value) && Number(value.slice(5)) >= 1 && Number(value.slice(5)) <= 12 ? value : current;
	const [year, number] = month.split('-').map(Number);
	return { month, start: `${month}-01T00:00:00+07:00`, end: `${number === 12 ? year + 1 : year}-${String(number === 12 ? 1 : number + 1).padStart(2, '0')}-01T00:00:00+07:00` };
}

function shiftMonth(month: string, amount: number) {
	const [year, number] = month.split('-').map(Number);
	const date = new Date(Date.UTC(year, number - 1 + amount, 1));
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

const defaultTemplates = [
	{ stage: 'h2', body: 'Selamat pagi, {{nama_pasien}}. Kami mengingatkan jadwal terapi Anda pada {{tanggal}} pukul {{jam}} di {{lokasi}}. Mohon membalas untuk mengonfirmasi kehadiran. Terima kasih.' },
	{ stage: 'h1', body: 'Selamat pagi, {{nama_pasien}}. Kami mengingatkan jadwal terapi Anda besok, {{tanggal}} pukul {{jam}} di {{lokasi}}. Mohon membalas untuk mengonfirmasi kehadiran. Terima kasih.' },
	{ stage: 'day_of', body: 'Selamat pagi, {{nama_pasien}}. Kami mengingatkan jadwal terapi Anda hari ini, {{tanggal}} pukul {{jam}} di {{lokasi}}. Mohon membalas untuk mengonfirmasi kehadiran. Terima kasih.' }
];

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.ssrSupabase) redirect(303, '/login?config=missing');
	const { user } = await locals.safeGetSession();
	if (!user || !locals.supabase) redirect(303, '/login');
	const facility = await getFacility(locals.supabase);
	if (!facility) redirect(303, '/setup');
	const requestedView = url.searchParams.get('view') ?? 'dashboard';
	const view = requestedView === 'kalender' ? 'jadwal' : requestedView;
	if (view === 'pengaturan' && !['owner', 'admin'].includes(facility.role)) redirect(303, '/');
	const scheduleView = requestedView === 'kalender' || url.searchParams.get('mode') === 'calendar' ? 'calendar' : 'table';
	const calendarMonth = monthBounds(url.searchParams.get('month'));
	const needsDashboard = view === 'dashboard' || view === 'pengingat';
	const needsSettings = view === 'pengaturan' || view === 'jadwal';
	const [dashboard, patients, calendarRows, scheduleRows, settings] = await Promise.all([
		needsDashboard ? dashboardData(locals.supabase, facility.id) : Promise.resolve(null),
		view === 'pasien' ? patientList(locals.supabase, facility.id) : view === 'jadwal' ? patientOptions(locals.supabase, facility.id) : Promise.resolve([]),
		view === 'jadwal' && scheduleView === 'calendar' ? calendarAppointments(locals.supabase, facility.id, calendarMonth.start, calendarMonth.end) : Promise.resolve([]),
		view === 'jadwal' && scheduleView === 'table' ? scheduleAppointments(locals.supabase, facility.id) : Promise.resolve([]),
		needsSettings ? facilitySettingsData(locals.supabase, facility.id) : Promise.resolve({ templates: [], locations: [] })
	]);
	const today = isoDateInJakarta(new Date());
	const appointments = dashboard?.appointments ?? scheduleRows;
	const reminders = dashboard?.reminders ?? [];
	const upcoming = appointments.map((appointment: any) => {
		const patient = Array.isArray(appointment.patient) ? appointment.patient[0] : appointment.patient;
		const sessionDate = isoDateInJakarta(new Date(appointment.starts_at));
		const dayDifference = (Date.parse(sessionDate) - Date.parse(today)) / 86_400_000;
		const expectedStage = dayDifference === 0 ? 'today' : dayDifference === 1 ? 'h1' : dayDifference === 2 ? 'h2' : null;
		const task = reminders.find((reminder: any) => {
			const relatedAppointment = Array.isArray(reminder.appointments) ? reminder.appointments[0] : reminder.appointments;
			const reminderStage = reminder.stage === 'day_of' ? 'today' : reminder.stage;
			return relatedAppointment?.uid === appointment.uid && reminderStage === expectedStage;
		});
		const stage = task && new Date(task.due_at).getTime() <= Date.now() ? expectedStage : null;
		return {
			uid: appointment.uid,
			name: patient?.display_name ?? 'Pasien',
			phone: patient?.phone_e164 ?? '',
			starts_at: appointment.starts_at,
			duration_minutes: appointment.duration_minutes,
			location: appointment.location,
			service_label: appointment.service_label,
			status: appointment.status,
			stage,
			reminder_uid: stage ? task?.uid ?? '' : '',
			reminder_status: stage ? task?.status ?? null : null
		};
	});
	return {
		view,
		scheduleView,
		calendarMonth: calendarMonth.month,
		previousMonth: shiftMonth(calendarMonth.month, -1),
		nextMonth: shiftMonth(calendarMonth.month, 1),
		calendarAppointments: calendarRows.map((appointment: any) => {
			const patient = Array.isArray(appointment.patient) ? appointment.patient[0] : appointment.patient;
			return { uid: appointment.uid, patient_uid: patient?.uid ?? '', name: patient?.display_name ?? 'Pasien', phone: patient?.phone_e164 ?? '', starts_at: appointment.starts_at, duration_minutes: appointment.duration_minutes, location: appointment.location, service_label: appointment.service_label, status: appointment.status };
		}),
		facility,
		patientCount: dashboard?.patientCount ?? 0,
		upcoming,
		actions: upcoming.filter((item) => item.reminder_uid && ['sent', 'confirmed', 'follow_up'].includes(item.reminder_status ?? '')).map((item) => ({
			appointment_uid: item.uid,
			stage: item.stage,
			outcome: item.reminder_status,
			reminder_uid: item.reminder_uid
		})),
		patients: patients.map((patient: any) => ({
			uid: patient.uid,
			name: patient.display_name,
			phone: patient.phone_e164,
			medical_record_ref: patient.medical_record_ref,
			sessions: patient.appointments?.[0]?.count ?? 0
		})),
		locations: settings.locations,
		templates: defaultTemplates.map((template) => ({ ...template, ...(settings.templates.find((saved: any) => saved.stage === template.stage) ?? {}) }))
	};
};

export const actions: Actions = {
	logout: async ({ locals }) => {
		await locals.ssrSupabase?.auth.signOut();
		redirect(303, '/login');
	},
	patient: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user || !locals.supabase) redirect(303, '/login');
		const facility = await getFacility(locals.supabase);
		if (!facility) redirect(303, '/setup');
		try { await savePatient(locals.supabase, facility.id, await request.formData()); return { success: 'Pasien ditambahkan.' }; }
		catch (error) { return fail(400, { error: error instanceof Error ? error.message : 'Pasien belum dapat disimpan.' }); }
	},
	appointment: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user || !locals.supabase) redirect(303, '/login');
		const facility = await getFacility(locals.supabase);
		if (!facility) redirect(303, '/setup');
		try { await saveAppointment(locals.supabase, facility.id, user.id, await request.formData()); return { success: 'Jadwal sesi berhasil dibuat.' }; }
		catch (error) { return fail(400, { error: error instanceof Error ? error.message : 'Jadwal belum dapat disimpan.' }); }
	},
	deleteAppointment: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user || !locals.supabase) redirect(303, '/login');
		const facility = await getFacility(locals.supabase);
		if (!facility) redirect(303, '/setup');
		try { await deleteAppointment(locals.supabase, facility.id, user.id, await request.formData()); return { success: 'Jadwal berhasil dihapus.' }; }
		catch (error) { return fail(400, { error: error instanceof Error ? error.message : 'Jadwal belum dapat dihapus.' }); }
	},
	template: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user || !locals.supabase) redirect(303, '/login');
		const facility = await getFacility(locals.supabase);
		if (!facility) redirect(303, '/setup');
		if (!['owner', 'admin'].includes(facility.role)) return fail(403, { error: 'Hanya pemilik atau admin yang dapat mengubah pengaturan.' });
		try { await saveMessageTemplate(locals.supabase, facility.id, user.id, await request.formData()); return { success: 'Template pesan berhasil disimpan.' }; }
		catch (error) { return fail(400, { error: error instanceof Error ? error.message : 'Template belum dapat disimpan.' }); }
	},
	location: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user || !locals.supabase) redirect(303, '/login');
		const facility = await getFacility(locals.supabase);
		if (!facility) redirect(303, '/setup');
		if (!['owner', 'admin'].includes(facility.role)) return fail(403, { error: 'Hanya pemilik atau admin yang dapat mengubah pengaturan.' });
		try { await addFacilityLocation(locals.supabase, facility.id, user.id, await request.formData()); return { success: 'Lokasi berhasil ditambahkan.' }; }
		catch (error) { return fail(400, { error: error instanceof Error ? error.message : 'Lokasi belum dapat ditambahkan.' }); }
	},
	deleteLocation: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user || !locals.supabase) redirect(303, '/login');
		const facility = await getFacility(locals.supabase);
		if (!facility) redirect(303, '/setup');
		if (!['owner', 'admin'].includes(facility.role)) return fail(403, { error: 'Hanya pemilik atau admin yang dapat mengubah pengaturan.' });
		try { await softDeleteFacilityLocation(locals.supabase, facility.id, user.id, await request.formData()); return { success: 'Lokasi berhasil dinonaktifkan.' }; }
		catch (error) { return fail(400, { error: error instanceof Error ? error.message : 'Lokasi belum dapat dinonaktifkan.' }); }
	},
	reminder: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user || !locals.supabase) redirect(303, '/login');
		const facility = await getFacility(locals.supabase);
		if (!facility) redirect(303, '/setup');
		try { await recordReminder(locals.supabase, facility.id, user.id, await request.formData()); return { success: 'Tindak lanjut berhasil dicatat.' }; }
		catch (error) { return fail(400, { error: error instanceof Error ? error.message : 'Tindak lanjut belum dapat disimpan.' }); }
	}
};

