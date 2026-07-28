// script.js — handles WAV download only
// All live analysis is in live-input.js

async function downloadAudio() {
    if (!currentSessionId) {
        alert('Please analyze a file first');
        return;
    }

    const btn = document.getElementById('downloadBtn');
    btn.textContent = '⏳ Processing...';
    btn.disabled = true;

    try {
        const response = await fetch('http://localhost:5000/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: currentSessionId })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'spectralab_output.wav';
        a.click();
        URL.revokeObjectURL(url);

    } catch (err) {
        showError('Download failed: ' + err.message);
    } finally {
        btn.textContent = '⬇ Download WAV';
        btn.disabled = false;
    }
}








