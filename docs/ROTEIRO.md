# Roteiro do MVP — missões, falas e mecânicas

Especificação de conteúdo das eras 1 (Noé) e 2 (Abraão). É a fonte que os scripts de missão
(`src/eras/*/missoes.ts`) implementam, usando o contrato `CtxMissao` de `src/jogo/contratos.ts`.

## Convenções

- **Falas bíblicas:** `deus: Gn 6:13 «trecho»` vira `{ quem: 'deus', ref: 'Gn 6:13', trecho: '…' }`.
  - O texto vem de `src/data/biblia/versiculos.json`.
  - Todo `trecho` abaixo já foi conferido como substring exata da BKJ Fiel 1611 fornecida.
  - Sem `«»`, a fala usa o versículo inteiro.
- **Falas de ficção:** `noe (ficção): "…"` vira `{ quem: 'noe', texto: '…' }` e recebe o selo "fala do jogo".
  - Nunca podem contradizer o texto bíblico.
  - São curtas, com tom reverente e caloroso.
- **Falantes especiais:** `deus` aparece só como voz e luz, nunca como figura. `anjo` é o Anjo do Senhor, de rosto não mostrado. `satanas` são sussurros, sempre ficção. `narrador`.
- **Faixa de versículo:** `banner: Ref` vira `c.versiculo(ref)`, que não pausa o jogo e já registra o versículo recebido no Diário.
- **Interativos:** `[id] verbo (quem pode) — rótulo`. Todo `id` é único na era.
- **Pontos:** os nomes vêm de `mundo.pontos` (mapa) ou de `MundoNoe.pontoArca(nome)` (dentro da arca).

---

## Personagens

### Era 1 — Noé (Gn 6–9)

| id | Nome | Classe | Atributos iniciais (for, res, agi, fé, com, dom, sab, cmp, hum, per, dis, cor) | Quem é | Arco no jogo |
|---|---|---|---|---|---|
| noe | Noé | construtor | 4,5,2,7,8,7,7,6,6,8,6,5 | "justo e perfeito nas suas gerações; andava com Deus" (Gn 6:9) | Obediência que persevera sem ver; "pregador da justiça" (2 Pe 2:5). Aprende `construirAltar` em A6. |
| sem | Sem | sacerdote | 4,5,4,6,6,5,5,7,5,5,5,4 | filho de Noé (Gn 6:10) | *(ficção)* O filho que aprende a cuidar dos animais e da família. Dele vem a linhagem da promessa (Gn 11:10). |
| cam | Cam | guerreiro | 7,6,4,3,3,3,3,4,3,5,3,6 | filho de Noé (Gn 6:10) | *(ficção)* Forte e impaciente; aprende a usar a força para sustentar os outros. |
| jafe | Jafé | batedor | 4,5,7,4,4,4,4,5,4,4,5,6 | filho de Noé (Gn 6:10) | *(ficção)* Curioso, olhos sempre além do horizonte. |

**NPCs:**
- A família: Mulher de Noé, Mulher de Sem, Mulher de Cam, Mulher de Jafé. A Bíblia não registra seus nomes; o jogo não os inventa.
- Na cidade: moradores (mercadores, crianças, zombadores, guardas). As rotinas mudam ao longo do dia: mercado de manhã, praça à tarde, casas à noite.

**Rotinas dos jogáveis antes da arca ficar pronta:**

| Personagem | Rotina |
|---|---|
| Noé | Estaleiro, de dia; ora no monte de oração ao amanhecer; descansa na casa à noite. |
| Sem | Cuida do curral e dos animais (atividade `colher`/`regar`); leva comida ao estaleiro ao meio-dia. |
| Cam | Corta lenha no bosque (`cortar` + machado) de manhã; carrega troncos à tarde. |
| Jafé | Explora a borda do bosque e o rio; trabalha no andaime à tarde. |

Mulheres: casa, trigal, poço, fogueira.

### Era 2 — Abraão (Gn 12–22)

| id | Nome | Classe | Atributos | Quem é | Arco | Disponível |
|---|---|---|---|---|---|---|
| abraao | Abrão → **Abraão** (flag `nomeAbraao`, Gn 17:5) | profeta (Gn 20:7) | 4,5,3,7,7,6,7,6,7,6,6,6 (+ legado) | chamado a sair (Gn 12:1) | Fé que obedece sem saber para onde (Hb 11:8). Herda `construirAltar` de Noé. | sempre |
| sara | Sarai → **Sara** (flag `nomeSara`, Gn 17:15) | hospitaleiro | 3,5,4,5,6,6,6,8,6,7,6,5 | mulher de Abrão (Gn 12:5) | Esperança provada; o riso (Gn 21:6). | B1, B2, B4 |
| lo | Ló | pastor | 5,6,6,4,3,4,4,5,3,4,3,5 | sobrinho de Abrão (Gn 12:5) | Escolhe pela vista (Gn 13:10-11); é resgatado (Gn 14:16). | B1–B2; volta como NPC em B3 |
| eliezer | Eliézer de Damasco | guerreiro | 6,7,5,5,5,6,6,5,6,6,5,7 | "o mordomo da minha casa" (Gn 15:2) | *(ficção)* Fiel administrador; lidera um flanco dos servos treinados em Gn 14:15. | B1–B4 |
| isaque | Isaque | batedor | 4,5,7,6,5,6,4,6,7,6,4,6 | filho da promessa (Gn 21:3) | Confiança no pai e em Deus (Gn 22:7-8). | só B5 |

