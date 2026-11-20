/* Chat de Vitalia: conversación enviada al endpoint de IA del backend. */
(function () {
  const suggestions = [
    '¿Qué ofrece Vitalia?',
    '¿Cómo funciona una alianza con un gimnasio?',
    '¿Cómo puedo empezar?'
  ];
  const root = document.createElement('div');
  root.innerHTML = `
    <button id="chat-btn" type="button" aria-label="Abrir chat de Vitalia" aria-expanded="false">💬</button>
    <section id="chat" role="dialog" aria-label="Asistente IA de Vitalia" aria-modal="false">
      <header class="vitu-header">
        <div class="vitu-heading"><span class="vitu-name">Vitu</span><span class="vitu-subtitle">Asistente IA de Vitalia</span></div>
        <div class="vitu-controls">
          <button class="vitu-expand" type="button" aria-label="Expandir chat" aria-expanded="false" title="Expandir chat">⤢</button>
          <button class="vitu-close" type="button" aria-label="Cerrar chat">×</button>
        </div>
      </header>
      <div id="msgs" aria-live="polite" aria-relevant="additions text"></div>
      <div class="sug" aria-label="Preguntas sugeridas"></div>
      <form>
        <input name="q" maxlength="1200" placeholder="Escribe tu pregunta" aria-label="Tu pregunta" autocomplete="off" required>
        <button class="btn" type="submit">Enviar</button>
      </form>
      <p class="chat-disclaimer">Asistente con IA · No compartas datos sensibles</p>
    </section>`;
  document.body.append(root);

  const box = root.querySelector('#chat');
  const toggle = root.querySelector('#chat-btn');
  const close = root.querySelector('.vitu-close');
  const expand = root.querySelector('.vitu-expand');
  const messages = root.querySelector('#msgs');
  const form = root.querySelector('form');
  const input = form.elements.q;
  const submit = form.querySelector('[type="submit"]');
  const suggestionsBox = root.querySelector('.sug');
  let history = [];
  let busy = false;

  function appendInline(parent, text) {
    const pattern = /(\*\*[^*]+?\*\*)/g;
    let start = 0;
    for (const match of text.matchAll(pattern)) {
      parent.append(document.createTextNode(text.slice(start, match.index)));
      const element = document.createElement('strong');
      element.textContent = match[0].slice(2, -2);
      parent.append(element);
      start = match.index + match[0].length;
    }
    parent.append(document.createTextNode(text.slice(start)));
  }

  function renderAssistantMessage(element, message) {
    let text = String(message || '')
      .replace(/\\([*_])/g, '$1')
      .replace(/&#x20;|&nbsp;/gi, ' ')
      .replace(/\s+_{3,}\s*$/, '')
      .replace(/(^|[^\w])\*([^*\n]+)\*(?!\*)|_([^_\n]+)_/g, (_, prefix, a, b) => `${prefix || ''}${a || b}`)
      .trim();

    if (text.startsWith('*') && text.endsWith('*') && !text.startsWith('**') && !text.endsWith('**')) {
      text = text.slice(1, -1).trim();
    }
    text = text.replace(/[ \t]+\*\s+(?=\*\*)/g, '\n* ');

    element.replaceChildren();
    let paragraph = null;
    let list = null;
    const closeParagraph = () => { paragraph = null; };
    const closeList = () => { list = null; };

    for (const line of text.split(/\r?\n/)) {
      const bullet = line.match(/^\s*[*•-]\s+(.+)$/);
      if (!line.trim()) {
        closeParagraph();
        closeList();
      } else if (bullet) {
        closeParagraph();
        if (!list) {
          list = document.createElement('ul');
          list.className = 'chat-list';
          element.append(list);
        }
        const item = document.createElement('li');
        appendInline(item, bullet[1]);
        list.append(item);
      } else {
        closeList();
        if (!paragraph) {
          paragraph = document.createElement('p');
          element.append(paragraph);
        } else {
          paragraph.append(document.createTextNode(' '));
        }
        appendInline(paragraph, line.trim());
      }
    }
  }

  function addMessage(text, role, extraClass = '') {
    const item = document.createElement('div');
    item.className = `m ${role === 'user' ? 'me' : 'bot'} ${extraClass}`.trim();
    if (role === 'assistant' && !extraClass) renderAssistantMessage(item, text);
    else item.textContent = text;
    item.setAttribute('aria-label', role === 'user' ? 'Tu mensaje' : 'Respuesta de Vitu');
    messages.append(item);
    messages.scrollTop = messages.scrollHeight;
    return item;
  }

  function fallbackAnswer(question) {
    const text = String(question || '').toLocaleLowerCase('es');
    if (/\b(hola|buenas|buenos d\u00edas|buenas tardes|hey|saludos)\b/.test(text)) return '\u00a1Hola! Soy Vitu. \u00bfQuieres conocer Vitalia, empezar una actividad o consultar por una alianza?';
    if (/\b(gym|gimnasio|alianza|aliarme|asociarme|due\u00f1o|aliado)\b/.test(text)) return 'Los gimnasios pueden solicitar una alianza sin inversi\u00f3n inicial; el modelo contempla una comisi\u00f3n por cliente. Env\u00eda tu solicitud desde \u201cSoy due\u00f1o de gym\u201d.';
    if (/\b(precio|precios|cu\u00e1nto|cuesta|costo|tarifa|horario|horarios|sede|direcci\u00f3n)\b/.test(text)) return 'No tengo ese dato confirmado. Escr\u00edbenos desde el formulario de Contacto y el equipo de Vitalia te orientar\u00e1.';
    if (/\b(empezar|inscrib|unirme|participar|actividad|entren|servicio|ofrece|vitalia)\b/.test(text)) return 'Vitalia combina entrenamiento, alimentaci\u00f3n saludable y comunidad, con actividades que se ajustan a tus objetivos y tiempo. Para empezar, escr\u00edbenos desde el formulario de Contacto.';
    if (/\b(dolor|lesi\u00f3n|lesion|enfermedad|medic|dieta|diagn\u00f3stico|diagnostico)\b/.test(text)) return 'Puedo compartir orientaci\u00f3n general, pero no dar diagn\u00f3sticos. Consulta a un profesional de salud para recibir recomendaciones seguras.';
    return 'Puedo ayudarte con actividades, servicios o alianzas de Vitalia. Si necesitas un dato espec\u00edfico, escr\u00edbenos desde el formulario de Contacto.';
  }

  async function ask(question) {
    const content = question.trim();
    if (!content || busy) return;
    busy = true;
    toggle.setAttribute('aria-expanded', 'true');
    suggestionsBox.hidden = true;
    addMessage(content, 'user');
    const pending = addMessage('Vitu está pensando…', 'assistant', 'thinking');
    const requestMessages = [...history, { role: 'user', content }];
    input.disabled = true;
    submit.disabled = true;

    try {
      const result = await window.api.post('chat', { messages: requestMessages });
      if (typeof result.answer !== 'string' || !result.answer.trim()) {
        throw new Error('El asistente no respondió. Intenta de nuevo.');
      }
      renderAssistantMessage(pending, result.answer);
      history = [...requestMessages, { role: 'assistant', content: result.answer }].slice(-10);
    } catch (error) {
      const answer = fallbackAnswer(content);
      renderAssistantMessage(pending, answer);
      history = [...requestMessages, { role: 'assistant', content: answer }].slice(-10);
    } finally {
      busy = false;
      input.disabled = false;
      submit.disabled = false;
      input.focus();
      messages.scrollTop = messages.scrollHeight;
    }
  }

  suggestions.forEach(question => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = question;
    chip.addEventListener('click', () => ask(question));
    suggestionsBox.append(chip);
  });

  function openChat() {
    box.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    if (!messages.children.length) {
      addMessage('¡Hola! Soy Vitu, el asistente IA de Vitalia. Pregúntame sobre el emprendimiento, nuestros servicios o cómo vincular tu gimnasio.', 'assistant');
    }
    input.focus();
  }

  function closeChat() {
    box.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }

  function toggleChatSize() {
    const expanded = box.classList.toggle('expanded');
    expand.setAttribute('aria-expanded', String(expanded));
    expand.setAttribute('aria-label', expanded ? 'Reducir chat' : 'Expandir chat');
    expand.title = expanded ? 'Reducir chat' : 'Expandir chat';
    expand.textContent = expanded ? '⤡' : '⤢';
  }

  toggle.addEventListener('click', () => box.classList.contains('open') ? closeChat() : openChat());
  close.addEventListener('click', closeChat);
  expand.addEventListener('click', toggleChatSize);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const question = input.value;
    input.value = '';
    ask(question);
  });
})();
