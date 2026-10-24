# A Semente — documento de design

*Título provisório.* RPG 3D singleplayer de navegador que atravessa a narrativa bíblica de Gênesis a Apocalipse. O fio condutor do jogo inteiro é a promessa da **Semente**: anunciada em Gênesis 3:15, guardada na linhagem de Noé e Abraão e cumprida em Cristo ("e à tua semente, isto é, a Cristo", Gálatas 3:16).

---

## 1. Arquitetura e stack

| Camada | Escolha |
|---|---|
| Renderização | Three.js (WebGL2), materiais Lambert com cores por vértice, luz hemisférica + sol com uma sombra que segue o jogador, neblina |
| Linguagem / build | TypeScript + Vite |
| Física | Controlador cinemático próprio: cápsula contra terreno (heightfield), caixas, rampas e volumes de escalada |
| Navegação dos coadjuvantes | Grade A* sobre o terreno + pontos de cooperação fixos nos puzzles |
| Interface | HTML/CSS sobre o canvas |
| Áudio | Web Audio sintetizado (ambiente, passos, lira Karplus-Strong, transições) |
| Save | IndexedDB: 3 slots + autosave, exportar/importar `.json`, schema versionado |
| Hospedagem | Estática (GitHub Pages via Actions) |

```
src/
  core/       laço do jogo, entrada, eventos, aleatoriedade com semente
  render/     renderer, céu e ciclo do dia, terreno, vegetação, água, materiais
  mundo/      heightfield, colisores, física, navegação
  entidades/  personagens e animais procedurais com animação, objetos
  camera/     câmera de 3ª pessoa, troca de personagem, transição de era, cinemáticas
  jogo/       personagens, atributos, XP, classes, interações, quests, diálogos,
              provas espirituais, memórias, armadura de Deus
  eras/       noe/ e abraao/: mapa, personagens, rotinas e quests de cada era
  ui/         HUD, menus, diálogo, diário, roda de personagens
  save/       persistência
  data/biblia versiculos.json (gerado; único lugar com texto bíblico)
```

**Regras de dados.** Todo texto bíblico vem de `src/data/biblia/versiculos.json`, gerado por `scripts/extrair-versiculos.mjs` a partir das fontes (BKJ Fiel 1611, NVT, KJV). Diálogos citam versículos *por referência*; o texto nunca é digitado à mão no código. Um validador confere que toda citação existe na fonte.

**Orçamento de desempenho** (notebook com vídeo integrado, 60 fps): até ~150 draw calls e ~500 mil triângulos visíveis; vegetação instanciada; uma sombra direcional; sem pós-processamento pesado; resolução interna ≤ 1,5× com escala dinâmica; presets Baixo/Médio/Alto. A geometria é gerada por código a partir de semente, então quase nada é baixado. Cada personagem e objeto ocupa um "espaço" num manifesto; um modelo glTF pode substituir o procedural sem mudar o código do jogo.

---

## 2. Princípios narrativos

1. **A Bíblia é o trilho; o jogador escolhe como caminhar entre os trilhos.** Os eventos registrados acontecem como a Escritura conta. As escolhas do jogador moldam o que o texto não registra: o tom de uma conversa, quem ajudar, quanto servir, o que explorar. As consequências aparecem em atributos, relações, Unidade do grupo, memórias e no mundo.
2. **Falas.** Uma fala bíblica é citada da BKJ, com a referência visível. Uma fala que a Bíblia não registra leva o selo **"fala do jogo"** e não pode contradizer o texto.
3. **Deus** nunca aparece como figura humana. Sua voz é texto em tipografia própria, acompanhada de luz, vento, nuvem e fogo, imagens que a própria Escritura usa. As aparições do Anjo do SENHOR e os visitantes de Gênesis 18 são figuras envoltas em luz, de rosto não mostrado.
4. **Satanás** é o vilão central, mas não é um chefe para derrotar com golpes. Ele age por:
   - **Tentação:** sussurros e "dardos" de mentira.
   - **Engano:** sinais falsos e atalhos que levam ao erro, revelados pelo Discernimento.
   - **Divisão:** queda da Unidade do grupo.
   - **Opressão:** medo, escuridão e peso.
   Ele aparece como serpente só no prólogo (Gênesis 3). Sua derrota final é a do Apocalipse (Ap 20:10), cumprindo Gênesis 3:15.
