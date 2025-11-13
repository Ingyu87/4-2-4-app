import { currentArticleId, currentArticleData, currentUserJourney, userNickname, setCurrentArticleId, setCurrentArticleData, setCurrentUserJourney } from './config.js';
import { checkSafety } from './api.js';
import { showModal, showLoading, hideLoading, repopulateUiForResume, showStep, showView } from './ui.js';
import { saveStateToLocal } from './storage.js';
import { buildFeedbackSummaryView } from './feedback.js';
import { generateText } from './api.js';

// 활동 저장 (안전성 검사 포함)
export async function saveActivity(stage, text, details = {}) {
    if (!currentArticleId || !userNickname) {
        showModal("오류", "사용자 정보 또는 글 정보가 없습니다.");
        return "SAFE";
    }

    const safetyResult = await checkSafety(text);
    if (safetyResult !== "SAFE") {
        showModal("부적절한 내용", `작성한 내용에 부적절한 단어가 포함되어 있습니다. 수정 후 다시 시도해주세요. (사유: ${safetyResult.replace("UNSAFE: ", "")})`);
        return safetyResult;
    }

    return "SAFE";
}

// 1단계: 읽기 전
export async function handlePreReadSubmit() {
    const isRevision = !!currentUserJourney.steps['pre-read']; 
    const note = document.getElementById("preread-question").value; 
    if (note.trim() === "") {
        showModal("알림", "내용을 입력해주세요.");
        return;
    }

    showLoading("내용을 검토하고 저장 중입니다...");
    const safetyResult = await saveActivity("pre-read", note, { isRevision });
    hideLoading();
    if (safetyResult !== "SAFE") return;

    if (!isRevision) {
        currentUserJourney.steps['pre-read'] = { note_v1: note, feedback: null, note_v2: null };
    } else {
        currentUserJourney.steps['pre-read'].note_v2 = note;
    }
    
    repopulateUiForResume('step-2-duringread');
    saveStateToLocal('step-2-duringread'); 
    
    showStep(isRevision ? 'step-7-feedback-summary' : 'step-2-duringread');
    if (isRevision) buildFeedbackSummaryView(); 
}

