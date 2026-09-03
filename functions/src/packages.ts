import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import { notifyTenantAdmins } from './notifications';
import { sendPushToUser } from './push';

/**
 * GymEntra (PKG-2, plan-eng-review Faz 1.2+1.3): expires every past-due
 * credit and, for entitlement-sourced ones, rolls them into their next
 * period — in one job, one transaction per credit.
 *
 * Two bugs this replaces:
 * 1. The old `renewEntitlementCredits` queried `status == 'active'` only,
 *    so a credit a member had just spent down to `exhausted` (e.g. by
 *    booking their last PT session) silently stopped renewing forever —
 *    the member who used the product lost the right; the member who never
 *    touched it kept renewing. Querying `status in ['active','exhausted']`
 *    fixes this.
 * 2. The old job expired the source credit and `add()`ed its successor as
 *    two separate awaited writes — a crash between them silently deleted
 *    the member's entitlement (old marked expired, new never created).
 *    Here both happen in one `runTransaction`, and the successor's id is
 *    deterministic (`${creditId}_next`) so a retried/redelivered run
 *    overwrites the same document instead of minting a second one.
 *
 * Runs daily rather than exactly at each credit's `expiresAt` — a day of
 * slop is fine here (screens compare `expiresAt` against "now" themselves,
 * per AGENTS.md's read-time-check discipline, so a credit already reads as
 * expired before this catches up) and daily keeps the read volume small
 * regardless of how many gyms are on the platform.
 *
 * Only `source === 'entitlement'` credits roll forward — a purchased
 * lesson bundle (`source === 'purchase'`) is a one-time buy and just
 * expires, same as today.
 */
export const creditRollover = onSchedule(
  { schedule: 'every 24 hours', region: 'europe-west1', timeZone: 'Europe/Istanbul' },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    const dueSnap = await db
      .collection('member_credits')
      .where('status', 'in', ['active', 'exhausted'])
      .where('expiresAt', '<=', now)
      .get();

    if (dueSnap.empty) return;

    let expired = 0;
    let renewed = 0;
    let skipped = 0;
    for (const creditDoc of dueSnap.docs) {
      const credit = creditDoc.data();
      const successorRef = db.collection('member_credits').doc(`${creditDoc.id}_next`);

      // The transaction returns its outcome rather than incrementing the
      // counters itself — Firestore retries this callback on contention,
      // and mutating closure state inside a retried callback would
      // double-count on every retry.
      const outcome = await db.runTransaction(async (tx) => {
        // Every read this transaction needs, before any write — Firestore
        // requires reads first.
        const assignmentSnap = credit.source === 'entitlement' ? await tx.get(db.doc(`member_packages/${credit.sourcePackageId}`)) : null;

        tx.update(creditDoc.ref, { status: 'expired' });

        if (credit.source !== 'entitlement') return 'skipped' as const;

        const assignment = assignmentSnap?.data();
        if (!assignment || assignment.status !== 'active' || assignment.endsAt.toMillis() <= now.toMillis()) return 'skipped' as const;

        const entitlement = credit.kind === 'ptLesson' ? assignment.entitlements?.ptLessons : assignment.entitlements?.groupClasses;
        if (!entitlement?.count || !entitlement?.periodDays) {
          // The catalog content changed underneath an old assignment
          // (shouldn't happen — gym_packages locks while assigned — but an
          // assignment outlives that lock if the package was retired
          // mid-term). Stop quietly rather than crash the whole batch over
          // one holder.
          return 'skipped' as const;
        }

        const nextExpiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + entitlement.periodDays * 86400000);
        tx.set(successorRef, {
          tenantId: credit.tenantId,
          memberId: credit.memberId,
          kind: credit.kind,
          source: 'entitlement',
          sourcePackageId: credit.sourcePackageId,
          total: entitlement.count,
          used: 0,
          startsAt: now,
          expiresAt: nextExpiresAt,
          status: 'active',
        });
        return 'renewed' as const;
      });

      expired += 1;
      if (outcome === 'renewed') renewed += 1;
      else skipped += 1;
    }

    console.log(`Credit rollover: ${expired} expired, ${renewed} renewed, ${skipped} skipped (${dueSnap.size} due)`);
  },
);

