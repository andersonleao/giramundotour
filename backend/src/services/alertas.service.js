/**
 * GiraMundoTour - Serviço de Alertas de Check-in
 *
 * Regras:
 *   - Azul: alerta às 00h do dia anterior ao voo (1 dia antes)
 *   - LATAM, Smiles e TAP: alerta às 00h 2 dias antes do voo
 *
 * Armazenamento: tabela alertas_checkin no PostgreSQL (Neon)
 * Cron: diário às 00:00 (meia-noite) OU via POST /api/alertas/verificar-agora
 */

const nodemailer = require('nodemailer');
const cron       = require('node-cron');
const { pool }   = require('../config/database');

const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === 'true';

// ─── Configuração por companhia ───────────────────────────────────────────────
const CIA_CONFIG = {
    azul: {
        nome:             'Azul Linhas Aéreas',
        diasAntecedencia: 1,
        cor:              '#00457C',
        checkinUrl:       'https://www.voeazul.com.br/br/pt/home/check-in'
    },
    gol: {
        nome:             'VoeGOL',
        diasAntecedencia: 2,
        cor:              '#F7941D',
        checkinUrl:       'https://b2c.voegol.com.br/check-in/'
    },
    latam: {
        nome:             'LATAM Airlines',
        diasAntecedencia: 2,
        cor:              '#D31245',
        checkinUrl:       'https://www.latamairlines.com/br/pt/check-in'
    },
    tap: {
        nome:             'TAP Air Portugal',
        diasAntecedencia: 2,
        cor:              '#007B5E',
        checkinUrl:       'https://www.flytap.com/br/pt/check-in'
    },
    smiles: {
        nome:             'Smiles (GOL)',
        diasAntecedencia: 2,
        cor:              '#F7941D',
        checkinUrl:       'https://b2c.voegol.com.br/check-in/'
    }
};

const EMAIL_DESTINO = 'giramundotourag@gmail.com';

// ─── Banco de dados ───────────────────────────────────────────────────────────

