from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Iterable

import requests
from bs4 import BeautifulSoup


BASE_DIR = Path(__file__).resolve().parent
QUESTION_BANK_PATH = BASE_DIR / "questions.json"
QUESTION_META_JSON_PATH = BASE_DIR / "question_meta.json"
QUESTION_META_JS_PATH = BASE_DIR / "question-meta.data.js"
LEXICON_SEED_JSON_PATH = BASE_DIR / "lexicon_seed.json"
LEXICON_SEED_JS_PATH = BASE_DIR / "lexicon.data.js"

CRACKSAT_URL = "https://www.cracksat.net/sat/sentence-completion/question-{number}-answer-and-explanation.html"
MAX_CRACKSAT_QUESTION = 999
REQUEST_TIMEOUT = 20
MAX_WORKERS = 10

TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z'-]{2,}")
STOP_WORDS = {
    "the",
    "and",
    "that",
    "with",
    "from",
    "were",
    "they",
    "them",
    "this",
    "would",
    "have",
    "into",
    "while",
    "their",
    "there",
    "been",
    "only",
    "could",
    "because",
    "which",
    "those",
    "these",
    "about",
    "being",
    "though",
    "after",
    "still",
    "than",
    "such",
    "made",
    "make",
    "many",
    "much",
    "more",
    "most",
    "some",
    "just",
    "also",
    "even",
    "into",
    "your",
    "ours",
    "hers",
    "his",
    "herself",
    "himself",
}

PREFIX_NOTES = {
    "anti": "Prefix hook: `anti-` often signals opposition or resistance.",
    "bene": "Root hook: `bene-` points to goodness or benefit.",
    "contra": "Root hook: `contra-` suggests contrast or opposition.",
    "de": "Prefix hook: `de-` often marks reversal, reduction, or removal.",
    "dis": "Prefix hook: `dis-` often signals separation, negation, or undoing.",
    "equi": "Root hook: `equi-` suggests equality or balance.",
    "hetero": "Root hook: `hetero-` signals difference or mixed kinds.",
    "hyper": "Prefix hook: `hyper-` usually means over, beyond, or excessive.",
    "inter": "Prefix hook: `inter-` suggests between or among.",
    "intro": "Prefix hook: `intro-` suggests inward direction.",
    "magni": "Root hook: `magni-` points to greatness or size.",
    "mal": "Root hook: `mal-` often carries a bad or harmful sense.",
    "multi": "Prefix hook: `multi-` suggests many or multiple.",
    "neo": "Prefix hook: `neo-` signals something new or revived.",
    "para": "Prefix hook: `para-` can suggest beside, beyond, or deviation.",
    "peri": "Prefix hook: `peri-` suggests around or surrounding.",
    "poly": "Prefix hook: `poly-` points to many.",
    "pre": "Prefix hook: `pre-` suggests before or in advance.",
    "pro": "Prefix hook: `pro-` often suggests forward movement or support.",
    "retro": "Prefix hook: `retro-` signals backward or behind.",
    "sub": "Prefix hook: `sub-` suggests under or below.",
    "super": "Prefix hook: `super-` suggests over or above.",
    "syn": "Root hook: `syn-` suggests togetherness or combination.",
    "sym": "Root hook: `sym-` suggests togetherness or combination.",
    "trans": "Prefix hook: `trans-` suggests across or through.",
}

