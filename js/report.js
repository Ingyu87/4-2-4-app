import { currentArticleId, currentArticleData, currentUserJourney, userNickname } from './config.js';
import { getAIReportEvaluation } from './api.js';
import { showLoading, hideLoading, showModal } from './ui.js';

// 보고서 내용 생성
export async function buildReport() {
    if (!currentArticleId || !currentArticleData) {
        throw new Error("보고서를 생성하려면 글 정보가 필요합니다.");
    }

    const content = document.getElementById("report-content");
    content.innerHTML = `<div class="text-center p-10">
        <div class="spinner !w-10 !h-10 mx-auto"></div>
        <p class="text-lg font-semibold text-amber-700 mt-4">AI 선생님이 최종 보고서를 작성하는 중입니다...</p>
    </div>`;

    const journey = currentUserJourney;

    let evaluationHtml = "";
    try {
        const evaluationText = await getAIReportEvaluation(journey, currentArticleData.type);
        evaluationHtml = `
            <div class="report-section">
                <h2 class="text-2xl font-bold mb-4">🤖 AI 선생님 종합 평가</h2>
                <div class="prose max-w-none bg-blue-50 p-5 rounded-2xl text-base">
                    ${evaluationText}
                </div>
            </div>
        `;
    } catch (error) {
        console.error("AI 평가 생성 실패:", error);
        evaluationHtml = `
            <div class="report-section">
                <h2 class="text-2xl font-bold mb-4">🤖 AI 선생님 종합 평가</h2>
                <p class="text-red-500">AI 종합 평가를 생성하는 데 실패했습니다. 나중에 다시 시도해주세요.</p>
            </div>
        `;
    }

    let html = `
        <h1 class="text-3xl font-bold text-center mb-4">AI 글쓰기 교실 활동 보고서</h1>
        <p class="text-center text-lg text-gray-600 mb-8">학생: ${userNickname}</p>
        
        ${evaluationHtml}

        <div id="report-article-section" class="report-section mt-12">
            <h2 class="text-2xl font-bold mb-4">1. 내가 읽은 글</h2>
            <h3 class="text-xl font-bold mb-2">${journey.articleTitle}</h3>
            <div class="prose max-w-none bg-gray-50 p-5 rounded-2xl text-base">
                ${journey.articleBody.split('\n\n').map(p => `<p>${p}</p>`).join('')}
            </div>
        </div>

        <div id="report-activities-section" class="report-section mt-12">
            <h2 class="text-2xl font-bold mb-6">2. 나의 읽기 활동 과정</h2>
    `;

    const stepsOrder = [
        { key: 'pre-read', title: '1️⃣ 읽기 전 (예상/배경지식)' },
        { key: 'during-read', title: '2️⃣ 읽기 중 (질문)' },
        { key: 'adjustment', title: '🧑‍🏫 읽기 과정 점검' },
        { key: 'post-read-1', title: '3️⃣ 읽기 후 (활동 1)' },
        { key: 'post-read-2', title: '3️⃣ 읽기 후 (활동 2)' },
        { key: 'post-read-3', title: '3️⃣ 읽기 후 (활동 3)' }
    ];

    stepsOrder.forEach(stepInfo => {
        const step = journey.steps[stepInfo.key];
        if (step) {
            html += `<div class="bg-white p-5 rounded-2xl shadow-lg mb-6">`;
            const stepTitle = (step.title) ? `${stepInfo.title}: ${step.title}` : stepInfo.title;
            html += `<h3 class="text-xl font-bold text-gray-800 mb-4">${stepTitle}</h3>`;

            if (stepInfo.key === 'adjustment') {
                if (step.choice === 'no') {
                    html += `<p class="report-question">"특별히 이해하기 어려운 부분 없음"을 선택했습니다.</p>`;
                } else {
                    html += `
                        <div class="overflow-x-auto">
                            <table class="w-full border-collapse border border-gray-300 mb-4">
                                <thead>
                                    <tr class="bg-amber-50">
                                        <th class="border border-gray-300 px-4 py-3 text-left font-bold text-gray-800 w-1/4">구분</th>
                                        <th class="border border-gray-300 px-4 py-3 text-left font-bold text-gray-800">내용</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td class="border border-gray-300 px-4 py-3 bg-gray-50 font-semibold">수정 전 (v1)</td>
                                        <td class="border border-gray-300 px-4 py-3">${step.solution_v1.replace(/\n/g, '<br>')}</td>
                                    </tr>
                                    ${step.feedback ? `
                                    <tr>
                                        <td class="border border-gray-300 px-4 py-3 bg-amber-50 font-semibold">🤖 AI 피드백</td>
                                        <td class="border border-gray-300 px-4 py-3 bg-amber-50">${step.feedback.replace(/\n/g, '<br>')}</td>
                                    </tr>
                                    ` : ''}
                                    ${step.solution_v2 ? `
                                    <tr>
                                        <td class="border border-gray-300 px-4 py-3 bg-green-50 font-semibold">수정 후 (v2)</td>
                                        <td class="border border-gray-300 px-4 py-3 bg-green-50">${step.solution_v2.replace(/\n/g, '<br>')}</td>
                                    </tr>
                                    ` : ''}
                                </tbody>
                            </table>
                        </div>
                    `;
                }
            } else if (stepInfo.key === 'pre-read') {
                html += `
                    <div class="overflow-x-auto">
                        <table class="w-full border-collapse border border-gray-300 mb-4">
                            <thead>
                                <tr class="bg-amber-50">
                                    <th class="border border-gray-300 px-4 py-3 text-left font-bold text-gray-800 w-1/4">구분</th>
                                    <th class="border border-gray-300 px-4 py-3 text-left font-bold text-gray-800">내용</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="border border-gray-300 px-4 py-3 bg-gray-50 font-semibold">수정 전 (v1)</td>
                                    <td class="border border-gray-300 px-4 py-3">${step.note_v1.replace(/\n/g, '<br>')}</td>
                                </tr>
                                ${step.feedback ? `
                                <tr>
                                    <td class="border border-gray-300 px-4 py-3 bg-amber-50 font-semibold">🤖 AI 피드백</td>
                                    <td class="border border-gray-300 px-4 py-3 bg-amber-50">${step.feedback.replace(/\n/g, '<br>')}</td>
                                </tr>
                                ` : ''}
                                ${step.note_v2 ? `
                                <tr>
                                    <td class="border border-gray-300 px-4 py-3 bg-green-50 font-semibold">수정 후 (v2)</td>
                                    <td class="border border-gray-300 px-4 py-3 bg-green-50">${step.note_v2.replace(/\n/g, '<br>')}</td>
                                </tr>
                                ` : ''}
                            </tbody>
                        </table>
                    </div>
                `;
            } else {
                const v1_text = step.v1 || '(작성하지 않음)';
                html += `
                    <div class="overflow-x-auto">
                        <table class="w-full border-collapse border border-gray-300 mb-4">
                            <thead>
                                <tr class="bg-amber-50">
                                    <th class="border border-gray-300 px-4 py-3 text-left font-bold text-gray-800 w-1/4">구분</th>
                                    <th class="border border-gray-300 px-4 py-3 text-left font-bold text-gray-800">내용</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="border border-gray-300 px-4 py-3 bg-gray-50 font-semibold">수정 전 (v1)</td>
                                    <td class="border border-gray-300 px-4 py-3">${v1_text.replace(/\n/g, '<br>')}</td>
                                </tr>
                                ${step.feedback ? `
                                <tr>
                                    <td class="border border-gray-300 px-4 py-3 bg-amber-50 font-semibold">🤖 AI 피드백</td>
                                    <td class="border border-gray-300 px-4 py-3 bg-amber-50">${step.feedback.replace(/\n/g, '<br>')}</td>
                                </tr>
                                ` : ''}
                                ${step.v2 ? `
                                <tr>
                                    <td class="border border-gray-300 px-4 py-3 bg-green-50 font-semibold">수정 후 (v2)</td>
                                    <td class="border border-gray-300 px-4 py-3 bg-green-50">${step.v2.replace(/\n/g, '<br>')}</td>
                                </tr>
                                ` : ''}
                            </tbody>
                        </table>
                    </div>
                `;
            }
            html += `</div>`;
        }
    });

    html += `</div>`;
    content.innerHTML = html;
}

