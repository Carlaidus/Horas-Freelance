/* ════════════════════════════════════════════════════════════
   CRONORAS — Contenido de la página de Ayuda
   ════════════════════════════════════════════════════════════
   Edita este fichero para actualizar las preguntas y respuestas
   sin necesidad de tocar ningún otro archivo de la aplicación.

   Formato de cada entrada:
     { q: 'La pregunta', a: 'La respuesta' }

   En las respuestas puedes usar:
     **texto**  →  negrita
     \n         →  salto de línea
     \n\n       →  separación entre párrafos
   ════════════════════════════════════════════════════════════ */

const HELP_CONTENT = [

  // ── INSTALAR COMO APP ──────────────────────────────────────
  {
    id: 'install',
    title: 'Instalar como app',
    items: [
      {
        q: '¿Cómo instalo Cronoras en el móvil o tablet?',
        a: '**En iPhone / iPad (Safari):**\nToca el botón de compartir (el cuadrado con una flecha hacia arriba, en la barra inferior del navegador) y selecciona **"Añadir a pantalla de inicio"**.\n\n**En Android (Chrome):**\nToca los tres puntos del menú (arriba a la derecha) y selecciona **"Añadir a pantalla de inicio"** o **"Instalar app"**.\n\nUna vez instalada se abre como una app nativa: pantalla completa, sin barra del navegador, y con acceso directo desde el escritorio del dispositivo.'
      },
      {
        q: '¿Qué ventaja tiene instalarlo frente a abrirlo desde el navegador?',
        a: 'Al abrirlo desde el icono de la pantalla de inicio:\n\n• La interfaz ocupa toda la pantalla (sin URL, pestañas ni botones del navegador).\n• Acceso en un toque, sin buscar la web ni recordar la dirección.\n• En móvil se comporta exactamente igual que una app nativa.\n\nLos datos son los mismos — no hay diferencia de funcionalidad, solo de experiencia de uso.'
      },
      {
        q: '¿Funciona sin conexión a internet?',
        a: 'No. Cronoras necesita conexión para cargar y guardar los datos. Si pierdes la conexión en mitad de una sesión, el timer seguirá mostrándose en pantalla, pero los cambios no se sincronizarán hasta que vuelva la conexión.'
      }
    ]
  },

  // ── PLANES ─────────────────────────────────────────────────
  {
    id: 'planes',
    title: 'Plan Básico y Plan Pro',
    items: [
      {
        q: '¿Qué incluye cada plan?',
        a: '**Al registrarte:** 30 días de Pro gratis, sin tarjeta ni compromiso. Pasado ese período, la cuenta pasa automáticamente al plan Básico.\n\n**Plan Básico (gratuito):**\n• 1 proyecto activo\n• 1 empresa\n• Timer y registro de horas ✓\n• Dashboard ✓\n• Estadísticas ✗ (visible pero bloqueado)\n• Facturas y PDF ✗ (visible pero bloqueado)\n\n**Plan Pro:**\n• Proyectos y empresas ilimitados\n• Timer con múltiples slots simultáneos\n• Dashboard ✓\n• Estadísticas completas ✓\n• Gestión de facturas ✓\n• Exportación a PDF ✓'
      },
      {
        q: '¿Cuánto cuesta el plan Pro?',
        a: '• **Mensual:** 9 €/mes\n• **Trimestral:** 24 € · 8 €/mes · ahorra un 11 %\n• **Semestral:** 45 € · 7,50 €/mes · ahorra un 17 %\n• **Anual:** 85 € · 7,08 €/mes · ahorra un 22 %\n• **Vitalicio:** 200 € · pago único, sin renovaciones'
      },
      {
        q: '¿Cómo activo el plan Pro?',
        a: 'Ve a la sección **Planes**, elige el periodo que prefieras y haz clic en **"Solicitar upgrade"**.\n\nSe envía una notificación y recibirás las instrucciones de pago. Una vez confirmado el pago, el administrador activa el plan Pro en tu cuenta. El proceso es manual y directo — no hay cargo automático.'
      },
      {
        q: '¿Qué pasa cuando expira el plan Pro?',
        a: 'Tu cuenta vuelve automáticamente al plan Básico. **Tus datos no se borran** — proyectos, entradas, facturas y estadísticas siguen almacenados. Solo dejan de ser accesibles las funciones exclusivas de Pro hasta que renueves.'
      },
      {
        q: '¿Puedo cambiar de periodo (por ejemplo de mensual a anual) antes de que expire?',
        a: 'Sí. Envía una nueva solicitud desde la sección **Planes** indicando el periodo al que quieres cambiar, y el administrador lo gestiona contigo.'
      }
    ]
  },

  // ── TIMER ──────────────────────────────────────────────────
  {
    id: 'timer',
    title: 'Timer y registros de tiempo',
    items: [
      {
        q: '¿El timer sigue contando si cierro el navegador o cambio de dispositivo?',
        a: 'Sí. El timer está guardado en la nube — puedes cerrar el navegador, apagar el dispositivo o abrir la app desde otro sitio y seguirá donde lo dejaste. La app se sincroniza automáticamente cada 15 segundos entre todos tus dispositivos.'
      },
      {
        q: '¿Puedo tener varios timers corriendo a la vez?',
        a: 'Sí. En el plan Pro puedes abrir múltiples "slots" simultáneamente, uno por proyecto. En el plan Básico solo hay un slot disponible.'
      },
      {
        q: '¿Puedo editar o eliminar una entrada de tiempo ya guardada?',
        a: 'Sí. Desde la sección **"Proyecto en curso"**, pulsa sobre cualquier entrada de la lista para editarla o eliminarla.'
      },
      {
        q: '¿Cómo se guarda el tiempo al parar el timer?',
        a: 'Al pulsar **"Parar"**, la entrada se guarda automáticamente con la hora de inicio y fin real. Después puedes pulsar sobre ella para editarla: ajustar la duración, añadir notas o cambiar el proyecto.'
      }
    ]
  },

  // ── PROYECTOS Y EMPRESAS ───────────────────────────────────
  {
    id: 'proyectos',
    title: 'Proyectos y empresas',
    items: [
      {
        q: '¿Por qué no me deja crear más proyectos?',
        a: 'En el plan Básico solo puedes tener **1 proyecto activo** al mismo tiempo. Para tener más proyectos en paralelo necesitas el plan Pro.\n\nSi ya tienes un proyecto activo y quieres empezar otro, primero márcalo como completado desde su vista.'
      },
      {
        q: '¿Qué diferencia hay entre proyecto y empresa?',
        a: 'La **empresa** es el cliente: el estudio, la productora o la agencia para quien trabajas.\nEl **proyecto** es el trabajo concreto que realizas para ese cliente.\n\nUn mismo cliente puede tener varios proyectos. La relación entre ambos te permite filtrar estadísticas y facturas por cliente.'
      },
      {
        q: '¿Qué pasa con mis proyectos si me cambio al plan Básico?',
        a: 'Los datos no se borran. Todo el historial se conserva y será accesible cuando renueves el plan Pro. Con el plan Básico solo puedes tener 1 proyecto activo, pero el resto queda guardado.'
      }
    ]
  },

  // ── FACTURAS ───────────────────────────────────────────────
  {
    id: 'facturas',
    title: 'Facturas y exportación',
    items: [
      {
        q: '¿Por qué no puedo usar la sección Facturas?',
        a: 'La gestión de facturas y la exportación a PDF son funciones **exclusivas del plan Pro**. En el plan Básico puedes ver la sección en el menú, pero al entrar aparece el aviso de upgrade.'
      },
      {
        q: '¿Qué datos necesito antes de generar facturas?',
        a: 'Ve a **Ajustes** y completa tu información de facturación antes de emitir facturas:\n\n• Nombre o razón social\n• NIF / DNI\n• Dirección completa\n• IBAN (opcional, para el pie de factura)\n\nSin estos datos la factura puede generarse, pero el PDF estará incompleto.'
      },
      {
        q: '¿Puedo personalizar el número de serie de las facturas?',
        a: 'Sí. En la sección **Facturas** puedes configurar las series de numeración (por ejemplo "2025-" o "F-"). Cada serie mantiene su propio contador automático.'
      }
    ]
  },

  // ── CUENTA Y PRIVACIDAD ────────────────────────────────────
  {
    id: 'cuenta',
    title: 'Cuenta y privacidad',
    items: [
      {
        q: '¿Para qué sirve el botón "Privacidad" del menú lateral?',
        a: 'Oculta todos los importes y cifras en pantalla con un solo clic. Útil si trabajas en un espacio público, compartes pantalla o quieres hacer capturas sin exponer datos sensibles.\n\nNo borra nada — es solo visual. Al volver a pulsarlo todo vuelve a mostrarse.'
      },
      {
        q: '¿Puedo usar la misma cuenta en varios dispositivos?',
        a: 'Sí. Tus datos están en la nube. Puedes acceder desde el móvil, la tablet y el ordenador con las mismas credenciales y los datos se sincronizan en tiempo real.'
      },
      {
        q: '¿Cómo cambio mis datos o contraseña?',
        a: 'Ve a la sección **Ajustes**. Desde ahí puedes actualizar tu nombre, datos de facturación, profesión y contraseña.'
      },
      {
        q: '¿Qué son las metas de ingresos y dónde se configuran?',
        a: 'En **Ajustes → Objetivos** puedes fijar dos metas:\n\n• **Meta anual:** aparece como barómetro en el resumen del proyecto y como métrica en Estadísticas cuando el período es "Este año".\n• **Meta mensual:** aparece en la tarjeta de proyección de Estadísticas con una barra de progreso del mes en curso.'
      }
    ]
  }

];
