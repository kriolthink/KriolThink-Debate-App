// =======================================================
// VARIÁVEIS GLOBAIS E CONFIGURAÇÃO
// =======================================================
// !!! SUBSTITUIR ESTE URL PELO SEU NOVO URL DA WEB APP DO GOOGLE APPS SCRIPT !!!
const API_URL = 'https://script.google.com/macros/s/AKfycbyhAA2wkH9uW5LfSZn38ATUqxkrqFuuwI3t-ZY-Yrkc-eDa9DA3dHlBHJIlhf8GFhDjLw/exec'; 

let meuPedidoId = localStorage.getItem('kriolthink_pedido_id') || null;
let filaDePedidos = [];


// =======================================================
// FUNÇÕES DE COMUNICAÇÃO (JSONP)
// =======================================================

/**
 * Função de callback global para receber os dados de Leitura (GET).
 * @param {Array<Object>} data - A lista de pedidos.
 */
function handlePedidos(data) {
    // Converte IDs e Timestamps para número
    filaDePedidos = data.map(p => ({
        ...p,
        id: String(p.id),
        timestamp: p.timestamp ? parseInt(p.timestamp) : 0 
    }));
    
    // --- LÓGICA DE RASTREIO DO PEDIDO DO PARTICIPANTE ---
    if (meuPedidoId) {
        // Verifica se o ID guardado localmente ainda está na fila (proteção)
        const meuPedidoExiste = filaDePedidos.some(p => p.id === meuPedidoId);
        
        if (!meuPedidoExiste) {
            // Se o pedido não estiver mais na fila (foi atendido/removido), limpa localmente.
            meuPedidoId = null;
            localStorage.removeItem('kriolthink_pedido_id');
        }
    }
    // ---------------------------------------------------

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

    // 1. Validação de nome (Se falhar, sai antes de gravar o ID)
    if (!nome) {
        alert("Por favor, introduza o seu nome para fazer o pedido.");
        return;
    }

    // 2. Criação e Gravação Inicial do ID (MUDANÇA CRÍTICA!)
    const novoId = Date.now().toString();
    meuPedidoId = novoId;
    localStorage.setItem('kriolthink_pedido_id', novoId); // Gravação imediata

    // 3. Verifica se já existe um pedido pendente
    if (meuPedidoId !== null) {
        const isPending = filaDePedidos.some(p => p.id === meuPedidoId);
        if (isPending) {
             document.getElementById('status-participante').innerHTML = `
                ⚠️ Já tem um pedido pendente! Cancele o anterior se necessário.
            `;
            // Se já tem um pedido, sai
            return; 
        } else {
            // Se não está na fila, o ID local é limpo na atualização, mas mantemos o novo para o envio
        }
    }
    
    // 4. Validação de Réplica
    if (tipo === 'replica' && !referencia) {
        alert("Por favor, indique a quem está a responder para a réplica.");
        // Se a réplica falhar, temos de limpar o ID gravado no passo 2!
        meuPedidoId = null;
        localStorage.removeItem('kriolthink_pedido_id');
        return;
    }
    
    // 5. Preparação e Envio
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
    
    // Atualiza a interface (será exibido o novo ID gravado)
    atualizarInterfaceParticipante(); 
}

/**
 * Função para cancelar o pedido.
 */
function cancelarPedido() {
    if (meuPedidoId === null) {
        document.getElementById('status-participante').innerHTML = "Não tem um pedido pendente para cancelar.";
        return;
    }
    
    const params = {
        action: 'deletePedido',
        id: meuPedidoId
    };

    // Envia a ação (assíncrono, sem 'await')
    enviarAcao(params);

    // Assume-se que o pedido foi enviado, a confirmação virá no callback
    document.getElementById('status-participante').innerHTML = "A tentar cancelar o seu pedido...";
}

/**
 * Atualiza o estado visual do participante.
 * INCLUI BLOQUEIO: Só executa se o elemento existir (index.html).
 */
function atualizarInterfaceParticipante() {
    const cancelarBtn = document.getElementById('cancelar-btn');
    const statusDiv = document.getElementById('status-participante');
    
    // VERIFICAÇÃO DE SEGURANÇA (Se não for a página do participante, sai)
    if (!cancelarBtn || !statusDiv) {
        return; 
    }
    
    // --- 1. ENCONTRAR O PEDIDO PENDENTE ---
    let meuPedido = null;
    
    // Convertemos para string apenas para garantir a comparação
    const idParaBuscar = meuPedidoId ? String(meuPedidoId) : null; 

    if (idParaBuscar) {
        // Usa o ID local para encontrar o objeto completo na fila de pedidos
        meuPedido = filaDePedidos.find(p => String(p.id) === idParaBuscar); 
    }
    
    // 2. Lógica de exibição e rastreamento
    if (meuPedido) {
        // SE CHEGOU AQUI, O PEDIDO EXISTE E PODE SER MOSTRADO
        cancelarBtn.style.display = 'block';

        // Lógica para calcular a posição na fila (mantida)
        const filaDoTipo = filaDePedidos
            .filter(p => p.tipo === meuPedido.tipo)
            .sort((a, b) => a.timestamp - b.timestamp);
            
        const posicao = filaDoTipo.findIndex(p => String(p.id) === idParaBuscar) + 1;
        const totalNaFila = filaDoTipo.length;
        
        // CONSTRUÇÃO DO HTML DA LISTAGEM DO PEDIDO (mantida)
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
        // SE CHEGOU AQUI, O PEDIDO FOI ATENDIDO OU NUNCA FOI FEITO
        cancelarBtn.style.display = 'none';
        
        // Se o ID existia no localStorage, mas não na fila:
        if (meuPedidoId !== null) {
            statusDiv.innerHTML = "<h4>☑️ Pedido Concluído</h4><p>O seu pedido foi atendido ou removido pelo moderador. Pode fazer um novo pedido.</p>";
            meuPedidoId = null;
            localStorage.removeItem('kriolthink_pedido_id');
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
    
    // Envia a ação de remoção (assíncrono, sem 'await')
    enviarAcao(params);
}

/**
 * Atualiza a interface do moderador com os pedidos mais recentes.
 * INCLUI BLOQUEIO: Só executa se o elemento existir (moderador.html).
 */
function atualizarInterfaceModerador() {
    const listasDiv = document.getElementById('listas-moderador');
    
    // VERIFICAÇÃO CHAVE: Sai se não estiver na página do moderador
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
    
    // Garante que o cálculo do tempo é chamado após o HTML ser carregado
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
