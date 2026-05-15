/**
 * GiraMundoTour - Monitoramento de Preços de Voos
 *
 * - Periodicamente (cron) consulta flightSearch.buscarVoos() para cada monitoramento ativo
 * - Se preço mais baixo for inferior ao precoAtual (ou precoAlvo), envia email ao destinatário
 *   com os dados do cliente e do voo
 */

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { pool } = require('../config/database');
const flightSearch = require('./flightSearch.service');

const SCHEDULE = process.env.MONITORAMENTO_CRON || '0 */3 * * *'; // a cada 3 horas

// ─── Inicialização de tabelas ────────────────────────────────────────────────

async function criarTabelas() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS monitoramentos (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "clienteId" UUID,
            "clienteNome" VARCHAR(255),
            "clienteEmail" VARCHAR(255),
            "clienteTelefone" VARCHAR(50),
            origem VARCHAR(10) NOT NULL,
            destino VARCHAR(10) NOT NULL,
            "tipoViagem" VARCHAR(20) DEFAULT 'idaVolta',
            "dataIdaInicio" DATE NOT NULL,
            "dataIdaFim" DATE NOT NULL,
            "dataVoltaInicio" DATE,
            "dataVoltaFim" DATE,
            adultos INT DEFAULT 1,
            criancas INT DEFAULT 0,
            bebes INT DEFAULT 0,
            classe VARCHAR(20) DEFAULT 'economica',
            "precoAlvo" NUMERIC(10,2),
            "precoAtual" NUMERIC(10,2),
            "precoInicial" NUMERIC(10,2),
            "melhorVoo" JSONB,
            "emailDestino" VARCHAR(255),
            ativo BOOLEAN DEFAULT TRUE,
            "ultimaVerificacao" TIMESTAMP,
            "ultimaNotificacao" TIMESTAMP,
            observacoes TEXT,
            "createdAt" TIMESTAMP DEFAULT NOW(),
            "updatedAt" TIMESTAMP DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS monitoramento_historico (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "monitoramentoId" UUID REFERENCES monitoramentos(id) ON DELETE CASCADE,
            preco NUMERIC(10,2) NOT NULL,
            companhia VARCHAR(50),
            "dataIda" DATE,
            "dataVolta" DATE,
            detalhes JSONB,
            "verificadoEm" TIMESTAMP DEFAULT NOW()
        )
    `);

    await pool.query(`ALTER TABLE monitoramentos ADD COLUMN IF NOT EXISTS solicitante VARCHAR(255)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_monitoramento_ativo ON monitoramentos(ativo)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mon_hist_monitoramento ON monitoramento_historico("monitoramentoId")`);
}

const EMAIL_DEFAULT = 'giramundotourag@gmail.com';

// ─── Email ───────────────────────────────────────────────────────────────────

function criarTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

function formatarMoeda(v) {
    const n = parseFloat(v) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(d) {
    if (!d) return '';
    const s = String(d).slice(0, 10);
    const [y, m, dd] = s.split('-');
    return y && m && dd ? `${dd}/${m}/${y}` : s;
}

// Link direto de busca na companhia aérea (fallback: Google Flights)
function linkCompanhia(codigoCia, origem, destino, dataIda, dataVolta) {
    const ori = (origem || '').toUpperCase();
    const des = (destino || '').toUpperCase();
    const cia = (codigoCia || '').toUpperCase();
    const dIda = dataIda ? String(dataIda).slice(0, 10) : '';
    const dVolta = dataVolta ? String(dataVolta).slice(0, 10) : '';

    // dd/mm/yyyy (para GOL)
    const toBR = d => {
        if (!d) return '';
        const [y, m, dd] = d.split('-');
        return `${dd}/${m}/${y}`;
    };

    try {
        if (cia === 'AD') {
            const base = 'https://www.voeazul.com.br/br/pt/home/selecao-voos';
            const qs = new URLSearchParams({
                tripType: dVolta ? 'RoundTrip' : 'OneWay',
                departureStation: ori,
                arrivalStation: des,
                departureDate: dIda,
                ...(dVolta ? { returnDate: dVolta } : {}),
                adults: '1'
            });
            return `${base}?${qs.toString()}`;
        }
        if (cia === 'G3') {
            const qs = new URLSearchParams({
                de: ori,
                para: des,
                ida: toBR(dIda),
                ...(dVolta ? { volta: toBR(dVolta) } : {}),
                adultos: '1',
                criancas: '0',
                bebes: '0'
            });
            return `https://b2c.voegol.com.br/?${qs.toString()}`;
        }
        if (cia === 'LA' || cia === 'JJ') {
            const qs = new URLSearchParams({
                origin: ori,
                destination: des,
                outbound: dIda ? `${dIda}T12:00:00.000Z` : '',
                ...(dVolta ? { inbound: `${dVolta}T12:00:00.000Z` } : {}),
                adt: '1', chd: '0', inf: '0',
                trip: dVolta ? 'RT' : 'OW',
                cabin: 'Economy'
            });
            return `https://www.latamairlines.com/br/pt/oferta-voos?${qs.toString()}`;
        }
        if (cia === 'AV') return `https://www.avianca.com/br/pt/`;
        if (cia === 'CM') return `https://www.copaair.com/pt-br`;
        if (cia === 'TP') return `https://www.flytap.com/pt-br`;
        if (cia === 'AA') return `https://www.aa.com.br/`;
    } catch (_) {}

    // Fallback: Google Flights
    const base = 'https://www.google.com/travel/flights';
    const q = `Flights from ${ori} to ${des}${dIda ? ' on ' + dIda : ''}${dVolta ? ' returning ' + dVolta : ''}`;
    return `${base}?q=${encodeURIComponent(q)}`;
}

