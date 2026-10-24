# Estado do projeto

*Atualizado a cada integração. Última atualização: 24/10/2026, durante a fase 2 (módulos em paralelo).*

## Resumo

O MVP (era 1, Noé → era 2, Abraão) está **em construção**. Os módulos foram feitos em paralelo por subagentes e estão sendo **integrados** num jogo jogável (título → era 1 → transição → era 2).

## Módulos

| Módulo | Estado | Doc |
|---|---|---|
| Design, ensinamentos e roteiro das missões | ✅ pronto | `docs/DESIGN.md`, `docs/ENSINAMENTOS.md`, `docs/ROTEIRO.md` |
| Pipeline bíblico (versículos, validação) | ✅ pronto | `docs/TECNICO.md` |
| Personagens humanos e pipeline de modelos | ✅ pronto | `tecnico/personagens.md` |
| Núcleo, controle, troca, câmeras e transição de era | ✅ pronto (e2e da troca passa) | `tecnico/troca-camera.md` |
| Sistemas: missões, diálogo, provas, progresso, save | ✅ pronto (testes passam) | `tecnico/sistemas.md` |
| UI (HUD, diálogo, Diário, menus, roda, provas) | ✅ pronta (demo `?lab=ui`) | `tecnico/ui.md` |
| Conteúdo da era 1 (prólogo, A1–A6) | ✅ escrito e revisado (fidelidade bíblica e texto) · 🔄 4 ajustes de lógica pedidos pela revisão (animais limpos de 7 em 7, Noé abre a janela, segredo após o altar, animais que fogem se forçados) | `tecnico/era-noe.md`, `tecnico/revisao.md` |
| Mundo de Canaã | ✅ pronto (`?lab=canaa`, ≤ 92 draw calls) | `tecnico/canaa.md` |
| Motor visual (vale de Noé, dilúvio, interior da arca, desempenho) | 🔄 em andamento | `tecnico/motor.md` |
| Animais e áudio | ✅ pronto (23 espécies, rebanho, áudio sintetizado; `?lab=animais`) | `tecnico/animais-audio.md` |
| Conteúdo da era 2 (B1–B5) | 🔄 em andamento | `tecnico/era-abraao.md` |
| Integração (fluxo da partida, ligações, e2e do MVP) | 🔄 em andamento | `tecnico/integracao.md` |
| Deploy (GitHub Pages) | ✅ workflow pronto (ativar em *Settings → Pages → GitHub Actions*) | `README.md` |

## Problemas conhecidos

- **Arte, vale de Noé:**
  - A grama aparece com pontas escuras.
  - As folhas e as rochas do kit vêm vermelhas e verde-escuras. O motor está criando uma opção de cor na `Natureza`; em Canaã, `recolorirFolhas()` contorna o problema.
  - As nuvens parecem bolhas bege.
- **Arte, Canaã:**
  - As tendas parecem caixas escuras.
  - O Moriá parece uma cúpula cinza e irregular.
  - As fogueiras não iluminam os personagens.
- **Física:** as encostas não bloqueiam a subida (só um degrau acima de 0,35 m por quadro). O Moriá usa paredes invisíveis, e a câmera ainda colide com elas; a integração vai fazer a câmera ignorar a tag `invisivel`.
- **Transição de era:** as faixas de revelação do terreno e da vegetação têm larguras diferentes, e a água fica escondida durante a transição.
- **Fonte BKJ:** os defeitos de digitalização ("A/naxade" → "Arfaxade", palavras partidas por hífen) são corrigidos em `CORRECOES_FONTE` (`scripts/biblia-comum.mjs`).
- **Sem retratos e sem clipe de oração:** a UI usa monogramas, e a oração usa pose procedural ou o clipe `agachado`.
- **Diálogo:** abortar uma missão não fecha uma fala já aberta na UI. A integração limpa a UI ao carregar.

## Próximos passos

1. Terminar a integração: título sobre o vale 3D, novo jogo, era 1 inteira, transição para a era 2, era 2 inteira, e save/carregar em qualquer ponto.
2. Rodar `npm run e2e` do início ao fim, com fotos dos momentos-chave.
3. Revisar a fidelidade bíblica da era 2 (`tecnico/revisao.md`).
4. Passada de arte:
   - grama, cores da vegetação e nuvens;
   - tendas e o Moriá em Canaã;
   - luz das fogueiras;
   - retratos.
5. Validar o desempenho em GPU integrada real (60 fps, preset médio) e ajustar os presets.
6. Ativar o GitHub Pages e fazer merge na `main`.

## Como retomar numa sessão nova

1. Leia `CLAUDE.md`, este arquivo e `docs/TECNICO.md`.
2. `npm ci`, depois `npx tsc --noEmit && npx vitest run && npm run validar`: tudo tem de passar.
3. `npm run dev` e abra `/` (jogo) e os laboratórios (`?lab=ui`, `?lab=canaa`, `?lab=animais`).
4. Escolha um item de "Próximos passos" e, ao terminar, atualize este arquivo.

**Fontes locais:** para regenerar versículos, coloque `fontes/KJF.json`, `fontes/NVT.json` e `fontes/kjv-markdown/` (ver `README.md`). Para regenerar modelos, baixe os pacotes da Quaternius (`docs/TECNICO.md`). Nada disso é necessário para jogar ou desenvolver: os arquivos gerados estão no repositório.
