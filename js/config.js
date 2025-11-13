// 전역 변수 및 설정
export let userNickname = null;
export let currentArticleId = null;
export let currentArticleData = null;
export let currentUserJourney = {};

export let feedbackQueue = [];
export let isFeedbackRunning = false;

// Gemini API 키 로드 (Gemini Canvas 환경 변수 또는 localStorage)
export let geminiApiKey = typeof __gemini_api_key !== 'undefined' 
    ? __gemini_api_key 
    : (typeof window.__gemini_api_key !== 'undefined' 
        ? window.__gemini_api_key 
        : localStorage.getItem('geminiApiKey') || "");

