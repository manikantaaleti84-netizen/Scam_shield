# On-Device Scam Shield

A local-first hackathon prototype for suspicious SMS/message and URL analysis using FastAPI, Gemini, and Ollama fallback.

## Features
- SMS/message scam pattern checks plus Gemini explanation, with Ollama fallback
- URL pattern inspection without visiting or fetching the URL
- English, Telugu and Hindi explanation prompt selection
- Risk score, warning signs and per-account browser-local scan history
- Supabase-verified scans persisted to the existing `scan_history` table
- Dark responsive dashboard

## Requirements
- Python 3.10+
- Ollama for Windows/macOS/Linux (fallback; optional if Gemini is available)
- `GEMINI_API_KEY` and `SUPABASE_URL` in the backend `.env`; use `SUPABASE_ANON_KEY` for the Supabase API key (the existing `SUPABASE_KEY` name remains supported as a fallback)
- Qwen 2.5 1.5B model (or change MODEL in `app.py`)

## Windows setup

### 1. Install Ollama
Download from https://ollama.com/download

### 2. Download the model
Open PowerShell or Command Prompt:
```powershell
ollama pull qwen2.5:1.5b
```

### 3. Open the project folder
Open this folder in VS Code. In its terminal:
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Start Ollama
If Ollama is not already running:
```powershell
ollama serve
```
Keep that terminal running. In another terminal, optionally test:
```powershell
ollama run qwen2.5:1.5b
```

### 5. Start the website backend
In the project folder, with the virtual environment activated:
```powershell
uvicorn app:app --reload
```

### 6. Open the website
Visit http://127.0.0.1:8000

## macOS / Linux virtual environment
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
ollama pull qwen2.5:1.5b
ollama serve
```
In another terminal:
```bash
uvicorn app:app --reload
```

## How the score works
The displayed 0–100 score is a transparent heuristic score based on simple warning patterns. It is not a calibrated probability. The local AI explanation is additional context and does not determine the numeric score.

## Supabase scan storage
The backend verifies each scan's bearer token with Supabase Auth before analysis. It saves successful message and URL scans to the existing `scan_history` table, using the verified user's UUID and the table's existing columns. The access token is also used for the database request so Supabase row-level security remains in effect; the backend does not accept a user UUID from the browser. The backend does not supply an `id`; the integer primary key is not populated with an incompatible UUID.

Keep the Supabase project URL and server-side API key, along with the Gemini key, in the backend `.env`. The existing browser Supabase publishable key is intentionally public and is required by the Supabase JavaScript client for login; never put a Supabase service-role/secret key in static frontend files. The `scan_history` table should have row-level security enabled with policies that restrict rows to `user_id = auth.uid()` (including an insert check); the backend reports a save error rather than claiming success if Supabase rejects an insert.

## Important limitations
- URL checks are pattern-based. The app does not visit URLs, resolve redirects, check live domain reputation, or prove a site is safe.
- Message and URL text are sent to the Ollama process on localhost for local inference. Do not expose the Ollama API or FastAPI server publicly without security controls.
- LocalStorage history is stored in the current browser profile and is not encrypted; server-side scan records are subject to your Supabase row-level security policies.
- A low score does not guarantee safety. Never share OTPs, passwords, PINs, or banking credentials.
- This prototype does not yet intercept SMS automatically or provide device-wide protection. Those require a native mobile/browser integration and explicit permissions.
