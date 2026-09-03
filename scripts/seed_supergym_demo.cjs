'use strict';

/**
 * SUPERGYM-88 demo salonu — ekran görüntüsü için uydurma veri.
 *
 * Bu salonda GERÇEK KİŞİ VERİSİ YOKTUR. 20 üye, 5 antrenör ve bunlara bağlı
 * ders/program/ödeme kayıtları tamamen uydurmadır; adlar, telefonlar ve
 * e-postalar sabit listelerden üretilir. Tarabya-01'den hiçbir şey taşınmaz —
 * orası test salonu olarak kalır, tanıtım görüntüleri buradan alınır.
 *
 * Mevcut yönetici üyeliğine DOKUNULMAZ (tenants dokümanının ownerUid'i ve
 * o kişinin tenant_memberships kaydı script'in yazdığı kümenin dışındadır).
 *
 * Ürettiği her doküman "sg-" ön ekli deterministik kimlik taşır: script
 * yeniden çalıştırılabilir, ikinci çalıştırma yeni kayıt basmaz, üzerine yazar.
 *
 *   node scripts/seed_supergym_demo.cjs                  # kuru çalıştırma
 *   node scripts/seed_supergym_demo.cjs --apply          # yaz
 *   node scripts/seed_supergym_demo.cjs --purge --apply  # sg-* kayıtları sil
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const PURGE = process.argv.includes('--purge');

const TENANT_ID = 'HMtEwZWgcKbfPsPZ9JdC';
const TENANT_CODE = 'SUPERGYM-88';
const TENANT_NAME = 'Supergym';
const MAIL_DOMAIN = 'supergym88.test';  // RFC 2606 — asla gerçek bir alan adı olamaz
const DEMO_PASSWORD = 'Supergym88!';

initializeApp({ credential: cert(require(path.resolve(__dirname, '../secrets/serviceAccount.json'))) });
const db = getFirestore();
const auth = getAuth();

// ---------------------------------------------------------------- yardımcı

const NOW = new Date();
const DAY = 86400000;
function at(dayOffset, hour = 0, minute = 0) {
  const d = new Date(NOW.getTime() + dayOffset * DAY);
  d.setHours(hour, minute, 0, 0);
  return Timestamp.fromDate(d);
}
function ago(ms) { return Timestamp.fromDate(new Date(NOW.getTime() - ms)); }

/** Tohumlu üreteç — her çalıştırmada aynı "rastgele" veri çıksın. */
let _seed = 88088;
function rnd() { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; }
function between(lo, hi) { return lo + rnd() * (hi - lo); }
function round1(n) { return Math.round(n * 10) / 10; }

const writes = [];
function put(col, id, data) { writes.push({ col, id, data }); }

// ------------------------------------------------------------------ kadro

const TRAINERS = [
  { key: 'antrenor1', name: 'Kerem Aksoy' },
  { key: 'antrenor2', name: 'Elif Tanrıkulu' },
  { key: 'antrenor3', name: 'Barış Yalçın' },
  { key: 'antrenor4', name: 'Naz Erdoğdu' },
  { key: 'antrenor5', name: 'Onur Baştürk' },
];

const MEMBERS = [
  'Ayça Gülhan', 'Berk Sarıkaya', 'Ceren Özdil', 'Doruk Menemencioğlu', 'Ela Kavuncu',
  'Ferhat Uysal', 'Gizem Aktuna', 'Hakan Poyraz', 'Irmak Sevindik', 'İlker Doğanay',
  'Jale Kurtuluş', 'Kaan Bilgehan', 'Lale Çetinkaya', 'Mahir Sökmen', 'Nehir Balaban',
  'Ozan Türkmen', 'Pelin Aydoğmuş', 'Rüzgar Kandemir', 'Selin Yaman', 'Tolga Arıkan',
].map((name, i) => ({ key: 'uye' + String(i + 1).padStart(2, '0'), name }));

const PEOPLE = [...TRAINERS, ...MEMBERS];
PEOPLE.forEach((p, i) => {
  p.email = p.key + '@' + MAIL_DOMAIN;
  p.phone = '0555 ' + String(880 + i) + ' ' + String(10 + i).padStart(2, '0') + ' ' + String(20 + i).padStart(2, '0');
  p.shortCode = String(310001 + i);
  p.birthDate = new Date(Date.UTC(1979 + ((i * 7) % 25), (i * 5) % 12, 1 + ((i * 11) % 27)));
});
const byKey = Object.fromEntries(PEOPLE.map(p => [p.key, p]));

