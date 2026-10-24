# Conteúdo da era 2 — Abraão (Gn 12–22)

**Arquivos de conteúdo:** `src/eras/abraao/{personagens,memorias,cristo,interativos,mecanicas,missoes,servicos,atalhos,index}.ts` e `tests/era-abraao.test.ts`. A especificação é `docs/ROTEIRO.md` (B1–B5).

O mundo (`mapa.ts`, `construir.ts`/`MundoCanaa`, `estruturas.ts`, `aparencias.ts`) é de Canaã: veja `docs/tecnico/canaa.md`. O modelo da estrutura é a era 1 (`docs/tecnico/era-noe.md`).

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `personagens.ts` | Os 5 jogáveis (Abrão profeta, Sarai hospitaleira, Ló pastor, Eliézer guerreiro, Isaque batedor) com as fichas do ROTEIRO; `nomeAlternativo` troca Abrão→Abraão e Sarai→Sara pelas flags `nomeAbraao` e `nomeSara`. NPCs de Canaã (Melquisedeque, rei de Sodoma, Aner, Escol e Manre, 4 pastores, 4 servos) e NPCs de cena (`NPCS_CENA_ABRAAO`: fugitivo, 4 sentinelas + 2 guerreiros, 4 cativos). `ELENCO_ABRAAO` (quem pode ser controlado em cada missão), `INICIO_ABRAAO` (Isaque começa no `bastidor`). |
| `memorias.ts` | 10 memórias. `poDaTerra` é o segredo; `estrelas` e `jeovaJire` têm força 0 (são o resultado de uma prova). |
| `cristo.ts` | `bencaoNacoes`, `melquisedeque`, `justica`, `cordeiro`. A entrada `semente` é da era 1 e se completa em B5. |
| `interativos.ts` | `INTERATIVOS_ABRAAO` por etapa (`"b2.separar"`), `registrarEtapa`, `registrarDefs`, `registrarSegredosAbraao` (o pó da terra, ativo depois da flag `b2Percorrer`), `PONTOS_USADOS_ABRAAO` e `PONTOS_RESERVA` (só `bastidor`). |
| `mecanicas.ts` | Mecânicas em tempo real testáveis sem navegador: `Furtividade` (B3, cones das tochas), `Batalha` (B3, aparar e desarmar; ninguém morre), `Juntos` (B5, pai e filho a até 12 m). |
| `missoes.ts` | `MISSOES_ABRAAO` (B1–B5), `reconstruirMundoAbraao(s, mundo, flags)`, `mecanicaAbraao()` (mecânica em andamento, para os atalhos), `limparCenaAbraao()`. |
| `servicos.ts` | `ServicosAbraao`: tudo que as missões usam além do `CtxMissao`. Também `ligarServicosAbraao` e `servicosAbraao`. |
| `atalhos.ts` | `ATALHOS_ABRAAO`, `resolverEtapaAbraao` e `jogarEraAbraao(ambiente)`, que joga a era inteira pelas APIs do jogo (usado pelo e2e). |
| `index.ts` | `ERA_ABRAAO` e a reexportação de tudo acima. |

## `ERA_ABRAAO`

`id: 'abraao'`, `nome`, `sub`, `jogaveis`, `npcs`, `npcsCena`, `inicio`, `elenco`, `protagonista: 'abraao'`, `missoes`, `missaoInicial: 'b1'`, `memorias`, `segredos`, `cristo`, `atalhos`, `seguinte: null` (B5 termina nos créditos), `ligarServicos`, `reconstruir`, `registrarSegredos`, `limparCena`, `jogar`, `resolverEtapa`.

## Missões e etapas

| Missão | Etapas (ids) | Mecânica principal |
|---|---|---|
| B1 | `chegada`, `altarMore`, `acampar`, `invocar` | altares (`construirAltar`, herdado de Noé) e tendas em dupla (posto no mastro + amarrar) |
| B2 | `muitos`, `separar`, `pastores`, `abraoELo`, `percorrer`, `manre` | rebanhos com boids e porteiras em posto; escolha moral; 4 mirantes |
| B3 | `noticia`, `dividir`, `ataque`, `libertar`, `melquisedeque`, `nemUmFio` | furtividade, batalha, cativos, dízimo, prova de tentação |
| B4 | `visao`, `fora`, `duvida`, `creu` | prova da dúvida (memórias das duas eras acendem estrelas) |
| B5 | `nomes`, `prova`, `pe`, `subida`, `altar`, `carneiro`, `promessa` | Isaque amarra a corda, discernir no fosso, "juntos", prova do medo; créditos |

