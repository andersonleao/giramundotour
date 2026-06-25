/**
 * GiraMundoTour - Rotas de Busca de Voos
 */

const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const flightSearchService = require('../services/flightSearch.service');
const { authMiddleware, optionalAuth } = require('../middleware/auth.middleware');
const serpApiService       = require('../services/serpapi.service');
const amadeusService       = require('../services/amadeus.service');
const travelpayoutsService = require('../services/travelpayouts.service');
const airlabsService       = require('../services/airlabs.service');
const aviationstackService = require('../services/aviationstack.service');
const iberiaService        = require('../services/iberia.service');

/**
 * GET /api/voos/buscar
 * Busca voos disponíveis
 */
router.get('/buscar', [
    query('origem').isLength({ min: 3, max: 3 }).withMessage('Código IATA de origem inválido'),
    query('destino').isLength({ min: 3, max: 3 }).withMessage('Código IATA de destino inválido'),
    query('dataIda').isDate().withMessage('Data de ida inválida'),
    query('dataVolta').optional().isDate().withMessage('Data de volta inválida'),
    query('adultos').optional().isInt({ min: 1, max: 11 }).withMessage('Número de adultos inválido'),
    query('criancas').optional().isInt({ min: 0, max: 8 }).withMessage('Número de crianças inválido'),
    query('bebes').optional().isInt({ min: 0, max: 4 }).withMessage('Número de bebês inválido'),
    query('classe').optional().isIn(['economica', 'executiva', 'primeira']).withMessage('Classe inválida')
], optionalAuth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: true,
                message: 'Parâmetros de busca inválidos',
                errors: errors.array()
            });
        }

        const params = {
            origem: req.query.origem.toUpperCase(),
            destino: req.query.destino.toUpperCase(),
            dataIda: req.query.dataIda,
            dataVolta: req.query.dataVolta || null,
            adultos: parseInt(req.query.adultos) || 1,
            criancas: parseInt(req.query.criancas) || 0,
            bebes: parseInt(req.query.bebes) || 0,
            classe: req.query.classe || 'economica'
        };

        // Validar datas
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataIda = new Date(params.dataIda);

        if (dataIda < hoje) {
            return res.status(400).json({
                error: true,
                message: 'Data de ida não pode ser no passado'
            });
        }

        if (params.dataVolta) {
            const dataVolta = new Date(params.dataVolta);
            if (dataVolta < dataIda) {
                return res.status(400).json({
                    error: true,
                    message: 'Data de volta deve ser posterior à data de ida'
                });
            }
        }

        // Buscar voos
        const resultado = await flightSearchService.buscarVoos(params);

        res.json({
            success: true,
            data: resultado
        });

    } catch (error) {
        console.error('Erro na busca de voos:', error);
        res.status(500).json({
            error: true,
            message: 'Erro ao buscar voos'
        });
    }
});

/**
 * GET /api/voos/status
 * Diagnóstico: quais serviços de busca estão ativos no servidor
 */
router.get('/status', async (req, res) => {
    const cb = flightSearchService._quotaExcedida || {};
    res.json({
        success: true,
        data: {
            serpapi:       { configurado: serpApiService.isConfigured(),       varEnv: 'SERPAPI_KEY' },
            amadeus:       { configurado: amadeusService.isConfigured(),       varEnv: 'AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET' },
            travelpayouts: { configurado: travelpayoutsService.isConfigured(), varEnv: 'TRAVELPAYOUTS_TOKEN' },
            airlabs:       { configurado: airlabsService.isConfigured(),       varEnv: 'AIRLABS_API_KEY' },
            aviationstack: { configurado: aviationstackService.isConfigured(), varEnv: 'AVIATIONSTACK_KEY', quotaEsgotada: !!aviationstackService._quotaEsgotada },
            flightsSky:    { configurado: !!(flightSearchService.rapidApi?.key), varEnv: 'RAPIDAPI_KEY', quotaEsgotada: !!cb.flightsSky },
            iberia:        { configurado: iberiaService.isConfigured(),        varEnv: 'IBERIA_CLIENT_ID + IBERIA_CLIENT_SECRET' },
            catalogoRotas: Object.keys(flightSearchService.voosReais || {}).length,
        }
    });
});

/**
 * GET /api/voos/aeroportos
 * Lista aeroportos disponíveis
 */
