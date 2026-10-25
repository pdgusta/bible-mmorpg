# Interface (UI)

Arquivos:
- `src/ui/`:
  - `UI.ts`: a classe principal, mais o roteamento de teclas e ponteiro.
  - `tipos.ts`, `servicos.ts`, `contexto.ts`, `dom.ts`, `icones.ts`.
  - Componentes: `HUD`, `Dialogo`, `Diario`, `Menus`, `Roda`, `Prova`, `Avisos`, `Versiculos`.
  - `FilaAvisos.ts`: a fila dos avisos, lógica pura com teste (`FilaAvisos.test.ts`).
  - `estilo.css`.
- Demo: `src/lab/ui.ts`, aberta com `?lab=ui&tela=hud|dialogo|escolha|diario|entender|roda|titulo|pausa|config|slots|creditos|prova|avisos|capitulo|carregamento|genealogia` (na prova, `&tipo=duvida&mems=n&usadas=k` simula a lista de memórias da B4). Sem `tela`, mostra o HUD e uma barra de botões.

HTML e CSS puros sobre o canvas, sem framework. O estilo lembra Palia: pergaminho e linho quentes, cantos arredondados e sombras suaves. Fontes: Nunito na UI, Cormorant Garamond nos títulos e no texto bíblico (via `@fontsource`).

## Construção

```ts
await carregarBiblia();
const ui = new UI(div, servicosBiblia({ nomes, classes }), acoes);
```

- **`ServicosUI`:**
  - Obrigatórios: `versiculo(ref, trecho?)`, que devolve `{texto, extenso, nvt, kjv}`, e `nomeDe(falante)`.
  - Opcionais: `retratoDe`, `capitulos` e `capitulo`.
- **`ui.acoes`** (todas opcionais e mutáveis): `novoJogo`, `continuar`, `carregar(slot)`, `salvar(slot)`, `exportar(slot)`, `importar(arquivo, slot)`, `listarSlots`, `configuracoes(cfg)`, `sairParaTitulo`, `retomar`, `menu(aberto)`, `leitura(segundos, cap)`, `lembrarMemoria(id)`, `estaEscrito()`.
  - O tipo de slot é `1 | 2 | 3 | 'auto'`.

## Métodos

- **`InterfaceUI`** (de `contratos.ts`): `dialogo`, `escolha`, `bannerVersiculo`, `objetivo`, `prompt`, `aviso`, `dica`, `titulo`, `fade(paraPreto, duracaoSegundos)`, `modoCinema`, `hud`, `prova`, `rodaPersonagens`, `fecharRoda`, `legendaTroca`, `marcadores`, `menuAberto`.
- **Diário:** `atualizarDiario(Partial<DadosDiario>)` (mescla campos; as listas substituem as anteriores), `abrirDiario`/`fecharDiario`/`alternarDiario(aba?)`, `abrirLeitura('Gn', 6)`, `entender(ref)`.
- **Menus:** `abrirTitulo({podeContinuar})`, `abrirPausa()`, `alternarPausa()`, `abrirMenu('config' | 'salvar' | 'carregar' | 'creditos')`, `fecharMenus()`.
- **Configurações:** `configuracoes()`/`definirConfiguracoes()`. A UI grava em localStorage e chama `acoes.configuracoes` a cada mudança.
- **Diversos:**
  - `carregamento({progresso, texto} | null)`, `fps(valor)`, `genealogia(nome | null, i)`.
  - `definirCamera(camera, focoJogador)`: obrigatório para os marcadores na tela e para a distância e o rumo na bússola.
  - `avancarDialogo()`, para o e2e.
- **Estado:**
  - `menuAberto()` é verdadeiro com menu, Diário, "Entender melhor" ou roda abertos.
  - `pausaJogo()` é igual, mas sem a roda.
  - `dialogoAberto()` e `bloqueado()`.

## Regras de apresentação (não quebre)

- **Fala bíblica:**
  - Mostra o texto da BKJ e um chip com a referência.
  - Passar o mouse no chip mostra o versículo; clicar abre "Entender melhor":
    - BKJ e NVT lado a lado;
    - "Aponta para Cristo", quando houver;
    - nota do jogo marcada como nota;
    - KJV recolhida.
