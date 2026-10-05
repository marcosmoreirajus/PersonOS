import json

from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.schemas import (
    AccountCreate,
    AccountUpdate,
    BulkAction,
    CardCreate,
    CardUpdate,
    PostponePayload,
    PreferencesUpdate,
    ReconcilePayload,
    SeriesExtend,
    SettlePayload,
    TransactionCreate,
    TransactionUpdate,
)
from app.services import DataService, BusinessService
from app.services import import_service as ImportService
from app.services import cartoes, relatorios, relatorios_parcelados, vencimentos
from app.services.import_service import ArquivoInvalido

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "message": "PersonOS API",
        "version": settings.api_version,
        "environment": settings.environment,
        "status": "mock data (MVP 1.0)",
    }


@app.get("/health")
async def health_check():
    return {"status": "ok"}


# Rotas de Usuários
@app.get("/api/users")
async def get_users():
    return {"data": DataService.get_users()}


@app.get("/api/users/{user_id}")
async def get_user(user_id: int):
    user = DataService.get_user_by_id(user_id)
    if not user:
        return {"error": "User not found"}, 404
    return {"data": user}


# Rotas de Categorias
@app.get("/api/categories")
async def get_categories():
    return {"data": DataService.get_categories()}


# Rotas de Transações
@app.get("/api/transactions")
async def get_transactions():
    return {"data": DataService.get_transactions()}


@app.get("/api/transactions/user/{user_id}")
async def get_user_transactions(user_id: int, ingest_state: str = "confirmed"):
    """
    Por padrão só as confirmadas: é o que saldo, relatório e listagem enxergam.
    `awaiting_reconciliation` devolve a fila de conciliação; `all`, as duas.
    """
    todas = DataService.get_transactions_by_user(user_id, include_unconfirmed=True)
    if ingest_state != "all":
        todas = [t for t in todas if t.get("ingest_state", "confirmed") == ingest_state]
    return {"data": todas}


@app.post("/api/transactions")
async def create_transaction(payload: TransactionCreate):
    """Cria uma transação e persiste em backend/data/transactions.json."""
    # mode="json" converte date/Enum em string: o JSON de dados guarda
    # datas de calendário como "YYYY-MM-DD", sem hora e sem fuso.
    new_transaction = DataService.create_transaction(**payload.model_dump(mode="json"))
    return {"data": new_transaction}


@app.post("/api/transactions/bulk")
async def bulk_transactions(payload: BulkAction):
    """
    Operações em lote sobre uma seleção da tela.

    Seleção não é série: cada item é tratado isoladamente, e nenhum molde de
    série é alterado aqui.
    """
    if payload.action == "delete":
        return {"data": {"deleted": DataService.bulk_delete(payload.ids)}}

    mudancas = payload.changes.model_dump(mode="json", exclude_none=True) if payload.changes else {}
    if not mudancas:
        return {"error": "Nada para alterar"}, 400
    return {"data": {"updated": DataService.bulk_update(payload.ids, mudancas)}}

@app.patch("/api/transactions/{transaction_id}")
async def update_transaction(transaction_id: int, payload: TransactionUpdate):
    """Edita uma transação. `scope` decide se a série toda acompanha."""
    dados = payload.model_dump(mode="json", exclude_none=True)
    scope = dados.pop("scope", "only_this")
    atualizada = DataService.update_transaction(transaction_id, dados, scope)
    if atualizada is None:
        return {"error": "Transaction not found"}, 404
    return {"data": atualizada}


@app.delete("/api/transactions/{transaction_id}")
async def delete_transaction(transaction_id: int, scope: str = "only_this"):
    """Exclui. Em escopo de série, encerra o molde pra não ressuscitar."""
    removidas = DataService.delete_transaction(transaction_id, scope)
    if removidas == 0:
        return {"error": "Transaction not found"}, 404
    return {"data": {"deleted": removidas}}


# Contas (mínimo — Fatia 3)
#
# Uma conta por banco. Existem para a importação saber de onde o extrato veio
# e para o mesmo extrato em CSV e OFX ser reconhecido como o mesmo.
@app.get("/api/accounts/user/{user_id}")
async def get_accounts(user_id: int):
    return {"data": DataService.get_accounts(user_id)}


@app.post("/api/accounts")
async def create_account(payload: AccountCreate):
    try:
        return {"data": DataService.create_account(
            payload.user_id, payload.name, payload.kind.value, payload.initial_balance, payload.logo
        )}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.patch("/api/accounts/{account_id}")
