/**
 * GiraMundoTour - Rotas de Reservas
 *
 * POST /api/reservas/capturar       - Captura dados via Puppeteer
 * GET  /api/reservas                - Listar reservas salvas
 * POST /api/reservas                - Salvar/atualizar reserva no banco
 * PUT  /api/reservas/:id            - Atualizar reserva por ID
 * DELETE /api/reservas/:id          - Excluir reserva por ID
 */

const express        = require('express');
const router         = express.Router();
const puppeteer      = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin  = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());
const fs   = require('fs');
const path = require('path');
const { pool }           = require('../config/database');
const { authMiddleware } = require('../middleware/auth.middleware');
const AlertasService     = require('../services/alertas.service');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

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

function resolveVal(val) {
    if (!val) return '';
    if (typeof val === 'object') return val.local || val.dateTime || val.utc || val.value || '';
    return String(val);
}

/** Parseia chave no formato Navitaire:
 *  "~AD~2634~2026-02-20T13:05:00~AJU~REC~Y"
 *  "AJU~REC~2026-02-20T13:05:00~AD~2634~Y"
 *  "AJU~REC~20260220~1305~AD~2634~Y"
 */
function parseKey(key) {
    if (!key) return null;
    const parts = key.replace(/^~/, '').split('~').filter(Boolean);
    if (parts.length < 4) return null;

    let origin = '', destination = '', departure = '', carrier = '', number = '';

    // Detecta formato: primeiro token é IATA = formato origem~destino~data~...
    if (/^[A-Z]{3}$/.test(parts[0])) {
        origin      = parts[0];
        destination = parts[1] || '';
        const datePart = parts[2] || '';
        if (/^\d{8}$/.test(datePart)) {
            departure = `${datePart.substring(0,4)}-${datePart.substring(4,6)}-${datePart.substring(6,8)}`;
            // hora pode estar em parts[3]
            if (/^\d{4}$/.test(parts[3] || '')) {
                const h = parts[3];
                departure += `T${h.substring(0,2)}:${h.substring(2,4)}:00`;
                carrier = parts[4] || 'AD';
                number  = parts[5] || '';
            } else {
                carrier = parts[3] || 'AD';
                number  = parts[4] || '';
            }
        } else if (/^\d{4}-\d{2}-\d{2}/.test(datePart)) {
            departure = datePart;
            carrier = parts[3] || 'AD';
            number  = parts[4] || '';
        }
    } else if (/^[A-Z]{1,3}$/.test(parts[0])) {
        // formato: carrier~number~date~origin~dest
        carrier     = parts[0];
        number      = parts[1] || '';
        departure   = parts[2] || '';
        origin      = parts[3] || '';
        destination = parts[4] || '';
    }

    if (!origin || !destination) return null;

    return {
        origem:      origin,
        destino:     destination,
        data:        toData(departure),
        horaPartida: toHora(departure),
        voo:         carrier && number ? `${carrier} ${number}`.trim() : ''
    };
}

function extrairJourney(seg_or_journey, label, isSegment) {
    const obj = seg_or_journey;
    let origin = '', destination = '', departure = '', arrival = '', voo = '';

    // identifier do Azul B2C: tem departureStation, arrivalStation, std, sta, flightNumber
    const ident = obj.identifier || {};

    // Voo
    const carrier = ident.carrierCode || ident.carrier || 'AD';
    const number  = ident.flightNumber || ident.identifier || ident.number || '';
    if (carrier && number) voo = `${carrier} ${number}`.trim();

    // Origem / destino / horários — Azul guarda DENTRO de identifier
    origin      = ident.departureStation || ident.originStation      || '';
    destination = ident.arrivalStation   || ident.destinationStation || '';
    departure   = resolveVal(ident.std || ident.scheduledDeparture || '');
    arrival     = resolveVal(ident.sta || ident.scheduledArrival   || '');

    // Fallback: designator padrão Navitaire (no segmento ou no leg)
    if (!origin) {
        const des = obj.designator || obj.legs?.[0]?.designator || {};
        origin      = des.origin      || obj.origin      || obj.departureStation || '';
        destination = des.destination || obj.destination || obj.arrivalStation   || '';
        departure   = resolveVal(des.departure || obj.departureDateTime || obj.std || '');
        arrival     = resolveVal(des.arrival   || obj.arrivalDateTime   || obj.sta || '');
    }

    // Fallback: decodifica segmentKey base64url
    // Ex: "QUR_MjYzNH4..." → "AD~2634~ ~~REC~02/20/2026 13:05~AJU~02/20/2026 14:30~~"
    if (!origin) {
        const keyStr = obj.segmentKey || obj.journeyKey || obj.key || '';
        if (keyStr) {
            try {
                const decoded = Buffer.from(keyStr.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
                console.log(`[Reservas] segmentKey decoded (${label}):`, decoded);
                const iatas = decoded.match(/\b([A-Z]{3})\b/g) || [];
                const dates = [...decoded.matchAll(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/g)];
                if (iatas.length >= 2) { origin = iatas[0]; destination = iatas[1]; }
                if (dates[0]) departure = `${dates[0][3]}-${dates[0][1]}-${dates[0][2]}T${dates[0][4]}:00`;
                if (dates[1]) arrival   = `${dates[1][3]}-${dates[1][1]}-${dates[1][2]}T${dates[1][4]}:00`;
            } catch (_) {}
        }
    }

    console.log(`[Reservas] Journey ${label}: ${origin}→${destination} | dep:${departure} | arr:${arrival} | voo:${voo}`);
    return {
        origem:      origin,
        destino:     destination,
        data:        toData(departure),
        horaPartida: toHora(departure),
        horaChegada: toHora(arrival),
        voo
    };
}

function extrairPassageiro(root, pageHtml) {
    const src = root.passengers || root.booking?.passengers;
    if (src) {
        const lista = Array.isArray(src) ? src : Object.values(src);
        for (const p of lista) {
            if (!p) continue;
            if (p.name) {
                const nome = [p.name.first, p.name.last].filter(Boolean).join(' ').trim();
                if (nome.length >= 3) return nome;
            }
            if (p.firstName || p.lastName) {
                const nome = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
                if (nome.length >= 3) return nome;
            }
            if (typeof p === 'string' && p.length >= 3) return p;
        }
    }
    if (pageHtml) {
        const m = pageHtml.match(/([A-Z]{2,}(?:\s+[A-Z]{2,})+),?\s*\.?\s*Passageiro\s+categorizado/i);
        if (m) return m[1].trim();
    }
    return '';
}

function extrairBilheteAzul(apiData, pageHtml, pageText) {
    pageText = pageText || '';
    // ── Diagnóstico — salva para inspeção (como GOL) ──────────────────
    try {
        const logDir  = path.join(__dirname, '../../../backend/data');
        const logFile = path.join(logDir, 'azul_debug.json');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const diag = {
            timestamp: new Date().toISOString(),
            apisCount: apiData.length,
            apis: apiData.map(e => ({
                url:  e.url?.substring(0, 250),
                data: JSON.stringify(e.data)?.substring(0, 1000)
            }))
        };
        fs.writeFileSync(logFile, JSON.stringify(diag, null, 2), 'utf8');
        console.log('[Azul] Diagnóstico gravado em:', logFile);
    } catch (e) {
        console.warn('[Azul] Erro ao gravar diagnóstico:', e.message);
    }

    // ── Localiza API de booking — busca em cascata ────────────────────
    // 1) URL específica conhecida
    let entry = apiData.find(e =>
        e.url && e.url.includes('b2c-api.voeazul.com.br') &&
        (e.url.includes('/booking/v5/bookings/') || e.url.includes('/bookings/'))
    );

    // 2) Qualquer URL do domínio Azul que contenha "booking"
    if (!entry) {
        entry = apiData.find(e =>
            e.url && e.url.includes('voeazul.com.br') &&
            e.url.toLowerCase().includes('booking') &&
            e.data
        );
    }

    // 3) Qualquer API Azul com journeys no payload
    if (!entry) {
        entry = apiData.find(e => {
            if (!e.data) return false;
            const root = e.data?.data || e.data;
            return root.journeys || root.booking?.journeys;
        });
    }

    if (!entry) {
        console.log('[Reservas] Booking API não encontrada. URLs:');
        apiData.forEach((e, i) => console.log(`  [${i}] ${e.url}`));
        return null;
    }

    console.log('[Reservas] Booking API:', entry.url);
    const root = entry.data?.data || entry.data || {};
    console.log('[Reservas] root keys:', Object.keys(root));

    const journeys = root.journeys || root.booking?.journeys || [];
    console.log('[Reservas] journeys:', journeys.length);

    if (journeys.length > 0) {
        const j0 = journeys[0];
        console.log('[Reservas] journey[0] keys:', Object.keys(j0));

        // Mostra os segmentos
        const segs0 = j0.segments || j0.legs || [];
        console.log('[Reservas] segs count:', segs0.length);
        if (segs0.length > 0) {
            console.log('[Reservas] seg[0] keys:', Object.keys(segs0[0]));
            console.log('[Reservas] seg[0] full:', JSON.stringify(segs0[0]).substring(0, 1000));
        }
    }

    const passageiroNome = extrairPassageiro(root, pageHtml);
    console.log('[Reservas] passageiro:', passageiroNome);

    // ── Extrai dados de voo por journey ──────────────────────────────
    let ida = null, volta = null;

    for (let ji = 0; ji < Math.min(journeys.length, 2); ji++) {
        const journey = journeys[ji];
        const label = ji === 0 ? 'ida' : 'volta';

        // Tenta extrair do journey direto
        let result = extrairJourney(journey, label, false);

        // Se não achou origem, tenta via segments
        if (!result.origem) {
            const segs = journey.segments || journey.legs || [];
            if (segs.length > 0) {
                result = extrairJourney(segs[0], label, true);
            }
        }

        // Se ainda não achou, tenta via journeyKeys da API dedicada
        if (!result.origem) {
            const jkEntry = apiData.find(e =>
                e.url && e.url.includes('/journeyKeys/') &&
                e.url.includes('b2c-api.voeazul.com.br')
            );
            if (jkEntry) {
                console.log('[Reservas] journeyKeys entry:', JSON.stringify(jkEntry.data).substring(0, 500));
                // Tenta parsear chaves do array/objeto retornado
                const raw = jkEntry.data?.data || jkEntry.data || [];
                const keys = Array.isArray(raw) ? raw : Object.values(raw).flat();
                if (keys[ji] && typeof keys[ji] === 'string') {
                    const parsed = parseKey(keys[ji]);
                    if (parsed) result = { ...result, ...parsed };
                }
            }
        }

        if (ji === 0) ida   = result;
        else          volta = result;
    }

    // Se extraiu dados via API Azul, retorna
    if (ida?.data || ida?.origem) {
        const bilheteData = { passageiroNome, tripType: root.tripType || '', ida, volta };
        console.log('[Reservas] bilheteData (via API Azul):', JSON.stringify(bilheteData));
        return bilheteData;
    }

    // Fallback: tenta extração genérica (script tags, datas no HTML, etc.)
    console.log('[Reservas] API Azul não encontrada — usando extração genérica como fallback');
    return extrairBilheteGenerico('Azul', 'AD', 'AD[\\s\\-]?(\\d{3,4})', apiData, pageText, pageHtml);
}

// ─────────────────────────────────────────────
// Extração LATAM
// ─────────────────────────────────────────────

/**
 * Extrai datas ISO futuras com horário (2026-02-20T13:05) de uma string.
 */
function extrairDatasISO(str) {
    const limite = new Date();
    limite.setDate(limite.getDate() - 90);
    const minData = limite.toISOString().substring(0, 10);
    const matches = [...str.matchAll(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/g)]
        .map(m => ({ data: m[1], hora: m[2] }))
        .filter(d => d.data >= minData);

    const seen = new Set();
    return matches.filter(d => {
        if (seen.has(d.data)) return false;
        seen.add(d.data);
        return true;
    });
}

/**
 * Extrai datas ISO futuras SEM horário, de campos JSON como
 * "departureDate":"2026-02-20" — padrão comum em APIs LATAM/GOL.
 */
function extrairDatasISOCampos(str) {
    const limite = new Date();
    limite.setDate(limite.getDate() - 90);
    const minData = limite.toISOString().substring(0, 10);
    const matches = [...str.matchAll(/"(?:date|departureDate|arrivalDate|flightDate|outboundDate|inboundDate|departure_date|arrival_date|scheduledDeparture|scheduledArrival|dateOfDeparture|checkInDate|dataPartida|dataChegada|dataVoo|dataIda|dataVolta|dt_partida|dtPartida|dtChegada|travelDate|segmentDate|startDate|departureDay|arrivalDay|flightDatetime|dateTime|departureDateTime|arrivalDateTime|std|sta|etd|eta|flightDate|scheduleDate|operatingDate|serviceDate|journeyDate|legDate)"\s*:\s*"(\d{4}-\d{2}-\d{2})"/gi)]
        .map(m => ({ data: m[1], hora: '' }))
        .filter(d => d.data >= minData);

    const seen = new Set();
    return matches.filter(d => {
        if (seen.has(d.data)) return false;
        seen.add(d.data);
        return true;
    });
}

/**
 * Extrai datas por extenso em português, ex: "20 fev 2026", "20 de fevereiro de 2026".
 */
function extrairDatasPT(str) {
    const meses = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12 };
    const limite = new Date();
    limite.setDate(limite.getDate() - 90);
    const minData = limite.toISOString().substring(0, 10);
    const matches = [...str.matchAll(/(\d{1,2})\s+(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-záéíóú]*\.?\s+(?:de\s+)?(\d{4})/gi)]
        .map(m => {
            const mes = meses[m[2].substring(0,3).toLowerCase()] || 1;
            return { data: `${m[3]}-${String(mes).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`, hora: '' };
        })
        .filter(d => d.data >= minData);

    const seen = new Set();
    return matches.filter(d => {
        if (seen.has(d.data)) return false;
        seen.add(d.data);
        return true;
    });
}

/**
 * Extrai datas DD/MM/YYYY futuras de um texto.
 */
function extrairDatasBR(text) {
    const limite = new Date();
    limite.setDate(limite.getDate() - 90);
    const minData = limite.toISOString().substring(0, 10);
    const matches = [...text.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)]
        .map(m => ({ data: `${m[3]}-${m[2]}-${m[1]}`, hora: '' }))
        .filter(d => d.data >= minData);

    const seen = new Set();
    return matches.filter(d => {
        if (seen.has(d.data)) return false;
        seen.add(d.data);
        return true;
    });
}

/**
 * Extrai par origem/destino percorrendo o objeto JSON recursivamente.
 * Suporta LATAM BFF (departure.airportCode), Navitaire, Skyscanner, etc.
 */
function extrairRotaDeObjeto(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 12) return null;

    // Padrão 1: { departure: { airportCode: "GRU" }, arrival: { airportCode: "SSA" } }
    //           { departureAirport: { airportCode: "GRU" }, arrivalAirport: { ... } }
    const depObj = obj.departureAirport || obj.departure;
    const arrObj = obj.arrivalAirport   || obj.arrival;
    if (depObj && arrObj) {
        const o = typeof depObj === 'string' ? depObj
            : depObj.airportCode || depObj.iataCode || depObj.iata || depObj.code || depObj.stationCode || '';
        const d = typeof arrObj === 'string' ? arrObj
            : arrObj.airportCode || arrObj.iataCode || arrObj.iata || arrObj.code || arrObj.stationCode || '';
        if (/^[A-Z]{3}$/.test(o) && /^[A-Z]{3}$/.test(d) && o !== d) {
            return { origem: o, destino: d };
        }
    }

    // Padrão 2: campos diretos de pares origem/destino (string ou objeto com code)
    const pares = [
        ['departureCode',    'arrivalCode'],
        ['originCode',       'destinationCode'],
        ['from',             'to'],
        ['origin',           'destination'],
        ['stationDeparture', 'stationArrival'],
        ['departureStation', 'arrivalStation'],
        ['fromAirport',      'toAirport']
    ];
    for (const [ok, dk] of pares) {
        const ov = obj[ok], dv = obj[dk];
        if (!ov || !dv) continue;
        const o = typeof ov === 'string' ? ov : (ov.code || ov.airportCode || ov.iataCode || ov.iata || '');
        const d = typeof dv === 'string' ? dv : (dv.code || dv.airportCode || dv.iataCode || dv.iata || '');
        if (/^[A-Z]{3}$/.test(o) && /^[A-Z]{3}$/.test(d) && o !== d) {
            return { origem: o, destino: d };
        }
    }

    // Recursão em arrays e sub-objetos
    const vals = Array.isArray(obj) ? obj : Object.values(obj);
    for (const val of vals) {
        if (val && typeof val === 'object') {
            const found = extrairRotaDeObjeto(val, depth + 1);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Tenta extrair dados de voo de um objeto JSON genérico (stringify + regex).
 * Suporta LATAM, GOL e qualquer companhia com campos padronizados.
 */
function extrairDeJson(data, iataPrefix) {
    let str;
    try { str = JSON.stringify(data); } catch (_) { return null; }

    // Tenta datas em cascata: ISO com hora → ISO por campo → DD/MM/YYYY → extenso PT
    let datas = extrairDatasISO(str);
    if (datas.length === 0) datas = extrairDatasISOCampos(str);
    if (datas.length === 0) datas = extrairDatasBR(str);
    if (datas.length === 0) datas = extrairDatasPT(str);
    if (datas.length === 0) return null;

    // ── Rotas IATA ────────────────────────────────────────────────────────────
    // 1) Regex em campos diretos (nome_campo : "XYZ")
    const origemM  = str.match(/"(?:departureCode|originCode|departureAirport|originAirport|from|iataOrigin|stationDeparture|stationOrigin|departure_iata|origin_iata|departureStation|originStation)"\s*:\s*"([A-Z]{3})"/);
    const destinoM = str.match(/"(?:arrivalCode|destinationCode|arrivalAirport|destinationAirport|to|iataDestination|stationArrival|stationDestination|arrival_iata|destination_iata|arrivalStation|destinationStation)"\s*:\s*"([A-Z]{3})"/);

    let origemCode  = origemM?.[1]  || '';
    let destinoCode = destinoM?.[1] || '';

    // 2) Fallback: percorre o objeto recursivamente (captura LATAM BFF e similares)
    if (!origemCode || !destinoCode) {
        const rota = extrairRotaDeObjeto(data);
        if (rota) {
            if (!origemCode)  origemCode  = rota.origem;
            if (!destinoCode) destinoCode = rota.destino;
        }
    }

    // Número de voo genérico (LA, G3, etc.) — prefixo opcional para capturar "3050" ou "LA3050"
    const prefix = iataPrefix || '(?:LA|JJ|G3|AD)';
    const vooM = str.match(new RegExp(`"(?:flightNumber|flight_number|number|flightCode)"\\s*:\\s*"?(?:${prefix})?\\s*(\\d{3,4})"?`, 'i'));

    // Passageiro — tenta nome completo (firstName + lastName) ou só lastName
    const firstM = str.match(/"(?:firstName|givenName|first_name|nome|primeiroNome)"\s*:\s*"([^"]+)"/i);
    const lastM  = str.match(/"(?:lastName|surname|familyName|last_name|sobrenome)"\s*:\s*"([^"]+)"/i);
    const passageiroNome = [firstM?.[1], lastM?.[1]].filter(Boolean).join(' ').trim();

    return {
        passageiroNome,
        ida: {
            origem:      origemCode,
            destino:     destinoCode,
            data:        datas[0].data,
            horaPartida: datas[0].hora,
            horaChegada: '',
            voo: vooM ? `${iataPrefix || 'LA'} ${vooM[1]}` : ''
        },
        volta: datas.length > 1 ? {
            origem:      destinoCode,
            destino:     origemCode,
            data:        datas[1].data,
            horaPartida: datas[1].hora,
            horaChegada: '',
            voo: ''
        } : null
    };
}

