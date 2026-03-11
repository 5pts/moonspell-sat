
import json
import sys
from pathlib import Path

def main():
    questions_path = Path("src/data/questions.json")
    
    batch_filename = sys.argv[1] if len(sys.argv) > 1 else "batch1_explanations.json"
    batch_path = Path(batch_filename)
    
    if not questions_path.exists():
        print("questions.json not found")
        return
    if not batch_path.exists():
        print(f"{batch_filename} not found")
        return

    questions_data = json.loads(questions_path.read_text(encoding="utf-8"))
    batch_data = json.loads(batch_path.read_text(encoding="utf-8"))
    
    # Create a lookup for batch data
    batch_lookup = {item["id"]: item for item in batch_data}
    
    updated_count = 0
    
    for q in questions_data["questions"]:
        if q["globalId"] in batch_lookup:
            update = batch_lookup[q["globalId"]]
            q["explanation"] = update["explanation"]
            q["answer"] = update["answer"]
            updated_count += 1
            
    questions_path.write_text(json.dumps(questions_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Updated {updated_count} questions from {batch_filename}.")

if __name__ == "__main__":
    main()
