/**
 * test-airlines-direto.mjs
 * Testa as funções de consulta de cias aéreas DIRETAMENTE (sem servidor, sem auth).
 *
 * Uso:  node tests/test-airlines-direto.mjs
 *
 * Substitua os localizadores por reservas reais para validar os dados retornados.
 */

// ─── Helpers duplicados do airlines.routes.js ─────────────────────────────────

function toData(val) {
    if (!val) return '';
    const m = String(val).match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
}
function toHora(val) {
    if (!val) return '';
    const s = String(val);
    if (/^\d{2}:\d{2}/.test(s)) return s.substring(0, 5);
    const m = s.match(/T(\d{2}:\d{2})/);
    return m ? m[1] : '';
}
function browserHeaders(origin, referer) {
    return {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Origin': origin,
        'Referer': referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="124","Google Chrome";v="124","Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
    };
}

// ─── AZUL ─────────────────────────────────────────────────────────────────────

async function consultarAzul(pnr, origem) {
    const referer = `https://www.voeazul.com.br/br/pt/home/minhas-viagens/confirmacao?pnr=${pnr}&origin=${origem}`;
    const headers = browserHeaders('https://www.voeazul.com.br', referer);
    const endpoints = [
        `https://b2c-api.voeazul.com.br/booking/v5/bookings/${pnr}?origin=${origem}`,
        `https://b2c-api.voeazul.com.br/booking/v4/bookings/${pnr}?origin=${origem}`,
    ];
    for (const ep of endpoints) {
        try {
            const r = await fetch(ep, { headers, signal: AbortSignal.timeout(10000) });
            console.log(`  → HTTP ${r.status} (${ep.split('?')[0].split('/').slice(-2).join('/')})`);
            if (r.ok) {
                const json = await r.json();
                if (json && Object.keys(json).length > 2) return extrairAzul(json, pnr, origem);
            }
            if (r.status === 403) return { success: false, blocked: true, httpStatus: 403, message: 'Bloqueado por Akamai (IP de datacenter)' };
            if (r.status === 404) return { success: false, blocked: false, httpStatus: 404, message: 'Reserva não encontrada — verifique localizador e origem' };
            if (r.status === 401) return { success: false, blocked: false, httpStatus: 401, message: 'Não autorizado — requer sessão de browser' };
        } catch (e) { console.log(`  → Erro: ${e.message}`); }
    }
    return { success: false, blocked: true, message: 'Bloqueado por Akamai' };
}
function extrairAzul(json, pnr, origemParam) {
    const root = json?.data || json;
    const journeys = root?.journeys || root?.booking?.journeys || [];
    if (!journeys.length) return { success: false, message: 'Sem journeys', raw: JSON.stringify(json).substring(0, 200) };
    const j0 = journeys[0], segs0 = j0.segments || j0.legs || [], seg0 = segs0[0] || j0;
    const origem  = seg0.departureStation || seg0.origin?.code  || j0.origin?.code  || j0.designator?.origin      || origemParam;
    const destino = seg0.arrivalStation   || seg0.destination?.code || j0.destination?.code || j0.designator?.destination || '';
    const dataIda = toData(seg0.std || seg0.departureDatetime || seg0.departureDate || j0.designator?.date || '');
    const horaIda = toHora(seg0.std || seg0.departureDatetime || '');
    const voo     = `AD ${seg0.flightNumber || seg0.identifier?.identifier || ''}`.trim();
    let dataVolta = '';
    if (journeys.length > 1) {
        const j1 = journeys[1], seg1 = (j1.segments || j1.legs || [])[0] || j1;
        dataVolta = toData(seg1.std || seg1.departureDatetime || seg1.departureDate || j1.designator?.date || '');
    }
    const p = root?.passengers?.[0];
    const passageiroNome = p ? `${p.name?.first||p.firstName||''} ${p.name?.last||p.lastName||''}`.trim() : '';
    return { success: true, cia: 'azul', localizador: pnr, origem, destino, dataIda, dataVolta, horaPartida: horaIda, voo, passageiroNome, fonte: 'api-direta' };
}

// ─── GOL ──────────────────────────────────────────────────────────────────────

