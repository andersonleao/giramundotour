// GiraMundoTour - Dados dos Aeroportos (IATA)
// metro: região metropolitana — quando preenchido, agrupa aeroportos da mesma metrópole na busca

const AIRPORTS = [
    // Brasil - Principais
    { code: 'GRU', name: 'Aeroporto Internacional de Guarulhos', city: 'São Paulo', country: 'Brasil', countryCode: 'BR', metro: 'São Paulo' },
    { code: 'CGH', name: 'Aeroporto de Congonhas', city: 'São Paulo', country: 'Brasil', countryCode: 'BR', metro: 'São Paulo' },
    { code: 'GIG', name: 'Aeroporto Internacional do Galeão', city: 'Rio de Janeiro', country: 'Brasil', countryCode: 'BR', metro: 'Rio de Janeiro' },
    { code: 'SDU', name: 'Aeroporto Santos Dumont', city: 'Rio de Janeiro', country: 'Brasil', countryCode: 'BR', metro: 'Rio de Janeiro' },
    { code: 'BSB', name: 'Aeroporto Internacional de Brasília', city: 'Brasília', country: 'Brasil', countryCode: 'BR' },
    { code: 'CNF', name: 'Aeroporto Internacional de Confins', city: 'Belo Horizonte', country: 'Brasil', countryCode: 'BR' },
    { code: 'SSA', name: 'Aeroporto Internacional de Salvador', city: 'Salvador', country: 'Brasil', countryCode: 'BR' },
    { code: 'REC', name: 'Aeroporto Internacional do Recife', city: 'Recife', country: 'Brasil', countryCode: 'BR' },
    { code: 'FEN', name: 'Aeroporto Fernando de Noronha', city: 'Fernando de Noronha', country: 'Brasil', countryCode: 'BR' },
    { code: 'FOR', name: 'Aeroporto Internacional de Fortaleza', city: 'Fortaleza', country: 'Brasil', countryCode: 'BR' },
    { code: 'POA', name: 'Aeroporto Internacional Salgado Filho', city: 'Porto Alegre', country: 'Brasil', countryCode: 'BR' },
    { code: 'CWB', name: 'Aeroporto Internacional Afonso Pena', city: 'Curitiba', country: 'Brasil', countryCode: 'BR' },
    { code: 'FLN', name: 'Aeroporto Internacional Hercílio Luz', city: 'Florianópolis', country: 'Brasil', countryCode: 'BR' },
    { code: 'VCP', name: 'Aeroporto Internacional de Viracopos', city: 'Campinas', country: 'Brasil', countryCode: 'BR', metro: 'São Paulo' },
    { code: 'NAT', name: 'Aeroporto Internacional de Natal', city: 'Natal', country: 'Brasil', countryCode: 'BR' },
    { code: 'BEL', name: 'Aeroporto Internacional de Belém', city: 'Belém', country: 'Brasil', countryCode: 'BR' },
    { code: 'MAO', name: 'Aeroporto Internacional de Manaus', city: 'Manaus', country: 'Brasil', countryCode: 'BR' },
    { code: 'VIX', name: 'Aeroporto de Vitória', city: 'Vitória', country: 'Brasil', countryCode: 'BR' },
    { code: 'GYN', name: 'Aeroporto de Goiânia', city: 'Goiânia', country: 'Brasil', countryCode: 'BR' },
    { code: 'CGB', name: 'Aeroporto Internacional de Cuiabá', city: 'Cuiabá', country: 'Brasil', countryCode: 'BR' },
    { code: 'MCZ', name: 'Aeroporto Internacional de Maceió', city: 'Maceió', country: 'Brasil', countryCode: 'BR' },
    { code: 'AJU', name: 'Aeroporto Santa Maria', city: 'Aracaju', country: 'Brasil', countryCode: 'BR' },
    { code: 'SLZ', name: 'Aeroporto Internacional Marechal Cunha Machado', city: 'São Luís', country: 'Brasil', countryCode: 'BR' },
    { code: 'JPA', name: 'Aeroporto Internacional Presidente Castro Pinto', city: 'João Pessoa', country: 'Brasil', countryCode: 'BR' },
    { code: 'THE', name: 'Aeroporto Internacional de Teresina', city: 'Teresina', country: 'Brasil', countryCode: 'BR' },
    { code: 'PMW', name: 'Aeroporto de Palmas', city: 'Palmas', country: 'Brasil', countryCode: 'BR' },
    { code: 'RBR', name: 'Aeroporto Internacional de Rio Branco', city: 'Rio Branco', country: 'Brasil', countryCode: 'BR' },
    { code: 'CGR', name: 'Aeroporto Internacional de Campo Grande', city: 'Campo Grande', country: 'Brasil', countryCode: 'BR' },
    { code: 'IGU', name: 'Aeroporto Internacional de Foz do Iguaçu', city: 'Foz do Iguaçu', country: 'Brasil', countryCode: 'BR' },
    { code: 'PVH', name: 'Aeroporto Internacional Governador Jorge Teixeira', city: 'Porto Velho', country: 'Brasil', countryCode: 'BR' },
    { code: 'BVB', name: 'Aeroporto Internacional Atlas Brasil Cantanhede', city: 'Boa Vista', country: 'Brasil', countryCode: 'BR' },
    { code: 'MCP', name: 'Aeroporto Internacional de Macapá', city: 'Macapá', country: 'Brasil', countryCode: 'BR' },
    { code: 'SJP', name: 'Aeroporto Estadual de São José do Rio Preto', city: 'São José do Rio Preto', country: 'Brasil', countryCode: 'BR' },
    { code: 'PNZ', name: 'Aeroporto Senador Nilo Coelho', city: 'Petrolina', country: 'Brasil', countryCode: 'BR' },
    { code: 'OPS', name: 'Aeroporto Presidente João Batista Figueiredo', city: 'Sinop', country: 'Brasil', countryCode: 'BR' },

    // Estados Unidos
    { code: 'MIA', name: 'Miami International Airport', city: 'Miami', country: 'Estados Unidos', countryCode: 'US' },
    { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'Nova York', country: 'Estados Unidos', countryCode: 'US', metro: 'Nova York' },
    { code: 'LGA', name: 'LaGuardia Airport', city: 'Nova York', country: 'Estados Unidos', countryCode: 'US', metro: 'Nova York' },
    { code: 'EWR', name: 'Newark Liberty International Airport', city: 'Newark', country: 'Estados Unidos', countryCode: 'US', metro: 'Nova York' },
    { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'Estados Unidos', countryCode: 'US', metro: 'Los Angeles' },
    { code: 'BUR', name: 'Hollywood Burbank Airport', city: 'Burbank', country: 'Estados Unidos', countryCode: 'US', metro: 'Los Angeles' },
    { code: 'LGB', name: 'Long Beach Airport', city: 'Long Beach', country: 'Estados Unidos', countryCode: 'US', metro: 'Los Angeles' },
    { code: 'ORD', name: "O'Hare International Airport", city: 'Chicago', country: 'Estados Unidos', countryCode: 'US', metro: 'Chicago' },
    { code: 'MDW', name: 'Chicago Midway International Airport', city: 'Chicago', country: 'Estados Unidos', countryCode: 'US', metro: 'Chicago' },
    { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International', city: 'Atlanta', country: 'Estados Unidos', countryCode: 'US' },
    { code: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', country: 'Estados Unidos', countryCode: 'US', metro: 'Dallas' },
    { code: 'DAL', name: 'Dallas Love Field Airport', city: 'Dallas', country: 'Estados Unidos', countryCode: 'US', metro: 'Dallas' },
    { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'Estados Unidos', countryCode: 'US', metro: 'San Francisco' },
    { code: 'OAK', name: 'Oakland International Airport', city: 'Oakland', country: 'Estados Unidos', countryCode: 'US', metro: 'San Francisco' },
    { code: 'SJC', name: 'San Jose International Airport', city: 'San Jose', country: 'Estados Unidos', countryCode: 'US', metro: 'San Francisco' },
    { code: 'MCO', name: 'Orlando International Airport', city: 'Orlando', country: 'Estados Unidos', countryCode: 'US' },
    { code: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', country: 'Estados Unidos', countryCode: 'US' },
    { code: 'IAD', name: 'Washington Dulles International Airport', city: 'Washington', country: 'Estados Unidos', countryCode: 'US', metro: 'Washington' },
    { code: 'DCA', name: 'Ronald Reagan Washington National Airport', city: 'Washington', country: 'Estados Unidos', countryCode: 'US', metro: 'Washington' },
    { code: 'BWI', name: 'Baltimore/Washington International Airport', city: 'Baltimore', country: 'Estados Unidos', countryCode: 'US', metro: 'Washington' },

    // Europa
    { code: 'LHR', name: 'London Heathrow Airport', city: 'Londres', country: 'Reino Unido', countryCode: 'GB', metro: 'Londres' },
    { code: 'LGW', name: 'London Gatwick Airport', city: 'Londres', country: 'Reino Unido', countryCode: 'GB', metro: 'Londres' },
    { code: 'STN', name: 'London Stansted Airport', city: 'Londres', country: 'Reino Unido', countryCode: 'GB', metro: 'Londres' },
    { code: 'LCY', name: 'London City Airport', city: 'Londres', country: 'Reino Unido', countryCode: 'GB', metro: 'Londres' },
    { code: 'CDG', name: 'Paris Charles de Gaulle Airport', city: 'Paris', country: 'França', countryCode: 'FR', metro: 'Paris' },
    { code: 'ORY', name: 'Paris Orly Airport', city: 'Paris', country: 'França', countryCode: 'FR', metro: 'Paris' },
    { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Alemanha', countryCode: 'DE' },
    { code: 'AMS', name: 'Amsterdam Schiphol Airport', city: 'Amsterdam', country: 'Holanda', countryCode: 'NL' },
    { code: 'MAD', name: 'Adolfo Suárez Madrid-Barajas', city: 'Madrid', country: 'Espanha', countryCode: 'ES' },
    { code: 'BCN', name: 'Barcelona El Prat Airport', city: 'Barcelona', country: 'Espanha', countryCode: 'ES' },
    { code: 'FCO', name: 'Rome Fiumicino Airport', city: 'Roma', country: 'Itália', countryCode: 'IT', metro: 'Roma' },
    { code: 'CIA', name: 'Rome Ciampino Airport', city: 'Roma', country: 'Itália', countryCode: 'IT', metro: 'Roma' },
    { code: 'MXP', name: 'Milan Malpensa Airport', city: 'Milão', country: 'Itália', countryCode: 'IT', metro: 'Milão' },
    { code: 'LIN', name: 'Milan Linate Airport', city: 'Milão', country: 'Itália', countryCode: 'IT', metro: 'Milão' },
    { code: 'BGY', name: 'Milan Bergamo Airport', city: 'Bérgamo', country: 'Itália', countryCode: 'IT', metro: 'Milão' },
    { code: 'LIS', name: 'Lisbon Portela Airport', city: 'Lisboa', country: 'Portugal', countryCode: 'PT' },
    { code: 'OPO', name: 'Porto Airport', city: 'Porto', country: 'Portugal', countryCode: 'PT' },
    { code: 'ZRH', name: 'Zurich Airport', city: 'Zurique', country: 'Suíça', countryCode: 'CH' },
    { code: 'SXB', name: 'Strasbourg Airport', city: 'Estrasburgo', country: 'França', countryCode: 'FR' },

    // América do Sul
    { code: 'EZE', name: 'Aeropuerto Internacional Ezeiza', city: 'Buenos Aires', country: 'Argentina', countryCode: 'AR', metro: 'Buenos Aires' },
    { code: 'AEP', name: 'Aeroparque Jorge Newbery', city: 'Buenos Aires', country: 'Argentina', countryCode: 'AR', metro: 'Buenos Aires' },
    { code: 'SCL', name: 'Aeropuerto Internacional de Santiago', city: 'Santiago', country: 'Chile', countryCode: 'CL' },
    { code: 'LIM', name: 'Aeropuerto Internacional Jorge Chávez', city: 'Lima', country: 'Peru', countryCode: 'PE' },
    { code: 'BOG', name: 'Aeropuerto Internacional El Dorado', city: 'Bogotá', country: 'Colômbia', countryCode: 'CO' },
    { code: 'MVD', name: 'Aeropuerto Internacional de Carrasco', city: 'Montevidéu', country: 'Uruguai', countryCode: 'UY' },

    // Ásia
    { code: 'NRT', name: 'Narita International Airport', city: 'Tóquio', country: 'Japão', countryCode: 'JP', metro: 'Tóquio' },
    { code: 'HND', name: 'Tokyo Haneda Airport', city: 'Tóquio', country: 'Japão', countryCode: 'JP', metro: 'Tóquio' },
    { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'Emirados Árabes', countryCode: 'AE', metro: 'Dubai' },
    { code: 'DWC', name: 'Al Maktoum International Airport', city: 'Dubai', country: 'Emirados Árabes', countryCode: 'AE', metro: 'Dubai' },
    { code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapura', country: 'Singapura', countryCode: 'SG' },
    { code: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'China', countryCode: 'HK' },
    { code: 'ICN', name: 'Incheon International Airport', city: 'Seul', country: 'Coreia do Sul', countryCode: 'KR', metro: 'Seul' },
    { code: 'GMP', name: 'Gimpo International Airport', city: 'Seul', country: 'Coreia do Sul', countryCode: 'KR', metro: 'Seul' },

    // Oceania
    { code: 'SYD', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'Austrália', countryCode: 'AU' },
    { code: 'MEL', name: 'Melbourne Airport', city: 'Melbourne', country: 'Austrália', countryCode: 'AU' },
    { code: 'AKL', name: 'Auckland Airport', city: 'Auckland', country: 'Nova Zelândia', countryCode: 'NZ' },

    // África
    { code: 'JNB', name: 'O.R. Tambo International Airport', city: 'Joanesburgo', country: 'África do Sul', countryCode: 'ZA' },
    { code: 'CPT', name: 'Cape Town International Airport', city: 'Cidade do Cabo', country: 'África do Sul', countryCode: 'ZA' },
    { code: 'CAI', name: 'Cairo International Airport', city: 'Cairo', country: 'Egito', countryCode: 'EG' }
];

// Normaliza string removendo acentos e convertendo para minúsculas
function _normalizeStr(str) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Função para buscar aeroportos.
// Quando a pesquisa bate em uma cidade/metrópole com múltiplos aeroportos,
// retorna TODOS os aeroportos daquela região automaticamente.
function searchAirports(query) {
    if (!query || query.length < 2) return [];

    const q = _normalizeStr(query);

    // 1a. Matches "fortes": código IATA, cidade, país ou metrópole
    //     Estes disparam a expansão de metrópoles.
    const strongMatches = AIRPORTS.filter(airport => {
        const code    = airport.code.toLowerCase();
        const city    = _normalizeStr(airport.city);
        const country = _normalizeStr(airport.country);
        const metro   = airport.metro ? _normalizeStr(airport.metro) : '';
        return code.includes(q) || city.includes(q) || country.includes(q) || metro.includes(q);
    });

    // 1b. Matches "fracos": somente pelo nome do aeroporto (ex: "Guarulhos")
    //     NÃO disparam expansão de metrópoles — evita que "porto" em "Aeroporto"
    //     retorne todos os aeroportos brasileiros e empurre OPO para fora da lista.
    const strongSet = new Set(strongMatches.map(a => a.code));
    const weakMatches = AIRPORTS.filter(airport => {
        if (strongSet.has(airport.code)) return false;
        return _normalizeStr(airport.name).includes(q);
    });

    const directMatches = [...strongMatches, ...weakMatches];

    // 2. Coleta metrópoles encontradas (apenas de strong) para expandir o resultado
    const metrosEncontrados = new Set(
        strongMatches.filter(a => a.metro).map(a => a.metro)
    );

    // 3. Coleta cidades sem metro encontradas de strong matches
    const cidadesEncontradas = new Set(
        strongMatches.filter(a => !a.metro).map(a => a.city)
    );

    // 4. Expande: inclui todos os aeroportos das metrópoles/cidades encontradas.
    //    Se há strong matches, usa apenas eles + expansão (ignora weak matches).
    //    Se não há strong matches, usa weak matches sem expansão de metrópole.
    const resultado = strongMatches.length > 0
        ? AIRPORTS.filter(airport => {
            if (airport.metro && metrosEncontrados.has(airport.metro)) return true;
            if (!airport.metro && cidadesEncontradas.has(airport.city)) return true;
            return strongMatches.includes(airport);
        })
        : weakMatches;

    // Remove duplicatas
    const seen = new Set();
    const listaFinal = resultado.filter(a => {
        if (seen.has(a.code)) return false;
        seen.add(a.code);
        return true;
    });

    // Agrupa metrópoles com mais de um aeroporto e insere item "Todos" no topo
    const metroGroups = {};
    listaFinal.forEach(a => {
        if (a.metro) {
            if (!metroGroups[a.metro]) metroGroups[a.metro] = [];
            metroGroups[a.metro].push(a);
        }
    });

    const cityGroupItems = [];
    Object.entries(metroGroups).forEach(([metro, airports]) => {
        if (airports.length > 1) {
            cityGroupItems.push({
                code: airports.map(a => a.code).join(','),
                name: 'Todos os aeroportos',
                city: metro,
                country: airports[0].country,
                countryCode: airports[0].countryCode,
                metro: metro,
                isCityGroup: true,
                airports: airports
            });
        }
    });

    return [...cityGroupItems, ...listaFinal].slice(0, 18);
}

// Função para obter aeroporto por código
function getAirportByCode(code) {
    return AIRPORTS.find(a => a.code === code.toUpperCase());
}

// Função para formatar aeroporto para exibição
function formatAirport(airport) {
    return `${airport.code} - ${airport.city}, ${airport.country}`;
}

// Exportar para uso global
window.AIRPORTS = AIRPORTS;
window.searchAirports = searchAirports;
window.getAirportByCode = getAirportByCode;
window.formatAirport = formatAirport;
