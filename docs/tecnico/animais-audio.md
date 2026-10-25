# Animais e áudio: notas técnicas

## Arquivos
| Arquivo | Papel |
|---|---|
| `src/entidades/Animal.ts` | `class Animal` (lógica, comportamentos, física, LOD, fade), fábricas `criarAnimal`, `criarPar` e `precarregarAnimais`. |
| `src/entidades/Rebanho.ts` | `class Rebanho` (boids que fogem do pastor), `dentroArea`. Teste em `Rebanho.test.ts`. |
| `src/entidades/animais/especies.ts` | Catálogo `ESPECIES` (tipo `Especie`): GLB ou procedural, raio, altura, velocidades, voz, escala da fêmea. |
| `src/entidades/animais/Corpos.ts` | `CorpoGLB` (funde as dezenas de peças de cada GLB numa só SkinnedMesh com cor por vértice) e `CorpoProcedural`. Ambos cacheiam o molde por espécie e clonam só o esqueleto. |
| `src/entidades/animais/Marcha.ts` | `Marcha`: ciclo de andar procedural (pernas, quique, cabeça, cauda, orelhas, tromba, asas) e `PoseAnimal`. |
| `src/entidades/animais/Montador.ts` | Monta animais low-poly: ossos + peças rígidas (elipsoide, membro, cone, tubo, leque) → 1 SkinnedMesh, 1 material compartilhado. |
| `src/entidades/animais/procedurais.ts` | As 13 espécies procedurais (macho e fêmea). |
| `src/audio/Audio.ts` | `SistemaAudio` e o singleton `Audio` (API pública), `EFEITOS`. |
| `src/audio/Efeitos.ts` | Síntese dos efeitos e vozes dos animais (`tocarEfeito`, `sino`, cache de cordas). |
| `src/audio/Ambientes.ts` | `Camada` (contínua + eventos aleatórios) e `MISTURAS` (nome pedido → camadas). |
| `src/audio/Musica.ts` | Música generativa (`Musica`, `ESTADOS_MUSICA`). |
| `src/audio/sintese.ts` | Funções puras: ruídos, Karplus-Strong, resposta de impulso, modos/acordes. Teste em `sintese.test.ts`. |
| `src/lab/animais.ts` + ramo `?lab=animais` em `src/main.ts` | Laboratório (ver "Verificar"). |