function addDaysMs(date: FirebaseFirestore.Timestamp, days: number): FirebaseFirestore.Timestamp {
  return admin.firestore.Timestamp.fromMillis(date.toMillis() + days * 86400000);
}

/**
 * GymEntra (PKG-6, plan-eng-review Faz 1.6): the only thing that ever
 * touches `member_packages` for a *change* to an already-holding member.
 * Everything downstream of a member's decision (cancelling the old
 * holding, creating the new one, moving credits, redeeming a promotion,
 * recording a refund) needs trust `member_packages`' own rule refuses to
 * grant to any client, admin included. This is the one place that trust
 * exists — the rule now closes the member's `status` field entirely (see
 * `firestore.rules`), so this callable is the *only* way a
 * `package_change_requests` doc moves out of `pending`, approve or reject.
 *
 * Was a `package_change_requests` `onDocumentUpdated` trigger. Rewritten as
 * a callable for a concrete failure this had: the trigger ran *after* the
 * member's own `status: 'approved'` write already succeeded, so a member
 * saw "Teklifi onayladın" the instant their write landed — before the swap
 * (or its failure) was known. If the trigger then threw or never ran, the
 * request sat "approved" forever with nothing actually applied. Here the
 * member's approval and the swap are the same transaction; success is
 * only ever reported once the package genuinely changed.
 *
 * Fixes folded in from this review's outside-voice pass (Codex #6–#10, #14):
 * - #7 tenant boundary — every referenced doc (package, promotion, the
 *   assignment being replaced) is checked against the request's own
 *   `tenantId`, not assumed.
 * - #8/#14 double-approval — if `currentPackageAssignmentId` is set, it
 *   must still read `status == 'active'` inside this transaction. A second
 *   request racing (or a stale retry) that targets an assignment some
 *   other approval already cancelled fails loudly instead of minting a
 *   second active package on top of it.
 * - #9 stranded credits — the assignment being replaced has its own
 *   `member_credits` cancelled here, not left `active` alongside the new
 *   package's fresh credits (which used to let a member spend both).
 * - #10 promotion expiring between offer and approval: the OLD behavior
 *   silently dropped the bonus and applied the swap at full price — a
 *   member who approved 500₺ could be charged 750₺ without ever agreeing
 *   to it. Now: if the offer named a promotion and it's no longer valid,
 *   the WHOLE approval is refused, the request is marked `expired`, and
 *   the admin is asked to re-propose with a current price.
 *
 * Idempotent by construction: approving reads the request's own `status`
 * inside the transaction and requires `pending`, so a redelivered/retried
 * client call (or a second concurrent tap) reads `approved` on retry and is
 * rejected before it can touch anything else.
 */