function nomeCompanhia(codigo) {
    const map = {
        AD: 'Azul', G3: 'GOL', LA: 'LATAM', JJ: 'LATAM',
        AV: 'Avianca', CM: 'Copa', TP: 'TAP', AA: 'American',
        IB: 'Iberia', AF: 'Air France', KL: 'KLM', DL: 'Delta',
        UA: 'United', BA: 'British Airways'
    };
    return map[(codigo || '').toUpperCase()] || codigo || '';
}

function blocoVoo(v, titulo) {
    if (!v) return '';
    const cia = v.companhia || nomeCompanhia(v.companhiaCodigo) || 'N/D';
    const num = v.numero ? ` · Voo ${v.numero}` : '';
    const rota = `${v.origem || ''} → ${v.destino || ''}`;
    const hora = `${v.partida?.horario || '--:--'} → ${v.chegada?.horario || '--:--'}`;
    const data = v.partida?.data ? fmtData(v.partida.data) : '';
    const dur = v.duracao ? ` · ${v.duracao}` : '';
    const escalas = v.escalas === 0 ? 'Direto' : (v.escalas > 0 ? `${v.escalas} escala(s)` : '');
    const preco = v.preco != null ? formatarMoeda(v.preco) : '';

    return `
        <div style="border:1px solid #e2e8f0; border-radius:10px; padding:14px; margin-top:10px; background:#f7fafc;">
            <div style="font-size:11px; text-transform:uppercase; color:#718096; letter-spacing:0.5px; margin-bottom:4px;">${titulo}</div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                <div>
                    <div style="font-size:16px; font-weight:700; color:#2d3748;">✈️ ${cia}${num}</div>
                    <div style="color:#4a5568; font-size:13px; margin-top:2px;">${rota}${data ? ' · ' + data : ''}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:18px; color:#2d3748;">${hora}</div>
                    <div style="color:#718096; font-size:12px;">${dur}${escalas ? ' · ' + escalas : ''}</div>
                    ${preco ? `<div style="margin-top:4px;"><span style="background:#48bb78; color:#fff; font-size:12px; padding:2px 8px; border-radius:10px;">${preco}</span></div>` : ''}
                </div>
            </div>
        </div>
    `;
}

