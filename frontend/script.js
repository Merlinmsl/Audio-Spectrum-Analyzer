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

    // Build form data to send file
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        // Send to Flask backend
        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            body: formData
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