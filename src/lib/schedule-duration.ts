export function scheduleDuration(start: string, end: string) {
	const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
	if (!timePattern.test(start) || !timePattern.test(end)) return 0;
	const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
	return (minutes(end) - minutes(start) + 1440) % 1440;
}
