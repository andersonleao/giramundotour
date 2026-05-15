/**
 * GiraMundoTour — Teste de envio de e-mail de alerta de check-in
 *
 * Uso:
 *   node test-email.js                  → envia para a 1ª reserva do banco
 *   node test-email.js UFZBBH           → busca reserva pelo localizador
 *   node test-email.js UFZBBH volta     → envia email de VOLTA (padrão: ida)
 *   node test-email.js list             → lista todas as reservas disponíveis
 */

require('dotenv').config();
const { Pool }      = require('pg');
const nodemailer    = require('nodemailer');
const path          = require('path');

const [,, argLocalizador, argTipo] = process.argv;
const TIPO = (argTipo || 'ida').toLowerCase();

// ── Banco ─────────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Transporter Gmail ─────────────────────────────────────────────────────────
function criarTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('EMAIL_USER ou EMAIL_PASS não configurados no .env');
    }
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
}

// ── Cores / config por companhia ──────────────────────────────────────────────
const CIA_CONFIG = {
    azul:  { nome: 'Azul Linhas Aéreas', cor: '#00457C', checkinUrl: 'https://www.voeazul.com.br/br/pt/home/check-in' },
    gol:   { nome: 'VoeGOL',             cor: '#F7941D', checkinUrl: 'https://b2c.voegol.com.br/check-in/' },
    latam: { nome: 'LATAM Airlines',     cor: '#D31245', checkinUrl: 'https://www.latamairlines.com/br/pt/check-in' },
};

function formatarData(dataStr) {
    if (!dataStr) return '—';
    const iso = dataStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    return dataStr;
}

