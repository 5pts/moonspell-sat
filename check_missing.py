
import json
from pathlib import Path

def main():
    questions_path = Path("src/data/questions.json")
    if not questions_path.exists():
        print("questions.json not found")
        return

    data = json.loads(questions_path.read_text(encoding="utf-8"))
    questions = data.get("questions", [])

    missing_explanation_count = 0
    missing_ids = []

    for q in questions:
        # Check if explanation is missing or is the default placeholder
        explanation = q.get("explanation", "")
        if not explanation or explanation == "暂无详细解析":
            missing_explanation_count += 1
            missing_ids.append(q["globalId"])

    print(f"Total questions: {len(questions)}")
    print(f"Missing explanations: {missing_explanation_count}")
    print(f"First 10 missing IDs: {missing_ids[:10]}")

if __name__ == "__main__":
    main()
