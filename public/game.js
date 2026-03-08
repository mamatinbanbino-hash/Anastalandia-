const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1e293b',
    physics: { default: 'arcade' },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);
let socket;

function preload() {}

function create() {
    socket = io();
    this.otherPlayers = this.physics.add.group();

    socket.on('currentPlayers', (players) => {
        Object.keys(players).forEach((id) => {
            if (id === socket.id) addPlayer(this, players[id]);
            else addOtherPlayers(this, players[id]);
        });
    });

    socket.on('newPlayer', (info) => addOtherPlayers(this, info));
    
    socket.on('playerMoved', (info) => {
        this.otherPlayers.getChildren().forEach(p => {
            if (info.playerId === p.playerId) p.setPosition(info.x, info.y);
        });
    });

    socket.on('playerDisconnected', (id) => {
        this.otherPlayers.getChildren().forEach(p => {
            if (id === p.playerId) p.destroy();
        });
    });

    socket.on('newChatMessage', (data) => {
        const msgDiv = document.getElementById('chat');
        msgDiv.innerHTML += `<div><b>${data.id.substring(0,4)}:</b> ${data.text}</div>`;
        msgDiv.scrollTop = msgDiv.scrollHeight;
    });

    this.cursors = this.input.keyboard.createCursorKeys();
}

function update() {
    if (this.player) {
        this.player.body.setVelocity(0);
        if (this.cursors.left.isDown) this.player.body.setVelocityX(-200);
        else if (this.cursors.right.isDown) this.player.body.setVelocityX(200);
        if (this.cursors.up.isDown) this.player.body.setVelocityY(-200);
        else if (this.cursors.down.isDown) this.player.body.setVelocityY(200);

        if (this.player.oldX !== this.player.x || this.player.oldY !== this.player.y) {
            socket.emit('playerMovement', { x: this.player.x, y: this.player.y });
        }
        this.player.oldX = this.player.x; this.player.oldY = this.player.y;
    }
}

function addPlayer(self, info) {
    self.player = self.add.rectangle(info.x, info.y, 30, 30, info.color);
    self.physics.add.existing(self.player);
    self.player.body.setCollideWorldBounds(true);
}

function addOtherPlayers(self, info) {
    const other = self.add.rectangle(info.x, info.y, 30, 30, info.color);
    other.playerId = info.playerId;
    self.otherPlayers.add(other);
}

function sendMessage() {
    const input = document.getElementById('m');
    if (input.value) {
        socket.emit('chatMessage', input.value);
        input.value = '';
    }
}
