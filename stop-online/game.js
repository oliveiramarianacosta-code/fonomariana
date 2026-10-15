import { randomInt, randomBytes } from 'node:crypto';
export const categories = ['Nome','CEP (cidade/estado/país)','Time de futebol','Animal','Cor','Fruta','Objeto'];
export const normalize = text => text.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
export const eligible = (answer, letter) => typeof answer === 'string' && normalize(answer).startsWith(letter);
export const code = () => randomBytes(5).toString('hex').toUpperCase();
export function startRound(room) {
  const ids = Object.keys(room.players).filter(id => room.players[id].online);
  if (ids.length < 2) throw Error('São necessários pelo menos 2 jogadores conectados.');
  const letters = 'ABCDEFGHIJKLMNOPRSTUV'.split('').filter(l => !room.used.includes(l));
  if (!letters.length) { room.used = []; letters.push(...'ABCDEFGHIJKLMNOPRSTUV'); }
  room.letter = letters[randomInt(letters.length)]; room.used.push(room.letter);
  room.round++; room.phase = 'playing'; room.roster = ids; room.answers = {}; room.votes = {}; room.results = null;
  ids.forEach(id => room.answers[id] = Array(7).fill(''));
}
export function allVoted(room) {
  return room.roster.every(voter => room.roster.every(owner => room.answers[owner].every((a,i) => !eligible(a,room.letter) || typeof room.votes[voter]?.[owner]?.[i] === 'boolean')));
}
export function finishRound(room) {
  room.results = {};
  for (const owner of room.roster) {
    const points = room.answers[owner].map((answer,i) => eligible(answer,room.letter) && room.roster.filter(v => room.votes[v]?.[owner]?.[i] === true).length > room.roster.length / 2 ? 5 : 0);
    const total = points.reduce((a,b) => a+b,0);
    room.players[owner].score += total;
    room.results[owner] = {points,total};
  }
  room.history.push({round:room.round, letter:room.letter, results:structuredClone(room.results)});
  room.phase = 'results';
}
