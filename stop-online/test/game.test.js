import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startRound,finishRound,allVoted,eligible} from '../game.js';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import WebSocket from 'ws';
test('acentos, maioria, empate e teto de 35 pontos',()=>{
 assert.equal(eligible('Árvore','A'),true);assert.equal(eligible('Banana','A'),false);
 const r={players:{a:{online:true,score:0},b:{online:true,score:0}},used:[],round:0,history:[]};startRound(r);r.letter='A';r.answers={a:Array(7).fill('Árvore'),b:Array(7).fill('Amora')};
 r.votes={a:{a:Array(7).fill(true),b:Array(7).fill(true)},b:{a:Array(7).fill(true),b:Array(7).fill(false)}};
 assert.equal(allVoted(r),true);finishRound(r);assert.equal(r.players.a.score,35);assert.equal(r.players.b.score,0);startRound(r);assert.equal(r.players.a.score,35);
});
test('dois clientes: sala, segredo, STOP, revisão, placar, reconexão e nova rodada',async t=>{
 const proc=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0'}});t.after(()=>proc.kill());
 const [out]=await once(proc.stdout,'data');const port=String(out).match(/porta (\d+)/)[1];
 async function client(){const ws=new WebSocket(`ws://localhost:${port}/ws`,{origin:`http://localhost:${port}`});const queue=[];let notify;ws.on('message',raw=>{queue.push(JSON.parse(raw));notify?.();});await once(ws,'open');t.after(()=>ws.close());return {ws,send:(type,data={})=>ws.send(JSON.stringify({type,...data})),async wait(predicate){const until=Date.now()+4000;while(Date.now()<until){const i=queue.findIndex(predicate);if(i>=0)return queue.splice(i,1)[0];await new Promise(resolve=>{const timer=setTimeout(resolve,50);notify=()=>{clearTimeout(timer);resolve();};});}throw Error('Timeout aguardando mensagem');}};}
 const a=await client(),b=await client();a.send('create',{name:'Ana'});const sa=await a.wait(m=>m.type==='session');b.send('join',{name:'Bia',code:sa.code});const sb=await b.wait(m=>m.type==='session');await a.wait(m=>m.type==='state'&&Object.keys(m.room.players).length===2);
 b.send('start');await b.wait(m=>m.type==='error');a.send('start');const state=await a.wait(m=>m.room?.phase==='playing');const letter=state.room.letter;
 await b.wait(m=>m.room?.phase==='playing');assert.equal(JSON.stringify(state).includes(sa.token),false);
 for(let i=0;i<7;i++)a.send('answer',{index:i,value:letter+'palavra'});
 a.send('stop');await a.wait(m=>m.room?.phase==='review');await b.wait(m=>m.room?.phase==='review');b.send('answer',{index:0,value:letter+'tardia'});await b.wait(m=>m.type==='error');
 for(const c of [a,b])for(let i=0;i<7;i++)c.send('vote',{owner:sa.id,index:i,valid:true});await a.wait(m=>m.room?.allVoted);a.send('finish');const result=await a.wait(m=>m.room?.phase==='results');assert.equal(result.room.players[sa.id].score,35);assert.equal(result.room.players[sb.id].score,0);
 a.send('finish');await a.wait(m=>m.type==='error');a.send('start');const next=await a.wait(m=>m.room?.phase==='playing'&&m.room.round===2);assert.notEqual(next.room.letter,letter);assert.equal(next.room.players[sa.id].score,35);
 const close=once(b.ws,'close');b.ws.close();await close;const resumed=await client();resumed.send('resume',{code:sb.code,token:sb.token});const restored=await resumed.wait(m=>m.type==='session');assert.equal(restored.id,sb.id);
});
