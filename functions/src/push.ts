import * as admin from 'firebase-admin';

/**
 * What a notification is *about*, so the person can turn off the kinds they
 * do not want without losing the ones they need (P4-3).
 *
 * Deliberately few and phrased from the reader's side. A category per sending
 * site would be a settings screen nobody reads; these are the five answers to
 * "why is my phone buzzing".
 */
export type NotificationCategory =
  /** Randevu ve ders: iptal, bekleme listesinden yer açılması, hatırlatıcı. */
  | 'bookings'
  /** Paket: teklif, bitiş uyarısı, sonlandırma. */
  | 'packages'
  /** Ödeme defteri hareketleri. */
  | 'payments'
  /** Antrenörün yazdığı program. */
  | 'programs'
  /** Salon duyuruları — "yarın kapalıyız", yeni ders, kampanya. */
  | 'announcements'
  /**
   * Ebeveyn onayı ve hesap güvenliği. **Kapatılamaz** — bunlar rıza ve
   * erişim akışları, bildirim değil; susturulursa akış tamamlanamaz.
   */
  | 'account';

/** Kapatılabilir kategoriler — `account` bilerek dışarıda. */
export const MUTABLE_CATEGORIES: NotificationCategory[] = [
  'bookings',
  'packages',
  'payments',
  'programs',
  'announcements',
];

/**
 * Whether this person still wants this kind of notification.
 *
 * Absent settings, an absent `push` map and an absent key all mean **yes**:
 * everyone who has never opened the preferences screen keeps receiving
 * everything, which is the only safe reading of "no answer recorded".
 */
async function wantsCategory(userId: string, category: NotificationCategory): Promise<boolean> {
  if (category === 'account') return true;
  const snap = await admin.firestore().doc(`user_settings/${userId}`).get();
  const prefs = snap.data()?.push as Record<string, boolean> | undefined;
  return prefs?.[category] !== false;
}

/**
 * Looks up every registered device for a user and pushes to all of them via
 * Expo's push service. Best-effort: a user with no tokens (never opened the
 * app, denied permission, simulator-only) is a silent no-op, not an error.
 *
 * `category` is required rather than optional on purpose: a new sending site
 * has to say what it is, or it cannot be switched off and the preferences
 * screen quietly starts lying about what it controls.
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown> | undefined,
  category: NotificationCategory,
) {
  if (!(await wantsCategory(userId, category))) {
    console.log(`Push to ${userId} skipped — ${category} kapalı`);
    return;
  }
  const tokensSnap = await admin.firestore().collection('push_tokens').where('userId', '==', userId).get();
  if (tokensSnap.empty) return;

  const messages = tokensSnap.docs.map((tokenDoc) => ({
    to: tokenDoc.id,
    title,
    body,
    sound: 'default',
    ...(data ? { data } : {}),
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = (await response.json().catch(() => null)) as
    | { data?: { status?: string; details?: { error?: string } }[] }
    | null;
  console.log(`Push to ${userId} (${messages.length} device(s)):`, JSON.stringify(result));

  // Expo answers per message, in the order we sent them. A DeviceNotRegistered
  // error means the app was uninstalled or the token was revoked — keeping it
  // costs a wasted request on every future push and the row never expires on
  // its own, so drop it here.
  const tickets = result?.data ?? [];
  const dead = tickets
    .map((ticket, i) => (ticket?.details?.error === 'DeviceNotRegistered' ? tokensSnap.docs[i] : null))
    .filter((doc): doc is (typeof tokensSnap.docs)[number] => doc != null);

  if (dead.length > 0) {
    const batch = admin.firestore().batch();
    dead.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Removed ${dead.length} dead push token(s) for ${userId}`);
  }
}

