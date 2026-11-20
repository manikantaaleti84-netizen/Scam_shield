import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai

load_dotenv(Path(__file__).resolve().with_name(".env"))

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env")

client = genai.Client(api_key=API_KEY)


def gemini_explanation(prompt: str) -> str:
    """Generate scam analysis using Gemini."""
    try:
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt
        )
        return response.text or "No response generated."

    except Exception as e:
        return f"Gemini error: {str(e)}"