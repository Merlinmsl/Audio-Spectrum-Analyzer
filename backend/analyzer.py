def analyze_audio(file_path):
    # 1. Load audio with librosa
    # 2. Convert to mono if stereo
    # 3. Apply Hann window
    # 4. Compute FFT with np.fft.fft()
    # 5. Compute magnitude (np.abs)
    # 6. Convert to dB (20 * np.log10)
    # 7. Build frequency axis (np.fft.fftfreq)
    # 8. Slice to first half only
    # 9. Return frequencies list and magnitudes list