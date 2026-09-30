import { sql } from './neon-config.js';

// Validar sesión de usuario de forma segura (soporta localStorage y sessionStorage)
const usuarioStorage = localStorage.getItem('usuario') || sessionStorage.getItem('usuario');
const usuarioSesion = usuarioStorage ? JSON.parse(usuarioStorage) : null;

if (!usuarioSesion || !usuarioSesion.id) {
    alert("Debes iniciar sesión para acceder a tus registros.");
    window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
    // Nota: El cierre de sesión y el nombre en el header ahora son manejados automáticamente por js/auth.js

    const tbody = document.getElementById('tbody-mis-reclamos');
    const modal = document.getElementById('modal-editar-cliente');
    const inputEditId = document.getElementById('edit-id');
    const inputEditComentario = document.getElementById('edit-comentario');
    const btnGuardar = document.getElementById('btn-guardar-cliente');
    const btnCancelar = document.getElementById('btn-cancelar-cliente');

    // Consulta exclusiva de los registros del usuario actual
    const cargarMisReclamos = async () => {
        if (!tbody) return;

        try {
            tbody.innerHTML = '<tr><td colspan="6" class="texto-cargando"><i class="fa-solid fa-spinner fa-spin"></i> Cargando tus registros...</td></tr>';
            
            // Garantiza que solo extrae los de ESTE usuario
            const reclamos = await sql`
                SELECT * FROM reclamos_luz 
                WHERE id_usuario = ${usuarioSesion.id} 
                ORDER BY id DESC
            `;

            if (!reclamos || reclamos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#64748b;">No tienes registros de reclamos almacenados actualmente.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            reclamos.forEach(item => {
                const tr = document.createElement('tr');
                const esEditable = item.estado === 'registrado';
                const estadoTexto = item.estado ? item.estado.replace('_', ' ') : 'registrado';
                const estadoCapitalizado = estadoTexto.charAt(0).toUpperCase() + estadoTexto.slice(1);

                tr.innerHTML = `
                    <td><strong>${item.codigo_seguimiento || 'N/A'}</strong></td>
                    <td>${item.numero_suministro || 'N/A'}</td>
                    <td>${item.motivo || 'Reclamo por Monto Excesivo'}</td>
                    <td>${item.comentario || ''}</td>
                    <td><span class="badge badge-${item.estado}">${estadoCapitalizado}</span></td>
                    <td>
                        ${esEditable ? `
                            <button class="btn-accion btn-editar" data-id="${item.id}" data-comentario="${encodeURIComponent(item.comentario || '')}">
                                <i class="fa-solid fa-pen"></i> Editar
                            </button>
                        ` : `<span class="estado-bloqueado"><i class="fa-solid fa-lock"></i> Trámite ${estadoCapitalizado}</span>`}
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Evento editar registro propio
            document.querySelectorAll('.btn-editar').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    const comentario = decodeURIComponent(e.currentTarget.getAttribute('data-comentario') || '');

                    if (inputEditId) inputEditId.value = id;
                    if (inputEditComentario) inputEditComentario.value = comentario;

                    if (modal) modal.classList.add('activo'); // Usa la nueva clase CSS fluida
                });
            });

        } catch (error) {
            console.error("Error al obtener reclamos propios:", error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">Error al conectar con la base de datos.</td></tr>';
        }
    };

    // Guardar actualización de registro propio
    if (btnGuardar) {
        btnGuardar.addEventListener('click', async () => {
            const id = inputEditId ? inputEditId.value : null;
            const comentario = inputEditComentario ? inputEditComentario.value.trim() : '';

            if (!id) {
                alert("Identificador inválido.");
                return;
            }

            if (!comentario) {
                alert("La descripción / fundamento es obligatoria.");
                return;
            }

            try {
                // Doble validación en UPDATE: id del reclamo y id del usuario para evitar manipulaciones
                await sql`
                    UPDATE reclamos_luz 
                    SET comentario = ${comentario} 
                    WHERE id = ${id} AND id_usuario = ${usuarioSesion.id} AND estado = 'registrado'
                `;
                
                if (modal) modal.classList.remove('activo');
                cargarMisReclamos(); // Recargar la tabla sin refrescar la web
            } catch (error) {
                console.error("Error al actualizar reclamo:", error);
                alert("No se pudo actualizar el registro.");
            }
        });
    }

    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            if (modal) modal.classList.remove('activo');
        });
    }

    cargarMisReclamos();
});