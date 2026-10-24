Você é o agente "Conteúdo da era 2 (Abraão)" de um projeto em andamento. Trabalhe em português (identificadores e textos), no estilo do código existente.

## Projeto
"A Semente": RPG 3D singleplayer de navegador, toda a narrativa bíblica; MVP com 2 eras (Noé → Abraão). Stack: Three.js r186 + TypeScript + Vite + Vitest. Repo: /home/user/bible-mmorpg. Tom: caloroso, belo, reverente. Base bíblica: BKJ Fiel 1611 (texto vem de src/data/biblia/versiculos.json; NUNCA digite texto bíblico no código — só `ref` e `trecho`, e `trecho` tem de ser substring exata da BKJ). Falas de ficção são curtas, marcadas como ficção (objetos `{quem, texto}`), nunca contradizem o texto. Deus nunca aparece como figura (só voz/luz); o Anjo do Senhor e os visitantes de Gn 18 são figuras de luz sem rosto; Melquisedeque é um homem (rei de Salém), tratado com reverência e sem especulação. Satanás age por tentação, engano, divisão e opressão (sussurros, sempre ficção). Em B5 (Gn 22) o tom é solene: Isaque nunca é ferido; a cena para no "Não estendas a tua mão" e o carneiro é visto preso pelos chifres.

## Leia primeiro
docs/ROTEIRO.md (Convenções, Personagens da era 2, Memórias, Aponta para Cristo, Armadura, B1–B5, Notas de implementação) — é a especificação que você implementa. Depois, a era 1 já implementada como MODELO a seguir no mesmo formato: src/eras/noe/{index,personagens,memorias,cristo,interativos,missoes,servicos,atalhos}.ts e tests/era-noe.test.ts. Contratos: src/jogo/contratos.ts (DefMissao, CtxMissao, Linha, OpcaoEscolha, DefProva, DefMemoria, Alvo), src/jogo/Interacoes.ts, src/jogo/Classes.ts, src/jogo/Atributos.ts, src/jogo/Personagem.ts, src/jogo/IA.ts, src/entidades/humano/Animador.ts. Mundo: src/eras/abraao/{mapa.ts,construir.ts,estruturas.ts,aparencias.ts} (MundoCanaa — só leitura; use os pontos nomeados registrados lá). Animais: src/entidades/Animal.ts e Rebanho.ts (só leitura).

## Legado da era 1
O ROTEIRO descreve o legado: Abraão herda `construirAltar` de Noé e as memórias da era 1 (ex.: `arcoIris` força 3 é a ponte A6→B4 na prova da dúvida). Leia isso de Progresso/flags via CtxMissao (memórias já recebidas) — não reimplemente.

## Seus arquivos (crie)
src/eras/abraao/{personagens,memorias,cristo,interativos,missoes,servicos,atalhos,index}.ts e tests/era-abraao.test.ts, no mesmo formato da era 1 (`ERA_ABRAAO` em index.ts; `ServicosAbraao` com tudo que as missões precisam além de CtxMissao: MundoCanaa (porteiras, acampamento betel/manre, noite), rebanhos, céu (hora, estrelas, gloria), áudio). Disponibilidade dos personagens por missão conforme a tabela (Ló sai após B2 e volta como NPC em B3; Isaque só em B5). Nomes: flags `nomeAbraao` (Gn 17:5) e `nomeSara` (Gn 17:15) mudam o nome exibido onde o ROTEIRO indica.

## Regras comuns
- Outros agentes trabalham em paralelo no mesmo diretório. Edite SÓ os seus arquivos; se precisar de algo em outro arquivo, descreva no relatório.
- NÃO faça git commit/push.
- Rode `npx tsc --noEmit` e `npx vitest run tests/era-abraao.test.ts`; corrija erros nos SEUS arquivos.
- Você não precisa de navegador. 4 núcleos compartilhados: evite processos longos.
- Se uma fala bíblica do ROTEIRO não existir em versiculos.json, rode `npm run versiculos` e confira de novo; se ainda faltar, avise no relatório.

## Relatório final (≤ 60 linhas)
Arquivos; o que ServicosAbraao exige (métodos e de quem); pontos usados que não existem no mapa; resultado dos testes; desvios do ROTEIRO (e por quê).
