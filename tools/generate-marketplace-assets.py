#!/usr/bin/env python3
# SPDX-License-Identifier: MPL-2.0

"""Generate simple Marketplace PNG assets for the Sheets add-on prototype."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path


OUT_DIR = Path("docs/google-sheets-editor-addon/assets/marketplace")

BG = (16, 73, 54, 255)
BG_DARK = (10, 50, 37, 255)
MINT = (166, 222, 193, 255)
CREAM = (245, 243, 236, 255)
GOLD = (227, 190, 94, 255)
GRID = (43, 104, 82, 255)


FONT_5X7 = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
}


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


class Canvas:
    def __init__(self, width: int, height: int, color=(255, 255, 255, 0)) -> None:
        self.width = width
        self.height = height
        self.pixels = [[color for _ in range(width)] for _ in range(height)]

    def set_pixel(self, x: int, y: int, color) -> None:
        if 0 <= x < self.width and 0 <= y < self.height:
            self.pixels[y][x] = color

    def fill(self, color) -> None:
        for y in range(self.height):
            row = self.pixels[y]
            for x in range(self.width):
                row[x] = color

    def rect(self, x: int, y: int, w: int, h: int, color) -> None:
        for yy in range(max(0, y), min(self.height, y + h)):
            row = self.pixels[yy]
            for xx in range(max(0, x), min(self.width, x + w)):
                row[xx] = color

    def line(self, x1: int, y1: int, x2: int, y2: int, color, thickness: int = 1) -> None:
        dx = abs(x2 - x1)
        sx = 1 if x1 < x2 else -1
        dy = -abs(y2 - y1)
        sy = 1 if y1 < y2 else -1
        err = dx + dy
        while True:
            half = thickness // 2
            for yy in range(y1 - half, y1 - half + thickness):
                for xx in range(x1 - half, x1 - half + thickness):
                    self.set_pixel(xx, yy, color)
            if x1 == x2 and y1 == y2:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x1 += sx
            if e2 <= dx:
                err += dx
                y1 += sy

    def circle(self, cx: int, cy: int, radius: int, color) -> None:
        r2 = radius * radius
        for y in range(cy - radius, cy + radius + 1):
            for x in range(cx - radius, cx + radius + 1):
                if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2:
                    self.set_pixel(x, y, color)

    def draw_char(self, x: int, y: int, ch: str, scale: int, color) -> int:
        pattern = FONT_5X7.get(ch.upper(), FONT_5X7[" "])
        for row_i, row in enumerate(pattern):
            for col_i, cell in enumerate(row):
                if cell == "1":
                    self.rect(x + col_i * scale, y + row_i * scale, scale, scale, color)
        return 6 * scale

    def draw_text(self, x: int, y: int, text: str, scale: int, color) -> None:
        cursor = x
        for ch in text:
            cursor += self.draw_char(cursor, y, ch, scale, color)

    def save_png(self, path: Path) -> None:
        raw = bytearray()
        for row in self.pixels:
            raw.append(0)
            for r, g, b, a in row:
                raw.extend((r, g, b, a))
        png = b"\x89PNG\r\n\x1a\n"
        png += chunk(b"IHDR", struct.pack(">IIBBBBB", self.width, self.height, 8, 6, 0, 0, 0))
        png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        png += chunk(b"IEND", b"")
        path.write_bytes(png)

    def downsample(self, factor: int) -> "Canvas":
        if factor <= 1:
            return self

        width = self.width // factor
        height = self.height // factor
        output = Canvas(width, height)

        for y in range(height):
            for x in range(width):
                r = g = b = a = 0
                for yy in range(y * factor, (y + 1) * factor):
                    for xx in range(x * factor, (x + 1) * factor):
                        pr, pg, pb, pa = self.pixels[yy][xx]
                        r += pr
                        g += pg
                        b += pb
                        a += pa
                samples = factor * factor
                output.pixels[y][x] = (
                    r // samples,
                    g // samples,
                    b // samples,
                    a // samples,
                )

        return output


def draw_background(c: Canvas) -> None:
    c.fill(BG)
    step = max(8, min(c.width, c.height) // 6)
    for x in range(0, c.width, step):
        c.rect(x, 0, 1, c.height, GRID)
    for y in range(0, c.height, step):
        c.rect(0, y, c.width, 1, GRID)
    c.line(0, c.height - 1, c.width - 1, 0, BG_DARK, thickness=max(2, min(c.width, c.height) // 18))


def draw_chart(c: Canvas) -> None:
    points = [
        (int(c.width * 0.15), int(c.height * 0.70)),
        (int(c.width * 0.35), int(c.height * 0.52)),
        (int(c.width * 0.52), int(c.height * 0.58)),
        (int(c.width * 0.70), int(c.height * 0.35)),
        (int(c.width * 0.85), int(c.height * 0.24)),
    ]
    thickness = max(2, min(c.width, c.height) // 18)
    for i in range(len(points) - 1):
        c.line(*points[i], *points[i + 1], MINT, thickness=thickness)
    for x, y in points:
        c.circle(x, y, max(2, thickness), CREAM)


def draw_hf_monogram(c: Canvas) -> None:
    scale = max(2, min(c.width, c.height) // 20)
    text = "HF"
    total_w = len(text) * 6 * scale - scale
    x = (c.width - total_w) // 2
    y = int(c.height * 0.14)
    c.draw_text(x, y, text, scale, GOLD)


def build_icon(size: int, filename: str) -> None:
    scale = 4
    c = Canvas(size * scale, size * scale)
    draw_background(c)
    draw_hf_monogram(c)
    draw_chart(c)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    c.downsample(scale).save_png(OUT_DIR / filename)


def build_banner() -> None:
    scale = 4
    c = Canvas(220 * scale, 140 * scale)
    draw_background(c)
    c.rect(12 * scale, 18 * scale, 88 * scale, 88 * scale, BG_DARK)
    inner = Canvas(88 * scale, 88 * scale)
    draw_background(inner)
    draw_hf_monogram(inner)
    draw_chart(inner)
    for y in range(88 * scale):
        for x in range(88 * scale):
            c.set_pixel(12 * scale + x, 18 * scale + y, inner.pixels[y][x])
    c.draw_text(104 * scale, 28 * scale, "HOODLE", 2 * scale, CREAM)
    c.draw_text(104 * scale, 50 * scale, "FINANCE", 2 * scale, GOLD)
    c.draw_text(104 * scale, 78 * scale, "SHEETS", 2 * scale, MINT)
    c.draw_text(104 * scale, 98 * scale, "ADD ON", 2 * scale, MINT)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    c.downsample(scale).save_png(OUT_DIR / "banner-220x140.png")


def main() -> None:
    build_icon(32, "icon-32.png")
    build_icon(48, "icon-48.png")
    build_icon(96, "icon-96.png")
    build_icon(128, "icon-128.png")
    build_banner()


if __name__ == "__main__":
    main()
