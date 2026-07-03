/**
 * @jest-environment jsdom
 */

const {
    game, newGame, showScore, addTurn, lightsOn, showTurns, playerTurn,
    getInterval, getLightDuration, saveScore, topScores, loadScores,
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
    test("a lit button always goes dark before the next flash", () => {
        for (let score of [0, 5, 10, 50, 100]) {
            expect(getLightDuration(score)).toBeLessThan(getInterval(score));
        }
    });
});

describe("global leaderboard", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    test("saveScore records a player's result", () => {
        saveScore("Ada", 7);
        expect(loadScores()).toContainEqual({ name: "Ada", score: 7 });
    });
    test("a player keeps only their best score across replays", () => {
        saveScore("Ada", 3);
        saveScore("Ada", 9);
        saveScore("Ada", 5);
        let ada = loadScores().filter((s) => s.name === "Ada");
        expect(ada).toHaveLength(1);
        expect(ada[0].score).toBe(9);
    });
    test("a blank name is recorded as Anonymous and is never blocked", () => {
        saveScore("", 4);
        saveScore("   ", 6);
        let anon = loadScores().filter((s) => s.name === "Anonymous");
        expect(anon).toHaveLength(1);
        expect(anon[0].score).toBe(6);
    });
    test("topScores ranks all players high to low", () => {
        saveScore("Ada", 3);
        saveScore("Grace", 9);
        saveScore("Alan", 5);
        expect(topScores().map((s) => s.name)).toEqual(["Grace", "Alan", "Ada"]);
    });
    test("a wrong move saves the score to the global board", () => {
        game.playerName = "Grace";
        game.score = 4;
        game.currentGame = ["button1"];
        game.playerMoves = ["button2"];
        playerTurn();
        expect(loadScores()).toContainEqual({ name: "Grace", score: 4 });
    });
});