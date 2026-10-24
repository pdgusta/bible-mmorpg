Você é o agente "Motor visual e desempenho" de um projeto em andamento. Trabalhe em português (identificadores e textos), no estilo do código existente.

## Projeto
"A Semente": RPG 3D singleplayer de navegador, toda a narrativa bíblica; MVP com 2 eras (Noé → Abraão). Stack: Three.js r186 (WebGL2) + TypeScript + Vite. Repo: /home/user/bible-mmorpg. Leia primeiro: docs/DESIGN.md, src/jogo/contratos.ts, e os arquivos que você possui (abaixo). Direção de arte: inspirada em Palia — estilizada, quente, suave, aconchegante. Assets CC0 da Quaternius já convertidos em public/modelos (natureza.glb com 40 modelos; humanos; animais).

## Regras comuns
- Outros 4 agentes trabalham em paralelo no mesmo diretório em arquivos diferentes. Edite SÓ os arquivos que você possui. Se precisar de mudança em outro arquivo, descreva no relatório final.
- NÃO faça git commit/push (o orquestrador faz).
- Rode `npx tsc --noEmit`; corrija erros nos SEUS arquivos (erros em arquivos de outros agentes podem aparecer temporariamente — ignore).
- Servidor Vite já roda em http://localhost:5173 (se não responder, rode `npx vite --port 5173 --strictPort` em background). Ferramenta de foto: `node e2e/foto.mjs "/?<query>" saida.png 960 540` (espera window.pronto; imprime erros de console). O Chromium headless usa SwiftShader (CPU, lento): tire poucas fotos, pequenas, salve-as em /tmp/claude-0/-home-user-bible-mmorpg/0fba74a8-ffc4-5dee-8439-79271b520e80/scratchpad/motor/. FPS medido aqui não representa uma GPU real: use renderer.info (draw calls, triângulos) como orçamento.
- São 4 núcleos de CPU compartilhados: evite processos pesados e longos.
- Nunca escreva texto bíblico no código (só referências).

## Seus arquivos
src/render/* (Renderizador, Ceu, Terreno, Grama, Agua, Natureza, Ativos, Shaders), src/mundo/* (Relevo, Colisao, Fisica, Navegacao, Mundo, Espalhar — mantenha as APIs públicas compatíveis; pode acrescentar), src/entidades/Construtor.ts, src/eras/noe/{mapa.ts,construir.ts,Arca.ts}. Pode criar src/render/Chuva.ts e outros em src/render/.
NÃO toque: src/jogo/*, src/ui/*, src/camera/*, src/entidades/humano/*, src/main.ts. A entrada temporária src/jogo/inicio.ts aceita parâmetros de URL: pos=x,z  yaw  pitch  dist  hora  arca=0..6  q=baixo|medio|alto (não a edite; se precisar de outro parâmetro de depuração, crie um lab próprio em src/lab/motor.ts e me diga a linha para src/main.ts).

## Tarefas
1. Fazer o vale de Noé renderizar corretamente e bonito. Primeira foto: `/?hora=16.5&pitch=0.25&dist=7`. Corrija erros de execução, terreno, céu, água (rio com vau), grama, vegetação (LOD perto/longe), sombras, neblina. Ajuste cores/luz para o visual quente e suave. Confira também a casa de Noé, a cidade (≈ x 178, z -112), o estaleiro com a arca (x -15, z 5) e o bosque (x < -110).
2. Orçamento para vídeo integrado no preset 'medio': ≤ ~150 draw calls e ≤ ~600 mil triângulos em vistas típicas. Meça em 4–5 pontos de vista com `jogo.render.gl.info.render` (window.jogo existe). Otimize (LOD, alcance, densidade, sombras só perto, fusão de malhas).
3. Estados do mundo para o dilúvio, em MundoNoe (construir.ts): `definirEstado('antes'|'diluvio'|'depois')`.
   - 'diluvio': céu de tempestade (Ceu.tempestade já existe), chuva (src/render/Chuva.ts: riscos instanciados em volta da câmera, baratos), água subindo: `animarAgua(nivelAlvo, segundos): Promise<void>`.
   - 'depois': terreno lamacento (uniform de lama no material do Terreno), vegetação trocada (árvores secas/caídas, broto de grama novo, sem flores), a cidade substituída por montes de barro e ruínas baixas (reverente, sem corpos), poças. Natureza precisa de `limpar()` e reconstrução.
4. Arca: verifique os estágios 0–6 (param arca=), colisores (andar pelos conveses pelas rampas; porta aberta/fechada). Acrescente luz de interior (lanternas emissivas + modo de iluminação interna: neblina menor, luz morna) com API simples, ex.: `vale.definirInterior(ativo: boolean)`.
   Crie como objetos próprios: andaime escalável junto à arca, guincho e a viga mestra com `definirAltura(t: 0..1)`; registre pontos em `mundo.pontos`: 'guincho', 'andaimeBase', 'andaimeTopo', 'ancoraCorda', 'encaixeViga1', 'encaixeViga2', 'bomba' (bomba de porão no convés 1), 'janela' (no convés 3, junto à abertura sob o teto). Registre o andaime em `mundo.escaladas` (tipo Escalada já existe em src/mundo/Mundo.ts) e também uma escada interna do convés 3 até a janela.
   Pontos dentro da arca devem ser 3D: acrescente em MundoNoe um método `pontoArca(nome): THREE.Vector3` para posições internas (porta, bomba, 4 pontos de vazamento 'vazamento1..4' no convés 1, baias de animais agitados 'baia1..3' no convés 2, redes de carga 'rede1','rede2' no alto do convés 2, área da família no convés 3, janela), que continuem certos quando a arca for movida (Arca.mover).
5. Depois do dilúvio a arca repousa no platô do monte ao norte (Arca.mover); garanta que a porta fique acessível e que dê para descer do platô até o vale andando.

## Relatório final (≤ 60 linhas)
Arquivos criados/alterados; API pública nova (assinaturas); números de desempenho medidos (antes/depois); fotos salvas (caminhos); problemas conhecidos; o que você precisa de outros módulos.