export const approvePackageChange = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');

    const { requestId, approve } = request.data as { requestId?: string; approve?: boolean };
    if (!requestId || typeof approve !== 'boolean') throw new HttpsError('invalid-argument', 'Eksik bilgi.');

    const db = admin.firestore();
    const requestRef = db.doc(`package_change_requests/${requestId}`);

    const result = await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(requestRef);
      if (!reqSnap.exists) throw new HttpsError('not-found', 'Teklif bulunamadı.');
      const req = reqSnap.data()!;
      if (req.memberId !== uid) throw new HttpsError('permission-denied', 'Bu teklif sana ait değil.');
      if (req.status !== 'pending') throw new HttpsError('failed-precondition', 'Bu teklif zaten yanıtlandı.');

      const now = admin.firestore.Timestamp.now();

      if (!approve) {
        tx.update(requestRef, { status: 'rejected', respondedAt: now });
        return { status: 'rejected' as const };
      }

      const proposedPkgSnap = await tx.get(db.doc(`gym_packages/${req.proposedPackageId}`));
      if (!proposedPkgSnap.exists || proposedPkgSnap.data()!.tenantId !== req.tenantId) {
        throw new HttpsError('failed-precondition', 'Önerilen paket artık mevcut değil.');
      }
      const proposedPkg = proposedPkgSnap.data()!;

      let currentSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (req.currentPackageAssignmentId) {
        currentSnap = await tx.get(db.doc(`member_packages/${req.currentPackageAssignmentId}`));
        const current = currentSnap.data();
        if (!currentSnap.exists || current!.tenantId !== req.tenantId || current!.memberId !== req.memberId) {
          throw new HttpsError('failed-precondition', 'Değiştirilecek paket bu üyeye veya salona ait değil.');
        }
        if (current!.status !== 'active') {
          // Another approval already replaced this holding (Codex #8) —
          // approving this stale request on top of it would mint a second
          // active package instead of failing.
          throw new HttpsError('failed-precondition', 'Bu paket zaten değiştirilmiş — teklif artık geçersiz.');
        }
      }

      // Credits tied to the holding being replaced must not survive
      // alongside the new package's fresh ones (Codex #9) — collected now,
      // cancelled together with everything else below.
      const oldCreditsSnap = req.currentPackageAssignmentId
        ? await tx.get(db.collection('member_credits').where('sourcePackageId', '==', req.currentPackageAssignmentId).where('status', 'in', ['active', 'exhausted']))
        : null;

      let promotion: FirebaseFirestore.DocumentData | null = null;
      let promotionRef: FirebaseFirestore.DocumentReference | null = null;
      if (req.proposedPromotionId) {
        promotionRef = db.doc(`promotions/${req.proposedPromotionId}`);
        const promoSnap = await tx.get(promotionRef);
        const promo = promoSnap.data();
        const valid =
          promoSnap.exists &&
          promo!.tenantId === req.tenantId &&
          promo!.isActive &&
          promo!.startsAt.toMillis() <= now.toMillis() &&
          promo!.endsAt.toMillis() >= now.toMillis() &&
          (promo!.maxRedemptions == null || (promo!.redeemed ?? 0) < promo!.maxRedemptions);

        if (!valid) {
          // Codex #10: the promotion the member approved is gone — refuse
          // the whole swap rather than silently charging full price for
          // something they agreed to at a discount.
          tx.update(requestRef, { status: 'expired', respondedAt: now });
          return { status: 'promotion-expired' as const };
        }
        promotion = promo!;
      }

      const effectiveAt = req.effectiveAt as FirebaseFirestore.Timestamp;
      const bonusDays = promotion?.kind === 'bonusDays' ? promotion.value : 0;
      const bonusLessons = promotion?.kind === 'bonusLessons' ? promotion.value : 0;
      const finalPrice =
        promotion?.kind === 'percentDiscount'
          ? Math.max(0, Math.round(proposedPkg.price * (1 - promotion.value / 100)))
          : promotion?.kind === 'amountDiscount'
            ? Math.max(0, proposedPkg.price - promotion.value)
            : proposedPkg.price;
      const endsAt =
        proposedPkg.kind === 'membership'
          ? addDaysMs(effectiveAt, (proposedPkg.durationDays ?? 0) + bonusDays)
          : addDaysMs(effectiveAt, proposedPkg.lessonValidityDays ?? 0);

      if (currentSnap?.exists) {
        tx.update(currentSnap.ref, { status: 'cancelled' });
      }
      oldCreditsSnap?.docs.forEach((creditDoc) => tx.update(creditDoc.ref, { status: 'cancelled' }));

      const newPackageRef = db.collection('member_packages').doc();
      tx.set(newPackageRef, {
        tenantId: req.tenantId,
        memberId: req.memberId,
        memberName: req.memberName,
        packageId: req.proposedPackageId,
        packageName: proposedPkg.name,
        kind: proposedPkg.kind,
        entitlements: proposedPkg.entitlements,
        ...(proposedPkg.freezePolicy ? { freezePolicy: proposedPkg.freezePolicy } : {}),
        listPrice: proposedPkg.price,
        finalPrice,
        ...(promotion ? { promotionId: req.proposedPromotionId, promotionName: promotion.name, bonusDays, bonusLessons } : {}),
        startsAt: effectiveAt,
        endsAt,
        frozenDays: 0,
        freezes: [],
        status: 'active',
        assignedAt: now,
        assignedBy: req.createdBy,
      });

      const addCredit = (kind: 'ptLesson' | 'groupClass', source: 'purchase' | 'entitlement', total: number, expiresAt: FirebaseFirestore.Timestamp) => {
        tx.set(db.collection('member_credits').doc(), {
          tenantId: req.tenantId,
          memberId: req.memberId,
          kind,
          source,
          sourcePackageId: newPackageRef.id,
          total,
          used: 0,
          startsAt: effectiveAt,
          expiresAt,
          status: 'active',
        });
      };
      if (proposedPkg.kind === 'lessons' && proposedPkg.lessonCount) {
        addCredit('ptLesson', 'purchase', proposedPkg.lessonCount + bonusLessons, endsAt);
      }
      if (proposedPkg.kind === 'membership') {
        const gc = proposedPkg.entitlements?.groupClasses;
        if (gc && !gc.unlimited && gc.count && gc.periodDays) {
          addCredit('groupClass', 'entitlement', gc.count, addDaysMs(effectiveAt, gc.periodDays));
        }
        const pt = proposedPkg.entitlements?.ptLessons;
        if (pt?.count && pt.periodDays) {
          addCredit('ptLesson', 'entitlement', pt.count, addDaysMs(effectiveAt, pt.periodDays));
        }
      }

      if (promotion && promotionRef) {
        tx.update(promotionRef, { redeemed: (promotion.redeemed ?? 0) + 1 });
      }

      // Refund uses the amount shown to the member at approval time, not a
      // number recomputed now — they approved a specific figure.
      if (req.refundAmount) {
        tx.set(db.collection('payments').doc(), {
          tenantId: req.tenantId,
          memberId: req.memberId,
          memberName: req.memberName,
          amount: req.refundAmount,
          method: 'cash',
          status: 'confirmed',
          kind: 'refund',
          note: `${req.currentSummary?.packageName ?? 'eski paket'} → ${proposedPkg.name} geçişi (${req.refundBasis ?? ''})`,
          createdAt: now,
          confirmedAt: now,
        });
      }

      tx.update(requestRef, { status: 'approved', respondedAt: now, appliedAt: now });
      return { status: 'approved' as const, packageId: newPackageRef.id };
    });

    if (result.status === 'rejected') {
      const req = (await requestRef.get()).data()!;
      await sendPushToUser(
        req.createdBy,
        'Paket teklifi reddedildi',
        `${req.memberName}, ${req.proposedSummary?.packageName ?? 'önerilen paketi'} kabul etmedi.`,
      );
    } else if (result.status === 'promotion-expired') {
      const req = (await requestRef.get()).data()!;
      await sendPushToUser(
        req.createdBy,
        'Promosyon süresi doldu',
        `${req.memberName} teklifi onaylamak istedi ama bağlı promosyonun süresi bu arada doldu. Teklifi güncel fiyatla yenile.`,
      );
    }

    console.log(`Package change ${requestId}: ${result.status}`);
    return result;
  },
);

