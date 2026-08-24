import Swal from 'sweetalert2';

/**
 * Notificaciones de la plataforma basadas en SweetAlert2, presentadas como
 * toasts en la esquina superior derecha. Centraliza la presentación sin
 * alterar los eventos, mensajes ni disparadores de las notificaciones.
 *
 * Es no bloqueante: no captura clics fuera del toast ni requiere confirmación.
 * El temporizador se pausa al pasar el cursor sobre el toast y se reanuda al
 * retirarlo.
 */
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  timer: 4000,
  timerProgressBar: true,
  showConfirmButton: false,
  showCloseButton: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export const toast = {
  success: (message: string) => Toast.fire({ icon: 'success', title: message }),
  error: (message: string) => Toast.fire({ icon: 'error', title: message }),
  warning: (message: string) => Toast.fire({ icon: 'warning', title: message }),
  info: (message: string) => Toast.fire({ icon: 'info', title: message }),
};