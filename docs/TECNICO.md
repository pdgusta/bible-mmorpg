# Documentação técnica

Visão de engenharia de *A Semente*. Para a visão de produto, veja `docs/DESIGN.md`. Para o conteúdo das missões, veja `docs/ROTEIRO.md`. Para o estado atual e os próximos passos, veja `docs/ESTADO.md`.

## Índice dos módulos (`docs/tecnico/`)

| Documento | Cobre |
|---|---|
| [`motor.md`](tecnico/motor.md) | `src/render/*`, `src/mundo/*`, `src/entidades/Construtor.ts`, o vale de Noé (`src/eras/noe/{mapa,construir,Arca}.ts`), dilúvio, interior da arca, orçamento de desempenho |
| [`personagens.md`](tecnico/personagens.md) | Humanos vestidos e animados (`src/entidades/humano/*`), pipeline de modelos 3D (`scripts/assets/*`) |
| [`troca-camera.md`](tecnico/troca-camera.md) | `Jogo`, `Personagem`, `IA`, `Interacoes`, `Controle`, `Troca`, câmeras (3ª pessoa, troca, cinemática, transição de era) |
| [`sistemas.md`](tecnico/sistemas.md) | Bíblia, Progresso, Diálogo, Provas espirituais, Missões, Salvamento, validação de textos |
| [`ui.md`](tecnico/ui.md) | Interface HTML/CSS (`src/ui/*`) |
| [`animais-audio.md`](tecnico/animais-audio.md) | Animais (GLB e procedurais), rebanhos, áudio sintetizado |
| [`era-noe.md`](tecnico/era-noe.md) | Conteúdo da era 1 (`src/eras/noe/` fora do mapa) |
| [`canaa.md`](tecnico/canaa.md) | Mundo de Canaã (`src/eras/abraao/{mapa,construir,estruturas}.ts`) |
| [`era-abraao.md`](tecnico/era-abraao.md) | Conteúdo da era 2 |
| [`integracao.md`](tecnico/integracao.md) | Fluxo da partida (título → eras → save), ligações entre módulos, e2e |
| [`revisao.md`](tecnico/revisao.md) | Checklist de fidelidade bíblica e de texto para qualquer conteúdo novo |

Cada documento de módulo traz o propósito dos arquivos, a API pública, as invariantes, como verificar e as pendências. Quem muda uma API pública atualiza o documento correspondente no mesmo commit.

## Stack

- **Linguagem e build:** TypeScript 5.9, Vite 7 (`base: './'`, para funcionar em qualquer subpasta do Pages) e Vitest 3.
- **Render:** Three.js r186 (WebGL2).
  - Materiais `MeshLambertMaterial` com cor por vértice, alterados por `onBeforeCompile` em `src/render/Shaders.ts`.
  - Uma luz direcional com sombra que segue o foco, mais a luz hemisférica.
- **Dependências de jogo:** só `three` e as fontes `@fontsource/*`. Todo o resto é código próprio: física, navegação, UI, áudio e save.
- **Modelos:** glTF com compressão meshopt (`MeshoptDecoder`), em `public/modelos/`.
- **Hospedagem:** estática. O workflow `.github/workflows/pages.yml` roda testes, `validar` e build a cada push na `main`.

## Mapa do código