/**
 * GymEntra (PKG-6): a proposal nobody answered doesn't stay pending forever
 * — an admin who forgot about it shouldn't find a stale offer months later.
 */
export const expirePendingPackageChangeRequests = onSchedule(
  { schedule: 'every 24 hours', region: 'europe-west1', timeZone: 'Europe/Istanbul' },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const dueSnap = await db
      .collection('package_change_requests')
      .where('status', '==', 'pending')
      .where('expiresAt', '<=', now)
      .get();
    if (dueSnap.empty) return;

    const batch = db.batch();
    dueSnap.docs.forEach((doc) => batch.update(doc.ref, { status: 'expired' }));
    await batch.commit();
    console.log(`${dueSnap.size} package change request(s) expired`);
  },
);

/**
 * ADMIN-4: an admin undoes a package assignment made by mistake.
 *
 * A callable rather than a rule, for the same reason `bookPtSessions` is one:
 * revoking a quota has to be arbitrated against a booking racing for the same
 * credit, and rules cannot do that. `member_packages` stays `update: false`
 * for clients on purpose.
 *
 * The assignment row is cancelled, not deleted — the member's history has to
 * show that it happened and was taken back, the same reasoning as reversing a
 * payment rather than editing it. `syncMemberEntitlements` recomputes the
 * access mirror on its own from the status change.
 *
 * `access` decides what happens at the door (PKG-11, 7c):
 *
 * - `'immediate'` — the historical behaviour and the right one for a
 *   mis-assignment: `endsAt` is pulled to now, credits are revoked, the
 *   entitlement mirror disappears and the member is stopped at check-in.
 *   Refuses while the package's credits are booked into future appointments;
 *   silently cancelling someone's appointments to tidy up an admin's mistake
 *   is worse than making the admin cancel them deliberately, and the error
 *   says how many are in the way.
 *
 * - `'until-end'` — the member paid for a period and keeps it. `endsAt`,
 *   credits and booked appointments all stand; only renewal stops. Nothing
 *   is blocking here by design: there is nothing to protect the member from.
 *   The row still records who ended it and why.
 *
 * `'until-end'` deliberately leaves `status: 'active'` rather than inventing
 * a fourth state. The status field answers one question — "does this grant
 * access right now?" — and the answer is yes until `endsAt`.
 * `syncMemberEntitlements` already keys off `status === 'active' && endsAt >
 * now`, so a new status would have meant teaching every reader about it;
 * `cancelledAt` carries the other fact without moving the first one.
 */