**NPCs:**
- Melquisedeque, rei de Salém (Gn 14:18).
- O rei de Sodoma (Gn 14:17).
- Aner, Escol e Manre, aliados de Abrão (Gn 14:13, 14:24).
- Pastores de Abrão e pastores de Ló, sem nome.
- Os 318 servos, representados por um grupo de NPCs.
- "Um que havia escapado" (Gn 14:13).
- Os dois servos de Gn 22:3.

**Legado (era 1 → era 2), aplicado no início de B1:**
- Abrão ganha +1 de fé para cada 2 memórias opcionais (segredos) achadas na era 1, até +2.
- Abrão ganha +1 de domínio se A3 foi vencida na primeira tentativa.
- O Diário mostra: "Legado de Noé: …".

---

## Memórias (Livro das Memórias) — `src/eras/*/memorias.ts`

| id | Título | Ref | Força (dúvida) | Onde |
|---|---|---|---|---|
| graca | Achou graça | Gn 6:8 | 1 | A1 |
| pacto | Contigo estabelecerei o meu pacto | Gn 6:18 | 2 | A1 |
| pregador | Pregador da justiça | 2Pe 2:5 | 1 | A3 |
| portaFechada | O Senhor fechou a porta | Gn 7:16 | 2 | A5 |
| deusLembrou | Deus lembrou de Noé | Gn 8:1 | 2 | A5 |
| folhaOliveira | A folha de oliveira | Gn 8:11 | 2 | A5 |
| arcoIris | O sinal da aliança | Gn 9:13 | **3** | A6 (a ponte para B4) |
| enoque | Enoque caminhava com Deus *(segredo)* | Gn 5:24 | 1 | segredo no bosque |
| lameque | "Este nos consolará" *(segredo)* | Gn 5:29 | 1 | segredo junto à casa |
| estacoes | Semeadura e colheita *(segredo)* | Gn 8:22 | 1 | segredo no vale depois do dilúvio |
| chamado | O chamado | Gn 12:1 | 1 | B1 |
| altarBetel | O altar entre Betel e Ai | Gn 12:8 | 1 | B1 |
| naoHajaContenda | Não haja contenda | Gn 13:8 | 1 | B2 |
| percorreATerra | Levanta-te, caminha pela terra | Gn 13:17 | 2 | B2 |
| resgate | Trouxe de volta o seu irmão | Gn 14:16 | 2 | B3 |
| melquisedeque | Bendito seja Abrão | Gn 14:19 | 2 | B3 |
| nemUmFio | Nem um fio | Gn 14:23 | 1 | B3 |
| poDaTerra | Como o pó da terra *(segredo)* | Gn 13:16 | 1 | segredo em Canaã |
| estrelas | Conta as estrelas | Gn 15:5 | — | B4 (resultado) |
| jeovaJire | Javé-Jiré | Gn 22:14 | — | B5 |

## Aponta para Cristo (Diário) — `src/eras/*/cristo.ts`

| id | Título | Refs | Desbloqueia |
|---|---|---|---|
| semente | A Semente prometida | Gn 3:15; Gl 3:16 | prólogo (completa em B5) |
| arca | Uma só porta | 1Pe 3:20-21; Jo 10:9; Mt 24:37-39 | A5 |
| tempestade | Paz, aquieta-te | Mc 4:39-40 | A5 |
| linhagem | De Noé a Jesus | Lc 3:34; Lc 3:36 | transição de era |
| bencaoNacoes | Todas as famílias da terra | Gn 12:3; Gl 3:8; Gl 3:16 | B1 |
| melquisedeque | Rei de justiça e de paz | Hb 7:1-3 | B3 |
| justica | Creu, e foi justiça | Gn 15:6; Rm 4:3; Gl 3:8 | B4 |
| cordeiro | Deus proverá o cordeiro | Gn 22:8; Jo 1:29; Rm 8:32; Jo 8:56 | B5 |

Cada entrada tem 2–4 frases (texto do jogo, marcado como nota) ligando o texto do AT ao de Cristo, sem inventar versículos.

## Armadura de Deus

| Peça | Onde | Ref de ligação |
|---|---|---|
| espada | A3 | Ef 6:17 |
| capacete | A5 | Ef 6:17; 1Ts 5:8 |
| calcado | B2 | Ef 6:15 |
| escudo | B4 | Ef 6:16; Gn 15:1 |
| couraca | B4 | Ef 6:14; Gn 15:6 |

---

# ERA 1 — NOÉ

## Prólogo (cinemática curta, pulável)

Câmera sobrevoando o vale ao amanhecer.
1. narrador: Gn 1:1
2. *(ficção, narrador)* "Mas o homem desobedeceu, e o pecado entrou no mundo. Ainda assim, Deus fez uma promessa."
3. deus: Gn 3:15 (a promessa da Semente).
4. Desbloqueia `semente` (Aponta para Cristo).
5. narrador: Gn 6:5
6. narrador: Gn 6:8
7. narrador: Gn 6:9
8. Título: **"Era 1 — Noé"**, sub: "Gênesis 6–9".

## A1 — Achou graça
Tipos: tutorial, físico. Refs: Gn 6:8, Gn 6:13-14, Gn 6:22.

