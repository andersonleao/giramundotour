// GiraMundoTour - Cotações salvas
// Painel compartilhado entre a Busca de Voos e a página Cotação:
// lista as cotações gravadas em /api/cotacoes, permite marcar várias
// (ou todas), gerar um PDF único, reabrir para edição e excluir em lote.

const CotacoesSalvasModule = {
    // Containers onde o painel é desenhado (um por página)
    HOSTS: ['cotacoesSalvasHostBusca', 'cotacoesSalvasHostCotacao'],

    _lista: [],
    _selecionadas: new Set(),
    _filtro: '',
    _timerFiltro: null,
    _carregando: false,

    _esc(t) {
        return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    _parseJson(v, padrao) {
        if (v == null || v === '') return padrao;
        if (typeof v === 'object') return v;
        try { return JSON.parse(v); } catch (_) { return padrao; }
    },

    _hosts() {
        return this.HOSTS.map(id => document.getElementById(id)).filter(Boolean);
    },

    async carregar() {
        if (!localStorage.getItem('giramundo_token') || this._hosts().length === 0) return;

        this._carregando = true;
        this.render();

        const qs = new URLSearchParams({ limit: 100 });
        if (this._filtro) qs.append('busca', this._filtro);

        try {
            const resp = await apiCall(`/api/cotacoes?${qs.toString()}`);
            if (!resp) return;
            const json = await resp.json();
            if (!json.success) throw new Error(json.message || 'Erro ao listar');

            this._lista = (json.data || []).map(c => ({
                ...c,
                voos: this._parseJson(c.voos, []),
                dadosPdf: this._parseJson(c.dadosPdf, null)
            }));
            const ids = new Set(this._lista.map(c => c.id));
            this._selecionadas = new Set([...this._selecionadas].filter(id => ids.has(id)));
            this._erro = null;
        } catch (err) {
            this._erro = err.message;
        } finally {
            this._carregando = false;
            this.render();
        }
    },

    filtrar(valor) {
        this._filtro = (valor || '').trim();
        clearTimeout(this._timerFiltro);
        this._timerFiltro = setTimeout(() => this.carregar(), 400);
    },

    _nomeCliente(c) {
        return c.dadosPdf?.cliente?.nome || c.clienteNome || c.cliente?.nome
            || (c.observacoes || '').replace(/^Cliente:\s*/, '').split('|')[0].trim() || '—';
    },

    render() {
        this._hosts().forEach(host => {
            const sufixo = host.id;
            // Preserva o foco/cursor do filtro ao redesenhar
            const filtroAtivo = document.activeElement && document.activeElement.id === `filtro_${sufixo}`;
            host.innerHTML = this._htmlCard(sufixo);
            if (filtroAtivo) {
                const inp = document.getElementById(`filtro_${sufixo}`);
                if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
            }
        });
        this._aposRender();
    },

    _htmlCard(sufixo) {
        const qtdSel = this._selecionadas.size;
        const totalSel = this._lista
            .filter(c => this._selecionadas.has(c.id))
            .reduce((s, c) => s + (Number(c.dadosPdf?.precos?.total ?? c.total) || 0), 0);

        return `
            <div class="card">
                <div class="card-header bg-white">
                    <div class="row g-2 align-items-center">
                        <div class="col-lg-4">
                            <h5 class="mb-0"><i class="bi bi-bookmark-check text-primary"></i> Cotações salvas
                                <span class="badge bg-secondary ms-1">${this._lista.length}</span></h5>
                        </div>
                        <div class="col-lg-8">
                            <div class="d-flex flex-wrap gap-2 justify-content-lg-end">
                                <input type="text" class="form-control form-control-sm" id="filtro_${sufixo}"
                                       placeholder="Filtrar por cliente" style="max-width: 200px;"
                                       value="${this._esc(this._filtro)}"
                                       oninput="CotacoesSalvasModule.filtrar(this.value)">
                                <button class="btn btn-sm btn-outline-secondary" onclick="CotacoesSalvasModule.carregar()" title="Atualizar">
                                    <i class="bi bi-arrow-clockwise"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="CotacoesSalvasModule.excluirSelecionadas()" ${qtdSel ? '' : 'disabled'}>
                                    <i class="bi bi-trash"></i> Excluir (${qtdSel})
                                </button>
                                <button class="btn btn-sm btn-primary" onclick="CotacoesSalvasModule.gerarPdf()" ${qtdSel ? '' : 'disabled'}>
                                    <i class="bi bi-file-earmark-pdf"></i> Gerar PDF único (${qtdSel})
                                </button>
                            </div>
                        </div>
                    </div>
                    ${qtdSel ? `<div class="small text-muted mt-2">${qtdSel} selecionada(s) — soma dos totais: <strong>${Formatter.currency(totalSel)}</strong></div>` : ''}
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">${this._htmlTabela()}</div>
                </div>
            </div>`;
    },

    _htmlTabela() {
        if (this._carregando && this._lista.length === 0) {
            return '<p class="text-muted text-center my-3 small">Carregando...</p>';
        }
        if (this._erro) {
            return `<p class="text-danger text-center my-3 small">Erro ao carregar cotações: ${this._esc(this._erro)}</p>`;
        }
        if (this._lista.length === 0) {
            return this._filtro
                ? '<p class="text-muted text-center my-3 small">Nenhuma cotação encontrada para esse filtro.</p>'
                : '<p class="text-muted text-center my-3 small">Nenhuma cotação salva. Busque um voo, clique em "Criar Cotação" e depois em "Salvar".</p>';
        }

        const todasMarcadas = this._lista.every(c => this._selecionadas.has(c.id));
        const algumaMarcada = this._lista.some(c => this._selecionadas.has(c.id));

        const linhas = this._lista.map(c => {
            const voos = Array.isArray(c.voos) ? c.voos : [];
            const ida = voos[0] || {};
            const volta = voos[1];
            const rota = ida.origem
                ? `${ida.origem} → ${ida.destino}${volta ? ' → ' + (volta.destino || ida.origem) : ''}`
                : '—';
            const datas = voos.map(v => v.dataPartida ? Formatter.date(v.dataPartida) : '').filter(Boolean).join(' / ');
            const cias = [...new Set(voos.map(v => v.companhiaNome || v.companhia).filter(Boolean))].join(', ');
            const temPdf = !!c.dadosPdf;
            const marcado = this._selecionadas.has(c.id);
            const tarifa = c.dadosPdf?.tarifa;
            const tarifaTxt = tarifa
                ? `${tarifa.tipo || 'Econômica'}${tarifa.semReembolso !== false ? ' · sem reembolso' : ''}`
                : '';

            return `
                <tr class="${marcado ? 'table-active' : ''}">
                    <td class="text-center">
                        <input type="checkbox" class="form-check-input" ${marcado ? 'checked' : ''}
                               onchange="CotacoesSalvasModule.toggle('${c.id}', this.checked)">
                    </td>
                    <td class="small text-nowrap">${Formatter.date(c.createdAt)}</td>
                    <td class="fw-semibold">${this._esc(this._nomeCliente(c))}</td>
                    <td class="text-nowrap">${this._esc(rota)}</td>
                    <td class="small">${this._esc(datas)}</td>
                    <td class="small">${this._esc(cias)}${tarifaTxt ? `<div class="text-muted">${this._esc(tarifaTxt)}</div>` : ''}</td>
                    <td class="text-end fw-bold text-nowrap">${Formatter.currency(c.dadosPdf?.precos?.total ?? c.total)}</td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-sm btn-outline-secondary" title="Abrir para editar" ${temPdf ? '' : 'disabled'}
                                onclick="CotacoesSalvasModule.abrir('${c.id}')"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-primary" title="PDF só desta" ${temPdf ? '' : 'disabled'}
                                onclick="CotacoesSalvasModule.gerarPdf(['${c.id}'])"><i class="bi bi-file-earmark-pdf"></i></button>
                        <button class="btn btn-sm btn-outline-danger" title="Excluir"
                                onclick="CotacoesSalvasModule.excluir(['${c.id}'])"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>`;
        }).join('');

        return `
            <table class="table table-hover table-sm align-middle mb-0">
                <thead class="table-light">
                    <tr>
                        <th class="text-center" style="width:36px;">
                            <input type="checkbox" class="form-check-input" title="Selecionar todas"
                                   ${todasMarcadas ? 'checked' : ''}
                                   ${!todasMarcadas && algumaMarcada ? 'data-indeterminado="1"' : ''}
                                   onchange="CotacoesSalvasModule.toggleTodas(this.checked)">
                        </th>
                        <th>Salva em</th><th>Cliente</th><th>Rota</th><th>Datas</th><th>Companhia / Tarifa</th>
                        <th class="text-end">Total</th><th></th>
                    </tr>
                </thead>
                <tbody>${linhas}</tbody>
            </table>`;
    },

    _aposRender() {
        // Checkbox "todas" em estado intermediário quando só parte está marcada
        document.querySelectorAll('[data-indeterminado="1"]').forEach(el => { el.indeterminate = true; });
    },

    toggle(id, marcado) {
        if (marcado) this._selecionadas.add(id);
        else this._selecionadas.delete(id);
        this.render();
    },

    toggleTodas(marcado) {
        this._selecionadas = marcado ? new Set(this._lista.map(c => c.id)) : new Set();
        this.render();
    },

    /**
     * Gera um único PDF com as cotações marcadas (ou com os ids recebidos).
     * Ordem das opções: da mais antiga para a mais recente.
     */
    async gerarPdf(ids) {
        const alvo = new Set(ids || [...this._selecionadas]);
        const selecionadas = this._lista.filter(c => alvo.has(c.id));
        const semDados = selecionadas.filter(c => !c.dadosPdf).length;
        const lista = selecionadas
            .filter(c => c.dadosPdf)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            .map(c => ({ ...c.dadosPdf, dataCriacao: c.dadosPdf.dataCriacao || c.createdAt }));

        if (lista.length === 0) {
            alert(semDados ? 'As cotações marcadas são antigas e não têm dados para o PDF.' : 'Marque ao menos uma cotação salva.');
            return;
        }
        if (semDados) alert(`${semDados} cotação(ões) antiga(s) sem dados para o PDF foram ignoradas.`);
        await ReportModule.gerarCotacoesPDF(lista);
    },

    /**
     * Abre a cotação salva na página Cotação para ajustar e salvar de novo
     * (o salvar atualiza o mesmo registro).
     */
    abrir(id) {
        const c = this._lista.find(x => x.id === id);
        if (!c || !c.dadosPdf) return;
        QuotationModule.abrirCotacaoSalva(c.id, c.dadosPdf);
        App.navigate('cotacao');
    },

    excluirSelecionadas() {
        return this.excluir([...this._selecionadas]);
    },

    async excluir(ids) {
        if (!ids || ids.length === 0) return;
        const msg = ids.length === 1
            ? 'Excluir esta cotação salva?'
            : `Excluir as ${ids.length} cotações selecionadas? Esta ação não pode ser desfeita.`;
        if (!confirm(msg)) return;

        try {
            const resp = await apiCall('/api/cotacoes/excluir-lote', {
                method: 'POST',
                body: JSON.stringify({ ids })
            });
            if (!resp) return;
            const json = await resp.json();
            if (!json.success) throw new Error(json.message || 'Erro ao excluir');

            ids.forEach(id => this._selecionadas.delete(id));
            // Cotação aberta na tela foi excluída: desvincula para o próximo "Salvar" criar outra
            if (window.QuotationModule && QuotationModule.cotacaoAtual && ids.includes(QuotationModule.cotacaoAtual.id)) {
                delete QuotationModule.cotacaoAtual.id;
                QuotationModule.cotacaoAtual.salva = false;
            }
            if (window.App && App.showToast) App.showToast(`${json.excluidas ?? ids.length} cotação(ões) excluída(s)`, 'success');
        } catch (err) {
            alert('Erro ao excluir: ' + err.message);
        }
        await this.carregar();
    }
};

window.CotacoesSalvasModule = CotacoesSalvasModule;
