// ============================================================
// live-input.js — All real-time audio analysis logic
// ============================================================

// Global audio graph nodes
let audioContext = null;
let analyser = null;
let sourceNode = null;
let animationId = null;
let audioBuffer = null;
let isPaused = false;
let pausedAt = 0;
let startedAt = 0;
let currentSessionId = null;

// Peak hold data
let peakHoldData = null;
let peakHoldEnabled = false;
const PEAK_HOLD_DECAY = 0.995; // how slowly peaks fall per frame


// ---------- AUDIO GRAPH SETUP ------------------------------------------

function initAudioContext() {
    // Create fresh AudioContext — must happen after user gesture
    if (audioContext) audioContext.close();

    audioContext = new AudioContext();

    // Create analyser node — this is what computes FFT
    analyser = audioContext.createAnalyser();

    // fftSize = N in DFT formula
    // Higher = more frequency resolution but slower response
    analyser.fftSize = parseInt(document.getElementById('fftSizeSelect').value);

    // smoothingTimeConstant: blends current frame with previous
    // 0 = no smoothing (jumpy), 0.99 = very smooth (slow)
    analyser.smoothingTimeConstant = parseFloat(document.getElementById('smoothingSlider').value);

    // Connect analyser to speakers so we hear the audio
    analyser.connect(audioContext.destination);

    // Initialize peak hold array
    peakHoldData = new Float32Array(analyser.frequencyBinCount).fill(-Infinity);

    return analyser;
}


// ------ FILE PLAYBACK -------------------------------------------------

async function startFileAnalysis() {
    const fileInput = document.getElementById('audioFile');

    if (!fileInput.files[0]) {
        showError('Please select an audio file first');
        return;
    }

    showLoading(true);
    stopAnalysis(); // stop any previous session

    try {
        // Read file
        const arrayBuffer = await fileInput.files[0].arrayBuffer();

        // Init fresh audio context
        initAudioContext();

        // Decode MP3/WAV using browser decoder
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // -- Also send to Python for static analysis + session storage --
        const samples = Array.from(audioBuffer.getChannelData(0).slice(0, audioBuffer.sampleRate * 5));
        await sendToPython(samples, audioBuffer.sampleRate);

        // -- Start live playback --
        playFromBuffer(0);

        // Update UI
        showPlaybackControls(true);
        setStatus('playing', '● Playing');
        document.getElementById('bottomRow').classList.remove('hidden');

    } catch (err) {
        showError('Error loading file: ' + err.message);
    } finally {
        showLoading(false);
    }
}

function playFromBuffer(offset) {
    // Create a new source node (AudioBufferSourceNode can only play once)
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;

    // Connect: source → analyser → speakers
    sourceNode.connect(analyser);

    // Track timing for pause/resume
    startedAt = audioContext.currentTime - offset;
    sourceNode.start(0, offset);
    isPaused = false;

    // Start the animation loop
    startRenderLoop();

    // When audio ends naturally
    sourceNode.onended = () => {
        if (!isPaused) {
            stopAnalysis();
            setStatus('ready', '● Ready');
        }
    };
}


// ------------- MICROPHONE INPUT -----------------------------------------

async function startMicAnalysis() {
    showLoading(true);
    stopAnalysis();

    try {
        // Request mic permission — browser shows permission dialog
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        initAudioContext();

        // Create source from mic stream
        sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNode.connect(analyser);
        // Note: do NOT connect to destination — would cause feedback loop!

        startRenderLoop();
        setStatus('live', '● Live — Mic');
        showMicControls(true);

    } catch (err) {
        if (err.name === 'NotAllowedError') {
            showError('Microphone permission denied. Please allow access and try again.');
        } else {
            showError('Mic error: ' + err.message);
        }
    } finally {
        showLoading(false);
    }
}


// --------- SYSTEM AUDIO -----------------------------------------------

async function startSystemAnalysis() {
    showLoading(true);
    stopAnalysis();

    try {
        // getDisplayMedia captures screen/tab — user picks which tab
        // audio: true is critical — user must tick "Share tab audio"
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,  // must request video even if we don't use it
            audio: true
        });

        // Check if audio track was actually shared
        if (stream.getAudioTracks().length === 0) {
            showError('No audio track found. Did you tick "Share tab audio" in the dialog?');
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        initAudioContext();

        // Only use audio track
        const audioStream = new MediaStream(stream.getAudioTracks());
        sourceNode = audioContext.createMediaStreamSource(audioStream);
        sourceNode.connect(analyser);

        // Stop video tracks — we don't need them
        stream.getVideoTracks().forEach(t => t.stop());

        startRenderLoop();
        setStatus('live', '● Live — System Audio');
        showSystemControls(true);

    } catch (err) {
        showError('System audio error: ' + err.message);
    } finally {
        showLoading(false);
    }
}


