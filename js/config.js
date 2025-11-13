// 전역 변수 및 설정
export let userNickname = null;
export let currentArticleId = null;
export let currentArticleData = null;
export let currentUserJourney = {};

export let feedbackQueue = [];
export let isFeedbackRunning = false;

// Gemini API 키 로드 (환경 변수 우선순위: Gemini Canvas > Vercel > window > localStorage)
export let geminiApiKey = typeof __gemini_api_key !== 'undefined' 
    ? __gemini_api_key 
    : (typeof window !== 'undefined' && window.__GEMINI_API_KEY__ && window.__GEMINI_API_KEY__ !== '%GEMINI_API_KEY%'
        ? window.__GEMINI_API_KEY__
        : (typeof window !== 'undefined' && window.__gemini_api_key
            ? window.__gemini_api_key
            : (typeof window !== 'undefined' && localStorage.getItem('geminiApiKey') || "")));

