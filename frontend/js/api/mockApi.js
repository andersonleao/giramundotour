// GiraMundoTour - API Mock (Dados Simulados)

const MockApi = {
    /**
     * Gera voos simulados para uma busca
     * @param {object} params - Parâmetros da busca
     * @returns {Promise<Array>} Lista de voos
     */
    async searchFlights(params) {
        debugLog('MockApi: Buscando voos', params);

        // Simula delay de rede
        await this.delay(800 + Math.random() * 1200);

        const { origem, destino, dataIda, dataVolta, passageiros, classe } = params;

        // Gera voos de ida
        const voosIda = this.gerarVoos(origem, destino, dataIda, classe, 'ida');

        // Se tiver data de volta, gera voos de volta
        let voosVolta = [];
        if (dataVolta) {
            voosVolta = this.gerarVoos(destino, origem, dataVolta, classe, 'volta');
        }

        // Aplica multiplicador de passageiros
        const multiplicador = this.calcularMultiplicadorPassageiros(passageiros);

        voosIda.forEach(v => {
            v.precoTotal = v.preco * multiplicador;
        });

        voosVolta.forEach(v => {
            v.precoTotal = v.preco * multiplicador;
        });

        return {
            ida: voosIda,
            volta: voosVolta,
            passageiros,
            moeda: 'BRL'
        };
    },

    /**
     * Gera lista de voos simulados
     */
    gerarVoos(origem, destino, data, classe, tipo) {
        const numVoos = 10 + Math.floor(Math.random() * 8); // 10-17 voos
        const voos = [];

        // Companhias que operam na rota (simplificado)
        const companhias = this.getCompanhiasRota(origem, destino);

        for (let i = 0; i < numVoos; i++) {
            const companhia = companhias[Math.floor(Math.random() * companhias.length)];
            const voo = this.gerarVoo(origem, destino, data, classe, companhia, tipo);
            voos.push(voo);
        }

        // Ordena por preço
        voos.sort((a, b) => a.preco - b.preco);

        return voos;
    },

    /**
     * Gera um voo individual
     */
    gerarVoo(origem, destino, data, classe, companhiaCode, tipo) {
        const companhia = getAirlineByCode(companhiaCode) || {
            code: companhiaCode,
            name: companhiaCode,
            color: '#1a365d'
        };

        // Calcula distância aproximada e duração
        const distanciaInfo = this.calcularDistancia(origem, destino);
        const escalas = this.gerarEscalas(distanciaInfo.distancia);
        const duracao = this.calcularDuracao(distanciaInfo.distancia, escalas);

        // Gera horários
        const horaPartida = 5 + Math.floor(Math.random() * 17); // 5h às 22h
        const minutoPartida = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45

        const dataPartida = new Date(data);
        dataPartida.setHours(horaPartida, minutoPartida, 0, 0);

        const dataChegada = new Date(dataPartida.getTime() + duracao * 60000);

        // Gera preço base
        const precoBase = this.calcularPrecoBase(distanciaInfo.distancia, classe);

        // Variação de preço (±20%)
        const variacao = 0.8 + Math.random() * 0.4;
        const preco = Math.round(precoBase * variacao);

        // Gera número do voo
        const numeroVoo = companhia.code + Math.floor(1000 + Math.random() * 9000);

        return {
            id: Storage.generateId(),
            tipo,
            companhia: companhia.code,
            companhiaNome: companhia.name,
            companhiaCor: companhia.color,
            numeroVoo,
            origem,
            destino,
            dataPartida: dataPartida.toISOString(),
            dataChegada: dataChegada.toISOString(),
            duracao, // em minutos
            escalas,
            classe,
            preco,
            assentosDisponiveis: 5 + Math.floor(Math.random() * 20),
            bagagem: classe === 'economica' ? '1 x 23kg' : '2 x 32kg',
            reembolsavel: Math.random() > 0.7
        };
    },

    /**
     * Retorna companhias que operam na rota
     */
    getCompanhiasRota(origem, destino) {
        const origemAirport = getAirportByCode(origem);
        const destinoAirport = getAirportByCode(destino);

        // Rotas domésticas Brasil
        if (origemAirport?.countryCode === 'BR' && destinoAirport?.countryCode === 'BR') {
            return ['LA', 'G3', 'AD'];
        }

        // Rotas Brasil - EUA
        if ((origemAirport?.countryCode === 'BR' && destinoAirport?.countryCode === 'US') ||
            (origemAirport?.countryCode === 'US' && destinoAirport?.countryCode === 'BR')) {
            return ['LA', 'AA', 'UA', 'DL', 'G3'];
        }

        // Rotas Brasil - Europa
        if ((origemAirport?.countryCode === 'BR' && ['PT', 'ES', 'FR', 'DE', 'IT', 'GB', 'NL', 'CH'].includes(destinoAirport?.countryCode)) ||
            (['PT', 'ES', 'FR', 'DE', 'IT', 'GB', 'NL', 'CH'].includes(origemAirport?.countryCode) && destinoAirport?.countryCode === 'BR')) {
            return ['LA', 'TP', 'IB', 'AF', 'LH', 'BA', 'KL', 'AZ'];
        }

        // Rotas Brasil - América do Sul
        if ((origemAirport?.countryCode === 'BR' && ['AR', 'CL', 'PE', 'CO', 'UY'].includes(destinoAirport?.countryCode)) ||
            (['AR', 'CL', 'PE', 'CO', 'UY'].includes(origemAirport?.countryCode) && destinoAirport?.countryCode === 'BR')) {
            return ['LA', 'G3', 'AD', 'AR', 'AV'];
        }

        // Rotas internacionais genéricas
        return ['LA', 'EK', 'QR', 'AA', 'LH'];
    },

    /**
     * Calcula distância aproximada entre aeroportos
     */
    calcularDistancia(origem, destino) {
        // Distâncias aproximadas em km (simplificado)
        const distancias = {
            // Domésticas Brasil
            'GRU-GIG': 360, 'GRU-BSB': 870, 'GRU-SSA': 1500, 'GRU-REC': 2100,
            'GRU-FOR': 2400, 'GRU-POA': 850, 'GRU-CWB': 340, 'GRU-FLN': 480,
            'GRU-MAO': 2700, 'GRU-BEL': 2500, 'GRU-CNF': 520,

            // Brasil - EUA
            'GRU-MIA': 6500, 'GRU-JFK': 7700, 'GRU-LAX': 9500, 'GRU-ORD': 8400,
            'GRU-MCO': 6800, 'GRU-ATL': 7200,

            // Brasil - Europa
            'GRU-LIS': 7900, 'GRU-MAD': 8400, 'GRU-CDG': 9100, 'GRU-FRA': 9600,
            'GRU-LHR': 9400, 'GRU-AMS': 9500, 'GRU-FCO': 9200,

            // Brasil - América do Sul
            'GRU-EZE': 1700, 'GRU-SCL': 2600, 'GRU-LIM': 3500, 'GRU-BOG': 4400,
            'GRU-MVD': 1500
        };

        // Busca distância direta ou inversa
        const key1 = `${origem}-${destino}`;
        const key2 = `${destino}-${origem}`;

        let distancia = distancias[key1] || distancias[key2];

        // Se não encontrar, estima baseado em tipo de rota
        if (!distancia) {
            const origemAirport = getAirportByCode(origem);
            const destinoAirport = getAirportByCode(destino);

            if (origemAirport?.countryCode === destinoAirport?.countryCode) {
                distancia = 500 + Math.random() * 1500; // Doméstico
            } else if (origemAirport?.countryCode === 'BR' || destinoAirport?.countryCode === 'BR') {
                distancia = 3000 + Math.random() * 7000; // Internacional
            } else {
                distancia = 2000 + Math.random() * 10000; // Outros
            }
        }

        return {
            distancia,
            tipo: distancia < 1000 ? 'curta' : distancia < 4000 ? 'media' : 'longa'
        };
    },

    /**
     * Gera número de escalas baseado na distância
     */
    gerarEscalas(distancia) {
        if (distancia < 1500) {
            return Math.random() > 0.8 ? 1 : 0; // 80% direto
        } else if (distancia < 5000) {
            const rand = Math.random();
            if (rand > 0.6) return 0; // 40% direto
            if (rand > 0.2) return 1; // 40% 1 escala
            return 2; // 20% 2 escalas
        } else {
            const rand = Math.random();
            if (rand > 0.7) return 0; // 30% direto
            if (rand > 0.3) return 1; // 40% 1 escala
            return 2; // 30% 2 escalas
        }
    },

    /**
     * Calcula duração do voo em minutos
     */
    calcularDuracao(distancia, escalas) {
        // Velocidade média de cruzeiro: 850 km/h
        const tempoVoo = (distancia / 850) * 60;

        // Tempo adicional por escala (1-2 horas)
        const tempoEscalas = escalas * (60 + Math.random() * 60);

        // Tempo de taxiamento e procedimentos (30-60 min)
        const tempoExtra = 30 + Math.random() * 30;

        return Math.round(tempoVoo + tempoEscalas + tempoExtra);
    },

    /**
     * Calcula preço base do voo
     */
    calcularPrecoBase(distancia, classe) {
        // Preço por km (aproximado)
        let precoPorKm = 0.15;

        // Ajuste para distância (economia de escala em rotas longas)
        if (distancia > 3000) precoPorKm = 0.12;
        if (distancia > 6000) precoPorKm = 0.10;

        // Preço base
        let preco = distancia * precoPorKm;

        // Preço mínimo
        preco = Math.max(preco, 200);

        // Multiplicador de classe
        const classeConfig = CONFIG.classes.find(c => c.value === classe);
        if (classeConfig) {
            preco *= classeConfig.multiplicador;
        }

        return Math.round(preco);
    },

    /**
     * Calcula multiplicador baseado em passageiros
     */
    calcularMultiplicadorPassageiros(passageiros) {
        const adultos = passageiros.adultos || 1;
        const criancas = passageiros.criancas || 0;
        const bebes = passageiros.bebes || 0;

        // Crianças pagam 75%, bebês pagam 10%
        return adultos + (criancas * 0.75) + (bebes * 0.10);
    },

    /**
     * Simula delay de rede
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Exportar para uso global
window.MockApi = MockApi;
