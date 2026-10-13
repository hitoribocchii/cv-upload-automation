// Fechas en hora de Argentina. Vercel corre en UTC: sin esto, un CV que
// llega a las 22 hs del 15 queda fechado el 16.

const TZ = 'America/Argentina/Buenos_Aires';

// hourCycle h23 y no hour12:false: con hour12:false algunos motores
// muestran la medianoche como "24:00".
const PARTES = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** { dia: '2026-09-15', legible: '15/09/2026 22:05' } en hora argentina. */
export function fechaArgentina(date = new Date()) {
  const p = Object.fromEntries(PARTES.formatToParts(date).map(({ type, value }) => [type, value]));
  return {
    dia: `${p.year}-${p.month}-${p.day}`,
    legible: `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`,
  };
}
