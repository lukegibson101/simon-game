/**
 * @jest-environment jsdom
 */

const {
    game, newGame, practiceGame, showScore, addTurn, lightsOn, showTurns, playerTurn,
    getInterval, hashSeed, mulberry32, saveScore, isDailyLocked, topScores, bestPerPlayer, loadScores,
} = require("../game");

global.Swal = { fire: jest.fn(() => new Promise(() => { })) };

beforeAll(() => {
    let fs = require("fs");
    let fileContents = fs.readFileSync("index.html", "utf-8");
    document.open();
    document.write(fileContents);
    document.close();
    localStorage.clear();
});

describe("game object contains correct keys", () => {
    test("score key exists", () => {
        expect("score" in game).toBe(true);
    });
    test("currentGame key exists", () => {
        expect("currentGame" in game).toBe(true);
    });
    test("playerMoves key exists", () => {
        expect("playerMoves" in game).toBe(true);
    });
    test("choices key exists", () => {
        expect("choices" in game).toBe(true);
    });
    test("choices contain the correct ids", () => {
        expect(game.choices).toEqual(["button1", "button2", "button3", "button4"]);
    });
    test("turnNumber key exists", () => {
        expect("turnNumber" in game).toBe(true);
    });
    test("lastButton key exists", () => {
        expect("lastButton" in game).toBe(true);
    });
    test("turnInProgress key exists", () => {
        expect("turnInProgress" in game).toBe(true);
    });
    test("turnInProgress key value is false", () => {
        expect(game.turnInProgress).toBe(false);
    });
});

describe("newGame works correctly", () => {
    beforeAll(() => {
        game.score = 42;
        game.playerMoves = ["button1", "button2"];
        game.currentGame = ["button1", "button2"];
        document.getElementById("score").innerText = "42";
        game.turnNumber = 42;
        newGame();
    })
    test("should set game score to zero", () => {
        expect(game.score).toEqual(0);
    });
    test("should clear the playerMoves array", () => {
        expect(game.playerMoves.length).toBe(0);
    });
    test("should be one element in the computers array", () => {
        expect(game.currentGame.length).toBe(1);
    });    
    test("should display 0 for element with ID of score", () => {
        expect(document.getElementById("score").innerText).toEqual(0);
    });
    test("should set turnNumber to 0", () => {
        expect(game.turnNumber).toEqual(0);
    }); 
    test("expect data-listener to be true", () => {
        const elements = document.getElementsByClassName("circle");
        for (let element of elements) {
            expect(element.getAttribute("data-listener")).toEqual("true");
        };
    }); 
});

describe("gameplay works correctly", () => {
    beforeEach(() => {
        game.score = 0;
        game.currentGame = [];
        game.playerMoves = [];
        addTurn();
    });
    afterEach(() => {
        game.score = 0;
        game.currentGame = [];
        game.playerMoves = [];
    });
    test("Add turn adds a new turn to the game", () => {
        addTurn();
        expect(game.currentGame.length).toBe(2);
    });
    test("should add correct class to light up the buttons", () => {
        let button = document.getElementById(game.currentGame[0]);
        lightsOn(game.currentGame[0]);
        expect(button.classList).toContain("light");
    });
    test("showTurns should update game.turnNumber", () => {
        game.turnNumber = 42;
        showTurns();
        expect(game.turnNumber).toBe(0);
    });
    test("should increment the score if the turn is correct", () => {
        game.playerMoves.push(game.currentGame[0]);
        playerTurn();
        expect(game.score).toBe(1);
    });
    test("should call Swal.fire if the move is wrong", () => {
        game.playerMoves.push("wrong");
        playerTurn();
        expect(Swal.fire).toHaveBeenCalled();
    });
    test("should block clicks in the pause before the next sequence plays", () => {
        game.playerMoves.push(game.currentGame[0]);
        playerTurn();
        expect(game.turnInProgress).toBe(true);
    });
    test("should toggle  turnInProgress to true", () => {
        showTurns();
        expect(game.turnInProgress).toBe(true);
    });
    test("clicking during the computer sequence should fail", () => {
        showTurns();
        game.lastButton = "";
        document.getElementById("button2").click();
        expect(game.lastButton).toEqual("");
    });
});

