import fs from 'node:fs';

// Lista los defectos conocidos (pruebas con test.fail) para que no queden ocultos tras un resumen en verde.
// En GitHub Actions lo escribe en el resumen del job; en local lo imprime al final de la ejecución.
export default class KnownDefectsReporter {
  #defects = [];

  onTestEnd(test, result) {
    if (test.expectedStatus !== 'failed') return;
    const annotations = [...(result.annotations ?? []), ...test.annotations];
    const description = annotations.find(annotation => annotation.type === 'fail')?.description ?? '';
    this.#defects.push({
      id: description.match(/F\d+/)?.[0] ?? 'sin ID',
      title: test.title,
      stillOpen: result.status === 'failed'
    });
  }

  onEnd() {
    if (this.#defects.length === 0) return;
    const open = this.#defects.filter(defect => defect.stillOpen).length;
    const rows = this.#defects
      .sort((a, b) => a.id.localeCompare(b.id, 'es', { numeric: true }))
      .map(defect => {
        const status = defect.stillOpen ? 'Abierto' : 'Ya no falla: verificar la corrección y retirar test.fail()';
        return `| ${defect.id} | ${defect.title} | ${status} |`;
      });
    const markdown = [
      `### Defectos conocidos abiertos: ${open} (detalle en DIAGNOSTICO.md)`,
      '',
      '| Defecto | Prueba | Estado |',
      '|---|---|---|',
      ...rows,
      ''
    ].join('\n');

    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
    else console.log(`\n${markdown}`);
  }

  printsToStdio() {
    return !process.env.GITHUB_STEP_SUMMARY;
  }
}
