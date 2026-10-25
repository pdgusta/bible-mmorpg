# Conteúdo da era 1 — Noé (Gn 6–9)

**Arquivos de conteúdo:** `src/eras/noe/{personagens,memorias,cristo,interativos,missoes,servicos,atalhos,index}.ts` e `tests/era-noe.test.ts`. A especificação é `docs/ROTEIRO.md` (Prólogo, A1–A6).

O mundo (`mapa.ts`, `construir.ts`/`MundoNoe`, `Arca.ts`) é do motor: veja `docs/tecnico/motor.md`.

**Este é o modelo para toda era nova.** Copie a estrutura.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `personagens.ts` | Os 4 jogáveis (Noé construtor, Sem sacerdote, Cam guerreiro, Jafé batedor) com as fichas do ROTEIRO. As 4 mulheres não têm nome inventado ("Mulher de Noé"…). 12 moradores da cidade com aparência própria. Rotinas por hora com `se`/`senao` por flag (`arcaPronta`, `dentroArca`, `depoisDiluvio`). Exporta `INICIO_NOE`. |
| `memorias.ts` | 10 memórias (`DefMemoria`). `arcoIris` tem força 3 e é a ponte para a prova da dúvida em B4. `enoque`, `lameque` e `estacoes` são segredos. |
| `cristo.ts` | Tipo `EntradaCristo` e entradas `semente`, `arca`, `tempestade`, `linhagem`. |
| `interativos.ts` | Registra e remove os interativos de cada etapa, com os ids exatamente como no ROTEIRO, posicionados pelos pontos do mapa (há posições de reserva). `registrarSegredosNoe` registra os segredos válidos na era inteira; um segredo com `depoisDe` só se abre depois daquela flag (`segredoEstacoes` exige `a6Altar`). |
| `missoes.ts` | `MISSOES_NOE` (prólogo, A1–A6), `reconstruirMundoNoe(s, mundo, flags)`, que remonta o vale a partir das flags ao carregar, e `limparCenaNoe()`. |
| `servicos.ts` | `ServicosNoe`: tudo que as missões usam além do `CtxMissao`. Também `ligarServicosNoe` e `servicosNoe`. |
| `atalhos.ts` | `ATALHOS_NOE`, `resolverEtapaNoe` e `jogarEraNoe(ambiente)`, que joga a era inteira pelas APIs do jogo (usado pelo e2e). |
| `index.ts` | `ERA_NOE` (id `noe`, jogáveis, missões, memórias, cristo, missão inicial, `ligarServicos`, `reconstruir`, `registrarSegredos`, `limparCena`, `jogar`, `resolverEtapa`). `seguinte: {era: 'abraao', missao: 'b1'}`. |

## Padrão de uma etapa

```ts
{ id: 'troncos', objetivo: 'Leve 4 troncos ao estaleiro (0/4)', async executar(c) {
    const s = servicosNoe(c);                    // ServicosNoe da era
    registrarInterativos(c, 'troncos');          // idempotente: remove e recria os da etapa
    while (c.contador('troncos') < 4) { await c.interacao('entregaTroncos'); c.contador('troncos', c.contador('troncos') + 1); }
    c.xp('grupo', 'cooperacao'); c.definirFlag('troncosEntregues', true);
} }
```

Regras:
- **Etapa idempotente.** Ao carregar, `reconstruirMundoNoe` restaura o mundo pelas flags, como o estágio da arca, o estado do vale e o interior. Depois a etapa atual roda do início. Abortada no meio, ela não deixa interativos para trás; há teste para isso.
- **Estado de módulo:** `missoes.ts` guarda os animais de cena entre etapas (`animaisCena`). Quando o vale é descartado (transição para Canaã, jogo novo), o `desligar()` da ligação (`src/jogo/ligacao/noe.ts`) chama `Animal.descartar(mundo)` e `ERA_NOE.limparCena()`. Assim os animais saem de `Animal.todos` e as missões os esquecem (`tests/eras-desligar.test.ts`).
- **Falas:**
  - Bíblicas: `{quem, ref, trecho?}`, conferidas pelos testes e pelo `npm run validar`.
  - Ficção: `{quem, texto}`, curta e sem contradizer o texto bíblico.
  - Deus só fala com versículos.
- **Flags:** são o estado persistente do mundo. A1–A6 ficam em `missoes.ts`; procure por `definirFlag`.

## O que `ServicosNoe` exige e de quem

