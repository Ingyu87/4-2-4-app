import { geminiApiKey, setGeminiApiKey, userNickname, setUserNickname, currentUserJourney, currentArticleData, currentArticleId, setCurrentUserJourney, setCurrentArticleData, setCurrentArticleId } from './config.js';
import { checkSafety } from './api.js';
import { loadStateFromLocal, saveStateToLocal } from './storage.js';
import { showView, showStep, showLoading, hideLoading, showModal, closeModal, showHint, updateNavigationBar } from './ui.js';
import { handleGenerateContent, handlePreReadSubmit, handleDuringReadSubmit, handleAdjustmentSubmit, handlePostReadSubmit, addQuestionField } from './activities.js';
import { buildFeedbackSummaryView as originalBuildFeedbackSummaryView, handleGetAllFeedback, handleEditStep } from './feedback.js';
import { buildReport, downloadReport } from './report.js';

function revealApiKeyInput() {
    const apiKeyInputGroup = document.getElementById("api-key-input-group");
    if (!apiKeyInputGroup) return;
    apiKeyInputGroup.style.display = '';
    apiKeyInputGroup.classList.remove('hidden');
}

function handleSafetyApiError(status) {
    revealApiKeyInput();
    let message = "안전성 검사 시스템 연결에 실패했습니다. 잠시 후 다시 시도해주세요.";
    if (status === "ERROR:API_KEY_EXPIRED") {
        message = "설정된 Gemini API 키가 만료되었습니다. 새 API 키를 입력한 뒤 다시 시도해주세요.";
    } else if (status === "ERROR:API_KEY_INVALID") {
        message = "Gemini API 키가 유효하지 않습니다. API 키를 다시 입력해주세요.";
    } else if (status === "ERROR:MODEL_NOT_FOUND") {
        message = "현재 설정된 AI 모델을 찾을 수 없습니다. 앱에서 자동으로 대체 모델을 시도하도록 수정되었습니다. 새로고침 후 다시 시도해주세요.";
    }
    showModal("API 키 오류", message);
}

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
        
        // 사용자가 입력한 API 키가 있으면 항상 우선 적용 (만료된 환경 키 대체 가능)
        let finalApiKey = geminiApiKey;
        if (apiKeyInput) {
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
        if (typeof safetyResult === "string" && (safetyResult.startsWith("ERROR:") || safetyResult.includes("API 오류") || safetyResult.includes("모델"))) {
            handleSafetyApiError(safetyResult);
            return;
        }
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
    document.getElementById("duringread-add-question").addEventListener("click", addQuestionField);
    document.getElementById("adjustment-submit").addEventListener("click", handleAdjustmentSubmit);
    document.getElementById("postread-submit").addEventListener("click", handlePostReadSubmit);
    document.getElementById("preread-hint").addEventListener("click", () => showHint('pre'));
    document.getElementById("duringread-hint").addEventListener("click", () => showHint('during'));
    document.getElementById("postread-hint").addEventListener("click", () => showHint('post'));

    // 최종 보고서 생성 버튼
    document.getElementById("generate-report-button").addEventListener("click", async () => {
        // 모든 필수 단계 완료 여부 확인
        const journey = currentUserJourney;
        const allRequiredStepsCompleted = 
            journey.steps?.['pre-read']?.note_v1 && 
            journey.steps?.['during-read']?.v1 && 
            journey.steps?.['adjustment']?.choice && 
            (journey.steps?.['post-read-1']?.v1 || journey.steps?.['post-read-2']?.v1 || journey.steps?.['post-read-3']?.v1);
        
        if (!allRequiredStepsCompleted) {
            showModal("알림", "모든 활동(읽기 전, 읽기 중, 읽기 점검, 읽기 후)을 완료한 후에 보고서를 생성할 수 있습니다.");
            return;
        }
        
        showLoading("AI 선생님이 최종 보고서를 작성하는 중입니다...");
        try {
            await buildReport();
            showStep('step-6-report');
            updateNavigationBar('step-6-report');
        } catch (error) {
            console.error("보고서 생성 오류:", error);
            showModal("오류", "최종 평가 보고서를 생성하는 데 실패했습니다.");
        }
        hideLoading();
    });
    

    // 종합 피드백 '모두 받기' 버튼
    document.getElementById("feedback-get-all-button").addEventListener("click", handleGetAllFeedback);

    // 보고서 다운로드 버튼
    document.getElementById("download-report-button").addEventListener("click", downloadReport);
    

    // 보고서에서 '새 활동' 버튼
    document.getElementById("restart-button-report").addEventListener("click", () => {
        localStorage.clear();
        setCurrentUserJourney({});
        setCurrentArticleData(null);
        setCurrentArticleId(null);
        showView("config-view");
    });
    
    // 네비게이션 바 클릭 이벤트
    document.addEventListener('click', (event) => {
        const navStepBtn = event.target.closest('.nav-step-btn');
        if (navStepBtn) {
            const stepId = navStepBtn.dataset.step;
            if (stepId) {
                showStep(stepId);
            }
        }
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

