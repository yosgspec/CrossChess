/** マス目の管理クラス */
class Panel{
	constructor(ctx, panel, dx, dy){
		Object.assign(this, panel)
		this.ctx = ctx;
		this.dx = dx;
		this.dy = dy;
		this.piece = null;
	}

	/* マス目を描写 */
	draw(x, y){
		const ctx = this.ctx;
		ctx.fillStyle = this.backgroundColor;
		ctx.strokeStyle = this.borderColor;

		/* マス目を描写 */
		ctx.save();
		ctx.translate(x-this.dx/2, y-this.dy/2);
		ctx.fillRect(0, 0, this.dx, this.dy);
		ctx.strokeRect(0, 0, this.dx, this.dy);

		/* 斜線を描写 */
		ctx.beginPath()
		if(this.borderSlushLeft){
			ctx.moveTo(0, 0);
			ctx.lineTo(this.dx, this.dy);
		}
		if(this.borderSlushRight){
			ctx.moveTo(this.dx, 0);
			ctx.lineTo(0, this.dy);
		}
		ctx.closePath();
		ctx.stroke()
		ctx.restore();

		/* 文字を描写 */
		if(this.textDisplay){
			ctx.save();
			ctx.translate(x, y);
			ctx.fillStyle = this.borderColor;

			const rad = this.textRotate? this.textRotate*Math.PI/180: 0;
			ctx.rotate(rad);

			const fontSize = Math.min(this.dx, this.dy)*0.6;
			ctx.font = `${fontSize}px ${canvasFont.fontStr}`;

			const width = ctx.measureText(this.textDisplay).width;
			const height = fontSize/2*0.8;
			ctx.fillText(this.textDisplay, -width/2, height);
			ctx.restore();
		}
	}
}

/** 盤の管理クラス */
class Board{
	degSymbols = {
		0: "▲",
		90: "≫",
		180: "▽",
		270: "＜"
	};

	constructor(ctx, boardName, x0, y0, dx, dy){
		Object.assign(this, boards[boardName]);
		this.ctx = ctx;
		this.x0 = x0;
		this.y0 = y0;
		this.dx = dx;
		this.dy = dy;
		this.field = this.field.map(row=>
			[...row].map(v=>new Panel(ctx, panels[v], dx, dy)));
		this.xLen = this.field[0].length;
		this.yLen = this.field.length;
	}

	/* 駒の初期配置を行う */
	putStartPieces(pieceSet, ptn="default"){
		const pos = games[pieceSet].position[this.xLen][ptn];
		pos.forEach((row, i)=>{
			const y = i+this.yLen - pos.length;
			[...row].forEach((v, x)=>{
				if(!pieces[v]) return;
				const piece = pieces[v].clone();
				this.field[y][x].piece = piece;
			});
		});
	}

	/* 駒配置を回転する */
	rotateField(deg=180){
		if(![90, 180].includes(deg)) throw Error("deg is not 90 or 180.");
		if(deg === 90){
			const transpose = a => a[0].map((_, c) => a.map(r => r[c]));
			const len = this.xLen;
			if(len !== this.yLen) throw Error("Not rows = cols.");
			this.field = transpose(this.field);
		}
		else if(deg === 180){
			this.field.reverse();
		}
		this.field.forEach(row=>{
			row.forEach(panel=>{
				if(!panel.piece) return;
				panel.piece.deg += deg;
			});
			row.reverse()
		});
	}

	/* 駒配置をテキストで取得 */
	getString(isMinimam=false){
		const header = isMinimam? "": `┏${Array(this.xLen).fill("━━").join("┯")}┓\n`;
		const footer = isMinimam? "": `\n┗${Array(this.xLen).fill("━━").join("┷")}┛`;
		const panelOuter = isMinimam? "": "┃";
		const panelSep = isMinimam? "": "│";
		const rowSep = isMinimam? "\n": `\n┃${Array(this.xLen).fill("──").join("┼")}┨\n`
		const panelText = isMinimam? ()=>"｜・": panel=>panel.text;
		return (
			header+
			this.field.map(row=>
				panelOuter+
				row.map(panel=>{
					const piece = panel.piece;
					if(!piece) return panelText(panel);
					return this.degSymbols[piece.deg] + piece.char;
				}).join(panelSep)+
				panelOuter
			).join(rowSep)+
			footer
		);
	}

