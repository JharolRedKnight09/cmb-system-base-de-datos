    _renderEstudianteTareas() {
        const alumno = this.sesion.usuario;
        const tareas = this.colegio.tareas.filter(t => t.grado === alumno.grado && t.cicloEscolar === alumno.cicloEscolar);
        const entregas = this.colegio.getEntregasPorAlumno(alumno.id);
        this.mainContent.innerHTML = `<h2 class="section-title">📚 Mis Tareas</h2><div class="card">${tareas.map(t => {
            const entrega = entregas.find(e => e.tareaId === t.id);
            return `<div style="border:1px solid #ddd; margin:15px 0; padding:15px; border-radius:8px;">
                        <h3>${t.titulo} (${t.materia} - Bimestre ${t.bimestre})</h3>
                        <p>${t.descripcion}</p>
                        <p><strong>Puntaje máximo:</strong> ${t.puntajeMaximo}</p>
                        <p><strong>Entrega:</strong> ${t.fechaEntrega}</p>
                        ${entrega ? `<p><strong>✅ Entregada</strong> - Calificación: ${entrega.calificacion !== null ? entrega.calificacion : 'Pendiente'}</p>
                                    ${entrega.comentario ? `<p><em>Comentario: ${entrega.comentario}</em></p>` : ''}` :
                                    `<div class="upload-area"><input type="file" accept="application/pdf" id="file-${t.id}"><button class="btn btn-success btn-sm" data-tarea="${t.id}">📤 Subir PDF</button></div>`}
                    </div>`;
        }).join('')}${tareas.length === 0 ? '<p>No hay tareas asignadas.</p>' : ''}</div>`;
        document.querySelectorAll('[data-tarea]').forEach(btn => btn.addEventListener('click', () => {
            const tareaId = parseInt(btn.dataset.tarea);
            const fileInput = document.getElementById(`file-${tareaId}`);
            if (!fileInput.files.length) return Swal.fire('Error', 'Seleccione un PDF', 'error');
            const file = fileInput.files[0];
            if (file.type !== 'application/pdf') return Swal.fire('Error', 'Solo PDF', 'error');
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result.split(',')[1];
                this.colegio.entregarTarea(tareaId, alumno.id, file.name, base64);
                Swal.fire('Entregado', 'Tarea enviada', 'success');
                this._renderEstudianteTareas();
            };
            reader.readAsDataURL(file);
        }));
    }

    _renderNotas() {
        const bimestres = ['Bimestre 1','Bimestre 2','Bimestre 3','Bimestre 4'];
        const esMaestro = this.sesion.esMaestro;
        const maestro = esMaestro ? this.sesion.usuario : null;
        const gradosDisponibles = esMaestro ? Object.keys(maestro.asignaciones) : ['Primero','Segundo','Tercero','Cuarto Bachillerato','Quinto Bachillerato','Bachillerato por Madurez'];
        this.mainContent.innerHTML = `<h2 class="section-title">🎓 Registro General de Notas (Ciclo ${this.cicloActual})</h2><div class="toolbar"><select id="notasBimestre">${bimestres.map(b => `<option>${b}</option>`).join('')}</select><select id="notasGrado">${gradosDisponibles.map(g => `<option>${g}</option>`).join('')}</select>${!esMaestro ? `<input type="text" id="notasNuevaMateria" placeholder="Nueva materia"><button class="btn btn-primary" id="btnAgregarMateria">➕</button><button class="btn btn-danger" id="btnEliminarMateria">🗑️</button>` : ''}</div><div class="table-container"><table id="tablaNotas"><tr></div>`;
        const selectBimestre = document.getElementById('notasBimestre'), selectGrado = document.getElementById('notasGrado'), self = this;
        const renderTabla = () => { const bimestre = selectBimestre.value, grado = selectGrado.value, alumnos = self.colegio.getAlumnosFiltrados(grado, self.cicloActual), materias = self.colegio.notas.materias; let html = `<thead><tr><th>No. Clave</th><th>Alumno</th>${materias.map(m=>`<th>${m}</th>`).join('')}<th>Promedio</th></tr></thead><tbody>`; alumnos.forEach(a => { let suma=0, count=0; const celdas = materias.map(mat => { const editable = !esMaestro || (maestro && maestro.tienePermiso(grado, mat)); const val = self.colegio.notas.getNota(a.id, bimestre, mat); if(val>0){ suma+=val; count++; } return `<td><input type="number" min="0" max="100" value="${val}" class="input-nota" data-id="${a.id}" data-mat="${mat}" style="width:70px; ${!editable ? 'background:#e0e0e0; pointer-events:none;' : ''}" ${!editable ? 'disabled' : ''} step="0.01"></td>`; }).join(''); const prom = count>0 ? +(suma/count).toFixed(2) : 0; html += `<tr><td style="text-align:center;">${a.clave}</td><td>${a.nombreCompleto}</td>${celdas}<td style="text-align:center; font-weight:bold;">${prom}</td></tr>`; }); html += `</tbody>`; document.getElementById('tablaNotas').innerHTML = html; document.querySelectorAll('.input-nota:not([disabled])').forEach(input => input.addEventListener('change', function() { const fila = this.closest('tr'); let suma=0, count=0; fila.querySelectorAll('.input-nota:not([disabled])').forEach(inp => { const v = parseFloat(inp.value)||0; if(v>0){ suma+=v; count++; } }); const prom = count>0 ? +(suma/count).toFixed(2) : 0; fila.querySelector('td:last-child').innerHTML = `<strong>${prom}</strong>`; const idAlumno = parseInt(this.dataset.id); const materia = this.dataset.mat; let val = parseFloat(this.value); if(isNaN(val)) val=0; val = Math.min(100,Math.max(0,val)); this.value = val; self.colegio.notas.setNota(idAlumno, selectBimestre.value, materia, val); })); }; selectBimestre.addEventListener('change', renderTabla); selectGrado.addEventListener('change', renderTabla); if(!esMaestro){ document.getElementById('btnAgregarMateria').onclick=()=>{ let n=document.getElementById('notasNuevaMateria').value.trim(); if(n && self.colegio.notas.agregarMateria(n)) renderTabla(); }; document.getElementById('btnEliminarMateria').onclick=async()=>{ if(self.colegio.notas.materias.length<=1) return Swal.fire('Error','Debe haber al menos una materia','error'); const r=await Swal.fire({title:'¿Eliminar última materia?',text:'Se perderán las notas',icon:'warning',showCancelButton:true}); if(r.isConfirmed){ self.colegio.notas.eliminarUltimaMateria(); renderTabla(); } }; } renderTabla(); }

    _renderEstudiantePagos() {
        if (!this.sesion.esAlumno) return;
        const alumno = this.sesion.usuario;
        const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct'];
        const cuota = this.colegio.config.cuotaMensual;
        const deuda = alumno.pagos.filter(p => !p).length * cuota;
        this.mainContent.innerHTML = `<h2 class="section-title">💰 Mis Pagos</h2><div class="card"><p><strong>${alumno.nombreCompleto}</strong> | Código: ${alumno.codigo} | Grado: ${alumno.grado} | Ciclo: ${alumno.cicloEscolar}</p><table><thead><tr><th>Mes</th><th>Estado</th><th>Deuda</th></tr></thead><tbody>${meses.map((m,i) => `<tr><td>${m}</td><td>${alumno.pagos[i]?'✅ Pagado':'❌ Pendiente'}</td><td>${alumno.pagos[i]?'Q0.00':`Q${cuota}`}</tr>`).join('')}</tbody></table><p style="margin-top:15px; font-weight:bold;">Deuda total: Q${deuda}</p></div>`;
    }

    _renderEstudianteExtras() {
        if (!this.sesion.esAlumno) return;
        const alumno = this.sesion.usuario;
        const items = this.colegio.config.extrasItems;
        let totalPendiente = 0;
        const filas = items.map(item => {
            const abonado = alumno.extrasPagados[item.nombre] || 0;
            const pendiente = item.montoTotal - abonado;
            totalPendiente += pendiente;
            return `<tr><td>${item.nombre}</td><td>Q${item.montoTotal.toFixed(2)}</td><td>Q${abonado.toFixed(2)}</td><td>${pendiente <= 0 ? '✅ Pagado' : '❌ Pendiente'}</td></tr>`;
        }).join('');
        this.mainContent.innerHTML = `<h2 class="section-title">📦 Pagos Adicionales</h2><div class="card"><p><strong>${alumno.nombreCompleto}</strong> | Código: ${alumno.codigo}</p><table><thead><tr><th>Concepto</th><th>Monto total</th><th>Abonado</th><th>Estado</th></tr></thead><tbody>${filas || '<tr><td colspan="4">No hay conceptos adicionales.</td></tr>'}</tbody></table><p style="margin-top:15px; font-weight:bold;">Total pendiente: Q${totalPendiente.toFixed(2)}</p></div>`;
    }
    
    _renderEstudianteNotas() {
        if (!this.sesion.esAlumno) return;
        const alumno = this.sesion.usuario;
        const mesActual = Math.min(new Date().getMonth(), 9);
        const mesesNombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct'];
        const estaSolvente = alumno.pagos[mesActual] === true;
        if (!estaSolvente) {
            this.mainContent.innerHTML = `<h2 class="section-title">📄 Mis Notas</h2><div class="card" style="text-align:center; padding:40px;"><p style="font-size:1.2rem; color:#e74c3c;">🔒 No tienes acceso a tus notas.</p><p>Debes estar al día en el pago del mes de <strong>${mesesNombres[mesActual]}</strong>.</p></div>`;
            return;
        }
        this.mainContent.innerHTML = `<h2 class="section-title">📄 Mis Notas</h2><div class="card" style="text-align:center;"><p><strong>${alumno.nombreCompleto}</strong> | Grado: ${alumno.grado} | Ciclo: ${alumno.cicloEscolar}</p><div style="margin-top:20px; display:flex; gap:10px; justify-content:center;"><button class="btn btn-primary" id="btnVerMisNotas">👁 Ver Notas</button><button class="btn btn-success" id="btnImprimirMisNotas">🖨 Imprimir</button></div><div id="misNotasPreview" style="margin-top:20px;"></div></div>`;
        document.getElementById('btnVerMisNotas').addEventListener('click', () => this._mostrarBoletaModal(alumno.id));
        document.getElementById('btnImprimirMisNotas').addEventListener('click', () => this._imprimirBoleta(alumno.id));
    }

    _renderPagoOnline() {
        const alumno = this.sesion.usuario;
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre'];
        const cuota = this.colegio.config.cuotaMensual;
        const pendientes = meses.map((m, i) => alumno.pagos[i] ? null : { mes: m, index: i, monto: cuota }).filter(p => p);

        this.mainContent.innerHTML = `
            <h2 class="section-title">💳 Pagar Mensualidad en Línea</h2>
            <div class="card">
                ${pendientes.length ? pendientes.map(p => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                        <span><strong>${p.mes}</strong> - Q${p.monto.toFixed(2)}</span>
                        <button class="btn btn-primary pagar-btn" data-mes="${p.index}" data-monto="${p.monto}">Pagar ahora</button>
                    </div>
                `).join('') : '<p>✅ No tiene mensualidades pendientes.</p>'}
            </div>
        `;

        document.querySelectorAll('.pagar-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const mesIndex = parseInt(btn.dataset.mes);
                const monto = parseFloat(btn.dataset.monto);

                const { value: form } = await Swal.fire({
                    title: '💳 Pago con Tarjeta',
                    html: `
                        <div style="text-align:left;">
                            <label>Número de tarjeta</label>
                            <input id="cardNumber" class="swal2-input" placeholder="4111 1111 1111 1111">
                            <label>CVV</label>
                            <input id="cvv" class="swal2-input" placeholder="123">
                            <label>Fecha vencimiento</label>
                            <input id="expiry" class="swal2-input" placeholder="MM/AA">
                        </div>
                    `,
                    focusConfirm: false,
                    preConfirm: () => {
                        return {
                            card: document.getElementById('cardNumber').value,
                            cvv: document.getElementById('cvv').value,
                            expiry: document.getElementById('expiry').value
                        };
                    }
                });

                if (form) {
                    const encryptedData = btoa(JSON.stringify({
                        card: form.card.slice(-4),
                        amount: monto,
                        timestamp: Date.now()
                    }));

                    const pago = this.colegio.registrarPagoOnline(alumno.id, alumno.cicloEscolar, mesIndex, monto);
                    if (pago) {
                        const recibo = `
