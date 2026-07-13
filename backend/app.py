from flask import Flask, request, jsonify
from flask_cors import  CORS
from analyzer import analyze_audio

app = Flask(__name__)
CORS(app) # Allow frontend (different port) to call this API

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json(force=True)
    if not data or 'samples' not in data or 'sample_rate' not in data:
        return jsonify({'error': 'Missing samples or sampleRate'}), 400
    try:
        frequencies, magnitudes = analyze_audio(data['samples'], data['sample_rate'])
        
        return jsonify({'frequencies': frequencies, 'magnitudes': magnitudes})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        
if __name__ == '__main__':
    app.run(debug=True, port=5000)
    
    
    
    
    
    
    
    