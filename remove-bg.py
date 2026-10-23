#!/usr/bin/env python3
"""Background removal with a quality check.

For every photo we make several candidate cut-outs (different models, with and
without alpha matting), clean each one up (drop stray specks, crop to the
subject), score them with mask heuristics and, when ANTHROPIC_API_KEY is set,
let Claude look at the candidates next to the original and pick the cleanest.
The best candidate is saved; the verdict travels back to process-images.js as
`cutout` so the admin page can show how good the cut was.

Usage: remove-bg.py input output [input output ...]
Prints a final line `RESULT <json>` with one entry per input.
"""

import base64
import io
import json
import os
import sys
from collections import Counter

import numpy as np
from PIL import Image, ImageDraw, ImageOps
from rembg import new_session, remove
from scipy import ndimage

PRIMARY_MODEL = os.environ.get("BG_MODEL", "birefnet-general")
SECOND_MODEL = os.environ.get("BG_SECOND_MODEL", "isnet-general-use")
JUDGE_MODEL = os.environ.get("BG_JUDGE_MODEL", "claude-opus-5-5")
MAX_SIDE = 1600          # photos are downscaled to this before everything else
CROP_MARGIN = 0.04       # of the subject's size, kept around it
SPECK_FRACTION = 0.01    # components smaller than this share of the largest are dropped
SHEET_TILE = 480         # px per tile on the contact sheet shown to the judge

PALETTE = {
    "red": (200, 40, 40), "green": (40, 150, 70), "blue": (40, 80, 190), "black": (25, 25, 25),
    "white": (245, 245, 245), "yellow": (230, 200, 50), "purple": (130, 50, 170),
    "orange": (230, 120, 40), "pink": (230, 110, 160), "brown": (130, 80, 45),
    "gray": (140, 140, 140), "navy": (20, 40, 90), "beige": (210, 190, 160),
}
BONE = (244, 241, 236, 255)


def log(message):
    print(message, file=sys.stderr, flush=True)


# --- colour tag (unchanged behaviour) ---------------------------------------

def nearest_color(r, g, b):
    return min(PALETTE, key=lambda n: sum((c - p) ** 2 for c, p in zip((r, g, b), PALETTE[n])))


def color_tags(image):
    small = image.convert("RGBA").resize((64, 64))
    counts = Counter()
    visible = 0
    for r, g, b, a in small.getdata():
        if a < 40:
            continue
        visible += 1
        counts[nearest_color(r, g, b)] += 1
    if not visible:
        return []
    ranked = counts.most_common()
    top_color, top_count = ranked[0]
    if len(ranked) > 1 and ranked[1][1] / visible > 0.22 and top_count / visible < 0.55:
        return ["color:colorful"]
    return [f"color:{top_color}"]


# --- candidates -------------------------------------------------------------

def load_photo(path):
    img = Image.open(path)
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass
    img = img.convert("RGBA")
    if max(img.size) > MAX_SIDE:
        img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    return img


def make_candidates(image, sessions):
    """(label, description, RGBA) for each way of cutting the subject out."""
    out = []
    primary = sessions[PRIMARY_MODEL]
    out.append(("A", f"{PRIMARY_MODEL}", remove(image, session=primary, post_process_mask=True)))
    try:
        out.append(("B", f"{PRIMARY_MODEL} + alpha matting", remove(
            image, session=primary, alpha_matting=True, alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10, alpha_matting_erode_size=10, post_process_mask=True)))
    except Exception as error:
        log(f"Alpha matting failed ({error}); skipping that candidate")
    if SECOND_MODEL in sessions:
        out.append(("C", f"{SECOND_MODEL}", remove(image, session=sessions[SECOND_MODEL], post_process_mask=True)))
    return out


def tidy(rgba):
    """Drop specks that are not part of the main subject, then crop to the subject."""
    arr = np.array(rgba.convert("RGBA"))
    alpha = arr[:, :, 3]
    mask = alpha > 128
    if not mask.any():
        return rgba, {"empty": True}
    labels, count = ndimage.label(mask)
    dropped = 0
    if count > 1:
        sizes = ndimage.sum(mask, labels, range(1, count + 1))
        keep = sizes >= sizes.max() * SPECK_FRACTION
        keep_mask = np.isin(labels, np.flatnonzero(keep) + 1)
        # A soft fringe just outside a kept component stays; everything else goes.
        fringe = ndimage.binary_dilation(keep_mask, iterations=3)
        arr[:, :, 3] = np.where(fringe, alpha, 0)
        dropped = int((~keep).sum())
    alpha = arr[:, :, 3]
    ys, xs = np.nonzero(alpha > 8)
    top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()
    mh = int((bottom - top) * CROP_MARGIN) + 2
    mw = int((right - left) * CROP_MARGIN) + 2
    h, w = alpha.shape
    box = (max(0, left - mw), max(0, top - mh), min(w, right + mw + 1), min(h, bottom + mh + 1))
    return Image.fromarray(arr).crop(box), {"empty": False, "dropped_specks": dropped, "box": [int(v) for v in box]}


