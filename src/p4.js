    async editarAlumno(codigo) {
        const alumno = this.colegio.alumnos.find(a => a.codigo === codigo);
        if (!alumno) return;

        const { value: formValues } = await Swal.fire({
            title: 'Editar Datos del Alumno',
            html: `
                <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
                    <label><b>Nombres:</b></label>
                    <input id="sw-nombres" class="swal2-input" value="${alumno.nombres}" style="margin:0; width:100%;">
                    
                    <label><b>Apellidos:</b></label>
                    <input id="sw-apellidos" class="swal2-input" value="${alumno.apellidos}" style="margin:0; width:100%;">
                    
                    <label><b>Teléfono:</b></label>
                    <input id="sw-tel" class="swal2-input" value="${alumno.telefono || ''}" style="margin:0; width:100%;">
                    
                    <label><b>Correo:</b></label>
                    <input id="sw-mail" class="swal2-input" value="${alumno.correo || ''}" style="margin:0; width:100%;">
                    
                    <label><b>Estado:</b></label>
                    <select id="sw-estado" class="swal2-input" style="margin:0; width:100%;">
                        <option value="Activo" ${alumno.estado === 'Activo' ? 'selected' : ''}>Activo</option>
                        <option value="Suspendido" ${alumno.estado === 'Suspendido' ? 'selected' : ''}>Suspendido</option>
                    </select>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Actualizar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                return {
                    nombres: document.getElementById('sw-nombres').value.trim(),
                    apellidos: document.getElementById('sw-apellidos').value.trim(),
                    telefono: document.getElementById('sw-tel').value.trim(),
                    correo: document.getElementById('sw-mail').value.trim(),
                    estado: document.getElementById('sw-estado').value
                };
            }
        });

        if (formValues) {
            alumno.nombres = formValues.nombres;
            alumno.apellidos = formValues.apellidos;
            alumno.telefono = formValues.telefono;
            alumno.correo = formValues.correo;
            alumno.estado = formValues.estado;
            if (typeof alumno.actualizarNombreCompleto === 'function') {
                alumno.actualizarNombreCompleto();
            }
            Swal.fire('¡Éxito!', 'Alumno actualizado correctamente', 'success');
            this._renderListado(); 
        }
    }

    // ------------------------------------------------------------
    // MENSUALIDADES (con selección de meses en el recibo)
    // ------------------------------------------------------------
    _renderMensualidades() {
        const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct'];
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        this.mainContent.innerHTML = `
            <h2 class="section-title">💰 Control de Mensualidades (Ciclo ${this.cicloActual})</h2>
            <div class="toolbar">
                <select id="pagGrado">${grados.map(g => `<option>${g}</option>`).join('')}</select>
                <div class="config-price"><label>Cuota Q</label><input type="number" id="inputCuota" value="${this.colegio.config.cuotaMensual}" min="1"><button class="btn btn-primary btn-sm" id="btnActualizarCuota">Actualizar</button></div>
            </div>
            <div class="table-container">
                <table><thead><tr><th>No. Clave</th><th>Alumno</th><th>Ciclo</th>${meses.map(m=>`<th>${m}<br><small>Estado</small></th>`).join('')}<th>Deuda Total</th><th>Acción</th></tr></thead>
                <tbody id="tbodyPagos"></tbody>
            </table>
        `;
        const selectGrado = document.getElementById('pagGrado');
        const self = this;
        const actualizar = () => {
            const grado = selectGrado.value;
            const alumnos = self.colegio.getAlumnosFiltrados(grado, self.cicloActual);
            const cuota = self.colegio.config.cuotaMensual;
            const tbody = document.getElementById('tbodyPagos');
            tbody.innerHTML = alumnos.map(a => {
                let deuda = 0;
                const checks = a.pagos.map((pagado, i) => {
                    if (!pagado) deuda += cuota;
                    return `<td style="text-align:center;"><input type="checkbox" ${pagado?'checked':''} class="chk-pago" data-id="${a.id}" data-mes="${i}"><span class="estado-pago ${pagado?'pagado':'pendiente'}">${pagado?'Pagado':'Pendiente'}</span></td>`;
                }).join('');
                return `<tr data-id="${a.id}"><td style="text-align:center;">${a.clave}</td><td>${a.nombreCompleto}</td><td style="text-align:center;">${a.cicloEscolar}</td>${checks}<td style="text-align:center;"><span class="deuda-badge badge ${deuda===0?'badge-al-dia':'badge-deuda'}">${deuda===0?'Al día':'Q'+deuda}</span></td><td style="text-align:center;"><button class="btn btn-sm btn-primary btn-recibo" data-id="${a.id}">🧾 Recibo</button></td></tr>`;
            }).join('');
            tbody.querySelectorAll('.chk-pago').forEach(chk => {
                chk.addEventListener('change', function() {
                    const id = parseInt(this.dataset.id);
                    const mes = parseInt(this.dataset.mes);
                    const alumno = self.colegio.getAlumnoPorId(id);
                    if (alumno) {
                        alumno.pagos[mes] = this.checked;
                        self.colegio.guardarAlumnos();
                        const fila = this.closest('tr');
                        const cuotaActual = self.colegio.config.cuotaMensual;
                        let nuevaDeuda = 0;
                        for (let i=0; i<alumno.pagos.length; i++) if (!alumno.pagos[i]) nuevaDeuda += cuotaActual;
                        const deudaSpan = fila.querySelector('.deuda-badge');
                        deudaSpan.textContent = nuevaDeuda === 0 ? 'Al día' : 'Q' + nuevaDeuda;
                        deudaSpan.className = `deuda-badge badge ${nuevaDeuda === 0 ? 'badge-al-dia' : 'badge-deuda'}`;
                        const estadoSpan = this.nextElementSibling;
                        if (estadoSpan) { estadoSpan.textContent = this.checked ? 'Pagado' : 'Pendiente'; estadoSpan.className = `estado-pago ${this.checked ? 'pagado' : 'pendiente'}`; }
                    }
                });
            });
            tbody.querySelectorAll('.btn-recibo').forEach(btn => {
                btn.addEventListener('click', () => {
                    const alumno = self.colegio.getAlumnoPorId(parseInt(btn.dataset.id));
                    if (alumno) self._mostrarModalSeleccionMeses(alumno);
                });
            });
        };
        document.getElementById('btnActualizarCuota').addEventListener('click', () => {
            const nueva = parseInt(document.getElementById('inputCuota').value);
            if (nueva > 0) { self.colegio.actualizarCuota(nueva); actualizar(); }
        });
        selectGrado.addEventListener('change', actualizar);
        actualizar();
    }

    _mostrarModalSeleccionMeses(alumno) {
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct'];
        const cuota = this.colegio.config.cuotaMensual;
        let html = `<div style="max-height: 400px; overflow-y: auto;"><p><strong>${alumno.nombreCompleto}</strong></p><p>Seleccione los meses que desea incluir en el recibo:</p>`;
        meses.forEach((mes, idx) => {
            const pagado = alumno.pagos[idx];
            html += `<div style="margin:5px 0;"><label><input type="checkbox" class="mes-checkbox" data-mes="${mes}" data-index="${idx}" ${pagado ? 'checked' : ''}> ${mes} - ${pagado ? 'Pagado' : 'Pendiente'}</label></div>`;
        });
        html += `<p style="margin-top:10px;"><small><em>Nota: Puede seleccionar meses pendientes para generar un recibo de adeudo.</em></small></p></div>`;
        Swal.fire({
            title: 'Seleccionar meses para el recibo',
            html: html,
            showCancelButton: true,
            confirmButtonText: 'Generar recibo',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const selected = [];
                document.querySelectorAll('.mes-checkbox:checked').forEach(cb => {
                    selected.push({
                        mes: cb.dataset.mes,
                        index: parseInt(cb.dataset.index)
                    });
                });
                if (selected.length === 0) {
                    Swal.showValidationMessage('Debe seleccionar al menos un mes');
                    return false;
                }
                return selected;
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                this._generarReciboMeses(alumno, result.value);
            }
        });
    }

    _generarReciboMeses(alumno, mesesSeleccionados) {
        const cuota = this.colegio.config.cuotaMensual;
        const total = mesesSeleccionados.length * cuota;
        const nombresMeses = mesesSeleccionados.map(m => m.mes).join(', ');
        const ventana = window.open('', 'Recibo', 'width=400,height=600');
        ventana.document.write(`
            <html><head><title>Recibo</title>
            <style>body { font-family: monospace; padding: 20px; }.logo-container { text-align: right; margin-bottom: 10px; }img { max-width: 100px; }pre { text-align: left; display: inline-block; }@media print { body { width: 80mm; } }</style></head>
            <body><div class="logo-container"><img src="logo.jpeg" alt="Logo"></div>
            <pre>
==========================================
        COLEGIO MIXTO BELÉN
      RECIBO DE MENSUALIDADES
==========================================
Alumno: ${alumno.nombreCompleto}
Código: ${alumno.codigo}
Grado: ${alumno.grado}   Ciclo: ${alumno.cicloEscolar}
------------------------------------------
Meses incluidos: ${nombresMeses}
Total meses: ${mesesSeleccionados.length}
Monto por mes: Q${cuota}
TOTAL: Q${total}
------------------------------------------
Fecha: ${new Date().toLocaleString()}
==========================================
        ¡Gracias por su pago!
            </pre>
            <script>window.print();<\/script>
            </body></html>
        `);
    }

    _renderAdminExtras() {
        const items = this.colegio.config.extrasItems;
        this.mainContent.innerHTML = `
            <h2 class="section-title">➕💳 Administrar Pagos Adicionales</h2>
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;"><h3>Conceptos de pago extra</h3><button class="btn btn-primary" id="btnMostrarEstadoPagos">👥 Ver estado de pagos</button></div>
                <div style="display:flex; gap:10px; margin-bottom:15px;"><input type="text" id="extraNombre" placeholder="Nombre (ej. Uniforme)"><input type="number" id="extraMonto" placeholder="Monto total Q" min="1" step="0.01"><button class="btn btn-success" id="btnAgregarExtra">➕ Agregar</button></div>
                <table class="table-container"><thead><tr><th>Concepto</th><th>Monto total Q</th><th>Acción</th></tr></thead><tbody id="tbodyExtrasItems">${items.map(it => `<tr><td>${it.nombre}</td><td>Q${it.montoTotal.toFixed(2)}</td><td><button class="btn btn-sm btn-danger btn-eliminar-extra" data-nombre="${it.nombre}">🗑️</button></td></tr>`).join('')}</tbody>
            </table>
            </div>
        `;
        const actualizarListaItems = () => {
            const tbody = document.getElementById('tbodyExtrasItems');
            const items = this.colegio.config.extrasItems;
            tbody.innerHTML = items.map(it => `<tr><td>${it.nombre}</td><td>Q${it.montoTotal.toFixed(2)}</td><td><button class="btn btn-sm btn-danger btn-eliminar-extra" data-nombre="${it.nombre}">🗑️</button></td></tr>`).join('');
            tbody.querySelectorAll('.btn-eliminar-extra').forEach(btn => btn.addEventListener('click', async () => {
                const result = await Swal.fire({ title: '¿Eliminar concepto?', text: 'Se borrará de todos los alumnos.', icon: 'warning', showCancelButton: true });
                if (result.isConfirmed) { this.colegio.eliminarExtraItem(btn.dataset.nombre); actualizarListaItems(); Swal.fire('Eliminado', '', 'success'); }
            }));
        };
        document.getElementById('btnAgregarExtra').addEventListener('click', async () => {
            const nombre = document.getElementById('extraNombre').value.trim();
            const monto = parseFloat(document.getElementById('extraMonto').value);
            if (!nombre || isNaN(monto) || monto <= 0) return Swal.fire('Error', 'Datos inválidos.', 'error');
            if (this.colegio.agregarExtraItem(nombre, monto)) {
                document.getElementById('extraNombre').value = '';
                document.getElementById('extraMonto').value = '';
                actualizarListaItems();
                Swal.fire('Agregado', '', 'success');
            } else Swal.fire('Error', 'El concepto ya existe.', 'error');
        });
        document.getElementById('btnMostrarEstadoPagos').addEventListener('click', () => this._mostrarModalEstadoPagosAdicionales());
        actualizarListaItems();
    }

   _renderPanelControl() {
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        this.mainContent.innerHTML = `<h2 class="section-title">⚙️ Panel de Control</h2><div class="search-box"><select id="panelGrado">${grados.map(g=>`<option>${g}</option>`).join('')}</select><input type="text" id="panelBusqueda" placeholder="Buscar..."><button class="btn btn-warning" id="btnSuspender">Alternar Suspensión</button><button class="btn btn-danger" id="btnEliminar">Eliminar</button></div><div class="table-container"><table><thead><tr><th>Clave</th><th>Alumno</th><th>Grado</th><th>Ciclo</th><th>Estado</th></tr></thead><tbody id="tbodyPanel"></tbody></table></div>`;
        const selectGrado=document.getElementById('panelGrado'), inputBusqueda=document.getElementById('panelBusqueda');
        const actualizar=()=>{ let datos=this.colegio.getAlumnosFiltrados(selectGrado.value, this.cicloActual); const texto=inputBusqueda.value.toLowerCase(); if(texto) datos=datos.filter(a=>a.nombres.toLowerCase().includes(texto)||a.apellidos.toLowerCase().includes(texto)||String(a.clave).includes(texto)); const tbody=document.getElementById('tbodyPanel'); tbody.innerHTML=datos.map(a=>`<tr class="${a.estado==='Suspendido'?'suspendido':''}" data-id="${a.id}"><td style="text-align:center;">${a.clave}</td><td>${a.nombreCompleto}</td><td>${a.grado}</td><td>${a.cicloEscolar}</td><td><span class="badge ${a.estado==='Activo'?'badge-activo':'badge-suspendido'}">${a.estado}</span></td></tr>`).join(''); tbody.querySelectorAll('tr').forEach(f=>f.addEventListener('click',()=>{tbody.querySelectorAll('tr').forEach(r=>r.classList.remove('selected')); f.classList.add('selected');})); };
        selectGrado.addEventListener('change', actualizar); inputBusqueda.addEventListener('input', actualizar);
        document.getElementById('btnSuspender').onclick=()=>{ let sel=document.querySelector('#tbodyPanel tr.selected'); if(!sel) return Swal.fire('Error','Seleccione un alumno','error'); this.colegio.suspenderAlternar(parseInt(sel.dataset.id)); actualizar(); };
        document.getElementById('btnEliminar').onclick=async()=>{ let sel=document.querySelector('#tbodyPanel tr.selected'); if(!sel) return Swal.fire('Error','Seleccione','error'); const r=await Swal.fire({title:'¿Eliminar?',text:'No se puede deshacer',icon:'warning',showCancelButton:true}); if(r.isConfirmed){ this.colegio.eliminarAlumno(parseInt(sel.dataset.id)); actualizar(); Swal.fire('Eliminado','','success'); } };
        actualizar();
    }

      _renderGestionAlumnos() {
        const grados = ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        this.mainContent.innerHTML = `
            <h2 class="section-title">👥 Gestión de Alumnos (Contraseñas)</h2>
            <div class="toolbar"><select id="gestionGrado">${grados.map(g=>`<option>${g}</option>`).join('')}</select></div>
            <div class="table-container"><table><thead><tr><th>Clave</th><th>Alumno</th><th>Código</th><th>Contraseña actual</th><th>Nueva contraseña</th><th>Acción</th></tr></thead><tbody id="tbodyGestionAlumnos"></tbody></table></div>
        `;
        const selectGrado = document.getElementById('gestionGrado');
        const actualizar = () => {
            const grado = selectGrado.value;
            const alumnos = this.colegio.getAlumnosFiltrados(grado, this.cicloActual);
            const tbody = document.getElementById('tbodyGestionAlumnos');
            tbody.innerHTML = alumnos.map(a => `<tr><td>${a.clave}</td><td>${a.nombreCompleto}</td><td>${a.codigo}</td><td>••••••</td><td><input type="text" id="pass-${a.id}" placeholder="Nueva"></td><td><button class="btn btn-sm btn-primary" data-id="${a.id}">Actualizar</button></td></tr>`).join('');
            document.querySelectorAll('[data-id]').forEach(btn => btn.addEventListener('click', () => { let id=parseInt(btn.dataset.id); let nueva=document.getElementById(`pass-${id}`).value.trim(); if(nueva && this.colegio.actualizarPasswordAlumno(id,nueva)) Swal.fire('Éxito','Contraseña actualizada','success'); else Swal.fire('Error','Ingrese una nueva','error'); actualizar(); }));
        };
        selectGrado.addEventListener('change', actualizar);
        actualizar();
    }

    _renderGestionMaestros() {
        this.mainContent.innerHTML = `
            <h2 class="section-title">👨‍🏫 Gestionar Maestros</h2>
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3>Listado de Maestros</h3>
                    <button class="btn btn-success" id="btnNuevoMaestro">➕ Nuevo Maestro</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>ID</th><th>Nombre</th><th>Usuario</th><th>Grados</th><th>Materias</th><th>Acción</th></tr></thead>
                        <tbody id="tbodyMaestros"></tbody>
                    </table>
                </div>
                <div id="mensajeMaestro"></div>
            </div>
        `;

        const actualizarLista = () => {
            const tbody = document.getElementById('tbodyMaestros');
            tbody.innerHTML = this.colegio.maestros.map(m => {
                const grados = Object.keys(m.asignaciones).join(', ') || 'Ninguno';
                const materias = [...new Set(Object.values(m.asignaciones).flat())].join(', ') || 'Ninguna';
                return `<tr>
                    <td>${m.id}</td>
                    <td>${m.nombreCompleto}</td>
                    <td>${m.usuario}</td>
                    <td>${grados}</td>
                    <td>${materias}</td>
                    <td>
                        <button class="btn btn-sm btn-primary btn-asignar" data-id="${m.id}">Asignar</button>
                        <button class="btn btn-sm btn-danger btn-eliminar-maestro" data-id="${m.id}">Eliminar</button>
                    </td>
                 </tr>`;
            }).join('');

            tbody.querySelectorAll('.btn-eliminar-maestro').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const result = await Swal.fire({
                        title: '¿Eliminar maestro?',
                        text: 'Esta acción no se puede deshacer.',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#e74c3c',
                        cancelButtonColor: '#7f8c8d',
                        confirmButtonText: 'Eliminar'
                    });
                    if (result.isConfirmed) {
                        await this.colegio.eliminarMaestro(parseInt(btn.dataset.id));
                        actualizarLista();
                        Swal.fire('Eliminado', '', 'success');
                    }
                });
            });

            tbody.querySelectorAll('.btn-asignar').forEach(btn => {
                btn.addEventListener('click', () => this._abrirModalAsignacion(parseInt(btn.dataset.id)));
            });
        };

        document.getElementById('btnNuevoMaestro').addEventListener('click', () => this._mostrarModalRegistroMaestro());

        actualizarLista();
    }
