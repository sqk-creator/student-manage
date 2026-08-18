import './index.scss';

type MsgType = 'success' | 'error' | 'info' | 'warning';

const ICONS: Record<MsgType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '!'
};

function ensureRoot(): HTMLDivElement {
  let root = document.getElementById('app-message-root') as HTMLDivElement | null;
  if (!root) {
    root = document.createElement('div');
    root.id = 'app-message-root';
    root.className = 'app-message-root';
    document.body.appendChild(root);
  }
  return root;
}

function show(type: MsgType, content: string, duration: number = 2600) {
  const root = ensureRoot();
  const item = document.createElement('div');
  item.className = `app-message-item app-message-${type}`;
  item.innerHTML = `<span class="app-message-icon">${ICONS[type]}</span><span class="app-message-text"></span>`;
  item.querySelector('.app-message-text')!.textContent = content;
  root.appendChild(item);
  requestAnimationFrame(() => item.classList.add('app-message-in'));
  setTimeout(() => {
    item.classList.remove('app-message-in');
    item.classList.add('app-message-leave');
    setTimeout(() => item.remove(), 260);
  }, duration);
}

export const message = {
  success: (content: string, duration?: number) => show('success', content, duration),
  error: (content: string, duration?: number) => show('error', content, duration),
  info: (content: string, duration?: number) => show('info', content, duration),
  warning: (content: string, duration?: number) => show('warning', content, duration)
};