describe("daily seed produces a deterministic sequence", () => {
    test("the same date yields the same seed", () => {
        expect(hashSeed("2026-07-03")).toBe(hashSeed("2026-07-03"));
    });
    test("different dates yield different seeds", () => {
        expect(hashSeed("2026-07-03")).not.toBe(hashSeed("2026-07-04"));
    });
    test("a seeded generator replays the same numbers", () => {
        let a = mulberry32(hashSeed("2026-07-03"));
        let b = mulberry32(hashSeed("2026-07-03"));
        let seqA = [a(), a(), a(), a(), a()];
        let seqB = [b(), b(), b(), b(), b()];
        expect(seqA).toEqual(seqB);
    });
    test("two players share the same daily sequence", () => {
        let seed = hashSeed("2026-07-03");
        let build = () => {
            let rng = mulberry32(seed);
            return Array.from({ length: 8 }, () => game.choices[Math.floor(rng() * 4)]);
        };
        expect(build()).toEqual(build());
    });
});

describe("difficulty ramp", () => {
    test("playback is 1000ms at the start", () => {
        expect(getInterval(0)).toBe(1000);
    });
    test("playback speeds up as the score climbs", () => {
        expect(getInterval(5)).toBeLessThan(getInterval(0));
    });
    test("playback never drops below the 400ms floor", () => {
        expect(getInterval(100)).toBe(400);
    });
});

describe("scoreboard and anti-cheat", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    test("saveScore records a player's result", () => {
        saveScore("Ada", 7, "2026-07-03");
        expect(loadScores()).toContainEqual({ name: "Ada", score: 7, date: "2026-07-03" });
    });
    test("a second attempt on the same day is ignored (one shot)", () => {
        saveScore("Ada", 3, "2026-07-03");
        saveScore("Ada", 99, "2026-07-03");
        let ada = loadScores().filter((s) => s.name === "Ada" && s.date === "2026-07-03");
        expect(ada).toHaveLength(1);
        expect(ada[0].score).toBe(3);
    });
    test("isDailyLocked reports when a player has already played", () => {
        expect(isDailyLocked("Ada", "2026-07-03")).toBe(false);
        saveScore("Ada", 3, "2026-07-03");
        expect(isDailyLocked("Ada", "2026-07-03")).toBe(true);
    });
    test("the same name can play again on a different day", () => {
        saveScore("Ada", 3, "2026-07-03");
        expect(isDailyLocked("Ada", "2026-07-04")).toBe(false);
    });
    test("topScores returns a single day's entries ranked high to low", () => {
        saveScore("Ada", 3, "2026-07-03");
        saveScore("Grace", 9, "2026-07-03");
        saveScore("Alan", 5, "2026-07-03");
        saveScore("Old", 100, "2020-01-01");
        let top = topScores("2026-07-03");
        expect(top.map((s) => s.name)).toEqual(["Grace", "Alan", "Ada"]);
    });
    test("bestPerPlayer persists across days and keeps each player's best", () => {
        saveScore("Ada", 3, "2026-07-03");
        saveScore("Ada", 8, "2026-07-04"); // Ada's better run on a later day
        saveScore("Grace", 9, "2026-07-03");
        let board = bestPerPlayer();
        expect(board.map((s) => [s.name, s.score])).toEqual([
            ["Grace", 9],
            ["Ada", 8],
        ]);
    });
    test("practice runs are not saved to the leaderboard", () => {
        game.mode = "practice";
        game.playerName = "Cheater";
        game.seedDate = "2026-07-03";
        game.currentGame = ["button1"];
        game.playerMoves = ["button2"];
        playerTurn();
        expect(loadScores()).toHaveLength(0);
    });
});