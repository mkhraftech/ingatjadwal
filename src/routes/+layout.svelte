<script lang="ts">
	import './layout.css';
	import type { LayoutProps } from './$types';
	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>IngatJadwal — Jadwal dan tindak lanjut</title>
	<meta name="description" content="Demo lokal pengelolaan jadwal terapi dan pengingat pasien." />
</svelte:head>

{@render children()}
