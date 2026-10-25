# Estado do projeto

*Atualizado em 24/10/2026, no fim da sessão na nuvem. O desenvolvimento passa para o computador do dono do projeto.*

## Resumo

O MVP (era 1 Noé → era 2 Abraão) tem quase todos os módulos prontos, testados e documentados. Faltam três frentes, interrompidas no meio quando os créditos da nuvem acabaram:
- a **integração**, com o fluxo da partida bem adiantado;
- o **motor visual**, com a passada de arte e o desempenho do vale;
- o **conteúdo da era 2**, com as missões escritas mas sem os arquivos de fechamento.

Estado do código ao sair: `npx tsc --noEmit` dá 0 erros, `npx vitest run` passa 77 de 77 testes e `npm run validar` passa sem avisos.

## Módulos

| Módulo | Estado | Doc |
|---|---|---|
| Design, ensinamentos e roteiro | ✅ | `DESIGN.md`, `ENSINAMENTOS.md`, `ROTEIRO.md` |
| Pipeline bíblico (versículos, validação, correções da fonte BKJ) | ✅ | `TECNICO.md` |
| Personagens humanos e pipeline de modelos | ✅ | `tecnico/personagens.md` |
| Núcleo, controle, troca, câmeras e transição de era | ✅ (e2e `teste-troca.mjs` passa) | `tecnico/troca-camera.md` |
| Sistemas: missões, diálogo, provas, progresso, save | ✅ (testes passam) | `tecnico/sistemas.md` |
| UI | ✅ (demo `?lab=ui`) | `tecnico/ui.md` |
| Animais e áudio | ✅ (`?lab=animais`) | `tecnico/animais-audio.md` |
| Mundo de Canaã | ✅ (`?lab=canaa`, ≤ 92 draw calls) | `tecnico/canaa.md` |
| Conteúdo da era 1 | ✅ escrito, revisado e com os 5 ajustes de lógica da revisão (branch `frente/era-noe`) | `tecnico/era-noe.md`, `tecnico/revisao.md` |
| Conteúdo da era 2 | ✅ escrito, testado e revisado · ⏳ ligação na integração (abaixo) | `tecnico/era-abraao.md` |
| Motor visual do vale de Noé | ✅ arte, transição, física e orçamento (abaixo) | `tecnico/motor.md` |
| Integração (fluxo da partida, ligações, e2e) | ✅ o MVP inteiro, do título aos créditos (e2e `npm run e2e`, `jogar-mvp.mjs`) | `tecnico/integracao.md` |
| Deploy (GitHub Pages) | ✅ workflow pronto (ativar em *Settings → Pages → GitHub Actions*) | `README.md` |

## O que ficou pela metade, frente por frente

Os briefings originais de cada frente estão em `docs/agentes/*.md`. Eles citam caminhos de um scratchpad da nuvem (`/tmp/claude-0/...`) que **não existem mais**: ignore esses caminhos e salve as fotos em `e2e/saida/` (fora do git).

### 1. Integração (`agentes/integracao.md`, `tecnico/integracao.md`)

**Feito (frente/integracao, no computador local):**
- O jogo integrado roda do título até B1. `node e2e/integracao.mjs` cobre:
  - carregamento, título sobre o vale, Novo jogo, prólogo;
  - A1 com HUD, objetivo, andar, Diário (J), pausa (Esc);
  - salvar no espaço 1; depois muda posição e flag, sai para o título e carrega pelo menu, conferindo que voltam.
- Com `--transicao`, ele joga a era 1 inteira pelos atalhos: A6 (arco-íris), transição com a genealogia de Sem a Abrão, que é limpa no fim, e B1 jogável com Abrão em Canaã. Fotos em `e2e/saida/integracao/`.
- Junções na `frente/integracao`: `frente/era-noe` (5 ajustes e o cervo), `frente/era-abraao` (até 9687739, T-020), `frente/motor` (até 2ff129e, T-008) e `frente/audio` (até 650c01b).
- Era 2 ligada (`src/jogo/ligacao/abraao.ts`):
  - `ERA_ABRAAO` com jogáveis, NPCs e início;
  - `ServicosAbraao` completo (rebanhos em `mundo.atualizaveis`, NPCs de cena, entrada, `aCadaQuadro`, créditos);
  - segredos, reconstrução pelas flags e atalhos;
  - `ligarServicosAbraao(null)` e `ERA_ABRAAO.limparCena()` ao descartar o mundo.
