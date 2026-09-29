#!/usr/bin/env python3
"""Generate synthetic "scanned page" JPEGs for the preview.

The app ships with no sample data and cannot scan in a browser, so the
driver seeds a library that points at these files. They are deliberately
paper-coloured with a little grain: a flat white rectangle makes filter
changes (Enhance, B&W) impossible to judge.

Usage: make-demo-pages.py <output-dir>
"""
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFont

# A4 at 150dpi — the same shape a real capture lands in.
WIDTH, HEIGHT = 1240, 1754
MARGIN = 90


def font(size, bold=False):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if bold else ""),
        "/usr/share/fonts/truetype/liberation/LiberationSans%s.ttf" % ("-Bold" if bold else ""),
    ):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def page(out_dir, name, title, lines, tint=(252, 251, 248)):
    image = Image.new("RGB", (WIDTH, HEIGHT), tint)
    draw = ImageDraw.Draw(image)

    # Speckle, so the filters have something to bite on.
    for _ in range(1400):
        x, y = random.randint(0, WIDTH - 1), random.randint(0, HEIGHT - 1)
        shade = random.randint(-6, 0)
        pixel = image.getpixel((x, y))
        image.putpixel((x, y), tuple(max(0, min(255, c + shade)) for c in pixel))

    draw.text((MARGIN, 120), title, font=font(58, True), fill=(24, 28, 36))
    draw.line([(MARGIN, 215), (WIDTH - MARGIN, 215)], fill=(160, 168, 180), width=3)

    y = 270
    for text, size, bold, gap in lines:
        if text == "---":
            draw.line([(MARGIN, y + 10), (WIDTH - MARGIN, y + 10)], fill=(200, 205, 214), width=2)
            y += gap
            continue
        draw.text((MARGIN, y), text, font=font(size, bold), fill=(38, 44, 54) if bold else (58, 64, 76))
        y += gap

    image.save(os.path.join(out_dir, name), quality=92)


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "demo"
    os.makedirs(out_dir, exist_ok=True)
    random.seed(7)  # Stable output, so screenshots diff cleanly between runs.

    page(out_dir, "invoice-1.jpg", "INVOICE", [
        ("Northwind Supplies Ltd", 34, True, 46),
        ("42 Harbour Road, Bristol BS1 4QA", 28, False, 38),
        ("---", 0, False, 34),
        ("Invoice no.   NW-2026-0418", 30, False, 42),
        ("Date          4 September 2026", 30, False, 42),
        ("Due           2 October 2026", 30, False, 56),
        ("---", 0, False, 40),
        ("Description                          Qty      Amount", 28, True, 48),
        ("A4 archival paper, 500 sheets          4      £71.60", 28, False, 40),
        ("Toner cartridge, black                 2      £118.00", 28, False, 40),
        ("Document wallets, pack of 25           6      £42.30", 28, False, 56),
        ("---", 0, False, 40),
        ("Subtotal                                     £241.40", 30, False, 42),
        ("VAT at 20%                                    £48.28", 30, False, 42),
        ("Total due                                    £289.68", 34, True, 70),
    ])

    page(out_dir, "invoice-2.jpg", "TERMS OF SUPPLY", [
        ("1.  Delivery", 32, True, 46),
        ("Goods are dispatched within three working days of", 27, False, 36),
        ("order confirmation. Risk passes on delivery.", 27, False, 52),
        ("2.  Payment", 32, True, 46),
        ("Invoices fall due 28 days from the date of issue.", 27, False, 52),
        ("3.  Returns", 32, True, 46),
        ("Unopened goods may be returned within 14 days.", 27, False, 52),
    ])

    page(out_dir, "receipt.jpg", "CAFÉ RECEIPT", [
        ("The Copper Kettle", 34, True, 46),
        ("12 Mill Lane  ·  6 Sept 2026  ·  09:14", 26, False, 52),
        ("---", 0, False, 40),
        ("Flat white                            £3.40", 28, False, 40),
        ("Almond croissant                      £3.10", 28, False, 56),
        ("---", 0, False, 40),
        ("Total                                 £8.70", 32, True, 46),
    ], tint=(250, 249, 245))

    print("wrote 3 pages to", out_dir)


if __name__ == "__main__":
    main()
