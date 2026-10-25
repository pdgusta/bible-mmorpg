// Laboratório da interface: ?lab=ui&tela=hud|dialogo|escolha|diario|entender|roda|titulo|pausa|
// config|slots|creditos|prova|avisos|capitulo|carregamento. Sem `tela`, mostra o HUD e uma barra
// de botões para testar tudo à mão (J abre o Diário, Esc a Pausa, segure Tab para a roda).
// Os textos bíblicos vêm de versiculos.json pelas referências; aqui só há texto do jogo.
import * as THREE from 'three';
import { carregarBiblia } from '../jogo/Biblia';
import type { NomeAtributo } from '../jogo/Atributos';
import type { NomeClasse } from '../jogo/Classes';
import type { EstadoHUD, EstadoProvaUI, ItemRoda, Linha, MarcadorTela, OpcaoEscolha } from '../jogo/contratos';
import { UI, servicosBiblia, type DadosDiario, type InfoSlot, type PersonagemDiario } from '../ui/UI';

const NOMES: Record<string, string> = {
  noe: 'Noé', sem: 'Sem', cam: 'Cam', jafe: 'Jafé', abraao: 'Abrão', sara: 'Sarai', lo: 'Ló', eliezer: 'Eliézer', isaque: 'Isaque',
};
const CLASSES_P: Record<string, NomeClasse> = {
  noe: 'construtor', sem: 'sacerdote', cam: 'guerreiro', jafe: 'batedor',
  abraao: 'profeta', sara: 'hospitaleiro', lo: 'pastor', eliezer: 'guerreiro', isaque: 'batedor',
};
const ORDEM: NomeAtributo[] = ['forca', 'resistencia', 'agilidade', 'fe', 'comunhao', 'dominio', 'sabedoria', 'compaixao', 'humildade', 'perseveranca', 'discernimento', 'coragem'];
const atr = (v: number[]) => Object.fromEntries(ORDEM.map((a, i) => [a, v[i]])) as Record<NomeAtributo, number>;

function personagem(id: string, nivel: number, xp: number, valores: number[], extra: Partial<PersonagemDiario> = {}): PersonagemDiario {
  return {
    id, nome: NOMES[id], classe: CLASSES_P[id], nivel, xp, xpProximo: Math.round(120 * Math.pow(nivel, 1.35)),
    atributos: atr(valores), progresso: { forca: 0.4, perseveranca: 0.7 }, disponivel: true, ...extra,
  };
}

