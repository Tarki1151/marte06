import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/** 512×512 JPEG is what the client sends; this is headroom, not a target. */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Uploads a gym's logo (ADMIN, PKG-branding).
 *
 * **Why a callable and not a direct Storage write.** The Storage rule that
 * used to guard `tenant-logos/{tenantId}` authorised the caller by reading
 * their `tenant_memberships` document — a cross-service rule. That turned out
 * to be the wrong foundation for three reasons, all of which cost real time
 * to find:
 *
 * 1. It fails **closed and silent**. The client gets `storage/unauthorized`
 *    with no indication that a Firestore lookup inside a rule was the thing
 *    that failed.
 * 2. It needs an IAM grant (`roles/firebaserules.firestoreServiceAgent` on
 *    the Firebase Rules service agent) that `firebase deploy` does not make,
 *    so the rule can be correct and still deny everyone.
 * 3. It had been silently broken since the singular `role` field was dropped
 *    (27 Aug 2026) and nobody noticed, because the only account that ever
 *    tested it carried the legacy global `admin` claim and passed through a
 *    different branch. A real gym owner has no such claim — SCHEMA.md is
 *    explicit that the global claim is not valid for GymEntra — so logo
 *    upload had never worked for an actual customer.
 *
 * Checking membership in code is the same pattern every other operation the
 * rules cannot arbitrate already uses, and it is testable against the
 * emulator instead of only against production.
 *
 * The object is written at a deterministic path so a re-upload replaces the
 * previous logo rather than accumulating orphans, and the returned URL is the
 * plain `?alt=media` download URL — the bucket's read rule is public, which
 * is deliberate: members of every gym render each other's logos from the join
 * screen before any membership exists.
 */
export const uploadTenantLogo = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');

  const tenantId = String(request.data?.tenantId ?? '');
  const base64 = String(request.data?.base64 ?? '');
  const contentType = String(request.data?.contentType ?? 'image/jpeg');
  if (!tenantId || !base64) throw new HttpsError('invalid-argument', 'Salon ve görsel gerekiyor.');
  if (!contentType.startsWith('image/')) {
    throw new HttpsError('invalid-argument', 'Yalnızca görsel yüklenebilir.');
  }

  const db = admin.firestore();
  const membershipSnap = await db.doc(`tenant_memberships/${tenantId}_${uid}`).get();
  const membership = membershipSnap.data();
  if (!membershipSnap.exists || membership?.status !== 'active' || !(membership?.roles ?? []).includes('admin')) {
    throw new HttpsError('permission-denied', 'Bu işlem için salon yöneticisi olmanız gerekiyor.');
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.byteLength === 0) throw new HttpsError('invalid-argument', 'Görsel okunamadı.');
  if (buffer.byteLength > MAX_BYTES) {
    throw new HttpsError('invalid-argument', 'Görsel çok büyük. Daha küçük bir logo seç.');
  }

  const bucket = admin.storage().bucket();
  const objectPath = `tenant-logos/${tenantId}`;
  await bucket.file(objectPath).save(buffer, {
    contentType,
    // Overwrites keep serving through the same URL, so the cached copy in
    // every member's app has to be allowed to go stale for at most an hour.
    metadata: { cacheControl: 'public, max-age=3600' },
    resumable: false,
  });

  const url =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
    `/o/${encodeURIComponent(objectPath)}?alt=media`;
  return { url };
});
