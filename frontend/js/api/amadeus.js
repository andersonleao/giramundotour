// GiraMundoTour - Integração API Amadeus

const AmadeusApi = {
    token: null,
    tokenExpiry: null,

    /**
     * Obtém token de autenticação
     * @returns {Promise<string>} Token de acesso
     */
    async getToken() {
        // Verifica se já tem token válido
        if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.token;
        }

        const { apiKey, apiSecret, baseUrl, tokenEndpoint } = CONFIG.amadeus;

        if (!apiKey || !apiSecret) {
            throw new Error('API Amadeus não configurada. Configure as credenciais em config.js');
        }

        try {
            debugLog('AmadeusApi: Obtendo token de autenticação');

            const response = await fetch(`${baseUrl}${tokenEndpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: apiKey,
                    client_secret: apiSecret
                })
            });

            if (!response.ok) {
                throw new Error(`Erro de autenticação: ${response.status}`);
            }

            const data = await response.json();
            this.token = data.access_token;
            // Token expira em 30 minutos, renovamos em 25 para segurança
            this.tokenExpiry = Date.now() + (25 * 60 * 1000);

            debugLog('AmadeusApi: Token obtido com sucesso');
            return this.token;

        } catch (error) {
            console.error('AmadeusApi: Erro ao obter token', error);
            throw error;
        }
    },

    /**
     * Busca voos na API Amadeus
     * @param {object} params - Parâmetros da busca
     * @returns {Promise<object>} Resultados da busca
     */
    async searchFlights(params) {
        const { origem, destino, dataIda, dataVolta, passageiros, classe } = params;

        try {
            const token = await this.getToken();

            // Monta parâmetros da requisição
            const queryParams = new URLSearchParams({
                originLocationCode: origem,
                destinationLocationCode: destino,
                departureDate: dataIda,
                adults: passageiros.adultos || 1,
                currencyCode: 'BRL',
                max: CONFIG.busca.maxResultados
            });

            if (dataVolta) {
                queryParams.append('returnDate', dataVolta);
            }

            if (passageiros.criancas > 0) {
                queryParams.append('children', passageiros.criancas);
            }

            if (passageiros.bebes > 0) {
                queryParams.append('infants', passageiros.bebes);
            }

            // Mapeia classe para código IATA
            const classeCodigo = this.mapearClasse(classe);
            if (classeCodigo) {
                queryParams.append('travelClass', classeCodigo);
            }

            const url = `${CONFIG.amadeus.baseUrl}${CONFIG.amadeus.flightOffersEndpoint}?${queryParams}`;

            debugLog('AmadeusApi: Buscando voos', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.errors?.[0]?.detail || `Erro na busca: ${response.status}`);
            }

            const data = await response.json();
            return this.transformarResultados(data, passageiros);

        } catch (error) {
            console.error('AmadeusApi: Erro na busca de voos', error);
            throw error;
        }
    },

    /**
     * Transforma resultados da API para formato interno
     * @param {object} data - Dados da API
     * @param {object} passageiros - Info de passageiros
     * @returns {object} Resultados formatados
     */
    transformarResultados(data, passageiros) {
        const voosIda = [];
        const voosVolta = [];

        if (!data.data || data.data.length === 0) {
            return { ida: [], volta: [], passageiros, moeda: 'BRL' };
        }

        data.data.forEach(offer => {
            // Cada offer pode ter múltiplos itinerários (ida e volta)
            offer.itineraries.forEach((itinerary, index) => {
                const voo = this.transformarItinerario(itinerary, offer, index);

                if (index === 0) {
                    voosIda.push(voo);
                } else {
                    voosVolta.push(voo);
                }
            });
        });

        return {
            ida: voosIda,
            volta: voosVolta,
            passageiros,
            moeda: 'BRL'
        };
    },

    /**
     * Transforma um itinerário para formato interno
     */
    transformarItinerario(itinerary, offer, index) {
        const segments = itinerary.segments;
        const primeiroSegmento = segments[0];
        const ultimoSegmento = segments[segments.length - 1];

        const companhiaCode = primeiroSegmento.carrierCode;
        const companhia = getAirlineByCode(companhiaCode);

        // Calcula duração total em minutos
        const duracao = this.parseDuracao(itinerary.duration);

        // Preço por passageiro
        const preco = parseFloat(offer.price.total) / (index === 0 ? 1 : 2);

        return {
            id: Storage.generateId(),
            tipo: index === 0 ? 'ida' : 'volta',
            companhia: companhiaCode,
            companhiaNome: companhia?.name || companhiaCode,
            companhiaCor: companhia?.color || '#1a365d',
            numeroVoo: `${primeiroSegmento.carrierCode}${primeiroSegmento.number}`,
            origem: primeiroSegmento.departure.iataCode,
            destino: ultimoSegmento.arrival.iataCode,
            dataPartida: primeiroSegmento.departure.at,
            dataChegada: ultimoSegmento.arrival.at,
            duracao,
            escalas: segments.length - 1,
            classe: offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin?.toLowerCase() || 'economica',
            preco: Math.round(preco),
            precoTotal: Math.round(parseFloat(offer.price.total)),
            assentosDisponiveis: offer.numberOfBookableSeats || 9,
            bagagem: this.extrairInfoBagagem(offer),
            reembolsavel: offer.pricingOptions?.refundableFare || false,
            segmentos: segments.map(s => ({
                companhia: s.carrierCode,
                numeroVoo: `${s.carrierCode}${s.number}`,
                origem: s.departure.iataCode,
                destino: s.arrival.iataCode,
                partida: s.departure.at,
                chegada: s.arrival.at,
                duracao: this.parseDuracao(s.duration)
            }))
        };
    },

    /**
     * Converte duração ISO 8601 para minutos
     * @param {string} duration - Duração no formato PT2H30M
     * @returns {number} Duração em minutos
     */
    parseDuracao(duration) {
        if (!duration) return 0;

        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
        if (!match) return 0;

        const horas = parseInt(match[1] || 0);
        const minutos = parseInt(match[2] || 0);

        return horas * 60 + minutos;
    },

    /**
     * Mapeia classe interna para código IATA
     */
    mapearClasse(classe) {
        const mapa = {
            'economica': 'ECONOMY',
            'executiva': 'BUSINESS',
            'primeira': 'FIRST'
        };
        return mapa[classe];
    },

    /**
     * Extrai informações de bagagem
     */
    extrairInfoBagagem(offer) {
        try {
            const bagagem = offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.includedCheckedBags;
            if (bagagem) {
                if (bagagem.weight) {
                    return `${bagagem.quantity || 1} x ${bagagem.weight}${bagagem.weightUnit}`;
                }
                return `${bagagem.quantity || 0} malas`;
            }
        } catch {
            // Ignora erros
        }
        return 'Consultar';
    },

    /**
     * Busca aeroportos/cidades
     * @param {string} keyword - Termo de busca
     * @returns {Promise<Array>} Lista de locais
     */
    async searchLocations(keyword) {
        if (!keyword || keyword.length < 2) return [];

        try {
            const token = await this.getToken();

            const queryParams = new URLSearchParams({
                subType: 'AIRPORT,CITY',
                keyword: keyword,
                'page[limit]': 10
            });

            const url = `${CONFIG.amadeus.baseUrl}${CONFIG.amadeus.locationsEndpoint}?${queryParams}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Erro na busca: ${response.status}`);
            }

            const data = await response.json();

            return data.data.map(loc => ({
                code: loc.iataCode,
                name: loc.name,
                city: loc.address?.cityName || loc.name,
                country: loc.address?.countryName || '',
                countryCode: loc.address?.countryCode || ''
            }));

        } catch (error) {
            console.error('AmadeusApi: Erro na busca de locais', error);
            return [];
        }
    }
};

// Exportar para uso global
window.AmadeusApi = AmadeusApi;