	/* 盤を描写 */
	draw(){
		const ctx = this.ctx;

		/* 外枠を描写 */
		ctx.fillStyle = this.backgroundColor;
		ctx.strokeStyle = this.borderColor;
		ctx.lineWidth = this.borderWidth;

		const boardWidth = this.dx*(this.xLen+1);
		const boardHeight = this.dy*(this.yLen+1);
		ctx.save();
		ctx.translate(this.x0, this.y0);
		ctx.strokeRect(0, 0, boardWidth, boardHeight);
		ctx.fillRect(0, 0, boardWidth, boardHeight);
		ctx.translate(this.dx/2, this.dy/2);
		ctx.strokeRect(0, 0, boardWidth-this.dx, boardHeight-this.dy);
		ctx.restore();

		/* マス目を描写 */
		this.field.forEach((row, y)=>{
			row.forEach((panel, x)=>{
				const xCenter = this.x0+this.dx*(x+1);
				const yCenter = this.y0+this.dy*(y+1)
				panel.draw(xCenter, yCenter);
				if(!panel.piece) return;
				panel.piece.draw(xCenter, yCenter);
			});
		});
	}
}

/* 駒の管理クラス */
class Piece{
	/* 駒データを初期化 */
	static init(ctx, size){
		/* 成駒のデータを統合 */
		for(const base of Object.values(pieces)){
			base.base = base;
			if(!base.promo) continue;
			for(const [promoChar, promo] of Object.entries(base.promo)){
				pieces[promoChar] = {...base, ...promo};
				pieces[promoChar].group = "成";
			}
		}
		/* 駒をクラスオブジェクトに変換 */
		Object.entries(pieces).map(([key, piece], i)=>{
			piece.id = i;
			piece.char = key;
			pieces[key] = new Piece(ctx, piece, size);
		});
		/* エイリアスのデータを統合 */
		for(const [baseChar, base] of Object.entries(pieces)){
			if(!base.alias) continue;
			base.alias.forEach((aliasChar, i)=>{
				const alias = base.clone();
				const display = [...alias.display];
				[display[0], display[i+1]] = [display[i+1], display[0]];
				alias.display = display;
				alias.alias[i] = baseChar;
				pieces[aliasChar] = alias;
			});
		}
	}

	/* 駒の角度(deg/rad) */
	set deg(value){
		this.rad = value%360*Math.PI/180;
	}
	get deg(){
		return this.rad%360/(Math.PI/180);
	}

	constructor(ctx, piece, size=100, deg=0){
		Object.assign(this, piece);
		this.ctx = ctx;
		if(typeof this.game === "string") this.game = games[this.game];
		this.size = size;
		this.zoom = size/100;
		this.deg = deg;
	}

	/* 駒を表返す */
	turnOverFront(){
		Object.assign(this, this.base);
	}

	/* 駒を成らす */
	promotion(promo){
		if(!this.promo) throw Error("Not plomote piece.");
		if(!promo in this.promo) throw Error("Plomote key is missing.");
		if(this.group === "成") throw Error("Promoted piece.");
		Object.assign(this, this.promo[promo]);
		this.group = "成";
	}

	/* 駒をクローン */
	clone(){
		return new Piece(this.ctx, this, this.size, this.deg);
	}

	/* 駒を描写 */
	draw(x, y, displayNo=0){
		const ctx = this.ctx;
		const zoom = this.zoom;
		ctx.strokeStyle = "#777777";

		ctx.fillStyle   = this.game.backgroundColor;
		ctx.lineWidth = 5;
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(this.rad);

		/* 外枠を描写 */
		ctx.beginPath();
		ctx.moveTo(-30*zoom,-40*zoom);
		ctx.lineTo(  0*zoom,-50*zoom);
		ctx.lineTo( 30*zoom,-40*zoom);
		ctx.lineTo( 40*zoom, 50*zoom);
		ctx.lineTo(-40*zoom, 50*zoom);
		ctx.closePath();
		ctx.stroke();
		ctx.fill();

		/* 文字を描写 */
		ctx.fillStyle = this.game.fontColor;
		const text = [...this.display[displayNo]];
		const fontSize = 40*zoom;
		ctx.font = `${fontSize}px ${canvasFont.fontStr}`;
		ctx.textAlign = "center";

		text.forEach((v,i)=>{
			const height = text.length === 1? fontSize/2: i*fontSize;
			ctx.fillText(v, 0, height);
		});

		ctx.restore();
	}
}