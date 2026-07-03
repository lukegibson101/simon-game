let game = {
    score: 0,
    currentGame: [],
    playerMoves: [],
    turnNumber: 0,
    lastButton: "",
    turnInProgress: false,
    playerName: "",
    choices: ["button1", "button2", "button3", "button4"],
};

const SCOREBOARD_KEY = "simonScoreboard";

// --- Difficulty --------------------------------------------------------------
// Playback speeds up as the score climbs, with a floor so it stays playable.
function getInterval(score) {
    return Math.max(400, 1000 - score * 60);
}

// --- Sound -------------------------------------------------------------------
// One tone per button via the Web Audio API — no audio files needed. Guarded so
// it silently no-ops where AudioContext is unavailable (e.g. jsdom/tests).
const TONES = { button1: 329.63, button2: 261.63, button3: 220.0, button4: 164.81 };
let audioCtx = null;

function audioContextClass() {
    return typeof AudioContext !== "undefined" ? AudioContext
        : typeof webkitAudioContext !== "undefined" ? webkitAudioContext
        : null;
}

// Browsers block audio until a user gesture. Called from the New game click so
// the computer's first playback (which runs on a timer) isn't silent.
function unlockAudio() {
    let Ctx = audioContextClass();
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended" && audioCtx.resume) audioCtx.resume();
}

function playSound(circ) {
    let Ctx = audioContextClass();
    if (!Ctx || !TONES[circ]) return;
    if (!audioCtx) audioCtx = new Ctx();
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = TONES[circ];
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
}

// --- Leaderboard -------------------------------------------------------------
// A single global, persistent board: one entry per player, holding their best
// score ever. Stored in localStorage so it survives reloads.
function loadScores() {
    try {
        return JSON.parse(localStorage.getItem(SCOREBOARD_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function saveScore(name, score) {
    let scores = loadScores();
    let player = (name || "Anonymous").trim() || "Anonymous";
    let existing = scores.find((s) => s.name === player);
    if (existing) {
        if (score > existing.score) existing.score = score;
    } else {
        scores.push({ name: player, score: score });
    }
    try {
        localStorage.setItem(SCOREBOARD_KEY, JSON.stringify(scores));
    } catch (e) {
        // storage unavailable (e.g. private browsing) — the score just won't persist
    }
    return scores;
}

function topScores(limit) {
    return loadScores()
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, limit || 10);
}

function clearScores() {
    try {
        localStorage.removeItem(SCOREBOARD_KEY);
    } catch (e) {
        // ignore
    }
    renderScoreboard();
}

function renderScoreboard() {
    let list = document.getElementById("scoreboard-list");
    if (!list) return;
    let rows = topScores();
    if (rows.length === 0) {
        list.innerHTML = '<li class="scoreboard-empty">No scores yet — be the first!</li>';
        return;
    }
    list.innerHTML = rows
        .map(
            (s, i) =>
                `<li><span class="rank">${i + 1}</span><span class="name">${escapeHtml(
                    s.name
                )}</span><span class="pts">${s.score}</span></li>`
        )
        .join("");
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
}

// --- Game flow ---------------------------------------------------------------
function newGame() {
    game.score = 0;
    game.currentGame = [];
    game.playerMoves = [];
    game.turnNumber = 0;
    game.lastButton = "";
    game.turnInProgress = true;

    let nameInput = document.getElementById("player-name");
    game.playerName = nameInput ? nameInput.value.trim() || "Anonymous" : "Anonymous";

    unlockAudio();

    for (let circle of document.getElementsByClassName("circle")) {
        if (circle.getAttribute("data-listener") !== "true") {
            circle.addEventListener("click", handlePlayerClick);
            circle.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handlePlayerClick(e);
                }
            });
            circle.setAttribute("data-listener", "true");
        }
    }
    renderScoreboard();
    showScore();
    addTurn();
}

function handlePlayerClick(e) {
    if (game.currentGame.length > 0 && !game.turnInProgress) {
        let move = e.currentTarget.getAttribute("id");
        game.lastButton = move;
        lightsOn(move);
        game.playerMoves.push(move);
        playerTurn();
    }
}

function addTurn() {
    game.playerMoves = [];
    game.currentGame.push(game.choices[Math.floor(Math.random() * 4)]);
    showTurns();
}

function showScore() {
    document.getElementById("score").innerText = game.score;
}

function lightsOn(circ) {
    document.getElementById(circ).classList.add("light");
    playSound(circ);
    setTimeout(() => {
        document.getElementById(circ).classList.remove("light");
    }, 400);
}

function showTurns() {
    game.turnInProgress = true;
    game.turnNumber = 0;
    let turns = setInterval(() => {
        lightsOn(game.currentGame[game.turnNumber]);
        game.turnNumber++;
        if (game.turnNumber >= game.currentGame.length) {
            clearInterval(turns);
            game.turnInProgress = false;
        }
    }, getInterval(game.score));
}

function playerTurn() {
    let i = game.playerMoves.length - 1;
    if (game.currentGame[i] === game.playerMoves[i]) {
        if (game.currentGame.length == game.playerMoves.length) {
            game.score++;
            showScore();
            game.turnInProgress = true;
            setTimeout(() => {
                addTurn();
            }, 1000);
        }
    } else {
        game.turnInProgress = true;
        saveScore(game.playerName, game.score);
        renderScoreboard();
        Swal.fire({
            icon: "error",
            position: "center",
            title: "Game over!",
            text: `${game.playerName} scored ${game.score}. Hit New game to play again.`,
        });
    }
}

if (typeof module !== "undefined") {
    module.exports = {
        game,
        newGame,
        showScore,
        addTurn,
        lightsOn,
        showTurns,
        playerTurn,
        handlePlayerClick,
        getInterval,
        loadScores,
        saveScore,
        topScores,
        clearScores,
        renderScoreboard,
    };
}