==========================================
    COLEGIO MIXTO BELÉN
    RECIBO DE PAGO EN LÍNEA
==========================================
Correlativo: ${pago.correlativo}
Alumno: ${alumno.nombreCompleto}
Código: ${alumno.codigo}
Mes pagado: ${meses[mesIndex]}
Monto: Q${monto.toFixed(2)}
Fecha: ${new Date().toLocaleString()}
Transacción encriptada: ${encryptedData.substring(0, 20)}...
==========================================
        ¡Gracias por su pago!
                        `;
                        this._mostrarRecibo(recibo);
                        Swal.fire('Éxito', 'Pago registrado correctamente', 'success');
                        this._renderPagoOnline();
                    } else {
                        Swal.fire('Error', 'Ya has pagado este mes', 'error');
                    }
                }
            });
        });
    }

    _mostrarRecibo(texto) {
        const modal = document.getElementById('modalRecibo');
        document.getElementById('reciboContenido').innerText = texto;
        modal.style.display = 'flex';
        document.getElementById('btnCerrarRecibo').onclick = () => modal.style.display = 'none';
        document.getElementById('btnImprimirRecibo').onclick = () => {
            const ventana = window.open('', '_blank');
            ventana.document.write(`<pre style="font-family:monospace;">${texto}</pre>`);
            ventana.print();
        };
        document.getElementById('btnCerrarModal').onclick = () => modal.style.display = 'none';
    }

    _mostrarReciboModal(texto) {
        const modal = document.getElementById('modalRecibo');
        document.getElementById('reciboContenido').innerText = texto;
        modal.style.display = 'flex';
        document.getElementById('btnCerrarRecibo').onclick = () => modal.style.display = 'none';
        document.getElementById('btnImprimirRecibo').onclick = () => {
            const ventana = window.open('', '_blank');
            ventana.document.write(`<pre style="font-family:monospace;">${texto}</pre>`);
            ventana.print();
        };
        document.getElementById('btnCerrarModal').onclick = () => modal.style.display = 'none';
    }
