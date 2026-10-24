import type * as THREE from 'three';
// provisório
export const Audio = {
  async iniciar() {},
  ambiente(_n: string, _i: number) {},
  musica(_e: string) {},
  posicaoOuvinte(_p: THREE.Vector3, _yaw?: number) {},
  efeito(_nome: string, _op?: { pos?: THREE.Vector3; volume?: number; sexo?: string }) {},
};
