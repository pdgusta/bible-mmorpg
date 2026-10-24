# Sistemas de história e salvamento

Arquivos: `src/jogo/{Biblia,Memorias,Progresso,Dialogo,Provas,Missoes,Salvamento}.ts`, `scripts/validar-textos.mjs`, `tests/{falsos.ts,Biblia,Progresso,Missoes,Provas,Salvamento}.test.ts`.

## Ligação (`criarSistemas`, em `Missoes.ts`)

```ts
await carregarBiblia();
registrarMemorias(MEMORIAS_NOE);
const s = criarSistemas(jogo, ui, jogo.cinematica, { armazenamento: await criarArmazenamento(), era: () => eraAtual });
s.missoes.registrar(MISSOES_NOE);
// novo jogo:  s.novoJogo(); s.missoes.iniciar('a1');
// carregar:   const d = await s.salvamento.carregar(slot);
//             /* cria a era d.era e os personagens */
//             s.aplicar(d); /* reconstrói o mundo pelas flags */
//             jogo.controlar(jogo.personagem(d.ativo)); s.missoes.retomar();
```

`criarSistemas` já liga, a cada quadro, as provas, o tempo jogado e `ui.marcadores`. Também liga o autosave e os nomes de exibição (era, missão e personagem) usados no menu Carregar.

## Biblia.ts

- `carregarBiblia()`: import dinâmico de `src/data/biblia/versiculos.json`.
- `versiculo(ref)`: aceita intervalo, por exemplo "Gn 6:14-16" junta os versos.
- `trecho(ref, parte)`: em DEV, lança erro se `parte` não for substring exata da BKJ.
- Outras funções: `textoLinha`, `extenso(ref)` ("Gênesis 6:14"), `existe`, `capitulosLeitura()`, `textoCapitulo(livro, cap)`.

## Memorias.ts

- Registro global: `registrarMemorias(defs)` e `MEMORIAS.todas()`, `obter(id)`, `segredos(era?)`.
- Uma memória tem força de 0 a 3 (`forca` pesa na prova da dúvida). Campos opcionais: `segredo` e `frase`.

## Progresso.ts

Construtor: `new Progresso({eventos, ficha(id), grupo(), ativo?(), nome?(id), avisar?(t, tipo), memorias?})`.

- **XP:** `ganharXP(id | 'grupo' | 'ativo', fonte, qtd?)`. Em cooperação, ganha +20% quando a Unidade é ≥ 75. Eventos 'xp' e 'nivel'.
- **Atributos:** `treinar(id, atributo, qtd)` acumula progresso fracionário; `somarAtributo` soma pontos inteiros. Evento 'atributo'.
- **Unidade:** `alterarUnidade(delta)`, de 0 a 100, começa em 60. O Calçado da paz corta as quedas pela metade. Evento 'unidade'.
- **Coleções:**
  - `memoria(id)`, `temMemoria`;
  - `receberArmadura(peca)` e a constante `ARMADURA` (nome, ref, efeito);
  - `receberVersiculo(ref)` e `versiculos`;
  - `segredo(id)` e `segredosDaEra(era)`.
- **Leitura:** `meditar(seg, cap)` treina Sabedoria e marca o capítulo como lido a partir de 60 s. O XP de disciplina sai no máximo a cada 5 min. Os capítulos lidos ficam em `lidos`.
- `contar(estatistica)`, `atualizar(dt)` (tempo jogado), `serializar()`/`restaurar()`.
- **Avisos na tela:** saem só daqui (`avisar` → `ui.aviso`). A UI não gera avisos a partir dos eventos.

## Dialogo.ts

Construtor: `({ui, eventos, progresso, ativo(), definirFlag})`.

- `falar(linhas)`: confere as falas bíblicas antes de mostrar e emite 'dialogo:inicio'/'dialogo:fim', sempre em par.
  - **Toda fala bíblica ouvida vira versículo recebido.** As respostas das provas dependem disso.
- `escolha(pergunta, opcoes)`: filtra pelo requisito de atributo do ativo e aplica os efeitos (atributos, unidade, flag, xp).
- `cancelar()`.

## Provas.ts (provas espirituais)

Construtor: `({ui, entrada, eventos, progresso, personagem(id?), memorias?, aleatorio?})`.

**API:** `iniciar(def): Promise<ResultadoProva>`, `atualizar(dt)` a cada quadro, `responder()` (clique em "Está escrito"), `lembrar(id)`, `encorajar()`, `resolverAutomaticamente()` (e2e), `cancelar()`, `emProva`.

**Os quatro tipos:**