/**
 * Extrator genérico para LATAM e VoeGOL.
 * @param {string} label       - Nome para logs ("LATAM" ou "GOL")
 * @param {string} iataPrefix  - Prefixo do voo ("LA" ou "G3")
 * @param {string} vooRegex    - Regex string para capturar número de voo
 * @param {Array}  apiData
 * @param {string} pageText
 * @param {string} pageHtml
 */
function extrairBilheteGenerico(label, iataPrefix, vooRegex, apiData, pageText, pageHtml) {
    console.log(`[Reservas ${label}] Iniciando extração...`);
    console.log(`[Reservas ${label}] APIs capturadas: ${apiData.length}`);
    apiData.forEach(e => console.log('  URL:', e.url?.substring(0, 150)));

    let passageiroNome = '';
    let ida   = null;
    let volta = null;

    // ── 1. Tenta cada resposta JSON capturada ─────────────────────────
    for (const entry of apiData) {
        if (!entry.data) continue;
        const r = extrairDeJson(entry.data, iataPrefix);
        if (r?.ida?.data) {
            console.log(`[Reservas ${label}] Dados via API:`, entry.url?.substring(0, 100));
            passageiroNome = r.passageiroNome || '';
            ida            = r.ida;
            volta          = r.volta || null;
            break;
        }
    }

    // ── 2. Script tags com JSON embutido (Next.js __NEXT_DATA__ e outros) ──
    if (!ida && pageHtml) {
        const scriptMatches = [...pageHtml.matchAll(/<script[^>]*>([\s\S]{50,}?)<\/script>/gi)];
        for (const sm of scriptMatches) {
            const content = sm[1].trim();
            if (!content.startsWith('{') && !content.startsWith('[')) continue;
            try {
                const parsed = JSON.parse(content);
                const r = extrairDeJson(parsed, iataPrefix);
                if (r?.ida?.data) {
                    passageiroNome = r.passageiroNome || '';
                    ida            = r.ida;
                    volta          = r.volta || null;
                    console.log(`[Reservas ${label}] Dados via script tag embutido`);
                    break;
                }
            } catch (_) {}
        }
    }

    // ── 3. Datas no HTML (ISO, campos, DD/MM/YYYY, extenso PT) ─────────
    // Guard: se ainda estamos na página de formulário (anti-bot bloqueou), não usar datas de HTML
    // pois seriam datas de cookies/analytics, não datas de voo reais.
    const _formIndicators = /encontrar\s*(?:minha\s*)?viagem|código\s*(?:da\s*)?reserva|sobrenome\s*do\s*passageiro|digite\s*o\s*código|consultar\s*reserva|buscar\s*reserva|localizador\s+da\s+reserva/i;
    const _isFormPage = _formIndicators.test(pageText);
    if (_isFormPage) console.log(`[Reservas ${label}] Página de formulário detectada — pulando step 3 (evita falso positivo)`);

    if (!ida && pageHtml && !_isFormPage) {
        let datas = extrairDatasISO(pageHtml);
        if (datas.length === 0) datas = extrairDatasISOCampos(pageHtml);
        if (datas.length === 0) datas = extrairDatasBR(pageHtml);
        if (datas.length === 0) datas = extrairDatasPT(pageHtml);

        if (datas.length > 0) {
            console.log(`[Reservas ${label}] Datas no HTML:`, datas);

            const origemM  = pageHtml.match(/"(?:departureCode|originCode|departureAirport|originAirport|from|iataOrigin|stationDeparture|stationOrigin|departureStation|fromAirport)"\s*:\s*"([A-Z]{3})"/);
            const destinoM = pageHtml.match(/"(?:arrivalCode|destinationCode|arrivalAirport|destinationAirport|to|iataDestination|stationArrival|stationDestination|arrivalStation|toAirport)"\s*:\s*"([A-Z]{3})"/);
            const vooM     = pageHtml.match(new RegExp(vooRegex));
            const passM    = pageHtml.match(/"(?:lastName|surname|familyName|sobrenome)"\s*:\s*"([^"]+)"/i);

            // Só usa datas do HTML se há pelo menos um código IATA (evita falso positivo de datas de cookie/analytics)
            if (!origemM && !destinoM) {
                console.log(`[Reservas ${label}] Step 3: datas sem IATA no HTML — possível falso positivo, pulando`);
            } else {
                if (!passageiroNome && passM) passageiroNome = passM[1].trim();

                ida = {
                    origem:      origemM?.[1]  || '',
                    destino:     destinoM?.[1] || '',
                    data:        datas[0].data,
                    horaPartida: datas[0].hora,
                    horaChegada: '',
                    voo: vooM ? `${iataPrefix} ${vooM[1]}` : ''
                };
                if (datas.length > 1) {
                    volta = {
                        origem:      destinoM?.[1] || '',
                        destino:     origemM?.[1]  || '',
                        data:        datas[1].data,
                        horaPartida: datas[1].hora,
                        horaChegada: '',
                        voo: ''
                    };
                }
            }
        }
    }

    // ── 4. pageText: ISO com hora, ISO por campo, DD/MM/YYYY, extenso PT ──
    if (!ida) {
        let datas = extrairDatasISO(pageText);
        if (datas.length === 0) datas = extrairDatasISOCampos(pageText);
        if (datas.length === 0) datas = extrairDatasBR(pageText);
        if (datas.length === 0) datas = extrairDatasPT(pageText);

        if (datas.length > 0) {
            console.log(`[Reservas ${label}] Datas no pageText:`, datas);
            ida = { origem: '', destino: '', data: datas[0].data, horaPartida: datas[0].hora, horaChegada: '', voo: '' };
            if (datas.length > 1) {
                volta = { origem: '', destino: '', data: datas[1].data, horaPartida: datas[1].hora, horaChegada: '', voo: '' };
            }
        }
    }

    if (!ida) ida = { origem: '', destino: '', data: '', horaPartida: '', horaChegada: '', voo: '' };

    const result = { passageiroNome, ida, volta };
    console.log(`[Reservas ${label}] Resultado final:`, JSON.stringify(result));
    return result;
}

function extrairBilheteLatam(apiData, pageText, pageHtml) {
    // Grava diagnóstico para análise (mesma abordagem do GOL/Azul)
    try {
        const logDir  = path.join(__dirname, '../../../backend/data');
        const logFile = path.join(logDir, 'latam_debug.json');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const domEntry = apiData.find(e => e.url === 'dom://latam-window-state');
        fs.writeFileSync(logFile, JSON.stringify({
            timestamp:       new Date().toISOString(),
            pageTextLength:  pageText.length,
            pageTextExcerpt: pageText.substring(0, 2000),
            apisCount:       apiData.length,
            apis: apiData.map(e => ({
                url:      e.url?.substring(0, 200),
                dataKeys: e.data ? Object.keys(e.data).slice(0, 30) : [],
                // Para o nextData, mostra até 8kb para inspeção
                dataExcerpt: e.url === 'dom://latam-window-state'
                    ? JSON.stringify(e.data).substring(0, 8000)
                    : undefined
            })),
            htmlExcerpt: pageHtml.substring(0, 3000)
        }, null, 2), 'utf8');
        console.log('[LATAM] Debug gravado. nextData source:', domEntry?.data?._s,
            '| keys:', domEntry?.data ? Object.keys(domEntry.data).slice(0,10) : 'none');
    } catch (_) {}

    // Primeiro tenta entry injetada via page.evaluate (window state / __NEXT_DATA__)
    const domEntry = apiData.find(e => e.url === 'dom://latam-window-state');
    if (domEntry?.data) {
        // __NEXT_DATA__ tem estrutura: { props: { pageProps: { booking: ... } } }
        const pageProps = domEntry.data?.props?.pageProps;
        const nextDataPayload = pageProps || domEntry.data;
        const r = extrairDeJson(nextDataPayload, 'LA');
        if (r?.ida?.data || r?.ida?.origem) {
            console.log('[LATAM] Dados extraídos via window state DOM (nextData.props.pageProps)');
            return r;
        }
        // Tenta também o objeto raiz
        const r2 = extrairDeJson(domEntry.data, 'LA');
        if (r2?.ida?.data || r2?.ida?.origem) {
            console.log('[LATAM] Dados extraídos via window state DOM (raiz)');
            return r2;
        }
    }

    return extrairBilheteGenerico('LATAM', 'LA', '(?:LA|JJ)\\s*(\\d{3,4})', apiData, pageText, pageHtml);
}

function extrairBilheteTap(apiData, pageText, pageHtml) {
    console.log('[TAP] Iniciando extração...');
    console.log('[TAP] APIs capturadas:', apiData.length);
    apiData.forEach(e => console.log('  URL:', e.url?.substring(0, 150)));

    let passageiroNome = '';
    let ida   = null;
    let volta = null;

    // ── 1. APIs interceptadas (flytap.com / tap.pt endpoints) ──────────────
    for (const entry of apiData) {
        if (!entry.data) continue;
        const r = extrairDeJson(entry.data, 'TP');
        if (r?.ida?.data) {
            passageiroNome = r.passageiroNome || '';
            ida            = r.ida;
            volta          = r.volta || null;
            console.log('[TAP] Dados via API:', entry.url?.substring(0, 100));
            break;
        }
    }

    // ── 2. JSON embutido em scripts ─────────────────────────────────────────
    if (!ida && pageHtml) {
        const scriptMatches = [...pageHtml.matchAll(/<script[^>]*>([\s\S]{50,}?)<\/script>/gi)];
        for (const sm of scriptMatches) {
            const content = sm[1].trim();
            if (!content.startsWith('{') && !content.startsWith('[')) continue;
            try {
                const parsed = JSON.parse(content);
                const r = extrairDeJson(parsed, 'TP');
                if (r?.ida?.data) {
                    passageiroNome = r.passageiroNome || '';
                    ida            = r.ida;
                    volta          = r.volta || null;
                    console.log('[TAP] Dados via script tag');
                    break;
                }
            } catch (_) {}
        }
    }

    // ── 3. Padrões específicos do HTML da TAP ──────────────────────────────
    // A TAP exibe datas no formato "DD Mon YYYY" (ex: "15 Mar 2026") ou ISO
    if (!ida && pageHtml) {
        // Aeroportos: procura padrões tipo "LIS" → "GRU" no HTML
        const iataMatch = pageHtml.match(/\b([A-Z]{3})\s*(?:&rarr;|→|>|<\/?\w+[^>]*>)*\s*([A-Z]{3})\b/);
        const origemM   = iataMatch ? iataMatch[1] : null;
        const destinoM  = iataMatch ? iataMatch[2] : null;

        // Datas: ISO, DD/MM/YYYY, extenso
        let datas = extrairDatasISO(pageHtml);
        if (datas.length === 0) datas = extrairDatasISOCampos(pageHtml);
        if (datas.length === 0) datas = extrairDatasBR(pageHtml);
        if (datas.length === 0) datas = extrairDatasPT(pageHtml);

        // Número de voo TAP: TP seguido de dígitos
        const vooM = pageHtml.match(/\bTP\s*(\d{3,4})\b/);

        if (datas.length > 0 && (origemM || vooM)) {
            ida = {
                origem:      origemM  || '',
                destino:     destinoM || '',
                data:        datas[0].data,
                horaPartida: datas[0].hora,
                horaChegada: '',
                voo: vooM ? `TP ${vooM[1]}` : ''
            };
            if (datas.length > 1) {
                volta = {
                    origem:      destinoM || '',
                    destino:     origemM  || '',
                    data:        datas[1].data,
                    horaPartida: datas[1].hora,
                    horaChegada: '',
                    voo: ''
                };
            }
            console.log('[TAP] Dados via HTML patterns');
        }
    }

    // ── 4. Fallback: pageText ───────────────────────────────────────────────
    if (!ida) {
        let datas = extrairDatasISO(pageText);
        if (datas.length === 0) datas = extrairDatasISOCampos(pageText);
        if (datas.length === 0) datas = extrairDatasBR(pageText);
        if (datas.length === 0) datas = extrairDatasPT(pageText);

        if (datas.length > 0) {
            console.log('[TAP] Datas no pageText:', datas);
            ida = { origem: '', destino: '', data: datas[0].data, horaPartida: datas[0].hora, horaChegada: '', voo: '' };
            if (datas.length > 1) {
                volta = { origem: '', destino: '', data: datas[1].data, horaPartida: datas[1].hora, horaChegada: '', voo: '' };
            }
        }
    }

    if (!ida) ida = { origem: '', destino: '', data: '', horaPartida: '', horaChegada: '', voo: '' };

    const result = { passageiroNome, ida, volta };
    console.log('[TAP] Resultado final:', JSON.stringify(result));
    return result;
}

function extrairBilheteGol(apiData, pageText, pageHtml) {
    // ── Diagnóstico GOL → grava em arquivo para inspeção ─────────────────────
    try {
        const logDir  = path.join(__dirname, '../../../backend/data');
        const logFile = path.join(logDir, 'gol_debug.json');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const apiStr = JSON.stringify(apiData.map(e => e.data));
        const diag = {
            timestamp:       new Date().toISOString(),
            pageTextLength:  pageText.length,
            pageTextExcerpt: pageText.substring(0, 3000),
            apisCount:       apiData.length,
            apis: apiData.map(e => ({
                url:  e.url?.substring(0, 250),
                data: JSON.stringify(e.data)?.substring(0, 800)
            })),
            isFormPage: /encontrar\s*(?:minha\s*)?viagem|código\s*(?:da\s*)?reserva|sobrenome\s*do\s*passageiro|digite\s*o\s*código|consultar\s*reserva|buscar\s*reserva/i.test(pageText),
            dates: {
                isoNoPageText:    extrairDatasISO(pageText),
                camposNoPageText: extrairDatasISOCampos(pageText),
                brNoPageText:     extrairDatasBR(pageText),
                ptNoPageText:     extrairDatasPT(pageText),
                isoNoHtml:        extrairDatasISO(pageHtml).slice(0, 5),
                brNoHtml:         extrairDatasBR(pageHtml).slice(0, 5),
                isoNasApis:       extrairDatasISO(apiStr).slice(0, 5),
                brNasApis:        extrairDatasBR(apiStr).slice(0, 5)
            }
        };
        fs.writeFileSync(logFile, JSON.stringify(diag, null, 2), 'utf8');
        console.log('[GOL] Diagnóstico gravado em:', logFile);
    } catch (e) {
        console.warn('[GOL] Erro ao gravar diagnóstico:', e.message);
    }
    // ─────────────────────────────────────────────────────────────────────────

    return extrairBilheteGenerico('GOL', 'G3', 'G3\\s*(\\d{3,4})', apiData, pageText, pageHtml);
}

// ─────────────────────────────────────────────
// Rota principal
// ─────────────────────────────────────────────

