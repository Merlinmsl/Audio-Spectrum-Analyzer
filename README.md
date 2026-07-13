# 1. Go into backend folder
cd audio-spectrum-analyzer/backend

# 2. Create virtual environment
python -m venv venv

# 3. Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 4. You should now see (venv) in your terminal like:
# (venv) C:\your-path\backend>

# Step 5 — Run the Backend
Make sure you are still inside the backend folder with (venv) active:

bash
python app.py
You should see this output:

 * Running on http://127.0.0.1:5000
 * Debug mode: on
Leave this terminal open. The backend must keep running while you use the app.

# Step 6 — Run the Frontend
You have two options:

# Option A — VS Code Live Server (Recommended)
Open VS Code
Install the Live Server extension (by Ritwick Dey) from Extensions tab
Open frontend/index.html in VS Code
Right click anywhere in the file → click "Open with Live Server"
Browser opens automatically at http://127.0.0.1:5500

# Option B — Just Open the File
Open your file explorer
Navigate to frontend/
Double click index.html
Opens in browser directly

# Step 7 — Test It
Browser should show your Spectrum Analyzer UI
Click Choose File → select any MP3 from your computer
Click Analyze
Watch the terminal (backend) — you'll see the request come in
Chart should appear with the frequency spectrum