5. **Jesus.** Proposta em camadas:
   - **Eras do Antigo Testamento:** Cristo é *presença*. Cada era tem figuras e promessas que apontam para Ele, registradas no Diário como "Aponta para Cristo".
   - **Era de Jesus:** Ele é o **protagonista narrativo e o centro de cada quest**, mas o jogador controla os discípulos na maior parte do tempo: segue, serve, aprende, falha e é restaurado (Pedro).
   - **Sequências em que o jogador controla Jesus:** existem, com ações restritas e reverentes (andar, tocar para curar, ensinar, carregar a cruz). Não há opções erradas, pulo livre nem combate, e Ele só fala o que os Evangelhos registram.
   - **Por quê:** controlar Jesus livremente permitiria fazê-Lo agir de forma tola ou pecaminosa. Reduzi-Lo a NPC distante apagaria o centro da história. A camada mista mantém a reverência sem tirar o jogador da cena.

---

## 3. Mapa das eras do jogo completo

| # | Era | Protagonista | Coadjuvantes jogáveis | Região | Tema | Aponta para Cristo |
|---|---|---|---|---|---|---|
| 0 | Prólogo (Gn 1–3) | — (narrado) | — | Éden | Criação, queda, promessa | A Semente da mulher (Gn 3:15 → Gl 4:4) |
| 1 | **Noé** (Gn 6–9) | Noé | Sem, Cam, Jafé | Vale antediluviano, a arca, montes de Ararate | Graça, obediência, salvação | A arca de uma só porta (Jo 10:9; 1 Pe 3:20-21; Mt 24:37) |
| 2 | **Abraão** (Gn 12–22) | Abrão / Abraão | Sarai/Sara, Ló, Eliézer, Isaque | Canaã: Betel, Manre, Salém, Moriá | Fé e promessa | A Semente (Gl 3:16); Melquisedeque (Hb 7); o carneiro no lugar do filho (Jo 1:29; Rm 8:32) |
| 3 | José (Gn 37–50) | José | Judá, Rúben, Benjamim | Canaã e Egito | Providência e perdão | Rejeitado pelos irmãos, exaltado para salvar (Gn 50:20; At 7:9-14); o cetro de Judá (Gn 49:10) |
| 4 | Moisés (Êx–Dt) | Moisés | Arão, Miriã, Josué, Hur | Egito, Mar Vermelho, Sinai | Libertação e aliança | Páscoa (1 Co 5:7), maná (Jo 6:32-35), rocha (1 Co 10:4), serpente de bronze (Jo 3:14) |
| 5 | Josué (Js) | Josué | Calebe, Raabe, Finéias | Jericó e Canaã | Coragem pela fé | Josué/Yeshua; Raabe na genealogia (Mt 1:5) |
| 6 | Rute (Rt) | Rute | Noemi, Boaz | Moabe e Belém | Lealdade e redenção | Boaz, o parente remidor (Rt 4; Mt 1:5) |
| 7 | Davi (1–2 Sm) | Davi | Jônatas, Abigail, os valentes, Natã | Belém, vale de Elá, Jerusalém | Coração segundo Deus, arrependimento | Filho de Davi, trono eterno (2 Sm 7:12-16; Lc 1:32-33) |
| 8 | Elias (1–2 Rs) | Elias | Eliseu, Obadias, a viúva de Sarepta | Israel do Norte, Carmelo | Fidelidade em tempo de idolatria | Elias e João Batista (Ml 4:5; Mt 17:10-13) |
| 9 | Isaías (Is) | Isaías | Ezequias | Jerusalém sob a Assíria | Santidade e esperança | Emanuel e o Servo Sofredor (Is 7:14; 53 → Mt 1:23; At 8:32-35) |
| 10 | Jeremias (Jr, Lm) | Jeremias | Baruque, Ebede-Meleque | Jerusalém em cerco | Fidelidade no juízo | A nova aliança (Jr 31:31-34 → Lc 22:20) |
| 11 | Daniel (Dn) | Daniel | Hananias, Misael, Azarias | Babilônia | Fidelidade no exílio | O Filho do homem (Dn 7:13-14 → Mt 26:64) |
| 12 | Ester (Et) | Ester | Mardoqueu | Susã, Pérsia | Providência oculta, coragem | A intercessora que arrisca a vida (figura) |
| 13 | Neemias (Ne, Ed) | Neemias | Esdras, os construtores dos muros | Jerusalém em ruínas | Restauração e união | A Palavra lida e explicada (Ne 8 → Lc 24:27) |
| 14 | Jesus (Evangelhos) | Jesus (camada mista, ver §2) | Pedro, João, André, Maria Madalena, Marta | Galileia, Judeia, Jerusalém | O Reino, a cruz, a ressurreição | O cumprimento de tudo (Lc 24:44) |
| 15 | Paulo (Atos, epístolas) | Paulo | Barnabé, Silas, Timóteo, Lucas, Lídia | Império Romano | A missão a todas as nações | "Em ti todos os povos serão abençoados" cumprido (Gl 3:8) |
| 16 | Epílogo (Apocalipse) | João | — | Patmos, a nova Jerusalém | Vitória final | O Cordeiro que venceu (Ap 5; 21–22) |

