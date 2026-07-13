let spectrumChart = null;

async function analyzeAudio() {
    const fileInput = document.getElementById('audioFile');
    const loading = document.getElementById('loading');
    const errorDiv = document.getElementById('error');

    // Validation
    if (!fileInput.files[0]) {
        alert('Please select an audio file first');
        return;
    }

    // Show loading, hide errors
    loading.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    try {
        // Read file as ArrayBuffer
        const arrayBuffer = await fileInput.files[0].arrayBuffer();

        // Decode MP3 using browser's buit-in Web Audio API
        // This is what repleaces the need for a separate MP3 decoding library
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Get raw audio samples (mono , channel 0)
        // audioBuffer.getChannelData(0) returns Float32Array of samples in range [-1.0, 1.0]
        const fullSamples = audioBuffer.getChannelData(0);
        const sample_rate = audioBuffer.sampleRate;

        // Only send first 5 seconds worth of samples
        // Sending entire song = too much data (could be millions of floats)
        // 5 seconds × 44100 Hz = 220,500 samples — manageable
        const maxsamples = sample_rate * 5; // Limit to 5 seconds of audio
        const samples = Array.from(fullSamples.slice(0, maxsamples)); // Limit samples to 5 seconds

        // Send raw saples to Python for FFT analysis
        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'aplication/json'},
            body: JSON.stringify({ samples, sample_rate })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Draw the spectrum chart
        drawChart(data.frequencies, data.magnitudes);

    } catch (error) {
        errorDiv.textContent = 'Error: ' + error.message;
        errorDiv.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
}

function drawChart(frequencies, magnitudes) {
    const ctx = document.getElementById('spectrumChart').getContext('2d');

    // Destroy previous chart if exists
    if (spectrumChart) {
        spectrumChart.destroy();
    }

    spectrumChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: frequencies.map(f => f.toFixed(1)),
            datasets: [{
                label: 'Magnitude (dB)',
                data: magnitudes,
                borderColor: '#00d4ff',
                borderWidth: 1,
                pointRadius: 0,  // No dots — too many points
                fill: true,
                backgroundColor: 'rgba(0, 212, 255, 0.1)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Frequency Spectrum (FFT)'
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Frequency (Hz)' },
                    ticks: { maxTicksLimit: 20 }
                },
                y: {
                    title: { display: true, text: 'Magnitude (dB)' }
                }
            }
        }
    });
}