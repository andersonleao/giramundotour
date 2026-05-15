/**
 * GiraMundoTour - Serviço de Alertas de Check-in
 *
 * Regras:
 *   - Azul: alerta às 00h do dia anterior ao voo (1 dia antes)
 *   - LATAM, Smiles e TAP: alerta às 00h 2 dias antes do voo
 *
 * Armazenamento: backend/data/alertas_checkin.json
 * Cron: diário às 00:00 (meia-noite)
 */

const fs             = require('fs');
const path           = require('path');
const nodemailer     = require('nodemailer');
const cron           = require('node-cron');
const WhatsAppService = require('./whatsapp.service');
const { pool }        = require('../config/database');

// ─── Caminhos ────────────────────────────────────────────────────────────────
const DATA_DIR  = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'alertas_checkin.json');

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

// ─── Persistência ─────────────────────────────────────────────────────────────

function carregarAlertas() {
    if (!fs.existsSync(DATA_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (_) {
        return [];
    }
}

function salvarAlertas(alertas) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(alertas, null, 2), 'utf8');
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Registra ou atualiza um alerta para uma reserva.
 * @param {object} reserva - { id, companhia, localizador, dataIda, dataVolta, clienteNome, clienteTelefone, origem, destino }
 */
function registrar(reserva) {
    const alertas = carregarAlertas();
    const idx = alertas.findIndex(a => a.reservaId === reserva.id);
    const registro = {
        reservaId:              reserva.id,
        companhia:              reserva.companhia       || '',
        localizador:            reserva.localizador     || '',
        clienteNome:            reserva.clienteNome     || '',
        clienteTelefone:        reserva.clienteTelefone || '',
        dataIda:                reserva.dataIda         || '',
        dataVolta:              reserva.dataVolta       || '',
        origem:                 reserva.origem          || '',
        destino:                reserva.destino         || '',
        emitidoPor:             reserva.emitidoPor      || '',
        alertaIdaEnviado:       false,
        alertaVoltaEnviado:     false,
        wppIdaEnviado:          false,
        wppVoltaEnviado:        false,
        registradoEm:           new Date().toISOString()
    };

    if (idx >= 0) {
        // Mantém o status de alertas já enviados
        registro.alertaIdaEnviado   = alertas[idx].alertaIdaEnviado   || false;
        registro.alertaVoltaEnviado = alertas[idx].alertaVoltaEnviado || false;
        registro.wppIdaEnviado      = alertas[idx].wppIdaEnviado      || false;
        registro.wppVoltaEnviado    = alertas[idx].wppVoltaEnviado    || false;
        // Preserva telefone se já estava cadastrado e o novo está vazio
        if (!registro.clienteTelefone && alertas[idx].clienteTelefone) {
            registro.clienteTelefone = alertas[idx].clienteTelefone;
        }
        alertas[idx] = registro;
    } else {
        alertas.push(registro);
    }

    salvarAlertas(alertas);
    console.log(`[Alertas] Registrado: ${reserva.localizador} (${reserva.companhia}) tel=${registro.clienteTelefone || 'sem telefone'}`);
}

/**
 * Remove o alerta de uma reserva.
 * @param {string} reservaId
 */
function remover(reservaId) {
    const alertas = carregarAlertas();
    const novos   = alertas.filter(a => a.reservaId !== reservaId);
    salvarAlertas(novos);
    console.log(`[Alertas] Removido: reservaId=${reservaId}`);
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
    // Suporta YYYY-MM-DD e DD/MM/YYYY
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

    // URL de check-in com parâmetros por companhia
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

    <!-- Cabeçalho -->
    <div style="background:${cia.cor};padding:32px 28px;text-align:center;">
      <p style="margin:0 0 6px;color:rgba(255,255,255,0.8);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Lembrete de Check-in • Trecho ${labelTipo}</p>
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">${cia.nome}</h1>
    </div>

    <!-- Corpo -->
    <div style="padding:32px 28px;">
      <p style="font-size:15px;color:#444;margin:0 0 6px;">Olá, equipe <strong>GiraMundoTour</strong>!</p>
      <p style="font-size:14px;color:#666;margin:0 0 24px;">
        O check-in para o voo abaixo já está disponível.<br>
        Não esqueça de realizar antes do embarque!
      </p>

      <!-- Tabela de detalhes -->
      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;margin-bottom:28px;">
        <tr style="background:#f7f9fc;">
          <td style="padding:12px 16px;color:#888;font-size:13px;width:38%;border-bottom:1px solid #eee;">Localizador / Pedido</td>
          <td style="padding:12px 16px;color:#222;font-size:14px;font-weight:700;border-bottom:1px solid #eee;">${alerta.localizador || '—'}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#888;font-size:13px;border-bottom:1px solid #eee;">Companhia</td>
          <td style="padding:12px 16px;color:#444;font-size:14px;border-bottom:1px solid #eee;">${cia.nome}</td>
        </tr>
        ${trecho ? `
        <tr style="background:#f7f9fc;">
          <td style="padding:12px 16px;color:#888;font-size:13px;border-bottom:1px solid #eee;">Trecho</td>
          <td style="padding:12px 16px;color:#444;font-size:14px;border-bottom:1px solid #eee;">${trecho}</td>
        </tr>` : ''}
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

      <!-- Botão de check-in -->
      <div style="text-align:center;margin:28px 0 20px;">
        <a href="${checkinUrl}"
           style="display:inline-block;background:${cia.cor};color:#ffffff;text-decoration:none;padding:15px 40px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
          Fazer Check-in Agora
        </a>
      </div>

      <p style="text-align:center;font-size:12px;color:#aaa;margin:0;">
        Link direto: <a href="${checkinUrl}" style="color:${cia.cor};text-decoration:none;">${checkinUrl}</a>
      </p>
    </div>

    <!-- Rodapé -->
    <div style="background:#f7f9fc;padding:18px 28px;text-align:center;border-top:1px solid #eee;">
      <p style="margin:0;font-size:12px;color:#aaa;">
        GiraMundoTour &bull; giramundotourag@gmail.com &bull; Aviso automático de check-in
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ─── Mensagem WhatsApp/SMS ────────────────────────────────────────────────────

/**
 * Gera o texto da mensagem WhatsApp de check-in.
 * O texto será definido pela equipe GiraMundoTour — edite a constante TEMPLATE_WPP abaixo.
 *
 * Placeholders disponíveis:
 *   {nome}        → nome do cliente (ex: "Maria Silva")
 *   {companhia}   → nome da companhia aérea (ex: "Azul Linhas Aéreas")
 *   {localizador} → código da reserva (ex: "ABC123")
 *   {data}        → data do voo formatada (ex: "15/03/2026")
 *   {trecho}      → rota do voo (ex: "GRU → SSA")
 *   {urlCheckin}  → link para check-in online
 */
const TEMPLATE_WPP = `{nome}, sua viagem começa agora! ✈️

Faça o seu check-in usando o código da reserva: *{localizador}*

{urlCheckin}

A GiraMundoTour agradece pela preferência e deseja uma excelente viagem! ✈️`;

function gerarMensagemWpp(alerta, tipo) {
    const cia      = CIA_CONFIG[alerta.companhia] || { nome: alerta.companhia, checkinUrl: '' };
    const dataStr  = tipo === 'ida' ? alerta.dataIda : alerta.dataVolta;
    const dataFmt  = formatarData(dataStr);

    const origemTrecho  = alerta.origem  || '';
    const destinoTrecho = alerta.destino || '';
    const trecho = tipo === 'ida'
        ? (origemTrecho && destinoTrecho ? `${origemTrecho} → ${destinoTrecho}` : '')
        : (destinoTrecho && origemTrecho ? `${destinoTrecho} → ${origemTrecho}` : '');

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

// ─── Verificação diária ────────────────────────────────────────────────────────

/**
 * Calcula quantos dias faltam para uma data (YYYY-MM-DD ou DD/MM/YYYY).
 * Retorna null se data inválida.
 */
function diasParaData(dataStr) {
    if (!dataStr) return null;

    let ano, mes, dia;
    const iso = dataStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const br  = dataStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);

    if (iso) {
        [, ano, mes, dia] = iso;
    } else if (br) {
        [, dia, mes, ano] = br;
    } else {
        return null;
    }

    const dataVoo = new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
    const hoje    = new Date();
    hoje.setUTCHours(0, 0, 0, 0);

    return Math.floor((dataVoo - hoje) / (1000 * 60 * 60 * 24));
}

/**
 * Enriquece o alerta com clienteNome e emitidoPor do banco de dados,
 * para garantir dados atualizados no email mesmo que o alerta tenha
 * sido registrado antes de o cliente ser associado à reserva.
 */
async function enriquecerComDB(alerta) {
    if (!pool) return alerta;
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
    } catch (_) { /* BD indisponível: usa dados do JSON */ }
    return alerta;
}

async function verificarEEnviar() {
    console.log('[Alertas] Verificando alertas de check-in...');

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[Alertas] EMAIL_USER ou EMAIL_PASS não configurados no .env — alertas desabilitados.');
        return;
    }

    const alertas = carregarAlertas();
    if (alertas.length === 0) {
        console.log('[Alertas] Nenhum alerta registrado.');
        return;
    }

    const transporter = criarTransporter();
    let modificado    = false;

    for (const alerta of alertas) {
        const cia = CIA_CONFIG[alerta.companhia];
        if (!cia) continue;

        // Enriquece com dados atualizados do BD (clienteNome, emitidoPor)
        await enriquecerComDB(alerta);

        const diasAnt = cia.diasAntecedencia;

        // ── Verificar ida ──
        if (alerta.dataIda && !alerta.alertaIdaEnviado) {
            const dias = diasParaData(alerta.dataIda);
            if (dias !== null && dias >= 0 && dias <= diasAnt) {
                // Email para a agência
                try {
                    await transporter.sendMail({
                        from:    `"GiraMundoTour" <${process.env.EMAIL_USER}>`,
                        to:      EMAIL_DESTINO,
                        subject: `[Check-in] ${cia.nome} — Voo Ida em ${dias} dia(s) • ${alerta.localizador}`,
                        html:    gerarCorpoEmail(alerta, 'ida')
                    });
                    alerta.alertaIdaEnviado = true;
                    modificado = true;
                    console.log(`[Alertas] Email IDA enviado: ${alerta.localizador} (${alerta.companhia}) — ${alerta.dataIda}`);
                } catch (err) {
                    console.error(`[Alertas] Erro ao enviar email IDA: ${err.message}`);
                }

                // WhatsApp para o cliente
                if (alerta.clienteTelefone && !alerta.wppIdaEnviado) {
                    try {
                        const msg = gerarMensagemWpp(alerta, 'ida');
                        await WhatsAppService.enviarMensagem(alerta.clienteTelefone, msg);
                        alerta.wppIdaEnviado = true;
                        modificado = true;
                        console.log(`[Alertas] WhatsApp IDA enviado para ${alerta.clienteTelefone}: ${alerta.localizador}`);
                    } catch (err) {
                        console.warn(`[Alertas] WhatsApp IDA não enviado: ${err.message}`);
                    }
                }
            }
        }

        // ── Verificar volta ──
        if (alerta.dataVolta && !alerta.alertaVoltaEnviado) {
            const dias = diasParaData(alerta.dataVolta);
            if (dias !== null && dias >= 0 && dias <= diasAnt) {
                // Email para a agência
                try {
                    await transporter.sendMail({
                        from:    `"GiraMundoTour" <${process.env.EMAIL_USER}>`,
                        to:      EMAIL_DESTINO,
                        subject: `[Check-in] ${cia.nome} — Voo Volta em ${dias} dia(s) • ${alerta.localizador}`,
                        html:    gerarCorpoEmail(alerta, 'volta')
                    });
                    alerta.alertaVoltaEnviado = true;
                    modificado = true;
                    console.log(`[Alertas] Email VOLTA enviado: ${alerta.localizador} (${alerta.companhia}) — ${alerta.dataVolta}`);
                } catch (err) {
                    console.error(`[Alertas] Erro ao enviar email VOLTA: ${err.message}`);
                }

                // WhatsApp para o cliente
                if (alerta.clienteTelefone && !alerta.wppVoltaEnviado) {
                    try {
                        const msg = gerarMensagemWpp(alerta, 'volta');
                        await WhatsAppService.enviarMensagem(alerta.clienteTelefone, msg);
                        alerta.wppVoltaEnviado = true;
                        modificado = true;
                        console.log(`[Alertas] WhatsApp VOLTA enviado para ${alerta.clienteTelefone}: ${alerta.localizador}`);
                    } catch (err) {
                        console.warn(`[Alertas] WhatsApp VOLTA não enviado: ${err.message}`);
                    }
                }
            }
        }
    }

    if (modificado) salvarAlertas(alertas);
    console.log('[Alertas] Verificação concluída.');
}

// ─── Cron job ─────────────────────────────────────────────────────────────────

function iniciar() {
    // Executa todos os dias à meia-noite (00:00)
    cron.schedule('0 0 * * *', () => {
        console.log('[Alertas] Cron job disparado às 00:00');
        verificarEEnviar();
    }, { timezone: 'America/Sao_Paulo' });

    console.log('[Alertas] Serviço de alertas de check-in iniciado (cron: 00:00 diário)');
}

/**
 * Envia um email de teste para verificar a configuração SMTP.
 * Usa a primeira reserva registrada (ou dados genéricos de exemplo).
 */
async function enviarEmailTeste() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('EMAIL_USER ou EMAIL_PASS não configurados no .env');
    }

    const alertas = carregarAlertas();

    // Usa primeira reserva real, ou dados de exemplo
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

    return {
        para:        EMAIL_DESTINO,
        localizador: alertaExemplo.localizador,
        companhia:   alertaExemplo.companhia
    };
}

module.exports = { registrar, remover, iniciar, verificarEEnviar, enviarEmailTeste, carregarAlertas, gerarMensagemWpp };