**Entrelaçamento.** Promessas, objetos, lugares e escolhas cruzam as eras pelo **Livro das Memórias**. Uma memória conquistada numa era vira recurso de fé nas seguintes. Por exemplo, o arco-íris de Noé dissipa a dúvida de Abrão sob as estrelas. Cada profecia tem uma entrada "Cumprido em Cristo" que se completa na era em que se cumpre.

---

## 4. Atributos (sem magia)

Escala de 1 a 10. Os atributos **crescem pelo uso** (fazer a coisa) e **mudam o mundo**, não só um número.

| Atributo | Cresce com | Influencia / desbloqueia | Como não vira só número |
|---|---|---|---|
| **Força** | carregar, empurrar, construir | objetos mais pesados, construir mais rápido | o personagem passa a carregar troncos que antes não erguia |
| **Resistência** | longas caminhadas, trabalho contínuo | fôlego (corrida, carga, segurar posição) | barra de fôlego visível; anda curvado quando cansado |
| **Agilidade** | escalar, equilibrar-se, explorar | paredes mais altas, vigas estreitas | rotas novas no mapa |
| **Fé** | obedecer antes de ver o resultado, provas espirituais, memórias | "passos de fé": caminhos que só aparecem quando se avança; escudo maior | a luz das memórias fica mais intensa |
| **Comunhão com Deus** | orar, altares, adoração | dicas da "voz mansa", regeneração do Domínio próprio, sussurros mais fracos | o personagem cantarola; altares brilham ao se aproximar |
| **Domínio próprio** | resistir a tentações, responder com brandura | resistência mental nas provas (tentação, ira, medo) | é a barra que as mentiras atacam nas provas |
| **Sabedoria** | tempo de oração, leitura e meditação (Escrituras no diário, altares) | falas de conselho, dicas de puzzle, melhores acordos | opções de diálogo novas aparecem marcadas com ✦ |
| **Compaixão** | servir NPCs, cuidar de animais, partilhar | acalmar animais e pessoas, missões de serviço | animais se aproximam, crianças seguem, NPCs cumprimentam |
| **Humildade** | ceder, servir sem recompensa, aceitar correção | caminhos de reconciliação; falas de orgulho reduzem a Unidade | o tom das conversas muda conforme o histórico |
| **Perseverança** | concluir tarefas longas, tentar de novo, suportar zombaria | segurar posições por mais tempo, "não desistir" com fôlego zerado | o personagem continua andando, devagar, quando outro pararia |
| **Discernimento** | identificar mentiras e enganos, estudar a Palavra | revela sinais falsos e atalhos enganosos (pulso com tecla) | o mundo mostra marcas que antes estavam ocultas |
| **Coragem** | entrar em lugares de medo, firmar-se em tempestades e alturas | reduz o efeito do medo (tremor, vinheta, lentidão) | o personagem para de hesitar na borda das alturas |

**Unidade** é um valor do *grupo*, não de um personagem. Sobe com cooperação e paz e cai com contenda. Unidade alta dá bônus de XP e fôlego compartilhado: "o cordão de três dobras não se quebra tão depressa" (Ec 4:12).

---

## 5. Classes e "armas"

