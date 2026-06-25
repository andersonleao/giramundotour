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
                tripType:             2,
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
                'User-Agent':  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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

    _converter(response, params, tipo) {
        const flightList = response?.requestedFlightSegmentList?.[0]?.flightList;
        if (!flightList?.length) return [];

        const voos = [];

        for (const flight of flightList) {
            try {
                // Prefere tarifa SMILES_CLUB; fallback para primeira disponível
                const fare = flight.fareList?.find(f => f.fareType === 'SMILES_CLUB')
                          || flight.fareList?.[0];
                if (!fare) continue;

                const milhas   = fare.miles || 0;
                const taxa     = fare.tax?.total || 0;
                const assentos = fare.availabilityCount || 0;
                if (milhas === 0) continue;

                const ciaCodigo = flight.airline?.code || 'G3';
                const ciaNome   = flight.airline?.name || 'GOL Linhas Aéreas';
                const partida   = flight.departure?.date || '';
                const chegada   = flight.arrival?.date   || '';
                const origemCode  = flight.departure?.airport?.code || params.origem;
                const destinoCode = flight.arrival?.airport?.code   || params.destino;

                const duracaoH   = flight.flightDuration?.hours   || 0;
                const duracaoM   = flight.flightDuration?.minutes  || 0;
                const duracaoMin = duracaoH * 60 + duracaoM;

                const valorEquiv = Math.round(milhas * this.valorPorMilha * 100) / 100;

                const primeiraLeg = flight.leg?.[0];
                const numeroVoo   = `${ciaCodigo}${primeiraLeg?.flightNumber || ''}`;

                const segmentos = flight.leg?.length > 1
                    ? flight.leg.map(l => ({
                        companhia:  l.airline?.code || ciaCodigo,
                        numeroVoo:  `${l.airline?.code || ciaCodigo}${l.flightNumber || ''}`,
                        origem:     l.departure?.airport?.code || '',
                        destino:    l.arrival?.airport?.code   || '',
                        partida:    l.departure?.date || '',
                        chegada:    l.arrival?.date   || '',
                        duracao:    (l.duration?.hours || 0) * 60 + (l.duration?.minutes || 0)
                    }))
                    : undefined;

                voos.push({
                    id: `smiles-${flight.uid || numeroVoo}-${tipo}`,
                    companhia: {
                        codigo: ciaCodigo,
                        nome:   ciaNome,
                        cor:    ciaCodigo === 'G3' ? '#FF6600' : '#666666'
                    },
                    numero:  numeroVoo,
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