- Créditos e fim:
  - `ContextoEra.creditos()` mostra o resumo (memórias, segredos, tempo) e a tela de créditos, e resolve ao fechar;
  - depois de B5, a Partida volta ao título;
  - `?dev&auto=1` fecha os créditos sozinho.
- Áudio:
  - a música `batalha` e os efeitos `alarme`, `aparar`, `golpe`, `discernir` e `pedra` vieram da `frente/audio`; a B3 pede `batalha` e a `PonteAudio.musica` não tem mais fallback;
  - `Ceu.estrelas` fica opcional: o céu de B4 usa só a noite até o motor ler a propriedade.
- Dois defeitos corrigidos:
  - **Tela de carregamento por cima do jogo:** `Jogo.carregarBase` deixava `ativos.aoProgresso` ligado, e qualquer modelo carregado depois (os animais da A4) reabria a tela. Agora o callback é desligado no fim da carga base.
  - **A4 travava:** `Arca.definirEstagio` trocava os colisores do casco sem refazer `mundo.nav`, montada com a arca no estágio 0, e os animais ficavam presos na ponta oeste do casco. Agora o próprio Arca refaz a navegação na área dele a cada estágio (`tests/arca-navegacao.test.ts`).
- T-011:
  - **`Animal` preso na tela:** o `travado` disparava a cada 5 s, mas a única saída na tela era refazer a rota, e sem rota nova o bicho tremia entre dois desvios para sempre. Se travar de novo a menos de 3 m de onde travou, ele vai para o ponto com um fade de 0,6 s (`tests/animal-travado.test.ts`).
  - **`?dev&missao=b1..b5`:** o novo jogo sempre montava a era de Noé, e a missão da era 2 dava "Missão desconhecida nesta era". Agora ele começa pela era que tem a missão (`eraDaMissao`; `tests/eras.test.ts`).
  - **Câmera:** a 3ª pessoa não entra mais na copa das árvores (`Natureza.copas()` e `src/camera/Copas.ts`; `tests/camera-copas.test.ts`). A transição de era não usa mais a `FOLGA_TERRENO`, e o close da genealogia ficou a 1,5 m do rosto (antes, 0,8 m: a câmera cortava o turbante).
- T-019:
  - **Tremor do `Animal`:** as sondas de desvio de `moverChao` eram escolhidas do zero a cada 0,25 s. Num bolsão, o lado livre alternava e o bicho sacudia no lugar até o reposicionamento (7 ou 8 trocas de lado em 8 s). Agora ele guarda o lado do último desvio por 2 s e tenta os ângulos desse lado antes dos do outro (`sondasDesvio`). Assim contorna a parede por um lado só, e contorna um pilar no caminho, o que antes não conseguia em 15 s (`tests/animal-desvio.test.ts`).
  - **`?dev&missao=a4` "travado" em `a4.chamado`:** é do atalho de depuração, não do jogo. O `?dev&missao=` já roda o `pularPara`, e o `modo` vira `'jogo'` antes de ele acabar. Um `dev.jogar()` chamado nessa hora abre um segundo runner de atalhos, e os dois dividem o `dev.fim`. Quando o do `pularPara` chega em a4, o `fim` vira verdadeiro e o `dev.avancar` passa a voltar sem avançar o tempo, com `jogo.manual` ligado. Sozinho, o `?dev&missao=a4` chega e segue. Scripts devem esperar `dev.fim && !jogo.manual` antes de chamar `dev.jogar()`, como fazem o `jogar-mvp` e a medição da T-017. O conserto em `depuracao.ts` veio na T-020: o `jogar()` recusa com erro se já há outro em andamento (`tests/depuracao.test.ts`).
