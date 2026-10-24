# A Semente

*Título provisório.* RPG 3D singleplayer de navegador que atravessa a narrativa bíblica de Gênesis a Apocalipse. O fio condutor é a promessa da **Semente** (Gn 3:15), guardada na linhagem de Noé e Abraão e cumprida em Cristo (Gl 3:16).

Este repositório contém o **MVP com duas eras**: **Noé** (Gn 6–9) e **Abraão** (Gn 12–22).

- Design: [`docs/DESIGN.md`](docs/DESIGN.md)
- Ensinamentos vividos pelas mecânicas: [`docs/ENSINAMENTOS.md`](docs/ENSINAMENTOS.md)
- Roteiro das missões, falas e mecânicas: [`docs/ROTEIRO.md`](docs/ROTEIRO.md)

## Rodar localmente

Requisitos: **Node.js 20+** e um navegador com WebGL2 (Chrome, Edge, Firefox ou Safari recentes).

```bash
npm ci
npm run dev
```

Abra <http://localhost:5173>.

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Vite) com recarga automática |
| `npm run build` | Checa os tipos e gera a versão estática em `dist/` |
| `npm run preview` | Serve o `dist/` gerado, para conferir o build |
| `npm test` | Testes unitários (Vitest) |
| `npm run typecheck` | Só a checagem de tipos do TypeScript |
| `npm run validar` | Confere se toda referência e todo trecho bíblico usados no código existem na fonte |
| `npm run e2e` | Joga o MVP do início da era 1 ao fim da era 2 num Chromium headless (precisa do `npm run dev` rodando) |
| `npm run versiculos` | Regenera `src/data/biblia/versiculos.json` a partir das fontes (ver abaixo) |

### Qualidade gráfica

O jogo escolhe o preset **médio** por padrão. Para forçar outro, use `?q=baixo` ou `?q=alto` na URL, ou mude em *Configurações*.

## Controles

| Tecla | Ação |
|---|---|
| W A S D / setas | Andar |
| Mouse | Girar a câmera (clique no jogo para capturar o ponteiro) |
| Shift | Correr (gasta fôlego) |
| Espaço | Pular |
| C / Ctrl | Agachar |
| E | Interagir (toque) ou segurar para ações longas |
| Q | Habilidade da classe; nas provas espirituais, "Está escrito" |
| R | Orar (segurar) |
| F | Pedir ao companheiro mais próximo para seguir ou esperar |
| Tab (segurar) | Roda de personagens |
| 1–5 | Trocar direto de personagem |
| Botão direito | Escudo da fé (nas provas) |
| V | Discernir |
| J | Diário (missões, Escrituras, leitura, memórias, personagens) |
| M | Mapa |
| Esc | Pausa |

Controles de videogame (gamepad) também funcionam.

## Texto bíblico

- **Texto base:** Bíblia King James Fiel 1611 (BKJ).
- **Apoio ("Entender melhor"):** Nova Versão Transformadora (NVT).
- **Original em inglês:** King James Version 1611 (domínio público), de [arleym/kjv-markdown](https://github.com/arleym/kjv-markdown).

O jogo nunca digita texto bíblico no código. Diálogos citam **referências** (e, quando preciso, um trecho que tem de ser cópia exata da BKJ). O texto vem só de `src/data/biblia/versiculos.json`, que guarda apenas os versículos usados no jogo e é gerado assim:

1. Coloque as fontes em `fontes/` (pasta fora do controle de versão):
   - `fontes/KJF.json`
   - `fontes/NVT.json`
   - `fontes/kjv-markdown/` (clone de arleym/kjv-markdown)
2. Rode `npm run versiculos`. O script varre `src/` e `docs/` atrás de referências e grava o JSON.
3. Rode `npm run validar` para conferir referências e trechos.

As Bíblias completas **não** são versionadas, porque a BKJ e a NVT são protegidas por direitos autorais. O repositório guarda só os versículos citados pelo jogo.

## Estrutura

```
src/
  core/       entrada, eventos, aleatoriedade com semente
  render/     renderizador, céu, terreno, vegetação, grama, água, chuva
  mundo/      relevo, colisores, física, navegação
  entidades/  personagens vestidos e animados, animais, construções
  camera/     câmera de 3ª pessoa, troca de personagem, transição de era, cinemáticas
  jogo/       núcleo do jogo, atributos, classes, missões, diálogos, provas, progresso, save
  eras/       noe/ e abraao/: mapas, personagens, missões, memórias
  ui/         HUD, diálogos, diário, roda de personagens, menus
  audio/      áudio sintetizado (ambiente, música generativa, efeitos)
  data/biblia versiculos.json (gerado)
scripts/      geração de versículos, validação e pipeline de modelos 3D
e2e/          testes de ponta a ponta e fotos automáticas
public/       modelos 3D otimizados (glTF + meshopt)
```

## Publicação

O workflow `.github/workflows/pages.yml` testa, gera o build e publica no **GitHub Pages** a cada push na `main` (ou manualmente, em *Actions*). Para ativar, vá em *Settings → Pages* e escolha **GitHub Actions** como fonte.

## Créditos e licenças

- **Modelos 3D:** [Quaternius](https://quaternius.com), CC0 (Stylized Nature MegaKit, Universal Animation Library 1 e 2, Universal Base Characters, Farm Animals, Animal Pack). Os animais procedurais e as roupas foram feitos em código.
- **Motor gráfico:** [three.js](https://threejs.org) (MIT).
- **Fontes tipográficas:** Nunito e Cormorant Garamond (SIL Open Font License), via Fontsource.
- **Bíblia King James Fiel 1611** e **Nova Versão Transformadora:** © dos respectivos detentores. Citadas como trechos dentro do jogo.
- **King James Version 1611:** domínio público.
