/**
 * GiraMundoTour — Smiles (GOL) Flight Search Service
 *
 * Consulta a API pública do Smiles para retornar disponibilidade em milhas.
 * Retorna preco.valor = equivalente BRL das milhas e pontos.quantidade = milhas reais.
 */

const https = require('https');

class SmilesService {
    constructor() {
        // Chave pública da API Smiles (web client key)
        this.apiKey = process.env.SMILES_API_KEY || 'aJqPU7xNHl9qN3NVZnPaJ208aPo2Bh2p2ZV844tw';
        this.token  = process.env.SMILES_TOKEN || '';
        this.host   = 'api-air-flightsearch-prd.smiles.com.br';
        // Valor de referência por milha Smiles em BRL (usado para conversão/ordenação)
        this.valorPorMilha = 0.022;
    }

    isConfigured() {
        return true; // API pública — sempre disponível
    }

    _mapCabin(classe) {
        const mapa = { economica: 'ECONOMIC', executiva: 'BUSINESS', primeira: 'FIRST' };
        return mapa[classe] || 'ECONOMIC';
    }

    _request(params) {
        return new Promise((resolve) => {
            const qp = new URLSearchParams({
                adults:               params.adultos  || 1,
                children:             params.criancas || 0,
                infants:              params.bebes    || 0,
                originAirportCode:    params.origem,
                destinationAirportCode: params.destino,
                departureDate:        params.dataIda,
                cabin:                this._mapCabin(params.classe),
                currencyCode:         'BRL',
                highlightText:        'SMILES_CLUB'
            });

            const headers = {
                'x-api-key':   this.apiKey,
                'channel':     'Web',
                'region':      'BRASIL',
                'Accept':      'application/json',
                'User-Agent':  'SmilesMobile/6.0 (Android; com.gol.smiles)'
            };
            if (this.token) headers['authorization'] = `Bearer ${this.token}`;

            const options = {
                hostname: this.host,
                port:     443,
                path:     `/v1/airlines/search?${qp}`,
                method:   'GET',
                headers
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            console.error(`❌ Smiles API [${res.statusCode}]: ${data.slice(0, 200)}`);
                            resolve(null);
                            return;
                        }
                        resolve(JSON.parse(data));
                    } catch (e) {
                        console.error('❌ Smiles: erro ao parsear resposta:', e.message);
                        resolve(null);
                    }
                });
            });

            req.setTimeout(8000, () => { req.destroy(); resolve(null); });
            req.on('error', (err) => {
                console.error('❌ Smiles: erro de conexão:', err.message);
                resolve(null);
            });

            req.end();
        });
    }

    _calcDuracao(partida, chegada) {
        try {
            const diff = new Date(chegada) - new Date(partida);
            return Math.round(diff / 60000);
        } catch { return 0; }
    }

    _converter(response, params, tipo) {
        const flightList = response?.requestedFlightSegmentList?.[0]?.flightList;
        if (!flightList?.length) return [];

        const voos = [];

        for (const flight of flightList) {
            try {
                // Prefere SMILES_CLUB; fallback para SMILES; fallback para qualquer tarifa com milhas
                const fare = flight.fareList?.find(f => f.type === 'SMILES_CLUB')
                          || flight.fareList?.find(f => f.type === 'SMILES')
                          || flight.fareList?.find(f => (f.miles || 0) > 0);
                if (!fare) continue;

                const milhas   = fare.miles || 0;
                // tax está em fare.g3.costTax (string BRL)
                const taxa     = parseFloat(fare.g3?.costTax || fare.tax?.total || 0) || 0;
                const assentos = fare.availabilityCount || 0;
                if (milhas === 0) continue;

                const ciaCodigo = flight.airline?.code || 'G3';
                const ciaNome   = flight.airline?.name || 'GOL Linhas Aéreas';
                const partida   = flight.departure?.date || '';
                const chegada   = flight.arrival?.date   || '';
                const origemCode  = flight.departure?.airport?.code || params.origem;
                const destinoCode = flight.arrival?.airport?.code   || params.destino;

                // flightDuration pode estar ausente → calcula pelos timestamps
                const duracaoMin = (flight.flightDuration?.hours || 0) * 60
                    + (flight.flightDuration?.minutes || 0)
                    || this._calcDuracao(partida, chegada);
                const duracaoH = Math.floor(duracaoMin / 60);
                const duracaoM = duracaoMin % 60;

                const valorEquiv = Math.round(milhas * this.valorPorMilha * 100) / 100;

                const numeroVoo = ciaCodigo;

                // Segmentos: API retorna em fare.legListCost ex: "REC-CGH / CGH-POA"
                let segmentos;
                if (flight.stops > 0 && fare.legListCost) {
                    const legs = fare.legListCost.split(' / ').map(l => l.trim());
                    segmentos = legs.map(l => {
                        const [org, dst] = l.split('-');
                        return { companhia: ciaCodigo, numeroVoo: ciaCodigo, origem: org, destino: dst, partida: '', chegada: '', duracao: 0 };
                    });
                }

                voos.push({
                    id: `smiles-${flight.uid || ciaCodigo}-${tipo}`,
                    companhia: {
                        codigo: ciaCodigo,
                        nome:   ciaNome,
                        cor:    ciaCodigo === 'G3' ? '#FF6600' : '#666666'
                    },
                    numero:  `${ciaCodigo}${flight.uid ? flight.uid.substring(0, 4) : ''}`,
                    origem:  {
                        codigo: origemCode,
                        cidade: flight.departure?.airport?.city || '',
                        nome:   flight.departure?.airport?.name || ''
                    },
                    destino: {
                        codigo: destinoCode,
                        cidade: flight.arrival?.airport?.city || '',
                        nome:   flight.arrival?.airport?.name || ''
                    },
                    partida: {
                        data:      partida.split('T')[0] || params.dataIda,
                        horario:   (partida.split('T')[1] || '').substring(0, 5),
                        timestamp: partida
                    },
                    chegada: {
                        data:      chegada.split('T')[0] || '',
                        horario:   (chegada.split('T')[1] || '').substring(0, 5),
                        timestamp: chegada
                    },
                    duracao: {
                        total: duracaoMin,
                        texto: `${duracaoH}h ${duracaoM}min`
                    },
                    escalas:  flight.stops || 0,
                    classe:   params.classe || 'economica',
                    preco: {
                        valor:     valorEquiv,
                        moeda:     'BRL',
                        porPessoa: valorEquiv,
                        taxas:     taxa,
                        total:     valorEquiv + taxa
                    },
                    pontos: {
                        quantidade:      milhas,
                        programa:        'Smiles',
                        taxaEmbarque:    taxa,
                        valorEquivalente: valorEquiv
                    },
                    assentos,
                    tipo,
                    fonte: 'smiles',
                    segmentos
                });
            } catch (e) {
                console.error('❌ Smiles: erro ao converter voo:', e.message);
            }
        }

        // Deduplicar: mantém a tarifa com menos milhas para o mesmo horário
        const mapa = new Map();
        for (const v of voos) {
            const chave = `${v.origem.codigo}-${v.destino.codigo}-${v.partida.horario}-${v.companhia.codigo}`;
            const existente = mapa.get(chave);
            if (!existente || v.pontos.quantidade < existente.pontos.quantidade) {
                mapa.set(chave, v);
            }
        }
        return Array.from(mapa.values());
    }

    async buscarVoos(params) {
        try {
            const response = await this._request(params);
            if (!response) return { ida: [], volta: [] };
            const voosIda = this._converter(response, params, 'ida');
            if (voosIda.length > 0) console.log(`✅ Smiles: ${voosIda.length} voo(s) de ida`);
            return { ida: voosIda, volta: [] };
        } catch (e) {
            console.error('❌ Smiles buscarVoos:', e.message);
            return { ida: [], volta: [] };
        }
    }
}

module.exports = new SmilesService();
