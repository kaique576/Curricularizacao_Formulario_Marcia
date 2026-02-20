/**
 * SISTEMA DE ANAMNESE E GERENCIAMENTO DE PACIENTES
 * Este script lida com a renderização dinâmica, captura de dados (Model),
 * persistência local e exportação para documentos DOCX.
 */

// Importação das perguntas via módulo JSON (Suporte em navegadores modernos)
import perguntas from 'perguntas.json' assert { type: 'json' };

// Torna a função exportHTML global para acesso via atributos de evento HTML (ex: onclick)
window.exportHTML = exportHTML;

/**
 * Evento principal de inicialização: ocorre quando o HTML base é carregado.
 * Orquestra a construção do formulário, carregamento de dados prévios e busca.
 */
document.addEventListener("DOMContentLoaded", () => {
    buildForm(perguntas); // Constrói a estrutura do formulário baseada no JSON
    loadData();           // Carrega dados existentes do armazenamento (se houver)
    initSearch();         // Inicializa a lógica de filtragem/busca na interface
});

/**
 * RENDERIZAR SEÇÃO COMPLETA
 * Transforma o esquema de uma seção (vinda do perguntas.json) em blocos de HTML.
 * @param {Object} secao - Contém meta (id, título) e schema (campos e tipo de layout).
 */
function renderSecao(secao) {
    const { meta, schema } = secao;
    const { titulo } = meta;
    const { type, fields } = schema;

    let camposHTML = "";

    // Verifica se o tipo da seção suporta campos mapeáveis
    if (type === "checklist" || type === "form" || type === "checklist_com_escala") {
        // Itera sobre cada campo chamando a função renderField (presumida global)
        camposHTML = fields.map(renderField).join("");
    }

    // Retorna o template string com a estrutura da seção
    return `
        <section class="secao" data-id="${meta.id}">
            <h2>${titulo}</h2>
            <div class="secao-content">
                ${camposHTML}
            </div>
        </section>
    `;
}

/**
 * RENDERIZAR FORMULÁRIO COMPLETO
 * Organiza todas as seções importadas conforme a ordem definida e injeta no DOM.
 */
function renderFormulario() {
    // Ordena as seções com base na propriedade 'ordenacao' definida no meta de cada módulo
    const secoesOrdenadas = FORMULARIO_COMPLETO.sort((a, b) => a.meta.ordenacao - b.meta.ordenacao);
    
    // Injeta o HTML gerado no container principal 'app'
    app.innerHTML = secoesOrdenadas.map(renderSecao).join("");

    // Após renderizar o HTML, vincula os eventos de escuta aos novos elementos
    addEventListeners();
}

/**
 * ADICIONAR EVENTOS AOS CAMPOS
 * Implementa a reatividade: sempre que um usuário interage, o objeto 'model' é atualizado.
 */
function addEventListeners() {
    // Escuta campos de entrada de texto, números, datas e seleções
    document.querySelectorAll('input[type="text"], input[type="number"], input[type="date"], textarea, select')
        .forEach(input => {
            input.addEventListener('input', (e) => {
                // Sincroniza o valor do input com o modelo global de dados
                model[e.target.id] = e.target.value;
                console.log(`Model atualizado: ${e.target.id} = ${e.target.value}`);
            });
        });

    // Escuta botões de rádio (ex: Sim/Não)
    document.querySelectorAll('.radio-group input[type="radio"]')
        .forEach(radio => {
            radio.addEventListener('change', (e) => {
                const name = e.target.name;
                model[name] = e.target.value;
                console.log(`Model atualizado: ${name} = ${e.target.value}`);
            });
        });

    // Escuta seletores deslizantes (Sliders/Range)
    document.querySelectorAll('input[type="range"]')
        .forEach(slider => {
            slider.addEventListener('input', (e) => {
                model[e.target.id] = e.target.value;
                
                // Atualiza o display visual numérico ao lado do slider
                const display = e.target.nextElementSibling;
                if (display && display.classList.contains('scale-value')) {
                    display.textContent = e.target.value;
                }
            });
        });
}

/**
 * RE-INICIALIZAÇÃO E PERSISTÊNCIA
 * Configura os botões de ação principal (Salvar e Exportar).
 */
document.addEventListener('DOMContentLoaded', () => {
    renderFormulario();

    // Botão Salvar: Persiste o objeto 'model' no banco de dados local (IndexedDB)
    document.getElementById('btnSalvar').addEventListener('click', async () => {
        console.log('Modelo para salvar:', model);
        try {
            await salvarPaciente(model); // Função definida em db.js
            alert('Paciente salvo com sucesso!');
        } catch (err) {
            console.error('Erro ao salvar:', err);
            alert('Erro ao salvar paciente.');
        }
    });

    // Botão Gerar DOCX: Inicia o processo de criação de documento Word
    document.getElementById('btnGerarDoc').addEventListener('click', gerarDoc);
});

/**
 * GERAR DOCX (Versão docxtemplater)
 * Utiliza um template Word pré-existente e preenche com os dados do 'model'.
 */
async function gerarDoc() {
    // Validação de segurança: verifica se as bibliotecas de processamento de arquivos estão presentes
    if (typeof PizZip === 'undefined' || typeof docxtemplater === 'undefined') {
        alert('Bibliotecas PizZip/docxtemplater não carregadas!');
        return;
    }

    try {
        // 1. Busca o arquivo de modelo (.docx) no servidor
        const response = await fetch("template.docx");
        const content = await response.arrayBuffer();

        // 2. Carrega o conteúdo no PizZip
        const zip = new PizZip(content);
        
        // 3. Inicializa o docxtemplater para substituir as tags {tag} pelos dados
        const doc = new docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

        // 4. Injeta o objeto de dados (model) e renderiza o documento
        doc.setData(model);
        doc.render();

        // 5. Gera o arquivo final como um Blob (objeto binário)
        const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        });

        // 6. Define o nome do arquivo com base no nome do paciente e data atual
        const nome = model.ident_nome || "Paciente";
        saveAs(out, `Registro_${nome}_${new Date().toISOString().split('T')[0]}.docx`);

        alert("Documento gerado com sucesso!");
    } catch (err) {
        console.error("Erro ao gerar DOCX:", err);
        alert("Falha ao gerar documento. Verifique o console.");
    }
}
