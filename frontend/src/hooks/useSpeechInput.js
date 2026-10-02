import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../services/api';

const NativeRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

// Si el reconocimiento nativo falló una vez (Brave, Opera, Chromium sin servicio de Google)
// se recuerda y se usa directamente Whisper en el servidor
const ENGINE_KEY = 'amy_stt_engine';
const NATIVE_BROKEN_ERRORS = new Set(['network', 'service-not-allowed', 'language-not-supported']);

// Whisper: cada cuánto se re-transcribe el audio acumulado para mostrar el texto "en vivo"
const WHISPER_INTERVAL_MS = 2500;
const MAX_RECORDING_MS = 120000;

function preferredEngine() {
    if (!NativeRecognition) return 'whisper';
    try { return localStorage.getItem(ENGINE_KEY) === 'whisper' ? 'whisper' : 'native'; } catch { return 'native'; }
}

function recognitionLang() {
    const nav = navigator.language || '';
    return nav.toLowerCase().startsWith('es') ? nav : 'es-419';
}

function recorderMime() {
    if (typeof MediaRecorder === 'undefined') return null;
    return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) || '';
}

async function transcribe(blob) {
    const form = new FormData();
    form.append('audio', blob, 'dictado');
    const token = getToken();
    const resp = await fetch('/api/speech/transcribe', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
    });
    if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || 'No se pudo transcribir el audio.');
    }
    return (await resp.json()).text || '';
}

/**
 * Dictado por voz con el texto apareciendo mientras se habla.
 * - onText(texto): se llama con cada actualización para escribirla en el cuadro.
 * - levelTargetRef: elemento que recibe el volumen del micrófono (0..1) en la variable CSS
 *   --mic-level en cada fotograma (anima las ondas sin re-renderizar React).
 */
