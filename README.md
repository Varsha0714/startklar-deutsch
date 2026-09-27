# Startklar Deutsch

A phone-first practice app for the **Goethe-Zertifikat A1 (Start Deutsch 1)** and **A2** German exams.

**Open the app:** https://varsha0714.github.io/startklar-deutsch/

## What it does
- **Daily plan** that adapts to your weak spots, with a fixed 9-day countdown before the A1 exam (mock tests on day 5 and day 2 before the exam).
- **Listening (Hören)** in the exam format: short dialogues, announcements (played once), phone messages. Uses your device's German text-to-speech voice.
- **Unlimited number & time drills**: prices, times ("halb sieben"), dates, phone numbers, spelling.
- **Vocabulary** (~450 words, Goethe word-list themes) with spaced repetition, listening-only mode and a der/die/das drill.
- **Reading, writing and speaking** tasks with instant checks and model answers.
- **English help** beside every question and option (toggle with the EN button).
- **Analysis**: estimated score per exam part, weak spots, listening traps, activity.

All exercises are original practice material written in the style of the exam; they are not official Goethe-Institut material.

## On iPhone
Open the link in Safari → Share → **Add to Home Screen**. Always open it from that icon: progress is stored on the device, in the browser.
No German voice? Settings → Accessibility → Spoken Content → Voices → German.

## Development
Source is in `src/`. Run `sh build.sh` to rebuild `index.html` (website) and `startklar.html` (Claude artifact version).
