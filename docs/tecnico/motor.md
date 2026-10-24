# Motor visual e mundo — notas técnicas

Renderização (`src/render/*`), mundo físico (`src/mundo/*`), o vale de Noé (`src/eras/noe/{mapa,construir,Arca}.ts`) e o orçamento de desempenho. Three.js r186 (WebGL2), materiais Lambert com patches em `onBeforeCompile`.

## Arquivos
| Arquivo | Papel |
|---|---|
| `src/render/Renderizador.ts` | `WebGLRenderer` (sRGB, ACES, sombras PCF), `PRESETS` de qualidade (`baixo`/`medio`/`alto`) e escala dinâmica de resolução. |
| `src/render/Shaders.ts` | Uniforms globais (`GLOBAIS`: tempo, vento, revelação), `aplicarPatch` (vento, alcance, revelação, face sem verso, recolorir por luminância), faixas da revelação (`glslEncolher`/`glslAfundar`), neblina atmosférica (chunks `fog_*` substituídos), `GLSL_RUIDO`. |
| `src/render/Ceu.ts` | Cúpula do céu (ciclo do dia, sol/lua, estrelas, arco-íris, tempestade, glória dourada), nuvens instanciadas, luzes (sol com sombra, hemisférica), neblina e modo interior. `Ceu.atual` é o céu ativo. |
| `src/render/Terreno.ts` | Malha do relevo em blocos de 96 m (culling por frustum), cada um com malha cheia (2 m) e de meia resolução (4 m) e saia de 3 m contra frestas; `atualizar(posCamera)` (chamado pelo `Mundo`) troca pela distância (`distanciaPerto` = 60 m). Cores por vértice, ruído de detalhe, modo lama (`uLama`), chão molhado (`uMolhado`), afundamento da revelação. `corEm(x, z)` dá a cor do chão (a grama copia). |
| `src/render/Grama.ts` | Grama instanciada em dois anéis em volta do foco (perto: lâminas curvas; longe: retas), refeita a cada 4 m; `definirPerfil` troca densidade, cor e altura (brotos depois do dilúvio). |
| `src/render/Agua.ts` | Plano de água com cor por profundidade (textura de alturas), espuma, ondas, reflexo do céu, turbidez, recorte (casco da arca) e nível animável. |
| `src/render/Natureza.ts` | Vegetação e rochas do `natureza.glb` instanciadas por variante, com 3 níveis de detalhe e cor por variante. Ver abaixo. |
| `src/render/Chuva.ts` | Chuva em 1 draw call: riscos numa caixa que acompanha a câmera, posição calculada no shader. `definir(alvo, segundos)`. |
| `src/render/Ativos.ts` | Carregador glTF com cache (meshopt) e `extrairPartes` (malhas → Lambert, folha × sólido). |
| `src/mundo/Mundo.ts` | `Mundo`: relevo, colisões, física, terreno, natureza, grama, água, estruturas, interativos, áreas, pontos, escaladas, personagens. |
| `src/mundo/Relevo.ts` | Campo de alturas em grade (passo 1 m), `altura`, `normal`, `inclinacao`, raio contra o terreno; formas auxiliares (`achatar`, `fatorBorda`, `distPolilinha`). |
| `src/mundo/Fisica.ts` | `MundoFisico` (chão com pisos de colisores, água funda, inclinação máxima) e `CorpoFisico` (cápsula cinemática). Testes em `Fisica.test.ts`. |
| `src/mundo/Colisao.ts` | Colisores caixa/cilindro/rampa numa grade espacial; empurrão, topo, raio. |
| `src/mundo/Navegacao.ts` | Grade de navegação (A*) e visada. |
| `src/mundo/Espalhar.ts` | `espalhar(mundo, variante, opções)`: distribui instâncias da Natureza por densidade (disco de Poisson aproximado). |

