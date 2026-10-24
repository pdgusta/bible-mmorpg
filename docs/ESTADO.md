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
| Conteúdo da era 2 | 🟡 parcial (abaixo) | briefing: `agentes/era-abraao.md` |
| Motor visual do vale de Noé | ✅ arte, transição, física e orçamento (abaixo) | `tecnico/motor.md` |
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

### 2. Conteúdo da era 2 (`agentes/era-abraao.md`)

**Já existe em `src/eras/abraao/`:** `personagens`, `memorias`, `cristo`, `interativos`, `mecanicas`, `servicos` e `missoes.ts` (1921 linhas, B1–B5). O `tsc` passa.

**Falta:**
- `atalhos.ts` e `index.ts` (`ERA_ABRAAO`), no formato de `src/eras/noe/`;
- `tests/era-abraao.test.ts`, copiando o modelo de `tests/era-noe.test.ts`;
- `docs/tecnico/era-abraao.md`;
- a revisão de fidelidade com `docs/tecnico/revisao.md` e `node scripts/planilha-falas.mjs abraao`.

Confira se `missoes.ts` termina em B5 completo; o agente parou logo depois de escrevê-lo.

### 3. Motor visual (`agentes/motor.md`)

**Feito (branch `frente/motor`, detalhes em `tecnico/motor.md`):**
- **Cor por variante:** `corFolha`/`corSolido` na `Natureza` (já existia do trabalho anterior; conferido nas fotos), usada no vale de Noé para oliveiras, arbustos, pedras e seixos.
- **Arte:** neblina mais rala no alto (as montanhas do horizonte guardam o relevo), grama com a base na cor do chão e ponta clara, silhuetas de longe com normais macias (sem manchas escuras). As nuvens do commit anterior já estavam boas (brancas e fofas).
- **Transição de era:** duas faixas encadeadas em `Shaders.ts` (a vegetação some antes de o chão afundar; terreno, estruturas e água afundam ou se apagam juntos); a sombra da vegetação encolhe junto (`customDepthMaterial`).
- **Física:** a inclinação máxima vale também no ar (pular contra a encosta não vira escada); quem fica numa encosta íngreme escorrega e não pula (`CorpoFisico.naEncosta`). Testes em `src/mundo/Fisica.test.ts`.
- **Desempenho:** simplificação dos troncos com solda de vértices (antes quase não reduzia), alcance perto e silhuetas limitados pelo preset, terreno em blocos de 96 m com meia resolução longe da câmera. Números em `tecnico/motor.md`.

**Para outras frentes (fora do escopo desta):**
- **Canaã (`src/eras/abraao/construir.ts`):** trocar o `recolorirFolhas()` pela cor por variante em `definirVariantes`: `oliveira` com `corFolha: '#b4c0a2'` (sem `tintFolha`), `arbusto` com `corFolha: '#a9b583'`, `arbustoVerde` com `corFolha: '#86b860'` e `pedra` com `corSolido: '#c9bea6'`; depois apagar as duas chamadas e a função. Hoje as silhuetas de longe das oliveiras de Canaã saem avermelhadas, porque a cor média vem da textura original. A fórmula é outra (`0,45 + 0,55·lum/média` em vez de `0,55 + 1,6·lum`): confira as cores em `?lab=canaa`.
- **Canaã (`estruturas.ts`):** a faixa de encolher está escrita à mão (`uRaio - 20.0`); trocar por `glslEncolher()` de `Shaders.ts`.
- **Transição (`src/camera/TransicaoEra.ts`):** a `FOLGA_TERRENO` não tem efeito (o `uRaio` do terreno é o mesmo objeto do `GLOBAIS`); a folga agora mora nas faixas de `Shaders.ts` e a constante pode sair.
- **Personagens:** cada humano tem ~22 mil triângulos e projeta sombra: 4 em cena pesam ~180 mil, o maior custo do vale. Um LOD para os humanos é o próximo ganho.
- **Câmera:** a câmera de 3ª pessoa entra na copa das árvores (a tela fica verde-escura); ela não colide com folhagem.

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
