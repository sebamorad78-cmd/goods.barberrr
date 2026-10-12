/* =====================================================================
   CONFIGURACIÓN DEL NEGOCIO
   ---------------------------------------------------------------------
   Este es el ÚNICO archivo que necesitás tocar para personalizar la web:
   nombre, servicios, precios, horarios, equipo, fotos y contacto.

   MODO: "barberia" o "salon"  → cambia colores, textos y servicios.
   Para usar tus propias fotos, guardalas en assets/fotos/ y reemplazá
   las URLs por, por ejemplo: "assets/fotos/local-1.jpg"
   ===================================================================== */
(function () {
  "use strict";

  // Estilos disponibles: "barberia", "salon", "spa" (estética) o "unas" (nail bar).
  var MODO = "barberia";

  // Muestra el panel "Personalizar demo" (para armar maquetas a medida de
  // cada local). Ponelo en false cuando entregues la web a un cliente.
  var MOSTRAR_SELECTOR_DEMO = true;

  // RESERVAS REALES (Supabase). Con "slug" vacío la web funciona como DEMO
  // (turnos guardados en el navegador, con datos de ejemplo). Para un local real:
  // poné su slug (el mismo que diste de alta en Supabase) y MOSTRAR_SELECTOR_DEMO = false.
  var BACKEND = {
    url: "https://vsecvfeejulnmvsskhbl.supabase.co",
    key: "sb_publishable_vuLnnM48fnJjc94qmNJ8cA_-2L2WkL_", // clave pública: está bien que esté en la web
    slug: ""
  };

  // TUS DATOS (quien vende la web). Aparecen en el pie y en el aviso de demo
  // para que el local pueda contactarte. Dejá whatsapp vacío para ocultarlo.
  var VENDEDOR = {
    nombre: "Sebastian Morad",
    whatsapp: "5492268516801",
    mensaje: "¡Hola Sebastian! Vi la demo de la web de turnos y me interesa para mi local.",
    email: "sebamorad46@gmail.com",
    // PRECIO del abono: se muestra en pesos al dólar oficial, con el valor en dólares al lado.
    // Actualizá "cotizacion" cada tanto (dólar oficial venta, Banco Nación).
    precioUSD: 90,
    cotizacion: 1540,
    cotizacionFuente: "dólar oficial Banco Nación",
    // Ofertas de entrada (bajan la barrera para que el local diga que sí). Poné false para ocultarlas.
    primerMesGratis: true,
    instalacionGratis: true,
    mesesRegaloAnual: 2,          // pagando 12 meses juntos, estos meses van de regalo (0 = sin oferta anual)
    precioReferenciaServicio: 15000, // corte promedio, para decir "se paga con N turnos"
    // Plan único (se muestra en vender.html). Editá lo que incluye.
    planes: [
      { nombre: "Todo incluido", periodo: "por mes", destacado: true,
        resumen: "Tu web con turnos online y todo el mantenimiento a cargo mío. Vos te ocupás de atender.",
        incluye: [
          "Web profesional con tu nombre, colores y fotos",
          "Reservas online 24/7 con cobro de seña",
          "Panel del dueño: agenda, clientes y estadísticas",
          "Recordatorios por WhatsApp con un toque desde el panel",
          "Botón de reservas en tu Instagram y Google Maps",
          "Código QR de reservas para tu mostrador y vidriera",
          "Cambios de horarios, feriados y vacaciones",
          "Altas, bajas y cambios de personal",
          "Actualización de servicios, precios, promos y fotos",
          "Hosting, seguridad y mantenimiento técnico",
          "Soporte directo por WhatsApp",
          "Atención en persona en Mar del Plata"
        ] }
    ],
    notaPlanes: "Dominio propio (.com.ar) opcional, con costo aparte según disponibilidad."
  };

  var u = function (id, w) {
    return "https://images.unsplash.com/" + id + "?auto=format&fit=crop&q=75&w=" + (w || 1200);
  };

  /* ------------------------------------------------------------------ */
  var comunes = {
    moneda: "$",
    // Duración de cada bloque del calendario (minutos)
    intervaloTurnos: 30,
    // Cuántos días hacia adelante se puede reservar
    diasReservables: 30,
    // Anticipación mínima para reservar (minutos)
    anticipacionMinima: 60,
    // 0 = domingo, 1 = lunes … 6 = sábado. Podés tener turnos cortados.
    horarios: {
      1: [["10:00", "20:00"]],
      2: [["10:00", "20:00"]],
      3: [["10:00", "20:00"]],
      4: [["10:00", "21:00"]],
      5: [["10:00", "21:00"]],
      6: [["09:00", "14:00"], ["15:00", "19:00"]],
      0: []
    },
    // Fechas puntuales cerradas (feriados, vacaciones) formato AAAA-MM-DD
    diasCerrados: ["2026-12-25", "2027-01-01"],
    // Seña para confirmar el turno (baja muchísimo las ausencias).
    sena: {
      activa: true,
      porcentaje: 20,
      alias: "tunegocio.mp",         // alias de Mercado Pago / CBU
      titular: "Tu Negocio SRL",
      linkPago: ""                   // opcional: link de pago de Mercado Pago
    },
    // PIN del panel del dueño (admin.html). Es solo para la demo: para uso
    // real hay que conectar un servidor con usuarios y contraseñas.
    pinPanel: "1234",
    ciudad: "Mar del Plata",
    mediosPago: ["Efectivo", "Débito", "Crédito", "Transferencia", "Mercado Pago"],
    // Preguntas que se suman a las de cada rubro
    faqComun: [
      { p: "¿Puedo reservar si estoy de vacaciones en Mar del Plata?", r: "¡Claro! Reservá online antes de llegar y asegurate tu lugar, sobre todo en temporada de verano y fines de semana largos." },
      { p: "¿Hay estacionamiento cerca?", r: "Hay estacionamiento medido sobre la calle y playas de estacionamiento a pocos metros. Si venís caminando por la zona, estamos a una cuadra de la avenida." }
    ],
    contacto: {
      whatsapp: "5492230000000", // código de país + número, sin + ni espacios
      telefono: "+54 9 223 000-0000",
      email: "hola@tunegocio.com",
      instagram: "tunegocio",
      direccion: "Güemes 2900, Mar del Plata",
      mapaQuery: "Güemes 2900, Mar del Plata"
    }
  };

  /* ------------------------------------------------------------------ */
  var barberia = {
    tipo: "Barbería",
    schemaTipo: "BarberShop",
    promos: [
      { etiqueta: "Membresía", titulo: "Club Imperio", texto: "2 cortes + 2 perfilados de barba por mes ($50.000 por separado), con prioridad de agenda.", precio: "$40.000 / mes" },
      { etiqueta: "Regalo", titulo: "Gift card", texto: "Regalá un corte o un Ritual Imperio. Llega por WhatsApp con un diseño listo para mandar.", precio: "Desde $15.000" },
      { etiqueta: "Martes y miércoles", titulo: "15% off antes de las 13 h", texto: "Aplicado automáticamente al pagar en el local.", precio: "Todas las semanas" }
    ],
    nombre: "Barbería Imperio",
    nombreCorto: "Imperio",
    eslogan: "Oficio, navaja y buena charla.",
    descripcion:
      "Cortes clásicos y modernos, afeitado con toalla caliente y perfilado de barba. Un lugar para sentarse, desconectar y salir impecable.",
    heroImagen: u("photo-1503951914875-452162b0f3f1", 1800),
    nosotrosImagen: u("photo-1585747860715-2ba37e788b70", 1200),
    nosotrosTitulo: "Desde 2012, el sillón es nuestro taller.",
    nosotrosTexto: [
      "Empezamos con dos sillones y una radio vieja. Hoy somos un equipo que entiende la barbería como un oficio: tijera, navaja, paciencia y oído.",
      "Trabajamos con productos seleccionados, herramientas esterilizadas en cada servicio y turnos con el tiempo justo para que nadie te apure."
    ],
    cifras: [
      { valor: 8, sufijo: "", texto: "años en el barrio" },
      { valor: 2000, prefijo: "+", sufijo: "", texto: "clientes" },
      { valor: 4.9, sufijo: "★", texto: "en Google", decimales: 1 }
    ],
    servicios: [
      { id: "corte", categoria: "Cortes", nombre: "Corte clásico", descripcion: "Tijera y máquina, lavado y peinado.", duracion: 40, precio: 15000, destacado: true },
      { id: "fade", categoria: "Cortes", nombre: "Fade / Degradé", descripcion: "Degradé a navaja con terminación prolija.", duracion: 45, precio: 17500 },
      { id: "nino", categoria: "Cortes", nombre: "Corte niño", descripcion: "Hasta 12 años.", duracion: 30, precio: 11000 },
      { id: "barba", categoria: "Barba", nombre: "Perfilado de barba", descripcion: "Diseño, rebaje y aceite hidratante.", duracion: 30, precio: 10000 },
      { id: "afeitado", categoria: "Barba", nombre: "Afeitado tradicional", descripcion: "Toalla caliente, navaja y bálsamo.", duracion: 40, precio: 14000 },
      { id: "combo", categoria: "Combos", nombre: "Corte + Barba", descripcion: "El combo de la casa.", duracion: 70, precio: 22500, destacado: true },
      { id: "ritual", categoria: "Combos", nombre: "Ritual Imperio", descripcion: "Corte, afeitado, limpieza facial y bebida.", duracion: 100, precio: 32500 },
      { id: "color", categoria: "Extras", nombre: "Color / Canas", descripcion: "Camuflaje de canas o color fantasía.", duracion: 60, precio: 20000 },
      { id: "cejas", categoria: "Extras", nombre: "Cejas", descripcion: "Perfilado con navaja o hilo.", duracion: 15, precio: 5000 }
    ],
    equipo: [
      { id: "martin", nombre: "Martín", rol: "Fundador · Clásicos y navaja", foto: u("photo-1507003211169-0a1dd7228f2d", 700), servicios: "todos" },
      { id: "leo", nombre: "Leo", rol: "Fades y diseños", foto: u("photo-1500648767791-00dcc994a43e", 700), servicios: ["corte", "fade", "nino", "barba", "combo", "cejas"] },
      { id: "nico", nombre: "Nico", rol: "Barba y afeitado", foto: u("photo-1506794778202-cad84cf45f1d", 700), servicios: ["corte", "barba", "afeitado", "combo", "ritual", "color"] }
    ],
    galeria: [
      { src: u("photo-1585747860715-2ba37e788b70"), alt: "Sillón de barbería" },
      { src: u("photo-1621605815971-fbc98d665033"), alt: "Corte en proceso" },
      { src: u("photo-1599351431202-1e0f0137899a"), alt: "Barbero trabajando" },
      { src: u("photo-1622286342621-4bd786c2447c"), alt: "Herramientas de barbería" },
      { src: u("photo-1605497788044-5a32c7078486"), alt: "Detalle de corte" },
      { src: u("photo-1512690459411-b9245aed614b"), alt: "Interior del local" }
    ],
    testimonios: [
      { texto: "El mejor fade que me hicieron. Puntuales con el turno y una onda bárbara.", autor: "Juan P.", estrellas: 5 },
      { texto: "El afeitado con toalla caliente es otra cosa. Vuelvo todos los meses.", autor: "Diego R.", estrellas: 5 },
      { texto: "Reservé desde el celu en un minuto. Llegué y me atendieron en el horario exacto.", autor: "Tomás G.", estrellas: 5 }
    ],
    faq: [
      { p: "¿Cómo cancelo o cambio mi turno?", r: "Escribinos por WhatsApp con al menos 3 horas de anticipación y lo reprogramamos sin cargo." },
      { p: "¿Qué medios de pago aceptan?", r: "Efectivo, débito, crédito, transferencia y Mercado Pago." },
      { p: "¿Atienden sin turno?", r: "Sí, si hay un hueco libre. Pero con turno te asegurás no esperar." },
      { p: "¿Qué pasa si llego tarde?", r: "Tenemos 10 minutos de tolerancia. Después puede que debamos acortar el servicio o reprogramar." }
    ]
  };

  /* ------------------------------------------------------------------ */
  var salon = {
    tipo: "Salón de belleza",
    schemaTipo: "BeautySalon",
    promos: [
      { etiqueta: "Novias", titulo: "Paquete novia", texto: "Prueba de peinado y maquillaje + día del evento, con atención a domicilio opcional.", precio: "Consultar" },
      { etiqueta: "Regalo", titulo: "Gift card", texto: "El regalo que nunca falla. Elegí monto o servicio y lo enviamos por WhatsApp.", precio: "Desde $15.000" },
      { etiqueta: "Primera visita", titulo: "10% off en color", texto: "En tu primer servicio de color, con diagnóstico gratuito incluido.", precio: "Nuevas clientas" }
    ],
    nombre: "Maison Lumière",
    nombreCorto: "Lumière",
    eslogan: "Belleza que se toma su tiempo.",
    descripcion:
      "Cortes, color, peinados, uñas y tratamientos en un espacio luminoso pensado para que te relajes. Reservá tu momento en segundos.",
    heroImagen: u("photo-1560066984-138dadb4c035", 1800),
    nosotrosImagen: u("photo-1522337360788-8b13dee7a37e", 1200),
    nosotrosTitulo: "Un salón donde el tiempo es tuyo.",
    nosotrosTexto: [
      "Creamos Lumière para que ir a la peluquería deje de ser un trámite. Escuchamos, asesoramos y trabajamos con calma.",
      "Usamos marcas profesionales, coloración libre de amoníaco y protocolos de higiene estrictos en cada estación."
    ],
    cifras: [
      { valor: 9, sufijo: "", texto: "años de trayectoria" },
      { valor: 1800, prefijo: "+", sufijo: "", texto: "clientas" },
      { valor: 4.9, sufijo: "★", texto: "en Google", decimales: 1 }
    ],
    servicios: [
      { id: "corte", categoria: "Cabello", nombre: "Corte y brushing", descripcion: "Diagnóstico, lavado, corte y secado.", duracion: 60, precio: 27500, destacado: true },
      { id: "brushing", categoria: "Cabello", nombre: "Brushing", descripcion: "Lavado y secado con forma.", duracion: 40, precio: 15000 },
      { id: "peinado", categoria: "Cabello", nombre: "Peinado de evento", descripcion: "Recogidos, ondas y semirecogidos.", duracion: 60, precio: 35000 },
      { id: "color", categoria: "Color", nombre: "Color global", descripcion: "Tintura completa + matizador.", duracion: 120, precio: 47500 },
      { id: "balayage", categoria: "Color", nombre: "Balayage", descripcion: "Iluminación a mano alzada.", duracion: 180, precio: 81000, destacado: true },
      { id: "nutricion", categoria: "Tratamientos", nombre: "Nutrición profunda", descripcion: "Hidratación intensiva con ampolla.", duracion: 45, precio: 22500 },
      { id: "alisado", categoria: "Tratamientos", nombre: "Alisado / Keratina", descripcion: "Libre de formol.", duracion: 150, precio: 69000 },
      { id: "manicura", categoria: "Uñas", nombre: "Manicura semipermanente", descripcion: "Esmaltado que dura hasta 3 semanas.", duracion: 60, precio: 19000 },
      { id: "esculpidas", categoria: "Uñas", nombre: "Uñas esculpidas", descripcion: "Gel o acrílico, diseño simple.", duracion: 90, precio: 30000 },
      { id: "cejas", categoria: "Rostro", nombre: "Perfilado de cejas", descripcion: "Diseño con pinza o hilo.", duracion: 20, precio: 9000 },
      { id: "lifting", categoria: "Rostro", nombre: "Lifting de pestañas", descripcion: "Curvatura y tinte.", duracion: 60, precio: 25000 }
    ],
    equipo: [
      { id: "sofia", nombre: "Sofía", rol: "Directora · Color y balayage", foto: u("photo-1494790108377-be9c29b29330", 700), servicios: ["corte", "brushing", "color", "balayage", "nutricion", "alisado", "peinado"] },
      { id: "valen", nombre: "Valentina", rol: "Cortes y peinados", foto: u("photo-1534528741775-53994a69daeb", 700), servicios: ["corte", "brushing", "peinado", "nutricion", "alisado"] },
      { id: "cami", nombre: "Camila", rol: "Uñas, cejas y pestañas", foto: u("photo-1544005313-94ddf0286df2", 700), servicios: ["manicura", "esculpidas", "cejas", "lifting"] }
    ],
    galeria: [
      { src: u("photo-1560066984-138dadb4c035"), alt: "Interior del salón" },
      { src: u("photo-1562322140-8baeececf3df"), alt: "Peinado terminado" },
      { src: u("photo-1604654894610-df63bc536371"), alt: "Manicura" },
      { src: u("photo-1522337360788-8b13dee7a37e"), alt: "Estilista trabajando" },
      { src: u("photo-1487412947147-5cebf100ffc2"), alt: "Maquillaje" },
      { src: u("photo-1516975080664-ed2fc6a32937"), alt: "Estaciones del salón" }
    ],
    testimonios: [
      { texto: "Sofía entendió exactamente el tono que quería. El balayage quedó soñado.", autor: "Lucía M.", estrellas: 5 },
      { texto: "Un lugar hermoso y súper prolijo. Las uñas me duraron casi un mes.", autor: "Carla F.", estrellas: 5 },
      { texto: "Reservar online es comodísimo y siempre respetan el horario.", autor: "Agustina B.", estrellas: 5 }
    ],
    faq: [
      { p: "¿Cómo cancelo o cambio mi turno?", r: "Escribinos por WhatsApp con al menos 6 horas de anticipación y lo reprogramamos sin cargo." },
      { p: "¿Hacen prueba de color?", r: "Sí, para trabajos de color recomendamos una consulta previa gratuita de 15 minutos." },
      { p: "¿Qué medios de pago aceptan?", r: "Efectivo, débito, crédito, transferencia y Mercado Pago." },
      { p: "¿Atienden novias y eventos?", r: "Sí. Escribinos para armar un paquete a medida con prueba incluida." }
    ]
  };


  /* ------------------------------------------------------------------ */
  var spa = {
    tipo: "Spa & estética",
    schemaTipo: "DaySpa",
    nombre: "Salvia Spa",
    nombreCorto: "Salvia",
    eslogan: "Una pausa para volver a vos.",
    descripcion: "Masajes, tratamientos faciales y corporales en un ambiente sereno. Profesionales matriculadas y productos dermatológicos.",
    heroImagen: u("photo-1540555700478-4be289fbecef", 1800),
    nosotrosImagen: u("photo-1544161515-4ab6ce6db874", 1200),
    nosotrosTitulo: "Bienestar con criterio profesional.",
    nosotrosTexto: [
      "Salvia nació de una idea simple: que cuidarse no sea un lujo ocasional sino un hábito posible.",
      "Cada tratamiento comienza con una evaluación personalizada. Trabajamos con aparatología habilitada y protocolos de bioseguridad."
    ],
    cifras: [
      { valor: 6, sufijo: "", texto: "años de experiencia" },
      { valor: 1200, prefijo: "+", sufijo: "", texto: "clientas" },
      { valor: 4.9, sufijo: "★", texto: "en Google", decimales: 1 }
    ],
    servicios: [
      { id: "descontracturante", categoria: "Masajes", nombre: "Masaje descontracturante", descripcion: "Espalda, cuello y hombros.", duracion: 50, precio: 30000, destacado: true },
      { id: "relajante", categoria: "Masajes", nombre: "Masaje relajante", descripcion: "Cuerpo completo con aceites esenciales.", duracion: 60, precio: 32500 },
      { id: "piedras", categoria: "Masajes", nombre: "Piedras calientes", descripcion: "Basalto volcánico y aromaterapia.", duracion: 75, precio: 40000 },
      { id: "limpieza", categoria: "Facial", nombre: "Limpieza facial profunda", descripcion: "Extracción, máscara y alta frecuencia.", duracion: 60, precio: 27500, destacado: true },
      { id: "dermaplaning", categoria: "Facial", nombre: "Dermaplaning", descripcion: "Exfoliación y luminosidad inmediata.", duracion: 45, precio: 25000 },
      { id: "peeling", categoria: "Facial", nombre: "Peeling químico", descripcion: "Manchas, textura y poros.", duracion: 40, precio: 35000 },
      { id: "drenaje", categoria: "Corporal", nombre: "Drenaje linfático", descripcion: "Técnica manual Vodder.", duracion: 60, precio: 31000 },
      { id: "madero", categoria: "Corporal", nombre: "Maderoterapia", descripcion: "Modelado y reducción de medidas.", duracion: 50, precio: 29000 },
      { id: "dayspa", categoria: "Experiencias", nombre: "Day spa", descripcion: "Masaje + facial + infusión. Para regalar.", duracion: 150, precio: 55000 }
    ],
    equipo: [
      { id: "ines", nombre: "Inés", rol: "Cosmiatra · Faciales", foto: u("photo-1438761681033-6461ffad8d80", 700), servicios: ["limpieza", "dermaplaning", "peeling", "dayspa"] },
      { id: "flor", nombre: "Florencia", rol: "Masoterapeuta", foto: u("photo-1508214751196-bcfd4ca60f91", 700), servicios: ["descontracturante", "relajante", "piedras", "drenaje", "madero", "dayspa"] },
      { id: "marina", nombre: "Marina", rol: "Kinesióloga · Corporales", foto: u("photo-1531123897727-8f129e1688ce", 700), servicios: ["descontracturante", "drenaje", "madero"] }
    ],
    galeria: [
      { src: u("photo-1540555700478-4be289fbecef"), alt: "Sala de masajes" },
      { src: u("photo-1570172619644-dfd03ed5d881"), alt: "Tratamiento facial" },
      { src: u("photo-1515377905703-c4788e51af15"), alt: "Piedras calientes" },
      { src: u("photo-1600334089648-b0d9d3028eb2"), alt: "Ambiente del spa" },
      { src: u("photo-1544161515-4ab6ce6db874"), alt: "Masaje" },
      { src: u("photo-1519823551278-64ac92734fb1"), alt: "Detalle de tratamiento" }
    ],
    testimonios: [
      { texto: "Salí como nueva. El descontracturante de Florencia es increíble.", autor: "Paula S.", estrellas: 5 },
      { texto: "Me hicieron una evaluación de piel súper completa antes de empezar.", autor: "Romina L.", estrellas: 5 },
      { texto: "Regalé un day spa a mi mamá y quedó encantada.", autor: "Martina V.", estrellas: 5 }
    ],
    faq: [
      { p: "¿Necesito llevar algo?", r: "No, te damos bata, toalla y pantuflas. Te recomendamos llegar 10 minutos antes." },
      { p: "¿Puedo atenderme embarazada?", r: "Sí, con tratamientos adaptados. Avisanos al reservar para asignarte la profesional indicada." },
      { p: "¿Cómo cancelo o cambio mi turno?", r: "Con 24 h de anticipación la seña queda a favor para tu próximo turno." },
      { p: "¿Tienen gift cards?", r: "Sí, de cualquier servicio o monto. Se envían por WhatsApp o impresas." }
    ],
    promos: [
      { etiqueta: "Pack", titulo: "4 sesiones corporales", texto: "Maderoterapia o drenaje: llevá 4 y pagá 3. Válido por 60 días.", precio: "Desde $87.000" },
      { etiqueta: "Regalo", titulo: "Gift card Day Spa", texto: "La experiencia completa, lista para regalar con tarjeta digital.", precio: "$55.000" },
      { etiqueta: "De a dos", titulo: "Masaje en pareja", texto: "Sala doble, misma hora, con espumante de cortesía.", precio: "20% off" }
    ]
  };

  /* ------------------------------------------------------------------ */
  var unas = {
    tipo: "Nail bar",
    schemaTipo: "NailSalon",
    nombre: "Nude Nail Bar",
    nombreCorto: "Nude",
    eslogan: "Manos que hablan por vos.",
    descripcion: "Semipermanente, esculpidas, kapping y nail art con diseños propios. Esterilización en autoclave y turnos puntuales.",
    heroImagen: u("photo-1604654894610-df63bc536371", 1800),
    nosotrosImagen: u("photo-1610992015732-2449b76344bc", 1200),
    nosotrosTitulo: "Detalle, prolijidad y diseño.",
    nosotrosTexto: [
      "Somos un nail bar con identidad propia: cada set se piensa para tus manos, tu estilo y tu rutina.",
      "Trabajamos con geles de primera línea, limas descartables y materiales esterilizados en autoclave."
    ],
    cifras: [
      { valor: 5, sufijo: "", texto: "años creando sets" },
      { valor: 1500, prefijo: "+", sufijo: "", texto: "clientas" },
      { valor: 4.8, sufijo: "★", texto: "en Google", decimales: 1 }
    ],
    servicios: [
      { id: "semi", categoria: "Manos", nombre: "Semipermanente", descripcion: "Esmaltado que dura hasta 21 días.", duracion: 60, precio: 17500, destacado: true },
      { id: "kapping", categoria: "Manos", nombre: "Kapping gel", descripcion: "Refuerzo sobre uña natural.", duracion: 75, precio: 21000 },
      { id: "esculpidas", categoria: "Manos", nombre: "Esculpidas en gel", descripcion: "Largo y forma a elección.", duracion: 120, precio: 32500, destacado: true },
      { id: "service", categoria: "Manos", nombre: "Service de esculpidas", descripcion: "Relleno y nuevo esmaltado.", duracion: 90, precio: 25000 },
      { id: "nailart", categoria: "Diseño", nombre: "Nail art", descripcion: "Diseño a mano alzada (por set).", duracion: 30, precio: 7500 },
      { id: "retiro", categoria: "Diseño", nombre: "Retiro", descripcion: "Retiro cuidadoso + hidratación.", duracion: 20, precio: 5000 },
      { id: "pedi", categoria: "Pies", nombre: "Pedicura spa", descripcion: "Exfoliación, cutículas y semipermanente.", duracion: 75, precio: 24000 },
      { id: "combo", categoria: "Combos", nombre: "Manos + pies", descripcion: "Semipermanente en manos y pies.", duracion: 120, precio: 37500 }
    ],
    equipo: [
      { id: "abril", nombre: "Abril", rol: "Fundadora · Esculpidas", foto: u("photo-1517841905240-472988babdf9", 700), servicios: "todos" },
      { id: "juli", nombre: "Julieta", rol: "Nail art y diseño", foto: u("photo-1534528741775-53994a69daeb", 700), servicios: ["semi", "kapping", "nailart", "retiro", "service"] },
      { id: "mica", nombre: "Micaela", rol: "Pedicura y kapping", foto: u("photo-1544005313-94ddf0286df2", 700), servicios: ["semi", "kapping", "retiro", "pedi", "combo"] }
    ],
    galeria: [
      { src: u("photo-1604654894610-df63bc536371"), alt: "Semipermanente nude" },
      { src: u("photo-1610992015732-2449b76344bc"), alt: "Esculpidas" },
      { src: u("photo-1632345031435-8727f6897d53"), alt: "Nail art" },
      { src: u("photo-1519014816548-bf5fe059798b"), alt: "Manicura" },
      { src: u("photo-1607779097040-26e80aa78e66"), alt: "Colores de temporada" },
      { src: u("photo-1522337660859-02fbefca4702"), alt: "Estación de trabajo" }
    ],
    testimonios: [
      { texto: "Las esculpidas me duraron un mes perfectas. Abril es una artista.", autor: "Sol R.", estrellas: 5 },
      { texto: "Lugar hermoso, todo esterilizado y súper puntuales.", autor: "Belén C.", estrellas: 5 },
      { texto: "Mandé una foto de inspiración y quedaron idénticas.", autor: "Jazmín T.", estrellas: 5 }
    ],
    faq: [
      { p: "¿Puedo llevar una foto de inspiración?", r: "¡Sí! Mandala por WhatsApp al reservar y te confirmamos tiempo y precio del diseño." },
      { p: "¿Cuánto dura el semipermanente?", r: "Entre 15 y 21 días según el crecimiento y el cuidado de tus uñas." },
      { p: "¿Cómo cancelo o cambio mi turno?", r: "Con 12 h de anticipación la seña queda a favor para tu próximo turno." },
      { p: "¿Tienen garantía?", r: "Si algo se levanta en las primeras 72 h, lo reparamos sin cargo." }
    ],
    promos: [
      { etiqueta: "Fidelidad", titulo: "Tu 6° service, gratis", texto: "Sumá sellos digitales en cada visita y canjealos cuando quieras.", precio: "Club Nude" },
      { etiqueta: "Regalo", titulo: "Gift card", texto: "Regalá un set completo o elegí el monto. Llega por WhatsApp.", precio: "Desde $17.500" },
      { etiqueta: "Amigas", titulo: "Vení con una amiga", texto: "Reservando dos turnos a la misma hora, 15% off para las dos.", precio: "15% off" }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* Personalización por link: ?modo=salon&nombre=...&color=%23aa3355&wa=...
     Así podés mandarle a cada local una maqueta con su nombre sin tocar código. */
  var q = {};
  try { new URLSearchParams(location.search).forEach(function (v, k) { q[k] = v.trim(); }); } catch (e) {}
  var MODOS = { barberia: barberia, salon: salon, spa: spa, unas: unas };
  // Las páginas por rubro (/unas/, /spa/…) fijan su modo con window.__MODO__
  if (MODOS[window.__MODO__]) MODO = window.__MODO__;
  if (MODOS[q.modo]) MODO = q.modo;
  if (!MODOS[MODO]) MODO = "barberia";

  var base = MODOS[MODO];
  var cfg = {};
  Object.keys(comunes).forEach(function (k) { cfg[k] = comunes[k]; });
  Object.keys(base).forEach(function (k) { cfg[k] = base[k]; });
  cfg.contacto = Object.assign({}, comunes.contacto);
  cfg.modo = MODO;

  if (q.nombre) { cfg.nombre = q.nombre.slice(0, 60); cfg.nombreCorto = cfg.nombre; }
  if (q.eslogan) cfg.eslogan = q.eslogan.slice(0, 80);
  if (q.wa) cfg.contacto.whatsapp = q.wa.replace(/\D/g, "");
  if (q.tel) cfg.contacto.telefono = q.tel.slice(0, 40);
  if (q.dir) { cfg.contacto.direccion = q.dir.slice(0, 120); cfg.contacto.mapaQuery = cfg.contacto.direccion; }
  if (q.ig) cfg.contacto.instagram = q.ig.replace(/^@/, "").replace(/[^\w.]/g, "");
  // Ajuste de precios en % (ej: ajuste=15 sube 15%, ajuste=-10 baja 10%)
  var aj = parseFloat(q.ajuste);
  if (aj && aj > -90 && aj < 500) {
    cfg.servicios = cfg.servicios.map(function (sv) {
      var c = Object.assign({}, sv);
      c.precio = Math.round(sv.precio * (1 + aj / 100) / 500) * 500;
      return c;
    });
  }
  if (q.moneda) cfg.moneda = q.moneda.slice(0, 4);
  cfg.sena = Object.assign({}, comunes.sena);
  if (q.sena === "0") cfg.sena.activa = false;
  if (q.alias) cfg.sena.alias = q.alias.slice(0, 40);
  if (/^#?[0-9a-f]{6}$/i.test(q.color || "")) cfg.color = "#" + q.color.replace("#", "");

  // "limpio=1" oculta el panel de edición: es el link que le mandás al local.
  cfg.mostrarSelectorDemo = MOSTRAR_SELECTOR_DEMO && q.limpio !== "1";
  cfg.esDemo = MOSTRAR_SELECTOR_DEMO;
  cfg.vendedor = VENDEDOR;
  cfg.backend = BACKEND.slug ? BACKEND : null;
  if (cfg.backend) cfg.esDemo = false;
  cfg.faq = (base.faq || []).concat(comunes.faqComun || []);
  cfg.params = q;
  // Prefijo hasta la raíz del sitio ("" en la raíz, "../" en /unas/, etc.)
  cfg.root = window.__ROOT__ || "";
  // Fotos propias con ruta relativa ("assets/fotos/x.jpg") funcionan desde cualquier carpeta
  var fix = function (src) { return /^(https?:|data:|\/)/.test(src || "") ? src : cfg.root + src; };
  cfg.heroImagen = fix(cfg.heroImagen);
  cfg.nosotrosImagen = fix(cfg.nosotrosImagen);
  cfg.galeria = cfg.galeria.map(function (g) { return Object.assign({}, g, { src: fix(g.src) }); });
  cfg.equipo = cfg.equipo.map(function (p) { return Object.assign({}, p, { foto: fix(p.foto) }); });

  window.__NEGOCIO__ = cfg;
})();