## Natureza (`src/render/Natureza.ts`)
```ts
definirVariante(nome, op: OpcoesVariante)   // uma vez por variante, antes de adicionar
adicionar(variante, x, y, z, ry, s, aleatorio?, rx = 0): number   // rx ≠ 0: árvore caída
definirModelo(variante, indice, modelo); ocultar(variante, indice, oculta = true)
construir()                                 // cria os InstancedMesh (depois de adicionar tudo)
limpar(variantes?)                          // tira as instâncias (mantém as variantes); depois adicionar + construir
atualizar(dt, camera, foco, forcar = false) // a cada 0,25 s ou 2 m: escolhe nível de detalhe e frustum
troncos()                                   // colisores dos troncos; distanciaMax = alcance do preset
```
- **Níveis de detalhe:** *perto* (modelo completo, tronco simplificado a `reduzirTroncoPerto`, com sombra) até `alcancePerto`; *longe* (só uma fração `fracaoLonge` dos cartões de folha, aumentados, e tronco simplificado a `reduzirTronco`, sem sombra); *silhueta* (copa de icosaedro ou cones de pinheiro + cilindro, ~100 triângulos, cor média da variante) a partir de `alcanceMedio`. O preset também limita: perto ≤ 16% e silhueta a partir de 38% da `distanciaMax` (no médio, 37 m e 87 m). A instância encolhe nos últimos 15% do `alcance` (sem "pop").
- **Simplificação:** `simplificar()` solda os vértices por posição antes do meshopt. Sem a solda, cada costura de UV vira uma borda travada e o tronco da oliveira não passava de 7212 → 6540 triângulos; soldado, chega a 30% com erro de 0,3%. Na volta, cada triângulo escolhe o lado da costura de UV coerente.
- **Cor por variante:** `corFolha` recolore as folhas (materiais `Leaves*`) e `corSolido` as partes sólidas (troncos, pedras), mantendo o desenho da textura (luminância normalizada; `aplicarPatch({ luminancia })`). Necessário para TwistedTree e Bush_Common (folhas vermelhas no kit) e para `Rocks` (verde-escuras). `tintFolha`/`tintTronco` multiplicam por cima. As silhuetas usam a cor final.
- **Sombras:** cada parte de perto tem `customDepthMaterial` com vento e revelação, então a sombra balança com a folhagem e encolhe com a instância na transição de era. O fade por alcance fica de fora: na passada de sombra o `cameraPosition` é a câmera da luz (a sombra encolheria pela distância ao sol). Só o perto projeta sombra, e ele termina antes dos últimos 15% do alcance.

## Revelação da transição de era (`Shaders.ts`)
`GLOBAIS.uCentro`/`uRaio` (o `terreno.uniforms.uCentro/uRaio` é o mesmo objeto). Duas faixas encadeadas de `FAIXA_REVELAR` (20 m):
1. de `uRaio − 20` a `uRaio`: vegetação, grama e instâncias encolhem até sumir (`glslEncolher`);
2. de `uRaio` a `uRaio + 20`: terreno e estruturas (malhas com `aplicarPatch`, sem instância) afundam até `AFUNDAR_REVELAR` (30 m) e a água se apaga no começo do afundamento (`glslAfundar`).

Assim nada flutua sobre o buraco, seja qual for o raio. A `FOLGA_TERRENO` de `src/camera/TransicaoEra.ts` não tem mais efeito (escreve no mesmo objeto) e pode sair. Shaders próprios que queiram participar declaram `uniform vec2 uCentro; uniform float uRaio;`, ligam aos `GLOBAIS` e usam essas funções (ex.: `src/eras/abraao/estruturas.ts`, que ainda tem a faixa de encolher escrita à mão).

## Neblina e céu
- A neblina linear do three foi trocada por uma curva suave (ease-out) entre `near` e `far` (`Ceu.ajustarDistancia(dist)`: 9% e 210% do alcance do preset), mais rala no alto: entre 14 m e 75 m de altitude ela perde até 40%. As cristas do horizonte guardam o relevo em vez de virar recortes chapados.
- Os chunks `fog_pars_vertex`/`fog_vertex`/`fog_pars_fragment` passam `vFogAlt` (altura de mundo do fragmento, calculada da `viewMatrix`, vale para instâncias). Shaders próprios que incluem os chunks de neblina precisam declarar `mvPosition` antes de `#include <fog_vertex>` (todos os atuais declaram).
- Nuvens: aglomerados de esferas instanciados, topo branco, base na cor do céu, borda morna virada para o sol.

## Física (`src/mundo/Fisica.ts`)
- `MundoFisico.inclinacaoMax` (0,36 = `1 − normal.y`, ≈ 50°): acima disso não se sobe a pé. O deslocamento perde a componente morro acima (anda-se ao longo do pé da encosta) também no ar, quando os pés vão tocar a encosta.
- `CorpoFisico.naEncosta`: de pé no terreno numa encosta íngreme demais (ex.: caiu de um pulo nela). Escorrega morro abaixo e `pular()` recusa, para os pulos não virarem escada.
- A normal do relevo é amostrada a ±1 passo (1 m no `Mundo`): o pé de uma encosta fica levemente suavizado.

