#!/usr/bin/env python3
"""Generate ikon PNG 192x192 dan 512x512 untuk PWA dari desain centang biru.

Ikon PNG tidak di-commit ke repo (push snapshot GitHub hanya menerima file teks
UTF-8). Jalankan script ini secara lokal bila butuh ikon PNG, mis. untuk
installability penuh di Chrome/Android:

    python3 scripts/generate-icons.py

Lalu tambahkan entri PNG ke public/manifest.webmanifest bila diperlukan.
Membutuhkan Pillow: pip install pillow
"""
from PIL import Image, ImageDraw
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "public")


def make_icon(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size, size], radius=size // 4.5, fill=(37, 99, 235, 255))
    s = size / 512.0
    pts = [(150 * s, 262 * s), (208 * s, 320 * s), (362 * s, 156 * s)]
    d.line(pts, fill=(255, 255, 255, 255), width=int(44 * s), joint="curve")
    r = 22 * s
    for x, y in [(150 * s, 262 * s), (362 * s, 156 * s)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 255))
    img.save(path, "PNG")
    print("dibuat:", path)


if __name__ == "__main__":
    make_icon(192, os.path.join(OUT, "icon-192.png"))
    make_icon(512, os.path.join(OUT, "icon-512.png"))
