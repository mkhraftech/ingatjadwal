self.addEventListener('install', (event) => {
	event.waitUntil(self.skipWaiting());
});

self.addEventListener('push', (event) => {
	const data = event.data?.json();
	if (!data?.body) return;
	event.waitUntil(self.registration.showNotification('IngatJadwal', {
		body: data.body,
		tag: data.test ? 'ingatjadwal-test' : 'ingatjadwal-reminders',
		renotify: true,
		requireInteraction: true
	}));
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(self.clients.openWindow('/?view=pengingat'));
});
