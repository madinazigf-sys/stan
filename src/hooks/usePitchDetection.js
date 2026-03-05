import { useState, useRef, useCallback, useEffect } from 'react';
import { PitchDetector } from 'pitchy';
import { freqToMidi } from '../utils/musicUtils';

const CLARITY_THRESHOLD = 0.6;  // lower = catches more instruments
const MIN_FREQ = 50;
const MAX_FREQ = 4200;

// Require this many frames in agreement before triggering
const STABLE_FRAMES = 3;
// But accept if the note appeared in majority of last N frames (for percussive instruments)
const VOTE_WINDOW = 6;
const VOTE_THRESHOLD = 4; // out of VOTE_WINDOW

function rms(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

export default function usePitchDetection({ onNoteDetected } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [detectedNote, setDetectedNote] = useState(null);
  const [detectedFreq, setDetectedFreq] = useState(null);
  const [volume, setVolume] = useState(0);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');

  // Always keep a fresh ref to the callback — closure won't go stale
  const onNoteDetectedRef = useRef(onNoteDetected);
  useEffect(() => { onNoteDetectedRef.current = onNoteDetected; }, [onNoteDetected]);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const frameBufferRef = useRef([]); // last VOTE_WINDOW midi values (null = unclear)
  const lastTriggeredRef = useRef(null);
  const silentFramesRef = useRef(0);

  useEffect(() => {
    async function loadDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
          .then(s => s.getTracks().forEach(t => t.stop()))
          .catch(() => {});
        const all = await navigator.mediaDevices.enumerateDevices();
        const inputs = all.filter(d => d.kind === 'audioinput');
        setDevices(inputs);
        if (inputs.length > 0) setDeviceId(inputs[0].deviceId);
      } catch {}
    }
    loadDevices();
  }, []);

  const startListening = useCallback(async () => {
    try {
      const constraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      audioCtx.createMediaStreamSource(stream).connect(analyser);

      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      const input = new Float32Array(detector.inputLength);

      frameBufferRef.current = [];
      lastTriggeredRef.current = null;
      silentFramesRef.current = 0;
      setIsListening(true);

      function detect() {
        // Schedule next frame FIRST — errors in body won't kill the loop
        rafRef.current = requestAnimationFrame(detect);

        try {
          analyser.getFloatTimeDomainData(input);
          const vol = Math.min(1, rms(input) * 10);
          setVolume(vol);

          const [freq, clarity] = detector.findPitch(input, audioCtx.sampleRate);
          const clear = clarity >= CLARITY_THRESHOLD && freq >= MIN_FREQ && freq <= MAX_FREQ;

          if (clear) {
            const midi = freqToMidi(freq);
            setDetectedNote(midi);
            setDetectedFreq(Math.round(freq));
            silentFramesRef.current = 0;

            // Vote buffer: majority of last VOTE_WINDOW frames
            const buf = frameBufferRef.current;
            buf.push(midi);
            if (buf.length > VOTE_WINDOW) buf.shift();

            // Count votes for current midi
            const votes = buf.filter(m => m === midi).length;

            if (votes >= VOTE_THRESHOLD && midi !== lastTriggeredRef.current) {
              lastTriggeredRef.current = midi;
              onNoteDetectedRef.current?.(midi);
            }
          } else {
            silentFramesRef.current++;
            // After 8 silent frames, allow same note to re-trigger
            if (silentFramesRef.current >= 8) {
              frameBufferRef.current = [];
              lastTriggeredRef.current = null;
              silentFramesRef.current = 0;
              setDetectedNote(null);
              setDetectedFreq(null);
            }
          }
        } catch (err) {
          console.error('[pitch] detect error:', err);
        }
      }

      detect();
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Не удалось получить доступ к микрофону: ' + err.message);
    }
  }, [deviceId]);

  const stopListening = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    frameBufferRef.current = [];
    lastTriggeredRef.current = null;
    setIsListening(false);
    setDetectedNote(null);
    setDetectedFreq(null);
    setVolume(0);
  }, []);

  return {
    isListening, detectedNote, detectedFreq, volume,
    devices, deviceId, setDeviceId,
    startListening, stopListening,
  };
}
