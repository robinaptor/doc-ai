document.addEventListener('DOMContentLoaded', () => {
    const setupSection   = document.getElementById('setup-section');
    const chatSection    = document.getElementById('chat-section');
    const urlForm        = document.getElementById('url-form');
    const urlInput       = document.getElementById('doc-url');
    const urlStatus      = document.getElementById('url-status');
    const topbarStatus   = document.getElementById('topbar-status');
    const chatHistory    = document.getElementById('chat-history');
    const chatForm       = document.getElementById('chat-form');
    const userQuestion   = document.getElementById('user-question');
    const sendBtn        = document.getElementById('send-btn');
    const loadedUrlBar   = document.getElementById('loaded-url-display-bar');
    const welcomeTime    = document.getElementById('welcome-time');
    const historyList    = document.getElementById('history-list');
    const exportBtn      = document.getElementById('export-btn');

    let context = '';
    let currentUrl = '';
    let chatMemory = []; // To store conversation history

    // ─── INIT ────────────────────────────────────────────────────
    welcomeTime.textContent = now();
    loadSidebarHistory();

    // ─── LOCAL STORAGE HISTORY ───────────────────────────────────
    function loadSidebarHistory() {
        const history = JSON.parse(localStorage.getItem('docaist_history') || '[]');
        historyList.innerHTML = '';
        history.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.url.replace(/^https?:\/\//, '');
            li.addEventListener('click', () => {
                urlInput.value = item.url;
                urlForm.dispatchEvent(new Event('submit'));
            });
            historyList.appendChild(li);
        });
    }

    function saveToHistory(url) {
        let history = JSON.parse(localStorage.getItem('docaist_history') || '[]');
        // Remove if it already exists to move it to the top
        history = history.filter(item => item.url !== url);
        history.unshift({ url, date: Date.now() });
        // Keep only last 10
        if (history.length > 10) history.pop();
        localStorage.setItem('docaist_history', JSON.stringify(history));
        loadSidebarHistory();
    }

    // ─── EXPORT ──────────────────────────────────────────────────
    exportBtn.addEventListener('click', () => {
        if (chatMemory.length === 0) return;
        let content = `# DOC°AI - Chat Transcript\n**Source:** ${currentUrl}\n\n`;
        chatMemory.forEach(msg => {
            content += `### ${msg.role === 'user' ? 'Vous' : 'DOC°AI'}\n${msg.text}\n\n`;
        });
        
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `docai_transcript_${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // ─── URL INGESTION ───────────────────────────────────────────
    urlForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = urlInput.value.trim();
        if (!url) return;

        urlStatus.textContent   = '⏳ Chargement… (le navigateur invisible démarre)';
        urlStatus.className     = 'status-msg';
        const ingestBtn         = document.getElementById('ingest-btn');
        ingestBtn.disabled      = true;

        try {
            const res  = await fetch('/api/fetch-url', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ url })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur réseau');

            context = data.content;
            currentUrl = url;
            chatMemory = []; // Reset memory for new document
            saveToHistory(url);

            // Update UI state
            loadedUrlBar.textContent = url;
            exportBtn.classList.remove('hidden');
            if (topbarStatus) {
                try {
                    topbarStatus.textContent = 'Source active — ' + new URL(url).hostname;
                } catch { topbarStatus.textContent = 'Source active'; }
            }

            // Switch views
            setupSection.classList.add('hidden');
            document.getElementById('history-sidebar').classList.add('hidden');
            chatSection.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'instant' });
            userQuestion.focus();

        } catch (err) {
            urlStatus.textContent = '✗ ' + err.message;
            urlStatus.className   = 'status-msg error';
        } finally {
            ingestBtn.disabled = false;
        }
    });

    // ─── Chat ────────────────────────────────────────────────────
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const q = userQuestion.value.trim();
        if (!q || !context) return;

        addMsg(q, 'user');
        chatMemory.push({ role: 'user', text: q });
        
        userQuestion.value = '';
        autoResize(userQuestion);

        const thinkingId = 'think-' + Date.now();
        addMsg('', 'ai', thinkingId, true);
        sendBtn.disabled = true;

        try {
            const res  = await fetch('/api/chat', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ question: q, context, history: chatMemory })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur API');

            updateMsg(thinkingId, data.answer);
            chatMemory.push({ role: 'ai', text: data.answer });

        } catch (err) {
            updateMsg(thinkingId, '✗ ' + err.message);
        } finally {
            sendBtn.disabled = false;
        }
    });

    // ─── Message Helpers ─────────────────────────────────────────
    function addMsg(text, role, id = null, thinking = false) {
        const row = document.createElement('div');
        row.className = `msg ${role}-msg${thinking ? ' thinking' : ''}`;
        if (id) row.id = id;

        const sender = document.createElement('div');
        sender.className = 'msg-sender';
        sender.textContent = role === 'ai' ? 'DOC-AI' : 'VOUS';

        const body = document.createElement('div');
        body.className = 'msg-body';
        if (!thinking) body.innerHTML = renderMarkdown(text);

        const time = document.createElement('div');
        time.className = 'msg-time';
        time.textContent = now();

        row.appendChild(sender);
        row.appendChild(body);
        row.appendChild(time);
        chatHistory.appendChild(row);
        scrollBottom();
    }

    function updateMsg(id, text) {
        const row = document.getElementById(id);
        if (!row) return;
        row.classList.remove('thinking');
        const body = row.querySelector('.msg-body');
        body.innerHTML = renderMarkdown(text);
        scrollBottom();
    }

    // Simple regex markdown renderer + highlight.js integration
    function renderMarkdown(text) {
        let html = text
            // Protect against XSS initially
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // 1. Triple-backtick Code Blocks with Highlight.js
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            code = code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); // Revert entity encoding for HLJS
            if (lang && hljs.getLanguage(lang)) {
                try {
                    const highlighted = hljs.highlight(code, { language: lang }).value;
                    return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
                } catch(e) {}
            }
            // Fallback without syntax highlight
            return `<pre><code class="hljs">${hljs.highlightAuto(code).value}</code></pre>`;
        });

        // 2. Inline Code
        html = html.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

        // 3. Bold & Italic
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // 4. Headers (### Header)
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');

        // 5. Lists
        html = html.replace(/^[-•]\s+(.*)$/gm, '<li>$1</li>');
        html = html.replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>');

        // 6. Line breaks (except in or near pre/ul items)
        html = html.replace(/\n\n/g, '<br><br>');
        
        // Wrap consecutive <li> into <ul>
        html = html.replace(/(<li>.*?<\/li>)(\s*(<br>)?\s*<li>)/g, '$1$2');
        html = html.replace(/(<li>(?:.|\n)*?<\/li>)/g, '<ul>$1</ul>');
        html = html.replace(/<\/ul>\s*<ul>/g, ''); // dedupe consecutive
        html = html.replace(/<\/pre>\s*<br>/g, '</pre>'); // clean up br after code

        return html;
    }

    function now() {
        return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    function scrollBottom() {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }

    // ─── Textarea auto-resize ────────────────────────────────────
    function autoResize(el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
    userQuestion.addEventListener('input', () => autoResize(userQuestion));

    // Enter to send, Shift+Enter for newline
    userQuestion.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });
});
