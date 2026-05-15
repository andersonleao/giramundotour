// GiraMundoTour - Dados das Companhias Aéreas

const AIRLINES = [
    // Brasileiras
    {
        code: 'LA',
        name: 'LATAM Airlines',
        country: 'Brasil/Chile',
        logo: 'latam.png',
        color: '#E4002B',
        alliance: 'Oneworld'
    },
    {
        code: 'JJ',
        name: 'LATAM Airlines',
        country: 'Brasil',
        logo: 'latam.png',
        color: '#E4002B',
        alliance: 'Oneworld'
    },
    {
        code: 'G3',
        name: 'GOL Linhas Aéreas',
        country: 'Brasil',
        logo: 'gol.png',
        color: '#FF6600',
        alliance: null
    },
    {
        code: 'AD',
        name: 'Azul Linhas Aéreas',
        country: 'Brasil',
        logo: 'azul.png',
        color: '#0033A0',
        alliance: null
    },

    // Brasileiras regionais
    {
        code: '2Z',
        name: 'Passaredo Linhas Aéreas',
        country: 'Brasil',
        logo: '',
        color: '#0055A5',
        alliance: null
    },
    {
        code: 'M3',
        name: 'MAP Linhas Aéreas',
        country: 'Brasil',
        logo: '',
        color: '#E8A000',
        alliance: null
    },

    // Norte-Americanas
    {
        code: 'AA',
        name: 'American Airlines',
        country: 'Estados Unidos',
        logo: 'american.png',
        color: '#0078D2',
        alliance: 'Oneworld'
    },
    {
        code: 'UA',
        name: 'United Airlines',
        country: 'Estados Unidos',
        logo: 'united.png',
        color: '#002244',
        alliance: 'Star Alliance'
    },
    {
        code: 'DL',
        name: 'Delta Air Lines',
        country: 'Estados Unidos',
        logo: 'delta.png',
        color: '#003366',
        alliance: 'SkyTeam'
    },

    // Europeias
    {
        code: 'TP',
        name: 'TAP Air Portugal',
        country: 'Portugal',
        logo: 'tap.png',
        color: '#00A36C',
        alliance: 'Star Alliance'
    },
    {
        code: 'IB',
        name: 'Iberia',
        country: 'Espanha',
        logo: 'iberia.png',
        color: '#D4213D',
        alliance: 'Oneworld'
    },
    {
        code: 'AF',
        name: 'Air France',
        country: 'França',
        logo: 'airfrance.png',
        color: '#002157',
        alliance: 'SkyTeam'
    },
    {
        code: 'LH',
        name: 'Lufthansa',
        country: 'Alemanha',
        logo: 'lufthansa.png',
        color: '#05164D',
        alliance: 'Star Alliance'
    },
    {
        code: 'BA',
        name: 'British Airways',
        country: 'Reino Unido',
        logo: 'british.png',
        color: '#075AAA',
        alliance: 'Oneworld'
    },
    {
        code: 'KL',
        name: 'KLM Royal Dutch Airlines',
        country: 'Holanda',
        logo: 'klm.png',
        color: '#00A1E4',
        alliance: 'SkyTeam'
    },
    {
        code: 'AZ',
        name: 'ITA Airways',
        country: 'Itália',
        logo: 'ita.png',
        color: '#0A4D92',
        alliance: 'SkyTeam'
    },
    {
        code: 'LX',
        name: 'Swiss International Air Lines',
        country: 'Suíça',
        logo: 'swiss.png',
        color: '#E2001A',
        alliance: 'Star Alliance'
    },

    // Sul-Americanas
    {
        code: 'AR',
        name: 'Aerolíneas Argentinas',
        country: 'Argentina',
        logo: 'aerolineas.png',
        color: '#0072CE',
        alliance: 'SkyTeam'
    },
    {
        code: 'AV',
        name: 'Avianca',
        country: 'Colômbia',
        logo: 'avianca.png',
        color: '#ED1C24',
        alliance: 'Star Alliance'
    },
    {
        code: 'CM',
        name: 'Copa Airlines',
        country: 'Panamá',
        logo: 'copa.png',
        color: '#005DAA',
        alliance: 'Star Alliance'
    },

    // Oriente Médio
    {
        code: 'EK',
        name: 'Emirates',
        country: 'Emirados Árabes',
        logo: 'emirates.png',
        color: '#D71A21',
        alliance: null
    },
    {
        code: 'QR',
        name: 'Qatar Airways',
        country: 'Qatar',
        logo: 'qatar.png',
        color: '#5C0632',
        alliance: 'Oneworld'
    },
    {
        code: 'EY',
        name: 'Etihad Airways',
        country: 'Emirados Árabes',
        logo: 'etihad.png',
        color: '#BD8B2A',
        alliance: null
    },

    // Asiáticas
    {
        code: 'SQ',
        name: 'Singapore Airlines',
        country: 'Singapura',
        logo: 'singapore.png',
        color: '#F7C917',
        alliance: 'Star Alliance'
    },
    {
        code: 'CX',
        name: 'Cathay Pacific',
        country: 'Hong Kong',
        logo: 'cathay.png',
        color: '#006564',
        alliance: 'Oneworld'
    },
    {
        code: 'JL',
        name: 'Japan Airlines',
        country: 'Japão',
        logo: 'jal.png',
        color: '#C8102E',
        alliance: 'Oneworld'
    },
    {
        code: 'NH',
        name: 'All Nippon Airways',
        country: 'Japão',
        logo: 'ana.png',
        color: '#0B1E61',
        alliance: 'Star Alliance'
    },
    {
        code: 'KE',
        name: 'Korean Air',
        country: 'Coreia do Sul',
        logo: 'korean.png',
        color: '#0064D2',
        alliance: 'SkyTeam'
    }
];

// Função para obter companhia por código
function getAirlineByCode(code) {
    return AIRLINES.find(a => a.code === code);
}

// Função para obter todas as companhias
function getAllAirlines() {
    return AIRLINES;
}

// Função para obter companhias por país
function getAirlinesByCountry(country) {
    return AIRLINES.filter(a => a.country.toLowerCase().includes(country.toLowerCase()));
}

// Função para gerar cor de placeholder para logo
function getAirlineColor(code) {
    const airline = getAirlineByCode(code);
    return airline ? airline.color : '#1a365d';
}

// Função para obter nome da companhia
function getAirlineName(code) {
    const airline = getAirlineByCode(code);
    return airline ? airline.name : code;
}

// Função para gerar inicial da companhia (quando não há logo)
function getAirlineInitials(code) {
    const airline = getAirlineByCode(code);
    if (!airline) return code;

    const words = airline.name.split(' ');
    if (words.length >= 2) {
        return words[0][0] + words[1][0];
    }
    return airline.name.substring(0, 2).toUpperCase();
}

// Exportar para uso global
window.AIRLINES = AIRLINES;
window.getAirlineByCode = getAirlineByCode;
window.getAllAirlines = getAllAirlines;
window.getAirlinesByCountry = getAirlinesByCountry;
window.getAirlineColor = getAirlineColor;
window.getAirlineName = getAirlineName;
window.getAirlineInitials = getAirlineInitials;
