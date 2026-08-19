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

    // Sugestões clicáveis para o campo Características do quarto (hotel)
    CARACTERISTICAS_HOTEL: [
        'Café da manhã incluso', 'Ar-condicionado', 'Wi-Fi grátis', 'Frigobar',
        'TV a cabo', 'Vista para o mar', 'Varanda', 'Banheira', 'Cofre',
        'Cama king size', 'Camas separadas', 'Berço disponível',
        'All inclusive', 'Meia pensão', 'Café da manhã não incluso',
    ],

    MAX_IMAGENS: 8,   // por serviço

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
                    <div class="card-body bg-body-tertiary" id="listaServicos"></div>
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
                            <button class="btn btn-sm btn-outline-info" title="Duplicar orçamento"
                                    onclick="PacotesModule.duplicar('${p.id}')">
                                <i class="bi bi-copy"></i>
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

    // Duplicar: carrega o pacote de origem no formulário como um NOVO pacote.
    // Nada é gravado até o usuário clicar em Salvar — evita registro órfão se ele desistir.
    duplicar(id) {
        return this.abrirModal(id, { duplicar: true });
    },

    async abrirModal(id, opts = {}) {
        const duplicando = !!opts.duplicar;
        this._editandoId = duplicando ? null : (id || null);
        this._servicos   = [];

        const titulo = document.getElementById('modalPacoteTitulo');
        if (titulo) titulo.innerHTML = duplicando
            ? '<i class="bi bi-copy me-2"></i>Duplicar Pacote'
            : id
                ? '<i class="bi bi-pencil-square me-2"></i>Editar Pacote'
                : '<i class="bi bi-suitcase-lg me-2"></i>Novo Pacote de Viagem';

        // Resetar form
        this._limparForm();

        if (id) {
            try {
                const resp = await apiCall(`/api/pacotes/${id}`);
                if (!resp || !resp.ok) {
                    App.showToast('Erro ao carregar o pacote', 'danger');
                    return;
                }
                const { data } = await resp.json();
                this._preencherForm(data);
            } catch (e) {
                console.error(e);
                App.showToast('Erro ao carregar o pacote', 'danger');
                return;
            }
        }

        // Novo pacote ou cópia: a proposta nasce como orçamento com validade padrão de 5 dias
        if (!id || duplicando) {
            const set = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v; };
            set('fValidade', this._dataLocalISO(5));
            if (duplicando) set('fStatus', 'orcamento');
        }

        this._renderizarServicos();
        this._recalcular();

        const modal = new bootstrap.Modal(document.getElementById('modalPacote'));
        modal.show();
    },

    // Data local no formato YYYY-MM-DD. Não usar toISOString(): em UTC-3, depois
    // das 21h ele devolve o dia seguinte.
    _dataLocalISO(offsetDias = 0) {
        const d = new Date();
        if (offsetDias) d.setDate(d.getDate() + offsetDias);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
        this._servicos = servicos.map(s => this._normalizarServico(s));
    },

    // Pacotes antigos guardavam uma única foto em `imagem` e não tinham
    // `caracteristicas`. Converte para o formato atual ao carregar.
    _normalizarServico(s) {
        const n = { ...s };
        if (!Array.isArray(n.imagens)) n.imagens = n.imagem ? [n.imagem] : [];
        delete n.imagem;
        if (typeof n.caracteristicas !== 'string') n.caracteristicas = '';
        return n;
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
            const carac = v(`svc_carac_${i}`);
            if (carac !== undefined) s.caracteristicas = carac;
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
            valorUnit: 0, valorTotal: 0, obs: '',
            caracteristicas: '', imagens: [],
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

        // Só mexe nos valores quando o campo alterado entra na conta. Antes, digitar
        // na descrição já recalculava o total e apagava um valor definido à mão.
        const afetaValor = ['quantidade','valorUnit','valorTotal','diarias','quartos','dataInicio','dataFim','tipo'];
        if (afetaValor.includes(campo)) {
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
            const badge = document.getElementById(`svc_badge_${idx}`);
            if (badge) badge.textContent = this._fmtMoeda(+s.valorTotal || 0);
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
        const box = document.getElementById('listaServicos');
        if (!box) return;

        if (!this._servicos.length) {
            box.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-plus-circle me-2"></i>Clique em um tipo acima para adicionar serviços
                </div>`;
            return;
        }

        box.innerHTML = this._servicos.map((s, i) => this._htmlCardServico(s, i)).join('');
    },

    _htmlCardServico(s, i) {
        const tipo    = this.TIPOS.find(t => t.value === s.tipo) || this.TIPOS[5];
        const ehHotel = s.tipo === 'hotel';
        const esc     = v => this._esc(v);
        const imagens = Array.isArray(s.imagens) ? s.imagens : [];

        // Características já marcadas — usado para destacar as sugestões ativas
        const marcadas = (s.caracteristicas || '').split('\n').map(l => l.trim().toLowerCase()).filter(Boolean);

        return `
        <div class="card mb-3 shadow-sm border-0" style="border-left:4px solid ${tipo.cor} !important">
            <!-- Cabeçalho: tipo + descrição + total + remover -->
            <div class="card-header bg-white d-flex align-items-center gap-2 py-2 flex-wrap">
                <i class="bi ${tipo.icon} fs-5" style="color:${tipo.cor}"></i>
                <select id="svc_tipo_${i}" class="form-select form-select-sm" style="width:120px"
                        onchange="PacotesModule._onServicoChange(${i},'tipo',this.value)">
                    ${this.TIPOS.map(t => `<option value="${t.value}" ${s.tipo===t.value?'selected':''}>${t.label}</option>`).join('')}
                </select>
                <input type="text" id="svc_desc_${i}" class="form-control form-control-sm flex-grow-1"
                       style="min-width:200px" value="${esc(s.descricao)}"
                       placeholder="${ehHotel ? 'Nome do hotel' : 'Descrição do serviço'}"
                       oninput="PacotesModule._onServicoChange(${i},'descricao',this.value)">
                <span class="badge bg-primary bg-opacity-10 text-primary fw-semibold"
                      id="svc_badge_${i}">${this._fmtMoeda(+s.valorTotal||0)}</span>
                <button class="btn btn-sm btn-outline-danger" title="Remover serviço"
                        onclick="PacotesModule.removerServico(${i})">
                    <i class="bi bi-trash"></i>
                </button>
            </div>

            <div class="card-body row g-3">
                <!-- Fornecedor e datas -->
                <div class="col-md-4">
                    <label class="form-label small text-muted mb-1">Fornecedor</label>
                    <input type="text" id="svc_forn_${i}" class="form-control form-control-sm"
                           value="${esc(s.fornecedor)}" placeholder="Operadora, hotel, receptivo..."
                           oninput="PacotesModule._onServicoChange(${i},'fornecedor',this.value)">
                </div>
                <div class="col-md-2 col-6">
                    <label class="form-label small text-muted mb-1">${ehHotel ? 'Check-in' : 'Início'}</label>
                    <input type="date" id="svc_dtI_${i}" class="form-control form-control-sm" value="${esc(s.dataInicio).slice(0,10)}"
                           onchange="PacotesModule._onServicoChange(${i},'dataInicio',this.value)">
                </div>
                <div class="col-md-2 col-6">
                    <label class="form-label small text-muted mb-1">${ehHotel ? 'Check-out' : 'Fim'}</label>
                    <input type="date" id="svc_dtF_${i}" class="form-control form-control-sm" value="${esc(s.dataFim).slice(0,10)}"
                           onchange="PacotesModule._onServicoChange(${i},'dataFim',this.value)">
                </div>
                <div class="col-md-2 col-6">
                    <label class="form-label small text-muted mb-1">${ehHotel ? 'Valor da diária' : 'Valor unitário'}</label>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text px-1">R$</span>
                        <input type="text" id="svc_vUnit_${i}" class="form-control text-end" inputmode="numeric"
                               value="${this._fmtInput(+s.valorUnit||0)}"
                               oninput="PacotesModule._mascaraMoeda(this)"
                               onblur="PacotesModule._onServicoChange(${i},'valorUnit',this.value)">
                    </div>
                </div>
                <div class="col-md-2 col-6">
                    <label class="form-label small text-muted mb-1">Total</label>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text px-1">R$</span>
                        <input type="text" id="svc_valorTotal_${i}" class="form-control text-end fw-semibold"
                               inputmode="numeric" value="${this._fmtInput(+s.valorTotal||0)}"
                               oninput="PacotesModule._mascaraMoeda(this)"
                               onblur="PacotesModule._onServicoChange(${i},'valorTotal',this.value)">
                    </div>
                </div>

                <!-- Bloco do quarto (hotel) ou quantidade (demais tipos) -->
                ${ehHotel ? `
                <div class="col-12">
                    <div class="row g-2 bg-warning bg-opacity-10 rounded p-2 mx-0">
                        <div class="col-md-2 col-6">
                            <label class="form-label small text-muted mb-1">
                                <i class="bi bi-moon-stars me-1"></i>Diárias
                            </label>
                            <input type="number" id="svc_diarias_${i}" class="form-control form-control-sm text-center"
                                   min="0" value="${s.diarias||''}"
                                   onchange="PacotesModule._onServicoChange(${i},'diarias',this.value)">
                        </div>
                        <div class="col-md-2 col-6">
                            <label class="form-label small text-muted mb-1">
                                <i class="bi bi-door-closed me-1"></i>Quartos
                            </label>
                            <input type="number" id="svc_quartos_${i}" class="form-control form-control-sm text-center"
                                   min="1" value="${s.quartos||1}"
                                   onchange="PacotesModule._onServicoChange(${i},'quartos',this.value)">
                        </div>
                        <div class="col-md-2 col-6">
                            <label class="form-label small text-muted mb-1">
                                <i class="bi bi-people me-1"></i>Pessoas
                            </label>
                            <input type="number" id="svc_pessoas_${i}" class="form-control form-control-sm text-center"
                                   min="1" value="${s.pessoas||1}"
                                   onchange="PacotesModule._onServicoChange(${i},'pessoas',this.value)">
                        </div>
                        <div class="col-md-3 col-6">
                            <label class="form-label small text-muted mb-1">Tipo de apartamento</label>
                            <select id="svc_apto_${i}" class="form-select form-select-sm"
                                    onchange="PacotesModule._onServicoChange(${i},'tipoApto',this.value)">
                                ${['single','duplo','triplo','quadruplo','quintuplo'].map(a =>
                                    `<option value="${a}" ${s.tipoApto===a?'selected':''}>${this._labelApto(a)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-3 col-12 d-flex align-items-end">
                            <small class="text-muted">Total = diária × quartos × diárias</small>
                        </div>
                    </div>
                </div>` : `
                <div class="col-md-2 col-6">
                    <label class="form-label small text-muted mb-1">Quantidade</label>
                    <input type="number" id="svc_qtd_${i}" class="form-control form-control-sm text-center"
                           min="1" value="${s.quantidade||1}"
                           onchange="PacotesModule._onServicoChange(${i},'quantidade',this.value)">
                </div>`}

                <!-- Características -->
                <div class="col-12">
                    <label class="form-label small text-muted mb-1">
                        <i class="bi bi-stars me-1"></i>${ehHotel ? 'Características do quarto' : 'Detalhes / o que está incluso'}
                        <span class="ms-1">(uma por linha — sai no PDF)</span>
                    </label>
                    ${ehHotel ? `
                    <div class="d-flex flex-wrap gap-1 mb-2">
                        ${this.CARACTERISTICAS_HOTEL.map(c => {
                            const ativo = marcadas.includes(c.toLowerCase());
                            return `<button class="btn btn-sm ${ativo ? 'btn-warning' : 'btn-outline-secondary'} py-0 px-2"
                                            style="font-size:.72rem"
                                            onclick="PacotesModule._toggleCaracteristica(${i}, '${esc(c).replace(/'/g, "\\'")}')">
                                        ${ativo ? '<i class="bi bi-check2 me-1"></i>' : ''}${c}
                                    </button>`;
                        }).join('')}
                    </div>` : ''}
                    <textarea id="svc_carac_${i}" class="form-control form-control-sm" rows="3"
                              placeholder="${ehHotel
                                    ? 'Ex.:\nQuarto duplo standard com vista para o mar\nCafé da manhã incluso\nAr-condicionado e frigobar'
                                    : 'Ex.:\nTranslado privativo aeroporto / hotel\nGuia acompanhante em português'}"
                              oninput="PacotesModule._onServicoChange(${i},'caracteristicas',this.value)">${esc(s.caracteristicas)}</textarea>
                </div>

                <!-- Fotos -->
                <div class="col-12">
                    <label class="form-label small text-muted mb-1">
                        <i class="bi bi-images me-1"></i>Fotos
                        <span class="ms-1">(${imagens.length}/${this.MAX_IMAGENS})</span>
                    </label>
                    <input type="file" id="svc_img_file_${i}" accept="image/*" multiple class="d-none"
                           onchange="PacotesModule._onImagensServico(${i}, this)">
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                        ${imagens.map((img, j) => `
                            <div class="position-relative">
                                <img src="${img}" alt="Foto ${j+1}"
                                     style="width:88px;height:66px;object-fit:cover;border-radius:6px;border:1px solid #dee2e6">
                                <button class="btn btn-danger p-0 position-absolute"
                                        style="top:-6px;right:-6px;width:18px;height:18px;font-size:10px;line-height:16px;border-radius:50%"
                                        onclick="PacotesModule._removerImagem(${i},${j})" title="Remover foto">&times;</button>
                            </div>`).join('')}
                        ${imagens.length < this.MAX_IMAGENS ? `
                            <button class="btn btn-outline-secondary d-flex flex-column align-items-center justify-content-center"
                                    style="width:88px;height:66px" title="Adicionar fotos"
                                    onclick="PacotesModule._triggerUploadImagem(${i})">
                                <i class="bi bi-camera"></i>
                                <small style="font-size:.65rem">Adicionar</small>
                            </button>` : ''}
                    </div>
                </div>
            </div>
        </div>`;
    },

    // ── Características ──────────────────────────────────────────────

    _toggleCaracteristica(idx, texto) {
        const s = this._servicos[idx];
        if (!s) return;
        this._syncServicosFromDOM();   // não perde o que já foi digitado nos outros campos

        const linhas = (s.caracteristicas || '').split('\n').map(l => l.trim()).filter(Boolean);
        const alvo   = texto.toLowerCase();
        s.caracteristicas = linhas.some(l => l.toLowerCase() === alvo)
            ? linhas.filter(l => l.toLowerCase() !== alvo).join('\n')
            : [...linhas, texto].join('\n');

        this._renderizarServicos();
    },

    // ── Imagens por serviço ──────────────────────────────────────────

    _triggerUploadImagem(idx) {
        document.getElementById(`svc_img_file_${idx}`)?.click();
    },

    async _onImagensServico(idx, input) {
        const s = this._servicos[idx];
        const arquivos = Array.from(input.files || []);
        input.value = '';   // permite reescolher o mesmo arquivo depois
        if (!s || !arquivos.length) return;

        this._syncServicosFromDOM();
        if (!Array.isArray(s.imagens)) s.imagens = [];

        const espaco = this.MAX_IMAGENS - s.imagens.length;
        if (espaco <= 0) {
            App.showToast(`Máximo de ${this.MAX_IMAGENS} fotos por serviço`, 'warning');
            return;
        }
        if (arquivos.length > espaco) {
            App.showToast(`Cabem mais ${espaco} foto(s) neste serviço — as demais foram ignoradas`, 'warning');
        }

        for (const arq of arquivos.slice(0, espaco)) {
            if (!arq.type.startsWith('image/')) continue;
            try {
                s.imagens.push(await this._redimensionarImagem(arq));
            } catch (e) {
                App.showToast(`Não foi possível ler "${arq.name}"`, 'danger');
            }
        }
        this._renderizarServicos();
    },

    _removerImagem(idx, imgIdx) {
        const s = this._servicos[idx];
        if (!s || !Array.isArray(s.imagens)) return;
        this._syncServicosFromDOM();
        s.imagens.splice(imgIdx, 1);
        this._renderizarServicos();
    },

    // As fotos vão em base64 dentro do JSONB do pacote, então uma imagem de 4MB
    // vinda do celular viraria ~5,5MB no banco. Reduz antes de guardar.
    _redimensionarImagem(file, maxLado = 1280, qualidade = 0.75) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('falha ao ler o arquivo'));
            reader.onload  = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('formato de imagem inválido'));
                img.onload  = () => {
                    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
                    const w = Math.round(img.width  * escala);
                    const h = Math.round(img.height * escala);
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    // Fundo branco: PNG com transparência viraria preto no JPEG
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', qualidade));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
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

        // Cabeçalho idêntico ao relatório de Cotação (ReportModule.gerarCotacaoPDF)
        const _header = () => {
            const primaryColor = [26, 54, 93];

            // Fundo do cabeçalho
            doc.setFillColor(...primaryColor);
            doc.rect(0, 0, pw, 45, 'F');

            // Logomarca com fundo branco arredondado para contraste
            if (logoB64) {
                try {
                    doc.setFillColor(255, 255, 255);
                    doc.roundedRect(mg + 1, 6, 33, 33, 4, 4, 'F');
                    doc.addImage(logoB64, 'PNG', mg + 2, 7, 31, 31);
                } catch (e) { console.warn('Erro ao adicionar logo no PDF:', e); }
            }

            // Nome da empresa
            const textoX = logoB64 ? mg + 40 : mg;
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text('GiraMundoTour', textoX, 25);

            // Slogan
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(CONFIG.empresa.slogan, textoX, 33);

            // Dados da empresa (direita) com ícones de WhatsApp / Instagram
            const contactX = pw - mg;
            let contactY = 12;
            const iconSize = 4;
            const wppIcon = ReportModule._gerarIconeWhatsApp();
            const igIcon  = ReportModule._gerarIconeInstagram();

            // Email
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(255, 255, 255);
            doc.text(CONFIG.empresa.email, contactX, contactY, { align: 'right' });
            contactY += 5.5;

            // WhatsApp telefone 1
            const tel1Text  = CONFIG.empresa.telefone;
            const tel1Width = doc.getTextWidth(tel1Text);
            doc.text(tel1Text, contactX, contactY, { align: 'right' });
            try { doc.addImage(wppIcon, 'PNG', contactX - tel1Width - iconSize - 1.5, contactY - iconSize + 0.8, iconSize, iconSize); } catch(e) {}
            contactY += 4.5;

            // WhatsApp telefone 2
            const tel2Text  = CONFIG.empresa.telefone2;
            const tel2Width = doc.getTextWidth(tel2Text);
            doc.setTextColor(255, 255, 255);
            doc.text(tel2Text, contactX, contactY, { align: 'right' });
            try { doc.addImage(wppIcon, 'PNG', contactX - tel2Width - iconSize - 1.5, contactY - iconSize + 0.8, iconSize, iconSize); } catch(e) {}
            contactY += 5.5;

            // Instagram
            const igText  = CONFIG.empresa.instagram;
            const igWidth = doc.getTextWidth(igText);
            doc.setTextColor(255, 255, 255);
            doc.text(igText, contactX, contactY, { align: 'right' });
            try { doc.addImage(igIcon, 'PNG', contactX - igWidth - iconSize - 1.5, contactY - iconSize + 0.8, iconSize, iconSize); } catch(e) {}
        };

        // Rodapé idêntico ao relatório de Cotação
        const _footer = () => {
            const primaryLight = [66, 153, 225];
            const footerY = ph - 20;
            doc.setDrawColor(...primaryLight);
            doc.setLineWidth(0.5);
            doc.line(mg, footerY, pw - mg, footerY);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(60, 60, 60);
            doc.text(CONFIG.empresa.nome, mg, footerY + 5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text('CNPJ: ' + CONFIG.empresa.cnpj, pw - mg, footerY + 5, { align: 'right' });

            const footerContatos = CONFIG.empresa.email + '  |  ' + CONFIG.empresa.telefone + '  |  ' + CONFIG.empresa.telefone2 + '  |  ' + CONFIG.empresa.instagram;
            doc.setFontSize(7);
            doc.text(footerContatos, pw / 2, footerY + 10, { align: 'center' });
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
        doc.roundedRect(mg, y, cw, 20, 2, 2, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(26, 54, 93);
        doc.text('PROPOSTA DE PACOTE TURISTICO', pw/2, y + 8, { align:'center' });
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(80,80,80);
        const dataEmissao = this._fmtData(this._dataLocalISO());
        const codigo = p.id !== 'preview' ? `#${p.id.slice(0,8).toUpperCase()}` : '#PREVIA';
        // Validade: sempre a data atual (mesmo padrao do relatorio de Cotacao)
        const validadeStr = '   |   Valido ate: ' + this._fmtData(this._dataLocalISO());
        doc.text(`Emissao: ${dataEmissao}   |   Codigo: ${codigo}${validadeStr}`, pw/2, y + 15, { align:'center' });
        y += 25;

        // ── Destino / Viagem ──
        doc.setFillColor(26, 54, 93);
        doc.roundedRect(mg, y, cw, 26, 2, 2, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor(255,255,255);
        const destinoFit = doc.splitTextToSize(p.destino || '', cw - 60);
        doc.text(destinoFit[0] || '', mg + 8, y + 11);
        // Datas no canto direito (mesma linha do destino)
        const dPar = p.dataPartida ? this._fmtData(p.dataPartida) : '-';
        const dRet = p.dataRetorno ? this._fmtData(p.dataRetorno) : '-';
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(200,230,255);
        doc.text(`Período: ${dPar} a ${dRet}`, pw - mg - 4, y + 11, { align:'right' });
        // Segunda linha: nomeViagem + pax
        if (p.nomeViagem) {
            doc.setFont('helvetica','italic'); doc.setFontSize(9.5); doc.setTextColor(200,225,255);
            doc.text(p.nomeViagem, mg + 8, y + 21);
        }
        const pax = (+p.adultos||1) + (+p.criancas||0) + (+p.bebes||0);
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(200,230,255);
        doc.text(`${pax} passageiro${pax>1?'s':''}`, pw - mg - 4, y + 21, { align:'right' });
        y += 32;

        // ── Dados do cliente ──
        if (p.clienteNome || p.clienteEmail || p.clienteTelefone) {
            _checkPage(20);
            doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(26, 54, 93);
            doc.text('CLIENTE', mg, y + 5);
            doc.setDrawColor(26, 54, 93); doc.setLineWidth(0.3);
            doc.line(mg + 18, y + 3, pw - mg, y + 3);
            y += 7.5;
            doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(40,40,40);
            if (p.clienteNome)     { doc.text(`Nome: ${p.clienteNome}`,           mg, y);      y += 5; }
            if (p.clienteEmail)    { doc.text(`E-mail: ${p.clienteEmail}`,        mg, y);      y += 5; }
            if (p.clienteTelefone) { doc.text(`Telefone: ${p.clienteTelefone}`,   mg, y);      y += 5; }
            y += 2.5;
        }

        // ── Passageiros ──
        _checkPage(12);
        const linhasPax = [];
        if (+p.adultos  > 0) linhasPax.push(`${p.adultos} adulto${p.adultos>1?'s':''}`);
        if (+p.criancas > 0) linhasPax.push(`${p.criancas} criança${p.criancas>1?'s':''}`);
        if (+p.bebes    > 0) linhasPax.push(`${p.bebes} bebê${p.bebes>1?'s':''}`);
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(26, 54, 93);
        doc.text('COMPOSIÇÃO', mg, y + 5);
        doc.line(mg + 32, y + 3, pw - mg, y + 3);
        y += 7.5;
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(40,40,40);
        doc.text(linhasPax.join('  |  '), mg, y); y += 6;

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

            // Datas no formato dd/mm/yyyy
            const fmtCurta = (d) => {
                if (!d) return '—';
                const iso = (d instanceof Date) ? d.toISOString() : String(d);
                const s2 = iso.slice(0, 10).split('-');
                return (s2.length === 3 && s2[0].length === 4) ? `${s2[2]}/${s2[1]}/${s2[0]}` : '—';
            };

            let rowBg = false;
            for (const s of servicos) {
                const tInfo = this.TIPOS.find(t => t.value === s.tipo) || { label: s.tipo };

                // Descrição. Hotel inclui diárias, quartos, pax e tipo de apto.
                let descTxt = s.descricao || '';
                if (s.tipo === 'hotel') {
                    const extras = [];
                    if (+s.diarias > 0) extras.push(`${+s.diarias} diária${+s.diarias > 1 ? 's' : ''}`);
                    if (+s.quartos > 0) extras.push(`${+s.quartos} quarto${+s.quartos > 1 ? 's' : ''}`);
                    if (+s.pessoas > 0) extras.push(`${+s.pessoas} pax`);
                    if (s.tipoApto)     extras.push(this._labelApto(s.tipoApto));
                    if (extras.length)  descTxt = (descTxt ? descTxt + ' — ' : '') + extras.join(', ');
                }

                // A linha cresce conforme descrição, características e fornecedor quebram
                const descLinhas = doc.splitTextToSize(descTxt || '—', cols.desc - 2);
                const caracItens  = (s.caracteristicas || '').split('\n').map(l => l.trim()).filter(Boolean);
                const caracLinhas = caracItens.length
                    ? doc.splitTextToSize(caracItens.join('   •   '), cols.desc - 3)
                    : [];
                const fornLinhas = doc.splitTextToSize(s.fornecedor || '—', cols.forn - 2);

                const linhasColDesc = descLinhas.length + caracLinhas.length;
                const rowH = Math.max(7, 3 + Math.max(linhasColDesc, fornLinhas.length) * 4);
                _checkPage(rowH + 2);

                if (rowBg) { doc.setFillColor(245, 248, 255); doc.rect(mg, y, cw, rowH, 'F'); }
                rowBg = !rowBg;

                doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(40,40,40);
                cx = mg + 2;

                // Tipo
                doc.text((tInfo.label||'').substring(0,9), cx, y + 5); cx += cols.tipo;

                // Descrição, seguida das características alinhadas na horizontal
                let ty = y + 5;
                descLinhas.forEach(l => { doc.text(l, cx, ty); ty += 4; });
                if (caracLinhas.length) {
                    doc.setFontSize(7); doc.setTextColor(95, 105, 120);
                    caracLinhas.forEach(l => { doc.text(l, cx, ty); ty += 4; });
                    doc.setFontSize(8); doc.setTextColor(40,40,40);
                }
                cx += cols.desc;

                // Fornecedor — quebra linha em vez de cortar
                let fy = y + 5;
                fornLinhas.forEach(l => { doc.text(l, cx, fy); fy += 4; });
                cx += cols.forn;

                doc.text(fmtCurta(s.dataInicio), cx, y + 5); cx += cols.dtI;
                doc.text(fmtCurta(s.dataFim),    cx, y + 5); cx += cols.dtF;

                doc.setFont('helvetica','bold');
                doc.text(this._fmtMoeda(+s.valorTotal||0), mg + cw - 2, y + 5, { align:'right' });

                // Linha separadora
                doc.setDrawColor(210,220,240); doc.setLineWidth(0.2);
                doc.line(mg, y + rowH, mg + cw, y + rowH);
                y += rowH;
            }
            y += 4;
        }

        // ── Resumo de valores ──
        _checkPage((p.markup > 0 ? 28 : 18) + 4);
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

        // ── Fotos por serviço ──
        // Cada serviço pode ter várias fotos; `imagem` é o formato antigo.
        const servicosComFotos = servicos
            .map(s => ({ servico: s, lista: Array.isArray(s.imagens) ? s.imagens : (s.imagem ? [s.imagem] : []) }))
            .filter(sf => sf.lista.length);

        if (servicosComFotos.length) {
            const gap  = 6;
            const pad  = 2.5;
            const cardW = (cw - gap) / 2;   // 2 colunas com gap
            const imgW  = cardW - pad * 2;
            const imgH  = imgW * 0.62;        // proporção ~16:10
            const cardH = imgH + pad * 2;

            for (const { servico, lista } of servicosComFotos) {
                _checkPage(cardH + 12);

                const tInfo = this.TIPOS.find(t => t.value === servico.tipo) || { label: servico.tipo };
                const titulo = `${tInfo.label}${servico.descricao ? ' — ' + servico.descricao.substring(0, 45) : ''}`;

                doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(26, 54, 93);
                doc.text(titulo.toUpperCase(), mg, y + 4);
                doc.setDrawColor(26, 54, 93); doc.setLineWidth(0.25);
                doc.line(mg, y + 6.5, mg + cw, y + 6.5);
                y += 11;

                let col = 0;
                for (const img of lista) {
                    _checkPage(cardH + 6);
                    const x = mg + col * (cardW + gap);

                    // Sombra / moldura
                    doc.setFillColor(220, 230, 245);
                    doc.roundedRect(x + 1, y + 1, cardW, cardH, 2.5, 2.5, 'F');
                    doc.setFillColor(255, 255, 255);
                    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'F');
                    doc.setDrawColor(210, 220, 240); doc.setLineWidth(0.2);
                    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'S');

                    try {
                        doc.addImage(img, x + pad, y + pad, imgW, imgH);
                    } catch (_) {}

                    col++;
                    if (col === 2) { col = 0; y += cardH + gap; }
                }
                if (col === 1) y += cardH + gap;
                y += 5;
            }
        }

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
            _footer();
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

    // Escapa texto do usuário antes de interpolar em atributos/HTML — sem isso
    // uma descrição com aspas quebra o value="" do input.
    _esc(v) {
        return String(v ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
