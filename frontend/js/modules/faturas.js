// GiraMundoTour - Módulo de Faturas / Invoices

const FaturasModule = {
    _bilhetes: [],
    _clientes: {},

    async render() {
        const el = document.getElementById('faturasContent');
        if (!el) return;

        el.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                    <h4 class="mb-0 fw-bold text-primary">
                        <i class="bi bi-file-earmark-text me-2"></i>Emissão de Faturas
                    </h4>
                    <small class="text-muted">Gere invoices formais com todos os dados da empresa</small>
                </div>
            </div>

            <!-- Filtros -->
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-body py-3">
                    <div class="row g-2 align-items-end">
                        <div class="col-md-4">
                            <label class="form-label form-label-sm mb-1">Buscar</label>
                            <input type="text" id="faturasBusca" class="form-control form-control-sm"
                                   placeholder="Cliente, reserva, passageiro...">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label form-label-sm mb-1">Data início</label>
                            <input type="date" id="faturasDataInicio" class="form-control form-control-sm">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label form-label-sm mb-1">Data fim</label>
                            <input type="date" id="faturasDataFim" class="form-control form-control-sm">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label form-label-sm mb-1">Companhia</label>
                            <select id="faturasCompanhia" class="form-select form-select-sm">
                                <option value="">Todas</option>
                                <option value="LATAM">LATAM</option>
                                <option value="GOL">GOL</option>
                                <option value="Azul">Azul</option>
                            </select>
                        </div>
                        <div class="col-md-2 d-flex gap-2">
                            <button class="btn btn-primary btn-sm w-100" onclick="FaturasModule._aplicarFiltros()">
                                <i class="bi bi-search me-1"></i>Filtrar
                            </button>
                            <button class="btn btn-outline-secondary btn-sm" onclick="FaturasModule._limparFiltros()"
                                    title="Limpar filtros">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Resumo -->
            <div id="faturasResumo" class="row g-3 mb-4"></div>

            <!-- Tabela -->
            <div class="card border-0 shadow-sm">
                <div class="card-body p-0">
                    <div id="faturasTabela" class="table-responsive">
                        <div class="text-center py-5 text-muted">
                            <div class="spinner-border spinner-border-sm me-2"></div>Carregando bilhetes...
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Evento de busca ao digitar
        document.getElementById('faturasBusca').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this._aplicarFiltros();
        });

        await this.loadList();
    },

    async loadList() {
        try {
            const resp = await apiCall('/api/bilhetes?limit=500');
            if (!resp || !resp.ok) throw new Error('Falha ao carregar bilhetes');
            const data = await resp.json();
            this._bilhetes = data.data || data || [];
        } catch(e) {
            console.error('[FaturasModule] Erro ao carregar:', e);
            this._bilhetes = [];
        }
        this._renderTabela(this._bilhetes);
        this._renderResumo(this._bilhetes);
    },

    _aplicarFiltros() {
        const busca    = (document.getElementById('faturasBusca')?.value || '').toLowerCase().trim();
        const inicio   = document.getElementById('faturasDataInicio')?.value;
        const fim      = document.getElementById('faturasDataFim')?.value;
        const companhia = document.getElementById('faturasCompanhia')?.value.toLowerCase();

        const filtrados = this._bilhetes.filter(b => {
            if (busca) {
                const campos = [
                    b.clienteNome, b.codigoReserva, b.passageiroNome,
                    b.companhia, b.origem, b.destino
                ].map(v => (v || '').toLowerCase()).join(' ');
                if (!campos.includes(busca)) return false;
            }
            if (inicio) {
                const dataB = (b.dataEmissao || b.dataIda || '').substring(0, 10);
                if (dataB && dataB < inicio) return false;
            }
            if (fim) {
                const dataB = (b.dataEmissao || b.dataIda || '').substring(0, 10);
                if (dataB && dataB > fim) return false;
            }
            if (companhia && !(b.companhia || '').toLowerCase().includes(companhia)) return false;
            return true;
        });

        this._renderTabela(filtrados);
        this._renderResumo(filtrados);
    },

    _limparFiltros() {
        document.getElementById('faturasBusca').value      = '';
        document.getElementById('faturasDataInicio').value = '';
        document.getElementById('faturasDataFim').value    = '';
        document.getElementById('faturasCompanhia').value  = '';
        this._renderTabela(this._bilhetes);
        this._renderResumo(this._bilhetes);
    },

    _renderResumo(lista) {
        const el = document.getElementById('faturasResumo');
        if (!el) return;

        const totalBilhetes = lista.length;
        const totalValor    = lista.reduce((s, b) => s + (parseFloat(b.valorVenda) || 0), 0);
        const totalPax      = lista.reduce((s, b) => {
            const n = b.passageiroNome || '';
            return s + (n.includes(',') ? n.split(',').filter(x => x.trim()).length : (n ? 1 : 0));
        }, 0);

        const cards = [
            { icon: 'bi-file-earmark-text', color: 'primary', label: 'Bilhetes', valor: totalBilhetes, fmt: 'num' },
            { icon: 'bi-people',            color: 'info',    label: 'Passageiros', valor: totalPax, fmt: 'num' },
            { icon: 'bi-currency-dollar',   color: 'success', label: 'Valor Total', valor: totalValor, fmt: 'cur' },
        ];

        el.innerHTML = cards.map(c => `
            <div class="col-md-4">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-body d-flex align-items-center gap-3">
                        <div class="rounded-3 p-3 bg-${c.color} bg-opacity-10">
                            <i class="bi ${c.icon} text-${c.color} fs-4"></i>
                        </div>
                        <div>
                            <div class="text-muted small">${c.label}</div>
                            <div class="fw-bold fs-5 text-${c.color}">
                                ${c.fmt === 'cur' ? Formatter.currency(c.valor) : c.valor}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    },

    _renderTabela(lista) {
        const el = document.getElementById('faturasTabela');
        if (!el) return;

        if (lista.length === 0) {
            el.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                    Nenhum bilhete encontrado.
                </div>`;
            return;
        }

        const linhas = lista.map(b => {
            const nomeCliente = b.clienteNome || '—';
            const reserva     = b.codigoReserva || '—';
            const companhia   = b.companhiaNome || b.companhia || '—';
            const rota        = [b.origem, b.destino].filter(Boolean).join(' → ') || '—';
            const dataIda     = b.dataIda   ? Formatter.date(b.dataIda)   : '—';
            const dataVolta   = b.dataVolta ? Formatter.date(b.dataVolta) : '—';
            const valor       = Formatter.currency(b.valorVenda || 0);
            const nomePax     = b.passageiroNome || '';
            const qtdPax      = nomePax.includes(',')
                ? nomePax.split(',').filter(n => n.trim()).length : (nomePax ? 1 : 0);
            const dataEmissao = b.dataEmissao ? Formatter.date(b.dataEmissao) : '—';

            const statusBadge = (() => {
                const s = (b.status || 'emitido').toLowerCase();
                const map = {
                    emitido:   ['success', 'Emitido'],
                    cancelado: ['danger',  'Cancelado'],
                    pendente:  ['warning', 'Pendente'],
                    reembolsado: ['secondary', 'Reembolsado']
                };
                const [cor, txt] = map[s] || ['secondary', b.status];
                return `<span class="badge bg-${cor}">${txt}</span>`;
            })();

            return `
                <tr>
                    <td class="fw-semibold text-primary">${reserva}</td>
                    <td>${nomeCliente}</td>
                    <td><small>${nomePax ? nomePax.split(',').map(n => n.trim()).join('<br>') : '—'}</small></td>
                    <td>${companhia}<br><small class="text-muted">${rota}</small></td>
                    <td><small>${dataIda}${b.dataVolta ? '<br>' + dataVolta : ''}</small></td>
                    <td>${dataEmissao}</td>
                    <td class="fw-bold text-success">${valor}</td>
                    <td>${statusBadge}</td>
                    <td class="text-center">
                        <button class="btn btn-warning btn-sm"
                                onclick="FaturasModule.gerarInvoice('${b.id}')"
                                title="Emitir Fatura / Invoice">
                            <i class="bi bi-file-earmark-text me-1"></i>Emitir Fatura
                        </button>
                    </td>
                </tr>`;
        }).join('');

        el.innerHTML = `
            <table class="table table-hover align-middle mb-0">
                <thead class="table-dark">
                    <tr>
                        <th>Reserva</th>
                        <th>Cliente</th>
                        <th>Passageiros</th>
                        <th>Companhia / Rota</th>
                        <th>Datas</th>
                        <th>Emissão</th>
                        <th>Valor</th>
                        <th>Status</th>
                        <th class="text-center">Ação</th>
                    </tr>
                </thead>
                <tbody>${linhas}</tbody>
            </table>`;
    },

    gerarInvoice(id) {
        const bilhete = this._bilhetes.find(b => b.id === id);
        if (!bilhete) return;

        document.getElementById('modalFaturaEmitir')?.remove();

        const nomeCliente = bilhete.clienteNome || 'Cliente';
        const valor       = Formatter.currency(bilhete.valorVenda || 0);
        const nomePax     = bilhete.passageiroNome || '';
        const qtdPax      = nomePax.includes(',') ? nomePax.split(',').filter(n => n.trim()).length : 1;

        const modalHtml = `
            <div class="modal fade" id="modalFaturaEmitir" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header" style="background: linear-gradient(135deg, #1a365d, #2b6cb0); color: #fff;">
                            <h5 class="modal-title">
                                <i class="bi bi-file-earmark-text me-2"></i>Emitir Fatura / Invoice
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info py-2 mb-3">
                                <div class="fw-semibold">${bilhete.codigoReserva || '—'} — ${nomeCliente}</div>
                                <small>${qtdPax} passageiro${qtdPax > 1 ? 's' : ''}
                                &nbsp;|&nbsp; Valor: <strong>${valor}</strong></small>
                            </div>

                            <div class="mb-3">
                                <label class="form-label fw-semibold">
                                    Forma de Pagamento <span class="text-danger">*</span>
                                </label>
                                <select class="form-select" id="faturasModalForma">
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
                                <label class="form-label fw-semibold">
                                    Observação <small class="text-muted">(opcional)</small>
                                </label>
                                <input type="text" class="form-control" id="faturasModalObs"
                                       placeholder="Ex: Pago em 2x sem juros, parcelado no cartão...">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-warning text-dark fw-semibold"
                                    onclick="FaturasModule._confirmarInvoice('${id}')">
                                <i class="bi bi-file-earmark-pdf me-1"></i> Gerar Fatura PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        new bootstrap.Modal(document.getElementById('modalFaturaEmitir')).show();
    },

    async _confirmarInvoice(id) {
        const forma = document.getElementById('faturasModalForma').value;
        if (!forma) {
            document.getElementById('faturasModalForma').classList.add('is-invalid');
            return;
        }
        const obs = document.getElementById('faturasModalObs').value.trim();

        bootstrap.Modal.getInstance(document.getElementById('modalFaturaEmitir'))?.hide();

        const bilhete = this._bilhetes.find(b => b.id === id);
        if (!bilhete) return;

        let clienteCompleto = null;
        if (bilhete.clienteId) {
            try {
                const resp = await apiCall(`/api/clientes/${bilhete.clienteId}`);
                if (resp && resp.ok) clienteCompleto = await resp.json();
            } catch(e) {
                console.warn('[FaturasModule] Não foi possível buscar cliente:', e);
            }
        }

        ReportModule.gerarInvoicePDF(
            { ...bilhete },
            clienteCompleto || bilhete.cliente || null,
            { formaPagamento: forma, observacao: obs }
        );
    }
};

window.FaturasModule = FaturasModule;
