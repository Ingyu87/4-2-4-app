import { geminiApiKey } from './config.js';
import { showModal } from './ui.js';

// API 호출 재시도 로직
export async function apiCallWithRetry(url, payload, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error("API Error Body:", errorBody);
                throw new Error(`API Error: ${response.statusText}`);
            }
            return await response.json();

        } catch (error) {
            if (i === retries - 1) {
                console.error("API 호출 최종 실패:", error);
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
    }
}

// Gemini 안전성 검사 API
export async function checkSafety(text) {
    if (!geminiApiKey || geminiApiKey.trim() === "") {
        console.error("Gemini API 키가 설정되지 않았습니다. 안전성 검사를 수행할 수 없습니다.");
        showModal("시스템 오류", "안전성 검사 시스템을 사용할 수 없습니다. 관리자에게 문의해주세요.");
        return "UNSAFE: API 키 미설정";
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;
    const prompt = `
        다음 텍스트에 부적절한(unsafe) 콘텐츠(욕설, 비방, 혐오 발언, 성적 표현, 폭력적 표현 등)가 포함되어 있는지 동적으로 분석해줘.
        텍스트: "${text}"

        응답은 다음 JSON 형식으로만 해줘:
        {"safety": "SAFE" 또는 "UNSAFE: [구체적인 이유]"}
        
        주의: 하드코딩된 단어 목록이 아닌, 문맥과 의미를 고려하여 동적으로 판단해줘.
    `;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    safety: { type: "STRING" },
                },
                required: ["safety"]
            }
        }
    };

    try {
        const result = await apiCallWithRetry(apiUrl, payload);
        if (result.candidates && result.candidates[0].content?.parts?.[0]?.text) {
            const safetyResult = JSON.parse(result.candidates[0].content.parts[0].text);
            if (safetyResult.safety === "SAFE") {
                return "SAFE";
            }
            return safetyResult.safety || "UNSAFE: 응답 형식 오류";
        }
        console.error("Safety check response parsing failed");
        return "UNSAFE: 응답 파싱 실패";
    } catch (error) {
        console.error("Safety check API error:", error);
        return "UNSAFE: 안전성 검사 API 오류";
    }
}

// AI 피드백 생성
export async function getAIFeedback(noteOrQuestion, stage, articleType) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;
    
    const stageMap = {
        'pre-read': '읽기 전 (예상/배경지식)',
        'during-read': '읽기 중 (질문 만들기)',
        'adjustment': '읽기 조정 (해결 방법)',
        'post-read-1': `읽기 후 (${articleType === '설명하는 글' ? '글 요약' : '의견 비교'})`,
        'post-read-2': `읽기 후 (${articleType === '설명하는 글' ? '더 궁금한 점 (질문)' : '생각 변화'})`,
        'post-read-3': '읽기 후 (나의생각)'
    };

    const isQuestionStage = (stage === 'during-read') || (stage === 'post-read-2' && articleType === '설명하는 글');

    let prompt;

    if (isQuestionStage) {
        const questionTypeInfo = (articleType === '설명하는 글')
            ? "이 글은 '설명하는 글'입니다. 학생의 질문이 '정보, 사실, 중심 내용, 새롭게 알게 된 점'에 초점을 맞추고 있는지 확인해주세요. ('무엇', '왜' 활용)"
            : "이 글은 '의견을 제시하는 글'입니다. 학생의 질문이 '글쓴이의 주장, 이유의 타당성, 자신의 생각과 비교'에 초점을 맞추고 있는지 확인해주세요. ('...은 타당한가?', '나라면 어떨까?' 활용)";

        prompt = `
            당신은 초등학교 4학년 담임 선생님 역할의 AI입니다. 학생이 만든 '질문'을 평가해야 합니다.
            '사랑하는 OOO' 같은 호칭은 절대 사용하지 말고, 학생이 만든 질문에 대해서만 객관적으로 평가하고 조언합니다.

            [학생의 활동]
            - 글 종류: ${articleType}
            - 활동 단계: ${stageMap[stage]}
            - 학생이 만든 질문: "${noteOrQuestion}"

            [피드백 지침]
            1.  학생이 만든 질문이 [글 종류]의 핵심(정보 파악 또는 비판적 사고)을 잘 파고드는 질문인지 1-2 문장으로 칭찬하거나 격려해주세요. (예: 중심 내용을 잘 파악한 질문이네요.)
            2.  ${questionTypeInfo}
            3.  [피드백 지침] 2번을 바탕으로, 이 질문을 더 깊게 만들거나, 추가하면 좋을 질문의 예시를 1가지 제안해주세요.
                - (설명글 예시) "여기서 '새롭게 알게 된 사실'에 대해 질문해 보는 건 어떨까요? (예: ...은 왜 ...일까?)"
                - (의견글 예시) "글쓴이의 '주장'이 '타당한지' 묻는 질문도 아주 좋아요. (예: ...라는 주장은 ... 때문에 타당한가?)"
        `;
    } else {
        const typeInfo = (articleType === '설명하는 글')
            ? "이 글은 '설명하는 글'입니다. 학생의 활동이 '정보, 사실, 중심 내용'에 집중했는지 확인해주세요."
            : "이 글은 '의견을 제시하는 글'입니다. 학생의 활동이 '글쓴이의 주장, 이유의 타당성, 자신의 생각과 비교'에 집중했는지 확인해주세요.";

        prompt = `
            당신은 초등학교 4학년 담임 선생님 역할의 AI입니다. 학생의 '활동 내용'을 평가해야 합니다.
            '사랑하는 OOO' 같은 호칭은 절대 사용하지 말고, 학생이 작성한 내용에 대해서만 객관적으로 평가하고 조언합니다.

            [학생의 활동]
            - 글 종류: ${articleType}
            - 활동 단계: ${stageMap[stage]}
            - 학생이 작성한 내용: "${noteOrQuestion}"

            [피드백 지침]
            1.  학생이 작성한 내용을 1-2 문장으로 칭찬하거나 격려해주세요. (예: 꼼꼼하게 자신의 생각을 잘 정리했네요.)
            2.  ${typeInfo}
            3.  [피드백 지침] 2번을 바탕으로, 학생의 활동 내용을 더 깊게 만들 수 있는 구체적인 조언 1-2문장을 제안해주세요.
                - (읽기 전 예시) "글의 주제와 관련해 '알고 있던 경험'도 함께 적어보면 글을 이해하는 데 도움이 될 거예요."
                - (읽기 후 예시) "글쓴이의 의견과 '자신의 의견'을 '비교'하는 부분(같은 점, 다른 점)을 더 자세히 써보면 어떨까요?"
        `;
    }

    const payload = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    const result = await apiCallWithRetry(apiUrl, payload);
    if (result.candidates && result.candidates[0].content?.parts?.[0]?.text) {
        return result.candidates[0].content.parts[0].text;
    }
    throw new Error("Gemini API에서 피드백을 생성하지 못했습니다.");
}

