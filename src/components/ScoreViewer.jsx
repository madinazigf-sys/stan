import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

const ScoreViewer = forwardRef(({ scoreFile }, ref) => {
  const containerRef = useRef(null);
  const osmdRef = useRef(null);
  const readyRef = useRef(false);
  const busyRef = useRef(false); // true while render() is in progress
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!containerRef.current || !scoreFile) return;

    let cancelled = false;
    setStatus('loading');
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
        setStatus('error');
      });

    return () => {
      cancelled = true;
      readyRef.current = false;
      osmdRef.current = null;
    };
  }, [scoreFile]);

  function moveCursor() {
    const osmd = osmdRef.current;
    if (!osmd) return;
    osmd.cursor.show();
    const cursorEl = osmd.cursor.cursorElement
      ?? containerRef.current?.querySelector('img[id^="cursorImg"]');
    cursorEl?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
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

        if (matched) {
          osmd.cursor.next();
          moveCursor();
          if (osmd.cursor.iterator?.EndReached) setStatus('ended');
        }

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
        </div>
      )}
      {status === 'ended' && <div className="completion-banner">Партитура завершена!</div>}
      <div ref={containerRef} className="score-canvas" />
    </div>
  );
});

ScoreViewer.displayName = 'ScoreViewer';
export default ScoreViewer;
