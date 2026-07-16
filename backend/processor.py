import numpy as np
import io
from scipy .io.wavfile import write as wav_write

def samples_to_wav(samples, sample_rate):
    
    # Convert list to numpy array
    y = np.array(samples, dtype=np.float32)
    
    # normalize to prevent clipping
    # If max value exceeds 1.0, scale everything down so the highest sample also would fit in to the range [-1.0, 1.0]
    max_val = np.max(np.abs(y))
    if max_val > 1.0:
        y = y / max_val
        
    # Convert float32 [-1.0, 1.0] to int16 [-32768, 32767] as wav files stores 16-bit integers, not floats
    # Multiply by 32767 to scale to int16 range
    y_int16 = (y * 32767).astype(np.int16)
    
    # Write to an in-memory buffer (not a file on disk)
    # io.BytesIO() creates a file-like object in memory (RAM)
    buffer = io.BytesIO()
    wav_write(buffer, sample_rate, y_int16)
    
    # Go back to the beginning of the buffer so it can be read from the start
    buffer.seek(0)
    return buffer



def apply_equalizer(samples, sample_rate, base_gain, mid, gain, treble_gain):
    # Phase 2: Apply equalizer to the audio samples
    
    pass


def apply_noice_removal(samples, sample_rate, treshold):
    # Phase 3: Apply noise removal to the audio samples
    
    pass


    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    