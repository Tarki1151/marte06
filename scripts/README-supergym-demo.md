# Supergym-88 — tanıtım salonu

Ekran görüntüleri, mağaza görselleri ve demolar bu salondan alınır.
**İçindeki hiçbir kişi gerçek değildir.** Adlar, telefonlar, e-postalar ve
doğum tarihleri `seed_supergym_demo.cjs` içindeki sabit listelerden üretilir;
Tarabya-01'den hiçbir veri taşınmamıştır.

Tarabya-01 (`TARABYA-01`) gerçek kişilerin verisiyle **test** salonu olarak
kalır — oradan görüntü alınmaz.

## Giriş bilgileri

Tüm demo hesapların parolası: **`Supergym88!`**

| Rol | E-posta | Ad |
|---|---|---|
| Üye | `uye01@supergym88.test` | Ayça Gülhan |
| Antrenör | `antrenor1@supergym88.test` | Kerem Aksoy |

Diğerleri aynı düzende: `uye01` … `uye20`, `antrenor1` … `antrenor5`.
Adlar için script'teki listeye bak.

`supergym88.test` alan adı bilinçli seçildi — `.test` RFC 2606 ile
ayrılmıştır, asla gerçek bir alan adı olamaz. Bu hesaplara gönderilen
hiçbir e-posta kimseye ulaşmaz.

**Yönetici hesabı bu script'in dışındadır** ve ona dokunulmaz.

## Salonda ne var

| | |
|---|---|
| Üye | 20 (biri süresi dolmuş paketle) |
| Antrenör | 5, haftalık çalışma saatleri tanımlı |
| Paket | 6 aktif katalog + 2 kampanya |
| Ders | 28 günlük program + 6 haftalık tekrarlayan seri + kotalı bir rezervasyon |
| Program | 16 aktif + 1 taslak, hareket kütüphanesinden gerçek adlarla |
| Antrenman kaydı | 56 |
| Ölçüm | 7 üye için 6 aylık seri (grafikler dolu çıksın diye) |
| Ödeme | 20 onaylı, 3 onay bekleyen, 1 iade |
| PT randevusu | 20 planlı/tamamlanmış + 1 iptal |
| Giriş kaydı | 70, son iki hafta |

Salon `grandfathered` abonelikte — 10 üyelik ücretsiz kademe sınırına
takılmaz.

## Çalıştırma

```bash
node scripts/seed_supergym_demo.cjs                  # kuru çalıştırma
node scripts/seed_supergym_demo.cjs --apply          # yaz
node scripts/seed_supergym_demo.cjs --purge --apply  # ürettiklerini sil
```

Ürettiği her doküman `sg-` ön ekli deterministik kimlik ve `demoSeed`
alanı taşır, bu yüzden:

- Tekrar çalıştırmak yeni kayıt basmaz, mevcutların üzerine yazar.
- `--purge` yalnızca bu script'in ürettiklerini siler; yöneticiye ve salon
  öncesinden var olan kayıtlara dokunmaz.

Tarihler **çalıştırma anına göre** hesaplanır ("3 gün sonra", "2 hafta
önce"). Ekran görüntülerinde "geçmiş ders" ya da "yaklaşan randevu" boş
görünmeye başlarsa script'i yeniden çalıştırmak yeter.

## Bilinen eksik

Yönetici üyeliğinde `userDisplayName` yok — yönetici ekranlarında ad alanı
boş çıkabilir. Bu kayıt bilinçli olarak script'in dışında bırakıldı;
düzeltilmesi gerekirse elle yazılmalı.
