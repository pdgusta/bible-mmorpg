# Núcleo do jogo, controle, troca de personagem e câmeras

Arquivos:
- `src/jogo/{Jogo,Personagem,IA,Interacoes,Controle,Troca}.ts`
- `src/camera/{CameraTerceira,Copas,CameraTroca,Cinematica,TransicaoEra}.ts`
- `e2e/teste-troca.mjs`

## Jogo (`src/jogo/Jogo.ts`)

- **Campos:** `render`, `cena`, `ceu`, `ativos`, `entrada`, `eventos`, `cam`, `mundo`, `corpos`, `natureza`, `ativo`, `flags`, `ui?`, `troca`, `controle`, `cinematica`, `prova` (`{id, tipo?, livre}` ou nulo), `transicao`, `escalaTempo`, `focoExterno`, `controleLivre`, `pausado`.
- **Mundo e personagens:**
  - `carregarBase(progresso?)` carrega os humanos e a natureza.
  - `definirMundo(m)` troca o mundo e descarta o anterior.
  - `criarPersonagem(def, x, z, yaw)` e `personagem(id)`.
- **Controle:** `controlar(p, {anterior?: 'esperar' | 'rotina' | 'manter'})` passa o controle; o anterior volta para a IA.
- **Bloqueios:**
  - `bloquear(motivo)` devolve a função que desfaz; também existem `liberar(motivo)`, `bloqueado(motivo?)` e o getter `podeTrocar`.
  - O `Jogo` ouve 'dialogo:inicio'/'dialogo:fim' (com contador) e 'prova:inicio'/'prova:fim' para bloquear sozinho.
  - `podeTrocar` ignora `ui.menuAberto()` enquanto a roda de personagens está aberta.
- **Laço:** `aCadaQuadro(fn)` registra um callback e devolve a função que o desliga. `iniciar()` dispara o laço.
- **Testes:** `manual = true` faz o laço só renderizar; `avancar(seg, dt?)` avança a simulação; `renderizar()` desenha um quadro.

## Personagem e IA

- **`Personagem`:**
  - `DefPersonagem`: id, nome, classe, aparência, ficha, jogável, protagonista, rotina.
  - `pode(verbo)`, `carregar(item)`, `entrarPosto`/`sairPosto`, `teleportar`.
  - Fôlego: com `cansado`, anda devagar e só volta a correr com 30% recuperado. `modVelocidade`.
  - Escalada: `escalada`, `iniciarEscalada(e, peloTopo)`, `sairEscalada(onde)`, `escalando`, `velocidadeEscalada`.
  - Pulo com tolerância antes de tocar o chão e logo depois de sair da borda.
- **`Comando`:** `{x, z, correr, pular, agachar, subir?}`.
- **IA (`ControladorIA`):**
  - Rotinas por hora (`EntradaRotina`, com `se`/`senao` por flag).
  - Ordens `rotina`, `esperar`, `seguir`, `ir`; `moverCena(x, z, vel)` nas cinemáticas.
  - Navega pela grade A* de `mundo.nav`. Quem segue espera embaixo enquanto o líder escala.

## Interações (`Interacoes.ts` + `Controle.ts`)

- **`Interativo`:** `id`, `pos`, `raio`, `rotulo`, `verbo`, `segurar?` (segundos), `ativo`, `dica?`, `marcador?`, `aoInteragir`, `aoProgresso?`, `animacao?`, `carregando?`, `posto?`, `aoSairPosto?`.
- **`Controle`, a cada quadro:**
  - Prompt do interativo mais próximo, enviado a `ui.prompt` só quando muda. Se o personagem não tem o verbo, mostra a `dica`.
  - **E:** toque, ou segurar com progresso e animação. Emite 'interacao' `{id, personagem}`.
  - **Postos:** E entra no posto, por exemplo segurar o guincho, e o personagem fica lá mesmo depois da troca. E de novo sai. API: `ocupante(id)`, `liberarPosto(p)` e `usar(p, id)` (atalhos e testes).
  - **Escalada:** usa `mundo.escaladas`, só para quem tem o verbo `escalar`. W/S sobem e descem, e o personagem sai no topo ou na base.
  - **Q** emite 'habilidade', **R** (segurar) faz a pose de oração e emite 'oracao', **F** alterna seguir/esperar no companheiro mais próximo e emite 'comando'.
  - Nas provas, Q/R/F não emitem eventos. Nas provas `livre` (medo), o E continua valendo.
  - Outros eventos: 'posto' `{id, personagem, entrou}` e 'escalada' `{id, personagem, fase}`.

## Troca de personagem (`Troca.ts` + `CameraTroca.ts`)