- **Ficção** leva o selo "fala do jogo".
- **Deus** aparece com rótulo dourado serifado e um brilho, nunca retrato de pessoa.
- **Satanás:** sussurro em itálico vermelho-escuro.
- **Narrador:** itálico.

## Teclas e ponteiro

1. **Captura:** enquanto algo da UI está aberto, ela captura e consome as teclas que usa:
   - Diálogo: E, Espaço e Enter avançam; Esc pula, e segurar Esc pula fala a fala.
   - Escolha: 1–n, ↑/↓ e Enter.
   - Menus e Diário: Esc volta, J fecha o Diário, Tab navega.
   - Roda: 1–5 escolhem e Esc cancela.
2. **O jogo liga só o que abre as coisas:**
   - J chama `ui.alternarDiario()`.
   - Esc chama `ui.abrirPausa()`, e não alternar, porque quem fecha a pausa é a UI.
   - Tab é tratado pela Troca.
   - Alternativa: `ui.atalhosGlobais = true` faz a própria UI tratar J e Esc.
3. **Ponteiro:**
   - A UI solta o pointer lock ao abrir menu, Diário, "Entender melhor" ou diálogo, e trava de novo ao fechar, se foi ela quem soltou.
   - Se o ponteiro se perder com nada aberto, a UI abre a Pausa. Isso se desliga com `pausarAoSoltarPonteiro`.
   - A roda mantém o ponteiro travado.
4. **Bloqueio:** o jogo faz `entrada.podeTravar = () => !ui.bloqueado()` e não move personagem nem câmera quando `ui.bloqueado()`.
5. **Provas:** Q, o botão direito e 1–5 continuam com a Entrada; a UI só desenha o overlay.
   - Memórias da dúvida (`ListaMemorias`): o jogo dá as teclas 1–5 às cinco primeiras ainda não lembradas, e só essas viram botão. As lembradas aparecem como uma fileira de estrelas acesas; as outras, como "+N para depois". Quando uma é lembrada, a próxima ganha a tecla. Memória sem tecla não mostra número.
   - A coluna fica na lateral direita, com teto de altura; em tela pequena desce para o canto de baixo, para não encostar no painel do topo. Teste no Chromium: `node e2e/teste-prova-memorias.mjs` (lab: `?lab=ui&tela=prova&tipo=duvida&mems=13&usadas=3`).
   - Na prova de dúvida, em tela estreita (até 1060 px), a faixa de versículo fica entre a coluna do retrato e a das memórias (classe `com-memorias` na raiz), para não cobrir a lista.
   - Sussurros (os "dardos" de mentira): o jogo dá o centro em fração da tela; a UI tira o cartão de cima dos painéis visíveis (perfil, hora, bússola, objetivo, aviso de tecla, avisos, dica, faixa de versículo, topo da prova, firmeza, ações, memórias e o texto da frase do centro), levando-o para o lugar livre mais perto (`AreaLivre`).
   - Cabem poucos de cada vez (3 abaixo de 560 px de altura, 4 abaixo de 900 px, 6 acima) e nenhum cobre outro (`distribuirSussurros`). A vez é de quem vai acertar antes: a urgência é a distância até o alvo dos dardos na conta do jogo (fração da tela, até (0,5; 0,55), o mesmo centro de `Provas.ts`; todos andam à mesma velocidade). Os iminentes (urgência até 0,2, menos de ~1 s para acertar) vêm primeiro e aparecem sempre, mesmo acima do teto: sem lugar livre, ficam onde cobrem menos, poupando os painéis fixos. Entre os que ainda estão longe, quem já está na tela conta como um pouco mais perto, para dois não trocarem de vaga a cada quadro. Os outros esperam a vez, invisíveis (`.dardo.esperando`), e aparecem quando cabem. O mais urgente de todos aparece sempre. Teste temporal em `AreaLivre.test.ts`: nenhum sussurro acerta sem ter aparecido. O que é bloqueado enquanto espera some sem a queda. Em tela pequena, a frase do centro é menor (duas linhas), para sobrar lugar. Os painéis são medidos de novo a cada 0,4 s e quando a prova abre ou muda de tamanho; no resize, os painéis e os próprios dardos (o rem muda) são medidos de novo. Teste no Chromium: `node e2e/teste-sussurro.mjs` (a mesma página passa por 640×360, 1920×1080, 640×360 e 960×540).

