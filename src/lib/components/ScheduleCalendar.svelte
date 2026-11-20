<script lang="ts">
	import { scheduleDuration } from "#lib/schedule-duration";
	import { enhance } from '$app/forms';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Maximize from '@lucide/svelte/icons/maximize';
	import Minimize from '@lucide/svelte/icons/minimize';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { siWhatsapp } from 'simple-icons';
	import { tick } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	type Appointment = {
		uid: string;
		patient_uid: string;
		name: string;
		phone: string;
		starts_at: string;
		duration_minutes: number;
		location: string;
		service_label: string;
		status: string;
	};
	type ScheduleSlot = { uid: string; weekday: number; slot_time: string; slot_end: string };
	type Patient = { uid: string; name: string };
	type MessageTemplate = { stage: string; body: string };
	type CalendarData = {
		scheduleView: 'calendar' | 'week' | 'table';
		calendarMonth: string;
		previousMonth: string;
		nextMonth: string;
		calendarWeekStart: string;
		calendarWeekEnd: string;
		previousWeek: string;
		nextWeek: string;
		calendarAppointments: Appointment[];
		scheduleSlots: ScheduleSlot[];
		patients: Patient[];
		locations: { uid: string; name: string }[];
		templates: MessageTemplate[];
	};
	let { data }: { data: CalendarData } = $props();

	const weekdays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
	let calendarFullscreen = $state(false);
	let showCalendarModal = $state(false);
	let selectedCalendarDate = $state('');
	let selectedCalendarTime = $state('');
	let selectedSlot = $state<ScheduleSlot | undefined>();
	let selectedEnd = $state('');
	const duration = $derived(scheduleDuration(selectedCalendarTime, selectedEnd));
	let selectedPatientUids = $state<string[]>([]);
	let expandedCalendarDays = $state<string[]>([]);
	const filteredAppointments = $derived(selectedPatientUids.length
		? data.calendarAppointments.filter((item) => selectedPatientUids.includes(item.patient_uid))
		: data.calendarAppointments);
	const monthLabel = $derived(new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${data.calendarMonth}-01T00:00:00Z`)));
	const weekLabel = $derived(`${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${data.calendarWeekStart}T00:00:00Z`))} – ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${data.calendarWeekEnd}T00:00:00Z`))}`);
	const monthDays = $derived.by(() => {
		const [year, month] = data.calendarMonth.split('-').map(Number);
		const firstDay = new Date(Date.UTC(year, month - 1, 1));
		const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
		const firstVisible = new Date(Date.UTC(year, month - 1, 1 - mondayOffset));
		return Array.from({ length: 42 }, (_, index) => {
			const day = new Date(firstVisible);
			day.setUTCDate(day.getUTCDate() + index);
			return day.toISOString().slice(0, 10);
		});
	});
	const weekDays = $derived(Array.from({ length: 7 }, (_, index) => {
		const day = new Date(`${data.calendarWeekStart}T00:00:00Z`);
		day.setUTCDate(day.getUTCDate() + index);
		return day.toISOString().slice(0, 10);
	}));
	const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
	const visibleAppointments = (day: string) => {
		const events = filteredAppointments.filter((item) => dateInJakarta(item.starts_at) === day);
		return expandedCalendarDays.includes(day) || data.scheduleView === 'week' ? events : events.slice(0, 2);
	};
	const appointmentsForDay = (day: string) => filteredAppointments.filter((item) => dateInJakarta(item.starts_at) === day);
	const slotsForDay = (day: string) => {
		const weekday = new Date(`${day}T00:00:00Z`).getUTCDay() || 7;
		return data.scheduleSlots.filter((slot) => slot.weekday === weekday);
	};
	const isSlotTaken = (day: string, slotTime: string) => data.calendarAppointments.some((item) =>
		dateInJakarta(item.starts_at) === day && timeKey(item.starts_at) === slotTime.slice(0, 5)
	);

	function dateInJakarta(value: string) {
		const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
		const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
		return `${values.year}-${values.month}-${values.day}`;
	}
	function timeKey(value: string) {
		return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
	}
	function timeOnly(value: string) {
		return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
	}
	function appointmentTimeRange(item: Appointment) {
		const end = new Date(Date.parse(item.starts_at) + item.duration_minutes * 60_000).toISOString();
		const nextDay = dateInJakarta(end) !== dateInJakarta(item.starts_at);
		return timeOnly(item.starts_at) + ' - ' + timeOnly(end) + (nextDay ? ' (+1 hari)' : '');
	}
	function dateTime(value: string) {
		return new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value));
	}
	function openCalendarModal(day: string, slot?: ScheduleSlot) {
		selectedCalendarDate = day;
		selectedSlot = slot;
		selectedCalendarTime = slot?.slot_time.slice(0, 5) ?? '';
		selectedEnd = slot?.slot_end.slice(0, 5) ?? '';
		showCalendarModal = true;
	}
	function toggleCalendarFullscreen() {
		const next = !calendarFullscreen;
		const documentWithTransitions = document as Document & { startViewTransition?: (callback: () => Promise<void>) => unknown };
		if (documentWithTransitions.startViewTransition) {
			documentWithTransitions.startViewTransition(async () => { calendarFullscreen = next; await tick(); });
		} else calendarFullscreen = next;
	}
	function toggleCalendarDay(day: string) {
		expandedCalendarDays = expandedCalendarDays.includes(day)
			? expandedCalendarDays.filter((item) => item !== day)
			: [...expandedCalendarDays, day];
	}
	function waLink(item: Appointment) {
		const day = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(item.starts_at));
		const template = data.templates.find((entry) => entry.stage === 'h2')?.body ?? '{{nama_pasien}}, jadwal terapi Anda pada {{tanggal}} pukul {{jam}} di {{lokasi}}.';
		const message = template.replaceAll('{{nama_pasien}}', item.name).replaceAll('{{tanggal}}', day).replaceAll('{{jam}}', timeOnly(item.starts_at)).replaceAll('{{lokasi}}', item.location).replaceAll('{{tahap}}', 'Akan datang');
		return `https://wa.me/${item.phone}?text=${encodeURIComponent(message)}`;
	}
	const appointmentAction = $derived(data.scheduleView === 'week'
		? `/?view=jadwal&mode=week&week=${data.calendarWeekStart}&/appointment`
		: `/?view=jadwal&mode=calendar&month=${data.calendarMonth}&/appointment`);
	const deleteAction = (day: string) => data.scheduleView === 'week'
		? `/?view=jadwal&mode=week&week=${data.calendarWeekStart}&/deleteAppointment`
		: `/?view=jadwal&mode=calendar&month=${day.slice(0, 7)}&/deleteAppointment`;