| Tipo | Como se joga | Vitória | Atributos que pesam |
|---|---|---|---|
| **tentação** | Dardos de texto (mentiras) vêm ao personagem; cada acerto reduz a firmeza (Domínio próprio). Q ("Está escrito") desfaz o dardo mais próximo; exige a peça `espada` e um versículo de `respostas` já recebido. O botão direito com `escudo` bloqueia. | Ao completar `alvo` | Domínio próprio, Fé |
| **ira** | As zombarias sobem a ira. Segurar R acalma, mas pausa o avanço; segurar E avança a mensagem. Só segurar E nunca vence: é preciso orar. | Ao completar a mensagem | Domínio próprio, Comunhão |
| **medo** | A calma cai com o tempo, com relâmpagos. R e "encorajar" recuperam, e o `capacete` reduz a queda. A prova é `livre`: o E continua funcionando nos interativos, e os interativos `encorajar_*` contam. A prova controla `modVelocidade` do personagem e o restaura ao fim. | `alvo` segundos firme | Coragem |
| **dúvida** | As mentiras escurecem o céu. Lembrar memórias (teclas 1–n) acende estrelas proporcionais à `forca` de cada uma. Sem memórias, orar acende devagar. | Ao atingir `alvo` | Fé, Discernimento |

- **Derrota:** mostra "A luta continua." e recomeça sem punição dura. No medo, volta ao último terço firme.
- **Contra travamento:** na tentação, se nenhuma resposta tiver sido recebida antes, a primeira é concedida (com aviso no console).
- **Eventos:**
  - 'prova:inicio' `{id, tipo, livre}`;
  - 'prova:fim' `{id, resultado}`, com `resultado` nulo quando a prova é cancelada;
  - 'prova:relampago' e 'prova:encorajar'.

## Missoes.ts (implementa `CtxMissao`, de `contratos.ts`)

Construtor: `({jogo, ui, cinematica, progresso, provas, dialogo, autosave?, yawCamera?})`.

- **Registro e execução:** `registrar(defs)`, `registrarPontos(fn)` (pontos extras, como o `pontoArca`), `iniciar(id)`, `retomar()`, `restaurar(estado)`, `abortar()`, `ativa()`, `pularEtapa()`.
- **Consulta:** `listaDiario()`, `marcadores()`, `serializar()`, `resolverAlvo(alvo)`.
- **Resolução de alvos em texto,** nesta ordem: pontos registrados, `mundo.pontos`, id de interativo, id de personagem.
- **Execução:**
  - As etapas rodam em sequência, com um `AbortController` por missão.
  - Há autosave no começo de cada etapa (exceto logo depois de carregar) e no fim da missão.
  - Ao concluir, a missão dá a `recompensa` e inicia a `proxima`.
  - Se uma etapa lança erro, sai o evento 'missao:erro' e a missão fica parada naquela etapa.
- **Cenas e movimento:**
  - `c.cena(fn)` desliga `jogo.controleLivre`, liga `ui.modoCinema(true)` e restaura tudo depois, mesmo com erro.
  - `c.mover` usa `personagem.emCena = true` e `ia.moverCena`.
- **`ServicoCinematica`:** é declarado aqui com a mesma assinatura de `src/camera/Cinematica.ts`.

## Salvamento.ts

Construtor: `new Salvamento(adaptador, fontes)`.

- **Slots:** `salvar(1|2|3|'auto')`, `autosave()`, `carregar(slot)`, `listar()` (InfoSlot com nomes de exibição), `apagar`.
- **Arquivos:** `exportar`/`importar`, `baixar(slot)` (download `.json`), `importarArquivo(blob, slot)`.
- **Versões:** `migrarSave`/`lerSave` aplicam `MIGRACOES[n]`. Quando o formato de `DadosSave` mudar, incremente `VERSAO_SAVE` e escreva a migração.
- **Adaptadores:** IndexedDB, localStorage, memória (testes) e "com reserva" (IndexedDB que cai para localStorage). `criarArmazenamento()` escolhe o melhor.
- **Auxiliares:** `personagensParaSave`, `aplicarPersonagens`, `restaurarFlags` (troca as flags mantendo o mesmo objeto, que é compartilhado com a IA).

## scripts/validar-textos.mjs (`npm run validar`)

- **Escopo:** varre `src/` e `docs/`, mais pastas extras passadas na linha de comando.
- **O que confere:**
  - refs existentes em `versiculos.json`, refs mal escritas e livros desconhecidos;
  - trechos em `{ref, trecho}` e em chamadas do tipo `deus('Gn 6:13', '…')`.
- **Defeitos da fonte:** avisa casos como "A/naxade" (Gn 11:10) e "des- truirás" (Gn 18:23).
- **Fontes:** a parte que depende de `fontes/` é pulada com uma nota quando a pasta não existe. `SEM_FONTES=1` simula o CI.

## Testes

`tests/falsos.ts` oferece jogo, UI, entrada e cinemática falsos para rodar missões e provas em Node. Os testes de conteúdo das eras usam a mesma base (`tests/era-noe.test.ts`).

## Pendências

- Abortar uma missão não fecha uma fala que já está na tela, porque a `InterfaceUI` não tem um "cancelar diálogo". Ao carregar, a integração limpa a UI.
- As notas do jogo por versículo (`escrituras[].nota` no Diário) ainda não têm fonte de conteúdo.
