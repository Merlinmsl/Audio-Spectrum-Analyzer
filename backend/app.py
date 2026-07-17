import uuid
from flask import Flask, request, jsonify, send_file
from flask_cors import  CORS
from analyzer import analyze_audio
from processor import samples_to_wav 

app = Flask(__name__)
CORS(app) # Allow frontend (different port) to call this API

# In-memory storage: { session_id: { 'samples': [], 'sample_rate': int}}
# This stores audio data temporarily while user is on the page
audio_sessions = {}



@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json(force=True)
    if not data or 'samples' not in data or 'sample_rate' not in data:
        return jsonify({'error': 'Missing samples or sampleRate'}), 400
    try:
        frequencies, magnitudes = analyze_audio(data['samples'], data['sample_rate'])
        
        # Generate unique session ID for this audio
        session_id = str(uuid.uuid4())
        
        # Store samples so /processes can use them later
        audio_sessions[session_id] = {
            'samples': data['samples'],
            'sample_rate': data['sample_rate']
        }
        
        # Return chart data + session ID for later processing
        return jsonify({'frequencies': frequencies, 'magnitudes': magnitudes, 'session_id': session_id})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    

@app.route('/process', methods=['POST'])
def process():
    data = request.get_json(force=True)
    
    if not data or 'session_id' not in data:
        return jsonify({'error': 'Missing session_id'}), 400
    
    session_id  = data['session_id']
    
    if session_id not in audio_sessions:
        return jsonify({'error': 'Sesssion not found. Please analyze the audio file again.'}), 400
    
    try:
        session = audio_sessions[session_id]
        samples = session['samples']
        sample_rate = session['sample_rate']
        
        # For phase 1 - Just convert to wav with no modifications
        # Phase 2 will add equalizer here
        # phase 3 will add noice removal here
        wav_buffer = samples_to_wav(samples, sample_rate)
    
        # Send wav file as download
        return send_file(
            wav_buffer,
            mimetype='audio/wav',
            as_attachment=True,
            download_name='processed_audio.wav'
        )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

        
if __name__ == '__main__':
    app.run(debug=True, port=5000)
    
    
    
    
    
    
    
    