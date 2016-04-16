const QUAKE_URL = 'http://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojsonp'

const map = L.map('map').setView([33.858631, -118.279602], 7)
L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png').addTo(map)

const socket = io.connect('http://localhost:8000')

function initalize() {
	// table是用来存放地震数据
	const table = document.querySelector('#quakes-info')
	const codeLayers = {}
	const quakeLayer = L.layerGroup([]).addTo(map)

	// socket.on('news', data => console.log(data))
	// socket.emit('message', 'my name is jocs')
	
	Rx.Observable.fromEvent(socket, 'message')
	.subscribe(data => console.log(data))

	const earthquakesStream = Rx.Observable.interval(5000)
	.flatMap(
		() => Rx.DOM.jsonpRequest({
			url: QUAKE_URL,
			jsonpCallback: 'eqfeed_callback'
		}).retry(3)
	)
	.flatMap(result => Rx.Observable.from(result.response.features))
	.distinct(quake => quake.properties.code)
	.share()

	earthquakesStream.map(quake => ({
		id: `${quake.properties.net}-${quake.properties.code}`, // 和row id相同
		coords: quake.geometry.coordinates,
		size: quake.properties.mag * 10000
	}))
	.subscribe(
		quake => {
			const circle = L.circle([quake.coords[1], quake.coords[0]], quake.size).addTo(map)
			quakeLayer.addLayer(circle)
			codeLayers[quake.id] = quakeLayer.getLayerId(circle)
		},
		error => console.log(error)
	)

	earthquakesStream.pluck('properties')
	.take(15)
	.map(makeRow)
	.bufferWithTime(1000)
	.filter(rows => rows.length > 1)
	.map(rows => {
		const fragment = document.createDocumentFragment()
		return rows.reduce((acc, r) => {
			acc.appendChild(r)
			return acc
		}, fragment)
	})
	.subscribe(fragment => table.appendChild(fragment))

	getRowFromEvent('mouseover')
	.pairwise()
	.subscribe(rows => {
		const preCircle = quakeLayer.getLayer(codeLayers[rows[0].id])
		const curCircle = quakeLayer.getLayer(codeLayers[rows[1].id])

		preCircle.setStyle({color: '#0000ff'})
		curCircle.setStyle({color: '#ff0000'})
	})

	getRowFromEvent('click')
	.subscribe(row => {
		const circle = quakeLayer.getLayer(codeLayers[row.id])
		map.panTo(circle.getLatLng())
	})

	function getRowFromEvent(event) {
		return Rx.Observable.fromEvent(table, event)
			.filter(event => {
				const el = event.target
				return el.tagName === 'TD' && el.parentNode.id.length
			})
			.pluck('target', 'parentNode')
			.distinctUntilChanged()
	}

	function makeRow(props) {
		const row = document.createElement('tr')
		row.setAttribute('id', `${props.net}-${props.code}`)
		const date = new Date(props.time)
		const time = date.toString().substr(0, 24); // 啊，这个分号不能够不要啊
		[props.place, props.mag, time].forEach(text => {
			const cell = document.createElement('td')
			cell.textContent = text
			row.appendChild(cell)
		})
		return row
	}
}

Rx.DOM.ready().subscribe(initalize)










