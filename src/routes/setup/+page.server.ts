import { fail, redirect } from '@sveltejs/kit';
import { getFacility } from '#lib/server/db';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.supabase) redirect(303, '/login');
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	const facility = await getFacility(locals.supabase);
	if (facility) redirect(303, '/?view=dashboard');
	return { email: user.email ?? '' };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user || !locals.supabase) redirect(303, '/login');
		const form = await request.formData();
		const name = String(form.get('facility_name') ?? '').trim();
		if (name.length < 2 || name.length > 120) return fail(400, { error: 'Nama unit harus berisi 2–120 karakter.' });
		const { error } = await locals.supabase.rpc('create_initial_facility', { facility_name: name });
		if (error) return fail(400, { error: error.message });
		redirect(303, '/?view=dashboard');
	}
};

