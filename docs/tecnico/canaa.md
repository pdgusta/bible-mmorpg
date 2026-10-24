# Mundo de Canaã (era 2, Abraão) — notas técnicas

Mapa de 520 × 520 m, geografia condensada. Norte = −z, leste = +x. Alturas dos pontos vêm do relevo (`mundo.ponto3(nome)` / `ponto3Chao`).

## Arquivos
| Arquivo | Papel |
|---|---|
| `src/eras/abraao/mapa.ts` | `MAPA_CANAA` (DefMapa: relevo, cores, grama, pontos), constantes `CANAA`, `MORIA`, `ROTA_MORIA`, `RIO_JORDAO`, `TRILHAS`, `CURRAIS`, `ACAMPAMENTOS`, `ROTAS_SENTINELAS`, `ROTAS_FLANCO`; classe `TerrenoCanaa` (altura, `jordao()`, `rota()` da trilha do Moriá). |
| `src/eras/abraao/construir.ts` | `class MundoCanaa`: vegetação, estruturas, peças móveis, Moriá (colisores, escaladas, fosso), estado. |
| `src/eras/abraao/estruturas.ts` | Peças com a API do `Construtor` (casa de pedra, aldeia, muro, tenda desmontada, cocho, marco de mirante, pedra memorial, despojos, cercado de cativos, lanças), `Fogueiras` (chamas animadas + brilho aditivo, 3 draw calls) e `Porteira` (painel giratório com colisor). |
| `src/lab/canaa.ts` + ramo `?lab=canaa` em `src/main.ts` | Laboratório: carrega o mundo com Abrão e posiciona câmera/estado por parâmetros. |

## API de `MundoCanaa`
```ts
new MundoCanaa(cenaNatureza: THREE.Object3D)        // constrói tudo e chama mundo.finalizar()
readonly mundo: Mundo; readonly terreno: TerrenoCanaa; readonly fogueiras: Fogueiras
ceu: { noite: number } | null        // ligue a jogo.ceu (fogueiras brilham mais à noite)
definirNoite(n: number)              // alternativa manual (0..1) quando ceu = null
definirAcampamento(lugar: 'betel' | 'manre' | null)   // tendas, fogo, colisores, navegação; atualiza pontos dinâmicos
montarTenda(nome: 'tendaAbrao' | 'tendaSara', montada: boolean)   // B1 (montada ↔ rolos no chão)
abrirPorteira(nome: 'porteiraAbrao' | 'porteiraLo', aberta: boolean, instantaneo = false)
porteiraAberta(nome): boolean;  dentroCurral(nome: 'curralAbrao' | 'curralLo', x, z): boolean
definirAltar(nome: 'altarMore' | 'altarBetel' | 'altarManre' | 'altarMoria', estado: 'oculto' | 'construido' | 'aceso')
estadoAltar(nome): EstadoAltar
definirAcampamentoInimigo(visivel: boolean)   // Dã: tendas, 6 fogos, cativos, despojos (começa oculto)
amarrarCordaMoria(sim: boolean)               // mostra a corda e ativa a escalada 'cordaMoria'
revelarPedras(t: number)                      // 0..1: firmes douradas, soltas vermelhas (Q discernir)
readonly pedrasMoria: { x, y, z, firme }[];  aoCairFosso: ((p: Personagem) => void) | null
```
Estado inicial: acampamento em Betel com tendas montadas, porteiras fechadas, altares ocultos, inimigos ocultos, corda solta. Tudo é idempotente (pode ser reaplicado a partir das flags ao carregar um save).
Pontos **dinâmicos** (mudam com `definirAcampamento`): `acampamento`, `tendaAbrao`, `tendaSara`, `fogueiraAcampamento`.

