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

            <!-- Descrição / apresentação da proposta -->
            <div class="col-12">
                <div class="card border-info">
                    <div class="card-header bg-info bg-opacity-10 d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <span class="fw-semibold"><i class="bi bi-file-text me-2"></i>Descrição da Proposta
                            <small class="text-muted fw-normal ms-1">(texto de apresentação no topo do PDF)</small></span>
                        <button class="btn btn-sm btn-outline-info" type="button"
                                title="Monta o texto com cliente, destino, datas, passageiros e serviços já preenchidos"
                                onclick="PacotesModule.gerarDescricaoPadrao()">
                            <i class="bi bi-magic me-1"></i>Gerar texto padrão
                        </button>
                    </div>
                    <div class="card-body">
                        <textarea id="fDescricao" class="form-control" rows="6"
                                  placeholder="Prezado(a) Senhor(a),&#10;&#10;Em atendimento à solicitação de cotação datada de ..., segue proposta para ..."></textarea>
                        <small class="text-muted">Preencha os serviços antes de gerar o texto padrão. Depois é só ajustar (ex.: nº do credenciamento/processo, A/C do responsável).</small>
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
         'fAdultos','fCriancas','fBebes','fObservacoes','fSolicitante','fDescricao',
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
        set('fDescricao',       p.descricao    || '');

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
            descricao:       document.getElementById('fDescricao')?.value?.trim() || null,
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

    // ── Descrição padrão da proposta ─────────────────────────────────

    // Monta a carta de apresentação a partir do que já está no formulário
    // (cliente, destino, datas, passageiros e serviços). Pede confirmação
    // antes de sobrescrever um texto já digitado.
    gerarDescricaoPadrao() {
        const campo = document.getElementById('fDescricao');
        if (!campo) return;
        const aplicar = () => { campo.value = this._montarDescricaoPadrao(); };
        if (campo.value.trim()) {
            App.showConfirm('Substituir descrição', 'O texto atual da descrição será substituído pelo texto padrão.', aplicar);
        } else {
            aplicar();
        }
    },

    _montarDescricaoPadrao() {
        this._syncServicosFromDOM();
        const v = id => (document.getElementById(id)?.value || '').trim();
        const EXTENSO = ['zero','uma','duas','três','quatro','cinco','seis','sete','oito','nove','dez'];
        const qtd = n => `${String(n).padStart(2, '0')}${EXTENSO[n] ? ` (${EXTENSO[n]})` : ''} ${n === 1 ? 'pessoa' : 'pessoas'}`;
        const juntar = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : (l[0] || '');

        const adultos = +v('fAdultos') || 0, criancas = +v('fCriancas') || 0, bebes = +v('fBebes') || 0;
        const total = adultos + criancas + bebes || 1;
        const comp = [];
        if (adultos)  comp.push(`${adultos} ${adultos === 1 ? 'adulto' : 'adultos'}`);
        if (criancas) comp.push(`${criancas} ${criancas === 1 ? 'criança' : 'crianças'}`);
        if (bebes)    comp.push(`${bebes} ${bebes === 1 ? 'bebê' : 'bebês'}`);
        const pessoas = qtd(total) + (criancas || bebes ? ` (${juntar(comp)})` : '');

        // O que a proposta contempla, a partir dos serviços cadastrados
        const por = t => this._servicos.filter(s => s.tipo === t);
        const aereos = por('aereo'), hoteis = por('hotel');
        const itens = [];
        if (aereos.length) itens.push(aereos.length > 1 ? 'passagem aérea de ida e volta (classe econômica)' : 'passagem aérea (classe econômica)');
        if (hoteis.length) {
            const carac = hoteis.map(h => (h.caracteristicas || '').toLowerCase()).join('\n');
            let hosp = hoteis.length > 1 ? 'opções de hospedagem' : 'hospedagem';
            if (carac.includes('all inclusive'))               hosp += ' em regime all inclusive';
            else if (carac.includes('café da manhã incluso'))  hosp += ' com café da manhã';
            itens.push(hosp);
        }
        if (por('translado').length) itens.push(por('translado').length > 1 ? 'translados' : 'translado');
        if (por('passeio').length)   itens.push(por('passeio').length > 1 ? 'passeios' : 'passeio');
        if (por('seguro').length)    itens.push('seguro viagem');

        const destino = v('fDestino');
        const ida = this._fmtData(v('fDataPartida')), volta = this._fmtData(v('fDataRetorno'));
        const periodo = ida && volta ? `, no período de ${ida} a ${volta}` : ida ? `, com saída em ${ida}` : '';
        const contempla = itens.length
            ? `, contemplando ${juntar(itens)}${destino ? ` em ${destino}` : ''}${periodo}`
            : `${destino ? ` com destino a ${destino}` : ''}${periodo}`;

        const cliente = v('fClienteNome') || v('fBuscaCliente');
        return [
            'Prezado(a) Senhor(a),',
            '',
            ...(cliente ? [cliente, ''] : []),
            `Em atendimento à solicitação de cotação datada de ${this._fmtData(this._dataLocalISO())}, ` +
            `segue proposta para ${pessoas}${contempla}, conforme detalhado abaixo.`,
            '',
            'Os valores apresentados incluem todos os tributos, encargos e taxas aplicáveis, ' +
            'considerando a tarifa e a disponibilidade vigentes na data desta cotação.',
        ].join('\n');
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
                descricao:       document.getElementById('fDescricao')?.value?.trim(),
                status:          document.getElementById('fStatus')?.value || 'orcamento',
                createdAt:       new Date().toISOString(),
            };
        }

        await this._construirPDF(pacote);
    },

    async _construirPDF(p) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const pw     = doc.internal.pageSize.getWidth();
        const ph     = doc.internal.pageSize.getHeight();
        const mg     = 20;
        const cw     = pw - mg * 2;
        const TOPO   = 54;          // início do conteúdo abaixo do cabeçalho
        const LIMITE = ph - 26;     // conteúdo não invade o rodapé
        let   y      = 0;

        const NAVY  = [26, 54, 93];
        const AZUL  = [66, 153, 225];
        const CINZA = [105, 115, 130];
        const TEXTO = [40, 45, 55];
        const LINHA = [222, 228, 238];
        const FUNDO = [246, 249, 253];
        const rgb   = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
        const tipoInfo = t => this.TIPOS.find(x => x.value === t) || this.TIPOS[5];

        const fonte = (size, estilo = 'normal') => { doc.setFont('helvetica', estilo); doc.setFontSize(size); };
        const txt = (s, x, yy, o = {}) => {
            fonte(o.size || 9, o.bold ? 'bold' : (o.italic ? 'italic' : 'normal'));
            doc.setTextColor(...(o.cor || TEXTO));
            const opts = { align: o.align || 'left' };
            if (o.esp) opts.charSpace = o.esp;
            doc.text(String(s), x, yy, opts);
        };
        // A Helvetica do jsPDF só tem os caracteres do WinAnsi: setas e emojis
        // digitados pelo usuário sairiam como lixo ("!'"), então troca ou remove.
        const limpar = v => v == null ? v : String(v)
            .replace(/\s*[→⇒➔➜►]\s*/g, ' – ')
            .replace(/[^\x00-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, '');
        p = { ...p };
        ['destino', 'nomeViagem', 'clienteNome', 'observacoes', 'solicitante', 'descricao'].forEach(k => { p[k] = limpar(p[k]); });
        // Corta o texto em uma linha só, com reticências (usa a fonte atual)
        const cortar = (s, w) => {
            const l = doc.splitTextToSize(String(s || ''), w);
            return l.length > 1 ? l[0].replace(/[\s,.;:-]+$/, '') + '...' : (l[0] || '');
        };
        const check = (x, yy, cor) => {
            doc.setDrawColor(...cor); doc.setLineWidth(0.45);
            doc.line(x, yy - 1.1, x + 0.9, yy);
            doc.line(x + 0.9, yy, x + 2.6, yy - 2.3);
        };
        const opacidade = (v) => { try { doc.setGState(new doc.GState({ opacity: v })); } catch (_) {} };

        const MESES  = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
        const SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
        const partesData = d => {
            if (!d) return null;
            const iso = d instanceof Date ? d.toISOString() : String(d);
            const [a, m, dd] = iso.slice(0, 10).split('-').map(Number);
            if (!a || !m || !dd) return null;
            return { dia: dd, mes: MESES[m - 1], ano: a, sem: SEMANA[new Date(a, m - 1, dd).getDay()] };
        };
        const plural = (n, s, pl) => `${n} ${n === 1 ? s : (pl || s + 's')}`;

        // ── Logo ──
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

        // ── Dados ──
        const servicos = (Array.isArray(p.servicos) ? p.servicos : []).map(s => {
            const n = this._normalizarServico(s);
            ['descricao', 'fornecedor', 'caracteristicas'].forEach(k => { n[k] = limpar(n[k]); });
            return n;
        });
        // Roteiro em ordem cronológica; sem data vai para o fim, empate mantém a ordem digitada
        const roteiro = servicos.map((s, i) => ({ s, i, d: String(s.dataInicio || '').slice(0, 10) }))
            .sort((a, b) => (!a.d && !b.d) ? a.i - b.i : !a.d ? 1 : !b.d ? -1
                : a.d < b.d ? -1 : a.d > b.d ? 1 : a.i - b.i)
            .map(o => o.s);

        const adultos  = +p.adultos  || 0;
        const criancas = +p.criancas || 0;
        const bebes    = +p.bebes    || 0;
        const pax      = adultos + criancas + bebes || 1;
        const pagantes = adultos + criancas;
        const total    = +p.total    || 0;
        const subtotal = +p.subtotal || 0;
        const markup   = +p.markup   || 0;
        const noites   = this._calcDiarias(p.dataPartida, p.dataRetorno);

        const dataEmissao = this._fmtData(this._dataLocalISO());
        // Validade: sempre a data atual (mesmo padrão do relatório de Cotação)
        const validade    = this._fmtData(this._dataLocalISO());
        const codigo      = p.id && p.id !== 'preview' ? `#${String(p.id).slice(0, 8).toUpperCase()}` : '#PRÉVIA';

        // ── Fotos: recortadas no canvas no formato exato de cada espaço ──
        const cardX = mg + 28, cardW = cw - 28, pad = 5, inW = cardW - pad * 2;
        const FOTO_GAP = 3;
        const gradeFotos = n => {
            const cols = n >= 3 ? 3 : 2;
            const w = (inW - (cols - 1) * FOTO_GAP) / cols;
            return { cols, w, h: w * 0.64 };
        };
        const fotosCard = new Map();     // serviço → fotos já preparadas (até 3)
        const galeria   = [];            // fotos excedentes, vão para o fim
        const heroH = 70;
        const fotoHero = (servicos.find(s => s.tipo === 'hotel' && s.imagens.length)
                       || servicos.find(s => s.imagens.length))?.imagens[0] || null;

        const galW = (cw - 2 * FOTO_GAP) / 3, galH = galW * 0.66;
        const [heroImg] = await Promise.all([
            this._prepararImagemPDF(fotoHero, cw, heroH, { raio: 3, hero: true }),
            ...servicos.map(async s => {
                const lista = s.imagens.slice(0, 3);
                if (lista.length) {
                    const g = gradeFotos(lista.length);
                    fotosCard.set(s, (await Promise.all(lista.map(src =>
                        this._prepararImagemPDF(src, g.w, g.h, { raio: 1.5 })))).filter(Boolean));
                }
                const extras = s.imagens.slice(3);
                if (extras.length) {
                    const imgs = (await Promise.all(extras.map(src =>
                        this._prepararImagemPDF(src, galW, galH, { raio: 1.5 })))).filter(Boolean);
                    if (imgs.length) galeria.push({ s, imgs });
                }
            }),
        ]);
        // Galeria na mesma ordem do roteiro
        galeria.sort((a, b) => roteiro.indexOf(a.s) - roteiro.indexOf(b.s));

        // Cabeçalho idêntico ao relatório de Cotação (ReportModule.gerarCotacaoPDF)
        const _header = () => {
            doc.setFillColor(...NAVY);
            doc.rect(0, 0, pw, 45, 'F');
            doc.setFillColor(...AZUL);
            doc.rect(0, 45, pw, 1.2, 'F');

            if (logoB64) {
                try {
                    doc.setFillColor(255, 255, 255);
                    doc.roundedRect(mg + 1, 6, 33, 33, 4, 4, 'F');
                    doc.addImage(logoB64, 'PNG', mg + 2, 7, 31, 31);
                } catch (e) { console.warn('Erro ao adicionar logo no PDF:', e); }
            }

            const textoX = logoB64 ? mg + 40 : mg;
            txt('GiraMundoTour', textoX, 25, { size: 24, bold: true, cor: [255, 255, 255] });
            txt(CONFIG.empresa.slogan, textoX, 33, { size: 10, cor: [255, 255, 255] });

            // Dados da empresa (direita) com ícones de WhatsApp / Instagram
            const contactX = pw - mg;
            let contactY = 12;
            const iconSize = 4;
            const wppIcon = ReportModule._gerarIconeWhatsApp();
            const igIcon  = ReportModule._gerarIconeInstagram();
            const linhaContato = (texto, icone, passo) => {
                txt(texto, contactX, contactY, { size: 8, cor: [255, 255, 255], align: 'right' });
                if (icone) {
                    const w = doc.getTextWidth(texto);
                    try { doc.addImage(icone, 'PNG', contactX - w - iconSize - 1.5, contactY - iconSize + 0.8, iconSize, iconSize); } catch (e) {}
                }
                contactY += passo;
            };
            linhaContato(CONFIG.empresa.email,     null,    5.5);
            linhaContato(CONFIG.empresa.telefone,  wppIcon, 4.5);
            linhaContato(CONFIG.empresa.telefone2, wppIcon, 5.5);
            linhaContato(CONFIG.empresa.instagram, igIcon,  0);
        };

        const _footer = (pag, totalPag) => {
            const footerY = ph - 20;
            doc.setDrawColor(...AZUL);
            doc.setLineWidth(0.5);
            doc.line(mg, footerY, pw - mg, footerY);
            txt(CONFIG.empresa.nome, mg, footerY + 5, { size: 8, bold: true, cor: [60, 60, 60] });
            txt('CNPJ: ' + CONFIG.empresa.cnpj, pw - mg, footerY + 5, { size: 8, cor: [100, 100, 100], align: 'right' });
            const contatos = CONFIG.empresa.email + '  |  ' + CONFIG.empresa.telefone + '  |  ' + CONFIG.empresa.telefone2 + '  |  ' + CONFIG.empresa.instagram;
            txt(contatos, pw / 2, footerY + 10, { size: 7, cor: [100, 100, 100], align: 'center' });
            txt(`Página ${pag} de ${totalPag}`, pw - mg, footerY + 10, { size: 7, cor: [140, 140, 140], align: 'right' });
        };

        const _checkPage = (needed) => {
            if (y + needed > LIMITE) {
                doc.addPage();
                _header();
                y = TOPO;
                return true;
            }
            return false;
        };

        // Título de seção: barra azul + texto em caixa alta + complemento à direita
        const secao = (titulo, complemento, minimoDepois = 30) => {
            _checkPage(14 + minimoDepois);
            doc.setFillColor(...AZUL);
            doc.roundedRect(mg, y, 1.6, 7, 0.8, 0.8, 'F');
            txt(titulo.toUpperCase(), mg + 4.5, y + 5.3, { size: 11.5, bold: true, cor: NAVY, esp: 0.12 });
            if (complemento) txt(complemento, pw - mg, y + 5.3, { size: 8, cor: CINZA, align: 'right' });
            y += 12;
        };

        // ═════════════════════════════════════════════════════════════
        _header();
        y = 52;

        // ── Capa: foto do destino com o nome da viagem sobreposto ──
        const heroY = y;
        if (heroImg) {
            try { doc.addImage(heroImg, 'JPEG', mg, heroY, cw, heroH); } catch (_) {}
        } else {
            doc.setFillColor(...NAVY);
            doc.roundedRect(mg, heroY, cw, heroH, 3, 3, 'F');
        }

        // Selo com código e status (canto superior direito)
        const stInfo = this.STATUS[p.status] || { label: p.status || 'Orçamento' };
        const selo = `${codigo}   •   ${String(stInfo.label).toUpperCase()}`;
        fonte(7.5, 'bold');
        const seloW = doc.getTextWidth(selo) + 8;
        doc.setFillColor(10, 25, 50); opacidade(0.55);
        doc.roundedRect(pw - mg - 6 - seloW, heroY + 6, seloW, 7, 3.5, 3.5, 'F');
        opacidade(1);
        txt(selo, pw - mg - 6 - seloW / 2, heroY + 10.7, { size: 7.5, bold: true, cor: [255, 255, 255], align: 'center' });

        // Destino em destaque (reduz a fonte se não couber)
        const destino = p.destino || 'Sua próxima viagem';
        let tamDest = 26;
        fonte(tamDest, 'bold');
        while (tamDest > 16 && doc.getTextWidth(destino) > cw - 16) { tamDest -= 1; fonte(tamDest, 'bold'); }
        const baseHero = heroY + heroH - 14;
        txt('PROPOSTA DE VIAGEM', mg + 8, baseHero - (p.nomeViagem ? 21 : 14), { size: 8, bold: true, cor: [170, 205, 245], esp: 0.5 });
        fonte(tamDest, 'bold');
        txt(cortar(destino, cw - 16), mg + 8, baseHero - (p.nomeViagem ? 10 : 3), { size: tamDest, bold: true, cor: [255, 255, 255] });
        if (p.nomeViagem) {
            fonte(11, 'italic');
            txt(cortar(p.nomeViagem, cw - 16), mg + 8, baseHero - 2, { size: 11, italic: true, cor: [220, 232, 250] });
        }

        // ── Cartões de resumo sobrepostos à capa ──
        const tiles = [];
        const dIda = partesData(p.dataPartida), dVolta = partesData(p.dataRetorno);
        tiles.push({ rot: 'IDA',   val: dIda   ? this._fmtData(p.dataPartida) : '—', sub: dIda?.sem   || '' });
        tiles.push({ rot: 'VOLTA', val: dVolta ? this._fmtData(p.dataRetorno) : '—', sub: dVolta?.sem || '' });
        tiles.push({ rot: 'DURAÇÃO', val: noites ? plural(noites, 'noite') : '—', sub: noites ? plural(noites + 1, 'dia') : '' });
        const comp = [];
        if (adultos)  comp.push(plural(adultos, 'adulto'));
        if (criancas) comp.push(plural(criancas, 'criança'));
        if (bebes)    comp.push(plural(bebes, 'bebê'));
        tiles.push({ rot: 'VIAJANTES', val: plural(pax, 'pessoa'), sub: comp.join(', ') });

        const tileY = heroY + heroH - 9, tileH = 20, tileGap = 4;
        const tileX0 = mg + 6, tileW = (cw - 12 - tileGap * 3) / 4;
        tiles.forEach((t, i) => {
            const x = tileX0 + i * (tileW + tileGap);
            doc.setFillColor(205, 214, 228);
            doc.roundedRect(x + 0.6, tileY + 0.9, tileW, tileH, 2.5, 2.5, 'F');
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(x, tileY, tileW, tileH, 2.5, 2.5, 'F');
            doc.setFillColor(...AZUL);
            doc.roundedRect(x + 3.5, tileY + 4, 0.9, 12, 0.45, 0.45, 'F');
            txt(t.rot, x + 6.5, tileY + 6.5, { size: 6.5, bold: true, cor: CINZA, esp: 0.25 });
            txt(t.val, x + 6.5, tileY + 12.3, { size: 10.5, bold: true, cor: NAVY });
            if (t.sub) {
                fonte(7);
                txt(cortar(t.sub, tileW - 8), x + 6.5, tileY + 16.6, { size: 7, cor: CINZA });
            }
        });
        y = tileY + tileH + 8;

        // ── Para quem / emissão ──
        if (p.clienteNome) {
            txt('Preparado especialmente para', mg, y + 3, { size: 7.5, cor: CINZA });
            fonte(12, 'bold');
            txt(cortar(p.clienteNome, cw - 70), mg, y + 9, { size: 12, bold: true, cor: NAVY });
        }
        txt(`Emissão: ${dataEmissao}`,  pw - mg, y + 3, { size: 8, cor: CINZA, align: 'right' });
        txt(`Válida até: ${validade}`,  pw - mg, y + 8, { size: 8, bold: true, cor: NAVY, align: 'right' });
        y += 14;

        // ── Descrição / carta de apresentação (texto justificado) ──
        if (p.descricao) {
            const TAM = 9, LH = 4.3;
            doc.setDrawColor(...LINHA); doc.setLineWidth(0.3);
            doc.line(mg, y - 2, pw - mg, y - 2);
            y += 3;
            fonte(TAM);
            p.descricao.split(/\r?\n/).forEach(par => {
                if (!par.trim()) { y += LH * 0.6; return; }
                const linhas = doc.splitTextToSize(par.trim(), cw);
                linhas.forEach((linha, k) => {
                    _checkPage(LH);
                    fonte(TAM);
                    doc.setTextColor(...TEXTO);
                    const palavras = linha.trim().split(/\s+/);
                    const ultima = k === linhas.length - 1;
                    if (ultima || palavras.length < 2) {
                        doc.text(linha.trim(), mg, y);
                    } else {
                        // Justifica: distribui a sobra de largura entre as palavras
                        const larguras = palavras.map(w => doc.getTextWidth(w));
                        const folga = (cw - larguras.reduce((a, b) => a + b, 0)) / (palavras.length - 1);
                        let x = mg;
                        palavras.forEach((w, n) => { doc.text(w, x, y); x += larguras[n] + folga; });
                    }
                    y += LH;
                });
            });
            y += 5;
        }

        // ── "Seu pacote inclui" + card de investimento ──
        const precoW = 68, gapCol = 6, inclW = cw - precoW - gapCol;
        const MAX_INCL = 6;
        const itensIncl = roteiro.slice(0, MAX_INCL).map(s => {
            const t = tipoInfo(s.tipo);
            let det = s.descricao || '';
            if (s.tipo === 'hotel' && +s.diarias > 0) det = (det ? det + ' — ' : '') + plural(+s.diarias, 'diária');
            return { rot: s.tipo === 'hotel' ? 'Hospedagem' : t.label, det, cor: rgb(t.cor) };
        });
        const restoIncl = Math.max(0, roteiro.length - MAX_INCL);
        const linhasIncl = Math.max(1, itensIncl.length) + (restoIncl ? 1 : 0);
        const blocoH = Math.max(46, 13 + linhasIncl * 5.6 + 3);
        _checkPage(blocoH);

        doc.setFillColor(...FUNDO);
        doc.roundedRect(mg, y, inclW, blocoH, 3, 3, 'F');
        txt('SEU PACOTE INCLUI', mg + 6, y + 8, { size: 8, bold: true, cor: NAVY, esp: 0.3 });
        let iy = y + 15;
        if (!itensIncl.length) {
            txt('Serviços a definir', mg + 6, iy, { size: 8.5, italic: true, cor: CINZA });
        }
        itensIncl.forEach(it => {
            doc.setFillColor(...it.cor);
            doc.circle(mg + 7.3, iy - 1.1, 2, 'F');
            check(mg + 6, iy - 0.2, [255, 255, 255]);
            txt(it.rot, mg + 11, iy, { size: 8.5, bold: true, cor: TEXTO });
            const rw = doc.getTextWidth(it.rot);
            if (it.det) {
                fonte(8.5);
                txt(cortar(it.det, inclW - 17 - rw - 2), mg + 11 + rw + 2, iy, { size: 8.5, cor: CINZA });
            }
            iy += 5.6;
        });
        if (restoIncl) txt(`+ ${plural(restoIncl, 'serviço')} no roteiro abaixo`, mg + 11, iy, { size: 8, italic: true, cor: CINZA });

        const px = mg + inclW + gapCol;
        doc.setFillColor(...NAVY);
        doc.roundedRect(px, y, precoW, blocoH, 3, 3, 'F');
        txt('INVESTIMENTO TOTAL', px + 6, y + 9, { size: 7.5, bold: true, cor: [170, 205, 245], esp: 0.3 });
        let tamTotal = 20;
        fonte(tamTotal, 'bold');
        const totalTxt = this._fmtMoeda(total);
        while (tamTotal > 13 && doc.getTextWidth(totalTxt) > precoW - 12) { tamTotal -= 1; fonte(tamTotal, 'bold'); }
        txt(totalTxt, px + 6, y + 20, { size: tamTotal, bold: true, cor: [255, 255, 255] });
        let py = y + 26.5;
        if (pagantes > 1) {
            txt(`${this._fmtMoeda(total / pagantes)} por pessoa`, px + 6, py, { size: 8.5, cor: [205, 222, 245] });
            py += 4;
        }
        doc.setDrawColor(70, 100, 140); doc.setLineWidth(0.2);
        doc.line(px + 6, py, px + precoW - 6, py);
        fonte(6.5);
        doc.splitTextToSize('Valores em reais (BRL), sujeitos a disponibilidade no momento da reserva.', precoW - 12)
            .forEach((l, k) => txt(l, px + 6, py + 4.5 + k * 3.2, { size: 6.5, cor: [170, 195, 225] }));
        y += blocoH + 10;

        // ── Roteiro em linha do tempo ──
        const lineX = mg + 23;

        // Mede (desenhar=false) ou desenha o card do serviço; devolve a altura
        const cardServico = (s, y0, desenhar) => {
            const t     = tipoInfo(s.tipo);
            const cor   = rgb(t.cor);
            const hotel = s.tipo === 'hotel';
            let yy = y0 + pad;

            // Etiqueta do tipo + valor
            const etiqueta = (hotel ? 'HOSPEDAGEM' : t.label.toUpperCase());
            fonte(6.8, 'bold');
            const etW = doc.getTextWidth(etiqueta) + 5;
            if (desenhar) {
                doc.setFillColor(...cor);
                doc.roundedRect(cardX + pad, yy, etW, 5, 2.5, 2.5, 'F');
                txt(etiqueta, cardX + pad + etW / 2, yy + 3.5, { size: 6.8, bold: true, cor: [255, 255, 255], align: 'center' });
                if (+s.valorTotal) txt(this._fmtMoeda(+s.valorTotal), cardX + cardW - pad, yy + 3.7, { size: 9.5, bold: true, cor: NAVY, align: 'right' });
            }
            yy += 8;

            // Título
            fonte(11.5, 'bold');
            const titulo = doc.splitTextToSize(s.descricao || t.label, inW);
            titulo.forEach(l => {
                if (desenhar) txt(l, cardX + pad, yy + 4, { size: 11.5, bold: true, cor: TEXTO });
                yy += 5.2;
            });

            // Fornecedor + período
            const ini = this._fmtData(s.dataInicio), fim = this._fmtData(s.dataFim);
            let periodo = '';
            if (hotel) periodo = [ini && `Check-in ${ini}`, fim && `Check-out ${fim}`].filter(Boolean).join('   •   ');
            else if (ini && fim && fim !== ini) periodo = `${ini} a ${fim}`;
            else periodo = ini || fim || '';
            const meta = [s.fornecedor, periodo].filter(Boolean).join('   •   ');
            if (meta) {
                fonte(8);
                doc.splitTextToSize(meta, inW).forEach(l => {
                    if (desenhar) txt(l, cardX + pad, yy + 3.2, { size: 8, cor: CINZA });
                    yy += 4;
                });
            }

            // Hotel: diárias / quartos / hóspedes / apto em "chips"
            if (hotel) {
                const chips = [];
                if (+s.diarias > 0) chips.push(plural(+s.diarias, 'diária'));
                if (+s.quartos > 0) chips.push(plural(+s.quartos, 'quarto'));
                if (+s.pessoas > 0) chips.push(plural(+s.pessoas, 'hóspede'));
                if (s.tipoApto)     chips.push(this._labelApto(s.tipoApto));
                if (chips.length) {
                    yy += 2;
                    fonte(7.5, 'bold');
                    let cx = cardX + pad;
                    chips.forEach(c => {
                        const w = doc.getTextWidth(c) + 5;
                        if (cx + w > cardX + pad + inW) { cx = cardX + pad; yy += 7; }
                        if (desenhar) {
                            doc.setFillColor(255, 243, 228);
                            doc.roundedRect(cx, yy, w, 5.5, 2.75, 2.75, 'F');
                            txt(c, cx + w / 2, yy + 3.8, { size: 7.5, bold: true, cor: [175, 90, 15], align: 'center' });
                        }
                        cx += w + 2;
                    });
                    yy += 5.5;
                }
            }

            // Características / o que está incluso — checklist em 2 colunas
            const itens = (s.caracteristicas || '').split('\n').map(l => l.trim()).filter(Boolean);
            if (itens.length) {
                yy += 4;
                if (desenhar) txt(hotel ? 'COMODIDADES' : 'O QUE ESTÁ INCLUSO', cardX + pad, yy + 2.5, { size: 6.5, bold: true, cor: CINZA, esp: 0.25 });
                yy += 5.5;
                const colW = (inW - 4) / 2;
                fonte(8);
                for (let k = 0; k < itens.length; k += 2) {
                    const par = [itens[k], itens[k + 1]].filter(Boolean)
                        .map(it => doc.splitTextToSize(it, colW - 5));
                    const h = Math.max(...par.map(l => l.length)) * 3.7;
                    if (desenhar) {
                        par.forEach((linhas, c) => {
                            const x = cardX + pad + c * (colW + 4);
                            check(x, yy + 2.8, cor);
                            linhas.forEach((l, n) => txt(l, x + 4.2, yy + 3 + n * 3.7, { size: 8, cor: TEXTO }));
                        });
                    }
                    yy += h + 0.8;
                }
            }

            // Fotos (até 3 no card; o restante vai para a galeria)
            const fotos = fotosCard.get(s) || [];
            if (fotos.length) {
                yy += 3;
                const g = gradeFotos(fotos.length);
                if (desenhar) {
                    fotos.forEach((img, k) => {
                        try { doc.addImage(img, 'JPEG', cardX + pad + k * (g.w + FOTO_GAP), yy, g.w, g.h); } catch (_) {}
                    });
                }
                yy += g.h;
            }

            return yy + pad - y0;
        };

        if (roteiro.length) {
            // Título só fica nesta página se o primeiro card couber junto
            secao('Roteiro da viagem', plural(roteiro.length, 'serviço'), cardServico(roteiro[0], 0, false));
            let ultimaData = null;
            roteiro.forEach((s, idx) => {
                const h = cardServico(s, y, false);
                if (_checkPage(h)) ultimaData = null;
                const y0 = y;
                const cor = rgb(tipoInfo(s.tipo).cor);
                const ultimo = idx === roteiro.length - 1;

                // Linha do tempo: trilho + marcador
                doc.setDrawColor(...LINHA); doc.setLineWidth(0.6);
                doc.line(lineX, y0 + 7, lineX, ultimo ? y0 + 7 : y0 + h + 6);
                doc.setFillColor(255, 255, 255);
                doc.circle(lineX, y0 + 7, 2.8, 'F');
                doc.setFillColor(...cor);
                doc.circle(lineX, y0 + 7, 1.9, 'F');

                // Data (omitida quando repete a do serviço anterior)
                const dt  = partesData(s.dataInicio);
                const chv = String(s.dataInicio || '').slice(0, 10);
                if (dt && chv !== ultimaData) {
                    txt(String(dt.dia).padStart(2, '0'), mg + 9, y0 + 9, { size: 17, bold: true, cor: NAVY, align: 'center' });
                    txt(`${dt.mes} ${String(dt.ano).slice(2)}`, mg + 9, y0 + 13.5, { size: 7, bold: true, cor: CINZA, align: 'center' });
                    txt(dt.sem.slice(0, 3).toLowerCase(), mg + 9, y0 + 17.2, { size: 6.5, cor: CINZA, align: 'center' });
                }
                ultimaData = chv || ultimaData;

                // Card
                doc.setFillColor(...FUNDO);
                doc.roundedRect(cardX + 0.5, y0 + 0.7, cardW, h, 2.5, 2.5, 'F');
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(...LINHA); doc.setLineWidth(0.25);
                doc.roundedRect(cardX, y0, cardW, h, 2.5, 2.5, 'FD');
                doc.setFillColor(...cor);
                doc.roundedRect(cardX, y0, 1.4, h, 0.7, 0.7, 'F');
                cardServico(s, y0, true);

                y = y0 + h + 6;
            });
            y += 2;
        }

        // ── Galeria de fotos excedentes ──
        if (galeria.length) {
            secao('Mais fotos', null, galH + 10);
            galeria.forEach(({ s, imgs }) => {
                _checkPage(galH + 9);
                fonte(8.5, 'bold');
                txt(cortar(s.descricao || tipoInfo(s.tipo).label, cw), mg, y + 3, { size: 8.5, bold: true, cor: NAVY });
                y += 6;
                imgs.forEach((img, k) => {
                    const col = k % 3;
                    if (col === 0 && k > 0) { y += galH + FOTO_GAP; _checkPage(galH); }
                    try { doc.addImage(img, 'JPEG', mg + col * (galW + FOTO_GAP), y, galW, galH); } catch (_) {}
                });
                y += galH + 7;
            });
        }

        // ── Resumo de valores ──
        if (servicos.length) {
            // Mantém tabela e total juntos quando cabem numa página
            const resumoH = roteiro.length * 7 + (markup > 0 ? 14 : 2) + 18;
            secao('Resumo de valores', null, Math.min(resumoH, LIMITE - TOPO - 14));
            roteiro.forEach((s, k) => {
                _checkPage(7);
                const t = tipoInfo(s.tipo);
                if (k % 2 === 0) { doc.setFillColor(...FUNDO); doc.rect(mg, y, cw, 7, 'F'); }
                doc.setFillColor(...rgb(t.cor));
                doc.circle(mg + 4, y + 3.5, 1.2, 'F');
                txt(s.tipo === 'hotel' ? 'Hospedagem' : t.label, mg + 8, y + 4.8, { size: 8.5, bold: true, cor: TEXTO });
                fonte(8.5);
                txt(cortar(s.descricao || '', cw - 75), mg + 34, y + 4.8, { size: 8.5, cor: CINZA });
                txt(this._fmtMoeda(+s.valorTotal || 0), pw - mg - 4, y + 4.8, { size: 8.5, cor: TEXTO, align: 'right' });
                y += 7;
            });
            y += 2;
        }

        _checkPage(markup > 0 ? 34 : 26);
        if (markup > 0) {
            txt('Subtotal', pw - mg - 50, y + 4, { size: 8.5, cor: CINZA, align: 'right' });
            txt(this._fmtMoeda(subtotal), pw - mg - 4, y + 4, { size: 8.5, cor: TEXTO, align: 'right' });
            txt(`Markup (${markup}%)`, pw - mg - 50, y + 9, { size: 8.5, cor: CINZA, align: 'right' });
            txt(this._fmtMoeda(subtotal * markup / 100), pw - mg - 4, y + 9, { size: 8.5, cor: TEXTO, align: 'right' });
            y += 12;
        }
        doc.setFillColor(...NAVY);
        doc.roundedRect(mg, y, cw, 12, 2.5, 2.5, 'F');
        txt('TOTAL DO PACOTE', mg + 6, y + 7.8, { size: 9, bold: true, cor: [255, 255, 255], esp: 0.3 });
        txt(this._fmtMoeda(total), pw - mg - 6, y + 8.2, { size: 13, bold: true, cor: [255, 255, 255], align: 'right' });
        y += 12;
        if (pagantes > 1) {
            txt(`Equivale a ${this._fmtMoeda(total / pagantes)} por pessoa (${plural(pagantes, 'pagante')})`,
                pw - mg - 6, y + 5, { size: 7.5, cor: CINZA, align: 'right' });
            y += 6;
        }
        y += 8;

        // ── Observações ──
        if (p.observacoes) {
            fonte(8.5);
            const linhas = doc.splitTextToSize(p.observacoes, cw - 14);
            const boxH = 14 + linhas.length * 4.6;
            if (boxH <= LIMITE - TOPO) {
                _checkPage(boxH);
                doc.setFillColor(...FUNDO);
                doc.roundedRect(mg, y, cw, boxH, 2.5, 2.5, 'F');
                doc.setFillColor(...AZUL);
                doc.roundedRect(mg, y, 1.4, boxH, 0.7, 0.7, 'F');
                txt('OBSERVAÇÕES', mg + 7, y + 7, { size: 8, bold: true, cor: NAVY, esp: 0.3 });
                linhas.forEach((l, k) => txt(l, mg + 7, y + 13 + k * 4.6, { size: 8.5, cor: TEXTO }));
                y += boxH + 8;
            } else {
                // Texto longo demais para uma caixa só: segue em fluxo, quebrando página
                secao('Observações', null, 10);
                linhas.forEach(l => { _checkPage(5); txt(l, mg, y, { size: 8.5, cor: TEXTO }); y += 4.6; });
                y += 6;
            }
        }

        // ── Chamada final ──
        _checkPage(42);
        doc.setFillColor(232, 244, 255);
        doc.roundedRect(mg, y, cw, 28, 3, 3, 'F');
        txt('Vamos tirar essa viagem do papel?', mg + 7, y + 10, { size: 12.5, bold: true, cor: NAVY });
        fonte(8.5);
        doc.splitTextToSize('Fale com a gente para confirmar a disponibilidade e garantir estas condições.', cw - 82)
            .forEach((l, k) => txt(l, mg + 7, y + 16 + k * 4.2, { size: 8.5, cor: TEXTO }));
        if (p.solicitante) txt(`Seu consultor: ${p.solicitante}`, mg + 7, y + 24.5, { size: 8, bold: true, cor: NAVY });

        const wpp = ReportModule._gerarIconeWhatsApp();
        const ig  = ReportModule._gerarIconeInstagram();
        const cxR = pw - mg - 7;
        [[CONFIG.empresa.telefone, wpp, 9.5], [CONFIG.empresa.telefone2, wpp, 15.5], [CONFIG.empresa.instagram, ig, 21.5]]
            .forEach(([texto, icone, dy]) => {
                txt(texto, cxR, y + dy, { size: 9, bold: true, cor: NAVY, align: 'right' });
                const w = doc.getTextWidth(texto);
                try { doc.addImage(icone, 'PNG', cxR - w - 5.5, y + dy - 3.4, 4, 4); } catch (_) {}
            });
        y += 33;

        fonte(7, 'italic');
        doc.splitTextToSize(
            `Proposta válida até ${validade}. Valores e disponibilidade sujeitos a confirmação no momento da reserva; ` +
            'tarifas aéreas podem sofrer alteração até a emissão dos bilhetes.', cw)
            .forEach(l => { txt(l, mg, y, { size: 7, italic: true, cor: CINZA }); y += 3.6; });

        // ── Rodapé com numeração em todas as páginas ──
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            _footer(i, totalPages);
        }

        const nome = (p.nomeViagem || p.destino || 'pacote').replace(/\s+/g, '-').toLowerCase();
        doc.save(`pacote-${nome}-${dataEmissao.replace(/\//g, '-')}.pdf`);
    },

    // Recorta a foto no tamanho exato do espaço no PDF (sem distorcer), com cantos
    // arredondados. Na capa (hero) escurece a base para o texto branco ficar legível;
    // sem foto, a capa vira um degradê azul.
    _prepararImagemPDF(src, wMm, hMm, { raio = 2, hero = false, fundo = '#ffffff' } = {}) {
        const PX = 6;   // px por mm — nítido impresso sem inflar o PDF
        const W = Math.round(wMm * PX), H = Math.round(hMm * PX), R = raio * PX;

        const desenhar = (img) => {
            const c = document.createElement('canvas');
            c.width = W; c.height = H;
            const ctx = c.getContext('2d');
            ctx.fillStyle = fundo;
            ctx.fillRect(0, 0, W, H);
            ctx.beginPath();
            ctx.moveTo(R, 0);
            ctx.arcTo(W, 0, W, H, R); ctx.arcTo(W, H, 0, H, R);
            ctx.arcTo(0, H, 0, 0, R); ctx.arcTo(0, 0, W, 0, R);
            ctx.closePath();
            ctx.clip();

            if (img) {
                const esc = Math.max(W / img.width, H / img.height);
                const iw = img.width * esc, ih = img.height * esc;
                ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
            } else {
                const g = ctx.createLinearGradient(0, 0, W, H);
                g.addColorStop(0, '#1a365d'); g.addColorStop(1, '#2b6cb0');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
                ctx.fillStyle = 'rgba(255,255,255,0.06)';
                [[0.88, 0.1, 0.32], [0.68, 1.05, 0.26], [0.12, 1.2, 0.22]].forEach(([cx, cy, r]) => {
                    ctx.beginPath(); ctx.arc(cx * W, cy * H, r * W, 0, Math.PI * 2); ctx.fill();
                });
            }
            if (hero) {
                const g = ctx.createLinearGradient(0, H * 0.2, 0, H);
                g.addColorStop(0, 'rgba(10,25,50,0)');
                g.addColorStop(1, 'rgba(10,25,50,0.85)');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
            }
            return c.toDataURL('image/jpeg', 0.85);
        };

        return new Promise(res => {
            if (!src) { res(hero ? desenhar(null) : null); return; }
            const img = new Image();
            img.onload  = () => { try { res(desenhar(img)); } catch (_) { res(hero ? desenhar(null) : null); } };
            img.onerror = () => res(hero ? desenhar(null) : null);
            img.src = src;
        });
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
