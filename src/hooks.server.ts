import { createServerClient } from '@supabase/ssr';
import { createContextClient, verifyCredentials } from '@supabase/server/core';
import type { SupabaseEnv } from '@supabase/server';
import type { Handle } from '@sveltejs/kit/hooks';

const url = process.env.PUBLIC_SUPABASE_URL;
const publishableKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseEnv: Partial<SupabaseEnv> = {
	url: url || undefined,
	publishableKeys: publishableKey ? { default: publishableKey } : {},
	...(process.env.SUPABASE_JWKS ? { jwks: JSON.parse(process.env.SUPABASE_JWKS) } : {})
};

export const handle: Handle = async ({ event, resolve }) => {
	if (!url || !publishableKey) {
		event.locals.supabase = null;
		event.locals.ssrSupabase = null;
		event.locals.safeGetSession = async () => ({ session: null, user: null });
		return resolve(event);
	}

	const ssrSupabase = createServerClient(url, publishableKey, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => event.cookies.set(name, value, { ...options, path: '/' }));
			}
		}
	});
	event.locals.ssrSupabase = ssrSupabase;
	event.locals.supabase = createContextClient({ env: supabaseEnv });

	event.locals.safeGetSession = async () => {
		const { data: { session } } = await ssrSupabase.auth.getSession();
		const { data: { user }, error } = await ssrSupabase.auth.getUser();
		if (error || !session || !user) return { session: null, user: null };
		const { data: auth, error: authError } = await verifyCredentials(
			{ token: session.access_token, apikey: null },
			{ auth: 'user', env: supabaseEnv }
		);
		if (authError || !auth) return { session: null, user: null };
		event.locals.supabase = createContextClient({ auth: { token: auth.token }, env: supabaseEnv });
		return { session, user };
	};
	return resolve(event);
};

