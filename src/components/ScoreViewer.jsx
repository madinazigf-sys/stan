import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

const ScoreViewer = forwardRef(({ scoreFile }, ref) => {
  const containerRef = useRef(null);
  const osmdRef = useRef(null);
  const readyRef = useRef(false);
  const busyRef = useRef(false); // true while render() is in progress
  const [status, setStatus] = useState('idle');
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    if (!containerRef.current || !scoreFile) return;

    let cancelled = false;
    setStatus('loading');
    setErrorDetail('');
    readyRef.current = false;
    busyRef.current = false;
    osmdRef.current = null;
    containerRef.current.innerHTML = '';

    const osmd = new OpenSheetMusicDisplay(containerRef.current, {
      autoResize: true,
      drawTitle: true,
      drawSubtitle: true,
      drawComposer: true,
    });

    osmd.load(scoreFile)
      .then(() => { if (!cancelled) return osmd.render(); })
      .then(() => {
        if (cancelled) return;
        osmdRef.current = osmd;
        osmd.cursor.reset();
        osmd.cursor.show();
        readyRef.current = true;
        setStatus('ready');
      })
      .catch(err => {
        if (cancelled) return;
        console.error('OSMD error:', err);
        setErrorDetail(err?.message || String(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
      readyRef.current = false;
      osmdRef.current = null;
    };
  }, [scoreFile]);

  function getCursorEl() {
    const osmd = osmdRef.current;
    if (!osmd) return null;
    return osmd.cursor.cursorElement
      ?? containerRef.current?.querySelector('img[id^="cursorImg"]');
  }

  function moveCursor() {
    const osmd = osmdRef.current;
    if (!osmd) return;
    osmd.cursor.show();
    getCursorEl()?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }

  // Flash a colored bar at the current cursor position (uses fixed positioning
  // so it works regardless of scroll / container layout).
  function flashNote(correct) {
    const el = getCursorEl();
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const div = document.createElement('div');
    div.style.cssText = [
      'position:fixed',
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${Math.max(rect.width, 14)}px`,
      `height:${Math.max(rect.height, 60)}px`,
      `background:${correct ? 'rgba(74,222,128,0.45)' : 'rgba(239,68,68,0.55)'}`,
      'pointer-events:none',
      'z-index:9999',
      'border-radius:3px',
      'transition:opacity 0.5s ease',
    ].join(';');
    document.body.appendChild(div);
    requestAnimationFrame(() => {
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 500);
    });
  }

  useImperativeHandle(ref, () => ({
    checkNote(detectedMidi, strictMode = false) {
      try {
        const osmd = osmdRef.current;
        if (!osmd || !readyRef.current || busyRef.current) return false;
        if (osmd.cursor.iterator?.EndReached) { setStatus('ended'); return false; }

        const notes = osmd.cursor.NotesUnderCursor?.() ?? [];
        const pitched = notes.filter(n => !n.isRest());

        // Skip rests automatically
        if (pitched.length === 0) {
          osmd.cursor.next();
          moveCursor();
          return false;
        }

        const matched = pitched.some(note => {
          const scoreMidi = note.Pitch?.halfTone;
          if (scoreMidi == null) return false;
          return strictMode
            ? detectedMidi === scoreMidi
            : (detectedMidi % 12) === (scoreMidi % 12);
        });

        // Flash before advancing so the highlight lands on the current note
        flashNote(matched);
        osmd.cursor.next();
        moveCursor();
        if (osmd.cursor.iterator?.EndReached) setStatus('ended');

        return matched;
      } catch (err) {
        console.error('[checkNote] error:', err);
        return false;
      }
    },

    reset() {
      const osmd = osmdRef.current;
      if (!osmd || !readyRef.current) return;
      busyRef.current = true;
      osmd.cursor.reset();
      osmd.render().then(() => {
        osmd.cursor.show();
        busyRef.current = false;
        setStatus('ready');
      });
    },
  }));

  return (
    <div className="score-wrapper">
      {status === 'loading' && <div className="overlay-message">Загрузка партитуры…</div>}
      {status === 'error' && (
        <div className="overlay-message error">
          Не удалось прочитать файл. Убедитесь, что это MusicXML (.xml / .mxl).
          {errorDetail && <div style={{ fontSize: '0.75em', marginTop: 6, opacity: 0.8 }}>{errorDetail}</div>}
        </div>
      )}
      {status === 'ended' && <div className="completion-banner">Партитура завершена!</div>}
      <div ref={containerRef} className="score-canvas" />
    </div>
  );
});

ScoreViewer.displayName = 'ScoreViewer';
export default ScoreViewer;
