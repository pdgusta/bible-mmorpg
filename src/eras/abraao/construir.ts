import * as THREE from 'three';
import { Mundo } from '../../mundo/Mundo';
import type { Colisor, OpcoesColisor } from '../../mundo/Colisao';
import { espalhar } from '../../mundo/Espalhar';
import { Construtor, CORES } from '../../entidades/Construtor';
import { distPolilinha, type Ponto2 } from '../../mundo/Relevo';
import { aplicarPatch } from '../../render/Shaders';
import { Aleatorio } from '../../core/aleatorio';
import { smoothstep } from '../../core/util';
import type { Personagem } from '../../jogo/Personagem';
import {
  MAPA_CANAA, CANAA, MORIA, ROTA_MORIA, RIO_JORDAO, TRILHAS, CURRAIS, ACAMPAMENTOS, ROTAS_FLANCO,
  localCurral, ligarRelevo, terreno, distTrilha, fatorRaioMoria, type TerrenoCanaa, type DefCurral,
} from './mapa';
import {
  CORES_CANAA, Fogueiras, Porteira, aldeia, alforje, casaPedra, cavaleteLancas, cercadoCativos, cocho,
  despojos, marcoMirante, muroPedra, pedraMemorial, tear, tendaDesmontada, tendaPelos, utensilios,
} from './estruturas';

export type LugarAcampamento = 'betel' | 'manre';
export type NomeTenda = 'tendaAbrao' | 'tendaSara';
export type NomePorteira = 'porteiraAbrao' | 'porteiraLo';
export type NomeCurral = 'curralAbrao' | 'curralLo';
export type NomeAltar = 'altarMore' | 'altarBetel' | 'altarManre' | 'altarMoria';
export type EstadoAltar = 'oculto' | 'construido' | 'aceso';

export const ALTARES: NomeAltar[] = ['altarMore', 'altarBetel', 'altarManre', 'altarMoria'];

/** Uma peça que aparece e some (malha + colisores). */
interface Peca {
  malha: THREE.Object3D | null;
  colisores: Colisor[];
}

interface Acampamento {
  servos: Peca;
  tendas: Record<NomeTenda, { montada: Peca; desmontada: Peca }>;
  fogo: number;
}

/** Pedra do fosso do Moriá (Gn 22, trecho 2 da subida). `firme` = pisável; as soltas não têm chão. */
export interface PedraFosso {
  x: number;
  y: number;
  z: number;
  firme: boolean;
}

/**
 * Mundo da era de Abraão: Canaã com as peças que mudam ao longo da história.
 *
 * Tudo é construído no construtor (como `MundoNoe`). Estado inicial: acampamento em Betel com as
 * tendas montadas, porteiras fechadas, altares ocultos, acampamento inimigo oculto, corda solta.
 *
 * API:
 * - `definirAcampamento('betel' | 'manre' | null)`: mostra as tendas de Abrão no lugar certo e
 *   atualiza os pontos dinâmicos 'acampamento', 'tendaAbrao', 'tendaSara', 'fogueiraAcampamento'.
 * - `montarTenda('tendaAbrao' | 'tendaSara', montada)`: B1 (montar em dupla).
 * - `abrirPorteira('porteiraAbrao' | 'porteiraLo', aberta)`, `porteiraAberta(nome)`,
 *   `dentroCurral('curralAbrao' | 'curralLo', x, z)`: B2.
 * - `definirAltar(nome, 'oculto' | 'construido' | 'aceso')`: altares de Moré, Betel, Manre e Moriá.
 * - `definirAcampamentoInimigo(visivel)`: B3 (tendas, fogueiras, cativos e despojos em Dã).
 * - `amarrarCordaMoria(sim)`: mostra a corda e ativa a escalada 'cordaMoria' (B5).
 * - `revelarPedras(0..1)`: pedras firmes em dourado, soltas em vermelho (discernir, B5).
 *   Cair no fosso devolve o personagem ativo ao 'estreitoMoria' e chama `aoCairFosso`.
 * - `ceu`: ligue a `jogo.ceu` para as fogueiras brilharem mais à noite (ou use `definirNoite`).
 */
export class MundoCanaa {
  readonly mundo: Mundo;
  readonly terreno: TerrenoCanaa;
  readonly fogueiras = new Fogueiras();
  /** Fonte do fator noite (0..1) das fogueiras; normalmente `jogo.ceu`. */
  ceu: { noite: number } | null = null;
  acampamento: LugarAcampamento | null = null;
  readonly tendasMontadas: Record<NomeTenda, boolean> = { tendaAbrao: true, tendaSara: true };
  inimigoVisivel = false;
  cordaAmarrada = false;
  readonly porteiras = new Map<NomePorteira, Porteira>();
  readonly pedrasMoria: PedraFosso[] = [];
  /** Chamado quando o personagem ativo cai no fosso das pedras soltas (já foi devolvido ao início). */
  aoCairFosso: ((p: Personagem) => void) | null = null;

  private noiteManual = 0;
  private acamps!: Record<LugarAcampamento, Acampamento>;
  private altares = new Map<NomeAltar, { peca: Peca; fogo: number; estado: EstadoAltar }>();
  private inimigo: { peca: Peca; fogos: number[] } = { peca: { malha: null, colisores: [] }, fogos: [] };
  private corda: Peca = { malha: null, colisores: [] };
  private matFirmes = materialPedras();
  private matSoltas = materialPedras();

  constructor(cenaNatureza: THREE.Object3D) {
    this.mundo = new Mundo(MAPA_CANAA, cenaNatureza);
    const m = this.mundo;
    ligarRelevo(m.relevo);
    this.terreno = terreno(m.ruido);
    definirVariantes(m);
    vegetacao(m, this.terreno);
    construirMore(m, this.fogueiras);
    construirAldeias(m, this.fogueiras);
    this.acamps = { betel: this.construirAcampamento('betel'), manre: this.construirAcampamento('manre') };
    this.construirPastos();
    construirMirantes(m);
    construirManre(m, this.fogueiras);
    construirSalem(m);
    construirSodoma(m, this.fogueiras);
    this.construirInimigo();
    this.construirMoria();
    construirSegredos(m);
    this.construirAltares();
    // fogueiras: 3 draw calls para todas (e 2 luzes que seguem o foco)
    this.fogueiras.construir();
    m.estruturas.add(this.fogueiras.grupo);
    m.aoAtualizar.add((dt, t, _camera, foco) => {
      this.fogueiras.noite = this.ceu ? this.ceu.noite : this.noiteManual;
      this.fogueiras.focar(foco);
      this.fogueiras.atualizar(dt, t);
    });
    // estado inicial (antes da navegação, para ela já nascer certa)
    this.definirAcampamento('betel');
    this.definirAcampamentoInimigo(false);
    for (const a of ALTARES) this.definirAltar(a, 'oculto');
    m.finalizar();
  }

  // ------------------------------------------------------------------ API

  definirNoite(n: number) {
    this.noiteManual = n;
  }

  definirAcampamento(lugar: LugarAcampamento | null) {
    this.acampamento = lugar;
    for (const k of ['betel', 'manre'] as LugarAcampamento[]) {
      const a = this.acamps[k];
      const vis = k === lugar;
      mostrar(a.servos, vis);
      this.fogueiras.ativar(a.fogo, vis);
      for (const t of ['tendaAbrao', 'tendaSara'] as NomeTenda[]) {
        mostrar(a.tendas[t].montada, vis && this.tendasMontadas[t]);
        mostrar(a.tendas[t].desmontada, vis && !this.tendasMontadas[t]);
      }
    }
    const def = ACAMPAMENTOS[lugar ?? 'betel'];
    const p = this.mundo.pontos;
    p.set('acampamento', def.centro);
    p.set('tendaAbrao', def.tendaAbrao.pos);
    p.set('tendaSara', def.tendaSara.pos);
    p.set('fogueiraAcampamento', def.fogueira);
    for (const k of ['betel', 'manre'] as LugarAcampamento[]) this.refazerNav(ACAMPAMENTOS[k].centro, 26);
  }

  montarTenda(nome: NomeTenda, montada: boolean) {
    this.tendasMontadas[nome] = montada;
    if (this.acampamento) this.definirAcampamento(this.acampamento);
  }

  abrirPorteira(nome: NomePorteira, aberta: boolean, instantaneo = false) {
    this.porteiras.get(nome)?.definir(aberta, instantaneo);
  }

  porteiraAberta(nome: NomePorteira) {
    return this.porteiras.get(nome)?.aberta ?? false;
  }

