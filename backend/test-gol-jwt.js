// Testa apenas evaluateOnNewDocument SEM blocking
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin  = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());
const PNR = 'SEOBQV', ORIGIN = 'REC', LASTNAME = 'SILVA';

(async () => {
    const t0 = Date.now();
    const el = () => Math.round((Date.now()-t0)/1000) + 's';

    const browser = await puppeteerExtra.launch({
        headless: true,
        args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote',
               '--disable-blink-features=AutomationControlled','--window-size=1280,720',
               '--disable-extensions','--disable-background-networking','--disable-sync',
               '--js-flags=--max_old_space_size=180','--renderer-process-limit=1','--enable-low-end-device-mode']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9' });

    await page.evaluateOnNewDocument(() => {
        window.__pnrBnplData = null;
        const origFetch = window.fetch.bind(window);
        window.fetch = async function(url, opts) {
            const response = await origFetch(url, opts);
            if (typeof url === 'string' && url.includes('pnrBnpl')) {
                try {
                    response.clone().json().then(data => {
                        if (data?.success && data?.response?.pnrRetrieveResponse)
                            window.__pnrBnplData = data;
                    }).catch(()=>{});
                } catch(_) {}
            }
            return response;
        };
    });

    page.on('response', resp => {
        const url = resp.url();
        if (url.includes('gol-auth-api') || url.includes('pnrBnpl'))
            console.log(`[${el()}] ${url.substring(0,70)} HTTP${resp.status()}`);
    });

    await page.goto(`https://b2c.voegol.com.br/minhas-viagens/encontrar-viagem?codigoReserva=${PNR}&origem=${ORIGIN}&sobrenome=${LASTNAME.toLowerCase()}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(()=>{});
    console.log(`[${el()}] domcontentloaded`);

    let pnrJson = null;
    for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 1000));
        pnrJson = await page.evaluate(() => window.__pnrBnplData).catch(() => null);
        if (pnrJson) { console.log(`[${el()}] pnrBnpl ✓ via evaluateOnNewDocument`); break; }
        if (i === 14) console.log(`[${el()}] aguardando pnrBnpl...`);
    }
    await browser.close();

    if (!pnrJson) { console.log(`[${el()}] ❌ Sem dados`); return; }
    const parts = pnrJson.response.pnrRetrieveResponse.pnr?.itinerary?.itineraryParts || [];
    console.log(`[${el()}] ✅ Trechos: ${parts.length}`);
    parts.forEach((p,i) => { const s=p.segments?.[0]||{}; console.log(` ${i}: ${s.origin}→${s.destination} ${s.departure} G3${s.flight?.flightNumber||''}`); });
})().catch(e => console.error('ERRO:', e.message));