export default function useSpeechInput({ onText, levelTargetRef }) {
    const supported = typeof navigator !== 'undefined' && (!!NativeRecognition || typeof MediaRecorder !== 'undefined');
    const [listening, setListening] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const [error, setError] = useState('');

    const onTextRef = useRef(onText);
    onTextRef.current = onText;
    const session = useRef(null); // estado de la sesión de dictado activa

    /* ── Medidor de volumen (ondas) ───────────────────────── */
    const startMeter = useCallback((s) => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.6;
        ctx.createMediaStreamSource(s.stream).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        let smooth = 0;
        let last = performance.now();
        s.voicedMs = 0;
        const tick = () => {
            if (session.current !== s) return;
            const now = performance.now();
            if (smooth > 0.12) s.voicedMs += now - last; // tiempo acumulado hablando
            last = now;
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                const v = (data[i] - 128) / 128;
                sum += v * v;
            }
            const level = Math.min(1, Math.max(0, (Math.sqrt(sum / data.length) - 0.01) * 6));
            smooth = smooth * 0.75 + level * 0.25;
            levelTargetRef.current?.style.setProperty('--mic-level', smooth.toFixed(3));
            s.raf = requestAnimationFrame(tick);
        };
        s.audioCtx = ctx;
        s.raf = requestAnimationFrame(tick);
    }, [levelTargetRef]);

    const cleanup = useCallback((s) => {
        if (!s) return;
        cancelAnimationFrame(s.raf);
        clearTimeout(s.maxTimer);
        clearInterval(s.watchdog);
        s.stream?.getTracks().forEach(t => t.stop());
        s.audioCtx?.close().catch(() => {});
        if (session.current === s) session.current = null;
        levelTargetRef.current?.style.setProperty('--mic-level', '0');
        setListening(false);
    }, [levelTargetRef]);

    const emit = (s, text) => {
        if (s.discard) return;
        onTextRef.current?.((s.base + text).replace(/\s+/g, ' ').trimStart());
    };

    // La grabación arranca al inicio con cualquier motor: si el nativo falla y se pasa a
    // Whisper, se transcribe todo lo dicho desde el principio, sin perder palabras
    const startRecording = useCallback((s) => {
        const mime = recorderMime();
        if (mime === null) return;
        s.chunks = [];
        const rec = new MediaRecorder(s.stream, mime ? { mimeType: mime } : undefined);
        s.recorder = rec;
        rec.ondataavailable = (e) => {
            if (e.data?.size) s.chunks.push(e.data);
            // Re-transcribir lo acumulado mientras se habla: el texto se va completando
            if (s.engine === 'whisper' && !s.stopping && !s.inFlight && Date.now() - s.lastSent >= WHISPER_INTERVAL_MS) {
                s.send(false);
            }
        };
        rec.onstop = async () => {
            if (s.engine !== 'whisper' || s.discard) return;
            setTranscribing(true);
            while (s.inFlight) await new Promise(r => setTimeout(r, 100));
            await s.send(true);
            setTranscribing(false);
        };
        rec.start(500);
    }, []);

    /* ── Motor Whisper (servidor) ──────────────────────────── */
    const startWhisper = useCallback((s) => {
        if (!s.recorder) {
            setError('Tu navegador no permite grabar audio.');
            cleanup(s);
            return;
        }
        s.engine = 'whisper';
        s.inFlight = false;
        s.lastText = '';
        s.lastSent = 0; // primera transcripción en cuanto llegue audio
        s.send = async (isFinal) => {
            if (!s.chunks.length) return;
            s.inFlight = true;
            s.lastSent = Date.now();
            try {
                const text = await transcribe(new Blob(s.chunks, { type: s.recorder.mimeType || 'audio/webm' }));
                if (text) { s.lastText = text; emit(s, text); }
            } catch (err) {
                if (isFinal || !s.lastText) setError(err.message);
            } finally {
                s.inFlight = false;
            }
        };
        setListening(true);
    }, [cleanup]);

    /* ── Motor nativo (Chrome, Edge, Safari) ───────────────── */
    const startNative = useCallback((s) => {
        s.engine = 'native';
        s.finalText = '';
        const rec = new NativeRecognition();
        rec.lang = recognitionLang();
        rec.continuous = true;
        rec.interimResults = true;
        s.recognition = rec;

        // Algunos navegadores tienen la API pero no el servicio: no dan error ni texto.
        // Si el usuario lleva ~3 s hablando y no llega nada, se pasa a Whisper.
        const switchToWhisper = () => {
            try { localStorage.setItem(ENGINE_KEY, 'whisper'); } catch { /* sin almacenamiento */ }
            s.switching = true;
            clearInterval(s.watchdog);
            rec.abort();
        };
        s.gotResult = false;
        s.watchdog = setInterval(() => {
            if (s.gotResult || s.stopping) { clearInterval(s.watchdog); return; }
            if (s.voicedMs > 3000) switchToWhisper();
        }, 500);

        rec.onresult = (event) => {
            s.gotResult = true;
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const t = event.results[i][0].transcript;
                if (event.results[i].isFinal) s.finalText += t;
                else interim += t;
            }
            emit(s, s.finalText + interim);
        };
        rec.onerror = (event) => {
            if (NATIVE_BROKEN_ERRORS.has(event.error)) {
                // Este navegador no tiene el servicio de voz: pasar a Whisper sin cortar el dictado
                try { localStorage.setItem(ENGINE_KEY, 'whisper'); } catch { /* sin almacenamiento */ }
                s.switching = true;
                clearInterval(s.watchdog);
            } else if (event.error === 'not-allowed') {
                setError('Permite el acceso al micrófono en tu navegador para dictar.');
            }
        };
        rec.onend = () => {
            clearInterval(s.watchdog);
            if (s.switching && !s.stopping && !s.discard) {
                s.switching = false;
                startWhisper(s);
                return;
            }
            if (!s.discard && s.finalText) emit(s, s.finalText);
            cleanup(s);
        };
        try {
            rec.start();
            setListening(true);
        } catch {
            startWhisper(s);
        }
    }, [cleanup, startWhisper]);

    /* ── API pública ───────────────────────────────────────── */
    const start = useCallback(async (currentText = '') => {
        if (session.current) return;
        setError('');
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
            setError('El dictado por voz necesita que AMY se abra con HTTPS (o en localhost).');
            return;
        }
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        } catch (err) {
            setError(err?.name === 'NotAllowedError'
                ? 'Permite el acceso al micrófono en tu navegador para dictar.'
                : 'No se detectó ningún micrófono.');
            return;
        }
        const base = currentText.trim();
        const s = { stream, base: base ? base + ' ' : '', discard: false, stopping: false };
        session.current = s;
        startMeter(s);
        startRecording(s);
        s.maxTimer = setTimeout(() => stop(), MAX_RECORDING_MS);

        if (preferredEngine() === 'native') startNative(s);
        else startWhisper(s);
    }, [startMeter, startNative, startWhisper]); // eslint-disable-line react-hooks/exhaustive-deps

    // discard: al enviar el mensaje, no volver a escribir el texto dictado en el cuadro
    const stop = useCallback((discard = false) => {
        const s = session.current;
        if (!s) return;
        s.stopping = true;
        s.discard = discard;
        if (s.engine === 'whisper' && s.recorder?.state !== 'inactive') {
            s.recorder.stop();
            cleanup(s);
        } else if (s.recognition) {
            if (discard) s.recognition.abort(); else s.recognition.stop();
        } else {
            cleanup(s);
        }
    }, [cleanup]);

    const toggle = useCallback((currentText) => {
        if (session.current) stop();
        else start(currentText);
    }, [start, stop]);

    // Liberar el micrófono al salir del chat
    useEffect(() => () => {
        const s = session.current;
        if (!s) return;
        s.discard = true;
        s.recognition?.abort();
        if (s.recorder?.state === 'recording') s.recorder.stop();
        cleanup(s);
    }, [cleanup]);

    return { supported, listening, transcribing, error, toggle, stop, clearError: () => setError('') };
}
