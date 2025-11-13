import { currentUserJourney, currentArticleData, feedbackQueue, isFeedbackRunning, setFeedbackQueue, setIsFeedbackRunning } from './config.js';
import { getAIFeedback } from './api.js';
import { saveStateToLocal } from './storage.js';
import { saveActivity } from './activities.js';
import { showModal, showLoading, hideLoading } from './ui.js';

// 종합 피드백 화면 UI 빌드
export function buildFeedbackSummaryView() {
    const container = document.getElementById("feedback-summary-container");
    container.innerHTML = "";
    const journey = currentUserJourney;
    const stepsOrder = [
        { key: 'pre-read', title: '1️⃣ 읽기 전 (예상/배경지식)', v1: journey.steps['pre-read']?.note_v1, v2: journey.steps['pre-read']?.note_v2, feedback: journey.steps['pre-read']?.feedback, editStep: 'step-1-preread', stepKey: 'pre-read' },
        { key: 'during-read', title: '2️⃣ 읽기 중 (질문)', v1: journey.steps['during-read']?.v1, v2: journey.steps['during-read']?.v2, feedback: journey.steps['during-read']?.feedback, editStep: 'step-2-duringread', stepKey: 'during-read' },
        { key: 'adjustment', title: '🧑‍🏫 읽기 과정 점검', v1: journey.steps['adjustment']?.solution_v1, v2: journey.steps['adjustment']?.solution_v2, feedback: journey.steps['adjustment']?.feedback, editStep: 'step-3-adjustment', stepKey: 'adjustment', choice: journey.steps['adjustment']?.choice },
        { key: 'post-read-1', title: `3️⃣ 읽기 후 (${journey.steps['post-read-1']?.title || '활동 1'})`, v1: journey.steps['post-read-1']?.v1, v2: journey.steps['post-read-1']?.v2, feedback: journey.steps['post-read-1']?.feedback, editStep: 'step-4-postread', stepKey: 'post-read-1' },
        { key: 'post-read-2', title: `3️⃣ 읽기 후 (${journey.steps['post-read-2']?.title || '활동 2'})`, v1: journey.steps['post-read-2']?.v1, v2: journey.steps['post-read-2']?.v2, feedback: journey.steps['post-read-2']?.feedback, editStep: 'step-4-postread', stepKey: 'post-read-2' },
        { key: 'post-read-3', title: `3️⃣ 읽기 후 (${journey.steps['post-read-3']?.title || '활동 3'})`, v1: journey.steps['post-read-3']?.v1, v2: journey.steps['post-read-3']?.v2, feedback: journey.steps['post-read-3']?.feedback, editStep: 'step-4-postread', stepKey: 'post-read-3' },
    ];

    let html = "";
    stepsOrder.forEach(step => {
        if (step.key === 'adjustment' && step.choice === 'no') {
            html += `
                <div class="bg-white p-5 rounded-2xl shadow-lg mb-6">
                    <div class="flex justify-between items-center mb-2">
                        <h3 class="text-xl font-bold text-gray-800">${step.title}</h3>
                        <button class="btn-edit-step px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-full hover:bg-gray-200 text-sm" data-edit-step="${step.editStep}" data-step-key="${step.stepKey}">수정하기</button>
                    </div>
                    <p class="report-question">"특별히 이해하기 어려운 부분 없음"을 선택했습니다.</p>
                </div>
            `;
        } else if (step.v1) {
            const v1_text = step.v1.replace(/\n/g, '<br>');
            const v2_html = step.v2 ? `<div class="report-revision"><b>수정한 내용 (v2):</b> ${step.v2.replace(/\n/g, '<br>')}</div>` : '';
            
            // 피드백을 파싱하여 구조화된 형식으로 표시
            let feedback_html = '';
            if (step.feedback) {
                const feedbackText = step.feedback.replace(/\n/g, '<br>');
                // **활동 분석:**와 **개선 제안:** 형식만 강조 표시 (평가 섹션 제거)
                const formattedFeedback = feedbackText
                    .replace(/\*\*평가:\*\*/g, '') // 평가 섹션 제거
                    .replace(/\*\*활동 분석:\*\*/g, '<div class="font-bold text-base mt-4 mb-2 text-purple-700">🔍 활동 분석:</div>')
                    .replace(/\*\*개선 제안:\*\*/g, '<div class="font-bold text-base mt-4 mb-2 text-green-700">💡 개선 제안:</div>')
                    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                
                feedback_html = `<div class="report-feedback">${formattedFeedback}</div>`;
            } else {
                feedback_html = `<div id="feedback-placeholder-${step.key}" class="text-gray-500 text-sm italic py-4">피드백을 기다리는 중...</div>`;
            }

            html += `
                <div class="bg-white p-6 rounded-2xl shadow-lg mb-6 border-2 border-gray-100">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-bold text-gray-800">${step.title}</h3>
                        <button class="btn-edit-step px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-full hover:bg-gray-200 text-sm" data-edit-step="${step.editStep}" data-step-key="${step.stepKey}">수정하기</button>
                    </div>
                    <div class="report-question mb-4">
                        <div class="font-semibold text-gray-700 mb-2">내가 작성한 내용 (v1):</div>
                        <div class="text-gray-800">${v1_text}</div>
                    </div>
                    ${v2_html}
                    ${feedback_html}
                </div>
            `;
        }
    });
    container.innerHTML = html;

    // 보고서 버튼 상태 업데이트 (피드백 요약 화면이 표시될 때)
    const reportBtn = document.getElementById("generate-report-button");
    if (reportBtn) {
        const allRequiredStepsCompleted = 
            journey.steps?.['pre-read']?.note_v1 && 
            journey.steps?.['during-read']?.v1 && 
            journey.steps?.['adjustment']?.choice && 
            (journey.steps?.['post-read-1']?.v1 || journey.steps?.['post-read-2']?.v1 || journey.steps?.['post-read-3']?.v1);
        
        if (allRequiredStepsCompleted) {
            reportBtn.disabled = false;
            reportBtn.classList.remove("opacity-50", "cursor-not-allowed");
        } else {
            reportBtn.disabled = true;
            reportBtn.classList.add("opacity-50", "cursor-not-allowed");
        }
    }

    const feedbackBtn = document.getElementById("feedback-get-all-button");
    const needsFeedback = stepsOrder.some(step => step.v1 && !step.feedback && step.choice !== 'no');
    
    // 모든 필수 단계 완료 여부 확인
    const allRequiredStepsCompleted = 
        journey.steps?.['pre-read']?.note_v1 && 
        journey.steps?.['during-read']?.v1 && 
        journey.steps?.['adjustment']?.choice && 
        (journey.steps?.['post-read-1']?.v1 || journey.steps?.['post-read-2']?.v1 || journey.steps?.['post-read-3']?.v1);
    
    if (needsFeedback && allRequiredStepsCompleted) {
        feedbackBtn.classList.remove("hidden");
        feedbackBtn.disabled = false;
        feedbackBtn.innerHTML = "🤖 AI 피드백 한번에 받기";
        feedbackBtn.classList.remove("opacity-50", "cursor-not-allowed");
    } else if (!allRequiredStepsCompleted) {
        feedbackBtn.classList.remove("hidden");
        feedbackBtn.disabled = true;
        feedbackBtn.innerHTML = "⚠️ 모든 활동을 완료한 후 피드백을 받을 수 있습니다";
        feedbackBtn.classList.add("opacity-50", "cursor-not-allowed");
    } else {
        feedbackBtn.classList.add("hidden");
    }
}

