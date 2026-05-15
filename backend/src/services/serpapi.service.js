/**
 * GiraMundoTour - SerpAPI Google Flights Integration
 *
 * Busca voos reais via Google Flights através da SerpAPI.
 * Documentação: https://serpapi.com/google-flights-api
 *
 * Free tier: 250 buscas/mês
 * Plano pago: ~$50/mês para 5.000 buscas
 *
 * Registro: https://serpapi.com/users/sign_up
 */

const https = require('https');

// Mapeamento de nomes de companhias → código IATA (para normalização)
const AIRLINE_NAME_TO_CODE = {
    'LATAM Airlines': 'LA',
    'LATAM Airlines Brasil': 'LA',
    'GOL Linhas Aéreas': 'G3',
    'GOL': 'G3',
    'Azul Brazilian Airlines': 'AD',
    'Azul Linhas Aéreas': 'AD',
    'American Airlines': 'AA',
    'United Airlines': 'UA',
    'Delta Air Lines': 'DL',
    'TAP Air Portugal': 'TP',
    'TAP Portugal': 'TP',
    'Iberia': 'IB',
    'Air France': 'AF',
    'Lufthansa': 'LH',
    'British Airways': 'BA',
    'Avianca': 'AV',
    'Copa Airlines': 'CM',
    'Aerolíneas Argentinas': 'AR',
    'Air Europa': 'UX',
    'KLM': 'KL',
    'Swiss': 'LX',
};

const AIRLINE_COLORS = {
    'LA': '#1B0088', 'JJ': '#1B0088',
    'G3': '#FF6600', 'AD': '#0033A0',
    'AA': '#0078D2', 'UA': '#002244',
    'DL': '#003366', 'TP': '#00A651',
    'IB': '#DA291C', 'AF': '#002157',
    'LH': '#05164D', 'BA': '#075AAA',
    'AV': '#DA291C', 'CM': '#003876',
    'AR': '#1E90FF', 'UX': '#002B99',
    'KL': '#00A1DE', 'LX': '#EC0016',
};

class SerpApiFlightsService {
    constructor() {
        this.apiKey = process.env.SERPAPI_KEY || '';
    }

    isConfigured() {
        return !!this.apiKey;
    }

    /**
     * Mapeia classe da aplicação → travel_class do SerpAPI
     * 1=Economy, 2=Premium Economy, 3=Business, 4=First
     */
    _mapClasse(classe) {
        const mapa = { 'economica': 1, 'executiva': 3, 'primeira': 4 };
        return mapa[classe] || 1;
    }

    /**
     * Extrai código IATA da companhia a partir do número de voo ou nome.
     * Números de voo SerpAPI: "LA 8081", "G3 1234", "AA 937"
     */
    _extrairCodigo(flightNumber, airlineName) {
        if (flightNumber) {
            const match = flightNumber.trim().match(/^([A-Z0-9]{2})\s/);
            if (match) return match[1];
            // sem espaço: "LA8081"
            const match2 = flightNumber.trim().match(/^([A-Z]{2,3})\d/);
            if (match2) return match2[1];
        }
        if (airlineName && AIRLINE_NAME_TO_CODE[airlineName]) {
            return AIRLINE_NAME_TO_CODE[airlineName];
        }
        return airlineName ? airlineName.substring(0, 2).toUpperCase() : 'XX';
    }