// 최종 보고서 평가 생성
export async function getAIReportEvaluation(journey, articleType) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;
    
    let journeySummary = `
        글 종류: ${articleType}
        글 제목: ${journey.articleTitle}
    `;

    const stepsOrder = [
        { key: 'pre-read', title: '읽기 전', v1: journey.steps['pre-read']?.note_v1, v2: journey.steps['pre-read']?.note_v2, feedback: journey.steps['pre-read']?.feedback },
        { key: 'during-read', title: '읽기 중', v1: journey.steps['during-read']?.v1, v2: journey.steps['during-read']?.v2, feedback: journey.steps['during-read']?.feedback },
        { key: 'adjustment', title: '읽기 조정', v1: journey.steps['adjustment']?.solution_v1, v2: journey.steps['adjustment']?.solution_v2, feedback: journey.steps['adjustment']?.feedback, choice: journey.steps['adjustment']?.choice },
        { key: 'post-read-1', title: `읽기 후 1 (${journey.steps['post-read-1']?.title || ''})`, v1: journey.steps['post-read-1']?.v1, v2: journey.steps['post-read-1']?.v2, feedback: journey.steps['post-read-1']?.feedback },
        { key: 'post-read-2', title: `읽기 후 2 (${journey.steps['post-read-2']?.title || ''})`, v1: journey.steps['post-read-2']?.v1, v2: journey.steps['post-read-2']?.v2, feedback: journey.steps['post-read-2']?.feedback },
        { key: 'post-read-3', title: `읽기 후 3 (${journey.steps['post-read-3']?.title || ''})`, v1: journey.steps['post-read-3']?.v1, v2: journey.steps['post-read-3']?.v2, feedback: journey.steps['post-read-3']?.feedback },
    ];

    stepsOrder.forEach(step => {
        if (step.choice === 'no') {
            journeySummary += `\n- ${step.title}: "이해하기 어려운 부분 없음" 선택.\n`;
        } else if (step.v1) {
            journeySummary += `\n- ${step.title}:
                - 학생 활동 (v1): ${step.v1}
                - AI 피드백: ${step.feedback || '받지 않음'}
                - 학생 수정 (v2): ${step.v2 || '수정하지 않음'}
            \n`;
        }
    });

    const prompt = `
        당신은 초등학교 4학년 담임 선생님 역할의 AI입니다. 학생의 읽기 활동 보고서를 평가해야 합니다.
        '사랑하는 OOO' 같은 호칭은 절대 사용하지 말고, 학생의 활동 내용에 대해서만 객관적이고 꼼꼼하게 평가합니다.
        매우 친절하고, 격려하는 말투로 작성해주세요.
        
        [성취 기준]
        [4국02-03] 질문을 활용하여 글을 예측하며 읽고 자신의 읽기 과정을 점검한다.

        [평가 기준]
        - 잘함: 읽기 전, 중, 후의 과정에 알맞은 질문을 활용해 읽기 과정을 되돌아보며, 자신의 읽기 과정을 **스스로 조정**할 수 있다. (피드백을 받고 v2로 수정한 내용이 v1보다 나아졌는지)
        - 보통: 읽기 전, 중, 후의 과정에 알맞은 질문을 활용해 읽기 과정을 되돌아볼 수 있다. (v1 활동을 충실히 완료했는지)
        - 노력 요함: 자신의 읽기 과정을 되돌아보는 데 도움이 필요하다.

        [글 종류별 핵심 활동]
        - 설명하는 글: 정보 파악, 중심 내용 찾기, 요약하기, 궁금한 점 찾기.
        - 의견을 제시하는 글: 의견 예측하기, 주장의 타당성 파악하기, 자신의 의견과 비교하기.

        [학생 활동 요약]
        ${journeySummary}

        [작성할 보고서 내용]
        위 [학생 활동 요약]을 [성취 기준]과 [평가 기준]에 근거하여, 다음 3가지 항목으로 나누어 상세하게 평가 보고서를 작성해주세요. (HTML <p>, <ul>, <li>, <strong> 태그를 사용하여 가독성 좋게 작성)

        1.  **종합 평가 (성취 수준):** 학생의 성취 수준을 '잘함', '보통', '노력 요함' 중 하나로 결정하고, 그 이유를 <strong> 태그로 강조하여 종합적으로 설명해주세요.
        2.  **단계별 상세 평가:**
            * '읽기 전', '읽기 중', '읽기 후' 각 단계별로 학생의 활동(v1)이 글의 종류(${articleType})에 맞게 잘 이루어졌는지 상세히 평가해주세요.
            * '읽기 조정' 활동에 대해서도 평가해주세요.
        3.  **성장 과정 (스스로 조정하기):**
            * 학생이 AI 피드백을 받고 '수정한 내용(v2)'이 '처음 작성한 내용(v1)'에 비해 어떻게 발전했는지 구체적으로 비교하며 칭찬해주세요.
            * 이것이 "스스로 조정"하는 '잘함' 수준에 해당하는지 명시해주세요.
            * 수정하지 않았다면, 그 점을 언급하며 다음 활동을 격려해주세요.
    `;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    const result = await apiCallWithRetry(apiUrl, payload);
    if (result.candidates && result.candidates[0].content?.parts?.[0]?.text) {
        return result.candidates[0].content.parts[0].text;
    }
    throw new Error("Gemini API에서 최종 평가를 생성하지 못했습니다.");
}

