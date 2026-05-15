/**
 * GiraMundoTour - Kiwi.com Tequila API
 *
 * API gratuita com dados reais de voos (LATAM, GOL, Azul + conexões).
 * Registro gratuito: https://tequila.kiwi.com/
 * Configurar no .env:
 *   KIWI_API_KEY=<sua_api_key>
 */

const https = require('https');

class KiwiService {
    constructor() {
        this.apiKey = process.env.KIWI_API_KEY || '';
        this.host   = 'api.tequila.kiwi.com';
    }

    isConfigured() {
        return !!this.apiKey;
    }

    async request(path) {
        return new Promise((resolve) => {
            const options = {
                hostname: this.host,
                path,
                method: 'GET',
                headers: {
                    'apikey': this.apiKey,
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
                            console.error(`❌ Kiwi [${res.statusCode}]:`, json.message || JSON.stringify(json).slice(0, 200));
                            resolve(null);
                        } else {
                            resolve(json);
                        }
                    } catch (e) {
                        console.error('❌ Kiwi parse error:', e.message);
                        resolve(null);
                    }
                });
            });
            req.on('error', (e) => { console.error('❌ Kiwi request error:', e.message); resolve(null); });
            req.end();
        });
    }

    async buscarVoos(params) {
        if (!this.isConfigured()) {
            console.log('⚠️ Kiwi: KIWI_API_KEY não configurada');
            return null;
        }

        try {
            const resultado = { ida: [], volta: [] };

            // ── Busca IDA ──────────────────────────────────────────────────
            const idaVoos = await this._buscarTrecho({
                origem:   params.origem,
                destino:  params.destino,
                data:     params.dataIda,
                adultos:  params.adultos  || 1,
                criancas: params.criancas || 0,
                bebes:    params.bebes    || 0,
                classe:   params.classe   || 'economica'
            });
            resultado.ida = idaVoos.map(v => ({ ...v, tipo: 'ida' }));
            console.log(`✅ Kiwi: ${resultado.ida.length} voos de ida`);

            // ── Busca VOLTA ────────────────────────────────────────────────
            if (params.dataVolta) {
                const voltaVoos = await this._buscarTrecho({
                    origem:   params.destino,
                    destino:  params.origem,
                    data:     params.dataVolta,
                    adultos:  params.adultos  || 1,
                    criancas: params.criancas || 0,
                    bebes:    params.bebes    || 0,
                    classe:   params.classe   || 'economica'
                });
                resultado.volta = voltaVoos.map(v => ({ ...v, tipo: 'volta' }));
                console.log(`✅ Kiwi: ${resultado.volta.length} voos de volta`);
            }

            return resultado;
        } catch (e) {
            console.error('❌ Kiwi buscarVoos:', e.message);
            return null;
        }
    }

    async _buscarTrecho({ origem, destino, data, adultos, criancas, bebes, classe }) {
        const cabinMap = { executiva: 'C', primeira: 'F' };
        const cabin    = cabinMap[classe] || 'M'; // M = Economy

        const qp = new URLSearchParams({
            fly_from:      origem,
            fly_to:        destino,
            date_from:     this._formatarData(data),
            date_to:       this._formatarData(data),
            adults:        adultos,
            children:      criancas,
            infants:       bebes,
            curr:          'BRL',
            locale:        'pt-BR',
            selected_cabins: cabin,
            limit:         250,
            sort:          'price',
            partner:       'picky'
        });

        const path = `/v2/search?${qp.toString()}`;
        console.log('🔍 Kiwi search:', path);

        const response = await this.request(path);
        if (!response || !response.data) return [];

        return this._converter(response.data, { origem, destino, data, classe });
    }

    _converter(itinerarios, params) {
        const flightSearchService = require('./flightSearch.service');
        const vooMap = new Map();

        for (const it of itinerarios) {
            try {
                const preco = parseFloat(it.price || 0);
                if (!preco) continue;

                const routes = it.route || [];
                if (routes.length === 0) continue;

                const first = routes[0];
                const last  = routes[routes.length - 1];

                // Chave única por itinerário completo
                const chave = routes.map(r => `${r.airline}${r.flight_no}@${r.local_departure}`).join('|');
                if (vooMap.has(chave) && vooMap.get(chave).preco.valor <= preco) continue;

                const carrierCode = first.airline || '';
                const iataMap = { LA: 'LA', JJ: 'LA', G3: 'G3', AD: 'AD' };
                const cia     = iataMap[carrierCode] || carrierCode;
                const ciaNome = flightSearchService.getNomeCompanhia(cia) || it.airlines?.[0] || carrierCode;

                const partida = first.local_departure || '';
                const chegada = last.local_arrival   || '';

                const duracaoMin = Math.round((it.duration?.departure || 0) / 60);
                const pontosInfo = flightSearchService.calcularPontos(preco, cia);

                vooMap.set(chave, {
                    id:       `KW-${it.id}`,
                    companhia: { codigo: cia, nome: ciaNome, cor: flightSearchService.getCorCompanhia(cia) },
                    numero:   `${carrierCode}${first.flight_no || ''}`,
                    origem: {
                        codigo: first.flyFrom || params.origem,
                        ...flightSearchService.aeroportosBR[first.flyFrom] || { cidade: first.cityFrom || first.flyFrom, nome: '', uf: '' }
                    },
                    destino: {
                        codigo: last.flyTo || params.destino,
                        ...flightSearchService.aeroportosBR[last.flyTo] || { cidade: last.cityTo || last.flyTo, nome: '', uf: '' }
                    },
                    partida: {
                        data:     partida.split('T')[0] || '',
                        horario:  (partida.split('T')[1] || '').slice(0, 5),
                        timestamp: partida
                    },
                    chegada: {
                        data:     chegada.split('T')[0] || '',
                        horario:  (chegada.split('T')[1] || '').slice(0, 5),
                        timestamp: chegada
                    },
                    duracao: {
                        total: duracaoMin,
                        texto: `${Math.floor(duracaoMin / 60)}h ${duracaoMin % 60}min`
                    },
                    escalas:  routes.length - 1,
                    classe:   params.classe || 'economica',
                    preco:    { valor: preco, moeda: 'BRL', porPessoa: preco, taxas: 0, total: preco },
                    pontos:   pontosInfo ? {
                        quantidade: pontosInfo.pontos, programa: pontosInfo.programa,
                        taxaEmbarque: pontosInfo.taxaEmbarque, valorEquivalente: pontosInfo.pontos * pontosInfo.valorPonto
                    } : null,
                    assentos: it.availability?.seats || 9,
                    fonte:    'kiwi'
                });
            } catch (e) {
                console.error('Kiwi converter item:', e.message);
            }
        }

        return Array.from(vooMap.values());
    }

    // Converte "2026-07-22" → "22/07/2026" (formato Kiwi)
    _formatarData(dataStr) {
        if (!dataStr) return '';
        const [ano, mes, dia] = dataStr.split('-');
        return `${dia}/${mes}/${ano}`;
    }
}

module.exports = new KiwiService();
