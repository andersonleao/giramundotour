/**
 * GiraMundoTour - Travelpayouts (Aviasales Data API)
 *
 * API gratuita com dados reais de voos. Cobre LATAM, Azul, GOL e cias internacionais.
 * Registro: https://www.travelpayouts.com/
 *
 * Configurar no .env:
 *   TRAVELPAYOUTS_TOKEN=<seu_token>
 *   TRAVELPAYOUTS_MARKER=<seu_marker>   # opcional, usado nos links de afiliado
 *
 * Endpoint usado: GET /aviasales/v3/prices_for_dates
 *   Doc: https://support.travelpayouts.com/hc/en-us/articles/203956163
 */

const https = require('https');

class TravelpayoutsService {
    constructor() {
        this.token   = process.env.TRAVELPAYOUTS_TOKEN  || '';
        this.marker  = process.env.TRAVELPAYOUTS_MARKER || '';
        this.host    = 'api.travelpayouts.com';
    }

    isConfigured() {
        return !!this.token;
    }

    request(path) {
        return new Promise((resolve) => {
            const options = {
                hostname: this.host,
                path,
                method: 'GET',
                headers: {
                    'X-Access-Token': this.token,
                    'Accept': 'application/json'
                }
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode !== 200 || json.success === false) {
                            console.error(`❌ Travelpayouts [${res.statusCode}]:`, json.error || json.message || JSON.stringify(json).slice(0, 200));
                            resolve(null);
                        } else {
                            resolve(json);
                        }
                    } catch (e) {
                        console.error('❌ Travelpayouts parse error:', e.message);
                        resolve(null);
                    }
                });
            });
            req.setTimeout(10000, () => { req.destroy(); resolve(null); });
            req.on('error', (e) => {
                console.error('❌ Travelpayouts request error:', e.message);
                resolve(null);
            });
            req.end();
        });
    }

    async buscarVoos(params) {
        if (!this.isConfigured()) {
            console.log('⚠️ Travelpayouts: TRAVELPAYOUTS_TOKEN não configurado');
            return null;
        }

        try {
            const resultado = { ida: [], volta: [] };

            const idaVoos = await this._buscarTrecho({
                origem:  params.origem,
                destino: params.destino,
                data:    params.dataIda
            });
            resultado.ida = idaVoos.map(v => ({ ...v, tipo: 'ida' }));
            console.log(`✅ Travelpayouts: ${resultado.ida.length} voos de ida`);

            if (params.dataVolta) {
                const voltaVoos = await this._buscarTrecho({
                    origem:  params.destino,
                    destino: params.origem,
                    data:    params.dataVolta
                });
                resultado.volta = voltaVoos.map(v => ({ ...v, tipo: 'volta' }));
                console.log(`✅ Travelpayouts: ${resultado.volta.length} voos de volta`);
            }

            return resultado;
        } catch (e) {
            console.error('❌ Travelpayouts buscarVoos:', e.message);
            return null;
        }
    }

    async _buscarTrecho({ origem, destino, data }) {
        // Busca por mês para maximizar resultados em cache (depois filtramos ±7d)
        const mes = data ? data.substring(0, 7) : undefined; // YYYY-MM

        const qp = new URLSearchParams({
            origin:       origem,
            destination:  destino,
            currency:     'brl',
            market:       'br',
            sorting:      'price',
            direct:       'false',
            unique:       'false',
            one_way:      'true',
            limit:        '200',
            page:         '1',
            token:        this.token
        });
        if (mes) qp.set('departure_at', mes); // mês YYYY-MM retorna mais cache

        const path = `/aviasales/v3/prices_for_dates?${qp.toString()}`;
        console.log('🔍 Travelpayouts:', path.replace(this.token, '***'));

        const response = await this.request(path);
        if (!response || !Array.isArray(response.data)) return [];

        // Filtra voos dentro de ±7 dias da data solicitada
        const items = data ? this._filtrarPorData(response.data, data) : response.data;
        return this._converter(items, { origem, destino, data });
    }

    _filtrarPorData(items, dataAlvo) {
        if (!dataAlvo || !items.length) return items;
        const alvo = new Date(dataAlvo).getTime();
        const JANELA_MS = 7 * 24 * 60 * 60 * 1000; // ±7 dias

        const comData = items.filter(it => {
            if (!it.departure_at) return true;
            const diff = Math.abs(new Date(it.departure_at).getTime() - alvo);
            return diff <= JANELA_MS;
        });
        // Se nenhum resultado no período, retorna vazio (não expõe dados de outros meses)
        return comData;
    }

    _converter(items, params) {
        const flightSearchService = require('./flightSearch.service');
        const out = [];

        // data pesquisada pelo usuário — usada para normalizar as datas de exibição
        const dataBase = params.data || '';

        for (const it of items) {
            try {
                const preco = parseFloat(it.price || it.value || 0);
                if (!preco) continue;

                const carrierCode = String(it.airline || '').toUpperCase();
                const iataMap = { JJ: 'LA' };
                const cia = iataMap[carrierCode] || carrierCode;
                const ciaNome = flightSearchService.getNomeCompanhia(cia) || cia;

                const partidaRaw = it.departure_at || '';
                const duracaoMin = parseInt(it.duration_to || it.duration || 0, 10);

                // Horário de partida vem do cache da API; a DATA é sempre a pesquisada pelo usuário
                const partidaHorario = (partidaRaw.split('T')[1] || '').slice(0, 5);
                const partidaData    = dataBase || partidaRaw.split('T')[0] || '';
                const partidaTs      = partidaData && partidaHorario ? `${partidaData}T${partidaHorario}:00` : partidaRaw;

                // Calcula chegada a partir da duração (arrival_at raramente vem da API)
                let chegadaData = partidaData;
                let chegadaHorario = '';
                let chegadaTs = '';
                if (it.arrival_at) {
                    // arrival_at disponível: usa horário real, mas ancora a data na pesquisada
                    chegadaHorario = (it.arrival_at.split('T')[1] || '').slice(0, 5);
                    chegadaData    = partidaData; // mesmo dia; se passar da meia-noite, corrige abaixo
                    if (chegadaHorario < partidaHorario) {
                        chegadaData = flightSearchService.adicionarDias(partidaData, 1);
                    }
                    chegadaTs = `${chegadaData}T${chegadaHorario}:00`;
                } else if (partidaTs && duracaoMin > 0) {
                    try {
                        const pad = n => String(n).padStart(2, '0');
                        const [dH, dM] = partidaHorario.split(':').map(Number);
                        const totalMin  = (dH || 0) * 60 + (dM || 0) + duracaoMin;
                        const arrH      = Math.floor(totalMin / 60) % 24;
                        const arrM      = totalMin % 60;
                        const diasAMais = Math.floor(totalMin / (24 * 60));
                        chegadaData    = diasAMais > 0 ? flightSearchService.adicionarDias(partidaData, diasAMais) : partidaData;
                        chegadaHorario = `${pad(arrH)}:${pad(arrM)}`;
                        chegadaTs      = `${chegadaData}T${chegadaHorario}:00`;
                    } catch (e) {
                        chegadaData = partidaData;
                        chegadaTs   = partidaTs;
                    }
                } else {
                    chegadaTs = partidaTs;
                }

                const origemCode  = it.origin_airport      || it.origin      || params.origem;
                const destinoCode = it.destination_airport || it.destination || params.destino;

                const pontosInfo = flightSearchService.calcularPontos(preco, cia);

                const link = it.link
                    ? `https://www.aviasales.com${it.link}${this.marker ? (it.link.includes('?') ? '&' : '?') + 'marker=' + this.marker : ''}`
                    : null;

                out.push({
                    id:        `TP-${origemCode}-${destinoCode}-${carrierCode}${it.flight_number || ''}-${partidaHorario}`,
                    companhia: {
                        codigo: cia,
                        nome:   ciaNome,
                        cor:    flightSearchService.getCorCompanhia(cia)
                    },
                    numero:    `${carrierCode}${it.flight_number || ''}`,
                    origem: {
                        codigo: origemCode,
                        ...flightSearchService.aeroportosBR[origemCode] || { cidade: origemCode, nome: '', uf: '' }
                    },
                    destino: {
                        codigo: destinoCode,
                        ...flightSearchService.aeroportosBR[destinoCode] || { cidade: destinoCode, nome: '', uf: '' }
                    },
                    partida: {
                        data:      partidaData,
                        horario:   partidaHorario,
                        timestamp: partidaTs
                    },
                    chegada: {
                        data:      chegadaData,
                        horario:   chegadaHorario,
                        timestamp: chegadaTs
                    },
                    duracao: {
                        total: duracaoMin,
                        texto: duracaoMin > 0 ? `${Math.floor(duracaoMin / 60)}h ${duracaoMin % 60}min` : ''
                    },
                    escalas:  parseInt(it.transfers || 0, 10),
                    classe:   'economica',
                    preco:    { valor: preco, moeda: 'BRL', porPessoa: preco, taxas: 0, total: preco },
                    pontos:   pontosInfo ? {
                        quantidade:        pontosInfo.pontos,
                        programa:          pontosInfo.programa,
                        taxaEmbarque:      pontosInfo.taxaEmbarque,
                        valorEquivalente:  pontosInfo.pontos * pontosInfo.valorPonto
                    } : null,
                    assentos: 9,
                    link,
                    fonte:    'travelpayouts'
                });
            } catch (e) {
                console.error('Travelpayouts converter item:', e.message);
            }
        }

        out.sort((a, b) => a.preco.valor - b.preco.valor);
        return out;
    }
}

module.exports = new TravelpayoutsService();