  /** O ponto está dentro do curral (com folga de 0,3 m das cercas)? */
  dentroCurral(nome: NomeCurral, x: number, z: number) {
    const c = CURRAIS[nome];
    const dx = x - c.centro[0];
    const dz = z - c.centro[1];
    const cs = Math.cos(c.yaw);
    const sn = Math.sin(c.yaw);
    const lx = dx * cs - dz * sn;
    const lz = dx * sn + dz * cs;
    return Math.abs(lx) < c.w / 2 - 0.3 && Math.abs(lz) < c.d / 2 - 0.3;
  }

  definirAltar(nome: NomeAltar, estado: EstadoAltar) {
    const a = this.altares.get(nome);
    if (!a) return;
    a.estado = estado;
    mostrar(a.peca, estado !== 'oculto');
    this.fogueiras.ativar(a.fogo, estado === 'aceso');
    const [x, z] = this.mundo.ponto(nome);
    this.refazerNav([x, z], 4);
  }

  estadoAltar(nome: NomeAltar): EstadoAltar {
    return this.altares.get(nome)?.estado ?? 'oculto';
  }

  definirAcampamentoInimigo(visivel: boolean) {
    this.inimigoVisivel = visivel;
    mostrar(this.inimigo.peca, visivel);
    for (const f of this.inimigo.fogos) this.fogueiras.ativar(f, visivel);
    this.refazerNav(CANAA.valeDa, 34);
  }

  amarrarCordaMoria(sim: boolean) {
    this.cordaAmarrada = sim;
    mostrar(this.corda, sim);
    const e = this.mundo.escaladas.get('cordaMoria');
    if (e) e.ativa = sim;
  }

  /** Discernir no fosso: 0 = normal, 1 = firmes douradas e soltas vermelhas. */
  revelarPedras(t: number) {
    this.matFirmes.emissive.set('#ffc24a').multiplyScalar(0.75 * t);
    this.matSoltas.emissive.set('#ff3a20').multiplyScalar(0.75 * t);
  }

  private refazerNav(c: Ponto2, r: number) {
    const nav = this.mundo.nav as Mundo['nav'] | undefined;
    nav?.reconstruir(c[0] - r, c[1] - r, c[0] + r, c[1] + r);
  }

  // ------------------------------------------------------------------ construção

  private construirAcampamento(lugar: LugarAcampamento): Acampamento {
    const m = this.mundo;
    const def = ACAMPAMENTOS[lugar];
    const r = new Aleatorio(lugar === 'betel' ? 1208 : 1318);
    const servos = zona(m, `acampamento_${lugar}`, lugar === 'betel' ? 121 : 131, (c) => {
      def.servos.forEach((s, i) => {
        em(c, m, s.pos[0], s.pos[1], s.yaw, () => {
          tendaPelos(c, s.w, s.d, s.h, i % 2 ? CORES_CANAA.tendaCabra2 : CORES_CANAA.tendaCabra, i % 2 ? CORES_CANAA.tendaCabra : CORES_CANAA.tendaCabra2);
          c.em(s.w * 0.5 + 0.6, 0, 1.2, 0, () => utensilios(c, r, 3));
        });
      });
      em(c, m, def.fogueira[0], def.fogueira[1], 0, () => {
        c.fogueira();
        for (let i = 0; i < 3; i++) {
          const a = 0.6 + i * 2.1;
          c.cilindro(Math.cos(a) * 2.2, 0.22, Math.sin(a) * 2.2, 0.2, 0.2, 1.5, CORES.madeira, 7, { rz: Math.PI / 2, ry: a + Math.PI / 2 });
        }
        c.em(1.6, 0, -1.5, 0.4, () => c.jarro(0, 0, 1.2, '#4a3a2e'));
      });
      const [cx, cz] = def.centro;
      em(c, m, cx - 4, cz + 8, 0.5, () => alforje(c));
      em(c, m, cx + 6, cz + 7, -0.4, () => alforje(c, '#6a4a3a'));
      em(c, m, cx + 3, cz - 2, 0.2, () => tear(c));
      em(c, m, cx - 7, cz + 3, 0, () => {
        c.caixa(0, 0.01, 0, 2.6, 0.03, 1.8, CORES_CANAA.tapete2, { raio: 0, ao: 0 });
        c.jarro(0.6, 0.3, 1);
        c.saco(-0.7, -0.2, 0.9);
      });
      // estacas de amarrar os animais
      for (let i = 0; i < 4; i++) em(c, m, cx + 10 + i * 1.6, cz + 4 + (i % 2), 0, () => c.cilindro(0, 0, 0, 0.05, 0.06, 0.9, CORES.madeiraEscura, 5));
    });
    const tendas = {} as Acampamento['tendas'];
    for (const t of ['tendaAbrao', 'tendaSara'] as NomeTenda[]) {
      const p = def[t];
      const grande = t === 'tendaAbrao';
      const montada = zona(m, `${t}_${lugar}`, grande ? 7 : 9, (c) => {
        em(c, m, p.pos[0], p.pos[1], p.yaw, () => {
          tendaPelos(c, grande ? 6.6 : 5.6, grande ? 5 : 4.4, grande ? 2.6 : 2.4, grande ? CORES_CANAA.tendaCabra : CORES_CANAA.tendaCabra2, grande ? CORES_CANAA.tendaCabra2 : CORES_CANAA.tendaCabra);
          c.em(-1.2, 0, 0.6, 0, () => utensilios(c, r, 3));
          if (!grande) c.em(2.6, 0, 3.4, 0.3, () => c.jarro(0, 0, 1.3));
        });
      });
      const desmontada = zona(m, `${t}_${lugar}_desmontada`, grande ? 8 : 10, (c) => {
        em(c, m, p.pos[0], p.pos[1], p.yaw, () => tendaDesmontada(c, grande ? 6.6 : 5.6));
      });
      tendas[t] = { montada, desmontada };
    }
    const [fx, fz] = def.fogueira;
    const fogo = this.fogueiras.adicionar(fx, m.relevo.altura(fx, fz) + 0.05, fz, 1);
    return { servos, tendas, fogo };
  }

  private construirPastos() {
    const m = this.mundo;
    const [px, pz] = CANAA.poco;
    zona(m, 'pastos', 1305, (c) => {
      em(c, m, px, pz, 0, () => {
        c.poco();
        c.em(3.2, 0, 1.2, 0.3, () => cocho(c));
        c.em(-3.1, 0, 1.6, -0.4, () => cocho(c));
        c.em(0.2, 0, 3.6, 0, () => cocho(c, 2));
        for (let i = 0; i < 3; i++) c.jarro(-1.6 + i * 0.6, -1.9, 1.1);
      });
      for (const nome of ['curralAbrao', 'curralLo'] as NomeCurral[]) {
        const cur = CURRAIS[nome];
        const y = m.relevo.altura(cur.centro[0], cur.centro[1]);
        c.em(cur.centro[0], y, cur.centro[1], cur.yaw, () => {
          const w = cur.w / 2;
          const d = cur.d / 2;
          const [ax] = cur.dobradica;
          const [bx] = cur.ponta;
          const g0 = Math.min(ax, bx);
          const g1 = Math.max(ax, bx);
          // cerca fechada com um vão na face sul (+z) para a porteira
          c.cerca([[g0, d], [-w, d], [-w, -d], [w, -d], [w, d], [g1, d]], 1.15);
          // abrigo de galhos num canto
          c.em(-w + 1.6, 0, -d + 1.4, 0, () => {
            for (const sx of [-1, 1]) c.cilindro(sx * 1.2, 0, 0, 0.06, 0.07, 1.9, CORES.madeira, 5);
            c.caixa(0, 1.85, 0.2, 2.8, 0.12, 2.2, CORES.palha, { raio: 0.03, rx: 0.12 });
          });
          c.em(w - 1.8, 0, -d + 1, 0, () => cocho(c, 1.8));
        });
      }
    });
    for (const [nome, curral] of [['porteiraAbrao', 'curralAbrao'], ['porteiraLo', 'curralLo']] as [NomePorteira, NomeCurral][]) {
      const cur = CURRAIS[curral];
      this.porteiras.set(nome, criarPorteira(m, nome, cur));
    }
  }

