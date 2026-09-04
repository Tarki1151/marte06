"""POSE_ARCHETYPES koordinatlarindan RIG_ARCHETYPES aci karelerini uretir.

Eski motor her kareyi eklem koordinati olarak tutuyordu; yeni kukla acilarla
calisiyor (bkz. src/utils/rig.ts). Aci, koordinatlardan tek anlamli sekilde
cikarilabildigi icin cevrim otomatik: elle 34 arketip yeniden yazilmiyor.

Bes hareket (squat, deadlift, omuz press, cat-cow, bench press) Motion Rig
tasariminda elle yazildi; onlar OVERRIDES ile geliyor ve cevrimi eziyor.
"""
import io, json, math, re, sys

LIB = '/Users/tarkancicek/Codes/Marte/gymentra-mobile/src/data/exerciseLibrary.ts'
OUT = '/Users/tarkancicek/Codes/Marte/gymentra-mobile/src/data/rigArchetypes.ts'
FLOOR = 207.0

def js2json(t):
    return json.loads(re.sub(r"(\w+):", r'"\1":', t))

def ang(a, b):
    return round(math.degrees(math.atan2(b[0] - a[0], -(b[1] - a[1]))), 1)

def pose(f):
    return {
        'torso': ang(f['hip'], f['shoulder']),
        'thoraxA': ang(f['hip'], f['shoulder']),
        'neckA': ang(f['shoulder'], f['head']),
        'thighA': ang(f['hip'], f['knee']),
        'shinA': ang(f['knee'], f['ankle']),
        'upperA': ang(f['shoulder'], f['elbow']),
        'foreA': ang(f['elbow'], f['wrist']),
    }

def mode_of(f):
    hands_down = f['wrist'][1] > f['shoulder'][1] and f['wrist'][1] > FLOOR - 40
    knees_down = f['knee'][1] > FLOOR - 45
    horizontal = abs(f['shoulder'][1] - f['hip'][1]) < abs(f['shoulder'][0] - f['hip'][0])
    if horizontal and hands_down and knees_down:
        return 'quad'
    if horizontal and f['hip'][1] > FLOOR - 80:
        return 'bench'
    return 'stand'

def bar_of(f):
    bar = f.get('bar')
    if not bar:
        return None
    d = lambda p: math.hypot(bar[0] - p[0], bar[1] - p[1])
    return 'back' if d(f['shoulder']) < d(f['wrist']) else 'hands'

# Motion Rig tasariminda elle yazilan kareler (dunya acilari).
OVERRIDES = {
  'squat': dict(mode='stand', arm='angles', bar='back', bend=1, dur=3600, kf=[
    (0.00, 'Ayakta',     dict(shinA=178, thighA=183, torso=5,  thoraxA=1,  neckA=3,  upperA=213, foreA=332)),
    (0.42, 'Alt nokta',  dict(shinA=203, thighA=100, torso=40, thoraxA=36, neckA=24, upperA=213, foreA=332)),
    (0.55, 'Alt nokta',  dict(shinA=203, thighA=100, torso=40, thoraxA=36, neckA=24, upperA=213, foreA=332)),
    (1.00, 'Ayakta',     dict(shinA=178, thighA=183, torso=5,  thoraxA=1,  neckA=3,  upperA=213, foreA=332)),
  ]),
  'hinge': dict(mode='stand', arm='angles', bar='hands', bend=1, dur=3800, kf=[
    (0.00, 'Kurulum', dict(shinA=198, thighA=118, torso=72, thoraxA=68, neckA=54, upperA=181, foreA=180)),
    (0.12, 'Kasilma', dict(shinA=197, thighA=120, torso=70, thoraxA=66, neckA=52, upperA=181, foreA=180)),
    (0.50, 'Kilit',   dict(shinA=178, thighA=182, torso=4,  thoraxA=2,  neckA=2,  upperA=184, foreA=182)),
    (0.62, 'Kilit',   dict(shinA=178, thighA=182, torso=4,  thoraxA=2,  neckA=2,  upperA=184, foreA=182)),
    (1.00, 'Inis',    dict(shinA=198, thighA=118, torso=72, thoraxA=68, neckA=54, upperA=181, foreA=180)),
  ]),
  'seated_overhead_press': dict(mode='stand', arm='ik', bar='hands', bend=1, dur=3200, kf=[
    (0.00, 'Omuzda', dict(shinA=176, thighA=184, torso=6, thoraxA=3, neckA=8,  hx=26, hy=-4)),
    (0.22, 'Itis',   dict(shinA=178, thighA=183, torso=4, thoraxA=2, neckA=2,  hx=12, hy=-72)),
    (0.45, 'Tepe',   dict(shinA=178, thighA=182, torso=2, thoraxA=1, neckA=-2, hx=0,  hy=-142)),
    (0.58, 'Tepe',   dict(shinA=178, thighA=182, torso=2, thoraxA=1, neckA=-2, hx=0,  hy=-142)),
    (0.80, 'Inis',   dict(shinA=178, thighA=183, torso=4, thoraxA=2, neckA=2,  hx=12, hy=-72)),
    (1.00, 'Omuzda', dict(shinA=176, thighA=184, torso=6, thoraxA=3, neckA=8,  hx=26, hy=-4)),
  ]),
  'quadruped_spine': dict(mode='quad', arm='floor', bar=None, bend=1, dur=5200, kf=[
    (0.00, 'Notr',  dict(thighA=180, shinA=268, torso=76, thoraxA=76, neckA=84,  hx=24)),
    (0.24, 'Kedi',  dict(thighA=180, shinA=268, torso=60, thoraxA=92, neckA=128, hx=20)),
    (0.38, 'Kedi',  dict(thighA=180, shinA=268, torso=60, thoraxA=92, neckA=128, hx=20)),
    (0.72, 'Inek',  dict(thighA=180, shinA=268, torso=92, thoraxA=60, neckA=44,  hx=28)),
    (0.86, 'Inek',  dict(thighA=180, shinA=268, torso=92, thoraxA=60, neckA=44,  hx=28)),
    (1.00, 'Notr',  dict(thighA=180, shinA=268, torso=76, thoraxA=76, neckA=84,  hx=24)),
  ]),
  'bench_press': dict(mode='bench', arm='ik', bar='hands', bend=-1, dur=3400, kf=[
    (0.00, 'Goguste', dict(thighA=250, shinA=150, torso=88, thoraxA=92, neckA=96, hx=-46, hy=-58)),
    (0.45, 'Kilit',   dict(thighA=250, shinA=150, torso=88, thoraxA=92, neckA=94, hx=-34, hy=-148)),
    (0.58, 'Kilit',   dict(thighA=250, shinA=150, torso=88, thoraxA=92, neckA=94, hx=-34, hy=-148)),
    (1.00, 'Goguste', dict(thighA=250, shinA=150, torso=88, thoraxA=92, neckA=96, hx=-46, hy=-58)),
  ]),
}

