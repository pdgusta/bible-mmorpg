import './ui/estilo.css';

const canvas = document.getElementById('jogo') as HTMLCanvasElement;
const P = new URLSearchParams(location.search);

if (P.get('lab') === 'personagens') {
  const [{ laboratorio }, { APARENCIAS_NOE }, { APARENCIAS_ABRAAO }] = await Promise.all([
    import('./lab/laboratorio'),
    import('./eras/noe/aparencias'),
    import('./eras/abraao/aparencias'),
  ]);
  await laboratorio(canvas, { ...APARENCIAS_NOE, ...APARENCIAS_ABRAAO });
} else {
  const { iniciarJogo } = await import('./jogo/inicio');
  await iniciarJogo(canvas, document.getElementById('ui') as HTMLDivElement);
}
