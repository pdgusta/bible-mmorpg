import { CameraTroca } from '../camera/CameraTroca';
import { CLASSES } from './Classes';
import type { Jogo } from './Jogo';
import type { Personagem } from './Personagem';
import type { ItemRoda } from './contratos';
import type { Acao } from '../core/Entrada';

const TECLAS_TROCA: Acao[] = ['troca1', 'troca2', 'troca3', 'troca4', 'troca5'];

/**
 * Troca de personagem dentro da era (estilo GTA V): teclas 1–5 na ordem dos jogáveis,
 * Tab (segurar) abre a roda de personagens, bumpers do controle passam ao próximo/anterior.
 * A câmera sobe em três saltos, viaja pelo céu e desce sobre o outro (CameraTroca); o
 * anterior volta à IA (espera onde está, ou rotina) e quem está num posto continua lá.
 */
export class Troca {
  /** Há uma troca acontecendo (a câmera está no céu). */
  emAndamento = false;
  /** Ordem dos jogáveis (teclas 1..5 e roda). Padrão: ordem em que foram criados. */
  ordem: string[] | null = null;
  /** O que o personagem deixado faz: espera onde está (padrão) ou volta à rotina. */
  modoAnterior: 'esperar' | 'rotina' = 'esperar';
  /** Roda de personagens aberta (Tab segurado). */
  rodaAberta = false;
  readonly camera: CameraTroca;
  private promessa: Promise<void> | null = null;
  private tLegenda = 0;
  private legendaFallback: HTMLDivElement | null = null;
  private idRoda = 0;

  constructor(private jogo: Jogo) {
    this.camera = new CameraTroca(jogo.cam, () => jogo.mundo?.fisica ?? null, jogo.canvas);
    this.camera.aoSalto = (fase, i) => jogo.eventos.emit('troca:salto', { fase, i });
  }

  /** Todos os jogáveis do mundo atual, na ordem das teclas (inclui os indisponíveis). */
  jogaveis(): Personagem[] {
    const m = this.jogo.mundo;
    if (!m) return [];
    const todos = [...m.personagens.values()].filter((p) => p.def.jogavel);
    if (!this.ordem) return todos;
    const ord = this.ordem;
    const pos = (p: Personagem) => {
      const i = ord.indexOf(p.id);
      return i < 0 ? ord.length + todos.indexOf(p) : i;
    };
    return todos.sort((a, b) => pos(a) - pos(b));
  }

  /** Jogáveis que podem ser escolhidos agora (inclui o atual). */
  disponiveis(): Personagem[] {
    return this.jogaveis().filter((p) => p.disponivel && !p.emCena);
  }

  /** O que alguém está fazendo, para a roda e a legenda ("cuidando dos animais"). */
  atividadeDe(p: Personagem): string {
    if (p.posto) return p.posto.descricao;
    if (p.escalada) return 'escalando';
    if (p === this.jogo.ativo && p.controlado) return p.atividade || 'com você';
    const o = p.ia.ordem;
    if (o.tipo === 'seguir') return `seguindo ${o.alvo.nome}`;
    if (o.tipo === 'ir') return 'a caminho';
    if (o.tipo === 'esperar') return 'esperando';
    return p.atividade || 'descansando';
  }

  itensRoda(): ItemRoda[] {
    const ativo = this.jogo.ativo;
    return this.jogaveis().map((p, i) => ({
      id: p.id,
      nome: p.nome,
      classe: p.nomeClasse,
      icone: p.classe ? CLASSES[p.classe].icone : '',
      atividade: this.atividadeDe(p),
      disponivel: p.disponivel && !p.emCena,
      atual: p === ativo,
      tecla: i + 1,
    }));
  }

  /**
   * Troca o personagem controlado. Resolve quando a câmera pousa e o controle passa ao outro
   * (ou na hora, sem fazer nada, se a troca não for possível agora).
   */
  trocarPara(id: string): Promise<void> {
    if (this.promessa) return this.promessa;
    const j = this.jogo;
    const de = j.ativo;
    const para = j.mundo?.personagens.get(id);
    if (!para || !para.def.jogavel || para === de) return Promise.resolve();
    if (!j.podeTrocar) return Promise.resolve();
    if (!para.disponivel || para.emCena) {
      j.ui?.aviso(`${para.nome} não está disponível agora.`, 'info');
      return Promise.resolve();
    }
    if (!de) {
      j.controlar(para);
      j.cam.encaixar(para.posicao, para.yaw, j.mundo?.fisica);
      return Promise.resolve();
    }
    this.emAndamento = true;
    this.fecharRoda();
    j.controle.reiniciar();
    j.eventos.emit('troca:inicio', { de: de.id, para: para.id });
    // quem fica volta à IA já na subida da câmera (o posto e a escalada seguem como estão)
    de.controlado = false;
    if (!de.posto && !de.escalada) {
      if (this.modoAnterior === 'rotina') de.ia.voltarARotina();
      else de.ia.esperar();
    }
    this.camera.aoFase = (fase) => {
      if (fase === 'descida') this.legenda(`${para.nome} — ${this.atividadeDe(para)}`);
    };
    // pousa atrás do personagem; num posto ou escalando, atrás de para onde ele olha
    const yawFinal = para.yaw + Math.PI;
    this.promessa = this.camera.iniciar({
      de: () => de.posicao,
      para: () => para.posicao,
      yawFinal,
      aoPousar: () => {
        j.controlar(para, { anterior: 'manter' });
        this.emAndamento = false;
        this.promessa = null;
        this.tLegenda = 2;
        j.eventos.emit('troca:fim', { de: de.id, para: para.id });
      },
    });
    return this.promessa;
  }

