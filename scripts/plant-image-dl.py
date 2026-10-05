#!/usr/bin/env python3
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "pinterest-dl>=1.0.0",
# ]
# ///
"""
Download plant photography for the seeded catalogue from Pinterest.

Adapted from Shayga's scripts/pinterest-dl.py, which was written for sarees.
Same `pinterest-dl` package, same search-then-rename approach; the difference is
that the queries are PER SPECIES rather than a single generic batch, because a
jade plant card showing a money plant is worse than no photograph at all.

Usage:
    uv run scripts/plant-image-dl.py                    # all species
    uv run scripts/plant-image-dl.py money-plant        # one species
    uv run scripts/plant-image-dl.py --list
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pinterest_dl import PinterestDL

# Public dir for the storefront images.
PUBLIC = Path(__file__).resolve().parent.parent / "public" / "images" / "plants"

# ── THE CATALOGUE ──────────────────────────────────────────────────────────────
# Keys are the Species.slug values in scripts/seed-catalogue.ts, so the filename
# a card asks for and the file that exists cannot drift.
#
# Queries are deliberately specific and include `houseplant` / `indoor` to bias
# away from Pinterest's very large volume of outdoor-garden and succulent-wall
# art. Several queries per species are run into ONE shared temp dir and the
# results are renamed in order, which is how the Shayga script gets variety
# without one query per image.
#
# `min_resolution` is 600x600: a catalogue card renders at roughly 340px wide but
# is shown on a 2x phone, so anything under 600 looks soft on exactly the device
# most of the traffic comes from.
SPECIES: dict[str, dict] = {
    "money-plant": {
        "queries": [
            "pothos money plant houseplant potted",
            "pothos epipremnum aureum indoor plant",
            "pothos plant in terracotta pot",
        ],
        "num": 6,
    },
    "snake-plant": {
        "queries": [
            "snake plant sansevieria potted indoor",
            "dracaena trifasciata houseplant pot",
            "snake plant white ceramic pot",
        ],
        "num": 6,
    },
    "zz-plant": {
        "queries": [
            "zz plant zamioculcas potted",
            "zamioculcas zamiifolia houseplant pot",
            "zz plant indoor decor pot",
        ],
        "num": 6,
    },
    "jade-plant": {
        "queries": [
            "jade plant crassula ovata potted",
            "jade plant succulent indoor pot",
            "jade plant bonsai pot",
        ],
        "num": 6,
    },
    "peace-lily": {
        "queries": [
            "peace lily spathiphyllum potted indoor",
            "peace lily plant white pot",
            "spathiphyllum wallisii houseplant",
        ],
        "num": 6,
    },
    "tulsi": {
        "queries": [
            "tulsi plant potted holy basil",
            "tulsi pot in terracotta",
            "tulsi plant doorstep indian",
        ],
        "num": 6,
    },
}

EXTS = (".jpg", ".jpeg", ".png", ".webp")

# Long-edge cap for stored files. A catalogue tile renders ~352px and 2x on a
# phone, so 1400px is generous; Pinterest also returns occasional absurd
# panoramas (one snake-plant pin was 1024x3032, 1.4MB).
MAX_EDGE = 1400


def imagesFor(slug: str) -> list[Path]:
    """Existing downloaded files for one species, in order."""
    return sorted(PUBLIC.glob(f"{slug}-[0-9][0-9].jpg"))


def min_size_ok(path: Path) -> bool:
    """Reject files under ~20KB — Pinterest's tracking pixels and 1px spinners."""
    try:
        return path.stat().st_size >= 20_480
    except OSError:
        return False


