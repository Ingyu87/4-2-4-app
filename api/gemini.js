const GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash"
];

const MAX_INPUT_LENGTH = 50000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

function buildApiUrl(model, apiKey) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

function parseApiErrorResponse(errorBody) {
    try {
        const parsed = JSON.parse(errorBody);
        const details = parsed?.error?.details || [];
        const reason = details?.[0]?.reason || '';
        const message = parsed?.error?.message || '';
        return { reason, message };
    } catch (_) {
        return { reason: '', message: errorBody || '' };
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiCallWithRetry(url, payload, retries = MAX_RETRIES, delay = RETRY_DELAY) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                const parsed = parseApiErrorResponse(errorBody);
                const error = new Error(`API Error: ${response.status} ${response.statusText}`);
                error.status = response.status;
                error.reason = parsed.reason;
                error.apiMessage = parsed.message;
                throw error;
            }
            return await response.json();

        } catch (error) {
            if (i === retries - 1) {
                throw error;
            }
            await sleep(delay * Math.pow(2, i));
        }
    }
}

async function callGeminiWithModelFallback(payload, apiKey) {
    let lastError = null;
    for (let i = 0; i < GEMINI_MODELS.length; i++) {
        const model = GEMINI_MODELS[i];
        try {
            return await apiCallWithRetry(buildApiUrl(model, apiKey), payload);
        } catch (error) {
            lastError = error;
            const message = (error?.apiMessage || error?.message || '').toLowerCase();
            const isModelIssue = error?.status === 404 || message.includes('model') || message.includes('not found') || message.includes('unsupported');
            const hasNext = i < GEMINI_MODELS.length - 1;
            if (isModelIssue && hasNext) {
                continue;
            }
            throw error;
        }
    }
    throw lastError || new Error("No available Gemini model.");
}

function validateOperation(operation) {
    const validOperations = ['checkSafety', 'getAIFeedback', 'getAIReportEvaluation', 'generateText'];
    return validOperations.includes(operation);
}

function validatePayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Invalid payload structure' };
    }
    if (!payload.contents || !Array.isArray(payload.contents)) {
        return { valid: false, error: 'Invalid contents array' };
    }
    const totalTextLength = JSON.stringify(payload).length;
    if (totalTextLength > MAX_INPUT_LENGTH) {
        return { valid: false, error: `Payload too large: ${totalTextLength} > ${MAX_INPUT_LENGTH}` };
    }
    return { valid: true };
}

function toApiErrorCode(error) {
    const reason = error?.reason || '';
    const message = (error?.apiMessage || error?.message || '').toLowerCase();
    if (message.includes('model') && (message.includes('not found') || message.includes('unsupported'))) {
        return "ERROR:MODEL_NOT_FOUND";
    }
    if (reason === 'API_KEY_INVALID' || message.includes('api key')) {
        if (message.includes('expired')) return "ERROR:API_KEY_EXPIRED";
        return "ERROR:API_KEY_INVALID";
    }
    return "ERROR:SAFETY_API";
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ 
            error: 'API key not configured',
            errorCode: 'ERROR:API_KEY_INVALID'
        });
    }

    try {
        const { operation, payload } = req.body;

        if (!validateOperation(operation)) {
            return res.status(400).json({ error: 'Invalid operation' });
        }

        const validation = validatePayload(payload);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const result = await callGeminiWithModelFallback(payload, apiKey);
        return res.status(200).json(result);

    } catch (error) {
        console.error('Gemini API error:', error);
        const errorCode = toApiErrorCode(error);
        return res.status(error.status || 500).json({ 
            error: error.message || 'Internal server error',
            errorCode: errorCode
        });
    }
}
