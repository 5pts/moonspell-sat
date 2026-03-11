
const fs = require('fs');
try {
    const data = JSON.parse(fs.readFileSync('src/data/questions.json', 'utf8'));
    data.questions.forEach((q, i) => {
        if (!q.options) return;
        q.options.forEach((o, j) => {
            if (!o || typeof o.text !== 'string') {
                console.error(`ERROR: Question ${q.globalId} option ${j} is invalid:`, o);
            }
        });
    });
    console.log('Finished checking options.');
} catch (e) {
    console.error(e);
}
