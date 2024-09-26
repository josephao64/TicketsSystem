// adminPanel.js
import { db, storage } from './firebaseConfig.js';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp, 
  getDoc
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const logoutButton = document.getElementById('logout-button');
  const createUserForm = document.getElementById('create-user-form');
  const usersList = document.getElementById('users-list');
  const openCreateTicketModalButton = document.getElementById('open-create-ticket-modal');
  const createTicketModal = document.getElementById('create-ticket-modal');
  const closeCreateTicketModalButton = document.querySelectorAll('.close-modal, .close-modal-button');
  const modalCreateTicketForm = document.getElementById('modal-create-ticket-form');
  const filterButtons = document.querySelectorAll('.filter-button');
  const ticketsTableBody = document.querySelector('#tickets-table tbody');
  const exportTicketsButton = document.getElementById('export-tickets-button');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  const ticketImageInput = document.getElementById('modal-ticket-image');
  const modalImagePreviewDiv = document.getElementById('modal-image-preview');

  let currentUser = JSON.parse(localStorage.getItem('currentUser'));

  // Verificar si el usuario está autenticado y es administrador
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Acceso no autorizado');
    window.location.href = 'index.html';
  } else {
    loadUsers();
    loadTickets(); // Cargar todos los tickets inicialmente
  }

  // Manejo de pestañas
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      // Remover clase active de todos los botones
      tabButtons.forEach(btn => btn.classList.remove('active'));
      // Añadir clase active al botón seleccionado
      button.classList.add('active');
      
      // Ocultar todas las pestañas
      tabContents.forEach(content => content.classList.remove('active'));
      // Mostrar la pestaña seleccionada
      document.getElementById(targetTab).classList.add('active');
    });
  });

  // Cerrar modal al hacer clic en 'x' o en 'Cancelar'
  closeCreateTicketModalButton.forEach(button => {
    button.addEventListener('click', () => {
      createTicketModal.style.display = 'none';
      modalCreateTicketForm.reset();
      modalImagePreviewDiv.innerHTML = '';
    });
  });

  // Cerrar modal al hacer clic fuera del contenido
  window.addEventListener('click', (event) => {
    if (event.target == createTicketModal) {
      createTicketModal.style.display = 'none';
      modalCreateTicketForm.reset();
      modalImagePreviewDiv.innerHTML = '';
    }
  });

  // Cerrar sesión
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
  });

  // Crear nuevo usuario
  createUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
    const empresa = document.getElementById('new-empresa').value.trim();
    const sucursal = document.getElementById('new-sucursal').value.trim();

    if (!username || !password || !empresa || !sucursal) {
      alert('Por favor, complete todos los campos.');
      return;
    }

    try {
      // Hashear la contraseña
      const passwordHash = await hashPassword(password);

      // Generar un ID único para el usuario
      const userRef = doc(collection(db, 'users_public'));
      const userId = userRef.id;

      // Guardar información pública en users_public
      await setDoc(userRef, {
        username,
        role,
        empresa,
        sucursal
      });

      // Guardar información privada en users_private
      await setDoc(doc(db, 'users_private', userId), {
        passwordHash
      });

      alert('Usuario creado exitosamente');
      createUserForm.reset();
      // Actualizar la lista de usuarios
      loadUsers();
    } catch (error) {
      console.error('Error al crear usuario:', error);
      alert('Error al crear usuario: ' + error.message);
    }
  });

  // Abrir modal para crear ticket
  openCreateTicketModalButton.addEventListener('click', () => {
    createTicketModal.style.display = 'block';
  });

  // Vista previa de la imagen seleccionada en el modal de crear ticket
  ticketImageInput.addEventListener('change', () => {
    const file = ticketImageInput.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        modalImagePreviewDiv.innerHTML = `<img src="${e.target.result}" alt="Vista Previa" />`;
      };
      reader.readAsDataURL(file);
    } else {
      modalImagePreviewDiv.innerHTML = '';
    }
  });

  // Crear nuevo ticket desde modal
  modalCreateTicketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('modal-ticket-title').value.trim();
    const description = document.getElementById('modal-ticket-description').value.trim();
    const priority = document.getElementById('modal-ticket-priority').value;
    const imageFile = document.getElementById('modal-ticket-image').files[0];

    if (!title || !description) {
      alert('Por favor, complete todos los campos.');
      return;
    }

    try {
      // Limitar el tamaño máximo del archivo a 1MB
      const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

      let imageUrl = null;
      if (imageFile) {
        if (imageFile.size > MAX_FILE_SIZE) {
          // Intentar comprimir la imagen
          try {
            const compressedFile = await compressImage(imageFile, MAX_FILE_SIZE);
            if (compressedFile.size > MAX_FILE_SIZE) {
              alert('La imagen seleccionada no pudo ser comprimida lo suficiente. Por favor, selecciona una imagen más pequeña.');
              return;
            }
            imageUrl = await processAndUploadImage(compressedFile);
          } catch (error) {
            console.error('Error al comprimir la imagen:', error);
            alert('Ocurrió un error al comprimir la imagen. Por favor, intenta nuevamente.');
            return;
          }
        } else {
          // Subir la imagen directamente
          imageUrl = await processAndUploadImage(imageFile);
        }
      }

      // Obtener el siguiente ID numérico para el ticket
      const nextId = await getNextTicketId();

      // Obtener fecha y hora actuales
      const createdAt = Timestamp.now();

      // Crear ticket en Firestore
      await setDoc(doc(db, 'tickets', nextId.toString()), {
        id: nextId,
        title,
        description,
        priority,
        status: 'abierto',
        createdAt,
        emittedBy: currentUser.username,
        empresa: currentUser.empresa || 'Empresa Default',
        sucursal: currentUser.sucursal || 'Sucursal Default',
        assignedTo: null,
        imageUrl // Guardar la URL de la imagen si se adjuntó
      });

      alert('Ticket creado exitosamente con ID: ' + nextId);
      modalCreateTicketForm.reset();
      createTicketModal.style.display = 'none';
      modalImagePreviewDiv.innerHTML = '';
      // Actualizar la lista de tickets
      loadTickets();
    } catch (error) {
      console.error('Error al crear ticket:', error);
      alert('Error al crear ticket: ' + error.message);
    }
  });

  // Función para obtener el siguiente ID de ticket
  async function getNextTicketId() {
    const ticketsRef = collection(db, 'tickets');
    // Ordenar por 'id' descendente para obtener el más reciente
    const q = query(ticketsRef, orderBy('id', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return 1;
    } else {
      const lastTicket = querySnapshot.docs[0].data();
      return lastTicket.id + 1;
    }
  }

  // Función para comprimir la imagen utilizando browser-image-compression
  async function compressImage(file, maxSize) {
    const options = {
      maxSizeMB: maxSize / (1024 * 1024), // Convertir bytes a MB
      maxWidthOrHeight: 1280, // Dimensión máxima
      useWebWorker: true,
      initialQuality: 0.8, // Calidad inicial (80%)
    };
    try {
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (error) {
      throw error;
    }
  }

  // Función para comprimir y subir la imagen
  async function processAndUploadImage(file) {
    try {
      // Crear una referencia en Firebase Storage
      const imageRef = ref(storage, `tickets/${currentUser.username}/${Date.now()}_${file.name}`);

      // Subir la imagen
      await uploadBytes(imageRef, file, { contentType: file.type });

      // Obtener la URL de descarga
      const downloadURL = await getDownloadURL(imageRef);
      return downloadURL;
    } catch (uploadError) {
      console.error('Error al subir la imagen:', uploadError);
      throw uploadError;
    }
  }

  // Cargar la lista de usuarios
  async function loadUsers() {
    usersList.innerHTML = '<h3>Usuarios Registrados</h3>';
    const usersSnapshot = await getDocs(collection(db, 'users_public'));
    usersSnapshot.forEach((doc) => {
      const user = doc.data();
      const userDiv = document.createElement('div');
      userDiv.classList.add('user-item');
      userDiv.innerHTML = `
        <p>Usuario: ${user.username}, Rol: ${capitalizeFirstLetter(user.role)}, Empresa: ${user.empresa}, Sucursal: ${user.sucursal}</p>
        <button class="edit-user-button" data-id="${doc.id}">Editar</button>
        <button class="delete-user-button" data-id="${doc.id}">Eliminar</button>
      `;
      usersList.appendChild(userDiv);

      // Añadir eventos a los botones
      userDiv.querySelector('.edit-user-button').addEventListener('click', () => {
        editUser(doc.id, user);
      });
      userDiv.querySelector('.delete-user-button').addEventListener('click', () => {
        deleteUser(doc.id);
      });
    });
  }

  // Editar usuario
  function editUser(userId, userData) {
    // Mostrar un prompt para editar los datos
    const newUsername = prompt('Editar Nombre de Usuario:', userData.username);
    if (newUsername === null) return; // Cancelado

    const newRole = prompt('Editar Rol (admin/branch/auxiliar):', userData.role);
    if (newRole === null) return; // Cancelado

    const newEmpresa = prompt('Editar Empresa:', userData.empresa);
    if (newEmpresa === null) return; // Cancelado

    const newSucursal = prompt('Editar Sucursal:', userData.sucursal);
    if (newSucursal === null) return; // Cancelado

    // Validar el rol
    const validRoles = ['admin', 'branch', 'auxiliar'];
    if (!validRoles.includes(newRole.toLowerCase())) {
      alert('Rol no válido. Debe ser "admin", "branch" o "auxiliar".');
      return;
    }

    // Actualizar en Firestore
    setDoc(doc(db, 'users_public', userId), {
      username: newUsername,
      role: newRole.toLowerCase(),
      empresa: newEmpresa,
      sucursal: newSucursal
    }, { merge: true })
      .then(() => {
        alert('Usuario actualizado exitosamente');
        loadUsers();
      })
      .catch((error) => {
        console.error('Error al actualizar usuario:', error);
        alert('Error al actualizar usuario: ' + error.message);
      });
  }

  // Eliminar usuario
  function deleteUser(userId) {
    if (confirm('¿Está seguro de que desea eliminar este usuario?')) {
      deleteDoc(doc(db, 'users_public', userId))
        .then(() => {
          // También eliminar datos privados
          deleteDoc(doc(db, 'users_private', userId));
          alert('Usuario eliminado exitosamente');
          loadUsers();
        })
        .catch((error) => {
          console.error('Error al eliminar usuario:', error);
          alert('Error al eliminar usuario: ' + error.message);
        });
    }
  }

  // Cargar la lista de tickets
  async function loadTickets(statusFilter = null) {
    ticketsTableBody.innerHTML = '';
    let q;

    const ticketsRef = collection(db, 'tickets');

    if (statusFilter && statusFilter.toLowerCase() !== 'todos') {
      // Filtrar por estado y ordenar por 'id' descendente
      q = query(
        ticketsRef,
        where('status', '==', statusFilter.toLowerCase()),
        orderBy('id', 'desc')
      );
    } else {
      // Ver todos los tickets y ordenar por 'id' descendente
      q = query(
        ticketsRef,
        orderBy('id', 'desc')
      );
    }

    const ticketsSnapshot = await getDocs(q);
    if (ticketsSnapshot.empty) {
      ticketsTableBody.innerHTML = '<tr><td colspan="6">No hay tickets disponibles.</td></tr>';
      return;
    }

    ticketsSnapshot.forEach(async (doc) => {
      const ticket = doc.data();
      const row = document.createElement('tr');

      // Formatear fecha de emisión
      const date = ticket.createdAt.toDate ? ticket.createdAt.toDate() : ticket.createdAt;
      const formattedDate = new Date(date).toLocaleString('es-ES');

      // Obtener el nombre del asignado si existe
      let assignedToDisplay = 'Sin Asignar';
      if (ticket.assignedTo) {
        assignedToDisplay = ticket.assignedTo;
      }

      // Asignar clase según el estado para estilos
      let statusClass = '';
      switch (ticket.status.toLowerCase()) {
        case 'abierto':
          statusClass = 'status-abierto';
          break;
        case 'en proceso':
          statusClass = 'status-en-proceso';
          break;
        case 'terminado':
          statusClass = 'status-terminado';
          break;
        default:
          break;
      }

      row.classList.add(statusClass);

      row.innerHTML = `
        <td>${ticket.id}</td>
        <td>${formattedDate}</td>
        <td>${ticket.title}</td>
        <td>${capitalizeFirstLetter(ticket.status)}</td>
        <td>${assignedToDisplay}</td>
        <td>
          <button class="assign-button" data-id="${doc.id}">Asignar</button>
          <button class="edit-ticket-button" data-id="${doc.id}">Editar</button>
          <button class="delete-ticket-button" data-id="${doc.id}">Eliminar</button>
          <button class="view-ticket-button" data-id="${doc.id}">Ver Ticket</button>
        </td>
      `;

      ticketsTableBody.appendChild(row);

      // Añadir eventos a los botones
      row.querySelector('.assign-button').addEventListener('click', () => {
        assignTicket(doc.id);
      });
      row.querySelector('.edit-ticket-button').addEventListener('click', () => {
        editTicket(doc.id, ticket);
      });
      row.querySelector('.delete-ticket-button').addEventListener('click', () => {
        deleteTicket(doc.id);
      });
      row.querySelector('.view-ticket-button').addEventListener('click', () => {
        viewTicket(doc.id);
      });
    });
  }

  // Función para capitalizar la primera letra
  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  // Manejar los botones de filtro
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      const status = button.getAttribute('data-status');
      loadTickets(status);
      // Actualizar la clase 'active' en los botones para indicar el filtro activo
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    });
  });

  // Asignar ticket a un auxiliar
  async function assignTicket(ticketId) {
    try {
      // Obtener lista de auxiliares
      const auxiliaresSnapshot = await getDocs(query(collection(db, 'users_public'), where('role', '==', 'auxiliar')));
      if (auxiliaresSnapshot.empty) {
        alert('No hay auxiliares disponibles para asignar.');
        return;
      }

      // Crear un select para elegir al auxiliar
      const auxiliarSelect = document.createElement('select');
      auxiliaresSnapshot.forEach((doc) => {
        const auxiliar = doc.data();
        const option = document.createElement('option');
        option.value = auxiliar.username;
        option.textContent = auxiliar.username;
        auxiliarSelect.appendChild(option);
      });

      // Mostrar el select en un prompt personalizado
      const auxiliarUsername = await showAuxiliarSelect(auxiliarSelect);
      if (!auxiliarUsername) {
        alert('No se seleccionó un auxiliar.');
        return;
      }

      // Actualizar el ticket
      await updateDoc(doc(db, 'tickets', ticketId), {
        assignedTo: auxiliarUsername
      });

      alert('Ticket asignado a ' + auxiliarUsername);
      // Actualizar la lista de tickets
      loadTickets();
    } catch (error) {
      console.error('Error al asignar ticket:', error);
      alert('Error al asignar ticket: ' + error.message);
    }
  }

  // Función para mostrar el select de auxiliares en un prompt personalizado
  function showAuxiliarSelect(auxiliarSelect) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.classList.add('modal');
      modal.innerHTML = `
        <div class="modal-content">
          <span class="close-modal">&times;</span>
          <h3>Asignar a Auxiliar</h3>
          ${auxiliarSelect.outerHTML}
          <button id="assign-confirm-button">Asignar</button>
          <button id="assign-cancel-button">Cancelar</button>
        </div>
      `;
      document.body.appendChild(modal);

      // Manejar cierre del modal
      modal.querySelector('.close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(null);
      });

      modal.querySelector('#assign-cancel-button').addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(null);
      });

      // Confirmar asignación
      modal.querySelector('#assign-confirm-button').addEventListener('click', () => {
        const selectedAuxiliar = modal.querySelector('select').value;
        document.body.removeChild(modal);
        resolve(selectedAuxiliar);
      });
    });
  }

  // Editar ticket
  async function editTicket(ticketId, ticketData) {
    try {
      // Mostrar un formulario personalizado para editar los datos
      const { value: formValues } = await Swal.fire({
        title: 'Editar Ticket',
        html:
          `<input id="swal-input1" class="swal2-input" placeholder="Título" value="${ticketData.title}">` +
          `<textarea id="swal-input2" class="swal2-textarea" placeholder="Descripción">${ticketData.description}</textarea>` +
          `<select id="swal-input3" class="swal2-select">
             <option value="alta" ${ticketData.priority === 'alta' ? 'selected' : ''}>Alta</option>
             <option value="media" ${ticketData.priority === 'media' ? 'selected' : ''}>Media</option>
             <option value="baja" ${ticketData.priority === 'baja' ? 'selected' : ''}>Baja</option>
           </select>` +
          `<select id="swal-input4" class="swal2-select">
             <option value="abierto" ${ticketData.status === 'abierto' ? 'selected' : ''}>Abierto</option>
             <option value="en proceso" ${ticketData.status === 'en proceso' ? 'selected' : ''}>En Proceso</option>
             <option value="terminado" ${ticketData.status === 'terminado' ? 'selected' : ''}>Terminado</option>
           </select>`,
        focusConfirm: false,
        preConfirm: () => {
          return [
            document.getElementById('swal-input1').value,
            document.getElementById('swal-input2').value,
            document.getElementById('swal-input3').value,
            document.getElementById('swal-input4').value
          ]
        }
      });

      if (formValues) {
        const [newTitle, newDescription, newPriority, newStatus] = formValues;

        // Validar los campos
        if (!newTitle || !newDescription) {
          Swal.showValidationMessage('Por favor, complete todos los campos.');
          return;
        }

        // Actualizar en Firestore
        await updateDoc(doc(db, 'tickets', ticketId), {
          title: newTitle,
          description: newDescription,
          priority: newPriority,
          status: newStatus
        });

        Swal.fire('Actualizado!', 'El ticket ha sido actualizado.', 'success');
        // Actualizar la lista de tickets
        loadTickets();
      }
    } catch (error) {
      console.error('Error al editar ticket:', error);
      alert('Error al editar ticket: ' + error.message);
    }
  }

  // Eliminar ticket
  function deleteTicket(ticketId) {
    if (confirm('¿Está seguro de que desea eliminar este ticket?')) {
      deleteDoc(doc(db, 'tickets', ticketId))
        .then(() => {
          alert('Ticket eliminado exitosamente');
          loadTickets();
        })
        .catch((error) => {
          console.error('Error al eliminar ticket:', error);
          alert('Error al eliminar ticket: ' + error.message);
        });
    }
  }

  // Función para ver el ticket completo en un modal
  async function viewTicket(ticketId) {
    try {
      const ticketDoc = await getDoc(doc(db, 'tickets', ticketId));
      if (!ticketDoc.exists()) {
        alert('Ticket no encontrado.');
        return;
      }
      const ticket = ticketDoc.data();

      // Generar el HTML del ticket
      const ticketHTML = generateTicketHTML(ticket);

      // Mostrar el ticket en un modal usando SweetAlert2 con opciones de Compartir y Descargar Imagen
      await Swal.fire({
        title: `Ticket #${ticket.id}`,
        html: `
          <div class="ticket-format">
            <header>
              <p class="branch">Sucursal: ${ticket.sucursal}</p>
              <h1 class="brand">${ticket.empresa}</h1>
            </header>
            <div class="content">
              <h2>Ticket #${ticket.id}</h2>
              <p><strong>Fecha de Emisión:</strong> ${new Date(ticket.createdAt.toDate()).toLocaleString('es-ES')}</p>
              <div class="title"><strong>Título:</strong> ${ticket.title}</div>
              <div class="description">
                <p><strong>Descripción:</strong></p>
                <div class="description-box">${ticket.description}</div>
              </div>
              <div class="footer">
                <p><strong>Prioridad:</strong> ${capitalizeFirstLetter(ticket.priority)}</p>
                <p><strong>Estado:</strong> ${capitalizeFirstLetter(ticket.status)}</p>
                ${ticket.assignedTo ? `<p><strong>Asignado a:</strong> ${ticket.assignedTo}</p>` : ''}
              </div>
              ${ticket.imageUrl ? `<div class="ticket-image"><img src="${ticket.imageUrl}" alt="Imagen del Ticket"></div>` : ''}
            </div>
          </div>
          ${ticket.imageUrl ? `<button id="download-image-button" style="background-color: #28a745; color: white; margin-top: 10px; padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer;">Descargar Imagen</button>` : ''}
          <button id="share-ticket-button" style="background-color: #17a2b8; color: white; margin-top: 10px; padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer;">Compartir Ticket</button>
        `,
        width: '800px',
        showCloseButton: true,
        showConfirmButton: false,
        didRender: () => {
          // Añadir evento al botón "Compartir Ticket"
          const shareButton = Swal.getPopup().querySelector('#share-ticket-button');
          shareButton.addEventListener('click', () => {
            shareTicketAsImage(ticketId);
          });

          // Añadir evento al botón "Descargar Imagen" si existe
          const downloadButton = Swal.getPopup().querySelector('#download-image-button');
          if (downloadButton) {
            downloadButton.addEventListener('click', () => {
              downloadImage(ticket.imageUrl, `Ticket_${ticket.id}.png`);
            });
          }
        }
      });
    } catch (error) {
      console.error('Error al ver el ticket:', error);
      alert('Error al ver el ticket: ' + error.message);
    }
  }

  // Función para compartir un ticket como imagen
  async function shareTicketAsImage(ticketId) {
    try {
      // Obtener datos del ticket
      const ticketDoc = await getDoc(doc(db, 'tickets', ticketId));
      if (!ticketDoc.exists()) {
        alert('Ticket no encontrado.');
        return;
      }
      const ticket = ticketDoc.data();

      // Crear un elemento temporal para renderizar el ticket
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = generateTicketHTML(ticket);
      tempDiv.style.position = 'absolute';
      tempDiv.style.top = '-9999px';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);

      // Usar html2canvas para capturar el ticket
      const canvas = await html2canvas(tempDiv, { useCORS: true });
      const imgData = canvas.toDataURL('image/png');

      // Descargar la imagen
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `Ticket_${ticket.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Eliminar el elemento temporal
      document.body.removeChild(tempDiv);

      alert('La imagen del ticket ha sido descargada exitosamente.');
    } catch (error) {
      console.error('Error al compartir el ticket como imagen:', error);
      alert('Error al compartir el ticket como imagen.');
    }
  }

  // Función para descargar la imagen adjunta del ticket
  function downloadImage(imageUrl, filename) {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Función para exportar tickets (simulación con SweetAlert2)
  exportTicketsButton.addEventListener('click', () => {
    Swal.fire({
      title: 'Exportar Tickets',
      text: 'Selecciona el formato de exportación:',
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'PDF',
      cancelButtonText: 'Excel'
    }).then((result) => {
      if (result.isConfirmed) {
        // Implementar exportación a PDF
        exportTicketsToPDF();
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        // Implementar exportación a Excel
        exportTicketsToExcel();
      }
    });
  });

  // Implementación de exportación a PDF (Placeholder)
  function exportTicketsToPDF() {
    alert('Funcionalidad de exportación a PDF aún no implementada.');
    // Aquí puedes implementar la lógica real de exportación a PDF
  }

  // Implementación de exportación a Excel (Placeholder)
  function exportTicketsToExcel() {
    alert('Funcionalidad de exportación a Excel aún no implementada.');
    // Aquí puedes implementar la lógica real de exportación a Excel
  }

  // Función para generar el HTML del ticket con el formato proporcionado, incluyendo fecha y hora
  function generateTicketHTML(ticket) {
    const date = ticket.createdAt.toDate ? ticket.createdAt.toDate() : ticket.createdAt;
    const formattedDate = new Date(date).toLocaleString('es-ES');
    return `
    <div class="ticket-format">
      <header>
        <p class="branch">Sucursal: ${ticket.sucursal}</p>
        <h1 class="brand">${ticket.empresa}</h1>
      </header>
      <div class="content">
        <h2>Ticket #${ticket.id}</h2>
        <p><strong>Fecha de Emisión:</strong> ${formattedDate}</p>
        <div class="title"><strong>Título:</strong> ${ticket.title}</div>
        <div class="description">
          <p><strong>Descripción:</strong></p>
          <div class="description-box">${ticket.description}</div>
        </div>
        <div class="footer">
          <p><strong>Prioridad:</strong> ${capitalizeFirstLetter(ticket.priority)}</p>
          <p><strong>Estado:</strong> ${capitalizeFirstLetter(ticket.status)}</p>
          ${ticket.assignedTo ? `<p><strong>Asignado a:</strong> ${ticket.assignedTo}</p>` : ''}
        </div>
        ${ticket.imageUrl ? `<div class="ticket-image"><img src="${ticket.imageUrl}" alt="Imagen del Ticket"></div>` : ''}
      </div>
    </div>
    `;
  }
});

// Función para hashear la contraseña
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
