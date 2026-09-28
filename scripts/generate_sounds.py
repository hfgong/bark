#!/usr/bin/env python3
"""
scripts/generate_sounds.py

Builds the Bark sound bank: one short file per bark / meow, so that one tap plays exactly
one vocalization. Several takes of the same animal are kept as variants; the app picks one
at random per tap so repeated taps sound natural.

Pipeline (requires numpy + scipy, no ffmpeg):
  1. Download the source clips from the ESC-50 dataset (only clips whose individual licence
     is CC0 or CC-BY, as listed in ESC-50's LICENSE file).
  2. Detect each vocalization by RMS energy (10 ms frames) and cut it out with a short
     pre-roll and its natural decay tail, never running into the next one.
  3. Drop faint, distant or clipped takes.
  4. High-pass filter (removes rumble/handling noise), match loudness across all sounds and
     cap peaks at -1 dBFS (no limiter, so no distortion), 3 ms fade-in / 40 ms fade-out.
  5. Write 16-bit mono WAV (no codec delay, so playback starts instantly) plus
     sounds/sounds.json, which the app reads.

Sounds listed in KEPT are existing files that are not regenerated here.
"""

import json
import urllib.request
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, resample_poly, sosfiltfilt

BASE_DIR = Path(__file__).resolve().parent.parent
SOUNDS_DIR = BASE_DIR / "sounds"
CACHE_DIR = BASE_DIR / ".audio_cache"
ESC50 = "https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/"

FRAME = 0.01          # analysis frame, seconds
TARGET_RMS_DB = -17   # loudness of the active part of each take
PEAK_CEILING_DB = -1
OUT_RATE = 32000       # keeps everything up to 16 kHz; ~30% smaller than 44.1 kHz

# Each entry: sources (ESC-50 files), credit (from ESC-50's LICENSE), and selection limits.
CATALOG = [
    # ---- Dogs ----
    dict(id="big_dog", category="dog", icon="🐕", title="Big Dog", desc="Deep single woof",
         sources=["4-182395-A-0.wav"],
         credit="Big_dog_bark_01.aiff by pgonsilva (freesound.org/s/182395), CC BY"),
    dict(id="guard_dog", category="dog", icon="🚨", title="Guard Dog", desc="Firm warning bark",
         sources=["4-191687-A-0.wav"],
         credit="Dog Barks.wav by UnderlinedDesigns (freesound.org/s/191687), CC0"),
    dict(id="spaniel", category="dog", icon="🦮", title="Springer Spaniel", desc="Bright, eager bark",
         sources=["1-110389-A-0.wav"],
         credit="animals_dog_bark_springer_spaniel_001.wav by soundscalpel.com (freesound.org/s/110389), CC BY"),
    dict(id="shih_tzu", category="dog", icon="🐶", title="Shih Tzu Pug", desc="Bark with a howly tail",
         sources=["3-180256-A-0.wav"], max_dur=1.0,
         credit="Dog Barking - Shih Tzu Pug by bspiller5 (freesound.org/s/180256), CC BY"),
    dict(id="dachshund", category="dog", icon="🌭", title="Mini Dachshund", desc="Lively indoor bark",
         sources=["4-192236-A-0.wav"],
         credit="Miniature Dachshund Bark - Indoors.wav by Ligidium (freesound.org/s/192236), CC0"),
    dict(id="poodle", category="dog", icon="🐩", title="Poodle", desc="Single sharp bark",
         sources=["3-170015-A-0.wav"],
         credit="one bark of a poodle dog by fabiopx (freesound.org/s/170015), CC0"),
    dict(id="yappy_pup", category="dog", icon="🐾", title="Yappy Pup", desc="High, snappy yip",
         sources=["5-9032-A-0.wav"],
         credit="Dog bark2.wav by MisterTood (freesound.org/s/9032), CC0"),
    # ---- Cats ----
    dict(id="classic_meow", category="cat", icon="🐱", title="Classic Meow", desc="Friendly meow",
         sources=["5-214759-A-5.wav", "5-214759-B-5.wav"], max_dur=1.3,
         credit="Cat meowing x5 by peridactyloptrix (freesound.org/s/214759), CC0"),
    dict(id="loud_meow", category="cat", icon="📢", title="Loud Meow", desc="Insistent, attention-seeking",
         sources=["5-172639-A-5.wav"], max_dur=1.0,
         credit="Cat.mp3 by telesik (freesound.org/s/172639), CC BY"),
    dict(id="hungry_cat", category="cat", icon="🥣", title="Hungry Cat", desc="Dinner-time demand",
         sources=["3-95695-A-5.wav", "3-95698-A-5.wav"], max_dur=1.2,
         credit="20100423.hungry.cats.02.wav / .05.wav by dobroide (freesound.org/s/95695, /95698), CC BY"),
    dict(id="soft_meow", category="cat", icon="🌙", title="Soft Meow", desc="Gentle, quiet mew",
         sources=["2-82274-A-5.wav", "2-82274-B-5.wav"], max_dur=1.2,
         credit="garage cat 01.wav by Kyster (freesound.org/s/82274), CC BY"),
    dict(id="little_mew", category="cat", icon="🍼", title="Little Mew", desc="Small, high mew",
         sources=["3-95697-A-5.wav"], max_dur=1.0,
         credit="20100423.hungry.cats.04.wav by dobroide (freesound.org/s/95697), CC BY"),
    dict(id="mad_cat", category="cat", icon="😾", title="Mad Cat Yowl", desc="Long, grumpy yowl",
         sources=["4-133047-C-5.wav"], max_dur=1.6,
         credit="MAD CAT !.wav by temawas (freesound.org/s/133047), CC0"),
]

