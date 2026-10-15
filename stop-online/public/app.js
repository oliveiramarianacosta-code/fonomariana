const $=id=>document.getElementById(id);
const categories=['Nome','CEP (cidade/estado/país)','Time de futebol','Animal','Cor','Fruta','Objeto'];
const normalized=s=>s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
let socket,session=JSON.parse(sessionStorage.getItem('stop-session')||'null'),room,connected=false,retry,toast;
const localEndpoint=`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`;
let endpoint=localStorage.getItem('stop-endpoint') || (location.hostname.endsWith('.here.now')?'wss://stop-fonomariana.onrender.com/ws':localEndpoint);
$('endpoint').value=endpoint;
function message(s){$('message').textContent=s;clearTimeout(toast);toast=setTimeout(()=>$('message').textContent='',6500);}
function send(type,data={}){if(!connected){message('Conecte um servidor online para jogar.');return;}socket.send(JSON.stringify({type,...data}));}
function connect(){
 clearTimeout(retry);if(socket){socket.onclose=null;socket.close();}connected=false;
 if(!endpoint){$('connection').textContent='Servidor não configurado';$('setup').open=true;return;}
 try{const u=new URL(endpoint);if(!['ws:','wss:'].includes(u.protocol)||u.username||u.password)throw Error();if(location.protocol==='https:'&&u.protocol!=='wss:')throw Error();socket=new WebSocket(endpoint);}catch{message('Use um endereço válido: wss://seu-servidor.com/ws');return;}
 $('connection').textContent='Conectando…';
 socket.onopen=()=>{connected=true;$('connection').textContent='● Conectado';if(session)send('resume',session);render();};
 socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='error'){message(m.message);if(m.message.includes('expirou')){session=null;sessionStorage.removeItem('stop-session');room=null;render();}}if(m.type==='session'){session=m;sessionStorage.setItem('stop-session',JSON.stringify(m));}if(m.type==='state'){room=m.room;render();}if(m.type==='left'){session=null;room=null;sessionStorage.removeItem('stop-session');render();}};
 socket.onclose=e=>{connected=false;$('connection').textContent='● Desconectado';render();if(e.code===4001){session=null;sessionStorage.removeItem('stop-session');message('Esta sessão foi aberta em outra aba.');return;}retry=setTimeout(connect,3000);};
 socket.onerror=()=>{$('connection').textContent='Servidor indisponível';};
}
$('connect').onclick=()=>{const value=$('endpoint').value.trim();if(value!==endpoint){session=null;room=null;sessionStorage.removeItem('stop-session');}endpoint=value;localStorage.setItem('stop-endpoint',endpoint);connect();render();};
$('create').onclick=()=>send('create',{name:$('name').value});$('join').onclick=()=>send('join',{name:$('name').value,code:$('code').value});
$('start').onclick=()=>send('start');$('stop').onclick=()=>send('stop');$('finish').onclick=()=>send('finish');$('cancel').onclick=()=>{if(confirm('Cancelar esta rodada sem atribuir pontos?'))send('cancel');};$('leave').onclick=()=>{if(connected)send('leave');else{session=null;room=null;sessionStorage.removeItem('stop-session');render();}};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);message('Código copiado!');}catch{message(`Código da sala: ${room.code}`);}};
const fields=categories.map((name,index)=>{const wrapper=document.createElement('div'),label=document.createElement('label'),input=document.createElement('input');label.textContent=name;label.htmlFor=`answer-${index}`;input.id=label.htmlFor;input.maxLength=60;input.autocomplete='off';input.oninput=()=>send('answer',{index,value:input.value});wrapper.append(label,input);$('fields').append(wrapper);return input;});
function text(tag,value){const el=document.createElement(tag);el.textContent=value;return el;}
let lastRound='';
function render(){
 $('welcome').hidden=!!room;$('game').hidden=!room;if(!room)return;
 const me=session?.id,host=room.host===me,playing=room.phase==='playing',review=room.phase==='review';
 $('roomcode').textContent=room.code;$('letter').textContent=room.letter||'?';$('round').textContent=room.round?`RODADA ${room.round} · ATÉ 35 PONTOS`:'SALA DE ESPERA';
 $('phase').textContent={lobby:'Quem vai jogar com você?',playing:'Valendo! Pense rápido.',review:'STOP! Hora de conferir.',results:'Pontos na conta!'}[room.phase];
 $('hint').textContent={lobby:'Compartilhe o código. O anfitrião começa quando houver 2 jogadores.',playing:'Complete as 7 categorias com a letra sorteada para dar STOP.',review:`${room.players[room.stoppedBy]?.name||'Alguém'} deu STOP! Maioria aprova; empate vale zero.`,results:room.results?'Prontos para mais uma letra?':'Rodada cancelada, sem pontos.'}[room.phase];
 $('fields').hidden=!playing;$('stop').hidden=!playing;$('stop').disabled=!connected;
 $('start').hidden=!host||!['lobby','results'].includes(room.phase);$('start').disabled=!connected||Object.values(room.players).filter(p=>p.online).length<2;
 $('finish').hidden=!host||!review;$('cancel').hidden=!host||!playing;
 const roundKey=`${room.code}:${room.round}`;
 fields.forEach((input,i)=>{input.disabled=!playing||!connected||!room.roster.includes(me);if(lastRound!==roundKey||document.activeElement!==input)input.value=room.answers[me]?.[i]||'';});lastRound=roundKey;
 $('players').replaceChildren(...Object.entries(room.players).sort((a,b)=>b[1].score-a[1].score).map(([id,p])=>{const li=document.createElement('li'),name=text('span',p.name+(id===me?' (você)':''));name.append(text('small',`${p.online?'Conectado':'Ausente'}${id===room.host?' · anfitrião':''}`));li.append(name,text('strong',`${p.score} pts`));return li;}));
 $('review').replaceChildren();
 if(review||room.results)for(const owner of room.roster){const card=document.createElement('section');card.className='card review-card';card.append(text('h3',`${room.players[owner].name}${room.results?' · '+room.results[owner].total+' pontos':''}`));room.answers[owner].forEach((answer,index)=>{const row=document.createElement('div');row.className='review-row';const word=text('div',answer||'—');word.prepend(text('small',categories[index]));row.append(word);if(review){if(!answer.trim()||!normalized(answer).startsWith(room.letter))row.append(text('small','Inválida · 0 pontos'));else if(room.roster.includes(me)){const votes=document.createElement('div');votes.className='votes';for(const [valid,label]of [[true,'Vale ✓'],[false,'Não vale ×']]){const b=text('button',label);b.className='secondary'+(room.votes[me]?.[owner]?.[index]===valid?' selected':'');b.setAttribute('aria-pressed',String(room.votes[me]?.[owner]?.[index]===valid));b.disabled=!connected;b.onclick=()=>send('vote',{owner,index,valid});votes.append(b);}row.append(votes);}}else row.append(text('span',`+${room.results[owner].points[index]} pts`));card.append(row);});$('review').append(card);}
 updateTimer();
}
function updateTimer(){if(room?.phase==='review'){const seconds=Math.max(0,Math.ceil((room.reviewEnds-Date.now())/1000));$('finish').disabled=!connected||(!room.allVoted&&seconds>0);$('finish').textContent=room.allVoted||!seconds?'Fechar revisão e somar pontos':`Aguardando votos · ${seconds}s`;}}
setInterval(updateTimer,500);connect();