function gerarHtml(reserva, tipo) {
    const cia     = CIA_CONFIG[reserva.companhia] || { nome: reserva.companhia, cor: '#1a365d', checkinUrl: '#' };
    const dataFmt = formatarData(tipo === 'ida' ? reserva.dataIda : reserva.dataVolta);
    const trecho  = tipo === 'ida'
        ? (reserva.origem && reserva.destino ? `${reserva.origem} → ${reserva.destino}` : '')
        : (reserva.destino && reserva.origem ? `${reserva.destino} → ${reserva.origem}` : '');
    const labelTipo = tipo.toUpperCase();

    // URL de check-in com parâmetros por companhia
    const sobrenome = (reserva.clienteNome || '').trim().split(/\s+/).pop().toUpperCase();
    let checkinUrl = cia.checkinUrl;
    if (reserva.companhia === 'latam' && reserva.localizador) {
        checkinUrl = `https://www.latamairlines.com/br/pt/check-in/status?orderId=${encodeURIComponent(reserva.localizador)}${sobrenome ? `&lastName=${encodeURIComponent(sobrenome)}` : ''}`;
    } else if (reserva.companhia === 'azul' && reserva.localizador) {
        checkinUrl = `https://www.voeazul.com.br/br/pt/home/azulwebcheckin?pnr=${encodeURIComponent(reserva.localizador)}${reserva.origem ? `&origin=${encodeURIComponent(reserva.origem)}` : ''}`;
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.12);">
    <div style="background:${cia.cor};padding:32px 28px;text-align:center;">
      <p style="margin:0 0 6px;color:rgba(255,255,255,.8);font-size:13px;text-transform:uppercase;letter-spacing:1px;">
        [TESTE] Lembrete de Check-in • Trecho ${labelTipo}
      </p>
      <h1 style="margin:0;color:#fff;font-size:24px;">${cia.nome}</h1>
    </div>
    <div style="padding:32px 28px;">
      <p style="font-size:15px;color:#444;margin:0 0 6px;">Olá, equipe <strong>GiraMundoTour</strong>!</p>
      <p style="font-size:14px;color:#666;margin:0 0 24px;">
        Este é um <strong>email de teste</strong>. O check-in para o voo abaixo estaria disponível.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
        <tr style="background:#f7f9fc;">
          <td style="padding:12px 16px;color:#888;font-size:13px;width:38%;border-bottom:1px solid #eee;">Localizador</td>
          <td style="padding:12px 16px;color:#222;font-size:14px;font-weight:700;border-bottom:1px solid #eee;">${reserva.localizador || '—'}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#888;font-size:13px;border-bottom:1px solid #eee;">Companhia</td>
          <td style="padding:12px 16px;color:#444;font-size:14px;border-bottom:1px solid #eee;">${cia.nome}</td>
        </tr>
        ${trecho ? `<tr style="background:#f7f9fc;">
          <td style="padding:12px 16px;color:#888;font-size:13px;border-bottom:1px solid #eee;">Trecho</td>
          <td style="padding:12px 16px;color:#444;font-size:14px;border-bottom:1px solid #eee;">${trecho}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:12px 16px;color:#888;font-size:13px;${reserva.clienteNome ? 'border-bottom:1px solid #eee;' : ''}">Data do Voo</td>
          <td style="padding:12px 16px;color:#222;font-size:15px;font-weight:700;${reserva.clienteNome ? 'border-bottom:1px solid #eee;' : ''}">${dataFmt}</td>
        </tr>
        ${reserva.clienteNome ? `<tr style="background:#f7f9fc;">
          <td style="padding:12px 16px;color:#888;font-size:13px;">Passageiro</td>
          <td style="padding:12px 16px;color:#444;font-size:14px;">${reserva.clienteNome}</td>
        </tr>` : ''}
      </table>
      <div style="text-align:center;margin:28px 0 20px;">
        <a href="${checkinUrl}" style="display:inline-block;background:${cia.cor};color:#fff;text-decoration:none;padding:15px 40px;border-radius:8px;font-size:16px;font-weight:700;">
          Fazer Check-in Agora
        </a>
      </div>
    </div>
    <div style="background:#f7f9fc;padding:18px 28px;text-align:center;border-top:1px solid #eee;">
      <p style="margin:0;font-size:12px;color:#aaa;">GiraMundoTour • Aviso automático de check-in (TESTE)</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Principal ─────────────────────────────────────────────────────────────────
async function main() {
    let client;
    try {
        client = await pool.connect();

        // Modo: listar reservas
        if (argLocalizador === 'list') {
            const { rows } = await client.query(
                `SELECT r.localizador, r.companhia, r."dataIda", r."dataVolta", r.origem, r.destino,
                        c.nome AS "clienteNome"
                 FROM reservas r
                 LEFT JOIN clientes c ON c.id = r."clienteId"
                 ORDER BY r."dataIda" DESC NULLS LAST
                 LIMIT 20`
            );
            if (!rows.length) { console.log('Nenhuma reserva no banco.'); return; }
            console.log('\n=== Reservas disponíveis ===');
            rows.forEach(r => {
                console.log(`  ${r.localizador.padEnd(10)} ${r.companhia.padEnd(6)} IDA:${r.dataIda || '--'} VOLTA:${r.dataVolta || '--'}  ${r.clienteNome || '(sem cliente)'}`);
            });
            console.log('\nUso: node test-email.js <LOCALIZADOR> [ida|volta]');
            return;
        }

        // Busca reserva
        let reserva;
        if (argLocalizador && argLocalizador !== 'list') {
            const { rows } = await client.query(
                `SELECT r.*, c.nome AS "clienteNome"
                 FROM reservas r
                 LEFT JOIN clientes c ON c.id = r."clienteId"
                 WHERE r.localizador ILIKE $1 LIMIT 1`,
                [argLocalizador]
            );
            reserva = rows[0];
            if (!reserva) {
                console.error(`Reserva com localizador "${argLocalizador}" não encontrada.`);
                console.log('Use: node test-email.js list  para ver as reservas disponíveis.');
                process.exit(1);
            }
        } else {
            const { rows } = await client.query(
                `SELECT r.*, c.nome AS "clienteNome"
                 FROM reservas r
                 LEFT JOIN clientes c ON c.id = r."clienteId"
                 ORDER BY r."createdAt" DESC LIMIT 1`
            );
            reserva = rows[0];
            if (!reserva) {
                console.error('Nenhuma reserva encontrada no banco.');
                process.exit(1);
            }
        }

        // Validação de VOLTA
        if (TIPO === 'volta' && !reserva.dataVolta) {
            console.warn(`Atenção: reserva "${reserva.localizador}" não tem dataVolta — enviando mesmo assim.`);
        }

        console.log('\n=== Dados da reserva ===');
        console.log(`  Localizador : ${reserva.localizador}`);
        console.log(`  Companhia   : ${reserva.companhia}`);
        console.log(`  Trecho      : ${reserva.origem || '?'} → ${reserva.destino || '?'}`);
        console.log(`  Data IDA    : ${reserva.dataIda   || '—'}`);
        console.log(`  Data VOLTA  : ${reserva.dataVolta || '—'}`);
        console.log(`  Passageiro  : ${reserva.clienteNome || '(sem cliente)'}`);
        console.log(`  Tipo email  : ${TIPO.toUpperCase()}`);

        // Envia
        const transporter = criarTransporter();
        const destino = process.env.EMAIL_USER; // envia para si mesmo no teste

        console.log(`\nEnviando para ${destino}...`);
        const info = await transporter.sendMail({
            from:    `"GiraMundoTour Teste" <${process.env.EMAIL_USER}>`,
            to:      destino,
            subject: `[TESTE] Check-in ${TIPO.toUpperCase()} • ${reserva.localizador} (${(CIA_CONFIG[reserva.companhia] || {}).nome || reserva.companhia})`,
            html:    gerarHtml(reserva, TIPO),
        });

        console.log('\n✓ Email enviado com sucesso!');
        console.log(`  Message ID : ${info.messageId}`);
        console.log(`  Para       : ${destino}`);

    } catch (err) {
        console.error('\n✗ Erro:', err.message);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

main();