// 모든 피드백 요청 처리
export async function handleGetAllFeedback() {
    const feedbackBtn = document.getElementById("feedback-get-all-button");
    feedbackBtn.disabled = true;
    feedbackBtn.innerHTML = `<div class="spinner !w-6 !h-6 inline-block mr-2"></div> 피드백 생성 중... (1/?)`;

    const newFeedbackQueue = [];
    const journey = currentUserJourney;
    const stepsOrder = [
        { key: 'pre-read', v1: journey.steps['pre-read']?.note_v1, stage: 'pre-read' },
        { key: 'during-read', v1: journey.steps['during-read']?.v1, stage: 'during-read' },
        { key: 'adjustment', v1: journey.steps['adjustment']?.solution_v1, choice: journey.steps['adjustment']?.choice, stage: 'adjustment' },
        { key: 'post-read-1', v1: journey.steps['post-read-1']?.v1, stage: 'post-read-1' },
        { key: 'post-read-2', v1: journey.steps['post-read-2']?.v1, stage: 'post-read-2' },
        { key: 'post-read-3', v1: journey.steps['post-read-3']?.v1, stage: 'post-read-3' },
    ];

    stepsOrder.forEach(step => {
        if (step.v1 && !journey.steps[step.key].feedback && step.choice !== 'no') {
            newFeedbackQueue.push(step);
        }
    });

    setFeedbackQueue(newFeedbackQueue);

    if (newFeedbackQueue.length === 0) {
        feedbackBtn.classList.add("hidden");
        return;
    }

    setIsFeedbackRunning(true);
    let totalJobs = newFeedbackQueue.length;
    let jobsDone = 0;

    for (const job of newFeedbackQueue) {
        jobsDone++;
        feedbackBtn.innerHTML = `<div class="spinner !w-6 !h-6 inline-block mr-2"></div> 피드백 생성 중... (${jobsDone}/${totalJobs})`;
        
        try {
            const feedback = await getAIFeedback(job.v1, job.stage, currentArticleData.type);
            
            currentUserJourney.steps[job.key].feedback = feedback;
            
            // 피드백이 업데이트되면 buildFeedbackSummaryView를 호출하여 전체 화면을 다시 렌더링
            // placeholder는 buildFeedbackSummaryView에서 처리됨

        } catch (error) {
            console.error("AI 피드백 오류:", job.key, error);
            const placeholder = document.getElementById(`feedback-placeholder-${job.key}`);
            if (placeholder) {
                placeholder.innerHTML = `<span class="text-red-500">피드백 생성에 실패했습니다.</span>`;
            }
        }
    }

    setIsFeedbackRunning(false);
    saveStateToLocal('step-7-feedback-summary');
    
    // 피드백 요약 화면 다시 빌드하여 결과 표시
    buildFeedbackSummaryView();
    
    // 버튼 상태 업데이트
    const needsFeedback = newFeedbackQueue.some(step => {
        const stepData = currentUserJourney.steps[step.key];
        return stepData?.v1 && !stepData?.feedback && stepData?.choice !== 'no';
    });
    if (!needsFeedback) {
        feedbackBtn.classList.add("hidden");
    } else {
        feedbackBtn.disabled = false;
        feedbackBtn.innerHTML = "🤖 AI 피드백 한번에 받기";
    }
}

