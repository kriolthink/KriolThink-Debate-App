// !!! SUBSTITUIR ESTE URL PELO SEU URL DA WEB APP DO GOOGLE APPS SCRIPT !!!
const API_URL = 'https://script.google.com/macros/s/AKfycbw3kFHmJI3s5-AMHOl4JH-Ml6XJh_VXYIhKRFl_oT8V6ZnU6F2awAAiumOAXlUJAWU6EA/exec'; 

let meuPedidoId = localStorage.getItem('kriolthink_pedido_id') || null;
let filaDePedidos = [];

// --- FUNÇÕES DE COMUNICAÇÃO (FETCH) ---

/**
 * Lê a fila de pedidos do Google Sheets.
 */
async function getPedidos() {
    try {
        const response = await fetch(`${API_URL}?action=getPedidos`);
        if (!response.ok) throw new Error('Falha ao ler os pedidos.');
        const data = await response.json();
        
        // Converte IDs e Timestamps para número (o Apps Script devolve tudo como string)
        filaDePedidos = data.map(p => ({
            ...p,
            id: String(p.id),
            // Verifica se o timestamp existe e é um número (proteção)
            timestamp: p.timestamp ? parseInt(p.timestamp) : 0 
        }));
        
        // Atualiza ambas as interfaces
        atualizarInterfaceParticipante();
        atualizarInterfaceModerador();
        
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}

/**
 * Envia um pedido POST para o Apps Script (Adicionar/Eliminar).
 * @param {object} params - Parâmetros para enviar na requisição.
 */
async function enviarAcao(params) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: new URLSearchParams(params)
        });
        const result = await response.text();
        
        if (result.startsWith('Erro')) {
            // Lança um erro se o Google Sheet retornar um erro (ex: ID não encontrado)
            throw new Error(result);
        }
        
        // Após o sucesso, recarrega a fila para obter os dados mais recentes
        getPedidos();
        return true;
    } catch (error) {
        console.error("Erro na ação:", error);
        alert(`Ocorreu um erro ao comunicar com a base de dados: ${error.message}`);
        return false;
    }
}
// --------------------------------------------------------------------------

// --- FUNÇÕES DO PARTICIPANTE ---

/**
 * Função para fazer um pedido (Intervenção ou Réplica).
 * @param {string} tipo - 'intervencao' ou 'replica'
 */
async function fazerPedido(tipo) {
    const nomeInput = document.getElementById('nome-participante');
    const nome = nomeInput.value.trim();
    const referenciaInput = document.getElementById('referencia-participante');
    let referencia = referenciaInput.value.trim();

    if (!nome) {
        alert("Por favor, introduza o seu nome para fazer o pedido.");
        return;
    }

    if (meuPedidoId !== null) {
        // Verifica se o ID guardado localmente ainda está na fila (proteção)
        const isPending = filaDePedidos.some(p => p.id === meuPedidoId);
        if (isPending) {
             document.getElementById('status-participante').innerHTML = `
                ⚠️ Já tem um pedido pendente (ID: ${meuPedidoId}). Cancele o anterior se necessário.
            `;
            return;
        } else {
            // Se não estiver na fila, limpa o ID local e continua
            meuPedidoId = null;
            localStorage.removeItem('kriolthink_pedido_id');
        }
    }
    
    // Se for réplica, a referência deve ser obrigatória
    if (tipo === 'replica' && !referencia) {
        alert("Por favor, indique a quem está a responder para a réplica.");
        return;
    }
    
    // Gera um ID único e os dados do pedido
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

    // Envia para o Google Sheets
    const sucesso = await enviarAcao(novoPedido);

    if (sucesso) {
        meuPedidoId = novoId; // Guarda o novo ID
        localStorage.setItem('kriolthink_pedido_id', novoId);
        atualizarInterfaceParticipante();
        document.getElementById('status-participante').innerHTML = `
            ✅ Pedido de **${tipo}** enviado com sucesso às ${novoPedido.hora}!
            ${tipo === 'replica' ? `(A responder a: ${referencia})` : ''}
        `;
    }
}

/**
 * Função para cancelar o pedido atualmente pendente do participante.
 */
async function cancelarPedido() {
    if (meuPedidoId === null) {
        document.getElementById('status-participante').innerHTML = "Não tem um pedido pendente para cancelar.";
        return;
    }
    
    const params = {
        action: 'deletePedido',
        id: meuPedidoId
    };

    const sucesso = await enviarAcao(params);

    if (sucesso) {
        document.getElementById('status-participante').innerHTML = "❌ O seu pedido foi cancelado.";
        meuPedidoId = null; 
        localStorage.removeItem('kriolthink_pedido_id');
        atualizarInterfaceParticipante();
    } else {
        document.getElementById('status-participante').innerHTML = "Não foi possível cancelar o pedido. Tente novamente.";
    }
}

/**
 * Atualiza o estado visual do participante.
 */
function atualizarInterfaceParticipante() {
    const cancelarBtn = document.getElementById('cancelar-btn');
    const statusDiv = document.getElementById('status-participante');
    
    // 1. Encontrar o pedido pendente
    let meuPedido = null;
    if (meuPedidoId) {
        meuPedido = filaDePedidos.find(p => p.id === meuPedidoId);
    }
    
    // 2. Lógica de exibição e rastreamento
    if (meuPedido) {
        // Pedido pendente encontrado na fila global
        cancelarBtn.style.display = 'block';

        // Determinar a posição na fila (apenas para a intervenção/réplica do próprio pedido)
        const filaDoTipo = filaDePedidos
            .filter(p => p.tipo === meuPedido.tipo)
            .sort((a, b) => a.timestamp - b.timestamp);
            
        const posicao = filaDoTipo.findIndex(p => p.id === meuPedido.id) + 1;
        const totalNaFila = filaDoTipo.length;
        
        // CONSTRUÇÃO DO HTML DA LISTAGEM DO PEDIDO
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
        // Sem pedido pendente
        cancelarBtn.style.display = 'none';
        
        // Se o pedido existia mas foi removido pelo moderador:
        if (meuPedidoId !== null) {
            statusDiv.innerHTML = "<h4>☑️ Pedido Concluído</h4><p>O seu pedido foi atendido ou removido pelo moderador. Pode fazer um novo pedido.</p>";
            meuPedidoId = null;
            localStorage.removeItem('kriolthink_pedido_id');
        } else {
            statusDiv.innerHTML = "<h4>✅ Pronto para Fazer Pedido</h4><p>Nenhum pedido pendente.</p>";
        }
    }
}


// --- FUNÇÕES DO MODERADOR ---

/**
 * Função para eliminar um pedido da fila (atendido ou ignorado).
 * @param {string} id - O ID único do pedido a remover.
 */
async function eliminarPedido(id) {
    const params = {
        action: 'deletePedido',
        id: id
    };
    
    // Envia a ação de remoção. O getPedidos é chamado em caso de sucesso.
    await enviarAcao(params);
}

/**
 * Atualiza a interface do moderador com os pedidos mais recentes.
 */
function atualizarInterfaceModerador() {
    const listasDiv = document.getElementById('listas-moderador');
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
}

// --- FUNÇÕES DE TEMPO E INICIALIZAÇÃO ---

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
        item.style.color = minutos >= 5 ? '#dc3545' : '#007bff'; // Vermelho se esperar mais de 5 minutos
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