// 난이도 '상' 고정
export async function generateText(type, topic) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;
    
    const difficulty = "상";
    const difficultyMap = {
        "상": "초등학교 4학년 수준보다 약간 더 심화된 어휘를 사용하고 문단이 4-5개인 글 (약 600-800자)",
        "중": "적절한 어휘를 사용하고 문단이 3-4개인 글",
        "하": "쉽고 짧은 문장을 사용하고 문단이 2-3개인 글"
    };

    const typeMap = {
        "설명하는 글": "어떤 사실이나 지식을 객관적으로 전달하는 글. 의견이 들어가지 않아야 함.",
        "의견을 제시하는 글": "특정 주제에 대해 명확한 주장과 그에 따른 2-3가지 이유(근거)를 제시하는 글."
    };

    const topicPrompt = topic.trim() !== ""
        ? `주제는 반드시 '${topic}'(으)로 생성해줘.`
        : "주제는 초등학교 4학년 학생들의 호기심을 자극할만한 것으로 자유롭게 선정해줘 (예: 우주, 동물, 환경, 발명품, AI, 미래 기술 등).";

    const prompt = `
        초등학교 4학년 학생을 위한 '${typeMap[type]}'을(를) 생성해줘.
        난이도는 '${difficultyMap[difficulty]}' 수준이어야 해.
        ${topicPrompt}
        
        반드시 다음 JSON 형식에 맞춰서 응답해줘.
        {
            "title": "글의 제목",
            "body": "글의 본문. 문단 구분을 위해 \\n\\n을 사용해줘."
        }
    `;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    title: { type: "STRING" },
                    body: { type: "STRING" }
                },
                required: ["title", "body"]
            }
        }
    };

    const result = await apiCallWithRetry(apiUrl, payload);
    if (result.candidates && result.candidates[0].content?.parts?.[0]?.text) {
        return JSON.parse(result.candidates[0].content.parts[0].text);
    }
    throw new Error("Gemini API에서 텍스트를 생성하지 못했습니다.");
}

