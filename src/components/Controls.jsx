import { midiToNoteName } from '../utils/musicUtils';

export default function Controls({
  isListening, onStart, onStop, onReset,
  detectedNote, detectedFreq, volume,
  devices, deviceId, onDeviceChange,
  strictMode, onToggleStrict,
}) {
  const noteName = midiToNoteName(detectedNote);
  const volPct = Math.round((volume ?? 0) * 100);
  const volColor = volPct > 60 ? '#4ade80' : volPct > 20 ? '#facc15' : '#f87171';

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
      </div>

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