function corpoEmail(mon, novoPreco, precoAnterior, voo) {
    const baixa = precoAnterior ? (precoAnterior - novoPreco) : 0;
    const pct = precoAnterior ? ((baixa / precoAnterior) * 100).toFixed(1) : '0.0';
    const ida   = voo?.detalhes?.ida   || null;
    const volta = voo?.detalhes?.volta || null;
    const codigoCia = ida?.companhiaCodigo || '';
    const ciaNome = voo?.companhia || nomeCompanhia(codigoCia) || 'N/D';
    const dataIda   = ida?.partida?.data  || voo?.dataIda   || mon.dataIdaInicio;
    const dataVolta = volta?.partida?.data || voo?.dataVolta || null;

    const linkCia = linkCompanhia(codigoCia, mon.origem, mon.destino, dataIda, dataVolta);
    const linkGoogle = `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${mon.origem} to ${mon.destino} on ${dataIda}${dataVolta ? ' returning ' + dataVolta : ''}`)}`;

    return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; background:#fff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:#fff; padding: 24px; text-align:center;">
            <h1 style="margin:0; font-size:22px;">📉 Preço Baixou!</h1>
            <p style="margin:6px 0 0; opacity:0.9;">Monitoramento GiraMundoTour</p>
        </div>
        <div style="padding: 24px;">
            <h2 style="color:#2d3748; font-size:18px; margin-top:0;">Cliente</h2>
            <p style="margin:4px 0;"><strong>${mon.clienteNome || '-'}</strong></p>
            ${mon.clienteEmail    ? `<p style="margin:4px 0; color:#4a5568;">✉️ ${mon.clienteEmail}</p>` : ''}
            ${mon.clienteTelefone ? `<p style="margin:4px 0; color:#4a5568;">📞 ${mon.clienteTelefone}</p>` : ''}
            ${mon.solicitante     ? `<p style="margin:4px 0; color:#4a5568;"><small>Solicitado por: <strong>${mon.solicitante}</strong></small></p>` : ''}

            <h2 style="color:#2d3748; font-size:18px; margin-top:18px;">Trecho</h2>
            <p style="margin:4px 0; font-size:16px;"><strong>${mon.origem} → ${mon.destino}</strong>${mon.tipoViagem === 'idaVolta' ? ` (ida e volta)` : ' (somente ida)'}</p>
            <p style="margin:4px 0; color:#4a5568;">Companhia: <strong>${ciaNome}</strong></p>

            <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color:#fff; padding:18px; border-radius:12px; text-align:center; margin:20px 0;">
                <div style="font-size:13px; opacity:0.9;">Novo preço total</div>
                <div style="font-size:32px; font-weight:700; margin:4px 0;">${formatarMoeda(novoPreco)}</div>
                ${precoAnterior ? `<div style="font-size:13px; opacity:0.9;">Antes: <s>${formatarMoeda(precoAnterior)}</s> · Economia de ${formatarMoeda(baixa)} (${pct}%)</div>` : ''}
            </div>

            <h2 style="color:#2d3748; font-size:18px; margin-top:18px; margin-bottom:6px;">Detalhes do voo</h2>
            ${blocoVoo(ida,   mon.tipoViagem === 'idaVolta' ? 'Ida' : 'Voo')}
            ${volta ? blocoVoo(volta, 'Volta') : ''}

            ${mon.precoAlvo ? `<p style="margin:16px 0 4px; color:#4a5568;">Preço-alvo configurado: <strong>${formatarMoeda(mon.precoAlvo)}</strong></p>` : ''}

            <div style="margin-top:22px; text-align:center;">
                <a href="${linkCia}" target="_blank"
                   style="display:inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:#fff; padding:12px 22px; border-radius:50px; text-decoration:none; font-weight:600; margin:4px;">
                    ✈️ Reservar na ${ciaNome}
                </a>
                <a href="${linkGoogle}" target="_blank"
                   style="display:inline-block; background:#fff; color:#4a5568; border:1px solid #cbd5e0; padding:12px 22px; border-radius:50px; text-decoration:none; font-weight:600; margin:4px;">
                    🔎 Google Flights
                </a>
            </div>
        </div>
        <div style="background:#f7fafc; padding:14px; text-align:center; font-size:12px; color:#718096;">
            GiraMundoTour — Monitoramento automatizado de preços
        </div>
    </div>
    `;
}

async function enviarEmailBaixa(mon, novoPreco, precoAnterior, voo) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[Monitoramento] EMAIL_USER/EMAIL_PASS não configurado — email não enviado');
        return;
    }
    const destino = mon.emailDestino || EMAIL_DEFAULT;
    if (!destino) return;

    const transporter = criarTransporter();
    await transporter.sendMail({
        from: `"GiraMundoTour" <${process.env.EMAIL_USER}>`,
        to: destino,
        subject: `📉 Preço baixou: ${mon.origem} → ${mon.destino} por ${formatarMoeda(novoPreco)}`,
        html: corpoEmail(mon, novoPreco, precoAnterior, voo)
    });
    console.log(`[Monitoramento] Email de baixa enviado para ${destino}`);
}

