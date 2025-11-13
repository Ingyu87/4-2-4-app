import { currentUserJourney, currentArticleData, currentArticleId } from './config.js';
import { showResumeModal, repopulateUiForResume, showStep, showView, showModal } from './ui.js';

// 로컬 저장소 로드
export async function loadStateFromLocal() {
    try {
        const journeyData = localStorage.getItem('readingQuestJourney');
        const articleData = localStorage.getItem('readingQuestArticle');
        const lastStep = localStorage.getItem('readingQuestLastStep');

        if (journeyData && articleData && lastStep) {
            const journey = JSON.parse(journeyData);
            const article = JSON.parse(articleData);

            const userWantsToContinue = await showResumeModal(article.title);

            if (userWantsToContinue) {
                console.log("이전 활동 이어서 시작:", lastStep);
                Object.assign(currentUserJourney, journey);
                Object.assign(currentArticleData, article);
                currentArticleId = article.id;

                repopulateUiForResume(lastStep);
                showStep(lastStep);
            } else {
                console.log("이전 활동 삭제");
                localStorage.clear();
                showView("config-view");
            }
        } else {
            showView("config-view");
        }
    } catch (error) {
        console.error("로컬 저장소 로드 오류:", error);
        localStorage.clear();
        showView("config-view");
    }
}

// 로컬 저장소 저장
export function saveStateToLocal(lastStepId) {
    try {
        localStorage.setItem('readingQuestJourney', JSON.stringify(currentUserJourney));
        localStorage.setItem('readingQuestArticle', JSON.stringify(currentArticleData));
        localStorage.setItem('readingQuestLastStep', lastStepId);
        console.log("활동 저장됨:", lastStepId);
    } catch (error) {
        console.error("로컬 저장소 저장 오류:", error);
        showModal("저장 오류", "활동을 브라우저에 저장하는 데 실패했습니다. 새로고침하면 내용이 사라질 수 있습니다.");
    }
}