const DIARIO: Partial<DadosDiario> = {
  missoes: [
    { id: 'a1', era: 'noe', titulo: 'A1 — Achou graça', status: 'concluida', tipos: ['tutorial', 'fisico'], refs: ['Gn 6:8', 'Gn 6:13', 'Gn 6:14', 'Gn 6:22'],
      resumo: 'No monte de oração, Deus falou com Noé sobre o fim que viria e mandou fazer uma arca. Com Cam, Noé levou os troncos de gofer até o estaleiro e assentou a quilha.' },
    { id: 'a2', era: 'noe', titulo: 'A2 — A viga mestra', status: 'ativa', tipos: ['cooperativo'], refs: ['Gn 6:14', 'Gn 6:15', 'Gn 6:16', 'Ec 4:9', 'Ec 4:12'],
      objetivo: 'Coloque Cam no guincho, troque para Jafé e suba o andaime.',
      resumo: 'A viga mestra precisa subir até o alto do casco. Sozinho, ninguém a ergue: Cam segura o guincho, Jafé amarra a corda lá em cima e Noé fixa a viga.' },
  ],
  escrituras: [
    { ref: 'Gn 6:8', era: 'noe', nota: 'A história de Noé começa pela graça: Deus olhou para ele com favor antes de qualquer obra.' },
    { ref: 'Gn 6:13', era: 'noe' },
    { ref: 'Gn 6:14', era: 'noe', nota: 'Gofer é uma madeira que só aparece aqui na Bíblia; muitos pensam num tipo de cipreste, resinoso e resistente à água.' },
    { ref: 'Gn 6:18', era: 'noe', nota: 'É a primeira vez que a Bíblia usa a palavra pacto (aliança). Deus se compromete antes que Noé faça qualquer coisa.' },
    { ref: 'Gn 6:22', era: 'noe' },
    { ref: 'Hb 11:7', era: 'noe' },
    { ref: 'Gn 9:13', era: 'noe', nota: 'O arco na nuvem é um sinal visível de uma promessa invisível: Deus se lembra do pacto com toda a terra.' },
    { ref: 'Jo 10:9', era: 'noe' },
  ],
  cristo: [
    { id: 'semente', titulo: 'A Semente prometida', refs: ['Gn 3:15', 'Gl 3:16'], completo: false,
      texto: 'Logo depois da queda, Deus promete que a semente da mulher venceria a serpente. Essa promessa passa de geração em geração: de Noé a Sem, de Sem a Abraão. Paulo explica que a Semente é uma só pessoa: Cristo.' },
    { id: 'arca', titulo: 'Uma só porta', refs: ['1Pe 3:20-21', 'Jo 10:9', 'Mt 24:37-39'],
      texto: 'A arca tinha uma só porta, e foi o próprio Senhor quem a fechou. Pedro vê nas águas do dilúvio uma figura do batismo, e Jesus se apresenta como a porta: quem entra por ele é salvo.' },
  ],
  memorias: [
    { id: 'graca', titulo: 'Achou graça', ref: 'Gn 6:8', era: 'noe', forca: 1, obtida: true, descricao: 'Numa terra cheia de violência, o favor de Deus repousou sobre Noé. A salvação começa pela graça.' },
    { id: 'pacto', titulo: 'Contigo estabelecerei o meu pacto', ref: 'Gn 6:18', era: 'noe', forca: 2, obtida: true, descricao: 'Antes da primeira gota de chuva, Deus prometeu guardar Noé e toda a sua casa.' },
    { id: 'pregador', titulo: 'Pregador da justiça', ref: '2Pe 2:5', era: 'noe', forca: 1, obtida: true, descricao: 'Noé avisou a cidade mesmo sem ninguém ouvir. A vitória foi a fidelidade.' },
    { id: 'arcoIris', titulo: 'O sinal da aliança', ref: 'Gn 9:13', era: 'noe', forca: 3, obtida: true, descricao: 'O arco na nuvem, sinal do pacto com toda a terra. Esta memória atravessará as gerações.' },
    { id: 'portaFechada', titulo: 'O Senhor fechou a porta', ref: 'Gn 7:16', era: 'noe', forca: 2, obtida: false, descricao: '' },
    { id: 'enoque', titulo: 'Enoque caminhava com Deus', ref: 'Gn 5:24', era: 'noe', forca: 1, obtida: true, segredo: true, descricao: 'Uma pedra memorial na gruta lembra o bisavô de Noé, que caminhava com Deus.' },
    { id: 'lameque', titulo: '“Este nos consolará”', ref: 'Gn 5:29', era: 'noe', forca: 1, obtida: false, segredo: true, descricao: '' },
    { id: 'chamado', titulo: 'O chamado', ref: 'Gn 12:1', era: 'abraao', forca: 1, obtida: false, descricao: '' },
  ],
  personagens: [
    personagem('noe', 3, 140, [4, 5, 2, 7, 8, 7, 7, 6, 6, 8, 6, 5], { atual: true, descricao: 'Homem justo, que vivia perto de Deus numa geração violenta.', ref: 'Gn 6:9' }),
    personagem('sem', 2, 60, [4, 5, 4, 6, 6, 5, 5, 7, 5, 5, 5, 4], { descricao: 'Filho de Noé; dele vem a linhagem da promessa.', ref: 'Gn 6:10' }),
    personagem('cam', 2, 95, [7, 6, 4, 3, 3, 3, 3, 4, 3, 5, 3, 6], { descricao: 'Forte e impaciente; aprende a usar a força para sustentar os outros.' }),
    personagem('jafe', 1, 80, [4, 5, 7, 4, 4, 4, 4, 5, 4, 4, 5, 6], { descricao: 'Curioso, com os olhos sempre além do horizonte.' }),
  ],
  armadura: ['espada'],
  unidade: 64,
  lidos: ['Gn 1', 'Gn 6'],
  legado: [],
};

