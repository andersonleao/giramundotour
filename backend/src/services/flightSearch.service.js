/**
 * GiraMundoTour - Serviço de Busca de Passagens Aéreas
 *
 * Integração com Flights Sky API (RapidAPI) para busca de voos reais
 * via dados do Skyscanner, com fallback para dados simulados.
 */

const https = require('https');
const travelpayoutsService = require('./travelpayouts.service');
const airlabsService = require('./airlabs.service');
const aviationstackService = require('./aviationstack.service');

class FlightSearchService {
    constructor() {
        // Configuração Flights Sky API (RapidAPI)
        this.rapidApi = {
            key: process.env.RAPIDAPI_KEY || '',
            host: process.env.RAPIDAPI_HOST || 'flights-sky.p.rapidapi.com'
        };

        // Tabelas de conversão de pontos (valores aproximados por milha/ponto)
        this.pontosConfig = {
            'LA': { nome: 'LATAM Pass', valorPonto: 0.025, minPontos: 5000, taxaEmbarque: true },
            'G3': { nome: 'Smiles', valorPonto: 0.022, minPontos: 5000, taxaEmbarque: true },
            'AD': { nome: 'Azul Fidelidade', valorPonto: 0.020, minPontos: 4000, taxaEmbarque: true }
        };

        // Aeroportos brasileiros principais
        this.aeroportosBR = {
            'GRU': { cidade: 'São Paulo', nome: 'Guarulhos', uf: 'SP' },
            'CGH': { cidade: 'São Paulo', nome: 'Congonhas', uf: 'SP' },
            'GIG': { cidade: 'Rio de Janeiro', nome: 'Galeão', uf: 'RJ' },
            'SDU': { cidade: 'Rio de Janeiro', nome: 'Santos Dumont', uf: 'RJ' },
            'BSB': { cidade: 'Brasília', nome: 'Presidente JK', uf: 'DF' },
            'CNF': { cidade: 'Belo Horizonte', nome: 'Confins', uf: 'MG' },
            'SSA': { cidade: 'Salvador', nome: 'Dep. Luís E. Magalhães', uf: 'BA' },
            'REC': { cidade: 'Recife', nome: 'Guararapes', uf: 'PE' },
            'FOR': { cidade: 'Fortaleza', nome: 'Pinto Martins', uf: 'CE' },
            'POA': { cidade: 'Porto Alegre', nome: 'Salgado Filho', uf: 'RS' },
            'CWB': { cidade: 'Curitiba', nome: 'Afonso Pena', uf: 'PR' },
            'VCP': { cidade: 'Campinas', nome: 'Viracopos', uf: 'SP' },
            'FLN': { cidade: 'Florianópolis', nome: 'Hercílio Luz', uf: 'SC' },
            'MAO': { cidade: 'Manaus', nome: 'Eduardo Gomes', uf: 'AM' },
            'BEL': { cidade: 'Belém', nome: 'Val de Cans', uf: 'PA' },
            'NAT': { cidade: 'Natal', nome: 'Gov. Aluízio Alves', uf: 'RN' },
            'MCZ': { cidade: 'Maceió', nome: 'Zumbi dos Palmares', uf: 'AL' },
            'VIX': { cidade: 'Vitória', nome: 'Eurico Salles', uf: 'ES' },
            'CGB': { cidade: 'Cuiabá', nome: 'Marechal Rondon', uf: 'MT' },
            'GYN': { cidade: 'Goiânia', nome: 'Santa Genoveva', uf: 'GO' },
            'OPS': { cidade: 'Sinop', nome: 'Pres. João Batista Figueiredo', uf: 'MT' }
        };

        // Catálogo de voos reais observados (LATAM e parceiros) por rota.
        // partida/chegada em HH:MM, diasChegada=quantos dias depois (0=mesmo dia, 1=dia seguinte).
        // operadoPor opcional (codeshare). escalas, numero, preco também opcionais.
        this.voosReais = {
            'REC-LAS': [
                // LATAM 16:15 → 14:01 (próximo dia) — 21h46min, 2 escalas via GRU + LAX
                {
                    cia: 'LA', numero: 'LA8082',
                    partida: '16:15', chegada: '14:01', diasChegada: 1,
                    escalas: 2,
                    segmentos: [
                        { companhia: 'LA', numeroVoo: 'LA3082', origem: 'REC', destino: 'GRU', partida: '', chegada: '', duracao: 230 },
                        { companhia: 'LA', numeroVoo: 'LA8082', origem: 'GRU', destino: 'LAX', partida: '', chegada: '', duracao: 720 },
                        { companhia: 'LA', numeroVoo: 'LA1822', origem: 'LAX', destino: 'LAS', partida: '', chegada: '', duracao: 80 },
                    ]
                }
            ],
            'LAS-REC': [
                // Volta espelhada (caso usuário busque ida-e-volta)
                {
                    cia: 'LA', numero: 'LA8083',
                    partida: '23:15', chegada: '20:50', diasChegada: 1,
                    escalas: 2,
                }
            ]
        };
    }

    // ============================================================
    //  FLIGHTS SKY API - Requisição genérica
    // ============================================================

