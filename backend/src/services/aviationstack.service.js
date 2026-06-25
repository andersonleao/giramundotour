/**
 * GiraMundoTour - AviationStack API
 *
 * Voos reais em tempo real (100 req/mês grátis — plano free usa HTTP).
 * Retorna voos ativos/agendados para uma rota; preços são estimados
 * com base na distância pois a API não fornece tarifas.
 *
 * Registro grátis: https://aviationstack.com/
 * Configurar no .env: AVIATIONSTACK_KEY=<sua_chave>
 *
 * Nota: plano free só suporta HTTP, não HTTPS.
 */

const http = require('http');

class AviationstackService {
    constructor() {
        this.apiKey        = process.env.AVIATIONSTACK_KEY || '';
        this.host          = 'api.aviationstack.com';
        this._quotaEsgotada = false;
    }

    isConfigured() {
        return !!this.apiKey && !this._quotaEsgotada;
    }

    request(params) {
        if (this._quotaEsgotada) return Promise.resolve(null);
        return new Promise((resolve) => {
            const qs   = new URLSearchParams({ access_key: this.apiKey, limit: '100', ...params });
            const path = `/v1/flights?${qs.toString()}`;

            const options = {
                hostname: this.host,
                path,
                method:  'GET',
                headers: { 'Accept': 'application/json' }
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode === 429 || (json.error && json.error.code === 104)) {
                            console.warn('⛔ AviationStack: quota mensal esgotada — desabilitado até próximo deploy');
                            this._quotaEsgotada = true;
                            resolve(null);
                        } else if (res.statusCode !== 200 || json.error) {
                            console.error(`❌ AviationStack [${res.statusCode}]:`, json.error?.message || '');
                            resolve(null);
                        } else {
                            resolve(json);
                        }
                    } catch (e) {
                        console.error('❌ AviationStack parse error:', e.message);
                        resolve(null);
                    }
                });
            });

            req.setTimeout(8000, () => { req.destroy(); resolve(null); });
            req.on('error', (e) => {
                console.error('❌ AviationStack request error:', e.message);
                resolve(null);
            });
            req.end();
        });
    }

    async buscarVoos(params) {
        if (!this.isConfigured()) {
            console.log('⚠️ AviationStack: AVIATIONSTACK_KEY não configurada');
            return null;
        }

        try {
            const resultado = { ida: [], volta: [] };

            const idaVoos = await this._buscarTrecho({
                origem:  params.origem,
                destino: params.destino,
                data:    params.dataIda,
                classe:  params.classe || 'economica'
            });
            resultado.ida = idaVoos.map(v => ({ ...v, tipo: 'ida' }));
            console.log(`✅ AviationStack: ${resultado.ida.length} voos de ida (${params.origem}→${params.destino})`);

            if (params.dataVolta) {
                const voltaVoos = await this._buscarTrecho({
                    origem:  params.destino,
                    destino: params.origem,
                    data:    params.dataVolta,
                    classe:  params.classe || 'economica'
                });
                resultado.volta = voltaVoos.map(v => ({ ...v, tipo: 'volta' }));
                console.log(`✅ AviationStack: ${resultado.volta.length} voos de volta (${params.destino}→${params.origem})`);
            }

            return resultado;
        } catch (e) {
            console.error('❌ AviationStack buscarVoos:', e.message);
            return null;
        }
    }

    async _buscarTrecho({ origem, destino, data, classe }) {
        // Busca voos ativos/agendados na rota. Sem filtro de data no plano free
        // (a API retorna voos do dia atual); usamos os resultados como template
        // de horários reais para qualquer data solicitada.
        const response = await this.request({ dep_iata: origem, arr_iata: destino });
        if (!response || !Array.isArray(response.data) || response.data.length === 0) {
            console.log(`⚠️ AviationStack: sem voos para ${origem}→${destino}`);
            return [];
        }

        return this._converter(response.data, { origem, destino, data, classe });
    }

    _converter(flights, { origem, destino, data, classe }) {
        const flightSearchService = require('./flightSearch.service');
        const seen  = new Set();
        const out   = [];

        const distKm     = flightSearchService.calcularDistanciaAproximada(origem, destino);
        const multClasse = classe === 'executiva' ? 2.5 : classe === 'primeira' ? 4 : 1;
        const precoBase  = 200 + distKm * 0.15;

        for (const f of flights) {
            try {
                const cia       = String(f.airline?.iata || '').toUpperCase();
                const flightNum = String(f.flight?.iata  || '').toUpperCase();
                if (!cia || !flightNum) continue;

                // Deduplicar pelo número do voo (mesmo voo aparece múltiplas vezes por codeshare)
                if (seen.has(flightNum)) continue;
                seen.add(flightNum);

                // Horários reais da API (aplica à data solicitada)
                const depRaw  = f.departure?.scheduled || '';
                const arrRaw  = f.arrival?.scheduled   || '';
                const depTime = depRaw ? depRaw.slice(11, 16) : '08:00';
                const arrTime = arrRaw ? arrRaw.slice(11, 16) : '09:00';

                // Duração em minutos
                let duration = 0;
                if (depRaw && arrRaw) {
                    duration = Math.round((new Date(arrRaw) - new Date(depRaw)) / 60000);
                    if (duration < 0) duration += 24 * 60; // voo passa da meia-noite
                }

                const diasAMais   = duration > 0 ? Math.floor(duration / (24 * 60)) : 0;
                const dataChegada = diasAMais > 0 ? flightSearchService.adicionarDias(data, diasAMais) : data;

                // Preço estimado com variação determinística por número de voo
                const seed  = flightNum.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
                const var1  = ((seed % 40) - 20) / 100; // ±20%
                const preco = Math.round(precoBase * multClasse * (1 + var1) * 100) / 100;

                const pontosInfo = flightSearchService.calcularPontos(preco, cia);

                out.push({
                    id:        `AS-${flightNum}-${data}`,
                    companhia: {
                        codigo: cia,
                        nome:   f.airline?.name || flightSearchService.getNomeCompanhia(cia) || cia,
                        cor:    flightSearchService.getCorCompanhia(cia)
                    },
                    numero: flightNum,
                    origem: {
                        codigo: origem,
                        ...flightSearchService.aeroportosBR[origem] || { cidade: f.departure?.airport || origem, nome: '', uf: '' }
                    },
                    destino: {
                        codigo: destino,
                        ...flightSearchService.aeroportosBR[destino] || { cidade: f.arrival?.airport || destino, nome: '', uf: '' }
                    },
                    partida: {
                        data:      data || '',
                        horario:   depTime,
                        timestamp: data ? `${data}T${depTime}:00` : ''
                    },
                    chegada: {
                        data:      dataChegada || '',
                        horario:   arrTime,
                        timestamp: dataChegada ? `${dataChegada}T${arrTime}:00` : ''
                    },
                    duracao: {
                        total: duration,
                        texto: duration > 0 ? `${Math.floor(duration / 60)}h ${duration % 60}min` : ''
                    },
                    escalas:  0,
                    classe:   classe || 'economica',
                    preco: {
                        valor:     preco,
                        moeda:     'BRL',
                        porPessoa: preco,
                        taxas:     52.05,
                        total:     preco + 52.05
                    },
                    pontos: pontosInfo ? {
                        quantidade:       pontosInfo.pontos,
                        programa:         pontosInfo.programa,
                        taxaEmbarque:     pontosInfo.taxaEmbarque,
                        valorEquivalente: pontosInfo.pontos * pontosInfo.valorPonto
                    } : null,
                    assentos: 9,
                    fonte:    'aviationstack'
                });
            } catch (e) {
                console.error('AviationStack converter flight:', e.message);
            }
        }

        out.sort((a, b) => a.preco.valor - b.preco.valor);
        return out;
    }
}

module.exports = new AviationstackService();
