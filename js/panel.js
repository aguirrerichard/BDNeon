import { sql } from './neon-config.js';

// SISTEMA DE ALERTAS Y NOTIFICACIONES DINÁMICAS (TOAST)
const mostrarToast = (mensaje, tipo = 'info', duracion = 4000) => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;

    let icono = 'fa-circle-info';
    if (tipo === 'exito') icono = 'fa-circle-check';
    if (tipo === 'error') icono = 'fa-circle-xmark';
    if (tipo === 'advertencia') icono = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icono}"></i> <span>${mensaje}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-salida');
        toast.addEventListener('animationend', () => toast.remove());
    }, duracion);
};

// MODAL DE CONFIRMACIÓN DINÁMICO
const mostrarConfirmacion = (mensaje, titulo = 'Confirmación requerida') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-confirmacion');
        const txtMensaje = document.getElementById('confirm-mensaje');
        const txtTitulo = document.getElementById('confirm-titulo');
        const btnSi = document.getElementById('btn-confirm-si');
        const btnNo = document.getElementById('btn-confirm-no');

        if (!modal) {
            resolve(confirm(mensaje));
            return;
        }

        txtTitulo.textContent = titulo;
        txtMensaje.textContent = mensaje;
        modal.classList.add('activo');

        const limpiarEventos = () => {
            modal.classList.remove('activo');
            btnSi.removeEventListener('click', enSi);
            btnNo.removeEventListener('click', enNo);
        };

        const enSi = () => { limpiarEventos(); resolve(true); };
        const enNo = () => { limpiarEventos(); resolve(false); };

        btnSi.addEventListener('click', enSi);
        btnNo.addEventListener('click', enNo);
    });
};

// 1. Cargar usuario de sessionStorage
let usuarioSesion = JSON.parse(sessionStorage.getItem('usuario'));

if (!usuarioSesion) {
    mostrarToast("Acceso restringido. Debes iniciar sesión.", "error");
    setTimeout(() => window.location.href = "login.html", 1500);
}

// 2. OBTENER Y FORZAR DATOS REALES DESDE NEON SQL
const obtenerUsuarioActualizadoBD = async () => {
    try {
        let datosBD = [];
        
        if (usuarioSesion.id) {
            datosBD = await sql`SELECT * FROM usuarios WHERE id = ${usuarioSesion.id}`;
        } else if (usuarioSesion.correo) {
            datosBD = await sql`SELECT * FROM usuarios WHERE correo = ${usuarioSesion.correo}`;
        } else if (usuarioSesion.usuario || usuarioSesion.nombre) {
            const identificador = usuarioSesion.usuario || usuarioSesion.nombre;
            datosBD = await sql`SELECT * FROM usuarios WHERE nombre = ${identificador} OR usuario = ${identificador}`;
        }

        if (datosBD && datosBD.length > 0) {
            usuarioSesion = { ...usuarioSesion, ...datosBD[0] };
            sessionStorage.setItem('usuario', JSON.stringify(usuarioSesion));
        }
    } catch (err) {
        console.error("Error al consultar usuario en Neon:", err);
    }
};

// 3. NORMALIZAR TURNO
const normalizarTurno = (turnoRaw) => {
    if (!turnoRaw) return { id: 'manana', nombre: 'Mañana', horario: '06:00 - 14:00' };
    const str = turnoRaw.toString().toLowerCase().trim();
    
    if (str.includes('mañ') || str.includes('man') || str === '1') {
        return { id: 'manana', nombre: 'Mañana', horario: '06:00 - 14:00' };
    } else if (str.includes('tard') || str === '2') {
        return { id: 'tarde', nombre: 'Tarde', horario: '14:00 - 22:00' };
    } else if (str.includes('noc') || str === '3') {
        return { id: 'noche', nombre: 'Noche', horario: '22:00 - 06:00' };
    }
    return { id: 'manana', nombre: 'Mañana', horario: '06:00 - 14:00' };
};

// 4. TURNO ACTUAL DEL SISTEMA SEGÚN LA HORA DEL NAVEGADOR
const obtenerTurnoActualSistema = () => {
    const hora = new Date().getHours();
    if (hora >= 6 && hora < 14) {
        return { id: 'manana', nombre: 'Mañana', horario: '06:00 - 14:00' };
    } else if (hora >= 14 && hora < 22) {
        return { id: 'tarde', nombre: 'Tarde', horario: '14:00 - 22:00' };
    } else {
        return { id: 'noche', nombre: 'Noche', horario: '22:00 - 06:00' };
    }
};

// 5. EVALUAR SI TIENE PERMISO POR HORARIO
const verificarSiEstaEnTurno = () => {
    if (usuarioSesion.rol === 'administrador' || usuarioSesion.rol === 'admin') {
        return true;
    }
    const turnoEmpleado = normalizarTurno(usuarioSesion.turno);
    const turnoSistema = obtenerTurnoActualSistema();
    
    return turnoEmpleado.id === turnoSistema.id;
};

