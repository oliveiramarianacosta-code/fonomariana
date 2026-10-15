# STOP!
Jogo responsivo em português, HTML/CSS/JavaScript, layout azul, para 2 a 12 participantes. Alternativa ao Firebase: servidor Node.js autoritativo com WebSocket. Não precisa de conta Firebase ou chave de API.

## Rodar no computador
1. Instale Node.js 22 ou superior.
2. Abra um terminal nesta pasta e execute `npm ci`.
3. Execute `npm start`.
4. Abra http://localhost:3000 em dois navegadores ou dispositivos. Em outro aparelho na mesma rede, use `http://IP-DO-COMPUTADOR:3000` e permita a porta no firewall. O servidor precisa continuar ligado.
5. Informe o nome, crie uma sala e compartilhe seu código. O segundo jogador entra pelo código. O anfitrião inicia a rodada.

`npm test` executa testes da pontuação e de duas conexões reais ao servidor. A interface deve ser servida via HTTP/HTTPS; não abra index.html diretamente pelo sistema de arquivos.

## Publicar a interface no here.now
A pasta `public/` contém somente os arquivos públicos. O here.now hospeda essa interface estática; **não executa o servidor Node.js deste projeto**. Não é suficiente publicar o HTML para ativar o multiplayer.

1. Publique `public/` no here.now.
2. Hospede esta pasta de projeto em um serviço que execute Node.js continuamente e aceite WebSocket, com comando de instalação `npm ci` e inicialização `npm start`. Use uma única instância. Configure a porta pela variável `PORT`, fornecida normalmente pelo provedor.
3. No servidor, configure `PUBLIC_ORIGIN` com a origem exata do site, por exemplo `https://SEU-SITE.here.now`, sem barra final. Reinicie o processo após mudar a variável. Essa opção também funciona se toda a aplicação for hospedada no próprio servidor.
4. Ative HTTPS no provedor. O WebSocket público deve ser `wss://SEU-SERVIDOR/ws`. Caso utilize proxy reverso, ele precisa encaminhar o upgrade WebSocket e manter conexões longas.
5. No site, abra “Configurar conexão online”, cole esse endereço e clique em “Conectar servidor”. Cada jogador deve configurar o mesmo servidor. O endereço fica salvo apenas no próprio navegador. Para pré-configurá-lo para todos, altere a constante `localEndpoint` e o valor padrão de `endpoint` em `public/app.js` e republique.
6. Verifique com dois aparelhos: criação, entrada, letra idêntica, STOP, revisão, pontos, reconexão e segunda rodada.

Nenhum servidor público ou serviço pago foi provisionado automaticamente. Não publique node_modules, tokens ou arquivos internos do publicador.

## Regras do jogo
- Categorias: Nome; CEP (cidade, estado ou país); Time de futebol; Animal; Cor; Fruta; Objeto.
- Sorteio compartilhado, sem repetir letras até esgotar o conjunto `ABCDEFGHIJKLMNOPRSTUV`. Edite o conjunto em `game.js` para incluir outras letras.
- É preciso preencher as sete categorias com a inicial correta para dar STOP. A verificação ignora acentos e espaços nas extremidades.
- O servidor processa as ações na ordem em que chegam. O primeiro STOP aceito congela a rodada para todos; respostas que chegam depois são rejeitadas. A propagação visual depende da latência da rede.
- Respostas dos outros jogadores ficam ocultas durante a rodada, inclusive no protocolo enviado ao navegador.
- Na revisão todos votam em cada resposta, incluindo as próprias. A categoria semântica é julgada pelo grupo, não por um dicionário automático. Uma resposta precisa de mais da metade dos votos de TODOS os participantes daquela rodada. Empate, ausência de maioria, campo vazio ou inicial incorreta = 0. Respostas repetidas podem valer 5 para cada jogador.
- Cada resposta aprovada vale 5; máximo de 35 por rodada. A revisão pode ser fechada pelo anfitrião quando todos votarem ou após 60 segundos. Votos ausentes não contam como aprovação. Isso permite continuar se alguém desconectar.
- O anfitrião pode cancelar uma rodada travada sem atribuir pontos. Os pontos anteriores são mantidos. Não há pontuação extra por dar STOP.
- Novos participantes entram somente na sala de espera ou entre rodadas. Um jogador desconectado retoma a identidade ao reconectar na mesma aba, enquanto a sala existir. A sessão fica no sessionStorage; use navegadores ou perfis diferentes para simular jogadores com segurança.
- O anfitrião é transferido a outro jogador conectado se sair. Nomes e pontos de quem saiu permanecem no placar; sair explicitamente e entrar novamente cria outra identidade. Limite de 12 identidades por sala e 100 rodadas.