```
src/
  main.ts          roteia ?lab=... ou inicia o jogo (src/jogo/inicio.ts)
  core/            Entrada (teclado/mouse/gamepad → ações), Eventos (barramento), aleatorio (mulberry32 + simplex), util
  render/          Renderizador (presets baixo/medio/alto), Ceu (dia, estrelas, tempestade, arco-íris, gloria),
                   Terreno, Natureza (vegetação instanciada + LOD), Grama, Agua, Chuva, Shaders (GLOBAIS + aplicarPatch), Ativos
  mundo/           Relevo (heightfield), Colisao (caixa/cilindro/rampa + grade), Fisica (MundoFisico, CorpoFisico),
                   Navegacao (A* em grade), Espalhar, Mundo (junta tudo: pontos, áreas, escaladas, interativos, personagens)
  entidades/       humano/ (CorpoBase, Vestimenta, Animador, Humano, Aderecos), Construtor (estruturas),
                   Animal, Rebanho, animais/ (espécies procedurais)
  camera/          CameraTerceira, CameraTroca, Cinematica, TransicaoEra
  jogo/            Jogo (núcleo e laço), contratos.ts (tipos compartilhados e lista de eventos), Personagem, IA,
                   Interacoes, Controle, Troca, Atributos, Classes, Biblia, Progresso, Dialogo, Provas, Missoes,
                   Memorias, Salvamento, inicio/Partida (fluxo)
  eras/noe/        mapa, construir (MundoNoe), Arca, aparencias + conteúdo (personagens, memorias, cristo,
                   interativos, missoes, servicos, atalhos, index)
  eras/abraao/     mesmo formato da era 1, com MundoCanaa
  ui/              UI (implementa InterfaceUI), HUD, Dialogo, Diario, Menus, Roda, Prova, Avisos, Versiculos, estilo.css
  audio/           Audio (Web Audio sintetizado: ambientes, música generativa, efeitos)
  data/biblia/     versiculos.json (GERADO; único lugar com texto bíblico)
  lab/             páginas de laboratório (?lab=personagens|ui|animais|canaa)
scripts/           extrair-versiculos.mjs, validar-textos.mjs, biblia-comum.mjs, assets/ (conversão e otimização de modelos)
tests/             Vitest (tests/falsos.ts tem os serviços falsos para testar missões sem navegador)
e2e/               foto.mjs, teste-troca.mjs, jogar-mvp.mjs (Playwright + Chromium pré-instalado)
docs/              DESIGN, ROTEIRO, ENSINAMENTOS, TECNICO (este), ESTADO, tecnico/*
fontes/            (fora do git) KJF.json, NVT.json, kjv-markdown/, assets/ (pacotes brutos da Quaternius)
```

## Arquitetura em uma página

- **Laço** (`Jogo.passo`):
  1. lê a entrada;
  2. atualiza o comando do jogador e os personagens (IA para os não controlados), os callbacks `aCadaQuadro` (sistemas, controle, troca, provas), as áreas, a câmera, o céu e a água, e o mundo (vegetação, grama, `atualizaveis`);
  3. renderiza.
  - `jogo.manual` e `jogo.avancar(seg)` deixam os testes avançarem o tempo sem `requestAnimationFrame`.
- **Contratos:** `src/jogo/contratos.ts` define os tipos que cruzam módulos e a lista `EVENTOS`. São eles:
  - falas: `Linha` (bíblica ou ficção);
  - missões: `DefMissao`, `DefEtapa` e `CtxMissao`, o contexto entregue aos scripts de missão;
  - provas e memórias: `DefProva`, `DefMemoria`;
  - interface e save: `InterfaceUI`, `EstadoHUD`, `EstadoProvaUI`, `DadosSave`.
  - Mude esses tipos só acrescentando campos opcionais.
- **Barramento** (`jogo.eventos`): os módulos conversam por eventos nomeados, documentados em `contratos.ts`. Exemplos: 'interacao', 'troca:inicio' e 'troca:fim', 'missao:*', 'xp', 'memoria', 'prova:*', 'era:transicao'.
- **Missões:** cada etapa é uma função `async (c: CtxMissao) => …` que espera por coisas no mundo (`c.interacao(id)`, `c.chegar(...)`, `c.prova(def)`), fala (`c.dialogo`) e dá recompensas.
  - As etapas são **idempotentes**: ao carregar um save, o mundo é reconstruído pelas flags e a etapa atual roda de novo do início.
- **Interativos:** `mundo.interativos` guarda objetos com `id`, `pos`, `verbo`, `segurar`, `posto` e `aoInteragir`.
  - O `Controle` mostra o prompt e verifica se o personagem tem o verbo da sua classe. Senão, mostra a `dica` ("Jafé pode escalar isto").
  - Ao usar, emite 'interacao'.
- **Eras:** cada era é um módulo com o mundo (`MundoNoe`, `MundoCanaa`), os personagens, as missões e os serviços específicos (`ServicosNoe`).
  - A troca de era passa por `transicaoEra(...)`, que dissolve e revela o mundo pela faixa radial `GLOBAIS.uCentro/uRaio`, sem tela de carregamento.

## Convenções

- **Português:** identificadores, comentários, textos e commits em PT-BR, com acentos corretos nos textos visíveis. Nos identificadores, sem acento e em camelCase: `pontoArca`, `definirEstagio`.
- **Determinismo:** mundos gerados por semente (`Aleatorio`, `Ruido`) para que fotos e testes se repitam.
- **Draw calls:** cada zona de estruturas vira uma malha fundida com um material de cor por vértice (`Construtor`). Vegetação é instanciada (`Natureza`). Cada humano é um único `SkinnedMesh`.
- **Revelação de era:** todo material novo do mundo passa por `mundo.adicionar(obj)` ou `aplicarPatch(mat, {revelar: true})`. Sem isso, o objeto não participa da transição de era.
- **Nada de texto bíblico em `.ts`:** `npm run validar` falha se um `trecho` não for substring da BKJ ou se a ref não existir em `versiculos.json`.

