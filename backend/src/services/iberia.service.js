/**
 * GiraMundoTour - Iberia Developer API
 *
 * API oficial da Iberia para busca de voos reais (inclui codeshares Oneworld).
 * Registro gratuito: https://developer.iberia.com
 *
 * Configurar no .env:
 *   IBERIA_CLIENT_ID=<client_id>
 *   IBERIA_CLIENT_SECRET=<client_secret>
 *
 * Auth: OAuth2 client_credentials
 *   POST https://api.iberia.com/web/auth/connect/token
 *   scope=op.sign_on
 *
 * Endpoint de busca:
 *   GET https://api.iberia.com/sales/v1/flightAvailability
 */

const https = require('https');

class IberiaService {
    constructor() {
        this.clientId     = process.env.IBERIA_CLIENT_ID     || '';
        this.clientSecret = process.env.IBERIA_CLIENT_SECRET || '';
        this.host         = 'api.iberia.com';
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

        const body = new URLSearchParams({
            grant_type:    'client_credentials',
            client_id:     this.clientId,
            client_secret: this.clientSecret,
            scope:         'op.sign_on'
        }).toString();

        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.host,
                path:     '/web/auth/connect/token',
                method:   'POST',
                headers: {
                    'Content-Type':   'application/x-www-form-urlencoded',
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
                            return reject(new Error(`Iberia auth error ${res.statusCode}: ${json.error_description || json.message || ''}`));
                        }
                        this.token       = json.access_token;
                        this.tokenExpiry = Date.now() + (json.expires_in || 3600) * 1000;
                        resolve(this.token);
                    } catch (e) {
                        reject(new Error('Iberia auth parse error: ' + e.message));
                    }
                });
            });

            req.setTimeout(10000, () => { req.destroy(); reject(new Error('Iberia auth timeout')); });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }

    // -------------------------------------------------------
    //  HTTP GET autenticado
    // -------------------------------------------------------

    async request(path, token) {
        return new Promise((resolve) => {
            const options = {
                hostname: this.host,
                path,
                method:   'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept':        'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode !== 200) {
                            console.error(`❌ Iberia API [${res.statusCode}]:`, json.message || JSON.stringify(json).slice(0, 200));
                            resolve(null);
                        } else {
                            resolve(json);
                        }
                    } catch (e) {
                        console.error('❌ Iberia parse error:', e.message);
                        resolve(null);
                    }
                });
            });

            req.setTimeout(12000, () => { req.destroy(); resolve(null); });
            req.on('error', (e) => {
                console.error('❌ Iberia request error:', e.message);
                resolve(null);
            });
            req.end();
        });
    }

    // -------------------------------------------------------
    //  BUSCA DE VOOS
    // -------------------------------------------------------

    async buscarVoos(params) {
        if (!this.isConfigured()) {
            console.log('⚠️ Iberia: IBERIA_CLIENT_ID / IBERIA_CLIENT_SECRET não configurados');
            return null;
        }

        try {
            const token = await this.getToken();
            const resultado = { ida: [], volta: [] };

            resultado.ida = await this._buscarTrecho(params, token, 'ida');
            console.log(`✅ Iberia: ${resultado.ida.length} voos de ida`);

            if (params.dataVolta) {
                resultado.volta = await this._buscarTrecho({
                    ...params,
                    origem:  params.destino,
                    destino: params.origem,
                    dataIda: params.dataVolta
                }, token, 'volta');
                console.log(`✅ Iberia: ${resultado.volta.length} voos de volta`);
            }

            return resultado;
        } catch (e) {
            console.error('❌ Iberia buscarVoos:', e.message);
            return null;
        }
    }

    async _buscarTrecho(params, token, tipo) {
        const cabinMap = { executiva: 'C', primeira: 'F' };
        const cabin    = cabinMap[params.classe] || 'Y';

        // Data no formato DDMMMYY exigido pela Iberia (ex: 22JUL26)
        const outboundDate = this._formatarData(params.dataIda);

        const qp = new URLSearchParams({
            origin:        params.origem,
            destination:   params.destino,
            outboundDate,
            ADT:           String(params.adultos  || 1),
            CHD:           String(params.criancas || 0),
            INF:           String(params.bebes    || 0),
            cabin,
            lang:          'PT',
            currency:      'BRL'
        });

        const path = `/sales/v1/flightAvailability?${qp.toString()}`;
        console.log('🔍 Iberia flightAvailability:', path);

        const response = await this.request(path, token);
        if (!response) return [];

        return this._converter(response, params, tipo);
    }

    // -------------------------------------------------------
    //  CONVERSÃO → formato interno
    // -------------------------------------------------------

    _converter(response, params, tipo) {
        const flightSearchService = require('./flightSearch.service');
        const vooMap = new Map();

        // A Iberia API retorna { flightoffers: [...] } ou { data: [...] }
        const offers = response.flightoffers || response.data || response.flights || [];
        if (!Array.isArray(offers) || offers.length === 0) return [];

        for (const offer of offers) {
            try {
                const preco = parseFloat(
                    offer.price?.totalAmount ||
                    offer.totalAmount ||
                    offer.price?.amount ||
                    0
                );
                if (!preco) continue;

                // Segmentos do itinerário
                const segments = offer.segments || offer.legs || offer.flightSegments || [];
                if (segments.length === 0) continue;

                const first = segments[0];
                const last  = segments[segments.length - 1];

                // Campos de partida/chegada
                const partida = first.departureDate || first.departure?.dateTime || first.departureDateTime || '';
                const chegada = last.arrivalDate    || last.arrival?.dateTime    || last.arrivalDateTime    || '';

                const carrierCode = first.marketingCarrier || first.carrier || first.airlineCode || 'IB';
                const flightNum   = first.marketingFlightNumber || first.flightNumber || first.number || '';

                // Chave de deduplicação
                const chave = `${carrierCode}${flightNum}@${partida}`;
                if (vooMap.has(chave) && vooMap.get(chave).preco.valor <= preco) continue;

                const cia     = carrierCode;
                const ciaNome = flightSearchService.getNomeCompanhia(cia) || 'Iberia';

                const partTs  = this._normalizeDateTime(partida);
                const chegaTs = this._normalizeDateTime(chegada);

                const partData  = partTs.split('T')[0] || params.dataIda;
                const chegaData = chegaTs.split('T')[0] || partData;
                const partHora  = (partTs.split('T')[1] || '').slice(0, 5);
                const chegaHora = (chegaTs.split('T')[1] || '').slice(0, 5);

                const duracaoMin = this._calcDuracao(partTs, chegaTs) ||
                    parseInt(offer.duration || offer.totalDuration || 0, 10);

                const origemCode  = first.departureAirport  || first.origin?.code      || first.origin      || params.origem;
                const destinoCode = last.arrivalAirport     || last.destination?.code  || last.destination  || params.destino;

                const pontosInfo = flightSearchService.calcularPontos(preco, cia);

                vooMap.set(chave, {
                    id:        `IB-${chave.replace(/[^a-zA-Z0-9]/g, '')}`,
                    companhia: {
                        codigo: cia,
                        nome:   ciaNome,
                        cor:    flightSearchService.getCorCompanhia(cia)
                    },
                    numero: `${carrierCode}${flightNum}`,
                    origem: {
                        codigo: origemCode,
                        ...flightSearchService.aeroportosBR[origemCode] || { cidade: origemCode, nome: '', uf: '' }
                    },
                    destino: {
                        codigo: destinoCode,
                        ...flightSearchService.aeroportosBR[destinoCode] || { cidade: destinoCode, nome: '', uf: '' }
                    },
                    partida: {
                        data:      partData,
                        horario:   partHora,
                        timestamp: partTs
                    },
                    chegada: {
                        data:      chegaData,
                        horario:   chegaHora,
                        timestamp: chegaTs
                    },
                    duracao: {
                        total: duracaoMin,
                        texto: duracaoMin > 0 ? `${Math.floor(duracaoMin / 60)}h ${duracaoMin % 60}min` : ''
                    },
                    escalas: segments.length - 1,
                    classe:  params.classe || 'economica',
                    preco: {
                        valor:     preco,
                        moeda:     'BRL',
                        porPessoa: preco,
                        taxas:     parseFloat(offer.price?.taxAmount || offer.taxAmount || 0),
                        total:     preco
                    },
                    pontos: pontosInfo ? {
                        quantidade:       pontosInfo.pontos,
                        programa:         pontosInfo.programa,
                        taxaEmbarque:     pontosInfo.taxaEmbarque,
                        valorEquivalente: pontosInfo.pontos * pontosInfo.valorPonto
                    } : null,
                    assentos: parseInt(offer.seatsAvailable || offer.availableSeats || 9, 10),
                    tipo,
                    fonte: 'iberia',
                    segmentos: segments.length > 1 ? segments.map(s => ({
                        companhia:  s.marketingCarrier || s.carrier || s.airlineCode || 'IB',
                        numeroVoo:  `${s.marketingCarrier || s.carrier || 'IB'}${s.marketingFlightNumber || s.flightNumber || ''}`,
                        origem:     s.departureAirport  || s.origin?.code      || s.origin      || '',
                        destino:    s.arrivalAirport    || s.destination?.code || s.destination || '',
                        partida:    this._normalizeDateTime(s.departureDate || s.departure?.dateTime || ''),
                        chegada:    this._normalizeDateTime(s.arrivalDate   || s.arrival?.dateTime   || ''),
                        duracao:    parseInt(s.duration || s.flightDuration || 0, 10)
                    })) : undefined
                });
            } catch (e) {
                console.error('Iberia converter item:', e.message);
            }
        }

        const out = Array.from(vooMap.values());
        out.sort((a, b) => a.preco.valor - b.preco.valor);
        return out;
    }

    // -------------------------------------------------------
    //  UTILITÁRIOS
    // -------------------------------------------------------

    // Converte "2026-07-22" → "22JUL26" (formato Iberia)
    _formatarData(dataStr) {
        if (!dataStr) return '';
        const meses = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const [ano, mes, dia] = dataStr.split('-').map(Number);
        return `${String(dia).padStart(2,'0')}${meses[mes - 1]}${String(ano).slice(-2)}`;
    }

    // Normaliza diferentes formatos de datetime para ISO sem timezone
    _normalizeDateTime(dt) {
        if (!dt) return '';
        if (/^\d{4}-\d{2}-\d{2}T/.test(dt)) return dt.slice(0, 16) + ':00';
        if (/^\d{4}-\d{2}-\d{2} /.test(dt)) return dt.replace(' ', 'T').slice(0, 16) + ':00';
        return dt;
    }

    // Calcula duração em minutos entre dois timestamps ISO
    _calcDuracao(partida, chegada) {
        try {
            const tP = new Date(partida).getTime();
            const tC = new Date(chegada).getTime();
            if (isNaN(tP) || isNaN(tC) || tC <= tP) return 0;
            return Math.round((tC - tP) / 60000);
        } catch {
            return 0;
        }
    }
}

module.exports = new IberiaService();