- **API:**
  - `trocarPara(id): Promise<void>`, `disponiveis()`, `jogaveis()`, `itensRoda()`, `atividadeDe(p)`, `ciclar(±1)`.
  - Campos: `emAndamento`, `ordem` (ids na ordem das teclas), `modoAnterior`, `rodaAberta`.
- **Teclas:**
  - 1–5 e os bumpers do controle trocam direto.
  - Tab abre `ui.rodaPersonagens` ao apertar e chama `ui.fecharRoda()` ao soltar. A troca acontece quando a promessa da roda resolve.
  - Com a roda aberta, o tempo corre a 0,25×.
- **Câmera:**
  - Sobe em 3 saltos, viaja pelo céu e desce em 3 saltos, em cerca de 2,5 s.
  - Dessatura e esfria a imagem com filtro CSS mais o véu `#filtro-troca`. No alto, a neblina se abre.
  - Pousa exatamente na pose da câmera de jogo, e a legenda "Nome — atividade" aparece na descida.
- **Eventos:** 'troca:inicio', 'troca:fim' e 'troca:salto' `{fase, i}` (gancho do som de sopro).

## Câmeras

- **`CameraTerceira`:**
  - `encaixar(pos, yaw, fisica?)`, `entradaMouse`, `atualizar(dt, foco, fisica)`, `frente()`, `direita()`, `yaw`, `pitch`, `distancia`, `distanciaAlvo`, `externo`.
  - 5 raios evitam atravessar paredes (raios laterais que nascem dentro de uma parede são ignorados).
  - `copas` (uma `CopasCamera`, ligada pelo `Jogo.definirMundo` com a `Natureza` do mundo): o raio central também para antes da copa das árvores (elipsoide de 85% da caixa da folhagem; a copa que já contém o pivô não conta). Ver `Natureza.copas()` em `tecnico/motor.md`.
  - No gamepad, a câmera volta para trás do personagem.
- **`Cinematica`** (implementa `ServicoCinematica`):
  - `para(pos, alvo, dur)` faz uma curva que passa por cima do relevo.
  - Também `cortar`, `voltar(d = 1)`, `devolver`, `cancelar` e o estado `ativa`.

## Transição de era (`TransicaoEra.ts`)

Chamada: `transicaoEra(jogo, {de, criarMundo, criarProtagonista, nomes, aoNome?, eras?, hora?, intervaloNomes?})`.

É visualmente o oposto da troca:
1. Zoom em órbita até o rosto do protagonista, com luz dourada (`Ceu.gloria`, filtro CSS e `#filtro-era`).
2. O mundo se dissolve pela faixa radial `GLOBAIS.uRaio`.
3. `criarMundo()` roda já no close, com o laço girando: não há tela de carregamento.
4. Clarão, `definirMundo` e depois `criarProtagonista`.
5. `compileAsync` dos shaders.
6. O novo mundo se revela numa onda a partir do personagem, e a câmera se afasta até a pose de jogo.

Detalhes:
- Os nomes da genealogia saem por `aoNome`. Ligue `(n, i) => ui.genealogia(n, i)` e, no fim, chame `ui.genealogia(null)`.
- Emite 'era:transicao' quando recebe `eras`.
- **Atenção:** o terreno usa os mesmos uniforms (`GLOBAIS.uCentro`/`uRaio`). As faixas de `Shaders.ts` vêm encadeadas: a vegetação e as instâncias encolhem nos 20 m de dentro, e o terreno e as estruturas afundam nos 20 m de fora (ver `tecnico/motor.md`). A transição só escreve nos `GLOBAIS`. A água não tem revelação: a malha fica escondida durante a transição.

## Teste (`node e2e/teste-troca.mjs [pasta] [--era]`)

- **Modo troca (30 verificações):**
  - A tecla 3 leva a Cam, e Noé fica parado em "esperar".
  - Cam entra no posto do guincho e continua lá depois da troca.
  - Jafé anda e escala até o topo.
  - Noé recebe a dica "Jafé pode escalar isto".
  - O diálogo bloqueia a troca.
  - F alterna seguir/esperar, E solta o posto, e a cinemática vai e volta.
- **Modo `--era`:** a transição completa termina, o controle passa ao novo protagonista e não há erros no console.
- **HMR:** o teste simula o websocket do Vite para que outro agente salvar um arquivo não recarregue a página. Use a mesma técnica em todo e2e longo.

## Pendências

- Cinemática em trilho com vários pontos.
- Cair ao soltar no meio da escalada: hoje o E só solta perto da base ou do topo.
- Dar revelação à água (tarefa do motor).
