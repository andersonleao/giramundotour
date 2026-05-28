/**
 * GiraMundoTour - Servidor Principal
 *
 * Backend API para o sistema de gerenciamento de passagens aéreas
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// Importar rotas
const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const clientesRoutes = require('./routes/clientes.routes');
const fornecedoresRoutes = require('./routes/fornecedores.routes');
const bilhetesRoutes = require('./routes/bilhetes.routes');
const cotacoesRoutes = require('./routes/cotacoes.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const voosRoutes = require('./routes/voos.routes');
const reservasRoutes  = require('./routes/reservas.routes');
const alertasRoutes   = require('./routes/alertas.routes');
const airlinesRoutes  = require('./routes/airlines.routes');
const hotéisRoutes    = require('./routes/hoteis.routes');
const monitoramentosRoutes = require('./routes/monitoramentos.routes');
const pacotesRoutes        = require('./routes/pacotes.routes');
const importacaoRoutes     = require('./routes/importacao.routes');
const AlertasService  = require('./services/alertas.service');
const MonitoramentoService = require('./services/monitoramento.service');

const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === 'true';

// Criar aplicação Express
const app = express();

// =============================================
// Middlewares Globais
// =============================================

// CORS - Permitir requisições do frontend
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parser JSON (limite 20mb para suportar imagens base64 em pacotes)
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Logs de requisições
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.LOG_LEVEL || 'dev'));
}

// Servir arquivos estáticos do frontend
// setHeaders dentro do express.static garante no-cache em JS e HTML (não é sobrescrito)
app.use(express.static(path.join(__dirname, '../../frontend'), {
    setHeaders(res, filePath) {
        if (filePath.endsWith('.js') || filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// =============================================
// Rotas da API
// =============================================

const API_PREFIX = process.env.API_PREFIX || '/api';

// Rota de health check
app.get(`${API_PREFIX}/health`, (req, res) => {
    res.json({
        status: 'ok',
        message: 'GiraMundoTour API está funcionando!',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Rotas de autenticação
app.use(`${API_PREFIX}/auth`, authRoutes);

// Rotas protegidas
app.use(`${API_PREFIX}/usuarios`, usuariosRoutes);
app.use(`${API_PREFIX}/clientes`, clientesRoutes);
app.use(`${API_PREFIX}/fornecedores`, fornecedoresRoutes);
app.use(`${API_PREFIX}/bilhetes`, bilhetesRoutes);
app.use(`${API_PREFIX}/cotacoes`, cotacoesRoutes);
app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);
app.use(`${API_PREFIX}/voos`, voosRoutes);
app.use(`${API_PREFIX}/reservas`, reservasRoutes);
app.use(`${API_PREFIX}/alertas`,  alertasRoutes);
app.use(`${API_PREFIX}/airlines`, airlinesRoutes);
app.use(`${API_PREFIX}/hoteis`,   hotéisRoutes);
app.use(`${API_PREFIX}/monitoramentos`, monitoramentosRoutes);
app.use(`${API_PREFIX}/pacotes`,        pacotesRoutes);
app.use(`${API_PREFIX}/importacao`,     importacaoRoutes);

// Rota para servir o frontend (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// =============================================
// Tratamento de Erros
// =============================================

// 404 - Rota não encontrada
app.use((req, res, next) => {
    res.status(404).json({
        error: true,
        message: 'Rota não encontrada',
        path: req.path
    });
});

// Erro global
app.use((err, req, res, next) => {
    console.error('Erro:', err);

    res.status(err.status || 500).json({
        error: true,
        message: err.message || 'Erro interno do servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// =============================================
// Iniciar Servidor
// =============================================

const PORT = process.env.PORT || 3000;

// Iniciar serviço de alertas de check-in (email)
AlertasService.iniciar();

// WhatsApp: ativo somente se WHATSAPP_ENABLED=true nas variáveis de ambiente
if (WHATSAPP_ENABLED) {
    const WhatsAppService = require('./services/whatsapp.service');
    WhatsAppService.iniciar();
}

// Iniciar serviço de monitoramento de preços (cria tabelas + cron)
MonitoramentoService.iniciar().catch(err => console.error('[Monitoramento] erro ao iniciar:', err));

// Verificar conexão com banco de dados
const { connectDatabase } = require('./config/database');
connectDatabase().catch(err => {
    console.error('Falha ao conectar ao banco:', err);
});

app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                                                          ║');
    console.log('║   🌍 GiraMundoTour - Sistema de Passagens Aéreas         ║');
    console.log('║                                                          ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║   🚀 Servidor rodando em: http://localhost:${PORT}           ║`);
    console.log(`║   📡 API disponível em: http://localhost:${PORT}/api         ║`);
    console.log(`║   🔧 Ambiente: ${process.env.NODE_ENV || 'development'}                            ║`);
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
});

module.exports = app;
