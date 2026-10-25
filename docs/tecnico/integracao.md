# Integração: fluxo da partida, ligações entre módulos e e2e

Arquivos:
- `src/main.ts` (ramo do jogo) e `src/jogo/inicio.ts` (entrada; `?teste=troca|era` abre o cenário de teste antigo)
- `src/jogo/Partida.ts` (fluxo) e `src/jogo/eras.ts` (registro de eras)
- `src/jogo/ligacao/{noe,abraao,audio,comum,depuracao}.ts`
- `e2e/integracao.mjs`, `e2e/utilidades.mjs`

## Partida (`src/jogo/Partida.ts`)

- **Criação:** `Partida.criar(canvas, raiz)` carrega a Bíblia, registra memórias e missões de todas as eras, cria a `UI` (com a tela de carregamento), o `Jogo` e os sistemas (`criarSistemas`), monta a primeira era e abre o título. Expõe `window.jogo`, `window.partida` e, 30 quadros depois do título, `window.pronto`. O progresso de `jogo.carregarBase` alimenta a tela de carregamento só durante a carga base: no fim, `ativos.aoProgresso` é desligado, e modelos carregados depois (animais) não reabrem a tela.
- **Modos:** `modo` é `'carregando' | 'titulo' | 'jogo'`.
  - Título: câmera externa em órbita lenta (`EraAtiva.vistaTitulo()`), céu parado, ninguém sob controle, HUD escondido, `ui.tituloSobre3D(true)`.
  - Jogo: `comecarJogo(id)` entrega o controle, encaixa a câmera e liga o HUD.
- **Fluxo:**
  - `novoJogo()` reaproveita o mundo do título se ele ainda está limpo (`EraAtiva.sujo`), senão monta outro; depois `s.novoJogo()` e a missão inicial da primeira era.
  - `continuar()` carrega o save mais recente (automático ou manual).
  - `carregar(slot)` monta a era do save, aplica `s.aplicar(d)`, chama `era.reconstruir()` (o mundo segue as flags), entrega o controle a `d.ativo` e retoma a missão.
  - `salvar(slot)` e `sairParaTitulo()` (a missão para; o mundo fica).
  - `limparSessao()` fecha tudo o que a sessão anterior deixou na tela (missão, prova, fala, cinemática, genealogia, balanço da câmera).
- **Transição de era:** a missão final de uma era chama `servicos.transicaoEra(nomes)`; a Partida roda `transicaoEra(jogo, …)` com `aoNome: (n, i) => ui.genealogia(n, i)`, monta a era seguinte dentro de `criarMundo`, troca os serviços em `criarProtagonista` e chama `ui.genealogia(null)` no fim.
- **Começo da era seguinte:** a última missão de uma era não tem `proxima`. Ao concluí-la, `aoConcluirMissao` começa `DefEra.seguinte.missao` (B1 depois de A6) se a era seguinte já estiver montada e tiver essa missão; senão mostra um aviso.
- **Aponta para Cristo:** `ctx.cristo(id)` liga a flag `cristo_<id>` (`flagCristo`) e avisa; o Diário mostra as entradas com a flag.
- **Por quadro:** áudio, FPS, órbita do título, HUD, teclas J (Diário) e Esc (pausa) quando a UI está fechada, e o Diário quando algo mudou (a cada 2 s no máximo).
- **Configurações:** qualidade troca o preset do `Renderizador` (céu, sombra, natureza e grama); sensibilidade e inverter Y vão para a câmera; volumes para o áudio. `?q=` fixa a qualidade.

## Registro de eras (`src/jogo/eras.ts`)

- `ERAS`, `ORDEM_ERAS = ['noe', 'abraao']`, `defEra(id)` e `NOMES_ERAS`.
- `DefEra`: id, nome, sub, protagonista, missão inicial, jogáveis, NPCs, missões, memórias, Cristo, `seguinte`, texto de carregamento, hora de chegada e `criar(ctx)`.
- `EraAtiva`: `mundo`, `sujo`, `criarPersonagens()`, `posicoesIniciais()`, `ligar()`/`desligar()`, `reconstruir()`, `vistaTitulo()`, `ambiente()` e `atalhos?(op)`.
- `ContextoEra`: `jogo`, `ui`, `s`, `audio`, `transicaoEra(nomes)`, `cristo(id)` e `creditos()` (resumo da jornada na camada do título, que fica acima do fade preto com que a B5 termina, e depois a tela de créditos; resolve quando ela fecha).

## Ligações (`src/jogo/ligacao/`)