  private legenda(texto: string | null) {
    const ui = this.jogo.ui;
    if (ui) {
      ui.legendaTroca(texto);
      return;
    }
    // sem UI (testes, laboratório): uma legenda mínima
    if (!this.legendaFallback) {
      if (!texto) return;
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;right:0;bottom:16%;text-align:center;color:#f4efe4;font:600 22px/1.3 Georgia,serif;text-shadow:0 2px 8px #000a;pointer-events:none;transition:opacity .4s';
      document.body.appendChild(d);
      this.legendaFallback = d;
    }
    this.legendaFallback.textContent = texto ?? '';
    this.legendaFallback.style.opacity = texto ? '1' : '0';
  }

  private abrirRoda() {
    const j = this.jogo;
    if (this.rodaAberta || !j.podeTrocar || this.jogaveis().length < 2) return;
    this.rodaAberta = true;
    j.escalaTempo = 0.25;
    const ui = j.ui;
    if (!ui) return;
    const n = ++this.idRoda;
    ui.rodaPersonagens(this.itensRoda()).then((id) => {
      if (n !== this.idRoda) return;
      this.rodaAberta = false;
      j.escalaTempo = 1;
      if (id && id !== j.ativo?.id) void this.trocarPara(id);
    }, () => {
      if (n === this.idRoda) this.fecharRoda();
    });
  }

  private fecharRoda() {
    if (!this.rodaAberta) return;
    this.rodaAberta = false;
    this.jogo.escalaTempo = 1;
    this.jogo.ui?.fecharRoda();
  }

  /** Passa ao próximo (ou anterior) disponível na ordem dos jogáveis. */
  ciclar(passo: 1 | -1) {
    const lista = this.disponiveis();
    const a = this.jogo.ativo;
    if (lista.length < 2 || !a) return;
    const i = lista.indexOf(a);
    const prox = lista[(i + passo + lista.length) % lista.length];
    void this.trocarPara(prox.id);
  }

  /** Chamado a cada quadro pelo Jogo: teclas de troca, roda e legenda. */
  atualizar(dt: number) {
    const j = this.jogo;
    const e = j.entrada;
    if (this.tLegenda > 0) {
      this.tLegenda -= dt / Math.max(0.05, j.escalaTempo);
      if (this.tLegenda <= 0) this.legenda(null);
    }
    if (this.emAndamento) return;
    if (this.rodaAberta && !j.podeTrocar) {
      this.fecharRoda();
      return;
    }
    // teclas 1–5: posição fixa na ordem dos jogáveis
    for (let i = 0; i < TECLAS_TROCA.length; i++) {
      if (!e.pressionou(TECLAS_TROCA[i])) continue;
      const alvo = this.jogaveis()[i];
      if (this.rodaAberta) {
        // escolher pela tecla com a roda aberta: fecha a roda (a UI resolve com o destacado,
        // que ignoramos) e troca direto
        this.idRoda++;
        this.fecharRoda();
      }
      if (alvo) void this.trocarPara(alvo.id);
      return;
    }
    if (e.pressionou('trocaProx')) this.ciclar(1);
    else if (e.pressionou('trocaAnt')) this.ciclar(-1);
    if (e.pressionou('roda')) this.abrirRoda();
    if (this.rodaAberta && (e.soltou('roda') || !e.ativa('roda'))) {
      if (j.ui) {
        // a UI resolve a promessa de rodaPersonagens com o item destacado
        j.ui.fecharRoda();
        this.rodaAberta = false;
        j.escalaTempo = 1;
      } else {
        // sem UI: soltar o Tab passa ao próximo disponível
        this.rodaAberta = false;
        j.escalaTempo = 1;
        this.ciclar(1);
      }
    }
  }
}
