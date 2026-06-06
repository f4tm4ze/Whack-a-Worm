// ========== SOUND SYSTEM ==========
class GameSound {
    constructor() {
        this.audioContext = null;
        this.soundsEnabled = true;
        this.initAudio();
    }
    
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) {
            console.log("Web Audio not supported");
            this.soundsEnabled = false;
        }
    }
    
    playBeep(frequency, duration, volume = 0.3) {
        if (!this.soundsEnabled || !this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = frequency;
            gainNode.gain.value = volume;
            
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.00001, this.audioContext.currentTime + duration);
            oscillator.stop(this.audioContext.currentTime + duration);
        } catch(e) {
            // silent fail
        }
    }
    
    peck() {
        this.playBeep(880, 0.12, 0.25);
        setTimeout(() => this.playBeep(660, 0.08, 0.2), 50);
    }
    
    wormPop() {
        this.playBeep(523.25, 0.15, 0.2);
    }
    
    gameOver() {
        this.playBeep(440, 0.3, 0.3);
        setTimeout(() => this.playBeep(349.23, 0.4, 0.3), 300);
        setTimeout(() => this.playBeep(293.66, 0.5, 0.35), 700);
    }
    
    difficultyChange() {
        this.playBeep(698.46, 0.1, 0.25);
        setTimeout(() => this.playBeep(523.25, 0.1, 0.25), 100);
    }
    
    reset() {
        this.playBeep(523.25, 0.12, 0.2);
        setTimeout(() => this.playBeep(659.25, 0.12, 0.25), 120);
        setTimeout(() => this.playBeep(783.99, 0.2, 0.3), 240);
    }
    
    newHighScore() {
        this.playBeep(987.77, 0.15, 0.3);
        setTimeout(() => this.playBeep(1318.52, 0.2, 0.35), 150);
        setTimeout(() => this.playBeep(1567.98, 0.3, 0.4), 350);
    }
}

// Initialize sound
const gameSound = new GameSound();

// ========== DIFFICULTY CONFIGURATION ==========
const Difficulty = {
    NORMAL: {
        name: 'NORMAL',
        spawnDelay: 1000,
        wormHideDelay: 800,
        speedButtonEnabled: false
    },
    FAST: {
        name: 'FAST',
        spawnDelay: 600,
        wormHideDelay: 550,
        speedButtonEnabled: false
    },
    INSANE: {
        name: 'INSANE',
        spawnDelay: 350,
        wormHideDelay: 350,
        speedButtonEnabled: false
    }
};

// ========== GAME STATE ==========
let score = 0;
let timeLeft = 30;
let gameActive = true;
let currentInterval = null;
let countdownInterval = null;
let currentDifficulty = Difficulty.NORMAL;
let activeWormIndex = null;
let currentHideTimeout = null;

// Load high score from localStorage
let highScore = localStorage.getItem("whackHighScore") 
    ? parseInt(localStorage.getItem("whackHighScore")) 
    : 0;

// DOM Elements
const holesContainer = document.getElementById("holesGrid");
const scoreSpan = document.getElementById("scoreValue");
const timerSpan = document.getElementById("timerValue");
const bestSpan = document.getElementById("bestValue");
const resetBtn = document.getElementById("resetBtn");
const gameMsgDiv = document.getElementById("gameMessage");
const normalBtn = document.getElementById("normalBtn");
const fastBtn = document.getElementById("fastBtn");
const insaneBtn = document.getElementById("insaneBtn");

// Display high score on load
bestSpan.innerText = highScore;

// AudioContext resume on first user interaction
function resumeAudio() {
    if (gameSound.audioContext && gameSound.audioContext.state === 'suspended') {
        gameSound.audioContext.resume();
    }
}
document.body.addEventListener('click', resumeAudio, { once: true });

