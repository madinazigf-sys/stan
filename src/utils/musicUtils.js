const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function freqToMidi(freq) {
  if (!freq || freq <= 0 || isNaN(freq)) return null;
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

export function midiToNoteName(midi) {
  if (midi === null || midi === undefined) return '—';
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

export function midiToPitchClass(midi) {
  return NOTE_NAMES[midi % 12];
}

// OSMD note.halfTone is MIDI-compatible (C4=60, A4=69)
export function osmdNoteToMidi(note) {
  return note.halfTone;
}

export function notesMatchPitchClass(midi1, midi2) {
  return (midi1 % 12) === (midi2 % 12);
}

export function notesMatchExact(midi1, midi2) {
  return midi1 === midi2;
}
