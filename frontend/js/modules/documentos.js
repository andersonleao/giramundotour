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
                                <label class="form-label fw-semibold">Arquivos <span class="text-danger">*</span></label>
                                <input type="file" id="docArquivo" class="form-control" multiple
                                       accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                       onchange="DocumentosModule._onArquivo(event)">
                                <div class="form-text">Formatos aceitos: PDF, DOC, DOCX — máx. 12 MB cada. Você pode selecionar vários.</div>
                                <div id="docArquivoInfo" class="mt-2"></div>
                            </div>
                            <div class="row g-3">
                                <div class="col-md-7">
                                    <label class="form-label fw-semibold">Nome do documento <span class="text-danger">*</span></label>
                                    <input type="text" id="docNome" class="form-control" placeholder="Ex: Contrato de Prestação de Serviços">
                                    <div class="form-text" id="docNomeHelp"></div>
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
        this._arquivos = [];
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        set('docNome', '');
        set('docDescricao', '');
        set('docCategoria', this.CATEGORIAS[0]);
        const nomeEl = document.getElementById('docNome');
        if (nomeEl) nomeEl.disabled = false;
        const fileEl = document.getElementById('docArquivo');
        if (fileEl) fileEl.value = '';
        const info = document.getElementById('docArquivoInfo');
        if (info) info.innerHTML = '';
        const help = document.getElementById('docNomeHelp');
        if (help) help.textContent = '';

        new bootstrap.Modal(document.getElementById('modalDocumento')).show();
    },

    fecharModal() {
        bootstrap.Modal.getInstance(document.getElementById('modalDocumento'))?.hide();
    },

    async _onArquivo(event) {
        const files = Array.from(event.target.files || []);
        const info = document.getElementById('docArquivoInfo');
        this._arquivos = [];
        if (!files.length) { if (info) info.innerHTML = ''; this._atualizarCampoNome(); return; }

        // Valida cada arquivo (formato e tamanho); os inválidos são ignorados
        const validos = [];
        for (const file of files) {
            const nome = file.name.toLowerCase();
            const ok = nome.endsWith('.pdf') || nome.endsWith('.doc') || nome.endsWith('.docx');
            if (!ok) { App.showToast(`"${file.name}" ignorado: formato inválido.`, 'warning'); continue; }
            if (file.size > this.MAX_BYTES) { App.showToast(`"${file.name}" ignorado: maior que 12 MB.`, 'warning'); continue; }
            validos.push(file);
        }
        if (!validos.length) { event.target.value = ''; if (info) info.innerHTML = ''; this._atualizarCampoNome(); return; }

        // Lê todos como base64
        const lidos = await Promise.all(validos.map(f => this._lerArquivo(f)));
        this._arquivos = lidos.filter(Boolean);

        // Lista dos arquivos selecionados
        if (info) {
            info.innerHTML = this._arquivos.map(a => {
                const ic = this._iconeTipo(a.tipo);
                return `
                    <div class="alert alert-light border d-flex align-items-center gap-2 mb-1 py-2">
                        <i class="bi ${ic.icon}" style="font-size:1.3rem; color:${ic.cor}"></i>
                        <div>
                            <strong>${this._esc(a.nomeOriginal)}</strong>
                            <span class="text-muted small ms-2">${this._fmtTamanho(a.size)}</span>
                        </div>
                    </div>`;
            }).join('');
        }
        this._atualizarCampoNome();
    },

    _lerArquivo(file) {
        return new Promise(res => {
            const reader = new FileReader();
            reader.onload = (e) => res({
                base64:       e.target.result, // data:...;base64,....
                mime:         file.type || '',
                nomeOriginal: file.name,
                size:         file.size,
                tipo:         file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'word',
            });
            reader.onerror = () => res(null);
            reader.readAsDataURL(file);
        });
    },

    // Ajusta o campo "Nome": editável com 1 arquivo; desativado (usa nome próprio) com vários
    _atualizarCampoNome() {
        const nomeEl = document.getElementById('docNome');
        const help   = document.getElementById('docNomeHelp');
        const n = (this._arquivos || []).length;
        if (!nomeEl) return;

        if (n === 1) {
            nomeEl.disabled = false;
            if (!nomeEl.value.trim()) {
                const orig = this._arquivos[0].nomeOriginal;
                nomeEl.value = orig.replace(/\.(pdf|docx?)$/i, '').trim() || orig;
            }
            if (help) help.textContent = '';
        } else if (n > 1) {
            nomeEl.value = '';
            nomeEl.disabled = true;
            if (help) help.textContent = `${n} arquivos selecionados — cada um será salvo com o próprio nome.`;
        } else {
            nomeEl.disabled = false;
            if (help) help.textContent = '';
        }
    },

    async salvar() {
        if (this._salvando) return;

        const arquivos = this._arquivos || [];
        if (!arquivos.length) { App.showToast('Selecione ao menos um arquivo', 'warning'); return; }

        const categoria = document.getElementById('docCategoria')?.value || null;
        const descricao = document.getElementById('docDescricao')?.value?.trim() || null;
        const nomeUnico = document.getElementById('docNome')?.value?.trim();

        // Com um único arquivo o nome é obrigatório; com vários, usa-se o nome de cada arquivo
        if (arquivos.length === 1 && !nomeUnico) { App.showToast('Informe o nome do documento', 'warning'); return; }

        const btn = document.getElementById('btnSalvarDoc');
        const btnHtml = btn?.innerHTML;
        this._salvando = true;
        if (btn) btn.disabled = true;

        let ok = 0, fail = 0;
        try {
            for (let i = 0; i < arquivos.length; i++) {
                const a = arquivos[i];
                const nome = arquivos.length === 1
                    ? nomeUnico
                    : (a.nomeOriginal.replace(/\.(pdf|docx?)$/i, '').trim() || a.nomeOriginal);

                if (btn) btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Importando ${i + 1}/${arquivos.length}...`;

                const payload = { nome, descricao, categoria, mimeType: a.mime || null, conteudoBase64: a.base64 };
                try {
                    const resp = await apiCall('/api/documentos', { method: 'POST', body: JSON.stringify(payload) });
                    const result = resp && await resp.json();
                    if (resp && resp.ok && result && result.success) ok++; else fail++;
                } catch (e) { fail++; }
            }

            if (ok > 0) {
                App.showToast(`${ok} documento${ok > 1 ? 's' : ''} importado${ok > 1 ? 's' : ''}${fail ? ` — ${fail} com erro` : ''}!`, fail ? 'warning' : 'success');
                this.fecharModal();
                await this.loadList();
            } else {
                App.showToast('Erro ao importar documento(s)', 'error');
            }
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