SUFFIX_NOTES = {
    "able": "Suffix hook: `-able` usually marks something capable of being done.",
    "acy": "Suffix hook: `-acy` often turns an idea into an abstract noun.",
    "al": "Suffix hook: `-al` often forms adjectives tied to a quality or relation.",
    "ance": "Suffix hook: `-ance` often signals a state or condition.",
    "ant": "Suffix hook: `-ant` often marks an agent or a continuing quality.",
    "ary": "Suffix hook: `-ary` often forms adjectives or nouns tied to function.",
    "ate": "Suffix hook: `-ate` often forms verbs or adjectives with an active sense.",
    "ation": "Suffix hook: `-ation` often names a process or result.",
    "dom": "Suffix hook: `-dom` often marks a state, rank, or domain.",
    "ence": "Suffix hook: `-ence` often names a state or quality.",
    "ent": "Suffix hook: `-ent` often marks a quality or an agent.",
    "fy": "Suffix hook: `-fy` often means to make or render.",
    "hood": "Suffix hook: `-hood` often names a condition or collective state.",
    "ible": "Suffix hook: `-ible` usually marks something capable of being done.",
    "ic": "Suffix hook: `-ic` often forms adjectives linked to a field or quality.",
    "ify": "Suffix hook: `-ify` often means to make or cause.",
    "ion": "Suffix hook: `-ion` often turns an action into a noun.",
    "ious": "Suffix hook: `-ious` often forms adjectives describing a quality.",
    "ism": "Suffix hook: `-ism` often names a belief, practice, or system.",
    "ist": "Suffix hook: `-ist` often marks a person associated with a field or view.",
    "ity": "Suffix hook: `-ity` often turns an adjective into an abstract noun.",
    "ive": "Suffix hook: `-ive` often forms adjectives describing a tendency or force.",
    "ize": "Suffix hook: `-ize` often means to make or render.",
    "less": "Suffix hook: `-less` means without.",
    "logy": "Root hook: `-logy` usually signals a field of study.",
    "ment": "Suffix hook: `-ment` often names a result or condition.",
    "ness": "Suffix hook: `-ness` often turns an adjective into a state.",
    "ory": "Suffix hook: `-ory` often forms adjectives or result nouns.",
    "ous": "Suffix hook: `-ous` often forms adjectives full of a quality.",
    "ship": "Suffix hook: `-ship` often names status, role, or relationship.",
    "tion": "Suffix hook: `-tion` often turns an action into a noun.",
    "tude": "Suffix hook: `-tude` often marks a state or attitude.",
    "ward": "Suffix hook: `-ward` marks direction.",
}

RELATION_PATTERNS = [
    (re.compile(r"\balthough\b|\bthough\b|\bbut\b|\byet\b|\bhowever\b|\bdespite\b|\bnevertheless\b|\binstead of\b|\brather than\b", re.I), "contrast"),
    (re.compile(r"\bbecause\b|\bsince\b|\bfor\b", re.I), "cause-and-effect"),
    (re.compile(r"\bonly to discover\b|\bturned out\b|\bfar from\b|\bnot necessarily\b", re.I), "expectation shift"),
    (re.compile(r"\bnot only\b.*\bbut\b|\bboth\b|\band\b", re.I), "parallel logic"),
]


def normalize_text(text: str) -> str:
    text = text.lower()
    text = text.replace("’", "'").replace("‘", "'")
    text = text.replace("“", '"').replace("”", '"')
    text = re.sub(r"[-_]{3,}|\.{3,}|…", " blank ", text)
    text = re.sub(r"[^a-z0-9']+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def option_signature(options: Iterable[dict]) -> tuple[str, ...]:
    return tuple(normalize_text(option["text"]) for option in options)


def extract_question_payload(question: dict) -> dict:
    focus_words = []
    for option in question["options"]:
        for token in TOKEN_RE.findall(option["text"]):
            word = token.lower()
            if word not in STOP_WORDS and word not in focus_words:
                focus_words.append(word)
    return {
        "id": question["globalId"],
        "stem": question["stem"],
        "normalizedStem": normalize_text(question["stem"]),
        "options": question["options"],
        "optionSignature": option_signature(question["options"]),
        "focusWords": focus_words[:8],
    }


def fetch_cracksat_question(number: int) -> dict | None:
    url = CRACKSAT_URL.format(number=number)
    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT)
    except requests.RequestException:
        return None
    if response.status_code != 200:
        return None

    soup = BeautifulSoup(response.text, "html.parser")
    conl = soup.select_one("#conl")
    if conl is None:
        return None

    paragraphs = conl.find_all("p", recursive=False)
    if len(paragraphs) < 4:
        return None

    question_text = paragraphs[1].get_text(" ", strip=True)
    question_text = re.sub(r"^\d+\.\s*", "", question_text).strip()
    options_text = paragraphs[2].get_text("\n", strip=True)
    options = []
    for line in options_text.splitlines():
        line = line.strip()
        match = re.match(r"^([A-E])\.\s*(.+)$", line)
        if match:
            options.append({"label": match.group(1), "text": match.group(2).strip()})

    answer_match = re.search(r"Correct Answer:\s*</strong>\s*([A-E])", response.text, re.I)
    if not answer_match:
        answer_match = re.search(r"Explanation for Correct Answer\s*([A-E])", response.text, re.I)
    if not answer_match:
        return None

    explanation_match = re.search(
        r"Explanation for Correct Answer\s*([A-E])\s*:\s*</p>\s*<p>(.*?)</p>",
        response.text,
        re.I | re.S,
    )
    explanation_html = explanation_match.group(2) if explanation_match else ""
    explanation_text = BeautifulSoup(explanation_html, "html.parser").get_text(" ", strip=True)

    return {
        "pageNumber": number,
        "sourceUrl": url,
        "stem": question_text,
        "normalizedStem": normalize_text(question_text),
        "options": options,
        "optionSignature": option_signature(options),
        "answerLetter": answer_match.group(1).upper(),
        "sourceExplanation": explanation_text,
    }


