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
        // Cargar datos desde Supabase en lugar de localStorage/mock
        const { data: clientsData, error: clientsError } = await window.supabase.from('clients').select('*');
        if (clientsError) console.error('Error fetching clients:', clientsError);
        this.state.clients = clientsData || [];

        const { data: projectsData, error: projectsError } = await window.supabase.from('projects').select('*');
        if (projectsError) console.error('Error fetching projects:', projectsError);
        this.state.projects = projectsData || [];

        const { data: paymentsData, error: paymentsError } = await window.supabase.from('payments').select('*');
        if (paymentsError) console.error('Error fetching payments:', paymentsError);
        this.state.payments = paymentsData || [];

        // Los logs pueden seguir en localStorage o moverse a una tabla de Supabase si lo prefieres
        this.state.logs = JSON.parse(localStorage.getItem('logs')) || [];

        this.bindEvents();
        // Enrutamiento inicial basado en la URL
        await this.Router.handleRouteChange();
        window.addEventListener('hashchange', () => this.Router.handleRouteChange());
    },

    bindEvents() {
        document.getElementById('login-form').addEventListener('submit', (e) => this.Auth.handleLogin(e));
        document.getElementById('logout-btn').addEventListener('click', () => this.Auth.logout());
        document.getElementById('print-button').addEventListener('click', () => window.print());

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
            const id = button.dataset.id;

            if (!id) return; // Salir si no hay un ID

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
            const id = button.dataset.id;

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
        },

        async handleLogin(event) {
            event.preventDefault();
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
            } else if (data.user) {
                App.state.currentUser = data.user;
                App.Logger.log(`Inicio de sesión exitoso del administrador: ${data.user.email}.`);
                window.location.hash = '#/admin';
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
            this.renderProjectsView();
            this.renderPaymentsView();
            this.renderLogs();
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
            if (reset) {
                form.reset();
                document.getElementById('client-id').value = '';
            }
        },
    
        async saveClient(event) {
            event.preventDefault();
            const id = document.getElementById('client-id').value;
            const name = document.getElementById('client-name-input').value;
            const email = document.getElementById('client-email-input').value;
            let error;
            let successMessage = '';

            if (id) { // Editar cliente existente
                const { error: updateError } = await window.supabase
                    .from('clients')
                    .update({ name, email })
                    .eq('id', id);
                error = updateError;
                if (!error) successMessage = `Cliente '${name}' (ID: ${id}) actualizado.`;

            } else { // Crear nuevo cliente
                const { error: insertError } = await window.supabase
                    .from('clients')
                    .insert([{ name, email }]);
                error = insertError;
                if (!error) successMessage = `Nuevo cliente '${name}' creado.`;
            }

            if (error) {
                alert(`Error al guardar el cliente: ${error.message}`);
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
            const client = App.state.clients.find(c => c.id === id);
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
            }
        },

        async deleteClient(id) {
            const clientIndex = App.state.clients.findIndex(c => c.id === id);
            if (clientIndex > -1 && confirm('¿Está seguro de que desea eliminar este cliente?')) {
                const clientName = App.state.clients[clientIndex].name;

                // Primero, verificar si el cliente tiene proyectos asociados
                const { data: projects, error: projectsError } = await window.supabase
                    .from('projects')
                    .select('id')
                    .eq('clientId', id);

                if (projectsError) {
                    alert(`Error al verificar proyectos asociados: ${projectsError.message}`);
                    App.Logger.log(`Error al verificar proyectos para el cliente '${clientName}': ${projectsError.message}`);
                    return; // Detener la ejecución si hay un error
                }

                if (projects && projects.length > 0) {
                    alert('No se puede eliminar este cliente porque tiene proyectos asociados. Por favor, elimine o reasigne los proyectos primero.');
                    App.Logger.log(`Intento fallido de eliminar cliente '${clientName}' con proyectos asociados.`);
                    return; // Detener la eliminación
                }

                // Si no hay proyectos, proceder con la eliminación
                const { error } = await window.supabase
                    .from('clients')
                    .delete()
                    .eq('id', id);

                if (error) {
                    alert(`Error al eliminar el cliente: ${error.message}`);
                    App.Logger.log(`Error al eliminar cliente '${clientName}': ${error.message}`);
                } else {
                    // Eliminar del estado local y re-renderizar
                    App.state.clients.splice(clientIndex, 1);
                    this.renderClientsTable();
                    App.Logger.log(`Cliente '${clientName}' (ID: ${id}) eliminado.`);
                }
            }
        },

        generateToken(clientId) {
            const expiration = Date.now() + 24 * 60 * 60 * 1000; // 24 horas
            const tokenPayload = { clientId, exp: expiration };
            const token = btoa(JSON.stringify(tokenPayload)); // Simulación de JWT (codificación Base64)
            const url = `${window.location.origin}${window.location.pathname}#/report/${token}`;
            
            App.Logger.log(`Token generado para cliente con ID: ${clientId}.`);
            prompt("Enlace de reporte temporal (válido por 24h):", url);
        },

        // --- Gestión de Proyectos (CRUD) ---
        renderProjectsTable() {
        const tbody = document.getElementById('projects-table-body');
        const clients = App.state.clients;

        const getClientName = (clientId) => {
            const client = clients.find(c => c.id === clientId);
            return client ? client.name : 'N/A';
        };

        tbody.innerHTML = App.state.projects.map(project => `
            <tr id="project-row-${project.id}">
                <td class="px-6 py-4 whitespace-nowrap">${project.name}</td>
                <td class="px-6 py-4 whitespace-nowrap">${getClientName(project.clientId)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right">$${project.totalValue.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${project.status}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button data-action="edit-project" data-id="${project.id}" class="text-blue-600 hover:text-blue-900 mr-3">Editar</button>
                    <button data-action="delete-project" data-id="${project.id}" class="text-red-600 hover:text-red-900">Eliminar</button>
                </td>
            </tr>
        `).join('');
    },

    toggleProjectForm(reset = true) {
        const form = document.getElementById('project-form');
        form.classList.toggle('hidden');
        if (reset) {
            form.reset();
            document.getElementById('project-id').value = '';
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
            alert(`Error al guardar el proyecto: ${error.message}`);
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
        const project = App.state.projects.find(p => p.id === id);
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
        const projectIndex = App.state.projects.findIndex(p => p.id === id);
        if (projectIndex > -1 && confirm('¿Está seguro de que desea eliminar este proyecto?')) {
            const projectName = App.state.projects[projectIndex].name;

            const { error } = await window.supabase
                .from('projects')
                .delete()
                .eq('id', id);

            if (error) {
                alert(`Error al eliminar el proyecto: ${error.message}`);
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

        // Rellenar el selector de proyectos
        const projectSelect = document.getElementById('payment-project-select');
        projectSelect.innerHTML = App.state.projects.map(project => `
            <option value="${project.id}">${project.name}</option>
        `).join('');
    },

    async savePayment(event) {
        event.preventDefault();
        const id = document.getElementById('payment-id').value;
        const projectId = document.getElementById('payment-project-select').value;
        const amount = parseFloat(document.getElementById('payment-amount-input').value);
        const payment_date = document.getElementById('payment-date-input').value; // Cambiado de 'date' a 'payment_date'
        const status = document.getElementById('payment-status-select').value;

        let error;
        let successMessage = '';

        if (id) { // Editar pago existente
            const { error: updateError } = await window.supabase
                .from('payments')
                .update({ projectId, amount, payment_date, status }) // Cambiado 'date' a 'payment_date'
                .eq('id', id);
            error = updateError;
            if (!error) successMessage = `Pago (ID: ${id}) actualizado.`;
        } else { // Crear nuevo pago
            const { error: insertError } = await window.supabase
                .from('payments')
                .insert([{ projectId, amount, payment_date, status }]); // Cambiado 'date' a 'payment_date'
            error = insertError;
            if (!error) successMessage = `Nuevo pago creado.`;
        }

        if (error) {
            alert(`Error al guardar el pago: ${error.message}`);
            App.Logger.log(`Error al guardar pago: ${error.message}`);
        } else {
            App.Logger.log(successMessage);
            const { data, error: fetchError } = await window.supabase.from('payments').select('*');
            if (fetchError) {
                console.error('Error fetching payments after save:', fetchError);
            } else {
                App.state.payments = data;
                this.renderPaymentsTable();
                this.togglePaymentForm(); // Oculta el formulario después de guardar
            }
        }
    },

    editPayment(id) {
        const payment = App.state.payments.find(p => p.id === id);
        if (payment) {
            const form = document.getElementById('payment-form');
            if (form.classList.contains('hidden')) {
                this.togglePaymentForm(false);
            }

            document.getElementById('payment-id').value = payment.id;
            document.getElementById('payment-project-select').value = payment.projectId;
            document.getElementById('payment-amount-input').value = payment.amount;
            document.getElementById('payment-date-input').value = payment.payment_date.split('T')[0]; // Cambiado 'date' a 'payment_date'
            document.getElementById('payment-status-select').value = payment.status;
        }
    },


    async deletePayment(id) {
        const paymentIndex = App.state.payments.findIndex(p => p.id === id);
        if (paymentIndex > -1 && confirm('¿Está seguro de que desea eliminar este pago?')) {
            const { error } = await window.supabase
                .from('payments')
                .delete()
                .eq('id', id);

            if (error) {
                alert(`Error al eliminar el pago: ${error.message}`);
                App.Logger.log(`Error al eliminar pago (ID: ${id}): ${error.message}`);
            } else {
                App.state.payments.splice(paymentIndex, 1);
                this.renderPaymentsTable();
                App.Logger.log(`Pago (ID: ${id}) eliminado.`);
            }
        }
    },

        // --- Logs ---
        renderLogs() {
            const list = document.getElementById('logs-list');
            list.innerHTML = App.state.logs.map(log => `<li><span class="text-gray-500">${log.timestamp}:</span> ${log.message}</li>`).join('');
        }
    },

    // Módulo de la vista del cliente
    Client: {
        async init(token) {
            document.getElementById('app-navbar').classList.add('hidden'); // Ocultar navbar en vista cliente
            try {
                const payload = JSON.parse(atob(token));
                if (payload.exp < Date.now()) {
                    throw new Error('Token expirado.');
                }

                const client = App.state.clients.find(c => c.id === payload.clientId);
                if (!client) {
                    throw new Error('Cliente no encontrado.');
                }
                
                App.Logger.log(`Acceso al reporte del cliente '${client.name}' (ID: ${client.id}).`);
                this.renderDashboard(client);

            } catch (error) {
                this.showError(error.message);
                App.Logger.log(`Intento de acceso fallido al reporte. Razón: ${error.message}`);
            }
        },

        renderDashboard(client) {
            // Obtener datos financieros del cliente
            const clientProjects = App.state.projects.filter(p => p.clientId === client.id);
            const clientPayments = App.state.payments.filter(p => clientProjects.some(cp => cp.id === p.projectId));

            let totalPaid = clientPayments.reduce((sum, p) => p.status === 'Completado' ? sum + p.amount : sum, 0);
            let totalBilled = clientProjects.reduce((sum, p) => sum + p.totalValue, 0);
            const totalPending = totalBilled - totalPaid;
            const activeProjects = clientProjects.filter(p => p.status === 'En Progreso').length;

            // Rellenar tarjetas de resumen
            document.getElementById('report-client-name').textContent = `Reporte para ${client.name}`;
            document.getElementById('report-total-paid').textContent = `$${totalPaid.toFixed(2)}`;
            document.getElementById('report-total-pending').textContent = `$${totalPending.toFixed(2)}`;
            document.getElementById('report-active-projects').textContent = activeProjects;

            // Rellenar tabla de proyectos
            const projectsBody = document.getElementById('report-projects-body');
            projectsBody.innerHTML = clientProjects.map(p => {
                const paymentsForProject = clientPayments.filter(pay => pay.projectId === p.id && pay.status === 'Completado').reduce((sum, pay) => sum + pay.amount, 0);
                const pendingOnProject = p.totalValue - paymentsForProject;
                return `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">${p.name}</td>
                        <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.status === 'Completado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${p.status}</span></td>
                        <td class="px-6 py-4 whitespace-nowrap text-right">$${p.totalValue.toFixed(2)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-right font-medium ${pendingOnProject > 0 ? 'text-red-600' : 'text-gray-700'}">$${pendingOnProject.toFixed(2)}</td>
                    </tr>
                `;
            }).join('');

            // Rellenar tabla de pagos
            const paymentsBody = document.getElementById('report-payments-body');
            paymentsBody.innerHTML = clientPayments.map(p => {
                 const project = clientProjects.find(proj => proj.id === p.projectId);
                 return `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">${new Date(p.date).toLocaleDateString()}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-right">$${p.amount.toFixed(2)}</td>
                        <td class="px-6 py-4 whitespace-nowrap">${project ? project.name : 'N/A'}</td>
                        <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.status === 'Completado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${p.status}</span></td>
                    </tr>
                 `;
            }).join('');

            // Ocultar carga y mostrar dashboard
            document.getElementById('client-loading-screen').classList.add('hidden');
            document.getElementById('client-dashboard').classList.remove('hidden');
        },

        showError(message) {
            document.getElementById('client-loading-screen').classList.add('hidden');
            const errorScreen = document.getElementById('client-error-screen');
            const errorMessage = document.getElementById('client-error-message');
            if (message.includes('expirado')) {
                errorMessage.textContent = 'El enlace de reporte ha expirado (límite de 24 horas). Por favor, solicite un nuevo enlace temporal.';
            } else {
                errorMessage.textContent = 'El enlace de reporte es inválido o el cliente no existe. Por favor, verifique el enlace o solicite uno nuevo.';
            }
            errorScreen.classList.remove('hidden');
        }
    },

    // Módulo de enrutamiento simple
    Router: {
        async handleRouteChange() {
            const hash = window.location.hash;
            const user = await App.Auth.checkSession();

            // Ocultar todas las páginas
            document.querySelectorAll('.page-section').forEach(p => p.style.display = 'none');
            document.getElementById('app-navbar').classList.remove('hidden');
            document.getElementById('client-error-screen').classList.add('hidden');
            document.getElementById('client-dashboard').classList.add('hidden');
            document.getElementById('client-loading-screen').classList.remove('hidden');


            if (hash.startsWith('#/report/')) {
                const token = hash.split('/')[2];
                document.getElementById('client-page').style.display = 'block';
                App.Client.init(token);
            } else if (hash === '#/admin' && user) { // <-- CAMBIO AQUÍ: Se eliminó la comprobación de user.role
                document.getElementById('admin-page').style.display = 'block';
                App.Admin.init();
            } else {
                // Por defecto, ir al login si no hay sesión, o al admin si la hay
                if (user) {
                    window.location.hash = '#/admin';
                } else {
                    App.Auth.toggleAuthView(true); 
                    document.getElementById('logout-btn').classList.add('hidden');
                }
            }
        }
    },

    // Módulo de logging
    Logger: {
        log(message) {
            const logEntry = {
                timestamp: new Date().toLocaleString(),
                message: message
            };
            App.state.logs.unshift(logEntry); // Añadir al principio
            if (App.state.logs.length > 100) { // Limitar a 100 entradas
                App.state.logs.pop();
            }
            localStorage.setItem('logs', JSON.stringify(App.state.logs));
            
            // Si la vista de admin está activa, actualizar los logs en tiempo real
            if (document.getElementById('admin-page').style.display === 'block') {
                App.Admin.renderLogs();
            }
        }
    },
};

// Iniciar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => App.init());