export const cancelPackageAssignment = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');

  const assignmentId = String(request.data?.assignmentId ?? '');
  const reason = String(request.data?.reason ?? '').trim();
  // Defaults to the old behaviour so an un-updated client keeps working.
  const access = request.data?.access === 'until-end' ? 'until-end' : 'immediate';
  if (!assignmentId || !reason) {
    throw new HttpsError('invalid-argument', 'Atama ve gerekçe gerekiyor.');
  }

  const db = admin.firestore();
  const assignmentRef = db.doc(`member_packages/${assignmentId}`);
  const assignmentSnap = await assignmentRef.get();
  if (!assignmentSnap.exists) throw new HttpsError('not-found', 'Paket ataması bulunamadı.');
  const assignment = assignmentSnap.data()!;

  const callerSnap = await db.doc(`tenant_memberships/${assignment.tenantId}_${uid}`).get();
  const caller = callerSnap.data();
  const callerIsAdmin =
    callerSnap.exists && caller?.status === 'active' && (caller?.roles ?? []).includes('admin');
  if (!callerIsAdmin) {
    throw new HttpsError('permission-denied', 'Bu işlem için salon yöneticisi olmanız gerekiyor.');
  }

  if (assignment.status === 'cancelled') {
    throw new HttpsError('failed-precondition', 'Bu atama zaten iptal edilmiş.');
  }

  const creditsSnap = await db
    .collection('member_credits')
    .where('sourcePackageId', '==', assignmentId)
    .get();

  // Any future appointment paid for out of this package blocks the undo —
  // but only when access is being cut off. Under 'until-end' those
  // appointments stay valid, so there is nothing to block.
  const creditIds = access === 'immediate' ? creditsSnap.docs.map((d) => d.id) : [];
  if (creditIds.length > 0) {
    // `in` caps at 30 values; a single assignment never produces that many
    // credit rows, but chunking keeps a future change from silently
    // truncating the check and letting bookings through.
    const chunks: string[][] = [];
    for (let i = 0; i < creditIds.length; i += 30) chunks.push(creditIds.slice(i, i + 30));

    let blocking = 0;
    for (const chunk of chunks) {
      const sessions = await db
        .collection('pt_sessions')
        .where('creditId', 'in', chunk)
        .where('date', '>=', new Date())
        .get();
      blocking += sessions.docs.filter((d) => d.data().status !== 'cancelled').length;
    }
    if (blocking > 0) {
      throw new HttpsError(
        'failed-precondition',
        `Bu pakete bağlı ${blocking} yaklaşan randevu var. Önce randevuları iptal edin, sonra paketi geri alın.`,
      );
    }
  }

  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();
  batch.update(assignmentRef, {
    cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    cancelledBy: uid,
    cancellationReason: reason,
    cancellationAccess: access,
    ...(access === 'immediate'
      ? // Pulling `endsAt` back is what actually shuts the door: the rules and
        // the entitlement mirror both compare it against the clock, and a
        // status change alone would leave a cache that only refreshes on write.
        { status: 'cancelled', endsAt: now }
      : {}),
  });
  if (access === 'immediate') {
    // Spent credits keep their `used` count: the member really did take those
    // lessons, and zeroing it would make the trainer's past sessions unexplained.
    creditsSnap.docs.forEach((d) => batch.update(d.ref, { status: 'revoked' }));
  }
  await batch.commit();

  const endsAt = (assignment.endsAt as FirebaseFirestore.Timestamp).toDate();
  await sendPushToUser(
    assignment.memberId,
    access === 'immediate' ? 'Paketin geri alındı' : 'Paketin yenilenmeyecek',
    access === 'immediate'
      ? `${assignment.packageName} paketin salon tarafından geri alındı. Gerekçe: ${reason}`
      : `${assignment.packageName} paketin ${endsAt.toLocaleDateString('tr-TR')} tarihinde bitecek ve yenilenmeyecek. O güne kadar salonu kullanmaya devam edebilirsin.`,
    { screen: 'member/index' },
  );

  return { revokedCredits: access === 'immediate' ? creditsSnap.size : 0 };
});