1. **orar** — "Suba ao monte de oração."
   - Noé começa perto de casa, às 6h. Dicas de tutorial: mover, câmera, correr, interagir.
   - Interativo [orarMonte] `orar` (todos) — "Orar". Segurar E por 2 s, com pose de oração.
   - Cena: luz dourada desce. deus: Gn 6:13 «O fim de toda a carne chegou diante de mim; pois a terra está cheia de violência por meio deles; e eis que eu os destruirei com a terra.»
   - deus: Gn 6:14
   - deus: Gn 6:15 (inteiro)
   - deus: Gn 6:18
   - Memórias `graca` e `pacto`; versículo recebido Gn 6:18 (será a primeira "palavra" de A3).
   - XP disciplina.
2. **madeira** — "Vá até o bosque de gofer, onde Cam corta lenha."
   - Chegar à borda do bosque.
   - cam (ficção): "Pai! Já derrubei estas. Mas carregar até o estaleiro é outra história."
   - Dica: "Pressione **Tab** (segure) ou **2** para trocar de personagem. Cada um tem sua força."
3. **troncos** — Desafio físico: "Leve 4 troncos ao estaleiro (0/4)."
   - Interativo [pilhaBosque] `carregarPesado` (Cam). Dica para outros: "Cam pode carregar troncos pesados."
   - Pega um tronco: `p.carregar('tronco')` (anda mais devagar e gasta fôlego).
   - Entregar em [entregaTroncos] `usar` (carregando 'tronco') no estaleiro (ponto `pilhaTroncos`).
   - Fôlego zerado: o personagem anda devagar. Descansar à sombra recupera mais rápido.
   - O vau e a encosta exigem administrar o fôlego (treina resistência e força).
   - Contador `troncos` 0→4.
   - Noé pode cortar mais árvores marcadas ([arvoreGofer1..3] `cortar` (Noé)): cada uma vira +1 tronco na pilha do bosque.
4. **quilha** — "Como Noé, assente a quilha."
   - Interativo [quilha] `construir` (Noé). Segurar E por 4 s com `consertar` + martelo.
   - Arca → estágio 1 (cavernas).
   - Recompensa: XP construir; Noé treina força.
   - narrador: Gn 6:22
   - Banner: Hb 11:7
   - Recompensa da missão: 100 XP.
   - Próxima: A2.

## A2 — A viga mestra (puzzle cooperativo)
Tipos: cooperativo, construção. Refs: Gn 6:14-16; Ec 4:9-10, 4:12.

1. **planejar** — "Fale com Sem, Cam e Jafé no estaleiro."
   - noe (ficção): "A viga mestra precisa subir até o alto das cavernas. Sozinho, ninguém a ergue."
   - jafe (ficção): "Eu subo o andaime e amarro a corda lá em cima."
   - cam (ficção): "E eu seguro o guincho. Só não demorem!"
   - Dica: "Coloque Cam no **guincho**, troque para Jafé e suba o andaime. Quem está num posto continua lá quando você troca."
2. **erguer** — Puzzle com três postos:
   - a) [guincho] `segurar` (Cam): posto com clipe `segurar`. Enquanto alguém está no posto, a viga sobe de 0 para 0,6 (`vigaMestra.definirAltura`). Se o posto for abandonado antes da amarração, a viga desce devagar.
   - b) [andaime] escalada (só batedor, `mundo.escaladas`) até o topo.
   - c) [ancoraCorda] `amarrar` (Jafé, no topo, segurar 3 s). Só fica ativo quando a viga está ≥ 0,6. Depois disso a viga fica presa (flag `vigaAmarrada`) e Cam pode soltar.
   - d) [encaixeViga1] e [encaixeViga2] `construir` (Noé, segurar 3 s cada, no chão, nas pontas).
   - Ao concluir: arca → estágio 2.
   - XP cooperação para os 3; treina força (Cam), agilidade (Jafé), perseverança (Noé).
   - Banners: Ec 4:9, Ec 4:12.
3. **betume** — "Betume por dentro e por fora (Gn 6:14)."
   - Interativo [caldeirao] `usar` (todos): pega `balde`.
   - [betumarCasco1..3] `reparar` (Noé ou qualquer um, segurar 2 s).
4. **anos** — Transição de tempo:
   - Fade para preto, título "Anos depois…".
   - Arca → estágio 4 (pronta e betumada).
   - Hora → fim de tarde.
   - Próxima: A3.

## A3 — Pregoeiro da justiça (desafio espiritual)
Tipos: espiritual. Refs: 2Pe 2:5; Hb 11:7; Pv 15:1; Gl 6:9; Gn 6:18.

1. **ir** — "Atravesse o vau e vá à praça da cidade."
   - Os moradores param e olham. Zombadores na praça.
   - Banner: 2Pe 2:5
2. **pregar** — "Proclame o aviso em três lugares (0/3)": [pregarPraca], [pregarMercado], [pregarTorre].
   - Em cada um começa uma prova `ira` (DefProva tipo 'ira', alvo 10).
   - Mentiras e zombarias (ficção):
     - "Uma arca? No seco? Velho louco!"
     - "Chuva? Nunca caiu água do céu assim!"
     - "Volte para a sua madeira, carpinteiro."
     - "Se o seu Deus é bom, por que o castigo?"
     - "Ninguém aqui vai ouvir você."
     - "Ele constrói há anos e nada acontece!"
   - Ao vencer cada prova:
     - noe (ficção): "Eu não vim com raiva. Vim avisar. Ainda há tempo de se voltar para Deus."
     - Moradores seguem zombando: ninguém se converte. A vitória é a fidelidade.
   - Banner depois da 1ª: Pv 15:1.
