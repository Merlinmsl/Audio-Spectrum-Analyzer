import numpy as np

def analyze_audio(samples, sample_rate):
    # 1. Load audio with librosa
    # librosa returns: y = audio sample array, sr = sample rate (e.g. 44100)
    # By default, librosa resamples everything to 22050 Hz unless you specify sr=None to keep the original rate.
    # Without using the librosa library, we can assume the samples are already loaded and provided as input by the browser default MP3 decoder.
    y = np.array(samples) 
    sr = sample_rate 
    
    
    # 2. Convert to mono if stereo (if needed)
    # librosa.load() already does this by default, but good to be aware
    # if y.ndim > 1: y = np.mean(y, axis=0)
    
    
    # 3. Apply Hann window to reduce the spectral leackage
    # np.hanning(N) returns an array [0,  ..., 1, ...., 0] same length as signal
    N = len(y)
    window = np.hanning(N)
    y_windowed = y * window
    
    
    
    # 4. Compute FFT with np.fft.fft()
    # result is an array of N complex numbers
    fft_result = np.fft.fft(y_windowed)
    
    
    # 5. Compute magnitude (np.abs) |X[k]| = sqrt(real^2 + imag^2)
    magnitude = np.abs(fft_result)
    
    
    # 6. Convert to dB (20 * np.log10)
    # Add small value (1e-10) to avoid log(0) which is -infinity
    magnitude_db = 20 * np.log10(magnitude + 1e-10)
    
    
    # 7. Build frequency axis (np.fft.fftfreq)
    # np.fft.fftfreq returns frequencies for each FFT bin
    frequencies = np.fft.fftfreq(N, d=1/sr)
    
    
    # 8. Slice to first half only (positive frequencies, upto Nyquist)
    half = N // 2
    frequencies = frequencies[:half]
    magnitude_db = magnitude_db[:half]
    
    
    # 9. Return frequencies list and magnitudes list
    # Downsample for frontend (too many points = slow chart)
    # Take every 10th point for performance
    step = max(1, len(frequencies) // 3000)
    frequencies = frequencies[::step].tolist()
    magnitude_db = magnitude_db[::step].tolist()
    
    return frequencies, magnitude_db
    
    
    
    