/**
 * ADMIN-3: memberships about to lapse.
 *
 * The renewal conversation is the one the gym most wants to have and the one
 * it is least likely to remember. Both sides hear about it — the member so
 * they are not locked out at the door, the gym so it can sell the renewal.
 *
 * Runs daily and fires on the day a package hits exactly 7 and exactly 1 day
 * remaining, rather than on "7 days or fewer": the latter would send the same
 * warning every morning for a week, which is how people learn to ignore
 * notifications.
 *
 * `notifiedExpiryAt` records the day-count already sent, so a retried run or
 * a clock that drifts across midnight cannot send twice.
 */
export const notifyExpiringPackages = onSchedule(
  { schedule: 'every 24 hours', region: 'europe-west1', timeZone: 'Europe/Istanbul' },
  async () => {
    const db = admin.firestore();
    const now = new Date();

    let notified = 0;
    for (const daysLeft of [7, 1]) {
      const windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() + daysLeft);
      windowStart.setHours(0, 0, 0, 0);
      const windowEnd = new Date(windowStart);
      windowEnd.setDate(windowEnd.getDate() + 1);

      const snap = await db
        .collection('member_packages')
        .where('status', '==', 'active')
        .where('endsAt', '>=', admin.firestore.Timestamp.fromDate(windowStart))
        .where('endsAt', '<', admin.firestore.Timestamp.fromDate(windowEnd))
        .get();

      for (const docSnap of snap.docs) {
        const p = docSnap.data();
        if (p.notifiedExpiryAt === daysLeft) continue;

        const label = daysLeft === 1 ? 'yarın' : `${daysLeft} gün sonra`;
        await sendPushToUser(
          p.memberId,
          'Paketin bitmek üzere',
          `${p.packageName} paketin ${label} sona eriyor.`,
          { screen: 'member/index' },
        );
        await notifyTenantAdmins(
          p.tenantId,
          'Paket bitmek üzere',
          `${p.memberName ?? 'Bir üye'} · ${p.packageName} ${label} bitiyor.`,
          { screen: 'admin/members' },
        );
        await docSnap.ref.update({ notifiedExpiryAt: daysLeft });
        notified += 1;
      }
    }

    console.log(`Paket bitiş uyarısı: ${notified} bildirim gönderildi.`);
  },
);