## Dados do Diário (montados pela integração)

`atualizarDiario` recebe estas listas:

| Campo | Fonte |
|---|---|
| `missoes` | `s.missoes.listaDiario()` |
| `escrituras` | `s.progresso.versiculos` (lista de refs) |
| `memorias` | `MEMORIAS.todas()` com `obtida = s.progresso.temMemoria(id)` |
| `armadura`, `unidade`, `lidos` | campos de mesmo nome em `s.progresso` |
| `cristo` | `CRISTO_*` das eras; `completo` quando a entrada chega a `completaEm` |
| `personagens` | fichas, classe e dons |

## Avisos

Saem do `Progresso` por `ui.aviso`: XP, nível, atributo, memória, armadura e unidade. A UI não gera avisos a partir dos eventos, para não duplicar.

- **Fila:** a pilha mostra no máximo N avisos; o resto espera a vez (`FilaAvisos`) e aparece quando um sai.
  - N tem um teto pela altura da tela (2 abaixo de 560 px, 3 abaixo de 900 px, 4 acima) e, abaixo dele, é quantos cabem entre a coluna do retrato e a dica, quando ela está na tela. Sempre pelo menos um.
  - O encaixe usa a altura medida de cada cartão (um texto longo passa de duas linhas; o ×n estreita o texto). O cartão novo é medido logo depois de posto, antes de aparecer: se não coube, volta para a fila sem piscar, com a medida guardada. O ajuste roda ao entrar, agrupar e sair um aviso, ao mostrar ou esconder a dica, ao redimensionar e quando a coluna do retrato muda de altura. Quem ainda não foi medido conta como duas linhas (`ALTURA_AVISO_REM`).
  - Regressão no Chromium: `node e2e/teste-avisos.mjs` (textos curtos e longos a 640×360, 960×540 e 1280×720; o lab expõe `window.ui`).
  - Quando o limite cai (a dica apareceu, a janela encolheu), os avisos mais novos voltam para a frente da fila e reaparecem depois.
  - Com fila, cada aviso fica menos tempo (2,6 s, ou 3,6 s para nível, memória e armadura; sem fila, 4,2 s e 5,6 s).
  - Aviso igual a um que está na tela ou na fila vira ×n no mesmo cartão. A fila guarda até 8; acima disso cai o mais antigo.
- A pilha começa logo abaixo da coluna do retrato: o HUD publica a base dela na variável `--base-esquerda` da raiz.

## Lugar de cada camada na tela

Nada que é notificação cobre o meio da tela.

| Camada | Lugar |
|---|---|
| Retrato, barras e Unidade | coluna à esquerda, no alto (`--largura-perfil`) |
| Avisos | logo abaixo dessa coluna, com a mesma margem |
| Dica de tutorial | embaixo à esquerda |
| Hora e objetivo | coluna à direita, no alto (`--largura-objetivo`) |
| Bússola e versículo | no alto, no meio, entre as duas colunas |
| Prompt e legenda da troca | embaixo, no meio; a legenda fica acima do prompt |

- **Tela estreita (até 1060 px de largura):** o versículo não cabe entre as colunas. Ele ocupa o alto à direita do retrato e, enquanto aparece (classe `com-faixa` na raiz), a bússola, a hora e o objetivo somem.
- **Tela pequena (até 560 px de altura ou 760 px de largura):** a fonte-base cai para 12 px, as colunas ficam mais finas, a Unidade some (só pela altura) e a dica fica estreita para não encostar na legenda da troca.
- Fotos de referência: `?lab=ui&tela=avisos` e `?lab=ui&tela=hud` em 640×360, 1280×720 e 1920×1080.

## Fotos

O `e2e/foto.mjs` usa WebGL com SwiftShader e pode dar timeout com a máquina carregada. Como a demo da UI não usa WebGL, ela pode ser fotografada sem GL.

## Pendências

- Não há retratos de verdade: os personagens aparecem como monograma colorido com o ícone da classe em SVG.
- As notas do jogo por versículo (`escrituras[].nota`) ainda não têm conteúdo.
- O único teste unitário de UI é o da fila de avisos; o resto foi verificado com um roteiro Playwright à mão.