# Existing files kept as-is (not produced by this script); see README for their sources.
KEPT = [
    dict(id="wolf_howl", category="dog", icon="🐺", title="Wolf Howl", desc="Long wild howl",
         files=["sounds/dog_wolf_howl.mp3"],
         credit="Wolf howls, U.S. Fish and Wildlife Service via Wikimedia Commons (public domain)"),
    dict(id="purr", category="cat", icon="💤", title="Purr", desc="Relaxed purring",
         files=["sounds/cat_gentle_purr.mp3"],
         credit="Purring cat by Mysid via Wikimedia Commons (public domain)"),
    dict(id="hiss", category="cat", icon="😼", title="Hiss", desc="Warning hiss",
         files=["sounds/cat_angry_hiss.mp3"],
         credit="Cat hissing by Zabuhailo via Wikimedia Commons (CC BY 3.0)"),
]

DEFAULTS = dict(dog=dict(min_dur=0.08, max_dur=0.7, max_variants=4),
                cat=dict(min_dur=0.25, max_dur=1.2, max_variants=4))


def load(name):
    CACHE_DIR.mkdir(exist_ok=True)
    path = CACHE_DIR / name
    if not path.exists():
        print(f"    downloading {name}")
        with urllib.request.urlopen(ESC50 + name) as resp:
            path.write_bytes(resp.read())
    sr, x = wavfile.read(path)
    x = x.astype(np.float32) / 32768
    if x.ndim > 1:
        x = x.mean(axis=1)
    return sr, x


def frame_db(x, hop):
    n = len(x) // hop
    rms = np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(axis=1))
    return 20 * np.log10(rms + 1e-9)


