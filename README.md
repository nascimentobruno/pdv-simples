Proximos passos

📦 CHECKLIST MVP – PDV (PRODUTO COMERCIALIZÁVEL)
🔐 1. Autenticação e Controle de Acesso
•	Login com PIN funcionando
•	Redirecionamento automático para /dashboard após login
•	Bloqueio total de rotas sem sessão
•	Logout limpando sessão corretamente
•	Usuário desativado não acessa o sistema
•	Permissões por cargo funcionando (menu + rota)
•	Exceções por usuário (Allow/Deny) aplicadas corretamente
•	Sessão persistente após fechar e reabrir o app
________________________________________
🏪 2. Configuração Inicial
•	Seed automática da loja principal
•	Nome da loja salvo corretamente
•	Sistema não inicia com telas vazias
•	Tela de configuração salvando corretamente
________________________________________
📦 3. ESTOQUE (FOCO AGORA – CRÍTICO PARA MVP)
Cadastro
•	Cadastro de produto
•	Cadastro de variações (tamanho/cor/sku)
•	Definir preço de venda
•	Definir custo
•	Produto ativo/inativo
Controle de Estoque
•	Estoque por variação
•	Entrada manual de estoque
•	Ajuste manual de estoque (positivo e negativo)
•	Histórico simples de movimentação
•	Bloquear venda com estoque insuficiente
•	Estoque atualiza imediatamente após venda
•	Cancelar venda devolve estoque corretamente
•	Persistência correta ao fechar e abrir o app
Segurança do Estoque
•	Não permitir estoque negativo
•	Validação de quantidade numérica
•	Mensagem clara quando estoque insuficiente
•	Permissão separada para editar estoque (ex: só Admin)
________________________________________
🧾 4. PDV (Fluxo de Venda)
•	Busca rápida de produto
•	Adicionar item ao carrinho
•	Alterar quantidade no carrinho
•	Remover item do carrinho
•	Cálculo correto de total
•	Finalizar venda salva corretamente
•	Venda gera número único
•	Carrinho limpa após finalizar
•	Cancelamento de venda funcionando
________________________________________
💳 5. Pagamentos
•	Dinheiro
•	Pix
•	Débito
•	Crédito
•	Registro da forma de pagamento na venda
•	Cálculo de troco (dinheiro)
________________________________________
📊 6. Relatórios Mínimos
•	Vendas do dia
•	Total vendido por forma de pagamento
•	Produtos mais vendidos
•	Alerta de estoque baixo
•	Exportação CSV/Excel
________________________________________
💾 7. Persistência e Segurança de Dados
•	Dados não somem após fechar app
•	Seed não sobrescreve dados existentes
•	Backup simples (export JSON ou DB)
•	Tratamento global de erros
________________________________________
🧱 8. Estabilidade Técnica
•	Sem erros TypeScript
•	Sem erros críticos no console
•	Build do Electron funcionando
•	App abre sem tela branca
•	Menu funcionando corretamente
•	Botão Início e Voltar funcionando
________________________________________
📦 9. Produto Vendável (Acabamento)
•	Nome do app
•	Ícone personalizado
•	Tela “Sobre”
•	Versão definida (ex: v1.0.0)
•	Identificação do operador nas vendas
•	Identificação da loja nas vendas
________________________________________
🔥 DEFINIÇÃO DE “MVP PRONTO PARA VENDER”
✔ Consigo:
•	Logar
•	Vender
•	Baixar estoque
•	Cancelar venda
•	Ver relatório
•	Fechar o app
•	Reabrir
•	Continuar operando normalmente
Se isso funciona sem erro → MVP validado.

