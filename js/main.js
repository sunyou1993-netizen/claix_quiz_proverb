/**
 * 우리나라 속담 맞추기 게임 키오스크 (1080x1920 Signage)
 * Main JavaScript Module - Complete Interactive Implementation
 */

import { getFull1000Proverbs, DISTRACTOR_POOL, autoSelectTargets } from './proverbs_data.js';

// ==========================================
// 1. DATA & PROVERB PROCESSOR ENGINE
// ==========================================
let PROVERB_DATA = [];

// Helper: Extract Korean Choseong
function getChoseong(str) {
  const choseongs = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const code = str.charCodeAt(0) - 44032;
  if (code < 0 || code > 11172) return str;
  return choseongs[Math.floor(code / 588)];
}

function processProverbItem(rawItem, sessionNum) {
  const proverb = rawItem.proverb;
  const targets = autoSelectTargets(proverb, rawItem.targets);

  let targetIndices = [];
  targets.forEach(tgt => {
    let idx = proverb.indexOf(tgt);
    if (idx === -1) {
      for (let i = 0; i < proverb.length; i++) {
        const char = proverb[i];
        if (char !== ' ' && !targetIndices.some(ti => ti.index === i)) {
          idx = i;
          tgt = char;
          break;
        }
      }
    }
    if (idx !== -1 && !targetIndices.some(ti => ti.index === idx)) {
      targetIndices.push({ index: idx, char: tgt });
    }
  });

  targetIndices.sort((a, b) => a.index - b.index);

  const displayParts = [];
  let lastIdx = 0;

  targetIndices.forEach(item => {
    if (item.index > lastIdx) {
      displayParts.push({ text: proverb.substring(lastIdx, item.index) });
    }
    displayParts.push({
      target: item.char,
      choseong: getChoseong(item.char)
    });
    lastIdx = item.index + item.char.length;
  });

  if (lastIdx < proverb.length) {
    displayParts.push({ text: proverb.substring(lastIdx) });
  }

  const targetChars = targetIndices.map(t => typeof t.char === 'string' ? t.char.trim().charAt(0) : t.char).filter(c => c.length === 1);
  const availableDistractors = DISTRACTOR_POOL
    .filter(d => typeof d === 'string' && d.trim().length === 1 && !targetChars.includes(d.trim()))
    .map(d => d.trim());
  const shuffledDistractorList = shuffleArray(availableDistractors);
  const selectedDistractors = shuffledDistractorList.slice(0, Math.max(0, 14 - targetChars.length));

  const rawKeypadTiles = shuffleArray([...targetChars, ...selectedDistractors]);
  const keypadTiles = rawKeypadTiles.map(s => typeof s === 'string' ? s.trim().charAt(0) : s).filter(s => s && s.length === 1);

  return {
    id: sessionNum,
    category: rawItem.category || "우리나라 속담",
    proverb: proverb,
    meaning: rawItem.meaning,
    displayParts: displayParts,
    keypadTiles: keypadTiles,
    shuffledKeypadTiles: keypadTiles
  };
}

// ==========================================
// 2. AUDIO SYNTHESIZER (Web Audio API)
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playTileSelect() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(659.25, this.ctx.currentTime); // E5
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playCorrect() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const startTime = this.ctx.currentTime + idx * 0.08;
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  playWrong() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.setValueAtTime(180, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playMelodyTune(onComplete) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const melody = [
      { f: 392.00, d: 0.35 }, { f: 440.00, d: 0.35 }, { f: 523.25, d: 0.6 }, { f: 523.25, d: 0.35 },
      { f: 587.33, d: 0.35 }, { f: 659.25, d: 0.6 }, { f: 587.33, d: 0.35 }, { f: 523.25, d: 0.7 }
    ];

    let now = this.ctx.currentTime;
    melody.forEach(note => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.f;
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + note.d);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + note.d);
      now += note.d + 0.05;
    });

    if (onComplete) {
      setTimeout(onComplete, (now - this.ctx.currentTime) * 1000);
    }
  }
}

