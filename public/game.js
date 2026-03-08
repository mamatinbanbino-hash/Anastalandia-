const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#0f172a',
    physics: { 
        default: 'arcade',
        arcade: { debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);
let socket;
let scoreBoard = {};

function preload() {}

function create() {
    socket = io();
    this.otherPlayers = this.add.group();

    const myName = prompt("Bienvenue à Anastalandia ! Ton pseudo :") || "Player";
    socket.emit('joinGame', myName);

    // --- DÉCOR ET OBSTACLES ---
    this.platforms = this.physics.add.staticGroup();
    this.platforms.add(this.add.rectangle(400, 300, 250, 40, 0x475569)); // Mur central

    // Portail doré interactif
    this.portal = this.add.rectangle(window.innerWidth - 100, 100, 60, 60, 0xfacc15);
    this.physics.add.existing(this.portal, true);
    this.tweens.add({ targets: this.portal, angle: 360, duration: 4000, repeat: -1 });

    // --- RÉCEPTION DES DONNÉES ---
    socket.on('currentPlayers', (players) => {
        Object.keys(players).forEach((id) => {
            scoreBoard[id] = { name: players[id].username, score: players[id].score };
            if (id === socket.id) addPlayer(this, players[id]);
            else addOtherPlayers(this, players[id]);
        });
        updateLeaderboard();
    });

    socket.on('newPlayer', (info) => {
        addOtherPlayers(this, info);
        scoreBoard[info.playerId] = { name: info.username, score: 0 };
        updateLeaderboard();
    });

    socket.on('updateScore', (data) => {
        if (scoreBoard[data.id]) {
            scoreBoard[data.id].score = data.score;
            updateLeaderboard();
        }
    });

    socket.on('playerMoved', (info) => {
        this.otherPlayers.getChildren().forEach(p => {
            if (info.playerId === p.playerId) {
                p.setPosition(info.x, info.y);
                p.userNameText.setPosition(info.x, info.y - 30);
            }
        });
    });

    socket.on('playerDisconnected', (id) => {
        this.otherPlayers.getChildren().forEach(p => {
            if (id === p.playerId) { 
                p.userNameText.destroy(); 
                p.destroy(); 
            }
        });
        delete scoreBoard[id];
        updateLeaderboard();
    });

    socket.on('newChatMessage', (data) => {
        const chat = document.getElementById('chat');
        if(chat) {
            chat.innerHTML += `<div><strong>${data.user}:</strong> ${data.text}</div>`;
            chat.scrollTop = chat.scrollHeight;
        }
    });

    this.cursors = this.input.keyboard.createCursorKeys();
}

function update() {
    if (this.player) {
        this.player.body.setVelocity(0);
        const speed = 250;

        if (this.cursors.left.isDown) this.player.body.setVelocityX(-speed);
        else if (this.cursors.right.isDown) this.player.body.setVelocityX(speed);
        
        if (this.cursors.up.isDown) this.player.body.setVelocityY(-speed);
        else if (this.cursors.down.isDown) this.player.body.setVelocityY(speed);

        this.playerText.setPosition(this.player.x, this.player.y - 30);

        if (this.player.oldX !== this.player.x || this.player.oldY !== this.player.y) {
            socket.emit('playerMovement', { x: this.player.x, y: this.player.y });
        }
        this.player.oldX = this.player.x;
        this.player.oldY = this.player.y;
    }
}

function addPlayer(self, info) {
    self.player = self.add.rectangle(info.x, info.y, 35, 35, info.color);
    self.physics.add.existing(self.player);
    self.player.body.setCollideWorldBounds(true);
    self.physics.add.collider(self.player, self.platforms);
    
    // Interaction avec le portail
    self.physics.add.overlap(self.player, self.portal, () => {
        if (!self.isLock) {
            self.isLock = true;
            socket.emit('triggerQuiz');
            self.cameras.main.flash(500);
            setTimeout(() => { self.isLock = false; }, 5000);
        }
    });

    self.playerText = self.add.text(info.x, info.y - 30, info.username, { 
        fontSize: '14px', fill: '#ffffff', backgroundColor: '#00000088'
    }).setOrigin(0.5);
}

function addOtherPlayers(self, info) {
    const other = self.add.rectangle(info.x, info.y, 35, 35, info.color);
    other.playerId = info.playerId;
    self.physics.add.existing(other);
    
    other.userNameText = self.add.text(info.x, info.y - 30, info.username, { 
        fontSize: '14px', fill: '#cbd5e1'
    }).setOrigin(0.5);
    
    self.otherPlayers.add(other);
}

function updateLeaderboard() {
    const list = document.getElementById('score-list');
    if (!list) return;
    const sorted = Object.values(scoreBoard).sort((a,b) => b.score - a.score);
    list.innerHTML = sorted.map(p => `${p.name}: ${p.score}`).join(' | ');
}

// Global pour le bouton HTML
window.sendMessage = () => {
    const input = document.getElementById('m');
    if (input.value) {
        socket.emit('chatMessage', input.value);
        input.value = '';
    }
};
