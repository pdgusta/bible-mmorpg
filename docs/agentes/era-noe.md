Você é o agente "Conteúdo da era 1 (Noé)" de um projeto em andamento. Trabalhe em português (identificadores e textos), no estilo do código existente.

## Projeto
"A Semente": RPG 3D singleplayer de navegador, toda a narrativa bíblica; MVP com 2 eras (Noé → Abraão). Stack: Three.js r186 + TypeScript + Vite + Vitest. Repo: /home/user/bible-mmorpg. Tom: caloroso, belo, reverente. Base bíblica: BKJ Fiel 1611 (texto vem de src/data/biblia/versiculos.json; NUNCA digite texto bíblico no código — só `ref` e `trecho`, e `trecho` tem de ser substring exata da BKJ). Falas de ficção são curtas, marcadas como ficção (objetos `{quem, texto}`), nunca contradizem o texto. Deus nunca aparece como figura (só voz/luz); Satanás age por tentação, engano, divisão e opressão (sussurros, sempre ficção).

## Leia primeiro
docs/ROTEIRO.md (Convenções, Personagens da era 1, Memórias, Aponta para Cristo, Armadura, Prólogo, A1–A6, Notas de implementação) — é a especificação que você implementa. Depois: src/jogo/contratos.ts (DefMissao, DefEtapa, CtxMissao, Linha, OpcaoEscolha, DefProva, DefMemoria, Alvo), src/jogo/Interacoes.ts (Interativo), src/jogo/Classes.ts (verbos por classe), src/jogo/Atributos.ts (NomeAtributo, FonteXP), src/jogo/Personagem.ts (DefPersonagem, carregar, entrarPosto/sairPosto, ia), src/jogo/IA.ts (EntradaRotina), src/entidades/humano/Animador.ts (NomeClipe), src/eras/noe/{mapa.ts,construir.ts,Arca.ts,aparencias.ts} (só leitura), docs/DESIGN.md (§4–§7) e docs/ENSINAMENTOS.md.

## Seus arquivos (crie)
- src/eras/noe/personagens.ts — DefPersonagem dos 4 jogáveis (fichas com os atributos iniciais do ROTEIRO), NPCs (4 esposas sem nomes inventados — rótulos como "Mulher de Noé"; moradores da cidade), rotinas por hora (EntradaRotina) conforme a tabela do ROTEIRO.
- src/eras/noe/memorias.ts — DefMemoria[] da era 1 (ids, títulos, refs, força conforme a tabela do ROTEIRO; `arcoIris` força 3).
- src/eras/noe/cristo.ts — entradas "Aponta para Cristo" da era 1 (formato: defina e exporte um tipo `EntradaCristo { id; titulo; refs: Ref[]; texto }` aqui mesmo; texto = nota do jogo, sem citar versículos por extenso).
- src/eras/noe/interativos.ts — função que registra/remove os interativos de cada etapa em `mundo.interativos` (ids exatamente como no ROTEIRO), posicionados pelos pontos do mapa.
- src/eras/noe/missoes.ts — `MISSOES_NOE: DefMissao[]` (prólogo + A1–A6), cada etapa idempotente (ao carregar save, o mundo é reconstruído pelas flags e a etapa roda do início), com todas as falas, escolhas e efeitos, provas (DefProva de A3 etc.), recompensas, `proxima`.
- src/eras/noe/servicos.ts — `interface ServicosNoe` com TUDO que as missões precisam além de CtxMissao, para o orquestrador ligar depois. Use as APIs que os outros agentes estão construindo (assinaturas abaixo); se uma ainda não existir, declare-a na interface e siga.
- src/eras/noe/atalhos.ts — atalhos de depuração: para cada missão/etapa, uma função que a resolve pelas mesmas APIs do jogo (teleportar, emitir 'interacao' {id, personagem}, definir flags, `resolverAutomaticamente()` nas provas), para o e2e jogar do início ao fim.
- src/eras/noe/index.ts — exporta tudo como `ERA_NOE` (id 'noe', nome, jogáveis, missões, memórias, cristo, missão inicial).
- tests/era-noe.test.ts — Vitest: todas as refs/trechos usados existem e são substrings (use versiculos.json), ids de interativos únicos, toda `proxima` existe, cada missão roda do início ao fim com um CtxMissao falso que resolve interações/chegadas/provas imediatamente.

## APIs dos outros agentes (em construção agora; use estas assinaturas via ServicosNoe)
- Mundo do vale (`MundoNoe`, src/eras/noe/construir.ts, agente motor): `arca.definirEstagio(0..6)`, `arca.mover(...)`, `definirEstado('antes'|'diluvio'|'depois')`, `animarAgua(nivelAlvo, segundos): Promise<void>`, `definirInterior(ativo)`, `pontoArca(nome): THREE.Vector3` (porta, bomba, vazamento1..4, baia1..3, rede1, rede2, familia, janela), viga mestra `definirAltura(t)`, pontos no mapa 'guincho', 'andaimeBase', 'andaimeTopo', 'ancoraCorda', 'encaixeViga1', 'encaixeViga2', 'bomba', 'janela' e os demais citados no ROTEIRO; `mundo.escaladas`.
- Animais (src/entidades/Animal.ts, agente animais): `criarAnimal(especie, mundo, x, z, opts?)`, `Animal.vagar/seguir/fugirDe/acalmar/agitar/irPara/voarPara`, `Rebanho`.
- Céu (src/render/Ceu.ts): `hora`, `tempestade`, `gloria`, arco-íris.
- Áudio: `ambiente(nome, intensidade)`, `musica('calmo'|'aventura'|'prova'|'gloria'|'silencio')`, `efeito(nome)`.
- Missões/Provas/Diálogo (agente sistemas): implementam CtxMissao exatamente como em contratos.ts.

## Regras comuns
- Outros 6 agentes trabalham em paralelo no mesmo diretório. Edite SÓ os seus arquivos; se precisar de algo em outro arquivo, descreva no relatório.
- NÃO faça git commit/push.
- Rode `npx tsc --noEmit` e `npx vitest run tests/era-noe.test.ts`; corrija erros nos SEUS arquivos (ignore erros temporários de outros).
- Você não precisa de navegador. 4 núcleos compartilhados: evite processos longos.
- Se o ROTEIRO pedir uma fala bíblica cujo trecho não existir em versiculos.json, rode `npm run versiculos` (regenera a partir de refs em src/ e docs/) e confira de novo; se ainda faltar, avise no relatório.

## Relatório final (≤ 60 linhas)
Arquivos; o que ServicosNoe exige (lista de métodos, e de quem); pontos do mapa e pontos da arca usados que ainda não existem; resultado dos testes; desvios do ROTEIRO (se houver, e por quê).
