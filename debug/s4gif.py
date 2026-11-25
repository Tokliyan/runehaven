"""python3 debug/s4gif.py <before_dir|-> <after_dir> <out.gif> [cx cy w h] [label_before] [label_after] [ms]
Side-by-side (or single) animated GIF of captured frames, cropped 1:1 so the pixel art stays crisp."""
import sys, os, glob
from PIL import Image, ImageDraw
bd, ad, out = sys.argv[1], sys.argv[2], sys.argv[3]
cx, cy, w, h = (int(v) for v in (sys.argv[4:8] if len(sys.argv) >= 8 else (640, 340, 600, 400)))
lb = sys.argv[8] if len(sys.argv) > 8 else 'BEFORE (main)'
la = sys.argv[9] if len(sys.argv) > 9 else 'AFTER (S4)'
ms = int(sys.argv[10]) if len(sys.argv) > 10 else 110
box = (cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2)
A = sorted(glob.glob(os.path.join(ad, '*.png')))
Bf = sorted(glob.glob(os.path.join(bd, '*.png'))) if bd != '-' else []
frames = []
for i, f in enumerate(A):
    a = Image.open(f).convert('RGB').crop(box)
    if Bf:
        b = Image.open(Bf[i % len(Bf)]).convert('RGB').crop(box)
        W = Image.new('RGB', (w * 2 + 8, h), (18, 18, 22)); W.paste(b, (0, 0)); W.paste(a, (w + 8, 0))
        d = ImageDraw.Draw(W)
        for x, t in ((8, lb), (w + 16, la)):
            d.rectangle((x - 4, 6, x + 6 * len(t) + 6, 22), fill=(18, 18, 22)); d.text((x, 8), t, fill=(240, 236, 220))
    else:
        W = a
    frames.append(W.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
frames[0].save(out, save_all=True, append_images=frames[1:], duration=ms, loop=0, optimize=True, disposal=1)
print(out, len(frames), os.path.getsize(out) // 1024, 'KB')
