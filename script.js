// =======================================================
// VARIÁVEIS GLOBAIS E CONFIGURAÇÃO
// =======================================================
// !!! SUBSTITUIR ESTE URL PELO SEU NOVO URL DA WEB APP DO GOOGLE APPS SCRIPT !!!
const API_URL = 'https://script.google.com/macros/s/AKfycbzTrRTrH8ZeTl5J6azKU2yZbQ_GYNiicl2w9bAreHLFfw8MNrrNs9xSl-gNfHPeOeXj7Q/exec'; 

let meuPedidoId = localStorage.getItem('kriolthink_pedido_id') || null;
let filaDePedidos = [];


// =======================================================
// FUNÇÕES DE COMUNICAÇÃO (JSONP)
// =======================================================

/**
 * Função de callback global para receber os dados de Leitura (GET).
 * O Google Apps Script irá chamar esta função.
 * @param {Array<Object>} data - A lista de pedidos.
 */
function handlePedidos(data) {
    // Converte IDs e Timestamps para número
    filaDePedidos = data.map(p => ({
        ...p,
        id: String(p.id),
        timestamp: p.timestamp ? parseInt(p.timestamp) : 0 
    }));
    
    // Atualiza ambas as interfaces
    atualizarInterfaceParticipante();
    atualizarInterfaceModerador();

    // Remove o elemento script injetado para limpar o DOM
    const scriptElement = document.getElementById('jsonpScript');
    if (scriptElement) {
        scriptElement.remove();
    }
}

/**
 * Lê a fila de pedidos do Google Sheets usando JSONP.
 */
function getPedidos() {
    // O nome da função callback (handlePedidos) tem que estar no URL
    const url = `${API_URL}?action=getPedidos&callback=handlePedidos`; 
    
    // Cria e injeta o elemento script no documento
    const script = document.createElement('script');
    script.src = url;
    script.id = 'jsonpScript';
    
    // Anexa o script ao corpo para iniciar o pedido
    document.body.appendChild(script);
}

// --- FUNÇÃO PARA PROCESSAR RESPOSTA POST (CallBack) ---
/**
 * Função de callback global para receber a resposta de Escrita/Eliminação (POST).
 * @param {object} response - Objeto de resposta contendo o status.
 */
function handlePostResponse(response) {
    if (response.status && response.status.startsWith('Erro')) {
        console.error("Erro na ação POST:", response.status);
        alert(`Ocorreu um erro: ${response.status}`);
    } else {
        // Se for sucesso, força a atualização da fila para ver a mudança
        getPedidos(); 
    }
    
    // Remove o script temporário
    const scriptElement = document.getElementById('postScript');
    if (scriptElement) {
        scriptElement.remove();
    }
}

/**
 * Envia um pedido para o Apps Script (Adicionar/Eliminar) usando GET/JSONP.
 * @param {object} params - Parâmetros para enviar na requisição.
 */
function enviarAcao(params) {
    const queryParams = new URLSearchParams(params).toString();
    
    // Usamos o método GET/JSONP e enviamos os parâmetros da POST na URL
    const url = `${API_URL}?${queryParams}&callback=handlePostResponse`; 
    
    // Cria e injeta o elemento script no documento
    const script = document.createElement('script');
    script.src = url;
    script.id = 'postScript';
    
    // Anexa o script ao corpo para iniciar o pedido
    document.body.appendChild(script);
}

// =======================================================
// FUNÇÕES DO PARTICIPANTE (AJUSTADAS PARA JSONP E SEGURANÇA)
// =======================================================

/**
 * Função para fazer um pedido (Intervenção ou Réplica).
 */
function fazerPedido(tipo) {
    const nomeInput = document.getElementById('nome-participante');
    const nome = nomeInput.value.trim();
    const referenciaInput = document.getElementById('referencia-participante');
    let referencia = referenciaInput.value.trim();

    if (!nome) {
        alert("Por favor, introduza o seu nome para fazer o pedido.");
        return;
    }

    if (meuPedidoId !== null) {
        const isPending = filaDePedidos.some(p => p.id === meuPedidoId);
        if (isPending) {
             document.getElementById('status-participante').innerHTML = `
                ⚠️ Já tem um pedido pendente! Cancele o anterior se necessário.
            `;
            return;
        } else {
            meuPedidoId = null;
            localStorage.removeItem('kriolthink_pedido_id');
        }
    }
    
    if (tipo === 'replica' && !referencia) {
        alert("Por favor, indique a quem está a responder para a réplica.");
        return;
    }
    
    const novoId = Date.now().toString();
    const novoPedido = {
        action: 'addPedido',
        id: novoId,
        nome: nome,
        tipo: tipo,
        referencia: tipo === 'replica' ? referencia : '',
        timestamp: Date.now(),
        hora: new Date().toLocaleTimeString('pt-PT')
    };

    // Envia o pedido (assíncrono, sem 'await')
    enviarAcao(novoPedido);
    
    // Assume-se que o pedido foi enviado e guarda-se o ID localmente
    meuPedidoId = novoId;
    localStorage.setItem('kriolthink_pedido_id', novoId);

    // Atualiza a interface para mostrar o novo pedido pendente
