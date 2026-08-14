#!/usr/bin/env python3
"""High-quality local background removal with rembg + BiRefNet."""

import json
import os
import sys
from collections import Counter

from PIL import Image
from rembg import new_session, remove

MODEL = os.environ.get("BG_MODEL", "birefnet-general")

PALETTE = {
    "red": (200, 40, 40),
    "green": (40, 150, 70),
    "blue": (40, 80, 190),
    "black": (25, 25, 25),
    "white": (245, 245, 245),
    "yellow": (230, 200, 50),
    "purple": (130, 50, 170),
    "orange": (230, 120, 40),
    "pink": (230, 110, 160),
    "brown": (130, 80, 45),
    "gray": (140, 140, 140),
    "navy": (20, 40, 90),
    "beige": (210, 190, 160),
}


def log(message):
    print(message, file=sys.stderr, flush=True)


def nearest_color(r, g, b):
    best_name = "gray"
    best_distance = float("inf")
    for name, (pr, pg, pb) in PALETTE.items():
        distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
        if distance < best_distance:
            best_distance = distance
            best_name = name
    return best_name


def color_tags(image):
    small = image.convert("RGBA").resize((64, 64))
    counts = Counter()
    visible = 0
    for r, g, b, a in small.getdata():
        if a < 40:
            continue
        visible += 1
        counts[nearest_color(r, g, b)] += 1

    if not visible or not counts:
        return []

    ranked = counts.most_common()
    top_color, top_count = ranked[0]
    if len(ranked) > 1:
        second_color, second_count = ranked[1]
        if second_count / visible > 0.22 and top_count / visible < 0.55:
            return ["color:colorful"]
    return [f"color:{top_color}"]


def cut_out(image, session):
    try:
        return remove(
            image,
            session=session,
            alpha_matting=True,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=10,
            post_process_mask=True,
        )
    except Exception as error:
        log(f"Alpha matting failed ({error}); retrying without it")
        return remove(image, session=session, post_process_mask=True)


def main():
    args = sys.argv[1:]
    if len(args) < 2 or len(args) % 2:
        sys.exit("usage: remove-bg.py input output [input output ...]")

    log(f"Loading {MODEL} (first run downloads the model)")
    session = new_session(MODEL)
    results = []

    for index in range(0, len(args), 2):
        source = args[index]
        destination = args[index + 1]
        log(f"Removing background: {source}")
        try:
            image = Image.open(source).convert("RGBA")
            cut = cut_out(image, session)
            os.makedirs(os.path.dirname(destination) or ".", exist_ok=True)
            cut.save(destination, "PNG")
            results.append({
                "input": source,
                "output": destination,
                "tags": color_tags(cut),
                "ok": True
            })
            log(f"Saved {destination}")
        except Exception as error:
            log(f"Failed {source}: {error}")
            results.append({
                "input": source,
                "output": source,
                "tags": [],
                "ok": False
            })

    print("RESULT " + json.dumps(results), flush=True)


if __name__ == "__main__":
    main()
