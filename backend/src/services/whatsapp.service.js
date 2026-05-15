/**
 * GiraMundoTour - Serviço de WhatsApp (whatsapp-web.js + LocalAuth)
 *
 * Usa Puppeteer/Chrome para conectar ao WhatsApp Web, evitando bloqueios
 * de proxy/firewall que afetam conexões WebSocket diretas (Baileys).
 *
 * Sessão salva em: backend/data/whatsapp_session/
 *
 * Correção "No LID for user":
 *   Após o evento 'ready', aguarda 20s para o WhatsApp sincronizar a
 *   tabela de LIDs antes de aceitar envios.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path   = require('path');

const SESSION_DIR = path.join(__dirname, '../../data/whatsapp_session');

// ─── Estado interno ─────────────────────────────────────────────────────────

let _client    = null;
let _qrBase64  = null;
let _status    = 'disconnected'; // 'disconnected' | 'connecting' | 'syncing' | 'connected'
let _reconnect = true;

// ─── Fábrica de client ───────────────────────────────────────────────────────

function _criarClient() {
    return new Client({
        authStrategy: new LocalAuth({
            dataPath: SESSION_DIR
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        },
        webVersionCache: {
            type: 'local'
        }
    });
}

// ─── Conexão ─────────────────────────────────────────────────────────────────

async function conectar() {
    _reconnect = true;

    // Destrói client anterior se existir
    if (_client) {
        try { await _client.destroy(); } catch (_) {}
        _client = null;
    }

    _status   = 'connecting';
    _qrBase64 = null;
    _client   = _criarClient();

    _client.on('qr', async (qr) => {
        try {
            _qrBase64 = await QRCode.toDataURL(qr);
            _status   = 'connecting';
            console.log('[WhatsApp] QR code gerado. Escaneie em Reservas → Configuração WhatsApp.');
        } catch (e) {
            console.error('[WhatsApp] Erro ao gerar QR:', e.message);
        }
    });

    _client.on('ready', async () => {
        _qrBase64 = null;
        _status   = 'syncing';
        console.log('[WhatsApp] Cliente pronto. Hidratando store de contatos/chats...');

        // Carrega todos os chats e contatos para popular a tabela de LIDs no protocolo multi-device
        try {
            const chats    = await _client.getChats();
            const contacts = await _client.getContacts();
            console.log(`[WhatsApp] Store hidratado: ${chats.length} chats, ${contacts.length} contatos.`);
        } catch (e) {
            console.warn('[WhatsApp] Aviso ao hidratar store:', e.message);
        }

        // Delay adicional para finalizar a sincronização de chaves de sessão
        await new Promise(resolve => setTimeout(resolve, 5000));

        _status = 'connected';
        console.log('[WhatsApp] Conectado e sincronizado! Pronto para enviar mensagens.');
    });

    _client.on('authenticated', () => {
        console.log('[WhatsApp] Autenticado com sucesso.');
    });

    _client.on('auth_failure', (msg) => {
        console.error('[WhatsApp] Falha de autenticação:', msg);
        _status   = 'disconnected';
        _qrBase64 = null;
    });

    _client.on('disconnected', async (reason) => {
        console.log(`[WhatsApp] Desconectado: ${reason}`);
        _status   = 'disconnected';
        _qrBase64 = null;

        if (_reconnect) {
            console.log('[WhatsApp] Reconectando em 10s...');
            setTimeout(conectar, 10000);
        }
    });

    try {
        await _client.initialize();
    } catch (err) {
        console.error('[WhatsApp] Erro ao inicializar client:', err.message);
        _status   = 'disconnected';
        _qrBase64 = null;

        if (_reconnect) {
            console.log('[WhatsApp] Tentando novamente em 15s...');
            setTimeout(conectar, 15000);
        }
    }
}

// ─── Desconectar ─────────────────────────────────────────────────────────────

async function desconectar() {
    _reconnect = false;

    if (_client) {
        try { await _client.logout();  } catch (_) {}
        try { await _client.destroy(); } catch (_) {}
        _client = null;
    }

    _status   = 'disconnected';
    _qrBase64 = null;
    console.log('[WhatsApp] Desconectado manualmente.');
}

// ─── Envio de mensagem ────────────────────────────────────────────────────────

async function enviarMensagem(telefone, texto) {
    if (_status !== 'connected' || !_client) {
        throw new Error('WhatsApp não está conectado. Escaneie o QR code em Reservas → Configuração WhatsApp.');
    }
    if (!telefone) throw new Error('Telefone não informado.');

    const numero = telefone.replace(/\D/g, '');
    if (numero.length < 10) {
        throw new Error(`Número inválido: "${telefone}". Informe DDD + número (ex: 81996719185).`);
    }

    const numeroCompleto = numero.startsWith('55') ? numero : `55${numero}`;

    // getNumberId faz consulta ao servidor e força resolução do LID do destinatário
    const numberId = await _client.getNumberId(numeroCompleto);
    if (!numberId) {
        throw new Error(`Número ${telefone} não encontrado no WhatsApp.`);
    }

    const jid = numberId._serialized; // ex: "5581996719185@c.us"
    await _client.sendMessage(jid, texto);
    console.log(`[WhatsApp] Mensagem enviada → ${jid}`);
}

// ─── Status ───────────────────────────────────────────────────────────────────

function getStatus() {
    return {
        status:    _status,
        conectado: _status === 'connected',
        qrBase64:  _qrBase64
    };
}

// ─── Inicialização ────────────────────────────────────────────────────────────

function iniciar() {
    const fs = require('fs');
    // LocalAuth salva sessão em SESSION_DIR/session-default/
    // Se o diretório existir e não estiver vazio, reconecta automaticamente
    const temSessao = fs.existsSync(SESSION_DIR) &&
        fs.readdirSync(SESSION_DIR).some(f => f.startsWith('session-'));

    if (temSessao) {
        console.log('[WhatsApp] Sessão encontrada. Reconectando...');
        conectar().catch(err => console.error('[WhatsApp] Erro ao reconectar:', err.message));
    } else {
        console.log('[WhatsApp] Sem sessão salva. Acesse Reservas → Configuração WhatsApp para conectar.');
    }
}

module.exports = { iniciar, conectar, desconectar, enviarMensagem, getStatus };
