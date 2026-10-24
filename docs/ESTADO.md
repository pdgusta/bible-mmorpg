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
| Conteúdo da era 1 | ✅ escrito e revisado · ⏳ 5 ajustes de lógica pendentes (abaixo) | `tecnico/era-noe.md`, `tecnico/revisao.md` |
| Conteúdo da era 2 | ✅ escrito, testado e revisado · ⏳ ligação na integração (abaixo) | `tecnico/era-abraao.md` |
| Motor visual do vale de Noé | 🟡 parcial (abaixo) | briefing: `agentes/motor.md` |
| Integração (fluxo da partida, ligações, e2e) | 🟡 parcial (abaixo) | briefing: `agentes/integracao.md` |
| Deploy (GitHub Pages) | ✅ workflow pronto (ativar em *Settings → Pages → GitHub Actions*) | `README.md` |

## O que ficou pela metade, frente por frente

Os briefings originais de cada frente estão em `docs/agentes/*.md`. Eles citam caminhos de um scratchpad da nuvem (`/tmp/claude-0/...`) que **não existem mais**: ignore esses caminhos e salve as fotos em `e2e/saida/` (fora do git).

### 1. Integração (`agentes/integracao.md`)

**Já existe:**
- `src/jogo/Partida.ts` (670 linhas): modos carregando, título e jogo; `novoJogo`, `continuar`, `carregar`, `salvar`, `sairParaTitulo`, `atualizarDiario`.
- `src/jogo/eras.ts`: registro `ERAS`, `ORDEM_ERAS = ['noe', 'abraao']` e as interfaces `DefEra`, `EraAtiva` e `AtalhosEra`.
- `src/jogo/ligacao/`:
  - `noe.ts` implementa `ServicosNoe`;
  - `abraao.ts` implementa `ServicosAbraao` (não verificado);
  - `audio.ts` liga o áudio aos eventos;
  - `comum.ts`;
  - `depuracao.ts` trata `?dev&missao=a3` e `?dev&auto=1`.
- `src/jogo/inicio.ts` (entrada) e `e2e/utilidades.mjs`.

**Ao parar:** o agente ia fazer um teste rápido da tela de título. **Ninguém viu o jogo integrado rodando ainda.**

**Falta:**
1. Abrir `/` e conferir: carregamento, título sobre o vale, Novo jogo, prólogo e A1 jogável (HUD, Diário, pausa, save).
2. Pendências recebidas dos outros módulos:
   - `CameraTerceira` deve ignorar colisores com tag `invisivel` (paredes invisíveis do Moriá).
   - `camera.tremer(int, s)` e `camera.balanco(int)` para a era 1.
   - `removerPersonagem(id)` e `progresso cristo(id)`.
   - `canaa.ceu = jogo.ceu`.
   - A transição de era deve usar `aoNome: (n, i) => ui.genealogia(n, i)` e chamar `ui.genealogia(null)` no fim.
   - Iniciar B1 depois de A6 (A6 não tem `proxima` de propósito).
3. Escrever `e2e/jogar-mvp.mjs` (o `npm run e2e` aponta para ele):
   - joga a era 1 por `jogarEraNoe` (`src/eras/noe/atalhos.ts`) e a era 2 pelos atalhos dela;
   - tira fotos dos momentos-chave;
   - simula o websocket do Vite, como em `e2e/teste-troca.mjs`.
4. Medir `jogo.render.gl.info.render` em 3 vistas.
5. Escrever `docs/tecnico/integracao.md`.

### 2. Conteúdo da era 2 (`tecnico/era-abraao.md`)

**Pronto em `src/eras/abraao/`:** `personagens`, `memorias`, `cristo`, `interativos`, `mecanicas`, `missoes` (B1–B5 completas, B5 termina nos créditos), `servicos`, `atalhos` (`jogarEraAbraao`) e `index` (`ERA_ABRAAO`), com `tests/era-abraao.test.ts` (16 testes: cada missão, a era inteira, idempotência e a era jogada só pelos atalhos). Revisão de fidelidade feita pelo checklist de `tecnico/revisao.md`; os desvios do ROTEIRO e as pendências estão em `tecnico/era-abraao.md`.

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
6. Áudio que as missões pedem e o módulo de áudio ainda não tem: música `batalha` e efeitos `alarme`, `aparar`, `golpe`, `discernir`, `pedra` (mapear para existentes ou criar). Ambientes `canaa`, `noite` e `vento` já existem.
7. Opcional: `Ceu.estrelas` (0..1) para o céu de Gn 15:5 encher de estrelas em B4.

### 3. Motor visual (`agentes/motor.md`)

**Já existe:**
- `src/render/Chuva.ts`;
- `Arca.ts` e `construir.ts` muito ampliados: estados do dilúvio, interior, `pontoArca`, viga mestra e andaime, todos usados pela era 1 e pelos testes;
- ajustes em `Ceu`, `Shaders`, `Fisica` e `Mundo`.

**Ao parar:** reescrevia `src/render/Natureza.ts` para ter um terceiro LOD (silhuetas de longe). As mudanças em `Ceu.ts` e `Shaders.ts` foram commitadas no meio do trabalho: **confira visualmente**.

**Falta:**
- **Cor da vegetação:** o kit traz folhas de TwistedTree e Bush_Common vermelhas e rochas verde-escuras. Crie uma opção de cor por variante na `Natureza`, use-a no vale de Noé e troque o `recolorirFolhas()` de Canaã por ela.
- **Outros problemas de arte:**
  - grama com pontas escuras;
  - nuvens que parecem bolhas bege;
  - montanhas do horizonte chapadas;
  - árvores de longe que viram manchas escuras.
- **Transição de era:** alinhar as faixas de revelação (`FAIXA_REVELAR` em `Shaders.ts` e o afundamento do `Terreno`) e dar revelação à água.
- **Física:** inclinação máxima no `CorpoFisico`; hoje as encostas não bloqueiam a subida.
- **Desempenho:** medir o vale (≤ 150 draw calls e ≤ 600 mil triângulos no preset médio) e escrever `docs/tecnico/motor.md`.

### 4. Ajustes de lógica da era 1 (pedidos pela revisão; nada aplicado ainda)

1. **Gn 7:2:** animais limpos (ovelha, cabra, boi) chegam de 7 em 7 em A4.
2. **Gn 8:6:** quem abre a janela é Noé (`soltarCorvo`/`definirJanela`); Jafé só solta as amarras.
3. **Ensinamento 9:** `segredoEstacoes` só fica ativo depois da flag `a6Altar` (`registrarSegredosNoe`).
4. **Ensinamento 6:** animais agitados forçados fogem (`Animal.fugirDe`) e precisam ser acalmados por Sem.
5. Uma fala curta de ficção para Sem em A2, porque o objetivo diz "Fale com Sem, Cam e Jafé".

## Problemas conhecidos (arte)

- **Canaã:** as tendas parecem caixas escuras; o Moriá parece uma cúpula cinza irregular; as fogueiras não iluminam os personagens.
- **Personagens:** não há retratos (a UI usa monogramas) nem clipe de oração (pose procedural `humano.oracao`).
- **Áudio:** os níveis foram equilibrados só por medição. Ouça e ajuste.

## Próximos passos, em ordem

1. Integração, itens 1 e 2: ver o jogo rodar e corrigir o que quebrar.
2. Era 2: `index.ts`, `atalhos.ts`, testes, ligação na integração e revisão.
3. Os 5 ajustes da era 1.
4. `e2e/jogar-mvp.mjs` do início da era 1 ao fim da era 2.
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