  private construirInimigo() {
    const m = this.mundo;
    const r = new Aleatorio(1415);
    const [cx, cz] = m.ponto('acampamentoInimigo');
    const fogos: number[] = [];
    const peca = zona(m, 'acampamentoInimigo', 1414, (c) => {
      // tendas dos reis do oriente: escuras e avermelhadas, em arco voltadas para o centro
      const angulos = [-2.7, -2.15, -1.55, -0.95, -0.35, 0.3, 2.75];
      angulos.forEach((a, i) => {
        const raio = 14 + (i % 2) * 2.5;
        const x = cx + Math.cos(a) * raio;
        const z = cz + Math.sin(a) * raio;
        const yaw = Math.atan2(cx - x, cz - z);
        em(c, m, x, z, yaw, () => {
          tendaPelos(c, 5.2 + (i % 3) * 0.6, 4.2, 2.3 + (i % 2) * 0.3, i % 2 ? CORES_CANAA.tendaInimiga2 : CORES_CANAA.tendaInimiga, i % 2 ? CORES_CANAA.tendaInimiga : CORES_CANAA.tendaInimiga2, CORES_CANAA.listraInimiga);
          c.em(-2, 0, 2.6, 0, () => utensilios(c, r, 2));
        });
      });
      // a tenda do rei, maior, ao norte
      em(c, m, cx + 2, cz - 19, 0, () => {
        tendaPelos(c, 8, 6, 3.1, '#6a2a26', CORES_CANAA.tendaInimiga, CORES_CANAA.ouro);
        c.cilindro(0, 0, 3.6, 0.05, 0.06, 4.4, CORES.madeiraEscura, 5);
        c.caixa(0.6, 3.5, 3.6, 1.1, 0.7, 0.03, '#a03a2a', { raio: 0, ao: 0 });
      });
      // fogueira central e bancos de troncos
      em(c, m, cx, cz, 0, () => {
        c.fogueira();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.3;
          c.cilindro(Math.cos(a) * 3, 0.2, Math.sin(a) * 3, 0.2, 0.2, 1.6, CORES.madeira, 7, { rz: Math.PI / 2, ry: a + Math.PI / 2 });
        }
      });
      for (const [dx, dz] of [[-11, 6], [11, 5], [-3, -11]] as const) {
        em(c, m, cx + dx, cz + dz, 0, () => c.fogueira());
      }
      // cercado dos cativos e despojos
      const [kx, kz] = m.ponto('cativos');
      em(c, m, kx, kz, 0.1, () => cercadoCativos(c, 7, 5.5));
      const [dx, dz] = m.ponto('despojos');
      em(c, m, dx, dz, -0.2, () => despojos(c, r));
      em(c, m, dx + 4, dz + 5, 0.4, () => despojos(c, r));
      for (const [lx, lz] of [[-6, 9], [8, 10], [15, -4]] as const) em(c, m, cx + lx, cz + lz, 0, () => cavaleteLancas(c));
      // postes de tocha na entrada do acampamento (lado sul)
      for (const s of [-1, 1]) {
        em(c, m, cx + s * 4.5, cz + 20, 0, () => {
          c.cilindro(0, 0, 0, 0.07, 0.09, 2.3, CORES.madeiraEscura, 6);
          c.cilindro(0, 2.25, 0, 0.18, 0.12, 0.22, '#3a2e26', 8);
        });
      }
    });
    const y = (x: number, z: number) => m.relevo.altura(x, z);
    fogos.push(this.fogueiras.adicionar(cx, y(cx, cz) + 0.05, cz, 1.6, false));
    for (const [dx, dz] of [[-11, 6], [11, 5], [-3, -11]] as const) fogos.push(this.fogueiras.adicionar(cx + dx, y(cx + dx, cz + dz) + 0.05, cz + dz, 1.05, false));
    for (const s of [-1, 1]) fogos.push(this.fogueiras.adicionar(cx + s * 4.5, y(cx + s * 4.5, cz + 20) + 2.45, cz + 20, 0.42, false));
    this.inimigo = { peca, fogos };

