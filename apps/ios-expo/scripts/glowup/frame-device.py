#!/usr/bin/env python3
"""Embed a raw simulator screenshot into a REAL iPhone 16 Pro Max device frame.

Uses Koubou's Apple-accurate Natural-Titanium portrait frame (1470x3000, screen
slot at offset 80,80 sized 1320x2868). Optionally strips the in-app nav band
first (status bar + content, drop the web-parity menu), rescaling to fill the
slot. Output is a transparent PNG of just the framed device, trimmed to bbox —
ready to drop onto the poster canvas.

  python3 frame-device.py <in.png> <out.png>
"""
import sys
from PIL import Image, ImageDraw

SCREEN_RADIUS = 132          # round the capture corners to match the frame cutout

FRAME = "/Users/levinschwab/.koubou/frames/iPhone 16 Pro Max - Natural Titanium - Portrait.png"
OFFX, OFFY = 80, 80          # screen slot offset in the frame (Frames.json)
SW, SH = 1320, 2868          # screen slot size (native iPhone 16 Pro Max)
NAV = (0.063, 0.150)         # nav band [h1,h2] as fractions of the capture height


def nav_strip(im):
    W, H = im.size
    h1, h2 = int(H * NAV[0]), int(H * NAV[1])
    top = im.crop((0, 0, W, h1))
    bot = im.crop((0, h2, W, H))
    out = Image.new("RGBA", (W, top.height + bot.height))
    out.paste(top, (0, 0))
    out.paste(bot, (0, top.height))
    return out.resize((SW, SH), Image.LANCZOS)


def frame_one(src, dst, strip=True):
    frame = Image.open(FRAME).convert("RGBA")
    shot = Image.open(src).convert("RGBA")
    if shot.size != (SW, SH):
        shot = shot.resize((SW, SH), Image.LANCZOS)
    if strip:
        shot = nav_strip(shot)
    # round the capture's corners so they sit cleanly inside the frame cutout
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, shot.width, shot.height), radius=SCREEN_RADIUS, fill=255)
    shot.putalpha(mask)
    canvas = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    canvas.paste(shot, (OFFX, OFFY), shot)
    canvas.alpha_composite(frame)          # opaque body over the screen edges
    canvas = canvas.crop(canvas.getbbox())  # trim transparent margins
    canvas.save(dst)
    print(f"framed {dst} {canvas.size}")


if __name__ == "__main__":
    frame_one(sys.argv[1], sys.argv[2], strip="--no-strip" not in sys.argv)
