<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Anastalandia | Lobby</title>
    <script src="https://cdn.jsdelivr.net/npm/phaser@3.55.2/dist/phaser.min.js"></script>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <style>
        body { margin: 0; background: #000; overflow: hidden; font-family: sans-serif; }
        #ui { position: fixed; bottom: 10px; left: 10px; right: 10px; z-index: 10; pointer-events: none; }
        #chat { background: rgba(0,0,0,0.6); color: #fff; height: 100px; overflow-y: auto; padding: 5px; border-radius: 5px; margin-bottom: 5px; font-size: 12px; }
        #input-area { display: flex; pointer-events: auto; }
        input { flex: 1; padding: 10px; border-radius: 5px 0 0 5px; border: none; }
        button { padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 0 5px 5px 0; }
    </style>
</head>
<body>
    <div id="ui">
        <div id="chat" id="messages"></div>
        <div id="input-area">
            <input type="text" id="m" placeholder="Message...">
            <button onclick="sendMessage()">Envoyer</button>
        </div>
    </div>
    <script src="game.js"></script>
</body>
</html>