## API dos animais
```ts
criarAnimal(especie: Especie, mundo: MundoAnimais, x, z, opts?: {
  ativos?, sexo?: 'macho'|'femea', y?, yaw?, escala?, tom?: ColorRepresentation, registrar? = true, pai?, semente?, tag?
}): Promise<Animal>     // MundoAnimais = { fisica, nav?, grupo?, atualizaveis? } (um Mundo serve)
criarPar(especie, mundo, x, z, opts?): Promise<[macho, femea]>   // a fêmea segue o macho
precarregarAnimais(especies[], ativos?)
class Animal {
  especie; info; sexo; raiz: Object3D; corpo; fisico: CorpoFisico; estado: EstadoAnimal; yaw; tag; dados; desejo; alarme
  get posicao(): Vector3 (= pos)   get visivel   topo(out?)   posicaoCabeca(out?)
  vagar(raio?) | vagar(cx, cz, raio)      seguir(alvo: {posicao}, dist = 2.5)      parar()   emCena()
  irPara(x, z, {correr?, direto?, raio?, velocidade?}?): Promise<void>   irPor(pontos, op?): Promise<void>
  entrar(pontos: [x,z][] | Vector3[], op?): Promise<void>   // anda e some com fade (entrar na arca)
  fugirDe(pos, segundos = 3)   agitar({raio = 2.5}?)   acalmar()   get estaAgitado
  prender() / soltar()        // carneiro preso pelos chifres (Gn 22:13): debate-se no lugar
  voarPara(x, y, z, op?) | voarPara(alvo: Vector3 | [x,y,z] | () => Vector3 | {posicao} | Object3D, op?): Promise<void>
  voarPor(pontos, {pousar = true, altura = 6, velocidade?, sumir?}?): Promise<void>   pousarEm(alvo)
  olharPara(p | null)   teleportar(x, z, y?)   sumir(s = 1)   aparecer(x?, z?, s = 1)   remover(suave = true)
  registrar(pai?)   falar(volume?)   atualizar(dt, t)
  static todos: Set<Animal>; static camera: Camera | null; static distanciaAnimar = 70
  static descartar(mundo): number   // remove na hora os animais de um mundo que sai (troca de era)
}
class Rebanho { animais; pastor: Vector3 | null; ameacas: Vector3[]; destino
  constructor(animais, {raioMedo 6.5, vizinhanca, separacao, velPastar, velFuga, pesos...}?)
  adicionar(a) remover(a) juntar(segundos = 4) conduzirPara(x|null, z) seguirLider(lider|null, dist)
  centro() espalhamento() dentroDe(area, filtro?) animaisDentro(area, filtro?) atualizar(dt) }
// area: {x,z,raio} | {x0,z0,x1,z1} | (x, z) => boolean
```
Regras: um comando novo encerra o anterior e **resolve** a promessa pendente (não rejeita). `acalmar()` volta ao comportamento anterior ao susto (vagar/seguir/rebanho) ou fica parado. `criarAnimal` põe o animal em `mundo.grupo` e em `mundo.atualizaveis`; o `Rebanho` NÃO se registra sozinho (`mundo.atualizaveis.add(rebanho)`). `Animal.todos` é global (vale para todos os mundos): a era que sai chama `Animal.descartar(mundo)` no `desligar()` dela, senão os animais dela entram na separação dos animais da era seguinte. As duas eras fazem isso (`tests/animal-descartar.test.ts` e `tests/eras-desligar.test.ts`). Física: `CorpoFisico` (relevo + pisos de colisores, paredes, não entra em água funda, `passo` 0,45 m para subir rampas); desvio de obstáculos por sondas `fisica.livre` (em frente, depois ±0,6, ±1,2 e ±1,9 rad; enquanto desvia, guarda o lado por 2 s e tenta os ângulos dele antes dos do outro, senão treme num bolsão: `sondasDesvio`, `tests/animal-desvio.test.ts`); separação entre animais; travado 5 s → se perto do alvo conta como chegada, fora da tela teleporta, senão tenta a navegação (`mundo.nav`); se travar de novo no mesmo lugar (a rota não adiantou ou não há rota), teleporta também na tela, com fade de 0,6 s (`tests/animal-travado.test.ts`). `irPara` usa A* quando não há visada (use `direto: true` em interiores). LOD: sem animar além de 70 m ou fora da tela (visibilidade via `onBeforeRender`; a câmera é capturada sozinha se `Animal.camera` não for definida); 30–70 m anima a 24/12 Hz.

## Espécies
GLB (`public/modelos/animais/`, Quaternius; cada um é fundido em 1 draw call; paleta suavizada em `especies.ts`):
| Espécie | Clipes usados | Andar |
|---|---|---|
| cavalo, vaca, boi (= vaca, pelagem marrom), zebra | Idle, WalkSlow, Run (Jump, Death não usados) | clipes; timeScale pela velocidade |
| ovelha, porco, lhama | Idle (Jump existe) | marcha procedural nos ossos `Front/BackUpLeg*`, `*LowLeg*` |
| gato, lobo, cao (modelos virados para +X, `giro` −90°) | Idle, Walking | clipe (correr = Walking acelerado) |
| aguia | Idle (pairando), Flying | **24.800 triângulos**: usar pouco |

Procedurais (< 600 triângulos, cor por vértice, macho/fêmea): camelo (passo de andadura, corcova menor na fêmea), leao (juba só no macho), elefante (presas no macho, orelhas e tromba animadas), girafa (manchas), cabra (chifres e barba no macho), carneiro (chifres espiralados com sulcos; a fêmea é uma ovelha sem chifres), jumento (cruz no dorso), urso, cervo (galhada no macho), pomba (Gn 8:8), corvo (Gn 8:7), pato, avestruz.

