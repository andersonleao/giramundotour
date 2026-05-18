/**
 * GiraMundoTour — API de Consulta de Reservas por Companhia Aérea
 *
 * POST /api/airlines/consultar
 *   Body: { cia, localizador, origem, sobrenome }
 *   cia       : "azul" | "gol" | "latam"
 *   localizador: código da reserva (PNR)
 *   origem    : código IATA do aeroporto de origem (obrigatório para Azul e GOL)
 *   sobrenome : sobrenome do passageiro (opcional para GOL, útil para LATAM)
 *
 * Retorna: { success, cia, localizador, origem, destino, dataIda, dataVolta,
 *            horaPartida, passageiroNome, fonte, blocked?, message? }
 */

const express = require('express');
const router  = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
        'Accept-Encoding': 'gzip, deflate, br',
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
        `https://b2c-api.voeazul.com.br/api/bookings/${pnr}?origin=${origem}`,
    ];

    for (const ep of endpoints) {
        try {
            const r = await fetch(ep, { headers, signal: AbortSignal.timeout(10000) });
            console.log(`[Airlines/Azul] ${ep} → HTTP ${r.status}`);
            if (r.ok) {
                const json = await r.json();
                if (json && Object.keys(json).length > 2) {
                    return extrairAzul(json, pnr, origem);
                }
            }
            if (r.status === 403) {
                return { success: false, blocked: true, cia: 'azul', localizador: pnr, httpStatus: 403, message: 'API Azul bloqueada por Akamai (IP de datacenter).' };
            }
            if (r.status === 404) {
                return { success: false, blocked: false, cia: 'azul', localizador: pnr, httpStatus: 404, message: 'Reserva Azul não encontrada — verifique o localizador e a origem.' };
            }
            if (r.status === 401) {
                return { success: false, blocked: false, cia: 'azul', localizador: pnr, httpStatus: 401, message: 'Azul: não autorizado — a API pode requerer sessão de browser.' };
            }
        } catch (e) {
            console.warn(`[Airlines/Azul] Erro:`, e.message);
        }
    }
    return { success: false, blocked: true, cia: 'azul', localizador: pnr, message: 'API Azul bloqueada ou inacessível.' };
}

function extrairAzul(json, pnr, origemParam) {
    const root     = json?.data || json;
    const journeys = root?.journeys || root?.booking?.journeys || [];
    if (!journeys.length) return { success: false, message: 'Sem journeys na resposta Azul', raw: json };

    const j0     = journeys[0];
    const segs0  = j0.segments || j0.legs || [];
    const seg0   = segs0[0] || j0;

    const origem    = seg0.departureStation || seg0.origin?.code  || seg0.origin  || j0.origin?.code  || j0.designator?.origin      || origemParam;
    const destino   = seg0.arrivalStation   || seg0.destination?.code || seg0.destination || j0.destination?.code || j0.designator?.destination || '';
    const dataIda   = toData(seg0.std || seg0.departureDatetime || seg0.departureDate || j0.designator?.date || '');
    const horaIda   = toHora(seg0.std || seg0.departureDatetime || '');
    const voo       = `AD ${seg0.flightNumber || seg0.identifier?.identifier || ''}`.trim();

    let dataVolta = '';
    if (journeys.length > 1) {
        const j1   = journeys[1];
        const seg1 = (j1.segments || j1.legs || [])[0] || j1;
        dataVolta  = toData(seg1.std || seg1.departureDatetime || seg1.departureDate || j1.designator?.date || '');
    }

    const p = root?.passengers?.[0];
    const passageiroNome = p ? `${p.name?.first || p.firstName || ''} ${p.name?.last || p.lastName || ''}`.trim() : '';

    return {
        success: true, cia: 'azul', localizador: pnr,
        origem, destino, dataIda, dataVolta, horaPartida: horaIda,
        voo, passageiroNome, fonte: 'api-direta'
    };
}

