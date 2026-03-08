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

io.on('connection', (socket) => {
    // Un joueur rejoint le lobby
    socket.on('joinGame', (username) => {
        players[socket.id] = {
            x: Math.floor(Math.random() * 500) + 50,
            y: Math.floor(Math.random() * 400) + 50,
            playerId: socket.id,
            username: username || "Anonyme",
            color: Math.random() * 0xffffff,
            score: 0
        };
        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    // Synchronisation des mouvements
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Déclenchement du Quiz via le portail
    socket.on('triggerQuiz', () => {
        if (!currentQuestion) {
            currentQuestion = questions[Math.floor(Math.random() * questions.length)];
            io.emit('newChatMessage', { user: "SYSTEM", text: `❓ QUESTION : ${currentQuestion.q}` });
        }
    });

    // Gestion du Chat et des Réponses au Quiz
    socket.on('chatMessage', (msg) => {
        if (players[socket.id]) {
            if (currentQuestion && msg.toLowerCase() === currentQuestion.a.toLowerCase()) {
                players[socket.id].score += 10;
                io.emit('newChatMessage', { user: "SYSTEM", text: `🎉 ${players[socket.id].username} a trouvé ! La réponse était : ${currentQuestion.a}` });
                io.emit('updateScore', { id: socket.id, score: players[socket.id].score });
                currentQuestion = null; // Prêt pour la prochaine question
            } else {
                io.emit('newChatMessage', { user: players[socket.id].username, text: msg });
            }
        }
    });

    // Déconnexion
    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => { console.log('Anastalandia Online sur le port ' + PORT); });
module.exports = app;
