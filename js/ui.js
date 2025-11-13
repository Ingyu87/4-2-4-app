import { currentArticleData, currentUserJourney } from './config.js';

// 뷰 관리자
export function showView(viewId) {
    const views = document.querySelectorAll(".view");
    views.forEach(view => {
        view.classList.add("hidden");
    });
    const activeView = document.getElementById(viewId);
    if (activeView) {
        activeView.classList.remove("hidden");
    }
}

export function showStep(stepId) {
    const steps = document.querySelectorAll(".step-view");
    steps.forEach(step => {
        step.classList.add("hidden");
    });
    const activeStep = document.getElementById(stepId);
    if (activeStep) {
        activeStep.classList.remove("hidden");
    }
    showView("activity-view");
}

// 모달 및 로딩 관리
export function showLoading(message) {
    document.getElementById("loading-message").textContent = message;
    document.getElementById("loading-view").classList.remove("hidden");
}

export function hideLoading() {
    setTimeout(() => {
        document.getElementById("loading-view").classList.add("hidden");
    }, 500); 
}

export function showModal(title, message) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").innerHTML = message;
    document.querySelector("#modal .btn-close-modal").classList.remove('hidden');
    document.getElementById("modal").classList.remove("hidden");
}

export function closeModal() {
    document.getElementById("modal").classList.add("hidden");
}

// 이어서 할지 묻는 모달
export function showResumeModal(title) {
    return new Promise((resolve) => {
        document.getElementById("modal-title").textContent = "활동 이어하기";
        document.getElementById("modal-body").innerHTML = `
            <p>이전에 진행하던 '[${title}]' 활동이 있습니다.</p>
            <p>이어서 하시겠습니까?</p>
            <div class="flex gap-4 mt-6">
                <button id="resume-no" class="w-full px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-full shadow-lg hover:bg-gray-200">아니요 (삭제)</button>
                <button id="resume-yes" class="w-full px-6 py-3 bg-amber-500 text-white font-semibold rounded-full shadow-lg hover:bg-amber-600">네</button>
            </div>
        `;
        
        document.querySelector("#modal .btn-close-modal").classList.add('hidden');

        const resumeYes = document.getElementById("resume-yes");
        const resumeNo = document.getElementById("resume-no");

        const handleYes = () => {
            cleanup();
            resolve(true);
        };
        const handleNo = () => {
            cleanup();
            resolve(false);
        };
        const cleanup = () => {
            resumeYes.removeEventListener('click', handleYes);
            resumeNo.removeEventListener('click', handleNo);
            closeModal();
            document.querySelector("#modal .btn-close-modal").classList.remove('hidden');
        };

        resumeYes.addEventListener('click', handleYes);
        resumeNo.addEventListener('click', handleNo);

        document.getElementById("modal").classList.remove("hidden");
    });
}