| Classe | Arquétipo clássico | Papel no grupo | Ferramentas | Ações | Físico / Espiritual / Cooperativo | Quem (MVP em negrito) |
|---|---|---|---|---|---|---|
| **Construtor** | engenheiro / tanque utilitário | ergue, conserta, abre passagem | machado, martelo, prumo, cordas, betume | construir, reparar, fixar, montar andaimes | estruturas e reparos / fidelidade na obra (Cl 3:23) / prepara o caminho para os outros | **Noé**, Bezalel, Neemias |
| **Guerreiro** | guerreiro / tanque | protege, sustenta, luta quando a história pede | escudo, cajado de luta, espada (só em batalhas narrativas) | carregar pesado, empurrar, segurar posição, aparar e desarmar | força e combate / coragem / segura alavancas e guinchos enquanto outros agem | **Cam**, **Eliézer**, Josué, Jônatas |
| **Batedor** | ladino / explorador | alcança o inacessível | corda, tocha | escalar, equilibrar, amarrar cordas, espiar | rotas e alturas / coragem / abre caminho para o grupo | **Jafé**, **Isaque**, Calebe |
| **Sacerdote** | curandeiro / suporte | cuida do grupo diante de Deus | altar, incenso | acalmar (pessoas e animais), interceder (restaura o Domínio próprio do grupo), abençoar | — / intercessão / estabiliza o grupo nas provas | **Sem**, Arão, Samuel |
| **Profeta** | "mago" sem magia: a Palavra | fala a verdade, discerne, intercede | a Palavra (Espada do Espírito) | proclamar, discernir (revela enganos), interceder | — / proclamação e discernimento / revela o caminho certo | **Abrão** (Gn 20:7), Moisés, Elias |
| **Pastor** | arqueiro / ranger | guia e protege rebanhos | cajado, funda, assobio | guiar rebanhos, funda à distância (alvos, alavancas), rastrear | precisão / cuidado (Jo 10:11) / conduz animais em puzzles | **Ló**, Davi, Moisés em Midiã |
| **Servo hospitaleiro** | suporte / curandeiro | sustenta pessoas e o grupo | jarro, forno, pão | preparar alimento, cuidar (recupera fôlego), servir NPCs | logística / hospitalidade (Hb 13:2) / abastece quem segura posições | **Sarai/Sara**, Rebeca, Rute, Marta |
| **Conselheiro** | bardo / diplomata | media, negocia, interpreta | rolos, harpa | negociar, mediar contendas, ler e interpretar | — / sabedoria / resolve conflitos que bloqueiam o grupo | José, Abigail, Daniel |

Cada era monta um grupo complementar. Na **era de Noé**, Noé constrói, Cam sustenta, Jafé alcança e Sem acalma. Na **era de Abraão**, Abrão discerne e intercede, Ló guia rebanhos, Eliézer protege e Sarai serve. Isaque escala o Moriá ao lado do pai.

### Armadura de Deus (Efésios 6:13-17)

Equipamento espiritual com seis espaços. Cada peça é conquistada numa era em que sua virtude é *vivida*. O Diário a liga ao versículo de Efésios, numa camada de leitura que já olha para trás a partir de Cristo.

| Peça | Efeito nas provas | Onde se conquista |
|---|---|---|
| Espada do Espírito (a Palavra) | "Está escrito": responde a uma mentira com um versículo já recebido | Era 1 — Pregoeiro da justiça |
| Capacete da salvação | reduz o medo (vinheta, tremor) | Era 1 — Quarenta dias (a arca) |
| Calçado da paz | a Unidade cai menos; reconciliação mais rápida | Era 2 — Não haja contenda |
| Escudo da fé | bloqueia os "dardos inflamados" de mentira | Era 2 — "Eu sou o teu escudo" (Gn 15:1) |
| Couraça da justiça | protege o Domínio próprio das acusações | Era 2 — "atribuiu isto por justiça" (Gn 15:6) |
| Cinturão da verdade | revela mentiras automaticamente | Fora do MVP (era de Jacó/José) |

---

## 6. Progressão e XP

XP **nunca vem de derrotar inimigos**. A única exceção é um valor fixo por concluir uma batalha narrativa, nunca por inimigo.

| Fonte | XP |
|---|---|
| Completar uma quest | 100 |
| Puzzle cooperativo resolvido (com troca de personagem) | 60, para todos os envolvidos |
| Resistir a uma tentação / vencer uma prova | 60 |
| Puzzle comum | 40 |
| Construir ou restaurar uma estrutura | 30 |
| Servir um NPC ou animal | 20 |
| Descobrir um segredo / ponto de exploração | 25 |
| Disciplina espiritual (orar num altar, meditar na Palavra) | 10, com intervalo |

- **Nível** (1–10, por personagem) libera os **dons** da classe. Exemplo: Construtor nv. 2 "Mãos firmes", constrói 25% mais rápido.
- **Atributos** crescem pelo uso. O XP mede maturidade; os atributos medem caráter.
- **Unidade** alta dá +20% de XP de cooperação.

### Desafios espirituais (arcos de caráter)