def find_takes(sr, x, min_dur, max_dur):
    """Returns (start, end, peak_db) sample ranges of individual vocalizations."""
    hop = int(sr * FRAME)
    db = frame_db(x, hop)
    audible = db[db > -120]  # ignore digital silence padding
    floor = np.percentile(audible, 15)
    threshold = max(floor + 15, db.max() - 24)
    on = db > threshold

    # Group frames into events, bridging gaps shorter than 40 ms.
    events, i, n = [], 0, len(db)
    while i < n:
        if not on[i]:
            i += 1
            continue
        j = i
        while j < n and on[j:j + 5].any():
            j += 1
        events.append([i, j])
        i = j

    takes = []
    for k, (a, b) in enumerate(events):
        peak = db[a:b].max()
        # Extend to the natural decay: until 40 dB below the peak or near the noise floor,
        # but stop 20 ms before the next event.
        limit = events[k + 1][0] - 2 if k + 1 < len(events) else n
        end = b
        while end < limit and db[end] > max(peak - 40, floor + 6):
            end += 1
        start = max(0, a - 2)  # 20 ms pre-roll keeps the attack
        end = min(end, start + int(max_dur / FRAME))
        dur = (end - start) * FRAME
        seg = x[start * hop:end * hop]
        if dur < min_dur or np.abs(seg).max() > 0.98:  # too short, or clipped
            continue
        takes.append((start * hop, end * hop, peak))
    return takes


def finish(sr, seg):
    """Resample, high-pass, loudness match with a peak ceiling, and click-free fades."""
    if sr != OUT_RATE:
        g = np.gcd(sr, OUT_RATE)
        seg, sr = resample_poly(seg, OUT_RATE // g, sr // g), OUT_RATE
    sos = butter(2, 70, btype="highpass", fs=sr, output="sos")
    seg = sosfiltfilt(sos, seg)
    hop = int(sr * FRAME)
    db = frame_db(seg, hop)
    active = db > db.max() - 20
    rms_db = 10 * np.log10(np.mean(10 ** (db[active] / 10)))
    peak_db = 20 * np.log10(np.abs(seg).max() + 1e-9)
    gain_db = min(TARGET_RMS_DB - rms_db, PEAK_CEILING_DB - peak_db)
    seg = seg * 10 ** (gain_db / 20)
    fade_in, fade_out = int(sr * 0.003), int(sr * 0.04)
    seg[:fade_in] *= np.linspace(0, 1, fade_in)
    seg[-fade_out:] *= np.cos(np.linspace(0, np.pi / 2, fade_out)) ** 2
    return (np.clip(seg, -1, 1) * 32767).astype(np.int16)


def build(entry):
    opts = {**DEFAULTS[entry["category"]], **entry}
    takes = []  # (recording order, peak_db, sample rate, samples)
    for name in entry["sources"]:
        sr, x = load(name)
        for start, end, peak in find_takes(sr, x, opts["min_dur"], opts["max_dur"]):
            takes.append((len(takes), peak, sr, x[start:end]))
    if not takes:
        raise RuntimeError(f"no usable takes for {entry['id']}")
    # Keep the strongest takes (drops faint / distant ones), in recording order.
    loudest = max(t[1] for t in takes)
    takes = [t for t in takes if t[1] > loudest - 10]
    takes = sorted(sorted(takes, key=lambda t: -t[1])[: opts["max_variants"]])
    files = []
    for n, (_, _, sr, seg) in enumerate(takes, 1):
        rel = f"sounds/{entry['id']}_{n}.wav"
        wavfile.write(BASE_DIR / rel, OUT_RATE, finish(sr, seg))
        files.append(rel)
        print(f"    {rel}: {len(seg) / sr:.2f}s")
    return files


def main():
    SOUNDS_DIR.mkdir(exist_ok=True)
    for old in SOUNDS_DIR.glob("*.wav"):
        old.unlink()
    bank = []
    for entry in CATALOG:
        print(f"[*] {entry['title']}")
        files = build(entry)
        bank.append({k: entry[k] for k in ("id", "category", "icon", "title", "desc", "credit")} | {"files": files})
    bank += [dict(entry) for entry in KEPT]
    bank.sort(key=lambda s: s["category"] != "dog")  # dogs first, stable otherwise
    (SOUNDS_DIR / "sounds.json").write_text(json.dumps(bank, ensure_ascii=False, indent=1) + "\n")
    size = sum(f.stat().st_size for f in SOUNDS_DIR.glob("*.wav"))
    print(f"Wrote {sum(len(s['files']) for s in bank)} files; generated WAVs total {size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
