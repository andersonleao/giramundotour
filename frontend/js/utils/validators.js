// GiraMundoTour - Utilitários de Validação

const Validators = {
    /**
     * Valida email
     * @param {string} email - Email a ser validado
     * @returns {boolean} True se válido
     */
    email(email) {
        if (!email) return false;
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },

    /**
     * Valida CPF
     * @param {string} cpf - CPF a ser validado
     * @returns {boolean} True se válido
     */
    cpf(cpf) {
        if (!cpf) return false;

        const cleaned = cpf.replace(/\D/g, '');
        if (cleaned.length !== 11) return false;

        // Verifica se todos os dígitos são iguais
        if (/^(\d)\1+$/.test(cleaned)) return false;

        // Validação do primeiro dígito verificador
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(cleaned.charAt(i)) * (10 - i);
        }
        let digit = 11 - (sum % 11);
        if (digit > 9) digit = 0;
        if (digit !== parseInt(cleaned.charAt(9))) return false;

        // Validação do segundo dígito verificador
        sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += parseInt(cleaned.charAt(i)) * (11 - i);
        }
        digit = 11 - (sum % 11);
        if (digit > 9) digit = 0;
        if (digit !== parseInt(cleaned.charAt(10))) return false;

        return true;
    },

    /**
     * Valida telefone brasileiro
     * @param {string} phone - Telefone a ser validado
     * @returns {boolean} True se válido
     */
    phone(phone) {
        if (!phone) return false;
        const cleaned = phone.replace(/\D/g, '');
        // Aceita telefone com 10 ou 11 dígitos (com DDD)
        return cleaned.length === 10 || cleaned.length === 11;
    },

    /**
     * Valida se campo não está vazio
     * @param {string} value - Valor a ser validado
     * @returns {boolean} True se não vazio
     */
    required(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        return true;
    },

    /**
     * Valida tamanho mínimo
     * @param {string} value - Valor a ser validado
     * @param {number} min - Tamanho mínimo
     * @returns {boolean} True se válido
     */
    minLength(value, min) {
        if (!value) return false;
        return value.length >= min;
    },

    /**
     * Valida tamanho máximo
     * @param {string} value - Valor a ser validado
     * @param {number} max - Tamanho máximo
     * @returns {boolean} True se válido
     */
    maxLength(value, max) {
        if (!value) return true;
        return value.length <= max;
    },

    /**
     * Valida se é um número positivo
     * @param {number|string} value - Valor a ser validado
     * @returns {boolean} True se válido
     */
    positiveNumber(value) {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0;
    },

    /**
     * Valida se é um número inteiro positivo
     * @param {number|string} value - Valor a ser validado
     * @returns {boolean} True se válido
     */
    positiveInteger(value) {
        const num = parseInt(value);
        return !isNaN(num) && num > 0 && Number.isInteger(num);
    },

    /**
     * Valida código de aeroporto IATA
     * @param {string} code - Código a ser validado
     * @returns {boolean} True se válido
     */
    airportCode(code) {
        if (!code) return false;
        const regex = /^[A-Z]{3}$/;
        // Aceita código único (GRU) ou grupo de cidade (GRU, CGH, VCP)
        return code.split(',').every(c => regex.test(c.trim().toUpperCase()));
    },

    /**
     * Valida data futura
     * @param {Date|string} date - Data a ser validada
     * @returns {boolean} True se é data futura
     */
    futureDate(date) {
        if (!date) return false;
        const d = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d >= today;
    },

    /**
     * Valida data de retorno (deve ser após data de ida)
     * @param {Date|string} departureDate - Data de ida
     * @param {Date|string} returnDate - Data de retorno
     * @returns {boolean} True se válido
     */
    returnDate(departureDate, returnDate) {
        if (!departureDate || !returnDate) return false;
        const dep = new Date(departureDate);
        const ret = new Date(returnDate);
        return ret >= dep;
    },

    /**
     * Valida número de passageiros
     * @param {object} passengers - Objeto com adultos, crianças e bebês
     * @returns {object} Resultado da validação
     */
    passengers(passengers) {
        const result = { valid: true, errors: [] };

        if (!passengers) {
            result.valid = false;
            result.errors.push('Dados de passageiros inválidos');
            return result;
        }

        const adultos = parseInt(passengers.adultos) || 0;
        const criancas = parseInt(passengers.criancas) || 0;
        const bebes = parseInt(passengers.bebes) || 0;

        if (adultos < 1) {
            result.valid = false;
            result.errors.push('É necessário pelo menos 1 adulto');
        }

        if (adultos + criancas + bebes > 11) {
            result.valid = false;
            result.errors.push('Máximo de 11 passageiros por reserva');
        }

        if (bebes > adultos) {
            result.valid = false;
            result.errors.push('Número de bebês não pode exceder o número de adultos');
        }

        return result;
    },

    /**
     * Valida formulário de busca de voos
     * @param {object} data - Dados do formulário
     * @returns {object} Resultado da validação
     */
    searchForm(data) {
        const result = { valid: true, errors: {} };

        if (!this.airportCode(data.origem)) {
            result.valid = false;
            result.errors.origem = 'Selecione um aeroporto de origem válido';
        }

        if (!this.airportCode(data.destino)) {
            result.valid = false;
            result.errors.destino = 'Selecione um aeroporto de destino válido';
        }

        if (data.origem && data.destino &&
            data.origem.toUpperCase() === data.destino.toUpperCase()) {
            result.valid = false;
            result.errors.destino = 'Origem e destino devem ser diferentes';
        }

        if (!this.futureDate(data.dataIda)) {
            result.valid = false;
            result.errors.dataIda = 'Data de ida deve ser futura';
        }

        if (data.tipoViagem === 'idaVolta' && !data.dataVolta) {
            result.valid = false;
            result.errors.dataVolta = 'Informe a data de volta para busca ida e volta';
        } else if (data.dataVolta && !this.returnDate(data.dataIda, data.dataVolta)) {
            result.valid = false;
            result.errors.dataVolta = 'Data de volta deve ser após a data de ida';
        }

        const passengersValidation = this.passengers(data.passageiros);
        if (!passengersValidation.valid) {
            result.valid = false;
            result.errors.passageiros = passengersValidation.errors.join('. ');
        }

        return result;
    },

    /**
     * Valida formulário de cliente
     * @param {object} data - Dados do cliente
     * @returns {object} Resultado da validação
     */
    clientForm(data) {
        const result = { valid: true, errors: {} };

        if (!this.required(data.nome)) {
            result.valid = false;
            result.errors.nome = 'Nome é obrigatório';
        } else if (!this.minLength(data.nome, 3)) {
            result.valid = false;
            result.errors.nome = 'Nome deve ter pelo menos 3 caracteres';
        }

        if (data.email && !this.email(data.email)) {
            result.valid = false;
            result.errors.email = 'Email inválido';
        }

        if (data.cpf && !this.cpf(data.cpf)) {
            result.valid = false;
            result.errors.cpf = 'CPF inválido';
        }

        return result;
    },

    /**
     * Exibe erros de validação no formulário
     * @param {object} errors - Objeto com erros por campo
     * @param {HTMLFormElement} form - Elemento do formulário
     */
    showFormErrors(errors, form) {
        // Remove erros anteriores
        form.querySelectorAll('.is-invalid').forEach(el => {
            el.classList.remove('is-invalid');
        });
        form.querySelectorAll('.invalid-feedback').forEach(el => {
            el.remove();
        });

        // Adiciona novos erros
        Object.keys(errors).forEach(field => {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
                input.classList.add('is-invalid');
                const feedback = document.createElement('div');
                feedback.className = 'invalid-feedback';
                feedback.textContent = errors[field];
                input.parentNode.appendChild(feedback);
            }
        });
    },

    /**
     * Limpa erros de validação do formulário
     * @param {HTMLFormElement} form - Elemento do formulário
     */
    clearFormErrors(form) {
        form.querySelectorAll('.is-invalid').forEach(el => {
            el.classList.remove('is-invalid');
        });
        form.querySelectorAll('.invalid-feedback').forEach(el => {
            el.remove();
        });
    }
};

// Exportar para uso global
window.Validators = Validators;
