# Personagens humanos e pipeline de modelos

Arquivos em `src/entidades/humano/`. Laboratório: `?lab=personagens`.

## Ideia

Todos os humanos usam **um único corpo base animado**: o manequim da Universal Animation Library 2, da Quaternius (CC0), com esqueleto UAL2. A roupa, o cabelo, a barba e a cobertura de cabeça são **gerados por código** e "vestidos" no esqueleto. Cada personagem vira **um `SkinnedMesh` com um único material** (cor por vértice), ou seja, 1 draw call por humano.

## Arquivos

| Arquivo | Papel |
|---|---|
| `CorpoBase.ts` | Processa o GLB do manequim, uma vez por corpo (`masc`/`fem`): geometria unificada no espaço bind, `juntas` (posições dos ossos), perfil do corpo por fatias (para a roupa não atravessar a pele), categoria de cor por vértice (`Pele`), clipes divididos em `clipsInferiores`, `clipsSuperiores` e `clipsCompletos`. `ySola`/`yTopo` servem para alinhar o pé ao chão. |
| `Vestimenta.ts` | `Aparencia` (corpo, altura, pele, cabelo, barba, túnica, manto, faixa, cabeça, `cabecaEscala`, sandália) e `gerarPersonagem(base, ap)`, que devolve a `BufferGeometry` skinned. `Malhador` acumula vértices com pesos, e `tubo` gera anéis. |
| `Animador.ts` | `CLIPES` (nomes PT → clipes UAL), `NomeClipe` e `Animador`, um mixer em duas camadas: pernas para a locomoção e tronco para atividades. Campos `atividade` (corpo todo, em laço) e `superior` (só o tronco). `tocar(nome, corpo, vel): Promise` toca um clipe uma vez; `velocidade`, `noChao`, `agachado` e `nadando` escolhem a locomoção. |
| `Humano.ts` | Junta tudo: `raiz`, `malha`, `animador`, `ossos`. `segurar(adereco, mao)`, `olharPara` (cabeça vira para um ponto), `oracao` (0..1, pose procedural de oração), `escalando` (pose procedural de escalada), `posicaoOsso`, `atualizar(dt, distCamera)` com LOD de animação pela distância. LOD da malha: ver abaixo. |
| `Aderecos.ts` | Objetos de mão gerados por código: cajado, machado, martelo, tocha, lanterna, escudo, espada, funda, tronco, feixe, cesto, jarro, pomba, corda, balde, saco, pão, fogo. São presos ao osso por `boneInverse * bindMatrix * P_bind`. |

## LOD do corpo (`Humano.ts`)

- O corpo (~21 a 25 mil triângulos) ganha um nível de longe com 25% dos triângulos (`FRACAO_LONGE`), feito por `simplificarIndice` (`src/render/Simplificar.ts`, erro de 1%, cor como atributo de coerência nas costuras). A solda só junta vértices presos aos mesmos ossos com os mesmos pesos: na barra da túnica há vértices na mesma posição presos a pernas diferentes, que se separam ao animar.
- Os dois índices ficam no mesmo buffer (perto, depois longe) e cada passada escolhe a faixa pelo `drawRange`: `onBeforeRender` usa o de longe a partir de `Humano.distanciaLonge` (18 m, volta ao de perto a 16 m); `onBeforeShadow` usa sempre o de longe. Nenhuma malha ou draw call a mais, e a escolha vale para qualquer câmera.
- `humano.distanciaLongePropria` (null por padrão) troca a distância só daquele humano, para os figurantes de uma multidão; a volta ao de perto continua 2 m antes. A era 2 usa 6 m nos figurantes de B3, de Dã a Savé (ver `era-abraao.md`, "Orçamento de B3").
- De perto o corpo é idêntico: com o tempo congelado, a foto muda só em 159 pixels, todos na sombra dos pés no chão (`e2e/saida/motor/t008-perto-{antes,depois}.png`; a 19 m, `t008-lod19-{perto,longe}.png`). A sombra barata não escurece o próprio corpo porque o erro (1% de ~1,8 m) fica abaixo do `normalBias` do sol (4 cm).
- O LOD é montado quando o simplificador (WASM) fica pronto (`simplificadorPronto`); até lá o humano desenha o corpo inteiro. No laboratório (`?lab=personagens`), que desenha um quadro só, a foto sai sempre com o corpo inteiro.

## Detalhes que custaram caro (não desfaça)

- **Origem do modelo:** é centrada. `modelo.position.y = -base.ySola * escala` encosta o pé no chão.
- **Mão e corpo têm `inverseBindMatrices` diferentes:** ao fundir as malhas, converta por vértice com `bind1⁻¹·Σw(B1⁻¹·B2)·bind2`, senão as mãos "explodem".
- **Clipes nativos UAL2:** a trilha 'root' é removida em `dividirClip`, senão a escala sai errada.
- **Roupa:**
  - Os pesos da túnica se dividem entre pelve e pernas, para a saia acompanhar o passo sem rasgar.
  - O manto é aberto na frente e as mangas seguem o braço.
  - O perfil do corpo empurra a roupa para fora da pele.
  - A barba e o lenço não podem cobrir o rosto.
- **Cabeça:** é skinned rígida no osso `Head` e fundida na mesma malha.

## Pipeline de modelos (`scripts/assets/`)

1. Baixe os zips CC0 da Quaternius no OpenGameArt (lista em `docs/TECNICO.md`) e descompacte cada um em `fontes/assets/<nome>/`.
2. `node scripts/assets/converter.mjs`:
   - Abre `scripts/assets/pagina/` num Chromium headless, servido por `servidor.mjs`.
   - Redireciona os clipes UAL1 para o esqueleto UAL2 por deltas de rotação de mundo, usando `A_TPose` como referência. Junta os clipes escolhidos (`CLIPS_UAL1`, `CLIPS_UAL2`) e grava `public/modelos/personagens/humano.glb` e `humana.glb`.
   - Converte os animais FBX (`Farm Animals`, `Animal Pack Vol.2`) em `public/modelos/animais/*.glb`.
3. `node scripts/assets/natureza.mjs` gera `public/modelos/natureza.glb` com os modelos de `MODELOS_NATUREZA`.
4. Tudo passa por `otimizarGLB` (`otimizar.mjs`, glTF-Transform + meshopt). Nos humanos use `quantizar: false`.

**Para acrescentar um clipe:** ponha o nome em `CLIPS_UAL1`/`CLIPS_UAL2`, rode o conversor e mapeie um nome PT em `CLIPES`. Os clipes de "uma vez" ficam em `UMA_VEZ`, dentro do `Animador`.

**Para criar um personagem novo:** basta uma `Aparencia`; veja `src/eras/*/aparencias.ts`. Depois, `jogo.criarPersonagem(def, x, z, yaw)`.

## Pendências

- Não há clipe de oração: a pose `oracao` é procedural. Algumas missões usam o clipe `agachado` no lugar.
- Não há expressões faciais.
- Não há retratos renderizados. A UI usa monograma e ícone da classe.
