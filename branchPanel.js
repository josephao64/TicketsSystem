// branchPanel.js

import { db, storage } from './firebaseConfig.js';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  setDoc, 
  orderBy, 
  limit, 
  Timestamp, 
  getDoc,
  updateDoc,
  deleteDoc 
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const logoutButton = document.getElementById('logout-button');
  const createTicketButton = document.getElementById('create-ticket-button');
  const createTicketModal = document.getElementById('create-ticket-modal');
  const createTicketForm = document.getElementById('create-ticket-form');
  const myTicketsDiv = document.getElementById('my-tickets');
  const filterButtons = document.querySelectorAll('.filter-button');
  const modalCloseButton = createTicketModal.querySelector('.close');
  const takePhotoButton = document.getElementById('take-photo-button');
  const ticketImageInput = document.getElementById('ticket-image');
  const imagePreviewDiv = document.getElementById('image-preview'); // Añadir en HTML si usas vista previa

  let currentUser = JSON.parse(localStorage.getItem('currentUser'));

  // Verificar si el usuario está autenticado y es encargado
  if (!currentUser || currentUser.role !== 'branch') {
    Swal.fire({
      icon: 'error',
      title: 'Acceso no autorizado',
      text: 'No tienes permiso para acceder a este panel.'
    });
    window.location.href = 'index.html';
    return;
  } else {
    loadMyTickets(); // Cargar todos los tickets inicialmente
  }

  // Cerrar sesión
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
  });

  // Abrir el modal para crear un ticket
  createTicketButton.addEventListener('click', () => {
    createTicketModal.style.display = 'block';
  });

  // Cerrar el modal al hacer clic en la 'x'
  modalCloseButton.addEventListener('click', () => {
    createTicketModal.style.display = 'none';
  });

  // Cerrar el modal al hacer clic fuera del contenido
  window.addEventListener('click', (event) => {
    if (event.target == createTicketModal) {
      createTicketModal.style.display = 'none';
    }
  });

  // Tomar foto y adjuntarla al input de imagen
  takePhotoButton.addEventListener('click', () => {
    ticketImageInput.click();
  });

  // Mostrar vista previa de la imagen seleccionada
  ticketImageInput.addEventListener('change', () => {
    const file = ticketImageInput.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreviewDiv.innerHTML = `<img src="${e.target.result}" alt="Vista Previa" />`;
      };
      reader.readAsDataURL(file);
    } else {
      imagePreviewDiv.innerHTML = '';
    }
  });

  // Crear nuevo ticket
  createTicketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('ticket-title').value.trim();
    const description = document.getElementById('ticket-description').value.trim();
    const priority = document.getElementById('ticket-priority').value;
    const imageFile = ticketImageInput.files[0];

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    if (!title || !description) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Por favor, complete todos los campos.'
      });
      return;
    }

    // Validar tamaño de la imagen
    if (imageFile && imageFile.size > MAX_FILE_SIZE) {
      Swal.fire({
        icon: 'warning',
        title: 'Imagen Demasiado Grande',
        text: 'La imagen seleccionada excede el tamaño máximo permitido de 5MB.'
      });
      return;
    }

    // Validar tipo de archivo
    if (imageFile && !imageFile.type.startsWith('image/')) {
      Swal.fire({
        icon: 'warning',
        title: 'Tipo de Archivo No Válido',
        text: 'Por favor, sube solo archivos de imagen.'
      });
      return;
    }

    try {
      Swal.fire({
        title: 'Creando Ticket...',
        text: 'Por favor, espera mientras se crea tu ticket.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Obtener el siguiente ID numérico para el ticket
      const nextId = await getNextTicketId();

      let imageUrl = null;
      if (imageFile) {
        // Comprimir y redimensionar la imagen
        imageUrl = await processAndUploadImage(imageFile, nextId);
      }

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
        empresa: currentUser.empresa,
        sucursal: currentUser.sucursal,
        assignedTo: null,
        imageUrl // Guardar la URL de la imagen si se adjuntó
      });

      Swal.fire({
        icon: 'success',
        title: 'Ticket Creado',
        text: `Ticket #${nextId} creado exitosamente.`
      });

      createTicketForm.reset();
      imagePreviewDiv.innerHTML = '';
      createTicketModal.style.display = 'none';
      // Actualizar la lista de tickets
      loadMyTickets();
    } catch (error) {
      console.error('Error al crear ticket:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Error al crear ticket: ${error.message}`
      });
    }
  });

  // Función para obtener el siguiente ID de ticket
  async function getNextTicketId() {
    const ticketsRef = collection(db, 'tickets');
    const q = query(ticketsRef, orderBy('id', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return 1;
    } else {
      const lastTicket = querySnapshot.docs[0].data();
      return lastTicket.id + 1;
    }
  }

  // Función para comprimir y redimensionar la imagen
  async function processAndUploadImage(file, ticketId) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target.result;
      };

      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; // Ancho máximo
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convertir el canvas a Blob con calidad ajustada
        canvas.toBlob(async (blob) => {
          try {
            // Crear una referencia en Firebase Storage
            const imageRef = ref(storage, `tickets/${currentUser.username}/${ticketId}_${file.name}`);

            // Subir la imagen
            await uploadBytes(imageRef, blob, { contentType: file.type });

            // Obtener la URL de descarga
            const downloadURL = await getDownloadURL(imageRef);
            resolve(downloadURL);
          } catch (uploadError) {
            console.error('Error al subir la imagen:', uploadError);
            reject(uploadError);
          }
        }, 'image/jpeg', 0.7); // Ajusta la calidad aquí (0.7 = 70%)
      };

      img.onerror = (error) => {
        console.error('Error al cargar la imagen:', error);
        reject(error);
      };

      reader.readAsDataURL(file);
    });
  }

  // Cargar los tickets del encargado
  async function loadMyTickets(statusFilter = null) {
    myTicketsDiv.innerHTML = '';

    let q = query(collection(db, 'tickets'), where('emittedBy', '==', currentUser.username));
    if (statusFilter) {
      q = query(q, where('status', '==', statusFilter));
    }

    const ticketsSnapshot = await getDocs(q);
    if (ticketsSnapshot.empty) {
      myTicketsDiv.innerHTML = '<p>No tienes tickets registrados.</p>';
      return;
    }

    // Crear la tabla
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Número de Ticket</th>
          <th>Fecha de Emisión</th>
          <th>Título</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    `;
    const tbody = table.querySelector('tbody');

    ticketsSnapshot.forEach((doc) => {
      const ticket = doc.data();
      const tr = document.createElement('tr');

      // Aplicar color según el estado
      if (ticket.status.toLowerCase() === 'abierto') {
        tr.classList.add('status-abierto');
      } else if (ticket.status.toLowerCase() === 'en proceso') {
        tr.classList.add('status-en-proceso');
      } else if (ticket.status.toLowerCase() === 'terminado') {
        tr.classList.add('status-terminado');
      }

      // Formatear fecha y hora
      const date = ticket.createdAt.toDate ? ticket.createdAt.toDate() : ticket.createdAt;
      const formattedDate = new Date(date).toLocaleString('es-ES');

      tr.innerHTML = `
        <td>${ticket.id}</td>
        <td>${formattedDate}</td>
        <td>${ticket.title}</td>
        <td>${ticket.status}</td>
        <td>
          <button class="show-ticket-button" data-id="${ticket.id}">Mostrar Ticket</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    myTicketsDiv.appendChild(table);

    // Añadir eventos a los botones de mostrar ticket
    const showTicketButtons = myTicketsDiv.querySelectorAll('.show-ticket-button');
    showTicketButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const ticketId = button.getAttribute('data-id');
        await showTicket(ticketId);
      });
    });
  }

  // Manejar los botones de filtro
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      const status = button.getAttribute('data-status');
      loadMyTickets(status);
    });
  });

  // Función para mostrar el ticket en un modal con el formato original
  async function showTicket(ticketId) {
    try {
      const ticketDoc = await getDoc(doc(db, 'tickets', ticketId));
      if (ticketDoc.exists()) {
        const ticketData = ticketDoc.data();
        const ticketHTML = generateTicketHTML(ticketData);

        Swal.fire({
          title: `Ticket #${ticketData.id}`,
          html: ticketHTML,
          width: '600px',
          showCloseButton: true,
          showCancelButton: true,
          focusConfirm: false,
          confirmButtonText: 'Descargar Ticket',
          cancelButtonText: 'Compartir Ticket'
        }).then(async (result) => {
          if (result.isConfirmed) {
            // Descargar la imagen
            await downloadTicketImage(ticketId);
          } else if (result.dismiss === Swal.DismissReason.cancel) {
            // Compartir la imagen
            await shareTicketImage(ticketId);
          }
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ticket no encontrado.'
        });
      }
    } catch (error) {
      console.error('Error al mostrar el ticket:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Error al mostrar el ticket: ${error.message}`
      });
    }
  }

  // Función para descargar la imagen del ticket
  async function downloadTicketImage(ticketId) {
    try {
      const ticketDoc = await getDoc(doc(db, 'tickets', ticketId));
      if (ticketDoc.exists()) {
        const ticketData = ticketDoc.data();
        const ticketElement = document.createElement('div');
        ticketElement.style.display = 'none'; // Ocultar el elemento
        ticketElement.innerHTML = generateTicketHTML(ticketData);
        document.body.appendChild(ticketElement);

        // Convertir el ticket a imagen
        const canvas = await html2canvas(ticketElement, { useCORS: true });
        const imgData = canvas.toDataURL('image/png');

        // Descargar la imagen
        const link = document.createElement('a');
        link.href = imgData;
        link.download = `Ticket_${ticketData.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Remover el elemento temporal
        document.body.removeChild(ticketElement);

        Swal.fire({
          icon: 'success',
          title: 'Descargado',
          text: `La imagen del Ticket #${ticketData.id} ha sido descargada exitosamente.`
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ticket no encontrado.'
        });
      }
    } catch (error) {
      console.error('Error al descargar el ticket:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Error al descargar el ticket: ${error.message}`
      });
    }
  }

  // Función para compartir la imagen del ticket usando la API Web Share
  async function shareTicketImage(ticketId) {
    if (!navigator.canShare || !navigator.canShare({ files: [] })) {
      // Alternativa: copiar la URL de la imagen al portapapeles
      try {
        const ticketDoc = await getDoc(doc(db, 'tickets', ticketId));
        if (ticketDoc.exists()) {
          const ticketData = ticketDoc.data();
          if (ticketData.imageUrl) {
            await navigator.clipboard.writeText(ticketData.imageUrl);
            Swal.fire({
              icon: 'success',
              title: 'URL Copiada',
              text: 'La URL de la imagen del ticket ha sido copiada al portapapeles.'
            });
          } else {
            Swal.fire({
              icon: 'warning',
              title: 'Sin Imagen',
              text: 'Este ticket no tiene una imagen adjunta para compartir.'
            });
          }
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ticket no encontrado.'
          });
        }
      } catch (error) {
        console.error('Error al copiar la URL:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `Error al copiar la URL: ${error.message}`
        });
      }
      return;
    }

    try {
      const ticketDoc = await getDoc(doc(db, 'tickets', ticketId));
      if (ticketDoc.exists()) {
        const ticketData = ticketDoc.data();
        if (!ticketData.imageUrl) {
          Swal.fire({
            icon: 'warning',
            title: 'Sin Imagen',
            text: 'Este ticket no tiene una imagen adjunta para compartir.'
          });
          return;
        }

        const imageURL = ticketData.imageUrl;

        // Descargar la imagen para compartir
        const response = await fetch(imageURL, { mode: 'cors' });
        const blob = await response.blob();
        const file = new File([blob], `Ticket_${ticketData.id}.png`, { type: 'image/png' });

        // Compartir usando la API Web Share
        const shareData = {
          files: [file],
          title: `Ticket #${ticketData.id}`,
          text: `Detalles del Ticket #${ticketData.id}`
        };

        await navigator.share(shareData);

        Swal.fire({
          icon: 'success',
          title: 'Compartido',
          text: `El Ticket #${ticketData.id} ha sido compartido exitosamente.`
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ticket no encontrado.'
        });
      }
    } catch (error) {
      console.error('Error al compartir el ticket:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Error al compartir el ticket: ${error.message}`
      });
    }
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
          <p><strong>Prioridad:</strong> ${ticket.priority}</p>
          <p><strong>Estado:</strong> ${ticket.status}</p>
        </div>
        ${ticket.imageUrl ? `<div class="ticket-image"><img src="${ticket.imageUrl}" alt="Imagen del Ticket"></div>` : ''}
      </div>
    </div>
    `;
  }
});