const HUD_NOE: EstadoHUD = {
  nome: 'Noé', classe: 'construtor', iconeClasse: '🔨', nivel: 3, xp: 140, xpProximo: 529,
  folego: 82, folegoMax: 132, dominio: 115, dominioMax: 123, unidade: 64, hora: 7.5, era: 'noe', visivel: true,
};

const RODA: ItemRoda[] = [
  { id: 'noe', nome: 'Noé', classe: 'construtor', icone: '🔨', atividade: 'Assentando a quilha', disponivel: true, atual: true, tecla: 1 },
  { id: 'cam', nome: 'Cam', classe: 'guerreiro', icone: '🛡️', atividade: 'Segurando o guincho', disponivel: true, atual: false, tecla: 2 },
  { id: 'jafe', nome: 'Jafé', classe: 'batedor', icone: '🧗', atividade: 'Explorando a borda do bosque', disponivel: true, atual: false, tecla: 3 },
  { id: 'sem', nome: 'Sem', classe: 'sacerdote', icone: '🕯️', atividade: 'Alimentando os animais', disponivel: true, atual: false, tecla: 4 },
];

const DIALOGO: Linha[] = [
  { quem: 'deus', ref: 'Gn 6:14' },
  { quem: 'noe', texto: 'Uma arca… aqui, no seco. Que seja feita a tua vontade, Senhor.', emocao: 'reverente' },
  { quem: 'cam', texto: 'Pai! Já derrubei estas. Mas carregar até o estaleiro é outra história.' },
  { quem: 'narrador', ref: 'Gn 6:22' },
  { quem: 'narrador', texto: 'Mas o homem desobedeceu, e o pecado entrou no mundo. Ainda assim, Deus fez uma promessa.' },
  { quem: 'satanas', texto: 'Desista. Ninguém te ouve.' },
  { quem: 'anjo', ref: 'Gn 22:11', trecho: 'Abraão, Abraão;' },
  { quem: 'deus', ref: 'Gn 9:13' },
];

const ESCOLHA: OpcaoEscolha[] = [
  { texto: 'Irmãos não brigam por água. Deixem os rebanhos de Ló beberem primeiro.' },
  { texto: 'Vamos dividir os dias do poço, com justiça para todos.', requer: { atributo: 'sabedoria', minimo: 6 } },
  { texto: 'Basta! O poço é meu, e quem manda aqui sou eu.' },
  { texto: 'Lembrar-se da aliança de Noé e propor um acordo diante de Deus.', requer: { atributo: 'discernimento', minimo: 8 } },
];

const SLOTS: InfoSlot[] = [
  { slot: 'auto', vazio: false, era: 'Era 1 — Noé', missao: 'A2 — A viga mestra', personagem: 'Jafé', memorias: 3, tempoJogado: 2280, atualizadoEm: '2026-10-24T14:05:00' },
  { slot: 1, vazio: false, era: 'Era 1 — Noé', missao: 'A1 — Achou graça', personagem: 'Noé', memorias: 2, tempoJogado: 1260, atualizadoEm: '2026-10-23T21:40:00' },
  { slot: 2, vazio: true },
  { slot: 3, vazio: true },
];