async function obterTokenGol() {
    const tentativas = [
        { url: 'https://gol-auth-api.voegol.com.br/api/v2/oauth/token', body: 'grant_type=client_credentials&scope=anonymous' },
        { url: 'https://gol-auth-api.voegol.com.br/api/v2/oauth/token', body: 'grant_type=anonymous' },
        { url: 'https://gol-auth-api.voegol.com.br/api/v1/oauth/token', body: 'grant_type=client_credentials' },
    ];
    for (const { url, body } of tentativas) {
        try {
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'Origin': 'https://b2c.voegol.com.br' },
                body, signal: AbortSignal.timeout(8000)
            });
            console.log(`  [GOL-Auth] ${url.split('/').slice(-2).join('/')} → HTTP ${r.status}`);
            if (r.ok) {
                const json = await r.json();
                const token = json.access_token || json.token || json.response?.token;
                if (token) return token;
            }
        } catch (e) { console.log(`  [GOL-Auth] Erro: ${e.message}`); }
    }
    return null;
}
async function consultarGol(pnr, origem, sobrenome = '') {
    const token   = await obterTokenGol();
    const lnParam = sobrenome ? `&lastName=${encodeURIComponent(sobrenome)}` : '';
    const hdrs    = browserHeaders('https://b2c.voegol.com.br', 'https://b2c.voegol.com.br/minhas-viagens/encontrar-viagem');
    if (token) hdrs['Authorization'] = `Bearer ${token}`;
    const endpoints = [
        `https://booking-api.voegol.com.br/api/Booking/${pnr}?origin=${origem}${lnParam}`,
        `https://booking-api.voegol.com.br/api/Booking/retrieve?pnr=${pnr}&origin=${origem}${lnParam}`,
        `https://pnr-bnpl-validation-v2.voegol.com.br/api/pnr-validation/pnr/${pnr}?originIata=${origem}${sobrenome ? '&lastName='+encodeURIComponent(sobrenome) : ''}`,
    ];
    for (const ep of endpoints) {
        try {
            const r = await fetch(ep, { headers: hdrs, signal: AbortSignal.timeout(10000) });
            console.log(`  → HTTP ${r.status} (${ep.split('/').slice(3).join('/').split('?')[0]})`);
            if (r.ok) {
                const json = await r.json();
                const result = extrairGol(json, pnr, origem);
                if (result.success) return result;
            }
        } catch (e) { console.log(`  → Erro: ${e.message}`); }
    }
    return { success: false, blocked: true, message: 'Bloqueado (Cloudflare) ou token inválido' };
}
function extrairGol(json, pnr, origemParam) {
    const root = json?.data || json?.response || json;
    const journeys = root?.journeys || root?.flights || root?.itineraries || [];
    if (!journeys.length) return { success: false, message: 'Sem journeys' };
    const j0 = journeys[0], segs0 = j0.segments || j0.legs || [j0], seg0 = segs0[0];
    const origem  = seg0.departureStation || seg0.origin  || j0.origin  || origemParam;
    const destino = seg0.arrivalStation   || seg0.destination || j0.destination || '';
    const dataIda = toData(seg0.std || seg0.departureDate || seg0.departureDatetime || j0.departureDate || '');
    const horaIda = toHora(seg0.std || seg0.departureTime || seg0.departureDatetime || '');
    let dataVolta = '';
    if (journeys.length > 1) { const j1 = journeys[1], seg1 = (j1.segments||j1.legs||[j1])[0]; dataVolta = toData(seg1.std||seg1.departureDate||j1.departureDate||''); }
    const p = root?.passengers?.[0];
    const passageiroNome = p ? `${p.firstName||p.name?.first||''} ${p.lastName||p.name?.last||''}`.trim() : '';
    return { success: true, cia: 'gol', localizador: pnr, origem, destino, dataIda, dataVolta, horaPartida: horaIda, passageiroNome, fonte: 'api-direta' };
}

// ─── LATAM ────────────────────────────────────────────────────────────────────