Regras (as mesmas da era 1):
- **Etapa idempotente.** Flags dizem o que já foi feito; `reconstruirMundoAbraao` restaura acampamento, tendas, altares, acampamento inimigo, corda, noite, estrelas e o elenco; a etapa recomeça pulando o que já está feito. Abortada no meio, não deixa interativos nem `aCadaQuadro` ligados (há teste).
- **Estado de módulo:** `missoes.ts` guarda os animais de cena e os rebanhos de B2 entre etapas. Quando o mundo de Canaã for descartado (novo jogo, sair para o título), chame `ERA_ABRAAO.limparCena()`.
- **Flags principais:** `legadoAplicado`/`legadoNoe`, `elencoAbraao`, `acampamento`, `tendaMontada_*`, `altar_*`, `loPartiu`, `emManre`, `b2Percorrer`, `b3Noite`, `inimigoVisivel`, `b4Noite`, `b4Estrelas`, `nomeAbraao`, `nomeSara`, `isaqueNasceu`, `cordaAmarrada`, `b5EscalarLiberado`, `b5Altar`; as de progresso de cada etapa (`b1AltarMore`, `b3_cativo3`…) estão em `missoes.ts` (procure `marcar(`).
- **Legado de Noé** (início de B1): +1 fé a cada 2 segredos da era 1 (até +2), +1 domínio se A3 foi vencida na primeira tentativa (`a3PrimeiraTentativa`), avisos "Legado de Noé: …" e a flag `legadoNoe` com as linhas para o Diário.

## O que `ServicosAbraao` exige e de quem

| Serviço | Implementação |
|---|---|
| `canaa` | `MundoCanaa` direto: `acampamento`, `cordaAmarrada`, `definirAcampamento`, `montarTenda`, `abrirPorteira`, `porteiraAberta`, `dentroCurral`, `definirAltar`, `estadoAltar`, `definirAcampamentoInimigo`, `amarrarCordaMoria`, `revelarPedras`, `aoCairFosso` |
| `ceu` | `Ceu`: `hora`, `gloria`, `pausado` e `estrelas?` (0..1, Gn 15:5; o `Ceu` ainda não tem: sem ele, B4 só usa a noite) |
| `audio` | `ambiente('canaa' \| 'noite' \| 'vento', i)`, `musica('calmo' \| 'aventura' \| 'prova' \| 'gloria' \| 'silencio' \| 'batalha')`, `efeito('fogo' \| 'corda' \| 'brilho' \| 'alarme' \| 'aparar' \| 'golpe' \| 'discernir' \| 'pedra')` |
| `animais` | `criar(e, x, z, {y, yaw, sexo, tom})` → `criarAnimal` (espécies `ovelha`, `jumento`, `carneiro`; `tom` escurece a lã das ovelhas de Ló); `rebanho(animais)` → `Rebanho` atualizado a cada quadro; `soltarRebanho(r)` |
| `progresso` | `Progresso` direto: `memorias`, `segredos`, `estatisticas`, `tempoJogado`, `temMemoria`, `memoria`, `ganharXP`, `somarAtributo`, `segredosDaEra` |
| `camera` | `tremer(int, s)` |
| `entrada` | `jogo.entrada`: `ativa`/`pressionou` (`acao`, `escudo`, `habilidade`, `discernir`) |
| integração | `aCadaQuadro(fn)` (devolve o desligar), `cristo(id)`, `controlar(id)`, `liberarPosto(idPosto)`, `emitir(e, d)`, `criarPersonagem(def, x, z, yaw)`, `removerPersonagem(id)`, `creditos()` (estatísticas + volta ao menu; resolve ao fechar) |

## Atalhos de depuração

`jogarEraAbraao(amb, {ate?, aoEtapa?})` joga da missão atual até o fim de B5. `AmbienteAtalhosAbraao` é o mesmo da era 1 (mundo, `servicos.controlar`, `emitir`, `usar?` = `Controle.usar`, `ativo`, `emProva`, `resolverProva`, `estado`, `flags`, `esperar`, `limite`). As mecânicas em tempo real se resolvem por `mecanicaAbraao().resolverAutomaticamente()`; diálogos, escolhas e cinemáticas o e2e precisa avançar. `usar` só teleporta quem está fora do raio do interativo (o sinal de B3 fica no próprio Abrão) e repete o uso enquanto houver tempo (`limite`), para sobreviver a cinemáticas.

## Desvios conscientes do ROTEIRO

