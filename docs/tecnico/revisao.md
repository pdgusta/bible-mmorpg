# Revisão de fidelidade bíblica e de texto

Checklist para aplicar a **todo conteúdo novo de era** (`src/eras/<era>/{missoes,personagens,memorias,cristo,interativos,mecanicas,atalhos}.ts`) antes do commit. As regras de fundo estão em `CLAUDE.md`, `docs/DESIGN.md` §2, `docs/ROTEIRO.md` (Convenções) e `docs/ENSINAMENTOS.md`.

## 1. Gerar a planilha e rodar as conferências

```bash
node scripts/planilha-falas.mjs <era> /caminho/planilha-<era>   # grava .tsv (abre em planilha) e .txt
node scripts/planilha-falas.mjs <era> | less                     # ou só a vista em texto
npm run validar          # toda ref existe no JSON; todo trecho é substring exata da BKJ
npx vitest run tests/era-<era>.test.ts && npx tsc --noEmit
```

- A planilha segue a ordem do código: em `missoes.ts`, é a ordem de jogo.
- Cada fala bíblica aparece com o texto BKJ resolvido. Para um `trecho`, mostra também o versículo inteiro.
- Também lista mentiras, zombarias, objetivos, dicas, avisos, títulos, rótulos, memórias e notas "Aponta para Cristo".
- O script sai com código 1 em ERRO automático: ref ausente, trecho divergente, ou ficção com `quem` igual a Deus ou Jesus.
- O resto é revisão humana: leia a planilha inteira, linha a linha, com a Bíblia (BKJ) aberta nos capítulos da era.
- Ref nova que não está em `versiculos.json`: escreva-a no código e rode `npm run versiculos` (precisa de `fontes/`). Confira que entrou com `npm run validar`.

## 2. Falas bíblicas (`{ quem, ref, trecho? }`)

- [ ] **Falante certo.**
  - Quem diz aquelas palavras no texto: `deus`, `anjo`, um personagem, ou `narrador` quando é narração.
  - Atenção a "disse em seu coração" (ex.: Gn 8:21): é Deus falando consigo, não com o personagem. Use o narrador com o versículo inteiro.
  - A continuação pode ficar na voz de Deus.
- [ ] **Ref certa**, e o versículo diz o que a cena mostra.
- [ ] **Trecho:**
  - tem de ser substring exata;
  - não pode cortar o sentido de modo enganoso;
  - não pode omitir o motivo que explica a cena (ex.: Gn 8:9, a pomba não achou descanso).
  - Na dúvida, prefira o versículo inteiro.
- [ ] **Versículo que termina no meio da frase** (vírgula, ponto e vírgula): use um intervalo (`'Gn 9:9-10'`). O motor junta os versos.
- [ ] **Ordem do texto:** não inverta a cronologia. Exemplo: não mostrar "as águas prevaleceram 150 dias" depois de "Deus lembrou… as águas diminuíram". Use a sequência do capítulo (ex.: Gn 8:1, depois Gn 8:3-4).
- [ ] `refs` de missões, memórias e Cristo existem e sustentam o que o texto do jogo afirma.

## 3. Ficção (`{ quem, texto }`, selo "fala do jogo")

- [ ] **Nunca contradiz** o texto nem o NT da passagem. Confira números, durações, datas e quem fez o quê. Exemplos da era 1:
  - 8 pessoas na arca;
  - o Senhor fechou a porta (Gn 7:16);
  - 7 dias, 40 dias, 150 dias;
  - o corvo antes da pomba, e a pomba 3 vezes;
  - altar com animais limpos;
  - o arco como sinal.
- [ ] **Sem fatos inventados** que pareçam bíblicos: nomes que a Bíblia não dá (as esposas), idades, milagres, falas atribuídas a profetas.
- [ ] **Curta:** 1 ou 2 frases, até ~140 caracteres. O tom é caloroso, reverente e sem gírias.
- [ ] **Sem anacronismos:** objetos, ofícios e expressões modernas.
- [ ] **Coerente com o que a mecânica mostra.** Se a fala diz "Noé abriu", a interação é de Noé.

## 4. Deus, Jesus, Anjo e Satanás

- [ ] **Deus** só fala com versículo e nunca aparece como figura humana: só voz, luz e nuvem. Nenhuma ficção com `quem: 'deus'`.
- [ ] **Jesus** só fala o que os Evangelhos registram.
- [ ] **O Anjo do Senhor e os visitantes de Gn 18** têm o rosto não mostrado.
- [ ] **Satanás** age por sussurros curtos que são claramente mentiras.
  - Cada mentira tem de ser desmentida por um versículo da cena ou das `respostas`.
  - As respostas de "Está escrito" se alternam entre as mentiras, sem par fixo. Então **cada** versículo de `respostas` tem de responder a **todas** as mentiras da prova, e precisa ter sido recebido antes.
