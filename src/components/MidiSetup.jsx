import { useState } from 'react';

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
  connected:      'midi-connected',
  denied:         'midi-denied',
};

export default function MidiSetup({ midiStatus, wsUrl, onWsUrlChange }) {
  const [wsInput, setWsInput] = useState(wsUrl || '');
  const [showPanel, setShowPanel] = useState(false);

  const label = MIDI_LABEL[midiStatus] ?? '🎹 MIDI';
  const statusClass = MIDI_STATUS_CLASS[midiStatus] || '';

  const handleSubmit = (e) => {
    e.preventDefault();
    const url = wsInput.trim();
    onWsUrlChange(url);
    setShowPanel(false);
  };

  return (
    <div className="midi-setup-wrapper">
      <button
        className={`btn-reset btn-midi-setup ${statusClass} ${showPanel ? 'active' : ''}`}
        onClick={() => setShowPanel(s => !s)}
        title="MIDI"
      >
        {label}
      </button>

      {showPanel && (
        <form className="ws-setup-panel ws-setup-dropdown" onSubmit={handleSubmit}>
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
              onClick={() => { setWsInput(''); onWsUrlChange(''); setShowPanel(false); }}
            >
              Очистить
            </button>
          )}
        </form>
      )}
    </div>
  );
}