const sfx = new SoundFX();

// ==========================================
// 3. GAME STATE
// ==========================================
const state = {
  currentProverbIndex: 0,
  score: 0,
  timeRemaining: 300, // 05:00
  timerInterval: null,
  activeBoxIndex: 0,
  userAnswers: {},
  usedKeypadIndices: new Set(),
  isCompleted: false,
  isTransitioning: false,
  solvedStatus: {},
  autoCheckTimer: null
};

function clearAutoCheckTimer() {
  if (state.autoCheckTimer) {
    clearTimeout(state.autoCheckTimer);
    state.autoCheckTimer = null;
  }
}

// ==========================================
// 4. AUTO-SCALING KIOSK ENGINE
// ==========================================
function setupAutoScaling() {
  const stage = document.getElementById('app-stage');
  if (!stage) return;

  function updateScale() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const scaleX = windowWidth / 1080;
    const scaleY = windowHeight / 1920;
    const scale = Math.min(scaleX, scaleY);

    stage.style.transform = `scale(${scale})`;
  }

  window.addEventListener('resize', updateScale);
  updateScale();
}

// Utility: Fisher-Yates shuffle array
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ==========================================
// 5. VIEW RENDER ENGINE
// ==========================================

function initGameSession() {
  clearAutoCheckTimer();

  // Pick 10 random questions from the 1,000 proverb database for each game session
  const allProverbs = getFull1000Proverbs();
  const selectedRawList = shuffleArray(allProverbs).slice(0, 10);
  PROVERB_DATA = selectedRawList.map((item, idx) => processProverbItem(item, idx + 1));

  state.currentProverbIndex = 0;
  state.score = 0;
  state.timeRemaining = 300;
  state.userAnswers = {};
  state.usedKeypadIndices.clear();
  state.activeBoxIndex = 0;
  state.isCompleted = false;
  state.isTransitioning = false;
  state.solvedStatus = {};

  startTimer();
  renderMainGameUI();
}

function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    state.timeRemaining--;
    updateTimerDisplay();

    if (state.timeRemaining <= 0) {
      clearInterval(state.timerInterval);
      sfx.playWrong();
      showResultModal(false);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const timerBadge = document.getElementById('timer-pill-badge');
  if (timerBadge) {
    const mins = Math.floor(state.timeRemaining / 60);
    const secs = state.timeRemaining % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    timerBadge.innerHTML = `⏱ 남은 시간 ${timeStr}`;
    
    if (state.timeRemaining <= 15) {
      timerBadge.classList.add('warning');
    } else {
      timerBadge.classList.remove('warning');
    }
  }
}