async function consultarLatam(pnr, sobrenome = '') {
    const lnParam = sobrenome ? encodeURIComponent(sobrenome) : '';
    const referer = `https://www.latamairlines.com/br/pt/minhas-viagens/second-detail/?orderId=${pnr}&lastname=${lnParam}`;
    const hdrs    = { ...browserHeaders('https://www.latamairlines.com', referer), 'sec-fetch-site': 'same-origin' };
    const endpoints = [
        `https://www.latamairlines.com/bff/v1/orders/${pnr}${lnParam ? '?lastName='+lnParam : ''}`,
        `https://www.latamairlines.com/bff/v2/orders/${pnr}${lnParam ? '?lastName='+lnParam : ''}`,
        `https://api.latamairlines.com/v1/orders/${pnr}${lnParam ? '?lastName='+lnParam : ''}`,
    ];
    for (const ep of endpoints) {
        try {
            const r = await fetch(ep, { headers: hdrs, signal: AbortSignal.timeout(10000) });
            console.log(`  → HTTP ${r.status} (${ep.split('/').slice(3).join('/').split('?')[0]})`);
            if (r.ok) {
                const json = await r.json();
                const result = extrairLatam(json, pnr);
                if (result.success) return result;
            }
        } catch (e) { console.log(`  → Erro: ${e.message}`); }
    }
    return { success: false, blocked: true, message: 'LATAM requer sessão de browser (CSRF/cookies)' };
}
function extrairLatam(json, pnr) {
    const root = json?.data || json;
    const journeys = root?.journeys || root?.segments || root?.itineraries || [];
    if (!journeys.length) return { success: false, message: 'Sem journeys' };
    const j0 = journeys[0], segs0 = j0.segments || j0.legs || [j0], seg0 = segs0[0];
    const origem  = seg0.origin?.airportCode || seg0.departureAirport?.code || seg0.origin || j0.origin?.airportCode || j0.origin || '';
    const destino = seg0.destination?.airportCode || seg0.arrivalAirport?.code || seg0.destination || j0.destination?.airportCode || j0.destination || '';
    const dataIda = toData(seg0.departureDate || seg0.departure?.dateTime || j0.departureDate || '');
    const horaIda = toHora(seg0.departure?.dateTime || seg0.departureDate || '');
    let dataVolta = '';
    if (journeys.length > 1) { const j1 = journeys[1], seg1 = (j1.segments||j1.legs||[j1])[0]; dataVolta = toData(seg1.departureDate||seg1.departure?.dateTime||j1.departureDate||''); }
    const p = root?.passengers?.[0];
    const passageiroNome = p ? `${p.firstName||''} ${p.lastName||''}`.trim() : '';
    return { success: true, cia: 'latam', localizador: pnr, origem, destino, dataIda, dataVolta, horaPartida: horaIda, passageiroNome, fonte: 'api-direta' };
}

// ─── Formatação ───────────────────────────────────────────────────────────────

function formatar(r) {
    if (!r.success) {
        if (r.httpStatus === 404) return `  ⚠️  NÃO ENCONTRADO (${r.httpStatus}): ${r.message}`;
        if (r.blocked)           return `  🔒 BLOQUEADO: ${r.message}`;
        return `  ❌ ERRO: ${r.message}`;
    }
    return [
        `  ✅ SUCESSO (${r.fonte})`,
        `     Origem    : ${r.origem}`,
        `     Destino   : ${r.destino}`,
        `     Data Ida  : ${r.dataIda}   Volta: ${r.dataVolta || '(sem volta)'}`,
        `     Hora      : ${r.horaPartida || '-'}   Voo: ${r.voo || '-'}`,
        `     Passageiro: ${r.passageiroNome || '-'}`,
    ].join('\n');
}

// ─── Casos de teste ───────────────────────────────────────────────────────────
// Substitua pelos localizadores reais para validar os dados

// ── Substitua pelos localizadores reais de reservas ativas ───────────────────
const CASOS = [
    // Azul: localizador de 6 letras + origem IATA (ex: SSA, GRU, SDU)
    { fn: () => consultarAzul('VR6C3H', 'SSA'),            label: 'Azul  — VR6C3H / origem SSA (reserva de teste — pode estar expirada)' },
    // GOL: requer token de sessão do browser — retorna bloqueado sem Puppeteer
    { fn: () => consultarGol('ABCDEF', 'GRU', 'SILVA'),    label: 'GOL   — ABCDEF / GRU / SILVA (substituir por reserva real)' },
    // LATAM: número do pedido (9 dígitos) + sobrenome
    { fn: () => consultarLatam('123456789', 'SANTOS'),      label: 'LATAM — 123456789 / SANTOS (substituir por reserva real)' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('════════════════════════════════════════════════════════');
console.log(' GiraMundoTour — Teste direto das funções de consulta   ');
console.log('════════════════════════════════════════════════════════\n');

for (const { fn, label } of CASOS) {
    console.log(`▶ ${label}`);
    const t0 = Date.now();
    const resultado = await fn();
    console.log(`  Tempo: ${Date.now() - t0}ms`);
    console.log(formatar(resultado));
    console.log();
}

console.log('════════════════════════════════════════════════════════');
console.log('ℹ  "BLOQUEADO" = bot-protection ativa no IP atual.');
console.log('   Esperado em IPs de datacenter (Render/VPS).');
console.log('   Para teste real com localizadores válidos, substitua');
console.log('   os valores de CASOS acima por reservas existentes.');
console.log('════════════════════════════════════════════════════════');
