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
        다음 텍스트에 부적절한(unsafe) 콘텐츠가 포함되어 있는지 동적으로 분석해줘.
        텍스트: "${text}"

        [검사 항목]
        1. 욕설, 비방, 혐오 발언, 성적 표현, 폭력적 표현
        2. 현재 살아있는 정치인(대통령, 국회의원, 시장, 도지사 등)의 이름이나 언급
        
        응답은 다음 JSON 형식으로만 해줘:
        {"safety": "SAFE" 또는 "UNSAFE: [구체적인 이유]"}
        
        주의: 하드코딩된 단어 목록이 아닌, 문맥과 의미를 고려하여 동적으로 판단해줘. 특히 현재 살아있는 정치인 언급은 교육적 목적에 부적절하므로 반드시 차단해줘.
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
        // 질문 만들기 활동 피드백
        let questionFocusInfo = "";
        let questionExample = "";
        
        if (stage === 'during-read') {
            // 읽기 중 질문 만들기
            if (articleType === '설명하는 글') {
                questionFocusInfo = "이 글은 '설명하는 글'입니다. 학생의 질문이 다음에 초점을 맞추고 있는지 확인해주세요:\n- 자신이 예상한 내용이 글의 내용과 같은지 확인하는 질문\n- 각 부분의 중심 내용이나 중심 문장을 찾는 질문\n- 새롭게 알게 된 내용을 찾는 질문\n('무엇', '왜' 같은 의문사를 활용하여 정보, 사실, 중심 내용에 초점)";
                questionExample = "예를 들어, '이 문단에서 가장 중요한 내용은 무엇일까?', '...은 왜 ...일까?' 같은 질문을 만들어 보면 좋아요.";
            } else {
                questionFocusInfo = "이 글은 '의견을 제시하는 글'입니다. 학생의 질문이 다음에 초점을 맞추고 있는지 확인해주세요:\n- 자신이 예상한 내용이 글의 내용과 같은지 확인하는 질문\n- 글쓴이가 글을 통해 전하려고 하는 생각(의견)을 찾는 질문\n- 글쓴이의 의견에 대한 이유가 적절한지 살피는 질문\n('...은 타당한가?', '나라면 어떨까?' 같은 비판적 사고 질문)";
                questionExample = "예를 들어, '글쓴이의 주장은 ...인데, 그 이유는 타당할까?', '나라면 ...라고 주장하겠다' 같은 질문을 만들어 보면 좋아요.";
            }
        } else if (stage === 'post-read-2' && articleType === '설명하는 글') {
            // 읽기 후 더 궁금한 점 (설명하는 글만)
            questionFocusInfo = "이 글은 '설명하는 글'입니다. 학생의 질문이 '글을 읽고 더 알고 싶은 내용'에 초점을 맞추고 있는지 확인해주세요. ('무엇', '왜' 활용하여 새롭게 알게 된 사실이나 중심 내용에 대한 추가 탐구)";
            questionExample = "예를 들어, '...은 왜 ...일까?', '...에 대해 더 찾아보고 싶다' 같은 질문을 만들어 보면 좋아요.";
        }

        prompt = `
            당신은 초등학교 4학년 담임 선생님 역할의 AI입니다. 학생이 만든 '질문'을 평가해야 합니다.
            '사랑하는 OOO' 같은 호칭은 절대 사용하지 말고, 학생이 만든 질문에 대해서만 객관적으로 평가하고 조언합니다.

            [학생의 활동]
            - 글 종류: ${articleType}
            - 활동 단계: ${stageMap[stage]}
            - 학생이 만든 질문: "${noteOrQuestion}"

            [피드백 지침]
            1.  학생이 만든 질문이 [글 종류]와 [활동 단계]에 알맞은 질문인지 1-2 문장으로 칭찬하거나 격려해주세요.
                - 질문이 잘 만들어졌다면: "읽기 과정을 되돌아보는 데 도움이 되는 좋은 질문이네요."
                - 질문이 부족하다면: "좀 더 구체적인 질문을 만들어 보면 읽기 과정을 점검하는 데 도움이 될 거예요."
            
            2.  ${questionFocusInfo}
            
            3.  [피드백 지침] 2번을 바탕으로, 이 질문을 더 깊게 만들거나, 추가하면 좋을 질문의 예시를 1가지 구체적으로 제안해주세요.
                ${questionExample}
        `;
    } else {
        // 내용 작성 활동 피드백
        let activityFocusInfo = "";
        let activityExample = "";
        
        if (stage === 'pre-read') {
            // 읽기 전 활동
            if (articleType === '설명하는 글') {
                activityFocusInfo = "이 글은 '설명하는 글'입니다. 학생의 활동이 다음에 집중했는지 확인해주세요:\n- 글의 제목이나 차례를 보며 내용을 예상했는지\n- 글의 주제와 관련하여 자신이 알고 있는 내용을 떠올렸는지";
                activityExample = "예를 들어, '글의 주제와 관련해 알고 있던 경험이나 지식'도 함께 적어보면 글을 이해하는 데 도움이 될 거예요.";
            } else {
                activityFocusInfo = "이 글은 '의견을 제시하는 글'입니다. 학생의 활동이 다음에 집중했는지 확인해주세요:\n- 제목을 보고 글쓴이가 어떤 의견을 제시할지 예상했는지\n- 글의 주제와 관련하여 자신이 알고 있는 내용이나 경험을 떠올렸는지";
                activityExample = "예를 들어, '이 주제에 대해 평소 어떻게 생각했는지'도 함께 적어보면 글쓴이의 의견과 비교하는 데 도움이 될 거예요.";
            }
        } else if (stage === 'post-read-1') {
            // 읽기 후 1단계
            if (articleType === '설명하는 글') {
                activityFocusInfo = "이 글은 '설명하는 글'입니다. 학생의 활동이 '글 전체의 내용을 요약하여 정리'했는지 확인해주세요. (중심 문장들을 활용한 요약)";
                activityExample = "예를 들어, '각 문단의 중심 내용을 연결하여 글 전체를 한 문장으로 요약'해 보면 좋아요.";
            } else {
                activityFocusInfo = "이 글은 '의견을 제시하는 글'입니다. 학생의 활동이 '주제에 대한 글쓴이의 의견과 자신의 의견을 비교하고 정리'했는지 확인해주세요.";
                activityExample = "예를 들어, '글쓴이의 의견과 자신의 의견의 같은 점과 다른 점'을 더 자세히 비교해 보면 좋아요.";
            }
        } else if (stage === 'post-read-2' && articleType === '의견을 제시하는 글') {
            // 읽기 후 2단계 (의견 글만 - 생각 변화)
            activityFocusInfo = "이 글은 '의견을 제시하는 글'입니다. 학생의 활동이 '글을 읽으면서 생각이 바뀌거나 발전한 부분'을 확인했는지 평가해주세요.";
            activityExample = "예를 들어, '전에는 ...라고 생각했는데, 이 글을 읽고 ...라고 생각이 바뀌었다'는 식으로 구체적으로 적어보면 좋아요.";
        } else if (stage === 'post-read-3') {
            // 읽기 후 3단계 (의견 글만 - 나의 생각)
            activityFocusInfo = "이 글은 '의견을 제시하는 글'입니다. 학생의 활동이 '주제에 대한 자신의 생각'을 명확하게 정리했는지 확인해주세요.";
            activityExample = "예를 들어, '이 주제에 대해 나는 ...라고 생각한다'는 식으로 자신의 최종 의견을 명확하게 표현해 보면 좋아요.";
        } else if (stage === 'adjustment') {
            // 읽기 조정
            activityFocusInfo = "학생이 '이해하기 어려운 부분을 어떻게 해결했는지' 구체적으로 설명했는지 확인해주세요.";
            activityExample = "예를 들어, '낱말의 뜻을 짐작해 보았어요', '앞 문장을 다시 천천히 읽어보았어요' 같은 구체적인 해결 방법을 적어보면 좋아요.";
        } else {
            // 기본 (fallback)
            activityFocusInfo = (articleType === '설명하는 글')
                ? "이 글은 '설명하는 글'입니다. 학생의 활동이 '정보, 사실, 중심 내용'에 집중했는지 확인해주세요."
                : "이 글은 '의견을 제시하는 글'입니다. 학생의 활동이 '글쓴이의 주장, 이유의 타당성, 자신의 생각과 비교'에 집중했는지 확인해주세요.";
            activityExample = "학생의 활동 내용을 더 깊게 만들 수 있는 구체적인 조언을 제안해주세요.";
        }

        prompt = `
            당신은 초등학교 4학년 담임 선생님 역할의 AI입니다. 학생의 '활동 내용'을 평가해야 합니다.
            '사랑하는 OOO' 같은 호칭은 절대 사용하지 말고, 학생이 작성한 내용에 대해서만 객관적으로 평가하고 조언합니다.

            [학생의 활동]
            - 글 종류: ${articleType}
            - 활동 단계: ${stageMap[stage]}
            - 학생이 작성한 내용: "${noteOrQuestion}"

            [피드백 지침]
            1.  학생이 작성한 내용을 1-2 문장으로 칭찬하거나 격려해주세요.
                - 내용이 잘 작성되었다면: "읽기 과정을 되돌아보는 데 도움이 되는 좋은 내용이네요."
                - 내용이 부족하다면: "좀 더 구체적으로 적어보면 읽기 과정을 점검하는 데 도움이 될 거예요."
            
            2.  ${activityFocusInfo}
            
            3.  [피드백 지침] 2번을 바탕으로, 학생의 활동 내용을 더 깊게 만들 수 있는 구체적인 조언 1-2문장을 제안해주세요.
                ${activityExample}
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
        "상": "초등학교 4학년 수준의 어휘를 사용하고, 최소 5문단 이상이며, 각 문단에 5문장 이상이 포함된 글 (약 800-1200자)",
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
        
        [중요한 요구사항]
        - 반드시 최소 5문단 이상으로 작성해줘.
        - 각 문단은 최소 5문장 이상이어야 해.
        - 문단 구분은 \\n\\n을 사용해줘.
        - 초등학교 4학년 수준의 어휘와 문장 구조를 사용해줘.
        - 현재 살아있는 정치인(대통령, 국회의원, 시장, 도지사 등)의 이름이나 언급은 절대 포함하지 말아줘. 교육적 목적에 부적절합니다.
        
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

