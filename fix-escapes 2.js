const fs = require('fs');
let content = fs.readFileSync('src/lib/email-renderer.ts', 'utf8');
content = content.replace(/\\\`/g, '\`').replace(/\\\$/g, '\$');
fs.writeFileSync('src/lib/email-renderer.ts', content);