    // cobertura natural nas rotas dos flancos (sempre presente)
    const rc = new Aleatorio(1416);
    for (const rota of [ROTAS_FLANCO.flancoOeste, ROTAS_FLANCO.flancoLeste]) {
      for (let i = 1; i < rota.length; i++) {
        const [ax, az] = rota[i - 1];
        const [bx, bz] = rota[i];
        const len = Math.hypot(bx - ax, bz - az);
        for (let s = 4; s < len; s += 7) {
          const t = s / len;
          const x = ax + (bx - ax) * t;
          const z = az + (bz - az) * t;
          // do lado voltado para o acampamento
          const nx = cx - x;
          const nz = cz - z;
          const nl = Math.hypot(nx, nz) || 1;
          const ox = x + (nx / nl) * rc.entre(1.8, 2.8);
          const oz = z + (nz / nl) * rc.entre(1.8, 2.8);
          if (rc.chance(0.55)) m.natureza.adicionar('pedra', ox, y(ox, oz) - 0.35, oz, rc.entre(0, 6.28), rc.entre(1.5, 2.3), rc);
          else m.natureza.adicionar('arbusto', ox, y(ox, oz) - 0.1, oz, rc.entre(0, 6.28), rc.entre(1.3, 1.8), rc);
        }
      }
    }
  }

  private construirAltares() {
    const m = this.mundo;
    ALTARES.forEach((nome, i) => {
      const [x, z] = m.ponto(nome);
      const peca = zona(m, nome, 300 + i, (c) => {
        em(c, m, x, z, i * 0.7, () => c.altar(0.95, 1.05, true));
      });
      const fogo = this.fogueiras.adicionar(x, m.relevo.altura(x, z) + 1.2, z, 0.62, false);
      this.altares.set(nome, { peca, fogo, estado: 'oculto' });
    });
  }

  // ---------------------------------------------------------------- Moriá
  private construirMoria() {
    const m = this.mundo;
    const T = this.terreno;
    const rel = m.relevo;
    const r = new Aleatorio(2202);
    const N = ROTA_MORIA;
    const [sx, sz] = MORIA.topo;
    const y = (x: number, z: number) => rel.altura(x, z);
    const ddMoria = (x: number, z: number) => Math.hypot(x - sx, z - sz) * fatorRaioMoria(Math.atan2(z - sz, x - sx));

    const rocha = zona(m, 'moria', 2201, (c) => {
      // pé do monte: pedra lisa, poste para o jumento
      const [px, pz] = CANAA.peMoria;
      em(c, m, px - 5, pz - 2, 0.3, () => {
        c.cilindro(0, 0, 0, 0.07, 0.09, 1.2, CORES.madeiraEscura, 6);
        c.caixa(1.6, 0, 0.6, 1.6, 0.45, 1.1, CORES_CANAA.calcarioEscuro, { raio: 0.15 });
      });
      // trecho 1: degraus de rocha sobre a rampa
      {
        const a = N[1];
        const b = N[2];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const yaw = Math.atan2(b.x - a.x, b.z - a.z);
        for (let s = 0.4; s < len - 0.3; s += 0.85) {
          const t = s / len;
          const x = a.x + (b.x - a.x) * t;
          const z = a.z + (b.z - a.z) * t;
          const w = a.w + (b.w - a.w) * t;
          c.em(x, y(x, z) - 0.16, z, yaw + r.entre(-0.06, 0.06), () => {
            c.caixa(0, 0, 0, w * 1.7, 0.28, 0.82, r.chance(0.5) ? CORES_CANAA.calcario : CORES_CANAA.calcarioQuente, { raio: 0.08, ao: 0.3 });
          });
        }
      }
      // a parede baixa: face de blocos de calcário
      {
        const B = N[MORIA.iParedeBase];
        const Tp = N[MORIA.iParedeTopo];
        const ux = Tp.x - B.x;
        const uz = Tp.z - B.z;
        const yaw = Math.atan2(ux, uz);
        const yB = y(B.x, B.z);
        const yT = y(Tp.x + ux * 0.3, Tp.z + uz * 0.3);
        const alt = yT - yB;
        c.em((B.x + Tp.x) / 2, yB - 0.4, (B.z + Tp.z) / 2, yaw, () => {
          const larg = B.w * 2 + 1.8;
          c.caixa(0, 0, 0.1, larg, alt + 0.42, 1.3, CORES_CANAA.calcarioEscuro, { raio: 0.2, ao: 0.35 });
          c.caixa(-larg * 0.22, alt * 0.45, -0.25, larg * 0.5, alt * 0.4, 0.5, CORES_CANAA.calcario, { raio: 0.15 });
          c.caixa(larg * 0.25, alt * 0.15, -0.3, larg * 0.4, alt * 0.35, 0.5, CORES_CANAA.calcarioQuente, { raio: 0.15 });
          for (const s of [-1, 1]) c.esfera(s * (larg / 2 + 0.4), alt * 0.5, 0.2, 1.1, CORES_CANAA.calcarioEscuro, 1, alt * 0.55, 1.1, 0);
        });
      }
      // pedras na borda de baixo do caminho (parapeito natural) ao longo da subida
      for (let i = 2; i < N.length - 2; i++) {
        if (i === MORIA.iFossoA || i === MORIA.iParedeBase) continue;
        const a = N[i];
        const b = N[i + 1];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const ux = (b.x - a.x) / len;
        const uz = (b.z - a.z) / len;
        for (let s = 1.2; s < len - 0.8; s += r.entre(2.4, 3.6)) {
          const t = s / len;
          const x = a.x + ux * s;
          const z = a.z + uz * s;
          const w = a.w + (b.w - a.w) * t;
          for (const lado of [-1, 1]) {
            const ox = x - uz * lado * (w + 0.35);
            const oz = z + ux * lado * (w + 0.35);
            const hb = y(ox - uz * lado * 1.5, oz + ux * lado * 1.5);
            if (hb > y(x, z) - 0.5) continue; // só do lado do precipício
            c.esfera(ox, y(ox, oz) + 0.1, oz, r.entre(0.3, 0.5), r.chance(0.5) ? CORES_CANAA.calcarioEscuro : CORES.pedra, 1.3, 0.8, 1.1, 0);
          }
        }
      }
      // patamar: uma laje para sentar, com vista
      {
        const p = N.find((n) => n.nome === 'patamarMoria')!;
        const ang = Math.atan2(p.z - sz, p.x - sx);
        const bx = p.x + Math.cos(ang) * 2.4;
        const bz = p.z + Math.sin(ang) * 2.4;
        em(c, m, bx, bz, -ang + Math.PI / 2, () => c.caixa(0, 0, 0, 2.2, 0.5, 0.8, CORES_CANAA.calcario, { raio: 0.15 }));
      }
      // lajes de calcário saindo das faces íngremes dos estratos: tiram o ar de cúpula lisa
      {
        const rl = new Aleatorio(2205);
        for (let a = 0; a < Math.PI * 2; a += 0.12) {
          for (let dd = 12; dd < MORIA.raioBase - 3; dd += 2.2) {
            const x = sx + (Math.cos(a) * dd) / fatorRaioMoria(a);
            const z = sz + (Math.sin(a) * dd) / fatorRaioMoria(a);
            if (rel.inclinacao(x, z) < 0.2 || !rl.chance(0.55)) continue;
            const rt = T.rota(x, z);
            if (rt.d < rt.w + 4) continue;
            const [lx, ly, lz] = [rl.entre(2.4, 4.6), rl.entre(0.5, 0.95), rl.entre(1.2, 2)];
            // assenta pela borda de baixo (de fora e das pontas): a laje sai da encosta sem flutuar
            const ca = Math.cos(a), sa = Math.sin(a);
            const yb = Math.min(y(x + ca * lz * 0.8, z + sa * lz * 0.8), y(x - sa * lx * 0.8, z + ca * lx * 0.8), y(x + sa * lx * 0.8, z - ca * lx * 0.8));
            c.em(x, yb - 0.1, z, -a - Math.PI / 2, () => {
              c.esfera(0, 0, 0, 1, rl.chance(0.5) ? CORES_CANAA.calcarioQuente : CORES_CANAA.calcario, lx, ly, lz, 1);
            });
          }
        }
      }
      // coroa de rochas no topo (deixa a boca do caminho livre)
      const yTopo = y(sx, sz);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + 0.1;
        const d = (MORIA.raioPlato + 0.6) / fatorRaioMoria(a);
        const x = sx + Math.cos(a) * d;
        const z = sz + Math.sin(a) * d;
        if (T.rota(x, z).d < 3.2) continue;
        c.esfera(x, yTopo - 0.25, z, r.entre(0.45, 0.75), r.chance(0.5) ? CORES_CANAA.calcario : CORES_CANAA.calcarioEscuro, 1.3, r.entre(0.6, 1.1), 1.1, 1);
      }
    });
    void rocha;

    // fosso das pedras soltas: firmes (com chão) e soltas (sem chão), idênticas à vista
    {
      const A = N[MORIA.iFossoA];
      const B = N[MORIA.iFossoB];
      const len = Math.hypot(B.x - A.x, B.z - A.z);
      const ux = (B.x - A.x) / len;
      const uz = (B.z - A.z) / len;
      const nivel = y(A.x - ux * 0.4, A.z - uz * 0.4);
      const cf = new Construtor(2203);
      const cs = new Construtor(2204);
      MORIA.fileirasFosso.forEach((t, fi) => {
        for (let lado = 0; lado < 2; lado++) {
          const firme = MORIA.pedrasFirmes[fi][lado];
          const off = (lado === 0 ? -1 : 1) * MORIA.ladoPedra;
          const x = A.x + ux * t * len - uz * off;
          const z = A.z + uz * t * len + ux * off;
          const c = firme ? cf : cs;
          const alt = MORIA.profundidadeFosso + 0.6;
          c.em(x, nivel - alt, z, r.entre(0, 6.28), () => {
            c.cilindro(0, 0, 0, MORIA.raioPedra, MORIA.raioPedra * 0.8, alt - 0.08, r.chance(0.5) ? CORES_CANAA.calcario : CORES_CANAA.calcarioQuente, 7, { rx: r.entre(-0.04, 0.04) });
            c.cilindro(0, alt - 0.1, 0, MORIA.raioPedra * 0.92, MORIA.raioPedra, 0.1, CORES_CANAA.calcarioQuente, 7);
          });
          if (firme) cf.colisor({ tipo: 'cilindro', x, z, r: MORIA.raioPedra - 0.02, y0: nivel - alt, y1: nivel, piso: true, tag: 'pedraFirme' });
          this.pedrasMoria.push({ x, y: nivel, z, firme });
        }
      });
      for (const [c, mat, nome] of [[cf, this.matFirmes, 'pedrasFirmes'], [cs, this.matSoltas, 'pedrasSoltas']] as const) {
        const { malha, colisores } = c.construir(nome);
        if (malha) {
          malha.material = mat;
          m.adicionar(malha, colisores);
        }
      }
      // pontas do fosso: chão firme no nível do caminho (paredes vistas de dentro do fosso)
      const yaw = Math.atan2(ux, uz);
      for (const [t0, t1] of [[0, 0.095], [0.905, 1]]) {
        const tm = (t0 + t1) / 2;
        m.colisoes.adicionar({ x: A.x + ux * tm * len, z: A.z + uz * tm * len, hx: A.w + 0.3, hz: ((t1 - t0) * len) / 2, yaw, y0: nivel - 5, y1: nivel, piso: true, tag: 'fossoMoria' });
      }
      // quem cai volta ao começo do trecho
      const [ex, ez] = m.ponto('estreitoMoria');
      const [fx, fz] = m.ponto('fossoMoria');
      m.adicionarArea({
        id: 'fossoMoria', x: fx, z: fz, raio: len / 2 + 0.6, yMax: nivel - 1.2,
        aoEntrar: (p) => {
          p.teleportar(ex, m.chao(ex, ez) + 0.05, ez, yaw);
          this.aoCairFosso?.(p);
        },
      });
    }

    // a parede: colisor (de baixo é parede; de cima é chão) e as duas escaladas
    {
      const B = N[MORIA.iParedeBase];
      const Tp = N[MORIA.iParedeTopo];
      const len = Math.hypot(Tp.x - B.x, Tp.z - B.z);
      const ux = (Tp.x - B.x) / len;
      const uz = (Tp.z - B.z) / len;
      const nx = -uz;
      const nz = ux;
      const yaw = Math.atan2(ux, uz);
      const yTopo = y(Tp.x + ux * 0.5, Tp.z + uz * 0.5);
      const yBase = y(B.x - ux * 0.3, B.z - uz * 0.3);
      m.colisoes.adicionar({ x: (B.x + Tp.x) / 2, z: (B.z + Tp.z) / 2, hx: B.w + 0.4, hz: len / 2 + 0.15, yaw, y0: yBase - 3, y1: yTopo, piso: true, tag: 'paredeMoria' });
      for (const [id, lado, ativa] of [['paredeMoria', -1, true], ['cordaMoria', 1, false]] as const) {
        const bx = B.x - ux * 0.35 + nx * 0.9 * lado;
        const bz = B.z - uz * 0.35 + nz * 0.9 * lado;
        const tx = Tp.x + ux * 0.75 + nx * 0.9 * lado;
        const tz = Tp.z + uz * 0.75 + nz * 0.9 * lado;
        m.escaladas.set(id, {
          id,
          base: new THREE.Vector3(bx, y(bx, bz), bz),
          topo: new THREE.Vector3(tx, y(tx, tz), tz),
          yaw,
          largura: 1,
          ativa,
        });
      }
      // a corda (aparece quando Isaque a amarra)
      const c = new Construtor(2205);
      const ex = Tp.x + ux * 1.4 + nx * 0.9;
      const ez = Tp.z + uz * 1.4 + nz * 0.9;
      const borda = new THREE.Vector3(Tp.x + ux * 0.1 + nx * 0.9, yTopo + 0.08, Tp.z + uz * 0.1 + nz * 0.9);
      const estaca = new THREE.Vector3(ex, y(ex, ez) + 0.45, ez);
      const fundo = new THREE.Vector3(B.x - ux * 0.25 + nx * 0.9, yBase + 0.15, B.z - uz * 0.25 + nz * 0.9);
      c.em(ex, y(ex, ez), ez, 0, () => c.cilindro(0, 0, 0, 0.06, 0.08, 0.55, CORES.madeiraEscura, 6));
      c.viga(estaca, borda, 0.035, CORES.corda, 5);
      c.viga(borda, fundo, 0.035, CORES.corda, 5);
      for (let i = 0; i < 4; i++) {
        c.cilindro(fundo.x + 0.15, yBase + i * 0.05, fundo.z, 0.22 - i * 0.02, 0.22 - i * 0.02, 0.05, CORES.corda, 10);
      }
      const { malha } = c.construir('cordaMoria');
      if (malha) m.adicionar(malha);
      this.corda = { malha, colisores: [] };
      mostrar(this.corda, false);
    }

    // paredes invisíveis: bordas do caminho (entre o penhasco da base e o platô do topo),
    // o pé do penhasco em volta do monte e a borda do platô
    {
      const rFora = MORIA.raioBase + 2.6;
      const rDentro = MORIA.raioPlato + 0.2;
      const lados: THREE.Vector2[][] = [[], []];
      for (let i = 0; i < N.length; i++) {
        const p = N[i];
        const a = N[Math.max(0, i - 1)];
        const b = N[Math.min(N.length - 1, i + 1)];
        let tx = b.x - a.x;
        let tz = b.z - a.z;
        const tl = Math.hypot(tx, tz) || 1;
        tx /= tl;
        tz /= tl;
        // fator de esquadria: segmentos vizinhos
        let mit = 1;
        if (i > 0 && i < N.length - 1) {
          const s0x = (p.x - a.x), s0z = (p.z - a.z), l0 = Math.hypot(s0x, s0z) || 1;
          const s1x = (b.x - p.x), s1z = (b.z - p.z), l1 = Math.hypot(s1x, s1z) || 1;
          const cosMeio = Math.sqrt(Math.max(0.05, (1 + (s0x * s1x + s0z * s1z) / (l0 * l1)) / 2));
          mit = Math.min(2.2, 1 / cosMeio);
        }
        const o = (p.w + 0.25) * mit;
        lados[0].push(new THREE.Vector2(p.x - tz * o, p.z + tx * o));
        lados[1].push(new THREE.Vector2(p.x + tz * o, p.z - tx * o));
      }
      const cruzamentos: { fora: THREE.Vector2; dentro: THREE.Vector2 }[] = [];
      for (const linha of lados) {
        // reamostra a linha e guarda o trecho dentro do anel (rDentro < dd < rFora)
        const pts: THREE.Vector2[] = [];
        for (let i = 0; i < linha.length - 1; i++) {
          const a = linha[i];
          const b = linha[i + 1];
          const n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.1));
          for (let k = 0; k < n; k++) pts.push(a.clone().lerp(b, k / n));
        }
        pts.push(linha[linha.length - 1].clone());
        let i0 = pts.findIndex((q) => ddMoria(q.x, q.y) < rFora);
        let i1 = pts.length - 1;
        while (i1 > 0 && ddMoria(pts[i1].x, pts[i1].y) < rDentro) i1--;
        i0 = Math.max(0, i0);
        cruzamentos.push({ fora: pts[i0], dentro: pts[i1] });
        // de volta em segmentos retos: um colisor por trecho de linha original
        let ini = i0;
        for (let k = i0 + 1; k <= i1; k++) {
          const quebra = k === i1 || colinear(pts[ini], pts[k], pts[k + 1]) === false;
          if (quebra) {
            paredeInvisivel(m, pts[ini], pts[k], 1.9);
            ini = k;
          }
        }
      }
      // anel do pé do penhasco (o arco longo, fora da boca do caminho)
      anelInvisivel(m, sx, sz, rFora, cruzamentos[0].fora, cruzamentos[1].fora, T, 3);
      anelInvisivel(m, sx, sz, rDentro, cruzamentos[0].dentro, cruzamentos[1].dentro, T, 1.9);
    }

    // o arbusto denso do carneiro (Gn 22:13), no platô
    {
      const [bx, bz] = m.ponto('arbustoCarneiro');
      const ra = new Aleatorio(2213);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const d = i === 0 ? 0 : ra.entre(0.7, 1.3);
        const x = bx + Math.cos(a) * d;
        const z = bz + Math.sin(a) * d;
        m.natureza.adicionar('arbusto', x, y(x, z) - 0.15, z, ra.entre(0, 6.28), ra.entre(1.25, 1.7), ra);
      }
      m.colisoes.adicionar({ tipo: 'cilindro', x: bx, z: bz, r: 1.5, y0: y(bx, bz) - 1, y1: y(bx, bz) + 1.4, piso: false, tag: 'arbustoCarneiro' });
    }
  }
}

