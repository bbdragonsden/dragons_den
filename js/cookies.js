// cookies.html: borra lo que guarda esta web en el navegador (mismo
// almacenamiento que usa el aviso de la portada: localStorage).
(function () {
  'use strict';
  var btn = document.getElementById('btn-borrar');
  var msg = document.getElementById('borrar-msg');
  if (!btn) return;
  btn.addEventListener('click', function () {
    try {
      localStorage.removeItem('dd_aviso_cookies');
      localStorage.removeItem('dd_cookies'); // banner anterior
    } catch (e) { /* almacenamiento bloqueado: no hay nada que borrar */ }
    // Por si alguna versión antigua llegó a crear una cookie con ese nombre.
    document.cookie = 'dd_cookies=; Max-Age=0; path=/; SameSite=Lax';
    msg.textContent = 'Hecho. La próxima vez que entres en la portada volverás a ver el aviso.';
  });
})();
