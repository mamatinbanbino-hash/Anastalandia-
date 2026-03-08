const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

const players = {};

io.on('connection', (socket) => {
    // Le joueur rejoint avec un pseudo
    socket.on('joinGame', (username) => {
        players[socket.id] = {
            x: Math.floor(Math.random() * 500) + 50,
            y: Math.floor(Math.random() * 400) + 50,
            playerId: socket.id,
            username: username || "Anonyme",
            color: Math.random() * 0xffffff
        };
        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('chatMessage', (msg) => {
        if (players[socket.id]) {
            io.emit('newChatMessage', { 
                user: players[socket.id].username, 
                text: msg 
            });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => { console.log('Anastalandia Server Ready'); });

module.exports = app;
