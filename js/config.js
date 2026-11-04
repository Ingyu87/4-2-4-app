export let userNickname = null;
export let currentArticleId = null;
export let currentArticleData = null;
export let currentUserJourney = {};

export let feedbackQueue = [];
export let isFeedbackRunning = false;

export function setUserNickname(nickname) {
    userNickname = nickname;
}

export function setCurrentArticleId(id) {
    currentArticleId = id;
}

export function setCurrentArticleData(data) {
    currentArticleData = data;
}

export function setCurrentUserJourney(journey) {
    currentUserJourney = journey;
}

export function setFeedbackQueue(queue) {
    feedbackQueue = queue;
}

export function setIsFeedbackRunning(running) {
    isFeedbackRunning = running;
}
