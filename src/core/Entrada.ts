// Entrada de teclado, mouse (pointer lock) e controle (gamepad), traduzida em ações do jogo.

export type Acao =
  | 'frente' | 'tras' | 'esquerda' | 'direita' | 'correr' | 'pular' | 'agachar'
  | 'interagir' | 'habilidade' | 'orar' | 'comando' | 'roda' | 'acao' | 'escudo'
  | 'diario' | 'mapa' | 'pausa' | 'ajuda' | 'discernir'
  | 'troca1' | 'troca2' | 'troca3' | 'troca4' | 'troca5' | 'trocaProx' | 'trocaAnt';

const TECLAS: Record<string, Acao> = {
  KeyW: 'frente', ArrowUp: 'frente', KeyS: 'tras', ArrowDown: 'tras',
  KeyA: 'esquerda', ArrowLeft: 'esquerda', KeyD: 'direita', ArrowRight: 'direita',
  ShiftLeft: 'correr', ShiftRight: 'correr', Space: 'pular', ControlLeft: 'agachar', KeyC: 'agachar',
  KeyE: 'interagir', KeyQ: 'habilidade', KeyR: 'orar', KeyF: 'comando', Tab: 'roda',
  KeyJ: 'diario', KeyM: 'mapa', Escape: 'pausa', KeyH: 'ajuda', KeyV: 'discernir',
  Digit1: 'troca1', Digit2: 'troca2', Digit3: 'troca3', Digit4: 'troca4', Digit5: 'troca5',
};

export class Entrada {
  private ativas = new Set<Acao>();
  private pressionadasAgora = new Set<Acao>();
  private soltasAgora = new Set<Acao>();
  mouseDX = 0;
  mouseDY = 0;
  roda = 0;
  mouseX = 0;
  mouseY = 0;
  travado = false;
  /** Quando falso (menus/diálogos), o jogo ignora movimento; UI ainda recebe teclas. */
  habilitada = true;
  private padAnterior = new Set<Acao>();
  eixoMovX = 0;
  eixoMovY = 0;
  eixoCamX = 0;
  eixoCamY = 0;
  usandoControle = false;
  /** Permite que a UI capture o clique e não trave o ponteiro. */
  podeTravar = () => true;

  constructor(alvo: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      const a = TECLAS[e.code];
      if (!a) return;
      if (a === 'roda' || a === 'pausa' || e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      this.usandoControle = false;
      if (!this.ativas.has(a)) this.pressionadasAgora.add(a);
      this.ativas.add(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = TECLAS[e.code];
      if (!a) return;
      this.ativas.delete(a);
      this.soltasAgora.add(a);
    });
    window.addEventListener('blur', () => {
      for (const a of this.ativas) this.soltasAgora.add(a);
      this.ativas.clear();
    });
    alvo.addEventListener('mousedown', (e) => {
      if (!this.travado && this.podeTravar()) {
        alvo.requestPointerLock?.();
        return;
      }
      const a: Acao | null = e.button === 0 ? 'acao' : e.button === 2 ? 'escudo' : null;
      if (a) {
        this.pressionadasAgora.add(a);
        this.ativas.add(a);
      }
    });
    window.addEventListener('mouseup', (e) => {
      const a: Acao | null = e.button === 0 ? 'acao' : e.button === 2 ? 'escudo' : null;
      if (a) {
        this.ativas.delete(a);
        this.soltasAgora.add(a);
      }
    });
    alvo.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.travado = document.pointerLockElement === alvo;
    });
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (this.travado) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    alvo.addEventListener('wheel', (e) => {
      this.roda += Math.sign(e.deltaY);
    }, { passive: true });
  }

  liberarPonteiro() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  ativa(a: Acao): boolean {
    return this.ativas.has(a);
  }
  pressionou(a: Acao): boolean {
    return this.pressionadasAgora.has(a);
  }
  soltou(a: Acao): boolean {
    return this.soltasAgora.has(a);
  }
  /** Simula uma ação (usado pelos testes automáticos e pela UI). */
  simular(a: Acao, ativo: boolean) {
    if (ativo) {
      if (!this.ativas.has(a)) this.pressionadasAgora.add(a);
      this.ativas.add(a);
    } else {
      this.ativas.delete(a);
      this.soltasAgora.add(a);
    }
  }

  /** Lê o controle (se houver) uma vez por quadro, antes da lógica do jogo. */
  lerControle() {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = [...pads].find((p) => p && p.connected);
    this.eixoMovX = this.eixoMovY = this.eixoCamX = this.eixoCamY = 0;
    if (!pad) return;
    const zona = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
    this.eixoMovX = zona(pad.axes[0] ?? 0);
    this.eixoMovY = zona(pad.axes[1] ?? 0);
    this.eixoCamX = zona(pad.axes[2] ?? 0);
    this.eixoCamY = zona(pad.axes[3] ?? 0);
    const b = (i: number) => !!pad.buttons[i]?.pressed;
    const mapa: [Acao, boolean][] = [
      ['pular', b(0)], ['interagir', b(2)], ['agachar', b(1)], ['habilidade', b(3)],
      ['trocaAnt', b(4)], ['trocaProx', b(5)], ['escudo', b(6)], ['acao', b(7)],
      ['pausa', b(9)], ['diario', b(8)], ['correr', b(10)], ['roda', b(13)], ['orar', b(12)],
    ];
    const agora = new Set<Acao>();
    for (const [a, v] of mapa) if (v) agora.add(a);
    if (agora.size || this.eixoMovX || this.eixoMovY) this.usandoControle = true;
    for (const a of agora) if (!this.padAnterior.has(a)) { this.pressionadasAgora.add(a); this.ativas.add(a); }
    for (const a of this.padAnterior) if (!agora.has(a)) { this.ativas.delete(a); this.soltasAgora.add(a); }
    this.padAnterior = agora;
  }

  /** Chamado no fim de cada quadro. */
  fimDoQuadro() {
    this.pressionadasAgora.clear();
    this.soltasAgora.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.roda = 0;
  }
}
