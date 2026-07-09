import os
import tempfile
import flask import Flask, request, jsonify
from flask_cors import  CORS
from analyzer import analyze_audio

app = Flask(__name__)
CORS(app) # Allow frontend (different port) to call this API

@app.route('/analyze', methods=['POST'])
def analyze():
    # check if file was sent
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded!'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected!'}), 400
    
    # Save to a tempory file (librosa needs a path, not file object)
    with tempfile.NamedTemporaryFiles(delete=False, suffix='.mp3') as temp:
        file.save(temp.name)
        tmp_path = tmp.name
        
    try:
        frequencies, magnitude = analyze_audio(tmp_path)
        return jsonify({'frequencies': frequencies, 'magnitude': magnitudes})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        os.unlink(tmp_path) # Delete temp file
        
if __name__ == '__main__':
    app.run(debug=True, port=5000)
    
    
    
    
    
    
    
    