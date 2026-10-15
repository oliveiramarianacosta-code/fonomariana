import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { code, startRound, finishRound, allVoted, eligible } from './game.js';
const PORT = Number(process.env.PORT || 3000);
const rooms = new Map(), clients = new Map();
const assets = {'/':['index.html','text/html'], '/app.js':['app.js','text/javascript'], '/style.css':['style.css','text/css']};
const server = http.createServer(async (req,res) => {
  const asset = assets[new URL(req.url,'http://localhost').pathname];
  if (!asset) {res.writeHead(404);res.end('Não encontrado');return;}
  try {
    const body = await readFile(fileURLToPath(new URL(`./public/${asset[0]}`,import.meta.url)));
    res.writeHead(200, {'Content-Type':`${asset[1]}; charset=utf-8`,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});res.end(body);
  } catch {res.writeHead(500);res.end('Falha ao carregar.');}
});
const wss = new WebSocketServer({noServer:true,maxPayload:8192});
server.on('upgrade',(req,socket,head) => {
  const allowed = process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`;
  if (req.url !== '/ws' || req.headers.origin !== allowed || wss.clients.size >= 500) {socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws => wss.emit('connection',ws));
});
const send = (ws,data) => {if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(data));};
function broadcast(room) {
  room.updated = Date.now();
  for (const [ws,c] of clients) if(c.room===room.code) {
    const players = Object.fromEntries(Object.entries(room.players).map(([id,p]) => [id,{name:p.name,score:p.score,online:p.online}]));
    send(ws,{type:'state',room:{...room,players,answers:room.phase==='playing'?{[c.id]:room.answers[c.id]}:room.answers,votes:room.phase==='review'?{[c.id]:room.votes[c.id] || {}}:{},allVoted:room.phase==='review' && allVoted(room)}});
  }
}
function detach(ws) {
  const c=clients.get(ws);clients.delete(ws); if(!c)return;
  const room=rooms.get(c.room);if(!room)return;
  room.players[c.id].online=false;
  if(room.host===c.id) room.host=Object.keys(room.players).find(id=>room.players[id].online)||c.id;
  broadcast(room);
}
wss.on('connection', ws => {
  let windowStart=Date.now(), count=0; ws.alive=true;
  ws.on('pong',()=>ws.alive=true);
  ws.on('close',()=>detach(ws)); ws.on('error',()=>{});
  ws.on('message',raw=>{
    try {
      if(Date.now()-windowStart>1000){windowStart=Date.now();count=0;}
      if(++count>80) throw Error('Muitas ações. Aguarde um instante.');
      const m=JSON.parse(raw); if(!m || typeof m!=='object')throw Error('Pedido inválido.');
      let c=clients.get(ws), room=c && rooms.get(c.room);
      if(m.type==='resume') {
        if(c)throw Error('Você já está em uma sala.');
        room=rooms.get(String(m.code));
        const id=room && Object.keys(room.players).find(id=>room.players[id].token===m.token);
        if(!id)throw Error('A sessão expirou. Entre novamente.');
        for(const [other,info] of clients)if(info.room===room.code && info.id===id){clients.delete(other);other.close(4001,'Sessão aberta em outra aba');}
        clients.set(ws,{room:room.code,id});room.players[id].online=true;
        send(ws,{type:'session',code:room.code,id,token:m.token});broadcast(room);return;
      }
      if(m.type==='create'||m.type==='join') {
        if(c)throw Error('Saia da sala atual primeiro.');
        const name=typeof m.name==='string'?m.name.trim():'';
        if(!name || name.length>24)throw Error('Informe um nome de até 24 caracteres.');
        if(m.type==='create') {
          if(rooms.size>=200)throw Error('Servidor cheio. Tente mais tarde.');
          let key;do{key=code();}while(rooms.has(key));
          room={code:key,host:null,players:{},phase:'lobby',round:0,used:[],roster:[],answers:{},votes:{},history:[],updated:Date.now()};rooms.set(key,room);
        } else {
          room=rooms.get(String(m.code).trim().toUpperCase());
          if(!room)throw Error('Sala não encontrada. Confira o código.');
          if(!['lobby','results'].includes(room.phase))throw Error('A rodada está em andamento. Aguarde o resultado.');
        }
        if(Object.keys(room.players).length>=12)throw Error('Esta sala já tem 12 participantes.');
        const id=randomBytes(12).toString('hex'),token=randomBytes(32).toString('hex');
        room.players[id]={name,token,score:0,online:true};room.host ||= id;
        clients.set(ws,{room:room.code,id});send(ws,{type:'session',code:room.code,id,token});broadcast(room);return;
      }
      if(!room)throw Error('Entre em uma sala primeiro.');
      if(m.type==='leave'){detach(ws);send(ws,{type:'left'});return;}
      if(m.type==='start') {
        if(c.id!==room.host || !['lobby','results'].includes(room.phase))throw Error('Somente o anfitrião pode iniciar uma nova rodada.');
        if(room.round>=100)throw Error('Limite de 100 rodadas. Crie uma nova sala.');startRound(room);
      } else if(m.type==='answer') {
        if(room.phase!=='playing'||!room.roster.includes(c.id))throw Error('Os campos estão congelados.');
        if(!Number.isInteger(m.index)||m.index<0||m.index>6||typeof m.value!=='string'||m.value.length>60)throw Error('Resposta inválida.');
        room.answers[c.id][m.index]=m.value;
      } else if(m.type==='stop') {
        if(room.phase!=='playing'||!room.roster.includes(c.id))throw Error('A rodada já terminou.');
        if(!room.answers[c.id].every(a=>eligible(a,room.letter)))throw Error('Preencha as 7 categorias com a letra sorteada antes de dar STOP.');
        room.phase='review';room.stoppedBy=c.id;room.reviewEnds=Date.now()+60000;
      } else if(m.type==='vote') {
        if(room.phase!=='review'||!room.roster.includes(c.id)||!room.roster.includes(m.owner)||!Number.isInteger(m.index)||m.index<0||m.index>6||typeof m.valid!=='boolean')throw Error('Voto inválido.');
        room.votes[c.id] ||= {};room.votes[c.id][m.owner] ||= {};room.votes[c.id][m.owner][m.index]=m.valid;
      } else if(m.type==='finish') {
        if(room.phase!=='review'||c.id!==room.host)throw Error('Somente o anfitrião pode encerrar a revisão.');
        if(!allVoted(room)&&Date.now()<room.reviewEnds)throw Error('Aguarde todos votarem ou o prazo de 60 segundos.');finishRound(room);
      } else if(m.type==='cancel') {
        if(c.id!==room.host || room.phase!=='playing')throw Error('Ação não permitida.');room.phase='results';room.results=null;
      } else throw Error('Ação desconhecida.');
      broadcast(room);
    } catch(error){send(ws,{type:'error',message:error instanceof SyntaxError?'Pedido inválido.':error.message});}
  });
});
const timer=setInterval(()=>{
  for(const ws of wss.clients){if(!ws.alive)ws.terminate();else{ws.alive=false;ws.ping();}}
  for(const [key,r] of rooms)if(!Object.values(r.players).some(p=>p.online)&&Date.now()-r.updated>3600000)rooms.delete(key);
},15000);timer.unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`STOP disponível na porta ${server.address().port}`));
