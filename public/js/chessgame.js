const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

let dragPiece = null;
let sourceSquare = null;
let playerRole = null;
let highlightedSquares = [];
let promotionSquare = null;

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";

    board.forEach((row, rowIndex) => {
        row.forEach((square, colIndex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add("square", (rowIndex + colIndex) % 2 === 0 ? "light" : "dark");
            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = colIndex;

            // highlight squares
            if (highlightedSquares.some(s => s.row === rowIndex && s.col === colIndex)) {
                squareElement.classList.add("highlight");
            }

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add("piece", square.color === "w" ? "white" : "black");
                pieceElement.innerText = getPieceUnicode(square);

                const isPlayerTurn = (square.color === chess.turn() && playerRole === square.color);
                pieceElement.setAttribute("draggable", isPlayerTurn);

                // drag logic
                pieceElement.addEventListener("dragstart", e => {
                    if (isPlayerTurn) {
                        dragPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: colIndex };
                        pieceElement.classList.add("dragging");
                        e.dataTransfer.setData("text/plain", "");
                    }
                });

                pieceElement.addEventListener("dragend", () => {
                    dragPiece = null;
                    sourceSquare = null;
                    pieceElement.classList.remove("dragging");
                });

                // click to highlight moves
                pieceElement.addEventListener("click", () => {
                    if (isPlayerTurn) {
                        highlightMoves(rowIndex, colIndex);
                    }
                });

                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", e => e.preventDefault());
            squareElement.addEventListener("drop", e => {
                e.preventDefault();
                if (dragPiece && sourceSquare) {
                    const targetSquare = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col)
                    };
                    handleMove(sourceSquare, targetSquare);
                }
            });

            boardElement.appendChild(squareElement);
        });
    });

    // flip board for black
    if (playerRole === 'b') boardElement.classList.add("flipped");
    else boardElement.classList.remove("flipped");

    // check highlight
    highlightCheck();
};

const handleMove = (source, target, promotionChoice = "q") => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: promotionChoice
    };

    const moves = chess.moves({ square: move.from, verbose: true });
    const isPromotion = moves.some(m => m.promotion && m.to === move.to);

    if (isPromotion && !promotionChoice) {
        promotionSquare = { source, target };
        showPromotionOptions(target);
        return;
    }

    const result = chess.move(move);
    if (result) {
        highlightedSquares = [];
        renderBoard();
        socket.emit("move", move);
    }
};

// show promotion UI
const showPromotionOptions = (target) => {
    const overlay = document.createElement("div");
    overlay.classList.add("promotion-overlay");

    ["q", "r", "b", "n"].forEach(opt => {
        const btn = document.createElement("button");
        btn.classList.add("promotion-btn");
        btn.innerText = getPieceUnicode({ type: opt, color: chess.turn() });
        btn.addEventListener("click", () => {
            handleMove(promotionSquare.source, promotionSquare.target, opt);
            document.body.removeChild(overlay);
            promotionSquare = null;
        });
        overlay.appendChild(btn);
    });

    document.body.appendChild(overlay);
};

// highlight legal moves
const highlightMoves = (row, col) => {
    const from = `${String.fromCharCode(97 + col)}${8 - row}`;
    const moves = chess.moves({ square: from, verbose: true });
    highlightedSquares = moves.map(m => ({
        row: 8 - parseInt(m.to[1]),
        col: m.to.charCodeAt(0) - 97
    }));
    renderBoard();
};

// highlight king in check
const highlightCheck = () => {
    if (chess.in_check()) {
        const king = chess.turn() === "w" ? "k" : "K";
        const board = chess.board();
        board.forEach((row, r) => {
            row.forEach((square, c) => {
                if (square && square.type === "k" && square.color === chess.turn()) {
                    const kingSquare = boardElement.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    if (kingSquare) kingSquare.classList.add("in-check");
                }
            });
        });
    }
};

const getPieceUnicode = piece => {
    const unicode = {
        p: { w: '♙', b: '♟︎' },
        r: { w: '♖', b: '♜' },
        n: { w: '♘', b: '♞' },
        b: { w: '♗', b: '♝' },
        q: { w: '♕', b: '♛' },
        k: { w: '♔', b: '♚' }
    };
    return unicode[piece.type][piece.color] || "";
};

// socket listeners
socket.on("playerRole", role => { playerRole = role; renderBoard(); });
socket.on("spectatorRole", () => { playerRole = null; renderBoard(); });
socket.on("boardState", fen => { chess.load(fen); renderBoard(); });
socket.on("move", move => { chess.move(move); renderBoard(); });
socket.on("InvalidMove", move => { alert(`Invalid move: ${move.from} → ${move.to}`); });

renderBoard();