// ─── GOL ──────────────────────────────────────────────────────────────────────

async function obterTokenGol() {
    const authEndpoints = [
        { url: 'https://gol-auth-api.voegol.com.br/api/v2/oauth/token',            body: 'grant_type=client_credentials&client_id=b2c-web&scope=anonymous' },
        { url: 'https://gol-auth-api.voegol.com.br/api/v2/oauth/token',            body: 'grant_type=anonymous' },
        { url: 'https://gol-auth-api.voegol.com.br/api/v2/oauth/token',            body: 'grant_type=client_credentials' },
        { url: 'https://gol-auth-api.voegol.com.br/api/v1/oauth/token',            body: 'grant_type=client_credentials' },
        { url: 'https://gol-auth-api.voegol.com.br/oauth/token',                   body: 'grant_type=anonymous' },
        { url: 'https://gol-auth-api.voegol.com.br/connect/token',                 body: 'grant_type=client_credentials&client_id=b2c' },
        { url: 'https://api-b2c.voegol.com.br/api/v1/auth/token/anonymous',        body: '' },
        { url: 'https://booking-api.voegol.com.br/api/auth/token',                 body: 'grant_type=anonymous' },
    ];

    for (const { url, body } of authEndpoints) {
        try {
            const r = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'Origin': 'https://b2c.voegol.com.br',
                    'Referer': 'https://b2c.voegol.com.br/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                },
                body,
                signal: AbortSignal.timeout(8000)
            });
            console.log(`[Airlines/GOL-Auth] ${url} → HTTP ${r.status}`);
            if (r.ok) {
                const json = await r.json();
                const token = json.access_token || json.token || json.response?.token;
                if (token) { console.log('[Airlines/GOL-Auth] Token obtido!'); return token; }
            }
        } catch (e) {
            console.warn(`[Airlines/GOL-Auth] ${url}:`, e.message);
        }
    }
    return null;
}

async function consultarGol(pnr, origem, sobrenome = '') {
    const token   = await obterTokenGol();
    const lnParam = sobrenome ? `&lastName=${encodeURIComponent(sobrenome)}` : '';

    const baseHeaders = browserHeaders('https://b2c.voegol.com.br', 'https://b2c.voegol.com.br/minhas-viagens/encontrar-viagem');
    if (token) baseHeaders['Authorization'] = `Bearer ${token}`;

    const endpoints = [
        `https://booking-api.voegol.com.br/api/Booking/${pnr}?origin=${origem}${lnParam}`,
        `https://booking-api.voegol.com.br/api/Booking/retrieve?pnr=${pnr}&origin=${origem}${lnParam}`,
        `https://pnr-bnpl-validation-v2.voegol.com.br/api/pnr-validation/pnr/${pnr}?originIata=${origem}${sobrenome ? '&lastName=' + encodeURIComponent(sobrenome) : ''}`,
        `https://booking-api.voegol.com.br/api/Booking/search?pnr=${pnr}&origin=${origem}${lnParam}`,
    ];

    for (const ep of endpoints) {
        try {
            const r = await fetch(ep, { headers: baseHeaders, signal: AbortSignal.timeout(10000) });
            console.log(`[Airlines/GOL] ${ep} → HTTP ${r.status}`);
            if (r.ok) {
                const json = await r.json();
                const result = extrairGol(json, pnr, origem);
                if (result.success) return result;
                console.log(`[Airlines/GOL] Parser sem dados úteis:`, JSON.stringify(json).substring(0, 150));
            }
            if (r.status === 403) return { success: false, blocked: true,  cia: 'gol', localizador: pnr, httpStatus: 403, message: 'API GOL bloqueada por Cloudflare.' };
            if (r.status === 404) return { success: false, blocked: false, cia: 'gol', localizador: pnr, httpStatus: 404, message: 'Reserva GOL não encontrada — verifique o localizador, origem e sobrenome.' };
            if (r.status === 401) return { success: false, blocked: false, cia: 'gol', localizador: pnr, httpStatus: 401, message: 'GOL: não autorizado — token inválido ou ausente.' };
        } catch (e) {
            console.warn(`[Airlines/GOL] Erro em ${ep}:`, e.message);
        }
    }
    return { success: false, blocked: true, cia: 'gol', localizador: pnr, message: 'API GOL inacessível. Requer Puppeteer ou bypass de Cloudflare.' };
}