// ─── Verificação de preço ────────────────────────────────────────────────────

function gerarDatasPeriodo(inicio, fim) {
    if (!inicio) return [];
    const d0 = new Date(inicio);
    const d1 = fim ? new Date(fim) : d0;
    const out = [];
    const step = new Date(d0);
    let guard = 0;
    while (step <= d1 && guard < 60) {
        out.push(step.toISOString().slice(0, 10));
        step.setDate(step.getDate() + 1);
        guard++;
    }
    return out;
}

function amostrarDatas(datas, maxN) {
    if (datas.length <= maxN) return datas;
    const step = Math.ceil(datas.length / maxN);
    const out = [];
    for (let i = 0; i < datas.length; i += step) out.push(datas[i]);
    if (out[out.length - 1] !== datas[datas.length - 1]) out.push(datas[datas.length - 1]);
    return out;
}

function precoDoVoo(v) {
    if (!v) return 0;
    if (typeof v.preco === 'number') return v.preco;
    const p = v.preco || {};
    const val = p.valor ?? p.total ?? p.porPessoa ?? 0;
    return +val || 0;
}

function companhiaDoVoo(v) {
    if (!v) return '';
    const c = v.companhia;
    if (!c) return v.airline || '';
    if (typeof c === 'string') return c;
    return c.nome || c.codigo || '';
}

function resumoVoo(v) {
    if (!v) return null;
    return {
        companhia: companhiaDoVoo(v),
        companhiaCodigo: v.companhia?.codigo || null,
        numero: v.numero || null,
        origem: v.origem?.codigo || v.origem || null,
        destino: v.destino?.codigo || v.destino || null,
        partida: {
            data: v.partida?.data || null,
            horario: v.partida?.horario || null
        },
        chegada: {
            data: v.chegada?.data || null,
            horario: v.chegada?.horario || null
        },
        duracao: v.duracao?.texto || null,
        escalas: v.escalas ?? null,
        classe: v.classe || null,
        preco: precoDoVoo(v)
    };
}

