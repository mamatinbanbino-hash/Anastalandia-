const config = {
    type: Phaser.AUTO,
    width: window.innerWidth, height: window.innerHeight,
    backgroundColor: '#020617',
    physics: { default: 'arcade' },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);
let socket, myPeer, myStream, player, cursors, keySpace;
let otherPlayers = {}, audioElements = {}, scoreBoard = {};

function preload() {
    this.load.image('ground', 'https://labs.phaser.io/assets/skies/space3.png');
    this.load.image('ship', 'https://labs.phaser.io/assets/sprites/ship.png');
    this.load.image('coin', 'https://labs.phaser.io/assets/sprites/apple.png');
}

async function create() {
    const self = this;
    socket = io();
    this.otherPlayersGroup = this.physics.add.group();
    this.coinsGroup = this.physics.add.group();

    const name = prompt("Pseudo :") || "Player";
    const savedScore = parseInt(localStorage.getItem('ana_score')) || 0;

    myPeer = new Peer();
    myPeer.on('open', id => {
        socket.emit('joinGame', { username: name, peerId: id, score: savedScore });
    });

    myPeer.on('call', call => {
        call.answer(myStream);
        call.on('stream', s => setupAudio(call.peer, s));
    });

    // Monde et Caméra
    this.add.tileSprite(0, 0, 8000, 8000, 'ground').setOrigin(0, 0);
    this.physics.world.setBounds(0, 0, 4000, 4000);
    this.cameras.main.setBounds(0, 0, 4000, 4000);

    // Mini-map
    this.minimap = this.cameras.add(10, 10, 100, 100).setZoom(0.05).setName('mini');
    this.minimap.setBackgroundColor(0x000000);

    socket.on('currentPlayers', players => {
        Object.keys(players).forEach(id => {
            scoreBoard[id] = players[id];
            if (id === socket.id) addPlayer(self, players[id]);
            else addOtherPlayers(self, players[id]);
        });
        updateLeaderboard();
    });

    socket.on('itemUpdate', coins => {
        self.coinsGroup.clear(true, true);
        coins.forEach(c => {
            self.coinsGroup.create(c.x, c.y, 'coin').setScale(0.7).coinId = c.id;
        });
    });

    socket.on('playerMoved', info => {
        if (otherPlayers[info.playerId]) {
            otherPlayers[info.playerId].setPosition(info.x, info.y);
            otherPlayers[info.playerId].text.setPosition(info.x, info.y - 45);
            updateAudioProximity(otherPlayers[info.playerId]);
        }
    });

    socket.on('updateScore', data => {
        if (scoreBoard[data.id]) {
            scoreBoard[data.id].score = data.score;
            if (data.id === socket.id) localStorage.setItem('ana_score', data.score);
            updateLeaderboard();
        }
    });

    socket.on('playerDisconnected', id => {
        if (otherPlayers[id]) { otherPlayers[id].text.destroy(); otherPlayers[id].destroy(); delete otherPlayers[id]; }
        delete scoreBoard[id]; updateLeaderboard();
    });

    socket.on('newChatMessage', d => {
        const chat = document.getElementById('chat');
        chat.innerHTML += `<div><b>${d.user}:</b> ${d.text}</div>`;
        chat.scrollTop = chat.scrollHeight;
    });

    cursors = this.input.keyboard.createCursorKeys();
    keySpace = this.input.keyboard.addKey('SPACE');

    // Support Tactile (Cliquer à gauche/droite pour bouger)
    this.input.on('pointerdown', (pointer) => {
        if (pointer.x < window.innerWidth / 2) self.touchLeft = true;
        else self.touchRight = true;
    });
    this.input.on('pointerup', () => { self.touchLeft = false; self.touchRight = false; });
}

function update() {
    if (player) {
        let speed = (keySpace.isDown) ? 600 : 300;
        player.body.setVelocity(0);

        if (cursors.left.isDown || this.touchLeft) player.body.setVelocityX(-speed);
        else if (cursors.right.isDown || this.touchRight) player.body.setVelocityX(speed);
        
        if (cursors.up.isDown) player.body.setVelocityY(-speed);
        else if (cursors.down.isDown) player.body.setVelocityY(speed);

        player.text.setPosition(player.x, player.y - 45);
        if (player.x !== player.oldX || player.y !== player.oldY) {
            socket.emit('playerMovement', { x: player.x, y: player.y });
            player.oldX = player.x; player.oldY = player.y;
        }
        this.minimap.scrollX = player.x; this.minimap.scrollY = player.y;
    }
}

function addPlayer(self, info) {
    player = self.physics.add.sprite(info.x, info.y, 'ship').setTint(info.color).setDisplaySize(45, 45);
    player.body.setCollideWorldBounds(true);
    player.text = self.add.text(info.x, info.y - 45, info.username, { fontSize: '14px', fill: '#fff' }).setOrigin(0.5);
    self.cameras.main.startFollow(player, true, 0.1, 0.1);
    self.physics.add.overlap(player, self.coinsGroup, (p, c) => {
        socket.emit('coinCollected', c.coinId); c.destroy();
    });
}

function addOtherPlayers(self, info) {
    const other = self.physics.add.sprite(info.x, info.y, 'ship').setTint(info.color).setDisplaySize(45, 45);
    other.playerId = info.playerId; other.peerId = info.peerId;
    other.text = self.add.text(info.x, info.y - 45, info.username, { fontSize: '14px', fill: '#ccc' }).setOrigin(0.5);
    otherPlayers[info.playerId] = other;
}

// AUDIO
window.toggleMic = async () => {
    try {
        myStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        document.getElementById('mic-btn').innerHTML = "🎤 MICRO ON";
        document.getElementById('mic-btn').style.background = "#22c55e";
        Object.values(scoreBoard).forEach(p => { if(p.peerId && p.peerId !== myPeer.id) callPeer(p.peerId); });
    } catch(e) { alert("Micro requis !"); }
};

function callPeer(pid) {
    const call = myPeer.call(pid, myStream);
    call.on('stream', s => setupAudio(pid, s));
}

function setupAudio(pid, s) {
    if (!audioElements[pid]) {
        const a = new Audio(); a.srcObject = s; a.play(); audioElements[pid] = a;
    }
}

function updateAudioProximity(other) {
    if (!player || !audioElements[other.peerId]) return;
    const d = Phaser.Math.Distance.Between(player.x, player.y, other.x, other.y);
    audioElements[other.peerId].volume = Math.max(0, 1 - (d / 1000));
}

function updateLeaderboard() {
    const s = Object.values(scoreBoard).sort((a,b) => b.score - a.score);
    document.getElementById('score-list').innerHTML = s.map(p => `${p.name}: ${p.score}`).join(' | ');
}

window.sendMessage = () => {
    const i = document.getElementById('m');
    if (i.value) { socket.emit('chatMessage', i.value); i.value = ''; }
};