function extrairGol(json, pnr, origemParam) {
    const root     = json?.data || json?.response || json;
    const journeys = root?.journeys || root?.flights || root?.itineraries || [];
    if (!journeys.length) return { success: false, message: 'Sem journeys na resposta GOL' };

    const j0     = journeys[0];
    const segs0  = j0.segments || j0.legs || [j0];
    const seg0   = segs0[0];

    const origem    = seg0.departureStation || seg0.origin  || j0.origin  || origemParam;
    const destino   = seg0.arrivalStation   || seg0.destination || j0.destination || '';
    const dataIda   = toData(seg0.std || seg0.departureDate || seg0.departureDatetime || j0.departureDate || '');
    const horaIda   = toHora(seg0.std || seg0.departureTime || seg0.departureDatetime || '');
    const voo       = `G3 ${seg0.flightNumber || seg0.flightNumber || ''}`.trim();

    let dataVolta = '';
    if (journeys.length > 1) {
        const j1   = journeys[1];
        const seg1 = (j1.segments || j1.legs || [j1])[0];
        dataVolta  = toData(seg1.std || seg1.departureDate || seg1.departureDatetime || j1.departureDate || '');
    }

    const p = root?.passengers?.[0];
    const passageiroNome = p
        ? (p.firstName || p.name?.first || p.name || '').trim() + ' ' + (p.lastName || p.name?.last || '').trim()
        : '';

    return {
        success: true, cia: 'gol', localizador: pnr,
        origem, destino, dataIda, dataVolta, horaPartida: horaIda,
        voo, passageiroNome: passageiroNome.trim(), fonte: 'api-direta'
    };
}

// ─── LATAM ────────────────────────────────────────────────────────────────────

async function consultarLatam(pnr, sobrenome = '') {
    const lnParam   = sobrenome ? encodeURIComponent(sobrenome) : '';
    const referer   = `https://www.latamairlines.com/br/pt/minhas-viagens/second-detail/?orderId=${pnr}&lastname=${lnParam}`;
    const baseHdrs  = browserHeaders('https://www.latamairlines.com', referer);
    baseHdrs['sec-fetch-site'] = 'same-origin';

    const lnQ = lnParam ? `?lastName=${lnParam}` : '';
    const lnA = lnParam ? `&lastName=${lnParam}` : '';
    const endpoints = [
        `https://www.latamairlines.com/bff/v1/orders/${pnr}${lnQ}`,
        `https://www.latamairlines.com/bff/v2/orders/${pnr}${lnQ}`,
        `https://www.latamairlines.com/bff/v1/booking/retrieve?orderId=${pnr}${lnA}`,
        `https://www.latamairlines.com/bff/v1/orders/search?orderId=${pnr}${lnA}`,
        `https://api.latam.com/v1/orders/${pnr}${lnQ}`,
    ];

    for (const ep of endpoints) {
        try {
            const r = await fetch(ep, { headers: baseHdrs, signal: AbortSignal.timeout(10000) });
            console.log(`[Airlines/LATAM] ${ep} → HTTP ${r.status}`);
            if (r.ok) {
                const json = await r.json();
                const result = extrairLatam(json, pnr);
                if (result.success) return result;
                console.log(`[Airlines/LATAM] Parser sem dados úteis:`, JSON.stringify(json).substring(0, 150));
            }
            if (r.status === 403) return { success: false, blocked: true,  cia: 'latam', localizador: pnr, httpStatus: 403, message: 'API LATAM bloqueada (CSRF ou sessão obrigatória).' };
            if (r.status === 404) return { success: false, blocked: false, cia: 'latam', localizador: pnr, httpStatus: 404, message: 'Reserva LATAM não encontrada — verifique o número do pedido.' };
            if (r.status === 401) return { success: false, blocked: false, cia: 'latam', localizador: pnr, httpStatus: 401, message: 'LATAM: sessão de browser necessária.' };
        } catch (e) {
            console.warn(`[Airlines/LATAM] Erro em ${ep}:`, e.message);
        }
    }
    return { success: false, blocked: true, cia: 'latam', localizador: pnr, message: 'API LATAM requer sessão autenticada no browser (CSRF/cookies).' };
}

