import { describe, expect, it } from 'vitest';

import { computeCancellationDeadline, isBeforeDeadline } from '../src/cancellationDeadline';

// 4 Eylül 2026, Cuma. getDay() === 5
const FRIDAY = (h: number, m = 0) => new Date(2026, 8, 4, h, m, 0, 0);

const HOURS = {
  '4': { open: '07:00', close: '22:00' }, // perşembe
  '5': { open: '07:00', close: '22:00' }, // cuma
};

describe('computeCancellationDeadline', () => {
  it('gün içindeki derste düz çıkarma yapar', () => {
    const d = computeCancellationDeadline({
      sessionStart: FRIDAY(18),
      cancellationHours: 2,
      openingHours: HOURS,
    });
    expect(d).toEqual(FRIDAY(16));
  });

  it('sabahın ilk dersinde son tarihi bir önceki akşama çeker', () => {
    // 07:00 dersi − 2 saat = 05:00, salon henüz açık değil → perşembe kapanışı
    const d = computeCancellationDeadline({
      sessionStart: FRIDAY(7),
      cancellationHours: 2,
      openingHours: HOURS,
    });
    expect(d).toEqual(new Date(2026, 8, 3, 22, 0, 0, 0));
  });

  it('açılıştan hemen sonraki ders hâlâ aynı gün iptal edilebilir', () => {
    const d = computeCancellationDeadline({
      sessionStart: FRIDAY(10),
      cancellationHours: 2,
      openingHours: HOURS,
    });
    expect(d).toEqual(FRIDAY(8));
  });

  it('geç kapanan salonda son tarihi ileri ATMAZ', () => {
    // 24 saatlik bildirimde naive son tarih perşembe 09:00; salon gece 02:00'de
    // kapanıyor olsa bile üyeye fazladan süre verilmemeli.
    const d = computeCancellationDeadline({
      sessionStart: FRIDAY(9),
      cancellationHours: 24,
      openingHours: { '4': { open: '07:00', close: '23:59' }, '5': { open: '07:00', close: '23:59' } },
    });
    expect(d).toEqual(new Date(2026, 8, 3, 9, 0, 0, 0));
  });

  it('salon saatleri yoksa günü 08:00 başlatır', () => {
    const d = computeCancellationDeadline({ sessionStart: FRIDAY(9), cancellationHours: 2 });
    // 07:00 < 08:00 → bir önceki akşam 22:00
    expect(d).toEqual(new Date(2026, 8, 3, 22, 0, 0, 0));
  });

  it('eşik verilmezse 24 saate düşer — sunucudaki diğer varsayılanla aynı', () => {
    const d = computeCancellationDeadline({ sessionStart: FRIDAY(18), openingHours: HOURS });
    expect(d).toEqual(new Date(2026, 8, 3, 18, 0, 0, 0));
  });

  it('salonun kapalı olduğu bir önceki günde varsayılan akşama düşer', () => {
    const d = computeCancellationDeadline({
      sessionStart: FRIDAY(7),
      cancellationHours: 2,
      openingHours: { '4': null, '5': { open: '07:00', close: '22:00' } },
    });
    expect(d).toEqual(new Date(2026, 8, 3, 22, 0, 0, 0));
  });
});

describe('isBeforeDeadline', () => {
  it('tam son tarihte hâlâ zamanında sayılır', () => {
    expect(isBeforeDeadline(FRIDAY(16), FRIDAY(16))).toBe(true);
    expect(isBeforeDeadline(FRIDAY(16), FRIDAY(16, 1))).toBe(false);
  });
});