// ----------- RENDER LOOP ---------------------------------------------

function startRenderLoop() {
    const canvas = document.getElementById('liveCanvas');
    const ctx = canvas.getContext('2d');

    // frequencyBinCount = fftSize / 2 (Nyquist — only first half meaningful)
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    function renderFrame() {
        animationId = requestAnimationFrame(renderFrame);

        // Get current FFT data in dB — same as Python's magnitude_db array
        analyser.getFloatFrequencyData(dataArray);

        // Update peak hold
        if (peakHoldEnabled) updatePeakHold(dataArray);

        // Draw the spectrum
        drawSpectrum(ctx, canvas, dataArray, bufferLength);

        // Update stats panel
        updateStats(dataArray, bufferLength);
    }

    renderFrame(); // kick off the loop
}


// --------------- CANVAS DRAWING ----------------------------------------------------------

function drawSpectrum(ctx, canvas, dataArray, bufferLength) {
    const W = canvas.width;
    const H = canvas.height;

    // Clear previous frame
    ctx.fillStyle = '#0d0d24';
    ctx.fillRect(0, 0, W, H);

    // Draw grid lines
    drawGrid(ctx, W, H);

    // Draw frequency bars
    const barWidth = W / bufferLength;
    const minDb = -120;
    const maxDb = 0;

    ctx.beginPath();
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1.5;

    for (let i = 0; i < bufferLength; i++) {
        const db = dataArray[i];

        // Map dB value to canvas Y position
        // dB range: -120 (bottom) to 0 (top)
        const normalised = (db - minDb) / (maxDb - minDb);
        const y = H - (normalised * H);
        const x = (i / bufferLength) * W;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }

    ctx.stroke();

    // Filled area under the line
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 212, 255, 0.06)';
    ctx.fill();

    // Draw peak hold line if enabled
    if (peakHoldEnabled && peakHoldData) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 200, 0, 0.7)';
        ctx.lineWidth = 1;
        for (let i = 0; i < bufferLength; i++) {
            const db = peakHoldData[i];
            const normalised = (db - minDb) / (maxDb - minDb);
            const y = H - (normalised * H);
            const x = (i / bufferLength) * W;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Draw frequency labels on x-axis
    drawFrequencyLabels(ctx, W, H, bufferLength);
}

function drawGrid(ctx, W, H) {
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;

    // Horizontal dB lines
    const dbLines = [-100, -80, -60, -40, -20, 0];
    const minDb = -120;
    const maxDb = 0;

    dbLines.forEach(db => {
        const y = H - ((db - minDb) / (maxDb - minDb)) * H;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px Segoe UI';
        ctx.fillText(`${db} dB`, 4, y - 3);
    });
}

function drawFrequencyLabels(ctx, W, H, bufferLength) {
    if (!audioContext) return;
    const sr = audioContext.sampleRate;
    const labels = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px Segoe UI';

    labels.forEach(freq => {
        // Convert frequency to bin index: k = freq * N / sr
        const binIndex = Math.round(freq * bufferLength / (sr / 2));
        if (binIndex >= bufferLength) return;
        const x = (binIndex / bufferLength) * W;
        ctx.fillText(freq >= 1000 ? `${freq/1000}k` : `${freq}`, x, H - 4);
    });
}


// -------------- PEAK HOLD ------------------------------------------------------------

function updatePeakHold(dataArray) {
    for (let i = 0; i < dataArray.length; i++) {
        if (dataArray[i] > peakHoldData[i]) {
            peakHoldData[i] = dataArray[i]; // new peak found
        } else {
            peakHoldData[i] *= PEAK_HOLD_DECAY; // slowly decay existing peak
        }
    }
}


// -------------- STATS UPDATE -------------------------------------------------------------------

function updateStats(dataArray, bufferLength) {
    if (!audioContext) return;
    const sr = audioContext.sampleRate;

    // Peak dB — loudest bin right now
    let peak = -Infinity;
    let peakBin = 0;
    for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > peak) {
            peak = dataArray[i];
            peakBin = i;
        }
    }
    document.getElementById('peakLevel').textContent =
        `Peak: ${peak.toFixed(1)} dB`;

    // Dominant frequency
    const dominantFreq = peakBin * (sr / 2) / bufferLength;
    document.getElementById('dominantFreq').textContent =
        `${dominantFreq.toFixed(1)} Hz`;

    // Musical note detection from dominant frequency
    document.getElementById('dominantNote').textContent =
        `Note: ${freqToNote(dominantFreq)}`;

    // Band levels — average dB in each band
    document.getElementById('bassLevel').textContent =
        `${getBandLevel(dataArray, bufferLength, sr, 20, 250).toFixed(1)} dB`;
    document.getElementById('midLevel').textContent =
        `${getBandLevel(dataArray, bufferLength, sr, 250, 4000).toFixed(1)} dB`;
    document.getElementById('trebleLevel').textContent =
        `${getBandLevel(dataArray, bufferLength, sr, 4000, 20000).toFixed(1)} dB`;
}