def relation_hint(stem: str) -> str:
    for pattern, label in RELATION_PATTERNS:
        if pattern.search(stem):
            return label
    return "contextual fit"


def clue_snippet(stem: str) -> str:
    lowered = stem.lower()
    for marker in [
        "although",
        "though",
        "but",
        "yet",
        "however",
        "despite",
        "because",
        "since",
        "only to discover",
        "instead of",
        "rather than",
        "not necessarily",
    ]:
        idx = lowered.find(marker)
        if idx >= 0:
            start = max(0, idx - 20)
            end = min(len(stem), idx + len(marker) + 48)
            return stem[start:end].strip(" ,.;:")
    return stem[:88].strip()


def build_walkthrough_explanation(question: dict, answer_letter: str) -> str:
    answer_option = next(
        (option["text"] for option in question["options"] if option["label"] == answer_letter),
        "",
    )
    relation = relation_hint(question["stem"])
    clue = clue_snippet(question["stem"])
    if question.get("blankCount", 1) >= 2:
        return (
            f"This is a two-blank logic check. The sentence turns on {relation} cues around "
            f'"{clue}". The pair "{answer_option}" is the only choice that keeps both blanks '
            "consistent when you plug it back into the sentence."
        )
    return (
        f'The sentence turns on {relation} cues around "{clue}". Plugging in "{answer_option}" '
        "preserves the tone and meaning; the other choices break the sentence logic."
    )


def build_word_family(word: str) -> list[str]:
    variants = []
    if word.endswith("y") and len(word) > 4:
        variants.extend([word[:-1] + "ies", word[:-1] + "ied", word[:-1] + "iness"])
    if word.endswith("e") and len(word) > 4:
        variants.extend([word + "d", word[:-1] + "ing", word + "r"])
    if len(word) > 4:
        variants.extend([word + "s", word + "ly", word + "ness", word + "ment"])
    filtered = []
    for variant in variants:
        if variant != word and variant not in filtered and re.fullmatch(r"[a-z][a-z'-]{2,}", variant):
            filtered.append(variant)
    return filtered[:6]


def build_memory_hooks(word: str, related_question: dict) -> list[dict]:
    hooks = [
        {
            "type": "context",
            "title": "Context anchor",
            "text": (
                f'Anchor it to {related_question["globalId"]}: the word shows up against the sentence '
                f'logic in "{clue_snippet(related_question["stem"])}".'
            ),
        }
    ]

    lowered = word.lower()
    for prefix, note in PREFIX_NOTES.items():
        if lowered.startswith(prefix) and len(lowered) - len(prefix) >= 3:
            hooks.append({"type": "prefix", "title": "Prefix / root hook", "text": note})
            break
    else:
        for suffix, note in sorted(SUFFIX_NOTES.items(), key=lambda item: len(item[0]), reverse=True):
            if lowered.endswith(suffix) and len(lowered) - len(suffix) >= 2:
                hooks.append({"type": "suffix", "title": "Suffix / word-family hook", "text": note})
                break
        else:
            chunks = "-".join(re.findall(r".{1,3}", lowered))
            hooks.append(
                {
                    "type": "sound",
                    "title": "Sound hook",
                    "text": f'Chunk the form as "{chunks}" and rehearse it with the source sentence aloud.',
                }
            )

    if len(hooks) < 2:
        hooks.append(
            {
                "type": "contrast",
                "title": "Elimination hook",
                "text": "Remember it by contrast: it survives because nearby answer choices break the sentence logic.",
            }
        )
    return hooks[:2]


