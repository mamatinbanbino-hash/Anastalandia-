const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

let players = {};
let coins = [];
const questions = [
    { q: "Que signifie IP ?", a: "Internet Protocol" },
    { q: "Quel langage stylise les pages web ?", a: "CSS" },
    { q: "Quel outil utilises-tu pour hacker sur Android ?", a: "Termux" },
    { q: "Quel est le moteur de ce jeu ?", a: "Phaser" }
];
let currentQuestion = null;

function spawnCoins() {
    coins = [];
    for (let i = 0; i < 40; i++) {
        coins.push({ id: 'c' + i + Date.now(), x: Math.random() * 3800 + 100, y: Math.random() * 3800 + 100 });
    }
}
spawnCoins();

io.on('connection', (socket) => {
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            x: Math.random() * 500 + 200,
            y: Math.random() * 500 + 200,
            playerId: socket.id,
            username: data.username || "Anonyme",
            peerId: data.peerId,
            color: Math.random() * 0xffffff,
            score: data.score || 0
        };
        socket.emit('currentPlayers', players);
        socket.emit('itemUpdate', coins);
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    socket.on('playerMovement', (move) => {
        if (players[socket.id]) {
            players[socket.id].x = move.x;
            players[socket.id].y = move.y;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('coinCollected', (id) => {
        coins = coins.filter(c => c.id !== id);
        if (players[socket.id]) {
            players[socket.id].score += 5;
            io.emit('updateScore', { id: socket.id, score: players[socket.id].score });
        }
        if (coins.length < 5) spawnCoins();
        io.emit('itemUpdate', coins);
    });

    socket.on('triggerQuiz', () => {
        if (!currentQuestion) {
            currentQuestion = questions[Math.floor(Math.random() * questions.length)];
            io.emit('newChatMessage', { user: "SYSTEM", text: `❓ QUIZ : ${currentQuestion.q}` });
        }
    });

    socket.on('chatMessage', (msg) => {
        if (players[socket.id]) {
            if (currentQuestion && msg.toLowerCase() === currentQuestion.a.toLowerCase()) {
                players[socket.id].score += 20;
                io.emit('updateScore', { id: socket.id, score: players[socket.id].score });
                io.emit('newChatMessage', { user: "SYSTEM", text: `🎉 ${players[socket.id].username} a gagné !` });
                currentQuestion = null;
            } else {
                io.emit('newChatMessage', { user: players[socket.id].username, text: msg });
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Anastalandia Online'));
module.exports = app;