// 수정 버튼 핸들러 (모달 방식)
export function handleEditStep(stepId, stepKey) {
    console.log("수정 시작:", stepId, stepKey);
    
    const journey = currentUserJourney;
    const article = currentArticleData;
    let modalTitle = "";
    let modalBody = "";
    
    if (stepKey === 'pre-read') {
        modalTitle = "1️⃣ 읽기 전 수정";
        const currentValue = journey.steps['pre-read']?.note_v2 || journey.steps['pre-read']?.note_v1 || '';
        const label = article.type === '설명하는 글' 
            ? "글의 제목을 보고 어떤 내용일지 예상해보고, 주제에 대해 알고 있는 것을 자유롭게 적어보세요."
            : "제목을 보고 글쓴이의 의견을 예상해보고, 주제에 대해 알고 있는 경험을 자유롭게 적어보세요.";
        const placeholder = article.type === '설명하는 글'
            ? "예) 제목을 보니 우주에 대한 이야기일 것 같다. 나는 우주에 대해 ...을 알고 있다."
            : "예) 아마 글쓴이는 ...라고 주장할 것 같다. 이 주제에 대해 나도 ...한 경험이 있다.";
        
        modalBody = `
            <div class="mb-4">
                <button class="btn-view-article-in-edit w-full px-4 py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg hover:bg-blue-200 transition-all duration-200 text-sm">
                    📖 글 다시 보기
                </button>
            </div>
            <label class="block text-lg font-semibold text-gray-800 mb-2">${label}</label>
            <textarea id="edit-preread-question" rows="5" class="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 focus:border-transparent text-base" placeholder="${placeholder}">${currentValue}</textarea>
        `;
    } else if (stepKey === 'during-read') {
        modalTitle = "2️⃣ 읽기 중 수정";
        const currentValue = journey.steps['during-read']?.v2 || journey.steps['during-read']?.v1 || '';
        const label = article.type === '설명하는 글'
            ? "글을 읽으며 중심 내용이나 새롭게 알게 된 사실에 대해 질문을 만들어 보세요."
            : "글을 읽으며 글쓴이의 의견이나 그 이유가 적절한지 질문을 만들어 보세요.";
        const placeholder = article.type === '설명하는 글'
            ? "예) 이 문단에서 가장 중요한 내용은 무엇일까? / ...은 왜 ...일까?"
            : "예) 글쓴이의 주장은 ...인데, 그 이유는 타당할까? / 나라면 ...라고 주장하겠다.";
        
        const articleBody = article.body ? article.body.split('\n\n').map(p => `<p>${p}</p>`).join('') : '';
        
        modalBody = `
            <div class="mb-4">
                <button id="toggle-article-in-edit" class="w-full px-4 py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg hover:bg-blue-200 transition-all duration-200 text-sm flex items-center justify-center">
                    <span>📖 글 보기</span>
                    <span class="ml-2">▼</span>
                </button>
                <div id="article-content-in-edit" class="hidden mt-3 bg-gray-50 p-4 rounded-xl max-h-60 overflow-y-auto prose max-w-none text-sm">
                    <h3 class="text-lg font-bold mb-2">${article.title}</h3>
                    ${articleBody}
                </div>
            </div>
            <label class="block text-lg font-semibold text-gray-800 mb-2">${label}</label>
            <textarea id="edit-duringread-question" rows="5" class="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 focus:border-transparent text-base" placeholder="${placeholder}">${currentValue}</textarea>
        `;
    } else if (stepKey === 'adjustment') {
        modalTitle = "🧑‍🏫 읽기 과정 점검 수정";
        const currentChoice = journey.steps['adjustment']?.choice || 'no';
        const currentSolution = journey.steps['adjustment']?.solution_v2 || journey.steps['adjustment']?.solution_v1 || '';
        
        modalBody = `
            <div class="mb-4">
                <button class="btn-view-article-in-edit w-full px-4 py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg hover:bg-blue-200 transition-all duration-200 text-sm">
                    📖 글 다시 보기
                </button>
            </div>
            <p class="text-lg font-semibold text-gray-800 mb-3">글을 읽다가 내용이 이해되지 않거나<br>막히는 부분이 있었나요?</p>
            <div class="flex space-x-4 mb-4">
                <label class="flex items-center p-4 rounded-xl border-2 ${currentChoice === 'no' ? 'border-amber-400' : 'border-gray-200'} flex-1 hover:border-amber-400 transition">
                    <input type="radio" name="edit-adjustment-choice" value="no" class="h-5 w-5 text-amber-600" ${currentChoice === 'no' ? 'checked' : ''}>
                    <span class="ml-3 text-lg">아니요, 없었어요.</span>
                </label>
                <label class="flex items-center p-4 rounded-xl border-2 ${currentChoice === 'yes' ? 'border-amber-400' : 'border-gray-200'} flex-1 hover:border-amber-400 transition">
                    <input type="radio" name="edit-adjustment-choice" value="yes" class="h-5 w-5 text-amber-600" ${currentChoice === 'yes' ? 'checked' : ''}>
                    <span class="ml-3 text-lg">네, 있었어요.</span>
                </label>
            </div>
            <div id="edit-adjustment-solution-group" class="${currentChoice === 'yes' ? '' : 'hidden'}">
                <label for="edit-adjustment-solution" class="block text-lg font-semibold text-gray-800 mb-2">어떻게 해결했는지 알려주세요!</label>
                <textarea id="edit-adjustment-solution" rows="5" class="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 focus:border-transparent text-base" placeholder="예) 낱말의 뜻을 짐작해 보았어요. / 앞 문장을 다시 천천히 읽어보았어요.">${currentSolution}</textarea>
            </div>
        `;
    } else if (stepKey.startsWith('post-read-')) {
        const postReadNum = stepKey.split('-')[2];
        const stepData = journey.steps[stepKey];
        const currentValue = stepData?.v2 || stepData?.v1 || '';
        const title = stepData?.title || `활동 ${postReadNum}`;
        
        modalTitle = `3️⃣ 읽기 후 수정 (${title})`;
        
        let label = "";
        let placeholder = "";
        if (postReadNum === '1') {
            label = article.type === '설명하는 글'
                ? "글 전체의 내용을 요약하여 정리해보세요."
                : "주제에 대한 글쓴이의 의견과 자신의 의견을 비교하고 정리해보세요.";
            placeholder = article.type === '설명하는 글'
                ? "예) 이 글은 ...에 대해 설명하는 글이다. ...은 ...이고 ... 특징이 있다."
                : "예) 글쓴이는 ...라고 주장했는데, 내 생각도 ...점은 같다. 하지만 ...점은 다르다.";
        } else if (postReadNum === '2') {
            label = article.type === '설명하는 글'
                ? "글을 읽고 더 알고 싶은 내용을 질문으로 만들어보세요."
                : "글을 읽으면서 생각이 바뀌거나 발전한 부분이 있었는지 확인해보세요.";
            placeholder = article.type === '설명하는 글'
                ? "예) ...은 왜 ...일까? ...에 대해 더 찾아보고 싶다."
                : "예) 전에는 ...라고 생각했는데, 이 글을 읽고 ...라고 생각이 바뀌었다.";
        } else if (postReadNum === '3') {
            label = "주제에 대한 자신의 생각을 다시 떠올려 적어보세요.";
            placeholder = "예) 나는 이 주제에 대해 ...라고 생각한다.";
        }
        
        modalBody = `
            <div class="mb-4">
                <button class="btn-view-article-in-edit w-full px-4 py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg hover:bg-blue-200 transition-all duration-200 text-sm">
                    📖 글 다시 보기
                </button>
            </div>
            <label class="block text-lg font-semibold text-gray-800 mb-2">${label}</label>
            <textarea id="edit-postread-question-${postReadNum}" rows="5" class="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 focus:border-transparent text-base" placeholder="${placeholder}">${currentValue}</textarea>
        `;
    }
    
    document.getElementById("edit-modal-title").textContent = modalTitle;
    document.getElementById("edit-modal-body").innerHTML = modalBody;
    document.getElementById("edit-modal").classList.remove("hidden");
    
    // 읽기 중 수정 모달에서 글 보기 토글 기능
    if (stepKey === 'during-read') {
        const toggleBtn = document.getElementById("toggle-article-in-edit");
        const articleContent = document.getElementById("article-content-in-edit");
        if (toggleBtn && articleContent) {
            toggleBtn.addEventListener('click', () => {
                const isHidden = articleContent.classList.contains('hidden');
                if (isHidden) {
                    articleContent.classList.remove('hidden');
                    toggleBtn.querySelector('span:last-child').textContent = '▲';
                } else {
                    articleContent.classList.add('hidden');
                    toggleBtn.querySelector('span:last-child').textContent = '▼';
                }
            });
        }
    }
    
    if (stepKey === 'adjustment') {
        const radios = document.querySelectorAll('input[name="edit-adjustment-choice"]');
        const solutionGroup = document.getElementById('edit-adjustment-solution-group');
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                solutionGroup.classList.toggle('hidden', e.target.value === 'no');
            });
        });
    }
    
    const saveBtn = document.getElementById("edit-modal-save");
    const newSaveHandler = async () => {
        await handleEditSave(stepKey);
    };
    saveBtn.replaceWith(saveBtn.cloneNode(true));
    document.getElementById("edit-modal-save").addEventListener('click', newSaveHandler);
    
    const cancelBtn = document.getElementById("edit-modal-cancel");
    const newCancelHandler = () => {
        document.getElementById("edit-modal").classList.add("hidden");
    };
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    document.getElementById("edit-modal-cancel").addEventListener('click', newCancelHandler);
}