def metrics(rgba, full_size):
    """Mask statistics on the tidied cut-out, measured against the original frame."""
    alpha = np.array(rgba.getchannel("A"))
    fg = alpha > 128
    total = int(fg.sum())
    fw, fh = full_size
    labels, count = ndimage.label(fg)
    sizes = ndimage.sum(fg, labels, range(1, count + 1)) if count else np.array([0])
    soft = int(((alpha > 20) & (alpha < 235)).sum())
    return {
        "coverage": round(total / float(fw * fh), 4),
        "components": int(count),
        "largest_frac": round(float(sizes.max() / total), 3) if total else 0.0,
        "soft_frac": round(soft / max(1, int((alpha > 20).sum())), 3),
    }


def heuristic_score(m, box, full_size):
    """0..1, higher is better. Penalise fragmented, mushy or frame-filling masks."""
    if m["coverage"] == 0:
        return 0.0
    score = 1.0
    score -= 0.25 * min(1.0, max(0, m["components"] - 1) / 6.0)   # fragments
    score -= 0.35 * min(1.0, m["soft_frac"] / 0.35)                  # mushy edges
    score -= 0.20 * (1.0 - m["largest_frac"])                         # subject split up
    fw, fh = full_size
    touching = sum([box[0] <= 1, box[1] <= 1, box[2] >= fw - 1, box[3] >= fh - 1])
    score -= 0.08 * touching                                          # background leaked to the edges
    if m["coverage"] < 0.02:
        score -= 0.3                                                  # almost nothing left
    if m["coverage"] > 0.85:
        score -= 0.3                                                  # almost nothing removed
    return round(max(0.0, score), 3)


# --- the judge --------------------------------------------------------------

def contact_sheet(original, candidates):
    """Original plus each candidate on bone, labelled, in one row. Returns JPEG bytes."""
    tiles = [("ORIGINAL", original.convert("RGBA"))] + [(label, img) for label, _, img in candidates]
    sheet = Image.new("RGBA", (SHEET_TILE * len(tiles), SHEET_TILE + 40), BONE)
    draw = ImageDraw.Draw(sheet)
    for i, (label, img) in enumerate(tiles):
        tile = img.copy()
        tile.thumbnail((SHEET_TILE - 16, SHEET_TILE - 16), Image.LANCZOS)
        x = i * SHEET_TILE + (SHEET_TILE - tile.width) // 2
        y = 40 + (SHEET_TILE - tile.height) // 2
        sheet.alpha_composite(tile, (x, y))
        draw.rectangle([i * SHEET_TILE, 0, i * SHEET_TILE + 120, 32], fill=(20, 20, 20, 255))
        draw.text((i * SHEET_TILE + 10, 8), label, fill=(244, 241, 236, 255))
        if i:
            draw.line([(i * SHEET_TILE, 0), (i * SHEET_TILE, sheet.height)], fill=(20, 20, 20, 255), width=2)
    buf = io.BytesIO()
    sheet.convert("RGB").save(buf, "JPEG", quality=88)
    return buf.getvalue()