3. **tentacao** — Na volta, junto à torre, Satanás sussurra (prova `tentacao`):
   - Mentiras (ficção):
     - "Desista. Ninguém te ouve."
     - "Fique na cidade. Aproveite como todos."
     - "Deus te esqueceu nesse vale."
     - "Para que tanto trabalho?"
   - Antes da prova: armadura `espada` (A Palavra) e dica "Pressione **Q** — Está escrito".
   - respostas: ['Gn 6:18', 'Gn 6:22'].
   - Ao vencer: memória `pregador`; XP prova; treina domínio e perseverança.
   - Banner: Gl 6:9
   - Se a prova foi vencida na primeira tentativa → flag `a3PrimeiraTentativa` (legado).
4. Próxima: A4.

## A4 — De dois em dois (serviço e exploração)
Tipos: serviço, exploração. Refs: Gn 6:19-21; Gn 7:1-3, 7:9; Pv 12:10.

1. **chamado**
   - Cena no estaleiro ao amanhecer, arca → estágio 5 (porta aberta, rampa).
   - deus: Gn 7:1 «Vem tu e toda a tua casa para dentro da arca; pois a ti eu vi como justo diante de mim nesta geração.»
   - deus: Gn 7:2-3 (pode ser uma linha só com ref "Gn 7:2" e outra "Gn 7:3").
   - deus: Gn 6:21
2. **animais** — "Os animais estão chegando (Gn 6:20). Ajude-os a entrar na arca (0/8 pares)."
   - Os pares aparecem nas bordas do vale e caminham sozinhos até o estaleiro.
   - Alguns chegam **agitados** e param: [acalmar_X] `acalmar` (Sem, tecla Q ou E).
   - Depois de acalmados seguem a rampa e entram (somem com fade dentro).
   - Contador `pares`. Treina compaixão (Sem).
   - Banner: Pv 12:10
3. **mantimento** — Em paralelo com a etapa 2, objetivo duplo. Gn 6:21: "Leve mantimento à arca (0/6)."
   - Sacos de grãos no celeiro: [saco1..4] `carregarPesado` (Cam).
   - Frutas no alto de árvores: [fruta1..2] `escalar`/`pegar` (Jafé: sobe na árvore marcada e pega o cesto).
   - Entregar em [entregaArca] `usar` (na porta da arca).
4. **parPerdido** — "Falta um par: dizem que entrou na gruta a oeste."
   - Exploração: Jafé ou qualquer um entra na [gruta].
   - O par está assustado no fundo. Dica: "Traga Sem para acalmá-los."
   - Após acalmar, os animais seguem o personagem até a arca.
   - XP segredo.
   - Achado opcional na gruta: pedra memorial de Enoque [segredoEnoque] → memória `enoque` (Gn 5:24).
5. **entrar** — "Entre na arca com toda a família." Gn 7:7-9.
   - narrador: Gn 7:9
   - Todos os jogáveis entram (chegar ao ponto `portaArca` dentro).
   - Próxima: A5.

**Segredo extra (qualquer hora antes de A5):** [segredoLameque] perto da casa, uma pedra com o nome de Lameque → memória `lameque` (Gn 5:29).

## A5 — Quarenta dias (masmorra: dentro da arca)
Tipos: masmorra, cooperativo, espiritual. Refs: Gn 7:11-24; Gn 8:1-16; Sl 56:3; 1Pe 3:20.

0. **porta**
   - Cena: a porta se fecha sozinha. narrador: Gn 7:16 «e o Senhor fechou por fora.»
   - Memória `portaFechada`. Aponta para Cristo `arca` (1Pe 3:20-21; Jo 10:9).
   - `vale.definirEstado('diluvio')`, `vale.definirInterior(true)`; a chuva começa.
   - narrador: Gn 7:11, Gn 7:12
1. **fontes** — Convés 1, "As fontes do grande abismo":
   - A água entra por 4 vazamentos (`pontoArca('vazamento1..4')`), um de cada vez, a cada ~20 s.
   - O nível interno sobe e deixa todos mais lentos.
   - [bomba] `segurar` (Cam): posto; enquanto alguém bombeia, a água sobe só 30%.
   - [vazamento1..4] `reparar` (Noé, segurar 3 s).
   - Falha: a água chega ao limite → fade, "A água subiu demais. Tentem de novo, juntos." e a etapa recomeça.
   - Durante a etapa a arca sobe com as águas (arca + água externa sobem; Gn 7:17-18).
   - Ao concluir: XP cooperação. narrador: Gn 7:17
2. **inquietos** — Convés 2:
   - A arca balança (rolagem da câmera e caixas deslizando de um lado a outro).
   - 3 baias com animais agitados: [baia1..3] `acalmar` (Sem).
   - 2 redes de carga para prender no alto: [rede1..2] `amarrar` (Jafé, pela escada/viga).
   - Enquanto as redes estão soltas, caixas bloqueiam o corredor em intervalos (atravessar no ritmo).
   - Ao concluir: abre a rampa para o convés 3.