- **`noe.ts`:** `ERA_NOE_JOGO` monta `MundoNoe` e implementa `ServicosNoe`: vale, céu, áudio, animais (`criarAnimal`), progresso, câmera (`tremer`, `balanco`), Cristo, `controlar`, `liberarPosto`, `removerPersonagem` e `transicaoEra`. Reconstrói o vale por `ERA_NOE.reconstruir` e calcula o ambiente sonoro por área e estado do dilúvio.
- **`abraao.ts`:** `ERA_ABRAAO_JOGO` monta `MundoCanaa` (com `canaa.ceu = jogo.ceu`), cria jogáveis e NPCs em `INICIO_ABRAAO` e implementa `ServicosAbraao`: Canaã, céu, áudio, animais e rebanhos (`Rebanho` em `mundo.atualizaveis`), progresso, câmera, entrada, `aCadaQuadro`, Cristo, `controlar`, `liberarPosto`, `emitir`, `criarPersonagem`, `removerPersonagem` e `creditos` (pelo `ContextoEra`). `ligar()` registra os segredos; `desligar()` chama `ligarServicosAbraao(null)` e `ERA_ABRAAO.limparCena()`. Última era: sem `seguinte`; depois de B5 a Partida volta ao título.
- **`audio.ts`:** `PonteAudio` liga `Audio.iniciarNoPrimeiroGesto()`, efeitos de eventos (troca, interação, memória, nível), passos, música por estado e ambientes (pedidos das missões somados à área da era).
- **`comum.ts`:** `estadoMissaoAtual`, `esperarJogo`, `removerPersonagem` (nunca remove quem está sob controle), `desvio` e `reiniciarPessoa`.
- **`depuracao.ts`:** `?dev&missao=a3` (ou `b3`) começa o novo jogo pela era que tem a missão (`eraDaMissao`, em `eras.ts`) e pula pelos atalhos dela; `?dev&auto=1` joga sozinho; `?dev&hora=`, `?dev&pos=x,z`. Para o e2e: `partida.dev.avancar(seg, passo)` avança a lógica em modo manual passando as falas; `ligarCapturas()` e `liberar()` param em momentos de foto. `jogar()` recusa com erro se já há atalhos rodando: com `?dev&missao`, o `pularPara` continua depois do modo `'jogo'`, e um segundo runner dividiria o mesmo `fim` (espere `dev.fim && !jogo.manual`). Quando a sessão acaba (título, novo jogo, carregar), o `limparSessao` da `Partida` chama `dev.encerrar()`: o runner em curso é solto (`fim` verdadeiro, sem erro), o próximo `jogar()` é aceito e o runner antigo morre na próxima espera, sem mexer no novo. Os laços que dirigem o runner (`avancar`, `pularPara`, `jogarSozinho`) voltam no fim do passo em curso sem mais nenhum efeito. O `jogo.manual` só é desligado se foi o `pularPara`/`jogarSozinho` que o ligou; se foi o e2e, fica com ele. `animais()` dá os animais vivos e o centro deles (`Animal.todos` do jogo; o e2e não importa o `Animal` pelo Vite, porque um módulo editado depois que o servidor subiu vem com `?t=` e a página carregaria outra instância).

## Câmera (pendências recebidas, já atendidas)

- `CameraTerceira.tag = 'invisivel'`: os raios de colisão da câmera atravessam colisores com essa tag (paredes invisíveis do Moriá).
- `cam.tremer(intensidade, segundos)` e `cam.balanco(intensidade)` valem por cima de qualquer controlador (jogo, cinemática, troca, transição).

## Nova era

1. Escreva o conteúdo em `src/eras/<era>/` (modelo: `src/eras/noe/`), com `index.ts` exportando a definição da era.
2. Crie `src/jogo/ligacao/<era>.ts` com uma classe que implementa `EraAtiva` e os serviços da era, e exporte a `DefEra`.
3. Registre-a em `ERAS` e `ORDEM_ERAS` (`src/jogo/eras.ts`) e ponha `seguinte` na era anterior.

## e2e

- `node e2e/integracao.mjs [pasta]`: do carregamento até A1 jogável (título sobre o vale, Novo jogo, prólogo, HUD, andar, Diário, pausa, salvar no espaço 1; depois muda a posição de Noé e uma flag, sai para o título e carrega o espaço 1 pelo menu, conferindo que posição e flag voltam). Fotos em `e2e/saida/integracao/`. Leva uns 2 min no SwiftShader: o laço fica parado e só as fotos renderizam.
- `--transicao`: joga o resto da era 1 pelos atalhos e confere a transição para Canaã (genealogia mostrada e limpa, Abrão no controle, B1 jogável). Leva uns 14 min; fotos de A6 (arco-íris), da genealogia e de B1. Confere também que a tela de carregamento não fica por cima do jogo.
- Nos dois modos, o roteiro termina conferindo os créditos: com o fade preto ligado, o resumo da jornada aparece por cima dele e depois a tela de créditos (fotos `9-creditos-resumo` e `10-creditos`).
- `e2e/jogar-mvp.mjs` (`npm run e2e`) ainda não existe.
- Os testes simulam o websocket do Vite (`abrir()` em `e2e/utilidades.mjs`), para o HMR não recarregar a página.
- No Git Bash do Windows, use `MSYS_NO_PATHCONV=1` antes de `node e2e/foto.mjs "/..."`, senão o `/` vira um caminho do Windows.