function renderMainGameUI() {
  const proverbItem = PROVERB_DATA[state.currentProverbIndex];
  const main = document.getElementById('view-container');
  const footer = document.getElementById('app-footer');

  // Track target blank box index
  let globalBoxCount = 0;

  // Build Proverb Display Row
  let proverbLineHtml = '';
  proverbItem.displayParts.forEach((part) => {
    if (part.text) {
      proverbLineHtml += `<span>${part.text}</span>`;
    } else if (part.target) {
      const boxIdx = globalBoxCount++;
      const userVal = state.userAnswers[boxIdx] || '';
      const isActive = boxIdx === state.activeBoxIndex;
      const isFilled = userVal !== '';
      
      let boxClasses = 'choseong-box';
      if (isActive) boxClasses += ' active-target';
      if (isFilled) boxClasses += ' filled';

      const displayVal = isFilled ? userVal : '';

      proverbLineHtml += `
        <div class="${boxClasses}" data-box-idx="${boxIdx}" data-choseong="${part.choseong}" data-target="${part.target}">
          ${displayVal}
        </div>
      `;
    }
  });

  // Render Chalkboard Card + Keypad Tray
  main.innerHTML = `
      <div class="title-center-block">
        <img src="/image652.png" alt="우리나라 속담 맞추기" class="title-text-img" referrerPolicy="no-referrer">
        
        <div id="timer-pill-badge" class="timer-pill-badge">
          ⏱ 남은 시간 05:00
        </div>
      </div>

    <!-- Main Proverb Green Chalkboard -->
    <div class="chalkboard-container">
      <!-- Proverb Meaning Hint Callout Card -->
      <div class="proverb-meaning-box">
        <div class="proverb-meaning-title">
          <span>💡 속담의 뜻</span>
        </div>
        <div class="proverb-meaning-text">
          "${proverbItem.meaning}"
        </div>
      </div>

      <!-- Feedback Banner (정답/오답 안내) -->
      <div id="feedback-banner" class="feedback-banner hidden"></div>

      <!-- Center Content Wrapper (태그 + 속담문구 묶어서 칠판 중앙 위치) -->
      <div class="chalk-content-wrapper">
        <!-- Problem Tag Badges (속담 문구 바로 위) -->
        <div class="chalk-badges-row">
          <span class="chalk-badge-qnum">${state.currentProverbIndex + 1} / ${PROVERB_DATA.length}</span>
        </div>

        <!-- Proverb Lyrics / Blanks Lines -->
        <div class="chalk-lyrics-container">
          <div class="chalk-lyric-row">
            ${proverbLineHtml}
          </div>
        </div>
      </div>

      <!-- Chalkboard Bottom Ledge Tray -->
      <div class="chalkboard-tray">
        <div class="tray-eraser"></div>
        <div class="tray-chalks-row">
          <div class="chalk-stick chalk-white"></div>
          <div class="chalk-stick chalk-yellow"></div>
          <div class="chalk-stick chalk-pink"></div>
          <div class="chalk-stick chalk-blue"></div>
        </div>
      </div>
    </div>

    <!-- Bottom Syllable Keypad Tray -->
    <div class="syllable-keypad-tray">
      <div class="syllable-grid" id="syllable-keypad-grid">
        ${(proverbItem.shuffledKeypadTiles || proverbItem.keypadTiles).map((syllable, keyIdx) => {
          const isDisabled = state.usedKeypadIndices.has(keyIdx);
          return `
            <button class="syllable-btn ${isDisabled ? 'disabled' : ''}" data-key-idx="${keyIdx}" data-syllable="${syllable}">
              ${syllable}
            </button>
          `;
        }).join('')}
      </div>

      <!-- Action Buttons directly under syllable keypad grid -->
      <div class="keypad-actions-row">
        <button id="btn-reset-line" class="ctrl-btn ctrl-btn-sec">
          <span>전체 지우기</span>
        </button>
        <button id="btn-pass-question" class="ctrl-btn ctrl-btn-warn">
          <span>패스하기</span>
        </button>
      </div>
    </div>
  `;

  updateTimerDisplay();

  // Empty Footer as controls are attached directly inside layout
  footer.innerHTML = '';

  attachEventHandlers(globalBoxCount);
}

