// ================= 配置参数 =================
const CONFIG = {
    CENTER_HEAD_WEIGHT: 0.51,
    EDGE_HEAD_WEIGHT: 0.58,
    EYE_GAIN: 2.0,
    EMA_SMOOTHING: 0.9,
    DWELL_TIME_MS: 250, // 行级吸附停留时间
    STORAGE_KEY: 'eyeFocusCalibrationV1'
};

// ================= DOM 元素 =================
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const instruction = document.getElementById('instruction');
const videoContainer = document.getElementById('video-container');
const cursorBox = document.getElementById('cursor-box');
const textLines = Array.from(document.querySelectorAll('.text-line'));
const dots = Array.from({length: 4}, (_, i) => document.getElementById(`dot-${i}`));

// ================= 状态变量 =================
let isCalibrating = false;
let currentDotIndex = 0;
let isCollecting = false;
let isTrackingActive = false;
let calibrationData = {};
let minHeadX = 0, maxHeadX = 1, minHeadY = 0, maxHeadY = 1;
let minEyeX = 0, maxEyeX = 1, minEyeY = 0, maxEyeY = 1;
let currentCursorX = window.innerWidth / 2;
let currentCursorY = window.innerHeight / 2;
let currentActiveLineIndex = -1;
let dwellStartTime = null;

