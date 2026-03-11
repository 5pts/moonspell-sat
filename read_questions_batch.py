
import json
import sys
from pathlib import Path

def main():
    questions_path = Path("src/data/questions.json")
    if not questions_path.exists():
        print("questions.json not found")
        return

    data = json.loads(questions_path.read_text(encoding="utf-8"))
    questions = data.get("questions", [])

    missing_questions = []
    count = 0
    limit = 50  # Process 50 questions at a time
    offset = int(sys.argv[1]) if len(sys.argv) > 1 else 0

    for q in questions:
        explanation = q.get("explanation", "")
        if not explanation or explanation == "暂无详细解析":
            missing_questions.append(q)

    batch = missing_questions[offset:offset+limit]
    
    output = []
    for q in batch:
        output.append({
            "id": q["globalId"],
            "stem": q["stem"],
            "options": [o["text"] for o in q["options"]]
        })
    
    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
