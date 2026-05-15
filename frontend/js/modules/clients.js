// GiraMundoTour - Módulo de Clientes

const ClientsModule = {
    _clientes: [],

    init() {
        debugLog('ClientsModule: Inicializado');
    },

    render() {
        const container = document.getElementById('clientesContent');
        if (!container) return;

        container.innerHTML = `
            <div class="row mb-4">
                <div class="col-md-8">
                    <div class="input-group">
                        <span class="input-group-text"><i class="bi bi-search"></i></span>
                        <input type="text" class="form-control" id="buscaCliente"
                               placeholder="Buscar por nome, email ou CPF...">
                    </div>
                </div>
                <div class="col-md-4 text-end">
                    <button class="btn btn-primary" onclick="ClientsModule.abrirModalNovoCliente()">
                        <i class="bi bi-person-plus"></i> Novo Cliente
                    </button>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <i class="bi bi-people"></i> Lista de Clientes
                    <span class="badge bg-primary ms-2" id="totalClientes">0</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Email</th>
                                    <th>Telefone</th>
                                    <th>CPF / CNPJ</th>
                                    <th>Cadastro</th>
                                    <th>Cotações</th>
                                    <th class="text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="tabelaClientes">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Modal Cliente -->
            <div class="modal fade" id="modalCliente" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modalClienteTitulo">Novo Cliente</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="formCliente">
                                <input type="hidden" id="clienteId">

                                <div class="mb-3">
                                    <label class="form-label">Nome *</label>
                                    <input type="text" class="form-control" id="clienteNome" name="nome" required>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Email</label>
                                    <input type="email" class="form-control" id="clienteEmail" name="email">
                                </div>

                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Telefone</label>
                                        <input type="tel" class="form-control" id="clienteTelefone" name="telefone">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">CPF</label>
                                        <input type="text" class="form-control" id="clienteCpf" name="cpf" placeholder="000.000.000-00">
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">CNPJ <span class="text-muted small">(pessoa jurídica)</span></label>
                                    <input type="text" class="form-control" id="clienteCnpj" name="cnpj" placeholder="00.000.000/0000-00">
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="ClientsModule.salvarCliente()">
                                <i class="bi bi-check-lg"></i> Salvar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Histórico -->
            <div class="modal fade" id="modalHistorico" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Histórico de Cotações</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="historicoContent">
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
        this.carregarClientes();
    },

    bindEvents() {
        const buscaInput = document.getElementById('buscaCliente');
        if (buscaInput) {
            let debounceTimer;
            buscaInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.carregarClientes(e.target.value);
                }, 300);
            });
        }

        const form = document.getElementById('formCliente');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.salvarCliente();
            });
        }

        const telefoneInput = document.getElementById('clienteTelefone');
        if (telefoneInput) {
            telefoneInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 11) value = value.substring(0, 11);
                if (value.length > 6) {
                    value = `(${value.substring(0, 2)}) ${value.substring(2, 7)}-${value.substring(7)}`;
                } else if (value.length > 2) {
                    value = `(${value.substring(0, 2)}) ${value.substring(2)}`;
                }
                e.target.value = value;
            });
        }

        const cpfInput = document.getElementById('clienteCpf');
        if (cpfInput) {
            cpfInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 11) value = value.substring(0, 11);
                if (value.length > 9) {
                    value = `${value.substring(0, 3)}.${value.substring(3, 6)}.${value.substring(6, 9)}-${value.substring(9)}`;
                } else if (value.length > 6) {
                    value = `${value.substring(0, 3)}.${value.substring(3, 6)}.${value.substring(6)}`;
                } else if (value.length > 3) {
                    value = `${value.substring(0, 3)}.${value.substring(3)}`;
                }
                e.target.value = value;
            });
        }

        const cnpjInput = document.getElementById('clienteCnpj');
        if (cnpjInput) {
            cnpjInput.addEventListener('input', (e) => {
                let v = e.target.value.replace(/\D/g, '');
                if (v.length > 14) v = v.substring(0, 14);
                if (v.length > 12) {
                    v = `${v.substring(0,2)}.${v.substring(2,5)}.${v.substring(5,8)}/${v.substring(8,12)}-${v.substring(12)}`;
                } else if (v.length > 8) {
                    v = `${v.substring(0,2)}.${v.substring(2,5)}.${v.substring(5,8)}/${v.substring(8)}`;
                } else if (v.length > 5) {
                    v = `${v.substring(0,2)}.${v.substring(2,5)}.${v.substring(5)}`;
                } else if (v.length > 2) {
                    v = `${v.substring(0,2)}.${v.substring(2)}`;
                }
                e.target.value = v;
            });
        }
    },

    async carregarClientes(busca = '') {
        const tbody = document.getElementById('tabelaClientes');
        const totalBadge = document.getElementById('totalClientes');
        if (!tbody) return;

        const url = busca ? `/api/clientes?ativo=true&busca=${encodeURIComponent(busca)}` : '/api/clientes?ativo=true';
        const resp = await apiCall(url);
        if (!resp) return;

        const result = await resp.json();
        if (!result.success) return;

        this._clientes = result.data || [];
        const clientes = this._clientes;

        if (totalBadge) totalBadge.textContent = clientes.length;

        if (clientes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5">
                        <div class="empty-state">
                            <i class="bi bi-people"></i>
                            <h5>Nenhum cliente encontrado</h5>
                            <p class="text-muted">${busca ? 'Tente outro termo de busca' : 'Cadastre seu primeiro cliente'}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = clientes.map(cliente => {
            const numCotacoes = cliente._count?.cotacoes || 0;
            return `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="avatar-circle me-2" style="background-color: var(--primary); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                ${cliente.nome.charAt(0).toUpperCase()}
                            </div>
                            <span class="fw-medium">${cliente.nome}</span>
                        </div>
                    </td>
                    <td>${cliente.email || '-'}</td>
                    <td>${Formatter.phone(cliente.telefone)}</td>
                    <td>${cliente.cpf ? Formatter.cpf(cliente.cpf) : (cliente.cnpj ? Formatter.cnpj(cliente.cnpj) : '-')}</td>
                    <td>${Formatter.date(cliente.createdAt)}</td>
                    <td>
                        <span class="badge bg-secondary">${numCotacoes}</span>
                    </td>
                    <td class="text-center">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="ClientsModule.verHistorico('${cliente.id}')"
                                    title="Ver Histórico" ${numCotacoes === 0 ? 'disabled' : ''}>
                                <i class="bi bi-clock-history"></i>
                            </button>
                            <button class="btn btn-outline-secondary" onclick="ClientsModule.editarCliente('${cliente.id}')"
                                    title="Editar">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="ClientsModule.excluirCliente('${cliente.id}')"
                                    title="Excluir">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    abrirModalNovoCliente() {
        document.getElementById('modalClienteTitulo').textContent = 'Novo Cliente';
        document.getElementById('clienteId').value = '';
        document.getElementById('formCliente').reset();
        const cnpjEl = document.getElementById('clienteCnpj');
        if (cnpjEl) cnpjEl.value = '';
        if (window.Validators) Validators.clearFormErrors(document.getElementById('formCliente'));

        const modal = new bootstrap.Modal(document.getElementById('modalCliente'));
        modal.show();
    },

    editarCliente(id) {
        const cliente = this._clientes.find(c => c.id === id);
        if (!cliente) return;

        document.getElementById('modalClienteTitulo').textContent = 'Editar Cliente';
        document.getElementById('clienteId').value = id;
        document.getElementById('clienteNome').value = cliente.nome;
        document.getElementById('clienteEmail').value = cliente.email || '';
        document.getElementById('clienteTelefone').value = Formatter.phone(cliente.telefone);
        document.getElementById('clienteCpf').value = cliente.cpf ? Formatter.cpf(cliente.cpf) : '';
        document.getElementById('clienteCnpj').value = cliente.cnpj ? Formatter.cnpj(cliente.cnpj) : '';

        if (window.Validators) Validators.clearFormErrors(document.getElementById('formCliente'));

        const modal = new bootstrap.Modal(document.getElementById('modalCliente'));
        modal.show();
    },

    async salvarCliente() {
        const form = document.getElementById('formCliente');

        const dados = {
            nome: document.getElementById('clienteNome').value.trim(),
            email: document.getElementById('clienteEmail').value.trim(),
            telefone: document.getElementById('clienteTelefone').value.replace(/\D/g, ''),
            cpf: document.getElementById('clienteCpf').value.replace(/\D/g, ''),
            cnpj: document.getElementById('clienteCnpj').value.replace(/\D/g, '')
        };

        if (window.Validators) {
            const validacao = Validators.clientForm(dados);
            if (!validacao.valid) {
                Validators.showFormErrors(validacao.errors, form);
                return;
            }
        } else if (!dados.nome) {
            alert('Nome é obrigatório');
            return;
        }

        const id = document.getElementById('clienteId').value;
        const url = id ? `/api/clientes/${id}` : '/api/clientes';
        const method = id ? 'PUT' : 'POST';

        const resp = await apiCall(url, { method, body: JSON.stringify(dados) });
        if (!resp) return;

        const result = await resp.json();
        if (!result.success) {
            App.showToast(result.message || 'Erro ao salvar cliente', 'error');
            return;
        }

        App.showToast(id ? 'Cliente atualizado!' : 'Cliente cadastrado!', 'success');

        const modal = bootstrap.Modal.getInstance(document.getElementById('modalCliente'));
        modal.hide();

        this.carregarClientes(document.getElementById('buscaCliente')?.value || '');
    },

    async excluirCliente(id) {
        const cliente = this._clientes.find(c => c.id === id);
        if (!cliente) return;

        const numCotacoes = cliente._count?.cotacoes || 0;
        let mensagem = `Deseja realmente excluir o cliente "${cliente.nome}"?`;
        if (numCotacoes > 0) {
            mensagem += `\n\nAtenção: Este cliente possui ${numCotacoes} cotação(ões) associada(s).`;
        }

        if (!confirm(mensagem)) return;

        const resp = await apiCall(`/api/clientes/${id}`, { method: 'DELETE' });
        if (!resp) return;

        const result = await resp.json();
        if (!result.success) {
            App.showToast(result.message || 'Erro ao excluir cliente', 'error');
            return;
        }

        App.showToast('Cliente excluído!', 'success');
        this.carregarClientes(document.getElementById('buscaCliente')?.value || '');
    },

    async verHistorico(clienteId) {
        const cliente = this._clientes.find(c => c.id === clienteId);
        if (!cliente) return;

        const resp = await apiCall(`/api/cotacoes?clienteId=${clienteId}`);
        if (!resp) return;

        const result = await resp.json();
        const cotacoes = result.data || [];

        if (cotacoes.length === 0) return;

        const content = document.getElementById('historicoContent');

        content.innerHTML = `
            <div class="mb-4">
                <h6 class="text-primary">${cliente.nome}</h6>
                <small class="text-muted">${cliente.email || ''}</small>
            </div>

            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Rota</th>
                            <th>Passageiros</th>
                            <th>Valor</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cotacoes.map(cot => {
                            const status = Formatter.quotationStatus(cot.status);
                            let voos = cot.voos;
                            if (typeof voos === 'string') { try { voos = JSON.parse(voos); } catch(e) { voos = []; } }
                            const rota = voos && voos.length > 0 ? `${voos[0].origem} → ${voos[0].destino}` : '-';
                            let pax = cot.passageiros;
                            if (typeof pax === 'string') { try { pax = JSON.parse(pax); } catch(e) { pax = {}; } }

                            return `
                                <tr>
                                    <td>${Formatter.date(cot.createdAt)}</td>
                                    <td>${rota}</td>
                                    <td>${Formatter.passengers(pax)}</td>
                                    <td class="fw-bold">${Formatter.currency(cot.total)}</td>
                                    <td><span class="badge ${status.class}">${status.text}</span></td>
                                    <td>
                                        <button class="btn btn-sm btn-outline-primary"
                                                onclick="ClientsModule.abrirCotacao('${cot.id}')">
                                            <i class="bi bi-eye"></i>
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <div class="mt-3 p-3 bg-light rounded">
                <div class="row text-center">
                    <div class="col">
                        <strong>${cotacoes.length}</strong>
                        <br><small class="text-muted">Cotações</small>
                    </div>
                    <div class="col">
                        <strong>${Formatter.currency(cotacoes.reduce((sum, c) => sum + (c.total || 0), 0))}</strong>
                        <br><small class="text-muted">Total</small>
                    </div>
                    <div class="col">
                        <strong>${cotacoes.filter(c => c.status === 'aprovada').length}</strong>
                        <br><small class="text-muted">Aprovadas</small>
                    </div>
                </div>
            </div>
        `;

        const modal = new bootstrap.Modal(document.getElementById('modalHistorico'));
        modal.show();
    },

    abrirCotacao(cotacaoId) {
        const modalHistorico = bootstrap.Modal.getInstance(document.getElementById('modalHistorico'));
        if (modalHistorico) modalHistorico.hide();

        QuotationModule.carregarCotacao(cotacaoId);
        App.navigate('cotacao');
    }
};

window.ClientsModule = ClientsModule;
