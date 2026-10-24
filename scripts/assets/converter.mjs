// Converte os pacotes CC0 da Quaternius (fontes/assets) em GLBs prontos para o jogo (public/modelos).
// Uso: node scripts/assets/converter.mjs
// Requer o Chromium pré-instalado (Playwright) e os pacotes baixados por scripts/assets/baixar.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RAIZ } from '../biblia-comum.mjs';
import { servir } from './servidor.mjs';
import { otimizarGLB } from './otimizar.mjs';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node-tools/node_modules/playwright'); }

const SAIDA = path.join(RAIZ, 'public', 'modelos');
fs.mkdirSync(path.join(SAIDA, 'personagens'), { recursive: true });
fs.mkdirSync(path.join(SAIDA, 'animais'), { recursive: true });

const UAL1 = '/fontes/universal_animation_librarystandard/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb';
const UAL2 = '/fontes/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb';
const FEM = '/fontes/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Female Mannequin/Unreal-Godot/Mannequin_F.glb';

const CLIPS_UAL1 = [
  'Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Interact',
  'PickUp_Table', 'Push_Loop', 'Fixing_Kneeling', 'Sitting_Enter', 'Sitting_Idle_Loop', 'Sitting_Exit',
  'Sitting_Talking_Loop', 'Idle_Talking_Loop', 'Idle_Torch_Loop', 'Crouch_Fwd_Loop', 'Crouch_Idle_Loop',
  'Sword_Attack', 'Sword_Idle', 'Hit_Chest', 'Roll', 'Walk_Formal_Loop', 'Dance_Loop', 'Spell_Simple_Enter',
  'Spell_Simple_Idle_Loop', 'Spell_Simple_Exit', 'Spell_Simple_Shoot', 'Swim_Idle_Loop', 'Swim_Fwd_Loop',
];
const CLIPS_UAL2 = [
  'Walk_Carry_Loop', 'TreeChopping_Loop', 'Farm_Harvest', 'Farm_PlantSeed', 'Farm_Watering', 'ClimbUp_1m_RM',
  'Consume', 'Chest_Open', 'Idle_FoldArms_Loop', 'Idle_Lantern_Loop', 'Idle_Shield_Loop', 'Sword_Block',
  'Shield_OneShot', 'OverhandThrow', 'Yes', 'Idle_No_Loop', 'Hit_Knockback', 'LayToIdle', 'Idle_Rail_Loop',
  'Idle_Rail_Call', 'Sword_Regular_A',
];

const FA = '/fontes/Farm_Animals_by_Quaternius/Farm Animals by @Quaternius/FBX/';
const AP2 = '/fontes/Animal_Pack_Vol.2_by_Quaternius/Animal Pack Vol.2 by @Quaternius/FBX/';
const ANIMAIS = [
  { nome: 'cavalo', url: FA + 'Horse.fbx', altura: 1.7 },
  { nome: 'vaca', url: FA + 'Cow.fbx', altura: 1.45 },
  { nome: 'ovelha', url: FA + 'Sheep.fbx', altura: 0.95 },
  { nome: 'porco', url: FA + 'Pig.fbx', altura: 0.8 },
  { nome: 'zebra', url: FA + 'Zebra.fbx', altura: 1.5 },
  { nome: 'lhama', url: FA + 'Llama.fbx', altura: 1.7 },
  { nome: 'gato', url: AP2 + 'Cat.fbx', altura: 0.35, cor: '#c8955a' },
  { nome: 'lobo', url: AP2 + 'Wolf.fbx', altura: 0.85, cor: '#8a8580' },
  { nome: 'cao', url: AP2 + 'Dog.fbx', altura: 0.6, cor: '#b88a55' },
  { nome: 'aguia', url: AP2 + 'Eagle.fbx', altura: 0.8, cor: '#6b4a2e' },
];

const servidor = await servir(8799);
const navegador = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pagina = await navegador.newPage();
pagina.on('pageerror', (e) => console.error('erro na página:', e.message));
pagina.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('console:', m.text()); });
await pagina.goto('http://localhost:8799/index.html');
await pagina.waitForFunction(() => window.pronto, null, { timeout: 60000 });

const so = process.argv[2];
if (!so || so === 'humanos') {
  console.log('Redirecionando animações humanas…');
  const r = await pagina.evaluate((cfg) => window.converterHumano(cfg),
    { ual1: UAL1, ual2: UAL2, feminino: FEM, clipsUal1: CLIPS_UAL1, clipsUal2: CLIPS_UAL2 });
  if (r.relatorio.faltando.length) console.warn('Clips não encontrados:', r.relatorio.faltando);
  console.log(`${r.relatorio.clips.length} clips`);
  await gravar(path.join(SAIDA, 'personagens', 'humano.glb'), r.masc, { animacoes: true, quantizar: false });
  await gravar(path.join(SAIDA, 'personagens', 'humana.glb'), r.fem, { animacoes: false, quantizar: false });
}
if (!so || so === 'animais') {
  for (const a of ANIMAIS) {
    const r = await pagina.evaluate((cfg) => window.converterAnimal(cfg), a);
    console.log(`${a.nome}: ${r.clips.join(', ')}`);
    await gravar(path.join(SAIDA, 'animais', `${a.nome}.glb`), r.glb, { animacoes: true });
  }
}
await navegador.close();
servidor.close();

async function gravar(arq, base64, opcoes) {
  const bruto = Buffer.from(base64, 'base64');
  const final = await otimizarGLB(bruto, opcoes);
  fs.writeFileSync(arq, final);
  console.log(`  ${path.relative(RAIZ, arq)}: ${(bruto.length / 1024).toFixed(0)} KB → ${(final.length / 1024).toFixed(0)} KB`);
}
