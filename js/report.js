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

        <div class="report-section mt-12">
            <h2 class="text-2xl font-bold mb-4">1. 내가 읽은 글</h2>
            <h3 class="text-xl font-bold mb-2">${journey.articleTitle}</h3>
            <div class="prose max-w-none bg-gray-50 p-5 rounded-2xl text-base">
                ${journey.articleBody.split('\n\n').map(p => `<p>${p}</p>`).join('')}
            </div>
        </div>

        <div class="report-section mt-12">
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

// PNG로 보고서 다운로드
export async function downloadReport() {
    const reportElement = document.getElementById("report-content");
    showLoading("보고서 이미지 생성 중... (조금 오래 걸릴 수 있어요)");
    
    try {
        document.getElementById("activity-view").parentElement.scrollTop = 0;
        
        const canvas = await html2canvas(reportElement, {
            scale: 1.5,
            useCORS: true, 
            backgroundColor: '#ffffff' 
        });
        
        const link = document.createElement('a');
        link.download = `ai_writing_report_${userNickname}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

    } catch (err) {
        console.error("Report download failed", err);
        showModal("오류", "보고서 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
    hideLoading();
}

