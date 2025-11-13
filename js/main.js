import { geminiApiKey, setGeminiApiKey, userNickname, setUserNickname, currentUserJourney, currentArticleData, currentArticleId } from './config.js';
import { checkSafety } from './api.js';
import { loadStateFromLocal, saveStateToLocal } from './storage.js';
import { showView, showStep, showLoading, hideLoading, showModal, closeModal, showHint } from './ui.js';
import { handleGenerateContent, handlePreReadSubmit, handleDuringReadSubmit, handleAdjustmentSubmit, handlePostReadSubmit } from './activities.js';
import { buildFeedbackSummaryView, handleGetAllFeedback, handleEditStep } from './feedback.js';
import { buildReport, downloadReport, downloadArticlePNG, downloadActivitiesPNG } from './report.js';

// 초기화
function initializeApp() {
    // 환경 변수에서 API 키가 설정되어 있으면 API 키 입력 필드 완전히 숨기기
    const apiKeyInputGroup = document.getElementById("api-key-input")?.parentElement;
    if (geminiApiKey && geminiApiKey.trim() !== "" && geminiApiKey !== '%GEMINI_API_KEY%') {
        if (apiKeyInputGroup) {
            apiKeyInputGroup.style.display = 'none';
            apiKeyInputGroup.classList.add('hidden');
        }
    } else if (!geminiApiKey || geminiApiKey.trim() === "") {
        const savedApiKey = localStorage.getItem('geminiApiKey');
        if (savedApiKey) {
            setGeminiApiKey(savedApiKey);
        }
    }
    
    const savedNickname = localStorage.getItem('userNickname');
    if (savedNickname) {
        setUserNickname(savedNickname);
        loadStateFromLocal();
    } else {
        showView("login-view");
    }
}