## Segurança e operação
O servidor é a autoridade: o cliente não escolhe a letra, não altera placares, não escreve respostas alheias e não modifica respostas depois do STOP. Somente o anfitrião inicia/cancela rodadas e encerra a revisão. Entradas, fases, tamanho de mensagens (8 KB), tamanho de nomes/respostas e tipos de votos são validados no servidor. Não existe endpoint genérico para editar o estado.

Códigos de sala são convites de 40 bits, gerados com criptografia. A reconexão usa um token de 256 bits, entregue somente ao dono da sessão. Tokens nunca são incluídos no estado compartilhado. Quem conhece o código pode entrar nos intervalos; não há contas, senha de sala ou verificação de identidade. Não compartilhe códigos publicamente para partidas privadas.

O upgrade verifica a origem exata (`PUBLIC_ORIGIN` em produção); o cliente remoto usa WSS. A versão servida por Node aplica uma política de segurança de conteúdo e usa uma lista fechada de arquivos. Textos dos jogadores são inseridos com textContent, não HTML. No here.now, os cabeçalhos são administrados pela plataforma. A origem é uma proteção de navegador, não autenticação contra clientes personalizados.

Limites básicos: 80 ações/segundo/conexão, 500 conexões e 200 salas por processo. Para exposição pública ampla, acrescente limites por IP e proteção contra abuso no proxy/provedor. Os limites atuais não substituem proteção contra ataques distribuídos. Configure logs, orçamento e monitoramento no seu provedor.

**Persistência:** salas e pontuação existem somente na memória do servidor. Reiniciar/deployar o processo apaga as partidas; salas sem jogadores conectados expiram após uma hora. Não use múltiplas réplicas sem substituir o armazenamento e a sincronização por serviço compartilhado. Esta versão é para partidas casuais, não competição antifraude: o grupo pode combinar votos.

## Arquivos editáveis
- `public/index.html`: estrutura e textos.
- `public/style.css`: cores, layout e responsividade.
- `public/app.js`: interface e conexão.
- `server.js`: servidor, protocolo e controles de acesso.
- `game.js`: letras, validação, votos e pontuação.
- `test/game.test.js`: testes automatizados.
- `package-lock.json`: versões instaladas das dependências.

## Diagnóstico
“Servidor não configurado”: informe o endereço WSS. “Servidor indisponível”: confira processo, HTTPS, `/ws`, proxy e PUBLIC_ORIGIN. “Sala não encontrada”: confira código e se todos usam o mesmo servidor; reinicializações apagam salas. Sem conexão, campos são bloqueados; alterações não são enfileiradas para serem aplicadas depois do STOP.

Referências: [WebSocket no MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket), [biblioteca ws](https://github.com/websockets/ws), [here.now](https://here.now/docs).

## Estado da entrega
Interface publicada em https://present-garnet-x4vb.here.now/ (publicação autenticada permanente). Servidor publicado no Render: https://stop-fonomariana.onrender.com. A interface no here.now já usa wss://stop-fonomariana.onrender.com/ws automaticamente. Dois testes automatizados passaram: pontuação e fluxo com dois clientes reais. A inspeção visual no navegador integrado não foi concluída porque a ferramenta de pré-visualização não conectou.
