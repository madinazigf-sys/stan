# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
npm run lint      # Run ESLint
npm run deploy    # Build and deploy to GitHub Pages via gh-pages
```

No test suite is configured.

## Architecture

**ScorePractice** is a browser-only app that renders MusicXML sheet music and advances a cursor as the user plays the correct notes into a microphone.

### Data flow

```
Microphone → usePitchDetection (pitchy) → onNoteDetected(midi) → ScoreViewer.checkNote(midi, strictMode)
                                                                          ↓
                                                               OSMD cursor.next() on match
```

1. `usePitchDetection` (`src/hooks/usePitchDetection.js`) runs a `requestAnimationFrame` loop, detects pitch via pitchy's McLeod Pitch Method, and fires `onNoteDetected(midi)` only after a note wins a majority vote over a 6-frame sliding window (debounce for stability). After 8 silent frames the vote buffer resets so the same note can re-trigger.

2. `App.jsx` wires the hook to `ScoreViewer` via a `useCallback`-wrapped `handleNoteDetected`, and owns the `strictMode` toggle (pitch-class vs. exact-octave match).

3. `ScoreViewer` (`src/components/ScoreViewer.jsx`) is a `forwardRef` component that wraps OSMD. It exposes two imperative methods via `useImperativeHandle`:
   - `checkNote(midi, strictMode)` — compares detected MIDI to `note.Pitch.halfTone` under the cursor; advances cursor on match; auto-skips rests.
   - `reset()` — resets cursor and re-renders the score.

   Guard refs (`readyRef`, `busyRef`) prevent calls during loading or re-render.

4. `Controls.jsx` is a pure presentational component (listen/stop/reset buttons, mic selector, volume meter, note display).

5. `src/utils/musicUtils.js` — stateless helpers: `freqToMidi`, `midiToNoteName`, pitch-class and exact-match comparisons. OSMD's `note.halfTone` is MIDI-compatible (C4=60, A4=69) — no offset needed.

### File loading

`App.jsx` validates uploads before passing to OSMD:
- ZIP magic bytes (`PK`) + inner `.mscx` entry → reject as MuseScore format
- Plain XML without `score-partwise`/`score-timewise` → reject as non-MusicXML
- Valid files are passed as `File` objects directly to `osmd.load()`

`public/test-score.xml` is a C-major scale used for the built-in test button.

### Pitch detection tuning constants (`usePitchDetection.js`)

| Constant | Value | Purpose |
|---|---|---|
| `CLARITY_THRESHOLD` | 0.6 | Minimum pitchy clarity to accept a reading |
| `STABLE_FRAMES` / `VOTE_WINDOW` | 3 / 6 | Voting window size |
| `VOTE_THRESHOLD` | 4 | Votes needed in window to trigger |
| Silent frames to reset | 8 | Silence gap before same note can re-trigger |

### ESLint

Config is flat-format (`eslint.config.js`). `no-unused-vars` ignores names matching `/^[A-Z_]/`.
