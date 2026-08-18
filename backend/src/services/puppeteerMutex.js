/**
 * GiraMundoTour - Mutex simples para lançamentos de Puppeteer
 *
 * Garante no máximo 1 instância de Chromium rodando por vez no processo,
 * evitando o tipo de OOM já visto em produção (Render) quando múltiplas
 * instâncias pesadas rodam concorrentemente.
 */

const WAIT_TIMEOUT_MS = parseInt(process.env.PUPPETEER_LOCK_WAIT_MS) || 120000;

let fila = Promise.resolve();

/**
 * Executa fn() serializado — só roda depois que qualquer chamada anterior
 * (via este mutex) terminar. Se a espera pelo lock passar de WAIT_TIMEOUT_MS,
 * rejeita sem executar fn (evita empilhar indefinidamente se algo travar).
 */
async function withPuppeteerLock(fn) {
    let liberar;
    const minhaVez = new Promise(resolve => { liberar = resolve; });

    const posicaoAnterior = fila;
    fila = fila.then(() => minhaVez);

    let timeoutId;
    const esperei = await Promise.race([
        posicaoAnterior.then(() => true),
        new Promise(resolve => { timeoutId = setTimeout(() => resolve(false), WAIT_TIMEOUT_MS); })
    ]);
    clearTimeout(timeoutId);

    if (!esperei) {
        liberar();
        throw new Error(`Timeout de ${WAIT_TIMEOUT_MS}ms aguardando lock do Puppeteer (outra tarefa travada?)`);
    }

    try {
        return await fn();
    } finally {
        liberar();
    }
}

module.exports = { withPuppeteerLock };