def cambridge_url(word: str) -> str:
    return f"https://dictionary.cambridge.org/us/search/english/direct/?q={word}"


def merriam_url(word: str) -> str:
    return f"https://www.merriam-webster.com/dictionary/{word}"


def build_lexicon_seed(question_bank: dict, question_meta: dict) -> dict:
    words: dict[str, dict] = {}
    question_lookup = {question["globalId"]: question for question in question_bank["questions"]}

    for question in question_bank["questions"]:
        for token in TOKEN_RE.findall(question["stem"]):
            word = token.lower()
            if word in STOP_WORDS:
                continue
            words.setdefault(
                word,
                {
                    "word": word,
                    "cambridgeUrl": cambridge_url(word),
                    "merriamUrl": merriam_url(word),
                    "relatedQuestionIds": [],
                    "memoryHooks": [],
                    "authorityExamples": [],
                    "derivatives": build_word_family(word),
                    "status": "seeded",
                },
            )
            if question["globalId"] not in words[word]["relatedQuestionIds"]:
                words[word]["relatedQuestionIds"].append(question["globalId"])

    for question_id, meta in question_meta["questions"].items():
        question = question_lookup.get(question_id)
        if not question:
            continue
        for word in meta["focusWords"]:
            entry = words.setdefault(
                word,
                {
                    "word": word,
                    "cambridgeUrl": cambridge_url(word),
                    "merriamUrl": merriam_url(word),
                    "relatedQuestionIds": [],
                    "memoryHooks": [],
                    "authorityExamples": [],
                    "derivatives": build_word_family(word),
                    "status": "seeded",
                },
            )
            if question_id not in entry["relatedQuestionIds"]:
                entry["relatedQuestionIds"].append(question_id)
            if not entry["memoryHooks"]:
                entry["memoryHooks"] = build_memory_hooks(word, question)

    curated_examples = {
        "therapeutic": {
            "memoryHooks": [
                {
                    "type": "root",
                    "title": "Greek root hook",
                    "text": "Connect it to `therapy`: both words trace back to healing or treatment.",
                },
                {
                    "type": "context",
                    "title": "Pool context",
                    "text": "In Q003, hot springs help people with ailments, so the needed idea is healing, not scent or authority.",
                },
            ],
            "authorityExamples": [
                {
                    "source": "Merriam-Webster Dictionary",
                    "text": "The treatment has a therapeutic effect on chronic pain.",
                }
            ],
            "derivatives": ["therapy", "therapist", "therapeutically"],
        },
        "palliative": {
            "memoryHooks": [
                {
                    "type": "root",
                    "title": "Relief hook",
                    "text": "Link it to `palliate`, which means to lessen the severity of pain or blame.",
                },
                {
                    "type": "context",
                    "title": "Apology context",
                    "text": "In Q013, the speaker hopes the excuse will soften the offense, not intensify it.",
                },
            ],
            "authorityExamples": [
                {
                    "source": "Merriam-Webster Dictionary",
                    "text": "The drug is used in palliative care to ease suffering.",
                }
            ],
            "derivatives": ["palliate", "palliation", "palliatively"],
        },
        "sycophants": {
            "memoryHooks": [
                {
                    "type": "sound",
                    "title": "Sound hook",
                    "text": "Hear `sick-of-praise`: a sycophant wins favor through flattery.",
                },
                {
                    "type": "context",
                    "title": "Flattery context",
                    "text": "In Q010, the clue is praise used to gain approval, so the target word must mean flatterers.",
                },
            ],
            "authorityExamples": [
                {
                    "source": "Cambridge Dictionary",
                    "text": "He surrounded himself with sycophants who praised every decision.",
                }
            ],
            "derivatives": ["sycophant", "sycophantic"],
        },
        "gaudy": {
            "memoryHooks": [
                {
                    "type": "contrast",
                    "title": "Style contrast",
                    "text": "Set it against `dark and understated`: the opposite is loud, flashy, and overdone.",
                },
                {
                    "type": "sound",
                    "title": "Sound hook",
                    "text": "Hear `gaudy` as `showy-gaudy`: bright enough to feel almost noisy.",
                },
            ],
            "authorityExamples": [
                {
                    "source": "Cambridge Dictionary",
                    "text": "She disliked the room's gaudy gold wallpaper.",
                }
            ],
            "derivatives": ["gaudily", "gaudiness"],
        },
    }

    for word, payload in curated_examples.items():
        entry = words.setdefault(
            word,
            {
                "word": word,
                "cambridgeUrl": cambridge_url(word),
                "merriamUrl": merriam_url(word),
                "relatedQuestionIds": [],
                "memoryHooks": [],
                "authorityExamples": [],
                "derivatives": build_word_family(word),
                "status": "seeded",
            },
        )
        entry["memoryHooks"] = payload["memoryHooks"]
        entry["authorityExamples"] = payload["authorityExamples"]
        entry["derivatives"] = payload["derivatives"]
        entry["status"] = "curated-demo"

    return {
        "generatedFrom": QUESTION_BANK_PATH.name,
        "wordCount": len(words),
        "entries": dict(sorted(words.items())),
    }