3. **medo** — Convés 3, área da família, prova `medo` (alvo 25 s firmes):
   - Trovões, escuridão. A família está encolhida.
   - Noé encoraja cada um: interativos [encorajar_<id>] `falar` emitem evento externo de encorajamento.
   - R = orar. Capacete reduz a queda.
   - Antes da prova: armadura `capacete` (dica: "O capacete da salvação: o medo pesa menos").
   - Fala de ficção da família: mulher de Sem: "Nunca ouvi um vento assim…"
   - Ao vencer:
     - narrador: Gn 8:1, memória `deusLembrou`.
     - Banner: Sl 56:3
     - Aponta para Cristo `tempestade` (Mc 4:39-40).
     - narrador: Gn 7:24
     - Fade "Cento e cinquenta dias depois…": a chuva para e a arca é movida para o platô (Gn 8:4), com um tranco na câmera.
4. **janela** — Gn 8:6-12:
   - a) Jafé sobe a escada até a janela: [janela] `amarrar`/`usar` (Jafé abre a cobertura).
   - b) Noé solta o corvo: [soltarCorvo] `usar`. narrador: Gn 8:7
   - c) Noé solta a pomba: [soltarPomba] `usar`. narrador: Gn 8:8
   - Espera ~10 s. A pomba volta e pousa no parapeito.
   - [receberPomba] `usar` (Noé) → anima a mão estendida; narrador: Gn 8:9 «Então, ele estendeu sua mão e a tomou, e a puxou para si para dentro da arca.»
   - Fade "Sete dias depois": solta de novo, ela volta à tarde com a folha; narrador: Gn 8:11; memória `folhaOliveira`.
   - Fade "Mais sete dias": solta; narrador: Gn 8:12
5. **saida**
   - deus: Gn 8:16
   - Armadura já recebida; XP masmorra (100) para todos.
   - Próxima: A6.

## A6 — O sinal da aliança
Tipos: construção, espiritual. Refs: Gn 8:18-22; Gn 9:1, 9:8-17.

1. **sair**
   - `vale.definirEstado('depois')`, `definirInterior(false)`.
   - A arca está no platô e a porta se abre (rampa).
   - narrador: Gn 8:18, 8:19
   - Animais saem em procissão e se espalham.
   - Câmera mostra o vale lavado, lamacento e silencioso. Reverente: sem corpos, sem cidade, só montes de barro.
2. **altar** — "Construa um altar ao Senhor (Gn 8:20)."
   - Noé aprende o verbo `construirAltar`.
   - Junte 6 pedras pelo platô: [pedraAltar1..6] `pegar` (todos).
   - [altarPlato] `construirAltar` (Noé, segurar 4 s).
   - Cena reverente:
     - Fogo no altar e fumaça subindo.
     - Sem, o sacerdote, ajoelha (pose de oração) junto do altar.
     - Os sacrifícios não são mostrados explicitamente; só o fogo e a fumaça.
   - narrador: Gn 8:20
   - deus: Gn 8:21 «Eu não amaldiçoarei novamente a terra por causa do homem;»
   - deus: Gn 8:22
3. **bencao**
   - deus: Gn 9:1 «Sede frutíferos e multiplicai-vos, e enchei a terra.»
   - deus: Gn 9:9, Gn 9:11
   - O céu clareia e o **arco-íris** aparece (`ceu.arco` 0→1).
   - deus: Gn 9:12 «Este é o sinal do pacto…» e Gn 9:13
   - Memória `arcoIris` (força 3) com aviso especial: "Esta memória atravessará as gerações."
   - Banner: Gn 9:16
4. **explorar (opcional)** — "Antes de partir, caminhe pelo vale renovado."
   - Segredo [segredoEstacoes] → memória `estacoes` (Gn 8:22).
   - Diálogos de ficção com a família sobre recomeçar.
   - Para seguir: falar com Sem junto do altar ([falarSem]).
5. **transicao**
   - sem (ficção): "Pai, de nós sairão todas as famílias da terra?"
   - noe (ficção): "Deus prometeu uma Semente. Guardemos a promessa, de geração em geração."
   - Transição de era (TransicaoEra) com zoom em Noé e a genealogia de Gn 11:10-26 flutuando:
     > Sem → Arfaxade → Selá → Éber → Pelegue → Reú → Serugue → Naor → Terá → Abrão
   - Os nomes são do jogo: a fonte digital tem "A/naxade" em Gn 11:10, então não use o texto do versículo para o nome.
   - Ao fim: Aponta para Cristo `linhagem` (Lc 3:34, 3:36).
   - Título: **"Era 2 — Abraão"**, sub: "Gênesis 12–22".
   - Inicia B1.

---

# ERA 2 — ABRAÃO

## B1 — Para a terra que eu te mostrarei
Tipos: tutorial. Refs: Gn 12:1-8; Hb 11:8.

1. **chegada**
   - A caravana chega ao carvalho de Moré.
   - narrador: Gn 12:1-3 (o versículo 1 começa "Ora, o Senhor havia dito…": as palavras de Gn 12:1-3 foram ditas em Harã, antes da partida, então vêm juntas, como narrador, e não depois em Moré)
   - narrador: Gn 12:4, Gn 12:5, Gn 12:6
   - Memória `chamado`. Banner: Hb 11:8.
   - Legado aplicado: aviso "Legado de Noé: +X Fé".
   - Dica: "Novos companheiros: Sarai (hospitaleira), Ló (pastor), Eliézer (guerreiro). Use Tab para trocar."
2. **altarMore**
   - deus: Gn 12:7 «À tua semente eu darei esta terra;»
   - [altarMore] `construirAltar` (Abrão; dica "Aprendido nos dias de Noé").
   - Depois do altar: narrador: Gn 12:7 «e ali ele edificou um altar ao Senhor, que lhe apareceu.»
   - Aponta para Cristo `bencaoNacoes`.