async function verificarUm(mon) {
    if (!mon.ativo) {
        console.log(`[Monitoramento ${mon.id}] pausado — ignorando verificação`);
        return { ok: false, reason: 'pausado' };
    }

    const idaDatas   = amostrarDatas(gerarDatasPeriodo(mon.dataIdaInicio,   mon.dataIdaFim),   5);
    const voltaDatas = mon.tipoViagem === 'idaVolta'
        ? amostrarDatas(gerarDatasPeriodo(mon.dataVoltaInicio, mon.dataVoltaFim), 5)
        : [null];

    // Suporte a múltiplas origens/destinos (separados por vírgula, ex: "GIG,SDU").
    // Cada combinação vira uma busca separada — APIs externas não aceitam código
    // multi-IATA, e sem split o filtro doméstico não reconhece a rota.
    const splitCodes = (s) => String(s || '')
        .split(',')
        .map(x => x.trim().toUpperCase())
        .filter(Boolean);
    const origens  = splitCodes(mon.origem);
    const destinos = splitCodes(mon.destino);

    let melhor = null;

    for (const ori of origens) {
    for (const des of destinos) {
    for (const dIda of idaDatas) {
        for (const dVolta of voltaDatas) {
            try {
                const params = {
                    origem:   ori,
                    destino:  des,
                    dataIda:  dIda,
                    dataVolta: dVolta || undefined,
                    adultos:  mon.adultos   || 1,
                    criancas: mon.criancas  || 0,
                    bebes:    mon.bebes     || 0,
                    classe:   mon.classe    || 'economica'
                };
                const r = await flightSearch.buscarVoos(params);
                const idaVoos   = r?.ida   || [];
                const voltaVoos = r?.volta || [];

                const menorIda = idaVoos.reduce(
                    (m, v) => (!m || precoDoVoo(v) < precoDoVoo(m)) ? v : m, null
                );
                const menorVolta = voltaVoos.reduce(
                    (m, v) => (!m || precoDoVoo(v) < precoDoVoo(m)) ? v : m, null
                );

                const preco = precoDoVoo(menorIda) + precoDoVoo(menorVolta);
                if (preco <= 0) continue;

                if (!melhor || preco < melhor.preco) {
                    melhor = {
                        preco,
                        companhia: companhiaDoVoo(menorIda),
                        dataIda:   dIda,
                        dataVolta: dVolta,
                        detalhes:  {
                            ida:   resumoVoo(menorIda),
                            volta: resumoVoo(menorVolta),
                            fonte: r.meta?.fonte
                        }
                    };
                }
            } catch (err) {
                console.warn(`[Monitoramento ${mon.id}] erro busca ${ori}→${des} ${dIda}/${dVolta}:`, err.message);
            }
        }
    }
    }
    }

    const agora = new Date();
    if (!melhor) {
        await pool.query(
            `UPDATE monitoramentos SET "ultimaVerificacao"=$1, "updatedAt"=$1 WHERE id=$2`,
            [agora, mon.id]
        );
        console.log(`[Monitoramento ${mon.id}] nenhum voo encontrado`);
        return { ok: false, reason: 'sem_voos' };
    }

    const precoAnterior = mon.precoAtual != null ? +mon.precoAtual : null;
    const precoMax = mon.precoAlvo != null ? +mon.precoAlvo : null;
    const abaixoDoMaximo = precoMax != null && melhor.preco < precoMax;
    const baixouDoAnterior = precoAnterior != null && melhor.preco < precoAnterior;

    // Regra: o preço atual (grid) é sempre atualizado. Email só é enviado quando
    // o novo preço for MENOR que o preço atual anterior E MENOR que o preço máximo (alvo).
    // Primeira verificação (sem preço anterior) apenas registra o baseline, sem email.
    const notificar = baixouDoAnterior && abaixoDoMaximo;

    // Grava histórico
    await pool.query(
        `INSERT INTO monitoramento_historico ("monitoramentoId", preco, companhia, "dataIda", "dataVolta", detalhes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [mon.id, melhor.preco, melhor.companhia, melhor.dataIda, melhor.dataVolta, JSON.stringify(melhor.detalhes)]
    );

    // Atualiza monitoramento
    const precoInicial = mon.precoInicial != null ? +mon.precoInicial : melhor.preco;
    await pool.query(
        `UPDATE monitoramentos
            SET "precoAtual"=$1, "precoInicial"=COALESCE("precoInicial", $2),
                "melhorVoo"=$3, "ultimaVerificacao"=$4, "updatedAt"=$4
          WHERE id=$5`,
        [melhor.preco, precoInicial, JSON.stringify(melhor), agora, mon.id]
    );

    if (notificar) {
        try {
            await enviarEmailBaixa(mon, melhor.preco, precoAnterior, melhor);
            await pool.query(
                `UPDATE monitoramentos SET "ultimaNotificacao"=$1 WHERE id=$2`,
                [agora, mon.id]
            );
        } catch (err) {
            console.error(`[Monitoramento ${mon.id}] erro ao enviar email:`, err.message);
        }
    }

    return { ok: true, preco: melhor.preco, baixou: baixouDoAnterior, abaixoDoMaximo, notificou: notificar };
}

async function verificarTodos() {
    try {
        const { rows } = await pool.query(`SELECT * FROM monitoramentos WHERE ativo = TRUE`);
        console.log(`[Monitoramento] Verificando ${rows.length} monitoramento(s)...`);
        for (const mon of rows) {
            try {
                await verificarUm(mon);
            } catch (err) {
                console.error(`[Monitoramento ${mon.id}] erro:`, err.message);
            }
        }
    } catch (err) {
        console.error('[Monitoramento] erro ao listar monitoramentos:', err.message);
    }
}

// ─── Inicialização ───────────────────────────────────────────────────────────

let _iniciado = false;

async function iniciar() {
    if (_iniciado) return;
    _iniciado = true;
    try {
        await criarTabelas();
        console.log('[Monitoramento] Tabelas verificadas/criadas');
    } catch (err) {
        console.error('[Monitoramento] erro ao criar tabelas:', err.message);
    }

    cron.schedule(SCHEDULE, () => {
        verificarTodos().catch(err => console.error('[Monitoramento] cron erro:', err.message));
    });
    console.log(`[Monitoramento] Cron agendado: ${SCHEDULE}`);
}

module.exports = { iniciar, verificarTodos, verificarUm, criarTabelas };
