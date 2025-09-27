const express = require('express');
const socket = require('socket.io');
const http = require('http');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socket(server);
const chess = new Chess();
let players = {};
let currentPlayer = "w";

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index', { title: 'Chess Game' });
});

io.on("connection", socketClient => {
    console.log("New connection:", socketClient.id);

    if(!players.white){
        players.white = socketClient.id;
        socketClient.emit("playerRole", "w");
    } else if(!players.black){
        players.black = socketClient.id;
        socketClient.emit("playerRole", "b");
    } else {
        socketClient.emit("spectatorRole");
    }

    socketClient.on("disconnect", () => {
        if(socketClient.id === players.white) delete players.white;
        if(socketClient.id === players.black) delete players.black;
    });

    socketClient.on("move", move => {
        try {
            if(chess.turn() === 'w' && socketClient.id !== players.white) return;
            if(chess.turn() === 'b' && socketClient.id !== players.black) return;

            const result = chess.move(move);
            if(result){
                currentPlayer = chess.turn();
                io.emit("move", move);
                io.emit("boardState", chess.fen());
            } else {
                socketClient.emit("InvalidMove", move);
            }
        } catch(err) {
            socketClient.emit("InvalidMove", move);
        }
    });
});

server.listen(8000, () => console.log("Server listening on port 8000"));