- **Verbos:** os postos "qualquer jogável" (mastros, porteiras) usam `usar`, porque `segurar` é só do guerreiro. A corda do Moriá é o interativo `amarrarCorda` no ponto `cordaMoria`, porque `cordaMoria` já é a escalada do mundo.
- **B1:** Gn 12:2-3 entra na chegada junto de Gn 12:1 (`narrador('Gn 12:1-3')`), e não como voz de Deus em Moré depois de Gn 12:7: as palavras foram ditas em Harã, antes da partida (checklist, ordem do texto). Depois do altar de Moré vem o trecho de Gn 12:7 "e ali ele edificou um altar…".
- **B3, prova da tentação:** as respostas são `Gn 14:22-23` (Gn 14:22 sozinho termina em vírgula), `Gn 13:8` e `Gn 12:2`. Duas mentiras do ROTEIRO ("Você mereceu.", "Ninguém vai saber.") viraram "Isso é seu. Não divida com ninguém." e "Pegue tudo antes que outro pegue.", porque Gn 13:8 e Gn 12:2 não as respondiam (cada resposta tem de servir a todas as mentiras).
- **B3:** 6 inimigos (4 sentinelas acordam 2 guerreiros, o mínimo do ROTEIRO). Os cativos são 4 + Ló (`cativo5`), solto por último e só por Abrão.
- **B5:** Gn 22:13 é dividido: o carneiro preso antes de o jogador agir; "e Abraão foi e tomou o carneiro…" depois, já com o fogo no altar.
- **B5, `pe`:** `servosMoria` fica a 6,7 m de `peMoria` (raio 8), então a etapa termina assim que começa e funciona como cena.
- A pose de oração usa o clipe `agachado` (`CLIPE_ORACAO`).

## Testes (`npx vitest run tests/era-abraao.test.ts`)

Um mundo de Canaã falso (`CanaaFalsa` com a mesma geometria dos currais e acampamentos do mapa) e um `CtxMissao` falso que, no modo `auto`, também resolve as mecânicas em tempo real e passa quadros (`aCadaQuadro`). Cobrem:
- refs e trechos BKJ no código-fonte e nas falas registradas durante a execução; Deus e o Anjo só falam por versículo; ficção até 140 caracteres;
- ids únicos, `proxima`, atalhos para todas as etapas, fichas, classes, elenco, memórias e forças;
- pontos usados, inícios e rotinas existem no mapa;
- cada missão do início ao fim; o legado de Noé; a era inteira em sequência (memórias, armadura `calcado`/`escudo`/`couraca`, Cristo, nomes, elenco final, altares, sem NPC de cena nem animal esquecido, créditos);
- idempotência por etapa (abortar depois de 2 ações, reconstruir e recomeçar);
- a era jogada só pelos atalhos.

## Revisão (checklist de `docs/tecnico/revisao.md`)

Planilha: `node scripts/planilha-falas.mjs abraao e2e/saida/planilha-abraao` (344 linhas, nenhum erro automático).

**Corrigido:**
- Ordem do texto em B1 (Gn 12:1-3) e Gn 22:13 dividido (acima).
- Prova de B3: resposta `Gn 14:22-23` e duas mentiras (acima).
- "Aponta para Cristo": `bencaoNacoes` ganhou `Gl 3:16` ("Cristo, a Semente de Abraão"); `melquisedeque` não afirma mais "intercede por nós" (está em Hebreus 7, mas fora das refs) e se apoia em Hb 7:3; `justica` não depende mais dos versos de Romanos 4 sobre as obras e a ressurreição (fora das refs e ausentes do `versiculos.json`) e ganhou `Gl 3:8`.
- Texto bíblico digitado fora de `ref`/`trecho`: "No monte do Senhor ele será visto" (memória `jeovaJire`), "caminha pela terra" (dica de B2) e "foram os dois juntos" (dica de B5 e de `Juntos`).
- Memória `resgate`: "não pensou na ofensa" (Ló não ofendeu Abrão) virou "não o abandonou".
- Objetivos que eram só substantivo ("No vale de Savé.", "O topo do monte."), a dica de "Está escrito" no formato do jogo (e sem citar o escudo, que só vem em B4) e a dica do altar com o nome da época (`Abrão pode…` / `Abraão pode…`).

**Pendências que exigem lógica ou decisão (fora do escopo de texto):**
1. **Ensinamento 11** ("o caminho até a terra é revelado em trechos"): B1 não revela o mapa aos poucos; só há objetivos para Moré e Betel.
2. **Ensinamento 15** ("o brilho desbota quando o jogador se afasta"): os despojos não brilham nas missões; depende da prova de tentação do sistema de provas.
3. **Ensinamento 16** diz que o jogador entrega o dízimo antes da bênção, mas Gn 14:19-20 põe a bênção antes do dízimo, e o jogo segue o texto. Recomendação: corrigir a linha 16 de `docs/ENSINAMENTOS.md`.
4. `docs/ROTEIRO.md` ainda lista as respostas e as mentiras antigas da prova de B3 e a voz de Deus com Gn 12:2-3 em Moré: atualizar com os desvios acima.
5. Sara tem a descrição fixa "Mulher de Abrão." também em B5.
