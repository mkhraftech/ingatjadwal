<script lang="ts">
	import { enhance } from '$app/forms';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import Bell from '@lucide/svelte/icons/bell';
	import Users from '@lucide/svelte/icons/users';
	import Settings from '@lucide/svelte/icons/settings';
	import Search from '@lucide/svelte/icons/search';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Check from '@lucide/svelte/icons/check';
	import CheckCircle2 from '@lucide/svelte/icons/circle-check';
	import Clock3 from '@lucide/svelte/icons/clock-3';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { siWhatsapp } from 'simple-icons';
	import ScheduleCalendar from '#lib/components/ScheduleCalendar.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const nav = [
		{ id: 'dashboard', label: 'Ringkasan' },
		{ id: 'jadwal', label: 'Jadwal' },
		{ id: 'pengingat', label: 'Pengingat' },
		{ id: 'pasien', label: 'Pasien' },
		{ id: 'pengaturan', label: 'Pengaturan' }
	];
	const dateLabel = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date());
	function dateTime(value: string) { return new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value)); }
	function timeOnly(value: string) { return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value)); }
	function stageLabel(stage: string | null) { return stage === 'today' ? 'Hari ini' : stage === 'h1' ? 'H-1' : stage === 'h2' ? 'H-2' : 'Akan datang'; }
	function stageMessage(stage: string | null) { return stage === 'today' ? 'hari ini' : stage === 'h1' ? 'besok' : 'dalam dua hari'; }
	function waLink(phone: string, name: string, startsAt: string, location: string, stage: string | null) {
		const day = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(startsAt));
		const templateStage = stage === 'today' ? 'day_of' : stage ?? 'h2';
		const messageTemplate = data.templates.find((template) => template.stage === templateStage)?.body ?? '{{nama_pasien}}, jadwal terapi Anda pada {{tanggal}} pukul {{jam}} di {{lokasi}}.';
		const message = messageTemplate.replaceAll('{{nama_pasien}}', name).replaceAll('{{tanggal}}', day).replaceAll('{{jam}}', timeOnly(startsAt)).replaceAll('{{lokasi}}', location).replaceAll('{{tahap}}', stageLabel(stage));
		return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
	}
	function actionFor(uid: string, stage: string | null) { return data.actions.find((item) => item.appointment_uid === uid && item.stage === stage); }
	const attention = $derived(data.upcoming.filter((item) => item.stage && !actionFor(item.uid, item.stage)));
	const todaySessions = $derived(data.upcoming.filter((item) => item.stage === 'today'));
	const upcoming = $derived(data.upcoming.filter((item) => item.stage));
</script>