// 질문 추가 함수
let questionCounter = 0;
export function addQuestionField() {
    const container = document.getElementById("duringread-questions-container");
    const questionId = `question-${questionCounter++}`;
    
    const questionTypes = currentArticleData.type === '설명하는 글'
        ? [
            { value: 'center', label: '중심 내용 찾기' },
            { value: 'new', label: '새롭게 알게 된 사실' },
            { value: 'detail', label: '세부 내용 파악' },
            { value: 'why', label: '이유/원인 찾기' },
            { value: 'other', label: '기타' }
        ]
        : [
            { value: 'opinion', label: '글쓴이의 의견' },
            { value: 'reason', label: '이유의 타당성' },
            { value: 'compare', label: '자신의 생각과 비교' },
            { value: 'critique', label: '비판적 사고' },
            { value: 'other', label: '기타' }
        ];
    
    const questionHtml = `
        <div class="question-item bg-gray-50 p-4 rounded-xl border-2 border-gray-200" data-question-id="${questionId}">
            <div class="flex justify-between items-center mb-2">
                <label class="text-sm font-semibold text-gray-700">질문 종류</label>
                <button class="remove-question text-red-500 hover:text-red-700 text-sm font-semibold" data-question-id="${questionId}">삭제</button>
            </div>
            <select class="question-type w-full px-3 py-2 bg-white border border-gray-300 rounded-lg mb-3 text-sm" data-question-id="${questionId}">
                ${questionTypes.map(type => `<option value="${type.value}">${type.label}</option>`).join('')}
            </select>
            <label class="block text-sm font-semibold text-gray-700 mb-1">질문</label>
            <textarea class="question-text w-full px-3 py-2 bg-white border border-gray-300 rounded-lg mb-3 text-sm" rows="2" placeholder="질문을 입력하세요"></textarea>
            <label class="block text-sm font-semibold text-gray-700 mb-1">답</label>
            <textarea class="question-answer w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" rows="3" placeholder="질문에 대한 답을 입력하세요"></textarea>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', questionHtml);
    
    // 삭제 버튼 이벤트
    const removeBtn = container.querySelector(`.remove-question[data-question-id="${questionId}"]`);
    removeBtn.addEventListener('click', () => {
        const item = container.querySelector(`.question-item[data-question-id="${questionId}"]`);
        if (item) item.remove();
    });
}

// 2단계: 읽기 중
export async function handleDuringReadSubmit() {
    const isRevision = !!currentUserJourney.steps['during-read'];
    const container = document.getElementById("duringread-questions-container");
    const questionItems = container.querySelectorAll('.question-item');
    
    if (questionItems.length === 0) {
        showModal("알림", "최소 하나의 질문을 추가해주세요.");
        return;
    }
    
    const questions = [];
    let allValid = true;
    
    for (const item of questionItems) {
        const questionId = item.dataset.questionId;
        const type = item.querySelector(`.question-type[data-question-id="${questionId}"]`).value;
        const question = item.querySelector(`.question-text[data-question-id="${questionId}"]`).value.trim();
        const answer = item.querySelector(`.question-answer[data-question-id="${questionId}"]`).value.trim();
        
        if (question === "") {
            showModal("알림", "모든 질문을 입력해주세요.");
            allValid = false;
            break;
        }
        
        questions.push({ type, question, answer });
    }
    
    if (!allValid) return;
    
    // 질문들을 하나의 텍스트로 합치기 (기존 호환성 유지)
    const questionText = questions.map((q, idx) => {
        const typeLabel = currentArticleData.type === '설명하는 글'
            ? { center: '중심 내용', new: '새로운 사실', detail: '세부 내용', why: '이유/원인', other: '기타' }[q.type] || '기타'
            : { opinion: '글쓴이 의견', reason: '이유 타당성', compare: '생각 비교', critique: '비판적 사고', other: '기타' }[q.type] || '기타';
        return `[${typeLabel}] ${q.question}${q.answer ? `\n답: ${q.answer}` : ''}`;
    }).join('\n\n');
    
    showLoading("내용을 검토하고 저장 중입니다...");
    const safetyResult = await saveActivity("during-read", questionText, { isRevision });
    hideLoading();
    if (safetyResult !== "SAFE") return;

    if (!isRevision) {
        currentUserJourney.steps['during-read'] = { 
            v1: questionText, 
            feedback: null, 
            v2: null,
            questions: questions // 질문 배열도 저장
        };
    } else {
        currentUserJourney.steps['during-read'].v2 = questionText;
        currentUserJourney.steps['during-read'].questions = questions;
    }

    repopulateUiForResume('step-3-adjustment');
    saveStateToLocal('step-3-adjustment');
    
    showStep(isRevision ? 'step-7-feedback-summary' : 'step-3-adjustment');
    if (isRevision) buildFeedbackSummaryView();
}

// 3단계: 읽기 조정
export async function handleAdjustmentSubmit() {
    const isRevision = !!currentUserJourney.steps['adjustment'];
    const adjustmentChoice = document.querySelector('input[name="adjustment-choice"]:checked');
    let adjustmentText = "";
    let details = { isRevision };

    if (!adjustmentChoice) {
        showModal("알림", "이해하기 어려운 부분이 있었는지 선택해주세요.");
        return;
    }

    showLoading("내용을 검토하고 저장 중입니다...");

    if (adjustmentChoice.value === "yes") {
        const solution = document.getElementById("adjustment-solution").value;
        if (solution.trim() === "") {
            hideLoading();
            showModal("알림", "어떻게 해결했는지 간단히 적어주세요.");
            return;
        }
        adjustmentText = `(해결 방법) ${solution}`;
        details = { ...details, choice: "yes", solution: solution };
        
        const safetyResult = await saveActivity("adjustment", adjustmentText, details);
        hideLoading();
        if (safetyResult !== "SAFE") return;
        
        if (!isRevision) {
            currentUserJourney.steps['adjustment'] = { choice: "yes", solution_v1: solution, feedback: null, solution_v2: null };
        } else {
            currentUserJourney.steps['adjustment'].solution_v2 = solution;
            currentUserJourney.steps['adjustment'].choice = "yes";
        }

    } else {
        adjustmentText = "특별히 이해하기 어려운 부분 없음.";
        details = { ...details, choice: "no" };
        
        await saveActivity("adjustment", adjustmentText, details);
        hideLoading();

        if (!isRevision) {
            currentUserJourney.steps['adjustment'] = { choice: "no" };
        } else {
            currentUserJourney.steps['adjustment'].choice = "no";
        }
    }
    
    repopulateUiForResume('step-4-postread');
    saveStateToLocal('step-4-postread');
    
    showStep(isRevision ? 'step-7-feedback-summary' : 'step-4-postread');
    if (isRevision) buildFeedbackSummaryView();
}

// 4단계: 읽기 후
export async function handlePostReadSubmit() {
    const isRevision = !!currentUserJourney.steps['post-read-1'] || !!currentUserJourney.steps['post-read-2'] || !!currentUserJourney.steps['post-read-3'];
    const q1 = document.getElementById("postread-question-1").value;
    const q2 = document.getElementById("postread-question-2").value;
    const q3 = document.getElementById("postread-question-3").value;
    
    if (currentArticleData.type === '설명하는 글') {
        if (q1.trim() === "" && q2.trim() === "") {
            showModal("알림", "활동 내용을 하나 이상 입력해주세요."); return;
        }
    } else { 
        if (q1.trim() === "" && q2.trim() === "" && q3.trim() === "") {
            showModal("알림", "활동 내용을 하나 이상 입력해주세요."); return;
        }
    }

    showLoading("내용을 검토하고 저장 중입니다...");
    const promises = [];
    const details = { isRevision };
    
    // 안전성 검사
    const q1_safety = (q1.trim() !== "") ? await checkSafety(q1) : "SAFE";
    const q2_safety = (q2.trim() !== "") ? await checkSafety(q2) : "SAFE";
    const q3_safety = (q3.trim() !== "" && currentArticleData.type !== '설명하는 글') ? await checkSafety(q3) : "SAFE";
    
    if (q1_safety !== "SAFE" || q2_safety !== "SAFE" || q3_safety !== "SAFE") {
        hideLoading();
        const errorMsg = [q1_safety, q2_safety, q3_safety].filter(s => s !== "SAFE").join(", ");
        showModal("부적절한 내용", `작성한 내용에 부적절한 단어가 포함되어 있습니다. 수정 후 다시 시도해주세요. (사유: ${errorMsg.replace("UNSAFE: ", "")})`);
        return;
    }

    // 저장 로직
    if (currentArticleData.type === '설명하는 글') {
        if (q1.trim() !== "") {
            if (!isRevision) {
                promises.push(saveActivity("post-read", q1, { ...details, sub_stage: "summary", title: "글 요약하기" }));
                currentUserJourney.steps['post-read-1'] = { title: "글 요약하기", v1: q1, feedback: null, v2: null };
            } else {
                currentUserJourney.steps['post-read-1'] = { ...(currentUserJourney.steps['post-read-1'] || {}), v2: q1, title: "글 요약하기" };
            }
        }
        if (q2.trim() !== "") {
            if (!isRevision) {
                promises.push(saveActivity("post-read", q2, { ...details, sub_stage: "curiosity", title: "더 궁금한 점" }));
                currentUserJourney.steps['post-read-2'] = { title: "더 궁금한 점", v1: q2, feedback: null, v2: null };
            } else {
                 currentUserJourney.steps['post-read-2'] = { ...(currentUserJourney.steps['post-read-2'] || {}), v2: q2, title: "더 궁금한 점" };
            }
        }
    } else { 
        if (q1.trim() !== "") {
            if (!isRevision) {
                promises.push(saveActivity("post-read", q1, { ...details, sub_stage: "comparison", title: "글쓴이와 내 의견 비교하기" }));
                currentUserJourney.steps['post-read-1'] = { title: "글쓴이와 내 의견 비교하기", v1: q1, feedback: null, v2: null };
            } else {
                currentUserJourney.steps['post-read-1'] = { ...(currentUserJourney.steps['post-read-1'] || {}), v2: q1, title: "글쓴이와 내 의견 비교하기" };
            }
        }
        if (q2.trim() !== "") {
            if (!isRevision) {
                promises.push(saveActivity("post-read", q2, { ...details, sub_stage: "reflection", title: "생각의 변화/발전" }));
                currentUserJourney.steps['post-read-2'] = { title: "생각의 변화/발전", v1: q2, feedback: null, v2: null };
            } else {
                 currentUserJourney.steps['post-read-2'] = { ...(currentUserJourney.steps['post-read-2'] || {}), v2: q2, title: "생각의 변화/발전" };
            }
        }
        if (q3.trim() !== "") {
            if (!isRevision) {
                promises.push(saveActivity("post-read", q3, { ...details, sub_stage: "opinion", title: "주제에 대한 나의 생각" }));
                currentUserJourney.steps['post-read-3'] = { title: "주제에 대한 나의 생각", v1: q3, feedback: null, v2: null };
            } else {
                currentUserJourney.steps['post-read-3'] = { ...(currentUserJourney.steps['post-read-3'] || {}), v2: q3, title: "주제에 대한 나의 생각" };
            }
        }
    }

    if (!isRevision) {
        await Promise.all(promises);
    }
    
    hideLoading();
    repopulateUiForResume('step-7-feedback-summary'); 
    saveStateToLocal('step-7-feedback-summary'); 
    buildFeedbackSummaryView(); 
    showStep('step-7-feedback-summary');
}

// 글 생성 핸들러
export async function handleGenerateContent() {
    localStorage.clear();

    const type = document.getElementById("article-type").value;
    const difficulty = document.getElementById("article-difficulty").value;
    const topic = document.getElementById("article-topic").value; 

    // 주제 안전성 검사
    if (topic.trim() !== "") {
        showLoading("주제를 검토 중입니다...");
        const safetyResult = await checkSafety(topic);
        if (safetyResult !== "SAFE") {
            hideLoading();
            showModal("부적절한 주제", `입력한 주제에 부적절한 단어가 포함되어 있습니다. 수정 후 다시 시도해주세요. (사유: ${safetyResult.replace("UNSAFE: ", "")})`);
            return;
        }
    }

    showLoading("AI가 글을 만들고 있어요...");

    try {
        const textData = await generateText(type, topic);

        // 랜덤 ID 생성
        const newArticleId = 'article_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        setCurrentArticleId(newArticleId);

        setCurrentArticleData({ 
            ...textData, 
            type, 
            difficulty, 
            id: newArticleId 
        });

        setCurrentUserJourney({
            articleTitle: textData.title,
            articleBody: textData.body,
            articleType: type,
            steps: {} 
        });

        repopulateUiForResume('step-1-preread');
        saveStateToLocal('step-1-preread');

        hideLoading();
        showStep("step-1-preread");

    } catch (error) {
        console.error("콘텐츠 생성 오류:", error);
        hideLoading();
        showModal("AI 생성 오류", "콘텐츠를 만드는 데 실패했습니다. 다시 시도해주세요.");
        showView("config-view");
    }
}

