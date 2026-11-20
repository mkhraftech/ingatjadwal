create table if not exists patients (
  id bigint generated always as identity primary key,
  uid uuid not null unique,
  name text not null,
  phone text not null,
  medical_record_ref text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists appointments (
  id bigint generated always as identity primary key,
  uid uuid not null unique,
  patient_id bigint not null references patients(id),
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 15 and 240),
  location text not null default 'Unit Rehabilitasi',
  service_label text not null default 'Terapi rehabilitasi',
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','attended','no_show','forfeited','cancelled','rescheduled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_start_idx on appointments (starts_at) where status in ('scheduled','confirmed');
create index if not exists appointments_patient_idx on appointments (patient_id, starts_at desc);

create table if not exists reminder_actions (
  id bigint generated always as identity primary key,
  appointment_id bigint not null references appointments(id) on delete cascade,
  stage text not null check (stage in ('h2','h1','today')),
  outcome text not null default 'sent' check (outcome in ('sent','confirmed','follow_up')),
  handled_at timestamptz not null default now(),
  unique (appointment_id, stage)
);

insert into patients (uid,name,phone,medical_record_ref) values
  ('9be172fc-0a90-4b2a-97aa-2893f361ad2c','Dina Pratama','6281234567001','DEMO-1042'),
  ('bfbd54e7-2426-4e8d-8601-75af350a8392','Budi Santoso','6281234567002','DEMO-1088'),
  ('a86fe592-4029-4a05-b46c-fc0ef410d4a9','Maya Lestari','6281234567003','DEMO-1115'),
  ('f2a5a001-ec47-4c71-a2d3-c09e5e3a9a17','Rizky Ananda','6281234567004','DEMO-1201')
on conflict (uid) do nothing;

insert into appointments (uid,patient_id,starts_at,duration_minutes,location,service_label)
select seed.uid::uuid, patients.id, (current_date + seed.day_offset + seed.time_of_day)::timestamp at time zone 'Asia/Jakarta', seed.duration, seed.location, seed.service
from (values
  ('6bce54ee-4b4f-4236-8f01-927c5dbd0af3','Dina Pratama',2,time '09:00',90,'Ruang Terapi 1','Fisioterapi'),
  ('b8846b63-df38-49ea-8685-59aa2c54ea18','Budi Santoso',1,time '10:30',60,'Ruang Terapi 2','Terapi okupasi'),
  ('dfdb87b5-9a7a-4810-bd4b-5bb56718c300','Maya Lestari',0,time '13:00',120,'Ruang Terapi 1','Fisioterapi'),
  ('f0b7a982-59c7-4bd7-b822-4d03cba2fe8b','Rizky Ananda',3,time '08:30',90,'Ruang Terapi 3','Terapi wicara')
) as seed(uid, patient_name, day_offset, time_of_day, duration, location, service)
join patients on patients.name = seed.patient_name
on conflict (uid) do nothing;
