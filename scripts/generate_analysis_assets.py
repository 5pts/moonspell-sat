import concurrent.futures
import json
import re
import time
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_PATH = ROOT / "src" / "data" / "questions.json"
OPTION_TRANSLATIONS_PATH = ROOT / "src" / "data" / "option_translations.json"
EXPLANATION_TRANSLATIONS_PATH = ROOT / "src" / "data" / "explanation_translations.json"

TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single"
HEADERS = {
    "User-Agent": "Mozilla/5.0",
}


def load_json(path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path, payload):
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def has_chinese(text):
    return bool(re.search(r"[\u4e00-\u9fff]", str(text or "")))


def translate_text(text):
    params = {
        "client": "gtx",
        "sl": "en",
        "tl": "zh-CN",
        "dt": "t",
        "q": text,
    }
    for attempt in range(5):
        try:
            response = requests.get(
                TRANSLATE_URL,
                params=params,
                headers=HEADERS,
                timeout=20,
            )
            response.raise_for_status()
            payload = response.json()
            translated = "".join(part[0] for part in payload[0] if part and part[0])
            if translated:
                return translated
        except Exception:
            if attempt == 4:
                raise
            time.sleep(1.2 * (attempt + 1))
    return text


def main():
    questions = load_json(QUESTIONS_PATH, {}).get("questions", [])
    option_translations = load_json(OPTION_TRANSLATIONS_PATH, {})
    explanation_translations = load_json(EXPLANATION_TRANSLATIONS_PATH, {})

    unique_options = sorted(
        {
            option["text"]
            for question in questions
            for option in question.get("options", [])
            if option.get("text")
        }
    )

    english_explanations = {
        question["globalId"]: question.get("explanation", "")
        for question in questions
        if question.get("explanation") and not has_chinese(question.get("explanation"))
    }

    missing_options = [text for text in unique_options if text not in option_translations]
    missing_explanations = {
        key: value
        for key, value in english_explanations.items()
        if key not in explanation_translations
    }

    print(f"Unique options: {len(unique_options)}")
    print(f"Missing option translations: {len(missing_options)}")
    print(f"Missing explanation translations: {len(missing_explanations)}")

    def translate_option(text):
        return text, translate_text(text)

    def translate_explanation(item):
        qid, text = item
        return qid, translate_text(text)

    if missing_options:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            for index, (text, translated) in enumerate(executor.map(translate_option, missing_options), start=1):
                option_translations[text] = translated
                if index % 50 == 0 or index == len(missing_options):
                    print(f"Options translated: {index}/{len(missing_options)}")
                    save_json(OPTION_TRANSLATIONS_PATH, option_translations)
        save_json(OPTION_TRANSLATIONS_PATH, option_translations)

    if missing_explanations:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            items = list(missing_explanations.items())
            for index, (qid, translated) in enumerate(executor.map(translate_explanation, items), start=1):
                explanation_translations[qid] = translated
                if index % 25 == 0 or index == len(items):
                    print(f"Explanations translated: {index}/{len(items)}")
                    save_json(EXPLANATION_TRANSLATIONS_PATH, explanation_translations)
        save_json(EXPLANATION_TRANSLATIONS_PATH, explanation_translations)

    print("Done.")


if __name__ == "__main__":
    main()
