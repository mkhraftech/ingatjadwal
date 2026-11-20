<script lang="ts">
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Siapkan unit — IngatJadwal</title></svelte:head>
<main class="auth-page">
	<a class="auth-brand" href="/"><span class="brand-mark">ij<span>.</span></span><span>ingatjadwal</span></a>
	<section class="auth-card">
		<p class="eyebrow">LANGKAH PERTAMA</p>
		<h1>Siapkan unit Anda</h1>
		<p class="auth-copy">Akun {data.email} belum terhubung dengan fasilitas. Buat workspace untuk unit terapi Anda.</p>
		{#if form?.error}<div class="flash error">{form.error}</div>{/if}
		<form method="POST" class="auth-form">
			<label>Nama unit / fasilitas<input name="facility_name" placeholder="Contoh: Unit Rehabilitasi" required minlength="2" maxlength="120" /></label>
			<button class="button primary auth-submit" type="submit">Buat unit</button>
		</form>
	</section>
	<p class="auth-footer">Hanya gunakan data sintetis selama tahap pengembangan.</p>
</main>

