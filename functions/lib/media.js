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
exports.deleteMemberPhoto = exports.uploadMemberPhoto = void 0;
exports.deleteMemberPhotoObject = deleteMemberPhotoObject;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const crypto_1 = require("crypto");
const MAX_BYTES = 1024 * 1024; // the client sends 512x512 JPEG; this is headroom
/**
 * A member's own photo (PER-20). Same shape as `uploadTenantLogo` and for
 * the same reason: the Storage rule stays closed and membership is checked
 * in code. The object gets a download token so the URL itself grants read
 * access — the roster (staff of the gym) renders it, and nothing needs a
 * cross-service rule. Replacing the photo mints a new token; the old URL
 * dies with the old object.
 */
exports.uploadMemberPhoto = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    var _a, _b, _c;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');
    const base64 = String((_c = (_b = request.data) === null || _b === void 0 ? void 0 : _b.base64) !== null && _c !== void 0 ? _c : '');
    if (!base64)
        throw new https_1.HttpsError('invalid-argument', 'Görsel gerekiyor.');
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.byteLength === 0)
        throw new https_1.HttpsError('invalid-argument', 'Görsel okunamadı.');
    if (buffer.byteLength > MAX_BYTES)
        throw new https_1.HttpsError('invalid-argument', 'Görsel çok büyük.');
    const bucket = admin.storage().bucket();
    const objectPath = `members/${uid}/avatar.jpg`;
    const token = (0, crypto_1.randomUUID)();
    await bucket.file(objectPath).save(buffer, {
        contentType: 'image/jpeg',
        metadata: { cacheControl: 'public, max-age=3600', metadata: { firebaseStorageDownloadTokens: token } },
        resumable: false,
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
        `/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
    return { url };
});
/** The member removes their photo: object gone, token gone, URL dead. */
exports.deleteMemberPhoto = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    var _a;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');
    await admin.storage().bucket().file(`members/${uid}/avatar.jpg`).delete({ ignoreNotFound: true });
    return { ok: true };
});
/** Used by `deleteMyAccount`'s cascade — a deleted account leaves no photo behind. */
async function deleteMemberPhotoObject(uid) {
    await admin.storage().bucket().file(`members/${uid}/avatar.jpg`).delete({ ignoreNotFound: true });
}
//# sourceMappingURL=media.js.map