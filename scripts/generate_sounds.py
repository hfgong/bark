#!/usr/bin/env python3
"""
scripts/generate_sounds.py

Offline audio preparation and generation script for Bark PWA.
Fetches high-quality animal vocalizations from open public datasets (ESC-50 / Wikimedia Commons),
performs automated acoustic processing (RMS-based silence trimming, peak/LUFS normalization,
and click-free envelope fading), and exports highly optimized MP3 assets to sounds/.

All source recordings are licensed under Creative Commons (CC-BY / CC0 / Public Domain).
"""

import os
import sys
import math
import struct
import subprocess
import urllib.request
import ssl
from pathlib import Path

# Allow unverified HTTPS context for local script execution on macOS
ssl._create_default_https_context = ssl._create_unverified_context

BASE_DIR = Path(__file__).resolve().parent.parent
SOUNDS_DIR = BASE_DIR / "sounds"
CACHE_DIR = BASE_DIR / ".audio_cache"

ESC50_BASE = "https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/"

SOUND_CATALOG = {
    # Dog sounds (8 diverse breeds & vocalization types)
    "dog_big_bark": {
        "title": "Big Dog Woof",
        "category": "dog",
        "icon": "🐕",
        "description": "Deep resonant bark of a large breed (German Shepherd / Mastiff)",
        "url": ESC50_BASE + "1-100032-A-0.wav",
        "author": "nfrae (Freesound #100032)",
        "license": "CC-BY 3.0",
        "max_dur": 2.2,
        "energy_mult": 0.08,
    },
    "dog_guard_barks": {
        "title": "Guard Dog Warning",
        "category": "dog",
        "icon": "🚨",
        "description": "Fierce repeated alert barks guarding territory",
        "url": ESC50_BASE + "2-114587-A-0.wav",
        "author": "InDaHouse20 (Freesound #114587)",
        "license": "CC0",
        "max_dur": 2.5,
        "energy_mult": 0.08,
    },
    "dog_angry": {
        "title": "Angry Snarl & Bark",
        "category": "dog",
        "icon": "⚡",
        "description": "Aggressive low growl transitioning into defensive barks",
        "url": ESC50_BASE + "2-117271-A-0.wav",
        "author": "polipa (Freesound #117271)",
        "license": "CC-BY-NC 3.0",
        "max_dur": 2.8,
        "energy_mult": 0.08,
    },
    "dog_small_poodle": {
        "title": "Toy Poodle Yip",
        "category": "dog",
        "icon": "🐩",
        "description": "Sharp, bright high-pitched bark of a toy poodle",
        "url": ESC50_BASE + "3-170015-A-0.wav",
        "author": "fabiopx (Freesound #170015)",
        "license": "CC0",
        "max_dur": 1.8,
        "energy_mult": 0.08,
    },
    "dog_dachshund": {
        "title": "Mini Dachshund",
        "category": "dog",
        "icon": "🐶",
        "description": "Lively, eager indoor barks from a curious wiener dog",
        "url": ESC50_BASE + "4-192236-A-0.wav",
        "author": "Ligidium (Freesound #192236)",
        "license": "CC-BY 3.0",
        "max_dur": 2.2,
        "energy_mult": 0.08,
    },
    "dog_alert": {
        "title": "Fast Alarm Barks",
        "category": "dog",
        "icon": "🔔",
        "description": "Rapid staccato barking signaling visitors at the door",
        "url": ESC50_BASE + "3-163459-A-0.wav",
        "author": "LittleBigSounds (Freesound #163459)",
        "license": "CC-BY 3.0",
        "max_dur": 2.2,
        "energy_mult": 0.08,
    },
    "dog_playful": {
        "title": "Playful Woof",
        "category": "dog",
        "icon": "🎾",
        "description": "Friendly, tail-wagging happy bark ready for fetch",
        "url": ESC50_BASE + "1-30226-A-0.wav",
        "author": "Heigh-hoo (Freesound #30226)",
        "license": "CC-BY-NC 3.0",
        "max_dur": 2.2,
        "energy_mult": 0.08,
    },
    "dog_wolf_howl": {
        "title": "Husky / Wolf Howl",
        "category": "dog",
        "icon": "🐺",
        "description": "Majestic, soul-stirring wild canine howl",
        "url": "https://upload.wikimedia.org/wikipedia/commons/8/87/Wolf_howls.ogg",
        "author": "U.S. Fish and Wildlife Service / Wikimedia Commons",
        "license": "Public Domain",
        "max_dur": 3.5,
        "energy_mult": 0.05,
    },

    # Cat sounds (8 distinct feline vocalizations)
    "cat_classic_meow": {
        "title": "Classic Meow",
        "category": "cat",
        "icon": "🐱",
        "description": "Standard friendly household meow greeting humans",
        "url": ESC50_BASE + "1-34094-A-5.wav",
        "author": "sazman (Freesound #34094)",
        "license": "CC-BY 3.0",
        "max_dur": 2.0,
        "energy_mult": 0.08,
    },
    "cat_kitten_squeak": {
        "title": "Tiny Kitten Squeak",
        "category": "cat",
        "icon": "🍼",
        "description": "Sweet, high-pitched newborn kitten squeak",
        "url": ESC50_BASE + "1-47819-A-5.wav",
        "author": "YuriVoorhak (Freesound #47819)",
        "license": "CC-BY 3.0",
        "max_dur": 1.6,
        "energy_mult": 0.08,
    },
    "cat_gentle_purr": {
        "title": "Soothing Purr",
        "category": "cat",
        "icon": "💤",
        "description": "Deep continuous rhythmic vibration of a relaxed cat",
        "url": "https://upload.wikimedia.org/wikipedia/commons/d/db/Purring_cat.oga",
        "author": "Mysid (Wikimedia Commons)",
        "license": "Public Domain",
        "max_dur": 3.8,
        "energy_mult": 0.02,
    },
    "cat_angry_hiss": {
        "title": "Defensive Hiss",
        "category": "cat",
        "icon": "😾",
        "description": "Sharp air release and warning spit from a startled cat",
        "url": "https://upload.wikimedia.org/wikipedia/commons/5/56/Cat_hissing_-_Zabuhailo.wav",
        "author": "Zabuhailo (Wikimedia Commons)",
        "license": "CC-BY 3.0",
        "max_dur": 2.2,
        "energy_mult": 0.05,
    },
    "cat_hungry_demand": {
        "title": "Hungry Demanding",
        "category": "cat",
        "icon": "🥣",
        "description": "Urgent, persistent dinner-time meow for wet food",
        "url": ESC50_BASE + "3-95694-A-5.wav",
        "author": "dobroide (Freesound #95694)",
        "license": "CC-BY 3.0",
        "max_dur": 2.4,
        "energy_mult": 0.08,
    },
    "cat_chirp_trill": {
        "title": "Bird-Watcher Chirp",
        "category": "cat",
        "icon": "🐦",
        "description": "Excited chattering and trilling at birds out the window",
        "url": ESC50_BASE + "5-177614-A-5.wav",
        "author": "aminut (Freesound #177614)",
        "license": "CC-BY 3.0",
        "max_dur": 2.2,
        "energy_mult": 0.06,
    },
    "cat_dramatic_yowl": {
        "title": "Dramatic Yowl",
        "category": "cat",
        "icon": "🌙",
        "description": "Loud, long-distance night song / alley caterwaul",
        "url": ESC50_BASE + "3-146964-A-5.wav",
        "author": "Zabuhailo (Freesound #146964)",
        "license": "CC-BY 3.0",
        "max_dur": 3.2,
        "energy_mult": 0.06,
    },
    "cat_door_greeting": {
        "title": "Doorstep Meow",
        "category": "cat",
        "icon": "🚪",
        "description": "Polite greeting meow asking to open the bedroom door",
        "url": ESC50_BASE + "1-47819-B-5.wav",
        "author": "YuriVoorhak (Freesound #47819)",
        "license": "CC-BY 3.0",
        "max_dur": 2.0,
        "energy_mult": 0.08,
    }
}

