import fs from 'fs';

fs.mkdirSync('dist', { recursive: true });

const filesToCopy = [
  'index.html',
  'main.js',
  'core-generator.js',
  'locales.js',
  'sing-box-template.json.tpl',
  'favicon.ico',
  'en.yml',
  'fa.yml',
  'zh.yml'
];

for (const file of filesToCopy) {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, `dist/${file}`);
  }
}

if (fs.existsSync('img')) {
  fs.cpSync('img', 'dist/img', { recursive: true });
}

console.log('Frontend assets successfully prepared in dist/ directory.');