function extrairLatam(json, pnr) {
    const root     = json?.data || json;
    const journeys = root?.journeys || root?.segments || root?.itineraries || [];
    if (!journeys.length) return { success: false, message: 'Sem journeys na resposta LATAM' };

    const j0     = journeys[0];
    const segs0  = j0.segments || j0.legs || [j0];
    const seg0   = segs0[0];

    const origem  = seg0.origin?.airportCode || seg0.departureAirport?.code || seg0.origin || j0.origin?.airportCode || j0.origin || '';
    const destino = seg0.destination?.airportCode || seg0.arrivalAirport?.code || seg0.destination || j0.destination?.airportCode || j0.destination || '';
    const dataIda = toData(seg0.departureDate || seg0.departure?.dateTime || j0.departureDate || '');
    const horaIda = toHora(seg0.departure?.dateTime || seg0.departureDate || '');
    const voo     = `LA ${seg0.flightNumber || seg0.flight?.number || ''}`.trim();

    let dataVolta = '';
    if (journeys.length > 1) {
        const j1   = journeys[1];
        const seg1 = (j1.segments || j1.legs || [j1])[0];
        dataVolta  = toData(seg1.departureDate || seg1.departure?.dateTime || j1.departureDate || '');
    }

    const p = root?.passengers?.[0];
    const passageiroNome = p
        ? `${p.firstName || ''} ${p.lastName || ''}`.trim()
        : '';

    return {
        success: true, cia: 'latam', localizador: pnr,
        origem, destino, dataIda, dataVolta, horaPartida: horaIda,
        voo, passageiroNome, fonte: 'api-direta'
    };
}

// ─── Endpoint principal ───────────────────────────────────────────────────────

/**
 * POST /api/airlines/consultar
 * Consulta reserva em qualquer companhia pelo localizador.
 */
router.post('/consultar', authMiddleware, async (req, res) => {
    const { cia, localizador, origem, sobrenome } = req.body;

    if (!cia || !localizador) {
        return res.status(400).json({ success: false, message: '"cia" e "localizador" são obrigatórios.' });
    }

    const ciaLower = cia.toLowerCase().trim();
    const pnr      = localizador.trim().toUpperCase();
    const ori      = (origem    || '').trim().toUpperCase();
    const sob      = (sobrenome || '').trim().toUpperCase();

    if (!['azul', 'gol', 'latam'].includes(ciaLower)) {
        return res.status(400).json({ success: false, message: '"cia" deve ser: azul, gol ou latam.' });
    }
    if ((ciaLower === 'azul' || ciaLower === 'gol') && !ori) {
        return res.status(400).json({ success: false, message: '"origem" é obrigatória para Azul e GOL.' });
    }

    try {
        let result;
        if      (ciaLower === 'azul')  result = await consultarAzul(pnr, ori);
        else if (ciaLower === 'gol')   result = await consultarGol(pnr, ori, sob);
        else                           result = await consultarLatam(pnr, sob);
        res.json(result);
    } catch (err) {
        console.error(`[Airlines/${cia}] Erro interno:`, err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
