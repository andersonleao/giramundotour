/**
 * GiraMundoTour - Busca de preço em pontos (Azul)
 *
 * Faz scraping da página pública de resultados da Azul (voeazul.com.br) em
 * modo "Pontos" via Puppeteer, já que a Azul não expõe um endpoint REST
 * simples para isso (o app deles usa Firestore realtime + antifraude
 * ThreatMetrix). Só suporta busca de ida (sem volta) para uma data exata —
 * cada chamada já é um lançamento inteiro de Chromium, bem mais caro que uma
 * chamada HTTP comum, então mantemos o escopo mínimo.
 *
 * Seletores confirmados via inspeção ao vivo do DOM renderizado (não são
 * as classes "css-xxxxx" geradas por CSS-in-JS, que mudam a cada deploy):
 *   .flight-card__container      → card de um voo
 *   .flight-card__fare           → bloco de tarifa dentro do card
 *   .flight-card__fare h4.current    → preço atual em pontos, ex: "69.300pontos"
 *   .flight-card__fare p.condition   → tarifa híbrida, ex: "ou 6.930 pontos + R$ 672,44"
 *
 * A busca da Azul é intermitente (confirmado manualmente: uma tentativa
 * pode retornar "Ops! Tivemos um problema" e a seguinte funcionar) — todo
 * erro/timeout/bloqueio deve virar { ok:false, erro } e nunca lançar.
 */

const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin  = require('puppeteer-extra-plugin-stealth');
try { puppeteerExtra.use(StealthPlugin()); } catch (_) { /* já registrado */ }

const HARD_TIMEOUT_MS = 55000;
const NAV_TIMEOUT_MS  = 30000;

function toISODate(d) {
    // Colunas DATE do pg voltam como objeto Date (não string) quando o valor
    // passa pelo banco — precisa tratar os dois formatos.
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
}

function montarUrl({ origem, destino, dataIda, adultos }) {
    const [ano, mes, dia] = toISODate(dataIda).split('-');
    const dataUS = `${mes}/${dia}/${ano}`;
    const qs = new URLSearchParams({
        'c[0].ds': String(origem).toUpperCase(),
        'c[0].std': dataUS,
        'c[0].as': String(destino).toUpperCase(),
        'p[0].t': 'ADT',
        'p[0].c': String(adultos || 1),
        'p[0].cp': 'false',
        'f.dl': '3',
        'f.dr': '3',
        cc: 'PTS'
    });
    return `https://www.voeazul.com.br/br/pt/home/selecao-voo?${qs.toString()}`;
}

function parsePontos(texto) {
    if (!texto) return null;
    const digitos = String(texto).replace(/[^\d]/g, '');
    return digitos ? parseInt(digitos, 10) : null;
}

function parseCondicao(texto) {
    // "ou 6.930 pontos + R$ 672,44"
    if (!texto) return {};
    const mPontos = texto.match(/([\d.]+)\s*pontos/i);
    const mTaxa   = texto.match(/R\$\s*([\d.]+,\d{2})/);
    return {
        pontosComTaxa: mPontos ? parseInt(mPontos[1].replace(/\./g, ''), 10) : null,
        taxaBRL: mTaxa ? parseFloat(mTaxa[1].replace(/\./g, '').replace(',', '.')) : null
    };
}

/**
 * @param {{ origem:string, destino:string, dataIda:string, adultos?:number }} params
 * @returns {Promise<{ ok:boolean, pontos?:number, taxaBRL?:number, companhia?:string, erro?:string }>}
 */
async function buscarPrecoPontos({ origem, destino, dataIda, adultos = 1 }) {
    let browser;
    let travado = false;

    const hardTimeout = setTimeout(() => {
        travado = true;
        console.warn('[AzulPontos] HARD TIMEOUT', HARD_TIMEOUT_MS + 'ms');
        if (browser) browser.close().catch(() => {});
    }, HARD_TIMEOUT_MS);

    try {
        const url = montarUrl({ origem, destino, dataIda, adultos });
        console.log('[AzulPontos] buscando:', url);

        browser = await puppeteerExtra.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-gpu', '--no-zygote',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1366,768',
                '--disable-extensions', '--disable-background-networking', '--disable-sync',
                '--js-flags=--max_old_space_size=180',
                '--renderer-process-limit=1',
                '--enable-low-end-device-mode',
                '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                '--disable-ipc-flooding-protection'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1366, height: 768 });
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8' });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
            .catch(e => console.warn('[AzulPontos] nav warn:', e.message));

        if (travado) return { ok: false, erro: 'timeout' };

        // Bloqueio Akamai (título "Access Denied") ou erro genérico ("Ops! Tivemos um
        // problema") — ambos observados em testes manuais/automatizados reais.
        const estadoPagina = await page.evaluate(() => ({
            titulo: document.title || '',
            texto: (document.body?.innerText || '').slice(0, 300)
        })).catch(() => ({ titulo: '', texto: '' }));
        const BLOQUEIO_RE = /access denied|just a moment|checking your|attention required|robot|captcha/i;
        if (BLOQUEIO_RE.test(estadoPagina.titulo)) {
            return { ok: false, erro: 'bloqueado' };
        }
        if (/ops!\s*tivemos um problema/i.test(estadoPagina.texto)) {
            return { ok: false, erro: 'azul_erro_generico' };
        }

        try {
            await page.waitForSelector('.flight-card__fare h4.current', { timeout: 20000 });
        } catch (_) {
            const titulo = await page.title().catch(() => '');
            const corpo = await page.evaluate(() => (document.body?.innerText || '').slice(0, 300)).catch(() => '');
            const bloqueado = BLOQUEIO_RE.test(titulo + corpo);
            return { ok: false, erro: bloqueado ? 'bloqueado' : 'sem_resultados' };
        }

        if (travado) return { ok: false, erro: 'timeout' };

        const cards = await page.evaluate(() => {
            const containers = Array.from(document.querySelectorAll('.flight-card__container'));
            return containers.map(c => {
                const atual = c.querySelector('.flight-card__fare h4.current');
                const condicao = c.querySelector('.flight-card__fare p.condition');
                return {
                    atualTexto: atual ? atual.textContent.trim() : '',
                    condicaoTexto: condicao ? condicao.textContent.trim() : ''
                };
            });
        });

        const opcoes = cards
            .map(c => ({ pontos: parsePontos(c.atualTexto), ...parseCondicao(c.condicaoTexto) }))
            .filter(c => c.pontos != null);

        if (!opcoes.length) return { ok: false, erro: 'sem_resultados' };

        const melhor = opcoes.reduce((m, c) => (!m || c.pontos < m.pontos) ? c : m, null);

        return {
            ok: true,
            pontos: melhor.pontos,
            taxaBRL: melhor.taxaBRL ?? undefined,
            companhia: 'AD'
        };
    } catch (err) {
        console.error('[AzulPontos] erro:', err.message);
        return { ok: false, erro: err.message };
    } finally {
        clearTimeout(hardTimeout);
        if (browser) await browser.close().catch(() => {});
    }
}

module.exports = { buscarPrecoPontos, montarUrl };
