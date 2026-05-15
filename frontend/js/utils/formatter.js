// GiraMundoTour - Utilitários de Formatação

const Formatter = {
    /**
     * Formata valor para moeda brasileira (BRL)
     * @param {number} value - Valor a ser formatado
     * @returns {string} Valor formatado (ex: R$ 1.234,56)
     */
    currency(value) {
        if (value === null || value === undefined || isNaN(value)) {
            return 'R$ 0,00';
        }
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    },

    /**
     * Formata valor para moeda USD
     * @param {number} value - Valor a ser formatado
     * @returns {string} Valor formatado (ex: $ 1,234.56)
     */
    currencyUSD(value) {
        if (value === null || value === undefined || isNaN(value)) {
            return '$ 0.00';
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    },

    /**
     * Formata data para formato brasileiro
     * @param {Date|string} date - Data a ser formatada
     * @returns {string} Data formatada (ex: 15/03/2024)
     */
    date(date) {
        if (!date) return '';
        // Se for string YYYY-MM-DD, parsear partes para evitar shift de timezone
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const [y, m, d] = date.split('-');
            return `${d}/${m}/${y}`;
        }
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        return d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    /**
     * Formata data e hora
     * @param {Date|string} date - Data a ser formatada
     * @returns {string} Data e hora formatadas (ex: 15/03/2024 14:30)
     */
    dateTime(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        return d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Formata apenas hora
     * @param {Date|string} date - Data/hora a ser formatada
     * @returns {string} Hora formatada (ex: 14:30)
     */
    time(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        return d.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Formata data por extenso
     * @param {Date|string} date - Data a ser formatada
     * @returns {string} Data por extenso (ex: 15 de março de 2024)
     */
    dateFull(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        return d.toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    },

    /**
     * Formata duração em minutos para formato legível
     * @param {number} minutes - Duração em minutos
     * @returns {string} Duração formatada (ex: 8h 30min)
     */
    duration(minutes) {
        if (!minutes || minutes <= 0) return '0min';

        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        if (hours === 0) return `${mins}min`;
        if (mins === 0) return `${hours}h`;
        return `${hours}h ${mins}min`;
    },

    /**
     * Formata número de escalas
     * @param {number} stops - Número de escalas
     * @returns {string} Texto formatado
     */
    stops(stops) {
        if (stops === 0) return 'Direto';
        if (stops === 1) return '1 escala';
        return `${stops} escalas`;
    },

    /**
     * Formata CPF
     * @param {string} cpf - CPF a ser formatado
     * @returns {string} CPF formatado (ex: 123.456.789-00)
     */
    cpf(cpf) {
        if (!cpf) return '';
        const cleaned = cpf.replace(/\D/g, '');
        if (cleaned.length !== 11) return cpf;

        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    },

    /**
     * Formata CNPJ
     * @param {string} cnpj - CNPJ a ser formatado
     * @returns {string} CNPJ formatado (ex: 00.000.000/0000-00)
     */
    cnpj(cnpj) {
        if (!cnpj) return '';
        const cleaned = cnpj.replace(/\D/g, '');
        if (cleaned.length !== 14) return cnpj;

        return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    },

    /**
     * Formata telefone
     * @param {string} phone - Telefone a ser formatado
     * @returns {string} Telefone formatado (ex: (11) 99999-9999)
     */
    phone(phone) {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');

        if (cleaned.length === 11) {
            return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        } else if (cleaned.length === 10) {
            return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        return phone;
    },

    /**
     * Formata número de passageiros
     * @param {object} passengers - Objeto com adultos, crianças e bebês
     * @returns {string} Texto formatado
     */
    passengers(passengers) {
        if (!passengers) return '';

        const parts = [];
        if (passengers.adultos > 0) {
            parts.push(`${passengers.adultos} ${passengers.adultos === 1 ? 'adulto' : 'adultos'}`);
        }
        if (passengers.criancas > 0) {
            parts.push(`${passengers.criancas} ${passengers.criancas === 1 ? 'criança' : 'crianças'}`);
        }
        if (passengers.bebes > 0) {
            parts.push(`${passengers.bebes} ${passengers.bebes === 1 ? 'bebê' : 'bebês'}`);
        }

        return parts.join(', ') || 'Nenhum passageiro';
    },

    /**
     * Formata classe do voo
     * @param {string} flightClass - Classe do voo
     * @returns {string} Classe formatada
     */
    flightClass(flightClass) {
        const classes = {
            'economica': 'Econômica',
            'executiva': 'Executiva',
            'primeira': 'Primeira Classe'
        };
        return classes[flightClass] || flightClass;
    },

    /**
     * Formata status da cotação
     * @param {string} status - Status da cotação
     * @returns {string} Status formatado com classe CSS
     */
    quotationStatus(status) {
        const statuses = {
            'pendente': { text: 'Pendente', class: 'badge-status-pending' },
            'aprovada': { text: 'Aprovada', class: 'badge-status-approved' },
            'expirada': { text: 'Expirada', class: 'badge-status-expired' }
        };
        return statuses[status] || { text: status, class: 'badge-secondary' };
    },

    /**
     * Trunca texto com ellipsis
     * @param {string} text - Texto a ser truncado
     * @param {number} maxLength - Tamanho máximo
     * @returns {string} Texto truncado
     */
    truncate(text, maxLength = 50) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    },

    /**
     * Capitaliza primeira letra de cada palavra
     * @param {string} text - Texto a ser capitalizado
     * @returns {string} Texto capitalizado
     */
    capitalize(text) {
        if (!text) return '';
        return text.toLowerCase().replace(/(?:^|\s)\S/g, char => char.toUpperCase());
    },

    /**
     * Formata data para input type="date"
     * @param {Date|string} date - Data a ser formatada
     * @returns {string} Data no formato YYYY-MM-DD
     */
    dateForInput(date) {
        if (!date) return '';
        // Se já for string YYYY-MM-DD, retornar diretamente
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return date;
        }
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Formata data/hora para input type="datetime-local"
     * @param {Date|string} date - Data a ser formatada
     * @returns {string} Data no formato YYYY-MM-DDTHH:MM
     */
    dateTimeForInput(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        return d.toISOString().slice(0, 16);
    },

    /**
     * Formata número com separador de milhar
     * @param {number} value - Valor a ser formatado
     * @returns {string} Número formatado (ex: 1.234.567)
     */
    number(value) {
        if (value === null || value === undefined || isNaN(value)) {
            return '0';
        }
        return new Intl.NumberFormat('pt-BR').format(value);
    }
};

// Exportar para uso global
window.Formatter = Formatter;
