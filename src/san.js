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

// Publish message to whatsapp
async function PublishMsg(msg) {
	hub.publish('msg:san_message','{"msg":"'+msg+'"}');
}

// Inicializa variaveis globais
var Servers = [];

/****************************************************************************************************/
/* Read enviroment variables																		*/
/****************************************************************************************************/
const dotenv = require('dotenv');
dotenv.config();

/****************************************************************************************************/
/* Create and open express connection 																*/
/****************************************************************************************************/
const express = require('express')
const app = express()
const http = require('http').createServer(app)
app.use(express.static('public'));
http.listen(process.env.SrvPort || 50000);

app.get('/', (req, res) => {
    res.sendFile(__dirname + 'public/index.html');
});

/****************************************************************************************************/
/* Socket.io      																					*/
/****************************************************************************************************/
const io = require('socket.io')(http, {
	cors: {
	  origin: '*',
	}
  });

io.on('connection', (socket) =>{
	// Envia a lista de servidores ativos
	SendUpdate();
	// Envia lista de devices na lista LOG
	SendLogList();
	// Envia versao do SAN
	socket.emit('app_version', process.title + ' ('+Version+')');
	
    socket.on('message', (msg)=>{
        socket.broadcast.emit('message', msg)
    })

    socket.on('typing', (data)=>{
        socket.broadcast.emit('typing', data)
    })
});

// Send log list
async function SendLogList(){
	const keys = await hub.scan(0, 'MATCH', 'log:*');
	// Monta a lista atualizada
	let logs=[];
	let x=0;
	while (x < keys[1].length) {
		let key = await hub.get(keys[1][x]);
		logs[x]='{"did":"'+keys[1][x].substring(4)+'","name":"'+key+'"}';
		x++
	}
	// Envia a lista atualizada
	if (x > 0) { io.emit("log_list", logs); }
}

// Send servers status
async function SendUpdate(){
	// Pega data e hora atual e percorre a lista de servidores verificando qual foi o último envio
	GetDate().then(dte => {
		let x=0;
		while (x < Servers.length) {
			let srv = JSON.parse(Servers[x]);
			let d1 = Date.parse(dte);
			let d2 = Date.parse(srv.time);
			// Se nao recebeu nada nos ultimos 2 minutos tira ele da lista
			if ((d1-d2) > 120000) {
				// Envia uma messagem
				PublishMsg('Alert: '+srv.name+'('+srv.version+') is down.');
				// Tira da lista de on-line
				Servers.splice(x,1);
			} else {x++}
		}
		// Envia a lista atualizada
		io.emit("servers_list", Servers);
	});
}

// Envia o status a cada 60s
setInterval(function(){ SendUpdate(); }, 60000);

/****************************************************************************************************/
/* Create and open Redis connection 																*/
/****************************************************************************************************/
const Redis = require('ioredis');
const hub = new Redis({host:process.env.RD_host, port:process.env.RD_port, password:process.env.RD_pass});
const pub = new Redis({host:process.env.RD_host, port:process.env.RD_port, password:process.env.RD_pass});

// Updates server status as soon as it successfully connects
pub.on('connect', function () { GetDate().then(dte => { console.log('\033[36m'+dte+': \033[32mHUB connected.\033[0;0m');
														console.log('\033[36m'+dte+': \033[32mWaiting clients...\033[0;0m');});});

// Subscribe on chanels
pub.subscribe("san:server_update","san:monitor_update", (err, count) => {
  if (err) {
	console.log('\033[36m'+dte+': \033[31mFailed to subscribe: '+ err.message +'\033[0m');
  } 
});

// Waiting messages
pub.on("message", (channel, message) => {
  switch (channel) {
	case 'san:server_update' :
		// Converte para objeto
		let obj = JSON.parse(message);
		// Verifica se o servidor ja esta na lista
		let x = 0;
		while (x < Servers.length) {
			srv = JSON.parse(Servers[x]);
			if (obj.name==srv.name && obj.ipport==srv.ipport) { break; }
			x++;
		}
		// Adciona data e hora e atualiza a lista de servidores
		GetDate().then(dte => {
			Servers[x]=message.substring(0,message.length-1)+',"time":"'+dte+'"}';
			// Se o servidor for novo envia imediatamente
			if (x==Servers.length-1) {SendUpdate();}
			});
		break;

	case 'san:monitor_update' :
		io.emit("dev_monitor",message);
		break;
	  
  }
	
  
});
/****************************************************************************************************/
/* Create and open MySQL connection																	*/
/****************************************************************************************************/
//const mysql = require('mysql');
//const db = mysql.createPool({host:process.env.DB_host, database:process.env.DB_name, user:process.env.DB_user, password:process.env.DB_pass, connectionLimit:10});

/****************************************************************************************************/
/* 	Show parameters and waiting clients																*/
/****************************************************************************************************/
const OS = require('os');
GetDate().then(dte => {
	// Show parameters and waiting clients
	console.log('\033[36m'+dte+': \033[37m================================');
	console.log('\033[36m'+dte+': \033[37mAPP : ' + process.title + ' ('+Version+')');
	console.log('\033[36m'+dte+': \033[37mIP/Port : ' + process.env.SrvIP + ':' + process.env.SrvPort);
	console.log('\033[36m'+dte+': \033[37mCPUs: '+ OS.cpus().length);
	console.log('\033[36m'+dte+': \033[37m================================');});