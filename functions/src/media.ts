import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';

const MAX_BYTES = 1024 * 1024; // the client sends 512x512 JPEG; this is headroom

/**
 * A member's own photo (PER-20). Same shape as `uploadTenantLogo` and for
 * the same reason: the Storage rule stays closed and membership is checked
 * in code. The object gets a download token so the URL itself grants read
 * access — the roster (staff of the gym) renders it, and nothing needs a
 * cross-service rule. Replacing the photo mints a new token; the old URL
 * dies with the old object.
 */
export const uploadMemberPhoto = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');
  const base64 = String(request.data?.base64 ?? '');
  if (!base64) throw new HttpsError('invalid-argument', 'Görsel gerekiyor.');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.byteLength === 0) throw new HttpsError('invalid-argument', 'Görsel okunamadı.');
  if (buffer.byteLength > MAX_BYTES) throw new HttpsError('invalid-argument', 'Görsel çok büyük.');

  const bucket = admin.storage().bucket();
  const objectPath = `members/${uid}/avatar.jpg`;
  const token = randomUUID();
  await bucket.file(objectPath).save(buffer, {
    contentType: 'image/jpeg',
    metadata: { cacheControl: 'public, max-age=3600', metadata: { firebaseStorageDownloadTokens: token } },
    resumable: false,
  });
  const url =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
    `/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
  return { url };
});

/** The member removes their photo: object gone, token gone, URL dead. */
export const deleteMemberPhoto = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');
  await admin.storage().bucket().file(`members/${uid}/avatar.jpg`).delete({ ignoreNotFound: true });
  return { ok: true };
});

/** Used by `deleteMyAccount`'s cascade — a deleted account leaves no photo behind. */
export async function deleteMemberPhotoObject(uid: string): Promise<void> {
  await admin.storage().bucket().file(`members/${uid}/avatar.jpg`).delete({ ignoreNotFound: true });
}
