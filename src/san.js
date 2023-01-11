/********************************************************/
/* SAN                                                  */
/* Para executar use: node san.js &                     */
/********************************************************/
process.title = 'san';
const Version = 'v1.0.0';

async function GetDate() {
	let offset = new Date(new Date().getTime()).getTimezoneOffset();
	return new Date(new Date().getTime() - (offset*60*1000)).toISOString().replace(/T/,' ').replace(/\..+/, '');
}

// Inicializa variaveis globais
var Servers = [];

// Read enviroment variables
const dotenv = require('dotenv');
dotenv.config();

// Create express
const express = require('express')
const app = express()
const http = require('http').createServer(app)
app.use(express.static('public'));
http.listen(process.env.SrvPort || 3000);

app.get('/', (req, res) => {
    res.sendFile(__dirname + 'public/index.html');
});

/****************************************************************************************************/
/* Socket.io      																					*/
/****************************************************************************************************/
const io = require('socket.io')(http)

io.on('connection', (socket) =>{
	// Envia a lista de servidores ativos
	SendUpdate();
	// Envia versao do SAN
	socket.emit('app_version', process.title + ' ('+Version+')');
	
    socket.on('message', (msg)=>{
        socket.broadcast.emit('message', msg)
    })

    socket.on('typing', (data)=>{
        socket.broadcast.emit('typing', data)
    })
});

// Send servers status
async function SendUpdate(){
	// Verifica se o servidor nao mandou nada nos ultimos 2 minutos
	GetDate().then(dte => {
		let x=0;
		while (x < Servers.length) {
			srv = JSON.parse(Servers[x]);
			let d1 = Date.parse(dte);
			let d2 = Date.parse(srv.time);
			// Se nao recebeu nada nos ultimos 2 minutos tira ele da lista
			if ((d1-d2) > 120000) { Servers.splice(x,1);} else {x++}
		}
		// Envia a lista atualizada
		io.emit("servers_list",Servers);
	});
}

// Envia o status a cada 65S
setInterval(function(){ SendUpdate(); }, 65000);

/****************************************************************************************************/
/* Redis        																					*/
/****************************************************************************************************/
// Create and open Redis connection
const Redis = require('ioredis');
const hub = new Redis({host:process.env.RD_host, port:process.env.RD_port, showFriendlyErrorStack: true });

// Subscribe
hub.subscribe("san:server_update", (err, count) => {
  if (err) {
     console.error("Failed to subscribe: %s", err.message);
  } 
});

// Waiting messages
hub.on("message", (channel, message) => {
  switch (channel) {
	case 'san:server_update' : 
		let obj = JSON.parse(message);
		let x = 0;
		while (x < Servers.length) {
			srv = JSON.parse(Servers[x]);
			if (obj.name==srv.name && obj.ipport==srv.ipport) { break; }
			x++;
		}
		// Adciona a hora e atualiza a lista de servidores
		GetDate().then(dte => {
			Servers[x]=message.substring(0,message.length-1)+',"time":"'+dte+'"}';
			// Se o servidor for novo envia imediatamente
			if (x==Servers.length-1) {SendUpdate();}
			});
		break;
	   
	  
  }
	
  
});

const OS = require('os');
GetDate().then(dte => {
	// Show parameters and waiting clients
	console.log('\033[1;30m'+dte+': \033[0;31m================================');
	console.log('\033[1;30m'+dte+': \033[0;31m' + 'APP : ' + process.title + ' ('+Version+')');
	console.log('\033[1;30m'+dte+': \033[0;31m' + 'IP/Port : ' + process.env.SrvIP + ':' + process.env.SrvPort);
	console.log('\033[1;30m'+dte+': \033[0;31m' + 'CPUs: '+ OS.cpus().length);
	console.log('\033[1;30m'+dte+': \033[0;31m================================');
	console.log('\033[1;30m'+dte+': \033[0;31mWaiting clients...\033[0;0m');});