    async requestFlightsSky(path) {
        return new Promise((resolve) => {
            const options = {
                hostname: this.rapidApi.host,
                port: 443,
                path,
                method: 'GET',
                headers: {
                    'X-RapidAPI-Key': this.rapidApi.key,
                    'X-RapidAPI-Host': this.rapidApi.host,
                    'Accept': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode !== 200) {
                            console.error(`❌ Flights Sky API [${res.statusCode}]:`, json.message || '');
                            resolve(null);
                            return;
                        }
                        resolve(json);
                    } catch (e) {
                        console.error('❌ Erro ao parsear resposta Flights Sky:', e.message);
                        resolve(null);
                    }
                });
            });

            req.setTimeout(10000, () => { req.destroy(); resolve(null); });
            req.on('error', (err) => {
                console.error('❌ Erro de conexão Flights Sky:', err.message);
                resolve(null);
            });

            req.end();
        });
    }

    // ============================================================
    //  BUSCA DE VOOS
    // ============================================================

    mapClasseSky(classe) {
        const mapa = { 'economica': 'economy', 'executiva': 'business', 'primeira': 'first' };
        return mapa[classe] || 'economy';
    }

    /**
     * Busca voos na Flights Sky API usando search-one-way.
     * Sempre usa one-way para obter todas as opções disponíveis independentemente.
     * Para ida e volta, chamar duas vezes com parâmetros invertidos.
     */
    async buscarFlightsSky(params) {
        if (!this.rapidApi.key) {
            console.log('⚠️ RAPIDAPI_KEY não configurada — usando dados simulados');
            return null;
        }

        const qp = new URLSearchParams({
            fromEntityId: params.origem,
            toEntityId: params.destino,
            departDate: params.dataIda,
            adults: params.adultos || 1,
            currency: 'BRL',
            market: 'BR',
            countryCode: 'BR',
            cabinClass: this.mapClasseSky(params.classe)
        });

        if (params.criancas > 0) qp.append('children', params.criancas);
        if (params.bebes > 0) qp.append('infants', params.bebes);

        const path = `/flights/search-one-way?${qp.toString()}`;
        console.log(`🔍 Flights Sky [search-one-way]:`, path);

        // Primeira chamada
        let response = await this.requestFlightsSky(path);

        // Polling: se status=incomplete, aguardar e buscar novamente.
        // Reduzido para 2×1500ms para caber na janela paralela <60s (nginx).
        const maxRetries = 2;
        const delayMs = 1500;
        if (response && response.data && response.data.context && response.data.context.status === 'incomplete') {
            console.log('⏳ Resultados incompletos, aguardando mais dados...');
            for (let retry = 0; retry < maxRetries; retry++) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
                const retryResponse = await this.requestFlightsSky(path);
                if (retryResponse && retryResponse.data && retryResponse.data.itineraries) {
                    response = retryResponse;
                    const count = retryResponse.data.itineraries.length;
                    const status = retryResponse.data.context?.status || 'unknown';
                    console.log(`🔄 Retry ${retry + 1}/${maxRetries}: ${count} itinerários, status=${status}`);
                    if (status === 'complete') break;
                }
            }
        }

        return response;
    }

    // ============================================================
    //  CONVERSÃO DA RESPOSTA → FORMATO PADRÃO DO BACKEND
    // ============================================================

    /**
     * Converte resposta Flights Sky para o formato padrão do sistema.
     *
     * Estrutura da API:
     * { data: { itineraries: [{ id, price: { raw, formatted }, legs: [{
     *     origin, destination, departure, arrival, durationInMinutes,
     *     stopCount, carriers: { marketing: [{ alternateId, name, logoUrl }] },
     *     segments: [{ flightNumber, marketingCarrier, departure, arrival, ... }]
     * }] }] }, status: true }
     *
     * - Somente ida: cada itinerary tem 1 leg
     * - Ida e volta: cada itinerary tem 2 legs (leg[0]=ida, leg[1]=volta)
     */
    converterRespostaFlightsSky(response, params) {
        const voosIda = [];
        const voosVolta = [];

        if (!response || !response.data || !response.data.itineraries) {
            return { ida: [], volta: [] };
        }

        response.data.itineraries.forEach((itin) => {
            try {
                const legs = itin.legs || [];
                if (legs.length === 0) return;

                const preco = itin.price ? itin.price.raw : 0;
                if (!preco) return;

                legs.forEach((leg, legIdx) => {
                    const tipo = legIdx === 0 ? 'ida' : 'volta';
                    const segments = leg.segments || [];
                    if (segments.length === 0) return;

                    const primeiroSeg = segments[0];

                    // Companhia aérea principal
                    const carrier = (leg.carriers?.marketing?.[0]) || {};
                    const companhiaCodigo = carrier.alternateId || primeiroSeg.marketingCarrier?.alternateId || '';
                    const companhiaNome = carrier.name || this.getNomeCompanhia(companhiaCodigo);

                    const pontosInfo = this.calcularPontos(preco, companhiaCodigo);

                    const origemCode = leg.origin?.displayCode || params.origem;
                    const destinoCode = leg.destination?.displayCode || params.destino;
                    const origemCidade = leg.origin?.city || leg.origin?.name || '';
                    const destinoCidade = leg.destination?.city || leg.destination?.name || '';

                    const partida = leg.departure || '';
                    const chegada = leg.arrival || '';
                    const duracaoMin = leg.durationInMinutes || 0;

                    const voo = {
                        id: `${itin.id}-${tipo}`,
                        companhia: {
                            codigo: companhiaCodigo,
                            nome: companhiaNome,
                            cor: this.getCorCompanhia(companhiaCodigo),
                            logo: carrier.logoUrl || null
                        },
                        numero: `${companhiaCodigo}${primeiroSeg.flightNumber || ''}`,
                        origem: {
                            codigo: origemCode,
                            cidade: origemCidade,
                            ...this.aeroportosBR[origemCode] || {}
                        },
                        destino: {
                            codigo: destinoCode,
                            cidade: destinoCidade,
                            ...this.aeroportosBR[destinoCode] || {}
                        },
                        partida: {
                            data: partida.split('T')[0] || '',
                            horario: (partida.split('T')[1] || '').substring(0, 5),
                            timestamp: partida
                        },
                        chegada: {
                            data: chegada.split('T')[0] || '',
                            horario: (chegada.split('T')[1] || '').substring(0, 5),
                            timestamp: chegada
                        },
                        duracao: {
                            total: duracaoMin,
                            texto: `${Math.floor(duracaoMin / 60)}h ${duracaoMin % 60}min`
                        },
                        escalas: leg.stopCount != null ? leg.stopCount : segments.length - 1,
                        classe: params.classe || 'economica',
                        preco: {
                            valor: preco,
                            moeda: 'BRL',
                            porPessoa: preco,
                            taxas: 52.05,
                            total: preco + 52.05
                        },
                        pontos: pontosInfo ? {
                            quantidade: pontosInfo.pontos,
                            programa: pontosInfo.programa,
                            taxaEmbarque: pontosInfo.taxaEmbarque,
                            valorEquivalente: pontosInfo.pontos * pontosInfo.valorPonto
                        } : null,
                        assentos: 9,
                        tipo,
                        fonte: 'skyscanner',
                        segmentos: segments.length > 1 ? segments.map(s => ({
                            companhia:  s.marketingCarrier?.alternateId || companhiaCodigo,
                            numeroVoo:  `${s.marketingCarrier?.alternateId || companhiaCodigo}${s.flightNumber || ''}`,
                            origem:     s.origin?.flightPlaceId || s.origin?.displayCode || '',
                            destino:    s.destination?.flightPlaceId || s.destination?.displayCode || '',
                            partida:    s.departure || '',
                            chegada:    s.arrival || '',
                            duracao:    s.durationInMinutes || 0
                        })) : undefined
                    };

                    if (tipo === 'ida') {
                        voosIda.push(voo);
                    } else {
                        voosVolta.push(voo);
                    }
                });
            } catch (e) {
                console.error('Erro ao converter itinerário Flights Sky:', e.message);
            }
        });

        // Deduplicar voos pelo número do voo + horário de partida (manter o mais barato)
        const deduplicar = (voos) => {
            const mapa = new Map();
            voos.forEach(voo => {
                const chave = `${voo.numero}-${voo.partida.horario}-${voo.origem.codigo}-${voo.destino.codigo}`;
                const existente = mapa.get(chave);
                if (!existente || voo.preco.valor < existente.preco.valor) {
                    mapa.set(chave, voo);
                }
            });
            return Array.from(mapa.values());
        };

        return { ida: deduplicar(voosIda), volta: deduplicar(voosVolta) };
    }

    // ============================================================
    //  CÁLCULO DE PONTOS / MILHAS
    // ============================================================

    calcularPontos(valorBRL, companhia) {
        const config = this.pontosConfig[companhia];
        if (!config) return null;

        let pontos = Math.ceil(valorBRL / config.valorPonto);
        pontos = Math.ceil(pontos / 1000) * 1000;
        if (pontos < config.minPontos) pontos = config.minPontos;

        return {
            pontos,
            programa: config.nome,
            taxaEmbarque: config.taxaEmbarque ? 52.05 : 0,
            valorPonto: config.valorPonto
        };
    }

    // ============================================================
    //  DADOS SIMULADOS (FALLBACK)
    // ============================================================

    gerarVoosSimulados(params) {
        // Detecta rota internacional: se origem ou destino não está na lista de aeroportos BR
        const isInternacional = !this.aeroportosBR[params.origem] || !this.aeroportosBR[params.destino];

        const companhiasDomesticas = [
            { codigo: 'LA', nome: 'LATAM Airlines', cor: '#1B0088' },
            { codigo: 'G3', nome: 'GOL Linhas Aéreas', cor: '#FF6600' },
            { codigo: 'AD', nome: 'Azul Linhas Aéreas', cor: '#0033A0' }
        ];

        // Para rotas internacionais, inclui LATAM (opera rotas BR-Europa/EUA) + cias internacionais
        const companhiasInternacionais = [
            { codigo: 'LA', nome: 'LATAM Airlines',      cor: '#1B0088' },
            { codigo: 'IB', nome: 'Iberia',              cor: '#DA291C' },
            { codigo: 'TP', nome: 'TAP Air Portugal',    cor: '#00A651' },
            { codigo: 'AF', nome: 'Air France',          cor: '#002157' },
            { codigo: 'AA', nome: 'American Airlines',   cor: '#0078D2' },
            { codigo: 'DL', nome: 'Delta Air Lines',     cor: '#003366' },
            { codigo: 'UA', nome: 'United Airlines',     cor: '#005DAA' },
            { codigo: 'KL', nome: 'KLM',                 cor: '#00A1E4' },
            { codigo: 'LH', nome: 'Lufthansa',           cor: '#05164D' },
            { codigo: 'BA', nome: 'British Airways',     cor: '#075AAA' },
        ];

        // Parceiros codeshare da LATAM (oneworld + parceiros bilaterais para rotas EUA/Europa)
        const codesharesLatam = {
            US: ['DL', 'AA', 'UA'],
            EU: ['IB', 'BA', 'AF', 'KL', 'LH'],
        };

        const companhias = isInternacional ? companhiasInternacionais : companhiasDomesticas;

        // Detecta região do destino para escolher parceiros de codeshare LATAM coerentes.
        const aeroportosUS = new Set(['JFK','LGA','EWR','LAX','BUR','LGB','ORD','MDW','ATL','DFW','DAL','SFO','OAK','SJC','MCO','BOS','IAD','DCA','BWI','LAS','MIA','SEA','DEN','PHX','SAN','HNL','IAH']);
        const aeroportosEU = new Set(['LHR','LGW','STN','LCY','CDG','ORY','FRA','AMS','MAD','BCN','FCO','CIA','MXP','LIN','BGY','LIS','OPO','ZRH','SXB','MUC','DUB','BRU','VIE','CPH','ARN','HEL']);
        const destRegion = aeroportosUS.has(params.destino) ? 'US'
                         : aeroportosEU.has(params.destino) ? 'EU' : null;

        const horariosIda = ['06:00', '07:15', '08:30', '09:45', '10:15', '11:30', '12:45', '13:35', '14:00', '15:30', '16:45', '18:00', '19:15', '20:30', '21:45', '22:00'];
        const voos = [];
        const distanciaBase = this.calcularDistanciaAproximada(params.origem, params.destino);

        companhias.forEach(cia => {
            const numVoos = Math.floor(Math.random() * 4) + 5; // 5-8 voos por companhia

            for (let i = 0; i < numVoos; i++) {
                const horarioIdx = Math.floor(Math.random() * horariosIda.length);
                const horario = horariosIda[horarioIdx];
                const [horas, minutos] = horario.split(':').map(Number);

                const minDuracao = isInternacional ? 480 : 60;
                const maxDuracao = isInternacional ? 900 : 300;
                const duracaoMinutos = Math.max(minDuracao, Math.min(maxDuracao, distanciaBase * 0.5 + Math.random() * 60));
                const escalas = (isInternacional || distanciaBase > 2000) ? Math.floor(Math.random() * 2) : 0;

                const totalMinutosChegada = (horas || 0) * 60 + (minutos || 0) + Math.round(duracaoMinutos || 120) + ((escalas || 0) * 45);
                const chegadaHoras = Math.floor((totalMinutosChegada || 0) / 60) % 24;
                const chegadaMins = Math.round((totalMinutosChegada || 0) % 60);
                const diasAMais = Math.floor((totalMinutosChegada || 0) / (24 * 60));

                const horarioChegada = `${String(chegadaHoras).padStart(2, '0')}:${String(chegadaMins).padStart(2, '0')}`;
                const dataChegada = this.adicionarDias(params.dataIda, diasAMais);

                const multiplicadorClasse = params.classe === 'executiva' ? 2.5 : params.classe === 'primeira' ? 4 : 1;
                const precoBase = 200 + (distanciaBase * 0.15) + (Math.random() * 300);
                const preco = Math.round(precoBase * multiplicadorClasse * 100) / 100;

                const pontosInfo = this.calcularPontos(preco, cia.codigo);

                // Gera segmentos sintéticos quando há escalas
                const partTs   = this.criarTimestamp(params.dataIda, horario);
                const chegaTs  = this.criarTimestamp(dataChegada, horarioChegada);
                // addMin: trata iso como UTC para aritmética, retorna string sem Z
                const addMin = (iso, m) => {
                    const base = iso.includes('Z') ? new Date(iso) : new Date(iso + '+00:00');
                    base.setTime(base.getTime() + m * 60000);
                    const pad = n => String(n).padStart(2, '0');
                    return `${base.getUTCFullYear()}-${pad(base.getUTCMonth()+1)}-${pad(base.getUTCDate())}T${pad(base.getUTCHours())}:${pad(base.getUTCMinutes())}:00`;
                };
                let segmentosSimulados = undefined;
                if (escalas > 0) {
                    // Hubs domésticos para voos nacionais; hubs internacionais para voos internacionais
                    const hubsOpts = isInternacional
                        ? ['GRU', 'MAD', 'LIS', 'OPO', 'CDG', 'MIA', 'LHR']
                            .filter(h => h !== params.origem && h !== params.destino)
                        : ['GRU', 'BSB', 'VCP', 'SSA', 'FOR']
                            .filter(h => h !== params.origem && h !== params.destino);
                    const numHubs = Math.min(escalas, hubsOpts.length);
                    const connMin = 45;
                    const dur = Math.round(duracaoMinutos || 180);
                    const segDur = Math.round((dur - connMin * numHubs) / (numHubs + 1));
                    const route = [params.origem, ...hubsOpts.slice(0, numHubs), params.destino];
                    let t = partTs;
                    segmentosSimulados = [];
                    for (let si = 0; si < route.length - 1; si++) {
                        const tStart = t;
                        const tEnd = si === route.length - 2 ? chegaTs : addMin(t, segDur);
                        segmentosSimulados.push({
                            companhia: cia.codigo,
                            numeroVoo: `${cia.codigo}${Math.floor(Math.random() * 9000) + 1000}`,
                            origem:    route[si],
                            destino:   route[si + 1],
                            partida:   tStart,
                            chegada:   tEnd,
                            duracao:   segDur
                        });
                        if (si < route.length - 2) t = addMin(tEnd, connMin);
                    }
                }

                // Codeshare LATAM operado por parceiro (Delta/AA/United nos EUA; Iberia/BA/AF/KL/LH na Europa)
                let operadoPor = null;
                if (cia.codigo === 'LA' && destRegion && codesharesLatam[destRegion] && Math.random() < 0.4) {
                    const parceiros = codesharesLatam[destRegion];
                    const pcode = parceiros[Math.floor(Math.random() * parceiros.length)];
                    const parceiro = companhiasInternacionais.find(c => c.codigo === pcode);
                    if (parceiro) operadoPor = { codigo: parceiro.codigo, nome: parceiro.nome };
                }

                voos.push({
                    id: `${cia.codigo}-${Date.now()}-${i}`,
                    companhia: { codigo: cia.codigo, nome: cia.nome, cor: cia.cor },
                    operadoPor,
                    numero: `${cia.codigo}${Math.floor(Math.random() * 9000) + 1000}`,
                    origem: {
                        codigo: params.origem,
                        ...this.aeroportosBR[params.origem] || { cidade: params.origem, nome: '', uf: '' }
                    },
                    destino: {
                        codigo: params.destino,
                        ...this.aeroportosBR[params.destino] || { cidade: params.destino, nome: '', uf: '' }
                    },
                    partida: {
                        data: params.dataIda,
                        horario: horario,
                        timestamp: partTs
                    },
                    chegada: {
                        data: dataChegada,
                        horario: horarioChegada,
                        timestamp: chegaTs
                    },
                    duracao: {
                        total: Math.round(duracaoMinutos || 120),
                        texto: `${Math.floor((duracaoMinutos || 120) / 60)}h ${Math.round((duracaoMinutos || 120) % 60)}min`
                    },
                    escalas,
                    classe: params.classe || 'economica',
                    preco: {
                        valor: preco,
                        moeda: 'BRL',
                        porPessoa: preco,
                        taxas: 52.05,
                        total: preco + 52.05
                    },
                    pontos: pontosInfo ? {
                        quantidade: pontosInfo.pontos,
                        programa: pontosInfo.programa,
                        taxaEmbarque: pontosInfo.taxaEmbarque,
                        valorEquivalente: pontosInfo.pontos * pontosInfo.valorPonto
                    } : null,
                    assentos: Math.floor(Math.random() * 15) + 1,
                    tipo: params.tipo || 'ida',
                    segmentos: segmentosSimulados
                });
            }
        });

        // Injeta voos LATAM-codeshare garantidos em horários estratégicos para
        // rotas internacionais BR→US/EU com 2 paradas. Cobre cenários reais:
        // LATAM voo LA com hub em GRU + parceiro operando trecho transcontinental.
        if (isInternacional && destRegion && Math.abs(distanciaBase) > 4000) {
            const ciaLA = companhias.find(c => c.codigo === 'LA');
            const parceiros = codesharesLatam[destRegion] || [];
            const horariosCodeshare = ['13:35', '09:20', '21:10'];

            horariosCodeshare.forEach((hPart, idx) => {
                const parceiroCode = parceiros[idx % parceiros.length];
                const parceiro = companhiasInternacionais.find(c => c.codigo === parceiroCode);
                if (!ciaLA || !parceiro) return;

                const [hh, mm] = hPart.split(':').map(Number);
                // Rotas longas BR-US/EU com 2 paradas: ~18-24h totais
                const duracaoMin = 1080 + Math.floor(Math.random() * 360);
                const totalMin = hh * 60 + mm + duracaoMin + 90; // +90 conexões
                const cHoras = Math.floor(totalMin / 60) % 24;
                const cMins = totalMin % 60;
                const diasAMais = Math.floor(totalMin / (24 * 60));
                const dataChegada = this.adicionarDias(params.dataIda, diasAMais);
                const horarioChegada = `${String(cHoras).padStart(2,'0')}:${String(cMins).padStart(2,'0')}`;
                const partTs = this.criarTimestamp(params.dataIda, hPart);
                const chegaTs = this.criarTimestamp(dataChegada, horarioChegada);

                const hub1 = 'GRU';
                const hub2 = destRegion === 'US' ? 'MIA' : 'MAD';
                if (hub1 === params.origem || hub2 === params.destino) return;

                const addMin = (iso, m) => {
                    const base = iso.includes('Z') ? new Date(iso) : new Date(iso + '+00:00');
                    base.setTime(base.getTime() + m * 60000);
                    const pad = n => String(n).padStart(2,'0');
                    return `${base.getUTCFullYear()}-${pad(base.getUTCMonth()+1)}-${pad(base.getUTCDate())}T${pad(base.getUTCHours())}:${pad(base.getUTCMinutes())}:00`;
                };

                const segDur = Math.floor((duracaoMin - 90) / 3);
                const seg1End = addMin(partTs, segDur);
                const seg2Start = addMin(seg1End, 45);
                const seg2End = addMin(seg2Start, segDur);
                const seg3Start = addMin(seg2End, 45);

                const preco = Math.round((1800 + Math.random() * 1500) * 100) / 100;
                const pontosInfo = this.calcularPontos(preco, 'LA');

                voos.push({
                    id: `LA-codeshare-${parceiro.codigo}-${hPart.replace(':','')}-${Date.now()}`,
                    companhia: { codigo: 'LA', nome: 'LATAM Airlines', cor: '#1B0088' },
                    operadoPor: { codigo: parceiro.codigo, nome: parceiro.nome },
                    numero: `LA${Math.floor(Math.random() * 9000) + 1000}`,
                    origem:  { codigo: params.origem,  ...this.aeroportosBR[params.origem]  || { cidade: params.origem,  nome: '', uf: '' } },
                    destino: { codigo: params.destino, ...this.aeroportosBR[params.destino] || { cidade: params.destino, nome: '', uf: '' } },
                    partida: { data: params.dataIda,  horario: hPart, timestamp: partTs },
                    chegada: { data: dataChegada,     horario: horarioChegada, timestamp: chegaTs },
                    duracao: { total: duracaoMin, texto: `${Math.floor(duracaoMin/60)}h ${duracaoMin % 60}min` },
                    escalas: 2,
                    classe: params.classe || 'economica',
                    preco: { valor: preco, moeda: 'BRL', porPessoa: preco, taxas: 52.05, total: preco + 52.05 },
                    pontos: pontosInfo ? {
                        quantidade: pontosInfo.pontos, programa: pontosInfo.programa,
                        taxaEmbarque: pontosInfo.taxaEmbarque, valorEquivalente: pontosInfo.pontos * pontosInfo.valorPonto
                    } : null,
                    assentos: Math.floor(Math.random() * 9) + 1,
                    tipo: params.tipo || 'ida',
                    segmentos: [
                        { companhia: 'LA',                numeroVoo: `LA${Math.floor(Math.random()*9000)+1000}`, origem: params.origem, destino: hub1,           partida: partTs,    chegada: seg1End,  duracao: segDur },
                        { companhia: parceiro.codigo,     numeroVoo: `${parceiro.codigo}${Math.floor(Math.random()*9000)+100}`, origem: hub1,         destino: hub2,           partida: seg2Start, chegada: seg2End,  duracao: segDur },
                        { companhia: parceiro.codigo,     numeroVoo: `${parceiro.codigo}${Math.floor(Math.random()*9000)+100}`, origem: hub2,         destino: params.destino, partida: seg3Start, chegada: chegaTs,  duracao: segDur },
                    ]
                });
            });
        }

        // Voos reais conhecidos por rota (observados em buscas anteriores).
        // Injetados sempre que a rota bate, com horários e durações fiéis.
        const rotaKey = params.tipo === 'volta'
            ? `${params.destino}-${params.origem}`
            : `${params.origem}-${params.destino}`;
        const rotaAtual = `${params.origem}-${params.destino}`;
        const voosConhecidos = (this.voosReais || {})[rotaAtual] || [];

        voosConhecidos.forEach((v, idx) => {
            // Calcula timestamps
            const partTs = this.criarTimestamp(params.dataIda, v.partida);
            const diasChegada = v.diasChegada || 0;
            const dataChegada = this.adicionarDias(params.dataIda, diasChegada);
            const chegaTs = this.criarTimestamp(dataChegada, v.chegada);

            // Duração calculada do início ao fim
            const [hP, mP] = v.partida.split(':').map(Number);
            const [hC, mC] = v.chegada.split(':').map(Number);
            const duracaoMin = (diasChegada * 24 * 60) + (hC * 60 + mC) - (hP * 60 + mP);

            const cia = companhiasInternacionais.find(c => c.codigo === v.cia) || companhiasDomesticas.find(c => c.codigo === v.cia);
            if (!cia) return;
            const operadoPor = v.operadoPor
                ? (companhiasInternacionais.find(c => c.codigo === v.operadoPor) || { codigo: v.operadoPor, nome: v.operadoPor })
                : null;

            const preco = v.preco || Math.round((1500 + Math.random() * 1500) * 100) / 100;
            const pontosInfo = this.calcularPontos(preco, v.cia);

            voos.push({
                id: `LA-real-${rotaAtual}-${v.partida.replace(':','')}-${idx}`,
                companhia: { codigo: cia.codigo, nome: cia.nome, cor: cia.cor },
                operadoPor: operadoPor ? { codigo: operadoPor.codigo, nome: operadoPor.nome } : null,
                numero:  v.numero || `${v.cia}${Math.floor(Math.random() * 9000) + 1000}`,
                origem:  { codigo: params.origem,  ...this.aeroportosBR[params.origem]  || { cidade: params.origem,  nome: '', uf: '' } },
                destino: { codigo: params.destino, ...this.aeroportosBR[params.destino] || { cidade: params.destino, nome: '', uf: '' } },
                partida: { data: params.dataIda,  horario: v.partida, timestamp: partTs },
                chegada: { data: dataChegada,     horario: v.chegada, timestamp: chegaTs },
                duracao: { total: duracaoMin, texto: `${Math.floor(duracaoMin/60)}h ${String(duracaoMin % 60).padStart(2,'0')}min` },
                escalas: v.escalas ?? 2,
                classe: params.classe || 'economica',
                preco: { valor: preco, moeda: 'BRL', porPessoa: preco, taxas: 52.05, total: preco + 52.05 },
                pontos: pontosInfo ? {
                    quantidade: pontosInfo.pontos, programa: pontosInfo.programa,
                    taxaEmbarque: pontosInfo.taxaEmbarque, valorEquivalente: pontosInfo.pontos * pontosInfo.valorPonto
                } : null,
                assentos: Math.floor(Math.random() * 9) + 1,
                tipo: params.tipo || 'ida',
                segmentos: v.segmentos || undefined,
            });
        });

        voos.sort((a, b) => a.preco.valor - b.preco.valor);
        return voos;
    }

    // ============================================================
    //  UTILITÁRIOS
    // ============================================================

    criarTimestamp(data, horario) {
        if (!data || !horario) return '';
        // Retorna string sem fuso horário para evitar conversão UTC no browser
        return `${data}T${horario}:00`;
    }

    adicionarDias(data, dias) {
        if (!dias) return data;
        try {
            const [y, m, d] = data.split('-').map(Number);
            const dt = new Date(Date.UTC(y, m - 1, d + dias));
            if (isNaN(dt.getTime())) return data;
            const pad = n => String(n).padStart(2, '0');
            return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth()+1)}-${pad(dt.getUTCDate())}`;
        } catch (e) {
            return data;
        }
    }

    calcularDistanciaAproximada(origem, destino) {
        const coords = {
            'GRU': { lat: -23.43, lon: -46.47 }, 'CGH': { lat: -23.62, lon: -46.65 },
            'GIG': { lat: -22.81, lon: -43.25 }, 'SDU': { lat: -22.91, lon: -43.16 },
            'BSB': { lat: -15.87, lon: -47.92 }, 'CNF': { lat: -19.63, lon: -43.97 },
            'SSA': { lat: -12.91, lon: -38.33 }, 'REC': { lat: -8.13, lon: -34.92 },
            'FOR': { lat: -3.78, lon: -38.53 },  'POA': { lat: -29.99, lon: -51.17 },
            'CWB': { lat: -25.53, lon: -49.17 }, 'VCP': { lat: -23.01, lon: -47.13 },
            'FLN': { lat: -27.67, lon: -48.55 }, 'MAO': { lat: -3.04, lon: -60.05 },
            'BEL': { lat: -1.38, lon: -48.48 },  'NAT': { lat: -5.91, lon: -35.25 },
            'MCZ': { lat: -9.51, lon: -35.79 },  'VIX': { lat: -20.26, lon: -40.29 },
            'PNZ': { lat: -9.36, lon: -40.56 },
            'CGB': { lat: -15.65, lon: -56.12 }, 'GYN': { lat: -16.63, lon: -49.22 },
            'MIA': { lat: 25.79, lon: -80.29 },  'JFK': { lat: 40.64, lon: -73.78 },
            'LGA': { lat: 40.78, lon: -73.87 },  'EWR': { lat: 40.69, lon: -74.17 },
            'LAX': { lat: 33.94, lon: -118.41 }, 'LAS': { lat: 36.08, lon: -115.15 },
            'ORD': { lat: 41.98, lon: -87.91 },  'DFW': { lat: 32.90, lon: -97.04 },
            'ATL': { lat: 33.64, lon: -84.43 },  'SFO': { lat: 37.62, lon: -122.38 },
            'BOS': { lat: 42.36, lon: -71.01 },  'MCO': { lat: 28.43, lon: -81.31 },
            'IAD': { lat: 38.95, lon: -77.46 },  'SEA': { lat: 47.45, lon: -122.31 },
            'DEN': { lat: 39.86, lon: -104.67 }, 'PHX': { lat: 33.43, lon: -112.01 },
            'CDG': { lat: 49.01, lon: 2.55 },    'LHR': { lat: 51.47, lon: -0.46 },
            'FCO': { lat: 41.80, lon: 12.25 },   'MAD': { lat: 40.47, lon: -3.56 },
            'LIS': { lat: 38.77, lon: -9.13 },   'OPO': { lat: 41.24, lon: -8.68 },
            'AMS': { lat: 52.31, lon: 4.76 },    'FRA': { lat: 50.04, lon: 8.56 },
            'BCN': { lat: 41.30, lon: 2.08 },    'MXP': { lat: 45.63, lon: 8.72 },
            'ZRH': { lat: 47.46, lon: 8.55 },
            'EZE': { lat: -34.82, lon: -58.54 }, 'SCL': { lat: -33.39, lon: -70.79 }
        };

        const c1 = coords[origem];
        const c2 = coords[destino];
        if (!c1 || !c2) return 1000;

        const R = 6371;
        const dLat = (c2.lat - c1.lat) * Math.PI / 180;
        const dLon = (c2.lon - c1.lon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
    }

    getNomeCompanhia(codigo) {
        const nomes = {
            'LA': 'LATAM Airlines', 'JJ': 'LATAM Airlines',
            'G3': 'GOL Linhas Aéreas', 'AD': 'Azul Linhas Aéreas',
            'AA': 'American Airlines', 'UA': 'United Airlines',
            'DL': 'Delta Air Lines', 'TP': 'TAP Portugal',
            'IB': 'Iberia', 'AF': 'Air France',
            'LH': 'Lufthansa', 'BA': 'British Airways',
            'AV': 'Avianca', 'CM': 'Copa Airlines',
            'AR': 'Aerolíneas Argentinas'
        };
        return nomes[codigo] || codigo;
    }

    getCorCompanhia(codigo) {
        const cores = {
            'LA': '#1B0088', 'JJ': '#1B0088',
            'G3': '#FF6600', 'AD': '#0033A0',
            'AA': '#0078D2', 'UA': '#002244',
            'DL': '#003366', 'TP': '#00A651',
            'IB': '#DA291C', 'AF': '#002157',
            'LH': '#05164D', 'BA': '#075AAA',
            'AV': '#DA291C', 'CM': '#003876',
            'AR': '#1E90FF'
        };
        return cores[codigo] || '#666666';
    }

    // ============================================================
    //  BUSCA PRINCIPAL
    // ============================================================

    async buscarVoos(params) {
        console.log('🔍 Buscando voos:', params);

        // Conjunto completo de aeroportos brasileiros para detecção de rota doméstica.
        // Evita falsos negativos com aeroportos fora do aeroportosBR (lookup de nome).
        const AEROPORTOS_BR = new Set([
            'GRU','CGH','GIG','SDU','BSB','CNF','BHZ','SSA','REC','FOR','POA','CWB',
            'VCP','FLN','MAO','BEL','NAT','MCZ','VIX','CGB','GYN','OPS','JPA','THE',
            'SLZ','MGF','LDB','UDI','PMW','PVH','RBR','MCP','STM','IMP','IOS','PNZ',
            'AJU','JOI','NVT','BPS','CFB','PPB','IGU','XAP','CXJ','CAC','PHB','CPV',
            'PET','CCM','MOC','RAO','SJP','PLU','GVR','IPN','TFF','ERN','ALT','RVD',
            'OYK','SFK','MQH','STZ','PIN','JCB','CLV','PPY','BVB','CGR','TJL','PBQ'
        ]);

        // Rota 100% doméstica: ambos origem e destino em aeroportos BR.
        // Nessas rotas, APIs externas podem retornar voos codeshare em
        // companhias estrangeiras (IB, AF, TP, DL, AA...). Filtramos para
        // manter apenas as companhias que realmente operam voos domésticos BR.
        const isDomestico = AEROPORTOS_BR.has(params.origem) && AEROPORTOS_BR.has(params.destino);
        const ciasDomesticas = new Set(['LA', 'G3', 'AD', 'JJ', '2Z', 'M3', 'IZ', 'O6']);
        const filtrarDomestico = (voos) => {
            if (!isDomestico || !Array.isArray(voos)) return voos || [];
            return voos.filter(v => {
                const codigo = String(v?.companhia?.codigo || v?.companhia || '').toUpperCase();
                return ciasDomesticas.has(codigo);
            });
        };

        const resultado = {
            ida: [],
            volta: [],
            filtros: {
                companhias: [],
                precoMin: 0,
                precoMax: 0,
                duracaoMin: 0,
                duracaoMax: 0
            },
            meta: {
                origem: params.origem,
                destino: params.destino,
                dataIda: params.dataIda,
                dataVolta: params.dataVolta,
                passageiros: {
                    adultos: params.adultos || 1,
                    criancas: params.criancas || 0,
                    bebes: params.bebes || 0
                },
                classe: params.classe || 'economica',
                fonte: 'simulado'
            }
        };

        // Mescla listas de voos removendo codeshares duplicados.
        // Chave inclui companhia para preservar voos reais de cias diferentes no mesmo horário.
        // Preferência: Skyscanner (preço real) > Travelpayouts > Airlabs > AviationStack.
        const mergeVoos = (listas) => {
            const seen = new Map(); // chave → voo preferido
            const fonteOrder = ['skyscanner', 'travelpayouts', 'airlabs', 'aviationstack'];
            const prioFonte = (f) => { const i = fonteOrder.indexOf(f); return i === -1 ? 99 : i; };
            for (const lista of listas) {
                if (!Array.isArray(lista)) continue;
                for (const v of lista) {
                    const cia = String(v?.companhia?.codigo || '').toUpperCase();
                    const chave = `${v.origem?.codigo}-${v.destino?.codigo}-${v.partida?.horario}-${cia}`;
                    const existing = seen.get(chave);
                    if (!existing || prioFonte(v.fonte) < prioFonte(existing.fonte)) {
                        seen.set(chave, v);
                    }
                }
            }
            return Array.from(seen.values()).sort((a, b) => a.preco.valor - b.preco.valor);
        };

        try {
            // Executa todas as fontes em paralelo para maximizar cobertura de rotas
            console.log('✈️ Buscando em paralelo: Skyscanner + Travelpayouts + Airlabs + AviationStack...');
            const voltaParams = params.dataVolta
                ? { ...params, origem: params.destino, destino: params.origem, dataIda: params.dataVolta }
                : null;

            const [tpRes, alRes, asRes, fsIdaRes, fsVoltaRes] = await Promise.allSettled([
                travelpayoutsService.isConfigured() ? travelpayoutsService.buscarVoos(params) : Promise.resolve(null),
                airlabsService.isConfigured()       ? airlabsService.buscarVoos(params)       : Promise.resolve(null),
                aviationstackService.isConfigured() ? aviationstackService.buscarVoos(params) : Promise.resolve(null),
                this.rapidApi.key ? this.buscarFlightsSky(params) : Promise.resolve(null),
                (this.rapidApi.key && voltaParams) ? this.buscarFlightsSky(voltaParams) : Promise.resolve(null),
            ]);

            const tpResult = tpRes.status === 'fulfilled' ? tpRes.value : null;
            const alResult = alRes.status === 'fulfilled' ? alRes.value : null;
            const asResult = asRes.status === 'fulfilled' ? asRes.value : null;
            const fsIdaResp = fsIdaRes.status === 'fulfilled' ? fsIdaRes.value : null;
            const fsVoltaResp = fsVoltaRes.status === 'fulfilled' ? fsVoltaRes.value : null;

            if (tpRes.status === 'rejected') console.log('⚠️ Travelpayouts falhou:', tpRes.reason?.message);
            if (alRes.status === 'rejected') console.log('⚠️ Airlabs falhou:', alRes.reason?.message);
            if (asRes.status === 'rejected') console.log('⚠️ AviationStack falhou:', asRes.reason?.message);
            if (fsIdaRes.status === 'rejected') console.log('⚠️ Flights Sky (ida) falhou:', fsIdaRes.reason?.message);
            if (fsVoltaRes.status === 'rejected') console.log('⚠️ Flights Sky (volta) falhou:', fsVoltaRes.reason?.message);

            // Converte respostas Flights Sky
            const fsIdaConv  = fsIdaResp  ? this.converterRespostaFlightsSky(fsIdaResp,  params)      : { ida: [] };
            const fsVoltaConv = fsVoltaResp ? this.converterRespostaFlightsSky(fsVoltaResp, voltaParams) : { ida: [] };
            if (fsIdaConv.ida.length > 0)   console.log(`✅ Flights Sky: ${fsIdaConv.ida.length} voos de ida`);
            if (fsVoltaConv.ida.length > 0)  console.log(`✅ Flights Sky: ${fsVoltaConv.ida.length} voos de volta`);

            const fontes = [];
            const idaListas  = [];
            const voltaListas = [];

            if (fsIdaConv.ida.length > 0)  { idaListas.push(filtrarDomestico(fsIdaConv.ida));   fontes.push('skyscanner'); }
            if (fsVoltaConv.ida.length > 0) { voltaListas.push(filtrarDomestico(fsVoltaConv.ida)); }
            if (tpResult?.ida?.length > 0) { idaListas.push(filtrarDomestico(tpResult.ida));  voltaListas.push(filtrarDomestico(tpResult.volta || [])); fontes.push('travelpayouts'); }
            if (alResult?.ida?.length > 0) { idaListas.push(filtrarDomestico(alResult.ida));  voltaListas.push(filtrarDomestico(alResult.volta || [])); fontes.push('airlabs'); }
            if (asResult?.ida?.length > 0) { idaListas.push(filtrarDomestico(asResult.ida));  voltaListas.push(filtrarDomestico(asResult.volta || [])); fontes.push('aviationstack'); }

            if (idaListas.length > 0) {
                resultado.ida   = mergeVoos(idaListas);
                resultado.volta = mergeVoos(voltaListas);
                resultado.meta.fonte = fontes.join('+');
                console.log(`✅ ${resultado.ida.length} voos de ida e ${resultado.volta.length} de volta (fontes: ${resultado.meta.fonte})`);
            }

            // Fallback: dados simulados para ida
            if (resultado.ida.length === 0) {
                resultado.ida = this.gerarVoosSimulados({ ...params, tipo: 'ida' });
                resultado.meta.fonte = 'simulado';
                console.log(`✅ ${resultado.ida.length} voos simulados gerados (ida)`);
            }

            // Fallback: dados simulados para volta
            if (params.dataVolta && resultado.volta.length === 0) {
                resultado.volta = this.gerarVoosSimulados({
                    origem: params.destino,
                    destino: params.origem,
                    dataIda: params.dataVolta,
                    classe: params.classe,
                    adultos: params.adultos,
                    criancas: params.criancas,
                    bebes: params.bebes,
                    tipo: 'volta'
                });
                resultado.volta.forEach(v => v.tipo = 'volta');
            }

            // Calcular filtros
            const todosVoos = [...resultado.ida, ...resultado.volta];
            if (todosVoos.length > 0) {
                resultado.filtros.companhias = [...new Set(todosVoos.map(v => v.companhia.codigo))];
                resultado.filtros.precoMin = Math.min(...todosVoos.map(v => v.preco.valor));
                resultado.filtros.precoMax = Math.max(...todosVoos.map(v => v.preco.valor));
                resultado.filtros.duracaoMin = Math.min(...todosVoos.map(v => v.duracao.total));
                resultado.filtros.duracaoMax = Math.max(...todosVoos.map(v => v.duracao.total));
            }

        } catch (error) {
            console.error('❌ Erro na busca de voos:', error);
            resultado.ida = this.gerarVoosSimulados(params);
            resultado.meta.fonte = 'simulado';
        }

        return resultado;
    }
}

// Exportar instância singleton
module.exports = new FlightSearchService();