- `npm run validar` funciona no Windows (`fileURLToPath` em `scripts/biblia-comum.mjs`); `playwright` é dependência de desenvolvimento.
- T-013/T-018: `e2e/jogar-mvp.mjs` (`npm run e2e`, junção da `frente/jogar-mvp`) joga o MVP inteiro pelos atalhos: título, era 1, transição, era 2, fim de B5, resumo da jornada, créditos e volta ao título. Em cada momento-chave tira uma foto (`e2e/saida/mvp/`) e mede `jogo.render.gl.info.render`. Leva de 19 a 24 min no SwiftShader; rode sem o vitest junto.
- T-020: junção da `frente/era-abraao` (até 9687739: T-009, T-014 e T-016). O e2e conta os animais pelo jogo (`partida.dev.animais()`) e importa os atalhos e as missões pela URL que o jogo carregou: um módulo editado depois que o Vite subiu vem com `?t=`, e o import pelo caminho puro trazia outra instância (a A4 contava 0 animais).

**Orçamento da integração** (`npm run e2e`, preset médio, 960 × 540, as draw calls contam a passada de sombra; base `frente/integracao` com o LOD dos humanos e a T-016, antes das junções da `frente/hud`, da `frente/desempenho` e da `frente/a4`):

| Era | Vista | Etapa | Draw calls | Triângulos | Animais |
|---|---|---|---|---|---|
| noe | titulo | - | 126 | 369 mil | 0 |
| noe | a1-deus | a1.orar | 133 | 458 mil | 0 |
| noe | troca | a2.planejar | 98 | 339 mil | 0 |
| noe | a2-viga | a2.erguer | 73 | 365 mil | 0 |
| noe | a3-prova | a3.pregar | 63 | 507 mil | 0 |
| noe | a4-animais (pico, câmera para os animais) | a4.animais | 130 | 471 mil | 23 |
| noe | a5-arca | a5.fontes | 71 | 456 mil | 0 |
| noe | a6-arco | a6.bencao | 82 | 458 mil | 8 |
| noe | transicao | a6.transicao | 53 | 197 mil | 8 |
| abraao | b1-canaa | b1.altarMore | 67 | 322 mil | 8 |
| abraao | b2-manre | b2.manre | 61 | 259 mil | 18 |
| abraao | b3-batalha | b3.ataque | 134 | 419 mil | 8 |
| abraao | b4-estrelas | b4.duvida | 52 | 337 mil | 8 |
| abraao | b5-moria | b5.altar | 78 | 256 mil | 9 |

Todas as vistas ficam dentro do orçamento. A A4 foi medida a cada 5 animais com a câmera virada para eles: 7 animais, 75 calls; 14, 113; 23, 130 (o pico); 29, 120. Antes da T-016, a B3 dava 151.

**Falta:**
1. **Animais da era 1 na era 2** (com o Hurao, T-023): os 8 animais que saem da arca na A6 continuam em `Animal.todos` depois da transição (a B1 conta 8 antes de qualquer rebanho, e o rebanho da B2 só nasce em B2). Hipótese: o mundo de Noé é descartado sem `Animal.remover()`, e esses animais ainda entram na separação de `moverChao` dos animais de Canaã.

**Testes sob carga:** com o Chromium/e2e aberto ou vários agentes na máquina, os testes de CPU pura (o Simplificar, a síntese de áudio, as eras em sequência, a arca) estouram os 5 s porque os workers do vitest disputam os núcleos com o SwiftShader: no pico, 4 rodadas deram de 0 a 11 timeouts. Nessa situação use `npm run test:leve` (2 workers), que deu 121/121 nas 2 rodadas no pico. Os timeouts de Provas e Missoes (espera de timer) acabaram com a T-010 (`ciclo()` com `setImmediate`).

