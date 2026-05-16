/**
 * GiraMundoTour - Rotas de Alertas de Check-in
 *
 * POST   /api/alertas/registrar           — registra/atualiza alerta para uma reserva
 * DELETE /api/alertas/:reservaId          — remove alerta de uma reserva
 * GET    /api/alertas                     — lista alertas (debug)
 * POST   /api/alertas/testar              — envia email de teste
 *
 * WhatsApp (sem custo — via @whiskeysockets/baileys):
 * GET    /api/alertas/whatsapp/status     — status da conexão + QR code (base64)
 * POST   /api/alertas/whatsapp/conectar   — inicia conexão e gera QR
 * POST   /api/alertas/whatsapp/desconectar — desconecta e remove sessão
 * POST   /api/alertas/whatsapp/testar     — envia mensagem de teste para um número
 */

const express        = require('express');
const router         = express.Router();
const AlertasService  = require('../services/alertas.service');

const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === 'true';
const WhatsAppService  = WHATSAPP_ENABLED ? require('../services/whatsapp.service') : null;

const wppDisabled = (res) => res.status(503).json({ success: false, message: 'WhatsApp desabilitado neste servidor.' });

// Registra ou atualiza alerta de check-in para uma reserva
router.post('/registrar', async (req, res) => {
    const { id, companhia, localizador, dataIda, dataVolta, clienteNome, clienteTelefone, origem, destino, emitidoPor } = req.body;

    if (!id || !companhia) {
        return res.status(400).json({ success: false, message: 'id e companhia são obrigatórios' });
    }

    await AlertasService.registrar({ id, companhia, localizador, dataIda, dataVolta, clienteNome, clienteTelefone, origem, destino, emitidoPor });
    res.json({ success: true, message: 'Alerta registrado' });
});

// Remove alerta de uma reserva
router.delete('/:reservaId', async (req, res) => {
    await AlertasService.remover(req.params.reservaId);
    res.json({ success: true, message: 'Alerta removido' });
});

// Lista todos os alertas registrados
router.get('/', async (req, res) => {
    res.json({ success: true, alertas: await AlertasService.carregarAlertas() });
});

// Dispara verificação de alertas imediatamente (sem aguardar o cron das 00h)
router.post('/verificar-agora', async (req, res) => {
    try {
        await AlertasService.verificarEEnviar();
        res.json({ success: true, message: 'Verificação concluída.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Envia email de teste para verificar configuração SMTP
router.post('/testar', async (req, res) => {
    try {
        const resultado = await AlertasService.enviarEmailTeste();
        res.json({ success: true, message: 'Email de teste enviado com sucesso!', ...resultado });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── Rotas WhatsApp ────────────────────────────────────────────────────────────

router.get('/whatsapp/status', (req, res) => {
    if (!WHATSAPP_ENABLED) return wppDisabled(res);
    const info = WhatsAppService.getStatus();
    res.json({ success: true, ...info });
});

router.post('/whatsapp/conectar', async (req, res) => {
    if (!WHATSAPP_ENABLED) return wppDisabled(res);
    try {
        const atual = WhatsAppService.getStatus();
        if (atual.status === 'connected') {
            return res.json({ success: true, message: 'WhatsApp já está conectado.', status: atual.status });
        }
        WhatsAppService.conectar().catch(err =>
            console.error('[WhatsApp] Erro na conexão:', err.message)
        );
        res.json({ success: true, message: 'Conexão iniciada. Acesse /status para obter o QR code.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/whatsapp/desconectar', async (req, res) => {
    if (!WHATSAPP_ENABLED) return wppDisabled(res);
    try {
        await WhatsAppService.desconectar();
        res.json({ success: true, message: 'WhatsApp desconectado. Sessão removida.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/whatsapp/testar', async (req, res) => {
    if (!WHATSAPP_ENABLED) return wppDisabled(res);
    const { telefone, texto } = req.body;
    if (!telefone) {
        return res.status(400).json({ success: false, message: 'Informe o campo "telefone".' });
    }
    try {
        const mensagem = texto || 'Olá! Esta é uma mensagem de teste do sistema GiraMundoTour. ✈️';
        await WhatsAppService.enviarMensagem(telefone, mensagem);
        res.json({ success: true, message: `Mensagem enviada com sucesso para ${telefone}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/whatsapp/debug/:telefone', (req, res) => {
    if (!WHATSAPP_ENABLED) return wppDisabled(res);
    const status = WhatsAppService.getStatus();
    const numero = req.params.telefone.replace(/\D/g, '');
    const numeroCompleto = numero.startsWith('55') ? numero : `55${numero}`;
    res.json({ success: true, status: status.status, conectado: status.conectado, numeroCompleto });
});

router.post('/whatsapp/testar-alerta', async (req, res) => {
    if (!WHATSAPP_ENABLED) return wppDisabled(res);
    const { telefone, reservaId, tipo = 'ida' } = req.body;
    if (!telefone) {
        return res.status(400).json({ success: false, message: 'Informe o campo "telefone".' });
    }
    try {
        const alertas = await AlertasService.carregarAlertas();
        let alerta;
        if (reservaId) {
            alerta = alertas.find(a => a.reservaId === reservaId);
            if (!alerta) return res.status(404).json({ success: false, message: `Alerta não encontrado para reservaId: ${reservaId}` });
        } else {
            alerta = alertas.find(a => a.localizador && (a.dataIda || a.dataVolta));
            if (!alerta) return res.status(404).json({ success: false, message: 'Nenhum alerta com dados completos encontrado.' });
        }
        const mensagem = AlertasService.gerarMensagemWpp(alerta, tipo);
        await WhatsAppService.enviarMensagem(telefone, mensagem);
        res.json({ success: true, message: `Mensagem de check-in enviada para ${telefone}.`, alerta: { reservaId: alerta.reservaId, companhia: alerta.companhia, localizador: alerta.localizador, tipo, mensagem } });
    } catch (err) {
        console.error('[WhatsApp] Erro ao enviar teste de alerta:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
