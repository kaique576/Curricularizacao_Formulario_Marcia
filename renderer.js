/**
 * RENDERER.JS - Módulo de Renderização Dinâmica de Formulários
 * * Este script é responsável por:
 * 1. Carregar definições de perguntas de um arquivo JSON externo.
 * 2. Criar elementos HTML dinamicamente com base nos tipos de campos.
 * 3. Gerenciar o estado das respostas (Objeto 'model').
 * 4. Organizar o formulário em seções colapsáveis.
 */

// Seleção do container principal onde o formulário será montado
const root = document.getElementById("formulario");
if (!root) {
    console.error("ERRO: container #formulario não encontrado.");
}

/**
 * MODELO DE RESPOSTAS (Estado da Aplicação)
 * Objeto global exportado que armazena pares de Chave:Valor (ID da pergunta: Resposta)
 */
export const model = {};

// Variável global para armazenar a lista de perguntas carregada do JSON
let perguntas = [];

/**
 * Carrega o arquivo JSON de configuração de forma assíncrona.
 * 'cache: no-store' garante que as perguntas sejam lidas do arquivo atualizado no servidor/disco.
 */
async function carregarPerguntas() {
    const res = await fetch("./perguntas.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Falhou ao carregar perguntas.json: " + res.status);
    perguntas = await res.json();
}

/**
 * Função utilitária para criação de elementos DOM de forma simplificada.
 * @param {string} tag - O nome da tag HTML (div, label, input, etc).
 * @param {object} opts - Configurações: cls (classe), id, attrs (atributos extras).
 * @param {string} inner - Conteúdo HTML interno.
 */
function el(tag, opts = {}, inner = "") {
    const e = document.createElement(tag);
    if (opts.cls) e.className = opts.cls;
    if (opts.id) e.id = opts.id;
    if (opts.attrs) Object.entries(opts.attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (inner) e.innerHTML = inner;
    return e;
}

// ===============================
// RENDERIZADORES DE CAMPOS
// Estas funções retornam elementos HTML com ouvintes de evento ('input' ou 'change')
// que atualizam automaticamente o objeto 'model'.
// ===============================

// Renderiza campo de texto simples
function renderText(item) {
    const wrap = el("div", { cls: "campo" });
    wrap.innerHTML = `
        <label for="${item.id}">${item.text}</label>
        <input type="text" id="${item.id}" name="${item.id}">
    `;
    wrap.querySelector("input").addEventListener("input", e => model[item.id] = e.target.value);
    return wrap;
}

// Renderiza campo numérico
function renderNumber(item) {
    const wrap = el("div", { cls: "campo" });
    wrap.innerHTML = `
        <label for="${item.id}">${item.text}</label>
        <input type="number" id="${item.id}" name="${item.id}">
    `;
    wrap.querySelector("input").addEventListener("input", e => model[item.id] = e.target.value);
    return wrap;
}

// Renderiza campo de data
function renderDate(item) {
    const wrap = el("div", { cls: "campo" });
    wrap.innerHTML = `
        <label for="${item.id}">${item.text}</label>
        <input type="date" id="${item.id}" name="${item.id}">
    `;
    wrap.querySelector("input").addEventListener("input", e => model[item.id] = e.target.value);
    return wrap;
}

// Renderiza área de texto (textarea) para respostas longas
function renderTextarea(item) {
    const wrap = el("div", { cls: "campo" });
    wrap.innerHTML = `
        <label for="${item.id}">${item.text}</label>
        <textarea id="${item.id}" name="${item.id}" rows="3"></textarea>
    `;
    wrap.querySelector("textarea").addEventListener("input", e => model[item.id] = e.target.value);
    return wrap;
}

// Renderiza o componente de decisão Sim/Não com opção de campo de observação
function renderSimNao(item) {
    const wrap = el("div", { cls: "Ask" });
    wrap.innerHTML = `
        <label class="ask-label">${item.text}</label>
        <div class="radio-group">
            <label><input type="radio" name="${item.id}" value="Sim"> Sim</label>
            <label><input type="radio" name="${item.id}" value="Não"> Não</label>
        </div>
        ${item.has_observation ? `<textarea id="${item.id}_obs" placeholder="Observações"></textarea>` : ""}
    `;
    // Adiciona evento aos botões de rádio
    wrap.querySelectorAll(`input[name="${item.id}"]`)
        .forEach(r => r.addEventListener("change", e => model[item.id] = e.target.value));

    // Adiciona evento ao campo de observação, se existir
    if (item.has_observation) {
        wrap.querySelector(`#${item.id}_obs`)
            .addEventListener("input", e => model[item.id + "_obs"] = e.target.value);
    }

    return wrap;
}

// Renderiza um grupo de botões de rádio baseados em uma lista de opções
function renderRadio(item) {
    const wrap = el("div", { cls: "campo" });
    const opts = item.options.map(opt =>
        `<label><input type="radio" name="${item.id}" value="${opt}"> ${opt}</label>`
    ).join(" ");

    wrap.innerHTML = `<label>${item.text}</label><div>${opts}</div>`;

    wrap.querySelectorAll(`input[name="${item.id}"]`)
        .forEach(r => r.addEventListener("change", e => model[item.id] = e.target.value));

    return wrap;
}

// ===============================
// AGRUPAMENTO EM SEÇÕES (COLLAPSE)
// Controla a criação de blocos colapsáveis no formulário
// ===============================
function createSection(titleText) {
    const title = el("div", { cls: "section-title" }, titleText);
    const content = el("div", { cls: "section-content" });

    // Alterna as classes CSS para abrir/fechar a seção ao clicar no título
    title.addEventListener("click", () => {
        content.classList.toggle("open");
        title.classList.toggle("active");
    });

    root.appendChild(title);
    root.appendChild(content);
    return content;
}

// ===============================
// DISTRIBUIDOR DE COMPONENTES
// Age como uma "fábrica" que escolhe o renderizador correto baseado no 'type' do JSON
// ===============================
function renderItem(item, section) {
    switch (item.type) {
        case "text": return section.appendChild(renderText(item));
        case "number": return section.appendChild(renderNumber(item));
        case "date": return section.appendChild(renderDate(item));
        case "textarea": return section.appendChild(renderTextarea(item));
        case "sim_nao": return section.appendChild(renderSimNao(item));
        case "radio": return section.appendChild(renderRadio(item));
        default:
            console.warn("Tipo desconhecido:", item.type);
    }
}

// ===============================
// RENDERIZAÇÃO GERAL
// Função principal que orquestra a construção do formulário
// ===============================
async function renderFormulario() {
    // 1. Aguarda o carregamento dos dados
    await carregarPerguntas();

    let secAtual = null;

    // 2. Itera sobre o array de perguntas
    perguntas.forEach(item => {
        // Se o item for um 'group', cria uma nova seção colapsável
        if (item.type === "group") {
            secAtual = createSection(item.text);
            return;
        }
        // Se não houver seção definida, cria uma seção padrão 'Geral'
        if (!secAtual) secAtual = createSection("Geral");
        
        // Renderiza o item dentro da seção atual
        renderItem(item, secAtual);
    });
}

// Inicializa o processo de renderização ao carregar o script
renderFormulario();

// ===============================
// BOTÃO DE SALVAR (JSON)
// Configura a funcionalidade de exportação dos dados preenchidos
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnSalvar").addEventListener("click", () => {
        // Converte o objeto 'model' em uma string JSON formatada
        const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" });
        
        // Cria um link temporário para forçar o download do arquivo
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "respostas.json";
        a.click();
    });
});
