# PersonOS

Sistema de gestão pessoal para quem tem renda diversificada (PJ + PF). O módulo Finanças é o primeiro.

## Language

### Avisos e revisão

**Aviso**:
Lembrete de prazo exibido no sino de Finanças: um lançamento em atraso ou a vencer dentro da janela configurada.
_Avoid_: Notificação, alerta, pendência

**Visto**:
Momento em que o usuário dispensou o número do sino. Os avisos continuam listados; o número só volta quando um lançamento entra num aviso em que não estava naquele momento.
_Avoid_: Lido, arquivado

**A revisar**:
Fila de trabalho de classificação: lançamentos aguardando conciliação e lançamentos sem categoria. Não é um aviso de prazo.
_Avoid_: Pendências, ocorrências

**Pendências**:
Contas a pagar e receitas a receber do mês, mostradas em Agendadas.
_Avoid_: Usar para a fila de "A revisar" ou para os avisos do sino

### Cartões

**Cartão**:
Dívida rotativa com ciclo: tem limite, dia de fechamento, dia de vencimento e conta pagadora. Não é uma Conta, que é onde o dinheiro está.
_Avoid_: Conta de cartão, conta crédito

**Fatura**:
Conjunto das compras de um ciclo do Cartão, com estado `aberta`, `fechada`, `parcialmente paga` ou `paga`. É a ponte entre a data da compra e a data do pagamento.
_Avoid_: `card_invoice`, boleto do cartão

**Pagamento da fatura**:
Transferência da conta pagadora para o Cartão. Não é despesa: a despesa foi a compra.
_Avoid_: Despesa de cartão

**Saldo anterior**:
Parte da fatura anterior que ficou sem pagar e volta como linha da fatura seguinte. É a mesma dívida, não uma despesa nova.
_Avoid_: Rotativo, encargo

**Estorno**:
Devolução de uma compra: abate a despesa da categoria original e reduz a fatura. Não é receita.
_Avoid_: Crédito, receita de estorno

### Visão Geral

**Conta**:
Lugar onde o dinheiro está (banco, carteira, investimento). Tem saldo inicial; o saldo dela é o saldo inicial mais as entradas e menos as saídas efetivadas naquela conta. Cartão não é Conta.
_Avoid_: Conta de cartão

**Saldo**:
Soma dos saldos das Contas menos a dívida dos Cartões. Pagar a fatura não o altera, porque a conta cai o mesmo tanto que a dívida.
_Avoid_: Receitas menos despesas (era a definição antiga)

**Sem conta**:
Linha do quadro que reúne os lançamentos efetivados sem Conta, para a soma das contas bater com o Saldo. Só aparece se houver algum.
_Avoid_: Conta padrão

**Contas e cartões**:
Quadro da Visão Geral com o saldo de cada Conta e, por Cartão, a fatura atual, o vencimento e o limite livre. Mostra o total nas contas, o total nos cartões e o Saldo. Não é um filtro da página.
_Avoid_: Seletor de conta

**Próximos vencimentos**:
Bloco da Visão Geral com as 5 obrigações a pagar e as 5 a receber mais próximas, atrasadas primeiro. Não é um aviso: o aviso é o sino.
_Avoid_: Pendências, avisos

### Relatórios

**Período**:
Janela de datas da tela de Relatórios. Todo gráfico dela usa o mesmo, e compara com o mesmo trecho do período anterior.
_Avoid_: Mês corrente (o período não é só o mês)

**Previsto**:
Lançamento ainda não efetivado (recorrência, parcela ou fatura fechada). Não entra em saldo nem em relatório de realizado.
_Avoid_: Pendente

**Projeção**:
Saldo líquido futuro calculado só com o que já está lançado como Previsto. Não estima gasto avulso; por isso é um piso.
_Avoid_: Previsão, estimativa

**Parcelado**:
Compra dividida em parcelas, com total, parcelas realizadas e parcelas restantes. O cartão é opcional (carnê e crediário também são).
_Avoid_: Compra parcelada no cartão