router.get('/aeroportos', async (req, res) => {
    const { busca } = req.query;

    const aeroportos = [
        // Brasil - Principais
        { codigo: 'GRU', cidade: 'São Paulo', nome: 'Guarulhos - Intl. Gov. André Franco Montoro', uf: 'SP', pais: 'Brasil' },
        { codigo: 'CGH', cidade: 'São Paulo', nome: 'Congonhas', uf: 'SP', pais: 'Brasil' },
        { codigo: 'VCP', cidade: 'Campinas', nome: 'Viracopos', uf: 'SP', pais: 'Brasil' },
        { codigo: 'GIG', cidade: 'Rio de Janeiro', nome: 'Galeão - Intl. Tom Jobim', uf: 'RJ', pais: 'Brasil' },
        { codigo: 'SDU', cidade: 'Rio de Janeiro', nome: 'Santos Dumont', uf: 'RJ', pais: 'Brasil' },
        { codigo: 'BSB', cidade: 'Brasília', nome: 'Presidente Juscelino Kubitschek', uf: 'DF', pais: 'Brasil' },
        { codigo: 'CNF', cidade: 'Belo Horizonte', nome: 'Confins - Tancredo Neves', uf: 'MG', pais: 'Brasil' },
        { codigo: 'SSA', cidade: 'Salvador', nome: 'Dep. Luís Eduardo Magalhães', uf: 'BA', pais: 'Brasil' },
        { codigo: 'REC', cidade: 'Recife', nome: 'Guararapes - Gilberto Freyre', uf: 'PE', pais: 'Brasil' },
        { codigo: 'FOR', cidade: 'Fortaleza', nome: 'Pinto Martins', uf: 'CE', pais: 'Brasil' },
        { codigo: 'POA', cidade: 'Porto Alegre', nome: 'Salgado Filho', uf: 'RS', pais: 'Brasil' },
        { codigo: 'CWB', cidade: 'Curitiba', nome: 'Afonso Pena', uf: 'PR', pais: 'Brasil' },
        { codigo: 'FLN', cidade: 'Florianópolis', nome: 'Hercílio Luz', uf: 'SC', pais: 'Brasil' },
        { codigo: 'MAO', cidade: 'Manaus', nome: 'Eduardo Gomes', uf: 'AM', pais: 'Brasil' },
        { codigo: 'BEL', cidade: 'Belém', nome: 'Val de Cans', uf: 'PA', pais: 'Brasil' },
        { codigo: 'NAT', cidade: 'Natal', nome: 'Gov. Aluízio Alves', uf: 'RN', pais: 'Brasil' },
        { codigo: 'MCZ', cidade: 'Maceió', nome: 'Zumbi dos Palmares', uf: 'AL', pais: 'Brasil' },
        { codigo: 'VIX', cidade: 'Vitória', nome: 'Eurico de Aguiar Salles', uf: 'ES', pais: 'Brasil' },
        { codigo: 'CGB', cidade: 'Cuiabá', nome: 'Marechal Rondon', uf: 'MT', pais: 'Brasil' },
        { codigo: 'GYN', cidade: 'Goiânia', nome: 'Santa Genoveva', uf: 'GO', pais: 'Brasil' },
        { codigo: 'SLZ', cidade: 'São Luís', nome: 'Marechal Cunha Machado', uf: 'MA', pais: 'Brasil' },
        { codigo: 'THE', cidade: 'Teresina', nome: 'Senador Petrônio Portella', uf: 'PI', pais: 'Brasil' },
        { codigo: 'AJU', cidade: 'Aracaju', nome: 'Santa Maria', uf: 'SE', pais: 'Brasil' },
        { codigo: 'JPA', cidade: 'João Pessoa', nome: 'Castro Pinto', uf: 'PB', pais: 'Brasil' },
        { codigo: 'PMW', cidade: 'Palmas', nome: 'Brigadeiro Lysias Rodrigues', uf: 'TO', pais: 'Brasil' },
        { codigo: 'PVH', cidade: 'Porto Velho', nome: 'Gov. Jorge Teixeira', uf: 'RO', pais: 'Brasil' },
        { codigo: 'RBR', cidade: 'Rio Branco', nome: 'Plácido de Castro', uf: 'AC', pais: 'Brasil' },
        { codigo: 'MCP', cidade: 'Macapá', nome: 'Internacional de Macapá', uf: 'AP', pais: 'Brasil' },
        { codigo: 'BVB', cidade: 'Boa Vista', nome: 'Atlas Brasil Cantanhede', uf: 'RR', pais: 'Brasil' },
        { codigo: 'CGR', cidade: 'Campo Grande', nome: 'Internacional de Campo Grande', uf: 'MS', pais: 'Brasil' },

        // Internacionais - América
        { codigo: 'MIA', cidade: 'Miami', nome: 'Miami International', uf: 'FL', pais: 'EUA' },
        { codigo: 'JFK', cidade: 'Nova York', nome: 'John F. Kennedy', uf: 'NY', pais: 'EUA' },
        { codigo: 'LAX', cidade: 'Los Angeles', nome: 'Los Angeles International', uf: 'CA', pais: 'EUA' },
        { codigo: 'MCO', cidade: 'Orlando', nome: 'Orlando International', uf: 'FL', pais: 'EUA' },
        { codigo: 'EWR', cidade: 'Newark', nome: 'Newark Liberty', uf: 'NJ', pais: 'EUA' },
        { codigo: 'ATL', cidade: 'Atlanta', nome: 'Hartsfield-Jackson', uf: 'GA', pais: 'EUA' },
        { codigo: 'DFW', cidade: 'Dallas', nome: 'Dallas/Fort Worth', uf: 'TX', pais: 'EUA' },
        { codigo: 'EZE', cidade: 'Buenos Aires', nome: 'Ministro Pistarini', uf: '', pais: 'Argentina' },
        { codigo: 'SCL', cidade: 'Santiago', nome: 'Arturo Merino Benítez', uf: '', pais: 'Chile' },
        { codigo: 'LIM', cidade: 'Lima', nome: 'Jorge Chávez', uf: '', pais: 'Peru' },
        { codigo: 'BOG', cidade: 'Bogotá', nome: 'El Dorado', uf: '', pais: 'Colômbia' },
        { codigo: 'MEX', cidade: 'Cidade do México', nome: 'Benito Juárez', uf: '', pais: 'México' },
        { codigo: 'CUN', cidade: 'Cancún', nome: 'Cancún International', uf: '', pais: 'México' },
        { codigo: 'PTY', cidade: 'Cidade do Panamá', nome: 'Tocumen', uf: '', pais: 'Panamá' },

        // Internacionais - Europa
        { codigo: 'LIS', cidade: 'Lisboa', nome: 'Humberto Delgado', uf: '', pais: 'Portugal' },
        { codigo: 'OPO', cidade: 'Porto', nome: 'Francisco Sá Carneiro', uf: '', pais: 'Portugal' },
        { codigo: 'MAD', cidade: 'Madri', nome: 'Adolfo Suárez Madrid-Barajas', uf: '', pais: 'Espanha' },
        { codigo: 'BCN', cidade: 'Barcelona', nome: 'El Prat', uf: '', pais: 'Espanha' },
        { codigo: 'CDG', cidade: 'Paris', nome: 'Charles de Gaulle', uf: '', pais: 'França' },
        { codigo: 'LHR', cidade: 'Londres', nome: 'Heathrow', uf: '', pais: 'Reino Unido' },
        { codigo: 'FCO', cidade: 'Roma', nome: 'Fiumicino', uf: '', pais: 'Itália' },
        { codigo: 'MXP', cidade: 'Milão', nome: 'Malpensa', uf: '', pais: 'Itália' },
        { codigo: 'FRA', cidade: 'Frankfurt', nome: 'Frankfurt am Main', uf: '', pais: 'Alemanha' },
        { codigo: 'AMS', cidade: 'Amsterdam', nome: 'Schiphol', uf: '', pais: 'Holanda' },
        { codigo: 'ZRH', cidade: 'Zurique', nome: 'Zurich Airport', uf: '', pais: 'Suíça' },

        // Internacionais - Outros
        { codigo: 'DXB', cidade: 'Dubai', nome: 'Dubai International', uf: '', pais: 'Emirados Árabes' },
        { codigo: 'JNB', cidade: 'Joanesburgo', nome: 'O. R. Tambo', uf: '', pais: 'África do Sul' },
        { codigo: 'SYD', cidade: 'Sydney', nome: 'Kingsford Smith', uf: '', pais: 'Austrália' },
        { codigo: 'NRT', cidade: 'Tóquio', nome: 'Narita', uf: '', pais: 'Japão' }
    ];

    let resultado = aeroportos;

    // Filtrar por busca
    if (busca) {
        const termo = busca.toLowerCase();
        resultado = aeroportos.filter(a =>
            a.codigo.toLowerCase().includes(termo) ||
            a.cidade.toLowerCase().includes(termo) ||
            a.nome.toLowerCase().includes(termo) ||
            a.pais.toLowerCase().includes(termo)
        );
    }

    res.json({
        success: true,
        data: resultado.slice(0, 20) // Limitar a 20 resultados
    });
});

