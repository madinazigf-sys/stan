import { useEffect, useRef, useState } from 'react';

// Status values:
//   'unsupported' — Web MIDI API not available and no WS URL configured
//   'denied'      — user denied Web MIDI permission
//   'no-device'   — Web MIDI granted but no inputs connected
//   'connected'   — Web MIDI input active
//   'ws-waiting'  — WebSocket bridge: connecting
//   'ws-connected'— WebSocket bridge: connected
//   'ws-error'    — WebSocket bridge: failed to connect

const WS_RECONNECT_DELAY = 3000; // ms between reconnect attempts

export default function useMidiInput({ onNoteDetected, wsUrl = null }) {
  const hasWebMidi = typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess;

  const [midiStatus, setMidiStatus] = useState(() => {
    if (hasWebMidi) return 'no-device';
    if (wsUrl) return 'ws-waiting';
    return 'unsupported';
  });

  const callbackRef = useRef(onNoteDetected);
  useEffect(() => { callbackRef.current = onNoteDetected; }, [onNoteDetected]);

  // --- Web MIDI path ---
  useEffect(() => {
    if (!hasWebMidi) return;

    let access = null;

    const handleMessage = (e) => {
      const [status, note, velocity] = e.data;
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
  }, [hasWebMidi]);

  // --- WebSocket bridge path (fallback for iPad/Safari) ---
  useEffect(() => {
    if (hasWebMidi || !wsUrl) return;

    let ws = null;
    let stopped = false;
    let retryTimer = null;

    const connect = () => {
      if (stopped) return;
      setMidiStatus('ws-waiting');

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (stopped) { ws.close(); return; }
        setMidiStatus('ws-connected');
      };

      ws.onmessage = (e) => {
        try {
          const { midi } = JSON.parse(e.data);
          if (typeof midi === 'number') callbackRef.current?.(midi);
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => {
        if (stopped) return;
        setMidiStatus('ws-error');
        retryTimer = setTimeout(connect, WS_RECONNECT_DELAY);
      };

      ws.onerror = () => {
        // onclose fires right after, which handles retry
      };
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, [hasWebMidi, wsUrl]);

  return { midiStatus };
}
