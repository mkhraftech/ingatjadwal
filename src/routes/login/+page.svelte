<script lang="ts">
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Masuk — IngatJadwal</title></svelte:head>
<main class="auth-page">
	<a class="auth-brand" href="/"><span class="brand-mark">ij<span>.</span></span><span>ingatjadwal</span></a>
	<section class="auth-card">
		<p class="eyebrow">JADWAL TERAPI TERATUR</p>
		<h1>Selamat datang kembali</h1>
		<p class="auth-copy">Masuk untuk mengelola jadwal dan tindak lanjut pasien.</p>
		{#if !data.configured}<div class="flash error">Supabase belum dikonfigurasi. Jalankan Supabase lokal atau isi <code>.env</code> dari project IngatJadwal Anda.</div>{/if}
		{#if form?.error}<div class="flash error">{form.error}</div>{/if}
		<form method="POST" action="?/login" class="auth-form">
			<label>Email<input name="email" type="email" autocomplete="email" placeholder="nama@klinik.id" required /></label>
			<label>Kata sandi<input name="password" type="password" autocomplete="current-password" minlength="8" placeholder="Masukkan kata sandi" required /></label>
			<button class="button primary auth-submit" type="submit" disabled={!data.configured}>Masuk</button>
		</form>
	</section>
	<p class="auth-footer">IngatJadwal · Sistem internal untuk pengelolaan jadwal</p>
</main>

