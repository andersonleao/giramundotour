// GiraMundoTour - Orçamentos formais para o cliente (aéreo + hospedagem)
//
// Layout do PDF baseado em modelocotacao.pdf (raiz do projeto):
//   cabeçalho da agência → título/subtítulo → carta (destinatário + introdução)
//   → blocos de passagem aérea → opções de hospedagem → quadro "Valor total da
//   cotação" (combinações aéreo × hotel) → informações complementares → aviso
//   → encerramento/assinatura.
//
// Conceitos:
//   • Bloco de aéreo = uma tarifa cotada (1+ voos, nº de passageiros, regras, valores).
//     Blocos do mesmo GRUPO (ex.: "Ida 24/11") são alternativas entre si (Opção 1, 2…);
//     grupos diferentes se somam. O grupo vazio é deduzido do 1º voo (trecho + data).
//   • Opção de hotel = alternativa de hospedagem; cada uma soma com cada combinação de aéreo.
//   • Campos de texto com botão "Auto" ficam vazios = texto gerado automaticamente
//     (mostrado como placeholder); o botão copia o texto automático para editar.

const OrcamentosModule = {
    _lista:      [],
    _clientes:   [],
    _orc:        null,   // orçamento em edição
    _editandoId: null,
    _abaAtiva:   'geral',
    _logoB64:    undefined,

    STATUS: {
        aberto:   { label: 'Em aberto', cls: 'bg-secondary' },
        enviado:  { label: 'Enviado',   cls: 'bg-info text-dark' },
        aprovado: { label: 'Aprovado',  cls: 'bg-success' },
        recusado: { label: 'Recusado',  cls: 'bg-danger' },
    },

    // Paleta do PDF (marca GiraMundoTour). Para usar outra cor basta trocar aqui.
    CORES: {
        primaria:   [26, 54, 93],     // títulos, faixas de seção, totais
        destaque:   [66, 153, 225],   // faixa do slogan e linha do cabeçalho
        alerta:     [185, 28, 28],    // cancelamento não reembolsável
        texto:      [45, 50, 60],
        cinza:      [115, 122, 135],
        linha:      [220, 225, 232],
        fundoCab:   [244, 246, 249],  // cabeçalho das tabelas
        fundoTotal: [234, 242, 251],  // linhas de total
    },

    CLASSES: ['Econômica', 'Premium Economy', 'Executiva', 'Primeira Classe'],
    TRECHOS: ['Ida', 'Retorno', 'Volta', 'Trecho'],
    CIAS:    ['LATAM', 'Azul', 'GOL', 'TAP', 'American Airlines', 'Copa Airlines', 'Avianca', 'Aerolíneas Argentinas'],
    CIA_POR_CODIGO: { LA: 'LATAM', JJ: 'LATAM', AD: 'Azul', G3: 'GOL', TP: 'TAP', AA: 'American Airlines', CM: 'Copa Airlines', AV: 'Avianca', AR: 'Aerolíneas Argentinas' },

    // {cia} e {base} são trocados pela companhia e base tarifária do bloco
    REGRAS_AEREO_PADRAO: [
        { rotulo: 'Bagagem', texto: 'Bagagem de mão de até 10 kg + 1 item pessoal por passageiro inclusos. Bagagem despachada não inclusa; se necessária, pode ser adquirida à parte conforme tabela vigente da companhia.' },
        { rotulo: 'Alterações / cancelamento', texto: 'Conforme regras tarifárias da {cia} (base {base}), com multa e eventual diferença tarifária. Reembolso integral somente se o cancelamento for solicitado em até 24h após a compra e com no mínimo 7 dias de antecedência do embarque (Resolução ANAC nº 400/2016). Taxa de embarque reembolsável em caso de não utilização.' },
        { rotulo: 'Antecipação no mesmo dia', texto: 'Sujeita à disponibilidade e às regras de cada companhia no dia do embarque; sem garantia de gratuidade.' },
    ],

    INFO_PADRAO: [
        'Os valores cotados incluem todos os tributos, encargos, taxas e despesas aplicáveis, sem qualquer custo adicional (exceto bagagem despachada, se solicitada).',
        'A emissão somente ocorrerá mediante confirmação/autorização formal do cliente.',
        'A agência fornecerá, sempre que solicitado, comprovação dos valores vigentes das tarifas na data da emissão.',
    ].join('\n'),

    AVISO_TITULO_PADRAO: 'ATENÇÃO: VALORES SUJEITOS A ALTERAÇÃO SEM AVISO PRÉVIO',
    AVISO_TEXTO_PADRAO:  'Valores e disponibilidade vigentes na data desta cotação ({data}). Tarifas aéreas e hoteleiras não são garantidas até a emissão e podem oscilar a qualquer momento até a confirmação. Solicitamos a autorização o quanto antes para aumentar a chance de garantia dos valores apresentados.',
    ENCERRAMENTO_PADRAO: 'Ficamos à disposição para eventuais esclarecimentos ou para prosseguir com a emissão.',

    // ══════════════════════════════════════════════════════════════════
    // Lista
    // ══════════════════════════════════════════════════════════════════
    init() {},

    async render() {
        const container = document.getElementById('orcamentosContent');
        if (!container) return;

        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <input type="text" id="orcBusca" class="form-control" style="width:260px"
                           placeholder="Buscar cliente ou título..." oninput="OrcamentosModule._filtrar()">
                    <select id="orcFiltroStatus" class="form-select" style="width:160px" onchange="OrcamentosModule._filtrar()">
                        <option value="">Todos os status</option>
                        ${Object.entries(this.STATUS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}
                    </select>
                </div>
                <button class="btn btn-primary" onclick="OrcamentosModule.abrir()">
                    <i class="bi bi-plus-circle me-1"></i>Novo Orçamento
                </button>
            </div>

            <div id="orcLista"><div class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div></div>

            <div class="modal fade" id="modalOrcamento" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-xl modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title" id="orcModalTitulo"><i class="bi bi-file-earmark-richtext me-2"></i>Novo Orçamento</h5>
                            <button type="button" class="btn-close btn-close-white" onclick="OrcamentosModule.fechar()"></button>
                        </div>
                        <div class="modal-body" id="orcEditor"></div>
                        <div class="modal-footer justify-content-between">
                            <div id="orcResumo" class="small text-muted"></div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-secondary" onclick="OrcamentosModule.fechar()">Cancelar</button>
                                <button class="btn btn-outline-primary" onclick="OrcamentosModule.visualizarPDF()">
                                    <i class="bi bi-eye me-1"></i>Visualizar PDF
                                </button>
                                <button class="btn btn-success" onclick="OrcamentosModule.salvar()">
                                    <i class="bi bi-floppy me-1"></i>Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        const editor = document.getElementById('orcEditor');
        editor.addEventListener('input',  e => this._onInput(e));
        editor.addEventListener('change', e => { if (e.target.type === 'checkbox') this._onInput(e); });

        await Promise.all([this._carregar(), this._carregarClientes()]);
    },

    async _carregar() {
        try {
            const resp = await apiCall('/api/orcamentos');
            if (!resp || !resp.ok) throw new Error('HTTP ' + (resp && resp.status));
            const json = await resp.json();
            this._lista = json.data || [];
            this._filtrar();
        } catch (e) {
            const el = document.getElementById('orcLista');
            if (el) el.innerHTML = `<div class="alert alert-danger">Erro ao carregar orçamentos: ${this._esc(e.message)}</div>`;
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

    _filtrar() {
        const q  = (document.getElementById('orcBusca')?.value || '').toLowerCase();
        const st = document.getElementById('orcFiltroStatus')?.value || '';
        this._renderLista(this._lista.filter(o =>
            (!st || o.status === st) &&
            (!q || [o.clienteNome, o.titulo, o.subtitulo].some(v => (v || '').toLowerCase().includes(q)))));
    },

    _renderLista(lista) {
        const el = document.getElementById('orcLista');
        if (!el) return;
        if (!lista.length) {
            el.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-file-earmark-richtext" style="font-size:3rem;opacity:.3"></i>
                    <div class="mt-2">Nenhum orçamento encontrado</div>
                    <button class="btn btn-primary mt-3" onclick="OrcamentosModule.abrir()">
                        <i class="bi bi-plus-circle me-1"></i>Criar orçamento
                    </button>
                </div>`;
            return;
        }
        const rows = lista.map(o => {
            const st = this.STATUS[o.status] || { label: o.status, cls: 'bg-secondary' };
            return `
                <tr>
                    <td><span class="font-monospace text-muted small">#${String(o.numero || '').padStart(4, '0')}</span></td>
                    <td>${this._fmtData(o.dataCotacao)}</td>
                    <td>${this._esc(o.clienteNome) || '<span class="text-muted">—</span>'}</td>
                    <td>
                        <div class="fw-semibold">${this._esc(o.titulo) || '—'}</div>
                        ${o.subtitulo ? `<small class="text-muted">${this._esc(o.subtitulo)}</small>` : ''}
                    </td>
                    <td class="text-end fw-semibold text-primary text-nowrap">
                        ${+o.total ? `<small class="text-muted fw-normal">a partir de</small><br>${this._fmtMoeda(o.total)}` : '—'}
                    </td>
                    <td class="text-center">
                        <select class="form-select form-select-sm d-inline-block w-auto" title="Alterar status"
                                onchange="OrcamentosModule.alterarStatus('${o.id}', this.value)">
                            ${Object.entries(this.STATUS).map(([k, s]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${s.label}</option>`).join('')}
                        </select>
                    </td>
                    <td>
                        <div class="d-flex gap-1 justify-content-end">
                            <button class="btn btn-sm btn-outline-secondary" title="Baixar PDF" onclick="OrcamentosModule.baixarPDF('${o.id}')">
                                <i class="bi bi-file-earmark-pdf"></i></button>
                            <button class="btn btn-sm btn-outline-info" title="Duplicar (cotação atualizada)" onclick="OrcamentosModule.duplicar('${o.id}')">
                                <i class="bi bi-copy"></i></button>
                            <button class="btn btn-sm btn-outline-primary" title="Editar" onclick="OrcamentosModule.abrir('${o.id}')">
                                <i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger" title="Excluir" onclick="OrcamentosModule.excluir('${o.id}')">
                                <i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
        el.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead class="table-light">
                        <tr><th>Nº</th><th>Data</th><th>Cliente</th><th>Orçamento</th>
                            <th class="text-end">Total</th><th class="text-center">Status</th><th></th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    },

    async alterarStatus(id, status) {
        try {
            const resp = await apiCall(`/api/orcamentos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
            if (!resp || !resp.ok) throw new Error('falha ao salvar');
            const o = this._lista.find(x => x.id === id);
            if (o) o.status = status;
            App.showToast('Status atualizado', 'success');
        } catch (e) {
            App.showToast('Erro ao alterar status: ' + e.message, 'danger');
        }
    },

    async excluir(id) {
        const o = this._lista.find(x => x.id === id);
        if (!confirm(`Excluir o orçamento${o?.clienteNome ? ' de ' + o.clienteNome : ''}?`)) return;
        try {
            const resp = await apiCall(`/api/orcamentos/${id}`, { method: 'DELETE' });
            if (!resp || !resp.ok) throw new Error('falha ao excluir');
            App.showToast('Orçamento excluído', 'success');
            await this._carregar();
        } catch (e) {
            App.showToast('Erro: ' + e.message, 'danger');
        }
    },

    async _buscar(id) {
        const resp = await apiCall(`/api/orcamentos/${id}`);
        if (!resp || !resp.ok) throw new Error('Orçamento não encontrado');
        const { data } = await resp.json();
        return this._normalizar(data);
    },

    // ══════════════════════════════════════════════════════════════════
    // Modelo de dados
    // ══════════════════════════════════════════════════════════════════
    _novo() {
        const user = (App.getUser && App.getUser()) || {};
        const emp  = (typeof CONFIG !== 'undefined' && CONFIG.empresa) || {};
        return {
            clienteId: null, clienteNome: '', status: 'aberto',
            dataCotacao: this._hojeISO(),
            titulo: '', subtitulo: '',
            saudacao: 'Prezado(a) Senhor(a)',
            destinatario: '', introducao: '',
            aereos: [], hoteis: [],
            tituloHospedagem: '', estrelasMinimas: '',
            mostrarTotal: true,
            infoComplementares: this.INFO_PADRAO,
            avisoTitulo: this.AVISO_TITULO_PADRAO,
            avisoTexto:  this.AVISO_TEXTO_PADRAO,
            encerramento: this.ENCERRAMENTO_PADRAO,
            assinaturaNome: user.nome || '',
            assinaturaLinhas: [emp.nome, [emp.telefone && `WhatsApp: ${emp.telefone}`, emp.instagram].filter(Boolean).join(' • ')]
                .filter(Boolean).join('\n'),
        };
    },

    // Registro do banco → objeto de edição (dados JSONB + colunas)
    _normalizar(r) {
        const base = this._novo();
        const d = (r && typeof r.dados === 'object' && r.dados) || {};
        const o = { ...base, ...d };
        o.clienteId   = r.clienteId || null;
        o.clienteNome = r.clienteNome || '';
        o.status      = r.status || 'aberto';
        o.dataCotacao = r.dataCotacao ? String(r.dataCotacao).slice(0, 10) : base.dataCotacao;
        o.titulo      = d.titulo ?? '';
        o.subtitulo   = d.subtitulo ?? '';
        o.aereos = (Array.isArray(o.aereos) ? o.aereos : []).map(a => ({ ...this._novoAereo(true), ...a,
            voos: Array.isArray(a.voos) ? a.voos : [], regras: Array.isArray(a.regras) ? a.regras : [] }));
        o.hoteis = (Array.isArray(o.hoteis) ? o.hoteis : []).map(h => ({ ...this._novoHotel(true), ...h }));
        return o;
    },

    _novoVoo(trecho = 'Ida') {
        return { trecho, cia: '', voo: '', data: '', saida: '', chegada: '', origem: '', destino: '' };
    },

    _novoAereo(vazio = false) {
        const ant = vazio ? null : this._orc?.aereos?.[this._orc.aereos.length - 1];
        const v0  = ant?.voos?.[0];
        const vN  = ant?.voos?.[ant.voos.length - 1];
        // Bloco seguinte ao 1º sugere o retorno (origem/destino invertidos)
        const voo = this._novoVoo(ant ? 'Retorno' : 'Ida');
        if (v0 && vN) { voo.origem = vN.destino || ''; voo.destino = v0.origem || ''; }
        return {
            grupo: '', passageiros: ant?.passageiros || 1, tipoPax: ant?.tipoPax || 'adultos',
            classe: ant?.classe || 'Econômica', baseTarifaria: '',
            voos: vazio ? [] : [voo],
            titulo: '', subtitulo: '', infoLinha: '',
            regras: this.REGRAS_AEREO_PADRAO.map(r => ({ ...r })),
            modoValor: ant?.modoValor || 'pax', tarifa: 0, taxas: 0,
        };
    },

    _novoHotel(vazio = false) {
        const ant = vazio ? null : this._orc?.hoteis?.[this._orc.hoteis.length - 1];
        // Sem hotel anterior, sugere o período a partir dos voos (1ª chegada → última saída)
        const datas = vazio ? [] : (this._orc?.aereos || []).flatMap(a => a.voos.map(v => v.data)).filter(Boolean).sort();
        return {
            nome: '', local: ant?.local || '', estrelas: ant?.estrelas ?? 3,
            checkin:  ant?.checkin  || datas[0] || '',
            checkout: ant?.checkout || (datas.length > 1 ? datas[datas.length - 1] : ''),
            hospedes: ant?.hospedes || this._maxPax(this._orc) || 1,
            quartos:  ant?.quartos  || 1,
            acomodacao: ant?.acomodacao || '',
            cafe: ant?.cafe || 'Incluso',
            cancelamento: ant?.cancelamento || '',
            cancelDestaque: ant?.cancelDestaque || false,
            observacao: '',
            valorTotal: 0,
            titulo: '', subtitulo: '',
        };
    },

    // ══════════════════════════════════════════════════════════════════
    // Modal / editor
    // ══════════════════════════════════════════════════════════════════
    async abrir(id = null, { duplicando = false } = {}) {
        try {
            if (id) {
                this._orc = await this._buscar(id);
                if (duplicando) {
                    this._orc.status = 'aberto';
                    this._orc.dataCotacao = this._hojeISO();
                }
            } else {
                this._orc = this._novo();
            }
        } catch (e) {
            App.showToast('Erro ao abrir orçamento: ' + e.message, 'danger');
            return;
        }
        this._editandoId = duplicando ? null : id;
        this._abaAtiva = 'geral';
        this._imp = { aberto: !this._orc.aereos.length, lista: null, filtro: '', sel: new Set(), carregando: false, erro: null };
        document.getElementById('orcModalTitulo').innerHTML = `<i class="bi bi-file-earmark-richtext me-2"></i>${
            duplicando ? 'Duplicar Orçamento (nova cotação)' : id ? 'Editar Orçamento' : 'Novo Orçamento'}`;
        this._renderEditor();
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalOrcamento')).show();
    },

    duplicar(id) { return this.abrir(id, { duplicando: true }); },

    fechar() {
        bootstrap.Modal.getInstance(document.getElementById('modalOrcamento'))?.hide();
    },

    _payload() {
        const o = this._orc;
        const combos = this._totaisCombinados(o);
        const { clienteId, clienteNome, status, dataCotacao, ...dados } = o;
        return {
            clienteId: clienteId || null,
            clienteNome: clienteNome?.trim() || null,
            status, dataCotacao,
            titulo:    o.titulo?.trim()    || this._tituloDoc(o),
            subtitulo: o.subtitulo?.trim() || this._subtituloDoc(o),
            total: combos.length ? Math.min(...combos) : 0,
            dados,
        };
    },

    async salvar() {
        const o = this._orc;
        if (!o.aereos.length && !o.hoteis.length) {
            App.showToast('Adicione ao menos um bloco de aéreo ou uma opção de hotel', 'warning');
            return;
        }
        try {
            const url    = this._editandoId ? `/api/orcamentos/${this._editandoId}` : '/api/orcamentos';
            const method = this._editandoId ? 'PUT' : 'POST';
            const resp   = await apiCall(url, { method, body: JSON.stringify(this._payload()) });
            if (!resp || !resp.ok) {
                const err = await resp?.json().catch(() => ({}));
                throw new Error(err?.message || 'falha ao salvar');
            }
            const { data } = await resp.json();
            this._editandoId = data.id;
            App.showToast('Orçamento salvo!', 'success');
            this.fechar();
            await this._carregar();
        } catch (e) {
            App.showToast('Erro ao salvar: ' + e.message, 'danger');
        }
    },

    trocarAba(aba) {
        this._abaAtiva = aba;
        document.querySelectorAll('#orcEditor [data-aba]').forEach(el =>
            el.classList.toggle('active', el.dataset.aba === aba));
        document.querySelectorAll('#orcEditor [data-painel]').forEach(el =>
            el.classList.toggle('d-none', el.dataset.painel !== aba));
        const ed = document.getElementById('orcEditor');
        if (ed) ed.scrollTop = 0;
    },

    _renderEditor() {
        const el = document.getElementById('orcEditor');
        if (!el) return;
        const scroll = el.scrollTop;
        const o = this._orc;
        const abas = [
            ['geral',      'bi-person-lines-fill', 'Dados gerais'],
            ['aereo',      'bi-airplane',          `Aéreo (${o.aereos.length})`],
            ['hotel',      'bi-building',          `Hospedagem (${o.hoteis.length})`],
            ['fechamento', 'bi-card-checklist',    'Fechamento'],
        ];
        el.innerHTML = `
            <ul class="nav nav-tabs mb-3">
                ${abas.map(([k, ic, lb]) => `
                    <li class="nav-item">
                        <a class="nav-link ${this._abaAtiva === k ? 'active' : ''}" href="javascript:void(0)" data-aba="${k}"
                           onclick="OrcamentosModule.trocarAba('${k}')"><i class="bi ${ic} me-1"></i>${lb}</a>
                    </li>`).join('')}
            </ul>
            <div data-painel="geral"      class="${this._abaAtiva === 'geral' ? '' : 'd-none'}">${this._htmlGeral()}</div>
            <div data-painel="aereo"      class="${this._abaAtiva === 'aereo' ? '' : 'd-none'}">${this._htmlAereos()}</div>
            <div data-painel="hotel"      class="${this._abaAtiva === 'hotel' ? '' : 'd-none'}">${this._htmlHoteis()}</div>
            <div data-painel="fechamento" class="${this._abaAtiva === 'fechamento' ? '' : 'd-none'}">${this._htmlFechamento()}</div>
            <datalist id="orcDlClientes">${this._clientes.map(c => `<option value="${this._esc(c.nome)}">`).join('')}</datalist>
            <datalist id="orcDlCias">${this.CIAS.map(c => `<option value="${c}">`).join('')}</datalist>
            <datalist id="orcDlCafe"><option value="Incluso"><option value="Incluso (buffet)"><option value="Não incluso"></datalist>
            <datalist id="orcDlCancel">
                <option value="Não disponível – tarifa não permite cancelamento, alteração ou reembolso.">
                <option value="Cancelamento gratuito até 48h antes do check-in.">
                <option value="Conforme política do hotel, com multa.">
            </datalist>
            <datalist id="orcDlGrupos">${[...new Set(o.aereos.map(a => this._grupoNome(a)))].map(g => `<option value="${this._esc(g)}">`).join('')}</datalist>`;
        el.scrollTop = scroll;
        this._atualizarCalculos();
    },

    // ── Helpers de campos (data-path liga o input ao objeto em edição) ──
    _campo(path, label, { tipo = 'text', col = 'col-md-6', opcoes = null, attrs = '', ajuda = '', rows = 3 } = {}) {
        const val = this._get(path);
        const id  = 'orc_' + path.replace(/\./g, '_');
        let input;
        if (tipo === 'textarea') {
            input = `<textarea class="form-control form-control-sm" id="${id}" data-path="${path}" rows="${rows}" ${attrs}>${this._esc(val)}</textarea>`;
        } else if (tipo === 'select') {
            input = `<select class="form-select form-select-sm" id="${id}" data-path="${path}" ${attrs}>
                ${opcoes.map(op => { const [v, l] = Array.isArray(op) ? op : [op, op];
                    return `<option value="${this._esc(v)}" ${String(val) === String(v) ? 'selected' : ''}>${this._esc(l)}</option>`; }).join('')}
            </select>`;
        } else if (tipo === 'moeda') {
            input = `<div class="input-group input-group-sm"><span class="input-group-text">R$</span>
                <input type="text" inputmode="numeric" class="form-control text-end" id="${id}" data-path="${path}" data-tipo="moeda"
                       value="${this._fmtInput(val)}" ${attrs}></div>`;
        } else if (tipo === 'checkbox') {
            return `<div class="${col}"><div class="form-check mt-md-4">
                <input class="form-check-input" type="checkbox" id="${id}" data-path="${path}" data-tipo="bool" ${val ? 'checked' : ''} ${attrs}>
                <label class="form-check-label small" for="${id}">${label}</label></div></div>`;
        } else {
            const t = tipo === 'num' ? 'number' : tipo;
            input = `<input type="${t}" class="form-control form-control-sm" id="${id}" data-path="${path}"
                            ${tipo === 'num' ? 'data-tipo="num" min="0"' : ''} value="${this._esc(val)}" ${attrs}>`;
        }
        return `<div class="${col}">
            ${label ? `<label class="form-label small fw-semibold mb-1" for="${id}">${label}</label>` : ''}
            ${input}${ajuda ? `<div class="form-text">${ajuda}</div>` : ''}</div>`;
    },

    // Campo que, vazio, usa o texto automático (placeholder). "Auto" copia o texto para editar.
    _campoAuto(path, label, { col = 'col-12', textarea = false, rows = 3 } = {}) {
        const id  = 'orc_' + path.replace(/\./g, '_');
        const val = this._get(path) || '';
        const auto = this._esc(this._auto(path));
        const input = textarea
            ? `<textarea class="form-control form-control-sm" id="${id}" data-path="${path}" data-auto rows="${rows}" placeholder="${auto}">${this._esc(val)}</textarea>`
            : `<input type="text" class="form-control form-control-sm" id="${id}" data-path="${path}" data-auto value="${this._esc(val)}" placeholder="${auto}">`;
        return `<div class="${col}">
            <label class="form-label small fw-semibold mb-1 d-flex justify-content-between align-items-end" for="${id}">
                <span>${label} <span class="fw-normal text-muted">(vazio = automático)</span></span>
                <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none" title="Copiar o texto automático para o campo e editar"
                        onclick="OrcamentosModule._usarAuto('${path}')"><i class="bi bi-magic"></i> Auto</button>
            </label>
            ${input}</div>`;
    },

    _usarAuto(path) {
        const txt = this._auto(path);
        this._set(path, txt);
        const el = document.getElementById('orc_' + path.replace(/\./g, '_'));
        if (el) { el.value = txt; el.focus(); }
    },

    _htmlGeral() {
        return `
            <div class="row g-3">
                ${this._campo('clienteNome', 'Cliente', { col: 'col-md-6', attrs: 'list="orcDlClientes" autocomplete="off" placeholder="Nome do cliente (busca no cadastro)"' })}
                ${this._campo('dataCotacao', 'Data da cotação', { tipo: 'date', col: 'col-md-3' })}
                ${this._campo('status', 'Status', { tipo: 'select', col: 'col-md-3', opcoes: Object.entries(this.STATUS).map(([k, s]) => [k, s.label]) })}
                ${this._campoAuto('titulo', 'Título do documento', { col: 'col-md-6' })}
                ${this._campoAuto('subtitulo', 'Subtítulo (rota • período)', { col: 'col-md-6' })}
                ${this._campo('saudacao', 'Saudação', { col: 'col-md-4' })}
                ${this._campo('destinatario', 'Destinatário', { tipo: 'textarea', col: 'col-md-8', rows: 3,
                    attrs: 'placeholder="Ex.:\nPrefeitura Municipal de ... — Gabinete\nA/C Sr. Fulano de Tal – Chefe de Gabinete"',
                    ajuda: 'Uma linha por linha do PDF. Vazio = nome do cliente.' })}
                ${this._campoAuto('introducao', 'Texto de introdução', { textarea: true, rows: 5 })}
            </div>`;
    },

    _htmlAereos() {
        const o = this._orc;
        const cards = o.aereos.map((a, i) => this._htmlAereo(a, i)).join('');
        if (this._imp?.aberto && !this._imp.lista && !this._imp.carregando) setTimeout(() => this._impCarregar());
        return `
            <div class="alert alert-light border small py-2">
                <i class="bi bi-info-circle me-1"></i>Cada bloco é uma tarifa cotada. Blocos do <b>mesmo grupo</b>
                (ex.: duas opções de "Ida 24/11") são alternativas — viram <i>Opção 1, Opção 2…</i> e colunas no quadro de total.
                Grupos diferentes (ida, retorno…) se somam. Use <i class="bi bi-copy"></i> para criar uma alternativa a partir de um bloco.
            </div>
            <div class="mb-3">
                <button class="btn btn-primary btn-sm" onclick="OrcamentosModule.impAlternar()">
                    <i class="bi bi-box-arrow-in-down me-1"></i>Importar das cotações salvas
                </button>
            </div>
            <div id="orcImpPainel">${this._imp?.aberto ? this._htmlImportar() : ''}</div>
            ${cards || '<div class="text-center text-muted py-4">Nenhum bloco de aéreo. Importe os voos de uma cotação salva.</div>'}
            <button class="btn btn-link btn-sm px-0" onclick="OrcamentosModule.addAereo()">
                <i class="bi bi-plus-circle me-1"></i>Adicionar bloco manualmente
            </button>`;
    },

    _htmlAereo(a, i) {
        const p = `aereos.${i}`;
        const n = this._orc.aereos.length;
        const opcao = this._opcaoDoBloco(i);
        const vinc = !!a.cotacaoId;
        const voos = vinc ? a.voos.map(v => `<tr>
                <td>${this._esc(v.trecho)}</td><td>${this._esc(v.cia)}</td><td class="fw-semibold">${this._esc(v.voo)}</td>
                <td>${this._esc(this._fmtData(v.data))}</td><td>${this._esc(v.saida)}</td><td>${this._esc(v.chegada)}</td>
                <td>${this._esc(v.origem)}</td><td>${this._esc(v.destino)}</td><td></td></tr>`).join('') : a.voos.map((v, j) => {
            const vp = `${p}.voos.${j}`;
            const c = (campo, attrs = '', tipo = 'text') =>
                `<td><input type="${tipo}" class="form-control form-control-sm" data-path="${vp}.${campo}" id="orc_${vp.replace(/\./g, '_')}_${campo}"
                            value="${this._esc(v[campo])}" ${attrs}></td>`;
            return `<tr>
                <td><select class="form-select form-select-sm" data-path="${vp}.trecho">
                    ${this.TRECHOS.map(t => `<option ${v.trecho === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
                ${c('cia', 'list="orcDlCias" style="min-width:90px"')}
                ${c('voo', 'placeholder="LA 3565" style="min-width:80px"')}
                ${c('data', '', 'date')}
                ${c('saida', '', 'time')}
                ${c('chegada', '', 'time')}
                ${c('origem', 'maxlength="3" placeholder="REC" style="text-transform:uppercase;width:64px"')}
                ${c('destino', 'maxlength="3" placeholder="BSB" style="text-transform:uppercase;width:64px"')}
                <td><button class="btn btn-sm btn-outline-danger" title="Remover voo" onclick="OrcamentosModule.delVoo(${i},${j})"><i class="bi bi-x"></i></button></td>
            </tr>`;
        }).join('');
        const regras = a.regras.map((r, k) => `
            <div class="row g-2 mb-2 align-items-start">
                <div class="col-md-3"><input type="text" class="form-control form-control-sm fw-semibold" data-path="${p}.regras.${k}.rotulo" value="${this._esc(r.rotulo)}" placeholder="Rótulo"></div>
                <div class="col-md-8"><textarea class="form-control form-control-sm" rows="2" data-path="${p}.regras.${k}.texto">${this._esc(r.texto)}</textarea></div>
                <div class="col-md-1"><button class="btn btn-sm btn-outline-danger" title="Remover regra" onclick="OrcamentosModule.delRegra(${i},${k})"><i class="bi bi-x"></i></button></div>
            </div>`).join('');

        return `
            <div class="card mb-3 border-primary-subtle">
                <div class="card-header d-flex justify-content-between align-items-center bg-primary-subtle py-2">
                    <div class="fw-semibold">
                        <i class="bi bi-airplane me-1"></i>Bloco ${i + 1} — <span id="orcAerGrupo_${i}">${this._esc(this._grupoNome(a))}</span>
                        <span class="badge bg-light text-dark border ms-1" id="orcAerOpcao_${i}">${opcao ? 'Opção ' + opcao : 'opção única'}</span>
                        <span class="badge bg-primary ms-1" id="orcAerTot_${i}"></span>
                        ${vinc ? `<span class="badge bg-success-subtle text-success-emphasis border border-success-subtle ms-1" title="Voos e valores vêm desta cotação salva">
                            <i class="bi bi-link-45deg"></i> ${this._esc(a.cotacaoRef || 'Cotação salva')}</span>` : ''}
                    </div>
                    <div class="btn-group btn-group-sm">
                        ${vinc ? `<button class="btn btn-outline-success" title="Reimportar voos e valores da cotação salva" onclick="OrcamentosModule.reimportarAereo(${i})"><i class="bi bi-arrow-repeat"></i></button>
                        <button class="btn btn-outline-secondary" title="Desvincular da cotação para editar os voos à mão" onclick="OrcamentosModule.desvincularAereo(${i})"><i class="bi bi-pencil-square"></i></button>` : ''}
                        <button class="btn btn-outline-secondary" title="Subir" ${i === 0 ? 'disabled' : ''} onclick="OrcamentosModule.moverAereo(${i},-1)"><i class="bi bi-arrow-up"></i></button>
                        <button class="btn btn-outline-secondary" title="Descer" ${i === n - 1 ? 'disabled' : ''} onclick="OrcamentosModule.moverAereo(${i},1)"><i class="bi bi-arrow-down"></i></button>
                        <button class="btn btn-outline-info" title="Duplicar como alternativa (mesmo grupo)" onclick="OrcamentosModule.dupAereo(${i})"><i class="bi bi-copy"></i></button>
                        <button class="btn btn-outline-danger" title="Remover bloco" onclick="OrcamentosModule.delAereo(${i})"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row g-2 mb-3">
                        ${this._campo(`${p}.grupo`, 'Grupo', { col: 'col-md-3', attrs: `list="orcDlGrupos" placeholder="${this._esc(this._grupoAuto(a))}"`, ajuda: 'Vazio = trecho + data do 1º voo' })}
                        ${this._campo(`${p}.passageiros`, 'Passageiros', { tipo: 'num', col: 'col-md-2' })}
                        ${this._campo(`${p}.tipoPax`, 'Tipo', { col: 'col-md-2', attrs: 'placeholder="adultos"' })}
                        ${this._campo(`${p}.classe`, 'Classe', { tipo: 'select', col: 'col-md-2', opcoes: this.CLASSES })}
                        ${this._campo(`${p}.baseTarifaria`, 'Base tarifária', { col: 'col-md-3', attrs: 'placeholder="YJ0X0NI"' })}
                    </div>

                    <div class="table-responsive">
                        <table class="table table-sm align-middle mb-1">
                            <thead class="table-light small"><tr><th>Trecho</th><th>Cia</th><th>Voo</th><th>Data</th><th>Saída</th><th>Chegada</th><th>Origem</th><th>Destino</th><th></th></tr></thead>
                            <tbody>${voos || '<tr><td colspan="9" class="text-muted small text-center">Nenhum voo</td></tr>'}</tbody>
                        </table>
                    </div>
                    ${vinc ? '<div class="small text-muted mb-3"><i class="bi bi-lock me-1"></i>Voos importados da cotação salva. Para alterar, ajuste a cotação e clique em <i class="bi bi-arrow-repeat"></i>, ou desvincule para editar aqui.</div>'
                           : `<button class="btn btn-link btn-sm px-0 mb-3" onclick="OrcamentosModule.addVoo(${i})"><i class="bi bi-plus"></i> Adicionar voo / conexão</button>`}

                    <div class="row g-2 mb-3">
                        ${this._campoAuto(`${p}.titulo`, 'Título do bloco no PDF', { col: 'col-md-8' })}
                        ${this._campo(`${p}.subtitulo`, 'Subtítulo (opcional)', { col: 'col-md-4', attrs: 'placeholder="Ex.: LATAM Airlines – voo direto"' })}
                        ${this._campoAuto(`${p}.infoLinha`, 'Linha de informações (passageiros, classe, duração, horários)', { textarea: true, rows: 2 })}
                    </div>

                    <div class="small fw-semibold mb-1">Regras e condições <span class="fw-normal text-muted">— use {cia} e {base} para companhia e base tarifária</span></div>
                    ${regras}
                    <button class="btn btn-link btn-sm px-0 mb-3" onclick="OrcamentosModule.addRegra(${i})"><i class="bi bi-plus"></i> Adicionar regra</button>

                    <div class="row g-2 align-items-end">
                        ${this._campo(`${p}.modoValor`, 'Valores informados', { tipo: 'select', col: 'col-md-2',
                            opcoes: [['pax', 'Por passageiro'], ['total', 'Total do bloco']] })}
                        ${this._campo(`${p}.tarifa`, a.modoValor === 'total' ? 'Tarifa (total)' : 'Tarifa por passageiro', { tipo: 'moeda', col: 'col-md-3' })}
                        ${this._campo(`${p}.taxas`, a.modoValor === 'total' ? 'Taxas e encargos (total)' : 'Taxas e encargos por passageiro', { tipo: 'moeda', col: 'col-md-3' })}
                        <div class="col-md-4 small" id="orcAerCalc_${i}"></div>
                    </div>
                </div>
            </div>`;
    },

    _htmlHoteis() {
        const o = this._orc;
        return `
            <div class="row g-2 mb-3">
                ${this._campoAuto('tituloHospedagem', 'Título da seção de hospedagem', { col: 'col-md-8' })}
                ${this._campo('estrelasMinimas', 'Categoria mínima exigida', { tipo: 'select', col: 'col-md-4',
                    opcoes: [['', '— não informar —'], ['2', '2 estrelas'], ['3', '3 estrelas'], ['4', '4 estrelas'], ['5', '5 estrelas']] })}
            </div>
            ${o.hoteis.map((h, i) => this._htmlHotel(h, i)).join('') || '<div class="text-center text-muted py-4">Nenhuma opção de hotel.</div>'}
            <button class="btn btn-outline-primary btn-sm" onclick="OrcamentosModule.addHotel()">
                <i class="bi bi-plus-circle me-1"></i>Adicionar opção de hotel
            </button>`;
    },

    _htmlHotel(h, i) {
        const p = `hoteis.${i}`;
        return `
            <div class="card mb-3 border-warning-subtle">
                <div class="card-header d-flex justify-content-between align-items-center bg-warning-subtle py-2">
                    <div class="fw-semibold"><i class="bi bi-building me-1"></i>Opção ${i + 1}${h.nome ? ' — ' + this._esc(h.nome) : ''}
                        <span class="badge bg-primary ms-1" id="orcHotTot_${i}"></span></div>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info" title="Duplicar opção" onclick="OrcamentosModule.dupHotel(${i})"><i class="bi bi-copy"></i></button>
                        <button class="btn btn-outline-danger" title="Remover opção" onclick="OrcamentosModule.delHotel(${i})"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row g-2">
                        ${this._campo(`${p}.nome`, 'Hotel', { col: 'col-md-5', attrs: 'placeholder="Ex.: Hotel Salute"' })}
                        ${this._campo(`${p}.local`, 'Cidade / bairro', { col: 'col-md-4', attrs: 'placeholder="Brasília/DF"' })}
                        ${this._campo(`${p}.estrelas`, 'Categoria', { tipo: 'select', col: 'col-md-3',
                            opcoes: [['0', '— não informar —'], ['1', '1 estrela'], ['2', '2 estrelas'], ['3', '3 estrelas'], ['4', '4 estrelas'], ['5', '5 estrelas']] })}
                        ${this._campo(`${p}.checkin`, 'Check-in', { tipo: 'date', col: 'col-md-3' })}
                        ${this._campo(`${p}.checkout`, 'Check-out', { tipo: 'date', col: 'col-md-3' })}
                        ${this._campo(`${p}.hospedes`, 'Hóspedes', { tipo: 'num', col: 'col-md-2' })}
                        ${this._campo(`${p}.quartos`, 'Quartos', { tipo: 'num', col: 'col-md-2' })}
                        <div class="col-md-2 small"><label class="form-label small fw-semibold mb-1">Noites</label>
                            <div class="form-control form-control-sm bg-light" id="orcHotNoites_${i}">—</div></div>
                        ${this._campo(`${p}.acomodacao`, 'Acomodação', { col: 'col-md-6', attrs: 'placeholder="1 quarto single + 1 quarto duplo (twin ou casal) – Suítes"' })}
                        ${this._campo(`${p}.cafe`, 'Café da manhã', { col: 'col-md-3', attrs: 'list="orcDlCafe"' })}
                        ${this._campo(`${p}.valorTotal`, 'Valor total da hospedagem', { tipo: 'moeda', col: 'col-md-3' })}
                        ${this._campo(`${p}.cancelamento`, 'Cancelamento', { col: 'col-md-8', attrs: 'list="orcDlCancel"' })}
                        ${this._campo(`${p}.cancelDestaque`, 'Destacar em vermelho (não reembolsável)', { tipo: 'checkbox', col: 'col-md-4' })}
                        ${this._campo(`${p}.observacao`, 'Observações (opcional)', { col: 'col-12' })}
                        ${this._campoAuto(`${p}.titulo`, 'Título da opção', { col: 'col-md-5' })}
                        ${this._campoAuto(`${p}.subtitulo`, 'Linha de categoria', { col: 'col-md-7' })}
                        <div class="col-12 small text-muted" id="orcHotCalc_${i}"></div>
                    </div>
                </div>
            </div>`;
    },

    _htmlFechamento() {
        return `
            <div class="row g-3">
                ${this._campo('mostrarTotal', 'Exibir quadro "Valor total da cotação" (combinações aéreo + hospedagem)', { tipo: 'checkbox', col: 'col-12' })}
                <div class="col-12"><div class="border rounded p-2 bg-light small" id="orcPreviaTotal"></div></div>
                ${this._campo('infoComplementares', 'Informações complementares', { tipo: 'textarea', col: 'col-12', rows: 5, ajuda: 'Uma informação por linha (vira um tópico no PDF).' })}
                ${this._campo('avisoTitulo', 'Aviso — título', { col: 'col-12' })}
                ${this._campo('avisoTexto', 'Aviso — texto', { tipo: 'textarea', col: 'col-12', rows: 3, ajuda: '{data} = data da cotação. Deixe o título e o texto vazios para não exibir o aviso.' })}
                ${this._campo('encerramento', 'Encerramento', { col: 'col-12' })}
                ${this._campo('assinaturaNome', 'Assinatura — nome', { col: 'col-md-5' })}
                ${this._campo('assinaturaLinhas', 'Assinatura — linhas abaixo do nome', { tipo: 'textarea', col: 'col-md-7', rows: 2 })}
            </div>`;
    },

    // ── Importação das cotações salvas (/api/cotacoes) ──
    // Cada cotação vira um bloco de aéreo vinculado (cotacaoId). Cotações com
    // o mesmo 1º trecho/data caem no mesmo grupo → viram Opção 1, 2…
    impAlternar() {
        this._imp.aberto = !this._imp.aberto;
        this._renderImportar();
        if (this._imp.aberto && !this._imp.lista) this._impCarregar();
    },

    _renderImportar() {
        const el = document.getElementById('orcImpPainel');
        if (!el) return;
        const filtroAtivo = document.activeElement?.id === 'orcImpFiltro';
        el.innerHTML = this._imp.aberto ? this._htmlImportar() : '';
        if (filtroAtivo) { const f = document.getElementById('orcImpFiltro'); f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    },

    async _impCarregar() {
        const imp = this._imp;
        imp.carregando = true; imp.erro = null; this._renderImportar();
        try {
            const qs = new URLSearchParams({ limit: 100 });
            if (imp.filtro) qs.append('busca', imp.filtro);
            const resp = await apiCall(`/api/cotacoes?${qs}`);
            if (!resp || !resp.ok) throw new Error('HTTP ' + (resp && resp.status));
            const json = await resp.json();
            const parse = (v, d) => { if (v == null || v === '') return d; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch (_) { return d; } };
            imp.lista = (json.data || []).map(c => ({ ...c, voos: parse(c.voos, []), passageiros: parse(c.passageiros, {}), dadosPdf: parse(c.dadosPdf, null) }));
            // Cotações do cliente do orçamento primeiro
            const cli = (this._orc.clienteNome || '').trim().toLowerCase();
            if (cli) imp.lista.sort((a, b) => (this._impNomeCliente(b).toLowerCase() === cli) - (this._impNomeCliente(a).toLowerCase() === cli));
        } catch (e) {
            imp.erro = e.message;
        } finally {
            imp.carregando = false; this._renderImportar();
        }
    },

    impFiltrar(v) {
        this._imp.filtro = (v || '').trim();
        clearTimeout(this._imp.timer);
        this._imp.timer = setTimeout(() => this._impCarregar(), 400);
    },

    impToggle(id, marcado) {
        if (marcado) this._imp.sel.add(id); else this._imp.sel.delete(id);
        this._renderImportar();
    },

    _impNomeCliente(c) {
        return c.dadosPdf?.cliente?.nome || c.clienteNome || c.cliente?.nome
            || (c.observacoes || '').replace(/^Cliente:\s*/, '').split('|')[0].trim() || '';
    },

    _impTotal(c) { return Number(c.dadosPdf?.precos?.total ?? c.total) || 0; },

    _htmlImportar() {
        const imp = this._imp;
        const usados = new Set(this._orc.aereos.map(a => a.cotacaoId).filter(Boolean));
        let corpo;
        if (imp.carregando && !imp.lista) corpo = '<div class="text-muted small text-center py-3"><span class="spinner-border spinner-border-sm me-2"></span>Carregando cotações...</div>';
        else if (imp.erro) corpo = `<div class="text-danger small text-center py-3">Erro ao carregar cotações: ${this._esc(imp.erro)}</div>`;
        else if (!imp.lista?.length) corpo = `<div class="text-muted small text-center py-3">${imp.filtro ? 'Nenhuma cotação para esse filtro.' : 'Nenhuma cotação salva. Salve as cotações na página Cotação / Busca de Voos.'}</div>`;
        else corpo = `
            <div class="table-responsive" style="max-height:320px;overflow:auto">
                <table class="table table-sm table-hover align-middle mb-0 small">
                    <thead class="table-light" style="position:sticky;top:0"><tr><th></th><th>Salva em</th><th>Cliente</th><th>Voos</th><th>Pax</th><th class="text-end">Total</th></tr></thead>
                    <tbody>${imp.lista.map(c => {
                        const voos = (c.dadosPdf?.voos || c.voos || []).map(v => this._impNormVoo(v));
                        const desc = voos.map((v, k) => `<div class="text-nowrap"><span class="text-muted">${k === 0 && v.tipo !== 'volta' ? 'Ida' : 'Volta'}</span>
                            <b>${this._esc(v.origem)}→${this._esc(v.destino)}</b> ${this._esc(this._fmtData(this._impDH(v.dataPartida).data))}
                            ${this._esc(this._impDH(v.dataPartida).hora)} · ${this._esc(v.companhiaNome || v.companhia)} ${this._esc(v.numeroVoo)}</div>`).join('') || '—';
                        const pax = this._impPax(c);
                        const marc = imp.sel.has(c.id);
                        return `<tr class="${marc ? 'table-active' : ''}">
                            <td><input type="checkbox" class="form-check-input" ${marc ? 'checked' : ''} onchange="OrcamentosModule.impToggle('${c.id}', this.checked)"></td>
                            <td class="text-nowrap">${this._esc(this._fmtData(String(c.createdAt || '').slice(0, 10)))}</td>
                            <td>${this._esc(this._impNomeCliente(c) || '—')}${usados.has(c.id) ? ' <span class="badge bg-success-subtle text-success-emphasis">já no orçamento</span>' : ''}</td>
                            <td>${desc}</td>
                            <td>${pax.total}</td>
                            <td class="text-end fw-semibold text-nowrap">${this._fmtMoeda(this._impTotal(c))}</td>
                        </tr>`;
                    }).join('')}</tbody>
                </table>
            </div>`;
        const n = imp.sel.size;
        return `
            <div class="card border-primary mb-3">
                <div class="card-header bg-white d-flex flex-wrap gap-2 align-items-center justify-content-between py-2">
                    <span class="fw-semibold"><i class="bi bi-bookmark-check text-primary me-1"></i>Cotações salvas</span>
                    <div class="d-flex gap-2">
                        <input type="text" class="form-control form-control-sm" id="orcImpFiltro" style="max-width:220px" placeholder="Filtrar por cliente"
                               value="${this._esc(imp.filtro)}" oninput="OrcamentosModule.impFiltrar(this.value)">
                        <button class="btn btn-sm btn-outline-secondary" title="Atualizar" onclick="OrcamentosModule._impCarregar()"><i class="bi bi-arrow-clockwise"></i></button>
                    </div>
                </div>
                <div class="card-body p-0">${corpo}</div>
                <div class="card-footer bg-white d-flex justify-content-between align-items-center py-2">
                    <span class="small text-muted">Cada cotação vira um bloco. Cotações de ida e volta, ou só de ida na mesma data, viram alternativas (Opção 1, 2…).</span>
                    <button class="btn btn-sm btn-primary" ${n ? '' : 'disabled'} onclick="OrcamentosModule.impImportar()">
                        <i class="bi bi-box-arrow-in-down me-1"></i>Importar selecionadas (${n})
                    </button>
                </div>
            </div>`;
    },

    impImportar() {
        const imp = this._imp, o = this._orc;
        const escolhidas = (imp.lista || []).filter(c => imp.sel.has(c.id))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        if (!escolhidas.length) return;
        escolhidas.forEach(c => o.aereos.push(this._blocoDaCotacao(c)));
        // Orçamento sem cliente: herda o da 1ª cotação
        if (!o.clienteNome) {
            const c = escolhidas[0];
            o.clienteNome = this._impNomeCliente(c);
            o.clienteId = c.clienteId || this._clientes.find(x => (x.nome || '').trim().toLowerCase() === o.clienteNome.toLowerCase())?.id || null;
        }
        imp.sel.clear(); imp.aberto = false;
        this._renderEditor();
        App.showToast(`${escolhidas.length} cotação(ões) importada(s) para o aéreo`, 'success');
    },

    async reimportarAereo(i) {
        const a = this._orc.aereos[i];
        if (!a?.cotacaoId) return;
        try {
            const resp = await apiCall(`/api/cotacoes/${a.cotacaoId}`);
            if (resp && resp.status === 404) throw new Error('a cotação foi excluída');
            if (!resp || !resp.ok) throw new Error('HTTP ' + (resp && resp.status));
            const novo = this._blocoDaCotacao((await resp.json()).data);
            // Mantém textos ajustados no orçamento; atualiza voos, passageiros e valores
            Object.assign(a, { voos: novo.voos, passageiros: novo.passageiros, tipoPax: novo.tipoPax, classe: novo.classe,
                modoValor: novo.modoValor, tarifa: novo.tarifa, taxas: novo.taxas, cotacaoRef: novo.cotacaoRef });
            this._renderEditor();
            App.showToast('Bloco atualizado com a cotação salva', 'success');
        } catch (e) {
            App.showToast('Não foi possível reimportar: ' + e.message, 'danger');
        }
    },

    desvincularAereo(i) {
        if (!confirm('Desvincular este bloco da cotação salva? Os voos passam a ser editados aqui.')) return;
        const a = this._orc.aereos[i];
        delete a.cotacaoId; delete a.cotacaoRef;
        this._renderEditor();
    },

    _impPax(c) {
        const p = c.dadosPdf?.passageiros || c.passageiros || {};
        const ad = +p.adultos || 0, cr = +p.criancas || 0, be = +p.bebes || 0;
        const total = +c.dadosPdf?.precos?.totalPax || (ad + cr + be) || 1;
        return { ad, cr, be, total };
    },

    // Voo da cotação pode vir no formato normalizado ou aninhado (SerpAPI etc.)
    _impNormVoo(v) {
        if (typeof QuotationModule !== 'undefined' && QuotationModule._normalizarVoo) {
            try { return QuotationModule._normalizarVoo(v); } catch (_) { /* usa o fallback */ }
        }
        const obj = (x) => (x && typeof x === 'object' ? x : {});
        return { ...v,
            companhia: obj(v.companhia).codigo || v.companhia || '', companhiaNome: obj(v.companhia).nome || v.companhiaNome || '',
            numeroVoo: v.numero || v.numeroVoo || '', origem: obj(v.origem).codigo || v.origem || '', destino: obj(v.destino).codigo || v.destino || '',
            dataPartida: v.dataPartida || obj(v.partida).timestamp || '', dataChegada: v.dataChegada || obj(v.chegada).timestamp || '' };
    },

    // "2026-11-23T20:50:00" → {data:'2026-11-23', hora:'20:50'} sem conversão de fuso;
    // com Z/offset converte para o horário local
    _impDH(s) {
        s = String(s || '');
        if (!s) return { data: '', hora: '' };
        if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
            const d = new Date(s);
            if (!isNaN(d)) {
                const p = n => String(n).padStart(2, '0');
                return { data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, hora: `${p(d.getHours())}:${p(d.getMinutes())}` };
            }
        }
        const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
        return m ? { data: m[1], hora: m[2] || '' } : { data: '', hora: '' };
    },

    _impCia(codigo, nome) {
        const cod = String(codigo || '').toUpperCase();
        return this.CIA_POR_CODIGO[cod] || nome || (typeof getAirlineName === 'function' && cod ? getAirlineName(cod) : '') || cod;
    },

    _impNumVoo(codigo, numero) {
        const n = String(numero || '').trim().toUpperCase();
        const cod = String(codigo || '').trim().toUpperCase();
        const m = n.match(/^([A-Z0-9]{2})\s*(\d+)$/);
        if (m && isNaN(+m[1])) return `${m[1]} ${m[2]}`;
        return [cod.length === 2 ? cod : '', n].filter(Boolean).join(' ');
    },

    // Cotação salva → bloco de aéreo do orçamento
    _blocoDaCotacao(c) {
        const parse = (v, pad) => { if (v == null || v === '') return pad; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch (_) { return pad; } };
        c = { ...c, voos: parse(c.voos, []), passageiros: parse(c.passageiros, {}), dadosPdf: parse(c.dadosPdf, null) };
        const d = c.dadosPdf || {};
        const voosCot = (Array.isArray(d.voos) && d.voos.length ? d.voos : (Array.isArray(c.voos) ? c.voos : [])).map(v => this._impNormVoo(v));
        const linhas = [];
        voosCot.forEach((v, k) => {
            const trecho = v.tipo === 'volta' || (k > 0 && v.tipo !== 'ida') ? 'Retorno' : 'Ida';
            const segs = Array.isArray(v.segmentos) && v.segmentos.length > 1 ? v.segmentos
                : [{ companhia: v.companhia, numeroVoo: v.numeroVoo, origem: v.origem, destino: v.destino, partida: v.dataPartida, chegada: v.dataChegada }];
            segs.forEach(s => {
                const codCia = s.companhia || v.companhia;
                const p = this._impDH(s.partida || s.dataPartida), q = this._impDH(s.chegada || s.dataChegada);
                linhas.push({ trecho, cia: this._impCia(codCia, s.companhia ? '' : v.companhiaNome),
                    voo: this._impNumVoo(codCia, s.numeroVoo || s.numero), data: p.data, saida: p.hora, chegada: q.hora,
                    origem: String(s.origem || '').toUpperCase(), destino: String(s.destino || '').toUpperCase() });
            });
        });

        const pax = this._impPax(c);
        const pr = d.precos || {};
        const tarifa = d.tarifa || {};
        const bag = (+pr.qtdBagagens || 0) * (+pr.valorBagagem || 0);
        const total = this._impTotal(c);
        let modoValor = 'pax', vTarifa = 0, vTaxas = 0;
        if (pr.valorPorPessoa != null) {
            const tpp = +pr.taxaPorPessoa || 0, vpp = +pr.valorPorPessoa || 0;
            if (!bag && Math.abs((vpp + tpp) * pax.total - total) < 0.01) { vTarifa = vpp; vTaxas = tpp; }
            else { modoValor = 'total'; vTaxas = Math.round(tpp * pax.total * 100) / 100; vTarifa = Math.round((total - vTaxas) * 100) / 100; }
        } else {
            // Cotação antiga: só subtotal/taxas/total gravados
            modoValor = 'total'; vTaxas = +c.taxas || 0; vTarifa = Math.round((total - vTaxas) * 100) / 100;
        }

        const regras = this.REGRAS_AEREO_PADRAO.map(r => ({ ...r }));
        const qBag = +pr.qtdBagagens || 0;
        if (qBag > 0) regras[0].texto = `Bagagem de mão de até 10 kg + 1 item pessoal por passageiro inclusos. Inclui ${qBag} ${qBag > 1 ? 'bagagens despachadas' : 'bagagem despachada'} de 23 kg.`;
        if (tarifa.semReembolso === false) regras[1].texto = 'Tarifa reembolsável, conforme regras tarifárias da {cia} (base {base}); pode haver multa e eventual diferença tarifária em alterações. Taxa de embarque reembolsável em caso de não utilização.';

        const classeVoo = { economica: 'Econômica', premium: 'Premium Economy', executiva: 'Executiva', primeira: 'Primeira Classe' }[String(voosCot[0]?.classe || '').toLowerCase()];
        const tipoPax = pax.cr || pax.be
            ? [pax.ad && `${pax.ad} adulto${pax.ad > 1 ? 's' : ''}`, pax.cr && `${pax.cr} criança${pax.cr > 1 ? 's' : ''}`, pax.be && `${pax.be} bebê${pax.be > 1 ? 's' : ''}`].filter(Boolean).join(' + ')
            : 'adultos';
        const cli = this._impNomeCliente(c);

        return {
            ...this._novoAereo(true),
            passageiros: pax.total, tipoPax,
            classe: this.CLASSES.includes(tarifa.tipo) ? tarifa.tipo : (classeVoo || 'Econômica'),
            voos: linhas, regras, modoValor, tarifa: vTarifa, taxas: vTaxas,
            cotacaoId: c.id,
            cotacaoRef: `Cotação de ${this._fmtData(String(c.createdAt || '').slice(0, 10))}${cli ? ' — ' + cli : ''}`,
        };
    },

    // ── Ações estruturais (re-renderizam o editor) ──
    addAereo()          { this._orc.aereos.push(this._novoAereo()); this._renderEditor(); },
    delAereo(i)         { if (confirm('Remover este bloco de aéreo?')) { this._orc.aereos.splice(i, 1); this._renderEditor(); } },
    dupAereo(i) {
        const a = JSON.parse(JSON.stringify(this._orc.aereos[i]));
        a.grupo = this._grupoNome(this._orc.aereos[i]);   // fixa o grupo: a cópia é alternativa do original
        this._orc.aereos[i].grupo = a.grupo;
        a.titulo = ''; a.infoLinha = '';
        this._orc.aereos.splice(i + 1, 0, a);
        this._renderEditor();
    },
    moverAereo(i, d) {
        const arr = this._orc.aereos, j = i + d;
        if (j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        this._renderEditor();
    },
    addVoo(i) {
        const a = this._orc.aereos[i], ult = a.voos[a.voos.length - 1];
        const v = this._novoVoo(ult?.trecho || 'Ida');
        if (ult) { v.origem = ult.destino; v.data = ult.data; v.cia = ult.cia; }
        a.voos.push(v);
        this._renderEditor();
    },
    delVoo(i, j)        { this._orc.aereos[i].voos.splice(j, 1); this._renderEditor(); },
    addRegra(i)         { this._orc.aereos[i].regras.push({ rotulo: '', texto: '' }); this._renderEditor(); },
    delRegra(i, k)      { this._orc.aereos[i].regras.splice(k, 1); this._renderEditor(); },
    addHotel()          { this._orc.hoteis.push(this._novoHotel()); this._renderEditor(); },
    dupHotel(i) {
        const h = JSON.parse(JSON.stringify(this._orc.hoteis[i]));
        h.nome = ''; h.valorTotal = 0; h.titulo = ''; h.subtitulo = '';
        this._orc.hoteis.splice(i + 1, 0, h);
        this._renderEditor();
    },
    delHotel(i)         { if (confirm('Remover esta opção de hotel?')) { this._orc.hoteis.splice(i, 1); this._renderEditor(); } },

    // ── Edição campo a campo (sem re-render, para não perder o foco) ──
    _onInput(e) {
        const el = e.target;
        const path = el.dataset?.path;
        if (!path) return;
        let val;
        if (el.dataset.tipo === 'bool')       val = el.checked;
        else if (el.dataset.tipo === 'num')   val = Math.max(0, parseInt(el.value, 10) || 0);
        else if (el.dataset.tipo === 'moeda') { this._mascaraMoeda(el); val = this._parseMoeda(el.value); }
        else                                  val = el.value;

        if (/\.(origem|destino)$/.test(path)) { val = val.toUpperCase(); }
        this._set(path, val);

        // Trocar por passageiro ↔ total muda os rótulos dos campos de valor
        if (/^aereos\.\d+\.modoValor$/.test(path)) { this._renderEditor(); return; }

        // Nº do voo "LA 3565" com cia vazia → preenche a companhia
        const mVoo = path.match(/^aereos\.(\d+)\.voos\.(\d+)\.voo$/);
        if (mVoo) {
            const v = this._orc.aereos[+mVoo[1]].voos[+mVoo[2]];
            const cod = (val.trim().match(/^([A-Z0-9]{2})\s*\d/i) || [])[1]?.toUpperCase();
            if (cod && !v.cia) {
                const cia = this.CIA_POR_CODIGO[cod] || (typeof getAirlineName === 'function' ? getAirlineName(cod) : '');
                if (cia && cia !== cod) {
                    v.cia = cia;
                    const ciaEl = document.getElementById(`orc_aereos_${mVoo[1]}_voos_${mVoo[2]}_cia`);
                    if (ciaEl) ciaEl.value = cia;
                }
            }
        }
        // Cliente digitado bate com o cadastro → vincula (e usa como destinatário se vazio)
        if (path === 'clienteNome') {
            const c = this._clientes.find(x => (x.nome || '').trim().toLowerCase() === val.trim().toLowerCase());
            this._orc.clienteId = c ? c.id : null;
        }
        this._atualizarCalculos();
    },

    // Recalcula números/placeholders exibidos no editor
    _atualizarCalculos() {
        const o = this._orc;
        if (!o) return;
        const setHTML = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

        o.aereos.forEach((a, i) => {
            const v = this._valoresAereo(a);
            setHTML(`orcAerTot_${i}`, this._fmtMoeda(v.total));
            setHTML(`orcAerGrupo_${i}`, this._esc(this._grupoNome(a)));
            const op = this._opcaoDoBloco(i);
            setHTML(`orcAerOpcao_${i}`, op ? 'Opção ' + op : 'opção única');
            setHTML(`orcAerCalc_${i}`, `
                <div class="border rounded px-2 py-1 bg-light">
                    Por passageiro: <b>${this._fmtMoeda(v.porPax)}</b> &nbsp;•&nbsp;
                    Total (${a.passageiros || 0} pax): <b class="text-primary">${this._fmtMoeda(v.total)}</b>
                </div>`);
            const grupoEl = document.getElementById(`orc_aereos_${i}_grupo`);
            if (grupoEl) grupoEl.placeholder = this._grupoAuto(a);
        });
        o.hoteis.forEach((h, i) => {
            const n = this._noites(h);
            setHTML(`orcHotTot_${i}`, this._fmtMoeda(h.valorTotal));
            setHTML(`orcHotNoites_${i}`, n || '—');
            setHTML(`orcHotCalc_${i}`, n && h.quartos
                ? `Diária média por quarto: <b>${this._fmtMoeda(this._diariaMedia(h))}</b> (total ÷ ${h.quartos} quarto(s) × ${n} noite(s))` : '');
        });
        // Placeholders dos campos automáticos
        document.querySelectorAll('#orcEditor [data-auto]').forEach(el => { el.placeholder = this._auto(el.dataset.path); });

        // Prévia do quadro de totais + rodapé
        const combos = this._combinacoesAereo(o);
        const totais = this._totaisCombinados(o);
        setHTML('orcPreviaTotal', this._htmlPreviaTotal(o, combos));
        setHTML('orcResumo', totais.length
            ? `<i class="bi bi-calculator me-1"></i>${totais.length > 1 ? `${totais.length} combinações • de <b>${this._fmtMoeda(Math.min(...totais))}</b> a <b>${this._fmtMoeda(Math.max(...totais))}</b>` : `Total: <b>${this._fmtMoeda(totais[0])}</b>`}`
            : '');
    },

    _htmlPreviaTotal(o, combos) {
        if (!combos.length && !o.hoteis.length) return '<span class="text-muted">Sem valores ainda.</span>';
        const linhas = [];
        if (combos.length && o.hoteis.length) {
            o.hoteis.forEach((h, k) => combos.forEach(c =>
                linhas.push([`${this._esc(this._tituloHotel(k))} + ${this._esc(c.rotulo)}`, c.total + (+h.valorTotal || 0)])));
        } else if (combos.length) {
            combos.forEach(c => linhas.push([this._esc(c.rotulo), c.total]));
        } else {
            o.hoteis.forEach((h, k) => linhas.push([this._esc(this._tituloHotel(k)), +h.valorTotal || 0]));
        }
        return `<div class="fw-semibold mb-1">Prévia do valor total</div>` +
            linhas.map(([l, v]) => `<div class="d-flex justify-content-between"><span>${l}</span><b>${this._fmtMoeda(v)}</b></div>`).join('');
    },

    // ══════════════════════════════════════════════════════════════════
    // Cálculos e textos automáticos
    // ══════════════════════════════════════════════════════════════════
    _r2: v => Math.round((+v || 0) * 100) / 100,

    // modoValor 'pax' (padrão): tarifa/taxas digitadas por passageiro → total = × pax.
    // modoValor 'total': digitados os totais do bloco (como a cia mostra) → por pax = ÷ pax,
    // sem a diferença de centavos que a multiplicação gera.
    _valoresAereo(a) {
        const pax = +a.passageiros || 0;
        const tarifa = +a.tarifa || 0, taxas = +a.taxas || 0;
        if (a.modoValor === 'total') {
            const div = v => pax > 0 ? this._r2(v / pax) : 0;
            return { tarifaPax: div(tarifa), taxasPax: div(taxas), porPax: div(tarifa + taxas),
                     tarifaTot: this._r2(tarifa), taxasTot: this._r2(taxas), total: this._r2(tarifa + taxas) };
        }
        const tarifaTot = this._r2(tarifa * pax);
        const taxasTot  = this._r2(taxas * pax);
        return { tarifaPax: this._r2(tarifa), taxasPax: this._r2(taxas), porPax: this._r2(tarifa + taxas),
                 tarifaTot, taxasTot, total: this._r2(tarifaTot + taxasTot) };
    },

    _noites(h) {
        if (!h.checkin || !h.checkout) return 0;
        const d = Math.round((new Date(h.checkout + 'T12:00:00') - new Date(h.checkin + 'T12:00:00')) / 86400000);
        return d > 0 ? d : 0;
    },

    _diariaMedia(h) {
        const div = (+h.quartos || 0) * this._noites(h);
        return div > 0 ? this._r2((+h.valorTotal || 0) / div) : 0;
    },

    _maxPax(o) {
        return o ? Math.max(0, ...o.aereos.map(a => +a.passageiros || 0)) : 0;
    },

    _grupoAuto(a) {
        const v = a.voos?.[0];
        if (!v) return 'Aéreo';
        const pernas = this._pernas(a);
        if (pernas.length > 1) {
            // Ida e volta no mesmo bloco (cotação de ida e volta): "Ida e Retorno".
            // Sem datas: cotações ida+volta em datas diferentes são alternativas entre si.
            const nomes = pernas.map(p => p.trecho);
            return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
        }
        return [v.trecho || 'Trecho', v.data ? this._fmtDM(v.data) : ''].filter(Boolean).join(' ');
    },

    // Voos consecutivos do mesmo trecho formam uma perna (ida, retorno…);
    // dentro da perna, voos a mais são conexões
    _pernas(a) {
        const out = [];
        (a.voos || []).forEach(v => {
            const t = (v.trecho || 'Trecho').trim();
            const ult = out[out.length - 1];
            if (ult && ult.trecho === t) ult.voos.push(v); else out.push({ trecho: t, voos: [v] });
        });
        return out;
    },

    _grupoNome(a) { return (a.grupo || '').trim() || this._grupoAuto(a); },

    // Grupos na ordem em que aparecem; blocos do mesmo grupo = alternativas
    _grupos(o) {
        const mapa = new Map();
        o.aereos.forEach((a, i) => {
            const nome = this._grupoNome(a);
            const key  = nome.toLowerCase();
            if (!mapa.has(key)) mapa.set(key, { nome, blocos: [] });
            mapa.get(key).blocos.push({ a, i });
        });
        return [...mapa.values()];
    },

    // Nº da opção do bloco dentro do grupo (0 quando é a única)
    _opcaoDoBloco(i) {
        const a = this._orc.aereos[i];
        const g = this._grupos(this._orc).find(g => g.blocos.some(b => b.a === a));
        return g && g.blocos.length > 1 ? g.blocos.findIndex(b => b.a === a) + 1 : 0;
    },

    // Produto cartesiano das opções de cada grupo
    _combinacoesAereo(o) {
        const grupos = this._grupos(o);
        if (!grupos.length) return [];
        let combos = [[]];
        grupos.forEach(g => { combos = combos.flatMap(c => g.blocos.map((b, k) => [...c, { g, b, k }])); });
        return combos.map(partes => ({
            partes,
            total: this._r2(partes.reduce((s, p) => s + this._valoresAereo(p.b.a).total, 0)),
            rotulo: partes.filter(p => p.g.blocos.length > 1).map(p => {
                const saida = p.b.a.voos?.[0]?.saida;
                return `${p.g.nome} – Opção ${p.k + 1}${saida ? ` (${saida})` : ''}`;
            }).join(' + ') || 'Aéreo',
        }));
    },

    _totaisCombinados(o) {
        const combos = this._combinacoesAereo(o);
        const hoteis = o.hoteis.map(h => +h.valorTotal || 0);
        if (combos.length && hoteis.length) return combos.flatMap(c => hoteis.map(h => this._r2(c.total + h)));
        if (combos.length) return combos.map(c => c.total);
        return hoteis;
    },

    _cidade(cod) {
        if (!cod) return '';
        const ap = typeof getAirportByCode === 'function' ? getAirportByCode(cod) : null;
        return ap?.city || cod.toUpperCase();
    },

    _duracaoVoo(a) {
        const v0 = a.voos[0], vN = a.voos[a.voos.length - 1];
        if (!v0?.data || !v0.saida || !vN?.chegada) return 0;
        const ini = new Date(`${v0.data}T${v0.saida}:00`);
        let fim = new Date(`${vN.data || v0.data}T${vN.chegada}:00`);
        if (fim <= ini) fim = new Date(fim.getTime() + 86400000);   // chegada no dia seguinte
        const min = Math.round((fim - ini) / 60000);
        return min > 0 && min < 48 * 60 ? min : 0;
    },

    _fmtDur(min) { return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`; },

    _escalasTxt(a, maiusc = false) {
        const n = Math.max(0, a.voos.length - 1);
        const t = n === 0 ? 'voo direto' : n === 1 ? '1 conexão' : `${n} conexões`;
        return maiusc ? t.toUpperCase() : t;
    },

    _ciaBloco(a, sep = ' e ') { return [...new Set(a.voos.map(v => (v.cia || '').trim()).filter(Boolean))].join(sep); },

    _subst(txt, a) {
        const cia = this._ciaBloco(a) || 'companhia aérea';
        const base = (a.baseTarifaria || '').trim();
        let t = String(txt || '').replace(/\{cia\}/g, cia);
        t = base ? t.replace(/\{base\}/g, base) : t.replace(/\s*\(base \{base\}\)/g, '').replace(/\{base\}/g, '');
        return t;
    },

    _plural(n, s, p) { return `${n} ${n === 1 ? s : (p || s + 's')}`; },

    _porExtenso(n) {
        const nomes = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'];
        return n >= 0 && n <= 10 ? `${n} (${nomes[n]})` : String(n);
    },

    _auto(path) {
        const o = this._orc;
        if (!o) return '';
        const m = path.match(/^(aereos|hoteis)\.(\d+)\.(\w+)$/);
        if (m) {
            const i = +m[2];
            if (m[1] === 'aereos') {
                const a = o.aereos[i];
                if (!a) return '';
                return m[3] === 'titulo' ? this._tituloAereo(i) : m[3] === 'infoLinha' ? this._infoAereo(a) : '';
            }
            return m[3] === 'titulo' ? this._tituloHotel(i) : m[3] === 'subtitulo' ? this._subtituloHotel(o.hoteis[i]) : '';
        }
        switch (path) {
            case 'titulo':           return this._tituloDoc(o);
            case 'subtitulo':        return this._subtituloDoc(o);
            case 'introducao':       return this._introPadrao(o);
            case 'tituloHospedagem': return this._tituloHospedagem(o);
        }
        return '';
    },

    _tituloDoc(o) {
        if (o.aereos.length && o.hoteis.length) return 'COTAÇÃO DE PASSAGEM AÉREA E HOSPEDAGEM';
        if (o.hoteis.length) return 'COTAÇÃO DE HOSPEDAGEM';
        return 'COTAÇÃO DE PASSAGEM AÉREA';
    },

    _subtituloDoc(o) {
        const partes = [];
        const a0 = o.aereos[0];
        if (a0?.voos.length) {
            // Bloco ida+volta termina na origem: usa o destino da 1ª perna
            const p0 = this._pernas(a0)[0].voos;
            const ori = this._cidade(a0.voos[0].origem), des = this._cidade(p0[p0.length - 1].destino);
            if (ori && des) partes.push(`${ori} – ${des}`);
        } else if (o.hoteis[0]?.local) {
            partes.push(o.hoteis[0].local);
        }
        const datas = [...o.aereos.flatMap(a => a.voos.map(v => v.data)), ...o.hoteis.flatMap(h => [h.checkin, h.checkout])]
            .filter(Boolean).sort();
        if (datas.length) {
            const [a1, m1, d1] = datas[0].split('-'), [a2, m2, d2] = datas[datas.length - 1].split('-');
            partes.push(datas[0] === datas[datas.length - 1] ? `${d1}/${m1}/${a1}`
                : a1 !== a2 ? `${d1}/${m1}/${a1} a ${d2}/${m2}/${a2}`
                : m1 !== m2 ? `${d1}/${m1} a ${d2}/${m2}/${a2}`
                : `${d1} a ${d2}/${m2}/${a2}`);
        }
        return partes.join(' • ');
    },

    _introPadrao(o) {
        const partes = [];
        if (o.aereos.length) {
            const classes = [...new Set(o.aereos.map(a => (a.classe || '').toLowerCase()).filter(Boolean))];
            const pax = this._maxPax(o);
            partes.push(`passagens aéreas${classes.length ? ` (classe ${classes.join('/')})` : ''}${pax ? ` para ${this._porExtenso(pax)} ${pax === 1 ? 'passageiro' : 'passageiros'}` : ''}`);
        }
        if (o.hoteis.length) {
            const h = o.hoteis[0];
            const noites = this._noites(h);
            const cafe = o.hoteis.every(x => /^inclus/i.test(x.cafe || '')) ? ' com café da manhã incluso' : '';
            const det = [this._acomodacaoResumo(h), noites ? this._plural(noites, 'noite') : ''].filter(Boolean).join(', ');
            partes.push(`hospedagem${h.local ? ` em ${h.local}` : ''}${cafe}${det ? ` (${det})` : ''}` +
                (o.hoteis.length > 1 ? `, com ${this._porExtenso(o.hoteis.length).replace(/\(um\)/, '(uma)').replace(/\(dois\)/, '(duas)')} opções de hotel` : ''));
        }
        if (!partes.length) return '';
        return `Em atendimento à sua solicitação, segue proposta contemplando ${partes.join(' e ')}, conforme detalhado abaixo.` +
            (o.aereos.length && o.hoteis.length ? ' Os valores de passagem aérea e de hospedagem são apresentados separadamente.' : '');
    },

    _tituloAereo(i) {
        const a = this._orc.aereos[i];
        const pax = +a.passageiros || 0;
        const op = this._opcaoDoBloco(i);
        const cia = this._ciaBloco(a, ' / ').toUpperCase();
        const pernas = this._pernas(a);
        const fim = pernas.length > 1
            ? cia
            : [cia, this._escalasTxt(a, true)].filter(Boolean).join(', ');
        return `PASSAGEM AÉREA – ${this._grupoNome(a).toUpperCase()} (${pax} ${pax === 1 ? 'PASSAGEIRO' : 'PASSAGEIROS'})` +
            (op ? ` – OPÇÃO ${op}: ${fim}` : ` – ${fim}`);
    },

    _infoAereo(a) {
        const pax = +a.passageiros || 0;
        const partes = [`${pax === 1 ? 'Passageiro' : 'Passageiros'}: ${pax}${a.tipoPax ? ` (${pax === 1 ? a.tipoPax.replace(/s$/, '') : a.tipoPax})` : ''}`];
        if (a.classe) partes.push(`Classe ${a.classe}`);
        const pernas = this._pernas(a);
        pernas.forEach(p => {
            const sub = { voos: p.voos };
            const dur = this._duracaoVoo(sub);
            const esc = this._escalasTxt(sub) + (dur ? `, duração ${this._fmtDur(dur)}` : '');
            const v0 = p.voos[0], vN = p.voos[p.voos.length - 1];
            const rota = v0?.origem && v0.saida
                ? `saída de ${this._cidade(v0.origem)}${v0.data ? ` em ${this._fmtDM(v0.data)}` : ''} às ${v0.saida}` +
                  (vN?.destino && vN.chegada ? `, com chegada em ${this._cidade(vN.destino)} às ${vN.chegada}` : '')
                : '';
            const up = s => s.replace(/^./, c => c.toUpperCase());
            if (pernas.length > 1) partes.push(`${p.trecho}: ${[esc, rota].filter(Boolean).join(', ')}.`);
            else { partes.push(up(esc)); if (rota) partes.push(up(rota) + '.'); }
        });
        return partes.join(' • ');
    },

    _tituloHotel(i) {
        const h = this._orc.hoteis[i];
        const nome = h?.nome?.trim() || 'Hotel';
        return this._orc.hoteis.length > 1 ? `Opção ${i + 1} – ${nome}` : nome;
    },

    _subtituloHotel(h) {
        if (!h) return '';
        const est = +h.estrelas || 0;
        const min = +this._orc.estrelasMinimas || 0;
        const cat = est ? `Categoria ${this._plural(est, 'estrela')}${min ? ` (${est >= min ? 'atende ao' : 'abaixo do'} mínimo de ${this._plural(min, 'estrela')})` : ''}` : '';
        return [h.local, cat].filter(Boolean).join(' • ');
    },

    // "1 quarto single + 1 quarto duplo (twin ou casal) – Suítes" → "1 quarto single + 1 quarto duplo"
    // (vai dentro de parênteses em títulos/introdução; evita parênteses aninhados)
    _acomodacaoResumo(h) {
        const base = (h.acomodacao || '').split(/\s+[–-]\s+/)[0].replace(/\s*\([^)]*\)/g, '').trim();
        return base || (+h.quartos ? this._plural(+h.quartos, 'quarto') : '');
    },

    _tituloHospedagem(o) {
        const h = o.hoteis[0];
        if (!h) return 'HOSPEDAGEM';
        const n = this._noites(h);
        const det = [this._acomodacaoResumo(h), n ? this._plural(n, 'noite') : ''].filter(Boolean).join(' • ');
        return `HOSPEDAGEM${o.hoteis.length > 1 ? ' – OPÇÕES' : ''}${det ? ` (${det.toUpperCase()})` : ''}`;
    },

    // ══════════════════════════════════════════════════════════════════
    // PDF
    // ══════════════════════════════════════════════════════════════════
    async visualizarPDF() {
        // Abre a janela já no clique (depois do await o navegador bloquearia o pop-up)
        const win = window.open('', '_blank');
        try {
            const doc = await this._gerarPDF(this._orc);
            const url = doc.output('bloburl');
            if (win) win.location.href = url; else window.open(url, '_blank');
        } catch (e) {
            if (win) win.close();
            console.error(e);
            App.showToast('Erro ao gerar PDF: ' + e.message, 'danger');
        }
    },

    async baixarPDF(id) {
        try {
            const o = await this._buscar(id);
            const doc = await this._gerarPDF(o);
            doc.save(this._nomeArquivo(o));
        } catch (e) {
            console.error(e);
            App.showToast('Erro ao gerar PDF: ' + e.message, 'danger');
        }
    },

    _nomeArquivo(o) {
        const cli = (o.clienteNome || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
        return `Orcamento_${cli}_${(o.dataCotacao || this._hojeISO()).replace(/-/g, '')}.pdf`;
    },

    // Logo reduzido para ~300px: o original deixava o PDF com vários MB
    async _carregarLogo() {
        if (this._logoB64 !== undefined) return this._logoB64;
        this._logoB64 = await new Promise(res => {
            const img = new Image();
            img.onload = () => {
                const esc = Math.min(1, 300 / Math.max(img.naturalWidth, img.naturalHeight));
                const c = document.createElement('canvas');
                c.width = Math.round(img.naturalWidth * esc); c.height = Math.round(img.naturalHeight * esc);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                res(c.toDataURL('image/png'));
            };
            img.onerror = () => res(null);
            img.src = '/assets/images/logomarca.png';
        });
        return this._logoB64;
    },

    async _gerarPDF(o) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
        const C = this.CORES;
        const emp = (typeof CONFIG !== 'undefined' && CONFIG.empresa) || {};
        const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight();
        const MG = 15, CW = PW - 2 * MG, LIM = PH - 20;
        let y = 0;

        // Fonte padrão do jsPDF só tem WinAnsi: remove o que não for representável
        const T = s => String(s ?? '')
            .replace(/\s*[→⇒➔➜►]\s*/g, ' – ')
            .replace(/[^\x00-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, '');
        const fonte = (size, bold = false, cor = C.texto) => {
            doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...cor);
        };
        const LH = size => size * 0.3528 * 1.3;   // altura de linha em mm
        const quebrar = (txt, w, size, bold) => { fonte(size, bold); return doc.splitTextToSize(T(txt), w); };
        const novaPagina = () => { doc.addPage(); y = 16; };
        const garantir = h => { if (y + h > LIM) novaPagina(); };
        const moeda = v => this._fmtMoeda(v).replace(/ /g, ' ');

        // Linha justificada (distribui a sobra entre as palavras)
        const linhaJust = (line, x, yy, w) => {
            const palavras = line.split(' ').filter(Boolean);
            if (palavras.length < 2) { doc.text(line, x, yy, { baseline: 'top' }); return; }
            const larg = palavras.reduce((s, p) => s + doc.getTextWidth(p), 0);
            const gap = (w - larg) / (palavras.length - 1);
            if (gap > 4) { doc.text(line, x, yy, { baseline: 'top' }); return; }   // linha muito curta: não estica
            let cx = x;
            palavras.forEach(p => { doc.text(p, cx, yy, { baseline: 'top' }); cx += doc.getTextWidth(p) + gap; });
        };

        // Parágrafo com quebra de página linha a linha
        const paragrafo = (txt, { size = 9.5, bold = false, cor = C.texto, x = MG, w = CW, align = 'left', depois = 2 } = {}) => {
            String(txt || '').split('\n').forEach(par => {
                const ls = quebrar(par, w, size, bold);
                ls.forEach((ln, k) => {
                    garantir(LH(size));
                    fonte(size, bold, cor);
                    if (align === 'justify' && k < ls.length - 1) linhaJust(ln, x, y, w);
                    else if (align === 'center') doc.text(ln, x + w / 2, y, { baseline: 'top', align: 'center' });
                    else doc.text(ln, x, y, { baseline: 'top' });
                    y += LH(size);
                });
            });
            y += depois;
        };

        // Tabela com grade. cols: [{ w, align }]; linhas: [{ cells:[], header, fill, bold, cor, size, linhaTopo }]
        const tabela = (cols, linhas, { x = MG, size = 8.5, pad = 2, repetirCab = true } = {}) => {
            const largura = cols.reduce((s, c) => s + c.w, 0);
            const cab = linhas.filter(l => l.header);
            const medir = l => {
                const sz = l.size || size;
                const ls = l.cells.map((c, k) => quebrar(c, cols[k].w - 2 * pad, sz, l.bold || l.header || (l.boldCells || [])[k]));
                return { ls, h: Math.max(...ls.map(a => a.length)) * LH(sz) + 2 * pad - 0.6 };
            };
            const desenhar = l => {
                const { ls, h } = medir(l);
                const sz = l.size || size;
                let cx = x;
                cols.forEach((c, k) => {
                    const fill = l.header ? C.fundoCab : (l.fills && l.fills[k]) || l.fill;
                    if (fill) { doc.setFillColor(...fill); doc.rect(cx, y, c.w, h, 'F'); }
                    doc.setDrawColor(...C.linha); doc.setLineWidth(0.2); doc.rect(cx, y, c.w, h, 'S');
                    const bold = l.bold || l.header || (l.boldCells || [])[k];
                    fonte(sz, bold, (l.cores && l.cores[k]) || l.cor || C.texto);
                    const al = l.header ? 'center' : (c.align || 'left');
                    const tx = al === 'center' ? cx + c.w / 2 : al === 'right' ? cx + c.w - pad : cx + pad;
                    ls[k].forEach((ln, j) => doc.text(ln, tx, y + pad + j * LH(sz), { baseline: 'top', align: al }));
                    cx += c.w;
                });
                if (l.linhaTopo) { doc.setDrawColor(...l.linhaTopo); doc.setLineWidth(0.5); doc.line(x, y, x + largura, y); }
                y += h;
            };
            linhas.forEach((l, idx) => {
                const { h } = medir(l);
                if (y + h > LIM) {
                    novaPagina();
                    if (repetirCab && !l.header && idx > 0) cab.forEach(desenhar);
                }
                desenhar(l);
            });
        };

        // Lista "rótulo | texto" com linha fina entre itens (regras do aéreo / dados do hotel)
        const listaRotulo = (itens, { wRot = 45, size = 8.5, x = MG + 3 } = {}) => {
            const w = CW - 3, wTxt = w - wRot - 2;
            itens.forEach(it => {
                const lr = quebrar(it.rotulo, wRot - 2, size, true);
                const lt = quebrar(it.texto, wTxt, size, !!it.destaque);
                const h = Math.max(lr.length, lt.length) * LH(size) + 2;
                garantir(h);
                fonte(size, true, C.texto);
                lr.forEach((ln, j) => doc.text(ln, x + 1, y + 1 + j * LH(size), { baseline: 'top' }));
                fonte(size, !!it.destaque, it.destaque ? C.alerta : C.texto);
                lt.forEach((ln, j) => doc.text(ln, x + wRot, y + 1 + j * LH(size), { baseline: 'top' }));
                y += h;
                doc.setDrawColor(...C.linha); doc.setLineWidth(0.2); doc.line(x, y, x + w, y);
            });
            y += 3;
        };

        const faixaSecao = (txt, minDepois = 30) => {
            garantir(9 + minDepois);
            doc.setFillColor(...C.primaria); doc.rect(MG, y, CW, 8, 'F');
            let sz = 9.5; fonte(sz, true, [255, 255, 255]);
            const t = T(txt).toUpperCase();
            while (doc.getTextWidth(t) > CW - 8 && sz > 6.5) { sz -= 0.5; doc.setFontSize(sz); }
            doc.text(t, MG + 4, y + 4, { baseline: 'middle' });
            y += 11;
        };

        const subtitulo = (txt, size = 11) => { fonte(size, true, C.primaria); doc.text(T(txt), MG, y, { baseline: 'top' }); y += LH(size) + 0.5; };

        // ── Cabeçalho (só na 1ª página) ──
        const logo = await this._carregarLogo();
        y = 12;
        const nomeEmp = (emp.razaoSocial || emp.nome || 'GiraMundoTour').toUpperCase();
        fonte(17, true, C.primaria); doc.text(T(nomeEmp), MG, y, { baseline: 'top' });
        if (emp.slogan) {
            fonte(7.5, true, [255, 255, 255]);
            const ws = Math.max(55, doc.getTextWidth(T(emp.slogan.toUpperCase())) + 12);
            doc.setFillColor(...C.destaque); doc.rect(MG, y + 9, ws, 5.5, 'F');
            doc.text(T(emp.slogan.toUpperCase()), MG + ws / 2, y + 11.75, { baseline: 'middle', align: 'center' });
        }
        fonte(7.5, false, C.cinza);
        const lnCnpj = [emp.cnpj && `CNPJ: ${emp.cnpj}`, emp.inscricaoMunicipal && `Inscrição Municipal: ${emp.inscricaoMunicipal}`].filter(Boolean).join(' | ');
        const lnEnd  = [emp.endereco, emp.telefone && `Fone: ${emp.telefone}`].filter(Boolean).join(' | ');
        const lnCont = [emp.email, emp.instagram, emp.site].filter(Boolean).join(' • ');
        [lnCnpj, lnEnd, lnCont].filter(Boolean).forEach((l, k) => doc.text(T(l), MG, y + 18 + k * 3.6, { baseline: 'top' }));
        if (logo) {
            const cx = PW - MG - 16, cy = y + 13;
            doc.setFillColor(240, 242, 245); doc.circle(cx, cy, 16, 'F');
            try {
                const pr = doc.getImageProperties(logo);
                const box = 24, esc = Math.min(box / pr.width, box / pr.height);
                const lw = pr.width * esc, lh = pr.height * esc;
                doc.addImage(logo, 'PNG', cx - lw / 2, cy - lh / 2, lw, lh);
            } catch (e) { console.warn('[orcamentos] logo:', e); }
        }
        y = 43;
        doc.setDrawColor(...C.destaque); doc.setLineWidth(0.4); doc.line(MG, y, PW - MG, y);
        y += 8;

        // ── Título / subtítulo ──
        paragrafo((o.titulo || '').trim() || this._tituloDoc(o), { size: 17, bold: true, cor: C.primaria, align: 'center', depois: 0.5 });
        const sub = (o.subtitulo || '').trim() || this._subtituloDoc(o);
        if (sub) paragrafo(sub, { size: 10, align: 'center', depois: 0 });
        y += 7;

        // ── Carta ──
        if (o.saudacao) paragrafo(o.saudacao, { size: 9.5, depois: 3 });
        const dest = (o.destinatario || '').trim() || o.clienteNome;
        if (dest) paragrafo(dest, { size: 9.5, depois: 3 });
        const intro = (o.introducao || '').trim() || this._introPadrao(o);
        if (intro) paragrafo(intro, { size: 9.5, align: 'justify', depois: 4 });

        // ── Aéreo ──
        const colsVoo = [18, 20, 20, 20, 16, 18, 19, 19].map(w => ({ w, align: 'center' }));
        const xVoo = MG + (CW - 150) / 2;
        // Altura estimada do bloco inteiro: se cabe numa página, não é partido entre duas
        const alturaAereo = a => {
            let h = 11 + (a.subtitulo ? 5.5 : 0);
            if (a.voos.length) h += (a.voos.length + 1) * 7.3 + 3;
            h += quebrar((a.infoLinha || '').trim() || this._infoAereo(a), CW, 9).length * LH(9) + 2;
            a.regras.forEach(r => {
                h += Math.max(quebrar(r.rotulo, 43, 8.5, true).length, quebrar(this._subst(r.texto, a), CW - 50, 8.5).length) * LH(8.5) + 2;
            });
            return h + 3 + 4 * 7.3 + 4;
        };
        o.aereos.forEach((a, i) => {
            const v = this._valoresAereo(a);
            const pax = +a.passageiros || 0;
            const hBloco = alturaAereo(a);
            if (hBloco < LIM - 16) garantir(hBloco);
            faixaSecao((a.titulo || '').trim() || this._tituloAereo(i), 22);
            if (a.subtitulo) subtitulo(a.subtitulo);
            if (a.voos.length) {
                tabela(colsVoo, [
                    { header: true, cells: ['Trecho', 'Cia', 'Voo', 'Data', 'Saída', 'Chegada', 'Origem', 'Destino'] },
                    ...a.voos.map(vo => ({ cells: [vo.trecho, vo.cia, vo.voo, this._fmtDMA2(vo.data), vo.saida, vo.chegada, vo.origem, vo.destino] })),
                ], { x: xVoo });
                y += 3;
            }
            const info = (a.infoLinha || '').trim() || this._infoAereo(a);
            if (info) paragrafo(info, { size: 9, align: 'justify', depois: 2 });
            const regras = a.regras.filter(r => (r.rotulo || '').trim() || (r.texto || '').trim())
                .map(r => ({ rotulo: r.rotulo, texto: this._subst(r.texto, a) }));
            if (regras.length) listaRotulo(regras);
            garantir(30);
            const totLbl = `Total (${pax} ${pax === 1 ? 'passageiro' : 'passageiros'})`;
            tabela([{ w: 98 }, { w: 38, align: 'right' }, { w: 38, align: 'right' }], [
                { header: true, cells: ['Componente', 'Por passageiro', totLbl] },
                { cells: ['Tarifa', moeda(v.tarifaPax), moeda(v.tarifaTot)] },
                { cells: ['Taxa de embarque e demais taxas e encargos', moeda(v.taxasPax), moeda(v.taxasTot)] },
                { cells: ['VALOR TOTAL DA PASSAGEM AÉREA', moeda(v.porPax), moeda(v.total)], bold: true, cor: C.primaria, fill: C.fundoTotal, linhaTopo: C.primaria },
            ], { x: MG + 3 });
            y += 4;
        });

        // ── Hospedagem ──
        if (o.hoteis.length) {
            faixaSecao((o.tituloHospedagem || '').trim() || this._tituloHospedagem(o), 60);
            o.hoteis.forEach((h, i) => {
                const n = this._noites(h);
                garantir(70);
                subtitulo((h.titulo || '').trim() || this._tituloHotel(i));
                const subH = (h.subtitulo || '').trim() || this._subtituloHotel(h);
                if (subH) paragrafo(subH, { size: 8.5, depois: 1.5 });
                const itens = [
                    h.checkin  && { rotulo: 'Check-in',  texto: this._fmtExtenso(h.checkin) },
                    h.checkout && { rotulo: 'Check-out', texto: this._fmtExtenso(h.checkout) },
                    (n || h.hospedes) && { rotulo: 'Duração', texto: [n && this._plural(n, 'noite'),
                        h.hospedes && `${this._plural(+h.hospedes, 'hóspede')}${h.quartos ? ` em ${this._plural(+h.quartos, 'quarto')}` : ''}`].filter(Boolean).join(', ') },
                    h.acomodacao   && { rotulo: 'Acomodação',    texto: h.acomodacao },
                    h.cafe         && { rotulo: 'Café da manhã', texto: h.cafe },
                    h.cancelamento && { rotulo: 'Cancelamento',  texto: h.cancelamento, destaque: !!h.cancelDestaque },
                    h.observacao   && { rotulo: 'Observações',   texto: h.observacao },
                ].filter(Boolean);
                listaRotulo(itens, { x: MG });
                y -= 1;
                const dd = s => String(s || 0).padStart(2, '0');
                tabela([{ w: 45, align: 'center' }, { w: 45, align: 'center' }, { w: 45, align: 'center' }, { w: 45, align: 'center' }], [
                    { header: true, cells: ['Diária média por quarto*', 'Quartos', 'Diárias', 'Valor total da hospedagem'] },
                    { cells: [moeda(this._diariaMedia(h)), dd(h.quartos), dd(n), moeda(h.valorTotal)], fill: C.fundoTotal,
                      boldCells: [false, false, false, true], cores: [C.texto, C.texto, C.texto, C.primaria], size: 9 },
                ]);
                y += 5;
            });
            // Nota da diária média (texto específico quando todas as opções têm a mesma configuração)
            const h0 = o.hoteis[0], n0 = this._noites(h0);
            const iguais = o.hoteis.every(h => +h.quartos === +h0.quartos && this._noites(h) === n0);
            const nota = iguais && n0 && +h0.quartos
                ? `* Diária média por quarto = valor total ÷ ${(+h0.quartos) * n0} diárias (${this._plural(+h0.quartos, 'quarto')} × ${this._plural(n0, 'noite')}), com arredondamento nos centavos; o valor total da hospedagem é o valor efetivamente cotado.`
                : '* Diária média por quarto = valor total ÷ (quartos × noites), com arredondamento nos centavos; o valor total da hospedagem é o valor efetivamente cotado.';
            y -= 2;
            paragrafo(nota, { size: 7.5, cor: C.cinza, depois: 4 });
        }

        // ── Valor total da cotação ──
        const combos = this._combinacoesAereo(o);
        const temTotal = o.mostrarTotal !== false && (combos.length + o.hoteis.length) > 0
            && (o.aereos.length + o.hoteis.length) > 1;   // com um único item o total é o próprio item
        if (temTotal) {
            garantir(40);
            y += 2;
            subtitulo('VALOR TOTAL DA COTAÇÃO', 14);
            y += 1;
            const corTot = { bold: true, cor: C.primaria };
            if (combos.length && o.hoteis.length && combos.length <= 3) {
                const wPrim = combos.length === 1 ? 110 : combos.length === 2 ? 90 : 72;
                const wCol = (CW - wPrim) / combos.length;
                tabela([{ w: wPrim }, ...combos.map(() => ({ w: wCol, align: 'right' }))], [
                    { header: true, cells: ['Composição (aéreo + hospedagem)',
                        ...combos.map(c => `${c.rotulo === 'Aéreo' ? 'Aéreo' : 'Aéreo com ' + c.rotulo}\n${moeda(c.total)}`)] },
                    ...o.hoteis.map((h, k) => ({
                        cells: [`${(h.nome || '').trim() || this._tituloHotel(k)} – ${moeda(h.valorTotal)}`, ...combos.map(c => moeda(c.total + (+h.valorTotal || 0)))],
                        fills: [null, ...combos.map(() => C.fundoTotal)],
                        boldCells: [false, ...combos.map(() => true)],
                        cores: [C.texto, ...combos.map(() => C.primaria)],
                    })),
                ], { size: 9 });
            } else {
                const linhas = [];
                if (combos.length && o.hoteis.length) {
                    o.hoteis.forEach((h, k) => combos.forEach(c => linhas.push(
                        [`${(h.nome || '').trim() || this._tituloHotel(k)} (${moeda(h.valorTotal)}) + ${c.rotulo === 'Aéreo' ? 'aéreo' : 'aéreo com ' + c.rotulo} (${moeda(c.total)})`, c.total + (+h.valorTotal || 0)])));
                } else if (combos.length) {
                    combos.forEach(c => linhas.push([c.rotulo === 'Aéreo' ? 'Passagens aéreas' : 'Aéreo com ' + c.rotulo, c.total]));
                } else {
                    o.hoteis.forEach((h, k) => linhas.push([this._tituloHotel(k), +h.valorTotal || 0]));
                }
                tabela([{ w: 135 }, { w: 45, align: 'right' }], [
                    { header: true, cells: ['Composição', 'Valor total'] },
                    ...linhas.map(([l, v]) => ({ cells: [l, moeda(v)], fills: [null, C.fundoTotal], ...corTot, bold: false, boldCells: [false, true], cores: [C.texto, C.primaria] })),
                ], { size: 9 });
            }
            y += 1.5;
            // Composição do aéreo quando há mais de um grupo/opção
            const grupos = this._grupos(o);
            if (grupos.length > 1 || grupos.some(g => g.blocos.length > 1)) {
                const comp = grupos.map(g => {
                    const pax = +g.blocos[0].a.passageiros || 0;
                    const vals = g.blocos.length > 1
                        ? g.blocos.map((b, k) => `Opção ${k + 1}: ${moeda(this._valoresAereo(b.a).total)}`).join(' ou ')
                        : moeda(this._valoresAereo(g.blocos[0].a).total);
                    return `${g.nome.charAt(0).toLowerCase() + g.nome.slice(1)} para ${pax} ${pax === 1 ? 'passageiro' : 'passageiros'} (${vals})`;
                }).join(' + ');
                paragrafo(`Aéreo = ${comp}.`, { size: 8.5, depois: 4 });
            } else {
                y += 3;
            }
        }

        // ── Informações complementares ──
        const infos = String(o.infoComplementares || '').split('\n').map(s => s.replace(/^\s*[•\-*]\s*/, '').trim()).filter(Boolean);
        if (infos.length) {
            garantir(20);
            subtitulo('INFORMAÇÕES COMPLEMENTARES', 14);
            y += 1;
            infos.forEach(t => paragrafo('• ' + t, { size: 8.5, depois: 0.4 }));
            y += 3;
        }

        // ── Aviso ──
        const avTit = (o.avisoTitulo || '').trim();
        const avTxt = (o.avisoTexto || '').trim().replace(/\{data\}/g, this._fmtData(o.dataCotacao));
        if (avTit || avTxt) {
            const w = CW - 10;
            const lt = avTit ? quebrar(avTit, w, 8.5, true) : [];
            const lx = avTxt ? quebrar(avTxt, w, 8.5, false) : [];
            const h = 8 + lt.length * LH(8.5) + (lt.length && lx.length ? 2.5 : 0) + lx.length * LH(8.5);
            garantir(h + 4);
            doc.setFillColor(...C.fundoTotal); doc.setDrawColor(...C.linha); doc.setLineWidth(0.2);
            doc.rect(MG, y, CW, h, 'FD');
            doc.setFillColor(...C.primaria); doc.rect(MG, y, 1.3, h, 'F');
            let yy = y + 4;
            fonte(8.5, true, C.primaria);
            lt.forEach(ln => { doc.text(ln, MG + 5, yy, { baseline: 'top' }); yy += LH(8.5); });
            if (lt.length && lx.length) yy += 2.5;
            fonte(8.5, false, C.texto);
            lx.forEach((ln, k) => { if (k < lx.length - 1) linhaJust(ln, MG + 5, yy, w); else doc.text(ln, MG + 5, yy, { baseline: 'top' }); yy += LH(8.5); });
            y += h + 5;
        }

        // ── Encerramento / assinatura ──
        const assinLinhas = String(o.assinaturaLinhas || '').split('\n').filter(s => s.trim());
        garantir(22 + assinLinhas.length * 4);
        if (o.encerramento) paragrafo(o.encerramento, { size: 9.5, depois: 3 });
        paragrafo('Atenciosamente,', { size: 9.5, depois: 0.5 });
        if (o.assinaturaNome) paragrafo(o.assinaturaNome, { size: 12, bold: true, cor: C.primaria, depois: 0.3 });
        assinLinhas.forEach(l => paragrafo(l, { size: 9.5, depois: 0 }));

        // ── Rodapé em todas as páginas ──
        const total = doc.getNumberOfPages();
        const rod = T([emp.nome || 'GiraMundoTour', emp.instagram, 'Agência de Viagens - Valores sujeitos a alteração sem aviso prévio'].filter(Boolean).join(' • '));
        for (let p = 1; p <= total; p++) {
            doc.setPage(p);
            doc.setDrawColor(...C.linha); doc.setLineWidth(0.2); doc.line(MG, PH - 14, PW - MG, PH - 14);
            fonte(7, false, C.cinza);
            doc.text(rod, PW / 2, PH - 10, { align: 'center', baseline: 'top' });
            doc.text(String(p), PW - MG, PH - 10, { align: 'right', baseline: 'top' });
        }
        return doc;
    },

    // ══════════════════════════════════════════════════════════════════
    // Utilitários
    // ══════════════════════════════════════════════════════════════════
    _get(path) {
        return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), this._orc);
    },

    _set(path, val) {
        const ks = path.split('.');
        const alvo = ks.slice(0, -1).reduce((o, k) => o[k], this._orc);
        alvo[ks[ks.length - 1]] = val;
    },

    _hojeISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    _mascaraMoeda(el) {
        const digits = el.value.replace(/\D/g, '');
        if (!digits) { el.value = ''; return; }
        el.value = (parseInt(digits, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    _parseMoeda(v) {
        if (typeof v === 'number') return v;
        return parseFloat(String(v || '').replace(/\./g, '').replace(',', '.')) || 0;
    },

    _fmtInput(v) {
        return +v ? (+v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    },

    _fmtMoeda(v) {
        return (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    _esc(v) {
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    _partes(d) {
        const [a, m, dd] = String(d || '').slice(0, 10).split('-');
        return a && m && dd ? { a, m, d: dd } : null;
    },

    _fmtData(d)  { const p = this._partes(d); return p ? `${p.d}/${p.m}/${p.a}` : ''; },
    _fmtDM(d)    { const p = this._partes(d); return p ? `${p.d}/${p.m}` : ''; },
    _fmtDMA2(d)  { const p = this._partes(d); return p ? `${p.d}/${p.m}/${p.a.slice(2)}` : ''; },

    _fmtExtenso(d) {
        const p = this._partes(d);
        if (!p) return '';
        const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        return `${dias[new Date(+p.a, +p.m - 1, +p.d).getDay()]}, ${p.d}/${p.m}/${p.a}`;
    },
};

window.OrcamentosModule = OrcamentosModule;