async def update_account(account_id: int, payload: AccountUpdate):
    try:
        conta = DataService.update_account(
            account_id,
            payload.name,
            payload.kind.value if payload.kind else None,
            payload.initial_balance,
            payload.logo,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if conta is None:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    return {"data": conta}


# Cartões (Fatia 5)
#
# Entidade própria, separada de Conta: dívida com ciclo (limite, fechamento,
# vencimento, conta pagadora). Fatura e compras vêm nos tickets seguintes.
@app.get("/api/cards/user/{user_id}")
async def get_cards(user_id: int):
    return {"data": cartoes.listar(user_id)}


@app.post("/api/cards")
async def create_card(payload: CardCreate):
    try:
        return {"data": cartoes.criar(
            payload.user_id,
            payload.name,
            payload.limit,
            payload.closing_day,
            payload.due_day,
            payload.default_payer_account_id,
        )}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.patch("/api/cards/{card_id}")
async def update_card(card_id: int, payload: CardUpdate):
    try:
        cartao = cartoes.atualizar(
            card_id,
            payload.name,
            payload.limit,
            payload.closing_day,
            payload.due_day,
            payload.default_payer_account_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if cartao is None:
        raise HTTPException(status_code=404, detail="Cartão não encontrado.")
    return {"data": cartao}


# Importação de extrato (Fatia 3)
#
# Limite de tamanho: um extrato pessoal tem centenas de linhas; acima disso o
# usuário provavelmente escolheu o arquivo errado, e ler tudo em memória a cada
# prévia deixa de ser barato.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


async def _ler_upload(file: UploadFile) -> bytes:
    conteudo = await file.read()
    if len(conteudo) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Arquivo grande demais (limite de 5 MB).")
    if not conteudo:
        raise HTTPException(status_code=400, detail="O arquivo está vazio.")
    return conteudo


@app.post("/api/import/preview")
async def import_preview(
    file: UploadFile = File(...), user_id: int = Form(...), account_id: int = Form(...)
):
    """Lê e classifica o arquivo SEM gravar nada."""
    conteudo = await _ler_upload(file)
    try:
        return {"data": ImportService.analisar(user_id, file.filename or "", conteudo, account_id)}
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ArquivoInvalido as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/import/commit")
async def import_commit(
    file: UploadFile = File(...),
    user_id: int = Form(...),
    account_id: int = Form(...),
    decisoes: str = Form(""),
):
    """
    Grava o que a prévia mostrou. Recalcula a partir do arquivo em vez de
    aceitar linhas do cliente: o que entra na base não pode depender de um
    payload adulterável.

    `decisoes` é um JSON `{import_hash: "merge" | "not_duplicate" | "queue"}` com
    o que o usuário decidiu sobre as linhas suspeitas na prévia. É o único dado
    do cliente aceito, e é validado contra o arquivo.
    """
    conteudo = await _ler_upload(file)
    try:
        escolhidas = json.loads(decisoes) if decisoes.strip() else {}
        if not isinstance(escolhidas, dict):
            raise ValueError
    except ValueError:
        raise HTTPException(status_code=400, detail="As decisões chegaram em formato inválido.")
    try:
        return {"data": ImportService.importar(user_id, file.filename or "", conteudo, account_id, escolhidas)}
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ArquivoInvalido as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/import/template/{formato}")
async def import_template(formato: str):
    """Modelo do layout padrão do sistema (csv ou xlsx), para download."""
    try:
        conteudo, mime, nome = ImportService.modelo_padrao(formato)
    except ValueError:
        raise HTTPException(status_code=404, detail="Modelo disponível em csv ou xlsx.")
    return Response(
        content=conteudo,
        media_type=mime,
        headers={"Content-Disposition": 'attachment; filename="%s"' % nome},
    )


@app.post("/api/reconcile/{transaction_id}")
async def reconcile(transaction_id: int, payload: ReconcilePayload):
    try:
        resultado = ImportService.conciliar(transaction_id, payload.action, payload.with_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"data": resultado}


# "A revisar" (Fatia 4): itens aguardando conciliação + lançamentos sem
# categoria. Resolver um item usa as rotas que já existem — /api/reconcile
# para a conciliação, PATCH de transação para a categoria.
@app.get("/api/review/user/{user_id}")
async def get_review(user_id: int):
    return {"data": DataService.get_review(user_id)}


# Preferências do usuário (issue #2). Hoje só os avisos do sino; a derivação
# dos avisos é do front, que sabe qual é o "hoje" local.
@app.get("/api/preferences/user/{user_id}")
async def get_preferences(user_id: int):
    return {"data": DataService.get_preferences(user_id)}


@app.patch("/api/preferences/user/{user_id}")
async def update_preferences(user_id: int, payload: PreferencesUpdate):
    return {"data": DataService.update_preferences(user_id, payload.model_dump(mode="json", exclude_none=True))}


# Dashboard
@app.get("/api/dashboard/{user_id}")
async def get_dashboard(user_id: int):
    summary = DataService.get_dashboard_summary(user_id)
    return {"data": summary}


# Relatórios por período (issue #14). `hoje` vem do cliente: é o relógio local
# dele que decide o dia, e é o que deixa o teste determinístico.
@app.get("/api/reports/summary/{user_id}")
async def get_report_summary(
    user_id: int, hoje: str, periodo: str = relatorios.PADRAO, de: str | None = None, ate: str | None = None
):
    try:
        return {"data": relatorios.resumo(user_id, periodo, hoje, de, ate)}
    except ValueError as erro:
        raise HTTPException(status_code=422, detail=str(erro))


# Próximos vencimentos da Visão Geral (issue #13). `hoje` vem do cliente.
@app.get("/api/dashboard/{user_id}/upcoming")
async def get_upcoming(user_id: int, hoje: str):
    try:
        return {"data": vencimentos.proximos(user_id, hoje)}
    except ValueError as erro:
        raise HTTPException(status_code=422, detail=str(erro))


# Despesas por categoria do período, com comparação (issue #17).
@app.get("/api/reports/categories/{user_id}")
async def get_report_categories(
    user_id: int, hoje: str, periodo: str = relatorios.PADRAO, de: str | None = None, ate: str | None = None
):
    try:
        return {"data": relatorios.categorias(user_id, periodo, hoje, de, ate)}
    except ValueError as erro:
        raise HTTPException(status_code=422, detail=str(erro))


# Maiores gastos do período (issue #19).
@app.get("/api/reports/top-expenses/{user_id}")
async def get_report_top_expenses(
    user_id: int, hoje: str, periodo: str = relatorios.PADRAO, de: str | None = None, ate: str | None = None
):
    try:
        return {"data": relatorios.maiores_gastos(user_id, periodo, hoje, de, ate)}
    except ValueError as erro:
        raise HTTPException(status_code=422, detail=str(erro))


# Parcelados (issue #20): independente do seletor de período. `hoje` vem do cliente.
@app.get("/api/reports/installments/{user_id}")
async def get_report_installments(user_id: int, hoje: str, incluir_quitados: bool = False):
    try:
        return {"data": relatorios_parcelados.parcelados(user_id, hoje, incluir_quitados)}
    except ValueError as erro:
        raise HTTPException(status_code=422, detail=str(erro))


# Rotas de Patrimônio (investimentos)
@app.get("/api/investments/{user_id}")
async def get_investments(user_id: int):
    return {"data": DataService.get_investments(user_id)}


# Rotas de Séries (recorrência e parcelamento)
#
# `/api/scheduled` foi removida na Fatia 1: desde a decisão de fonte única, o
# registro nasce em transações e Agendadas é só uma visão dele. A tela monta a
# lista com /api/transactions + /api/series.
@app.get("/api/series/user/{user_id}")
async def get_series(user_id: int):
    return {"data": DataService.get_series(user_id)}


@app.post("/api/series/extend")
async def extend_series(payload: SeriesExtend):
    """
    Roda a janela das séries do usuário.

    Chamada na virada do mês (primeira abertura do app) e ao navegar além do
    horizonte. Idempotente: repetir não duplica.
    """
    return {"data": DataService.estender_series(payload.user_id)}


@app.get("/api/series/projection/{user_id}")
async def project_series(user_id: int, de: str, ate: str):
    """Ocorrências calculadas do intervalo, sem gravar — leitura projeta."""
    return {"data": DataService.projetar_series(user_id, de, ate)}


@app.post("/api/transactions/{transaction_id}/settle")
async def settle_transaction(transaction_id: int, payload: SettlePayload | None = None):
    atualizada = DataService.settle_transaction(transaction_id, payload.on.isoformat() if payload and payload.on else None)
    if atualizada is None:
        return {"error": "Transaction not found"}, 404
    return {"data": atualizada}


@app.post("/api/transactions/{transaction_id}/postpone")
async def postpone_transaction(transaction_id: int, payload: PostponePayload | None = None):
    movidas = DataService.postpone_transaction(transaction_id, payload.scope.value if payload else "only_this")
    if movidas == 0:
        return {"error": "Transaction not found"}, 404
    return {"data": {"moved": movidas}}



# Rotas do Módulo Negócio (dados em Markdown, desacoplado do Módulo Finanças)
@app.get("/api/business/{section}")
async def get_business_section(section: str):
    data = BusinessService.get_section(section)
    if not data:
        return {"error": "Section not found"}, 404
    return {"data": data}


@app.put("/api/business/{section}")
async def update_business_section(section: str, request: Request):
    body = await request.json()
    data = BusinessService.update_section(section, body)
    if not data:
        return {"error": "Section not found"}, 404
    return {"data": data}


# Próximas fatias (ver docs/finance/PRD.md):
# - Autenticação JWT