// -------------------------------------------------------- paket kataloğu

const PACKAGES = [
  { id: 'sg-pkg-silver',   name: 'Silver',        kind: 'membership', price: 850,   durationDays: 30,  sortOrder: 0, entitlements: { gymAccess: true } },
  { id: 'sg-pkg-gold',     name: 'Gold',          kind: 'membership', price: 1450,  durationDays: 30,  sortOrder: 1, entitlements: { gymAccess: true, groupClasses: { unlimited: true } } },
  { id: 'sg-pkg-platinum', name: 'Platinium',     kind: 'membership', price: 2400,  durationDays: 30,  sortOrder: 2, entitlements: { gymAccess: true, groupClasses: { unlimited: true }, ptLessons: { count: 4, periodDays: 30 } } },
  { id: 'sg-pkg-yillik',   name: 'Yıllık Gold',   kind: 'membership', price: 13900, durationDays: 365, sortOrder: 3, entitlements: { gymAccess: true, groupClasses: { unlimited: true } } },
  { id: 'sg-pkg-grup8',    name: '8 Grup Dersi',  kind: 'membership', price: 1100,  durationDays: 60,  sortOrder: 4, entitlements: { gymAccess: true, groupClasses: { count: 8, periodDays: 60 } } },
  { id: 'sg-pkg-pt10',     name: '10 Ders PT',    kind: 'lessons',    price: 6500,  lessonCount: 10, lessonValidityDays: 120, sortOrder: 5, entitlements: { gymAccess: true, ptLessons: { count: 10, periodDays: 120 } } },
];
const PKG = Object.fromEntries(PACKAGES.map(p => [p.id.replace('sg-pkg-', ''), p]));

/** Üye → paket. Çeşitlilik bilinçli: biten, bitmek üzere olan, kotalı, PT'li. */
const MEMBER_PLAN = [
  ['platinum', 22], ['gold', 18], ['silver', 5],  ['gold', 27],   ['yillik', 300],
  ['silver', 12],   ['grup8', 40], ['platinum', 9], ['gold', 2],   ['silver', 25],
  ['pt10', 95],     ['gold', 15], ['grup8', 33],  ['silver', -4], ['yillik', 210],
  ['platinum', 28], ['gold', 7],  ['silver', 19], ['pt10', 70],   ['gold', 24],
];

// --------------------------------------------------------------- hareket

// exerciseLibrary.ts'teki Türkçe adlar — anlatım ekranı bu isimden çözüyor.
const PROGRAM_TEMPLATES = [
  { name: 'Tam Vücut Başlangıç', ex: [['Goblet squat',3,12,20],['Göğüs pres (makine)',3,12,30],['Lat pulldown',3,12,35],['Kalça köprüsü',3,15,0],['Plank',3,1,0]] },
  { name: 'Üst Vücut Kuvvet',    ex: [['Bench press',4,6,60],['Barbell row',4,8,50],['Omuz pres',3,8,32],['Barfiks',3,6,0],['Triceps pushdown',3,12,25]] },
  { name: 'Alt Vücut Kuvvet',    ex: [['Back squat',4,6,80],['Romanian deadlift',3,8,70],['Leg press',3,12,120],['Leg curl',3,12,35],['Calf raise',4,15,40]] },
  { name: 'Core ve Duruş',       ex: [['Ölü böcek',3,10,0],['Bird-dog',3,10,0],['Side plank',3,1,0],['Pallof pres',3,12,15],['Yüz çekişi',3,15,20]] },
  { name: 'Yağ Yakım Devresi',   ex: [['Walking lunge',3,20,10],['Step-up',3,12,8],['Hip thrust',3,12,50],['Suitcase carry',3,1,24],['McGill curl-up',3,8,0]] },
  { name: 'Sırt ve Omuz',        ex: [['Chest-supported row',4,10,40],['Tek kol dumbbell row',3,10,26],['Dumbbell reverse fly',3,15,8],['Lateral raise',3,15,7],['Omuz silkme',3,12,45]] },
  { name: 'Kol Odaklı',          ex: [['Biceps curl',4,10,14],['Triceps pushdown',4,12,28],['Incline dumbbell pres',3,10,22],['Barfiks',3,8,0]] },
  { name: 'Isınma ve Mobilite',  ex: [['Kol çevirme',2,15,0],['Kedi-deve',2,10,0],['Bant pull-apart',3,15,0],['Lunge + gövde rotasyonu',2,8,0],['Çene içeri çekme',2,10,0]] },
];

