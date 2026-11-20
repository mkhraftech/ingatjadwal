<script lang="ts">
	import { onMount } from 'svelte';

	let registration: ServiceWorkerRegistration | undefined;
	let key = '';
	let subscription: PushSubscription | null = null;
	let enabled = $state(false);
	let ready = $state(false);
	let busy = $state(false);
	let message = $state('');

	async function request(action: string, device: PushSubscription) {
		const response = await fetch('/api/push', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action, ...device.toJSON() })
		});
		const result = await response.json();
		if (!response.ok) throw new Error(result.error);
		return result;
	}

	onMount(() => {
		void initialize();
	});

	async function initialize() {
		if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
			message = 'Notifikasi perangkat tidak tersedia di sini. Di iPhone atau iPad, buka IngatJadwal dari Home Screen.';
			return;
		}
		try {
			const response = await fetch('/api/push');
			const config = await response.json();
			if (!response.ok) throw new Error(config.error);
			key = config.key;
			await navigator.serviceWorker.register('/push-worker.js');
			registration = await navigator.serviceWorker.ready;
			subscription = await registration.pushManager.getSubscription();
			if (subscription) enabled = (await request('status', subscription)).enabled;
			ready = true;
		} catch (error) {
			message = error instanceof Error ? error.message : 'Notifikasi perangkat gagal dimuat.';
		}
	}

	async function change(action: 'enable' | 'disable' | 'test') {
		if (!registration || busy) return;
		busy = true;
		message = '';
		try {
			if (action === 'enable') {
				if (Notification.permission === 'denied') throw new Error('Izinkan notifikasi di pengaturan browser.');
				subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
				await request(action, subscription);
				enabled = true;
				message = 'Notifikasi aktif di perangkat ini.';
			} else if (subscription) {
				await request(action, subscription);
				if (action === 'disable') {
					enabled = false;
					await subscription.unsubscribe();
					subscription = null;
					message = 'Notifikasi dinonaktifkan di perangkat ini.';
				} else message = 'Notifikasi tes dikirim.';
			}
		} catch (error) {
			message = error instanceof Error ? error.message : 'Aksi notifikasi gagal.';
		} finally {
			busy = false;
		}
	}
</script>

<section class="panel push-preferences" aria-label="Notifikasi perangkat">
	<div class="panel-heading">
		<div><h2>Notifikasi perangkat</h2><p>Terima pengingat meski tab IngatJadwal ditutup.</p></div>
	</div>
	{#if ready}
		<div class="push-actions">
			{#if enabled}
				<button type="button" class="button primary" disabled={busy} onclick={() => change('test')}>Kirim notifikasi tes</button>
				<button type="button" class="button outline" disabled={busy} onclick={() => change('disable')}>Nonaktifkan</button>
			{:else}
				<button type="button" class="button primary" disabled={busy} onclick={() => change('enable')}>Aktifkan notifikasi</button>
			{/if}
		</div>
	{/if}
	{#if message}<p class="push-message" role="status">{message}</p>{/if}
</section>