**Dicas para o e2e no Windows:**
- No Git Bash, use `MSYS_NO_PATHCONV=1` antes de `node e2e/foto.mjs "/..."`.
- Com o laço parado (`jogo.manual = true; jogo.renderizarManual = false`), só as fotos renderizam: até A1 leva uns 2 min, e com `--transicao` uns 14 min.
- Com o laço rodando no SwiftShader, o `page.screenshot` estoura o tempo.

### 2. Conteúdo da era 2 (`tecnico/era-abraao.md`)

**Pronto em `src/eras/abraao/`:** `personagens`, `memorias`, `cristo`, `interativos`, `mecanicas`, `missoes` (B1–B5 completas, B5 termina nos créditos), `servicos`, `atalhos` (`jogarEraAbraao`) e `index` (`ERA_ABRAAO`), com `tests/era-abraao.test.ts` (23 testes: cada missão, a era inteira, idempotência, a era jogada só pelos atalhos, os ensinamentos 11 e 15 e o orçamento de B3). Revisão de fidelidade feita pelo checklist de `tecnico/revisao.md`; os desvios do ROTEIRO e as pendências estão em `tecnico/era-abraao.md`. A T-005 corrigiu a etapa `pe` de B5, que terminava sozinha, e trocou o `recolorirFolhas()` de Canaã por `corFolha`/`corSolido`. A T-009 fez as mecânicas dos ensinamentos 11 (em B1, o caminho de Moré ao monte se revela em trechos na bússola) e 15 (em B3, os despojos de Savé brilham e o brilho desbota sozinho com a distância; a recusa vale `XP.prova`). A T-014 juntou a `frente/integracao`, trocou a faixa de revelação do brilho pelo `glslEncolher` do motor e conferiu B1 (bússola por trechos) e B3 (despojos na prova) no jogo integrado. A T-016 juntou de novo a `frente/integracao` (o `?dev&missao=b1..b5` já começa pela era da missão) e pôs B3 no orçamento do preset médio. A batalha de Dã chegava a 161 draw calls e 608 mil triângulos, e Savé com Abrão no meio do povo, a 703 mil. Da noite de Dã ao fim de Savé, os 17 figurantes passam ao corpo de longe a 6 m e não projetam sombra. O pior caso caiu para 138 draw calls e 461 mil triângulos em Dã e para 104 draw calls e 543 mil triângulos em Savé. Tabela em `tecnico/era-abraao.md`, "Orçamento de B3".

**O que a integração precisa para ligar a era** (`src/jogo/ligacao/abraao.ts`, hoje provisório: não usa nada de `src/eras/abraao/index.ts`):
1. `ERA_ABRAAO_JOGO`: trocar os jogáveis provisórios por `JOGAVEIS_ABRAAO` e preencher `npcs: NPCS_ABRAAO`, `missoes: MISSOES_ABRAAO`, `memorias: MEMORIAS_ABRAAO`, `cristo: CRISTO_ABRAAO`, `missaoInicial: 'b1'`. Sem `seguinte` (última era do MVP).
2. `criarPersonagens`/`posicoesIniciais`: criar jogáveis e NPCs em `INICIO_ABRAAO` (ponto + yaw; Isaque no `bastidor`) e `jogo.troca.ordem = IDS_JOGAVEIS_ABRAAO`. Os NPCs de cena (`NPCS_CENA_ABRAAO`) as missões criam por `servicos.criarPersonagem`.
3. Implementar `ServicosAbraao` como `ServicosNoe` em `ligacao/noe.ts`:
   - `canaa` = o `MundoCanaa`; `ceu` = `jogo.ceu`; `progresso` = `s.progresso`; `entrada` = `jogo.entrada`; `camera.tremer`; `aCadaQuadro` = `jogo.aCadaQuadro`;
   - `animais.criar` → `criarAnimal(e, mundo, x, z, {ativos, y, yaw, sexo, tom})`; `animais.rebanho(a)` → `Rebanho` em `mundo.atualizaveis`; `soltarRebanho`;
   - `cristo`, `controlar`, `liberarPosto`, `emitir`, `criarPersonagem`, `removerPersonagem`;
   - `creditos()`: tela de créditos do MVP (memórias, segredos, tempo) e volta ao menu, resolvendo ao fechar.
