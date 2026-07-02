/**
 * GiraMundoTour — Smiles (GOL) Flight Search Service
 *
 * Consulta a API pública do Smiles para retornar disponibilidade em milhas.
 * Usa fetch() (undici) em vez de https.request para evitar bloqueio Akamai em data centers.
 * Retorna preco.valor = equivalente BRL das milhas e pontos.quantidade = milhas reais.
 */

class SmilesService {
    constructor() {
        this.apiKey        = process.env.SMILES_API_KEY || 'aJqPU7xNHl9qN3NVZnPaJ208aPo2Bh2p2ZV844tw';
        this.host          = 'https://api-air-flightsearch-prd.smiles.com.br';
        this.valorPorMilha = 0.022;
    }

    isConfigured() {
        return true;
    }

    _mapCabin(classe) {
        const mapa = { economica: 'ECONOMIC', executiva: 'BUSINESS', primeira: 'FIRST' };
        return mapa[classe] || 'ECONOMIC';
    }

    async _request(params) {
        const qs = new URLSearchParams({
            adults:                  params.adultos  || 1,
            children:                params.criancas || 0,
            infants:                 params.bebes    || 0,
            originAirportCode:       params.origem,
            destinationAirportCode:  params.destino,
            departureDate:           params.dataIda,
            cabin:                   this._mapCabin(params.classe),
            currencyCode:            'BRL',
            highlightText:           'SMILES_CLUB'
        });

        const url = `${this.host}/v1/airlines/search?${qs}`;

        const headers = {
            'x-api-key':   this.apiKey,
            'channel':     'Web',
            'region':      'BRASIL',
            'Accept':      'application/json',
            'User-Agent':  'SmilesMobile/6.0 (Android; com.gol.smiles)'
        };
        if (process.env.SMILES_TOKEN) headers['authorization'] = `Bearer ${process.env.SMILES_TOKEN}`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);

        try {
            const res = await fetch(url, { headers, signal: controller.signal });
            clearTimeout(timer);

            if (!res.ok) {
                const body = await res.text();
                console.error(`❌ Smiles API [${res.status}]: ${body.slice(0, 200)}`);
                return null;
            }
            return await res.json();
        } catch (e) {
            clearTimeout(timer);
            if (e.name === 'AbortError') {
                console.error('❌ Smiles: timeout (10s)');
            } else {
                console.error('❌ Smiles: erro de conexão:', e.message);
            }
            return null;
        }
    }

    _calcDuracao(partida, chegada) {
        try {
            return Math.round((new Date(chegada) - new Date(partida)) / 60000);
        } catch { return 0; }
    }

    _converter(response, params, tipo) {
        const flightList = response?.requestedFlightSegmentList?.[0]?.flightList;
        if (!flightList?.length) return [];

        const voos = [];

        for (const flight of flightList) {
            try {
                const fare = flight.fareList?.find(f => f.type === 'SMILES_CLUB')
                          || flight.fareList?.find(f => f.type === 'SMILES')
                          || flight.fareList?.find(f => (f.miles || 0) > 0);
                if (!fare) continue;

                const milhas = fare.miles || 0;
                if (milhas === 0) continue;

                const taxa        = parseFloat(fare.g3?.costTax || fare.tax?.total || 0) || 0;
                const ciaCodigo   = flight.airline?.code || 'G3';
                const ciaNome     = flight.airline?.name || 'GOL Linhas Aéreas';
                const partida     = flight.departure?.date || '';
                const chegada     = flight.arrival?.date   || '';
                const origemCode  = flight.departure?.airport?.code || params.origem;
                const destinoCode = flight.arrival?.airport?.code   || params.destino;

                const duracaoMin = (flight.flightDuration?.hours || 0) * 60
                    + (flight.flightDuration?.minutes || 0)
                    || this._calcDuracao(partida, chegada);

                const valorEquiv = Math.round(milhas * this.valorPorMilha * 100) / 100;

                let segmentos;
                if (flight.stops > 0 && fare.legListCost) {
                    segmentos = fare.legListCost.split(' / ').map(l => {
                        const [org, dst] = l.trim().split('-');
                        return { companhia: ciaCodigo, numeroVoo: ciaCodigo, origem: org, destino: dst, partida: '', chegada: '', duracao: 0 };
                    });
                }

                voos.push({
                    id:       `smiles-${flight.uid || ciaCodigo}-${tipo}`,
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
                        texto: `${Math.floor(duracaoMin / 60)}h ${duracaoMin % 60}min`
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
                        quantidade:       milhas,
                        programa:         'Smiles',
                        taxaEmbarque:     taxa,
                        valorEquivalente: valorEquiv
                    },
                    assentos: fare.availabilityCount || 0,
                    tipo,
                    fonte: 'smiles',
                    segmentos
                });
            } catch (e) {
                console.error('❌ Smiles: erro ao converter voo:', e.message);
            }
        }

        // Deduplicar: mantém a tarifa com menos milhas para o mesmo horário/cia
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
            if (voosIda.length > 0) console.log(`✅ Smiles: ${voosIda.length} voo(s) de ida (${params.origem}-${params.destino})`);
            return { ida: voosIda, volta: [] };
        } catch (e) {
            console.error('❌ Smiles buscarVoos:', e.message);
            return { ida: [], volta: [] };
        }
    }
}

module.exports = new SmilesService();
