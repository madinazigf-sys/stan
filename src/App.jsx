import { useState, useRef, useCallback } from 'react';
import ScoreViewer from './components/ScoreViewer';
import Controls from './components/Controls';
import usePitchDetection from './hooks/usePitchDetection';
import testScoreXml from '../public/test-score.xml?raw';
import './App.css';

// Peek inside a ZIP to list file names (detect .mscz vs .mxl)
async function listZipEntries(buffer) {
  try {
    const view = new DataView(buffer);
    const entries = [];
    let i = 0;
    while (i < buffer.byteLength - 4) {
      if (view.getUint32(i, true) === 0x04034b50) {
        const nameLen = view.getUint16(i + 26, true);
        const name = new TextDecoder().decode(new Uint8Array(buffer, i + 30, nameLen));
        entries.push(name);
        i += 30 + nameLen;
      } else {
        i++;
      }
    }
    return entries;
  } catch {
    return [];
  }
}

export default function App() {
  const [scoreFile, setScoreFile] = useState(null);  // string (test XML) or File/Blob (uploads) passed to OSMD
  const [scoreKey, setScoreKey] = useState(0);        // increment to force ScoreViewer remount
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState(null);
  const [strictMode, setStrictMode] = useState(false);
  const scoreRef = useRef(null);

  const handleNoteDetected = useCallback(
    (midi) => { scoreRef.current?.checkNote(midi, strictMode); },
    [strictMode],
  );

  const {
    isListening, detectedNote, detectedFreq, volume,
    devices, deviceId, setDeviceId,
    startListening, stopListening,
  } = usePitchDetection({ onNoteDetected: handleNoteDetected });

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setFileError(null);
    setScoreFile(null);
    if (isListening) stopListening();

    const ext = file.name.split('.').pop().toLowerCase();
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf, 0, 2);
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B;

    let xmlText = null;  // decoded string for plain XML files

    if (isZip) {
      const entries = await listZipEntries(buf);
      const hasMscx = entries.some(n => n.endsWith('.mscx'));
      if (hasMscx || ext === 'mscz') {
        setFileError('mscz');
        return;
      }
    } else {
      // Decode now — we'll reuse this string to pass directly to OSMD
      const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(buf);
      if (!text.includes('score-partwise') && !text.includes('score-timewise')) {
        setFileError('not-musicxml');
        return;
      }
      xmlText = text;
    }

    // Plain XML → pass string directly (avoids Blob.text() path, fixes Safari)
    // MXL/ZIP  → pass File so OSMD can unzip it
    setScoreFile(xmlText ?? file);
    setScoreKey(k => k + 1);
  }

  function loadTestScore() {
    if (isListening) stopListening();
    setFileError(null);
    setFileName('test-score.xml');
    // Pass XML string directly — OSMD parses <?xml strings synchronously (no Blob/fetch path)
    setScoreFile(testScoreXml);
    setScoreKey(k => k + 1);  // force ScoreViewer remount so clicking twice also works
  }

  function handleReset() {
    stopListening();
    scoreRef.current?.reset();
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">♩</span>
          <span className="brand-name">ScorePractice</span>
        </div>

        <button className="upload-btn test-btn" onClick={loadTestScore}>
          Тест (гамма до мажор)
        </button>

        <label className="upload-btn" htmlFor="xml-input">
          {fileName && !fileError ? `📄 ${fileName}` : '+ Открыть партитуру'}
          <input
            id="xml-input"
            type="file"
            accept=".xml,.mxl,.musicxml,.mscz"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>
      </header>

      <main className="score-area">
        {fileError === 'mscz' && (
          <div className="format-error">
            <strong>Файл в формате MuseScore (.mscz) — не поддерживается.</strong>
            <p>Чтобы открыть его здесь:</p>
            <ol>
              <li>Откройте файл в <strong>MuseScore</strong> (он установлен на вашем компьютере)</li>
              <li>Файл → <strong>Экспорт</strong> → выберите формат <strong>MusicXML (.xml)</strong></li>
              <li>Загрузите полученный <code>.xml</code> файл сюда</li>
            </ol>
          </div>
        )}
        {fileError === 'not-musicxml' && (
          <div className="format-error">
            <strong>Файл не является MusicXML.</strong>
            <p>Поддерживаются только файлы в формате MusicXML (<code>.xml</code>, <code>.mxl</code>).</p>
          </div>
        )}

        {!fileError && scoreFile && <ScoreViewer key={scoreKey} ref={scoreRef} scoreFile={scoreFile} />}

        {!fileError && !scoreFile && (
          <div className="empty-state">
            <div className="empty-icon">🎼</div>
            <p>Откройте файл партитуры в формате <strong>MusicXML</strong> (.xml, .mxl)</p>
            <p className="empty-hint">
              Экспортируйте из MuseScore: Файл → Экспорт → MusicXML
            </p>
          </div>
        )}
      </main>

      {!fileError && scoreFile && (
        <footer className="controls-bar">
          <Controls
            isListening={isListening}
            onStart={startListening}
            onStop={stopListening}
            onReset={handleReset}
            detectedNote={detectedNote}
            detectedFreq={detectedFreq}
            volume={volume}
            devices={devices}
            deviceId={deviceId}
            onDeviceChange={setDeviceId}
            strictMode={strictMode}
            onToggleStrict={() => setStrictMode(s => !s)}
          />
        </footer>
      )}
    </div>
  );
}