<div class="app-shell">
	<aside class="sidebar">
		<a class="brand" href="/?view=dashboard" aria-label="IngatJadwal, ringkasan">
			<span class="brand-mark">ij<span>.</span></span>
			<span class="brand-name">ingat<span>jadwal</span><small>{data.facility.name.toUpperCase()}</small></span>
		</a>
		<div class="nav-label">MENU UTAMA</div>
		<nav aria-label="Navigasi utama" data-sveltekit-preload-data="hover">
			{#each nav.filter((item) => item.id !== 'pengaturan' || data.facility.role !== 'staff') as item}
				<a class:active={data.view === item.id} href={`/?view=${item.id}`}><span class="nav-icon">{#if item.id === 'dashboard'}<LayoutDashboard size={18} strokeWidth={1.8} />{:else if item.id === 'jadwal'}<CalendarDays size={18} strokeWidth={1.8} />{:else if item.id === 'pengingat'}<Bell size={18} strokeWidth={1.8} />{:else if item.id === 'pasien'}<Users size={18} strokeWidth={1.8} />{:else}<Settings size={18} strokeWidth={1.8} />{/if}</span><span>{item.label}</span>{#if item.id === 'pengingat' && attention.length}<span class="nav-count">{attention.length}</span>{/if}</a>
			{/each}
		</nav>
		<div class="sidebar-bottom">
			<div class="demo-note"><span class="demo-dot"></span><span>Workspace aktif<small>Data terpisah per unit</small></span></div>
			<div class="profile"><div class="avatar">IJ</div><div><strong>{data.facility.role === 'owner' ? 'Pemilik unit' : data.facility.role === 'admin' ? 'Admin unit' : 'Petugas'}</strong><small>{data.facility.name}</small></div><form method="POST" use:enhance action="?/logout"><button class="logout-button" type="submit"><LogOut size={14} /> Keluar</button></form></div>
		</div>
	</aside>

	<main class="main-area">
		<header class="topbar">
			<div class="mobile-brand"><span class="brand-mark">ij<span>.</span></span> ingatjadwal</div>
			<div class="breadcrumbs">Layanan <span>/</span> <strong>{nav.find((item) => item.id === data.view)?.label ?? 'Ringkasan'}</strong></div>
			<div class="top-actions"><span class="today-label">{data.facility.name} &middot; {dateLabel}</span><div class="avatar small-avatar">IJ</div></div>
		</header>

		<div class="content-wrap">
			{#if form?.success}<div class="flash success"><Check size={14} /> {form.success}</div>{/if}
			{#if form?.error}<div class="flash error">{form.error}</div>{/if}

			{#if data.view === 'pasien'}
				<section class="page-heading"><div><p class="eyebrow">DATA PASIEN</p><h1>Daftar pasien</h1><p class="subheading">Kelola kontak pasien untuk kebutuhan pengingat jadwal.</p></div><a class="button primary" href="#form-pasien"><Plus size={16} /> Tambah pasien</a></section>
				<div class="panel" id="form-pasien"><div class="panel-heading"><div><h2>Tambah pasien</h2><p>Simpan hanya informasi yang diperlukan untuk tindak lanjut jadwal.</p></div></div><form method="POST" use:enhance action="/?view=pasien&/patient" class="form-grid"><label>Nama pasien<input name="name" placeholder="Contoh: Sari Puspita" required maxlength="100" /></label><label>Nomor WhatsApp<input name="phone" inputmode="tel" placeholder="62812..." required minlength="10" maxlength="15" /><small>Gunakan kode negara, misalnya 62 untuk Indonesia.</small></label><label>Nomor rekam medis <span class="muted">(opsional)</span><input name="medical_record_ref" placeholder="Opsional" /></label><div class="form-submit"><button class="button primary" type="submit">Simpan pasien</button></div></form></div>
				<div class="panel table-panel"><div class="panel-heading"><div><h2>Semua pasien <span class="soft-count">{data.patients.length}</span></h2><p>Daftar kontak yang aktif.</p></div><div class="search-box"><Search size={16} /><input aria-label="Cari pasien" placeholder="Cari nama pasien" /></div></div><div class="table-scroll"><table><thead><tr><th>PASIEN</th><th>NOMOR WHATSAPP</th><th>NO. REKAM MEDIS</th><th>SESI TERCATAT</th></tr></thead><tbody>{#each data.patients as patient}<tr><td><div class="patient-cell"><span class="patient-avatar">{patient.name.slice(0,1)}</span><strong>{patient.name}</strong></div></td><td>+{patient.phone}</td><td>{patient.medical_record_ref ?? '\u2014'}</td><td>{patient.sessions} sesi</td></tr>{/each}</tbody></table></div></div>
			{:else if data.view === 'pengaturan'}
				<section class="page-heading"><div><p class="eyebrow">KONFIGURASI UNIT</p><h1>Pengaturan</h1><p class="subheading">Atur slot jadwal berulang, template pengingat, dan lokasi terapi.</p></div></section>
				<div class="settings-grid">
					<section class="panel settings-panel"><div class="panel-heading"><div><h2>Template pesan WhatsApp</h2><p>Template digunakan saat petugas membuka WhatsApp untuk mengingatkan pasien.</p></div></div><div class="template-help">Variabel tersedia: <code>{'{{nama_pasien}}'}</code> <code>{'{{tanggal}}'}</code> <code>{'{{jam}}'}</code> <code>{'{{lokasi}}'}</code> <code>{'{{tahap}}'}</code></div>{#each data.templates as template (template.stage)}<form method="POST" use:enhance action="/?view=pengaturan&/template" class="template-form"><input type="hidden" name="stage" value={template.stage} /><label>{template.stage === 'h2' ? 'H-2' : template.stage === 'h1' ? 'H-1' : 'Hari H'}<textarea name="body" rows="4" maxlength="2000" required>{template.body}</textarea></label><button class="button outline" type="submit">Simpan template</button></form>{/each}</section>
					<section class="panel settings-panel"><div class="panel-heading"><div><h2>Master lokasi / ruang</h2><p>Lokasi aktif tersedia saat petugas membuat jadwal.</p></div></div><form method="POST" use:enhance action="/?view=pengaturan&/location" class="location-form"><label>Nama lokasi<input name="name" placeholder="Contoh: Ruang Terapi 2" maxlength="100" required /></label><button class="button primary" type="submit"><Plus size={16} /> Tambah lokasi</button></form><div class="location-list">{#each data.locations as location (location.uid)}<div class="location-row"><span><strong>{location.name}</strong><small>Aktif</small></span><form method="POST" use:enhance action="/?view=pengaturan&/deleteLocation" onsubmit={(event) => { if (!confirm(`Nonaktifkan lokasi ${location.name}?`)) event.preventDefault(); }}><input type="hidden" name="location_uid" value={location.uid} /><button class="button danger" type="submit">Nonaktifkan</button></form></div>{/each}</div></section>
					<section class="panel settings-panel schedule-master"><div class="panel-heading"><div><h2>Master slot jadwal</h2><p>Slot ini diulang setiap minggu dan muncul pada tanggal yang sesuai di kalender.</p></div></div><form method="POST" use:enhance action="/?view=pengaturan&/scheduleSlot" class="schedule-slot-form"><label>Hari<select name="weekday" required>{#each ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'] as day, index}<option value={index + 1}>{day}</option>{/each}</select></label><label>Jam<input name="slot_time" type="time" required /></label><button class="button primary" type="submit"><Plus size={16} /> Tambah slot</button></form><p class="schedule-slot-note">Slot adalah pola waktu berulang, bukan booking pasien. Jadwal pasien tetap dibuat dari kalender.</p><div class="schedule-slot-list">{#each ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'] as day, index (day)}<section class="schedule-slot-day"><strong>{day}</strong><div class="schedule-slot-chips">{#each data.scheduleSlots.filter((slot) => slot.weekday === index + 1) as slot (slot.uid)}<div class="schedule-slot-chip"><span>{slot.slot_time.slice(0,5)}</span><form method="POST" use:enhance action="/?view=pengaturan&/deleteScheduleSlot" onsubmit={(event) => { if (!confirm(`Hapus slot ${day} pukul ${slot.slot_time.slice(0,5)}?`)) event.preventDefault(); }}><input type="hidden" name="schedule_slot_uid" value={slot.uid} /><button type="submit" aria-label="Hapus slot {day} pukul {slot.slot_time.slice(0,5)}"><Trash2 size={14} /></button></form></div>{:else}<small>Belum ada slot</small>{/each}</div></section>{/each}</div></section>
				</div>
			{:else if data.view === 'jadwal' && data.scheduleView !== 'table'}
				<ScheduleCalendar data={data} />
			{:else if data.view === 'jadwal'}
				<section class="page-heading"><div><p class="eyebrow">OPERASIONAL</p><h1>Jadwal</h1><p class="subheading">Catat setiap sesi sesuai ketersediaan.</p></div><div class="schedule-heading-actions"><div class="schedule-view-toggle"><a href="/?view=jadwal&mode=calendar">Kalender</a><a class="active" href="/?view=jadwal&mode=table">Tabel</a></div><a class="button primary" href="#form-jadwal"><Plus size={16} /> Buat jadwal</a></div></section>
				<div class="panel" id="form-jadwal"><div class="panel-heading"><div><h2>Jadwalkan sesi</h2><p>Setiap sesi dibuat satu per satu mengikuti ketersediaan.</p></div><span class="panel-icon lavender"><CalendarDays size={16} /></span></div><form method="POST" use:enhance action="/?view=jadwal&mode=table&/appointment" class="form-grid"><label>Pasien<select name="patient_uid" required><option value="">Pilih pasien</option>{#each data.patients as patient}<option value={patient.uid}>{patient.name}</option>{/each}</select></label><label>Tanggal<input name="date" type="date" required /></label><label>Jam mulai<input name="time" type="time" required /></label><label>Durasi<select name="duration"><option value="15">15 menit</option><option value="20">20 menit</option><option value="30">30 menit</option><option value="45">45 menit</option><option value="60" selected>1 jam</option><option value="90">1 jam 30 menit</option><option value="120">2 jam</option></select></label><label>Lokasi / ruang<select name="location_uid" required><option value="">Pilih lokasi</option>{#each data.locations as location}<option value={location.uid}>{location.name}</option>{/each}</select></label><div class="form-submit"><button class="button primary" type="submit">Simpan sesi</button></div></form></div>
				<div class="panel table-panel"><div class="panel-heading"><div><h2>Sesi mendatang <span class="soft-count">{data.upcoming.length}</span></h2><p>Semua waktu ditampilkan dalam WIB. Pesan dibuka di WhatsApp untuk dikirim manual.</p></div></div><div class="table-scroll"><table><thead><tr><th>PASIEN</th><th>JADWAL</th><th>DURASI</th><th>LOKASI</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{#each data.upcoming as item}<tr><td><div class="patient-cell"><span class="patient-avatar">{item.name.slice(0,1)}</span><strong>{item.name}</strong></div></td><td>{dateTime(item.starts_at)}</td><td>{item.duration_minutes} menit</td><td>{item.location}</td><td><span class="status-pill">{item.status === 'confirmed' ? 'Dikonfirmasi' : 'Terjadwal'}</span></td><td><a class="button whatsapp" href={waLink(item.phone,item.name,item.starts_at,item.location,null)} target="_blank" rel="noreferrer"><svg class="brand-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={siWhatsapp.path} /></svg> <span>Kirim WhatsApp</span></a></td></tr>{/each}</tbody></table></div></div>
			{:else if data.view === 'pengingat'}
				<section class="page-heading"><div><p class="eyebrow">FOLLOW-UP PASIEN</p><h1>Pengingat</h1><p class="subheading">Tinjau pesan lalu kirim sendiri melalui WhatsApp.</p></div><span class="date-chip"><Clock3 size={14} /> &nbsp; H-2 &middot; H-1 &middot; Hari H</span></section>
				<div class="reminder-summary"><div><span class="summary-icon coral"><Clock3 size={16} /></span><span><strong>{attention.length}</strong><small>Belum ditindaklanjuti</small></span></div><div><span class="summary-icon green"><Check size={16} /></span><span><strong>{data.actions.length}</strong><small>Sudah dicatat</small></span></div><div><span class="summary-icon lavender"><CalendarDays size={16} /></span><span><strong>{todaySessions.length}</strong><small>Sesi hari ini</small></span></div></div>
				<div class="panel reminder-panel"><div class="panel-heading"><div><h2>Daftar follow-up</h2><p>Pengingat tersusun berdasarkan jadwal sesi.</p></div><span class="soft-count">{upcoming.length} sesi</span></div>{#if upcoming.length}{#each upcoming as item}<article class="reminder-row"><div class="reminder-date"><span class="stage-dot" class:due={item.stage === 'today'}></span><span>{stageLabel(item.stage)}</span></div><div class="reminder-info"><strong>{item.name}</strong><span>{dateTime(item.starts_at)} &middot; {item.duration_minutes} menit</span><small>{item.location} &middot; {item.service_label}</small></div><div class="reminder-state">{#if actionFor(item.uid,item.stage)}<span class="done-label"><Check size={14} /> {actionFor(item.uid,item.stage)?.outcome === 'confirmed' ? 'Dikonfirmasi' : actionFor(item.uid,item.stage)?.outcome === 'follow_up' ? 'Perlu follow-up' : 'Dicatat terkirim'}</span>{:else}<span class="pending-label">Perlu diingatkan</span>{/if}</div><div class="reminder-actions"><a class="button whatsapp" href={waLink(item.phone,item.name,item.starts_at,item.location,item.stage)} target="_blank" rel="noreferrer"><svg class="brand-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={siWhatsapp.path} /></svg> <span>Buka WhatsApp</span></a><form method="POST" use:enhance action="/?view=pengingat&/reminder" class="inline-action"><input type="hidden" name="reminder_uid" value={item.reminder_uid} /><input type="hidden" name="stage" value={item.stage} /><select aria-label="Hasil tindak lanjut" name="status"><option value="sent">Pesan dikirim</option><option value="confirmed">Pasien konfirmasi</option><option value="follow_up">Perlu follow-up</option></select><button class="button outline" type="submit">Catat</button></form></div></article>{/each}{:else}<div class="empty-state"><span><CheckCircle2 size={20} /></span><strong>Belum ada pengingat terjadwal</strong><p>Jadwal yang masuk rentang H-2 sampai hari H akan tampil di sini.</p></div>{/if}</div>
			{:else}
				<section class="welcome-row"><div><p class="eyebrow">{dateLabel.toUpperCase()}</p><h1>Selamat datang, Admin</h1><p class="subheading">Berikut ringkasan jadwal dan tindak lanjut unit hari ini.</p></div><a class="button primary" href="/?view=jadwal&mode=table#form-jadwal"><Plus size={16} /> Buat jadwal</a></section>
				<div class="stats-grid"><article class="stat-card"><div class="stat-top"><span>Pasien aktif</span><span class="summary-icon lavender"><CalendarDays size={16} /></span></div><strong>{data.patientCount}</strong><small>Kontak tersimpan</small><span class="stat-decoration lavender-bg"><Users size={44} /></span></article><article class="stat-card"><div class="stat-top"><span>Sesi hari ini</span><span class="summary-icon blue"><CalendarDays size={16} /></span></div><strong>{todaySessions.length}</strong><small>Jadwal terapi</small><span class="stat-decoration blue-bg"><CalendarDays size={44} /></span></article><article class="stat-card"><div class="stat-top"><span>Perlu follow-up</span><span class="summary-icon coral"><Clock3 size={16} /></span></div><strong>{attention.length}</strong><small>Pengingat belum dicatat</small><span class="stat-decoration coral-bg"><Bell size={44} /></span></article><article class="stat-card"><div class="stat-top"><span>Tindak lanjut</span><span class="summary-icon green"><Check size={16} /></span></div><strong>{data.actions.length}</strong><small>Dicatat di demo ini</small><span class="stat-decoration green-bg"><Check size={44} /></span></article></div>
				<div class="dashboard-grid"><section class="panel today-panel"><div class="panel-heading"><div><h2>Jadwal hari ini</h2><p>Sesi terapi yang berlangsung hari ini.</p></div><a href="/?view=jadwal" class="text-link">Lihat jadwal <ArrowRight size={14} /></a></div>{#if todaySessions.length}{#each todaySessions as item}<div class="today-row"><div class="time-block"><strong>{timeOnly(item.starts_at)}</strong><small>{item.duration_minutes} menit</small></div><div class="timeline-line"></div><span class="patient-avatar">{item.name.slice(0,1)}</span><div class="today-info"><strong>{item.name}</strong><span>{item.service_label} &middot; {item.location}</span></div><span class="status-pill">{item.status === 'confirmed' ? 'Dikonfirmasi' : 'Terjadwal'}</span></div>{/each}{:else}<div class="empty-small">Tidak ada sesi hari ini.</div>{/if}</section>
					<section class="panel attention-panel"><div class="panel-heading"><div><h2>Perlu diingatkan</h2><p>Pengingat pada H-2, H-1, dan hari H.</p></div><a href="/?view=pengingat" class="text-link">Semua <ArrowRight size={14} /></a></div>{#if attention.length}{#each attention.slice(0,3) as item}<div class="attention-row"><span class="attention-icon"><Clock3 size={16} /></span><div><strong>{item.name}</strong><span>{stageLabel(item.stage)} &middot; {dateTime(item.starts_at)}</span></div><span class="attention-dot"></span></div>{/each}{:else}<div class="empty-small">Semua pengingat dalam rentang ini sudah dicatat.</div>{/if}<a class="button outline full-button" href="/?view=pengingat">Buka daftar pengingat</a></section></div>
				<div class="demo-banner"><span class="banner-icon"><Sparkles size={16} /></span><div><strong>IngatJadwal masih dalam tahap pengembangan</strong><p>Gunakan data sintetis sampai kebijakan unit, backup, retensi, dan prosedur pemulihan ditinjau bersama fasilitas.</p></div><span class="banner-tag">PILOT</span></div>
			{/if}
			<footer>IngatJadwal <span>&middot;</span> Workspace {data.facility.name} <span>&middot;</span> Semua waktu dalam WIB</footer>
		</div>
	</main>
</div>