router.post('/capturar', async (req, res) => {
    let { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL é obrigatória' });

    console.log(`[Reservas] Capturando: ${url}`);
    let browser = null;

    const isAzul  = url.includes('voeazul.com.br');
    const isLatam = url.includes('latamairlines.com') || url.includes('latam.com');
    const isGol   = url.includes('voegol.com.br') || url.includes('b2c.voegol');
    const isTap   = url.includes('flytap.com');

    try {
        const launchOptions = {
            headless: true,
            args: [
                '--no-sandbox', '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
                '--disable-gpu', '--window-size=1366,768',
                '--disable-blink-features=AutomationControlled'
            ]
        };
        // Em produção (Linux/VPS), usa o Chromium do sistema via variável de ambiente
        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }

        // GOL: puppeteer-real-browser corrige TLS fingerprint e bypassa Cloudflare Bot Management
        // Fallback: puppeteer-extra stealth + Chrome real não-headless (Xvfb no Linux)
        let golPage = null;
        if (isGol) {
            try {
                const { connect: realConnect } = require('puppeteer-real-browser');
                const chromeExeReal = [
                    process.env.CHROME_PATH,
                    process.env.PUPPETEER_EXECUTABLE_PATH,
                    '/usr/bin/chromium-browser',
                    '/usr/bin/google-chrome-stable',
                    '/usr/bin/google-chrome',
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                ].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch { return false; } });

                console.log('[GOL] puppeteer-real-browser: iniciando bypass TLS Cloudflare...');
                const realResult = await realConnect({
                    headless: false,
                    args: [
                        '--no-sandbox', '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--window-size=1280,800',
                        '--window-position=9999,9999',
                    ],
                    customConfig: chromeExeReal ? { chromePath: chromeExeReal } : {},
                    turnstile: false,
                    connectOption: { defaultViewport: { width: 1366, height: 768 } },
                    disableXvfb: true,
                });
                browser = realResult.browser;
                golPage = realResult.page;
                console.log('[GOL] puppeteer-real-browser: OK — TLS fingerprint corrigido');
            } catch (eReal) {
                console.warn('[GOL] puppeteer-real-browser falhou:', eReal.message, '— usando fallback stealth');
                // Fallback: puppeteer-extra com stealth + Chrome real não-headless
                const temDisplay = process.platform === 'win32' || !!process.env.DISPLAY;
                const chromeExe = [
                    process.env.CHROME_PATH,
                    process.env.PUPPETEER_EXECUTABLE_PATH,
                    '/usr/bin/chromium-browser',
                    '/usr/bin/google-chrome-stable',
                    '/usr/bin/google-chrome',
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                ].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch { return false; } });

                const golOptions = {
                    headless: !temDisplay,
                    args: [
                        '--no-sandbox', '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-blink-features=AutomationControlled',
                        '--window-size=1280,800',
                    ],
                };
                if (temDisplay) golOptions.args.push('--window-position=9999,9999');
                if (chromeExe) {
                    golOptions.executablePath = chromeExe;
                    console.log('[GOL] Chrome real (fallback):', chromeExe);
                }
                try {
                    browser = await puppeteerExtra.launch(golOptions);
                } catch (eGol) {
                    if (eGol.message.includes('X server') || eGol.message.includes('headful') || eGol.message.includes('DISPLAY')) {
                        browser = await puppeteerExtra.launch({ ...golOptions, headless: true });
                    } else {
                        throw eGol;
                    }
                }
            }
        } else if (isAzul || isLatam) {
            // Azul e LATAM usam Akamai Bot Manager — puppeteer-real-browser corrige TLS fingerprint
            const _lbl = isLatam ? 'LATAM' : 'Azul';
            let akamaiPage = null;
            try {
                const { connect: realConnectAk } = require('puppeteer-real-browser');
                const chromeExeAk = [
                    process.env.CHROME_PATH,
                    process.env.PUPPETEER_EXECUTABLE_PATH,
                    '/usr/bin/chromium-browser',
                    '/usr/bin/google-chrome-stable',
                    '/usr/bin/google-chrome',
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                ].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch { return false; } });

                console.log(`[${_lbl}] puppeteer-real-browser: iniciando bypass Akamai...`);
                const realResultAk = await realConnectAk({
                    headless: false,
                    args: [
                        '--no-sandbox', '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--window-size=1280,800',
                        '--window-position=9999,9999',
                    ],
                    customConfig: chromeExeAk ? { chromePath: chromeExeAk } : {},
                    turnstile: false,
                    connectOption: { defaultViewport: { width: 1366, height: 768 } },
                    disableXvfb: true,
                });
                browser    = realResultAk.browser;
                akamaiPage = realResultAk.page;
                console.log(`[${_lbl}] puppeteer-real-browser: OK`);
            } catch (eAkReal) {
                console.warn(`[${_lbl}] puppeteer-real-browser falhou:`, eAkReal.message, '— usando fallback stealth');
                browser    = await puppeteerExtra.launch(launchOptions);
                akamaiPage = null;
            }
            // Cria nova página se real-browser não retornou uma
            const _akNewPage = akamaiPage || await browser.newPage();
            if (!akamaiPage) {
                await _akNewPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
            }
            await _akNewPage.setViewport({ width: 1366, height: 768 });
            // Continua usando _akNewPage como page — reatribui via const abaixo
            golPage = _akNewPage; // reutiliza a variável golPage para simplificar o fluxo
        } else {
            browser = await puppeteer.launch(launchOptions);
        }

        // puppeteer-real-browser já retorna a página pronta; nos demais casos cria nova
        const page = golPage || await browser.newPage();
        if (!golPage) {
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        }
        await page.setViewport({ width: 1366, height: 768 });

        const apiData = [];
        // Intercepta requisições de saída LATAM para capturar URL/headers usados pelo SPA
        const _latamReqCapture = [];
        if (isLatam) {
            page.on('request', req => {
                const u = req.url();
                if (!u.includes('latamairlines.com')) return;
                if (u.includes('MX8t95') || u.includes('go-mpulse') || u.includes('/locales/')) return;
                _latamReqCapture.push({
                    method:  req.method(),
                    url:     u,
                    headers: req.headers(),
                    body:    req.postData()
                });
                console.log(`[LATAM REQ] ${req.method()} ${u.substring(0, 120)}`);
                console.log(`[LATAM REQ HEADERS] ${JSON.stringify(req.headers()).substring(0, 300)}`);
            });
        }
        // Captura logs do console do browser (inclui __LATAM_FETCH__ do interceptor)
        const _consoleLogs = [];
        if (isLatam) {
            page.on('console', msg => {
                const txt = msg.text();
                if (txt.startsWith('__LATAM_FETCH__:')) {
                    try {
                        const info = JSON.parse(txt.substring('__LATAM_FETCH__:'.length));
                        _consoleLogs.push(info);
                        console.log('[LATAM FETCH INTERCEPTADO]', info.method, info.url.substring(0, 100));
                        console.log('[LATAM FETCH HEADERS]', JSON.stringify(info.headers).substring(0, 400));
                    } catch (_) {}
                }
            });
        }
        page.on('response', async response => {
            const ct = response.headers()['content-type'] || '';
            if (!ct.includes('application/json')) return;
            const respUrl = response.url();
            try {
                const text = await response.text();
                if (!text || text.length < 5) return;
                const json = JSON.parse(text);
                apiData.push({ url: respUrl, data: json });
                console.log(`[Reservas] JSON capturado: ${respUrl.substring(0, 200)}`);
            } catch (_) {}
        });

        // GOL: FlareSolverr para cookies CF (somente no fallback — puppeteer-real-browser bypassa nativamente)
        if (isGol && !golPage) {
            try {
                console.log('[GOL] FlareSolverr: obtendo cookies Cloudflare...');
                const fsResp = await fetch('http://localhost:8191/v1', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cmd: 'request.get',
                        url: 'https://b2c.voegol.com.br/minhas-viagens/encontrar-viagem',
                        maxTimeout: 60000
                    })
                });
                const fsData = await fsResp.json();
                if (fsData.status === 'ok' && fsData.solution) {
                    const cfCookies = fsData.solution.cookies || [];
                    const cfUA      = fsData.solution.userAgent || '';
                    if (cfUA) {
                        await page.setUserAgent(cfUA);
                        console.log('[GOL] FlareSolverr: User-Agent atualizado');
                    }
                    if (cfCookies.length > 0) {
                        await page.setCookie(...cfCookies.map(c => ({
                            name:     c.name,
                            value:    c.value,
                            domain:   c.domain   || '.voegol.com.br',
                            path:     c.path     || '/',
                            expires:  c.expires  || -1,
                            httpOnly: c.httpOnly || false,
                            secure:   c.secure   || false,
                        })));
                        console.log(`[GOL] FlareSolverr: ${cfCookies.length} cookies CF configurados — Cloudflare bypassado`);
                    }
                } else {
                    console.warn('[GOL] FlareSolverr retornou status:', fsData.status);
                }
            } catch (fsErr) {
                console.warn('[GOL] FlareSolverr indisponível, tentando sem bypass:', fsErr.message);
            }
        }

        // LATAM: injeta interceptor de fetch + XHR para capturar URL+headers usados pelo SPA
        if (isLatam) {
            await page.evaluateOnNewDocument(() => {
                const _log = (method, url, headers, body) => {
                    if (!url.includes('latamairlines.com')) return;
                    if (url.includes('MX8t95') || url.includes('/locales/') || url.includes('go-mpulse')) return;
                    console.log('__LATAM_FETCH__:' + JSON.stringify({ method, url, headers, body }));
                };

                // Intercept fetch
                const _origFetch = window.fetch;
                window.fetch = async function(...args) {
                    const req = args[0];
                    const opts = args[1] || {};
                    const u = typeof req === 'string' ? req : req?.url || '';
                    const hdrs = {};
                    if (opts.headers) {
                        if (opts.headers instanceof Headers) {
                            opts.headers.forEach((v, k) => { hdrs[k] = v; });
                        } else { Object.assign(hdrs, opts.headers); }
                    }
                    _log(opts.method || 'GET', u, hdrs, typeof opts.body === 'string' ? opts.body.substring(0, 500) : null);
                    return _origFetch.apply(this, args);
                };

                // Intercept XHR
                const _origOpen  = XMLHttpRequest.prototype.open;
                const _origSend  = XMLHttpRequest.prototype.send;
                const _origSetHdr = XMLHttpRequest.prototype.setRequestHeader;
                XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                    this._interceptMethod = method;
                    this._interceptUrl    = url;
                    this._interceptHdrs   = {};
                    return _origOpen.apply(this, [method, url, ...rest]);
                };
                XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
                    if (this._interceptHdrs) this._interceptHdrs[name] = value;
                    return _origSetHdr.apply(this, [name, value]);
                };
                XMLHttpRequest.prototype.send = function(body) {
                    _log(this._interceptMethod || 'GET', this._interceptUrl || '', this._interceptHdrs || {}, body?.substring?.(0, 500) || null);
                    return _origSend.apply(this, [body]);
                };
            }).catch(e => console.warn('[LATAM] evaluateOnNewDocument erro:', e.message));
        }

        // LATAM: transforma URL second-detail → pública ANTES de navegar (evita dois page.goto competindo)
        if (isLatam && url.includes('second-detail')) {
            const _uObj = new URL(url);
            let _loc = _uObj.searchParams.get('identifier') || '';
            let _sob = _uObj.searchParams.get('lastName') || _uObj.searchParams.get('lastname') || '';
            if (!_loc) {
                let _oid = _uObj.searchParams.get('orderId') || '';
                // Strip prefixo "LA" e usa o número completo (ex: LA9578032HXQU → 9578032HXQU)
                if (/^LA/i.test(_oid)) _oid = _oid.substring(2);
                _loc = _oid;
            }
            if (_loc) {
                url = `https://www.latamairlines.com/br/pt/minhas-viagens?identifier=${_loc}&lastName=${encodeURIComponent(_sob)}`;
                console.log('[LATAM] URL pré-transformada (antes do goto):', url);
            }
        }

        // Inicia navegação
        page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
            .catch(e => console.warn('[Reservas] Nav:', e.message));

        if (isAzul) {
            // Azul: navega para /confirmacao?pnr=...&origin=... — SPA carrega booking direto
            const urlObj  = new URL(url);
            const pnrAzul = urlObj.searchParams.get('pnr')    || '';
            const oriAzul = urlObj.searchParams.get('origin') || '';
            console.log(`[Azul] pnr="${pnrAzul}" origin="${oriAzul}"`);

            // 1) Tenta fetch direto no Node.js com headers de browser real (mais rápido que Puppeteer)
            const azulNodeHeaders = {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Origin': 'https://www.voeazul.com.br',
                'Referer': url,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
            };
            for (const ep of [
                `https://b2c-api.voeazul.com.br/booking/v5/bookings/${pnrAzul}?origin=${oriAzul}`,
                `https://b2c-api.voeazul.com.br/booking/v4/bookings/${pnrAzul}?origin=${oriAzul}`,
            ]) {
                try {
                    const nr = await fetch(ep, { headers: azulNodeHeaders });
                    console.log(`[Azul] Fetch direto Node: HTTP ${nr.status} para ${ep}`);
                    if (nr.ok) {
                        const json = await nr.json();
                        if (json && Object.keys(json).length > 2) {
                            apiData.push({ url: ep, data: json });
                            console.log('[Azul] Fetch direto Node: dados obtidos!');
                            break;
                        }
                    }
                } catch (eNode) {
                    console.warn('[Azul] Fetch direto Node error:', eNode.message);
                }
            }

            // 2) Aguarda qualquer JSON da Azul via listener da página Puppeteer
            const bookingApiFilter = resp => {
                const u  = resp.url();
                const ct = resp.headers()['content-type'] || '';
                return (u.includes('b2c-api.voeazul.com.br') || u.includes('api.voeazul.com.br')) &&
                       (ct.includes('application/json') || ct.includes('text/json'));
            };
            if (apiData.length === 0) {
                try {
                    await page.waitForResponse(bookingApiFilter, { timeout: 30000 });
                    console.log('[Azul] API respondeu via listener — aguardando +4s');
                    await new Promise(r => setTimeout(r, 4000));
                } catch (_) {
                    console.warn('[Azul] API não respondeu via listener — tentando chamada direta do browser...');
                }
            }

            // Tenta chamar a API de booking diretamente do contexto do browser (tem cookies de sessão)
            const jaTemBooking = apiData.some(e =>
                (e.url?.includes('b2c-api.voeazul.com.br') || e.url?.includes('api.voeazul.com.br')) &&
                e.data && Object.keys(e.data).length > 2
            );
            if (!jaTemBooking) {
                try {
                    const azulDirect = await page.evaluate(async (pnr, origin) => {
                        const endpoints = [
                            `https://b2c-api.voeazul.com.br/booking/v5/bookings/${pnr}?origin=${origin}`,
                            `https://b2c-api.voeazul.com.br/booking/v4/bookings/${pnr}?origin=${origin}`,
                            `https://b2c-api.voeazul.com.br/api/bookings/${pnr}?origin=${origin}`,
                            `https://b2c-api.voeazul.com.br/booking/v5/bookings?recordLocator=${pnr}&origin=${origin}`,
                        ];
                        for (const ep of endpoints) {
                            try {
                                const resp = await fetch(ep, {
                                    credentials: 'include',
                                    headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
                                });
                                if (resp.ok) {
                                    const text = await resp.text();
                                    if (text && text.length > 20) {
                                        try { return { url: ep, data: JSON.parse(text) }; }
                                        catch { return { url: ep, data: { rawText: text.substring(0, 300) } }; }
                                    }
                                }
                            } catch (_) {}
                        }
                        return null;
                    }, pnrAzul, oriAzul);
                    if (azulDirect?.data) {
                        apiData.push(azulDirect);
                        console.log('[Azul] Chamada direta OK:', azulDirect.url);
                    } else {
                        console.log('[Azul] Chamada direta sem dados — aguardando +6s');
                        await new Promise(r => setTimeout(r, 6000));
                    }
                } catch (e) {
                    console.warn('[Azul] Erro na chamada direta:', e.message);
                    await new Promise(r => setTimeout(r, 6000));
                }
            }

        } else if (isLatam) {
            // LATAM: usa fluxo público /minhas-viagens com localizador+sobrenome (sem auth)
            const urlObj = new URL(url);
            let localizador = urlObj.searchParams.get('identifier') || '';
            let sobrenomeL  = urlObj.searchParams.get('lastName') || urlObj.searchParams.get('lastname') || '';

            // Suporte ao formato antigo: second-detail?orderId=LA9576350CFYB&lastname=FRANCA
            if (!localizador) {
                let orderId = urlObj.searchParams.get('orderId') || '';
                // Strip prefixo "LA" e usa o número completo (ex: LA9578032HXQU → 9578032HXQU)
                if (/^LA/i.test(orderId)) orderId = orderId.substring(2);
                localizador = orderId;
            }
            console.log(`[LATAM] localizador="${localizador}" sobrenome="${sobrenomeL}"`);

            const latamBaseHeaders = {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Origin': 'https://www.latamairlines.com',
                'Referer': 'https://www.latamairlines.com/br/pt/minhas-viagens',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
            };

            // 1) Tenta chamada direta à API LATAM (sem Puppeteer)
            // bff/mytrips/retrieve (POST) retorna 400 "Missing latam headers" — endpoint existe
            // bff/retrieve-booking (GET) retorna 404 — testar ambos
            const latamGetUrls = [
                `https://www.latamairlines.com/bff/retrieve-booking?locator=${localizador}&lastName=${sobrenomeL}`,
                `https://www.latamairlines.com/bff/retrieve-booking?pnr=${localizador}&lastName=${sobrenomeL}`,
                `https://apimobile.tam.com.br/retrieve-booking/v1/bookings?pnr=${localizador}&lastName=${sobrenomeL}`,
            ];
            const latamPostUrls = [
                ['https://www.latamairlines.com/bff/mytrips/retrieve',
                    JSON.stringify({ identifier: localizador, lastName: sobrenomeL, market: 'BR', locale: 'pt-BR' })],
                ['https://www.latamairlines.com/bff/mytrips/retrieve',
                    JSON.stringify({ locator: localizador, lastName: sobrenomeL })],
                ['https://www.latamairlines.com/bff/retrieve-booking',
                    JSON.stringify({ locator: localizador, lastName: sobrenomeL })],
            ];
            // GET endpoints
            for (const ep of latamGetUrls) {
                try {
                    const nr = await fetch(ep, { headers: latamBaseHeaders });
                    console.log(`[LATAM] GET HTTP ${nr.status}: ${ep.substring(0, 80)}`);
                    if (nr.ok) {
                        const ct = nr.headers.get('content-type') || '';
                        if (ct.includes('json')) {
                            const json = await nr.json();
                            if (json && Object.keys(json).length > 2) {
                                apiData.push({ url: ep, data: json });
                                console.log('[LATAM] GET direta: dados obtidos!');
                                break;
                            }
                        }
                    }
                } catch (eL) { console.warn('[LATAM] GET erro:', eL.message); }
            }
            // POST endpoints (bff/mytrips/retrieve usa POST)
            if (!apiData.length) {
                const postHeaders = { ...latamBaseHeaders, 'Content-Type': 'application/json' };
                for (const [ep, body] of latamPostUrls) {
                    try {
                        const nr = await fetch(ep, { method: 'POST', headers: postHeaders, body });
                        const ct = nr.headers.get('content-type') || '';
                        const txt = await nr.text();
                        console.log(`[LATAM] POST HTTP ${nr.status} [${ct.substring(0,20)}]: ${ep.substring(0, 70)} | ${txt.substring(0,80)}`);
                        if (nr.ok && ct.includes('json')) {
                            try {
                                const json = JSON.parse(txt);
                                if (json && Object.keys(json).length > 2) {
                                    apiData.push({ url: ep, data: json });
                                    console.log('[LATAM] POST direta: dados obtidos!');
                                    break;
                                }
                            } catch (_) {}
                        }
                    } catch (eL) { console.warn('[LATAM] POST erro:', eL.message); }
                }
            }

            // Helper para verificar se já temos dados de booking suficientes
            const latamTemDados = () => apiData.some(e =>
                e.url !== 'dom://latam-window-state' &&
                e.data && typeof e.data === 'object' && Object.keys(e.data).length > 3
            );

            if (!latamTemDados()) {
                // 2) Puppeteer: aguarda a página carregar e tenta preencher o formulário
                const latamJsonFilter = resp => {
                    const u  = resp.url();
                    const ct = resp.headers()['content-type'] || '';
                    return u.includes('latamairlines.com') &&
                           !u.includes('go-mpulse') && !u.includes('config.json') &&
                           !u.includes('/MX8t95') && !u.includes('akamai') &&
                           ct.includes('application/json');
                };

                try {
                    // Aguarda a página carregar inputs (formulário ou booking já carregado)
                    await page.waitForSelector('input, [data-testid="mytrips"]', { timeout: 30000 });
                    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));

                    // Verifica se alguma resposta de BOOKING LATAM chegou durante o carregamento
                    // (exclui arquivos estáticos como locales/common.json, config.json, analytics)
                    const jaRespondeu = apiData.some(e =>
                        e.url?.includes('latamairlines.com') &&
                        !e.url.includes('/locales/') && !e.url.includes('config.json') &&
                        !e.url.includes('/MX8t95') && !e.url.includes('go-mpulse')
                    );
                    if (jaRespondeu) {
                        console.log('[LATAM] Dados de booking capturados durante page load — aguardando +2s');
                        await new Promise(r => setTimeout(r, 2000));
                    } else {
                        // Aceita o cookie consent banner (pode bloquear o clique no botão)
                        try {
                            const cookieAccepted = await page.evaluate(() => {
                                // Busca botão de aceitar cookies (common patterns)
                                const patterns = [
                                    'button[id*="accept"], button[id*="cookie"], button[id*="consent"]',
                                    'button[class*="accept"], button[class*="cookie"], button[class*="consent"]',
                                    '[data-testid*="accept"], [data-testid*="cookie"]',
                                ];
                                for (const sel of patterns) {
                                    const btn = document.querySelector(sel);
                                    if (btn) { btn.click(); return 'clicked: ' + btn.textContent?.trim().substring(0,30); }
                                }
                                // Busca por texto
                                const cookieBtn = [...document.querySelectorAll('button')]
                                    .find(b => /aceitar|accept|concordar|agree|allow.*cookie|permitir/i.test(b.textContent || ''));
                                if (cookieBtn) { cookieBtn.click(); return 'text: ' + cookieBtn.textContent?.trim().substring(0,30); }
                                return null;
                            });
                            if (cookieAccepted) console.log('[LATAM] Cookie banner:', cookieAccepted);
                            else console.log('[LATAM] Cookie banner: não encontrado (OK)');
                        } catch (_) {}

                        await new Promise(r => setTimeout(r, 500));

                        // Obtém info dos inputs via evaluate para diagnóstico
                        const inputInfo = await page.evaluate(() => {
                            const inputs = [...document.querySelectorAll('input:not([type=hidden])')];
                            return inputs.map(el => ({
                                name: el.name, id: el.id,
                                placeholder: el.placeholder?.substring(0, 40),
                                type: el.type
                            }));
                        }).catch(() => []);
                        console.log('[LATAM] Inputs no DOM:', JSON.stringify(inputInfo));

                        // Abordagem React fiber: chama o onChange handler diretamente
                        // Isso atualiza o estado React interno, o que simpleInput/nativeValueSetter não conseguem
                        const reactFiberFill = await page.evaluate((loc, sob) => {
                            const triggerReactChange = (el, value) => {
                                if (!el) return false;
                                // Encontra o React fiber/interno do elemento
                                const rKey = Object.keys(el).find(k =>
                                    k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance') || k.startsWith('__reactProps')
                                );
                                if (!rKey) return false;

                                if (rKey.startsWith('__reactProps')) {
                                    // React 18: props diretamente no elemento
                                    const props = el[rKey];
                                    if (props?.onChange) {
                                        props.onChange({ target: { value }, currentTarget: { value }, nativeEvent: { target: { value } } });
                                        return true;
                                    }
                                } else {
                                    // React 16/17: navega pelo fiber
                                    let fiber = el[rKey];
                                    while (fiber) {
                                        const props = fiber.memoizedProps;
                                        if (props?.onChange) {
                                            // Também seta o valor DOM primeiro (para displayar)
                                            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                                            if (setter) setter.call(el, value);
                                            props.onChange({ target: el, currentTarget: el, nativeEvent: { target: el, value } });
                                            return true;
                                        }
                                        fiber = fiber.return;
                                    }
                                }
                                return false;
                            };

                            const allInputs = [...document.querySelectorAll('input:not([type=hidden])')];
                            const locEl = document.querySelector('[name="identifier"],[name="locator"],[name="pnr"],[placeholder*="reserva" i],[placeholder*="compra" i]') || allInputs[0];
                            const sobEl = document.querySelector('[name="lastName"],[name="surname"],[placeholder*="sobrenome" i]') || allInputs[1];

                            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                            // Seta via DOM primeiro
                            if (locEl && setter) setter.call(locEl, loc);
                            if (sobEl && setter) setter.call(sobEl, sob);

                            // Dispara onChange via React fiber
                            const okLoc = triggerReactChange(locEl, loc);
                            const okSob = triggerReactChange(sobEl, sob);

                            // Dispara eventos de change/blur para garantir validação
                            [locEl, sobEl].filter(Boolean).forEach(el => {
                                el.dispatchEvent(new Event('input',  { bubbles: true }));
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                                el.dispatchEvent(new Event('blur',   { bubbles: true }));
                            });

                            return {
                                okLoc, okSob,
                                locName: locEl?.name || locEl?.placeholder,
                                sobName: sobEl?.name || sobEl?.placeholder,
                                inputs: allInputs.length,
                                locVal: locEl?.value,
                                sobVal: sobEl?.value,
                            };
                        }, localizador, sobrenomeL);
                        console.log('[LATAM] React fiber fill:', JSON.stringify(reactFiberFill));

                        await new Promise(r => setTimeout(r, 800));

                        // Aguarda reCAPTCHA inicializar (carregado pelo Next.js chunk)
                        await page.waitForFunction(
                            () => !!(window.grecaptcha?.enterprise || window.grecaptcha?.ready),
                            { timeout: 8000 }
                        ).catch(() => console.warn('[LATAM] reCAPTCHA não carregou em 8s'));

                        await new Promise(r => setTimeout(r, 500));

                        // Scroll para o botão + clique via coordenadas (mais real que btn.click())
                        const btnCoords = await page.evaluate(() => {
                            const btn = [...document.querySelectorAll('button,[type="submit"]')]
                                .find(b => /procurar|buscar|search|continuar/i.test(b.textContent || b.getAttribute('aria-label') || ''));
                            if (!btn) return null;
                            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            const r = btn.getBoundingClientRect();
                            return { x: r.x + r.width/2, y: r.y + r.height/2, text: btn.textContent?.trim() };
                        });
                        console.log('[LATAM] Botão coords:', JSON.stringify(btnCoords));

                        await new Promise(r => setTimeout(r, 500));

                        if (btnCoords) {
                            await page.mouse.click(btnCoords.x, btnCoords.y);
                        }
                        await page.keyboard.press('Enter');
                        console.log('[LATAM] Enter pressionado (reCAPTCHA deve ter executado)');

                        // Aguarda resposta da API após submit
                        try {
                            await page.waitForResponse(latamJsonFilter, { timeout: 25000 });
                            console.log('[LATAM] API respondeu após submit — aguardando +3s');
                            await new Promise(r => setTimeout(r, 3000));
                        } catch (_) {
                            console.warn('[LATAM] API não respondeu em 25s — aguardando DOM...');
                            await new Promise(r => setTimeout(r, 4000));
                        }
                    }
                } catch (e) {
                    console.warn('[LATAM] Formulário:', e.message, '— aguardando resposta automática...');
                    try {
                        await page.waitForResponse(latamJsonFilter, { timeout: 12000 });
                        await new Promise(r => setTimeout(r, 2000));
                    } catch (_) {
                        await new Promise(r => setTimeout(r, 3000));
                    }
                }
            }

            // 2.4) Replica a chamada capturada pelo interceptor fetch (URL + headers exatos do SPA)
            if (!latamTemDados() && _consoleLogs.length > 0) {
                const lastReq = _consoleLogs[_consoleLogs.length - 1];
                console.log('[LATAM] Replicando chamada interceptada:', lastReq.method, lastReq.url?.substring(0, 100));
                try {
                    const akamaiCookies = await page.cookies();
                    const cookieStr = akamaiCookies.map(c => `${c.name}=${c.value}`).join('; ');
                    const replicaHeaders = {
                        ...lastReq.headers,
                        'Cookie': cookieStr,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    };
                    const fetchOpts = {
                        method: lastReq.method || 'GET',
                        headers: replicaHeaders,
                    };
                    if (lastReq.body) fetchOpts.body = lastReq.body;
                    const nr = await fetch(lastReq.url, fetchOpts);
                    const ct = nr.headers.get('content-type') || '';
                    console.log(`[LATAM] Replica HTTP ${nr.status} [${ct.substring(0, 20)}]`);
                    if (nr.ok && ct.includes('json')) {
                        const json = await nr.json();
                        if (json && Object.keys(json).length > 2) {
                            apiData.push({ url: lastReq.url, data: json });
                            console.log('[LATAM] Replica: dados obtidos!');
                        }
                    }
                } catch (eRep) { console.warn('[LATAM] Replica erro:', eRep.message); }
            }

            // 2.5) Cookie-based fetch: usa cookies Akamai da sessão Puppeteer para chamar a API diretamente
            // Isso pode funcionar porque os cookies _abck/bm_sz foram gerados pelo browser real
            if (!latamTemDados()) {
                try {
                    const akamaiCookies = await page.cookies();
                    if (akamaiCookies.length > 0) {
                        const cookieStr = akamaiCookies.map(c => `${c.name}=${c.value}`).join('; ');
                        const cookieHeaders = { ...latamBaseHeaders, 'Cookie': cookieStr };
                        const cookieEps = [
                            `https://www.latamairlines.com/bff/retrieve-booking?locator=${localizador}&lastName=${sobrenomeL}`,
                            `https://www.latamairlines.com/pt-br/xp-web-mytrips/api/retrieve?identifier=${localizador}&lastName=${sobrenomeL}`,
                            `https://www.latamairlines.com/bff/retrieve-booking?identifier=${localizador}&lastName=${sobrenomeL}`,
                        ];
                        for (const ep of cookieEps) {
                            try {
                                const nr = await fetch(ep, { headers: cookieHeaders });
                                console.log(`[LATAM] Cookie-fetch HTTP ${nr.status}: ${ep.substring(0, 100)}`);
                                if (nr.ok) {
                                    const ct = nr.headers.get('content-type') || '';
                                    if (ct.includes('json')) {
                                        const json = await nr.json();
                                        if (json && Object.keys(json).length > 2) {
                                            apiData.push({ url: ep, data: json });
                                            console.log('[LATAM] Cookie-fetch: dados obtidos!');
                                            break;
                                        }
                                    }
                                }
                            } catch (eC) { console.warn('[LATAM] Cookie-fetch erro:', eC.message); }
                        }
                    }
                } catch (eCook) { console.warn('[LATAM] Cookies Puppeteer erro:', eCook.message); }
            }

            // 2.6) page.evaluate: chama /bff/mytrips/v1/order/ com headers LATAM corretos
            // X-latam-App-Session-Id = UUID gerado 1x por sessão pelo SPA
            // X-LATAM-TAB-ID = salvo no sessionStorage pelo SPA
            // X-latam-Application-Country/Lang/Oc = BR, pt, BR
            if (!latamTemDados()) {
                try {
                    const latamBrowserResult = await page.evaluate(async (loc, sob) => {
                        // Gera UUID v4 simples
                        const uuidv4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                            const r = Math.random() * 16 | 0;
                            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                        });

                        // Lê TAB_ID do sessionStorage (gerado pelo SPA ao inicializar)
                        const tabId = window.sessionStorage.getItem('X-LATAM-TAB-ID') || uuidv4();
                        const appSessionId = uuidv4(); // UUID gerado por sessão

                        // Headers completos conforme análise do _app chunk
                        const latamHeaders = {
                            'Accept': 'application/json, text/plain, */*',
                            'X-LATAM-TAB-ID': tabId,
                            'X-latam-App-Session-Id': appSessionId,
                            'X-latam-Request-Id': uuidv4(),
                            'X-latam-Client-Name': 'xp-web-mytrips',
                            'X-latam-Application-Country': 'BR',
                            'X-latam-Application-Lang': 'pt',
                            'X-latam-Application-Oc': 'BR',
                            'X-latam-Application-Name': 'xp-web-mytrips',
                            'X-latam-Application-Platform': 'web',
                        };

                        const results = [];
                        // Endpoint descoberto no código fonte do SPA:
                        // getOrder: baseUrl + /bff/mytrips/v1/ + "order/id/:orderId/lastname/:lastname?origin=second-detail"
                        const endpoints = [
                            `https://www.latamairlines.com/bff/mytrips/v1/order/id/${loc}/lastname/${sob}?origin=second-detail`,
                            `https://www.latamairlines.com/bff/mytrips/v1/order/id/LA${loc}/lastname/${sob}?origin=second-detail`,
                            `https://www.latamairlines.com/bff/mytrips/v1/order/id/${loc}/lastname/${sob}`,
                        ];

                        for (const ep of endpoints) {
                            try {
                                const resp = await fetch(ep, {
                                    credentials: 'include',
                                    headers: latamHeaders
                                });
                                const ct = resp.headers.get('content-type') || '';
                                const txt = await resp.text();
                                results.push({ ep: ep.substring(ep.indexOf('/bff/')), status: resp.status, ct: ct.substring(0,30), body: txt.substring(0, 400) });
                                if (resp.ok && ct.includes('json') && txt.length > 20) {
                                    try { return { url: ep, data: JSON.parse(txt) }; }
                                    catch (_) {}
                                }
                            } catch (e) { results.push({ ep, error: e.message }); }
                        }
                        return { results, tabId };
                    }, localizador, sobrenomeL);

                    if (latamBrowserResult?.data && Object.keys(latamBrowserResult.data).length > 2) {
                        apiData.push(latamBrowserResult);
                        console.log('[LATAM] Browser evaluate v2 OK:', latamBrowserResult.url?.substring(0, 80));
                    } else {
                        console.log('[LATAM] Browser evaluate v2 results:', JSON.stringify(latamBrowserResult?.results || []).substring(0, 800));
                        console.log('[LATAM] TAB_ID do sessionStorage:', latamBrowserResult?.tabId);
                    }
                } catch (eBE) { console.warn('[LATAM] Browser evaluate v2 erro:', eBE.message); }
            }

            // 3) Captura estado JS da página (após renderização)
            try {
                const latamEval = await page.evaluate(() => {
                    const nd = document.getElementById('__NEXT_DATA__');
                    if (nd) { try { return { _s: 'nextData', ...JSON.parse(nd.textContent) }; } catch(_){} }
                    const KEYS = ['__latamState__','__LATAM_STATE__','__APP_STATE__','__INITIAL_STATE__'];
                    for (const k of KEYS) {
                        if (window[k] && typeof window[k] === 'object')
                            return { _s: k, ...window[k] };
                    }
                    for (const k of Object.getOwnPropertyNames(window)) {
                        if (!/booking|flight|reserv|itiner|journey/i.test(k)) continue;
                        try {
                            const v = window[k];
                            if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 3)
                                return { _s: k, ...v };
                        } catch(_) {}
                    }
                    return null;
                });
                if (latamEval) {
                    apiData.push({ url: 'dom://latam-window-state', data: latamEval });
                    console.log('[LATAM] Window state capturado, fonte:', latamEval._s);
                }
            } catch (e) { console.warn('[LATAM] DOM eval erro:', e.message); }

        } else if (isGol) {
            // GOL: SPA Angular/MFE — usa ElementHandle.type() para simular digitação real
            const urlObj       = new URL(url);
            const codigoGol    = urlObj.searchParams.get('codigoReserva') || '';
            const origemGol    = urlObj.searchParams.get('origem') || '';
            const sobrenomeGol = decodeURIComponent(urlObj.searchParams.get('sobrenome') || '');

            console.log(`[GOL] cod="${codigoGol}" orig="${origemGol}" sob="${sobrenomeGol}"`);

            try {
                await page.waitForSelector('input', { timeout: 40000 });

                // Simula comportamento humano antes de preencher o form (melhora score reCAPTCHA v3)
                await page.mouse.move(400 + Math.random() * 200, 300 + Math.random() * 100);
                await new Promise(r => setTimeout(r, 400 + Math.random() * 400));
                await page.mouse.move(200 + Math.random() * 300, 400 + Math.random() * 150, { steps: 8 });
                await page.evaluate(() => window.scrollBy(0, 80));
                await new Promise(r => setTimeout(r, 300 + Math.random() * 300));
                await page.evaluate(() => window.scrollBy(0, -30));
                await new Promise(r => setTimeout(r, 3000 + Math.random() * 1000));

                // Usa ElementHandles — simula digitação real tecla a tecla (Angular responde)
                const visibleInputs = await page.$$('input:not([type=hidden]):not([type=checkbox]):not([type=radio])');
                console.log(`[GOL] Inputs encontrados: ${visibleInputs.length}`);

                const typeInto = async (el, valor) => {
                    if (!el || !valor) return;
                    await el.click({ clickCount: 3 }); // seleciona tudo
                    await el.type(valor, { delay: 60 }); // digita tecla a tecla
                    await page.keyboard.press('Tab');
                    await new Promise(r => setTimeout(r, 300));
                };

                // Ordem do form GOL: código (0), origem (1), sobrenome (2)
                await typeInto(visibleInputs[0], codigoGol);
                await typeInto(visibleInputs[1], origemGol);
                await typeInto(visibleInputs[2], sobrenomeGol);

                await new Promise(r => setTimeout(r, 1200));

                // Clica no botão Continuar
                const clicou = await page.evaluate(() => {
                    const btn = [...document.querySelectorAll('button, [type="submit"]')]
                        .find(b => /continuar/i.test(b.textContent.trim()));
                    if (btn) { btn.click(); return btn.textContent.trim(); }
                    return false;
                });
                console.log('[GOL] Botão Continuar:', clicou);

                // Aguarda API de booking após submit
                const golApiFilter = resp => {
                    const u  = resp.url();
                    const ct = resp.headers()['content-type'] || '';
                    return u.includes('voegol.com.br') &&
                           !u.includes('manifest') && !u.includes('datadoghq') &&
                           !u.includes('/rum?') && !u.includes('/key-config') &&
                           ct.includes('application/json');
                };
                try {
                    await page.waitForResponse(golApiFilter, { timeout: 30000 });
                    console.log('[GOL] API respondeu — aguardando +6s');
                    await new Promise(r => setTimeout(r, 6000));
                } catch (_) {
                    console.warn('[GOL] API não respondeu — aguardando +12s');
                    await new Promise(r => setTimeout(r, 12000));
                }

            } catch (e) {
                console.warn('[GOL] Erro:', e.message);
                await new Promise(r => setTimeout(r, 15000));
            }

            // ── Fallback: chamada direta à booking-api usando token anônimo ──
            // (contorna o reCAPTCHA quando o Puppeteer é bloqueado)
            const jaTemBooking = apiData.some(e =>
                e.url?.includes('booking-api.voegol.com.br') &&
                !e.url.includes('pnrBnpl') &&
                e.data?.success === true
            );
            if (!jaTemBooking) {
                const tokenEntry = apiData.find(e =>
                    e.url?.includes('gol-auth-api.voegol.com.br') &&
                    e.data?.response?.token
                );
                if (tokenEntry) {
                    const golToken = tokenEntry.data.response.token;
                    const https = require('https');
                    const endpointsGol = [
                        `https://booking-api.voegol.com.br/api/Booking/${codigoGol}?origin=${origemGol}&lastName=${sobrenomeGol}`,
                        `https://booking-api.voegol.com.br/api/Booking/retrieve?pnr=${codigoGol}&origin=${origemGol}&lastName=${sobrenomeGol}`
                    ];
                    for (const ep of endpointsGol) {
                        try {
                            const resp = await new Promise((resolve) => {
                                const req = https.get(ep, {
                                    headers: {
                                        'Authorization': `Bearer ${golToken}`,
                                        'Accept': 'application/json',
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                        'Origin': 'https://b2c.voegol.com.br',
                                        'Referer': 'https://b2c.voegol.com.br/minhas-viagens/encontrar-viagem'
                                    }
                                }, res => {
                                    let body = '';
                                    res.on('data', d => body += d);
                                    res.on('end', () => {
                                        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                                        catch { resolve(null); }
                                    });
                                });
                                req.on('error', () => resolve(null));
                                req.setTimeout(8000, () => { req.destroy(); resolve(null); });
                            });
                            console.log(`[GOL] Booking direto ${ep}: status=${resp?.status}`);
                            if (resp?.status === 200 && resp?.data) {
                                apiData.push({ url: ep, data: resp.data });
                                console.log('[GOL] Booking direto OK:', JSON.stringify(resp.data).substring(0, 300));
                                break;
                            }
                        } catch (e) {
                            console.warn('[GOL] Erro booking direto:', e.message);
                        }
                    }
                }
            }

            // ── Fallback via page.evaluate: chama booking API a partir do contexto do browser ──
            // O browser tem os cookies da sessão incluindo tokens reCAPTCHA — pode ter mais sucesso
            const jaTemDados = apiData.some(e =>
                (e.url?.includes('booking') || e.url?.includes('pnr')) &&
                e.data && typeof e.data === 'object' && Object.keys(e.data).length > 3
            );
            if (!jaTemDados) {
                console.log('[GOL] Tentando chamada de booking via contexto do browser (com cookies)...');
                try {
                    const bookingFromBrowser = await page.evaluate(async (pnr, origin, lastName) => {
                        const endpoints = [
                            `https://booking-api.voegol.com.br/api/Booking/${pnr}?origin=${origin}&lastName=${lastName}`,
                            `https://booking-api.voegol.com.br/api/Booking/retrieve?pnr=${pnr}&origin=${origin}&lastName=${lastName}`,
                            `https://pnr-bnpl-validation-v2.voegol.com.br/api/pnr-validation/pnr/${pnr}?originIata=${origin}&lastName=${lastName}`,
                        ];
                        for (const ep of endpoints) {
                            try {
                                const resp = await fetch(ep, {
                                    credentials: 'include',
                                    headers: {
                                        'Accept': 'application/json',
                                        'X-Requested-With': 'XMLHttpRequest',
                                        'Origin': location.origin,
                                        'Referer': location.href
                                    }
                                });
                                if (resp.ok) {
                                    const text = await resp.text();
                                    if (text && text.length > 20) {
                                        try { return { url: ep, data: JSON.parse(text) }; }
                                        catch { return { url: ep, data: { rawText: text.substring(0, 500) } }; }
                                    }
                                }
                            } catch (_) { /* CORS ou rede — tenta próximo endpoint */ }
                        }
                        return null;
                    }, codigoGol, origemGol, sobrenomeGol);

                    if (bookingFromBrowser?.data) {
                        apiData.push(bookingFromBrowser);
                        console.log('[GOL] Browser evaluate OK:', JSON.stringify(bookingFromBrowser.data).substring(0, 400));
                    } else {
                        console.log('[GOL] Browser evaluate: sem dados (CORS ou bloqueado)');
                    }
                } catch (e) {
                    console.warn('[GOL] Erro no browser evaluate:', e.message);
                }
            }

        } else if (isTap) {
            // TAP: SPA React — aguarda resposta JSON da API de reservas ou 20s fixo
            const tapFilter = resp => {
                const u  = resp.url();
                const ct = resp.headers()['content-type'] || '';
                return (u.includes('flytap.com') || u.includes('tap.pt') || u.includes('tapairportugal')) &&
                       ct.includes('application/json');
            };
            try {
                await page.waitForResponse(tapFilter, { timeout: 25000 });
                console.log('[TAP] API respondeu — aguardando +5s');
                await new Promise(r => setTimeout(r, 5000));
            } catch (_) {
                console.warn('[TAP] API não respondeu — aguardando +15s');
                await new Promise(r => setTimeout(r, 15000));
            }

        } else {
            await new Promise(r => setTimeout(r, 10000));
        }

        const pageText = await page.evaluate(() =>
            document.body?.innerText || document.body?.textContent || ''
        ).catch(() => '');

        const pageHtml = await page.evaluate(() =>
            document.documentElement.outerHTML
        ).catch(() => '');

        console.log(`[Reservas] pageText:${pageText.length} | apiData:${apiData.length} | html:${pageHtml.length}`);

        let bilheteData = null;
        if (isAzul) {
            bilheteData = extrairBilheteAzul(apiData, pageHtml, pageText);
        } else if (isLatam) {
            bilheteData = extrairBilheteLatam(apiData, pageText, pageHtml);
        } else if (isGol) {
            bilheteData = extrairBilheteGol(apiData, pageText, pageHtml);
        } else if (isTap) {
            bilheteData = extrairBilheteTap(apiData, pageText, pageHtml);
        }

        res.json({ success: true, pageText, pageHtml: pageHtml.substring(0, 200000), apiData, bilheteData, _latamIntercepted: _latamReqCapture, _latamConsoleLogs: _consoleLogs });

    } catch (error) {
        console.error('[Reservas] Erro:', error.message);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
});