// PNG로 보고서 다운로드 (전체)
export async function downloadReport() {
    const reportElement = document.getElementById("report-content");
    await downloadElementAsPNG(reportElement, `ai_writing_report_${userNickname}.png`, "전체 보고서 이미지 생성 중...");
}

// 글 내용만 PNG로 다운로드
export async function downloadArticlePNG() {
    const articleSection = document.getElementById("report-article-section");
    if (!articleSection) {
        showModal("오류", "글 내용 섹션을 찾을 수 없습니다.");
        return;
    }
    await downloadElementAsPNG(articleSection, `ai_writing_article_${userNickname}.png`, "글 내용 이미지 생성 중...");
}

// 활동 과정만 PNG로 다운로드
export async function downloadActivitiesPNG() {
    const activitiesSection = document.getElementById("report-activities-section");
    if (!activitiesSection) {
        showModal("오류", "활동 과정 섹션을 찾을 수 없습니다.");
        return;
    }
    await downloadElementAsPNG(activitiesSection, `ai_writing_activities_${userNickname}.png`, "활동 과정 이미지 생성 중...");
}

// 공통 PNG 다운로드 함수
async function downloadElementAsPNG(element, filename, loadingMessage) {
    showLoading(loadingMessage + " (조금 오래 걸릴 수 있어요)");
    
    try {
        // 스크롤을 맨 위로 이동
        window.scrollTo(0, 0);
        const activityView = document.getElementById("activity-view");
        if (activityView && activityView.parentElement) {
            activityView.parentElement.scrollTop = 0;
        }
        
        // 요소가 보이도록 스크롤
        element.scrollIntoView({ behavior: 'instant', block: 'start' });
        
        // 렌더링이 완료될 때까지 대기
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 요소의 전체 높이와 너비 계산 (더 정확하게)
        const rect = element.getBoundingClientRect();
        const elementHeight = Math.max(element.scrollHeight, element.offsetHeight, rect.height);
        const elementWidth = Math.max(element.scrollWidth, element.offsetWidth, rect.width);
        
        // 원본 요소의 ID와 클래스를 저장 (onclone에서 사용)
        const elementId = element.id;
        const elementClass = element.className;
        
        // html2canvas로 요소 캡처 (height 제한 제거하여 전체 내용 캡처)
        const canvas = await html2canvas(element, {
            scale: 1.5,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: elementWidth,
            scrollY: 0,
            scrollX: 0,
            allowTaint: false,
            logging: false,
            onclone: (clonedDoc) => {
                // 클론된 문서에서 요소 찾기
                let clonedElement = null;
                if (elementId) {
                    clonedElement = clonedDoc.getElementById(elementId);
                }
                if (!clonedElement && elementClass) {
                    // 클래스로 찾기 시도
                    const classParts = elementClass.split(' ').filter(c => c);
                    if (classParts.length > 0) {
                        const classSelector = '.' + classParts.join('.');
                        clonedElement = clonedDoc.querySelector(classSelector);
                    }
                }
                if (clonedElement) {
                    // 클론된 요소의 스타일 조정하여 전체 내용이 보이도록
                    clonedElement.style.overflow = 'visible';
                    clonedElement.style.height = 'auto';
                    clonedElement.style.maxHeight = 'none';
                    clonedElement.style.overflowY = 'visible';
                    clonedElement.style.overflowX = 'visible';
                    // 부모 요소들도 확인하여 overflow 제한 제거
                    let parent = clonedElement.parentElement;
                    while (parent && parent !== clonedDoc.body) {
                        if (parent.style) {
                            parent.style.overflow = 'visible';
                            parent.style.overflowY = 'visible';
                            parent.style.overflowX = 'visible';
                            parent.style.height = 'auto';
                            parent.style.maxHeight = 'none';
                        }
                        parent = parent.parentElement;
                    }
                }
            }
        });
        
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();

    } catch (err) {
        console.error("PNG download failed", err);
        showModal("오류", "이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
    hideLoading();
}

