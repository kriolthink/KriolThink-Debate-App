// =======================================================
// VARIÁVEIS GLOBAIS E CONFIGURAÇÃO
// =======================================================
// !!! SUBSTITUIR ESTE URL PELO SEU NOVO URL DA WEB APP DO GOOGLE APPS SCRIPT !!!
const API_URL = 'https://script.google.com/macros/s/AKfycbwT28a8DNDmGcYw9Ch3ZU6mEp6f7gPUc_drWwrfVUSzGbRqfmX4-X4MKydRS3Si0pXhoA/exec'; 

// LÊ O ID DO PEDIDO PENDENTE DIRETAMENTE DO URL (?my_id=...)
const urlParams = new URLSearchParams(window.location.search);
let meuPedidoId = urlParams.get('my_id') || null; 

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
    // 1. Converte IDs e Timestamps para número
    filaDePedidos = data.map(p => ({
        ...p,
        id: String(p.id),
        timestamp: p.timestamp ? parseInt(p.timestamp) : 0 
    }));
    
    // 2. Lógica de RASTREIO DO PEDIDO DO PARTICIPANTE (Baseado no URL)
    if (meuPedidoId) {
        // Verifica se o ID do URL ainda existe na fila
        const meuPedidoExiste = filaDePedidos.some(p => String(p.id) === String(meuPedidoId));
        
        if (!meuPedidoExiste) {
            // Se o pedido não estiver mais na fila (foi atendido/removido), limpa o URL
            meuPedidoId = null;
            // Redireciona para o URL base sem o my_id (limpeza automática)
            window.history.pushState({}, '', 'index.html'); 
        }
    }
    
    // 3. Atualiza ambas as interfaces
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
    const url = `${API_URL}?action=getPedidos&callback=handlePedidos`; 
    
    const script = document.createElement('script');
    script.src = url;
    script.id = 'jsonpScript';
    
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
    const url = `${API_URL}?${queryParams}&callback=handlePostResponse`; 
    
    const script = document.createElement('script');
    script.src = url;
    script.id = 'postScript';
    
    document.body.appendChild(script);
}

// =======================================================
// FUNÇÕES DO PARTICIPANTE (AJUSTADAS PARA URL)
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

    // Prevenção de múltiplos pedidos (baseada na fila atual)
    if (filaDePedidos.some(p => String(p.id) === String(meuPedidoId))) {
         document.getElementById('status-participante').innerHTML = `
            ⚠️ Já tem um pedido pendente! Cancele o anterior se necessário.
        `;
        return;
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

    // Envia o pedido (assíncrono)
    enviarAcao(novoPedido);
    
    // REDIRECIONAMENTO CRÍTICO: Anexa o ID do pedido à URL para persistência
    window.location.href = `index.html?my_id=${novoId}`;
}

/**
 * Função para cancelar o pedido.
 */
function cancelarPedido() {
    if (!meuPedidoId) {
        document.getElementById('status-participante').innerHTML = "Não tem um pedido pendente para cancelar.";
        return;
    }
    
    const params = {
        action: 'deletePedido',
        id: meuPedidoId
    };

    // Envia a ação de remoção
    enviarAcao(params);
    
    // Após o envio, redireciona para a página base (limpa o URL)
    window.location.href = 'index.html'; 
}

/**
 * Atualiza o estado visual do participante.
 */
function atualizarInterfaceParticipante() {
    const cancelarBtn = document.getElementById('cancelar-btn');
    const statusDiv = document.getElementById('status-participante');
    
    // Sai se não estiver na página do participante
    if (!cancelarBtn || !statusDiv) {
        return; 
    }
    
    // 1. Encontrar o pedido pendente (baseado no meuPedidoId lido do URL)
    let meuPedido = null;
    const idParaBuscar = meuPedidoId ? String(meuPedidoId) : null; 

    if (idParaBuscar) {
        meuPedido = filaDePedidos.find(p => String(p.id) === idParaBuscar); 
    }
    
    // 2. Lógica de exibição e rastreamento
    if (meuPedido) {
        cancelarBtn.style.display = 'block';

        const filaDoTipo = filaDePedidos
            .filter(p => p.tipo === meuPedido.tipo)
            .sort((a, b) => a.timestamp - b.timestamp);
            
        const posicao = filaDoTipo.findIndex(p => String(p.id) === idParaBuscar) + 1;
        const totalNaFila = filaDoTipo.length;
        
        statusDiv.innerHTML = `
            <h4>⌛ O Seu Pedido Pendente:</h4>
            <div class="meu-pedido-item">
                <p>
                    Tipo: <strong>${meuPedido.tipo.charAt(0).toUpperCase() + meuPedido.tipo.slice(1)}</strong> 
                    (Feito às ${meuPedido.hora})
                    ${meuPedido.tipo === 'replica' ? ` | Ref.: **${meuPedido.referencia}**` : ''}
                </p>
                <p>
                    **Posição na fila de ${meuPedido.tipo}**: ${posicao} de ${totalNaFila}
                </p>
            </div>
        `;
        
    } else {
        cancelarBtn.style.display = 'none';
        
        // Se o ID estava no URL mas não está na fila do Sheets, limpamos o estado
        if (meuPedidoId !== null) {
             statusDiv.innerHTML = "<h4>☑️ Pedido Concluído</h4><p>O seu pedido foi atendido ou removido pelo moderador. Pode fazer um novo pedido.</p>";
             // O redirecionamento na função handlePedidos já faz a limpeza da URL
        } else {
            statusDiv.innerHTML = "<h4>✅ Pronto para Fazer Pedido</h4><p>Nenhum pedido pendente.</p>";
        }
    }
}


