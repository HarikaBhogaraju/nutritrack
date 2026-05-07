"""One-shot diagnostic to figure out why ANTHROPIC_API_KEY auth is failing.

Run from backend/ with the venv active:
    python diagnose_key.py

Pastes safe-to-share output: only the first 12 + last 4 characters of any key
are shown, and the middle is redacted.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import httpx


def redact(value: str) -> str:
    if not value:
        return "EMPTY"
    if len(value) <= 16:
        return f"<short, len={len(value)}>"
    return f"{value[:12]}...{value[-4:]}  (len={len(value)})"


print("=" * 60)
print("ANTHROPIC_API_KEY diagnostic")
print("=" * 60)

# 1. Working directory
cwd = Path.cwd()
print(f"\n[1] Working directory:")
print(f"    {cwd}")
print(f"    .env in cwd?  {(cwd / '.env').exists()}")

# 2. .env raw read
env_path = cwd / ".env"
key_in_env_file = None
if env_path.exists():
    print(f"\n[2] backend/.env contents (key only):")
    with env_path.open("rb") as f:
        raw = f.read()
    # Look for ANTHROPIC_API_KEY=... line
    matches = re.findall(rb"^ANTHROPIC_API_KEY=(.*)$", raw, re.MULTILINE)
    if not matches:
        print("    NO 'ANTHROPIC_API_KEY=' line found in .env")
    else:
        for i, m in enumerate(matches):
            decoded = m.decode("utf-8", errors="replace")
            print(f"    line {i+1}: {redact(decoded)}")
            # Look for suspicious characters
            problems = []
            if decoded.startswith(("'", '"')):
                problems.append("starts with a quote — REMOVE quotes around the value")
            if decoded.endswith(("'", '"')):
                problems.append("ends with a quote — REMOVE quotes around the value")
            if decoded != decoded.strip():
                problems.append("has leading/trailing whitespace")
            if "\r" in decoded:
                problems.append("contains a carriage return")
            if any(ord(c) < 32 for c in decoded):
                problems.append("contains non-printable characters")
            if not decoded.startswith("sk-ant-"):
                problems.append("does NOT start with 'sk-ant-' — wrong value pasted?")
            for p in problems:
                print(f"      ⚠️  {p}")
        if len(matches) > 1:
            print(f"    ⚠️  multiple ANTHROPIC_API_KEY lines — last one wins, the rest are dead")
        key_in_env_file = matches[-1].decode("utf-8", errors="replace").strip()
else:
    print(f"\n[2] backend/.env DOES NOT EXIST at {env_path}")
    print(f"    You must run uvicorn from inside backend/ for .env to load.")

# 3. Shell environment
print(f"\n[3] Shell environment:")
shell_key = os.environ.get("ANTHROPIC_API_KEY")
if shell_key is None:
    print(f"    ANTHROPIC_API_KEY is NOT set in shell env (good — .env will be used)")
else:
    print(f"    ANTHROPIC_API_KEY IS set in shell env:")
    print(f"    {redact(shell_key)}")
    print(f"    ⚠️  Shell env wins over .env. If this differs from .env, that's the bug.")
    print(f"    Fix: 'unset ANTHROPIC_API_KEY' AND remove it from ~/.zshrc / ~/.zprofile")

# 4. What Pydantic Settings actually loads
print(f"\n[4] What the app's Settings class loads:")
try:
    sys.path.insert(0, str(cwd))
    from app.config import get_settings  # noqa: E402

    settings = get_settings()
    loaded = settings.ANTHROPIC_API_KEY
    print(f"    loaded: {redact(loaded)}")

    # Compare against .env file value
    if key_in_env_file is not None:
        if loaded == key_in_env_file:
            print(f"    matches .env file: yes ✅")
        else:
            print(f"    matches .env file: NO ❌  (shell env or different cwd is overriding)")
except Exception as e:
    print(f"    FAILED to import app.config: {type(e).__name__}: {e}")
    loaded = None

# 5. Live Anthropic API check
print(f"\n[5] Live Anthropic API check (using the value Settings loaded):")
if not loaded:
    print(f"    skipped — no key loaded")
else:
    try:
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": loaded,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-5",
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "ping"}],
            },
            timeout=15.0,
        )
        print(f"    HTTP {r.status_code}")
        body = r.text[:300]
        print(f"    body[:300]: {body}")
        if r.status_code == 200:
            print(f"    ✅ Key works. The 401 in your app means the app is sending a DIFFERENT key.")
            print(f"       Restart uvicorn from a fresh terminal in backend/.")
        elif r.status_code == 401:
            print(f"    ❌ Key is genuinely invalid. Generate a brand new one at:")
            print(f"       https://console.anthropic.com/settings/keys")
            print(f"       At the create-key dialog, copy the value from the field labeled 'API Key'.")
        elif r.status_code == 400:
            print(f"    ⚠️  Key is OK but model name was rejected. Check CLAUDE_MODEL in .env.")
    except Exception as e:
        print(f"    request failed: {type(e).__name__}: {e}")

print("\n" + "=" * 60)
print("Done. Paste the entire output above.")
print("=" * 60)
