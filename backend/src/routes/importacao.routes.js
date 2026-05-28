/**
 * GiraMundoTour - Importação de Bilhetes por PNR
 *
 * Endpoint unificado que recebe {pnr, companhia, origem, lastName} e:
 *  - Roteia para o lookup correto (Azul / GOL / LATAM) reutilizando as rotas
 *    existentes em /api/reservas/{azul,gol}-lookup.
 *  - Normaliza a resposta no formato { codigoReserva, companhia, origem, destino,
 *    dataIda, horaPartida, horaChegada, passageiros[], trechos[], numeroVoo, ... }.
 *
 * O salvamento em si reusa POST /api/bilhetes — o frontend chama esse endpoint
 * após confirmar os dados retornados.
 */

const express = require('express');
const router  = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);

// ─────────────────────────────────────────────────────────────
// Helper: fetch interno passando Bearer adiante
// ─────────────────────────────────────────────────────────────
function buildInternalBase(req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host  = req.headers['x-forwarded-host']  || req.get('host');
    return `${proto}://${host}`;
}

async function internalPost(req, path, body) {
    const base = buildInternalBase(req);
    const resp = await fetch(`${base}${path}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization || '' },
        body:    JSON.stringify(body),
    });
    let json = null;
    try { json = await resp.json(); } catch (_) { /* ignore */ }
    return { status: resp.status, json };
}

async function internalGet(req, path) {
    const base = buildInternalBase(req);
    const resp = await fetch(`${base}${path}`, {
        headers: { Authorization: req.headers.authorization || '' },
    });
    let json = null;
    try { json = await resp.json(); } catch (_) { /* ignore */ }
    return { status: resp.status, json };
}

// ─────────────────────────────────────────────────────────────
// Normalizadores por companhia (extraem campos comuns para o
// frontend de Importação exibir cards estilo Traveos).
// ─────────────────────────────────────────────────────────────

/** Tenta extrair primeiro segmento de uma reserva Azul */
function normalizeAzul(data, pnr) {
    const journey  = data?.journeys?.[0] || data?.itinerary?.journeys?.[0] || {};
    const segments = journey.segments || data?.segments || [];
    const passageiros = (data?.passengers || data?.travelers || []).map(p => ({
        nome:      [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || '',
        tipo:      p.passengerType || p.type || 'ADT',
    }));

    const seg0 = segments[0] || {};
    const segN = segments[segments.length - 1] || seg0;

    return {
        codigoReserva: pnr,
        companhia:     'AZUL',
        origem:        seg0.origin || seg0.departureStation || '',
        destino:       segN.destination || segN.arrivalStation || '',
        dataIda:       (seg0.departureTime || seg0.departureDate || '').split('T')[0] || null,
        horaPartida:   ((seg0.departureTime || '').split('T')[1] || '').slice(0,5) || null,
        horaChegada:   ((segN.arrivalTime   || '').split('T')[1] || '').slice(0,5) || null,
        numeroVoo:     seg0.flightNumber ? `AD${seg0.flightNumber}` : '',
        passageiros,
        trechos: segments.map(s => ({
            companhia:  s.carrier || 'AD',
            numero:     s.flightNumber || '',
            origem:     s.origin || s.departureStation || '',
            destino:    s.destination || s.arrivalStation || '',
            partida:    s.departureTime || s.departureDate || '',
            chegada:    s.arrivalTime   || s.arrivalDate   || '',
        })),
        raw: data,
    };
}

/** Normaliza resposta do GOL lookup */
function normalizeGol(data, pnr) {
    const trechos     = data?.trechos || data?.flights || [];
    const passageiros = (data?.passageiros || data?.passengers || []).map(p => ({
        nome: p.nome || p.name || p.fullName || '',
        tipo: p.tipo || p.type || 'ADT',
    }));
    const seg0 = trechos[0] || {};
    const segN = trechos[trechos.length - 1] || seg0;

    return {
        codigoReserva: pnr,
        companhia:     'GOL',
        origem:        seg0.origem || seg0.origin || '',
        destino:       segN.destino || segN.destination || '',
        dataIda:       (seg0.data || seg0.date || '').split('T')[0] || null,
        horaPartida:   seg0.horaPartida || ((seg0.partida || '').split('T')[1] || '').slice(0,5) || null,
        horaChegada:   segN.horaChegada || ((segN.chegada || '').split('T')[1] || '').slice(0,5) || null,
        numeroVoo:     seg0.numeroVoo || (seg0.numero ? `G3${seg0.numero}` : ''),
        passageiros,
        trechos: trechos.map(s => ({
            companhia: s.companhia || 'G3',
            numero:    s.numeroVoo || s.numero || '',
            origem:    s.origem || '',
            destino:   s.destino || '',
            partida:   s.partida || s.horaPartida || '',
            chegada:   s.chegada || s.horaChegada || '',
        })),
        raw: data,
    };
}

/** Normaliza qualquer estrutura genérica retornada por /capturar (LATAM/outras) */
function normalizeGeneric(data, pnr, companhia) {
    const trechos     = data?.trechos || [];
    const passageiros = data?.passageiros || [];
    const seg0 = trechos[0] || {};
    const segN = trechos[trechos.length - 1] || seg0;

    return {
        codigoReserva: pnr,
        companhia,
        origem:        data?.origem  || seg0.origem  || '',
        destino:       data?.destino || segN.destino || '',
        dataIda:       data?.dataIda || (seg0.partida || '').split('T')[0] || null,
        horaPartida:   data?.horaPartida || seg0.horaPartida || null,
        horaChegada:   data?.horaChegada || segN.horaChegada || null,
        numeroVoo:     data?.numeroVoo || seg0.numeroVoo || '',
        passageiros:   passageiros.map(p => ({ nome: p.nome || '', tipo: p.tipo || 'ADT' })),
        trechos,
        raw: data,
    };
}

// ─────────────────────────────────────────────────────────────
// POST /api/importacao/pnr
// body: { pnr, companhia, origem, lastName? }
// companhia: AZUL | GOL | LATAM
// ─────────────────────────────────────────────────────────────
router.post('/pnr', async (req, res) => {
    const { pnr, companhia, origem, lastName } = req.body || {};

    if (!pnr || !companhia) {
        return res.status(400).json({ success: false, message: 'pnr e companhia são obrigatórios' });
    }
    const cia = String(companhia).toUpperCase();
    const code = String(pnr).toUpperCase().trim();

    try {
        if (cia === 'AZUL' || cia === 'AD') {
            if (!origem) return res.status(400).json({ success: false, message: 'origem (IATA) é obrigatório para Azul' });
            const { status, json } = await internalPost(req, '/api/reservas/azul-lookup', { pnr: code, origin: origem });
            if (status !== 200 || !json?.success) {
                return res.status(status || 500).json({ success: false, message: json?.message || 'Falha ao consultar Azul' });
            }
            return res.json({ success: true, bilhete: normalizeAzul(json.data || json, code) });
        }

        if (cia === 'GOL' || cia === 'G3') {
            if (!origem)   return res.status(400).json({ success: false, message: 'origem (IATA) é obrigatório para GOL' });
            if (!lastName) return res.status(400).json({ success: false, message: 'sobrenome é obrigatório para GOL' });

            // Inicia job assíncrono
            const init = await internalPost(req, '/api/reservas/gol-lookup', { pnr: code, origin: origem, lastName });
            if (init.status !== 200 || !init.json?.jobId) {
                return res.status(init.status || 500).json({ success: false, message: init.json?.message || 'Falha ao iniciar GOL lookup' });
            }
            const jobId = init.json.jobId;

            // Polling até 60s
            const start = Date.now();
            while (Date.now() - start < 60000) {
                await new Promise(r => setTimeout(r, 2500));
                const pol = await internalGet(req, `/api/reservas/gol-status/${jobId}`);
                const st  = pol.json?.status;
                if (st === 'completed' || st === 'done') {
                    return res.json({ success: true, bilhete: normalizeGol(pol.json.data || pol.json, code) });
                }
                if (st === 'failed' || st === 'error') {
                    return res.status(500).json({ success: false, message: pol.json?.error || 'GOL lookup falhou' });
                }
            }
            return res.status(504).json({ success: false, message: 'Timeout aguardando GOL lookup' });
        }

        if (cia === 'LATAM' || cia === 'LA') {
            if (!lastName) return res.status(400).json({ success: false, message: 'sobrenome é obrigatório para LATAM' });
            const url = `https://www.latamairlines.com/br/pt/minhas-viagens?identifier=${encodeURIComponent(code)}&lastName=${encodeURIComponent(lastName)}`;
            const { status, json } = await internalPost(req, '/api/reservas/capturar', { url });
            if (status !== 200 || !json?.success) {
                return res.status(status || 500).json({ success: false, message: json?.message || 'Falha ao consultar LATAM' });
            }

            // /capturar para LATAM retorna { bilheteData: { passageiroNome, ida, volta } }
            // Normaliza esses dados em formato padrão.
            const data = json.data || json;
            const bd = data?.bilheteData || data;
            const ida = bd?.ida || {};
            const vlt = bd?.volta || null;
            const trechos = [];
            if (ida.origem || ida.destino) {
                trechos.push({
                    companhia: 'LA',
                    numero:    ida.voo || '',
                    origem:    ida.origem || '',
                    destino:   ida.destino || '',
                    partida:   ida.data && ida.horaPartida ? `${ida.data}T${ida.horaPartida}` : (ida.data || ''),
                    chegada:   ida.data && ida.horaChegada ? `${ida.data}T${ida.horaChegada}` : (ida.data || ''),
                });
            }
            if (vlt && (vlt.origem || vlt.destino)) {
                trechos.push({
                    companhia: 'LA',
                    numero:    vlt.voo || '',
                    origem:    vlt.origem || '',
                    destino:   vlt.destino || '',
                    partida:   vlt.data && vlt.horaPartida ? `${vlt.data}T${vlt.horaPartida}` : (vlt.data || ''),
                    chegada:   vlt.data && vlt.horaChegada ? `${vlt.data}T${vlt.horaChegada}` : (vlt.data || ''),
                });
            }
            return res.json({ success: true, bilhete: {
                codigoReserva: code,
                companhia:     'LATAM',
                origem:        ida.origem  || '',
                destino:       ida.destino || '',
                dataIda:       ida.data    || null,
                horaPartida:   ida.horaPartida || null,
                horaChegada:   ida.horaChegada || null,
                numeroVoo:     ida.voo     || '',
                passageiros:   bd?.passageiroNome ? [{ nome: bd.passageiroNome, tipo: 'ADT' }] : [],
                trechos,
                raw: data,
            }});
        }

        return res.status(400).json({ success: false, message: `Companhia "${cia}" não suportada. Use AZUL, GOL ou LATAM.` });
    } catch (err) {
        console.error('[Importacao] erro:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