| Serviço | Implementação |
|---|---|
| Mundo do vale | `MundoNoe` direto: `arca.{estagio, grupo.position, definirEstagio, definirPorta, definirJanela}`, `vigaMestra.{altura, definirAltura}`, `definirEstado('antes'\|'diluvio'\|'depois')`, `animarAgua`, `definirInterior`, `pontoArca`, `moverArca`, `repousarArca`, `definirAguaInterna`, `definirVazamento`, `definirCaixasSoltas`, `definirAltar`, `cortarArvore` |
| Céu | `Ceu`: `hora`, `tempestade`, `arco`, `gloria`, `pausado` |
| Áudio | `Audio`: `ambiente`, `musica`, `efeito` (nomes de efeito do módulo de áudio: `clique`, `sopro`, `brilho`…) |
| Animais | `animais.criar(e, x, z, o)` → `criarAnimal(e, mundo, x, z, o)`; as missões usam `agitar`, `acalmar` e `fugirDe` (agitado e forçado, foge e continua agitado) |
| Progresso | `Progresso` (`temMemoria`, `memoria`, `ganharXP`) e `cristo(id)` (desbloqueia "Aponta para Cristo"; ligado pela integração) |
| Troca/câmera | `controlar(id)`; `liberarPosto(idPosto)` → `controle.ocupante(id)` + `controle.liberarPosto(p)`; `camera.tremer(int, s)` e `camera.balanco(int)` (integração); `transicaoEra(nomes)` |
| Integração | `removerPersonagem(id)`: os moradores somem quando a porta se fecha |

## Desvios conscientes do ROTEIRO

- `betumarCasco1..3` usa o verbo `usar` com o balde na mão, porque `reparar` é só do construtor e o ROTEIRO diz "Noé ou qualquer um".
- A ordem da roda é Noé, Cam, Sem, Jafé, para a dica "Tab ou 2" de A1.
- **A4:**
  - As etapas "animais" e "mantimento" correm juntas.
  - 7 espécies chegam sozinhas; a 8ª (`ESPECIE_PERDIDA`, os cervos) fica na gruta.
  - **Leitura de Gn 7:2 (decisão do dono do projeto):** "de sete em sete" são **sete animais** por espécie limpa: três casais e um macho a mais, o que Noé oferece no altar (Gn 8:20). As limpas são ovelha, cabra, boi (`limpo` em `PARES_A4`) e o cervo da gruta, limpo pela lei de Moisés (Deuteronômio 14). As outras vêm de dois em dois. O banner de Gn 7:2 aparece na chegada do primeiro grupo limpo, e o objetivo conta "espécies", não "pares".
  - Ensinamento 6: enquanto um grupo agitado espera Sem (`esperarAcalmarGrupo`), se o personagem controlado não sabe acalmar e chega a menos de 2,5 m, os animais fogem (`fugirDe`) e continuam agitados, com a dica "Forçados, os animais fogem. Sem pode acalmá-los.". Na gruta, há 3 s de carência depois de achar os cervos.
- **A3:**
  - "Pregar" usa o verbo `falar` e exige que seja Noé.
  - Cada pregação é seguida de uma zombaria curta.
  - A tentação vence com 5 respostas.
- **A5:**
  - A arca sobe com as águas num fade no fim de `fontes` (Gn 7:17) e repousa no platô aos 150 dias.
  - Quem está dentro é levado junto.
- **A5, janela (Gn 8:6):** Jafé sobe e só solta as amarras (`janela`, flag `a5Amarras`); quem abre a janela é Noé, em `soltarCorvo` ("Abrir a janela e soltar o corvo"), com o narrador em Gn 8:6 antes de Gn 8:7. O ROTEIRO ainda diz "Jafé abre a cobertura".
- **A6:** o segredo `segredoEstacoes` só fica ativo depois do altar (Ensinamento 9).
- **Acréscimos:**
  - Gn 7:7 na entrada da arca.
  - 6 conversas opcionais de ficção em A6 (`conversa_<id>`).
  - Uma fala de ficção de Sem no planejamento de A2, porque o objetivo diz "Fale com Sem, Cam e Jafé".
- A pose de oração usa o clipe `agachado` (`CLIPE_ORACAO`). O ideal é usar a pose procedural `humano.oracao`.

## Testes (`npx vitest run tests/era-noe.test.ts`)

- refs e trechos BKJ, tanto no código-fonte quanto nas falas registradas durante a execução;
- ids únicos;
- toda `proxima` existe;
- fichas e memórias conforme o ROTEIRO;
- cada missão do início ao fim com um `CtxMissao` falso que age sozinho;
- a era inteira em sequência;
- idempotência por etapa;
- a era jogada só pelos atalhos;
- os ajustes da revisão: limpos de sete em sete, Noé abre a janela, o segredo das estações depois do altar, agitados forçados fogem, a fala de Sem em A2.

## Revisão

O conteúdo passa pelo checklist de `docs/tecnico/revisao.md`. Os achados da revisão da era 1 estão listados lá.
