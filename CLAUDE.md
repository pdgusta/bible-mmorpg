# A Semente — guia para sessões do Claude Code

RPG 3D singleplayer de navegador que percorre a narrativa bíblica (Gênesis → Apocalipse) apontando para Jesus. MVP: **era 1 Noé (Gn 6–9) → era 2 Abraão (Gn 12–22)**. Tudo em **português do Brasil**: textos, identificadores, comentários e commits.

**Antes de qualquer trabalho, leia nesta ordem:**
1. `docs/ESTADO.md`: o que está pronto, o que está em andamento, problemas conhecidos e próximos passos.
2. `docs/TECNICO.md`: arquitetura, convenções, pipelines e o índice de `docs/tecnico/*.md` (um documento por módulo).
3. Para o conteúdo: `docs/DESIGN.md` (visão e regras), `docs/ROTEIRO.md` (missões, falas e ids) e `docs/ENSINAMENTOS.md`.

## Regras inegociáveis (do dono do projeto)

- **Bíblia:** o texto base é a BKJ Fiel 1611; a NVT é só apoio ("Entender melhor"); o original em inglês é a KJV. Nunca invente versículos.
  - Nunca digite texto bíblico no código: use só `ref` e, se preciso, `trecho`, que tem de ser substring **exata** da BKJ.
  - O texto vem de `src/data/biblia/versiculos.json` (gerado).
- **Ficção:** falas que a Bíblia não registra são `{quem, texto}` e recebem o selo "fala do jogo". Elas nunca contradizem o texto.
- **Personagens divinos e Satanás:**
  - Deus nunca aparece como figura humana: só voz, luz e nuvem, e só fala com versículos.
  - O Anjo do Senhor e os visitantes de Gn 18 têm o rosto não mostrado.
  - Jesus é representado com reverência (camada mista, ver DESIGN §2).
  - Satanás age por tentação, engano, divisão e opressão, em sussurros de ficção que são claramente mentiras.
- **Tom e arte:** caloroso, belo e reverente. A arte é inspirada em *Palia*.
- **XP nunca vem de matar.** Os atributos não têm magia.
- **Fontes:** `fontes/` (Bíblias completas e pacotes de assets brutos) fica **fora do git**, porque o repositório é público. Nunca copie dali para `src/`.
- **Desempenho:** 60 fps em vídeo integrado, com no máximo cerca de 150 draw calls e 600 mil triângulos no preset médio.

## Comandos

```bash
npm ci                 # dependências
npm run dev            # http://localhost:5173
npx tsc --noEmit       # tipos (tem de dar 0 erros)
npx vitest run         # testes unitários
npm run validar        # refs e trechos bíblicos usados no código existem e batem com a BKJ
npm run versiculos     # regenera versiculos.json (precisa de fontes/KJF.json, fontes/NVT.json, fontes/kjv-markdown/)
node e2e/foto.mjs "/?<query>" saida.png 960 540   # foto headless (espera window.pronto)
node e2e/teste-troca.mjs                           # e2e da troca de personagem (--era: transição)
npm run e2e            # joga o MVP inteiro pelos atalhos (e2e/jogar-mvp.mjs)
```

Laboratórios: `?lab=personagens`, `?lab=ui&tela=...`, `?lab=animais` e `?lab=canaa&pos=x,z&hora=..`. Os parâmetros de depuração do jogo ficam sob `?dev` (ver `docs/tecnico/integracao.md`).

## Como trabalhar

- **Antes de commitar:**
  - Rode `npx tsc --noEmit`, `npx vitest run` e `npm run validar`.
  - Se mexeu em visual, tire uma foto com `e2e/foto.mjs`. O Chromium headless usa SwiftShader, que é lento, então use fotos pequenas e meça com `jogo.render.gl.info.render`.
- **Conteúdo novo de era:**
  - Siga o padrão de `src/eras/noe/*` (`index`, `personagens`, `memorias`, `cristo`, `interativos`, `missoes`, `servicos`, `atalhos`).
  - Antes de commitar, aplique o checklist de `docs/tecnico/revisao.md`.
- **Mudança de API pública:** atualize o `docs/tecnico/<modulo>.md` correspondente. Ao terminar uma etapa, atualize `docs/ESTADO.md`.
- **Subagentes em paralelo:**
  - No máximo 7 simultâneos, cada um com posse exclusiva de arquivos.
  - Só o orquestrador faz commit.
  - Os briefings devem apontar para os docs deste repositório.
  - Testes e2e longos devem simular o websocket do Vite (ver `e2e/teste-troca.mjs`), senão o HMR recarrega a página quando outro agente salva um arquivo.