// 6. RENDERIZAR ENCABEZADO
const renderizarHeaderUsuario = () => {
    const elNombre = document.getElementById('user-nombre');
    const elRolTurno = document.getElementById('user-rol-turno');
    if (!elNombre || !elRolTurno) return;

    const nombreUsuario = usuarioSesion.nombre || usuarioSesion.nombre_cliente || usuarioSesion.usuario || "Usuario Activo";
    elNombre.textContent = nombreUsuario;

    if (usuarioSesion.rol === 'administrador' || usuarioSesion.rol === 'admin') {
        elRolTurno.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Administrador (Acceso Total 24/7)`;
    } else {
        const turnoAsignado = normalizarTurno(usuarioSesion.turno);
        const enServicio = verificarSiEstaEnTurno();

        const badgeEstado = enServicio
            ? `<span style="color:#4ade80; font-weight:700;">● En Servicio</span>`
            : `<span style="color:#f87171; font-weight:700;">● Fuera de Servicio</span>`;

        elRolTurno.innerHTML = `Empleado | Turno ${turnoAsignado.nombre} (${turnoAsignado.horario}) ${badgeEstado}`;
    }
};

// 7. BLOQUEO DE ACCIONES
const validarPermisoTurnoEdicion = () => {
    if (usuarioSesion.rol === 'administrador' || usuarioSesion.rol === 'admin') {
        return true;
    }

    if (verificarSiEstaEnTurno()) {
        return true;
    }

    const turnoAsignado = normalizarTurno(usuarioSesion.turno);
    const turnoActual = obtenerTurnoActualSistema();

    mostrarToast(
        `ACCESO RESTRINGIDO POR TURNO: Asignado Turno ${turnoAsignado.nombre} (${turnoAsignado.horario}) - Sistema en Turno ${turnoActual.nombre}. No puedes editar estando FUERA DE SERVICIO.`,
        "advertencia",
        6000
    );
    return false;
};

document.addEventListener("DOMContentLoaded", async () => {
    await obtenerUsuarioActualizadoBD();
    renderizarHeaderUsuario();

    // Botón Cerrar Sesión
    const btnCerrar = document.getElementById('btn-cerrar-sesion');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', () => {
            sessionStorage.removeItem('usuario');
            window.location.href = "login.html";
        });
    }

    const tbody = document.querySelector('#tabla-solicitudes tbody');
    const inputBuscar = document.getElementById('input-buscar');
    const totalRegistros = document.getElementById('total-registros');

    // Inputs
    const inputDni = document.getElementById('crear-dni');
    const inputSuministro = document.getElementById('crear-suministro');

    // KPIs
    const kpiTotal = document.getElementById('kpi-total');
    const kpiRegistrados = document.getElementById('kpi-registrados');
    const kpiProceso = document.getElementById('kpi-proceso');
    const kpiAtendidos = document.getElementById('kpi-atendidos');
    const kpiRechazados = document.getElementById('kpi-rechazados');

    // Modales
    const modalCrear = document.getElementById('modal-crear');
    const modalAtencion = document.getElementById('modal-atencion');
    const formCrear = document.getElementById('form-crear-admin');
    const txtRespuestaAdmin = document.getElementById('respuesta-admin');

    let todosLosReclamos = [];
    let reclamoSeleccionadoId = null;

    const abrirModal = (modal) => modal && modal.classList.add('activo');
    const cerrarModal = (modal) => modal && modal.classList.remove('activo');

    // Restricciones numéricas
    if (inputSuministro) {
        inputSuministro.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
        });
    }

    if (inputDni) {
        inputDni.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
        });
    }

    // Modal Crear
    const btnAbrirCrear = document.getElementById('btn-abrir-crear');
    if (btnAbrirCrear) btnAbrirCrear.addEventListener('click', () => abrirModal(modalCrear));
    
    const btnCancelCrear = document.getElementById('btn-cancelar-crear');
    if (btnCancelCrear) {
        btnCancelCrear.addEventListener('click', () => {
            if (formCrear) formCrear.reset();
            cerrarModal(modalCrear);
        });
    }

    const btnCerrarCrearX = document.getElementById('btn-cerrar-crear-x');
    if (btnCerrarCrearX) {
        btnCerrarCrearX.addEventListener('click', () => {
            if (formCrear) formCrear.reset();
            cerrarModal(modalCrear);
        });
    }

    const btnCerrarAtencionX = document.getElementById('btn-cerrar-atencion-x');
    if (btnCerrarAtencionX) {
        btnCerrarAtencionX.addEventListener('click', () => cerrarModal(modalAtencion));
    }

    // Formato Fecha
    const formatearFecha = (fechaStr) => {
        if (!fechaStr) return new Date().toLocaleDateString('es-PE');
        const fecha = new Date(fechaStr);
        return isNaN(fecha.getTime()) ? fechaStr : fecha.toLocaleDateString('es-PE', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    };

    // Helper para normalizar el estado registrado en BD
    const obtenerClaseEstado = (est) => {
        if (!est) return 'registrado';
        const e = est.toString().toLowerCase().trim();
        if (e.includes('proceso')) return 'en_proceso';
        if (e.includes('atend')) return 'atendido';
        if (e.includes('rechaz')) return 'rechazado';
        return 'registrado';
    };

    // Actualizar KPIs
    const actualizarKPIs = (lista) => {
        const total = lista.length;
        const registrados = lista.filter(r => obtenerClaseEstado(r.estado) === 'registrado').length;
        const enProceso = lista.filter(r => obtenerClaseEstado(r.estado) === 'en_proceso').length;
        const atendidos = lista.filter(r => obtenerClaseEstado(r.estado) === 'atendido').length;
        const rechazados = lista.filter(r => obtenerClaseEstado(r.estado) === 'rechazado').length;

        if (kpiTotal) kpiTotal.textContent = total;
        if (kpiRegistrados) kpiRegistrados.textContent = registrados;
        if (kpiProceso) kpiProceso.textContent = enProceso;
        if (kpiAtendidos) kpiAtendidos.textContent = atendidos;
        if (kpiRechazados) kpiRechazados.textContent = rechazados;
    };

    // Render Tabla con asignación exacta de colores
    const renderizarTabla = (lista) => {
        if (totalRegistros) totalRegistros.textContent = `${lista.length} Reclamos`;
        if (!tbody) return;

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">No se encontraron reclamos registrados.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        lista.forEach(solicitud => {
            const claseEstado = obtenerClaseEstado(solicitud.estado);
            const textoEstado = claseEstado.replace('_', ' ').toUpperCase();
            const fechaFormateada = formatearFecha(solicitud.created_at || solicitud.fecha_registro);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${solicitud.codigo_seguimiento || 'N/A'}</strong></td>
                <td>${fechaFormateada}</td>
                <td>${solicitud.nombre_cliente || 'Sin Nombre'}</td>
                <td>${solicitud.dni || 'N/A'}</td>
                <td>${solicitud.numero_suministro || 'N/A'}</td>
                <td>
                    <span class="badge-tabla ${claseEstado}">
                        ${textoEstado}
                    </span>
                </td>
                <td class="acciones-td">
                    <button class="btn-gestionar" data-id="${solicitud.id}">
                        <i class="fa-solid fa-headset"></i> Atender / Gestionar
                    </button>
                    <button class="btn-eliminar" data-id="${solicitud.id}" title="Eliminar Registro">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Evento Modal Atender
        document.querySelectorAll('.btn-gestionar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                reclamoSeleccionadoId = parseInt(e.currentTarget.getAttribute('data-id'));
                const reclamo = todosLosReclamos.find(r => r.id === reclamoSeleccionadoId);

                if (reclamo) {
                    const claseEst = obtenerClaseEstado(reclamo.estado);
                    const badge = document.getElementById('det-estado-badge');
                    
                    document.getElementById('det-codigo').textContent = reclamo.codigo_seguimiento || 'N/A';
                    document.getElementById('det-fecha').textContent = formatearFecha(reclamo.created_at || reclamo.fecha_registro);
                    document.getElementById('det-cliente').textContent = reclamo.nombre_cliente || 'N/A';
                    document.getElementById('det-dni').textContent = reclamo.dni || 'N/A';
                    document.getElementById('det-suministro').textContent = reclamo.numero_suministro || 'N/A';
                    document.getElementById('det-comentario').textContent = reclamo.comentario || 'Sin observaciones.';
                    if (txtRespuestaAdmin) txtRespuestaAdmin.value = reclamo.respuesta || '';
                    
                    if (badge) {
                        badge.textContent = claseEst.replace('_', ' ').toUpperCase();
                        badge.style.backgroundColor = 
                            claseEst === 'atendido' ? '#16a34a' :
                            claseEst === 'rechazado' ? '#dc2626' :
                            claseEst === 'en_proceso' ? '#d97706' : '#2563eb';
                        badge.style.color = '#ffffff';
                    }

                    abrirModal(modalAtencion);
                }
            });
        });

        // Evento Eliminar con Confirmación Dinámica
        document.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (!validarPermisoTurnoEdicion()) return;

                const id = e.currentTarget.getAttribute('data-id');
                const confirmado = await mostrarConfirmacion('¿Confirmas que deseas eliminar permanentemente este registro de la base de datos?', 'Eliminar Reclamo');
                
                if (confirmado) {
                    try {
                        await sql`DELETE FROM reclamos_luz WHERE id = ${id}`;
                        mostrarToast('Reclamo eliminado correctamente.', 'exito');
                        cargarSolicitudes();
                    } catch (err) {
                        console.error("Error al eliminar:", err);
                        mostrarToast("No se pudo eliminar el registro.", "error");
                    }
                }
            });
        });
    };

    // Cambiar Estado
    const cambiarEstadoAutomatico = async (nuevoEstado, mensajeExito) => {
        if (!validarPermisoTurnoEdicion()) return;
        if (!reclamoSeleccionadoId) return;

        const respuestaTexto = txtRespuestaAdmin ? txtRespuestaAdmin.value.trim() : '';

        try {
            await sql`
                UPDATE reclamos_luz 
                SET estado = ${nuevoEstado},
                    comentario = CASE 
                        WHEN ${respuestaTexto} != '' THEN ${respuestaTexto}
                        ELSE comentario 
                    END
                WHERE id = ${reclamoSeleccionadoId}
            `;

            mostrarToast(mensajeExito, "exito");
            cerrarModal(modalAtencion);
            cargarSolicitudes();
        } catch (err) {
            console.error("Error al actualizar estado:", err);
            mostrarToast("Ocurrió un error al registrar el dictamen.", "error");
        }
    };

    const btnAtender = document.getElementById('btn-dictamen-atender');
    if (btnAtender) btnAtender.addEventListener('click', () => cambiarEstadoAutomatico('atendido', '¡Reclamo marcado como ATENDIDO con éxito!'));

    const btnRechazar = document.getElementById('btn-dictamen-rechazar');
    if (btnRechazar) btnRechazar.addEventListener('click', () => cambiarEstadoAutomatico('rechazado', 'El reclamo ha sido RECHAZADO.'));

    const btnProceso = document.getElementById('btn-dictamen-proceso');
    if (btnProceso) btnProceso.addEventListener('click', () => cambiarEstadoAutomatico('en_proceso', 'El reclamo ahora está EN PROCESO.'));

    // Cargar Reclamos de la BD
    const cargarSolicitudes = async () => {
        try {
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando base de datos...</td></tr>';
            
            todosLosReclamos = await sql`SELECT * FROM reclamos_luz ORDER BY id DESC`;
            actualizarKPIs(todosLosReclamos);
            renderizarTabla(todosLosReclamos);

        } catch (error) {
            console.error("Error al conectar a la BD:", error);
            mostrarToast("Error al conectar con la base de datos Neon.", "error");
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#dc2626; padding:20px;">Error al conectar con la base de datos Neon.</td></tr>';
        }
    };

    // Buscador
    if (inputBuscar) {
        inputBuscar.addEventListener('input', (e) => {
            const termino = e.target.value.toLowerCase().trim();
            const filtrados = todosLosReclamos.filter(r => 
                (r.codigo_seguimiento && r.codigo_seguimiento.toLowerCase().includes(termino)) ||
                (r.nombre_cliente && r.nombre_cliente.toLowerCase().includes(termino)) ||
                (r.dni && r.dni.toLowerCase().includes(termino)) ||
                (r.numero_suministro && r.numero_suministro.toLowerCase().includes(termino))
            );
            renderizarTabla(filtrados);
        });
    }

    // Formulario Crear Reclamo
    if (formCrear) {
        formCrear.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const dni = document.getElementById('crear-dni').value.trim();
            const nombre = document.getElementById('crear-nombre').value.trim();
            const suministro = document.getElementById('crear-suministro').value.trim();
            const comentario = document.getElementById('crear-comentario').value.trim();

            if (!/^\d{6,8}$/.test(suministro)) {
                mostrarToast("El N° de Suministro debe contener únicamente entre 6 y 8 dígitos numéricos.", "advertencia");
                return;
            }

            if (!/^\d{8}$/.test(dni)) {
                mostrarToast("El DNI debe contener exactamente 8 dígitos numéricos.", "advertencia");
                return;
            }

            const codigo = 'COD-' + Date.now().toString().slice(-8);

            try {
                await sql`
                    INSERT INTO reclamos_luz (
                        id_usuario, codigo_seguimiento, dni, nombre_cliente, motivo, 
                        numero_suministro, comentario, estado
                    ) VALUES (
                        ${usuarioSesion.id || 1}, ${codigo}, ${dni}, ${nombre}, 
                        'Reclamo por Monto Excesivo', ${suministro}, ${comentario}, 'registrado'
                    )
                `;
                mostrarToast(`Reclamo registrado con éxito. Código asignado: ${codigo}`, "exito");
                formCrear.reset();
                cerrarModal(modalCrear);
                cargarSolicitudes();
            } catch (err) {
                console.error("Error al guardar reclamo:", err);
                mostrarToast("No se pudo registrar el reclamo.", "error");
            }
        });
    }

    cargarSolicitudes();
});