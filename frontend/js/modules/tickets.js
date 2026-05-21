// GiraMundoTour - Módulo de Emissão de Bilhetes

const TicketsModule = {
    _bilhetes: [],
    _clientes: [],
    _fornecedores: [],
    _totais: { vendas: 0, compras: 0, lucro: 0 },

    /**
     * Inicializa o módulo de bilhetes
     */
    init() {
        debugLog('TicketsModule: Inicializado');
    },

    /**
     * Renderiza a página de bilhetes
     */
    render() {
        const container = document.getElementById('bilhetesContent');
        if (!container) return;

        container.innerHTML = `
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="input-group">
                        <span class="input-group-text"><i class="bi bi-search"></i></span>
                        <input type="text" class="form-control" id="buscaBilhete"
                               placeholder="Buscar por código, cliente ou companhia...">
                    </div>
                </div>
                <div class="col-md-6 text-end">
                    <div class="btn-group">
                        <button class="btn btn-success" onclick="TicketsModule.exportarExcel()">
                            <i class="bi bi-file-earmark-excel"></i> Exportar Excel
                        </button>
                        <button class="btn btn-danger" onclick="TicketsModule.exportarPDF()">
                            <i class="bi bi-file-earmark-pdf"></i> Exportar PDF
                        </button>
                        <button class="btn btn-warning" onclick="TicketsModule.abrirModalImportarPDF()">
                            <i class="bi bi-upload"></i> Importar PDF
                        </button>
                        <button class="btn btn-primary" onclick="TicketsModule.abrirModalNovoBilhete()">
                            <i class="bi bi-ticket-perforated"></i> Emitir Bilhete
                        </button>
                    </div>
                </div>
            </div>

            <!-- Filtros -->
            <div class="card mb-4">
                <div class="card-body py-3">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-3">
                            <label class="form-label small">Data Emissão - De</label>
                            <input type="date" class="form-control form-control-sm" id="filtroDataDe">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small">Data Emissão - Até</label>
                            <input type="date" class="form-control form-control-sm" id="filtroDataAte">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small">Fornecedor</label>
                            <select class="form-select form-select-sm" id="filtroFornecedor">
                                <option value="">Todos</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <button class="btn btn-outline-primary btn-sm w-100" onclick="TicketsModule.aplicarFiltros()">
                                <i class="bi bi-funnel"></i> Filtrar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Resumo -->
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="stat-card info">
                        <div class="stat-icon"><i class="bi bi-ticket-perforated"></i></div>
                        <div class="stat-value" id="totalBilhetes">0</div>
                        <div class="stat-label">Total de Bilhetes</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card primary">
                        <div class="stat-icon"><i class="bi bi-cash-stack"></i></div>
                        <div class="stat-value" id="totalVendas">R$ 0,00</div>
                        <div class="stat-label">Total Vendas</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card warning">
                        <div class="stat-icon"><i class="bi bi-cart"></i></div>
                        <div class="stat-value" id="totalCompras">R$ 0,00</div>
                        <div class="stat-label">Total Compras</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card success">
                        <div class="stat-icon"><i class="bi bi-graph-up-arrow"></i></div>
                        <div class="stat-value" id="totalSaldo">R$ 0,00</div>
                        <div class="stat-label">Lucro Total</div>
                    </div>
                </div>
            </div>

            <!-- Lista de Bilhetes -->
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <span><i class="bi bi-list-ul"></i> Bilhetes Emitidos</span>
                    <span class="badge bg-primary" id="contadorBilhetes">0</span>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Código Reserva</th>
                                    <th>Cliente</th>
                                    <th>Companhia</th>
                                    <th>Ida</th>
                                    <th>Volta</th>
                                    <th>Fornecedor</th>
                                    <th class="text-end">Venda</th>
                                    <th class="text-end">Compra</th>
                                    <th class="text-end">Saldo</th>
                                    <th>Emissão</th>
                                    <th class="text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="tabelaBilhetes">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Modal Bilhete -->
            <div class="modal fade" id="modalBilhete" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modalBilheteTitulo">
                                <i class="bi bi-ticket-perforated"></i> Emitir Bilhete
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="formBilhete">
                                <input type="hidden" id="bilheteId">

                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Cliente *</label>
                                        <select class="form-select" id="bilheteCliente" name="clienteId" required>
                                            <option value="">Selecione o cliente...</option>
                                        </select>
                                    </div>

                                    <div class="col-md-6">
                                        <label class="form-label">Código da Reserva *</label>
                                        <input type="text" class="form-control" id="bilheteCodigoReserva"
                                               name="codigoReserva" required placeholder="Ex: ABC123">
                                    </div>

                                    <div class="col-md-6">
                                        <label class="form-label">Companhia Aérea *</label>
                                        <select class="form-select" id="bilheteCompanhia" name="companhia" required>
                                            <option value="">Selecione a companhia...</option>
                                        </select>
                                    </div>

                                    <div class="col-md-6">
                                        <label class="form-label">Fornecedor *</label>
                                        <select class="form-select" id="bilheteFornecedor" name="fornecedorId" required>
                                            <option value="">Selecione o fornecedor...</option>
                                        </select>
                                    </div>

                                    <div class="col-md-6">
                                        <label class="form-label">Data de Ida *</label>
                                        <input type="date" class="form-control" id="bilheteDataIda" name="dataIda" required>
                                    </div>

                                    <div class="col-md-6">
                                        <label class="form-label">Data de Volta</label>
                                        <input type="date" class="form-control" id="bilheteDataVolta" name="dataVolta">
                                        <small class="text-muted">Deixe em branco para viagem somente ida</small>
                                    </div>

                                    <div class="col-md-6">
                                        <label class="form-label">Origem</label>
                                        <input type="text" class="form-control" id="bilheteOrigem" name="origem"
                                               placeholder="Ex: GRU">
                                    </div>

                                    <div class="col-md-6">
                                        <label class="form-label">Destino</label>
                                        <input type="text" class="form-control" id="bilheteDestino" name="destino"
                                               placeholder="Ex: MIA">
                                    </div>

                                    <div class="col-md-4">
                                        <label class="form-label">Valor de Venda *</label>
                                        <div class="input-group">
                                            <span class="input-group-text">R$</span>
                                            <input type="number" step="0.01" class="form-control" id="bilheteValorVenda"
                                                   name="valorVenda" placeholder="0,00" required onchange="TicketsModule.calcularSaldo()">
                                        </div>
                                    </div>

                                    <div class="col-md-4">
                                        <label class="form-label">Valor de Compra *</label>
                                        <div class="input-group">
                                            <span class="input-group-text">R$</span>
                                            <input type="number" step="0.01" class="form-control" id="bilheteValorCompra"
                                                   name="valorCompra" placeholder="0,00" required onchange="TicketsModule.calcularSaldo()">
                                        </div>
                                    </div>

                                    <div class="col-md-4">
                                        <label class="form-label">Saldo da Venda</label>
                                        <div class="input-group">
                                            <span class="input-group-text">R$</span>
                                            <input type="text" class="form-control" id="bilheteSaldo"
                                                   name="saldo" placeholder="0,00" readonly style="background-color: #f8f9fa; font-weight: bold;">
                                        </div>
                                    </div>

                                    <div class="col-md-6">
                                        <label class="form-label">Data de Emissão *</label>
                                        <input type="date" class="form-control" id="bilheteDataEmissao"
                                               name="dataEmissao" required>
                                    </div>

                                    <div class="col-12">
                                        <label class="form-label">Observações</label>
                                        <textarea class="form-control" id="bilheteObservacoes" name="observacoes"
                                                  rows="2" placeholder="Informações adicionais..."></textarea>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="TicketsModule.salvarBilhete()">
                                <i class="bi bi-check-lg"></i> Salvar Bilhete
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Importar PDF -->
            <div class="modal fade" id="modalImportarPDF" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title">
                                <i class="bi bi-upload"></i> Importar Bilhete de PDF
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <!-- Zona de Upload -->
                            <div id="zonaUploadPDF" class="border border-2 border-dashed rounded p-5 text-center mb-4" style="border-color: #dee2e6; cursor: pointer;">
                                <i class="bi bi-file-earmark-pdf text-danger" style="font-size: 3rem;"></i>
                                <h5 class="mt-2">Arraste um arquivo PDF aqui ou clique para selecionar</h5>
                                <p class="text-muted mb-2">Aceita bilhetes de GOL, LATAM, Azul e outras companhias</p>
                                <input type="file" id="inputPDFFile" accept=".pdf" class="d-none"
                                       onchange="TicketsModule.handlePDFFileSelect(this)">
                                <button class="btn btn-outline-primary" onclick="document.getElementById('inputPDFFile').click()">
                                    <i class="bi bi-folder2-open"></i> Selecionar Arquivo
                                </button>
                            </div>

                            <!-- Loading -->
                            <div id="loadingImportPDF" class="text-center py-4 d-none">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Processando...</span>
                                </div>
                                <p class="mt-2 text-muted">Extraindo dados do PDF...</p>
                            </div>

                            <!-- Formulário de dados extraídos -->
                            <div id="dadosExtraidosPDF" class="d-none">
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle"></i> Dados extraídos automaticamente. Revise e complete os campos antes de salvar.
                                </div>

                                <form id="formImportarPDF">
                                    <div class="row g-3">
                                        <!-- Dados do Voo -->
                                        <div class="col-12">
                                            <h6 class="text-primary border-bottom pb-2">
                                                <i class="bi bi-airplane"></i> Dados do Voo
                                            </h6>
                                        </div>

                                        <div class="col-md-4">
                                            <label class="form-label">Código Reserva *</label>
                                            <input type="text" class="form-control" id="importCodigoReserva" required>
                                        </div>

                                        <div class="col-md-8">
                                            <label class="form-label">Companhia Aérea *</label>
                                            <select class="form-select" id="importCompanhia" required>
                                                <option value="">Selecione...</option>
                                            </select>
                                        </div>

                                        <!-- Lista de Passageiros -->
                                        <div class="col-12">
                                            <h6 class="text-info border-bottom pb-2">
                                                <i class="bi bi-people"></i> Passageiros
                                            </h6>
                                            <div id="importPassageirosLista">
                                                <p class="text-muted">Nenhum passageiro extraído</p>
                                            </div>
                                        </div>

                                        <!-- Trechos (segmentos de voo) -->
                                        <div class="col-12">
                                            <h6 class="text-primary border-bottom pb-2">
                                                <i class="bi bi-signpost-2"></i> Trechos
                                            </h6>
                                            <div id="importTrechosLista">
                                                <p class="text-muted">Nenhum trecho extraído</p>
                                            </div>
                                        </div>

                                        <div class="col-md-3">
                                            <label class="form-label">Cabine/Tarifa</label>
                                            <input type="text" class="form-control" id="importCabine" value="Econômica" placeholder="Ex: Econômica">
                                        </div>

                                        <div class="col-md-3">
                                            <label class="form-label">Bagagem</label>
                                            <input type="text" class="form-control" id="importBagagem" placeholder="Ex: 1 x 23kg">
                                        </div>

                                        <!-- Valores -->
                                        <div class="col-12 mt-3">
                                            <h6 class="text-primary border-bottom pb-2">
                                                <i class="bi bi-cash-coin"></i> Valores Extraídos do PDF
                                            </h6>
                                        </div>

                                        <div class="col-md-3">
                                            <label class="form-label">Tarifa</label>
                                            <div class="input-group">
                                                <span class="input-group-text">R$</span>
                                                <input type="number" step="0.01" class="form-control" id="importTarifa" placeholder="0,00">
                                            </div>
                                        </div>

                                        <div class="col-md-3">
                                            <label class="form-label">Taxa Embarque</label>
                                            <div class="input-group">
                                                <span class="input-group-text">R$</span>
                                                <input type="number" step="0.01" class="form-control" id="importTaxaEmbarque" placeholder="0,00">
                                            </div>
                                        </div>

                                        <div class="col-md-3">
                                            <label class="form-label">Total PDF</label>
                                            <div class="input-group">
                                                <span class="input-group-text">R$</span>
                                                <input type="number" step="0.01" class="form-control" id="importTotalPDF" placeholder="0,00" readonly style="background-color: #f0f0f0; font-weight: bold;">
                                            </div>
                                        </div>

                                        <!-- Dados Manuais -->
                                        <div class="col-12 mt-3">
                                            <h6 class="text-success border-bottom pb-2">
                                                <i class="bi bi-pencil-square"></i> Dados GiraMundo (preencher manualmente)
                                            </h6>
                                        </div>

                                        <div class="col-md-12">
                                            <label class="form-label">Data de Emissão *</label>
                                            <input type="date" class="form-control" id="importDataEmissao" required>
                                        </div>

                                        <div class="col-12">
                                            <label class="form-label">Observações</label>
                                            <textarea class="form-control" id="importObservacoes" rows="2"
                                                      placeholder="Informações adicionais..."></textarea>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-success d-none" id="btnSalvarImportacao"
                                    onclick="TicketsModule.salvarBilheteImportado()">
                                <i class="bi bi-check-lg"></i> Salvar Bilhete Importado
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
        this.carregarBilhetes();
        this.atualizarEstatisticas();
        this.popularFiltros();
    },

    /**
     * Vincula eventos
     */
    bindEvents() {
        // Busca de bilhetes
        const buscaInput = document.getElementById('buscaBilhete');
        if (buscaInput) {
            let debounceTimer;
            buscaInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.carregarBilhetes(e.target.value);
                }, 300);
            });
        }

        // Data de emissão padrão (hoje)
        const dataEmissao = document.getElementById('bilheteDataEmissao');
        if (dataEmissao) {
            dataEmissao.value = Formatter.dateForInput(new Date());
        }

        // Eventos do upload PDF (onchange no HTML é suficiente)
        const zonaUpload = document.getElementById('zonaUploadPDF');
        if (zonaUpload) {
            zonaUpload.addEventListener('dragover', (e) => {
                e.preventDefault();
                zonaUpload.style.borderColor = '#0d6efd';
                zonaUpload.style.backgroundColor = '#f0f4ff';
            });
            zonaUpload.addEventListener('dragleave', (e) => {
                e.preventDefault();
                zonaUpload.style.borderColor = '#dee2e6';
                zonaUpload.style.backgroundColor = '';
            });
            zonaUpload.addEventListener('drop', (e) => {
                e.preventDefault();
                zonaUpload.style.borderColor = '#dee2e6';
                zonaUpload.style.backgroundColor = '';
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type === 'application/pdf') {
                    this._processarUploadPDF(files[0]);
                } else {
                    alert('Por favor, selecione um arquivo PDF.');
                }
            });
        }
    },

    /**
     * Popula filtros e selects
     */
    async popularFiltros() {
        const filtroFornecedor = document.getElementById('filtroFornecedor');
        if (filtroFornecedor) {
            if (this._fornecedores.length === 0) {
                const resp = await apiCall('/api/fornecedores');
                if (resp) {
                    const result = await resp.json();
                    this._fornecedores = result.data || [];
                }
            }
            filtroFornecedor.innerHTML = '<option value="">Todos</option>' +
                this._fornecedores.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
        }
    },

    /**
     * Popula selects do modal
     */
    async popularSelectsModal() {
        // Clientes
        const selectCliente = document.getElementById('bilheteCliente');
        if (selectCliente) {
            if (this._clientes.length === 0) {
                const resp = await apiCall('/api/clientes');
                if (resp) {
                    const result = await resp.json();
                    this._clientes = result.data || [];
                }
            }
            selectCliente.innerHTML = '<option value="">Selecione o cliente...</option>' +
                this._clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
        }

        // Companhias
        const selectCompanhia = document.getElementById('bilheteCompanhia');
        if (selectCompanhia) {
            selectCompanhia.innerHTML = '<option value="">Selecione a companhia...</option>' +
                AIRLINES.map(a => `<option value="${a.code}">${a.name} (${a.code})</option>`).join('');
        }

        // Fornecedores
        const selectFornecedor = document.getElementById('bilheteFornecedor');
        if (selectFornecedor) {
            if (this._fornecedores.length === 0) {
                const resp = await apiCall('/api/fornecedores');
                if (resp) {
                    const result = await resp.json();
                    this._fornecedores = result.data || [];
                }
            }
            selectFornecedor.innerHTML = '<option value="">Selecione o fornecedor...</option>' +
                this._fornecedores.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
        }
    },

    /**
     * Popula selects do modal de importação
     */
    async popularSelectsImportacao() {
        if (this._fornecedores.length === 0) {
            const resp = await apiCall('/api/fornecedores');
            if (resp) {
                const result = await resp.json();
                this._fornecedores = result.data || [];
            }
        }

        const selectCompanhia = document.getElementById('importCompanhia');
        if (selectCompanhia) {
            selectCompanhia.innerHTML = '<option value="">Selecione...</option>' +
                AIRLINES.map(a => `<option value="${a.code}">${a.name} (${a.code})</option>`).join('');
        }

        const selectFornecedor = document.getElementById('importFornecedor');
        if (selectFornecedor) {
            selectFornecedor.innerHTML = '<option value="">Selecione o fornecedor...</option>' +
                this._fornecedores.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
        }

        const dataEmissao = document.getElementById('importDataEmissao');
        if (dataEmissao) {
            dataEmissao.value = Formatter.dateForInput(new Date());
        }
    },

    /**
     * Carrega e exibe lista de bilhetes
     */
    async carregarBilhetes(busca = '', filtros = {}) {
        const tbody = document.getElementById('tabelaBilhetes');
        const contador = document.getElementById('contadorBilhetes');
        if (!tbody) return;

        const params = new URLSearchParams();
        if (busca) params.set('busca', busca);
        if (filtros.dataInicio) params.set('dataInicio', filtros.dataInicio);
        if (filtros.dataFim) params.set('dataFim', filtros.dataFim);
        if (filtros.fornecedorId) params.set('fornecedorId', filtros.fornecedorId);

        const resp = await apiCall('/api/bilhetes?' + params.toString());
        if (!resp) return;

        const result = await resp.json();
        if (!result.success) return;

        const bilhetes = result.data || [];
        this._bilhetes = bilhetes;
        this._totais = result.totais || { vendas: 0, compras: 0, lucro: 0 };

        this.atualizarEstatisticas();

        if (contador) contador.textContent = bilhetes.length;

        if (bilhetes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center py-5">
                        <div class="empty-state">
                            <i class="bi bi-ticket-perforated"></i>
                            <h5>Nenhum bilhete encontrado</h5>
                            <p class="text-muted">${busca ? 'Tente outro termo de busca' : 'Emita seu primeiro bilhete'}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = bilhetes.map(bilhete => {
            const cliente = bilhete.cliente;
            const fornecedor = bilhete.fornecedor;
            const companhia = getAirlineByCode(bilhete.companhia);

            return `
                <tr>
                    <td>
                        <span class="badge bg-dark fw-bold">${bilhete.codigoReserva}</span>
                    </td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="avatar-circle me-2" style="width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; color: white;">
                                ${cliente?.nome?.charAt(0) || '?'}
                            </div>
                            <span>${cliente?.nome || 'N/A'}</span>
                        </div>
                    </td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div style="width: 24px; height: 24px; border-radius: 4px; background-color: ${companhia?.color || '#666'}; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold; margin-right: 8px;">
                                ${bilhete.companhia}
                            </div>
                            ${companhia?.name || bilhete.companhia}
                        </div>
                    </td>
                    <td>
                        <i class="bi bi-calendar3 text-primary me-1"></i>
                        ${Formatter.date(bilhete.dataIda)}
                        ${bilhete.origem ? `<br><small class="text-muted">${bilhete.origem}</small>` : ''}
                    </td>
                    <td>
                        ${bilhete.dataVolta ?
                            `<i class="bi bi-calendar3 text-success me-1"></i>${Formatter.date(bilhete.dataVolta)}
                             ${bilhete.destino ? `<br><small class="text-muted">${bilhete.destino}</small>` : ''}` :
                            '<span class="text-muted">Somente ida</span>'}
                    </td>
                    <td>
                        <i class="bi bi-building text-info me-1"></i>
                        ${fornecedor?.nome || 'N/A'}
                    </td>
                    <td class="text-end">
                        <span class="text-primary fw-bold">${bilhete.valorVenda ? Formatter.currency(bilhete.valorVenda) : '-'}</span>
                    </td>
                    <td class="text-end">
                        <span class="text-warning">${bilhete.valorCompra ? Formatter.currency(bilhete.valorCompra) : '-'}</span>
                    </td>
                    <td class="text-end">
                        ${(() => {
                            const saldo = (bilhete.valorVenda || 0) - (bilhete.valorCompra || 0);
                            const corSaldo = saldo >= 0 ? 'text-success' : 'text-danger';
                            return bilhete.valorVenda && bilhete.valorCompra
                                ? `<span class="${corSaldo} fw-bold">${Formatter.currency(saldo)}</span>`
                                : '-';
                        })()}
                    </td>
                    <td>${Formatter.date(bilhete.dataEmissao)}</td>
                    <td class="text-center">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-info" onclick="TicketsModule.gerarPDFBilhete('${bilhete.id}')"
                                    title="Gerar PDF do Bilhete">
                                <i class="bi bi-file-pdf"></i>
                            </button>
                            <button class="btn btn-outline-success" onclick="TicketsModule.gerarRecibo('${bilhete.id}')"
                                    title="Gerar Recibo de Pagamento">
                                <i class="bi bi-receipt"></i>
                            </button>
                            <button class="btn btn-outline-warning" onclick="TicketsModule.gerarInvoice('${bilhete.id}')"
                                    title="Emitir Fatura / Invoice">
                                <i class="bi bi-file-earmark-text"></i>
                            </button>
                            <button class="btn btn-outline-primary" onclick="TicketsModule.verBilhete('${bilhete.id}')"
                                    title="Visualizar">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-secondary" onclick="TicketsModule.editarBilhete('${bilhete.id}')"
                                    title="Editar">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="TicketsModule.excluirBilhete('${bilhete.id}')"
                                    title="Excluir">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * Atualiza estatísticas usando cache
     */
    atualizarEstatisticas() {
        const totalBilhetes = document.getElementById('totalBilhetes');
        const totalVendasEl = document.getElementById('totalVendas');
        const totalComprasEl = document.getElementById('totalCompras');
        const saldoElement = document.getElementById('totalSaldo');

        if (!totalBilhetes) return;

        totalBilhetes.textContent = this._bilhetes.length;
        totalVendasEl.textContent = Formatter.currency(this._totais.vendas || 0);
        totalComprasEl.textContent = Formatter.currency(this._totais.compras || 0);

        const lucro = this._totais.lucro || 0;
        saldoElement.textContent = Formatter.currency(lucro);
        saldoElement.style.color = lucro >= 0 ? '#28a745' : '#dc3545';
    },

    /**
     * Calcula o saldo da venda no formulário
     */
    calcularSaldo() {
        const valorVenda = parseFloat(document.getElementById('bilheteValorVenda').value) || 0;
        const valorCompra = parseFloat(document.getElementById('bilheteValorCompra').value) || 0;
        const saldo = valorVenda - valorCompra;

        const saldoInput = document.getElementById('bilheteSaldo');
        saldoInput.value = Formatter.currency(saldo).replace('R$ ', '');

        // Muda cor do saldo
        if (saldo >= 0) {
            saldoInput.style.color = '#28a745';
        } else {
            saldoInput.style.color = '#dc3545';
        }
    },

    calcularSaldoImport() {
        // Campos de valor removidos do formulário de importação
    },

    /**
     * Aplica filtros
     */
    aplicarFiltros() {
        const filtros = {
            dataInicio: document.getElementById('filtroDataDe')?.value,
            dataFim: document.getElementById('filtroDataAte')?.value,
            fornecedorId: document.getElementById('filtroFornecedor')?.value
        };

        const busca = document.getElementById('buscaBilhete')?.value || '';
        this.carregarBilhetes(busca, filtros);
    },

    /**
     * Abre modal para novo bilhete
     */
    async abrirModalNovoBilhete() {
        document.getElementById('modalBilheteTitulo').innerHTML = '<i class="bi bi-ticket-perforated"></i> Emitir Bilhete';
        document.getElementById('bilheteId').value = '';
        document.getElementById('formBilhete').reset();
        document.getElementById('bilheteDataEmissao').value = Formatter.dateForInput(new Date());

        await this.popularSelectsModal();

        const modal = new bootstrap.Modal(document.getElementById('modalBilhete'));
        modal.show();
    },

    /**
     * Abre modal de importação de PDF
     */
    async abrirModalImportarPDF() {
        // Reset estado
        document.getElementById('zonaUploadPDF').classList.remove('d-none');
        document.getElementById('loadingImportPDF').classList.add('d-none');
        document.getElementById('dadosExtraidosPDF').classList.add('d-none');
        document.getElementById('btnSalvarImportacao').classList.add('d-none');
        document.getElementById('inputPDFFile').value = '';

        await this.popularSelectsImportacao();

        const modal = new bootstrap.Modal(document.getElementById('modalImportarPDF'));
        modal.show();
    },

    /**
     * Handler chamado pelo onchange do input file (mais confiável que addEventListener)
     */
    handlePDFFileSelect(input) {
        console.log('[GiraMundo] handlePDFFileSelect chamado, files:', input.files.length);
        if (input.files.length > 0) {
            this._processarUploadPDF(input.files[0]);
        }
    },

    /**
     * Processa o upload do PDF
     */
    async _processarUploadPDF(file) {
        console.log('[GiraMundo] _processarUploadPDF iniciado, arquivo:', file.name, 'tipo:', file.type, 'tamanho:', file.size);

        if (!file) {
            alert('Nenhum arquivo selecionado.');
            return;
        }

        // Aceitar qualquer PDF (alguns browsers reportam tipo diferente)
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Por favor, selecione um arquivo PDF válido.');
            return;
        }

        // Mostra loading
        document.getElementById('zonaUploadPDF').classList.add('d-none');
        document.getElementById('loadingImportPDF').classList.remove('d-none');

        try {
            let texto = '';
            let metodo = '';

            // Tenta extrair texto via pdf.js no browser
            if (typeof pdfjsLib !== 'undefined') {
                console.log('[GiraMundo] Tentando extração via pdf.js...');
                texto = await this._extrairTextoPDFLocal(file);
                metodo = 'pdfjs';
            }

            // Se pdf.js falhou ou retornou pouco texto, usa backend OCR
            if (!texto || texto.trim().length < 50) {
                console.log('[GiraMundo] Texto insuficiente do pdf.js (' + (texto?.trim().length || 0) + ' chars), tentando backend OCR...');
                document.querySelector('#loadingImportPDF p').textContent = 'Processando PDF com OCR (pode levar alguns segundos)...';
                const resultado = await this._extrairTextoPDFBackend(file);
                texto = resultado.text;
                metodo = resultado.method;
                console.log('[GiraMundo] Backend retornou:', texto.length, 'chars via', metodo);
            }

            if (!texto || texto.trim().length === 0) {
                throw new Error('Nenhum texto extraído do PDF. O arquivo pode ser uma imagem escaneada ou estar protegido.');
            }

            console.log('[GiraMundo] Texto extraído via ' + metodo + ' (' + texto.length + ' chars):\n' + texto.substring(0, 1000));

            const dados = this._parseDadosBilhete(texto);
            console.log('[GiraMundo] Dados parseados:', JSON.stringify(dados, null, 2));

            this._preencherFormularioImportacao(dados);

            // Mostra formulário
            document.getElementById('loadingImportPDF').classList.add('d-none');
            document.getElementById('dadosExtraidosPDF').classList.remove('d-none');
            document.getElementById('btnSalvarImportacao').classList.remove('d-none');

        } catch (error) {
            console.error('[GiraMundo] Erro ao processar PDF:', error);
            document.getElementById('loadingImportPDF').classList.add('d-none');
            document.getElementById('zonaUploadPDF').classList.remove('d-none');
            alert('Erro ao processar o PDF:\n' + error.message + '\n\nVerifique se o servidor backend está rodando e tente novamente.');
        }
    },

    /**
     * Extrai texto via backend (Puppeteer + OCR)
     */
    async _extrairTextoPDFBackend(file) {
        const formData = new FormData();
        formData.append('pdf', file);

        const response = await fetch('/api/bilhetes/extract-pdf', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
            throw new Error('Erro no servidor: ' + (err.message || response.statusText));
        }

        return await response.json();
    },

    /**
     * Extrai texto de todas as páginas do PDF usando pdf.js (local/browser)
     */
    async _extrairTextoPDFLocal(file) {
        console.log('[GiraMundo] Iniciando extração de texto local...');

        const arrayBuffer = await file.arrayBuffer();

        // Configura workerSrc
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            try {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            } catch(e) {
                console.warn('[GiraMundo] Não foi possível configurar workerSrc:', e);
            }
        }

        let pdf;
        try {
            pdf = await pdfjsLib.getDocument({
                data: arrayBuffer,
                useWorkerFetch: false,
                isEvalSupported: false
            }).promise;
        } catch (e1) {
            console.warn('[GiraMundo] Falha ao carregar PDF, tentando sem worker...', e1);
            try {
                pdfjsLib.GlobalWorkerOptions.workerSrc = '';
                pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            } catch (e2) {
                console.error('[GiraMundo] Falha total ao carregar PDF:', e2);
                return '';
            }
        }

        console.log('[GiraMundo] PDF carregado, páginas:', pdf.numPages);

        let textoCompleto = '';
        const maxPages = Math.min(pdf.numPages, 3);

        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();

            console.log('[GiraMundo] Página', i, '- items:', content.items.length);

            // Agrupa por posição Y (mantém estrutura de linhas)
            const linhas = {};
            content.items.forEach(item => {
                if (!item.str || item.str.trim() === '') return;
                const y = item.transform ? item.transform[5] : 0;
                const x = item.transform ? item.transform[4] : 0;
                const yKey = Math.round(y / 3) * 3;
                if (!linhas[yKey]) linhas[yKey] = [];
                linhas[yKey].push({ x: x, text: item.str });
            });

            const yKeys = Object.keys(linhas).map(Number).sort((a, b) => b - a);

            for (const yKey of yKeys) {
                const items = linhas[yKey].sort((a, b) => a.x - b.x);
                const linhaTexto = items.map(it => it.text).join(' ').trim();
                if (linhaTexto) {
                    textoCompleto += linhaTexto + '\n';
                }
            }
            textoCompleto += '\n';
        }

        // Fallback: concatenação simples
        if (textoCompleto.trim().length === 0) {
            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                textoCompleto += content.items.map(item => item.str || '').join(' ') + '\n';
            }
        }

        return textoCompleto;
    },

    /**
     * Parseia o texto extraído do PDF para extrair dados do bilhete
     * Suporta formatos: GOL, LATAM, Azul, VoeGOL
     */
    _parseDadosBilhete(texto) {
        const dados = {
            codigoReserva: '',
            passageiro: '',
            passageiros: [],
            companhia: '',
            numeroVoo: '',
            origem: '',
            destino: '',
            dataIda: '',
            dataVolta: '',
            vooVolta: '',
            horaPartida: '',
            horaChegada: '',
            trechos: [],
            cabine: '',
            bagagem: '',
            tarifa: 0,
            taxaEmbarque: 0,
            total: 0
        };

        // Normaliza texto OCR: corrige espaços extras em códigos de aeroporto
        let textoNorm = texto.replace(/\bCG\s+H\b/g, 'CGH')
            .replace(/\bGR\s+U\b/g, 'GRU')
            .replace(/\bGI\s+G\b/g, 'GIG')
            .replace(/\bFL\s+N\b/g, 'FLN')
            .replace(/\bRE\s+C\b/g, 'REC')
            .replace(/\bBS\s+B\b/g, 'BSB')
            .replace(/\bSS\s+A\b/g, 'SSA')
            .replace(/\bF\s+E\s+N\b/g, 'FEN')
            // Azul OCR artifacts: IATA codes split by OCR noise
            .replace(/\bA\)\s*LU\b/g, 'AJU')
            .replace(/\bA\)\s*U\b/g, 'AJU')
            .replace(/\bAJ\s+U\b/g, 'AJU')
            .replace(/\bVI\s+X\b/g, 'VIX')
            .replace(/\bJP\s+A\b/g, 'JPA')
            .replace(/\bMC\s+Z\b/g, 'MCZ');

        // Texto "flat" (sem quebras de linha) para patterns cross-line
        // Remove caracteres Unicode PUA (Private Use Area) e outros invisíveis do pdf.js
        const flat = textoNorm.replace(/\n+/g, ' ').replace(/[\uE000-\uF8FF\uFFFD]/g, ' ').replace(/\s{2,}/g, ' ');
        // Linhas individuais para busca por linha
        const linhas = textoNorm.split('\n').map(l => l.trim()).filter(l => l);

        debugLog('Parser: flat (500 chars):', flat.substring(0, 500));
        debugLog('Parser: total linhas:', linhas.length);

        // =============================================
        // 1. DETECTAR COMPANHIA AÉREA
        // =============================================
        // Verifica LATAM/TAM primeiro pois textos LATAM podem conter "cartão de embarque" genérico
        if (/LATAM|TAM\s*Linhas/i.test(flat)) {
            dados.companhia = 'LA';
        } else if (/VoeGOL|GOL\s*Linhas|OPERADO\s*POR.*GOL|Cartão\s*de\s*Embarque/i.test(flat) || /\bG3\s?\d{3,4}\b/.test(flat)) {
            dados.companhia = 'G3';
        } else if (/\bAzul\b/i.test(flat) || /\bAD\s?\d{3,4}\b/.test(flat)) {
            dados.companhia = 'AD';
        } else {
            for (const airline of (typeof AIRLINES !== 'undefined' ? AIRLINES : [])) {
                if (flat.toLowerCase().includes(airline.name.toLowerCase())) {
                    dados.companhia = airline.code;
                    break;
                }
            }
        }

        // =============================================
        // 2. CÓDIGO DA RESERVA
        // =============================================
        const codigoPatterns = [
            /C[oó]d(?:igo)?\.?\s*(?:da|de)?\s*reserva\s+([A-Z0-9]{4,8})/i,
            /Localizador\s+([A-Z0-9]{5,8})/i,
            // Azul: "Localizador Azul * WCET" — asterisco entre nome da cia e código (OCR artifact)
            /Localizador\s+[A-Za-z]{2,6}\s+\*?\s*([A-Z0-9]{4,8})/i,
            // Azul fallback: "Azul * CODE" sem "Localizador" na mesma linha
            /\bAzul\s+\*\s*([A-Z0-9]{4,8})\b/i,
            /Booking\s*code\s*[:\s]\s*([A-Z0-9]{5,8})/i,
            /PNR\s*[:\s]\s*([A-Z0-9]{5,8})/i,
            /reserva\s+([A-Z]{5,8})\b/i
        ];
        for (const pat of codigoPatterns) {
            const m = flat.match(pat);
            if (m) {
                dados.codigoReserva = m[1].toUpperCase();
                break;
            }
        }
        // Fallback: busca linha com "reserva" ou "localizador" e código próximo
        if (!dados.codigoReserva) {
            for (let i = 0; i < linhas.length; i++) {
                if (/reserva|localizador/i.test(linhas[i])) {
                    // Busca código na mesma linha — aceita 4 a 8 chars, exclui nomes de cia
                    const codigoNaLinha = linhas[i].match(/\b([A-Z][A-Z0-9]{3,7})\b/);
                    if (codigoNaLinha && !/reserva|localizador|codigo|sequencia|antecipada|assento|aeronave|bilhete|azul|latam|gol|tam/i.test(codigoNaLinha[1])) {
                        dados.codigoReserva = codigoNaLinha[1];
                        break;
                    }
                    // Tenta próximas 3 linhas (código pode estar mais abaixo)
                    let found = false;
                    for (let j = 1; j <= 3 && i + j < linhas.length; j++) {
                        const proxLinha = linhas[i + j].trim();
                        // Código isolado na linha (4-8 chars)
                        if (/^[A-Z0-9]{4,8}$/.test(proxLinha)) {
                            dados.codigoReserva = proxLinha;
                            found = true;
                            break;
                        }
                        // Código seguido de outros dados (ex: "FDPQFV 16")
                        const codeInLine = proxLinha.match(/^([A-Z]{4,8})\s/);
                        if (codeInLine && !/BOEING|AIRBUS|OPERADO|LATAM|BRASIL|AZUL|LINHAS/i.test(codeInLine[1])) {
                            dados.codigoReserva = codeInLine[1];
                            found = true;
                            break;
                        }
                        // Azul: "Azul QNMNKD" — código no fim da linha precedido por nome da cia
                        const codeAtEnd = proxLinha.match(/\b([A-Z0-9]{4,8})$/);
                        if (codeAtEnd && /[A-Z]/.test(codeAtEnd[1])
                            && !/BOEING|AIRBUS|OPERADO|BRASIL|LINHAS|AEREAS|AZUL|LATAM/i.test(codeAtEnd[1])) {
                            dados.codigoReserva = codeAtEnd[1];
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }
            }
        }
        // LATAM OCR: "Código da reserva JTNHKB" direto no flat
        if (!dados.codigoReserva) {
            const latamCode = flat.match(/C[oó]digo\s+da\s+reserva\s+([A-Z]{4,8})/i);
            if (latamCode) {
                dados.codigoReserva = latamCode[1].toUpperCase();
            }
        }
        // LATAM PDF espaçado: seção "Companhias aéreas" tem "LATAM AIRLINES BRASIL / HHTPGU"
        if (!dados.codigoReserva) {
            const latamAirlines = flat.match(/AIRLINES\s+BRASIL\s*\/\s*([A-Z]{5,8})/i);
            if (latamAirlines) {
                dados.codigoReserva = latamAirlines[1].toUpperCase();
            }
        }

        // =============================================
        // 3. PASSAGEIRO
        // =============================================
        // Padrão SOBRENOME/NOME (excluir matches em URLs e endereços)
        const nomeBarra = flat.match(/\b([A-ZÀ-Úa-zà-ú]{2,})\s*\/\s*([A-ZÀ-Úa-zà-ú][A-ZÀ-Úa-zà-ú\s]*?)(?:\s*[-:,]|\s+Adulto|\s+\d{2}\/)/);
        if (nomeBarra) {
            const matchPos = flat.indexOf(nomeBarra[0]);
            const contexto = flat.substring(Math.max(0, matchPos - 30), matchPos + nomeBarra[0].length + 10);
            // Ignorar se está dentro de URL ou endereço (com.br/, SP, RJ etc)
            const ehURL = /https?:|\.com|\.br|\.org/i.test(contexto);
            // Ex: Paulo/SP, Rio/RJ, ou check-in/cartao
            const ehEstado = /\/[A-Z]{2}\b/.test(nomeBarra[0]) && /CEP|Brasil|cidade/i.test(contexto);
            const ehCaminho = /[\w-]+\/[\w-]+\//.test(contexto); // URL paths
            if (!ehURL && !ehEstado && !ehCaminho) {
                const sobrenome = nomeBarra[1].trim();
                const nome = nomeBarra[2].trim();
                dados.passageiro = this._formatarNome(nome + ' ' + sobrenome);
            }
        }

        // VoeGOL: "check-in foi feito" seguido de nome (pode estar em linhas separadas)
        if (!dados.passageiro && dados.companhia === 'G3') {
            // Nome pode estar dividido: "ALBERES SANTANA DA" + (headers) + "SILVA"
            // Primeiro, busca nas linhas após "check-in foi feito"
            let nomePartes = [];
            for (let i = 0; i < linhas.length; i++) {
                if (/check-in\s+foi\s+feito/i.test(linhas[i])) {
                    // Busca partes do nome nas próximas linhas
                    for (let j = i; j < Math.min(i + 6, linhas.length); j++) {
                        const linha = linhas[j].replace(/check-in\s+foi\s+feito\s*/i, '').trim();
                        // Remove headers como "Origem", "Destino", "Paradas"
                        const limpa = linha.replace(/\b(Origem|Destino|Paradas|Viagem)\b/gi, '').trim();
                        // Captura palavras ALL CAPS (nome)
                        const palavras = limpa.match(/\b[A-ZÀ-Ú]{2,}\b/g);
                        if (palavras) nomePartes.push(...palavras);
                    }
                    break;
                }
            }
            // Filtrar palavras que são cidades/aeroportos
            const ignorar = ['REC', 'GIG', 'CGH', 'GRU', 'FLN', 'SSA', 'BSB', 'FOR', 'POA', 'CWB', 'NAT', 'SDU', 'VCP', 'BEL', 'MAO', 'RIO', 'JANEIRO', 'RECIFE', 'PAULO', 'GALEAO', 'DIRETO', 'PARADA', 'SEM', 'VOO'];
            nomePartes = nomePartes.filter(p => !ignorar.includes(p) && p.length >= 2);
            if (nomePartes.length >= 2) {
                dados.passageiro = this._formatarNome(nomePartes.join(' '));
            }
        }

        // LATAM: "Nome do Passageiro ... JOAO DO REGO Adulto"
        if (!dados.passageiro && dados.companhia === 'LA') {
            // Buscar nome ALL CAPS antes de "Adulto" ou "Criança"
            const nomeLatam = flat.match(/([A-ZÀ-Ú]{2,}(?:\s+(?:D[AEOI]\s+|D[AO]S?\s+)?[A-ZÀ-Ú]{2,})+)\s+(?:Adulto|Crian)/);
            if (nomeLatam) {
                dados.passageiro = this._formatarNome(nomeLatam[1].trim());
            }
        }

        // Azul: "Passageiros: N" or "N PASSAGEIROS" followed by names
        // Single passageiro is set later from passageiros[] array (section 3b handles multi)

        // Fallback: nome ALL CAPS em linhas
        if (!dados.passageiro) {
            const palavrasIgnorar = ['LATAM', 'AIRLINES', 'BRASIL', 'LINHAS', 'OPERADO', 'RESERVA', 'ANTECIPADA', 'ASSENTO', 'EMBARQUE', 'VIAGEM', 'TRECHO', 'ECONOMIA', 'ECONOMICA', 'EXECUTIVA', 'PRIMEIRA', 'INFORMAC', 'PASSAGEIR', 'STANDARD', 'ECONOMY', 'BOARDING', 'RECIFE', 'PAULO', 'JANEIRO', 'GALEAO', 'CONGONHAS', 'GUARULHOS', 'GUARARAPES', 'FLORIANOPOLIS', 'SALVADOR', 'FORTALEZA', 'CURITIBA', 'MANAUS', 'BELEM', 'AEROPORTO', 'INTERNACIONAL', 'AIRPORT', 'IMPORTANT', 'ORIENTAC', 'DETALHE', 'PAGAMENT', 'COMPANHIA', 'DOCUMENT', 'IDENTIFICA', 'NASCIMENTO', 'FIDELIDADE', 'MASCULINO', 'FEMININO', 'CARTAO', 'CREDITO', 'DEBITO', 'MILHAS', 'TOTAL', 'TARIFA', 'VALORES', 'EXTRAS', 'PRONTO', 'VOEGOL', 'BOEING', 'AIRBUS', 'DIRETO', 'PARADA', 'ITINER', 'INFORMA', 'TERMOS', 'CONDI'];
            for (const linha of linhas) {
                if (/^[A-ZÀ-Ú\s]{8,50}$/.test(linha) && !linha.includes('  ')) {
                    const palavras = linha.split(/\s+/).filter(p => p.length >= 2);
                    if (palavras.length >= 2 && palavras.length <= 6) {
                        const ehNome = !palavras.some(p =>
                            palavrasIgnorar.some(ign => p.toUpperCase().startsWith(ign))
                        );
                        if (ehNome) {
                            dados.passageiro = this._formatarNome(linha);
                            break;
                        }
                    }
                }
            }
        }

        // =============================================
        // 3b. MÚLTIPLOS PASSAGEIROS
        // =============================================
        // Azul: two formats:
        // Old: "Passageiros: 3\nJOSEFA MARIA...\nSEBASTIANA..." (ALL CAPS, separate lines)
        // New: "2 PASSAGEIROS\nJoseja Felipe Da Silva Maria Patricia Silva Dantas" (Title Case, may be on SAME line)
        if (dados.companhia === 'AD') {
            const novoFormatoMatch = flat.match(/(\d+)\s+PASSAGEIROS/i);
            const antigoFormatoMatch = flat.match(/Passageiros?\s*:\s*(\d+)/i);
            const numPassageiros = novoFormatoMatch ? parseInt(novoFormatoMatch[1])
                                 : antigoFormatoMatch ? parseInt(antigoFormatoMatch[1])
                                 : 0;

            if (novoFormatoMatch) {
                // New Azul format: "2 PASSAGEIROS" with Title Case names
                // Names may be on separate lines OR on the same line (pdf.js merges side-by-side layout)
                let emSecao = false;
                const nomesColetados = [];
                for (let i = 0; i < linhas.length; i++) {
                    if (/\d+\s+PASSAGEIROS/i.test(linhas[i])) {
                        emSecao = true;
                        continue;
                    }
                    if (emSecao) {
                        if (/^(VOOS\s+DE|BAGAGENS|Ida|Volta|Assentos|Bagagen|Detalhes|Total|Tarifa|R\$)/i.test(linhas[i])) break;
                        const linha = linhas[i].trim();
                        if (linha.length >= 8) {
                            const ehSecao = /^(VOOS|BAGAG|ASSEN|VOO|DATA|HORA|TARI|TOTAL|R\$|Ida|Volta|Segunda|Terca|Quarta|Quinta|Sexta|Sabado|Domingo|Recife|Paulo|Janeiro|ESCANEIE|CLIQUE|Para\s+mais)/i.test(linha);
                            if (!ehSecao) {
                                nomesColetados.push(linha);
                            }
                        }
                        if (nomesColetados.length >= numPassageiros) break;
                    }
                }

                // If we got fewer lines than expected passengers, names might be on the same line
                // Try to split: "Joseja Felipe Da Silva Maria Patricia Silva Dantas" for N=2
                if (nomesColetados.length > 0 && nomesColetados.length < numPassageiros) {
                    // Combine all collected text and try to split into N names
                    const textoNomes = nomesColetados.join(' ');
                    const nomesSplit = this._splitNomesTitleCase(textoNomes, numPassageiros);
                    if (nomesSplit.length === numPassageiros) {
                        dados.passageiros = nomesSplit.map(n => this._formatarNome(n));
                    } else {
                        // fallback: just use what we have
                        dados.passageiros = nomesColetados.map(n => this._formatarNome(n));
                    }
                } else if (nomesColetados.length >= numPassageiros) {
                    dados.passageiros = nomesColetados.slice(0, numPassageiros).map(n => this._formatarNome(n));
                }
            }

            // Old format: "Passageiros: N" with ALL CAPS names on separate lines
            if (dados.passageiros.length === 0 && antigoFormatoMatch) {
                // Line-by-line approach first (most reliable for old format)
                let emSecao = false;
                for (let i = 0; i < linhas.length; i++) {
                    if (/Passageiros?\s*:/i.test(linhas[i])) {
                        emSecao = true;
                        continue;
                    }
                    if (emSecao) {
                        if (/^(Ida|Volta|Assentos|Bagagen|Detalhes|Total|Tarifa|R\$|Voo|Data)/i.test(linhas[i])) break;
                        // ALL CAPS name line: at least 8 chars, 2+ words of 2+ letters
                        if (/^[A-ZÀ-Ú\s]{8,}$/.test(linhas[i])) {
                            const palavras = linhas[i].split(/\s+/).filter(p => p.length >= 2);
                            if (palavras.length >= 2) {
                                dados.passageiros.push(this._formatarNome(linhas[i].trim()));
                            }
                        }
                        if (numPassageiros > 0 && dados.passageiros.length >= numPassageiros) break;
                    }
                }

                // Fallback: flat text regex (if lines didn't work, e.g. names on same line)
                if (dados.passageiros.length === 0) {
                    const secaoPassageiros = flat.match(/Passageiros?:?\s*\d+\s+([\s\S]*?)(?:\s+(?:Ida|Volta|Assentos|Bagagen|Detalhes|Total|Tarifa|R\$))/i);
                    if (secaoPassageiros) {
                        const textoNomes = secaoPassageiros[1];
                        const nomesMatch = textoNomes.match(/[A-ZÀ-Ú]{2,}(?:\s+(?:D[AEOI]\s+|D[AO]S?\s+)?[A-ZÀ-Ú]{2,})+/g);
                        if (nomesMatch && nomesMatch.length >= numPassageiros) {
                            dados.passageiros = nomesMatch.slice(0, numPassageiros).map(n => this._formatarNome(n.trim()));
                        } else if (nomesMatch && nomesMatch.length === 1 && numPassageiros > 1) {
                            // All names merged into one big match - try to split
                            const nomesSplit = this._splitNomesAllCaps(nomesMatch[0], numPassageiros);
                            dados.passageiros = nomesSplit.map(n => this._formatarNome(n));
                        } else if (nomesMatch) {
                            dados.passageiros = nomesMatch.map(n => this._formatarNome(n.trim()));
                        }
                    }
                }
            }
        }

        // LATAM: extrair todos os nomes antes de "Adulto" ou "Criança"
        if (dados.companhia === 'LA') {
            const regexLatam = /([A-ZÀ-Ú]{2,}(?:\s+(?:D[AEOI]\s+|D[AO]S?\s+)?[A-ZÀ-Ú]{2,})+)\s+(?:Adulto|Crian)/g;
            let matchLatam;
            while ((matchLatam = regexLatam.exec(flat)) !== null) {
                const nome = this._formatarNome(matchLatam[1].trim());
                if (!dados.passageiros.includes(nome)) {
                    dados.passageiros.push(nome);
                }
            }
        }

        // VoeGOL: cartão de embarque individual, usa o passageiro já extraído
        if (dados.companhia === 'G3' && dados.passageiro && dados.passageiros.length === 0) {
            dados.passageiros.push(dados.passageiro);
        }

        // Fallback geral: se temos passageiro mas não passageiros[]
        if (dados.passageiro && dados.passageiros.length === 0) {
            dados.passageiros.push(dados.passageiro);
        }

        // Garante que dados.passageiro tem o primeiro nome (compatibilidade)
        if (dados.passageiros.length > 0 && !dados.passageiro) {
            dados.passageiro = dados.passageiros[0];
        }

        // =============================================
        // 4. NÚMERO DO VOO
        // =============================================
        const vooLabelMatch = flat.match(/N[º°.ᵒo⁰]?\s*(?:de\s+)?[Vv]oo\s+([A-Z0-9]{2})\s*(\d{3,4})/);
        if (vooLabelMatch) {
            dados.numeroVoo = vooLabelMatch[1] + ' ' + vooLabelMatch[2];
        }

        if (!dados.numeroVoo) {
            const vooRegex = /\b([A-Z][A-Z0-9]|[0-9][A-Z])\s?(\d{3,4})\b/g;
            let vooMatch;
            while ((vooMatch = vooRegex.exec(flat)) !== null) {
                const code = vooMatch[1];
                const num = vooMatch[2];
                const posAfter = vooMatch.index + vooMatch[0].length;
                const charAfter = flat[posAfter] || ' ';
                if (/[A-Z0-9]/.test(charAfter)) continue;
                const codigosAereos = ['G3', 'LA', 'AD', 'JJ', 'O6', 'TP', 'AA', 'UA', 'DL', 'AV', 'CM', 'AR', 'IB', 'AF', 'LH', 'BA', 'EK', 'QR', '2Z'];
                if (codigosAereos.includes(code) || code === dados.companhia) {
                    dados.numeroVoo = code + ' ' + num;
                    break;
                }
            }
        }

        // Azul: pode ter só "4269" como número de voo
        if (!dados.numeroVoo && dados.companhia === 'AD') {
            const vooAzul = flat.match(/[A-Z]{3}\s*[>»→✈]\s*[A-Z]{3}\s*(?:—\s*)?.*?(\d{4})/);
            if (vooAzul) {
                dados.numeroVoo = 'AD ' + vooAzul[1];
            } else {
                // Busca "4269" isolado em linhas curtas
                for (const linha of linhas) {
                    if (/^\d{4}$/.test(linha.trim())) {
                        const n = parseInt(linha.trim());
                        if (n >= 1000 && n <= 9999) {
                            dados.numeroVoo = 'AD ' + linha.trim();
                            break;
                        }
                    }
                }
                // OCR: buscar número de voo 4 dígitos que não seja ano/data
                if (!dados.numeroVoo) {
                    const numeros4dig = [...flat.matchAll(/(?<!\d|\/)\b(\d{4})\b(?!\/\d|\d)/g)];
                    for (const m of numeros4dig) {
                        const num = parseInt(m[1]);
                        // Ignorar anos (2020-2035) e números precedidos por data (DD/MM/)
                        if (num >= 2020 && num <= 2035) continue;
                        const antes = flat.substring(Math.max(0, m.index - 6), m.index);
                        if (/\d{2}\/\d{2}\//.test(antes)) continue;
                        dados.numeroVoo = 'AD ' + m[1];
                        break;
                    }
                }
            }
        }

        // =============================================
        // 5. AEROPORTOS (ORIGEM/DESTINO)
        // =============================================
        const codigosConhecidos = [
            'GRU', 'CGH', 'GIG', 'SDU', 'BSB', 'CNF', 'SSA', 'REC', 'FOR', 'POA',
            'CWB', 'VCP', 'BEL', 'MAO', 'FLN', 'NAT', 'MCZ', 'AJU', 'SLZ', 'THE',
            'CGB', 'GYN', 'VIX', 'JPA', 'PMW', 'BPS', 'ILZ', 'FEN', 'SJP',
            'MIA', 'JFK', 'EWR', 'LAX', 'ORD', 'LHR', 'CDG', 'FCO', 'MAD', 'LIS',
            'BOG', 'SCL', 'EZE', 'PTY', 'MEX', 'CUN', 'DXB', 'SIN', 'NRT', 'HND',
            'ICN', 'HKG', 'PEK'
        ];

        // VoeGOL: "Viagem REC GIG"
        const rotaMatch = flat.match(/(?:Viagem|Trecho|Rota)\s+([A-Z]{3})\s*(?:→|➜|>|✈|[\u2708\u279E\u2192])?\s*([A-Z]{3})/i);
        if (rotaMatch && codigosConhecidos.includes(rotaMatch[1].toUpperCase()) && codigosConhecidos.includes(rotaMatch[2].toUpperCase())) {
            dados.origem = rotaMatch[1].toUpperCase();
            dados.destino = rotaMatch[2].toUpperCase();
        }

        // Azul/Genérico: "CGH > REC" ou "CGH ✈ REC"
        if (!dados.origem) {
            const rotaSeta = flat.match(/([A-Z]{3})\s*(?:[>»→✈\u2708\u279E\u2192])\s*([A-Z]{3})/);
            if (rotaSeta && codigosConhecidos.includes(rotaSeta[1]) && codigosConhecidos.includes(rotaSeta[2])) {
                dados.origem = rotaSeta[1];
                dados.destino = rotaSeta[2];
            }
        }

        // LATAM: mapeia nomes de cidades a partir do itinerário (antes da busca genérica IATA)
        if (!dados.origem && dados.companhia === 'LA') {
            const cidadeParaIATA = {
                'congonhas': 'CGH', 'guarulhos': 'GRU', 'viracopos': 'VCP',
                'gale[aã]o': 'GIG', 'santos dumont': 'SDU', 'bras[ií]lia': 'BSB',
                'confins': 'CNF', 'salvador': 'SSA', 'recife': 'REC', 'guararapes': 'REC',
                'fortaleza': 'FOR', 'porto alegre': 'POA', 'curitiba': 'CWB',
                'florian[oó]polis': 'FLN', 'herc[ií]lio': 'FLN', 'natal': 'NAT', 'macei[oó]': 'MCZ',
                'bel[eé]m': 'BEL', 'manaus': 'MAO'
            };
            // Buscar a partir do primeiro voo LA no texto, ordenar por posição
            const itinerarioStart = flat.search(/Itiner[aá]rio|LA\d{3,4}/i);
            const textoItinerario = itinerarioStart >= 0 ? flat.substring(itinerarioStart) : flat;
            const cidadesComPos = [];
            for (const [cidade, iata] of Object.entries(cidadeParaIATA)) {
                const regex = new RegExp(cidade, 'i');
                const match = textoItinerario.match(regex);
                if (match) {
                    const pos = textoItinerario.indexOf(match[0]);
                    if (!cidadesComPos.find(c => c.iata === iata)) {
                        cidadesComPos.push({ iata, pos });
                    }
                }
            }
            // Ordenar por posição de aparição no texto
            cidadesComPos.sort((a, b) => a.pos - b.pos);
            const origensEncontradas = cidadesComPos.map(c => c.iata);
            if (origensEncontradas.length >= 2) {
                dados.origem = origensEncontradas[0];
                dados.destino = origensEncontradas[1];
            } else if (origensEncontradas.length === 1) {
                dados.origem = origensEncontradas[0];
            }
        }

        // Busca códigos IATA em linhas (fallback genérico)
        if (!dados.origem) {
            const aeroportosEncontrados = [];
            for (const linha of linhas) {
                for (const codigo of codigosConhecidos) {
                    if (new RegExp(`\\b${codigo}\\b`).test(linha) && !aeroportosEncontrados.includes(codigo)) {
                        aeroportosEncontrados.push(codigo);
                    }
                }
            }
            if (aeroportosEncontrados.length >= 2) {
                dados.origem = aeroportosEncontrados[0];
                dados.destino = aeroportosEncontrados[1];
            } else if (aeroportosEncontrados.length === 1) {
                dados.origem = aeroportosEncontrados[0];
            }
        }

        // =============================================
        // 6. DATAS
        // =============================================
        const meses = {
            'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
            'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
            'janeiro': '01', 'fevereiro': '02', 'marco': '03', 'abril': '04',
            'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09',
            'outubro': '10', 'novembro': '11', 'dezembro': '12'
        };

        // Padrão "31 de jan." ou "16 de jan. de 2026"
        const dataTextoMatch = flat.match(/(\d{1,2})\s+de\s+(jan(?:eiro)?|fev(?:ereiro)?|mar(?:[cç]o)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)[.\s,](?:\s*de\s*(\d{4}))?/i);
        if (dataTextoMatch) {
            const dia = dataTextoMatch[1].padStart(2, '0');
            const mesKey = dataTextoMatch[2].toLowerCase().replace('.', '').replace('ç', 'c');
            const mes = meses[mesKey] || meses[mesKey.substring(0, 3)];
            const ano = dataTextoMatch[3] || new Date().getFullYear();
            if (mes) {
                dados.dataIda = `${ano}-${mes}-${dia}`;
            }
        }

        // Padrão DD/MM/YYYY (4 dígitos ano) - busca contextual primeiro
        if (!dados.dataIda) {
            const dataContexto = flat.match(/(?:viagem|ida|partida|embarque|feira)[,\s]+(\d{2})\/(\d{2})\/(\d{4})/i);
            if (dataContexto) {
                dados.dataIda = `${dataContexto[3]}-${dataContexto[2]}-${dataContexto[1]}`;
            } else {
                const dataFullMatch = flat.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                if (dataFullMatch) {
                    dados.dataIda = `${dataFullMatch[3]}-${dataFullMatch[2]}-${dataFullMatch[1]}`;
                }
            }
        }

        // Padrão DD/MM/YY (2 dígitos ano - LATAM usa "03/03/26")
        if (!dados.dataIda) {
            // Busca contextual: perto de tabela de itinerário
            const dataShortCtx = flat.match(/(?:Origem|Destino|Itiner|Saída).*?(\d{2})\/(\d{2})\/(\d{2})(?!\d)/i);
            if (dataShortCtx) {
                const anoShort = parseInt(dataShortCtx[3]);
                const anoFull = anoShort >= 50 ? 1900 + anoShort : 2000 + anoShort;
                dados.dataIda = `${anoFull}-${dataShortCtx[2]}-${dataShortCtx[1]}`;
            } else {
                const dataShortMatch = flat.match(/(\d{2})\/(\d{2})\/(\d{2})(?!\d)/);
                if (dataShortMatch) {
                    const anoShort = parseInt(dataShortMatch[3]);
                    const anoFull = anoShort >= 50 ? 1900 + anoShort : 2000 + anoShort;
                    dados.dataIda = `${anoFull}-${dataShortMatch[2]}-${dataShortMatch[1]}`;
                }
            }
        }
        // LATAM PDF com caracteres espaçados: data aparece como "1 1 / 0 3 / 2 6"
        // Busca a partir da seção de Itinerário para evitar capturar a data de emissão
        if (!dados.dataIda && dados.companhia === 'LA') {
            const itinPos = flat.search(/I\s*t\s*i\s*n\s*e\s*r/i);
            const searchFrom = itinPos >= 0 ? flat.substring(itinPos) : flat;
            const spacedDate = searchFrom.match(/(\d)\s(\d)\s*\/\s*(\d)\s(\d)\s*\/\s*(\d)\s(\d)/);
            if (spacedDate) {
                const dia = spacedDate[1] + spacedDate[2];
                const mes = spacedDate[3] + spacedDate[4];
                const anoShort = parseInt(spacedDate[5] + spacedDate[6]);
                const anoFull = anoShort >= 50 ? 1900 + anoShort : 2000 + anoShort;
                dados.dataIda = `${anoFull}-${mes}-${dia}`;
            }
        }

        // =============================================
        // 6b. DATA DE VOLTA + VOO VOLTA
        // =============================================
        // Azul new format: "VOOS DE VOLTA" section with date and flight number
        if (dados.companhia === 'AD') {
            let emVolta = false;
            for (let i = 0; i < linhas.length; i++) {
                if (/VOOS\s+DE\s+VOLTA/i.test(linhas[i])) {
                    emVolta = true;
                    continue;
                }
                if (emVolta) {
                    // Look for date in DD/MM/YYYY or "DD de mês" format
                    if (!dados.dataVolta) {
                        const dataFull = linhas[i].match(/(\d{2})\/(\d{2})\/(\d{4})/);
                        if (dataFull) {
                            dados.dataVolta = `${dataFull[3]}-${dataFull[2]}-${dataFull[1]}`;
                        }
                        const dataTexto = linhas[i].match(/(\d{1,2})\s+de\s+(jan(?:eiro)?|fev(?:ereiro)?|mar(?:[cç]o)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)[.\s,]?(?:\s*de\s*(\d{4}))?/i);
                        if (dataTexto) {
                            const dia = dataTexto[1].padStart(2, '0');
                            const mesKey = dataTexto[2].toLowerCase().replace('.', '').replace('ç', 'c');
                            const mes = meses[mesKey] || meses[mesKey.substring(0, 3)];
                            const ano = dataTexto[3] || new Date().getFullYear();
                            if (mes) dados.dataVolta = `${ano}-${mes}-${dia}`;
                        }
                    }
                    // Look for flight number (AD NNNN or just NNNN)
                    if (!dados.vooVolta) {
                        const vooMatch = linhas[i].match(/\b(?:AD\s*)?(\d{4})\b/);
                        if (vooMatch) {
                            dados.vooVolta = 'AD ' + vooMatch[1];
                        }
                    }
                    // Stop after collecting data or at next major section
                    if (/^(BAGAG|VALOR|TOTAL|TARIFA|R\$|Informac)/i.test(linhas[i])) break;
                    if (dados.dataVolta && dados.vooVolta) break;
                }
            }
        }

        // Generic dataVolta: look for "volta" context with date
        if (!dados.dataVolta) {
            const voltaCtx = flat.match(/(?:volta|retorno)\s+.*?(\d{2})\/(\d{2})\/(\d{4})/i);
            if (voltaCtx) {
                dados.dataVolta = `${voltaCtx[3]}-${voltaCtx[2]}-${voltaCtx[1]}`;
            }
        }
        if (!dados.dataVolta) {
            const voltaCtx2 = flat.match(/(?:volta|retorno)\s+.*?(\d{2})\/(\d{2})\/(\d{2})(?!\d)/i);
            if (voltaCtx2) {
                const anoShort = parseInt(voltaCtx2[3]);
                const anoFull = anoShort >= 50 ? 1900 + anoShort : 2000 + anoShort;
                dados.dataVolta = `${anoFull}-${voltaCtx2[2]}-${voltaCtx2[1]}`;
            }
        }

        // =============================================
        // 7. HORÁRIOS
        // =============================================
        const parteAs = flat.match(/parte\s+[àa]s\s+(\d{1,2}:\d{2})/i);
        const chegadaAs = flat.match(/[Cc]hegada\s+[àa]s\s+(\d{1,2}:\d{2})/i);
        if (parteAs) dados.horaPartida = parteAs[1];
        if (chegadaAs) dados.horaChegada = chegadaAs[1];

        // LATAM: primeiro horário na tabela de itinerário
        if (!dados.horaPartida && dados.companhia === 'LA') {
            // Formato normal: "LA3623 ... 04:50 ... 07:30"
            const horaLatam = flat.match(/LA\d{3,4}\s+.*?(\d{1,2}:\d{2})\s+.*?(\d{1,2}:\d{2})/);
            if (horaLatam) {
                dados.horaPartida = horaLatam[1];
                dados.horaChegada = horaLatam[2];
            } else {
                // Formato espaçado: "4 : 5 0" → 04:50 (LATAM PDFs com chars espaçados)
                const itinPos = flat.search(/I\s*t\s*i\s*n\s*e\s*r/i);
                const searchFrom = itinPos >= 0 ? flat.substring(itinPos) : flat;
                const spacedTimes = [...searchFrom.matchAll(/(\d{1,2})\s*:\s*(\d)\s(\d)(?!\d)/g)]
                    .filter(m => { const h = parseInt(m[1]); return h >= 0 && h <= 23; });
                if (spacedTimes.length >= 2) {
                    dados.horaPartida = spacedTimes[0][1].padStart(2, '0') + ':' + spacedTimes[0][2] + spacedTimes[0][3];
                    dados.horaChegada = spacedTimes[1][1].padStart(2, '0') + ':' + spacedTimes[1][2] + spacedTimes[1][3];
                } else if (spacedTimes.length === 1) {
                    dados.horaPartida = spacedTimes[0][1].padStart(2, '0') + ':' + spacedTimes[0][2] + spacedTimes[0][3];
                }
            }
        }

        // Coleta todos horários HH:MM
        if (!dados.horaPartida) {
            const todosHorarios = [];
            const horarioRegex = /\b(\d{1,2}:\d{2})\b/g;
            let match;
            while ((match = horarioRegex.exec(flat)) !== null) {
                const h = parseInt(match[1].split(':')[0]);
                if (h >= 0 && h <= 23) {
                    todosHorarios.push(match[1]);
                }
            }
            const horariosUnicos = [...new Set(todosHorarios)];
            if (horariosUnicos.length >= 2) {
                dados.horaPartida = horariosUnicos[0];
                dados.horaChegada = horariosUnicos[1];
            } else if (horariosUnicos.length === 1) {
                dados.horaPartida = horariosUnicos[0];
            }
        }

        // =============================================
        // 8. CABINE / CLASSE
        // =============================================
        if (/econ[oô]mica|economy\b/i.test(flat)) dados.cabine = 'Econômica';
        else if (/executiva|business\b/i.test(flat)) dados.cabine = 'Executiva';
        else if (/primeira\s*classe|first\s*class/i.test(flat)) dados.cabine = 'Primeira Classe';
        else if (/premium\s*economy/i.test(flat)) dados.cabine = 'Premium Economy';
        if (!dados.cabine && /\bStandard\b/i.test(flat)) dados.cabine = 'Econômica';

        // =============================================
        // 9. BAGAGEM
        // =============================================
        // Azul: "1 10kg 0 23kg" ou OCR variant "B 1 [i] 0 10kg 23kg"
        const bagAzul = flat.match(/(\d+)\s+(\d+)kg\s+(\d+)\s+(\d+)kg/);
        if (bagAzul) {
            const mao = parseInt(bagAzul[1]);
            const maoKg = bagAzul[2];
            const desp = parseInt(bagAzul[3]);
            const despKg = bagAzul[4];
            const partes = [];
            if (mao > 0) partes.push(`${mao}x ${maoKg}kg (mão)`);
            if (desp > 0) partes.push(`${desp}x ${despKg}kg (despachada)`);
            else partes.push('Sem bagagem despachada');
            dados.bagagem = partes.join(' + ');
        }

        if (!dados.bagagem && /sem\s*mala/i.test(flat)) {
            dados.bagagem = 'Sem mala despachada';
        }

        if (!dados.bagagem) {
            const bagGeneric = flat.match(/(\d+)\s*[xX]\s*(\d+)\s*kg/i);
            if (bagGeneric) {
                dados.bagagem = `${bagGeneric[1]}x ${bagGeneric[2]}kg`;
            }
        }

        // LATAM: "Despachada: 1 peça(s) ... 23 kg"
        if (!dados.bagagem) {
            const bagLatam = flat.match(/[Dd]espachada[:\s]+(\d+)\s+pe[çc]a[s]?[^.]*?(\d+)\s*kg/i);
            if (bagLatam) {
                dados.bagagem = `${bagLatam[1]}x ${bagLatam[2]}kg (despachada)`;
            }
        }

        if (!dados.bagagem && dados.companhia === 'LA') {
            if (/ultrapasse.*?23\s*kg/i.test(flat)) {
                dados.bagagem = '1x 23kg (despachada)';
            } else if (/10\s*kg.*cabine/i.test(flat)) {
                dados.bagagem = 'Apenas bagagem de mão (10kg)';
            }
        }

        // =============================================
        // 10. VALORES (R$)
        // =============================================
        // OCR pode usar "RS" em vez de "R$" ou "R$114,50" sem espaço
        const flatValores = flat.replace(/RS\s*/gi, 'R$ ').replace(/R\$\s*/g, 'R$ ');

        const tarifaMatch = flatValores.match(/[Tt]arifa\s+R\$\s?([\d.,]+)/);
        const taxaMatch = flatValores.match(/[Tt]axa[s]?\s+(?:e\/ou\s+impostos?|emb(?:arque)?\.?)\s+R\$\s?([\d.,]+)/i);
        const totalMatch = flatValores.match(/[Tt]otal\s+(?:pago\s+)?R\$\s?([\d.,]+)/);

        // Parser inteligente de valor: "1.234,56" (BR) ou "114.50" (ponto decimal)
        const parseValor = (str) => {
            if (!str) return 0;
            // Se tem vírgula, formato BR: ponto é milhar, vírgula é decimal
            if (str.includes(',')) {
                return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
            }
            // Sem vírgula: se tem um único ponto com 2 dígitos depois, é decimal
            const pontos = str.match(/\./g);
            if (pontos && pontos.length === 1 && /\.\d{2}$/.test(str)) {
                return parseFloat(str) || 0;
            }
            // Múltiplos pontos = milhares
            return parseFloat(str.replace(/\./g, '')) || 0;
        };

        if (tarifaMatch) {
            dados.tarifa = parseValor(tarifaMatch[1]);
        }
        if (taxaMatch) {
            dados.taxaEmbarque = parseValor(taxaMatch[1]);
        }
        if (totalMatch) {
            dados.total = parseValor(totalMatch[1]);
        }

        // Coleta todos os R$ valores
        const valoresMatch = flatValores.match(/R\$\s?([\d.,]+)/g);
        if (valoresMatch) {
            const valores = valoresMatch.map(v => {
                return parseValor(v.replace('R$', '').trim());
            }).filter(v => v > 0);

            if (!dados.total && valores.length > 0) {
                const unicos = [...new Set(valores)].sort((a, b) => a - b);
                if (unicos.length >= 3) {
                    dados.total = unicos[unicos.length - 1];
                    dados.taxaEmbarque = unicos[0];
                    dados.tarifa = unicos[unicos.length - 2];
                } else if (unicos.length === 2) {
                    dados.total = Math.max(...unicos);
                    dados.tarifa = Math.min(...unicos);
                } else if (unicos.length === 1) {
                    dados.total = unicos[0];
                }
            }
        }

        // LATAM: "61.190 milhas + R$ 114,50"
        if (!dados.total && dados.companhia === 'LA') {
            const milhasMatch = flatValores.match(/milhas\s*\+?\s*R\$\s?([\d.,]+)/i);
            if (milhasMatch) {
                dados.total = parseValor(milhasMatch[1]);
            }
        }

        // =============================================
        // 11. TRECHOS (segmentos de voo)
        // =============================================
        // Azul new format: parse "VOOS DE IDA" and "VOOS DE VOLTA" sections
        if (dados.companhia === 'AD') {
            const secoes = [
                { regex: /VOOS\s+DE\s+IDA/i, tipo: 'ida' },
                { regex: /VOOS\s+DE\s+VOLTA/i, tipo: 'volta' }
            ];
            for (const secao of secoes) {
                for (let i = 0; i < linhas.length; i++) {
                    if (!secao.regex.test(linhas[i])) continue;
                    // Scan next lines for flight data
                    let data = '', origemTrecho = '', destinoTrecho = '', horaPartidaT = '', horaChegadaT = '', vooTrecho = '';
                    for (let j = i + 1; j < Math.min(i + 12, linhas.length); j++) {
                        const l = linhas[j].trim();
                        // Stop at next major section
                        if (/^(VOOS\s+DE|BAGAGEN|PASSAGEIR|\d+\s+PASSAGEIR)/i.test(l)) break;
                        // Date: "12 de jan. de 2026"
                        if (!data) {
                            const dtMatch = l.match(/(\d{1,2})\s+de\s+(jan(?:eiro)?|fev(?:ereiro)?|mar(?:[cç]o)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)[.\s,]?(?:\s*de\s*(\d{4}))?/i);
                            if (dtMatch) {
                                const dia = dtMatch[1].padStart(2, '0');
                                const mesKey = dtMatch[2].toLowerCase().replace('.', '').replace('ç', 'c');
                                const mes = meses[mesKey] || meses[mesKey.substring(0, 3)];
                                const ano = dtMatch[3] || new Date().getFullYear();
                                if (mes) data = `${ano}-${mes}-${dia}`;
                            }
                        }
                        if (!data) {
                            const dtFull = l.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                            if (dtFull) data = `${dtFull[3]}-${dtFull[2]}-${dtFull[1]}`;
                        }
                        // Departure: "REC - 12:35" or "GRU - 16:40"
                        const depMatch = l.match(/([A-Z]{3})\s*-\s*(\d{1,2}:\d{2})/);
                        if (depMatch && !origemTrecho) {
                            origemTrecho = depMatch[1];
                            horaPartidaT = depMatch[2];
                        }
                        // Arrival: "15:50 - GRU" or "19:40 - REC"
                        const arrMatch = l.match(/(\d{1,2}:\d{2})\s*-\s*([A-Z]{3})/);
                        if (arrMatch && !destinoTrecho) {
                            destinoTrecho = arrMatch[2];
                            horaChegadaT = arrMatch[1];
                        }
                        // Flight number: "AD2768" or "AD5092"
                        const vooMatch = l.match(/\b(AD\s?\d{3,4})\b/);
                        if (vooMatch && !vooTrecho) {
                            vooTrecho = vooMatch[1].replace(/\s/, ' ');
                            if (!vooTrecho.includes(' ')) vooTrecho = 'AD ' + vooTrecho.substring(2);
                        }
                    }
                    if (origemTrecho || destinoTrecho || data || vooTrecho) {
                        dados.trechos.push({
                            tipo: secao.tipo,
                            voo: vooTrecho,
                            origem: origemTrecho,
                            destino: destinoTrecho,
                            data: data,
                            horaPartida: horaPartidaT,
                            horaChegada: horaChegadaT
                        });
                    }
                }
            }
            // Old Azul format: "Itinerário de IDA" with "CGH > REC"
            if (dados.trechos.length === 0) {
                const trecho = {
                    tipo: 'ida',
                    voo: dados.numeroVoo || '',
                    origem: dados.origem || '',
                    destino: dados.destino || '',
                    data: dados.dataIda || '',
                    horaPartida: dados.horaPartida || '',
                    horaChegada: dados.horaChegada || ''
                };
                if (trecho.origem || trecho.voo || trecho.data) dados.trechos.push(trecho);
            }
        }

        // LATAM: parse itinerary table rows
        // Format: LA3651 ... 03/03/26 6:55 03/03/26 10:20 Economy ...
        if (dados.companhia === 'LA' && dados.trechos.length === 0) {
            const cidadeIATA = {
                'congonhas': 'CGH', 'guarulhos': 'GRU', 'viracopos': 'VCP',
                'gale[aã]o': 'GIG', 'santos dumont': 'SDU',
                'bras[ií]lia': 'BSB', 'confins': 'CNF',
                'salvador': 'SSA', 'recife': 'REC', 'guararapes': 'REC',
                'fortaleza': 'FOR', 'porto alegre': 'POA', 'curitiba': 'CWB',
                'florian[oó]polis': 'FLN', 'herc[ií]lio': 'FLN',
                'natal': 'NAT', 'macei[oó]': 'MCZ',
                'bel[eé]m': 'BEL', 'manaus': 'MAO',
                'campinas': 'VCP', 'goi[aâ]nia': 'GYN',
                'vit[oó]ria': 'VIX', 'jo[aã]o pessoa': 'JPA',
                'aracaju': 'AJU', 's[aã]o lu[ií]s': 'SLZ',
                'teresina': 'THE', 'cuiab[aá]': 'CGB'
            };

            // Find all LA flight rows: "LA3651" followed by dates DD/MM/YY and times
            const vooRegex = /\b(LA\d{3,4})\b/g;
            let vooMatch;
            const vooPositions = [];
            while ((vooMatch = vooRegex.exec(flat)) !== null) {
                vooPositions.push({ voo: vooMatch[1], pos: vooMatch.index });
            }

            for (let vi = 0; vi < vooPositions.length; vi++) {
                const startPos = vooPositions[vi].pos;
                const endPos = vi + 1 < vooPositions.length
                    ? vooPositions[vi + 1].pos
                    : Math.min(startPos + 300, flat.length);
                const segmento = flat.substring(startPos, endPos);

                // Extract date+time pairs: "03/03/26 6:55"
                const dtPairs = [...segmento.matchAll(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{1,2}:\d{2})/g)];
                if (dtPairs.length < 2) continue;

                const dep = dtPairs[0];
                const arr = dtPairs[1];
                const anoShort = parseInt(dep[3]);
                const anoFull = anoShort >= 50 ? 1900 + anoShort : 2000 + anoShort;

                // Extract origin/destination from full segment text
                const cidadesEncontradas = [];
                for (const [cidade, iata] of Object.entries(cidadeIATA)) {
                    const regex = new RegExp(cidade, 'gi');
                    let cityMatch;
                    while ((cityMatch = regex.exec(segmento)) !== null) {
                        if (!cidadesEncontradas.find(c => c.iata === iata && Math.abs(c.pos - cityMatch.index) < 20)) {
                            cidadesEncontradas.push({ iata, pos: cityMatch.index });
                        }
                    }
                }

                // Also search for 3-letter IATA codes directly (GRU, REC, CGH, etc.)
                if (typeof codigosConhecidos !== 'undefined') {
                    const iataRegex = /\b([A-Z]{3})\b/g;
                    let iataMatch;
                    while ((iataMatch = iataRegex.exec(segmento)) !== null) {
                        const code = iataMatch[1];
                        if (codigosConhecidos.includes(code) && !cidadesEncontradas.find(c => c.iata === code && Math.abs(c.pos - iataMatch.index) < 20)) {
                            cidadesEncontradas.push({ iata: code, pos: iataMatch.index });
                        }
                    }
                }

                cidadesEncontradas.sort((a, b) => a.pos - b.pos);

                // Deduplicate: keep first occurrence of each unique IATA, then pick first two distinct
                const seen = new Set();
                const cidadesUnicas = [];
                for (const c of cidadesEncontradas) {
                    if (!seen.has(c.iata)) {
                        seen.add(c.iata);
                        cidadesUnicas.push(c);
                    }
                }

                dados.trechos.push({
                    tipo: 'ida', // adjusted below
                    voo: vooPositions[vi].voo,
                    origem: cidadesUnicas[0]?.iata || '',
                    destino: cidadesUnicas[1]?.iata || '',
                    data: `${anoFull}-${dep[2]}-${dep[1]}`,
                    horaPartida: dep[4],
                    horaChegada: arr[4]
                });
            }

            // Determine ida/volta: group by date, first date = ida, later = volta
            if (dados.trechos.length > 1) {
                const uniqueDates = [...new Set(dados.trechos.map(t => t.data))].sort();
                if (uniqueDates.length >= 2) {
                    const idaDate = uniqueDates[0];
                    dados.trechos.forEach(t => {
                        t.tipo = t.data === idaDate ? 'ida' : 'volta';
                    });
                }
            }
        }

        // Fallback genérico: build trechos from single fields
        if (dados.trechos.length === 0) {
            if (dados.origem || dados.numeroVoo || dados.dataIda) {
                dados.trechos.push({
                    tipo: 'ida',
                    voo: dados.numeroVoo || '',
                    origem: dados.origem || '',
                    destino: dados.destino || '',
                    data: dados.dataIda || '',
                    horaPartida: dados.horaPartida || '',
                    horaChegada: dados.horaChegada || ''
                });
            }
            if (dados.dataVolta || dados.vooVolta) {
                dados.trechos.push({
                    tipo: 'volta',
                    voo: dados.vooVolta || dados.numeroVoo || '',
                    origem: dados.destino || '',
                    destino: dados.origem || '',
                    data: dados.dataVolta || '',
                    horaPartida: '',
                    horaChegada: ''
                });
            }
        }

        // Sync single fields from trechos for backward compatibility
        if (dados.trechos.length > 0) {
            const ida = dados.trechos.find(t => t.tipo === 'ida');
            const volta = dados.trechos.find(t => t.tipo === 'volta');
            if (ida) {
                if (!dados.origem) dados.origem = ida.origem;
                if (!dados.destino) dados.destino = ida.destino;
                if (!dados.dataIda) dados.dataIda = ida.data;
                if (!dados.numeroVoo) dados.numeroVoo = ida.voo;
                if (!dados.horaPartida) dados.horaPartida = ida.horaPartida;
                if (!dados.horaChegada) dados.horaChegada = ida.horaChegada;
            }
            if (volta) {
                if (!dados.dataVolta) dados.dataVolta = volta.data;
                if (!dados.vooVolta) dados.vooVolta = volta.voo;
            }
        }

        debugLog('Parser: resultado', dados);
        return dados;
    },

    /**
     * Formata nome: "JOAO DO REGO" → "Joao Do Rego"
     */
    _formatarNome(nome) {
        if (!nome) return '';
        return nome.toLowerCase().replace(/(?:^|\s)\S/g, l => l.toUpperCase()).trim();
    },

    /**
     * Split Title Case names that are on the same line (Azul new format)
     * Example: "Joseja Felipe Da Silva Maria Patricia Silva Dantas" with N=2
     * Strategy: connectors (Da, De, Do, Dos, Das) belong to the PREVIOUS name part.
     * A new name starts when an uppercase word appears after a non-connector word.
     */
    _splitNomesTitleCase(texto, numNomes) {
        if (numNomes <= 1) return [texto.trim()];
        const palavras = texto.trim().split(/\s+/);
        // Connectors that are part of a name (lowercase or these specific words)
        const conectores = ['da', 'de', 'do', 'dos', 'das', 'di', 'del', 'e'];

        // Build word groups: each word knows if it's a connector
        const groups = palavras.map(p => ({
            word: p,
            isConector: conectores.includes(p.toLowerCase())
        }));

        // Find possible split points: a word that starts with uppercase after a non-connector
        // The split point is where a NEW first name begins
        const splitPoints = [];
        for (let i = 1; i < groups.length; i++) {
            const prev = groups[i - 1];
            const curr = groups[i];
            // A new name starts if: current word is capitalized AND previous was NOT a connector
            // This means "Da Silva Maria" splits before "Maria" (prev="Silva" is not connector)
            if (!prev.isConector && /^[A-ZÀ-Ú]/.test(curr.word) && !curr.isConector) {
                splitPoints.push(i);
            }
        }

        // We need exactly (numNomes - 1) split points
        if (splitPoints.length >= numNomes - 1) {
            // Try to find the best split points that divide names most evenly
            const bestSplits = this._pickBestSplits(splitPoints, numNomes - 1, palavras.length);
            const nomes = [];
            let start = 0;
            for (const sp of bestSplits) {
                nomes.push(palavras.slice(start, sp).join(' '));
                start = sp;
            }
            nomes.push(palavras.slice(start).join(' '));
            return nomes;
        }

        // Fallback: couldn't split properly
        return [texto.trim()];
    },

    /**
     * Pick N split points from candidates that divide the array most evenly
     */
    _pickBestSplits(candidates, numSplits, totalWords) {
        if (numSplits === 1) {
            // Pick the split closest to the middle
            const mid = totalWords / 2;
            let best = candidates[0];
            let bestDist = Math.abs(best - mid);
            for (const c of candidates) {
                const dist = Math.abs(c - mid);
                if (dist < bestDist) { best = c; bestDist = dist; }
            }
            return [best];
        }
        // For 2+ splits, use simple even distribution
        const segSize = totalWords / (numSplits + 1);
        const chosen = [];
        for (let s = 1; s <= numSplits; s++) {
            const target = segSize * s;
            let best = candidates[0];
            let bestDist = Math.abs(best - target);
            for (const c of candidates) {
                if (chosen.includes(c)) continue;
                const dist = Math.abs(c - target);
                if (dist < bestDist) { best = c; bestDist = dist; }
            }
            chosen.push(best);
        }
        return chosen.sort((a, b) => a - b);
    },

    /**
     * Split ALL CAPS names that got merged into one string (Azul old format)
     * Example: "JOSEFA MARIA DE SOUZA SILVA SEBASTIANA PEREIRA DE SOUSA BRAINER ELISSANDRA MARIA DOS SANTIS SILVA" with N=3
     * Strategy: ALL CAPS connectors (DE, DA, DO, DOS, DAS) belong to previous name.
     * A new name starts at a non-connector CAPS word after another non-connector word.
     */
    _splitNomesAllCaps(texto, numNomes) {
        if (numNomes <= 1) return [texto.trim()];
        const palavras = texto.trim().split(/\s+/);
        const conectores = ['DA', 'DE', 'DO', 'DOS', 'DAS', 'DI', 'DEL', 'E'];

        const splitPoints = [];
        for (let i = 1; i < palavras.length; i++) {
            const prev = palavras[i - 1];
            const curr = palavras[i];
            if (!conectores.includes(prev) && !conectores.includes(curr) && /^[A-ZÀ-Ú]{2,}$/.test(curr)) {
                splitPoints.push(i);
            }
        }

        if (splitPoints.length >= numNomes - 1) {
            const bestSplits = this._pickBestSplits(splitPoints, numNomes - 1, palavras.length);
            const nomes = [];
            let start = 0;
            for (const sp of bestSplits) {
                nomes.push(palavras.slice(start, sp).join(' '));
                start = sp;
            }
            nomes.push(palavras.slice(start).join(' '));
            return nomes;
        }

        return [texto.trim()];
    },

    /**
     * Preenche o formulário de importação com os dados extraídos
     */
    _preencherFormularioImportacao(dados) {
        document.getElementById('importCodigoReserva').value = dados.codigoReserva || '';
        document.getElementById('importCabine').value = dados.cabine || 'Econômica';
        document.getElementById('importBagagem').value = dados.bagagem || '';
        document.getElementById('importTarifa').value = dados.tarifa || '';
        document.getElementById('importTaxaEmbarque').value = dados.taxaEmbarque || '';
        document.getElementById('importTotalPDF').value = dados.total || '';

        // Pré-selecionar companhia
        if (dados.companhia) {
            document.getElementById('importCompanhia').value = dados.companhia;
        }

        // importValorCompra removido do formulário de importação

        // Montar lista de trechos editáveis
        const trechos = dados.trechos && dados.trechos.length > 0 ? dados.trechos : [];
        const trechosContainer = document.getElementById('importTrechosLista');
        if (trechosContainer) {
            if (trechos.length === 0) {
                trechosContainer.innerHTML = '<p class="text-muted">Nenhum trecho extraído do PDF</p>';
            } else {
                trechosContainer.innerHTML = trechos.map((trecho, idx) => {
                    const badgeClass = trecho.tipo === 'ida' ? 'bg-primary' : 'bg-success';
                    const badgeLabel = trecho.tipo === 'ida' ? 'IDA' : 'VOLTA';
                    return `
                        <div class="border rounded p-3 mb-3 trecho-item" data-idx="${idx}">
                            <div class="d-flex align-items-center mb-2">
                                <span class="badge ${badgeClass} me-2">${badgeLabel}</span>
                                <small class="text-muted">Trecho ${idx + 1}</small>
                            </div>
                            <div class="row g-3">
                                <div class="col-md-3">
                                    <label class="form-label">Nº Voo</label>
                                    <input type="text" class="form-control trecho-voo"
                                           id="trechoVoo_${idx}" value="${trecho.voo || ''}" placeholder="Ex: G3 1947">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Origem</label>
                                    <input type="text" class="form-control trecho-origem"
                                           id="trechoOrigem_${idx}" value="${trecho.origem || ''}" placeholder="Ex: GRU">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Destino</label>
                                    <input type="text" class="form-control trecho-destino"
                                           id="trechoDestino_${idx}" value="${trecho.destino || ''}" placeholder="Ex: REC">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Data</label>
                                    <input type="date" class="form-control trecho-data"
                                           id="trechoData_${idx}" value="${trecho.data || ''}">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Hora Partida</label>
                                    <input type="text" class="form-control trecho-hora-partida"
                                           id="trechoHoraPartida_${idx}" value="${trecho.horaPartida || ''}" placeholder="Ex: 08:30">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Hora Chegada</label>
                                    <input type="text" class="form-control trecho-hora-chegada"
                                           id="trechoHoraChegada_${idx}" value="${trecho.horaChegada || ''}" placeholder="Ex: 11:45">
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Montar lista de passageiros com checkboxes e nome editável (sem select de cliente)
        const passageiros = dados.passageiros && dados.passageiros.length > 0
            ? dados.passageiros
            : (dados.passageiro ? [dados.passageiro] : []);

        const container = document.getElementById('importPassageirosLista');
        if (container) {
            if (passageiros.length === 0) {
                container.innerHTML = '<p class="text-muted">Nenhum passageiro extraído do PDF</p>';
            } else {
                container.innerHTML = passageiros.map((nome, idx) => {
                    return `
                        <div class="row g-2 align-items-center mb-2 p-2 border rounded passageiro-item" data-idx="${idx}">
                            <div class="col-auto">
                                <div class="form-check">
                                    <input class="form-check-input passageiro-check" type="checkbox" id="passageiroCheck_${idx}" checked>
                                </div>
                            </div>
                            <div class="col">
                                <input type="text" class="form-control form-control-sm passageiro-nome"
                                       id="passageiroNome_${idx}" value="${nome}"
                                       style="font-weight: 500;">
                            </div>
                        </div>
                    `;
                }).join('');

            }
        }

        // Guardar dados dos passageiros no módulo para uso no salvar
        this._dadosImportacao = dados;
    },

    /**
     * Salva o bilhete importado do PDF
     */
    async salvarBilheteImportado() {
        const valorVendaTotal = 0;
        const valorCompraTotal = 0;
        const codigoReserva = document.getElementById('importCodigoReserva').value.trim().toUpperCase();
        const companhia = document.getElementById('importCompanhia').value;
        const fornecedorId = '';
        const dataEmissao = document.getElementById('importDataEmissao').value;
        const observacoes = document.getElementById('importObservacoes').value.trim();
        const cabine = document.getElementById('importCabine').value.trim();
        const tarifa = parseFloat(document.getElementById('importTarifa').value) || 0;
        const taxaEmbarque = parseFloat(document.getElementById('importTaxaEmbarque').value) || 0;
        const bagagem = document.getElementById('importBagagem').value.trim();

        // Coletar trechos do formulário
        const trechosItems = document.querySelectorAll('.trecho-item');
        const trechos = [];
        trechosItems.forEach((item, idx) => {
            trechos.push({
                tipo: this._dadosImportacao?.trechos?.[idx]?.tipo || 'ida',
                voo: document.getElementById(`trechoVoo_${idx}`)?.value?.trim() || '',
                origem: document.getElementById(`trechoOrigem_${idx}`)?.value?.trim().toUpperCase() || '',
                destino: document.getElementById(`trechoDestino_${idx}`)?.value?.trim().toUpperCase() || '',
                data: document.getElementById(`trechoData_${idx}`)?.value || '',
                horaPartida: document.getElementById(`trechoHoraPartida_${idx}`)?.value?.trim() || '',
                horaChegada: document.getElementById(`trechoHoraChegada_${idx}`)?.value?.trim() || ''
            });
        });

        // Derivar campos de compatibilidade dos trechos
        const trechoIda = trechos.find(t => t.tipo === 'ida');
        const trechoVolta = trechos.find(t => t.tipo === 'volta');
        const origem = trechoIda?.origem || '';
        const destino = trechoIda?.destino || '';
        const dataIda = trechoIda?.data || '';
        const dataVolta = trechoVolta?.data || null;
        const numeroVoo = trechoIda?.voo || '';
        const vooVolta = trechoVolta?.voo || '';
        const horaPartida = trechoIda?.horaPartida || '';
        const horaChegada = trechoIda?.horaChegada || '';

        // Coletar passageiros selecionados (sem cliente - pode vincular depois)
        const checkboxes = document.querySelectorAll('.passageiro-check');
        const passageirosSelecionados = [];

        checkboxes.forEach((cb, idx) => {
            if (cb.checked) {
                const nome = document.getElementById(`passageiroNome_${idx}`)?.value?.trim() || '';
                if (nome) {
                    passageirosSelecionados.push({ nome });
                }
            }
        });

        // Validações básicas
        if (!codigoReserva || !companhia || !dataEmissao) {
            alert('Preencha todos os campos obrigatórios: Código Reserva, Companhia e Data de Emissão.');
            return;
        }

        if (passageirosSelecionados.length === 0) {
            alert('Selecione pelo menos um passageiro.');
            return;
        }

        // Juntar nomes dos passageiros selecionados em um único bilhete
        const nomesPassageiros = passageirosSelecionados.map(p => p.nome).join(', ');

        const dados = {
            clienteId: '',
            codigoReserva: codigoReserva,
            companhia: companhia,
            fornecedorId: fornecedorId,
            dataIda: dataIda,
            dataVolta: dataVolta,
            origem: origem,
            destino: destino,
            valorVenda: valorVendaTotal,
            valorCompra: valorCompraTotal,
            dataEmissao: dataEmissao,
            observacoes: observacoes,
            passageiroNome: nomesPassageiros,
            numeroVoo: numeroVoo,
            vooVolta: vooVolta,
            cabine: cabine,
            tarifa: tarifa,
            taxaEmbarque: taxaEmbarque,
            bagagem: bagagem,
            horaPartida: horaPartida,
            horaChegada: horaChegada,
            aeroportoOrigem: origem,
            aeroportoDestino: destino,
            trechos: trechos
        };

        const resp = await apiCall('/api/bilhetes', {
            method: 'POST',
            body: JSON.stringify(dados)
        });
        if (!resp) return;

        const result = await resp.json();
        if (!result.success) {
            App.showToast(result.message || 'Erro ao salvar bilhete', 'error');
            return;
        }

        // Fecha modal e recarrega lista
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalImportarPDF'));
        modal.hide();

        // Invalidar caches para forçar reload
        this._clientes = [];
        this._fornecedores = [];
        await this.carregarBilhetes();

        App.showToast('Bilhete importado com sucesso!', 'success');
    },

    /**
     * Gera PDF personalizado GiraMundo para um bilhete
     */
    gerarPDFBilhete(id) {
        const bilhete = this._bilhetes.find(b => b.id === id);
        if (!bilhete) return;

        // Parse trechos se for string JSON
        const bilheteParaPDF = { ...bilhete };
        if (typeof bilheteParaPDF.trechos === 'string') {
            try { bilheteParaPDF.trechos = JSON.parse(bilheteParaPDF.trechos); } catch(e) { bilheteParaPDF.trechos = []; }
        }

        ReportModule.gerarBilhetePDF(bilheteParaPDF);
    },

    /**
     * Abre modal de recibo e gera PDF após confirmar a forma de pagamento
     */
    gerarRecibo(id) {
        const bilhete = this._bilhetes.find(b => b.id === id);
        if (!bilhete) return;

        // Remove modal anterior se existir
        document.getElementById('modalRecibo')?.remove();

        const nomeCliente = bilhete.clienteNome || 'Cliente';
        const valor = bilhete.valorVenda ? Formatter.currency(bilhete.valorVenda) : 'R$ 0,00';
        const nomePax = bilhete.passageiroNome || 'N/A';
        const qtdPax  = nomePax.includes(',') ? nomePax.split(',').filter(n => n.trim()).length : 1;

        const modalHtml = `
            <div class="modal fade" id="modalRecibo" tabindex="-1">
                <div class="modal-dialog modal-md">
                    <div class="modal-content">
                        <div class="modal-header" style="background: linear-gradient(135deg, #1a365d, #2b6cb0); color: #fff;">
                            <h5 class="modal-title"><i class="bi bi-receipt me-2"></i>Gerar Recibo de Pagamento</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info py-2 mb-3">
                                <i class="bi bi-info-circle me-1"></i>
                                <strong>${nomeCliente}</strong> — ${qtdPax} passageiro${qtdPax > 1 ? 's' : ''}
                                &nbsp;|&nbsp; Total: <strong>${valor}</strong>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-semibold">Forma de Pagamento</label>
                                <select class="form-select" id="reciboFormaPagamento">
                                    <option value="">Selecione...</option>
                                    <option value="Dinheiro">Dinheiro</option>
                                    <option value="PIX">PIX</option>
                                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                                    <option value="Cartão de Débito">Cartão de Débito</option>
                                    <option value="Transferência Bancária">Transferência Bancária</option>
                                    <option value="Boleto Bancário">Boleto Bancário</option>
                                    <option value="Cheque">Cheque</option>
                                </select>
                            </div>
                            <div class="mb-2">
                                <label class="form-label fw-semibold">Observação <small class="text-muted">(opcional)</small></label>
                                <input type="text" class="form-control" id="reciboObservacao"
                                       placeholder="Ex: Pago em 2x sem juros">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-success" onclick="TicketsModule._confirmarRecibo('${id}')">
                                <i class="bi bi-file-earmark-pdf me-1"></i> Gerar Recibo PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('modalRecibo'));
        modal.show();
    },

    _confirmarRecibo(id) {
        const formaPagamento = document.getElementById('reciboFormaPagamento').value;
        if (!formaPagamento) {
            document.getElementById('reciboFormaPagamento').classList.add('is-invalid');
            return;
        }
        const observacao = document.getElementById('reciboObservacao').value.trim();
        const forma = observacao ? `${formaPagamento} — ${observacao}` : formaPagamento;

        bootstrap.Modal.getInstance(document.getElementById('modalRecibo'))?.hide();

        const bilhete = this._bilhetes.find(b => b.id === id);
        if (!bilhete) return;
        ReportModule.gerarReciboPDF({ ...bilhete }, forma);
    },

    /**
     * Abre modal para emissão de fatura/invoice formal
     */
    gerarInvoice(id) {
        const bilhete = this._bilhetes.find(b => b.id === id);
        if (!bilhete) return;

        document.getElementById('modalInvoice')?.remove();

        const nomeCliente = bilhete.clienteNome || 'Cliente';
        const valor       = bilhete.valorVenda ? Formatter.currency(bilhete.valorVenda) : 'R$ 0,00';
        const nomePax     = bilhete.passageiroNome || '';
        const qtdPax      = nomePax.includes(',') ? nomePax.split(',').filter(n => n.trim()).length : 1;

        const modalHtml = `
            <div class="modal fade" id="modalInvoice" tabindex="-1">
                <div class="modal-dialog modal-md">
                    <div class="modal-content">
                        <div class="modal-header" style="background: linear-gradient(135deg, #1a365d, #2b6cb0); color: #fff;">
                            <h5 class="modal-title">
                                <i class="bi bi-file-earmark-text me-2"></i>Emitir Fatura / Invoice
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info py-2 mb-3">
                                <i class="bi bi-info-circle me-1"></i>
                                <strong>${nomeCliente}</strong> — ${qtdPax} passageiro${qtdPax > 1 ? 's' : ''}
                                &nbsp;|&nbsp; Total: <strong>${valor}</strong>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-semibold">Forma de Pagamento <span class="text-danger">*</span></label>
                                <select class="form-select" id="invoiceFormaPagamento">
                                    <option value="">Selecione...</option>
                                    <option value="Dinheiro">Dinheiro</option>
                                    <option value="PIX">PIX</option>
                                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                                    <option value="Cartão de Débito">Cartão de Débito</option>
                                    <option value="Transferência Bancária">Transferência Bancária</option>
                                    <option value="Boleto Bancário">Boleto Bancário</option>
                                    <option value="Cheque">Cheque</option>
                                </select>
                                <div class="invalid-feedback">Selecione a forma de pagamento.</div>
                            </div>
                            <div class="mb-2">
                                <label class="form-label fw-semibold">Observação <small class="text-muted">(opcional)</small></label>
                                <input type="text" class="form-control" id="invoiceObservacao"
                                       placeholder="Ex: Pago em 2x sem juros">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-warning text-dark fw-semibold"
                                    onclick="TicketsModule._confirmarInvoice('${id}')">
                                <i class="bi bi-file-earmark-text me-1"></i> Gerar Fatura PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('modalInvoice'));
        modal.show();
    },

    async _confirmarInvoice(id) {
        const formaPagamento = document.getElementById('invoiceFormaPagamento').value;
        if (!formaPagamento) {
            document.getElementById('invoiceFormaPagamento').classList.add('is-invalid');
            return;
        }
        const observacao = document.getElementById('invoiceObservacao').value.trim();

        bootstrap.Modal.getInstance(document.getElementById('modalInvoice'))?.hide();

        const bilhete = this._bilhetes.find(b => b.id === id);
        if (!bilhete) return;

        // Busca dados completos do cliente (CPF/CNPJ/endereço)
        let clienteCompleto = null;
        if (bilhete.clienteId) {
            try {
                const resp = await apiCall(`/api/clientes/${bilhete.clienteId}`);
                if (resp && resp.ok) clienteCompleto = await resp.json();
            } catch(e) {
                console.warn('[TicketsModule] Não foi possível buscar cliente completo:', e);
            }
        }

        ReportModule.gerarInvoicePDF(
            { ...bilhete },
            clienteCompleto || bilhete.cliente || null,
            { formaPagamento, observacao }
        );
    },

    /**
     * Edita bilhete existente
     */
    async editarBilhete(id) {
        const bilhete = this._bilhetes.find(b => b.id === id);
        if (!bilhete) return;

        await this.popularSelectsModal();

        document.getElementById('modalBilheteTitulo').innerHTML = '<i class="bi bi-pencil"></i> Editar Bilhete';
        document.getElementById('bilheteId').value = id;
        document.getElementById('bilheteCliente').value = bilhete.clienteId;
        document.getElementById('bilheteCodigoReserva').value = bilhete.codigoReserva;
        document.getElementById('bilheteCompanhia').value = bilhete.companhia;
        document.getElementById('bilheteFornecedor').value = bilhete.fornecedorId;
        document.getElementById('bilheteDataIda').value = Formatter.dateForInput(bilhete.dataIda);
        document.getElementById('bilheteDataVolta').value = bilhete.dataVolta ? Formatter.dateForInput(bilhete.dataVolta) : '';
        document.getElementById('bilheteOrigem').value = bilhete.origem || '';
        document.getElementById('bilheteDestino').value = bilhete.destino || '';
        document.getElementById('bilheteValorVenda').value = bilhete.valorVenda || '';
        document.getElementById('bilheteValorCompra').value = bilhete.valorCompra || '';
        document.getElementById('bilheteDataEmissao').value = Formatter.dateForInput(bilhete.dataEmissao);
        document.getElementById('bilheteObservacoes').value = bilhete.observacoes || '';

        // Calcula saldo
        this.calcularSaldo();

        const modal = new bootstrap.Modal(document.getElementById('modalBilhete'));
        modal.show();
    },

    /**
     * Visualiza bilhete
     */
    verBilhete(id) {
        const bilhete = this._bilhetes.find(b => b.id === id);
        if (!bilhete) return;

        const cliente = bilhete.cliente;
        const fornecedor = bilhete.fornecedor;
        const companhia = getAirlineByCode(bilhete.companhia);

        // Parse trechos se for string JSON
        if (bilhete.trechos && typeof bilhete.trechos === 'string') {
            try { bilhete.trechos = JSON.parse(bilhete.trechos); } catch(e) { bilhete.trechos = []; }
        }

        const html = `
            <div class="card">
                <div class="card-header bg-primary text-white">
                    <i class="bi bi-ticket-perforated"></i> Bilhete ${bilhete.codigoReserva}
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>Cliente:</strong> ${cliente?.nome || 'N/A'}</p>
                            <p><strong>Companhia:</strong> ${companhia?.name || bilhete.companhia}</p>
                            <p><strong>Fornecedor:</strong> ${fornecedor?.nome || 'N/A'}</p>
                            ${bilhete.passageiroNome ? `<p><strong>Passageiro:</strong> ${bilhete.passageiroNome}</p>` : ''}
                            ${bilhete.numeroVoo ? `<p><strong>Voo:</strong> ${bilhete.numeroVoo}</p>` : ''}
                        </div>
                        <div class="col-md-6">
                            ${bilhete.trechos && bilhete.trechos.length > 0
                                ? bilhete.trechos.map(t => `
                                    <p><strong>${t.tipo === 'ida' ? 'Ida' : 'Volta'}:</strong> ${Formatter.date(t.data)} ${t.origem || ''} ${t.horaPartida ? t.horaPartida : ''} → ${t.destino || ''} ${t.horaChegada ? t.horaChegada : ''} ${t.voo ? `<small class="text-muted">(${t.voo})</small>` : ''}</p>
                                `).join('')
                                : `
                                    <p><strong>Data Ida:</strong> ${Formatter.date(bilhete.dataIda)} ${bilhete.origem ? `(${bilhete.origem})` : ''} ${bilhete.horaPartida ? `- ${bilhete.horaPartida}` : ''}</p>
                                    <p><strong>Data Volta:</strong> ${bilhete.dataVolta ? Formatter.date(bilhete.dataVolta) : 'Somente ida'} ${bilhete.destino ? `(${bilhete.destino})` : ''} ${bilhete.horaChegada ? `- ${bilhete.horaChegada}` : ''}</p>
                                `
                            }
                            <p><strong>Data Emissão:</strong> ${Formatter.date(bilhete.dataEmissao)}</p>
                            ${bilhete.cabine ? `<p><strong>Cabine:</strong> ${bilhete.cabine}</p>` : ''}
                            ${bilhete.bagagem ? `<p><strong>Bagagem:</strong> ${bilhete.bagagem}</p>` : ''}
                        </div>
                    </div>
                    <hr>
                    <div class="row">
                        <div class="col-md-4 text-center">
                            <p class="mb-1"><strong>Valor de Venda</strong></p>
                            <h5 class="text-primary">${bilhete.valorVenda ? Formatter.currency(bilhete.valorVenda) : '-'}</h5>
                        </div>
                        <div class="col-md-4 text-center">
                            <p class="mb-1"><strong>Valor de Compra</strong></p>
                            <h5 class="text-warning">${bilhete.valorCompra ? Formatter.currency(bilhete.valorCompra) : '-'}</h5>
                        </div>
                        <div class="col-md-4 text-center">
                            <p class="mb-1"><strong>Saldo da Venda</strong></p>
                            ${(() => {
                                const saldo = (bilhete.valorVenda || 0) - (bilhete.valorCompra || 0);
                                const corSaldo = saldo >= 0 ? 'text-success' : 'text-danger';
                                return `<h5 class="${corSaldo}">${Formatter.currency(saldo)}</h5>`;
                            })()}
                        </div>
                    </div>
                    ${bilhete.observacoes ? `<hr><p><strong>Observações:</strong> ${bilhete.observacoes}</p>` : ''}
                </div>
            </div>
        `;

        // Cria modal temporário
        const modalHtml = `
            <div class="modal fade" id="modalVerBilhete" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-body p-0">${html}</div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-info" onclick="TicketsModule.gerarPDFBilhete('${bilhete.id}')">
                                <i class="bi bi-file-pdf"></i> Gerar Bilhete PDF
                            </button>
                            <button type="button" class="btn btn-success" onclick="TicketsModule.gerarRecibo('${bilhete.id}')">
                                <i class="bi bi-receipt"></i> Gerar Recibo
                            </button>
                            <button type="button" class="btn btn-warning text-dark" onclick="TicketsModule.gerarInvoice('${bilhete.id}')">
                                <i class="bi bi-file-earmark-text"></i> Emitir Fatura
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove modal anterior se existir
        document.getElementById('modalVerBilhete')?.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = new bootstrap.Modal(document.getElementById('modalVerBilhete'));
        modal.show();
    },

    /**
     * Salva bilhete
     */
    async salvarBilhete() {
        const valorVenda = parseFloat(document.getElementById('bilheteValorVenda').value) || 0;
        const valorCompra = parseFloat(document.getElementById('bilheteValorCompra').value) || 0;

        const dados = {
            clienteId: document.getElementById('bilheteCliente').value || null,
            codigoReserva: document.getElementById('bilheteCodigoReserva').value.trim().toUpperCase(),
            companhia: document.getElementById('bilheteCompanhia').value,
            fornecedorId: document.getElementById('bilheteFornecedor').value || null,
            dataIda: document.getElementById('bilheteDataIda').value,
            dataVolta: document.getElementById('bilheteDataVolta').value || null,
            origem: document.getElementById('bilheteOrigem').value.trim().toUpperCase(),
            destino: document.getElementById('bilheteDestino').value.trim().toUpperCase(),
            valorVenda: valorVenda,
            valorCompra: valorCompra,
            dataEmissao: document.getElementById('bilheteDataEmissao').value,
            observacoes: document.getElementById('bilheteObservacoes').value.trim()
        };

        // Validações
        if (!dados.codigoReserva || !dados.companhia || !dados.dataIda || !dados.dataEmissao ||
            dados.valorVenda <= 0 || dados.valorCompra <= 0) {
            alert('Preencha todos os campos obrigatórios, incluindo valores de venda e compra');
            return;
        }

        const id = document.getElementById('bilheteId').value;
        const url = id ? `/api/bilhetes/${id}` : '/api/bilhetes';
        const method = id ? 'PUT' : 'POST';

        const resp = await apiCall(url, { method, body: JSON.stringify(dados) });
        if (!resp) return;

        const result = await resp.json();
        if (!result.success) {
            App.showToast(result.message || 'Erro ao salvar bilhete', 'error');
            return;
        }

        App.showToast(id ? 'Bilhete atualizado!' : 'Bilhete emitido!', 'success');

        const modal = bootstrap.Modal.getInstance(document.getElementById('modalBilhete'));
        modal.hide();

        // Invalidar caches para reload correto
        this._clientes = [];
        this._fornecedores = [];
        await this.carregarBilhetes();
    },

    /**
     * Exclui bilhete
     */
    async excluirBilhete(id) {
        const bilhete = this._bilhetes.find(b => b.id === id);
        if (!bilhete) return;

        if (!confirm(`Deseja realmente excluir o bilhete "${bilhete.codigoReserva}"?`)) return;

        const resp = await apiCall(`/api/bilhetes/${id}`, { method: 'DELETE' });
        if (!resp) return;

        const result = await resp.json();
        if (!result.success) {
            App.showToast(result.message || 'Erro ao excluir bilhete', 'error');
            return;
        }

        App.showToast('Bilhete excluído!', 'success');
        await this.carregarBilhetes();
    },

    /**
     * Exporta para Excel
     */
    exportarExcel() {
        const bilhetes = this.getBilhetesParaExportar();

        if (bilhetes.length === 0) {
            alert('Nenhum bilhete para exportar');
            return;
        }

        // Prepara dados para Excel
        const dados = bilhetes.map(b => {
            const cliente = b.cliente;
            const fornecedor = b.fornecedor;
            const companhia = getAirlineByCode(b.companhia);

            const saldo = (b.valorVenda || 0) - (b.valorCompra || 0);

            return {
                'Código Reserva': b.codigoReserva,
                'Cliente': cliente?.nome || 'N/A',
                'Email Cliente': cliente?.email || '',
                'Telefone Cliente': cliente?.telefone ? Formatter.phone(cliente.telefone) : '',
                'Companhia': companhia?.name || b.companhia,
                'Origem': b.origem || '',
                'Destino': b.destino || '',
                'Data Ida': Formatter.date(b.dataIda),
                'Data Volta': b.dataVolta ? Formatter.date(b.dataVolta) : 'Somente ida',
                'Fornecedor': fornecedor?.nome || 'N/A',
                'Telegram Fornecedor': fornecedor?.telegram ? `@${fornecedor.telegram}` : '',
                'Balcão': fornecedor?.balcao || '',
                'Valor Venda': b.valorVenda || 0,
                'Valor Compra': b.valorCompra || 0,
                'Saldo': saldo,
                'Data Emissão': Formatter.date(b.dataEmissao),
                'Observações': b.observacoes || ''
            };
        });

        // Cria workbook
        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Bilhetes');

        // Ajusta largura das colunas
        const colWidths = [
            { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
            { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
            { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
            { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 30 }
        ];
        ws['!cols'] = colWidths;

        // Calcula totais para adicionar no final
        let totalVendas = 0;
        let totalCompras = 0;
        bilhetes.forEach(b => {
            totalVendas += b.valorVenda || 0;
            totalCompras += b.valorCompra || 0;
        });

        // Adiciona linha de totais
        XLSX.utils.sheet_add_aoa(ws, [
            ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
            ['TOTAIS', '', '', '', '', '', '', '', '', '', '', '', totalVendas, totalCompras, totalVendas - totalCompras, '', '']
        ], { origin: -1 });

        // Salva arquivo
        const dataAtual = Formatter.date(new Date()).replace(/\//g, '-');
        XLSX.writeFile(wb, `Bilhetes_GiraMundoTour_${dataAtual}.xlsx`);
    },

    /**
     * Exporta para PDF
     */
    exportarPDF() {
        const bilhetes = this.getBilhetesParaExportar();

        if (bilhetes.length === 0) {
            alert('Nenhum bilhete para exportar');
            return;
        }

        const { jsPDF } = jspdf;
        const doc = new jsPDF('landscape');

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let y = margin;

        // Cabeçalho
        doc.setFillColor(102, 126, 234);
        doc.rect(0, 0, pageWidth, 25, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('RELATÓRIO DE BILHETES EMITIDOS', margin, 16);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Gerado em: ${Formatter.dateTime(new Date())}`, pageWidth - margin, 16, { align: 'right' });

        y = 35;

        // Cabeçalho da tabela
        const headers = ['Código', 'Cliente', 'Companhia', 'Origem', 'Destino', 'Ida', 'Volta', 'Fornecedor', 'Venda', 'Compra', 'Saldo', 'Emissão'];
        const colWidths = [22, 38, 28, 15, 15, 22, 22, 35, 22, 22, 22, 22];

        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y - 5, pageWidth - (margin * 2), 10, 'F');

        doc.setTextColor(60, 60, 60);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');

        let x = margin;
        headers.forEach((header, i) => {
            doc.text(header, x + 2, y);
            x += colWidths[i];
        });

        y += 10;

        // Dados
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);

        bilhetes.forEach(bilhete => {
            if (y > pageHeight - 20) {
                doc.addPage();
                y = margin;
            }

            const cliente = bilhete.cliente;
            const fornecedor = bilhete.fornecedor;
            const companhia = getAirlineByCode(bilhete.companhia);

            const saldo = (bilhete.valorVenda || 0) - (bilhete.valorCompra || 0);

            x = margin;
            const linha = [
                bilhete.codigoReserva,
                Formatter.truncate(cliente?.nome || 'N/A', 18),
                Formatter.truncate(companhia?.name || bilhete.companhia, 12),
                bilhete.origem || '-',
                bilhete.destino || '-',
                Formatter.date(bilhete.dataIda),
                bilhete.dataVolta ? Formatter.date(bilhete.dataVolta) : 'Só ida',
                Formatter.truncate(fornecedor?.nome || 'N/A', 18),
                bilhete.valorVenda ? Formatter.currency(bilhete.valorVenda) : '-',
                bilhete.valorCompra ? Formatter.currency(bilhete.valorCompra) : '-',
                Formatter.currency(saldo),
                Formatter.date(bilhete.dataEmissao)
            ];

            doc.setTextColor(60, 60, 60);
            linha.forEach((cell, i) => {
                doc.text(String(cell), x + 2, y);
                x += colWidths[i];
            });

            y += 6;
        });

        // Calcula totais financeiros
        let totalVendas = 0;
        let totalCompras = 0;
        bilhetes.forEach(b => {
            totalVendas += b.valorVenda || 0;
            totalCompras += b.valorCompra || 0;
        });
        const totalSaldo = totalVendas - totalCompras;

        // Rodapé
        y += 10;
        doc.setDrawColor(102, 126, 234);
        doc.line(margin, y, pageWidth - margin, y);

        y += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text(`Total de Bilhetes: ${bilhetes.length}`, margin, y);

        y += 6;
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.text(`Total Vendas: ${Formatter.currency(totalVendas)}`, margin, y);
        doc.text(`Total Compras: ${Formatter.currency(totalCompras)}`, margin + 80, y);

        const corSaldo = totalSaldo >= 0 ? [40, 167, 69] : [220, 53, 69];
        doc.setTextColor(...corSaldo);
        doc.text(`Lucro Total: ${Formatter.currency(totalSaldo)}`, margin + 160, y);

        // Salva
        const dataAtual = Formatter.date(new Date()).replace(/\//g, '-');
        doc.save(`Bilhetes_GiraMundoTour_${dataAtual}.pdf`);
    },

    /**
     * Obtém bilhetes do cache (já filtrados pela última chamada a carregarBilhetes)
     */
    getBilhetesParaExportar() {
        return [...this._bilhetes];
    }
};

// Exportar para uso global
window.TicketsModule = TicketsModule;