// UI 복원 함수
export function repopulateUiForResume(stepId) {
    const article = currentArticleData;
    const journey = currentUserJourney;

    // 1단계 (읽기 전) UI
    document.getElementById("preread-title").textContent = article.title;
    
    const prereadLabel = document.getElementById("preread-label");
    const prereadQuestion = document.getElementById("preread-question");
    if (article.type === '설명하는 글') {
        prereadLabel.textContent = "글의 제목을 보고 어떤 내용일지 예상해보고, 주제에 대해 알고 있는 것을 자유롭게 적어보세요.";
        prereadQuestion.placeholder = "예) 제목을 보니 우주에 대한 이야기일 것 같다. 나는 우주에 대해 ...을 알고 있다.";
    } else { 
        prereadLabel.textContent = "제목을 보고 글쓴이의 의견을 예상해보고, 주제에 대해 알고 있는 경험을 자유롭게 적어보세요.";
        prereadQuestion.placeholder = "예) 아마 글쓴이는 ...라고 주장할 것 같다. 이 주제에 대해 나도 ...한 경험이 있다.";
    }
    if (journey.steps['pre-read']) {
        prereadQuestion.value = journey.steps['pre-read'].note_v1 || '';
    }

    // 2단계 (읽기 중) UI
    document.getElementById("duringread-title").textContent = article.title;
    document.getElementById("duringread-body").innerHTML = article.body.split('\n\n').map(p => `<p>${p}</p>`).join('');
    const duringReadLabel = document.getElementById("duringread-label");
    const duringReadQuestion = document.getElementById("duringread-question");
    if (article.type === '설명하는 글') {
        duringReadLabel.textContent = "글을 읽으며 중심 내용이나 새롭게 알게 된 사실에 대해 질문을 만들어 보세요.";
        duringReadQuestion.placeholder = "예) 이 문단에서 가장 중요한 내용은 무엇일까? / ...은 왜 ...일까?";
    } else { 
        duringReadLabel.textContent = "글을 읽으며 글쓴이의 의견이나 그 이유가 적절한지 질문을 만들어 보세요.";
        duringReadQuestion.placeholder = "예) 글쓴이의 주장은 ...인데, 그 이유는 타당할까? / 나라면 ...라고 주장하겠다.";
    }
    if (journey.steps['during-read']) {
        duringReadQuestion.value = journey.steps['during-read'].v1 || '';
    }

    // 3단계 (읽기 조정) UI
    if (journey.steps['adjustment']) {
        if (journey.steps['adjustment'].choice === 'yes') {
            document.querySelector('input[name="adjustment-choice"][value="yes"]').checked = true;
            document.getElementById('adjustment-solution-group').classList.remove('hidden');
            document.getElementById("adjustment-solution").value = journey.steps['adjustment'].solution_v1 || '';
        } else {
            document.querySelector('input[name="adjustment-choice"][value="no"]').checked = true;
            document.getElementById('adjustment-solution-group').classList.add('hidden');
        }
    } else { 
         document.querySelector('input[name="adjustment-choice"][value="no"]').checked = true;
         document.getElementById('adjustment-solution-group').classList.add('hidden');
    }
    
    // 4단계 (읽기 후) UI
    const postReadLabel1 = document.getElementById("postread-label-1");
    const postReadQuestion1 = document.getElementById("postread-question-1");
    const postReadLabel2 = document.getElementById("postread-label-2");
    const postReadQuestion2 = document.getElementById("postread-question-2");
    const postReadLabel3 = document.getElementById("postread-label-3");
    const postReadQuestion3 = document.getElementById("postread-question-3");
    const postReadGroup3 = document.getElementById("postread-group-3");

    if (article.type === '설명하는 글') {
        postReadLabel1.textContent = "글 전체의 내용을 요약하여 정리해보세요.";
        postReadQuestion1.placeholder = "예) 이 글은 ...에 대해 설명하는 글이다. ...은 ...이고 ... 특징이 있다.";
        postReadLabel2.textContent = "글을 읽고 더 알고 싶은 내용을 질문으로 만들어보세요.";
        postReadQuestion2.placeholder = "예) ...은 왜 ...일까? ...에 대해 더 찾아보고 싶다.";
        postReadGroup3.classList.add("hidden");
    } else { 
        postReadLabel1.textContent = "주제에 대한 글쓴이의 의견과 자신의 의견을 비교하고 정리해보세요.";
        postReadQuestion1.placeholder = "예) 글쓴이는 ...라고 주장했는데, 내 생각도 ...점은 같다. 하지만 ...점은 다르다.";
        postReadLabel2.textContent = "글을 읽으면서 생각이 바뀌거나 발전한 부분이 있었는지 확인해보세요.";
        postReadQuestion2.placeholder = "예) 전에는 ...라고 생각했는데, 이 글을 읽고 ...라고 생각이 바뀌었다.";
        postReadGroup3.classList.remove("hidden");
        postReadLabel3.textContent = "주제에 대한 자신의 생각을 다시 떠올려 적어보세요.";
        postReadQuestion3.placeholder = "예) 나는 이 주제에 대해 ...라고 생각한다.";
    }
    if (journey.steps['post-read-1']) postReadQuestion1.value = journey.steps['post-read-1'].v1 || '';
    if (journey.steps['post-read-2']) postReadQuestion2.value = journey.steps['post-read-2'].v1 || '';
    if (journey.steps['post-read-3']) postReadQuestion3.value = journey.steps['post-read-3'].v1 || '';
}

