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

function preload() {}

function create() {
    socket = io();
    this.otherPlayers = this.add.group();

    // 1. Demander le pseudo
    const myName = prompt("Bienvenue à Anastalandia ! Ton pseudo :") || "Joueur";
    socket.emit('joinGame', myName);

    // 2. Créer le décor (Murs et Portail)
    this.platforms = this.physics.add.staticGroup();
    // Mur central
    let wall = this.add.rectangle(400, 300, 250, 40, 0x475569);
    this.platforms.add(wall);

    // Portail doré
    this.portal = this.add.rectangle(700, 150, 60, 60, 0xfacc15);
    this.physics.add.existing(this.portal, true);
    this.tweens.add({ targets: this.portal, angle: 360, duration: 4000, repeat: -1 });

    // 3. Gestion des joueurs via Socket.io
    socket.on('currentPlayers', (players) => {
        Object.keys(players).forEach((id) => {
            if (id === socket.id) addPlayer(this, players[id]);
            else addOtherPlayers(this, players[id]);
        });
    });

    socket.on('newPlayer', (info) => addOtherPlayers(this, info));

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
    });

    socket.on('newChatMessage', (data) => {
        const chat = document.getElementById('chat');
        chat.innerHTML += `<div><strong>${data.user}:</strong> ${data.text}</div>`;
        chat.scrollTop = chat.scrollHeight;
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

        // Faire suivre le pseudo
        this.playerText.setPosition(this.player.x, this.player.y - 30);

        // Envoyer mouvement
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
    
    // Collision avec les murs
    self.physics.add.collider(self.player, self.platforms);

    // Détection du portail
    self.physics.add.overlap(self.player, self.portal, () => {
        if (!self.isTeleporting) {
            self.isTeleporting = true;
            if(confirm("Entrer dans le mini-jeu Quiz ?")) {
                alert("Ouverture du Quiz...");
            }
            setTimeout(() => { self.isTeleporting = false; }, 3000);
        }
    });

    self.playerText = self.add.text(info.x, info.y - 30, info.username, { 
        fontSize: '14px', fill: '#ffffff', backgroundColor: '#000000aa'
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

function sendMessage() {
    const input = document.getElementById('m');
    if (input.value) {
        socket.emit('chatMessage', input.value);
        input.value = '';
    }
}
// Rendre la fonction accessible au bouton HTML
window.sendMessage = sendMessage;