- [ ] **"Aponta para Cristo":**
  - cada frase é sustentada pelas `refs` da entrada (não afirme o que está só num versículo fora da lista);
  - os tempos verbais são coerentes;
  - Cristo **é** a Semente (Gl 3:16), e não "a Semente chegou em Cristo";
  - quem salva e guarda é Deus, não a fé ou a arca.

## 5. Texto em PT-BR

- [ ] Acentos, crase, concordância (ex.: "o par… acalmá-lo", e não "acalmá-los") e pontuação.
- [ ] Reticências com "…". Títulos de passagem de tempo terminam com "…".
- [ ] **Ambiguidades com nomes:**
  - "Sem fôlego…" no começo da frase lê-se como o personagem Sem;
  - termos técnicos obscuros ("cavernas" do casco) confundem.
- [ ] **Objetivos:** imperativo + contagem no fim, "Leve 4 troncos ao estaleiro (0/4)". Se houver ref, ela vem antes: "Construa um altar ao Senhor (Gn 8:20). Junte pedras (0/6)." Nada de objetivos que são só um substantivo ("A janela").
- [ ] **Rótulos de interativo:** infinitivo + objeto ("Tapar o vazamento", "Fixar a ponta da viga").
- [ ] **Dica para quem não pode usar:** "<Quem> pode <verbo>." ("Noé pode construir o altar.").
- [ ] Teclas citadas iguais às do jogo (E, Q, R, Tab, 1–4), no formato "Pressione Q: "Está escrito"."

## 6. Ensinamentos

- [ ] Cada linha de `docs/ENSINAMENTOS.md` desta era tem uma **mecânica que acontece** e um texto que a nomeia (banner, dica ou memória).
- [ ] Liste as lacunas, por exemplo um ensinamento prometido que a mecânica não faz.

## 7. Como corrigir

- Faça edições mínimas e só em textos: strings, refs, trechos e falante.
- Não mude ids, flags, lógica nem estrutura. O que exigir lógica vai para o relatório, com uma recomendação.
- Depois de corrigir, rode de novo a planilha e as conferências da seção 1.

## 8. Era 1 (Noé): resultado da revisão

**Corrigido:**
- Gn 8:21 passou para o narrador ("disse em seu coração").
- Gn 7:24, que vinha depois de Gn 8:1, virou Gn 8:3-4: ordem certa, os 150 dias e Ararate. O título passou a "Ao fim dos cento e cinquenta dias…".
- Gn 8:9 agora aparece inteiro.
- Gn 9:9 virou Gn 9:9-10, porque terminava em vírgula.
- Notas de Cristo:
  - "vigilância" não está em Mt 24:37-39;
  - "a confiança que sustentou a arca";
  - "a Semente chegou em Cristo".
- Memórias: a folha de oliveira (o texto diz "arrancada", não "verde"); a frase do arco-íris.
- Clareza:
  - "Sem fôlego";
  - "cavernas";
  - o objetivo do betume e o "A janela";
  - "acalme as baias";
  - "o par… acalmá-los";
  - "Como Noé, assente…";
  - rótulos e dicas.
- Noé responde "Sim, filho" a Sem.
- A dica de A5 liga a viga mestra ao casco (Ensinamento 1).

**Pendências que exigem lógica ou decisão:**
1. Gn 7:2 manda levar os animais limpos de sete em sete, mas A4 mostra um só par de ovelha, cabra e boi. Recomendação:
   - fazer os limpos chegarem em grupos de 7;
   - ou trocar essas espécies por impuras e deixar os limpos como um rebanho visual.
2. Gn 8:6 diz que Noé abriu a janela, mas no jogo quem abre a cobertura é Jafé. Recomendação: Jafé só sobe e solta as amarras, e a janela abre na interação de Noé (`soltarCorvo`).
3. Ensinamento 9 ("o mapa novo só se abre depois do altar"): o segredo `segredoEstacoes` já está ativo antes do altar. Recomendação: exigir a flag `a6Altar`.
4. Ensinamento 6 ("se forçados, fogem"): não está implementado. Os agitados só esperam.
5. Lc 3:36 e Gn 11:10-13 têm "A/naxade" na fonte digital, e isso aparece no Diário. Recomendação: corrigir na normalização de `scripts/extrair-versiculos.mjs`.
6. `src/lab/ui.ts` ainda tem a frase antiga "alto das cavernas".