/**
 * GET /api/voos/companhias
 * Lista companhias aéreas disponíveis
 */
router.get('/companhias', async (req, res) => {
    const companhias = [
        { codigo: 'LA', nome: 'LATAM Airlines', cor: '#1B0088', programa: 'LATAM Pass', pais: 'Chile/Brasil' },
        { codigo: 'G3', nome: 'GOL Linhas Aéreas', cor: '#FF6600', programa: 'Smiles', pais: 'Brasil' },
        { codigo: 'AD', nome: 'Azul Linhas Aéreas', cor: '#0033A0', programa: 'Azul Fidelidade', pais: 'Brasil' },
        { codigo: 'AA', nome: 'American Airlines', cor: '#0078D2', programa: 'AAdvantage', pais: 'EUA' },
        { codigo: 'UA', nome: 'United Airlines', cor: '#002244', programa: 'MileagePlus', pais: 'EUA' },
        { codigo: 'DL', nome: 'Delta Air Lines', cor: '#003366', programa: 'SkyMiles', pais: 'EUA' },
        { codigo: 'TP', nome: 'TAP Portugal', cor: '#00A651', programa: 'Miles&Go', pais: 'Portugal' },
        { codigo: 'IB', nome: 'Iberia', cor: '#DA291C', programa: 'Iberia Plus', pais: 'Espanha' },
        { codigo: 'AF', nome: 'Air France', cor: '#002157', programa: 'Flying Blue', pais: 'França' },
        { codigo: 'LH', nome: 'Lufthansa', cor: '#05164D', programa: 'Miles & More', pais: 'Alemanha' },
        { codigo: 'BA', nome: 'British Airways', cor: '#075AAA', programa: 'Avios', pais: 'Reino Unido' },
        { codigo: 'AV', nome: 'Avianca', cor: '#DA291C', programa: 'LifeMiles', pais: 'Colômbia' },
        { codigo: 'CM', nome: 'Copa Airlines', cor: '#003876', programa: 'ConnectMiles', pais: 'Panamá' },
        { codigo: 'AR', nome: 'Aerolíneas Argentinas', cor: '#1E90FF', programa: 'Aerolíneas Plus', pais: 'Argentina' }
    ];

    res.json({
        success: true,
        data: companhias
    });
});

