const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

const players = {};
const questions = [
    { q: "Quel port utilise le protocole HTTP ?", a: "80" },
    { q: "Que signifie IP ?", a: "Internet Protocol" },
    { q: "Quel langage stylise les pages web ?", a: "CSS" },
    { q: "Quel outil utilises-tu pour hacker sur Android ?", a: "Termux" },
    { q: "Quel est le moteur de ce jeu ?", a: "Phaser" }
];
let currentQuestion = null;

// Messages automatiques
setInterval(() => {
    io.emit('newChatMessage', { user: "SYSTEM", text: "💡 Conseil: Utilise la touche ESPACE pour un Boost de vitesse !" });
}, 120000);

io.on('connection', (socket) => {
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            x: Math.floor(Math.random() * 800) + 200,
            y: Math.floor(Math.random() * 800) + 200,
            playerId: socket.id,
            username: data.username || "Anonyme",
            peerId: data.peerId,
            color: Math.random() * 0xffffff,
            score: 0
        };
        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', players[socket.id]);
        io.emit('newChatMessage', { user: "SYSTEM", text: `🌍 ${players[socket.id].username} vient d'entrer dans Anastalandia !` });
    });

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
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
                players[socket.id].score += 10;
                io.emit('newChatMessage', { user: "SYSTEM", text: `🏆 Correct ! ${players[socket.id].username} gagne 10 pts.` });
                io.emit('updateScore', { id: socket.id, score: players[socket.id].score });
                currentQuestion = null;
            } else {
                io.emit('newChatMessage', { user: players[socket.id].username, text: msg });
            }
        }
    });

    socket.on('disconnect', () => {
        if(players[socket.id]) io.emit('newChatMessage', { user: "SYSTEM", text: `👋 ${players[socket.id].username} est parti.` });
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => { console.log('Anastalandia Online'); });
module.exports = app;