def match_remote_questions(question_bank: dict) -> dict:
    questions = [extract_question_payload(question) for question in question_bank["questions"]]
    by_stem: dict[str, list[dict]] = {}
    for question in questions:
        by_stem.setdefault(question["normalizedStem"], []).append(question)

    matches: dict[str, dict] = {}
    unmatched = set(question["id"] for question in questions)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_cracksat_question, number): number for number in range(1, MAX_CRACKSAT_QUESTION + 1)}
        for future in as_completed(futures):
            remote = future.result()
            if remote is None:
                continue
            candidates = by_stem.get(remote["normalizedStem"], [])
            if not candidates:
                continue
            for candidate in candidates:
                if candidate["optionSignature"] != remote["optionSignature"]:
                    continue
                answer_text = next(
                    (
                        option["text"]
                        for option in candidate["options"]
                        if option["label"] == remote["answerLetter"]
                    ),
                    "",
                )
                matches[candidate["id"]] = {
                    "answerLetter": remote["answerLetter"],
                    "answerText": answer_text,
                    "walkthroughExplanation": build_walkthrough_explanation(candidate, remote["answerLetter"]),
                    "sourceUrl": remote["sourceUrl"],
                    "sourceAttribution": "Matched against public answer page on cracksat.net",
                    "focusWords": candidate["focusWords"],
                }
                unmatched.discard(candidate["id"])

    return {
        "matchedCount": len(matches),
        "unmatchedQuestionIds": sorted(unmatched),
        "questions": dict(sorted(matches.items())),
    }


def write_json_and_js(path_json: Path, path_js: Path, variable_name: str, payload: dict) -> None:
    path_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    path_js.write_text(
        f"window.{variable_name} = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )


def main() -> None:
    question_bank = json.loads(QUESTION_BANK_PATH.read_text(encoding="utf-8"))
    question_meta = match_remote_questions(question_bank)
    lexicon_seed = build_lexicon_seed(question_bank, question_meta)

    write_json_and_js(QUESTION_META_JSON_PATH, QUESTION_META_JS_PATH, "QUESTION_META", question_meta)
    write_json_and_js(LEXICON_SEED_JSON_PATH, LEXICON_SEED_JS_PATH, "LEXICON_SEED", lexicon_seed)

    print(
        json.dumps(
            {
                "matched": question_meta["matchedCount"],
                "total": question_bank["summary"]["totalQuestions"],
                "lexiconWords": lexicon_seed["wordCount"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
