// GiraMundoTour - Gestão de Usuários (admin)

const UsuariosModule = {
    _usuarios: [],
    _menus: [],
    _editandoId: null,

    // Rótulos amigáveis para os menus (chave = key do data-page)
    MENU_LABELS: {
        busca:         { label: 'Buscar Voos',    icon: 'bi-search' },
        dashboard:     { label: 'Dashboard',      icon: 'bi-speedometer2' },
        cotacao:       { label: 'Cotação',        icon: 'bi-file-earmark-text' },
        bilhetes:      { label: 'Bilhetes',       icon: 'bi-ticket-perforated' },
        reservas:      { label: 'Reservas',       icon: 'bi-bookmark-check' },
        hoteis:        { label: 'Hotéis',         icon: 'bi-hotel' },
        monitoramento: { label: 'Monitoramento',  icon: 'bi-graph-down-arrow' },
        clientes:      { label: 'Clientes',       icon: 'bi-people' },
        fornecedores:  { label: 'Fornecedores',   icon: 'bi-building' },
        usuarios:      { label: 'Usuários',       icon: 'bi-person-badge' }
    },

    init() {},

    async render() {
        const container = document.getElementById('usuariosContent');
        if (!container) return;

        const user = App.getUser && App.getUser();
        if (!user || user.perfil !== 'admin') {
            container.innerHTML = `<div class="alert alert-warning"><i class="bi bi-shield-lock"></i> Acesso restrito a administradores.</div>`;
            return;
        }

        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

        try {
            const [respUsr, respMenus] = await Promise.all([
                apiCall('/api/usuarios'),
                apiCall('/api/usuarios/menus')
            ]);
            if (!respUsr || !respMenus) return;

            const usrJson   = await respUsr.json();
            const menusJson = await respMenus.json();
            this._usuarios = usrJson.data || [];
            this._menus    = menusJson.data || [];
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">Erro ao carregar: ${err.message}</div>`;
            return;
        }

        this._renderUI();
    },

    _renderUI() {
        const container = document.getElementById('usuariosContent');
        const ativos = this._usuarios.filter(u => u.ativo).length;

        container.innerHTML = `
            <div class="d-flex flex-wrap gap-2 mb-3 align-items-center">
                <div class="flex-grow-1">
                    <small class="text-muted">
                        Total: <strong>${this._usuarios.length}</strong> •
                        Ativos: <strong class="text-success">${ativos}</strong>
                    </small>
                </div>
                <button class="btn btn-primary btn-sm" onclick="UsuariosModule.abrirFormulario()">
                    <i class="bi bi-person-plus"></i> Novo Usuário
                </button>
            </div>

            <div id="usrFormWrap"></div>

            <div class="card">
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0" style="font-size:0.9rem;">
                            <thead class="table-light">
                                <tr>
                                    <th>Status</th>
                                    <th>Nome</th>
                                    <th>Email</th>
                                    <th>Perfil</th>
                                    <th>Menus Permitidos</th>
                                    <th style="width:160px;">Ações</th>
                                </tr>
                            </thead>
                            <tbody>${this._renderRows()}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    _renderRows() {
        if (!this._usuarios.length) {
            return `<tr><td colspan="6" class="text-center text-muted py-4">Nenhum usuário cadastrado</td></tr>`;
        }

        const currentId = (App.getUser && App.getUser() || {}).id;

        return this._usuarios.map(u => {
            const menus = Array.isArray(u.menusPermitidos) ? u.menusPermitidos : null;
            const menusBadge = u.perfil === 'admin'
                ? `<span class="badge bg-primary">Todos (admin)</span>`
                : (menus === null || menus === undefined)
                    ? `<span class="badge bg-secondary">Todos</span>`
                    : menus.length === 0
                        ? `<span class="badge bg-warning text-dark">Nenhum</span>`
                        : menus.map(m => `<span class="badge bg-info text-dark me-1 mb-1">${(this.MENU_LABELS[m] && this.MENU_LABELS[m].label) || m}</span>`).join('');

            const isSelf = u.id === currentId;

            return `
                <tr>
                    <td>${u.ativo
                        ? '<span class="badge bg-success">Ativo</span>'
                        : '<span class="badge bg-secondary">Inativo</span>'}</td>
                    <td>${this._escape(u.nome)}</td>
                    <td><small class="text-muted">${this._escape(u.email)}</small></td>
                    <td><span class="badge bg-dark text-uppercase">${u.perfil}</span></td>
                    <td style="max-width:360px;">${menusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" title="Editar" onclick="UsuariosModule.editar('${u.id}')">
                            <i class="bi bi-pencil"></i>
                        </button>
                        ${!isSelf ? `
                        <button class="btn btn-sm btn-outline-danger" title="Desativar" onclick="UsuariosModule.excluir('${u.id}')">
                            <i class="bi bi-trash"></i>
                        </button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    },

    abrirFormulario() {
        this._editandoId = null;
        this._renderForm(null);
    },

    editar(id) {
        const u = this._usuarios.find(x => x.id === id);
        if (!u) return;
        this._editandoId = id;
        this._renderForm(u);
    },

    _renderForm(u) {
        const wrap = document.getElementById('usrFormWrap');
        const isEdit = !!u;
        const perfilAtual = u?.perfil || 'operador';
        const menusAtuais = Array.isArray(u?.menusPermitidos) ? u.menusPermitidos : null;

        const menusCheckboxes = this._menus.map(key => {
            const label = (this.MENU_LABELS[key] && this.MENU_LABELS[key].label) || key;
            const icon  = (this.MENU_LABELS[key] && this.MENU_LABELS[key].icon)  || 'bi-dot';
            const checked = menusAtuais === null ? true : menusAtuais.includes(key);
            return `
                <label class="col-md-4 col-lg-3 d-flex align-items-center gap-2 py-1 mb-0">
                    <input type="checkbox" class="form-check-input mt-0 usr-menu-check" value="${key}" ${checked ? 'checked' : ''}>
                    <i class="bi ${icon}"></i> ${label}
                </label>
            `;
        }).join('');

        wrap.innerHTML = `
            <div class="card mb-3 border-primary">
                <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                    <strong><i class="bi bi-${isEdit ? 'pencil' : 'person-plus'}"></i> ${isEdit ? 'Editar Usuário' : 'Novo Usuário'}</strong>
                    <button class="btn-close btn-close-white" onclick="UsuariosModule.fecharFormulario()"></button>
                </div>
                <div class="card-body">
                    <form id="usrForm" onsubmit="event.preventDefault(); UsuariosModule.salvar();">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label">Nome <span class="text-danger">*</span></label>
                                <input type="text" id="usrNome" class="form-control" required value="${this._escape(u?.nome || '')}">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Email <span class="text-danger">*</span></label>
                                <input type="email" id="usrEmail" class="form-control" required value="${this._escape(u?.email || '')}">
                            </div>

                            <div class="col-md-4">
                                <label class="form-label">Perfil <span class="text-danger">*</span></label>
                                <select id="usrPerfil" class="form-select" onchange="UsuariosModule._onPerfilChange()">
                                    <option value="operador" ${perfilAtual==='operador'?'selected':''}>Operador</option>
                                    <option value="gerente"  ${perfilAtual==='gerente' ?'selected':''}>Gerente</option>
                                    <option value="admin"    ${perfilAtual==='admin'   ?'selected':''}>Administrador</option>
                                </select>
                            </div>

                            <div class="col-md-4">
                                <label class="form-label">${isEdit ? 'Nova Senha (opcional)' : 'Senha'} ${!isEdit ? '<span class="text-danger">*</span>' : ''}</label>
                                <input type="password" id="usrSenha" class="form-control" minlength="6" ${isEdit ? '' : 'required'} placeholder="${isEdit ? 'Deixe em branco para manter' : 'Mínimo 6 caracteres'}">
                            </div>

                            <div class="col-md-4">
                                <label class="form-label">Status</label>
                                <div class="form-check form-switch mt-2">
                                    <input type="checkbox" id="usrAtivo" class="form-check-input" ${u?.ativo !== false ? 'checked' : ''}>
                                    <label class="form-check-label" for="usrAtivo">Usuário ativo</label>
                                </div>
                            </div>

                            <div class="col-12" id="usrMenusWrap">
                                <label class="form-label mb-2">
                                    <i class="bi bi-list-check"></i> Menus de acesso
                                    <small class="text-muted">(administradores sempre acessam todos os menus)</small>
                                </label>
                                <div class="border rounded p-3 bg-light">
                                    <div class="d-flex gap-2 mb-2">
                                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="UsuariosModule._marcarTodos(true)">
                                            <i class="bi bi-check-all"></i> Marcar todos
                                        </button>
                                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="UsuariosModule._marcarTodos(false)">
                                            <i class="bi bi-x-lg"></i> Desmarcar todos
                                        </button>
                                    </div>
                                    <div class="row g-1" id="usrMenusList">${menusCheckboxes}</div>
                                </div>
                            </div>
                        </div>

                        <div class="text-end mt-3">
                            <button type="button" class="btn btn-secondary" onclick="UsuariosModule.fecharFormulario()">Cancelar</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="bi bi-check-lg"></i> ${isEdit ? 'Salvar' : 'Criar Usuário'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        this._onPerfilChange();
    },

    _onPerfilChange() {
        const perfil = document.getElementById('usrPerfil')?.value;
        const wrap = document.getElementById('usrMenusWrap');
        if (!wrap) return;
        if (perfil === 'admin') {
            wrap.style.opacity = '0.5';
            wrap.style.pointerEvents = 'none';
        } else {
            wrap.style.opacity = '1';
            wrap.style.pointerEvents = 'auto';
        }
    },

    _marcarTodos(marcar) {
        document.querySelectorAll('.usr-menu-check').forEach(cb => cb.checked = !!marcar);
    },

    fecharFormulario() {
        const wrap = document.getElementById('usrFormWrap');
        if (wrap) wrap.innerHTML = '';
        this._editandoId = null;
    },

    async salvar() {
        const nome   = document.getElementById('usrNome').value.trim();
        const email  = document.getElementById('usrEmail').value.trim().toLowerCase();
        const perfil = document.getElementById('usrPerfil').value;
        const senha  = document.getElementById('usrSenha').value;
        const ativo  = document.getElementById('usrAtivo').checked;

        const menusPermitidos = perfil === 'admin'
            ? null
            : Array.from(document.querySelectorAll('.usr-menu-check'))
                .filter(cb => cb.checked)
                .map(cb => cb.value);

        if (!nome || !email) {
            App.showToast('Nome e email são obrigatórios', 'error');
            return;
        }
        if (!this._editandoId && (!senha || senha.length < 6)) {
            App.showToast('Senha é obrigatória e deve ter no mínimo 6 caracteres', 'error');
            return;
        }

        const payload = { nome, email, perfil, ativo, menusPermitidos };
        if (senha) payload.senha = senha;

        try {
            const resp = this._editandoId
                ? await apiCall(`/api/usuarios/${this._editandoId}`, { method: 'PUT', body: JSON.stringify(payload) })
                : await apiCall('/api/usuarios', { method: 'POST', body: JSON.stringify(payload) });

            if (!resp) return;
            const json = await resp.json();
            if (!resp.ok) {
                App.showToast(json.message || 'Erro ao salvar', 'error');
                return;
            }

            App.showToast(this._editandoId ? 'Usuário atualizado' : 'Usuário criado', 'success');
            this.fecharFormulario();
            await this.render();
        } catch (err) {
            App.showToast('Erro: ' + err.message, 'error');
        }
    },

    excluir(id) {
        const u = this._usuarios.find(x => x.id === id);
        if (!u) return;
        App.showConfirm('Desativar Usuário', `Desativar ${u.nome}? O usuário não conseguirá mais acessar o sistema.`, async () => {
            try {
                const resp = await apiCall(`/api/usuarios/${id}`, { method: 'DELETE' });
                if (!resp) return;
                if (!resp.ok) {
                    const json = await resp.json().catch(() => ({}));
                    App.showToast(json.message || 'Erro ao desativar', 'error');
                    return;
                }
                App.showToast('Usuário desativado', 'success');
                await this.render();
            } catch (err) {
                App.showToast('Erro: ' + err.message, 'error');
            }
        });
    },

    _escape(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }
};

window.UsuariosModule = UsuariosModule;