function getBandLevel(dataArray, bufferLength, sr, lowHz, highHz) {
    // Convert Hz to bin indices: k = freq * N / (sr/2)
    const lowBin = Math.round(lowHz * bufferLength / (sr / 2));
    const highBin = Math.round(highHz * bufferLength / (sr / 2));

    let sum = 0;
    let count = 0;
    for (let i = lowBin; i < highBin && i < bufferLength; i++) {
        sum += dataArray[i];
        count++;
    }
    return count > 0 ? sum / count : -Infinity;
}

function freqToNote(freq) {
    // A4 = 440 Hz, MIDI note formula
    // n = 12 * log2(freq / 440) + 69
    if (freq < 20) return '--';
    const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const midiNote = Math.round(12 * Math.log2(freq / 440) + 69);
    const noteName = notes[midiNote % 12];
    const octave = Math.floor(midiNote / 12) - 1;
    return `${noteName}${octave}`;
}


// ------------ PLAYBACK CONTROLS ----------------------------------------------------

function togglePause() {
    if (!sourceNode || !audioContext) return;

    if (!isPaused) {
        // Pause — record how far we are through the audio
        pausedAt = audioContext.currentTime - startedAt;
        sourceNode.stop();
        cancelAnimationFrame(animationId);
        isPaused = true;
        document.getElementById('pauseBtn').textContent = '▶ Resume';
        setStatus('paused', '● Paused');
    } else {
        // Resume — play from where we paused
        playFromBuffer(pausedAt);
        document.getElementById('pauseBtn').textContent = '⏸ Pause';
        setStatus('playing', '● Playing');
    }
}

function stopAnalysis() {
    if (sourceNode) {
        try { sourceNode.stop(); } catch(e) {}
        sourceNode.disconnect();
        sourceNode = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    cancelAnimationFrame(animationId);
    animationId = null;
    isPaused = false;
    pausedAt = 0;

    showPlaybackControls(false);
    showMicControls(false);
    showSystemControls(false);
    setStatus('ready', '● Ready');
}


// ---------------- SETTINGS UPDATES --------------------------------------------------------

function updateFFTSize() {
    if (analyser) {
        analyser.fftSize = parseInt(document.getElementById('fftSizeSelect').value);
        peakHoldData = new Float32Array(analyser.frequencyBinCount).fill(-Infinity);
    }
}

function updateSmoothing() {
    if (analyser) {
        analyser.smoothingTimeConstant =
            parseFloat(document.getElementById('smoothingSlider').value);
    }
}

function togglePeakHold() {
    peakHoldEnabled = document.getElementById('peakHoldToggle').checked;
    if (!peakHoldEnabled && peakHoldData) {
        peakHoldData.fill(-Infinity); // reset on disable
    }
}


// ---------------- CANVAS RESIZE ---------------------------------------------------------

function resizeCanvas() {
    const canvas = document.getElementById('liveCanvas');
    const container = canvas.parentElement;
    canvas.width = container.clientWidth - 40;
    canvas.height = 300;
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', resizeCanvas);


// ------------ PYTHON INTEGRATION (kept from Phase 1) ------------------------------------

async function sendToPython(samples, sampleRate) {
    try {
        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ samples, sample_rate: sampleRate })
        });
        const data = await response.json();
        if (data.session_id) currentSessionId = data.session_id;
    } catch (e) {
        console.warn('Python backend unavailable — live view only:', e.message);
    }
}


// ---------------- UI HELPERS ------------------------------------------------------

function switchSource(source) {
    stopAnalysis();
    document.querySelectorAll('.source-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('source' + source.charAt(0).toUpperCase() + source.slice(1))
        .classList.remove('hidden');
    document.querySelector(`[data-source="${source}"]`).classList.add('active');
}

function showPlaybackControls(show) {
    document.getElementById('playBtn').classList.toggle('hidden', show);
    document.getElementById('pauseBtn').classList.toggle('hidden', !show);
    document.getElementById('stopBtn').classList.toggle('hidden', !show);
    document.getElementById('downloadBtn').classList.toggle('hidden', !show);
}

function showMicControls(show) {
    document.getElementById('micStartBtn').classList.toggle('hidden', show);
    document.getElementById('micStopBtn').classList.toggle('hidden', !show);
}

function showSystemControls(show) {
    document.getElementById('sysStartBtn').classList.toggle('hidden', show);
    document.getElementById('sysStopBtn').classList.toggle('hidden', !show);
}

function setStatus(type, text) {
    const el = document.getElementById('statusText');
    el.textContent = text;
    el.className = `status-${type}`;
}

function showError(msg) {
    const el = document.getElementById('error');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
}