/** Paisagem pintada no canvas (para julgar a legibilidade sobre um "mundo"). */
function pintarFundo(canvas: HTMLCanvasElement, noite = false) {
  const w = (canvas.width = window.innerWidth);
  const h = (canvas.height = window.innerHeight);
  const g = canvas.getContext('2d')!;
  const ceu = g.createLinearGradient(0, 0, 0, h);
  if (noite) {
    ceu.addColorStop(0, '#0c1424'); ceu.addColorStop(0.6, '#25304a'); ceu.addColorStop(1, '#3a3a40');
  } else {
    ceu.addColorStop(0, '#7fb2d8'); ceu.addColorStop(0.55, '#cfe0e4'); ceu.addColorStop(0.62, '#efe0b8'); ceu.addColorStop(1, '#a8b878');
  }
  g.fillStyle = ceu;
  g.fillRect(0, 0, w, h);
  const colina = (base: number, amp: number, cor: string, fase: number) => {
    g.fillStyle = cor;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * base - Math.sin(x / w * 5 + fase) * amp - Math.sin(x / w * 13 + fase * 2) * amp * 0.3);
    g.lineTo(w, h);
    g.fill();
  };
  colina(0.62, h * 0.05, noite ? '#26302a' : '#9cb07a', 0.3);
  colina(0.72, h * 0.05, noite ? '#1d2620' : '#7d9a55', 1.7);
  colina(0.86, h * 0.04, noite ? '#151c16' : '#5c7d3b', 2.9);
  for (let i = 0; i < 26; i++) {
    const x = (i * 97.3) % w;
    const y = h * (0.66 + ((i * 37) % 20) / 100);
    const r = 14 + ((i * 13) % 18);
    g.fillStyle = noite ? '#101812' : i % 2 ? '#4f7a33' : '#5e8a3c';
    g.beginPath();
    g.arc(x, y - r, r, 0, Math.PI * 2);
    g.fill();
  }
  // a arca em construção (silhueta)
  g.fillStyle = noite ? '#1a140e' : '#8a6a44';
  g.fillRect(w * 0.58, h * 0.6, w * 0.22, h * 0.06);
  g.fillStyle = noite ? '#120d09' : '#6d5233';
  for (let i = 0; i < 9; i++) g.fillRect(w * 0.585 + i * w * 0.024, h * 0.52, w * 0.006, h * 0.08);
}