// 수정 모달 저장 핸들러
export async function handleEditSave(stepKey) {
    const journey = currentUserJourney;
    let value = "";
    
    if (stepKey === 'pre-read') {
        value = document.getElementById("edit-preread-question").value.trim();
        if (value === "") {
            showModal("알림", "내용을 입력해주세요.");
            return;
        }
    } else if (stepKey === 'during-read') {
        value = document.getElementById("edit-duringread-question").value.trim();
        if (value === "") {
            showModal("알림", "질문을 입력해주세요.");
            return;
        }
    } else if (stepKey === 'adjustment') {
        const choice = document.querySelector('input[name="edit-adjustment-choice"]:checked')?.value;
        if (!choice) {
            showModal("알림", "이해하기 어려운 부분이 있었는지 선택해주세요.");
            return;
        }
        if (choice === 'yes') {
            value = document.getElementById("edit-adjustment-solution").value.trim();
            if (value === "") {
                showModal("알림", "어떻게 해결했는지 간단히 적어주세요.");
                return;
            }
        }
    } else if (stepKey.startsWith('post-read-')) {
        const postReadNum = stepKey.split('-')[2];
        value = document.getElementById(`edit-postread-question-${postReadNum}`).value.trim();
        if (value === "") {
            showModal("알림", "내용을 입력해주세요.");
            return;
        }
    }
    
    showLoading("내용을 검토하고 저장 중입니다...");
    
    if (stepKey === 'pre-read') {
        const safetyResult = await saveActivity("pre-read", value, { isRevision: true });
        hideLoading();
        if (safetyResult !== "SAFE") return;
        journey.steps['pre-read'].note_v2 = value;
    } else if (stepKey === 'during-read') {
        const safetyResult = await saveActivity("during-read", value, { isRevision: true });
        hideLoading();
        if (safetyResult !== "SAFE") return;
        journey.steps['during-read'].v2 = value;
    } else if (stepKey === 'adjustment') {
        const choice = document.querySelector('input[name="edit-adjustment-choice"]:checked').value;
        if (choice === 'yes') {
            const solution = document.getElementById("edit-adjustment-solution").value.trim();
            const adjustmentText = `(해결 방법) ${solution}`;
            const safetyResult = await saveActivity("adjustment", adjustmentText, { isRevision: true, choice: "yes", solution: solution });
            hideLoading();
            if (safetyResult !== "SAFE") return;
            journey.steps['adjustment'].solution_v2 = solution;
            journey.steps['adjustment'].choice = "yes";
        } else {
            const adjustmentText = "특별히 이해하기 어려운 부분 없음.";
            await saveActivity("adjustment", adjustmentText, { isRevision: true, choice: "no" });
            hideLoading();
            journey.steps['adjustment'].choice = "no";
        }
    } else if (stepKey.startsWith('post-read-')) {
        const safetyResult = await saveActivity(stepKey, value, { isRevision: true });
        hideLoading();
        if (safetyResult !== "SAFE") return;
        journey.steps[stepKey].v2 = value;
    }
    
    saveStateToLocal('step-7-feedback-summary');
    buildFeedbackSummaryView();
    
    document.getElementById("edit-modal").classList.add("hidden");
}

