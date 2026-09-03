import * as admin from 'firebase-admin';
import { beforeEach, describe, expect, it } from 'vitest';

import { freezeMemberPackage, sweepPackageStatuses } from '../src/packages';
import { clearFirestore, timestampDaysFromNow } from './helpers';

const TENANT = 't1';
const ADMIN = 'admin1';
const MEMBER = 'm1';

async function seedAdmin() {
  await admin.firestore().doc(`tenant_memberships/${TENANT}_${ADMIN}`).set({
    tenantId: TENANT, userId: ADMIN, status: 'active', roles: ['admin'],
  });
}

async function seedPackage(overrides: Record<string, unknown> = {}) {
  const ref = admin.firestore().collection('member_packages').doc('pkg1');
  await ref.set({
    tenantId: TENANT, memberId: MEMBER, memberName: 'Üye',
    packageName: 'Gold', kind: 'membership',
    entitlements: { gymAccess: true },
    status: 'active',
    endsAt: timestampDaysFromNow(60),
    frozenDays: 0, freezes: [],
    freezePolicy: { minDays: 15, maxCount: 2 },
    ...overrides,
  });
  return ref;
}

const call = (data: unknown, uid = ADMIN) =>
  freezeMemberPackage.run({ auth: { uid }, data } as never);

describe('freezeMemberPackage', () => {
  beforeEach(async () => {
    await clearFirestore();
    await seedAdmin();
  });

  it('bitiş tarihini tam dondurma süresi kadar öteler — üye gününü kaybetmez', async () => {
    const ref = await seedPackage();
    const before = (await ref.get()).data()!.endsAt.toMillis();

    await call({ assignmentId: 'pkg1', days: 20 });

    const after = (await ref.get()).data()!;
    expect(after.status).toBe('frozen');
    expect(after.endsAt.toMillis() - before).toBe(20 * 86400000);
    expect(after.frozenDays).toBe(20);
    expect(after.freezes).toHaveLength(1);
  });

  it('paketten gelen kredilerin son kullanma tarihini de öteler', async () => {
    await seedPackage();
    const creditRef = admin.firestore().collection('member_credits').doc('c1');
    await creditRef.set({
      tenantId: TENANT, memberId: MEMBER, kind: 'ptLesson', source: 'entitlement',
      sourcePackageId: 'pkg1', total: 4, used: 0, status: 'active',
      expiresAt: timestampDaysFromNow(30),
    });
    const before = (await creditRef.get()).data()!.expiresAt.toMillis();

    await call({ assignmentId: 'pkg1', days: 15 });

    const after = (await creditRef.get()).data()!.expiresAt.toMillis();
    // Dondururken banked dersini kaybetmek duraklatmanın tersi olurdu.
    expect(after - before).toBe(15 * 86400000);
  });

  it('kota dolduysa reddeder', async () => {
    await seedPackage({
      freezePolicy: { minDays: 15, maxCount: 1 },
      freezes: [{ startsAt: timestampDaysFromNow(-40), endsAt: timestampDaysFromNow(-20), days: 20, createdBy: ADMIN, createdAt: timestampDaysFromNow(-40) }],
    });
    await expect(call({ assignmentId: 'pkg1', days: 20 })).rejects.toThrow(/hakkı doldu/);
  });

  it('asgari süreden kısa dondurmayı reddeder', async () => {
    await seedPackage();
    await expect(call({ assignmentId: 'pkg1', days: 5 })).rejects.toThrow(/En az 15 gün/);
  });

  it('dondurma hakkı olmayan pakette reddeder', async () => {
    const ref = await seedPackage();
    await ref.update({ freezePolicy: admin.firestore.FieldValue.delete() });
    await expect(call({ assignmentId: 'pkg1', days: 20 })).rejects.toThrow(/dondurma hakkı yok/);
  });

  it('ders paketini dondurmaz — politika üyelik için', async () => {
    await seedPackage({ kind: 'lessons' });
    await expect(call({ assignmentId: 'pkg1', days: 20 })).rejects.toThrow(/üyelik paketi/);
  });

  it('sonlandırılmış paketi dondurmaz', async () => {
    await seedPackage({ cancelledAt: admin.firestore.Timestamp.now() });
    await expect(call({ assignmentId: 'pkg1', days: 20 })).rejects.toThrow(/Sonlandırılmış/);
  });

  it('yönetici olmayanı reddeder', async () => {
    await seedPackage();
    await expect(call({ assignmentId: 'pkg1', days: 20 }, MEMBER)).rejects.toThrow(/yönetici/);
  });
});

describe('sweepPackageStatuses', () => {
  beforeEach(async () => {
    await clearFirestore();
  });

  it('süresi biten dondurmayı çözer — yoksa duraklatma kalıcı olurdu', async () => {
    const ref = admin.firestore().collection('member_packages').doc('pkg1');
    await ref.set({
      tenantId: TENANT, memberId: MEMBER, kind: 'membership', status: 'frozen',
      endsAt: timestampDaysFromNow(30),
      freezes: [{ startsAt: timestampDaysFromNow(-20), endsAt: timestampDaysFromNow(-1), days: 19, createdBy: ADMIN, createdAt: timestampDaysFromNow(-20) }],
    });

    await sweepPackageStatuses.run({} as never);

    expect((await ref.get()).data()!.status).toBe('active');
  });

  it('dondurması süren paketi çözmez', async () => {
    const ref = admin.firestore().collection('member_packages').doc('pkg1');
    await ref.set({
      tenantId: TENANT, memberId: MEMBER, kind: 'membership', status: 'frozen',
      endsAt: timestampDaysFromNow(30),
      freezes: [{ startsAt: timestampDaysFromNow(-2), endsAt: timestampDaysFromNow(10), days: 12, createdBy: ADMIN, createdAt: timestampDaysFromNow(-2) }],
    });

    await sweepPackageStatuses.run({} as never);

    expect((await ref.get()).data()!.status).toBe('frozen');
  });

  it('kendi paketinden uzun yaşayan dondurma doğrudan süresi dolmuşa geçer', async () => {
    const ref = admin.firestore().collection('member_packages').doc('pkg1');
    await ref.set({
      tenantId: TENANT, memberId: MEMBER, kind: 'membership', status: 'frozen',
      endsAt: timestampDaysFromNow(-3),
      freezes: [{ startsAt: timestampDaysFromNow(-20), endsAt: timestampDaysFromNow(-1), days: 19, createdBy: ADMIN, createdAt: timestampDaysFromNow(-20) }],
    });

    await sweepPackageStatuses.run({} as never);

    expect((await ref.get()).data()!.status).toBe('expired');
  });

  it('süresi geçmiş aktif paketi süresi dolmuş yapar', async () => {
    const ref = admin.firestore().collection('member_packages').doc('pkg2');
    await ref.set({
      tenantId: TENANT, memberId: MEMBER, kind: 'membership', status: 'active',
      endsAt: timestampDaysFromNow(-1), freezes: [],
    });

    await sweepPackageStatuses.run({} as never);

    expect((await ref.get()).data()!.status).toBe('expired');
  });
});