## Pipeline bíblico

1. `fontes/KJF.json`, `fontes/NVT.json` (JSON por livro, capítulo e versículo) e `fontes/kjv-markdown/` (clone de github.com/arleym/kjv-markdown).
2. `npm run versiculos` (`scripts/extrair-versiculos.mjs`) varre `src/` e `docs/` atrás de referências ("Gn 6:14", intervalos "Gn 6:14-16", livros abreviados de `biblia-comum.mjs`). Também inclui os capítulos de leitura do Diário. Grava `{aviso, fontes, livros, leitura, versiculos: {"Gn 6:14": {bkj, nvt, kjv}}}`.
3. `npm run validar` (`scripts/validar-textos.mjs`) confere refs e trechos e avisa defeitos de fonte, como "A/naxade" em Gn 11:10. Funciona sem `fontes/`, como no CI.
4. No jogo, `src/jogo/Biblia.ts` carrega o JSON sob demanda (import dinâmico).

**Ao escrever falas novas:** use a ref no código. Depois rode `npm run versiculos` (se tiver as fontes) e `npm run validar`. O JSON gerado é commitado.

## Pipeline de modelos 3D

- **Origem:** pacotes CC0 da Quaternius no OpenGameArt (`https://opengameart.org/sites/default/files/<arquivo>.zip`):
  - `stylized_nature_megakitstandard.zip`
  - `universal_animation_librarystandard.zip`
  - `universal_animation_library_2standard.zip`
  - `Farm%20Animals%20by%20%40Quaternius.zip`
  - `Animal%20Pack%20Vol.2%20by%20%40Quaternius.zip`

  Descompacte cada um em `fontes/assets/<nome>/`.
- **`node scripts/assets/natureza.mjs`:** junta cerca de 40 modelos do Nature MegaKit em `public/modelos/natureza.glb`, com texturas compartilhadas em WebP. A lista está em `MODELOS_NATUREZA`.
- **`node scripts/assets/converter.mjs`:** usa o Chromium headless para converter:
  - humanos: `personagens/humano.glb` (manequim UAL2 com os clipes UAL1 redirecionados por deltas de rotação de mundo a partir da `A_TPose`) e `humana.glb`;
  - animais FBX para GLB (`animais/*.glb`).

  Os GLBs passam por `otimizarGLB` (`scripts/assets/otimizar.mjs`). Nos humanos ele roda com `quantizar: false`, para preservar o skinning.
- Detalhes em `docs/tecnico/personagens.md`.

## Testes e verificação

| O quê | Como |
|---|---|
| Tipos | `npx tsc --noEmit`: tem de dar 0 erros |
| Unidades | `npx vitest run`. As missões são testadas com `tests/falsos.ts`, um `CtxMissao` falso que resolve interações e provas na hora |
| Textos bíblicos | `npm run validar` |
| Visual | `node e2e/foto.mjs "/?..." out.png 960 540`. A página precisa definir `window.pronto = true` |
| Troca e transição | `node e2e/teste-troca.mjs [pasta] [--era]` |
| MVP inteiro | `npm run e2e` (`e2e/jogar-mvp.mjs`): joga pelas funções `atalhos` de cada era |
| Desempenho | `window.jogo.render.gl.info.render` (calls, triangles). O FPS no headless (SwiftShader) não representa GPU real |

O Chromium do container fica em `/opt/pw-browsers/chromium`, e `require('playwright')` funciona. Não rode `playwright install`. Localmente: `npm i -D playwright && npx playwright install chromium`.

## Orquestração com subagentes (como o projeto foi construído)

- **Briefing:** começa pelo projeto e pelas regras. Depois diz a posse de arquivos (só edita os seus), proíbe commit, manda rodar `tsc` e `vitest` e define o relatório final (até 60 linhas). Os briefings das frentes de trabalho estão resumidos nos `docs/tecnico/*`.
- **Limites:** máximo de 7 agentes simultâneos. Os núcleos de CPU são compartilhados, então peça fotos pequenas e poucas.
- **Integração:** o orquestrador junta os relatórios, roda tudo, faz commit e push e atualiza `docs/ESTADO.md`.