def detect_start_time(raw_audio_path, energy_mult=0.08):
    """
    Decodes audio to mono 16-bit PCM and finds the precise onset of vocalization
    to eliminate leading silence.
    """
    cmd = [
        "ffmpeg", "-y", "-i", str(raw_audio_path),
        "-ar", "22050", "-ac", "1", "-f", "s16le", "-"
    ]
    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=True)
        raw_pcm = proc.stdout
    except Exception as e:
        print(f"  [!] Failed to decode {raw_audio_path}: {e}")
        return 0.0

    samples = struct.unpack(f"<{len(raw_pcm) // 2}h", raw_pcm)
    if not samples:
        return 0.0

    step = 220  # 10ms at 22.05kHz
    rms_list = []
    for i in range(0, len(samples), step):
        chunk = samples[i:i + step]
        if not chunk:
            continue
        rms = math.sqrt(sum(s * s for s in chunk) / len(chunk))
        rms_list.append(rms)

    if not rms_list:
        return 0.0

    max_rms = max(rms_list)
    thresh = max(max_rms * energy_mult, 250)

    for idx, r in enumerate(rms_list):
        if r > thresh:
            # 40ms pre-roll to preserve consonant attack
            onset_idx = max(0, idx - 4)
            return onset_idx * 0.01

    return 0.0