// ------------------------------------------------------------------ utilidades

function materialPedras() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#000000' });
  aplicarPatch(mat, { revelar: true });
  mat.userData.patch = true;
  return mat;
}

function mostrar(p: Peca, sim: boolean) {
  if (p.malha) p.malha.visible = sim;
  for (const c of p.colisores) c.ativo = sim;
}

/** Constrói uma zona (um draw call) com origem no mundo e a adiciona às estruturas. */
function zona(m: Mundo, nome: string, semente: number, fn: (c: Construtor) => void): Peca {
  const c = new Construtor(semente);
  fn(c);
  const { malha, colisores } = c.construir(nome);
  if (!malha) return { malha: null, colisores: m.adicionar(new THREE.Group(), colisores) };
  return { malha, colisores: m.adicionar(malha, colisores) };
}

/** Atalho: peças em (x, chão, z) com giro. */
function em(c: Construtor, m: Mundo, x: number, z: number, yaw: number, fn: () => void) {
  c.em(x, m.relevo.altura(x, z), z, yaw, fn);
}

function colinear(a: THREE.Vector2, b: THREE.Vector2, c?: THREE.Vector2) {
  if (!c) return false;
  const abx = b.x - a.x, abz = b.y - a.y;
  const bcx = c.x - b.x, bcz = c.y - b.y;
  const cruz = Math.abs(abx * bcz - abz * bcx);
  return cruz < 1e-3 * (Math.hypot(abx, abz) * Math.hypot(bcx, bcz) + 1e-6) * 10;
}

/** Parede invisível (sólida, sem chão) entre dois pontos, cobrindo o relevo dos dois lados. */
function paredeInvisivel(m: Mundo, a: THREE.Vector2, b: THREE.Vector2, acima: number) {
  const len = a.distanceTo(b);
  if (len < 0.05) return;
  const rel = m.relevo;
  let hMin = Infinity;
  let hMax = -Infinity;
  const dx = (b.x - a.x) / len;
  const dz = (b.y - a.y) / len;
  for (let s = 0; s <= len; s += 0.5) {
    for (const o of [-1.2, 0, 1.2]) {
      const h = rel.altura(a.x + dx * s - dz * o, a.y + dz * s + dx * o);
      hMin = Math.min(hMin, h);
      hMax = Math.max(hMax, h);
    }
  }
  const op: OpcoesColisor = {
    x: (a.x + b.x) / 2, z: (a.y + b.y) / 2, hx: 0.22, hz: len / 2 + 0.12, yaw: Math.atan2(dx, dz),
    y0: hMin - 4, y1: hMax + acima, piso: false, solido: true, tag: 'invisivel',
  };
  m.colisoes.adicionar(op);
}