function attachEventHandlers(totalBoxes) {
  // 1. Choseong Box Tap Handler
  document.querySelectorAll('.choseong-box').forEach(box => {
    box.addEventListener('click', (e) => {
      sfx.playClick();
      clearAutoCheckTimer();
      const boxIdx = parseInt(e.currentTarget.dataset.boxIdx);

      // If already filled, clear it and return tile to keypad
      if (state.userAnswers[boxIdx]) {
        const removedSyllable = state.userAnswers[boxIdx];
        delete state.userAnswers[boxIdx];

        // Find associated keypad tile and re-enable
        for (let keyIdx of state.usedKeypadIndices) {
          const btn = document.querySelector(`.syllable-btn[data-key-idx="${keyIdx}"]`);
          if (btn && btn.dataset.syllable === removedSyllable) {
            state.usedKeypadIndices.delete(keyIdx);
            break;
          }
        }
      }

      state.activeBoxIndex = boxIdx;
      renderMainGameUI();
    });
  });

  // 2. Syllable Keypad Button Tap Handler
  document.querySelectorAll('.syllable-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.currentTarget.classList.contains('disabled')) return;
      sfx.playTileSelect();
      clearAutoCheckTimer();

      const keyIdx = parseInt(e.currentTarget.dataset.keyIdx);
      const syllable = e.currentTarget.dataset.syllable;

      // Fill current active box
      state.userAnswers[state.activeBoxIndex] = syllable;
      state.usedKeypadIndices.add(keyIdx);

      // Move active target focus to next empty box
      let nextEmptyIndex = -1;
      for (let i = 0; i < totalBoxes; i++) {
        if (!state.userAnswers[i]) {
          nextEmptyIndex = i;
          break;
        }
      }

      if (nextEmptyIndex !== -1) {
        state.activeBoxIndex = nextEmptyIndex;
      }

      renderMainGameUI();

      // Auto-check if all boxes are filled (after 1 second delay)
      if (Object.keys(state.userAnswers).length === totalBoxes) {
        state.autoCheckTimer = setTimeout(() => {
          state.autoCheckTimer = null;
          if (Object.keys(state.userAnswers).length === totalBoxes) {
            validateAnswer(totalBoxes);
          }
        }, 1000);
      }
    });
  });

  // 3. Reset Line Button
  const btnReset = document.getElementById('btn-reset-line');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      sfx.playClick();
      clearAutoCheckTimer();
      state.userAnswers = {};
      state.usedKeypadIndices.clear();
      state.activeBoxIndex = 0;
      renderMainGameUI();
    });
  }

  // 4. Pass Question Button
  const btnPass = document.getElementById('btn-pass-question');
  if (btnPass) {
    btnPass.addEventListener('click', () => {
      if (state.isTransitioning || state.isCompleted) return;
      clearAutoCheckTimer();
      state.isTransitioning = true;
      sfx.playClick();

      // Mark current proverb as passed (not solved)
      state.solvedStatus[state.currentProverbIndex] = false;

      if (state.currentProverbIndex + 1 < PROVERB_DATA.length) {
        state.currentProverbIndex++;
        state.userAnswers = {};
        state.usedKeypadIndices.clear();
        state.activeBoxIndex = 0;
        state.isTransitioning = false;
        renderMainGameUI();
      } else {
        state.isCompleted = true;
        if (state.timerInterval) clearInterval(state.timerInterval);
        sfx.playMelodyTune();
        showResultModal(true);
      }
    });
  }
}

function validateAnswer(totalBoxes) {
  clearAutoCheckTimer();
  if (state.isTransitioning || state.isCompleted) return;
  state.isTransitioning = true;

  const proverbItem = PROVERB_DATA[state.currentProverbIndex];
  let expectedAnswers = [];

  proverbItem.displayParts.forEach(part => {
    if (part.target) {
      expectedAnswers.push(part.target);
    }
  });

  let isAllCorrect = true;
  let hasEmptyBox = false;
  const boxes = document.querySelectorAll('.choseong-box');

  boxes.forEach((box, idx) => {
    const userVal = state.userAnswers[idx];
    const expected = expectedAnswers[idx];

    if (!userVal) {
      hasEmptyBox = true;
    }

    if (userVal && userVal === expected) {
      box.classList.add('correct');
      box.classList.remove('wrong');
    } else {
      box.classList.add('wrong');
      box.classList.remove('correct');
      isAllCorrect = false;
    }
  });

  const feedbackBanner = document.getElementById('feedback-banner');

  if (isAllCorrect) {
    sfx.playCorrect();
    state.score += 10;
    state.solvedStatus[state.currentProverbIndex] = true;

    if (feedbackBanner) {
      feedbackBanner.textContent = "정답입니다! 다음 문제로 이동합니다.";
      feedbackBanner.className = "feedback-banner correct-banner";
    }
    
    setTimeout(() => {
      if (state.currentProverbIndex + 1 < PROVERB_DATA.length) {
        state.currentProverbIndex++;
        state.userAnswers = {};
        state.usedKeypadIndices.clear();
        state.activeBoxIndex = 0;
        state.isTransitioning = false;
        renderMainGameUI();
      } else {
        // All proverbs completed!
        state.isCompleted = true;
        if (state.timerInterval) clearInterval(state.timerInterval);
        sfx.playMelodyTune();
        showResultModal(true);
      }
    }, 1000);
  } else {
    sfx.playWrong();
    state.isTransitioning = false;

    if (feedbackBanner) {
      if (hasEmptyBox) {
        feedbackBanner.textContent = "아직 빈칸이 다 채워지지 않았습니다! 빈칸을 모두 입력해 보세요.";
      } else {
        feedbackBanner.textContent = "오답입니다! 빨간색으로 표시된 글자를 확인하고 다시 입력해 보세요.";
      }
      feedbackBanner.className = "feedback-banner wrong-banner";

      setTimeout(() => {
        if (feedbackBanner && feedbackBanner.classList.contains('wrong-banner')) {
          feedbackBanner.className = "feedback-banner hidden";
        }
      }, 2800);
    }
  }
}

