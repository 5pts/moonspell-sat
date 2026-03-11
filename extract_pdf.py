from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import fitz
from pypdf import PdfReader
from rapidocr_onnxruntime import RapidOCR


SECTION1_NAME = "Section 1 (001-152)"
SECTION2_NAME = "Section 2 (1-152)"

LATER_SECTION_PAGE_RANGES = {
    "Vocabulary Part 1 分数": range(49, 52),
    "Vocabulary Part 2 分数": range(52, 55),
    "Vocabulary Part 3 分数": range(55, 58),
    "Vocabulary Part 4 分数": range(58, 61),
    "Vocabulary Part 5 分数": range(61, 65),
    "Vocabulary Part 6 分数": range(65, 69),
    "Quiz_Vocabulary Part 7 分数": range(69, 72),
}


@dataclass
class Question:
    section: str
    number: int
    stem: str
    options: list[str]


def clean_text(text: str) -> str:
    text = text.replace("\u3000", " ").replace("\xa0", " ")
    text = text.replace("’", "'").replace("‘", "'")
    text = text.replace("“", '"').replace("”", '"')
    text = text.replace("—", "-").replace("–", "-")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_option(text: str) -> str:
    text = clean_text(text).lower()
    text = re.sub(r"\s*(?:\.\s*\.)+\s*|\s*[…]+\s*|\s*\.{3,}\s*", " <sep> ", text)
    text = re.sub(r"[^a-z0-9<sep>' -]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def expected_blank_count(options: Iterable[str]) -> int:
    opts = list(options)
    two_blank = 0
    for opt in opts:
        if re.search(r"(?:\.\s*\.)|…|\.{3,}", opt):
            two_blank += 1
    return 2 if opts and two_blank >= max(2, len(opts) // 2) else 1


def count_blanks(text: str) -> int:
    return len(re.findall(r"[-_]{3,}", text))


def normalize_stem_blanks(text: str, blank: str = "_______") -> str:
    text = re.sub(r"[-_]{3,}", blank, text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def polish_stem_text(text: str) -> str:
    text = normalize_stem_blanks(text)
    text = re.sub(r"\s+([,.;:?!])", r"\1", text)
    text = re.sub(r"([(\[])\s+", r"\1", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_pdf_question_range(
    reader: PdfReader,
    start_page: int,
    end_page: int,
    section_name: str,
) -> list[Question]:
    text = "\n".join((reader.pages[i].extract_text() or "") for i in range(start_page, end_page))
    lines = [clean_text(line) for line in text.splitlines()]

    questions: list[Question] = []
    current: Question | None = None

    for line in lines:
        if not line or re.fullmatch(r"\d+", line):
            continue
        if "Section 1" in line or "Section 2" in line:
            continue

        match = re.match(r"^(\d{1,3})(?:[\.．]|\s)(.*)$", line)
        if match:
            if current is not None:
                questions.append(current)
            current = Question(
                section=section_name,
                number=int(match.group(1)),
                stem=match.group(2).strip(),
                options=[],
            )
            continue

        match = re.match(r"^(?:([A-E])\.|\(([A-E])\))\s*(.*)$", line)
        option_text = match.group(3) if match else ""
        if current is not None and match and len(current.options) < 5 and option_text:
            current.options.append(clean_text(option_text))
            continue

        if current is None:
            continue

        if current.options:
            current.options[-1] = clean_text(f"{current.options[-1]} {line}")
        else:
            current.stem = clean_text(f"{current.stem} {line}")

    if current is not None:
        questions.append(current)

    apply_source_fixes(questions)
    return questions


def apply_source_fixes(questions: list[Question]) -> None:
    overrides = {
        (SECTION2_NAME, 11): (
            "Nightjars possess a camouflage perhaps unparalleled in the bird world: by day they roost hidden "
            "in shady woods, so _______ with their surroundings that they are nearly impossible to _______."
        ),
        (SECTION2_NAME, 27): (
            "The consumer advocate claimed that while drug manufacturers _______ the supposed advantages of their "
            "proprietary brands, generic versions of the same medications are often equally _______."
        ),
        (SECTION2_NAME, 61): (
            "Neurosurgeon Alexa Canady maintained that choosing a career was a visceral decision rather than "
            "_______ judgment; that is, it was not so much rational as _______."
        ),
        (SECTION2_NAME, 66): (
            "The ambassador argues that, in diplomacy, there is a subtle but important difference between a "
            "country's showing a willingness to _______ and a too-obvious readiness to make _______."
        ),
        (SECTION2_NAME, 68): (
            "Lewis Latimer's inexpensive method of producing carbon filaments "
            "_______ the nascent electric industry by making electric lamps "
            "commercially _______."
        ),
        (SECTION2_NAME, 146): (
            "The award-winning novel is such _______ tale that its very intricacy "
            "has a daunting effect on readers."
        ),
    }
    for question in questions:
        key = (question.section, question.number)
        if key in overrides:
            question.stem = overrides[key]
        question.stem = polish_stem_text(question.stem)


def parse_source_questions(pdf_path: str | Path) -> list[Question]:
    reader = PdfReader(str(pdf_path))
    return (
        parse_pdf_question_range(reader, 1, 25, SECTION1_NAME)
        + parse_pdf_question_range(reader, 25, 49, SECTION2_NAME)
    )


def ocr_page_lines(
    pdf_path: str | Path,
    page_index: int,
    *,
    scale: float = 4.0,
    cache_dir: str | Path = ".ocr_cache",
) -> list[dict]:
    cache_path = Path(cache_dir)
    cache_path.mkdir(exist_ok=True)
    page_cache = cache_path / f"page_{page_index + 1:03d}.json"
    if page_cache.exists():
        return json.loads(page_cache.read_text(encoding="utf-8"))

    pdf = fitz.open(str(pdf_path))
    page = pdf[page_index]
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    image_path = cache_path / f"page_{page_index + 1:03d}.png"
    pix.save(image_path)

    ocr = RapidOCR()
    result, _ = ocr(str(image_path))
    image_path.unlink(missing_ok=True)

    items = []
    for box, text, _score in result:
        ys = [point[1] for point in box]
        xs = [point[0] for point in box]
        items.append(
            {
                "text": clean_text(text),
                "x1": min(xs),
                "x2": max(xs),
                "y": sum(ys) / 4,
                "height": max(ys) - min(ys),
            }
        )
    items.sort(key=lambda item: (item["y"], item["x1"]))

    lines: list[dict] = []
    for item in items:
        if not item["text"]:
            continue
        for line in lines:
            if abs(item["y"] - line["y"]) <= 26:
                line["items"].append(item)
                break
        else:
            lines.append({"y": item["y"], "items": [item]})

    output: list[dict] = []
    for line in lines:
        line["items"].sort(key=lambda item: item["x1"])
        joined = " ".join(item["text"] for item in line["items"])
        if "socrative" in joined.lower():
            continue
        if "名称" in joined or "日期" in joined or "分数" in joined:
            continue
        if re.fullmatch(r"\d+", joined):
            continue

        left = min(item["x1"] for item in line["items"])
        parts: list[str] = []
        if left > 700:
            parts.append("_______")
        previous = None
        for item in line["items"]:
            if previous is not None:
                gap = item["x1"] - previous["x2"]
                if gap > 120:
                    parts.append("_______")
                parts.append(item["text"])
            else:
                parts.append(item["text"])
            previous = item

        text = clean_text(" ".join(parts))
        output.append({"text": text, "x1": left, "y": line["y"]})

    page_cache.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    return output


def normalize_later_option_text(text: str) -> str:
    text = clean_text(text).replace("?", "")
    text = re.sub(r"\s*…+\s*", " . . ", text)
    text = re.sub(r"\s*\.{2,}\s*", " . . ", text)
    text = re.sub(r"\s*\.\s*\.\s*", " . . ", text)
    if " . . . " in text:
        text = text.replace(" . . . ", " . . ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_ocr_question_prefix(text: str) -> str:
    match = re.match(r"^([0-9IOl]{1,2})\.\s*(.*)$", text)
    if not match:
        return text
    raw_number = (
        match.group(1)
        .replace("O", "0")
        .replace("o", "0")
        .replace("I", "1")
        .replace("l", "1")
    )
    if raw_number.isdigit():
        return f"{int(raw_number)}. {match.group(2)}"
    return text


def parse_later_section_from_ocr(pdf_path: str | Path, section_name: str) -> list[Question]:
    page_lines = []
    for page_index in LATER_SECTION_PAGE_RANGES[section_name]:
        page_lines.extend(ocr_page_lines(pdf_path, page_index))

    lines: list[str] = []
    for line in page_lines:
        text = line["text"]
        if text in {section_name.replace(" 分数", ""), "Vocabulary Part 7", "Quiz_Vocabulary Part 7"}:
            continue
        text = normalize_ocr_question_prefix(text)
        lines.append(text)

    blocks: list[list[str]] = []
    current_block: list[str] = []
    for line in lines:
        if re.match(r"^\d{1,2}\.\s*", line):
            if current_block:
                blocks.append(current_block)
            current_block = [line]
        elif current_block:
            current_block.append(line)
    if current_block:
        blocks.append(current_block)

    questions: list[Question] = []
    for block in blocks:
        match = re.match(r"^(\d{1,2})\.\s*(.*)$", block[0])
        if not match:
            continue
        number = int(match.group(1))
        body_lines = [match.group(2)] + block[1:]
        if len(body_lines) < 5:
            continue
        stem_lines = body_lines[:-4]
        option_lines = body_lines[-4:]
        stem = clean_text(" ".join(stem_lines))
        options = [normalize_later_option_text(option) for option in option_lines]
        questions.append(Question(section=section_name, number=number, stem=stem, options=options))

    return questions


def parse_markdown_blocks(markdown_path: str | Path) -> dict[str, list[Question]]:
    text = Path(markdown_path).read_text(encoding="utf-8", errors="replace")
    heading_matches = list(re.finditer(r"^## (.+)$", text, re.M))
    sections: dict[str, list[Question]] = {}

    for index, match in enumerate(heading_matches):
        name = match.group(1)
        if name.startswith("Section "):
            continue
        start = match.end()
        end = heading_matches[index + 1].start() if index + 1 < len(heading_matches) else len(text)
        block = text[start:end]
        question_blocks = re.split(r"(?=^\*\*\d{1,3}\.)", block, flags=re.M)
        questions: list[Question] = []

        for question_block in question_blocks:
            qmatch = re.match(r"^\*\*(\d{1,3})\.", question_block)
            if not qmatch:
                continue
            number = int(qmatch.group(1))
            lines = [clean_text(line) for line in question_block.splitlines() if clean_text(line)]
            stem = re.sub(r"^\*\*\d{1,3}\.\*\*\s*", "", lines[0])
            options = []
            for line in lines[1:]:
                omatch = re.match(r"^-\s*([A-E])\.\s*(.*)$", line)
                if omatch:
                    options.append(clean_text(omatch.group(2)))
            questions.append(Question(section=name, number=number, stem=stem, options=options))

        sections[name] = questions

    return sections


def score_source_match(target: Question, source: Question) -> float:
    same_options = 0
    limit = min(len(target.options), 4, len(source.options))
    for target_opt, source_opt in zip(target.options[:limit], source.options[:limit]):
        if normalize_option(target_opt) == normalize_option(source_opt):
            same_options += 1

    target_words = set(re.findall(r"[a-z0-9']+", target.stem.lower()))
    source_words = set(re.findall(r"[a-z0-9']+", source.stem.lower()))
    overlap = 0.0
    if target_words and source_words:
        overlap = len(target_words & source_words) / len(target_words | source_words)

    return overlap + (same_options / max(limit, 1) if limit else 0.0)


def best_source_match(target: Question, sources: list[Question]) -> Question | None:
    scored = sorted(((score_source_match(target, source), source) for source in sources), reverse=True, key=lambda item: item[0])
    if not scored:
        return None
    best_score, best_question = scored[0]
    return best_question if best_score >= 0.9 else None


def rebuild_later_sections(
    pdf_path: str | Path,
    current_markdown_path: str | Path,
    source_questions: list[Question],
) -> dict[str, list[Question]]:
    rebuilt: dict[str, list[Question]] = {}

    for section_name in LATER_SECTION_PAGE_RANGES:
        ocr_questions = parse_later_section_from_ocr(pdf_path, section_name)
        rebuilt_questions: list[Question] = []

        for question in ocr_questions:
            stem = polish_stem_text(question.stem)
            options = [normalize_later_option_text(option) for option in question.options]

            source_match = best_source_match(question, source_questions)
            if source_match is not None:
                stem = source_match.stem

            if count_blanks(stem) < expected_blank_count(options):
                stem = repair_missing_blanks(stem, options)

            rebuilt_questions.append(
                Question(section=section_name, number=question.number, stem=polish_stem_text(stem), options=options)
            )

        apply_later_overrides(rebuilt_questions)
        rebuilt[section_name] = rebuilt_questions

    return rebuilt


def repair_missing_blanks(stem: str, options: list[str]) -> str:
    stem = normalize_stem_blanks(stem)
    needed = expected_blank_count(options)
    current = count_blanks(stem)
    if current >= needed:
        return stem

    if needed == 1:
        if " too " in stem and "far too for" in stem:
            return stem.replace("far too for", "far too _______ for")
        if " as a for " in stem:
            return stem.replace(" as a for ", " as a _______ for ")
        if " is a its title" in stem:
            return stem.replace(" is a its title", " is a _______ its title")
        if " No the case exists" in stem:
            return stem.replace("No the case exists", "No _______ the case exists")
        if " they were her ring" in stem:
            return stem.replace("they were her ring", "they were _______ her ring")
        return f"{stem} _______".strip()

    # Two-blank heuristics for the OCR-damaged later pages.
    replacements = [
        (" was generally more than ", " was generally more _______ than _______ "),
        (" opted for rather than ", " opted for _______ rather than _______ "),
        (" shuns in describing ", " shuns _______ in describing "),
        (" rational as", " rational as _______"),
        (" scientists require observable data, not ,", "Scientists require observable data, not _______,"),  # pragma: no cover - casing fallback
        (" not , to support", " not _______ to support"),
        (" made him more than illustrious", " made him more _______ than illustrious"),
        (" despite its patent , this belief has become so ", "Despite its patent _______ , this belief has become so _______ "),
        (" tempers his with ", " tempers his _______ with _______ "),
        (" promise to stop aging as , arguing that while these nostrums might possibly ", " promise to stop aging as _______ , arguing that while these nostrums might possibly _______ "),
        (" the novella upon publication was so its modest achievement", " the novella upon publication was so _______ its modest achievement"),
        (" his sometimes incongruous Mexican and American identities by combining ", " his sometimes incongruous Mexican and American identities by combining "),
        (" were declining in Guatemala and Mexico was by new evidence that nearby populations", " were declining in Guatemala and Mexico was _______ by new evidence that nearby populations"),
        (" would lose the election was when her opponent won", " would lose the election was _______ when her opponent won"),
        (" embodied? ", " embodied _______ "),
    ]
    for old, new in replacements:
        if old in stem:
            stem = stem.replace(old, new)
            if count_blanks(stem) >= needed:
                return normalize_stem_blanks(stem)

    if stem.endswith("than") or stem.endswith("as") or stem.endswith("for"):
        stem = f"{stem} _______"
    if count_blanks(stem) < needed:
        stem = re.sub(r"([,:;])", r" _______ \1", stem, count=1)
    if count_blanks(stem) < needed:
        stem = f"{stem} _______"
    return normalize_stem_blanks(stem)


def apply_later_overrides(questions: list[Question]) -> None:
    if not questions:
        return

    section_name = questions[0].section
    overrides: dict[int, tuple[str, list[str]] | str]

    if section_name == "Vocabulary Part 6 分数":
        overrides = {
            1: "The corporation's code of ethics is ludicrous; its principles are either _______ , offering cliches in lieu of guidance, or so unspecific as to make any behavior _______.",
            2: "In winning the MA Booker Prize, novelist Kiran Desai _______ an honor that had _______ her mother, Anita Desai, who was a runner-up three times but never won.",
            3: "In the red Namibian desert of Demarala, about 100 black rhinos still manage to _______ even though the terrain is extraordinarily _______.",
            4: "Ernest Gaines's A Lesson Before Dying is _______ of rural Louisiana: the writing is so evocative that the Southern atmosphere seems almost to _______ from the book's pages.",
            5: "Because insect communities serve as a sort of barometer, _______ conditions in their _______ , an entomologist's analysis of the insect species in a handful of soil can reveal much about the ecosystem.",
            6: "Studying gray whales during the 1970s, marine biologist Mary Lou Jones dubbed one of her subjects \"Amazing Graces,\" for its friendliness was _______ and its movements underwater _______ beyond description.",
            7: "Identifying Luisa Capetillo only with the early labor union movement in Puerto Rico _______ the _______ nature of her career: she also worked in Florida, New York, and Cuba.",
            8: "Place-names can be strikingly _______ : there is, for example, nothing particularly _______ about the town of Peculiar, Missouri.",
            9: (
                "Civil rights activist Fannie Lou Hamer's statement \"I'm sick and tired of being sick and tired\" "
                "was an intentional _______ that illustrated Hamer's _______ about the plight of African Americans "
                "in the 1960s.",
                [
                    "redundancy…frustration",
                    "euphemism…despair",
                    "irony…exultation",
                    "paradox…optimism",
                ],
            ),
            10: "Although she often described reason as the noblest _______ , author Ayn Rand never implied that she rejected _______.",
            11: "While the manager clearly sought to _______ the optimism of the marketing team, she stopped short of pronouncing their plan unfeasible.",
            12: "The shrewd dictator publicized the prosperity of one small village in order to _______ the _______ of the economic hardships that plagued most of his country.",
            13: "The sanitized version of the Madame Curie saga had the dishonest quality of _______ the problems that even she, the great scientist, could not overcome.",
            14: "Director Carlos Avila has been called a master of restraint: his films _______ a tendency toward _______.",
            15: "Dr. Abraham often understated his accomplishments, even at times _______ the way he had achieved his success against overwhelming obstacles.",
        }
    elif section_name == "Quiz_Vocabulary Part 7 分数":
        overrides = {
            3: "No _______ the case exists: in reaching a decision, the court is bound to break new legal ground.",
            4: "The English monarch Elizabeth I may have wanted the miniature portraits of herself and her disgraced mother kept secret, since they were _______ her ring.",
            5: "Biodemographer S.Jay Olshansky regards commercial products that promise to stop aging as _______ , arguing that while these nostrums might possibly _______ some of aging's superficial manifestations, they cannot touch the process at its core.",
            6: "Lina Wertmuller's film Love and Anarchy is a _______ its title, contemplating the two concepts without taking a position on them.",
            7: "While many educators have hailed the new documentary about climate change as a _______ for teachers interested in engaging their students on the issue, such enthusiasm is far from _______.",
            8: "The _______ that met the novella upon publication was so _______ its modest achievement that even the author wondered whether the response was truly deserved.",
            9: "Evan imperiously demanded that he be awarded a much-needed raise or be dismissed, _______ that _______ when he was summarily terminated.",
            10: "Steve tempers his _______ with _______ : despite his intense desire to succeed, he remains sensitive to the feelings of others.",
        }
    elif section_name == "Vocabulary Part 5 分数":
        overrides = {
            6: "The mayor's reelection by an overwhelming majority was not so much an endorsement of his administration's _______ as it was a _______ of his opponent's extreme views.",
            8: "In her poems, Alice Walker retrieves and _______ parts of Black culture that some have been all too quick to _______ to the past as fossilized artifacts.",
            9: "Despite its patent _______ , this belief has become so _______ that no amount of rational argument will suffice to eradicate it.",
            11: (
                "Given the exponential growth of scientific knowledge, medicine is far less _______ "
                "unsubstantiated fads than it used to be; its record of folly, however, remains an undeniable _______."
            ),
            12: "Though usually _______ in her praise, the teacher was _______ in acknowledging Chandra's achievements: she could not say enough positive things.",
            13: "The magazine article discussing the governor's financial dealings contained _______ statements, but it stopped short of being _______.",
            14: (
                "In 1974 the committee overseeing the Pulitzer Prize in Literature was _______ so much _______ "
                "that it bestowed no award at all that year."
            ),
        }
    elif section_name == "Vocabulary Part 4 分数":
        overrides = {
            1: "Although pre-Columbian jewelry often incorporated complex religious symbolism, its function was generally more _______ than _______.",
            4: "Neurosurgeon Alexa Canady maintained that choosing a career was a visceral decision rather than _______ judgment; that is, it was not so much rational as _______.",
            6: "Scientists require observable data, not _______ , to support a hypothesis; sound science is grounded in _______ results rather than speculation.",
            7: "While the movie employs stock characterizations, admirers argue that it is _______ even if its depictions are _______.",
            8: "The actor's reputation as a _______ public figure suffered after an embarrassing personal incident made him more _______ than illustrious.",
            9: "The Supreme Court's reversal of its previous ruling on the issue of states' rights _______ its reputation for _______.",
        }
    elif section_name == "Vocabulary Part 3 分数":
        overrides = {
            4: (
                "The paucity of autobiographical documents left by the royal attendants has compelled historian Raul Salazar "
                "to _______ the motives of these courtiers from their _______ rather than from any diaries or correspondence."
            ),
            7: (
                "Ellen respects Gary's qualities of broad-mindedness and humanism; she cannot, however, _______ them "
                "with his _______ support of a political creed that seems to oppose precisely those qualities."
            ),
        }
    elif section_name == "Vocabulary Part 2 分数":
        overrides = {
            1: (
                "Because Russell was such a memorable and _______ public speaker, many people mistook his ability "
                "to talk about a wide range of topics for genuine _______."
            ),
            2: (
                "Alexis complained that Jim _______ too quickly when their parents imposed a curfew: instead of "
                "negotiating, he complied without protest."
            ),
            9: (
                "The testimony of the witness, meant to _______ the defense of the man accused of theft, actually "
                "strengthened the case of his accusers."
            ),
        }
    elif section_name == "Vocabulary Part 1 分数":
        overrides = {
            2: (
                "The _______ with which merchants and landowners in early-nineteenth-century Maryland and Virginia "
                "_______ Joshua Johnston's professional services attests to his artistic skill as a portrait painter."
            ),
            3: (
                "Conservative historians who represent a traditional account as _______ because of its age may be guilty "
                "of taking on trust what they should have _______ in a conscientious fashion."
            ),
            5: (
                "Rosita Peru, who rose to become the highest-ranking female in the television industry, was _______ "
                "recruited: Spanish language program-producers courted her persistently."
            ),
            7: (
                "A researcher who described a peaceful reunion between normally adversarial chimpanzees as a _______ "
                "was criticized for inferring human motives."
            ),
            10: (
                "Never an _______ , but tending instead to see both sides of an issue, the senator was considered "
                "_______ by those who did not know her well."
            ),
        }
    else:
        overrides = {}

    for question in questions:
        override = overrides.get(question.number)
        if override is None:
            continue
        if isinstance(override, tuple):
            question.stem, question.options = override
        else:
            question.stem = override
        question.stem = polish_stem_text(question.stem)