def ask_judge(original, candidates, source_name):
    """Returns {'best': label|None, 'quality': 1-5, 'issues': str}, or None when the judge is unavailable."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    try:
        import anthropic
        from pydantic import BaseModel
    except ImportError as error:
        log(f"Judge unavailable: {error}")
        return None

    labels = [label for label, _, _ in candidates]

    class Verdict(BaseModel):
        best: str          # one of the labels, or "none"
        quality: int       # 1 (unusable) .. 5 (perfect)
        issues: str        # short note on what is still wrong with the chosen one, or ""

    prompt = (
        "You are checking background removal for a personal inventory website. The first tile is the "
        "original photo. The tiles labelled " + ", ".join(labels) + " are candidate cut-outs of the main "
        "object, shown on a light background. Choose the candidate where the object is complete, its edges "
        "are clean, and no table, floor, wall, shadow or other background remains. Prefer a tight, complete "
        "object over a soft or fragmented one. Rate the chosen candidate from 1 (unusable) to 5 (perfect). "
        "If every candidate is bad, set best to \"none\". Put a short note on what is still wrong in issues "
        "(empty if nothing). The photo is named " + json.dumps(source_name) + "."
    )
    sheet = contact_sheet(original, candidates)
    try:
        client = anthropic.Anthropic()
        response = client.messages.parse(
            model=JUDGE_MODEL,
            max_tokens=2000,
            output_config={"effort": "low"},
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                                 "data": base64.standard_b64encode(sheet).decode()}},
                    {"type": "text", "text": prompt},
                ],
            }],
            output_format=Verdict,
        )
        if response.stop_reason == "refusal":
            log("Judge refused; using heuristics")
            return None
        verdict = response.parsed_output
        best = verdict.best.strip().upper()
        return {
            "best": best if best in labels else None,
            "quality": int(max(1, min(5, verdict.quality))),
            "issues": verdict.issues.strip()[:200],
        }
    except Exception as error:  # network, auth, rate limit: never block the pipeline
        log(f"Judge failed ({type(error).__name__}: {error}); using heuristics")
        return None


# --- main -------------------------------------------------------------------

def process(source, destination, sessions):
    original = load_photo(source)
    candidates = []
    for label, desc, raw in make_candidates(original, sessions):
        tidied, info = tidy(raw)
        if info.get("empty"):
            log(f"  {label} {desc}: empty mask")
            continue
        m = metrics(tidied, original.size)
        score = heuristic_score(m, info["box"], original.size)
        log(f"  {label} {desc}: score {score} {m} specks dropped {info['dropped_specks']}")
        candidates.append({"label": label, "desc": desc, "image": tidied, "score": score, "metrics": m})
    if not candidates:
        raise RuntimeError("no candidate produced a mask")

    by_label = {c["label"]: c for c in candidates}
    verdict = ask_judge(original, [(c["label"], c["desc"], c["image"]) for c in candidates], os.path.basename(source))
    heuristic_best = max(candidates, key=lambda c: c["score"])
    if verdict and verdict["best"]:
        chosen, method = by_label[verdict["best"]], "judge"
    else:
        chosen, method = heuristic_best, "heuristic"
    log(f"  -> {chosen['label']} ({chosen['desc']}) by {method}"
        + (f", quality {verdict['quality']}: {verdict['issues']}" if verdict else ""))

    os.makedirs(os.path.dirname(destination) or ".", exist_ok=True)
    chosen["image"].save(destination, "PNG")
    cutout = {
        "model": chosen["desc"],
        "method": method,
        "score": chosen["score"],
        "candidates": {c["label"]: {"model": c["desc"], "score": c["score"]} for c in candidates},
    }
    if verdict:
        cutout["quality"] = verdict["quality"]
        if verdict["issues"]:
            cutout["issues"] = verdict["issues"]
        if verdict["best"] is None:
            cutout["needsReview"] = True
    elif chosen["score"] < 0.5:
        cutout["needsReview"] = True
    return chosen["image"], cutout


def main():
    args = sys.argv[1:]
    if len(args) < 2 or len(args) % 2:
        sys.exit("usage: remove-bg.py input output [input output ...]")

    log(f"Loading {PRIMARY_MODEL} and {SECOND_MODEL} (first run downloads the models)")
    sessions = {PRIMARY_MODEL: new_session(PRIMARY_MODEL)}
    try:
        sessions[SECOND_MODEL] = new_session(SECOND_MODEL)
    except Exception as error:
        log(f"Second model {SECOND_MODEL} unavailable ({error}); continuing with one model")
    log("Judge: " + (f"Claude ({JUDGE_MODEL})" if os.environ.get("ANTHROPIC_API_KEY") else "off (no ANTHROPIC_API_KEY), heuristics only"))

    results = []
    for index in range(0, len(args), 2):
        source, destination = args[index], args[index + 1]
        log(f"Removing background: {source}")
        try:
            image, cutout = process(source, destination, sessions)
            results.append({"input": source, "output": destination, "tags": color_tags(image), "cutout": cutout, "ok": True})
            log(f"Saved {destination}")
        except Exception as error:
            log(f"Failed {source}: {error}")
            results.append({"input": source, "output": source, "tags": [], "ok": False})

    print("RESULT " + json.dumps(results), flush=True)


if __name__ == "__main__":
    main()