/** Anel invisível em volta do Moriá entre dois pontos de cruzamento (o arco que não contém o caminho). */
function anelInvisivel(m: Mundo, sx: number, sz: number, rIrr: number, p0: THREE.Vector2, p1: THREE.Vector2, T: TerrenoCanaa, acima: number) {
  const a0 = Math.atan2(p0.y - sz, p0.x - sx);
  const a1 = Math.atan2(p1.y - sz, p1.x - sx);
  // o arco curto entre a0 e a1 é a boca do caminho; percorre o longo
  let da = a1 - a0;
  while (da <= -Math.PI) da += Math.PI * 2;
  while (da > Math.PI) da -= Math.PI * 2;
  const meio = a0 + da / 2;
  const pm = { x: sx + Math.cos(meio) * rIrr / fatorRaioMoria(meio), z: sz + Math.sin(meio) * rIrr / fatorRaioMoria(meio) };
  const rt = T.rota(pm.x, pm.z);
  // se o meio do arco curto não está no caminho, a boca é o arco longo (raro): inverte
  const longo = rt.d < rt.w + 1.5 ? (da > 0 ? da - Math.PI * 2 : da + Math.PI * 2) : da;
  const raioMedio = rIrr;
  const n = Math.max(4, Math.ceil((Math.abs(longo) * raioMedio) / 3));
  let ant = new THREE.Vector2(p0.x, p0.y);
  for (let k = 1; k <= n; k++) {
    const a = a0 + (longo * k) / n;
    const d = rIrr / fatorRaioMoria(a);
    const q = k === n ? new THREE.Vector2(p1.x, p1.y) : new THREE.Vector2(sx + Math.cos(a) * d, sz + Math.sin(a) * d);
    paredeInvisivel(m, ant, q, acima);
    ant = q;
  }
}

function criarPorteira(m: Mundo, nome: NomePorteira, cur: DefCurral) {
  const [hx, hz] = localCurral(cur, cur.dobradica[0], cur.dobradica[1]);
  const [px, pz] = localCurral(cur, cur.ponta[0], cur.ponta[1]);
  const comp = Math.hypot(px - hx, pz - hz);
  // yaw do grupo: +x local do painel aponta da dobradiça para a ponta
  const fechada = Math.atan2(-(pz - hz), px - hx);
  const aberta = fechada + cur.sentido * -1.65;
  return new Porteira(m, nome, hx, m.relevo.altura(hx, hz), hz, fechada, aberta, comp);
}

// ------------------------------------------------------------------ vegetação

function definirVariantes(m: Mundo) {
  const n = m.natureza;
  n.definirVariante('oliveira', { modelos: ['TwistedTree_1', 'TwistedTree_4'], corFolha: '#b4c0a2', tintTronco: '#cdbda4', vento: 0.08, raioTronco: 1.0, alcance: 160, alcancePerto: 42, reduzirTronco: 0.2, fracaoLonge: 0.62 });
  n.definirVariante('carvalho', { modelos: ['CommonTree_3', 'CommonTree_5'], tintFolha: '#b4cf80', tintTronco: '#b8a890', vento: 0.1, raioTronco: 0.45, alcance: 230, alcancePerto: 48, reduzirTronco: 0.3 });
  n.definirVariante('carvalhoGrande', { modelos: ['CommonTree_1'], tintFolha: '#b0cc7c', tintTronco: '#b0a088', vento: 0.07, raioTronco: 0.42, alcance: 300, alcancePerto: 70, reduzirTronco: 0.3 });
  n.definirVariante('arvoreJordao', { modelos: ['CommonTree_5'], tintFolha: '#a8dc74', vento: 0.13, raioTronco: 0.4, alcance: 230, alcancePerto: 40, reduzirTronco: 0.25, fracaoLonge: 0.3 });
  n.definirVariante('cipreste', { modelos: ['Pine_5'], tintFolha: '#7fa070', vento: 0.07, raioTronco: 0.3, alcance: 220, alcancePerto: 45 });
  n.definirVariante('arbusto', { modelos: ['Bush_Common'], corFolha: '#a9b583', vento: 0.07, alcance: 130, alcancePerto: 38 });
  n.definirVariante('arbustoVerde', { modelos: ['Bush_Common'], corFolha: '#86b860', vento: 0.08, alcance: 170, alcancePerto: 38 });
  n.definirVariante('pedra', { modelos: ['Rock_Medium_1', 'Rock_Medium_3'], corSolido: '#c9bea6', vento: 0, raioTronco: 1.0, alcance: 190, alcancePerto: 60, reduzirTronco: 0.5 });
  n.definirVariante('flores', { modelos: ['Flower_3_Group'], vento: 0.12, alcance: 48, alcancePerto: 48, sombra: false });
  n.definirVariante('capim', { modelos: ['Grass_Common_Tall'], tintFolha: '#f4dc98', vento: 0.2, alcance: 42, alcancePerto: 42, sombra: false });
}

/** Zonas sem vegetação: [x, z, raio]. */
function zonasLivres(m: Mundo): [number, number, number][] {
  const p = (n: string, r: number): [number, number, number] => [...m.ponto(n), r];
  return [
    p('acampamentoBetel', 23), p('acampamentoManre', 19), p('betel', 24), p('ai', 22), p('siquem', 21), p('poco', 13),
    p('curralAbrao', 12), p('curralLo', 12), p('salem', 18), p('sodomaLonge', 34), p('acampamentoInimigo', 27),
    p('peMoria', 12), p('miranteNorte', 8), p('miranteSul', 8), p('miranteLeste', 8), p('miranteOeste', 8),
    p('miranteJordao', 9), p('ceuEstrelas', 14), p('altarMore', 4), p('altarBetel', 4), p('altarManre', 6),
    p('segredo1', 4), p('segredo2', 4), p('segredo3', 4), p('segredo4', 5), p('more', 7), p('aliadosManre', 10),
    p('chegada', 6), p('caravana', 7), p('save', 6), p('da', 6), p('flancoOeste', 3), p('flancoLeste', 3), p('flancoSul', 4),
    p('reuniaoServos', 7), p('altarSalem', 4), p('topoMoria', MORIA.raioPlato + 3),
  ];
}

