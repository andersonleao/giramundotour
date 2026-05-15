// GiraMundoTour - Configurações da Aplicação

const CONFIG = {
    // Informações da Empresa
    empresa: {
        nome: 'GiraMundoTour',
        slogan: 'Sua viagem começa aqui',
        cnpj: '50.377.582/0001-06',
        endereco: 'Av. Paulista, 1000 - São Paulo, SP',
        telefone: '(81) 98591-9955',
        telefone2: '(81) 99934-2731',
        email: 'giramundotourag@gmail.com',
        instagram: '@giramundo_tour',
        site: 'www.giramundotour.com.br'
    },

    // API Amadeus
    // IMPORTANTE: Para usar a API real, cadastre-se em https://developers.amadeus.com/
    // e substitua as credenciais abaixo pelas suas
    amadeus: {
        apiKey: '', // Insira seu API Key aqui
        apiSecret: '', // Insira seu API Secret aqui
        baseUrl: 'https://test.api.amadeus.com',
        tokenEndpoint: '/v1/security/oauth2/token',
        flightOffersEndpoint: '/v2/shopping/flight-offers',
        locationsEndpoint: '/v1/reference-data/locations'
    },

    // Configurações de Cotação
    cotacao: {
        validadeDias: 3, // Dias de validade da cotação
        taxaServico: 50.00, // Taxa de serviço por passageiro
        taxaEmbarque: 52.05, // Taxa de embarque média
        iof: 0.0038, // IOF para compras internacionais
        markup: 0.05 // Margem de lucro (5%)
    },

    // Configurações de Busca
    busca: {
        resultadosPorPagina: 10,
        maxResultados: 50,
        cacheMinutos: 3 // Cache de buscas em minutos
    },

    // Moeda
    moeda: {
        padrao: 'BRL',
        simbolo: 'R$',
        cotacaoUSD: 5.00 // Cotação padrão USD-BRL (atualizar conforme necessário)
    },

    // Classes de Voo
    classes: [
        { value: 'economica', label: 'Econômica', multiplicador: 1.0 },
        { value: 'executiva', label: 'Executiva', multiplicador: 2.5 },
        { value: 'primeira', label: 'Primeira Classe', multiplicador: 4.0 }
    ],

    // Limites
    limites: {
        maxPassageiros: 9,
        maxAdultos: 9,
        maxCriancas: 8,
        maxBebes: 4,
        diasAntecedenciaMinima: 1,
        diasAntecedenciaMaxima: 365
    },

    // Storage Keys
    storageKeys: {
        clientes: 'giramundo_clientes',
        cotacoes: 'giramundo_cotacoes',
        fornecedores: 'giramundo_fornecedores',
        bilhetes: 'giramundo_bilhetes',
        reservas: 'giramundo_reservas',
        buscaCache: 'giramundo_busca_cache',
        configuracoes: 'giramundo_configuracoes',
        ultimaBusca: 'giramundo_ultima_busca'
    },

    // Flags de Debug
    debug: {
        enabled: true,
        logApiCalls: true,
        useMockData: true // Usar dados simulados quando true
    }
};

// Função para verificar se a API está configurada
function isApiConfigured() {
    return CONFIG.amadeus.apiKey && CONFIG.amadeus.apiSecret;
}

// Função para obter configuração
function getConfig(path) {
    const keys = path.split('.');
    let value = CONFIG;
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return undefined;
        }
    }
    return value;
}

// Função para log de debug
function debugLog(...args) {
    if (CONFIG.debug.enabled) {
        console.log('[GiraMundoTour]', ...args);
    }
}

// Exportar para uso global
window.CONFIG = CONFIG;
window.isApiConfigured = isApiConfigured;
window.getConfig = getConfig;
window.debugLog = debugLog;
