const canvas = document.querySelector('#canvas')
const ctx = canvas.getContext('2d')

const CANVAS_WIDTH = canvas.width = window.innerWidth
const CANVAS_HEIGHT = canvas.height = window.innerHeight
const STARS_AMOUNT = 500
const STAR_CHANGE_RATE = 40
const HERO_Y = CANVAS_HEIGHT - 30
const ENEMY_FREQ = 1500
const SHOT_SPEED = 15
const ENEMY_SHOT_FREQ = 750
const SCORE_INCRASE = 10

const ScoreSubject = new Rx.Subject()
const getRandomNumber = (min, max) => Math.random() * (max - min + 1) + min
const collision = (target1, target2) => target1.x > target2.x - 20 && target1.x < target2.x + 20 
									    && target1.y > target2.y - 20 && target1.y < target2.y + 20



const drawStar = stars => {
	ctx.fillStyle = '#000000'
	ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
	ctx.fillStyle = '#ffffff'
	stars.forEach(star => {
		ctx.beginPath()
		ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
		ctx.fill()
		ctx.closePath()
	})
}

const drawTangle = (x, y,  width, direction, color) => {
	ctx.fillStyle = color
	ctx.beginPath()
	ctx.lineTo(x - width, y)
	ctx.lineTo(x, direction === 'up' ? y - width: y + width)
	ctx.lineTo(x + width, y)
	ctx.lineTo(x - width, y)
	ctx.closePath()
	ctx.fill()
}

const drawHero = hero => drawTangle(hero.x, hero.y, 20, 'up', 'red')

const drawEnemies = enemies => enemies.forEach(e => {
	//e.x += getRandomNumber(-15, 15)
	e.y += 5
	if(!e.dead) drawTangle(e.x, e.y, 20, 'down', 'orange')
	e.shots.forEach(s => drawTangle(s.x, s.y += SHOT_SPEED, 5, 'down', 'orange'))
})

const drawHeroShots = (shots, enemies) => shots.forEach(s => {
	enemies.forEach(e => {
		if (collision(s, e)) {
			e.dead = true
			s.x = s.y = -100
			ScoreSubject.onNext(SCORE_INCRASE)
		}
	})
	s.y -= SHOT_SPEED
	drawTangle(s.x, s.y, 5, 'up', 'yellow')
})

const drawScore = score => {
	ctx.fillStyle = '#ffffff'
	ctx.font = 'bold 26px sans-serif'
	ctx.fillText('Score: ' + score, 40, 40)
}

const render = all => {
	drawStar(all.stars)
	drawHero(all.hero)
	drawEnemies(all.enemties)
	drawHeroShots(all.heroShots, all.enemties)
	drawScore(all.scores)
}

const gameOver = (enemies, hero) => {
	return enemies.some(e => {
		if (collision(e, hero)) return true
		return e.shots.some(s => {
			if (collision(s, hero)) return true
		})
	})
}

const scoreBoard = ScoreSubject.scan((pre, cur) => pre + cur, 0).startWith(0)

const starsSource = Rx.Observable.range(1, STARS_AMOUNT)
	.map(() => ({
		x: Math.floor(Math.random() * CANVAS_WIDTH),
		y: Math.floor(Math.random() * CANVAS_HEIGHT),
		r: Math.random() + 1
	}))
	.toArray()
	.flatMap(starArray => {
		return Rx.Observable.interval(STAR_CHANGE_RATE).map(() => {
			starArray.forEach(star => {
				star.y = star.y >= CANVAS_HEIGHT ? 0: star.y + 3
			})
			return starArray
		})
	})

const heroSource = Rx.Observable.fromEvent(canvas, 'mousemove')
	.map(e => ({x: e.clientX, y: HERO_Y}))
	.startWith({
		x: CANVAS_WIDTH / 2, 
		y: HERO_Y
	})

const isInView = p => p.x >= -40 && p.x <= CANVAS_WIDTH + 40 && p.y >= -40 && p.y <= CANVAS_HEIGHT + 40

const enemiesSource = Rx.Observable.interval(ENEMY_FREQ)
	.scan(enemtyArray => {
		const enemiy = {x: Math.random() * CANVAS_WIDTH, y: -30, shots: []}
		Rx.Observable.interval(ENEMY_SHOT_FREQ).subscribe(() => {
			if(!enemiy.dead) enemiy.shots.push({x: enemiy.x, y: enemiy.y})
			enemiy.shots = enemiy.shots.filter(isInView)
		})
		enemtyArray.push(enemiy)
		return enemtyArray.filter(isInView).filter(e => !(e.dead && e.shots.length === 0))
	}, [])

const playerFiring = Rx.Observable.merge(
	Rx.Observable.interval(300),
	Rx.Observable.fromEvent(canvas, 'click'),
	Rx.Observable.fromEvent(document, 'keyup')
	.filter(e => e.keyCode === 32)
)
.sample(200)
.timestamp()


const HeroShots = Rx.Observable.combineLatest(
	playerFiring,
	heroSource,
	(shotEvent, hero) => ({x: hero.x, timestamp: shotEvent.timestamp})
)
.distinctUntilChanged(shot => shot.timestamp)
.scan((shotArray, p) => [...shotArray, {x: p.x, y: HERO_Y}], [])

const Game = Rx.Observable.combineLatest(
	starsSource, 
	heroSource,
	enemiesSource,
	HeroShots,
	scoreBoard,
	(stars, hero, enemties, heroShots, scores) => ({stars, hero, enemties, heroShots, scores})
)
.sample(STAR_CHANGE_RATE)
.takeWhile(all => !gameOver(all.enemties, all.hero))
.subscribe(render, error => console.log(error))