// ========== DIFFICULTY HANDLING ==========
function setDifficulty(difficulty) {
    if (!gameActive && score === 0) {
        // Allow difficulty change only when game hasn't started or after reset
        currentDifficulty = difficulty;
        updateDifficultyUI();
        gameSound.difficultyChange();
        gameMsgDiv.innerHTML = `<span class="message-emoji">⚙️</span><span class="message-text">Difficulty set to ${difficulty.name}. Press RESET to start!</span>`;
    } else if (!gameActive) {
        currentDifficulty = difficulty;
        updateDifficultyUI();
        gameSound.difficultyChange();
        gameMsgDiv.innerHTML = `<span class="message-emoji">⚙️</span><span class="message-text">Difficulty set to ${difficulty.name}. Press RESET to play!</span>`;
    } else {
        gameMsgDiv.innerHTML = `<span class="message-emoji">⚠️</span><span class="message-text">Cannot change difficulty during active game. Press RESET first!</span>`;
    }
}

function updateDifficultyUI() {
    normalBtn.classList.remove('active');
    fastBtn.classList.remove('active');
    insaneBtn.classList.remove('active');
    
    if (currentDifficulty.name === 'NORMAL') {
        normalBtn.classList.add('active');
    } else if (currentDifficulty.name === 'FAST') {
        fastBtn.classList.add('active');
    } else if (currentDifficulty.name === 'INSANE') {
        insaneBtn.classList.add('active');
    }
}

// ========== CREATE HOLES ==========
function createHoles() {
    holesContainer.innerHTML = "";
    for (let i = 0; i < 9; i++) {
        const holeDiv = document.createElement("div");
        holeDiv.classList.add("hole", "empty");
        holeDiv.dataset.index = i;
        holeDiv.addEventListener("click", () => handleWhack(i));
        holesContainer.appendChild(holeDiv);
    }
    refreshWormVisual();
}

// ========== UPDATE HOLE VISUALS ==========
function refreshWormVisual() {
    for (let i = 0; i < 9; i++) {
        const hole = holesContainer.children[i];
        const hasWorm = (activeWormIndex === i);
        
        const existingWorm = hole.querySelector(".worm");
        if (existingWorm) existingWorm.remove();
        
        if (hasWorm && gameActive) {
            hole.classList.remove("empty");
            const wormDiv = document.createElement("div");
            wormDiv.classList.add("worm");
            wormDiv.innerHTML = "🐛";
            wormDiv.addEventListener("click", (e) => {
                e.stopPropagation();
                handleWhack(i);
            });
            hole.appendChild(wormDiv);
        } else {
            hole.classList.add("empty");
        }
    }
}

// ========== WHACK LOGIC ==========
function handleWhack(holeIndex) {
    if (!gameActive) {
        gameMsgDiv.innerHTML = `<span class="message-emoji">⏳</span><span class="message-text">Game over! Press RESET to play again</span>`;
        return;
    }
    
    if (activeWormIndex !== null && activeWormIndex === holeIndex) {
        // Success!
        score++;
        scoreSpan.innerText = score;
        gameSound.peck();
        
        // Peck animation
        const clickedHole = holesContainer.children[holeIndex];
        clickedHole.style.transform = "scale(0.92)";
        setTimeout(() => {
            if (clickedHole) clickedHole.style.transform = "";
        }, 100);
        
        // Clear the hide timeout if worm was whacked
        if (currentHideTimeout) {
            clearTimeout(currentHideTimeout);
            currentHideTimeout = null;
        }
        
        activeWormIndex = null;
        refreshWormVisual();
        
        gameMsgDiv.innerHTML = `<span class="message-emoji">🐔💥</span><span class="message-text">Whack! Worm smashed! +1 point</span>`;
        setTimeout(() => {
            if (gameActive) gameMsgDiv.innerHTML = `<span class="message-emoji">🐤</span><span class="message-text">Keep pecking! Worms are popping up!</span>`;
        }, 800);
        
        // High score check
        if (score > highScore) {
            highScore = score;
            bestSpan.innerText = highScore;
            localStorage.setItem("whackHighScore", highScore);
            gameSound.newHighScore();
            gameMsgDiv.innerHTML = `<span class="message-emoji">🏆</span><span class="message-text">NEW HIGH SCORE! Congratulations!</span>`;
            setTimeout(() => {
                if (gameActive) gameMsgDiv.innerHTML = `<span class="message-emoji">🐤</span><span class="message-text">Keep pecking! Worms are popping up!</span>`;
            }, 1500);
        }
    } else {
        // Miss
        gameSound.playBeep(220, 0.1, 0.15);
        if (activeWormIndex !== null) {
            gameMsgDiv.innerHTML = `<span class="message-emoji">😭</span><span class="message-text">Missed! The worm is somewhere else... Focus!</span>`;
        } else {
            gameMsgDiv.innerHTML = `<span class="message-emoji">🕳️</span><span class="message-text">No worm here... Wait for it!</span>`;
        }
        
        const wrongHole = holesContainer.children[holeIndex];
        wrongHole.style.transform = "translateX(3px)";
        setTimeout(() => {
            if (wrongHole) wrongHole.style.transform = "";
        }, 100);
    }
}

