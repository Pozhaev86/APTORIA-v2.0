
// pusher-sync.js
const PUSHER_CONFIG = {
  key: 'dd8bccb765fe5fd9cffa',
  cluster: 'eu',
  forceTLS: true,
  authEndpoint: '/api/pusher-auth'
};

class PusherSync {
  constructor() {
    this.pusher = null;
    this.channel = null;
    this.sessionId = Math.random().toString(36).substr(2, 9);
    this.isInitialized = false;
    this.pendingChanges = new Set();
    this.status = 'disconnected';
    
    this.init();
  }
  
  init() {
    if (typeof Pusher === 'undefined') {
      console.warn('Pusher not loaded yet');
      setTimeout(() => this.init(), 1000);
      return;
    }
    
    try {
      this.pusher = new Pusher(PUSHER_CONFIG.key, {
        cluster: PUSHER_CONFIG.cluster,
        authEndpoint: PUSHER_CONFIG.authEndpoint,
        forceTLS: PUSHER_CONFIG.forceTLS
      });
      
      this.setupConnectionListeners();
      this.subscribeToChannels();
      this.isInitialized = true;
      
      console.log('✅ Pusher initialized');
    } catch (error) {
      console.error('❌ Pusher init error:', error);
      this.updateStatus('error');
    }
  }
  
  updateStatus(status) {
    this.status = status;
    window.dispatchEvent(new CustomEvent('pusher-status-change', {
      detail: { status }
    }));
  }
  
  setupConnectionListeners() {
    this.pusher.connection.bind('connected', () => {
      console.log('🔗 Connected to Pusher');
      this.updateStatus('connected');
      this.showStatus('Соединение установлено', 'success');
    });
    
    this.pusher.connection.bind('disconnected', () => {
      console.log('🔌 Disconnected from Pusher');
      this.updateStatus('disconnected');
      this.showStatus('Соединение потеряно', 'error');
    });

    this.pusher.connection.bind('error', () => {
      this.updateStatus('error');
    });
  }
  
  subscribeToChannels() {
    // Основной канал для данных приложения
    this.channel = this.pusher.subscribe('aptoria-finance-data');
    
    this.channel.bind('data-update', (data) => {
      console.log('📥 Received data update:', data);
      this.handleDataUpdate(data);
    });
    
    this.channel.bind('full-sync', (data) => {
      console.log('🔄 Received full sync');
      this.handleFullSync(data);
    });
    
    this.channel.bind('transaction-added', (data) => {
      this.handleTransactionUpdate(data, 'added');
    });
    
    this.channel.bind('transaction-deleted', (data) => {
      this.handleTransactionUpdate(data, 'deleted');
    });
  }
  
  handleDataUpdate(data) {
    // Игнорируем собственные сообщения
    if (data.senderId === this.sessionId) return;
    
    this.showStatus(`Получены обновления: ${data.type}`, 'info');
    
    // Отправляем событие для React компонентов
    window.dispatchEvent(new CustomEvent('pusher-data-update', {
      detail: data
    }));
  }
  
  handleFullSync(data) {
    if (data.senderId === this.sessionId) return;
    
    if (confirm('Получены новые данные из облака. Загрузить?')) {
      // Обновляем localStorage
      if (data.users) localStorage.setItem('aptoria_users', JSON.stringify(data.users));
      if (data.transactions) localStorage.setItem('aptoria_transactions', JSON.stringify(data.transactions));
      if (data.locations) localStorage.setItem('aptoria_locations', JSON.stringify(data.locations));
      if (data.categories) localStorage.setItem('aptoria_categories', JSON.stringify(data.categories));
      
      // Перезагружаем страницу для применения изменений
      setTimeout(() => location.reload(), 1000);
    }
  }
  
  handleTransactionUpdate(data, action) {
    if (data.senderId === this.sessionId) return;
    
    window.dispatchEvent(new CustomEvent('pusher-transaction-update', {
      detail: { data, action }
    }));
  }
  
  async sendDataUpdate(type, payload, options = {}) {
    if (!this.isInitialized) {
      console.warn('Pusher not initialized');
      return false;
    }
    
    try {
      const data = {
        type,
        payload,
        senderId: this.sessionId,
        timestamp: new Date().toISOString(),
        ...options
      };
      
      // Показываем индикатор отправки
      this.showStatus('📤 Отправляем данные...', 'sending');
      
      const response = await fetch('/api/pusher-trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pusher-Key': 'aptoria-secret-key' // добавьте в Vercel env
        },
        body: JSON.stringify({
          channel: 'aptoria-finance-data',
          event: 'data-update',
          data: data
        })
      });
      
      if (response.ok) {
        this.showStatus('✅ Данные отправлены', 'success');
        return true;
      } else {
        this.showStatus('❌ Ошибка отправки', 'error');
        return false;
      }
    } catch (error) {
      console.error('Send error:', error);
      this.showStatus('❌ Ошибка сети', 'error');
      return false;
    }
  }
  
  async sendFullSync() {
    if (!this.isInitialized) return false;
    
    const allData = {
      users: JSON.parse(localStorage.getItem('aptoria_users') || '[]'),
      transactions: JSON.parse(localStorage.getItem('aptoria_transactions') || '[]'),
      locations: JSON.parse(localStorage.getItem('aptoria_locations') || '[]'),
      categories: JSON.parse(localStorage.getItem('aptoria_categories') || '{}'),
      senderId: this.sessionId,
      timestamp: new Date().toISOString()
    };
    
    try {
      this.showStatus('🔄 Синхронизируем все данные...', 'sending');
      
      const response = await fetch('/api/pusher-trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pusher-Key': 'aptoria-secret-key'
        },
        body: JSON.stringify({
          channel: 'aptoria-finance-data',
          event: 'full-sync',
          data: allData
        })
      });
      
      if (response.ok) {
        this.showStatus('✅ Все данные синхронизированы', 'success');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Full sync error:', error);
      return false;
    }
  }
  
  showStatus(message, type = 'info') {
    // Создаем или находим индикатор
    let indicator = document.getElementById('pusher-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'pusher-indicator';
      indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        transition: all 0.3s ease;
        transform: translateY(100px);
        opacity: 0;
      `;
      document.body.appendChild(indicator);
    }
    
    // Цвета в зависимости от типа
    const colors = {
      info: { bg: '#3B82F6', color: 'white' },
      success: { bg: '#10B981', color: 'white' },
      error: { bg: '#EF4444', color: 'white' },
      sending: { bg: '#F59E0B', color: 'white' }
    };
    
    const color = colors[type] || colors.info;
    
    // Иконка в зависимости от типа
    const icons = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      sending: '🔄'
    };
    
    indicator.innerHTML = `
      <span style="font-size: 16px">${icons[type] || icons.info}</span>
      <span>${message}</span>
    `;
    
    indicator.style.background = color.bg;
    indicator.style.color = color.color;
    
    // Показываем с анимацией
    setTimeout(() => {
      indicator.style.transform = 'translateY(0)';
      indicator.style.opacity = '1';
    }, 10);
    
    // Автоматически скрываем через 3 секунды
    setTimeout(() => {
      indicator.style.transform = 'translateY(100px)';
      indicator.style.opacity = '0';
    }, 3000);
  }
  
  // Метод для ручной отправки изменений
  async syncData(key, value) {
    return this.sendDataUpdate('storage-update', { key, value });
  }
}

// Глобальный экземпляр
window.pusherSync = new PusherSync();
