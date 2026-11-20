import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.ssrSupabase) return { configured: false };
	const { user } = await locals.safeGetSession();
	if (user) redirect(303, '/setup');
	return { configured: true };
};

export const actions: Actions = {
	login: async ({ request, locals }) => {
		if (!locals.ssrSupabase) return fail(503, { error: 'Supabase belum dikonfigurasi. Isi URL dan publishable key di file .env.' });
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		if (!email || password.length < 8) return fail(400, { error: 'Masukkan email dan kata sandi minimal 8 karakter.' });
		const { error } = await locals.ssrSupabase.auth.signInWithPassword({ email, password });
		if (error) return fail(400, { error: 'Email atau kata sandi tidak cocok.' });
		redirect(303, '/setup');
	}
};

