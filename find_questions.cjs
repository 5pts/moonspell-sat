
const fs = require('fs');
const content = fs.readFileSync('src/data/questions.json', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (line.includes('"questions":')) {
        console.log(`Line ${i+1}: ${line.trim()}`);
    }
});