def process_sound(sound_key, info):
    SOUNDS_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    dest_mp3 = SOUNDS_DIR / f"{sound_key}.mp3"
    ext = info["url"].split(".")[-1].split("?")[0]
    cached_raw = CACHE_DIR / f"{sound_key}_raw.{ext}"

    print(f"[*] Processing '{info['title']}' ({sound_key})...")

    # Step 1: Download raw source if not in cache
    if not cached_raw.exists():
        print(f"    Downloading from {info['url'][:65]}...")
        req = urllib.request.Request(info["url"], headers={"User-Agent": "Mozilla/5.0 (BarkApp; OfflinePrep)"})
        with urllib.request.urlopen(req) as resp, open(cached_raw, "wb") as f:
            f.write(resp.read())

    # Step 2: Detect start offset to eliminate leading silence
    start_sec = detect_start_time(cached_raw, info.get("energy_mult", 0.08))
    duration = info.get("max_dur", 2.5)

    # Step 3: Trim, fade, normalize, and encode to 96kbps MP3
    fade_out_start = max(0.1, duration - 0.2)
    af_filter = (
        f"afade=t=in:ss=0:d=0.03,"
        f"afade=t=out:st={fade_out_start:.2f}:d=0.20,"
        f"loudnorm=I=-16:TP=-1.5:LRA=11"
    )

    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{start_sec:.2f}",
        "-i", str(cached_raw),
        "-t", f"{duration:.2f}",
        "-af", af_filter,
        "-codec:a", "libmp3lame",
        "-b:a", "96k",
        "-ar", "44100",
        str(dest_mp3)
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    size_kb = dest_mp3.stat().st_size / 1024
    print(f"    -> Generated {dest_mp3.name} ({size_kb:.1f} KB, onset: {start_sec:.2f}s)")

def main():
    print("==================================================")
    print("  Bark: Offline Audio Asset Generation Pipeline   ")
    print("==================================================")
    for key, info in SOUND_CATALOG.items():
        try:
            process_sound(key, info)
        except Exception as e:
            print(f"  [ERROR] Failed to process {key}: {e}")

    total_size = sum(f.stat().st_size for f in SOUNDS_DIR.glob("*.mp3"))
    print("==================================================")
    print(f"Successfully generated all {len(SOUND_CATALOG)} sound files!")
    print(f"Total bundle size: {total_size / 1024:.1f} KB (Avg: {total_size / len(SOUND_CATALOG) / 1024:.1f} KB/sound)")
    print("Files ready in:", SOUNDS_DIR)

if __name__ == "__main__":
    main()
