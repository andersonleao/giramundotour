/**
 * Teste de importação LATAM — bate no servidor de produção (Render)
 * Uso: node test-latam.js <LOCALIZADOR> <SOBRENOME>
 * Ex:  node test-latam.js CFYB FRANCA
 */
const jwt = require('jsonwebtoken');

const SECRET = 'giramundotour_jwt_secret_key_2024_altere_em_producao';
const BASE   = 'https://giramundotour.onrender.com';

const TOKEN = jwt.sign(
    { id: '2d097383-2831-481c-9b4b-f3c98e5b1dae', email: 'operador@giramundotour.com.br', perfil: 'operador' },
    SECRET,
    { expiresIn: '2h' }
);
const H = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN };

const [,, LOCALIZADOR, SOBRENOME] = process.argv;
if (!LOCALIZADOR || !SOBRENOME) {
    console.error('Uso: node test-latam.js <LOCALIZADOR> <SOBRENOME>');
    console.error('Ex:  node test-latam.js CFYB FRANCA');
    process.exit(1);
}

const URL_LATAM = `https://www.latamairlines.com/br/pt/minhas-viagens?identifier=${LOCALIZADOR}&lastName=${encodeURIComponent(SOBRENOME)}`;

(async () => {
    const t0 = Date.now();
    const s  = () => ((Date.now() - t0) / 1000).toFixed(0) + 's';

    console.log(`\n[${s()}] 🛫 Testando importação LATAM`);
    console.log(`        Localizador : ${LOCALIZADOR}`);
    console.log(`        Sobrenome   : ${SOBRENOME}`);
    console.log(`        URL         : ${URL_LATAM}`);
    console.log(`        Servidor    : ${BASE}\n`);

    let resp;
    try {
        resp = await fetch(`${BASE}/api/reservas/capturar`, {
            method: 'POST', headers: H,
            body: JSON.stringify({ url: URL_LATAM })
        });
    } catch (e) {
        console.error('❌ Falha na conexão:', e.message);
        process.exit(1);
    }

    let data;
    try { data = await resp.json(); }
    catch (e) { console.error('❌ Resposta não é JSON:', e.message); process.exit(1); }

    console.log(`[${s()}] HTTP ${resp.status}`);

    if (!data.success) {
        console.error('❌ Backend retornou erro:', data.message);
        process.exit(1);
    }

    const bd = data.bilheteData;
    console.log('\n──── bilheteData retornado pelo backend ────────────────');
    console.log(JSON.stringify(bd, null, 2));

    console.log('\n──── Avaliação ─────────────────────────────────────────');
    const ok  = (v, label) => console.log(`  ${v ? '✅' : '❌'} ${label}: ${v || '(vazio)'}`);
    ok(bd?.passageiroNome,   'Passageiro');
    ok(bd?.ida?.origem,      'Origem IDA');
    ok(bd?.ida?.destino,     'Destino IDA');
    ok(bd?.ida?.data,        'Data IDA');
    ok(bd?.ida?.horaPartida, 'Hora partida IDA');
    ok(bd?.ida?.voo,         'Voo IDA');
    if (bd?.volta) {
        ok(bd.volta.origem,   'Origem VOLTA');
        ok(bd.volta.destino,  'Destino VOLTA');
        ok(bd.volta.data,     'Data VOLTA');
    } else {
        console.log('  ℹ️  Sem trecho de volta (só ida)');
    }

    // Chamadas LATAM interceptadas pelo Puppeteer (page.on request)
    const reqCapture = data._latamIntercepted || [];
    console.log('\n──── Requests Puppeteer LATAM (page.on request) ────────');
    if (reqCapture.length === 0) {
        console.log('  (nenhum request LATAM capturado)');
    } else {
        reqCapture.forEach((c, i) => {
            console.log(`  [${i}] ${c.method} ${c.url?.substring(0, 100)}`);
            const hdrs = c.headers || {};
            const relevantes = Object.entries(hdrs).filter(([k]) => !/cookie|user-agent|accept-language|accept-encoding/i.test(k));
            if (relevantes.length) console.log(`       ${JSON.stringify(Object.fromEntries(relevantes)).substring(0, 300)}`);
            if (c.body) console.log(`       Body: ${c.body?.substring(0, 150)}`);
        });
    }

    // Chamadas LATAM interceptadas pelo fetch interceptor do SPA
    const intercepted = data._latamConsoleLogs || [];
    console.log('\n──── Fetch interceptor (injected BEFORE site JS) ───────');
    if (intercepted.length === 0) {
        console.log('  (nenhuma — SPA não fez fetch ou interceptor falhou)');
    } else {
        intercepted.forEach((c, i) => {
            console.log(`  [${i}] ${c.method} ${c.url?.substring(0, 100)}`);
            const hdrs = c.headers || {};
            const relevantes = Object.entries(hdrs).filter(([k]) => !/cookie|user-agent|accept-language/i.test(k));
            console.log(`       Headers: ${JSON.stringify(Object.fromEntries(relevantes)).substring(0, 300)}`);
            if (c.body) console.log(`       Body: ${c.body?.substring(0, 150)}`);
        });
    }

    // APIs capturadas
    console.log('\n──── APIs capturadas pelo Puppeteer ────────────────────');
    (data.apiData || []).forEach((e, i) =>
        console.log(`  [${i}] ${e.url?.substring(0, 120)}`)
    );

    // Texto da página (primeiros 1000 chars)
    console.log('\n──── pageText (primeiros 1000 chars) ──────────────────');
    console.log((data.pageText || '').substring(0, 1000));

    // Busca dados de voo no HTML (para diagnóstico)
    const html = data.pageHtml || '';
    const isoMatch = html.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/g) || [];
    const iataMatch = html.match(/"(?:departureCode|originCode|arrivalCode|destinationCode|airportCode|iataCode)"\s*:\s*"([A-Z]{3})"/g) || [];
    console.log('\n──── Dados no HTML (diagnóstico) ───────────────────────');
    console.log('  Datas ISO com hora:', [...new Set(isoMatch)].slice(0, 5));
    console.log('  IATAs encontrados: ', [...new Set(iataMatch)].slice(0, 6));

    const campos = [bd?.ida?.origem, bd?.ida?.destino, bd?.ida?.data].filter(Boolean);
    console.log('\n' + (campos.length >= 2 ? '✅ IMPORTAÇÃO OK' : '⚠️  Dados incompletos — ver log acima'));
    console.log(`Tempo total: ${s()}\n`);
})();