def main():
    s = io.open(LIB, encoding='utf-8').read()
    body = re.search(r"export const POSE_ARCHETYPES[^=]*=\s*\{(.*?)\n\};", s, re.S).group(1)
    out = {}
    for m in re.finditer(r"\n  (\w+): \{\n    start: (\{.*?\}),\n    end: (\{.*?\}|null),\n((?:    (?:view|face): '[^']+',\n)*)  \},", body, re.S):
        key = m.group(1)
        if key in OVERRIDES:
            o = OVERRIDES[key]
            out[key] = dict(mode=o['mode'], arm=o['arm'], bar=o['bar'], bend=o['bend'], dur=o['dur'],
                            kf=[dict(t=t, tr=tr, p=p) for t, tr, p in o['kf']])
            continue
        start = js2json(m.group(2))
        end = None if m.group(3) == 'null' else js2json(m.group(3))
        mode = mode_of(start)
        bar = bar_of(start)
        a = pose(start)
        if end is None:
            kf = [dict(t=0.0, tr='Duruş', p=a), dict(t=1.0, tr='Duruş', p=a)]
            dur = 4000
        else:
            b = pose(end)
            kf = [dict(t=0.0, tr='Başlangıç', p=a), dict(t=0.42, tr='Bitiş', p=b),
                  dict(t=0.55, tr='Bitiş', p=b), dict(t=1.0, tr='Başlangıç', p=a)]
            dur = 3400
        out[key] = dict(mode=mode, arm='angles', bar=bar, bend=1, dur=dur, kf=kf)

    lines = ["// ÜRETİLMİŞ DOSYA — elle düzenleme. Kaynak: marte06/scripts/build_rig_archetypes.py",
             "//",
             "// Eklemli kuklanın (src/utils/rig.ts) her arketip için açı kareleri. Beş",
             "// hareket Motion Rig tasarımında elle yazıldı; kalanlar eski koordinat",
             "// karelerinden açıya çevrildi.",
             "",
             "import { RigExercise } from '@/utils/rig';",
             "",
             "export const RIG_ARCHETYPES: Record<string, RigExercise> = {"]
    for key, ex in out.items():
        lines.append("  %s: {" % key)
        lines.append("    mode: '%s', arm: '%s', bar: %s, bend: %d, dur: %d," % (
            ex['mode'], ex['arm'], "'%s'" % ex['bar'] if ex['bar'] else 'null', ex['bend'], ex['dur']))
        lines.append("    kf: [")
        for k in ex['kf']:
            p = ', '.join('%s: %s' % (kk, vv) for kk, vv in k['p'].items())
            lines.append("      { t: %s, tr: '%s', p: { %s } }," % (k['t'], k['tr'], p))
        lines.append("    ],")
        lines.append("  },")
    lines.append("};")
    lines.append("")
    io.open(OUT, 'w', encoding='utf-8').write('\n'.join(lines))
    modes = {}
    for ex in out.values():
        modes[ex['mode']] = modes.get(ex['mode'], 0) + 1
    print('yazıldı:', len(out), 'arketip', modes)

main()