## Como as missões usam
- **A4 pares**: `const [m, f] = await criarPar('camelo', mundo, x, z)`; `await m.irPara(sx, sz)`; `m.agitar()` → interação de Sem → `m.acalmar()`; `await Promise.all([m.entrar(pts), f.entrar(pts)])` com `pts = [saida, porta, ponto interno]` de `vale.pontoArca` (testado no vale real). A6: `a.aparecer(x, z)` na porta, `irPara`, `vagar(8)`.
- **A5 baias**: `criarAnimal('boi', mundo, p.x, p.z, { y: p.y + 0.3 })` com `p = pontoArca('baia1Animal')`, `agitar({ raio: 1 })`.
- **A5 aves**: corvo `voarPor([...], { pousar: false, sumir: true })` ("indo e voltando"); pomba `voarPor([...], { pousar: false })` e depois `await pomba.voarPara(pontoArca('pombaPouso'))`; para a mão: `pomba.voarPara(() => noe.humano.posicaoOsso('hand_l'))` ou `pousarEm(fn)` (segue a mão).
- **B2 rebanhos**: 20 ovelhas, as de Ló com `tom: '#7d6a5a'` (lã escura) e `tag: 'lo'`; `new Rebanho(ovelhas)`, `rebanho.pastor = lo.posicao` (referência viva), Q de Ló → `rebanho.juntar()`; contagem `rebanho.dentroDe((x, z) => canaa.dentroCurral('curralAbrao', x, z), a => a.tag === 'abrao')`; Ló partindo: `rebanho.seguirLider(lo, 3)`.
- **B5 carneiro**: `criarAnimal('carneiro', mundo, x, z, { yaw })` + `prender()` junto ao arbusto; `posicaoCabeca()` para a câmera; `soltar()` depois.

## Áudio
Grafo: fontes → `busEfeitos` (efeitos + `busAmbiente` 0,8) e `busMusica`; cada bus tem envio para um eco próprio (ConvolverNode com resposta sintética, 1,8 s e 2,8 s) que volta ao próprio bus; buses → `mestre` → compressor/limitador → destino. Tudo sintetizado: 3 buffers de ruído em laço (branco, rosa, marrom) e cordas Karplus-Strong cacheadas por nota.
```ts
Audio.iniciarNoPrimeiroGesto()          // ou await Audio.iniciar() num clique/tecla (política de autoplay)
Audio.ambiente(nome, 0..1, { pos?, alcance? = 40, transicao? = 2 }?)   Audio.silenciarAmbientes()
Audio.musica('calmo' | 'aventura' | 'prova' | 'gloria' | 'batalha' | 'silencio')
Audio.efeito(nome, { volume?, pos?, alcance? = 35, atraso?, superficie?, tipo?, distancia?, tom?, sexo?, duracao?, saltos? }?): boolean
Audio.volume({ geral?, musica?, efeitos? })  // salvo em localStorage 'aSemente.audio'; Audio.volumes
Audio.posicaoOuvinte(pos, yawCamera?)  // a cada quadro: atenuação + panorâmica das fontes posicionais
Audio.silenciar(bool)  Audio.ativo  Audio.estado  Audio.encerrar()
```
Antes de iniciar, `ambiente`/`musica` ficam guardados e `efeito` é ignorado (retorna false).
- **Ambientes** (`MISTURAS`): vale, canaa, vento, passaros, agua/rio, chuva, tempestade (chuva + vento + trovões), cidade (burburinho, tilintares, martelo), fogueira, noite (grilos), interiorArca/arca (rangidos, chuva abafada, trovões), monte. Cada camada só existe enquanto tem volume.
- **Música**: calmo (ré dórico, 66 bpm, lira esparsa), aventura (ré dórico, 96 bpm, arpejo + tambor de moldura), prova (mi frígio dominante, 70 bpm, bordão grave, batida), gloria (ré lídio, 78 bpm, pad cheio, arpejos e sinos), batalha (ré eólio, 108 bpm, i–VI–VII–i, arpejo firme, bordão grave e tambor `D.tdD.tt`; urgente sem ser agressiva), silencio. A troca entra no próximo compasso com cruzamento.
- **Efeitos**: passo (terra, grama, madeira, agua, pedra), clique, abrir, fechar, pegar, sopro (troca; `saltos: 3`), brilho (transição de era), sino, conquista (`tipo`: memoria, armadura, nivel, versiculo, xp; também como nomes diretos), trovao (`distancia`), agua, fogo, asas, martelo, machado, corda, portaArca, tranco, rangido, sussurro, coracao; da era 2: alarme (chifre de carneiro ao longe, duas notas em quinta), aparar (cajado contra cajado, madeira seca), golpe (deslocamento de ar e baque abafado, sem metal), discernir (notas agudas que se abrem sobre um sopro ascendente), pedra (pedra solta: estalo, cascalho e baque lá embaixo); vozes: balido, mugido, relincho, zurro, grunhido, rugido, barrito, latido, uivo, miado, arrulho/pomba, corvo, grasnado, grito. Os animais berram sozinhos quando agitados/presos e batem asas ao decolar.

