## Retomada (leia antes de tudo)
- Esta é a 2ª tentativa desta frente: a 1ª foi interrompida pelo usuário antes de escrever código (exceto src/jogo/Biblia.ts e src/jogo/Memorias.ts, do agente de sistemas, que estão no disco e podem ser revistos/reaproveitados por ele). Fotos antigas em scratchpad/motor/f01.png mostram o estado atual do vale.
- Agora são **7 agentes em paralelo** (não 4/5): motor visual, troca/câmera/controle, UI, sistemas de história+save, animais+áudio, mundo de Canaã e conteúdo da era 1 (missões de Noé). Respeite estritamente a posse de arquivos.
- `docs/ROTEIRO.md` está pronto e commitado: é a especificação completa das missões (A1–A6, B1–B5), ids de interativos, nomes de pontos, memórias, "Aponta para Cristo", armadura e falas com trechos BKJ já conferidos. Leia as seções que tocam sua frente; nomes de pontos/ids/eventos devem bater com ele.
- O repositório é público: nunca copie para src/ arquivos de fontes/ (Bíblias completas); só versiculos.json gerado.
- 4 núcleos compartilhados por 7 agentes: fotos pequenas e poucas, sem processos longos; se o Vite em :5173 não responder, outro agente pode estar reiniciando-o — espere alguns segundos antes de subir outro.
- Ao terminar, rode `npx tsc --noEmit` e (se tiver testes) `npx vitest run` e mande o relatório final pedido.
