import { useState } from 'react';
import { midiToNoteName } from '../utils/musicUtils';

const hasWebMidi = typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess;

const MIDI_LABEL = {
  unsupported:    '🎹 MIDI',
  denied:         '🎹 нет доступа',
  'no-device':    '🎹 не подключено',
  connected:      '🎹 подключено',
  'ws-waiting':   '🔌 подключение...',
  'ws-connected': '🎹 MIDI bridge',
  'ws-error':     '🔌 нет связи',
};

const MIDI_STATUS_CLASS = {
  'ws-connected': 'midi-connected',
  'ws-error':     'midi-denied',
  'ws-waiting':   '',
  connected:      'midi-connected',
  denied:         'midi-denied',
  'no-device':    '',
};

export default function Controls({
  isListening, onStart, onStop, onReset,
  detectedNote, detectedFreq, volume,
  devices, deviceId, onDeviceChange,
  strictMode, onToggleStrict,
  midiStatus,
  wsUrl, onWsUrlChange,
}) {
  const [wsInput, setWsInput] = useState(wsUrl || '');
  const [showWsSetup, setShowWsSetup] = useState(false);

  const noteName = midiToNoteName(detectedNote);
  const volPct = Math.round((volume ?? 0) * 100);
  const volColor = volPct > 60 ? '#4ade80' : volPct > 20 ? '#facc15' : '#f87171';

  const handleWsSubmit = (e) => {
    e.preventDefault();
    const url = wsInput.trim();
    onWsUrlChange(url);
    setShowWsSetup(false);
  };

  const label = MIDI_LABEL[midiStatus];
  const statusClass = MIDI_STATUS_CLASS[midiStatus] || '';

  return (
    <div className="controls">
      <div className="controls-left">
        <button
          className={`btn-listen ${isListening ? 'active' : ''}`}
          onClick={isListening ? onStop : onStart}
        >
          {isListening ? '⏹ Остановить' : '🎤 Слушать'}
        </button>

        <button className="btn-reset" onClick={onReset}>↩ Сначала</button>

        {/* Audio input selector */}
        {devices.length > 1 && (
          <select
            className="device-select"
            value={deviceId}
            onChange={e => onDeviceChange(e.target.value)}
            disabled={isListening}
            title="Выбрать аудиовход"
          >
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Устройство ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        )}

        <label className="strict-toggle">
          <input type="checkbox" checked={strictMode} onChange={onToggleStrict} />
          Точная октава
        </label>

        {/* MIDI status badge — always shown; clickable on non-Web-MIDI devices (iPad/Safari) to open bridge setup */}
        <span
          className={`midi-badge ${statusClass}`}
          onClick={!hasWebMidi ? () => setShowWsSetup(s => !s) : undefined}
          style={!hasWebMidi ? { cursor: 'pointer' } : undefined}
          title={!hasWebMidi ? 'Настроить MIDI bridge' : undefined}
        >
          {label}
        </span>
      </div>

      {/* WebSocket bridge setup panel */}
      {showWsSetup && (
        <form className="ws-setup-panel" onSubmit={handleWsSubmit}>
          <span className="ws-setup-label">MIDI Bridge URL:</span>
          <input
            className="ws-setup-input"
            type="text"
            placeholder="ws://192.168.1.100:9001"
            value={wsInput}
            onChange={e => setWsInput(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="ws-setup-btn" type="submit">Подключить</button>
          {wsUrl && (
            <button
              className="ws-setup-btn ws-setup-clear"
              type="button"
              onClick={() => { setWsInput(''); onWsUrlChange(''); setShowWsSetup(false); }}
            >
              Очистить
            </button>
          )}
        </form>
      )}

      <div className="controls-right">
        {isListening && (
          <>
            <div className="vol-meter" title={`Громкость: ${volPct}%`}>
              <span className="vol-label">Микрофон</span>
              <div className="vol-bar-bg">
                <div className="vol-bar-fill" style={{ width: `${volPct}%`, background: volColor }} />
              </div>
              <span className="vol-pct">{volPct}%</span>
            </div>

            <div className="note-display">
              <span className="note-label">Нота:</span>
              <span className={`note-value ${detectedNote !== null ? 'has-note' : ''}`}>
                {detectedNote !== null ? noteName : '…'}
              </span>
              {detectedFreq && <span className="freq-value">{detectedFreq} Hz</span>}
            </div>
          </>
        )}
        {!isListening && (
          <span className="hint">Нажмите «Слушать» и начните играть</span>
        )}
      </div>
    </div>
  );
}