// ================= 初始化 MediaPipe =================
const faceMesh = new FaceMesh({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`});
faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
faceMesh.onResults(onResults);

// ================= 核心逻辑 =================
window.addEventListener('DOMContentLoaded', () => {
    const savedData = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (savedData) {
        const data = JSON.parse(savedData);
        Object.assign(window, data); // 简化赋值
        minHeadX = data.minHeadX; maxHeadX = data.maxHeadX;
        minHeadY = data.minHeadY; maxHeadY = data.maxHeadY;
        minEyeX = data.minEyeX; maxEyeX = data.maxEyeX;
        minEyeY = data.minEyeY; maxEyeY = data.maxEyeY;
        console.log("✅ 已从缓存加载标定数据");
        startTracking();
    }
});

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {color: '#C0C0C070', lineWidth: 1});

        const headX = landmarks[1].x;
        const headY = landmarks[1].y;
        const eyeX = (landmarks[468].x + landmarks[473].x) / 2;
        const eyeY = (landmarks[468].y + landmarks[473].y) / 2;

        if (isCalibrating && isCollecting && currentDotIndex < 4) {
            handleCalibrationData(headX, headY, eyeX, eyeY);
        }

        if (isTrackingActive) {
            handleTracking(headX, headY, eyeX, eyeY);
        }
    }
    canvasCtx.restore();
}

function handleCalibrationData(headX, headY, eyeX, eyeY) {
    if (!calibrationData[currentDotIndex]) calibrationData[currentDotIndex] = [];
    if (calibrationData[currentDotIndex].length < 90) {
        calibrationData[currentDotIndex].push({hX: headX, hY: headY, eX: eyeX, eY: eyeY});
    } else {
        dots[currentDotIndex].style.display = 'none';
        currentDotIndex++;
        if (currentDotIndex < 4) showNextDot();
        else finishCalibration();
    }
}

function handleTracking(headX, headY, eyeX, eyeY) {
    // 归一化计算...
    let normHeadX = Math.max(0, Math.min(1, (headX - minHeadX) / (maxHeadX - minHeadX)));
    let normHeadY = Math.max(0, Math.min(1, (headY - minHeadY) / (maxHeadY - minHeadY)));
    let rawEyeX = (eyeX - minEyeX) / (maxEyeX - minEyeX);
    let rawEyeY = (eyeY - minEyeY) / (maxEyeY - minEyeY);
    let normEyeX = Math.max(0, Math.min(1, (rawEyeX - 0.5) * CONFIG.EYE_GAIN + 0.5));
    let normEyeY = Math.max(0, Math.min(1, (rawEyeY - 0.5) * CONFIG.EYE_GAIN + 0.5));

    let deviationX = Math.abs(normHeadX - 0.5) * 2;
    let deviationY = Math.abs(normHeadY - 0.5) * 2;
    let currentHeadWeightX = CONFIG.CENTER_HEAD_WEIGHT * (1 - deviationX) + CONFIG.EDGE_HEAD_WEIGHT * deviationX;
    let currentHeadWeightY = CONFIG.CENTER_HEAD_WEIGHT * (1 - deviationY) + CONFIG.EDGE_HEAD_WEIGHT * deviationY;
    let currentEyeWeightX = 1.0 - currentHeadWeightX;
    let currentEyeWeightY = 1.0 - currentHeadWeightY;

    let finalNormX = 1 - (normHeadX * currentHeadWeightX + normEyeX * currentEyeWeightX);
    let finalNormY = normHeadY * currentHeadWeightY + normEyeY * currentEyeWeightY;

    let targetX = finalNormX * window.innerWidth;
    let targetY = finalNormY * window.innerHeight;

    currentCursorX = currentCursorX * CONFIG.EMA_SMOOTHING + targetX * (1.0 - CONFIG.EMA_SMOOTHING);
    currentCursorY = currentCursorY * CONFIG.EMA_SMOOTHING + targetY * (1.0 - CONFIG.EMA_SMOOTHING);

    // 行级吸附
    let targetLineIndex = -1;
    let minDistance = Infinity;
    textLines.forEach((line, index) => {
        const rect = line.getBoundingClientRect();
        const distance = Math.abs(currentCursorY - (rect.top + rect.height / 2));
        if (distance < minDistance) {
            minDistance = distance;
            targetLineIndex = index;
        }
    });

    if (targetLineIndex !== -1) {
        if (targetLineIndex === currentActiveLineIndex) {
            dwellStartTime = null;
        } else {
            if (dwellStartTime === null) dwellStartTime = performance.now();
            else if (performance.now() - dwellStartTime > CONFIG.DWELL_TIME_MS) {
                currentActiveLineIndex = targetLineIndex;
                dwellStartTime = null;
            }
        }

        if (currentActiveLineIndex !== -1) {
            const activeLineRect = textLines[currentActiveLineIndex].getBoundingClientRect();
            cursorBox.style.left = `50%`;
            cursorBox.style.top = `${activeLineRect.top + activeLineRect.height / 2}px`;
        }
    }
}

// ================= 标定流程 =================
function finishCalibration() {
    isCalibrating = false;
    const hXs = [], hYs = [], eXs = [], eYs = [];
    for(let i=0; i<4; i++) {
        let sumHX = 0, sumHY = 0, sumEX = 0, sumEY = 0;
        calibrationData[i].forEach(p => { sumHX += p.hX; sumHY += p.hY; sumEX += p.eX; sumEY += p.eY; });
        hXs.push(sumHX/90); hYs.push(sumHY/90); eXs.push(sumEX/90); eYs.push(sumEY/90);
    }

    const padding = 0.1;
    minHeadX = Math.min(...hXs) - padding * (Math.max(...hXs) - Math.min(...hXs) + 0.01);
    maxHeadX = Math.max(...hXs) + padding * (Math.max(...hXs) - Math.min(...hXs) + 0.01);
    minHeadY = Math.min(...hYs) - padding * (Math.max(...hYs) - Math.min(...hYs) + 0.01);
    maxHeadY = Math.max(...hYs) + padding * (Math.max(...hYs) - Math.min(...hYs) + 0.01);
    minEyeX = Math.min(...eXs) - padding * (Math.max(...eXs) - Math.min(...eXs) + 0.01);
    maxEyeX = Math.max(...eXs) + padding * (Math.max(...eXs) - Math.min(...eXs) + 0.01);
    minEyeY = Math.min(...eYs) - padding * (Math.max(...eYs) - Math.min(...eYs) + 0.01);
    maxEyeY = Math.max(...eYs) + padding * (Math.max(...eYs) - Math.min(...eYs) + 0.01);

    const calibrationCache = { minHeadX, maxHeadX, minHeadY, maxHeadY, minEyeX, maxEyeX, minEyeY, maxEyeY };
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(calibrationCache));
    startTracking();
}

function startTracking() {
    instruction.style.display = 'none';
    resetBtn.style.display = 'block';
    cursorBox.style.display = 'block';
    setWindowPosition('pos-bottom-right');
    isTrackingActive = true;
}

function setWindowPosition(positionClass) {
    videoContainer.className = `video-wrapper ${positionClass}`;
}

function showNextDot() {
    isCollecting = false;
    dots[currentDotIndex].style.display = 'block';
    calibrationData[currentDotIndex] = [];
    const positions = ['pos-top-right', 'pos-bottom-right', 'pos-bottom-left', 'pos-top-left'];
    setWindowPosition(positions[currentDotIndex]);
    setTimeout(() => { if(isCalibrating) isCollecting = true; }, 1000);
}

// ================= 事件绑定 =================
const camera = new Camera(videoElement, { onFrame: async () => { await faceMesh.send({image: videoElement}); }, width: 320, height: 240 });
camera.start();

startBtn.addEventListener('click', () => {
    instruction.style.display = 'none';
    isCalibrating = true;
    currentDotIndex = 0;
    setWindowPosition('pos-top-right');
    showNextDot();
});

resetBtn.addEventListener('click', () => {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    location.reload();
});