async function criarTabelaSeNecessario() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS alertas_checkin (
            id SERIAL PRIMARY KEY,
            "reservaId" TEXT NOT NULL UNIQUE,
            companhia TEXT NOT NULL DEFAULT '',
            localizador TEXT DEFAULT '',
            "clienteNome" TEXT DEFAULT '',
            "clienteTelefone" TEXT DEFAULT '',
            "dataIda" TEXT DEFAULT '',
            "dataVolta" TEXT DEFAULT '',
            origem TEXT DEFAULT '',
            destino TEXT DEFAULT '',
            "emitidoPor" TEXT DEFAULT '',
            "alertaIdaEnviado" BOOLEAN DEFAULT FALSE,
            "alertaVoltaEnviado" BOOLEAN DEFAULT FALSE,
            "wppIdaEnviado" BOOLEAN DEFAULT FALSE,
            "wppVoltaEnviado" BOOLEAN DEFAULT FALSE,
            "registradoEm" TIMESTAMPTZ DEFAULT NOW()
        )
    `);
}

async function carregarAlertas() {
    try {
        const { rows } = await pool.query('SELECT * FROM alertas_checkin ORDER BY "registradoEm"');
        return rows;
    } catch (_) {
        return [];
    }
}

async function registrar(reserva) {
    await pool.query(`
        INSERT INTO alertas_checkin
            ("reservaId", companhia, localizador, "clienteNome", "clienteTelefone",
             "dataIda", "dataVolta", origem, destino, "emitidoPor")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT ("reservaId") DO UPDATE SET
            companhia        = EXCLUDED.companhia,
            localizador      = EXCLUDED.localizador,
            "clienteNome"    = COALESCE(NULLIF(EXCLUDED."clienteNome",''),    alertas_checkin."clienteNome"),
            "clienteTelefone"= COALESCE(NULLIF(EXCLUDED."clienteTelefone",''),alertas_checkin."clienteTelefone"),
            "dataIda"        = EXCLUDED."dataIda",
            "dataVolta"      = EXCLUDED."dataVolta",
            origem           = EXCLUDED.origem,
            destino          = EXCLUDED.destino,
            "emitidoPor"     = EXCLUDED."emitidoPor"
    `, [
        reserva.id,
        reserva.companhia        || '',
        reserva.localizador      || '',
        reserva.clienteNome      || '',
        reserva.clienteTelefone  || '',
        reserva.dataIda          || '',
        reserva.dataVolta        || '',
        reserva.origem           || '',
        reserva.destino          || '',
        reserva.emitidoPor       || ''
    ]);
    console.log(`[Alertas] Registrado: ${reserva.localizador} (${reserva.companhia})`);
}

async function remover(reservaId) {
    await pool.query('DELETE FROM alertas_checkin WHERE "reservaId" = $1', [reservaId]);
    console.log(`[Alertas] Removido: reservaId=${reservaId}`);
}

async function marcarEnviado(reservaId, campo) {
    await pool.query(
        `UPDATE alertas_checkin SET "${campo}" = TRUE WHERE "reservaId" = $1`,
        [reservaId]
    );
}

// ─── Email ────────────────────────────────────────────────────────────────────

function criarTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

function formatarData(dataStr) {
    if (!dataStr) return '';
    const iso = dataStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    return dataStr;
}

function gerarCorpoEmail(alerta, tipo) {
    const cia     = CIA_CONFIG[alerta.companhia] || { nome: alerta.companhia, cor: '#1a365d', checkinUrl: '#' };
    const dataStr = tipo === 'ida' ? alerta.dataIda : alerta.dataVolta;
    const dataFmt = formatarData(dataStr);

    const origemTrecho  = alerta.origem  || '';
    const destinoTrecho = alerta.destino || '';
    const trecho = tipo === 'ida'
        ? (origemTrecho && destinoTrecho ? `${origemTrecho} → ${destinoTrecho}` : '')
        : (destinoTrecho && origemTrecho ? `${destinoTrecho} → ${origemTrecho}` : '');

    const labelTipo = tipo === 'ida' ? 'IDA' : 'VOLTA';

    const sobrenome = (alerta.clienteNome || '').trim().split(/\s+/).pop().toUpperCase();
    let checkinUrl = cia.checkinUrl;
    if (alerta.companhia === 'latam' && alerta.localizador) {
        checkinUrl = `https://www.latamairlines.com/br/pt/check-in/status?orderId=${encodeURIComponent(alerta.localizador)}${sobrenome ? `&lastName=${encodeURIComponent(sobrenome)}` : ''}`;
    } else if (alerta.companhia === 'azul' && alerta.localizador) {
        checkinUrl = `https://www.voeazul.com.br/br/pt/home/azulwebcheckin?pnr=${encodeURIComponent(alerta.localizador)}${alerta.origem ? `&origin=${encodeURIComponent(alerta.origem)}` : ''}`;
    } else if (alerta.companhia === 'tap' && alerta.localizador) {
        checkinUrl = `https://www.flytap.com/br/pt/check-in?bookingReference=${encodeURIComponent(alerta.localizador)}${sobrenome ? `&lastName=${encodeURIComponent(sobrenome)}` : ''}`;
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.12);">
    <div style="background:${cia.cor};padding:32px 28px;text-align:center;">
      <p style="margin:0 0 6px;color:rgba(255,255,255,0.8);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Lembrete de Check-in • Trecho ${labelTipo}</p>
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">${cia.nome}</h1>
    </div>
    <div style="padding:32px 28px;">
      <p style="font-size:15px;color:#444;margin:0 0 6px;">Olá, equipe <strong>GiraMundoTour</strong>!</p>
      <p style="font-size:14px;color:#666;margin:0 0 24px;">O check-in para o voo abaixo já está disponível.<br>Não esqueça de realizar antes do embarque!</p>
      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;margin-bottom:28px;">
        <tr style="background:#f7f9fc;">
          <td style="padding:12px 16px;color:#888;font-size:13px;width:38%;border-bottom:1px solid #eee;">Localizador / Pedido</td>
          <td style="padding:12px 16px;color:#222;font-size:14px;font-weight:700;border-bottom:1px solid #eee;">${alerta.localizador || '—'}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#888;font-size:13px;border-bottom:1px solid #eee;">Companhia</td>
          <td style="padding:12px 16px;color:#444;font-size:14px;border-bottom:1px solid #eee;">${cia.nome}</td>
        </tr>
        ${trecho ? `<tr style="background:#f7f9fc;"><td style="padding:12px 16px;color:#888;font-size:13px;border-bottom:1px solid #eee;">Trecho</td><td style="padding:12px 16px;color:#444;font-size:14px;border-bottom:1px solid #eee;">${trecho}</td></tr>` : ''}
        <tr ${trecho ? '' : 'style="background:#f7f9fc;"'}>
          <td style="padding:12px 16px;color:#888;font-size:13px;border-bottom:1px solid #eee;">Data do Voo</td>
          <td style="padding:12px 16px;color:#222;font-size:15px;font-weight:700;border-bottom:1px solid #eee;">${dataFmt}</td>
        </tr>
        <tr style="background:#f7f9fc;">
          <td style="padding:12px 16px;color:#888;font-size:13px;border-bottom:1px solid #eee;">Passageiro</td>
          <td style="padding:12px 16px;color:#444;font-size:14px;border-bottom:1px solid #eee;">${alerta.clienteNome || '—'}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#888;font-size:13px;">Emitido por</td>
          <td style="padding:12px 16px;color:#444;font-size:14px;font-weight:600;">${alerta.emitidoPor || '—'}</td>
        </tr>
      </table>
      <div style="text-align:center;margin:28px 0 20px;">
        <a href="${checkinUrl}" style="display:inline-block;background:${cia.cor};color:#ffffff;text-decoration:none;padding:15px 40px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.3px;">Fazer Check-in Agora</a>
      </div>
      <p style="text-align:center;font-size:12px;color:#aaa;margin:0;">Link direto: <a href="${checkinUrl}" style="color:${cia.cor};text-decoration:none;">${checkinUrl}</a></p>
    </div>
    <div style="background:#f7f9fc;padding:18px 28px;text-align:center;border-top:1px solid #eee;">
      <p style="margin:0;font-size:12px;color:#aaa;">GiraMundoTour &bull; giramundotourag@gmail.com &bull; Aviso automático de check-in</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Mensagem WhatsApp ────────────────────────────────────────────────────────

