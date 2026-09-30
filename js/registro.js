import { sql } from './neon-config.js';

const usuarioSesion = JSON.parse(sessionStorage.getItem('usuario'));

if (!usuarioSesion) {
    alert("Acceso restringido: Debes iniciar sesión.");
    window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
    const formReclamo = document.getElementById("form-reclamo");
    const mensajeExito = document.getElementById("mensaje-exito");
    const inputNombres = document.getElementById("nombres");

    if (usuarioSesion && inputNombres && !inputNombres.value) {
        inputNombres.value = usuarioSesion.nombre;
    }

    if (formReclamo) {
        formReclamo.addEventListener("submit", async (e) => {
            e.preventDefault();

            const id_usuario = usuarioSesion.id; // Vinculación del usuario
            const dni = document.getElementById("dni").value.trim() || null;
            const nombre_cliente = document.getElementById("nombres").value.trim();
            const motivo = document.getElementById("tipo_tramite").value;
            const suministro = document.getElementById("suministro").value.trim() || null;
            const direccion = document.getElementById("direccion").value.trim() || null;
            const mes_reclamo = document.getElementById("mes_reclamo").value || null;
            const monto_reclamo = document.getElementById("monto_reclamo").value ? parseFloat(document.getElementById("monto_reclamo").value) : null;
            const comentario = document.getElementById("descripcion").value.trim();
            const btnEnviar = document.getElementById("btn-enviar-reclamo");

            if (!dni || !nombre_cliente || !motivo || !comentario) {
                alert("Por favor, completa los campos obligatorios.");
                return;
            }

            const codigo = 'COD-' + Date.now().toString().slice(-8);

            try {
                if (btnEnviar) {
                    btnEnviar.disabled = true;
                    btnEnviar.textContent = "Guardando...";
                }

                await sql`
                    INSERT INTO reclamos_luz (
                        id_usuario, codigo_seguimiento, dni, nombre_cliente, motivo, 
                        numero_suministro, direccion, mes_reclamo, monto_reclamo, 
                        comentario, estado
                    ) 
                    VALUES (
                        ${id_usuario}, ${codigo}, ${dni}, ${nombre_cliente}, ${motivo}, 
                        ${suministro}, ${direccion}, ${mes_reclamo}, ${monto_reclamo}, 
                        ${comentario}, 'registrado'
                    )
                `;

                alert(`¡Trámite registrado con éxito!\nCódigo de seguimiento: ${codigo}`);
                window.location.href = "actualizar.html"; // Redirigir a su panel de cliente

            } catch (error) {
                console.error("Error al guardar:", error);
                alert("Hubo un error al registrar la información.");
            } finally {
                if (btnEnviar) {
                    btnEnviar.disabled = false;
                    btnEnviar.innerHTML = 'Registrar Solicitud <i class="fa-solid fa-file-export"></i>';
                }
            }
        });
    }
});