
export type Language = 'es' | 'en' | 'pt';

export interface Translations {
  [key: string]: {
    [key in Language]: string;
  };
}

export const translations: Translations = {
  // Navigation
  'nav.home': { es: 'Inicio', en: 'Home', pt: 'Início' },
  'nav.album': { es: 'Álbum', en: 'Album', pt: 'Álbum' },
  'nav.market': { es: 'Mercado', en: 'Market', pt: 'Mercado' },
  'nav.chat': { es: 'Chat', en: 'Chat', pt: 'Chat' },
  'nav.admin': { es: 'Admin', en: 'Admin', pt: 'Admin' },
  'nav.logout': { es: 'Salir', en: 'Logout', pt: 'Sair' },
  'nav.install': { es: 'Instalar', en: 'Install', pt: 'Instalar' },
  'nav.status': { es: 'ESTADO', en: 'STATUS', pt: 'ESTADO' },

  // Dashboard
  'dash.welcome': { es: '¡BIENVENIDO,', en: 'WELCOME,', pt: 'BEM-VINDO,' },
  'dash.completion': { es: 'Completado', en: 'Completion', pt: 'Concluído' },
  'dash.missing': { es: 'Faltantes', en: 'Missing', pt: 'Faltando' },
  'dash.repeated': { es: 'Repetidas', en: 'Repeated', pt: 'Repetidas' },
  'dash.exchanges': { es: 'Intercambios', en: 'Exchanges', pt: 'Trocas' },
  'dash.incomplete': { es: 'Incompletos', en: 'Incomplete', pt: 'Incompletos' },
  'dash.figures': { es: 'Figuras', en: 'Figures', pt: 'Figuras' },
  'dash.empty': { es: 'Vacíos', en: 'Empty', pt: 'Vazios' },
  'dash.full': { es: 'Llenos', en: 'Full', pt: 'Cheios' },
  'dash.rarity': { es: 'Rareza', en: 'Rarity', pt: 'Raridade' },
  'dash.edit_rarity': { es: 'Editar Rareza', en: 'Edit Rarity', pt: 'Editar Raridade' },
  'dash.pwa_title': { es: 'INSTALAR APP', en: 'INSTALL APP', pt: 'INSTALAR APP' },

  // Album
  'album.title': { es: 'TU COLECCIÓN', en: 'YOUR COLLECTION', pt: 'SUA COLEÇÃO' },
  'album.search': { es: 'Buscar selección...', en: 'Search team...', pt: 'Buscar seleção...' },
  'album.filter_all': { es: 'Todas', en: 'All', pt: 'Todas' },
  'album.filter_complete': { es: 'Completas', en: 'Complete', pt: 'Completas' },
  'album.filter_repeated': { es: 'Repetidas', en: 'Repeated', pt: 'Repetidas' },
  'album.filter_missing': { es: 'Faltantes', en: 'Missing', pt: 'Faltando' },
  'album.stats': { es: 'Progreso', en: 'Progress', pt: 'Progresso' },
  'album.copies': { es: 'copias', en: 'copies', pt: 'cópias' },
  'album.copy': { es: 'copia', en: 'copy', pt: 'cópia' },
  'album.owned': { es: 'Tienes', en: 'You have', pt: 'Você tem' },
  'album.select_rarity': { es: 'Selecciona color', en: 'Select color', pt: 'Selecionar cor' },

  // Marketplace
  'market.title': { es: 'MERCADO DE CAMBIOS', en: 'EXCHANGE MARKET', pt: 'MERCADO DE TROCAS' },
  'market.matches': { es: 'COINCIDENCIAS', en: 'MATCHES', pt: 'COINCIDÊNCIAS' },
  'market.no_matches': { es: 'Aún no tienes coincidencias.', en: 'No matches yet.', pt: 'Ainda não tem coincidências.' },
  'market.chat': { es: 'Chat', en: 'Chat', pt: 'Chat' },
  'market.exchange_with': { es: 'Intercambiar con', en: 'Exchange with', pt: 'Trocar com' },

  // Chat
  'chat.title': { es: 'MENSAJES', en: 'MESSAGES', pt: 'MENSAGENS' },
  'chat.type_message': { es: 'Escribe un mensaje...', en: 'Type a message...', pt: 'Digite uma mensagem...' },
  'chat.send': { es: 'Enviar', en: 'Send', pt: 'Enviar' },
  'chat.no_chats': { es: 'No tienes chats activos.', en: 'No active chats.', pt: 'Não tem chats ativos.' },

  // Admin
  'admin.title': { es: 'PANEL DE CONTROL', en: 'CONTROL PANEL', pt: 'PAINEL DE CONTROLE' },
  'admin.users': { es: 'Usuarios', en: 'Users', pt: 'Usuários' },
  'admin.approve': { es: 'Aprobar', en: 'Approve', pt: 'Aprovar' },
  'admin.reject': { es: 'Rechazar', en: 'Reject', pt: 'Rejeitar' },
};
