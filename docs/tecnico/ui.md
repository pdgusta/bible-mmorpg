# Interface (UI)

Arquivos:
- `src/ui/`:
  - `UI.ts`: a classe principal, mais o roteamento de teclas e ponteiro.
  - `tipos.ts`, `servicos.ts`, `contexto.ts`, `dom.ts`, `icones.ts`.
  - Componentes: `HUD`, `Dialogo`, `Diario`, `Menus`, `Roda`, `Prova`, `Avisos`, `Versiculos`.
  - `estilo.css`.
- Demo: `src/lab/ui.ts`, aberta com `?lab=ui&tela=hud|dialogo|escolha|diario|entender|roda|titulo|pausa|config|slots|creditos|prova|avisos|capitulo|carregamento|genealogia`. Sem `tela`, mostra o HUD e uma barra de botões.

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
5. **Provas:** Q, o botão direito e 1–n continuam com a Entrada; a UI só desenha o overlay.

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

## Fotos

O `e2e/foto.mjs` usa WebGL com SwiftShader e pode dar timeout com a máquina carregada. Como a demo da UI não usa WebGL, ela pode ser fotografada sem GL.

## Pendências

- Não há retratos de verdade: os personagens aparecem como monograma colorido com o ícone da classe em SVG.
- As notas do jogo por versículo (`escrituras[].nota`) ainda não têm conteúdo.
- Não há testes unitários de UI; a verificação foi feita com um roteiro Playwright à mão.