## Pontos nomeados (x, z)
| Missão | Pontos | Uso |
|---|---|---|
| B1 | chegada (−136,−150), caravana (−142,−128), more (−150,−115), altarMore (−141,−122), siquem (−192,−140) | chegada sob o carvalho de Moré; Siquém ao lado |
| B1 | acampamentoBetel (−30,−82), tendaAbraoBetel (−37,−86), tendaSaraBetel (−24.5,−88), fogueiraBetel (−30,−78), betel (−112,−92), ai (58,−70) | monte entre Betel e Ai (aldeias de pedra ao longe) |
| B1 | mastroTenda1 (−36.7,−83.7), amarrarTenda1 (−32.2,−83.5), mastroTenda2 (−24.8,−85.9), amarrarTenda2 (−28.8,−85.5), altarBetel (−19,−97), orarBetel (−20.5,−94.5) | tendas em dupla (mastro + estaca), altar e oração |
| B2 | poco (−25,−5), pasto (−25,16), curralAbrao (−52,−24), curralLo (2,−24), porteiraAbrao (−52.9,−17.4), porteiraLo (2.9,−17.4), entradaCurralAbrao (−50,−16.2), entradaCurralLo (0,−16.2) | rebanhos misturados; `porteira*` = posto de quem segura; `entrada*` = diante da abertura |
| B2 | miranteJordao (80,−30), descidaJordao (100,−14), planicieJordao (136,8), sodomaLonge (140,82) | cena Abrão/Ló, vista da planície, partida de Ló |
| B2 | miranteNorte (−62,−152), miranteSul (−42,46), miranteLeste (92,−112), miranteOeste (−152,−32) | “caminha pela terra”: outeiros com marco de pedra (miranteSul vê o Moriá) |
| B2 | segredoPo = segredo1 (−186,22), segredo2 (−74,−204), segredo3 (98,58), segredo4 (−168,186) | pedras memoriais (2: fonte na ravina; 3: beira da escarpa; 4: abrigo de rocha) |
| B2–B4 | manre (−120,115), acampamentoManre (−112,108), tendaAbraoManre (−118,104), tendaSaraManre (−106,101), fogueiraManre (−112,110), altarManre (−97,96), carvalhoManre (−131,97) | carvalhais de Manre |
| B3 | chegadaFugitivo (−70,102), reuniaoServos (−100,124), aliadosManre (−141,129) | notícia, reunião dos 318, tendas de Aner/Escol/Manre |
| B3 | da (40,−128), flancoSul (44,−150), flancoOeste (10,−190), flancoLeste (80,−192), acampamentoInimigo (45,−188), fugaInimigos (46,−217) | vale de Dã à noite; rotas cobertas em `ROTAS_FLANCO` |
| B3 | sentinela1 (22,−166), sentinela2 (68,−166), sentinela3 (27,−160), sentinela4 (33,−199) | início das rondas em `ROTAS_SENTINELAS` (1–3 vai-e-volta, 4 laço) |
| B3 | cativos (59,−198), cativo1..5 (57,−196.5)(59.5,−196)(61.5,−197.5)(57.5,−199.5)(60.5,−200), despojos (30,−197) | cercado de cordas e pilhas de despojos |
| B3 | save (−25,98), salem (−6,80), altarSalem (3,85), melquisedeque (−2,88), dizimo (−6,90), chegadaSodoma (30,104) | vale de Savé, casa e altar de Melquisedeque, mesa de pão e vinho |
| B4 | ceuEstrelas (−86,134) | outeiro aberto (sem árvores) a ~35 m da tenda em Manre |
| B5 | servosMoria (36,103), peMoria (42,106), degrausMoria (43.5,120), paredeMoria (55.4,129.4), cordaMoria (59.5,132.3) | pé (servos, jumento), trecho 1 |
| B5 | estreitoMoria (78.3,143.5), fossoMoria (82.8,148.8), estreitoFim (88.5,165), patamarMoria (84,181), subidaFinal (72,192.5), topoMoria (52,172), altarMoria (50.5,170.6), arbustoCarneiro (56.8,176.6) | trechos 2–4 e topo |
| — | bastidor (−236,236) | canto do mapa para quem está fora de cena (Isaque antes de B5, Ló depois de partir) |

## Relevo e vegetação (`TerrenoCanaa.altura`)
1. Planalto: `9 + fbm(0,0062)·6,5 + fbm(0,028)·1,3`. Planície do Jordão a leste de `xEscarpa(z)` (~105–125), a 2,3 m; rio `RIO_JORDAO` escavado (nível da água 0,6, fundo bloqueia).
2. Bordas `fatorBorda(…, 62)`: Moabe (leste) alto, oeste baixo. Lugares achatados com alturas **relativas** ao planalto no centro (cache `base()`): monte de Betel +7, mirantes +6…+11, pastos suavizados, Manre −1, Savé −4,5, vale de Dã (fundo −2,5 e anel de cristas +12 aberto ao sul).
3. Moriá: cone (topo = pé + 42) com estratos, penhasco no raio irregular 49 (`fatorRaioMoria`), trilha `ROTA_MORIA` escavada (alturas relativas ao pé; fosso = −3 m no segmento 8→9).
4. Cores: dourado/ocre, terra vermelha em manchas, calcário nas encostas, verde só no Jordão (abaixo de ~10 m), Manre e fundo de Savé/Dã; chão batido em acampamentos/aldeias; trilhas claras. Grama dourada (`gramaDoChao 0,55`), quase nula em encostas, trilhas e no Moriá.
5. Variantes (`definirVariantes`): oliveira (TwistedTree_1/4, folha recolorida prateada), carvalho (CommonTree_3/5, Manre e esparsos), carvalhoGrande (CommonTree_1: Moré e Manre), arvoreJordao, cipreste (Pine_5, encostas), arbusto / arbustoVerde (Bush_Common recolorido), pedra (Rock_Medium_1/3 recolorida calcário), flores, capim. `zonasLivres` + trilhas + corredor do Moriá ficam sem vegetação.

