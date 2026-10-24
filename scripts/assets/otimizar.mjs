// Otimização de GLB com glTF-Transform: remove o que não é usado, reamostra animações,
// quantiza e comprime com meshopt (decodificado no jogo por MeshoptDecoder).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, quantize, meshopt, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

export async function otimizarGLB(buffer, { animacoes = true, texturaMax = 512, soldar = false, quantizar = true } = {}) {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
  });
  const doc = await io.readBinary(new Uint8Array(buffer));
  const passos = [dedup(), prune()];
  if (soldar) passos.push(weld());
  if (animacoes) passos.push(resample({ tolerance: 0.0005 }));
  passos.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texturaMax, texturaMax], quality: 82 }));
  if (quantizar) passos.push(quantize({ quantizeTexcoord: 12, quantizePosition: 14, quantizeNormal: 10 }));
  passos.push(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await doc.transform(...passos);
  return Buffer.from(await io.writeBinary(doc));
}