/**
 * PKG-10: an admin pauses a membership.
 *
 * A freeze is not a discount and not a refund — the member keeps the days
 * they paid for, they just move. `endsAt` is pushed out by exactly the frozen
 * span, and every credit sourced from this package has its expiry pushed the
 * same way: otherwise freezing would quietly cost the member the periodic
 * lessons they had banked, which is the opposite of what a pause is for.
 *
 * Quota and minimum length come from `freezePolicy`, **copied onto the
 * assignment when it was sold**. A gym that tightens its policy next month
 * must not retroactively shorten what this member bought — the same reasoning
 * as the frozen cancellation deadline.
 *
 * Starts immediately rather than on a chosen future date. A scheduled freeze
 * would need a job to switch it on, another to switch it off, and a rule for
 * what happens when the member checks in on the boundary day; gyms freeze
 * when someone tells them "I'm away from tomorrow", and starting now with an
 * end date expresses that without the extra machinery.
 */
export const freezeMemberPackage = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');

  const assignmentId = String(request.data?.assignmentId ?? '');
  const days = Number(request.data?.days);
  if (!assignmentId || !Number.isInteger(days) || days <= 0) {
    throw new HttpsError('invalid-argument', 'Atama ve gün sayısı gerekiyor.');
  }
  if (days > 365) throw new HttpsError('invalid-argument', 'En fazla 365 gün dondurulabilir.');

  const db = admin.firestore();
  const assignmentRef = db.doc(`member_packages/${assignmentId}`);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(assignmentRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Paket ataması bulunamadı.');
    const pkg = snap.data()!;

    const callerSnap = await tx.get(db.doc(`tenant_memberships/${pkg.tenantId}_${uid}`));
    const caller = callerSnap.data();
    if (!callerSnap.exists || caller?.status !== 'active' || !(caller?.roles ?? []).includes('admin')) {
      throw new HttpsError('permission-denied', 'Bu işlem için salon yöneticisi olmanız gerekiyor.');
    }

    if (pkg.kind !== 'membership') {
      throw new HttpsError('failed-precondition', 'Yalnızca üyelik paketi dondurulabilir.');
    }
    if (pkg.status === 'frozen') throw new HttpsError('failed-precondition', 'Bu paket zaten dondurulmuş.');
    if (pkg.status !== 'active') throw new HttpsError('failed-precondition', 'Yalnızca aktif paket dondurulabilir.');
    if (pkg.cancelledAt) throw new HttpsError('failed-precondition', 'Sonlandırılmış paket dondurulamaz.');

    const policy = pkg.freezePolicy as { minDays?: number; maxCount?: number } | undefined;
    if (!policy) throw new HttpsError('failed-precondition', 'Bu pakette dondurma hakkı yok.');
    const used = ((pkg.freezes ?? []) as unknown[]).length;
    const maxCount = policy.maxCount ?? 0;
    if (used >= maxCount) {
      throw new HttpsError('failed-precondition', `Dondurma hakkı doldu (${maxCount} kez).`);
    }
    const minDays = policy.minDays ?? 0;
    if (days < minDays) {
      throw new HttpsError('failed-precondition', `En az ${minDays} gün dondurulmalı.`);
    }

    const now = admin.firestore.Timestamp.now();
    const endsAt = pkg.endsAt as FirebaseFirestore.Timestamp;
    if (endsAt.toMillis() <= now.toMillis()) {
      throw new HttpsError('failed-precondition', 'Süresi dolmuş paket dondurulamaz.');
    }

    const shiftMs = days * 86400000;
    const freezeEndsAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + shiftMs);

    // Credits sourced from this package move with it. Read inside the
    // transaction so a rollover running at the same moment cannot leave one
    // credit shifted and another not.
    const creditsSnap = await tx.get(
      db.collection('member_credits').where('sourcePackageId', '==', assignmentId),
    );

    tx.update(assignmentRef, {
      status: 'frozen',
      endsAt: admin.firestore.Timestamp.fromMillis(endsAt.toMillis() + shiftMs),
      frozenDays: ((pkg.frozenDays as number) ?? 0) + days,
      freezes: admin.firestore.FieldValue.arrayUnion({
        startsAt: now,
        endsAt: freezeEndsAt,
        days,
        createdBy: uid,
        createdAt: now,
      }),
    });

    creditsSnap.docs.forEach((d) => {
      const expiresAt = d.data().expiresAt as FirebaseFirestore.Timestamp | undefined;
      if (!expiresAt) return;
      tx.update(d.ref, {
        expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt.toMillis() + shiftMs),
      });
    });

    return {
      memberId: pkg.memberId as string,
      packageName: pkg.packageName as string,
      resumesAt: freezeEndsAt.toDate(),
      shiftedCredits: creditsSnap.size,
    };
  });

  await sendPushToUser(
    result.memberId,
    'Üyeliğin donduruldu',
    `${result.packageName} paketin ${result.resumesAt.toLocaleDateString('tr-TR')} tarihine kadar duraklatıldı. Bitiş tarihin ${days} gün ileri alındı.`,
    { screen: 'member/index' },
  );

  return { resumesAt: result.resumesAt.toISOString(), shiftedCredits: result.shiftedCredits };
});

