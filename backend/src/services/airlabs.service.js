/**
 * GiraMundoTour - Airlabs Routes API
 *
 * Retorna rotas reais (voos, horários, cias) entre dois aeroportos.
 * Preços são estimados com base na distância — os dados de voo (número,
 * horário, companhia) são reais.
 *
 * Registro grátis (1.000 req/mês): https://airlabs.co/
 * Configurar no .env: AIRLABS_API_KEY=<sua_chave>
 */

const https = require('https');

// Hubs para itinerários com 1 conexão — somente os 3 maiores do Brasil
// (reduz de ~22 chamadas/busca para ~8, preservando a cota gratuita de 1.000 req/mês)
const HUBS_CONEXAO = ['GRU', 'BSB', 'SSA'];

// Conexão mínima 90 min (internacional) e máxima 6h
const CONN_MIN_MIN = 90;
const CONN_MAX_MIN = 360;


class AirlabsService {
    constructor() {
        this.apiKey = process.env.AIRLABS_API_KEY || '';
        this.host   = 'airlabs.co';
        this._cache = new Map();
    }

    isConfigured() {
        return !!this.apiKey;
    }

    request(endpointAndParams) {
        return new Promise((resolve) => {
            const path = `/api/v9/${endpointAndParams}&api_key=${this.apiKey}`;
            const options = {
                hostname: this.host,
                path,
                method:  'GET',
                headers: { 'Accept': 'application/json' }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode !== 200 || json.error) {
                            console.error(`❌ Airlabs [${res.statusCode}]:`, json.error?.message || '');
                            resolve(null);
                        } else {
                            resolve(json);
                        }
                    } catch (e) {
                        console.error('❌ Airlabs parse error:', e.message);
                        resolve(null);
                    }
                });
            });

            req.setTimeout(10000, () => { req.destroy(); resolve(null); });
            req.on('error', (e) => {
                console.error('❌ Airlabs request error:', e.message);
                resolve(null);
            });
            req.end();
        });
    }

    // Busca rotas com cache de sessão
    async _getRoutes(dep, arr) {
        const key = `${dep}-${arr}`;
        if (this._cache.has(key)) return this._cache.get(key);
        const response = await this.request(`routes?dep_iata=${dep}&arr_iata=${arr}`);
        const routes = (response && Array.isArray(response.response)) ? response.response : [];
        this._cache.set(key, routes);
        return routes;
    }

    async buscarVoos(params) {
        if (!this.isConfigured()) {
            console.log('⚠️ Airlabs: AIRLABS_API_KEY não configurada');
            return null;
        }

        try {
            const resultado = { ida: [], volta: [] };

            // Diretos + conexões em paralelo
            const [idaDiretos, idaConexoes] = await Promise.all([
                this._buscarTrecho({ origem: params.origem, destino: params.destino, data: params.dataIda,   classe: params.classe || 'economica' }),
                this._buscarConexoes({ origem: params.origem, destino: params.destino, data: params.dataIda,  classe: params.classe || 'economica' })
            ]);

            resultado.ida = this._deduplicarVoos([
                ...idaDiretos.map(v => ({ ...v, tipo: 'ida' })),
                ...idaConexoes.map(v => ({ ...v, tipo: 'ida' }))
            ]);
            console.log(`✅ Airlabs: ${resultado.ida.length} voos de ida (${params.origem}→${params.destino}) [diretos:${idaDiretos.length} conexoes:${idaConexoes.length}]`);

            if (params.dataVolta) {
                const [voltaDiretos, voltaConexoes] = await Promise.all([
                    this._buscarTrecho({ origem: params.destino, destino: params.origem, data: params.dataVolta, classe: params.classe || 'economica' }),
                    this._buscarConexoes({ origem: params.destino, destino: params.origem, data: params.dataVolta, classe: params.classe || 'economica' })
                ]);

                resultado.volta = this._deduplicarVoos([
                    ...voltaDiretos.map(v => ({ ...v, tipo: 'volta' })),
                    ...voltaConexoes.map(v => ({ ...v, tipo: 'volta' }))
                ]);
                console.log(`✅ Airlabs: ${resultado.volta.length} voos de volta (${params.destino}→${params.origem})`);
            }

            return resultado;
        } catch (e) {
            console.error('❌ Airlabs buscarVoos:', e.message);
            return null;
        }
    }

    async _buscarTrecho({ origem, destino, data, classe }) {
        const routes = await this._getRoutes(origem, destino);
        if (!routes.length) {
            console.log(`⚠️ Airlabs: sem rotas diretas para ${origem}→${destino}`);
            return [];
        }
        return this._converter(routes, { origem, destino, data, classe });
    }

    // Constrói itinerários com 1 escala via hubs brasileiros/regionais
    async _buscarConexoes({ origem, destino, data, classe }) {
        const flightSearchService = require('./flightSearch.service');
        const out = [];
        const seenCombos = new Set();

        // Busca todas as pernas possíveis em paralelo (origem→hub e hub→destino)
        const hubRequests = HUBS_CONEXAO
            .filter(h => h !== origem && h !== destino)
            .map(hub => Promise.all([
                this._getRoutes(origem, hub),
                this._getRoutes(hub, destino)
            ]).then(([leg1, leg2]) => ({ hub, leg1, leg2 })));

        const hubResults = await Promise.all(hubRequests);

        const multClasse = classe === 'executiva' ? 2.5 : classe === 'primeira' ? 4 : 1;

        for (const { hub, leg1, leg2 } of hubResults) {
            if (!leg1.length || !leg2.length) continue;

            const distKm1 = flightSearchService.calcularDistanciaAproximada(origem, hub);
            const distKm2 = flightSearchService.calcularDistanciaAproximada(hub, destino);

            // Agrupa por companhia e mantém até 3 horários por cia — garante representação de
            // todas as cias (incluindo LATAM/JJ que pode estar no final da lista Airlabs)
            const agruparPorCia = (routes) => {
                const porCia = new Map();
                for (const r of routes) {
                    const cia = String(r.airline_iata || '').toUpperCase();
                    if (!cia) continue;
                    if (!porCia.has(cia)) porCia.set(cia, []);
                    const lista = porCia.get(cia);
                    if (lista.length < 3) lista.push(r);
                }
                return Array.from(porCia.values()).flat();
            };

            const leg1Sel = agruparPorCia(leg1);
            const leg2Sel = agruparPorCia(leg2);

            for (const r1 of leg1Sel) {
                const dep1 = (r1.dep_time || '08:00').slice(0, 5);
                const dur1 = parseInt(r1.duration || 120, 10);
                const [h1, m1] = dep1.split(':').map(Number);
                const arrHubMin = h1 * 60 + m1 + dur1; // minutos desde meia-noite

                for (const r2 of leg2Sel) {
                    const dep2 = (r2.dep_time || '12:00').slice(0, 5);
                    const dur2 = parseInt(r2.duration || 120, 10);
                    const [h2, m2] = dep2.split(':').map(Number);

                    // Ajusta para o próximo dia se necessário
                    let dep2Min = h2 * 60 + m2;
                    if (dep2Min < arrHubMin) dep2Min += 24 * 60;

                    const connTime = dep2Min - arrHubMin;
                    if (connTime < CONN_MIN_MIN || connTime > CONN_MAX_MIN) continue;

                    const cia1 = String(r1.airline_iata || '').toUpperCase();
                    const cia2 = String(r2.airline_iata || '').toUpperCase();
                    const flightNum1 = (r1.flight_iata || `${cia1}${r1.flight_number || ''}`).toUpperCase();
                    const flightNum2 = (r2.flight_iata || `${cia2}${r2.flight_number || ''}`).toUpperCase();
                    if (!cia1 || !cia2) continue;

                    const comboKey = `${flightNum1}-${flightNum2}`;
                    if (seenCombos.has(comboKey)) continue;
                    seenCombos.add(comboKey);

                    // Preços estimados por perna
                    const seed1 = flightNum1.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
                    const seed2 = flightNum2.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
                    const preco1 = Math.round((200 + distKm1 * 0.15) * multClasse * (1 + ((seed1 % 40) - 20) / 100) * 100) / 100;
                    const preco2 = Math.round((200 + distKm2 * 0.15) * multClasse * (1 + ((seed2 % 40) - 20) / 100) * 100) / 100;
                    const precoTotal = Math.round((preco1 + preco2) * 100) / 100;

                    // Chegada final
                    const arrFinalMin = dep2Min + dur2;
                    const arrH = Math.floor(arrFinalMin / 60) % 24;
                    const arrM = arrFinalMin % 60;
                    const arrTime = `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`;
                    const diasAMais = Math.floor(arrFinalMin / (24 * 60));
                    const dataChegada = diasAMais > 0 ? flightSearchService.adicionarDias(data, diasAMais) : data;
                    const duracaoTotal = arrFinalMin - (h1 * 60 + m1);

                    // Companhia principal = da primeira perna
                    const ciaPrincipal = cia1;
                    const pontosInfo = flightSearchService.calcularPontos(precoTotal, ciaPrincipal);

                    const pad = n => String(n).padStart(2, '0');
                    const arrHubH = Math.floor(arrHubMin / 60) % 24;
                    const arrHubM = arrHubMin % 60;

                    out.push({
                        id: `AL-CNX-${flightNum1}-${flightNum2}-${data}`,
                        companhia: {
                            codigo: ciaPrincipal,
                            nome:   flightSearchService.getNomeCompanhia(ciaPrincipal) || ciaPrincipal,
                            cor:    flightSearchService.getCorCompanhia(ciaPrincipal)
                        },
                        numero: flightNum1,
                        origem: {
                            codigo: origem,
                            ...flightSearchService.aeroportosBR[origem] || { cidade: origem, nome: '', uf: '' }
                        },
                        destino: {
                            codigo: destino,
                            ...flightSearchService.aeroportosBR[destino] || { cidade: destino, nome: '', uf: '' }
                        },
                        partida: {
                            data:      data || '',
                            horario:   dep1,
                            timestamp: data ? `${data}T${dep1}:00` : ''
                        },
                        chegada: {
                            data:      dataChegada || '',
                            horario:   arrTime,
                            timestamp: dataChegada ? `${dataChegada}T${arrTime}:00` : ''
                        },
                        duracao: {
                            total: duracaoTotal,
                            texto: duracaoTotal > 0 ? `${Math.floor(duracaoTotal / 60)}h ${duracaoTotal % 60}min` : ''
                        },
                        escalas:  1,
                        classe:   classe || 'economica',
                        preco: {
                            valor:     precoTotal,
                            moeda:     'BRL',
                            porPessoa: precoTotal,
                            taxas:     52.05,
                            total:     precoTotal + 52.05
                        },
                        pontos: pontosInfo ? {
                            quantidade:       pontosInfo.pontos,
                            programa:         pontosInfo.programa,
                            taxaEmbarque:     pontosInfo.taxaEmbarque,
                            valorEquivalente: pontosInfo.pontos * pontosInfo.valorPonto
                        } : null,
                        assentos: 9,
                        fonte:    'airlabs',
                        segmentos: [
                            {
                                companhia:  cia1,
                                numeroVoo:  flightNum1,
                                origem:     origem,
                                destino:    hub,
                                partida:    data ? `${data}T${dep1}:00` : dep1,
                                chegada:    data ? `${data}T${pad(arrHubH)}:${pad(arrHubM)}:00` : '',
                                duracao:    dur1
                            },
                            {
                                companhia:  cia2,
                                numeroVoo:  flightNum2,
                                origem:     hub,
                                destino:    destino,
                                partida:    data ? `${data}T${dep2}:00` : dep2,
                                chegada:    dataChegada ? `${dataChegada}T${arrTime}:00` : '',
                                duracao:    dur2
                            }
                        ]
                    });
                }
            }
        }

        out.sort((a, b) => a.preco.valor - b.preco.valor);
        console.log(`✅ Airlabs conexões: ${out.length} itinerários com escala para ${origem}→${destino}`);
        return out;
    }

    // Remove duplicatas pelo horário de partida + rota (codeshares do mesmo voo físico)
    _deduplicarVoos(voos) {
        const seen = new Map();
        for (const v of voos) {
            const key = `${v.origem?.codigo}-${v.destino?.codigo}-${v.partida?.horario}-${v.escalas}`;
            const existing = seen.get(key);
            if (!existing) {
                seen.set(key, v);
            } else if (v.escalas === 0 && existing.escalas === 0) {
                // Para diretos, manter apenas um por horário (preferir LA sobre JJ)
                const pref = ['LA', 'G3', 'AD'];
                const vPref  = pref.indexOf(v.companhia?.codigo);
                const exPref = pref.indexOf(existing.companhia?.codigo);
                if (vPref !== -1 && (exPref === -1 || vPref < exPref)) seen.set(key, v);
            }
        }
        return Array.from(seen.values()).sort((a, b) => a.preco.valor - b.preco.valor);
    }

    _converter(routes, { origem, destino, data, classe }) {
        const flightSearchService = require('./flightSearch.service');
        const out = [];

        const distKm      = flightSearchService.calcularDistanciaAproximada(origem, destino);
        const multClasse  = classe === 'executiva' ? 2.5 : classe === 'primeira' ? 4 : 1;
        const precoBaseKm = 200 + distKm * 0.15;

        for (const route of routes) {
            try {
                const cia       = String(route.airline_iata || '').toUpperCase();
                const flightNum = route.flight_iata || `${cia}${route.flight_number || ''}`;
                const depTime   = (route.dep_time || '08:00').slice(0, 5);
                const duration  = parseInt(route.duration || 0, 10);

                const [dH, dM] = depTime.split(':').map(Number);
                const totalMin  = dH * 60 + dM + duration;
                const arrH      = Math.floor(totalMin / 60) % 24;
                const arrM      = totalMin % 60;
                const arrTime   = `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`;
                const diasAMais = Math.floor(totalMin / (24 * 60));
                const dataChegada = diasAMais > 0 ? flightSearchService.adicionarDias(data, diasAMais) : data;

                const seed  = flightNum.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
                const preco = Math.round(precoBaseKm * multClasse * (1 + ((seed % 40) - 20) / 100) * 100) / 100;

                const pontosInfo = flightSearchService.calcularPontos(preco, cia);

                out.push({
                    id:        `AL-${flightNum}-${data}`,
                    companhia: {
                        codigo: cia,
                        nome:   flightSearchService.getNomeCompanhia(cia) || cia,
                        cor:    flightSearchService.getCorCompanhia(cia)
                    },
                    numero: flightNum,
                    origem: {
                        codigo: origem,
                        ...flightSearchService.aeroportosBR[origem] || { cidade: origem, nome: '', uf: '' }
                    },
                    destino: {
                        codigo: destino,
                        ...flightSearchService.aeroportosBR[destino] || { cidade: destino, nome: '', uf: '' }
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
                    escalas:  parseInt(route.stops || 0, 10),
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
                    fonte:    'airlabs'
                });
            } catch (e) {
                console.error('Airlabs converter route:', e.message);
            }
        }

        out.sort((a, b) => a.preco.valor - b.preco.valor);
        return out;
    }
}

module.exports = new AirlabsService();