    /**
     * Faz requisição HTTPS para a SerpAPI.
     */
    async _request(queryParams) {
        queryParams.api_key = this.apiKey;
        const path = `/search.json?${new URLSearchParams(queryParams).toString()}`;

        return new Promise((resolve) => {
            const options = {
                hostname: 'serpapi.com',
                port: 443,
                path,
                method: 'GET',
                headers: { Accept: 'application/json' }
            };

            const req = https.request(options, (res) => {
                let raw = '';
                res.on('data', chunk => raw += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(raw);
                        if (json.error) {
                            console.error('❌ SerpAPI erro:', json.error);
                            resolve(null);
                        } else {
                            resolve(json);
                        }
                    } catch (e) {
                        console.error('❌ SerpAPI parse error:', e.message);
                        resolve(null);
                    }
                });
            });

            req.on('error', (e) => {
                console.error('❌ SerpAPI conexão error:', e.message);
                resolve(null);
            });

            req.setTimeout(15000, () => {
                console.error('❌ SerpAPI timeout');
                req.destroy();
                resolve(null);
            });

            req.end();
        });
    }

    /**
     * Busca voos em um sentido (one-way) para um par origem→destino.
     */
    async _buscarSentido(origem, destino, data, params) {
        const queryParams = {
            engine: 'google_flights',
            type: '2',              // 2 = one-way
            departure_id: origem,
            arrival_id: destino,
            outbound_date: data,
            adults: String(params.adultos || 1),
            currency: 'BRL',
            hl: 'pt',
            gl: 'br',
            travel_class: String(this._mapClasse(params.classe))
        };

        if ((params.criancas || 0) > 0) queryParams.children = String(params.criancas);
        if ((params.bebes || 0) > 0) queryParams.infants_in_seat = String(params.bebes);

        console.log(`✈️ SerpAPI buscando ${origem} → ${destino} em ${data}`);
        return this._request(queryParams);
    }

    /**
     * Converte itinerários do SerpAPI para o formato interno da aplicação.
     *
     * Estrutura SerpAPI (best_flights / other_flights):
     * {
     *   flights: [{ departure_airport: {id, name, time}, arrival_airport: {id, name, time},
     *               duration, airline, airline_logo, flight_number, travel_class }],
     *   layovers: [{ name, id, duration, overnight? }],
     *   total_duration: number (minutos),
     *   price: number (total para os passageiros buscados),
     *   airline_logo: string,
     *   booking_token: string
     * }
     */
    _converterItinerarios(response, tipo, params) {
        if (!response) return [];

        const totalPax = Math.max(1, (params.adultos || 1) + (params.criancas || 0));
        const classeStr = params.classe || 'economica';
        const itinerarios = [
            ...(response.best_flights || []),
            ...(response.other_flights || [])
        ];

        const voos = [];
        const seen = new Set();

        for (const itin of itinerarios) {
            try {
                const segs = itin.flights;
                if (!segs || segs.length === 0) continue;

                const precoTotal = itin.price || 0;
                if (!precoTotal) continue;

                const precoPorPessoa = Math.round((precoTotal / totalPax) * 100) / 100;

                // Segmento de saída e chegada finais do itinerary
                const segSaida = segs[0];
                const segChegada = segs[segs.length - 1];

                const origemCode = segSaida.departure_airport?.id || '';
                const destinoCode = segChegada.arrival_airport?.id || '';
                const origemNome = segSaida.departure_airport?.name || origemCode;
                const destinoNome = segChegada.arrival_airport?.name || destinoCode;

                // Horários: formato "2026-04-15 06:00"
                const partidaStr = segSaida.departure_airport?.time || '';
                const chegadaStr = segChegada.arrival_airport?.time || '';
                const [partidaData = '', partidaHora = ''] = partidaStr.split(' ');
                const [chegadaData = '', chegadaHora = ''] = chegadaStr.split(' ');

                // Companhia do primeiro segmento
                const flightNum = segSaida.flight_number || '';
                const airlineName = segSaida.airline || '';
                const companhiaCodigo = this._extrairCodigo(flightNum, airlineName);
                const numero = flightNum.replace(/\s+/g, '');

                const duracaoMin = itin.total_duration || segSaida.duration || 0;
                const escalas = segs.length - 1;

                // Deduplicar por número+horário+rota
                const chave = `${numero}@${partidaHora}@${origemCode}@${destinoCode}`;
                if (seen.has(chave)) continue;
                seen.add(chave);

                // Criar timestamp ISO sem conversão de timezone (horário local do aeroporto)
                const toIso = (str) => str ? str.replace(' ', 'T') + ':00' : '';

                const duracaoTexto = `${Math.floor(duracaoMin / 60)}h ${duracaoMin % 60}min`;

                voos.push({
                    id: `gf-${tipo}-${Date.now()}-${voos.length}`,
                    companhia: { codigo: companhiaCodigo, nome: airlineName || companhiaCodigo, cor: AIRLINE_COLORS[companhiaCodigo] || '#666666' },
                    numero,
                    origem: { codigo: origemCode, cidade: origemNome, nome: origemNome },
                    destino: { codigo: destinoCode, cidade: destinoNome, nome: destinoNome },
                    partida: { data: partidaData, horario: partidaHora, timestamp: toIso(partidaStr) },
                    chegada: { data: chegadaData, horario: chegadaHora, timestamp: toIso(chegadaStr) },
                    duracao: { total: duracaoMin, texto: duracaoTexto },
                    escalas,
                    classe: classeStr,
                    preco: { valor: precoPorPessoa, moeda: 'BRL', porPessoa: precoPorPessoa },
                    assentos: null,
                    tipo,
                    fonte: 'google_flights',
                    segmentos: segs.length > 1 ? segs.map(s => ({
                        companhia:  this._extrairCodigo(s.flight_number || '', s.airline || '') || companhiaCodigo,
                        numeroVoo:  (s.flight_number || '').replace(/\s+/g, ''),
                        origem:     s.departure_airport?.id || '',
                        destino:    s.arrival_airport?.id  || '',
                        partida:    s.departure_airport?.time ? s.departure_airport.time.replace(' ', 'T') + ':00' : '',
                        chegada:    s.arrival_airport?.time  ? s.arrival_airport.time.replace(' ', 'T')  + ':00' : '',
                        duracao:    s.duration || 0
                    })) : undefined
                });
            } catch (e) {
                console.error('Erro ao converter itinerário SerpAPI:', e.message);
            }
        }

        return voos;
    }

    /**
     * Busca principal: faz duas buscas one-way em paralelo (ida + volta se solicitado).
     * Retorna { ida: [...], volta: [...] } ou null se não configurado.
     */
    async buscarVoos(params) {
        if (!this.isConfigured()) {
            console.log('⚠️ SERPAPI_KEY não configurada');
            return null;
        }

        const promises = [
            this._buscarSentido(params.origem, params.destino, params.dataIda, params)
        ];

        if (params.dataVolta) {
            promises.push(
                this._buscarSentido(params.destino, params.origem, params.dataVolta, params)
            );
        }

        const [respostaIda, respostaVolta] = await Promise.all(promises);

        const ida = this._converterItinerarios(respostaIda, 'ida', params);
        const volta = respostaVolta
            ? this._converterItinerarios(respostaVolta, 'volta', params)
            : [];

        console.log(`✅ SerpAPI Google Flights: ${ida.length} voos de ida, ${volta.length} voos de volta`);

        return { ida, volta };
    }
}

module.exports = new SerpApiFlightsService();
