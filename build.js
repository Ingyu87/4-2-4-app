// Vercel 빌드 스크립트: 환경 변수를 HTML에 주입
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// 환경 변수에서 API 키 가져오기
const apiKey = process.env.GEMINI_API_KEY || '';

// HTML의 플레이스홀더를 실제 값으로 교체 (빈 문자열이면 빈 문자열로, 값이 있으면 그대로)
if (apiKey) {
    html = html.replace(/'%GEMINI_API_KEY%'/g, `'${apiKey}'`);
} else {
    html = html.replace(/'%GEMINI_API_KEY%'/g, `''`);
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log(`Environment variables injected into HTML. API Key present: ${!!apiKey}`);

