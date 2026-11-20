import { sendNotification } from 'web-push';

/** @param {unknown} endpoint */
export function validPushEndpoint(endpoint) {
	if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;
	try {
		const url = new URL(endpoint);
		const host = url.hostname;
		const allowed = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com'
			|| host === 'web.push.apple.com' || host.endsWith('.push.apple.com')
			|| host.endsWith('.notify.windows.com');
		return allowed && url.protocol === 'https:' && !url.port && !url.username && !url.password && !url.hash;
	} catch {
		return false;
	}
}

/** @param {{endpoint: string, p256dh: string, auth_key: string}} device
 * @param {string} body
 */
export function sendPush(device, body, test = false) {
	const { VAPID_SUBJECT, PUBLIC_VAPID_KEY, VAPID_PRIVATE_KEY } = process.env;
	if (!VAPID_SUBJECT || !PUBLIC_VAPID_KEY || !VAPID_PRIVATE_KEY) throw new Error('VAPID belum dikonfigurasi.');
	const contact = VAPID_SUBJECT.trim();
	const subject = /^[^\s:@]+@[^\s:@]+$/.test(contact) ? 'mailto:' + contact : contact;
	if (!validPushEndpoint(device.endpoint)) throw new Error('Endpoint push tidak didukung.');
	return sendNotification({
		endpoint: device.endpoint,
		keys: { p256dh: device.p256dh, auth: device.auth_key }
	}, JSON.stringify({ body, test }), {
		vapidDetails: {
			subject,
			publicKey: PUBLIC_VAPID_KEY,
			privateKey: VAPID_PRIVATE_KEY
		},
		TTL: 600,
		timeout: 10_000
	});
}
