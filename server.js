const express = require('express')
const app = express()
const server = require('http').createServer(app)
const socketio = require('socket.io').listen(server)

server.listen(8000, () => console.log('listen 8000'))

app.use(express.static(__dirname + '/earthquake'))


socketio.on('connection', socket => {
	socket.emit('message', {hello: 'world'})
})