</script>

{#snippet slotSummary(day: string)}
	{@const slots = slotsForDay(day)}
	{@const taken = slots.filter((slot) => isSlotTaken(day, slot.slot_time)).length}
	<div class="calendar-slot-summary">
		<span>{slots.length} slot</span>
		<span>{taken} terisi</span>
		<span>{slots.length - taken} kosong</span>
	</div>
{/snippet}

<section class="page-heading">
	<div><p class="eyebrow">OPERASIONAL</p><h1>Jadwal</h1><p class="subheading">Atur sesi berdasarkan slot waktu yang tersedia.</p></div>
	<div class="schedule-heading-actions">
		<div class="schedule-view-toggle">
			<a class:active={data.scheduleView === 'week'} href={`/?view=jadwal&mode=week&week=${data.calendarWeekStart}`}>Mingguan</a>
			<a class:active={data.scheduleView === 'calendar'} href={`/?view=jadwal&mode=calendar&month=${data.calendarMonth}`}><CalendarDays size={15} /> Bulanan</a>
		</div>
		<button class="button primary" type="button" onclick={() => openCalendarModal(data.scheduleView === 'week' ? data.calendarWeekStart : `${data.calendarMonth}-01`)}><Plus size={16} /> Tambah jadwal</button>
	</div>
</section>

<div class="panel calendar-panel" class:fullscreen={calendarFullscreen}>
	<div class="calendar-toolbar">
		<div><h2>{data.scheduleView === 'week' ? weekLabel : monthLabel}</h2><p>{filteredAppointments.length} jadwal ditampilkan{data.scheduleSlots.length ? ` · ${data.scheduleSlots.length} pola slot mingguan` : ''}</p></div>
		<div class="calendar-controls">
			<button class="button outline calendar-fullscreen-toggle" type="button" aria-label={calendarFullscreen ? 'Keluar layar penuh' : 'Layar penuh'} title={calendarFullscreen ? 'Keluar layar penuh' : 'Layar penuh'} class:active={calendarFullscreen} onclick={toggleCalendarFullscreen}>{#if calendarFullscreen}<Minimize size={18} strokeWidth={1.8} />{:else}<Maximize size={18} strokeWidth={1.8} />{/if}</button>
			<details class="calendar-patient-filter"><summary>Pasien: {selectedPatientUids.length ? `${selectedPatientUids.length} dipilih` : 'Semua pasien'}</summary><div class="calendar-filter-options"><button type="button" class="calendar-filter-reset" onclick={() => selectedPatientUids = []}>Tampilkan semua pasien</button>{#each data.patients as patient (patient.uid)}<label><input type="checkbox" value={patient.uid} bind:group={selectedPatientUids} />{patient.name}</label>{/each}</div></details>
			{#if data.scheduleView === 'week'}
				<a class="button outline" href={`/?view=jadwal&mode=week&week=${data.previousWeek}`} aria-label="Minggu sebelumnya"><ChevronLeft size={16} /></a>
				<a class="button outline" href="/?view=jadwal&mode=week" aria-label="Minggu ini">Minggu ini</a>
				<a class="button outline" href={`/?view=jadwal&mode=week&week=${data.nextWeek}`} aria-label="Minggu berikutnya"><ChevronRight size={16} /></a>
			{:else}
				<a class="button outline" href={`/?view=jadwal&mode=calendar&month=${data.previousMonth}`} aria-label="Bulan sebelumnya"><ChevronLeft size={16} /></a>
				<a class="button outline" href="/?view=jadwal&mode=calendar" aria-label="Bulan ini">Bulan ini</a>
				<a class="button outline" href={`/?view=jadwal&mode=calendar&month=${data.nextMonth}`} aria-label="Bulan berikutnya"><ChevronRight size={16} /></a>
			{/if}
		</div>
	</div>

	{#if data.scheduleView === 'calendar'}
		{#if !filteredAppointments.length && !data.scheduleSlots.length}
			<div class="calendar-empty"><p>Belum ada slot atau jadwal untuk bulan ini.</p><button class="calendar-empty-add" type="button" onclick={() => openCalendarModal(`${data.calendarMonth}-01`)} aria-label="Tambah jadwal"><Plus size={34} strokeWidth={1.8} /></button><strong>Tambah jadwal pertama</strong></div>
		{/if}
		<div class="calendar-weekdays">{#each weekdays as weekday}<div>{weekday}</div>{/each}</div>
		<div class="calendar-month-grid">
			{#each monthDays as day (day)}
				<section class="calendar-day-cell" class:outside={day.slice(0, 7) !== data.calendarMonth} class:today={day === today}>
					<div class="calendar-day-heading" class:has-events={appointmentsForDay(day).length > 0}><span class="calendar-day-number">{Number(day.slice(8, 10))}</span><button class="calendar-day-add" type="button" onclick={() => openCalendarModal(day)} aria-label="Tambah jadwal tanggal {day}"><Plus size={15} /></button></div>
					{#if day.slice(0, 7) === data.calendarMonth}{@render slotSummary(day)}{/if}
					{#if day.slice(0, 7) === data.calendarMonth && slotsForDay(day).length}
						<div class="calendar-slot-list">{#each slotsForDay(day) as slot (slot.uid)}{#if isSlotTaken(day, slot.slot_time)}<span class="calendar-slot taken" title="Slot ini sudah memiliki jadwal">{slot.slot_time.slice(0, 5)}?{slot.slot_end.slice(0, 5)} · Terisi</span>{:else}<button class="calendar-slot" type="button" onclick={() => openCalendarModal(day, slot)} title="Tambah jadwal pukul {slot.slot_time.slice(0, 5)}?{slot.slot_end.slice(0, 5)}"><Plus size={11} /> {slot.slot_time.slice(0, 5)}?{slot.slot_end.slice(0, 5)}</button>{/if}{/each}</div>
					{/if}
					{#each visibleAppointments(day) as item (item.uid)}<article class="calendar-event"><strong>{appointmentTimeRange(item)} · {item.name}</strong><small>{item.duration_minutes} menit · {item.location}</small><div class="calendar-event-actions"><a class="button whatsapp" href={waLink(item)} target="_blank" rel="noreferrer"><svg class="brand-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={siWhatsapp.path} /></svg> Kirim</a><form method="POST" use:enhance action={deleteAction(day)} onsubmit={(event) => { if (!confirm(`Hapus jadwal ${item.name} pada ${dateTime(item.starts_at)}?`)) event.preventDefault(); }}><input type="hidden" name="appointment_uid" value={item.uid} /><button class="button danger" type="submit"><Trash2 size={14} /> Hapus</button></form></div></article>{/each}
					{#if appointmentsForDay(day).length > 2}<button class="calendar-see-all" type="button" onclick={() => toggleCalendarDay(day)}>{expandedCalendarDays.includes(day) ? 'Tampilkan lebih sedikit' : `Lihat semua (+${appointmentsForDay(day).length - 2})`}</button>{/if}
				</section>
			{/each}
		</div>
	{:else}
		<div class="calendar-week-scroll"><div class="calendar-week-grid">
			{#each weekDays as day (day)}
				<section class="calendar-week-day" class:today={day === today}>
					<header><div><span>{weekdays[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]}</span><strong>{Number(day.slice(8, 10))}</strong></div><button class="calendar-day-add" type="button" onclick={() => openCalendarModal(day)} aria-label="Tambah jadwal tanggal {day}"><Plus size={15} /></button></header>
					{@render slotSummary(day)}
					{#if slotsForDay(day).length}<div class="calendar-slot-list weekly-slots">{#each slotsForDay(day) as slot (slot.uid)}{#if isSlotTaken(day, slot.slot_time)}<span class="calendar-slot taken" title="Slot ini sudah memiliki jadwal">{slot.slot_time.slice(0, 5)}?{slot.slot_end.slice(0, 5)} · Terisi</span>{:else}<button class="calendar-slot" type="button" onclick={() => openCalendarModal(day, slot)}><Plus size={12} /> {slot.slot_time.slice(0, 5)}?{slot.slot_end.slice(0, 5)} Tambah</button>{/if}{/each}</div>{:else}<button class="calendar-week-empty-add" type="button" onclick={() => openCalendarModal(day)}><Plus size={14} /> Tambah slot tanggal</button>{/if}
					{#each appointmentsForDay(day) as item (item.uid)}<article class="calendar-event"><strong>{appointmentTimeRange(item)} · {item.name}</strong><small>{item.duration_minutes} menit · {item.location}</small><div class="calendar-event-actions"><a class="button whatsapp" href={waLink(item)} target="_blank" rel="noreferrer"><svg class="brand-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={siWhatsapp.path} /></svg> Kirim</a><form method="POST" use:enhance action={deleteAction(day)} onsubmit={(event) => { if (!confirm(`Hapus jadwal ${item.name} pada ${dateTime(item.starts_at)}?`)) event.preventDefault(); }}><input type="hidden" name="appointment_uid" value={item.uid} /><button class="button danger" type="submit"><Trash2 size={14} /> Hapus</button></form></div></article>{/each}
				</section>
			{/each}
		</div></div>
	{/if}
</div>

{#if showCalendarModal}
	<div class="calendar-modal-backdrop" role="presentation" transition:fade={{ duration: 160 }} onclick={(event) => { if (event.target === event.currentTarget) showCalendarModal = false; }}>
		<dialog open class="calendar-modal" aria-labelledby="calendar-modal-title" transition:scale={{ duration: 190, start: 0.96 }}>
			<div class="calendar-modal-heading"><div><p class="eyebrow">JADWAL TERAPI</p><h2 id="calendar-modal-title">Tambah jadwal</h2></div><button class="calendar-modal-close" type="button" aria-label="Tutup" onclick={() => showCalendarModal = false}>&times;</button></div>
			<form method="POST" use:enhance={() => async ({ result, update }) => { await update(); if (result.type === 'success') showCalendarModal = false; }} action={appointmentAction} class="calendar-modal-form">
				<label>Pasien<select name="patient_uid" required><option value="">Pilih pasien</option>{#each data.patients as patient (patient.uid)}<option value={patient.uid}>{patient.name}</option>{/each}</select></label>
				<label>Tanggal<input name="date" type="date" bind:value={selectedCalendarDate} readonly /></label>
				<label>Jam mulai<input name="time" type="time" bind:value={selectedCalendarTime} readonly={Boolean(selectedSlot)} required={!Boolean(selectedSlot)} /></label>
				{#if selectedSlot}<input type="hidden" name="schedule_slot_uid" value={selectedSlot.uid} />{/if}
				<label>Jam selesai<input name="end_time" type="time" bind:value={selectedEnd} readonly={Boolean(selectedSlot)} required={!selectedSlot} /></label>
				<label>Durasi<input value={duration ? duration + ' menit' : '?'} readonly /></label>
				<label class="calendar-modal-location">Lokasi / ruang<select name="location_uid" required><option value="">Pilih lokasi</option>{#each data.locations as location (location.uid)}<option value={location.uid}>{location.name}</option>{/each}</select></label>
				<div class="calendar-modal-actions"><button class="button outline" type="button" onclick={() => showCalendarModal = false}>Batal</button><button class="button primary" type="submit">Simpan jadwal</button></div>
			</form>
		</dialog>
	</div>
{/if}
