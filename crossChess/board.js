// import boards from "./json/boards.json" assert { type: "json" };
// import panels from "./json/panels.json" assert { type: "json" };
// import pieces from "./json/pieces.json" assert { type: "json" };
// import games from "./json/games.json" assert { type: "json" };

/** 盤の管理クラス */
class Board{
	/** テキスト出力時のプレイヤー表示 */
	degChars = {
		0: "▲",
		90: "≫",
		180: "▽",
		270: "＜"
	};

	/**
	 * @param {any} ctx - Canvas描画コンテキスト
	 * @param {string} boardName - ボードタイプ
	 * @param {number} left - 描写するX座標
	 * @param {number} top - 描写するY座標
	 * @param {number} panelWidth - パネル幅
	 * @param {number} panelHeight - パネル高さ
	 * @param {number} players - プレイヤー人数(2 or 4)
	 */
	constructor(canvas, ctx, boardName, left, top, panelWidth, panelHeight, players = 2) {
		Object.assign(this, boards[boardName]);
		this.canvas = canvas;
		this.ctx = ctx;
		this.left = left;
		this.top = top;
		this.panelWidth = panelWidth;
		this.panelHeight = panelHeight;

		if(![2, 4].includes(players)) throw Error(`players=${players}, players need 2 or 4.`);
		this.players = players;

		// マス目データを構築
		this.field = this.field.map((row, yCnt)=>
			[...row].map((char, xCnt)=>{
				const center = left+panelWidth*(xCnt+1);
				const middle = top+panelHeight*(yCnt+1)
				return new Panel(ctx, panels[char], center, middle, panelWidth, panelHeight, this.borderWidth);
			})
		);
		this.xLen = this.field[0].length;
		this.yLen = this.field.length;
		this.width = this.panelWidth*(this.xLen+1);
		this.height = this.panelHeight*(this.yLen+1);

		mouseControl(this);
	}

	/** 駒配置を回転
	 * @param {number} deg - 回転角 (90の倍数)
	 */
	rotateField(deg){
		deg = (deg+360)%360;
		if(deg === 0) return;
		if(![90, 180, 270].includes(deg)) throw Error(`deg=${deg}, deg need multiple of 90.`);
		if([90, 270].includes(deg)){
			// 2次配列を転置
			const transpose = a => a[0].map((_, c) => a.map(r => r[c]));
			const len = this.xLen;
			if(len !== this.yLen) throw Error(`cols=${this.xLen} != rows=${this.yLen}, Not rows = cols.`);
			this.field = transpose(this.field);
		}
		if([180, 270].includes(deg)){XPathEvaluator
			this.field.reverse();
		}
		this.field.forEach(row=>{
			row.forEach(panel=>{
				if(!panel.piece) return;
				panel.piece.deg += deg;
			});
			if([90, 180].includes(deg)) row.reverse()
		});
	}

	/** 駒の初期配置
	 * {number} playerId - プレイヤー番号
	 * {string} pieceSet - 駒の配置セット
	 * {string} ptn - 駒の配置パターン変更
	 */
	putStartPieces(playerId, pieceSet, ptn="default"){
		const deg = 0|playerId*360/this.players;
		this.rotateField(deg);
		const pos = games[pieceSet].position[this.xLen][ptn];
		pos.forEach((row, i)=>{
			const yCnt = i+this.yLen - pos.length;
			[...row].forEach((char, xCnt)=>{
				if(!pieces[char]) return;
				const piece = pieces[char].clone();
				const panel = this.field[yCnt][xCnt];
				piece.center = panel.center;
				piece.middle = panel.middle;
				panel.piece = piece;
			});
		});
		this.rotateField(-deg);
	}

	/** 駒の配置
	 * @param {string} piece - 駒の表現文字
	 * @param {number} xCnt - X方向配置位置(マス目基準)
	 * @param {number} yCnt - Y方向配置位置(マス目基準)
	 * @param {number} playeaIdOrDeg - プレイヤー番号または駒の配置角
	 * @param {number} displayPtn - 表示文字列を変更(1〜)
	 */
	putNewPiece(piece, xCnt, yCnt, playeaIdOrDeg, displayPtn=0, setDeg=false){
		const deg = !setDeg? playeaIdOrDeg*90: playeaIdOrDeg;
		if(typeof piece === "string"){
			piece = new Piece(this.ctx, pieces[piece], displayPtn, deg);
		}
		const panel = this.field[yCnt][xCnt];
		piece.center = panel.center;
		piece.middle = panel.middle;
		panel.piece = piece;
	}

	/** 駒を移動
	 * @param {Panel} fromPanel - 移動元のパネル
	 * @param {Panel} toPanel - 選択中のパネル
	 */
		movePiece(fromPanel, toPanel, row, col){
			if(toPanel.attr.includes("keepOut") || !fromPanel || toPanel.piece === fromPanel.piece) return fromPanel;
			toPanel.piece = fromPanel.piece;
			toPanel.piece.center = toPanel.center;
			toPanel.piece.middle = toPanel.middle;
			fromPanel.piece = null;
		}

	/** 駒配置をテキストで取得
	 * {boolean} isMinimam - 縮小表示
	 */

	outputText(isMinimam=false){
		let header = "";
		let footer = "";
		let panelOuter = "";
		let panelSep = "";
		let rowSep = "\n";
		let panelText = panel => panel.attr.includes("keepOut")? "｜＃": "｜・";

		if(!isMinimam){
			header = `┏${Array(this.xLen).fill("━━").join("┯")}┓\n`;
			footer = `\n┗${Array(this.xLen).fill("━━").join("┷")}┛`;
			panelOuter = "┃";
			panelSep = "│";
			rowSep = `\n┃${Array(this.xLen).fill("──").join("┼")}┨\n`;
			panelText = panel => panel.text;
		}

		return (
			header+
			this.field.map(row=>
				panelOuter+
				row.map(panel=>{
					const piece = panel.piece;
					if(!piece) return panelText(panel);
					return this.degChars[piece.deg] + piece.char;
				}).join(panelSep)+
				panelOuter
			).join(rowSep)+
			footer
		);
	}

	/** 盤を描写 */
	draw(){
		const ctx = this.ctx;

		// 描写を初期化
		ctx.clearRect(this.left, this.top, this.right, this.bottom);

		// 外枠を描写
		ctx.fillStyle = this.backgroundColor;
		ctx.strokeStyle = this.borderColor;
		ctx.lineWidth = this.borderWidth;

		ctx.save();
		ctx.translate(this.left, this.top);
		ctx.strokeRect(0, 0, this.width, this.height);
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.translate(this.panelWidth/2, this.panelHeight/2);
		ctx.strokeRect(0, 0, this.width-this.panelWidth, this.height-this.panelHeight);
		ctx.restore();

		// マス目を描写
		this.field.forEach(row=>{
			row.forEach(panel=>{
				panel.draw();
				if(panel.isSelected) panel.drawMask("#FF000055");
				if(panel.piece){
					panel.piece.draw();
					if(panel.piece.isSelected) panel.piece.drawMask("#FF000055");
				}
			});
		});
	}
}