// ─────────────────────────────────────────────
// Importação de bilhete GOL via PDF
// ─────────────────────────────────────────────

const multer  = require('multer');
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

/**
 * Parseia texto de bilhete GOL — suporta dois formatos:
 *   • Texto nativo (pdf-parse): campos colados "G3192328/05/202612:20", IATAs "RECSSA"
 *   • OCR (pdftoppm/Puppeteer): "Itinerario de IDA … 28/05/2026", "Recife REC SSA Salvador",
 *     "28/05/2026 1923 28/05/2026", "HERCILIO AUTO JUNIOR E-ticket: 127…"
 */
function parsearBilheteGolPdf(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log(`[PDF-GOL] Total de linhas: ${lines.length}`);

    // ── Localizador ──────────────────────────────────────────────────────────
    // Palavras que NÃO são PNR GOL (evita falsos positivos em todas as estratégias)
    const PALAVRAS_LOC = new Set([
        'VIAJANTES','PASSAGEIROS','LOCALIZADOR','INFORMACOES','INFORMACDES',
        'SALVADOR','RECIFE','MANAUS','BRASILIA','FORTALEZA','CURITIBA',
        'ITINERARIO','GIRAMUNDO','AGENCY','ONLINE','ASSENTO','BAGAGEM',
        'JUNIOR','MARINA','HEMILIA','TERCEIRA','QUARTA','QUINTA',
        'SEXTA','SABADO','DOMINGO','VISUALIZAR','RESERVA',
        'VOLTA','TRECHO','TICKET','VIAGEM','BILHETE','VIAJEM',
        'APENAS','ORIGEM','DESTINO','OUTROS','COMPRA','NUMERO',
    ]);

    // Pre-pass: extrai o nome do passageiro para excluir suas palavras da busca de localizador
    // Evita que partes do nome (ex: FRITSCH, CARLOS, AMANDA) sejam confundidas com PNR
    for (const ln of lines) {
        const etkt = ln.match(/^([A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇ][A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇ\s]{2,49}?)\s+E-?[Tt]icket/i);
        if (etkt) {
            etkt[1].trim().toUpperCase().split(/\s+/).filter(w => w.length >= 4).forEach(w => PALAVRAS_LOC.add(w));
            break;
        }
    }

    // Estratégia 1: label "Localizador" sozinho na linha, código na(s) linha(s) seguinte(s)
    // Estratégia 2: localizador na mesma linha — com ou sem separador (incluindo concatenado)
    //   ex: "Localizador: FJGNAF", "Localizador FJGNAF", "LocalizadorFJGNAF"
    // Estratégia 3: PNR GOL — exatamente 6 letras maiúsculas isoladas
    let localizador = '';
    for (let i = 0; i < lines.length; i++) {
        // Estratégia 1: "Localizador" ou "Localizador:" sozinho na linha
        if (/^localizador[:\s]*$/i.test(lines[i])) {
            for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
                const prox = lines[j].match(/^([A-Z0-9]{5,8})$/);
                if (prox) { localizador = prox[1]; break; }
                const parcial = lines[j].match(/^([A-Z0-9]{5,8})\b/);
                if (parcial && !/^(VOOS?|IDA|VOLTA|VIAJ|INFO|PASS|GIRA)/i.test(parcial[1])) {
                    localizador = parcial[1]; break;
                }
            }
            if (localizador) break;
        }

        // Estratégia 2: localizador na mesma linha — qualquer separador ou sem separador
        // Cobre: "Localizador: FJGNAF", "Localizador FJGNAF", "LocalizadorFJGNAF",
        //        "(Localizador): FJGNAF", "Localizador)FJGNAF" (pdf-parse concatena campos)
        if (/localizador/i.test(lines[i])) {
            const labelIdx = lines[i].search(/localizador/i);
            const after    = lines[i].substring(labelIdx + 'localizador'.length);
            // Primeiro bloco de 5-8 letras maiúsculas (sem flag i — estritamente uppercase)
            const m = after.match(/([A-Z]{5,8})\b/);
            if (m && !PALAVRAS_LOC.has(m[1])) {
                localizador = m[1];
                break;
            }
        }
    }

    // Estratégia 3: PNR GOL — exatamente 6 letras maiúsculas isoladas
    // Passa 1: busca antes da seção "Passageiros"
    // Passa 2: busca no texto todo (caso o localizador apareça depois)
    if (!localizador) {
        const passIdx   = lines.findIndex(l => /^Passageiros?\b/i.test(l));
        const areas     = passIdx > 0
            ? [lines.slice(0, passIdx), lines.slice(passIdx)]
            : [lines];
        outer: for (const area of areas) {
            for (const ln of area) {
                if (/E-?ticket|Assentos?|Bagagens?|kg|Nenhum/i.test(ln)) continue;
                const m = ln.match(/\b([A-Z]{6})\b/);
                if (m && !PALAVRAS_LOC.has(m[1])) {
                    localizador = m[1];
                    break outer;
                }
            }
        }
    }

    // ── Passageiro principal ─────────────────────────────────────────────────
    // OCR:        "HERCILIO AUTO JUNIOR E-ticket: 1272156383887"
    // Texto nativo: seção VIAJANTES → "HERCILIO AUTO JUNIOR1272156383887MARIA…"
    let passageiroNome = '';
    for (let i = 0; i < lines.length; i++) {
        const etkt = lines[i].match(/^([A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇ][A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇ\s]{4,49}?)\s+E-?[Tt]icket/i);
        if (etkt) { passageiroNome = etkt[1].trim(); break; }
    }
    if (!passageiroNome) {
        const viatIdx = lines.findIndex(l => /^VIAJANTES\s*$/i.test(l));
        if (viatIdx >= 0) {
            for (let i = viatIdx + 1; i < Math.min(viatIdx + 4, lines.length); i++) {
                if (/^\d+$/.test(lines[i])) continue;
                passageiroNome = lines[i].replace(/\d{8,}.*$/, '').trim();
                break;
            }
        }
    }

    // ── Helper: corrige erros OCR em horários ("1 2:20" → "12:20") ──────────
    const fixTimes = str => str.replace(/\b(\d)\s+(\d:\d{2})\b/g, '$1$2');

    // Palavras de 3 letras maiúsculas que NÃO são códigos IATA
    const SKIP_IATA = new Set([
        'IDA','GOL','LAT','AZU','TER','QUA','QUI','SEX','SAB','DOM',
        'AER','INT','DEP','LUI','EDU','VOO','UMA','SEM','NAO','NHU',
        'ANA','JOS','CAR','MAR','PAU','LUC','LUZ','FER','SIL','OLI',
    ]);

    // Mapeamento cidade → IATA principal (fallback quando OCR macula códigos)
    const CIDADE_IATA = {
        'recife': 'REC', 'rio de janeiro': 'GIG', 'galeao': 'GIG', 'santos dumont': 'SDU',
        'sao paulo': 'GRU', 'guarulhos': 'GRU', 'congonhas': 'CGH', 'campinas': 'VCP', 'viracopos': 'VCP',
        'salvador': 'SSA', 'brasilia': 'BSB', 'belo horizonte': 'CNF', 'confins': 'CNF', 'pampulha': 'PLU',
        'curitiba': 'CWB', 'porto alegre': 'POA', 'fortaleza': 'FOR', 'manaus': 'MAO',
        'belem': 'BEL', 'goiania': 'GYN', 'natal': 'NAT', 'joao pessoa': 'JPA',
        'maceio': 'MCZ', 'aracaju': 'AJU', 'florianopolis': 'FLN', 'vitoria': 'VIX',
        'cuiaba': 'CGB', 'campo grande': 'CGR', 'sao luis': 'SLZ', 'teresina': 'THE',
        'porto velho': 'PVH', 'macapa': 'MCP', 'rio branco': 'RBR', 'boa vista': 'BVB',
        'palmas': 'PMW', 'foz do iguacu': 'IGU', 'navegantes': 'NVT', 'londrina': 'LDB',
        'maringa': 'MGF', 'ribeirao preto': 'RAO', 'uberlandia': 'UDI', 'juiz de fora': 'JDF',
        'petrolina': 'PNZ', 'imperatriz': 'IMP', 'ilheus': 'IOS', 'caruaru': 'CAU',
        'fernando de noronha': 'FEN', 'chapeco': 'XAP', 'joinville': 'JOI',
        'campina grande': 'CPV', 'montes claros': 'MOC', 'santarem': 'STM',
        'porto seguro': 'BPS', 'maraba': 'MAB', 'altamira': 'ATM',
        'presidente prudente': 'PPB', 'cascavel': 'CAC', 'sinop': 'OPS',
        'rondonopolis': 'ROO', 'ji parana': 'JPR', 'cruzeiro do sul': 'CZS',
        'buenos aires': 'EZE', 'santiago': 'SCL', 'lima': 'LIM', 'bogota': 'BOG',
        'montevideu': 'MVD', 'montevideo': 'MVD', 'miami': 'MIA', 'orlando': 'MCO',
        'nova york': 'JFK', 'new york': 'JFK', 'cancun': 'CUN', 'lisboa': 'LIS',
    };

    // Detecta índice onde termina a seção (próximo IDA/VOLTA/Passageiros/fim)
    const acharFimSecao = (startIdx) => {
        for (let k = startIdx + 1; k < lines.length; k++) {
            if (/^VOOS?\s+DE\s+(IDA|VOLTA)$/i.test(lines[k])) return k;
            if (/itiner[aá].?rio\s+de\s+(IDA|VOLTA)/i.test(lines[k])) return k;
            if (/tinerario\s+de\s+(IDA|VOLTA)/i.test(lines[k])) return k;
            if (/^Passageiros?\s*:?\s*\d/i.test(lines[k])) return k;
            if (/^(VIAJANTES|Informac|Assentos|Bagagens)/i.test(lines[k])) return k;
        }
        return lines.length;
    };

    // ── Extrai dados de voo de um bloco (texto nativo OU OCR) ────────────────
    // Suporta multi-trecho (conexões): coleta todos IATAs/horários/voos no bloco
    // e retorna origem=primeiro, destino=último, partida=primeiro, chegada=último.
    const extrairVoo = (headerIdx) => {
        let data = '';

        // Data no cabeçalho da seção (OCR): "Quinta-feira, 28/05/2026 1 Trecho"
        const hdData = lines[headerIdx].match(/(\d{2}\/\d{2}\/\d{4})/);
        if (hdData) data = hdData[1];

        // Número de trechos declarado no cabeçalho (ex: "2 Trechos")
        const trechosHdr = lines[headerIdx].match(/(\d+)\s+Trechos?/i);
        const nTrechos = trechosHdr ? parseInt(trechosHdr[1], 10) : 1;

        const fimIdx = acharFimSecao(headerIdx);
        const scanFim = Math.min(fimIdx, headerIdx + (nTrechos > 1 ? 20 : 9));

        const iatas  = [];
        const horas  = [];
        const voos   = [];
        const datas  = [];

        for (let i = headerIdx + 1; i < scanFim; i++) {
            const _raw = lines[i];
            // Pula linhas de passageiros/bagagem para evitar capturar nomes como IATA
            if (/E-?[Tt]icket|Passageiros?\s*:|Bagagens?\*?|Assentos?\s/i.test(_raw)) continue;
            const _r1  = _raw.replace(/\b([A-Z])\s*\|\s*([A-Z])\b/g, '$1I$2');
            // 3 letras isoladas: "G I G" → "GIG" (concat direto)
            const _r2  = _r1.replace(/\b([A-Z])\b\s+\b([A-Z])\b\s+\b([A-Z])\b/g, '$1$2$3');
            // 2 letras isoladas: "G G" → "GIG" (OCR perde letra do meio com ✈)
            const ln   = _r2.replace(/\b([A-Z])\s+([A-Z])\b/g, '$1I$2');
            if (_raw !== ln) console.log(`[PDF-GOL preproc] "${_raw}" => "${ln}"`);

            // ① IATAs — só extrai de linhas-rota (com seta » → > -) ou texto colado (NATIVO).
            // Evita captar códigos soltos de linhas como "03/05/2026 1669 03/05/2026" (sem rota)
            // ou de linhas de descrição de aeroporto ("Aer. Galeao Antonio Ca").
            const temSeta = /[»→>←\-]/.test(ln);
            const colado = ln.match(/^([A-Z]{3})([A-Z]{3})$/);
            if (colado) {
                iatas.push(colado[1], colado[2]);
            } else if (temSeta) {
                const todos = (ln.match(/\b([A-Z]{3})\b/g) || []).filter(c => !SKIP_IATA.has(c));
                for (const c of todos) iatas.push(c);
                // Fallback: cidades → IATAs quando a linha tem rota mas nenhum código
                if (!todos.length) {
                    const cidadeLn = ln.replace(/[»\->→←]/g, '|').toLowerCase()
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const partes = cidadeLn.split('|').map(s => s.trim()).filter(Boolean);
                    for (const parte of partes) {
                        for (const [cidade, iata] of Object.entries(CIDADE_IATA)) {
                            if (parte.includes(cidade)) { iatas.push(iata); break; }
                        }
                    }
                }
            }

            // ② Horários — normaliza split do OCR antes de extrair
            const times = fixTimes(ln).match(/\b(\d{2}:\d{2})\b/g) || [];
            for (const t of times) horas.push(t);
            // Formato colado nativo: "13:5028/05/2026" (chegada grudada à data)
            if (!times.length) {
                const c = ln.match(/^(\d{2}:\d{2})/);
                if (c) horas.push(c[1]);
            }

            // ③ Número de voo:
            //    OCR:          "28/05/2026 1923 28/05/2026"
            //    Nativo colado: "G3192328/05/202612:20"
            //    Nativo espaços: "G3 1923  28/05/2026  12:20"
            const ocr = ln.match(/\d{2}\/\d{2}\/\d{4}\s+(\d{3,4})\s+\d{2}\/\d{2}\/\d{4}/);
            if (ocr) voos.push('G3 ' + ocr[1]);
            const nc = ln.match(/G3(\d+)(\d{2}\/\d{2}\/\d{4})(\d{2}:\d{2})/);
            if (nc) { voos.push('G3 ' + nc[1]); datas.push(nc[2]); }
            const ns = ln.match(/G3\s*(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
            if (ns) { voos.push('G3 ' + ns[1]); datas.push(ns[2]); }
        }

        // Remove IATAs duplicados consecutivos (OCR às vezes repete "GIG GIG")
        const iatasLimpos = iatas.filter((c, idx) => idx === 0 || c !== iatas[idx - 1]);

        const origem  = iatasLimpos[0] || '';
        const destino = iatasLimpos.length > 1 ? iatasLimpos[iatasLimpos.length - 1] : '';
        const partida = horas[0] || '';
        const chegada = horas.length > 1 ? horas[horas.length - 1] : '';
        const voo     = [...new Set(voos)].join(' + ');
        if (!data && datas.length) data = datas[0];

        console.log(`[PDF-GOL] Trecho-scan (${nTrechos}t): ${iatasLimpos[0]||'?'}→${iatasLimpos[iatasLimpos.length-1]||'?'} ${partida||'?'}→${chegada||'?'} voo="${voo}"`);

        return { voo, data, partida, chegada, origem, destino };
    };

    // ── IDA ──────────────────────────────────────────────────────────────────
    // Texto nativo: "VOOS DE IDA"  |  OCR: "Itinerario de IDA …" / "|tinerario de IDA …"
    // Fallback: qualquer linha com "IDA" e data DD/MM/YYYY (cabeçalho de seção)
    const idaIdx = lines.findIndex(l =>
        /^VOOS?\s+DE\s+IDA$/i.test(l) ||
        /itiner[aá].?rio\s+de\s+IDA/i.test(l) ||
        /tinerario\s+de\s+IDA/i.test(l) ||
        (/\bIDA\b/.test(l) && /\d{2}\/\d{2}\/\d{4}/.test(l))
    );
    const idaDados = idaIdx >= 0 ? extrairVoo(idaIdx) : null;

    // ── VOLTA ─────────────────────────────────────────────────────────────────
    const voltaIdx = lines.findIndex(l =>
        /^VOOS?\s+DE\s+VOLTA$/i.test(l) ||
        /itiner[aá].?rio\s+de\s+VOLTA/i.test(l) ||
        /tinerario\s+de\s+VOLTA/i.test(l) ||
        (/\bVOLTA\b/.test(l) && /\d{2}\/\d{2}\/\d{4}/.test(l))
    );
    const voltaDados = voltaIdx >= 0 ? extrairVoo(voltaIdx) : null;

    // ── Corrige erro OCR nos IATAs da VOLTA inferindo da IDA (viagem de ida e volta) ──
    // Ex: OCR lê "GSA" em vez de "SSA"; se o destino da VOLTA bate com a origem da IDA,
    // então a origem da VOLTA deve ser o destino da IDA.
    if (voltaDados && idaDados && idaDados.origem && idaDados.destino) {
        if (!voltaDados.origem || !voltaDados.destino) {
            voltaDados.origem  = idaDados.destino;
            voltaDados.destino = idaDados.origem;
        } else if (voltaDados.destino === idaDados.origem && voltaDados.origem !== idaDados.destino) {
            voltaDados.origem = idaDados.destino; // corrige OCR da origem
        }
    }

    console.log('[PDF-GOL] Parsed:', { localizador, passageiroNome, idaDados, voltaDados });

    // ── Converte DD/MM/YYYY → YYYY-MM-DD ──────────────────────────────────────
    const toIso = (ddmmyyyy) => {
        if (!ddmmyyyy) return '';
        const [d, m, y] = ddmmyyyy.split('/');
        return (y && m && d) ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : '';
    };

    // Retorna IDA/VOLTA sempre que houver data OU código de aeroporto detectados,
    // mesmo que o número de voo não tenha sido extraído pelo OCR.
    const temIda   = idaDados   && (idaDados.data   || idaDados.origem);
    const temVolta = voltaDados && (voltaDados.data  || voltaDados.origem);

    return {
        localizador,
        passageiroNome,
        ida: temIda ? {
            origem:      idaDados.origem,
            destino:     idaDados.destino,
            data:        toIso(idaDados.data),
            horaPartida: idaDados.partida,
            horaChegada: idaDados.chegada,
            voo:         idaDados.voo,
        } : null,
        volta: temVolta ? {
            origem:      voltaDados.origem,
            destino:     voltaDados.destino,
            data:        toIso(voltaDados.data),
            horaPartida: voltaDados.partida,
            horaChegada: voltaDados.chegada,
            voo:         voltaDados.voo,
        } : null,
    };
}

/**
 * OCR via pdftoppm (poppler-utils) + tesseract.js  — Linux com poppler instalado
 */
async function ocrizarViaPdftoppm(pdfBuffer) {
    const { execFile } = require('child_process');
    const os           = require('os');
    const { createWorker } = require('tesseract.js');

    const tmpDir  = os.tmpdir();
    const tmpId   = `gol_${Date.now()}`;
    const tmpPdf  = path.join(tmpDir, `${tmpId}.pdf`);
    const tmpBase = path.join(tmpDir, tmpId);

    fs.writeFileSync(tmpPdf, pdfBuffer);

    try {
        await new Promise((resolve, reject) => {
            execFile('pdftoppm', ['-png', '-r', '300', tmpPdf, tmpBase],
                { timeout: 60000 },
                (err) => {
                    if (err) reject(new Error('pdftoppm indisponível'));
                    else resolve();
                }
            );
        });

        const pngs = fs.readdirSync(tmpDir)
            .filter(f => f.startsWith(tmpId) && f.endsWith('.png'))
            .sort()
            .map(f => path.join(tmpDir, f));

        if (!pngs.length) throw new Error('pdftoppm não gerou imagens');

        console.log(`[PDF-GOL pdftoppm] ${pngs.length} página(s)`);

        const worker = await createWorker('eng');
        let texto = '';
        try {
            // Pass 1: OCR padrão — extrai dados de voo, passageiros, etc.
            for (const png of pngs) {
                const { data: { text } } = await worker.recognize(png);
                texto += text + '\n';
            }

            // Palavras que NÃO são PNR GOL
            const SKIP_PSM = new Set([
                'VIAJANTES','PASSAGEIROS','LOCALIZADOR','INFORMACOES','INFORMACDES',
                'SALVADOR','RECIFE','MANAUS','BRASILIA','FORTALEZA','CURITIBA',
                'ITINERARIO','GIRAMUNDO','AGENCY','ONLINE','ASSENTO','BAGAGEM',
                'JUNIOR','MARINA','HEMILIA','TERCEIRA','QUARTA','QUINTA',
                'SEXTA','SABADO','DOMINGO','VISUALIZAR','RESERVA',
                'VOLTA','TRECHO','TICKET','VIAJEM','VIAGEM','BILHETE',
                'PRIMEIRO','SEGUNDA','TERCEIRO','ITINERA','AEROPORTO',
                'INTERNA','DEPUTADO','INTERNACIONAL','CONFIRMA','LACERDA',
                'CARNEIRO','CAVALCANTI','SILVA','LAURA','MAURICIO',
            ]);

            const _buscarCandidato = (txt) => {
                // Código contínuo 5-8 chars alfanuméricos
                const cands = (txt.match(/\b([A-Z][A-Z0-9]{4,7})\b/g) || []);
                const found = cands.find(w => !SKIP_PSM.has(w));
                if (found) return found;
                // Letras espaçadas pelo OCR: "J T K D V F" → "JTKDVF"
                const spaced = (txt.match(/\b([A-Z0-9](?: [A-Z0-9]){4,7})\b/g) || []);
                for (const sm of spaced) {
                    const j = sm.replace(/ /g, '');
                    if (j.length >= 5 && !SKIP_PSM.has(j)) {
                        console.log(`[PDF-GOL pdftoppm] letras espaçadas: "${sm}" → "${j}"`);
                        return j;
                    }
                }
                return null;
            };

            let locCode = null;

            // PSM 11 — Sparse Text: tenta detectar o código na caixa colorida
            await worker.setParameters({ tessedit_pageseg_mode: 11 });
            const { data: { text: sparse11 } } = await worker.recognize(pngs[0]);

            // Busca especificamente APÓS o label "Localizador" no texto sparse.
            // Não usa fallback genérico para evitar capturar palavras do nome do passageiro.
            const locLabelIdx = sparse11.toLowerCase().indexOf('localizador');
            if (locLabelIdx >= 0) {
                const afterLabel = sparse11.substring(locLabelIdx + 'localizador'.length, locLabelIdx + 'localizador'.length + 80);
                const mAfter = afterLabel.match(/\b([A-Z][A-Z0-9]{4,7})\b/);
                if (mAfter && !SKIP_PSM.has(mAfter[1])) {
                    locCode = mAfter[1];
                    console.log(`[PDF-GOL pdftoppm] PSM11 localizador após label: ${locCode}`);
                }
            } else {
                // Label não detectado — tenta candidato genérico só se estiver em área delimitada
                locCode = _buscarCandidato(sparse11.substring(0, 200));
            }

            if (locCode) {
                console.log(`[PDF-GOL pdftoppm] PSM11 encontrou localizador: ${locCode}`);
                texto = `Localizador\n${locCode}\n` + texto;
            } else {
                console.log(`[PDF-GOL pdftoppm] PSM11 não encontrou localizador — usuário deverá informar manualmente`);
            }
        } finally {
            await worker.terminate();
        }

        console.log(`[PDF-GOL pdftoppm] ${texto.length} chars extraídos`);
        return texto;

    } finally {
        try { fs.unlinkSync(tmpPdf); } catch (_) {}
        try {
            fs.readdirSync(tmpDir)
                .filter(f => f.startsWith(tmpId))
                .forEach(f => { try { fs.unlinkSync(path.join(tmpDir, f)); } catch (_) {} });
        } catch (_) {}
    }
}

/**
 * OCR via Puppeteer + PDF.js (CDN) + tesseract.js
 * Renderiza o PDF em canvas usando PDF.js puro (JavaScript) dentro do Chrome headless.
 * Não depende do viewer embutido do Chrome (que não funciona em headless).
 * Funciona em qualquer plataforma sem dependências de sistema.
 */
async function ocrizarViaPuppeteer(pdfBuffer) {
    const os = require('os');
    const { createWorker } = require('tesseract.js');

    const tmpDir = os.tmpdir();
    const tmpId  = `gol_${Date.now()}`;
    const tmpPng = path.join(tmpDir, `${tmpId}_ss.png`);

    // PDF.js 3.x (versão estável com API compatível)
    const PDFJS_CDN  = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    const WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdfBase64 = pdfBuffer.toString('base64');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{margin:0;padding:8px;background:white}canvas{display:block;margin-bottom:8px}</style>
</head><body>
<div id="pages"></div>
<script src="${PDFJS_CDN}"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc = '${WORKER_CDN}';
(async () => {
  try {
    const raw = atob('${pdfBase64}');
    const u8  = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
    const doc = await pdfjsLib.getDocument({ data: u8 }).promise;
    const div = document.getElementById('pages');
    for (let n = 1; n <= doc.numPages; n++) {
      const pg = await doc.getPage(n);
      const vp = pg.getViewport({ scale: 2 });
      const c  = document.createElement('canvas');
      c.width  = vp.width;
      c.height = vp.height;
      div.appendChild(c);
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    }
    document.title = 'OK';
  } catch (e) {
    document.title = 'ERR:' + e.message;
  }
})();
</script></body></html>`;

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {})
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 900, height: 1300, deviceScaleFactor: 1 });

        console.log('[PDF-GOL Puppeteer] Carregando PDF.js e renderizando...');

        // Carrega o HTML com PDF.js — waitUntil networkidle0 aguarda os scripts do CDN
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

        // Aguarda PDF.js terminar a renderização (sinaliza via document.title)
        await page.waitForFunction(
            () => document.title === 'OK' || document.title.startsWith('ERR:'),
            { timeout: 30000 }
        );

        const title = await page.title();
        if (title.startsWith('ERR:')) {
            throw new Error('PDF.js: ' + title.replace('ERR:', ''));
        }

        // Screenshot de todas as páginas renderizadas
        await page.screenshot({ path: tmpPng, fullPage: true });
        await browser.close();
        browser = null;

        console.log(`[PDF-GOL Puppeteer] Screenshot salvo: ${tmpPng}`);

        // OCR com tesseract.js
        const worker = await createWorker('eng');
        let texto = '';
        try {
            const { data: { text } } = await worker.recognize(tmpPng);
            texto = text;
        } finally {
            await worker.terminate();
        }

        console.log(`[PDF-GOL Puppeteer OCR] ${texto.length} chars extraídos`);
        return texto;

    } finally {
        if (browser) { try { await browser.close(); } catch (_) {} }
        try { fs.unlinkSync(tmpPng); } catch (_) {}
    }
}

/**
 * Extrai APENAS o localizador GOL via PSM11 (Sparse Text) na 1ª página do PDF.
 * Usado como fallback quando o texto nativo (pdf-parse) não contém o localizador
 * porque ele está em uma caixa colorida/gráfica que pdf-parse não extrai.
 * Requer pdftoppm (poppler-utils) instalado no sistema.
 */
async function extrairLocalizadorPSM11(pdfBuffer) {
    const { execFile }    = require('child_process');
    const os              = require('os');
    const { createWorker } = require('tesseract.js');

    const tmpDir  = os.tmpdir();
    const tmpId   = `gol_loc_${Date.now()}`;
    const tmpPdf  = path.join(tmpDir, `${tmpId}.pdf`);
    const tmpBase = path.join(tmpDir, tmpId);

    fs.writeFileSync(tmpPdf, pdfBuffer);

    try {
        // Converte só a 1ª página (onde o localizador GOL sempre aparece)
        await new Promise((resolve, reject) => {
            execFile('pdftoppm', ['-png', '-r', '250', '-f', '1', '-l', '1', tmpPdf, tmpBase],
                { timeout: 30000 },
                (err) => err ? reject(new Error('pdftoppm indisponível: ' + err.message)) : resolve()
            );
        });

        const pngs = fs.readdirSync(tmpDir)
            .filter(f => f.startsWith(tmpId) && f.endsWith('.png'))
            .sort()
            .map(f => path.join(tmpDir, f));

        if (!pngs.length) throw new Error('pdftoppm não gerou imagem');

        const SKIP = new Set([
            'VIAJANTES','PASSAGEIROS','LOCALIZADOR','INFORMACOES','INFORMACDES',
            'SALVADOR','RECIFE','MANAUS','BRASILIA','FORTALEZA','CURITIBA',
            'ITINERARIO','GIRAMUNDO','AGENCY','ONLINE','ASSENTO','BAGAGEM',
            'JUNIOR','MARINA','HEMILIA','TERCEIRA','QUARTA','QUINTA',
            'SEXTA','SABADO','DOMINGO','VISUALIZAR','RESERVA',
            'VOLTA','TRECHO','TICKET','VIAJEM','VIAGEM','BILHETE',
            'PRIMEIRO','SEGUNDA','TERCEIRO','ITINERA','OUTROS',
        ]);

        const worker = await createWorker('eng');
        let localizador = '';
        try {
            await worker.setParameters({ tessedit_pageseg_mode: 11 });
            const { data: { text: sparse } } = await worker.recognize(pngs[0]);
            console.log(`[PSM11] sparse (${sparse.length} chars): ${sparse.substring(0, 200)}`);

            // Busca após "localizador" no sparse text (janela de 300 chars)
            const locIdx  = sparse.toLowerCase().indexOf('localizador');
            const buscarEm = locIdx >= 0 ? sparse.substring(locIdx, locIdx + 300) : sparse.substring(0, 500);
            const candidatos = (buscarEm.match(/\b([A-Z]{6})\b/g) || []);
            localizador = candidatos.find(w => !SKIP.has(w)) || '';
        } finally {
            await worker.terminate();
        }

        return localizador;

    } finally {
        try { fs.unlinkSync(tmpPdf); } catch (_) {}
        try {
            fs.readdirSync(tmpDir)
                .filter(f => f.startsWith(tmpId))
                .forEach(f => { try { fs.unlinkSync(path.join(tmpDir, f)); } catch (_) {} });
        } catch (_) {}
    }
}

/**
 * OCR de PDF baseado em imagem.
 * Tenta pdftoppm (poppler-utils, Linux) primeiro, depois Puppeteer (cross-platform).
 */
async function ocrizarPdf(pdfBuffer) {
    // Tentativa 1: pdftoppm (mais rápido, requer poppler-utils instalado)
    try {
        return await ocrizarViaPdftoppm(pdfBuffer);
    } catch (e) {
        console.log(`[PDF-GOL] pdftoppm não disponível (${e.message}) — usando Puppeteer...`);
    }
    // Tentativa 2: Puppeteer screenshot (cross-platform, sem dependências de sistema)
    return await ocrizarViaPuppeteer(pdfBuffer);
}

/**
 * POST /api/reservas/capturar-pdf
 * Extrai dados de bilhete GOL a partir de PDF enviado pelo cliente.
 * Suporta PDFs com texto nativo e PDFs baseados em imagem (via OCR).
 */
router.post('/capturar-pdf', authMiddleware, upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Nenhum arquivo PDF enviado' });
        }

        // ── Tentativa 1: extração de texto nativo ────────────────────────
        let text = '';
        let usouOcr = false;
        try {
            const pdfParse = require('pdf-parse');
            const pdfData  = await pdfParse(req.file.buffer);
            text = pdfData.text || '';
        } catch (e) {
            console.warn('[PDF-GOL] pdf-parse falhou:', e.message);
        }

        // ── Tentativa 2: OCR via pdftoppm + tesseract.js ─────────────────
        if (!text || text.trim().length < 30) {
            console.log('[PDF-GOL] PDF sem texto — tentando OCR...');
            try {
                text = await ocrizarPdf(req.file.buffer);
                usouOcr = true;
            } catch (ocrErr) {
                console.error('[PDF-GOL] OCR falhou:', ocrErr.message);
                return res.status(400).json({
                    success: false,
                    message: 'PDF sem texto legível e OCR falhou: ' + ocrErr.message
                });
            }
        }

        if (!text || text.trim().length < 20) {
            return res.status(400).json({ success: false, message: 'Não foi possível extrair texto do PDF' });
        }

        console.log(`[PDF-GOL] Texto (${usouOcr ? 'OCR' : 'nativo'}): ${text.length} chars`);
        const bilhete = parsearBilheteGolPdf(text);
        console.log(`[PDF-GOL] Localizador: ${bilhete.localizador} | IDA: ${bilhete.ida?.voo} ${bilhete.ida?.origem}→${bilhete.ida?.destino} | VOLTA: ${bilhete.volta?.voo}`);

        // ── Fallback nome do arquivo: "JXLPMA.pdf" → localizador "JXLPMA" ────
        if (!bilhete.localizador && req.file.originalname) {
            const nomeArquivo = path.basename(req.file.originalname, path.extname(req.file.originalname)).trim().toUpperCase();
            if (/^[A-Z]{5,8}$/.test(nomeArquivo)) {
                bilhete.localizador = nomeArquivo;
                console.log(`[PDF-GOL] Localizador via nome do arquivo: ${nomeArquivo}`);
            }
        }

        // ── Fallback PSM11: localizador não encontrado no texto nativo ────────
        // O GOL exibe o localizador em caixa colorida — pdf-parse às vezes não consegue
        // extrair texto de elementos gráficos. PSM11 (sparse text) via pdftoppm captura isso.
        if (!bilhete.localizador && !usouOcr) {
            console.log('[PDF-GOL] Localizador vazio — tentando PSM11 OCR na caixa gráfica...');
            try {
                const locViaPsm = await extrairLocalizadorPSM11(req.file.buffer);
                if (locViaPsm) {
                    bilhete.localizador = locViaPsm;
                    console.log(`[PDF-GOL] Localizador via PSM11 fallback: ${locViaPsm}`);
                }
            } catch (e) {
                console.warn('[PDF-GOL] PSM11 fallback falhou:', e.message);
            }
        }

        const _lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const _dbg = _lines.slice(0,15).map(l => {
            const r1 = l.replace(/\b([A-Z])\s*\|\s*([A-Z])\b/g, '$1I$2');
            const r2 = r1.replace(/\b([A-Z])\b\s+\b([A-Z])\b\s+\b([A-Z])\b/g, '$1$2$3');
            return l !== r2 ? `FIXED: ${r2}` : l;
        });
        res.json({ success: true, bilhete, usouOcr, _v: 'fix-gig-4', _dbg });

    } catch (error) {
        console.error('[PDF-GOL] Erro:', error.message);
        res.status(500).json({ success: false, message: 'Erro ao processar PDF: ' + error.message });
    }
});

// ─────────────────────────────────────────────
// CRUD de Reservas (banco de dados)
// ─────────────────────────────────────────────

router.use(authMiddleware);

/**
// Debug: retorna o último arquivo de diagnóstico Azul gravado pelo extrairBilheteAzul
/**
 * POST /api/reservas/azul-lookup
 * Tenta buscar dados de uma reserva Azul diretamente (sem Puppeteer).
 * Retorna { success, data } se OK, ou { success: false, blocked: true } se Akamai bloquear.
 */
router.post('/azul-lookup', authMiddleware, async (req, res) => {
    const { pnr, origin } = req.body;
    if (!pnr || !origin) return res.status(400).json({ success: false, message: 'pnr e origin são obrigatórios' });

    // Fluxo correto: Firebase anon → token Azul → POST /canonical/api/booking/v5/bookings/{pnr}
    const FIREBASE_KEY = 'AIzaSyCqYQxIZDC5usp5iTuiPacTF9xRvfw7wmg';
    const OCP_KEY      = 'fb38e642c899485e893eb8d0a373cc17';

    try {
        // 1. Firebase anonymous signup
        console.log(`[AzulLookup] ${pnr}/${origin} — obtendo token Firebase...`);
        const fbResp = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_KEY}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }), signal: AbortSignal.timeout(10000) }
        );
        if (!fbResp.ok) throw new Error(`Firebase HTTP ${fbResp.status}`);
        const fbData = await fbResp.json();
        if (!fbData.idToken) throw new Error('Firebase: sem idToken');

        // 2. Trocar por token Azul
        console.log(`[AzulLookup] Trocando por token Azul...`);
        const azResp = await fetch(
            'https://b2c-api.voeazul.com.br/authentication/api/authentication/v1/token',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json', 'Accept': 'application/json',
                    'ocp-apim-subscription-key': OCP_KEY,
                    'Origin': 'https://www.voeazul.com.br', 'Referer': 'https://www.voeazul.com.br/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                },
                body: JSON.stringify({ firebaseToken: fbData.idToken }),
                signal: AbortSignal.timeout(10000),
            }
        );
        if (!azResp.ok) throw new Error(`Azul auth HTTP ${azResp.status}`);
        const azData  = await azResp.json();
        const azToken = azData.data;
        if (!azToken) throw new Error('Azul: token ausente na resposta');

        // 3. Buscar reserva via POST com departureStation no body
        console.log(`[AzulLookup] Buscando reserva ${pnr}...`);
        const bkResp = await fetch(
            `https://b2c-api.voeazul.com.br/canonical/api/booking/v5/bookings/${pnr}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json', 'Accept': 'application/json',
                    'Authorization': `Bearer ${azToken}`,
                    'ocp-apim-subscription-key': OCP_KEY,
                    'Origin': 'https://www.voeazul.com.br',
                    'Referer': `https://www.voeazul.com.br/br/pt/home/minhas-viagens/confirmacao?pnr=${pnr}&origin=${origin}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                },
                body: JSON.stringify({ departureStation: origin }),
                signal: AbortSignal.timeout(12000),
            }
        );
        console.log(`[AzulLookup] Booking ${pnr} → HTTP ${bkResp.status}`);
        if (!bkResp.ok) {
            return res.json({ success: false, blocked: bkResp.status === 403, httpStatus: bkResp.status,
                message: bkResp.status === 404 ? 'Reserva não encontrada' : `HTTP ${bkResp.status}` });
        }

        const json = await bkResp.json();
        // Converte para bilheteData (formato esperado pelo frontend)
        const root     = json?.data || json;
        const journeys = root?.journeys || [];
        if (!journeys.length) return res.json({ success: false, message: 'Booking sem journeys' });

        function toDataLookup(v) { if (!v) return ''; const m = String(v).match(/(\d{4}-\d{2}-\d{2})/); return m ? m[1] : ''; }
        function toHoraLookup(v) { if (!v) return ''; const m = String(v).match(/T(\d{2}:\d{2})/); return m ? m[1] : v.substring(0,5); }

        const id0 = journeys[0].identifier || journeys[0];
        const ida = {
            origem:      id0.departureStation || origin,
            destino:     id0.arrivalStation   || '',
            data:        toDataLookup(id0.std),
            horaPartida: toHoraLookup(id0.std),
            horaChegada: toHoraLookup(id0.sta),
            voo:         `AD ${id0.flightNumber || ''}`.trim(),
        };
        let volta = null;
        if (journeys.length > 1) {
            const id1 = journeys[1].identifier || journeys[1];
            volta = {
                origem:      id1.departureStation || '',
                destino:     id1.arrivalStation   || '',
                data:        toDataLookup(id1.std),
                horaPartida: toHoraLookup(id1.std),
                horaChegada: toHoraLookup(id1.sta),
                voo:         `AD ${id1.flightNumber || ''}`.trim(),
            };
        }
        const pj = journeys[0].passengerJourney?.[0];
        const passageiroNome = pj?.passenger
            ? `${pj.passenger.firstName||''} ${pj.passenger.lastName||''}`.trim()
            : '';

        const bilheteData = { passageiroNome, tripType: root.tripType || '', ida, volta };
        console.log('[AzulLookup] OK:', JSON.stringify({ ida: { data: ida.data, origem: ida.origem, destino: ida.destino }, volta: volta ? { data: volta.data } : null }));
        return res.json({ success: true, bilheteData });

    } catch (err) {
        console.warn('[AzulLookup] Erro:', err.message);
        return res.json({ success: false, blocked: true, message: 'Falha no lookup Azul: ' + err.message });
    }
});

// ─── GOL Lookup — Async Job System ───────────────────────────────────────────
// Puppeteer leva ~23s — excede o timeout de 30s do Render se resposta for síncrona.
// Solução: POST responde imediatamente com jobId; Puppeteer roda em background;
//          frontend faz polling em GET /gol-status/:jobId.
// ─────────────────────────────────────────────────────────────────────────────

const golJobs = new Map(); // jobId → { status, bilheteData?, error?, createdAt }

// Limpa jobs com mais de 10 minutos para não vazar memória
setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [id, job] of golJobs) {
        if (job.createdAt < cutoff) golJobs.delete(id);
    }
}, 5 * 60 * 1000);

async function _executarGolLookup(jobId, pnr, origin, lastName) {
    // ESTRATÉGIA: browser obtém JWT do create-token (~30s), fecha imediatamente,
    // depois Node.js chama pnrBnpl direto (~3s). Evita OOM no Render (512MB).
    let browser;
    const t0 = Date.now();
    const elapsed = () => Math.round((Date.now()-t0)/1000) + 's';
    console.log(`[GolLookup] === job ${jobId} === pnr=${pnr} origin=${origin} lastName=${lastName}`);

    const hardTimeout = setTimeout(() => {
        console.warn('[GolLookup] HARD TIMEOUT 70s');
        if (browser) browser.close().catch(() => {});
        if (golJobs.get(jobId)?.status === 'processing')
            golJobs.set(jobId, { status: 'failed', error: 'Timeout 70s — GOL não retornou JWT', createdAt: Date.now() });
    }, 70000);

    try {
        const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
        console.log('[GolLookup] chromePath:', chromePath || 'default');

        browser = await puppeteerExtra.launch({
            headless: true,
            executablePath: chromePath,
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-gpu', '--no-zygote',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1280,720',
                '--disable-extensions', '--disable-background-networking', '--disable-sync',
                '--js-flags=--max_old_space_size=180',  // limita heap V8 do renderer → evita OOM
                '--renderer-process-limit=1',
                '--enable-low-end-device-mode',
                '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                '--disable-ipc-flooding-protection',
            ]
        });
        console.log('[GolLookup] browser OK', elapsed());

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 720 });
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8' });

        // Captura pnrBnpl via response listener (página chama automaticamente com recaptcha)
        // pnrBnpl requer recaptcha token gerado pela página — não pode ser chamado manualmente
        let pnrJson = null;
        let allUrls = [];
        const pnrPromise = new Promise(resolve => {
            page.on('response', async resp => {
                const url = resp.url();
                allUrls.push(url.substring(0, 80));
                if (url.includes('gol-auth-api') || url.includes('pnrBnpl') || url.includes('booking'))
                    console.log(`[GolLookup] ${elapsed()} ${url.substring(0,80)} HTTP${resp.status()}`);
                if (!url.includes('pnrBnpl')) return;
                try {
                    let txt = '';
                    try { txt = (await resp.buffer()).toString('utf8'); }
                    catch (_) { txt = await resp.text().catch(() => ''); }
                    if (!txt || txt.length < 20) { console.warn('[GolLookup] pnrBnpl vazio/curto'); return; }
                    const json = JSON.parse(txt);
                    if (json?.success && json?.response?.pnrRetrieveResponse) {
                        pnrJson = json;
                        console.log('[GolLookup] pnrBnpl ✓', elapsed());
                        resolve(json);
                    } else { console.warn('[GolLookup] pnrBnpl payload inválido (success ou response.pnrRetrieveResponse ausente)'); }
                } catch (e) { console.warn('[GolLookup] parse err:', e.message); }
            });
        });

        const golUrl = `https://b2c.voegol.com.br/minhas-viagens/encontrar-viagem?codigoReserva=${pnr}&origem=${origin}${lastName ? '&sobrenome='+encodeURIComponent(lastName.toLowerCase()) : ''}`;
        console.log('[GolLookup] goto', elapsed());
        await page.goto(golUrl, { waitUntil: 'networkidle2', timeout: 40000 }).catch(e => console.warn('[GolLookup] Nav:', e.message));
        console.log('[GolLookup] networkidle2', elapsed());

        // Tenta clicar no botão de busca se houver
        try {
            await page.click('button[type="submit"], button:contains("Buscar"), [data-test*="search"]').catch(() => {});
            console.log('[GolLookup] clicou busca', elapsed());
        } catch (e) { /* sem botão */ }

        // Aguarda pnrBnpl — com --js-flags=--max_old_space_size=256 chega em ~15s local
        await Promise.race([pnrPromise, new Promise(r => setTimeout(r, 55000))]);
        console.log('[GolLookup] após wait', elapsed(), '| pnrJson:', pnrJson ? 'OK' : 'null');

        const pageTitle = await page.title().catch(() => '');
        console.log('[GolLookup] título:', pageTitle);
        const isCf = /just a moment|checking your|attention required|cloudflare/i.test(pageTitle);

        if (!pnrJson) {
            const motivo = isCf ? 'Cloudflare bloqueou o IP do servidor' : `pnrBnpl não capturado (título: "${pageTitle}") — verifique localizador, origem e sobrenome`;
            console.warn('[GolLookup] FALHOU:', motivo);
            console.warn('[GolLookup] URLs capturadas:', allUrls.slice(-20));
            golJobs.set(jobId, { status: 'failed', error: motivo, pageTitle, urlsCapturadas: allUrls.slice(-20), createdAt: Date.now() });
            return;
        }

        // Parseia bilheteData
        const pnrObj = pnrJson.response.pnrRetrieveResponse.pnr || {};
        const parts  = pnrObj?.itinerary?.itineraryParts || [];
        const toDataG = dt => dt ? String(dt).substring(0,10) : '';
        const toHoraG = dt => dt ? String(dt).substring(11,16) : '';
        const seg0 = parts[0]?.segments?.[0] || {};
        const seg1 = parts.length > 1 ? (parts[parts.length-1]?.segments?.[0] || null) : null;

        const ida  = { origem: seg0.origin||origin, destino: seg0.destination||'', data: toDataG(seg0.departure), horaPartida: toHoraG(seg0.departure), horaChegada: toHoraG(seg0.arrival), voo: `G3 ${seg0.flight?.flightNumber||''}`.trim() };
        const volta = seg1 ? { origem: seg1.origin||'', destino: seg1.destination||'', data: toDataG(seg1.departure), horaPartida: toHoraG(seg1.departure), horaChegada: toHoraG(seg1.arrival), voo: `G3 ${seg1.flight?.flightNumber||''}`.trim() } : null;
        const p0 = (pnrObj?.passengers||[])[0];
        const passageiroNome = p0 ? `${p0.firstName||''} ${p0.lastName||''}`.trim() : (lastName||'');

        golJobs.set(jobId, { status: 'done', bilheteData: { passageiroNome, tripType: parts.length>1?'Roundtrip':'OneWay', ida, volta }, createdAt: Date.now() });
        console.log('[GolLookup] ✓', elapsed(), ida.origem, '→', ida.destino, ida.data);

    } catch (err) {
        console.error('[GolLookup] erro:', err.message);
        golJobs.set(jobId, { status: 'failed', error: err.message, createdAt: Date.now() });
    } finally {
        clearTimeout(hardTimeout);
        if (browser) await browser.close().catch(() => {});
        console.log(`[GolLookup] job ${jobId} encerrado status:`, golJobs.get(jobId)?.status);
    }
}

