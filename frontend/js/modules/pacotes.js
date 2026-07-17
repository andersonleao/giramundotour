// GiraMundoTour - Módulo de Pacotes de Viagem

const PacotesModule = {
    _pacotes:   [],
    _clientes:  [],
    _servicos:  [],   // serviços do formulário atual
    _editandoId: null,

    // ── Tipos de serviço ─────────────────────────────────────────────
    TIPOS: [
        { value: 'aereo',     label: 'Aéreo',     icon: 'bi-airplane',      cor: '#0d6efd' },
        { value: 'hotel',     label: 'Hotel',     icon: 'bi-building',      cor: '#fd7e14' },
        { value: 'passeio',   label: 'Passeio',   icon: 'bi-camera',        cor: '#198754' },
        { value: 'translado', label: 'Translado', icon: 'bi-bus-front',     cor: '#6f42c1' },
        { value: 'seguro',    label: 'Seguro',    icon: 'bi-shield-check',  cor: '#0dcaf0' },
        { value: 'outro',     label: 'Outro',     icon: 'bi-plus-circle',   cor: '#6c757d' },
    ],

    STATUS: {
        orcamento:  { label: 'Orçamento',  cls: 'bg-secondary' },
        aprovado:   { label: 'Aprovado',   cls: 'bg-success'   },
        emitido:    { label: 'Emitido',    cls: 'bg-primary'   },
        cancelado:  { label: 'Cancelado',  cls: 'bg-danger'    },
    },

    // ── Init / Render ────────────────────────────────────────────────
    init() {},

    async render() {
        const container = document.getElementById('pacotesContent');
        if (!container) return;

        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div class="d-flex align-items-center gap-3">
                    <input type="text" id="buscaPacote" class="form-control" style="width:260px"
                           placeholder="Buscar destino ou cliente..." oninput="PacotesModule._filtrar()">
                    <select id="filtroStatusPacote" class="form-select" style="width:160px"
                            onchange="PacotesModule._filtrar()">
                        <option value="">Todos os status</option>
                        <option value="orcamento">Orçamento</option>
                        <option value="aprovado">Aprovado</option>
                        <option value="emitido">Emitido</option>
                        <option value="cancelado">Cancelado</option>
                    </select>
                </div>
                <button class="btn btn-primary" onclick="PacotesModule.abrirModal()">
                    <i class="bi bi-plus-circle me-1"></i>Novo Pacote
                </button>
            </div>

            <div id="pacotesLista"></div>

            <!-- Modal do formulário -->
            <div class="modal fade" id="modalPacote" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-xl modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title" id="modalPacoteTitulo">
                                <i class="bi bi-suitcase-lg me-2"></i>Novo Pacote de Viagem
                            </h5>
                            <button type="button" class="btn-close btn-close-white"
                                    onclick="PacotesModule.fecharModal()"></button>
                        </div>
                        <div class="modal-body" id="modalPacoteBody">
                            ${this._htmlFormulario()}
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" onclick="PacotesModule.fecharModal()">Cancelar</button>
                            <button class="btn btn-success" onclick="PacotesModule.salvar()">
                                <i class="bi bi-floppy me-1"></i>Salvar Pacote
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this._carregarPacotes();
        await this._carregarClientes();
    },

    _htmlFormulario() {
        return `
        <div class="row g-3">
            <!-- Dados do Cliente -->
            <div class="col-12">
                <div class="card border-primary">
                    <div class="card-header bg-primary bg-opacity-10 fw-semibold">
                        <i class="bi bi-person me-2"></i>Dados do Cliente
                    </div>
                    <div class="card-body row g-3">
                        <div class="col-md-4">
                            <label class="form-label">Buscar cliente cadastrado <small class="text-muted">(opcional)</small></label>
                            <div class="position-relative">
                                <input type="text" id="fBuscaCliente" class="form-control"
                                       placeholder="Digite para buscar..."
                                       autocomplete="off"
                                       oninput="PacotesModule._buscarCliente(this.value); document.getElementById('fClienteNome').value = this.value;">
                                <div id="clienteSugestoes" class="position-absolute bg-white border rounded shadow-sm w-100 d-none"
                                     style="z-index:1060; max-height:200px; overflow-y:auto; top:100%;"></div>
                                <input type="hidden" id="fClienteId">
                            </div>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Nome do passageiro <span class="text-danger">*</span></label>
                            <input type="text" id="fClienteNome" class="form-control" placeholder="Nome completo"
                                   oninput="document.getElementById('fBuscaCliente').value = this.value; PacotesModule._buscarCliente(this.value);">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Telefone</label>
                            <input type="text" id="fClienteTelefone" class="form-control" placeholder="(xx) xxxxx-xxxx">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">E-mail</label>
                            <input type="text" id="fClienteEmail" class="form-control" placeholder="email@exemplo.com">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Dados da Viagem -->
            <div class="col-12">
                <div class="card border-success">
                    <div class="card-header bg-success bg-opacity-10 fw-semibold">
                        <i class="bi bi-geo-alt me-2"></i>Dados da Viagem
                    </div>
                    <div class="card-body row g-3">
                        <div class="col-md-4">
                            <label class="form-label">Destino <span class="text-danger">*</span></label>
                            <input type="text" id="fDestino" class="form-control" placeholder="Ex: Miami, Orlando, Paris">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Nome do Pacote</label>
                            <input type="text" id="fNomeViagem" class="form-control" placeholder="Ex: Lua de Mel em Paris">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Partida</label>
                            <input type="date" id="fDataPartida" class="form-control">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Retorno</label>
                            <input type="date" id="fDataRetorno" class="form-control">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Adultos</label>
                            <input type="number" id="fAdultos" class="form-control" value="1" min="1" max="20">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Crianças</label>
                            <input type="number" id="fCriancas" class="form-control" value="0" min="0" max="20">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Bebês</label>
                            <input type="number" id="fBebes" class="form-control" value="0" min="0" max="10">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Status</label>
                            <select id="fStatus" class="form-select">
                                <option value="orcamento">Orçamento</option>
                                <option value="aprovado">Aprovado</option>
                                <option value="emitido">Emitido</option>
                                <option value="cancelado">Cancelado</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Validade</label>
                            <input type="date" id="fValidade" class="form-control">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Solicitante</label>
                            <input type="text" id="fSolicitante" class="form-control" placeholder="Atendente">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Serviços -->
            <div class="col-12">
                <div class="card border-warning">
                    <div class="card-header bg-warning bg-opacity-10 d-flex justify-content-between align-items-center">
                        <span class="fw-semibold"><i class="bi bi-list-check me-2"></i>Serviços do Pacote</span>
                        <div class="d-flex gap-1 flex-wrap">
                            ${this.TIPOS.map(t => `
                                <button class="btn btn-sm btn-outline-secondary" title="Adicionar ${t.label}"
                                        onclick="PacotesModule.adicionarServico('${t.value}')">
                                    <i class="bi ${t.icon} me-1" style="color:${t.cor}"></i>${t.label}
                                </button>`).join('')}
                        </div>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-sm mb-0 align-middle" id="tabelaServicos">
                                <thead class="table-light">
                                    <tr>
                                        <th style="width:120px">Tipo</th>
                                        <th>Descrição</th>
                                        <th style="width:150px">Fornecedor</th>
                                        <th style="width:110px">Data Início</th>
                                        <th style="width:110px">Data Fim</th>
                                        <th style="width:70px" class="text-center">Qtd</th>
                                        <th style="width:200px;min-width:200px" class="text-end">Valor Unit.</th>
                                        <th style="width:200px;min-width:200px" class="text-end">Total</th>
                                        <th style="width:50px" class="text-center" title="Foto">
                                            <i class="bi bi-camera text-muted"></i>
                                        </th>
                                        <th style="width:40px"></th>
                                    </tr>
                                </thead>
                                <tbody id="tbodyServicos">
                                    <tr id="trSemServicos">
                                        <td colspan="10" class="text-center text-muted py-3">
                                            <i class="bi bi-plus-circle me-2"></i>Clique em um tipo acima para adicionar serviços
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Totais + Observações -->
            <div class="col-md-7">
                <label class="form-label fw-semibold">Observações</label>
                <textarea id="fObservacoes" class="form-control" rows="5"
                          placeholder="Condições, informações adicionais, validade..."></textarea>
            </div>
            <div class="col-md-5">
                <div class="card bg-light">
                    <div class="card-body">
                        <h6 class="fw-bold mb-3">Resumo de Valores</h6>
                        <div class="d-flex justify-content-between mb-2">
                            <span>Subtotal dos serviços</span>
                            <span id="resumoSubtotal" class="fw-semibold">R$ 0,00</span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span>Comissão / Markup</span>
                            <div class="input-group input-group-sm" style="width:130px">
                                <input type="number" id="fMarkup" class="form-control text-end"
                                       value="0" min="0" max="50" step="0.5"
                                       oninput="PacotesModule._recalcular()">
                                <span class="input-group-text">%</span>
                            </div>
                        </div>
                        <div class="d-flex justify-content-between mb-2 text-muted small">
                            <span>Valor markup</span>
                            <span id="resumoMarkupVal">R$ 0,00</span>
                        </div>
                        <hr class="my-2">
                        <div class="d-flex justify-content-between fs-5 fw-bold text-primary">
                            <span>Total do Pacote</span>
                            <span id="resumoTotal">R$ 0,00</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    },

    // ── CRUD ─────────────────────────────────────────────────────────

    async _carregarPacotes() {
        try {
            const resp = await apiCall('/api/pacotes?limit=100');
            if (!resp || !resp.ok) return;
            const data = await resp.json();
            this._pacotes = data.data || [];
            this._renderizarLista(this._pacotes);
        } catch (e) {
            console.error('[Pacotes]', e);
        }
    },

    async _carregarClientes() {
        try {
            const resp = await apiCall('/api/clientes?limit=1000');
            if (!resp || !resp.ok) return;
            const data = await resp.json();
            this._clientes = data.data || data || [];
        } catch (e) { /* silencioso */ }
    },

    _renderizarLista(pacotes) {
        const container = document.getElementById('pacotesLista');
        if (!container) return;

        if (!pacotes.length) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-suitcase-lg" style="font-size:3rem; opacity:.3;"></i>
                    <div class="mt-2">Nenhum pacote cadastrado</div>
                    <button class="btn btn-primary mt-3" onclick="PacotesModule.abrirModal()">
                        <i class="bi bi-plus-circle me-1"></i>Criar primeiro pacote
                    </button>
                </div>`;
            return;
        }

        const rows = pacotes.map(p => {
            const st  = this.STATUS[p.status] || { label: p.status, cls: 'bg-secondary' };
            const cod = p.id.slice(0,8).toUpperCase();
            const pax = (+p.adultos||1) + (+p.criancas||0) + (+p.bebes||0);
            const partida = p.dataPartida ? this._fmtData(p.dataPartida) : '—';
            const retorno = p.dataRetorno ? this._fmtData(p.dataRetorno) : '—';
            return `
                <tr>
                    <td><span class="font-monospace text-muted small">#${cod}</span></td>
                    <td>
                        <div class="fw-semibold">${p.destino}</div>
                        ${p.nomeViagem ? `<small class="text-muted">${p.nomeViagem}</small>` : ''}
                    </td>
                    <td>${p.clienteNome || '<span class="text-muted">—</span>'}</td>
                    <td>${partida}</td>
                    <td>${retorno}</td>
                    <td class="text-center"><span class="badge bg-light text-dark border">${pax} pax</span></td>
                    <td class="text-end fw-semibold text-primary">${this._fmtMoeda(p.total)}</td>
                    <td class="text-center"><span class="badge ${st.cls}">${st.label}</span></td>
                    <td>
                        <div class="d-flex gap-1 justify-content-end">
                            <button class="btn btn-sm btn-outline-secondary" title="PDF"
                                    onclick="PacotesModule.gerarPDF('${p.id}')">
                                <i class="bi bi-file-earmark-pdf"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-primary" title="Editar"
                                    onclick="PacotesModule.abrirModal('${p.id}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" title="Excluir"
                                    onclick="PacotesModule.deletar('${p.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead class="table-light">
                        <tr>
                            <th>Cód.</th><th>Destino</th><th>Cliente</th>
                            <th>Partida</th><th>Retorno</th><th class="text-center">Pax</th>
                            <th class="text-end">Total</th><th class="text-center">Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    },

    _filtrar() {
        const q  = (document.getElementById('buscaPacote')?.value || '').toLowerCase();
        const st = document.getElementById('filtroStatusPacote')?.value || '';
        const filtrados = this._pacotes.filter(p => {
            const matchQ  = !q || (p.destino||'').toLowerCase().includes(q) ||
                            (p.clienteNome||'').toLowerCase().includes(q) ||
                            (p.nomeViagem||'').toLowerCase().includes(q);
            const matchSt = !st || p.status === st;
            return matchQ && matchSt;
        });
        this._renderizarLista(filtrados);
    },

    // ── Modal ────────────────────────────────────────────────────────

    async abrirModal(id) {
        this._editandoId = id || null;
        this._servicos   = [];

        const titulo = document.getElementById('modalPacoteTitulo');
        if (titulo) titulo.innerHTML = id
            ? '<i class="bi bi-pencil-square me-2"></i>Editar Pacote'
            : '<i class="bi bi-suitcase-lg me-2"></i>Novo Pacote de Viagem';

        // Resetar form
        this._limparForm();

        if (id) {
            try {
                const resp = await apiCall(`/api/pacotes/${id}`);
                if (resp && resp.ok) {
                    const { data } = await resp.json();
                    this._preencherForm(data);
                }
            } catch (e) { console.error(e); }
        } else {
            // Validade padrão: 5 dias
            const val = new Date(); val.setDate(val.getDate() + 5);
            document.getElementById('fValidade').value = val.toISOString().slice(0,10);
        }

        this._renderizarServicos();
        this._recalcular();

        const modal = new bootstrap.Modal(document.getElementById('modalPacote'));
        modal.show();
    },

    fecharModal() {
        const el = document.getElementById('modalPacote');
        const m  = bootstrap.Modal.getInstance(el);
        if (m) m.hide();
    },

    _limparForm() {
        ['fClienteId','fClienteNome','fClienteEmail','fClienteTelefone',
         'fDestino','fNomeViagem','fDataPartida','fDataRetorno',
         'fAdultos','fCriancas','fBebes','fObservacoes','fSolicitante',
         'fBuscaCliente'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = id === 'fAdultos' ? '1' : id === 'fCriancas' || id === 'fBebes' ? '0' : '';
        });
        const fStatus = document.getElementById('fStatus');
        if (fStatus) fStatus.value = 'orcamento';
        const fMarkup = document.getElementById('fMarkup');
        if (fMarkup) fMarkup.value = '0';
    },

    _preencherForm(p) {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
        const toDateStr = (v) => {
            if (!v) return '';
            if (v instanceof Date) return v.toISOString().slice(0, 10);
            return String(v).slice(0, 10);
        };
        set('fClienteId',       p.clienteId       || '');
        set('fBuscaCliente',    p.clienteNome      || '');
        set('fClienteNome',     p.clienteNome      || '');
        set('fClienteEmail',    p.clienteEmail     || '');
        set('fClienteTelefone', p.clienteTelefone  || '');
        set('fDestino',         p.destino          || '');
        set('fNomeViagem',      p.nomeViagem       || '');
        set('fDataPartida',     toDateStr(p.dataPartida));
        set('fDataRetorno',     toDateStr(p.dataRetorno));
        set('fAdultos',         p.adultos  ?? 1);
        set('fCriancas',        p.criancas ?? 0);
        set('fBebes',           p.bebes    ?? 0);
        set('fObservacoes',     p.observacoes  || '');
        set('fStatus',          p.status       || 'orcamento');
        set('fValidade',        toDateStr(p.validade));
        set('fSolicitante',     p.solicitante  || '');
        set('fMarkup',          p.markup != null ? +p.markup : 0);

        const servicos = Array.isArray(p.servicos) ? p.servicos : [];
        this._servicos = servicos.map(s => ({ ...s }));
    },

    _syncServicosFromDOM() {
        this._servicos.forEach((s, i) => {
            const v = id => document.getElementById(id)?.value;
            const tipo = v(`svc_tipo_${i}`);
            if (tipo !== undefined) s.tipo = tipo;
            const desc = v(`svc_desc_${i}`);
            if (desc !== undefined) s.descricao = desc;
            const forn = v(`svc_forn_${i}`);
            if (forn !== undefined) s.fornecedor = forn;
            const dtI = v(`svc_dtI_${i}`);
            if (dtI !== undefined) s.dataInicio = dtI;
            const dtF = v(`svc_dtF_${i}`);
            if (dtF !== undefined) s.dataFim = dtF;
            const qtd = v(`svc_qtd_${i}`);
            if (qtd !== undefined) s.quantidade = +qtd || 1;
            const vUnit = v(`svc_vUnit_${i}`);
            if (vUnit !== undefined) s.valorUnit = this._parseMoeda(vUnit);
            const vTot = v(`svc_valorTotal_${i}`);
            if (vTot !== undefined) s.valorTotal = this._parseMoeda(vTot);
            const diarias = v(`svc_diarias_${i}`);
            if (diarias !== undefined) s.diarias = +diarias || 0;
            const quartos = v(`svc_quartos_${i}`);
            if (quartos !== undefined) s.quartos = +quartos || 1;
            const pessoas = v(`svc_pessoas_${i}`);
            if (pessoas !== undefined) s.pessoas = +pessoas || 1;
            const apto = v(`svc_apto_${i}`);
            if (apto !== undefined) s.tipoApto = apto;
        });
    },

    async salvar() {
        this._syncServicosFromDOM();
        const destino = document.getElementById('fDestino')?.value?.trim();
        if (!destino) { App.showToast('Informe o destino do pacote', 'warning'); return; }

        const payload = {
            clienteId:       document.getElementById('fClienteId')?.value       || null,
            clienteNome:     document.getElementById('fClienteNome')?.value      ||
                             document.getElementById('fBuscaCliente')?.value     || null,
            clienteEmail:    document.getElementById('fClienteEmail')?.value     || null,
            clienteTelefone: document.getElementById('fClienteTelefone')?.value  || null,
            destino,
            nomeViagem:      document.getElementById('fNomeViagem')?.value        || null,
            dataPartida:     document.getElementById('fDataPartida')?.value       || null,
            dataRetorno:     document.getElementById('fDataRetorno')?.value       || null,
            adultos:         +document.getElementById('fAdultos')?.value          || 1,
            criancas:        +document.getElementById('fCriancas')?.value         || 0,
            bebes:           +document.getElementById('fBebes')?.value            || 0,
            servicos:        this._servicos,
            subtotal:        this._calcSubtotal(),
            markup:          +document.getElementById('fMarkup')?.value           || 0,
            total:           this._calcTotal(),
            status:          document.getElementById('fStatus')?.value            || 'orcamento',
            observacoes:     document.getElementById('fObservacoes')?.value       || null,
            validade:        document.getElementById('fValidade')?.value          || null,
            solicitante:     document.getElementById('fSolicitante')?.value       || null,
        };

        try {
            const url    = this._editandoId ? `/api/pacotes/${this._editandoId}` : '/api/pacotes';
            const method = this._editandoId ? 'PUT' : 'POST';
            const resp   = await apiCall(url, { method, body: JSON.stringify(payload) });
            if (!resp || !resp.ok) { App.showToast('Erro ao salvar pacote', 'danger'); return; }
            App.showToast(this._editandoId ? 'Pacote atualizado!' : 'Pacote criado!', 'success');
            this.fecharModal();
            await this._carregarPacotes();
        } catch (e) {
            App.showToast('Erro: ' + e.message, 'danger');
        }
    },

    deletar(id) {
        App.showConfirm('Excluir Pacote', 'Esta ação não pode ser desfeita.', async () => {
            try {
                const resp = await apiCall(`/api/pacotes/${id}`, { method: 'DELETE' });
                if (!resp || !resp.ok) { App.showToast('Erro ao excluir', 'danger'); return; }
                App.showToast('Pacote excluído', 'success');
                await this._carregarPacotes();
            } catch (e) {
                App.showToast('Erro: ' + e.message, 'danger');
            }
        });
    },

    // ── Busca de clientes ────────────────────────────────────────────

    _buscarCliente(q) {
        const sugestoes = document.getElementById('clienteSugestoes');
        if (!sugestoes) return;
        if (!q || q.length < 2) { sugestoes.classList.add('d-none'); return; }

        const matches = this._clientes.filter(c =>
            (c.nome||'').toLowerCase().includes(q.toLowerCase()) ||
            (c.email||'').toLowerCase().includes(q.toLowerCase())
        ).slice(0, 8);

        if (!matches.length) { sugestoes.classList.add('d-none'); return; }

        sugestoes.innerHTML = matches.map(c => `
            <div class="px-3 py-2 border-bottom" style="cursor:pointer"
                 onmousedown="PacotesModule._selecionarCliente('${c.id}','${(c.nome||'').replace(/'/g,"\\'")}','${(c.email||'')}','${(c.telefone||'')}')">
                <div class="fw-semibold">${c.nome}</div>
                <small class="text-muted">${c.email||''} ${c.telefone ? '· ' + c.telefone : ''}</small>
            </div>`).join('');
        sugestoes.classList.remove('d-none');
    },

    _selecionarCliente(id, nome, email, telefone) {
        const set = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v; };
        set('fClienteId', id);
        set('fBuscaCliente', nome);
        set('fClienteNome', nome);
        set('fClienteEmail', email);
        set('fClienteTelefone', telefone);
        document.getElementById('clienteSugestoes')?.classList.add('d-none');
    },

    // ── Serviços ─────────────────────────────────────────────────────

    adicionarServico(tipo) {
        const ehHotel = tipo === 'hotel';
        this._servicos.push({
            tipo, descricao: '', fornecedor: '',
            dataInicio: '', dataFim: '', quantidade: 1,
            valorUnit: 0, valorTotal: 0, obs: '', imagem: null,
            diarias:  ehHotel ? 1 : 0,
            quartos:  ehHotel ? 1 : 0,
            pessoas:  ehHotel ? 2 : 0,
            tipoApto: ehHotel ? 'duplo' : ''
        });
        this._renderizarServicos();
        this._recalcular();
    },

    removerServico(idx) {
        this._servicos.splice(idx, 1);
        this._renderizarServicos();
        this._recalcular();
    },

    _onServicoChange(idx, campo, valor) {
        const s = this._servicos[idx];
        if (!s) return;
        const numFields = ['quantidade', 'valorUnit', 'valorTotal', 'diarias', 'quartos', 'pessoas'];
        s[campo] = numFields.includes(campo) ? this._parseMoeda(valor) : valor;

        // Hotel: calcula diárias automaticamente a partir do check-in → check-out
        if (s.tipo === 'hotel' && (campo === 'dataInicio' || campo === 'dataFim')) {
            const d = this._calcDiarias(s.dataInicio, s.dataFim);
            if (d > 0) {
                s.diarias = d;
                const dEl = document.getElementById(`svc_diarias_${idx}`);
                if (dEl) dEl.value = d;
            }
        }

        if (s.tipo === 'hotel') {
            // Total do hotel = diária × nº de quartos × nº de diárias
            if (campo !== 'valorTotal') {
                s.valorTotal = (+s.valorUnit || 0) * (+s.quartos || 1) * (+s.diarias || 0);
                const totalEl = document.getElementById(`svc_valorTotal_${idx}`);
                if (totalEl) totalEl.value = this._fmtInput(s.valorTotal);
            } else {
                // Usuário editou o total manualmente → recalcula a diária implícita
                const div = (+s.quartos || 1) * (+s.diarias || 1);
                s.valorUnit = div > 0 ? s.valorTotal / div : s.valorTotal;
            }
        } else {
            if (campo === 'quantidade' || campo === 'valorUnit') {
                s.valorTotal = s.quantidade * s.valorUnit;
                const totalEl = document.getElementById(`svc_valorTotal_${idx}`);
                if (totalEl) totalEl.value = this._fmtInput(s.valorTotal);
            } else if (campo === 'valorTotal') {
                s.valorUnit = s.quantidade > 0 ? s.valorTotal / s.quantidade : 0;
            }
        }

        // Mudou o tipo → aplica padrões de hotel e re-renderiza (mostra/oculta campos)
        if (campo === 'tipo') {
            if (valor === 'hotel') {
                if (!s.quartos)  s.quartos  = 1;
                if (!s.pessoas)  s.pessoas  = 2;
                if (!s.diarias)  s.diarias  = this._calcDiarias(s.dataInicio, s.dataFim) || 1;
                if (!s.tipoApto) s.tipoApto = 'duplo';
                s.valorTotal = (+s.valorUnit || 0) * (+s.quartos || 1) * (+s.diarias || 0);
            }
            this._renderizarServicos();
        }

        this._recalcular();
    },

    _renderizarServicos() {
        const tbody = document.getElementById('tbodyServicos');
        if (!tbody) return;

        const semEl = document.getElementById('trSemServicos');

        if (!this._servicos.length) {
            tbody.innerHTML = `
                <tr id="trSemServicos">
                    <td colspan="10" class="text-center text-muted py-3">
                        <i class="bi bi-plus-circle me-2"></i>Clique em um tipo acima para adicionar serviços
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = this._servicos.map((s, i) => {
            const tipo = this.TIPOS.find(t => t.value === s.tipo) || this.TIPOS[5];
            return `
            <tr>
                <td>
                    <div class="d-flex align-items-center gap-1">
                        <i class="bi ${tipo.icon}" style="color:${tipo.cor}"></i>
                        <select id="svc_tipo_${i}" class="form-select form-select-sm border-0 p-0 bg-transparent"
                                style="width:90px; font-size:.8rem"
                                onchange="PacotesModule._onServicoChange(${i},'tipo',this.value)">
                            ${this.TIPOS.map(t => `<option value="${t.value}" ${s.tipo===t.value?'selected':''}>${t.label}</option>`).join('')}
                        </select>
                    </div>
                </td>
                <td style="min-width:260px">
                    <input type="text" id="svc_desc_${i}" class="form-control form-control-sm" value="${s.descricao||''}"
                           placeholder="Descrição do serviço"
                           oninput="PacotesModule._onServicoChange(${i},'descricao',this.value)">
                    ${s.tipo === 'hotel' ? `
                    <div class="d-flex flex-wrap gap-1 mt-1 align-items-center">
                        <div class="input-group input-group-sm flex-nowrap" style="width:100px" title="Nº de diárias (calculado pelas datas)">
                            <span class="input-group-text px-1"><i class="bi bi-moon-stars"></i></span>
                            <input type="number" id="svc_diarias_${i}" class="form-control text-center px-1" min="0"
                                   value="${s.diarias||''}" placeholder="diárias"
                                   onchange="PacotesModule._onServicoChange(${i},'diarias',this.value)">
                        </div>
                        <div class="input-group input-group-sm flex-nowrap" style="width:92px" title="Nº de quartos">
                            <span class="input-group-text px-1"><i class="bi bi-door-closed"></i></span>
                            <input type="number" id="svc_quartos_${i}" class="form-control text-center px-1" min="1"
                                   value="${s.quartos||1}" placeholder="quartos"
                                   onchange="PacotesModule._onServicoChange(${i},'quartos',this.value)">
                        </div>
                        <div class="input-group input-group-sm flex-nowrap" style="width:92px" title="Nº de pessoas">
                            <span class="input-group-text px-1"><i class="bi bi-people"></i></span>
                            <input type="number" id="svc_pessoas_${i}" class="form-control text-center px-1" min="1"
                                   value="${s.pessoas||1}" placeholder="pessoas"
                                   onchange="PacotesModule._onServicoChange(${i},'pessoas',this.value)">
                        </div>
                        <select id="svc_apto_${i}" class="form-select form-select-sm" style="width:150px"
                                title="Tipo de apartamento"
                                onchange="PacotesModule._onServicoChange(${i},'tipoApto',this.value)">
                            ${['single','duplo','triplo','quadruplo','quintuplo'].map(a =>
                                `<option value="${a}" ${s.tipoApto===a?'selected':''}>${this._labelApto(a)}</option>`).join('')}
                        </select>
                    </div>` : ''}
                </td>
                <td>
                    <input type="text" id="svc_forn_${i}" class="form-control form-control-sm" value="${s.fornecedor||''}"
                           placeholder="Fornecedor"
                           oninput="PacotesModule._onServicoChange(${i},'fornecedor',this.value)">
                </td>
                <td>
                    <input type="date" id="svc_dtI_${i}" class="form-control form-control-sm" value="${s.dataInicio||''}"
                           onchange="PacotesModule._onServicoChange(${i},'dataInicio',this.value)">
                </td>
                <td>
                    <input type="date" id="svc_dtF_${i}" class="form-control form-control-sm" value="${s.dataFim||''}"
                           onchange="PacotesModule._onServicoChange(${i},'dataFim',this.value)">
                </td>
                <td>
                    ${s.tipo === 'hotel'
                        ? `<span class="text-muted small" title="Para hotel use os campos Quartos e Diárias">—</span>`
                        : `<input type="number" id="svc_qtd_${i}" class="form-control form-control-sm text-center" value="${s.quantidade||1}"
                                 min="1" style="width:60px"
                                 onchange="PacotesModule._onServicoChange(${i},'quantidade',this.value)">`}
                </td>
                <td>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text px-1">R$</span>
                        <input type="text" id="svc_vUnit_${i}" class="form-control text-end" inputmode="numeric"
                               style="min-width:130px"
                               value="${this._fmtInput(+s.valorUnit||0)}"
                               oninput="PacotesModule._mascaraMoeda(this)"
                               onblur="PacotesModule._onServicoChange(${i},'valorUnit',this.value)">
                    </div>
                </td>
                <td>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text px-1">R$</span>
                        <input type="text" id="svc_valorTotal_${i}" class="form-control text-end fw-semibold"
                               inputmode="numeric" style="min-width:130px"
                               value="${this._fmtInput(+s.valorTotal||0)}"
                               oninput="PacotesModule._mascaraMoeda(this)"
                               onblur="PacotesModule._onServicoChange(${i},'valorTotal',this.value)">
                    </div>
                </td>
                <td class="text-center">
                    <input type="file" id="svc_img_file_${i}" accept="image/*" class="d-none"
                           onchange="PacotesModule._onImagemServico(${i}, this)">
                    ${s.imagem
                        ? `<div class="position-relative d-inline-block">
                               <img src="${s.imagem}" style="width:38px;height:38px;object-fit:cover;border-radius:5px;cursor:pointer;border:1px solid #dee2e6"
                                    onclick="PacotesModule._triggerUploadImagem(${i})" title="Trocar imagem">
                               <button class="btn btn-danger p-0 position-absolute"
                                       style="top:-5px;right:-5px;width:15px;height:15px;font-size:9px;line-height:14px;border-radius:50%"
                                       onclick="PacotesModule._removerImagemServico(${i})" title="Remover foto">×</button>
                           </div>`
                        : `<button class="btn btn-sm btn-outline-secondary p-1" style="line-height:1"
                                   title="Adicionar foto" onclick="PacotesModule._triggerUploadImagem(${i})">
                               <i class="bi bi-camera"></i>
                           </button>`
                    }
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger p-1" style="line-height:1"
                            onclick="PacotesModule.removerServico(${i})" title="Remover">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    },

    // ── Imagem por serviço ───────────────────────────────────────────

    _triggerUploadImagem(idx) {
        document.getElementById(`svc_img_file_${idx}`)?.click();
    },

    _onImagemServico(idx, input) {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 1024 * 1024) {
            App.showToast('Imagem muito grande. Máximo 1MB.', 'warning');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            if (this._servicos[idx]) {
                this._servicos[idx].imagem = e.target.result;
                this._renderizarServicos();
            }
        };
        reader.readAsDataURL(file);
    },

    _removerImagemServico(idx) {
        if (this._servicos[idx]) {
            this._servicos[idx].imagem = null;
            this._renderizarServicos();
        }
    },

    // ── Cálculos ─────────────────────────────────────────────────────

    _calcSubtotal() {
        return this._servicos.reduce((sum, s) => sum + (+s.valorTotal || 0), 0);
    },

    _calcTotal() {
        const sub    = this._calcSubtotal();
        const markup = +document.getElementById('fMarkup')?.value || 0;
        return sub + (sub * markup / 100);
    },

    _recalcular() {
        const sub    = this._calcSubtotal();
        const markup = +document.getElementById('fMarkup')?.value || 0;
        const mkVal  = sub * markup / 100;
        const total  = sub + mkVal;

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('resumoSubtotal',  this._fmtMoeda(sub));
        set('resumoMarkupVal', this._fmtMoeda(mkVal));
        set('resumoTotal',     this._fmtMoeda(total));
    },

    // ── PDF ──────────────────────────────────────────────────────────

    async gerarPDF(id) {
        let pacote;
        if (id) {
            try {
                const resp = await apiCall(`/api/pacotes/${id}`);
                if (!resp || !resp.ok) { App.showToast('Erro ao carregar pacote', 'danger'); return; }
                const { data } = await resp.json();
                pacote = data;
            } catch (e) { App.showToast('Erro: ' + e.message, 'danger'); return; }
        } else {
            // Gera do formulário atual (sem salvar)
            pacote = {
                id: 'preview',
                clienteNome:     document.getElementById('fClienteNome')?.value,
                clienteEmail:    document.getElementById('fClienteEmail')?.value,
                clienteTelefone: document.getElementById('fClienteTelefone')?.value,
                destino:         document.getElementById('fDestino')?.value,
                nomeViagem:      document.getElementById('fNomeViagem')?.value,
                dataPartida:     document.getElementById('fDataPartida')?.value,
                dataRetorno:     document.getElementById('fDataRetorno')?.value,
                adultos:         +document.getElementById('fAdultos')?.value || 1,
                criancas:        +document.getElementById('fCriancas')?.value || 0,
                bebes:           +document.getElementById('fBebes')?.value || 0,
                servicos:        this._servicos,
                subtotal:        this._calcSubtotal(),
                markup:          +document.getElementById('fMarkup')?.value || 0,
                total:           this._calcTotal(),
                observacoes:     document.getElementById('fObservacoes')?.value,
                validade:        document.getElementById('fValidade')?.value,
                solicitante:     document.getElementById('fSolicitante')?.value,
                status:          document.getElementById('fStatus')?.value || 'orcamento',
                createdAt:       new Date().toISOString(),
            };
        }

        await this._construirPDF(pacote);
    },

    async _construirPDF(p) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const pw  = doc.internal.pageSize.getWidth();
        const ph  = doc.internal.pageSize.getHeight();
        const mg  = 20;
        const cw  = pw - mg * 2;
        let   y   = 0;

        // ── Carregar logo ──
        let logoB64 = null;
        if (typeof ReportModule !== 'undefined' && ReportModule._logoBase64) {
            logoB64 = ReportModule._logoBase64;
        } else {
            logoB64 = await new Promise(res => {
                const img = new Image(); img.crossOrigin = 'anonymous';
                img.onload = () => {
                    const c = document.createElement('canvas');
                    c.width = img.naturalWidth; c.height = img.naturalHeight;
                    c.getContext('2d').drawImage(img, 0, 0);
                    res(c.toDataURL('image/png'));
                };
                img.onerror = () => res(null);
                img.src = '/assets/images/logomarca.png';
            });
        }

        const _header = () => {
            // Fundo azul
            doc.setFillColor(26, 54, 93);
            doc.rect(0, 0, pw, 45, 'F');
            // Logo
            if (logoB64) doc.addImage(logoB64, 'PNG', mg - 1, 6, 33, 33);
            // Nome da empresa
            doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.setTextColor(255,255,255);
            doc.text('GiraMundoTour', mg + 38, 25);
            doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(180,210,255);
            doc.text('Sua viagem começa aqui', mg + 38, 33);
            // Contato (direita)
            doc.setFontSize(8); doc.setTextColor(220,235,255);
            const rx = pw - mg;
            doc.text(CONFIG.empresa.email || '', rx, 14, { align:'right' });
            doc.text(CONFIG.empresa.telefone || '', rx, 20, { align:'right' });
            doc.text(CONFIG.empresa.instagram || '', rx, 26, { align:'right' });
        };

        const _footer = (pgNum, total) => {
            doc.setDrawColor(66, 153, 225); doc.setLineWidth(0.4);
            doc.line(mg, ph - 18, pw - mg, ph - 18);
            doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(40,40,40);
            doc.text(CONFIG.empresa.nome || 'GiraMundoTour', mg, ph - 13);
            doc.text(`CNPJ: ${CONFIG.empresa.cnpj || ''}`, pw - mg, ph - 13, { align:'right' });
            doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(100,100,100);
            doc.text(`${CONFIG.empresa.email} | ${CONFIG.empresa.telefone} | ${CONFIG.empresa.telefone2}`, pw/2, ph - 8, { align:'center' });
            doc.text(`Página ${pgNum} / ${total}`, pw - mg, ph - 8, { align:'right' });
        };

        const _checkPage = (needed) => {
            if (y + needed > ph - 25) {
                doc.addPage();
                _header();
                y = 55;
            }
        };

        // ─────────────────────────────────────────────────────────────
        _header();
        y = 52;

        // ── Título da proposta ──
        doc.setFillColor(232, 244, 255);
        doc.roundedRect(mg, y, cw, 24, 2, 2, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(26, 54, 93);
        doc.text('PROPOSTA DE PACOTE TURISTICO', pw/2, y + 9, { align:'center' });
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(80,80,80);
        const dataEmissao = p.createdAt ? this._fmtData(p.createdAt) : this._fmtData(new Date().toISOString());
        const codigo = p.id !== 'preview' ? `#${p.id.slice(0,8).toUpperCase()}` : '#PREVIA';
        const validadeStr = p.validade ? '   |   Valido ate: ' + this._fmtData(p.validade) : '';
        doc.text(`Emissao: ${dataEmissao}   |   Codigo: ${codigo}${validadeStr}`, pw/2, y + 18, { align:'center' });
        y += 30;

        // ── Destino / Viagem ──
        doc.setFillColor(26, 54, 93);
        doc.roundedRect(mg, y, cw, 30, 2, 2, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(255,255,255);
        const destinoFit = doc.splitTextToSize(p.destino || '', cw - 60);
        doc.text(destinoFit[0] || '', mg + 8, y + 13);
        // Datas no canto direito (mesma linha do destino)
        const dPar = p.dataPartida ? this._fmtData(p.dataPartida) : '-';
        const dRet = p.dataRetorno ? this._fmtData(p.dataRetorno) : '-';
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(200,230,255);
        doc.text(`Período: ${dPar} a ${dRet}`, pw - mg - 4, y + 13, { align:'right' });
        // Segunda linha: nomeViagem + pax
        if (p.nomeViagem) {
            doc.setFont('helvetica','italic'); doc.setFontSize(10); doc.setTextColor(200,225,255);
            doc.text(p.nomeViagem, mg + 8, y + 24);
        }
        const pax = (+p.adultos||1) + (+p.criancas||0) + (+p.bebes||0);
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(200,230,255);
        doc.text(`${pax} passageiro${pax>1?'s':''}`, pw - mg - 4, y + 24, { align:'right' });
        y += 36;

        // ── Dados do cliente ──
        if (p.clienteNome || p.clienteEmail || p.clienteTelefone) {
            _checkPage(22);
            doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(26, 54, 93);
            doc.text('CLIENTE', mg, y + 5);
            doc.setDrawColor(26, 54, 93); doc.setLineWidth(0.3);
            doc.line(mg + 18, y + 3, pw - mg, y + 3);
            y += 8;
            doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(40,40,40);
            if (p.clienteNome)     { doc.text(`Nome: ${p.clienteNome}`,           mg, y);      y += 5.5; }
            if (p.clienteEmail)    { doc.text(`E-mail: ${p.clienteEmail}`,        mg, y);      y += 5.5; }
            if (p.clienteTelefone) { doc.text(`Telefone: ${p.clienteTelefone}`,   mg, y);      y += 5.5; }
            y += 4;
        }

        // ── Passageiros ──
        _checkPage(14);
        const linhasPax = [];
        if (+p.adultos  > 0) linhasPax.push(`${p.adultos} adulto${p.adultos>1?'s':''}`);
        if (+p.criancas > 0) linhasPax.push(`${p.criancas} criança${p.criancas>1?'s':''}`);
        if (+p.bebes    > 0) linhasPax.push(`${p.bebes} bebê${p.bebes>1?'s':''}`);
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(26, 54, 93);
        doc.text('COMPOSIÇÃO', mg, y + 5);
        doc.line(mg + 32, y + 3, pw - mg, y + 3);
        y += 8;
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(40,40,40);
        doc.text(linhasPax.join('  |  '), mg, y); y += 8;

        // ── Serviços ──
        const servicos = Array.isArray(p.servicos) ? p.servicos : [];
        if (servicos.length) {
            _checkPage(16);
            doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(26, 54, 93);
            doc.text('SERVIÇOS INCLUSOS', mg, y + 5);
            doc.line(mg + 44, y + 3, pw - mg, y + 3);
            y += 10;

            // Cabeçalho da tabela
            // total fixo: tipo(18) + forn(28) + dtI(24) + dtF(24) + total(26) = 120 → desc = cw-120
            const cols = { tipo:18, desc: cw - 120, forn:28, dtI:24, dtF:24, total:26 };
            doc.setFillColor(26, 54, 93);
            doc.rect(mg, y, cw, 7, 'F');
            doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(255,255,255);
            let cx = mg + 2;
            doc.text('Tipo',       cx, y + 5); cx += cols.tipo;
            doc.text('Descrição',  cx, y + 5); cx += cols.desc;
            doc.text('Fornecedor', cx, y + 5); cx += cols.forn;
            doc.text('Início',     cx, y + 5); cx += cols.dtI;
            doc.text('Fim',        cx, y + 5); cx += cols.dtF;
            doc.text('Total',      mg + cw - 2, y + 5, { align:'right' });
            y += 7;

            let rowBg = false;
            for (const s of servicos) {
                const rowH = 7;
                _checkPage(rowH + 2);
                if (rowBg) { doc.setFillColor(245, 248, 255); doc.rect(mg, y, cw, rowH, 'F'); }
                rowBg = !rowBg;

                const tInfo = this.TIPOS.find(t => t.value === s.tipo) || { label: s.tipo };
                doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(40,40,40);
                cx = mg + 2;

                // Tipo
                doc.text((tInfo.label||'').substring(0,9), cx, y + 5); cx += cols.tipo;

                // Descrição — clipa para caber na coluna. Hotel inclui diárias e tipo de apto.
                let descTxt = s.descricao || '';
                if (s.tipo === 'hotel') {
                    const extras = [];
                    if (+s.diarias > 0) extras.push(`${+s.diarias} diária${+s.diarias > 1 ? 's' : ''}`);
                    if (+s.quartos > 0) extras.push(`${+s.quartos} quarto${+s.quartos > 1 ? 's' : ''}`);
                    if (+s.pessoas > 0) extras.push(`${+s.pessoas} pax`);
                    if (s.tipoApto)     extras.push(this._labelApto(s.tipoApto));
                    if (extras.length)  descTxt = (descTxt ? descTxt + ' — ' : '') + extras.join(', ');
                }
                const descFit = doc.splitTextToSize(descTxt, cols.desc - 2);
                doc.text(descFit[0] || '', cx, y + 5); cx += cols.desc;

                // Fornecedor — clipa
                const fornFit = doc.splitTextToSize(s.fornecedor||'', cols.forn - 2);
                doc.text(fornFit[0] || '', cx, y + 5); cx += cols.forn;

                // Datas no formato dd/mm/aa para economizar espaço
                const fmtCurta = (d) => {
                    if (!d) return '—';
                    const iso = (d instanceof Date) ? d.toISOString() : String(d);
                    const s2 = iso.slice(0, 10).split('-');
                    return (s2.length === 3 && s2[0].length === 4) ? `${s2[2]}/${s2[1]}/${s2[0].slice(2)}` : '—';
                };
                doc.text(fmtCurta(s.dataInicio), cx, y + 5); cx += cols.dtI;
                doc.text(fmtCurta(s.dataFim),    cx, y + 5); cx += cols.dtF;

                doc.setFont('helvetica','bold');
                doc.text(this._fmtMoeda(+s.valorTotal||0), mg + cw - 2, y + 5, { align:'right' });

                // Linha separadora
                doc.setDrawColor(210,220,240); doc.setLineWidth(0.2);
                doc.line(mg, y + rowH, mg + cw, y + rowH);
                y += rowH;
            }
            y += 6;

            // ── Galeria de imagens ──
            const comImagem = servicos.filter(s => s.imagem);
            if (comImagem.length) {
                _checkPage(20);
                doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(26, 54, 93);
                doc.text('FOTOS DO PACOTE', mg, y + 5);
                doc.setDrawColor(26, 54, 93); doc.setLineWidth(0.3);
                doc.line(mg + 40, y + 3, pw - mg, y + 3);
                y += 10;

                const imgW = (cw - 6) / 2;   // 2 colunas com gap
                const imgH = imgW * 0.62;      // proporção ~16:10

                let col = 0;
                for (const s of comImagem) {
                    _checkPage(imgH + 14);
                    const x = mg + col * (imgW + 6);

                    // Sombra / borda
                    doc.setFillColor(220, 230, 245);
                    doc.roundedRect(x + 1, y + 1, imgW, imgH + 10, 3, 3, 'F');
                    doc.setFillColor(255, 255, 255);
                    doc.roundedRect(x, y, imgW, imgH + 10, 3, 3, 'F');

                    try {
                        doc.addImage(s.imagem, x, y, imgW, imgH);
                    } catch (_) {}

                    // Legenda
                    const tInfo = this.TIPOS.find(t => t.value === s.tipo) || { label: s.tipo };
                    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(40, 40, 40);
                    const legenda = `${tInfo.label}${s.descricao ? ' — ' + s.descricao.substring(0, 28) : ''}`;
                    doc.text(legenda, x + 3, y + imgH + 7);

                    col++;
                    if (col === 2) { col = 0; y += imgH + 14; }
                }
                if (col === 1) y += imgH + 14;
                y += 4;
            }
        }

        // ── Resumo de valores ──
        _checkPage(42);
        const bW = 80; const bX = pw - mg - bW;

        doc.setFillColor(240, 247, 255);
        doc.roundedRect(bX, y, bW, p.markup > 0 ? 28 : 18, 2, 2, 'F');
        doc.setDrawColor(26, 54, 93); doc.setLineWidth(0.3);
        doc.roundedRect(bX, y, bW, p.markup > 0 ? 28 : 18, 2, 2, 'S');

        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(60,60,60);
        let by = y + 7;
        doc.text('Subtotal:', bX + 4, by);
        doc.text(this._fmtMoeda(+p.subtotal||0), bX + bW - 4, by, { align:'right' });

        if (p.markup > 0) {
            by += 6;
            doc.text(`Markup (${p.markup}%):`, bX + 4, by);
            doc.text(this._fmtMoeda((+p.subtotal||0) * (+p.markup||0) / 100), bX + bW - 4, by, { align:'right' });
        }

        by += 6;
        doc.setFillColor(26, 54, 93);
        doc.roundedRect(bX, by - 4, bW, 10, 2, 2, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(255,255,255);
        doc.text('TOTAL:', bX + 4, by + 3);
        doc.text(this._fmtMoeda(+p.total||0), bX + bW - 4, by + 3, { align:'right' });
        y = by + 14;

        // ── Status ──
        const stInfo = this.STATUS[p.status] || { label: p.status || 'Orçamento' };
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(100,100,100);
        doc.text(`Status: ${stInfo.label}${p.solicitante ? '   |   Responsável: ' + p.solicitante : ''}`, mg, y); y += 8;

        // ── Observações ──
        if (p.observacoes) {
            _checkPage(20);
            doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(26,54,93);
            doc.text('OBSERVAÇÕES', mg, y + 5);
            doc.setDrawColor(26,54,93); doc.setLineWidth(0.3);
            doc.line(mg + 32, y + 3, pw - mg, y + 3);
            y += 10;
            doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(60,60,60);
            const linhas = doc.splitTextToSize(p.observacoes, cw);
            linhas.forEach(l => {
                _checkPage(6);
                doc.text(l, mg, y); y += 5.5;
            });
        }

        // ── Footers em todas as páginas ──
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            _footer(i, totalPages);
        }

        const nome = (p.nomeViagem || p.destino || 'pacote').replace(/\s+/g,'-').toLowerCase();
        doc.save(`pacote-${nome}-${dataEmissao.replace(/\//g,'-')}.pdf`);
    },

    // ── Utilitários ──────────────────────────────────────────────────

    _mascaraMoeda(el) {
        let digits = el.value.replace(/\D/g, '');
        if (!digits) { el.value = ''; return; }
        const num = parseInt(digits, 10) / 100;
        el.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    _parseMoeda(v) {
        if (typeof v === 'number') return v;
        return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
    },

    _fmtInput(v) {
        return (+v||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    _fmtMoeda(v) {
        return (+v||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
    },

    _fmtData(d) {
        if (!d) return '';
        const iso = (d instanceof Date) ? d.toISOString() : String(d);
        const s = iso.slice(0, 10);
        const [y, m, dd] = s.split('-');
        return (y && m && dd && y.length === 4) ? `${dd}/${m}/${y}` : s;
    },

    _calcDiarias(dtI, dtF) {
        if (!dtI || !dtF) return 0;
        const a = new Date(String(dtI).slice(0, 10) + 'T12:00:00');
        const b = new Date(String(dtF).slice(0, 10) + 'T12:00:00');
        const diff = Math.round((b - a) / 86400000);
        return diff > 0 ? diff : 0;
    },

    _labelApto(v) {
        return {
            single:    'Apto Single',
            duplo:     'Apto Duplo',
            triplo:    'Apto Triplo',
            quadruplo: 'Apto Quádruplo',
            quintuplo: 'Apto Quíntuplo',
        }[v] || v || '';
    },
};

window.PacotesModule = PacotesModule;