const TEMPLATE_WPP = `{nome}, sua viagem começa agora! ✈️

Faça o seu check-in usando o código da reserva: *{localizador}*

{urlCheckin}

A GiraMundoTour agradece pela preferência e deseja uma excelente viagem! ✈️`;

function gerarMensagemWpp(alerta, tipo) {
    const cia      = CIA_CONFIG[alerta.companhia] || { nome: alerta.companhia, checkinUrl: '' };
    const dataStr  = tipo === 'ida' ? alerta.dataIda : alerta.dataVolta;
    const dataFmt  = formatarData(dataStr);

    const trecho = tipo === 'ida'
        ? (alerta.origem && alerta.destino ? `${alerta.origem} → ${alerta.destino}` : '')
        : (alerta.destino && alerta.origem ? `${alerta.destino} → ${alerta.origem}` : '');

    const sobrenome = (alerta.clienteNome || '').trim().split(/\s+/).pop().toUpperCase();
    let urlCheckin = cia.checkinUrl || '';
    if (alerta.companhia === 'latam' && alerta.localizador) {
        urlCheckin = `https://www.latamairlines.com/br/pt/check-in/status?orderId=${encodeURIComponent(alerta.localizador)}${sobrenome ? `&lastName=${encodeURIComponent(sobrenome)}` : ''}`;
    } else if (alerta.companhia === 'azul' && alerta.localizador) {
        urlCheckin = `https://www.voeazul.com.br/br/pt/home/azulwebcheckin?pnr=${encodeURIComponent(alerta.localizador)}${alerta.origem ? `&origin=${encodeURIComponent(alerta.origem)}` : ''}`;
    } else if (alerta.companhia === 'tap' && alerta.localizador) {
        urlCheckin = `https://www.flytap.com/br/pt/check-in?bookingReference=${encodeURIComponent(alerta.localizador)}${sobrenome ? `&lastName=${encodeURIComponent(sobrenome)}` : ''}`;
    }

    return TEMPLATE_WPP
        .replace(/\{nome\}/g,        alerta.clienteNome || 'Passageiro')
        .replace(/\{companhia\}/g,   cia.nome)
        .replace(/\{localizador\}/g, alerta.localizador || '')
        .replace(/\{data\}/g,        dataFmt)
        .replace(/\{trecho\}/g,      trecho)
        .replace(/\{urlCheckin\}/g,  urlCheckin);
}