// 힌트 표시
export function showHint(stage) {
    const articleType = currentArticleData ? currentArticleData.type : document.getElementById("article-type").value;
    let title = "힌트 💡";
    let message = "";

    if (stage === 'pre') {
        title = "1️⃣ 읽기 전 힌트";
        if (articleType === '설명하는 글') {
            message = `
                <p class="mb-2">제목과 주제를 보고 글의 내용을 예상해 보세요.</p>
                <ul class="list-disc list-inside bg-gray-50 p-3 rounded-lg">
                    <li>이 제목과 비슷한 이야기를 읽어본 적이 있나요?</li>
                    <li>이 글의 주제(${currentArticleData?.title || '...'})에 대해 알고 있는 것은 무엇인가요?</li>
                </ul>
            `;
        } else { 
            message = `
                <p class="mb-2">글쓴이가 어떤 의견을 제시할지 예상해 보세요.</p>
                <ul class="list-disc list-inside bg-gray-50 p-3 rounded-lg">
                    <li>제목을 보니 글쓴이는 어떤 주장을 할 것 같나요?</li>
                    <li>이 주제(${currentArticleData?.title || '...'})에 대해 어떤 경험을 한 적이 있나요?</li>
                    <li>나는 이 주제에 대해 평소 어떻게 생각했나요?</li>
                </ul>
            `;
        }
    } else if (stage === 'during') {
        title = "2️⃣ 읽기 중 힌트";
        if (articleType === '설명하는 글') {
            message = `
                <p class="mb-2">글의 중심 내용과 새롭게 알게 된 사실에 대해 질문해 보세요.</p>
                <ul class="list-disc list-inside bg-gray-50 p-3 rounded-lg">
                    <li>내가 예상한 내용과 글의 내용이 같은가요?</li>
                    <li>각 문단의 중심 내용은 무엇인가요?</li>
                    <li>새롭게 알게 된 사실은 무엇인가요?</li>
                    <li>이 낱말의 뜻은 무엇일까요?</li>
                </ul>
            `;
        } else { 
            message = `
                <p class="mb-2">글쓴이의 의견과 그 이유가 적절한지 질문해 보세요.</p>
                <ul class="list-disc list-inside bg-gray-50 p-3 rounded-lg">
                    <li>글쓴이의 의견(주장)은 무엇인가요?</li>
                    <li>그렇게 주장하는 이유는 무엇인가요?</li>
                    <li>글쓴이의 이유가 타당한가요? (적절한가요?)</li>
                    <li>내 생각과 같거나 다른 점은 무엇인가요?</li>
                </ul>
            `;
        }
    } else if (stage === 'post') {
        title = "3️⃣ 읽기 후 힌트";
        if (articleType === '설명하는 글') {
            message = `
                <p class="mb-2">글의 내용을 정리하고, 더 궁금한 점을 찾아보세요.</p>
                <ul class="list-disc list-inside bg-gray-50 p-3 rounded-lg">
                    <li><b>글 요약하기:</b> 글의 내용을 한 문장으로 요약하면 무엇인가요?</li>
                    <li><b>더 궁금한 점:</b> 이 글을 읽고 더 알고 싶은 점은 무엇인가요?</li>
                </ul>
            `;
        } else { 
            message = `
                <p class="mb-2">글쓴이의 의견과 내 생각을 비교하며 정리해 보세요.</p>
                <ul class="list-disc list-inside bg-gray-50 p-3 rounded-lg">
                    <li><b>의견 비교하기:</b> 글쓴이의 의견과 내 의견은 어떻게 같고 다른가요?</li>
                    <li><b>생각 변화 확인:</b> 글을 읽고 나서 생각이 바뀐 부분이 있나요?</li>
                    <li><b>나의 생각 정리:</b> 이 주제에 대한 나의 최종 의견은 무엇인가요?</li>
                </ul>
            `;
        }
    }
    showModal(title, message);
}

