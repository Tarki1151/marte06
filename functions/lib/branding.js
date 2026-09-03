"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadTenantLogo = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
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
exports.uploadTenantLogo = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');
    const tenantId = String((_c = (_b = request.data) === null || _b === void 0 ? void 0 : _b.tenantId) !== null && _c !== void 0 ? _c : '');
    const base64 = String((_e = (_d = request.data) === null || _d === void 0 ? void 0 : _d.base64) !== null && _e !== void 0 ? _e : '');
    const contentType = String((_g = (_f = request.data) === null || _f === void 0 ? void 0 : _f.contentType) !== null && _g !== void 0 ? _g : 'image/jpeg');
    if (!tenantId || !base64)
        throw new https_1.HttpsError('invalid-argument', 'Salon ve görsel gerekiyor.');
    if (!contentType.startsWith('image/')) {
        throw new https_1.HttpsError('invalid-argument', 'Yalnızca görsel yüklenebilir.');
    }
    const db = admin.firestore();
    const membershipSnap = await db.doc(`tenant_memberships/${tenantId}_${uid}`).get();
    const membership = membershipSnap.data();
    if (!membershipSnap.exists || (membership === null || membership === void 0 ? void 0 : membership.status) !== 'active' || !((_h = membership === null || membership === void 0 ? void 0 : membership.roles) !== null && _h !== void 0 ? _h : []).includes('admin')) {
        throw new https_1.HttpsError('permission-denied', 'Bu işlem için salon yöneticisi olmanız gerekiyor.');
    }
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.byteLength === 0)
        throw new https_1.HttpsError('invalid-argument', 'Görsel okunamadı.');
    if (buffer.byteLength > MAX_BYTES) {
        throw new https_1.HttpsError('invalid-argument', 'Görsel çok büyük. Daha küçük bir logo seç.');
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
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
        `/o/${encodeURIComponent(objectPath)}?alt=media`;
    return { url };
});
//# sourceMappingURL=branding.js.map