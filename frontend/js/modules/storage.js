// GiraMundoTour - Módulo de Persistência (LocalStorage)

/**
 * Utilitário global para chamadas autenticadas à API
 */
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('giramundo_token') || '';
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
            ...(options.headers || {})
        }
    };
    try {
        const resp = await fetch(endpoint, config);
        if (resp.status === 401) {
            if (window.App && App.showToast) App.showToast('Sessão expirada. Faça login novamente.', 'error');
            setTimeout(() => { window.location.href = '/login.html'; }, 1500);
            return null;
        }
        return resp;
    } catch (err) {
        console.error('[apiCall] Erro de rede:', err);
        if (window.App && App.showToast) App.showToast('Erro de conexão com o servidor.', 'error');
        return null;
    }
}
window.apiCall = apiCall;

const Storage = {
    /**
     * Salva dados no LocalStorage
     * @param {string} key - Chave de armazenamento
     * @param {*} data - Dados a serem salvos
     * @returns {boolean} Sucesso da operação
     */
    save(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            debugLog('Storage: Dados salvos em', key);
            return true;
        } catch (error) {
            console.error('Storage: Erro ao salvar dados', error);
            return false;
        }
    },

    /**
     * Recupera dados do LocalStorage
     * @param {string} key - Chave de armazenamento
     * @param {*} defaultValue - Valor padrão se não existir
     * @returns {*} Dados recuperados
     */
    get(key, defaultValue = null) {
        try {
            const serialized = localStorage.getItem(key);
            if (serialized === null) return defaultValue;
            return JSON.parse(serialized);
        } catch (error) {
            console.error('Storage: Erro ao recuperar dados', error);
            return defaultValue;
        }
    },

    /**
     * Remove dados do LocalStorage
     * @param {string} key - Chave de armazenamento
     * @returns {boolean} Sucesso da operação
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            debugLog('Storage: Dados removidos de', key);
            return true;
        } catch (error) {
            console.error('Storage: Erro ao remover dados', error);
            return false;
        }
    },

    /**
     * Limpa todos os dados da aplicação
     * @returns {boolean} Sucesso da operação
     */
    clearAll() {
        try {
            Object.values(CONFIG.storageKeys).forEach(key => {
                localStorage.removeItem(key);
            });
            debugLog('Storage: Todos os dados removidos');
            return true;
        } catch (error) {
            console.error('Storage: Erro ao limpar dados', error);
            return false;
        }
    },

    // =====================
    // CLIENTES
    // =====================

    /**
     * Retorna todos os clientes
     * @returns {Array} Lista de clientes
     */
    getClientes() {
        return this.get(CONFIG.storageKeys.clientes, []);
    },

    /**
     * Salva lista de clientes
     * @param {Array} clientes - Lista de clientes
     */
    saveClientes(clientes) {
        return this.save(CONFIG.storageKeys.clientes, clientes);
    },

    /**
     * Adiciona um novo cliente
     * @param {object} cliente - Dados do cliente
     * @returns {object} Cliente criado com ID
     */
    addCliente(cliente) {
        const clientes = this.getClientes();
        const novoCliente = {
            ...cliente,
            id: this.generateId(),
            dataCadastro: new Date().toISOString()
        };
        clientes.push(novoCliente);
        this.saveClientes(clientes);
        return novoCliente;
    },

    /**
     * Atualiza um cliente existente
     * @param {string} id - ID do cliente
     * @param {object} dados - Dados atualizados
     * @returns {object|null} Cliente atualizado ou null
     */
    updateCliente(id, dados) {
        const clientes = this.getClientes();
        const index = clientes.findIndex(c => c.id === id);
        if (index === -1) return null;

        clientes[index] = { ...clientes[index], ...dados };
        this.saveClientes(clientes);
        return clientes[index];
    },

    /**
     * Remove um cliente
     * @param {string} id - ID do cliente
     * @returns {boolean} Sucesso da operação
     */
    deleteCliente(id) {
        const clientes = this.getClientes();
        const filtrado = clientes.filter(c => c.id !== id);
        if (filtrado.length === clientes.length) return false;

        this.saveClientes(filtrado);
        return true;
    },

    /**
     * Busca cliente por ID
     * @param {string} id - ID do cliente
     * @returns {object|null} Cliente encontrado ou null
     */
    getClienteById(id) {
        const clientes = this.getClientes();
        return clientes.find(c => c.id === id) || null;
    },

    /**
     * Busca clientes por termo
     * @param {string} termo - Termo de busca
     * @returns {Array} Lista de clientes encontrados
     */
    searchClientes(termo) {
        const clientes = this.getClientes();
        if (!termo) return clientes;

        const termoLower = termo.toLowerCase();
        return clientes.filter(c =>
            c.nome.toLowerCase().includes(termoLower) ||
            c.email.toLowerCase().includes(termoLower) ||
            (c.cpf && c.cpf.includes(termo))
        );
    },

    // =====================
    // COTAÇÕES
    // =====================

    /**
     * Retorna todas as cotações
     * @returns {Array} Lista de cotações
     */
    getCotacoes() {
        return this.get(CONFIG.storageKeys.cotacoes, []);
    },

    /**
     * Salva lista de cotações
     * @param {Array} cotacoes - Lista de cotações
     */
    saveCotacoes(cotacoes) {
        return this.save(CONFIG.storageKeys.cotacoes, cotacoes);
    },

    /**
     * Adiciona uma nova cotação
     * @param {object} cotacao - Dados da cotação
     * @returns {object} Cotação criada com ID
     */
    addCotacao(cotacao) {
        const cotacoes = this.getCotacoes();
        const validade = new Date();
        validade.setDate(validade.getDate() + CONFIG.cotacao.validadeDias);

        const novaCotacao = {
            ...cotacao,
            id: this.generateId(),
            dataCriacao: new Date().toISOString(),
            validade: validade.toISOString(),
            status: 'pendente'
        };
        cotacoes.push(novaCotacao);
        this.saveCotacoes(cotacoes);
        return novaCotacao;
    },

    /**
     * Atualiza uma cotação existente
     * @param {string} id - ID da cotação
     * @param {object} dados - Dados atualizados
     * @returns {object|null} Cotação atualizada ou null
     */
    updateCotacao(id, dados) {
        const cotacoes = this.getCotacoes();
        const index = cotacoes.findIndex(c => c.id === id);
        if (index === -1) return null;

        cotacoes[index] = { ...cotacoes[index], ...dados };
        this.saveCotacoes(cotacoes);
        return cotacoes[index];
    },

    /**
     * Remove uma cotação
     * @param {string} id - ID da cotação
     * @returns {boolean} Sucesso da operação
     */
    deleteCotacao(id) {
        const cotacoes = this.getCotacoes();
        const filtrado = cotacoes.filter(c => c.id !== id);
        if (filtrado.length === cotacoes.length) return false;

        this.saveCotacoes(filtrado);
        return true;
    },

    /**
     * Busca cotação por ID
     * @param {string} id - ID da cotação
     * @returns {object|null} Cotação encontrada ou null
     */
    getCotacaoById(id) {
        const cotacoes = this.getCotacoes();
        return cotacoes.find(c => c.id === id) || null;
    },

    /**
     * Busca cotações por cliente
     * @param {string} clienteId - ID do cliente
     * @returns {Array} Lista de cotações do cliente
     */
    getCotacoesByCliente(clienteId) {
        const cotacoes = this.getCotacoes();
        return cotacoes.filter(c => c.clienteId === clienteId);
    },

    /**
     * Atualiza status de cotações expiradas
     */
    atualizarCotacoesExpiradas() {
        const cotacoes = this.getCotacoes();
        const agora = new Date();
        let atualizado = false;

        cotacoes.forEach(c => {
            if (c.status === 'pendente' && new Date(c.validade) < agora) {
                c.status = 'expirada';
                atualizado = true;
            }
        });

        if (atualizado) {
            this.saveCotacoes(cotacoes);
        }
    },

    // =====================
    // CACHE DE BUSCA
    // =====================

    /**
     * Salva resultado de busca no cache
     * @param {string} key - Chave única da busca
     * @param {Array} resultados - Resultados da busca
     */
    cacheBusca(key, resultados) {
        const cache = this.get(CONFIG.storageKeys.buscaCache, {});
        cache[key] = {
            resultados,
            timestamp: Date.now()
        };

        // Limpa cache antigo
        const expiracao = CONFIG.busca.cacheMinutos * 60 * 1000;
        Object.keys(cache).forEach(k => {
            if (Date.now() - cache[k].timestamp > expiracao) {
                delete cache[k];
            }
        });

        this.save(CONFIG.storageKeys.buscaCache, cache);
    },

    /**
     * Recupera busca do cache
     * @param {string} key - Chave única da busca
     * @returns {Array|null} Resultados ou null se expirado/inexistente
     */
    getCacheBusca(key) {
        const cache = this.get(CONFIG.storageKeys.buscaCache, {});
        const item = cache[key];

        if (!item) return null;

        const expiracao = CONFIG.busca.cacheMinutos * 60 * 1000;
        if (Date.now() - item.timestamp > expiracao) {
            delete cache[key];
            this.save(CONFIG.storageKeys.buscaCache, cache);
            return null;
        }

        return item.resultados;
    },

    /**
     * Salva última busca realizada
     * @param {object} busca - Parâmetros da busca
     */
    saveUltimaBusca(busca) {
        sessionStorage.setItem(CONFIG.storageKeys.ultimaBusca, JSON.stringify(busca));
    },

    /**
     * Recupera última busca
     * @returns {object|null} Parâmetros da última busca
     */
    getUltimaBusca() {
        try {
            const data = sessionStorage.getItem(CONFIG.storageKeys.ultimaBusca);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    // =====================
    // FORNECEDORES
    // =====================

    /**
     * Retorna todos os fornecedores
     * @returns {Array} Lista de fornecedores
     */
    getFornecedores() {
        return this.get(CONFIG.storageKeys.fornecedores, []);
    },

    /**
     * Salva lista de fornecedores
     * @param {Array} fornecedores - Lista de fornecedores
     */
    saveFornecedores(fornecedores) {
        return this.save(CONFIG.storageKeys.fornecedores, fornecedores);
    },

    /**
     * Adiciona um novo fornecedor
     * @param {object} fornecedor - Dados do fornecedor
     * @returns {object} Fornecedor criado com ID
     */
    addFornecedor(fornecedor) {
        const fornecedores = this.getFornecedores();
        const novoFornecedor = {
            ...fornecedor,
            id: this.generateId(),
            dataCadastro: new Date().toISOString()
        };
        fornecedores.push(novoFornecedor);
        this.saveFornecedores(fornecedores);
        return novoFornecedor;
    },

    /**
     * Atualiza um fornecedor existente
     * @param {string} id - ID do fornecedor
     * @param {object} dados - Dados atualizados
     * @returns {object|null} Fornecedor atualizado ou null
     */
    updateFornecedor(id, dados) {
        const fornecedores = this.getFornecedores();
        const index = fornecedores.findIndex(f => f.id === id);
        if (index === -1) return null;

        fornecedores[index] = { ...fornecedores[index], ...dados };
        this.saveFornecedores(fornecedores);
        return fornecedores[index];
    },

    /**
     * Remove um fornecedor
     * @param {string} id - ID do fornecedor
     * @returns {boolean} Sucesso da operação
     */
    deleteFornecedor(id) {
        const fornecedores = this.getFornecedores();
        const filtrado = fornecedores.filter(f => f.id !== id);
        if (filtrado.length === fornecedores.length) return false;

        this.saveFornecedores(filtrado);
        return true;
    },

    /**
     * Busca fornecedor por ID
     * @param {string} id - ID do fornecedor
     * @returns {object|null} Fornecedor encontrado ou null
     */
    getFornecedorById(id) {
        const fornecedores = this.getFornecedores();
        return fornecedores.find(f => f.id === id) || null;
    },

    /**
     * Busca fornecedores por termo
     * @param {string} termo - Termo de busca
     * @returns {Array} Lista de fornecedores encontrados
     */
    searchFornecedores(termo) {
        const fornecedores = this.getFornecedores();
        if (!termo) return fornecedores;

        const termoLower = termo.toLowerCase();
        return fornecedores.filter(f =>
            f.nome.toLowerCase().includes(termoLower) ||
            (f.telegram && f.telegram.toLowerCase().includes(termoLower)) ||
            (f.balcao && f.balcao.toLowerCase().includes(termoLower))
        );
    },

    // =====================
    // BILHETES
    // =====================

    /**
     * Retorna todos os bilhetes
     * @returns {Array} Lista de bilhetes
     */
    getBilhetes() {
        return this.get(CONFIG.storageKeys.bilhetes, []);
    },

    /**
     * Salva lista de bilhetes
     * @param {Array} bilhetes - Lista de bilhetes
     */
    saveBilhetes(bilhetes) {
        return this.save(CONFIG.storageKeys.bilhetes, bilhetes);
    },

    /**
     * Adiciona um novo bilhete
     * @param {object} bilhete - Dados do bilhete
     * @returns {object} Bilhete criado com ID
     */
    addBilhete(bilhete) {
        const bilhetes = this.getBilhetes();
        const novoBilhete = {
            ...bilhete,
            id: this.generateId(),
            dataCriacao: new Date().toISOString()
        };
        bilhetes.push(novoBilhete);
        this.saveBilhetes(bilhetes);
        return novoBilhete;
    },

    /**
     * Atualiza um bilhete existente
     * @param {string} id - ID do bilhete
     * @param {object} dados - Dados atualizados
     * @returns {object|null} Bilhete atualizado ou null
     */
    updateBilhete(id, dados) {
        const bilhetes = this.getBilhetes();
        const index = bilhetes.findIndex(b => b.id === id);
        if (index === -1) return null;

        bilhetes[index] = { ...bilhetes[index], ...dados };
        this.saveBilhetes(bilhetes);
        return bilhetes[index];
    },

    /**
     * Remove um bilhete
     * @param {string} id - ID do bilhete
     * @returns {boolean} Sucesso da operação
     */
    deleteBilhete(id) {
        const bilhetes = this.getBilhetes();
        const filtrado = bilhetes.filter(b => b.id !== id);
        if (filtrado.length === bilhetes.length) return false;

        this.saveBilhetes(filtrado);
        return true;
    },

    /**
     * Busca bilhete por ID
     * @param {string} id - ID do bilhete
     * @returns {object|null} Bilhete encontrado ou null
     */
    getBilheteById(id) {
        const bilhetes = this.getBilhetes();
        return bilhetes.find(b => b.id === id) || null;
    },

    /**
     * Busca bilhetes por cliente
     * @param {string} clienteId - ID do cliente
     * @returns {Array} Lista de bilhetes do cliente
     */
    getBilhetesByCliente(clienteId) {
        const bilhetes = this.getBilhetes();
        return bilhetes.filter(b => b.clienteId === clienteId);
    },

    /**
     * Busca bilhetes por fornecedor
     * @param {string} fornecedorId - ID do fornecedor
     * @returns {Array} Lista de bilhetes do fornecedor
     */
    getBilhetesByFornecedor(fornecedorId) {
        const bilhetes = this.getBilhetes();
        return bilhetes.filter(b => b.fornecedorId === fornecedorId);
    },

    // =====================
    // RESERVAS
    // =====================

    /**
     * Retorna todas as reservas
     * @returns {Array} Lista de reservas
     */
    getReservas() {
        return this.get(CONFIG.storageKeys.reservas, []);
    },

    /**
     * Salva lista de reservas
     * @param {Array} reservas - Lista de reservas
     */
    saveReservas(reservas) {
        return this.save(CONFIG.storageKeys.reservas, reservas);
    },

    /**
     * Adiciona uma nova reserva
     * @param {object} reserva - Dados da reserva
     * @returns {object} Reserva criada com ID
     */
    addReserva(reserva) {
        const reservas = this.getReservas();
        const novaReserva = {
            ...reserva,
            id: this.generateId(),
            dataCriacao: new Date().toISOString()
        };
        reservas.push(novaReserva);
        this.saveReservas(reservas);
        return novaReserva;
    },

    /**
     * Atualiza uma reserva existente
     * @param {string} id - ID da reserva
     * @param {object} dados - Dados atualizados
     * @returns {object|null} Reserva atualizada ou null
     */
    updateReserva(id, dados) {
        const reservas = this.getReservas();
        const index = reservas.findIndex(r => r.id === id);
        if (index === -1) return null;

        reservas[index] = { ...reservas[index], ...dados };
        this.saveReservas(reservas);
        return reservas[index];
    },

    /**
     * Remove uma reserva
     * @param {string} id - ID da reserva
     * @returns {boolean} Sucesso da operação
     */
    deleteReserva(id) {
        const reservas = this.getReservas();
        const filtrado = reservas.filter(r => r.id !== id);
        if (filtrado.length === reservas.length) return false;

        this.saveReservas(filtrado);
        return true;
    },

    /**
     * Busca reserva por ID
     * @param {string} id - ID da reserva
     * @returns {object|null} Reserva encontrada ou null
     */
    getReservaById(id) {
        const reservas = this.getReservas();
        return reservas.find(r => r.id === id) || null;
    },

    // =====================
    // UTILITÁRIOS
    // =====================

    /**
     * Gera um ID único
     * @returns {string} ID único
     */
    generateId() {
        return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Retorna estatísticas para o dashboard
     * @returns {object} Estatísticas
     */
    getEstatisticas() {
        const cotacoes = this.getCotacoes();
        const clientes = this.getClientes();

        const totalCotacoes = cotacoes.length;
        const cotacoesPendentes = cotacoes.filter(c => c.status === 'pendente').length;
        const cotacoesAprovadas = cotacoes.filter(c => c.status === 'aprovada').length;

        const valorTotal = cotacoes.reduce((sum, c) => sum + (c.total || 0), 0);
        const valorMedio = totalCotacoes > 0 ? valorTotal / totalCotacoes : 0;

        // Destinos mais buscados
        const destinosCount = {};
        cotacoes.forEach(c => {
            if (c.voos && c.voos.length > 0) {
                const destino = c.voos[0].destino;
                destinosCount[destino] = (destinosCount[destino] || 0) + 1;
            }
        });
        const topDestinos = Object.entries(destinosCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([codigo, count]) => ({ codigo, count }));

        return {
            totalClientes: clientes.length,
            totalCotacoes,
            cotacoesPendentes,
            cotacoesAprovadas,
            valorTotal,
            valorMedio,
            topDestinos
        };
    },

    /**
     * Inicializa dados de exemplo (para demonstração)
     */
    initDadosExemplo() {
        // Só inicializa se não houver dados
        if (this.getClientes().length > 0) return;

        const clientesExemplo = [
            {
                nome: 'Maria Silva',
                email: 'maria.silva@email.com',
                telefone: '11999998888',
                cpf: '12345678901'
            },
            {
                nome: 'João Santos',
                email: 'joao.santos@email.com',
                telefone: '11988887777',
                cpf: '98765432100'
            },
            {
                nome: 'Ana Oliveira',
                email: 'ana.oliveira@email.com',
                telefone: '11977776666',
                cpf: '45678912300'
            }
        ];

        clientesExemplo.forEach(c => this.addCliente(c));
        debugLog('Storage: Dados de exemplo inicializados');
    }
};

// Exportar para uso global
window.Storage = Storage;