4. `ligar()`: `ERA_ABRAAO.ligarServicos(servicos)` e `ERA_ABRAAO.registrarSegredos(mundo, servicos, jogo.flags)` (guardar o desligar). `reconstruir()`: `ERA_ABRAAO.reconstruir(servicos, mundo, jogo.flags)`. `desligar()` e mundo descartado (novo jogo, título): `ligarServicosAbraao(null)` e `ERA_ABRAAO.limparCena()` (os rebanhos e animais de cena ficam guardados em `missoes.ts`).
5. `atalhos(op)`: como em `noe.ts`, com `AmbienteAtalhosAbraao` e `jogarEraAbraao` (para `e2e/jogar-mvp.mjs` e `?dev&missao=b3`).
6. ✅ Áudio da era 2: música `batalha` e efeitos `alarme`, `aparar`, `golpe`, `discernir` e `pedra` (`frente/audio`, na integração).
7. Opcional: `Ceu.estrelas` (0..1) para o céu de Gn 15:5 encher de estrelas em B4.

### 3. Motor visual (`agentes/motor.md`)

**O que o motor tem hoje** (branch `frente/motor`; API e detalhes em `tecnico/motor.md`):
- **Vale de Noé completo:** relevo, rio com vau, cidade, estaleiro, bosque e platô. A `MundoNoe` tem estados do dilúvio (`definirEstado`), água animável, interior da arca, `pontoArca`, viga mestra, andaime, árvores de gofer e altar. A chuva (`Chuva.ts`) usa 1 draw call.
- **Vegetação (`Natureza`):**
  - três níveis de detalhe: perto com sombra, longe com folhagem reduzida e silhueta de ~100 triângulos com normais macias;
  - perto e silhueta limitados pelo preset;
  - troncos simplificados com solda de vértices;
  - cor por variante (`corFolha`/`corSolido`), usada no vale para oliveiras, arbustos, pedras e seixos;
  - sombras com vento e revelação (`customDepthMaterial`).
- **Céu e luz:** ciclo do dia, nuvens brancas e fofas, tempestade, arco-íris e glória dourada. A neblina é suave e mais rala no alto, então as montanhas do horizonte guardam o relevo.
- **Terreno:** blocos de 96 m com malha de 2 m perto e de 4 m longe, mais saias contra frestas; modos lama e molhado. A grama tem a base na cor do chão e a ponta clara.
- **Transição de era:** duas faixas encadeadas em `Shaders.ts`. A vegetação e a grama somem primeiro; depois o terreno, as estruturas e a água afundam ou se apagam. Nada flutua, e a sombra das estruturas, da arca e dos animais afunda junto (`Mundo.prepararSombras`).
- **Humanos:** LOD da malha com 25% dos triângulos a partir de 18 m da câmera; a sombra usa sempre esse nível. De perto o corpo não muda (`tecnico/personagens.md`).
- **Física:** inclinação máxima a pé, que vale também no ar; quem fica numa encosta íngreme escorrega e não pula (`CorpoFisico.naEncosta`). Testes em `src/mundo/Fisica.test.ts`.
- **Orçamento (preset médio, 7 vistas):** no máximo 128 draw calls e 513 mil triângulos. Tabela em `tecnico/motor.md`.

**Para outras frentes (fora do escopo desta):**
- **Canaã (`src/eras/abraao/construir.ts`):** trocar o `recolorirFolhas()` pela cor por variante em `definirVariantes`: `oliveira` com `corFolha: '#b4c0a2'` (sem `tintFolha`), `arbusto` com `corFolha: '#a9b583'`, `arbustoVerde` com `corFolha: '#86b860'` e `pedra` com `corSolido: '#c9bea6'`; depois apagar as duas chamadas e a função. Hoje as silhuetas de longe das oliveiras de Canaã saem avermelhadas, porque a cor média vem da textura original. A fórmula é outra (`0,45 + 0,55·lum/média` em vez de `0,55 + 1,6·lum`): confira as cores em `?lab=canaa`.
- **Canaã (`estruturas.ts`):** a faixa de encolher está escrita à mão (`uRaio - 20.0`); trocar por `glslEncolher()` de `Shaders.ts`.