def download_one(slug: str, spec: dict, delay: float) -> list[Path]:
    """Download one species' images, returning paths in stable order."""
    tmp = PUBLIC / f".tmp-{slug}"
    tmp.mkdir(parents=True, exist_ok=True)

    for q in spec["queries"]:
        # Remaining quota per query so a species needing 6 images across 3
        # queries does not download 18 and discard 12.
        want = spec["num"] // len(spec["queries"]) + 1
        print(f"    → {q!r} (~{want})", flush=True)
        try:
            # The package exposes FACTORIES, not a constructor: `with_api` for the
            # reverse-engineered API (fast) and `with_browser` for Playwright.
            # An earlier draft called `PinterestDL(...)` and `.download(...)`,
            # neither of which exists — AttributeError on first run. This matches
            # Shayga's script, which is the reference implementation.
            client = PinterestDL.with_api(timeout=30)
            client.search_and_download(
                query=q,
                output_dir=str(tmp),
                num=want,
                min_resolution=(600, 600),
                delay=delay,
            )
        except Exception as exc:  # noqa: BLE001 — one bad query must not kill the run
            print(f"    ! query failed: {type(exc).__name__}: {exc}", file=sys.stderr)

    found = sorted(p for p in tmp.iterdir() if p.suffix.lower() in EXTS and min_size_ok(p))
    return found


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("species", nargs="*", help="slugs to fetch (default: all)")
    ap.add_argument("--list", action="store_true", help="print known slugs and exit")
    ap.add_argument("--delay", type=float, default=0.6)
    ap.add_argument(
        "--force", action="store_true", help="re-download even if images exist"
    )
    args = ap.parse_args()

    if args.list:
        for slug, spec in SPECIES.items():
            print(f"{slug:16} {len(spec['queries'])} queries × ~{spec['num'] // len(spec['queries']) + 1}")
        return

    wanted = args.species or list(SPECIES)
    unknown = [s for s in wanted if s not in SPECIES]
    if unknown:
        sys.exit(f"Unknown species: {', '.join(unknown)}. Known: {', '.join(SPECIES)}")

    PUBLIC.mkdir(parents=True, exist_ok=True)

    for slug in wanted:
        spec = SPECIES[slug]
        existing = imagesFor(slug)

        # Idempotence. The Shayga script this is adapted from bails when every
        # expected file exists; same idea, but per species so adding a seventh
        # species does not re-download the other six, and the size cap is
        # re-applied to files that predate it (one snake-plant pin was 1.4MB).
        if len(existing) >= spec["num"] and not args.force:
            resized = [cap_long_edge(p, MAX_EDGE) for p in existing]
            print(f"📸  {slug}: {len(existing)} already present, skipping")
            if resized:
                print(f"    ↻ capped {len(resized)} oversized file(s) to {MAX_EDGE}px")
            continue

        print(f"\n📸  {slug}")
        found = download_one(slug, spec, args.delay)

        kept = 0
        for i, src in enumerate(found, start=1):
            dest = PUBLIC / f"{slug}-{i:02d}.jpg"
            # Normalise everything to JPEG: the storefront serves one format, and
            # mixing webp/png into a Next static dir means the loader has to
            # branch on extension for no benefit.
            subprocess_sips(src, dest)
            cap_long_edge(dest, MAX_EDGE)
            kept += 1

        # Drop the temp dir so a later run re-fetches rather than treating stale
        # downloads as new ones.
        for leftover in (PUBLIC / f".tmp-{slug}").glob("*"):
            leftover.unlink()
        (PUBLIC / f".tmp-{slug}").rmdir()

        print(f"    ✅ {slug}: {kept} image(s)", flush=True)

    print("\n✅ Done.")


def subprocess_sips(src: Path, dest: Path) -> None:
    """Convert with macOS `sips`, falling back to a byte copy for JPEGs."""
    import shutil
    import subprocess

    if src.suffix.lower() in (".jpg", ".jpeg"):
        shutil.copy(src, dest)
        return
    subprocess.run(
        ["sips", "-s", "format", "jpeg", str(src), "--out", str(dest)],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if not dest.exists():
        shutil.copy(src, dest)


def cap_long_edge(path: Path, max_edge: int) -> bool:
    """Downscale so neither side exceeds `max_edge`. Returns True if it resized.

    `sips -Z` resamples the LONG edge to the given size and preserves aspect, so
    one call covers both portrait and landscape pins. Re-encoding an already
    small file is avoided by reading the current dimensions first: sips always
    re-compresses, and doing that repeatedly to the same file loses quality for
    no benefit.
    """
    import subprocess

    try:
        out = subprocess.run(
            ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
            capture_output=True,
            text=True,
            check=False,
        ).stdout
        dims = dict(
            (k, int(v))
            for k, v in (
                (line.split(":")[0].strip(), line.split(":")[1].strip())
                for line in out.splitlines()
                if ":" in line and "pixel" in line
            )
        )
        w, h = dims.get("pixelWidth", 0), dims.get("pixelHeight", 0)
        if max(w, h) <= max_edge:
            return False
    except (ValueError, OSError):
        return False

    subprocess.run(
        ["sips", "-Z", str(max_edge), str(path)],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return True


if __name__ == "__main__":
    main()