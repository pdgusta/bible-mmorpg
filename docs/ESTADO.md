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
| Motor visual do vale de Noé | 🟡 parcial (abaixo) | briefing: `agentes/motor.md` |
| Integração (fluxo da partida, ligações, e2e) | 🟡 até A1 jogável ✅ (e2e `integracao.mjs`) · era 2 e `jogar-mvp` pendentes | `tecnico/integracao.md` |
| Deploy (GitHub Pages) | ✅ workflow pronto (ativar em *Settings → Pages → GitHub Actions*) | `README.md` |

## O que ficou pela metade, frente por frente

Os briefings originais de cada frente estão em `docs/agentes/*.md`. Eles citam caminhos de um scratchpad da nuvem (`/tmp/claude-0/...`) que **não existem mais**: ignore esses caminhos e salve as fotos em `e2e/saida/` (fora do git).

### 1. Integração (`agentes/integracao.md`, `tecnico/integracao.md`)

**Feito (frente/integracao, 24/10/2026, no computador local):**
- O jogo integrado roda: `node e2e/integracao.mjs` passa (carregamento, título sobre o vale, Novo jogo, prólogo, A1 com Noé no controle, HUD, objetivo, andar, Diário com J, pausa com Esc, salvar no espaço 1 pela pausa, carregar de volta, sem erros no console). Fotos em `e2e/saida/integracao/`.
- `npm run validar` funciona no Windows (`scripts/biblia-comum.mjs` usa `fileURLToPath`).
- `playwright` virou dependência de desenvolvimento (`npx playwright install chromium` uma vez).
- `docs/tecnico/integracao.md` escrito.
- Pendências de ligação conferidas no código: a câmera ignora colisores `invisivel`, `cam.tremer`/`cam.balanco`, `removerPersonagem`, Cristo por `ctx.cristo(id)` (flag `cristo_<id>`), `canaa.ceu = jogo.ceu`, transição com `aoNome` → `ui.genealogia` e `ui.genealogia(null)` no fim, e o começo de `ERA_NOE.seguinte.missao` (B1) depois de A6 em `Partida.aoConcluirMissao`.

**Falta:**
1. **Transição de era ainda não vista rodando:** `node e2e/integracao.mjs --transicao` parou em A4 na base `claude/gallant-hypatia-wt3gey`: o casal de leões ficou preso perto de (−82,7; 10) e `acalmar_leao` nunca apareceu. A A4 foi reescrita em `frente/era-noe` (aprovada); reconferir com `--transicao` depois da junção, antes de depurar.
2. **Era 2 na integração:** quando `src/eras/abraao/index.ts` (`ERA_ABRAAO`) existir, trocar as definições provisórias de `src/jogo/ligacao/abraao.ts` pelas de lá, implementar `ServicosAbraao` (como em `ligacao/noe.ts`) e os atalhos. Até lá, depois de A6 aparece o aviso "a jornada continua em breve", em vez de B1.
3. `e2e/jogar-mvp.mjs` (`npm run e2e`), do começo da era 1 ao fim da era 2. O `--transicao` de `integracao.mjs` já tem o miolo da era 1.
4. Medir `jogo.render.gl.info.render` em 3 vistas, no preset médio.

**Teste instável:** o teste da prova de ira (`tests/Provas.test.ts:171`, anterior a esta frente) pode estourar o tempo com a máquina carregada (vários agentes e o Chromium rodando); sozinho, passa.

**Dicas para o e2e no Windows:** no Git Bash, use `MSYS_NO_PATHCONV=1` antes de `node e2e/foto.mjs "/..."`. Com o laço parado (`jogo.manual = true; jogo.renderizarManual = false`), só as fotos renderizam: o título fica pronto em cerca de 50 s e o roteiro inteiro até A1 leva uns 2 min. Com o laço rodando no SwiftShader, o `page.screenshot` estoura o tempo.

### 2. Conteúdo da era 2 (`agentes/era-abraao.md`)

**Já existe em `src/eras/abraao/`:** `personagens`, `memorias`, `cristo`, `interativos`, `mecanicas`, `servicos` e `missoes.ts` (1921 linhas, B1–B5). O `tsc` passa.

**Falta:**
- `atalhos.ts` e `index.ts` (`ERA_ABRAAO`), no formato de `src/eras/noe/`;
- `tests/era-abraao.test.ts`, copiando o modelo de `tests/era-noe.test.ts`;
- `docs/tecnico/era-abraao.md`;
- a revisão de fidelidade com `docs/tecnico/revisao.md` e `node scripts/planilha-falas.mjs abraao`.

Confira se `missoes.ts` termina em B5 completo; o agente parou logo depois de escrevê-lo.

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
