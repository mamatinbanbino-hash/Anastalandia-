const config = {
    type: Phaser.AUTO,
    width: window.innerWidth, height: window.innerHeight,
    backgroundColor: '#020617',
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);
let socket, myPeer, myStream;
let scoreBoard = {}, audioElements = {};

function preload() {
    this.load.image('ground', 'https://labs.phaser.io/assets/skies/space3.png');
    this.load.image('playerIcon', 'https://labs.phaser.io/assets/sprites/ship.png');
    this.load.image('flare', 'https://labs.phaser.io/assets/particles/blue.png');
}

async function create() {
    socket = io();
    this.otherPlayers = this.add.group();

    myPeer = new Peer();
    myPeer.on('open', (id) => {
        const myName = prompt("Prêt pour Anastalandia ? Pseudo :") || "Player";
        socket.emit('joinGame', { username: myName, peerId: id });
    });

    myPeer.on('call', (call) => {
        call.answer(myStream);
        call.on('stream', (stream) => { setupAudio(call.peer, stream); });
    });

    // 1. MONDE
    this.add.tileSprite(0, 0, 8000, 8000, 'ground').setOrigin(0, 0);
    this.physics.world.setBounds(0, 0, 4000, 4000);

    this.platforms = this.physics.add.staticGroup();
    this.platforms.add(this.add.rectangle(600, 400, 300, 40, 0x475569));
    this.portal = this.add.rectangle(1200, 300, 100, 100, 0xfacc15);
    this.physics.add.existing(this.portal, true);
    this.tweens.add({ targets: this.portal, alpha: 0.5, duration: 1000, yoyo: true, repeat: -1 });

    // 2. SOCKETS
    socket.on('currentPlayers', (players) => {
        Object.keys(players).forEach((id) => {
            scoreBoard[id] = { name: players[id].username, score: players[id].score, peerId: players[id].peerId };
            if (id === socket.id) addPlayer(this, players[id]);
            else { addOtherPlayers(this, players[id]); if (myStream) callPeer(players[id].peerId); }
        });
        updateLeaderboard();
    });

    socket.on('newPlayer', (info) => {
        addOtherPlayers(this, info);
        scoreBoard[info.playerId] = { name: info.username, score: 0, peerId: info.peerId };
        if (myStream) callPeer(info.peerId);
        updateLeaderboard();
    });

    socket.on('playerMoved', (info) => {
        this.otherPlayers.getChildren().forEach(p => {
            if (info.playerId === p.playerId) {
                p.setPosition(info.x, info.y);
                p.userNameText.setPosition(info.x, info.y - 45);
                updateAudioVolume(p);
            }
        });
    });

    socket.on('updateScore', (data) => { if (scoreBoard[data.id]) { scoreBoard[data.id].score = data.score; updateLeaderboard(); } });

    socket.on('playerDisconnected', (id) => {
        this.otherPlayers.getChildren().forEach(p => { if (id === p.playerId) { p.userNameText.destroy(); p.emitter.stop(); p.destroy(); } });
        delete scoreBoard[id]; updateLeaderboard();
    });

    socket.on('newChatMessage', (data) => {
        const chat = document.getElementById('chat');
        chat.innerHTML += `<div><strong>${data.user}:</strong> ${data.text}</div>`;
        chat.scrollTop = chat.scrollHeight;
    });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyEspace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
}

function update() {
    if (this.player) {
        let speed = this.keyEspace.isDown ? 600 : 300;
        this.player.body.setVelocity(0);

        if (this.cursors.left.isDown) { this.player.body.setVelocityX(-speed); this.player.angle = -90; }
        else if (this.cursors.right.isDown) { this.player.body.setVelocityX(speed); this.player.angle = 90; }
        if (this.cursors.up.isDown) { this.player.body.setVelocityY(-speed); this.player.angle = 0; }
        else if (this.cursors.down.isDown) { this.player.body.setVelocityY(speed); this.player.angle = 180; }

        this.playerText.setPosition(this.player.x, this.player.y - 45);
        if (this.player.oldX !== this.player.x || this.player.oldY !== this.player.y) {
            socket.emit('playerMovement', { x: this.player.x, y: this.player.y });
            this.emitter.emitParticle(1);
        }
        this.player.oldX = this.player.x; this.player.oldY = this.player.y;
    }
}

// AUDIO
window.toggleMic = async () => {
    if (!myStream) {
        myStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        document.getElementById('mic-btn').style.background = "#22c55e";
        Object.values(scoreBoard).forEach(p => { if(p.peerId && p.peerId !== myPeer.id) callPeer(p.peerId); });
    }
};

function callPeer(peerId) {
    const call = myPeer.call(peerId, myStream);
    call.on('stream', (stream) => { setupAudio(peerId, stream); });
}

function setupAudio(peerId, stream) {
    if (!audioElements[peerId]) {
        const audio = new Audio();
        audio.srcObject = stream; audio.play();
        audioElements[peerId] = audio;
    }
}

function updateAudioVolume(other) {
    if (!game.scene.scenes[0].player || !audioElements[other.peerId]) return;
    const dist = Phaser.Math.Distance.Between(game.scene.scenes[0].player.x, game.scene.scenes[0].player.y, other.x, other.y);
    const pan = (other.x - game.scene.scenes[0].player.x) / 500;
    audioElements[other.peerId].volume = Math.max(0, 1 - (dist / 800));
}

// HELPERS
function addPlayer(self, info) {
    self.player = self.physics.add.sprite(info.x, info.y, 'playerIcon').setDisplaySize(50, 50).setTint(info.color);
    self.player.body.setCollideWorldBounds(true);
    self.cameras.main.startFollow(self.player, true, 0.1, 0.1);
    self.cameras.main.setBounds(0, 0, 4000, 4000);
    self.physics.add.collider(self.player, self.platforms);
    self.physics.add.overlap(self.player, self.portal, () => {
        if (!self.isLock) { self.isLock = true; socket.emit('triggerQuiz'); self.cameras.main.flash(400); setTimeout(() => self.isLock = false, 5000); }
    });
    self.playerText = self.add.text(info.x, info.y - 45, info.username, { fontSize: '16px', fill: '#fff', backgroundColor: '#000000aa' }).setOrigin(0.5);
    
    // Particules
    const particles = self.add.particles('flare');
    self.emitter = particles.createEmitter({ speed: 100, scale: { start: 0.4, end: 0 }, blendMode: 'ADD', follow: self.player });
}

function addOtherPlayers(self, info) {
    const other = self.physics.add.sprite(info.x, info.y, 'playerIcon').setDisplaySize(50, 50).setTint(info.color);
    other.playerId = info.playerId; other.peerId = info.peerId;
    other.userNameText = self.add.text(info.x, info.y - 45, info.username, { fontSize: '16px', fill: '#cbd5e1' }).setOrigin(0.5);
    const part = self.add.particles('flare');
    other.emitter = part.createEmitter({ speed: 100, scale: { start: 0.4, end: 0 }, blendMode: 'ADD', follow: other });
    self.otherPlayers.add(other);
}

function updateLeaderboard() {
    const sorted = Object.values(scoreBoard).sort((a,b) => b.score - a.score);
    document.getElementById('score-list').innerHTML = sorted.map(p => `${p.name}: ${p.score}`).join(' | ');
}

window.sendMessage = () => {
    const input = document.getElementById('m');
    if (input.value) { socket.emit('chatMessage', input.value); input.value = ''; }
};
