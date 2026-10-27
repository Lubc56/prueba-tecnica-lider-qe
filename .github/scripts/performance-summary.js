import fs from 'node:fs';

// Escribe el resultado de k6 en el resumen del job de GitHub Actions (o en consola fuera de CI).
// Los umbrales se leen del propio resultado, así el resumen nunca duplica ni contradice el SLO del script.
const summaryPath = 'performance/results/summary.json';

function publish(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  else console.log(markdown);
}

if (!fs.existsSync(summaryPath)) {
  publish('### Rendimiento: sin resultados\n\nk6 no llegó a generar el resumen (revisa el log del paso anterior).');
  process.exit(0);
}

const { metrics } = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

// En el formato de --summary-export cada umbral vale true cuando se incumplió.
const rows = Object.entries(metrics).flatMap(([name, metric]) =>
  Object.entries(metric.thresholds ?? {}).map(([rule, breached]) => {
    const statistic = rule.split(/[<>]/)[0];
    const observed = statistic === 'rate' ? `${(metric.value * 100).toFixed(2)} %` : `${metric[statistic].toFixed(2)} ms`;
    return { breached, row: `| \`${name}\` | \`${rule}\` | ${observed} | ${breached ? '❌' : '✅'} |` };
  })
);
const passed = rows.every(({ breached }) => !breached);

publish(
  [
    `### Rendimiento: ${passed ? 'umbrales cumplidos' : 'UMBRALES INCUMPLIDOS'}`,
    '',
    `${metrics.http_reqs.count} peticiones (${metrics.http_reqs.rate.toFixed(1)}/s).`,
    '',
    '| Métrica | Umbral | Resultado | Estado |',
    '|---|---|---|---|',
    ...rows.map(({ row }) => row),
    ''
  ].join('\n')
);