3. **acampar** — "Siga para o monte entre Betel e Ai e arme as tendas."
   - Puzzle simples de dupla: cada tenda precisa de alguém segurando o mastro e outro amarrando.
   - [mastroTenda1..2] `usar` (qualquer jogável, posto; o verbo `segurar` é só do guerreiro).
   - [amarrarTenda1..2] `usar` (outro personagem).
   - Ensina a troca e os postos nesta era.
4. **invocar**
   - [altarBetel] `construirAltar` (Abrão).
   - narrador: Gn 12:8
   - [orarBetel] `orar` (Abrão): memória `altarBetel`; XP disciplina.
   - Próxima: B2.

## B2 — Não haja contenda (puzzle cooperativo + escolha moral)
Tipos: cooperativo, escolha. Refs: Gn 13:1-18; Fp 2:3; Mt 5:9; 2Co 5:7; Sl 133:1.

1. **muitos**
   - narrador: Gn 13:2, Gn 13:5, Gn 13:6
   - No poço, os rebanhos de Abrão (lã clara) e de Ló (lã escura) se misturaram, com 10 de cada.
   - narrador: Gn 13:7
   - Pastores discutem (ficção):
     - pastor de Ló: "Este poço é nosso! Chegamos primeiro!"
     - pastor de Abrão: "Mentira! Nossas ovelhas bebem aqui desde a lua passada!"
2. **separar** — Puzzle cooperativo:
   - O rebanho é um bando (boids) que foge do pastor.
   - Ló (pastor) conduz andando atrás do rebanho e usa Q (assobio) para juntar.
   - Os currais têm porteiras que só ficam abertas com alguém no posto:
     - [porteiraAbrao] `usar` (qualquer jogável, posto).
     - [porteiraLo] `usar` (posto).
   - Ovelhas no curral errado escapam quando a porteira abre. O jogador precisa trocar entre Ló e quem segura a porteira.
   - Objetivo: "Ovelhas de Abrão no curral de Abrão (0/10) e de Ló no de Ló (0/10)."
   - Ao concluir: XP cooperação; treina compaixão e paciência.
3. **pastores** — Escolha moral. Abrão fala com os pastores (escolha):
   - a) "Irmãos não brigam por água. Deixem os rebanhos de Ló beberem primeiro." → humildade +1, Unidade +10, flag `b2Cedeu`.
   - b) "Vamos dividir os dias do poço, com justiça para todos." ✦ requer sabedoria 6 → sabedoria +1, Unidade +6.
   - c) "Basta! O poço é meu, e quem manda aqui sou eu." → Unidade −10; os pastores obedecem calados. Não é proibido: é o caminho do orgulho, sem castigo além da Unidade e da fala. Os versículos seguintes acontecem igual, porque o texto bíblico não muda.
   - Resposta de ficção conforme a escolha.
4. **abraoELo** — Cena junto ao mirante:
   - abraao: Gn 13:8 «Que não haja contenda, eu te suplico, entre mim e ti, e entre meus pastores e teus pastores, pois somos irmãos.»
   - abraao: Gn 13:9
   - **A câmera mostra o que Ló vê:** a planície do Jordão, verde e regada.
   - narrador: Gn 13:10, Gn 13:11, Gn 13:12, Gn 13:13
   - Ló parte com seus rebanhos e pastores e fica indisponível (`c.disponivel('lo', false)`).
   - Memória `naoHajaContenda`. Armadura `calcado` (Ef 6:15).
   - Banners: Mt 5:9, 2Co 5:7
5. **percorrer**
   - deus: Gn 13:14 «Eleva agora os teus olhos, e olha do lugar em que estás para o norte, e para o sul, e para o leste, e para o oeste.»
   - deus: Gn 13:15, Gn 13:16, Gn 13:17
   - "Caminhe pela terra (0/4 mirantes)": [miranteNorte], [miranteSul], [miranteLeste], [miranteOeste], todos `olhar`.
   - Cada mirante: XP exploração e uma vista com câmera.
   - Ao concluir: memória `percorreATerra`.
   - Segredo [segredoPo] → memória `poDaTerra` (Gn 13:16).
6. **manre** — "Mude a tenda para os carvalhais de Manre."
   - `canaa.definirAcampamento('manre')` (fade curto).
   - [altarManre] `construirAltar` (Abrão). narrador: Gn 13:18
   - Próxima: B3.

## B3 — Trezentos e dezoito (desafio físico / batalha narrativa)
Tipos: físico, batalha, cooperativo. Refs: Gn 14:12-24; Hb 7:1-3; Mt 6:21.

1. **noticia**
   - Em Manre, um homem chega correndo: narrador: Gn 14:12, Gn 14:13
   - fugitivo (ficção): "Ló foi levado! Os reis do oriente levaram tudo de Sodoma!"
   - narrador: Gn 14:14
   - Os servos treinados se reúnem. Aner, Escol e Manre vêm com os seus.
   - Fade "Até Dã, à noite": hora 22, mudança para a passagem do norte.
2. **dividir** — narrador: Gn 14:15 «E ele se dividiu contra eles, ele e seus servos, à noite,». Puzzle de furtividade cooperativo:
   - Abrão e Eliézer, cada um com um grupo de servos que o segue, precisam chegar aos pontos de flanco ('flancoOeste' e 'flancoLeste') sem entrar nos cones de luz das sentinelas.
   - A tocha de cada sentinela é um cone que gira. Ser visto → "Fomos vistos! Recuem." e o grupo volta ao último ponto seguro.
   - Agachar (Ctrl) reduz a chance de ser visto.
   - Troca entre Abrão e Eliézer para mover cada grupo. O grupo de Aner, Escol e Manre vai sozinho para 'flancoSul'.
   - Quando os dois estiverem nos flancos: [sinal] `usar` (Abrão).
