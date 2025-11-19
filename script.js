// !!! SUBSTITUIR ESTE URL PELO SEU URL DA WEB APP DO GOOGLE APPS SCRIPT !!!
const API_URL = 'https://script.google.com/macros/s/AKfycbzTrRTrH8ZeTl5J6azKU2yZbQ_GYNiicl2w9bAreHLFfw8MNrrNs9xSl-gNfHPeOeXj7Q/exec'; 

let meuPedidoId = localStorage.getItem('kriolthink_pedido_id') || null;
let filaDePedidos = [];

/* ============================================================
   ==========   ★★★   GET POR JSONP (SEM CORS)   ★★★   ==========
   ============================================================ */

/**
 * Lê a fila de pedidos do Google Sheets usando JSONP.
 * Isto remove completamente problemas de CORS no GitHub Pages.
 */
function getPedidos() {
    // Remove script anterior (evita múltiplas execuções duplicadas)
    const old = document.getElementById('jsonpPedidos');
    if (old) old.remove();

    // Cria a tag <script> JSONP
    const script = document.createElement('script');
    script.id = 'jsonpPedidos';
    script.src = `${API_URL}?action=getPedidos&callback=receberPedidos`;
    document.body.appendChild(script);
}

/**
 * Função chamada automaticamente pelo Google Apps Script via JSONP.
 */
function receberPedidos(data) {
    filaDePedidos = data.map(p => ({
        ...p,
        id: String(p.id),
        timestamp: p.timestamp ? parseInt(p.timestamp) : 0
    }));

    atualizarInterfaceParticipante();
    atualizarInterfaceModerador();
}

/* ============================================================
   ==========   ★★★   POST NORMAL (NÃO PRECISA JSONP)   ★★★   ==========
   ============================================================ */

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
            throw new Error(result);
        }

        // Atualiza fila após ação
        getPedidos();
        return true;

    } catch (error) {
        console.error("Erro na ação:", error);
        alert(`Ocorreu um erro ao comunicar com a base de dados: ${error.message}`);
        return false;
    }
}

/* ============================================================
   ==========   ★★★   FUNÇÕES DO PARTICIPANTE   ★★★   ==========
   ============================================================ */

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
        const isPending = filaDePedidos.some(p => p.id === meuPedidoId);
        if (isPending) {
            document.getElementById('status-participante').innerHTML = `
                ⚠️ Já tem um pedido pendente (ID: ${meuPedidoId}). Cancele o anterior se necessário.
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

    const sucesso = await enviarAcao(novoPedido);

    if (sucesso) {
        meuPedidoId = novoId;
        localStorage.setItem('kriolthink_pedido_id', novoId);
        atualizarInterfaceParticipante();
        document.getElementById('status-participante').innerHTML = `
            ✅ Pedido de **${tipo}** enviado com sucesso às ${novoPedido.hora}!
            ${tipo === 'replica' ? `(A responder a: ${referencia})` : ''}
        `;
    }
}

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

function atualizarInterfaceParticipante() {
    const cancelarBtn = document.getElementById('cancelar-btn');
    const statusDiv = document.getElementById('status-participante');
    
    let meuPedido = null;
    if (meuPedidoId) {
        meuPedido = filaDePedidos.find(p => p.id === meuPedidoId);
    }
    
    if (meuPedido) {
        cancelarBtn.style.display = 'block';

        const filaDoTipo = filaDePedidos
            .filter(p => p.tipo === meuPedido.tipo)
            .sort((a, b) => a.timestamp - b.timestamp);
            
        const posicao = filaDoTipo.findIndex(p => p.id === meuPedido.id) + 1;
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
        
        if (meuPedidoId !== null) {
            statusDiv.innerHTML = "<h4>☑️ Pedido Concluído</h4><p>O seu pedido foi atendido ou removido pelo moderador. Pode fazer um novo pedido.</p>";
            meuPedidoId = null;
            localStorage.removeItem('kriolthink_pedido_id');
        } else {
            statusDiv.innerHTML = "<h4>✅ Pronto para Fazer Pedido</h4><p>Nenhum pedido pendente.</p>";
        }
    }
}

/* ============================================================
   ==========   ★★★   FUNÇÕES DO MODERADOR   ★★★   ==========
   ============================================================ */

async function eliminarPedido(id) {
    const params = {
        action: 'deletePedido',
        id: id
    };
    await enviarAcao(params);
}

function atualizarInterfaceModerador() {
    const listasDiv = document.getElementById('listas-moderador');
    listasDiv.innerHTML = ''; 
    if (!listasDiv) return; 

    const intervencoes = filaDePedidos
        .filter(p => p.tipo === 'intervencao')
        .sort((a, b) => a.timestamp - b.timestamp); 

    const replicas = filaDePedidos
        .filter(p => p.tipo === 'replica')
        .sort((a, b) => a.timestamp - b.timestamp); 

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

    listasDiv.innerHTML = htmlIntervencao + htmlReplica;
}

/* ============================================================
   ==========   ★★★   TEMPO DE ESPERA   ★★★   ==========
   ============================================================ */

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

/* ============================================================
   ==========   ★★★   INICIALIZAÇÃO   ★★★   ==========
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    getPedidos(); 
    
    setInterval(getPedidos, 5000); 
    
    if (document.getElementById('moderador-interface')) {
        setInterval(calcularTempoEspera, 1000);
    }
});