function vegetacao(m: Mundo, T: TerrenoCanaa) {
  const r = m.ruido;
  const zonas = zonasLivres(m);
  const [msx, msz] = MORIA.topo;
  const livre = (x: number, z: number) => {
    for (const [cx, cz, rr] of zonas) {
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < rr * rr) return 0;
    }
    for (const t of TRILHAS) if (distTrilha(x, z, t) < 3.4) return 0;
    const rt = T.rota(x, z);
    if (rt.d < rt.w + 3.5) return 0;
    return 1;
  };
  const noMoria = (x: number, z: number) => {
    const d = Math.hypot(x - msx, z - msz) * fatorRaioMoria(Math.atan2(z - msz, x - msx));
    return d < MORIA.raioBase + 3 ? 1 : 0;
  };
  const planalto = (x: number, z: number) => (1 - T.jordao(x, z)) * (1 - noMoria(x, z));
  const anel = (x: number, z: number, c: Ponto2, r0: number, r1: number) => {
    const d = Math.hypot(x - c[0], z - c[1]);
    return d > r0 && d < r1 ? 1 : 0;
  };
  const dManre = (x: number, z: number) => Math.hypot(x - CANAA.manre[0], z - CANAA.manre[1]);

  // grandes carvalhos: Moré (Gn 12:6) e Manre (Gn 13:18)
  {
    const [x, z] = CANAA.more;
    m.natureza.adicionar('carvalhoGrande', x, m.relevo.altura(x, z) - 0.2, z, 0.8, 2.5);
    const [gx, gz] = m.ponto('carvalhoManre');
    m.natureza.adicionar('carvalhoGrande', gx, m.relevo.altura(gx, gz) - 0.2, gz, 2.4, 2.3);
  }
  // carvalhais de Manre
  espalhar(m, 'carvalho', {
    espacamento: 12, escala: [1.25, 1.85], inclinacaoMax: 0.3, semente: 71,
    x0: CANAA.manre[0] - 60, x1: CANAA.manre[0] + 60, z0: CANAA.manre[1] - 60, z1: CANAA.manre[1] + 60,
    densidade: (x, z) => livre(x, z) * (1 - smoothstep(38, 58, dManre(x, z))) * 0.75,
  });
  // carvalhos esparsos: Moré, vale de Savé, bordas do vale de Dã
  espalhar(m, 'carvalho', {
    espacamento: 14, escala: [1.0, 1.5], inclinacaoMax: 0.3, semente: 72,
    densidade: (x, z) => livre(x, z) * planalto(x, z) * (
      anel(x, z, CANAA.more, 10, 36) * 0.35 + anel(x, z, CANAA.save, 0, 26) * 0.35 + anel(x, z, CANAA.valeDa, 28, 46) * 0.22),
  });
  // oliveiras: bosques junto às aldeias, nas encostas do monte de Betel e esparsas
  espalhar(m, 'oliveira', {
    espacamento: 8.5, escala: [0.32, 0.45], inclinacaoMax: 0.28, semente: 81,
    densidade: (x, z) => livre(x, z) * planalto(x, z) * (
      anel(x, z, CANAA.betel, 16, 44) * 0.32 + anel(x, z, CANAA.ai, 15, 38) * 0.3 + anel(x, z, CANAA.siquem, 14, 34) * 0.3 +
      anel(x, z, CANAA.acampamentoBetel, 26, 46) * 0.12 + anel(x, z, CANAA.salem, 16, 32) * 0.28),
  });
  espalhar(m, 'oliveira', {
    espacamento: 28, escala: [0.3, 0.42], inclinacaoMax: 0.25, semente: 82,
    densidade: (x, z) => livre(x, z) * planalto(x, z) * (dManre(x, z) > 60 ? 0.16 : 0) * (m.relevo.altura(x, z) < 22 ? 1 : 0),
  });
  // ciprestes esparsos nas encostas e nos montes da borda
  espalhar(m, 'cipreste', {
    espacamento: 15, escala: [0.85, 1.25], inclinacaoMax: 0.4, semente: 91,
    densidade: (x, z) => {
      const inc = m.relevo.inclinacao(x, z);
      return livre(x, z) * (1 - T.jordao(x, z)) * (smoothstep(0.06, 0.16, inc) * 0.22 + smoothstep(18, 30, m.relevo.altura(x, z)) * 0.1) * (noMoria(x, z) ? 0.5 : 1);
    },
  });
  // planície do Jordão: árvores e mato verde ao longo do rio
  espalhar(m, 'arvoreJordao', {
    espacamento: 10, escala: [0.95, 1.35], semente: 101, x0: 95,
    densidade: (x, z) => {
      const j = T.jordao(x, z);
      if (j < 0.6) return 0;
      const d = distPolilinha(x, z, RIO_JORDAO).d;
      return livre(x, z) * (d > 10 && d < 42 ? 0.42 * (1 - smoothstep(22, 42, d) * 0.6) : 0.05);
    },
  });
  espalhar(m, 'arbustoVerde', {
    espacamento: 7, escala: [0.9, 1.5], semente: 102, x0: 95,
    densidade: (x, z) => {
      const j = T.jordao(x, z);
      if (j < 0.5) return 0;
      const d = distPolilinha(x, z, RIO_JORDAO).d;
      return livre(x, z) * (d > 9 && d < 30 ? 0.4 : 0.12);
    },
  });
  // arbustos do planalto, mais densos em Manre e no vale de Dã
  espalhar(m, 'arbusto', {
    espacamento: 9, escala: [0.6, 1.25], inclinacaoMax: 0.4, semente: 111,
    densidade: (x, z) => livre(x, z) * planalto(x, z) * (0.08 + Math.max(0, r.fbm(x * 0.025, z * 0.025, 2)) * 0.25 +
      (dManre(x, z) < 60 ? 0.12 : 0) + anel(x, z, CANAA.valeDa, 30, 60) * 0.18),
  });
  // Moriá: mato seco e algumas oliveiras nos patamares dos estratos (quebram a rocha nua)
  const caixaMoria = { x0: msx - MORIA.raioBase - 4, x1: msx + MORIA.raioBase + 4, z0: msz - MORIA.raioBase - 4, z1: msz + MORIA.raioBase + 4 };
  espalhar(m, 'arbusto', {
    ...caixaMoria, espacamento: 5, escala: [0.9, 1.6], inclinacaoMax: 0.14, semente: 112,
    densidade: (x, z) => livre(x, z) * noMoria(x, z) * (0.3 + Math.max(0, r.fbm(x * 0.06, z * 0.06, 2)) * 0.5),
  });
  espalhar(m, 'oliveira', {
    ...caixaMoria, espacamento: 11, escala: [0.26, 0.36], inclinacaoMax: 0.12, semente: 113,
    densidade: (x, z) => livre(x, z) * noMoria(x, z) * 0.22,
  });
  // pedras calcárias: mais nas encostas, nos montes e no Moriá
  espalhar(m, 'pedra', {
    espacamento: 10, escala: [0.5, 1.5], afundar: 0.4, semente: 121,
    densidade: (x, z) => livre(x, z) * (1 - T.jordao(x, z) * 0.9) * (0.035 + smoothstep(0.12, 0.3, m.relevo.inclinacao(x, z)) * 0.3 +
      smoothstep(22, 40, m.relevo.altura(x, z)) * 0.15 + noMoria(x, z) * 0.25),
  });
  // flores silvestres esparsas (mais em Manre e na beira do Jordão)
  espalhar(m, 'flores', {
    espacamento: 4, escala: [0.7, 1.2], inclinacaoMax: 0.25, semente: 131,
    densidade: (x, z) => livre(x, z) * (1 - noMoria(x, z)) * (dManre(x, z) < 55 ? 0.3 : T.jordao(x, z) > 0.6 ? 0.2 : 0.035),
  });
  // capim seco dourado em touceiras
  espalhar(m, 'capim', {
    espacamento: 4.5, escala: [0.7, 1.15], inclinacaoMax: 0.3, semente: 141,
    densidade: (x, z) => livre(x, z) * planalto(x, z) * (dManre(x, z) < 55 ? 0.04 : 0.16),
  });
}

// ------------------------------------------------------------------ lugares

function construirMore(m: Mundo, fog: Fogueiras) {
  const [ox, oz] = CANAA.more;
  zona(m, 'more', 1206, (c) => {
    // pedras ao pé do carvalho e o lugar da caravana
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      em(c, m, ox + Math.cos(a) * 4.2, oz + Math.sin(a) * 4.2, a, () => c.esfera(0, 0.15, 0, 0.45, CORES_CANAA.calcarioEscuro, 1.4, 0.6, 1.1, 0));
    }
    const [kx, kz] = m.ponto('caravana');
    em(c, m, kx, kz, 0.6, () => {
      alforje(c);
      c.em(1.8, 0, 0.8, 0.5, () => alforje(c, '#6a4a3a'));
      c.em(-1.2, 0, 1.5, 0, () => { c.saco(0, 0, 1); c.saco(0.6, 0.3, 0.8); c.jarro(-0.6, 0.2, 1.1); });
    });
    // Siquém: aldeia cananeia
    const [sx, sz] = CANAA.siquem;
    c.em(sx, m.relevo.altura(sx, sz), sz, 0.3, () => {
      aldeia(c, [[-9, -6, 0.3, 6, 5, 3.2], [0, -10, 0, 7, 5, 3.6], [9, -5, -0.4, 5.5, 5, 3], [-10, 6, 2.6, 6, 5, 3.4], [8, 8, -2.4, 6, 5.5, 3.2]], false);
      muroPedra(c, -14, -12, -14, 10, 1.4);
      muroPedra(c, 14, -12, 14, 12, 1.4);
    });
  });
  const [sx, sz] = CANAA.siquem;
  fog.adicionar(sx, m.relevo.altura(sx, sz) + 0.05, sz, 0.7);
}

function construirAldeias(m: Mundo, fog: Fogueiras) {
  const casasBetel: [number, number, number, number, number, number][] = [
    [-10, -8, 0.4, 7, 5.5, 3.6], [1, -12, 0.05, 6, 5, 3.2], [11, -7, -0.5, 7, 6, 3.8], [12, 6, -2.2, 6, 5, 3.3],
    [-11, 7, 2.5, 6.5, 5, 3.4], [0, 13, 3.1, 7, 5, 3.5],
  ];
  const casasAi: [number, number, number, number, number, number][] = [
    [-8, -7, 0.5, 6, 5, 3.4], [4, -10, -0.2, 7, 5.5, 3.6], [11, 2, -1.6, 6, 5, 3.2], [-10, 6, 2.4, 6, 5, 3.3], [2, 11, 3.0, 6.5, 5, 3.5],
  ];
  for (const [nome, [x, z], casas, yaw] of [['betel', CANAA.betel, casasBetel, 0.2], ['ai', CANAA.ai, casasAi, -0.3]] as const) {
    zona(m, nome, nome.length * 11, (c) => {
      c.em(x, m.relevo.altura(x, z), z, yaw, () => {
        aldeia(c, casas as [number, number, number, number, number, number][], true);
        muroPedra(c, -17, -15, 3, -19, 1.6);
        muroPedra(c, 3, -19, 17, -12, 1.6);
        c.em(0, 0, 0, 0, () => c.poco());
        for (let i = 0; i < 5; i++) c.jarro(3 + i * 0.6, 2.5, 1);
        c.em(-4, 0, 3, 0.5, () => c.fogueira());
      });
    });
    const cs = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const fx = x + -4 * cs + 3 * sn;
    const fz = z - -4 * sn + 3 * cs;
    fog.adicionar(fx, m.relevo.altura(fx, fz) + 0.05, fz, 0.7);
  }
}

