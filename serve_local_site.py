from __future__ import annotations

import contextlib
import http.server
import json
import os
import socket
import socketserver
import threading
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parent
TARGET = "local-site.html"
HOST = "127.0.0.1"
START_PORT = 8765
END_PORT = 8795


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:
        return

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/dictionary":
            self.handle_dictionary_lookup(parsed.query)
            return
        if parsed.path == "/api/translate":
            self.handle_translation_lookup(parsed.query)
            return
        super().do_GET()

    def handle_dictionary_lookup(self, query_string: str) -> None:
        params = urllib.parse.parse_qs(query_string)
        word = (params.get("word") or [""])[0].strip().lower()
        if not word:
            self.respond_json({"error": "Missing word parameter."}, status=400)
            return

        api_url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{urllib.parse.quote(word)}"
        request = urllib.request.Request(
            api_url,
            headers={"User-Agent": "Mozilla/5.0 MoonspellLocalPreview"},
        )

        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                payload = json.load(response)
        except Exception as exc:  # noqa: BLE001
            self.respond_json({"word": word, "error": f"Lookup failed: {exc}"}, status=502)
            return

        try:
            entry = payload[0]
            definitions = []
            meanings = []
            for meaning in entry.get("meanings", [])[:3]:
                if meaning.get("partOfSpeech"):
                    meanings.append(meaning["partOfSpeech"])
                for definition in meaning.get("definitions", [])[:2]:
                    text = definition.get("definition")
                    if text:
                        definitions.append(text)
                if len(definitions) >= 3:
                    break

            result = {
                "word": entry.get("word", word),
                "phonetic": entry.get("phonetic", ""),
                "meanings": meanings[:3],
                "definitions": definitions[:3],
            }
            self.respond_json(result)
        except Exception as exc:  # noqa: BLE001
            self.respond_json({"word": word, "error": f"Unexpected dictionary payload: {exc}"}, status=502)

    def handle_translation_lookup(self, query_string: str) -> None:
        params = urllib.parse.parse_qs(query_string)
        text = (params.get("text") or [""])[0].strip()
        if not text:
            self.respond_json({"error": "Missing text parameter."}, status=400)
            return

        api_url = (
            "https://translate.googleapis.com/translate_a/single"
            "?client=gtx&sl=en&tl=zh-CN&dt=t&q="
            + urllib.parse.quote(text)
        )
        request = urllib.request.Request(
            api_url,
            headers={"User-Agent": "Mozilla/5.0 MoonspellLocalPreview"},
        )

        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                payload = json.load(response)
        except Exception as exc:  # noqa: BLE001
            self.respond_json({"text": text, "error": f"Translation failed: {exc}"}, status=502)
            return

        try:
            translated = "".join(part[0] for part in payload[0] if part and part[0]).strip()
            self.respond_json({"text": text, "translation": translated})
        except Exception as exc:  # noqa: BLE001
            self.respond_json({"text": text, "error": f"Unexpected translation payload: {exc}"}, status=502)

    def respond_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def find_free_port() -> int:
    for port in range(START_PORT, END_PORT + 1):
        with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            if sock.connect_ex((HOST, port)) != 0:
                return port
    raise RuntimeError("No free port available in preview range.")


def main() -> None:
    os.chdir(ROOT)
    port = find_free_port()

    class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
        allow_reuse_address = True

    with ThreadedTCPServer((HOST, port), QuietHandler) as httpd:
        url = f"http://{HOST}:{port}/{TARGET}"
        print(f"Moonspell local preview is running at: {url}")
        print("Press Ctrl+C to stop the server.")

        timer = threading.Timer(1.0, lambda: webbrowser.open(url))
        timer.daemon = True
        timer.start()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