// ─── Verificação diária ───────────────────────────────────────────────────────

function diasParaData(dataStr) {
    if (!dataStr) return null;
    let ano, mes, dia;
    const iso = dataStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const br  = dataStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (iso) { [, ano, mes, dia] = iso; }
    else if (br) { [, dia, mes, ano] = br; }
    else return null;
    const dataVoo = new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
    const hoje    = new Date();
    hoje.setUTCHours(0, 0, 0, 0);
    return Math.floor((dataVoo - hoje) / (1000 * 60 * 60 * 24));
}

async function enriquecerComDB(alerta) {
    try {
        const { rows } = await pool.query(
            `SELECT r."emitidoPor", c.nome AS "clienteNome"
             FROM reservas r
             LEFT JOIN clientes c ON c.id = r."clienteId"
             WHERE r.id = $1`,
            [alerta.reservaId]
        );
        if (rows.length > 0) {
            if (rows[0].clienteNome) alerta.clienteNome = rows[0].clienteNome;
            if (rows[0].emitidoPor)  alerta.emitidoPor  = rows[0].emitidoPor;
        }
    } catch (_) {}
    return alerta;
}

async function verificarEEnviar() {
    console.log('[Alertas] Verificando alertas de check-in...');

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[Alertas] EMAIL_USER ou EMAIL_PASS não configurados — alertas desabilitados.');
        return;
    }

    const alertas = await carregarAlertas();
    if (alertas.length === 0) {
        console.log('[Alertas] Nenhum alerta registrado.');
        return;
    }

    const transporter = criarTransporter();

    for (const alerta of alertas) {
        const cia = CIA_CONFIG[alerta.companhia];
        if (!cia) continue;

        await enriquecerComDB(alerta);
        const diasAnt = cia.diasAntecedencia;

        // ── Ida ──
        if (alerta.dataIda && !alerta.alertaIdaEnviado) {
            const dias = diasParaData(alerta.dataIda);
            if (dias !== null && dias >= 0 && dias <= diasAnt) {
                try {
                    await transporter.sendMail({
                        from:    `"GiraMundoTour" <${process.env.EMAIL_USER}>`,
                        to:      EMAIL_DESTINO,
                        subject: `[Check-in] ${cia.nome} — Voo Ida em ${dias} dia(s) • ${alerta.localizador}`,
                        html:    gerarCorpoEmail(alerta, 'ida')
                    });
                    await marcarEnviado(alerta.reservaId, 'alertaIdaEnviado');
                    console.log(`[Alertas] Email IDA enviado: ${alerta.localizador}`);
                } catch (err) {
                    console.error(`[Alertas] Erro email IDA: ${err.message}`);
                }

                if (WHATSAPP_ENABLED && alerta.clienteTelefone && !alerta.wppIdaEnviado) {
                    try {
                        const WhatsAppService = require('./whatsapp.service');
                        await WhatsAppService.enviarMensagem(alerta.clienteTelefone, gerarMensagemWpp(alerta, 'ida'));
                        await marcarEnviado(alerta.reservaId, 'wppIdaEnviado');
                    } catch (err) {
                        console.warn(`[Alertas] WhatsApp IDA não enviado: ${err.message}`);
                    }
                }
            }
        }

        // ── Volta ──
        if (alerta.dataVolta && !alerta.alertaVoltaEnviado) {
            const dias = diasParaData(alerta.dataVolta);
            if (dias !== null && dias >= 0 && dias <= diasAnt) {
                try {
                    await transporter.sendMail({
                        from:    `"GiraMundoTour" <${process.env.EMAIL_USER}>`,
                        to:      EMAIL_DESTINO,
                        subject: `[Check-in] ${cia.nome} — Voo Volta em ${dias} dia(s) • ${alerta.localizador}`,
                        html:    gerarCorpoEmail(alerta, 'volta')
                    });
                    await marcarEnviado(alerta.reservaId, 'alertaVoltaEnviado');
                    console.log(`[Alertas] Email VOLTA enviado: ${alerta.localizador}`);
                } catch (err) {
                    console.error(`[Alertas] Erro email VOLTA: ${err.message}`);
                }

                if (WHATSAPP_ENABLED && alerta.clienteTelefone && !alerta.wppVoltaEnviado) {
                    try {
                        const WhatsAppService = require('./whatsapp.service');
                        await WhatsAppService.enviarMensagem(alerta.clienteTelefone, gerarMensagemWpp(alerta, 'volta'));
                        await marcarEnviado(alerta.reservaId, 'wppVoltaEnviado');
                    } catch (err) {
                        console.warn(`[Alertas] WhatsApp VOLTA não enviado: ${err.message}`);
                    }
                }
            }
        }
    }

    console.log('[Alertas] Verificação concluída.');
}