/**
 * POST /api/reservas/gol-lookup
 * Responde imediatamente com jobId — Puppeteer roda em background.
 * Frontend faz polling em GET /gol-status/:jobId.
 */
router.post('/gol-lookup', authMiddleware, (req, res) => {
    const { pnr, origin, lastName } = req.body;
    if (!pnr || !origin) return res.status(400).json({ success: false, message: 'pnr e origin são obrigatórios' });

    const jobId = `gol_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    golJobs.set(jobId, { status: 'processing', createdAt: Date.now() });

    // Inicia Puppeteer sem await — resposta HTTP sai imediatamente
    _executarGolLookup(jobId, pnr.toUpperCase(), origin.toUpperCase(), (lastName||'').toUpperCase())
        .catch(err => {
            console.error('[GolLookup] Erro fatal job', jobId, err.message);
            if (golJobs.get(jobId)?.status === 'processing')
                golJobs.set(jobId, { status: 'failed', error: err.message, createdAt: Date.now() });
        });

    res.json({ success: true, jobId, status: 'processing' });
});

/**
 * GET /api/reservas/gol-status/:jobId
 * Polling do resultado do lookup GOL.
 */
router.get('/gol-status/:jobId', authMiddleware, (req, res) => {
    const job = golJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job não encontrado ou expirado' });
    res.json({ success: true, ...job });
});

/**
 * GET /api/reservas/debug-gol
 * Diagnóstico: verifica se GOL é acessível via Puppeteer neste servidor.
 */
router.get('/debug-gol', authMiddleware, async (req, res) => {
    let browser;
    try {
        const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
        browser = await puppeteerExtra.launch({
            headless: true, executablePath: chromePath,
            args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--no-zygote']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

        const golUrls = [];
        page.on('response', async resp => {
            const u = resp.url();
            if (u.includes('voegol.com.br') || u.includes('gol-auth-api') || u.includes('booking-api') || u.includes('pnrBnpl')) {
                golUrls.push({ url: u.substring(0,100), status: resp.status() });
            }
        });

        await page.goto('https://b2c.voegol.com.br/minhas-viagens/encontrar-viagem?codigoReserva=TEST&origem=GRU&sobrenome=test', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 3000));

        const title    = await page.title().catch(() => '');
        const bodySnip = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '').catch(() => '');
        await browser.close();

        res.json({
            success: true,
            pageTitle: title,
            cloudflareDetectado: /just a moment|checking your|attention required/i.test(title),
            bodySnippet: bodySnip.substring(0, 200),
            urlsCapturadas: golUrls.slice(0, 15),
            chromePath: chromePath || 'default'
        });
    } catch (err) {
        if (browser) await browser.close().catch(() => {});
        res.json({ success: false, error: err.message });
    }
});

router.get('/debug-azul', authMiddleware, (req, res) => {
    try {
        const logFile = path.join(__dirname, '../../../backend/data/azul_debug.json');
        if (fs.existsSync(logFile)) {
            res.json({ success: true, debug: JSON.parse(fs.readFileSync(logFile, 'utf8')) });
        } else {
            res.json({ success: false, message: 'Nenhum debug disponível — faça uma captura primeiro.' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * GET /api/reservas/latam-debug
 * Retorna o último arquivo de diagnóstico LATAM gravado no servidor
 */
router.get('/latam-debug', async (req, res) => {
    try {
        const logFile = path.join(__dirname, '../../../backend/data/latam_debug.json');
        if (!fs.existsSync(logFile)) return res.status(404).json({ message: 'Nenhum debug LATAM disponível ainda' });
        const data = JSON.parse(fs.readFileSync(logFile, 'utf8'));
        res.json(data);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

/**
 * GET /api/reservas
 * Listar todas as reservas — inclui nome do cliente e fornecedor via JOIN
 */
router.get('/', async (req, res) => {
    try {
        const { busca, companhia, clienteId } = req.query;
        const conditions = [];
        const values = [];
        let idx = 1;

        if (busca) {
            conditions.push(`r.localizador ILIKE $${idx++}`);
            values.push(`%${busca}%`);
        }
        if (companhia) {
            conditions.push(`r.companhia = $${idx++}`);
            values.push(companhia);
        }
        if (clienteId) {
            conditions.push(`r."clienteId" = $${idx++}`);
            values.push(clienteId);
        }

        const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const { rows } = await pool.query(
            `SELECT r.*,
                c.nome  AS "clienteNome",
                f.nome  AS "fornecedorNome"
             FROM reservas r
             LEFT JOIN clientes    c ON c.id = r."clienteId"
             LEFT JOIN fornecedores f ON f.id = r."fornecedorId"
             ${where}
             ORDER BY r."createdAt" DESC`,
            values
        );

        res.json({ success: true, reservas: rows });
    } catch (error) {
        console.error('[Reservas GET] Erro:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/reservas
 * Salvar uma reserva no banco (upsert por id)
 */
router.post('/', async (req, res) => {
    try {
        const {
            id, companhia, localizador, dataIda, dataVolta,
            origem, destino, clienteId, fornecedorId,
            valorVenda, custos, saldo, dataEmissao,
            urlReserva, bilhete, emitidoPor
        } = req.body;

        if (!companhia || !localizador) {
            return res.status(400).json({ success: false, message: 'Companhia e localizador são obrigatórios' });
        }

        const bilheteStr = bilhete ? (typeof bilhete === 'string' ? bilhete : JSON.stringify(bilhete)) : null;

        // Verifica duplicidade: se localizador+companhia já existe com ID diferente, rejeita
        const dupParams = id ? [companhia, localizador, id] : [companhia, localizador];
        const dupWhere  = id
            ? `LOWER(companhia) = LOWER($1) AND UPPER(localizador) = UPPER($2) AND id != $3`
            : `LOWER(companhia) = LOWER($1) AND UPPER(localizador) = UPPER($2)`;
        const { rows: dupCheck } = await pool.query(
            `SELECT id FROM reservas WHERE ${dupWhere}`, dupParams
        );
        if (dupCheck.length > 0) {
            return res.status(409).json({ success: false, message: `Reserva ${localizador.toUpperCase()} (${companhia}) já está cadastrada` });
        }

        let reserva;
        if (id) {
            // Upsert: tenta atualizar se existir, senão cria com o id fornecido
            const { rows: existing } = await pool.query('SELECT id FROM reservas WHERE id = $1', [id]);
            if (existing.length > 0) {
                const { rows } = await pool.query(
                    `UPDATE reservas SET
                        companhia = $1, localizador = $2, "dataIda" = $3, "dataVolta" = $4,
                        origem = $5, destino = $6, "clienteId" = $7, "fornecedorId" = $8,
                        "valorVenda" = $9, custos = $10, saldo = $11, "dataEmissao" = $12,
                        "urlReserva" = $13, bilhete = $14, "emitidoPor" = $15, "updatedAt" = NOW()
                     WHERE id = $16 RETURNING *`,
                    [companhia, localizador, dataIda || null, dataVolta || null,
                     origem || null, destino || null, clienteId || null, fornecedorId || null,
                     parseFloat(valorVenda) || 0, parseFloat(custos) || 0, parseFloat(saldo) || 0,
                     dataEmissao || null, urlReserva || null, bilheteStr, emitidoPor || null, id]
                );
                reserva = rows[0];
            } else {
                const { rows } = await pool.query(
                    `INSERT INTO reservas (id, companhia, localizador, "dataIda", "dataVolta",
                        origem, destino, "clienteId", "fornecedorId",
                        "valorVenda", custos, saldo, "dataEmissao", "urlReserva", bilhete, "emitidoPor", "createdAt", "updatedAt")
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
                     RETURNING *`,
                    [id, companhia, localizador, dataIda || null, dataVolta || null,
                     origem || null, destino || null, clienteId || null, fornecedorId || null,
                     parseFloat(valorVenda) || 0, parseFloat(custos) || 0, parseFloat(saldo) || 0,
                     dataEmissao || null, urlReserva || null, bilheteStr, emitidoPor || null]
                );
                reserva = rows[0];
            }
        } else {
            const { rows } = await pool.query(
                `INSERT INTO reservas (id, companhia, localizador, "dataIda", "dataVolta",
                    origem, destino, "clienteId", "fornecedorId",
                    "valorVenda", custos, saldo, "dataEmissao", "urlReserva", bilhete, "emitidoPor", "createdAt", "updatedAt")
                 VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())
                 RETURNING *`,
                [companhia, localizador, dataIda || null, dataVolta || null,
                 origem || null, destino || null, clienteId || null, fornecedorId || null,
                 parseFloat(valorVenda) || 0, parseFloat(custos) || 0, parseFloat(saldo) || 0,
                 dataEmissao || null, urlReserva || null, bilheteStr, emitidoPor || null]
            );
            reserva = rows[0];
        }

        // Registrar/atualizar no serviço de alertas de check-in
        try {
            let clienteNome = '';
            let clienteTelefone = '';
            if (clienteId) {
                const { rows: cRows } = await pool.query('SELECT nome, telefone FROM clientes WHERE id = $1', [clienteId]);
                if (cRows.length > 0) {
                    clienteNome     = cRows[0].nome     || '';
                    clienteTelefone = cRows[0].telefone || '';
                }
            }
            AlertasService.registrar({
                id:              reserva.id,
                companhia:       companhia       || '',
                localizador:     localizador     || '',
                dataIda:         dataIda         || '',
                dataVolta:       dataVolta       || '',
                clienteNome,
                clienteTelefone,
                origem:          origem          || '',
                destino:         destino         || '',
                emitidoPor:      emitidoPor      || ''
            });
        } catch (alertaErr) {
            console.warn('[Reservas POST] Alerta não registrado:', alertaErr.message);
        }

        res.json({ success: true, reserva });
    } catch (error) {
        console.error('[Reservas POST] Erro:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * PUT /api/reservas/:id
 * Atualizar reserva por ID
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            clienteId, fornecedorId, valorVenda, custos,
            saldo, bilhete, dataIda, dataVolta, origem, destino, emitidoPor
        } = req.body;

        const sets = [];
        const values = [];
        let idx = 1;

        if (clienteId    !== undefined) { sets.push(`"clienteId" = $${idx++}`);    values.push(clienteId    || null); }
        if (fornecedorId !== undefined) { sets.push(`"fornecedorId" = $${idx++}`); values.push(fornecedorId || null); }
        if (valorVenda   !== undefined) { sets.push(`"valorVenda" = $${idx++}`);   values.push(parseFloat(valorVenda) || 0); }
        if (custos       !== undefined) { sets.push(`custos = $${idx++}`);          values.push(parseFloat(custos)     || 0); }
        if (saldo        !== undefined) { sets.push(`saldo = $${idx++}`);           values.push(parseFloat(saldo)      || 0); }
        if (dataIda      !== undefined) { sets.push(`"dataIda" = $${idx++}`);       values.push(dataIda    || null); }
        if (dataVolta    !== undefined) { sets.push(`"dataVolta" = $${idx++}`);     values.push(dataVolta  || null); }
        if (origem       !== undefined) { sets.push(`origem = $${idx++}`);          values.push(origem     || null); }
        if (destino      !== undefined) { sets.push(`destino = $${idx++}`);         values.push(destino    || null); }
        if (bilhete      !== undefined) {
            sets.push(`bilhete = $${idx++}`);
            values.push(bilhete ? (typeof bilhete === 'string' ? bilhete : JSON.stringify(bilhete)) : null);
        }
        if (emitidoPor   !== undefined) { sets.push(`"emitidoPor" = $${idx++}`); values.push(emitidoPor || null); }

        if (sets.length === 0) return res.status(400).json({ success: false, message: 'Nenhum campo para atualizar' });

        sets.push(`"updatedAt" = NOW()`);
        values.push(id);

        const { rows } = await pool.query(
            `UPDATE reservas SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        const reserva = rows[0];

        // Atualizar alerta de check-in com dados mais recentes
        if (reserva) {
            try {
                const { rows: full } = await pool.query(
                    `SELECT r.*, c.nome AS "clienteNome", c.telefone AS "clienteTelefone"
                     FROM reservas r LEFT JOIN clientes c ON c.id = r."clienteId"
                     WHERE r.id = $1`,
                    [id]
                );
                if (full.length > 0) {
                    const f = full[0];
                    AlertasService.registrar({
                        id:              f.id,
                        companhia:       f.companhia       || '',
                        localizador:     f.localizador     || '',
                        dataIda:         f.dataIda         ? f.dataIda.toISOString().substring(0, 10) : '',
                        dataVolta:       f.dataVolta       ? f.dataVolta.toISOString().substring(0, 10) : '',
                        clienteNome:     f.clienteNome     || '',
                        clienteTelefone: f.clienteTelefone || '',
                        origem:          f.origem          || '',
                        destino:         f.destino         || '',
                        emitidoPor:      f.emitidoPor      || ''
                    });
                }
            } catch (alertaErr) {
                console.warn('[Reservas PUT] Alerta não atualizado:', alertaErr.message);
            }
        }

        res.json({ success: true, reserva });
    } catch (error) {
        console.error('[Reservas PUT] Erro:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * DELETE /api/reservas/:id
 * Excluir reserva por ID
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM reservas WHERE id = $1', [id]);
        AlertasService.remover(id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Reservas DELETE] Erro:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