### 4. Ajustes de lógica da era 1 (pedidos pela revisão; aplicados na branch `frente/era-noe`)

1. **Gn 7:2:** ✅ os animais limpos (ovelha, cabra, boi e os cervos da gruta) chegam de 7 em 7 em A4: três casais e um macho para o altar (leitura registrada em `tecnico/era-noe.md`). O objetivo conta espécies e o banner mostra Gn 7:2.
2. **Gn 8:6:** ✅ Jafé só solta as amarras (`a5Amarras`); Noé abre a janela em `soltarCorvo` (narrador Gn 8:6).
3. **Ensinamento 9:** ✅ `segredoEstacoes` só fica ativo depois da flag `a6Altar` (`depoisDe` em `SEGREDOS_INTERATIVOS`).
4. **Ensinamento 6:** ✅ forçados por quem não sabe acalmar, os agitados fogem (`Animal.fugirDe`, que agora mantém o susto) até Sem acalmá-los.
5. ✅ Sem tem uma fala curta de ficção no planejamento de A2.

Pendências:
- `docs/ROTEIRO.md` (A4 "0/8 pares" e "par perdido", A5 "Jafé abre a cobertura") e `docs/tecnico/revisao.md` §8 (pendências 1 a 4) ainda descrevem o estado antigo.
- ✅ Draw calls de A4 no jogo integrado: pico de 130 com 23 animais (T-020; a tabela está em "Orçamento da integração").

## Problemas conhecidos (arte)

- **Canaã:** a passada de arte da T-005 resolveu as tendas (`tendaPelos`), o Moriá (estratos, lajes e mato) e a luz das fogueiras (2 `PointLight`). Há fotos antes/depois em `e2e/saida/` (fora do git). O modo `cam=` do `?lab=canaa` renderiza tudo preto; use `ponto`/`pos` com `yaw`.
- **Personagens:** não há retratos (a UI usa monogramas) nem clipe de oração (pose procedural `humano.oracao`).
- **Áudio:** os níveis foram equilibrados só por medição. Ouça e ajuste.

## Próximos passos, em ordem

1. Integração, itens 1 e 2: ver o jogo rodar e corrigir o que quebrar.
2. Era 2: `index.ts`, `atalhos.ts`, testes, ligação na integração e revisão.
3. Os 5 ajustes da era 1.
4. ✅ `e2e/jogar-mvp.mjs` do início da era 1 ao fim da era 2 (`npm run e2e`).
5. Passada de arte (motor e Canaã), depois desempenho em GPU integrada real (60 fps no preset médio).
6. Ouvir e ajustar o áudio.
7. Ativar o Pages e fazer merge na `main`.

## Como retomar no computador local

1. `git clone https://github.com/pdgusta/bible-mmorpg && cd bible-mmorpg && git checkout claude/gallant-hypatia-wt3gey`
2. `npm ci`, depois `npx tsc --noEmit && npx vitest run && npm run validar`.
3. `npm run dev` e abra <http://localhost:5173>, mais `?lab=ui`, `?lab=canaa` e `?lab=animais`.
4. Para os scripts `e2e/*.mjs`: `npm i -D playwright && npx playwright install chromium`.
5. **Opcional, fontes** (só para regenerar versículos ou modelos): `fontes/KJF.json`, `fontes/NVT.json`, `fontes/kjv-markdown/` e os pacotes da Quaternius (ver `TECNICO.md`). Nada disso é necessário para jogar ou desenvolver.
6. Leia `CLAUDE.md` e `docs/TECNICO.md`. Escolha o próximo passo e, ao terminar, atualize este arquivo.