// ========== SPAWN WORM ==========
function spawnWorm() {
    if (!gameActive) return;
    if (activeWormIndex !== null) return;
    
    let randomHole = Math.floor(Math.random() * 9);
    activeWormIndex = randomHole;
    refreshWormVisual();
    gameSound.wormPop();
    
    // Auto-hide based on difficulty
    if (currentHideTimeout) {
        clearTimeout(currentHideTimeout);
    }
    currentHideTimeout = setTimeout(() => {
        if (gameActive && activeWormIndex === randomHole) {
            activeWormIndex = null;
            refreshWormVisual();
            gameMsgDiv.innerHTML = `<span class="message-emoji">🐛💨</span><span class="message-text">Worm dug away! Too slow!</span>`;
            setTimeout(() => {
                if (gameActive) gameMsgDiv.innerHTML = `<span class="message-emoji">🐤</span><span class="message-text">Peck fast! Worms are popping up!</span>`;
            }, 700);
            currentHideTimeout = null;
        }
    }, currentDifficulty.wormHideDelay);
}

// ========== GAME LOOP ==========
function restartGameLoop() {
    if (currentInterval) clearInterval(currentInterval);
    if (!gameActive) return;
    currentInterval = setInterval(() => spawnWorm(), currentDifficulty.spawnDelay);
}

// ========== TIMER ==========
function startTimer() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        if (!gameActive) return;
        if (timeLeft <= 1) {
            timeLeft = 0;
            timerSpan.innerText = "0";
            endGame();
        } else {
            timeLeft--;
            timerSpan.innerText = timeLeft;
        }
    }, 1000);
}

// ========== END GAME ==========
function endGame() {
    gameActive = false;
    if (currentInterval) clearInterval(currentInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    if (currentHideTimeout) clearTimeout(currentHideTimeout);
    activeWormIndex = null;
    refreshWormVisual();
    gameSound.gameOver();
    gameMsgDiv.innerHTML = `<span class="message-emoji">🐔💀</span><span class="message-text">GAME OVER! Score: ${score} | Best: ${highScore}. Press RESET.</span>`;
}

// ========== RESET GAME ==========
function resetGame() {
    // Kill all intervals and timeouts
    if (currentInterval) clearInterval(currentInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    if (currentHideTimeout) clearTimeout(currentHideTimeout);
    
    // Reset state with current difficulty
    gameActive = true;
    score = 0;
    timeLeft = 30;
    activeWormIndex = null;
    
    // Update UI
    scoreSpan.innerText = "0";
    timerSpan.innerText = "30";
    
    // Clear all worms visually
    refreshWormVisual();
    
    // Start fresh game loops
    startTimer();
    restartGameLoop();
    
    gameSound.reset();
    
    gameMsgDiv.innerHTML = `<span class="message-emoji">🐓✨</span><span class="message-text">Fresh start! Difficulty: ${currentDifficulty.name}. Peck worms!</span>`;
    
    // Reload high score from storage
    let storedBest = localStorage.getItem("whackHighScore");
    if (storedBest) highScore = parseInt(storedBest);
    else highScore = 0;
    bestSpan.innerText = highScore;
}

// ========== EVENT LISTENERS ==========
resetBtn.addEventListener("click", resetGame);
normalBtn.addEventListener("click", () => setDifficulty(Difficulty.NORMAL));
fastBtn.addEventListener("click", () => setDifficulty(Difficulty.FAST));
insaneBtn.addEventListener("click", () => setDifficulty(Difficulty.INSANE));

// ========== INITIALIZE ==========
function init() {
    createHoles();
    currentDifficulty = Difficulty.NORMAL;
    updateDifficultyUI();
    resetGame();
}

init();