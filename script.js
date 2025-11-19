// =======================================================
// VARIÁVEIS GLOBAIS E CONFIGURAÇÃO
// =======================================================
// !!! SUBSTITUIR ESTE URL PELO SEU NOVO URL DA WEB APP DO GOOGLE APPS SCRIPT !!!
const API_URL = 'https://script.google.com/macros/s/AKfycbxJgJ_iCFoMWZvatArBrcmfqKJWwEa74RZd_t_jQL5KEr0cC5aaAWQVUA9ntMbyyNVD8A/exec'; 

let meuPedidoId = sessionStorage.getItem('kriolthink_pedido_id') || null;
let meuNomeParticipante = sessionStorage.getItem('kriolthink_nome') || null; // NOVO: Armazenar o nome
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
    // 1. CARREGAR O ID LOCAL NO INÍCIO DO CALLBACK (Garantir que é o valor mais recente)
    meuPedidoId = sessionStorage.getItem('kriolthink_pedido_id') || null;
    meuNomeParticipante = sessionStorage.getItem('kriolthink_nome') || null; // <--- Carregar o nome

    // 2. Converte IDs e Timestamps para número
    filaDePedidos = data.map(p => ({
        ...p,
        id: String(p.id),
        timestamp: p.timestamp ? parseInt(p.timestamp) : 0 
    }));
    
    // 3. Lógica de RASTREIO DO PEDIDO DO PARTICIPANTE
    if (meuPedidoId && meuNomeParticipante) {
        // Verifica se O NOME ainda tem QUALQUER pedido pendente na fila
        const temPedidoPendente = filaDePedidos.some(
            p => p.nome.trim().toLowerCase() === meuNomeParticipante.trim().toLowerCase()
        );
        
        if (!temPedidoPendente) {
            // Se NENHUM pedido com este nome estiver na fila, limpa tudo localmente.
            meuPedidoId = null;
            meuNomeParticipante = null;
            sessionStorage.removeItem('kriolthink_pedido_id');
            sessionStorage.removeItem('kriolthink_nome');
        } else {
            // Se ainda houver pedidos, mantemos o ID/Nome para o rastreio
        }
    }
    
    // 4. Atualiza ambas as interfaces (Agora com filaDePedidos garantidamente atualizada)
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

    // 1. Validação de nome
    if (!nome) {
        alert("Por favor, introduza o seu nome para fazer o pedido.");
        return;
    }
    
    // 2. Validação de Réplica
    if (tipo === 'replica' && !referencia) {
        alert("Por favor, indique a quem está a responder para a réplica.");
        return; // Sai se a réplica for inválida
    }

    // 3. Criação e Gravação do NOVO ID e Nome (SÓ SE FOR VÁLIDO)
    const novoId = Date.now().toString();
    meuPedidoId = novoId; // Variável global para rastrear o último pedido
    meuNomeParticipante = nome; // Variável global para rastrear todos os pedidos

    // Gravação imediata na sessão
    sessionStorage.setItem('kriolthink_pedido_id', novoId);
    sessionStorage.setItem('kriolthink_nome', nome); 

    // 4. Preparação e Envio
    const novoPedido = {
        action: 'addPedido',
        id: novoId,
        nome: nome,
        tipo: tipo,
        referencia: tipo === 'replica' ? referencia : '',
        timestamp: Date.now(),
        hora: new Date().toLocaleTimeString('pt-PT')
    };

    // Envia o pedido (assíncrono). A resposta chamará getPedidos()
    enviarAcao(novoPedido);
    
    // Feedback visual imediato
    document.getElementById('status-participante').innerHTML = `
        <h4>⚙️ A Enviar Pedido...</h4>
        <p>Aguarde um momento enquanto confirmamos a sua posição na fila.</p>
    `; 
}

/**
 * Função para cancelar um pedido específico pelo seu ID (chamada pelos botões individuais).
 */
function cancelarPedidoEspecifico(idParaRemover) {
    if (!idParaRemover) return;
    
    const params = {
        action: 'deletePedido',
        id: idParaRemover
    };

    // Envia a ação (assíncrono)
    enviarAcao(params);

    // Feedback visual imediato
    document.getElementById('status-participante').innerHTML = `A tentar cancelar o pedido com ID ${idParaRemover}...`;
}

/**
 * Função para cancelar o pedido. (MANTIDA, mas agora pode ser obsoleta)
 */