## Peças móveis, escaladas e a subida do Moriá
- **Acampamentos**: por lugar, uma malha de servos (3 tendas, fogo, utensílios) + tendaAbrao/tendaSara em duas versões (montada/desmontada). `mostrar()` liga malha e colisores; a navegação é refeita na região.
- **Porteiras**: `Porteira` gira na dobradiça (amortecida); o colisor acompanha o painel; aberta fica encostada para fora (+z local do curral). Currais 14 × 10 m com cerca de colisores.
- **Trecho 1**: rampa navegável com lajes (degraus visuais) → patamar → parede de 3,5 m. Colisor `paredeMoria` (de baixo é parede, de cima é chão). Escaladas em `mundo.escaladas`: `paredeMoria` (ativa; para o batedor) e `cordaMoria` (inativa até `amarrarCordaMoria(true)`).
- **Trecho 2**: passagem estreita (meia-largura 1,6) e fosso de 3 m com 7 fileiras × 2 pedras (`MORIA.pedrasFirmes`). Firmes têm colisor; soltas não. O meio do caminho não tem apoio. Cair → área `fossoMoria` devolve o ativo a `estreitoMoria` e chama `aoCairFosso`.
- **Trecho 3**: `patamarMoria` largo, com laje para sentar. **Trecho 4**: trilha de 1,4 m, exposta, até o platô (raio 7,5) com coroa de rochas, `altarMoria` e o arbusto denso (colisor `arbustoCarneiro`).
- **Paredes invisíveis** (tag `invisivel`): bordas do corredor entre o pé do penhasco e o platô, anel no pé do penhasco e anel na borda do platô. Sem elas o personagem subiria qualquer encosta (ver problemas).
- **Navegação**: pé→parede e corda→fosso e estreitoFim→topo têm caminho; pé→topo não (parede e fosso exigem script para o companheiro).
- **Fogueiras**: acampamentos, aldeias, aliados, Sodoma (2), Dã (6, ocultos) e um fogo por altar (só em 'aceso').

## Desempenho (q=medio, 800×450, inclui sombra)
Moré 80 calls/411k tri · Betel 64/440k · pastos 74/462k · Jordão 58/299k · Manre 72/333k · Dã à noite 48/218k · Salém 92/440k · Moriá de longe 76/329k · topo 76/242k · fosso 49/220k. Meta: ≤150 calls, ≤600k tri.

## Como verificar
`npx vite` e abra `/?lab=canaa&…`. Parâmetros: `ponto=nome` ou `pos=x,z`, `yaw`, `pitch`, `dist`, `hora` (pausa o céu), `cam=x,z,altura&alvo=x,z,altura|nomeDoPonto` (câmera livre), `acamp=betel|manre|nenhum`, `tendas=0`, `altares=construido|aceso`, `inimigo=1`, `porteiras=1`, `corda=1`, `pedras=1`, `grupo=1` (Sarai, Ló, Eliézer), `q=baixo|medio|alto`. `window.canaa`, `window.jogo`, `window.medir()` → `{calls, triangulos}`. Foto: `node e2e/foto.mjs "/?lab=canaa&ponto=topoMoria&altares=aceso" topo.png 960 540`. Um mapa visto de cima sai rápido importando `mapa.ts` com `npx vite-node` (sem navegador).

## Problemas conhecidos
- Física (motor): o bloqueio de encosta íngreme só age quando o ganho por quadro passa de 0,35 m, então anda-se encosta acima. O Moriá depende das paredes invisíveis. A câmera colide com elas: sugestão ao motor, `CameraTerceira` ignorar a tag `invisivel`.
- Texturas do kit: folhas de TwistedTree/Bush_Common são vermelhas e as rochas verde-escuras. `recolorirFolhas()` (construir.ts) troca `map_fragment` nos materiais clonados desta Natureza. O ideal seria uma opção de cor na `Natureza` (motor).
- Fogueiras não iluminam personagens (só brilho aditivo no ar e no chão). Relevo com passo de 2 m: penhascos facetados de perto. A grama do motor fica escura em alguns ângulos.
- Pedras soltas são idênticas às firmes; só `revelarPedras` as distingue (é o puzzle). O companheiro não navega pelo fosso nem pela parede.
- `MundoCanaa.ceu` precisa ser ligado a `jogo.ceu` por quem cria a era (o lab já faz).

## Próximos passos
Missões B1–B5 com estes nomes; rebanhos (10+10 ovelhas), jumento e carneiro; sentinelas com tochas usando `ROTAS_SENTINELAS`; vento e áudio no trecho 4; talvez mais árvores ao longo do Jordão se o orçamento permitir.
