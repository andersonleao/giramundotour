/**
 * GiraMundoTour - Amadeus Self-Service API
 * GDS real com dados de voos brasileiros (sandbox gratuita)
 *
 * Registro gratuito: https://developers.amadeus.com/self-service
 * Configurar no servidor:
 *   AMADEUS_CLIENT_ID=<client_id>
 *   AMADEUS_CLIENT_SECRET=<client_secret>
 *   AMADEUS_ENV=test   (ou 'production')
 */

const https = require('https');

class AmadeusService {
    constructor() {
        this.clientId     = process.env.AMADEUS_CLIENT_ID     || '';
        this.clientSecret = process.env.AMADEUS_CLIENT_SECRET || '';
        this.env          = process.env.AMADEUS_ENV           || 'test';
        this.host         = this.env === 'production'
            ? 'api.amadeus.com'
            : 'test.api.amadeus.com';
        this.token        = null;
        this.tokenExpiry  = 0;
    }

    isConfigured() {
        return !!(this.clientId && this.clientSecret);
    }

    // -------------------------------------------------------
    //  AUTH — OAuth2 client_credentials
    // -------------------------------------------------------

    async getToken() {
        if (this.token && Date.now() < this.tokenExpiry - 30000) {
            return this.token;
        }

        const body = `grant_type=client_credentials&client_id=${encodeURIComponent(this.clientId)}&client_secret=${encodeURIComponent(this.clientSecret)}`;

        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.host,
                path: '/v1/security/oauth2/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode !== 200) {
                            return reject(new Error(`Amadeus auth error ${res.statusCode}: ${json.error_description || ''}`));
                        }
                        this.token = json.access_token;
                        this.tokenExpiry = Date.now() + (json.expires_in || 1799) * 1000;
                        resolve(this.token);
                    } catch (e) {
                        reject(new Error('Amadeus auth parse error: ' + e.message));
                    }
                });
            });
            req.setTimeout(10000, () => { req.destroy(); reject(new Error('Amadeus auth timeout')); });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }

    // -------------------------------------------------------
    //  FLIGHT OFFERS SEARCH
    // -------------------------------------------------------

    async request(path, token) {
        return new Promise((resolve) => {
            const options = {
                hostname: this.host,
                path,
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` }
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode !== 200) {
                            console.error(`❌ Amadeus [${res.statusCode}]:`, json.errors?.[0]?.detail || '');
                            resolve(null);
                        } else {
                            resolve(json);
                        }
                    } catch (e) {
                        console.error('❌ Amadeus parse error:', e.message);
                        resolve(null);
                    }
                });
            });
            req.setTimeout(10000, () => { req.destroy(); resolve(null); });
            req.on('error', (e) => { console.error('❌ Amadeus request error:', e.message); resolve(null); });
            req.end();
        });
    }

    async buscarVoos(params) {
        if (!this.isConfigured()) {
            console.log('⚠️ Amadeus: AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET não configurados');
            return null;
        }

        try {
            const token = await this.getToken();

            const qp = new URLSearchParams({
                originLocationCode:      params.origem,
                destinationLocationCode: params.destino,
                departureDate:           params.dataIda,
                adults:                  params.adultos || 1,
                currencyCode:            'BRL',
                max:                     250
            });
            if (params.criancas > 0) qp.append('children', params.criancas);
            if (params.bebes    > 0) qp.append('infants',  params.bebes);

            const cabinMap = { executiva: 'BUSINESS', primeira: 'FIRST' };
            if (cabinMap[params.classe]) qp.append('travelClass', cabinMap[params.classe]);

            const path = `/v2/shopping/flight-offers?${qp.toString()}`;
            console.log('🔍 Amadeus flight-offers:', path);

            const response = await this.request(path, token);
            if (!response || !response.data) return null;

            const voos = this.converter(response.data, response.dictionaries || {}, params, 'ida');
            console.log(`✅ Amadeus: ${voos.length} voos de ida`);

            // Volta separada
            let volta = [];
            if (params.dataVolta) {
                const qpV = new URLSearchParams({
                    originLocationCode:      params.destino,
                    destinationLocationCode: params.origem,
                    departureDate:           params.dataVolta,
                    adults:                  params.adultos || 1,
                    currencyCode:            'BRL',
                    max:                     250
                });
                if (params.criancas > 0) qpV.append('children', params.criancas);
                if (params.bebes    > 0) qpV.append('infants',  params.bebes);
                if (cabinMap[params.classe]) qpV.append('travelClass', cabinMap[params.classe]);

                const respV = await this.request(`/v2/shopping/flight-offers?${qpV.toString()}`, token);
                if (respV && respV.data) {
                    volta = this.converter(respV.data, respV.dictionaries || {}, {
                        ...params, origem: params.destino, destino: params.origem, dataIda: params.dataVolta
                    }, 'volta');
                    console.log(`✅ Amadeus: ${volta.length} voos de volta`);
                }
            }

            return { ida: voos, volta };

        } catch (e) {
            console.error('❌ Amadeus buscarVoos:', e.message);
            return null;
        }
    }

    // -------------------------------------------------------
    //  CONVERSÃO → formato interno
    // -------------------------------------------------------

    converter(offers, dicts, params, tipo) {
        const flightSearchService = require('./flightSearch.service');
        // Mapa para deduplicar: mesma sequência de voos com preços diferentes → manter o mais barato
        const vooMap = new Map();

        for (const offer of offers) {
            try {
                // Pegar o primeiro itinerary (ida = 0, mas para volta também é 0 pois buscamos one-way)
                const itin = offer.itineraries[0];
                if (!itin) continue;

                const preco = parseFloat(offer.price?.total || offer.price?.grandTotal || 0);
                if (!preco) continue;

                const segs  = itin.segments || [];
                const first = segs[0];
                const last  = segs[segs.length - 1];
                if (!first || !last) continue;

                // Chave visual: o que o usuário vê na tela
                // Mesmo número do 1º voo + mesmos horários de partida/chegada totais + nº escalas
                // → é o mesmo "voo" para o usuário → manter o mais barato
                const chaveItinerario = [
                    `${first.carrierCode}${first.number}`,
                    first.departure?.at?.slice(0, 16),  // YYYY-MM-DDTHH:MM (sem segundos/tz)
                    last.arrival?.at?.slice(0, 16),
                    segs.length
                ].join('|');

                // Se já existe esse itinerário com preço menor ou igual, pular
                if (vooMap.has(chaveItinerario) && vooMap.get(chaveItinerario).preco.valor <= preco) {
                    continue;
                }

                // Companhia (carrier do primeiro segmento)
                const carrierCode = first.carrierCode || '';
                const iataMap = { LA: 'LA', JJ: 'LA', G3: 'G3', AD: 'AD' };
                const cia     = iataMap[carrierCode] || carrierCode;
                const ciaNome = dicts.carriers?.[carrierCode] || flightSearchService.getNomeCompanhia(cia);

                const partida = first.departure?.at || '';
                const chegada = last.arrival?.at || '';

                const duracaoStr = itin.duration || 'PT2H'; // ex: PT5H30M
                const duracaoMin = this.parseDuracao(duracaoStr);

                const pontosInfo = flightSearchService.calcularPontos(preco, cia);

                vooMap.set(chaveItinerario, {
                    id:       `AMD-${offer.id}-${tipo}`,
                    companhia: { codigo: cia, nome: ciaNome, cor: flightSearchService.getCorCompanhia(cia) },
                    numero:   `${carrierCode}${first.number || ''}`,
                    origem: {
                        codigo: first.departure?.iataCode || params.origem,
                        ...flightSearchService.aeroportosBR[first.departure?.iataCode] || { cidade: first.departure?.iataCode, nome: '', uf: '' }
                    },
                    destino: {
                        codigo: last.arrival?.iataCode || params.destino,
                        ...flightSearchService.aeroportosBR[last.arrival?.iataCode] || { cidade: last.arrival?.iataCode, nome: '', uf: '' }
                    },
                    partida:  { data: partida.split('T')[0], horario: (partida.split('T')[1] || '').slice(0,5), timestamp: partida },
                    chegada:  { data: chegada.split('T')[0], horario: (chegada.split('T')[1] || '').slice(0,5), timestamp: chegada },
                    duracao:  { total: duracaoMin, texto: `${Math.floor(duracaoMin/60)}h ${duracaoMin%60}min` },
                    escalas:  segs.length - 1,
                    classe:   params.classe || 'economica',
                    preco:    { valor: preco, moeda: 'BRL', porPessoa: preco, taxas: 0, total: preco },
                    pontos:   pontosInfo ? {
                        quantidade: pontosInfo.pontos, programa: pontosInfo.programa,
                        taxaEmbarque: pontosInfo.taxaEmbarque, valorEquivalente: pontosInfo.pontos * pontosInfo.valorPonto
                    } : null,
                    assentos: parseInt(offer.numberOfBookableSeats || 9),
                    tipo,
                    fonte:    'amadeus'
                });
            } catch (e) {
                console.error('Amadeus converter item:', e.message);
            }
        }
        return Array.from(vooMap.values());
    }

    parseDuracao(duration) {
        // "PT5H30M" → 330 min
        const h = parseInt(duration.match(/(\d+)H/)?.[1] || 0);
        const m = parseInt(duration.match(/(\d+)M/)?.[1] || 0);
        return h * 60 + m;
    }
}

module.exports = new AmadeusService();
