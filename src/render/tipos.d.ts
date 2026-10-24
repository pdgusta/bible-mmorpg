// Tipos mínimos de bibliotecas do three sem declaração.
declare module 'three/examples/jsm/libs/meshopt_simplifier.module.js' {
  export const MeshoptSimplifier: {
    ready: Promise<void>;
    simplify(indices: Uint32Array, posicoes: Float32Array, stride: number, alvoIndices: number, erro: number, flags?: string[]): [Uint32Array, number];
  };
}
