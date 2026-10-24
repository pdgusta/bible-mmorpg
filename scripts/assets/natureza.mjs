// Junta os modelos escolhidos do Stylized Nature MegaKit (Quaternius, CC0) num único GLB
// otimizado (texturas compartilhadas, redimensionadas e em WebP).
// Uso: node scripts/assets/natureza.mjs
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, dedup, prune, quantize, meshopt, textureCompress, unpartition } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { RAIZ } from '../biblia-comum.mjs';

const DIR = path.join(RAIZ, 'fontes/assets/stylized_nature_megakitstandard/glTF');
export const MODELOS_NATUREZA = [
  'CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5',
  'TwistedTree_1', 'TwistedTree_2', 'TwistedTree_3', 'TwistedTree_4', 'TwistedTree_5',
  'Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5',
  'DeadTree_1', 'DeadTree_2', 'DeadTree_3',
  'Bush_Common', 'Bush_Common_Flowers', 'Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3',
  'Pebble_Round_1', 'Pebble_Round_3', 'Pebble_Square_2',
  'Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wispy_Short', 'Grass_Wispy_Tall',
  'Flower_3_Group', 'Flower_4_Group', 'Flower_3_Single', 'Fern_1', 'Clover_1', 'Plant_1', 'Plant_7',
  'RockPath_Round_Small_1', 'RockPath_Round_Small_2', 'RockPath_Square_Small_1',
];

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});

const base = await io.read(path.join(DIR, `${MODELOS_NATUREZA[0]}.gltf`));
nomearRaiz(base, MODELOS_NATUREZA[0]);
for (const nome of MODELOS_NATUREZA.slice(1)) {
  const doc = await io.read(path.join(DIR, `${nome}.gltf`));
  nomearRaiz(doc, nome);
  mergeDocuments(base, doc);
}
// Uma única cena com todos os modelos como filhos nomeados.
const cenas = base.getRoot().listScenes();
const principal = cenas[0];
for (const c of cenas.slice(1)) {
  for (const n of c.listChildren()) principal.addChild(n);
  c.dispose();
}
// Mapas normais não são usados (materiais Lambert sem normal map): descartados para economizar.
for (const m of base.getRoot().listMaterials()) {
  const t = m.getNormalTexture();
  if (t) m.setNormalTexture(null);
}
await base.transform(
  dedup(), prune(), unpartition(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 85 }),
  quantize({ quantizePosition: 14, quantizeTexcoord: 12 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
const saida = path.join(RAIZ, 'public/modelos/natureza.glb');
fs.writeFileSync(saida, await io.writeBinary(base));
console.log(`natureza.glb: ${(fs.statSync(saida).size / 1024).toFixed(0)} KB, ${MODELOS_NATUREZA.length} modelos`);

function nomearRaiz(doc, nome) {
  const cena = doc.getRoot().listScenes()[0];
  const filhos = cena.listChildren();
  const grupo = doc.createNode(nome);
  for (const f of filhos) { cena.removeChild(f); grupo.addChild(f); }
  cena.addChild(grupo);
}