const CLASS_KINDS = [
  { name: 'HIIT Cardio',           dur: 45, cap: 16, trainer: 'antrenor3' },
  { name: 'Fonksiyonel Antrenman', dur: 55, cap: 14, trainer: 'antrenor2' },
  { name: 'Pilates',               dur: 50, cap: 12, trainer: 'antrenor4' },
  { name: 'Boks Temelleri',        dur: 60, cap: 10, trainer: 'antrenor5' },
  { name: 'Kuvvet Kampı',          dur: 60, cap: 12, trainer: 'antrenor1' },
  { name: 'Sabah Esnekliği',       dur: 40, cap: 18, trainer: 'antrenor4' },
];

// ------------------------------------------------------------------- ana

async function resolveUid(person) {
  try {
    const u = await auth.getUserByEmail(person.email);
    if (APPLY) await auth.updateUser(u.uid, { password: DEMO_PASSWORD, displayName: person.name });
    return { uid: u.uid, created: false };
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    if (!APPLY) return { uid: 'DRYRUN_' + person.key, created: true };
    const u = await auth.createUser({ email: person.email, password: DEMO_PASSWORD, displayName: person.name, emailVerified: true });
    return { uid: u.uid, created: true };
  }
}

function build() {
  const T = TENANT_ID;

  // --- salon: adres, iletişim, sınırsız abonelik ---
  put('tenants', T, {
    address: 'Nispetiye Cd. No: 88, Etiler, Beşiktaş / İstanbul',
    cancellationHours: 24,
    subscription: { status: 'active', plan: 'grandfathered', note: 'Tanıtım salonu — ekran görüntüsü, IAP dışı' },
    updatedAt: at(0),
  });
  put('tenants/' + T + '/private', 'contact', {
    phone: '0212 358 88 88',
    email: 'info@supergym88.test',
    updatedAt: at(0),
  });

  // --- paket kataloğu ---
  for (const p of PACKAGES) {
    put('gym_packages', p.id, {
      tenantId: T, name: p.name, kind: p.kind, price: p.price,
      ...(p.durationDays ? { durationDays: p.durationDays } : {}),
      ...(p.lessonCount ? { lessonCount: p.lessonCount, lessonValidityDays: p.lessonValidityDays } : {}),
      entitlements: p.entitlements, sortOrder: p.sortOrder, isActive: true,
      activeAssignmentCount: MEMBER_PLAN.filter(([k]) => k === p.id.replace('sg-pkg-', '')).length,
      createdAt: at(-120),
    });
  }

  put('promotions', 'sg-promo-eylul', {
    tenantId: T, name: 'Eylül Dönüş Kampanyası',
    kind: 'bonusDays', value: 30, appliesTo: ['sg-pkg-yillik'],
    startsAt: at(-10), endsAt: at(20), maxRedemptions: 50, redeemed: 7,
    isActive: true, createdAt: at(-10),
  });
  put('promotions', 'sg-promo-ogrenci', {
    tenantId: T, name: 'Öğrenci İndirimi',
    kind: 'percentDiscount', value: 20, appliesTo: ['sg-pkg-silver', 'sg-pkg-gold'],
    startsAt: at(-60), endsAt: at(90), redeemed: 3,
    isActive: true, createdAt: at(-60),
  });

  // --- üyelikler ---
  for (const p of PEOPLE) {
    const isTrainer = p.key.startsWith('antrenor');
    put('tenant_memberships', T + '_' + p.uid, {
      userId: p.uid, tenantId: T, tenantCode: TENANT_CODE, tenantName: TENANT_NAME,
      roles: [isTrainer ? 'trainer' : 'member'], permissions: isTrainer ? ['checkin'] : [],
      status: 'active', shortCode: p.shortCode,
      userDisplayName: p.name, userEmail: p.email,
      phone: p.phone, birthDate: Timestamp.fromDate(p.birthDate),
      requestedAt: at(-150), approvedAt: at(-150),
      demoSeed: 'supergym-88',
    });
  }

  // --- atanmış paketler, hak önbelleği, krediler ---
  MEMBERS.forEach((m, i) => {
    const [key, daysLeft] = MEMBER_PLAN[i];
    const p = PKG[key];
    const dur = p.durationDays || p.lessonValidityDays;
    const endsAt = at(daysLeft, 23, 59);
    const startsAt = at(daysLeft - dur, 9, 0);
    const status = daysLeft < 0 ? 'expired' : 'active';
    const mpId = 'sg-mp-' + m.key;

    put('member_packages', mpId, {
      tenantId: T, memberId: m.uid, memberName: m.name,
      packageId: p.id, packageName: p.name, kind: p.kind,
      entitlements: p.entitlements, listPrice: p.price, finalPrice: p.price,
      startsAt, endsAt, frozenDays: 0, freezes: [], status,
      paymentId: 'sg-pay-' + m.key, assignedAt: startsAt, assignedBy: 'demo-seed',
      demoSeed: 'supergym-88',
    });

    if (status === 'active') {
      put('member_entitlements', T + '_' + m.uid, {
        tenantId: T, memberId: m.uid, packageId: mpId,
        entitlements: p.entitlements, endsAt, updatedAt: at(0),
      });
    }

    // PT ve grup dersi kotaları
    const pt = p.entitlements.ptLessons;
    if (pt) {
      const used = i % 3;
      put('member_credits', 'sg-cr-pt-' + m.key, {
        tenantId: T, memberId: m.uid, kind: 'ptLesson', source: p.kind === 'lessons' ? 'purchase' : 'entitlement',
        sourcePackageId: mpId, total: pt.count, used,
        startsAt, expiresAt: endsAt, status: used >= pt.count ? 'exhausted' : 'active',
        demoSeed: 'supergym-88',
      });
    }
    const gc = p.entitlements.groupClasses;
    if (gc && !gc.unlimited) {
      const used = i % 4;
      put('member_credits', 'sg-cr-gc-' + m.key, {
        tenantId: T, memberId: m.uid, kind: 'groupClass', source: 'entitlement',
        sourcePackageId: mpId, total: gc.count, used,
        startsAt, expiresAt: endsAt, status: used >= gc.count ? 'exhausted' : 'active',
        demoSeed: 'supergym-88',
      });
    }
  });

  // --- ödeme defteri ---
  MEMBERS.forEach((m, i) => {
    const [key] = MEMBER_PLAN[i];
    const p = PKG[key];
    put('payments', 'sg-pay-' + m.key, {
      tenantId: T, memberId: m.uid, memberName: m.name,
      amount: p.price, method: i % 3 === 0 ? 'cash' : 'bank_transfer',
      status: 'confirmed', kind: 'charge', note: p.name + ' paketi',
      createdAt: at(-40 + i, 11, 0), confirmedAt: at(-40 + i, 11, 30),
      demoSeed: 'supergym-88',
    });
  });
  // yöneticinin onayını bekleyen bildirimler
  [0, 4, 9].forEach((i, n) => {
    const m = MEMBERS[i];
    put('payments', 'sg-pay-pending-' + m.key, {
      tenantId: T, memberId: m.uid, memberName: m.name,
      amount: [850, 1450, 2400][n], method: 'bank_transfer', status: 'pending', kind: 'charge',
      note: 'Havale dekontu gönderildi', createdAt: at(-n - 1, 14, 20),
      demoSeed: 'supergym-88',
    });
  });
  // bir iade
  put('payments', 'sg-pay-refund-1', {
    tenantId: T, memberId: MEMBERS[13].uid, memberName: MEMBERS[13].name,
    amount: 320, method: 'cash', status: 'confirmed', kind: 'refund',
    note: 'Paket düşürme farkı iadesi', createdAt: at(-6, 16, 0), confirmedAt: at(-6, 16, 5),
    demoSeed: 'supergym-88',
  });

  // --- grup dersleri: geçmiş 14 gün + gelecek 14 gün ---
  let clsN = 0;
  for (let d = -14; d <= 14; d++) {
    const dow = new Date(NOW.getTime() + d * DAY).getDay();
    if (dow === 0) continue;                       // pazar kapalı
    const slots = [[CLASS_KINDS[dow % 6], 10], [CLASS_KINDS[(dow + 3) % 6], 19]];
    for (const [kind, hour] of slots) {
      const id = 'sg-cls-' + String(++clsN).padStart(3, '0');
      const tr = byKey[kind.trainer];
      const past = d < 0;
      // katılımcılar: sınırsız grup dersi hakkı olanlardan
      const eligible = MEMBERS.filter((_, i) => {
        const g = PKG[MEMBER_PLAN[i][0]].entitlements.groupClasses;
        return g && g.unlimited;
      });
      const takers = eligible.filter((_, i) => (i + d + hour) % 3 === 0);
      const booked = takers.slice(0, kind.cap);
      const waitlist = takers.slice(kind.cap, kind.cap + 2);
      const doc = {
        tenantId: T, name: kind.name, date: at(d, hour, 0),
        durationMinutes: kind.dur, capacity: kind.cap,
        trainerId: tr.uid, trainerName: tr.name,
        bookedUserIds: booked.map(m => m.uid),
        waitlistUserIds: waitlist.map(m => m.uid),
        createdAt: at(-20), demoSeed: 'supergym-88',
      };
      if (past) {
        doc.attendance = {};
        booked.forEach((m, i) => { doc.attendance[m.uid] = i % 5 === 0 ? 'absent' : 'present'; });
      }
      put('classes', id, doc);
    }
  }
  // tekrarlayan seri: 6 hafta salı 18:30 Kuvvet Kampı
  const seriesTrainer = byKey.antrenor1;
  const daysToTue = (2 - NOW.getDay() + 7) % 7 || 7;
  for (let w = 0; w < 6; w++) {
    put('classes', 'sg-cls-seri-' + (w + 1), {
      tenantId: T, name: 'Kuvvet Kampı (seri)', date: at(daysToTue + w * 7, 18, 30),
      durationMinutes: 60, capacity: 12, seriesId: 'sg-series-kuvvet',
      trainerId: seriesTrainer.uid, trainerName: seriesTrainer.name,
      bookedUserIds: MEMBERS.slice(0, 5).map(m => m.uid), waitlistUserIds: [],
      createdAt: at(-3), demoSeed: 'supergym-88',
    });
  }
  // kotalı üyenin krediyle aldığı yer (bookingCredits)
  const quotaMember = MEMBERS[6];
  put('classes', 'sg-cls-kota', {
    tenantId: T, name: 'Pilates', date: at(3, 11, 0), durationMinutes: 50, capacity: 12,
    trainerId: byKey.antrenor4.uid, trainerName: byKey.antrenor4.name,
    bookedUserIds: [quotaMember.uid], waitlistUserIds: [],
    bookingCredits: { [quotaMember.uid]: 'sg-cr-gc-' + quotaMember.key },
    createdAt: at(-2), demoSeed: 'supergym-88',
  });

  // --- giriş kayıtları ---
  let ciN = 0;
  for (let d = -13; d <= 0; d++) {
    MEMBERS.filter((_, i) => (i + d) % 4 === 0).forEach((m, j) => {
      const [key, daysLeft] = MEMBER_PLAN[MEMBERS.indexOf(m)];
      put('checkins', 'sg-ci-' + String(++ciN).padStart(3, '0'), {
        tenantId: T, userId: m.uid, membershipId: T + '_' + m.uid,
        accessReason: daysLeft < 0 ? 'no-package' : 'ok',
        checkedInAt: at(d, 8 + (j % 12), (j * 7) % 60),
        demoSeed: 'supergym-88',
      });
    });
  }

  // --- programlar ---
  MEMBERS.forEach((m, i) => {
    if (i % 5 === 4) return;                       // herkeste program olmasın
    const t = PROGRAM_TEMPLATES[i % PROGRAM_TEMPLATES.length];
    const tr = TRAINERS[i % TRAINERS.length];
    put('programs', 'sg-prg-' + m.key, {
      tenantId: T, memberId: m.uid, memberName: m.name,
      trainerId: tr.uid, name: t.name, status: 'active',
      exercises: t.ex.map(([name, sets, reps, kg], n) => ({
        id: 'sg-ex-' + m.key + '-' + n, name, sets, reps, targetWeightKg: kg,
      })),
      createdAt: at(-45 + i), updatedAt: at(-7 + (i % 5)),
      demoSeed: 'supergym-88',
    });
  });
  // bir de taslak
  put('programs', 'sg-prg-taslak', {
    tenantId: T, memberId: MEMBERS[4].uid, memberName: MEMBERS[4].name,
    trainerId: TRAINERS[1].uid, name: 'Yeni Dönem (taslak)', status: 'draft',
    exercises: [{ id: 'sg-ex-draft-0', name: 'Back squat', sets: 4, reps: 8, targetWeightKg: 70 }],
    createdAt: at(-2), updatedAt: at(-1), demoSeed: 'supergym-88',
  });

  // --- antrenman kayıtları ---
  let wlN = 0;
  MEMBERS.forEach((m, i) => {
    if (i % 5 === 4) return;
    const t = PROGRAM_TEMPLATES[i % PROGRAM_TEMPLATES.length];
    const sessions = 2 + (i % 4);
    for (let s = 0; s < sessions; s++) {
      const d = -(3 + s * 4 + (i % 3));
      const startedAt = at(d, 18, 15);
      put('workout_logs', 'sg-wl-' + String(++wlN).padStart(3, '0'), {
        tenantId: T, memberId: m.uid, programId: 'sg-prg-' + m.key, programName: t.name,
        startedAt,
        completedAt: Timestamp.fromMillis(startedAt.toMillis() + (48 + Math.floor(between(0, 20))) * 60000),
        exerciseLogs: t.ex.map(([name, sets, , kg], n) => ({
          exerciseId: 'sg-ex-' + m.key + '-' + n, name,
          setsTarget: sets, setsCompleted: sets - (n === 0 && s === 0 ? 1 : 0),
          weightKg: Math.max(0, Math.round(kg * (0.9 + s * 0.04))),
          durationSeconds: 180 + Math.floor(between(0, 240)),
        })),
        demoSeed: 'supergym-88',
      });
    }
  });

  // --- ölçümler: grafik için aylık seri ---
  let msN = 0;
  MEMBERS.forEach((m, i) => {
    if (i % 3 !== 0) return;
    let w = between(58, 96);
    let waist = w * 0.85;
    for (let k = 5; k >= 0; k--) {
      w -= between(0.2, 1.1); waist -= between(0.1, 0.9);
      put('measurements', 'sg-ms-' + String(++msN).padStart(3, '0'), {
        tenantId: T, memberId: m.uid,
        weightKg: round1(w), chestCm: round1(w * 1.05 + 30),
        waistCm: round1(waist), armCm: round1(w * 0.36 + 5),
        recordedAt: at(-k * 30, 9, 0),
        demoSeed: 'supergym-88',
      });
    }
  });

  // --- PT randevuları + gizlilik aynası ---
  let ptN = 0;
  MEMBERS.forEach((m, i) => {
    const p = PKG[MEMBER_PLAN[i][0]];
    if (!p.entitlements.ptLessons) return;
    const tr = TRAINERS[i % TRAINERS.length];
    [-9, -2, 4, 11].forEach((d, s) => {
      const id = 'sg-pt-' + String(++ptN).padStart(3, '0');
      const date = at(d, 9 + ((i + s) % 8), (s % 2) * 30);
      const status = d < 0 ? (s === 0 ? 'completed' : 'completed') : 'scheduled';
      put('pt_sessions', id, {
        tenantId: T, trainerId: tr.uid, trainerName: tr.name,
        memberId: m.uid, memberName: m.name,
        date, durationMinutes: 60, status,
        creditId: 'sg-cr-pt-' + m.key,
        createdAt: at(-20), updatedAt: at(-20),
        demoSeed: 'supergym-88',
      });
      put('trainer_busy_slots', id, {
        tenantId: T, trainerId: tr.uid, date, durationMinutes: 60, status,
      });
    });
  });
  // bir iptal
  put('pt_sessions', 'sg-pt-iptal', {
    tenantId: T, trainerId: TRAINERS[2].uid, trainerName: TRAINERS[2].name,
    memberId: MEMBERS[10].uid, memberName: MEMBERS[10].name,
    date: at(-1, 15, 0), durationMinutes: 60, status: 'cancelled',
    createdAt: at(-12), updatedAt: at(-2), demoSeed: 'supergym-88',
  });

  // --- antrenör çalışma saatleri ---
  const SHIFTS = [
    { mon: [['08:00', '16:00']], tue: [['08:00', '16:00']], wed: [['08:00', '16:00']], thu: [['08:00', '16:00']], fri: [['08:00', '14:00']] },
    { mon: [['10:00', '19:00']], wed: [['10:00', '19:00']], fri: [['10:00', '19:00']], sat: [['09:00', '14:00']] },
    { tue: [['07:00', '13:00']], thu: [['07:00', '13:00']], sat: [['08:00', '13:00']] },
    { mon: [['09:00', '13:00'], ['17:00', '21:00']], tue: [['09:00', '13:00']], thu: [['17:00', '21:00']], fri: [['09:00', '13:00']] },
    { tue: [['16:00', '22:00']], wed: [['16:00', '22:00']], thu: [['16:00', '22:00']], sat: [['10:00', '15:00']] },
  ];
  TRAINERS.forEach((t, i) => {
    const weekly = {};
    for (const [day, wins] of Object.entries(SHIFTS[i])) {
      weekly[day] = wins.map(([start, end]) => ({ start, end }));
    }
    put('trainer_availability', T + '_' + t.uid, {
      tenantId: T, trainerId: t.uid, weekly, slotMinutes: 60, exceptions: [], updatedAt: at(-5),
    });
  });

  // --- takvim paylaşımı ---
  put('calendar_shares', T + '_' + TRAINERS[0].uid + '_' + TRAINERS[1].uid, {
    tenantId: T, ownerTrainerId: TRAINERS[0].uid, ownerTrainerName: TRAINERS[0].name,
    viewerTrainerId: TRAINERS[1].uid, createdAt: at(-8),
  });
}

