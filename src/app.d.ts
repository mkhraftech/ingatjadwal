import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient | null;
			ssrSupabase: SupabaseClient | null;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
		}
	}
}

export {};