3. **ataque** — Batalha narrativa curta:
   - Os inimigos acordam confusos; 6–8 guerreiros enfrentam o jogador.
   - Combate de **aparar e desarmar**: botão direito apara; clique esquerdo golpeia com o cajado; um inimigo desarmado foge.
   - Sem sangue, sem mortes mostradas: derrubados se levantam e fogem para o norte (Gn 14:15 "os perseguiu").
   - Eliézer (guerreiro) é o mais forte no combate. Abrão profeta pode usar Q (discernir) para ver de onde vem o próximo golpe.
   - XP batalha (fixo, uma vez).
4. **libertar**
   - [cativo1..5] `usar` (soltar as cordas). Ló é o último.
   - lo (ficção): "Tio… depois de tudo, você veio por mim?"
   - abraao (ficção): "Somos irmãos, Ló. Sempre fomos."
   - narrador: Gn 14:16. Memória `resgate`; Unidade +15.
5. **melquisedeque** — No vale de Savé:
   - narrador: Gn 14:17, Gn 14:18
   - Melquisedeque traz pão e vinho.
   - melquisedeque: Gn 14:19 «Bendito seja Abrão do Deus Altíssimo, criador do céu e da terra.»
   - melquisedeque: Gn 14:20 «E bendito seja o Deus Altíssimo, que entregou teus inimigos em tuas mãos.»
   - [dizimo] `usar` (Abrão): entrega a décima parte dos despojos. narrador: Gn 14:20 «E lhe deu dízimos de tudo.»
   - Memória `melquisedeque`. Aponta para Cristo `melquisedeque` (Hb 7:1-3).
6. **nemUmFio**
   - rei de Sodoma: Gn 14:21 «Dá-me as pessoas, e toma os bens para ti.»
   - Prova `tentacao`. Os despojos brilham e o sussurro insiste (ficção):
     - "Isso é seu. Não divida com ninguém."
     - "Pegue tudo antes que outro pegue."
     - "Com isso você nunca mais precisará de ninguém."
     - "Ló escolheu a melhor terra. Pegue a sua parte."
   - respostas: ['Gn 14:22-23', 'Gn 13:8', 'Gn 12:2'] (Gn 14:22 sozinho termina em vírgula). As respostas se alternam entre as mentiras, então cada uma responde a todas.
   - Ao vencer:
     - abraao: Gn 14:22 «Eu levanto a minha mão ao Senhor, o Deus Altíssimo, o possuidor do céu e da terra,»
     - abraao: Gn 14:23, Gn 14:24
     - Memória `nemUmFio`. Banner: Mt 6:21
   - Ló volta a Sodoma (NPC sai de cena; Gn 14:12 conta que ele habitava lá).
   - Próxima: B4.

## B4 — Conta as estrelas (desafio espiritual)
Tipos: espiritual. Refs: Gn 15:1-6; Rm 4:3; Hb 11:1.

1. **visao**
   - Noite, junto da tenda em Manre.
   - deus: Gn 15:1 «Não temas, Abrão; eu sou o teu escudo, e a tua recompensa será infinitamente grande.»
   - Armadura `escudo` (aviso: "Escudo da fé: segure o botão direito para apagar os dardos").
   - abraao: Gn 15:2 «Senhor Deus, o que me darás, visto que ando sem filhos, e o mordomo da minha casa é Eliézer de Damasco?»
   - abraao: Gn 15:3 «Eis que não me deste semente, e eis que um nascido na minha casa é meu herdeiro.»
   - deus: Gn 15:4 «Este não será teu herdeiro, mas o que sairá de tuas próprias entranhas será teu herdeiro.»
2. **fora** — "Saia da tenda (Gn 15:5)." Chegar a 'ceuEstrelas'.
3. **duvida** — Prova `duvida` (alvo 12):
   - Câmera inclinada para o céu, com névoa escura.
   - Mentiras (ficção):
     - "Você é velho demais."
     - "Sarai é estéril. Promessas são só palavras."
     - "Ele te esqueceu, como esqueceu Noé."
     - "Eliézer será o herdeiro. Aceite."
   - O escudo apaga os dardos.
   - Memórias disponíveis: **todas as memórias guardadas** (era 1 e era 2). Cada uma acende estrelas pela sua força. `arcoIris` tem força 3 e uma frase especial do jogo: "Deus cumpriu a aliança com Noé. Ele cumprirá com você."
   - deus: Gn 15:5 «Olha agora para o céu, e conta as estrelas, se tu fores capaz de contá-las;» → o céu se enche. deus: Gn 15:5 «Assim será a tua semente.»
4. **creu**
   - narrador: Gn 15:6
   - Armadura `couraca`. Memória `estrelas`. Aponta para Cristo `justica`. Banners: Rm 4:3, Hb 11:1.
   - Próxima: B5.

## B5 — O Senhor proverá (masmorra: monte Moriá)
Tipos: masmorra, cooperativo, espiritual. Refs: Gn 17:5, 17:15; Gn 21:1-6; Gn 22:1-19; Hb 11:17-19.

