'use strict';

// Writes `tenants.activeAdminCount` for every gym (yönetici sınırı, 3).
//
// The tally is maintained by `syncActiveMemberCount` from now on, but that
// trigger only fires on membership writes — a gym whose memberships never
// change again would carry no counter at all. The rule reads a missing
// counter as "under the limit" (so nobody is locked out), which for a gym
// that ALREADY has three admins means a fourth would be accepted. This puts
// the true number on every tenant once, so the cap holds from day one.
//
// Idempotent: writes only when the stored value differs from the count.
//
// Usage:
//   node scripts/backfill_active_admin_count.cjs          (dry run)
//   node scripts/backfill_active_admin_count.cjs --apply  (writes)

const fs = require('fs');
const path = require('path');
const { cert, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../secrets/serviceAccount.json');
const apply = process.argv.includes('--apply');

async function main() {
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))) });
  const db = getFirestore();

  const tenants = await db.collection('tenants').get();
  let changed = 0;
  for (const t of tenants.docs) {
    const countSnap = await db
      .collection('tenant_memberships')
      .where('tenantId', '==', t.id)
      .where('status', '==', 'active')
      .where('roles', 'array-contains', 'admin')
      .count()
      .get();
    const trueCount = countSnap.data().count;
    const stored = t.data().activeAdminCount;
    const mark = stored === trueCount ? '=' : '→';
    console.log(`${t.data().code || t.id}: activeAdminCount ${stored ?? '(yok)'} ${mark} ${trueCount}`);
    if (stored === trueCount) continue;
    changed += 1;
    if (apply) await t.ref.set({ activeAdminCount: trueCount }, { merge: true });
  }
  console.log(`\n${changed} salon ${apply ? 'güncellendi' : 'güncellenecek (--apply ile yaz)'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
