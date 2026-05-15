// GiraMundoTour - Módulo de Fornecedores

const SuppliersModule = {
    _fornecedores: [],

    init() {
        debugLog('SuppliersModule: Inicializado');
    },

    render() {
        const container = document.getElementById('fornecedoresContent');
        if (!container) return;

        container.innerHTML = `
            <div class="row mb-4">
                <div class="col-md-8">
                    <div class="input-group">
                        <span class="input-group-text"><i class="bi bi-search"></i></span>
                        <input type="text" class="form-control" id="buscaFornecedor"
                               placeholder="Buscar por nome, telegram ou balcão...">
                    </div>
                </div>
                <div class="col-md-4 text-end">
                    <button class="btn btn-primary" onclick="SuppliersModule.abrirModalNovoFornecedor()">
                        <i class="bi bi-plus-circle"></i> Novo Fornecedor
                    </button>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <i class="bi bi-building"></i> Lista de Fornecedores
                    <span class="badge bg-primary ms-2" id="totalFornecedores">0</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Telegram</th>
                                    <th>Balcão</th>
                                    <th>Telefone</th>
                                    <th>Cadastro</th>
                                    <th class="text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="tabelaFornecedores">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Modal Fornecedor -->
            <div class="modal fade" id="modalFornecedor" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modalFornecedorTitulo">Novo Fornecedor</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="formFornecedor">
                                <input type="hidden" id="fornecedorId">

                                <div class="mb-3">
                                    <label class="form-label">Nome do Fornecedor *</label>
                                    <input type="text" class="form-control" id="fornecedorNome" name="nome" required
                                           placeholder="Ex: Agência Viagens Brasil">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Nome no Telegram</label>
                                    <div class="input-group">
                                        <span class="input-group-text">@</span>
                                        <input type="text" class="form-control" id="fornecedorTelegram" name="telegram"
                                               placeholder="usuario_telegram">
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Balcão</label>
                                    <input type="text" class="form-control" id="fornecedorBalcao" name="balcao"
                                           placeholder="Ex: Balcão Central SP">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Telefone</label>
                                    <input type="tel" class="form-control" id="fornecedorTelefone" name="telefone"
                                           placeholder="(11) 99999-9999">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Observações</label>
                                    <textarea class="form-control" id="fornecedorObservacoes" name="observacoes" rows="2"
                                              placeholder="Informações adicionais..."></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="SuppliersModule.salvarFornecedor()">
                                <i class="bi bi-check-lg"></i> Salvar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
        this.carregarFornecedores();
    },

    bindEvents() {
        const buscaInput = document.getElementById('buscaFornecedor');
        if (buscaInput) {
            let debounceTimer;
            buscaInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.carregarFornecedores(e.target.value);
                }, 300);
            });
        }

    },

    async carregarFornecedores(busca = '') {
        const tbody = document.getElementById('tabelaFornecedores');
        const totalBadge = document.getElementById('totalFornecedores');
        if (!tbody) return;

        const url = busca ? `/api/fornecedores?ativo=true&busca=${encodeURIComponent(busca)}` : '/api/fornecedores?ativo=true';
        const resp = await apiCall(url);
        if (!resp) return;

        const result = await resp.json();
        if (!result.success) return;

        this._fornecedores = result.data || [];
        const fornecedores = this._fornecedores;

        if (totalBadge) totalBadge.textContent = fornecedores.length;

        if (fornecedores.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <div class="empty-state">
                            <i class="bi bi-building"></i>
                            <h5>Nenhum fornecedor encontrado</h5>
                            <p class="text-muted">${busca ? 'Tente outro termo de busca' : 'Cadastre seu primeiro fornecedor'}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = fornecedores.map(fornecedor => `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-circle me-2" style="width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white;">
                            ${fornecedor.nome.charAt(0).toUpperCase()}
                        </div>
                        <span class="fw-medium">${fornecedor.nome}</span>
                    </div>
                </td>
                <td>
                    ${fornecedor.telegram ? `<i class="bi bi-telegram text-info"></i> @${fornecedor.telegram}` : '<span class="text-muted">-</span>'}
                </td>
                <td>${fornecedor.balcao || '<span class="text-muted">-</span>'}</td>
                <td>${Formatter.phone(fornecedor.telefone)}</td>
                <td>${Formatter.date(fornecedor.createdAt)}</td>
                <td class="text-center">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-secondary" onclick="SuppliersModule.editarFornecedor('${fornecedor.id}')"
                                title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="SuppliersModule.excluirFornecedor('${fornecedor.id}')"
                                title="Excluir">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    abrirModalNovoFornecedor() {
        document.getElementById('modalFornecedorTitulo').textContent = 'Novo Fornecedor';
        document.getElementById('fornecedorId').value = '';
        document.getElementById('formFornecedor').reset();

        const modal = new bootstrap.Modal(document.getElementById('modalFornecedor'));
        modal.show();
    },

    editarFornecedor(id) {
        const fornecedor = this._fornecedores.find(f => f.id === id);
        if (!fornecedor) return;

        document.getElementById('modalFornecedorTitulo').textContent = 'Editar Fornecedor';
        document.getElementById('fornecedorId').value = id;
        document.getElementById('fornecedorNome').value = fornecedor.nome;
        document.getElementById('fornecedorTelegram').value = fornecedor.telegram || '';
        document.getElementById('fornecedorBalcao').value = fornecedor.balcao || '';
        document.getElementById('fornecedorTelefone').value = Formatter.phone(fornecedor.telefone);
        document.getElementById('fornecedorObservacoes').value = fornecedor.observacoes || '';

        const modal = new bootstrap.Modal(document.getElementById('modalFornecedor'));
        modal.show();
    },

    async salvarFornecedor() {
        const dados = {
            nome: document.getElementById('fornecedorNome').value.trim(),
            telegram: document.getElementById('fornecedorTelegram').value.trim().replace('@', ''),
            balcao: document.getElementById('fornecedorBalcao').value.trim(),
            telefone: document.getElementById('fornecedorTelefone').value.replace(/\D/g, ''),
            observacoes: document.getElementById('fornecedorObservacoes').value.trim()
        };

        if (!dados.nome) {
            alert('Nome do fornecedor é obrigatório');
            return;
        }

        const id = document.getElementById('fornecedorId').value;
        const url = id ? `/api/fornecedores/${id}` : '/api/fornecedores';
        const method = id ? 'PUT' : 'POST';

        const resp = await apiCall(url, { method, body: JSON.stringify(dados) });
        if (!resp) return;

        const result = await resp.json();
        if (!result.success) {
            App.showToast(result.message || 'Erro ao salvar fornecedor', 'error');
            return;
        }

        App.showToast(id ? 'Fornecedor atualizado!' : 'Fornecedor cadastrado!', 'success');

        const modal = bootstrap.Modal.getInstance(document.getElementById('modalFornecedor'));
        modal.hide();

        this.carregarFornecedores(document.getElementById('buscaFornecedor')?.value || '');
    },

    async excluirFornecedor(id) {
        const fornecedor = this._fornecedores.find(f => f.id === id);
        if (!fornecedor) return;

        if (!confirm(`Deseja realmente excluir o fornecedor "${fornecedor.nome}"?`)) return;

        const resp = await apiCall(`/api/fornecedores/${id}`, { method: 'DELETE' });
        if (!resp) return;

        const result = await resp.json();
        if (!result.success) {
            App.showToast(result.message || 'Erro ao excluir fornecedor', 'error');
            return;
        }

        App.showToast('Fornecedor excluído!', 'success');
        this.carregarFornecedores(document.getElementById('buscaFornecedor')?.value || '');
    },

    /**
     * Retorna lista de fornecedores para select (usa cache)
     */
    getSelectOptions() {
        return this._fornecedores.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
    },

    /**
     * Carrega fornecedores no cache (usado por outros módulos)
     */
    async carregarCache() {
        const resp = await apiCall('/api/fornecedores');
        if (!resp) return [];
        const result = await resp.json();
        this._fornecedores = result.data || [];
        return this._fornecedores;
    }
};

window.SuppliersModule = SuppliersModule;
