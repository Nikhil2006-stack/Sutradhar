"""LLM and Embedding provider abstraction with transparent status reporting."""

from __future__ import annotations

import hashlib
import math
import re
from typing import Any, Dict, List

import httpx

from app.core.config import get_settings


def get_ai_provider_status() -> Dict[str, Any]:
    """Return explicit configuration status of AI/LLM/OCR providers."""
    settings = get_settings()
    active = settings.active_llm_provider
    return {
        "active_provider": active,
        "configured_mode": settings.LLM_PROVIDER,
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "openai_configured": bool(settings.OPENAI_API_KEY),
        "model": settings.LLM_MODEL if active != "deterministic" else "sutradhar-deterministic-engine-v1",
        "vector_dimensions": 64,
        "ocr_enabled": settings.OCR_ENABLED,
        "status_message": (
            f"Connected to {active.upper()} ({settings.LLM_MODEL})"
            if active in ("gemini", "openai")
            else "Running Sutradhar Deterministic Statistical & Rule-Based Intelligence Engine (Set GEMINI_API_KEY or OPENAI_API_KEY in .env to enable live generative synthesis)."
        ),
    }


def compute_text_embedding(text: str, dim: int = 64) -> List[float]:
    """Compute a normalized deterministic semantic/lexical embedding vector for RAG retrieval."""
    tokens = re.findall(r"[a-zA-Z0-9_₹%-]+", (text or "").lower())
    vec = [0.0] * dim
    if not tokens:
        return vec
    for idx, token in enumerate(tokens):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        bucket = digest[0] % dim
        sign = 1.0 if (digest[1] % 2 == 0) else -1.0
        weight = 1.5 if len(token) > 4 else 1.0
        vec[bucket] += sign * weight
        # Bigram context
        if idx + 1 < len(tokens):
            bigram = f"{token}_{tokens[idx + 1]}"
            b_digest = hashlib. md5(bigram.encode("utf-8")).digest()
            b_bucket = b_digest[0] % dim
            vec[b_bucket] += 0.75

    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [round(v / norm, 6) for v in vec]
    return vec


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity between two embedding vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(dot / (norm_a * norm_b))


def generate_llm_synthesis(system_prompt: str, user_prompt: str, fallback_text: str) -> tuple[str, str]:
    """
    Generate grounded synthesis via configured LLM provider (Gemini / OpenAI)
    or return the verified deterministic synthesis if no external key is configured.
    Returns (response_text, provider_used).
    """
    settings = get_settings()
    provider = settings.active_llm_provider

    if provider == "gemini" and settings.GEMINI_API_KEY:
        try:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{settings.LLM_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
            )
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}],
                    }
                ],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 700},
            }
            with httpx.Client(timeout=12.0) as client:
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    text = (
                        data.get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [{}])[0]
                        .get("text", "")
                    )
                    if text.strip():
                        return text.strip(), "gemini"
        except Exception:
            pass

    if provider == "openai" and settings.OPENAI_API_KEY:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.1,
            }
            with httpx.Client(timeout=12.0) as client:
                resp = client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    text = data["choices"][0]["message"]["content"]
                    if text.strip():
                        return text.strip(), "openai"
        except Exception:
            pass

    return fallback_text, "deterministic"