## Vale de Noé
Mapa de 460 × 460 m (`src/eras/noe/mapa.ts`, `NOE`), montanhas nas bordas, monte ao norte com platô (`NOE.plato`, 38 m) e trilha suave desde o estaleiro. API de `MundoNoe` (`construir.ts`):
```ts
definirEstado(e: 'antes' | 'diluvio' | 'depois')  // céu/chuva/água; depois: lama, ruínas, árvores secas, brotos
animarAgua(nivel, segundos): Promise<void>;  get nivelAgua
definirInterior(ativo)                     // luz morna, neblina curta, chuva escondida (Ceu.definirInterior)
pontoArca(nome): THREE.Vector3             // pontos 3D da arca (PONTOS_ARCA), certos com a arca movida
moverArca(x, y, z, yaw?); repousarArca()   // repousa no platô (Gn 8:4)
get vigaMestra                             // VigaMestra.definirAltura(t: 0..1)
definirAguaInterna(nivel); definirCaixasSoltas(b); definirVazamento(n, b); definirRede(n, b)
cortarArvore(id); arvoreCortada(id)        // árvores de gofer ('arvoreGofer1'..'3')
definirAltar(pedras: 0..6, fogo)           // altar no platô (A6)
```
`Arca` (`Arca.ts`): `definirEstagio(0..6)`, `definirPorta`, `definirJanela`, `mover`, `ponto(nome)`, `mundoDe(lx, ly, lz)`; constantes `ARCA` e `PONTOS_ARCA`.

## Orçamento de desempenho
Meta: 60 fps em vídeo integrado, ≤ ~150 draw calls e ≤ ~600 mil triângulos no preset médio. `jogo.render.gl.info.render` conta a passada de sombra junto (quem tem sombra conta duas vezes). Medido no cenário de teste (`/?teste=medir&q=medio&...`, 480 × 270, SwiftShader):

| Vista | Parâmetros | Antes (calls / triângulos) | Depois |
|---|---|---|---|
| início (casa de Noé) | `hora=16.5&pitch=0.25&dist=7` | 115 / 554 mil | 106 / 479 mil |
| céu e pomar | `hora=11&pitch=-0.12&dist=12&yaw=2.5` | 115 / 765 mil | 113 / 579 mil |
| longe (entre árvores) | `hora=15&pitch=0.12&dist=16&yaw=-1.2` | 119 / 685 mil | 108 / 564 mil |
| vista do vale | `hora=16.5&pitch=0.15&dist=10&yaw=0&pos=70,150` | 146 / 788 mil | 128 / 576 mil |
| estaleiro com a arca pronta | `hora=10&pitch=0.3&dist=14&yaw=0.8&pos=-5,20&arca=6` | 61 / 368 mil* | 50 / 348 mil |
| cidade | `hora=14&pitch=0.2&dist=12&yaw=2.4&pos=165,-95` | 112 / 473 mil* | 87 / 428 mil |
| bosque | `hora=9&pitch=0.15&dist=9&yaw=-1.5&pos=-150,20` | 155 / 627 mil* | 126 / 570 mil |

\* medida intermediária (já com a simplificação soldada e os alcances do preset, antes do LOD do terreno e do tronco de perto a 35%).

O que mudou: troncos simplificados de verdade (solda de vértices), alcance perto/silhueta pelo preset, tronco de perto a 35%, terreno em blocos de 96 m (25 em vez de 64) com meia resolução a mais de 60 m da câmera.

Como medir: com o servidor no ar, abra uma das URLs acima com `/?teste=medir&q=medio&` antes dos parâmetros, espere `window.pronto` e leia `jogo.render.gl.info.render` (`calls`, `triangles`) no console ou pelo Playwright (`page.evaluate`).

O que pesa (vista do céu, depois): personagens (~22 mil triângulos cada, com sombra: 4 personagens ≈ 180 mil), terreno, grama (~85 mil), oliveiras de perto (com sombra) e a cidade (~50 mil, uma malha com sombra).

## Problemas conhecidos
- As estruturas (malhas do `Construtor`, arca) usam o material de sombra padrão: na revelação a sombra delas não afunda junto.
- Silhuetas e versões de longe não projetam sombra; a troca perto → longe (37 m no médio) faz a sombra da árvore sumir de uma vez.
- Instâncias de perto fora do frustum (a mais de 10 m) não são desenhadas, então a sombra de uma árvore atrás da câmera pode faltar.