// =======================================================
// FUNÇÕES DO MODERADOR 
// =======================================================

/**
 * Função para eliminar um pedido da fila.
 */
function eliminarPedido(id) {
    const params = {
        action: 'deletePedido',
        id: id
    };
    
    enviarAcao(params);
}

/**
 * Atualiza a interface do moderador com os pedidos mais recentes.
 */
function atualizarInterfaceModerador() {
    const listasDiv = document.getElementById('listas-moderador');
    
    // Sai se não estiver na página do moderador
    if (!listasDiv) {
        return; 
    }
    
    listasDiv.innerHTML = ''; 

    // 1. Filtrar e ordenar por tipo e ordem de pedido (timestamp)
    const intervencoes = filaDePedidos
        .filter(p => p.tipo === 'intervencao')
        .sort((a, b) => a.timestamp - b.timestamp); 

    const replicas = filaDePedidos
        .filter(p => p.tipo === 'replica')
        .sort((a, b) => a.timestamp - b.timestamp); 

    // 2. Construir as colunas
    // Coluna Intervenções
    let htmlIntervencao = `
        <div class="fila intervencao">
            <h3>Intervenções (${intervencoes.length})</h3>
    `;
    if (intervencoes.length === 0) {
        htmlIntervencao += '<p>Nenhuma intervenção pendente.</p>';
    } else {
        intervencoes.forEach(pedido => {
            htmlIntervencao += `
                <div class="pedido-item">
                    <span>
                        <strong>${pedido.nome}</strong> 
                        <span class="tempo-espera" data-timestamp="${pedido.timestamp}"></span> 
                        <br><small>(${pedido.hora})</small>
                    </span>
                    <button onclick="eliminarPedido('${pedido.id}')">Atender/Remover</button>
                </div>
            `;
        });
    }
    htmlIntervencao += '</div>';

    // Coluna Réplicas
    let htmlReplica = `
        <div class="fila replica">
            <h3>Réplicas (${replicas.length})</h3>
    `;
    if (replicas.length === 0) {
        htmlReplica += '<p>Nenhuma réplica pendente.</p>';
    } else {
        replicas.forEach(pedido => {
            htmlReplica += `
                <div class="pedido-item">
                    <span>
                        <strong>${pedido.nome}</strong> - Resp. a **${pedido.referencia}**
                        <span class="tempo-espera" data-timestamp="${pedido.timestamp}"></span> 
                        <br><small>(${pedido.hora})</small>
                    </span>
                    <button onclick="eliminarPedido('${pedido.id}')">Atender/Remover</button>
                </div>
            `;
        });
    }
    htmlReplica += '</div>';

    // 3. Inserir no HTML
    listasDiv.innerHTML = htmlIntervencao + htmlReplica;
    
    calcularTempoEspera();
}


// =======================================================
// FUNÇÕES DE TEMPO E INICIALIZAÇÃO
// =======================================================

/**
 * Calcula o tempo de espera (desde o pedido).
 */
function calcularTempoEspera() {
    const items = document.querySelectorAll('.tempo-espera');
    items.forEach(item => {
        const timestamp = parseInt(item.getAttribute('data-timestamp'));
        if (isNaN(timestamp)) return;
        
        const tempoDecorridoMs = Date.now() - timestamp;
        const segundos = Math.floor(tempoDecorridoMs / 1000) % 60;
        const minutos = Math.floor(tempoDecorridoMs / (1000 * 60));

        item.textContent = `(${minutos}m ${segundos}s)`;
        item.style.fontWeight = 'bold';
        item.style.color = minutos >= 5 ? '#dc3545' : '#007bff'; 
    });
}


// --- INICIALIZAÇÃO (SETUP) ---
document.addEventListener('DOMContentLoaded', () => {
    // Carrega os pedidos ao iniciar
    getPedidos(); 
    
    // Atualiza a fila de pedidos do Google Sheets a cada 5 segundos
    setInterval(getPedidos, 5000); 
    
    // Só executa o cálculo do tempo de espera se estivermos na página do moderador
    if (document.getElementById('moderador-interface')) {
        // Atualiza o tempo de espera no ecrã a cada segundo
        setInterval(calcularTempoEspera, 1000);
    }
});