/**
 * PKG-10 + PKG-12: the daily sweep that keeps `member_packages.status` honest.
 *
 * Two transitions nothing else performs:
 *
 * 1. **Un-freeze.** A frozen package drops out of `member_entitlements` (the
 *    sync only caches `status === 'active'`), which is what closes group-class
 *    booking during a pause. That cache is only rebuilt when the assignment is
 *    written, so without this the member would stay locked out after their
 *    freeze ended — the pause would silently become permanent.
 *
 * 2. **Expire.** `status` stayed `active` forever on a package whose `endsAt`
 *    had passed. Every reader had to know to re-check the date, and the ones
 *    that forgot reported a lapsed member as current.
 *
 * Idempotent by construction: both transitions are "set the field to what the
 * dates already say", so a retried run is a no-op.
 */
export const sweepPackageStatuses = onSchedule(
  { schedule: 'every 24 hours', region: 'europe-west1', timeZone: 'Europe/Istanbul' },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    let resumed = 0;
    const frozen = await db.collection('member_packages').where('status', '==', 'frozen').get();
    for (const doc of frozen.docs) {
      const freezes = (doc.data().freezes ?? []) as { endsAt?: FirebaseFirestore.Timestamp }[];
      const last = freezes[freezes.length - 1];
      if (!last?.endsAt || last.endsAt.toMillis() > now.toMillis()) continue;
      const endsAt = doc.data().endsAt as FirebaseFirestore.Timestamp;
      // A freeze that outlived its own package resumes straight into expiry
      // rather than back to active — the dates, not the order of the sweeps.
      await doc.ref.update({ status: endsAt.toMillis() <= now.toMillis() ? 'expired' : 'active' });
      resumed++;
    }

    let expired = 0;
    const lapsed = await db
      .collection('member_packages')
      .where('status', '==', 'active')
      .where('endsAt', '<=', now)
      .limit(500)
      .get();
    for (const doc of lapsed.docs) {
      await doc.ref.update({ status: 'expired' });
      expired++;
    }

    console.log(`sweepPackageStatuses: ${resumed} çözüldü, ${expired} süresi doldu`);
  },
);