export async function labUI(canvas: HTMLCanvasElement, raiz: HTMLDivElement) {
  const P = new URLSearchParams(location.search);
  const tela = P.get('tela') ?? '';
  await carregarBiblia();
  pintarFundo(canvas, tela === 'prova' && P.get('tipo') === 'duvida');
  const ui: UI = new UI(raiz, servicosBiblia({ nomes: NOMES, classes: CLASSES_P }), {
    novoJogo: () => ui.aviso('Novo jogo (callback).', 'info'),
    continuar: () => ui.aviso('Continuar (callback).', 'info'),
    listarSlots: () => SLOTS,
    salvar: (s) => ui.aviso(`Salvar no espaço ${s} (callback).`, 'info'),
    carregar: (s) => ui.aviso(`Carregar o espaço ${s} (callback).`, 'info'),
    exportar: (s) => ui.aviso(`Exportar o espaço ${s} (callback).`, 'info'),
    importar: (f, s) => ui.aviso(`Importar ${f.name} para ${s} (callback).`, 'info'),
    sairParaTitulo: () => undefined,
    leitura: (seg, c) => console.log(`leitura: ${seg} s em ${c.livro} ${c.capitulo}`),
  });
  (window as unknown as { ui: UI }).ui = ui;
  ui.atalhosGlobais = true;
  ui.pausarAoSoltarPonteiro = false;
  if (P.has('rapido')) ui.dialogoC.velocidade = 0;
  ui.atualizarDiario(DIARIO);

  // câmera simulada para os marcadores: no estaleiro, olhando para o norte-nordeste
  const cam = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
  const yaw = -0.35;
  cam.position.set(0, 1.7, 0);
  cam.rotation.set(-0.05, yaw, 0, 'YXZ');
  const foco = new THREE.Vector3(0, 0, -4);
  ui.definirCamera(cam, foco);
  const marcadores: MarcadorTela[] = [
    { id: 'guincho', pos: new THREE.Vector3(9, 2, -38), rotulo: 'Guincho', tipo: 'objetivo' },
    { id: 'cam', pos: new THREE.Vector3(-14, 1.6, -22), rotulo: 'Cam', tipo: 'personagem' },
    { id: 'andaime', pos: new THREE.Vector3(60, 3, 10), rotulo: 'Andaime', tipo: 'interativo' },
  ];
  const mostrarHUD = (estado: Partial<EstadoHUD> = {}) => {
    ui.hud({ ...HUD_NOE, ...estado });
    ui.marcadores(marcadores, yaw);
    ui.objetivo('A2 — A viga mestra', 'Coloque Cam no guincho, troque para Jafé e suba o andaime.');
  };
  const versiculo = (ref: string) => {
    const t = ui.servicos.versiculo(ref);
    return { ref, referenciaExtenso: t.extenso, bkj: t.texto, nvt: t.nvt, kjv: t.kjv };
  };

  let atraso = 400;
  switch (tela) {
    case 'hud': {
      mostrarHUD();
      const pode = P.get('dica') !== '1';
      ui.prompt(pode
        ? { texto: 'Cortar a árvore', tecla: 'E', pode: true, progresso: 0.6 }
        : { texto: 'Escalar o andaime', tecla: 'E', pode: false, dica: 'Jafé pode escalar isto' });
      ui.bannerVersiculo(versiculo('Hb 11:7'));
      ui.aviso('+30 XP — Construir e restaurar', 'xp');
      ui.aviso('Força +1 (Noé)', 'atributo');
      ui.fps(58);
      ui.definirConfiguracoes({ mostrarFPS: true });
      atraso = 1200;
      break;
    }
    case 'dialogo': {
      mostrarHUD();
      const i = Number(P.get('linha') ?? 0);
      void ui.dialogo(DIALOGO.slice(i));
      atraso = P.has('rapido') ? 500 : 3500;
      break;
    }
    case 'escolha': {
      ui.hud({ ...HUD_NOE, nome: 'Abrão', classe: 'profeta', era: 'abraao', hora: 16 });
      const sab = Number(P.get('sab') ?? 7);
      void ui.escolha({ quem: 'narrador', texto: 'Os pastores param de discutir e esperam a palavra de Abrão.' }, ESCOLHA,
        (o) => !o.requer || (o.requer.atributo === 'sabedoria' ? sab : 5) >= o.requer.minimo);
      break;
    }
    case 'diario':
      mostrarHUD();
      if (P.get('ler')) ui.abrirLeitura('Gn', Number(P.get('ler')));
      else ui.abrirDiario((P.get('aba') as never) ?? 'missoes');
      break;
    case 'entender':
      mostrarHUD();
      ui.abrirDiario('escrituras');
      ui.entender(P.get('ref') ?? 'Gn 9:13');
      if (P.has('kjv')) (raiz.querySelector('details.kjv') as HTMLDetailsElement | null)?.setAttribute('open', '');
      break;
    case 'roda': {
      mostrarHUD();
      void ui.rodaPersonagens(RODA).then((id) => ui.aviso(id ? `Trocar para ${NOMES[id]}` : 'Roda fechada', 'info'));
      requestAnimationFrame(() => window.dispatchEvent(new MouseEvent('mousemove', { clientX: window.innerWidth / 2 + 160, clientY: window.innerHeight / 2 + 20 })));
      break;
    }
    case 'titulo':
      ui.abrirTitulo({ podeContinuar: true });
      atraso = 900;
      break;
    case 'pausa':
      mostrarHUD();
      ui.abrirPausa();
      break;
    case 'config':
      mostrarHUD();
      ui.abrirPausa();
      ui.abrirMenu('config');
      break;
    case 'slots':
      mostrarHUD();
      ui.abrirPausa();
      ui.abrirMenu(P.get('modo') === 'salvar' ? 'salvar' : 'carregar');
      break;
    case 'creditos':
      ui.abrirTitulo({ podeContinuar: true });
      ui.abrirMenu('creditos');
      break;
    case 'prova':
      mostrarHUD({ dominio: 60 });
      provaDemo(ui, P.get('tipo') === 'duvida');
      atraso = 1200;
      break;
    case 'avisos':
      mostrarHUD();
      ui.aviso('+60 XP — Cooperação', 'xp');
      ui.aviso('Perseverança +1 (Noé)', 'atributo');
      ui.aviso('Memória guardada: Achou graça', 'memoria');
      ui.aviso('Espada do Espírito — a Palavra', 'armadura');
      ui.aviso('Noé chegou ao nível 3', 'nivel');
      ui.aviso('Unidade +6', 'unidade');
      ui.dica('Pressione **Tab** (segure) ou **2** para trocar de personagem. Cada um tem sua força.');
      ui.bannerVersiculo(versiculo('Ec 4:9'));
      ui.legendaTroca('Sem — alimentando os animais');
      atraso = 1300;
      break;
    case 'capitulo':
      ui.hud({ ...HUD_NOE, visivel: false });
      ui.modoCinema(true);
      ui.avisosC.tituloFixo('Era 1 — Noé', 'Gênesis 6–9');
      atraso = 1500;
      break;
    case 'carregamento':
      ui.carregamento({ progresso: 0.62, texto: 'Erguendo o vale de Noé…' });
      break;
    case 'genealogia':
      ui.modoCinema(true);
      ['Sem', 'Arfaxade', 'Selá', 'Éber', 'Pelegue'].forEach((n, i) => setTimeout(() => ui.genealogia(n, i), i * 350));
      atraso = 2200;
      break;
    default:
      mostrarHUD();
      barraDeTeste(ui, versiculo);
  }

  // Tab segurado abre a roda (no jogo, quem faz isso é o módulo de troca)
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Tab' || e.repeat || ui.bloqueado()) return;
    e.preventDefault();
    void ui.rodaPersonagens(RODA).then((id) => id && ui.aviso(`Trocar para ${NOMES[id]}`, 'info'));
  });
  // os testes de navegador mandam avisos e dicas depois de pronto (e2e/teste-avisos.mjs)
  (window as unknown as { ui: UI }).ui = ui;
  setTimeout(() => ((window as unknown as { pronto: boolean }).pronto = true), atraso);
}