1. **nomes** — Cena curta, anos depois:
   - deus: Gn 17:5 «O teu nome não se chamará mais Abrão, mas teu nome será Abraão, pois pai de muitas nações eu te fiz.» → flag `nomeAbraao`.
   - deus: Gn 17:15 «Quanto a Sarai, tua mulher, não chamarás seu nome Sarai, mas Sara será seu nome.» → flag `nomeSara`.
   - narrador: Gn 21:1, Gn 21:2, Gn 21:3
   - Isaque fica disponível; Eliézer e Sara indisponíveis neste capítulo.
   - sara: Gn 21:6 «Deus me fez rir, de modo que todos os que ouvirem rirão comigo.»
   - Título: "Anos depois…".
2. **prova**
   - narrador: Gn 22:1 (ou: deus: Gn 22:1 «Abraão;» e abraao: Gn 22:1 «Eis-me aqui.»)
   - deus: Gn 22:2 «Toma agora o teu filho, teu único filho Isaque, a quem tu amas, e vai para a terra de Moriá, e oferece-o ali como oferta queimada sobre um dos montes que eu te direi.»
   - narrador: Gn 22:3
   - Fade "No terceiro dia". narrador: Gn 22:4
3. **pe** — No pé do Moriá:
   - abraao: Gn 22:5 «Ficai aqui com o jumento, e eu e o menino vamos adiante para adorar, e voltaremos a vós.»
   - narrador: Gn 22:6
   - Isaque leva o `feixe` de lenha nas costas; Abraão leva o `fogo`.
   - Banner: Jo 19:17 (Aponta para Cristo: "carregando ele a sua cruz").
4. **subida** — Masmorra em 3–4 trechos. Regra **"foram os dois juntos"**: se se afastarem mais de 12 m, o que está à frente espera e a dica lembra.
   - Trecho 1, degraus de rocha: Isaque (batedor) escala a parede baixa (`mundo.escaladas`) e desce uma corda: [amarrarCorda] `amarrar` (Isaque), no ponto 'cordaMoria' (o id `cordaMoria` é a escalada do mundo). Ela vira uma escalada para Abraão (escalada liberada para todos depois de amarrada).
   - Trecho 2, passagem estreita com pedras soltas: Abraão (profeta) usa Q (discernir) para revelar o caminho firme. Pedras falsas brilham em vermelho; o caminho certo, em dourado. Engano revelado.
   - Trecho 3, a pergunta, num patamar:
     - isaque: Gn 22:7 «Meu pai,»
     - abraao: Gn 22:7 «Aqui estou, meu filho.»
     - isaque: Gn 22:7 «Eis o fogo e a lenha, mas onde está o cordeiro para a oferta queimada?»
     - abraao: Gn 22:8 «Meu filho, Deus proverá para si um cordeiro para a oferta queimada;»
     - narrador: Gn 22:8 «então foram os dois juntos.»
   - Trecho 4, subida final: prova curta de `medo` (vento, altura), em que os dois se ajudam; ao lado de Isaque, a calma cai mais devagar.
5. **altar** — No topo:
   - [altarMoria] `construirAltar` (Abraão).
   - Cinemática reverente, plano aberto, sem close no amarrar:
     - narrador: Gn 22:9
     - Câmera no rosto de Abraão, olhos fechados; a mão se ergue (apenas a silhueta contra o céu).
     - narrador: Gn 22:10
     - Corte para luz.
   - anjo: Gn 22:11 «Abraão, Abraão;» e abraao: Gn 22:11 «Aqui estou.»
   - anjo: Gn 22:12 (trecho já conferido)
6. **carneiro**
   - narrador: Gn 22:13 «E Abraão levantou seus olhos, e olhou, e eis detrás dele um carneiro, preso pelos chifres em um arbusto;»
   - "Olhe ao redor." [carneiro] `usar` (Abraão) no 'arbustoCarneiro': o carneiro preso pelos chifres (Animal 'carneiro' com chifres curvos).
   - A oferta é mostrada como fogo no altar, sem violência. narrador: Gn 22:13 «e Abraão foi e tomou o carneiro, e o ofereceu como oferta queimada no lugar de seu filho.»
   - Isaque abraça o pai (animação `sim`/abraço).
   - narrador: Gn 22:14 → memória `jeovaJire`; Aponta para Cristo `cordeiro`.
7. **promessa**
   - anjo: Gn 22:16 (trecho), Gn 22:17, Gn 22:18
   - Aponta para Cristo `semente` completo (Gl 3:16).
   - Banner: Hb 11:17
   - narrador: Gn 22:19
   - Créditos do MVP:
     - Título "Continua…" e uma prévia: "Era 3 — José".
     - Estatísticas: memórias, segredos, tempo.
     - Volta ao menu.

---

## Notas de implementação

- Cada etapa precisa ser **idempotente**. Ao carregar um save, o mundo é reconstruído pelas flags (estágio da arca, estado do vale, acampamento, disponibilidade dos personagens) e a etapa atual roda de novo do início.
- Todas as cinemáticas podem ser puladas segurando Esc (pular diálogo a diálogo).
- Ao terminar cada missão: autosave, aviso "Missão concluída", XP.
- **Teste automático:** cada era expõe `atalhos` (debug) que resolvem cada etapa pelas mesmas APIs do jogo: teleporta, dispara interações, resolve provas com `resolverAutomaticamente()`. Isso permite que `e2e/jogar-mvp.mjs` jogue do início da era 1 ao fim da era 2.