function initAdjustmentRadios() {
    const adjustmentRadios = document.querySelectorAll('input[name="adjustment-choice"]');
    const solutionGroup = document.getElementById('adjustment-solution-group');
    if (!adjustmentRadios.length || !solutionGroup) {
        console.warn("Adjustment radios not found yet, will retry on DOM load.");
        return;
    }
    adjustmentRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            solutionGroup.classList.toggle('hidden', e.target.value === 'no');
        });
    });
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 환경 변수에서 API 키 확인 및 입력 필드 숨기기 (DOM 로드 후 즉시 실행)
    const apiKeyInputGroup = document.getElementById("api-key-input")?.parentElement;
    if (geminiApiKey && geminiApiKey.trim() !== "" && geminiApiKey !== '%GEMINI_API_KEY%') {
        if (apiKeyInputGroup) {
            apiKeyInputGroup.style.display = 'none';
            apiKeyInputGroup.classList.add('hidden');
        }
    }
    
    initializeApp();
    initAdjustmentRadios(); 

    // 로그인 버튼
    document.getElementById("login-button").addEventListener("click", async () => {
        const apiKeyInput = document.getElementById("api-key-input").value.trim();
        const nickname = document.getElementById("nickname-input").value;
        
        // 환경 변수에서 API 키가 없을 때만 입력값 사용
        let finalApiKey = geminiApiKey;
        if (apiKeyInput && (!geminiApiKey || geminiApiKey.trim() === "" || geminiApiKey === '%GEMINI_API_KEY%')) {
            finalApiKey = apiKeyInput;
            setGeminiApiKey(apiKeyInput);
            localStorage.setItem('geminiApiKey', apiKeyInput);
        }
        
        // 환경 변수에서도 API 키가 없고, 입력값도 없으면 에러
        if (!finalApiKey || finalApiKey.trim() === "" || finalApiKey === '%GEMINI_API_KEY%') {
            showModal("API 키 필요", "Gemini API 키를 입력해주세요. API 키는 Google AI Studio(https://aistudio.google.com)에서 발급받을 수 있습니다.");
            return;
        }
        
        if (nickname.trim() === "") {
            showModal("알림", "번호를 입력해주세요.");
            return;
        }

        showLoading("번호를 검토 중입니다...");
        const safetyResult = await checkSafety(nickname);
        hideLoading();
        if (safetyResult !== "SAFE") {
            showModal("부적절한 내용", `입력한 번호에 부적절한 단어가 포함되어 있습니다. 수정 후 다시 시도해주세요. (사유: ${safetyResult.replace("UNSAFE: ", "")})`);
            return;
        }

        setUserNickname(nickname);
        localStorage.setItem('userNickname', nickname);
        loadStateFromLocal();
    });
    
    const savedApiKey = localStorage.getItem('geminiApiKey');
    if (savedApiKey && !geminiApiKey) {
        document.getElementById("api-key-input").placeholder = "API 키가 저장되어 있습니다. 변경하려면 새로 입력하세요.";
    }

    document.getElementById("generate-button").addEventListener("click", handleGenerateContent);
    document.getElementById("preread-submit").addEventListener("click", handlePreReadSubmit);
    document.getElementById("duringread-submit").addEventListener("click", handleDuringReadSubmit);
    document.getElementById("adjustment-submit").addEventListener("click", handleAdjustmentSubmit);
    document.getElementById("postread-submit").addEventListener("click", handlePostReadSubmit);
    document.getElementById("preread-hint").addEventListener("click", () => showHint('pre'));
    document.getElementById("duringread-hint").addEventListener("click", () => showHint('during'));
    document.getElementById("postread-hint").addEventListener("click", () => showHint('post'));

    // 최종 보고서 생성 버튼
    document.getElementById("generate-report-button").addEventListener("click", async () => {
        showLoading("AI 선생님이 최종 보고서를 작성하는 중입니다...");
        try {
            await buildReport();
            showStep('step-6-report');
        } catch (error) {
            console.error("보고서 생성 오류:", error);
            showModal("오류", "최종 평가 보고서를 생성하는 데 실패했습니다.");
        }
        hideLoading();
    });

    // 종합 피드백 '모두 받기' 버튼
    document.getElementById("feedback-get-all-button").addEventListener("click", handleGetAllFeedback);

    // 보고서 다운로드 버튼들
    document.getElementById("download-report-button").addEventListener("click", downloadReport);
    document.getElementById("download-article-button").addEventListener("click", downloadArticlePNG);
    document.getElementById("download-activities-button").addEventListener("click", downloadActivitiesPNG);
    

    // 보고서에서 '새 활동' 버튼
    document.getElementById("restart-button-report").addEventListener("click", () => {
        localStorage.clear();
        Object.assign(currentUserJourney, {});
        currentArticleData = null;
        currentArticleId = null;
        showView("config-view");
    });
    
    // 이벤트 위임
    document.addEventListener('click', (event) => {
        const viewArticleButton = event.target.closest('.btn-view-article');
        const viewArticleInEditButton = event.target.closest('.btn-view-article-in-edit');
        
        if (viewArticleButton || viewArticleInEditButton) {
            if (currentArticleData && currentArticleData.body) {
                const articleHtml = currentArticleData.body.split('\n\n').map(p => `<p>${p}</p>`).join('');
                showModal(
                    `📖 ${currentArticleData.title}`, 
                    `<div class="prose max-w-none bg-gray-50 p-4 rounded-lg text-base max-h-60 overflow-y-auto">${articleHtml}</div>`
                );
            } else {
                showModal("오류", "글 내용을 불러올 수 없습니다.");
            }
            return;
        }

        if (event.target.classList.contains('btn-close-modal')) {
            closeModal();
        }
        if (event.target.classList.contains('edit-modal-backdrop')) {
            document.getElementById("edit-modal").classList.add("hidden");
        }
        const editButton = event.target.closest('.btn-edit-step');
        if (editButton) {
            const stepId = editButton.dataset.editStep;
            const stepKey = editButton.dataset.stepKey;
            handleEditStep(stepId, stepKey);
        }
    });
});