// ------------------------------------------------------------------- akış

async function purge() {
  const cols = ['tenant_memberships', 'classes', 'checkins', 'programs', 'workout_logs',
    'measurements', 'payments', 'gym_packages', 'promotions', 'member_packages',
    'member_credits', 'member_entitlements', 'pt_sessions', 'trainer_availability',
    'trainer_busy_slots', 'calendar_shares'];
  let n = 0;
  for (const c of cols) {
    const snap = await db.collection(c).where('tenantId', '==', TENANT_ID).get();
    const doomed = snap.docs.filter(d => d.id.startsWith('sg-') || d.data().demoSeed === 'supergym-88');
    for (let i = 0; i < doomed.length; i += 400) {
      const b = db.batch();
      doomed.slice(i, i + 400).forEach(d => b.delete(d.ref));
      if (APPLY) await b.commit();
    }
    n += doomed.length;
    if (doomed.length) console.log('  ' + c + ': ' + doomed.length);
  }
  console.log((APPLY ? 'Silindi: ' : 'Silinecek: ') + n + ' doküman');
}

async function run() {
  console.log('SUPERGYM-88 demo verisi — ' + (APPLY ? 'YAZILIYOR' : 'KURU ÇALIŞTIRMA (--apply ile yaz)'));
  console.log('Salon: ' + TENANT_ID + ' (' + TENANT_CODE + ')\n');

  if (PURGE) { await purge(); return; }

  console.log('Auth hesapları...');
  let created = 0;
  for (const p of PEOPLE) {
    const r = await resolveUid(p);
    p.uid = r.uid;
    if (r.created) created++;
  }
  console.log('  ' + PEOPLE.length + ' hesap (' + created + ' yeni), parola: ' + DEMO_PASSWORD + '\n');

  build();

  const perCol = {};
  writes.forEach(w => { perCol[w.col] = (perCol[w.col] || 0) + 1; });
  console.log('Firestore yazımları:');
  Object.entries(perCol).sort().forEach(([c, n]) => console.log('  ' + c.padEnd(24) + n));
  console.log('  ' + 'TOPLAM'.padEnd(24) + writes.length + '\n');

  if (!APPLY) { console.log('Kuru çalıştırma — hiçbir şey yazılmadı.'); return; }

  // mevcut sıfır fiyatlı katalog kalıntılarını pasifle (silmeden)
  const stray = await db.collection('gym_packages').where('tenantId', '==', TENANT_ID).get();
  const strayDocs = stray.docs.filter(d => !d.id.startsWith('sg-'));
  if (strayDocs.length) {
    const b = db.batch();
    strayDocs.forEach(d => b.update(d.ref, { isActive: false }));
    await b.commit();
    console.log('Eski katalog pasifleştirildi: ' + strayDocs.length + ' paket');
  }

  for (let i = 0; i < writes.length; i += 400) {
    const b = db.batch();
    for (const w of writes.slice(i, i + 400)) {
      const parts = w.col.split('/');
      const ref = parts.length === 1 ? db.collection(w.col).doc(w.id)
        : db.collection(parts[0]).doc(parts[1]).collection(parts[2]).doc(w.id);
      b.set(ref, w.data, { merge: true });
    }
    await b.commit();
    process.stdout.write('.');
  }
  console.log('\nBitti.');
}

run().catch(e => { console.error(e); process.exit(1); });
