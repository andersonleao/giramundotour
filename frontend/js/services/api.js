/**
 * GiraMundoTour - Serviço de API
 *
 * Comunicação com o backend
 */

const ApiService = {
    baseUrl: window.location.origin + '/api',

    /**
     * Obtém o token de autenticação
     */
    getToken() {
        return localStorage.getItem('giramundo_token');
    },

    /**
     * Obtém o usuário logado
     */
    getUser() {
        const user = localStorage.getItem('giramundo_user');
        return user ? JSON.parse(user) : null;
    },

    /**
     * Verifica se está autenticado
     */
    isAuthenticated() {
        return !!this.getToken();
    },

    /**
     * Faz logout
     */
    logout() {
        localStorage.removeItem('giramundo_token');
        localStorage.removeItem('giramundo_user');
        window.location.href = 'login.html';
    },

    /**
     * Headers padrão para requisições
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    },

    /**
     * Requisição GET
     */
    async get(endpoint, params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${this.baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (response.status === 401) {
                this.logout();
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Erro na requisição GET:', error);
            throw error;
        }
    },

    /**
     * Requisição POST
     */
    async post(endpoint, data = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });

            if (response.status === 401) {
                this.logout();
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Erro na requisição POST:', error);
            throw error;
        }
    },

    /**
     * Requisição PUT
     */
    async put(endpoint, data = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });

            if (response.status === 401) {
                this.logout();
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Erro na requisição PUT:', error);
            throw error;
        }
    },

    /**
     * Requisição DELETE
     */
    async delete(endpoint) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (response.status === 401) {
                this.logout();
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Erro na requisição DELETE:', error);
            throw error;
        }
    },

    // =============================================
    // Métodos específicos de API
    // =============================================

    // Auth
    auth: {
        async login(email, senha) {
            return ApiService.post('/auth/login', { email, senha });
        },
        async me() {
            return ApiService.get('/auth/me');
        },
        async changePassword(senhaAtual, novaSenha) {
            return ApiService.put('/auth/password', { senhaAtual, novaSenha });
        }
    },

    // Clientes
    clientes: {
        async list(params = {}) {
            return ApiService.get('/clientes', params);
        },
        async get(id) {
            return ApiService.get(`/clientes/${id}`);
        },
        async create(data) {
            return ApiService.post('/clientes', data);
        },
        async update(id, data) {
            return ApiService.put(`/clientes/${id}`, data);
        },
        async delete(id) {
            return ApiService.delete(`/clientes/${id}`);
        }
    },

    // Fornecedores
    fornecedores: {
        async list(params = {}) {
            return ApiService.get('/fornecedores', params);
        },
        async get(id) {
            return ApiService.get(`/fornecedores/${id}`);
        },
        async create(data) {
            return ApiService.post('/fornecedores', data);
        },
        async update(id, data) {
            return ApiService.put(`/fornecedores/${id}`, data);
        },
        async delete(id) {
            return ApiService.delete(`/fornecedores/${id}`);
        }
    },

    // Bilhetes
    bilhetes: {
        async list(params = {}) {
            return ApiService.get('/bilhetes', params);
        },
        async get(id) {
            return ApiService.get(`/bilhetes/${id}`);
        },
        async create(data) {
            return ApiService.post('/bilhetes', data);
        },
        async update(id, data) {
            return ApiService.put(`/bilhetes/${id}`, data);
        },
        async delete(id) {
            return ApiService.delete(`/bilhetes/${id}`);
        }
    },

    // Cotações
    cotacoes: {
        async list(params = {}) {
            return ApiService.get('/cotacoes', params);
        },
        async get(id) {
            return ApiService.get(`/cotacoes/${id}`);
        },
        async create(data) {
            return ApiService.post('/cotacoes', data);
        },
        async update(id, data) {
            return ApiService.put(`/cotacoes/${id}`, data);
        },
        async delete(id) {
            return ApiService.delete(`/cotacoes/${id}`);
        }
    },

    // Dashboard
    dashboard: {
        async resumo() {
            return ApiService.get('/dashboard/resumo');
        },
        async bilhetesPorMes(ano) {
            return ApiService.get('/dashboard/bilhetes-por-mes', { ano });
        },
        async companhias() {
            return ApiService.get('/dashboard/companhias');
        },
        async fornecedoresRanking() {
            return ApiService.get('/dashboard/fornecedores-ranking');
        },
        async ultimosBilhetes() {
            return ApiService.get('/dashboard/ultimos-bilhetes');
        }
    }
};

// Exportar para uso global
window.ApiService = ApiService;