## Verificar
- `?lab=animais` (todas as espécies, rebanho com Ló, ovelha agitada, pomba na mão de Noé, carneiro no arbusto). Parâmetros: `vista=todos|grandes|grandes2|pequenos|rebanho|aves|carneiro`, `so=<espécie>` (retrato do par), `foco=<espécie>&ang=&zoom=`, `t=<s simulados>`, `andar=<m/s>` (esteira), `rotulos=0`, `parar=1`. Clique liga o áudio.
- `?lab=animais&mundo=noe&cena=rampa|baias|janela&t=50`: vale real com a arca no estágio 5 (pares subindo a rampa), baias do convés 2, pomba e corvo na janela.
- `node e2e/foto.mjs "/?lab=animais&vista=pequenos&parar=1" saida.png` (o lab usa `preserveDrawingBuffer` para a foto não sair preta).
- `npx vitest run src/audio src/entidades` (afinação da lira, ruídos, modos; cada nome de `EFEITOS` toca num Web Audio falso e o estado `batalha` agenda notas, em `nomes.test.ts`; boids e áreas).
- Áudio no navegador: `new SistemaAudio().montar(new OfflineAudioContext(2, 44100*3, 44100))`, `efeito(...)`, `agendarAte(t)`, `startRendering()` → RMS (todos os efeitos, estados e ambientes foram medidos assim: sem silêncio nem NaN).
- Níveis dos sons da era 2 (Chromium headless, volumes padrão, janela de 3 s para efeitos e 12 s para música; RMS / pico em dBFS): alarme −28,5 / −8,0; aparar −41,0 / −10,8; golpe −37,1 / −10,2; discernir −29,3 / −12,9; pedra −33,1 / −9,4; música batalha −27,5 / −8,6. Referências medidas junto: martelo −38,0 / −10,7, machado −38,2 / −11,5, coracao −30,8 / −7,2, aventura −28,9 / −8,0. Golpe e aparar tocam a cada troca da batalha, por isso ficam no nível do martelo e abaixo do limitador (−10 dB).

## Cuidados e pendências
- `Audio` sombreia o construtor global `Audio` (HTMLAudioElement) nos módulos que o importam.
- Fade e `tom` clonam o material por animal (o `tom` é cacheado por cor); o resto compartilha 1 material por espécie.
- Clipes Quaternius andam devagar: velocidades acima de ~2× o natural escorregam um pouco (timeScale limitado a 0,6–2,4).
- Rampa/porta estreitas: pares se enfileiram pela separação; a chegada aceita 2,5 m quando travado.
- Não feitos: IK de pés no relevo, sons de passos dos animais, sombras/LOD de malha (só de animação), clipe Jump para pinotes, áudio espacial com PannerNode/HRTF, ducking da música nos diálogos, revisão de mixagem ouvindo (os níveis foram ajustados por RMS/pico).
