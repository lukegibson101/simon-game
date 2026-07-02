let game = {
    score: 0,
    currentGame: [],
    playerMoves: [],
    turnNumber: 0,
    lastButton: "",
    turnInProgress: false,
    playerName: "",
    seedDate: "",
    mode: "daily",
    rng: null,
    choices: ["button1", "button2", "button3", "button4"],
};

const SCOREBOARD_KEY = "simonScoreboard";

// --- Deterministic daily sequence --------------------------------------------
// Everyone who plays on the same calendar day gets the identical sequence, so
// scores are directly comparable. The date string is hashed into a seed and fed
// to a small, fast PRNG (mulberry32).

function todayString(date) {
    let d = date || new Date();
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function hashSeed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// --- Difficulty --------------------------------------------------------------
// Playback speeds up as the score climbs, with a floor so it stays playable.
function getInterval(score) {
    return Math.max(400, 1000 - score * 60);
}

// --- Sound -------------------------------------------------------------------
// One tone per button via the Web Audio API — no audio files needed. Guarded so
// it silently no-ops in environments without AudioContext (e.g. jsdom/tests).
const TONES = { button1: 329.63, button2: 261.63, button3: 220.0, button4: 164.81 };
let audioCtx = null;

function playSound(circ) {
    let Ctx = typeof AudioContext !== "undefined" ? AudioContext
        : typeof webkitAudioContext !== "undefined" ? webkitAudioContext
        : null;
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

// --- Scoreboard (persisted in localStorage) ----------------------------------
function loadScores() {
    try {
        return JSON.parse(localStorage.getItem(SCOREBOARD_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function isDailyLocked(name, date) {
    let day = date || todayString();
    let player = (name || "Anonymous").trim() || "Anonymous";
    return loadScores().some((s) => s.name === player && s.date === day);
}

function saveScore(name, score, date) {
    let scores = loadScores();
    let day = date || todayString();
    let player = (name || "Anonymous").trim() || "Anonymous";
    // One recorded attempt per player per day: the first result stands. Because
    // the daily sequence is deterministic, replaying it must not be able to
    // inflate a score, so a second attempt on the same day is ignored.
    if (scores.some((s) => s.name === player && s.date === day)) return scores;
    scores.push({ name: player, score: score, date: day });
    localStorage.setItem(SCOREBOARD_KEY, JSON.stringify(scores));
    return scores;
}

function topScores(date, limit) {
    let day = date || todayString();
    return loadScores()
        .filter((s) => s.date === day)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit || 10);
}

// The persistent leaderboard: each player's best score across every day they
// have played, ranked high to low.
function bestPerPlayer(limit) {
    let best = {};
    for (let s of loadScores()) {
        if (!(s.name in best) || s.score > best[s.name].score) {
            best[s.name] = s;
        }
    }
    return Object.values(best)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit || 10);
}

function clearScores() {
    localStorage.removeItem(SCOREBOARD_KEY);
    renderScoreboard();
}

function renderScoreboard() {
    let list = document.getElementById("scoreboard-list");
    if (!list) return;
    let rows = bestPerPlayer();
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
// "daily"    — deterministic sequence shared by everyone that day; one recorded
//              attempt per player, posted to the leaderboard.
// "practice" — random sequence, unlimited replays, never saved.
function newGame() {
    startGame("daily");
}

function practiceGame() {
    startGame("practice");
}

function startGame(mode) {
    let requestedMode = mode === "practice" ? "practice" : "daily";
    let nameInput = document.getElementById("player-name");
    let name = nameInput ? nameInput.value.trim() || "Anonymous" : "Anonymous";
    let today = todayString();

    if (requestedMode === "daily" && isDailyLocked(name, today)) {
        if (typeof Swal !== "undefined") {
            Swal.fire({
                icon: "info",
                title: "Already played today",
                text: `${name} has already set a score on today's daily. Come back tomorrow, or switch to Practice.`,
            });
        }
        return;
    }

    game.mode = requestedMode;
    game.score = 0;
    game.currentGame = [];
    game.playerMoves = [];
    game.turnNumber = 0;
    game.lastButton = "";
    game.turnInProgress = true;
    game.playerName = name;
    game.seedDate = today;
    game.rng = requestedMode === "daily" ? mulberry32(hashSeed(today)) : null;

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
    let draw = game.rng ? game.rng() : Math.random();
    game.currentGame.push(game.choices[Math.floor(draw * 4)]);
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
        if (game.mode === "daily") {
            saveScore(game.playerName, game.score, game.seedDate);
            renderScoreboard();
            Swal.fire({
                icon: "error",
                position: "center",
                title: "Game over!",
                text: `${game.playerName} scored ${game.score} on the ${game.seedDate} daily. That's your run for today — hit Practice to keep playing.`,
            });
        } else {
            Swal.fire({
                icon: "error",
                position: "center",
                title: "Game over!",
                text: `Practice run: ${game.score}. Not saved to the leaderboard — take the Daily challenge for the real thing.`,
            });
        }
    }
}

if (typeof module !== "undefined") {
    module.exports = {
        game,
        newGame,
        practiceGame,
        startGame,
        showScore,
        addTurn,
        lightsOn,
        showTurns,
        playerTurn,
        handlePlayerClick,
        getInterval,
        hashSeed,
        mulberry32,
        todayString,
        loadScores,
        saveScore,
        isDailyLocked,
        topScores,
        bestPerPlayer,
        clearScores,
        renderScoreboard,
    };
}
