const App = {
    // Estado de la aplicación
    state: {
        clients: [],
        projects: [],
        payments: [],
        logs: [],
        currentUser: null,
        currentAdminView: 'clients',
    },

    // Inicialización de la aplicación
    async init() {
        // La carga de datos se moverá a un flujo post-login o de recarga de sesión.
        // Aquí solo vinculamos eventos y manejamos la ruta inicial.
        this.bindEvents();
        await this.Router.handleRouteChange();
        window.addEventListener('hashchange', () => this.Router.handleRouteChange());
    },

    // --- NUEVA FUNCIÓN PARA CARGAR DATOS DEL ADMIN ---
    async loadAdminData() {
        const { data: clientsData, error: clientsError } = await window.supabase.from('clients').select('*');
        if (clientsError) console.error('Error cargando clientes:', clientsError);
        this.state.clients = clientsData || [];

        const { data: projectsData, error: projectsError } = await window.supabase.from('projects').select('*');
        if (projectsError) console.error('Error cargando proyectos:', projectsError);
        this.state.projects = projectsData || [];

        const { data: paymentsData, error: paymentsError } = await window.supabase.from('payments').select('*');
        if (paymentsError) console.error('Error cargando pagos:', paymentsError);
        this.state.payments = paymentsData || [];

        try {
            const { data: logsData, error: logsError } = await window.supabase
                .from('logs')
                // --- CORRECCIÓN: Añadir user_email a la consulta ---
                .select('log_id, user_id, user_email, action_type, description, timestamp')
                .order('timestamp', { ascending: false })
                .limit(100);

            if (logsError) {
                console.error('Error fetching logs:', logsError);
                this.state.logs = [];
            } else {
                this.state.logs = (logsData || []).map(l => ({
                    id: l.log_id,
                    timestamp: l.timestamp ? new Date(l.timestamp).toLocaleString() : new Date().toLocaleString(),
                    action: l.action_type || '',
                    description: l.description || '',
                    user_id: l.user_id || null,
                    user_email: l.user_email || null // --- CORRECCIÓN: Guardar el email en el estado ---
                }));
            }
        } catch (e) {
            console.error('Error loading logs from Supabase:', e);
            this.state.logs = [];
        }
    },

    bindEvents() {
        document.getElementById('login-form').addEventListener('submit', (e) => this.Auth.handleLogin(e));
        document.getElementById('logout-btn').addEventListener('click', () => this.Auth.logout());
        // CORRECCIÓN: Verificar si el botón de imprimir existe antes de añadir el evento.
        const printButton = document.getElementById('print-button');
        if (printButton) {
            printButton.addEventListener('click', () => window.print());
        }

        // --- INICIO: EVENTO PARA EL NUEVO BOTÓN DE IMPRESIÓN DEL ADMIN ---
        const adminPrintButton = document.getElementById('admin-print-button');
        if (adminPrintButton) {
            adminPrintButton.addEventListener('click', () => window.print());
        }
        // --- FIN: EVENTO PARA EL NUEVO BOTÓN DE IMPRESIÓN DEL ADMIN ---

        // --- NUEVOS EVENTOS PARA REGISTRO ---
        document.getElementById('register-btn').addEventListener('click', () => this.Auth.toggleAuthView(false));
        document.getElementById('back-to-login-link').addEventListener('click', () => this.Auth.toggleAuthView(true));
        document.getElementById('register-form').addEventListener('submit', (e) => this.Auth.handleRegistration(e));
        // --- FIN DE NUEVOS EVENTOS ---

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.Admin.setView(btn.dataset.view));
        });

        document.getElementById('add-client-btn').addEventListener('click', () => this.Admin.toggleClientForm());
        document.getElementById('cancel-client-form').addEventListener('click', () => this.Admin.toggleClientForm());
        document.getElementById('client-form').addEventListener('submit', (e) => this.Admin.saveClient(e));
        document.getElementById('clients-table-body').addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return; // No se hizo clic en un botón

            const action = button.dataset.action;
            const idRaw = button.dataset.id;
            const id = idRaw ? Number(idRaw) : NaN;
            if (isNaN(id)) return; // salir si id inválido

            if (action === 'edit-client') {
                App.Admin.editClient(id);
            } else if (action === 'delete-client') {
                App.Admin.deleteClient(id);
            } else if (action === 'generate-token') {
                App.Admin.generateToken(id);
            }
        });

        document.getElementById('add-project-btn').addEventListener('click', () => this.Admin.toggleProjectForm());
        document.getElementById('cancel-project-form').addEventListener('click', () => this.Admin.toggleProjectForm());
        document.getElementById('project-form').addEventListener('submit', (e) => this.Admin.saveProject(e));
        document.getElementById('projects-table-body').addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            const idRaw = button.dataset.id;
            const id = idRaw ? Number(idRaw) : NaN;
            if (isNaN(id)) return; // proteger contra ids inválidos

            if (action === 'edit-project') {
                App.Admin.editProject(id);
            } else if (action === 'delete-project') {
                App.Admin.deleteProject(id);
            }
        });

        document.getElementById('add-payment-btn').addEventListener('click', () => this.Admin.togglePaymentForm());
        document.getElementById('cancel-payment-form').addEventListener('click', () => this.Admin.togglePaymentForm());
        document.getElementById('payment-form').addEventListener('submit', (e) => this.Admin.savePayment(e));
        document.getElementById('payments-table-body').addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            const id = button.dataset.id;

            if (!id) return;

            console.log(`Action: ${action}, ID: ${id}`);

            if (action === 'edit-payment') {
                App.Admin.editPayment(id);
            } else if (action === 'delete-payment') {
                App.Admin.deletePayment(id);
            }
        });

    },

    // Módulo de autenticación
    Auth: {
        // --- NUEVA FUNCIÓN PARA CAMBIAR VISTAS ---
        toggleAuthView(showLogin) {
            document.getElementById('login-page').style.display = showLogin ? 'block' : 'none';
            document.getElementById('register-page').style.display = showLogin ? 'none' : 'block';
        },

        // --- NUEVA FUNCIÓN PARA MANEJAR EL REGISTRO ---
        async handleRegistration(event) {
            event.preventDefault();
            const registerButton = document.querySelector('#register-form button[type="submit"]');
            const originalButtonText = registerButton.innerHTML;
            registerButton.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Procesando...`;
            registerButton.disabled = true;

            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const feedbackEl = document.getElementById('register-feedback');

            // Usamos el cliente de Supabase que está en el objeto window
            const { data, error } = await window.supabase.auth.signUp({
                email: email,
                password: password,
            });

            if (error) {
                feedbackEl.textContent = `Error: ${error.message}`;
                feedbackEl.className = 'text-sm mt-3 text-center text-red-500';
            } else if (data.user && data.user.identities && data.user.identities.length === 0) {
                // Supabase a veces retorna un usuario sin identidades si ya existe pero no está confirmado
                feedbackEl.textContent = 'Este email ya está registrado. Por favor, inicia sesión o verifica tu correo.';
                feedbackEl.className = 'text-sm mt-3 text-center text-yellow-600';
            } else {
                feedbackEl.textContent = '¡Registro exitoso! Revisa tu correo electrónico para confirmar tu cuenta.';
                feedbackEl.className = 'text-sm mt-3 text-center text-green-600';
                document.getElementById('register-form').reset();
            }
            feedbackEl.classList.remove('hidden');
            // Restaurar botón
            registerButton.innerHTML = originalButtonText;
            registerButton.disabled = false;
        },

        async handleLogin(event) {
            event.preventDefault();
            const loginButton = document.querySelector('#login-form button[type="submit"]');
            const originalButtonText = loginButton.innerHTML;
            loginButton.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Iniciando Sesión...`;
            loginButton.disabled = true;

            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            const errorEl = document.getElementById('login-error');
            errorEl.classList.add('hidden');

            // Usamos el cliente de Supabase para iniciar sesión
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                errorEl.textContent = 'Credenciales inválidas. Inténtalo de nuevo.';
                errorEl.classList.remove('hidden');
                App.Logger.log(`Intento de inicio de sesión fallido para: ${email}.`);
                // Restaurar botón en caso de error
                loginButton.innerHTML = originalButtonText;
                loginButton.disabled = false;
            } else if (data.user) {
                App.state.currentUser = data.user;
                App.Logger.log(`Inicio de sesión exitoso del administrador: ${data.user.email}.`);
                
                // --- CAMBIO CLAVE: Cargar datos y luego navegar ---
                await App.loadAdminData(); // Cargar todos los datos necesarios
                window.location.hash = '#/admin'; // Navegar a la vista de admin
            }
        },

        async logout() {
            App.Logger.log('Cierre de sesión del administrador.');
            await window.supabase.auth.signOut();
            App.state.currentUser = null;
            window.location.hash = '#/login';
            // Forzar recarga para limpiar completamente el estado
            window.location.reload();
        },

        async checkSession() {
            const { data: { session } } = await window.supabase.auth.getSession();
            if (session) {
                App.state.currentUser = session.user;
                return session.user;
            }
            App.state.currentUser = null;
            return null;
        }
    },

    // Módulo de administración
    Admin: {
        init() {
            document.getElementById('logout-btn').classList.remove('hidden');
            this.setView(App.state.currentAdminView);
            this.renderClientsTable();
            this.renderProjectsTable();
            this.renderPaymentsTable();
            this.renderLogs();
            // Ocultar el loader general cuando la vista admin esté lista
            const mainLoader = document.getElementById('main-loader');
            if (mainLoader) mainLoader.classList.add('hidden');
        },

        setView(view) {
            App.state.currentAdminView = view;
            // Ocultar todas las sub-vistas
            document.querySelectorAll('.admin-sub-view').forEach(el => el.classList.add('hidden'));
            // Mostrar la vista seleccionada
            document.getElementById(`admin-${view}`).classList.remove('hidden');

            // Actualizar estilo de pestañas
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.view === view) {
                    btn.classList.add('active');
                }
            });
        },

        // --- Gestión de Clientes (CRUD) ---
       renderClientsTable() {
            const tbody = document.getElementById('clients-table-body');
            if (!tbody) return; // Salir si el elemento no existe
            tbody.innerHTML = App.state.clients.map(client => `
                <tr id="client-row-${client.id}">
                    <td class="px-6 py-4 whitespace-nowrap">${client.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${client.email}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${client.phone || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${client.address || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button data-action="generate-token" data-id="${client.id}" class="text-indigo-600 hover:text-indigo-900 mr-3">Generar Link</button>
                        <button data-action="edit-client" data-id="${client.id}" class="text-blue-600 hover:text-blue-900 mr-3">Editar</button>
                        <button data-action="delete-client" data-id="${client.id}" class="text-red-600 hover:text-red-900">Eliminar</button>
                    </td>
                </tr>
            `).join('');
        },

        toggleClientForm(reset = true) {
            const form = document.getElementById('client-form');
            form.classList.toggle('hidden');

            // Ocultar/mostrar botón "Añadir Cliente" mientras el formulario esté visible
            const addBtn = document.getElementById('add-client-btn');
            if (addBtn) {
                if (!form.classList.contains('hidden')) {
                    addBtn.classList.add('hidden');
                } else {
                    addBtn.classList.remove('hidden');
                }
            }

            if (reset) {
                form.reset();
                document.getElementById('client-id').value = '';
                document.getElementById('client-phone-input').value = ''; // Limpiar campo teléfono
                document.getElementById('client-address-input').value = ''; // Limpiar campo dirección
            }

            // Lógica para el contador de caracteres de la dirección
            const addressInput = document.getElementById('client-address-input');
            const charCount = document.getElementById('address-char-count');
            addressInput.maxLength = 80; // Limitar la entrada a 80  caracteres

            const updateCharCount = () => {
                const currentLength = addressInput.value.length;
                charCount.textContent = `${currentLength}/80`;
            };

            // Limpiar listener anterior para evitar duplicados al abrir/cerrar
            addressInput.removeEventListener('input', updateCharCount); 
            addressInput.addEventListener('input', updateCharCount);
            updateCharCount(); // Actualizar contador al abrir el formulario
        },
    
        async saveClient(event) {
            event.preventDefault();
            const id = document.getElementById('client-id').value;
            const name = document.getElementById('client-name-input').value;
            const email = document.getElementById('client-email-input').value;
            const phone = document.getElementById('client-phone-input').value;
            const address = document.getElementById('client-address-input').value;
            let error;
            let successMessage = '';

            if (id) { // Editar cliente existente
                const { error: updateError } = await window.supabase
                    .from('clients')
                    .update({ name, email, phone, address })
                    .eq('id', id);
                error = updateError;
                if (!error) successMessage = `Cliente '${name}' (ID: ${id}) actualizado.`;

            } else { // Crear nuevo cliente
                const { error: insertError } = await window.supabase
                    .from('clients')
                    .insert([{ name, email, phone, address }]);
                error = insertError;
                if (!error) successMessage = `Nuevo cliente '${name}' creado.`;
            }

            if (error) {
                showNotification(`Error al guardar el cliente: ${error.message}`);
                App.Logger.log(`Error al guardar cliente: ${error.message}`);
            } else {
                App.Logger.log(successMessage);
                // Recargar los datos de clientes desde la BD y re-renderizar la tabla
                const { data, error: fetchError } = await window.supabase.from('clients').select('*');
                if (fetchError) {
                    console.error('Error fetching clients after save:', fetchError);
                } else {
                    App.state.clients = data;
                    this.renderClientsTable();
                    this.toggleClientForm(); // Oculta el formulario después de guardar

                    // Actualizar el selector de clientes en el formulario de proyectos
                    this.toggleProjectForm(false); // Llama a toggleProjectForm para actualizar el selector
                }
            }
        },
        editClient(id) {
            id = Number(id);
            const client = App.state.clients.find(c => c.id === id);
            if (!client) {
                console.error(`No se encontró el cliente con ID: ${id}`);
                return;
            }
            if (client) {
                // Asegurarse de que el formulario esté visible antes de rellenarlo
                const form = document.getElementById('client-form');
                if (form.classList.contains('hidden')) {
                    this.toggleClientForm(false); // Llama a toggle sin resetear
                }

                // Rellenar los campos del formulario
                document.getElementById('client-id').value = client.id;
                document.getElementById('client-name-input').value = client.name;
                document.getElementById('client-email-input').value = client.email;
                document.getElementById('client-phone-input').value = client.phone || '';
                document.getElementById('client-address-input').value = client.address || '';
            }
        },

        async deleteClient(id) {
            const clientIndex = App.state.clients.findIndex(c => c.id === id);
            if (clientIndex === -1) {
                console.error(`No se encontró el cliente con ID: ${id}`);
                return;
            }
            if (clientIndex > -1 && confirm('¿Está seguro de que desea eliminar este cliente?')) {
                const clientName = App.state.clients[clientIndex].name;

                // Primero, verificar si el cliente tiene proyectos asociados
                const { data: projects, error: projectsError } = await window.supabase
                    .from('projects')
                    .select('id')
                    .eq('clientId', id);

                if (projectsError) {
                    showNotification(`Error al verificar proyectos asociados: ${projectsError.message}`);
                    App.Logger.log(`Error al verificar proyectos para el cliente '${clientName}': ${projectsError.message}`);
                    return; // Detener la ejecución si hay un error
                }

                if (projects && projects.length > 0) {
                    showNotification('No se puede eliminar este cliente porque tiene proyectos asociados. Por favor, elimine o reasigne los proyectos primero.');
                    App.Logger.log(`Intento fallido de eliminar cliente '${clientName}' con proyectos asociados.`);
                    return; // Detener la eliminación
                }

                // Si no hay proyectos, proceder con la eliminación
                const { error } = await window.supabase
                    .from('clients')
                    .delete()
                    .eq('id', id);

                if (error) {
                    showNotification(`Error al eliminar el cliente: ${error.message}`);
                    App.Logger.log(`Error al eliminar cliente '${clientName}': ${error.message}`);
                } else {
                    // Eliminar del estado local y re-renderizar
                    App.state.clients.splice(clientIndex, 1);
                    this.renderClientsTable();
                    App.Logger.log(`Cliente '${clientName}' (ID: ${id}) eliminado.`);
                }
            }
        },

        async generateToken(clientId) {
            const expiration = Date.now() + (24 * 60 * 60 * 1000); // 24 horas
            
            // Este token es solo para la URL, no se guarda directamente.
            // Usaremos un identificador único para la base de datos.
            const uniqueTokenValue = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
            const url = `${window.location.origin}${window.location.pathname}#client/${uniqueTokenValue}`;

            // Crear el registro para la base de datos
            const tokenRecord = {
                client_id: Number(clientId),
                token_value: uniqueTokenValue,
                expires_at: new Date(expiration).toISOString()
            };

            // Insertar el token en la tabla access_tokens
            const { error } = await window.supabase
                .from('access_tokens')
                .insert([tokenRecord]);

            if (error) {
                console.error('Error al guardar el token de acceso:', error);
                showNotification(`Error al generar el enlace: ${error.message}`, 'error');
                return;
            }
            
            App.Logger.log(`Token generado y guardado para el cliente ID: ${clientId}.`);
            prompt('Copia este enlace para compartir con el cliente (válido por 24h):', url);
        },

        // --- Gestión de Proyectos (CRUD) ---
        renderProjectsTable() {
        const tbody = document.getElementById('projects-table-body');
        const clients = App.state.clients;
        const payments = App.state.payments;

        const getClientName = (clientId) => {
            const client = clients.find(c => c.id === clientId);
            return client ? client.name : 'Cliente no encontrado';
        };

        // CORRECCIÓN: Calcular el saldo pendiente manualmente si no viene de la RPC.
        tbody.innerHTML = App.state.projects.map(project => {
            const projectPayments = payments.filter(p => p.projectId === project.id && p.status === 'Completado');
            const totalPaid = projectPayments.reduce((sum, p) => sum + p.amount, 0);
            const pendingBalance = project.totalValue - totalPaid;

            return `
                <tr id="project-row-${project.id}">
                    <td class="px-6 py-4 whitespace-nowrap">${project.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${getClientName(project.clientId)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">$${project.totalValue.toFixed(2)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">$${pendingBalance.toFixed(2)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${project.status}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button data-action="edit-project" data-id="${project.id}" class="text-blue-600 hover:text-blue-900 mr-3">Editar</button>
                        <button data-action="delete-project" data-id="${project.id}" class="text-red-600 hover:text-red-900">Eliminar</button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    toggleProjectForm(reset = true) {
        const form = document.getElementById('project-form');
        form.classList.toggle('hidden');
        if (reset) {
            form.reset();
            document.getElementById('project-id').value = '';
        }

        // Ocultar/mostrar botón "Añadir Proyecto" mientras el formulario esté visible
        const addBtn = document.getElementById('add-project-btn');
        if (addBtn) {
            if (!form.classList.contains('hidden')) {
                addBtn.classList.add('hidden');
            } else {
                addBtn.classList.remove('hidden');
            }
        }

        // Rellenar el selector de clientes
        const clientSelect = document.getElementById('project-client-select');
        clientSelect.innerHTML = App.state.clients.map(client => `
            <option value="${client.id}">${client.name}</option>
        `).join('');
    },

    async saveProject(event) {
        event.preventDefault();
        const id = document.getElementById('project-id').value;
        const name = document.getElementById('project-name-input').value;
        const clientId = document.getElementById('project-client-select').value;
        const totalValue = parseFloat(document.getElementById('project-value-input').value);
        const status = document.getElementById('project-status-select').value;

        let error;
        let successMessage = '';

        // Obtener la sesión actual para asegurar que el token se envía
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) {
            showNotification('Error: No hay sesión activa. Por favor, inicie sesión de nuevo.', 'error');
            App.Auth.logout();
            return;
        }

        if (id) { // Editar proyecto existente
            const { error: updateError } = await window.supabase
                .from('projects')
                .update({ name, clientId, totalValue, status })
                .eq('id', id);
            error = updateError;
            if (!error) successMessage = `Proyecto '${name}' (ID: ${id}) actualizado.`;
        } else { // Crear nuevo proyecto
            const { error: insertError } = await window.supabase
                .from('projects')
                .insert([{ name, clientId, totalValue, status }]);
            error = insertError;
            if (!error) successMessage = `Nuevo proyecto '${name}' creado.`;
        }

        if (error) {
            showNotification(`Error al guardar el proyecto: ${error.message}`);
            App.Logger.log(`Error al guardar proyecto: ${error.message}`);
        } else {
            App.Logger.log(successMessage);
            const { data, error: fetchError } = await window.supabase.from('projects').select('*');
            if (fetchError) {
                console.error('Error fetching projects after save:', fetchError);
            } else {
                App.state.projects = data;
                this.renderProjectsTable();
                this.toggleProjectForm(); // Oculta el formulario después de guardar
            }
        }
    },

    editProject(id) {
        id = Number(id);
        const project = App.state.projects.find(p => p.id === id);
        if (!project) {
            console.error(`No se encontró el proyecto con ID: ${id}`);
            return;
        }
        if (project) {
            const form = document.getElementById('project-form');
            if (form.classList.contains('hidden')) {
                this.toggleProjectForm(false);
            }

            document.getElementById('project-id').value = project.id;
            document.getElementById('project-name-input').value = project.name;
            document.getElementById('project-client-select').value = project.clientId;
            document.getElementById('project-value-input').value = project.totalValue;
            document.getElementById('project-status-select').value = project.status;
        }
    },

     async deleteProject(id) {
        id = Number(id);
        const projectIndex = App.state.projects.findIndex(p => p.id === id);
        if (projectIndex === -1) {
            console.error(`No se encontró el proyecto con ID: ${id}`);
            return;
        }
        if (projectIndex > -1 && confirm('¿Está seguro de que desea eliminar este proyecto?')) {
            const projectName = App.state.projects[projectIndex].name;

            // Obtener la sesión actual para asegurar que el token se envía
            const { data: { session } } = await window.supabase.auth.getSession();
            if (!session) {
                showNotification('Error: No hay sesión activa. Por favor, inicie sesión de nuevo.', 'error');
                App.Auth.logout();
                return;
            }

            const { error } = await window.supabase
                .from('projects')
                .delete()
                .eq('id', id);

            if (error) {
                showNotification(`Error al eliminar el proyecto: ${error.message}`);
                App.Logger.log(`Error al eliminar proyecto '${projectName}': ${error.message}`);
            } else {
                App.state.projects.splice(projectIndex, 1);
                this.renderProjectsTable();
                App.Logger.log(`Proyecto '${projectName}' (ID: ${id}) eliminado.`);
            }
        }
        },
        renderPaymentsTable() {
    const tbody = document.getElementById('payments-table-body');
    const projects = App.state.projects;

    const getProjectName = (projectId) => {
        const project = projects.find(p => p.id === projectId);
        return project ? project.name : 'N/A';
    };

    tbody.innerHTML = App.state.payments.map(payment => `
        <tr id="payment-row-${payment.id}">
            <td class="px-6 py-4 whitespace-nowrap">${getProjectName(payment.projectId)}</td>
            <td class="px-6 py-4 whitespace-nowrap">$${payment.amount.toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${new Date(payment.payment_date).toLocaleDateString()}</td> <!-- Cambiado 'date' a 'payment_date' -->
            <td class="px-6 py-4 whitespace-nowrap">${payment.status}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button data-action="edit-payment" data-id="${payment.id}" class="text-blue-600 hover:text-blue-900 mr-3">Editar</button>
                <button data-action="delete-payment" data-id="${payment.id}" class="text-red-600 hover:text-red-900">Eliminar</button>
            </td>
        </tr>
    `).join('');
},

    togglePaymentForm(reset = true) {
        const form = document.getElementById('payment-form');
        form.classList.toggle('hidden');
        if (reset) {
            form.reset();
            document.getElementById('payment-id').value = '';
        }

        // Ocultar/mostrar botón "Añadir Pago" mientras el formulario esté visible
        const addBtn = document.getElementById('add-payment-btn');
        if (addBtn) {
            if (!form.classList.contains('hidden')) {
                addBtn.classList.add('hidden');
            } else {
                addBtn.classList.remove('hidden');
            }
        }

        // Rellenar el selector de proyectos
        const projectSelect = document.getElementById('payment-project-select');
        projectSelect.innerHTML = App.state.projects.map(project => `
            <option value="${project.id}">${project.name}</option>
        `).join('');
    },

    async savePayment(event) {
            event.preventDefault();
            const id = document.getElementById('payment-id').value;
            const projectId = parseInt(document.getElementById('payment-project-select').value, 10); // Convertir a número
            const amount = parseFloat(document.getElementById('payment-amount-input').value);
            const payment_date = document.getElementById('payment-date-input').value;
            const status = document.getElementById('payment-status-select').value;

            // Obtener la sesión actual para asegurar que el token se envía
            const { data: { session } } = await window.supabase.auth.getSession();
            if (!session) {
                showNotification('Error: No hay sesión activa. Por favor, inicie sesión de nuevo.', 'error');
                App.Auth.logout();
                return;
            }

            // Validar la fecha del pago
            const today = new Date();
            const paymentDate = new Date(payment_date);

            if (paymentDate > today) {
                showNotification('La fecha del pago no puede ser una fecha futura.', 'error');
                return;
            }

            const fiftyYearsAgo = new Date();
            fiftyYearsAgo.setFullYear(today.getFullYear() - 50);
            if (paymentDate < fiftyYearsAgo) {
                showNotification('La fecha del pago no puede ser anterior a 50 años.', 'warning');
                return;
            }

            // Validar el monto del pago
            const project = App.state.projects.find(p => p.id === projectId);
            if (!project) {
                showNotification('El proyecto seleccionado no existe.', 'error');
                return;
            }

            if (amount <= 0) {
                showNotification('El monto del pago debe ser mayor a 0.', 'error');
                return;
            }

            if (amount > project.totalValue) {
                showNotification(`El monto del pago no puede ser mayor al costo total del proyecto ($${project.totalValue.toFixed(2)}).`, 'error');
                return;
            }

            let error;
            let successMessage = '';

            if (id) { // Editar pago existente
                const { error: updateError } = await window.supabase
                    .from('payments')
                    .update({ projectId, amount, payment_date, status })
                    .eq('id', id);
                error = updateError;
                if (!error) successMessage = `Pago (ID: ${id}) actualizado.`;
            } else { // Crear nuevo pago
                const { error: insertError } = await window.supabase
                    .from('payments')
                    .insert([{ projectId, amount, payment_date, status }]);
                error = insertError;
                if (!error) successMessage = `Nuevo pago creado.`;
            }

            if (error) {
                showNotification(`Error al guardar el pago: ${error.message}`, 'error');
                App.Logger.log(`Error al guardar pago: ${error.message}`);
            } else {
                App.Logger.log(successMessage);
                const { data, error: fetchError } = await window.supabase.from('payments').select('*');
                if (fetchError) {
                    console.error('Error fetching payments after save:', fetchError);
                } else {
                    App.state.payments = data;
                    // ACTUALIZACIÓN: Re-renderizar ambas tablas para reflejar cambios en saldos.
                    this.renderPaymentsTable();
                    this.renderProjectsTable(); 
                    this.togglePaymentForm(); // Oculta el formulario después de guardar
                    showNotification(successMessage, 'success');
                }
            }
        },

    editPayment(id) {
        console.log(`Editando pago con ID: ${id}`);
        const payment = App.state.payments.find(p => p.id === Number(id));
        console.log(payment);
        if (payment) {
            console.error(`No se encontró el pago con ID: ${id}`);
            const form = document.getElementById('payment-form');
            if (form.classList.contains('hidden')) {
                this.togglePaymentForm(false); // Mostrar el formulario sin reiniciarlo
            }

            // Rellenar los campos del formulario con los datos del pago
            document.getElementById('payment-id').value = payment.id;
            document.getElementById('payment-project-select').value = payment.projectId;
            document.getElementById('payment-amount-input').value = payment.amount;
            document.getElementById('payment-date-input').value = payment.payment_date.split('T')[0];
            document.getElementById('payment-status-select').value = payment.status;
        } else {
            console.error(`No se encontró el pago con ID: ${id}`);
        }
},


    async deletePayment(id) {
        console.log(`Eliminando pago con ID: ${id}`);
    const paymentIndex = App.state.payments.findIndex(p => p.id === Number(id));
    if (paymentIndex > -1 && confirm('¿Está seguro de que desea eliminar este pago?')) {
        // Obtener la sesión actual para asegurar que el token se envía
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) {
            showNotification('Error: No hay sesión activa. Por favor, inicie sesión de nuevo.', 'error');
            App.Auth.logout();
            return;
        }

        const { error } = await window.supabase
            .from('payments')
            .delete()
            .eq('id', id);

        if (error) {
            showNotification(`Error al eliminar el pago: ${error.message}`);
            App.Logger.log(`Error al eliminar pago (ID: ${id}): ${error.message}`);
        } else {
            // Eliminar el pago del estado local y volver a renderizar la tabla
            App.state.payments.splice(paymentIndex, 1);
            this.renderPaymentsTable();
            App.Logger.log(`Pago (ID: ${id}) eliminado.`);
        }
    }
    },

        // --- Logs ---
        renderLogs() {
            const list = document.getElementById('logs-list');
            list.innerHTML = App.state.logs.map(log => {
                // CORRECCIÓN: Usar el email guardado en el log.
                // Si no existe, usar el email del usuario actual si coincide el ID.
                // Como último recurso, mostrar el user_id o 'sistema'.
                const userLabel = log.user_email || 
                                  (log.user_id && App.state.currentUser && log.user_id === App.state.currentUser.id ? App.state.currentUser.email : log.user_id) || 
                                  'sistema';

                return `<li><span class="text-gray-500">${log.timestamp}:</span> <strong class="ml-2">${log.action}</strong> - ${log.description} <span class="text-xs text-gray-400 ml-2">(${userLabel})</span></li>`;
            }).join('');
        }
    },

    // Módulo de la vista del cliente
    Client: {
        async init(token) {
            document.getElementById('app-navbar').classList.add('hidden'); // Ocultar navbar en vista cliente
            document.getElementById('client-loading-screen').classList.remove('hidden');
            document.getElementById('client-dashboard').classList.add('hidden');
            document.getElementById('client-error-screen').classList.add('hidden');

            try {
                // 1. Llamar a la función de Supabase para obtener todos los datos del cliente.
                const { data, error } = await window.supabase.functions.invoke('get-client-data', {
                    body: { token: token },
                });

                if (error) {
                    // El error puede ser por token inválido, expirado, etc. La función lo maneja.
                    throw new Error(error.message);
                }

                this.renderDashboard(data);

            } catch (error) {
                this.showError(error.message);
            }
        },

        renderDashboard(data) {
            // Función para truncar texto si es muy largo
            const truncateText = (text, maxLength = 30, displayLength = 20) => {
                if (typeof text !== 'string' || text.length <= maxLength) {
                    return text || 'N/A';
                }
                return `${text.substring(0, displayLength)}...`;
            };

            // Obtener datos financieros del cliente desde el objeto 'data'
            const { client, projects, payments, totals } = data;
            
            // Rellenar tarjeta de información del cliente (NUEVO)
            document.querySelector('#client-card-name span').textContent = truncateText(client.name);
            document.querySelector('#client-card-email span').textContent = truncateText(client.email);
            document.querySelector('#client-card-phone span').textContent = client.phone || 'N/A';
            document.querySelector('#client-card-address span').textContent = truncateText(client.address);

            // Separar proyectos en activos y cerrados
            const activeProjects = projects.filter(p => p.status !== 'Terminado');
            const closedProjects = projects.filter(p => p.status === 'Terminado');

            // --- MODIFICACIÓN: Calcular el total pendiente desde la suma de los proyectos --- 
            const totalPendingFromProjects = projects.reduce((sum, project) => sum + (project.pending_balance || 0), 0);

            // Rellenar tarjetas de resumen con los totales ya calculados por la función
            document.getElementById('report-client-name').textContent = `Reporte para ${client.name}`;
            document.getElementById('report-total-paid').textContent = `$${(totals.total_paid || 0).toFixed(2)}`;
            document.getElementById('report-total-pending').textContent = `$${totalPendingFromProjects.toFixed(2)}`;
            document.getElementById('report-active-projects').textContent = activeProjects.length;

            // Función auxiliar para renderizar filas de proyectos
            const renderProjectRow = (p, isClosed = false) => {
                // CORRECCIÓN: Usar el saldo pendiente que ya viene calculado desde el backend.
                const pendingOnProject = p.pending_balance;

                // Para proyectos cerrados, necesitamos el total pagado, que es el valor total menos el saldo pendiente.
                const paymentsForProject = p.totalValue - pendingOnProject;
                
                const statusBadge = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.status === 'Terminado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${p.status}</span>`;
                
                if (isClosed) {
                    return `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap">${p.name}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${statusBadge}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-right">$${p.totalValue.toFixed(2)}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-700">$${paymentsForProject.toFixed(2)}</td>
                        </tr>
                    `;
                } else {
                     return `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap">${p.name}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${statusBadge}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-right">$${p.totalValue.toFixed(2)}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-right font-medium ${pendingOnProject > 0 ? 'text-red-600' : 'text-gray-700'}">$${pendingOnProject.toFixed(2)}</td>
                        </tr>
                    `;
                }
            };

            // Rellenar tabla de proyectos activos
            const activeProjectsBody = document.getElementById('report-active-projects-body');
            activeProjectsBody.innerHTML = activeProjects.map(p => renderProjectRow(p, false)).join('');

            // Rellenar tabla de proyectos cerrados
            const closedProjectsBody = document.getElementById('report-closed-projects-body');
            closedProjectsBody.innerHTML = closedProjects.map(p => renderProjectRow(p, true)).join('');


            // Rellenar tabla de pagos (ordenados por fecha descendente)
            const paymentsBody = document.getElementById('report-payments-body');
            paymentsBody.innerHTML = [...payments] // Clonar para no mutar el estado original
                .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
                .map(p => {
                    const project = projects.find(proj => proj.id === p.projectId);
                    return `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap">${new Date(p.payment_date).toLocaleDateString()}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-right">$${p.amount.toFixed(2)}</td>
                            <td class="px-6 py-4 whitespace-nowrap">${project ? project.name : 'N/A'}</td>
                            <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.status === 'Completado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${p.status}</span></td>
                        </tr>
                    `;
            }).join('');

            // Rellenar total final
            document.getElementById('report-final-pending').textContent = `$${totalPendingFromProjects.toFixed(2)}`;

            // Ocultar carga y mostrar dashboard
            document.getElementById('client-loading-screen').classList.add('hidden');
            document.getElementById('client-dashboard').classList.remove('hidden');
        },

        showError(message) {
            document.getElementById('client-loading-screen').classList.add('hidden');
            const errorScreen = document.getElementById('client-error-screen');
            const errorMessage = document.getElementById('client-error-message');
            
            // MODIFICACIÓN: Mostrar el error real para depuración
            // Esto nos dirá si es un error de CORS (como 'Failed to fetch') u otro problema.
            let displayMessage = `El enlace de reporte es inválido o no se pudo conectar. Por favor, verifique el enlace o solicite uno nuevo. (Detalle: ${message})`;

            if (message.includes('expirado')) {
                displayMessage = 'El enlace de reporte ha expirado. Por favor, solicite un nuevo enlace temporal.';
            } else if (message.includes('inválido')) {
                displayMessage = 'El enlace de reporte es inválido. Por favor, verifique el enlace o solicite uno nuevo.';
            }
            
            errorMessage.textContent = displayMessage;
            errorScreen.classList.remove('hidden');
        }
    },

    // Módulo de enrutamiento simple
    Router: {
        async handleRouteChange() {
            const hash = window.location.hash;
            const user = await App.Auth.checkSession();

            // Ocultar todas las páginas y mostrar loader principal
            document.querySelectorAll('.page-section').forEach(p => p.style.display = 'none');
            const mainLoader = document.getElementById('main-loader');
            if (mainLoader) mainLoader.classList.remove('hidden');

            document.getElementById('app-navbar').classList.remove('hidden');
            document.getElementById('client-error-screen').classList.add('hidden');
            document.getElementById('client-dashboard').classList.add('hidden');
            document.getElementById('client-loading-screen').classList.remove('hidden');


            if (hash.startsWith('#client/')) {
                if(mainLoader) mainLoader.classList.add('hidden'); // Ocultar loader principal en vista cliente
                const token = hash.split('/')[1];
                document.getElementById('client-page').style.display = 'block';
                App.Client.init(token);
            } else if (hash === '#/admin' && user) {
                // Si hay un usuario y la ruta es /admin, cargamos los datos si aún no existen
                if (App.state.clients.length === 0) {
                    await App.loadAdminData();
                }
                document.getElementById('admin-page').style.display = 'block';
                App.Admin.init();
            } else {
                if (mainLoader) mainLoader.classList.add('hidden');
                // Por defecto, ir al login si no hay sesión, o al admin si la hay
                if (user) {
                    // Si hay usuario pero no estamos en #/admin (p.ej. en la raíz), redirigir.
                    window.location.hash = '#/admin';
                } else {
                    // CORRECCIÓN: No redirigir si estamos en una ruta de cliente.
                    // Esto evita que la petición a la función sea cancelada.
                    if (!hash.startsWith('#client/')) {
                        window.location.hash = '#/login'; // Redirigir explícitamente
                        App.Auth.toggleAuthView(true); 
                        document.getElementById('logout-btn').classList.add('hidden');
                    }
                }
            }
        }
    },

    // Módulo de logging
    Logger: {
        async log(actionOrDescription, maybeDescription) {
            // Compatibilidad: App.Logger.log("mensaje") o App.Logger.log("ACTION", "desc")
            let actionType = 'info';
            let description = '';

            if (typeof actionOrDescription === 'string' && !maybeDescription) {
                description = actionOrDescription;

                // Inferir actionType a partir del texto (palabras clave en español)
                const d = description.toLowerCase();

                const rules = [
                    { r: /\b(eliminad[oa]|eliminar|eliminación|borrar|borrad[oa])\b/, a: 'delete' },
                    { r: /\b(cread[oa]|crear|nuevo|agregado|añadid[oa]|agregar)\b/, a: 'create' },
                    { r: /\b(actualizad[oa]|actualizar|modificad[oa]|modificar|editad[oa]|editar)\b/, a: 'update' },
                    { r: /\b(inicio de sesión|inicio sesión|sesión iniciad[oa]|login exitoso|logged in)\b/, a: 'login_success' },
                    { r: /\b(intento de inicio|login fallid|credencial|credenciales inválidas|fall[oó]n de inicio)\b/, a: 'login_failed' },
                    { r: /\b(cierre de sesión|logout)\b/, a: 'logout' },
                    { r: /\b(token generado|enlace de reporte|token|link de reporte)\b/, a: 'token_generated' },
                    { r: /\b(acceso al reporte|acceso reporte|reporte del cliente|accedi[oó]n al reporte)\b/, a: 'report_access' },
                    { r: /\b(pago|pagos|nuevo pago|eliminar pago|actualizar pago|pago creado|pago eliminado)\b/, a: 'payment' },
                    { r: /\b(proyecto|proyectos|nuevo proyecto|proyecto creado|proyecto eliminado)\b/, a: 'project' },
                    { r: /\b(cliente|clientes|cliente creado|cliente eliminado)\b/, a: 'client' },
                    { r: /\b(error|errores|excepci[oó]n|fail|failed)\b/, a: 'error' }
                ];

                for (const rule of rules) {
                    if (rule.r.test(d)) {
                        actionType = rule.a;
                        break;
                    }
                }

            } else if (typeof actionOrDescription === 'string' && typeof maybeDescription === 'string') {
                // Se proporciona action explícito
                actionType = actionOrDescription;
                description = maybeDescription;
            } else if (typeof actionOrDescription === 'object' && actionOrDescription !== null) {
                actionType = actionOrDescription.action || 'info';
                description = actionOrDescription.description || '';
            }

            const user = App.state.currentUser;
            const user_id = user ? user.id : null;
            // --- NUEVO: Obtener el email del usuario para guardarlo en el log ---
            const user_email = user ? user.email : null;

            // Añadir localmente para UI inmediata
            const localEntry = {
                id: null,
                timestamp: new Date().toLocaleString(),
                action: actionType,
                description,
                user_id,
                user_email // --- NUEVO: Añadir email al objeto local ---
            };
            App.state.logs.unshift(localEntry);
            if (App.state.logs.length > 100) App.state.logs.pop();

            // Actualizar vista si está activa
            if (document.getElementById('admin-page') && document.getElementById('admin-page').style.display === 'block') {
                App.Admin.renderLogs();
            }

            // Persistir en Supabase (tabla 'logs' con columnas: user_id, action_type, description)
            try {
                const { data, error } = await window.supabase
                    .from('logs')
                    // --- CORRECCIÓN: Insertar también el user_email ---
                    .insert([{ user_id, user_email, action_type: actionType, description }])
                    .select('log_id, timestamp');

                if (error) {
                    console.error('Error inserting log into Supabase:', error);
                } else if (data && data[0]) {
                    // actualizar la entrada local con id y timestamp devueltos por la DB
                    App.state.logs[0].id = data[0].log_id || App.state.logs[0].id;
                    if (data[0].timestamp) {
                        App.state.logs[0].timestamp = new Date(data[0].timestamp).toLocaleString();
                    }
                    if (document.getElementById('admin-page') && document.getElementById('admin-page').style.display === 'block') {
                        App.Admin.renderLogs();
                    }
                }
            } catch (err) {
                console.error('Unexpected error saving log to Supabase:', err);
            }
        }
    },
};

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type} p-4 rounded-lg shadow-md text-white font-medium transition-opacity duration-300 opacity-0`;
    notification.textContent = message;

    // Estilo según el tipo de notificación
    if (type === 'success') {
        notification.classList.add('bg-green-500');
    } else if (type === 'error') {
        notification.classList.add('bg-red-500');
    } else if (type === 'warning') {
        notification.classList.add('bg-yellow-500');
    } else {
        notification.classList.add('bg-blue-500');
    }

    // Agregar la notificación al contenedor
    container.appendChild(notification);

    // Mostrar la notificación con una animación
    setTimeout(() => {
        notification.classList.remove('opacity-0');
    }, 10);

    // Eliminar la notificación después de 5 segundos
    setTimeout(() => {
        notification.classList.add('opacity-0');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Iniciar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => App.init());