// ─── Cron job ─────────────────────────────────────────────────────────────────

function iniciar() {
    criarTabelaSeNecessario()
        .then(() => console.log('[Alertas] Tabela alertas_checkin verificada/criada'))
        .catch(err => console.error('[Alertas] Erro ao criar tabela:', err.message));

    cron.schedule('0 0 * * *', () => {
        console.log('[Alertas] Cron job disparado às 00:00');
        verificarEEnviar();
    }, { timezone: 'America/Sao_Paulo' });

    console.log('[Alertas] Serviço de alertas iniciado (cron: 00:00 diário)');
}

// ─── Email de teste ───────────────────────────────────────────────────────────

async function enviarEmailTeste() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('EMAIL_USER ou EMAIL_PASS não configurados');
    }

    const alertas = await carregarAlertas();
    const alertaExemplo = alertas[0] || {
        reservaId:   'TESTE',
        companhia:   'latam',
        localizador: 'LA9574382DWTN',
        clienteNome: 'Passageiro Teste',
        dataIda:     new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
        dataVolta:   new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
        origem:      'GRU',
        destino:     'SSA'
    };

    const transporter = criarTransporter();
    await transporter.sendMail({
        from:    `"GiraMundoTour" <${process.env.EMAIL_USER}>`,
        to:      EMAIL_DESTINO,
        subject: `[TESTE] Alerta de Check-in • ${alertaExemplo.localizador}`,
        html:    gerarCorpoEmail(alertaExemplo, 'ida')
    });

    return { para: EMAIL_DESTINO, localizador: alertaExemplo.localizador, companhia: alertaExemplo.companhia };
}

module.exports = { registrar, remover, iniciar, verificarEEnviar, enviarEmailTeste, carregarAlertas, gerarMensagemWpp };
