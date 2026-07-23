// GiraMundoTour - Módulo de Documentos (arquivos Word e PDF da empresa)

const DocumentosModule = {
    _docs: [],
    _salvando: false,
    MAX_BYTES: 12 * 1024 * 1024, // 12 MB — base64 (~+34%) precisa caber no limite de 20mb JSON do backend

    CATEGORIAS: ['Contratos', 'Certificados', 'Modelos', 'Documentos Legais', 'Financeiro', 'Outros'],

    init() {
        debugLog('DocumentosModule: Inicializado');
    },

    async render() {
        const container = document.getElementById('documentosContent');
        if (!container) return;

        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <div class="input-group" style="width:280px">
                        <span class="input-group-text"><i class="bi bi-search"></i></span>
                        <input type="text" id="buscaDoc" class="form-control"
                               placeholder="Buscar documento..." oninput="DocumentosModule._filtrar()">
                    </div>
                    <select id="filtroTipoDoc" class="form-select" style="width:150px" onchange="DocumentosModule._filtrar()">
                        <option value="">Todos os tipos</option>
                        <option value="pdf">PDF</option>
                        <option value="word">Word</option>
                    </select>
                    <select id="filtroCatDoc" class="form-select" style="width:180px" onchange="DocumentosModule._filtrar()">
                        <option value="">Todas as categorias</option>
                        ${this.CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <button class="btn btn-primary" onclick="DocumentosModule.abrirModal()">
                    <i class="bi bi-upload me-1"></i>Importar Documento
                </button>
            </div>

            <div id="documentosLista"></div>

            <!-- Modal de importação -->
            <div class="modal fade" id="modalDocumento" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header text-white" style="background:#1a365d;">
                            <h5 class="modal-title"><i class="bi bi-file-earmark-arrow-up me-2"></i>Importar Documento</h5>
                            <button type="button" class="btn-close btn-close-white" onclick="DocumentosModule.fecharModal()"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label fw-semibold">Arquivo <span class="text-danger">*</span></label>
                                <input type="file" id="docArquivo" class="form-control"
                                       accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                       onchange="DocumentosModule._onArquivo(event)">
                                <div class="form-text">Formatos aceitos: PDF, DOC, DOCX — máx. 12 MB.</div>
                                <div id="docArquivoInfo" class="mt-2"></div>
                            </div>
                            <div class="row g-3">
                                <div class="col-md-7">
                                    <label class="form-label fw-semibold">Nome do documento <span class="text-danger">*</span></label>
                                    <input type="text" id="docNome" class="form-control" placeholder="Ex: Contrato de Prestação de Serviços">
                                </div>
                                <div class="col-md-5">
                                    <label class="form-label fw-semibold">Categoria</label>
                                    <select id="docCategoria" class="form-select">
                                        ${this.CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="col-12">
                                    <label class="form-label fw-semibold">Descrição</label>
                                    <textarea id="docDescricao" class="form-control" rows="3"
                                              placeholder="Informações adicionais sobre o documento (opcional)"></textarea>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" onclick="DocumentosModule.fecharModal()">Cancelar</button>
                            <button class="btn btn-primary" id="btnSalvarDoc" onclick="DocumentosModule.salvar()">
                                <i class="bi bi-upload me-1"></i>Importar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadList();
    },

    async loadList() {
        try {
            const resp = await apiCall('/api/documentos');
            if (!resp || !resp.ok) return;
            const result = await resp.json();
            if (result.success) {
                this._docs = result.data || [];
                this._renderLista(this._docs);
            }
        } catch (e) {
            console.error('[Documentos]', e);
        }
    },

    _filtrar() {
        const q   = (document.getElementById('buscaDoc')?.value || '').toLowerCase();
        const tp  = document.getElementById('filtroTipoDoc')?.value || '';
        const cat = document.getElementById('filtroCatDoc')?.value || '';
        const lista = this._docs.filter(d => {
            const matchQ   = !q || (d.nome || '').toLowerCase().includes(q) ||
                             (d.descricao || '').toLowerCase().includes(q);
            const matchTp  = !tp || d.tipo === tp;
            const matchCat = !cat || d.categoria === cat;
            return matchQ && matchTp && matchCat;
        });
        this._renderLista(lista);
    },

    _renderLista(lista) {
        const container = document.getElementById('documentosLista');
        if (!container) return;

        if (!lista.length) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-folder2-open" style="font-size:3rem; opacity:.3;"></i>
                    <div class="mt-2">Nenhum documento encontrado</div>
                    <button class="btn btn-primary mt-3" onclick="DocumentosModule.abrirModal()">
                        <i class="bi bi-upload me-1"></i>Importar primeiro documento
                    </button>
                </div>`;
            return;
        }

        const rows = lista.map(d => {
            const ic = this._iconeTipo(d.tipo);
            return `
                <tr>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi ${ic.icon}" style="font-size:1.4rem; color:${ic.cor}"></i>
                            <div>
                                <div class="fw-semibold">${this._esc(d.nome)}</div>
                                ${d.descricao ? `<small class="text-muted">${this._esc(d.descricao)}</small>` : ''}
                            </div>
                        </div>
                    </td>
                    <td>${d.categoria ? `<span class="badge bg-light text-dark border">${this._esc(d.categoria)}</span>` : '<span class="text-muted">—</span>'}</td>
                    <td><span class="badge" style="background:${ic.cor}">${ic.label}</span></td>
                    <td class="text-nowrap">${this._fmtTamanho(d.tamanho)}</td>
                    <td class="text-nowrap">${this._fmtData(d.createdAt)}</td>
                    <td class="text-end">
                        <div class="d-flex gap-1 justify-content-end">
                            <button class="btn btn-sm btn-outline-primary" title="Baixar"
                                    onclick="DocumentosModule.download('${d.id}')">
                                <i class="bi bi-download"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" title="Excluir"
                                    onclick="DocumentosModule.excluir('${d.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="card">
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th>Documento</th>
                                    <th>Categoria</th>
                                    <th>Tipo</th>
                                    <th>Tamanho</th>
                                    <th>Data</th>
                                    <th class="text-end">Ações</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
            </div>`;
    },

    // ── Modal de importação ──────────────────────────────────────────

    abrirModal() {
        this._arquivoBase64 = null;
        this._arquivoMime = null;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        set('docNome', '');
        set('docDescricao', '');
        set('docCategoria', this.CATEGORIAS[0]);
        const fileEl = document.getElementById('docArquivo');
        if (fileEl) fileEl.value = '';
        const info = document.getElementById('docArquivoInfo');
        if (info) info.innerHTML = '';

        new bootstrap.Modal(document.getElementById('modalDocumento')).show();
    },

    fecharModal() {
        bootstrap.Modal.getInstance(document.getElementById('modalDocumento'))?.hide();
    },

    _onArquivo(event) {
        const file = event.target.files[0];
        const info = document.getElementById('docArquivoInfo');
        if (!file) { if (info) info.innerHTML = ''; return; }

        // Valida extensão / tipo
        const nome = file.name.toLowerCase();
        const ok = nome.endsWith('.pdf') || nome.endsWith('.doc') || nome.endsWith('.docx');
        if (!ok) {
            App.showToast('Formato inválido. Envie um arquivo PDF, DOC ou DOCX.', 'warning');
            event.target.value = '';
            if (info) info.innerHTML = '';
            return;
        }
        if (file.size > this.MAX_BYTES) {
            App.showToast('Arquivo muito grande. Máximo 12 MB.', 'warning');
            event.target.value = '';
            if (info) info.innerHTML = '';
            return;
        }

        // Preenche o nome automaticamente se ainda estiver vazio
        const nomeEl = document.getElementById('docNome');
        if (nomeEl && !nomeEl.value.trim()) {
            nomeEl.value = file.name.replace(/\.(pdf|docx?)$/i, '').trim() || file.name;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this._arquivoBase64 = e.target.result; // data:...;base64,....
            this._arquivoMime   = file.type || '';
            this._arquivoNomeOriginal = file.name;
            if (info) {
                const ic = this._iconeTipo(nome.endsWith('.pdf') ? 'pdf' : 'word');
                info.innerHTML = `
                    <div class="alert alert-light border d-flex align-items-center gap-2 mb-0 py-2">
                        <i class="bi ${ic.icon}" style="font-size:1.4rem; color:${ic.cor}"></i>
                        <div>
                            <strong>${this._esc(file.name)}</strong>
                            <span class="text-muted small ms-2">${this._fmtTamanho(file.size)}</span>
                        </div>
                    </div>`;
            }
        };
        reader.readAsDataURL(file);
    },

    async salvar() {
        if (this._salvando) return;

        const nome = document.getElementById('docNome')?.value?.trim();
        if (!this._arquivoBase64) { App.showToast('Selecione um arquivo', 'warning'); return; }
        if (!nome)                { App.showToast('Informe o nome do documento', 'warning'); return; }

        const payload = {
            nome,
            descricao:      document.getElementById('docDescricao')?.value?.trim() || null,
            categoria:      document.getElementById('docCategoria')?.value || null,
            mimeType:       this._arquivoMime || null,
            conteudoBase64: this._arquivoBase64,
        };

        const btn = document.getElementById('btnSalvarDoc');
        const btnHtml = btn?.innerHTML;
        this._salvando = true;
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Importando...'; }

        try {
            const resp = await apiCall('/api/documentos', { method: 'POST', body: JSON.stringify(payload) });
            if (!resp) return;
            const result = await resp.json();
            if (resp.ok && result.success) {
                App.showToast('Documento importado com sucesso!', 'success');
                this.fecharModal();
                await this.loadList();
            } else {
                App.showToast(result.message || 'Erro ao importar documento', 'error');
            }
        } catch (e) {
            App.showToast('Erro ao importar documento', 'error');
        } finally {
            this._salvando = false;
            if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = btnHtml; }
        }
    },

    // ── Download ─────────────────────────────────────────────────────

    async download(id) {
        const doc = this._docs.find(d => d.id === id);
        App.showToast('Preparando download...', 'info');
        try {
            const resp = await apiCall(`/api/documentos/${id}/download`);
            if (!resp || !resp.ok) { App.showToast('Erro ao baixar documento', 'error'); return; }
            const blob = await resp.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url;
            a.download = (doc && doc.nome) ? this._nomeArquivo(doc) : 'documento';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {
            App.showToast('Erro ao baixar documento', 'error');
        }
    },

    excluir(id) {
        const doc = this._docs.find(d => d.id === id);
        App.showConfirm('Excluir Documento', `Excluir "${doc?.nome || 'documento'}"? Esta ação não pode ser desfeita.`, async () => {
            try {
                const resp = await apiCall(`/api/documentos/${id}`, { method: 'DELETE' });
                if (!resp || !resp.ok) { App.showToast('Erro ao excluir', 'error'); return; }
                App.showToast('Documento excluído', 'success');
                await this.loadList();
            } catch (e) {
                App.showToast('Erro ao excluir documento', 'error');
            }
        });
    },

    // ── Helpers ──────────────────────────────────────────────────────

    _nomeArquivo(doc) {
        // Garante uma extensão coerente com o tipo no nome baixado
        const nome = doc.nome || 'documento';
        if (/\.(pdf|doc|docx)$/i.test(nome)) return nome;
        const ext = doc.tipo === 'pdf' ? '.pdf'
                  : doc.tipo === 'word' ? ((doc.mimeType || '').includes('openxml') ? '.docx' : '.doc')
                  : '';
        return nome + ext;
    },

    _iconeTipo(tipo) {
        if (tipo === 'pdf')  return { icon: 'bi-file-earmark-pdf-fill',  cor: '#dc3545', label: 'PDF'  };
        if (tipo === 'word') return { icon: 'bi-file-earmark-word-fill', cor: '#2b579a', label: 'Word' };
        return { icon: 'bi-file-earmark-fill', cor: '#6c757d', label: 'Arquivo' };
    },

    _fmtTamanho(bytes) {
        const b = +bytes || 0;
        if (b < 1024) return b + ' B';
        if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
        return (b / 1024 / 1024).toFixed(2) + ' MB';
    },

    _fmtData(d) {
        if (!d) return '—';
        const dt = new Date(d);
        if (isNaN(dt)) return '—';
        return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    _esc(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
};

window.DocumentosModule = DocumentosModule;