/**
 * GET /api/voos/programas-pontos
 * Informações sobre programas de pontos/milhas
 */
router.get('/programas-pontos', async (req, res) => {
    const programas = [
        {
            codigo: 'latam-pass',
            nome: 'LATAM Pass',
            companhia: 'LATAM Airlines',
            descricao: 'Programa de fidelidade da LATAM Airlines',
            valorPonto: 0.025,
            taxaEmbarque: true,
            parceiros: ['LATAM', 'Delta', 'Air France', 'KLM'],
            site: 'https://latampass.latam.com',
            dicas: [
                'Pontos podem ser usados para voos LATAM e parceiros',
                'Transferências de bancos parceiros bonificadas',
                'Taxa de embarque sempre cobrada'
            ]
        },
        {
            codigo: 'smiles',
            nome: 'Smiles',
            companhia: 'GOL Linhas Aéreas',
            descricao: 'Programa de fidelidade da GOL',
            valorPonto: 0.022,
            taxaEmbarque: true,
            parceiros: ['GOL', 'Air France', 'KLM', 'Delta', 'Alitalia'],
            site: 'https://www.smiles.com.br',
            dicas: [
                'Milhas nunca expiram (desde 2019)',
                'Promoções frequentes com desconto em milhas',
                'Possível resgatar passagens de parceiros'
            ]
        },
        {
            codigo: 'azul-fidelidade',
            nome: 'Azul Fidelidade',
            companhia: 'Azul Linhas Aéreas',
            descricao: 'Programa de fidelidade da Azul (antigo TudoAzul)',
            valorPonto: 0.020,
            taxaEmbarque: true,
            parceiros: ['Azul', 'TAP', 'United', 'Lufthansa'],
            site: 'https://www.voeazul.com.br/programa-fidelidade',
            dicas: [
                'Programa renovado em abril 2024',
                'Pontos podem ser usados no Azul Pelo Mundo',
                'Parcerias com cartões de crédito'
            ]
        }
    ];

    res.json({
        success: true,
        data: programas
    });
});

module.exports = router;