function construirMirantes(m: Mundo) {
  zona(m, 'mirantes', 1314, (c) => {
    for (const nome of ['miranteNorte', 'miranteSul', 'miranteLeste', 'miranteOeste']) {
      const [x, z] = m.ponto(nome);
      em(c, m, x + 1.5, z - 1.5, nome.length * 0.9, () => marcoMirante(c));
    }
    // mirante do Jordão: saliência de lajes calcárias na beira da escarpa
    const [jx, jz] = CANAA.miranteJordao;
    em(c, m, jx + 2.6, jz + 0.6, 0.1, () => c.caixa(0, -0.45, 0, 3.0, 0.75, 2.4, CORES_CANAA.calcario, { raio: 0.2 }));
    em(c, m, jx - 2.6, jz - 2.6, -0.5, () => {
      c.caixa(0, -0.3, 0, 2.2, 1.2, 1.6, CORES_CANAA.calcarioEscuro, { raio: 0.25 });
      c.colisor({ x: 0, z: 0, hx: 1.1, hz: 0.8, y0: -1, y1: 0.9, piso: true });
    });
    em(c, m, jx - 1.5, jz + 3.2, 0, () => c.esfera(0, 0.1, 0, 0.8, CORES_CANAA.calcarioEscuro, 1.3, 0.7, 1.1, 0));
  });
}

function construirManre(m: Mundo, fog: Fogueiras) {
  // Aner, Escol e Manre, amorreus aliados de Abrão (Gn 14:13): duas tendas e um fogo
  const [ax, az] = m.ponto('aliadosManre');
  zona(m, 'aliadosManre', 1413, (c) => {
    em(c, m, ax - 3.5, az - 2, 0.9, () => tendaPelos(c, 5, 4, 2.2, '#6a5440', '#5a4434', '#d8c090'));
    em(c, m, ax + 3.5, az - 3, -0.6, () => tendaPelos(c, 4.6, 3.8, 2.1, '#5a4636', '#6a5440', '#d8c090'));
    em(c, m, ax, az + 2.5, 0, () => c.fogueira());
    em(c, m, ax + 4, az + 3, 0.3, () => alforje(c));
  });
  fog.adicionar(ax, m.relevo.altura(ax, az + 2.5) + 0.05, az + 2.5, 0.8);
}

function construirSalem(m: Mundo) {
  const [sx, sz] = CANAA.salem;
  zona(m, 'salem', 1418, (c) => {
    c.em(sx, m.relevo.altura(sx, sz), sz, 0.15, () => {
      // a casa de Melquisedeque: pedra clara, pátio murado
      casaPedra(c, 9, 7, 4.2, CORES_CANAA.rebocoClaro, true);
      muroPedra(c, -6, 4.5, -6, 10, 1.3, CORES_CANAA.calcario);
      muroPedra(c, 6, 4.5, 6, 10, 1.3, CORES_CANAA.calcario);
      c.em(-12, 0, -3, 0.5, () => casaPedra(c, 6, 5, 3.2, CORES_CANAA.calcario, true));
      c.em(12, 0, -2, -0.4, () => casaPedra(c, 6, 5, 3.4, CORES_CANAA.calcarioQuente, true));
      c.em(-9, 0, -12, 0.2, () => casaPedra(c, 5.5, 5, 3, CORES_CANAA.calcario, false));
      // mesa com pão e vinho (Gn 14:18)
      c.em(-1, 0, 7.5, 0, () => {
        c.caixa(0, 0, 0, 1.6, 0.75, 0.8, CORES.madeiraClara, { raio: 0.04 });
        c.jarro(-0.4, 0, 0.9, '#7a2a3a');
        c.esfera(0.3, 0.82, 0.1, 0.16, '#d8a860', 1.2, 0.5, 1, 1);
        c.esfera(0.55, 0.82, -0.15, 0.14, '#d8a860', 1.2, 0.5, 1, 1);
        c.colisor({ x: 0, z: 0, hx: 0.8, hz: 0.4, y0: -1, y1: 0.75, piso: true });
      });
    });
    const [ax, az] = m.ponto('altarSalem');
    em(c, m, ax, az, 0.4, () => c.altar(0.9, 1.0, true));
  });
}

function construirSodoma(m: Mundo, fog: Fogueiras) {
  const [sx, sz] = CANAA.sodoma;
  const y = m.relevo.altura(sx, sz);
  const r = new Aleatorio(1912);
  zona(m, 'sodoma', 1913, (c) => {
    c.em(sx, y, sz, 0.1, () => {
      const cores = [CORES.barro, CORES.barroClaro, CORES.barroEscuro];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + r.entre(-0.15, 0.15);
        const d = i % 3 === 0 ? r.entre(4, 8) : r.entre(10, 18);
        c.em(Math.cos(a) * d, 0, Math.sin(a) * d, r.entre(0, 6.28), () => casaPedra(c, r.entre(5, 8), r.entre(4.5, 7), r.entre(3.2, 5.5), cores[i % 3], false));
      }
      // muralha com portão e uma torre
      const n = 20;
      for (let i = 0; i < n; i++) {
        if (i === 15) continue; // portão (oeste-norte)
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        muroPedra(c, Math.cos(a0) * 23, Math.sin(a0) * 23, Math.cos(a1) * 23, Math.sin(a1) * 23, 3.2, CORES.barroEscuro);
      }
      c.caixa(2, 0, -2, 6, 9, 6, CORES.barroEscuro, { raio: 0 });
      c.caixa(2, 9, -2, 4.5, 3, 4.5, CORES.barro, { raio: 0 });
      c.colisor({ x: 2, z: -2, hx: 3, hz: 3, y0: -1, y1: 12, piso: false });
    });
  });
  fog.adicionar(sx - 6, y + 0.05, sz + 6, 1.1);
  fog.adicionar(sx + 9, y + 0.05, sz - 8, 0.9);
}

function construirSegredos(m: Mundo) {
  zona(m, 'segredos', 1316, (c) => {
    for (const nome of ['segredo1', 'segredo2', 'segredo3', 'segredo4']) {
      const [x, z] = m.ponto(nome);
      em(c, m, x, z, nome.length + x * 0.01, () => pedraMemorial(c, nome === 'segredo1' ? 1.7 : 1.4));
    }
    // segredo 2: uma fonte escondida na ravina
    const [x2, z2] = m.ponto('segredo2');
    em(c, m, x2 + 2.4, z2 + 1.2, 0, () => {
      c.cilindro(0, -0.05, 0, 1.2, 1.3, 0.12, '#4a8c9c', 12, { ao: 0 });
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        c.esfera(Math.cos(a) * 1.45, 0.05, Math.sin(a) * 1.45, 0.28, CORES_CANAA.calcarioEscuro, 1.3, 0.6, 1, 0);
      }
    });
    // segredo 4: abrigo sob uma laje de rocha
    const [x4, z4] = m.ponto('segredo4');
    em(c, m, x4 + 1.5, z4 + 2.5, 0.7, () => {
      c.caixa(-1.8, 0, 0, 1.2, 2.3, 3.2, CORES_CANAA.calcarioEscuro, { raio: 0.3 });
      c.caixa(1.8, 0, 0, 1.2, 2.0, 3.0, CORES_CANAA.calcarioEscuro, { raio: 0.3 });
      c.caixa(0, 2.0, 0.2, 5.2, 0.7, 3.8, CORES_CANAA.calcario, { raio: 0.3, rz: 0.06 });
      c.colisor({ x: -1.8, z: 0, hx: 0.6, hz: 1.6, y0: -1, y1: 2.3, piso: true });
      c.colisor({ x: 1.8, z: 0, hx: 0.6, hz: 1.5, y0: -1, y1: 2.0, piso: true });
    });
  });
}
