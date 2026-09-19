"""아이콘 PNG 생성 — 틸 바탕에 흰색 X 스티치(십자수) 모양. 1회성 생성 스크립트."""
from PIL import Image, ImageDraw

TEAL = (13, 102, 99, 255)   # #0D6663
WHITE = (255, 255, 255, 255)


def draw_stitch_mark(size, bg, pad_ratio, stroke_ratio, round_rect=True, corner_ratio=0.22):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if round_rect:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * corner_ratio), fill=bg)
    else:
        d.rectangle([0, 0, size - 1, size - 1], fill=bg)
    pad = size * pad_ratio
    stroke = max(2, int(size * stroke_ratio))
    d.line([(pad, pad), (size - pad, size - pad)], fill=WHITE, width=stroke, joint="curve")
    d.line([(size - pad, pad), (pad, size - pad)], fill=WHITE, width=stroke, joint="curve")
    r = stroke / 2
    for x, y in [(pad, pad), (size - pad, pad), (pad, size - pad), (size - pad, size - pad)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)
    return img


sizes = {
    "icon-192.png": (192, False),
    "icon-512.png": (512, False),
    "icon-maskable-512.png": (512, True),
}

import os
out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(out_dir, exist_ok=True)

for name, (size, maskable) in sizes.items():
    pad_ratio = 0.30 if maskable else 0.24
    img = draw_stitch_mark(size, TEAL, pad_ratio, 0.085, round_rect=not maskable)
    if maskable:
        # maskable: 안전 영역(가운데 80%)을 확보하기 위해 배경을 꽉 채움
        base = Image.new("RGBA", (size, size), TEAL)
        base.alpha_composite(img)
        img = base
    img.save(os.path.join(out_dir, name))
    print("wrote", name, img.size)
