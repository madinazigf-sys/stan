import { useEffect, useRef, useState } from 'react';

// Status values:
//   'unsupported' — Web MIDI API not available (Safari, Firefox without extension)
//   'denied'      — user denied permission
//   'no-device'   — access granted but no MIDI inputs connected
//   'connected'   — at least one MIDI input is active
export default function useMidiInput({ onNoteDetected }) {
  const [midiStatus, setMidiStatus] = useState(
    typeof navigator !== 'undefined' && navigator.requestMIDIAccess
      ? 'no-device'
      : 'unsupported',
  );

  // Keep the callback in a ref so MIDI handlers always call the latest version
  // without needing to re-attach on every strictMode change.
  const callbackRef = useRef(onNoteDetected);
  useEffect(() => { callbackRef.current = onNoteDetected; }, [onNoteDetected]);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;

    let access = null;

    const handleMessage = (e) => {
      const [status, note, velocity] = e.data;
      // Note On: high nibble 0x9, velocity > 0
      if ((status & 0xF0) === 0x90 && velocity > 0) {
        callbackRef.current?.(note);
      }
    };

    const attachInputs = (midiAccess) => {
      midiAccess.inputs.forEach(input => { input.onmidimessage = handleMessage; });
      setMidiStatus(midiAccess.inputs.size > 0 ? 'connected' : 'no-device');
    };

    navigator.requestMIDIAccess().then(midiAccess => {
      access = midiAccess;
      attachInputs(access);
      access.onstatechange = () => attachInputs(access);
    }).catch(() => {
      setMidiStatus('denied');
    });

    return () => {
      if (access) {
        access.inputs.forEach(input => { input.onmidimessage = null; });
        access.onstatechange = null;
      }
    };
  }, []);

  return { midiStatus };
}