function cancelarPedido() {
    if (meuPedidoId === null) {
        document.getElementById('status-participante').innerHTML = "Não tem um pedido pendente para cancelar.";
        return;
    }
    
    // Apenas chama a função específica
    cancelarPedidoEspecifico(meuPedidoId);
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
    
    // 1. CARREGAR O NOME (Garantir que é o valor mais recente)
    // Usamos o nome guardado para filtrar todos os pedidos.
    const nomeParaBuscar = sessionStorage.getItem('kriolthink_nome') || null;
    
    // Sai se não houver um nome guardado para rastrear
    if (!nomeParaBuscar) {
        cancelarBtn.style.display = 'none';
        statusDiv.innerHTML = "<h4>✅ Pronto para Fazer Pedido</h4><p>Nenhum pedido pendente.</p>";
        // Limpar o meuPedidoId e o nome caso tenham ficado "sujos"
        meuPedidoId = null;
        sessionStorage.removeItem('kriolthink_pedido_id');
        return;
    }
    
    // 2. ENCONTRAR TODOS OS PEDIDOS PENDENTES DO PARTICIPANTE
    const meusPedidos = filaDePedidos
        // Filtra pelo nome e ordena pelo timestamp para a ordem correta
        .filter(p => p.nome.trim().toLowerCase() === nomeParaBuscar.trim().toLowerCase()) 
        .sort((a, b) => a.timestamp - b.timestamp);
    
    // 3. Lógica de exibição e rastreamento
    if (meusPedidos.length > 0) {
        // Se há pedidos pendentes, mostramos a lista
        let htmlPedidos = `<h4>⌛ Os Seus Pedidos Pendentes (${meusPedidos.length}):</h4>`;
        
        meusPedidos.forEach((pedido, index) => {
            // Lógica para calcular a posição na fila (mantida, mas aplicada por tipo)
            const filaDoTipo = filaDePedidos
                .filter(p => p.tipo === pedido.tipo)
                .sort((a, b) => a.timestamp - b.timestamp);
                
            const posicao = filaDoTipo.findIndex(p => String(p.id) === String(pedido.id)) + 1;
            const totalNaFila = filaDoTipo.length;
            
            // CONSTRUÇÃO DO HTML DA LISTAGEM DE CADA PEDIDO
            htmlPedidos += `
                <div class="meu-pedido-item">
                    <h5>${index + 1}. ${pedido.tipo.charAt(0).toUpperCase() + pedido.tipo.slice(1)}</h5>
                    <p>
                        ${pedido.tipo === 'replica' ? `Ref.: **${pedido.referencia}** | ` : ''}
                        Feito às ${pedido.hora}
                    </p>
                    <p>
                        **Posição na fila de ${pedido.tipo}**: ${posicao} de ${totalNaFila}
                    </p>
                    <button class="small-cancel-btn" onclick="cancelarPedidoEspecifico('${pedido.id}')">
                        Cancelar Este Pedido
                    </button>
                </div>
                <hr style="border-top: 1px solid #eee; margin: 10px 0;">
            `;
            
            // ATUALIZAÇÃO DO meuPedidoId: Guardamos o ID do PRIMEIRO pedido (mais antigo)
            // para que o botão de cancelar global possa ser usado (se necessário).
            if (index === 0) {
                 meuPedidoId = String(pedido.id);
            }
        });
        
        statusDiv.innerHTML = htmlPedidos;
        cancelarBtn.style.display = 'none'; // Escondemos o botão global para usar o individual
        
    } else {
        // SE CHEGOU AQUI, O NOME EXISTE, MAS NÃO HÁ PEDIDOS PENDENTES
        cancelarBtn.style.display = 'none';
        
        // Limpar o ID e o Nome local, pois todos os pedidos foram atendidos
        statusDiv.innerHTML = "<h4>☑️ Pedidos Concluídos</h4><p>Todos os seus pedidos foram atendidos ou removidos. Pode fazer um novo pedido.</p>";
        meuPedidoId = null;
        meuNomeParticipante = null;
        sessionStorage.removeItem('kriolthink_pedido_id');
        sessionStorage.removeItem('kriolthink_nome');
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

// =======================================================
// FUNÇÃO DE ATUALIZAÇÃO MANUAL
// =======================================================

/**
 * Força a atualização da lista, garantindo que o nome atual é persistido.
 */
function forcarAtualizacaoLista() {
    const nomeInput = document.getElementById('nome-participante');
    const nomeAtual = nomeInput.value.trim();

    if (nomeAtual) {
        // Se o utilizador mudou o nome, precisamos de o salvar para o rastreio
        sessionStorage.setItem('kriolthink_nome', nomeAtual);
        
        // Atualiza a variável global (para ser usada em handlePedidos)
        meuNomeParticipante = nomeAtual; 
    }
    
    // Feedback visual imediato
    document.getElementById('status-participante').innerHTML = `
        <h4>⏱️ A Atualizar...</h4>
        <p>A carregar os pedidos mais recentes da fila.</p>
    `;

    // Força a chamada do GET (que chamará handlePedidos)
    getPedidos();
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