| Prova | Mecânica | Vitória | Derrota |
|---|---|---|---|
| **Tentação** | sussurros viram dardos com texto; Domínio próprio é a barra; Espada ("Está escrito") e Escudo respondem | a mentira se desfaz, o mundo recupera a cor | "a luta continua": recomeça do ponto da prova, sem punição dura |
| **Ira / provocação** | zombarias sobem a ira; segurar *orar em silêncio* acalma, mas pausa o avanço | concluir a mensagem com brandura (Pv 15:1) | o personagem se retira para orar e recomeça |
| **Medo** | escuridão, tempestade, alturas: vinheta e tremor; Coragem, Capacete e oração reduzem | andar até o fim confiando (Sl 56:3) | volta ao último ponto firme |
| **Dúvida** | sob a noite, cada memória de fidelidade lembrada acende estrelas e afasta a névoa | o céu se enche e "creu ele no Senhor" | a névoa volta; lembrar outras memórias |
| **Arrependimento e restauração** | em personagens cuja queda a Bíblia registra (ex.: Davi), a queda acontece; o caminho de volta passa por confissão no altar e restauração de relações | relação e Unidade restauradas (1 Jo 1:9) | — |

Personagens cuja fidelidade a Bíblia registra *não pecam* pela mão do jogador. A prova deles é uma luta que pode ser repetida, nunca uma alteração do texto.

---

## 7. Troca de personagem (estilo GTA V)

**Controles**
- **1–4**: troca rápida.
- **Tab (segurar)**: roda de personagens com retrato e a atividade atual de cada um ("Sem — alimentando os animais").
- **F**, perto de um coadjuvante: "Siga-me" / "Espere aqui".

**Câmera, dentro de uma era (tons frios, aérea)**
1. A câmera sobe do personagem atual em **três saltos**, com o som de um sopro e a imagem levemente dessaturada.
2. Viaja pelo céu até ficar acima do outro personagem.
3. Desce em três saltos.
4. A legenda mostra o que ele está fazendo.

Leva cerca de 2,5 s e não tem tela de carregamento.

**Transição entre eras (tons dourados, aproximação)** é visualmente oposta:
1. **Zoom** até o rosto do protagonista atual.
2. Luz dourada; os nomes da **genealogia** passam como fios de luz (Gn 11:10-26, a mesma linha que Lucas 3:34-36 leva até Jesus).
3. O mundo se **dissolve e se reconstrói em onda**, a partir do personagem.
4. A câmera se **afasta** já no protagonista e no cenário da nova era.

**Quem não está sendo controlado continua vivendo:**
- **Rotina** por horário e por etapa da história: trabalhar, comer, descansar, orar, conversar.
- **Posto de cooperação:** um personagem que está segurando algo (guincho, porteira, corda) **continua segurando** quando o jogador troca, até ser liberado. Essa é a base dos puzzles cooperativos.
- **Comandos:** seguir ou esperar.
- **Reações:** olhar para quem chega, cumprimentar, afastar-se de perigo, comentar o que acontece.
- Se ficar preso fora da tela, é reposicionado.

**Restrições:** não se troca durante diálogos, cinemáticas e provas. Um personagem fica indisponível quando a história pede (Ló depois de Gênesis 13; Isaque só no Moriá).

---

## 8. Texto bíblico e "Entender melhor"

- **Banner de versículo.** Aparece no alto da tela por alguns segundos nos momentos-chave, com o texto BKJ e a referência. Não pausa o jogo e é arquivado no Diário.
- **Diálogos.** Uma fala bíblica mostra a referência. Passar o mouse sobre ela mostra o versículo; clicar abre "Entender melhor".
- **Diário (J) → Escrituras.** Cada versículo recebido tem o botão **Entender melhor**, que abre:
  - a BKJ e a **NVT lado a lado**;
  - uma nota curta do jogo, marcada como nota;
  - quando houver, a entrada **"Aponta para Cristo"**;
  - recolhido, o texto de origem em inglês (KJV), para estudo.
- **Meditar.** Ler um capítulo das Escrituras no Diário num lugar tranquilo (tenda, altar) faz o tempo passar e aumenta a Sabedoria. É opcional e nunca é um quiz.

---

## 9. Escopo exato do MVP: Noé → Abraão

**Por que essas duas eras:**
- são o começo real da história linear;
- pedem natureza, tendas e a arca, o que combina com arte procedural;
- a ligação entre elas é literal: Sem → … → Abrão (Gn 11:10-26), o arco-íris e as estrelas, o altar de Noé e os altares de Abrão.

### Era 1 — Noé: "Vale de Noé" (região de ~460 × 460 m)
Prólogo narrado (Gn 1:1; 3:15; 6:5-8), seguido de:

| Quest | Tipo exigido | Resumo |
|---|---|---|
| A1 Achou graça | **desafio físico** + tutorial | Oração no monte (Gn 6:13-14). Cortar e levar troncos de gofer até o estaleiro, gerenciando o fôlego, com Cam (primeira troca). |
| A2 A viga mestra | **puzzle cooperativo** | Cam segura o guincho, Jafé escala o andaime e amarra a corda, Noé fixa a viga e betuma (Gn 6:14-16). |
| A3 Pregoeiro da justiça | **desafio espiritual** | Pregar na cidade sob zombaria (ira/domínio próprio). Tentação de desistir respondida com "Está escrito" (Gn 6:18). Ganha a Espada. |
| A4 De dois em dois | serviço / exploração | Os animais vêm (Gn 6:20). Sem acalma os agitados, Jafé colhe no alto, Cam leva o mantimento (Gn 6:21). Um par perdido numa gruta. |
| A5 Quarenta dias | **masmorra** | Arca em 3 andares durante o dilúvio: vazamentos (Noé + Cam), animais inquietos e carga deslizando (Sem + Jafé), oração no medo (Gn 8:1), a janela, o corvo e a pomba (Gn 8:6-12). Ganha o Capacete. |
| A6 O sinal da aliança | final da era | Saída da arca, altar (Gn 8:20), arco-íris (Gn 9:13). Memória **"O sinal da aliança"** → transição. |

### Era 2 — Abraão: "Canaã" (região de ~520 × 520 m, geografia condensada)

| Quest | Tipo exigido | Resumo |
|---|---|---|
| B1 Para a terra que eu te mostrarei | tutorial da era | Chegada (Gn 12:5-8). Erguer tendas em dupla e construir o altar entre Betel e Ai. A habilidade de construir altar vem de Noé. |
| B2 Não haja contenda | **puzzle cooperativo** + escolha moral | Ló conduz o rebanho enquanto Eliézer segura a porteira, para separar os rebanhos. Os pastores brigam: o jogador escolhe o tom da resposta. Gênesis 13:8-11: Ló escolhe pela vista e parte. "Caminha pela terra" (13:17): 4 mirantes. Ganha o Calçado da paz. |
| B3 Trezentos e dezoito | **desafio físico / batalha narrativa** | Resgate de Ló à noite (Gn 14:14-16). Troca entre Abrão e Eliézer para flanquear sem ser visto, combate curto de aparar e desarmar, libertar os cativos. Depois Melquisedeque (14:18-20) e a tentação dos bens de Sodoma (14:21-23). |
| B4 Conta as estrelas | **desafio espiritual** | "Eu sou o teu escudo" (15:1). A dúvida (15:2-3) é vencida lembrando memórias, **incluindo o arco-íris da era 1**, que enchem o céu de estrelas (15:5-6). Ganha o Escudo e a Couraça. |
| B5 O Senhor proverá | **masmorra / desafio maior** | Abrão passa a se chamar Abraão (17:5). Subida do Moriá com Isaque: os dois devem seguir juntos (22:6-8), Isaque escala e Abraão abre caminho. Clímax em cinemática reverente, o carneiro preso no arbusto (22:13) e a promessa (22:18 → Gl 3:16). Fim do MVP. |

### Conexões concretas entre as eras no MVP
1. **Arco-íris → estrelas.** A memória "O sinal da aliança" (A6) é a primeira e a mais forte arma contra a dúvida em B4. Quanto mais memórias o jogador guardou na era 1, inclusive os segredos, mais fácil a prova.
2. **O altar.** Noé aprende a construir o altar (A6). Abrão constrói altares com a mesma habilidade (B1, B2), e o Diário registra a herança.
3. **A linhagem.** Sem é jogável na era 1. A transição mostra a genealogia até Abrão. O Diário liga a linhagem a Lucas 3:34-36 e a Gálatas 3:16.
4. **Legado de caráter.** Os atributos espirituais do grupo de Noé deixam um "legado" (pequeno bônus inicial) em Abrão.

### Fora do MVP
- As eras 3 a 16 e o prólogo jogável (no MVP, o prólogo é só narrado).
- Egito (Gn 12:10-20), Agar (Gn 16), Sodoma (Gn 19), Manre (Gn 18).
- Cinturão da verdade e a classe Conselheiro jogável.
- Dublagem, música composta, celular/touch, mundo contínuo entre eras.
- Modelos 3D profissionais: o MVP usa personagens procedurais com manifesto pronto para troca.
