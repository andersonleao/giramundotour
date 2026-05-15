// GiraMundoTour - Módulo de Hotéis

const HoteisModule = {
    _hoteis: [],
    _clientes: [],
    _editandoId: null,

    init() {
        debugLog('HoteisModule: Inicializado');
    },

    async render() {
        const container = document.getElementById('hoteisContent');
        if (!container) return;

        container.innerHTML = `
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="input-group">
                        <span class="input-group-text"><i class="bi bi-search"></i></span>
                        <input type="text" class="form-control" id="buscaHotel"
                               placeholder="Buscar por hotel, cidade, localizador ou cliente...">
                    </div>
                </div>
                <div class="col-md-6 text-end">
                    <div class="btn-group">
                        <button class="btn btn-success" onclick="HoteisModule.exportarExcel()">
                            <i class="bi bi-file-earmark-excel"></i> Excel
                        </button>
                        <button class="btn btn-primary" onclick="HoteisModule.abrirModal()">
                            <i class="bi bi-hotel"></i> Nova Reserva
                        </button>
                    </div>
                </div>
            </div>

            <!-- Filtros -->
            <div class="card mb-4">
                <div class="card-body py-3">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-3">
                            <label class="form-label small">Check-in — De</label>
                            <input type="date" class="form-control form-control-sm" id="filtroCheckinDe">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small">Check-in — Até</label>
                            <input type="date" class="form-control form-control-sm" id="filtroCheckinAte">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small">Status</label>
                            <select class="form-select form-select-sm" id="filtroStatusHotel">
                                <option value="">Todos</option>
                                <option value="confirmada">Confirmada</option>
                                <option value="pendente">Pendente</option>
                                <option value="cancelada">Cancelada</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <button class="btn btn-outline-primary btn-sm w-100"
                                    onclick="HoteisModule.aplicarFiltros()">
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
                        <div class="stat-icon"><i class="bi bi-hotel"></i></div>
                        <div class="stat-value" id="totalReservasHotel">0</div>
                        <div class="stat-label">Total de Reservas</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card primary">
                        <div class="stat-icon"><i class="bi bi-cash-stack"></i></div>
                        <div class="stat-value" id="totalValorHotel">R$ 0,00</div>
                        <div class="stat-label">Valor Total</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card success">
                        <div class="stat-icon"><i class="bi bi-check-circle"></i></div>
                        <div class="stat-value" id="totalConfirmadasHotel">0</div>
                        <div class="stat-label">Confirmadas</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card warning">
                        <div class="stat-icon"><i class="bi bi-clock-history"></i></div>
                        <div class="stat-value" id="totalPendentesHotel">0</div>
                        <div class="stat-label">Pendentes</div>
                    </div>
                </div>
            </div>

            <!-- Tabela -->
            <div class="card">
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0" id="tabelaHoteis">
                            <thead class="table-light">
                                <tr>
                                    <th>Hotel</th>
                                    <th>Cliente</th>
                                    <th>Check-in</th>
                                    <th>Check-out</th>
                                    <th>Diárias</th>
                                    <th>Quarto</th>
                                    <th>Regime</th>
                                    <th>Localizador</th>
                                    <th class="text-end">Valor Total</th>
                                    <th>Status</th>
                                    <th class="text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="listaHoteis">
                                <tr>
                                    <td colspan="11" class="text-center py-4">
                                        <div class="spinner-border spinner-border-sm text-primary"></div>
                                        Carregando...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('buscaHotel').addEventListener('input',
            () => this._renderLista(this._filtrarLista()));

        await this._carregarClientes();
        await this.loadList();
    },

    async loadList() {
        try {
            const resp = await apiCall('/api/hoteis');
            if (!resp) return;
            const result = await resp.json();
            if (result.success) {
                this._hoteis = result.data;
                this._renderLista(this._hoteis);
                this._atualizarResumo(this._hoteis);
            }
        } catch (e) {
            console.error('Erro ao carregar hotéis:', e);
        }
    },

    async _carregarClientes() {
        try {
            const resp = await apiCall('/api/clientes?limit=1000');
            if (!resp) return;
            const result = await resp.json();
            if (result.success) this._clientes = result.data;
        } catch (e) { /* silencioso */ }
    },

    _filtrarLista() {
        const busca = (document.getElementById('buscaHotel')?.value || '').toLowerCase();
        const statusFiltro = document.getElementById('filtroStatusHotel')?.value || '';
        const de = document.getElementById('filtroCheckinDe')?.value || '';
        const ate = document.getElementById('filtroCheckinAte')?.value || '';

        return this._hoteis.filter(h => {
            const matchBusca = !busca || [
                h.nomeHotel, h.cidade, h.localizador, h.clienteNome
            ].some(v => (v || '').toLowerCase().includes(busca));

            const matchStatus = !statusFiltro || h.status === statusFiltro;
            const matchDe = !de || h.checkin >= de;
            const matchAte = !ate || h.checkin <= ate;

            return matchBusca && matchStatus && matchDe && matchAte;
        });
    },

    aplicarFiltros() {
        this._renderLista(this._filtrarLista());
    },

    _renderLista(lista) {
        const tbody = document.getElementById('listaHoteis');
        if (!tbody) return;

        if (lista.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center py-4 text-muted">
                        <i class="bi bi-hotel fs-3 d-block mb-2"></i>
                        Nenhuma reserva de hotel encontrada
                    </td>
                </tr>`;
            return;
        }

        const statusClass = { confirmada: 'success', pendente: 'warning', cancelada: 'danger' };
        const statusLabel = { confirmada: 'Confirmada', pendente: 'Pendente', cancelada: 'Cancelada' };

        tbody.innerHTML = lista.map(h => {
            const diarias = h.numeroDiarias || this._calcDiarias(h.checkin, h.checkout);
            const sc = statusClass[h.status] || 'secondary';
            const sl = statusLabel[h.status] || h.status;
            return `
                <tr>
                    <td>
                        <strong>${this._esc(h.nomeHotel)}</strong>
                        ${h.cidade ? `<div class="text-muted small"><i class="bi bi-geo-alt"></i> ${this._esc(h.cidade)}${h.pais ? ', ' + this._esc(h.pais) : ''}</div>` : ''}
                    </td>
                    <td>${h.clienteNome ? `<i class="bi bi-person me-1"></i>${this._esc(h.clienteNome)}` : '<span class="text-muted">—</span>'}</td>
                    <td>${this._fmtData(h.checkin)}</td>
                    <td>${this._fmtData(h.checkout)}</td>
                    <td class="text-center">${diarias}</td>
                    <td>${this._esc(this._labelQuarto(h.tipoQuarto))}</td>
                    <td>${this._esc(h.regimeAlimentar || '—')}</td>
                    <td><code>${this._esc(h.localizador || '—')}</code></td>
                    <td class="text-end fw-bold">${this._fmtMoeda(h.valorTotal)}</td>
                    <td><span class="badge bg-${sc}">${sl}</span></td>
                    <td class="text-center">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" title="Emitir Recibo"
                                    onclick="HoteisModule.emitirRecibo('${h.id}')">
                                <i class="bi bi-file-earmark-pdf"></i>
                            </button>
                            <button class="btn btn-outline-secondary" title="Editar"
                                    onclick="HoteisModule.abrirModal('${h.id}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger" title="Excluir"
                                    onclick="HoteisModule.excluir('${h.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this._atualizarResumo(lista);
    },

    _atualizarResumo(lista) {
        const total = lista.length;
        const confirmadas = lista.filter(h => h.status === 'confirmada').length;
        const pendentes = lista.filter(h => h.status === 'pendente').length;
        const valor = lista.reduce((s, h) => s + parseFloat(h.valorTotal || 0), 0);

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('totalReservasHotel', total);
        set('totalConfirmadasHotel', confirmadas);
        set('totalPendentesHotel', pendentes);
        set('totalValorHotel', this._fmtMoeda(valor));
    },

    // ──────────────────────────────────────────────────────────
    // Modal cadastro / edição
    // ──────────────────────────────────────────────────────────

    async abrirModal(id = null) {
        this._editandoId = id;
        let hotel = null;

        if (id) {
            try {
                const resp = await apiCall(`/api/hoteis/${id}`);
                if (!resp) return;
                const result = await resp.json();
                if (result.success) hotel = result.data;
            } catch (e) { App.showToast('Erro ao carregar reserva', 'error'); return; }
        }

        // Monta opções de clientes
        const clienteOptions = this._clientes.map(c =>
            `<option value="${c.id}" ${hotel && hotel.clienteId === c.id ? 'selected' : ''}>${this._esc(c.nome)}</option>`
        ).join('');

        const titulo = id ? 'Editar Reserva de Hotel' : 'Nova Reserva de Hotel';
        const h = hotel || {};

        const modalHtml = `
        <div class="modal fade" id="modalHotel" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header" style="background:#1a365d; color:#fff;">
                        <h5 class="modal-title"><i class="bi bi-hotel me-2"></i>${titulo}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="formHotel" novalidate>

                            <!-- Cliente -->
                            <div class="mb-3">
                                <label class="form-label fw-bold">Cliente</label>
                                <select class="form-select" id="hotelClienteId">
                                    <option value="">— Selecione o cliente (opcional) —</option>
                                    ${clienteOptions}
                                </select>
                            </div>

                            <hr>

                            <!-- Hotel info -->
                            <div class="row g-3">
                                <div class="col-md-8">
                                    <label class="form-label fw-bold">Nome do Hotel <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="hotelNome"
                                           value="${this._esc(h.nomeHotel || '')}" required
                                           placeholder="Ex: Ibis Styles Recife">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label fw-bold">Localizador</label>
                                    <input type="text" class="form-control" id="hotelLocalizador"
                                           value="${this._esc(h.localizador || '')}"
                                           placeholder="Ex: BK12345">
                                </div>
                                <div class="col-md-5">
                                    <label class="form-label fw-bold">Cidade</label>
                                    <input type="text" class="form-control" id="hotelCidade"
                                           value="${this._esc(h.cidade || '')}"
                                           placeholder="Ex: Recife">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label fw-bold">País</label>
                                    <input type="text" class="form-control" id="hotelPais"
                                           value="${this._esc(h.pais || 'Brasil')}"
                                           placeholder="Ex: Brasil">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label fw-bold">Status</label>
                                    <select class="form-select" id="hotelStatus">
                                        <option value="confirmada" ${(!h.status || h.status === 'confirmada') ? 'selected' : ''}>Confirmada</option>
                                        <option value="pendente" ${h.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                                        <option value="cancelada" ${h.status === 'cancelada' ? 'selected' : ''}>Cancelada</option>
                                    </select>
                                </div>
                                <div class="col-12">
                                    <label class="form-label fw-bold">Endereço do Hotel</label>
                                    <input type="text" class="form-control" id="hotelEndereco"
                                           value="${this._esc(h.enderecoHotel || '')}"
                                           placeholder="Rua, número, bairro...">
                                </div>
                            </div>

                            <hr>

                            <!-- Datas -->
                            <div class="row g-3">
                                <div class="col-md-3">
                                    <label class="form-label fw-bold">Check-in <span class="text-danger">*</span></label>
                                    <input type="date" class="form-control" id="hotelCheckin"
                                           value="${h.checkin ? h.checkin.substring(0, 10) : ''}" required>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label fw-bold">Check-out <span class="text-danger">*</span></label>
                                    <input type="date" class="form-control" id="hotelCheckout"
                                           value="${h.checkout ? h.checkout.substring(0, 10) : ''}" required>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label fw-bold">Nº Quartos</label>
                                    <input type="number" class="form-control" id="hotelNumeroQuartos"
                                           value="${h.numeroQuartos || 1}" min="1">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label fw-bold">Nº Pessoas</label>
                                    <input type="number" class="form-control" id="hotelNumeroPessoas"
                                           value="${h.numeroPessoas || 1}" min="1">
                                </div>
                            </div>

                            <!-- Tipo / Regime -->
                            <div class="row g-3 mt-0">
                                <div class="col-md-4">
                                    <label class="form-label fw-bold">Tipo de Quarto</label>
                                    <select class="form-select" id="hotelTipoQuarto">
                                        <option value="standard" ${(!h.tipoQuarto || h.tipoQuarto === 'standard') ? 'selected' : ''}>Standard</option>
                                        <option value="superior" ${h.tipoQuarto === 'superior' ? 'selected' : ''}>Superior</option>
                                        <option value="deluxe" ${h.tipoQuarto === 'deluxe' ? 'selected' : ''}>Deluxe</option>
                                        <option value="suite" ${h.tipoQuarto === 'suite' ? 'selected' : ''}>Suíte</option>
                                        <option value="suite júnior" ${h.tipoQuarto === 'suite júnior' ? 'selected' : ''}>Suíte Júnior</option>
                                        <option value="suite presidencial" ${h.tipoQuarto === 'suite presidencial' ? 'selected' : ''}>Suíte Presidencial</option>
                                        <option value="triplo" ${h.tipoQuarto === 'triplo' ? 'selected' : ''}>Triplo</option>
                                        <option value="quádruplo" ${h.tipoQuarto === 'quádruplo' ? 'selected' : ''}>Quádruplo</option>
                                    </select>
                                </div>
                                <div class="col-md-5">
                                    <label class="form-label fw-bold">Regime Alimentar</label>
                                    <select class="form-select" id="hotelRegime">
                                        <option value="sem refeição" ${h.regimeAlimentar === 'sem refeição' ? 'selected' : ''}>Sem Refeição</option>
                                        <option value="café da manhã" ${(!h.regimeAlimentar || h.regimeAlimentar === 'café da manhã') ? 'selected' : ''}>Café da Manhã</option>
                                        <option value="meia pensão" ${h.regimeAlimentar === 'meia pensão' ? 'selected' : ''}>Meia Pensão</option>
                                        <option value="pensão completa" ${h.regimeAlimentar === 'pensão completa' ? 'selected' : ''}>Pensão Completa</option>
                                        <option value="all inclusive" ${h.regimeAlimentar === 'all inclusive' ? 'selected' : ''}>All Inclusive</option>
                                    </select>
                                </div>
                            </div>

                            <hr>

                            <!-- Valores -->
                            <div class="row g-3">
                                <div class="col-md-4">
                                    <label class="form-label fw-bold">Valor da Diária (R$)</label>
                                    <input type="number" class="form-control" id="hotelValorDiaria"
                                           value="${h.valorDiaria || ''}" min="0" step="0.01"
                                           placeholder="0,00"
                                           oninput="HoteisModule._calcularTotal()">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label fw-bold">Diárias</label>
                                    <input type="number" class="form-control" id="hotelDiariasCalc"
                                           value="${h.numeroDiarias || this._calcDiarias(h.checkin, h.checkout) || ''}"
                                           readonly style="background:#f8f9fa">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label fw-bold">Valor Total (R$)</label>
                                    <input type="number" class="form-control fw-bold" id="hotelValorTotal"
                                           value="${h.valorTotal || ''}" min="0" step="0.01"
                                           placeholder="0,00">
                                </div>
                            </div>

                            <!-- Observações -->
                            <div class="mt-3">
                                <label class="form-label fw-bold">Observações</label>
                                <textarea class="form-control" id="hotelObservacoes" rows="2"
                                          placeholder="Informações adicionais sobre a reserva...">${this._esc(h.observacoes || '')}</textarea>
                            </div>

                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="HoteisModule.salvar()">
                            <i class="bi bi-save me-1"></i> Salvar
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

        // Remove modal antigo se existir
        const old = document.getElementById('modalHotel');
        if (old) old.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = new bootstrap.Modal(document.getElementById('modalHotel'));
        modal.show();

        // Recalcular total ao mudar datas
        ['hotelCheckin', 'hotelCheckout', 'hotelNumeroQuartos'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this._calcularTotal());
        });
    },

    _calcularTotal() {
        const checkin = document.getElementById('hotelCheckin')?.value;
        const checkout = document.getElementById('hotelCheckout')?.value;
        const diaria = parseFloat(document.getElementById('hotelValorDiaria')?.value) || 0;
        const quartos = parseInt(document.getElementById('hotelNumeroQuartos')?.value) || 1;

        if (checkin && checkout) {
            const d = this._calcDiarias(checkin, checkout);
            const diariasEl = document.getElementById('hotelDiariasCalc');
            if (diariasEl) diariasEl.value = d > 0 ? d : '';

            if (diaria > 0 && d > 0) {
                const totalEl = document.getElementById('hotelValorTotal');
                if (totalEl) totalEl.value = (diaria * d * quartos).toFixed(2);
            }
        }
    },

    async salvar() {
        const nomeHotel = document.getElementById('hotelNome')?.value?.trim();
        const checkin = document.getElementById('hotelCheckin')?.value;
        const checkout = document.getElementById('hotelCheckout')?.value;

        if (!nomeHotel) { App.showToast('Informe o nome do hotel', 'warning'); return; }
        if (!checkin)   { App.showToast('Informe a data de check-in', 'warning'); return; }
        if (!checkout)  { App.showToast('Informe a data de check-out', 'warning'); return; }
        if (checkout <= checkin) { App.showToast('Check-out deve ser após o check-in', 'warning'); return; }

        const dados = {
            clienteId:      document.getElementById('hotelClienteId')?.value || null,
            nomeHotel,
            cidade:         document.getElementById('hotelCidade')?.value?.trim() || null,
            pais:           document.getElementById('hotelPais')?.value?.trim() || null,
            enderecoHotel:  document.getElementById('hotelEndereco')?.value?.trim() || null,
            checkin,
            checkout,
            tipoQuarto:     document.getElementById('hotelTipoQuarto')?.value,
            regimeAlimentar: document.getElementById('hotelRegime')?.value,
            numeroQuartos:  parseInt(document.getElementById('hotelNumeroQuartos')?.value) || 1,
            numeroPessoas:  parseInt(document.getElementById('hotelNumeroPessoas')?.value) || 1,
            valorDiaria:    parseFloat(document.getElementById('hotelValorDiaria')?.value) || 0,
            valorTotal:     parseFloat(document.getElementById('hotelValorTotal')?.value) || 0,
            localizador:    document.getElementById('hotelLocalizador')?.value?.trim() || null,
            status:         document.getElementById('hotelStatus')?.value,
            observacoes:    document.getElementById('hotelObservacoes')?.value?.trim() || null,
        };

        try {
            let raw;
            if (this._editandoId) {
                raw = await apiCall(`/api/hoteis/${this._editandoId}`, { method: 'PUT', body: JSON.stringify(dados) });
            } else {
                raw = await apiCall('/api/hoteis', { method: 'POST', body: JSON.stringify(dados) });
            }

            if (!raw) return;
            const resp = await raw.json();

            if (resp.success) {
                App.showToast(this._editandoId ? 'Reserva atualizada!' : 'Reserva criada!', 'success');
                bootstrap.Modal.getInstance(document.getElementById('modalHotel'))?.hide();
                await this.loadList();
            } else {
                App.showToast(resp.message || 'Erro ao salvar', 'error');
            }
        } catch (e) {
            App.showToast('Erro ao salvar reserva', 'error');
        }
    },

    async excluir(id) {
        const hotel = this._hoteis.find(h => h.id === id);
        if (!confirm(`Excluir reserva do hotel "${hotel?.nomeHotel || id}"?`)) return;

        try {
            const raw = await apiCall(`/api/hoteis/${id}`, { method: 'DELETE' });
            if (!raw) return;
            const resp = await raw.json();
            if (resp.success) {
                App.showToast('Reserva excluída', 'success');
                await this.loadList();
            } else {
                App.showToast(resp.message || 'Erro ao excluir', 'error');
            }
        } catch (e) {
            App.showToast('Erro ao excluir reserva', 'error');
        }
    },

    // ──────────────────────────────────────────────────────────
    // Modal de pré-visualização antes de emitir o recibo
    // ──────────────────────────────────────────────────────────

    async emitirRecibo(id) {
        let hotel = this._hoteis.find(h => h.id === id);

        if (!hotel) {
            try {
                const raw = await apiCall(`/api/hoteis/${id}`);
                if (raw) { const r = await raw.json(); if (r.success) hotel = r.data; }
            } catch (e) { /* ignore */ }
        }

        if (!hotel) { App.showToast('Reserva não encontrada', 'error'); return; }

        const old = document.getElementById('modalReciboHotel');
        if (old) old.remove();

        const diarias = hotel.numeroDiarias || this._calcDiarias(hotel.checkin, hotel.checkout);

        const modalHtml = `
        <div class="modal fade" id="modalReciboHotel" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header" style="background:#1a365d; color:#fff;">
                        <h5 class="modal-title">
                            <i class="bi bi-file-earmark-pdf me-2"></i>
                            Emitir Recibo — ${this._esc(hotel.nomeHotel)}
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">

                        <!-- Resumo da reserva (somente leitura) -->
                        <div class="alert alert-info d-flex align-items-start gap-3 mb-4">
                            <i class="bi bi-info-circle-fill fs-4 mt-1"></i>
                            <div>
                                <strong>${this._esc(hotel.nomeHotel)}</strong>
                                ${hotel.cidade ? ` — ${this._esc(hotel.cidade)}` : ''}
                                <br>
                                Check-in: <strong>${this._fmtData(hotel.checkin)}</strong>
                                &nbsp;→&nbsp;
                                Check-out: <strong>${this._fmtData(hotel.checkout)}</strong>
                                &nbsp;(${diarias} diária${diarias !== 1 ? 's' : ''})
                                ${hotel.clienteNome ? `<br>Cliente: <strong>${this._esc(hotel.clienteNome)}</strong>` : ''}
                            </div>
                        </div>

                        <!-- Logo do hotel -->
                        <div class="mb-4">
                            <label class="form-label fw-bold">
                                <i class="bi bi-image me-1"></i>
                                Logo do Hotel
                                <span class="text-muted fw-normal small ms-1">(opcional — aparecerá no recibo)</span>
                            </label>
                            <div class="row g-3 align-items-center">
                                <div class="col-md-7">
                                    <input type="file" class="form-control" id="reciboLogoFile"
                                           accept="image/png,image/jpeg,image/jpg,image/webp"
                                           onchange="HoteisModule._onLogoChange(event)">
                                    <div class="form-text">PNG, JPG ou WEBP — máx. 2 MB</div>
                                </div>
                                <div class="col-md-5 text-center">
                                    <div id="reciboLogoPreview" class="border rounded p-2"
                                         style="min-height:70px; display:flex; align-items:center; justify-content:center; background:#f8f9fa;">
                                        ${hotel.logoHotel
                                            ? `<img src="${hotel.logoHotel}" style="max-height:60px; max-width:100%;" alt="Logo">`
                                            : '<span class="text-muted small"><i class="bi bi-image fs-3 d-block mb-1"></i>Prévia da logo</span>'}
                                    </div>
                                </div>
                            </div>
                            <!-- Logo salva anteriormente -->
                            <input type="hidden" id="reciboLogoBase64" value="${hotel.logoHotel ? this._esc(hotel.logoHotel) : ''}">
                        </div>

                        <!-- Dados adicionais do hotel -->
                        <div class="mb-4">
                            <label class="form-label fw-bold">
                                <i class="bi bi-card-text me-1"></i>
                                Dados Adicionais do Hotel
                                <span class="text-muted fw-normal small ms-1">(aparecerão no recibo)</span>
                            </label>
                            <textarea class="form-control" id="reciboDadosAdicionais" rows="5"
                                      placeholder="Ex: Número do quarto: 312&#10;Café da manhã: 7h às 10h&#10;Wi-Fi: incluído&#10;Estacionamento: gratuito&#10;Piscina: 8h às 22h"
                                      >${this._esc(hotel.dadosAdicionais || '')}</textarea>
                        </div>

                        <!-- Valor do recibo -->
                        <div class="mb-3">
                            <label class="form-label fw-bold">
                                <i class="bi bi-cash me-1"></i>
                                Valor do Recibo (R$)
                            </label>
                            <div class="row g-2 align-items-center">
                                <div class="col-md-4">
                                    <input type="number" class="form-control form-control-lg fw-bold"
                                           id="reciboValor"
                                           value="${parseFloat(hotel.valorTotal) || 0}"
                                           min="0" step="0.01"
                                           style="font-size:1.4rem; color:#1a365d;">
                                </div>
                                <div class="col-md-8 text-muted small">
                                    Valor original cadastrado: <strong>${this._fmtMoeda(hotel.valorTotal)}</strong>.
                                    Você pode ajustar o valor que aparecerá no recibo.
                                </div>
                            </div>
                        </div>

                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary btn-lg"
                                onclick="HoteisModule._confirmarEmissaoRecibo('${hotel.id}')">
                            <i class="bi bi-file-earmark-pdf me-1"></i> Gerar Recibo PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        new bootstrap.Modal(document.getElementById('modalReciboHotel')).show();
    },

    _onLogoChange(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            App.showToast('Imagem muito grande. Máximo 2 MB.', 'warning');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            document.getElementById('reciboLogoBase64').value = base64;
            document.getElementById('reciboLogoPreview').innerHTML =
                `<img src="${base64}" style="max-height:60px; max-width:100%;" alt="Logo">`;
        };
        reader.readAsDataURL(file);
    },

    async _confirmarEmissaoRecibo(id) {
        // Sempre busca dados frescos do servidor para garantir que observacoes e outros campos estejam atualizados
        let hotel = null;
        try {
            const raw = await apiCall(`/api/hoteis/${id}`);
            if (raw) { const r = await raw.json(); if (r.success) hotel = r.data; }
        } catch (e) { /* ignore */ }
        if (!hotel) hotel = this._hoteis.find(h => h.id === id);
        if (!hotel) { App.showToast('Reserva não encontrada', 'error'); return; }

        const logoBase64      = document.getElementById('reciboLogoBase64')?.value || '';
        const dadosAdicionais = document.getElementById('reciboDadosAdicionais')?.value?.trim() || '';
        const valorRecibo     = parseFloat(document.getElementById('reciboValor')?.value) || 0;

        // Salvar logo e dados adicionais no banco (em background)
        if (logoBase64 !== (hotel.logoHotel || '') || dadosAdicionais !== (hotel.dadosAdicionais || '')) {
            apiCall(`/api/hoteis/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ logoHotel: logoBase64 || null, dadosAdicionais: dadosAdicionais || null })
            }).catch(() => {});
        }

        // Fechar modal
        bootstrap.Modal.getInstance(document.getElementById('modalReciboHotel'))?.hide();

        // Gerar PDF com os dados do modal
        const hotelComDados = { ...hotel, logoHotel: logoBase64, dadosAdicionais, valorTotal: valorRecibo };
        await this._gerarReciboPDF(hotelComDados);
    },

    // ──────────────────────────────────────────────────────────
    // PDF — Recibo de Reserva de Hotel
    // ──────────────────────────────────────────────────────────

    async _gerarReciboPDF(hotel) {
        if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
            alert('Biblioteca jsPDF não carregada. Verifique a conexão com a internet.');
            return;
        }

        App.showToast('Gerando recibo...', 'info');

        const logoBase64 = await ReportModule.carregarLogo();
        const { jsPDF } = jspdf;
        const doc = new jsPDF();

        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin     = 20;
        const cw         = pageWidth - margin * 2;

        const corAzul    = [26, 54, 93];
        const corAzulCl  = [66, 153, 225];
        const corCinza   = [100, 100, 100];
        const corPreto   = [30, 30, 30];

        // ── CABEÇALHO (igual ao padrão do report.js) ──
        doc.setFillColor(...corAzul);
        doc.rect(0, 0, pageWidth, 45, 'F');

        if (logoBase64) {
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(margin + 1, 6, 33, 33, 4, 4, 'F');
            doc.addImage(logoBase64, 'PNG', margin + 2, 7, 31, 31);
        }

        const txtX = logoBase64 ? margin + 40 : margin;
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('GiraMundoTour', txtX, 25);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(CONFIG.empresa.slogan, txtX, 33);

        const cx = pageWidth - margin;
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(CONFIG.empresa.email, cx, 12, { align: 'right' });
        doc.text(CONFIG.empresa.telefone, cx, 18, { align: 'right' });
        doc.text(CONFIG.empresa.telefone2, cx, 24, { align: 'right' });
        doc.text(CONFIG.empresa.instagram, cx, 30, { align: 'right' });

        let y = 55;

        // ── TÍTULO ──
        doc.setTextColor(...corAzul);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        const isConfirmada = (hotel.status || '').toLowerCase() === 'confirmada';
        const tituloPDF = isConfirmada
            ? 'RESERVA DE HOTEL'
            : 'COTA\u00C7\u00C3O DE RESERVA DE HOTEL';
        doc.text(tituloPDF, margin, y);
        y += 7;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...corCinza);
        const dataEmissao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        doc.text(`Emitido em: ${dataEmissao}`, margin, y);
        if (hotel.localizador) {
            doc.text(`Localizador: ${hotel.localizador}`, cx, y, { align: 'right' });
        }
        y += 12;

        // ── DADOS DO CLIENTE ──
        if (hotel.clienteNome) {
            const temCnpj = !!hotel.clienteCnpj;
            const alturaBox = temCnpj ? 36 : 28;

            doc.setFillColor(240, 247, 255);
            doc.rect(margin, y - 4, cw, alturaBox, 'F');
            doc.setDrawColor(...corAzulCl);
            doc.rect(margin, y - 4, cw, alturaBox, 'S');

            doc.setTextColor(...corAzul);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('DADOS DO CLIENTE', margin + 4, y + 2);
            y += 8;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...corPreto);
            doc.text(`Nome: ${hotel.clienteNome}`, margin + 4, y);
            if (hotel.clienteTelefone) {
                doc.text(`Telefone: ${hotel.clienteTelefone}`, pageWidth / 2, y);
            }
            y += 6;
            if (hotel.clienteEmail) {
                doc.text(`E-mail: ${hotel.clienteEmail}`, margin + 4, y);
            }
            if (hotel.clienteCpf) {
                const cpfFmt = hotel.clienteCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                doc.text(`CPF: ${cpfFmt}`, pageWidth / 2, y);
            }
            y += 6;
            if (temCnpj) {
                const cnpjFmt = hotel.clienteCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
                doc.text(`CNPJ: ${cnpjFmt}`, margin + 4, y);
                y += 10;
            } else {
                y += 10;
            }
        }

        // ── DADOS DO HOTEL ──
        doc.setFillColor(...corAzul);
        doc.rect(margin, y, cw, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('DADOS DO HOTEL', margin + 4, y + 7);
        y += 14;

        // Logo do hotel (se fornecida) à direita, nome e endereço à esquerda
        let logoHotelW = 0;
        if (hotel.logoHotel) {
            try {
                const imgW = 40;
                const imgH = 20;
                logoHotelW = imgW + 4;
                doc.setFillColor(248, 249, 250);
                doc.roundedRect(pageWidth - margin - imgW - 2, y - 2, imgW + 4, imgH + 4, 2, 2, 'F');
                doc.addImage(hotel.logoHotel, 'PNG', pageWidth - margin - imgW, y, imgW, imgH);
            } catch (e) { logoHotelW = 0; }
        } else {
            // Ícone hotel (letra H) como fallback
            doc.setFontSize(22);
            doc.setTextColor(...corAzulCl);
            doc.text('H', margin + 2, y + 8);
        }

        const nomeX = hotel.logoHotel ? margin + 4 : margin + 12;
        doc.setTextColor(...corPreto);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(hotel.nomeHotel, nomeX, y + 4, { maxWidth: cw - logoHotelW - 10 });
        y += 6;

        const localParts = [hotel.cidade, hotel.pais].filter(Boolean);
        if (localParts.length > 0 || hotel.enderecoHotel) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...corCinza);
            if (hotel.enderecoHotel) {
                doc.text(hotel.enderecoHotel, nomeX, y + 6);
                y += 5;
            }
            if (localParts.length > 0) {
                doc.text(localParts.join(', '), nomeX, y + 6);
            }
        }
        y += 16;

        // ── LINHA DIVISÓRIA ──
        doc.setDrawColor(...corAzulCl);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        // ── DETALHES DA ESTADIA ──
        doc.setFillColor(248, 249, 250);
        doc.rect(margin, y - 4, cw, 48, 'F');

        const diarias = hotel.numeroDiarias || this._calcDiarias(hotel.checkin, hotel.checkout);
        const col1 = margin + 4;
        const col2 = pageWidth / 2;
        const rowH  = 10;

        const campo = (label, valor, x, yy) => {
            doc.setTextColor(...corCinza);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(label.toUpperCase(), x, yy);
            doc.setTextColor(...corPreto);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(String(valor), x, yy + 5.5);
        };

        campo('Check-in',        this._fmtDataExtenso(hotel.checkin),   col1, y);
        campo('Check-out',       this._fmtDataExtenso(hotel.checkout),  col2, y);
        y += rowH + 4;
        campo('Nº de Diárias',   `${diarias} diária${diarias !== 1 ? 's' : ''}`, col1, y);
        campo('Tipo de Quarto',  this._labelQuarto(hotel.tipoQuarto),   col2, y);
        y += rowH + 4;
        campo('Regime Alimentar', hotel.regimeAlimentar || '—',         col1, y);
        campo('Nº Quartos',      `${hotel.numeroQuartos || 1} quarto${(hotel.numeroQuartos || 1) !== 1 ? 's' : ''}`, col2, y);
        y += rowH + 4;
        campo('Nº de Hóspedes',  `${hotel.numeroPessoas || 1} pessoa${(hotel.numeroPessoas || 1) !== 1 ? 's' : ''}`, col1, y);
        if (hotel.localizador) {
            campo('Localizador', hotel.localizador, col2, y);
        }
        y += rowH + 12;

                // ── RESUMO FINANCEIRO ──
        doc.setFillColor(...corAzul);
        doc.rect(margin, y, cw, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMO FINANCEIRO', margin + 4, y + 7);
        y += 16;

        const linhaFin = (label, valor, bold = false) => {
            doc.setFontSize(10);
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
            doc.setTextColor(bold ? corAzul[0] : corPreto[0], bold ? corAzul[1] : corPreto[1], bold ? corAzul[2] : corPreto[2]);
            doc.text(label, margin + 4, y);
            doc.setTextColor(...(bold ? corAzul : corPreto));
            doc.text(this._fmtMoeda(valor), cx, y, { align: 'right' });
            if (bold) {
                doc.setDrawColor(...corAzulCl);
                doc.setLineWidth(0.3);
                doc.line(margin, y - 6, pageWidth - margin, y - 6);
            }
            y += 7;
        };

        const vDiaria  = parseFloat(hotel.valorDiaria) || 0;
        const vTotal   = parseFloat(hotel.valorTotal)  || 0;
        const nPessoas = parseInt(hotel.numeroPessoas) || 1;
        const vUmaDiaria = vDiaria * nPessoas; // valor de 1 diária para todos os hóspedes

        if (vDiaria > 0) {
            // Linha 1: Diária (X hóspedes) = qtd_hospedes × valor_diaria
            linhaFin(`Diária (${nPessoas} hóspede${nPessoas !== 1 ? 's' : ''})`, vUmaDiaria);
        }
        y += 4;
        // Linha 2: Total (X diárias) = valor_1_diaria × qtd_diarias
        linhaFin(`TOTAL (${diarias} diária${diarias !== 1 ? 's' : ''})`, vUmaDiaria * diarias || vTotal, true);
        y += 8;

        // ── OBSERVAÇÕES ──
        if (hotel.observacoes?.trim() && isConfirmada) {
            const _linhas = doc.splitTextToSize(hotel.observacoes.trim(), cw - 8);
            const _altObs = 10 + _linhas.length * 5.5;
            // Nova página se obs não cabe na página atual
            if (y + _altObs > pageHeight - 25) {
                doc.addPage();
                doc.setFillColor(...corAzul);
                doc.rect(0, 0, pageWidth, 10, 'F');
                y = 18;
            }
            doc.setFillColor(255, 248, 220);
            doc.setDrawColor(255, 193, 7);
            doc.setLineWidth(0.3);
            doc.rect(margin, y, cw, _altObs, 'FD');
            doc.setTextColor(120, 80, 0);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('OBSERVAÇÕES:', margin + 4, y + 6);
            doc.setFont('helvetica', 'normal');
            doc.text(_linhas, margin + 4, y + 12);
            y += _altObs + 6;
        }

        const limiteY = pageHeight - 25;

        const novaPageSeNecessario = () => {
            doc.addPage();
            doc.setFillColor(...corAzul);
            doc.rect(0, 0, pageWidth, 10, 'F');
            y = 18;
        };

        // ── DADOS ADICIONAIS DO HOTEL ──
        if (hotel.dadosAdicionais && hotel.dadosAdicionais.trim()) {
            const linhasDA = doc.splitTextToSize(hotel.dadosAdicionais.trim(), cw - 8);
            const alturaCaixaDA = 10 + linhasDA.length * 5.5;
            if (y + alturaCaixaDA > limiteY) novaPageSeNecessario();

            doc.setFillColor(240, 247, 255);
            doc.setDrawColor(...corAzulCl);
            doc.setLineWidth(0.3);
            doc.rect(margin, y, cw, alturaCaixaDA, 'FD');
            doc.setTextColor(...corAzul);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('INFORMAÇÕES ADICIONAIS:', margin + 4, y + 6);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...corPreto);
            doc.text(linhasDA, margin + 4, y + 12);
            y += alturaCaixaDA + 6;
        }


        // ── STATUS (após dados adicionais) ──
        {
            const _sc  = { confirmada: [40,167,69], pendente: [255,193,7], cancelada: [220,53,69] };
            const _cor = _sc[hotel.status] || [100,100,100];
            const _sl  = { confirmada: 'CONFIRMADA', pendente: 'PENDENTE', cancelada: 'CANCELADA' };
            if (y + 20 > pageHeight - 25) {
                doc.addPage();
                doc.setFillColor(...corAzul);
                doc.rect(0, 0, pageWidth, 10, 'F');
                y = 18;
            }
            doc.setFillColor(..._cor);
            doc.roundedRect(margin, y, 60, 12, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(_sl[hotel.status] || hotel.status.toUpperCase(), margin + 30, y + 8.5, { align: 'center' });
            y += 20;
        }
        // ── RODAPÉ EM TODAS AS PÁGINAS ──
        const totalPags = doc.getNumberOfPages();
        for (let pg = 1; pg <= totalPags; pg++) {
            doc.setPage(pg);
            doc.setFillColor(...corAzul);
            doc.rect(0, pageHeight - 18, pageWidth, 18, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`${CONFIG.empresa.nome} — ${CONFIG.empresa.email} — ${CONFIG.empresa.telefone}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            doc.setFontSize(7);
            doc.setTextColor(200, 220, 255);
            doc.text('Documento emitido eletronicamente pelo sistema GiraMundoTour', pageWidth / 2, pageHeight - 5, { align: 'center' });
        }

        // ── SALVAR ──
        const nomeArq = `recibo-hotel-${(hotel.nomeHotel || 'hotel').replace(/\s+/g, '-').toLowerCase()}-${(hotel.checkin || '').substring(0, 10)}.pdf`;
        doc.save(nomeArq);
        App.showToast('Recibo gerado com sucesso!', 'success');
    },

    // ──────────────────────────────────────────────────────────
    // Exportar Excel
    // ──────────────────────────────────────────────────────────

    exportarExcel() {
        if (typeof XLSX === 'undefined') {
            App.showToast('Biblioteca XLSX não carregada', 'error');
            return;
        }

        const lista = this._filtrarLista();
        const dados = lista.map(h => ({
            'Hotel':            h.nomeHotel,
            'Cliente':          h.clienteNome || '',
            'Cidade':           h.cidade || '',
            'País':             h.pais || '',
            'Check-in':         this._fmtData(h.checkin),
            'Check-out':        this._fmtData(h.checkout),
            'Diárias':          h.numeroDiarias || this._calcDiarias(h.checkin, h.checkout),
            'Tipo Quarto':      this._labelQuarto(h.tipoQuarto),
            'Regime':           h.regimeAlimentar || '',
            'Nº Quartos':       h.numeroQuartos || 1,
            'Nº Pessoas':       h.numeroPessoas || 1,
            'Valor Diária':     parseFloat(h.valorDiaria) || 0,
            'Valor Total':      parseFloat(h.valorTotal) || 0,
            'Localizador':      h.localizador || '',
            'Status':           h.status || '',
            'Observações':      h.observacoes || '',
        }));

        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Hotéis');
        XLSX.writeFile(wb, `hoteis-${new Date().toISOString().substring(0, 10)}.xlsx`);
    },

    // ──────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────

    _esc(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    _fmtMoeda(v) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(v) || 0);
    },

    _fmtData(d) {
        if (!d) return '—';
        const s = String(d).substring(0, 10);
        const [y, m, day] = s.split('-');
        return `${day}/${m}/${y}`;
    },

    _fmtDataExtenso(d) {
        if (!d) return '—';
        const s = String(d).substring(0, 10);
        const dt = new Date(s + 'T12:00:00');
        return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    },

    _calcDiarias(checkin, checkout) {
        if (!checkin || !checkout) return 0;
        const a = new Date(String(checkin).substring(0, 10) + 'T12:00:00');
        const b = new Date(String(checkout).substring(0, 10) + 'T12:00:00');
        const diff = Math.round((b - a) / 86400000);
        return diff > 0 ? diff : 0;
    },

    _labelQuarto(tipo) {
        const map = {
            standard: 'Standard', superior: 'Superior', deluxe: 'Deluxe',
            suite: 'Suíte', 'suite júnior': 'Suíte Júnior',
            'suite presidencial': 'Suíte Presidencial',
            triplo: 'Triplo', 'quádruplo': 'Quádruplo'
        };
        return map[tipo] || tipo || 'Standard';
    }
};