function provaDemo(ui: UI, duvida: boolean) {
  const gn618 = ui.servicos.versiculo('Gn 6:18').texto.split(';')[0];
  const estado: EstadoProvaUI = duvida
    ? {
        tipo: 'duvida', titulo: 'Conta as estrelas', instrucao: 'Lembre-se do que Deus já fez: cada memória acende estrelas.',
        progresso: 0.45, firmeza: 0.55, escudo: true, palavra: null,
        dardos: [
          { id: 1, x: 0.24, y: 0.36, texto: 'Você é velho demais.', bloqueado: false },
          { id: 2, x: 0.7, y: 0.58, texto: 'Sarai é estéril. Promessas são só palavras.', bloqueado: false },
        ],
        memorias: [
          { id: 'arcoIris', titulo: 'O sinal da aliança', usada: true },
          { id: 'pacto', titulo: 'Contigo estabelecerei o meu pacto', usada: false, tecla: 1 },
          { id: 'graca', titulo: 'Achou graça', usada: false, tecla: 2 },
          { id: 'chamado', titulo: 'O chamado', usada: false, tecla: 3 },
        ],
        mensagem: 'Deus cumpriu a aliança com Noé. Ele cumprirá com você.',
      }
    : {
        tipo: 'tentacao', titulo: 'O sussurro na torre', instrucao: 'Responda às mentiras com a Palavra (Q) antes que alcancem Noé.',
        progresso: 0.4, firmeza: 0.62, escudo: false,
        palavra: { ref: 'Gn 6:18', texto: gn618, pronta: true },
        dardos: [
          { id: 1, x: 0.2, y: 0.3, texto: 'Desista. Ninguém te ouve.', bloqueado: false },
          { id: 2, x: 0.78, y: 0.36, texto: 'Fique na cidade. Aproveite como todos.', bloqueado: false },
          { id: 3, x: 0.36, y: 0.62, texto: 'Deus te esqueceu nesse vale.', bloqueado: false },
          { id: 4, x: 0.66, y: 0.66, texto: 'Para que tanto trabalho?', bloqueado: true },
        ],
      };
  ui.prova(estado);
  // movimento simples dos dardos em direção ao centro
  let t0 = performance.now();
  const passo = () => {
    const t = (performance.now() - t0) / 1000;
    if (t > 1.0 && !document.hidden) {
      for (const d of estado.dardos) {
        if (d.bloqueado) continue;
        d.x += (0.5 - d.x) * 0.004;
        d.y += (0.5 - d.y) * 0.004;
      }
      if (t > 12) {
        t0 = performance.now();
        estado.dardos = estado.dardos.map((d, i) => ({ ...d, id: d.id + 10, x: [0.2, 0.78, 0.36, 0.66][i] ?? 0.3, y: [0.3, 0.36, 0.62, 0.66][i] ?? 0.3 }));
      }
    }
    ui.prova(estado);
    requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

function barraDeTeste(ui: UI, versiculo: (ref: string) => { ref: string; referenciaExtenso: string; bkj: string; nvt: string | null; kjv: string | null }) {
  const barra = document.createElement('div');
  barra.style.cssText = 'position:fixed;left:50%;bottom:0.6rem;transform:translateX(-50%);z-index:0;display:flex;flex-wrap:wrap;gap:0.3rem;justify-content:center;max-width:90vw;font:600 12px Nunito,sans-serif';
  const b = (t: string, f: () => void) => {
    const x = document.createElement('button');
    x.textContent = t;
    x.style.cssText = 'padding:0.3rem 0.6rem;border-radius:999px;border:1px solid #b48f57;background:#f8f0dc;cursor:pointer';
    x.onclick = f;
    barra.append(x);
  };
  b('Diálogo', () => void ui.dialogo(DIALOGO));
  b('Escolha', () => void ui.escolha({ quem: 'narrador', texto: 'Os pastores esperam a palavra de Abrão.' }, ESCOLHA, (o) => !o.requer || o.requer.minimo <= 6)
    .then((i) => ui.aviso(`Escolheu a opção ${i + 1}`, 'info')));
  b('Diário', () => ui.abrirDiario());
  b('Entender', () => ui.entender('Jo 10:9'));
  b('Roda', () => void ui.rodaPersonagens(RODA).then((id) => ui.aviso(id ? `Trocar para ${NOMES[id]}` : 'Roda fechada', 'info')));
  b('Título', () => ui.abrirTitulo({ podeContinuar: true }));
  b('Pausa', () => ui.abrirPausa());
  b('Prova', () => provaDemo(ui, false));
  b('Dúvida', () => provaDemo(ui, true));
  b('Fim da prova', () => ui.prova(null));
  b('Avisos', () => {
    ui.aviso('+60 XP — Cooperação', 'xp');
    ui.aviso('Memória guardada: O sinal da aliança', 'memoria');
    ui.dica('Coloque Cam no **guincho**, troque para Jafé e suba o andaime.');
  });
  b('Versículo', () => ui.bannerVersiculo(versiculo('Gn 9:13')));
  b('Título de capítulo', () => void ui.titulo('Era 1 — Noé', 'Gênesis 6–9'));
  b('Fade', async () => {
    await ui.fade(true, 0.8);
    await ui.titulo('Anos depois…');
    await ui.fade(false, 0.8);
  });
  b('Cinema', () => ui.modoCinema(!ui.raiz.classList.contains('em-cinema')));
  b('Prompt', () => {
    let p = 0;
    const id = setInterval(() => {
      p += 0.02;
      ui.prompt({ texto: 'Cortar a árvore', tecla: 'E', pode: true, progresso: p });
      if (p >= 1) {
        clearInterval(id);
        ui.prompt({ texto: 'Escalar o andaime', tecla: 'E', pode: false, dica: 'Jafé pode escalar isto' });
        setTimeout(() => ui.prompt(null), 2500);
      }
    }, 30);
  });
  b('Carregamento', () => {
    let p = 0;
    const id = setInterval(() => {
      p += 0.05;
      ui.carregamento({ progresso: p, texto: 'Erguendo o vale de Noé…' });
      if (p >= 1) {
        clearInterval(id);
        ui.carregamento(null);
      }
    }, 80);
  });
  document.body.append(barra);
}
