from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

from extract_pdf import (
    LATER_SECTION_PAGE_RANGES,
    SECTION1_NAME,
    SECTION2_NAME,
    Question,
    parse_source_questions,
    rebuild_later_sections,
)


PDF_PATH = Path("Sentence Completion 300(1).pdf")
MARKDOWN_OUTPUT_PATH = Path("questions.md")
JSON_OUTPUT_PATH = Path("questions.json")
JS_OUTPUT_PATH = Path("questions.data.js")


def display_section_name(section_name: str) -> str:
    return section_name.replace(" 分数", "")


def section_code(section_name: str) -> str:
    if section_name == SECTION1_NAME:
        return "S1"
    if section_name == SECTION2_NAME:
        return "S2"
    if section_name.startswith("Vocabulary Part "):
        part_no = section_name.split("Vocabulary Part ", 1)[1].split()[0]
        return f"V{part_no}"
    if section_name.startswith("Quiz_Vocabulary Part "):
        part_no = section_name.split("Quiz_Vocabulary Part ", 1)[1].split()[0]
        return f"V{part_no}"
    return "G"


def local_number_width(section_name: str) -> int:
    return 3 if section_name in {SECTION1_NAME, SECTION2_NAME} else 2


def question_codes(question: Question, global_index: int) -> tuple[str, str]:
    local_code = f"{section_code(question.section)}-{question.number:0{local_number_width(question.section)}d}"
    global_code = f"Q{global_index:03d}"
    return global_code, local_code


def normalize_duplicate_key(text: str) -> str:
    normalized = text.lower().replace("_______", " blank ")
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def format_question(question: Question, global_index: int) -> str:
    global_code, local_code = question_codes(question, global_index)
    lines = [f"**{global_code} | {local_code}.** {question.stem}", ""]
    for index, option in enumerate(question.options):
        letter = chr(ord("A") + index)
        lines.append(f"- {letter}. {option}")
    lines.append("")
    return "\n".join(lines)


def section_title(section_name: str, start_index: int, end_index: int, count: int) -> str:
    return f"{display_section_name(section_name)} | {section_code(section_name)} | Q{start_index:03d}-Q{end_index:03d} | {count} Questions"


def ordered_groups(
    source_questions: list[Question],
    later_sections: dict[str, list[Question]],
) -> list[tuple[str, list[Question]]]:
    groups: list[tuple[str, list[Question]]] = [
        (SECTION1_NAME, [question for question in source_questions if question.section == SECTION1_NAME]),
        (SECTION2_NAME, [question for question in source_questions if question.section == SECTION2_NAME]),
    ]
    for section_name in LATER_SECTION_PAGE_RANGES:
        groups.append((section_name, later_sections[section_name]))
    return groups


def build_index(groups: list[tuple[str, list[Question]]]) -> list[str]:
    lines = [
        "## Index",
        "",
        "`Qxxx` is the global question number. `S1-xxx` / `S2-xxx` / `Vx-xx` is the group-local number.",
        "",
    ]
    running = 1
    for section_name, questions in groups:
        start = running
        end = running + len(questions) - 1
        lines.append(
            f"- `{section_code(section_name)}`: {display_section_name(section_name)} "
            f"(`Q{start:03d}-Q{end:03d}`, {len(questions)} questions)"
        )
        running = end + 1
    lines.append("")
    return lines


def build_dataset(groups: list[tuple[str, list[Question]]]) -> dict:
    sections: list[dict] = []
    questions: list[dict] = []
    duplicate_index: dict[str, list[str]] = {}
    running = 1

    for section_name, section_questions in groups:
        start_index = running
        for question in section_questions:
            global_code, local_code = question_codes(question, running)
            record = {
                "globalIndex": running,
                "globalId": global_code,
                "localIndex": question.number,
                "localId": local_code,
                "section": question.section,
                "sectionDisplayName": display_section_name(question.section),
                "sectionCode": section_code(question.section),
                "stem": question.stem,
                "blankCount": question.stem.count("_______"),
                "optionCount": len(question.options),
                "options": [
                    {"label": chr(ord("A") + index), "text": option}
                    for index, option in enumerate(question.options)
                ],
                "duplicateKey": normalize_duplicate_key(question.stem),
            }
            questions.append(record)
            duplicate_index.setdefault(record["duplicateKey"], []).append(global_code)
            running += 1

        end_index = running - 1
        sections.append(
            {
                "name": section_name,
                "displayName": display_section_name(section_name),
                "code": section_code(section_name),
                "count": len(section_questions),
                "startGlobalIndex": start_index,
                "endGlobalIndex": end_index,
                "startGlobalId": f"Q{start_index:03d}",
                "endGlobalId": f"Q{end_index:03d}",
            }
        )

    duplicate_groups = []
    duplicate_lookup: dict[str, list[str]] = {}
    for key, ids in duplicate_index.items():
        if len(ids) < 2:
            continue
        duplicate_groups.append({"key": key, "questionIds": ids, "count": len(ids)})
        for question_id in ids:
            duplicate_lookup[question_id] = ids

    for question in questions:
        siblings = duplicate_lookup.get(question["globalId"], [])
        question["duplicateIds"] = [question_id for question_id in siblings if question_id != question["globalId"]]
        question["duplicateCount"] = len(question["duplicateIds"])
        del question["duplicateKey"]

    return {
        "title": "Sentence Completion 300",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "summary": {
            "sectionCount": len(sections),
            "totalQuestions": len(questions),
            "duplicateGroupCount": len(duplicate_groups),
        },
        "sections": sections,
        "questions": questions,
        "duplicateGroups": duplicate_groups,
    }


def write_markdown(source_questions: list[Question], later_sections: dict[str, list[Question]]) -> tuple[str, list[tuple[str, list[Question]]]]:
    groups = ordered_groups(source_questions, later_sections)
    parts = ["# Sentence Completion 300", ""]
    parts.extend(build_index(groups))

    running = 1
    for section_name, questions in groups:
        start = running
        end = running + len(questions) - 1
        parts.extend([f"## {section_title(section_name, start, end, len(questions))}", ""])
        for question in questions:
            parts.append(format_question(question, running))
            running += 1

    return "\n".join(parts).rstrip() + "\n", groups


def write_frontend_exports(dataset: dict) -> None:
    json_text = json.dumps(dataset, ensure_ascii=False, indent=2)
    js_text = "window.QUESTION_BANK = " + json.dumps(dataset, ensure_ascii=False, separators=(",", ":")) + ";\n"
    JSON_OUTPUT_PATH.write_text(json_text, encoding="utf-8")
    JS_OUTPUT_PATH.write_text(js_text, encoding="utf-8")


def main() -> None:
    source_questions = parse_source_questions(PDF_PATH)
    later_sections = rebuild_later_sections(PDF_PATH, MARKDOWN_OUTPUT_PATH, source_questions)
    markdown, groups = write_markdown(source_questions, later_sections)
    dataset = build_dataset(groups)

    MARKDOWN_OUTPUT_PATH.write_text(markdown, encoding="utf-8")
    write_frontend_exports(dataset)


if __name__ == "__main__":
    main()