function showResultModal(isSuccess) {
  const stage = document.getElementById('app-stage');
  const score = state.score;

  let trophy = '🏆';
  let titleText = '속담 맞추기 결과';
  let feedbackText = '';

  if (score === 100) {
    trophy = '🏆';
    titleText = '참 잘했어요! 만점 달성!';
    feedbackText = '우리나라 속담 10문제를 모두 정답으로 맞춰 100점을 기록하셨습니다! 🌟';
  } else if (score >= 70) {
    trophy = '🎉';
    titleText = '잘했어요!';
    feedbackText = '속담 실력이 대단합니다! 조금만 더 하면 만점이에요! 👍';
  } else if (score >= 40) {
    trophy = '😊';
    titleText = '아쉬워요!';
    feedbackText = '조금 아쉽네요! 아래 뜻풀이를 읽고 다시 한번 도전해 보세요! 💪';
  } else {
    trophy = '🔍';
    titleText = '분발해요!';
    feedbackText = '밑에 정리된 10개 속담과 뜻풀이를 꼭 읽어보고 재도전해 보세요! 📖';
  }

  const modalHtml = `
    <div class="result-overlay">
      <div class="result-dialog">
        <div class="result-trophy">${trophy}</div>
        <h2 class="result-title-text">${titleText}</h2>
        
        <div class="result-score-big">${score} 점</div>

        <div style="font-size: 24px; color: #5C3A1E; font-weight: 700; line-height: 1.35; text-align: center;">
          ${feedbackText}
        </div>

        <!-- 10개 속담 및 뜻 풀이 모음 목록 -->
        <div class="proverbs-summary-container">
          <div class="proverbs-summary-title">📜 이번에 함께 배운 속담과 정답 현황</div>
          <div class="proverbs-summary-list">
            ${PROVERB_DATA.map((item, idx) => {
              const isSolved = !!state.solvedStatus[idx];
              return `
                <div class="proverb-summary-card ${isSolved ? 'card-correct' : 'card-wrong'}">
                  <div class="proverb-card-header">
                    <div class="proverb-header-left">
                      <span class="proverb-num">${idx + 1}</span>
                      <span class="proverb-text">${item.proverb}</span>
                    </div>
                    <span class="proverb-badge ${isSolved ? 'badge-correct' : 'badge-wrong'}">
                      ${isSolved ? '🟢 정답 (+10점)' : '❌ 오답 / 패스'}
                    </span>
                  </div>
                  <div class="proverb-card-meaning">${item.meaning}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="display: flex; gap: 20px; width: 100%; margin-top: 0; flex-shrink: 0;">
          <button id="btn-modal-retry" class="ctrl-btn ctrl-btn-pri" style="height: 66px; width: 100%; font-size: 28px;">
            <span>처음부터 다시하기</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const existingOverlay = document.querySelector('.result-overlay');
  if (existingOverlay) existingOverlay.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('btn-modal-retry').addEventListener('click', () => {
    sfx.playClick();
    document.querySelector('.result-overlay').remove();
    initGameSession();
  });
}

// ==========================================
// 6. INITIALIZATION & GLOBAL LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  setupAutoScaling();

  // Start initial game session immediately
  initGameSession();
});
